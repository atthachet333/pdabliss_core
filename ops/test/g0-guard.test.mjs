// EP48.5 A-0 / A-0.1 — tests for the G0 isolation guard (I1–I5), explicit database targets, ops test discovery,
// loopback records and count enforcement. Node built-ins only; no database, no network listener.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  G0, GuardFailure, OPS_TEST_FLAGS, PRELOAD, STATIC_DATABASE_URL, VITEST_FLAGS, assertDatabaseAbsent, checkCounts, checkLoopback,
  checkServer, checkTarget, checkTestUrl, childEnv, compareBaselines, discoverOpsTests, evaluateServer, expectedSystemId,
  findEnvFiles, inheritedHazards, opsTestArgs, parseTap,
} from "../ep48_5/g0-guard.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SYSID = "7438291045566778899";
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const failsWith = (fn, guard) =>
  assert.throws(fn, (e) => {
    assert.ok(e instanceof GuardFailure, e.message);
    assert.equal(e.guard, guard);
    return true;
  });

test("I2: only postgresql://gate@127.0.0.1:55443/pdabliss_core_test is accepted", () => {
  checkTestUrl("postgresql://gate:pw@127.0.0.1:55443/pdabliss_core_test");
  for (const bad of [
    undefined, "",
    "postgresql://gate:pw@127.0.0.1:5432/pdabliss_core_test", // the shared cluster
    "postgresql://gate:pw@127.0.0.1:5432/pda_one_test", // PDA ONE's test database on the shared cluster
    "postgresql://gate:pw@127.0.0.1:55443/pda_one_test",
    "postgresql://gate:pw@127.0.0.1:55443/pda_one_prod",
    "postgresql://gate:pw@127.0.0.1:55443/pdabliss_property",
    "postgresql://gate:pw@localhost:55443/pdabliss_core_test",
    "postgresql://gate:pw@127.0.0.1/pdabliss_core_test", // no port = 5432
    "postgresql://gate:pw@127.0.0.1:55443,127.0.0.1:5432/pdabliss_core_test", // host list
    "postgresql://gate:pw@127.0.0.1:55443/pdabliss_core_staging_test",
    "postgresql://gate:pw@127.0.0.1:55443/pdabliss_core_test?host=127.0.0.1&port=5432",
    "postgresql://postgres:pw@127.0.0.1:55443/pdabliss_core_test", // not the G0 bootstrap role
    "postgres://gate:pw@127.0.0.1:55443/pdabliss_core_test",
  ])
    failsWith(() => checkTestUrl(bad), "I2");
});

test("I2: the failure message never contains the password", () => {
  assert.throws(() => checkTestUrl("postgresql://gate:SECRET77@127.0.0.1:5432/x"), (e) => !e.message.includes("SECRET77"));
});

test("checkTarget: database and role must be the expected ones; regex databases allowed", () => {
  const url = "postgresql://core_owner:pw@127.0.0.1:55443/pdabliss_core_g0_migrate";
  checkTarget(url, { label: "x", databases: ["pdabliss_core_g0_migrate"], roles: ["core_owner"] });
  checkTarget(url, { label: "x", databases: /^pdabliss_core_g0_/, roles: ["core_owner"] });
  failsWith(() => checkTarget(url, { label: "x", databases: ["pdabliss_core_g0_migrate"], roles: ["core_app"] }), "I2");
  failsWith(() => checkTarget(url, { label: "x", databases: ["other"], roles: ["core_owner"] }), "I2");
  failsWith(() => checkTarget(url.replace("55443", "5433"), { label: "x", databases: /./, roles: ["core_owner"] }), "I2");
});

test("I3 input: the instance identity (system identifier) is required", () => {
  assert.equal(expectedSystemId({ CORE_G0_PG_SYSID: SYSID }), SYSID);
  for (const v of [undefined, "", "abc", "123", `${SYSID} `]) failsWith(() => expectedSystemId({ CORE_G0_PG_SYSID: v }), "I3");
});

test("I4: .env / .env.* anywhere in the checkout (outside node_modules / .git) are found; .env.example is not", () => {
  const src = tmp("g0-src-");
  fs.mkdirSync(path.join(src, "backend", "node_modules", "x"), { recursive: true });
  fs.mkdirSync(path.join(src, ".git"), { recursive: true });
  fs.writeFileSync(path.join(src, "backend", ".env.example"), "");
  fs.writeFileSync(path.join(src, "backend", "node_modules", "x", ".env"), "");
  fs.writeFileSync(path.join(src, ".git", ".env"), "");
  assert.deepEqual(findEnvFiles(src), []);
  fs.writeFileSync(path.join(src, "backend", ".env.test"), "TEST_DATABASE_URL=x");
  fs.writeFileSync(path.join(src, ".env"), "");
  assert.deepEqual(findEnvFiles(src).sort(), [".env", path.join("backend", ".env.test")].sort());
});

function serverFacts(gates, patch = {}, settingsPatch = {}) {
  const d = path.join(gates, "pg");
  fs.mkdirSync(d, { recursive: true });
  return {
    settings: { p: 55443, a: "127.0.0.1", u: "gate", db: "pdabliss_core_test", sid: SYSID, d, l: "127.0.0.1", pe: "scram-sha-256", ...settingsPatch },
    hba: [{ type: "host", auth_method: "scram-sha-256", error: null }, { type: "local", auth_method: "scram-sha-256", error: null }],
    databases: ["postgres", "template0", "template1", "pdabliss_core_test"],
    gatesDir: gates,
    systemId: SYSID,
    ...patch,
  };
}

test("I1 / I3: the temporary instance is accepted; every deviation (address, identity, role, database, …) is refused", () => {
  const gates = tmp("g0-gates-");
  evaluateServer(serverFacts(gates));
  evaluateServer(serverFacts(gates, { expect: { database: "postgres", role: "gate" } }, { db: "postgres" }));
  const s = (p) => serverFacts(gates, {}, p);
  failsWith(() => evaluateServer(s({ p: 5432 })), "I3");
  failsWith(() => evaluateServer(s({ a: "10.0.0.5" })), "I3");
  failsWith(() => evaluateServer(s({ sid: "7000000000000000001" })), "I3"); // another cluster (e.g. the shared one)
  failsWith(() => evaluateServer(serverFacts(gates, { systemId: undefined })), "I3");
  failsWith(() => evaluateServer(s({ u: "postgres" })), "I3");
  failsWith(() => evaluateServer(s({ db: "pda_one_test" })), "I3");
  failsWith(() => evaluateServer(s({ l: "*" })), "I1");
  failsWith(() => evaluateServer(s({ l: "127.0.0.1,::1" })), "I1");
  failsWith(() => evaluateServer(s({ pe: "md5" })), "I1");
  const f = serverFacts(gates);
  for (const m of ["trust", "md5", "password", "peer", "ident"])
    failsWith(() => evaluateServer({ ...f, hba: [...f.hba, { type: "host", auth_method: m, error: null }] }), "I1");
  failsWith(() => evaluateServer({ ...f, hba: [{ type: "host", auth_method: "scram-sha-256", error: "bad line" }] }), "I1");
  failsWith(() => evaluateServer({ ...f, hba: [] }), "I1");
  failsWith(() => evaluateServer(s({ d: tmp("elsewhere-") })), "I3");
  for (const prod of ["pda_one_test", "pda_one_prod", "pdabliss_property", "pdabliss_staging"])
    failsWith(() => evaluateServer({ ...f, databases: [...f.databases, prod] }), "I3");
});

/** A node-postgres stand-in answering the guard's queries. */
function fakePg(facts, log = []) {
  return {
    Client: class {
      constructor(o) {
        log.push(o.connectionString);
      }
      async connect() {}
      async query(sql, params) {
        if (/pg_control_system/.test(sql)) return { rows: [facts.settings] };
        if (/pg_hba_file_rules/.test(sql)) return { rows: facts.hba };
        if (/SELECT datname FROM pg_database$/.test(sql)) return { rows: facts.databases.map((datname) => ({ datname })) };
        if (/WHERE datname = \$1/.test(sql)) return { rowCount: facts.databases.includes(params[0]) ? 1 : 0, rows: [] };
        throw new Error(`unexpected query ${sql}`);
      }
      async end() {}
    },
  };
}

test("checkServer asks for address, role, database and system identifier; refuses without an expected identity", async () => {
  const gates = tmp("g0-gates-");
  const facts = serverFacts(gates);
  const r = await checkServer({ url: "postgresql://gate:pw@127.0.0.1:55443/pdabliss_core_test", gatesDir: gates, pg: fakePg(facts), systemId: SYSID });
  assert.equal(r.role, "gate");
  assert.equal(r.database, "pdabliss_core_test");
  await assert.rejects(checkServer({ url: "x", gatesDir: gates, pg: fakePg(facts), systemId: undefined }), (e) => e.guard === "I3");
});

test("collision: a database that already exists is never reused", async () => {
  const facts = { databases: ["postgres", "pdabliss_core_test"] };
  await assertDatabaseAbsent({ url: "u", pg: fakePg(facts), database: "pdabliss_core_launcher_g0_0a1b2c3d" });
  await assert.rejects(assertDatabaseAbsent({ url: "u", pg: fakePg(facts), database: "pdabliss_core_test" }), (e) => e.guard === "COLLISION");
});

test("explicit targets: ambiguous inherited settings are detected and never reach a child", () => {
  const base = { PATH: "p", PGHOST: "10.0.0.5", PgPort: "5432", PGPASSWORD: "x", DATABASE_URL: "postgresql://a@127.0.0.1:5432/pda_one_test", DIRECT_URL: "d", SHADOW_DATABASE_URL: "s", NODE_OPTIONS: "--inspect", CORE_G0_GATES: "old", VITE_API_URL: "keep" };
  assert.deepEqual(inheritedHazards(base), ["DATABASE_URL", "DIRECT_URL", "NODE_OPTIONS", "PGHOST", "PGPASSWORD", "PgPort", "SHADOW_DATABASE_URL"]);
  const url = "postgresql://gate:pw@127.0.0.1:55443/pdabliss_core_test";
  const gates = tmp("g0-gates-");
  const common = { testUrl: url, gates, systemId: SYSID, loopbackDir: gates };
  const none = childEnv(base, { target: "none", ...common });
  const stat = childEnv(base, { target: "static", ...common });
  const tst = childEnv(base, { target: "test", ...common });
  for (const e of [none, stat, tst]) {
    assert.equal(Object.keys(e).filter((k) => /^PG/i.test(k) || /^(DIRECT_URL|SHADOW_DATABASE_URL)$/.test(k)).length, 0);
    assert.equal(e.NODE_OPTIONS, `--import=${pathToFileURL(PRELOAD).href}`);
    assert.equal(e.CORE_G0_GATES, path.resolve(gates));
    assert.equal(e.CORE_G0_PG_SYSID, SYSID);
    assert.equal(e.VITE_API_URL, "keep");
  }
  assert.equal(none.DATABASE_URL, undefined);
  assert.equal(none.TEST_DATABASE_URL, undefined);
  assert.equal(stat.DATABASE_URL, STATIC_DATABASE_URL);
  assert.equal(stat.TEST_DATABASE_URL, undefined);
  assert.equal(tst.DATABASE_URL, undefined, "the test target never sets DATABASE_URL (the backend setup passes it explicitly)");
  assert.equal(tst.TEST_DATABASE_URL, url);
  assert.match(STATIC_DATABASE_URL, /^postgresql:\/\/g0-static@127\.0\.0\.1:55443\/g0_no_such_database$/);
  failsWith(() => childEnv(base, { target: "test", ...common, testUrl: "postgresql://gate:pw@127.0.0.1:5432/pda_one_test" }), "I2");
  failsWith(() => childEnv(base, { target: "prod", ...common }), "ARGS");
  assert.ok(fs.existsSync(PRELOAD), "the loopback preload exists");
});

function audit({ pmPid = 5764, pmStart = "2026-11-15T18:38:04", dbs = ["pda_one_prod", "postgres"], childStart = "2026-11-15T18:39:11", listeners = [["0.0.0.0", 9898]] } = {}) {
  return {
    postgres: { postmasterPid: pmPid, postmasterStarted: pmStart, result: { databases: { value: dbs.map((name) => ({ name })) } } },
    pm2: { daemons: [
      { pid: 18776, owner: "S2A-SERVER\\user", started: "x", apps: [] },
      { pid: 2228, owner: "NT AUTHORITY\\SYSTEM", started: "2026-11-15T18:39:09", apps: [{ pid: 7712, started: childStart }] },
    ] },
    listeners: listeners.map(([address, port]) => ({ address, port })),
  };
}

test("I5: unchanged baselines pass; staging ports may appear", () => {
  assert.deepEqual(compareBaselines(audit(), audit()), []);
  const after = audit({ listeners: [["0.0.0.0", 9898], ["127.0.0.1", 1311], ["127.0.0.1", 1312], ["127.0.0.1", 5433]] });
  assert.deepEqual(compareBaselines(audit(), after), []);
});

test("I5: postmaster, database list, production PM2 tree and other listeners are compared", () => {
  assert.equal(compareBaselines(audit(), audit({ pmPid: 9999 })).length, 1);
  assert.equal(compareBaselines(audit(), audit({ pmStart: "later" })).length, 1);
  assert.equal(compareBaselines(audit(), audit({ dbs: ["pda_one_prod", "postgres", "pdabliss_core_test"] })).length, 1);
  assert.equal(compareBaselines(audit(), audit({ childStart: "restarted" })).length, 1);
  assert.equal(compareBaselines(audit(), audit({ listeners: [["0.0.0.0", 9898], ["0.0.0.0", 55443]] })).length, 0);
  assert.equal(compareBaselines(audit(), audit({ listeners: [] })).length, 1);
  const noDaemon = audit();
  noDaemon.pm2.daemons = [];
  assert.ok(compareBaselines(noDaemon, noDaemon).length >= 1, "a missing baseline is never a pass");
});

test("counts: exact total, all passed, zero failed / skipped / todo", () => {
  assert.deepEqual(checkCounts({ total: 611, passed: 611, failed: 0, skipped: 0, todo: 0 }, 611), []);
  assert.ok(checkCounts({ total: 540, passed: 540, failed: 0, skipped: 71, todo: 0 }, 611).length >= 2);
  assert.ok(checkCounts({ total: 611, passed: 610, failed: 1, skipped: 0, todo: 0 }, 611).length >= 1);
  assert.ok(checkCounts({ total: 611, passed: 611, failed: 0, skipped: 0, todo: 1 }, 611).length >= 1);
  assert.ok(checkCounts({ total: 76, passed: 75, failed: 0, skipped: 1, todo: 0 }, 76).some((p) => /skipped/.test(p)), "a skipped T10 fails G0");
});

test("parseTap reads node --test summary counts", () => {
  const t = parseTap("TAP version 13\n# tests 51\n# suites 0\n# pass 50\n# fail 0\n# cancelled 0\n# skipped 1\n# todo 0\n");
  assert.deepEqual(t, { tests: 51, pass: 50, fail: 0, skipped: 1, todo: 0, cancelled: 0 });
});

test("concurrency: two workers for vitest (forks) and node --test", () => {
  assert.ok(VITEST_FLAGS.includes("--maxWorkers=2") && VITEST_FLAGS.includes("--pool=forks"));
  assert.ok(OPS_TEST_FLAGS.includes("--test-concurrency=2"));
});

test("REGRESSION (C-A0 V-1): ops tests are passed as explicit files, never a directory, and really run", () => {
  const dir = tmp("g0-ops-");
  fs.mkdirSync(path.join(dir, "ops", "test", "sub"), { recursive: true });
  fs.writeFileSync(path.join(dir, "ops", "test", "x.test.mjs"), 'import { test } from "node:test"; test("a", () => {}); test("b", () => {});');
  fs.writeFileSync(path.join(dir, "ops", "test", "helper.mjs"), "export const notATest = 1;");
  fs.writeFileSync(path.join(dir, "ops", "test", "x.test.mjs.bak"), "throw 1;");
  fs.writeFileSync(path.join(dir, "ops", "test", "sub", "y.test.mjs"), "throw 1;");
  const files = discoverOpsTests(dir);
  assert.deepEqual(files, ["ops/test/x.test.mjs"]);
  const args = opsTestArgs(files);
  for (const a of args.slice(OPS_TEST_FLAGS.length)) assert.ok(fs.statSync(path.join(dir, a)).isFile(), `${a} must be a file, not a directory`);
  assert.ok(!args.some((a) => /[\\/]$/.test(a) || a === "ops/test"), "no directory argument");
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
  const t = parseTap(r.stdout);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual([t.tests, t.pass, t.fail, t.skipped], [2, 2, 0, 0]);
  failsWith(() => discoverOpsTests(tmp("g0-empty-")), "DISCOVERY");
});

test("REGRESSION (C-A0 V-1): this repository's ops test files are all discovered", () => {
  const files = discoverOpsTests(REPO);
  const onDisk = fs.readdirSync(path.join(REPO, "ops", "test")).filter((n) => n.endsWith(".test.mjs")).map((n) => `ops/test/${n}`).sort();
  assert.deepEqual(files, onDisk);
  for (const f of ["ops/test/ops.test.mjs", "ops/test/staging-launch.test.mjs", "ops/test/staging-launch.g0.test.mjs", "ops/test/g0-guard.test.mjs", "ops/test/g0-loopback.test.mjs", "ops/test/g0-preflight.test.mjs"])
    assert.ok(files.includes(f), `${f} is discovered`);
});

test("loopback records: a refused attempt or an unarmed step fails the step", () => {
  const ok = tmp("g0-lb-");
  fs.writeFileSync(path.join(ok, "armed.log"), '{"pid":1}\n{"pid":2}\n');
  assert.equal(checkLoopback(ok, "s").armed, 2);
  failsWith(() => checkLoopback(tmp("g0-lb-"), "s"), "LOOPBACK");
  const bad = tmp("g0-lb-");
  fs.writeFileSync(path.join(bad, "armed.log"), '{"pid":1}\n');
  fs.writeFileSync(path.join(bad, "violations.log"), '{"pid":1,"host":"0.0.0.0"}\n');
  failsWith(() => checkLoopback(bad, "s"), "LOOPBACK");
});

test("G0 constants: the temporary instance only", () => {
  assert.deepEqual({ ...G0 }, { host: "127.0.0.1", port: 55443, testDatabase: "pdabliss_core_test", superuser: "gate" });
});
