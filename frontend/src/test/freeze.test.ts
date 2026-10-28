import { describe, expect, it } from 'vitest';
import { FOOTER_GROUPS, MEGA_GROUPS, TOP_NAV } from '@/config/navigation';
import { DEPT_PAGES } from '@/features/departments/catalog';
import { LOCALE_PREFIXES, PUBLIC_ROUTES } from './publicRoutes';

/*
 * EP22 — Public Frontend v1 freeze guards (docs/PUBLIC_FRONTEND_V1_FREEZE.md).
 * Structures that other tests only check for reachability are pinned here, so
 * a change to the frozen information architecture is a deliberate, reviewed
 * edit (owner approval) rather than a side effect. Prices, package rules,
 * contact data, claims, Warehouse privacy, route parity and prerender output
 * already have their own guards.
 */

describe('Public Frontend v1 freeze', () => {
  // EP24.1.4.3 (owner-approved): /consultation split from /contact — 35 → 36.
  it('keeps 36 route families in three locales', () => {
    expect(PUBLIC_ROUTES).toHaveLength(36);
    expect(new Set(PUBLIC_ROUTES).size).toBe(36);
    expect(LOCALE_PREFIXES).toEqual({ th: '', en: '/en', 'zh-CN': '/zh' });
  });

  it('keeps the six department experiences', () => {
    expect([...DEPT_PAGES]).toEqual([
      'executive',
      'sales',
      'operations',
      'warehouse',
      'purchasing',
      'accounting',
    ]);
  });

  it('keeps the header: overview + four menus, and their destinations', () => {
    expect(TOP_NAV.map((i) => i.id)).toEqual([
      'overview',
      'product',
      'solutions',
      'resources',
      'about',
    ]);
    const destinations = Object.fromEntries(
      Object.values(MEGA_GROUPS).map((g) => [g.id, g.items.map((i) => i.to)]),
    );
    expect(destinations).toEqual({
      product: [
        '/how-core-works',
        '/departments',
        '/demo',
        '/pricing',
        ...DEPT_PAGES.map((d) => `/departments/${d}`),
      ],
      solutions: [
        '/solutions',
        '/industries',
        '/enterprise',
        '/industries/distribution',
        '/industries/services',
        '/industries/projects',
        '/industries/retail',
        '/industries/property',
        '/industries/manufacturing',
      ],
      resources: [
        '/resources/getting-started',
        '/resources/how-core-works',
        '/resources/human-error',
        '/resources/warehouse-privacy',
        '/resources/implementation-guide',
        '/resources/security-and-data',
        '/resources/core-glossary',
      ],
      about: ['/about', '/why-core', '/security', '/about#approach'],
    });
  });

  it('keeps the footer a closing summary (Product + Explore), not a sitemap', () => {
    expect(FOOTER_GROUPS.map((g) => [g.id, g.links.map((l) => l.to)])).toEqual([
      ['product', ['/departments', '/how-core-works', '/demo', '/pricing']],
      ['explore', ['/solutions', '/industries', '/enterprise', '/resources', '/about']],
    ]);
  });
});
