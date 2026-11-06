import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { isRoleDefault, PERMISSION_CATALOG } from '../src/permissions/catalog.js';
import { Decimal } from '../src/purchasing/money.js';
import { companyDay } from '../src/purchasing/service.js';
import { lineAvailability, orderAvailability } from '../src/sales/availability.js';
import { soRefusal, type SalesActor } from '../src/sales/policy.js';
import { SALES_FIELD_CLASSES, SoView } from '../src/sales/views.js';
import { fefoCandidates } from '../src/warehouse/service.js';
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
 * EP33 sales orders: the transition table, server money, informational
 * availability (never a reservation, never a stock write; equal to the FEFO
 * candidate set), snapshots that follow the master until confirmation, the
 * draft-privacy rule, roles, branch and company isolation (IDOR), the confirm /
 * cancel / numbering races, audit without amounts, and response allow-lists
 * without cost or margin.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const S = '/api/v1/sales';
const SO = `${S}/orders`;
const COST = /cost|margin|supplier|purchase|deposit|payment|valuation/i;

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

describe('Sales order policy, availability and contracts (EP33)', () => {
  it('reuses the EP27 sales codes: staff create, managers confirm and cancel', () => {
    const codes = PERMISSION_CATALOG.map((p) => p.code as string);
    for (const c of ['view', 'create', 'approve', 'cancel']) {
      expect(codes).toContain(`sales.orders.${c}`);
    }
    expect(codes.some((c) => /^sales\.orders\.(submit|confirm)$/.test(c))).toBe(false);
    expect(isRoleDefault('DEPARTMENT_STAFF', 'sales.orders.create')).toBe(true);
    expect(isRoleDefault('DEPARTMENT_STAFF', 'sales.orders.approve')).toBe(false);
    expect(isRoleDefault('DEPARTMENT_STAFF', 'sales.orders.cancel')).toBe(false);
    expect(isRoleDefault('DEPARTMENT_MANAGER', 'sales.orders.approve')).toBe(true);
    expect(isRoleDefault('EXECUTIVE', 'sales.orders.view')).toBe(true);
    expect(isRoleDefault('EXECUTIVE', 'sales.orders.create')).toBe(false);
    for (const p of PERMISSION_CATALOG.filter((x) => x.namespace === 'WAREHOUSE')) {
      expect(p.code).not.toMatch(/sales/);
    }
  });

  it('decides every order transition in one table', () => {
    const actor = (over: Partial<SalesActor> = {}): SalesActor =>
      ({
        memberId: 'me',
        branches: [{ id: 'b1', code: '00001', name: 'B', type: 'BRANCH' }],
        view: true,
        create: true,
        confirm: false,
        cancel: false,
        ...over,
      }) as SalesActor;
    const o = (status: any, over: J = {}) => ({
      status,
      branchId: 'b1',
      createdByMemberId: 'me',
      ...over,
    });
    const mgr = actor({ confirm: true, cancel: true });
    expect(soRefusal(actor(), 'edit', o('DRAFT'))).toBeNull();
    expect(soRefusal(actor(), 'submit', o('DRAFT'))).toBeNull();
    expect(soRefusal(actor(), 'cancel', o('DRAFT'))).toBeNull();
    // Someone else's draft: not even a manager edits it.
    expect(soRefusal(actor(), 'edit', o('DRAFT', { createdByMemberId: 'x' }))).toBe('authority');
    expect(soRefusal(mgr, 'edit', o('DRAFT', { createdByMemberId: 'x' }))).toBe('authority');
    expect(soRefusal(actor(), 'confirm', o('SUBMITTED'))).toBe('authority');
    expect(soRefusal(mgr, 'confirm', o('SUBMITTED'))).toBeNull();
    expect(soRefusal(mgr, 'confirm', o('DRAFT'))).toBe('status');
    expect(soRefusal(actor(), 'cancel', o('SUBMITTED'))).toBe('authority');
    expect(soRefusal(mgr, 'cancel', o('SUBMITTED'))).toBeNull();
    expect(soRefusal(mgr, 'cancel', o('CONFIRMED'))).toBeNull();
    expect(soRefusal(actor(), 'edit', o('SUBMITTED'))).toBe('status');
    for (const a of ['edit', 'submit', 'confirm', 'cancel'] as const) {
      expect(soRefusal(mgr, a, o('CANCELLED'))).toBe('status');
    }
    expect(soRefusal(mgr, 'confirm', o('SUBMITTED', { branchId: 'b2' }))).toBe('branch');
  });

  it('derives availability per line and per order (no stock means unavailable)', () => {
    const s = (onHand: string, available: string) => ({
      onHand: new Decimal(onHand),
      reserved: new Decimal(onHand).minus(available),
      available: new Decimal(available),
    });
    const q = (v: string) => new Decimal(v);
    expect(lineAvailability(true, q('5'), s('8', '6')).state).toBe('AVAILABLE');
    const part = lineAvailability(true, q('10'), s('8', '6'));
    expect(part.state).toBe('PARTIALLY_AVAILABLE');
    expect(part.shortage!.toString()).toBe('4');
    expect(lineAvailability(true, q('1'), s('3', '0')).state).toBe('UNAVAILABLE');
    expect(lineAvailability(false, q('1'), s('0', '0'))).toEqual({
      state: 'NOT_STOCK_TRACKED',
      onHand: null,
      reserved: null,
      available: null,
      shortage: null,
    });
    // EP34: a line's own reservations count — fully allocated is AVAILABLE with no stock left.
    expect(lineAvailability(true, q('5'), s('5', '0'), q('5')).state).toBe('AVAILABLE');
    const half = lineAvailability(true, q('10'), s('6', '0'), q('6'));
    expect([half.state, half.shortage!.toString()]).toEqual(['PARTIALLY_AVAILABLE', '4']);
    expect(orderAvailability(['AVAILABLE', 'NOT_STOCK_TRACKED'])).toBe('AVAILABLE');
    expect(orderAvailability(['AVAILABLE', 'UNAVAILABLE'])).toBe('PARTIALLY_AVAILABLE');
    expect(orderAvailability(['UNAVAILABLE', 'UNAVAILABLE'])).toBe('UNAVAILABLE');
    expect(orderAvailability(['NOT_STOCK_TRACKED'])).toBe('NOT_STOCK_TRACKED');
  });

  it('responses carry operational and commercial keys only — never cost or margin', () => {
    for (const [k, cls] of Object.entries(SALES_FIELD_CLASSES)) {
      expect(cls, k).not.toBe('financial');
      expect(k).not.toMatch(COST);
    }
    expect(SALES_FIELD_CLASSES.grandTotal).toBe('commercial');
    expect(SALES_FIELD_CLASSES.availability).toBe('operational');
    expect(Object.keys(SoView.shape)).not.toContain('companyId');
  });
});

// ------------------------------------------------------------------ enforcement

describeDb('Sales orders (EP33)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const br: Record<'HO' | 'X', string> = { HO: '', X: '' };
  const ids: Record<string, string> = {};
  const it_: Record<string, string> = {};
  const cu: Record<string, string> = {};
  const loc: Record<string, string> = {};
  const PERIOD = companyDay('Asia/Bangkok').slice(0, 7).replace('-', '');
  const TODAY = companyDay('Asia/Bangkok');

  // email, role, company, departments, branches (null = all)
  const PEOPLE: [string, CompanyRole, 'A' | 'B', DepartmentCode[], ('HO' | 'X')[] | null][] = [
    ['owner@a.example', 'COMPANY_OWNER', 'A', [], null],
    ['admin@a.example', 'SYSTEM_ADMIN', 'A', [], null],
    ['exec@a.example', 'EXECUTIVE', 'A', [], null],
    ['sales@a.example', 'DEPARTMENT_STAFF', 'A', ['SALES'], ['HO']],
    ['sales2@a.example', 'DEPARTMENT_STAFF', 'A', ['SALES'], ['HO']],
    ['salesm@a.example', 'DEPARTMENT_MANAGER', 'A', ['SALES'], ['HO']],
    ['salesm2@a.example', 'DEPARTMENT_MANAGER', 'A', ['SALES'], ['HO']],
    ['sales.both@a.example', 'DEPARTMENT_STAFF', 'A', ['SALES'], ['HO', 'X']],
    ['sales.x@a.example', 'DEPARTMENT_MANAGER', 'A', ['SALES'], ['X']],
    ['viewer@a.example', 'VIEWER', 'A', ['SALES'], ['HO']],
    ['wh@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['HO']],
    ['acct@a.example', 'DEPARTMENT_MANAGER', 'A', ['ACCOUNTING'], ['HO']],
    ['owner@b.example', 'COMPANY_OWNER', 'B', [], null],
  ];

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    A = await createActiveCompany(h.db, {
      name: 'Alpha',
      departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
    });
    B = await createActiveCompany(h.db, { name: 'Beta', departments: ['SALES'] });
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
    const unit = (companyId: string, c: string, name: string, precision: number) =>
      h.db.unit.create({ data: { companyId, code: c, name, precision } });
    const pcs = await unit(A.companyId, 'PCS', 'Piece', 0);
    const kg = await unit(A.companyId, 'KG', 'Kilogram', 3);
    const bPcs = await unit(B.companyId, 'PCS', 'Piece', 0);
    const item = (c: string, unitId: string, over: J = {}, companyId = A.companyId) =>
      h.db.item.create({
        data: {
          companyId,
          code: c,
          type: 'FINISHED_GOOD',
          name: `Item ${c}`,
          baseUnitId: unitId,
          ...over,
        },
      });
    it_.box = (await item('BOX-1', pcs.id)).id;
    it_.oil = (await item('OIL-1', kg.id, { type: 'RAW_MATERIAL' })).id;
    it_.svc = (await item('SVC-1', pcs.id, { type: 'NON_STOCK', inventoryTracked: false })).id;
    it_.old = (await item('OLD-1', pcs.id, { status: 'INACTIVE', deactivatedAt: new Date() })).id;
    it_.foreign = (await item('BOX-1', bPcs.id, {}, B.companyId)).id;
    const customer = (companyId: string, c: string, over: J = {}) =>
      h.db.customer.create({
        data: { companyId, code: c, name: `Customer ${c}`, taxId: '0105559999999', ...over },
      });
    cu.one = (await customer(A.companyId, 'CUS-000001', { taxBranch: '00000' })).id;
    cu.two = (await customer(A.companyId, 'CUS-000002')).id;
    cu.old = (
      await customer(A.companyId, 'CUS-000003', { status: 'INACTIVE', deactivatedAt: new Date() })
    ).id;
    cu.foreign = (await customer(B.companyId, 'CUS-000001')).id;
    const location = (branchId: string, c: string) =>
      h.db.warehouseLocation.create({
        data: { companyId: A.companyId, branchId, code: c, name: `Loc ${c}` },
      });
    loc.HO = (await location(br.HO, 'HO-MAIN')).id;
    loc.HO2 = (await location(br.HO, 'HO-SHELF')).id;
    loc.X = (await location(br.X, 'X-MAIN')).id;
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
  const ok = async (res: Promise<ApiResponse>, status = 200) => {
    const r = await res;
    expect(r.statusCode, r.body).toBe(status);
    return j(r);
  };
  const line = (itemId: string, quantity: string, unitPrice = '100', over: J = {}) => ({
    itemId,
    quantity,
    unitPrice,
    ...over,
  });
  const draft = async (b: Browser, body: J = {}) =>
    (await ok(b.post(SO, { customerId: cu.one, lines: [line(it_.box!, '2')], ...body }), 201))
      .order;
  /** Stock written straight into the balance table (availability reads balances only). */
  const balance = async (
    itemId: string,
    quantity: string,
    locationId = loc.HO!,
    lot?: { number: string; expiry: string | null },
  ) => {
    const branchId = locationId === loc.X ? br.X : br.HO;
    const l = lot
      ? await h.db.inventoryLot.create({
          data: {
            companyId: A.companyId,
            itemId,
            lotNumber: lot.number,
            expiryDate: lot.expiry ? new Date(`${lot.expiry}T00:00:00Z`) : null,
          },
        })
      : null;
    await h.db.stockBalance.create({
      data: {
        companyId: A.companyId,
        branchId,
        locationId,
        itemId,
        lotId: l?.id ?? null,
        lotKey: l?.id ?? '',
        quantityOnHand: quantity,
        firstReceivedAt: new Date(),
      },
    });
  };
  const shift = (days: number) => {
    const d = new Date(`${TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  // ---------------------------------------------------------------- create / money

  it('creates a numbered DRAFT with server snapshots and server money', async () => {
    const s = await as('sales@a.example');
    const o = await draft(s, {
      orderDate: TODAY,
      requestedDate: shift(5),
      customerReference: '  PO-778  ',
      note: 'Deliver to the back door',
      lines: [
        line(it_.box!, '3', '10.555', { discountAmount: '1.67', taxRate: '7' }),
        line(it_.oil!, '1.25', '80', { taxRate: '7', note: 'Cold pack' }),
        line(it_.svc!, '1', '500'),
      ],
    });
    expect(o.number).toBe(`SO-${PERIOD}-000001`);
    expect(o).toMatchObject({
      status: 'DRAFT',
      branch: { id: br.HO, code: '00000' },
      customer: {
        id: cu.one,
        code: 'CUS-000001',
        name: 'Customer CUS-000001',
        taxId: '0105559999999',
        taxBranch: '00000',
      },
      orderDate: TODAY,
      requestedDate: shift(5),
      customerReference: 'PO-778',
      currency: 'THB',
      taxTotalLabel: 'exclusive',
      lineCount: 3,
      actions: ['edit', 'submit', 'cancel'],
    });
    // 31.665 → 31.67, −1.67, tax 2.10; 100.00 + 7.00; 500.00
    expect(o.lines[0]).toMatchObject({
      lineNo: 1,
      lineSubtotal: '31.67',
      lineTax: '2.10',
      lineTotal: '32.10',
      unit: { code: 'PCS', precision: 0 },
      item: { code: 'BOX-1', type: 'FINISHED_GOOD', inventoryTracked: true },
      progress: {
        ordered: '3',
        allocated: '0',
        picked: '0',
        packed: '0',
        dispatched: '0',
        delivered: '0',
        toDispatch: '3',
        toDeliver: '0',
      },
    });
    expect(o.lines[1]).toMatchObject({ quantity: '1.25', lineTotal: '107.00', note: 'Cold pack' });
    expect(o.lines[2].availability.state).toBe('NOT_STOCK_TRACKED');
    expect(o).toMatchObject({
      subtotal: '631.67',
      discountTotal: '1.67',
      taxTotal: '9.10',
      grandTotal: '639.10',
    });
    expect(o.createdBy).toEqual({ name: 'sales' });
    // A second order takes the next number; the order date defaults to the company day.
    const o2 = await draft(s);
    expect(o2.number).toBe(`SO-${PERIOD}-000002`);
    expect(o2.orderDate).toBe(TODAY);
  });

  it('refuses what the server owns and validates every input', async () => {
    const s = await as('sales@a.example');
    for (const extra of [
      { status: 'CONFIRMED' },
      { number: 'SO-1' },
      { branchId: br.X },
      { companyId: B.companyId },
      { grandTotal: '1' },
      { customerName: 'Fake' },
      { submittedAt: new Date().toISOString() },
    ]) {
      const res = await s.post(SO, { customerId: cu.one, ...extra });
      expect(res.statusCode, JSON.stringify(extra)).toBe(400);
    }
    for (const extra of [{ lineTotal: '1' }, { itemCode: 'X' }, { allocatedQuantity: '1' }]) {
      const res = await s.post(SO, {
        customerId: cu.one,
        lines: [{ ...line(it_.box!, '1'), ...extra }],
      });
      expect(res.statusCode, JSON.stringify(extra)).toBe(400);
    }
    expect(
      (await s.post(SO, { customerId: cu.one, lines: [line(it_.box!, '1', '1.12345')] }))
        .statusCode,
    ).toBe(400);
    expect(
      (await s.post(SO, { customerId: cu.one, lines: [line(it_.box!, '-1')] })).statusCode,
    ).toBe(400);
    expect(
      (await s.post(SO, { customerId: cu.one, lines: [line(it_.box!, '0')] })).statusCode,
    ).toBe(400);
    expect(
      (await s.post(SO, { customerId: cu.one, lines: [line(it_.box!, 1 as any)] })).statusCode,
    ).toBe(400);
    expect((await s.post(SO, { customerId: cu.one, note: 'a\u0000b' })).statusCode).toBe(400);
    expect((await s.post(SO, { customerId: cu.one, orderDate: '2026-02-30' })).statusCode).toBe(
      400,
    );

    const cases: [J, string, J?][] = [
      [{ customerId: cu.old }, 'REFERENCE_INACTIVE'],
      [{ customerId: cu.foreign }, 'REFERENCE_NOT_FOUND'],
      [{ customerId: 'nope' }, 'REFERENCE_NOT_FOUND'],
      [{ lines: [line(it_.old!, '1')] }, 'REFERENCE_INACTIVE', { lineNo: 1 }],
      [
        { lines: [line(it_.box!, '1'), line(it_.foreign!, '1')] },
        'REFERENCE_NOT_FOUND',
        { lineNo: 2 },
      ],
      [{ lines: [line(it_.box!, '1.5')] }, 'QUANTITY_PRECISION', { precision: 0 }],
      [{ lines: [line(it_.oil!, '1.2345')] }, 'QUANTITY_PRECISION', { precision: 3 }],
      [
        { lines: [line(it_.box!, '1', '10', { discountAmount: '10.01' })] },
        'DISCOUNT_EXCEEDS_SUBTOTAL',
      ],
      [{ orderDate: TODAY, requestedDate: shift(-1) }, 'REQUESTED_DATE_INVALID'],
    ];
    for (const [body, err, details] of cases) {
      const res = await s.post(SO, { customerId: cu.one, ...body });
      expect(res.statusCode, `${err} ${res.body}`).toBe(422);
      expect(code(res)).toBe(err);
      if (details) expect(j(res).error.details).toMatchObject(details);
    }
    expect(await h.db.salesOrder.count()).toBe(0);
    // An order of nothing is a valid draft, but cannot be submitted.
    const empty = await draft(s, { lines: [] });
    expect(empty.availability).toBeNull();
    const res = await s.post(`${SO}/${empty.id}/submit`);
    expect([res.statusCode, code(res)]).toEqual([422, 'SO_EMPTY']);
  });

  it('a member of two branches chooses one first; the order stays in that branch', async () => {
    const both = await as('sales.both@a.example');
    const res = await both.post(SO, { customerId: cu.one });
    expect([res.statusCode, code(res)]).toEqual([409, 'BRANCH_SELECTION_REQUIRED']);
    await both.post('/api/v1/company/context/branch', { branchId: br.X });
    const o = await draft(both);
    expect(o.branch.id).toBe(br.X);
  });

  // ---------------------------------------------------------------- lifecycle

  it('edits a draft, submits, confirms once, cancels with a reason — terminal after', async () => {
    const s = await as('sales@a.example');
    const m = await as('salesm@a.example');
    const o = await draft(s);
    // Header and lines are the creator's while DRAFT.
    const patched = (
      await ok(
        s.patch(`${SO}/${o.id}`, {
          customerId: cu.two,
          customerReference: 'REF-9',
          requestedDate: shift(3),
        }),
      )
    ).order;
    expect(patched.customer.code).toBe('CUS-000002');
    expect(patched.customerReference).toBe('REF-9');
    expect(
      (await ok(s.patch(`${SO}/${o.id}`, { customerReference: '' }))).order.customerReference,
    ).toBeNull();
    expect((await s.patch(`${SO}/${o.id}`, {})).statusCode).toBe(400);
    expect((await s.patch(`${SO}/${o.id}`, { status: 'SUBMITTED' })).statusCode).toBe(400);
    const lines = (
      await ok(
        s.put(`${SO}/${o.id}/lines`, {
          lines: [line(it_.box!, '4', '25'), line(it_.oil!, '0.5', '10')],
        }),
      )
    ).order;
    expect(lines.lines.map((l: J) => [l.lineNo, l.quantity, l.lineTotal])).toEqual([
      [1, '4', '100.00'],
      [2, '0.5', '5.00'],
    ]);
    expect(lines.grandTotal).toBe('105.00');
    // Another salesperson cannot touch it (cannot even see it).
    const s2 = await as('sales2@a.example');
    expect((await s2.get(`${SO}/${o.id}`)).statusCode).toBe(404);
    expect((await s2.patch(`${SO}/${o.id}`, { note: 'x' })).statusCode).toBe(404);
    // A manager sees the draft but it is still the creator's to edit, submit or discard.
    const asMgr = (await ok(m.get(`${SO}/${o.id}`))).order;
    expect(asMgr.actions).toEqual([]);
    expect(code(await m.post(`${SO}/${o.id}/cancel`, { reason: 'x' }))).toBe('PERMISSION_DENIED');
    expect((await m.patch(`${SO}/${o.id}`, { note: 'x' })).statusCode).toBe(403);
    // Staff cannot confirm their own draft or anything else.
    expect(code(await s.post(`${SO}/${o.id}/confirm`))).toBe('PERMISSION_DENIED');

    const sub = (await ok(s.post(`${SO}/${o.id}/submit`))).order;
    expect(sub).toMatchObject({ status: 'SUBMITTED', submittedBy: { name: 'sales' }, actions: [] });
    expect(code(await s.patch(`${SO}/${o.id}`, { note: 'late' }))).toBe('SO_NOT_EDITABLE');
    expect(code(await s.put(`${SO}/${o.id}/lines`, { lines: [] }))).toBe('SO_NOT_EDITABLE');
    expect(code(await s.post(`${SO}/${o.id}/submit`))).toBe('SO_INVALID_TRANSITION');
    // Once submitted, only a manager cancels.
    expect(code(await s.post(`${SO}/${o.id}/cancel`, { reason: 'x' }))).toBe('PERMISSION_DENIED');
    // Now every salesperson in the branch sees it.
    expect((await s2.get(`${SO}/${o.id}`)).statusCode).toBe(200);

    expect((await ok(m.get(`${SO}/${o.id}`))).order.actions).toEqual(['confirm', 'cancel']);
    const conf = (await ok(m.post(`${SO}/${o.id}/confirm`))).order;
    expect(conf).toMatchObject({
      status: 'CONFIRMED',
      confirmedBy: { name: 'salesm' },
      actions: ['cancel', 'allocate'],
    });
    expect(code(await m.post(`${SO}/${o.id}/confirm`))).toBe('SO_ALREADY_CONFIRMED');
    expect(code(await m.patch(`${SO}/${o.id}`, { note: 'x' }))).toBe('PERMISSION_DENIED');

    const noReason = await m.post(`${SO}/${o.id}/cancel`, {});
    expect([noReason.statusCode, code(noReason)]).toEqual([422, 'REASON_REQUIRED']);
    expect((await m.post(`${SO}/${o.id}/cancel`, { reason: '   ' })).statusCode).toBe(422);
    const can = (await ok(m.post(`${SO}/${o.id}/cancel`, { reason: 'Customer withdrew' }))).order;
    expect(can).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Customer withdrew',
      cancelledBy: { name: 'salesm' },
      availability: null,
      actions: [],
    });
    expect(can.lines.every((l: J) => l.availability === null)).toBe(true);
    for (const a of ['confirm', 'cancel']) {
      expect(code(await m.post(`${SO}/${o.id}/${a}`, { reason: 'x' }))).toBe(
        'SO_INVALID_TRANSITION',
      );
    }
    expect(code(await s.post(`${SO}/${o.id}/submit`))).toBe('SO_INVALID_TRANSITION');
    // A creator cancels their own draft without a reason.
    const d2 = await draft(s);
    expect((await ok(s.post(`${SO}/${d2.id}/cancel`))).order.status).toBe('CANCELLED');

    const timeline = (await ok(m.get(`${SO}/${o.id}`))).timeline;
    expect(timeline.map((e: J) => e.type)).toEqual([
      'SALES_ORDER_CREATED',
      'SALES_ORDER_SUBMITTED',
      'SALES_ORDER_CONFIRMED',
      'SALES_ORDER_CANCELLED',
    ]);
  });

  it('snapshots follow the master until confirmation, then freeze', async () => {
    const s = await as('sales@a.example');
    const m = await as('salesm@a.example');
    const o = await draft(s);
    await h.db.customer.update({
      where: { id: cu.one },
      data: { name: 'Renamed Ltd', taxId: '0999' },
    });
    await h.db.item.update({ where: { id: it_.box }, data: { name: 'Box (new name)' } });
    // Refreshed at submit.
    const sub = (await ok(s.post(`${SO}/${o.id}/submit`))).order;
    expect(sub.customer).toMatchObject({ name: 'Renamed Ltd', taxId: '0999' });
    expect(sub.lines[0].item.name).toBe('Box (new name)');
    // An item deactivated between submit and confirm blocks confirmation.
    await h.db.item.update({
      where: { id: it_.box },
      data: { status: 'INACTIVE', deactivatedAt: new Date() },
    });
    const refused = await m.post(`${SO}/${o.id}/confirm`);
    expect([refused.statusCode, code(refused)]).toEqual([422, 'REFERENCE_INACTIVE']);
    expect((await ok(m.get(`${SO}/${o.id}`))).order.status).toBe('SUBMITTED');
    await h.db.item.update({
      where: { id: it_.box },
      data: { status: 'ACTIVE', deactivatedAt: null },
    });
    await ok(m.post(`${SO}/${o.id}/confirm`));
    // Frozen: later master changes do not reach the confirmed order.
    await h.db.customer.update({ where: { id: cu.one }, data: { name: 'Third Name' } });
    await h.db.item.update({ where: { id: it_.box }, data: { name: 'Box v3' } });
    const after = (await ok(m.get(`${SO}/${o.id}`))).order;
    expect(after.customer.name).toBe('Renamed Ltd');
    expect(after.lines[0].item.name).toBe('Box (new name)');
    // An inactive customer cannot be submitted.
    const d = await draft(s, { customerId: cu.two });
    await h.db.customer.update({
      where: { id: cu.two },
      data: { status: 'INACTIVE', deactivatedAt: new Date() },
    });
    expect(code(await s.post(`${SO}/${d.id}/submit`))).toBe('REFERENCE_INACTIVE');
  });

  // ---------------------------------------------------------------- availability

  it('availability is informational: ledger balances of the branch, FEFO set, never written', async () => {
    await balance(it_.box!, '4', loc.HO);
    await balance(it_.box!, '3', loc.HO2, { number: 'L-OK', expiry: shift(30) });
    await balance(it_.box!, '5', loc.HO2, { number: 'L-EXP', expiry: shift(-1) }); // expired
    await balance(it_.box!, '100', loc.X); // another branch
    await balance(it_.oil!, '0.75', loc.HO);
    const s = await as('sales@a.example');
    const movements = await h.db.stockMovement.count();
    const balances = JSON.stringify(
      await h.db.stockBalance.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, quantityOnHand: true },
      }),
    );

    const o = await draft(s, {
      lines: [
        line(it_.box!, '5'),
        line(it_.box!, '4'), // consumes what line 1 left: 2 of 4
        line(it_.oil!, '0.5'),
        line(it_.svc!, '1'),
      ],
    });
    expect(o.lines.map((l: J) => l.availability)).toEqual([
      { state: 'AVAILABLE', onHand: '12', reserved: '0', available: '7', shortage: '0' },
      { state: 'PARTIALLY_AVAILABLE', onHand: '12', reserved: '0', available: '2', shortage: '2' },
      { state: 'AVAILABLE', onHand: '0.75', reserved: '0', available: '0.75', shortage: '0' },
      { state: 'NOT_STOCK_TRACKED', onHand: null, reserved: null, available: null, shortage: null },
    ]);
    expect(o.availability).toBe('PARTIALLY_AVAILABLE');
    expect(o.shortageLines).toBe(1);
    // available = Σ of the FEFO candidates (expired lots excluded).
    const fefo = await fefoCandidates(h.db, {
      companyId: A.companyId,
      branchId: br.HO,
      itemId: it_.box!,
      today: TODAY,
    });
    expect(fefo.reduce((t, c) => t.plus(c.quantityOnHand), new Decimal(0)).toString()).toBe('7');

    // Two orders both "see" the same stock — nothing is reserved.
    const o2 = await draft(s, { lines: [line(it_.box!, '7')] });
    expect(o2.availability).toBe('AVAILABLE');
    const items = (await ok(s.get(`${S}/items?q=BOX`))).items;
    expect(items).toEqual([
      expect.objectContaining({
        code: 'BOX-1',
        available: '7',
        unit: { code: 'PCS', name: 'Piece', precision: 0 },
      }),
    ]);
    const svc = (await ok(s.get(`${S}/items?q=SVC`))).items[0];
    expect(svc).toMatchObject({ inventoryTracked: false, available: null });
    expect((await ok(s.get(`${S}/items?q=OLD`))).items).toEqual([]);
    expect(code(await s.get(`${S}/items?branchId=${br.X}`))).toBe('BRANCH_NOT_ALLOWED');

    // Submitting and confirming write no stock at all.
    const m = await as('salesm@a.example');
    await ok(s.post(`${SO}/${o.id}/submit`));
    await ok(m.post(`${SO}/${o.id}/confirm`));
    expect(await h.db.stockMovement.count()).toBe(movements);
    expect(
      JSON.stringify(
        await h.db.stockBalance.findMany({
          orderBy: { id: 'asc' },
          select: { id: true, quantityOnHand: true },
        }),
      ),
    ).toBe(balances);

    // Shortage filter and counts: open orders only (a draft with a shortage is not listed).
    const short = await draft(s, { lines: [line(it_.oil!, '9')] });
    expect(short.availability).toBe('PARTIALLY_AVAILABLE');
    let list = (await ok(m.get(`${SO}?availability=SHORTAGE`))).items;
    expect(list.map((r: J) => r.id)).toEqual([o.id]);
    await ok(s.post(`${SO}/${short.id}/submit`));
    list = (await ok(m.get(`${SO}?availability=SHORTAGE`))).items;
    expect(list.map((r: J) => r.id).sort()).toEqual([o.id, short.id].sort());
    const ctx = await ok(m.get(`${S}/context`));
    expect(ctx.counts).toEqual({
      myDrafts: 0,
      awaitingConfirmation: 1,
      confirmed: 1,
      withShortage: 2,
    });
    expect(ctx.orders).toEqual({ view: true, create: true, confirm: true, cancel: true });
    expect((await ok(s.get(`${S}/context`))).counts.myDrafts).toBe(1);
    // With no stock at all, a tracked line is UNAVAILABLE.
    await h.db.stockBalance.deleteMany({ where: { itemId: it_.oil } });
    expect((await ok(m.get(`${SO}/${short.id}`))).order.lines[0].availability).toMatchObject({
      state: 'UNAVAILABLE',
      shortage: '9',
    });
  });

  // ---------------------------------------------------------------- list

  it('lists with filters, search and paging', async () => {
    const s = await as('sales@a.example');
    const m = await as('salesm@a.example');
    const a1 = await draft(s, { customerReference: 'ALPHA-REF' });
    const a2 = await draft(s, { customerId: cu.two, orderDate: shift(-10) });
    await ok(s.post(`${SO}/${a2.id}/submit`));
    for (let i = 0; i < 3; i++) await draft(s);
    const all = await ok(s.get(`${SO}?pageSize=2`));
    expect(all).toMatchObject({ total: 5, page: 1, pageSize: 2, hasMore: true });
    expect((await ok(s.get(`${SO}?pageSize=2&page=3`))).hasMore).toBe(false);
    expect((await ok(s.get(`${SO}?status=SUBMITTED`))).items.map((r: J) => r.id)).toEqual([a2.id]);
    expect((await ok(s.get(`${SO}?customerId=${cu.two}`))).items.map((r: J) => r.id)).toEqual([
      a2.id,
    ]);
    expect((await ok(s.get(`${SO}?q=alpha-ref`))).items.map((r: J) => r.id)).toEqual([a1.id]);
    expect((await ok(s.get(`${SO}?q=CUS-000002`))).items.map((r: J) => r.id)).toEqual([a2.id]);
    expect((await ok(s.get(`${SO}?q=${a1.number}`))).items.map((r: J) => r.id)).toEqual([a1.id]);
    expect(
      (await ok(s.get(`${SO}?from=${shift(-11)}&to=${shift(-9)}`))).items.map((r: J) => r.id),
    ).toEqual([a2.id]);
    expect((await s.get(`${SO}?status=OPEN`)).statusCode).toBe(400);
    expect((await s.get(`${SO}?pageSize=101`)).statusCode).toBe(400);
    expect((await s.get(`${SO}?sort=total`)).statusCode).toBe(400);
    // A second salesperson sees only the submitted order; the manager sees all.
    const s2 = await as('sales2@a.example');
    expect((await ok(s2.get(SO))).items.map((r: J) => r.id)).toEqual([a2.id]);
    expect((await ok(m.get(SO))).total).toBe(5);
    const row = all.items[0];
    expect(Object.keys(row).sort()).toEqual(
      [
        'allocationState',
        'availability',
        'branch',
        'createdBy',
        'currency',
        'customer',
        'fulfilmentState', // EP39: delivery progress visible in the Sales list
        'grandTotal',
        'id',
        'lineCount',
        'number',
        'orderDate',
        'pickReadiness',
        'requestedDate',
        'status',
        'updatedAt',
      ].sort(),
    );
  });

  // ---------------------------------------------------------------- roles & isolation

  it('roles: executive and viewer read submitted work only; other departments see nothing', async () => {
    const s = await as('sales@a.example');
    const d = await draft(s);
    const sub = await draft(s);
    await ok(s.post(`${SO}/${sub.id}/submit`));
    for (const email of ['exec@a.example', 'viewer@a.example']) {
      const b = await as(email);
      expect(
        (await ok(b.get(SO))).items.map((r: J) => r.id),
        email,
      ).toEqual([sub.id]);
      expect((await b.get(`${SO}/${d.id}`)).statusCode, email).toBe(404);
      expect((await ok(b.get(`${SO}/${sub.id}`))).order.actions, email).toEqual([]);
      expect(code(await b.post(SO, { customerId: cu.one })), email).toBe('PERMISSION_DENIED');
      expect(code(await b.post(`${SO}/${sub.id}/confirm`)), email).toBe('PERMISSION_DENIED');
      expect(code(await b.post(`${SO}/${sub.id}/cancel`, { reason: 'x' })), email).toBe(
        'PERMISSION_DENIED',
      );
      expect((await ok(b.get(`${S}/context`))).orders.create, email).toBe(false);
    }
    for (const email of ['wh@a.example', 'acct@a.example', 'admin@a.example']) {
      const b = await as(email);
      for (const url of [`${S}/context`, SO, `${SO}/${sub.id}`, `${S}/items`]) {
        const res = await b.get(url);
        expect([res.statusCode, code(res)], `${email} ${url}`).toEqual([403, 'PERMISSION_DENIED']);
      }
      expect((await b.post(SO, { customerId: cu.one })).statusCode, email).toBe(403);
    }
    // The owner holds every tier in every branch.
    const owner = await as('owner@a.example', 'HO');
    expect((await ok(owner.get(`${SO}/${sub.id}`))).order.actions).toEqual(['confirm', 'cancel']);
  });

  it('isolation: another branch or company cannot read or act on an order (IDOR)', async () => {
    const s = await as('sales@a.example');
    const o = await draft(s);
    await ok(s.post(`${SO}/${o.id}/submit`));
    const ox = await ok(s.get(`${SO}/${o.id}`));
    expect(ox.order.branch.id).toBe(br.HO);
    const x = await as('sales.x@a.example');
    const b = await as('owner@b.example');
    for (const actor of [x, b]) {
      expect((await actor.get(`${SO}/${o.id}`)).statusCode).toBe(404);
      expect((await actor.patch(`${SO}/${o.id}`, { note: 'x' })).statusCode).toBe(404);
      expect((await actor.put(`${SO}/${o.id}/lines`, { lines: [] })).statusCode).toBe(404);
      for (const a of ['submit', 'confirm', 'cancel']) {
        const res = await actor.post(`${SO}/${o.id}/${a}`, { reason: 'x' });
        expect([res.statusCode, code(res)]).toEqual([404, 'SO_NOT_FOUND']);
      }
      expect((await ok(actor.get(SO))).items).toEqual([]);
      expect((await ok(actor.get(`${SO}?branchId=${br.HO}`))).items).toEqual([]);
    }
    // Company B cannot put A's customer or item on its own order.
    const res = await b.post(SO, { customerId: cu.one });
    expect([res.statusCode, code(res)]).toEqual([422, 'REFERENCE_NOT_FOUND']);
    expect((await ok(s.get(`${SO}/${o.id}`))).order.status).toBe('SUBMITTED');
  });

  // ---------------------------------------------------------------- races

  it('race: two managers confirm at once — exactly one wins; confirm vs cancel — one outcome', async () => {
    const s = await as('sales@a.example');
    const [m1, m2] = await Promise.all([as('salesm@a.example'), as('salesm2@a.example')]);
    const o = await draft(s);
    await ok(s.post(`${SO}/${o.id}/submit`));
    const res = await Promise.all([
      m1.post(`${SO}/${o.id}/confirm`),
      m2.post(`${SO}/${o.id}/confirm`),
    ]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      await h.db.auditLog.count({ where: { entityId: o.id, action: 'SALES_ORDER_CONFIRMED' } }),
    ).toBe(1);

    const o2 = await draft(s);
    await ok(s.post(`${SO}/${o2.id}/submit`));
    const mixed = await Promise.all([
      m1.post(`${SO}/${o2.id}/confirm`),
      m2.post(`${SO}/${o2.id}/cancel`, { reason: 'Duplicate' }),
    ]);
    const okCount = mixed.filter((r) => r.statusCode === 200).length;
    expect(okCount).toBeGreaterThanOrEqual(1);
    const final = (await ok(m1.get(`${SO}/${o2.id}`))).order;
    // Either confirmed then cancelled (both 200), or cancelled first (confirm refused).
    expect(final.status).toBe('CANCELLED');
    expect(
      await h.db.auditLog.count({ where: { entityId: o2.id, action: 'SALES_ORDER_CANCELLED' } }),
    ).toBe(1);

    // A draft edited and submitted at once: the edit lands before or is refused after.
    const o3 = await draft(s);
    const [edit, submit] = await Promise.all([
      s.put(`${SO}/${o3.id}/lines`, { lines: [line(it_.box!, '9')] }),
      s.post(`${SO}/${o3.id}/submit`),
    ]);
    expect(submit.statusCode).toBe(200);
    const after = (await ok(s.get(`${SO}/${o3.id}`))).order;
    if (edit.statusCode === 200) expect(['2', '9']).toContain(after.lines[0].quantity);
    else expect(code(edit)).toBe('SO_NOT_EDITABLE');
    expect(after.status).toBe('SUBMITTED');
  });

  it('race: numbering stays unique and gapless under concurrent creation', async () => {
    const s = await as('sales@a.example');
    const s2 = await as('sales2@a.example');
    const res = await Promise.all(
      Array.from({ length: 8 }, (_, i) => (i % 2 ? s : s2).post(SO, { customerId: cu.one })),
    );
    expect(res.every((r) => r.statusCode === 201)).toBe(true);
    const numbers = res.map((r) => j(r).order.number).sort();
    expect(numbers).toEqual(
      Array.from({ length: 8 }, (_, i) => `SO-${PERIOD}-${String(i + 1).padStart(6, '0')}`),
    );
  });

  // ---------------------------------------------------------------- audit & privacy

  it('audits every step without amounts; responses never carry cost', async () => {
    await balance(it_.box!, '10', loc.HO);
    const s = await as('sales@a.example');
    const m = await as('salesm@a.example');
    const o = await draft(s, { lines: [line(it_.box!, '2', '999.99', { taxRate: '7' })] });
    await ok(s.patch(`${SO}/${o.id}`, { note: 'secret note' }));
    await ok(s.put(`${SO}/${o.id}/lines`, { lines: [line(it_.box!, '3', '999.99')] }));
    await ok(s.post(`${SO}/${o.id}/submit`));
    await ok(m.post(`${SO}/${o.id}/confirm`));
    await ok(m.post(`${SO}/${o.id}/cancel`, { reason: 'Customer withdrew' }));
    const events = await h.db.auditLog.findMany({
      where: { entityType: 'SalesOrder', entityId: o.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((e) => e.action)).toEqual([
      'SALES_ORDER_CREATED',
      'SALES_ORDER_UPDATED',
      'SALES_ORDER_UPDATED',
      'SALES_ORDER_SUBMITTED',
      'SALES_ORDER_CONFIRMED',
      'SALES_ORDER_CANCELLED',
    ]);
    const text = JSON.stringify(events.map((e) => e.changes));
    expect(text).not.toMatch(/(?<![\w.])999(\.0+)?(?![\w.])|price|total|amount|secret|withdrew/i);
    expect(events[1]!.changes).toMatchObject({ fields: 'note' });
    // The order's own responses: selling terms yes, cost / margin / supplier never.
    for (const body of [
      (await m.get(`${SO}/${o.id}`)).body,
      (await m.get(SO)).body,
      (await m.get(`${S}/items`)).body,
      (await m.get(`${S}/context`)).body,
    ]) {
      expect(keysOf(JSON.parse(body)).filter((k) => COST.test(k))).toEqual([]);
    }
    // Company activity lists the business events.
    const owner = await as('owner@a.example', 'HO');
    const activity = await owner.get('/api/v1/company/current/activity');
    expect(activity.statusCode, activity.body).toBe(200);
    expect(activity.body).toContain('SALES_ORDER_CONFIRMED');
    expect(activity.body).not.toMatch(/999/);
  });
});
