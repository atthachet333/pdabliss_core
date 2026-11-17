// EP48.5 A-0.1 — the static / self-test part of the G0 preflight, against THIS repository and synthetic negatives.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkBackendPrisma, checkRunner, checkSupervisor, loopbackSelfTest, runPreflight, scanConnectionStrings, scanListenCalls } from "../ep48_5/g0-preflight.mjs";

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
