// PDA BLISS CORE — EP48.5 CORE Internal Staging: fail-closed API launcher (logic; the entry point is staging-launch.mjs).
//
// It builds the CORE API itself (backend/dist/app.js → buildApp) and binds it to the constant 127.0.0.1:1312.
// It never imports backend/dist/server.js, which binds to whatever HOST says. Any failed check → exit 78, a sticky
// refusal marker, and no listener. Specification: docs/EP48_5_STAGING_ARCHITECTURE.md §4.2 (P1–P8, L1–L14).
// The application code (backend/, frontend/) is unchanged from EP48 (cb21be1).
//
// Two fixed profiles, one per entry point: `staging` (staging-launch.mjs, loopback-only UAT, development mode locked
// down) and `online` (online-launch.mjs, EP48.5 O1: production mode behind the dedicated Cloudflare tunnel —
// __Host- Secure cookies, TRUST_PROXY=loopback, real SMTP with STARTTLS / TLS, no demo bypass, no development
// activation). The profile is chosen by the entry point, never by the environment; CORE_ENVIRONMENT must match it.
import fs from "node:fs";
import inspector from "node:inspector";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  API_PORT, BIND_HOST, MAIL_DOMAIN, ONLINE_MARKER, PUBLIC_ORIGIN, SMTP_MODES, STAGING_DB, STAGING_ROOT, WEB_ORIGIN,
  assertAllowList, assertBoundAddress, assertNoInspector, assertNoStickyMarker, assertNotExposed, assertReleaseLocation,
  assertReleaseSha, envFilesIn, hasReparsePoint, probeExposure, redact, refuse, requireExact, samePath,
} from "./launch-common.mjs";

export const SERVICE = "api";
const DEFAULT_RELEASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** P6: the only CORE variables the staging API may see. */
export const API_ALLOWED = new Set([
  "CORE_ENVIRONMENT", "NODE_ENV", "ENABLE_DEMO_ROUTES", "HOST", "PORT", "CORS_ORIGINS", "PUBLIC_APP_URL", "AUTH_SECRET",
  "DATABASE_URL", "MAIL_TRANSPORT", "DEV_MAIL_DIR", "LOG_LEVEL", "MAIL_FROM", "RATE_LIMIT_MAX", "RATE_LIMIT_WINDOW",
]);
const REQUIRED = ["CORE_ENVIRONMENT", "NODE_ENV", "ENABLE_DEMO_ROUTES", "HOST", "PORT", "CORS_ORIGINS", "PUBLIC_APP_URL", "AUTH_SECRET", "DATABASE_URL", "MAIL_TRANSPORT", "DEV_MAIL_DIR"];

/**
 * P6 for the online profile. Not allowed (refused if present): DEV_MAIL_DIR, RATE_LIMIT_* (the application's defaults
 * apply — no weakening by configuration), PLATFORM_* / DEMO_* / BOOTSTRAP_* (seed only), TEST_DATABASE_URL, VITE_*,
 * PG*, NODE_OPTIONS, NODE_TLS_REJECT_UNAUTHORIZED.
 */
export const ONLINE_API_ALLOWED = new Set([
  "CORE_ENVIRONMENT", "NODE_ENV", "ENABLE_DEMO_ROUTES", "HOST", "PORT", "CORS_ORIGINS", "PUBLIC_APP_URL", "AUTH_SECRET",
  "DATABASE_URL", "TRUST_PROXY", "MAIL_TRANSPORT", "MAIL_FROM", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER",
  "SMTP_PASSWORD", "LOG_LEVEL",
  // EP48.5 FINAL: F1 invitation-only sign-up (must be false online) and F2's one-company manual-activation allow-list.
  "PUBLIC_SIGNUP", "MANUAL_ACTIVATION_COMPANY_IDS",
]);
const ONLINE_REQUIRED = [
  "CORE_ENVIRONMENT", "NODE_ENV", "ENABLE_DEMO_ROUTES", "HOST", "PORT", "CORS_ORIGINS", "PUBLIC_APP_URL", "AUTH_SECRET",
  "DATABASE_URL", "TRUST_PROXY", "MAIL_TRANSPORT", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD",
  "PUBLIC_SIGNUP",
];
/** EP48.5 F2: at most ONE company may be listed for manual activation at a time (empty = route absent). */
const COMPANY_ID_RE = /^[a-z0-9]{8,64}$/;

/** The two fixed launcher profiles. */
export const PROFILES = Object.freeze({
  staging: Object.freeze({
    name: "staging", marker: "staging", nodeEnv: "development", origin: WEB_ORIGIN, trustProxy: null, mail: "dev",
    invitationOnly: false, allowed: API_ALLOWED, required: REQUIRED, label: "CORE Internal Staging",
  }),
  online: Object.freeze({
    name: "online", marker: ONLINE_MARKER, nodeEnv: "production", origin: PUBLIC_ORIGIN, trustProxy: "loopback", mail: "smtp",
    invitationOnly: true, allowed: ONLINE_API_ALLOWED, required: ONLINE_REQUIRED, label: "CORE online (core.pdabliss.com, production mode)",
  }),
});

const HOSTNAME_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const addressOf = (v) => {
  const m = /<([^<>\s]+)>\s*$/.exec(String(v ?? "")) ?? /^\s*([^<>\s]+)\s*$/.exec(String(v ?? ""));
  return m ? m[1] : null;
};
/**
 * L7 (online): real SMTP, never clear text. Names the rule, never a value. The application itself adds `requireTLS`
 * when SMTP_SECURE=false (backend/src/mail/mailer.ts), so 587 + STARTTLS cannot fall back to clear text.
 */
export function checkSmtpConfig(env) {
  if (env.MAIL_TRANSPORT !== "smtp") refuse("L7_MAIL_TRANSPORT", "MAIL_TRANSPORT must be smtp in the online profile");
  const host = String(env.SMTP_HOST ?? "").toLowerCase();
  if (!HOSTNAME_RE.test(host) || /^\d+(\.\d+){3}$/.test(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local"))
    refuse("L7_SMTP_HOST", "SMTP_HOST must be the mail provider's DNS host name (no IP literal, no local name)");
  const mode = SMTP_MODES.find((m) => m.port === env.SMTP_PORT && m.secure === env.SMTP_SECURE);
  if (!mode) refuse("L7_SMTP_TLS", "SMTP_PORT / SMTP_SECURE must be 587 / false (STARTTLS) or 465 / true (implicit TLS)");
  const user = String(env.SMTP_USER ?? "");
  if (!new RegExp(`^[^@\\s]+@${MAIL_DOMAIN.replace(".", "\\.")}$`, "i").test(user))
    refuse("L7_SMTP_USER", `SMTP_USER must be a mailbox of ${MAIL_DOMAIN} (DMARC p=reject, strict alignment)`);
  if (String(env.SMTP_PASSWORD ?? "").length < 8) refuse("L7_SMTP_PASSWORD", "SMTP_PASSWORD is missing or too short");
  if (env.MAIL_FROM !== undefined) {
    const from = addressOf(env.MAIL_FROM);
    if (!from || !new RegExp(`@${MAIL_DOMAIN.replace(".", "\\.")}$`, "i").test(from))
      refuse("L7_MAIL_FROM", `MAIL_FROM must be an address of ${MAIL_DOMAIN}`);
  }
  return mode;
}

/** L5: the runtime connection, parsed and checked without ever printing it. */
export function checkDatabaseUrl(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    refuse("L5_DATABASE_URL", "DATABASE_URL is not a valid URL");
  }
  const ok =
    u.protocol === "postgresql:" && decodeURIComponent(u.username) === STAGING_DB.user && u.password !== "" &&
    u.hostname === STAGING_DB.host && u.port === String(STAGING_DB.port) && u.pathname === `/${STAGING_DB.database}` &&
    u.search === "" && u.hash === "";
  if (!ok)
    refuse("L5_DATABASE_URL", "DATABASE_URL must be postgresql://core_app:<password>@127.0.0.1:5433/pdabliss_core_staging with no parameters");
  return u;
}

/** L9: live identity of the database session. Any error or timeout is a refusal — never "continue". */
export async function checkDatabaseIdentity({ url, pg, expect = STAGING_DB, timeoutMs = 2000 }) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: timeoutMs, query_timeout: timeoutMs, statement_timeout: timeoutMs, application_name: "core-staging-launcher" });
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), timeoutMs + 500);
  });
  try {
    const row = await Promise.race([
      (async () => {
        await client.connect();
        const r = await client.query(
          "SELECT current_user AS u, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS su, current_database() AS d, inet_server_port() AS p",
        );
        return r.rows[0];
      })(),
      timeout,
    ]);
    if (!row || row.u !== expect.user || row.su !== false || row.d !== expect.database || Number(row.p) !== expect.port)
      refuse("L9_DATABASE_IDENTITY", "the database session is not core_app (non-superuser) on pdabliss_core_staging at port 5433");
  } catch (err) {
    if (err?.name === "Refusal") throw err;
    refuse("L9_DATABASE_IDENTITY", `the staging database could not be verified (${redact(err?.message ?? err)})`);
  } finally {
    clearTimeout(timer);
    client.end().catch(() => {});
  }
}

/** Phase A: checks that need no application code (P6, L1–L8, L10, L13, L14). */
export function preflight({ env, root, releaseRoot, cwd, execArgv, inspectorUrl, profile = PROFILES.staging }) {
  assertNoStickyMarker(root, SERVICE);
  assertNoInspector({ env, execArgv, inspectorUrl });
  assertAllowList(env, profile.allowed);
  for (const k of profile.required) if (env[k] === undefined) refuse("P6_REQUIRED", `${k} is not set`);
  requireExact(env, "CORE_ENVIRONMENT", profile.marker, "L1_MARKER");
  requireExact(env, "NODE_ENV", profile.nodeEnv, "L2_NODE_ENV");
  requireExact(env, "ENABLE_DEMO_ROUTES", "false", "L2_DEMO_ROUTES");
  requireExact(env, "HOST", BIND_HOST, "L3_HOST");
  requireExact(env, "PORT", String(API_PORT), "L3_PORT");
  const secret = env.AUTH_SECRET;
  if (secret.length < 43 || /\s/.test(secret)) refuse("L4_AUTH_SECRET", "AUTH_SECRET must be at least 43 characters without whitespace");
  checkDatabaseUrl(env.DATABASE_URL);
  requireExact(env, "CORS_ORIGINS", profile.origin, "L6_CORS");
  requireExact(env, "PUBLIC_APP_URL", profile.origin, "L6_PUBLIC_URL");
  if (profile.trustProxy) requireExact(env, "TRUST_PROXY", profile.trustProxy, "L6_TRUST_PROXY");
  if (profile.invitationOnly) {
    // EP48.5 F1: no public self-service sign-up on the public host (the Cloudflare WAF rule stays as a second layer).
    requireExact(env, "PUBLIC_SIGNUP", "false", "L12_PUBLIC_SIGNUP");
    const ids = String(env.MANUAL_ACTIVATION_COMPANY_IDS ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    if (ids.length > 1) refuse("L12_MANUAL_ACTIVATION", "MANUAL_ACTIVATION_COMPANY_IDS may name at most one company");
    if (ids.some((id) => !COMPANY_ID_RE.test(id))) refuse("L12_MANUAL_ACTIVATION", "MANUAL_ACTIVATION_COMPANY_IDS is not a company id");
  }
  if (profile.mail === "smtp") checkSmtpConfig(env);
  else {
    requireExact(env, "MAIL_TRANSPORT", "dev", "L7_MAIL_TRANSPORT");
    const mailDir = path.join(root, "mail");
    if (!path.isAbsolute(env.DEV_MAIL_DIR) || !samePath(env.DEV_MAIL_DIR, mailDir))
      refuse("L7_MAIL_DIR", "DEV_MAIL_DIR must be <staging root>\\mail");
    if (!fs.existsSync(mailDir) || !fs.statSync(mailDir).isDirectory() || hasReparsePoint(mailDir, root))
      refuse("L7_MAIL_DIR", "<staging root>\\mail must be an existing folder (no junction or link)");
  }
  if (env.LOG_LEVEL !== undefined && !["fatal", "error", "warn", "info"].includes(env.LOG_LEVEL))
    refuse("L7_LOG_LEVEL", "LOG_LEVEL must be fatal, error, warn or info");
  assertReleaseLocation(root, releaseRoot);
  const envFiles = envFilesIn([cwd, releaseRoot, path.join(releaseRoot, "backend")]);
  if (envFiles.length) refuse("L8_ENV_FILE", `${envFiles.length} .env file(s) found next to the release; the back end would read them`);
  return assertReleaseSha(releaseRoot, "L10_RELEASE_SHA");
}

/** L11: the application's own reading of the environment must agree with the launcher. */
export function checkParsedEnv(parsed, devAuthSecret, profile = PROFILES.staging, env = {}) {
  const common =
    parsed && parsed.ENABLE_DEMO_ROUTES === false && parsed.NODE_ENV === profile.nodeEnv && parsed.HOST === BIND_HOST &&
    parsed.PORT === API_PORT && Array.isArray(parsed.CORS_ORIGINS) && parsed.CORS_ORIGINS.length === 1 &&
    parsed.CORS_ORIGINS[0] === profile.origin && typeof parsed.AUTH_SECRET === "string" && parsed.AUTH_SECRET !== devAuthSecret;
  const specific =
    profile.mail === "smtp"
      ? parsed?.MAIL_TRANSPORT === "smtp" && Array.isArray(parsed?.TRUST_PROXY) && parsed.TRUST_PROXY.length === 1 &&
        parsed.TRUST_PROXY[0] === profile.trustProxy && parsed.PUBLIC_APP_URL === profile.origin &&
        parsed.SMTP_HOST === env.SMTP_HOST && parsed.SMTP_PORT === Number(env.SMTP_PORT) && parsed.SMTP_SECURE === (env.SMTP_SECURE === "true")
      : parsed?.MAIL_TRANSPORT === "dev" && parsed?.TRUST_PROXY === false;
  const signup =
    !profile.invitationOnly ||
    (parsed?.PUBLIC_SIGNUP === false && Array.isArray(parsed?.MANUAL_ACTIVATION_COMPANY_IDS) &&
      parsed.MANUAL_ACTIVATION_COMPANY_IDS.length <= 1);
  if (!(common && specific && signup)) refuse("L11_PARSED_ENV", `the application's parsed configuration differs from the locked ${profile.name} profile`);
}

const releasePaths = (releaseRoot) => ({
  envModule: path.join(releaseRoot, "backend", "dist", "config", "env.js"),
  appModule: path.join(releaseRoot, "backend", "dist", "app.js"),
  backendPackage: path.join(releaseRoot, "backend", "package.json"),
});

/**
 * Runs every check, builds the app and binds it. Returns the listening app. Throws a Refusal on any failure
 * (after closing a server it already opened). Test-only parameters: root, releaseRoot, port, cwd, loaders, pg,
 * probe, execArgv, inspectorUrl, chdir. The bind host is never a parameter.
 */
export async function runApiLauncher({
  env = process.env,
  root = STAGING_ROOT,
  releaseRoot = DEFAULT_RELEASE_ROOT,
  port = API_PORT,
  cwd = process.cwd(),
  loadEnvModule = (file) => import(pathToFileURL(file).href),
  loadAppModule = (file) => import(pathToFileURL(file).href),
  pg = null,
  probe = probeExposure,
  execArgv = process.execArgv,
  inspectorUrl = () => inspector.url(),
  chdir = (dir) => process.chdir(dir),
  log = (line) => process.stdout.write(`${line}\n`),
  profile = PROFILES.staging,
} = {}) {
  // Phase A — no application code loaded yet.
  const releaseSha = preflight({ env, root, releaseRoot, cwd, execArgv, inspectorUrl, profile });
  const files = releasePaths(releaseRoot);

  // Phase B — the configuration module only (schema + constants; no I/O or listener at import).
  let envModule;
  try {
    envModule = await loadEnvModule(files.envModule);
  } catch (err) {
    refuse("P1_LOAD_CONFIG", `backend/dist/config/env.js could not be loaded (${redact(err?.message)})`);
  }
  if (typeof envModule?.parseEnv !== "function" || typeof envModule?.DEV_AUTH_SECRET !== "string")
    refuse("P1_LOAD_CONFIG", "backend/dist/config/env.js does not export parseEnv and DEV_AUTH_SECRET");
  if (env.AUTH_SECRET === envModule.DEV_AUTH_SECRET) refuse("L4_AUTH_SECRET", "AUTH_SECRET is the public development value");
  let parsed;
  try {
    parsed = envModule.parseEnv({ ...env });
  } catch (err) {
    refuse("L11_PARSED_ENV", `the application rejected the configuration (${redact(err?.message)})`);
  }
  checkParsedEnv(parsed, envModule.DEV_AUTH_SECRET, profile, env);

  // Phase C — live database identity.
  const pgModule = pg ?? createRequire(files.backendPackage)("pg");
  await checkDatabaseIdentity({ url: env.DATABASE_URL, pg: pgModule });

  // Phase D — the application module, built with the verified configuration.
  chdir(path.join(releaseRoot, "backend"));
  let appModule;
  try {
    appModule = await loadAppModule(files.appModule);
  } catch (err) {
    refuse("P1_LOAD_APP", `backend/dist/app.js could not be loaded (${redact(err?.message)})`);
  }
  if (typeof appModule?.buildApp !== "function") refuse("P1_LOAD_APP", "backend/dist/app.js does not export buildApp");
  const app = await appModule.buildApp(parsed);

  // Phase E — bind to the constant address, then prove it (P4) and probe the outside (P5).
  try {
    await app.listen({ host: BIND_HOST, port });
    const addr = app.server?.address?.();
    assertBoundAddress(addr, port, "L12_BOUND_ADDRESS");
    if (typeof app.addresses === "function") {
      const all = app.addresses();
      if (!Array.isArray(all) || all.length !== 1) refuse("L12_BOUND_ADDRESS", "the service listens on more than one address");
      assertBoundAddress(all[0], port, "L12_BOUND_ADDRESS");
    }
    const r = await assertNotExposed(addr.port, probe, "L12_EXPOSED");
    log(`[core-staging-api] ${profile.label} — all launcher checks passed; listening on ${BIND_HOST}:${addr.port} only; exposure probe clean on ${r.checked} address(es); release ${releaseSha}`);
  } catch (err) {
    await Promise.resolve(app.close?.()).catch(() => {});
    throw err;
  }
  return app;
}
