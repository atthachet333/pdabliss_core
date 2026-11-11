#!/usr/bin/env node
// PDA BLISS CORE operations CLI (EP43). Usage: node ops/core-ops.mjs <command> [options]
//
//   backup     --profile <name> [--verify]       full logical backup (+ restore verification)
//   verify     --file <dump> --profile <name>     restore-verify an existing backup on the verify server
//   restore    --file <dump> --target core_restore_<suffix> --profile <name>
//                                                  restore into a NEW scratch database (never a protected one)
//   retention  --profile <name> [--apply]         backup retention — DRY RUN unless --apply
//   storage    [--mock stats.json]                storage check once
//   health     [--once] [--mock-storage f.json]   health monitor (loops every health.intervalSeconds)
//   status                                         print the last health status file
//
// Config: ops/ops.config.json (or CORE_OPS_CONFIG). Copy ops/ops.config.example.json.
// Nothing here starts, stops or restarts a service, and nothing deletes database files.
import fs from "node:fs";
import path from "node:path";
import {
  acquireLock,
  alertDispatcher,
  alertState,
  loadConfig,
  logger,
  OpsError,
  profileOf,
  redact,
  urlForDb,
  envValue,
} from "./lib.mjs";
import { backup, restoreInto, verify } from "./backup.mjs";
import { applyRetention } from "./retention.mjs";
import { checkStorage } from "./storage.mjs";
import { cycle } from "./health.mjs";

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k) => {
  const i = args.indexOf(`--${k}`);
  return i > 0 ? args[i + 1] : undefined;
};
const flag = (k) => args.includes(`--${k}`);

function verifyServer(cfg, profile) {
  const v = cfg.verify ?? {};
  if (v.envFile)
    return new URL(envValue(v.envFile, v.envKey ?? "CORE_VERIFY_DATABASE_URL"));
  return urlForDb(profile.url, "postgres");
}

async function main() {
  const cfg = loadConfig(opt("config"));
  const logDir = cfg.logDir ?? path.join(process.cwd(), "ops-logs");
  const log = logger(
    logDir,
    cmd === "health" ? "health" : "ops",
    cfg.logRotation,
  );
  const lockDir = cfg.runDir ?? path.join(logDir, "run");
  switch (cmd) {
    case "backup": {
      const profile = profileOf(cfg, opt("profile"));
      const release = acquireLock(
        path.join(lockDir, `backup-${profile.name}.lock`),
      );
      try {
        const { file } = await backup(cfg, profile, log);
        if (flag("verify")) {
          const r = await verify(cfg, file, verifyServer(cfg, profile), log);
          if (!r.ok) process.exitCode = 2;
        }
      } finally {
        release();
      }
      break;
    }
    case "verify": {
      const profile = profileOf(cfg, opt("profile"));
      const r = await verify(
        cfg,
        path.resolve(opt("file")),
        verifyServer(cfg, profile),
        log,
        { keep: flag("keep") },
      );
      if (!r.ok) process.exitCode = 2;
      break;
    }
    case "restore": {
      const profile = profileOf(cfg, opt("profile"));
      const protectedNames = Object.values(cfg.profiles ?? {}).map(
        (p) => p.database,
      );
      await restoreInto(
        cfg,
        path.resolve(opt("file")),
        verifyServer(cfg, profile),
        opt("target"),
        log,
        { protectedNames },
      );
      break;
    }
    case "retention": {
      const profile = profileOf(cfg, opt("profile"));
      const r = applyRetention(cfg, profile.backupDir, profile.name, log, {
        apply: flag("apply"),
      });
      console.log(
        JSON.stringify(
          {
            keep: r.keep.length,
            remove: r.remove,
            blocked: r.blocked,
            applied: r.applied,
          },
          null,
          1,
        ),
      );
      break;
    }
    case "storage": {
      const mock = opt("mock")
        ? JSON.parse(fs.readFileSync(opt("mock"), "utf8"))
        : undefined;
      const state = alertState(path.join(lockDir, "storage-state.json"));
      const results = await checkStorage(cfg, {
        mock,
        state,
        alert: alertDispatcher(cfg, log),
      });
      console.log(JSON.stringify(results, null, 1));
      if (results.some((r) => r.level === "critical")) process.exitCode = 3;
      break;
    }
    case "health": {
      const release = acquireLock(path.join(lockDir, "health.lock"));
      const alert = alertDispatcher(cfg, log);
      const mockStorage = opt("mock-storage")
        ? JSON.parse(fs.readFileSync(opt("mock-storage"), "utf8"))
        : undefined;
      const stateFile = path.join(lockDir, "health-state.json");
      const once = async () => {
        try {
          return await cycle(cfg, { log, alert, stateFile, mockStorage });
        } catch (e) {
          log.error(`health cycle failed: ${redact(e.message)}`); // the monitor survives its own errors
          return null;
        }
      };
      if (flag("once")) {
        const s = await once();
        release();
        process.exitCode = s?.overall === "critical" ? 3 : s ? 0 : 1;
        break;
      }
      const every = Math.max(15, cfg.health?.intervalSeconds ?? 60) * 1000;
      for (;;) {
        const started = Date.now();
        await once();
        await new Promise((r) =>
          setTimeout(r, Math.max(1000, every - (Date.now() - started))),
        );
      }
    }
    case "status": {
      const f = cfg.health?.statusFile;
      console.log(
        f && fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "no status yet",
      );
      break;
    }
    default:
      console.log(
        fs
          .readFileSync(new URL(import.meta.url), "utf8")
          .split("\n")
          .slice(1, 16)
          .map((l) => l.replace(/^\/\/ ?/, ""))
          .join("\n"),
      );
      if (cmd) process.exitCode = 64;
  }
}

main().catch((e) => {
  console.error(
    `REFUSED  ${redact(e.message)}${e instanceof OpsError ? ` [${e.code}]` : ""}`,
  );
  process.exitCode = e instanceof OpsError ? 2 : 1;
});
