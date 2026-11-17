#!/usr/bin/env node
// PDA BLISS CORE — EP48.5 G0 isolation guard (docs/EP48_5_DEPLOYMENT_PLAN.md §4, guards I1–I5; A-0.1 amendment).
//
// EVERY G0 step that runs project code goes through this script. It
//   * refuses ambiguous inherited settings (PG* variables, DATABASE_URL, DIRECT_URL, SHADOW_DATABASE_URL, NODE_OPTIONS);
//   * gives the child an EXPLICIT database target (never the Prisma fallback localhost:5432):
//       none    no database variable at all
//       static  DATABASE_URL = postgresql://g0-static@127.0.0.1:55443/g0_no_such_database (Prisma generate / validate)
//       test    TEST_DATABASE_URL = the temporary instance's test database, AFTER host, port, database, role and
//               instance identity (PostgreSQL system identifier recorded at initdb) are verified (I1–I4);
//   * preloads the loopback-only listener guard (g0-loopback.mjs) into the child and every process it starts;
//   * enforces exact test counts with zero skipped and a test concurrency of two.
//
//   node g0-guard.mjs check          --gates <dir> --src <checkout>                     I1–I4
//   node g0-guard.mjs create-test-db --gates <dir> --src <checkout>                     I1–I4 on "postgres", then CREATE DATABASE
//   node g0-guard.mjs exec           --gates <dir> --src <checkout> --target <t> --name <step> -- <script.js> [args…]
//   node g0-guard.mjs backend-tests  --gates <dir> --src <checkout> --expect 611
//   node g0-guard.mjs frontend-tests --gates <dir> --src <checkout> --expect 1192
//   node g0-guard.mjs ops-tests      --gates <dir> --src <checkout> --expect <n>
//   node g0-guard.mjs compare        --before <host-audit.json> --after <host-audit.json>   I5
//
// Session inputs: TEST_DATABASE_URL (never printed) and CORE_G0_PG_SYSID (the temporary instance's system identifier).
// Exit 0 = pass, 1 = refused / failed. Nothing is ever dropped or deleted.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isInside, redact } from "./launch-common.mjs";

export const G0 = Object.freeze({ host: "127.0.0.1", port: 55443, testDatabase: "pdabliss_core_test", superuser: "gate" });
/** The explicit target for Prisma commands that need no database: the temporary instance, a database that does not exist. */
export const STATIC_DATABASE_URL = `postgresql://g0-static@${G0.host}:${G0.port}/g0_no_such_database`;
/** Databases that exist only on the shared production cluster: seeing one means we are on the wrong server. */
const PRODUCTION_FINGERPRINT = /^(pda_one_.*|pdabliss_property|pdabliss_staging)$/;
/** Inherited variables that could redirect a client, Prisma or Node — refused, never silently overridden. */
const DB_KEYS = ["DATABASE_URL", "TEST_DATABASE_URL", "DIRECT_URL", "SHADOW_DATABASE_URL"];
const isPgKey = (k) => /^PG[A-Z0-9_]+$/.test(k.toUpperCase());
/** ops suite flags. Test files are passed EXPLICITLY (discoverOpsTests): a bare directory ("ops/test/") fails on current Node. */
export const OPS_TEST_FLAGS = Object.freeze(["--test", "--test-reporter=tap", "--test-concurrency=2"]);
export const VITEST_FLAGS = Object.freeze(["run", "--pool=forks", "--maxWorkers=2"]);
export const PRELOAD = path.join(path.dirname(fileURLToPath(import.meta.url)), "g0-loopback-preload.mjs");
/** Staging ports that may appear between the before / after baselines. */
const STAGING_PORTS = new Set([1311, 1312, 5433, 55443]);

export class GuardFailure extends Error {
  constructor(guard, message) {
    super(message);
    this.guard = guard;
  }
}
const fail = (guard, message) => {
  throw new GuardFailure(guard, message);
};

// ---------------------------------------------------------------- explicit targets
/**
 * Validates a PostgreSQL URL before ANY client, Prisma command or test setup receives it: scheme postgresql:, the
 * authority must end in exactly "127.0.0.1:55443" (no other host, no host list, no default port), no query / fragment
 * (pg and libpq accept ?host= / ?port= overrides), and the database and role must be the expected ones.
 */
export function checkTarget(value, { label, databases, roles }) {
  if (!value) fail("I2", `${label} is not set`);
  let u;
  try {
    u = new URL(value);
  } catch {
    fail("I2", `${label} is not a valid URL`);
  }
  const rest = String(value).slice(String(value).indexOf("//") + 2);
  const authority = rest.split(/[/?#]/)[0];
  const hostPort = authority.slice(authority.lastIndexOf("@") + 1);
  const db = decodeURIComponent(u.pathname.replace(/^\//, ""));
  const user = decodeURIComponent(u.username);
  const okDb = databases instanceof RegExp ? databases.test(db) : databases.includes(db);
  if (u.protocol !== "postgresql:" || hostPort !== `${G0.host}:${G0.port}` || u.search !== "" || u.hash !== "" || !okDb || !roles.includes(user))
    fail("I2", `${label} must be postgresql://<${roles.join("|")}>@127.0.0.1:55443/<${databases instanceof RegExp ? databases.source : databases.join("|")}> with no parameters`);
  return u;
}

/** I2: the test URL — exactly the bootstrap role "gate" @ 127.0.0.1:55443 / pdabliss_core_test. */
export const checkTestUrl = (value) => checkTarget(value, { label: "TEST_DATABASE_URL", databases: [G0.testDatabase], roles: [G0.superuser] });

/** The instance identity recorded right after initdb (pg_controldata). Required: without it nothing connects. */
export function expectedSystemId(env = process.env) {
  const v = env.CORE_G0_PG_SYSID;
  if (!/^\d{10,20}$/.test(v ?? "")) fail("I3", "CORE_G0_PG_SYSID (the temporary instance's system identifier) is missing or invalid");
  return v;
}

/** Inherited variables that make the database target or Node options ambiguous. Names only — values are never read out. */
export function inheritedHazards(env) {
  return Object.keys(env).filter((k) => isPgKey(k) || [...DB_KEYS, "NODE_OPTIONS"].includes(k.toUpperCase())).sort();
}

/**
 * The child environment: the inherited one without any database / PG* / NODE_OPTIONS / CORE_G0* variable, plus the
 * explicit target, the G0 markers and the loopback preload.
 */
export function childEnv(base, { target, testUrl, gates, systemId, loopbackDir, preloadFile = PRELOAD }) {
  const env = {};
  for (const [k, v] of Object.entries(base)) {
    const K = k.toUpperCase();
    if (isPgKey(K) || DB_KEYS.includes(K) || K === "NODE_OPTIONS" || K.startsWith("CORE_G0")) continue;
    env[k] = v;
  }
  if (target === "static") env.DATABASE_URL = STATIC_DATABASE_URL;
  else if (target === "test") {
    checkTestUrl(testUrl);
    env.TEST_DATABASE_URL = testUrl;
  } else if (target !== "none") fail("ARGS", "--target must be none | static | test");
  env.CORE_G0 = "1";
  env.CORE_G0_GATES = path.resolve(gates);
  if (systemId) env.CORE_G0_PG_SYSID = systemId;
  env.CORE_G0_LOOPBACK_DIR = loopbackDir;
  env.NODE_OPTIONS = `--import=${pathToFileURL(preloadFile).href}`;
  return env;
}

/** I4: no .env / .env.* (other than .env.example) anywhere in the checkout (the test setup loads .env.test). */
export function findEnvFiles(srcDir) {
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/^\.env(\..+)?$/i.test(e.name) && e.name.toLowerCase() !== ".env.example") found.push(path.relative(srcDir, p));
    }
  };
  walk(srcDir);
  return found;
}

// ---------------------------------------------------------------- I1 + I3: server and instance identity
const IDENTITY_SQL =
  "SELECT inet_server_port() AS p, host(inet_server_addr()) AS a, current_user AS u, current_database() AS db, " +
  "current_setting('data_directory') AS d, current_setting('listen_addresses') AS l, current_setting('password_encryption') AS pe, " +
  "(SELECT system_identifier::text FROM pg_control_system()) AS sid";

/** Asks the server who it is, through an already checkTarget-ed URL. `pg` is node-postgres. */
export async function checkServer({ url, gatesDir, pg, systemId, expect = { database: G0.testDatabase, role: G0.superuser } }) {
  expectedSystemId({ CORE_G0_PG_SYSID: systemId });
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  await c.connect();
  try {
    const s = (await c.query(IDENTITY_SQL)).rows[0];
    const hba = (await c.query("SELECT type, auth_method, error FROM pg_hba_file_rules")).rows;
    const dbs = (await c.query("SELECT datname FROM pg_database")).rows.map((r) => r.datname);
    return evaluateServer({ settings: s, hba, databases: dbs, gatesDir, systemId, expect });
  } finally {
    await c.end().catch(() => {});
  }
}

/** Pure evaluation of the server facts (unit-tested). */
export function evaluateServer({ settings, hba, databases, gatesDir, systemId, expect = { database: G0.testDatabase, role: G0.superuser } }) {
  if (Number(settings?.p) !== G0.port) fail("I3", "the server answering is not on port 55443");
  if (settings?.a !== G0.host) fail("I3", "the connection did not reach the server on 127.0.0.1");
  if (!systemId || settings?.sid !== systemId) fail("I3", "the PostgreSQL system identifier is not the one recorded at initdb — this is not the temporary G0 instance");
  if (settings?.u !== expect.role) fail("I3", `the authenticated role is not ${expect.role}`);
  if (settings?.db !== expect.database) fail("I3", `the connected database is not ${expect.database}`);
  if (settings?.l !== G0.host) fail("I1", "listen_addresses is not exactly 127.0.0.1");
  if (settings?.pe !== "scram-sha-256") fail("I1", "password_encryption is not scram-sha-256");
  if (!hba.length) fail("I1", "pg_hba rules could not be read");
  const weak = hba.filter((r) => r.error || !["scram-sha-256", "reject"].includes(r.auth_method));
  if (weak.length) fail("I1", `pg_hba has ${weak.length} rule(s) that are not scram-sha-256 / reject (trust is forbidden)`);
  let dataDir;
  let gates;
  try {
    dataDir = fs.realpathSync.native(settings.d);
    gates = fs.realpathSync.native(gatesDir);
  } catch {
    fail("I3", "the server's data directory or the gates folder cannot be resolved");
  }
  if (!isInside(dataDir, gates)) fail("I3", "the server's data directory is not inside the G0 gates folder");
  const prod = databases.filter((d) => PRODUCTION_FINGERPRINT.test(d));
  if (prod.length) fail("I3", `this server holds production database names (${prod.length}) — it is the shared cluster, not the G0 instance`);
  return { port: G0.port, dataDir, rules: hba.length, role: settings.u, database: settings.db };
}

/** A database G0 is about to create must not exist yet (no collision, nothing overwritten, nothing dropped). */
export async function assertDatabaseAbsent({ url, pg, database }) {
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  await c.connect();
  try {
    if ((await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [database])).rowCount)
      fail("COLLISION", `${database} already exists on the temporary instance — refusing (nothing is reused or dropped)`);
  } finally {
    await c.end().catch(() => {});
  }
}

// ---------------------------------------------------------------- I5: before / after baselines from the host collector
const readAudit = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
const arr = (v) => (Array.isArray(v) ? v : Array.isArray(v?.value) ? v.value : v == null ? [] : [v]);

export function compareBaselines(before, after) {
  const diffs = [];
  const pg = (a) => a?.postgres ?? {};
  if (pg(before).postmasterPid !== pg(after).postmasterPid || pg(before).postmasterStarted !== pg(after).postmasterStarted)
    diffs.push("shared PostgreSQL postmaster PID or start time changed");
  const dbNames = (a) => arr(a?.postgres?.result?.databases).map((d) => d.name).sort().join(",");
  if (!dbNames(before) || dbNames(before) !== dbNames(after)) diffs.push("shared PostgreSQL database list changed or missing");
  const prodDaemon = (a) => arr(a?.pm2?.daemons).find((d) => /SYSTEM/i.test(d.owner ?? ""));
  const tree = (d) => (d ? `${d.pid}@${d.started}|` + arr(d.apps).map((x) => `${x.pid}@${x.started}`).sort().join(",") : "");
  if (!tree(prodDaemon(before)) || tree(prodDaemon(before)) !== tree(prodDaemon(after)))
    diffs.push("production PM2 tree (daemon or child PIDs / start times) changed or missing");
  const listeners = (a) =>
    arr(a?.listeners).filter((l) => !STAGING_PORTS.has(Number(l.port))).map((l) => `${l.address}:${l.port}`).sort().join(",");
  if (listeners(before) !== listeners(after)) diffs.push("listening ports changed (outside the staging ports)");
  return diffs;
}

// ---------------------------------------------------------------- discovery, counts, loopback records
/** The ops test files, listed explicitly (forward slashes, sorted): works the same on Windows and elsewhere. */
export function discoverOpsTests(src) {
  const dir = path.join(src, "ops", "test");
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    fail("DISCOVERY", "ops/test cannot be read");
  }
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".test.mjs"))
    .map((e) => `ops/test/${e.name}`)
    .sort();
  if (!files.length) fail("DISCOVERY", "no ops/test/*.test.mjs files were found");
  return files;
}
export const opsTestArgs = (files) => [...OPS_TEST_FLAGS, ...files];

export function parseTap(text) {
  const n = (k) => Number((new RegExp(`^# ${k} (\\d+)$`, "m").exec(text) ?? [])[1] ?? NaN);
  return { tests: n("tests"), pass: n("pass"), fail: n("fail"), skipped: n("skipped"), todo: n("todo"), cancelled: n("cancelled") };
}
export function checkCounts({ total, passed, failed, skipped, todo }, expect) {
  const problems = [];
  if (total !== expect) problems.push(`expected ${expect} tests, found ${total}`);
  if (passed !== expect) problems.push(`${passed} passed`);
  if (failed) problems.push(`${failed} failed`);
  if (skipped) problems.push(`${skipped} skipped (a skipped suite is a failure in G0)`);
  if (todo) problems.push(`${todo} todo`);
  return problems;
}

/** Reads the loopback guard records of one step: every process must have been armed, none may have been refused. */
export function loopbackRecords(dir) {
  const lines = (f) => {
    try {
      return fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(Boolean);
    } catch {
      return [];
    }
  };
  return { armed: lines("armed.log").length, violations: lines("violations.log") };
}
export function checkLoopback(dir, step) {
  const r = loopbackRecords(dir);
  if (r.violations.length) fail("LOOPBACK", `${step}: ${r.violations.length} non-loopback listen / bind attempt(s) refused — see ${dir}`);
  if (!r.armed) fail("LOOPBACK", `${step}: the loopback guard was not armed in any process`);
  return r;
}

function resolveBin(pkgDir, name) {
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[name];
  if (!rel) throw new Error(`${name} has no bin entry`);
  return path.join(pkgDir, rel);
}
function arg(argv, name) {
  const end = argv.indexOf("--");
  const head = end >= 0 ? argv.slice(0, end) : argv;
  const i = head.indexOf(`--${name}`);
  return i >= 0 ? head[i + 1] : undefined;
}
const loadPg = (src) => createRequire(path.join(src, "backend", "package.json"))("pg");

/** I1–I4 before ANY connection or test. `database` = which database of the temporary instance to verify through. */
async function isolationChecks({ gates, src, needDatabase, database = G0.testDatabase }) {
  if (!gates || !src) fail("ARGS", "--gates and --src are required");
  if (!fs.existsSync(gates) || !fs.existsSync(src)) fail("ARGS", "--gates or --src does not exist");
  const hazards = inheritedHazards(process.env).filter((k) => k.toUpperCase() !== "TEST_DATABASE_URL");
  if (hazards.length) fail("ENV", `ambiguous inherited settings: ${hazards.join(", ")} (the runner must not pass them)`);
  const envFiles = findEnvFiles(src);
  if (envFiles.length) fail("I4", `.env files in the checkout: ${envFiles.join(", ")}`);
  if (!needDatabase) return { text: "I4 ok; no ambiguous inherited settings" };
  const testUrl = checkTestUrl(process.env.TEST_DATABASE_URL); // I2 before ANY connection
  const systemId = expectedSystemId();
  const url = new URL(testUrl.href);
  url.pathname = `/${database}`;
  const r = await checkServer({ url: url.href, gatesDir: gates, pg: loadPg(src), systemId, expect: { database, role: G0.superuser } });
  return {
    text: `I1–I4 ok (127.0.0.1:${r.port}, role ${r.role}, database ${r.database}, system identifier matches initdb, data directory inside gates, ${r.rules} scram-only hba rule(s))`,
    testUrl: testUrl.href,
    systemId,
  };
}

function stepDirs(gates, name) {
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(name ?? "")) fail("ARGS", "--name <step name> (a-z, 0-9, -) is required");
  const out = path.join(gates, "g0");
  const loop = path.join(out, "loopback", name);
  if (fs.existsSync(loop)) fail("ARGS", `step name ${name} was already used in this G0 folder`);
  fs.mkdirSync(loop, { recursive: true });
  return { out, loop };
}

async function main(argv) {
  const cmd = argv[0];
  const gates = arg(argv, "gates");
  const src = arg(argv, "src");
  const expect = Number(arg(argv, "expect"));
  const say = (l) => process.stdout.write(`[g0-guard] ${l}\n`);
  if (cmd === "compare") {
    const diffs = compareBaselines(readAudit(arg(argv, "before")), readAudit(arg(argv, "after")));
    if (diffs.length) fail("I5", diffs.join("; "));
    return say("I5 ok: production postmaster, database list, PM2 tree and listeners unchanged");
  }
  if (cmd === "check") return say((await isolationChecks({ gates, src, needDatabase: true })).text);
  if (cmd === "create-test-db") {
    const iso = await isolationChecks({ gates, src, needDatabase: true, database: "postgres" });
    say(iso.text);
    const pg = loadPg(src);
    const admin = new URL(iso.testUrl);
    admin.pathname = "/postgres";
    await assertDatabaseAbsent({ url: admin.href, pg, database: G0.testDatabase });
    const c = new pg.Client({ connectionString: admin.href, connectionTimeoutMillis: 5000 });
    await c.connect();
    try {
      await c.query(`CREATE DATABASE "${G0.testDatabase}"`);
    } finally {
      await c.end().catch(() => {});
    }
    return say(`${G0.testDatabase} created on the temporary instance (verified identity; it did not exist before)`);
  }
  if (cmd === "exec") {
    const target = arg(argv, "target");
    const sep = argv.indexOf("--");
    const [script, ...rest] = sep >= 0 ? argv.slice(sep + 1) : [];
    if (!script || !/\.(c|m)?js$/i.test(script)) fail("ARGS", "exec needs -- <node script> [args…] (node scripts only: no shell)");
    const iso = await isolationChecks({ gates, src, needDatabase: target === "test" });
    say(`${iso.text}; target ${target}`);
    const { loop } = stepDirs(gates, arg(argv, "name"));
    const env = childEnv(process.env, { target, testUrl: iso.testUrl, gates, systemId: iso.systemId, loopbackDir: loop });
    const r = spawnSync(process.execPath, [script, ...rest], { cwd: process.cwd(), env, stdio: "inherit" });
    const lb = checkLoopback(loop, arg(argv, "name"));
    if (r.status !== 0) fail("STEP", `${path.basename(script)} exited ${r.status ?? r.signal}`);
    return say(`ok (loopback guard armed in ${lb.armed} process(es), 0 refused)`);
  }
  if (!Number.isInteger(expect) || expect <= 0) fail("ARGS", "--expect <exact test count> is required");
  if (cmd === "backend-tests" || cmd === "frontend-tests") {
    const ws = cmd === "backend-tests" ? "backend" : "frontend";
    const iso = await isolationChecks({ gates, src, needDatabase: ws === "backend" });
    say(iso.text);
    const { out, loop } = stepDirs(gates, `${ws}-tests`);
    const env = childEnv(process.env, { target: ws === "backend" ? "test" : "none", testUrl: iso.testUrl, gates, systemId: iso.systemId, loopbackDir: loop });
    const report = path.join(out, `${ws}-vitest.json`);
    if (fs.existsSync(report)) fail("ARGS", `${report} already exists (a G0 folder is used once)`);
    const bin = resolveBin(path.join(src, ws, "node_modules", "vitest"), "vitest");
    const r = spawnSync(process.execPath, [bin, ...VITEST_FLAGS, "--reporter=default", "--reporter=json", `--outputFile=${report}`], { cwd: path.join(src, ws), env, stdio: "inherit" });
    if (!fs.existsSync(report)) fail("COUNTS", `${ws}: no test report was written (exit ${r.status})`);
    const j = JSON.parse(fs.readFileSync(report, "utf8"));
    const problems = checkCounts({ total: j.numTotalTests, passed: j.numPassedTests, failed: j.numFailedTests, skipped: j.numPendingTests, todo: j.numTodoTests }, expect);
    if (r.status !== 0) problems.push(`vitest exit ${r.status}`);
    if (problems.length) fail("COUNTS", `${ws}: ${problems.join("; ")}`);
    const lb = checkLoopback(loop, `${ws}-tests`);
    return say(`${ws}: ${expect}/${expect} passed, 0 skipped; loopback guard armed in ${lb.armed} process(es), 0 refused`);
  }
  if (cmd === "ops-tests") {
    const iso = await isolationChecks({ gates, src, needDatabase: true });
    say(iso.text);
    const files = discoverOpsTests(src);
    say(`ops: ${files.length} test files discovered: ${files.join(", ")}`);
    const { loop } = stepDirs(gates, "ops-tests");
    const env = childEnv(process.env, { target: "test", testUrl: iso.testUrl, gates, systemId: iso.systemId, loopbackDir: loop });
    const r = spawnSync(process.execPath, opsTestArgs(files), { cwd: src, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(redact(r.stdout ?? ""));
    process.stderr.write(redact(r.stderr ?? ""));
    const t = parseTap(r.stdout ?? "");
    const problems = checkCounts({ total: t.tests, passed: t.pass, failed: t.fail, skipped: t.skipped, todo: t.todo }, expect);
    if (t.cancelled) problems.push(`${t.cancelled} cancelled`);
    if (r.status !== 0) problems.push(`node --test exit ${r.status}`);
    if (problems.length) fail("COUNTS", `ops: ${problems.join("; ")}`);
    const lb = checkLoopback(loop, "ops-tests");
    return say(`ops: ${expect}/${expect} passed, 0 skipped; loopback guard armed in ${lb.armed} process(es), 0 refused`);
  }
  fail("ARGS", "unknown command (check | create-test-db | exec | backend-tests | frontend-tests | ops-tests | compare)");
}

if (process.argv[1] && path.basename(process.argv[1]) === "g0-guard.mjs") {
  main(process.argv.slice(2)).then(
    () => process.exit(0),
    (err) => {
      process.stderr.write(`[g0-guard] REFUSED ${err.guard ?? "ERROR"}: ${redact(err.message)}\n`);
      process.exit(1);
    },
  );
}
