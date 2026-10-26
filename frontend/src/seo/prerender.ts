import { SITE } from '@/config/site';
import { LOGIN_COPY } from '@/features/login/copy';
import { localizePath, LOCALE_META, type Locale } from '@/i18n/locales';
import type { Localized } from '@/i18n/useCopy';
import { headFor, headHtml, type PageHead } from '@/lib/seo';
import { CLAIMS, TRADITIONAL } from '@/test/claims';
import { INDEXABLE } from './routeMeta';

/*
 * Build-time prerender entry (EP17). `vite build --ssr src/seo/prerender.ts`
 * compiles this for Node; scripts/prerender.mjs then writes one static HTML
 * file per indexable URL with its complete <head>, and
 * scripts/verify-prerender.mjs checks the written files. The browser bundle
 * never imports this module.
 */

export { headHtml, CLAIMS, TRADITIONAL };
export { APP_MODULE, LOCALE_MODULES, ROUTE_MODULES } from './routeModules';

/** `/` → `index.html`, `/en` → `en.html`, `/en/pricing` → `en/pricing.html`. */
export function outFile(route: string, locale: Locale): string {
  const path = localizePath(route, locale);
  return path === '/' ? 'index.html' : `${path.slice(1)}.html`;
}

export const PAGES = INDEXABLE.map((p) => ({ ...p, file: outFile(p.route, p.locale) }));

/** <noscript> text in the page's language (the template's is Thai). */
export const NOSCRIPT: Localized<string> = {
  th: 'PDA BLISS CORE ต้องใช้ JavaScript เพื่อแสดงผล — กรุณาเปิดใช้งาน JavaScript ในเบราว์เซอร์ของคุณ',
  en: 'PDA BLISS CORE needs JavaScript to display — please enable JavaScript in your browser.',
  'zh-CN': 'PDA BLISS CORE 需要 JavaScript 才能显示——请在浏览器中启用 JavaScript。',
};

/**
 * Non-indexable shells:
 * - `login.html` — the sign-in gateway (`noindex`), so `/login` loads with its own head
 * - `404.html` — unknown URLs; the app then renders the localized 404 (`noindex`)
 * - `app.html` — the prototype workspaces under `/app/*` (`noindex`; robots.txt disallows them)
 */
const shell = (title: string): PageHead => ({
  ...headFor({ path: '/', locale: 'th', title: null, index: false }),
  title,
});

export const SHELLS: { file: string; head: PageHead }[] = [
  {
    file: 'login.html',
    head: headFor({ path: '/login', locale: 'th', ...LOGIN_COPY.th.meta, index: false }),
  },
  { file: '404.html', head: shell(SITE.name) },
  { file: 'app.html', head: shell(SITE.name) },
];

export const HTML_LANG = Object.fromEntries(
  Object.entries(LOCALE_META).map(([l, m]) => [l, m.htmlLang]),
) as Record<Locale, string>;
