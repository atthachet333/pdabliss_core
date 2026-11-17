// EP48.5 A-0.1 — the static / self-test part of the G0 preflight, against THIS repository and synthetic negatives.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkBackendPrisma, checkRunner, checkSupervisor, loopbackSelfTest, runPreflight, scanConnectionStrings, scanListenCalls } from "../ep48_5/g0-preflight.mjs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { P7_MANIFEST, evaluateManifest, parseEvents, parseTapSummary } from "../ep48_5/g0-test-manifest.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const H = path.join(REPO, "ops", "ep48_5", "g0-harness");
const tmpFile = (name, text) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "g0-pf-")), name);
  fs.writeFileSync(f, text);
  return f;
};

test("preflight on this repository: every static check and the guard self-test pass", () => {
  const r = runPreflight({ src: REPO });
  assert.equal(r.ok, true, JSON.stringify(r.checks.filter((c) => !c.ok), null, 2));
  assert.deepEqual(r.checks.map((c) => c.id), ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]);
  assert.ok(r.checks.find((c) => c.id === "C5").detail.prismaCalls >= 1, "the backend test setup's Prisma call is found and checked");
});

test("C2 runner (v3): a step outside the guard, pipe capture, direct process control, DB variables, 5432, deletes → refused", () => {
  const good = fs.readFileSync(path.join(H, "Run-G0.ps1"), "utf8");
  assert.deepEqual(checkRunner(good), []);
  const anchor = "  Write-G0Log 'all G0 phases passed";
  const bad = [
    "  Step 'x' @($npmCli, 'ci') $BackendDir",
    "  Step 'x' @('exec', '--gates', $G0Dir, '--name', 'x', '--', $npmCli, 'ci') $BackendDir",
    "  Invoke-G0Phase -Name 'x' -FilePath 'C:\\Windows\\System32\\cmd.exe' -ArgumentValues @('/c', 'dir') -WorkingDirectory $G0Dir",
    "  & git status *> x.log",
    "  $x = & node -v 2>&1",
    "  $code = Native \"$PgBin\\pg_ctl.exe\" @('start') 'pg-start.log'",
    "  & (Join-Path $PgBin 'pg_ctl.exe') -D $PgDataDir start",
    "  Start-Process node.exe -ArgumentList 'x'",
    "  Stop-Process -Id 4242 -Force",
    "  & taskkill.exe /PID 1 /T /F",
    "  $j = Start-Job { 1 }",
    "  $script:MonitorProc = Start-Process -FilePath $script:NodeExe -ArgumentList '--facts-module x'",
    "  $env:DATABASE_URL = 'postgresql://x@127.0.0.1:55443/y'",
    "  $env:PGPASSWORD = $pw",
    "  $env:NODE_OPTIONS = '--inspect'",
    "  $u = 'postgresql://a@127.0.0.1:5432/pda_one_test'",
    "  Invoke-G0Phase -Name 'x' -FilePath (Join-Path $PgBin 'createdb.exe') -ArgumentValues @('-p', '55443', 'x') -WorkingDirectory $G0Dir",
    "  Remove-Item $G0Dir -Recurse",
    "  rmdir $G0Dir",
  ];
  for (const line of bad) assert.ok(checkRunner(good.replace(anchor, `${line}\n${anchor}`)).length >= 1, line);
  assert.ok(checkRunner(good.replace(/^.*Invoke-G0Phase -Name 'preflight'.*$/m, "")).some((p) => /Preflight/.test(p)));
  assert.ok(checkRunner(good.replace(/\$env:CORE_G0_PG_SYSID\s*=/, "$x =")).some((p) => /system identifier/.test(p)));
  assert.ok(checkRunner(good.replace("$TempPgPort = 55443", "$TempPgPort = 5433")).some((p) => /55443/.test(p)));
  assert.ok(checkRunner(good.replace("if ($monitorBaseline.valid -ne $true)", "if ($false)")).some((p) => /invalid monitor baseline/.test(p)));
  // G0 run 2: the census at STOP must be taken before the summary is written.
  assert.ok(checkRunner(good.replace("  Save-G0Census 'census-at-stop'\n", "")).some((p) => /census/.test(p)), "census removed");
});

test("C3 supervisor: the incident replays to zero findings; 55443 on 0.0.0.0 is detected; the PS monitor is retired", () => {
  assert.deepEqual(checkSupervisor({ src: REPO }), []);
});

test("C4 / C5: connection strings to other ports and Prisma calls without an explicit DATABASE_URL are found", () => {
  assert.equal(scanConnectionStrings([tmpFile("a.mjs", 'const u = "postgresql://gate:x@127.0.0.1:55443/pdabliss_core_test";')]).length, 0);
  assert.equal(scanConnectionStrings([tmpFile("a.mjs", 'const u = "postgresql://gate:x@127.0.0.1:5432/pda_one_test";')]).length, 1);
  assert.equal(scanConnectionStrings([tmpFile("a.mjs", 'const u = "postgresql://gate:x@127.0.0.1:5432/x"; // g0-preflight: allowed-fixture')]).length, 0);
  const okSetup = "execFileSync('npx', ['prisma', 'migrate', 'deploy'], {\n  env: { ...process.env, DATABASE_URL: url },\n});";
  assert.deepEqual(checkBackendPrisma([tmpFile("s.ts", okSetup)]), { problems: [], calls: 1 });
  assert.equal(checkBackendPrisma([tmpFile("s.ts", "execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: process.env });")]).problems.length, 1);
});

test("C6: wildcard, address-less and bare-port listens are found; explicit loopback listens are not", () => {
  const bad = ['s.listen(0, "0.0.0.0", r);', "s.listen(0, '::');", "s.listen();", "s.listen(0);", "s.listen(port);", "s.listen(0, () => {});", "s.listen(0, 511, cb);", "s.listen({ port: 0 });", "s.listen(port, cb);"]; // g0-preflight: refused-by-guard (test data: strings, never executed)
  for (const l of bad) assert.equal(scanListenCalls([tmpFile("t.test.mjs", l)]).problems.length, 1, l);
  const good = ['s.listen(0, "127.0.0.1", r);', "server.listen(port, host, res);", "srv.listen(opts.preview.port, opts.preview.host, r);", 's.listen({ port: 0, host: "127.0.0.1" });', 's.listen(0, "0.0.0.0"); // g0-preflight: refused-by-guard'];
  for (const l of good) assert.equal(scanListenCalls([tmpFile("t.test.mjs", l)]).problems.length, 0, l);
});

test("C8: the loopback guard self-test refuses all seven cases without binding", () => {
  const r = loopbackSelfTest();
  assert.deepEqual(r.problems, []);
  assert.equal(r.results.length, 7);
});

// ---------------------------------------------------------------- G0 run 3 readiness: P7 exact test manifest
const MANIFEST_TOOL = path.join(REPO, "ops", "ep48_5", "g0-test-manifest.mjs");
const FIXTURES = path.join(REPO, "ops", "test", "g0-fixtures", "manifest");
const ev = (file, n, extra = {}) => Array.from({ length: n }, (_, i) => ({ event: "test:pass", file, nesting: 0, name: `t${i}`, type: "test", skip: false, todo: false, failureType: null, ...extra }));
const tiny = { name: "tiny", files: { "a.test.mjs": 2, "b.test.mjs": 1 }, excluded: { "c.test.mjs": "reason" }, total: 3 };
const okTap = { tests: 3, pass: 3, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
const okRun = () => ({ manifest: tiny, events: [...ev("a.test.mjs", 2), ...ev("b.test.mjs", 1)], tap: okTap, discovered: ["a.test.mjs", "b.test.mjs", "c.test.mjs"], violations: 0 });

test("manifest: exactly the listed files and counts pass; every drift, omission, extra file, skip, todo, cancel, failure or loopback attempt fails", () => {
  assert.deepEqual(evaluateManifest(okRun()).problems, []);
  const fails = (change, re) => {
    const r = evaluateManifest({ ...okRun(), ...change });
    assert.equal(r.ok, false, JSON.stringify(change));
    assert.ok(r.problems.some((m) => re.test(m)), `${re} not in ${JSON.stringify(r.problems)}`);
  };
  fails({ events: ev("a.test.mjs", 2) }, /b\.test\.mjs: did not run/);
  fails({ events: [...ev("a.test.mjs", 1), ...ev("b.test.mjs", 1)] }, /a\.test\.mjs: 1 tests ran, 2 expected/);
  fails({ events: [...okRun().events, ...ev("z.test.mjs", 1)] }, /not in the manifest: z\.test\.mjs/);
  fails({ events: [...ev("a.test.mjs", 2), ...ev("b.test.mjs", 1, { skip: true })] }, /b\.test\.mjs: 1 skipped/);
  fails({ events: [...ev("a.test.mjs", 2), ...ev("b.test.mjs", 1, { todo: true })] }, /b\.test\.mjs: 1 todo/);
  fails({ events: [...ev("a.test.mjs", 2), ...ev("b.test.mjs", 1, { event: "test:fail", failureType: "cancelledByParent" })] }, /b\.test\.mjs: 1 cancelled/);
  fails({ events: [...ev("a.test.mjs", 2), ...ev("b.test.mjs", 1, { event: "test:fail", failureType: "testCodeFailure" })] }, /b\.test\.mjs: 1 fail/);
  fails({ discovered: ["a.test.mjs", "b.test.mjs", "c.test.mjs", "new.test.mjs"] }, /new\.test\.mjs is neither in the manifest nor excluded/);
  fails({ discovered: ["a.test.mjs", "c.test.mjs"] }, /manifest file b\.test\.mjs does not exist/);
  fails({ tap: { ...okTap, tests: 2, pass: 2 } }, /TAP summary: 2 tests/);
  fails({ tap: {} }, /no TAP summary/);
  fails({ violations: 1 }, /1 non-loopback/);
  fails({ manifest: { ...tiny, total: 4 } }, /manifest inconsistent/);
  // suites are containers, not tests (node's summary counts tests only)
  assert.equal(evaluateManifest({ ...okRun(), events: [...okRun().events, { event: "test:pass", file: "a.test.mjs", type: "suite" }] }).ok, true);
  assert.deepEqual(parseTapSummary("# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"), okTap);
});
test("manifest reporter on a real node --test run: per-file counts, a skipped test and a suite that never loaded are all caught", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "g0-manifest-"));
  const events = path.join(dir, "events.jsonl");
  const tapFile = path.join(dir, "tap.txt");
  const files = ["alpha.fixture.mjs", "beta.fixture.mjs", "broken.fixture.mjs"].map((f) => path.join(FIXTURES, f));
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // a nested node --test would otherwise report to THIS runner and ignore its reporters
  spawnSync(process.execPath, ["--test", "--test-reporter=tap", `--test-reporter-destination=${tapFile}`, `--test-reporter=${pathToFileURL(MANIFEST_TOOL).href}`, `--test-reporter-destination=${events}`, ...files], { cwd: FIXTURES, encoding: "utf8", timeout: 60_000, env });
  const parsed = parseEvents(fs.readFileSync(events, "utf8"));
  assert.deepEqual(parsed.bad, []);
  const manifest = { name: "fixtures", files: { "alpha.fixture.mjs": 2, "beta.fixture.mjs": 2, "broken.fixture.mjs": 1 }, excluded: {}, total: 5 };
  const r = evaluateManifest({ manifest, events: parsed.events, tap: parseTapSummary(fs.readFileSync(tapFile, "utf8")), discovered: null, violations: 0 });
  assert.deepEqual(r.perFile["alpha.fixture.mjs"], { expected: 2, tests: 2, pass: 2, fail: 0, skipped: 0, todo: 0, cancelled: 0 });
  assert.equal(r.perFile["beta.fixture.mjs"].skipped, 1);
  assert.equal(r.perFile["broken.fixture.mjs"].fail, 1, "a suite that fails to load is reported as a failure of that file");
  assert.equal(r.ok, false);
  // only alpha passes cleanly; a manifest of alpha alone with beta never run is still caught as missing
  const alphaOnly = evaluateManifest({ manifest: { name: "a", files: { "alpha.fixture.mjs": 2, "beta.fixture.mjs": 2 }, excluded: {}, total: 4 }, events: parsed.events.filter((e) => e.file === "alpha.fixture.mjs"), tap: { tests: 2, pass: 2, fail: 0, cancelled: 0, skipped: 0, todo: 0 }, discovered: null, violations: 0 });
  assert.ok(alphaOnly.problems.some((m) => /beta\.fixture\.mjs: did not run/.test(m)));
  // the CLI refuses when the reporter produced nothing
  const cli = spawnSync(process.execPath, [MANIFEST_TOOL, "check", "--manifest", "p7", "--events", path.join(dir, "none.jsonl"), "--tap", tapFile, "--test-dir", "ops/test", "--violations", "0"], { cwd: REPO, encoding: "utf8" });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /no per-test event file/);
});
test("P7 manifest matches this repository: listed + excluded = ops/test/*.test.mjs, total = sum, static test() counts agree; harness P7 enforces it", () => {
  const discovered = fs.readdirSync(path.join(REPO, "ops", "test")).filter((n) => n.endsWith(".test.mjs")).map((n) => `ops/test/${n}`).sort();
  assert.deepEqual([...Object.keys(P7_MANIFEST.files), ...Object.keys(P7_MANIFEST.excluded)].sort(), discovered);
  assert.equal(Object.values(P7_MANIFEST.files).reduce((a, b) => a + b, 0), P7_MANIFEST.total);
  for (const [file, expected] of Object.entries(P7_MANIFEST.files)) {
    const text = fs.readFileSync(path.join(REPO, file), "utf8");
    assert.equal((text.match(/^\s*(test|it)\(/gm) ?? []).length, expected, `${file}: update the manifest in the same commit as its tests`);
    assert.doesNotMatch(text, /^\s*(describe|test|it)\.(skip|todo|only)\(|^\s*(describe|test|it)\(\s*("[^"]*"|'[^']*'|`[^`]*`)\s*,\s*\{[^}]*\b(skip|todo|only)\s*:/m, `${file}: skip / todo / only is not allowed in a P7 suite`);
  }
  const listed = spawnSync(process.execPath, [MANIFEST_TOOL, "files", "--manifest", "p7"], { encoding: "utf8" });
  assert.deepEqual(listed.stdout.trim().split("\n"), Object.keys(P7_MANIFEST.files));
  const harnessText = fs.readFileSync(path.join(H, "Test-G0Harness.ps1"), "utf8");
  const p7 = harnessText.slice(harnessText.indexOf("# P7 -"), harnessText.indexOf("# P11 -"));
  assert.match(p7, /Invoke-Node 'p7-manifest-files' @\(\$manifestTool, 'files', '--manifest', 'p7'\)/);
  assert.match(p7, /\('--test-reporter=' \+ \(\[Uri\]\$manifestTool\)\.AbsoluteUri\), "--test-reporter-destination=\$eventsFile"/);
  assert.match(p7, /Invoke-Node 'p7-manifest-check' @\(\$manifestTool, 'check', '--manifest', 'p7', '--events', \$eventsFile, '--tap', \$suite\.stdout, '--test-dir', 'ops\/test', '--violations', "\$violations"/);
  for (const cond of ["($manifestCheck.status -eq 'OK')", "($verdict.ok -eq $true)", "($count['fail'] -eq 0)", "($count['skipped'] -eq 0)", "($count['cancelled'] -eq 0)", "($count['todo'] -eq 0)", "($count['tests'] -eq $verdict.expected)", "($violations -eq 0)"])
    assert.ok(p7.includes(cond), `P7 no longer requires ${cond}`);
  assert.doesNotMatch(p7, /Get-ChildItem/, "P7 must run the manifest's files, not whatever a directory listing returns");
});
