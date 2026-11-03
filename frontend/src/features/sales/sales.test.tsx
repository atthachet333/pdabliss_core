import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext } from '@/features/company-center/api';
import type { BranchInfo } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { SalesContext, SalesOrder, SoRow } from './salesApi';

/*
 * EP33 Sales screens (UI): the workspace counts and list, a draft's header and
 * lines (exact decimal strings out, server amounts in — the client never sends
 * a total), only the actions the server lists, a reason before cancelling a
 * submitted / confirmed order, availability worded as information, and server
 * refusals in words. The server enforces everything again
 * (backend/test/sales-orders.test.ts); nothing here shows a cost.
 */

const HO: BranchInfo = {
  id: 'b0',
  code: '00000',
  name: 'Head Office',
  type: 'HEAD_OFFICE',
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
const REF = { id: 'b0', code: '00000', name: 'Head Office' };
const S = '/api/v1/sales';
const COST = /cost|margin|supplier/i;

const person = (role: CompanyRole, permissions: string[], departments = ['SALES']) => ({
  ...signedIn(
    identity({ company: { id: 'c1', name: 'Alpha', isDemo: false, role, canEnterCore: true } }),
  ),
  'GET /api/v1/company/context': ok({
    company: { id: 'c1', displayName: 'Alpha' },
    role,
    scope: 'SELECTED_BRANCHES',
    branches: [HO],
    selected: HO,
    needsSelection: false,
    blocked: null,
    departments: departments as BranchContext['departments'],
    permissions: permissions as BranchContext['permissions'],
  } satisfies BranchContext),
});

const ctx = (manager: boolean): SalesContext => ({
  orders: { view: true, create: true, confirm: manager, cancel: manager },
  branches: [{ ...REF, type: 'HEAD_OFFICE' }],
  selectedBranch: { ...REF, type: 'HEAD_OFFICE' },
  counts: { myDrafts: 2, awaitingConfirmation: 1, confirmed: 4, withShortage: 1 },
  today: '2026-11-03',
});

const STAFF = ['sales.workspace.view', 'sales.orders.view', 'sales.orders.create'];
const as = (manager: boolean, extra: Parameters<typeof fakeApi>[0] = {}) => ({
  ...person(
    manager ? 'DEPARTMENT_MANAGER' : 'DEPARTMENT_STAFF',
    manager ? [...STAFF, 'sales.orders.approve', 'sales.orders.cancel'] : STAFF,
  ),
  [`GET ${S}/context`]: ok(ctx(manager)),
  ...extra,
});

const row = (over: Partial<SoRow> = {}): SoRow => ({
  id: 'o1',
  number: 'SO-202611-000001',
  status: 'SUBMITTED',
  branch: REF,
  customer: { id: 'cu1', code: 'CUS-000001', name: 'Demo Shop' },
  orderDate: '2026-11-03',
  requestedDate: '2026-11-10',
  lineCount: 1,
  currency: 'THB',
  grandTotal: '2311.20',
  availability: 'PARTIALLY_AVAILABLE',
  allocationState: null,
  pickReadiness: null,
  createdBy: { name: 'Demo Sales' },
  updatedAt: '2026-11-03T02:00:00.000Z',
  ...over,
});

const order = (over: Partial<SalesOrder> = {}): SalesOrder => ({
  ...row(),
  customer: {
    id: 'cu1',
    code: 'CUS-000001',
    name: 'Demo Shop',
    taxId: '0105559999999',
    taxBranch: null,
  },
  customerReference: 'PO-778',
  note: null,
  subtotal: '2220.00',
  discountTotal: '60.00',
  taxTotal: '151.20',
  taxTotalLabel: 'exclusive',
  shortageLines: 1,
  createdAt: '2026-11-03T02:00:00.000Z',
  submittedAt: '2026-11-03T02:10:00.000Z',
  submittedBy: { name: 'Demo Sales' },
  confirmedAt: null,
  confirmedBy: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  lines: [
    {
      id: 'l1',
      lineNo: 1,
      item: {
        id: 'i1',
        code: 'FG-000001',
        name: 'Finished good',
        type: 'FINISHED_GOOD',
        inventoryTracked: true,
      },
      unit: { code: 'PCS', name: 'Piece', precision: 0 },
      quantity: '12',
      unitPrice: '185',
      discountAmount: '60.00',
      taxRate: '7',
      lineSubtotal: '2220.00',
      lineTax: '151.20',
      lineTotal: '2311.20',
      note: null,
      availability: {
        state: 'PARTIALLY_AVAILABLE',
        onHand: '9',
        reserved: '1',
        available: '8',
        shortage: '4',
      },
      allocation: null,
      progress: {
        ordered: '12',
        allocated: null,
        picked: null,
        delivered: null,
        outstanding: null,
      },
    },
  ],
  actions: [],
  ...over,
});
const tl = (...types: string[]) =>
  types.map((type) => ({ type, at: '2026-11-03T02:00:00.000Z', actor: { name: 'Demo Sales' } }));

describe('Sales orders (EP33)', () => {
  it('the workspace shows counts, a filterable list and informational availability', async () => {
    const api = fakeApi(
      as(false, {
        [`GET ${S}/orders`]: (_b, q) =>
          ok({
            items: q.get('status') === 'DRAFT' ? [] : [row()],
            total: q.get('status') === 'DRAFT' ? 0 : 1,
            page: 1,
            pageSize: 25,
            hasMore: false,
          }),
      }),
    );
    renderRoute('/core/sales?lang=en');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sales orders' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'SO-202611-000001' })).toBeInTheDocument();
    const tiles = document.querySelector('[data-sales-counts]') as HTMLElement;
    expect(within(tiles).getByText('Awaiting confirmation')).toBeInTheDocument();
    expect(within(tiles).getByText('4')).toBeInTheDocument();
    expect(screen.getAllByText('Partly in stock').length).toBeGreaterThan(0);
    expect(screen.getByText(/not a reservation/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New sales order' })).toBeInTheDocument();
    // A count tile is a filter (pressed state, server query).
    await userEvent.click(within(tiles).getByRole('button', { name: /My drafts/ }));
    await waitFor(() => expect(screen.getByText('No sales orders match.')).toBeInTheDocument());
    expect(api.calls.some((c) => c.path === `${S}/orders` && c.query.status === 'DRAFT')).toBe(
      true,
    );
    expect(within(tiles).getByRole('button', { name: /My drafts/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Short of stock only' }));
    await waitFor(() =>
      expect(
        api.calls.some((c) => c.path === `${S}/orders` && c.query.availability === 'SHORTAGE'),
      ).toBe(true),
    );
    expect(document.body.textContent).not.toMatch(COST);
  });

  it('creates a draft for a customer, then opens it', async () => {
    const api = fakeApi(
      as(false, {
        'GET /api/v1/master-data/customers': ok({
          items: [{ id: 'cu1', code: 'CUS-000001', name: 'Demo Shop', status: 'ACTIVE' }],
          total: 1,
          page: 1,
          pageSize: 20,
          hasMore: false,
        }),
        [`POST ${S}/orders`]: ok({
          order: order({ status: 'DRAFT', lines: [], actions: ['edit', 'submit', 'cancel'] }),
          timeline: tl('SALES_ORDER_CREATED'),
        }),
        [`GET ${S}/orders/o1`]: ok({
          order: order({ status: 'DRAFT', lines: [], actions: ['edit', 'submit', 'cancel'] }),
          timeline: tl('SALES_ORDER_CREATED'),
        }),
      }),
    );
    renderRoute('/core/sales/orders/new?lang=en');
    const create = await screen.findByRole('button', { name: 'Create draft' });
    expect(create).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'CUS-000001 · Demo Shop' })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(screen.getByLabelText('Customer'), 'cu1');
    await userEvent.type(screen.getByLabelText('Customer reference'), 'PO-778');
    await userEvent.click(create);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'SO-202611-000001' }),
    ).toBeInTheDocument();
    const post = api.called(`POST ${S}/orders`)[0]!;
    expect(post.body).toEqual({
      customerId: 'cu1',
      orderDate: '2026-11-03',
      requestedDate: null,
      customerReference: 'PO-778',
      note: null,
    });
    expect(screen.getByText(/No lines yet/)).toBeInTheDocument();
  });

  it('edits draft lines with exact strings, checks precision, never sends a total', async () => {
    const draft = order({ status: 'DRAFT', actions: ['edit', 'submit', 'cancel'] });
    const api = fakeApi(
      as(false, {
        [`GET ${S}/orders/o1`]: ok({ order: draft, timeline: tl('SALES_ORDER_CREATED') }),
        [`GET ${S}/items`]: ok({
          items: [
            {
              id: 'i2',
              code: 'RM-000001',
              name: 'Resin',
              type: 'RAW_MATERIAL',
              inventoryTracked: true,
              unit: { code: 'KG', name: 'Kilogram', precision: 3 },
              available: '2.5',
            },
          ],
        }),
        [`PUT ${S}/orders/o1/lines`]: ok({ order: draft, timeline: tl('SALES_ORDER_CREATED') }),
      }),
    );
    renderRoute('/core/sales/orders/o1?lang=en');
    const qty = await screen.findByLabelText('Quantity (PCS)');
    await userEvent.clear(qty);
    await userEvent.type(qty, '1.5');
    await userEvent.click(screen.getByRole('button', { name: 'Save lines' }));
    expect(await screen.findByText('Must be a whole number')).toBeInTheDocument();
    expect(api.called(`PUT ${S}/orders/o1/lines`)).toHaveLength(0);
    await userEvent.clear(qty);
    await userEvent.type(qty, '10');
    await userEvent.type(screen.getByLabelText('Add an item'), 'RM');
    await userEvent.click(await screen.findByRole('button', { name: /RM-000001 · Resin/ }));
    const kg = screen.getByLabelText('Quantity (KG)');
    await userEvent.clear(kg);
    await userEvent.type(kg, '0.125');
    const prices = screen.getAllByLabelText('Unit price');
    await userEvent.clear(prices[1]!);
    await userEvent.type(prices[1]!, '80.5');
    expect(screen.getByText('You have unsaved line changes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save lines' }));
    await waitFor(() => expect(api.called(`PUT ${S}/orders/o1/lines`)).toHaveLength(1));
    expect(api.called(`PUT ${S}/orders/o1/lines`)[0]!.body).toEqual({
      lines: [
        {
          itemId: 'i1',
          quantity: '10',
          unitPrice: '185',
          discountAmount: '60.00',
          taxRate: '7',
          note: null,
        },
        {
          itemId: 'i2',
          quantity: '0.125',
          unitPrice: '80.5',
          discountAmount: '0',
          taxRate: '7',
          note: null,
        },
      ],
    });
    expect(JSON.stringify(api.calls.map((c) => c.body))).not.toMatch(/total|subtotal/i);
  });

  it('staff see a submitted order read-only; a manager confirms after being asked', async () => {
    fakeApi(
      as(false, {
        [`GET ${S}/orders/o1`]: ok({
          order: order(),
          timeline: tl('SALES_ORDER_CREATED', 'SALES_ORDER_SUBMITTED'),
        }),
      }),
    );
    const { unmount } = renderRoute('/core/sales/orders/o1?lang=en');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'SO-202611-000001' }),
    ).toBeInTheDocument();
    expect(screen.getByText('You can view this order only.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm order' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save lines' })).toBeNull();
    // Server amounts and line availability, worded as information.
    expect(screen.getByText('2,311.20 THB')).toBeInTheDocument();
    expect(screen.getByText('Short 4')).toBeInTheDocument();
    expect(screen.getByText(/Picking and delivery arrive in a later phase/)).toBeInTheDocument();
    unmount();

    let current = order({ actions: ['confirm', 'cancel'] });
    const api = fakeApi(
      as(true, {
        [`GET ${S}/orders/o1`]: () => ok({ order: current, timeline: tl('SALES_ORDER_SUBMITTED') }),
        [`POST ${S}/orders/o1/confirm`]: () => {
          current = order({
            status: 'CONFIRMED',
            confirmedAt: '2026-11-03T03:00:00.000Z',
            confirmedBy: { name: 'Manager' },
            actions: ['cancel'],
          });
          return ok({
            order: current,
            timeline: tl('SALES_ORDER_SUBMITTED', 'SALES_ORDER_CONFIRMED'),
          });
        },
      }),
    );
    renderRoute('/core/sales/orders/o1?lang=en');
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm order' }));
    expect(screen.getByText(/stock is not affected/)).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'Confirm order' }),
    );
    await waitFor(() =>
      expect(document.querySelector('[data-so-status="CONFIRMED"]')).not.toBeNull(),
    );
    expect(api.called(`POST ${S}/orders/o1/confirm`)[0]!.body).toEqual({});
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
  });

  it('cancelling a confirmed order needs a reason first', async () => {
    let current = order({ status: 'CONFIRMED', actions: ['cancel'] });
    const api = fakeApi(
      as(true, {
        [`GET ${S}/orders/o1`]: () => ok({ order: current, timeline: [] }),
        [`POST ${S}/orders/o1/cancel`]: (body) => {
          current = order({
            status: 'CANCELLED',
            availability: null,
            cancellationReason: (body as { reason: string }).reason,
            actions: [],
          });
          return ok({ order: current, timeline: [] });
        },
      }),
    );
    renderRoute('/core/sales/orders/o1?lang=en');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    const box = screen.getByRole('group');
    await userEvent.click(within(box).getByRole('button', { name: 'Cancel order' }));
    await waitFor(() =>
      expect(within(box).getByRole('textbox')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(api.called(`POST ${S}/orders/o1/cancel`)).toHaveLength(0);
    await userEvent.type(within(box).getByRole('textbox'), 'Customer withdrew');
    await userEvent.click(within(box).getByRole('button', { name: 'Cancel order' }));
    await waitFor(() =>
      expect(document.querySelector('[data-so-status="CANCELLED"]')).not.toBeNull(),
    );
    expect(api.called(`POST ${S}/orders/o1/cancel`)[0]!.body).toEqual({
      reason: 'Customer withdrew',
    });
    expect(screen.getByText('Customer withdrew')).toBeInTheDocument();
  });

  it('shows server refusals and a hidden order in words', async () => {
    fakeApi(
      as(true, {
        [`GET ${S}/orders/o1`]: ok({
          order: order({ actions: ['confirm', 'cancel'] }),
          timeline: [],
        }),
        [`POST ${S}/orders/o1/confirm`]: fail(422, 'REFERENCE_INACTIVE'),
        [`GET ${S}/orders/o2`]: fail(404, 'SO_NOT_FOUND'),
      }),
    );
    const { unmount } = renderRoute('/core/sales/orders/o1?lang=th');
    await userEvent.click(await screen.findByRole('button', { name: 'ยืนยันคำสั่งขาย' }));
    await userEvent.click(
      within(screen.getByRole('group')).getByRole('button', { name: 'ยืนยันคำสั่งขาย' }),
    );
    expect(await screen.findByText('ลูกค้าหรือสินค้าที่เลือกถูกปิดใช้งาน')).toBeInTheDocument();
    unmount();
    renderRoute('/core/sales/orders/o2?lang=en');
    expect(
      await screen.findByText('This sales order was not found, or you may not see it.'),
    ).toBeInTheDocument();
  });

  it('without Sales access the workspace says so; CORE home links Sales only for viewers', async () => {
    fakeApi({
      ...person('DEPARTMENT_STAFF', ['warehouse.workspace.view'], ['WAREHOUSE']),
      [`GET ${S}/context`]: fail(403, 'PERMISSION_DENIED'),
    });
    const { unmount } = renderRoute('/core/sales?lang=en');
    expect(
      await screen.findByText('You do not have permission for this action.'),
    ).toBeInTheDocument();
    unmount();
    fakeApi(as(false));
    renderRoute('/core?lang=en');
    expect(await screen.findByRole('link', { name: 'Open sales orders' })).toHaveAttribute(
      'href',
      '/core/sales',
    );
  });
});
