// EP17 — checks the built static HTML of every indexable URL BEFORE any
// JavaScript runs. Fails the build (exit 1) on the first class of regression:
// a missing file, a page that inherits another page's head (e.g. a generic
// homepage index.html), a wrong canonical, language or alternate, untranslated
// or Traditional-Chinese metadata, an unsupported claim, a financial value in
// Warehouse metadata, or localhost anywhere.
//
// Expected values are computed two ways: from the typed route metadata (the
// same source the app uses) AND independently from the URL rules below, so a
// bug in the shared helpers cannot hide itself.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssr = join(root, 'dist-prerender', 'prerender.js');
if (!existsSync(ssr)) throw new Error('verify-prerender: run `npm run build` first');
const { PAGES, SHELLS, CLAIMS, TRADITIONAL } = await import(pathToFileURL(ssr).href);

const ORIGIN = 'https://core.pdabliss.com';
const PREFIX = { th: '', en: '/en', 'zh-CN': '/zh' };
const LANG = { th: 'th', en: 'en', 'zh-CN': 'zh-CN' };
const OG = { th: 'th_TH', en: 'en_US', 'zh-CN': 'zh_CN' };
const THAI_LETTERS = /[ก-ฺเ-๛]/;
const MONEY_VALUE = /[฿$€¥]\s?\d|\d\s?(บาท|THB|USD|元)|\d{1,3}(,\d{3})+/;
const urlOf = (route, locale) =>
  route === '/' ? `${ORIGIN}${PREFIX[locale] || '/'}` : `${ORIGIN}${PREFIX[locale]}${route}`;

const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);
const eq = (file, what, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) fail(file, `${what} is ${a}, expected ${e}`);
};

function read(file) {
  const path = join(dist, file);
  if (!existsSync(path)) {
    fail(file, 'missing');
    return null;
  }
  const html = readFileSync(path, 'utf8');
  return { html, doc: new JSDOM(html).window.document };
}

const attr = (doc, sel, a) => doc.head.querySelector(sel)?.getAttribute(a) ?? null;
const all = (doc, sel) => [...doc.head.querySelectorAll(sel)];

const titles = new Map();
const descriptions = new Map();

for (const { route, locale, file, head } of PAGES) {
  const page = read(file);
  if (!page) continue;
  const { html, doc } = page;
  const canonical = urlOf(route, locale);

  eq(file, 'html lang', doc.documentElement.lang, LANG[locale]);
  eq(file, '<title> count', all(doc, 'title').length, 1);
  eq(file, 'title', doc.title, head.title);
  eq(file, 'description count', all(doc, 'meta[name="description"]').length, 1);
  eq(file, 'description', attr(doc, 'meta[name="description"]', 'content'), head.description);
  eq(
    file,
    'canonical',
    all(doc, 'link[rel="canonical"]').map((l) => l.href),
    [canonical],
  );
  eq(
    file,
    'alternates',
    all(doc, 'link[rel="alternate"]').map((l) => [l.getAttribute('hreflang'), l.href]),
    [
      ['th', urlOf(route, 'th')],
      ['en', urlOf(route, 'en')],
      ['zh-CN', urlOf(route, 'zh-CN')],
      ['x-default', urlOf(route, 'th')],
    ],
  );
  eq(file, 'og:title', attr(doc, 'meta[property="og:title"]', 'content'), head.title);
  eq(
    file,
    'og:description',
    attr(doc, 'meta[property="og:description"]', 'content'),
    head.description,
  );
  eq(file, 'og:url', attr(doc, 'meta[property="og:url"]', 'content'), canonical);
  eq(file, 'og:locale', attr(doc, 'meta[property="og:locale"]', 'content'), OG[locale]);
  eq(
    file,
    'og:locale:alternate',
    all(doc, 'meta[property="og:locale:alternate"]')
      .map((m) => m.content)
      .sort(),
    Object.values(OG)
      .filter((o) => o !== OG[locale])
      .sort(),
  );
  eq(
    file,
    'og:image',
    attr(doc, 'meta[property="og:image"]', 'content'),
    `${ORIGIN}/brand/og-image.png`,
  );
  eq(file, 'robots', attr(doc, 'meta[name="robots"]', 'content'), null);

  const types = all(doc, 'script[type="application/ld+json"]').map(
    (s) => JSON.parse(s.textContent)['@type'],
  );
  eq(
    file,
    'JSON-LD',
    types,
    route === '/'
      ? ['WebSite']
      : route === '/about' || route === '/contact'
        ? ['Organization']
        : [],
  );
  if (/localhost|127\.0\.0\.1/.test(html)) fail(file, 'contains localhost');

  const text = `${head.title} ${head.description}`;
  if (locale !== 'th' && THAI_LETTERS.test(text)) fail(file, `Thai in ${locale} metadata: ${text}`);
  if (locale === 'zh-CN' && TRADITIONAL.test(text)) fail(file, `Traditional Chinese: ${text}`);
  const ld = all(doc, 'script[type="application/ld+json"]')
    .map((s) => s.textContent)
    .join(' ');
  for (const re of CLAIMS) if (re.test(`${text} ${ld}`)) fail(file, `unsupported claim ${re}`);
  if (/warehouse/.test(route) && MONEY_VALUE.test(text)) fail(file, `financial value: ${text}`);

  for (const [map, value] of [
    [titles, head.title],
    [descriptions, head.description],
  ]) {
    if (map.has(value)) fail(file, `same head as ${map.get(value)}: ${value}`);
    map.set(value, file);
  }
}

for (const { file } of SHELLS) {
  const page = read(file);
  if (!page) continue;
  eq(file, 'robots', attr(page.doc, 'meta[name="robots"]', 'content'), 'noindex');
  eq(file, 'canonical count', all(page.doc, 'link[rel="canonical"]').length, 0);
  eq(file, 'alternate count', all(page.doc, 'link[rel="alternate"]').length, 0);
}

// Exactly the expected HTML files: 105 pages + the shells, nothing else.
const htmlFiles = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) htmlFiles.push(relative(dist, p).replace(/\\/g, '/'));
  }
};
walk(dist);
eq(
  'dist',
  'HTML files',
  htmlFiles.sort(),
  [...PAGES.map((p) => p.file), ...SHELLS.map((s) => s.file)].sort(),
);
eq('dist', 'indexable pages', PAGES.length, 105);
if (!existsSync(join(dist, '_redirects'))) fail('dist', '_redirects missing');

if (failures.length) {
  console.error(`verify-prerender: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `verify-prerender: ${PAGES.length} pages and ${SHELLS.length} shells carry their own head (no JavaScript needed)`,
);
