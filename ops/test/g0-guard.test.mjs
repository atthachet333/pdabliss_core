// EP48.5 A-0 — tests for the G0 isolation guard (I1–I5) and its count enforcement. Node built-ins only.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { GuardFailure, checkCounts, checkTestUrl, compareBaselines, evaluateServer, findEnvFiles, parseTap } from "../ep48_5/g0-guard.mjs";

const failsWith = (fn, guard) =>
  assert.throws(fn, (e) => {
    assert.ok(e instanceof GuardFailure);
    assert.equal(e.guard, guard);
    return true;
  });

test("I2: only postgresql://…@127.0.0.1:55443/pdabliss_core_test is accepted", () => {
  checkTestUrl("postgresql://gate:pw@127.0.0.1:55443/pdabliss_core_test");
  for (const bad of [
    undefined, "",
    "postgresql://gate:pw@127.0.0.1:5432/pdabliss_core_test", // the shared cluster
    "postgresql://gate:pw@127.0.0.1:5432/pda_one_test", // PDA ONE's test database on the shared cluster
    "postgresql://gate:pw@127.0.0.1:55443/pda_one_test",
    "postgresql://gate:pw@localhost:55443/pdabliss_core_test",
    "postgresql://gate:pw@127.0.0.1:55443/pdabliss_core_staging_test",
    "postgresql://gate:pw@127.0.0.1:55443/pdabliss_core_test?host=127.0.0.1&port=5432",
    "postgres://gate:pw@127.0.0.1:55443/pdabliss_core_test",
  ])
    failsWith(() => checkTestUrl(bad), "I2");
});

test("I2: the failure message never contains the password", () => {
  assert.throws(() => checkTestUrl("postgresql://gate:SECRET77@127.0.0.1:5432/x"), (e) => !e.message.includes("SECRET77"));
});

test("I4: .env / .env.* anywhere in the checkout (outside node_modules / .git) are found; .env.example is not", () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "g0-src-"));
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

function serverFacts(gates, patch = {}) {
  const d = path.join(gates, "pg");
  fs.mkdirSync(d, { recursive: true });
  return {
    settings: { p: 55443, d, l: "127.0.0.1", pe: "scram-sha-256" },
    hba: [{ type: "host", auth_method: "scram-sha-256", error: null }, { type: "local", auth_method: "scram-sha-256", error: null }],
    databases: ["postgres", "template0", "template1", "pdabliss_core_test"],
    gatesDir: gates,
    ...patch,
  };
}

test("I1 / I3: the temporary instance is accepted; every deviation is refused", () => {
  const gates = fs.mkdtempSync(path.join(os.tmpdir(), "g0-gates-"));
  evaluateServer(serverFacts(gates));
  const f = serverFacts(gates);
  failsWith(() => evaluateServer({ ...f, settings: { ...f.settings, p: 5432 } }), "I3");
  failsWith(() => evaluateServer({ ...f, settings: { ...f.settings, l: "*" } }), "I1");
  failsWith(() => evaluateServer({ ...f, settings: { ...f.settings, l: "127.0.0.1,::1" } }), "I1");
  failsWith(() => evaluateServer({ ...f, settings: { ...f.settings, pe: "md5" } }), "I1");
  for (const m of ["trust", "md5", "password", "peer", "ident"])
    failsWith(() => evaluateServer({ ...f, hba: [...f.hba, { type: "host", auth_method: m, error: null }] }), "I1");
  failsWith(() => evaluateServer({ ...f, hba: [{ type: "host", auth_method: "scram-sha-256", error: "bad line" }] }), "I1");
  failsWith(() => evaluateServer({ ...f, hba: [] }), "I1");
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "elsewhere-"));
  failsWith(() => evaluateServer({ ...f, settings: { ...f.settings, d: outside } }), "I3");
  for (const prod of ["pda_one_test", "pda_one_prod", "pdabliss_property", "pdabliss_staging"])
    failsWith(() => evaluateServer({ ...f, databases: [...f.databases, prod] }), "I3");
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
});

test("parseTap reads node --test summary counts", () => {
  const t = parseTap("TAP version 13\n# tests 51\n# suites 0\n# pass 50\n# fail 0\n# cancelled 0\n# skipped 1\n# todo 0\n");
  assert.deepEqual(t, { tests: 51, pass: 50, fail: 0, skipped: 1, todo: 0, cancelled: 0 });
});
