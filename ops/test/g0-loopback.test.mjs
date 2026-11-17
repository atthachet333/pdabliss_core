// EP48.5 A-0.1 — the loopback-only listener guard preloaded into every G0 process. The enforcement test runs in a
// child process; every refused attempt is refused BEFORE a socket exists. The only socket bound is on 127.0.0.1.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { bindTarget, isAllowed, isLoopbackHost, listenTarget } from "../ep48_5/g0-loopback.mjs";
import { PRELOAD } from "../ep48_5/g0-guard.mjs";

test("isLoopbackHost: 127.0.0.0/8, ::1 and localhost only — exact strings", () => {
  for (const h of ["127.0.0.1", "127.1.2.3", "::1", "[::1]", "localhost"]) assert.equal(isLoopbackHost(h), true, h);
  for (const h of [undefined, null, "", "0.0.0.0", "::", "[::]", "192.168.1.10", "10.0.0.5", "::ffff:0.0.0.0", "127.0.0.256", " 127.0.0.1", "127.0.0.1 ", "LOCALHOST.", "example.com", 1312])
    assert.equal(isLoopbackHost(h), false, String(h));
});

test("listenTarget / bindTarget classify every listen / bind form", () => {
  const cb = () => {};
  const cases = [
    [[0, "127.0.0.1", cb], true], [[0, "::1"], true], [[{ port: 0, host: "127.0.0.1" }], true], [["\\\\.\\pipe\\x"], true], [[{ path: "/tmp/s" }], true],
    [[0], false], [[], false], [[0, cb], false], [[0, 511, cb], false], [["1312"], false], [[0, "0.0.0.0"], false], [[0, "::"], false],
    [[{ port: 0 }], false], [[{ port: 0, host: "192.168.1.10" }], false], [[{ fd: 3 }], false], [[{ _handle: {} }], false],
  ];
  for (const [args, allowed] of cases) assert.equal(isAllowed(listenTarget(args)), allowed, JSON.stringify(args));
  for (const [args, allowed] of [[[0, "127.0.0.1"], true], [[{ port: 0, address: "::1" }], true], [[0], false], [[], false], [[{ port: 0 }], false], [[0, "0.0.0.0"], false], [[{ fd: 3 }], false]])
    assert.equal(isAllowed(bindTarget(args)), allowed, JSON.stringify(args));
});

test("enforcement in a real process: wildcard / address-less / LAN listens and UDP binds are refused before a socket exists and recorded; 127.0.0.1 works", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "g0-loopback-"));
  const script = `
    const net = require("node:net"), dgram = require("node:dgram");
    const tries = [
      ["0.0.0.0", (s) => s.listen(0, "0.0.0.0")], // g0-preflight: refused-by-guard
      ["::", (s) => s.listen(0, "::")], // g0-preflight: refused-by-guard
      ["no address", (s) => s.listen(0)], // g0-preflight: refused-by-guard
      ["options without host", (s) => s.listen({ port: 0 })], // g0-preflight: refused-by-guard
      ["LAN address", (s) => s.listen(0, "192.168.1.10")], // g0-preflight: refused-by-guard
    ];
    const out = [];
    for (const [name, f] of tries) { const s = net.createServer(); let code = "bound"; try { f(s); } catch (e) { code = e.code; } out.push({ name, code, listening: s.listening }); try { s.close(); } catch {} }
    const u = dgram.createSocket("udp4"); let ucode = "bound"; try { u.bind(0); } catch (e) { ucode = e.code; } out.push({ name: "udp", code: ucode }); u.close();
    const ok = net.createServer();
    ok.listen(0, "127.0.0.1", () => { out.push({ name: "loopback", code: "ok", address: ok.address().address }); ok.close(() => process.stdout.write(JSON.stringify(out))); });`;
  const r = spawnSync(process.execPath, ["-e", script], {
    encoding: "utf8",
    timeout: 20000,
    env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", NODE_OPTIONS: `--import=${pathToFileURL(PRELOAD).href}`, CORE_G0_LOOPBACK_DIR: dir },
  });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  const refused = out.filter((x) => x.name !== "loopback");
  assert.equal(refused.length, 6);
  for (const x of refused) {
    assert.equal(x.code, "G0_NON_LOOPBACK_LISTEN", x.name);
    assert.notEqual(x.listening, true, `${x.name}: no socket`);
  }
  assert.deepEqual(out.find((x) => x.name === "loopback"), { name: "loopback", code: "ok", address: "127.0.0.1" });
  const lines = (f) => fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(lines("armed.log").length, 1, "the process was armed");
  const v = lines("violations.log");
  assert.equal(v.length, 6);
  assert.deepEqual(v.map((x) => x.host), ["0.0.0.0", "::", null, null, "192.168.1.10", null]);
});

test("the preload reaches child processes through NODE_OPTIONS (as node --test / vitest forks do)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "g0-loopback-"));
  const grandchild = `const s=require("node:net").createServer();try{s.listen(0)}catch(e){process.stdout.write(e.code)}try{s.close()}catch{}`; // g0-preflight: refused-by-guard
  const child = `const r=require("node:child_process").spawnSync(process.execPath,["-e",${JSON.stringify(grandchild)}],{encoding:"utf8"});process.stdout.write(r.stdout)`;
  const r = spawnSync(process.execPath, ["-e", child], {
    encoding: "utf8",
    timeout: 20000,
    env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", NODE_OPTIONS: `--import=${pathToFileURL(PRELOAD).href}`, CORE_G0_LOOPBACK_DIR: dir },
  });
  assert.equal(r.stdout, "G0_NON_LOOPBACK_LISTEN", r.stderr);
  assert.equal(fs.readFileSync(path.join(dir, "armed.log"), "utf8").split("\n").filter(Boolean).length, 2, "parent and child armed");
});
