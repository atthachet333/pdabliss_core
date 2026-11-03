import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext } from '@/features/company-center/api';
import type { BranchInfo } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { Adjustment, Count, Transfer } from './ctlApi';
import type { MovementRow, WarehouseContext } from './whApi';

/*
 * EP32 inventory-control screens (UI): transfers, adjustments and cycle counts
 * show only the actions the server lists, ask before every stock-changing step
 * (with a reason where one is required), send exact decimal strings (0 is a
 * count), and show server refusals in words. The movement ledger labels every
 * EP32 movement and links its document. The server enforces everything again
 * (backend/test/inventory-control.test.ts); nothing here shows a price.
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
const MAIN = { id: 'l-main', code: 'MAIN', name: 'Main' };
const QC = { id: 'l-qc', code: 'QC', name: 'QC hold' };
const ITEM = {
  id: 'i1',
  code: 'PK-000001',
  name: 'Box',
  lotTracking: 'NONE' as const,
  expiryTracking: 'NONE' as const,
};
const UNIT = { code: 'PCS', precision: 0 };
const W = '/api/v1/warehouse';
const MONEY = /price|cost|amount|value|฿|THB/i;

const person = (role: CompanyRole, permissions: string[]) => ({
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
    departments: ['WAREHOUSE'],
    permissions: permissions as BranchContext['permissions'],
  } satisfies BranchContext),
});

const ctx = (manager: boolean): WarehouseContext => ({
  receiving: { view: true, process: true, cancel: manager },
  inventory: { view: true },
  transfers: { create: true, approve: manager, cancel: manager },
  adjustments: { create: true, approve: manager },
  cycleCounts: { create: true, approve: manager },
  branches: [{ ...REF, type: 'BRANCH' }],
  selectedBranch: { ...REF, type: 'BRANCH' },
  locations: [
    { ...MAIN, branchId: 'b1', isDefault: true },
    { ...QC, branchId: 'b1', isDefault: false },
  ],
  counts: {
    pendingReceive: 0,
    draftReceipts: 0,
    stockRows: 2,
    expiring: 0,
    expired: 0,
    draftTransfers: 1,
    submittedAdjustments: 1,
    activeCounts: 1,
  },
  expiringSoonDays: 30,
  today: '2026-11-03',
});

const STAFF = [
  'warehouse.workspace.view',
  'warehouse.inventory.view',
  'warehouse.transfers.create',
  'warehouse.stock_adjustment.create',
  'warehouse.counts.create',
];
const as = (manager: boolean, extra: Parameters<typeof fakeApi>[0] = {}) => ({
  ...person(
    manager ? 'DEPARTMENT_MANAGER' : 'DEPARTMENT_STAFF',
    manager
      ? [
          ...STAFF,
          'warehouse.transfers.approve',
          'warehouse.transfers.cancel',
          'warehouse.stock_adjustment.approve',
          'warehouse.counts.approve',
        ]
      : STAFF,
  ),
  [`GET ${W}/context`]: ok(ctx(manager)),
  ...extra,
});

const common = {
  branch: REF,
  createdBy: { name: 'Demo Warehouse' },
  updatedAt: '2026-11-03T02:00:00.000Z',
  createdAt: '2026-11-03T02:00:00.000Z',
  note: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
};
const transfer = (over: Partial<Transfer> = {}): Transfer => ({
  ...common,
  id: 't1',
  number: 'TR-202611-000001',
  status: 'DRAFT',
  source: MAIN,
  destination: QC,
  transferDate: '2026-11-03',
  lineCount: 1,
  postedAt: null,
  postedBy: null,
  lines: [
    {
      id: 'tl1',
      lineNo: 1,
      item: ITEM,
      unit: UNIT,
      lot: null,
      quantity: '4',
      available: '10',
      note: null,
    },
  ],
  actions: ['edit', 'cancel'],
  ...over,
});
const adjustment = (over: Partial<Adjustment> = {}): Adjustment => ({
  ...common,
  id: 'a1',
  number: 'ADJ-202611-000001',
  status: 'SUBMITTED',
  reason: 'DAMAGE',
  adjustmentDate: '2026-11-03',
  locations: ['MAIN'],
  lineCount: 1,
  approvedBy: null,
  submittedAt: '2026-11-03T02:00:00.000Z',
  submittedBy: { name: 'Demo Warehouse' },
  approvedAt: null,
  rejectedAt: null,
  rejectedBy: null,
  rejectionReason: null,
  lines: [
    {
      id: 'al1',
      lineNo: 1,
      direction: 'DECREASE',
      location: MAIN,
      item: ITEM,
      unit: UNIT,
      lot: null,
      newLot: null,
      quantity: '3',
      onHand: '10',
      note: null,
    },
  ],
  actions: [],
  ...over,
});
const count = (over: Partial<Count> = {}): Count => ({
  ...common,
  id: 'c1',
  number: 'CC-202611-000001',
  status: 'COUNTING',
  locations: [MAIN],
  item: null,
  countDate: '2026-11-03',
  lineCount: 2,
  countedLines: 0,
  varianceLines: 0,
  startedAt: '2026-11-03T02:00:00.000Z',
  startedBy: { name: 'Demo Warehouse' },
  reviewAt: null,
  postedAt: null,
  postedBy: null,
  lines: [
    {
      id: 'cl1',
      lineNo: 1,
      location: MAIN,
      item: ITEM,
      unit: UNIT,
      lot: null,
      newLot: null,
      expected: true,
      systemQuantity: '10',
      countedQuantity: null,
      variance: null,
      countedBy: null,
      countedAt: null,
      note: null,
    },
    {
      id: 'cl2',
      lineNo: 2,
      location: MAIN,
      item: { ...ITEM, id: 'i2', code: 'FG-000001' },
      unit: UNIT,
      lot: null,
      newLot: null,
      expected: true,
      systemQuantity: '6',
      countedQuantity: null,
      variance: null,
      countedBy: null,
      countedAt: null,
      note: null,
    },
  ],
  actions: ['count', 'review', 'cancel'],
  ...over,
});
const tl = (type: string) => [
  { type, at: '2026-11-03T02:00:00.000Z', actor: { name: 'Demo Warehouse' } },
];

describe('Inventory control (EP32)', () => {
  it('a staff member drafts a transfer but cannot post it; a manager posts after confirming', async () => {
    fakeApi(
      as(false, {
        [`GET ${W}/transfers/t1`]: ok({ transfer: transfer(), timeline: tl('TRANSFER_CREATED') }),
      }),
    );
    const { unmount } = renderRoute('/core/warehouse/transfers/t1?lang=en');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'TR-202611-000001' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post transfer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save lines' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(MONEY);
    unmount();

    let current = transfer({ actions: ['edit', 'post', 'cancel'] });
    const api = fakeApi(
      as(true, {
        [`GET ${W}/transfers/t1`]: () =>
          ok({ transfer: current, timeline: tl('TRANSFER_CREATED') }),
        [`POST ${W}/transfers/t1/post`]: () => {
          current = transfer({
            status: 'POSTED',
            actions: ['cancel'],
            postedAt: '2026-11-03T03:00:00.000Z',
            postedBy: { name: 'Manager' },
          });
          return ok({ transfer: current, timeline: tl('TRANSFER_POSTED') });
        },
      }),
    );
    renderRoute('/core/warehouse/transfers/t1?lang=en');
    await userEvent.click(await screen.findByRole('button', { name: 'Post transfer' }));
    expect(screen.getByText('Move the stock now?')).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'Post transfer' }),
    );
    await waitFor(() =>
      expect(document.querySelector('[data-doc-status="POSTED"]')).not.toBeNull(),
    );
    expect(api.calls.some((c) => c.method === 'POST' && c.path === `${W}/transfers/t1/post`)).toBe(
      true,
    );
    // A posted transfer offers only the reversal, which needs a reason.
    expect(screen.getByRole('button', { name: 'Cancel and reverse' })).toBeInTheDocument();
  });

  it('the server’s refusal is shown in words (insufficient stock, TH)', async () => {
    fakeApi(
      as(true, {
        [`GET ${W}/transfers/t1`]: ok({
          transfer: transfer({ actions: ['edit', 'post', 'cancel'] }),
          timeline: [],
        }),
        [`POST ${W}/transfers/t1/post`]: fail(409, 'INSUFFICIENT_STOCK'),
      }),
    );
    renderRoute('/core/warehouse/transfers/t1?lang=th');
    await userEvent.click(await screen.findByRole('button', { name: 'บันทึกโอนย้าย' }));
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'บันทึกโอนย้าย' }),
    );
    expect(await screen.findByText('สต็อกไม่พอ')).toBeInTheDocument();
  });

  it('a manager approves a submitted adjustment; rejecting needs a reason', async () => {
    let current = adjustment({ actions: ['approve', 'reject', 'cancel'] });
    const api = fakeApi(
      as(true, {
        [`GET ${W}/adjustments/a1`]: () =>
          ok({ adjustment: current, timeline: tl('ADJUSTMENT_SUBMITTED') }),
        [`POST ${W}/adjustments/a1/reject`]: (body) => {
          current = adjustment({
            status: 'REJECTED',
            rejectionReason: (body as { reason: string }).reason,
          });
          return ok({ adjustment: current, timeline: tl('ADJUSTMENT_REJECTED') });
        },
      }),
    );
    renderRoute('/core/warehouse/adjustments/a1?lang=en');
    expect(await screen.findByText('Damage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve and post' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const box = screen.getByRole('group');
    await userEvent.click(within(box).getByRole('button', { name: 'Reject' }));
    expect(api.calls.some((c) => c.path.endsWith('/reject'))).toBe(false);
    await userEvent.type(within(box).getByRole('textbox'), 'Recount first');
    await userEvent.click(within(box).getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(document.querySelector('[data-doc-status="REJECTED"]')).not.toBeNull(),
    );
    expect(api.calls.find((c) => c.path.endsWith('/reject'))?.body).toEqual({
      reason: 'Recount first',
    });
  });

  it('a new adjustment with the reason Other needs a note before it can be created', async () => {
    fakeApi(as(false));
    renderRoute('/core/warehouse/adjustments/new?lang=en');
    const create = await screen.findByRole('button', { name: 'Create' });
    await userEvent.selectOptions(screen.getByLabelText('Reason'), 'OTHER');
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Note'), 'Audit fix');
    expect(create).toBeEnabled();
  });

  it('counting: the scope is locked, 0 is a count, only changed lines are sent (ZH)', async () => {
    const api = fakeApi(
      as(false, {
        [`GET ${W}/counts/c1`]: ok({ count: count(), timeline: tl('CYCLE_COUNT_STARTED') }),
        [`PUT ${W}/counts/c1/entries`]: ok({
          count: count({
            countedLines: 1,
            varianceLines: 1,
            lines: [
              { ...count().lines[0]!, countedQuantity: '0', variance: '-10' },
              count().lines[1]!,
            ],
          }),
          timeline: tl('CYCLE_COUNT_COUNTED'),
        }),
      }),
    );
    renderRoute('/core/warehouse/counts/c1?lang=zh-CN');
    expect(await screen.findByText(/盘点中：这些库位的库存/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '过账盘点' })).toBeNull();
    await userEvent.type(screen.getByLabelText('实盘数量 #1'), '0');
    await userEvent.click(screen.getByRole('button', { name: '保存盘点数量' }));
    await waitFor(() =>
      expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
        entries: [{ lineId: 'cl1', countedQuantity: '0' }],
      }),
    );
    expect(await screen.findByText('−10')).toBeInTheDocument();
  });

  it('a manager posts a reviewed count; a stale count is refused in words', async () => {
    fakeApi(
      as(true, {
        [`GET ${W}/counts/c1`]: ok({
          count: count({ status: 'REVIEW', actions: ['reopen', 'post', 'cancel'] }),
          timeline: tl('CYCLE_COUNT_REVIEWED'),
        }),
        [`POST ${W}/counts/c1/post`]: fail(409, 'COUNT_STALE'),
      }),
    );
    renderRoute('/core/warehouse/counts/c1?lang=en');
    await userEvent.click(await screen.findByRole('button', { name: 'Post count' }));
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', {
        name: 'Post count',
      }),
    );
    expect(await screen.findByText(/Stock changed after counting started/)).toBeInTheDocument();
  });

  it('movements: EP32 types are labelled and link their documents', async () => {
    const mv = (over: Partial<MovementRow>): MovementRow => ({
      id: 'm',
      occurredAt: '2026-11-03T02:00:00.000Z',
      type: 'TRANSFER_OUT',
      quantityDelta: '-4',
      branch: REF,
      location: MAIN,
      item: { id: 'i1', code: 'PK-000001', name: 'Box' },
      unit: { code: 'PCS' },
      lot: null,
      source: {
        type: 'TRANSFER',
        receipt: null,
        order: null,
        transfer: null,
        adjustment: null,
        count: null,
      },
      actor: { name: 'Manager' },
      ...over,
    });
    fakeApi(
      as(false, {
        [`GET ${W}/movements`]: ok({
          items: [
            mv({
              id: 'm1',
              source: { ...mv({}).source, transfer: { id: 't1', number: 'TR-202611-000001' } },
            }),
            mv({
              id: 'm2',
              type: 'COUNT_CORRECTION',
              quantityDelta: '-1',
              source: {
                ...mv({}).source,
                type: 'CYCLE_COUNT',
                count: { id: 'c1', number: 'CC-202611-000001' },
              },
            }),
            mv({
              id: 'm3',
              type: 'ADJUSTMENT_IN',
              quantityDelta: '2',
              source: {
                ...mv({}).source,
                type: 'ADJUSTMENT',
                adjustment: { id: 'a1', number: 'ADJ-202611-000001' },
              },
            }),
          ],
          total: 3,
          page: 1,
          hasMore: false,
        }),
      }),
    );
    renderRoute('/core/warehouse/movements?lang=en');
    expect(
      (await screen.findByRole('link', { name: 'TR-202611-000001' })).getAttribute('href'),
    ).toContain('/core/warehouse/transfers/t1');
    expect(screen.getByRole('link', { name: 'CC-202611-000001' }).getAttribute('href')).toContain(
      '/core/warehouse/counts/c1',
    );
    expect(screen.getByRole('link', { name: 'ADJ-202611-000001' }).getAttribute('href')).toContain(
      '/core/warehouse/adjustments/a1',
    );
    expect(screen.getAllByText('Count correction').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Adjustment increase').length).toBeGreaterThan(0);
  });
});
