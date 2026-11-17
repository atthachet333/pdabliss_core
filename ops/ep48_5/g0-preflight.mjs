#!/usr/bin/env node
// PDA BLISS CORE — EP48.5 A-0.1: G0 preflight, static and self-test part (called by g0-harness\Preflight-G0.ps1).
//
//   node ops\ep48_5\g0-preflight.mjs --src <repository>          prints one JSON document; exit 0 = PASS, 1 = BLOCK
//
// READ-ONLY. It reads files and runs one child `node` whose every listen attempt is refused by the loopback guard
// before a socket exists. No npm, no database, no migration, no service, no listener, nothing written or deleted.
//
// Checks
//   C1 constants      the guard and the runner both target 127.0.0.1:55443 only
//   C2 runner         every step goes through g0-guard.mjs; no DATABASE_URL / PG* / NODE_OPTIONS assignment; no 5432;
//                     no database tool outside the guard; nothing deleted; preflight runs first; instance identity recorded
//   C3 supervisor     incident replay: the 2026-11-17 baseline and a healthy round give 0 findings; a production port on
//                     0.0.0.0 is NOT a temporary-instance finding; 55443 on 0.0.0.0 IS; the retired PS monitor is gone
//   C10 PowerShell    one spelling per variable, no loop / assignment reusing a script parameter (incident cause 1)
//   C4 harness URLs   every connection string in the harness and the guard targets port 55443 (marked refusal fixtures excepted)
//   C5 backend Prisma every Prisma CLI call in the backend test setup passes DATABASE_URL explicitly
//   C6 listeners      no test / harness file listens on a wildcard address, without an address, or on a bare port
//   C7 wiring         every guard target preloads the loopback guard; static / none / test targets are explicit
//   C8 loopback guard self-test: 0.0.0.0, ::, no address, a LAN address and a UDP wildcard bind are all refused, no socket
//   C9 ops discovery  the ops test files are listed explicitly (no directory argument), concurrency 2
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { G0, OPS_TEST_FLAGS, PRELOAD, STATIC_DATABASE_URL, childEnv, discoverOpsTests, opsTestArgs } from "./g0-guard.mjs";
import { evaluateRound, normalizeFacts, normalizeHttpBaseline, validateHttpBaseline } from "./g0-supervisor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ALLOW_FIXTURE = "g0-preflight: allowed-fixture";
const ALLOW_REFUSED = "g0-preflight: refused-by-guard";
const codeLines = (text) => text.split(/\r?\n/).map((l, i) => ({ n: i + 1, l })).filter(({ l }) => !/^\s*#/.test(l));

/** C1 + C2: the runner's text (Run-G0 v3). Returns a list of problems (empty = pass). */
export function checkRunner(text) {
  const p = [];
  const lines = codeLines(text);
  const allowedPhaseFiles = /-FilePath\s+(\$script:NodeExe\s+-ArgumentValues\s+@\(\$Supervisor,|\$script:GitExe\b|\(Join-Path \$PgBin '(initdb|pg_ctl|pg_controldata)\.exe'\)|\$script:PowerShellExe\s+-ArgumentValues\s+@\('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', \(Join-Path \$(HarnessDir 'Preflight-G0|Dev 'ops\\ep48_5\\Collect-HostAudit)\.ps1'\))/;
  if (!lines.some(({ l }) => /^\s*\$TempPgPort\s*=\s*55443\s*$/.test(l))) p.push("runner: $TempPgPort is not 55443");
  for (const { n, l } of lines) {
    if (/^\s*Step\s+'/.test(l)) {
      if (!/^\s*Step\s+'[a-z0-9-]+'\s+@\('(exec|check|create-test-db|backend-tests|frontend-tests|ops-tests)'/.test(l)) p.push(`runner line ${n}: a project step that does not run through g0-guard.mjs`);
      if (/@\('exec'/.test(l) && !/'--target',\s*'(none|static|test)'/.test(l)) p.push(`runner line ${n}: an exec step without an explicit --target`);
    }
    if (/Invoke-G0Phase\s+-Name\s+'/.test(l) && !allowedPhaseFiles.test(l)) p.push(`runner line ${n}: an infrastructure phase runs a program outside the allow-list`);
    if (/\*>|\s2>&1|\s>\s*\$|\bOut-File\b/.test(l)) p.push(`runner line ${n}: output redirection of a program (a pipe can block the runner; use Invoke-G0Bounded)`);
    if (/^\s*(\$\w+\s*=\s*)?Native\b/.test(l)) p.push(`runner line ${n}: the retired Native helper (pipe capture) is used`);
    if (/\bStart-Job\b|\btaskkill\b|\bStop-Process\b|\.Kill\(/i.test(l)) p.push(`runner line ${n}: background job or direct process termination (only g0-supervisor.mjs stop-tree may stop a process)`);
    if (/\bStart-Process\b/.test(l) && !/\$Supervisor, 'monitor'|\$monitorArgLine/.test(l)) p.push(`runner line ${n}: Start-Process outside Invoke-G0Bounded (only the monitor is started directly)`);
    if (/--facts-module|--interval-ms|--ack-timeout-ms/.test(l)) p.push(`runner line ${n}: a supervisor test hook is used`);
    if (/\$PgBin\b/.test(l) && !/Invoke-G0Phase -Name '|'-PgBin', \$PgBin|^\s*\[string\]\$PgBin\s*=/.test(l)) p.push(`runner line ${n}: a PostgreSQL program is used outside the bounded helper (Invoke-G0Phase)`);
    if (/\$env:(DATABASE_URL|DIRECT_URL|SHADOW_DATABASE_URL|NODE_OPTIONS|PG[A-Za-z_]+)\s*=/i.test(l)) p.push(`runner line ${n}: sets a database / PG* / NODE_OPTIONS variable directly`);
    if (/\b5432\b/.test(l)) p.push(`runner line ${n}: mentions port 5432 outside a comment`);
    if (/\b(createdb|dropdb|psql|pg_restore|pg_dump)(\.exe)?\b/i.test(l)) p.push(`runner line ${n}: a database tool outside the guard`);
    for (const m of l.matchAll(/Remove-Item\s+(?:-Path\s+)?(\S+)/gi))
      if (!/^["']?Env:/i.test(m[1])) p.push(`runner line ${n}: deletes something other than an environment variable`);
    if (/\b(rmdir|Clear-Content|Remove-ItemProperty)\b|\b(rm|rd|del)\s+[-/"'$\w]/i.test(l)) p.push(`runner line ${n}: a delete command`);
    if (/DROP\s+(DATABASE|SCHEMA|ROLE|TABLE)/i.test(l)) p.push(`runner line ${n}: a DROP statement`);
  }
  const firstStep = lines.find(({ l }) => /^\s*Step\s+'/.test(l));
  const preflight = lines.find(({ l }) => /Invoke-G0Phase -Name 'preflight'/.test(l));
  const monitorStart = lines.find(({ l }) => /\$script:MonitorProc = Start-Process/.test(l));
  if (!preflight || (firstStep && preflight.n > firstStep.n)) p.push("runner: Preflight-G0.ps1 is not run before the first step");
  if (!monitorStart || (firstStep && monitorStart.n > firstStep.n)) p.push("runner: the supervisor monitor is not started before the first step");
  if (!lines.some(({ l }) => /\$monitorBaseline\.valid -ne \$true/.test(l))) p.push("runner: an invalid monitor baseline does not stop G0");
  if (!lines.some(({ l }) => /\$env:CORE_G0_PG_SYSID\s*=/.test(l)) || !lines.some(({ l }) => /pg_controldata\.exe/.test(l)))
    p.push("runner: the temporary instance's system identifier is not recorded from pg_controldata");
  if (!lines.some(({ l }) => /Invoke-G0Phase -Name 'temp-pg-start' -FilePath \(Join-Path \$PgBin 'pg_ctl\.exe'\)/.test(l))) p.push("runner: pg_ctl start is not run through the bounded helper");
  if (!lines.some(({ l }) => /'temp-pg-identity-before-stop'/.test(l)) || !lines.some(({ l }) => /'temp-pg-stop'.*'stop', '-m', 'fast'/.test(l))) p.push("runner: the temporary PostgreSQL is not stopped with a verified, graceful pg_ctl stop");
  return p;
}

/** C3: the supervisor replays the incident correctly (pure functions, no I/O). */
export function checkSupervisor({ src }) {
  const p = [];
  if (fs.existsSync(path.join(src, "ops", "ep48_5", "g0-harness", "g0-monitor.ps1"))) p.push("the retired PowerShell monitor g0-monitor.ps1 is still present");
  const fx = path.join(src, "ops", "test", "g0-fixtures", "incident-20261117");
  const legacy = JSON.parse(fs.readFileSync(path.join(fx, "baseline.json"), "utf8").replace(/^\uFEFF/, ""));
  const facts = normalizeFacts(JSON.parse(fs.readFileSync(path.join(fx, "facts.json"), "utf8")));
  const http = normalizeHttpBaseline(legacy.http, legacy.listeners);
  p.push(...validateHttpBaseline(http).map((x) => `incident baseline: ${x}`));
  const baseline = { tree: legacy.tree, infra: legacy.infra, http };
  const healthy = new Map(http.map((e) => [e.appPort, { status: e.status, ms: 2 }]));
  const ctx = { tempPgPort: 55443, g0Pids: new Set([23604, 24376, 32200, 26852, 4996]), g0Dir: "D:\\pdabliss-core-staging\\gates\\g0-20261117-134458" };
  const r1 = evaluateRound({ baseline, facts, probes: healthy, state: {}, ctx });
  if (r1.findings.length) p.push(`incident replay: a healthy round gave ${r1.findings.length} finding(s): ${r1.findings.map((f) => f.message).join("; ")}`);
  const exposed = { ...facts, listeners: facts.listeners.map((l) => (l.port === 55443 ? { ...l, address: "0.0.0.0" } : l)) };
  const r2 = evaluateRound({ baseline, facts: exposed, probes: healthy, state: {}, ctx });
  if (!r2.findings.some((f) => f.key.startsWith("temp-pg-address"))) p.push("incident replay: 55443 on 0.0.0.0 was not detected");
  return p;
}

/** C10: PowerShell variable-name hazards (incident cause 1). Pure text analysis; the host preflight repeats it with the AST. */
export function psVariableProblems(text, label = "script") {
  const p = [];
  const code = text.replace(/<#[\s\S]*?#>/g, "").split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join("\n");
  const spellings = new Map();
  for (const m of code.matchAll(/\$(?:\{([^}]+)\}|((?:[A-Za-z]+:)?[A-Za-z_][A-Za-z0-9_]*))/g)) {
    const raw = m[1] ?? m[2];
    if (/^env:/i.test(raw)) continue;
    const bare = raw.replace(/^(script|global|local|private|using):/i, "");
    const lower = bare.toLowerCase();
    if (!spellings.has(lower)) spellings.set(lower, new Set());
    spellings.get(lower).add(bare);
  }
  for (const [, set] of spellings) if (set.size > 1) p.push(`${label}: one variable with several spellings: ${[...set].sort().join(" / ")}`);
  const pm = /(^|\n)\s*(\[CmdletBinding\([^)]*\)\]\s*)?param\s*\(/i.exec(code);
  if (pm) {
    let depth = 0;
    let i = pm.index + pm[0].length - 1;
    const start = i;
    for (; i < code.length; i++) {
      if (code[i] === "(") depth++;
      else if (code[i] === ")" && --depth === 0) break;
    }
    const block = code.slice(start, i + 1);
    const params = new Set([...block.matchAll(/\]\s*\$([A-Za-z_]\w*)|^\(?\s*\$([A-Za-z_]\w*)|,\s*\$([A-Za-z_]\w*)/gm)].map((x) => (x[1] ?? x[2] ?? x[3]).toLowerCase()));
    const rest = code.slice(0, pm.index) + code.slice(i + 1);
    for (const m of rest.matchAll(/foreach\s*\(\s*\$([A-Za-z_]\w*)\s+in\b/gi)) if (params.has(m[1].toLowerCase())) p.push(`${label}: foreach variable $${m[1]} reuses a script parameter`);
    for (const m of rest.matchAll(/\$([A-Za-z_]\w*)(?:\s*(?:=(?!=)|\+=|-=|\*=|\/=)|\+\+|--(?![\w-]|\s+\w))/g)) if (params.has(m[1].toLowerCase())) p.push(`${label}: assignment to the script parameter $${m[1]}`);
  }
  return p;
}

/** C4: connection strings with a literal port must use 55443 unless marked as a refusal / stand-in fixture. */
export function scanConnectionStrings(files) {
  const p = [];
  for (const f of files) {
    fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((l, i) => {
      for (const m of l.matchAll(/postgres(?:ql)?:\/\/[^\s"'`]*?@([^\s/:"'`]+):(\d+)/g))
        if (m[2] !== String(G0.port) && !l.includes(ALLOW_FIXTURE)) p.push(`${path.basename(f)}:${i + 1}: connection string to port ${m[2]}`);
    });
  }
  return p;
}

/** C5: every Prisma CLI call in the backend test setup passes DATABASE_URL explicitly (prisma.config.ts falls back to 5432). */
export function checkBackendPrisma(files) {
  const p = [];
  let calls = 0;
  for (const f of files) {
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((l, i) => {
      if (/\[\s*['"]prisma['"]\s*,/.test(l) || /['"]prisma\s+(migrate|db)\b/.test(l)) {
        calls++;
        if (!lines.slice(i, i + 5).some((x) => /DATABASE_URL\s*:/.test(x))) p.push(`${path.basename(f)}:${i + 1}: a Prisma CLI call without an explicit DATABASE_URL`);
      }
    });
  }
  return { problems: p, calls };
}

/** C6: listen calls in test / harness code. Wildcard, address-less and bare-port listens are refused (the firewall is off). */
export function scanListenCalls(files) {
  const p = [];
  let calls = 0;
  for (const f of files) {
    fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((l, i) => {
      if (!/\.listen\(/.test(l)) return;
      calls++;
      if (l.includes(ALLOW_REFUSED)) return;
      const bad =
        /\.listen\([^)]*(['"`])(0\.0\.0\.0|::|\[::\])\1/.test(l) || // a wildcard literal
        /\.listen\(\s*\)/.test(l) || // no arguments: every interface
        /\.listen\(\s*[^,(){}]+\)/.test(l) || // a port only: every interface
        /\.listen\(\s*[^,(){}]+,\s*(\d+\s*[,)]|\(|function\b|\w+\s*\))/.test(l) || // port + backlog / callback, no address
        (/\.listen\(\s*\{/.test(l) && !/\bhost\s*:/.test(l)); // options without host
      if (bad) p.push(`${path.relative(process.cwd(), f)}:${i + 1}: listen without an explicit loopback address`);
    });
  }
  return { problems: p, calls };
}

/** C7: every target is explicit and preloads the loopback guard. */
export function checkWiring({ preloadFile = PRELOAD } = {}) {
  const p = [];
  if (!fs.existsSync(preloadFile)) p.push("the loopback preload file is missing");
  const base = { PATH: "x", PGHOST: "10.0.0.5", PgPort: "5432", DATABASE_URL: "postgresql://a@127.0.0.1:5432/pda_one_test", NODE_OPTIONS: "--inspect" };
  const url = `postgresql://gate:pw@${G0.host}:${G0.port}/${G0.testDatabase}`;
  for (const target of ["none", "static", "test"]) {
    const e = childEnv(base, { target, testUrl: url, gates: HERE, systemId: "7312345678901234567", loopbackDir: HERE, preloadFile });
    if (e.NODE_OPTIONS !== `--import=${pathToFileURL(preloadFile).href}`) p.push(`${target}: NODE_OPTIONS is not exactly the loopback preload`);
    if (Object.keys(e).some((k) => /^PG/i.test(k))) p.push(`${target}: a PG* variable reaches the child`);
    const want = target === "static" ? STATIC_DATABASE_URL : undefined;
    if (e.DATABASE_URL !== want) p.push(`${target}: DATABASE_URL is not the explicit target`);
    if (target === "test" ? e.TEST_DATABASE_URL !== url : e.TEST_DATABASE_URL !== undefined) p.push(`${target}: TEST_DATABASE_URL is not as expected`);
  }
  if (!STATIC_DATABASE_URL.includes(`@${G0.host}:${G0.port}/`)) p.push("the static Prisma target is not the temporary instance");
  return p;
}

/** C8: a real child node with the preload; every attempt must be refused BEFORE a socket exists. Binds nothing. */
export function loopbackSelfTest({ preloadFile = PRELOAD } = {}) {
  const script = `
    const net = require("node:net"), dgram = require("node:dgram");
    const tries = [["0.0.0.0", (s) => s.listen(0, "0.0.0.0")], ["::", (s) => s.listen(0, "::")], ["no address", (s) => s.listen(0)],
      ["options without host", (s) => s.listen({ port: 0 })], ["LAN address", (s) => s.listen(0, "192.168.1.10")], ["port + backlog", (s) => s.listen(0, 511)]];
    const out = [];
    for (const [name, f] of tries) { const s = net.createServer(); let code = "bound"; try { f(s); } catch (e) { code = e.code; } out.push({ name, code, listening: s.listening }); try { s.close(); } catch {} }
    const u = dgram.createSocket("udp4"); let ucode = "bound"; try { u.bind(0); } catch (e) { ucode = e.code; } out.push({ name: "udp wildcard", code: ucode, listening: false }); try { u.close(); } catch {}
    process.stdout.write(JSON.stringify(out));`;
  const env = { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "" };
  const r = spawnSync(process.execPath, [`--import=${pathToFileURL(preloadFile).href}`, "-e", script], { env, encoding: "utf8", timeout: 20000 });
  let results = [];
  try {
    results = JSON.parse(r.stdout);
  } catch {
    return { problems: [`self-test did not run (exit ${r.status}): ${(r.stderr ?? "").slice(0, 300)}`], results };
  }
  const problems = results.filter((x) => x.code !== "G0_NON_LOOPBACK_LISTEN" || x.listening).map((x) => `self-test: "${x.name}" was not refused (${x.code})`);
  if (results.length !== 7) problems.push(`self-test: ${results.length} of 7 cases ran`);
  return { problems, results };
}

function walk(dir, keep, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, keep, out);
    else if (keep(p)) out.push(p);
  }
  return out;
}

export function testAndHarnessFiles(src) {
  return [
    ...walk(path.join(src, "backend", "test"), (p) => /\.(ts|mts|js|mjs)$/.test(p)),
    ...walk(path.join(src, "frontend", "src"), (p) => /\.test\.(ts|tsx)$/.test(p) || /[\\/]src[\\/]test[\\/]/.test(p)),
    ...walk(path.join(src, "ops", "test"), (p) => p.endsWith(".mjs")),
    ...walk(path.join(src, "ops", "ep48_5", "g0-harness"), (p) => p.endsWith(".mjs")),
  ].sort();
}

export function runPreflight({ src }) {
  const checks = [];
  const add = (id, name, problems, detail) => checks.push({ id, name, ok: problems.length === 0, problems, ...(detail === undefined ? {} : { detail }) });
  const harness = path.join(src, "ops", "ep48_5", "g0-harness");
  const read = (f) => fs.readFileSync(f, "utf8");
  add("C1", "constants: 127.0.0.1:55443 only", G0.host === "127.0.0.1" && G0.port === 55443 ? [] : ["g0-guard.mjs G0 constants changed"], { host: G0.host, port: G0.port });
  add("C2", "runner routes everything through the guard", checkRunner(read(path.join(harness, "Run-G0.ps1"))));
  add("C3", "supervisor replays the incident correctly; PS monitor retired", checkSupervisor({ src }));
  const urlFiles = [...walk(harness, (p) => p.endsWith(".mjs")), path.join(src, "ops", "ep48_5", "g0-guard.mjs")];
  add("C4", "harness connection strings target 55443", scanConnectionStrings(urlFiles), { files: urlFiles.length });
  const bp = checkBackendPrisma(walk(path.join(src, "backend", "test"), (p) => /\.(ts|mts|js|mjs)$/.test(p)));
  add("C5", "backend test Prisma calls are explicit", bp.problems, { prismaCalls: bp.calls, prismaConfigFallback: /localhost:5432/.test(read(path.join(src, "backend", "prisma.config.ts"))) ? "present in prisma.config.ts — never reached: every G0 Prisma call has an explicit DATABASE_URL" : "absent" });
  const tf = testAndHarnessFiles(src);
  const lc = scanListenCalls(tf);
  add("C6", "no wildcard / address-less listen in tests or harness", lc.problems, { files: tf.length, listenCalls: lc.calls });
  add("C7", "explicit targets + loopback preload on every guarded step", checkWiring());
  const st = loopbackSelfTest();
  add("C8", "loopback guard self-test (refusals only, no socket)", st.problems, { cases: st.results.map((x) => `${x.name}: ${x.code}`) });
  let files = [];
  const disc = [];
  try {
    files = discoverOpsTests(src);
    const args = opsTestArgs(files);
    for (const a of args.slice(OPS_TEST_FLAGS.length)) if (!fs.statSync(path.join(src, a)).isFile()) disc.push(`${a} is not a file`);
    if (!args.includes("--test-concurrency=2")) disc.push("ops test concurrency is not 2");
  } catch (e) {
    disc.push(e.message);
  }
  add("C9", "ops test discovery is explicit", disc, { files });
  const psFiles = [...walk(harness, (p) => p.endsWith(".ps1")), path.join(src, "ops", "ep48_5", "Collect-HostAudit.ps1")];
  add("C10", "PowerShell: one spelling per variable, no parameter reuse", psFiles.flatMap((f) => psVariableProblems(read(f), path.basename(f))), { files: psFiles.map((f) => path.basename(f)) });
  return { tool: "EP48.5 g0-preflight (static + self-test)", ok: checks.every((c) => c.ok), checks };
}

if (process.argv[1] && path.basename(process.argv[1]) === "g0-preflight.mjs") {
  const i = process.argv.indexOf("--src");
  const src = i > 0 ? process.argv[i + 1] : undefined;
  if (!src || !fs.existsSync(src)) {
    process.stderr.write("usage: node g0-preflight.mjs --src <repository>\n");
    process.exit(1);
  }
  const r = runPreflight({ src: path.resolve(src) });
  process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  process.exit(r.ok ? 0 : 1);
}
