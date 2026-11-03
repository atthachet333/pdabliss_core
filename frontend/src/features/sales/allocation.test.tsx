import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext } from '@/features/company-center/api';
import type { BranchInfo } from '@/features/company/api';
import type { PickOrder, StockRow, WarehouseContext } from '@/features/warehouse/whApi';
import { fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { SalesContext, SalesOrder, SoLine } from './salesApi';

/*
 * EP34 allocation screens (UI): a confirmed order's allocation (ordered /
 * reserved / short, state and pick readiness, shortage shown first), the
 * manager's allocate / allocate again / release — each asked first, no body
 * sent — and staff seeing progress only; Warehouse Pending Pick (where the
 * reserved stock is, never money or customers) and the inventory's on hand /
 * reserved / available. The server enforces everything again
 * (backend/test/sales-allocation.test.ts).
 */

const X: BranchInfo = {
  id: 'b1',
  code: '00001',
  name: 'Demo Branch',
  type: 'BRANCH',
  status: 'ACTIVE',
  address: {
    line1: '1 Road',
    line2: null,
    subdistrict: null,
    district: 'Demo',
    province: 'Bangkok',
    postalCode: '10110',
    countryCode: 'TH',
  },
  phone: null,
  deactivatedAt: null,
  createdAt: '2026-10-20T03:00:00.000Z',
  updatedAt: '2026-10-20T03:00:00.000Z',
};
const REF = { id: 'b1', code: '00001', name: 'Demo Branch' };
const S = '/api/v1/sales';
const W = '/api/v1/warehouse';
const MONEY = /price|amount|discount|tax|total|฿|THB|185|customer|Demo Shop/i;

const person = (role: CompanyRole, permissions: string[], departments: string[]) => ({
  ...signedIn(
    identity({ company: { id: 'c1', name: 'Alpha', isDemo: false, role, canEnterCore: true } }),
  ),
  'GET /api/v1/company/context': ok({
    company: { id: 'c1', displayName: 'Alpha' },
    role,
    scope: 'SELECTED_BRANCHES',
    branches: [X],
    selected: X,
    needsSelection: false,
    blocked: null,
    departments: departments as BranchContext['departments'],
    permissions: permissions as BranchContext['permissions'],
  } satisfies BranchContext),
});

const salesCtx = (manager: boolean): SalesContext => ({
  orders: { view: true, create: true, confirm: manager, cancel: manager },
  branches: [{ ...REF, type: 'BRANCH' }],
  selectedBranch: { ...REF, type: 'BRANCH' },
  counts: { myDrafts: 0, awaitingConfirmation: 0, confirmed: 1, withShortage: 1 },
  today: '2026-11-03',
});
const STAFF = ['sales.workspace.view', 'sales.orders.view', 'sales.orders.create'];
const sales = (manager: boolean, extra: Parameters<typeof fakeApi>[0] = {}) => ({
  ...person(
    manager ? 'DEPARTMENT_MANAGER' : 'DEPARTMENT_STAFF',
    manager ? [...STAFF, 'sales.orders.approve', 'sales.orders.cancel'] : STAFF,
    ['SALES'],
  ),
  [`GET ${S}/context`]: ok(salesCtx(manager)),
  ...extra,
});

const line = (over: Partial<SoLine> = {}): SoLine => ({
  id: 'l1',
  lineNo: 1,
  item: {
    id: 'i1',
    code: 'FG-000001',
    name: 'Serum',
    type: 'FINISHED_GOOD',
    inventoryTracked: true,
  },
  unit: { code: 'PCS', name: 'Piece', precision: 0 },
  quantity: '100',
  unitPrice: '185',
  discountAmount: '0.00',
  taxRate: '7',
  lineSubtotal: '18500.00',
  lineTax: '1295.00',
  lineTotal: '19795.00',
  note: null,
  availability: {
    state: 'PARTIALLY_AVAILABLE',
    onHand: '60',
    reserved: '60',
    available: '0',
    shortage: '40',
  },
  allocation: { allocated: '60', shortage: '40' },
  progress: { ordered: '100', allocated: '60', picked: null, delivered: null, outstanding: null },
  ...over,
});
const order = (over: Partial<SalesOrder> = {}): SalesOrder => ({
  id: 'o1',
  number: 'SO-202611-000006',
  status: 'CONFIRMED',
  branch: REF,
  customer: { id: 'cu1', code: 'CUS-000001', name: 'Demo Shop', taxId: null, taxBranch: null },
  orderDate: '2026-11-03',
  requestedDate: '2026-11-10',
  lineCount: 2,
  currency: 'THB',
  grandTotal: '19795.00',
  availability: 'PARTIALLY_AVAILABLE',
  allocationState: 'PARTIALLY_ALLOCATED',
  pickReadiness: 'PARTIALLY_READY',
  createdBy: { name: 'Owner' },
  updatedAt: '2026-11-03T02:00:00.000Z',
  customerReference: null,
  note: null,
  subtotal: '18500.00',
  discountTotal: '0.00',
  taxTotal: '1295.00',
  taxTotalLabel: 'exclusive',
  shortageLines: 1,
  createdAt: '2026-11-03T02:00:00.000Z',
  submittedAt: '2026-11-03T02:00:00.000Z',
  submittedBy: { name: 'Owner' },
  confirmedAt: '2026-11-03T02:10:00.000Z',
  confirmedBy: { name: 'Owner' },
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  lines: [
    line(),
    line({
      id: 'l2',
      lineNo: 2,
      item: {
        id: 's1',
        code: 'SVC-1',
        name: 'Installation',
        type: 'NON_STOCK',
        inventoryTracked: false,
      },
      quantity: '1',
      availability: {
        state: 'NOT_STOCK_TRACKED',
        onHand: null,
        reserved: null,
        available: null,
        shortage: null,
      },
      allocation: null,
      progress: { ordered: '1', allocated: null, picked: null, delivered: null, outstanding: null },
    }),
  ],
  actions: ['cancel', 'allocate', 'release', 'reallocate'],
  ...over,
});
const tl = (...types: string[]) =>
  types.map((type) => ({ type, at: '2026-11-03T02:00:00.000Z', actor: { name: 'Owner' } }));

const whCtx: WarehouseContext = {
  receiving: { view: true, process: true, cancel: false },
  inventory: { view: true },
  transfers: { create: true, approve: false, cancel: false },
  adjustments: { create: true, approve: false },
  cycleCounts: { create: true, approve: false },
  branches: [{ ...REF, type: 'BRANCH' }],
  selectedBranch: { ...REF, type: 'BRANCH' },
  locations: [{ id: 'l-main', code: 'MAIN', name: 'Main', branchId: 'b1', isDefault: true }],
  counts: {
    pendingReceive: 0,
    draftReceipts: 0,
    stockRows: 1,
    expiring: 0,
    expired: 0,
    draftTransfers: 0,
    submittedAdjustments: 0,
    activeCounts: 0,
    pendingPick: 1,
  },
  expiringSoonDays: 30,
  today: '2026-11-03',
};
const warehouse = (extra: Parameters<typeof fakeApi>[0] = {}) => ({
  ...person(
    'DEPARTMENT_STAFF',
    ['warehouse.workspace.view', 'warehouse.inventory.view', 'warehouse.receiving.view'],
    ['WAREHOUSE'],
  ),
  [`GET ${W}/context`]: ok(whCtx),
  ...extra,
});
const pick: PickOrder = {
  id: 'o1',
  number: 'SO-202611-000006',
  branch: REF,
  orderDate: '2026-11-03',
  requestedDate: '2026-11-10',
  confirmedAt: '2026-11-03T02:10:00.000Z',
  readiness: 'PARTIALLY_READY',
  lines: [
    {
      lineNo: 1,
      item: { id: 'i1', code: 'FG-000001', name: 'Serum' },
      unit: { code: 'PCS' },
      ordered: '100',
      allocated: '60',
      shortage: '40',
      picks: [
        {
          location: { id: 'l-main', code: 'MAIN', name: 'Main' },
          lot: { lotNumber: 'FG-A', expiryDate: '2026-11-15' },
          expiryState: 'EXPIRING_SOON',
          quantity: '40',
        },
        {
          location: { id: 'l-qc', code: 'QC', name: 'QC' },
          lot: { lotNumber: 'FG-B', expiryDate: '2026-12-01' },
          expiryState: 'OK',
          quantity: '20',
        },
      ],
    },
  ],
};

describe('Sales allocation (EP34)', () => {
  it('a manager sees ordered / reserved / short and allocates after confirming — no body sent', async () => {
    let current = order();
    const api = fakeApi(
      sales(true, {
        [`GET ${S}/orders/o1`]: () =>
          ok({ order: current, timeline: tl('SALES_ALLOCATION_CREATED') }),
        [`POST ${S}/orders/o1/allocate`]: () => {
          current = order({
            allocationState: 'FULLY_ALLOCATED',
            pickReadiness: 'READY',
            lines: [line({ allocation: { allocated: '100', shortage: '0' } }), order().lines[1]!],
            actions: ['cancel', 'release', 'reallocate'],
          });
          return ok({
            order: current,
            timeline: tl('SALES_ALLOCATION_CREATED', 'SALES_ORDER_FULLY_ALLOCATED'),
            allocation: {
              state: 'FULLY_ALLOCATED',
              pickReadiness: 'READY',
              allocatedNow: '40',
              lines: [
                {
                  lineNo: 1,
                  ordered: '100',
                  allocatedNow: '40',
                  totalAllocated: '100',
                  shortage: '0',
                },
              ],
            },
          });
        },
      }),
    );
    renderRoute('/core/sales/orders/o1?lang=en');
    const section = (await screen.findByRole('heading', { name: 'Allocation' })).closest(
      'section',
    )!;
    expect(within(section).getByText('Partly allocated')).toBeInTheDocument();
    expect(within(section).getByText('Partly ready')).toBeInTheDocument();
    // Shortage first; the service line is not part of allocation.
    expect(within(section).getByText('FG-000001: Short 40 PCS')).toBeInTheDocument();
    expect(within(section).queryByText(/SVC-1/)).toBeNull();
    const row = section.querySelector('[data-allocation-line="1"]') as HTMLElement;
    expect(within(row).getByText('Reserved')).toBeInTheDocument();
    expect(row.textContent).toMatch(/Ordered100 PCS.*Reserved60 PCS.*Short40 PCS/);
    // Never a location or lot on the Sales side.
    expect(section.textContent).not.toMatch(/MAIN|lot/i);
    await userEvent.click(within(section).getByRole('button', { name: 'Allocate' }));
    expect(within(section).getByText(/Reserve available stock, FEFO/)).toBeInTheDocument();
    await userEvent.click(
      within(within(section).getByRole('group')).getByRole('button', { name: 'Allocate' }),
    );
    await waitFor(() =>
      expect(document.querySelector('[data-allocation-state="FULLY_ALLOCATED"]')).not.toBeNull(),
    );
    expect(api.called(`POST ${S}/orders/o1/allocate`)[0]!.body).toEqual({});
    expect(screen.getByText('Stock reserved — fully allocated')).toBeInTheDocument();
    expect(screen.getByText('Ready to pick')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Allocate' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Allocate again' })).toBeInTheDocument();
  });

  it('release asks first; staff see progress only (TH)', async () => {
    let current = order({ allocationState: 'FULLY_ALLOCATED', pickReadiness: 'READY' });
    const api = fakeApi(
      sales(true, {
        [`GET ${S}/orders/o1`]: () => ok({ order: current, timeline: [] }),
        [`POST ${S}/orders/o1/release`]: () => {
          current = order({
            allocationState: 'NOT_ALLOCATED',
            pickReadiness: 'NOT_READY',
            lines: [line({ allocation: { allocated: '0', shortage: '100' } }), order().lines[1]!],
            actions: ['cancel', 'allocate'],
          });
          return ok({ order: current, timeline: tl('SALES_ALLOCATION_RELEASED') });
        },
      }),
    );
    const { unmount } = renderRoute('/core/sales/orders/o1?lang=th');
    await userEvent.click(await screen.findByRole('button', { name: 'ปลดการจอง' }));
    expect(screen.getByText(/สต็อกจะกลับไปพร้อมใช้/)).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'ปลดการจอง' }),
    );
    await waitFor(() => expect(api.called(`POST ${S}/orders/o1/release`)).toHaveLength(1));
    expect(await screen.findByText('ปลดการจองแล้ว')).toBeInTheDocument();
    expect(screen.getByText('ยังไม่จอง')).toBeInTheDocument();
    unmount();

    fakeApi(
      sales(false, { [`GET ${S}/orders/o1`]: ok({ order: order({ actions: [] }), timeline: [] }) }),
    );
    renderRoute('/core/sales/orders/o1?lang=en');
    const section = (await screen.findByRole('heading', { name: 'Allocation' })).closest(
      'section',
    )!;
    expect(within(section).queryByRole('button')).toBeNull();
    expect(
      within(section).getByText('A sales manager allocates or releases stock.'),
    ).toBeInTheDocument();
    expect(within(section).getByText('FG-000001: Short 40 PCS')).toBeInTheDocument();
  });

  it('the list shows the allocation state of confirmed orders (ZH)', async () => {
    const row = {
      ...order(),
      lines: undefined,
    } as unknown as SalesOrder;
    fakeApi(
      sales(true, {
        [`GET ${S}/orders`]: ok({ items: [row], total: 1, page: 1, pageSize: 25, hasMore: false }),
      }),
    );
    renderRoute('/core/sales?lang=zh');
    expect(await screen.findByText('部分分配')).toBeInTheDocument();
  });
});

describe('Warehouse Pending Pick and reserved stock (EP34)', () => {
  it('Pending Pick shows where reserved stock is, read-only, with no money or customer', async () => {
    const api = fakeApi(
      warehouse({
        [`GET ${W}/pending-pick`]: (_b, q) =>
          ok({
            items: q.get('readiness') === 'READY' ? [] : [pick],
            total: q.get('readiness') === 'READY' ? 0 : 1,
            page: 1,
            pageSize: 20,
            hasMore: false,
            today: '2026-11-03',
          }),
      }),
    );
    renderRoute('/core/warehouse/pending-pick?lang=en');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pending pick' }),
    ).toBeInTheDocument();
    const card = (await screen.findByText('SO-202611-000006')).closest('li')!;
    expect(within(card).getByText('Partly ready')).toBeInTheDocument();
    expect(card.textContent).toMatch(/Ordered 100 · Reserved 60 PCS · Short 40/);
    expect(within(card).getByText('FG-A')).toBeInTheDocument();
    expect(within(card).getByText('QC')).toBeInTheDocument();
    expect(within(card).getByText('40 PCS')).toBeInTheDocument();
    expect(card.querySelector('[data-expiry-state="EXPIRING_SOON"]')).not.toBeNull();
    // Read-only: nothing to press on the card; nothing commercial on the page.
    expect(within(card).queryByRole('button')).toBeNull();
    expect(document.getElementById('main')!.textContent).not.toMatch(MONEY);
    await userEvent.selectOptions(screen.getByLabelText('Readiness'), 'READY');
    await waitFor(() =>
      expect(screen.getByText('No sales orders are waiting to be picked.')).toBeInTheDocument(),
    );
    expect(
      api.calls.some((c) => c.path === `${W}/pending-pick` && c.query.readiness === 'READY'),
    ).toBe(true);
    expect(screen.getByRole('link', { name: 'Pending pick' })).toHaveAttribute(
      'href',
      '/core/warehouse/pending-pick',
    );
  });

  it('speaks Thai and Chinese', async () => {
    fakeApi(
      warehouse({
        [`GET ${W}/pending-pick`]: ok({
          items: [pick],
          total: 1,
          page: 1,
          pageSize: 20,
          hasMore: false,
          today: '2026-11-03',
        }),
      }),
    );
    const { unmount } = renderRoute('/core/warehouse/pending-pick?lang=th');
    expect(await screen.findByText('พร้อมบางส่วน')).toBeInTheDocument();
    unmount();
    renderRoute('/core/warehouse/pending-pick?lang=zh');
    expect(await screen.findByText('部分就绪')).toBeInTheDocument();
  });

  it('inventory shows on hand, reserved and available; the tile leads to Pending Pick', async () => {
    const row: StockRow = {
      id: 's1',
      branch: REF,
      location: { id: 'l-main', code: 'MAIN', name: 'Main' },
      item: {
        id: 'i1',
        code: 'FG-000001',
        name: 'Serum',
        lotTracking: 'REQUIRED',
        expiryTracking: 'REQUIRED',
      },
      unit: { code: 'PCS' },
      lot: { id: 'lot1', lotNumber: 'FG-A', expiryDate: '2026-11-15', manufacturedDate: null },
      quantityOnHand: '100',
      quantityReserved: '60',
      quantityAvailable: '40',
      expiryState: 'EXPIRING_SOON',
      daysToExpiry: 12,
      firstReceivedAt: '2026-11-01T02:00:00.000Z',
      updatedAt: '2026-11-01T02:00:00.000Z',
    };
    fakeApi(
      warehouse({
        [`GET ${W}/stock`]: ok({
          items: [row],
          total: 1,
          page: 1,
          pageSize: 25,
          hasMore: false,
          today: '2026-11-03',
          expiringSoonDays: 30,
        }),
      }),
    );
    const { unmount } = renderRoute('/core/warehouse/inventory?lang=en');
    const tr = (await screen.findByText('FG-A')).closest('tr')!;
    expect(within(tr).getByText('60')).toHaveAttribute('data-reserved', '60');
    expect(within(tr).getByText('40')).toHaveAttribute('data-available', '40');
    expect(screen.getByRole('columnheader', { name: 'Reserved' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Available' })).toBeInTheDocument();
    unmount();
    renderRoute('/core/warehouse?lang=en');
    expect(await screen.findByRole('link', { name: /Sales orders to pick/ })).toHaveAttribute(
      'href',
      '/core/warehouse/pending-pick',
    );
  });
});
