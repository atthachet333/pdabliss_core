import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SOLUTIONS } from '@/features/solutions/model';
import { CLAIMS, LOCALES, strings, THAI, TRADITIONAL } from '@/test/claims';
import { LOCALE_PREFIXES, PUBLIC_ROUTES } from '@/test/publicRoutes';
import { renderRoute } from '@/test/render';
import { ARTICLE_COPY } from './article/copy';
import { RESOURCES_COPY } from './copy';
import { GLOSSARY, TERMS, termAnchor } from './glossary';
import { GETTING_STARTED } from './guides/gettingStarted.copy';
import { GLOSSARY_PAGE } from './guides/glossaryPage.copy';
import { HOW_CORE_WORKS_GUIDE } from './guides/howCoreWorks.copy';
import { HUMAN_ERROR_GUIDE, PRINCIPLES } from './guides/humanError.copy';
import { CHECKLIST, IMPLEMENTATION_GUIDE } from './guides/implementation.copy';
import { SECURITY_AND_DATA_GUIDE } from './guides/securityAndData.copy';
import { CLEARANCE, WAREHOUSE_PRIVACY_GUIDE } from './guides/warehousePrivacy.copy';
import { JOURNEY_NAMES } from './journey';
import { RESOURCE_META } from './meta';
import {
  DEPARTMENT_READING,
  PROBLEM_GUIDE,
  RESOURCE_IDS,
  RESOURCES,
  RESOURCES_HOME,
  resourcePath,
  START_PATHS,
  STAGES,
  type ResourceId,
} from './registry';
import { normalize, searchResources } from './search';

/*
 * EP16: the Resource Center and its seven guides. The registry, search and
 * copy are tested directly; routes, glossary, filters and the checklist as
 * rendered. Claim safety reuses the shared EP15 scanner (src/test/claims.ts).
 */

beforeAll(() => {
  for (const [attr, name] of [
    ['name', 'description'],
    ['property', 'og:title'],
    ['property', 'og:description'],
  ] as const) {
    if (!document.querySelector(`meta[${attr}="${name}"]`)) {
      const meta = document.createElement('meta');
      meta.setAttribute(attr, name);
      document.head.append(meta);
    }
  }
});
afterEach(() => vi.restoreAllMocks());

const RESOURCE_ROUTES = [RESOURCES_HOME, ...RESOURCES.map((r) => resourcePath(r.id))];
const PREFIX = LOCALE_PREFIXES;

/** Every word module of the Resource Center. */
const COPY = {
  RESOURCES_COPY,
  RESOURCE_META,
  GLOSSARY,
  GLOSSARY_PAGE,
  JOURNEY_NAMES,
  ARTICLE_COPY,
  GETTING_STARTED,
  HOW_CORE_WORKS_GUIDE,
  HUMAN_ERROR_GUIDE,
  WAREHOUSE_PRIVACY_GUIDE,
  IMPLEMENTATION_GUIDE,
  SECURITY_AND_DATA_GUIDE,
} as const;

const description = () =>
  document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';

async function page(path: string) {
  const utils = renderRoute(path);
  const h1 = await screen.findByRole('heading', { level: 1 });
  return { ...utils, h1 };
}

describe('registry', () => {
  it('publishes seven guides with unique slugs and real "read next" links', () => {
    expect(RESOURCES.map((r) => r.id)).toEqual([...RESOURCE_IDS]);
    expect(new Set(RESOURCES.map((r) => r.slug)).size).toBe(7);
    for (const r of RESOURCES) {
      expect(r.status).toBe('published');
      expect(r.next.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.next.length, r.id).toBeLessThanOrEqual(3);
      expect(r.next, r.id).not.toContain(r.id);
      for (const n of r.next) expect(RESOURCE_IDS).toContain(n);
    }
  });

  it('lists every resource route in the shared public route set (and so the sitemap)', () => {
    for (const route of RESOURCE_ROUTES) expect(PUBLIC_ROUTES).toContain(route);
  });

  it('points every guided entry at a published guide', () => {
    const all = [
      ...Object.values(START_PATHS).flat(),
      ...Object.values(PROBLEM_GUIDE),
      ...Object.values(DEPARTMENT_READING).flat(),
      ...Object.values(STAGES).flat(),
    ];
    for (const id of all) expect(RESOURCE_IDS).toContain(id);
    // Problems are exactly the EP09 problems, by id.
    const solutionIds = SOLUTIONS.map((s) => s.id) as string[];
    for (const p of Object.keys(PROBLEM_GUIDE)) expect(solutionIds).toContain(p);
  });

  it('keeps reading-time estimates honest against the English copy', () => {
    const words: Record<ResourceId, string[]> = {
      gettingStarted: strings(GETTING_STARTED.en),
      howCoreWorks: strings(HOW_CORE_WORKS_GUIDE.en),
      humanError: strings(HUMAN_ERROR_GUIDE.en),
      warehousePrivacy: strings(WAREHOUSE_PRIVACY_GUIDE.en),
      implementationGuide: strings(IMPLEMENTATION_GUIDE.en),
      securityAndData: strings(SECURITY_AND_DATA_GUIDE.en),
      coreGlossary: [...strings(GLOSSARY.en), ...strings(GLOSSARY_PAGE.en)],
    };
    // Between a brisk 260 and a careful 120 words a minute.
    const off = RESOURCES.flatMap((r) => {
      const n = words[r.id].join(' ').split(/\s+/).length;
      const ok = r.readingMinutes >= Math.floor(n / 260) && r.readingMinutes <= Math.ceil(n / 120);
      return ok ? [] : [`${r.id}: ${r.readingMinutes} min for ${n} words`];
    });
    expect(off).toEqual([]);
  });
});

describe('routes and metadata', () => {
  it.each(Object.entries(PREFIX))(
    'renders every resource route in %s with one H1',
    async (_, prefix) => {
      for (const route of RESOURCE_ROUTES) {
        const { h1, unmount } = await page(`${prefix}${route}`);
        expect(screen.getAllByRole('heading', { level: 1 }), route).toHaveLength(1);
        expect(h1.textContent!.length).toBeGreaterThan(4);
        unmount();
      }
    },
    60000,
  );

  it('gives every route a unique title and description in every locale', async () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const prefix of Object.values(PREFIX)) {
      for (const route of RESOURCE_ROUTES) {
        const { unmount } = await page(`${prefix}${route}`);
        await waitFor(() => expect(document.title).toContain('PDA BLISS CORE'));
        const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
        expect(og, route).toBe(document.title);
        titles.add(document.title);
        descriptions.add(description());
        unmount();
      }
    }
    expect(titles.size).toBe(RESOURCE_ROUTES.length * 3);
    expect(descriptions.size).toBe(RESOURCE_ROUTES.length * 3);
  }, 60000);

  it('renders guides as articles with an ordered heading outline, no author and no date', async () => {
    for (const r of RESOURCES) {
      const { unmount } = await page(resourcePath(r.id));
      const article = document.querySelector(`article[data-resource="${r.id}"]`)!;
      expect(article, r.id).not.toBeNull();
      let last = 1;
      for (const h of article.querySelectorAll('h1, h2, h3, h4')) {
        const level = Number(h.tagName[1]);
        expect(level, `${r.id}: ${h.textContent}`).toBeLessThanOrEqual(last + 1);
        last = level;
      }
      expect(article.querySelector('time, [rel="author"]')).toBeNull();
      expect(document.querySelector('script[type="application/ld+json"][data-article]')).toBeNull();
      unmount();
    }
  }, 60000);
});

describe('links', () => {
  /** Strip the locale prefix, query and hash from an internal href. */
  const split = (href: string, prefix: string) => {
    const rest = prefix && href.startsWith(prefix) ? href.slice(prefix.length) || '/' : href;
    const [pathAndQuery, hash] = rest.split('#');
    return { path: pathAndQuery!.split('?')[0]!, hash };
  };

  it('resolves every internal link and keeps the locale', async () => {
    const anchors = new Map<string, Set<string>>();
    for (const [locale, prefix] of Object.entries(PREFIX)) {
      for (const route of RESOURCE_ROUTES) {
        const { unmount } = await page(`${prefix}${route}`);
        const main = document.getElementById('main')!;
        for (const a of main.querySelectorAll<HTMLAnchorElement>('a[href]')) {
          const href = a.getAttribute('href')!;
          if (/^(https?:|mailto:|tel:)/.test(href)) continue;
          if (href.startsWith('#')) {
            // In-page anchors (glossary letters) must exist on the page itself.
            expect(document.getElementById(href.slice(1)), `${route} ${href}`).not.toBeNull();
            continue;
          }
          if (prefix) expect(href, `${locale} ${route}`).toMatch(new RegExp(`^${prefix}(/|$)`));
          const { path, hash } = split(href, prefix);
          expect(PUBLIC_ROUTES as readonly string[], `${route} → ${href}`).toContain(path);
          if (hash) {
            if (!anchors.has(path)) anchors.set(path, new Set());
            anchors.get(path)!.add(hash);
          }
        }
        unmount();
      }
    }
    // Every anchor exists on its target page.
    expect(anchors.size).toBeGreaterThan(3);
    for (const [path, hashes] of anchors) {
      const { unmount } = await page(path);
      for (const hash of hashes) {
        await waitFor(() =>
          expect(document.getElementById(hash), `${path}#${hash}`).not.toBeNull(),
        );
      }
      unmount();
    }
  }, 120000);

  it('ends every guide with read-next guides, related site pages and one CTA', async () => {
    for (const r of RESOURCES) {
      const { unmount } = await page(`/en${resourcePath(r.id)}`);
      const next = document.querySelector('[data-next]')!;
      expect(next.querySelectorAll('[data-resource-link]')).toHaveLength(r.next.length);
      for (const n of r.next) {
        expect(next.querySelector(`[data-resource-link="${n}"]`)).toHaveAttribute(
          'href',
          `/en${resourcePath(n)}`,
        );
      }
      const related = [...document.querySelectorAll('[data-related-link]')].map((el) =>
        el.getAttribute('href'),
      );
      expect(related.length).toBeGreaterThanOrEqual(2);
      // Each destination once.
      expect(new Set(related).size, r.id).toBe(related.length);
      expect(document.querySelectorAll('[data-resource-cta] [data-cta]').length).toBeGreaterThan(0);
      unmount();
    }
  }, 60000);
});

describe('search', () => {
  const run = (q: string, l: (typeof LOCALES)[number]) =>
    searchResources(q, RESOURCE_META[l], GLOSSARY[l]);
  const ids = (q: string, l: (typeof LOCALES)[number]) =>
    run(q, l).flatMap((r) => (r.kind === 'resource' ? [r.id] : []));

  it('matches titles in Thai, English and Chinese', () => {
    expect(run('คลังสินค้าไม่เห็นราคา', 'th')[0]).toMatchObject({
      kind: 'resource',
      id: 'warehousePrivacy',
      field: 'title',
    });
    expect(run('glossary', 'en')[0]).toMatchObject({ id: 'coreGlossary', field: 'title' });
    expect(run('实施指南', 'zh-CN')[0]).toMatchObject({
      id: 'implementationGuide',
      field: 'title',
    });
  });

  it('matches tags, terms and categories', () => {
    expect(ids('วันหมดอายุ', 'th')).toEqual(
      expect.arrayContaining(['humanError', 'warehousePrivacy']),
    );
    expect(run('Expiry', 'en').find((r) => r.kind === 'resource')).toMatchObject({ field: 'tag' });
    expect(ids('批次', 'zh-CN')).toContain('warehousePrivacy');
    expect(ids('Security & Data', 'en')).toContain('securityAndData');
    expect(ids('仓库与库存', 'zh-CN')).toContain('warehousePrivacy');
    expect(run('FEFO', 'en').some((r) => r.kind === 'term' && r.id === 'fefo')).toBe(true);
  });

  it('normalizes width, case, spacing and invisible characters', () => {
    expect(normalize('  ＬＯＴ​  b ')).toBe('lot b');
    expect(ids('ＬＯＴ', 'en')).toEqual(ids('lot', 'en'));
    expect(ids('  handoff  ', 'en')).toEqual(ids('Handoff', 'en'));
    expect(ids('hand​off', 'en')).toEqual(ids('handoff', 'en'));
  });

  it('returns nothing for an empty or unknown query', () => {
    expect(run('   ', 'th')).toEqual([]);
    for (const l of LOCALES) expect(run('xyzzyqq', l)).toEqual([]);
  });

  it('searches instantly from the keyboard, explains matches and offers suggestions', async () => {
    renderRoute('/resources');
    const input = await screen.findByRole('searchbox', { name: 'ค้นหาในคลังความรู้' });
    await userEvent.click(input);
    await userEvent.keyboard('Lot');
    await waitFor(() => expect(document.querySelector('[data-search-results]')).not.toBeNull());
    expect(screen.getByText(/ผลลัพธ์สำหรับ “Lot”/)).toBeInTheDocument();
    // Tab: the clear button, then the first result.
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'ล้างคำค้น' })).toHaveFocus();
    await userEvent.tab();
    expect(document.activeElement?.closest('[data-search-results]')).not.toBeNull();
    // Escape clears.
    input.focus();
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(document.querySelector('[data-search-results]')).toBeNull();

    await userEvent.type(input, 'xyzzyqq');
    expect(await screen.findByText('ไม่พบผลลัพธ์สำหรับ “xyzzyqq”')).toBeInTheDocument();
    const empty = document.querySelector<HTMLElement>('[data-search-empty]')!;
    await userEvent.click(within(empty).getByRole('button', { name: 'วันหมดอายุ' }));
    expect(input).toHaveValue('วันหมดอายุ');
    await waitFor(() =>
      expect(
        document.querySelector('[data-search-results] [data-resource="humanError"]'),
      ).not.toBeNull(),
    );
  });

  it('searches in English and Chinese on their own routes, with localized links', async () => {
    renderRoute('/en/resources');
    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Search the library' }),
      'trace',
    );
    await waitFor(() => expect(document.querySelector('[data-search-results]')).not.toBeNull());
    for (const a of document.querySelectorAll('[data-search-results] a'))
      expect(a.getAttribute('href')).toMatch(/^\/en\/resources\//);
  });

  it('searches Chinese on /zh', async () => {
    renderRoute('/zh/resources');
    await userEvent.type(await screen.findByRole('searchbox'), '交接');
    await waitFor(() =>
      expect(
        document.querySelector('[data-search-results] [data-resource="howCoreWorks"]'),
      ).not.toBeNull(),
    );
    for (const a of document.querySelectorAll('[data-search-results] a'))
      expect(a.getAttribute('href')).toMatch(/^\/zh\/resources\//);
  });
});

describe('library filters', () => {
  it('filters the library by category, with arrow keys and a non-colour selected mark', async () => {
    renderRoute('/resources');
    const group = await screen.findByRole('radiogroup', { name: 'กรองตามหมวด' });
    const items = () =>
      [...document.querySelectorAll('[data-library-item]')].map((el) =>
        el.getAttribute('data-library-item'),
      );
    expect(items()).toHaveLength(7);
    await userEvent.click(within(group).getByRole('radio', { name: /คลังสินค้า/ }));
    expect(items()).toEqual(['warehousePrivacy']);
    expect(screen.getByText('1 คู่มือ')).toBeInTheDocument();
    const checked = within(group).getByRole('radio', { checked: true });
    expect(checked.querySelector('svg')).not.toBeNull();
    // One tab stop; arrows move the selection.
    expect(
      within(group)
        .getAllByRole('radio')
        .filter((r) => r.tabIndex === 0),
    ).toHaveLength(1);
    checked.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(within(group).getByRole('radio', { checked: true })).toHaveFocus();
    expect(items()).toEqual(['implementationGuide']);
    await userEvent.keyboard('{Home}');
    expect(items()).toHaveLength(7);
    // "Start" holds the glossary too.
    await userEvent.click(within(group).getByRole('radio', { name: /เริ่มต้น/ }));
    expect(items()).toEqual(['gettingStarted', 'coreGlossary']);
  });

  it('switches department reading lists from the keyboard', async () => {
    renderRoute('/resources');
    const group = await screen.findByRole('radiogroup', { name: 'เลือกแผนก' });
    const checked = within(group).getByRole('radio', { checked: true });
    expect(checked).toHaveAttribute('data-dept', 'warehouse');
    checked.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.querySelector('[data-dept-reading]')).toHaveAttribute(
      'data-dept-reading',
      'purchasing',
    );
  });

  it('lets long department names wrap on narrow phones', async () => {
    // EP18.1 QA: "Accounting & Finance" overflowed 320 px when nowrap won over the override.
    renderRoute('/en/resources');
    const group = await screen.findByRole('radiogroup', { name: 'Choose a department' });
    for (const chip of within(group).getAllByRole('radio')) {
      expect(chip.className).toMatch(/\bwhitespace-normal\b/);
      expect(chip.className).not.toMatch(/\bwhitespace-nowrap\b/);
    }
  });
});

describe('glossary', () => {
  const terms = () =>
    [...document.querySelectorAll('[data-glossary] [data-term]')].map((el) =>
      el.getAttribute('data-term'),
    );

  it('defines every term with a definition and a "where explained" link, in every locale', async () => {
    for (const [l, prefix] of Object.entries(PREFIX) as [keyof typeof PREFIX, string][]) {
      const { unmount } = await page(`${prefix}/resources/core-glossary`);
      expect(terms()).toHaveLength(TERMS.length);
      for (const t of TERMS) {
        const row = document.getElementById(termAnchor(t.id))!;
        expect(row, t.id).not.toBeNull();
        expect(row).toHaveTextContent(GLOSSARY[l].terms[t.id].definition);
        expect(row.querySelector('[data-term-see]')).toHaveAttribute(
          'href',
          `${prefix}${resourcePath(t.see)}`,
        );
      }
      unmount();
    }
  }, 30000);

  it('gives most terms an example', () => {
    for (const l of LOCALES) {
      const withExample = TERMS.filter((t) => GLOSSARY[l].terms[t.id].example);
      expect(withExample.length, l).toBeGreaterThanOrEqual(Math.ceil(TERMS.length * 0.6));
      // The same terms carry examples in every language.
      expect(withExample.map((t) => t.id)).toEqual(
        TERMS.filter((t) => GLOSSARY.th.terms[t.id].example).map((t) => t.id),
      );
    }
  });

  it('searches in memory, filters by category and keeps the A–Z index in sync', async () => {
    await page('/resources/core-glossary');
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'fefo');
    expect(terms()).toEqual(['fefo']);
    const index = screen.getByRole('navigation', { name: GLOSSARY_PAGE.th.index });
    expect(
      within(index)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['F']);
    await userEvent.clear(input);
    await userEvent.type(input, 'ไม่มีคำนี้');
    expect(terms()).toEqual([]);
    expect(screen.getByText(/ไม่มีคำนี้/)).toBeInTheDocument();
    await userEvent.clear(input);

    const group = screen.getByRole('radiogroup', { name: GLOSSARY_PAGE.th.categories });
    await userEvent.click(
      within(group).getByRole('radio', { name: GLOSSARY.th.categories.warehouse }),
    );
    const shown = [...document.querySelectorAll('[data-glossary] [data-term]')];
    expect(shown.length).toBeGreaterThan(1);
    for (const el of shown) expect(el).toHaveAttribute('data-term-category', 'warehouse');
  });

  it('searches Chinese and English term names', async () => {
    const { unmount } = await page('/zh/resources/core-glossary');
    await userEvent.type(screen.getByRole('searchbox'), '交接');
    expect(terms()).toContain('handoff');
    unmount();
    await page('/en/resources/core-glossary');
    await userEvent.type(screen.getByRole('searchbox'), 'Information Boundary');
    expect(terms()).toEqual(['informationBoundary']);
  });
});

describe('implementation checklist', () => {
  it('works in memory with reset, and never stores or sends anything', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await page('/resources/implementation-guide');
    const list = document.querySelector<HTMLElement>('[data-checklist]')!;
    const boxes = within(list).getAllByRole('checkbox');
    expect(boxes).toHaveLength(CHECKLIST.length);
    expect(screen.getByText(`เตรียมแล้ว 0 จาก ${CHECKLIST.length}`)).toBeInTheDocument();

    await userEvent.click(boxes[0]!);
    boxes[1]!.focus();
    await userEvent.keyboard(' ');
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).toBeChecked();
    expect(screen.getByText(`เตรียมแล้ว 2 จาก ${CHECKLIST.length}`)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'ล้างรายการ' }));
    expect(boxes[0]).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'ล้างรายการ' })).toBeNull();

    const section = document.getElementById('checklist')!;
    expect(section.querySelector('form, [type="submit"]')).toBeNull();
    expect(setItem.mock.calls.filter(([k]) => !String(k).includes('consent'))).toEqual([]);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCalls);
  });

  it('does not claim to save or submit', () => {
    for (const l of LOCALES) {
      const c = IMPLEMENTATION_GUIDE[l].checklist;
      expect(c.p).toMatch(/ไม่มีการบันทึกหรือส่ง|nothing is saved or sent|不会保存或发送/);
    }
  });
});

describe('language', () => {
  it.each(Object.entries(COPY))('%s: English and Chinese carry no Thai', (_, copy) => {
    for (const l of ['en', 'zh-CN'] as const)
      for (const s of strings(copy[l])) expect(s, `${l}: ${s}`).not.toMatch(THAI);
  });

  it.each(Object.entries(COPY))(
    '%s: Chinese is Simplified and not a copy of English',
    (_, copy) => {
      const zh = strings(copy['zh-CN']);
      for (const s of zh) expect(s).not.toMatch(TRADITIONAL);
      const en = new Set(strings(copy.en));
      const cjk = zh.filter((s) => /[一-鿿]/.test(s));
      // Brand words, ids and codes may repeat; real sentences may not.
      expect(cjk.length / zh.length).toBeGreaterThan(0.7);
      // Section eyebrows ("03 · Learn by problem") are English by design in every locale.
      expect(zh.filter((s) => s.length > 20 && en.has(s) && !/^\d{2} · /.test(s))).toEqual([]);
    },
  );

  it('renders English and Chinese guides without Thai text', async () => {
    for (const prefix of ['/en', '/zh']) {
      for (const route of RESOURCE_ROUTES) {
        const { unmount } = await page(`${prefix}${route}`);
        expect(document.getElementById('main')!.textContent, `${prefix}${route}`).not.toMatch(THAI);
        unmount();
      }
    }
  }, 60000);
});

describe('claim safety', () => {
  it.each(Object.entries(COPY))('%s makes no unsupported claim in any language', (_, copy) => {
    for (const l of LOCALES)
      for (const s of strings(copy[l])) for (const re of CLAIMS) expect(s, s).not.toMatch(re);
  });

  it('never promises zero errors, guaranteed prevention or detection', () => {
    const ABSOLUTE =
      /zero (errors?|mistakes?)|error-free|eliminat|prevents? all|catch(es)? every|never (miss|fail)|ไม่มีข้อผิดพลาด|ผิดพลาดเป็นศูนย์|ป้องกันได้ทั้งหมด|ขจัด|零差错|零错误|杜绝|消除所有|完全避免/i;
    for (const copy of [
      HUMAN_ERROR_GUIDE,
      GETTING_STARTED,
      RESOURCE_META,
      GLOSSARY,
      RESOURCES_COPY,
    ])
      for (const l of LOCALES) for (const s of strings(copy[l])) expect(s, s).not.toMatch(ABSOLUTE);
    // The guide names its limits and uses the five principles by name.
    for (const l of LOCALES) {
      const c = HUMAN_ERROR_GUIDE[l];
      expect(Object.keys(c.principles)).toEqual([...PRINCIPLES]);
      expect(JSON.stringify(c)).toMatch(/ขีดจำกัด|limit|局限/i);
    }
  });

  it('keeps Accounting as operational finance, never a ledger or tax system', () => {
    const LEDGER = /ledger|journal|\btax\b|สมุดบัญชี|ภาษี|总账|记账|税/i;
    const NOT = /\bnot\b|ไม่ใช่|不是/i;
    for (const l of LOCALES) {
      const notList = new Set(strings(GETTING_STARTED[l].not.isNotItems));
      for (const copy of Object.values(COPY))
        for (const s of strings(copy[l]))
          if (LEDGER.test(s)) expect(NOT.test(s) || notList.has(s), s).toBe(true);
    }
  });

  it('keeps Security & Data educational: it says what is not claimed, and asks questions', () => {
    for (const l of LOCALES) {
      const c = SECURITY_AND_DATA_GUIDE[l];
      expect(c.claims.items.length).toBeGreaterThanOrEqual(4);
      expect(c.ask.items.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('warehouse privacy', () => {
  // A currency mark beside a number, or a money-formatted number ("บาท" alone also ends "บทบาท").
  const MONEY_VALUE =
    /[฿$€¥]\s?\d|\d\s?(บาท|THB|USD|元|泰铢)|\b(THB|USD)\b|\d{1,3}(,\d{3})+|\d+\.\d{2}\b/;
  const MONEY_WORD =
    /ราคา|ต้นทุน|มาร์จิ้น|กำไร|ยอดจ่าย|เงื่อนไขการเงิน|price|cost|margin|payment|amount|terms|价格|成本|毛利|付款|金额|条款/i;

  it('explains the principle without a single financial value, in any locale', () => {
    for (const l of LOCALES)
      for (const s of strings(WAREHOUSE_PRIVACY_GUIDE[l])) expect(s, s).not.toMatch(MONEY_VALUE);
  });

  it('shows a warehouse view made only of operational fields', () => {
    for (const l of LOCALES) {
      const fields = WAREHOUSE_PRIVACY_GUIDE[l].sees.fields;
      expect(fields.length).toBeGreaterThanOrEqual(5);
      for (const f of fields) expect(`${f.label} ${f.value}`, f.label).not.toMatch(MONEY_WORD);
      expect(WAREHOUSE_PRIVACY_GUIDE[l].compare.notItems.length).toBe(5);
    }
  });

  it('mirrors the backend clearance model: Warehouse receives operational data only', () => {
    // backend/src/domain/access/data-classification.ts — WORKSPACE_DATA_CLEARANCE.
    const BACKEND = {
      warehouse: ['operational'],
      sales: ['operational', 'commercial'],
      purchasing: ['operational', 'commercial'],
      accounting: ['operational', 'commercial', 'financial'],
      executive: ['operational', 'commercial', 'financial'],
    };
    for (const { view, classes } of CLEARANCE) expect([...classes], view).toEqual(BACKEND[view]);
  });

  it('renders the warehouse view with no financial value in every locale', async () => {
    for (const prefix of Object.values(PREFIX)) {
      const { unmount } = await page(`${prefix}/resources/warehouse-privacy`);
      expect(document.getElementById('main')!.textContent).not.toMatch(MONEY_VALUE);
      unmount();
    }
  }, 30000);
});
