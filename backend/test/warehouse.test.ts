import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { allowedFields } from '../src/domain/access/data-classification.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { PERMISSION_CATALOG, isRoleDefault } from '../src/permissions/catalog.js';
import { lineAmounts } from '../src/purchasing/money.js';
import { companyDay } from '../src/purchasing/service.js';
import { grRefusal, type WarehouseActor } from '../src/warehouse/policy.js';
import { INVENTORY_FIELD_CLASSES } from '../src/warehouse/views.js';
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
 * EP31 goods receipts and inventory: numbering, receipts only from
 * PENDING_RECEIVE orders in the member's branch, partial and repeated
 * receiving, accepted / rejected semantics, lot and expiry rules, split
 * allocations, the posting transaction (movements + balances, ledger =
 * balance), duplicate-post and over-receive races, cancellation by reversal
 * (never below zero), the order's RECEIVED state, FEFO order, Warehouse
 * privacy (no money anywhere), permissions per role, company isolation,
 * mass assignment, audit and the item structure lock.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const W = '/api/v1/warehouse';
const GR = `${W}/receipts`;
const PO = '/api/v1/purchase-orders';
const RCV = `${W}/pending-receive`;
const MONEY =
  /price|discount|tax|total|amount|deposit|currency|payment|terms|cost|margin|value|subtotal/i;

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

describe('Receiving policy and contracts (EP31)', () => {
  it('adds one MANAGE code for cancelling a posted receipt — no synonyms', () => {
    const p = PERMISSION_CATALOG.find((x) => x.code === 'warehouse.receiving.cancel')!;
    expect(p).toMatchObject({ namespace: 'WAREHOUSE', tier: 'MANAGE', scope: 'BRANCH' });
    expect(isRoleDefault('DEPARTMENT_STAFF', 'warehouse.receiving.process')).toBe(true);
    expect(isRoleDefault('DEPARTMENT_STAFF', 'warehouse.receiving.cancel')).toBe(false);
    expect(isRoleDefault('DEPARTMENT_MANAGER', 'warehouse.receiving.cancel')).toBe(true);
    expect(isRoleDefault('EXECUTIVE', 'warehouse.inventory.view')).toBe(true);
    expect(isRoleDefault('EXECUTIVE', 'warehouse.receiving.process')).toBe(false);
    expect(PERMISSION_CATALOG.some((x) => /\.(post|reverse|receive)$/.test(x.code))).toBe(false);
  });

  it('decides every receipt transition in one table', () => {
    const actor = (over: Partial<WarehouseActor['receiving']> = {}) =>
      ({
        branches: [{ id: 'b1', code: '00001', name: 'B', type: 'BRANCH' }],
        receiving: { view: true, process: true, cancel: false, ...over },
        inventory: { view: true },
      }) as unknown as WarehouseActor;
    const r = (status: any, branchId = 'b1') => ({ status, branchId });
    expect(grRefusal(actor(), 'post', r('DRAFT'))).toBeNull();
    expect(grRefusal(actor(), 'post', r('POSTED'))).toBe('status');
    expect(grRefusal(actor(), 'edit', r('POSTED'))).toBe('status');
    expect(grRefusal(actor(), 'cancel', r('DRAFT'))).toBeNull();
    expect(grRefusal(actor(), 'cancel', r('POSTED'))).toBe('authority');
    expect(grRefusal(actor({ cancel: true }), 'cancel', r('POSTED'))).toBeNull();
    expect(grRefusal(actor({ cancel: true }), 'cancel', r('CANCELLED'))).toBe('status');
    expect(grRefusal(actor({ process: false }), 'post', r('DRAFT'))).toBe('authority');
    expect(grRefusal(actor(), 'post', r('DRAFT', 'b2'))).toBe('branch');
  });

  it('every receipt / stock / movement key is operational — none is financial', () => {
    const allowed = new Set<string>(
      allowedFields(INVENTORY_FIELD_CLASSES as Record<string, any>, 'warehouse') as string[],
    );
    for (const k of Object.keys(INVENTORY_FIELD_CLASSES)) {
      expect(allowed.has(k), k).toBe(true);
      expect(k, k).not.toMatch(MONEY);
    }
  });
});

// ------------------------------------------------------------------ database

describeDb('Goods receipts and inventory (EP31)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const br: Record<'HO' | 'X', string> = { HO: '', X: '' };
  const ids: Record<string, string> = {};
  const it_: Record<string, string> = {};
  const loc: Record<string, string> = {};
  let supplierId = '';
  let seq = 0;
  const PERIOD = companyDay('Asia/Bangkok').slice(0, 7).replace('-', '');
  const TODAY = companyDay('Asia/Bangkok');

  // email, role, company, departments, branches (null = all)
  const PEOPLE: [string, CompanyRole, 'A' | 'B', DepartmentCode[], ('HO' | 'X')[] | null][] = [
    ['owner@a.example', 'COMPANY_OWNER', 'A', [], null],
    ['admin@a.example', 'SYSTEM_ADMIN', 'A', [], null],
    ['exec@a.example', 'EXECUTIVE', 'A', [], null],
    ['wh@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['X']],
    ['wh2@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['X']],
    ['whm@a.example', 'DEPARTMENT_MANAGER', 'A', ['WAREHOUSE'], ['X']],
    ['wh.ho@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['HO']],
    ['viewer@a.example', 'VIEWER', 'A', ['WAREHOUSE'], ['X']],
    ['buyer@a.example', 'DEPARTMENT_MANAGER', 'A', ['PURCHASING'], null],
    ['acct@a.example', 'DEPARTMENT_MANAGER', 'A', ['ACCOUNTING'], null],
    ['owner@b.example', 'COMPANY_OWNER', 'B', [], null],
  ];

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    seq = 0;
    A = await createActiveCompany(h.db, {
      name: 'Alpha',
      departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
    });
    B = await createActiveCompany(h.db, { name: 'Beta', departments: ['WAREHOUSE'] });
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
        await h.db.membership.create({
          data: { userId: u.id, companyId: dept.companyId, departmentId: dept.id },
        });
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
    const unit = (c: string, name: string, precision: number) =>
      h.db.unit.create({ data: { companyId: A.companyId, code: c, name, precision } });
    const pcs = await unit('PCS', 'Piece', 0);
    const kg = await unit('KG', 'Kilogram', 3);
    const item = (
      c: string,
      unitId: string,
      t: Partial<{
        type: any;
        inventoryTracked: boolean;
        lotTracking: any;
        expiryTracking: any;
      }> = {},
    ) =>
      h.db.item.create({
        data: {
          companyId: A.companyId,
          code: c,
          type: 'RAW_MATERIAL',
          name: `Item ${c}`,
          baseUnitId: unitId,
          ...t,
        },
      });
    it_.box = (await item('BOX-1', pcs.id)).id; // no lot, no expiry
    it_.oil = (
      await item('OIL-1', kg.id, { lotTracking: 'OPTIONAL', expiryTracking: 'OPTIONAL' })
    ).id;
    it_.pin = (await item('PIN-1', pcs.id, { lotTracking: 'OPTIONAL' })).id; // lot optional, no expiry
    it_.cream = (
      await item('CRM-1', pcs.id, { lotTracking: 'REQUIRED', expiryTracking: 'REQUIRED' })
    ).id;
    it_.svc = (await item('SVC-1', pcs.id, { type: 'NON_STOCK', inventoryTracked: false })).id;
    const location = (branchId: string, c: string, opts: { def?: boolean; off?: boolean } = {}) =>
      h.db.warehouseLocation.create({
        data: {
          companyId: A.companyId,
          branchId,
          code: c,
          name: `Loc ${c}`,
          defaultSlot: opts.def ? true : null,
          status: opts.off ? 'INACTIVE' : 'ACTIVE',
          deactivatedAt: opts.off ? new Date() : null,
        },
      });
    loc.MAIN = (await location(br.X, 'MAIN', { def: true })).id;
    loc.QC = (await location(br.X, 'QC')).id;
    loc.OLD = (await location(br.X, 'OLD', { off: true })).id;
    loc.HO = (await location(br.HO, 'HO-MAIN', { def: true })).id;
    supplierId = (
      await h.db.supplier.create({
        data: {
          companyId: A.companyId,
          code: 'SUP-000001',
          name: 'Supplier One',
          taxId: '0105551234567',
          contactName: 'Khun Sales',
          phone: '02-000-0000',
        },
      })
    ).id;
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

  type Item = 'box' | 'oil' | 'pin' | 'cream' | 'svc';
  /** An issued, PENDING_RECEIVE order (and its approved request) written directly. */
  const pendingPo = async (branch: 'HO' | 'X', lines: { item: Item; qty: string }[]) => {
    const n = ++seq; // captured: helpers may run in parallel
    const companyId = A.companyId;
    const branchId = br[branch];
    const items = await h.db.item.findMany({
      where: { id: { in: lines.map((l) => it_[l.item]!) } },
      include: { baseUnit: true },
    });
    const info = (l: { item: Item }) => items.find((i) => i.id === it_[l.item])!;
    const created = await h.db.purchaseRequest.create({
      data: {
        companyId,
        branchId,
        number: `PR-209901-${String(n).padStart(6, '0')}`,
        department: 'PURCHASING',
        requesterMemberId: ids['buyer@a.example']!,
        status: 'APPROVED',
        requestDate: new Date('2099-01-01T00:00:00Z'),
        lineCounter: lines.length,
        submittedAt: new Date(),
        approvedAt: new Date(),
        approvedByMemberId: ids['buyer@a.example']!,
      },
    });
    await h.db.purchaseRequestLine.createMany({
      data: lines.map((l, i) => ({
        companyId,
        purchaseRequestId: created.id,
        lineNo: i + 1,
        type: 'ITEM' as const,
        itemId: info(l).id,
        itemCode: info(l).code,
        itemName: info(l).name,
        unitId: info(l).baseUnitId,
        unitCode: info(l).baseUnit.code,
        unitName: info(l).baseUnit.name,
        quantity: l.qty,
      })),
    });
    const pr = await h.db.purchaseRequest.findUniqueOrThrow({
      where: { id: created.id },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    const now = new Date();
    const po = await h.db.purchaseOrder.create({
      data: {
        companyId,
        branchId,
        number: `PO-209901-${String(n).padStart(6, '0')}`,
        status: 'PENDING_RECEIVE',
        supplierId,
        supplierCode: 'SUP-000001',
        supplierName: 'Supplier One',
        supplierTaxId: '0105551234567',
        orderDate: new Date('2099-01-01T00:00:00Z'),
        paymentTerms: 'Net 30 secret-terms',
        lineCounter: lines.length,
        createdByMemberId: ids['buyer@a.example']!,
        issuedAt: now,
        issuedByMemberId: ids['buyer@a.example']!,
        pendingReceiveAt: now,
      },
    });
    for (const [i, l] of lines.entries()) {
      const amounts = lineAmounts({
        quantity: l.qty,
        unitPrice: '9.99',
        discountAmount: '0',
        taxRate: '7',
      });
      await h.db.purchaseOrderLine.create({
        data: {
          companyId,
          branchId,
          purchaseOrderId: po.id,
          lineNo: i + 1,
          purchaseRequestId: pr.id,
          purchaseRequestLineId: pr.lines[i]!.id,
          prNumber: pr.number,
          prLineNo: i + 1,
          type: 'ITEM',
          itemId: info(l).id,
          itemCode: info(l).code,
          itemName: info(l).name,
          unitId: info(l).baseUnitId,
          unitCode: info(l).baseUnit.code,
          unitName: info(l).baseUnit.name,
          quantity: l.qty,
          unitPrice: '9.99',
          taxRate: '7',
          ...amounts,
        },
      });
    }
    return h.db.purchaseOrder.findUniqueOrThrow({
      where: { id: po.id },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
  };

  const draft = async (b: Browser, purchaseOrderId: string, extra: J = {}) => {
    const res = await b.post(GR, { purchaseOrderId, ...extra });
    expect(res.statusCode, res.body).toBe(201);
    return j(res).receipt;
  };
  const line = (r: J, n = 1) => r.lines.find((l: J) => l.lineNo === n);
  const save = (b: Browser, r: J, n: number, body: J) =>
    b.put(`${GR}/${r.id}/lines/${line(r, n).id}`, body);
  const accept = (qty: string, allocations?: J[]) => ({
    acceptedQuantity: qty,
    allocations: allocations ?? [{ locationId: loc.MAIN, quantity: qty }],
  });
  const post = async (b: Browser, r: J) => {
    const res = await b.post(`${GR}/${r.id}/post`);
    expect(res.statusCode, res.body).toBe(200);
    return j(res).receipt;
  };
  /** Ledger = balance for every (location, item, lot) of company A. */
  const assertLedger = async () => {
    const rows = await h.db.$queryRaw<{ bad: bigint }[]>`
      SELECT count(*) AS bad FROM "StockBalance" b
      WHERE b."companyId" = ${A.companyId} AND b."quantityOnHand" <> (
        SELECT COALESCE(SUM(m."quantityDelta"), 0) FROM "StockMovement" m
        WHERE m."locationId" = b."locationId" AND m."itemId" = b."itemId"
          AND COALESCE(m."lotId", '') = b."lotKey")`;
    expect(Number(rows[0]!.bad)).toBe(0);
  };
  const onHand = async (itemId: string, locationId = loc.MAIN!, lotId: string | null = null) =>
    (
      await h.db.stockBalance.findUnique({
        where: { locationId_itemId_lotKey: { locationId, itemId, lotKey: lotId ?? '' } },
      })
    )?.quantityOnHand.toFixed(6) ?? '0.000000';

  it('creates numbered drafts from a PENDING_RECEIVE order: receivable lines, default location', async () => {
    const po = await pendingPo('X', [
      { item: 'box', qty: '100' },
      { item: 'svc', qty: '1' },
    ]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id);
    expect(r.number).toBe(`GR-${PERIOD}-000001`);
    expect(r).toMatchObject({
      status: 'DRAFT',
      branch: { code: '00001' },
      order: { id: po.id, number: po.number },
      supplier: { code: 'SUP-000001', name: 'Supplier One' },
      defaultLocation: { code: 'MAIN' },
      actions: ['edit', 'post', 'cancel'],
    });
    // The service line is not received into stock.
    expect(r.lines).toHaveLength(1);
    expect(line(r)).toMatchObject({
      item: { code: 'BOX-1', lotTracking: 'NONE' },
      unit: { code: 'PCS', precision: 0 },
      ordered: '100',
      receivedElsewhere: '0',
      remaining: '100',
      acceptedQuantity: '0',
    });
    // Concurrent creates: distinct, consecutive numbers (atomic sequence, no MAX + 1).
    const many = await Promise.all(
      Array.from({ length: 8 }, () => wh.post(GR, { purchaseOrderId: po.id })),
    );
    expect(many.every((x) => x.statusCode === 201)).toBe(true);
    const nums = many.map((x) => Number(j(x).receipt.number.slice(-6))).sort((a, b) => a - b);
    expect(nums).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('only from a receivable order of the member’s own branch and company', async () => {
    const x = await pendingPo('X', [{ item: 'box', qty: '5' }]);
    const ho = await pendingPo('HO', [{ item: 'box', qty: '5' }]);
    const wh = await as('wh@a.example', 'X');
    expect((await wh.post(GR, { purchaseOrderId: ho.id })).statusCode).toBe(404);
    await h.db.purchaseOrder.update({
      where: { id: x.id },
      data: { status: 'DRAFT', issuedAt: null, issuedByMemberId: null, pendingReceiveAt: null },
    });
    expect((await wh.post(GR, { purchaseOrderId: x.id })).statusCode).toBe(404);
    const y = await pendingPo('X', [{ item: 'box', qty: '5' }]);
    await h.db.purchaseOrder.update({
      where: { id: y.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledByMemberId: ids['buyer@a.example']!,
      },
    });
    expect(code(await wh.post(GR, { purchaseOrderId: y.id }))).toBe('PO_NOT_RECEIVABLE');
    const beta = await as('owner@b.example');
    expect((await beta.post(GR, { purchaseOrderId: x.id })).statusCode).toBe(404);
    // Server-owned fields are refused, never ignored.
    for (const extra of [
      { status: 'POSTED' },
      { number: 'GR-209901-000001' },
      { branchId: br.HO },
      { companyId: B.companyId },
      { supplierId },
      { postedByMemberId: ids['wh@a.example'] },
    ]) {
      expect((await wh.post(GR, { purchaseOrderId: y.id, ...extra })).statusCode).toBe(400);
    }
  });

  it('partial and repeated receiving until the order is RECEIVED; Purchasing sees the progress', async () => {
    const po = await pendingPo('X', [
      { item: 'box', qty: '100' },
      { item: 'oil', qty: '2.5' },
    ]);
    const wh = await as('wh@a.example', 'X');
    let r = await draft(wh, po.id);
    expect((await save(wh, r, 1, accept('40'))).statusCode).toBe(200);
    r = await post(wh, r);
    expect(r.status).toBe('POSTED');
    expect(r.lines).toHaveLength(1); // the untouched oil line was dropped
    expect(r.actions).toEqual([]); // staff: no edit, no post, no reversal
    expect(await onHand(it_.box!)).toBe('40.000000');
    let rcv = j(await wh.get(`${RCV}/${po.id}`)).order;
    expect(rcv.receiving.state).toBe('PARTIALLY_RECEIVED');
    expect(rcv.lines.map((l: J) => [l.receivedQuantity, l.pendingQuantity])).toEqual([
      ['40', '60'],
      ['0', '2.5'],
    ]);
    expect(rcv.receipts.map((x: J) => x.number)).toEqual([r.number]);
    // A second receipt for the rest of both lines.
    let r2 = await draft(wh, po.id);
    expect(line(r2)).toMatchObject({ receivedElsewhere: '40', remaining: '60' });
    await save(
      wh,
      r2,
      1,
      accept('60', [
        { locationId: loc.MAIN, quantity: '35' },
        { locationId: loc.QC, quantity: '25' },
      ]),
    );
    await save(wh, r2, 2, accept('2.5'));
    r2 = await post(wh, r2);
    expect(await onHand(it_.box!)).toBe('75.000000');
    expect(await onHand(it_.box!, loc.QC)).toBe('25.000000');
    const order = await h.db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(order.status).toBe('RECEIVED');
    expect(order.receivedAt).toBeTruthy();
    // Nothing left: no new receipt; the queue no longer lists it.
    expect(code(await wh.post(GR, { purchaseOrderId: po.id }))).toBe('PO_NOT_RECEIVABLE');
    expect(j(await wh.get(RCV)).items.map((x: J) => x.id)).not.toContain(po.id);
    rcv = j(await wh.get(`${RCV}/${po.id}`)).order;
    expect(rcv.receiving.state).toBe('FULLY_RECEIVED');
    // Purchasing: progress per line, receipt links, timeline; cannot post or cancel receipts.
    const buyer = await as('buyer@a.example', 'X');
    const pv = j(await buyer.get(`${PO}/${po.id}`));
    expect(pv.order.status).toBe('RECEIVED');
    expect(pv.order.lines[0].receiving).toEqual({
      receivable: true,
      received: '100',
      rejected: '0',
      remaining: '0',
    });
    expect(pv.order.receiving.receipts.map((x: J) => x.number)).toEqual([r.number, r2.number]);
    expect(pv.timeline.map((t: J) => t.type)).toEqual(
      expect.arrayContaining(['PURCHASE_ORDER_PARTIALLY_RECEIVED', 'PURCHASE_ORDER_RECEIVED']),
    );
    expect((await buyer.get(`${GR}/${r.id}`)).statusCode).toBe(404);
    expect((await buyer.post(`${GR}/${r.id}/cancel`, { reason: 'x' })).statusCode).toBe(404);
    // The request still counts the order as ordered (RECEIVED is an ordered status).
    const pr = j(
      await buyer.get(`/api/v1/purchase-requests/${po.lines[0]!.purchaseRequestId}`),
    ).request;
    expect(pr.lines[0].ordering).toMatchObject({
      ordered: '100',
      remaining: '0',
      state: 'FULLY_ORDERED',
    });
    // An order with receipts cannot be cancelled.
    const po2 = await pendingPo('X', [{ item: 'box', qty: '3' }]);
    const r3 = await draft(wh, po2.id);
    await save(wh, r3, 1, accept('1'));
    await post(wh, r3);
    expect(code(await buyer.post(`${PO}/${po2.id}/cancel`, { reason: 'x' }))).toBe(
      'PO_HAS_RECEIPTS',
    );
    await assertLedger();
  });

  it('accepted + rejected never exceeds what remains; rejected needs a reason and is never stock', async () => {
    const po = await pendingPo('X', [{ item: 'box', qty: '100' }]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id);
    const over = await save(wh, r, 1, {
      ...accept('90'),
      rejectedQuantity: '11',
      rejectReason: 'DAMAGED',
    });
    expect(code(over)).toBe('PO_LINE_OVER_RECEIVED');
    expect(j(over).error.details).toMatchObject({ remaining: '100', lineNo: 1 });
    expect(code(await save(wh, r, 1, { ...accept('95'), rejectedQuantity: '5' }))).toBe(
      'REJECT_REASON_REQUIRED',
    );
    // 95 accepted, 5 damaged and owed again (replacement required, the default).
    expect(
      (
        await save(wh, r, 1, {
          ...accept('95'),
          rejectedQuantity: '5',
          rejectReason: 'DAMAGED',
          rejectNote: 'Crushed cartons',
        })
      ).statusCode,
    ).toBe(200);
    await post(wh, r);
    expect(await onHand(it_.box!)).toBe('95.000000');
    let rcv = j(await wh.get(`${RCV}/${po.id}`)).order.lines[0];
    expect(rcv).toMatchObject({
      receivedQuantity: '95',
      rejectedQuantity: '5',
      pendingQuantity: '5',
    });
    // The replacement is refused damaged again; no replacement this time → the line closes.
    const r2 = await draft(wh, po.id);
    await save(wh, r2, 1, {
      acceptedQuantity: '0',
      rejectedQuantity: '5',
      rejectReason: 'QUALITY',
      replacementRequired: false,
      allocations: [],
    });
    await post(wh, r2);
    rcv = j(await wh.get(`${RCV}/${po.id}`)).order;
    expect(rcv.lines[0]).toMatchObject({
      receivedQuantity: '95',
      rejectedQuantity: '10',
      pendingQuantity: '0',
    });
    expect(rcv.status).toBe('RECEIVED');
    expect(await onHand(it_.box!)).toBe('95.000000');
    await assertLedger();
  });

  it('quantity precision, locations of the branch only, allocations add up', async () => {
    const po = await pendingPo('X', [
      { item: 'box', qty: '10' },
      { item: 'oil', qty: '5' },
    ]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id);
    expect(code(await save(wh, r, 1, accept('1.5')))).toBe('QUANTITY_PRECISION');
    expect(code(await save(wh, r, 2, accept('1.2345')))).toBe('QUANTITY_PRECISION');
    expect((await save(wh, r, 2, accept('1.234'))).statusCode).toBe(200);
    expect(code(await save(wh, r, 1, accept('3', [{ locationId: loc.HO, quantity: '3' }])))).toBe(
      'REFERENCE_NOT_FOUND',
    );
    expect(code(await save(wh, r, 1, accept('3', [{ locationId: loc.OLD, quantity: '3' }])))).toBe(
      'REFERENCE_INACTIVE',
    );
    const mismatch = await save(wh, r, 1, accept('3', [{ locationId: loc.MAIN, quantity: '2' }]));
    expect(code(mismatch)).toBe('ALLOCATION_MISMATCH');
    expect(code(await save(wh, r, 1, { acceptedQuantity: '3', allocations: [] }))).toBe(
      'ALLOCATION_MISMATCH',
    );
    // The client never names an item, a lot id, a movement or a balance.
    for (const extra of [
      { itemId: it_.oil },
      { unitId: 'x' },
      { quantityOnHand: '9' },
      { status: 'POSTED' },
    ]) {
      expect((await save(wh, r, 1, { ...accept('3'), ...extra })).statusCode).toBe(400);
    }
    expect(
      (await save(wh, r, 1, accept('3', [{ locationId: loc.MAIN, quantity: '3', lotId: 'x' }])))
        .statusCode,
    ).toBe(400);
    expect(
      (await save(wh, r, 1, accept('3.0', [{ locationId: loc.MAIN, quantity: 3 }]))).statusCode,
    ).toBe(400);
  });

  it('lot and expiry: NONE / OPTIONAL / REQUIRED, expired goods only as rejected, one expiry per lot', async () => {
    const po = await pendingPo('X', [
      { item: 'box', qty: '10' },
      { item: 'oil', qty: '10' },
      { item: 'pin', qty: '10' },
      { item: 'cream', qty: '100' },
    ]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id);
    const lot = (
      quantity: string,
      lotNumber?: string,
      expiryDate?: string,
      locationId = loc.MAIN,
    ) => ({
      locationId,
      quantity,
      ...(lotNumber ? { lotNumber } : {}),
      ...(expiryDate ? { expiryDate } : {}),
    });
    // box: no lot tracking.
    expect(code(await save(wh, r, 1, accept('1', [lot('1', 'L1')])))).toBe('LOT_NOT_TRACKED');
    // pin: lot optional, expiry not tracked.
    expect(code(await save(wh, r, 3, accept('1', [lot('1', 'P1', '2099-01-01')])))).toBe(
      'EXPIRY_NOT_TRACKED',
    );
    expect((await save(wh, r, 3, accept('1', [lot('1', 'P1')]))).statusCode).toBe(200);
    // oil: lot and expiry optional — both may be omitted.
    expect((await save(wh, r, 2, accept('4'))).statusCode).toBe(200);
    // cream: lot and expiry required.
    expect(code(await save(wh, r, 4, accept('10')))).toBe('LOT_REQUIRED');
    expect(code(await save(wh, r, 4, accept('10', [lot('10', 'C1')])))).toBe('EXPIRY_REQUIRED');
    expect(code(await save(wh, r, 4, accept('10', [lot('10', 'C1', '2001-01-01')])))).toBe(
      'LOT_EXPIRED',
    );
    expect(code(await save(wh, r, 4, accept('10', [lot('10', 'C1', '2099-13-01')])))).toBe(
      'VALIDATION_FAILED',
    );
    // Expired goods may be recorded as rejected.
    const yesterday = new Date(`${TODAY}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    expect(
      (
        await save(wh, r, 4, {
          ...accept('60', [lot('40', 'C-A', '2099-06-01'), lot('20', 'C-A', '2099-06-01', loc.QC)]),
          rejectedQuantity: '20',
          rejectReason: 'EXPIRED',
        })
      ).statusCode,
    ).toBe(200);
    // One lot has one expiry on a line.
    expect(
      code(
        await save(
          wh,
          r,
          4,
          accept('2', [lot('1', 'C-Z', '2099-06-01'), lot('1', 'C-Z', '2099-07-01')]),
        ),
      ),
    ).toBe('LOT_EXPIRY_MISMATCH');
    // Split allocations: one lot in two locations and a second lot.
    expect(
      (
        await save(wh, r, 4, {
          ...accept('80', [
            lot('40', 'C-A', '2099-06-01'),
            lot('20', 'C-A', '2099-06-01', loc.QC),
            lot('20', 'C-B', '2099-08-01'),
          ]),
          rejectedQuantity: '20',
          rejectReason: 'EXPIRED',
        })
      ).statusCode,
    ).toBe(200);
    const posted = await post(wh, r);
    expect(line(posted, 4).allocations.every((a: J) => a.lotId)).toBe(true);
    const lots = await h.db.inventoryLot.findMany({
      where: { itemId: it_.cream! },
      orderBy: { lotNumber: 'asc' },
    });
    expect(lots.map((l) => [l.lotNumber, l.expiryDate?.toISOString().slice(0, 10)])).toEqual([
      ['C-A', '2099-06-01'],
      ['C-B', '2099-08-01'],
    ]);
    const ca = lots[0]!.id;
    expect(await onHand(it_.cream!, loc.MAIN, ca)).toBe('40.000000');
    expect(await onHand(it_.cream!, loc.QC, ca)).toBe('20.000000');
    expect(await onHand(it_.oil!)).toBe('4.000000');
    const movements = await h.db.stockMovement.count({ where: { goodsReceiptId: posted.id } });
    expect(movements).toBe(5); // pin 1, oil 1, cream 3 (box line had nothing and was dropped)
    // A later receipt cannot give the known lot another expiry.
    const po2 = await pendingPo('X', [{ item: 'cream', qty: '5' }]);
    const r2 = await draft(wh, po2.id);
    expect(code(await save(wh, r2, 1, accept('5', [lot('5', 'C-A', '2099-12-31')])))).toBe(
      'LOT_EXPIRY_MISMATCH',
    );
    expect((await save(wh, r2, 1, accept('5', [lot('5', 'C-A', '2099-06-01')]))).statusCode).toBe(
      200,
    );
    await post(wh, r2);
    expect(await onHand(it_.cream!, loc.MAIN, ca)).toBe('45.000000');
    expect(await h.db.inventoryLot.count({ where: { itemId: it_.cream! } })).toBe(2);
    await assertLedger();
  });

  it('posting twice at once moves stock once; a retry after posting is refused', async () => {
    const po = await pendingPo('X', [{ item: 'box', qty: '10' }]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id);
    await save(
      wh,
      r,
      1,
      accept('6', [
        { locationId: loc.MAIN, quantity: '4' },
        { locationId: loc.QC, quantity: '2' },
      ]),
    );
    const res = await Promise.all([1, 2, 3].map(() => wh.post(`${GR}/${r.id}/post`)));
    expect(res.filter((x) => x.statusCode === 200)).toHaveLength(1);
    for (const x of res.filter((y) => y.statusCode !== 200)) {
      expect(['GR_INVALID_TRANSITION', 'GR_STATE_CHANGED']).toContain(code(x));
    }
    expect(code(await wh.post(`${GR}/${r.id}/post`))).toBe('GR_INVALID_TRANSITION');
    expect(await h.db.stockMovement.count({ where: { goodsReceiptId: r.id } })).toBe(2);
    expect(await onHand(it_.box!)).toBe('4.000000');
    // A posted receipt is locked.
    expect(code(await save(wh, r, 1, accept('1')))).toBe('GR_NOT_EDITABLE');
    expect(code(await wh.patch(`${GR}/${r.id}`, { note: 'x' }))).toBe('GR_NOT_EDITABLE');
    // The ledger is append-only, even for the database owner.
    await expect(
      h.db
        .$executeRaw`UPDATE "StockMovement" SET "quantityDelta" = 1 WHERE "goodsReceiptId" = ${r.id}`,
    ).rejects.toThrow();
    await expect(
      h.db.$executeRaw`DELETE FROM "StockMovement" WHERE "goodsReceiptId" = ${r.id}`,
    ).rejects.toThrow();
    await assertLedger();
  });

  it('remaining 10, two receipts of 7 posted at once: exactly one posts (repeated)', async () => {
    const wh = await as('wh@a.example', 'X');
    const wh2 = await as('wh2@a.example', 'X');
    for (let round = 0; round < 6; round++) {
      const po = await pendingPo('X', [{ item: 'box', qty: '10' }]);
      const a = await draft(wh, po.id);
      const b = await draft(wh2, po.id);
      await save(wh, a, 1, accept('7'));
      await save(wh2, b, 1, accept('7'));
      const res = await Promise.all([
        wh.post(`${GR}/${a.id}/post`),
        wh2.post(`${GR}/${b.id}/post`),
      ]);
      expect(
        res.filter((x) => x.statusCode === 200),
        `round ${round}`,
      ).toHaveLength(1);
      expect(code(res.find((x) => x.statusCode !== 200)!)).toBe('PO_LINE_OVER_RECEIVED');
      const accepted = await h.db.goodsReceiptLine.aggregate({
        where: { purchaseOrderLineId: po.lines[0]!.id, receipt: { status: 'POSTED' } },
        _sum: { acceptedQuantity: true },
      });
      expect(accepted._sum.acceptedQuantity!.toString()).toBe('7');
    }
    // Concurrent receipts of DIFFERENT orders into the same item, lot and location: no lost update.
    const orders = await Promise.all(
      [1, 2, 3, 4].map(() => pendingPo('X', [{ item: 'cream', qty: '10' }])),
    );
    const drafts: J[] = [];
    for (const o of orders) {
      const d = await draft(wh, o.id);
      await save(
        wh,
        d,
        1,
        accept('10', [
          { locationId: loc.MAIN, quantity: '10', lotNumber: 'SAME-LOT', expiryDate: '2099-05-05' },
        ]),
      );
      drafts.push(d);
    }
    const posts = await Promise.all(
      drafts.map((d, i) => (i % 2 ? wh2 : wh).post(`${GR}/${d.id}/post`)),
    );
    expect(posts.every((x) => x.statusCode === 200)).toBe(true);
    const lots = await h.db.inventoryLot.findMany({ where: { lotNumber: 'SAME-LOT' } });
    expect(lots).toHaveLength(1);
    expect(await onHand(it_.cream!, loc.MAIN, lots[0]!.id)).toBe('40.000000');
    await assertLedger();
  });

  it('cancelling a posted receipt reverses its stock, keeps history and reopens the order', async () => {
    const po = await pendingPo('X', [{ item: 'box', qty: '10' }]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id);
    await save(wh, r, 1, accept('10'));
    await post(wh, r);
    expect((await h.db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe(
      'RECEIVED',
    );
    // Staff cannot reverse; the manager must give a reason.
    expect(code(await wh.post(`${GR}/${r.id}/cancel`, { reason: 'x' }))).toBe('PERMISSION_DENIED');
    const whm = await as('whm@a.example', 'X');
    expect(code(await whm.post(`${GR}/${r.id}/cancel`, {}))).toBe('REASON_REQUIRED');
    const res = await whm.post(`${GR}/${r.id}/cancel`, { reason: 'Wrong supplier delivery note' });
    expect(res.statusCode, res.body).toBe(200);
    expect(j(res).receipt).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Wrong supplier delivery note',
    });
    expect(j(res).timeline.map((t: J) => t.type)).toEqual([
      'GOODS_RECEIPT_CREATED',
      'GOODS_RECEIPT_POSTED',
      'GOODS_RECEIPT_CANCELLED',
    ]);
    const moves = await h.db.stockMovement.findMany({
      where: { goodsReceiptId: r.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(moves.map((m) => [m.type, m.quantityDelta.toString()])).toEqual([
      ['PURCHASE_RECEIPT', '10'],
      ['PURCHASE_RECEIPT_REVERSAL', '-10'],
    ]);
    expect(await onHand(it_.box!)).toBe('0.000000');
    const order = await h.db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(order.status).toBe('PENDING_RECEIVE');
    expect(order.receivedAt).toBeNull();
    expect(j(await wh.get(`${RCV}/${po.id}`)).order.lines[0].pendingQuantity).toBe('10');
    expect(code(await whm.post(`${GR}/${r.id}/cancel`, { reason: 'again' }))).toBe(
      'GR_INVALID_TRANSITION',
    );
    // A draft cancels without any stock effect.
    const d = await draft(wh, po.id);
    expect((await wh.post(`${GR}/${d.id}/cancel`, {})).statusCode).toBe(200);
    expect(await h.db.stockMovement.count({ where: { goodsReceiptId: d.id } })).toBe(0);
    await assertLedger();
  });

  it('refuses a reversal that would make stock negative (stock already consumed)', async () => {
    const po = await pendingPo('X', [{ item: 'box', qty: '10' }]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id);
    await save(wh, r, 1, accept('10'));
    await post(wh, r);
    // 7 of the 10 left MAIN through a real ledger movement (an EP32 transfer).
    const whm = await as('whm@a.example', 'X');
    const t = j(
      await whm.post('/api/v1/warehouse/transfers', {
        sourceLocationId: loc.MAIN,
        destinationLocationId: loc.QC,
      }),
    ).transfer;
    await whm.put(`/api/v1/warehouse/transfers/${t.id}/lines`, {
      lines: [{ itemId: it_.box, quantity: '7' }],
    });
    expect((await whm.post(`/api/v1/warehouse/transfers/${t.id}/post`)).statusCode).toBe(200);
    expect(code(await whm.post(`${GR}/${r.id}/cancel`, { reason: 'Supplier recall' }))).toBe(
      'STOCK_INSUFFICIENT',
    );
    expect((await h.db.goodsReceipt.findUniqueOrThrow({ where: { id: r.id } })).status).toBe(
      'POSTED',
    );
    expect(await onHand(it_.box!, loc.MAIN)).toBe('3.000000');
    expect(await h.db.stockMovement.count({ where: { goodsReceiptId: r.id } })).toBe(1);
    await assertLedger();
  });

  it('FEFO: earliest expiry first, expired excluded, deterministic ties', async () => {
    const po = await pendingPo('X', [{ item: 'cream', qty: '100' }]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id);
    const a = (q: string, lotNumber: string, expiryDate: string, locationId = loc.MAIN) => ({
      locationId,
      quantity: q,
      lotNumber,
      expiryDate,
    });
    await save(
      wh,
      r,
      1,
      accept('60', [
        a('10', 'L-DEC', '2099-12-01'),
        a('10', 'L-NOV', '2099-11-15'),
        a('10', 'L-JAN', '2100-01-01'),
        a('10', 'L-NOV', '2099-11-15', loc.QC),
        a('10', 'T-2', '2099-11-30'),
        a('10', 'T-1', '2099-11-30'),
      ]),
    );
    await post(wh, r);
    // One lot expired since (written directly: receiving refuses expired goods).
    const old = await h.db.inventoryLot.create({
      data: {
        companyId: A.companyId,
        itemId: it_.cream!,
        lotNumber: 'L-OLD',
        expiryDate: new Date('2001-01-01T00:00:00Z'),
      },
    });
    await h.db.stockBalance.create({
      data: {
        companyId: A.companyId,
        branchId: br.X,
        locationId: loc.MAIN!,
        itemId: it_.cream!,
        lotId: old.id,
        lotKey: old.id,
        quantityOnHand: '0', // stays consistent with the (empty) ledger; FEFO ignores empty stock too
        firstReceivedAt: new Date(),
      },
    });
    const res = j(await wh.get(`${W}/stock/fefo?itemId=${it_.cream}`));
    expect(res.candidates.map((c: J) => `${c.lot.lotNumber}@${c.location.code}`)).toEqual([
      'L-NOV@MAIN',
      'L-NOV@QC',
      'T-1@MAIN',
      'T-2@MAIN',
      'L-DEC@MAIN',
      'L-JAN@MAIN',
    ]);
    expect(res.candidates[0]).toMatchObject({ rank: 1, quantityOnHand: '10', expiryState: 'OK' });
    expect(keysOf(res).filter((k) => MONEY.test(k))).toEqual([]);
    // Only within the member's branch.
    const hoBranch = await wh.get(`${W}/stock/fefo?itemId=${it_.cream}&branchId=${br.HO}`);
    expect(hoBranch.statusCode).toBe(403);
  });

  it('stock, lots and movements: filters, paging, expiry states — and no money anywhere', async () => {
    const po = await pendingPo('X', [
      { item: 'cream', qty: '30' },
      { item: 'box', qty: '30' },
    ]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id, { note: 'Truck 7' });
    const soon = new Date(`${TODAY}T00:00:00Z`);
    soon.setUTCDate(soon.getUTCDate() + 10);
    await save(
      wh,
      r,
      1,
      accept('20', [
        {
          locationId: loc.MAIN,
          quantity: '10',
          lotNumber: 'SOON',
          expiryDate: soon.toISOString().slice(0, 10),
        },
        { locationId: loc.MAIN, quantity: '10', lotNumber: 'LATER', expiryDate: '2099-01-01' },
      ]),
    );
    await save(wh, r, 2, accept('30'));
    await post(wh, r);
    const stock = j(await wh.get(`${W}/stock`));
    expect(stock.total).toBe(3);
    const soonRow = stock.items.find((x: J) => x.lot?.lotNumber === 'SOON');
    expect(soonRow).toMatchObject({
      expiryState: 'EXPIRING_SOON',
      daysToExpiry: 10,
      quantityOnHand: '10',
    });
    expect(stock.items.find((x: J) => !x.lot)).toMatchObject({
      expiryState: 'NO_EXPIRY',
      quantityOnHand: '30',
    });
    const lots = j(await wh.get(`${W}/stock?view=lots`));
    expect(lots.items.map((x: J) => x.lot.lotNumber)).toEqual(['SOON', 'LATER']);
    expect(j(await wh.get(`${W}/stock?expiry=EXPIRING_SOON`)).total).toBe(1);
    expect(j(await wh.get(`${W}/stock?expiry=NO_EXPIRY`)).total).toBe(1);
    expect(j(await wh.get(`${W}/stock?q=LATER`)).total).toBe(1);
    const page = j(await wh.get(`${W}/stock?pageSize=2`));
    expect(page).toMatchObject({ total: 3, hasMore: true });
    const mv = j(await wh.get(`${W}/movements`));
    expect(mv.total).toBe(3);
    expect(mv.items[0]).toMatchObject({
      type: 'PURCHASE_RECEIPT',
      source: {
        type: 'GOODS_RECEIPT',
        receipt: { number: r.number },
        order: { number: po.number },
      },
      actor: { name: 'wh' },
    });
    expect(j(await wh.get(`${W}/movements?q=${r.number}`)).total).toBe(3);
    const list = j(await wh.get(`${GR}?status=POSTED&q=${po.number}`));
    expect(list.items.map((x: J) => x.number)).toEqual([r.number]);
    expect(list.counts).toMatchObject({ POSTED: 1 });
    // Privacy: every Warehouse response, key by key and value by value.
    const bodies = [
      await wh.get(`${W}/context`),
      await wh.get(GR),
      await wh.get(`${GR}/${r.id}`),
      await wh.get(`${W}/stock`),
      await wh.get(`${W}/stock?view=lots`),
      await wh.get(`${W}/movements`),
      await wh.get(`${W}/stock/fefo?itemId=${it_.cream}`),
      await wh.get(RCV),
      await wh.get(`${RCV}/${po.id}`),
    ];
    for (const b of bodies) {
      expect(b.statusCode, b.body).toBe(200);
      // `total` at the top of a list is its row count (pagination), not money.
      expect(
        keysOf(j(b)).filter((k) => k !== 'total' && MONEY.test(k)),
        b.body.slice(0, 120),
      ).toEqual([]);
      for (const secret of ['9.99', 'secret-terms', '0105551234567', 'Khun Sales', 'THB']) {
        expect(b.body).not.toContain(secret);
      }
    }
  });

  it('permissions per role: reading is not acting, and other companies see nothing', async () => {
    const po = await pendingPo('X', [{ item: 'box', qty: '10' }]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id);
    await save(wh, r, 1, accept('2'));
    // Executive: reads receipts and stock, changes nothing.
    const exec = await as('exec@a.example', 'X');
    expect((await exec.get(`${GR}/${r.id}`)).statusCode).toBe(200);
    expect((await exec.get(`${W}/stock`)).statusCode).toBe(200);
    expect(code(await exec.post(GR, { purchaseOrderId: po.id }))).toBe('PERMISSION_DENIED');
    expect(code(await exec.post(`${GR}/${r.id}/post`))).toBe('PERMISSION_DENIED');
    expect(code(await exec.put(`${GR}/${r.id}/lines/${line(r).id}`, accept('1')))).toBe(
      'PERMISSION_DENIED',
    );
    // Viewer: reads, never acts.
    const viewer = await as('viewer@a.example', 'X');
    expect((await viewer.get(GR)).statusCode).toBe(200);
    expect(code(await viewer.post(`${GR}/${r.id}/post`))).toBe('PERMISSION_DENIED');
    // System Admin (not assigned to Warehouse): no inventory authority at all.
    const admin = await as('admin@a.example', 'X');
    for (const u of [GR, `${W}/stock`, `${W}/movements`, `${W}/context`]) {
      expect((await admin.get(u)).statusCode, u).toBe(403);
    }
    expect((await admin.post(`${GR}/${r.id}/post`)).statusCode).toBe(404);
    // Purchasing and Accounting: no receipts, no stock.
    for (const who of ['buyer@a.example', 'acct@a.example']) {
      const b = await as(who, 'X');
      for (const u of [GR, `${W}/stock`, `${W}/movements`]) {
        expect((await b.get(u)).statusCode, `${who} ${u}`).toBe(403);
      }
      // A receipt they may not read does not exist for them.
      expect((await b.get(`${GR}/${r.id}`)).statusCode).toBe(404);
    }
    // Branch: a Head Office warehouse member does not see branch X's receipt.
    const whHo = await as('wh.ho@a.example', 'HO');
    expect((await whHo.get(`${GR}/${r.id}`)).statusCode).toBe(404);
    expect((await whHo.post(`${GR}/${r.id}/post`)).statusCode).toBe(404);
    expect(j(await whHo.get(GR)).total).toBe(0);
    // Another company: nothing exists.
    const beta = await as('owner@b.example');
    expect((await beta.get(`${GR}/${r.id}`)).statusCode).toBe(404);
    expect((await beta.post(`${GR}/${r.id}/post`)).statusCode).toBe(404);
    expect(j(await beta.get(`${W}/stock`)).total).toBe(0);
    expect(j(await beta.get(`${W}/movements`)).total).toBe(0);
    // The owner may post (still subject to every rule).
    const owner = await as('owner@a.example', 'X');
    expect((await owner.post(`${GR}/${r.id}/post`)).statusCode).toBe(200);
  });

  it('audit, Platform redaction and the item structure lock', async () => {
    const po = await pendingPo('X', [{ item: 'cream', qty: '5' }]);
    const wh = await as('wh@a.example', 'X');
    const r = await draft(wh, po.id);
    await save(
      wh,
      r,
      1,
      accept('5', [
        { locationId: loc.MAIN, quantity: '5', lotNumber: 'AUD-1', expiryDate: '2099-03-03' },
      ]),
    );
    await post(wh, r);
    const audit = await h.db.auditLog.findMany({
      where: { companyId: A.companyId },
      orderBy: { occurredAt: 'asc' },
    });
    const actions = audit.map((a) => a.action);
    for (const a of [
      'GOODS_RECEIPT_CREATED',
      'GOODS_RECEIPT_LINE_UPDATED',
      'GOODS_RECEIPT_POSTED',
      'INVENTORY_LOT_CREATED',
      'PURCHASE_ORDER_RECEIVED',
    ]) {
      expect(actions).toContain(a);
    }
    for (const a of audit.filter(
      (x) => x.entityType === 'GoodsReceipt' || x.entityType === 'InventoryLot',
    )) {
      expect(JSON.stringify(a.changes)).not.toMatch(
        /(?<![\w.])9\.990*(?![\w.])|2099-03-03|Supplier One/,
      );
    }
    // The item's tracking can no longer change once it has lots / stock.
    const owner = await as('owner@a.example', 'X');
    const lock = await owner.put(`/api/v1/master-data/items/${it_.cream}/structure`, {
      lotTracking: 'OPTIONAL',
      expiryTracking: 'OPTIONAL',
    });
    expect(lock.statusCode, lock.body).toBe(409);
    expect(code(lock)).toBe('ITEM_STRUCTURE_LOCKED');
  });
});
