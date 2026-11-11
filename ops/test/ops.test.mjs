// EP43 ops tooling — unit tests (node --test ops/test). No database, no network, no real disk
// thresholds: statistics are mocked and every file lives in a fresh temporary folder.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  acquireLock,
  alertDispatcher,
  alertState,
  logger,
  profileOf,
  redact,
  ROOT,
  safeBackupDir,
} from "../lib.mjs";
import { classify, checkStorage, DEFAULT_THRESHOLDS } from "../storage.mjs";
import { applyRetention, plan } from "../retention.mjs";
import { runChecks, cycle } from "../health.mjs";
import { SCRATCH, parseDumpName, restoreInto } from "../backup.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "core-ops-"));
const GB = 1024 ** 3;
const quietLog = (dir = tmp()) => {
  process.env.CORE_OPS_QUIET = "1";
  return logger(dir, "test");
};
const envFile = (dir, line) => {
  const f = path.join(dir, "test.env");
  fs.writeFileSync(f, `${line}\n`);
  return f;
};

describe("guards", () => {
  it("a profile must name its database and its connection must agree", () => {
    const d = tmp();
    const env = envFile(
      d,
      'DATABASE_URL="postgresql://u:pw@localhost:5432/core_a"',
    );
    assert.throws(
      () =>
        profileOf({ profiles: { x: { enabled: true, envFile: env } } }, "x"),
      /name its database/,
    );
    assert.throws(
      () =>
        profileOf(
          {
            profiles: {
              x: { enabled: true, envFile: env, database: "core_b" },
            },
          },
          "x",
        ),
      (e) => e.code === "DATABASE_MISMATCH",
    );
    const ok = profileOf(
      { profiles: { x: { enabled: true, envFile: env, database: "core_a" } } },
      "x",
    );
    assert.equal(ok.url.pathname, "/core_a");
    // credentialsOnly takes the database from the profile, still explicitly.
    const uat = profileOf(
      {
        profiles: {
          u: {
            enabled: true,
            envFile: env,
            database: "core_uat",
            credentialsOnly: true,
          },
        },
      },
      "u",
    );
    assert.equal(uat.url.pathname, "/core_uat");
  });

  it("a missing variable never falls back to another database", () => {
    const d = tmp();
    const env = envFile(d, "OTHER=1");
    assert.throws(
      () =>
        profileOf(
          {
            profiles: {
              x: { enabled: true, envFile: env, database: "core_a" },
            },
          },
          "x",
        ),
      (e) => e.code === "NO_ENV_KEY",
    );
  });

  it("production is off until enabled AND approved; remote hosts need an explicit allowance", () => {
    const d = tmp();
    const env = envFile(
      d,
      'DATABASE_URL="postgresql://u:pw@db.example:5432/pdabliss_core"',
    );
    const base = {
      envFile: env,
      database: "pdabliss_core",
      kind: "production",
    };
    assert.throws(
      () =>
        profileOf(
          { profiles: { production: { ...base, enabled: false } } },
          "production",
        ),
      (e) => e.code === "PROFILE_DISABLED",
    );
    assert.throws(
      () =>
        profileOf(
          { profiles: { production: { ...base, enabled: true } } },
          "production",
        ),
      (e) => e.code === "NOT_APPROVED",
    );
    assert.throws(
      () =>
        profileOf(
          {
            profiles: {
              production: {
                ...base,
                enabled: true,
                approvedBy: "owner 2026-12-01",
              },
            },
          },
          "production",
        ),
      (e) => e.code === "REMOTE_HOST",
    );
  });

  it("backups never go into a cloud-sync folder, the repository or a relative path", () => {
    assert.throws(
      () => safeBackupDir("C:/Users/x/OneDrive/backups"),
      (e) => e.code === "CLOUD_SYNC_PATH",
    );
    assert.throws(
      () => safeBackupDir(path.join(ROOT, "backups")),
      (e) => e.code === "REPO_PATH" || e.code === "CLOUD_SYNC_PATH",
    );
    assert.throws(
      () => safeBackupDir("backups"),
      (e) => e.code === "BAD_PATH",
    );
    assert.equal(
      safeBackupDir(path.join(os.tmpdir(), "ok-backups")),
      path.resolve(os.tmpdir(), "ok-backups"),
    );
  });

  it("restore refuses any target that is not a fresh scratch name", async () => {
    for (const t of [
      "pdabliss_core_dev",
      "pdabliss_core_uat",
      "pdabliss_core",
      "postgres",
      "core_restore_",
    ]) {
      await assert.rejects(
        restoreInto(
          {},
          "x.dump",
          new URL("postgresql://u:p@localhost:1/x"),
          t,
          null,
        ),
        (e) => e.code === "PROTECTED_TARGET",
      );
    }
    assert.ok(SCRATCH.test("core_restore_drill1"));
  });

  it("redacts connection strings, passwords, session cookies and bearer tokens", () => {
    const s = redact(
      "postgresql://core_app:S3cr3t!@localhost:5432/db password=hunter2 core_sid=abcdef Authorization: Bearer xyz",
    );
    assert.ok(!/S3cr3t|hunter2|abcdef|xyz/.test(s), s);
  });
});

describe("storage monitor", () => {
  it("uses percentage AND absolute free space (configurable)", () => {
    assert.equal(
      classify({ totalBytes: 1000 * GB, freeBytes: 400 * GB }).level,
      "ok",
    );
    assert.equal(
      classify({ totalBytes: 1000 * GB, freeBytes: 250 * GB }).level,
      "observe",
    );
    assert.equal(
      classify({ totalBytes: 1000 * GB, freeBytes: 150 * GB }).level,
      "warning",
    );
    assert.equal(
      classify({ totalBytes: 1000 * GB, freeBytes: 90 * GB }).level,
      "critical",
    );
    // A small disk at 50 % is critical when only 8 GB remain.
    assert.equal(
      classify({ totalBytes: 16 * GB, freeBytes: 8 * GB }).level,
      "critical",
    );
    assert.equal(
      classify(
        { totalBytes: 100 * GB, freeBytes: 15 * GB },
        { ...DEFAULT_THRESHOLDS, criticalPct: 99, warningPct: 98 },
      ).level,
      "warning",
    );
  });

  it("simulated disk filling up: one alert per change, a recovery, never a deletion", async () => {
    const dir = tmp();
    const watched = path.join(dir, "backups");
    fs.mkdirSync(watched);
    fs.writeFileSync(path.join(watched, "keep-me.dump"), "x".repeat(2048));
    const cfg = {
      storage: {
        volumes: [{ name: "backups", path: watched, diagnose: [watched] }],
      },
    };
    const sent = [];
    const state = alertState(path.join(dir, "state.json"));
    const step = (free) =>
      checkStorage(cfg, {
        mock: { [watched]: { totalBytes: 500 * GB, freeBytes: free * GB } },
        state,
        alert: async (e) => sent.push(e),
      });
    await step(300); // ok
    await step(90); // 82 % → warning
    await step(85); // still warning → no new alert
    await step(30); // critical (94 %)
    await step(30); // still critical
    await step(300); // recovered
    assert.deepEqual(
      sent.map((e) => `${e.kind}:${e.level}`),
      ["raise:warning", "escalate:critical", "recover:ok"],
    );
    const crit = sent[1];
    assert.equal(crit.volume, "backups");
    assert.equal(crit.freeGB, 30);
    assert.ok(
      crit.at &&
        crit.reasons.length &&
        crit.diagnostics[0].largestFiles[0].startsWith("keep-me.dump"),
    );
    assert.ok(
      fs.existsSync(path.join(watched, "keep-me.dump")),
      "the monitor deleted nothing",
    );
  });

  it("a volume that cannot be measured is critical (not silently ok)", async () => {
    const r = await checkStorage(
      { storage: { volumes: [{ name: "gone", path: "Z:/no/such/volume" }] } },
      { mock: {} },
    );
    assert.equal(r[0].level, "critical");
  });
});

describe("backup retention", () => {
  const seed = (dir, stamps, verifiedIdx = []) =>
    stamps.forEach((s, i) => {
      const f = `core_db-uat-${s}.dump`;
      fs.writeFileSync(path.join(dir, f), "x");
      fs.writeFileSync(
        path.join(dir, `${f}.json`),
        JSON.stringify({
          verified: verifiedIdx.includes(i) ? { ok: true } : null,
        }),
      );
    });
  const days = (n, from = Date.UTC(2026, 10, 30, 2)) =>
    Array.from({ length: n }, (_, i) =>
      new Date(from - i * 86400000)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d+Z$/, "Z"),
    );

  it("keeps daily / weekly / monthly / newest verified and removes the rest", () => {
    const dir = tmp();
    const s = days(60);
    seed(
      dir,
      s,
      s.map((_, i) => i),
    );
    const p = plan(dir, "uat", { daily: 7, weekly: 4, monthly: 3, minKeep: 3 });
    assert.equal(p.total, 60);
    assert.ok(
      p.keep.length >= 7 && p.keep.length <= 14,
      `kept ${p.keep.length}`,
    );
    assert.ok(
      p.keep.some((k) => k.file.includes(s[0])),
      "newest kept",
    );
    assert.equal(p.keep.length + p.remove.length, 60);
  });

  it("removes nothing while fewer than minKeep backups are verified", () => {
    const dir = tmp();
    seed(dir, days(30), [0, 1]);
    const p = plan(dir, "uat", { daily: 2, weekly: 1, monthly: 1, minKeep: 3 });
    assert.equal(p.remove.length, 0);
    assert.match(p.blocked, /only 2 verified/);
  });

  it("dry run by default; refuses folders off the allow-list; apply removes only the plan", () => {
    const dir = tmp();
    seed(dir, days(20), [...Array(20).keys()]);
    fs.writeFileSync(path.join(dir, "unrelated.txt"), "not ours");
    const log = quietLog();
    assert.throws(
      () => applyRetention({ retention: { allowDirs: [] } }, dir, "uat", log),
      (e) => e.code === "NOT_ALLOWED",
    );
    const cfg = {
      retention: {
        allowDirs: [dir],
        policy: { daily: 3, weekly: 1, monthly: 1, minKeep: 3 },
      },
    };
    const dry = applyRetention(cfg, dir, "uat", log);
    assert.equal(dry.applied, false);
    assert.equal(fs.readdirSync(dir).length, 41, "dry run removed nothing");
    const done = applyRetention(cfg, dir, "uat", log, { apply: true });
    assert.ok(done.remove.length > 0);
    for (const f of done.remove) assert.ok(!fs.existsSync(path.join(dir, f)));
    assert.ok(
      fs.existsSync(path.join(dir, "unrelated.txt")),
      "only its own files",
    );
    assert.deepEqual(
      parseDumpName("pdabliss_core_uat-uat-20261111T010203Z.dump"),
      {
        database: "pdabliss_core_uat",
        profile: "uat",
        stamp: "20261111T010203Z",
      },
    );
  });
});

describe("process safety and logs", () => {
  it("one instance at a time; a stale lock (dead pid) is taken over", () => {
    const lock = path.join(tmp(), "m.lock");
    const release = acquireLock(lock);
    assert.throws(
      () => acquireLock(lock),
      (e) => e.code === "ALREADY_RUNNING",
    );
    release();
    fs.writeFileSync(lock, JSON.stringify({ pid: 999999, at: "then" }));
    const again = acquireLock(lock);
    again();
  });

  it("logs rotate by size, keep N files and never hold a secret", () => {
    const dir = tmp();
    process.env.CORE_OPS_QUIET = "1";
    const log = logger(dir, "r", { maxBytes: 400, keep: 2 });
    for (let i = 0; i < 40; i++)
      log.info(`line ${i} postgresql://core_app:TopSecret1@localhost/db`);
    const files = fs.readdirSync(dir).sort();
    assert.deepEqual(files, ["r.log", "r.log.1", "r.log.2"]);
    for (const f of files)
      assert.ok(
        !fs.readFileSync(path.join(dir, f), "utf8").includes("TopSecret1"),
      );
  });

  it("a failing alert channel is logged, not fatal; LINE is an interface only", async () => {
    const res = await alertDispatcher(
      { alerts: { email: { enabled: true }, line: { enabled: true } } },
      quietLog(),
    )({ level: "warning", title: "t" });
    assert.deepEqual(
      res.map((r) => [r.adapter, r.ok]),
      [
        ["log", true],
        ["email", false],
        ["line", false],
      ],
    );
  });
});

describe("health monitor", () => {
  const fake = (map) => async (url) => {
    const r = map[url];
    if (r === "timeout")
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    if (r instanceof Error) throw r;
    return r ?? { status: 404, body: null };
  };
  const cfg = {
    health: {
      frontendUrl: "http://f/login",
      backendUrl: "http://b",
      retries: 1,
      retryDelayMs: 0,
      timeoutMs: 50,
    },
  };
  const up = {
    "http://f/login": { status: 200 },
    "http://b/health": { status: 200, body: { status: "ok" } },
    "http://b/health/ready": { status: 200, body: { status: "ready" } },
  };

  it("healthy when every check passes", async () => {
    const r = await runChecks(cfg, { fetchImpl: fake(up) });
    assert.deepEqual(
      r.map((x) => `${x.name}=${x.level}`),
      ["frontend=ok", "backend-live=ok", "backend-ready=ok"],
    );
  });

  it("alive but not ready is a warning; a dead process is critical; timeouts are retried then critical", async () => {
    const notReady = await runChecks(cfg, {
      fetchImpl: fake({
        ...up,
        "http://b/health/ready": {
          status: 503,
          body: {
            status: "not_ready",
            checks: { database: "unavailable", schema: "unknown" },
          },
        },
      }),
    });
    assert.equal(
      notReady.find((x) => x.name === "backend-ready").level,
      "warning",
    );
    assert.match(
      notReady.find((x) => x.name === "backend-ready").detail,
      /database unavailable/,
    );
    const dead = await runChecks(cfg, {
      fetchImpl: fake({ "http://f/login": "timeout" }),
    });
    assert.deepEqual(
      dead.map((x) => x.level),
      ["critical", "critical", "critical"],
    );
    assert.equal(dead[0].attempts, 2);
    assert.equal(dead[0].detail, "timeout");
  });

  it("backup freshness: none / stale / fresh", async () => {
    const dir = tmp();
    const f = "core_db-uat-20261111T000000Z.dump";
    fs.writeFileSync(path.join(dir, f), "x");
    const write = (at) =>
      fs.writeFileSync(
        path.join(dir, `${f}.json`),
        JSON.stringify({ verified: { ok: true, at } }),
      );
    const c = {
      health: {
        backups: [
          { profile: "uat", dir, maxAgeHours: 26, criticalAgeHours: 50 },
        ],
      },
    };
    const now = new Date("2026-11-12T12:00:00Z");
    write("2026-11-12T06:00:00Z");
    assert.equal((await runChecks(c, { now }))[0].level, "ok");
    write("2026-11-11T00:00:00Z");
    assert.equal((await runChecks(c, { now }))[0].level, "warning");
    write("2026-11-09T00:00:00Z");
    assert.equal((await runChecks(c, { now }))[0].level, "critical");
  });

  it("a cycle raises once, stays quiet, then sends a recovery", async () => {
    const dir = tmp();
    const sent = [];
    const run = (map) =>
      cycle(
        { ...cfg, storage: { volumes: [] } },
        {
          log: quietLog(dir),
          alert: async (e) => sent.push(`${e.kind}:${e.check}`),
          stateFile: path.join(dir, "s.json"),
          fetchImpl: fake(map),
        },
      );
    await run(up);
    await run({
      ...up,
      "http://b/health/ready": {
        status: 503,
        body: {
          status: "not_ready",
          checks: { database: "unavailable", schema: "unknown" },
        },
      },
    });
    await run({
      ...up,
      "http://b/health/ready": {
        status: 503,
        body: {
          status: "not_ready",
          checks: { database: "unavailable", schema: "unknown" },
        },
      },
    });
    await run(up);
    assert.deepEqual(sent, ["raise:backend-ready", "recover:backend-ready"]);
  });
});

describe("config", () => {
  it("expands ~/ in every path of the config (volumes, folders, status files)", async () => {
    const { loadConfig } = await import("../lib.mjs");
    const f = path.join(tmp(), "c.json");
    fs.writeFileSync(
      f,
      JSON.stringify({
        runDir: "~/r",
        storage: { volumes: [{ path: "~/v" }] },
        health: { backups: [{ dir: "~/b" }] },
      }),
    );
    const c = loadConfig(f);
    for (const p of [
      c.runDir,
      c.storage.volumes[0].path,
      c.health.backups[0].dir,
    ])
      assert.ok(p.startsWith(os.homedir()), p);
  });

  it("the shipped example config is valid, keeps production off and holds no credentials", async () => {
    const { loadConfig } = await import("../lib.mjs");
    const ex = path.join(ROOT, "ops", "ops.config.example.json");
    const c = loadConfig(ex);
    assert.equal(c.profiles.production.enabled, false);
    assert.equal(c.profiles.production.approvedBy, null);
    assert.ok(
      !/postgres(ql)?:\/\/|password/i.test(
        fs.readFileSync(ex, "utf8").replace(/"_[a-z]+": "[^"]*"/g, ""),
      ),
    );
  });
});
