// PDA BLISS CORE — EP48.5 CORE Internal Staging: shared fail-closed launcher helpers.
//
// Used by staging-launch.mjs (API) and staging-web-launch.mjs (web). Design: docs/EP48_5_STAGING_ARCHITECTURE.md §4.2.
// Everything here either returns normally or throws a Refusal; a Refusal always ends the process with exit code 78.
// Messages name the rule, never a value (P8): no secret, URL or environment value is ever printed.
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

/** Exit code of every refusal (EX_CONFIG). */
export const REFUSAL_EXIT_CODE = 78;

/** P3: the only bind address. A constant in code — never read from the environment. */
export const BIND_HOST = "127.0.0.1";
export const API_PORT = 1312;
export const WEB_PORT = 1311;
export const STAGING_DB = Object.freeze({ host: "127.0.0.1", port: 5433, database: "pdabliss_core_staging", user: "core_app" });
export const WEB_ORIGIN = `http://${BIND_HOST}:${WEB_PORT}`;
export const API_ORIGIN = `http://${BIND_HOST}:${API_PORT}`;
/** The staging root on S2A-SERVER. Tests may pass another root to the run functions; the CLIs never do. */
export const STAGING_ROOT = "D:\\pdabliss-core-staging";

// ---------------------------------------------------------------- EP48.5 online profile (O1, docs/EP48_5_ONLINE_DEPLOYMENT_PLAN.md)
// The same constant 127.0.0.1 binds, the same database; reached only through the dedicated Cloudflare tunnel
// `pdabliss-core`. The browser origin is the permanent public hostname (same origin for the web and /api).
export const ONLINE_MARKER = "online-uat";
export const PUBLIC_HOST = "core.pdabliss.com";
export const PUBLIC_ORIGIN = `https://${PUBLIC_HOST}`;
/** Metrics listener of the CORE tunnel connector (20241 / 20242 belong to the production connectors). */
export const CORE_TUNNEL_METRICS = Object.freeze({ host: BIND_HOST, port: 20243 });
/** The only SMTP transports the online profile accepts: authenticated submission with STARTTLS, or implicit TLS. */
export const SMTP_MODES = Object.freeze([
  Object.freeze({ port: "587", secure: "false", what: "STARTTLS (required by the application: requireTLS)" }),
  Object.freeze({ port: "465", secure: "true", what: "implicit TLS" }),
]);
/** The sender domain: pdabliss.com publishes DMARC p=reject with strict alignment (O0 report §4). */
export const MAIL_DOMAIN = "pdabliss.com";

export class Refusal extends Error {
  constructor(rule, message) {
    super(message);
    this.name = "Refusal";
    this.rule = rule;
  }
}

export function refuse(rule, message) {
  throw new Refusal(rule, message);
}

/** Removes credentials from anything that looks like a connection URL, so an error text can be shown safely. */
export function redact(text) {
  return String(text ?? "")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^:/@\s]+):([^@\s]+)@/gi, "$1$2:<redacted>@")
    .replace(/(password|secret|token)=\S+/gi, "$1=<redacted>");
}

const isWindows = process.platform === "win32";

/** Path equality / containment that is case-insensitive on Windows. */
export function samePath(a, b) {
  const x = path.resolve(a);
  const y = path.resolve(b);
  return isWindows ? x.toLowerCase() === y.toLowerCase() : x === y;
}
export function isInside(child, parent) {
  const c = path.resolve(child);
  const p = path.resolve(parent);
  const rel = path.relative(p, c);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** True when the path, or any existing ancestor below `stopAt`, is a symbolic link or junction. */
export function hasReparsePoint(target, stopAt) {
  let cur = path.resolve(target);
  const stop = path.resolve(stopAt);
  for (;;) {
    let st;
    try {
      st = fs.lstatSync(cur);
    } catch {
      return false;
    }
    if (st.isSymbolicLink()) return true;
    if (samePath(cur, stop)) return false;
    const up = path.dirname(cur);
    if (up === cur) return false;
    cur = up;
  }
}

// ---------------------------------------------------------------- P7 sticky refusal marker
export function markerPath(root, service) {
  return path.join(root, "run", `launcher-refused-${service}.json`);
}
export function assertNoStickyMarker(root, service) {
  if (fs.existsSync(markerPath(root, service)))
    refuse(
      "P7_STICKY",
      `an earlier refusal is still recorded (run\\launcher-refused-${service}.json); an administrator removes it after fixing the cause`,
    );
}
/** Best effort: a refusal still exits 78 if the marker cannot be written. Never records a value. */
export function writeStickyMarker(root, service, rule) {
  try {
    fs.mkdirSync(path.join(root, "run"), { recursive: true });
    fs.writeFileSync(markerPath(root, service), JSON.stringify({ service, rule, at: new Date().toISOString() }, null, 2));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- L13 / W5: no debugger, no injected options
export function assertNoInspector({ env, execArgv, inspectorUrl }) {
  if (env.NODE_OPTIONS !== undefined) refuse("L13_NODE_OPTIONS", "NODE_OPTIONS is set (it can open a debugger listener or preload code)");
  if (execArgv.some((a) => /^--(inspect|inspect-brk|inspect-port|inspect-wait|debug)\b/.test(a)))
    refuse("L13_INSPECT_FLAG", "node was started with an inspector / debug flag");
  if (inspectorUrl()) refuse("L13_INSPECTOR_ACTIVE", "a debugger (inspector) is listening");
}

// ---------------------------------------------------------------- P6 allow-list
/** Every variable name the CORE backend, its seed, its tests or the frontend build reads. */
const CORE_KEY_PATTERNS = [
  /^NODE_ENV$/, /^HOST$/, /^PORT$/, /^LOG_LEVEL$/, /^CORS_ORIGINS$/, /^TRUST_PROXY$/, /^RATE_LIMIT_(MAX|WINDOW)$/,
  /^ENABLE_DEMO_ROUTES$/, /^DATABASE_URL$/, /^PUBLIC_APP_URL$/, /^AUTH_SECRET$/, /^MAIL_(FROM|TRANSPORT)$/,
  /^SMTP_/, /^DEV_MAIL_DIR$/, /^PLATFORM_/, /^DEMO_/, /^BOOTSTRAP_/, /^TEST_DATABASE_URL$/, /^VITE_/, /^CORE_/,
  // libpq / node-postgres defaults could redirect or weaken a database connection
  /^PG(HOST|HOSTADDR|PORT|USER|PASSWORD|PASSFILE|DATABASE|OPTIONS|SERVICE|SERVICEFILE|SSLMODE|SSLROOTCERT|SSLCERT|SSLKEY|CONNECT_TIMEOUT|APPNAME|TARGETSESSIONATTRS)$/,
  /^NODE_OPTIONS$/, /^NODE_TLS_REJECT_UNAUTHORIZED$/,
];
export function isCoreKey(name) {
  return CORE_KEY_PATTERNS.some((re) => re.test(name));
}
/** Every CORE-relevant variable present must be in `allowed`; names only are reported. */
export function assertAllowList(env, allowed, rule = "P6_ALLOW_LIST") {
  const extra = Object.keys(env).filter((k) => isCoreKey(k) && !allowed.has(k)).sort();
  if (extra.length) refuse(rule, `variables not allowed in CORE Internal Staging are set: ${extra.join(", ")}`);
}
export function requireExact(env, name, expected, rule) {
  if (env[name] !== expected) refuse(rule, `${name} must be set exactly to the staging value`);
}

// ---------------------------------------------------------------- L14 release location, L10 / W1 release identity, L8 / W6 env files
export function assertReleaseLocation(root, releaseRoot) {
  let real;
  let releases;
  try {
    real = fs.realpathSync.native(releaseRoot);
    releases = fs.realpathSync.native(path.join(root, "releases"));
  } catch {
    refuse("L14_RELEASE_LOCATION", "the launcher must run from a release under <staging root>\\releases");
  }
  if (!isInside(real, releases) || !samePath(path.dirname(real), releases))
    refuse("L14_RELEASE_LOCATION", "the launcher must run from <staging root>\\releases\\<sha> (never from a development checkout)");
}

/** Reads HEAD of the release clone without running git (detached HEAD = a SHA; a ref is resolved too). */
export function readGitHead(releaseRoot) {
  const gitDir = path.join(releaseRoot, ".git");
  const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
  if (/^[0-9a-f]{40}$/.test(head)) return head;
  const m = /^ref:\s*(\S+)$/.exec(head);
  if (!m) return null;
  const refFile = path.join(gitDir, ...m[1].split("/"));
  if (fs.existsSync(refFile)) return fs.readFileSync(refFile, "utf8").trim();
  const packed = path.join(gitDir, "packed-refs");
  if (fs.existsSync(packed)) {
    for (const line of fs.readFileSync(packed, "utf8").split(/\r?\n/)) {
      const [sha, ref] = line.trim().split(/\s+/);
      if (ref === m[1] && /^[0-9a-f]{40}$/.test(sha)) return sha;
    }
  }
  return null;
}
export function assertReleaseSha(releaseRoot, rule) {
  let recorded;
  let head;
  try {
    recorded = fs.readFileSync(path.join(releaseRoot, "RELEASE_SHA"), "utf8").trim();
    head = readGitHead(releaseRoot);
  } catch {
    refuse(rule, "RELEASE_SHA or the release's git HEAD cannot be read");
  }
  if (!/^[0-9a-f]{40}$/.test(recorded ?? "")) refuse(rule, "RELEASE_SHA is not a full commit id");
  if (head !== recorded) refuse(rule, "RELEASE_SHA does not match the release's git HEAD");
  return recorded;
}

/** `.env` and `.env.*` (except the committed `.env.example`) in the given folders. */
export function envFilesIn(dirs) {
  const found = [];
  for (const dir of dirs) {
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const n of names) if (/^\.env(\..+)?$/i.test(n) && n.toLowerCase() !== ".env.example") found.push(path.join(dir, n));
  }
  return found;
}

// ---------------------------------------------------------------- P4 / P5 after bind
/** P4: the listening socket must be exactly 127.0.0.1:<port> over IPv4. */
export function assertBoundAddress(address, port, rule) {
  const ok =
    address && typeof address === "object" && address.address === BIND_HOST && (address.family === "IPv4" || address.family === 4) &&
    (port === 0 ? Number.isInteger(address.port) && address.port > 0 : address.port === port);
  if (!ok) refuse(rule, "the service is not bound to 127.0.0.1 on its staging port only");
}

/** The host's non-loopback addresses (IPv4, and IPv6 that is not link-local). */
export function externalAddresses(interfaces = os.networkInterfaces()) {
  const out = [];
  for (const list of Object.values(interfaces)) {
    for (const a of list ?? []) {
      if (a.internal) continue;
      if (a.family === "IPv4" || a.family === 4) out.push(a.address);
      else if (!/^fe80:/i.test(a.address)) out.push(a.address);
    }
  }
  return [...new Set(out)];
}

/**
 * P5: a TCP connect to every external address on `port` must fail. Returns { checked, exposed: [addresses] }.
 * `connect` is injectable (A-0.1) so the tests prove the classification without any wildcard listener.
 */
export async function probeExposure(port, { addresses = externalAddresses(), timeoutMs = 1000, connect = (o) => net.connect(o) } = {}) {
  const attempt = (host) =>
    new Promise((resolve) => {
      const s = connect({ host, port });
      const done = (connected) => {
        s.destroy();
        resolve(connected);
      };
      s.setTimeout(timeoutMs, () => done(false));
      s.once("connect", () => done(true));
      s.once("error", () => done(false));
    });
  const results = await Promise.all(addresses.map(async (a) => [a, await attempt(a)]));
  return { checked: addresses.length, exposed: results.filter(([, c]) => c).map(([a]) => a) };
}
export async function assertNotExposed(port, probe, rule) {
  const r = await probe(port);
  if (r.exposed.length) refuse(rule, `the service answers on ${r.exposed.length} non-loopback address(es)`);
  return r;
}

// ---------------------------------------------------------------- CLI glue
/** Installs P2 handlers and runs `main`; any failure ends the process with exit 78 and the sticky marker. */
export function runCli({ service, root, main, write = (l) => process.stderr.write(`${l}\n`) }) {
  let finished = false;
  const fail = (err) => {
    if (finished) return;
    finished = true;
    const rule = err instanceof Refusal ? err.rule : "P2_UNEXPECTED";
    const msg = err instanceof Refusal ? err.message : redact(err?.message ?? String(err));
    write(`[core-staging-${service}] REFUSED ${rule}: ${msg}`);
    const marked = rule === "P7_STICKY" ? true : writeStickyMarker(root, service, rule);
    if (!marked) write(`[core-staging-${service}] (the refusal marker could not be written)`);
    process.exit(REFUSAL_EXIT_CODE);
  };
  process.on("uncaughtException", fail);
  process.on("unhandledRejection", fail);
  const watchdog = setTimeout(() => fail(new Refusal("P2_TIMEOUT", "start-up checks did not finish within 60 s")), 60_000);
  watchdog.unref();
  Promise.resolve()
    .then(main)
    .then(
      () => {
        // Start-up succeeded: from here on a crash is an ordinary failure (exit 1, WinSW may restart), not a refusal.
        clearTimeout(watchdog);
        finished = true;
        process.off("uncaughtException", fail);
        process.off("unhandledRejection", fail);
      },
      (err) => fail(err),
    );
}
