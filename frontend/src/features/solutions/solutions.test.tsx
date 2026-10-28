import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CONTACT } from '@/config/contact';
import { DEPT_PAGES } from '@/features/departments/catalog';
import { CHAPTER } from '@/features/workflow/model';
import { renderRoute } from '@/test/render';
import { SOLUTIONS_COPY } from './copy';
import { fefoPicks, LOTS, NAVIGATOR, PICK, RECEIPT, SOLUTION_IDS, SOLUTIONS } from './model';

/*
 * EP09: /solutions — organizational problems first, then how CORE handles
 * them. The model and copy are tested directly; the page as rendered.
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

// "จ่าย" alone means issuing goods in a warehouse; only payment wording counts as money.
const MONEY =
  /฿|บาท|THB|\$|¥|元|泰铢|ราคา|ต้นทุน|มูลค่า|ชำระ|จ่ายเงิน|เงิน|price|cost|payment|\bpay\b|amount|价格|成本|金额|付款/i;
const ANCHORS = [
  'falling-through',
  'visibility',
  'human-error',
  'approval',
  'stock',
  'supplier',
  'payment',
  'management',
  'cross-department',
];

async function open(path = '/solutions') {
  const utils = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return utils;
}
const section = (id: string) => document.getElementById(id)!;
const allStrings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(allStrings)
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(allStrings)
        : [];

describe('solution model', () => {
  it('defines the nine solution stories with their anchors', () => {
    expect(SOLUTION_IDS).toHaveLength(9);
    expect(SOLUTIONS.map((s) => s.anchor)).toEqual(ANCHORS);
  });

  it('connects every solution to departments and a How CORE works chapter', () => {
    const chapters = Object.values(CHAPTER) as string[];
    for (const s of SOLUTIONS) {
      expect(s.departments.length).toBeGreaterThan(0);
      for (const d of s.departments) expect(DEPT_PAGES).toContain(d);
      expect(chapters).toContain(s.workflow);
    }
    expect(SOLUTIONS.find((s) => s.id === 'humanError')!.workflow).toBe('human-error');
    expect(SOLUTIONS.find((s) => s.id === 'approval')!.workflow).toBe('approval');
    expect(SOLUTIONS.find((s) => s.id === 'stock')!.departments[0]).toBe('warehouse');
  });

  it('places every friction except the synthesis between two departments', () => {
    expect(SOLUTIONS.filter((s) => !s.between).map((s) => s.id)).toEqual(['crossDepartment']);
    expect(NAVIGATOR).toHaveLength(8);
  });

  it('fills a pick by FEFO and keeps the supplier example in quantities', () => {
    expect(fefoPicks(LOTS, PICK).map((p) => [p.code, p.take])).toEqual([
      ['LOT-2408-C', 30],
      ['LOT-2409-B', 20],
      ['LOT-2410-A', 0],
    ]);
    expect(RECEIPT.ordered - RECEIPT.received).toBe(40);
  });
});

describe('solution copy', () => {
  it('answers problem, where, impact, CORE response and before/after in every locale', () => {
    for (const copy of Object.values(SOLUTIONS_COPY)) {
      for (const id of SOLUTION_IDS) {
        const st = copy.stories[id];
        for (const k of ['problem', 'where', 'impact', 'who', 'before', 'after'] as const) {
          expect(st[k].length, `${id}.${k}`).toBeGreaterThan(3);
        }
        expect(st.response.length).toBeGreaterThan(1);
      }
    }
  });

  it('makes no numeric improvement claims', () => {
    for (const copy of Object.values(SOLUTIONS_COPY)) {
      const text = allStrings(copy).join(' ');
      expect(text).not.toMatch(/\d+\s?%|ROI|uptime|guarantee|รับประกัน|保证/i);
    }
  });

  it('keeps the Stock story free of financial wording in every locale', () => {
    for (const copy of Object.values(SOLUTIONS_COPY)) {
      expect(allStrings([copy.stories.stock, copy.stock]).join(' ')).not.toMatch(MONEY);
    }
  });

  it('positions payments as operational finance, not a full accounting system', () => {
    expect(SOLUTIONS_COPY.th.stories.payment.boundary).toMatch(/ไม่ได้แทนระบบบัญชีเต็มรูปแบบ/);
    expect(SOLUTIONS_COPY.en.stories.payment.boundary).toMatch(
      /does not replace a full accounting system, general ledger or tax filing/,
    );
    expect(SOLUTIONS_COPY['zh-CN'].stories.payment.boundary).toMatch(/并不取代完整的会计系统/);
  });
});

describe('/solutions page', () => {
  it('starts from organizational pain with one H1', async () => {
    await open();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'ปัญหาไม่ได้อยู่ที่งานเยอะเสมอไป',
    );
    expect(document.querySelector('[data-hero-story]')).toHaveTextContent(
      'องค์กรไม่ได้พังเพราะไม่มีข้อมูล',
    );
  });

  it('renders every solution story with problem, response, before/after and links', async () => {
    await open();
    for (const s of SOLUTIONS) {
      const el = section(s.anchor);
      expect(el, s.anchor).not.toBeNull();
      expect(el.querySelector('h2')).not.toBeNull();
      expect(el.querySelector('[data-facts]')).not.toBeNull();
      expect(el.querySelector('[data-response]')).not.toBeNull();
      expect(el.querySelector('[data-before-after]')).not.toBeNull();
      for (const d of s.departments) {
        expect(
          el.querySelector(`[data-story-links] a[href="/departments/${d}"]`),
          `${s.id}/${d}`,
        ).not.toBeNull();
      }
      expect(el.querySelector(`a[href="/how-core-works#${s.workflow}"]`)).not.toBeNull();
    }
  });

  it('lists every friction on the problem map and resolves it with CORE', async () => {
    await open();
    const map = section('problem-map');
    for (const s of SOLUTIONS) {
      expect(map.querySelector(`a[data-friction="${s.id}"]`)).toHaveAttribute(
        'href',
        `#${s.anchor}`,
      );
    }
    expect(map.querySelector('[data-friction="approval"]')).toHaveTextContent('รออนุมัติ');
    await userEvent.click(within(map).getByRole('radio', { name: /เมื่อมี CORE/ }));
    expect(map.querySelector('[data-problem-map]')).toHaveAttribute('data-view', 'after');
    expect(map.querySelector('[data-friction="approval"]')).toHaveTextContent('รู้ว่ารอใคร');
  });

  it('assigns an owner to work that fell into the gap', async () => {
    await open();
    const s = section('falling-through');
    expect(s.querySelector('[data-falling]')).toHaveAttribute('data-falling', 'before');
    expect(s).toHaveTextContent('ไม่มีเจ้าของ');
    await userEvent.click(within(s).getByRole('radio', { name: /กับ CORE/ }));
    const card = s.querySelector('[data-owner-card]')!;
    expect(card).toHaveTextContent('เจ้าของงาน');
    expect(card).toHaveTextContent('สิ่งที่ต้องทำต่อ');
    expect(card).toHaveTextContent('ประวัติการส่งต่อ');
  });

  it('shows one shared state through each department lens', async () => {
    await open();
    const s = section('visibility');
    expect(s.querySelector('[data-questions]')).toHaveTextContent('ของมาหรือยัง?');
    await userEvent.click(within(s).getByRole('radio', { name: /คลังสินค้า/ }));
    const lens = s.querySelector('[data-lens]')!;
    expect(lens).toHaveAttribute('data-lens', 'warehouse');
    expect(lens).toHaveTextContent('รอรับสินค้าจาก Supplier');
    expect(lens.textContent).not.toMatch(MONEY);
    await userEvent.keyboard('{End}');
    expect(s.querySelector('[data-lens]')).toHaveAttribute('data-lens', 'executive');
    expect(s.querySelector('[data-lens]')).toHaveTextContent('รอรับสินค้าจาก Supplier');
  });

  it('walks a mistake through CORE’s checks', async () => {
    await open();
    const s = section('human-error');
    expect(s.querySelector('[data-lifecycle]')).toHaveTextContent('DETECT');
    await userEvent.click(within(s).getByRole('radio', { name: /Lot ไม่ครบ/ }));
    const life = s.querySelector('[data-lifecycle]')!;
    expect(life).toHaveAttribute('data-lifecycle', 'missingLot');
    expect(life).toHaveTextContent('PREVENT');
    expect(life.querySelectorAll('[data-stage]')).toHaveLength(4);
  });

  it('pauses at the approver and continues after the decision', async () => {
    await open();
    const s = section('approval');
    const flow = () => s.querySelector('[data-approval-flow]')!;
    expect(flow()).toHaveAttribute('data-approval-flow', 'waiting');
    expect(flow().querySelector('[data-stage="waiting"]')).toHaveAttribute('data-state', 'waiting');
    expect(s).toHaveTextContent('รอมาแล้ว 2 วันทำการ');
    expect(s).toHaveTextContent('ไม่ได้หมายถึงการยกระดับหรือแจ้งเตือนตามเวลาโดยอัตโนมัติ');
    await userEvent.click(within(s).getByRole('button', { name: /จำลอง: อนุมัติ/ }));
    expect(flow()).toHaveAttribute('data-approval-flow', 'continued');
  });

  it('keeps the Stock story operational — no money anywhere, preview included', async () => {
    await open();
    const s = section('stock');
    await waitFor(() =>
      expect(s.querySelector('[inert]')?.textContent?.length ?? 0).toBeGreaterThan(20),
    );
    expect(s.textContent).not.toMatch(MONEY);
    expect(
      [...s.querySelectorAll<HTMLElement>('[data-fefo] [data-pick]')].map((e) => e.dataset.pick),
    ).toEqual(['30', '20', '0']);
    expect(s.querySelector('[data-count]')).toHaveTextContent(/40.*38.*−2/);
    expect(s).toHaveTextContent('หมดอายุใน 24 วัน');
  });

  it('shows commitment against receipt and the affected work', async () => {
    await open();
    const s = section('supplier');
    expect(s.querySelector('[data-receipt]')).toHaveTextContent(/100.*60.*40/);
    expect(s).toHaveTextContent('WO-0307');
  });

  it('gates payment on documents and keeps the accounting boundary', async () => {
    await open();
    const s = section('payment');
    const state = () => s.querySelector('[data-payment-state]')!;
    expect(state()).toHaveAttribute('data-payment-state', 'blocked');
    await userEvent.click(s.querySelector<HTMLElement>('[data-gate="receipt"]')!);
    await userEvent.click(s.querySelector<HTMLElement>('[data-gate="approval"]')!);
    expect(state()).toHaveAttribute('data-payment-state', 'ready');
    expect(s.querySelector('[data-boundary]')).toHaveTextContent('ไม่ได้แทนระบบบัญชีเต็มรูปแบบ');
  });

  it('shows executives signals, and links each workspace', async () => {
    await open();
    expect(section('management').querySelector('[data-executive-panel]')).toHaveTextContent(
      'คอขวด',
    );
    const cross = section('cross-department');
    for (const d of DEPT_PAGES)
      expect(cross.querySelector(`[data-cross] a[href="/departments/${d}"]`)).not.toBeNull();
  });

  it('guides from a symptom to cause, department, mechanism and story', async () => {
    await open();
    const nav = section('navigator');
    await userEvent.click(within(nav).getByRole('radio', { name: /Stock คุมยาก/ }));
    const panel = nav.querySelector('[data-navigator]')!;
    expect(panel).toHaveAttribute('data-navigator', 'stock');
    expect(panel.querySelector('[data-nav-dept]')).toHaveAttribute(
      'href',
      '/departments/warehouse',
    );
    expect(panel.querySelector('[data-nav-workflow]')).toHaveAttribute(
      'href',
      '/how-core-works#exceptions',
    );
    expect(panel.querySelector('[data-nav-next]')).toHaveAttribute('href', '#stock');
    within(nav)
      .getByRole('radio', { name: /Stock คุมยาก/ })
      .focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(nav.querySelector('[data-navigator]')).toHaveAttribute('data-navigator', 'approval');
  });

  it('closes with How CORE works first, then departments and a demo', async () => {
    await open();
    const main = document.getElementById('main')!;
    const cta = main.querySelector('#solutions-cta')!.closest('section')!;
    const links = [...cta.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/how-core-works', '/departments', '/consultation?topic=demo']);
  });
});

describe('reduced motion', () => {
  it('shows the problem and the resolution statically', async () => {
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    await open();
    const hero = screen.getByRole('heading', { level: 1 }).closest('section')!;
    expect(hero).toHaveTextContent('งานส่งต่อหาย');
    expect(hero).toHaveTextContent('CORE เชื่อมรอยต่อ');
  });
});

describe('localization and links', () => {
  const THAI = /[฀-฾เ-๿]/;
  function visibleText() {
    const m = document.getElementById('main')!.cloneNode(true) as HTMLElement;
    m.querySelectorAll('[inert], [aria-hidden="true"]').forEach((n) => n.remove());
    return (m.textContent ?? '').replace(CONTACT.address, '');
  }

  it('renders English without Thai', async () => {
    await open('/en/solutions');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'The problem isn’t always too much work',
    );
    expect(visibleText()).not.toMatch(THAI);
  });

  it('renders Simplified Chinese without Thai or Traditional characters', async () => {
    await open('/zh/solutions');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('问题不一定是工作太多');
    expect(visibleText()).not.toMatch(THAI);
    expect(visibleText()).not.toMatch(/[們個發這開時關庫說價購資費號門運營]/);
  });

  it('gives each locale a unique title and description', async () => {
    const seen = new Set<string>();
    for (const path of ['/solutions', '/en/solutions', '/zh/solutions']) {
      const { unmount } = await open(path);
      await waitFor(() => expect(document.title).toContain('|'));
      seen.add(document.title);
      seen.add(document.querySelector('meta[name="description"]')!.getAttribute('content')!);
      unmount();
    }
    expect(seen.size).toBe(6);
  });

  it('keeps the locale in department and workflow links', async () => {
    await open('/zh/solutions');
    const main = document.getElementById('main')!;
    expect(main.querySelector('#stock a[href="/zh/departments/warehouse"]')).not.toBeNull();
    expect(
      main.querySelector('#human-error a[href="/zh/how-core-works#human-error"]'),
    ).not.toBeNull();
    expect(main.querySelector('#approval a[href="/zh/how-core-works#approval"]')).not.toBeNull();
  });

  it('links the Solutions menu to the problem page, industries and organizations (EP18)', async () => {
    renderRoute('/en');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Solutions' }));
    for (const href of [
      '/en/solutions',
      '/en/industries',
      '/en/enterprise',
      '/en/industries/retail',
      '/en/industries/manufacturing',
    ]) {
      expect(document.querySelector(`header a[href="${href}"]`), href).not.toBeNull();
    }
  });

  it('links the homepage problem chapter to the page', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelector('#complexity a[href="/solutions"]')).not.toBeNull();
  });
});
