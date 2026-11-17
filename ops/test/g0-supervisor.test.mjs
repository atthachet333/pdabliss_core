// EP48.5 G0 incident amendment (incident g0-20261117-134458) — regression tests R1–R12 for the supervisor, the
// runner's process handling and the PowerShell variable rules. Built-ins only; real processes are this test's own;
// the only listener is a 127.0.0.1 HTTP server; production is synthetic (test-facts.mjs filters the host's out).
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkRunner, psVariableProblems } from "../ep48_5/g0-preflight.mjs";
import {
  LIMITS, buildHttpBaseline, describeExitCode, evaluateRound, evaluateTempPg, finalComparison, freshFindings, g0ProcessIds, identifyProduction,
  latencyLimit, normalizeFacts, normalizeHttpBaseline, planStopTree, executeStopTree, probeHost, runMonitor, toInt, validateBaseline, validateHttpBaseline,
} from "../ep48_5/g0-supervisor.mjs";
import { createdOf, isAlive as testIsAlive, realProcesses } from "./g0-fixtures/test-facts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const FX = path.join(HERE, "g0-fixtures", "incident-20261117");
const SUPERVISOR = path.join(REPO, "ops", "ep48_5", "g0-supervisor.mjs");
const TEST_FACTS = path.join(HERE, "g0-fixtures", "test-facts.mjs");
const G0_DIR = "D:\\pdabliss-core-staging\\gates\\g0-20261117-134458";
const read = (f) => fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "");
const legacy = JSON.parse(read(path.join(FX, "baseline.json")));
const incidentFacts = () => normalizeFacts(JSON.parse(read(path.join(FX, "facts.json"))));
const incidentBaseline = () => ({ tree: legacy.tree, infra: legacy.infra, http: normalizeHttpBaseline(legacy.http, legacy.listeners), listeners: legacy.listeners, tempPgPort: 55443 });
const healthyProbes = (b, ms = 2) => new Map(b.http.map((e) => [e.appPort, { status: e.status, ms }]));
const incidentCtx = () => ({ tempPgPort: 55443, g0Dir: G0_DIR, g0Pids: g0ProcessIds(incidentFacts(), { runnerPid: 23604, runnerCreated: "2026-11-17T13:44:58.5412670+07:00", g0Dir: G0_DIR }) });
const harness = (n) => read(path.join(REPO, "ops", "ep48_5", "g0-harness", n));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms, step = 200) {
  for (let t = 0; t < ms; t += step) {
    if (await fn()) return true;
    await sleep(step);
  }
  return Boolean(await fn());
}

// ---------------------------------------------------------------- R1 PowerShell case-insensitive variable collision
test("R1 the incident monitor's $Port / $port collision is detected; every current PowerShell script is clean", () => {
  const incident = psVariableProblems(read(path.join(FX, "g0-monitor.e784ca1.ps1.txt")), "incident");
  assert.ok(incident.some((p) => /Port \/ port/.test(p)), "two spellings of one variable");
  assert.ok(incident.some((p) => /foreach variable \$port reuses a script parameter/.test(p)), "loop variable reuses the parameter");
  for (const f of ["Run-G0.ps1", "g0-common.ps1", "g0-facts.ps1", "Preflight-G0.ps1", "Test-G0Harness.ps1"]) assert.deepEqual(psVariableProblems(harness(f), f), [], f);
  assert.deepEqual(psVariableProblems(read(path.join(REPO, "ops", "ep48_5", "Collect-HostAudit.ps1")), "collector"), []);
  assert.ok(!fs.existsSync(path.join(REPO, "ops", "ep48_5", "g0-harness", "g0-monitor.ps1")), "the PowerShell monitor is retired");
  assert.match(read(path.join(FX, "ps-collision-repro.ps1.txt")), /foreach \(\$port in \$http\.Keys\)/, "the PS 5.1 reproduction (Test-G0Harness P1) is present");
  assert.match(harness("Run-G0.ps1"), /^\$TempPgPort = 55443$/m, "the temporary port has its own descriptive name");
});

// ---------------------------------------------------------------- R2 integer versus string baseline keys
test("R2 baseline keys: string or integer ports become integer appPort entries; lookups never go through a dictionary", () => {
  const http = normalizeHttpBaseline(legacy.http, legacy.listeners);
  assert.equal(http.length, 21);
  assert.ok(http.every((e) => Number.isInteger(e.appPort) && typeof e.status === "number" && typeof e.limitMs === "number"));
  assert.deepEqual(http.map((e) => e.appPort), legacy.productionPorts, "every incident port, sorted, as numbers");
  assert.deepEqual(validateHttpBaseline(http), [], "the incident baseline itself was valid — only the lookup was broken");
  const byString = normalizeHttpBaseline({ 1369: { status: "200", statuses: "200,200,200", medianMs: "22", limitMs: "72", host: "127.0.0.1" } });
  const byNumber = normalizeHttpBaseline([{ appPort: 1369, status: 200, statuses: [200, 200, 200], medianMs: 22, limitMs: 72, host: "127.0.0.1" }]);
  assert.deepEqual(byString, byNumber);
  assert.equal(toInt("55443"), 55443);
  assert.ok(Number.isNaN(toInt("55443x")) && Number.isNaN(toInt(undefined)) && Number.isNaN(toInt(1.5)));
  const one = normalizeFacts({ processes: { pid: "7", parent: "1", name: "Node.EXE", cmd: "x", created: "2026-11-17T13:00:00Z" }, listeners: { address: "127.0.0.1", port: "55443", pid: "7" } });
  assert.deepEqual([one.processes[0].pid, one.processes[0].name, one.listeners[0].port], [7, "node.exe", 55443], "PS 5.1 single-object arrays and string numbers");
});

// ---------------------------------------------------------------- R3 empty or malformed baseline → fail closed
test("R3 an empty, unstable or malformed baseline is refused (fail closed)", () => {
  assert.deepEqual(validateHttpBaseline([]), ["no production HTTP ports in the baseline"]);
  assert.deepEqual(validateHttpBaseline(undefined), ["no production HTTP ports in the baseline"]);
  const good = { appPort: 1369, host: "127.0.0.1", status: 200, statuses: [200, 200, 200], medianMs: 22, limitMs: 72 };
  const bad = [
    { ...good, status: NaN }, { ...good, status: -1, statuses: [-1, -1, -1] }, { ...good, statuses: [200, 500, 200] },
    { ...good, limitMs: NaN }, { ...good, limitMs: 60 }, { ...good, medianMs: NaN }, { ...good, appPort: NaN }, { ...good, host: null }, { ...good, host: "10.0.0.5" },
  ];
  for (const e of bad) assert.ok(validateHttpBaseline([e]).length >= 1, JSON.stringify(e));
  assert.ok(validateHttpBaseline([good, good]).some((p) => /duplicate/.test(p)));
  assert.ok(validateBaseline({ tree: {}, infra: {}, http: [good], tempPgPort: 55443 }).length >= 2, "no PM2 tree, no postmaster");
  assert.ok(validateBaseline(null).length === 1);
  const fromProbe = buildHttpBaseline([{ appPort: 1369, host: "127.0.0.1", results: [{ status: 200, ms: 3 }, { status: 200, ms: NaN }, { status: 200, ms: 2 }] }]);
  assert.ok(validateHttpBaseline(fromProbe).length >= 1, "a missing latency sample is never silently ignored");
  assert.equal(probeHost(["192.168.1.10"]), null, "a LAN-only listener cannot be probed from loopback → refused");
});

// ---------------------------------------------------------------- R4 / R5 HTTP status: expected 200 and expected 404
test("R4 HTTP 200 expected: 200 is healthy; 500 or no answer is a finding", () => {
  const b = incidentBaseline();
  const ctx = incidentCtx();
  assert.deepEqual(evaluateRound({ baseline: b, facts: incidentFacts(), probes: healthyProbes(b), state: {}, ctx }).findings, [], "the incident's first round, evaluated correctly");
  for (const [status, label] of [[500, "500"], [-1, "-1"]]) {
    const probes = healthyProbes(b);
    probes.set(1369, { status, ms: 2 });
    const f = evaluateRound({ baseline: b, facts: incidentFacts(), probes, state: {}, ctx }).findings;
    assert.deepEqual(f.map((x) => x.message), [`production port 1369 answered ${label} (baseline 200)`]);
  }
});
test("R5 API 404 expected: 404 is healthy; a change to 200 is a finding", () => {
  const b = incidentBaseline();
  assert.equal(b.http.find((e) => e.appPort === 4243).status, 404);
  const probes = healthyProbes(b);
  assert.deepEqual(evaluateRound({ baseline: b, facts: incidentFacts(), probes, state: {}, ctx: incidentCtx() }).findings, []);
  probes.set(4243, { status: 200, ms: 1 });
  assert.deepEqual(evaluateRound({ baseline: b, facts: incidentFacts(), probes, state: {}, ctx: incidentCtx() }).findings.map((x) => x.key), ["http-status-4243"]);
});

// ---------------------------------------------------------------- R6 latency thresholds
test("R6 latency: limit = max(ceil(1.5 × median), median + 50); one slow round is a strike, two consecutive a finding", () => {
  assert.deepEqual([latencyLimit(0), latencyLimit(2), latencyLimit(22), latencyLimit(200)], [50, 52, 72, 300]);
  const b = incidentBaseline();
  const ctx = incidentCtx();
  const at = (ms) => {
    const p = healthyProbes(b);
    p.set(2233, { status: 200, ms });
    return p;
  };
  const r0 = evaluateRound({ baseline: b, facts: incidentFacts(), probes: at(2), state: {}, ctx });
  assert.deepEqual(r0.findings, [], "the incident's '2 ms > ms' was a missing limit, not a regression");
  assert.equal(b.http.find((e) => e.appPort === 2233).limitMs, 51);
  const r1 = evaluateRound({ baseline: b, facts: incidentFacts(), probes: at(51), state: r0.state, ctx });
  assert.deepEqual([r1.findings.length, r1.state.latStrikes[2233]], [0, 0], "51 ms = the limit is not above it");
  const r2 = evaluateRound({ baseline: b, facts: incidentFacts(), probes: at(80), state: r1.state, ctx });
  assert.equal(r2.findings.length, 0, "first slow round: a strike only");
  const r3 = evaluateRound({ baseline: b, facts: incidentFacts(), probes: at(80), state: r2.state, ctx });
  assert.deepEqual(r3.findings.map((f) => f.key), ["latency-2233"]);
  const r4 = evaluateRound({ baseline: b, facts: incidentFacts(), probes: at(3), state: r3.state, ctx });
  assert.equal(r4.state.latStrikes[2233], 0, "a healthy round resets the strikes");
});

// ---------------------------------------------------------------- R7 temporary PostgreSQL listener checks
test("R7 temporary instance: only 55443 is checked; production listeners on 0.0.0.0 / :: are not temp-PG findings", () => {
  const b = incidentBaseline();
  const ctx = incidentCtx();
  const facts = incidentFacts();
  assert.ok(facts.listeners.filter((l) => ["0.0.0.0", "::"].includes(l.address) && ![55443, 5432, 3306].includes(l.port)).length >= 10, "the incident host had production ports on wildcard addresses");
  assert.deepEqual(evaluateRound({ baseline: b, facts, probes: healthyProbes(b), state: {}, ctx }).findings, [], "the incident's 'non-loopback temporary instance' was a false positive");
  const variant = (patch) => ({ ...facts, listeners: [...facts.listeners.filter((l) => l.port !== 55443), ...patch] });
  const keys = (f) => evaluateRound({ baseline: b, facts: f, probes: healthyProbes(b), state: {}, ctx }).findings.map((x) => x.key);
  assert.deepEqual(keys(variant([{ address: "0.0.0.0", port: 55443, pid: 26852 }])), ["temp-pg-address-0.0.0.0", "g0-listener-26852-0.0.0.0-55443"]);
  assert.deepEqual(keys(variant([{ address: "::", port: 55443, pid: 26852 }])), ["temp-pg-address-::", "g0-listener-26852-::-55443"]);
  assert.deepEqual(keys(variant([{ address: "127.0.0.1", port: 55443, pid: 7712 }])), ["temp-pg-owner-7712"], "held by a non-G0 (production) process");
  assert.deepEqual(keys({ ...facts, listeners: [...facts.listeners, { address: "::1", port: 41000, pid: 24376 }] }), [], "a G0 process on ::1 is loopback");
  assert.deepEqual(keys({ ...facts, listeners: [...facts.listeners, { address: "192.168.1.20", port: 41000, pid: 24376 }] }), ["g0-listener-24376-192.168.1.20-41000"]);
  assert.deepEqual(keys({ ...facts, to5432: [{ pid: 24376, remote: "127.0.0.1:5432" }] }), ["g0-5432-24376"]);
  assert.deepEqual(keys({ ...facts, to5432: [{ pid: 7712, remote: "127.0.0.1:5432" }] }), [], "production's own 5432 connections are not G0's");
});
test("R7b temp-pg-identity: the incident's postmaster is verified; the production postmaster or a wildcard bind is refused", () => {
  const facts = incidentFacts();
  const pgData = `${G0_DIR}\\pg`;
  const ok = evaluateTempPg({ facts, pgData, tempPgPort: 55443, postmasterPid: "26852", g0Dir: G0_DIR });
  assert.deepEqual([ok.ok, ok.problems], [true, []]);
  assert.equal(evaluateTempPg({ facts, pgData, tempPgPort: 55443, postmasterPid: "5764", g0Dir: G0_DIR }).ok, false);
  const wild = { ...facts, listeners: facts.listeners.map((l) => (l.port === 55443 ? { ...l, address: "0.0.0.0" } : l)) };
  assert.ok(evaluateTempPg({ facts: wild, pgData, tempPgPort: 55443, postmasterPid: "26852", g0Dir: G0_DIR }).problems.some((p) => /0\.0\.0\.0/.test(p)));
  assert.equal(evaluateTempPg({ facts, pgData, tempPgPort: 55443, postmasterPid: "26852", expect: "stopped", g0Dir: G0_DIR }).ok, false, "still running");
  const stopped = { ...facts, processes: facts.processes.filter((p) => !(p.name === "postgres.exe" && p.cmd.includes("g0-20261117"))), listeners: facts.listeners.filter((l) => l.port !== 55443) };
  assert.equal(evaluateTempPg({ facts: stopped, pgData, tempPgPort: 55443, expect: "stopped", g0Dir: G0_DIR }).ok, true);
});

// ---------------------------------------------------------------- R8 PostgreSQL startup returns control to the runner
test("R8 startup returns control: output to files (Invoke-G0Bounded) does not wait for a grandchild that inherited the handles; a pipe does", async () => {
  // The mechanism of incident cause 2, on this OS: a parent starts a long-lived grandchild that inherits its stdout
  // and exits at once (as pg_ctl does with the postmaster).
  const parentCode = `require("node:child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, 2500)"], { stdio: "inherit", detached: true }).unref(); process.exit(0);`;
  const viaPipe = Date.now();
  await new Promise((resolve) => spawn(process.execPath, ["-e", parentCode], { stdio: ["ignore", "pipe", "pipe"] }).on("close", resolve));
  const pipeMs = Date.now() - viaPipe;
  const dir = tmp("g0-r8-");
  const fd = fs.openSync(path.join(dir, "out.txt"), "w");
  const viaFile = Date.now();
  await new Promise((resolve) => spawn(process.execPath, ["-e", parentCode], { stdio: ["ignore", fd, fd] }).on("exit", resolve));
  const fileMs = Date.now() - viaFile;
  fs.closeSync(fd);
  assert.ok(pipeMs >= 2000, `a pipe reader waits for the grandchild (${pipeMs} ms)`);
  assert.ok(fileMs < 1500, `file redirection returns when the child exits (${fileMs} ms)`);
  // The runner: no pipe-capturing call; pg_ctl start only through the bounded helper; the helper uses files + polling.
  const runner = harness("Run-G0.ps1");
  assert.deepEqual(checkRunner(runner), []);
  assert.ok(!/\*>/.test(runner.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join("\n")), "no *> redirection in code");
  const common = harness("g0-common.ps1");
  assert.match(common, /RedirectStandardOutput = "\$logBase\.out\.txt"; RedirectStandardError = "\$logBase\.err\.txt"/);
  assert.match(common, /while \(-not \$child\.HasExited\) \{\s*\n\s*Start-Sleep -Milliseconds 500/);
  for (const bad of ["  & \"$PgBin\\pg_ctl.exe\" -D $PgDataDir start *> x.log", "  $code = Native \"$PgBin\\pg_ctl.exe\" @('start') 'pg-start.log'"])
    assert.ok(checkRunner(runner.replace("  Write-G0Log 'all G0 phases passed", `${bad}\n  Write-G0Log 'all G0 phases passed`)).length >= 1, bad);
});

// ---------------------------------------------------------------- R9 STOP propagation during a blocked step
test("R9 STOP during a blocked step: every wait polls STOP / monitor health / deadline and stops only the step's own tree", () => {
  const common = harness("g0-common.ps1");
  assert.match(common, /if \(\$StopFile -and \(Test-Path -LiteralPath \$StopFile\)\) \{\s*\n\s*\$outcome = 'STOPPED'/);
  assert.match(common, /if \(\(Get-Date\) -gt \$deadline\) \{ \$outcome = 'TIMEOUT'/);
  assert.match(common, /& \$OnAbort \$child\.Id \$childCreated \$why/);
  const runner = harness("Run-G0.ps1");
  assert.match(runner, /-StopFile \$stopPath -AbortCheck \$abortBlock -OnAbort \{ param\(\$ChildPid, \$ChildCreated, \$Why\) Stop-OwnTree \$ChildPid \$ChildCreated \$Why \}/);
  assert.match(runner, /'stop-tree', '--root', "\$RootPid", '--root-created', \$RootCreated, '--not-before', \$script:RunnerCreated/);
  assert.match(runner, /if \(\$script:MonitorProc\.HasExited\) \{ return "the G0 monitor process ended unexpectedly/, "a dead monitor stops G0 (fail closed)");
  for (const bad of ["  Stop-Process -Id $pidValue -Force", "  & taskkill.exe /PID 1 /T /F", "  $job = Start-Job { 1 }"])
    assert.ok(checkRunner(runner.replace("  Write-G0Log 'all G0 phases passed", `${bad}\n  Write-G0Log 'all G0 phases passed`)).length >= 1, bad);
});
test("R9b stop-tree on real processes: a blocked step's tree is stopped, each PID re-verified; an older process is refused", async () => {
  const notBefore = new Date(Date.now() - 5000).toISOString(); // /proc start times are relative to a whole-second boot time
  const root = spawn(process.execPath, ["-e", `require("node:child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" }); setTimeout(() => {}, 60000);`], { stdio: "ignore" });
  await waitFor(() => createdOf(root.pid), 10_000);
  await sleep(500);
  const out = tmp("g0-r9-");
  const r = spawnSync(process.execPath, [SUPERVISOR, "stop-tree", "--root", String(root.pid), "--root-created", createdOf(root.pid), "--not-before", notBefore, "--g0-dir", out, "--out", out, "--reason", "test", "--facts-module", TEST_FACTS], { encoding: "utf8", timeout: 60_000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const record = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(record.plan.stop.length, 2, "the step and its child");
  assert.deepEqual(record.executed.survivors, []);
  assert.ok(fs.readdirSync(out).some((n) => n.startsWith(`stop-tree-${root.pid}-`)), "the action is recorded");
  // A process created before --not-before (i.e. not started by this G0 run) is never stopped.
  const older = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
  await waitFor(() => createdOf(older.pid), 10_000);
  const later = new Date(Date.now() + 60_000).toISOString();
  const r2 = spawnSync(process.execPath, [SUPERVISOR, "stop-tree", "--root", String(older.pid), "--root-created", createdOf(older.pid), "--not-before", later, "--g0-dir", out, "--out", out, "--reason", "test", "--facts-module", TEST_FACTS], { encoding: "utf8", timeout: 60_000 });
  const rec2 = JSON.parse(r2.stdout.trim().split("\n").pop());
  assert.equal(rec2.plan.stop.length, 0);
  assert.match(rec2.plan.refused[0].reason, /created before this G0 run/);
  assert.ok(createdOf(older.pid), "still running");
  older.kill();
});

// ---------------------------------------------------------------- R10 monitor shutdown after runner exit (real processes)
function syntheticProduction(appPort) {
  const t = "2026-11-15T18:39:09.000Z";
  return {
    processes: [
      { pid: 5_000_001, parent: 1, name: "node.exe", cmd: "node C:\\pm2\\lib\\Daemon.js", created: t },
      { pid: 5_000_002, parent: 5_000_001, name: "node.exe", cmd: "node app.js", created: t },
      { pid: 5_000_003, parent: 1, name: "pg_ctl.exe", cmd: "pg_ctl runservice", created: t },
      { pid: 5_000_004, parent: 5_000_003, name: "postgres.exe", cmd: "postgres -D C:\\data", created: t },
    ],
    listeners: [{ address: "127.0.0.1", port: appPort, pid: 5_000_002 }],
  };
}
async function startMonitor({ statusOf, ackTimeoutMs = 60_000 }) {
  const server = http.createServer((q, res) => {
    res.statusCode = statusOf();
    res.end("ok");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const dir = tmp("g0-r10-");
  const out = path.join(dir, "g0");
  fs.mkdirSync(out);
  const extra = path.join(dir, "extra.json");
  fs.writeFileSync(extra, JSON.stringify(syntheticProduction(server.address().port)));
  const runner = spawn(process.execPath, ["-e", "setTimeout(() => {}, 120000)"], { stdio: "ignore" });
  await waitFor(() => createdOf(runner.pid), 10_000);
  const monitor = spawn(process.execPath, [SUPERVISOR, "monitor", "--out", out, "--g0-dir", dir, "--runner-pid", String(runner.pid), "--runner-created", createdOf(runner.pid), "--temp-pg-port", "55443", "--facts-module", TEST_FACTS, "--interval-ms", "400", "--ack-timeout-ms", String(ackTimeoutMs)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, G0_TEST_FACTS_EXTRA: extra } });
  let stderr = "";
  monitor.stderr.on("data", (d) => (stderr += d));
  const exited = new Promise((resolve) => monitor.on("exit", (code) => resolve(code)));
  const exitedWith = new Promise((resolve) => monitor.on("exit", (code, signal) => resolve({ code, signal })));
  return { server, out, runner, monitor, exited, exitedWith, stderr: () => stderr };
}
test("R10 the monitor ends by itself when the runner process ends, and still writes the final I5 comparison", async () => {
  const m = await startMonitor({ statusOf: () => 200 });
  try {
    assert.ok(await waitFor(() => fs.existsSync(path.join(m.out, "baseline.json")), 30_000), m.stderr());
    const baseline = JSON.parse(read(path.join(m.out, "baseline.json")));
    assert.equal(baseline.valid, true, JSON.stringify(baseline.problems));
    assert.ok(await waitFor(() => fs.existsSync(path.join(m.out, "monitor.csv")) && read(path.join(m.out, "monitor.csv")).split("\n").length >= 3, 30_000), "at least one round");
    m.runner.kill();
    const code = await Promise.race([m.exited, sleep(30_000).then(() => "timeout")]);
    assert.equal(code, 0, m.stderr());
    const final = JSON.parse(read(path.join(m.out, "monitor-final.json")));
    assert.match(final.endReason, /runner process ended/);
    assert.equal(final.i5ok, true, JSON.stringify(final.i5diffs));
    assert.ok(!fs.existsSync(path.join(m.out, "STOP")), "a healthy run raises no STOP");
  } finally {
    m.monitor.kill();
    m.runner.kill();
    m.server.close();
  }
});
test("R10b after a real STOP each condition is logged once (no alert flood); MONITOR-END ends the monitor", async () => {
  let status = 200;
  const m = await startMonitor({ statusOf: () => status, ackTimeoutMs: 800 });
  try {
    assert.ok(await waitFor(() => fs.existsSync(path.join(m.out, "baseline.json")), 30_000), m.stderr());
    status = 500;
    assert.ok(await waitFor(() => fs.existsSync(path.join(m.out, "STOP")), 30_000), "STOP raised");
    assert.ok(await waitFor(() => read(path.join(m.out, "monitor.csv")).trim().split("\n").length >= 5, 30_000), "several rounds after STOP");
    fs.writeFileSync(path.join(m.out, "MONITOR-END"), "");
    const code = await Promise.race([m.exited, sleep(30_000).then(() => "timeout")]);
    assert.equal(code, 0, m.stderr());
    const breaches = read(path.join(m.out, "monitor-breaches.txt")).trim().split("\n");
    assert.equal(breaches.filter((l) => /answered 500 \(baseline 200\)/.test(l)).length, 1, breaches.join("\n"));
    assert.match(read(path.join(m.out, "STOP")), /answered 500 \(baseline 200\)/);
    const final = JSON.parse(read(path.join(m.out, "monitor-final.json")));
    assert.equal(final.endReason, "MONITOR-END from the runner");
    assert.ok(final.repeatsSuppressed >= 2);
    assert.equal(final.i5ok, false);
  } finally {
    m.monitor.kill();
    m.runner.kill();
    m.server.close();
  }
});
test("R10c an unstable baseline is refused: STOP, exit 2, no monitoring rounds", async () => {
  let n = 0;
  const m = await startMonitor({ statusOf: () => (n++ % 2 ? 500 : 200) });
  try {
    const code = await Promise.race([m.exited, sleep(30_000).then(() => "timeout")]);
    assert.equal(code, 2, m.stderr());
    const baseline = JSON.parse(read(path.join(m.out, "baseline.json")));
    assert.equal(baseline.valid, false);
    assert.match(read(path.join(m.out, "STOP")), /baseline invalid/);
    assert.ok(!fs.existsSync(path.join(m.out, "monitor.csv")));
  } finally {
    m.runner.kill();
    m.server.close();
  }
});

test("R10d each runner-exit signal ends the monitor on its own: process liveness, and the PID / start time in the facts", async () => {
  const runner = { pid: 777001, parent: 1, name: "powershell.exe", cmd: "Run-G0.ps1", created: "2026-11-17T13:44:58.541Z" };
  const prod = syntheticProduction(8080);
  for (const [label, isAlive, withRunner, expected] of [
    ["liveness", () => false, true, /^runner process ended$/],
    ["facts", () => true, false, /PID \/ start time no longer present/],
  ]) {
    const out = tmp("g0-r10d-");
    let calls = 0;
    const collectFacts = async () => {
      calls += 1;
      const procs = calls === 1 || withRunner ? [...prod.processes, runner] : prod.processes;
      return { processes: procs, listeners: prod.listeners, to5432: [], cpuPct: 1, freeRamGB: 30, freeDiskDGB: 500 };
    };
    const code = await runMonitor(
      { out, g0Dir: out, runnerPid: runner.pid, runnerCreated: runner.created, tempPgPort: 55443, intervalMs: 1000, ackTimeoutMs: 60_000, maxLifetimeMs: 60_000 },
      { collectFacts, probe: async () => ({ status: 200, ms: 2 }), sleep: async () => {}, now: () => Date.now(), isAlive },
    );
    assert.equal(code, 0, label);
    assert.match(JSON.parse(read(path.join(out, "monitor-final.json"))).endReason, expected, label);
  }
});

// ---------------------------------------------------------------- R11 graceful temporary PostgreSQL cleanup
test("R11 shutdown: identity verified → pg_ctl stop -m fast → verified stopped; PostgreSQL is never killed", () => {
  const runner = harness("Run-G0.ps1");
  const complete = runner.slice(runner.indexOf("function Complete-G0"), runner.indexOf("function Stop-G0"));
  const order = ["'temp-pg-identity-before-stop'", "if ($identity.status -eq 'OK')", "'temp-pg-stop'", "'stop', '-m', 'fast', '-w', '-t', '90'", "'temp-pg-stopped-check'", "New-Item -ItemType File -Path $MonitorEndFile", "WaitForExit(90000)", "'collector-after'", "Write-G0Report"];
  let last = -1;
  for (const marker of order) {
    const at = complete.indexOf(marker);
    assert.ok(at > last, `${marker} in order`);
    last = at;
  }
  assert.match(complete, /finally \{\s*\n\s*Write-G0Report/, "the report is written even if a shutdown step fails");
  const facts = incidentFacts();
  const plan = planStopTree({ facts, rootPid: 4996, rootCreated: "2026-11-17T13:49:03.8778980+07:00", notBefore: "2026-11-17T13:44:58.5412670+07:00", g0Dir: G0_DIR });
  assert.ok(plan.stop.every((p) => p.name !== "postgres.exe"), "the planner never selects postgres.exe");
  assert.ok(plan.refused.some((p) => p.pid === 26852 && /pg_ctl stop/.test(p.reason)));
});

// ---------------------------------------------------------------- R12 production PID protection
test("R12 production PIDs (PM2 daemon and children, shared postmaster, MariaDB, cloudflared) are never planned for stopping", async () => {
  const facts = incidentFacts();
  const prod = identifyProduction(facts, { g0Dir: G0_DIR });
  for (const pid of [2228, 7712, 4620, 5764, 4488, 5688, 5084, 6104]) assert.ok(prod.protectedPids.has(pid), `PID ${pid} protected`);
  const nb = "2026-11-17T13:44:58.5412670+07:00";
  for (const [pid, created] of [[2228, "2026-11-15T18:39:09.3315100+07:00"], [7712, "2026-11-15T18:39:11.0178570+07:00"], [5764, "2026-11-15T18:38:04.2144480+07:00"]]) {
    const plan = planStopTree({ facts, rootPid: pid, rootCreated: created, notBefore: nb, g0Dir: G0_DIR });
    assert.deepEqual(plan.stop, [], `PID ${pid}`);
    assert.ok(plan.refused.length === 1);
  }
  // PID reuse: a "child" of a G0 step that is really an older production process is excluded.
  const reuse = { ...facts, processes: [...facts.processes, { pid: 40001, parent: 23604, name: "node.exe", cmd: "guard", created: "2026-11-17T13:50:00.000+07:00" }].map((p) => (p.pid === 7712 ? { ...p, parent: 40001 } : p)) };
  const plan = planStopTree({ facts: reuse, rootPid: 40001, rootCreated: "2026-11-17T13:50:00.000+07:00", notBefore: nb, g0Dir: G0_DIR });
  assert.deepEqual(plan.stop.map((p) => p.pid), [40001]);
  // Each protection layer on its own: with a --not-before older than production, the production list alone refuses
  // PM2 children; a non-production process that is older than its "parent" (PID reuse) is excluded by the tree walk.
  const early = "2026-01-01T00:00:00Z";
  const layered = planStopTree({ facts, rootPid: 7712, rootCreated: "2026-11-15T18:39:11.0178570+07:00", notBefore: early, g0Dir: G0_DIR });
  assert.deepEqual(layered.stop, []);
  assert.match(layered.refused[0].reason, /production process/);
  const reuse2 = { ...facts, processes: [...facts.processes, { pid: 40001, parent: 23604, name: "node.exe", cmd: "guard", created: "2026-11-17T13:50:00.000+07:00" }, { pid: 40002, parent: 40001, name: "notepad.exe", cmd: "notepad", created: "2026-11-17T10:00:00.000+07:00" }] };
  assert.deepEqual(planStopTree({ facts: reuse2, rootPid: 40001, rootCreated: "2026-11-17T13:50:00.000+07:00", notBefore: early, g0Dir: G0_DIR }).stop.map((p) => p.pid), [40001]);
  // The runner itself (wrong start time = reused PID) is refused; the executor never touches refused PIDs.
  assert.match(planStopTree({ facts, rootPid: 23604, rootCreated: "2026-11-17T13:00:00Z", notBefore: nb, g0Dir: G0_DIR }).refused[0].reason, /PID reused/);
  const killed = [];
  await executeStopTree({ stop: [], refused: [{ pid: 2228 }] }, { identify: async () => [], isAlive: () => true, kill: (p) => killed.push(p), sleep: async () => {}, waitMs: 0 });
  assert.deepEqual(killed, []);
  // The CLI's plan command has no action path at all.
  const src = read(SUPERVISOR);
  const planBranch = src.slice(src.indexOf('if (cmd === "plan-stop-tree") {'), src.indexOf("const executed = await executeStopTree"));
  assert.ok(!/kill/.test(planBranch));
});

test("findings are de-duplicated by condition; final comparison sees production changes", () => {
  const reported = new Set();
  const first = freshFindings([{ key: "a", message: "x" }, { key: "b", message: "y" }], reported);
  const second = freshFindings([{ key: "a", message: "x (again, other ms)" }], reported);
  assert.deepEqual([first.length, second.length], [2, 0]);
  const b = incidentBaseline();
  assert.deepEqual(finalComparison({ baseline: b, facts: incidentFacts(), probes: healthyProbes(b), ctx: { tempPgPort: 55443, g0Dir: G0_DIR } }), []);
  const restarted = { ...incidentFacts(), processes: incidentFacts().processes.map((p) => (p.pid === 7712 ? { ...p, created: "2026-11-17T14:00:00Z" } : p)) };
  assert.ok(finalComparison({ baseline: b, facts: restarted, probes: healthyProbes(b), ctx: { tempPgPort: 55443, g0Dir: G0_DIR } }).includes("production PM2 tree changed"));
  assert.ok(LIMITS.intervalMs === 15000 && LIMITS.ackTimeoutMs === 300000);
});

// ---------------------------------------------------------------- R13 C-A0.2 P4: bounded, deterministic stop-tree cost
// Root cause of the Windows harness P4 failure: stop-tree took a FULL Windows snapshot (all processes, TCP tables,
// performance counters, volume; ~2.5 s each on S2A-SERVER) to plan, then another one PER target PID, then more while
// waiting - 14 s from STOP to termination for ONE process, growing with every process in a step's tree.
function fakeTargets(n) {
  return Array.from({ length: n }, (_, i) => ({ pid: 9000 + i, name: "node.exe", created: `2026-11-17T13:50:${String(i).padStart(2, "0")}.000Z` }));
}
function fakeHost(targets, { snapshotMs = 2500 } = {}) {
  const host = { clock: 0, alive: new Set(targets.map((t) => t.pid)), identifyCalls: [], killed: [], ignoresKill: new Set(), startTimes: new Map(targets.map((t) => [t.pid, t.created])) };
  host.deps = {
    now: () => host.clock,
    sleep: async (ms) => {
      host.clock += ms;
    },
    identify: async (pids) => {
      host.identifyCalls.push([...pids]);
      host.clock += snapshotMs;
      return pids.filter((p) => host.alive.has(p)).map((p) => ({ pid: p, created: host.startTimes.get(p) }));
    },
    kill: (p) => {
      host.killed.push(p);
      if (!host.ignoresKill.has(p)) host.alive.delete(p);
    },
    isAlive: (p) => host.alive.has(p),
  };
  return host;
}
test("R13 stop-tree verifies ALL targets with ONE identity query, stops only verified PIDs, then polls liveness (no snapshot per PID)", async () => {
  const targets = fakeTargets(12);
  const host = fakeHost(targets);
  host.alive.add(4242); // an unrelated process: not in the plan
  const r = await executeStopTree({ stop: targets }, { ...host.deps, waitMs: 10_000, pollMs: 250 });
  assert.equal(host.identifyCalls.length, 1, "one identity query for 12 targets (the old code took 12+ full snapshots)");
  assert.deepEqual(host.identifyCalls[0], targets.map((t) => t.pid));
  assert.deepEqual(host.killed, targets.map((t) => t.pid), "every verified target, in plan order (deepest first)");
  assert.ok(host.alive.has(4242) && !host.killed.includes(4242), "no unrelated process is touched");
  assert.deepEqual(r.survivors, []);
  assert.equal(r.timings.totalMs, 2500, "cost = one identity query; no waiting when all are gone");
});
test("R13b PID reuse and start time: a reused PID is never stopped; a PID reused after the stop is not reported as a survivor", async () => {
  const targets = fakeTargets(3);
  const host = fakeHost(targets);
  host.startTimes.set(9001, "2026-11-17T15:00:00.000Z"); // 9001 now belongs to a different (newer) process
  const r = await executeStopTree({ stop: targets }, { ...host.deps, waitMs: 1000 });
  assert.deepEqual(host.killed, [9000, 9002]);
  assert.deepEqual(r.results.find((x) => x.pid === 9001).result, "skipped: PID reused (start time differs)");
  assert.ok(host.alive.has(9001), "the process that now owns PID 9001 keeps running");
  const host2 = fakeHost(fakeTargets(1));
  host2.deps.kill = (p) => {
    host2.killed.push(p);
    host2.startTimes.set(p, "2026-11-17T16:00:00.000Z"); // ended, and the PID was immediately reused
  };
  const r2 = await executeStopTree({ stop: fakeTargets(1) }, { ...host2.deps, waitMs: 1000, pollMs: 250 });
  assert.deepEqual(r2.survivors, [], "a reused PID is not a survivor of ours");
  assert.equal(host2.identifyCalls.length, 2, "a second identity query only because something still looked alive");
});
test("R13c deterministic timeout: a target that ignores the stop is reported as a survivor after exactly waitMs (→ non-zero exit, BLOCK)", async () => {
  const targets = fakeTargets(2);
  const host = fakeHost(targets);
  host.ignoresKill.add(9001);
  const r = await executeStopTree({ stop: targets }, { ...host.deps, waitMs: 4000, pollMs: 250 });
  assert.deepEqual(r.survivors, [9001]);
  assert.equal(r.timings.goneMs, 4000);
  assert.equal(r.timings.totalMs, 2500 + 4000 + 2500, "one query, the bounded wait, one confirming query - nothing unbounded");
  const src = read(SUPERVISOR);
  assert.match(src, /return executed\.survivors\.length \? 1 : 0;/, "survivors make stop-tree exit 1, which the runner records");
});
test("R13d real processes: a 6-process step tree is stopped with 1 process-only snapshot + 1 identity query; an unrelated decoy survives; nothing leaks", async () => {
  const notBefore = new Date(Date.now() - 5000).toISOString();
  const chain = 'const d = Number(process.argv[1]); if (d > 0) require("node:child_process").spawn(process.execPath, ["-e", process.env.G0_CHAIN, String(d - 1)], { stdio: "ignore" }); setTimeout(() => {}, 60000);';
  const root = spawn(process.execPath, ["-e", chain, "5"], { stdio: "ignore", env: { ...process.env, G0_CHAIN: chain } });
  const decoy = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
  const treeOf = () => {
    const procs = realProcesses();
    const ids = new Set([root.pid]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const p of procs) if (ids.has(Number(p.parent)) && !ids.has(Number(p.pid))) ids.add(Number(p.pid)), (grew = true);
    }
    return [...ids].filter((id) => procs.some((p) => Number(p.pid) === id));
  };
  try {
    assert.ok(await waitFor(() => treeOf().length === 6 && createdOf(decoy.pid), 20_000), "6-process tree started");
    const tree = treeOf();
    const out = tmp("g0-r13d-");
    const counter = path.join(out, "facts-calls.txt");
    const started = Date.now();
    const r = spawnSync(process.execPath, [SUPERVISOR, "stop-tree", "--root", String(root.pid), "--root-created", createdOf(root.pid), "--not-before", notBefore, "--g0-dir", out, "--out", out, "--reason", "R13d", "--facts-module", TEST_FACTS], { encoding: "utf8", timeout: 60_000, env: { ...process.env, G0_TEST_FACTS_COUNTER: counter } });
    const elapsed = Date.now() - started;
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const record = JSON.parse(r.stdout.trim().split("\n").pop());
    assert.equal(record.plan.stop.length, 6);
    assert.deepEqual(record.executed.survivors, []);
    assert.deepEqual(read(counter).trim().split("\n"), ["processes", "identity"], "one process-only snapshot to plan, one identity query to verify");
    for (const k of ["planMs", "verifyMs", "goneMs", "totalMs"]) assert.ok(Number.isFinite(record.executed.timings[k]), `timing ${k} recorded`);
    assert.ok(elapsed < 20_000, `bounded (${elapsed} ms)`);
    assert.deepEqual(tree.filter((id) => testIsAlive(id)), [], "no process of the tree is left (no leak)");
    assert.ok(testIsAlive(decoy.pid), "the unrelated decoy is not touched");
  } finally {
    decoy.kill();
    root.kill();
  }
});

// ---------------------------------------------------------------- R14 G0 run 2 (g0-20261117-161805): silent monitor exit
// Evidence: the monitor (16856) and the backend-tests guard ended in the same half-second with exit 0xFFFFFFFF, no
// output, no monitor STOP, no monitor-final.json; the runner recorded the step as "STOPPED" although it had already
// ended by itself. These tests pin the diagnostics added so the next such event is attributable.
test("R14 exit codes are reported with their Windows meaning (−1 = 0xFFFFFFFF = terminated by another process)", () => {
  assert.deepEqual(describeExitCode(-1).hex, "0xFFFFFFFF");
  assert.match(describeExitCode(-1).meaning, /ANOTHER process.*TerminateProcess\(-1\)/);
  assert.deepEqual(describeExitCode(4294967295).hex, "0xFFFFFFFF");
  assert.match(describeExitCode(-1073741510).meaning, /Ctrl\+C/);
  assert.match(describeExitCode("3221225477").meaning, /access violation/);
  assert.match(describeExitCode(1).meaning, /taskkill \/F or Node process.kill/);
  assert.equal(describeExitCode(null).hex, null);
  const common = harness("g0-common.ps1");
  assert.match(common, /function Format-G0ExitCode\(\$CodeValue\)/);
  assert.match(harness("Run-G0.ps1"), /ended unexpectedly \(exit \$\(Format-G0ExitCode \$script:MonitorProc\.ExitCode\)/);
});
test("R14b the monitor keeps a heartbeat log with an exit line (its last line localises any silent end)", async () => {
  const m = await startMonitor({ statusOf: () => 200 });
  try {
    assert.ok(await waitFor(() => fs.existsSync(path.join(m.out, "monitor.csv")) && read(path.join(m.out, "monitor.csv")).split("\n").length >= 3, 30_000), m.stderr());
    m.runner.kill();
    assert.equal(await Promise.race([m.exited, sleep(30_000).then(() => "timeout")]), 0);
    const log = read(path.join(m.out, "monitor.log"));
    for (const re of [/monitor started \(pid \d+\)/, /baseline valid: 1 ports/, /round 1: facts …/, /round 1: facts ok in \d+ ms/, /round 1: probes done; 0 finding/, /ending: runner process ended/, /final I5 written: ok/, /exit code 0 \(normal exit\)/])
      assert.match(log, re);
  } finally {
    m.monitor.kill();
    m.runner.kill();
    m.server.close();
  }
});
test("R14c a stop request is logged and fails closed (STOP raised); a termination by another process leaves no exit line", async () => {
  const m = await startMonitor({ statusOf: () => 200 });
  try {
    assert.ok(await waitFor(() => fs.existsSync(path.join(m.out, "baseline.json")), 30_000), m.stderr());
    await sleep(300);
    m.monitor.kill("SIGTERM");
    const ended = await Promise.race([m.exitedWith, sleep(30_000).then(() => "timeout")]);
    const log = read(path.join(m.out, "monitor.log"));
    if (process.platform === "win32") {
      // On Windows a Node kill is TerminateProcess (OS exit code 1): no handler runs - the silent signature seen in
      // G0 run 2. Node reports such an end as code null + the signal it was asked to send (Windows harness
      // harness-test-20261117-170714 P7: "null !== 1" - the C-A0.3 expectation of code 1 was wrong).
      assert.deepEqual(ended, { code: null, signal: "SIGTERM" });
      assert.match(log, /monitor started/, "the monitor was running and logging before it was terminated");
      assert.doesNotMatch(log, /exit code/);
      assert.doesNotMatch(log, /received SIGTERM/);
      assert.ok(!fs.existsSync(path.join(m.out, "STOP")) || !/monitor: received/.test(read(path.join(m.out, "STOP"))), "no STOP from the monitor itself");
    } else {
      assert.deepEqual(ended, { code: 143, signal: null });
      assert.match(log, /received SIGTERM - ending \(STOP raised\)/);
      assert.match(log, /exit code 143/);
      assert.match(read(path.join(m.out, "STOP")), /monitor: received SIGTERM/);
    }
  } finally {
    m.monitor.kill();
    m.runner.kill();
    m.server.close();
  }
});
test("R14d census records which G0 processes are alive and what the exit codes mean", async () => {
  const runner = spawn(process.execPath, ["-e", 'require("node:child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" }); setTimeout(() => {}, 60000);'], { stdio: "ignore" });
  try {
    await waitFor(() => createdOf(runner.pid), 10_000);
    await sleep(700);
    const out = tmp("g0-r14d-");
    const file = path.join(out, "census-at-stop.json");
    const r = spawnSync(process.execPath, [SUPERVISOR, "census", "--out", file, "--g0-dir", out, "--runner-pid", String(runner.pid), "--runner-created", createdOf(runner.pid), "--exit", "monitor=-1", "--exit", "backend-tests=-1", "--facts-module", TEST_FACTS], { encoding: "utf8", timeout: 60_000 });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const c = JSON.parse(read(file));
    assert.equal(c.runnerAlive, true);
    assert.equal(c.g0ProcessesAlive.length, 2, "the runner and its child");
    assert.deepEqual(c.exits.map((e) => [e.name, e.hex]), [["monitor", "0xFFFFFFFF"], ["backend-tests", "0xFFFFFFFF"]]);
    assert.match(c.exits[0].meaning, /ANOTHER process/);
  } finally {
    runner.kill();
  }
});
test("R14e the runner reports a step that ended by itself during an abort, records a census at STOP and a missing final I5", () => {
  const common = harness("g0-common.ps1");
  assert.match(common, /if \(\$child\.HasExited\) \{\s*\n\s*\$endedFirst = \$true\s*\n\s*\$why = "\$why; the step had already ended by itself \(exit \$\(Format-G0ExitCode \$child\.ExitCode\)\) - G0 did not stop it"\s*\n\s*\} elseif \(\$OnAbort -and \$childCreated\) \{ & \$OnAbort/);
  assert.match(common, /childEndedFirst = \$endedFirst/);
  const runner = harness("Run-G0.ps1");
  assert.deepEqual(checkRunner(runner), []);
  assert.ok(checkRunner(runner.replace("  Save-G0Census 'census-at-stop'\n", "")).some((p) => /census/.test(p)), "removing the census is caught");
  assert.match(runner, /\$script:Summary\.monitorFinal = 'MISSING - the monitor ended without its final I5 comparison/);
  assert.match(runner, /MONITOR EXIT: \$\(\$script:Summary\.monitorExit\)/);
  const harnessText = harness("Test-G0Harness.ps1");
  assert.match(harnessText, /# P9 - G0 run 2/);
  assert.match(harnessText, /# P10 - G0 run 2 exit-code evidence/);
});
