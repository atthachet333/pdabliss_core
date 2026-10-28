import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CONTACT } from '@/config/contact';
import { renderRoute } from '@/test/render';
import { WORKFLOW } from './copy';
import {
  actorsIn,
  buildRoute,
  DEFAULT_DECISIONS,
  FINANCIAL_FIELDS,
  HIDDEN,
  isDecisionRelevant,
  provenance,
  ROLE_FOCUS,
  STEPS,
  TRACE,
  VISIBLE,
} from './model';

/*
 * EP08: /how-core-works — one illustrative piece of work travelling through
 * the company. The model is tested directly; the page is tested as rendered.
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

const MONEY =
  /฿|บาท|THB|\$|¥|元|泰铢|ราคา|ต้นทุน|มูลค่า|ยอด|price|cost|payment|amount|价格|成本|金额|付款/i;

async function open(path = '/how-core-works') {
  const utils = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return utils;
}
const section = (id: string) => document.getElementById(id)!;
const ids = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>('[data-route-stack] [data-step]')].map(
    (li) => li.dataset.step,
  );
async function choose(decision: string, answer: string) {
  const row = document.querySelector<HTMLElement>(`[data-decision="${decision}"]`)!;
  await userEvent.click(within(row).getByRole('radio', { name: answer }));
}

describe('workflow model', () => {
  it('follows the illustrative end-to-end order', () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      'customerPo',
      'salesOrder',
      'stockCheck',
      'shortage',
      'workRequirement',
      'purchaseRequirement',
      'purchaseOrder',
      'depositRequest',
      'depositApproved',
      'supplierShips',
      'goodsReceived',
      'lotRecorded',
      'stockAvailable',
      'fulfilment',
      'salesReady',
      'complete',
    ]);
    expect(STEPS[0]!.actor).toBe('sales');
    expect(STEPS.at(-1)!.id).toBe('complete');
  });

  it('runs the full route by default: shortage, work, purchase, deposit', () => {
    const r = buildRoute(DEFAULT_DECISIONS);
    expect(r.steps).toHaveLength(16);
    expect(r.skipped).toEqual([]);
    expect(actorsIn(r)).toEqual([
      'sales',
      'operations',
      'warehouse',
      'purchasing',
      'accounting',
      'supplier',
    ]);
    expect(r.steps.find((s) => s.id === 'shortage')!.status).toBe('attention');
    expect(r.steps.at(-1)!.status).toBe('complete');
  });

  it('skips Purchasing and Accounting when stock is enough', () => {
    const r = buildRoute({ ...DEFAULT_DECISIONS, stockEnough: true });
    expect(r.steps.map((s) => s.id)).toEqual([
      'customerPo',
      'salesOrder',
      'stockCheck',
      'fulfilment',
      'salesReady',
      'complete',
    ]);
    expect(actorsIn(r)).toEqual(['sales', 'warehouse']);
    expect(isDecisionRelevant('needPurchase', { ...DEFAULT_DECISIONS, stockEnough: true })).toBe(
      false,
    );
  });

  it('represents the optional Operations, Purchasing and Accounting branches', () => {
    const noWork = buildRoute({ ...DEFAULT_DECISIONS, needWork: false });
    expect(noWork.skipped).toEqual(['workRequirement']);
    const noPurchase = buildRoute({ ...DEFAULT_DECISIONS, needPurchase: false });
    expect(actorsIn(noPurchase)).toEqual(['sales', 'operations', 'warehouse']);
    expect(noPurchase.skipped).toContain('goodsReceived');
    const noDeposit = buildRoute({ ...DEFAULT_DECISIONS, depositRequired: false });
    expect(actorsIn(noDeposit)).not.toContain('accounting');
    expect(noDeposit.skipped).toEqual(['depositRequest', 'depositApproved']);
  });

  it('pauses at receiving when goods are on hold, and at the shortage with no way to replenish', () => {
    const hold = buildRoute({ ...DEFAULT_DECISIONS, qcPassed: false });
    expect(hold.pausedAt).toBe('lotRecorded');
    expect(hold.steps.find((s) => s.id === 'lotRecorded')!.status).toBe('blocked');
    expect(hold.steps.find((s) => s.id === 'complete')!.status).toBe('waiting');
    const stuck = buildRoute({ ...DEFAULT_DECISIONS, needWork: false, needPurchase: false });
    expect(stuck.pausedAt).toBe('shortage');
  });

  it('never gives the Warehouse financial fields', () => {
    expect(VISIBLE.warehouse.filter((f) => FINANCIAL_FIELDS.includes(f))).toEqual([]);
    expect(VISIBLE.operations.filter((f) => FINANCIAL_FIELDS.includes(f))).toEqual([]);
    expect(HIDDEN.warehouse).toEqual(expect.arrayContaining(['orderValue', 'paymentAmount']));
    expect(VISIBLE.warehouse).toEqual(['item', 'quantity', 'lot', 'location', 'expiry']);
  });

  it('keeps every Warehouse step free of money in every locale', () => {
    const warehouseSteps = STEPS.filter((s) => s.actor === 'warehouse').map((s) => s.id);
    for (const copy of Object.values(WORKFLOW)) {
      for (const id of warehouseSteps) {
        expect(`${copy.common.steps[id].title} ${copy.common.steps[id].detail}`).not.toMatch(MONEY);
      }
      for (const f of VISIBLE.warehouse) expect(copy.common.fields[f]).not.toMatch(MONEY);
      expect(copy.roles.roles.employee.items.join(' ')).not.toMatch(MONEY);
    }
    expect(ROLE_FOCUS.employee.lane).toBe('warehouse');
  });

  it('traces the cross-department provenance', () => {
    expect(provenance(TRACE)).toEqual([
      'sales',
      'warehouse',
      'operations',
      'purchasing',
      'accounting',
      'supplier',
      'warehouse',
      'sales',
    ]);
  });
});

describe('/how-core-works page', () => {
  it('renders one H1 explaining one work across many departments', async () => {
    await open();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('งานหนึ่งชิ้น');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('เดินทางผ่านหลายแผนก');
    expect(document.getElementById('main')).toHaveTextContent('ตัวอย่างกระบวนการ');
  });

  it('shows every chapter with an H2', async () => {
    await open();
    for (const id of [
      'one-work',
      'work-enters-core',
      'responsibility',
      'handoff',
      'decisions',
      'approval',
      'exceptions',
      'human-error',
      'roles',
      'trace',
      'replay',
      'adapt',
    ]) {
      expect(section(id).querySelector('h2')).not.toBeNull();
    }
  });

  it('shows the required departments and the main flow in order', async () => {
    await open();
    const decisions = section('decisions');
    const involved = [
      ...decisions.querySelectorAll<HTMLElement>('[data-involved] [data-actor]'),
    ].map((e) => e.dataset.actor);
    expect(involved).toEqual([
      'sales',
      'operations',
      'warehouse',
      'purchasing',
      'accounting',
      'supplier',
    ]);
    expect(ids(decisions)).toEqual(STEPS.map((s) => s.id));
    expect(decisions).toHaveTextContent('รับ PO ลูกค้า');
    expect(decisions).toHaveTextContent('บันทึก Lot / วันหมดอายุ');
    expect(decisions).toHaveTextContent('ส่งมอบเรียบร้อย');
  });

  it('switches the route at the stock decision', async () => {
    await open();
    await choose('stockEnough', 'พอ');
    const decisions = section('decisions');
    expect(ids(decisions)).toEqual([
      'customerPo',
      'salesOrder',
      'stockCheck',
      'fulfilment',
      'salesReady',
      'complete',
    ]);
    expect(decisions.querySelector('[data-skipped-step="purchaseOrder"]')).not.toBeNull();
    expect(decisions.querySelector('[data-actor="purchasing"]')).toBeNull();
    expect(decisions.querySelector('[data-decision="needPurchase"]')).toHaveAttribute(
      'data-relevant',
      'false',
    );
    await userEvent.click(
      within(decisions).getByRole('button', { name: 'กลับไปตัวอย่างเริ่มต้น' }),
    );
    expect(ids(decisions)).toHaveLength(16);
  });

  it('activates Accounting only when a deposit is required, and pauses on QC hold', async () => {
    await open();
    const decisions = section('decisions');
    await choose('depositRequired', 'ไม่ต้องการ');
    expect(decisions.querySelector('[data-actor="accounting"]')).toBeNull();
    await choose('depositRequired', 'ต้องการ');
    expect(decisions.querySelector('[data-actor="accounting"]')).not.toBeNull();
    await choose('qcPassed', 'พักตรวจ');
    expect(decisions.querySelector('[data-paused="lotRecorded"]')).toHaveTextContent(
      'งานหยุดรอที่',
    );
  });

  it('routes the handoff answer', async () => {
    await open();
    const h = section('handoff');
    expect(h.querySelectorAll('[data-handoff-packet] [data-part]')).toHaveLength(6);
    await userEvent.click(within(h).getByRole('radio', { name: /มีของพร้อม/ }));
    expect(h.querySelector('[data-handoff-result]')).toHaveAttribute(
      'data-handoff-result',
      'available',
    );
    expect(ids(h)).toContain('fulfilment');
    expect(ids(h)).not.toContain('purchaseOrder');
  });

  it('shows the approval waiting point and continues after approval', async () => {
    await open();
    const a = section('approval');
    const stage = (s: string) => a.querySelector(`[data-stage="${s}"]`)!;
    expect(stage('accountingReview')).toHaveAttribute('data-state', 'waiting');
    expect(a).toHaveTextContent('งานหยุดรอการอนุมัติ');
    await userEvent.click(within(a).getByRole('button', { name: /จำลอง: บัญชีอนุมัติ/ }));
    expect(stage('accountingReview')).toHaveAttribute('data-state', 'complete');
    expect(stage('expectedDelivery')).toHaveAttribute('data-state', 'complete');
    expect(a.querySelectorAll('[data-approval-type]')).toHaveLength(3);
  });

  it('raises an exception out of the calm route', async () => {
    await open();
    const x = section('exceptions');
    await userEvent.click(within(x).getByRole('radio', { name: /จำนวนไม่ตรง/ }));
    const panel = x.querySelector('[data-exception]')!;
    expect(panel).toHaveAttribute('data-exception', 'countVariance');
    expect(panel).toHaveTextContent('คลังสินค้า');
    expect(panel).toHaveTextContent('ติดขัด');
    await userEvent.click(within(x).getByRole('radio', { name: /ไม่มีเหตุการณ์/ }));
    expect(x.querySelector('[data-exception]')).toHaveTextContent('ทุกอย่างปกติ');
  });

  it('focuses phone route lists on the relevant steps, with a toggle for all', async () => {
    await open();
    const x = section('exceptions');
    expect(ids(x)).toEqual(['supplierShips']);
    await userEvent.click(within(x).getByRole('button', { name: /แสดงทุกขั้น \(16\)/ }));
    expect(ids(x)).toHaveLength(16);
    expect(within(x).getByRole('button', { name: 'แสดงเฉพาะขั้นที่เกี่ยวข้อง' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('shows the five human-error principles on the route', async () => {
    await open();
    const h = section('human-error');
    expect(
      [...h.querySelectorAll<HTMLElement>('[data-principle]')].map((e) => e.dataset.principle),
    ).toEqual(['prevent', 'detect', 'alert', 'control', 'trace']);
    expect(h.querySelector('[data-detect]')).toHaveTextContent(/100.*80.*−20/);
    expect(h).toHaveTextContent('PO สั่ง 100 หน่วย คลังรับ 80 หน่วย');
  });

  it('explains information boundaries with Warehouse first', async () => {
    await open();
    const r = section('responsibility');
    const panel = r.querySelector<HTMLElement>('[data-routing-lane]')!;
    expect(panel).toHaveAttribute('data-routing-lane', 'warehouse');
    expect(panel.querySelector('[data-warehouse-principle]')).toHaveTextContent(
      'คลังสินค้าไม่เห็นราคา',
    );
    expect(panel.querySelector('[data-visible-fields]')!.textContent).not.toMatch(MONEY);
    const tab = within(r).getByRole('tab', { name: /คลังสินค้า/ });
    tab.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(r.querySelector('[data-routing-lane]')).toHaveAttribute(
      'data-routing-lane',
      'accounting',
    );
    expect(r.querySelector('[data-visible-fields]')).toHaveTextContent('ยอดที่ต้องจ่าย');
  });

  it('switches roles by keyboard; the executive sees signals, not transactions', async () => {
    await open();
    const roles = section('roles');
    const tabs = within(roles).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(roles.querySelector('[data-role]')).toHaveTextContent('ฉันต้องทำอะไร');
    tabs[0]!.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(roles.querySelector('[data-role]')).toHaveAttribute('data-role', 'manager');
    expect(roles.querySelector('[data-role]')).toHaveTextContent('ทีมฉันติดตรงไหน');
    await userEvent.keyboard('{End}');
    expect(roles.querySelector('[data-role]')).toHaveAttribute('data-role', 'executive');
    expect(roles.querySelector('[data-role-items]')).toHaveTextContent('คอขวด');
  });

  it('shows the trace as history and as cross-department route', async () => {
    await open();
    const t = section('trace');
    expect(t.querySelectorAll('[data-trace-event]')).toHaveLength(TRACE.length);
    await userEvent.click(within(t).getByRole('radio', { name: /เส้นทางข้ามแผนก/ }));
    expect(t.querySelector('[data-provenance]')!.querySelectorAll('li')).toHaveLength(8);
    expect(t).toHaveTextContent('ไม่ใช่การรับรองทางกฎหมาย');
  });

  it('replays step by step with next, previous and restart — no autoplay', async () => {
    await open();
    const r = section('replay');
    const step = () => r.querySelector<HTMLElement>('[data-replay-step]')!;
    expect(step()).toHaveAttribute('data-replay-step', 'customerPo');
    expect(within(r).getByRole('button', { name: 'เล่น' })).toBeInTheDocument();
    await userEvent.click(within(r).getByRole('button', { name: 'ขั้นถัดไป' }));
    await userEvent.click(within(r).getByRole('button', { name: 'ขั้นถัดไป' }));
    expect(step()).toHaveAttribute('data-replay-step', 'stockCheck');
    expect(step()).toHaveTextContent('ขั้นที่ 3 จาก 16');
    await userEvent.click(within(r).getByRole('button', { name: 'ขั้นก่อนหน้า' }));
    expect(step()).toHaveAttribute('data-replay-step', 'salesOrder');
    await userEvent.click(within(r).getByRole('button', { name: 'เริ่มใหม่' }));
    expect(step()).toHaveAttribute('data-replay-step', 'customerPo');
    expect(within(r).getByRole('button', { name: 'ขั้นก่อนหน้า' })).toBeDisabled();
  });

  it('replays the route chosen at the forks', async () => {
    await open();
    await choose('stockEnough', 'พอ');
    expect(section('replay')).toHaveTextContent('ขั้นที่ 1 จาก 6');
  });

  it('adapts to the organization and links to the packages', async () => {
    await open();
    const a = section('adapt');
    expect(a.querySelectorAll('[data-adapt]')).toHaveLength(5);
    const links = [...a.querySelectorAll('[data-adapt-packages] a')].map((l) =>
      l.getAttribute('href'),
    );
    expect(links).toEqual([
      '/pricing?plan=starter#packages',
      '/pricing?plan=business#packages',
      '/pricing?plan=professional#packages',
      '/pricing?plan=enterprise#packages',
    ]);
    expect(within(a).getByRole('link', { name: /ดูแพ็คเกจทั้งหมด/ })).toHaveAttribute(
      'href',
      '/pricing',
    );
  });
});

describe('reduced motion', () => {
  it('offers manual steps only and keeps the route complete', async () => {
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    await open();
    const r = section('replay');
    expect(within(r).queryByRole('button', { name: 'เล่น' })).toBeNull();
    expect(r).toHaveTextContent('ปิดการเล่นอัตโนมัติ');
    expect(within(r).getByRole('button', { name: 'ขั้นถัดไป' })).toBeEnabled();
    expect(document.querySelector('animateMotion')).toBeNull();
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
    await open('/en/how-core-works');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('One piece of work');
    expect(visibleText()).not.toMatch(THAI);
  });

  it('renders Simplified Chinese without Thai or Traditional characters', async () => {
    await open('/zh/how-core-works');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('一项工作');
    expect(visibleText()).not.toMatch(THAI);
    expect(visibleText()).not.toMatch(/[們個發這開時關庫說價購資費號門運營]/);
  });

  it('gives each locale a unique title and description', async () => {
    const seen = new Set<string>();
    for (const path of ['/how-core-works', '/en/how-core-works', '/zh/how-core-works']) {
      const { unmount } = await open(path);
      await waitFor(() => expect(document.title).toContain('|'));
      seen.add(document.title);
      seen.add(document.querySelector('meta[name="description"]')!.getAttribute('content')!);
      unmount();
    }
    expect(seen.size).toBe(6);
  });

  it('keeps the locale in department and pricing links', async () => {
    await open('/zh/how-core-works');
    const main = document.getElementById('main')!;
    expect(main.querySelector('a[href="/zh/departments/warehouse"]')).not.toBeNull();
    expect(main.querySelector('a[href="/zh/departments/sales"]')).not.toBeNull();
    expect(main.querySelector('a[href="/zh/pricing"]')).not.toBeNull();
    expect(main.querySelector('a[href="/zh/consultation?topic=demo"]')).not.toBeNull();
  });

  it('links How CORE works and its guide from the menus (EP18)', async () => {
    renderRoute('/en');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Product' }));
    expect(document.querySelector('header a[href="/en/how-core-works"]')).not.toBeNull();
    await userEvent.click(within(nav).getByRole('button', { name: 'Resources' }));
    for (const href of ['/en/resources/how-core-works', '/en/resources/human-error']) {
      expect(document.querySelector(`header a[href="${href}"]`), href).not.toBeNull();
    }
  });

  it('links the homepage and department pages to the page', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelector('#connected-flow a[href="/how-core-works"]')).not.toBeNull();
    expect(document.querySelector('footer a[href="/how-core-works"]')).not.toBeNull();
  });
});
