#!/usr/bin/env node
// PDA BLISS CORE — EP48.5 G0 isolation guard (docs/EP48_5_DEPLOYMENT_PLAN.md §4, guards I1–I5).
//
// G0 runs the database test suites ONLY through this script. It checks the isolation of the temporary test PostgreSQL
// BEFORE anything connects to it, then runs the suite and enforces exact test counts with zero skipped.
//
//   node ops\ep48_5\g0-guard.mjs check          --gates <dir> --src <checkout>                 (I1–I4)
//   node ops\ep48_5\g0-guard.mjs backend-tests  --gates <dir> --src <checkout> --expect 611     (I1–I4, then vitest)
//   node ops\ep48_5\g0-guard.mjs frontend-tests --gates <dir> --src <checkout> --expect 1192    (I4, then vitest)
//   node ops\ep48_5\g0-guard.mjs ops-tests      --gates <dir> --src <checkout> --expect <n>    (I1–I4, then node --test)
//   node ops\ep48_5\g0-guard.mjs compare        --before <host-audit.json> --after <host-audit.json>   (I5)
//
// TEST_DATABASE_URL comes from the session environment; it is never printed. Exit 0 = pass, 1 = refused / failed.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { isInside, redact } from "./launch-common.mjs";

export const G0 = Object.freeze({ host: "127.0.0.1", port: 55443, testDatabase: "pdabliss_core_test" });
/** Databases that exist only on the shared production cluster: seeing one means we are on the wrong server. */
const PRODUCTION_FINGERPRINT = /^(pda_one_.*|pdabliss_property|pdabliss_staging)$/;
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

/** I2: the test URL must name exactly 127.0.0.1:55443/pdabliss_core_test (the test setup resets that database). */
export function checkTestUrl(value) {
  if (!value) fail("I2", "TEST_DATABASE_URL is not set");
  let u;
  try {
    u = new URL(value);
  } catch {
    fail("I2", "TEST_DATABASE_URL is not a valid URL");
  }
  if (u.protocol !== "postgresql:" || u.hostname !== G0.host || u.port !== String(G0.port) || u.pathname !== `/${G0.testDatabase}` || u.search !== "" || u.hash !== "")
    fail("I2", "TEST_DATABASE_URL must be postgresql://…@127.0.0.1:55443/pdabliss_core_test with no parameters");
  return u;
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

/** I1 + I3: ask the server who it is, through the (already I2-checked) URL. `pg` is node-postgres. */
export async function checkServer({ url, gatesDir, pg }) {
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  await c.connect();
  try {
    const s = (
      await c.query(
        "SELECT inet_server_port() AS p, current_setting('data_directory') AS d, current_setting('listen_addresses') AS l, current_setting('password_encryption') AS pe",
      )
    ).rows[0];
    const hba = (await c.query("SELECT type, auth_method, error FROM pg_hba_file_rules")).rows;
    const dbs = (await c.query("SELECT datname FROM pg_database")).rows.map((r) => r.datname);
    return evaluateServer({ settings: s, hba, databases: dbs, gatesDir });
  } finally {
    await c.end().catch(() => {});
  }
}

/** Pure evaluation of the server facts (unit-tested). */
export function evaluateServer({ settings, hba, databases, gatesDir }) {
  if (Number(settings?.p) !== G0.port) fail("I3", "the server answering is not on port 55443");
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
  return { port: G0.port, dataDir, rules: hba.length };
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

// ---------------------------------------------------------------- suite runners with exact counts and zero skipped
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
function resolveBin(pkgDir, name) {
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[name];
  if (!rel) throw new Error(`${name} has no bin entry`);
  return path.join(pkgDir, rel);
}

function arg(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function isolationChecks({ gates, src, needDatabase }) {
  if (!gates || !src) fail("ARGS", "--gates and --src are required");
  if (!fs.existsSync(gates) || !fs.existsSync(src)) fail("ARGS", "--gates or --src does not exist");
  const envFiles = findEnvFiles(src);
  if (envFiles.length) fail("I4", `.env files in the checkout: ${envFiles.join(", ")}`);
  if (!needDatabase) return "I4 ok";
  const url = checkTestUrl(process.env.TEST_DATABASE_URL); // I2 before ANY connection
  const pg = createRequire(path.join(src, "backend", "package.json"))("pg");
  const r = await checkServer({ url: url.href, gatesDir: gates, pg });
  return `I1–I4 ok (server port ${r.port}, data directory inside gates, ${r.rules} scram-only hba rule(s))`;
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
  if (cmd === "check") return say(await isolationChecks({ gates, src, needDatabase: true }));
  if (!Number.isInteger(expect) || expect <= 0) fail("ARGS", "--expect <exact test count> is required");
  const outDir = path.join(gates, "g0");
  fs.mkdirSync(outDir, { recursive: true });
  const env = { ...process.env, CORE_G0: "1", CORE_G0_GATES: path.resolve(gates) };
  if (cmd === "backend-tests" || cmd === "frontend-tests") {
    const ws = cmd === "backend-tests" ? "backend" : "frontend";
    say(await isolationChecks({ gates, src, needDatabase: ws === "backend" }));
    if (ws === "frontend") delete env.TEST_DATABASE_URL;
    const out = path.join(outDir, `${ws}-vitest.json`);
    fs.rmSync(out, { force: true });
    const bin = resolveBin(path.join(src, ws, "node_modules", "vitest"), "vitest");
    const r = spawnSync(process.execPath, [bin, "run", "--maxWorkers=2", "--reporter=default", "--reporter=json", `--outputFile=${out}`], { cwd: path.join(src, ws), env, stdio: "inherit" });
    if (!fs.existsSync(out)) fail("COUNTS", `${ws}: no test report was written (exit ${r.status})`);
    const j = JSON.parse(fs.readFileSync(out, "utf8"));
    const problems = checkCounts({ total: j.numTotalTests, passed: j.numPassedTests, failed: j.numFailedTests, skipped: j.numPendingTests, todo: j.numTodoTests }, expect);
    if (r.status !== 0) problems.push(`vitest exit ${r.status}`);
    if (problems.length) fail("COUNTS", `${ws}: ${problems.join("; ")}`);
    return say(`${ws}: ${expect}/${expect} passed, 0 skipped`);
  }
  if (cmd === "ops-tests") {
    say(await isolationChecks({ gates, src, needDatabase: true }));
    const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "ops/test/"], { cwd: src, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(redact(r.stdout ?? ""));
    process.stderr.write(redact(r.stderr ?? ""));
    const t = parseTap(r.stdout ?? "");
    const problems = checkCounts({ total: t.tests, passed: t.pass, failed: t.fail, skipped: t.skipped, todo: t.todo }, expect);
    if (t.cancelled) problems.push(`${t.cancelled} cancelled`);
    if (r.status !== 0) problems.push(`node --test exit ${r.status}`);
    if (problems.length) fail("COUNTS", `ops: ${problems.join("; ")}`);
    return say(`ops: ${expect}/${expect} passed, 0 skipped`);
  }
  fail("ARGS", "unknown command (check | backend-tests | frontend-tests | ops-tests | compare)");
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
