// PDA BLISS CORE — EP48.5 O1: hardened static server for the compiled frontend (online profile).
//
// Replaces Vite preview() for the online service (Vite documents preview as not a production server). Design:
// - At start-up the build directory is indexed ONCE: every regular file below frontend/dist becomes an entry
//   "/url/path" → absolute file. A request is answered only by an exact lookup in that immutable index, so no request
//   path ever reaches the file system: traversal (../, %2e%2e, backslashes, drive letters, ::$DATA streams, short
//   names) cannot name a file that is not in the index. A symbolic link or junction anywhere in the build refuses
//   start-up (fail closed).
// - Never served: dot paths (.vite/manifest.json, .env*), source maps, the host rule files (_redirects, _headers),
//   anything outside dist. There is no directory listing.
// - Routing follows the build's own contract, dist/_redirects (Cloudflare Pages syntax written by
//   frontend/scripts/prerender.mjs): 301 locale aliases and 200 rewrites to the login.html / app.html shells. Pages are
//   "/x" → "x.html". The router's /company/* and /core/* app routes have no rule in that file, so APP_ROUTES maps them
//   to the app shell (the application uses createRoot, so any shell boots the client router). Unknown paths get
//   404.html with status 404; a missing asset is a plain 404, never the HTML shell.
// - GET and HEAD only; Host must be the public hostname or the loopback address; URLs longer than 2048 → 414.
// - Security headers on every response; hashed assets are immutable, HTML is revalidated.
// No package is needed: node:http, node:fs, node:path only.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

export const MAX_URL_LENGTH = 2048;
/** App-shell routes defined by frontend/src/app/router.tsx that dist/_redirects does not cover. */
export const APP_ROUTES = Object.freeze(["/company", "/company/*", "/core", "/core/*"]);

const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
});
export const contentTypeOf = (file) => CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";

/** Headers on every response. HSTS without includeSubDomains: only this hostname is affected. */
export function securityHeaders({ robots = "noindex, nofollow" } = {}) {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "strict-transport-security": "max-age=31536000",
    // Restricts framing, plugins, base and form targets only; a full script CSP is EP48.6 (needs app review).
    "content-security-policy": "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
    ...(robots ? { "x-robots-tag": robots } : {}),
  };
}

class StaticBuildError extends Error {
  constructor(rule, message) {
    super(message);
    this.name = "StaticBuildError";
    this.rule = rule;
  }
}

/** True for URL paths that must never be served even if a file exists. */
export function isHiddenPath(urlPath) {
  const segments = urlPath.split("/").filter(Boolean);
  if (segments.some((s) => s.startsWith("."))) return true;
  const base = segments.at(-1) ?? "";
  return /\.map$/i.test(base) || ["_redirects", "_headers", "_routes.json"].includes(base);
}

/**
 * Indexes the build. Throws StaticBuildError (rule id, no value) if dist is missing, is or contains a link /
 * junction, has no index.html / 404.html, or holds a file outside regular files.
 */
export function buildIndex(distDir) {
  let real;
  let st;
  try {
    st = fs.lstatSync(distDir);
    real = fs.realpathSync.native(distDir);
  } catch {
    throw new StaticBuildError("S1_BUILD_MISSING", "the frontend build directory does not exist");
  }
  if (st.isSymbolicLink() || !st.isDirectory()) throw new StaticBuildError("S1_BUILD_LINK", "the build directory must be a plain directory");
  const files = new Map();
  const walk = (dir, urlPrefix) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const lst = fs.lstatSync(abs);
      if (lst.isSymbolicLink()) throw new StaticBuildError("S1_BUILD_LINK", "the build contains a symbolic link or junction");
      const url = `${urlPrefix}/${e.name}`;
      if (lst.isDirectory()) walk(abs, url);
      else if (lst.isFile()) {
        if (!isHiddenPath(url)) files.set(url, abs);
      } else throw new StaticBuildError("S1_BUILD_ENTRY", "the build contains an entry that is not a file or directory");
    }
  };
  walk(real, "");
  for (const required of ["/index.html", "/404.html"])
    if (!files.has(required)) throw new StaticBuildError("S1_BUILD_INCOMPLETE", `the build has no ${required.slice(1)}`);
  let redirects = [];
  const rules = path.join(real, "_redirects");
  if (fs.existsSync(rules)) redirects = parseRedirects(fs.readFileSync(rules, "utf8"));
  return { root: real, files, redirects };
}

/** Cloudflare Pages `_redirects` subset used by the build: "from to status", exact or trailing "/*", status 200 / 301. */
export function parseRedirects(text) {
  const rules = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [from, to, statusText = "301"] = line.split(/\s+/);
    const status = Number(statusText);
    const ok = /^\/[^\s*]*(\/\*)?$/.test(from) && /^\/[^\s]*$/.test(to) && !to.startsWith("//") && [200, 301, 302].includes(status);
    if (!ok) throw new StaticBuildError("S2_REDIRECTS", "dist/_redirects contains a rule this server does not support");
    rules.push({ from, to, status, splat: from.endsWith("/*") });
  }
  return rules;
}

function matchRule(rules, urlPath) {
  for (const r of rules) {
    if (r.splat) {
      const base = r.from.slice(0, -2);
      if (urlPath.startsWith(`${base}/`)) return { rule: r, splat: urlPath.slice(base.length + 1) };
    } else if (urlPath === r.from) return { rule: r, splat: "" };
  }
  return null;
}

/** The file serving a clean URL path ("/" → index.html, "/x" → x.html, "/x.css" → itself), or null. */
function fileFor(index, urlPath) {
  if (urlPath === "/") return index.files.get("/index.html") ?? null;
  return index.files.get(urlPath) ?? (path.extname(urlPath) ? null : index.files.get(`${urlPath}.html`) ?? null);
}

/**
 * Pure routing decision. Returns { status, file?, location?, kind }. Never touches the file system.
 * rawUrl is the request target exactly as received.
 */
export function resolveRequest(index, rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.startsWith("/")) return { status: 400, kind: "bad-target" }; // absolute-form / asterisk
  if (rawUrl.length > MAX_URL_LENGTH) return { status: 414, kind: "too-long" };
  const q = rawUrl.indexOf("?");
  const rawPath = q < 0 ? rawUrl : rawUrl.slice(0, q);
  const query = q < 0 ? "" : rawUrl.slice(q);
  let p;
  try {
    p = decodeURIComponent(rawPath);
  } catch {
    return { status: 400, kind: "bad-encoding" };
  }
  // Anything that could mean something to a file system or a second decoder is refused outright.
  if (/[\\\x00-\x1f\x7f]/.test(p) || p.includes("//") || /(^|\/)\.\.?(\/|$)/.test(p) || /%/.test(p) || p.includes(":"))
    return { status: 400, kind: "unsafe-path" };
  if (isHiddenPath(p)) return { status: 404, kind: "hidden" };
  if (p === "/404" || p === "/404.html") return { status: 404, file: index.files.get("/404.html"), kind: "not-found" };
  // Clean URLs: "/x.html" → 301 "/x"; "/x/" → 301 "/x" (the root stays "/").
  if (p.endsWith(".html")) {
    const clean = p === "/index.html" ? "/" : p.slice(0, -5);
    if (index.files.has(p)) return { status: 301, location: `${clean}${query}`, kind: "clean-url" };
  }
  if (p.length > 1 && p.endsWith("/")) return { status: 301, location: `${p.replace(/\/+$/, "") || "/"}${query}`, kind: "trailing-slash" };
  const direct = fileFor(index, p);
  if (direct) return { status: 200, file: direct, kind: "file" };
  const hit = matchRule(index.redirects, p) ?? matchRule(APP_ROUTES.map((from) => ({ from, to: "/app", status: 200, splat: from.endsWith("/*") })), p);
  if (hit) {
    const target = hit.rule.to.replace(":splat", hit.splat);
    if (!target.startsWith("/") || target.startsWith("//")) return { status: 400, kind: "unsafe-redirect" };
    if (hit.rule.status === 200) {
      const file = fileFor(index, target);
      return file ? { status: 200, file, kind: "rewrite" } : { status: 404, file: index.files.get("/404.html"), kind: "not-found" };
    }
    return { status: hit.rule.status, location: `${target}${query}`, kind: "redirect" };
  }
  if (path.extname(p) || p.startsWith("/assets/")) return { status: 404, kind: "missing-asset" };
  return { status: 404, file: index.files.get("/404.html"), kind: "not-found" };
}

/**
 * The HTTP server (not yet listening). allowedHosts: exact Host header values, or a function returning them (evaluated
 * per request, so a value may name the port once bound); anything else → 421.
 */
export function createStaticServer({ index, allowedHosts, robots = "noindex, nofollow" }) {
  const base = securityHeaders({ robots });
  const hostsNow = () => new Set((typeof allowedHosts === "function" ? allowedHosts() : allowedHosts).map((h) => String(h).toLowerCase()));
  const server = http.createServer((req, res) => {
    for (const [k, v] of Object.entries(base)) res.setHeader(k, v);
    const plain = (status, text, extra = {}) => {
      res.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...extra });
      res.end(req.method === "HEAD" ? undefined : `${text}\n`);
    };
    if (req.method !== "GET" && req.method !== "HEAD") return plain(405, "Method Not Allowed", { allow: "GET, HEAD" });
    if (!hostsNow().has(String(req.headers.host ?? "").toLowerCase())) return plain(421, "Misdirected Request");
    const r = resolveRequest(index, req.url);
    if (r.location) return plain(r.status, "Moved", { location: r.location });
    if (!r.file) return plain(r.status, r.status === 404 ? "Not Found" : "Bad Request");
    let stat;
    try {
      stat = fs.statSync(r.file);
    } catch {
      return plain(404, "Not Found");
    }
    const immutable = r.kind === "file" && r.file.includes(`${path.sep}assets${path.sep}`);
    res.writeHead(r.status, {
      "content-type": contentTypeOf(r.file),
      "content-length": stat.size,
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    });
    if (req.method === "HEAD") return res.end();
    const stream = fs.createReadStream(r.file);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 100;
  return server;
}
export { StaticBuildError };
