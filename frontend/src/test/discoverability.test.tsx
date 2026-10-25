import { screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { FOOTER_GROUPS, MEGA_GROUPS, shellLinkTargets } from '@/config/navigation';
import { DISCOVERY, type Entry } from './discoverability';
import { PUBLIC_ROUTES } from './publicRoutes';
import { renderRoute } from './render';

/*
 * EP17: no silent orphan pages. Every public page is rendered once (Thai), its
 * links are collected by area, and the site is walked from the homepage.
 * Mega-menu links are not rendered until a menu opens, so the navigation
 * config supplies them as links available on every page.
 */

type Area = 'header' | 'main' | 'footer' | 'other';
type Found = { area: Area; href: string; path: string; hash: string };

const KNOWN = new Set<string>([...PUBLIC_ROUTES, '/login']);
const split = (href: string) => {
  const [pathAndQuery = '', hash = ''] = href.split('#');
  return { path: pathAndQuery.split('?')[0] || '/', hash };
};
const areaOf = (a: Element): Area => {
  // A guide's own <header> sits inside <main>; only the site header counts as header.
  if (a.closest('#main')) return 'main';
  if (a.closest('footer')) return 'footer';
  if (a.closest('header')) return 'header';
  return 'other';
};

const LINKS = new Map<string, Found[]>();

beforeAll(async () => {
  for (const route of PUBLIC_ROUTES) {
    const { unmount } = renderRoute(route);
    await screen.findAllByRole('heading', { level: 1 });
    LINKS.set(
      route,
      [...document.querySelectorAll('a[href]')].map((a) => {
        const href = a.getAttribute('href')!;
        return { area: areaOf(a), href, ...split(href) };
      }),
    );
    unmount();
  }
}, 120000);

const megaRoutes = (group: keyof typeof MEGA_GROUPS) => {
  const g = MEGA_GROUPS[group];
  return [...g.items.flatMap((i) => (i.to ? [split(i.to).path] : [])), ...(g.cta ? [g.cta] : [])];
};

function entryExists(route: string, e: Entry): boolean {
  const home = LINKS.get('/')!;
  switch (e.via) {
    case 'mega':
      return megaRoutes(e.group).includes(route);
    case 'header':
      return home.some((l) => l.area === 'header' && l.path === route);
    case 'footer':
      return (
        home.some((l) => l.area === 'footer' && l.path === route) ||
        FOOTER_GROUPS.some((g) => g.links.some((l) => l.to === route))
      );
    case 'page':
      return (LINKS.get(e.from) ?? []).some((l) => l.area === 'main' && l.path === route);
  }
}

describe('route discoverability registry', () => {
  it('has exactly one row for every public route and sign-in', () => {
    expect(DISCOVERY.map((d) => d.route).sort()).toEqual([...KNOWN].sort());
  });

  it('leaves no route marked NEEDS LINK', () => {
    expect(DISCOVERY.filter((d) => d.status === 'NEEDS LINK').map((d) => d.route)).toEqual([]);
  });

  it('declares only entries that really exist in the UI', () => {
    const missing = DISCOVERY.flatMap((d) =>
      [d.primary, d.secondary].flatMap((e) =>
        e && !entryExists(d.route, e) ? [`${d.route} ← ${e.via} ${e.label}`] : [],
      ),
    );
    expect(missing).toEqual([]);
  });
});

describe('site graph', () => {
  it('reaches every public route from the homepage, no deeper than declared', () => {
    const global = shellLinkTargets().map((t) => split(t).path);
    const depth = new Map<string, number>([['/', 0]]);
    const queue = ['/'];
    while (queue.length) {
      const page = queue.shift()!;
      const out = [...(LINKS.get(page) ?? []).map((l) => l.path), ...global];
      for (const next of out) {
        if (!KNOWN.has(next) || depth.has(next)) continue;
        depth.set(next, depth.get(page)! + 1);
        if (LINKS.has(next)) queue.push(next);
      }
    }
    const orphans = [...KNOWN].filter((r) => !depth.has(r));
    expect(orphans, 'unreachable without typing a URL').toEqual([]);
    for (const d of DISCOVERY) expect(depth.get(d.route), d.route).toBeLessThanOrEqual(d.depth);
  });

  it('gives every page more than one way in, or documents why not', () => {
    // Routes with a single entry must say so explicitly (no secondary).
    for (const d of DISCOVERY.filter((x) => !x.secondary)) {
      expect(['/features', '/privacy', '/terms', '/login']).toContain(d.route);
    }
  });
});

describe('internal links', () => {
  it('points every rendered link at a real route, with no placeholder, localhost or double slash', () => {
    const bad: string[] = [];
    for (const [page, links] of LINKS) {
      for (const l of links) {
        if (/^(https?:|mailto:|tel:)/.test(l.href)) {
          if (/localhost|127\.0\.0\.1/.test(l.href)) bad.push(`${page}: ${l.href}`);
          continue;
        }
        if (l.href === '' || l.href === '#' || /^javascript:/i.test(l.href))
          bad.push(`${page}: "${l.href}"`);
        else if (l.href.startsWith('#')) continue;
        else if (l.href.includes('//')) bad.push(`${page}: ${l.href}`);
        else if (!KNOWN.has(l.path)) bad.push(`${page}: ${l.href}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('only links to anchors that exist on their target page', async () => {
    const wanted = new Map<string, Set<string>>();
    const want = (path: string, hash: string) => {
      if (!hash) return;
      if (!wanted.has(path)) wanted.set(path, new Set());
      wanted.get(path)!.add(decodeURIComponent(hash));
    };
    for (const [page, links] of LINKS)
      for (const l of links) {
        if (l.href.startsWith('#')) want(page, l.href.slice(1));
        else if (KNOWN.has(l.path)) want(l.path, l.hash);
      }
    for (const t of shellLinkTargets()) want(split(t).path, split(t).hash);
    // The skip link targets the shell's <main id="main">.
    for (const set of wanted.values()) set.delete('main');

    const missing: string[] = [];
    for (const [path, hashes] of wanted) {
      if (!hashes.size) continue;
      const { unmount } = renderRoute(path);
      await screen.findAllByRole('heading', { level: 1 });
      for (const h of hashes) {
        await waitFor(() => expect(document.getElementById(h)).not.toBeNull()).catch(() =>
          missing.push(`${path}#${h}`),
        );
      }
      unmount();
    }
    // The walk really covered the contextual anchors (EP08 / EP09 / EP10 / EP16 chapters).
    const checked = [...wanted.values()].reduce((n, set) => n + set.size, 0);
    expect(checked).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  }, 120000);
});
