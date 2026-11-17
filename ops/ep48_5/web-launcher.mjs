// PDA BLISS CORE — EP48.5 CORE Internal Staging: fail-closed web launcher (logic; the entry point is
// staging-web-launch.mjs).
//
// Serves the already-built frontend (frontend/dist) with Vite's preview() API, bound to the constant 127.0.0.1:1311.
// Any failed check → exit 78, a sticky refusal marker, and no listener.
// Specification: docs/EP48_5_STAGING_ARCHITECTURE.md §4.2 (P1–P8, W0–W6). frontend/ itself is unchanged from EP48.
//
// EP48.5 O1: runOnlineWebLauncher (entry point online-web-launch.mjs) serves the same build with the hardened
// static server (static-server.mjs) instead of Vite preview(): CORE_ENVIRONMENT=online-uat, the build must target
// https://core.pdabliss.com (no loopback / development API origin), same constant bind and post-bind proofs.
import fs from "node:fs";
import inspector from "node:inspector";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildIndex, createStaticServer } from "./static-server.mjs";
import {
  API_ORIGIN, BIND_HOST, ONLINE_MARKER, PUBLIC_HOST, PUBLIC_ORIGIN, STAGING_ROOT, WEB_ORIGIN, WEB_PORT,
  assertAllowList, assertBoundAddress, assertNoInspector, assertNoStickyMarker, assertNotExposed, assertReleaseLocation,
  assertReleaseSha, envFilesIn, probeExposure, redact, refuse, requireExact,
} from "./launch-common.mjs";

export const SERVICE = "web";
const DEFAULT_RELEASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** P6: the web service needs no CORE variable except its marker (VITE_* in particular is refused). */
export const WEB_ALLOWED = new Set(["CORE_ENVIRONMENT"]);
/** The development API default that must never be baked into a staging build. */
const DEV_API_DEFAULTS = ["localhost:1112", "127.0.0.1:1112"];
/** Chunks that exist only in development / prototype builds (persona picker, prototype workspaces). */
const DEV_ONLY_CHUNK = /^(DevPersonaPicker|appRoutes)[-.]/;

function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** W2 / W3: the build must target the staging API and contain no development-only chunk. */
export function checkBuild(distDir) {
  if (!fs.existsSync(path.join(distDir, "index.html"))) refuse("W2_BUILD", "frontend/dist/index.html is missing (build the release first)");
  const files = walkFiles(distDir);
  const devChunks = files.filter((f) => DEV_ONLY_CHUNK.test(path.basename(f)));
  if (devChunks.length) refuse("W3_DEV_CHUNKS", `the build contains ${devChunks.length} development / prototype chunk(s)`);
  let hasStagingApi = false;
  for (const f of files.filter((x) => x.endsWith(".js"))) {
    const text = fs.readFileSync(f, "utf8");
    if (DEV_API_DEFAULTS.some((d) => text.includes(d))) refuse("W2_API_ORIGIN", "the build still points at the development API (port 1112)");
    if (text.includes(API_ORIGIN)) hasStagingApi = true;
  }
  if (!hasStagingApi) refuse("W2_API_ORIGIN", "the build does not point at the staging API http://127.0.0.1:1312");
}

/** W2 / W3 (online): the build must target https://core.pdabliss.com and carry no loopback or development API origin. */
export function checkOnlineBuild(distDir) {
  if (!fs.existsSync(path.join(distDir, "index.html"))) refuse("W2_BUILD", "frontend/dist/index.html is missing (build the release first)");
  const files = walkFiles(distDir);
  const devChunks = files.filter((f) => DEV_ONLY_CHUNK.test(path.basename(f)));
  if (devChunks.length) refuse("W3_DEV_CHUNKS", `the build contains ${devChunks.length} development / prototype chunk(s)`);
  let hasPublicOrigin = false;
  for (const f of files.filter((x) => x.endsWith(".js"))) {
    const text = fs.readFileSync(f, "utf8");
    if (DEV_API_DEFAULTS.some((d) => text.includes(d))) refuse("W2_API_ORIGIN", "the build still points at the development API (port 1112)");
    if (text.includes(API_ORIGIN) || text.includes(WEB_ORIGIN)) refuse("W2_API_ORIGIN", "the build points at a loopback origin; build it with the public origin");
    if (text.includes(PUBLIC_ORIGIN)) hasPublicOrigin = true;
  }
  if (!hasPublicOrigin) refuse("W2_API_ORIGIN", "the build does not point at https://core.pdabliss.com");
}

/** Resolves a package's ESM entry from its own package.json `exports` (no hard-coded internal path). */
export function resolveEsmEntry(pkgDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  const pick = (e) => {
    if (typeof e === "string") return e;
    if (e && typeof e === "object") return pick(e.import ?? e.default ?? e.node);
    return null;
  };
  const rel = pick(pkg.exports?.["."] ?? pkg.exports) ?? pkg.module ?? pkg.main;
  if (!rel) throw new Error("no ESM entry");
  return path.join(pkgDir, rel);
}

/** Phase A (W0, W1, W5, W6, L14, P6, P7) and the build checks (W2, W3). */
export function preflight({ env, root, releaseRoot, cwd, execArgv, inspectorUrl }) {
  assertNoStickyMarker(root, SERVICE);
  assertNoInspector({ env, execArgv, inspectorUrl });
  assertAllowList(env, WEB_ALLOWED);
  requireExact(env, "CORE_ENVIRONMENT", "staging", "W0_MARKER");
  assertReleaseLocation(root, releaseRoot);
  const releaseSha = assertReleaseSha(releaseRoot, "W1_RELEASE_SHA");
  const frontendDir = path.join(releaseRoot, "frontend");
  const envFiles = envFilesIn([cwd, releaseRoot, frontendDir]);
  if (envFiles.length) refuse("W6_ENV_FILE", `${envFiles.length} .env file(s) found next to the release; Vite would read them`);
  checkBuild(path.join(frontendDir, "dist"));
  return releaseSha;
}

/**
 * Runs every check and starts the preview server. Returns it. Test-only parameters: root, releaseRoot, port, cwd,
 * loadVite, probe, execArgv, inspectorUrl. The bind host is never a parameter.
 */
export async function runWebLauncher({
  env = process.env,
  root = STAGING_ROOT,
  releaseRoot = DEFAULT_RELEASE_ROOT,
  port = WEB_PORT,
  cwd = process.cwd(),
  loadVite = (frontendDir) => import(pathToFileURL(resolveEsmEntry(path.join(frontendDir, "node_modules", "vite"))).href),
  probe = probeExposure,
  execArgv = process.execArgv,
  inspectorUrl = () => inspector.url(),
  log = (line) => process.stdout.write(`${line}\n`),
} = {}) {
  const releaseSha = preflight({ env, root, releaseRoot, cwd, execArgv, inspectorUrl });
  const frontendDir = path.join(releaseRoot, "frontend");

  let vite;
  try {
    vite = await loadVite(frontendDir);
  } catch (err) {
    refuse("P1_LOAD_VITE", `Vite could not be loaded from the release (${redact(err?.message)})`);
  }
  if (typeof vite?.preview !== "function") refuse("P1_LOAD_VITE", "the release's Vite has no preview() API");

  // W4 — constants only; inline options override vite.config.ts (whose own preview host is "localhost").
  const server = await vite.preview({
    root: frontendDir,
    mode: "production",
    clearScreen: false,
    logLevel: "info",
    preview: { host: BIND_HOST, port, strictPort: true, open: false },
  });
  try {
    const addr = server?.httpServer?.address?.();
    assertBoundAddress(addr, port, "W4_BOUND_ADDRESS");
    const r = await assertNotExposed(addr.port, probe, "W4_EXPOSED");
    log(`[core-staging-web] CORE Internal Staging — all launcher checks passed; listening on ${BIND_HOST}:${addr.port} only; exposure probe clean on ${r.checked} address(es); release ${releaseSha}`);
  } catch (err) {
    await Promise.resolve(server?.close?.()).catch(() => {});
    throw err;
  }
  return server;
}

/** Phase A for the online profile (W0 online-uat, W1, W5, W6, L14, P6, P7) and the online build checks. */
export function onlinePreflight({ env, root, releaseRoot, cwd, execArgv, inspectorUrl }) {
  assertNoStickyMarker(root, SERVICE);
  assertNoInspector({ env, execArgv, inspectorUrl });
  assertAllowList(env, WEB_ALLOWED);
  requireExact(env, "CORE_ENVIRONMENT", ONLINE_MARKER, "W0_MARKER");
  assertReleaseLocation(root, releaseRoot);
  const releaseSha = assertReleaseSha(releaseRoot, "W1_RELEASE_SHA");
  const frontendDir = path.join(releaseRoot, "frontend");
  const envFiles = envFilesIn([cwd, releaseRoot, frontendDir]);
  if (envFiles.length) refuse("W6_ENV_FILE", `${envFiles.length} .env file(s) found next to the release`);
  checkOnlineBuild(path.join(frontendDir, "dist"));
  return releaseSha;
}

/**
 * Online web service: every check, then the hardened static server on the constant 127.0.0.1:1311 (W4: post-bind
 * proof and LAN self-probe). Host header must be core.pdabliss.com or the loopback address. Test-only parameters:
 * root, releaseRoot, port, cwd, probe, execArgv, inspectorUrl, robots.
 */
export async function runOnlineWebLauncher({
  env = process.env,
  root = STAGING_ROOT,
  releaseRoot = DEFAULT_RELEASE_ROOT,
  port = WEB_PORT,
  cwd = process.cwd(),
  probe = probeExposure,
  execArgv = process.execArgv,
  inspectorUrl = () => inspector.url(),
  robots = "noindex, nofollow",
  log = (line) => process.stdout.write(`${line}\n`),
} = {}) {
  const releaseSha = onlinePreflight({ env, root, releaseRoot, cwd, execArgv, inspectorUrl });
  let index;
  try {
    index = buildIndex(path.join(releaseRoot, "frontend", "dist"));
  } catch (err) {
    refuse(err?.rule ?? "S1_BUILD", err?.message ?? "the build could not be indexed");
  }
  const server = createStaticServer({ index, robots, allowedHosts: () => [PUBLIC_HOST, BIND_HOST, `${BIND_HOST}:${server.address()?.port}`] });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: BIND_HOST, port, exclusive: true }, resolve);
  }).catch((err) => refuse("W4_LISTEN", `the web service could not listen on its port (${redact(err?.code ?? err?.message)})`));
  try {
    const addr = server.address();
    assertBoundAddress(addr, port, "W4_BOUND_ADDRESS");
    const r = await assertNotExposed(addr.port, probe, "W4_EXPOSED");
    log(`[core-online-web] CORE online — static build served (${index.files.size} files, ${index.redirects.length} rules); listening on ${BIND_HOST}:${addr.port} only; exposure probe clean on ${r.checked} address(es); release ${releaseSha}`);
  } catch (err) {
    await new Promise((r) => server.close(() => r()));
    throw err;
  }
  return server;
}
