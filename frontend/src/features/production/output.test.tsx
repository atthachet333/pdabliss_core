import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext } from '@/features/company-center/api';
import type { BranchInfo } from '@/features/company/api';
import type { WarehouseContext } from '@/features/warehouse/whApi';
import { fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { Output, OutputProgress, PendingFg, Receipt } from './outputApi';
import type { Material, Mo, ProductionContext } from './productionApi';

/*
 * EP38 output, finished goods receipt and completion screens (UI): the order's
 * output figures in its unit, reports and receipts, order-level traceability,
 * completion blockers and the short close (material review + reason, focus
 * returns), the quality decision on pending output (exact strings sent), a new
 * report only for orders in production, the Warehouse queue and receipt with
 * lot / expiry and the exact posting warning — role dependent and in TH / EN /
 * ZH. The server enforces everything again (backend/test/production-output.test.ts).
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
const FG = { id: 'fg', code: 'FG-000001', name: 'Cream' };
const RM = { id: 'rm', code: 'RM-000001', name: 'Oil' };
const P = '/api/v1/production';
const VALUES = /777|฿|THB|Secret|cost/i;

const person = (role: CompanyRole, permissions: string[], departments = ['OPERATIONS']) => ({
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
type Who = 'manager' | 'staff' | 'exec';
const ctx = (who: Who): ProductionContext => ({
  orders: {
    view: true,
    create: who !== 'exec',
    approve: who === 'manager',
    cancel: who === 'manager',
  },
  bom: { view: true, manage: who === 'manager' },
  branches: [{ ...REF, type: 'BRANCH' }],
  selectedBranch: { ...REF, type: 'BRANCH' },
  counts: {
    myDrafts: 0,
    awaitingApproval: 0,
    approved: 1,
    ready: 0,
    materialsShort: 0,
    demandToReview: 0,
    sourceCancelled: 0,
    inProduction: 1,
    paused: 0,
    draftIssues: 1,
  },
  execution: {
    materials: who === 'manager',
    issueCreate: who !== 'exec',
    issuePost: who === 'manager',
    usage: who !== 'exec',
    manage: who === 'manager',
  },
  today: '2026-11-04',
});
const as = (who: Who, extra: Parameters<typeof fakeApi>[0] = {}) => ({
  ...person(
    who === 'manager' ? 'DEPARTMENT_MANAGER' : who === 'staff' ? 'DEPARTMENT_STAFF' : 'EXECUTIVE',
    ['operations.workspace.view', 'operations.orders.view'],
  ),
  [`GET ${P}/context`]: ok(ctx(who)),
  ...extra,
});
const material = (over: Partial<Material> = {}): Material => ({
  id: 'mat-rm',
  lineNo: 1,
  item: RM,
  unit: { code: 'KG', precision: 3 },
  bomQuantity: '1',
  required: '100',
  exact: true,
  available: '20',
  shortage: '0',
  state: 'AVAILABLE',
  reserved: '60',
  issued: '40',
  used: '35',
  stillNeeded: '0',
  excess: '0',
  usageVariance: '-65',
  unrecorded: '5',
  ...over,
});
const order = (over: Partial<Mo> = {}): Mo => ({
  id: 'mo1',
  number: 'MO-202611-000006',
  status: 'IN_PRODUCTION',
  source: 'MANUAL',
  branch: REF,
  item: FG,
  unit: { code: 'PCS', precision: 0 },
  quantity: '100',
  bom: { id: 'bom2', code: 'BOM-FG-000001', revision: 2 },
  plannedStartDate: null,
  requiredDate: null,
  priority: 'NORMAL',
  materialState: 'MATERIALS_AVAILABLE',
  reservationState: 'PARTIALLY_ISSUED',
  salesOrder: null,
  attention: null,
  createdBy: { name: 'Demo Operations' },
  updatedAt: '2026-11-04T02:00:00.000Z',
  note: null,
  bomOutputQuantity: '1',
  createdAt: '2026-11-04T01:00:00.000Z',
  submittedAt: '2026-11-04T01:00:00.000Z',
  submittedBy: { name: 'Demo Operations' },
  approvedAt: '2026-11-04T01:00:00.000Z',
  approvedBy: { name: 'Demo Operations' },
  releasedAt: '2026-11-04T01:00:00.000Z',
  releasedBy: { name: 'Demo Operations' },
  rejectedAt: null,
  rejectedBy: null,
  rejectionReason: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  frozen: true,
  materials: [material()],
  demand: null,
  warnings: [],
  actions: ['pause', 'issue', 'usage', 'excess'],
  startedAt: '2026-11-04T02:00:00.000Z',
  startedBy: { name: 'Demo Operations' },
  pausedAt: null,
  executionNote: 'Line 1',
  reservations: [
    {
      id: 'al1',
      materialLineNo: 1,
      item: RM,
      unit: { code: 'KG', precision: 3 },
      location: { id: 'l1', code: 'MAIN', name: 'Main' },
      lot: { id: 'lot1', lotNumber: 'RM-DEMO-02', expiryDate: '2027-05-01' },
      quantity: '60',
      claimed: '10',
      excess: false,
    },
  ],
  issues: [
    {
      id: 'mi1',
      number: 'MI-202611-000001',
      status: 'POSTED',
      postedAt: '2026-11-04T03:00:00.000Z',
      lineCount: 1,
    },
  ],
  ...over,
});
const whBase: WarehouseContext = {
  receiving: { view: true, process: true, cancel: false },
  inventory: { view: true },
  transfers: { create: true, approve: false, cancel: false },
  adjustments: { create: true, approve: false },
  cycleCounts: { create: true, approve: false },
  fulfilment: { pick: true, dispatch: false, deliver: false },
  materialIssues: { view: true },
  branches: [{ ...REF, type: 'BRANCH' }],
  selectedBranch: { ...REF, type: 'BRANCH' },
  locations: [{ id: 'l1', code: 'MAIN', name: 'Main', branchId: 'b1', isDefault: true }],
  counts: {
    pendingReceive: 0,
    draftReceipts: 0,
    stockRows: 0,
    expiring: 0,
    expired: 0,
    draftTransfers: 0,
    submittedAdjustments: 0,
    activeCounts: 0,
    pendingPick: 0,
    openPicks: 0,
    openPacks: 0,
    readyShipments: 0,
    inTransit: 0,
    deliveryExceptions: 0,
  },
  expiringSoonDays: 30,
  today: '2026-11-04',
};

// ---------------------------------------------------------------- EP38

const progress = (over: Partial<OutputProgress> = {}): OutputProgress => ({
  target: '100',
  goodReported: '75',
  pendingReview: '0',
  accepted: '75',
  rejected: '7',
  received: '75',
  awaitingReceipt: '0',
  remaining: '25',
  ...over,
});
const withOutput = (over: Partial<Mo> = {}) =>
  order({
    output: progress(),
    outputReports: [
      {
        id: 'out1',
        number: 'OUT-202611-000001',
        status: 'ACCEPTED',
        productionDate: '2026-11-04',
        good: '40',
        defective: '5',
        pending: '0',
        accepted: '40',
        rejected: '5',
        received: '40',
      },
    ],
    receipts: [
      {
        id: 'fgr1',
        number: 'FGR-202611-000001',
        status: 'POSTED',
        outputNumber: 'OUT-202611-000001',
        quantity: '40',
        postedAt: '2026-11-04T05:00:00.000Z',
      },
    ],
    completion: {
      reviewRequestedAt: null,
      reviewRequestedBy: null,
      completedAt: null,
      completedBy: null,
      outcome: null,
      reason: null,
      blockers: [],
    },
    traceability: {
      outputLots: [
        {
          lotNumber: 'FG-B1',
          expiryDate: '2027-11-01',
          receipt: 'FGR-202611-000001',
          quantity: '40',
        },
      ],
      materialLots: [
        {
          item: 'RM-000001',
          lotNumber: 'RM-DEMO-02',
          issue: 'MI-202611-000001',
          quantity: '40',
          unit: 'KG',
        },
      ],
    },
    ...over,
  });
const report = (over: Partial<Output> = {}): Output => ({
  id: 'out2',
  number: 'OUT-202611-000002',
  status: 'SUBMITTED',
  branch: REF,
  order: { id: 'mo1', number: 'MO-202611-000006', status: 'IN_PRODUCTION' },
  item: FG,
  unit: { code: 'PCS', precision: 0 },
  productionDate: '2026-11-04',
  good: '40',
  defective: '5',
  pending: '3',
  accepted: null,
  rejected: null,
  received: '0',
  awaitingReceipt: '0',
  createdBy: { name: 'Demo Operations' },
  createdAt: '2026-11-04T04:00:00.000Z',
  submittedAt: '2026-11-04T04:10:00.000Z',
  reviewedAt: null,
  updatedAt: '2026-11-04T04:10:00.000Z',
  note: null,
  submittedBy: { name: 'Demo Operations' },
  reviewedBy: null,
  rejectionReason: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  receipts: [],
  actions: ['accept', 'reject', 'cancel'],
  ...over,
});
const managerOut = (extra: Parameters<typeof fakeApi>[0] = {}) =>
  as('manager', {
    [`GET ${P}/context`]: ok({
      ...ctx('manager'),
      output: { create: true, approve: true },
      completion: { manage: true },
    }),
    ...extra,
  });

describe('Production output and completion (EP38)', () => {
  it('order detail: output figures in the order unit, reports, receipts and order-level traceability', async () => {
    fakeApi(
      managerOut({
        [`GET ${P}/orders/mo1`]: ok({
          order: withOutput({ actions: ['output', 'review', 'pause'] }),
          timeline: [],
        }),
      }),
    );
    renderRoute('/core/production/orders/mo1?lang=en');
    const figures = await screen.findByText('Still to produce');
    expect(figures.closest('[data-output-progress]')!.textContent).toMatch(
      /Target100 PCS.*Accepted good75 PCS.*Rejected7 PCS.*Received into stock75 PCS.*Awaiting receipt0 PCS.*Still to produce25 PCS/,
    );
    expect(screen.getByText('OUT-202611-000001')).toBeInTheDocument();
    expect(screen.getByText('FGR-202611-000001')).toBeInTheDocument();
    expect(document.querySelector('[data-trace="output"]')!.textContent).toMatch(
      /FG-B1 · 40 PCS · FGR-202611-000001/,
    );
    expect(screen.getByText(/Order-level granularity/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report output' })).toHaveAttribute(
      'href',
      '/core/production/output/new?order=mo1',
    );
    expect(document.getElementById('main')!.textContent).not.toMatch(VALUES);
  });

  it('completion: blockers shown; short close needs the material review and a reason; focus returns', async () => {
    let current = withOutput({
      status: 'COMPLETION_REVIEW',
      actions: ['reopen', 'complete', 'unreserve'],
      completion: {
        ...withOutput().completion!,
        reviewRequestedAt: '2026-11-04T06:00:00.000Z',
        blockers: ['RECEIPT_PENDING'],
      },
    });
    const api = fakeApi(
      managerOut({
        [`GET ${P}/orders/mo1`]: () => ok({ order: current, timeline: [] }),
        [`POST ${P}/orders/mo1/complete`]: () => {
          current = withOutput({
            status: 'COMPLETED',
            actions: [],
            completion: {
              ...withOutput().completion!,
              outcome: 'SHORT_CLOSED',
              reason: 'Line stopped',
              completedAt: '2026-11-04T07:00:00.000Z',
              completedBy: { name: 'Demo Operations' },
            },
          });
          return ok({ order: current, timeline: [] });
        },
      }),
    );
    const { unmount } = renderRoute('/core/production/orders/mo1?lang=en');
    expect(
      await screen.findByText('A finished goods receipt is still a draft'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close short' })).toBeNull();
    unmount();
    current = withOutput({
      status: 'COMPLETION_REVIEW',
      actions: ['reopen', 'complete'],
      completion: { ...withOutput().completion!, reviewRequestedAt: '2026-11-04T06:00:00.000Z' },
    });
    renderRoute('/core/production/orders/mo1?lang=en');
    expect(await screen.findByText('Ready to close')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close short' }));
    const box = screen.getByRole('group');
    expect(box.textContent).toMatch(/shortfall stays recorded/);
    await userEvent.click(within(box).getByRole('button', { name: 'Close short' }));
    expect(api.called(`POST ${P}/orders/mo1/complete`)).toHaveLength(0);
    await userEvent.click(screen.getByLabelText(/I reviewed material issues and usage/));
    await userEvent.type(within(screen.getByRole('group')).getByRole('textbox'), 'Line stopped');
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'Close short' }),
    );
    await waitFor(() => expect(api.called(`POST ${P}/orders/mo1/complete`)).toHaveLength(1));
    expect(api.called(`POST ${P}/orders/mo1/complete`)[0]!.body).toEqual({
      outcome: 'SHORT_CLOSED',
      materialsReviewed: true,
      reason: 'Line stopped',
    });
    expect(await screen.findByText(/Closed short/)).toBeInTheDocument();
    expect(document.activeElement).toBe(document.querySelector('[data-order] [tabindex="-1"]'));
  });

  it('output report: accept with the pending decision (exact strings sent), staff cannot accept', async () => {
    let current = report();
    const api = fakeApi(
      managerOut({
        [`GET ${P}/outputs/out2`]: () => ok({ report: current, timeline: [] }),
        [`POST ${P}/outputs/out2/accept`]: () => {
          current = report({
            status: 'ACCEPTED',
            accepted: '41',
            rejected: '7',
            actions: ['cancel'],
          });
          return ok({
            report: current,
            timeline: [
              {
                type: 'PRODUCTION_OUTPUT_ACCEPTED',
                at: '2026-11-04T05:00:00.000Z',
                actor: { name: 'Demo Operations' },
              },
            ],
          });
        },
      }),
    );
    renderRoute('/core/production/output/out2?lang=en');
    await userEvent.click(await screen.findByRole('button', { name: 'Accept output' }));
    expect(screen.getByRole('group').textContent).toMatch(/no stock yet/);
    const pending = screen.getByLabelText('Good part of the pending quantity (PCS)');
    await userEvent.clear(pending);
    await userEvent.type(pending, '1');
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'Accept output' }),
    );
    await waitFor(() => expect(api.called(`POST ${P}/outputs/out2/accept`)).toHaveLength(1));
    expect(api.called(`POST ${P}/outputs/out2/accept`)[0]!.body).toEqual({ pendingGood: '1' });
    expect(await screen.findByText('41 PCS')).toBeInTheDocument();
    expect(screen.getAllByText('Accepted').length).toBeGreaterThan(0);
  });

  it('new output report: only orders in production, server-bound strings, precision checked', async () => {
    const api = fakeApi(
      managerOut({
        [`GET ${P}/orders`]: ok({
          items: [
            order(),
            order({ id: 'mo9', number: 'MO-202611-000009', status: 'COMPLETION_REVIEW' }),
          ],
          total: 2,
          page: 1,
          pageSize: 100,
          hasMore: false,
        }),
        [`POST ${P}/outputs`]: ok({
          report: report({ id: 'out3', status: 'DRAFT', actions: ['edit', 'submit', 'cancel'] }),
          timeline: [],
        }),
        [`GET ${P}/outputs/out3`]: ok({
          report: report({ id: 'out3', status: 'DRAFT', actions: ['edit', 'submit', 'cancel'] }),
          timeline: [],
        }),
      }),
    );
    renderRoute('/core/production/output/new?order=mo1&lang=en');
    const select = await screen.findByLabelText('Production order');
    expect(within(select).queryByText(/MO-202611-000009/)).toBeNull();
    await userEvent.type(screen.getByLabelText('Good (PCS)'), '1.5');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Good (PCS)'));
    await userEvent.type(screen.getByLabelText('Good (PCS)'), '40');
    await userEvent.type(screen.getByLabelText('Defective (PCS)'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.called(`POST ${P}/outputs`)).toHaveLength(1));
    expect(api.called(`POST ${P}/outputs`)[0]!.body).toEqual({
      productionOrderId: 'mo1',
      productionDate: '2026-11-04',
      goodQuantity: '40',
      defectiveQuantity: '5',
      note: null,
    });
  });

  it('Warehouse finished goods: pending queue, receipt with lot / expiry, posting warns in the exact words', async () => {
    const w: WarehouseContext = {
      ...whBase,
      finishedGoods: { view: true, process: true, confirm: true },
    };
    const pending: PendingFg = {
      output: { id: 'out1', number: 'OUT-202611-000001', productionDate: '2026-11-04' },
      branch: REF,
      order: { id: 'mo1', number: 'MO-202611-000006' },
      item: FG,
      unit: { code: 'PCS', precision: 0 },
      tracking: { lot: 'REQUIRED', expiry: 'REQUIRED' },
      accepted: '40',
      received: '0',
      pending: '40',
      draftReceipts: 0,
    };
    const receipt = (status: Receipt['status'], actions: Receipt['actions']): Receipt => ({
      id: 'fgr1',
      number: 'FGR-202611-000001',
      status,
      branch: REF,
      order: { id: 'mo1', number: 'MO-202611-000006' },
      output: {
        id: 'out1',
        number: 'OUT-202611-000001',
        status: 'ACCEPTED',
        productionDate: '2026-11-04',
        accepted: '40',
        received: status === 'POSTED' ? '40' : '0',
        pending: status === 'POSTED' ? '0' : '40',
      },
      item: FG,
      unit: { code: 'PCS', precision: 0 },
      quantity: '40',
      lineCount: 1,
      createdBy: { name: 'Demo Warehouse' },
      createdAt: '2026-11-04T05:00:00.000Z',
      postedAt: status === 'POSTED' ? '2026-11-04T06:00:00.000Z' : null,
      updatedAt: '2026-11-04T05:00:00.000Z',
      note: null,
      tracking: { lot: 'REQUIRED', expiry: 'REQUIRED' },
      postedBy: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      reversedAt: null,
      reversedBy: null,
      reversalReason: null,
      lines: [
        {
          id: 'l1',
          lineNo: 1,
          location: { id: 'l1', code: 'MAIN', name: 'Main' },
          lotNumber: 'FG-B1',
          expiryDate: '2027-11-01',
          manufacturedDate: '2026-11-04',
          lot: null,
          quantity: '40',
        },
      ],
      actions,
    });
    let current = receipt('DRAFT', ['post', 'cancel']);
    const api = fakeApi({
      ...person(
        'DEPARTMENT_MANAGER',
        ['warehouse.workspace.view', 'warehouse.finished_goods.view'],
        ['WAREHOUSE'],
      ),
      'GET /api/v1/warehouse/context': ok(w),
      'GET /api/v1/warehouse/finished-goods': ok({
        items: [pending],
        total: 1,
        page: 1,
        pageSize: 100,
        hasMore: false,
      }),
      'GET /api/v1/warehouse/finished-goods/receipts': ok({
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        hasMore: false,
      }),
      'POST /api/v1/warehouse/finished-goods/receipts': () =>
        ok({ receipt: current, timeline: [] }),
      'GET /api/v1/warehouse/finished-goods/receipts/fgr1': () =>
        ok({ receipt: current, timeline: [] }),
      'POST /api/v1/warehouse/finished-goods/receipts/fgr1/post': () => {
        current = receipt('POSTED', ['reverse']);
        return ok({ receipt: current, timeline: [] });
      },
    });
    const { unmount } = renderRoute('/core/warehouse/finished-goods?lang=en');
    const card = (await screen.findByText('OUT-202611-000001')).closest('li')!;
    expect(card.textContent).toMatch(
      /Accepted good 40 · Received into stock 0 · Awaiting receipt 40 PCS/,
    );
    expect(card.textContent).toMatch(/Lot: Required · Expiry: Required/);
    expect(document.getElementById('main')!.textContent).not.toMatch(VALUES);
    unmount();
    renderRoute('/core/warehouse/finished-goods/new?output=out1&lang=en');
    await userEvent.type(await screen.findByLabelText('Lot'), 'FG-B1');
    await userEvent.type(screen.getByLabelText('Expiry'), '2027-11-01');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.called('POST /api/v1/warehouse/finished-goods/receipts')).toHaveLength(1),
    );
    expect(api.called('POST /api/v1/warehouse/finished-goods/receipts')[0]!.body).toEqual({
      outputReportId: 'out1',
      lines: [
        {
          locationId: 'l1',
          lotNumber: 'FG-B1',
          expiryDate: '2027-11-01',
          manufacturedDate: null,
          quantity: '40',
        },
      ],
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Post receipt' }));
    expect(screen.getByRole('group').textContent).toMatch(
      'Posting this receipt will add the finished goods to physical warehouse stock.',
    );
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'Post receipt' }),
    );
    await waitFor(() => expect(document.querySelector('[data-status="POSTED"]')).not.toBeNull());
    expect(api.called('POST /api/v1/warehouse/finished-goods/receipts/fgr1/post')[0]!.body).toEqual(
      {},
    );
    expect(screen.getByRole('button', { name: 'Reverse receipt' })).toBeInTheDocument();
  });

  it('Thai and Simplified Chinese: completion statuses and the receipt warning are translated', async () => {
    fakeApi(
      managerOut({
        [`GET ${P}/orders/mo1`]: ok({
          order: withOutput({ status: 'COMPLETION_REVIEW', actions: ['reopen'] }),
          timeline: [],
        }),
      }),
    );
    const { unmount } = renderRoute('/core/production/orders/mo1?lang=th');
    expect((await screen.findAllByText('ตรวจปิดงาน')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'กลับไปผลิตต่อ' })).toBeInTheDocument();
    unmount();
    fakeApi(managerOut({ [`GET ${P}/outputs/out2`]: ok({ report: report(), timeline: [] }) }));
    renderRoute('/core/production/output/out2?lang=zh');
    expect(await screen.findByRole('button', { name: '接收产出' })).toBeInTheDocument();
    expect(screen.getByText('待审核')).toBeInTheDocument();
  });
});
