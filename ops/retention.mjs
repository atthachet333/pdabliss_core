// CORE backup retention (EP43). DRY-RUN BY DEFAULT — files are removed only with apply = true.
// Grandfather-father-son: the newest backup of each of the last N days, ISO weeks and months is
// kept, plus the newest `minKeep` VERIFIED backups. It refuses to touch a folder that is not on
// the config allow-list, considers only files this tool writes (<db>-<profile>-<stamp>.dump and
// their .json manifest), never removes the newest verified backup, and never removes anything if
// fewer than `minKeep` verified backups exist. Every decision is logged.
import fs from "node:fs";
import path from "node:path";
import { isInside, refuse } from "./lib.mjs";
import { parseDumpName } from "./backup.mjs";

export const DEFAULT_RETENTION = {
  daily: 7,
  weekly: 4,
  monthly: 6,
  minKeep: 3,
};

const toDate = (s) =>
  new Date(
    `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`,
  );
const isoWeek = (d) => {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t - y0) / 86400000 + 1) / 7)}`;
};

/** Decide keep / remove for one profile's backups in `dir` (pure: reads, never deletes). */
export function plan(
  dir,
  profileName,
  policy = DEFAULT_RETENTION,
  now = new Date(),
) {
  const p = { ...DEFAULT_RETENTION, ...policy };
  const all = fs
    .readdirSync(dir)
    .map((f) => ({ f, meta: parseDumpName(f) }))
    .filter((x) => x.meta && x.meta.profile === profileName)
    .map((x) => {
      let manifest = null;
      try {
        manifest = JSON.parse(
          fs.readFileSync(path.join(dir, `${x.f}.json`), "utf8"),
        );
      } catch {
        /* no manifest: treated as unverified */
      }
      return {
        file: x.f,
        at: toDate(x.meta.stamp),
        verified: manifest?.verified?.ok === true,
      };
    })
    .sort((a, b) => b.at - a.at);
  const keep = new Map();
  const why = (x, reason) =>
    keep.set(x.file, [...(keep.get(x.file) ?? []), reason]);
  const verified = all.filter((x) => x.verified);
  verified
    .slice(0, p.minKeep)
    .forEach((x) => why(x, `newest ${p.minKeep} verified`));
  const bucket = (n, key, label) => {
    const seen = new Set();
    for (const x of all) {
      const k = key(x.at);
      if (seen.has(k)) continue;
      seen.add(k);
      if (seen.size > n) break;
      why(x, label);
    }
  };
  bucket(p.daily, (d) => d.toISOString().slice(0, 10), "daily");
  bucket(p.weekly, isoWeek, "weekly");
  bucket(p.monthly, (d) => d.toISOString().slice(0, 7), "monthly");
  // Anything newer than the newest verified backup is kept (it may be verified next).
  const newestVerified = verified[0]?.at;
  for (const x of all)
    if (!newestVerified || x.at >= newestVerified)
      why(x, "newer than the newest verified");
  const remove =
    verified.length >= p.minKeep ? all.filter((x) => !keep.has(x.file)) : [];
  return {
    total: all.length,
    verified: verified.length,
    keep: all
      .filter((x) => keep.has(x.file))
      .map((x) => ({ file: x.file, reasons: keep.get(x.file) })),
    remove: remove.map((x) => x.file),
    blocked:
      verified.length < p.minKeep
        ? `only ${verified.length} verified backups (< ${p.minKeep}): nothing is removed`
        : null,
    now: now.toISOString(),
  };
}

/** Applies a plan — only with apply = true, only inside an allow-listed folder. */
export function applyRetention(
  cfg,
  dir,
  profileName,
  log,
  { apply = false } = {},
) {
  const allow = cfg.retention?.allowDirs ?? [];
  if (
    !allow.some(
      (a) => isInside(dir, a) && path.resolve(dir) === path.resolve(a),
    )
  )
    refuse(
      `retention refuses ${dir}: not on retention.allowDirs`,
      "NOT_ALLOWED",
    );
  const result = plan(dir, profileName, cfg.retention?.policy);
  log.info(
    `retention ${profileName} in ${dir}: ${result.total} backups, ${result.verified} verified, ${result.remove.length} to remove${apply ? "" : " (dry run)"}`,
    {
      remove: result.remove,
      blocked: result.blocked,
    },
  );
  if (!apply) return { ...result, applied: false };
  for (const f of result.remove) {
    for (const x of [f, `${f}.json`]) {
      const p = path.join(dir, x);
      if (fs.existsSync(p)) {
        fs.rmSync(p);
        log.info(`retention removed ${x}`);
      }
    }
  }
  return { ...result, applied: true };
}
