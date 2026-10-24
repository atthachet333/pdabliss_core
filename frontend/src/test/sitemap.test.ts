import { describe, expect, it } from 'vitest';
import xml from '../../public/sitemap.xml?raw';
import { LOCALE_PREFIXES, PUBLIC_ROUTES } from './publicRoutes';

/*
 * EP11: the sitemap lists every public route in every locale, each with its
 * hreflang alternates. It must not drift from the permanent route set.
 */

const BASE = 'https://core.pdabliss.com';
const url = (prefix: string, route: string) =>
  route === '/' ? `${BASE}${prefix || '/'}` : `${BASE}${prefix}${route}`;

describe('sitemap.xml', () => {
  it('lists every public route in Thai, English and Chinese', () => {
    for (const route of PUBLIC_ROUTES) {
      for (const prefix of Object.values(LOCALE_PREFIXES)) {
        expect(xml, `${prefix}${route}`).toContain(`<loc>${url(prefix, route)}</loc>`);
      }
    }
    expect(xml.match(/<url>/g)).toHaveLength(PUBLIC_ROUTES.length * 3);
  });

  it('includes the pages added since EP08', () => {
    for (const r of [
      '/how-core-works',
      '/enterprise',
      '/industries',
      '/industries/manufacturing',
    ]) {
      expect(xml).toContain(`<loc>${BASE}${r}</loc>`);
    }
  });

  it('declares hreflang alternates and never lists sign-in or the app', () => {
    expect(xml).toContain('hreflang="zh-CN"');
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).not.toMatch(/\/login|\/app\//);
  });
});
