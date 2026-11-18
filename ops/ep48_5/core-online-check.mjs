#!/usr/bin/env node
// PDA BLISS CORE — EP48.5 O1: non-destructive checks for the online deployment (docs/EP48_5_ONLINE_DEPLOYMENT_PLAN.md
// §0.3, §3.1). Every command only READS: no write to a database, no mail sent, no login, no account created, no
// service or Cloudflare change. Output: one JSON report (stdout and --out); exit 0 = every check passed, 1 = not.
//
//   node ops/ep48_5/core-online-check.mjs release   --release-root <dir>
//        the release's application safeguards (session hooks before every data route, __Host- Secure cookies in
//        production, origin check, no demo bypass / development activation in production, SMTP requireTLS,
//        production env requirements, rate limits, seed refusal) + the known application-level blockers.
//   node ops/ep48_5/core-online-check.mjs build     --release-root <dir>
//        the compiled frontend as the online web launcher will see it (public HTTPS API origin, no loopback /
//        development origin, no development chunks, an indexable build with index.html / 404.html, supported
//        _redirects) — without starting a listener.
//   node ops/ep48_5/core-online-check.mjs smtp      --env-file <core-online.env> [--connect] [--timeout-ms 10000]
//        the SMTP settings as the launcher checks them; --connect: TCP + TLS (465) or EHLO + STARTTLS + TLS (587)
//        with certificate verification, then QUIT — no AUTH, no MAIL FROM, no message.
//   node ops/ep48_5/core-online-check.mjs db-target --env-file <file> --var <NAME> [--role core_owner] [--live]
//        a connection URL must target 127.0.0.1:5433/pdabliss_core_staging, no parameters; --live: the session reports
//        that database, port 5433, address 127.0.0.1 and the expected non-superuser role (read-only query).
//   node ops/ep48_5/core-online-check.mjs local     --expect absent|running
//        Windows facts: 1311 / 1312 / 5433 / 20243 only on 127.0.0.1 and only held by CORE-owned processes (absent:
//        nothing listens on them yet); the shared postmaster and production identity resolvable.
//   node ops/ep48_5/core-online-check.mjs remote    --mode R|P [--base https://core.pdabliss.com] [--robots noindex]
//        outside checks without credentials: HTTPS redirect, Access on the admin paths (and everywhere in mode R),
//        sign-up blocked at the edge, data routes 401, demo surface 404, cross-origin POST 403, static traversal,
//        security headers, no cookie for anonymous requests. Uses invalid / empty bodies only: nothing is created.
// Test hooks (--facts-module, --pg-module, --allow-http-for-tests) exist for the unit tests only.
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { pathToFileURL } from "node:url";
import { checkSmtpConfig } from "./api-launcher.mjs";
import { buildIndex } from "./static-server.mjs";
import { checkOnlineBuild } from "./web-launcher.mjs";
import { BIND_HOST, CORE_TUNNEL_METRICS, PUBLIC_ORIGIN, Refusal, STAGING_DB, redact } from "./launch-common.mjs";
import { collectFactsWindows, coreOwnedPids, factsComplete, identifyProduction, normalizeFacts } from "./g0-supervisor.mjs";

export const CORE_PORTS = Object.freeze([1311, 1312, STAGING_DB.port, CORE_TUNNEL_METRICS.port]);
const check = (id, ok, detail) => ({ id, ok: Boolean(ok), detail });

// ---------------------------------------------------------------- release: application safeguards (source of the release)
const read = (f) => fs.readFileSync(f, "utf8");
/** Splits a route file into plugin bodies and reports any route declared before the plugin's session pre-handler. */
export function routeGuardProblems(text, file) {
  const problems = [];
  const starts = [...text.matchAll(/=\s*async\s*\(\s*app\b/g)].map((m) => m.index);
  if (!starts.length) return [`${file}: no route plugin found`];
  starts.push(text.length);
  for (let i = 0; i < starts.length - 1; i++) {
    const body = text.slice(starts[i], starts[i + 1]);
    const hook = body.search(/app\.addHook\(\s*'preHandler'\s*,\s*require(Session|Platform)\s*\)/);
    const route = body.search(/\bapp\.(get|post|put|patch|delete)\(/);
    if (route >= 0 && (hook < 0 || hook > route)) problems.push(`${file}: plugin ${i + 1} declares a route before its session pre-handler`);
  }
  return problems;
}
/** Route files that legitimately have unauthenticated routes (each checked separately below). */
const PUBLIC_ROUTE_FILES = new Set(["auth.ts", "index.ts", "demo.ts"]);
export function checkReleaseSafeguards(srcRoot) {
  const f = (...p) => path.join(srcRoot, ...p);
  const checks = [];
  const has = (file, re) => {
    try {
      return re.test(read(f(...file.split("/"))));
    } catch {
      return false;
    }
  };
  const routeDir = f("routes", "v1");
  let routeFiles = [];
  try {
    routeFiles = fs.readdirSync(routeDir).filter((n) => n.endsWith(".ts"));
  } catch {
    // reported below
  }
  const guarded = routeFiles.filter((n) => !PUBLIC_ROUTE_FILES.has(n));
  const guardProblems = guarded.flatMap((n) => routeGuardProblems(read(path.join(routeDir, n)), n));
  checks.push(check("A1_SESSION_BEFORE_DATA_ROUTES", guarded.length >= 10 && !guardProblems.length, guardProblems.length ? guardProblems : `${guarded.length} route files: every plugin installs requireSession / requirePlatform before its first route`));
  checks.push(check("A2_PLATFORM_ROUTES", has("routes/v1/platform.ts", /app\.addHook\('preHandler', requirePlatform\)/) && has("routes/v1/platform.ts", /'\/users\/:userId\/suspend', \{ preHandler: requireRecentStepUp \}/), "platform routes need a platform role; sensitive ones a recent step-up"));
  const authText = (() => {
    try {
      return read(f("routes", "v1", "auth.ts"));
    } catch {
      return "";
    }
  })();
  const sessionRoutes = ["'/me'", "'/logout'", "'/logout-all'", "'/sessions'", "'/sessions/:id'"].every((r) => new RegExp(`app\\.(get|post|delete)\\(${r.replace(/[/:]/g, (c) => `\\${c}`)}, \\{ preHandler: requireSession`).test(authText));
  checks.push(check("A3_AUTH_SESSION_ROUTES", sessionRoutes, "/me, /logout, /logout-all, /sessions require a session"));
  checks.push(check("A4_RATE_LIMITS", /limit\('login'\)/.test(authText) && /limit\('register'\)/.test(authText) && has("app.ts", /app\.register\(rateLimit/) && has("auth/policy.ts", /maxFailures: 10,/) && has("auth/policy.ts", /maxAttempts: 5,/), "global and per-route limits; 10 failed logins / 15 min per account; 5 tries per code"));
  checks.push(check("C1_SECURE_COOKIES", has("auth/http.ts", /const prefix = env\.NODE_ENV === 'production' \? '__Host-' : ''/) && has("auth/http.ts", /httpOnly: true,\s*\n\s*secure: env\.NODE_ENV === 'production',\s*\n\s*sameSite: 'lax'/), "production: __Host- names, HttpOnly, Secure, SameSite=Lax"));
  checks.push(check("C2_ORIGIN_CHECK", has("auth/http.ts", /export function originCheck/) && has("app.ts", /checkOrigin\(request\);/), "state-changing /api requests: allowed Origin required with a CORE cookie"));
  checks.push(check("D1_NO_DEMO_BYPASS_IN_PRODUCTION", has("auth/demo-bypass.ts", /return env\.NODE_ENV !== 'production' && env\.ENABLE_DEMO_ROUTES === true;/), "the demo sign-in bypass exists only outside production"));
  checks.push(check("D2_NO_DEV_ACTIVATION_IN_PRODUCTION", has("app.ts", /new CompanyService\(\s*db,\s*env\.NODE_ENV !== 'production'[,)]/) && has("routes/v1/platform.ts", /if \(companies\.developmentActivation\) \{/), "payment-free activation is not routed in production"));
  // EP48.5 F1: self-service sign-up is behind the PUBLIC_SIGNUP switch (the online launcher requires false).
  checks.push(check("F1_SIGNUP_SWITCH", /if \(env\.PUBLIC_SIGNUP\) \{\s*\n\s*app\.post\('\/register'/.test(authText) && /if \(env\.PUBLIC_SIGNUP\) \{\s*\n\s*app\.post\('\/verification\/resend'/.test(authText) && /app\.post\('\/invitations\/register', limit\('invitationRegister'\)/.test(authText) && has("config/env.ts", /PUBLIC_SIGNUP: z\.stringbool\(\)/), "public sign-up exists only when PUBLIC_SIGNUP is on; invitation sign-up is rate limited"));
  // EP48.5 F2: manual activation is owner-only, needs a fresh code, is routed only for an allow-list, and checks the list.
  checks.push(check("F2_MANUAL_ACTIVATION_GUARDED", has("routes/v1/platform.ts", /if \(companies\.manualActivationEnabled\) \{\s*\n\s*app\.post\(\s*'\/companies\/:id\/manual-activation',\s*\{\s*preHandler: \[requireOwner, requireRecentStepUp\],/) && has("company/service.ts", /if \(!this\.manualActivationIds\.includes\(companyId\)\) throw new NotFoundError\(\);/) && has("company/service.ts", /status: 'PENDING_SUBSCRIPTION' \},\s*\n?\s*data: \{ status: 'ACTIVE'/), "manual activation: Platform Owner, fresh step-up, allow-listed company only, conditional (no replay)"));
  checks.push(check("D3_DEMO_SEED_REFUSES_PRODUCTION", has("auth/bootstrap.ts", /if \(env\.NODE_ENV === 'production'\) \{\s*\n\s*throw new SeedError\('The demo seed never runs in production\.'\)/), "the demo seed refuses production"));
  checks.push(check("M1_SMTP_REQUIRE_TLS", has("mail/mailer.ts", /requireTLS: !env\.SMTP_SECURE,/), "SMTP without implicit TLS insists on STARTTLS"));
  checks.push(check("E1_PRODUCTION_ENV", has("config/env.ts", /require\('SMTP_HOST', 'email delivery'\);/) && has("config/env.ts", /the development mail sink cannot be used in production/) && has("config/env.ts", /refusing to trust every proxy/), "production requires SMTP, refuses the dev sink and trust-all proxies"));
  const blockers = [];
  if (/app\.post\('\/register'/.test(authText) && !/if \(env\.PUBLIC_SIGNUP\) \{\s*\n\s*app\.post\('\/register'/.test(authText))
    blockers.push({ id: "B1_PUBLIC_SIGN_UP", where: "routes/v1/auth.ts POST /register, POST /verification/resend", control: "blocked at the edge (tunnel ingress http_status:404) before public mode (O7); a code-level switch is EP48.6" });
  if (has("routes/health.ts", /environment: opts\.environment/))
    blockers.push({ id: "I1_HEALTH_DISCLOSURE", where: "routes/health.ts GET /health", control: "reports service, version and environment publicly when /health is routed (owner decision); no secrets" });
  return { ok: checks.every((c) => c.ok), checks, blockers };
}

// ---------------------------------------------------------------- build: the online frontend, offline
export function checkBuildForOnline(releaseRoot) {
  const dist = path.join(releaseRoot, "frontend", "dist");
  const checks = [];
  try {
    checkOnlineBuild(dist);
    checks.push(check("W1_ONLINE_BUILD", true, "API origin https://core.pdabliss.com; no loopback / development origin; no development chunks"));
  } catch (e) {
    checks.push(check("W1_ONLINE_BUILD", false, `${e.rule ?? "error"}: ${e.message}`));
  }
  try {
    const index = buildIndex(dist);
    checks.push(check("W2_STATIC_INDEX", true, `${index.files.size} servable files, ${index.redirects.length} _redirects rules`));
  } catch (e) {
    checks.push(check("W2_STATIC_INDEX", false, `${e.rule ?? "error"}: ${e.message}`));
  }
  return { ok: checks.every((c) => c.ok), checks };
}

// ---------------------------------------------------------------- env files (read, never printed)
export function readEnvFile(file) {
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}

// ---------------------------------------------------------------- smtp: settings + a TLS-only conversation (no AUTH, no mail)
function smtpConversation({ host, port, implicitTls, timeoutMs, connect = net.connect, tlsConnect = tls.connect, ca }) {
  return new Promise((resolve) => {
    const steps = [];
    let socket;
    let buffer = "";
    let waiter = null;
    const finish = (ok, reason) => {
      clearTimeout(timer);
      try {
        socket?.end("QUIT\r\n");
        socket?.destroy();
      } catch {
        // closing only
      }
      resolve({ ok, reason, steps });
    };
    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);
    const onData = (d) => {
      buffer += d;
      const lines = buffer.split("\r\n");
      const last = lines.at(-2);
      if (last !== undefined && /^\d{3} /.test(last)) {
        const reply = buffer;
        buffer = "";
        const w = waiter;
        waiter = null;
        w?.(reply);
      }
    };
    const expect = (code) =>
      new Promise((res) => {
        waiter = (reply) => res(reply.startsWith(String(code)) ? reply : null);
      });
    const attach = (s) => {
      socket = s;
      s.setEncoding("utf8");
      s.on("data", onData);
      s.on("error", (e) => finish(false, `connection error (${e.code ?? "error"})`));
    };
    const tlsOptions = { servername: host, rejectUnauthorized: true, minVersion: "TLSv1.2", ...(ca ? { ca } : {}) };
    (async () => {
      if (implicitTls) {
        attach(tlsConnect({ host, port, ...tlsOptions }));
        await new Promise((r) => socket.once("secureConnect", r));
        steps.push("tls");
      } else {
        attach(connect({ host, port }));
      }
      if (!(await expect(220))) return finish(false, "no 220 greeting");
      steps.push("greeting");
      socket.write("EHLO core-online-check\r\n");
      const ehlo = await expect(250);
      if (!ehlo) return finish(false, "EHLO refused");
      if (!implicitTls) {
        if (!/^250[ -]STARTTLS\b/im.test(ehlo)) return finish(false, "the server does not offer STARTTLS (the application would refuse to send)");
        socket.write("STARTTLS\r\n");
        if (!(await expect(220))) return finish(false, "STARTTLS refused");
        const plain = socket;
        plain.removeListener("data", onData);
        const secure = tlsConnect({ socket: plain, ...tlsOptions });
        secure.on("error", (e) => finish(false, `TLS failed (${e.code ?? e.message})`));
        await new Promise((r) => secure.once("secureConnect", r));
        attach(secure);
        steps.push("starttls");
        socket.write("EHLO core-online-check\r\n");
        const again = await expect(250);
        if (!again) return finish(false, "EHLO after STARTTLS refused");
        if (!/^250[ -]AUTH\b/im.test(again)) return finish(false, "no AUTH offered over TLS");
      } else if (!/^250[ -]AUTH\b/im.test(ehlo)) return finish(false, "no AUTH offered over TLS");
      steps.push("auth-offered");
      finish(true, "TLS established with a verified certificate; AUTH offered (not attempted)");
    })().catch((e) => finish(false, `failed (${e?.code ?? e?.message ?? e})`));
  });
}
export async function checkSmtp(env, { connect = false, timeoutMs = 10_000, ca, net: netImpl } = {}) {
  const checks = [];
  let mode = null;
  try {
    mode = checkSmtpConfig(env);
    checks.push(check("S1_SMTP_SETTINGS", true, `${mode.port} ${mode.what}`));
  } catch (e) {
    checks.push(check("S1_SMTP_SETTINGS", false, e instanceof Refusal ? `${e.rule}: ${e.message}` : redact(e.message)));
  }
  if (connect && mode) {
    const r = await smtpConversation({ host: env.SMTP_HOST, port: Number(mode.port), implicitTls: mode.secure === "true", timeoutMs, ca, ...(netImpl ?? {}) });
    checks.push(check("S2_SMTP_TLS_SESSION", r.ok, `${r.reason}; steps: ${r.steps.join(" → ") || "none"}`));
  }
  return { ok: checks.every((c) => c.ok), checks };
}

// ---------------------------------------------------------------- db-target
export function checkDbUrl(value, role) {
  let u;
  try {
    u = new URL(value);
  } catch {
    return check("T1_DB_URL", false, "not a valid URL");
  }
  const ok =
    u.protocol === "postgresql:" && u.hostname === STAGING_DB.host && u.port === String(STAGING_DB.port) &&
    u.pathname === `/${STAGING_DB.database}` && u.search === "" && u.hash === "" && u.password !== "" &&
    (!role || decodeURIComponent(u.username) === role);
  return check("T1_DB_URL", ok, ok ? `targets 127.0.0.1:5433/${STAGING_DB.database}${role ? ` as ${role}` : ""}` : `must be postgresql://${role ?? "<role>"}:<password>@127.0.0.1:5433/${STAGING_DB.database} with no parameters`);
}
export async function checkDbLive(value, role, pg, timeoutMs = 3000) {
  const client = new pg.Client({ connectionString: value, connectionTimeoutMillis: timeoutMs, query_timeout: timeoutMs, application_name: "core-online-check" });
  try {
    await client.connect();
    const r = await client.query("SELECT current_user AS u, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS su, current_database() AS d, inet_server_port() AS p, host(inet_server_addr()) AS a");
    const row = r.rows[0] ?? {};
    const ok = row.d === STAGING_DB.database && Number(row.p) === STAGING_DB.port && row.a === BIND_HOST && row.su === false && (!role || row.u === role);
    return check("T2_DB_SESSION", ok, ok ? "session: CORE database, port 5433, 127.0.0.1, non-superuser" : "the session does not report the CORE database on 127.0.0.1:5433 as the expected non-superuser role");
  } catch (e) {
    return check("T2_DB_SESSION", false, `connection failed (${redact(e?.message ?? e)})`);
  } finally {
    client.end().catch(() => {});
  }
}

// ---------------------------------------------------------------- local: process and listener isolation (Windows facts)
export function checkLocal(facts, { expect = "running" } = {}) {
  const checks = [];
  if (!factsComplete(facts)) return { ok: false, checks: [check("L0_FACTS", false, "Windows process / socket facts unavailable")] };
  const core = coreOwnedPids(facts);
  const onCorePorts = facts.listeners.filter((l) => CORE_PORTS.includes(l.port));
  if (expect === "absent") checks.push(check("L1_PORTS_FREE", onCorePorts.length === 0, onCorePorts.length ? onCorePorts.map((l) => `${l.address}:${l.port} pid ${l.pid}`) : `nothing listens on ${CORE_PORTS.join(", ")}`));
  else {
    const foreign = onCorePorts.filter((l) => !core.has(l.pid));
    const wide = onCorePorts.filter((l) => l.address !== BIND_HOST);
    checks.push(check("L1_CORE_PORTS_OWNED", foreign.length === 0, foreign.length ? foreign.map((l) => `${l.address}:${l.port} held by non-CORE pid ${l.pid}`) : "every CORE port is held by a CORE-owned process"));
    checks.push(check("L2_LOOPBACK_ONLY", wide.length === 0, wide.length ? wide.map((l) => `${l.address}:${l.port}`) : "CORE ports listen on 127.0.0.1 only"));
    const coreElsewhere = facts.listeners.filter((l) => core.has(l.pid) && !CORE_PORTS.includes(l.port));
    checks.push(check("L3_NO_OTHER_CORE_LISTENER", coreElsewhere.length === 0, coreElsewhere.length ? coreElsewhere.map((l) => `${l.address}:${l.port} pid ${l.pid}`) : "CORE processes listen on no other port"));
    for (const port of [1311, 1312, STAGING_DB.port]) checks.push(check(`L4_LISTENING_${port}`, onCorePorts.some((l) => l.port === port), `127.0.0.1:${port}`));
  }
  const prod = identifyProduction(facts, {});
  checks.push(check("L5_PRODUCTION_IDENTIFIED", Boolean(prod.daemon && prod.postmaster), prod.postmaster ? `shared postmaster ${prod.postmaster.pid} (5432); PM2 daemon ${prod.daemon?.pid}` : "the shared postmaster (5432) or the PM2 daemon cannot be identified"));
  checks.push(check("L6_CORE_NOT_PRODUCTION", ![...core].some((pid) => prod.protectedPids.has(pid)), "no CORE-owned process is part of the production identity"));
  return { ok: checks.every((c) => c.ok), checks };
}

// ---------------------------------------------------------------- remote: outside checks, no credentials
export function httpRequest(url, { method = "GET", headers = {}, body, timeoutMs = 15_000 } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(u, { method, headers: { "user-agent": "pdabliss-core-online-check", ...headers }, timeout: timeoutMs }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (d) => {
        if (data.length < 65_536) data += d;
      });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => resolve({ status: 0, headers: {}, body: "", error: e.code ?? e.message }));
    if (body !== undefined) req.write(body);
    req.end();
  });
}
/** A Cloudflare Access challenge instead of origin content. */
export function isAccessChallenge(res) {
  const loc = String(res.headers?.location ?? "");
  if ([301, 302, 303, 307].includes(res.status) && /^https:\/\/[^/]+\.cloudflareaccess\.com\//i.test(loc)) return true;
  return [401, 403].includes(res.status) && (/cloudflareaccess\.com|Cloudflare Access/i.test(res.body ?? "") || String(res.headers?.["www-authenticate"] ?? "").includes("Cloudflare-Access"));
}
export const DATA_ROUTES = Object.freeze([
  "/api/v1/auth/me", "/api/v1/auth/sessions", "/api/v1/account/onboarding", "/api/v1/company/current", "/api/v1/company/current/members",
  "/api/v1/dashboards", "/api/v1/executive/overview", "/api/v1/master-data/context", "/api/v1/operations/context",
  "/api/v1/production/context", "/api/v1/purchase-orders/context", "/api/v1/purchase-requests/context", "/api/v1/sales/context",
  "/api/v1/warehouse/context",
]);
export const ADMIN_PATHS = Object.freeze(["/platform", "/platform/companies", "/api/v1/platform/overview", "/api/v1/platform/users"]);
export const SIGN_UP = Object.freeze([
  ["POST", "/api/v1/auth/register"], ["POST", "/api/v1/auth/verification/resend"], ["GET", "/register"], ["GET", "/en/register"], ["GET", "/zh/register"],
]);
export async function checkRemote({ base = PUBLIC_ORIGIN, mode = "P", robots = "noindex", request = httpRequest, checkHttpRedirect = true }) {
  const checks = [];
  const url = (p) => new URL(p, base).href;
  const json = { "content-type": "application/json" };
  if (checkHttpRedirect) {
    const plain = await request(url("/").replace(/^https:/, "http:"));
    const loc = String(plain.headers?.location ?? "");
    checks.push(check("R1_HTTPS_REDIRECT", [301, 302, 307, 308].includes(plain.status) && loc.startsWith("https://"), `http:// → ${plain.status} ${loc ? "https" : ""}`.trim()));
  }
  if (mode === "R") {
    for (const p of ["/", "/login", "/api/v1/", "/api/v1/company/current", "/health", ...ADMIN_PATHS]) {
      const r = await request(url(p));
      checks.push(check(`R2_ACCESS_EVERYWHERE ${p}`, isAccessChallenge(r), `${r.status}`));
    }
    return { ok: checks.every((c) => c.ok), mode, checks };
  }
  for (const p of ADMIN_PATHS) {
    const r = await request(url(p));
    checks.push(check(`P2_ADMIN_BEHIND_ACCESS ${p}`, isAccessChallenge(r), `${r.status}`));
  }
  for (const [method, p] of SIGN_UP) {
    const r = await request(url(p), method === "POST" ? { method, headers: json, body: "{}" } : { method });
    checks.push(check(`P1_SIGN_UP_BLOCKED ${method} ${p}`, r.status === 404 || r.status === 403, `${r.status}`));
  }
  for (const p of DATA_ROUTES) {
    const r = await request(url(p));
    checks.push(check(`P3_NO_DATA_WITHOUT_SESSION ${p}`, r.status === 401 && /UNAUTHENTICATED/.test(r.body), `${r.status}`));
  }
  const personas = await request(url("/api/v1/demo/personas"));
  checks.push(check("P4_NO_DEMO_PERSONAS", personas.status === 404, `${personas.status}`));
  const info = await request(url("/api/v1/"));
  let infoBody = null;
  try {
    infoBody = JSON.parse(info.body);
  } catch {
    // reported below
  }
  checks.push(check("P4_DEMO_ROUTES_OFF", info.status === 200 && infoBody?.demoRoutes === false, `${info.status}`));
  const health = await request(url("/health"));
  let healthBody = null;
  try {
    healthBody = JSON.parse(health.body);
  } catch {
    // reported below
  }
  checks.push(check("P4_PRODUCTION_MODE", health.status === 200 && healthBody?.environment === "production", `${health.status} ${healthBody?.environment ?? ""}`.trim()));
  const csrf = await request(url("/api/v1/auth/logout"), { method: "POST", headers: { ...json, origin: "https://evil.example", cookie: "__Host-core_sid=x" }, body: "{}" });
  checks.push(check("P7_CROSS_ORIGIN_REFUSED", csrf.status === 403 && /CSRF_REJECTED/.test(csrf.body), `${csrf.status}`));
  const home = await request(url("/"));
  const h = home.headers ?? {};
  checks.push(check("P8_SECURITY_HEADERS", home.status === 200 && h["x-content-type-options"] === "nosniff" && h["x-frame-options"] === "DENY" && /max-age=\d+/.test(String(h["strict-transport-security"] ?? "")), `${home.status}`));
  checks.push(check("P8_ROBOTS", robots === "index" ? !String(h["x-robots-tag"] ?? "").includes("noindex") : String(h["x-robots-tag"] ?? "").includes("noindex"), String(h["x-robots-tag"] ?? "absent")));
  checks.push(check("P8_NO_ANONYMOUS_COOKIE", !h["set-cookie"], h["set-cookie"] ? "a cookie is set for an anonymous page" : "none"));
  for (const p of ["/..%2f..%2fbackend%2f.env", "/%2e%2e/%2e%2e/RELEASE_SHA", "/.vite/manifest.json", "/assets/..%5c..%5cpackage.json"]) {
    const r = await request(url(p));
    checks.push(check(`P8_NO_TRAVERSAL ${p}`, [400, 404].includes(r.status) && !/DATABASE_URL|AUTH_SECRET|"dependencies"/.test(r.body), `${r.status}`));
  }
  return { ok: checks.every((c) => c.ok), mode, checks };
}

// ---------------------------------------------------------------- CLI
function argOf(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
async function main(argv) {
  const cmd = argv[0];
  let report;
  if (cmd === "release") {
    const releaseRoot = argOf(argv, "release-root");
    if (!releaseRoot) throw new Error("release needs --release-root");
    report = checkReleaseSafeguards(path.join(releaseRoot, "backend", "src"));
  } else if (cmd === "build") {
    const releaseRoot = argOf(argv, "release-root");
    if (!releaseRoot) throw new Error("build needs --release-root");
    report = checkBuildForOnline(releaseRoot);
  } else if (cmd === "smtp") {
    const file = argOf(argv, "env-file");
    if (!file) throw new Error("smtp needs --env-file");
    report = await checkSmtp(readEnvFile(file), { connect: argv.includes("--connect"), timeoutMs: Number(argOf(argv, "timeout-ms") ?? 10_000) });
  } else if (cmd === "db-target") {
    const file = argOf(argv, "env-file");
    const name = argOf(argv, "var");
    if (!file || !name) throw new Error("db-target needs --env-file and --var");
    const value = readEnvFile(file)[name];
    const role = argOf(argv, "role");
    const checks = [checkDbUrl(value ?? "", role)];
    if (argv.includes("--live") && checks[0].ok) {
      const mod = argOf(argv, "pg-module");
      const pg = mod ? await import(pathToFileURL(path.resolve(mod)).href) : createRequire(path.join(argOf(argv, "release-root") ?? process.cwd(), "backend", "package.json"))("pg");
      checks.push(await checkDbLive(value, role, pg.default ?? pg));
    }
    report = { ok: checks.every((c) => c.ok), checks };
  } else if (cmd === "local") {
    const mod = argOf(argv, "facts-module");
    const raw = mod ? await (await import(pathToFileURL(path.resolve(mod)).href)).collectFacts({ scope: "full" }) : collectFactsWindows({ scope: "full" });
    report = checkLocal(normalizeFacts(raw), { expect: argOf(argv, "expect") ?? "running" });
  } else if (cmd === "remote") {
    const base = argOf(argv, "base") ?? PUBLIC_ORIGIN;
    const testHttp = argv.includes("--allow-http-for-tests");
    if (!base.startsWith("https://") && !testHttp) throw new Error("remote needs an https:// base");
    report = await checkRemote({ base, mode: argOf(argv, "mode") ?? "P", robots: argOf(argv, "robots") ?? "noindex", checkHttpRedirect: !testHttp });
  } else throw new Error("usage: release | build | smtp | db-target | local | remote (see the header)");
  const out = argOf(argv, "out");
  const text = `${JSON.stringify({ at: new Date().toISOString(), command: cmd, ...report }, null, 2)}\n`;
  if (out) fs.writeFileSync(out, text);
  process.stdout.write(text);
  return report.ok ? 0 : 1;
}
if (path.basename(process.argv[1] ?? "") === "core-online-check.mjs") {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`[core-online-check] ERROR: ${redact(e?.message ?? e)}\n`);
      process.exit(1);
    },
  );
}
