#!/usr/bin/env node
// PDA BLISS CORE — EP48.5 CORE Internal Staging: API service entry point (WinSW).
//
//   node --env-file=D:\pdabliss-core-staging\config\core-staging.env --max-old-space-size=512 ops\ep48_5\staging-launch.mjs
//
// This file only runs the fail-closed launcher (api-launcher.mjs). It has no "am I the main module?" test on purpose:
// such a test can silently do nothing when the path goes through the `current` junction. Every failure → exit 78.
import { SERVICE, runApiLauncher } from "./api-launcher.mjs";
import { STAGING_ROOT, runCli } from "./launch-common.mjs";

runCli({
  service: SERVICE,
  root: STAGING_ROOT,
  main: async () => {
    const app = await runApiLauncher();
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
