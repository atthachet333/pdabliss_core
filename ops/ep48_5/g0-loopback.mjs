// PDA BLISS CORE — EP48.5 A-0.1: loopback-only listener guard for G0.
//
// The S2A-SERVER firewall is off, so no G0 process may listen on 0.0.0.0, ::, a LAN or a public address — not even
// for a moment. g0-guard.mjs preloads g0-loopback-preload.mjs into every process it starts
// (NODE_OPTIONS=--import=<file URL>, inherited by every child process). A TCP listen or UDP bind whose address is not
// loopback throws BEFORE any socket exists, and is recorded in <CORE_G0_LOOPBACK_DIR>\violations.log; every armed
// process appends a line to armed.log. g0-guard.mjs refuses a step with any violation or with no armed process.
//
// Allowed: 127.0.0.0/8, ::1, "localhost", and named pipes / Unix sockets (local by definition).
// Refused: no host given (Node then binds every interface), 0.0.0.0, ::, any other address, an inherited handle / fd.
import dgram from "node:dgram";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const IPV4_LOOPBACK = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** True only for an explicit loopback address. Exact string: no trimming, no brackets other than [::1]. */
export function isLoopbackHost(host) {
  if (typeof host !== "string") return false;
  const m = IPV4_LOOPBACK.exec(host);
  if (m) return m.slice(1).every((n) => Number(n) <= 255);
  return host === "::1" || host === "[::1]" || host === "localhost";
}

/** What a net.Server#listen(...) call would bind. */
export function listenTarget(args) {
  const a = args[0];
  if (a !== null && typeof a === "object") {
    if (a.path !== undefined && a.path !== null) return { kind: "pipe" };
    if (a._handle !== undefined || a.handle !== undefined || a.fd !== undefined) return { kind: "handle" };
    return { kind: "tcp", host: a.host };
  }
  if (typeof a === "string" && !/^\d+$/.test(a)) return { kind: "pipe" };
  return { kind: "tcp", host: typeof args[1] === "string" ? args[1] : undefined };
}

/** What a dgram.Socket#bind(...) call would bind. */
export function bindTarget(args) {
  const a = args[0];
  if (a !== null && typeof a === "object") {
    if (a.fd !== undefined) return { kind: "handle" };
    return { kind: "udp", host: a.address };
  }
  return { kind: "udp", host: typeof args[1] === "string" ? args[1] : undefined };
}

export const isAllowed = (t) => t.kind === "pipe" || ((t.kind === "tcp" || t.kind === "udp") && isLoopbackHost(t.host));

const INSTALLED = Symbol.for("pdabliss.core.g0.loopback");

/** Patches net.Server#listen and dgram.Socket#bind in THIS process. Idempotent. */
export function install({ dir = process.env.CORE_G0_LOOPBACK_DIR } = {}) {
  if (globalThis[INSTALLED]) return false;
  globalThis[INSTALLED] = true;
  const record = (file, entry) => {
    if (!dir) return;
    try {
      fs.appendFileSync(path.join(dir, file), `${JSON.stringify({ pid: process.pid, ...entry })}\n`);
    } catch {
      // the guard still refuses; the missing record makes g0-guard.mjs fail the step (no armed process)
    }
  };
  const refuse = (api, t) => {
    const where = t.kind === "handle" ? "an inherited handle" : t.host === undefined ? "all interfaces (no address given)" : String(t.host);
    const caller = (new Error().stack ?? "").split("\n").slice(3, 6).map((s) => s.trim()).join(" | ");
    record("violations.log", { api, kind: t.kind, host: t.host ?? null, at: new Date().toISOString(), caller });
    const err = new Error(`G0 loopback guard: refused ${api} on ${where}; G0 may listen on 127.0.0.1 / ::1 only`);
    err.code = "G0_NON_LOOPBACK_LISTEN";
    throw err;
  };
  const listen = net.Server.prototype.listen;
  net.Server.prototype.listen = function g0LoopbackListen(...args) {
    const t = listenTarget(args);
    if (!isAllowed(t)) refuse("listen", t);
    return listen.apply(this, args);
  };
  const bind = dgram.Socket.prototype.bind;
  dgram.Socket.prototype.bind = function g0LoopbackBind(...args) {
    const t = bindTarget(args);
    if (!isAllowed(t)) refuse("udp bind", t);
    return bind.apply(this, args);
  };
  record("armed.log", { script: path.basename(process.argv[1] ?? "") });
  return true;
}
