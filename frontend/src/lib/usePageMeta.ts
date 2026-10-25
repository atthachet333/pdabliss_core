import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useLocale } from '@/i18n/useLocale';
import { basePath, headFor } from './seo';

/** Marks the head elements this hook owns, so a page change replaces them cleanly. */
const OWNED = 'data-page-meta';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.setAttribute('content', content);
}

function addOwned(tag: 'link' | 'meta', attrs: Record<string, string>) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.setAttribute(OWNED, '');
  document.head.append(el);
}

export interface PageMetaOptions {
  /**
   * `false` keeps the page out of search results (`noindex`) and omits its
   * canonical and hreflang alternates — for sign-in and the 404 page.
   */
  index?: boolean;
}

/**
 * The route-aware metadata hook for public pages (EP17). Pass localized
 * strings; the head itself comes from `headFor` in lib/seo.ts — the same
 * function the build-time prerender serializes into every route's HTML:
 * - `<title>` (`Title | PDA BLISS CORE`) and the meta description
 * - the canonical URL on the production origin, in the page's own locale
 * - hreflang alternates for th / en / zh-CN plus x-default (Thai)
 * - Open Graph title, description, URL and locale (+ alternate locales)
 * - `robots: noindex` when `index` is false
 */
export function usePageMeta(
  title: string | null,
  description?: string,
  { index = true }: PageMetaOptions = {},
) {
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const path = basePath(pathname);

  useEffect(() => {
    const h = headFor({ path, locale, title, description, index });
    document.title = h.title;
    upsertMeta('name', 'description', h.description);
    upsertMeta('property', 'og:title', h.title);
    upsertMeta('property', 'og:description', h.description);
    upsertMeta('property', 'og:locale', h.ogLocale);
    for (const l of h.ogLocaleAlternates)
      addOwned('meta', { property: 'og:locale:alternate', content: l });
    if (h.canonical) {
      addOwned('link', { rel: 'canonical', href: h.canonical });
      for (const a of h.alternates)
        addOwned('link', { rel: 'alternate', hreflang: a.hreflang, href: a.href });
      upsertMeta('property', 'og:url', h.canonical);
    } else {
      addOwned('meta', { name: 'robots', content: 'noindex' });
      document.head.querySelector('meta[property="og:url"]')?.remove();
    }
    return () => {
      for (const el of document.head.querySelectorAll(`[${OWNED}]`)) el.remove();
    };
  }, [title, description, locale, path, index]);
}
