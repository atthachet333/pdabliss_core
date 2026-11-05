import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext } from '@/features/company-center/api';
import type { BranchInfo } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type {
  Bom,
  DemandRow,
  Material,
  Mo,
  MoRow,
  ProductionContext,
  ProductionItem,
  RequirementRow,
  ShortageRow,
} from './productionApi';

/*
 * EP36 Production screens (UI, Operations department): permission-driven
 * navigation, real counts, server-side list filters, the order editor with the
 * active BOM and a server preview (the client never sends requirements),
 * approval / rejection / release / cancellation through a confirm box (focus
 * returns), BOM drafts and activation, requirements, the sales demand queue
 * (no price, no customer) and the Purchasing shortage page — in TH / EN / ZH.
 * The server enforces everything again (backend/test/production.test.ts).
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
const PK = { id: 'pk', code: 'PK-000001', name: 'Box' };
const P = '/api/v1/production';
const MONEY = /price|cost|amount|฿|THB|777|total|customer|Secret/i;
const BOM_REF = { id: 'bom2', code: 'BOM-FG-000001', revision: 2 };

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
const ctx = (who: Who, bomView = true): ProductionContext => ({
  orders: {
    view: true,
    create: who !== 'exec',
    approve: who === 'manager',
    cancel: who === 'manager',
  },
  bom: { view: bomView, manage: who === 'manager' },
  branches: [{ ...REF, type: 'BRANCH' }],
  selectedBranch: { ...REF, type: 'BRANCH' },
  counts: {
    myDrafts: 1,
    awaitingApproval: 2,
    approved: 3,
    ready: 0,
    materialsShort: 4,
    demandToReview: 1,
    sourceCancelled: 0,
    inProduction: 0,
    paused: 0,
    draftIssues: 0,
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
const VIEW = ['operations.workspace.view', 'operations.orders.view', 'operations.bom.view'];
const as = (who: Who, extra: Parameters<typeof fakeApi>[0] = {}, bomView = true) => ({
  ...person(
    who === 'manager' ? 'DEPARTMENT_MANAGER' : who === 'staff' ? 'DEPARTMENT_STAFF' : 'EXECUTIVE',
    who === 'exec' ? VIEW : [...VIEW, 'operations.orders.create'],
  ),
  [`GET ${P}/context`]: ok(ctx(who, bomView)),
  ...extra,
});

const material = (over: Partial<Material> = {}): Material => ({
  id: 'mat1',
  lineNo: 1,
  item: RM,
  unit: { code: 'KG', precision: 3 },
  bomQuantity: '0.25',
  required: '10',
  exact: true,
  available: '4',
  shortage: '6',
  state: 'PARTIALLY_AVAILABLE',
  reserved: '0',
  issued: '0',
  used: '0',
  stillNeeded: '10',
  excess: '0',
  usageVariance: '-10',
  unrecorded: '0',
  ...over,
});
const row = (over: Partial<MoRow> = {}): MoRow => ({
  id: 'mo1',
  number: 'MO-202611-000001',
  status: 'SUBMITTED',
  source: 'MANUAL',
  branch: REF,
  item: FG,
  unit: { code: 'PCS', precision: 0 },
  quantity: '40',
  bom: BOM_REF,
  plannedStartDate: '2026-11-10',
  requiredDate: '2026-11-13',
  priority: 'HIGH',
  materialState: 'MATERIALS_SHORT',
  reservationState: null,
  salesOrder: null,
  attention: null,
  createdBy: { name: 'Demo Operations' },
  updatedAt: '2026-11-04T02:00:00.000Z',
  ...over,
});
const order = (over: Partial<Mo> = {}): Mo => ({
  ...row(),
  note: null,
  bomOutputQuantity: '1',
  createdAt: '2026-11-04T01:00:00.000Z',
  submittedAt: '2026-11-04T02:00:00.000Z',
  submittedBy: { name: 'Demo Operations' },
  approvedAt: null,
  approvedBy: null,
  releasedAt: null,
  releasedBy: null,
  rejectedAt: null,
  rejectedBy: null,
  rejectionReason: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  frozen: false,
  materials: [
    material(),
    material({
      lineNo: 2,
      item: PK,
      unit: { code: 'BOX', precision: 0 },
      bomQuantity: '1',
      required: '40',
      available: '43',
      shortage: '0',
      state: 'AVAILABLE',
    }),
  ],
  demand: null,
  warnings: [],
  actions: ['approve', 'reject'],
  startedAt: null,
  startedBy: null,
  pausedAt: null,
  executionNote: null,
  reservations: [],
  issues: [],
  ...over,
});
const tl = (type: string) => [
  { type, at: '2026-11-04T02:00:00.000Z', actor: { name: 'Demo Operations' } },
];
const page = <T,>(items: T[]) =>
  ok({ items, total: items.length, page: 1, pageSize: 25, hasMore: false });
const fgItem: ProductionItem = {
  ...FG,
  type: 'FINISHED_GOOD',
  unit: { id: 'u-pcs', code: 'PCS', precision: 0 },
  activeBom: BOM_REF,
};

const box = () => document.querySelector<HTMLElement>('[data-confirm-box]')!;
const VALUES = /777|฿|THB|Secret/;

describe('Production planning (EP36)', () => {
  it('CORE: Operations opens production planning; Purchasing sees its shortage handoff', async () => {
    fakeApi(as('manager'));
    const { unmount } = renderRoute('/core?lang=en');
    const card = (await screen.findByText('Open production planning')).closest('a')!;
    expect(card.getAttribute('href')).toBe('/core/production');
    unmount();
    fakeApi({
      ...person(
        'DEPARTMENT_MANAGER',
        ['purchasing.workspace.view', 'purchasing.production_shortages.view'],
        ['PURCHASING'],
      ),
    });
    renderRoute('/core?lang=en');
    expect(
      (await screen.findByRole('link', { name: 'Production material shortages' })).getAttribute(
        'href',
      ),
    ).toBe('/core/purchasing/production-shortages');
  });

  it('overview: real counts, permission-driven navigation (no BOM tab without BOM access)', async () => {
    fakeApi(as('staff'));
    const { unmount } = renderRoute('/core/production?lang=en');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Production' }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Production menu' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual([
      'Overview',
      'Production orders',
      'Bills of materials',
      'Material requirements',
      'Sales demand',
      'Material reservations',
      'Material issues',
      'Production execution',
      'Output & completion', // EP38
    ]);
    expect(document.querySelector('[data-count="materialsShort"]')!.textContent).toMatch(
      /Materials short\s*4/,
    );
    expect(screen.getByText(/not a reservation/)).toBeInTheDocument();
    unmount();
    fakeApi(as('exec', {}, false));
    renderRoute('/core/production?lang=en');
    const nav2 = await screen.findByRole('navigation', { name: 'Production menu' });
    expect(within(nav2).queryByText('Bills of materials')).toBeNull();
    expect(screen.queryByRole('link', { name: 'New production order' })).toBeNull();
  });

  it('order list: filters are server-side query parameters; rows show status and material readiness', async () => {
    const api = fakeApi(as('manager', { [`GET ${P}/orders`]: page([row()]) }));
    renderRoute('/core/production/orders?lang=en');
    const r = (await screen.findByText('MO-202611-000001')).closest('tr')!;
    expect(r.textContent).toMatch(/40 PCS/);
    expect(within(r).getByText('Awaiting approval')).toBeInTheDocument();
    expect(within(r).getByText('Materials short')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'APPROVED');
    await userEvent.selectOptions(screen.getByLabelText('Materials'), 'SHORT');
    await waitFor(() =>
      expect(api.called(`GET ${P}/orders`).at(-1)!.query).toMatchObject({
        status: 'APPROVED',
        materials: 'SHORT',
        page: '1',
      }),
    );
  });

  it('new order: finished item, its active BOM, server preview — and only plan fields are sent', async () => {
    const api = fakeApi(
      as('staff', {
        [`GET ${P}/items`]: ok({ items: [fgItem] }),
        [`GET ${P}/requirements/preview`]: ok({
          bom: BOM_REF,
          quantity: '40',
          materialState: 'MATERIALS_SHORT',
          materials: order().materials,
        }),
        [`POST ${P}/orders`]: ok({
          order: order({ status: 'DRAFT', actions: ['edit', 'submit', 'cancel'] }),
          timeline: tl('PRODUCTION_ORDER_CREATED'),
        }),
        [`GET ${P}/orders/mo1`]: ok({
          order: order({ status: 'DRAFT', actions: ['edit', 'submit', 'cancel'] }),
          timeline: tl('PRODUCTION_ORDER_CREATED'),
        }),
      }),
    );
    renderRoute('/core/production/orders/new?lang=en');
    await userEvent.type(await screen.findByLabelText('Search the item to produce'), 'FG');
    await userEvent.click(await screen.findByRole('button', { name: /FG-000001/ }));
    expect(screen.getByText('BOM-FG-000001 revision 2 (active)')).toBeInTheDocument();
    const create = screen.getByRole('button', { name: 'Create draft' });
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Quantity to produce (PCS)'), '40');
    const preview = await screen.findByText(/computed by the server, not saved yet/);
    const section = preview.closest('section')!;
    expect(await within(section).findByText('RM-000001')).toBeInTheDocument();
    expect(within(section).getByText('6 KG')).toBeInTheDocument();
    expect(api.called(`GET ${P}/requirements/preview`).at(-1)!.query).toEqual({
      bomId: 'bom2',
      quantity: '40',
      branchId: 'b1',
    });
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'URGENT');
    await userEvent.click(create);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'MO-202611-000001' }),
    ).toBeInTheDocument();
    expect(api.called(`POST ${P}/orders`)[0]!.body).toEqual({
      itemId: 'fg',
      branchId: 'b1',
      bomId: 'bom2',
      quantity: '40',
      plannedStartDate: null,
      requiredDate: null,
      priority: 'URGENT',
      note: null,
    });
  });

  it('new order: an item without an active BOM cannot be planned; a precision error is shown', async () => {
    fakeApi(as('staff', { [`GET ${P}/items`]: ok({ items: [{ ...fgItem, activeBom: null }] }) }));
    renderRoute('/core/production/orders/new?lang=en');
    await userEvent.type(await screen.findByLabelText('Search the item to produce'), 'FG');
    await userEvent.click(await screen.findByRole('button', { name: /FG-000001/ }));
    expect(screen.getByText(/no active bill of materials/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Quantity to produce (PCS)'), '1.5');
    expect(
      screen.getByText('The quantity has more decimals than its unit allows.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create draft' })).toBeDisabled();
  });

  it('order page: materials vs availability, warnings; a manager approves after a confirm and focus returns', async () => {
    let current = order({ warnings: ['DEMAND_ALREADY_PLANNED'] });
    const api = fakeApi(
      as('manager', {
        [`GET ${P}/orders/mo1`]: () =>
          ok({ order: current, timeline: tl('PRODUCTION_ORDER_SUBMITTED') }),
        [`POST ${P}/orders/mo1/approve`]: () => {
          current = order({
            status: 'APPROVED',
            frozen: true,
            actions: ['release', 'cancel'],
            approvedAt: '2026-11-04T03:00:00.000Z',
            approvedBy: { name: 'Demo Operations' },
          });
          return ok({ order: current, timeline: tl('PRODUCTION_ORDER_APPROVED') });
        },
      }),
    );
    renderRoute('/core/production/orders/mo1?lang=en');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'MO-202611-000001' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/already plan for this demand/)).toBeInTheDocument();
    const rm = screen.getAllByText('RM-000001')[0]!.closest('tr')!;
    expect(rm.textContent).toMatch(/10 KG.*4 KG.*6 KG.*Partly available/);
    expect(document.getElementById('main')!.textContent).not.toMatch(MONEY);
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const box = screen.getByRole('group');
    expect(box.textContent).toMatch(/frozen\. No stock is reserved or issued/);
    await userEvent.click(within(box).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(document.querySelector('[data-status="APPROVED"]')).not.toBeNull());
    expect(api.called(`POST ${P}/orders/mo1/approve`)[0]!.body).toEqual({});
    expect(screen.getByText(/requirements are frozen/)).toBeInTheDocument();
    expect(document.activeElement).toBe(document.querySelector('[data-order] [tabindex="-1"]'));
    expect(screen.getByRole('button', { name: 'Release as ready' })).toBeInTheDocument();
  });

  it('reject needs a reason; Escape closes the box and returns focus; staff and executive see no decisions', async () => {
    const api = fakeApi(
      as('manager', {
        [`GET ${P}/orders/mo1`]: ok({ order: order(), timeline: [] }),
        [`POST ${P}/orders/mo1/reject`]: ok({
          order: order({ status: 'REJECTED', actions: [], rejectionReason: 'Not now' }),
          timeline: [],
        }),
      }),
    );
    const { unmount } = renderRoute('/core/production/orders/mo1?lang=en');
    const reject = await screen.findByRole('button', { name: 'Reject' });
    reject.focus();
    await userEvent.keyboard('{Enter}');
    const box = screen.getByRole('group');
    await userEvent.keyboard('{Escape}');
    expect(box).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.querySelector('[data-order] [tabindex="-1"]'));
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await userEvent.type(screen.getByLabelText('Reason'), 'Not now');
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'Reject' }),
    );
    await waitFor(() => expect(api.called(`POST ${P}/orders/mo1/reject`)).toHaveLength(1));
    expect(api.called(`POST ${P}/orders/mo1/reject`)[0]!.body).toEqual({ reason: 'Not now' });
    unmount();
    fakeApi(
      as('exec', { [`GET ${P}/orders/mo1`]: ok({ order: order({ actions: [] }), timeline: [] }) }),
    );
    renderRoute('/core/production/orders/mo1?lang=en');
    expect(await screen.findByText('You can view this only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('a draft is edited (only changed fields) and discarded; a server refusal is shown in words', async () => {
    const draft = order({
      status: 'DRAFT',
      actions: ['edit', 'submit', 'cancel'],
      submittedAt: null,
      submittedBy: null,
    });
    const api = fakeApi(
      as('staff', {
        [`GET ${P}/orders/mo1`]: ok({ order: draft, timeline: [] }),
        [`PATCH ${P}/orders/mo1`]: ok({
          order: { ...draft, quantity: '48', updatedAt: '2026-11-04T05:00:00.000Z' },
          timeline: [],
        }),
        [`POST ${P}/orders/mo1/submit`]: fail(409, 'BOM_NOT_ACTIVE'),
      }),
    );
    renderRoute('/core/production/orders/mo1?lang=en');
    const qty = await screen.findByLabelText('Quantity to produce (PCS)');
    await userEvent.clear(qty);
    await userEvent.type(qty, '48');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.called(`PATCH ${P}/orders/mo1`)).toHaveLength(1));
    expect(api.called(`PATCH ${P}/orders/mo1`)[0]!.body).toEqual({ quantity: '48' });
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'Submit for approval' }),
    );
    expect(
      await screen.findByText(/no longer active — choose the active revision/),
    ).toBeInTheDocument();
    // The box stays open on a refusal; leaving it shows the draft's actions again.
    await userEvent.click(within(box()).getAllByRole('button').at(-1)!);
    expect(screen.getByRole('button', { name: 'Discard draft' })).toBeInTheDocument();
  });

  it('BOM: a manager drafts materials, activates after a confirm; revisions are listed', async () => {
    const bom = (over: Partial<Bom> = {}): Bom => ({
      id: 'bom3',
      code: 'BOM-FG-000001',
      revision: 3,
      status: 'DRAFT',
      item: FG,
      outputQuantity: '1',
      unit: { code: 'PCS', precision: 0 },
      lineCount: 1,
      activatedAt: null,
      updatedAt: '2026-11-04T02:00:00.000Z',
      note: null,
      lines: [
        {
          lineNo: 1,
          item: { ...RM, type: 'RAW_MATERIAL' },
          unit: { code: 'KG', precision: 3 },
          quantity: '0.25',
          note: null,
        },
      ],
      createdBy: { name: 'Demo Operations' },
      createdAt: '2026-11-04T02:00:00.000Z',
      activatedBy: null,
      retiredAt: null,
      retiredBy: null,
      retirementReason: null,
      revisions: [
        { id: 'bom3', revision: 3, status: 'DRAFT', updatedAt: '2026-11-04T02:00:00.000Z' },
        { id: 'bom2', revision: 2, status: 'ACTIVE', updatedAt: '2026-11-03T02:00:00.000Z' },
      ],
      orderCount: 0,
      actions: ['edit', 'activate', 'retire'],
      ...over,
    });
    let current = bom();
    const api = fakeApi(
      as('manager', {
        [`GET ${P}/items`]: (_b, q) =>
          ok({
            items:
              q.get('role') === 'OUTPUT'
                ? [fgItem]
                : [
                    {
                      ...RM,
                      type: 'RAW_MATERIAL',
                      unit: { id: 'u-kg', code: 'KG', precision: 3 },
                      activeBom: null,
                    },
                  ],
          }),
        [`POST ${P}/boms`]: ok({ bom: current, timeline: tl('PRODUCTION_BOM_CREATED') }),
        [`GET ${P}/boms/bom3`]: () => ok({ bom: current, timeline: tl('PRODUCTION_BOM_CREATED') }),
        [`POST ${P}/boms/bom3/activate`]: () => {
          current = bom({
            status: 'ACTIVE',
            actions: ['retire', 'revise'],
            activatedAt: '2026-11-04T03:00:00.000Z',
          });
          return ok({ bom: current, timeline: tl('PRODUCTION_BOM_ACTIVATED') });
        },
      }),
    );
    renderRoute('/core/production/boms/new?lang=en');
    await userEvent.type(await screen.findByLabelText('Search the item to produce'), 'FG');
    await userEvent.click(await screen.findByRole('button', { name: /FG-000001/ }));
    await userEvent.type(screen.getByLabelText('Add material'), 'RM');
    await userEvent.click(await screen.findByRole('button', { name: /RM-000001/ }));
    const qty = screen.getByLabelText('Required (KG)');
    await userEvent.type(qty, '0.2505');
    expect(screen.getByRole('button', { name: 'Create draft' })).toBeDisabled();
    await userEvent.clear(qty);
    await userEvent.type(qty, '0.25');
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'BOM-FG-000001 · Revision 3' }),
    ).toBeInTheDocument();
    expect(api.called(`POST ${P}/boms`)[0]!.body).toEqual({
      itemId: 'fg',
      outputQuantity: '1',
      note: null,
      lines: [{ itemId: 'rm', quantity: '0.25' }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Activate this revision' }));
    expect(box().textContent).toMatch(/current active revision is retired/);
    await userEvent.click(within(box()).getByRole('button', { name: 'Activate this revision' }));
    await waitFor(() => expect(document.querySelector('[data-status="ACTIVE"]')).not.toBeNull());
    const revs = document.querySelector('[data-revisions]')!;
    expect(
      within(revs as HTMLElement).getByRole('link', { name: 'Revision 2' }),
    ).toBeInTheDocument();
  });

  it('requirements and sales demand: quantities only; creating from demand sends the sales line, nothing else', async () => {
    const req: RequirementRow = {
      item: RM,
      unit: { code: 'KG', precision: 3 },
      required: '12',
      reserved: '0',
      issued: '0',
      stillNeeded: '12',
      available: '0',
      shortage: '12',
      state: 'UNAVAILABLE',
      orderCount: 3,
      earliestRequiredDate: '2026-11-09',
    };
    const demand: DemandRow = {
      salesOrder: {
        id: 'so1',
        number: 'SO-202611-000003',
        status: 'CONFIRMED',
        requestedDate: '2026-11-20',
      },
      lineId: 'sol1',
      lineNo: 1,
      branch: REF,
      item: FG,
      unit: { code: 'PCS', precision: 0 },
      ordered: '100',
      dispatched: '0',
      reserved: '60',
      open: '40',
      availableShare: '0',
      uncovered: '40',
      planned: '0',
      suggested: '40',
      activeBom: BOM_REF,
      orders: [],
    };
    const api = fakeApi(
      as('staff', {
        [`GET ${P}/requirements`]: ok({ branchId: 'b1', items: [req] }),
        [`GET ${P}/demand`]: page([demand]),
        [`GET ${P}/requirements/preview`]: ok({
          bom: BOM_REF,
          quantity: '40',
          materialState: 'MATERIALS_SHORT',
          materials: order().materials,
        }),
        [`POST ${P}/orders`]: ok({
          order: order({ source: 'SALES_DEMAND', status: 'DRAFT', actions: [] }),
          timeline: [],
        }),
        [`GET ${P}/orders/mo1`]: ok({
          order: order({ source: 'SALES_DEMAND', status: 'DRAFT', actions: [] }),
          timeline: [],
        }),
      }),
    );
    const { unmount } = renderRoute('/core/production/requirements?lang=en');
    const r = (await screen.findByText('RM-000001')).closest('tr')!;
    expect(r.textContent).toMatch(/12 KG.*0 KG.*12 KG.*Unavailable/);
    unmount();
    renderRoute('/core/production/demand?lang=en');
    const d = (await screen.findByText('SO-202611-000003 #1')).closest('tr')!;
    expect(d.textContent).toMatch(/100 PCS.*60 PCS.*40 PCS/);
    expect(document.getElementById('main')!.textContent).not.toMatch(VALUES);
    await userEvent.click(within(d).getByRole('button', { name: 'Create production order' }));
    await waitFor(() => expect(document.querySelector('[data-from-demand]')).not.toBeNull());
    expect(document.querySelector('[data-from-demand]')!.textContent).toMatch(
      /SO-202611-000003 #1/,
    );
    expect(screen.getByLabelText('Quantity to produce (PCS)')).toHaveValue('40');
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }));
    await waitFor(() => expect(api.called(`POST ${P}/orders`)).toHaveLength(1));
    expect(api.called(`POST ${P}/orders`)[0]!.body).toEqual({
      salesOrderLineId: 'sol1',
      bomId: 'bom2',
      quantity: '40',
      plannedStartDate: null,
      requiredDate: null,
      priority: 'NORMAL',
      note: null,
    });
  });

  it('Purchasing shortage handoff: read-only material shortages of approved orders', async () => {
    const s: ShortageRow = {
      order: {
        id: 'mo1',
        number: 'MO-202611-000004',
        status: 'APPROVED',
        requiredDate: '2026-11-17',
        plannedStartDate: null,
      },
      branch: REF,
      material: RM,
      unit: { code: 'KG', precision: 3 },
      required: '10',
      available: '0',
      shortage: '10',
    };
    fakeApi({
      ...person(
        'DEPARTMENT_MANAGER',
        ['purchasing.workspace.view', 'purchasing.production_shortages.view'],
        ['PURCHASING'],
      ),
      'GET /api/v1/purchasing/production-shortages': ok({ items: [s] }),
    });
    renderRoute('/core/purchasing/production-shortages?lang=en');
    const r = (await screen.findByText('RM-000001')).closest('tr')!;
    expect(r.textContent).toMatch(/10 KG.*10 KG.*0 KG.*MO-202611-000004.*Approved/);
    expect(screen.getByText(/No purchase request is created automatically/)).toBeInTheDocument();
    expect(within(document.getElementById('main')!).queryByRole('button')).toBeNull();
  });

  it('Thai and Simplified Chinese: statuses, materials and warnings are translated', async () => {
    fakeApi(
      as('manager', {
        [`GET ${P}/orders/mo1`]: ok({
          order: order({ warnings: ['SOURCE_CANCELLED'] }),
          timeline: [],
        }),
      }),
    );
    const { unmount } = renderRoute('/core/production/orders/mo1?lang=th');
    expect(await screen.findByText('รออนุมัติ')).toBeInTheDocument();
    expect(screen.getByText('วัตถุดิบไม่พอ')).toBeInTheDocument();
    expect(screen.getByText(/คำสั่งขายต้นทางถูกยกเลิกแล้ว/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'อนุมัติ' })).toBeInTheDocument();
    unmount();
    fakeApi(as('manager', { [`GET ${P}/orders/mo1`]: ok({ order: order(), timeline: [] }) }));
    renderRoute('/core/production/orders/mo1?lang=zh');
    expect(await screen.findByText('待审批')).toBeInTheDocument();
    expect(screen.getByText('物料不足')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '审批通过' })).toBeInTheDocument();
  });
});
