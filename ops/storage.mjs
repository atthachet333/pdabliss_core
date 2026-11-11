// CORE storage monitor (EP43). Measures each configured volume (database, backups, logs …) and
// classifies it ok / observe / warning / critical by used % AND absolute free GB — a large disk
// at 85 % can still have plenty of room, a small one at 70 % can be nearly full.
// It reports and alerts; it never deletes anything (no database files, WAL, tables, audit rows
// or backups). Statistics can be mocked (--mock file.json) to simulate a full disk safely.
import fs from "node:fs";
import path from "node:path";

const GB = 1024 ** 3;
export const DEFAULT_THRESHOLDS = {
  observePct: 70,
  warningPct: 80,
  criticalPct: 90,
  warningFreeGB: 20,
  criticalFreeGB: 10,
};

/** total / free bytes of the volume holding `p` (mock: { [path]: { totalBytes, freeBytes } }). */
export function measure(p, mock) {
  if (mock) {
    const m = mock[p];
    if (!m) throw new Error(`no mock statistics for ${p}`);
    return { totalBytes: m.totalBytes, freeBytes: m.freeBytes };
  }
  const s = fs.statfsSync(p);
  return { totalBytes: s.blocks * s.bsize, freeBytes: s.bavail * s.bsize };
}

export function classify({ totalBytes, freeBytes }, t = DEFAULT_THRESHOLDS) {
  const usedPct =
    totalBytes > 0 ? (100 * (totalBytes - freeBytes)) / totalBytes : 100;
  const freeGB = freeBytes / GB;
  const reasons = [];
  let level = "ok";
  const at = (lvl, why) => {
    const rank = { ok: 0, observe: 1, warning: 2, critical: 3 };
    if (rank[lvl] > rank[level]) level = lvl;
    reasons.push(why);
  };
  if (usedPct >= t.criticalPct)
    at("critical", `used ${usedPct.toFixed(1)} % ≥ ${t.criticalPct} %`);
  else if (usedPct >= t.warningPct)
    at("warning", `used ${usedPct.toFixed(1)} % ≥ ${t.warningPct} %`);
  else if (usedPct >= t.observePct)
    at("observe", `used ${usedPct.toFixed(1)} % ≥ ${t.observePct} %`);
  if (freeGB < t.criticalFreeGB)
    at("critical", `free ${freeGB.toFixed(1)} GB < ${t.criticalFreeGB} GB`);
  else if (freeGB < t.warningFreeGB)
    at("warning", `free ${freeGB.toFixed(1)} GB < ${t.warningFreeGB} GB`);
  return {
    level,
    usedPct: Number(usedPct.toFixed(1)),
    freeGB: Number(freeGB.toFixed(2)),
    reasons,
  };
}

/** Diagnostics for a non-ok volume: the largest entries of the configured folders (read-only). */
export function diagnostics(folders = [], limit = 5) {
  const out = [];
  for (const dir of folders) {
    try {
      const sizes = fs
        .readdirSync(dir, { withFileTypes: true })
        .map((e) => {
          const p = path.join(dir, e.name);
          try {
            return {
              name: e.name,
              bytes: e.isFile() ? fs.statSync(p).size : null,
            };
          } catch {
            return { name: e.name, bytes: null };
          }
        })
        .filter((x) => x.bytes !== null)
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, limit)
        .map((x) => `${x.name} ${(x.bytes / 1048576).toFixed(1)} MB`);
      out.push({ folder: dir, largestFiles: sizes });
    } catch (e) {
      out.push({ folder: dir, error: e.code });
    }
  }
  return out;
}

/**
 * One storage check over the configured volumes. Returns the results; alerts go through
 * `alert` with deduplication (raise / escalate / recover) handled by `state`.
 */
export async function checkStorage(
  cfg,
  { mock, state, alert, now = new Date() } = {},
) {
  const s = cfg.storage ?? {};
  const t = { ...DEFAULT_THRESHOLDS, ...(s.thresholds ?? {}) };
  const results = [];
  for (const v of s.volumes ?? []) {
    const r = { name: v.name, path: v.path, at: now.toISOString() };
    try {
      Object.assign(r, classify(measure(v.path, mock), t));
    } catch (e) {
      Object.assign(r, {
        level: "critical",
        reasons: [`cannot measure: ${e.code ?? e.message}`],
      });
    }
    results.push(r);
    if (state && alert) {
      const tr = state.transition(`storage:${v.name}`, r.level);
      if (tr) {
        await alert({
          level: tr === "recover" ? "ok" : r.level,
          kind: tr,
          title:
            tr === "recover"
              ? `Storage ${v.name} back to normal (${r.freeGB} GB free)`
              : `Storage ${v.name} ${r.level.toUpperCase()}: ${r.freeGB} GB free, ${r.usedPct} % used`,
          volume: v.name,
          freeGB: r.freeGB,
          usedPct: r.usedPct,
          reasons: r.reasons,
          at: r.at,
          diagnostics:
            tr === "recover" ? undefined : diagnostics(v.diagnose ?? []),
          advice:
            tr === "recover"
              ? undefined
              : "Do not delete database files or WAL. Check backup retention (dry-run), the PostgreSQL log folder and unrelated large files; add capacity if growth continues.",
        });
      }
    }
  }
  state?.save();
  return results;
}
