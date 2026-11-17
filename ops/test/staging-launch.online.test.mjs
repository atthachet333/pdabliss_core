// EP48.5 O1 — the ONLINE launcher profile (production mode behind the dedicated tunnel) and the hardened static web
// server. Node built-ins only: no database, no Vite, no backend build. Every real socket is on 127.0.0.1.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ONLINE_API_ALLOWED, PROFILES, checkSmtpConfig, runApiLauncher } from "../ep48_5/api-launcher.mjs";
import { PUBLIC_ORIGIN, Refusal } from "../ep48_5/launch-common.mjs";
import { buildIndex, createStaticServer, parseRedirects, resolveRequest, securityHeaders } from "../ep48_5/static-server.mjs";
import { runOnlineWebLauncher } from "../ep48_5/web-launcher.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EP = path.resolve(HERE, "..", "ep48_5");
const SHA = "b".repeat(40);
const DEV_SECRET = "core-development-only-auth-secret-do-not-use-in-production";
const GOOD_SECRET = "R".repeat(20) + "t".repeat(20) + "Y8_-z";
const SMTP_PW = "Hx-9!smtp-not-real-pw";
const DB_PW = "db-pw-not-real";
const noProbe = async () => ({ checked: 2, exposed: [] });
const noInspector = () => undefined;

/** A staging root with one release: a production-semantics env.js stub, a sentinel app.js and a static build. */
function fixture({ apiOrigin = PUBLIC_ORIGIN, redirects = "/th  /  301\n/th/*  /:splat  301\n/register  /login  200\n/platform/*  /app  200\n" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "core-online-"));
  const rel = path.join(root, "releases", SHA);
  fs.mkdirSync(path.join(rel, ".git"), { recursive: true });
  fs.writeFileSync(path.join(rel, ".git", "HEAD"), `${SHA}\n`);
  fs.writeFileSync(path.join(rel, "RELEASE_SHA"), `${SHA}\n`);
  fs.mkdirSync(path.join(root, "run"));
  const dist = path.join(rel, "backend", "dist");
  fs.mkdirSync(path.join(dist, "config"), { recursive: true });
  fs.writeFileSync(path.join(rel, "backend", "package.json"), '{"type":"module"}');
  fs.writeFileSync(
    path.join(dist, "config", "env.js"),
    `export const DEV_AUTH_SECRET = ${JSON.stringify(DEV_SECRET)};
export function parseEnv(s) {
  if (s.NODE_ENV === "production" && (!s.SMTP_HOST || s.MAIL_TRANSPORT === "dev")) throw new Error("SMTP_HOST: required in production");
  return { NODE_ENV: s.NODE_ENV, HOST: s.HOST, PORT: Number(s.PORT), MAIL_TRANSPORT: s.MAIL_TRANSPORT,
    ENABLE_DEMO_ROUTES: s.ENABLE_DEMO_ROUTES === "true" ? true : s.ENABLE_DEMO_ROUTES === "false" ? false : s.NODE_ENV !== "production",
    TRUST_PROXY: s.TRUST_PROXY ? s.TRUST_PROXY.split(",") : false, CORS_ORIGINS: String(s.CORS_ORIGINS).split(","),
    PUBLIC_APP_URL: s.PUBLIC_APP_URL, SMTP_HOST: s.SMTP_HOST, SMTP_PORT: Number(s.SMTP_PORT ?? 587), SMTP_SECURE: s.SMTP_SECURE === "true",
    AUTH_SECRET: s.AUTH_SECRET ?? DEV_AUTH_SECRET };
}
`,
  );
  fs.writeFileSync(
    path.join(dist, "app.js"),
    `import fs from "node:fs";
import http from "node:http";
fs.writeFileSync(new URL("./SENTINEL_IMPORTED", import.meta.url), "imported");
export async function buildApp(env) {
  const server = http.createServer((q, r) => r.end("ok"));
  const app = { server, env, listen: ({ host, port }) => new Promise((res, rej) => { server.once("error", rej); server.listen(port, host, res); }),
    addresses: () => [server.address()], close: () => new Promise((r) => server.close(() => r())), log: { info() {} } };
  return app;
}
`,
  );
  const fdist = path.join(rel, "frontend", "dist");
  fs.mkdirSync(path.join(fdist, "assets"), { recursive: true });
  fs.mkdirSync(path.join(fdist, ".vite"), { recursive: true });
  fs.mkdirSync(path.join(fdist, "en"), { recursive: true });
  fs.writeFileSync(path.join(fdist, "index.html"), "<!doctype html><title>home</title>");
  fs.writeFileSync(path.join(fdist, "about.html"), "<!doctype html><title>about</title>");
  fs.writeFileSync(path.join(fdist, "en.html"), "<!doctype html><title>en home</title>");
  fs.writeFileSync(path.join(fdist, "en", "about.html"), "<!doctype html><title>en about</title>");
  fs.writeFileSync(path.join(fdist, "login.html"), "<!doctype html><title>login shell</title>");
  fs.writeFileSync(path.join(fdist, "app.html"), "<!doctype html><title>app shell</title>");
  fs.writeFileSync(path.join(fdist, "404.html"), "<!doctype html><title>not found</title>");
  fs.writeFileSync(path.join(fdist, "robots.txt"), "User-agent: *\nAllow: /\n");
  fs.writeFileSync(path.join(fdist, "assets", "index-abc123.js"), `const API_URL="${apiOrigin}";export{API_URL};`);
  fs.writeFileSync(path.join(fdist, "assets", "index-abc123.js.map"), "{}");
  fs.writeFileSync(path.join(fdist, "assets", "style-def456.css"), "body{}");
  fs.writeFileSync(path.join(fdist, ".vite", "manifest.json"), "{}");
  fs.writeFileSync(path.join(fdist, "_redirects"), redirects);
  fs.writeFileSync(path.join(rel, "frontend", "SECRET_OUTSIDE_DIST.txt"), "must never be served");
  return { root, rel, fdist, sentinel: path.join(dist, "SENTINEL_IMPORTED") };
}
function onlineEnv(extra = {}) {
  return {
    CORE_ENVIRONMENT: "online-uat", NODE_ENV: "production", ENABLE_DEMO_ROUTES: "false", HOST: "127.0.0.1", PORT: "1312",
    CORS_ORIGINS: "https://core.pdabliss.com", PUBLIC_APP_URL: "https://core.pdabliss.com", AUTH_SECRET: GOOD_SECRET,
    DATABASE_URL: `postgresql://core_app:${DB_PW}@127.0.0.1:5433/pdabliss_core_staging`, TRUST_PROXY: "loopback",
    MAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp.hostinger.com", SMTP_PORT: "587", SMTP_SECURE: "false",
    SMTP_USER: "notify@pdabliss.com", SMTP_PASSWORD: SMTP_PW, MAIL_FROM: "PDA BLISS CORE <notify@pdabliss.com>", LOG_LEVEL: "info",
    PATH: process.env.PATH ?? "", SystemRoot: "C:\\Windows",
    ...extra,
  };
}
const fakePg = (row) => ({
  Client: class {
    async connect() {}
    async query() {
      return { rows: [row] };
    }
    async end() {}
  },
});
const goodRow = { u: "core_app", su: false, d: "pdabliss_core_staging", p: 5433 };
async function launchApi(f, env, extra = {}) {
  return runApiLauncher({ profile: PROFILES.online, env, root: f.root, releaseRoot: f.rel, cwd: f.rel, port: 0, pg: fakePg(goodRow), probe: noProbe, execArgv: [], inspectorUrl: noInspector, chdir: () => {}, log: () => {}, ...extra });
}
async function refusedWith(promise, rule) {
  await assert.rejects(promise, (e) => e instanceof Refusal && e.rule === rule, `expected ${rule}`);
}
const without = (env, ...keys) => Object.fromEntries(Object.entries(env).filter(([k]) => !keys.includes(k)));
function get(port, p, { method = "GET", host = "127.0.0.1:" + port } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: p, method, headers: { host } }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

// ---------------------------------------------------------------- API, online profile
test("O-T9 online api: production profile satisfied → app built with the parsed production config, bound to 127.0.0.1 only", async () => {
  const f = fixture();
  const lines = [];
  const app = await launchApi(f, onlineEnv(), { log: (l) => lines.push(l) });
  try {
    assert.equal(fs.existsSync(f.sentinel), true);
    assert.equal(app.server.address().address, "127.0.0.1");
    assert.equal(app.env.NODE_ENV, "production");
    assert.equal(app.env.ENABLE_DEMO_ROUTES, false);
    assert.deepEqual(app.env.TRUST_PROXY, ["loopback"]);
    assert.match(lines.join("\n"), /CORE online \(core\.pdabliss\.com, production mode\) — all launcher checks passed/);
    assert.doesNotMatch(lines.join("\n"), new RegExp(`${SMTP_PW}|${DB_PW}|${GOOD_SECRET}`));
  } finally {
    await app.close();
  }
});
test("O-L1 / L2: online marker, production mode and demo routes off are all required exactly", async () => {
  const f = fixture();
  await refusedWith(launchApi(f, onlineEnv({ CORE_ENVIRONMENT: "staging" })), "L1_MARKER");
  for (const v of ["development", "test", "Production", ""]) await refusedWith(launchApi(f, onlineEnv({ NODE_ENV: v })), "L2_NODE_ENV");
  for (const v of ["true", "TRUE", "1", "False"]) await refusedWith(launchApi(f, onlineEnv({ ENABLE_DEMO_ROUTES: v })), "L2_DEMO_ROUTES");
  await refusedWith(launchApi(f, without(onlineEnv(), "ENABLE_DEMO_ROUTES")), "P6_REQUIRED");
  assert.equal(fs.existsSync(f.sentinel), false, "the application is never imported on a refusal");
});
test("O-L6: public origin exactly https://core.pdabliss.com and TRUST_PROXY exactly loopback (never trust-all)", async () => {
  const f = fixture();
  for (const v of ["http://core.pdabliss.com", "https://core.pdabliss.com/", "https://evil.example", "http://127.0.0.1:1311", "https://core.pdabliss.com,https://x.example"]) {
    await refusedWith(launchApi(f, onlineEnv({ CORS_ORIGINS: v })), "L6_CORS");
    await refusedWith(launchApi(f, onlineEnv({ PUBLIC_APP_URL: v })), "L6_PUBLIC_URL");
  }
  for (const v of ["true", "*", "1", "0.0.0.0/0", "loopback,10.0.0.0/8", "Loopback", ""])
    await refusedWith(launchApi(f, onlineEnv({ TRUST_PROXY: v })), "L6_TRUST_PROXY");
  await refusedWith(launchApi(f, without(onlineEnv(), "TRUST_PROXY")), "P6_REQUIRED");
});
test("O-L7: SMTP missing or unsafe → refused (no clear text, provider host name, pdabliss.com mailbox, sender domain)", async () => {
  const f = fixture();
  for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "MAIL_TRANSPORT"])
    await refusedWith(launchApi(f, without(onlineEnv(), k)), "P6_REQUIRED");
  await refusedWith(launchApi(f, onlineEnv({ MAIL_TRANSPORT: "dev" })), "L7_MAIL_TRANSPORT");
  for (const h of ["10.0.0.5", "127.0.0.1", "localhost", "mail.local", "smtp", "smtp..hostinger.com", "-smtp.x.com"])
    await refusedWith(launchApi(f, onlineEnv({ SMTP_HOST: h })), "L7_SMTP_HOST");
  for (const [port, secure] of [["25", "false"], ["587", "true"], ["465", "false"], ["2525", "false"], ["587", ""], ["587", "FALSE"]])
    await refusedWith(launchApi(f, onlineEnv({ SMTP_PORT: port, SMTP_SECURE: secure })), "L7_SMTP_TLS");
  for (const u of ["notify@gmail.com", "notify@pdabliss.com.evil.example", "notify", "@pdabliss.com"])
    await refusedWith(launchApi(f, onlineEnv({ SMTP_USER: u })), "L7_SMTP_USER");
  await refusedWith(launchApi(f, onlineEnv({ SMTP_PASSWORD: "short" })), "L7_SMTP_PASSWORD");
  for (const v of ["CORE <notify@gmail.com>", "notify@evil.example", "<>", "not an address"])
    await refusedWith(launchApi(f, onlineEnv({ MAIL_FROM: v })), "L7_MAIL_FROM");
  // accepted: 465 implicit TLS, a bare sender address, no MAIL_FROM (the application's default is notify@pdabliss.com)
  assert.deepEqual(checkSmtpConfig(onlineEnv({ SMTP_PORT: "465", SMTP_SECURE: "true", MAIL_FROM: "notify@pdabliss.com" })).port, "465");
  assert.equal(checkSmtpConfig(without(onlineEnv(), "MAIL_FROM")).port, "587");
  try {
    await launchApi(f, onlineEnv({ SMTP_HOST: "127.0.0.1" }));
  } catch (e) {
    assert.doesNotMatch(e.message, new RegExp(SMTP_PW));
  }
});
test("O-P6: development / seed / build / database-default variables are refused in the online profile (names only)", async () => {
  const f = fixture();
  for (const k of ["DEV_MAIL_DIR", "RATE_LIMIT_MAX", "RATE_LIMIT_WINDOW", "PLATFORM_OWNER_EMAIL", "DEMO_OWNER_PASSWORD", "BOOTSTRAP_RESET_PASSWORDS", "TEST_DATABASE_URL", "VITE_API_URL", "PGHOST", "NODE_TLS_REJECT_UNAUTHORIZED"]) {
    await assert.rejects(launchApi(f, onlineEnv({ [k]: "x-secret-value" })), (e) => e.rule === "P6_ALLOW_LIST" && e.message.includes(k) && !e.message.includes("x-secret-value"));
  }
  assert.equal(ONLINE_API_ALLOWED.has("DEV_MAIL_DIR"), false);
  assert.equal(ONLINE_API_ALLOWED.has("TRUST_PROXY"), true);
});
test("O-L11: the application's own parsed configuration must agree with the online profile", async () => {
  const f = fixture();
  const parsedWith = (patch) => async (file) => {
    const m = await import(`${new URL(`file://${file}`).href}?v=${Math.random()}`);
    return { DEV_AUTH_SECRET: m.DEV_AUTH_SECRET, parseEnv: (s) => ({ ...m.parseEnv(s), ...patch }) };
  };
  for (const patch of [{ NODE_ENV: "development" }, { ENABLE_DEMO_ROUTES: true }, { TRUST_PROXY: false }, { TRUST_PROXY: ["loopback", "10.0.0.0/8"] }, { MAIL_TRANSPORT: "dev" }, { PUBLIC_APP_URL: "http://127.0.0.1:1311" }, { SMTP_SECURE: true }, { SMTP_PORT: 25 }, { AUTH_SECRET: DEV_SECRET }])
    await refusedWith(launchApi(f, onlineEnv(), { loadEnvModule: parsedWith(patch) }), "L11_PARSED_ENV");
  await refusedWith(launchApi(f, onlineEnv({ SMTP_HOST: "smtp.hostinger.com" }), { loadEnvModule: async () => ({ DEV_AUTH_SECRET: DEV_SECRET, parseEnv: () => { throw new Error("SMTP_HOST: required in production"); } }) }), "L11_PARSED_ENV");
});
test("O-profiles: the staging profile refuses the online environment and the online entry point is fixed to the online profile", async () => {
  const f = fixture();
  await assert.rejects(runApiLauncher({ env: onlineEnv(), root: f.root, releaseRoot: f.rel, cwd: f.rel, port: 0, pg: fakePg(goodRow), probe: noProbe, execArgv: [], inspectorUrl: noInspector, chdir: () => {} }), (e) => e instanceof Refusal);
  const online = fs.readFileSync(path.join(EP, "online-launch.mjs"), "utf8");
  assert.match(online, /runApiLauncher\(\{ profile: PROFILES\.online \}\)/);
  assert.doesNotMatch(online, /process\.env\.[A-Z_]*PROFILE|CORE_ENVIRONMENT\]/);
  const staging = fs.readFileSync(path.join(EP, "staging-launch.mjs"), "utf8");
  assert.match(staging, /runApiLauncher\(\)/);
  const web = fs.readFileSync(path.join(EP, "online-web-launch.mjs"), "utf8");
  assert.match(web, /runOnlineWebLauncher\(\)/);
  assert.doesNotMatch(web, /\.preview\(|loadVite/);
  assert.equal(PROFILES.online.nodeEnv, "production");
  assert.equal(PROFILES.staging.nodeEnv, "development");
});

// ---------------------------------------------------------------- web, online profile (hardened static server)
async function launchWeb(f, env = { CORE_ENVIRONMENT: "online-uat" }, extra = {}) {
  return runOnlineWebLauncher({ env, root: f.root, releaseRoot: f.rel, cwd: f.rel, port: 0, probe: noProbe, execArgv: [], inspectorUrl: noInspector, log: () => {}, ...extra });
}
test("O-W9 online web: all checks pass → static server on 127.0.0.1 only, security headers, noindex, Host checked", async () => {
  const f = fixture();
  const server = await launchWeb(f);
  try {
    const { port, address } = server.address();
    assert.equal(address, "127.0.0.1");
    const home = await get(port, "/");
    assert.equal(home.status, 200);
    assert.match(home.body, /<title>home<\/title>/);
    for (const [k, v] of Object.entries(securityHeaders())) assert.equal(home.headers[k], v, k);
    assert.equal(home.headers["x-robots-tag"], "noindex, nofollow");
    assert.equal(home.headers["cache-control"], "no-cache");
    assert.equal((await get(port, "/", { host: "core.pdabliss.com" })).status, 200);
    assert.equal((await get(port, "/", { host: "evil.example" })).status, 421);
    assert.equal((await get(port, "/", { method: "POST" })).status, 405);
  } finally {
    await new Promise((r) => server.close(() => r()));
  }
});
test("O-W1 online web: marker, VITE_* / other CORE variables, build origin and dev chunks are checked before any listener", async () => {
  await refusedWith(launchWeb(fixture(), { CORE_ENVIRONMENT: "staging" }), "W0_MARKER");
  await refusedWith(launchWeb(fixture(), { CORE_ENVIRONMENT: "online-uat", VITE_API_URL: "x" }), "P6_ALLOW_LIST");
  await refusedWith(launchWeb(fixture({ apiOrigin: "http://localhost:1112" })), "W2_API_ORIGIN");
  await refusedWith(launchWeb(fixture({ apiOrigin: "http://127.0.0.1:1312" })), "W2_API_ORIGIN");
  await refusedWith(launchWeb(fixture({ apiOrigin: "https://other.example" })), "W2_API_ORIGIN");
  const chunk = fixture();
  fs.writeFileSync(path.join(chunk.fdist, "assets", "DevPersonaPicker-x1.js"), "x");
  await refusedWith(launchWeb(chunk), "W3_DEV_CHUNKS");
  const missing = fixture();
  fs.rmSync(path.join(missing.fdist, "index.html"));
  await refusedWith(launchWeb(missing), "W2_BUILD");
  const env = fixture();
  fs.writeFileSync(path.join(env.rel, "frontend", ".env.production"), "VITE_API_URL=x");
  await refusedWith(launchWeb(env), "W6_ENV_FILE");
  await refusedWith(launchWeb(fixture(), undefined, { probe: async () => ({ checked: 1, exposed: ["192.0.2.7"] }) }), "W4_EXPOSED");
  // the same build checks offline, for O2 (no listener): core-online-check.mjs build
  const cli = (rel) => spawnSync(process.execPath, [path.join(EP, "core-online-check.mjs"), "build", "--release-root", rel], { encoding: "utf8" });
  const ok = cli(fixture().rel);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.deepEqual(JSON.parse(ok.stdout).checks.map((c) => [c.id, c.ok]), [["W1_ONLINE_BUILD", true], ["W2_STATIC_INDEX", true]]);
  const bad = cli(fixture({ apiOrigin: "http://127.0.0.1:1312" }).rel);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /W2_API_ORIGIN/);
});
test("O-S1 static server fails closed: no 404 page, a link / junction in the build, an unsupported _redirects rule", () => {
  const no404 = fixture();
  fs.rmSync(path.join(no404.fdist, "404.html"));
  assert.throws(() => buildIndex(no404.fdist), (e) => e.rule === "S1_BUILD_INCOMPLETE");
  assert.throws(() => buildIndex(path.join(no404.rel, "frontend", "no-such-dist")), (e) => e.rule === "S1_BUILD_MISSING");
  const linked = fixture();
  try {
    fs.symlinkSync(path.join(linked.rel, "frontend"), path.join(linked.fdist, "escape"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => buildIndex(linked.fdist), (e) => e.rule === "S1_BUILD_LINK");
  } catch (e) {
    if (e?.code !== "EPERM") throw e; // creating a link may need a privilege on Windows; the junction form normally does not
  }
  for (const bad of ["/a https://evil.example 301", "/a //evil.example 301", "/a /b 418", "/a* /b 200", "a /b 301"])
    assert.throws(() => parseRedirects(bad), (e) => e.rule === "S2_REDIRECTS", bad);
  assert.deepEqual(parseRedirects("# c\n/th/*  /:splat  301\n/x /y\n").map((r) => [r.from, r.to, r.status, r.splat]), [["/th/*", "/:splat", 301, true], ["/x", "/y", 301, false]]);
});
test("O-S2 static server refuses traversal and unsafe targets; nothing outside the indexed build is ever served", async () => {
  const f = fixture();
  const index = buildIndex(f.fdist);
  for (const u of ["/../SECRET_OUTSIDE_DIST.txt", "/%2e%2e/SECRET_OUTSIDE_DIST.txt", "/assets/..%2f..%2fSECRET_OUTSIDE_DIST.txt", "/%252e%252e/x", "/..\\SECRET_OUTSIDE_DIST.txt", "/assets%5c..%5c..%5cSECRET_OUTSIDE_DIST.txt", "//evil.example/x", "/C:/Windows/win.ini", "/index.html::$DATA", "/%00", "/a%0d%0aSet-Cookie:x", "/%E0%A4%A", "http://evil.example/", "*"]) {
    const r = resolveRequest(index, u);
    assert.ok([400, 404].includes(r.status), `${u} → ${r.status}`);
    assert.ok(!r.file || r.file.startsWith(index.root), u);
    assert.equal(r.location, undefined, u);
  }
  for (const u of ["/.vite/manifest.json", "/assets/index-abc123.js.map", "/_redirects", "/.env", "/frontend/SECRET_OUTSIDE_DIST.txt"]) assert.equal(resolveRequest(index, u).file && !resolveRequest(index, u).file.endsWith("404.html") ? "served" : "not served", "not served", u);
  assert.equal(resolveRequest(index, "/x".repeat(1100)).status, 414);
  for (const file of index.files.values()) assert.ok(file.startsWith(index.root) && !file.includes("SECRET_OUTSIDE_DIST"));
  const server = createStaticServer({ index, allowedHosts: ["127.0.0.1"] });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const port = server.address().port;
    const raw = await new Promise((resolve) => {
      const s = net.connect(port, "127.0.0.1", () => s.end("GET /../SECRET_OUTSIDE_DIST.txt HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"));
      let data = "";
      s.on("data", (d) => (data += d));
      s.on("end", () => resolve(data));
    });
    assert.match(raw, /^HTTP\/1\.1 400 /);
    assert.doesNotMatch(raw, /must never be served/);
  } finally {
    await new Promise((r) => server.close(() => r()));
  }
});
test("O-S3 static routing follows the build contract: clean URLs, _redirects 301 / 200, app routes, 404 page, missing assets", () => {
  const index = buildIndex(fixture().fdist);
  const r = (u) => resolveRequest(index, u);
  const name = (x) => (x.file ? path.basename(x.file) : null);
  assert.deepEqual([r("/").status, name(r("/"))], [200, "index.html"]);
  assert.deepEqual([r("/about").status, name(r("/about"))], [200, "about.html"]);
  assert.deepEqual([r("/en").status, name(r("/en"))], [200, "en.html"]);
  assert.deepEqual([r("/en/about").status, name(r("/en/about"))], [200, "about.html"]);
  assert.deepEqual([r("/about.html").status, r("/about.html").location], [301, "/about"]);
  assert.deepEqual([r("/index.html").status, r("/index.html").location], [301, "/"]);
  assert.deepEqual([r("/en/").status, r("/en/").location], [301, "/en"]);
  assert.deepEqual([r("/th").status, r("/th").location], [301, "/"]);
  assert.deepEqual([r("/th/about?x=1").status, r("/th/about?x=1").location], [301, "/about?x=1"]);
  assert.deepEqual([r("/register").status, name(r("/register"))], [200, "login.html"]);
  assert.deepEqual([r("/platform/companies").status, name(r("/platform/companies"))], [200, "app.html"]);
  assert.deepEqual([r("/company/settings").status, name(r("/company/settings"))], [200, "app.html"]);
  assert.deepEqual([r("/core/warehouse/receipts").status, name(r("/core/warehouse/receipts"))], [200, "app.html"]);
  assert.deepEqual([r("/no-such-page").status, name(r("/no-such-page"))], [404, "404.html"]);
  assert.deepEqual([r("/404").status, name(r("/404"))], [404, "404.html"]);
  assert.deepEqual([r("/assets/missing-000.js").status, r("/assets/missing-000.js").file], [404, undefined]);
  assert.deepEqual([r("/assets/index-abc123.js").status, name(r("/assets/index-abc123.js"))], [200, "index-abc123.js"]);
});
test("O-S4 static responses: content types, immutable assets, HEAD without body, 414, unsafe paths never echo", async () => {
  const index = buildIndex(fixture().fdist);
  const server = createStaticServer({ index, allowedHosts: ["127.0.0.1"], robots: "noindex, nofollow" });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const g = (p, o) => get(port, p, { host: "127.0.0.1", ...o });
  try {
    const js = await g("/assets/index-abc123.js");
    assert.equal(js.headers["content-type"], "text/javascript; charset=utf-8");
    assert.equal(js.headers["cache-control"], "public, max-age=31536000, immutable");
    assert.equal((await g("/assets/style-def456.css")).headers["content-type"], "text/css; charset=utf-8");
    assert.equal((await g("/robots.txt")).headers["content-type"], "text/plain; charset=utf-8");
    const head = await g("/about", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.body, "");
    assert.equal((await g(`/${"y".repeat(2100)}`)).status, 414);
    const bad = await g("/%2e%2e/<script>");
    assert.equal(bad.status, 400);
    assert.doesNotMatch(bad.body, /script/);
    for (const m of ["PUT", "DELETE", "OPTIONS", "TRACE"]) assert.equal((await g("/", { method: m })).status, 405, m);
    const missing = await g("/no-such-page");
    assert.equal(missing.status, 404);
    assert.match(missing.body, /not found/);
    assert.equal(missing.headers["x-frame-options"], "DENY");
  } finally {
    await new Promise((r) => server.close(() => r()));
  }
});
import net from "node:net";
