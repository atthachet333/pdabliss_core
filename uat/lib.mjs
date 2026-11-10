// PDA BLISS CORE — UAT sandbox helpers (EP42.2). Local Windows development machines only.
//
// Safety model:
// - The UAT database name is fixed (`pdabliss_core_uat`); disposable copies may only be
//   `pdabliss_core_uat_<suffix>`. Anything else — in particular the development database named
//   in backend/.env — is refused before a connection is opened.
// - Only local PostgreSQL hosts are accepted; NODE_ENV=production is refused.
// - Credentials are read at run time from backend/.env (never committed, never printed).
// - Runtime data (baseline, backups, logs, process ids, mail sink) lives outside the repository,
//   in %USERPROFILE%\pdabliss_uat (override with UAT_HOME).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BACKEND = path.join(ROOT, 'backend');
export const FRONTEND = path.join(ROOT, 'frontend');

export const UAT = Object.freeze({
  db: 'pdabliss_core_uat',
  host: '127.0.0.1',
  frontendPort: 1211,
  backendPort: 1212,
  appName: 'pdabliss-uat-backend',
});
export const FRONTEND_URL = `http://${UAT.host}:${UAT.frontendPort}`;
export const BACKEND_URL = `http://${UAT.host}:${UAT.backendPort}`;
export const UAT_HOME = process.env.UAT_HOME || path.join(os.homedir(), 'pdabliss_uat');
export const DIRS = Object.freeze({
  baseline: path.join(UAT_HOME, 'baseline'),
  backups: path.join(UAT_HOME, 'backups'),
  logs: path.join(UAT_HOME, 'logs'),
  run: path.join(UAT_HOME, 'run'),
  mail: path.join(UAT_HOME, 'mail'),
});
export const BASELINE_DUMP = path.join(DIRS.baseline, `${UAT.db}-baseline.dump`);
export const BASELINE_MANIFEST = path.join(DIRS.baseline, `${UAT.db}-baseline.json`);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const NAME = /^pdabliss_core_uat(_[a-z0-9]{1,24})?$/;

const require = createRequire(path.join(BACKEND, 'package.json'));
export const pg = require('pg');

export class Refusal extends Error {}
export const refuse = (msg) => {
  throw new Refusal(msg);
};

export function ensureDirs() {
  for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });
}

/** The development connection from backend/.env (credentials only; never printed). */
export function devConnection() {
  const file = path.join(BACKEND, '.env');
  if (!fs.existsSync(file))
    refuse('backend/.env is missing — the UAT sandbox reuses its local database credentials.');
  const m = fs.readFileSync(file, 'utf8').match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!m) refuse('DATABASE_URL is not set in backend/.env.');
  const url = new URL(m[1]);
  return { url, devDb: decodeURIComponent(url.pathname.replace(/^\//, '')) };
}

/** Throws unless `db` is a UAT database on a local server outside production. */
export function assertSafeTarget(db) {
  if (process.env.NODE_ENV === 'production')
    refuse('NODE_ENV=production — the UAT tooling never runs in production.');
  if (!NAME.test(db ?? ''))
    refuse(`"${db}" is not a UAT database name (allowed: ${UAT.db} or ${UAT.db}_<suffix>).`);
  if (/(^|_)(dev|prod|production|main|live)(_|$)/.test(db.replace(UAT.db, '')))
    refuse(`"${db}" looks like a development or production name.`);
  const { url, devDb } = devConnection();
  if (db === devDb) refuse(`"${db}" is the development database named in backend/.env.`);
  if (!LOCAL_HOSTS.has(url.hostname))
    refuse(
      `PostgreSQL host "${url.hostname}" is not local; the UAT sandbox runs on this machine only.`,
    );
  return true;
}

/** Connection URL for `db` (guards first). `appName` tags the connection in pg_stat_activity. */
export function urlFor(db, appName) {
  assertSafeTarget(db);
  const { url } = devConnection();
  const u = new URL(url.href);
  u.pathname = `/${db}`;
  if (appName) u.searchParams.set('application_name', appName);
  return u.href;
}

/** Maintenance connection (database `postgres`) on the same local server. */
export function adminUrl() {
  const { url } = devConnection();
  if (!LOCAL_HOSTS.has(url.hostname)) refuse('PostgreSQL host is not local.');
  const u = new URL(url.href);
  u.pathname = '/postgres';
  return u.href;
}

export async function withClient(href, fn) {
  const c = new pg.Client({ connectionString: href });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export async function serverIdentity() {
  return withClient(adminUrl(), async (c) => {
    const r = (
      await c.query(
        `SELECT current_user AS "user", inet_server_port() AS port, current_setting('server_version') AS version`,
      )
    ).rows[0];
    const { url } = devConnection();
    return { host: url.hostname, port: r.port, user: r.user, version: r.version };
  });
}

export async function dbExists(db) {
  assertSafeTarget(db);
  return withClient(
    adminUrl(),
    async (c) =>
      (await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [db])).rowCount === 1,
  );
}

/** Other sessions connected to `db` (application name, client address). */
export async function connectionsTo(db) {
  assertSafeTarget(db);
  return withClient(
    adminUrl(),
    async (c) =>
      (
        await c.query(
          `SELECT pid, application_name AS app, client_addr::text AS addr FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [db],
        )
      ).rows,
  );
}

export async function rowCounts(db) {
  return withClient(urlFor(db), async (c) => {
    const tables = (
      await c.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`)
    ).rows.map((r) => r.tablename);
    const out = {};
    for (const t of tables)
      out[t] = Number((await c.query(`SELECT count(*) AS n FROM "${t}"`)).rows[0].n);
    return out;
  });
}

export const INTEGRITY_SQL = fs.readFileSync(new URL('./integrity.sql', import.meta.url), 'utf8');
/** The ten inventory-ledger checks; returns the non-zero ones (empty = reconciled). */
export async function ledgerViolations(db) {
  return withClient(urlFor(db), async (c) => {
    await c.query('BEGIN READ ONLY');
    const r = (await c.query(INTEGRITY_SQL)).rows[0];
    await c.query('ROLLBACK');
    const bad = Object.entries(r).filter(
      ([k, v]) => !['movements', 'balances'].includes(k) && Number(v) !== 0,
    );
    return { bad, movements: Number(r.movements), balances: Number(r.balances) };
  });
}

// ---------------------------------------------------------------- PostgreSQL client tools
function pgBin(exe) {
  const candidates = [
    process.env.PG_BIN,
    'C:/Program Files/PostgreSQL/18/bin',
    'C:/Program Files/PostgreSQL/17/bin',
  ].filter(Boolean);
  for (const d of candidates) {
    const p = path.join(d, `${exe}.exe`);
    if (fs.existsSync(p)) return p;
  }
  return exe; // on PATH
}
function pgArgs() {
  const { url } = devConnection();
  return {
    base: ['-h', url.hostname, '-p', url.port || '5432', '-U', decodeURIComponent(url.username)],
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
  };
}
function runTool(exe, args) {
  const { env } = pgArgs();
  const r = spawnSync(pgBin(exe), args, { env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error)
    refuse(`${exe} could not run: ${r.error.message} (set PG_BIN to the PostgreSQL bin folder)`);
  if (r.status !== 0)
    refuse(
      `${exe} failed: ${(r.stderr || '').replace(/password[^\n]*/gi, '<redacted>').slice(0, 400)}`,
    );
  return r.stdout;
}
export const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** pg_dump -Fc of `db` into `file`, verified with pg_restore --list. */
export function dump(db, file) {
  assertSafeTarget(db);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  runTool('pg_dump', [...pgArgs().base, '-Fc', '--no-owner', '-f', file, db]);
  const list = runTool('pg_restore', ['--list', file]);
  const tableData = (list.match(/ TABLE DATA public /g) || []).length;
  if (tableData === 0) refuse(`backup ${file} has no table data — not trusted.`);
  return { file, bytes: fs.statSync(file).size, tableData, sha256: sha256(file) };
}

/** Drops and recreates `db` (guards + no other sessions), then restores `file` into it. */
export async function recreateFrom(db, file) {
  assertSafeTarget(db);
  const others = await connectionsTo(db);
  if (others.length)
    refuse(
      `${others.length} session(s) are connected to ${db} (${[...new Set(others.map((o) => o.app || o.addr))].join(', ')}). Stop the UAT stack first: node uat/uat.mjs stop`,
    );
  await withClient(adminUrl(), async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${db}"`);
    await c.query(`CREATE DATABASE "${db}"`);
  });
  runTool('pg_restore', [...pgArgs().base, '--no-owner', '--exit-on-error', '-d', db, file]);
}

export async function createEmpty(db) {
  assertSafeTarget(db);
  if (await dbExists(db)) refuse(`${db} already exists.`);
  await withClient(adminUrl(), (c) => c.query(`CREATE DATABASE "${db}"`));
}

/** Runs a backend command (prisma / seed) against `db` with explicit development settings. */
export function backendCommand(db, args, label) {
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: urlFor(db),
    MAIL_TRANSPORT: 'dev',
    DEV_MAIL_DIR: DIRS.mail,
  };
  const r = spawnSync(process.execPath, args, {
    cwd: BACKEND,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/postgres(ql)?:\/\/[^\s"']+/g, '<url>');
  if (r.status !== 0) refuse(`${label} failed:\n${out.slice(-1500)}`);
  return out;
}
export const prismaCli = (db, ...args) =>
  backendCommand(
    db,
    [path.join(BACKEND, 'node_modules/prisma/build/index.js'), ...args],
    `prisma ${args.join(' ')}`,
  );
export const seedDemo = (db) =>
  backendCommand(
    db,
    [path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs'), 'src/cli/seed.ts', '--demo'],
    'demo seed',
  );

// ---------------------------------------------------------------- ports and processes
export const portFree = (port, host = UAT.host) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', (e) => resolve(e.code === 'EADDRINUSE' || e.code === 'EACCES' ? false : true));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, host);
  });

/** Best-effort: the processes listening on `port` (Windows: netstat + CIM; elsewhere empty). */
export function listeners(port) {
  if (process.platform !== 'win32') return [];
  const ns = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' });
  const pids = new Set();
  for (const line of (ns.stdout || '').split(/\r?\n/)) {
    const m = line.trim().split(/\s+/);
    if (m.length >= 5 && /LISTEN/i.test(m[3]) && m[1].endsWith(`:${port}`)) pids.add(Number(m[4]));
  }
  return [...pids].map((pid) => ({ pid, command: commandLine(pid) }));
}

export function commandLine(pid) {
  if (process.platform !== 'win32') return null;
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`,
    ],
    { encoding: 'utf8' },
  );
  return (r.stdout || '').trim() || null;
}

export function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export const RUNNER_MARK = '--pdabliss-uat-runner';
export const pidFile = (role) => path.join(DIRS.run, `${role}.json`);
export function readPid(role) {
  try {
    return JSON.parse(fs.readFileSync(pidFile(role), 'utf8'));
  } catch {
    return null;
  }
}

/** UAT runners found by their unique command-line marker (works without pid files). */
export function findRunners() {
  if (process.platform !== 'win32') return [];
  const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*${RUNNER_MARK}*' -and $_.CommandLine -like '*runner.mjs*' } | ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }`;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8',
  });
  return (r.stdout || '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const [pid, ...rest] = l.split('|');
      const command = rest.join('|');
      return {
        pid: Number(pid),
        role: /runner\.mjs"?\s+backend/.test(command)
          ? 'backend'
          : /runner\.mjs"?\s+frontend/.test(command)
            ? 'frontend'
            : null,
        command,
      };
    })
    .filter((x) => x.pid && x.role && x.pid !== process.pid);
}

/** True only when `pid` is alive and its command line is our UAT runner for `role`. */
export function isOurRunner(pid, role) {
  if (!pid || !pidAlive(pid)) return false;
  const cmd = commandLine(pid);
  if (cmd === null) return process.platform !== 'win32';
  return cmd.includes(RUNNER_MARK) && cmd.includes('runner.mjs') && cmd.includes(role);
}

export async function getJson(url, timeoutMs = 4000) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    let body = null;
    try {
      body = await r.json();
    } catch {
      /* not JSON */
    }
    return { status: r.status, body };
  } catch (e) {
    return { status: 0, error: e.cause?.code || e.name };
  }
}

export function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function gitHead() {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return (r.stdout || '').trim() || null;
}
