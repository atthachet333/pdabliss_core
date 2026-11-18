// EP48.5 O1 — the online deployment's non-destructive checks (core-online-check.mjs), the prepared Cloudflare tunnel /
// Access specifications and the WinSW service templates. Every real socket is on 127.0.0.1; nothing leaves the host.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ADMIN_PATHS, DATA_ROUTES, SIGN_UP, checkDbLive, checkDbUrl, checkLocal, checkReleaseSafeguards, checkRemote, checkSmtp, httpRequest,
  readEnvFile,
} from "../ep48_5/core-online-check.mjs";
import { normalizeFacts } from "../ep48_5/g0-supervisor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const ONLINE = path.join(REPO, "ops", "ep48_5", "online");
const SRC = path.join(REPO, "backend", "src");
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const ids = (r) => r.checks.filter((c) => !c.ok).map((c) => c.id);

// ---------------------------------------------------------------- release safeguards
test("ON1 the release's application safeguards hold in this repository; the known blockers are reported, not hidden", () => {
  const r = checkReleaseSafeguards(SRC);
  assert.equal(r.ok, true, JSON.stringify(r.checks.filter((c) => !c.ok), null, 2));
  assert.deepEqual(r.checks.map((c) => c.id), ["A1_SESSION_BEFORE_DATA_ROUTES", "A2_PLATFORM_ROUTES", "A3_AUTH_SESSION_ROUTES", "A4_RATE_LIMITS", "C1_SECURE_COOKIES", "C2_ORIGIN_CHECK", "D1_NO_DEMO_BYPASS_IN_PRODUCTION", "D2_NO_DEV_ACTIVATION_IN_PRODUCTION", "F1_SIGNUP_SWITCH", "F2_MANUAL_ACTIVATION_GUARDED", "D3_DEMO_SEED_REFUSES_PRODUCTION", "M1_SMTP_REQUIRE_TLS", "E1_PRODUCTION_ENV"]);
  // EP48.5 F1: public sign-up is now behind PUBLIC_SIGNUP (code level), so B1 is no longer an open blocker.
  assert.deepEqual(r.blockers.map((b) => b.id), ["I1_HEALTH_DISCLOSURE"]);
});
test("ON2 a weakened safeguard in a release is caught (route before its session hook, cookie flags, demo bypass, requireTLS, origin check)", () => {
  const copy = tmp("core-src-");
  fs.cpSync(SRC, copy, { recursive: true });
  const edit = (rel, from, to) => {
    const f = path.join(copy, ...rel.split("/"));
    const text = fs.readFileSync(f, "utf8");
    assert.ok(text.includes(from), `${rel}: anchor`);
    fs.writeFileSync(f, text.replace(from, to));
    return () => fs.writeFileSync(f, text);
  };
  const cases = [
    ["routes/v1/sales.ts", "  app.addHook('preHandler', requireSession);\n", "", "A1_SESSION_BEFORE_DATA_ROUTES"],
    ["routes/v1/platform.ts", "app.addHook('preHandler', requirePlatform)", "app.addHook('preHandler', requireSession)", "A2_PLATFORM_ROUTES"],
    ["routes/v1/auth.ts", "app.get('/me', { preHandler: requireSession }", "app.get('/me', {}", "A3_AUTH_SESSION_ROUTES"],
    ["auth/http.ts", "secure: env.NODE_ENV === 'production',", "secure: false,", "C1_SECURE_COOKIES"],
    ["app.ts", "checkOrigin(request);", "void checkOrigin;", "C2_ORIGIN_CHECK"],
    ["auth/demo-bypass.ts", "return env.NODE_ENV !== 'production' && env.ENABLE_DEMO_ROUTES === true;", "return env.ENABLE_DEMO_ROUTES === true;", "D1_NO_DEMO_BYPASS_IN_PRODUCTION"],
    ["app.ts", "        env.NODE_ENV !== 'production',\n", "        true,\n", "D2_NO_DEV_ACTIVATION_IN_PRODUCTION"],
    ["routes/v1/auth.ts", "  if (env.PUBLIC_SIGNUP) {\n    app.post('/register'", "  {\n    app.post('/register'", "F1_SIGNUP_SWITCH"],
    ["routes/v1/auth.ts", "app.post('/invitations/register', limit('invitationRegister')", "app.post('/invitations/register', {}", "F1_SIGNUP_SWITCH"],
    ["routes/v1/platform.ts", "preHandler: [requireOwner, requireRecentStepUp],\n        config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },", "preHandler: [requireOwner],\n        config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },", "F2_MANUAL_ACTIVATION_GUARDED"],
    ["company/service.ts", "if (!this.manualActivationIds.includes(companyId)) throw new NotFoundError();", "void companyId;", "F2_MANUAL_ACTIVATION_GUARDED"],
    ["company/service.ts", "where: { id: companyId, status: 'PENDING_SUBSCRIPTION' },", "where: { id: companyId },", "F2_MANUAL_ACTIVATION_GUARDED"],
    ["mail/mailer.ts", "requireTLS: !env.SMTP_SECURE,", "requireTLS: false,", "M1_SMTP_REQUIRE_TLS"],
  ];
  for (const [rel, from, to, id] of cases) {
    const restore = edit(rel, from, to);
    assert.deepEqual(ids(checkReleaseSafeguards(copy)), [id], id);
    restore();
  }
  assert.equal(checkReleaseSafeguards(copy).ok, true);
  assert.equal(checkReleaseSafeguards(path.join(copy, "no-such")).ok, false);
});

// ---------------------------------------------------------------- SMTP
function smtpServer(script) {
  const server = net.createServer((s) => {
    s.setEncoding("utf8");
    s.write("220 fake ESMTP\r\n");
    s.on("data", (d) => script(s, d));
    s.on("error", () => {});
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}
const smtpEnv = (extra = {}) => ({ MAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp.hostinger.com", SMTP_PORT: "587", SMTP_SECURE: "false", SMTP_USER: "notify@pdabliss.com", SMTP_PASSWORD: "not-a-real-password", ...extra });
test("ON3 SMTP: settings checked as the launcher does; the TLS-only conversation refuses servers without STARTTLS or a valid TLS session", async () => {
  assert.equal((await checkSmtp(smtpEnv())).ok, true);
  const bad = await checkSmtp(smtpEnv({ SMTP_PORT: "25" }), { connect: true });
  assert.deepEqual(ids(bad), ["S1_SMTP_SETTINGS"]);
  assert.equal(bad.checks.length, 1, "no connection is attempted with refused settings");
  assert.doesNotMatch(JSON.stringify(bad), /not-a-real-password/);
  const noStartTls = await smtpServer((s, d) => {
    if (/^EHLO/i.test(d)) s.write("250-fake\r\n250 AUTH PLAIN LOGIN\r\n");
    if (/^QUIT/i.test(d)) s.end("221 bye\r\n");
  });
  const brokenTls = await smtpServer((s, d) => {
    if (/^EHLO/i.test(d)) s.write("250-fake\r\n250-STARTTLS\r\n250 AUTH PLAIN\r\n");
    else if (/^STARTTLS/i.test(d)) s.write("220 go ahead\r\n");
    else s.end("this is not TLS\r\n");
  });
  const via = (server) => ({ connect: () => net.connect({ host: "127.0.0.1", port: server.address().port }), tlsConnect: (o) => (o.socket ? (require_tls().connect({ ...o })) : require_tls().connect({ ...o, host: "127.0.0.1", port: server.address().port })) });
  try {
    const a = await checkSmtp(smtpEnv(), { connect: true, timeoutMs: 5000, net: via(noStartTls) });
    assert.deepEqual(ids(a), ["S2_SMTP_TLS_SESSION"]);
    assert.match(a.checks[1].detail, /does not offer STARTTLS/);
    const b = await checkSmtp(smtpEnv(), { connect: true, timeoutMs: 5000, net: via(brokenTls) });
    assert.deepEqual(ids(b), ["S2_SMTP_TLS_SESSION"]);
    assert.match(b.checks[1].detail, /TLS failed|timeout|connection error/);
    const c = await checkSmtp(smtpEnv({ SMTP_PORT: "465", SMTP_SECURE: "true" }), { connect: true, timeoutMs: 5000, net: via(noStartTls) });
    assert.deepEqual(ids(c), ["S2_SMTP_TLS_SESSION"]);
  } finally {
    noStartTls.close();
    brokenTls.close();
  }
  const envFile = path.join(tmp("core-env-"), "core-online.env");
  fs.writeFileSync(envFile, '\uFEFF# comment\nSMTP_HOST=smtp.hostinger.com\nSMTP_PASSWORD="quoted value"\n\nBROKEN\n');
  assert.deepEqual(readEnvFile(envFile), { SMTP_HOST: "smtp.hostinger.com", SMTP_PASSWORD: "quoted value" });
});
import tlsModule from "node:tls";
const require_tls = () => tlsModule;

// ---------------------------------------------------------------- database target
test("ON4 database target: only 127.0.0.1:5433/pdabliss_core_staging with no parameters; the live session must agree", async () => {
  const good = "postgresql://core_owner:pw-x@127.0.0.1:5433/pdabliss_core_staging";
  assert.equal(checkDbUrl(good, "core_owner").ok, true);
  for (const u of [
    "postgresql://core_owner:pw@127.0.0.1:5432/pdabliss_core_staging", "postgresql://core_owner:pw@localhost:5433/pdabliss_core_staging",
    "postgresql://core_owner:pw@127.0.0.1:5433/pda_one_prod", "postgresql://core_owner:pw@127.0.0.1:5433/pdabliss_core_staging?host=/tmp",
    "postgresql://core_owner@127.0.0.1:5433/pdabliss_core_staging", "postgresql://postgres:pw@127.0.0.1:5433/pdabliss_core_staging", "not a url",
  ])
    assert.equal(checkDbUrl(u, "core_owner").ok, false, u);
  const pg = (row, fail) => ({ Client: class { async connect() { if (fail) throw new Error(`connect ECONNREFUSED ${good}`); } async query() { return { rows: [row] }; } async end() {} } });
  const ok = { u: "core_owner", su: false, d: "pdabliss_core_staging", p: 5433, a: "127.0.0.1" };
  assert.equal((await checkDbLive(good, "core_owner", pg(ok))).ok, true);
  for (const patch of [{ p: 5432 }, { d: "pda_one_prod" }, { a: "10.0.0.5" }, { su: true }, { u: "postgres" }])
    assert.equal((await checkDbLive(good, "core_owner", pg({ ...ok, ...patch }))).ok, false, JSON.stringify(patch));
  const down = await checkDbLive(good, "core_owner", pg(ok, true));
  assert.equal(down.ok, false);
  assert.doesNotMatch(down.detail, /pw-x/);
});

// ---------------------------------------------------------------- local isolation
const T = "2026-11-15T18:39:09.000Z";
const L = "2026-11-18T09:00:00.000Z";
function localFacts({ listeners = [], extra = [] } = {}) {
  return normalizeFacts({
    at: "x", cpuPct: 1, freeRamGB: 30, freeDiskDGB: 500,
    processes: [
      { pid: 9001, parent: 1, name: "node.exe", cmd: "node C:\\pm2\\lib\\Daemon.js", created: T },
      { pid: 9100, parent: 9001, name: "node.exe", cmd: "node app.js", created: T },
      { pid: 9200, parent: 1, name: "pg_ctl.exe", cmd: "pg_ctl runservice", created: T },
      { pid: 9201, parent: 9200, name: "postgres.exe", cmd: "postgres -D C:\\data", created: T },
      { pid: 8100, parent: 1, name: "pg_ctl.exe", cmd: "pg_ctl.exe runservice -D D:\\pdabliss-core-staging\\pgdata", created: L },
      { pid: 8101, parent: 8100, name: "postgres.exe", cmd: "postgres.exe -D D:/pdabliss-core-staging/pgdata", created: L },
      { pid: 8300, parent: 1, name: "pdabliss-core-api.exe", cmd: "D:\\pdabliss-core-staging\\services\\pdabliss-core-api.exe", created: L },
      { pid: 8301, parent: 8300, name: "node.exe", cmd: "node online-launch.mjs", created: L },
      { pid: 8400, parent: 1, name: "pdabliss-core-web.exe", cmd: "D:\\pdabliss-core-staging\\services\\pdabliss-core-web.exe", created: L },
      { pid: 8401, parent: 8400, name: "node.exe", cmd: "node online-web-launch.mjs", created: L },
      ...extra,
    ],
    listeners: [
      { address: "0.0.0.0", port: 5432, pid: 9201 }, { address: "127.0.0.1", port: 3001, pid: 9100 },
      ...listeners,
    ],
  });
}
const running = [{ address: "127.0.0.1", port: 5433, pid: 8101 }, { address: "127.0.0.1", port: 1312, pid: 8301 }, { address: "127.0.0.1", port: 1311, pid: 8401 }];
test("ON5 local isolation: CORE ports loopback-only and CORE-owned; nothing on them before O4; production still identified", () => {
  assert.equal(checkLocal(localFacts(), { expect: "absent" }).ok, true);
  assert.equal(checkLocal(localFacts({ listeners: running }), { expect: "running" }).ok, true, JSON.stringify(checkLocal(localFacts({ listeners: running })).checks.filter((c) => !c.ok)));
  assert.deepEqual(ids(checkLocal(localFacts({ listeners: running }), { expect: "absent" })), ["L1_PORTS_FREE"]);
  assert.deepEqual(ids(checkLocal(localFacts({ listeners: [...running.slice(0, 2), { address: "0.0.0.0", port: 1311, pid: 8401 }] }))), ["L2_LOOPBACK_ONLY"]);
  assert.deepEqual(ids(checkLocal(localFacts({ listeners: [...running.slice(0, 2), { address: "127.0.0.1", port: 1311, pid: 9100 }] }))), ["L1_CORE_PORTS_OWNED"]);
  assert.deepEqual(ids(checkLocal(localFacts({ listeners: [...running, { address: "0.0.0.0", port: 9229, pid: 8301 }] }))), ["L3_NO_OTHER_CORE_LISTENER"]);
  assert.deepEqual(ids(checkLocal(localFacts({ listeners: running.slice(1) }))), ["L4_LISTENING_5433"]);
  const noProd = normalizeFacts({ ...localFacts({ listeners: running }), processes: localFacts().processes.filter((p) => p.pid !== 9201) });
  assert.ok(ids(checkLocal(noProd)).includes("L5_PRODUCTION_IDENTIFIED"));
  assert.deepEqual(ids(checkLocal(normalizeFacts({}))), ["L0_FACTS"]);
});

// ---------------------------------------------------------------- remote (outside) checks against local stand-ins
function edgeStandIn({ broken = false } = {}) {
  const access = (res) => {
    res.writeHead(302, { location: "https://pdabliss.cloudflareaccess.com/cdn-cgi/access/login/core.pdabliss.com" });
    res.end();
  };
  const jsonOut = (res, status, body, extra = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...extra });
    res.end(JSON.stringify(body));
  };
  return http.createServer((req, res) => {
    const p = req.url.split("?")[0];
    if (p === "/" || p === "/login") {
      res.writeHead(200, broken ? { "set-cookie": "x=1" } : { "x-content-type-options": "nosniff", "x-frame-options": "DENY", "strict-transport-security": "max-age=31536000", "x-robots-tag": "noindex, nofollow" });
      return res.end("<!doctype html>");
    }
    if (ADMIN_PATHS.includes(p)) return broken ? jsonOut(res, 401, { code: "UNAUTHENTICATED" }) : access(res);
    if (SIGN_UP.some(([, s]) => s === p)) return broken && p.startsWith("/api") ? jsonOut(res, 400, { code: "VALIDATION" }) : (res.writeHead(404), res.end());
    if (DATA_ROUTES.includes(p)) return broken && p.includes("company") ? jsonOut(res, 200, { company: "x" }) : jsonOut(res, 401, { code: "UNAUTHENTICATED" });
    if (p === "/api/v1/demo/personas") return jsonOut(res, broken ? 200 : 404, {});
    if (p === "/api/v1/") return jsonOut(res, 200, { demoRoutes: broken });
    if (p === "/health") return jsonOut(res, 200, { environment: broken ? "development" : "production" });
    if (p === "/api/v1/auth/logout") return broken ? jsonOut(res, 401, { code: "UNAUTHENTICATED" }) : jsonOut(res, 403, { code: "CSRF_REJECTED" });
    if (/%2e|%2f|%5c|\.vite/i.test(req.url)) return broken ? (res.writeHead(200), res.end("DATABASE_URL=x")) : (res.writeHead(400), res.end());
    res.writeHead(404);
    res.end();
  });
}
async function withServer(server, fn) {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(() => r()));
  }
}
test("ON6 outside checks, public mode: admin behind Access, sign-up blocked, data 401, demo off, CSRF refused, headers, no traversal", async () => {
  const good = await withServer(edgeStandIn(), (base) => checkRemote({ base, mode: "P", checkHttpRedirect: false }));
  assert.equal(good.ok, true, JSON.stringify(good.checks.filter((c) => !c.ok), null, 2));
  assert.ok(good.checks.length >= 30);
  const bad = await withServer(edgeStandIn({ broken: true }), (base) => checkRemote({ base, mode: "P", checkHttpRedirect: false }));
  const failed = new Set(ids(bad).map((i) => i.split(" ")[0]));
  for (const id of ["P1_SIGN_UP_BLOCKED", "P2_ADMIN_BEHIND_ACCESS", "P3_NO_DATA_WITHOUT_SESSION", "P4_NO_DEMO_PERSONAS", "P4_DEMO_ROUTES_OFF", "P4_PRODUCTION_MODE", "P7_CROSS_ORIGIN_REFUSED", "P8_SECURITY_HEADERS", "P8_ROBOTS", "P8_NO_ANONYMOUS_COOKIE", "P8_NO_TRAVERSAL"])
    assert.ok(failed.has(id), id);
});
test("ON7 outside checks, restricted mode: every path must end at Cloudflare Access; one leaking path fails", async () => {
  const accessAll = http.createServer((req, res) => {
    if (req.url === "/health") return (res.writeHead(200), res.end("{}"));
    res.writeHead(302, { location: "https://pdabliss.cloudflareaccess.com/cdn-cgi/access/login/core.pdabliss.com" });
    res.end();
  });
  const r = await withServer(accessAll, (base) => checkRemote({ base, mode: "R", checkHttpRedirect: false }));
  assert.deepEqual(ids(r), ["R2_ACCESS_EVERYWHERE /health"]);
  const plain = await httpRequest("http://127.0.0.1:1/", { timeoutMs: 1000 });
  assert.equal(plain.status, 0, "an unreachable target is a failed check, never an exception");
});

// ---------------------------------------------------------------- prepared Cloudflare specifications and service templates
const goRegex = (re) => new RegExp(re); // the patterns use only syntax common to Go RE2 and JavaScript
function route(ingress, p) {
  for (const rule of ingress) {
    if (rule.hostname && rule.hostname !== "core.pdabliss.com") continue;
    if (rule.path && !goRegex(rule.path).test(p)) continue;
    return rule.service;
  }
  return null;
}
test("ON8 tunnel ingress and Access specification: sign-up blocked, /api and /health to the API, the rest to the web, admin paths in A1", () => {
  const t = JSON.parse(fs.readFileSync(path.join(ONLINE, "pdabliss-core.tunnel.json"), "utf8"));
  const ingress = t.config.ingress;
  assert.deepEqual(ingress.at(-1), { service: "http_status:404" }, "catch-all last");
  assert.ok(ingress.slice(0, -1).every((r) => r.hostname === "core.pdabliss.com"), "one hostname only");
  assert.ok(ingress.every((r) => /^(http_status:404|http:\/\/127\.0\.0\.1:(1311|1312))$/.test(r.service)), "loopback services only");
  const expectRoutes = {
    "/api/v1/auth/register": "http_status:404", "/api/v1/auth/register/": "http_status:404", "/api/v1/auth/verification/resend": "http_status:404",
    "/register": "http_status:404", "/en/register": "http_status:404", "/zh/register/": "http_status:404",
    "/api/v1/auth/login": "http://127.0.0.1:1312", "/api/v1/auth/verify-email": "http://127.0.0.1:1312", "/api": "http://127.0.0.1:1312", "/api/v1/": "http://127.0.0.1:1312",
    "/api/v1/platform/overview": "http://127.0.0.1:1312", "/health": "http://127.0.0.1:1312", "/health/ready": "http://127.0.0.1:1312",
    "/": "http://127.0.0.1:1311", "/login": "http://127.0.0.1:1311", "/apix": "http://127.0.0.1:1311", "/healthz": "http://127.0.0.1:1311",
    "/registers": "http://127.0.0.1:1311", "/platform": "http://127.0.0.1:1311", "/assets/index-abc.js": "http://127.0.0.1:1311",
  };
  for (const [p, svc] of Object.entries(expectRoutes)) assert.equal(route(ingress, p), svc, p);
  assert.equal(t.connector.metrics, "127.0.0.1:20243");
  assert.match(t.connector.tokenFile, /^D:\\pdabliss-core-staging\\config\\/);
  assert.match(t.fallbackIfHttpStatusUnavailable.expression, /^\(http\.host eq "core\.pdabliss\.com" and /);
  const a = JSON.parse(fs.readFileSync(path.join(ONLINE, "pdabliss-core.access.json"), "utf8"));
  const [a1, a2] = a.applications;
  assert.deepEqual(a1.domains, ["core.pdabliss.com/platform", "core.pdabliss.com/platform/*", "core.pdabliss.com/api/v1/platform/*"]);
  assert.deepEqual(a1.modes, ["R", "P"]);
  assert.deepEqual([a2.domains, a2.modes], [["core.pdabliss.com"], ["R"]]);
  for (const app of a.applications) for (const pol of app.policies) {
    assert.equal(pol.decision, "allow");
    assert.deepEqual(Object.keys(pol.include), ["emails"]);
  }
  assert.doesNotMatch(JSON.stringify(a.applications), /everyone|bypass|"domain"|"email_domain"|"everyone"/i, "named people only");
});
test("ON9 WinSW templates: dedicated services, bounded restarts, rolling logs, dependencies, no secret, no PM2, pinned connector", () => {
  const xml = (n) => fs.readFileSync(path.join(ONLINE, "winsw", `${n}.xml`), "utf8");
  const tag = (x, t) => [...x.matchAll(new RegExp(`<${t}>([^<]*)</${t}>`, "g"))].map((m) => m[1]);
  for (const name of ["pdabliss-core-api", "pdabliss-core-web", "pdabliss-core-tunnel"]) {
    const x = xml(name);
    assert.deepEqual(tag(x, "id"), [name]);
    assert.deepEqual([...x.matchAll(/<onfailure action="(\w+)"(?: delay="([^"]+)")?\/>/g)].map((m) => [m[1], m[2]]), [["restart", "10 sec"], ["restart", "30 sec"], ["none", undefined]], name);
    assert.deepEqual(tag(x, "resetfailure"), ["1 hour"]);
    assert.deepEqual(tag(x, "startmode"), ["Automatic"]);
    assert.match(x, /<log mode="roll-by-size">\s*<sizeThreshold>10240<\/sizeThreshold>\s*<keepFiles>8<\/keepFiles>/);
    assert.match(tag(x, "logpath")[0], /^D:\\pdabliss-core-staging\\logs\\(api|web|tunnel)$/);
    assert.doesNotMatch(x.replace(/<!--[\s\S]*?-->/g, ""), /password|secret|token=|pm2|0\.0\.0\.0|<serviceaccount>/i);
    assert.match(x, /sc\.exe config [\w-]+ obj= "NT SERVICE\\[\w-]+"/);
  }
  const api = xml("pdabliss-core-api");
  assert.deepEqual(tag(api, "arguments"), ["--env-file=D:\\pdabliss-core-staging\\config\\core-online.env --max-old-space-size=512 ops\\ep48_5\\online-launch.mjs"]);
  assert.deepEqual(tag(api, "depend"), ["pdabliss-core-staging-pg"]);
  assert.deepEqual(tag(api, "workingdirectory"), ["D:\\pdabliss-core-staging\\current"]);
  const web = xml("pdabliss-core-web");
  assert.deepEqual(tag(web, "arguments"), ["--max-old-space-size=256 ops\\ep48_5\\online-web-launch.mjs"]);
  assert.deepEqual([...web.matchAll(/<env name="([^"]+)" value="([^"]*)"\/>/g)].map((m) => [m[1], m[2]]), [["CORE_ENVIRONMENT", "online-uat"]]);
  const tunnel = xml("pdabliss-core-tunnel");
  assert.deepEqual(tag(tunnel, "executable"), ["D:\\pdabliss-core-staging\\tools\\cloudflared\\cloudflared.exe"]);
  assert.deepEqual(tag(tunnel, "arguments"), ["tunnel --no-autoupdate --metrics 127.0.0.1:20243 run --token-file D:\\pdabliss-core-staging\\config\\core-tunnel.token"]);
  assert.deepEqual(tag(tunnel, "depend"), ["pdabliss-core-api", "pdabliss-core-web"]);
});
