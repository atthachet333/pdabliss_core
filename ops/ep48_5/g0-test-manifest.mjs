#!/usr/bin/env node
// PDA BLISS CORE — EP48.5 verifiable test manifest for Windows harness P7 (G0 run 3 readiness,
// docs/EP48_5_G0_RUN3_READINESS.md).
//
// P7 used to accept "0 fail, 0 skipped and pass = tests": a test file that silently stopped running would still pass.
// Now every file and its exact test count are listed here; P7 runs exactly these files with this module as a second
// node --test reporter (one JSON line per test, with its file) and `check` requires, per file, exactly the expected
// number of tests, all passed, 0 failed / skipped / todo / cancelled, no test from an unlisted file, every ops/test
// file either listed or excluded with a reason, the TAP summary agreeing, and 0 non-loopback attempts.
// A count change must be made HERE, in the same commit as the tests, with its reason in the commit / docs.
//
//   node ops/ep48_5/g0-test-manifest.mjs files --manifest p7
//   node --test --test-reporter=tap --test-reporter-destination=stdout \
//        --test-reporter=<file URL of this module> --test-reporter-destination=<events.jsonl> <files…>
//   node ops/ep48_5/g0-test-manifest.mjs check --manifest p7 --events <events.jsonl> --tap <tap.txt> \
//        --test-dir ops/test --violations <n> --out <verdict.json>          (exit 0 = exactly the manifest, all passed)
import fs from "node:fs";
import path from "node:path";

export const P7_MANIFEST = Object.freeze({
  name: "p7",
  // C-A0.4 (G0 run 3 readiness): g0-preflight 6 -> 9 (+3 manifest), g0-supervisor 27 -> 37 (+10 run-3 readiness).
  // EP48.5 O1 (online tooling): g0-supervisor 37 -> 40 (+3 R16 CORE-vs-production identity); new g0-online 9 (online
  // checks, tunnel / Access specs, WinSW templates); new staging-launch.online 13 (online launcher profile, static server).
  // EP48.5 FINAL (F1/F2): staging-launch.online 13 -> 14 (+1 O-L12 invitation-only sign-up + manual-activation allow-list).
  files: Object.freeze({
    "ops/test/g0-guard.test.mjs": 18,
    "ops/test/g0-loopback.test.mjs": 4,
    "ops/test/g0-online.test.mjs": 9,
    "ops/test/g0-preflight.test.mjs": 9,
    "ops/test/g0-supervisor.test.mjs": 40,
    "ops/test/staging-launch.online.test.mjs": 14,
    "ops/test/staging-launch.test.mjs": 40,
  }),
  excluded: Object.freeze({
    "ops/test/ops.test.mjs": "EP43 suite: needs the backend's dependencies; runs in G0 ops-tests (exact total there)",
    "ops/test/staging-launch.g0.test.mjs": "T10: runs only inside G0 against the temporary PostgreSQL (exact total there)",
  }),
  total: 134,
});
export const MANIFESTS = Object.freeze({ p7: P7_MANIFEST });

const posix = (p) => String(p ?? "").replace(/\\/g, "/");
const relative = (file, cwd = process.cwd()) => (file ? posix(path.isAbsolute(file) ? path.relative(cwd, file) : file) : null);
const flag = (v) => v !== undefined && v !== null && v !== false;

/** node --test custom reporter: one JSON line per finished test or suite, with the file it came from. */
export default async function* manifestReporter(source) {
  for await (const event of source) {
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    const d = event.data ?? {};
    yield `${JSON.stringify({ event: event.type, file: relative(d.file), nesting: d.nesting ?? null, name: d.name ?? null, type: d.details?.type ?? null, skip: flag(d.skip), todo: flag(d.todo), failureType: d.details?.error?.failureType ?? null })}\n`;
  }
}

export function parseTapSummary(text) {
  const n = (k) => Number((new RegExp(`^# ${k} (\\d+)\\s*$`, "m").exec(String(text ?? "")) ?? [])[1] ?? NaN);
  return { tests: n("tests"), pass: n("pass"), fail: n("fail"), cancelled: n("cancelled"), skipped: n("skipped"), todo: n("todo") };
}
export function parseEvents(text) {
  const events = [];
  const bad = [];
  for (const [i, line] of String(text ?? "").split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      bad.push(i + 1);
    }
  }
  return { events, bad };
}

/** Pure: does the run match the manifest exactly? */
export function evaluateManifest({ manifest, events, tap, discovered, violations }) {
  const problems = [];
  const listed = Object.keys(manifest.files);
  const sum = Object.values(manifest.files).reduce((a, b) => a + b, 0);
  if (sum !== manifest.total) problems.push(`manifest inconsistent: its files add up to ${sum}, its total is ${manifest.total}`);
  const perFile = Object.fromEntries(listed.map((f) => [f, { expected: manifest.files[f], tests: 0, pass: 0, fail: 0, skipped: 0, todo: 0, cancelled: 0 }]));
  const unknown = {};
  for (const e of events) {
    if (e?.type !== "test") continue; // suites are containers; node's own summary counts tests only
    const row = perFile[e.file];
    if (!row) {
      unknown[String(e.file)] = (unknown[String(e.file)] ?? 0) + 1;
      continue;
    }
    row.tests += 1;
    if (e.event === "test:fail") row[e.failureType === "cancelledByParent" ? "cancelled" : "fail"] += 1;
    else if (e.skip) row.skipped += 1;
    else if (e.todo) row.todo += 1;
    else row.pass += 1;
  }
  for (const [f, r] of Object.entries(perFile)) {
    if (r.tests === 0) problems.push(`${f}: did not run (0 tests reported; expected ${r.expected})`);
    else if (r.tests !== r.expected) problems.push(`${f}: ${r.tests} tests ran, ${r.expected} expected`);
    for (const k of ["fail", "skipped", "todo", "cancelled"]) if (r[k]) problems.push(`${f}: ${r[k]} ${k}`);
    if (r.tests && r.pass !== r.tests) problems.push(`${f}: ${r.pass} of ${r.tests} passed`);
  }
  for (const [f, n] of Object.entries(unknown)) problems.push(`${n} test(s) from a file that is not in the manifest: ${f}`);
  if (discovered) {
    const known = new Set([...listed, ...Object.keys(manifest.excluded ?? {})]);
    for (const f of discovered) if (!known.has(f)) problems.push(`test file ${f} is neither in the manifest nor excluded with a reason`);
    for (const f of known) if (!discovered.includes(f)) problems.push(`manifest file ${f} does not exist`);
  }
  const t = tap ?? {};
  if (!Number.isFinite(t.tests)) problems.push("no TAP summary (the run did not finish)");
  else {
    if (t.tests !== manifest.total || t.pass !== manifest.total) problems.push(`TAP summary: ${t.tests} tests, ${t.pass} passed; ${manifest.total} expected`);
    for (const k of ["fail", "cancelled", "skipped", "todo"]) if (t[k] !== 0) problems.push(`TAP summary: ${k} ${t[k]}`);
  }
  if (!Number.isInteger(violations)) problems.push("non-loopback attempt count unknown");
  else if (violations !== 0) problems.push(`${violations} non-loopback listen / bind attempt(s)`);
  const totals = Object.values(perFile).reduce((a, r) => ({ tests: a.tests + r.tests, pass: a.pass + r.pass, fail: a.fail + r.fail, skipped: a.skipped + r.skipped, todo: a.todo + r.todo, cancelled: a.cancelled + r.cancelled }), { tests: 0, pass: 0, fail: 0, skipped: 0, todo: 0, cancelled: 0 });
  return { ok: problems.length === 0, manifest: manifest.name, expected: manifest.total, totals, perFile, unknownFiles: unknown, problems };
}

function argOf(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
function main(argv) {
  const manifest = MANIFESTS[argOf(argv, "manifest") ?? ""];
  if (!manifest) throw new Error(`--manifest must be one of: ${Object.keys(MANIFESTS).join(", ")}`);
  if (argv[0] === "files") {
    process.stdout.write(`${Object.keys(manifest.files).join("\n")}\n`);
    return 0;
  }
  if (argv[0] === "check") {
    const read = (f) => (f && fs.existsSync(f) ? fs.readFileSync(f, "utf8").replace(/^﻿/, "") : null);
    const eventsText = read(argOf(argv, "events"));
    const { events, bad } = parseEvents(eventsText);
    const testDir = posix(argOf(argv, "test-dir") ?? "ops/test").replace(/\/+$/, "");
    const discovered = fs.existsSync(testDir) ? fs.readdirSync(testDir).filter((n) => n.endsWith(".test.mjs")).map((n) => `${testDir}/${n}`).sort() : [];
    const violations = Number.parseInt(argOf(argv, "violations") ?? "", 10);
    const verdict = evaluateManifest({ manifest, events, tap: parseTapSummary(read(argOf(argv, "tap"))), discovered, violations: Number.isInteger(violations) ? violations : NaN });
    if (eventsText === null) verdict.problems.unshift("no per-test event file (the manifest reporter did not run)");
    if (bad.length) verdict.problems.unshift(`event file has ${bad.length} unreadable line(s)`);
    verdict.ok = verdict.problems.length === 0;
    const out = argOf(argv, "out");
    if (out) fs.writeFileSync(out, `${JSON.stringify(verdict, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ ok: verdict.ok, expected: verdict.expected, tests: verdict.totals.tests, problems: verdict.problems })}\n`);
    return verdict.ok ? 0 : 1;
  }
  throw new Error("usage: files | check (see the header)");
}
if (path.basename(process.argv[1] ?? "") === "g0-test-manifest.mjs") {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    process.stderr.write(`[g0-test-manifest] ERROR: ${e.message}\n`);
    process.exit(1);
  }
}
