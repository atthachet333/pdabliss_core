// PDA BLISS CORE — operations library (EP43). Windows-first, Node only (uses the backend's `pg`).
//
// Safety model, shared by every ops command:
// - A command acts on a PROFILE from the config (dev, uat, production …). A profile names its
//   database explicitly; the connection string comes from an env file at run time and must name
//   the same database, and the server must report it as current_database() before anything runs.
//   Nothing falls back to a default database when a variable is missing.
// - The production profile ships disabled. It works only with `enabled: true` AND `approvedBy`.
// - Credentials are never printed or logged: every string that reaches the console or a log
//   passes through redact().
// - Backup folders must be absolute, outside the repository and outside any OneDrive (or other
//   cloud-sync) folder — a synced folder would upload company data without anyone deciding to.
// - Nothing here deletes database files, WAL, tables or audit rows. Retention deletes only backup
//   files it created, in allow-listed folders, and only with --apply.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const require = createRequire(path.join(ROOT, "backend", "package.json"));
export const pg = require("pg");

export class OpsError extends Error {
  constructor(message, code = "OPS_REFUSED") {
    super(message);
    this.code = code;
  }
}
export const refuse = (message, code) => {
  throw new OpsError(message, code);
};

// ------------------------------------------------------------------------------ redaction
const SECRET_PATTERNS = [
  [/(postgres(?:ql)?:\/\/[^:/@\s]+:)[^@\s]+@/gi, "$1***@"],
  [
    /(password|passwd|pwd|secret|token|apikey|api_key)(["'\s:=]+)[^\s"',;]+/gi,
    "$1$2***",
  ],
  [/(core_sid|__Host-core_sid)=[^;\s"]+/gi, "$1=***"],
  [/(authorization:\s*)(bearer|basic)\s+[^\s"]+/gi, "$1$2 ***"],
];
export function redact(value) {
  let s = typeof value === "string" ? value : JSON.stringify(value);
  for (const [re, rep] of SECRET_PATTERNS) s = s.replace(re, rep);
  return s;
}

// ------------------------------------------------------------------------------ config
export const DEFAULT_CONFIG_PATH = path.join(ROOT, "ops", "ops.config.json");
export function loadConfig(
  file = process.env.CORE_OPS_CONFIG || DEFAULT_CONFIG_PATH,
) {
  if (!fs.existsSync(file))
    refuse(
      `No ops config at ${file}. Copy ops/ops.config.example.json to ops/ops.config.json and edit it.`,
      "NO_CONFIG",
    );
  // Every "~/…" string (folders, files, volumes) becomes a path under the user's home.
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"), (_k, v) =>
    expandHome(v),
  );
  cfg.__file = file;
  return cfg;
}

/** A value from an env file (KEY=value lines; quotes stripped). Never logged. */
export function envValue(envFile, key) {
  const f = path.isAbsolute(envFile) ? envFile : path.join(ROOT, envFile);
  if (!fs.existsSync(f))
    refuse(`env file not found: ${envFile}`, "NO_ENV_FILE");
  const m = fs.readFileSync(f, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  const v = (m?.[1] ?? "").trim().replace(/^"|"$/g, "");
  if (!v) refuse(`${key} is not set in ${envFile}`, "NO_ENV_KEY");
  return v;
}

/** The profile, checked: explicit database, connection naming it, production gate. */
export function profileOf(cfg, name) {
  const p = cfg.profiles?.[name];
  if (!p)
    refuse(
      `unknown profile "${name}" (known: ${Object.keys(cfg.profiles ?? {}).join(", ")})`,
    );
  if (p.enabled !== true)
    refuse(
      `profile "${name}" is disabled in the ops config`,
      "PROFILE_DISABLED",
    );
  if (name === "production" || p.kind === "production") {
    if (!p.approvedBy || typeof p.approvedBy !== "string")
      refuse(
        'the production profile needs "approvedBy" (who approved activating it)',
        "NOT_APPROVED",
      );
  }
  if (!p.database || !/^[a-z][a-z0-9_]{0,62}$/.test(p.database))
    refuse(
      `profile "${name}" must name its database explicitly`,
      "NO_DATABASE",
    );
  let url = new URL(envValue(p.envFile, p.envKey ?? "DATABASE_URL"));
  // credentialsOnly: take user / password / host from the env URL, the database from the profile
  // (explicit either way; the server's current_database() is checked before any work).
  if (p.credentialsOnly === true) url = urlForDb(url, p.database);
  const named = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (named !== p.database)
    refuse(
      `profile "${name}" expects database "${p.database}" but its connection names "${named}" — refusing`,
      "DATABASE_MISMATCH",
    );
  if (
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) &&
    p.remoteAllowed !== true
  )
    refuse(
      `profile "${name}" points at a non-local host; set remoteAllowed only with a reason`,
      "REMOTE_HOST",
    );
  return { name, ...p, backupDir: expandHome(p.backupDir), url };
}

/** "~/x" → the user's home folder (configs stay free of user names). */
export const expandHome = (p) =>
  typeof p === "string" && /^~[\\/]/.test(p)
    ? path.join(os.homedir(), p.slice(2))
    : p;

/** Connection for another database on the same server (same credentials). */
export function urlForDb(url, db) {
  const u = new URL(url.href ?? url);
  u.pathname = `/${db}`;
  return u;
}

export async function withClient(url, fn, appName = "pdabliss-core-ops") {
  const u = new URL(url.href ?? url);
  u.searchParams.set("application_name", appName);
  const c = new pg.Client({
    connectionString: u.href,
    connectionTimeoutMillis: 8000,
  });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end().catch(() => undefined);
  }
}

/** The server confirms which database this really is (never trust a name alone). */
export async function identify(url, expected) {
  return withClient(url, async (c) => {
    const r = (
      await c.query(
        `SELECT current_database() AS db, inet_server_port() AS port, current_setting('server_version') AS version,
                (SELECT max(migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS migration,
                (SELECT count(*)::int FROM _prisma_migrations) AS migrations`,
      )
    ).rows[0];
    if (expected && r.db !== expected)
      refuse(
        `connected to "${r.db}", expected "${expected}" — refusing`,
        "IDENTITY_MISMATCH",
      );
    return r;
  });
}

// ------------------------------------------------------------------------------ paths
const CLOUD_SYNC = /onedrive|dropbox|google drive|googledrive|icloud|box sync/i;
/** A folder ops may write backups into: absolute, outside the repo, not cloud-synced. */
export function safeBackupDir(dir) {
  dir = expandHome(dir);
  if (!dir || !path.isAbsolute(dir))
    refuse(`backup folder must be an absolute path: ${dir}`, "BAD_PATH");
  const abs = path.resolve(dir);
  if (CLOUD_SYNC.test(abs))
    refuse(
      `backup folder ${abs} is inside a cloud-sync folder (OneDrive …) — refusing`,
      "CLOUD_SYNC_PATH",
    );
  const rel = path.relative(ROOT, abs);
  if (!rel.startsWith("..") && !path.isAbsolute(rel))
    refuse(
      `backup folder ${abs} is inside the repository — refusing`,
      "REPO_PATH",
    );
  return abs;
}
export const isInside = (child, parent) => {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

export const stamp = (d = new Date()) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
export const sha256 = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

// ------------------------------------------------------------------------------ logging
/** JSON-lines log with size rotation (keep N rotated files). Every line is redacted. */
export function logger(
  dir,
  name,
  { maxBytes = 5 * 1024 * 1024, keep = 5 } = {},
) {
  dir = expandHome(dir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.log`);
  const rotate = () => {
    try {
      if (fs.statSync(file).size < maxBytes) return;
    } catch {
      return;
    }
    for (let i = keep - 1; i >= 1; i--) {
      const from = `${file}.${i}`;
      if (fs.existsSync(from)) fs.renameSync(from, `${file}.${i + 1}`);
    }
    fs.renameSync(file, `${file}.1`);
    if (fs.existsSync(`${file}.${keep + 1}`)) fs.rmSync(`${file}.${keep + 1}`);
  };
  const write = (level, msg, data = {}) => {
    rotate();
    const line = redact({ at: new Date().toISOString(), level, msg, ...data });
    fs.appendFileSync(file, `${line}\n`);
    if (process.env.CORE_OPS_QUIET !== "1")
      console.log(`${level.toUpperCase().padEnd(8)} ${redact(msg)}`);
  };
  return {
    file,
    info: (m, d) => write("info", m, d),
    warn: (m, d) => write("warning", m, d),
    error: (m, d) => write("error", m, d),
    critical: (m, d) => write("critical", m, d),
  };
}

// ------------------------------------------------------------------------------ single instance
/** A lock file holding our pid; a lock whose process is gone is stale and taken over. */
export function acquireLock(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(file, "wx");
      fs.writeSync(
        fd,
        JSON.stringify({
          pid: process.pid,
          at: new Date().toISOString(),
          host: os.hostname(),
        }),
      );
      fs.closeSync(fd);
      const release = () => {
        try {
          const cur = JSON.parse(fs.readFileSync(file, "utf8"));
          if (cur.pid === process.pid) fs.rmSync(file);
        } catch {
          /* gone */
        }
      };
      process.once("exit", release);
      return release;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let holder = null;
      try {
        holder = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        /* unreadable: treat as stale */
      }
      if (holder && pidAlive(holder.pid))
        refuse(
          `another instance is running (pid ${holder.pid}, since ${holder.at})`,
          "ALREADY_RUNNING",
        );
      fs.rmSync(file, { force: true });
    }
  }
  refuse("could not take the lock", "LOCK_FAILED");
}
export function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

// ------------------------------------------------------------------------------ PostgreSQL tools
export function pgBin(cfg, exe) {
  const dirs = [
    cfg?.pgBin,
    process.env.PG_BIN,
    "C:/Program Files/PostgreSQL/18/bin",
  ].filter(Boolean);
  for (const d of dirs) {
    const p = path.join(d, process.platform === "win32" ? `${exe}.exe` : exe);
    if (fs.existsSync(p)) return p;
  }
  return exe;
}
/** Runs a PostgreSQL client tool with the password in PGPASSWORD (never on the command line). */
export function runPgTool(
  cfg,
  exe,
  url,
  args,
  { timeoutMs = 30 * 60 * 1000 } = {},
) {
  const u = new URL(url.href ?? url);
  const base = [
    "-h",
    u.hostname,
    "-p",
    u.port || "5432",
    "-U",
    decodeURIComponent(u.username),
  ];
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(u.password),
    PGCONNECT_TIMEOUT: "10",
  };
  const r = spawnSync(pgBin(cfg, exe), [...base, ...args], {
    env,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error)
    refuse(`${exe} could not run: ${r.error.message}`, "TOOL_FAILED");
  if (r.status !== 0)
    refuse(
      `${exe} failed (exit ${r.status}): ${redact((r.stderr || "").slice(0, 600))}`,
      "TOOL_FAILED",
    );
  return r.stdout;
}

export const INTEGRITY_SQL = fs.readFileSync(
  path.join(ROOT, "uat", "integrity.sql"),
  "utf8",
);
/** The ten inventory-ledger checks (READ ONLY); returns the non-zero ones. */
export async function ledgerCheck(url) {
  return withClient(url, async (c) => {
    await c.query("BEGIN READ ONLY");
    const r = (await c.query(INTEGRITY_SQL)).rows[0];
    await c.query("ROLLBACK");
    return {
      bad: Object.entries(r).filter(
        ([k, v]) => !["movements", "balances"].includes(k) && Number(v) !== 0,
      ),
      movements: Number(r.movements),
      balances: Number(r.balances),
    };
  });
}

// ------------------------------------------------------------------------------ alerts
/**
 * Alert dispatch. Adapters: `log` (always), `email` (only when enabled AND its SMTP settings
 * are present in the configured env file — never invented), `line` (interface only: refuses
 * until a future episode implements and authorizes it). Delivery failures are logged, never
 * thrown: a broken channel must not stop monitoring.
 */
export function alertDispatcher(cfg, log, transports = {}) {
  const a = cfg.alerts ?? {};
  const adapters = [];
  adapters.push({
    name: "log",
    send: async (e) =>
      log[
        e.level === "critical" ? "critical" : e.level === "ok" ? "info" : "warn"
      ](`ALERT ${e.title}`, e),
  });
  if (a.email?.enabled) {
    adapters.push({
      name: "email",
      send: async (e) => {
        const send = transports.email;
        if (!send)
          throw new OpsError(
            "email adapter enabled but no transport configured",
            "NOT_CONFIGURED",
          );
        await send({
          to: a.email.to,
          subject: `[CORE ${e.level.toUpperCase()}] ${e.title}`,
          text: redact(JSON.stringify(e, null, 2)),
        });
      },
    });
  }
  if (a.line?.enabled) {
    adapters.push({
      name: "line",
      send: async () => {
        throw new OpsError(
          "LINE adapter is an interface only (not implemented / not authorized in EP43)",
          "NOT_CONFIGURED",
        );
      },
    });
  }
  return async (event) => {
    const results = [];
    for (const ad of adapters) {
      try {
        await ad.send(event);
        results.push({ adapter: ad.name, ok: true });
      } catch (e) {
        results.push({
          adapter: ad.name,
          ok: false,
          error: e.code ?? e.message,
        });
        log.error(`alert adapter ${ad.name} failed`, {
          error: redact(e.message),
        });
      }
    }
    return results;
  };
}

/**
 * Deduplicated alerting: raise once when a key enters a non-ok level (or escalates), stay quiet
 * while it stays there, send one recovery when it returns to ok. State survives restarts.
 */
export function alertState(file) {
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    state = {};
  }
  const RANK = { ok: 0, observe: 1, warning: 2, critical: 3 };
  return {
    /** → 'raise' | 'escalate' | 'recover' | null */
    transition(key, level) {
      const prev = state[key]?.level ?? "ok";
      state[key] = {
        level,
        since:
          prev === level
            ? (state[key]?.since ?? new Date().toISOString())
            : new Date().toISOString(),
      };
      if (level === prev) return null;
      if (level === "ok") return RANK[prev] >= RANK.warning ? "recover" : null;
      if (RANK[level] > RANK[prev])
        return RANK[level] >= RANK.warning
          ? prev === "ok" || prev === "observe"
            ? "raise"
            : "escalate"
          : null;
      return null; // de-escalation without recovery: no new alert
    },
    save() {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(state, null, 1));
    },
    get: () => state,
  };
}
