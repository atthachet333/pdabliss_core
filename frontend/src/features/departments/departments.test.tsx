import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CONTACT } from '@/config/contact';
import { renderRoute } from '@/test/render';
import { ADJACENT, DEPT_PAGES, type DeptKey } from './catalog';

/*
 * EP06: the department experience — the /departments philosophy page and the
 * six dedicated department pages, in Thai, English and Simplified Chinese.
 */

const LOCALES = [
  { prefix: '', lang: 'th' },
  { prefix: '/en', lang: 'en' },
  { prefix: '/zh', lang: 'zh-CN' },
] as const;

const PATHS = ['/departments', ...DEPT_PAGES.map((d) => `/departments/${d}`)];

const THAI = /[฀-๿][฀-๿\s]{0,30}/g;

/** Visible main text, without inert product previews and the Thai company address. */
function visibleMainText(root: HTMLElement = document.getElementById('main')!) {
  const main = root.cloneNode(true) as HTMLElement;
  main.querySelectorAll('[inert], [aria-hidden="true"]').forEach((n) => n.remove());
  return (main.textContent ?? '').replace(CONTACT.address, '');
}

async function open(path: string) {
  const utils = renderRoute(path);
  const h1 = await screen.findByRole('heading', { level: 1 }, { timeout: 4000 });
  return { h1, ...utils };
}

const original = window.matchMedia;
beforeAll(() => {
  // index.html provides the description tag in the browser.
  if (!document.querySelector('meta[name="description"]')) {
    const meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
  }
});
afterEach(() => {
  window.matchMedia = original;
});

describe('department routes', () => {
  for (const { prefix, lang } of LOCALES) {
    it.each(PATHS)(`${lang}: ${prefix}%s renders exactly one H1 and its locale`, async (path) => {
      await open(`${prefix}${path}`);
      expect(document.querySelectorAll('h1')).toHaveLength(1);
      await waitFor(() => expect(document.documentElement.lang).toBe(lang));
    });
  }

  it('gives every page a unique title, description and H1 in every locale', async () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    const headings = new Set<string>();
    for (const { prefix } of LOCALES) {
      for (const path of PATHS) {
        const { h1, unmount } = await open(`${prefix}${path}`);
        await waitFor(() => expect(document.title).toContain('|'));
        titles.add(document.title);
        descriptions.add(
          document.querySelector('meta[name="description"]')!.getAttribute('content')!,
        );
        headings.add(h1.textContent!);
        unmount();
      }
    }
    const total = LOCALES.length * PATHS.length;
    expect(titles.size).toBe(total);
    expect(descriptions.size).toBe(total);
    expect(headings.size).toBe(total);
  });

  it('does not invent department pages', async () => {
    renderRoute('/departments/marketing');
    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent(/การตลาด/);
    expect(document.querySelector('[data-department]')).toBeNull();
  });
});

describe('department identity', () => {
  const SIGNATURE: Record<DeptKey, RegExp> = {
    executive: /สิ่งที่ต้องจับตา/,
    sales: /คำสั่งซื้อ/,
    operations: /Work Order/,
    warehouse: /FEFO/,
    purchasing: /PO/,
    accounting: /เอกสาร/,
  };

  it.each(DEPT_PAGES)('%s page carries its own identity and content', async (id) => {
    await open(`/departments/${id}`);
    const root = document.querySelector(`[data-department="${id}"]`)!;
    expect(root).not.toBeNull();
    expect(root).toHaveTextContent(SIGNATURE[id]);
    // Work in / do / work out
    expect(root).toHaveTextContent('งานที่เข้ามา');
    expect(root).toHaveTextContent('สิ่งที่ต้องทำ');
    expect(root).toHaveTextContent('สิ่งที่ส่งต่อ');
  });

  it('positions Accounting as operational finance, not a full accounting system', async () => {
    await open('/en/departments/accounting');
    expect(document.getElementById('main')).toHaveTextContent(
      /It is not\s*A full accounting system/i,
    );
  });

  it('keeps Operations general, not manufacturing-only', async () => {
    await open('/en/departments/operations');
    expect(document.getElementById('main')!.textContent).toMatch(/service|install|project/i);
  });
});

describe('Warehouse privacy', () => {
  const MONEY = /฿|บาท|THB|\$|¥|元|ราคา|ต้นทุน|ยอดชำระ|price|cost|payment|价格|成本|付款/i;

  for (const { prefix, lang } of LOCALES) {
    it(`${lang}: shows no price, cost or payment anywhere outside the privacy statement`, async () => {
      await open(`${prefix}/departments/warehouse`);
      // Wait for the lazy product preview: decorative data must obey the rule too.
      await waitFor(() =>
        expect(document.querySelector('[data-department] figure [inert]')).not.toBeNull(),
      );
      const main = document.getElementById('main')!.cloneNode(true) as HTMLElement;
      const statement = main.querySelector('[data-privacy-statement]');
      expect(statement).not.toBeNull();
      statement!.remove();
      expect(main.textContent).not.toMatch(MONEY);
      // Money symbols never appear at all, not even in the statement.
      expect(document.getElementById('main')!.textContent).not.toMatch(/฿|บาท|THB|\$|¥|元/);
    });
  }
});

describe('product preview', () => {
  it.each(DEPT_PAGES)('%s shows its real CORE preview, labelled as Thai product UI', async (id) => {
    await open(`/en/departments/${id}`);
    await waitFor(() =>
      expect(document.querySelector(`[data-department="${id}"] figure [inert]`)).not.toBeNull(),
    );
    const preview = document.querySelector(`[data-department="${id}"] figure [inert]`)!;
    expect(preview.closest('figure')).toHaveTextContent(/Thai/);
  });
});

describe('localization', () => {
  for (const prefix of ['/en', '/zh']) {
    it.each(PATHS)(`${prefix}%s has no Thai in the visible page body`, async (path) => {
      await open(`${prefix}${path}`);
      expect(visibleMainText().match(THAI) ?? []).toEqual([]);
    });
  }

  it('uses Simplified Chinese headings on Chinese pages', async () => {
    const { h1 } = await open('/zh/departments/warehouse');
    expect(h1.textContent).toMatch(/[一-鿿]/);
    // A few Traditional-only characters that must never appear.
    expect(document.getElementById('main')!.textContent).not.toMatch(/[們個發這開時關庫說]/);
  });
});

describe('navigation between departments', () => {
  it('links the six departments from the Product menu to their pages (EP18)', async () => {
    renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'เมนูหลัก' });
    await userEvent.click(within(nav).getByRole('button', { name: 'ผลิตภัณฑ์' }));
    const panel = screen.getByRole('region', { name: 'เมนูผลิตภัณฑ์' });
    const hrefs = within(panel)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    for (const id of DEPT_PAGES) expect(hrefs).toContain(`/departments/${id}`);
  });

  it('keeps the locale in mega-menu department links', async () => {
    renderRoute('/en');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Product' }));
    for (const id of DEPT_PAGES) {
      expect(document.querySelector(`a[href="/en/departments/${id}"]`)).not.toBeNull();
    }
  });

  it.each(DEPT_PAGES)('%s links to its connected departments', async (id) => {
    await open(`/zh/departments/${id}`);
    const main = document.getElementById('main')!;
    for (const next of ADJACENT[id]) {
      expect(main.querySelector(`a[href="/zh/departments/${next}"]`)).not.toBeNull();
    }
    // Quiet CTA: back to the overview and to a consultation about this department (EP13).
    expect(
      main.querySelector(`a[href="/zh/contact?interest=consulting&department=${id}"]`),
    ).not.toBeNull();
    expect(main.querySelector('a[href="/zh/departments"]')).not.toBeNull();
  });

  it('the overview selector is a keyboard-operable tablist', async () => {
    await open('/en/departments');
    const tablist = screen.getAllByRole('tablist')[0]!;
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    tabs[0]!.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(tabs[5]).toHaveAttribute('aria-selected', 'true');
  });

  it('the overview links every department page', async () => {
    await open('/departments');
    const main = document.getElementById('main')!;
    for (const id of DEPT_PAGES) {
      expect(main.querySelector(`a[href="/departments/${id}"]`)).not.toBeNull();
    }
  });
});

describe('reduced motion', () => {
  it('shows finished, static states instead of autoplay', async () => {
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion') || query.includes('min-width'),
    })) as typeof window.matchMedia;
    await open('/en/departments/accounting');
    // The verification sequence starts complete rather than animating toward it.
    expect(document.querySelector('[data-department] figure')).toHaveTextContent('Ready to pay');
  });
});
