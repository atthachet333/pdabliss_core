import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import { resetIdentityForTests } from '@/features/auth/session';
import type { BranchContext } from '@/features/company-center/api';
import type { BranchInfo, DepartmentCode } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { PrContext, PurchaseRequest } from './api';
import type {
  DepositDetail,
  OrderDetail,
  PoContext,
  PurchaseOrder,
  ReceiveDetail,
  SourceRequest,
} from './orderApi';

/*
 * EP30 purchase orders, deposits and pending receive (UI). Everything shown
 * comes from the server — amounts included; the page never computes a total.
 * Enforcement (permissions, branches, quantities, races, privacy) is tested
 * in backend/test/purchase-orders.test.ts.
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
const B0 = { id: 'b0', code: '00000', name: 'Head Office', type: 'HEAD_OFFICE' };
const PO = '/api/v1/purchase-orders';
const PR = '/api/v1/purchase-requests';

const coreContext = (
  departments: DepartmentCode[],
  permissions: string[],
  role: CompanyRole,
): BranchContext => ({
  company: { id: 'c1', displayName: 'Alpha Trading' },
  role,
  scope: 'ALL_BRANCHES',
  branches: [HO],
  selected: HO,
  needsSelection: false,
  blocked: null,
  departments,
  permissions: permissions as BranchContext['permissions'],
});

const PR_CTX: PrContext = {
  createDepartments: ['PURCHASING'],
  decideDepartments: ['PURCHASING'],
  purchasingView: true,
  cancelApproved: true,
  createOrders: true,
  branches: [B0],
  selectedBranch: B0,
};

const poContext = (over: Partial<PoContext> = {}): PoContext => ({
  orders: { view: true, create: true, edit: true, issue: true, cancel: true },
  deposits: { view: false, confirm: false },
  receiving: { view: false },
  executive: false,
  branches: [B0],
  selectedBranch: B0,
  ...over,
});

const person = (role: CompanyRole, departments: DepartmentCode[], permissions: string[]) => ({
  ...signedIn(
    identity({
      company: { id: 'c1', name: 'Alpha Trading', isDemo: false, role, canEnterCore: true },
    }),
  ),
  'GET /api/v1/company/context': ok(coreContext(departments, permissions, role)),
});

const buyer = (extra: Parameters<typeof fakeApi>[0] = {}) => ({
  ...person(
    'DEPARTMENT_MANAGER',
    ['PURCHASING'],
    [
      'purchasing.workspace.view',
      'purchasing.requests.view',
      'purchasing.requests.create',
      'purchasing.orders.view',
      'purchasing.orders.create',
    ],
  ),
  [`GET ${PR}/context`]: ok(PR_CTX),
  [`GET ${PO}/context`]: ok(poContext()),
  ...extra,
});

const order = (over: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'po1',
  number: 'PO-202610-000001',
  status: 'DRAFT',
  branch: B0,
  supplier: {
    id: 's1',
    code: 'SUP-000001',
    name: 'Siam Supply',
    taxId: '0105551234567',
    taxBranch: null,
    address: '1 Supplier Road',
    contactName: 'Khun Sales',
    phone: null,
    email: null,
    active: true,
  },
  currency: 'THB',
  orderDate: '2026-10-29',
  expectedDate: null,
  paymentTerms: 'Net 30',
  note: null,
  totals: {
    subtotal: '5760.00',
    discountTotal: '100.00',
    taxTotal: '396.20',
    grandTotal: '6056.20',
  },
  deposit: {
    type: 'PERCENT',
    value: '30',
    amount: '1816.86',
    dueDate: '2026-11-05',
    note: null,
    status: 'PENDING',
    confirmedAt: null,
    confirmedBy: null,
    reference: null,
    waivedAt: null,
    waivedBy: null,
    waiveReason: null,
  },
  createdBy: { name: 'Demo Purchasing' },
  issuedAt: null,
  issuedBy: null,
  pendingReceiveAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  lineCount: 1,
  lines: [
    {
      id: 'l1',
      lineNo: 1,
      type: 'ITEM',
      item: { id: 'i1', code: 'FG-000001', name: 'Finished good' },
      description: null,
      unit: { code: 'PCS', name: 'Piece' },
      quantity: '48',
      unitPrice: '120',
      discountAmount: '100.00',
      taxRate: '7',
      lineSubtotal: '5760.00',
      lineTax: '396.20',
      lineTotal: '6056.20',
      note: null,
      request: {
        id: 'pr1',
        number: 'PR-202610-000004',
        lineNo: 1,
        requested: '48',
        orderedElsewhere: '0',
        remaining: '48',
      },
      itemActive: true,
    },
  ],
  requests: [{ id: 'pr1', number: 'PR-202610-000004' }],
  actions: ['edit', 'issue', 'cancel'],
  ...over,
});

const detail = (o: PurchaseOrder): OrderDetail => ({
  view: 'purchasing',
  order: o,
  timeline: [
    {
      type: 'PURCHASE_ORDER_CREATED',
      at: '2026-10-29T03:00:00.000Z',
      actor: { name: 'Demo Purchasing' },
    },
  ],
});

const SOURCE: SourceRequest = {
  id: 'pr1',
  number: 'PR-202610-000004',
  department: 'PURCHASING',
  branch: B0,
  purpose: 'Next quarter',
  needByDate: null,
  lines: [
    {
      id: 'rl1',
      lineNo: 1,
      type: 'ITEM',
      item: { id: 'i1', code: 'FG-000001', name: 'Finished good' },
      description: null,
      unit: { code: 'PCS', name: 'Piece' },
      precision: 0,
      requested: '48',
      ordered: '0',
      inDraft: '0',
      remaining: '48',
    },
    {
      id: 'rl2',
      lineNo: 2,
      type: 'ITEM',
      item: { id: 'i2', code: 'PK-000001', name: 'Box' },
      description: null,
      unit: { code: 'BOX', name: 'Box' },
      precision: 0,
      requested: '200',
      ordered: '200',
      inDraft: '0',
      remaining: '0',
    },
  ],
};

afterEach(() => resetIdentityForTests());

describe('Purchase orders (EP30)', () => {
  it('the Purchasing workspace shows order tiles with server counts', async () => {
    fakeApi(
      buyer({
        [`GET ${PR}`]: ok({ items: [], total: 0, page: 1, pageSize: 1, hasMore: false }),
        [`GET ${PO}`]: ok({
          items: [],
          total: 4,
          page: 1,
          pageSize: 1,
          hasMore: false,
          counts: { DRAFT: 1, WAITING_DEPOSIT: 2, PENDING_RECEIVE: 3 },
        }),
        [`GET ${PO}/source-requests`]: ok({ requests: [{ id: 'pr1' }] }),
      }),
    );
    renderRoute('/core/purchasing?lang=en');
    await waitFor(() =>
      expect(document.querySelector('[data-tile="WAITING_DEPOSIT"]')).toHaveTextContent('2'),
    );
    expect(document.querySelector('[data-tile="toOrder"]')).toHaveTextContent('1');
    expect(document.querySelector('[data-tile="DRAFT"]')).toHaveTextContent('1');
    expect(document.querySelector('[data-tile="PENDING_RECEIVE"]')).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /Requests to order/ })).toHaveAttribute(
      'href',
      '/core/purchasing/orders/new',
    );
  });

  it('creates a draft from an approved request: remaining by default, checked before sending, no totals sent', async () => {
    const api = fakeApi(
      buyer({
        [`GET ${PO}/source-requests/pr1`]: ok({ request: SOURCE }),
        [`GET ${PO}/supplier-options`]: ok({
          suppliers: [{ id: 's1', code: 'SUP-000001', name: 'Siam Supply' }],
        }),
        [`POST ${PO}`]: ok(detail(order())),
        [`GET ${PO}/po1`]: ok(detail(order())),
      }),
    );
    renderRoute('/core/purchasing/orders/new?request=pr1&lang=en');
    const qty = await screen.findByLabelText('Quantity (PCS)');
    // Only lines with something left; default = what remains.
    expect(qty).toHaveValue('48');
    expect(document.querySelector('[data-source-line="2"]')).toBeNull();
    const user = userEvent.setup();
    await user.clear(qty);
    await user.type(qty, '49');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(
      await screen.findByText('This is more than the request still has to order.'),
    ).toBeInTheDocument();
    expect(qty).toHaveFocus();
    expect(api.called(`POST ${PO}`)).toHaveLength(0);
    await user.clear(qty);
    await user.type(qty, '48');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Supplier' }), 's1');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'PO-202610-000001' }),
    ).toBeInTheDocument();
    expect(api.called(`POST ${PO}`)[0]!.body).toEqual({
      purchaseRequestId: 'pr1',
      supplierId: 's1',
      lines: [{ purchaseRequestLineId: 'rl1', quantity: '48' }],
    });
  });

  it('a draft shows the server’s amounts; a line edit sends decimal strings only; issue is confirmed in place', async () => {
    const issued = order({
      status: 'WAITING_DEPOSIT',
      actions: ['cancel'],
      issuedAt: '2026-10-29T04:00:00.000Z',
      issuedBy: { name: 'Demo Purchasing' },
    });
    const api = fakeApi(
      buyer({
        [`GET ${PO}/po1`]: ok(detail(order())),
        [`PATCH ${PO}/po1/lines/l1`]: ok(detail(order())),
        [`POST ${PO}/po1/issue`]: ok(detail(issued)),
        [`GET ${PO}/supplier-options`]: ok({ suppliers: [] }),
      }),
    );
    renderRoute('/core/purchasing/orders/po1?lang=en');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'PO-202610-000001' }),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-grand-total]')).toHaveTextContent('6,056.20 THB');
    expect(screen.getByText(/1,816\.86 THB \(30%\)/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit #1' }));
    const editor = within(document.querySelector<HTMLElement>('[data-line-editor="1"]')!);
    const price = editor.getByLabelText('Unit price');
    await user.clear(price);
    await user.type(price, '9.12345');
    await user.click(editor.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Not a valid number')).toBeInTheDocument();
    expect(api.called(`PATCH ${PO}/po1/lines/l1`)).toHaveLength(0);
    await user.clear(price);
    await user.type(price, '120.5');
    await user.click(editor.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.called(`PATCH ${PO}/po1/lines/l1`)).toHaveLength(1));
    const body = api.called(`PATCH ${PO}/po1/lines/l1`)[0]!.body as Record<string, unknown>;
    expect(body).toEqual({
      quantity: '48',
      unitPrice: '120.5',
      discountAmount: '100.00',
      taxRate: '7',
      note: null,
    });
    expect(
      Object.keys(body).some((k) => /total|subtotal|amount$/i.test(k) && k !== 'discountAmount'),
    ).toBe(false);
    // Issue: confirmed in place, focus returns to the heading.
    await user.click(screen.getByRole('button', { name: 'Issue order' }));
    const box = screen.getByRole('group', { name: /Issue this order/ });
    await user.click(within(box).getByRole('button', { name: 'Issue order' }));
    expect(
      await screen.findByText('Waiting for deposit', { selector: '[data-po-status]' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Issue order' })).toBeNull();
    // Cancelling an issued order asks for a reason.
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    const cancelBox = screen.getByRole('group', { name: /Cancel this order/ });
    await user.click(within(cancelBox).getByRole('button', { name: 'Cancel order' }));
    expect(within(cancelBox).getByText('Please give a reason')).toBeInTheDocument();
  });

  it('server refusals are shown in words; the Executive gets a read-only summary', async () => {
    fakeApi(
      buyer({
        [`GET ${PO}/po1`]: ok(detail(order())),
        [`POST ${PO}/po1/issue`]: fail(422, 'PO_INCOMPLETE'),
        [`GET ${PO}/supplier-options`]: ok({ suppliers: [] }),
        [`GET ${PO}/po2`]: ok({
          view: 'executive',
          order: {
            id: 'po2',
            number: 'PO-202610-000002',
            status: 'PENDING_RECEIVE',
            branch: B0,
            supplier: { code: 'SUP-000001', name: 'Siam Supply' },
            currency: 'THB',
            orderDate: '2026-10-29',
            expectedDate: null,
            issuedAt: '2026-10-29T04:00:00.000Z',
            cancelledAt: null,
            grandTotal: '363.80',
            deposit: { status: 'NOT_REQUIRED', amount: null },
            lineCount: 1,
            requests: [{ id: 'pr2', number: 'PR-202610-000003' }],
          },
        }),
      }),
    );
    renderRoute('/core/purchasing/orders/po1?lang=en');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Issue order' }));
    await user.click(
      within(screen.getByRole('group', { name: /Issue this order/ })).getByRole('button', {
        name: 'Issue order',
      }),
    );
    expect(
      await screen.findByText(
        'Not ready to issue: it needs a supplier, lines and a price on every line.',
      ),
    ).toBeInTheDocument();
  });

  it('the Executive summary has no actions, no lines and no supplier contact', async () => {
    fakeApi(
      buyer({
        [`GET ${PO}/context`]: ok(
          poContext({
            executive: true,
            orders: { view: true, create: false, edit: false, issue: false, cancel: false },
          }),
        ),
        [`GET ${PO}/po2`]: ok({
          view: 'executive',
          order: {
            id: 'po2',
            number: 'PO-202610-000002',
            status: 'PENDING_RECEIVE',
            branch: B0,
            supplier: { code: 'SUP-000001', name: 'Siam Supply' },
            currency: 'THB',
            orderDate: '2026-10-29',
            expectedDate: null,
            issuedAt: '2026-10-29T04:00:00.000Z',
            cancelledAt: null,
            grandTotal: '363.80',
            deposit: { status: 'NOT_REQUIRED', amount: null },
            lineCount: 1,
            requests: [{ id: 'pr2', number: 'PR-202610-000003' }],
          },
        }),
      }),
    );
    renderRoute('/core/purchasing/orders/po2?lang=en');
    expect(await screen.findByText('Executive summary — read only')).toBeInTheDocument();
    expect(screen.getByText('363.80 THB')).toBeInTheDocument();
    const page = document.querySelector<HTMLElement>('[data-view="executive"]')!;
    expect(within(page).queryByRole('button')).toBeNull();
    expect(document.querySelector('[data-lines]')).toBeNull();
    expect(page.textContent).not.toContain('Khun Sales');
  });

  it('the request page shows ordered / remaining and links to its orders', async () => {
    const r: PurchaseRequest = {
      id: 'pr1',
      number: 'PR-202610-000004',
      status: 'APPROVED',
      department: 'PURCHASING',
      branch: B0,
      requester: { memberId: 'm1', name: 'Demo Purchasing', isMe: true },
      requestDate: '2026-10-29',
      needByDate: null,
      purpose: 'Next quarter',
      submittedAt: '2026-10-29T03:00:00.000Z',
      approvedAt: '2026-10-29T03:10:00.000Z',
      approvedBy: { name: 'Owner' },
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      lines: [
        {
          id: 'rl1',
          lineNo: 1,
          type: 'ITEM',
          item: { id: 'i1', code: 'FG-000001', name: 'Finished good', active: true },
          description: null,
          unit: { id: 'u1', code: 'PCS', name: 'Piece' },
          quantity: '48',
          note: null,
          ordering: {
            requested: '48',
            ordered: '20',
            inDraft: '0',
            remaining: '28',
            state: 'PARTIALLY_ORDERED',
            orders: [
              { id: 'po1', number: 'PO-202610-000001', status: 'PENDING_RECEIVE', quantity: '20' },
            ],
          },
        },
      ],
      orderState: 'PARTIALLY_ORDERED',
      updatedAt: '2026-10-29T03:10:00.000Z',
    };
    fakeApi(buyer({ [`GET ${PR}/pr1`]: ok({ request: r, actions: ['cancel'], timeline: [] }) }));
    renderRoute('/core/purchasing/requests/pr1?lang=en');
    expect(await screen.findByText(/Ordered 20 · Remaining 28/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PO-202610-000001' })).toHaveAttribute(
      'href',
      '/core/purchasing/orders/po1',
    );
    expect(screen.getByRole('link', { name: 'Order from this request' })).toHaveAttribute(
      'href',
      '/core/purchasing/orders/new?request=pr1',
    );
    // The requested quantity itself is unchanged on the page.
    expect(document.querySelector('[data-line="1"]')).toHaveTextContent('48');
  });
});

describe('Deposits and pending receive (EP30)', () => {
  const ACCT = '/api/v1/accounting/deposits';
  const RCV = '/api/v1/warehouse/pending-receive';
  const depositOrder = (over: Partial<DepositDetail['order']> = {}): DepositDetail => ({
    view: 'accounting',
    order: {
      id: 'po1',
      number: 'PO-202610-000002',
      status: 'WAITING_DEPOSIT',
      branch: B0,
      supplier: {
        code: 'SUP-000001',
        name: 'Siam Supply',
        taxId: '0105551234567',
        taxBranch: null,
      },
      currency: 'THB',
      orderDate: '2026-10-29',
      issuedAt: '2026-10-29T04:00:00.000Z',
      issuedBy: { name: 'Demo Purchasing' },
      paymentTerms: '30% deposit',
      totals: {
        subtotal: '5760.00',
        discountTotal: '100.00',
        taxTotal: '396.20',
        grandTotal: '6056.20',
      },
      deposit: order().deposit,
      lineCount: 1,
      lines: order().lines,
      actions: ['confirm_deposit', 'waive_deposit'],
      ...over,
    },
  });
  const accountant = (extra: Parameters<typeof fakeApi>[0] = {}) => ({
    ...person(
      'DEPARTMENT_MANAGER',
      ['ACCOUNTING'],
      ['accounting.workspace.view', 'accounting.deposits.view', 'accounting.deposits.confirm'],
    ),
    ...extra,
  });

  it('CORE links Accounting to its deposits and Warehouse to pending receive', async () => {
    fakeApi(accountant());
    renderRoute('/core?lang=en');
    expect(await screen.findByRole('link', { name: 'Deposits to confirm' })).toHaveAttribute(
      'href',
      '/core/accounting/deposits',
    );
    resetIdentityForTests();
    document.body.innerHTML = '';
    fakeApi(
      person(
        'DEPARTMENT_STAFF',
        ['WAREHOUSE'],
        ['warehouse.workspace.view', 'warehouse.receiving.view'],
      ),
    );
    renderRoute('/core?lang=en');
    expect(await screen.findByRole('link', { name: 'Orders pending receive' })).toHaveAttribute(
      'href',
      '/core/warehouse/pending-receive',
    );
  });

  it('Accounting confirms a deposit with an optional reference; waiving needs a reason', async () => {
    const confirmed = depositOrder({
      status: 'PENDING_RECEIVE',
      deposit: {
        ...order().deposit,
        status: 'CONFIRMED',
        confirmedAt: '2026-10-29T05:00:00.000Z',
        confirmedBy: { name: 'Demo Accounting' },
        reference: 'TRF-0001',
      },
      actions: [],
    });
    const api = fakeApi(
      accountant({
        [`GET ${ACCT}`]: ok({
          items: [depositOrder().order],
          total: 1,
          page: 1,
          pageSize: 50,
          hasMore: false,
        }),
        [`GET ${ACCT}/po1`]: ok(depositOrder()),
        [`POST ${PO}/po1/deposit/confirm`]: ok(confirmed),
      }),
    );
    renderRoute('/core/accounting/deposits?lang=en');
    const link = await screen.findByRole('link', { name: 'PO-202610-000002' });
    expect(screen.getByText('1,816.86 THB')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(link);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'PO-202610-000002' }),
    ).toBeInTheDocument();
    // Waive first: a reason is required.
    await user.click(screen.getByRole('button', { name: 'Waive deposit' }));
    const waive = screen.getByRole('group', { name: /Waive the deposit/ });
    await user.click(within(waive).getByRole('button', { name: 'Waive deposit' }));
    expect(within(waive).getByText('Please give a reason')).toBeInTheDocument();
    await user.click(within(waive).getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Confirm deposit paid' }));
    const box = screen.getByRole('group', { name: /Confirm the deposit/ });
    expect(within(box).getByText(/never an account number or password/)).toBeInTheDocument();
    await user.type(within(box).getByLabelText('Payment reference'), 'TRF-0001');
    await user.click(within(box).getByRole('button', { name: 'Confirm deposit paid' }));
    expect(
      await screen.findByText('Deposit recorded — the order is pending receive'),
    ).toBeInTheDocument();
    expect(api.called(`POST ${PO}/po1/deposit/confirm`)[0]!.body).toEqual({
      reference: 'TRF-0001',
    });
    expect(screen.queryByRole('button', { name: 'Confirm deposit paid' })).toBeNull();
  });

  it('Warehouse sees quantities only — no money label or amount on the page (TH)', async () => {
    const pending: ReceiveDetail = {
      view: 'warehouse',
      order: {
        id: 'po3',
        number: 'PO-202610-000003',
        status: 'PENDING_RECEIVE',
        branch: { id: 'b1', code: '00001', name: 'Demo Branch' },
        supplier: { code: 'SUP-000001', name: 'Siam Supply' },
        orderDate: '2026-10-29',
        expectedDate: '2026-11-02',
        issuedAt: '2026-10-29T04:00:00.000Z',
        pendingReceiveAt: '2026-10-29T04:00:00.000Z',
        lineCount: 1,
        lines: [
          {
            id: 'l1',
            lineNo: 1,
            type: 'ITEM',
            item: { id: 'i1', code: 'RM-000001', name: 'Raw material' },
            description: null,
            unit: { code: 'KG', name: 'Kilogram' },
            quantity: '8',
            request: { id: 'pr1', number: 'PR-202610-000003', lineNo: 1 },
          },
        ],
      },
    };
    fakeApi({
      ...person(
        'DEPARTMENT_STAFF',
        ['WAREHOUSE'],
        ['warehouse.workspace.view', 'warehouse.receiving.view'],
      ),
      [`GET ${RCV}`]: ok({
        items: [{ ...pending.order, lines: undefined }],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false,
      }),
      [`GET ${RCV}/po3`]: ok(pending),
    });
    renderRoute('/core/warehouse/pending-receive?lang=th');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('link', { name: 'PO-202610-000003' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'PO-202610-000003' }),
    ).toBeInTheDocument();
    expect(screen.getByText('รอรับสินค้า', { selector: '[data-po-status]' })).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).toContain('RM-000001');
    for (const word of ['ราคาต่อหน่วย', 'ยอดรวม', 'มัดจำ', 'ภาษี', 'THB', 'ส่วนลด', 'Unit price']) {
      expect(text).not.toContain(word);
    }
    expect(screen.queryByRole('button', { name: /รับสินค้า/ })).toBeNull();
  });
});
