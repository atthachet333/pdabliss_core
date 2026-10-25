import { COMPANY } from '@/config/company';
import { SITE } from '@/config/site';
import { LOCALE_META, LOCALES, localizePath, stripLocale, type Locale } from '@/i18n/locales';
import type { Localized } from '@/i18n/useCopy';

/*
 * The typed SEO model (EP17): one origin, one URL shape, one alternates rule
 * and one head shape (`PageHead`). usePageMeta applies a PageHead to the live
 * document; the build-time prerender (src/seo) serializes the same PageHead
 * into every route's static HTML; tests and the sitemap check read the same
 * functions — so the browser, the built files and the sitemap cannot disagree.
 */

/** Open Graph locale codes (territory form, as Open Graph expects). */
export const OG_LOCALE: Record<Locale, string> = { th: 'th_TH', en: 'en_US', 'zh-CN': 'zh_CN' };

/** Production origin without a trailing slash (configurable via VITE_SITE_URL). */
const ORIGIN = SITE.url.replace(/\/+$/, '');

/** `/en/pricing/` → `/pricing`; the root stays `/`. Query and hash are not part of a page's identity. */
export function basePath(pathname: string): string {
  const path = stripLocale(pathname).replace(/\/{2,}/g, '/');
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

/** Absolute URL of a base path in a locale: `/pricing`, en → https://…/en/pricing. */
export function absoluteUrl(path: string, locale: Locale): string {
  const local = localizePath(path, locale);
  return `${ORIGIN}${local === '/' ? '/' : local}`;
}

/** Every locale's URL of the same page, for hreflang alternates. */
export function alternatesOf(path: string): { hreflang: string; href: string }[] {
  return [
    ...LOCALES.map((l) => ({ hreflang: LOCALE_META[l].htmlLang, href: absoluteUrl(path, l) })),
    { hreflang: 'x-default', href: absoluteUrl(path, 'th') },
  ];
}

/** The site-wide fallbacks: homepage title tail and the default description. */
export const PAGE_DEFAULTS: Localized<{ home: string; description: string }> = {
  th: { home: 'แพลตฟอร์มปฏิบัติการสำหรับทุกแผนก', description: SITE.defaultDescription },
  en: {
    home: 'Department Operations Platform',
    description:
      'PDA BLISS CORE is a department operations platform: every department gets its own workspace, and every step is connected through one shared set of data.',
  },
  'zh-CN': {
    home: '面向所有部门的运营平台',
    description:
      'PDA BLISS CORE 部门运营平台：每个部门拥有自己的工作空间，所有环节通过同一套数据相连。',
  },
};

/** `Title | PDA BLISS CORE`; the homepage (`null`) is `PDA BLISS CORE — <positioning>`. */
export function pageTitle(title: string | null, locale: Locale): string {
  return title ? `${title} | ${SITE.name}` : `${SITE.name} — ${PAGE_DEFAULTS[locale].home}`;
}

/** Everything a page says about itself in <head>. */
export interface PageHead {
  lang: string;
  title: string;
  description: string;
  ogLocale: string;
  ogLocaleAlternates: string[];
  /** Indexable pages only. */
  canonical?: string;
  alternates: { hreflang: string; href: string }[];
  robots?: 'noindex';
  jsonLd: object[];
}

export function headFor({
  path,
  locale,
  title,
  description,
  index = true,
  jsonLd = [],
}: {
  path: string;
  locale: Locale;
  title: string | null;
  description?: string;
  index?: boolean;
  jsonLd?: object[];
}): PageHead {
  return {
    lang: LOCALE_META[locale].htmlLang,
    title: pageTitle(title, locale),
    description: description ?? PAGE_DEFAULTS[locale].description,
    ogLocale: OG_LOCALE[locale],
    ogLocaleAlternates: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    ...(index ? { canonical: absoluteUrl(path, locale) } : { robots: 'noindex' as const }),
    alternates: index ? alternatesOf(path) : [],
    jsonLd,
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Serializes a PageHead for static HTML. Elements a page swaps on client-side
 * navigation (canonical, alternates, locale alternates, JSON-LD) carry
 * `data-prerendered`; main.tsx removes them before the app takes over, so
 * usePageMeta never duplicates them.
 */
export function headHtml(h: PageHead): string {
  const meta = (k: 'name' | 'property', key: string, v: string, pre = false) =>
    `<meta ${k}="${key}" content="${escapeHtml(v)}"${pre ? ' data-prerendered' : ''} />`;
  return [
    `<title>${escapeHtml(h.title)}</title>`,
    meta('name', 'description', h.description),
    ...(h.robots ? [meta('name', 'robots', h.robots, true)] : []),
    ...(h.canonical
      ? [`<link rel="canonical" href="${escapeHtml(h.canonical)}" data-prerendered />`]
      : []),
    ...h.alternates.map(
      (a) =>
        `<link rel="alternate" hreflang="${a.hreflang}" href="${escapeHtml(a.href)}" data-prerendered />`,
    ),
    meta('property', 'og:title', h.title),
    meta('property', 'og:description', h.description),
    ...(h.canonical ? [meta('property', 'og:url', h.canonical)] : []),
    meta('property', 'og:locale', h.ogLocale),
    ...h.ogLocaleAlternates.map((l) => meta('property', 'og:locale:alternate', l, true)),
    ...h.jsonLd.map(
      (j) =>
        `<script type="application/ld+json" data-prerendered>${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`,
    ),
  ].join('\n    ');
}

/** The factual WebSite JSON-LD for the homepage (no search action, ratings or claims). */
export function websiteSchema(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: absoluteUrl('/', locale),
    inLanguage: LOCALE_META[locale].htmlLang,
    publisher: { '@type': 'Organization', name: COMPANY.legalName, url: SITE.url },
  };
}
