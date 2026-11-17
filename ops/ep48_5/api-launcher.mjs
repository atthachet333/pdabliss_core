// PDA BLISS CORE — EP48.5 CORE Internal Staging: fail-closed API launcher (logic; the entry point is staging-launch.mjs).
//
// It builds the CORE API itself (backend/dist/app.js → buildApp) and binds it to the constant 127.0.0.1:1312.
// It never imports backend/dist/server.js, which binds to whatever HOST says. Any failed check → exit 78, a sticky
// refusal marker, and no listener. Specification: docs/EP48_5_STAGING_ARCHITECTURE.md §4.2 (P1–P8, L1–L14).
// The application code (backend/, frontend/) is unchanged from EP48 (cb21be1).
import fs from "node:fs";
import inspector from "node:inspector";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  API_PORT, BIND_HOST, STAGING_DB, STAGING_ROOT, WEB_ORIGIN,
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
export function preflight({ env, root, releaseRoot, cwd, execArgv, inspectorUrl }) {
  assertNoStickyMarker(root, SERVICE);
  assertNoInspector({ env, execArgv, inspectorUrl });
  assertAllowList(env, API_ALLOWED);
  for (const k of REQUIRED) if (env[k] === undefined) refuse("P6_REQUIRED", `${k} is not set`);
  requireExact(env, "CORE_ENVIRONMENT", "staging", "L1_MARKER");
  requireExact(env, "NODE_ENV", "development", "L2_NODE_ENV");
  requireExact(env, "ENABLE_DEMO_ROUTES", "false", "L2_DEMO_ROUTES");
  requireExact(env, "HOST", BIND_HOST, "L3_HOST");
  requireExact(env, "PORT", String(API_PORT), "L3_PORT");
  const secret = env.AUTH_SECRET;
  if (secret.length < 43 || /\s/.test(secret)) refuse("L4_AUTH_SECRET", "AUTH_SECRET must be at least 43 characters without whitespace");
  checkDatabaseUrl(env.DATABASE_URL);
  requireExact(env, "CORS_ORIGINS", WEB_ORIGIN, "L6_CORS");
  requireExact(env, "PUBLIC_APP_URL", WEB_ORIGIN, "L6_PUBLIC_URL");
  requireExact(env, "MAIL_TRANSPORT", "dev", "L7_MAIL_TRANSPORT");
  const mailDir = path.join(root, "mail");
  if (!path.isAbsolute(env.DEV_MAIL_DIR) || !samePath(env.DEV_MAIL_DIR, mailDir))
    refuse("L7_MAIL_DIR", "DEV_MAIL_DIR must be <staging root>\\mail");
  if (!fs.existsSync(mailDir) || !fs.statSync(mailDir).isDirectory() || hasReparsePoint(mailDir, root))
    refuse("L7_MAIL_DIR", "<staging root>\\mail must be an existing folder (no junction or link)");
  if (env.LOG_LEVEL !== undefined && !["fatal", "error", "warn", "info"].includes(env.LOG_LEVEL))
    refuse("L7_LOG_LEVEL", "LOG_LEVEL must be fatal, error, warn or info");
  assertReleaseLocation(root, releaseRoot);
  const envFiles = envFilesIn([cwd, releaseRoot, path.join(releaseRoot, "backend")]);
  if (envFiles.length) refuse("L8_ENV_FILE", `${envFiles.length} .env file(s) found next to the release; the back end would read them`);
  return assertReleaseSha(releaseRoot, "L10_RELEASE_SHA");
}

/** L11: the application's own reading of the environment must agree with the launcher. */
export function checkParsedEnv(parsed, devAuthSecret) {
  const ok =
    parsed && parsed.ENABLE_DEMO_ROUTES === false && parsed.NODE_ENV === "development" && parsed.HOST === BIND_HOST &&
    parsed.PORT === API_PORT && parsed.MAIL_TRANSPORT === "dev" && parsed.TRUST_PROXY === false &&
    Array.isArray(parsed.CORS_ORIGINS) && parsed.CORS_ORIGINS.length === 1 && parsed.CORS_ORIGINS[0] === WEB_ORIGIN &&
    typeof parsed.AUTH_SECRET === "string" && parsed.AUTH_SECRET !== devAuthSecret;
  if (!ok) refuse("L11_PARSED_ENV", "the application's parsed configuration differs from the locked staging profile");
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
} = {}) {
  // Phase A — no application code loaded yet.
  const releaseSha = preflight({ env, root, releaseRoot, cwd, execArgv, inspectorUrl });
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
  checkParsedEnv(parsed, envModule.DEV_AUTH_SECRET);

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
    log(`[core-staging-api] CORE Internal Staging — all launcher checks passed; listening on ${BIND_HOST}:${addr.port} only; exposure probe clean on ${r.checked} address(es); release ${releaseSha}`);
  } catch (err) {
    await Promise.resolve(app.close?.()).catch(() => {});
    throw err;
  }
  return app;
}
