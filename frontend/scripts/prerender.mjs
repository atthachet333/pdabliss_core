// EP17 — build-time static <head> for every indexable public URL.
//
// Runs after `vite build` (client) and `vite build --ssr src/seo/prerender.ts`.
// It reads the built dist/index.html template and writes one HTML file per
// localized route (105), plus the non-indexable shells (login, 404, app) and
// the static-hosting rewrites. The <head> of each file comes from
// src/seo/routeMeta.ts via lib/seo.ts — the same functions the browser uses.
// The body is the unchanged SPA shell: the app still renders client-side.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssr = join(root, 'dist-prerender', 'prerender.js');

const { PAGES, SHELLS, NOSCRIPT, HTML_LANG, headHtml } = await import(pathToFileURL(ssr).href);

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

function page(head, lang, noscript) {
  return template
    .replace(LANG, `<html lang="${lang}"`)
    .replace(HEAD, headHtml(head))
    .replace(NOSCRIPT_TEXT, noscript);
}

function write(file, html) {
  const target = join(dist, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}

for (const p of PAGES) write(p.file, page(p.head, p.head.lang, NOSCRIPT[p.locale]));
for (const s of SHELLS) write(s.file, page(s.head, HTML_LANG.th, NOSCRIPT.th));

// Static-hosting rules (Cloudflare Pages `_redirects` syntax; see
// docs/SEO_LOCALIZATION.md for other hosts):
// - locale aliases are permanent redirects to the canonical prefix (the app
//   does the same client-side, but crawlers should get a real 301)
// - /en/login and /zh/login load the noindex sign-in shell; the app then
//   moves to /login carrying the visitor's language (EP15)
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
    '/app/*         /app          200',
    '',
  ].join('\n'),
);

console.log(
  `prerender: ${PAGES.length} indexable pages + ${SHELLS.length} shells written to dist/`,
);
