// EP17 — build-time static <head> for every indexable public URL.
//
// Runs after `vite build` (client) and `vite build --ssr src/seo/prerender.ts`.
// It reads the built dist/index.html template and writes one HTML file per
// localized route (105), plus the non-indexable shells (login, 404, app) and
// the static-hosting rewrites. The <head> of each file comes from
// src/seo/routeMeta.ts via lib/seo.ts — the same functions the browser uses.
// The body is the unchanged SPA shell: the app still renders client-side.
// EP20: each file also preloads its own page chunk (src/seo/routeModules.ts).

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssr = join(root, 'dist-prerender', 'prerender.js');

const { PAGES, SHELLS, NOSCRIPT, HTML_LANG, headHtml, ROUTE_MODULES, LOCALE_MODULES, APP_MODULE } =
  await import(pathToFileURL(ssr).href);

// EP20: the client build's manifest (source module → hashed chunk). It is not
// part of the site, so it moves out of dist/ (kept beside the SSR module for
// re-runs and for scripts/perf-budget.mjs).
const builtManifest = join(dist, '.vite', 'manifest.json');
const savedManifest = join(root, 'dist-prerender', 'client-manifest.json');
if (existsSync(builtManifest)) {
  copyFileSync(builtManifest, savedManifest);
  rmSync(join(dist, '.vite'), { recursive: true, force: true });
}
const manifest = JSON.parse(readFileSync(savedManifest, 'utf8'));

/**
 * <link rel="modulepreload"> for a source module's chunk and its static
 * imports — everything the router would otherwise request only after the
 * entry has run. Chunks the template already loads are skipped.
 */
function preloads(sources, template) {
  const files = new Set();
  const visit = (key) => {
    const chunk = manifest[key];
    if (!chunk) throw new Error(`prerender: ${key} is not in the Vite manifest`);
    if (files.has(chunk.file)) return;
    files.add(chunk.file);
    for (const dep of chunk.imports ?? []) visit(dep);
  };
  for (const src of sources) visit(src);
  return [...files]
    .filter((f) => !template.includes(`/${f}"`))
    .map((f) => `<link rel="modulepreload" crossorigin href="/${f}">`)
    .join('\n    ');
}

// EP20: Thai pages preload the three Thai-script faces they paint first
// (IBM Plex Sans Thai 400/500/600, ≈ 36 kB). Measured on a throttled phone:
// no slower first paint, and the separate font-swap relayouts (up to four
// tasks of 60–250 ms) disappear. English and Chinese pages preload no font:
// preloading the Latin faces there delayed first paint by ≈ 0.2 s.
const THAI_FONTS = readdirSync(join(dist, 'assets'))
  .filter((f) => /^ibm-plex-sans-thai-thai-(400|500|600)-normal-[\w-]+\.woff2$/.test(f))
  .map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/${f}">`);
if (THAI_FONTS.length !== 3)
  throw new Error('prerender: expected 3 Thai woff2 faces in dist/assets');

// dist/index.html becomes the Thai homepage below, so the pristine template is
// kept beside the SSR module (refreshed on every full build) — re-running this
// script alone is safe.
const saved = join(root, 'dist-prerender', 'template.html');
if (!existsSync(saved)) copyFileSync(join(dist, 'index.html'), saved);
const template = readFileSync(saved, 'utf8');
const HEAD = /<!-- seo:head -->[\s\S]*?<!-- \/seo:head -->/;
const NOSCRIPT_TEXT = /<!-- seo:noscript -->[\s\S]*?<!-- \/seo:noscript -->/;
const LANG = /<html lang="[^"]*"/;
for (const [name, re] of Object.entries({ HEAD, NOSCRIPT_TEXT, LANG })) {
  if (!re.test(template))
    throw new Error(
      `prerender: the template has no ${name} marker — dist/index.html was already prerendered; run the full "npm run build" (client build first)`,
    );
}

function page(head, lang, noscript, sources = [], thaiFonts = false) {
  let html = template
    .replace(LANG, `<html lang="${lang}"`)
    .replace(HEAD, headHtml(head))
    .replace(NOSCRIPT_TEXT, noscript);
  if (thaiFonts)
    html = html.replace(
      '<link rel="stylesheet"',
      `${THAI_FONTS.join('\n    ')}\n    <link rel="stylesheet"`,
    );
  const links = preloads(sources, template);
  return links ? html.replace('</head>', `  ${links}\n  </head>`) : html;
}

function write(file, html) {
  const target = join(dist, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}

for (const p of PAGES) {
  const sources = [LOCALE_MODULES[p.locale], ROUTE_MODULES[p.route]].filter(Boolean);
  write(p.file, page(p.head, p.head.lang, NOSCRIPT[p.locale], sources, p.locale === 'th'));
}
const SHELL_MODULES = { 'login.html': [ROUTE_MODULES['/login']], 'app.html': [APP_MODULE] };
for (const s of SHELLS)
  write(
    s.file,
    page(s.head, HTML_LANG.th, NOSCRIPT.th, SHELL_MODULES[s.file], s.file === 'login.html'),
  );

// Static-hosting rules (Cloudflare Pages `_redirects` syntax; see
// docs/SEO_LOCALIZATION.md for other hosts):
// - locale aliases are permanent redirects to the canonical prefix (the app
//   does the same client-side, but crawlers should get a real 301)
// - /en/login and /zh/login load the noindex sign-in shell; the app then
//   moves to /login carrying the visitor's language (EP15)
// - EP23 account screens (register, verify email, forgot/reset password) load
//   the same noindex sign-in shell; the Account Portal and the Platform
//   Control Center load the noindex app shell — no new HTML files, nothing
//   added to the sitemap
// - the prototype workspaces are client routes on the noindex app shell
write(
  '_redirects',
  [
    '/th            /             301',
    '/th/*          /:splat       301',
    '/zh-CN         /zh           301',
    '/zh-CN/*       /zh/:splat    301',
    '/zh-hans       /zh           301',
    '/zh-hans/*     /zh/:splat    301',
    '/en/login      /login        200',
    '/zh/login      /login        200',
    '/en/register   /login        200',
    '/zh/register   /login        200',
    '/en/forgot-password /login   200',
    '/zh/forgot-password /login   200',
    '/register      /login        200',
    '/verify-email  /login        200',
    '/forgot-password /login      200',
    '/reset-password /login       200',
    '/account       /app          200',
    '/account/*     /app          200',
    '/platform      /app          200',
    '/platform/*    /app          200',
    '/app/*         /app          200',
    '',
  ].join('\n'),
);

console.log(
  `prerender: ${PAGES.length} indexable pages + ${SHELLS.length} shells written to dist/`,
);
