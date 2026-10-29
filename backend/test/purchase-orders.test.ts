import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { allowedFields } from '../src/domain/access/data-classification.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import {
  PERMISSION_ACTIONS,
  PERMISSION_CATALOG,
  isRoleDefault,
} from '../src/permissions/catalog.js';
import { depositAmount, lineAmounts, orderTotals } from '../src/purchasing/money.js';
import { poRefusal, type PoActor } from '../src/purchasing/order-policy.js';
import {
  NON_OPERATIONAL_FIELDS,
  WAREHOUSE_FIELD_CLASSES,
  WarehousePendingReceiveView,
} from '../src/purchasing/order-views.js';
import { companyDay } from '../src/purchasing/service.js';
import {
  createActiveCompany,
  createHarness,
  createUser,
  describeDb,
  resetDb,
  signIn,
  type ApiResponse,
  type Browser,
  type Harness,
} from './support.js';

/*
 * EP30 purchase orders: numbering, creation from approved requests, exact
 * server-side money, issue / deposit / cancel transitions, derived ordered and
 * remaining quantities (partial, multiple orders, release on cancel), the
 * issue race (remaining 10, two orders of 7), branch equality, the audience
 * views (Warehouse never sees money — even by direct API), permissions per
 * role, company isolation, Platform redaction, audit and timeline.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const PO = '/api/v1/purchase-orders';
const DEPOSITS = '/api/v1/accounting/deposits';
const RECEIVE = '/api/v1/warehouse/pending-receive';
const MONEY = /price|discount|tax|total|amount|deposit|currency|payment|terms|cost|margin|note/i;

const keysOf = (v: unknown, out: string[] = []): string[] => {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      out.push(k);
      keysOf(x, out);
    }
  }
  return out;
};

// ------------------------------------------------------------------ static

describe('Purchase order policy and arithmetic (EP30)', () => {
  it('adds order, deposit and receiving codes — issue is the approve tier, no synonyms', () => {
    const codes = PERMISSION_CATALOG.map((p) => p.code as string);
    for (const c of [
      'purchasing.orders.view',
      'purchasing.orders.create',
      'purchasing.orders.edit',
      'purchasing.orders.approve',
      'purchasing.orders.cancel',
      'accounting.deposits.view',
      'accounting.deposits.confirm',
      'warehouse.receiving.view',
    ]) {
      expect(codes).toContain(c);
    }
    expect(PERMISSION_ACTIONS).not.toContain('issue');
    expect(codes.some((c) => /\.(issue|waive)$/.test(c))).toBe(false);
    // Staff draft; Managers issue / cancel / confirm.
    expect(isRoleDefault('DEPARTMENT_STAFF', 'purchasing.orders.edit')).toBe(true);
    expect(isRoleDefault('DEPARTMENT_STAFF', 'purchasing.orders.approve')).toBe(false);
    expect(isRoleDefault('DEPARTMENT_STAFF', 'accounting.deposits.confirm')).toBe(false);
    expect(isRoleDefault('DEPARTMENT_MANAGER', 'accounting.deposits.confirm')).toBe(true);
    expect(isRoleDefault('EXECUTIVE', 'purchasing.orders.view')).toBe(true);
    expect(isRoleDefault('EXECUTIVE', 'purchasing.orders.create')).toBe(false);
    for (const p of PERMISSION_CATALOG.filter((x) => x.namespace === 'WAREHOUSE')) {
      expect(p.code).not.toMatch(/deposit|order|price|payment/);
    }
  });

  it('decides every order transition in one table', () => {
    const actor = (over: Partial<PoActor> = {}): PoActor =>
      ({
        memberId: 'me',
        branches: [{ id: 'b1', code: '00001', name: 'B', type: 'BRANCH' }],
        orders: { view: true, create: true, edit: false, issue: false, cancel: false },
        deposits: { view: false, confirm: false },
        receiving: { view: false },
        executive: false,
        ...over,
      }) as PoActor;
    const o = (status: any, over: J = {}) => ({
      status,
      branchId: 'b1',
      createdByMemberId: 'me',
      ...over,
    });
    const mgr = actor({
      orders: { view: true, create: true, edit: true, issue: true, cancel: true },
    });
    const acct = actor({
      orders: { view: false, create: false, edit: false, issue: false, cancel: false },
      deposits: { view: true, confirm: true },
    });
    expect(poRefusal(actor(), 'edit', o('DRAFT'))).toBeNull(); // own draft with create
    expect(poRefusal(actor(), 'edit', o('DRAFT', { createdByMemberId: 'x' }))).toBe('authority');
    expect(poRefusal(mgr, 'edit', o('DRAFT', { createdByMemberId: 'x' }))).toBeNull();
    expect(poRefusal(actor(), 'issue', o('DRAFT'))).toBe('authority');
    expect(poRefusal(mgr, 'issue', o('DRAFT'))).toBeNull();
    expect(poRefusal(mgr, 'issue', o('PENDING_RECEIVE'))).toBe('status');
    expect(poRefusal(actor(), 'cancel', o('DRAFT'))).toBeNull();
    expect(poRefusal(actor(), 'cancel', o('PENDING_RECEIVE'))).toBe('authority');
    expect(poRefusal(mgr, 'cancel', o('WAITING_DEPOSIT'))).toBeNull();
    expect(poRefusal(mgr, 'confirm_deposit', o('WAITING_DEPOSIT'))).toBe('authority');
    expect(poRefusal(acct, 'confirm_deposit', o('WAITING_DEPOSIT'))).toBeNull();
    expect(poRefusal(acct, 'waive_deposit', o('PENDING_RECEIVE'))).toBe('status');
    expect(poRefusal(acct, 'edit', o('DRAFT'))).toBe('authority');
    for (const a of ['edit', 'issue', 'cancel', 'confirm_deposit', 'waive_deposit'] as const) {
      const all = actor({
        orders: { view: true, create: true, edit: true, issue: true, cancel: true },
        deposits: { view: true, confirm: true },
      });
      expect(poRefusal(all, a, o('CANCELLED'))).toBe('status');
    }
    expect(poRefusal(mgr, 'issue', o('DRAFT', { branchId: 'b2' }))).toBe('branch');
  });

  it('computes money exactly, half-up per line', () => {
    const l = lineAmounts({
      quantity: '3',
      unitPrice: '10.555',
      discountAmount: '1.67',
      taxRate: '7',
    });
    expect(l.lineSubtotal.toFixed(2)).toBe('31.67'); // 31.665 → 31.67
    expect(l.lineTax.toFixed(2)).toBe('2.10'); // 30.00 × 7 %
    expect(l.lineTotal.toFixed(2)).toBe('32.10');
    const third = lineAmounts({
      quantity: '0.333',
      unitPrice: '0.1',
      discountAmount: '0',
      taxRate: '0',
    });
    expect(third.lineSubtotal.toFixed(2)).toBe('0.03');
    const t = orderTotals([
      { ...l, discountAmount: '1.67' },
      { ...third, discountAmount: '0' },
    ]);
    expect(t.subtotal.toFixed(2)).toBe('31.70');
    expect(t.discountTotal.toFixed(2)).toBe('1.67');
    expect(t.grandTotal.toFixed(2)).toBe('32.13');
    // 0.1 + 0.2 is exact here.
    expect(
      orderTotals([
        { lineSubtotal: '0.1', discountAmount: '0', lineTax: '0' },
        { lineSubtotal: '0.2', discountAmount: '0', lineTax: '0' },
      ]).grandTotal.toString(),
    ).toBe('0.3');
    expect(depositAmount('PERCENT', '30', '5642.00').toFixed(2)).toBe('1692.60');
    expect(depositAmount('PERCENT', '33.33', '100.01').toFixed(2)).toBe('33.33');
    expect(depositAmount('AMOUNT', '500', '9999').toFixed(2)).toBe('500.00');
  });

  it('the Warehouse contract holds operational fields only', () => {
    const allowed = new Set<string>(
      allowedFields(WAREHOUSE_FIELD_CLASSES as Record<string, any>, 'warehouse') as string[],
    );
    for (const k of Object.keys(WAREHOUSE_FIELD_CLASSES)) expect(allowed.has(k), k).toBe(true);
    for (const f of NON_OPERATIONAL_FIELDS) {
      expect(Object.keys(WAREHOUSE_FIELD_CLASSES)).not.toContain(f);
    }
    // Parsing drops anything not on the allow-list.
    const leaked = WarehousePendingReceiveView.parse({
      id: 'x',
      number: 'PO-1',
      status: 'PENDING_RECEIVE',
      branch: { id: 'b', code: '00001', name: 'B' },
      supplier: { code: 'S', name: 'S', taxId: '1', address: 'a' },
      orderDate: '2026-10-01',
      expectedDate: null,
      issuedAt: null,
      pendingReceiveAt: null,
      lineCount: 1,
      grandTotal: '99',
      deposit: { amount: '1' },
      lines: [
        {
          id: 'l',
          lineNo: 1,
          type: 'ITEM',
          item: { id: 'i', code: 'I', name: 'I' },
          description: null,
          unit: null,
          quantity: '1',
          unitPrice: '9',
          lineTotal: '9',
          request: { id: 'r', number: 'PR-1', lineNo: 1 },
        },
      ],
    });
    expect(keysOf(leaked).filter((k) => MONEY.test(k))).toEqual([]);
  });
});

// ------------------------------------------------------------------ enforcement

describeDb('Purchase orders (EP30)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const br: Record<'HO' | 'X', string> = { HO: '', X: '' };
  const ids: Record<string, string> = {};
  const it_: Record<string, string> = {};
  const sup: Record<string, string> = {};
  const PERIOD = companyDay('Asia/Bangkok').slice(0, 7).replace('-', '');
  let prSeq = 0;

  // email, role, company, departments, branches (null = all)
  const PEOPLE: [string, CompanyRole, 'A' | 'B', DepartmentCode[], ('HO' | 'X')[] | null][] = [
    ['owner@a.example', 'COMPANY_OWNER', 'A', [], null],
    ['admin@a.example', 'SYSTEM_ADMIN', 'A', [], null],
    ['exec@a.example', 'EXECUTIVE', 'A', [], null],
    ['buyer@a.example', 'DEPARTMENT_MANAGER', 'A', ['PURCHASING'], null],
    ['buyer.staff@a.example', 'DEPARTMENT_STAFF', 'A', ['PURCHASING'], null],
    ['buyer.x@a.example', 'DEPARTMENT_MANAGER', 'A', ['PURCHASING'], ['X']],
    ['viewer@a.example', 'VIEWER', 'A', ['PURCHASING'], null],
    ['acct@a.example', 'DEPARTMENT_MANAGER', 'A', ['ACCOUNTING'], ['HO']],
    ['acct.staff@a.example', 'DEPARTMENT_STAFF', 'A', ['ACCOUNTING'], ['HO']],
    ['wh@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['X']],
    ['owner@b.example', 'COMPANY_OWNER', 'B', [], null],
  ];

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    prSeq = 0;
    A = await createActiveCompany(h.db, {
      name: 'Alpha',
      departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
    });
    B = await createActiveCompany(h.db, { name: 'Beta', departments: ['PURCHASING'] });
    br.HO = A.headOfficeId;
    br.X = (
      await h.db.branch.create({
        data: {
          companyId: A.companyId,
          code: '00001',
          name: 'Branch X',
          type: 'BRANCH',
          addressLine1: 'x',
          province: 'Bangkok',
          postalCode: '10110',
        },
      })
    ).id;
    for (const [email, role, co, depts, branches] of PEOPLE) {
      const companyId = co === 'A' ? A.companyId : B.companyId;
      const u = await createUser(h.db, email, { companyRole: role, companyId });
      await h.db.user.update({ where: { id: u.id }, data: { fullName: email.split('@')[0] } });
      const m = await h.db.companyMember.findUniqueOrThrow({ where: { userId: u.id } });
      ids[email] = m.id;
      for (const d of depts) {
        const dept = await h.db.department.findFirstOrThrow({ where: { companyId, code: d } });
        await h.db.membership.create({ data: { userId: u.id, departmentId: dept.id } });
      }
      if (branches) {
        await h.db.companyMember.update({
          where: { id: m.id },
          data: {
            branchScope: 'SELECTED_BRANCHES',
            branchAccess: { create: branches.map((b) => ({ branchId: br[b] })) },
          },
        });
      }
    }
    const pcs = await h.db.unit.create({
      data: { companyId: A.companyId, code: 'PCS', name: 'Piece', precision: 0 },
    });
    const kg = await h.db.unit.create({
      data: { companyId: A.companyId, code: 'KG', name: 'Kilogram', precision: 3 },
    });
    it_.pcs = pcs.id;
    it_.kg = kg.id;
    const item = (code: string, unitId: string) =>
      h.db.item.create({
        data: {
          companyId: A.companyId,
          code,
          type: 'RAW_MATERIAL',
          name: `Item ${code}`,
          baseUnitId: unitId,
        },
      });
    it_.box = (await item('BOX-1', pcs.id)).id;
    it_.oil = (await item('OIL-1', kg.id)).id;
    const supplier = (companyId: string, code: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') =>
      h.db.supplier.create({
        data: {
          companyId,
          code,
          name: `Supplier ${code}`,
          taxId: '0105551234567',
          address: '1 Supplier Road',
          contactName: 'Khun Sales',
          phone: '02-000-0000',
          status,
          deactivatedAt: status === 'INACTIVE' ? new Date() : null,
        },
      });
    sup.one = (await supplier(A.companyId, 'SUP-000001')).id;
    sup.two = (await supplier(A.companyId, 'SUP-000002')).id;
    sup.old = (await supplier(A.companyId, 'SUP-000003', 'INACTIVE')).id;
    sup.foreign = (await supplier(B.companyId, 'SUP-000001')).id;
  });

  const as = async (email: string, branch?: 'HO' | 'X') => {
    const b = await signIn(h, email);
    await b.get('/api/v1/company/context');
    if (branch) {
      const res = await b.post('/api/v1/company/context/branch', { branchId: br[branch] });
      expect(res.statusCode, res.body).toBe(200);
    }
    return b;
  };

  /** An APPROVED request written directly (the EP29 flow is tested in its own suite). */
  const approvedPr = async (
    branch: 'HO' | 'X',
    lines: ({ item: 'box' | 'oil'; qty: string } | { description: string; qty: string })[],
    companyId = A.companyId,
    status: 'APPROVED' | 'SUBMITTED' = 'APPROVED',
  ) => {
    prSeq++;
    const r = await h.db.purchaseRequest.create({
      data: {
        companyId,
        branchId: companyId === A.companyId ? br[branch] : B.headOfficeId,
        number: `PR-209901-${String(prSeq).padStart(6, '0')}`,
        department: 'PURCHASING',
        requesterMemberId:
          companyId === A.companyId ? ids['buyer@a.example']! : ids['owner@b.example']!,
        status,
        requestDate: new Date('2099-01-01T00:00:00Z'),
        purpose: 'Stock up',
        lineCounter: lines.length,
        submittedAt: new Date(),
        ...(status === 'APPROVED'
          ? {
              approvedAt: new Date(),
              approvedByMemberId:
                companyId === A.companyId ? ids['buyer@a.example']! : ids['owner@b.example']!,
            }
          : {}),
      },
    });
    await h.db.purchaseRequestLine.createMany({
      data: lines.map((l, i) =>
        'item' in l
          ? {
              companyId,
              purchaseRequestId: r.id,
              lineNo: i + 1,
              type: 'ITEM' as const,
              itemId: it_[l.item],
              itemCode: l.item === 'box' ? 'BOX-1' : 'OIL-1',
              itemName: l.item === 'box' ? 'Item BOX-1' : 'Item OIL-1',
              unitId: l.item === 'box' ? it_.pcs : it_.kg,
              unitCode: l.item === 'box' ? 'PCS' : 'KG',
              unitName: l.item === 'box' ? 'Piece' : 'Kilogram',
              quantity: l.qty,
            }
          : {
              companyId,
              purchaseRequestId: r.id,
              lineNo: i + 1,
              type: 'NON_ITEM' as const,
              description: l.description,
              unitName: 'job',
              quantity: l.qty,
            },
      ),
    });
    return h.db.purchaseRequest.findUniqueOrThrow({
      where: { id: r.id },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
  };

  const draft = async (b: Browser, body: J) => {
    const res = await b.post(PO, body);
    expect(res.statusCode, res.body).toBe(201);
    return j(res).order;
  };
  const issued = async (b: Browser, body: J) => {
    const o = await draft(b, { supplierId: sup.one, ...body });
    const res = await b.post(`${PO}/${o.id}/issue`);
    expect(res.statusCode, res.body).toBe(200);
    return j(res).order;
  };

  it('creates a numbered draft from an approved request, in its branch, with server money', async () => {
    const pr = await approvedPr('X', [
      { item: 'box', qty: '10' },
      { item: 'oil', qty: '2.5' },
      { description: 'Delivery', qty: '1' },
    ]);
    // The buyer works at the Head Office; the order still belongs to the request's branch.
    const buyer = await as('buyer@a.example', 'HO');
    const res = await buyer.post(PO, { purchaseRequestId: pr.id });
    expect(res.statusCode, res.body).toBe(201);
    const { order, view, timeline } = j(res);
    expect(view).toBe('purchasing');
    expect(order).toMatchObject({
      number: `PO-${PERIOD}-000001`,
      status: 'DRAFT',
      branch: { id: br.X, code: '00001' },
      supplier: null,
      currency: 'THB',
      totals: { subtotal: '0.00', discountTotal: '0.00', taxTotal: '0.00', grandTotal: '0.00' },
      deposit: { type: 'NONE', status: 'NOT_REQUIRED', amount: null },
      createdBy: { name: 'buyer' },
      lineCount: 3,
      requests: [{ id: pr.id, number: pr.number }],
    });
    // Every line with something left, in full, prices to fill in.
    expect(order.lines.map((l: J) => [l.request.lineNo, l.quantity, l.request.remaining])).toEqual([
      [1, '10', '10'],
      [2, '2.5', '2.5'],
      [3, '1', '1'],
    ]);
    expect(order.lines[0]).toMatchObject({
      type: 'ITEM',
      item: { id: it_.box, code: 'BOX-1' },
      unit: { code: 'PCS' },
      unitPrice: '0',
      lineTotal: '0.00',
    });
    expect(order.actions).toEqual(['edit', 'issue', 'cancel']);
    expect(timeline.map((t: J) => t.type)).toEqual(['PURCHASE_ORDER_CREATED']);

    // Prices, discount and tax: the server computes every amount.
    const l1 = order.lines[0];
    const up = await buyer.patch(`${PO}/${order.id}/lines/${l1.id}`, {
      quantity: '3',
      unitPrice: '10.555',
      discountAmount: '1.67',
      taxRate: '7',
    });
    expect(up.statusCode, up.body).toBe(200);
    const line = j(up).order.lines[0];
    expect(line).toMatchObject({
      quantity: '3',
      unitPrice: '10.555',
      lineSubtotal: '31.67',
      discountAmount: '1.67',
      lineTax: '2.10',
      lineTotal: '32.10',
    });
    expect(j(up).order.totals).toEqual({
      subtotal: '31.67',
      discountTotal: '1.67',
      taxTotal: '2.10',
      grandTotal: '32.10',
    });
    // A second order gets the next number.
    expect(
      (
        await draft(buyer, {
          purchaseRequestId: pr.id,
          lines: [{ purchaseRequestLineId: pr.lines[0]!.id, quantity: '1' }],
        })
      ).number,
    ).toBe(`PO-${PERIOD}-000002`);
  });

  it('refuses client totals, server fields, float money and status edits', async () => {
    const pr = await approvedPr('HO', [{ item: 'box', qty: '10' }]);
    const buyer = await as('buyer@a.example', 'HO');
    const base = { purchaseRequestId: pr.id };
    for (const extra of [
      { status: 'PENDING_RECEIVE' },
      { number: 'PO-209901-000001' },
      { branchId: br.X },
      { companyId: B.companyId },
      { grandTotal: '1.00' },
      { subtotal: '1.00' },
      { depositAmount: '5' },
      { depositStatus: 'CONFIRMED' },
      { createdByMemberId: ids['owner@a.example'] },
      { issuedAt: new Date().toISOString() },
      { supplierName: 'Fake' },
      { deposit: { type: 'PERCENT', value: '30', amount: '1' } },
      { deposit: { type: 'PERCENT', value: '101' } },
      { deposit: { type: 'AMOUNT', value: '0' } },
      { currency: 'thb' },
    ]) {
      expect((await buyer.post(PO, { ...base, ...extra })).statusCode, JSON.stringify(extra)).toBe(
        400,
      );
    }
    const lineId = pr.lines[0]!.id;
    for (const line of [
      { purchaseRequestLineId: lineId, quantity: 1 },
      { purchaseRequestLineId: lineId, quantity: '1', unitPrice: 9.5 },
      { purchaseRequestLineId: lineId, quantity: '1', unitPrice: '9.12345' },
      { purchaseRequestLineId: lineId, quantity: '1', discountAmount: '1.005' },
      { purchaseRequestLineId: lineId, quantity: '1', taxRate: '101' },
      { purchaseRequestLineId: lineId, quantity: '1', lineTotal: '9' },
      { purchaseRequestLineId: lineId, quantity: '1', itemCode: 'FAKE' },
      { purchaseRequestLineId: lineId, quantity: '-1' },
    ]) {
      expect(
        (await buyer.post(PO, { ...base, lines: [line] })).statusCode,
        JSON.stringify(line),
      ).toBe(400);
    }
    const o = await draft(buyer, base);
    expect((await buyer.patch(`${PO}/${o.id}`, { status: 'PENDING_RECEIVE' })).statusCode).toBe(
      400,
    );
    expect((await buyer.patch(`${PO}/${o.id}`, { grandTotal: '9' })).statusCode).toBe(400);
    // Precision of the unit, discount within the line, quantity within the request.
    const l = o.lines[0];
    expect(code(await buyer.patch(`${PO}/${o.id}/lines/${l.id}`, { quantity: '1.5' }))).toBe(
      'QUANTITY_PRECISION',
    );
    expect(
      code(
        await buyer.patch(`${PO}/${o.id}/lines/${l.id}`, { unitPrice: '1', discountAmount: '50' }),
      ),
    ).toBe('PO_DISCOUNT_TOO_LARGE');
    expect(code(await buyer.patch(`${PO}/${o.id}/lines/${l.id}`, { quantity: '11' }))).toBe(
      'PO_QUANTITY_EXCEEDS_REMAINING',
    );
    // Inactive / foreign supplier.
    expect(code(await buyer.patch(`${PO}/${o.id}`, { supplierId: sup.old }))).toBe(
      'REFERENCE_INACTIVE',
    );
    expect(code(await buyer.patch(`${PO}/${o.id}`, { supplierId: sup.foreign }))).toBe(
      'REFERENCE_NOT_FOUND',
    );
  });

  it('issues without a deposit straight to pending receive; issued content is frozen', async () => {
    const pr = await approvedPr('HO', [{ item: 'box', qty: '10' }]);
    const buyer = await as('buyer@a.example', 'HO');
    const o = await draft(buyer, { purchaseRequestId: pr.id });
    // Not ready: no supplier, no price.
    const notReady = await buyer.post(`${PO}/${o.id}/issue`);
    expect(code(notReady)).toBe('PO_INCOMPLETE');
    expect(j(notReady).error.details.missing).toEqual(['supplier', 'unitPrice']);
    await buyer.patch(`${PO}/${o.id}`, {
      supplierId: sup.one,
      expectedDate: '2099-02-01',
      paymentTerms: 'Net 30',
    });
    await buyer.patch(`${PO}/${o.id}/lines/${o.lines[0].id}`, { unitPrice: '25', taxRate: '7' });
    const res = await buyer.post(`${PO}/${o.id}/issue`);
    expect(res.statusCode, res.body).toBe(200);
    const done = j(res).order;
    expect(done).toMatchObject({
      status: 'PENDING_RECEIVE',
      supplier: { code: 'SUP-000001', name: 'Supplier SUP-000001', taxId: '0105551234567' },
      totals: { grandTotal: '267.50' },
      deposit: { type: 'NONE', status: 'NOT_REQUIRED' },
      issuedBy: { name: 'buyer' },
    });
    expect(done.issuedAt).toBeTruthy();
    expect(done.pendingReceiveAt).toBeTruthy();
    expect(done.actions).toEqual(['cancel']);
    // Frozen: supplier renamed later does not change the order; edits are refused.
    await h.db.supplier.update({ where: { id: sup.one }, data: { name: 'Renamed' } });
    expect(j(await buyer.get(`${PO}/${o.id}`)).order.supplier.name).toBe('Supplier SUP-000001');
    expect(code(await buyer.patch(`${PO}/${o.id}`, { note: 'x' }))).toBe('PO_NOT_EDITABLE');
    expect(
      code(await buyer.patch(`${PO}/${o.id}/lines/${o.lines[0].id}`, { unitPrice: '1' })),
    ).toBe('PO_NOT_EDITABLE');
    expect(code(await buyer.post(`${PO}/${o.id}/issue`))).toBe('PO_INVALID_TRANSITION');
    expect(code(await buyer.post(`${PO}/${o.id}/cancel`, {}))).toBe('REASON_REQUIRED');
  });

  it('deposit: percent amount stored, Accounting confirms or waives, one decision wins', async () => {
    const pr = await approvedPr('HO', [
      { item: 'box', qty: '48' },
      { item: 'oil', qty: '10' },
    ]);
    const buyer = await as('buyer@a.example', 'HO');
    const o = await draft(buyer, {
      purchaseRequestId: pr.id,
      supplierId: sup.one,
      lines: [
        {
          purchaseRequestLineId: pr.lines[0]!.id,
          quantity: '48',
          unitPrice: '120',
          discountAmount: '100',
          taxRate: '7',
        },
      ],
      deposit: { type: 'PERCENT', value: '30', dueDate: '2099-01-15', note: 'Before shipping' },
    });
    // 48 × 120 = 5760 − 100 = 5660 + 396.20 = 6056.20; 30 % = 1816.86
    expect(o.totals.grandTotal).toBe('6056.20');
    expect(o.deposit).toMatchObject({
      type: 'PERCENT',
      value: '30',
      amount: '1816.86',
      status: 'PENDING',
      dueDate: '2099-01-15',
    });
    // A fixed amount larger than the total cannot be issued.
    await buyer.patch(`${PO}/${o.id}`, { deposit: { type: 'AMOUNT', value: '9999' } });
    expect(code(await buyer.post(`${PO}/${o.id}/issue`))).toBe('PO_DEPOSIT_EXCEEDS_TOTAL');
    await buyer.patch(`${PO}/${o.id}`, { deposit: { type: 'PERCENT', value: '30' } });
    const iss = await buyer.post(`${PO}/${o.id}/issue`);
    expect(j(iss).order).toMatchObject({
      status: 'WAITING_DEPOSIT',
      deposit: { status: 'PENDING' },
    });
    expect(j(iss).order.pendingReceiveAt).toBeNull();

    // Purchasing cannot settle the deposit.
    expect(code(await buyer.post(`${PO}/${o.id}/deposit/confirm`, {}))).toBe('PERMISSION_DENIED');
    // Accounting sees it in its queue (amounts, no editing).
    const acct = await as('acct@a.example', 'HO');
    const queue = j(await acct.get(DEPOSITS));
    expect(queue.items.map((x: J) => x.number)).toEqual([o.number]);
    expect(queue.items[0]).toMatchObject({
      totals: { grandTotal: '6056.20' },
      deposit: { amount: '1816.86', status: 'PENDING' },
      supplier: { code: 'SUP-000001', taxId: '0105551234567' },
    });
    expect(queue.items[0]).not.toHaveProperty('lines');
    const detail = j(await acct.get(`${DEPOSITS}/${o.id}`));
    expect(detail.view).toBe('accounting');
    expect(detail.order.actions).toEqual(['confirm_deposit', 'waive_deposit']);
    expect(detail.order.lines[0]).toMatchObject({ unitPrice: '120', lineTotal: '6056.20' });
    expect(detail.order).not.toHaveProperty('note');
    expect((await acct.patch(`${PO}/${o.id}`, { note: 'x' })).statusCode).toBe(404);
    expect((await acct.get(PO)).statusCode).toBe(403);
    // Staff accountants read but do not confirm.
    const acctStaff = await as('acct.staff@a.example', 'HO');
    expect((await acctStaff.get(DEPOSITS)).statusCode).toBe(200);
    expect(code(await acctStaff.post(`${PO}/${o.id}/deposit/confirm`, {}))).toBe(
      'PERMISSION_DENIED',
    );
    // Waive needs a reason; then confirm vs waive race: exactly one wins.
    expect((await acct.post(`${PO}/${o.id}/deposit/waive`, {})).statusCode).toBe(400);
    const owner = await as('owner@a.example', 'HO');
    const race = await Promise.all([
      acct.post(`${PO}/${o.id}/deposit/confirm`, { reference: 'TRF-0001' }),
      owner.post(`${PO}/${o.id}/deposit/waive`, { reason: 'Long-standing supplier' }),
    ]);
    expect(race.filter((r) => r.statusCode === 200)).toHaveLength(1);
    for (const r of race.filter((x) => x.statusCode !== 200)) {
      expect(['PO_STATE_CHANGED', 'PO_INVALID_TRANSITION']).toContain(code(r));
    }
    const after = j(await buyer.get(`${PO}/${o.id}`)).order;
    expect(after.status).toBe('PENDING_RECEIVE');
    expect(['CONFIRMED', 'WAIVED']).toContain(after.deposit.status);
    expect(after.pendingReceiveAt).toBeTruthy();
    expect(j(await acct.get(DEPOSITS)).items).toEqual([]);
    expect(j(await acct.get(`${DEPOSITS}?view=all`)).items).toHaveLength(1);
    const settled = await h.db.auditLog.count({
      where: {
        entityId: o.id,
        action: { in: ['PURCHASE_ORDER_DEPOSIT_CONFIRMED', 'PURCHASE_ORDER_DEPOSIT_WAIVED'] },
      },
    });
    expect(settled).toBe(1);
  });

  it('partial orders, several orders and suppliers per request, release on cancel — requested never changes', async () => {
    const pr = await approvedPr('HO', [
      { item: 'box', qty: '10' },
      { item: 'oil', qty: '2.5' },
    ]);
    const [l1] = pr.lines;
    const buyer = await as('buyer@a.example', 'HO');
    const first = await issued(buyer, {
      purchaseRequestId: pr.id,
      lines: [{ purchaseRequestLineId: l1!.id, quantity: '6', unitPrice: '10' }],
    });
    // The request now shows what was ordered (it stays APPROVED).
    const view = async () => j(await buyer.get(`/api/v1/purchase-requests/${pr.id}`)).request;
    let r = await view();
    expect(r.status).toBe('APPROVED');
    expect(r.orderState).toBe('PARTIALLY_ORDERED');
    expect(r.lines[0].quantity).toBe('10');
    expect(r.lines[0].ordering).toMatchObject({
      requested: '10',
      ordered: '6',
      remaining: '4',
      state: 'PARTIALLY_ORDERED',
      orders: [{ id: first.id, number: first.number, status: 'PENDING_RECEIVE', quantity: '6' }],
    });
    expect(r.lines[1].ordering).toMatchObject({ ordered: '0', state: 'NOT_ORDERED' });
    // More than remains is refused, already at draft time.
    const tooMuch = await buyer.post(PO, {
      purchaseRequestId: pr.id,
      lines: [{ purchaseRequestLineId: l1!.id, quantity: '5' }],
    });
    expect(code(tooMuch)).toBe('PO_QUANTITY_EXCEEDS_REMAINING');
    expect(j(tooMuch).error.details.remaining).toBe('4');
    // A second order, another supplier, for the rest (default lines = what remains).
    const second = await draft(buyer, { purchaseRequestId: pr.id, supplierId: sup.two });
    expect(second.lines.map((l: J) => l.quantity)).toEqual(['4', '2.5']);
    for (const l of second.lines) {
      await buyer.patch(`${PO}/${second.id}/lines/${l.id}`, { unitPrice: '3.5' });
    }
    expect((await buyer.post(`${PO}/${second.id}/issue`)).statusCode).toBe(200);
    r = await view();
    expect(r.orderState).toBe('FULLY_ORDERED');
    expect(r.lines.map((l: J) => l.ordering.remaining)).toEqual(['0', '0']);
    expect(code(await buyer.post(PO, { purchaseRequestId: pr.id }))).toBe('PR_FULLY_ORDERED');
    // Cancelling the first order (reason required) releases its 6.
    expect(
      (await buyer.post(`${PO}/${first.id}/cancel`, { reason: 'Supplier out of stock' }))
        .statusCode,
    ).toBe(200);
    r = await view();
    expect(r.lines[0].ordering).toMatchObject({
      ordered: '4',
      remaining: '6',
      state: 'PARTIALLY_ORDERED',
    });
    expect(r.lines[0].quantity).toBe('10');
    // Orders filtered by request.
    expect(j(await buyer.get(`${PO}?purchaseRequestId=${pr.id}`)).total).toBe(2);
  });

  it('concurrency: remaining 10, two orders of 7 issued at once — never more than 10', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const owner = await as('owner@a.example', 'HO');
    for (let round = 0; round < 4; round++) {
      const pr = await approvedPr('HO', [{ item: 'box', qty: '10' }]);
      const line = { purchaseRequestLineId: pr.lines[0]!.id, quantity: '7', unitPrice: '1' };
      // Drafts reserve nothing: both can be prepared.
      const a = await draft(buyer, {
        purchaseRequestId: pr.id,
        supplierId: sup.one,
        lines: [line],
      });
      const b = await draft(buyer, {
        purchaseRequestId: pr.id,
        supplierId: sup.two,
        lines: [line],
      });
      const results = await Promise.all([
        buyer.post(`${PO}/${a.id}/issue`),
        owner.post(`${PO}/${b.id}/issue`),
      ]);
      expect(results.map((x) => x.statusCode).sort()).toEqual([200, 409]);
      expect(code(results.find((x) => x.statusCode === 409)!)).toBe(
        'PO_QUANTITY_EXCEEDS_REMAINING',
      );
      const ordered = await h.db.purchaseOrderLine.aggregate({
        where: {
          purchaseRequestLineId: pr.lines[0]!.id,
          order: { status: { in: ['WAITING_DEPOSIT', 'PENDING_RECEIVE'] } },
        },
        _sum: { quantity: true },
      });
      expect(ordered._sum.quantity!.toString()).toBe('7');
    }
    // Ten simultaneous creates: unique consecutive numbers.
    const pr = await approvedPr('HO', [{ item: 'box', qty: '100' }]);
    const made = await Promise.all(
      Array.from({ length: 10 }, () =>
        buyer.post(PO, {
          purchaseRequestId: pr.id,
          lines: [{ purchaseRequestLineId: pr.lines[0]!.id, quantity: '1' }],
        }),
      ),
    );
    const numbers = new Set(made.map((m) => j(m).order.number as string));
    expect(numbers.size).toBe(10);
  });

  it('branch: the order is the request’s branch; no line from another branch; the database agrees', async () => {
    const ho = await approvedPr('HO', [{ item: 'box', qty: '10' }]);
    const x = await approvedPr('X', [{ item: 'box', qty: '10' }]);
    const buyer = await as('buyer@a.example', 'HO');
    const o = await draft(buyer, { purchaseRequestId: ho.id });
    expect(o.branch.id).toBe(br.HO);
    expect(
      code(
        await buyer.post(`${PO}/${o.id}/lines`, {
          purchaseRequestLineId: x.lines[0]!.id,
          quantity: '1',
        }),
      ),
    ).toBe('PO_BRANCH_MISMATCH');
    // A buyer limited to branch X cannot order the Head Office request nor see its order.
    const buyerX = await as('buyer.x@a.example', 'X');
    expect(code(await buyerX.post(PO, { purchaseRequestId: ho.id }))).toBe('PR_NOT_FOUND');
    expect((await buyerX.get(`${PO}/${o.id}`)).statusCode).toBe(404);
    expect(j(await buyerX.get(PO)).items).toEqual([]);
    // Database: an order line can only point at a request of its order's branch.
    await expect(
      h.db.purchaseOrderLine.create({
        data: {
          companyId: A.companyId,
          branchId: br.HO,
          purchaseOrderId: o.id,
          lineNo: 99,
          purchaseRequestId: x.id,
          purchaseRequestLineId: x.lines[0]!.id,
          prNumber: x.number,
          prLineNo: 1,
          type: 'ITEM',
          itemId: it_.box,
          itemCode: 'BOX-1',
          itemName: 'Item BOX-1',
          unitId: it_.pcs,
          unitCode: 'PCS',
          quantity: '1',
        },
      }),
    ).rejects.toThrow();
    // A request line with another request's id is refused too.
    await expect(
      h.db.purchaseOrderLine.create({
        data: {
          companyId: A.companyId,
          branchId: br.HO,
          purchaseOrderId: o.id,
          lineNo: 98,
          purchaseRequestId: ho.id,
          purchaseRequestLineId: x.lines[0]!.id,
          prNumber: ho.number,
          prLineNo: 1,
          type: 'ITEM',
          itemId: it_.box,
          itemCode: 'BOX-1',
          itemName: 'Item BOX-1',
          unitId: it_.pcs,
          unitCode: 'PCS',
          quantity: '1',
        },
      }),
    ).rejects.toThrow();
  });

  it('only approved requests are ordered; an ordered request cannot be cancelled', async () => {
    const pending = await approvedPr('HO', [{ item: 'box', qty: '1' }], A.companyId, 'SUBMITTED');
    const buyer = await as('buyer@a.example', 'HO');
    expect(code(await buyer.post(PO, { purchaseRequestId: pending.id }))).toBe('PR_NOT_APPROVED');
    const pr = await approvedPr('HO', [{ item: 'box', qty: '5' }]);
    const o = await draft(buyer, { purchaseRequestId: pr.id });
    const prCancel = () =>
      buyer.post(`/api/v1/purchase-requests/${pr.id}/cancel`, { reason: 'No longer needed' });
    expect(code(await prCancel())).toBe('PR_HAS_PURCHASE_ORDERS');
    expect((await buyer.post(`${PO}/${o.id}/cancel`, {})).statusCode).toBe(200);
    expect((await prCancel()).statusCode).toBe(200);
    // Issuing an order of a request cancelled meanwhile is refused.
    const pr2 = await approvedPr('HO', [{ item: 'box', qty: '5' }]);
    const o2 = await draft(buyer, { purchaseRequestId: pr2.id, supplierId: sup.one });
    await buyer.patch(`${PO}/${o2.id}/lines/${o2.lines[0].id}`, { unitPrice: '1' });
    await h.db.purchaseRequest.update({
      where: { id: pr2.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledByMemberId: ids['buyer@a.example'],
      },
    });
    expect(code(await buyer.post(`${PO}/${o2.id}/issue`))).toBe('PR_NOT_APPROVED');
  });

  it('roles: Staff drafts, Managers issue and cancel, Executive reads a summary, System Admin and Viewer do not act', async () => {
    const pr = await approvedPr('HO', [{ item: 'box', qty: '10' }]);
    const staff = await as('buyer.staff@a.example', 'HO');
    const o = await draft(staff, { purchaseRequestId: pr.id, supplierId: sup.one });
    await staff.patch(`${PO}/${o.id}/lines/${o.lines[0].id}`, { quantity: '4', unitPrice: '2' });
    expect(code(await staff.post(`${PO}/${o.id}/issue`))).toBe('PERMISSION_DENIED');
    const buyer = await as('buyer@a.example', 'HO');
    expect((await buyer.post(`${PO}/${o.id}/issue`)).statusCode).toBe(200);
    expect(code(await staff.post(`${PO}/${o.id}/cancel`, { reason: 'x' }))).toBe(
      'PERMISSION_DENIED',
    );
    // Staff may discard their own draft.
    const d = await draft(staff, {
      purchaseRequestId: pr.id,
      lines: [{ purchaseRequestLineId: pr.lines[0]!.id, quantity: '1' }],
    });
    expect((await staff.post(`${PO}/${d.id}/cancel`, {})).statusCode).toBe(200);

    const exec = await as('exec@a.example', 'HO');
    const list = j(await exec.get(PO));
    // No drafts (a discarded draft is history, not work in progress).
    expect(list.items.map((i: J) => i.status).sort()).toEqual(['CANCELLED', 'PENDING_RECEIVE']);
    const sum = j(await exec.get(`${PO}/${o.id}`));
    expect(sum.view).toBe('executive');
    expect(sum.order).toMatchObject({ grandTotal: '8.00', lineCount: 1 });
    expect(sum.order).not.toHaveProperty('lines');
    expect(sum.order).not.toHaveProperty('actions');
    expect(JSON.stringify(sum)).not.toContain('Khun Sales');
    for (const res of [
      await exec.post(PO, { purchaseRequestId: pr.id }),
      await exec.post(`${PO}/${o.id}/cancel`, { reason: 'x' }),
      await exec.post(`${PO}/${o.id}/issue`),
    ]) {
      expect(res.statusCode).toBe(403);
    }
    const viewer = await as('viewer@a.example', 'HO');
    expect(j(await viewer.get(`${PO}/${o.id}`)).order.actions).toEqual([]);
    expect((await viewer.post(PO, { purchaseRequestId: pr.id })).statusCode).toBe(403);
    const admin = await as('admin@a.example', 'HO');
    for (const url of [PO, DEPOSITS, RECEIVE]) expect((await admin.get(url)).statusCode).toBe(403);
    expect((await admin.post(PO, { purchaseRequestId: pr.id })).statusCode).toBe(403);
    // Owner: everything.
    const owner = await as('owner@a.example', 'HO');
    expect(
      (await owner.post(`${PO}/${o.id}/cancel`, { reason: 'Owner decision' })).statusCode,
    ).toBe(200);
  });

  it('Warehouse sees pending receive in its branch — never a price, total, deposit or terms, by any route', async () => {
    const pr = await approvedPr('X', [
      { item: 'oil', qty: '12.5' },
      { description: 'Pallet delivery', qty: '1' },
    ]);
    const buyer = await as('buyer@a.example', 'HO');
    const ready = await issued(buyer, {
      purchaseRequestId: pr.id,
      paymentTerms: 'Net 45 secret terms',
      note: 'Price agreed 42.75',
      expectedDate: '2099-03-01',
      lines: [
        {
          purchaseRequestLineId: pr.lines[0]!.id,
          quantity: '8',
          unitPrice: '42.75',
          discountAmount: '3.33',
          taxRate: '7',
        },
        {
          purchaseRequestLineId: pr.lines[1]!.id,
          quantity: '1',
          unitPrice: '999.99',
          taxRate: '7',
        },
      ],
    });
    // One with a deposit (waiting) and one draft in the same branch: not pending receive.
    const waiting = await draft(buyer, {
      purchaseRequestId: pr.id,
      supplierId: sup.one,
      lines: [{ purchaseRequestLineId: pr.lines[0]!.id, quantity: '1', unitPrice: '5' }],
      deposit: { type: 'AMOUNT', value: '1' },
    });
    await buyer.post(`${PO}/${waiting.id}/issue`);
    const wh = await as('wh@a.example', 'X');
    const list = await wh.get(RECEIVE);
    expect(list.statusCode).toBe(200);
    expect(j(list).items.map((x: J) => x.number)).toEqual([ready.number]);
    const detail = await wh.get(`${RECEIVE}/${ready.id}`);
    expect(detail.statusCode).toBe(200);
    expect(j(detail)).toMatchObject({
      view: 'warehouse',
      order: {
        number: ready.number,
        supplier: { code: 'SUP-000001', name: 'Supplier SUP-000001' },
        expectedDate: '2099-03-01',
        lines: [
          expect.objectContaining({
            quantity: '8',
            item: expect.objectContaining({ code: 'OIL-1' }),
          }),
          expect.objectContaining({ quantity: '1', description: 'Pallet delivery' }),
        ],
      },
    });
    for (const res of [list, detail]) {
      // (`total` of the list is the page count of results, not money.)
      expect(keysOf(j(res).items ?? j(res).order).filter((k) => MONEY.test(k))).toEqual([]);
      for (const secret of [
        '42.75',
        '999.99',
        '3.33',
        '1069',
        'Net 45',
        'Price agreed',
        '0105551234567',
        'Khun Sales',
      ]) {
        expect(res.body).not.toContain(secret);
      }
    }
    // Direct API: the commercial and accounting routes are closed to Warehouse.
    expect((await wh.get(`${PO}/${ready.id}`)).statusCode).toBe(404);
    expect((await wh.get(PO)).statusCode).toBe(403);
    expect((await wh.get(DEPOSITS)).statusCode).toBe(403);
    expect((await wh.get(`${DEPOSITS}/${waiting.id}`)).statusCode).toBe(404);
    expect((await wh.get(`${RECEIVE}/${waiting.id}`)).statusCode).toBe(404);
    expect((await wh.get(`${PO}/supplier-options`)).statusCode).toBe(403);
    expect((await wh.get(`${PO}/source-requests`)).statusCode).toBe(403);
    // Pending receive outside the member's branches is invisible.
    const hoPr = await approvedPr('HO', [{ item: 'box', qty: '1' }]);
    const hoOrder = await issued(buyer, {
      purchaseRequestId: hoPr.id,
      lines: [{ purchaseRequestLineId: hoPr.lines[0]!.id, quantity: '1', unitPrice: '1' }],
    });
    expect((await wh.get(`${RECEIVE}/${hoOrder.id}`)).statusCode).toBe(404);
    expect(j(await wh.get(RECEIVE)).total).toBe(1);
  });

  it('IDOR and Platform Inspection: no foreign access; the platform sees events without number, amount or supplier', async () => {
    const pr = await approvedPr('HO', [{ item: 'box', qty: '10' }]);
    const buyer = await as('buyer@a.example', 'HO');
    const o = await issued(buyer, {
      purchaseRequestId: pr.id,
      lines: [{ purchaseRequestLineId: pr.lines[0]!.id, quantity: '2', unitPrice: '77.77' }],
    });
    const other = await as('owner@b.example');
    for (const res of [
      await other.get(`${PO}/${o.id}`),
      await other.post(`${PO}/${o.id}/cancel`, { reason: 'x' }),
      await other.post(`${PO}/${o.id}/deposit/confirm`, {}),
      await other.get(`${DEPOSITS}/${o.id}`),
      await other.get(`${RECEIVE}/${o.id}`),
      await other.post(PO, { purchaseRequestId: pr.id }),
    ]) {
      expect(res.statusCode, res.body).toBe(404);
    }
    expect(j(await other.get(PO)).items).toEqual([]);
    // An order of A cannot take a supplier of B (checked above) or a request of B.
    const bPr = await approvedPr('HO', [{ description: 'Service', qty: '1' }], B.companyId);
    expect(code(await buyer.post(PO, { purchaseRequestId: bPr.id }))).toBe('PR_NOT_FOUND');

    await createUser(h.db, 'op@pdabliss.example', { platformRole: 'PLATFORM_ADMIN' });
    const op = await signIn(h, 'op@pdabliss.example');
    expect((await op.get(PO)).statusCode).toBe(403);
    const insp = await op.get(`/api/v1/platform/companies/${A.companyId}`);
    const events = j(insp).activity.filter((e: J) => e.entityType === 'PurchaseOrder');
    expect(events.map((e: J) => e.action)).toEqual(
      expect.arrayContaining(['PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER_ISSUED']),
    );
    expect(events.every((e: J) => Object.keys(e.details).length === 0)).toBe(true);
    for (const secret of [o.number, '77.77', '155.54', 'Supplier SUP-000001', 'SUP-000001']) {
      expect(insp.body).not.toContain(secret);
    }
    // The company's own audit has the number and transitions — never amounts.
    const audit = await h.db.auditLog.findMany({ where: { entityId: o.id } });
    expect(audit.map((a) => a.action)).toEqual(['PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER_ISSUED']);
    for (const a of audit) {
      expect(keysOf(a.changes).filter((k) => MONEY.test(k) && k !== 'deposit')).toEqual([]);
      expect(JSON.stringify(a.changes)).not.toContain('77.77');
    }
  });

  it('the database keeps the arithmetic, statuses and deposits consistent', async () => {
    const pr = await approvedPr('HO', [{ item: 'box', qty: '10' }]);
    const buyer = await as('buyer@a.example', 'HO');
    const o = await draft(buyer, { purchaseRequestId: pr.id });
    const id = o.id;
    const reject = (data: J) =>
      expect(h.db.purchaseOrder.update({ where: { id }, data })).rejects.toThrow();
    await reject({ grandTotal: '1' }); // ≠ subtotal − discount + tax
    await reject({ status: 'PENDING_RECEIVE' }); // not issued, no supplier
    await reject({
      depositType: 'PERCENT',
      depositValue: '150',
      depositAmount: '1',
      depositStatus: 'PENDING',
    });
    await reject({ depositType: 'AMOUNT' }); // no value / amount
    await reject({ depositStatus: 'CONFIRMED' }); // no deposit, no who / when
    await reject({ number: 'X-1' });
    await reject({ currency: 'thb' });
    await reject({ status: 'CANCELLED' }); // no who / when
    await expect(
      h.db.purchaseOrderLine.updateMany({
        where: { purchaseOrderId: id },
        data: { quantity: '0' },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.purchaseOrderLine.updateMany({
        where: { purchaseOrderId: id },
        data: { lineTotal: '5' },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.purchaseOrderLine.updateMany({
        where: { purchaseOrderId: id },
        data: { taxRate: '101' },
      }),
    ).rejects.toThrow();
  });
});
