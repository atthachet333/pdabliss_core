// EP48.5 G0 harness — Windows / Node 24 smoke of BOTH launchers against the REAL G0 builds.
// node g0-launcher-smoke.mjs --src <G0 checkout = <root>\releases\<sha>> --root <G0 test staging root>
//
// Uses the launchers' test parameters only (root, releaseRoot, port 0, fake database identity). The bind host is the
// code constant. Run through `g0-guard.mjs exec --target none` (no database variable; loopback guard preloaded).
// Never touches D:\pdabliss-core-staging\run, any database (the API's database identity is a stand-in;
// buildApp's pool targets 127.0.0.1:5433, where nothing listens) or any production port. Prints one JSON line.
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const src = arg("src");
const root = arg("root");
const out = { step: "launcher-smoke", platform: `${process.platform} ${process.version}`, checks: [], ok: false };
const check = (name, pass, detail) => {
  out.checks.push({ name, pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) });
  if (!pass) throw new Error(`check failed: ${name}`);
};
const imp = (rel) => import(pathToFileURL(path.join(src, rel)).href);
const get = (host, port, p) =>
  new Promise((resolve) => {
    const req = http.get({ host, port, path: p, timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
const canConnect = (host, port) =>
  new Promise((resolve) => {
    const s = net.connect({ host, port });
    const fin = (v) => {
      s.destroy();
      resolve(v);
    };
    s.setTimeout(1500, () => fin(false));
    s.once("connect", () => fin(true));
    s.once("error", () => fin(false));
  });

async function exposure(port, common) {
  const addrs = common.externalAddresses();
  const v4 = addrs.filter((a) => a.includes("."));
  const v6 = addrs.filter((a) => a.includes(":"));
  const reach = async (list) => (await Promise.all(list.map((a) => canConnect(a, port)))).filter(Boolean).length;
  return { ipv4Addresses: v4.length, ipv4Reachable: await reach(v4), ipv6Addresses: v6.length, ipv6Reachable: await reach(v6), ipv6LoopbackReachable: await canConnect("::1", port) };
}

try {
  const common = await imp("ops/ep48_5/launch-common.mjs");
  const { runApiLauncher } = await imp("ops/ep48_5/api-launcher.mjs");
  const { runWebLauncher } = await imp("ops/ep48_5/web-launcher.mjs");
  fs.mkdirSync(path.join(root, "mail"), { recursive: true });
  fs.mkdirSync(path.join(root, "run"), { recursive: true });
  const sha = common.readGitHead(src);
  fs.writeFileSync(path.join(src, "RELEASE_SHA"), `${sha}\n`);
  check("release is <root>\\releases\\<sha>", common.samePath(path.dirname(fs.realpathSync.native(src)), path.join(root, "releases")));

  const env = {
    CORE_ENVIRONMENT: "staging", NODE_ENV: "development", ENABLE_DEMO_ROUTES: "false", HOST: "127.0.0.1", PORT: "1312",
    CORS_ORIGINS: "http://127.0.0.1:1311", PUBLIC_APP_URL: "http://127.0.0.1:1311", AUTH_SECRET: randomBytes(36).toString("base64url"),
    DATABASE_URL: `postgresql://core_app:${randomBytes(18).toString("base64url")}@127.0.0.1:5433/pdabliss_core_staging`, // g0-preflight: allowed-fixture (stand-in: nothing listens on 5433, the identity check is stubbed)
    MAIL_TRANSPORT: "dev", DEV_MAIL_DIR: path.join(root, "mail"), LOG_LEVEL: "warn",
    PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", TEMP: process.env.TEMP ?? "", TMP: process.env.TMP ?? "",
  };
  const identityPg = { Client: class { async connect() {} async query() { return { rows: [{ u: "core_app", su: false, d: "pdabliss_core_staging", p: 5433 }] }; } async end() {} } };
  const quiet = () => {};

  // --- refusals with the REAL builds (before any listener)
  // g0-preflight: allowed-fixture — the 5432 URL below must be REFUSED by L5 before any connection (no client is created).
  for (const [patch, rule] of [[{ HOST: "0.0.0.0" }, "L3_HOST"], [{ ENABLE_DEMO_ROUTES: "true" }, "L2_DEMO_ROUTES"], [{ DATABASE_URL: "postgresql://core_app:x@127.0.0.1:5432/pda_one_test" }, "L5_DATABASE_URL"]]) { // g0-preflight: allowed-fixture
    let rule2 = "started";
    try {
      const app = await runApiLauncher({ env: { ...env, ...patch }, root, releaseRoot: src, port: 0, cwd: src, pg: identityPg, chdir: quiet, log: quiet });
      await app.close();
    } catch (e) {
      rule2 = e.rule ?? `error: ${e.message}`;
    }
    check(`api refuses ${Object.keys(patch)[0]} (${rule})`, rule2 === rule, rule2);
  }

  // --- API with the real backend build (Fastify buildApp), real Windows sockets
  const app = await runApiLauncher({ env, root, releaseRoot: src, port: 0, cwd: src, pg: identityPg, chdir: quiet, log: quiet });
  try {
    const a = app.server.address();
    check("api bound to 127.0.0.1 (IPv4) only", a.address === "127.0.0.1" && a.family === "IPv4" && app.addresses().length === 1, a);
    check("api /health answers 200", (await get("127.0.0.1", a.port, "/health")) === 200);
    check("api demo persona route is OFF (404)", (await get("127.0.0.1", a.port, "/api/v1/demo/personas")) === 404);
    const ex = await exposure(a.port, common);
    out.apiExposure = ex;
    check("api not reachable on LAN IPv4 / IPv6 or [::1]", ex.ipv4Reachable === 0 && ex.ipv6Reachable === 0 && !ex.ipv6LoopbackReachable, ex);
  } finally {
    await app.close();
  }
  check("no sticky marker after the API run", !fs.existsSync(common.markerPath(root, "api")));

  // --- web with the real frontend build and the release's own Vite
  const webEnv = { CORE_ENVIRONMENT: "staging", PATH: env.PATH, SystemRoot: env.SystemRoot, TEMP: env.TEMP, TMP: env.TMP };
  const server = await runWebLauncher({ env: webEnv, root, releaseRoot: src, port: 0, cwd: src, log: quiet });
  try {
    const a = server.httpServer.address();
    check("web bound to 127.0.0.1 (IPv4) only", a.address === "127.0.0.1" && a.family === "IPv4", a);
    check("web / answers 200", (await get("127.0.0.1", a.port, "/")) === 200);
    check("web /login answers 200", (await get("127.0.0.1", a.port, "/login")) === 200);
    const ex = await exposure(a.port, common);
    out.webExposure = ex;
    check("web not reachable on LAN IPv4 / IPv6 or [::1]", ex.ipv4Reachable === 0 && ex.ipv6Reachable === 0 && !ex.ipv6LoopbackReachable, ex);
  } finally {
    await server.close();
  }

  // --- Windows path behaviour: a junction as the mail folder is refused
  const target = path.join(root, "mail-target");
  fs.mkdirSync(target, { recursive: true });
  fs.renameSync(path.join(root, "mail"), path.join(root, "mail-real"));
  fs.symlinkSync(target, path.join(root, "mail"), "junction");
  let jr = "started";
  try {
    await (await runApiLauncher({ env, root, releaseRoot: src, port: 0, cwd: src, pg: identityPg, chdir: quiet, log: quiet })).close();
  } catch (e) {
    jr = e.rule ?? e.message;
  }
  check("Windows junction as the mail folder is refused (L7)", jr === "L7_MAIL_DIR", jr);
  // The junction fixture is left in place: G0 deletes nothing (owner requirement 10; cleanup only under A-8a).

  out.ok = true;
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
} catch (err) {
  out.error = String(err?.message ?? err).replace(/:\/\/([^:/@\s]+):[^@\s]+@/g, "://$1:<redacted>@");
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(1);
}
