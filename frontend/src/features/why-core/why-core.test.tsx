import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CONTACT } from '@/config/contact';
import { GUARDS } from '@/features/about/model';
import { renderRoute } from '@/test/render';
import { WHY_CORE } from './copy';
import { EXCESS, GROWTH, MODULES, NOT_NEEDED, SIGNALS, VIEWERS, WHY_CHAPTER } from './model';

/*
 * EP12: /why-core — why this specific product exists. The model and copy are
 * tested directly; the page as rendered, in every locale.
 */

const original = window.matchMedia;
beforeAll(() => {
  if (!document.querySelector('meta[name="description"]')) {
    const meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
  }
});
afterEach(() => {
  window.matchMedia = original;
});

const LOCALES = ['th', 'en', 'zh-CN'] as const;
const THAI = /[฀-฾เ-๿]/;
const TRADITIONAL = /[們個發這開時關庫說價購資費號門運營權證統線際體與變]/;
// Pricing words — the Warehouse's own views must never carry them.
const MONEY =
  /฿|บาท|THB|\$|¥|元|ราคา|ต้นทุน|มูลค่า|เงิน|price|cost|amount|价格|成本|金额|付款|财务/i;
const CLAIMS =
  /\bISO\b|certified|guarantee(?!s? that mistakes)|\d+\s?%|ROI|ได้รับการรับรอง|已认证|ลูกค้าของเรา|our customers|我们的客户/i;

async function open(path = '/why-core') {
  const utils = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return utils;
}
const section = (id: string) => document.getElementById(id)!;
const main = () => document.getElementById('main')!;
const allStrings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(allStrings)
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(allStrings)
        : [];
function visibleText() {
  const m = main().cloneNode(true) as HTMLElement;
  m.querySelectorAll('[inert], [aria-hidden="true"]').forEach((n) => n.remove());
  return m.textContent ?? '';
}

/* ------------------------------------------------------------------ */

describe('why-core model and copy', () => {
  it('names six growth stages, six viewers and five executive signals', () => {
    expect(GROWTH).toEqual([
      'roles',
      'departments',
      'handoffs',
      'approvals',
      'systems',
      'visibility',
    ]);
    expect(VIEWERS).toEqual([
      'sales',
      'warehouse',
      'operations',
      'purchasing',
      'accounting',
      'executive',
    ]);
    expect(SIGNALS).toEqual(['bottlenecks', 'exceptions', 'waiting', 'risk', 'health']);
  });

  it('shows the Warehouse pricing in ONE LARGE SYSTEM — the thing CORE never sends it', () => {
    expect(EXCESS.warehouse).toBe('pricing');
    for (const v of VIEWERS) expect(MODULES).toContain(EXCESS[v]);
  });

  it('keeps every Warehouse view in CORE free of pricing, in every locale', () => {
    for (const l of LOCALES) {
      const c = WHY_CORE[l];
      for (const s of [
        ...c.shift.needs.warehouse,
        c.connected.views.warehouse,
        c.nextAction.task,
        c.nextAction.meta,
      ]) {
        expect(s, `${l}: ${s}`).not.toMatch(MONEY);
      }
    }
  });

  it('gives every locale the same complete copy, without claims', () => {
    for (const l of LOCALES) {
      const c = WHY_CORE[l];
      expect(Object.keys(c.origin.stages)).toEqual([...GROWTH]);
      expect(Object.keys(c.shift.needs)).toEqual([...VIEWERS]);
      expect(Object.keys(c.shift.modules)).toEqual([...MODULES]);
      expect(Object.keys(c.departments.lines)).toEqual([...NOT_NEEDED]);
      expect(Object.keys(c.connected.views)).toEqual([...VIEWERS]);
      expect(Object.keys(c.humanError.guards)).toEqual(GUARDS.map((g) => g.id));
      expect(Object.keys(c.executive.signals)).toEqual([...SIGNALS]);
      for (const s of allStrings(c)) expect(s, `${l}: ${s}`).not.toMatch(CLAIMS);
    }
    for (const s of allStrings(WHY_CORE['zh-CN'])) expect(s).not.toMatch(TRADITIONAL);
    for (const s of allStrings(WHY_CORE.en)) expect(s).not.toMatch(THAI);
  });
});

/* ------------------------------------------------------------------ */

describe('/why-core page', () => {
  it('opens on why CORE exists — work stuck between departments', async () => {
    await open();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('เราไม่ได้สร้าง CORE');
    expect(h1).toHaveTextContent('Software อีกหนึ่งตัว');
    expect(h1).toHaveTextContent('งานจริงมักติดอยู่ระหว่างแผนก');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const visual = screen.getByRole('figure', { name: /เกาะแยกกัน/ });
    expect(visual.querySelectorAll('[data-island]')).toHaveLength(6);
    expect(visual.querySelector('[data-core-layer]')).not.toBeNull();
  });

  it('tells the story in order, with every chapter labelled', async () => {
    await open();
    const ids = Object.values(WHY_CHAPTER);
    const found = [...main().querySelectorAll('section[id]')]
      .map((s) => s.id)
      .filter((id) => (ids as string[]).includes(id));
    expect(found).toEqual(ids);
    for (const id of ids) {
      expect(
        document.getElementById(section(id).getAttribute('aria-labelledby')!),
        id,
      ).not.toBeNull();
    }
  });

  it('tells the origin through organizational growth, without anecdotes', async () => {
    await open();
    const origin = section(WHY_CHAPTER.origin);
    expect(
      [...origin.querySelectorAll('[data-growth-stage]')].map((s) =>
        s.getAttribute('data-growth-stage'),
      ),
    ).toEqual([...GROWTH]);
    expect(origin).toHaveTextContent('การมองเห็นลดลง');
    expect(origin).toHaveTextContent('ไม่ให้งานหายไปในช่องว่างระหว่างโครงสร้าง');
  });

  it('turns ONE LARGE SYSTEM into CORE for whoever is viewing', async () => {
    await open();
    const shift = section(WHY_CHAPTER.shift);
    const group = within(shift).getByRole('group', { name: 'ดูจากมุมของ' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons).toHaveLength(6);
    // The Warehouse view is the default: it is shown prices in one large system.
    expect(within(group).getByRole('button', { name: 'คลังสินค้า' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const before = shift.querySelector('[data-panel="before"]')!;
    const after = shift.querySelector('[data-panel="after"]')!;
    expect(before.querySelectorAll('[data-module]')).toHaveLength(MODULES.length);
    expect(before.querySelector('[data-excess]')).toHaveAttribute('data-module', 'pricing');
    expect(after.querySelector('[data-workspace]')).toHaveAttribute('data-workspace', 'warehouse');
    expect(after.querySelector('[data-workspace]')!.textContent).not.toMatch(MONEY);
    expect(after).toHaveTextContent('SO-1042');

    await userEvent.click(within(group).getByRole('button', { name: 'ฝ่ายขาย' }));
    expect(within(group).getByRole('button', { name: 'ฝ่ายขาย' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'คลังสินค้า' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(before.querySelector('[data-excess]')).toHaveAttribute('data-module', 'warehouse');
    expect(shift.querySelector('[data-workspace]')).toHaveAttribute('data-workspace', 'sales');
    expect(shift.querySelector('[data-caption="after"]')).toHaveTextContent('ฝ่ายขาย:');
    expect(shift.querySelectorAll('[data-points="before"] li')).toHaveLength(4);
    expect(shift.querySelectorAll('[data-points="after"] li')).toHaveLength(4);
    expect(shift).toHaveTextContent('ไม่ใช่การบอกว่าระบบแบบเดิมไม่ดี');
  });

  it('explains the department-centric philosophy and preserves Warehouse privacy', async () => {
    await open();
    const d = section(WHY_CHAPTER.departments);
    expect([...d.querySelectorAll('[data-line]')].map((l) => l.getAttribute('data-line'))).toEqual([
      ...NOT_NEEDED,
    ]);
    expect(d).toHaveTextContent('ไม่จำเป็นต้องเห็นทุกธุรกรรม');
    expect(d.querySelector('[data-warehouse-privacy]')).toHaveTextContent(
      'ไม่ใช่แค่การซ่อนคอลัมน์',
    );
    expect(d.querySelector('a[href="/departments"]')).not.toBeNull();
  });

  it('shows department-specific views reading one shared state', async () => {
    await open();
    const c = section(WHY_CHAPTER.connected);
    expect(c.querySelectorAll('[data-view]')).toHaveLength(6);
    expect(c.querySelector('[data-view="warehouse"]')!.textContent).not.toMatch(MONEY);
    expect(c.querySelector('[data-shared-state]')).toHaveTextContent('SO-1042 · รอจัดส่ง');
    expect(c).toHaveTextContent('ไม่ได้แปลว่าตัดขาดจากกัน');
  });

  it('makes Human Error a design problem: prevent bad states, guided by the five principles', async () => {
    await open();
    const he = section(WHY_CHAPTER.humanError);
    expect(he).toHaveTextContent('ด้วยการบอกให้คนระวังมากขึ้น');
    expect(he.querySelector('[data-record-prevent]')).toHaveTextContent('ระบบที่ช่วยป้องกัน');
    expect(he.querySelector('[data-state-guard] [data-blocked]')).toHaveTextContent(
      'สถานะที่ไม่ควรเกิด',
    );
    expect(
      [...he.querySelectorAll('[data-guard]')].map((g) => g.getAttribute('data-guard')),
    ).toEqual(GUARDS.map((g) => g.id));
    expect(he).toHaveTextContent('PREVENT');
    expect(he).toHaveTextContent('TRACE');
    expect(he.querySelector('a[href="/solutions#human-error"]')).not.toBeNull();
    expect(he.querySelector('a[href="/how-core-works#human-error"]')).not.toBeNull();
  });

  it('gives management signals, not noise', async () => {
    await open();
    const ex = section(WHY_CHAPTER.executive);
    expect(
      [...ex.querySelectorAll('[data-signal]')].map((s) => s.getAttribute('data-signal')),
    ).toEqual([...SIGNALS]);
    expect(ex.querySelector('a[href="/departments/executive"]')).not.toBeNull();
  });

  it('keeps the "software should disappear" philosophy quiet, then shows where to go next', async () => {
    await open();
    expect(section(WHY_CHAPTER.nextAction)).toHaveTextContent('ควรทำให้งานถัดไปชัดเจน');
    const see = section(WHY_CHAPTER.see);
    expect(within(see).getByRole('link', { name: /ดูว่า CORE ทำงานอย่างไร/ })).toHaveAttribute(
      'href',
      '/how-core-works',
    );
    expect(within(see).getByRole('link', { name: /สำรวจแต่ละแผนก/ })).toHaveAttribute(
      'href',
      '/departments',
    );
    expect(within(see).getByRole('link', { name: /ขอ Demo/ })).toHaveAttribute(
      'href',
      '/consultation?topic=demo',
    );
  });

  it('is not a copy of /about', async () => {
    await open();
    const ids = [...main().querySelectorAll('section[id]')].map((s) => s.id);
    for (const about of ['pda-bliss', 'belief', 'consulting', 'company-information']) {
      expect(ids).not.toContain(about);
    }
    expect(main()).not.toHaveTextContent(CONTACT.address);
    expect(main().textContent).not.toMatch(CLAIMS);
  });
});

/* ------------------------------------------------------------------ */

describe('reduced motion', () => {
  it('shows the islands and the CORE layer in their final state', async () => {
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    await open();
    const parts = document.querySelectorAll<HTMLElement>(
      '[data-hero-visual] [data-island], [data-hero-visual] [data-core-layer]',
    );
    expect(parts).toHaveLength(7);
    for (const p of parts) expect(p.style.opacity).not.toBe('0');
  });
});

describe('localization and links', () => {
  it('renders English without Thai', async () => {
    await open('/en/why-core');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'real work gets stuck between departments',
    );
    expect(within(main()).getByRole('group', { name: 'View as' })).toBeInTheDocument();
    expect(visibleText()).not.toMatch(THAI);
  });

  it('renders Simplified Chinese without Thai or Traditional characters', async () => {
    await open('/zh/why-core');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('真实工作常常卡在部门之间');
    expect(visibleText()).not.toMatch(THAI);
    expect(visibleText()).not.toMatch(TRADITIONAL);
  });

  it('gives each locale a unique title and description', async () => {
    const seen = new Set<string>();
    for (const path of ['/why-core', '/en/why-core', '/zh/why-core']) {
      const { unmount } = await open(path);
      await waitFor(() => expect(document.title).toContain('|'));
      seen.add(document.title);
      seen.add(document.querySelector('meta[name="description"]')!.getAttribute('content')!);
      unmount();
    }
    expect(seen.size).toBe(6);
  });

  it('keeps the locale in every page link', async () => {
    await open('/en/why-core');
    for (const href of [
      '/en/how-core-works',
      '/en/how-core-works#human-error',
      '/en/solutions#human-error',
      '/en/departments',
      '/en/departments/executive',
      '/en/consultation?topic=demo',
      '/en/about',
    ]) {
      expect(main().querySelector(`a[href="${href}"]`), href).not.toBeNull();
    }
  });
});
