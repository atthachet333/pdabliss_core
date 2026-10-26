import { screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import robots from '../../public/robots.txt?raw';
import sitemap from '../../public/sitemap.xml?raw';
import { SITE } from '@/config/site';
import { LOCALE_META, LOCALES, type Locale } from '@/i18n/locales';
import { absoluteUrl, alternatesOf, OG_LOCALE } from '@/lib/seo';
import { routeHead } from '@/seo/routeMeta';
import { CLAIMS, strings, TRADITIONAL } from './claims';
import { LOCALE_PREFIXES, PUBLIC_ROUTES } from './publicRoutes';
import { renderRoute } from './render';

/*
 * EP17: the SEO contract of every public page in every locale — one source
 * (lib/seo.ts + usePageMeta) for title, description, canonical, hreflang and
 * Open Graph, checked against the sitemap, robots.txt and index.html.
 */

type Head = {
  route: string;
  locale: Locale;
  title: string;
  description: string;
  descriptions: number;
  canonicals: string[];
  alternates: { hreflang: string; href: string }[];
  ogUrl: string | null;
  ogLocale: string | null;
  robots: string | null;
  lang: string;
  h1: number;
  jsonLd: unknown[];
  hrefs: string[];
};

const PREFIX = LOCALE_PREFIXES as Record<Locale, string>;
const url = (route: string, locale: Locale) =>
  route === '/' ? PREFIX[locale] || '/' : `${PREFIX[locale]}${route}`;
const THAI_LETTERS = /[ก-ฺเ-๛]/; // Thai script without the baht sign (฿ is a currency symbol)

function readHead(route: string, locale: Locale): Head {
  const attr = (sel: string, a: string) =>
    document.head.querySelector(sel)?.getAttribute(a) ?? null;
  return {
    route,
    locale,
    title: document.title,
    description: attr('meta[name="description"]', 'content') ?? '',
    descriptions: document.head.querySelectorAll('meta[name="description"]').length,
    canonicals: [...document.head.querySelectorAll('link[rel="canonical"]')].map((l) =>
      l.getAttribute('href')!,
    ),
    alternates: [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => ({
      hreflang: l.getAttribute('hreflang')!,
      href: l.getAttribute('href')!,
    })),
    ogUrl: attr('meta[property="og:url"]', 'content'),
    ogLocale: attr('meta[property="og:locale"]', 'content'),
    robots: attr('meta[name="robots"]', 'content'),
    lang: document.documentElement.lang,
    h1: document.querySelectorAll('h1').length,
    jsonLd: [...document.head.querySelectorAll('script[type="application/ld+json"]')].map((s) =>
      JSON.parse(s.textContent ?? '{}'),
    ),
    hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!),
  };
}

const HEADS: Head[] = [];

beforeAll(async () => {
  for (const locale of LOCALES) {
    for (const route of PUBLIC_ROUTES) {
      const { unmount } = renderRoute(url(route, locale));
      await screen.findAllByRole('heading', { level: 1 });
      await waitFor(() => expect(document.documentElement.lang).toBe(LOCALE_META[locale].htmlLang));
      HEADS.push(readHead(route, locale));
      unmount();
    }
  }
}, 180000);

describe('every page in every locale', () => {
  it('covers all routes in th / en / zh-CN', () => {
    expect(HEADS).toHaveLength(PUBLIC_ROUTES.length * LOCALES.length);
  });

  it('has one H1, one description, the right lang and no robots block', () => {
    for (const h of HEADS) {
      const id = `${h.locale} ${h.route}`;
      expect(h.h1, id).toBe(1);
      expect(h.descriptions, id).toBe(1);
      expect(h.lang, id).toBe(LOCALE_META[h.locale].htmlLang);
      expect(h.robots, id).toBeNull();
    }
  });

  it('has exactly one canonical, on the production origin, in its own locale', () => {
    for (const h of HEADS) {
      const id = `${h.locale} ${h.route}`;
      expect(h.canonicals, id).toEqual([absoluteUrl(h.route, h.locale)]);
      expect(h.canonicals[0], id).toMatch(/^https:\/\/core\.pdabliss\.com(\/|$)/);
      expect(h.ogUrl, id).toBe(h.canonicals[0]);
      expect(h.ogLocale, id).toBe(OG_LOCALE[h.locale]);
    }
  });

  it('lists hreflang alternates for the same page in every locale, reciprocally', () => {
    for (const h of HEADS) {
      expect(h.alternates, `${h.locale} ${h.route}`).toEqual(alternatesOf(h.route));
      // Each alternate is itself one of the canonicals of this route.
      for (const a of h.alternates.filter((x) => x.hreflang !== 'x-default')) {
        const target = HEADS.find((x) => x.route === h.route && x.canonicals[0] === a.href);
        expect(target, a.href).toBeDefined();
        expect(LOCALE_META[target!.locale].htmlLang).toBe(a.hreflang);
      }
    }
  });

  it('renders exactly the head the build prerenders (src/seo/routeMeta.ts)', () => {
    // The static HTML for crawlers and the live document must never disagree.
    for (const h of HEADS) {
      const built = routeHead(h.route as Parameters<typeof routeHead>[0], h.locale);
      const id = `${h.locale} ${h.route}`;
      expect(h.title, id).toBe(built.title);
      expect(h.description, id).toBe(built.description);
      expect(h.canonicals, id).toEqual([built.canonical]);
      expect(h.alternates, id).toEqual(built.alternates);
      expect(h.lang, id).toBe(built.lang);
      expect(h.ogLocale, id).toBe(built.ogLocale);
      expect(
        h.jsonLd.map((j) => (j as { '@type': string })['@type']),
        id,
      ).toEqual(built.jsonLd.map((j) => (j as { '@type': string })['@type']));
    }
  });

  it('gives every page a unique title and description', () => {
    const dup = (key: 'title' | 'description') => {
      const seen = new Map<string, string>();
      return HEADS.flatMap((h) => {
        const id = `${h.locale} ${h.route}`;
        const prev = seen.get(h[key]);
        seen.set(h[key], id);
        return prev ? [`${prev} = ${id}`] : [];
      });
    };
    expect(dup('title')).toEqual([]);
    expect(dup('description')).toEqual([]);
    for (const h of HEADS) expect(h.title, h.route).toMatch(/PDA BLISS CORE/);
  });

  it('localizes metadata: no Thai in English or Chinese, Simplified Chinese only', () => {
    for (const h of HEADS.filter((x) => x.locale !== 'th')) {
      expect(`${h.title} ${h.description}`, `${h.locale} ${h.route}`).not.toMatch(THAI_LETTERS);
      if (h.locale === 'zh-CN') expect(`${h.title} ${h.description}`).not.toMatch(TRADITIONAL);
    }
  });

  it('makes no unsupported claim in titles, descriptions or structured data', () => {
    for (const h of HEADS) {
      for (const s of [h.title, h.description, ...strings(h.jsonLd)])
        for (const re of CLAIMS) expect(s, `${h.locale} ${h.route}: ${s}`).not.toMatch(re);
      const ABSOLUTE = /zero (errors?|mistakes?)|error-free|eliminat|ไม่มีข้อผิดพลาด|零差错|杜绝/i;
      expect(`${h.title} ${h.description}`).not.toMatch(ABSOLUTE);
    }
  });

  it('keeps Warehouse-facing metadata free of financial values', () => {
    const MONEY_VALUE = /[฿$€¥]\s?\d|\d\s?(บาท|THB|USD|元)|\d{1,3}(,\d{3})+/;
    for (const h of HEADS.filter((x) => /warehouse/.test(x.route)))
      expect(`${h.title} ${h.description}`, `${h.locale} ${h.route}`).not.toMatch(MONEY_VALUE);
  });

  it('keeps every internal link in the visitor’s locale', () => {
    const bad: string[] = [];
    for (const h of HEADS.filter((x) => x.locale !== 'th')) {
      const prefix = PREFIX[h.locale];
      for (const href of h.hrefs) {
        if (!href.startsWith('/') || href === '/login' || href.startsWith('/login?')) continue;
        if (href !== prefix && !href.startsWith(`${prefix}/`) && !href.startsWith(`${prefix}#`))
          bad.push(`${h.locale} ${h.route}: ${href}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('uses only factual structured data: WebSite on home, Organization on About and Contact', () => {
    const FAKE = /aggregateRating|review|ratingValue|datePublished|author|award|offers/i;
    for (const h of HEADS) {
      expect(JSON.stringify(h.jsonLd)).not.toMatch(FAKE);
      const types = h.jsonLd.map((j) => (j as { '@type': string })['@type']).sort();
      if (h.route === '/') expect(types).toEqual(['WebSite']);
      else if (h.route === '/about' || h.route === '/contact')
        expect(types).toEqual(['Organization']);
      else expect(types, `${h.locale} ${h.route}`).toEqual([]);
    }
    const home = HEADS.find((h) => h.route === '/' && h.locale === 'en')!;
    expect(home.jsonLd[0]).toMatchObject({ url: absoluteUrl('/', 'en'), inLanguage: 'en' });
  });
});

describe('non-indexed pages and invalid URLs', () => {
  const head = () => ({
    robots: document.head.querySelector('meta[name="robots"]')?.getAttribute('content'),
    canonical: document.head.querySelectorAll('link[rel="canonical"]').length,
    alternates: document.head.querySelectorAll('link[rel="alternate"]').length,
  });

  it('keeps sign-in out of search results, with no canonical', async () => {
    renderRoute('/login');
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(head()).toEqual({ robots: 'noindex', canonical: 0, alternates: 0 }));
  });

  it.each([
    ['/does-not-exist', 'th', 'ไม่พบหน้าที่คุณต้องการ'],
    ['/en/does-not-exist', 'en', 'We couldn’t find that page'],
    ['/zh/does-not-exist', 'zh-CN', '找不到您要访问的页面'],
    ['/fr/pricing', 'th', 'ไม่พบหน้าที่คุณต้องการ'],
    ['/en/en/pricing', 'en', 'We couldn’t find that page'],
  ])('renders a localized, noindex 404 for %s', async (path, lang, title) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(title);
    await waitFor(() => expect(head()).toEqual({ robots: 'noindex', canonical: 0, alternates: 0 }));
    expect(document.documentElement.lang).toBe(lang);
    const box = document.querySelector('[data-not-found]')!;
    const prefix = lang === 'en' ? '/en' : lang === 'zh-CN' ? '/zh' : '';
    expect([...box.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      prefix || '/',
      `${prefix}/resources`,
      `${prefix}/contact`,
    ]);
  });

  it.each([
    ['/th/pricing', '/pricing'],
    ['/zh-CN/security', '/zh/security'],
    ['/zh-hans/resources', '/zh/resources'],
    ['/en/login', '/login'],
  ])('redirects %s to %s without a loop', async (from, to) => {
    const { router } = renderRoute(from);
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).toBe(to);
  });

  it('normalizes a trailing slash to the same canonical', async () => {
    renderRoute('/en/pricing/');
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() =>
      expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://core.pdabliss.com/en/pricing',
      ),
    );
  });

  it('switches language on the same page, keeping query and hash', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    renderRoute('/pricing?plan=business#packages');
    await screen.findByRole('heading', { level: 1 });
    await userEvent.click(screen.getByRole('button', { name: /^TH, ภาษา:/ }));
    expect(screen.getByRole('link', { name: /^English/ })).toHaveAttribute(
      'href',
      '/en/pricing?plan=business#packages',
    );
    expect(screen.getByRole('link', { name: /^简体中文/ })).toHaveAttribute(
      'href',
      '/zh/pricing?plan=business#packages',
    );
  });
});

describe('sitemap, robots and the HTML shell', () => {
  const doc = new DOMParser().parseFromString(sitemap, 'application/xml');
  const urls = [...doc.getElementsByTagName('url')];
  const loc = (u: Element) => u.getElementsByTagName('loc')[0]!.textContent!;

  it('is well-formed XML with one entry per route and locale, no duplicates', () => {
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    const locs = urls.map(loc);
    expect(new Set(locs).size).toBe(locs.length);
    const expected = PUBLIC_ROUTES.flatMap((r) => LOCALES.map((l) => absoluteUrl(r, l)));
    expect([...locs].sort()).toEqual([...expected].sort());
  });

  it('declares the same hreflang alternates as the pages themselves', () => {
    for (const u of urls) {
      const route = PUBLIC_ROUTES.find((r) => LOCALES.some((l) => absoluteUrl(r, l) === loc(u)))!;
      const alts = [...u.getElementsByTagName('xhtml:link')].map((l) => ({
        hreflang: l.getAttribute('hreflang')!,
        href: l.getAttribute('href')!,
      }));
      expect(alts, loc(u)).toEqual(alternatesOf(route));
    }
  });

  it('never lists sign-in, the app, the 404 or a non-production host', () => {
    expect(sitemap).not.toMatch(/\/login|\/app\b|\/app\/|localhost|does-not-exist/);
    expect(urls.every((u) => loc(u).startsWith(`${SITE.url}`))).toBe(true);
  });

  it('robots.txt allows the public site, blocks /app/ and names the sitemap', () => {
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Disallow: \/app\/$/m);
    expect(robots).not.toMatch(/^Disallow: \/$/m);
    expect(robots).toContain(`Sitemap: ${SITE.url}/sitemap.xml`);
  });

  it('index.html carries one title and description and no static canonical or localhost', () => {
    expect(indexHtml.match(/<title>/g)).toHaveLength(1);
    expect(indexHtml.match(/name="description"/g)).toHaveLength(1);
    expect(indexHtml).not.toMatch(/rel="canonical"|property="og:url"|localhost/);
    expect(SITE.url).toBe('https://core.pdabliss.com');
  });
});
