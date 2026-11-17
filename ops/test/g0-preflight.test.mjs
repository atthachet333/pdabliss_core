// EP48.5 A-0.1 — the static / self-test part of the G0 preflight, against THIS repository and synthetic negatives.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkBackendPrisma, checkMonitor, checkRunner, loopbackSelfTest, runPreflight, scanConnectionStrings, scanListenCalls } from "../ep48_5/g0-preflight.mjs";

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
  assert.deepEqual(r.checks.map((c) => c.id), ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"]);
  assert.ok(r.checks.find((c) => c.id === "C5").detail.prismaCalls >= 1, "the backend test setup's Prisma call is found and checked");
});

test("C2 runner: a step outside the guard, a direct DB / PG / NODE_OPTIONS variable, 5432, a DB tool, a delete → refused", () => {
  const good = fs.readFileSync(path.join(H, "Run-G0.ps1"), "utf8");
  assert.deepEqual(checkRunner(good), []);
  const bad = [
    "  Step 'x' $nodeExe @($npmCli, 'ci') $B",
    "  Step 'x' $nodeExe @($guard, 'exec', '--gates', $G, '--name', 'x', '--', $npmCli, 'ci') $B",
    "  $env:DATABASE_URL = 'postgresql://x@127.0.0.1:55443/y'",
    "  $env:PGPASSWORD = $pw",
    "  $env:NODE_OPTIONS = '--inspect'",
    "  $u = 'postgresql://a@127.0.0.1:5432/pda_one_test'",
    "  & \"$PgBin\\createdb.exe\" -p 55443 x",
    "  Remove-Item $G -Recurse",
    "  rmdir $G",
  ];
  for (const line of bad) assert.ok(checkRunner(good.replace("  Check-Stop\n  Remove-Item Env:TEST_DATABASE_URL", `${line}\n  Check-Stop\n  Remove-Item Env:TEST_DATABASE_URL`)).length >= 1, line);
  assert.ok(checkRunner(good.replace(/^.*Native powershell\.exe.*Preflight-G0\.ps1.*$/m, "")).some((p) => /Preflight/.test(p)));
  assert.ok(checkRunner(good.replace(/\$env:CORE_G0_PG_SYSID\s*=/, "$x =")).some((p) => /system identifier/.test(p)));
  assert.ok(checkRunner(good.replace("$Port = 55443", "$Port = 5433")).some((p) => /55443/.test(p)));
});

test("C3 monitor: a non-loopback G0 listener must stop G0 in the same round", () => {
  const good = fs.readFileSync(path.join(H, "g0-monitor.ps1"), "utf8");
  assert.deepEqual(checkMonitor(good), []);
  assert.ok(checkMonitor(good.replace("if ($exposed.Count) { Breach ", "if ($exposed.Count) { $strikesExpose++; if ($strikesExpose -ge 2) { Breach ")).length >= 1);
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
