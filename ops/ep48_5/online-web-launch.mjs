#!/usr/bin/env node
// PDA BLISS CORE — EP48.5 O1: CORE online web service entry point (WinSW service pdabliss-core-web;
// environment CORE_ENVIRONMENT=online-uat and nothing else).
//
//   node ops\ep48_5\online-web-launch.mjs
//
// Serves frontend/dist with the hardened static server (never Vite preview) on the constant 127.0.0.1:1311. Every
// failure → exit 78 and a sticky refusal marker. No main-module test on purpose (see staging-launch.mjs).
import { STAGING_ROOT, runCli } from "./launch-common.mjs";
import { SERVICE, runOnlineWebLauncher } from "./web-launcher.mjs";

runCli({
  service: SERVICE,
  root: STAGING_ROOT,
  main: async () => {
    const server = await runOnlineWebLauncher();
    let closing = false;
    const shutdown = () => {
      if (closing) return;
      closing = true;
      const force = setTimeout(() => process.exit(1), 10_000);
      force.unref();
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  },
});
