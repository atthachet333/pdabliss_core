import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Localized } from '@/i18n/useCopy';
import { renderRoute } from '@/test/render';
import { DEMO_COPY, type DemoCopy } from './copy';
import {
  ACTION_ROLE,
  AVAILABLE,
  INITIAL,
  initialSession,
  isTerminal,
  OWNER,
  ROLES,
  sessionReducer,
  STATES,
  summarize,
  TERMINAL,
  transition,
  type Action,
  type ActionId,
  type DemoState,
  type DemoStatus,
} from './machine';
import { OUTSTANDING, SCENARIO, SHORTAGE } from './scenario';
import { accountingView, executiveView, viewFor, warehouseView } from './views';

/*
 * EP14: the public interactive demo. The machine and the role views are
 * tested directly (including Warehouse privacy on the data object itself);
 * the page as rendered, in every locale.
 */

beforeAll(() => {
  if (!document.querySelector('meta[name="description"]')) {
    const meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
  }
});
afterEach(() => vi.restoreAllMocks());

const LOCALES = ['th', 'en', 'zh-CN'] as const;
const THAI = /[฀-฾เ-๿]/;
const TRADITIONAL = /[們個發這開時關庫說價購資費號門運營權證統線際體與變]/;
/** Anything financial — keys or values — that must never reach the Warehouse. */
const FINANCIAL =
  /price|cost|margin|amount|value|currency|thb|baht|฿|payment|invoice|48000|36000|48,000|36,000/i;

const LOT = SCENARIO.lotOptions[0];
const act = (id: ActionId): Action => (id === 'recordLot' ? { id, lot: LOT } : { id });

/** The happy path, in the order a visitor follows it. */
const PATH: ActionId[] = [
  'checkStock',
  'requestPurchase',
  'openPo',
  'receiveGoods',
  'confirmBalance',
  'receiveBalance',
  'recordLot',
  'closeReceiving',
  'checkDocuments',
  'recordApproval',
  'pickFefo',
  'confirmDelivery',
];

function run(ids: ActionId[], from: DemoState = INITIAL) {
  let s = from;
  for (const id of ids) {
    const r = transition(s, act(id), ACTION_ROLE[id]);
    expect(r.ok, `${id} from ${s.status}`).toBe(true);
    s = r.state;
  }
  return s;
}

/** Every state, reached by the happy path. */
function stateAt(status: DemoStatus): DemoState {
  let s = INITIAL;
  for (const id of PATH) {
    if (s.status === status) return s;
    s = transition(s, act(id), ACTION_ROLE[id]).state;
  }
  expect(s.status).toBe(status);
  return s;
}

/* ------------------------------------------------------------------ */

describe('demo state machine', () => {
  it('walks the whole scenario to a terminal state', () => {
    const s = run(PATH);
    expect(s.status).toBe('DELIVERED');
    expect(isTerminal(s.status)).toBe(true);
    expect(TERMINAL).toEqual(['DELIVERED']);
  });

  it('reaches every state and leaves no dead state', () => {
    const seen = new Set<DemoStatus>([INITIAL.status]);
    let s = INITIAL;
    for (const id of PATH) {
      s = transition(s, act(id), ACTION_ROLE[id]).state;
      seen.add(s.status);
    }
    expect([...seen].sort()).toEqual([...STATES].sort());
    for (const st of STATES) {
      if (isTerminal(st)) expect(AVAILABLE[st]).toEqual([]);
      else expect(AVAILABLE[st].length, st).toBeGreaterThan(0);
    }
  });

  it('every non-terminal state has at least one action that moves the work item', () => {
    for (const st of STATES.filter((x) => !isTerminal(x))) {
      let s = stateAt(st);
      // recordLot stays in place; afterwards closeReceiving must move.
      if (st === 'RECEIVING_OPEN') s = transition(s, act('recordLot'), 'warehouse').state;
      const moves = AVAILABLE[st].filter((id) => {
        const r = transition(s, act(id), ACTION_ROLE[id]);
        return r.ok && r.state.status !== st;
      });
      expect(moves.length, st).toBeGreaterThan(0);
    }
  });

  it('rejects actions that are not available, or from the wrong role', () => {
    expect(transition(INITIAL, act('openPo'), 'purchasing')).toMatchObject({
      ok: false,
      reason: 'notAvailable',
    });
    expect(transition(INITIAL, act('checkStock'), 'warehouse')).toMatchObject({
      ok: false,
      reason: 'wrongRole',
    });
    expect(transition(INITIAL, act('checkStock'), 'executive')).toMatchObject({
      ok: false,
      reason: 'wrongRole',
    });
    const done = run(PATH);
    for (const id of PATH) expect(transition(done, act(id), ACTION_ROLE[id]).ok).toBe(false);
  });

  it('owners match the roles that act in each state', () => {
    for (const st of STATES.filter((x) => !isTerminal(x))) {
      for (const id of AVAILABLE[st]) expect(ACTION_ROLE[id], `${st}/${id}`).toBe(OWNER[st]);
    }
  });

  it('detects the shortage, the partial receipt and the 20 outstanding', () => {
    expect(SHORTAGE).toBe(100);
    expect(OUTSTANDING).toBe(20);
    const partial = stateAt('PARTIAL_RECEIPT');
    expect(partial.received).toBe(80);
    expect(partial.exception).toBe('open');
    expect(partial.trace.at(-1)).toMatchObject({ action: 'receiveGoods', exception: 'opened' });
  });

  it('PREVENT: the receipt cannot close without lot and expiry', () => {
    const open = stateAt('RECEIVING_OPEN');
    const r = transition(open, act('closeReceiving'), 'warehouse');
    expect(r).toMatchObject({ ok: false, reason: 'lotRequired' });
    expect(r.state.status).toBe('RECEIVING_OPEN');
    expect(r.state.trace.at(-1)).toMatchObject({ prevented: 'lotRequired' });
    expect(
      transition(
        open,
        { id: 'recordLot', lot: { code: 'LOT-X', expiry: '2030-01-01' } as never },
        'warehouse',
      ),
    ).toMatchObject({
      ok: false,
      reason: 'unknownLot',
    });
    const withLot = transition(r.state, act('recordLot'), 'warehouse').state;
    expect(withLot.lot).toEqual(LOT);
    expect(transition(withLot, act('closeReceiving'), 'warehouse').state.status).toBe('RECEIVED');
  });

  it('the exception opens with the partial receipt and clears when the balance arrives', () => {
    expect(stateAt('PO_OPEN').exception).toBe('none');
    expect(stateAt('BALANCE_INBOUND').exception).toBe('open');
    expect(stateAt('RECEIVING_OPEN').exception).toBe('resolved');
    expect(run(PATH).exception).toBe('resolved');
  });

  it('records a trace of every event, with handoffs and before/after', () => {
    const open = stateAt('RECEIVING_OPEN');
    const prevented = transition(open, act('closeReceiving'), 'warehouse').state;
    const s = run(PATH.slice(6), prevented);
    expect(s.trace.map((e) => e.seq)).toEqual(s.trace.map((_, i) => i + 1));
    expect(
      s.trace.filter((e) => e.handoff).map((e) => `${e.handoff!.from}>${e.handoff!.to}`),
    ).toEqual([
      'sales>purchasing',
      'purchasing>warehouse',
      'warehouse>purchasing',
      'purchasing>warehouse',
      'warehouse>accounting',
      'accounting>warehouse',
      'warehouse>sales',
    ]);
    for (const e of s.trace) {
      expect(STATES).toContain(e.before);
      expect(STATES).toContain(e.after);
    }
    expect(summarize(s)).toEqual({
      handoffs: 7,
      departments: 4,
      exceptions: 1,
      prevented: 1,
      events: 13,
    });
  });
});

describe('session', () => {
  it('switching role never changes the work item', () => {
    let s = sessionReducer(initialSession('sales'), { kind: 'start', role: 'sales' });
    s = sessionReducer(s, { kind: 'act', action: act('checkStock') });
    const state = s.state;
    for (const r of ROLES) {
      s = sessionReducer(s, { kind: 'role', role: r });
      expect(s.state).toBe(state);
    }
  });

  it('guided mode follows the work to its next owner; explore mode stays', () => {
    let s = sessionReducer(initialSession('sales'), { kind: 'start', role: 'sales' });
    s = sessionReducer(s, { kind: 'act', action: act('checkStock') });
    const guided = sessionReducer(s, { kind: 'act', action: act('requestPurchase') });
    expect(guided.role).toBe('purchasing');
    expect(guided.showHandoff).toBe(true);
    const explore = sessionReducer(sessionReducer(s, { kind: 'guided', value: false }), {
      kind: 'act',
      action: act('requestPurchase'),
    });
    expect(explore.role).toBe('sales');
    expect(explore.state.status).toBe('PURCHASE_REQUIRED');
  });

  it('reset starts the scenario over; exit returns to role selection', () => {
    let s = sessionReducer(initialSession('warehouse'), { kind: 'start', role: 'sales' });
    s = sessionReducer(s, { kind: 'act', action: act('checkStock') });
    expect(sessionReducer(s, { kind: 'reset' })).toMatchObject({ started: true, state: INITIAL });
    expect(sessionReducer(s, { kind: 'exit' })).toMatchObject({ started: false, state: INITIAL });
  });
});

/* ------------------------------------------------------------------ */

describe('role views', () => {
  it('derive a different object from the same state for every role', () => {
    const s = stateAt('PARTIAL_RECEIPT');
    const kinds = ROLES.map((r) => viewFor(r, s).kind);
    expect(kinds).toEqual([...ROLES]);
  });

  it('WAREHOUSE PRIVACY: no financial key or value in any Warehouse view, in any state', () => {
    let s = INITIAL;
    const states = [s];
    for (const id of PATH) {
      s = transition(s, act(id), ACTION_ROLE[id]).state;
      states.push(s);
    }
    for (const st of states) {
      const v = warehouseView(st);
      const json = JSON.stringify(v);
      expect(json, st.status).not.toMatch(FINANCIAL);
      const keys =
        JSON.stringify(Object.keys(v)) + JSON.stringify(v.receipt ? Object.keys(v.receipt) : []);
      expect(keys).not.toMatch(FINANCIAL);
    }
  });

  it('other roles do carry the commercial data (so the boundary is real)', () => {
    const s = stateAt('PARTIAL_RECEIPT');
    expect(JSON.stringify(viewFor('sales', s))).toMatch(/48000/);
    expect(JSON.stringify(viewFor('purchasing', s))).toMatch(/36000/);
  });

  it('warehouse view shows quantities, lots, expiry and FEFO order', () => {
    const v = warehouseView(stateAt('PICKING'));
    expect(v.lots.map((l) => [l.code, l.fefo])).toEqual([
      [SCENARIO.onHand.lot, 1],
      [LOT.code, 2],
    ]);
    expect(v.pick!.plan[0]).toEqual({ code: SCENARIO.onHand.lot, qty: SCENARIO.onHand.qty });
    expect(v.pick!.needed).toBe(120);
  });

  it('accounting is a document gate: waiting on approval, then ready', () => {
    const check = accountingView(stateAt('DOCUMENT_CHECK'));
    expect(check.documents.map((d) => [d.id, d.state])).toEqual([
      ['po', 'ready'],
      ['receipt', 'ready'],
      ['invoice', 'ready'],
      ['approval', 'waiting'],
    ]);
    expect(check.readiness).toBe('waiting');
    expect(accountingView(stateAt('PICKING')).readiness).toBe('ready');
  });

  it('executive sees one exception, then it clears — never transactions', () => {
    expect(executiveView(stateAt('PO_OPEN'))).toMatchObject({ open: 0, exception: null });
    const open = executiveView(stateAt('PARTIAL_RECEIPT'));
    expect(open).toMatchObject({
      open: 1,
      exception: { orderId: 'SO-1042', responsible: 'purchasing', outstanding: 20, status: 'open' },
    });
    expect(executiveView(stateAt('RECEIVING_OPEN'))).toMatchObject({ open: 0, resolved: 1 });
    expect(Object.keys(open).sort()).toEqual(['exception', 'flow', 'kind', 'open', 'resolved']);
  });
});

describe('copy', () => {
  it('is complete, honest and correctly localized', () => {
    const strings = (v: unknown): string[] =>
      typeof v === 'string'
        ? [v]
        : Array.isArray(v)
          ? v.flatMap(strings)
          : v && typeof v === 'object'
            ? Object.values(v).flatMap(strings)
            : [];
    const all: Localized<DemoCopy> = DEMO_COPY;
    const CLAIMS =
      /real-time|live data|ai-powered|\bAI\b|certified|guarantee|ROI|เรียลไทม์|รับประกัน|实时|保证/i;
    for (const l of LOCALES) {
      for (const s of strings(all[l])) expect(s, s).not.toMatch(CLAIMS);
      // Accounting names ledger / journal / tax only as what it is NOT.
      expect(all[l].ws.accounting.scope).toMatch(/ไม่ใช่|not|不是/);
    }
    for (const s of strings(all.en)) expect(s).not.toMatch(THAI);
    for (const s of strings(all['zh-CN'])) expect(s).not.toMatch(TRADITIONAL);
  });
});

/* ------------------------------------------------------------------ */

async function openDemo(path = '/demo') {
  const utils = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return utils;
}
const main = () => document.getElementById('main')!;
const status = () => document.querySelector('[data-work-item]')!.getAttribute('data-status');
async function startAs(name: RegExp) {
  await userEvent.click(within(main()).getByRole('radio', { name }));
  await userEvent.click(within(main()).getByRole('button', { name: /เริ่ม Demo/ }));
  await screen.findByRole('tablist');
}
async function doAction(id: ActionId) {
  const b = document.querySelector<HTMLButtonElement>(`[data-action="${id}"]`);
  expect(b, id).not.toBeNull();
  await userEvent.click(b!);
}

describe('/demo page', () => {
  it('opens publicly on an orientation and a role question — no sign-up', async () => {
    await openDemo();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('ลองดูว่า CORE ทำงานอย่างไร');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(main()).toHaveTextContent('งานหนึ่งชิ้น');
    expect(main()).toHaveTextContent('ข้อมูลจำลอง — ไม่มีการบันทึก');
    expect(within(main()).getAllByRole('radio')).toHaveLength(5);
    expect(
      main().querySelector('input[type="email"], input[type="tel"], input[type="password"]'),
    ).toBeNull();
  });

  it('runs the whole scenario in Thai with handoffs, DETECT, PREVENT, FEFO and completion', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await openDemo();
    await startAs(/ฝ่ายขาย/);
    expect(main().querySelector('[data-demo-tag]')).toHaveTextContent('DEMO');
    expect(main().querySelector('[data-disclosure]')).toHaveTextContent('ข้อมูลจำลอง');
    expect(screen.getByRole('tab', { name: /ฝ่ายขาย/ })).toHaveAttribute('aria-selected', 'true');

    await doAction('checkStock');
    expect(status()).toBe('STOCK_SHORTAGE');
    await doAction('requestPurchase');
    // Handoff: the next owner's workspace becomes active; focus lands on the handoff.
    expect(screen.getByRole('tab', { name: /จัดซื้อ/ })).toHaveAttribute('aria-selected', 'true');
    const handoff = document.querySelector('[data-handoff]')!;
    expect(handoff).toHaveTextContent('ฝ่ายขาย');
    expect(handoff).toHaveTextContent('จัดซื้อ');
    expect(handoff).toHaveTextContent('ต้องการเพิ่ม 100 ชิ้น');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'ส่งต่องาน' })).toHaveFocus());
    expect(document.querySelector('[data-announcer]')).toHaveTextContent(
      'ฝ่ายขายส่งต่องานให้จัดซื้อ',
    );

    await doAction('openPo');
    await doAction('receiveGoods');
    expect(status()).toBe('PARTIAL_RECEIPT');
    expect(document.querySelector('[data-announcer]')).toHaveTextContent(
      'รับของแล้ว 80 จาก 100 ชิ้น',
    );
    expect(document.querySelector('[data-announcer]')).toHaveTextContent('พบของค้างรับ 20 ชิ้น');
    expect(document.querySelector('[data-exception="open"]')).toHaveTextContent('ค้างรับ 20 ชิ้น');

    // Executive sees the exception — then the work goes on.
    await userEvent.click(screen.getByRole('tab', { name: /ผู้บริหาร/ }));
    expect(document.querySelector('[data-card="exception"]')).toHaveTextContent('SO-1042');
    expect(document.querySelector('[data-card="exception"]')).toHaveTextContent('จัดซื้อ');
    expect(document.querySelector('[data-task="observer"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /ไปที่มุมมองจัดซื้อ/ }));

    await doAction('confirmBalance');
    await doAction('receiveBalance');
    expect(document.querySelector('[data-exception="resolved"]')).not.toBeNull();

    // PREVENT: closing without lot / expiry is blocked.
    await doAction('closeReceiving');
    expect(status()).toBe('RECEIVING_OPEN');
    expect(screen.getByRole('alert')).toHaveTextContent('ยังปิดรับไม่ได้');
    expect(screen.getByRole('alert')).toHaveTextContent('ต้องระบุ Lot และวันหมดอายุก่อน');
    await doAction('recordLot');
    await doAction('closeReceiving');
    expect(status()).toBe('RECEIVED');

    await doAction('checkDocuments');
    expect(document.querySelector('[data-doc="approval"]')).toHaveAttribute(
      'data-state',
      'waiting',
    );
    expect(main()).toHaveTextContent('Operational finance');
    await doAction('recordApproval');

    // FEFO suggestion: the older lot first.
    expect(document.querySelector('[data-pick]')).toHaveAttribute('data-pick', SCENARIO.onHand.lot);
    expect(main()).toHaveTextContent('FEFO');
    await doAction('pickFefo');
    await doAction('confirmDelivery');
    expect(status()).toBe('DELIVERED');

    const done = document.querySelector('[data-completion]')!;
    expect(done).toHaveTextContent('SO-1042 เสร็จสมบูรณ์');
    const stat = (k: string) => done.querySelector(`[data-stat="${k}"] dd`)!.textContent;
    expect([
      stat('handoffs'),
      stat('departments'),
      stat('exceptions'),
      stat('prevented'),
      stat('events'),
    ]).toEqual(['7', '4', '1', '1', '13']);
    expect(done.querySelector('[data-cta="contact"]')).toHaveAttribute(
      'href',
      '/contact?interest=demo',
    );
    expect(done.querySelector('[data-cta="pricing"]')).toHaveAttribute('href', '/pricing');
    expect(main().textContent).not.toMatch(/🎉|confetti/i);
    expect(fetchSpy).not.toHaveBeenCalled();

    // History: every event, with handoffs and the prevented attempt.
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-history-toggle]')!);
    expect(document.querySelectorAll('[data-history] tbody tr')).toHaveLength(13);
    expect(document.querySelector('[data-history] [data-prevented]')).not.toBeNull();

    await userEvent.click(within(done as HTMLElement).getByRole('button', { name: /ลองใหม่/ }));
    expect(status()).toBe('ORDER_RECEIVED');
  }, 30000);

  it('switching role keeps the progress and shows each role its own boundary', async () => {
    await openDemo('/demo?role=warehouse');
    expect(within(main()).getByRole('radio', { name: /คลังสินค้า/ })).toBeChecked();
    await userEvent.click(within(main()).getByRole('button', { name: /เริ่ม Demo/ }));
    expect(screen.getByRole('tab', { name: /คลังสินค้า/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(document.querySelector('[data-task="elsewhere"]')).not.toBeNull();
    expect(document.querySelector('[data-boundary="warehouse"]')).toHaveTextContent('ราคาขาย');
    expect(document.querySelector('[data-no-finance]')).not.toBeNull();
    const ws = main().querySelector('[data-workspace="warehouse"]')!.cloneNode(true) as HTMLElement;
    ws.querySelector('[data-no-finance]')?.remove();
    expect(ws.textContent).not.toMatch(/฿|THB|มูลค่า|ราคา|ต้นทุน/);
    // Keyboard role switching (arrow keys), progress unchanged.
    screen.getByRole('tab', { name: /คลังสินค้า/ }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /ฝ่ายขาย/ })).toHaveAttribute('aria-selected', 'true');
    await doAction('checkStock');
    screen.getByRole('tab', { selected: true }).focus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /ผู้บริหาร/ })).toHaveAttribute('aria-selected', 'true');
    expect(status()).toBe('STOCK_SHORTAGE');
    expect(document.querySelector('[data-boundary="executive"]')).toHaveTextContent('ทุกธุรกรรม');
  });

  it('shows final states without motion and keeps every label', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    await openDemo();
    await startAs(/ฝ่ายขาย/);
    await doAction('checkStock');
    expect(document.querySelector('[data-stages]')!.querySelectorAll('li')).toHaveLength(7);
    expect(document.querySelector('[data-stage-state="current"]')).toHaveTextContent('ตรวจ Stock');
    window.matchMedia = original;
  });
});

describe('localization', () => {
  it('runs a representative path in English without Thai', async () => {
    await openDemo('/en/demo');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('See how CORE works');
    await userEvent.click(within(main()).getByRole('button', { name: /Start the demo/ }));
    await doAction('checkStock');
    await doAction('requestPurchase');
    await doAction('openPo');
    await doAction('receiveGoods');
    expect(document.querySelector('[data-announcer]')).toHaveTextContent('Received 80 of 100');
    const text = main().textContent ?? '';
    expect(text).not.toMatch(THAI);
    expect(text).toContain('Sample data — nothing is saved');
  });

  it('runs a representative path in Simplified Chinese without Thai or Traditional', async () => {
    await openDemo('/zh/demo');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('看看 CORE 如何运作');
    await userEvent.click(within(main()).getByRole('button', { name: /开始演示/ }));
    await doAction('checkStock');
    await doAction('requestPurchase');
    const text = main().textContent ?? '';
    expect(text).not.toMatch(THAI);
    expect(text).not.toMatch(TRADITIONAL);
    expect(document.querySelector('[data-handoff]')).toHaveTextContent('销售');
  });

  it('gives each locale a unique title and description', async () => {
    const seen = new Set<string>();
    for (const path of ['/demo', '/en/demo', '/zh/demo']) {
      const { unmount } = await openDemo(path);
      await waitFor(() => expect(document.title).toContain('|'));
      seen.add(document.title);
      seen.add(document.querySelector('meta[name="description"]')!.getAttribute('content')!);
      unmount();
    }
    expect(seen.size).toBe(6);
  });
});

describe('discoverability', () => {
  it('the How CORE works menu, page CTA and department pages link to the demo', async () => {
    const { unmount } = renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'เมนูหลัก' });
    await userEvent.click(within(nav).getByRole('button', { name: 'วิธีการทำงาน' }));
    expect(document.querySelector('header a[href="/demo"]')).toHaveTextContent('ทดลองใช้งาน CORE');
    unmount();

    const how = renderRoute('/how-core-works');
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelector('[data-cta="try-demo"]')).toHaveAttribute('href', '/demo');
    how.unmount();

    const dept = renderRoute('/zh/departments/warehouse');
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelector('[data-cta="try-role"]')).toHaveAttribute(
      'href',
      '/zh/demo?role=warehouse',
    );
    dept.unmount();

    const ops = renderRoute('/departments/operations');
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelector('[data-cta="try-role"]')).toBeNull();
    ops.unmount();
  }, 20000);
});
