#!/usr/bin/env node
// PDA BLISS CORE — EP48.5 CORE Internal Staging: web service entry point (WinSW; environment CORE_ENVIRONMENT=staging).
//
//   node ops\ep48_5\staging-web-launch.mjs
//
// This file only runs the fail-closed launcher (web-launcher.mjs); every failure → exit 78. No main-module test on
// purpose (see staging-launch.mjs).
import { STAGING_ROOT, runCli } from "./launch-common.mjs";
import { SERVICE, runWebLauncher } from "./web-launcher.mjs";

runCli({
  service: SERVICE,
  root: STAGING_ROOT,
  main: async () => {
    const server = await runWebLauncher();
    let closing = false;
    const shutdown = () => {
      if (closing) return;
      closing = true;
      const force = setTimeout(() => process.exit(1), 10_000);
      force.unref();
      Promise.resolve(server.close()).then(() => process.exit(0), () => process.exit(1));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  },
});
