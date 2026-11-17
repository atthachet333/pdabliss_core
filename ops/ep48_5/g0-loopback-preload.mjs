// EP48.5 A-0.1 — preloaded by g0-guard.mjs into every G0 process (NODE_OPTIONS=--import=<file URL of this file>).
// See g0-loopback.mjs: non-loopback listeners are refused before any socket exists.
import { install } from "./g0-loopback.mjs";

install();
