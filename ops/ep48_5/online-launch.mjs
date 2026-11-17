#!/usr/bin/env node
// PDA BLISS CORE — EP48.5 O1: CORE online API service entry point (WinSW service pdabliss-core-api).
//
//   node --env-file=D:\pdabliss-core-staging\config\core-online.env --max-old-space-size=512 ops\ep48_5\online-launch.mjs
//
// Always the ONLINE profile (production mode, core.pdabliss.com, TRUST_PROXY=loopback, real SMTP); the profile is fixed
// here and never read from the environment (CORE_ENVIRONMENT must equal online-uat). Every failure → exit 78 and a
// sticky refusal marker. No main-module test on purpose (see staging-launch.mjs).
import { PROFILES, SERVICE, runApiLauncher } from "./api-launcher.mjs";
import { STAGING_ROOT, runCli } from "./launch-common.mjs";

runCli({
  service: SERVICE,
  root: STAGING_ROOT,
  main: async () => {
    const app = await runApiLauncher({ profile: PROFILES.online });
    let closing = false;
    const shutdown = (signal) => {
      if (closing) return;
      closing = true;
      app.log?.info?.({ signal }, "Shutting down gracefully");
      const force = setTimeout(() => process.exit(1), 10_000);
      force.unref();
      Promise.resolve(app.close()).then(() => process.exit(0), () => process.exit(1));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  },
});
