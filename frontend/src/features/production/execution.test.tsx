import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext } from '@/features/company-center/api';
import type { BranchInfo } from '@/features/company/api';
import type { WarehouseContext } from '@/features/warehouse/whApi';
import { fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { HandoffRow, Issue, Material, Mo, ProductionContext } from './productionApi';

/*
 * EP37 execution screens (UI): planned · reserved · issued · used per
 * material, the exact reservations, reserve / start / pause through a confirm
 * box (focus returns), actual usage (exact strings sent, never above what was
 * issued — the server decides), a new material issue, its draft quantities and
 * posting with the exact warning, the issue list, the Warehouse handoff — role
 * dependent and in TH / EN / ZH. The server enforces everything again
 * (backend/test/production-execution.test.ts).
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
const issue = (over: Partial<Issue> = {}): Issue => ({
  id: 'mi2',
  number: 'MI-202611-000002',
  status: 'DRAFT',
  branch: REF,
  order: { id: 'mo1', number: 'MO-202611-000006', status: 'IN_PRODUCTION' },
  lineCount: 1,
  createdBy: { name: 'Demo Operations' },
  createdAt: '2026-11-04T04:00:00.000Z',
  postedAt: null,
  updatedAt: '2026-11-04T04:00:00.000Z',
  note: null,
  postedBy: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  lines: [
    {
      id: 'il1',
      lineNo: 1,
      materialLineNo: 1,
      item: RM,
      unit: { code: 'KG', precision: 3 },
      location: { id: 'l1', code: 'MAIN', name: 'Main' },
      lot: { id: 'lot1', lotNumber: 'RM-DEMO-02', expiryDate: '2027-05-01' },
      quantity: '60',
      allocationId: 'al1',
      reserved: '60',
    },
  ],
  actions: ['edit', 'post', 'cancel'],
  ...over,
});
const tl = (type: string) => [
  { type, at: '2026-11-04T02:00:00.000Z', actor: { name: 'Demo Operations' } },
];

describe('Production execution (EP37)', () => {
  it('order page: planned · reserved · issued · used, exact reservations, variance warning — no commercial value', async () => {
    fakeApi(
      as('manager', {
        [`GET ${P}/orders/mo1`]: ok({ order: order(), timeline: tl('PRODUCTION_ORDER_STARTED') }),
      }),
    );
    renderRoute('/core/production/orders/mo1?lang=en');
    expect(
      await screen.findByRole('heading', { name: 'Production execution' }),
    ).toBeInTheDocument();
    const row = document.querySelector('[data-table="execution-materials"] [data-row="1"]')!;
    expect(row.textContent).toMatch(/100 KG.*60 KG.*40 KG.*35 KG/);
    expect(document.querySelector('[data-variance-warning]')).not.toBeNull();
    const res = document.querySelector('[data-table="reservations"]')!;
    expect(res.textContent).toMatch(/MAIN.*RM-DEMO-02.*60 KG/);
    expect(
      screen.getByText(/Stock is deducted only when a material issue is posted/),
    ).toBeInTheDocument();
    expect(screen.getByText('Production started')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MI-202611-000001' })).toHaveAttribute(
      'href',
      '/core/production/issues/mi1',
    );
    expect(document.getElementById('main')!.textContent).not.toMatch(VALUES);
  });

  it('reserving and pausing ask first, send nothing but the action (and a note), and return focus', async () => {
    let current = order({
      status: 'READY',
      actions: ['allocate', 'start', 'cancel'],
      reservationState: 'PARTIALLY_RESERVED',
      startedAt: null,
      startedBy: null,
      issues: [],
    });
    const api = fakeApi(
      as('manager', {
        [`GET ${P}/orders/mo1`]: () => ok({ order: current, timeline: [] }),
        [`POST ${P}/orders/mo1/materials/allocate`]: () => {
          current = order({
            status: 'READY',
            actions: ['start', 'unreserve', 'reallocate', 'cancel'],
            reservationState: 'FULLY_RESERVED',
            startedAt: null,
            startedBy: null,
            issues: [],
          });
          return ok({
            order: current,
            timeline: [],
            allocation: { reservedNow: '40', materials: [] },
          });
        },
        [`POST ${P}/orders/mo1/start`]: () => {
          current = order();
          return ok({ order: current, timeline: tl('PRODUCTION_ORDER_STARTED') });
        },
      }),
    );
    renderRoute('/core/production/orders/mo1?lang=en');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reserve what is still short' }),
    );
    expect(screen.getByRole('group').textContent).toMatch(/Reserving does not move stock/);
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', {
        name: 'Reserve what is still short',
      }),
    );
    await waitFor(() =>
      expect(api.called(`POST ${P}/orders/mo1/materials/allocate`)).toHaveLength(1),
    );
    expect(api.called(`POST ${P}/orders/mo1/materials/allocate`)[0]!.body).toEqual({});
    expect(document.activeElement).toBe(document.querySelector('[data-order] [tabindex="-1"]'));
    await userEvent.click(await screen.findByRole('button', { name: 'Start production' }));
    await userEvent.type(screen.getByLabelText('Work note'), 'Line 1');
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'Start production' }),
    );
    await waitFor(() =>
      expect(document.querySelector('[data-status="IN_PRODUCTION"]')).not.toBeNull(),
    );
    expect(api.called(`POST ${P}/orders/mo1/start`)[0]!.body).toEqual({ note: 'Line 1' });
  });

  it('usage: exact strings, the material id, never a stock action; a staff member sees no reserve or start', async () => {
    const api = fakeApi(
      as('staff', {
        [`GET ${P}/orders/mo1`]: ok({
          order: order({ actions: ['issue', 'usage'] }),
          timeline: [],
        }),
        [`POST ${P}/orders/mo1/usage`]: ok({
          order: order({
            actions: ['issue', 'usage'],
            materials: [material({ used: '37', unrecorded: '3' })],
          }),
          timeline: [],
        }),
      }),
    );
    renderRoute('/core/production/orders/mo1?lang=en');
    const form = (
      await screen.findByRole('heading', { name: 'Record actual material usage' })
    ).closest('section')!;
    expect(screen.queryByRole('button', { name: /Reserve/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start production' })).toBeNull();
    await userEvent.type(within(form).getByLabelText('Quantity used (KG)'), '2.0005');
    expect(within(form).getByRole('button', { name: 'Record usage' })).toBeDisabled();
    await userEvent.clear(within(form).getByLabelText('Quantity used (KG)'));
    await userEvent.type(within(form).getByLabelText('Quantity used (KG)'), '2');
    await userEvent.type(within(form).getByLabelText('Work note'), 'Batch B');
    await userEvent.click(within(form).getByRole('button', { name: 'Record usage' }));
    await waitFor(() => expect(api.called(`POST ${P}/orders/mo1/usage`)).toHaveLength(1));
    expect(api.called(`POST ${P}/orders/mo1/usage`)[0]!.body).toEqual({
      materialId: 'mat-rm',
      quantity: '2',
      note: 'Batch B',
    });
    expect(
      screen.getByText(/never changes stock and cannot exceed what was issued/),
    ).toBeInTheDocument();
  });

  it('a new issue opens its draft; quantities are saved; posting warns in the exact words and posts once', async () => {
    let current = issue();
    const api = fakeApi(
      as('manager', {
        [`GET ${P}/orders/mo1`]: ok({ order: order(), timeline: [] }),
        [`POST ${P}/issues`]: ok({ issue: current, timeline: tl('MATERIAL_ISSUE_CREATED') }),
        [`GET ${P}/issues/mi2`]: () =>
          ok({ issue: current, timeline: tl('MATERIAL_ISSUE_CREATED') }),
        [`PUT ${P}/issues/mi2/lines`]: () => {
          current = issue({
            lines: [{ ...issue().lines[0]!, quantity: '25' }],
            updatedAt: '2026-11-04T05:00:00.000Z',
          });
          return ok({ issue: current, timeline: tl('MATERIAL_ISSUE_UPDATED') });
        },
        [`POST ${P}/issues/mi2/post`]: () => {
          current = issue({
            status: 'POSTED',
            actions: [],
            postedAt: '2026-11-04T06:00:00.000Z',
            postedBy: { name: 'Demo Operations' },
            lines: [{ ...issue().lines[0]!, quantity: '25', reserved: null }],
          });
          return ok({ issue: current, timeline: tl('MATERIAL_ISSUE_POSTED') });
        },
      }),
    );
    renderRoute('/core/production/orders/mo1?lang=en');
    await userEvent.click(await screen.findByRole('button', { name: 'New material issue' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'MI-202611-000002' }),
    ).toBeInTheDocument();
    expect(api.called(`POST ${P}/issues`)[0]!.body).toEqual({ productionOrderId: 'mo1' });
    const qty = screen.getByLabelText('Quantity to issue (KG)');
    await userEvent.clear(qty);
    await userEvent.type(qty, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Save quantities' }));
    await waitFor(() => expect(api.called(`PUT ${P}/issues/mi2/lines`)).toHaveLength(1));
    expect(api.called(`PUT ${P}/issues/mi2/lines`)[0]!.body).toEqual({
      lines: [{ allocationId: 'al1', quantity: '25' }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Post issue' }));
    expect(screen.getByRole('group').textContent).toMatch(
      'Posting this issue will deduct physical warehouse stock and consume matching Production reservations.',
    );
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'Post issue' }),
    );
    await waitFor(() => expect(document.querySelector('[data-status="POSTED"]')).not.toBeNull());
    expect(api.called(`POST ${P}/issues/mi2/post`)).toHaveLength(1);
    expect(api.called(`POST ${P}/issues/mi2/post`)[0]!.body).toEqual({});
    expect(screen.queryByRole('button', { name: 'Post issue' })).toBeNull();
    expect(document.activeElement).toBe(document.querySelector('[data-issue] [tabindex="-1"]'));
  });

  it('issue list and the executive: read only, nothing to act on', async () => {
    fakeApi(
      as('exec', {
        [`GET ${P}/issues`]: ok({
          items: [issue({ actions: [] })],
          total: 1,
          page: 1,
          pageSize: 25,
          hasMore: false,
        }),
        [`GET ${P}/issues/mi2`]: ok({ issue: issue({ actions: [] }), timeline: [] }),
      }),
    );
    const { unmount } = renderRoute('/core/production/issues?lang=en');
    const r = (await screen.findByRole('link', { name: 'MI-202611-000002' })).closest('tr')!;
    expect(r.textContent).toMatch(/Draft.*MO-202611-000006/);
    unmount();
    renderRoute('/core/production/issues/mi2?lang=en');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'MI-202611-000002' }),
    ).toBeInTheDocument();
    expect(
      within(document.getElementById('main')!).queryByRole('button', {
        name: /Post|Cancel issue|Save/,
      }),
    ).toBeNull();
  });

  it('Warehouse handoff: listed in the Warehouse menu with the permission; locations, lots and quantities only', async () => {
    const w: WarehouseContext = {
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
    const row: HandoffRow = {
      id: 'mi1',
      number: 'MI-202611-000001',
      status: 'POSTED',
      branch: REF,
      order: { number: 'MO-202611-000006' },
      postedAt: '2026-11-04T03:00:00.000Z',
      createdAt: '2026-11-04T02:00:00.000Z',
      lines: [
        {
          item: RM,
          unit: { code: 'KG', precision: 3 },
          location: { id: 'l1', code: 'MAIN', name: 'Main' },
          lot: { id: 'lot1', lotNumber: 'RM-DEMO-02', expiryDate: null },
          quantity: '40',
        },
      ],
    };
    fakeApi({
      ...person(
        'DEPARTMENT_STAFF',
        ['warehouse.workspace.view', 'warehouse.inventory.view', 'warehouse.material_issues.view'],
        ['WAREHOUSE'],
      ),
      'GET /api/v1/warehouse/context': ok(w),
      'GET /api/v1/warehouse/material-issues': ok({
        items: [row],
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false,
      }),
      'GET /api/v1/warehouse/stock': ok({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
        today: '2026-11-04',
      }),
    });
    renderRoute('/core/warehouse/material-issues?lang=en');
    const card = (await screen.findByText('MI-202611-000001')).closest('li')!;
    expect(card.textContent).toMatch(
      /Posted.*MO-202611-000006.*RM-000001.*MAIN.*RM-DEMO-02.*40 KG/,
    );
    expect(document.getElementById('main')!.textContent).not.toMatch(VALUES);
    expect(within(document.getElementById('main')!).queryByRole('button')).toBeNull();
  });

  it('Thai and Simplified Chinese: execution states, actions and the posting warning are translated', async () => {
    fakeApi(as('manager', { [`GET ${P}/orders/mo1`]: ok({ order: order(), timeline: [] }) }));
    const { unmount } = renderRoute('/core/production/orders/mo1?lang=th');
    expect(await screen.findByText('กำลังผลิต')).toBeInTheDocument();
    expect(screen.getByText('เบิกบางส่วน')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'หยุดชั่วคราว' })).toBeInTheDocument();
    unmount();
    fakeApi(as('manager', { [`GET ${P}/issues/mi2`]: ok({ issue: issue(), timeline: [] }) }));
    renderRoute('/core/production/issues/mi2?lang=zh');
    await userEvent.click(await screen.findByRole('button', { name: '领料过账' }));
    expect(screen.getByRole('group').textContent).toMatch(
      '此领料单过账后将扣减实际仓库库存，并消耗对应的生产预留。',
    );
  });
});
