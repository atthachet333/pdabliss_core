// CORE backup, verification and restore (EP43). PostgreSQL native tools only.
//
// backup   — pg_dump -Fc of a profile's database, written as <db>-<profile>-<UTC stamp>.dump.partial
//            and renamed only when complete (an existing file is never overwritten). The table row
//            counts are taken inside the SAME snapshot pg_dump uses (--snapshot), so verification
//            compares like with like even while the application writes.
// verify   — a backup counts as verified only when ALL hold: tool exit 0, non-empty file, sha256
//            matches the manifest, pg_restore --list reads it, it restores into a disposable
//            scratch database, the restored schema / migrations / every table's row count match
//            the manifest, and the ten inventory-ledger checks are zero. The scratch is dropped.
// restore  — into a NEW scratch database only (name core_restore_<suffix>). Restoring over a
//            dev / UAT / production database is not something this tool does: that procedure
//            is manual and needs separate approval (docs/EP43_DISASTER_RECOVERY_RUNBOOK.md).
import fs from "node:fs";
import path from "node:path";
import {
  identify,
  ledgerCheck,
  pg,
  refuse,
  runPgTool,
  safeBackupDir,
  sha256,
  stamp,
  urlForDb,
  withClient,
} from "./lib.mjs";

export const SCRATCH = /^core_(restore|restorecheck)_[a-z0-9_]{1,40}$/;
const DUMP_NAME = /^([a-z][a-z0-9_]*)-([a-z][a-z0-9-]*)-(\d{8}T\d{6}Z)\.dump$/;
export const parseDumpName = (f) => {
  const m = path.basename(f).match(DUMP_NAME);
  return m ? { database: m[1], profile: m[2], stamp: m[3] } : null;
};

async function tableCounts(c) {
  const tables = (
    await c.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`,
    )
  ).rows.map((r) => r.tablename);
  const counts = {};
  for (const t of tables)
    counts[t] = Number(
      (await c.query(`SELECT count(*) AS n FROM "${t}"`)).rows[0].n,
    );
  return counts;
}

/** Full logical backup of a profile. Returns { file, manifest }. */
export async function backup(cfg, profile, log) {
  const dir = safeBackupDir(profile.backupDir);
  fs.mkdirSync(dir, { recursive: true });
  const id = await identify(profile.url, profile.database);
  const base = `${profile.database}-${profile.name}-${stamp()}`;
  const file = path.join(dir, `${base}.dump`);
  const partial = `${file}.partial`;
  if (fs.existsSync(file) || fs.existsSync(partial))
    refuse(`${file} already exists — never overwritten`, "EXISTS");
  const started = Date.now();
  log.info(`backup ${profile.name}: ${profile.database} → ${file}`);

  // One snapshot for the counts and the dump: open a REPEATABLE READ transaction, export it.
  const client = new pg.Client({ connectionString: profile.url.href });
  await client.connect();
  let counts;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (await client.query("SELECT pg_export_snapshot() AS s"))
      .rows[0].s;
    counts = await tableCounts(client);
    runPgTool(cfg, "pg_dump", profile.url, [
      "-Fc",
      "--no-owner",
      "--no-privileges",
      `--snapshot=${snapshot}`,
      "-f",
      partial,
      profile.database,
    ]);
    await client.query("COMMIT");
  } catch (e) {
    fs.rmSync(partial, { force: true });
    throw e;
  } finally {
    await client.end().catch(() => undefined);
  }
  const bytes = fs.statSync(partial).size;
  if (bytes === 0) {
    fs.rmSync(partial, { force: true });
    refuse("pg_dump produced an empty file", "EMPTY_BACKUP");
  }
  const list = runPgTool(cfg, "pg_restore", profile.url, ["--list", partial]);
  const tableData = (list.match(/ TABLE DATA public /g) || []).length;
  if (tableData === 0) {
    fs.rmSync(partial, { force: true });
    refuse("the archive lists no table data — not trusted", "BAD_ARCHIVE");
  }
  fs.renameSync(partial, file);
  const manifest = {
    file: path.basename(file),
    profile: profile.name,
    database: id.db,
    serverVersion: id.version,
    migration: id.migration,
    migrations: id.migrations,
    createdAt: new Date().toISOString(),
    seconds: Number(((Date.now() - started) / 1000).toFixed(2)),
    bytes,
    sha256: sha256(file),
    tableData,
    counts,
    verified: null,
  };
  fs.writeFileSync(`${file}.json`, JSON.stringify(manifest, null, 1), {
    flag: "wx",
  });
  log.info(
    `backup written: ${(bytes / 1048576).toFixed(2)} MB, ${tableData} tables, ${manifest.seconds} s`,
  );
  return { file, manifest };
}

/**
 * Restores `file` into a NEW scratch database on `serverUrl` (same credentials) and checks it.
 * Returns the verification record; the scratch database is dropped unless keep = true.
 */
export async function verify(
  cfg,
  file,
  serverUrl,
  log,
  { keep = false, suffix } = {},
) {
  const manifestFile = `${file}.json`;
  if (!fs.existsSync(file)) refuse(`no such backup: ${file}`, "NO_FILE");
  if (!fs.existsSync(manifestFile))
    refuse(`no manifest next to ${file}`, "NO_MANIFEST");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const checks = {};
  checks.nonEmpty = fs.statSync(file).size > 0;
  checks.sha256 = sha256(file) === manifest.sha256;
  if (!checks.nonEmpty || !checks.sha256)
    refuse(
      "backup file is empty or its checksum differs from the manifest",
      "CORRUPT",
    );
  checks.listing =
    (
      runPgTool(cfg, "pg_restore", serverUrl, ["--list", file]).match(
        / TABLE DATA public /g,
      ) || []
    ).length === manifest.tableData;
  const scratch = `core_restorecheck_${suffix ?? stamp().toLowerCase()}`;
  const started = Date.now();
  const restored = await restoreInto(cfg, file, serverUrl, scratch, log);
  const restoreSeconds = Number(((Date.now() - started) / 1000).toFixed(2));
  try {
    const target = urlForDb(serverUrl, scratch);
    const id = await identify(target, scratch);
    checks.migration =
      id.migration === manifest.migration &&
      id.migrations === manifest.migrations;
    const counts = await withClient(target, tableCounts);
    const tables = Object.keys(manifest.counts);
    checks.schema =
      JSON.stringify(Object.keys(counts).sort()) ===
      JSON.stringify([...tables].sort());
    const diff = tables.filter((t) => counts[t] !== manifest.counts[t]);
    checks.rowCounts = diff.length === 0;
    const ledger = await ledgerCheck(target);
    checks.ledger = ledger.bad.length === 0;
    const record = {
      at: new Date().toISOString(),
      scratch,
      restoreSeconds,
      tables: tables.length,
      rows: Object.values(counts).reduce((a, b) => a + b, 0),
      rowDiffs: diff,
      ledgerViolations: ledger.bad,
      checks,
      ok: Object.values(checks).every(Boolean),
    };
    manifest.verified = record;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
    (record.ok ? log.info : log.error)(
      `verify ${path.basename(file)}: ${record.ok ? "VERIFIED" : "FAILED"} (${restoreSeconds} s restore, ${record.tables} tables, ${record.rows} rows)`,
      { checks },
    );
    return record;
  } finally {
    if (!keep && restored) await dropScratch(serverUrl, scratch);
  }
}

/** pg_restore into a database that must not exist yet and must be a scratch name. */
export async function restoreInto(
  cfg,
  file,
  serverUrl,
  target,
  log,
  { protectedNames = [] } = {},
) {
  if (!SCRATCH.test(target))
    refuse(
      `restore target "${target}" is not a scratch name (core_restore_<suffix>); protected databases are restored only by the approved manual procedure`,
      "PROTECTED_TARGET",
    );
  if (protectedNames.includes(target))
    refuse(`"${target}" is protected`, "PROTECTED_TARGET");
  const admin = urlForDb(serverUrl, "postgres");
  await withClient(admin, async (c) => {
    const exists = (
      await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [target])
    ).rowCount;
    if (exists)
      refuse(
        `database "${target}" already exists — restore never overwrites`,
        "EXISTS",
      );
    await c.query(`CREATE DATABASE "${target}"`);
  });
  try {
    runPgTool(cfg, "pg_restore", serverUrl, [
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "-d",
      target,
      file,
    ]);
  } catch (e) {
    await dropScratch(serverUrl, target);
    throw e;
  }
  log?.info(`restored ${path.basename(file)} into ${target}`);
  return true;
}

export async function dropScratch(serverUrl, name) {
  if (!SCRATCH.test(name))
    refuse(
      `refusing to drop non-scratch database "${name}"`,
      "PROTECTED_TARGET",
    );
  await withClient(urlForDb(serverUrl, "postgres"), (c) =>
    c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`),
  );
}

/** The newest backup of a profile in its folder, with its manifest (or null). */
export function latestBackup(dir, profileName) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter(
      (f) =>
        parseDumpName(f)?.profile === profileName &&
        fs.existsSync(path.join(dir, `${f}.json`)),
    )
    .sort();
  const f = files.at(-1);
  if (!f) return null;
  return {
    file: path.join(dir, f),
    manifest: JSON.parse(fs.readFileSync(path.join(dir, `${f}.json`), "utf8")),
  };
}
