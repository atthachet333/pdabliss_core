// EP48.5 A-0 — security tests for the fail-closed staging launchers (architecture §4.2, T1–T9 + web W0–W6).
// Node built-ins only: no database, no Vite, no backend build needed. T10 (live database) is staging-launch.g0.test.mjs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { API_ALLOWED, checkDatabaseIdentity, runApiLauncher } from "../ep48_5/api-launcher.mjs";
import {
  API_ORIGIN, BIND_HOST, REFUSAL_EXIT_CODE, Refusal, externalAddresses, isCoreKey, markerPath, probeExposure, redact,
} from "../ep48_5/launch-common.mjs";
import { resolveEsmEntry, runWebLauncher } from "../ep48_5/web-launcher.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EP = path.resolve(HERE, "..", "ep48_5");
const SHA = "a".repeat(40);
const DEV_SECRET = "core-development-only-auth-secret-do-not-use-in-production";
const GOOD_SECRET = "Q".repeat(20) + "w".repeat(20) + "Z9_-x";

/** A temporary staging root with one release, a stub backend build and a stub frontend build. */
function fixture({ sha = SHA, recordedSha = sha } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "core-staging-"));
  const rel = path.join(root, "releases", sha);
  fs.mkdirSync(path.join(rel, ".git"), { recursive: true });
  fs.writeFileSync(path.join(rel, ".git", "HEAD"), `${sha}\n`);
  if (recordedSha !== null) fs.writeFileSync(path.join(rel, "RELEASE_SHA"), `${recordedSha}\n`);
  fs.mkdirSync(path.join(root, "mail"));
  fs.mkdirSync(path.join(root, "run"));
  const dist = path.join(rel, "backend", "dist");
  fs.mkdirSync(path.join(dist, "config"), { recursive: true });
  fs.writeFileSync(path.join(rel, "backend", "package.json"), '{"type":"module"}');
  fs.writeFileSync(path.join(rel, "backend", ".env.example"), "NODE_ENV=development\n");
  fs.writeFileSync(
    path.join(dist, "config", "env.js"),
    `export const DEV_AUTH_SECRET = ${JSON.stringify(DEV_SECRET)};
export function parseEnv(s) {
  return { NODE_ENV: s.NODE_ENV, HOST: s.HOST, PORT: Number(s.PORT), MAIL_TRANSPORT: s.MAIL_TRANSPORT,
    ENABLE_DEMO_ROUTES: s.ENABLE_DEMO_ROUTES === "true" ? true : s.ENABLE_DEMO_ROUTES === "false" ? false : s.NODE_ENV !== "production",
    TRUST_PROXY: s.TRUST_PROXY ? s.TRUST_PROXY.split(",") : false, CORS_ORIGINS: String(s.CORS_ORIGINS).split(","),
    AUTH_SECRET: s.AUTH_SECRET ?? DEV_AUTH_SECRET };
}
`,
  );
  // The sentinel proves whether the application module was ever imported.
  fs.writeFileSync(
    path.join(dist, "app.js"),
    `import fs from "node:fs";
import http from "node:http";
fs.writeFileSync(new URL("./SENTINEL_IMPORTED", import.meta.url), "imported");
export async function buildApp() {
  const server = http.createServer((q, r) => r.end("ok"));
  const app = { server, hostUsed: null, closed: false,
    listen: ({ host, port }) => new Promise((res, rej) => { app.hostUsed = host; server.once("error", rej); server.listen(port, host, res); }),
    addresses: () => [server.address()],
    close: () => new Promise((r) => { app.closed = true; server.close(() => r()); }),
    log: { info() {} } };
  return app;
}
`,
  );
  const fdist = path.join(rel, "frontend", "dist");
  fs.mkdirSync(path.join(fdist, "assets"), { recursive: true });
  fs.writeFileSync(path.join(rel, "frontend", ".env.example"), "VITE_API_URL=http://localhost:1112\n");
  fs.writeFileSync(path.join(fdist, "index.html"), "<!doctype html><title>CORE</title>");
  fs.writeFileSync(path.join(fdist, "assets", "index-abc123.js"), `const API_URL="${API_ORIGIN}";export{API_URL};`);
  fs.writeFileSync(path.join(fdist, "assets", "prototypeOffRoutes-def456.js"), "export const x=1;");
  return { root, rel, sentinel: path.join(dist, "SENTINEL_IMPORTED") };
}

function goodEnv(root) {
  return {
    CORE_ENVIRONMENT: "staging", NODE_ENV: "development", ENABLE_DEMO_ROUTES: "false", HOST: "127.0.0.1", PORT: "1312",
    CORS_ORIGINS: "http://127.0.0.1:1311", PUBLIC_APP_URL: "http://127.0.0.1:1311", AUTH_SECRET: GOOD_SECRET,
    DATABASE_URL: "postgresql://core_app:s3cret-pw@127.0.0.1:5433/pdabliss_core_staging", MAIL_TRANSPORT: "dev",
    DEV_MAIL_DIR: path.join(root, "mail"), LOG_LEVEL: "info",
    PATH: process.env.PATH ?? "", SystemRoot: "C:\\Windows", // ordinary OS variables are not CORE variables
  };
}

/** A node-postgres stand-in: returns `row`, throws `error`, or never answers (`hang`). */
function fakePg({ row = { u: "core_app", su: false, d: "pdabliss_core_staging", p: 5433 }, error = null, hang = false } = {}) {
  return {
    Client: class {
      async connect() {
        if (hang) return new Promise(() => {});
        if (error) throw error;
      }
      async query() {
        return { rows: [row] };
      }
      async end() {}
    },
  };
}

const quietProbe = async () => ({ checked: 0, exposed: [] });
const noInspector = { execArgv: [], inspectorUrl: () => undefined };

function apiRun(fx, overrides = {}) {
  return runApiLauncher({
    env: goodEnv(fx.root), root: fx.root, releaseRoot: fx.rel, port: 0, cwd: fx.rel, pg: fakePg(), probe: quietProbe,
    chdir: () => {}, log: () => {}, ...noInspector, ...overrides,
  });
}

/** Expects a Refusal with `rule`. If the launcher unexpectedly STARTED, its server is closed before failing. */
async function refusedWith(promise, rule) {
  let started;
  try {
    started = await promise;
  } catch (err) {
    assert.ok(err instanceof Refusal, `expected a Refusal, got ${err}`);
    assert.equal(err.rule, rule);
    return;
  }
  await Promise.resolve(started?.close?.()).catch(() => {});
  assert.fail(`expected refusal ${rule}, but the launcher started`);
}

/** T1 core: refused with `rule`, and the application module was never imported. */
async function refusedBeforeApp(fx, overrides, rule) {
  await refusedWith(apiRun(fx, overrides), rule);
  assert.equal(fs.existsSync(fx.sentinel), false, "the application module must not have been imported");
}

const envWith = (fx, patch) => {
  const e = { ...goodEnv(fx.root), ...patch };
  for (const [k, v] of Object.entries(patch)) if (v === undefined) delete e[k];
  return e;
};

// ---------------------------------------------------------------- T9 positive
test("T9 api: all locks satisfied → app imported, bound to 127.0.0.1 only, probe clean", async () => {
  const fx = fixture();
  const lines = [];
  const app = await apiRun(fx, { probe: probeExposure, log: (l) => lines.push(l) });
  try {
    assert.equal(fs.existsSync(fx.sentinel), true);
    assert.equal(app.hostUsed, BIND_HOST);
    assert.equal(app.server.address().address, "127.0.0.1");
    assert.match(lines.join("\n"), /all launcher checks passed/);
    assert.doesNotMatch(lines.join("\n"), /s3cret-pw|QQQQ/);
  } finally {
    await app.close();
  }
});

test("T9 api: .env.example next to the release is not an .env file", async () => {
  const fx = fixture();
  const app = await apiRun(fx);
  await app.close();
});

// ---------------------------------------------------------------- T1 / T5: markers, mode, demo routes
test("T1 L1: CORE_ENVIRONMENT missing or not 'staging' → refused", async () => {
  await refusedBeforeApp(fixture(), { env: envWith(fixture(), { CORE_ENVIRONMENT: undefined }) }, "P6_REQUIRED");
  const fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { CORE_ENVIRONMENT: "production" }) }, "L1_MARKER");
});

test("T5 L2: NODE_ENV other than exactly 'development' → refused", async () => {
  for (const v of ["production", "test", "Development", " development"]) {
    const fx = fixture();
    await refusedBeforeApp(fx, { env: envWith(fx, { NODE_ENV: v }) }, "L2_NODE_ENV");
  }
  const fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { NODE_ENV: undefined }) }, "P6_REQUIRED");
});

test("T5 L2: ENABLE_DEMO_ROUTES anything but exactly 'false' → refused (demo bypass can never be enabled)", async () => {
  for (const v of ["true", "TRUE", "1", "", "False", "no"]) {
    const fx = fixture();
    await refusedBeforeApp(fx, { env: envWith(fx, { ENABLE_DEMO_ROUTES: v }) }, "L2_DEMO_ROUTES");
  }
  const fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { ENABLE_DEMO_ROUTES: undefined }) }, "P6_REQUIRED");
});

// ---------------------------------------------------------------- T2 bind variants
test("T2 L3: HOST must be exactly 127.0.0.1 — every wildcard / alias is refused", async () => {
  for (const v of ["0.0.0.0", "::", "::1", "localhost", "127.0.0.2", " 127.0.0.1", "127.0.0.1 ", ""]) {
    const fx = fixture();
    await refusedBeforeApp(fx, { env: envWith(fx, { HOST: v }) }, "L3_HOST");
  }
});

test("T2 L3: PORT must be exactly 1312", async () => {
  for (const v of ["1313", "80", "01312", "0"]) {
    const fx = fixture();
    await refusedBeforeApp(fx, { env: envWith(fx, { PORT: v }) }, "L3_PORT");
  }
});

// ---------------------------------------------------------------- T4 secret
test("T4 L4: AUTH_SECRET short, with whitespace, or the public development value → refused", async () => {
  for (const v of ["short", "x".repeat(42), "a".repeat(30) + " " + "b".repeat(20)]) {
    const fx = fixture();
    await refusedBeforeApp(fx, { env: envWith(fx, { AUTH_SECRET: v }) }, "L4_AUTH_SECRET");
  }
  const fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { AUTH_SECRET: DEV_SECRET }) }, "L4_AUTH_SECRET");
});

// ---------------------------------------------------------------- T3 database URL
test("T3 L5: any other database user, host, port, database or a query parameter → refused", async () => {
  const bad = [
    "postgresql://postgres:pw@127.0.0.1:5433/pdabliss_core_staging",
    "postgresql://core_owner:pw@127.0.0.1:5433/pdabliss_core_staging",
    "postgresql://core_app@127.0.0.1:5433/pdabliss_core_staging",
    "postgresql://core_app:pw@localhost:5433/pdabliss_core_staging",
    "postgresql://core_app:pw@[::1]:5433/pdabliss_core_staging",
    "postgresql://core_app:pw@10.0.0.5:5433/pdabliss_core_staging",
    "postgresql://core_app:pw@127.0.0.1:5432/pdabliss_core_staging",
    "postgresql://core_app:pw@127.0.0.1:55443/pdabliss_core_staging",
    "postgresql://core_app:pw@127.0.0.1:5433/pdabliss_core",
    "postgresql://core_app:pw@127.0.0.1:5433/pdabliss_core_dev",
    "postgresql://core_app:pw@127.0.0.1:5433/pdabliss_core_uat",
    "postgresql://core_app:pw@127.0.0.1:5433/pdabliss_core_test",
    "postgresql://core_app:pw@127.0.0.1:5433/pda_one_test",
    "postgresql://core_app:pw@127.0.0.1:5433/pdabliss_core_staging?host=10.0.0.5",
    "postgresql://core_app:pw@127.0.0.1:5433/pdabliss_core_staging?sslmode=disable",
    "postgres://core_app:pw@127.0.0.1:5433/pdabliss_core_staging",
    "not a url",
  ];
  for (const v of bad) {
    const fx = fixture();
    await refusedBeforeApp(fx, { env: envWith(fx, { DATABASE_URL: v }) }, "L5_DATABASE_URL");
  }
});

test("T1 L5: refusal messages never contain the database password", async () => {
  const fx = fixture();
  await assert.rejects(apiRun(fx, { env: envWith(fx, { DATABASE_URL: "postgresql://postgres:TopSecret99@127.0.0.1:5432/x" }) }), (e) => {
    assert.doesNotMatch(e.message, /TopSecret99/);
    return true;
  });
});

// ---------------------------------------------------------------- T1 L6 / L7
test("T1 L6: CORS_ORIGINS / PUBLIC_APP_URL other than http://127.0.0.1:1311 → refused", async () => {
  let fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { CORS_ORIGINS: "http://127.0.0.1:1311,https://evil.example" }) }, "L6_CORS");
  fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { CORS_ORIGINS: "http://localhost:1311" }) }, "L6_CORS");
  fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { PUBLIC_APP_URL: "https://core.pdabliss.com" }) }, "L6_PUBLIC_URL");
});

test("T1 L7: mail transport, mail folder (missing / elsewhere / junction) and log level", async () => {
  let fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { MAIL_TRANSPORT: "smtp" }) }, "L7_MAIL_TRANSPORT");
  fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { DEV_MAIL_DIR: path.join(fx.root, "elsewhere") }) }, "L7_MAIL_DIR");
  fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { DEV_MAIL_DIR: "mail" }) }, "L7_MAIL_DIR");
  fx = fixture();
  fs.rmSync(path.join(fx.root, "mail"), { recursive: true });
  await refusedBeforeApp(fx, {}, "L7_MAIL_DIR");
  fx = fixture();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "core-mail-target-"));
  fs.rmSync(path.join(fx.root, "mail"), { recursive: true });
  fs.symlinkSync(target, path.join(fx.root, "mail"), "junction");
  await refusedBeforeApp(fx, {}, "L7_MAIL_DIR");
  fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { LOG_LEVEL: "trace" }) }, "L7_LOG_LEVEL");
});

// ---------------------------------------------------------------- T5 / P6 allow-list
test("T5 P6: every disallowed CORE variable present → refused (names reported, never values)", async () => {
  const forbidden = {
    TRUST_PROXY: "loopback", SMTP_HOST: "smtp.example", SMTP_PASSWORD: "x", PLATFORM_OWNER_EMAIL: "a@b.c",
    DEMO_SALES_PASSWORD: "x", BOOTSTRAP_RESET_PASSWORDS: "true", TEST_DATABASE_URL: "postgresql://x@127.0.0.1:5432/pda_one_test",
    VITE_API_URL: "http://0.0.0.0:1312", PGHOST: "10.0.0.5", PGPASSWORD: "x", PGSSLMODE: "disable", PGOPTIONS: "-c x=y",
    CORE_OPS_CONFIG: "x", NODE_TLS_REJECT_UNAUTHORIZED: "0",
  };
  for (const [k, v] of Object.entries(forbidden)) {
    const fx = fixture();
    await assert.rejects(apiRun(fx, { env: envWith(fx, { [k]: v }) }), (e) => {
      assert.equal(e.rule, "P6_ALLOW_LIST", k);
      assert.match(e.message, new RegExp(k));
      assert.ok(!e.message.includes(v) || v.length < 3, `value of ${k} must not be printed`);
      return true;
    });
    assert.equal(fs.existsSync(fx.sentinel), false);
  }
  assert.equal(isCoreKey("PATH"), false);
  assert.equal(isCoreKey("SystemRoot"), false);
  for (const k of API_ALLOWED) assert.equal(isCoreKey(k), true, k);
});

// ---------------------------------------------------------------- T6 env files, release identity, sticky marker
test("T6 L8: .env or .env.* next to the release → refused", async () => {
  for (const where of [["backend", ".env"], ["backend", ".env.test"], [".", ".env"], [".", ".env.local"]]) {
    const fx = fixture();
    fs.writeFileSync(path.join(fx.rel, ...where), "X=1\n");
    await refusedBeforeApp(fx, {}, "L8_ENV_FILE");
  }
});

test("T6 L10: RELEASE_SHA missing, short or different from HEAD → refused", async () => {
  await refusedBeforeApp(fixture({ recordedSha: null }), {}, "L10_RELEASE_SHA");
  await refusedBeforeApp(fixture({ recordedSha: "abc123" }), {}, "L10_RELEASE_SHA");
  await refusedBeforeApp(fixture({ recordedSha: "b".repeat(40) }), {}, "L10_RELEASE_SHA");
});

test("T6 L10: a ref-style HEAD is resolved (refs file and packed-refs)", async () => {
  let fx = fixture();
  fs.writeFileSync(path.join(fx.rel, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.mkdirSync(path.join(fx.rel, ".git", "refs", "heads"), { recursive: true });
  fs.writeFileSync(path.join(fx.rel, ".git", "refs", "heads", "main"), `${SHA}\n`);
  await (await apiRun(fx)).close();
  fx = fixture();
  fs.writeFileSync(path.join(fx.rel, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(path.join(fx.rel, ".git", "packed-refs"), `# pack-refs\n${"c".repeat(40)} refs/heads/main\n`);
  await refusedBeforeApp(fx, {}, "L10_RELEASE_SHA");
});

test("T1 L14: the launcher refuses to run outside <root>\\releases\\<sha> (e.g. a development checkout)", async () => {
  const fx = fixture();
  const devCheckout = fs.mkdtempSync(path.join(os.tmpdir(), "dev-checkout-"));
  await refusedBeforeApp({ ...fx, rel: devCheckout }, { releaseRoot: devCheckout }, "L14_RELEASE_LOCATION");
  const nested = path.join(fx.root, "releases", "x", "y");
  fs.mkdirSync(nested, { recursive: true });
  await refusedBeforeApp(fx, { releaseRoot: nested }, "L14_RELEASE_LOCATION");
});

test("T6 P7: a sticky refusal marker refuses before any other check", async () => {
  const fx = fixture();
  fs.writeFileSync(markerPath(fx.root, "api"), "{}");
  await refusedBeforeApp(fx, { env: {} }, "P7_STICKY");
});

// ---------------------------------------------------------------- L13 debugger / injected options
test("T5 L13: NODE_OPTIONS, an --inspect flag or an active inspector → refused", async () => {
  let fx = fixture();
  await refusedBeforeApp(fx, { env: envWith(fx, { NODE_OPTIONS: "--inspect=0.0.0.0:9229" }) }, "L13_NODE_OPTIONS");
  for (const flag of ["--inspect", "--inspect=0.0.0.0:9229", "--inspect-brk", "--inspect-port=9230"]) {
    fx = fixture();
    await refusedBeforeApp(fx, { execArgv: [flag] }, "L13_INSPECT_FLAG");
  }
  fx = fixture();
  await refusedBeforeApp(fx, { inspectorUrl: () => "ws://127.0.0.1:9229/x" }, "L13_INSPECTOR_ACTIVE");
});

// ---------------------------------------------------------------- L9 / L11 / T7
test("T1 L9: database identity — superuser, wrong user, wrong database, wrong port, error, timeout → refused", async () => {
  const rows = [
    { u: "core_app", su: true, d: "pdabliss_core_staging", p: 5433 },
    { u: "core_owner", su: false, d: "pdabliss_core_staging", p: 5433 },
    { u: "core_app", su: false, d: "pdabliss_core", p: 5433 },
    { u: "core_app", su: false, d: "pdabliss_core_staging", p: 5432 },
    { u: "core_app", su: null, d: "pdabliss_core_staging", p: 5433 },
  ];
  for (const row of rows) await refusedBeforeApp(fixture(), { pg: fakePg({ row }) }, "L9_DATABASE_IDENTITY");
  await refusedBeforeApp(fixture(), { pg: fakePg({ error: new Error("connect ECONNREFUSED postgresql://core_app:pw@127.0.0.1:5433") }) }, "L9_DATABASE_IDENTITY");
  const started = Date.now();
  await refusedBeforeApp(fixture(), { pg: fakePg({ hang: true }) }, "L9_DATABASE_IDENTITY");
  assert.ok(Date.now() - started < 6000, "a hanging database must time out, not hang the launcher");
});

test("T1 L11: the application's own parsed configuration must agree (demo routes, trust proxy, secret)", async () => {
  const variants = [
    (s) => ({ ENABLE_DEMO_ROUTES: true }),
    (s) => ({ TRUST_PROXY: ["loopback"] }),
    (s) => ({ HOST: "0.0.0.0" }),
    (s) => ({ AUTH_SECRET: DEV_SECRET }),
    (s) => ({ CORS_ORIGINS: ["http://127.0.0.1:1311", "https://x.example"] }),
  ];
  for (const v of variants) {
    const fx = fixture();
    const loadEnvModule = async () => ({ DEV_AUTH_SECRET: DEV_SECRET, parseEnv: (s) => ({ NODE_ENV: "development", HOST: "127.0.0.1", PORT: 1312, MAIL_TRANSPORT: "dev", ENABLE_DEMO_ROUTES: false, TRUST_PROXY: false, CORS_ORIGINS: ["http://127.0.0.1:1311"], AUTH_SECRET: s.AUTH_SECRET, ...v(s) }) });
    await refusedBeforeApp(fx, { loadEnvModule }, "L11_PARSED_ENV");
  }
  const fx = fixture();
  await refusedBeforeApp(fx, { loadEnvModule: async () => ({ DEV_AUTH_SECRET: DEV_SECRET, parseEnv: () => { throw new Error("Invalid environment: AUTH_SECRET"); } }) }, "L11_PARSED_ENV");
});

test("T7: configuration / application module that fails to load, or buildApp throwing → refused, no listener", async () => {
  let fx = fixture();
  await refusedBeforeApp(fx, { loadEnvModule: async () => { throw new Error("boom"); } }, "P1_LOAD_CONFIG");
  fx = fixture();
  await refusedBeforeApp(fx, { loadEnvModule: async () => ({}) }, "P1_LOAD_CONFIG");
  fx = fixture();
  await refusedWith(apiRun(fx, { loadAppModule: async () => { throw new Error("import failed"); } }), "P1_LOAD_APP");
  fx = fixture();
  await refusedWith(apiRun(fx, { loadAppModule: async () => ({}) }), "P1_LOAD_APP");
  fx = fixture();
  await assert.rejects(apiRun(fx, { loadAppModule: async () => ({ buildApp: async () => { throw new Error("build failed"); } }) }), /build failed/);
});

// ---------------------------------------------------------------- T8 post-bind proof and exposure probe
test("T8 L12: a wildcard / IPv6 / wrong-port bound address → server closed, refused", async () => {
  for (const reported of [{ address: "0.0.0.0", family: "IPv4", port: 1312 }, { address: "::", family: "IPv6", port: 1312 }, { address: "127.0.0.1", family: "IPv4", port: 9999 }]) {
    const fx = fixture();
    const state = { closed: false };
    const loadAppModule = async () => ({
      buildApp: async () => ({
        listen: async () => {}, server: { address: () => reported }, close: async () => { state.closed = true; },
      }),
    });
    await refusedWith(apiRun(fx, { loadAppModule, port: 1312 }), "L12_BOUND_ADDRESS");
    assert.equal(state.closed, true, "the server must be closed after a failed proof");
  }
});

test("T8 L12: more than one listening address → refused", async () => {
  const fx = fixture();
  const state = { closed: false };
  const a = { address: "127.0.0.1", family: "IPv4", port: 1312 };
  const loadAppModule = async () => ({ buildApp: async () => ({ listen: async () => {}, server: { address: () => a }, addresses: () => [a, { ...a, address: "10.0.0.5" }], close: async () => { state.closed = true; } }) });
  await refusedWith(apiRun(fx, { loadAppModule, port: 1312 }), "L12_BOUND_ADDRESS");
  assert.equal(state.closed, true);
});

test("T8 L12: the exposure probe reporting a reachable LAN address → server closed, refused", async () => {
  const fx = fixture();
  let appRef;
  const probe = async () => ({ checked: 1, exposed: ["10.0.0.5"] });
  await refusedWith(apiRun(fx, { probe, log: () => {}, loadAppModule: async (f) => { const m = await import(pathToFileURL(f).href); return { buildApp: async (e) => (appRef = await m.buildApp(e)) }; } }), "L12_EXPOSED");
  assert.equal(appRef.closed, true);
});

test("T8 probe (real sockets): loopback-only listener is not reachable on LAN addresses; a wildcard one is", async () => {
  const local = http.createServer((q, r) => r.end());
  await new Promise((r) => local.listen(0, "127.0.0.1", r));
  const r1 = await probeExposure(local.address().port);
  assert.deepEqual(r1.exposed, []);
  local.close();
  const wild = http.createServer((q, r) => r.end());
  await new Promise((r) => wild.listen(0, "0.0.0.0", r));
  const r2 = await probeExposure(wild.address().port);
  const v4 = externalAddresses().filter((a) => a.includes("."));
  if (v4.length) assert.ok(r2.exposed.length >= 1, "a wildcard listener must be detected");
  else assert.equal(r2.checked, externalAddresses().length);
  wild.close();
});

// ---------------------------------------------------------------- checkDatabaseIdentity direct
test("T1 L9 direct: identity accepted only for core_app / non-superuser / staging database / expected port", async () => {
  await checkDatabaseIdentity({ url: "postgresql://x", pg: fakePg() });
  await refusedWith(checkDatabaseIdentity({ url: "postgresql://x", pg: fakePg({ row: { u: "core_app", su: false, d: "pdabliss_core_staging", p: 55443 } }) }), "L9_DATABASE_IDENTITY");
});

// ---------------------------------------------------------------- web launcher (W0–W6)
function fakeVite(report) {
  const calls = [];
  return {
    calls,
    loadVite: async () => ({
      preview: async (opts) => {
        calls.push(opts);
        const srv = http.createServer((q, r) => r.end("ok"));
        await new Promise((r) => srv.listen(opts.preview.port, opts.preview.host, r));
        return { httpServer: report ? { address: () => report } : srv, close: () => new Promise((r) => srv.close(() => r())), _srv: srv };
      },
    }),
  };
}
const webRun = (fx, overrides = {}) =>
  runWebLauncher({ env: { CORE_ENVIRONMENT: "staging", PATH: process.env.PATH ?? "" }, root: fx.root, releaseRoot: fx.rel, port: 0, cwd: fx.rel, probe: quietProbe, log: () => {}, ...noInspector, ...overrides });

test("T9 web: all checks pass → preview called with the constant host, strictPort, no browser", async () => {
  const fx = fixture();
  const v = fakeVite();
  const server = await webRun(fx, { loadVite: v.loadVite, probe: probeExposure });
  try {
    assert.equal(v.calls.length, 1);
    assert.deepEqual(v.calls[0].preview, { host: "127.0.0.1", port: 0, strictPort: true, open: false });
    assert.equal(v.calls[0].mode, "production");
    assert.equal(server.httpServer.address().address, "127.0.0.1");
  } finally {
    await server.close();
  }
});

test("T1 web W0 / P6 / L13: marker, VITE_* or any other CORE variable, NODE_OPTIONS → refused", async () => {
  const v = fakeVite();
  let fx = fixture();
  await refusedWith(webRun(fx, { env: {}, loadVite: v.loadVite }), "W0_MARKER");
  for (const extra of [{ VITE_API_URL: "http://0.0.0.0:1312" }, { DATABASE_URL: "postgresql://x" }, { AUTH_SECRET: "x" }, { NODE_ENV: "development" }]) {
    fx = fixture();
    await refusedWith(webRun(fx, { env: { CORE_ENVIRONMENT: "staging", ...extra }, loadVite: v.loadVite }), "P6_ALLOW_LIST");
  }
  fx = fixture();
  await refusedWith(webRun(fx, { env: { CORE_ENVIRONMENT: "staging", NODE_OPTIONS: "--inspect" }, loadVite: v.loadVite }), "L13_NODE_OPTIONS");
  assert.equal(v.calls.length, 0, "preview must never be called after a refusal");
});

test("T1 web W1 / W6 / L14 / P7: release identity, frontend .env files, location, sticky marker", async () => {
  const v = fakeVite();
  await refusedWith(webRun(fixture({ recordedSha: "d".repeat(40) }), { loadVite: v.loadVite }), "W1_RELEASE_SHA");
  for (const name of [".env", ".env.production", ".env.local", ".env.production.local"]) {
    const fx = fixture();
    fs.writeFileSync(path.join(fx.rel, "frontend", name), "VITE_API_URL=http://0.0.0.0:1312\n");
    await refusedWith(webRun(fx, { loadVite: v.loadVite }), "W6_ENV_FILE");
  }
  const fx = fixture();
  await refusedWith(webRun(fx, { releaseRoot: fs.mkdtempSync(path.join(os.tmpdir(), "dev-")), loadVite: v.loadVite }), "L14_RELEASE_LOCATION");
  const fx2 = fixture();
  fs.writeFileSync(markerPath(fx2.root, "web"), "{}");
  await refusedWith(webRun(fx2, { loadVite: v.loadVite }), "P7_STICKY");
  assert.equal(v.calls.length, 0);
});

test("T1 web W2 / W3: missing build, development API origin, missing staging origin, dev-only chunks → refused", async () => {
  const v = fakeVite();
  let fx = fixture();
  fs.rmSync(path.join(fx.rel, "frontend", "dist", "index.html"));
  await refusedWith(webRun(fx, { loadVite: v.loadVite }), "W2_BUILD");
  fx = fixture();
  fs.writeFileSync(path.join(fx.rel, "frontend", "dist", "assets", "index-abc123.js"), 'const API_URL="http://localhost:1112";');
  await refusedWith(webRun(fx, { loadVite: v.loadVite }), "W2_API_ORIGIN");
  // Both origins present (e.g. a stale chunk next to a fresh one): the development default alone must refuse.
  for (const dev of ["http://localhost:1112", "http://127.0.0.1:1112"]) {
    fx = fixture();
    fs.writeFileSync(path.join(fx.rel, "frontend", "dist", "assets", "stale-9z9z.js"), `const OLD="${dev}";`);
    await refusedWith(webRun(fx, { loadVite: v.loadVite }), "W2_API_ORIGIN");
  }
  fx = fixture();
  fs.writeFileSync(path.join(fx.rel, "frontend", "dist", "assets", "index-abc123.js"), 'const API_URL="https://core.pdabliss.com";');
  await refusedWith(webRun(fx, { loadVite: v.loadVite }), "W2_API_ORIGIN");
  for (const chunk of ["DevPersonaPicker-1a2b.js", "appRoutes-3c4d.js"]) {
    fx = fixture();
    fs.writeFileSync(path.join(fx.rel, "frontend", "dist", "assets", chunk), "export{};");
    await refusedWith(webRun(fx, { loadVite: v.loadVite }), "W3_DEV_CHUNKS");
  }
  assert.equal(v.calls.length, 0);
});

test("T7 / T8 web: Vite load failure, wildcard address, LAN exposure → refused and preview closed", async () => {
  let fx = fixture();
  await refusedWith(webRun(fx, { loadVite: async () => { throw new Error("no vite"); } }), "P1_LOAD_VITE");
  fx = fixture();
  await refusedWith(webRun(fx, { loadVite: async () => ({}) }), "P1_LOAD_VITE");
  fx = fixture();
  const wild = fakeVite({ address: "0.0.0.0", family: "IPv4", port: 40000 });
  await refusedWith(webRun(fx, { loadVite: wild.loadVite }), "W4_BOUND_ADDRESS");
  fx = fixture();
  const v = fakeVite();
  await refusedWith(webRun(fx, { loadVite: v.loadVite, probe: async () => ({ checked: 1, exposed: ["10.0.0.5"] }) }), "W4_EXPOSED");
});

test("web: resolveEsmEntry follows package.json exports (string, import, import.default)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-"));
  const write = (exp) => fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ exports: exp }));
  write({ ".": "./dist/node/index.js" });
  assert.equal(resolveEsmEntry(dir), path.join(dir, "dist", "node", "index.js"));
  write({ ".": { import: "./a.mjs", require: "./a.cjs" } });
  assert.equal(resolveEsmEntry(dir), path.join(dir, "a.mjs"));
  write({ ".": { import: { types: "./x.d.ts", default: "./b.mjs" } } });
  assert.equal(resolveEsmEntry(dir), path.join(dir, "b.mjs"));
});

// ---------------------------------------------------------------- runCli / entry points: real exit codes
function runChild(code, { cwd, env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "core-cli-"));
  const file = path.join(dir, "child.mjs");
  fs.writeFileSync(file, code);
  return spawnSync(process.execPath, [file], { cwd: cwd ?? dir, env: { PATH: process.env.PATH ?? "", ...env }, encoding: "utf8", timeout: 20_000 });
}
const commonUrl = pathToFileURL(path.join(EP, "launch-common.mjs")).href;

test("P2 runCli: a refusal exits 78 and writes the sticky marker (rule only, no value)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "core-root-"));
  const r = runChild(`import { runCli, refuse } from ${JSON.stringify(commonUrl)};
runCli({ service: "api", root: ${JSON.stringify(root)}, main: () => refuse("L3_HOST", "HOST must be 127.0.0.1") });`);
  assert.equal(r.status, REFUSAL_EXIT_CODE);
  assert.match(r.stderr, /REFUSED L3_HOST/);
  const marker = JSON.parse(fs.readFileSync(markerPath(root, "api"), "utf8"));
  assert.equal(marker.rule, "L3_HOST");
  assert.deepEqual(Object.keys(marker).sort(), ["at", "rule", "service"]);
});

test("P2 runCli: an unexpected error exits 78 with credentials redacted", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "core-root-"));
  const r = runChild(`import { runCli } from ${JSON.stringify(commonUrl)};
runCli({ service: "api", root: ${JSON.stringify(root)}, main: async () => { throw new Error("connect failed postgresql://core_app:HUNTER2@127.0.0.1:5433/db password=HUNTER2"); } });`);
  assert.equal(r.status, REFUSAL_EXIT_CODE);
  assert.match(r.stderr, /P2_UNEXPECTED/);
  assert.doesNotMatch(r.stderr, /HUNTER2/);
});

test("P2 runCli: an unhandled rejection during start-up exits 78", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "core-root-"));
  const r = runChild(`import { runCli } from ${JSON.stringify(commonUrl)};
runCli({ service: "web", root: ${JSON.stringify(root)}, main: () => { Promise.reject(new Error("late")); return new Promise(() => {}); } });`);
  assert.equal(r.status, REFUSAL_EXIT_CODE);
  assert.equal(fs.existsSync(markerPath(root, "web")), true);
});

test("P2 runCli: after a successful start a crash is an ordinary failure (exit 1, no sticky marker)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "core-root-"));
  const r = runChild(`import { runCli } from ${JSON.stringify(commonUrl)};
runCli({ service: "api", root: ${JSON.stringify(root)}, main: async () => { setTimeout(() => { throw new Error("runtime crash"); }, 50); } });`);
  assert.equal(r.status, 1);
  assert.equal(fs.existsSync(markerPath(root, "api")), false);
});

test("entry points: unconfigured start is refused with 78 (never a silent no-op)", () => {
  if (process.platform === "win32") {
    // On the host the entry points would write their marker into the real D:\pdabliss-core-staging\run, so here
    // the entry files are checked statically; the live refusal drill on the host is T11 (Stage B, G5).
    for (const [file, fn] of [["staging-launch.mjs", "runApiLauncher"], ["staging-web-launch.mjs", "runWebLauncher"]]) {
      const text = fs.readFileSync(path.join(EP, file), "utf8");
      assert.match(text, /^runCli\(\{/m, `${file} must call runCli unconditionally`);
      assert.match(text, new RegExp(`await ${fn}\\(\\)`), `${file} must call ${fn}() with no overrides`);
      assert.doesNotMatch(text, /import\.meta\.main|process\.argv\[1\]/, `${file} must not test for being the main module`);
    }
    return;
  }
  for (const file of ["staging-launch.mjs", "staging-web-launch.mjs"]) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "core-entry-"));
    const r = spawnSync(process.execPath, [path.join(EP, file)], { cwd, env: { PATH: process.env.PATH ?? "" }, encoding: "utf8", timeout: 20_000 });
    assert.equal(r.status, REFUSAL_EXIT_CODE, `${file}: ${r.stderr}`);
    assert.match(r.stderr, /REFUSED /);
  }
});

test("redact: connection credentials and key=value secrets are removed", () => {
  assert.equal(redact("postgresql://core_app:pw@127.0.0.1:5433/db"), "postgresql://core_app:<redacted>@127.0.0.1:5433/db");
  assert.equal(redact("password=abc token=xyz"), "password=<redacted> token=<redacted>");
});
