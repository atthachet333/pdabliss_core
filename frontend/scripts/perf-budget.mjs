// EP20 — deterministic build-output performance budget (docs/PERFORMANCE.md).
//
// Runs after the prerender in `npm run build` (and alone: `npm run perf:budget`).
// It measures only the built files — byte sizes and the chunk graph from the Vite
// manifest — never timings, so it cannot fail at random. Compressed sizes are
// local gzip-9 / brotli-11 estimates, not what a CDN will actually send.
//
// It fails the build when:
//  - a budget below is exceeded (each has headroom over the EP20 result), or
//  - heavy code becomes eager: the public entry pulls in CORE World / three.js,
//    the Demo, any Resource guide, an industry or department page, or the /app
//    workspaces; the Resources home pulls in a guide; or a guide pulls in another.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssr = join(root, 'dist-prerender', 'prerender.js');
const manifestFile = join(root, 'dist-prerender', 'client-manifest.json');
if (!existsSync(ssr) || !existsSync(manifestFile))
  throw new Error('perf-budget: run `npm run build` first');
const { ROUTE_MODULES, APP_MODULE } = await import(pathToFileURL(ssr).href);
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));

const KB = 1024;
/*
 * Budgets in kB. EP20 result in brackets; headroom absorbs normal content work
 * (a new section, a few icons) but not an accidental eager import or a new
 * heavyweight dependency. Raise a budget only with a reason in docs/PERFORMANCE.md.
 */
const BUDGET = {
  initialJsGzip: 205, // public entry + its static imports [179; EP19 was 275]
  initialCssGzip: 52, // the one Tailwind stylesheet [44.5]
  largestRouteGzip: 72, // largest page closure beyond the entry [≈60, Resources]
  coreWorldGzip: 265, // three.js + react-three-fiber scene beyond the homepage [≈236]
  criticalFontsKb: 100, // Thai + Latin woff2, weights 400/500/600 [88.4]
  heroAssetsKb: 45, // hero atmosphere + six department thumbnails [36.9]
  // EP25: +200 for the lazy, signed-in-only Company Control Center / CORE entry
  // (≈100 kB raw, never loaded by a public page) — reason in docs/PERFORMANCE.md.
  totalJsKb: 4300, // every JS chunk, raw [≈3,680 at EP20; 4,103 after EP25]
  // EP24.1.4.3: +20 for /consultation in three locales (three new indexable pages).
  htmlTotalKb: 560, // all prerendered HTML, incl. per-route preloads [≈490; 543 after EP24.1.4.3; 560 owner-approved EP24.1.4.4 — do not raise without owner review]
  htmlFiles: 111, // 108 indexable pages (36 routes × 3, EP24.1.4.3) + 3 shells (exact)
};

const failures = [];
const fail = (msg) => failures.push(msg);
const bytes = (file) => readFileSync(join(dist, file));
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const br = (buf) =>
  brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const kb = (n) => +(n / KB).toFixed(1);

/** A chunk's file plus every chunk it statically imports. */
function closure(key, seen = new Set()) {
  const chunk = manifest[key];
  if (!chunk) throw new Error(`perf-budget: ${key} is not in the manifest`);
  if (seen.has(chunk.file)) return seen;
  seen.add(chunk.file);
  for (const dep of chunk.imports ?? []) closure(dep, seen);
  return seen;
}
const sizeOf = (files) => {
  const all = Buffer.concat([...files].map(bytes));
  return { raw: all.length, gzip: [...files].reduce((a, f) => a + gz(bytes(f)), 0), br: br(all) };
};
const fileOf = (src) => manifest[src]?.file;

// ---- Initial (public entry) ----
const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
const initial = closure(entryKey);
const initialJs = sizeOf(initial);
const css = manifest[entryKey].css ?? [];
const initialCss = sizeOf(css);

// ---- Eager-import guards ----
const lazyOnly = {
  'CORE World (three.js)': 'src/features/landing/core-world/CoreWorld.tsx',
  'Demo page': ROUTE_MODULES['/demo'],
  'Homepage chapters': ROUTE_MODULES['/'],
  'Login gateway': ROUTE_MODULES['/login'],
  '/app workspaces': APP_MODULE,
};
for (const [route, src] of Object.entries(ROUTE_MODULES))
  if (/^\/(resources|industries|departments)\//.test(route)) lazyOnly[route] = src;
for (const [name, src] of Object.entries(lazyOnly))
  if (initial.has(fileOf(src))) fail(`${name} is in the initial bundle (${fileOf(src)})`);

const guides = Object.entries(ROUTE_MODULES).filter(([r]) => r.startsWith('/resources/'));
const guideFiles = new Set(guides.map(([, src]) => fileOf(src)));
for (const f of closure(ROUTE_MODULES['/resources']))
  if (guideFiles.has(f)) fail(`the Resources home statically imports guide ${f}`);
for (const [route, src] of guides)
  for (const f of closure(src))
    if (guideFiles.has(f) && f !== fileOf(src)) fail(`${route} statically imports guide ${f}`);

// ---- Route closures beyond the initial bundle ----
const routes = Object.entries(ROUTE_MODULES).map(([route, src]) => {
  const own = new Set([...closure(src)].filter((f) => !initial.has(f)));
  return { route, ...sizeOf(own) };
});
routes.sort((a, b) => b.gzip - a.gzip);
// CORE World is loaded by the homepage, so its cost is what it adds beyond the homepage.
const home = closure(ROUTE_MODULES['/']);
const coreWorld = sizeOf(
  [...closure('src/features/landing/core-world/CoreWorld.tsx')].filter(
    (f) => !initial.has(f) && !home.has(f),
  ),
);

// ---- Assets ----
const assets = readdirSync(join(dist, 'assets'));
const criticalFonts = assets.filter((f) =>
  /^ibm-plex-sans-thai-(thai|latin)-(400|500|600)-normal-.*\.woff2$/.test(f),
);
const fontBytes = criticalFonts.reduce((a, f) => a + statSync(join(dist, 'assets', f)).size, 0);
const heroFiles = [
  ...readdirSync(join(dist, 'hero')).map((f) => `hero/${f}`),
  ...readdirSync(join(dist, 'departments'))
    .filter((f) => f.endsWith('-sm.webp'))
    .map((f) => `departments/${f}`),
];
const heroBytes = heroFiles.reduce((a, f) => a + statSync(join(dist, f)).size, 0);
const jsBytes = assets
  .filter((f) => f.endsWith('.js'))
  .reduce((a, f) => a + statSync(join(dist, 'assets', f)).size, 0);

const html = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) html.push(p);
  }
};
walk(dist);
const htmlBytes = html.reduce((a, p) => a + statSync(p).size, 0);

// ---- Compare ----
const rows = [
  ['initial JS (gzip)', kb(initialJs.gzip), BUDGET.initialJsGzip],
  ['initial CSS (gzip)', kb(initialCss.gzip), BUDGET.initialCssGzip],
  [`largest route (${routes[0].route}, gzip)`, kb(routes[0].gzip), BUDGET.largestRouteGzip],
  ['CORE World chunk (gzip)', kb(coreWorld.gzip), BUDGET.coreWorldGzip],
  ['critical fonts (woff2)', kb(fontBytes), BUDGET.criticalFontsKb],
  ['hero + department thumbnails', kb(heroBytes), BUDGET.heroAssetsKb],
  ['all JS (raw)', kb(jsBytes), BUDGET.totalJsKb],
  ['static HTML (raw)', kb(htmlBytes), BUDGET.htmlTotalKb],
];
for (const [name, value, limit] of rows)
  if (value > limit) fail(`${name}: ${value} kB > ${limit} kB`);
if (html.length !== BUDGET.htmlFiles)
  fail(`static HTML files: ${html.length}, expected ${BUDGET.htmlFiles}`);

const pad = (s, n) => String(s).padEnd(n);
console.log('perf-budget (local gzip-9 / brotli-11 estimates):');
console.log(
  `  initial JS ${kb(initialJs.raw)} kB raw · ${kb(initialJs.gzip)} gzip · ${kb(initialJs.br)} br — ${initial.size} files`,
);
console.log(`  initial CSS ${kb(initialCss.raw)} kB raw · ${kb(initialCss.gzip)} gzip`);
for (const [name, value, limit] of rows)
  console.log(`  ${pad(name, 44)} ${pad(value, 8)} / ${limit} kB`);
console.log(`  ${pad('static HTML files', 44)} ${html.length} / ${BUDGET.htmlFiles}`);
console.log(
  `  largest routes: ${routes
    .slice(0, 5)
    .map((r) => `${r.route} ${kb(r.gzip)}`)
    .join(' · ')}`,
);
if (process.argv.includes('--json'))
  console.log(
    JSON.stringify({
      initial: [...initial],
      initialJs,
      initialCss,
      routes,
      coreWorld,
      fontBytes,
      heroBytes,
      jsBytes,
      htmlBytes,
      htmlFiles: html.length,
      files: html.map((p) => relative(dist, p)).length,
    }),
  );

if (failures.length) {
  console.error(`perf-budget: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('perf-budget: within budget');
