#!/usr/bin/env node
// PDA BLISS CORE — EP48.5 G0 supervisor (G0 incident amendment, 2026-11-17; docs/EP48_5_G0_INCIDENT_20261117.md).
//
// Replaces the PowerShell monitor job (g0-monitor.ps1). Root cause of incident g0-20261117-134458: PowerShell
// variable names are case-insensitive, so the monitor's loop variable `$port` overwrote its `[int]$Port` parameter
// (55443) and was coerced to [int]; an ordered dictionary indexed by an [int] returns an entry BY POSITION, so every
// expected HTTP status and latency limit read as empty, and the "temporary instance" check inspected a production port.
// Here every decision is a pure, typed, unit-tested function. Windows facts come from g0-harness\g0-facts.ps1
// (read-only; one PowerShell call per round).
//
//   node g0-supervisor.mjs monitor          --out <G0\g0> --g0-dir <G0> --runner-pid <pid> --runner-created <iso> --temp-pg-port 55443
//   node g0-supervisor.mjs temp-pg-identity --out <G0\g0> --g0-dir <G0> --pg-data <G0\pg> --temp-pg-port 55443 --expect running|stopped
//   node g0-supervisor.mjs plan-stop-tree   --root <pid> --root-created <iso> --not-before <iso> --g0-dir <G0>        (plan only)
//   node g0-supervisor.mjs stop-tree        --root <pid> --root-created <iso> --not-before <iso> --g0-dir <G0> --out <G0\g0> --reason <text>
//   node g0-supervisor.mjs census           --out <file.json> --g0-dir <G0> --runner-pid <pid> --runner-created <iso> [--exit <name>=<code> …]
//                                           [--monitor-log <G0\g0\monitor.log>] [--stop-file <G0\g0\STOP>]
//   node g0-supervisor.mjs baseline         --out <file.json> --g0-dir <G0> --temp-pg-port 55443          (read-only, as the monitor's)
//   node g0-supervisor.mjs i5-check         --baseline <G0\g0\baseline.json> --out <file.json> --g0-dir <G0> --temp-pg-port 55443
//                                           --expect-endpoints <n>                                       (read-only; exit 0 = PASS only)
//   node g0-supervisor.mjs isolation        --out <file.json> [--window-minutes 180]                        (read-only; exit 1 = BLOCK)
//
// G0 run 2 (g0-20261117-161805, docs/EP48_5_G0_INCIDENT_20261117.md §6): the monitor and the backend-tests step ended
// together with exit code 0xFFFFFFFF and no output. Hence: the monitor keeps a heartbeat log (monitor.log) with an
// exit line and logs console / stop signals (raising STOP) - a missing exit line means another process terminated it;
// `census` records, at the moment G0 stops, which G0 processes are still alive and what each exit code means.
//
// G0 run 3 readiness (docs/EP48_5_G0_RUN3_READINESS.md): production preservation no longer depends on the monitor
// surviving. `i5-check` is run by the runner at shutdown in every outcome: it re-probes every production HTTP endpoint of
// the monitor's baseline (loopback only, GET /) and compares statuses AND the process identity (PID + start time) that
// owns each port, plus the PM2 tree, PostgreSQL, MariaDB, cloudflared and the production listeners. Only an explicit PASS
// with every expected endpoint checked passes the gate; a missing baseline, missing facts or an unprobed endpoint is
// MISSING / INCOMPLETE, never PASS. `isolation` classifies running development agents (never production) for the owner.
//
// Nothing here listens, connects to PostgreSQL or deletes anything. Processes are stopped only by `stop-tree`: each
// PID re-verified (start time) right before it is stopped, never a protected production process, never PostgreSQL
// (pg_ctl stop does that). C-A0.2 P4 fix: stop-tree plans from ONE process-only snapshot, verifies all targets with
// ONE filtered identity query and then polls cheap liveness - it no longer takes a full Windows snapshot per PID.
// Test hooks (`--facts-module`, `--interval-ms`, `--ack-timeout-ms`) exist for the unit tests; the runner never passes
// them (g0-preflight.mjs C2 checks it).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

export const TEMP_PG_HOST = "127.0.0.1";
export const LOOPBACK_ADDRESSES = Object.freeze(["127.0.0.1", "::1"]);
export const STAGING_PORTS = Object.freeze([1311, 1312, 5433]);
export const LIMITS = Object.freeze({
  cpuPct: 80, cpuRounds: 3, minFreeRamGB: 8, minFreeDiskDGB: 10, latencyRounds: 2, latencyFactor: 1.5, latencySlackMs: 50,
  factsRounds: 2, intervalMs: 15_000, ackTimeoutMs: 300_000, maxLifetimeMs: 8 * 3600_000, baselineSamples: 3,
});
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FACTS_SCRIPT = path.join(HERE, "g0-harness", "g0-facts.ps1");
export const TASKS_SCRIPT = path.join(HERE, "g0-harness", "g0-tasks.ps1");

// ---------------------------------------------------------------- typing helpers (PowerShell JSON is loosely typed)
const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]); // PS 5.1 ConvertTo-Json turns 1-element arrays into objects
export function toInt(v) {
  if (typeof v === "number") return Number.isInteger(v) ? v : NaN;
  if (typeof v === "string" && /^\s*-?\d+\s*$/.test(v)) return Number(v.trim());
  return NaN;
}
const toNum = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : NaN);
export const timeMs = (iso) => {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? t : NaN;
};
/** Same instant within 1 ms (CIM and .NET report the same creation time with different sub-millisecond digits). */
export const sameInstant = (a, b) => Number.isFinite(timeMs(a)) && Number.isFinite(timeMs(b)) && Math.abs(timeMs(a) - timeMs(b)) <= 1;
/** Windows path comparison form: backslashes, no trailing separator, lower case (postgres.exe shows forward slashes). */
export const normPath = (s) => String(s ?? "").replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();

export function normalizeFacts(raw) {
  const processes = asArray(raw?.processes)
    .map((p) => ({ pid: toInt(p?.pid), parent: toInt(p?.parent), name: String(p?.name ?? "").toLowerCase(), cmd: String(p?.cmd ?? ""), created: String(p?.created ?? "") }))
    .filter((p) => Number.isInteger(p.pid) && p.pid > 0);
  const listeners = asArray(raw?.listeners)
    .map((l) => ({ address: String(l?.address ?? ""), port: toInt(l?.port), pid: toInt(l?.pid) }))
    .filter((l) => Number.isInteger(l.port) && l.address);
  const to5432 = asArray(raw?.to5432).map((c) => ({ pid: toInt(c?.pid), local: String(c?.local ?? ""), remote: String(c?.remote ?? ""), state: String(c?.state ?? "") }));
  return { at: String(raw?.at ?? ""), processes, listeners, to5432, cpuPct: toNum(raw?.cpuPct), freeRamGB: toNum(raw?.freeRamGB), freeDiskDGB: toNum(raw?.freeDiskDGB) };
}
export const factsComplete = (f) => f.processes.length > 0 && Number.isFinite(f.cpuPct) && Number.isFinite(f.freeRamGB) && Number.isFinite(f.freeDiskDGB);

// ---------------------------------------------------------------- exit codes (Windows)
const EXIT_MEANINGS = new Map([
  [0, "normal exit"],
  [1, "error exit, or terminated by taskkill /F or Node process.kill (TerminateProcess with 1)"],
  [2, "the supervisor refused an invalid baseline"],
  [3, "plan refused (plan-stop-tree)"],
  [78, "launcher refusal"],
  [0xffffffff, "terminated by ANOTHER process with TerminateProcess(-1) - e.g. .NET Process.Kill / PowerShell Stop-Process; no code of the process itself ran"],
  [0xc000013a, "console Ctrl+C / Ctrl+Break / console closed (STATUS_CONTROL_C_EXIT)"],
  [0xc0000005, "crash: access violation"],
  [0xc0000409, "crash: fail-fast / stack buffer overrun (e.g. a V8 fatal error)"],
  [0xc00000fd, "crash: stack overflow"],
  [0xe0434352, ".NET unhandled exception"],
]);
/** Windows exit code → { code, hex, meaning }. Accepts signed (-1) or unsigned (4294967295) forms. */
export function describeExitCode(value) {
  const n = toInt(value);
  if (!Number.isInteger(n)) return { code: value ?? null, hex: null, meaning: "no exit code (still running, or unknown)" };
  const unsigned = n < 0 ? n + 2 ** 32 : n;
  const hex = `0x${unsigned.toString(16).toUpperCase().padStart(8, "0")}`;
  const meaning = EXIT_MEANINGS.get(unsigned) ?? (unsigned >= 0xc0000000 ? "crash or system termination (NTSTATUS)" : unsigned > 128 && unsigned < 160 ? `ended by signal ${unsigned - 128} (POSIX)` : "program-specific exit code");
  return { code: n, hex, meaning };
}

// ---------------------------------------------------------------- process tree
function indexFacts(facts) {
  const byPid = new Map(facts.processes.map((p) => [p.pid, p]));
  const kids = new Map();
  for (const p of facts.processes) {
    if (!kids.has(p.parent)) kids.set(p.parent, []);
    kids.get(p.parent).push(p);
  }
  return { byPid, kids };
}
/** Descendants of `rootPid`. A child must have been created at or after its parent (Windows reuses PIDs). */
export function descendants(facts, rootPid) {
  const { byPid, kids } = indexFacts(facts);
  const out = [];
  const seen = new Set([rootPid]);
  const queue = [rootPid];
  while (queue.length) {
    const current = queue.shift();
    const parent = byPid.get(current);
    for (const child of kids.get(current) ?? []) {
      if (seen.has(child.pid)) continue;
      if (parent && !(timeMs(child.created) >= timeMs(parent.created))) continue;
      seen.add(child.pid);
      out.push(child);
      queue.push(child.pid);
    }
  }
  return out;
}

const DAEMON_RE = /pm2[\\/]lib[\\/]daemon\.js/i;
/** Production identity: the PM2 daemon with the most children, its tree, the shared postmaster, MariaDB, cloudflared. */
export function identifyProduction(facts, { g0Dir } = {}) {
  const { byPid, kids } = indexFacts(facts);
  const g0 = g0Dir ? normPath(g0Dir) : null;
  const inG0 = (p) => Boolean(g0) && normPath(p.cmd).includes(g0);
  const daemons = facts.processes.filter((p) => p.name === "node.exe" && DAEMON_RE.test(p.cmd));
  const daemon = [...daemons].sort((a, b) => (kids.get(b.pid)?.length ?? 0) - (kids.get(a.pid)?.length ?? 0))[0] ?? null;
  const tree = {};
  const pm2Pids = new Set();
  if (daemon) {
    tree[String(daemon.pid)] = daemon.created;
    for (const c of kids.get(daemon.pid) ?? []) tree[String(c.pid)] = c.created;
    for (const d of descendants(facts, daemon.pid)) pm2Pids.add(d.pid);
  }
  const postmaster = facts.processes.find((p) => p.name === "postgres.exe" && byPid.get(p.parent)?.name === "pg_ctl.exe" && !inG0(p)) ?? null;
  const mariadb = facts.processes.filter((p) => /^(mysqld|mariadbd)\.exe$/.test(p.name));
  const cloudflared = facts.processes.filter((p) => p.name === "cloudflared.exe");
  const sig = (list) => list.map((p) => `${p.pid}@${p.created}`).sort().join(",");
  const infra = { postmaster: postmaster ? `${postmaster.pid}@${postmaster.created}` : null, mariadb: sig(mariadb), cloudflared: sig(cloudflared) };
  const infraPids = new Set([...(postmaster ? [postmaster.pid] : []), ...mariadb.map((p) => p.pid), ...cloudflared.map((p) => p.pid)]);
  const protectedPids = new Set([...infraPids]);
  for (const d of daemons) {
    protectedPids.add(d.pid);
    for (const x of descendants(facts, d.pid)) protectedPids.add(x.pid);
  }
  if (postmaster) {
    protectedPids.add(postmaster.parent); // the service's pg_ctl.exe
    for (const x of descendants(facts, postmaster.pid)) protectedPids.add(x.pid);
  }
  const productionPorts = new Map();
  for (const l of facts.listeners) {
    if (!pm2Pids.has(l.pid)) continue;
    if (!productionPorts.has(l.port)) productionPorts.set(l.port, new Set());
    productionPorts.get(l.port).add(l.address);
  }
  return { daemon, daemonCount: daemons.length, tree, pm2Pids, postmaster, infra, infraPids, protectedPids, productionPorts };
}
export const treeSignature = (tree) => Object.entries(tree ?? {}).map(([pid, created]) => `${pid}@${created}`).sort().join(",");

/** Production-owned listeners (PM2 tree, shared PostgreSQL, MariaDB, cloudflared), staging / temporary ports excluded. */
export function productionListenerSignature(facts, prod, tempPgPort) {
  const skip = new Set([...STAGING_PORTS, tempPgPort]);
  return [...new Set(facts.listeners.filter((l) => (prod.pm2Pids.has(l.pid) || prod.infraPids.has(l.pid)) && !skip.has(l.port)).map((l) => `${l.address}:${l.port}`))].sort().join(",");
}

/** G0's own processes: the runner and its descendants, plus anything created since the runner that names the G0 folder. */
export function g0ProcessIds(facts, { runnerPid, runnerCreated, g0Dir }) {
  const ids = new Set();
  const runner = facts.processes.find((p) => p.pid === runnerPid && sameInstant(p.created, runnerCreated));
  if (runner) {
    ids.add(runner.pid);
    for (const d of descendants(facts, runner.pid)) ids.add(d.pid);
  }
  const g0 = normPath(g0Dir);
  const notBefore = timeMs(runnerCreated);
  if (g0 && Number.isFinite(notBefore)) for (const p of facts.processes) if (normPath(p.cmd).includes(g0) && timeMs(p.created) >= notBefore) ids.add(p.pid);
  return ids;
}
export const runnerAlive = (facts, runnerPid, runnerCreated) => facts.processes.some((p) => p.pid === runnerPid && sameInstant(p.created, runnerCreated));

// ---------------------------------------------------------------- HTTP baseline (typed array, never a dictionary)
export const latencyLimit = (medianMs) => Math.max(Math.ceil(medianMs * LIMITS.latencyFactor), medianMs + LIMITS.latencySlackMs);
/** Which loopback address reaches a production port, from the addresses it listens on. */
export function probeHost(addresses) {
  const a = [...(addresses ?? [])];
  if (a.includes("0.0.0.0") || a.includes("127.0.0.1")) return "127.0.0.1";
  if (a.includes("::") || a.includes("::1")) return "::1";
  return null; // listens on a specific LAN address only: not probed from loopback → the baseline is refused
}
export function buildHttpBaseline(samples) {
  return samples
    .map(({ appPort, host, results }) => {
      const statuses = asArray(results).map((r) => toInt(r?.status));
      const times = asArray(results).map((r) => toInt(r?.ms)).filter(Number.isInteger).sort((x, y) => x - y);
      const medianMs = times.length === asArray(results).length && times.length ? times[Math.floor(times.length / 2)] : NaN;
      return { appPort: toInt(appPort), host, status: statuses[0], statuses, medianMs, limitMs: Number.isInteger(medianMs) ? latencyLimit(medianMs) : NaN };
    })
    .sort((x, y) => x.appPort - y.appPort);
}
/** Accepts the current array form, or the legacy object form keyed by port strings (the incident's baseline.json). */
export function normalizeHttpBaseline(httpPart, listenersSignature = "") {
  const hostFor = (appPort) => {
    const addrs = String(listenersSignature).split(",").filter(Boolean).map((s) => [s.slice(0, s.lastIndexOf(":")), toInt(s.slice(s.lastIndexOf(":") + 1))]).filter(([, p]) => p === appPort).map(([a]) => a);
    return probeHost(addrs);
  };
  const list = Array.isArray(httpPart)
    ? httpPart
    : httpPart && typeof httpPart === "object"
      ? Object.entries(httpPart).map(([key, v]) => ({ appPort: key, ...v }))
      : [];
  return list
    .map((e) => {
      const appPort = toInt(e?.appPort);
      const statuses = (typeof e?.statuses === "string" ? e.statuses.split(",") : asArray(e?.statuses)).map(toInt);
      return { appPort, host: e?.host ?? hostFor(appPort), status: toInt(e?.status), statuses, medianMs: toInt(e?.medianMs), limitMs: toInt(e?.limitMs) };
    })
    .sort((x, y) => x.appPort - y.appPort);
}
export function validateHttpBaseline(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return ["no production HTTP ports in the baseline"];
  const problems = [];
  const seen = new Set();
  for (const e of entries) {
    const where = `port ${Number.isInteger(e?.appPort) ? e.appPort : String(e?.appPort)}`;
    if (!Number.isInteger(e?.appPort) || e.appPort < 1 || e.appPort > 65535) problems.push(`${where}: invalid port number`);
    else if (seen.has(e.appPort)) problems.push(`${where}: duplicate entry`);
    else seen.add(e.appPort);
    if (!LOOPBACK_ADDRESSES.includes(e?.host)) problems.push(`${where}: no loopback address to probe (${e?.host})`);
    if (!Number.isInteger(e?.status) || e.status < 100 || e.status > 599) problems.push(`${where}: no valid HTTP status (${e?.status})`);
    if (!Array.isArray(e?.statuses) || e.statuses.length < 1 || e.statuses.some((s) => s !== e.status)) problems.push(`${where}: baseline statuses are not stable (${asArray(e?.statuses).join(",")})`);
    if (!Number.isInteger(e?.medianMs) || e.medianMs < 0) problems.push(`${where}: no valid median latency`);
    else if (!Number.isInteger(e?.limitMs) || e.limitMs !== latencyLimit(e.medianMs)) problems.push(`${where}: latency limit missing or inconsistent`);
  }
  return problems;
}
export function validateBaseline(b) {
  const problems = [];
  if (!b || typeof b !== "object") return ["baseline missing"];
  if (!b.tree || Object.keys(b.tree).length < 2) problems.push("production PM2 daemon or its children not found");
  if (!b.infra?.postmaster) problems.push("shared PostgreSQL postmaster not found");
  if (!Number.isInteger(b.tempPgPort) || b.tempPgPort < 1024) problems.push("temporary PostgreSQL port missing");
  problems.push(...validateHttpBaseline(b.http));
  if (toInt(b.version) >= 3) {
    const owners = new Map(asArray(b.portOwners).map((o) => [toInt(o?.appPort), asArray(o?.owners)]));
    for (const e of asArray(b.http)) if (!(owners.get(e?.appPort)?.length > 0)) problems.push(`port ${e?.appPort}: no owning process identity (PID@start) in the baseline`);
  }
  return problems;
}
/** Which processes (PID@start time) hold each port: the process identity part of HTTP preservation. */
export function portOwnerIdentities(facts, ports) {
  const created = new Map(facts.processes.map((p) => [p.pid, p.created]));
  return [...ports]
    .sort((a, b) => a - b)
    .map((appPort) => ({ appPort, owners: [...new Set(facts.listeners.filter((l) => l.port === appPort).map((l) => `${l.pid}@${created.get(l.pid) ?? "?"}`))].sort() }));
}
/** The production baseline (version 3): taken by the monitor at start and by the read-only `baseline` command. */
export async function buildProductionBaseline({ facts0, probe, tempPgPort, g0Dir, now }) {
  const prod0 = identifyProduction(facts0, { g0Dir });
  const samples = [];
  for (const [appPort, addrs] of [...prod0.productionPorts].sort((a, b) => a[0] - b[0])) {
    const host = probeHost(addrs);
    const results = [];
    for (let i = 0; i < LIMITS.baselineSamples; i++) results.push(host ? await probe({ host, port: appPort }) : { status: -1, ms: NaN });
    samples.push({ appPort, host, results });
  }
  const baseline = {
    version: 3,
    at: new Date(now()).toISOString(),
    tempPgPort,
    tree: prod0.tree,
    infra: prod0.infra,
    http: buildHttpBaseline(samples),
    portOwners: portOwnerIdentities(facts0, prod0.productionPorts.keys()),
    listeners: productionListenerSignature(facts0, prod0, tempPgPort),
    protectedPids: [...prod0.protectedPids].sort((a, b) => a - b),
  };
  const problems = factsComplete(facts0) ? validateBaseline(baseline) : ["Windows process / socket facts unavailable at baseline"];
  baseline.valid = problems.length === 0;
  baseline.problems = problems;
  return baseline;
}

// ---------------------------------------------------------------- production preservation after G0 (pure)
/**
 * HTTP preservation: every endpoint of the established baseline answered with its baseline status, served by the same
 * process identity, and the production tree / infrastructure / listeners are unchanged.
 * verdict: PASS | FAIL (a proven change) | INCOMPLETE (evidence partly missing) | MISSING (no usable baseline).
 * Only PASS passes the gate.
 */
export function httpPreservation({ baseline, facts, probes, ctx, expectEndpoints }) {
  const r = { verdict: "PASS", expectedEndpoints: null, baselineEndpoints: null, checkedEndpoints: 0, endpoints: [], identity: [], problems: [] };
  const fail = (m) => r.problems.push({ kind: "FAIL", message: m });
  const gap = (m) => r.problems.push({ kind: "INCOMPLETE", message: m });
  const decide = () => {
    r.verdict = r.problems.some((x) => x.kind === "MISSING") ? "MISSING" : r.problems.some((x) => x.kind === "FAIL") ? "FAIL" : r.problems.length ? "INCOMPLETE" : "PASS";
    return r;
  };
  const expected = toInt(expectEndpoints);
  r.expectedEndpoints = Number.isInteger(expected) ? expected : null;
  if (!Number.isInteger(expected) || expected < 1) r.problems.push({ kind: "MISSING", message: "the expected number of production endpoints was not given" });
  if (!baseline || typeof baseline !== "object") {
    r.problems.push({ kind: "MISSING", message: "no production baseline (the monitor's baseline.json is missing or unreadable)" });
    return decide();
  }
  const baseProblems = baseline.valid === true ? validateBaseline(baseline) : [`baseline marked invalid: ${asArray(baseline.problems).join("; ")}`];
  if (toInt(baseline.version) < 3) baseProblems.push("baseline has no per-port process identities (version < 3)");
  if (baseProblems.length) {
    for (const m of baseProblems) r.problems.push({ kind: "MISSING", message: `baseline: ${m}` });
    return decide();
  }
  r.baselineEndpoints = baseline.http.length;
  if (Number.isInteger(expected) && baseline.http.length !== expected) gap(`the baseline covers ${baseline.http.length} production endpoints, ${expected} expected`);
  const complete = factsComplete(facts);
  if (!complete) gap("Windows process / socket facts unavailable after G0 (process identities not verified)");
  else {
    const prod = identifyProduction(facts, { g0Dir: ctx.g0Dir });
    const check = (name, ok) => {
      r.identity.push({ name, ok });
      if (!ok) fail(`${name} changed`);
    };
    check("production PM2 tree (daemon and children, PID + start time)", treeSignature(prod.tree) === treeSignature(baseline.tree));
    for (const k of ["postmaster", "mariadb", "cloudflared"]) check(`${k} process`, String(prod.infra[k] ?? "") === String(baseline.infra?.[k] ?? ""));
    const asSet = (sig) => String(sig ?? "").split(",").filter(Boolean).sort().join(",");
    check("production listeners", asSet(productionListenerSignature(facts, prod, ctx.tempPgPort)) === asSet(baseline.listeners));
  }
  const baseOwners = new Map(baseline.portOwners.map((o) => [toInt(o.appPort), asArray(o.owners).map(String).sort()]));
  const afterOwners = complete ? new Map(portOwnerIdentities(facts, baseline.http.map((e) => e.appPort)).map((o) => [o.appPort, o.owners])) : new Map();
  for (const e of baseline.http) {
    const probe = probes.get(e.appPort);
    const expectedOwners = baseOwners.get(e.appPort) ?? [];
    const owners = complete ? (afterOwners.get(e.appPort) ?? []) : null;
    const row = { appPort: e.appPort, host: e.host, expectedStatus: e.status, status: probe ? probe.status : null, attempts: probe?.attempts ?? (probe ? 1 : 0), ms: probe?.ms ?? null, expectedOwners, owners };
    row.statusOk = Boolean(probe) && probe.status === e.status;
    row.ownerOk = owners !== null && owners.join(",") === expectedOwners.join(",");
    r.endpoints.push(row);
    if (!probe) gap(`port ${e.appPort}: not probed`);
    else {
      r.checkedEndpoints += 1;
      if (!row.statusOk) fail(`port ${e.appPort} answered ${probe.status === -1 ? "nothing" : probe.status} (baseline ${e.status})`);
    }
    if (owners !== null && !row.ownerOk) fail(`port ${e.appPort} is served by ${owners.join(" ") || "no process"} (baseline ${expectedOwners.join(" ")})`);
  }
  return decide();
}
/** A status that differs is re-asked (up to `attempts`, 1 s apart) so one slow answer is not a false FAIL; every answer is kept. */
export async function probeEndpoint(entry, { probe, sleep, attempts = 3 }) {
  const answers = [];
  for (let i = 0; i < attempts; i++) {
    const a = await probe({ host: entry.host, port: entry.appPort });
    answers.push(a);
    if (a.status === entry.status) break;
    if (i < attempts - 1) await sleep(1000);
  }
  const last = answers[answers.length - 1];
  return { status: last.status, ms: last.ms, attempts: answers.length, answers: answers.map((a) => a.status) };
}

// ---------------------------------------------------------------- how G0 ended (pure)
/** Who raised STOP, from the STOP file's own prefix (runner: / monitor: / anything else). */
export function stopOrigin(text) {
  const t = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!t) return { raisedBy: "none", text: null };
  if (/^runner:/i.test(t)) return { raisedBy: "runner", text: t };
  if (/^monitor( crashed)?:/i.test(t)) return { raisedBy: "monitor", text: t };
  return { raisedBy: "other (owner or an outside process)", text: t };
}
/** How the monitor ended, from its exit code and its own log (the exit line is written by every exit Node performs). */
export function classifyMonitorEnd({ exitCode, log }) {
  const d = describeExitCode(exitCode);
  const lines = String(log ?? "").split(/\r?\n/).filter(Boolean);
  const exitLine = [...lines].reverse().find((l) => / exit code -?\d+/.test(l));
  const finalWritten = lines.some((l) => / final I5 written/.test(l));
  if (d.hex === null) return { kind: "unknown", detail: "no exit code (the monitor is still running or never started)", exit: d };
  if (!exitLine) {
    if (d.hex === "0xFFFFFFFF") return { kind: "terminated-externally", detail: "terminated by another process (TerminateProcess -1, e.g. Stop-Process / .NET Kill); no exit line", exit: d };
    return { kind: "ended-without-exit-handler", detail: `ended with ${d.hex} without its exit line (forced termination or a crash): ${d.meaning}`, exit: d };
  }
  if (/received SIG/.test(lines.join("\n"))) return { kind: "signal", detail: "ended on a console / stop signal (it raised STOP itself)", exit: d };
  if (d.code === 0 && finalWritten) return { kind: "normal", detail: "ended normally after writing its final I5 comparison", exit: d };
  if (d.code === 2) return { kind: "invalid-baseline", detail: "refused an invalid baseline (STOP raised)", exit: d };
  return { kind: "ended-itself", detail: `ended by itself (${d.hex}) ${finalWritten ? "after" : "WITHOUT"} its final I5 comparison`, exit: d };
}

// ---------------------------------------------------------------- development-agent isolation (pure, read-only)
/** Autonomous development agents: they can run commands on this host and must be paused (by the owner) during G0. */
export const AGENT_RULES = Object.freeze([
  { id: "openai-codex", name: /^(codex|codex-command-runner|cua_node)(\.exe)?$/i, cmd: /[\\/]\.codex[\\/]|@openai[\\/]codex|codex-command-runner|cua_node/i },
  { id: "claude (desktop / Claude Code)", name: /^claude(\.exe)?$/i, cmd: /@anthropic-ai[\\/]claude-code|[\\/]AnthropicClaude[\\/]/i },
  { id: "github-copilot", name: /^copilot(-language-server)?(\.exe)?$/i, cmd: /copilot-language-server|@github[\\/]copilot|copilot-agent/i },
  { id: "google-gemini-cli", name: /^gemini(\.exe)?$/i, cmd: /@google[\\/]gemini-cli/i },
  { id: "cursor", name: /^cursor(\.exe)?$/i, cmd: /[\\/]cursor[\\/]cursor\.exe/i },
  { id: "windsurf", name: /^windsurf(\.exe)?$/i, cmd: /[\\/]windsurf[\\/]windsurf\.exe/i },
  { id: "continue", name: /^continue(-binary)?(\.exe)?$/i, cmd: /[\\/]\.continue[\\/]|continue-binary/i },
  { id: "aider", name: /^aider(\.exe)?$/i, cmd: /\baider(\.exe)?\b/i },
]);
const IDE_NAME = /^(code|code - insiders|devenv|idea64|webstorm64|rider64)\.exe$/i;
const RUNTIME_NAME = /^(node|python[0-9.]*|pythonw|bun|deno|pwsh|powershell)\.exe$/i;
const KILL_WORDS = /\b(Stop-Process|taskkill|tskill|pskill|kill\s+-9|killall|pkill)\b|\.Kill\(/i;
const redactText = (t) =>
  String(t ?? "")
    .replace(/(postgres(ql)?|mysql|mariadb):\/\/[^\s'"]+/gi, "<connection-string>")
    .replace(/((password|passwd|pwd|token|secret|api_?key)\s*[=:]\s*)[^\s;'"]+/gi, "$1<redacted>")
    .slice(0, 300);
/**
 * Read-only isolation readiness. Production (PM2 trees, PostgreSQL, MariaDB, cloudflared) is identified FIRST and never
 * classified as an agent. status: BLOCK (an agent runs, or a scheduled task that stops processes is running / due in the
 * window) | REVIEW (owner review items only) | CLEAR. Nothing is ever stopped: the owner pauses agents through their own UI.
 */
export function classifyIsolation({ facts, tasks, now, windowMinutes = 180, g0Dir, selfPid }) {
  const prod = identifyProduction(facts, { g0Dir });
  const { byPid } = indexFacts(facts);
  const production = new Set([...prod.protectedPids, ...prod.pm2Pids]);
  const own = new Set();
  for (let p = byPid.get(selfPid); p && !own.has(p.pid); p = byPid.get(p.parent)) own.add(p.pid); // this check and its callers
  const agents = [];
  const agentPids = new Set();
  for (const p of facts.processes) {
    if (production.has(p.pid) || own.has(p.pid) || agentPids.has(p.pid)) continue;
    const rule = AGENT_RULES.find((r) => r.name.test(p.name) || r.cmd.test(p.cmd));
    if (!rule) continue;
    for (const x of [p, ...descendants(facts, p.pid)]) {
      if (agentPids.has(x.pid) || production.has(x.pid) || own.has(x.pid)) continue;
      agentPids.add(x.pid);
      agents.push({ agent: rule.id, pid: x.pid, parent: x.parent, name: x.name, created: x.created, cmd: redactText(x.cmd), viaParent: x.pid !== p.pid ? p.pid : null });
    }
  }
  const review = [];
  for (const p of facts.processes) {
    if (production.has(p.pid) || own.has(p.pid) || agentPids.has(p.pid)) continue;
    if (IDE_NAME.test(p.name)) review.push({ kind: "ide", pid: p.pid, name: p.name, created: p.created, cmd: redactText(p.cmd) });
    else if (RUNTIME_NAME.test(p.name)) review.push({ kind: "runtime outside production", pid: p.pid, parent: p.parent, name: p.name, created: p.created, cmd: redactText(p.cmd) });
  }
  const until = now + windowMinutes * 60_000;
  const taskRows = [];
  for (const t of asArray(tasks)) {
    if (/^\\Microsoft\\/i.test(String(t?.path ?? ""))) continue;
    const next = timeMs(t?.nextRun);
    const running = String(t?.state ?? "") === "Running";
    const due = running || (Number.isFinite(next) && next >= now && next <= until);
    const actions = asArray(t?.actions).map((a) => `${a?.execute ?? ""} ${a?.arguments ?? ""}`.trim());
    const stopsProcesses = actions.some((a) => KILL_WORDS.test(a));
    const touchesAgents = actions.some((a) => AGENT_RULES.some((r) => r.cmd.test(a)));
    taskRows.push({ task: `${t?.path ?? ""}${t?.name ?? ""}`, state: String(t?.state ?? ""), nextRun: t?.nextRun ?? null, dueInWindow: due, stopsProcesses, touchesAgents, actions: actions.map(redactText) });
  }
  const blockingTasks = taskRows.filter((t) => t.dueInWindow && (t.stopsProcesses || t.touchesAgents));
  const reviewTasks = taskRows.filter((t) => t.dueInWindow && !t.stopsProcesses && !t.touchesAgents);
  const status = agents.length || blockingTasks.length ? "BLOCK" : review.length || reviewTasks.length ? "REVIEW" : "CLEAR";
  return {
    status,
    windowMinutes,
    production: { pm2Daemon: prod.daemon ? `${prod.daemon.pid}@${prod.daemon.created}` : null, pm2Daemons: prod.daemonCount, protectedProcesses: production.size, postmaster: prod.infra.postmaster, mariadb: prod.infra.mariadb, cloudflared: prod.infra.cloudflared },
    agents,
    blockingTasks,
    review,
    reviewTasks,
    tasksSeen: taskRows.length,
  };
}


// ---------------------------------------------------------------- one monitoring round (pure)
/**
 * Returns findings ({ key, message }) and the next state. Keys are stable per condition so a condition is reported once.
 * ctx: { tempPgPort, g0Pids: Set<number>, g0Dir }
 */
export function evaluateRound({ baseline, facts, probes, state, ctx }) {
  const findings = [];
  const add = (key, message) => findings.push({ key, message });
  const next = { latStrikes: { ...(state?.latStrikes ?? {}) }, cpuStrikes: state?.cpuStrikes ?? 0, factsStrikes: state?.factsStrikes ?? 0 };
  if (!factsComplete(facts)) {
    next.factsStrikes += 1;
    if (next.factsStrikes >= LIMITS.factsRounds) add("facts-unavailable", `Windows process / socket facts unavailable for ${next.factsStrikes} rounds (cannot verify isolation)`);
    return { findings, state: next, maxRatio: 0 };
  }
  next.factsStrikes = 0;
  const prod = identifyProduction(facts, { g0Dir: ctx.g0Dir });
  if (treeSignature(prod.tree) !== treeSignature(baseline.tree)) add("pm2-tree", "production PM2 tree changed (daemon or child PID / start time)");
  for (const k of ["postmaster", "mariadb", "cloudflared"]) if (String(prod.infra[k] ?? "") !== String(baseline.infra?.[k] ?? "")) add(`infra-${k}`, `${k} process changed`);
  let maxRatio = 0;
  for (const entry of baseline.http) {
    const r = probes.get(entry.appPort);
    if (!r) {
      add(`http-missing-${entry.appPort}`, `production port ${entry.appPort}: no probe result`);
      continue;
    }
    if (r.status !== entry.status) add(`http-status-${entry.appPort}`, `production port ${entry.appPort} answered ${r.status} (baseline ${entry.status})`);
    maxRatio = Math.max(maxRatio, r.ms / Math.max(1, entry.medianMs));
    next.latStrikes[entry.appPort] = r.ms > entry.limitMs ? (next.latStrikes[entry.appPort] ?? 0) + 1 : 0;
    if (next.latStrikes[entry.appPort] >= LIMITS.latencyRounds)
      add(`latency-${entry.appPort}`, `latency regression on port ${entry.appPort}: ${r.ms} ms > limit ${entry.limitMs} ms (baseline median ${entry.medianMs} ms) for ${next.latStrikes[entry.appPort]} rounds`);
  }
  next.cpuStrikes = facts.cpuPct > LIMITS.cpuPct ? next.cpuStrikes + 1 : 0;
  if (next.cpuStrikes >= LIMITS.cpuRounds) add("cpu", `CPU above ${LIMITS.cpuPct} % for ${next.cpuStrikes} rounds (${facts.cpuPct} %)`);
  if (facts.freeRamGB < LIMITS.minFreeRamGB) add("ram", `free RAM ${facts.freeRamGB} GB < ${LIMITS.minFreeRamGB} GB`);
  if (facts.freeDiskDGB < LIMITS.minFreeDiskDGB) add("disk", `D: free ${facts.freeDiskDGB} GB < ${LIMITS.minFreeDiskDGB} GB`);
  for (const l of facts.listeners.filter((x) => x.port === ctx.tempPgPort)) {
    if (l.address !== TEMP_PG_HOST) add(`temp-pg-address-${l.address}`, `temporary PostgreSQL port ${ctx.tempPgPort} is bound to ${l.address} (only ${TEMP_PG_HOST} is allowed)`);
    if (!ctx.g0Pids.has(l.pid)) add(`temp-pg-owner-${l.pid}`, `port ${ctx.tempPgPort} is held by PID ${l.pid}, which is not a G0 process`);
  }
  for (const l of facts.listeners)
    if (ctx.g0Pids.has(l.pid) && !LOOPBACK_ADDRESSES.includes(l.address)) add(`g0-listener-${l.pid}-${l.address}-${l.port}`, `G0 process ${l.pid} listens on ${l.address}:${l.port} (non-loopback)`);
  for (const c of facts.to5432) if (ctx.g0Pids.has(c.pid)) add(`g0-5432-${c.pid}`, `G0 process ${c.pid} is connected to the shared PostgreSQL port 5432 (${c.remote})`);
  return { findings, state: next, maxRatio };
}
/** Only conditions not reported before; repeats are counted, not re-logged (no alert flood after STOP). */
export function freshFindings(findings, reported) {
  const fresh = findings.filter((f) => !reported.has(f.key));
  for (const f of fresh) reported.add(f.key);
  return fresh;
}
/** I5 after G0: production tree, infrastructure, production listeners and HTTP statuses must equal the baseline. */
export function finalComparison({ baseline, facts, probes, ctx }) {
  const diffs = [];
  if (!factsComplete(facts)) return ["final Windows facts unavailable"];
  const prod = identifyProduction(facts, { g0Dir: ctx.g0Dir });
  if (treeSignature(prod.tree) !== treeSignature(baseline.tree)) diffs.push("production PM2 tree changed");
  for (const k of ["postmaster", "mariadb", "cloudflared"]) if (String(prod.infra[k] ?? "") !== String(baseline.infra?.[k] ?? "")) diffs.push(`${k} process changed`);
  const asSet = (sig) => String(sig ?? "").split(",").filter(Boolean).sort().join(",");
  if (asSet(productionListenerSignature(facts, prod, ctx.tempPgPort)) !== asSet(baseline.listeners)) diffs.push("production listeners changed (PM2 tree, PostgreSQL, MariaDB, cloudflared)");
  for (const entry of baseline.http) {
    const r = probes.get(entry.appPort);
    if (!r || r.status !== entry.status) diffs.push(`port ${entry.appPort} answered ${r ? r.status : "nothing"} (baseline ${entry.status})`);
  }
  return diffs;
}

// ---------------------------------------------------------------- temporary PostgreSQL identity (pure)
export function evaluateTempPg({ facts, pgData, tempPgPort, postmasterPid, expect = "running", g0Dir }) {
  const problems = [];
  const data = normPath(pgData);
  const usesData = (p) => p.name === "postgres.exe" && normPath(p.cmd).includes(data);
  const listeners = facts.listeners.filter((l) => l.port === tempPgPort);
  if (!data) return { ok: false, problems: ["no data folder given"] };
  if (expect === "stopped") {
    const left = facts.processes.filter(usesData);
    if (left.length) problems.push(`${left.length} postgres process(es) still run the G0 data folder (PIDs ${left.map((p) => p.pid).join(", ")})`);
    if (listeners.length) problems.push(`port ${tempPgPort} still has a listener (${listeners.map((l) => `${l.address} PID ${l.pid}`).join(", ")})`);
    return { ok: problems.length === 0, problems };
  }
  const prod = identifyProduction(facts, { g0Dir });
  const pid = toInt(postmasterPid);
  const pm = facts.processes.find((p) => p.pid === pid);
  if (!Number.isInteger(pid)) problems.push("postmaster.pid holds no valid PID");
  else if (!pm) problems.push(`postmaster PID ${pid} is not running`);
  else {
    if (pm.name !== "postgres.exe") problems.push(`PID ${pid} is ${pm.name}, not postgres.exe`);
    if (!usesData(pm)) problems.push(`PID ${pid} does not run the G0 data folder`);
    if (!new RegExp(`(^|\\s)-p\\s+${tempPgPort}(\\s|$)`).test(pm.cmd)) problems.push(`PID ${pid} was not started with -p ${tempPgPort}`);
    if (prod.protectedPids.has(pid) || prod.postmaster?.pid === pid) problems.push(`PID ${pid} is a production process`);
  }
  if (!listeners.length) problems.push(`nothing listens on port ${tempPgPort}`);
  for (const l of listeners) {
    if (l.address !== TEMP_PG_HOST) problems.push(`port ${tempPgPort} is bound to ${l.address} (only ${TEMP_PG_HOST} is allowed)`);
    if (l.pid !== pid) problems.push(`port ${tempPgPort} is held by PID ${l.pid}, not the postmaster ${pid}`);
  }
  return { ok: problems.length === 0, pid, problems };
}

// ---------------------------------------------------------------- safe stop of one of G0's own process trees (pure plan)
const SYSTEM_NAMES = new Set(["system", "smss.exe", "csrss.exe", "wininit.exe", "winlogon.exe", "services.exe", "lsass.exe", "svchost.exe", "explorer.exe", "dwm.exe"]);
export function protectionReason(p, { prod, notBefore }) {
  if (prod.protectedPids.has(p.pid)) return "production process (PM2 / PostgreSQL / MariaDB / cloudflared)";
  if (DAEMON_RE.test(p.cmd)) return "a PM2 daemon";
  if (p.name === "postgres.exe" || p.name === "pg_ctl.exe") return "PostgreSQL is stopped only with pg_ctl stop, never killed";
  if (SYSTEM_NAMES.has(p.name)) return "a Windows system process";
  if (!(timeMs(p.created) >= notBefore)) return "created before this G0 run started";
  if (p.pid === process.pid) return "the supervisor itself";
  return null;
}
/** Plans stopping the tree under `rootPid` (deepest first). Never includes a protected or pre-existing process. */
export function planStopTree({ facts, rootPid, rootCreated, notBefore, g0Dir }) {
  const nb = timeMs(notBefore);
  const root = facts.processes.find((p) => p.pid === rootPid);
  if (!Number.isFinite(nb)) return { stop: [], refused: [{ pid: rootPid, reason: "no valid --not-before time" }], rootFound: Boolean(root) };
  if (!root) return { stop: [], refused: [], rootFound: false };
  if (!sameInstant(root.created, rootCreated)) return { stop: [], refused: [{ pid: rootPid, name: root.name, reason: "PID reused: start time differs from the recorded one" }], rootFound: true };
  const prod = identifyProduction(facts, { g0Dir });
  const rootWhy = protectionReason(root, { prod, notBefore: nb });
  if (rootWhy) return { stop: [], refused: [{ pid: root.pid, name: root.name, reason: rootWhy }], rootFound: true };
  const stop = [];
  const refused = [];
  for (const p of [root, ...descendants(facts, rootPid)].reverse()) {
    const why = protectionReason(p, { prod, notBefore: nb });
    if (why) refused.push({ pid: p.pid, name: p.name, reason: why });
    else stop.push({ pid: p.pid, name: p.name, created: p.created });
  }
  return { stop, refused, rootFound: true };
}
/**
 * Executes a plan with a bounded, deterministic cost (C-A0.2 P4 fix):
 *   1. ONE identity query for all targets (PID → start time) immediately before stopping;
 *   2. every target whose start time still matches is stopped (deepest first); a missing PID is "already ended", a
 *      different start time is a reused PID and is never touched;
 *   3. cheap liveness polling (`isAlive`, no snapshot) every `pollMs` until all are gone or `waitMs` has passed;
 *   4. only if some still look alive: ONE more identity query, so a PID reused meanwhile is not reported as a survivor.
 * deps: { identify(pids) → [{ pid, created }], kill(pid), isAlive(pid), sleep(ms), now() }
 */
export async function executeStopTree(plan, { identify, kill, isAlive, sleep, now = () => Date.now(), waitMs = 10_000, pollMs = 250 }) {
  const t0 = now();
  const results = [];
  if (!plan.stop.length) return { results, survivors: [], timings: { verifyMs: 0, goneMs: 0, totalMs: 0 } };
  const startTimes = async (pids) => new Map(asArray(await identify(pids)).map((p) => [toInt(p?.pid), String(p?.created ?? "")]));
  const current = await startTimes(plan.stop.map((t) => t.pid));
  const verifyMs = now() - t0;
  const requested = [];
  for (const target of plan.stop) {
    const created = current.get(target.pid);
    if (created === undefined) results.push({ pid: target.pid, result: "already ended" });
    else if (!sameInstant(created, target.created)) results.push({ pid: target.pid, result: "skipped: PID reused (start time differs)" });
    else {
      try {
        kill(target.pid);
        results.push({ pid: target.pid, result: "stop requested" });
      } catch (e) {
        results.push({ pid: target.pid, result: `stop failed: ${e.code ?? e.message}` });
      }
      requested.push(target);
    }
  }
  const t1 = now();
  let alive = requested.filter((t) => isAlive(t.pid));
  while (alive.length && now() - t1 < waitMs) {
    await sleep(pollMs);
    alive = alive.filter((t) => isAlive(t.pid));
  }
  const goneMs = now() - t1;
  let survivors = [];
  if (alive.length) {
    const again = await startTimes(alive.map((t) => t.pid));
    survivors = alive.filter((t) => again.has(t.pid) && sameInstant(again.get(t.pid), t.created)).map((t) => t.pid);
  }
  return { results, survivors, timings: { verifyMs, goneMs, totalMs: now() - t0 } };
}

// ---------------------------------------------------------------- I/O (Windows facts, HTTP probe)
/** scope: "full" (monitor), "processes" (stop-tree planning) or "identity" (only `pids`: one filtered query). */
export function collectFactsWindows({ factsScript = FACTS_SCRIPT, timeoutMs = 60_000, scope = "full", pids = [] } = {}) {
  const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", factsScript, "-Scope", scope];
  if (scope === "identity") args.push("-ProcessIds", pids.filter(Number.isInteger).join(","));
  const r = spawnSync("powershell.exe", args, { encoding: "utf8", timeout: timeoutMs, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`g0-facts.ps1 failed (${r.error?.code ?? `exit ${r.status}`})`);
  return JSON.parse(String(r.stdout).replace(/^﻿/, ""));
}
/** Scheduled tasks (read-only, g0-tasks.ps1): path, name, state, next run, actions. */
export function collectTasksWindows({ tasksScript = TASKS_SCRIPT, timeoutMs = 120_000 } = {}) {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", tasksScript], { encoding: "utf8", timeout: timeoutMs, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`g0-tasks.ps1 failed (${r.error?.code ?? `exit ${r.status}`})`);
  return asArray(JSON.parse(String(r.stdout).replace(/^\uFEFF/, "")).tasks);
}
export function probeHttp({ host, port, timeoutMs = 5000 }) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let settled = false;
    const done = (status) => {
      if (settled) return;
      settled = true;
      resolve({ status, ms: Math.round(performance.now() - t0) });
    };
    if (!host || !net.isIP(host)) return done(-1);
    const req = http.request({ host, port, path: "/", method: "GET", agent: false, timeout: timeoutMs, headers: { "user-agent": "pdabliss-core-g0-monitor" } }, (res) => {
      res.on("data", () => {});
      res.on("end", () => done(res.statusCode));
      res.on("error", () => done(res.statusCode));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => done(-1));
    req.end();
  });
}
const isAliveDefault = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};
const stamp = (ms) => new Date(ms).toTimeString().slice(0, 8);

// ---------------------------------------------------------------- the monitor loop
/**
 * opts: { out, g0Dir, runnerPid, runnerCreated, tempPgPort, intervalMs, ackTimeoutMs, maxLifetimeMs }
 * deps: { collectFacts, probe, sleep, now, isAlive }
 * Exit: 0 = ended (MONITOR-END / runner gone / lifetime), 2 = invalid baseline (STOP written; nothing monitored).
 */
export async function runMonitor(opts, deps) {
  const file = (n) => path.join(opts.out, n);
  const append = (n, text) => fs.appendFileSync(file(n), text);
  const writeAtomic = (n, text) => {
    fs.writeFileSync(file(`${n}.partial`), text);
    fs.renameSync(file(`${n}.partial`), file(n));
  };
  const note = (line) => append("monitor-breaches.txt", `${stamp(deps.now())} ${line}\n`);
  const beat = (line) => append("monitor.log", `${new Date(deps.now()).toISOString()} ${line}\n`);
  beat(`monitor started (pid ${process.pid}); runner ${opts.runnerPid} created ${opts.runnerCreated}; interval ${opts.intervalMs} ms`);
  const raiseStop = (reason) => {
    if (!fs.existsSync(file("STOP"))) fs.writeFileSync(file("STOP"), `monitor: ${reason}\n`);
  };
  const ctxBase = { tempPgPort: opts.tempPgPort, g0Dir: opts.g0Dir };

  // round 0: baseline (fail closed)
  const facts0 = normalizeFacts(await deps.collectFacts().catch(() => ({})));
  const baseline = await buildProductionBaseline({ facts0, probe: deps.probe, tempPgPort: opts.tempPgPort, g0Dir: opts.g0Dir, now: deps.now });
  const problems = baseline.problems;
  writeAtomic("baseline.json", `${JSON.stringify(baseline, null, 2)}\n`);
  beat(`baseline ${baseline.valid ? "valid" : "INVALID"}: ${baseline.http.length} ports, ${Object.keys(baseline.tree).length - 1} PM2 children${problems.length ? `; ${problems.join("; ")}` : ""}`);
  if (!baseline.valid) {
    raiseStop(`baseline invalid: ${problems.join("; ")}`);
    note(`baseline invalid (G0 must not continue): ${problems.join("; ")}`);
    writeAtomic("monitor-final.json", `${JSON.stringify({ version: 2, baselineValid: false, problems, i5ok: false, endReason: "invalid baseline" }, null, 2)}\n`);
    return 2;
  }
  append("monitor.csv", "time,cpuPct,freeRamGB,freeDiskDGB,maxLatencyRatio,prodChildren,g0Processes,newFindings,repeatsSuppressed\n");

  let state = {};
  const reported = new Set();
  let suppressed = 0;
  let stopAt = null;
  let ackNoted = false;
  let endReason = null;
  const stats = { rounds: 0, maxCpu: 0, minFreeRamGB: Infinity, maxLatencyRatio: 0 };
  const started = deps.now();
  monitoring: for (;;) {
    for (let waited = 0; waited < opts.intervalMs; waited += 1000) {
      if (fs.existsSync(file("MONITOR-END"))) {
        endReason = "MONITOR-END from the runner";
        break monitoring;
      }
      if (!deps.isAlive(opts.runnerPid)) {
        endReason = "runner process ended";
        break monitoring;
      }
      await deps.sleep(Math.min(1000, opts.intervalMs - waited));
    }
    if (deps.now() - started > opts.maxLifetimeMs) {
      endReason = "maximum monitor lifetime reached";
      break;
    }
    const roundNo = stats.rounds + 1;
    const tFacts = deps.now();
    beat(`round ${roundNo}: facts …`);
    let factsError = null;
    const facts = normalizeFacts(await deps.collectFacts().catch((e) => ((factsError = e?.message ?? String(e)), {})));
    beat(`round ${roundNo}: facts ${factsComplete(facts) ? "ok" : `INCOMPLETE${factsError ? ` (${factsError})` : ""}`} in ${deps.now() - tFacts} ms; ${facts.processes.length} processes`);
    if (factsComplete(facts) && !runnerAlive(facts, opts.runnerPid, opts.runnerCreated)) {
      endReason = "runner process ended (PID / start time no longer present)";
      break;
    }
    const g0Pids = g0ProcessIds(facts, opts);
    const probes = new Map();
    for (const entry of baseline.http) probes.set(entry.appPort, await deps.probe({ host: entry.host, port: entry.appPort }));
    const round = evaluateRound({ baseline, facts, probes, state, ctx: { ...ctxBase, g0Pids } });
    beat(`round ${roundNo}: probes done; ${round.findings.length} finding(s); ${g0Pids.size} G0 processes`);
    state = round.state;
    const fresh = freshFindings(round.findings, reported);
    suppressed += round.findings.length - fresh.length;
    for (const f of fresh) {
      note(f.message);
      if (stopAt === null) {
        raiseStop(f.message);
        stopAt = deps.now();
      }
    }
    if (stopAt !== null && !ackNoted && deps.now() - stopAt > opts.ackTimeoutMs) {
      note(`runner has not acknowledged STOP within ${Math.round(opts.ackTimeoutMs / 1000)} s (no MONITOR-END); still watching production, repeats suppressed`);
      ackNoted = true;
    }
    stats.rounds += 1;
    stats.maxCpu = Math.max(stats.maxCpu, Number.isFinite(facts.cpuPct) ? facts.cpuPct : 0);
    if (Number.isFinite(facts.freeRamGB)) stats.minFreeRamGB = Math.min(stats.minFreeRamGB, facts.freeRamGB);
    stats.maxLatencyRatio = Math.max(stats.maxLatencyRatio, Math.round(round.maxRatio * 100) / 100);
    append("monitor.csv", `${stamp(deps.now())},${facts.cpuPct},${facts.freeRamGB},${facts.freeDiskDGB},${Math.round(round.maxRatio * 100) / 100},${Object.keys(baseline.tree).length - 1},${g0Pids.size},${fresh.length},${suppressed}\n`);
  }

  // final snapshot (I5)
  beat(`ending: ${endReason}`);
  const factsF = normalizeFacts(await deps.collectFacts().catch(() => ({})));
  const probesF = new Map();
  for (const entry of baseline.http) probesF.set(entry.appPort, await deps.probe({ host: entry.host, port: entry.appPort }));
  const i5diffs = finalComparison({ baseline, facts: factsF, probes: probesF, ctx: ctxBase });
  const stopped = fs.existsSync(file("STOP"));
  const final = {
    version: 2, baselineValid: true, i5ok: i5diffs.length === 0, i5diffs, endReason, stopped,
    stopReason: stopped ? fs.readFileSync(file("STOP"), "utf8").trim() : null, repeatsSuppressed: suppressed,
    stats: { ...stats, minFreeRamGB: Number.isFinite(stats.minFreeRamGB) ? stats.minFreeRamGB : null },
  };
  writeAtomic("monitor-final.json", `${JSON.stringify(final, null, 2)}\n`);
  beat(`final I5 written: ${final.i5ok ? "ok" : `differences: ${i5diffs.join("; ")}`}`);
  return 0;
}

/**
 * Makes a silent monitor exit diagnosable: an exit line on every exit Node itself performs, and console / stop signals
 * logged with STOP raised (fail closed). On Windows, SIGINT = Ctrl+C, SIGBREAK = Ctrl+Break, SIGHUP = console closed.
 * A termination by another process (TerminateProcess) runs no code at all: the ABSENCE of an exit line is the evidence.
 */
export function installMonitorExitDiagnostics(out, { proc = process, write = fs.appendFileSync } = {}) {
  const line = (text) => {
    try {
      write(path.join(out, "monitor.log"), `${new Date().toISOString()} ${text}\n`);
    } catch {
      // logging must never change the exit path
    }
  };
  const signals = { SIGINT: 2, SIGBREAK: 21, SIGHUP: 1, SIGTERM: 15 };
  for (const [name, num] of Object.entries(signals)) {
    proc.on(name, () => {
      line(`received ${name} - ending (STOP raised)`);
      try {
        if (!fs.existsSync(path.join(out, "STOP"))) fs.writeFileSync(path.join(out, "STOP"), `monitor: received ${name} (console event or a stop request from another process)\n`);
      } catch {
        // the runner still sees the monitor end
      }
      proc.exit(128 + num);
    });
  }
  proc.on("exit", (code) => line(`exit code ${code} (${describeExitCode(code).meaning})`));
  return line;
}

// ---------------------------------------------------------------- CLI
function argOf(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
/** Facts sources: Windows (g0-facts.ps1) or, for the unit tests only, `--facts-module` (may also export identifyProcesses / isAlive). */
async function loadFacts(argv) {
  const mod = argOf(argv, "facts-module");
  if (mod) {
    const m = await import(pathToFileURL(path.resolve(mod)).href);
    return {
      collect: () => m.collectFacts({ scope: "full" }),
      collectProcesses: () => m.collectFacts({ scope: "processes" }),
      identify: m.identifyProcesses ? (pids) => m.identifyProcesses(pids) : async (pids) => asArray((await m.collectFacts({ scope: "processes" })).processes).filter((p) => pids.includes(toInt(p.pid))),
      isAlive: m.isAlive ?? isAliveDefault,
    };
  }
  return {
    collect: async () => collectFactsWindows({ scope: "full" }),
    collectProcesses: async () => collectFactsWindows({ scope: "processes" }),
    identify: async (pids) => asArray(collectFactsWindows({ scope: "identity", pids }).processes),
    isAlive: isAliveDefault,
  };
}
async function main(argv) {
  const cmd = argv[0];
  const sources = await loadFacts(argv);
  const collect = sources.collect;
  const say = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
  if (cmd === "monitor") {
    const opts = {
      out: argOf(argv, "out"), g0Dir: argOf(argv, "g0-dir"), runnerPid: toInt(argOf(argv, "runner-pid")), runnerCreated: argOf(argv, "runner-created"),
      tempPgPort: toInt(argOf(argv, "temp-pg-port")), intervalMs: toInt(argOf(argv, "interval-ms") ?? LIMITS.intervalMs),
      ackTimeoutMs: toInt(argOf(argv, "ack-timeout-ms") ?? LIMITS.ackTimeoutMs), maxLifetimeMs: LIMITS.maxLifetimeMs,
    };
    if (!opts.out || !fs.existsSync(opts.out) || !opts.g0Dir || !Number.isInteger(opts.runnerPid) || !Number.isFinite(timeMs(opts.runnerCreated)) || !Number.isInteger(opts.tempPgPort))
      throw new Error("monitor needs --out (existing) --g0-dir --runner-pid --runner-created --temp-pg-port");
    installMonitorExitDiagnostics(opts.out);
    const code = await runMonitor(opts, { collectFacts: collect, probe: probeHttp, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => Date.now(), isAlive: isAliveDefault });
    return code;
  }
  if (cmd === "temp-pg-identity") {
    const pgData = argOf(argv, "pg-data");
    const expect = argOf(argv, "expect") ?? "running";
    let postmasterPid;
    try {
      postmasterPid = fs.readFileSync(path.join(pgData, "postmaster.pid"), "utf8").split(/\r?\n/)[0];
    } catch {
      postmasterPid = undefined;
    }
    const facts = normalizeFacts(await collect());
    const r = evaluateTempPg({ facts, pgData, tempPgPort: toInt(argOf(argv, "temp-pg-port")), postmasterPid, expect, g0Dir: argOf(argv, "g0-dir") });
    say({ check: `temp-pg-identity (${expect})`, ...r });
    return r.ok ? 0 : 1;
  }
  if (cmd === "plan-stop-tree" || cmd === "stop-tree") {
    const tPlan = Date.now();
    const facts = normalizeFacts(await sources.collectProcesses());
    const plan = planStopTree({ facts, rootPid: toInt(argOf(argv, "root")), rootCreated: argOf(argv, "root-created"), notBefore: argOf(argv, "not-before"), g0Dir: argOf(argv, "g0-dir") });
    if (cmd === "plan-stop-tree") {
      say({ plan });
      return plan.refused.length ? 3 : 0;
    }
    const planMs = Date.now() - tPlan;
    const executed = await executeStopTree(plan, { identify: sources.identify, isAlive: sources.isAlive, kill: (pid) => process.kill(pid), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
    executed.timings = { planMs, ...executed.timings };
    const record = { at: new Date().toISOString(), reason: argOf(argv, "reason") ?? "", root: toInt(argOf(argv, "root")), plan, executed };
    const out = argOf(argv, "out");
    if (out && fs.existsSync(out)) fs.writeFileSync(path.join(out, `stop-tree-${record.root}-${Date.now()}.json`), `${JSON.stringify(record, null, 2)}\n`);
    say(record);
    return executed.survivors.length ? 1 : 0;
  }
  if (cmd === "census") {
    const out = argOf(argv, "out");
    if (!out) throw new Error("census needs --out <file.json>");
    const exits = [];
    for (let i = 0; i < argv.length; i++) if (argv[i] === "--exit" && argv[i + 1]) {
      const [name, code] = argv[i + 1].split("=");
      exits.push({ name, ...describeExitCode(code) });
    }
    const readOrNull = (f) => {
      try {
        return f ? fs.readFileSync(f, "utf8") : null;
      } catch {
        return null;
      }
    };
    const monitorExit = exits.find((e) => e.name === "monitor");
    const monitorLog = readOrNull(argOf(argv, "monitor-log"));
    let facts = null;
    let factsError = null;
    try {
      facts = normalizeFacts(await sources.collect());
    } catch (e) {
      factsError = e.message;
    }
    const runnerPid = toInt(argOf(argv, "runner-pid"));
    const runnerCreated = argOf(argv, "runner-created");
    const g0 = facts ? g0ProcessIds(facts, { runnerPid, runnerCreated, g0Dir: argOf(argv, "g0-dir") }) : new Set();
    if (facts) for (const own of [process.pid, ...descendants(facts, process.pid).map((p) => p.pid)]) g0.delete(own); // not the census itself
    const report = {
      at: new Date().toISOString(),
      exits,
      runnerAlive: facts ? runnerAlive(facts, runnerPid, runnerCreated) : null,
      g0ProcessesAlive: facts ? facts.processes.filter((p) => g0.has(p.pid)).map((p) => ({ pid: p.pid, parent: p.parent, name: p.name, created: p.created, cmd: p.cmd.slice(0, 300) })) : null,
      factsError,
      processCount: facts ? facts.processes.length : null,
      monitorEnd: argOf(argv, "monitor-log") ? classifyMonitorEnd({ exitCode: monitorExit?.code ?? null, log: monitorLog }) : null,
      stop: argOf(argv, "stop-file") ? stopOrigin(readOrNull(argOf(argv, "stop-file"))) : null,
      agentsAlive: facts ? classifyIsolation({ facts, tasks: [], now: Date.now(), g0Dir: argOf(argv, "g0-dir"), selfPid: process.pid }).agents : null,
    };
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    say({ census: out, exits: exits.length, g0ProcessesAlive: report.g0ProcessesAlive?.length ?? null });
    return 0;
  }
  if (cmd === "baseline") {
    const out = argOf(argv, "out");
    if (!out) throw new Error("baseline needs --out <file.json>");
    const facts0 = normalizeFacts(await collect().catch(() => ({})));
    const baseline = await buildProductionBaseline({ facts0, probe: probeHttp, tempPgPort: toInt(argOf(argv, "temp-pg-port")), g0Dir: argOf(argv, "g0-dir"), now: () => Date.now() });
    fs.writeFileSync(out, `${JSON.stringify(baseline, null, 2)}\n`);
    say({ baseline: out, valid: baseline.valid, endpoints: baseline.http.length, problems: baseline.problems });
    return baseline.valid ? 0 : 2;
  }
  if (cmd === "i5-check") {
    const out = argOf(argv, "out");
    const baselineFile = argOf(argv, "baseline");
    if (!out || !baselineFile) throw new Error("i5-check needs --baseline <baseline.json> --out <file.json>");
    let baseline = null;
    let baselineError = null;
    try {
      baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8").replace(/^\uFEFF/, ""));
    } catch (e) {
      baselineError = e.code === "ENOENT" ? "baseline file not found" : `baseline unreadable: ${e.message}`;
    }
    let facts = normalizeFacts({});
    let factsError = null;
    try {
      facts = normalizeFacts(await collect());
    } catch (e) {
      factsError = e.message;
    }
    const probes = new Map();
    for (const e of asArray(baseline?.http)) {
      // loopback only, exactly as the monitor: an entry without a loopback host is never probed (and stays unproven)
      if (!Number.isInteger(toInt(e?.appPort)) || !LOOPBACK_ADDRESSES.includes(e?.host)) continue;
      probes.set(toInt(e.appPort), await probeEndpoint({ ...e, appPort: toInt(e.appPort) }, { probe: probeHttp, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) }));
    }
    const result = httpPreservation({ baseline, facts, probes, ctx: { tempPgPort: toInt(argOf(argv, "temp-pg-port")), g0Dir: argOf(argv, "g0-dir") }, expectEndpoints: argOf(argv, "expect-endpoints") });
    const report = { at: new Date().toISOString(), check: "production HTTP preservation (I5, runner-owned)", baselineFile, baselineError, factsError, ...result };
    fs.writeFileSync(`${out}.partial`, `${JSON.stringify(report, null, 2)}\n`);
    fs.renameSync(`${out}.partial`, out);
    say({ i5: out, verdict: result.verdict, checked: result.checkedEndpoints, expected: result.expectedEndpoints, problems: result.problems.length });
    return result.verdict === "PASS" ? 0 : 1;
  }
  if (cmd === "isolation") {
    const out = argOf(argv, "out");
    if (!out) throw new Error("isolation needs --out <file.json>");
    const facts = normalizeFacts(await collect());
    if (!factsComplete(facts)) throw new Error("Windows process facts unavailable - isolation cannot be assessed");
    const tasksFile = argOf(argv, "tasks-file");
    const tasks = tasksFile ? asArray(JSON.parse(fs.readFileSync(tasksFile, "utf8").replace(/^\uFEFF/, "")).tasks) : collectTasksWindows();
    const windowMinutes = toInt(argOf(argv, "window-minutes") ?? 180);
    const report = { at: new Date().toISOString(), check: "development-agent isolation readiness (read-only; nothing is stopped)", ...classifyIsolation({ facts, tasks, now: Date.now(), windowMinutes, g0Dir: argOf(argv, "g0-dir"), selfPid: process.pid }) };
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    say({ isolation: out, status: report.status, agents: report.agents.length, blockingTasks: report.blockingTasks.length, review: report.review.length, reviewTasks: report.reviewTasks.length });
    return report.status === "BLOCK" ? 1 : 0;
  }
  throw new Error("unknown command (monitor | temp-pg-identity | plan-stop-tree | stop-tree | census | baseline | i5-check | isolation)");
}

if (process.argv[1] && path.basename(process.argv[1]) === "g0-supervisor.mjs") {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code ?? 0),
    (err) => {
      // Fail closed: a crashed monitor raises STOP so the runner shuts G0 down.
      const out = argOf(process.argv, "out");
      if (process.argv[2] === "monitor" && out && fs.existsSync(out) && !fs.existsSync(path.join(out, "STOP"))) fs.writeFileSync(path.join(out, "STOP"), `monitor crashed: ${err.message}\n`);
      process.stderr.write(`[g0-supervisor] ERROR: ${err.message}\n`);
      process.exit(1);
    },
  );
}
