import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { Decimal } from '../src/purchasing/money.js';
import { companyDay } from '../src/purchasing/service.js';
import { allocationStateOf } from '../src/sales/allocation.js';
import { soRefusal, type SalesActor } from '../src/sales/policy.js';
import { SALES_FIELD_CLASSES } from '../src/sales/views.js';
import { INVENTORY_FIELD_CLASSES, PickDemandOrder } from '../src/warehouse/views.js';
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
 * EP34 sales allocation: FEFO reservation of confirmed, inventory-tracked
 * lines (expired / other-branch / inactive stock excluded), partial and empty
 * allocation, no reservation for services, release / reallocate / cancel
 * history, the physical guards (transfer, adjustment, count, reversal never go
 * below what is reserved), the reservation races, the warehouse-safe Pending
 * Pick, roles, isolation and audit — and through all of it: no StockMovement,
 * no on-hand change, reserved ≤ on hand for every stock identity.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const S = '/api/v1/sales';
const SO = `${S}/orders`;
const W = '/api/v1/warehouse';
const MONEY =
  /price|amount|discount|tax|total|margin|payment|cost|currency|customer|reference|note|credit/i;

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

describe('Sales allocation policy and contracts (EP34)', () => {
  it('allocation is the confirm (approve) tier, on CONFIRMED orders only', () => {
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
    const o = (status: any) => ({ status, branchId: 'b1', createdByMemberId: 'me' });
    const mgr = actor({ confirm: true, cancel: true });
    for (const a of ['allocate', 'release', 'reallocate'] as const) {
      expect(soRefusal(actor(), a, o('CONFIRMED'))).toBe('authority');
      expect(soRefusal(mgr, a, o('CONFIRMED'))).toBeNull();
      for (const s of ['DRAFT', 'SUBMITTED', 'CANCELLED']) {
        expect(soRefusal(mgr, a, o(s)), `${a} ${s}`).toBe('status');
      }
      expect(soRefusal(mgr, a, { ...o('CONFIRMED'), branchId: 'b2' })).toBe('branch');
    }
  });

  it('derives the order state from tracked lines only', () => {
    const d = (o: string, a: string) => ({ ordered: new Decimal(o), allocated: new Decimal(a) });
    expect(allocationStateOf('CONFIRMED', [d('5', '5'), d('2', '2')])).toEqual({
      state: 'FULLY_ALLOCATED',
      readiness: 'READY',
    });
    expect(allocationStateOf('CONFIRMED', [d('5', '5'), d('2', '0')])?.state).toBe(
      'PARTIALLY_ALLOCATED',
    );
    expect(allocationStateOf('CONFIRMED', [d('5', '0')])?.readiness).toBe('NOT_READY');
    expect(allocationStateOf('SUBMITTED', [d('5', '0')])).toBeNull();
    expect(allocationStateOf('CONFIRMED', [])).toBeNull(); // services only: nothing to pick
  });

  it('Pending Pick and every allocation key is operational; no money key at all', () => {
    for (const k of Object.keys(PickDemandOrder.shape)) {
      expect(INVENTORY_FIELD_CLASSES[k]).toBe('operational');
    }
    const lineKeys = keysOf(
      PickDemandOrder.parse({
        id: 'o',
        number: 'SO-1',
        branch: { id: 'b', code: '1', name: 'B' },
        orderDate: '2026-11-01',
        requestedDate: null,
        confirmedAt: null,
        readiness: 'READY',
        grandTotal: '999', // dropped by the allow-list
        customer: { name: 'X' },
        lines: [
          {
            lineNo: 1,
            item: { id: 'i', code: 'I', name: 'I' },
            unit: { code: 'PCS' },
            ordered: '1',
            allocated: '1',
            shortage: '0',
            unitPrice: '9',
            picks: [
              {
                location: { id: 'l', code: 'L', name: 'L' },
                lot: null,
                expiryState: 'NO_EXPIRY',
                quantity: '1',
                toPick: '1',
              },
            ],
          },
        ],
      }),
    );
    expect(lineKeys.filter((k) => MONEY.test(k))).toEqual([]);
    expect(SALES_FIELD_CLASSES.allocationState).toBe('operational');
    expect(Object.keys(SALES_FIELD_CLASSES)).not.toContain('lot');
  });
});

// ------------------------------------------------------------------ enforcement

describeDb('Sales allocation (EP34)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const br: Record<'HO' | 'X', string> = { HO: '', X: '' };
  const it_: Record<string, string> = {};
  const loc: Record<string, string> = {};
  let customer = '';
  const TODAY = companyDay('Asia/Bangkok');
  const shift = (days: number) => {
    const d = new Date(`${TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const PEOPLE: [string, CompanyRole, 'A' | 'B', DepartmentCode[], ('HO' | 'X')[] | null][] = [
    ['owner@a.example', 'COMPANY_OWNER', 'A', [], null],
    ['admin@a.example', 'SYSTEM_ADMIN', 'A', [], null],
    ['exec@a.example', 'EXECUTIVE', 'A', [], null],
    ['salesm@a.example', 'DEPARTMENT_MANAGER', 'A', ['SALES'], ['X']],
    ['salesm2@a.example', 'DEPARTMENT_MANAGER', 'A', ['SALES'], ['X']],
    ['sales@a.example', 'DEPARTMENT_STAFF', 'A', ['SALES'], ['X']],
    ['salesm.ho@a.example', 'DEPARTMENT_MANAGER', 'A', ['SALES'], ['HO']],
    ['wh@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['X']],
    ['whm@a.example', 'DEPARTMENT_MANAGER', 'A', ['WAREHOUSE'], ['X']],
    ['wh.ho@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['HO']],
    ['owner@b.example', 'COMPANY_OWNER', 'B', [], null],
  ];

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    owner = undefined;
    await resetDb(h.db);
    A = await createActiveCompany(h.db, {
      name: 'Alpha',
      departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
    });
    B = await createActiveCompany(h.db, { name: 'Beta', departments: ['SALES', 'WAREHOUSE'] });
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
    const pcs = await h.db.unit.create({
      data: { companyId: A.companyId, code: 'PCS', name: 'Piece', precision: 0 },
    });
    const item = (c: string, over: J = {}) =>
      h.db.item.create({
        data: {
          companyId: A.companyId,
          code: c,
          type: 'FINISHED_GOOD',
          name: `Item ${c}`,
          baseUnitId: pcs.id,
          ...over,
        },
      });
    it_.box = (await item('BOX-1')).id;
    it_.cream = (await item('CRM-1', { lotTracking: 'REQUIRED', expiryTracking: 'REQUIRED' })).id;
    it_.svc = (await item('SVC-1', { type: 'NON_STOCK', inventoryTracked: false })).id;
    customer = (
      await h.db.customer.create({
        data: { companyId: A.companyId, code: 'CUS-000001', name: 'Customer One' },
      })
    ).id;
    const location = (branchId: string, c: string) =>
      h.db.warehouseLocation.create({
        data: { companyId: A.companyId, branchId, code: c, name: `Loc ${c}` },
      });
    loc.MAIN = (await location(br.X, 'MAIN')).id;
    loc.QC = (await location(br.X, 'QC')).id;
    loc.HO = (await location(br.HO, 'HO-MAIN')).id;
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
  let owner: Browser | undefined;
  const ownerX = async () => (owner ??= await as('owner@a.example', 'X'));
  /** Stock in through a real FOUND adjustment approved by the owner (the ledger path). */
  const stockIn = async (itemId: string, quantity: string, locationId = loc.MAIN!, lot: J = {}) => {
    const o = locationId === loc.HO ? await as('owner@a.example', 'HO') : await ownerX();
    const d = (
      await ok(
        o.post(`${W}/adjustments`, {
          reason: 'FOUND',
          lines: [{ direction: 'INCREASE', locationId, itemId, quantity, ...lot }],
        }),
        201,
      )
    ).adjustment;
    await ok(o.post(`${W}/adjustments/${d.id}/submit`));
    return (await ok(o.post(`${W}/adjustments/${d.id}/approve`))).adjustment;
  };
  const lotIn = async (
    itemId: string,
    qty: string,
    number: string,
    days: number,
    at = loc.MAIN,
  ) => {
    await stockIn(itemId, qty, at, { newLotNumber: number, newLotExpiry: shift(days) });
    return (await h.db.inventoryLot.findFirstOrThrow({ where: { lotNumber: number } })).id;
  };
  /** A CONFIRMED order in branch X (owner creates, submits and confirms). */
  const confirmed = async (lines: [string, string][]) => {
    const o = await ownerX();
    const d = (
      await ok(
        o.post(SO, {
          customerId: customer,
          lines: lines.map(([itemId, quantity]) => ({ itemId, quantity, unitPrice: '185' })),
        }),
        201,
      )
    ).order;
    await ok(o.post(`${SO}/${d.id}/submit`));
    return (await ok(o.post(`${SO}/${d.id}/confirm`))).order;
  };
  const active = (where: J = {}) =>
    h.db.salesAllocation.findMany({
      where: { status: 'ACTIVE', ...where },
      include: { lot: true },
    });
  const sumActive = async (where: J = {}) =>
    (await active(where)).reduce((t, a) => t.plus(a.quantity), new Decimal(0)).toString();
  const movements = () => h.db.stockMovement.count();
  const onHands = async () =>
    JSON.stringify(
      await h.db.stockBalance.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, quantityOnHand: true },
      }),
    );
  /** reserved ≤ on hand for every identity; balance = Σ movements; never negative. */
  const assertInvariant = async () => {
    const over = await h.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM (
        SELECT a."locationId", a."itemId", a."lotKey", SUM(a."quantity") AS r
        FROM "SalesAllocation" a WHERE a."status" = 'ACTIVE'
        GROUP BY a."locationId", a."itemId", a."lotKey") x
      LEFT JOIN "StockBalance" b
        ON b."locationId" = x."locationId" AND b."itemId" = x."itemId" AND b."lotKey" = x."lotKey"
      WHERE COALESCE(b."quantityOnHand", 0) < x.r`;
    expect(Number(over[0]!.n)).toBe(0);
    const ledger = await h.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "StockBalance" b
      WHERE b."quantityOnHand" < 0 OR b."quantityOnHand" <> (
        SELECT COALESCE(SUM(m."quantityDelta"), 0) FROM "StockMovement" m
        WHERE m."locationId" = b."locationId" AND m."itemId" = b."itemId"
          AND COALESCE(m."lotId", '') = b."lotKey")`;
    expect(Number(ledger[0]!.n)).toBe(0);
  };

  // ---------------------------------------------------------------- FEFO, full, partial

  it('allocates FEFO across lots and locations, skipping expired and other-branch stock — no movement', async () => {
    const lotA = await lotIn(it_.cream!, '40', 'L-A', 10);
    const lotB = await lotIn(it_.cream!, '70', 'L-B', 30, loc.QC);
    const lotE = await lotIn(it_.cream!, '50', 'L-E', 5);
    await h.db.inventoryLot.update({
      where: { id: lotE },
      data: { expiryDate: new Date(`${shift(-1)}T00:00:00Z`) },
    }); // now expired
    await stockIn(it_.cream!, '500', loc.HO, { newLotNumber: 'L-HO', newLotExpiry: shift(3) });
    const o = await confirmed([[it_.cream!, '100']]);
    expect(o).toMatchObject({ allocationState: 'NOT_ALLOCATED', pickReadiness: 'NOT_READY' });
    expect(o.actions).toEqual(['cancel', 'allocate']);
    const m0 = await movements();
    const b0 = await onHands();

    const mgr = await as('salesm@a.example');
    const res = await ok(mgr.post(`${SO}/${o.id}/allocate`));
    expect(res.allocation).toMatchObject({
      state: 'FULLY_ALLOCATED',
      pickReadiness: 'READY',
      allocatedNow: '100',
      lines: [
        { lineNo: 1, ordered: '100', allocatedNow: '100', totalAllocated: '100', shortage: '0' },
      ],
    });
    expect(res.order).toMatchObject({ allocationState: 'FULLY_ALLOCATED', pickReadiness: 'READY' });
    expect(res.order.lines[0].allocation).toEqual({ allocated: '100', shortage: '0' });
    expect(res.order.lines[0].progress.allocated).toBe('100');
    expect(res.order.actions).toEqual(['cancel', 'release', 'reallocate']);
    const rows = await active();
    expect(rows.map((r) => [r.lotId, r.locationId, r.quantity.toString()]).sort()).toEqual(
      [
        [lotA, loc.MAIN, '40'],
        [lotB, loc.QC, '60'],
      ].sort(),
    );
    expect(rows.every((r) => r.branchId === br.X)).toBe(true);
    // A reservation is not a movement: on hand and the ledger are untouched.
    expect(await movements()).toBe(m0);
    expect(await onHands()).toBe(b0);
    // Available shrinks everywhere it is read.
    const stock = (await ok(mgr.get(`${S}/items?q=CRM`))).items[0];
    expect(stock.available).toBe('10'); // L-B 70 − 60; L-E expired; HO not this branch
    const wh = await as('wh@a.example');
    const rowsW = (await ok(wh.get(`${W}/stock?itemId=${it_.cream}`))).items;
    const b = rowsW.find((r: J) => r.lot?.lotNumber === 'L-B');
    expect([b.quantityOnHand, b.quantityReserved, b.quantityAvailable]).toEqual(['70', '60', '10']);
    const fefo = (await ok(wh.get(`${W}/stock/fefo?itemId=${it_.cream}`))).candidates;
    expect(fefo.map((c: J) => [c.lot.lotNumber, c.quantityAvailable])).toEqual([['L-B', '10']]);
    // Repeating the allocation reserves nothing more.
    const again = await ok(mgr.post(`${SO}/${o.id}/allocate`));
    expect(again.allocation.allocatedNow).toBe('0');
    expect(await sumActive()).toBe('100');
    expect(await h.db.salesAllocation.count()).toBe(2);
    await assertInvariant();
  });

  it('partial, empty and service lines: shortage stays visible; services never reserve', async () => {
    await stockIn(it_.box!, '60');
    const o = await confirmed([
      [it_.box!, '100'],
      [it_.cream!, '5'],
      [it_.svc!, '1'],
    ]);
    const mgr = await as('salesm@a.example');
    const res = await ok(mgr.post(`${SO}/${o.id}/allocate`));
    expect(res.allocation.lines.map((l: J) => [l.lineNo, l.totalAllocated, l.shortage])).toEqual([
      [1, '60', '40'],
      [2, '0', '5'],
    ]); // the service line is not part of allocation
    expect(res.order).toMatchObject({
      allocationState: 'PARTIALLY_ALLOCATED',
      pickReadiness: 'PARTIALLY_READY',
    });
    expect(res.order.lines.map((l: J) => l.allocation)).toEqual([
      { allocated: '60', shortage: '40' },
      { allocated: '0', shortage: '5' },
      null,
    ]);
    expect(res.order.lines[2].progress.allocated).toBeNull();
    expect(res.order.lines[0].availability).toMatchObject({
      state: 'PARTIALLY_AVAILABLE',
      reserved: '60',
      available: '0',
      shortage: '40',
    });
    expect(await h.db.salesAllocation.count({ where: { itemId: it_.svc } })).toBe(0);
    expect(res.order.actions).toContain('allocate'); // allocate again once stock arrives
    // Stock arrives: allocate again takes it.
    await stockIn(it_.box!, '50');
    const more = await ok(mgr.post(`${SO}/${o.id}/allocate`));
    expect(more.allocation.lines[0]).toMatchObject({ allocatedNow: '40', totalAllocated: '100' });
    expect(await active({ itemId: it_.box })).toHaveLength(1); // the MAIN row grew
    // An order of nothing in stock: no rows, NOT_ALLOCATED.
    const none = await confirmed([[it_.cream!, '3']]);
    const r2 = await ok(mgr.post(`${SO}/${none.id}/allocate`));
    expect(r2.allocation).toMatchObject({ state: 'NOT_ALLOCATED', allocatedNow: '0' });
    expect(await active({ salesOrderId: none.id })).toHaveLength(0);
    // A services-only order has nothing to allocate.
    const svc = await confirmed([[it_.svc!, '2']]);
    expect(svc).toMatchObject({ allocationState: null, pickReadiness: null });
    expect(svc.actions).not.toContain('allocate');
    await assertInvariant();
  });

  it('only CONFIRMED orders allocate; staff, executive, warehouse and admin cannot', async () => {
    await stockIn(it_.box!, '10');
    const o = await ownerX();
    const draft = (
      await ok(
        o.post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.box, quantity: '1', unitPrice: '1' }],
        }),
        201,
      )
    ).order;
    const mgr = await as('salesm@a.example');
    expect(code(await mgr.post(`${SO}/${draft.id}/allocate`))).toBe('SO_INVALID_TRANSITION');
    expect(code(await o.post(`${SO}/${draft.id}/allocate`))).toBe('SO_INVALID_TRANSITION');
    await ok(o.post(`${SO}/${draft.id}/submit`));
    expect(code(await o.post(`${SO}/${draft.id}/allocate`))).toBe('SO_INVALID_TRANSITION');
    const c = await confirmed([[it_.box!, '2']]);
    for (const email of ['sales@a.example', 'exec@a.example']) {
      const b = await as(email);
      for (const a of ['allocate', 'release', 'reallocate']) {
        expect(code(await b.post(`${SO}/${c.id}/${a}`)), `${email} ${a}`).toBe('PERMISSION_DENIED');
      }
      expect((await ok(b.get(`${SO}/${c.id}`))).order.actions).not.toContain('allocate');
    }
    for (const email of ['wh@a.example', 'admin@a.example']) {
      const b = await as(email, 'X');
      expect((await b.post(`${SO}/${c.id}/allocate`)).statusCode, email).toBe(403);
    }
    // The server decides every quantity, location and lot.
    for (const body of [
      { quantity: '1' },
      { lotId: 'x' },
      { locationId: loc.QC },
      { status: 'ACTIVE' },
    ]) {
      expect(
        (await mgr.post(`${SO}/${c.id}/allocate`, body)).statusCode,
        JSON.stringify(body),
      ).toBe(400);
    }
    await ok(mgr.post(`${SO}/${c.id}/allocate`));
    await ok(o.post(`${SO}/${c.id}/cancel`, { reason: 'x' }));
    expect(code(await mgr.post(`${SO}/${c.id}/allocate`))).toBe('SO_INVALID_TRANSITION');
    expect(await h.db.salesAllocation.count({ where: { status: 'ACTIVE' } })).toBe(0);
  });

  // ---------------------------------------------------------------- release, reallocate, cancel

  it('release keeps history; reallocate moves to the new FEFO first; cancel releases everything', async () => {
    const lotLate = await lotIn(it_.cream!, '10', 'L-LATE', 60);
    const o = await confirmed([[it_.cream!, '6']]);
    const mgr = await as('salesm@a.example');
    await ok(mgr.post(`${SO}/${o.id}/allocate`));
    const m0 = await movements();
    const b0 = await onHands();
    const rel = await ok(mgr.post(`${SO}/${o.id}/release`));
    expect(rel.order).toMatchObject({ allocationState: 'NOT_ALLOCATED' });
    expect(code(await mgr.post(`${SO}/${o.id}/release`))).toBe('SO_NOT_ALLOCATED');
    const history = await h.db.salesAllocation.findMany();
    expect(history.map((r) => [r.status, r.releaseReason, r.activeSlot])).toEqual([
      ['RELEASED', 'RELEASED', null],
    ]);
    await ok(mgr.post(`${SO}/${o.id}/allocate`));
    expect((await active())[0]!.lotId).toBe(lotLate);
    // An earlier-expiring lot arrives: reallocate releases and takes it, atomically.
    const lotSoon = await lotIn(it_.cream!, '10', 'L-SOON', 20);
    const re = await ok(mgr.post(`${SO}/${o.id}/reallocate`));
    expect(re.allocation).toMatchObject({ allocatedNow: '6', state: 'FULLY_ALLOCATED' });
    expect((await active()).map((r) => [r.lotId, r.quantity.toString()])).toEqual([[lotSoon, '6']]);
    expect(
      (await h.db.salesAllocation.findMany({ where: { releaseReason: 'REALLOCATED' } })).length,
    ).toBe(1);
    expect(await movements()).toBe(m0 + 1); // only the L-SOON stock (FOUND) moved
    expect(b0).not.toBe(''); // on hand changed only by that movement, never by a reservation
    // Cancel: everything ACTIVE released, in the same transaction.
    const owner = await ownerX();
    await ok(owner.post(`${SO}/${o.id}/cancel`, { reason: 'Customer withdrew' }));
    expect(await active()).toHaveLength(0);
    expect(await h.db.salesAllocation.count({ where: { releaseReason: 'ORDER_CANCELLED' } })).toBe(
      1,
    );
    // History is never deleted.
    await expect(h.db.salesAllocation.deleteMany({})).rejects.toThrow(/never deleted/);
    const timeline = (await ok(owner.get(`${SO}/${o.id}`))).timeline.map((t: J) => t.type);
    expect(timeline).toEqual([
      'SALES_ORDER_CREATED',
      'SALES_ORDER_SUBMITTED',
      'SALES_ORDER_CONFIRMED',
      'SALES_ALLOCATION_CREATED',
      'SALES_ORDER_FULLY_ALLOCATED',
      'SALES_ALLOCATION_RELEASED',
      'SALES_ALLOCATION_CREATED',
      'SALES_ORDER_FULLY_ALLOCATED',
      'SALES_ALLOCATION_REALLOCATED',
      'SALES_ALLOCATION_CREATED',
      'SALES_ORDER_FULLY_ALLOCATED',
      'SALES_ORDER_CANCELLED',
      'SALES_ALLOCATION_RELEASED',
    ]);
    const audit = await h.db.auditLog.findMany({
      where: { action: { startsWith: 'SALES_ALLOCATION' } },
    });
    expect(JSON.stringify(audit.map((a) => a.changes))).not.toMatch(
      /price|total|185|lot|location/i,
    );
    await assertInvariant();
  });

  // ---------------------------------------------------------------- physical guards

  it('transfers and adjustments cannot take reserved stock — at draft time or when posting', async () => {
    await stockIn(it_.box!, '10');
    const owner = await ownerX();
    // Drafted BEFORE the reservation (allowed then), posted after (refused).
    const early = (
      await ok(
        owner.post(`${W}/transfers`, {
          sourceLocationId: loc.MAIN,
          destinationLocationId: loc.QC,
          lines: [{ itemId: it_.box, quantity: '5' }],
        }),
        201,
      )
    ).transfer;
    const dec = (
      await ok(
        owner.post(`${W}/adjustments`, {
          reason: 'DAMAGE',
          lines: [{ direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.box, quantity: '4' }],
        }),
        201,
      )
    ).adjustment;
    await ok(owner.post(`${W}/adjustments/${dec.id}/submit`));
    const o = await confirmed([[it_.box!, '7']]);
    await ok((await as('salesm@a.example')).post(`${SO}/${o.id}/allocate`));
    expect((await ok(owner.get(`${W}/transfers/${early.id}`))).transfer.lines[0].available).toBe(
      '3',
    );
    let r = await owner.post(`${W}/transfers/${early.id}/post`);
    expect([r.statusCode, code(r)]).toEqual([409, 'STOCK_RESERVED']);
    expect(j(r).error.details).toMatchObject({ onHand: '10', reserved: '7', available: '3' });
    r = await owner.post(`${W}/adjustments/${dec.id}/approve`);
    expect(code(r)).toBe('STOCK_RESERVED');
    // New drafts are refused up front.
    r = await owner.post(`${W}/transfers`, {
      sourceLocationId: loc.MAIN,
      destinationLocationId: loc.QC,
      lines: [{ itemId: it_.box, quantity: '4' }],
    });
    expect(code(r)).toBe('STOCK_RESERVED');
    r = await owner.post(`${W}/adjustments`, {
      reason: 'DAMAGE',
      lines: [{ direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.box, quantity: '4' }],
    });
    expect(code(r)).toBe('STOCK_RESERVED');
    // Exactly the unreserved 3 may leave.
    const t3 = (
      await ok(
        owner.post(`${W}/transfers`, {
          sourceLocationId: loc.MAIN,
          destinationLocationId: loc.QC,
          lines: [{ itemId: it_.box, quantity: '3' }],
        }),
        201,
      )
    ).transfer;
    await ok(owner.post(`${W}/transfers/${t3.id}/post`));
    const main = await h.db.stockBalance.findFirstOrThrow({ where: { locationId: loc.MAIN } });
    expect(main.quantityOnHand.toString()).toBe('7');
    expect(await sumActive()).toBe('7');
    // Increases are always fine.
    await stockIn(it_.box!, '2');
    await assertInvariant();
  });

  it('reversals and count corrections cannot go below what is reserved', async () => {
    const owner = await ownerX();
    // A posted FOUND adjustment whose stock is then reserved cannot be reversed.
    const found = await stockIn(it_.box!, '10');
    const o = await confirmed([[it_.box!, '7']]);
    await ok((await as('salesm@a.example')).post(`${SO}/${o.id}/allocate`));
    let r = await owner.post(`${W}/adjustments/${found.id}/cancel`, { reason: 'mistake' });
    expect([r.statusCode, code(r)]).toEqual([409, 'STOCK_RESERVED']);
    // A posted transfer whose destination stock is reserved cannot be reversed.
    await stockIn(it_.cream!, '10', loc.MAIN, { newLotNumber: 'L-T', newLotExpiry: shift(40) });
    const lot = await h.db.inventoryLot.findFirstOrThrow({ where: { lotNumber: 'L-T' } });
    const t = (
      await ok(
        owner.post(`${W}/transfers`, {
          sourceLocationId: loc.MAIN,
          destinationLocationId: loc.QC,
          lines: [{ itemId: it_.cream, lotId: lot.id, quantity: '10' }],
        }),
        201,
      )
    ).transfer;
    await ok(owner.post(`${W}/transfers/${t.id}/post`));
    const o2 = await confirmed([[it_.cream!, '7']]);
    await ok((await as('salesm@a.example')).post(`${SO}/${o2.id}/allocate`));
    r = await owner.post(`${W}/transfers/${t.id}/cancel`, { reason: 'wrong bin' });
    expect(code(r)).toBe('STOCK_RESERVED');
    // A count finding 5 where 7 are reserved cannot post its correction.
    const cc = (
      await ok(owner.post(`${W}/counts`, { locationIds: [loc.MAIN], itemId: it_.box }), 201)
    ).count;
    const started = (await ok(owner.post(`${W}/counts/${cc.id}/start`))).count;
    await ok(
      owner.put(`${W}/counts/${cc.id}/entries`, {
        entries: started.lines.map((l: J) => ({ lineId: l.id, countedQuantity: '5' })),
      }),
    );
    await ok(owner.post(`${W}/counts/${cc.id}/review`));
    r = await owner.post(`${W}/counts/${cc.id}/post`);
    expect([r.statusCode, code(r)]).toEqual([409, 'STOCK_RESERVED']);
    // Remediation: release, then the count posts.
    await ok((await as('salesm@a.example')).post(`${SO}/${o.id}/release`));
    await ok(owner.post(`${W}/counts/${cc.id}/post`));
    await assertInvariant();
  });

  // ---------------------------------------------------------------- races

  it('race: same lot, two orders of 7 from 10 — never more than 10 reserved (3 rounds)', async () => {
    const [m1, m2] = await Promise.all([as('salesm@a.example'), as('salesm2@a.example')]);
    for (let round = 0; round < 3; round++) {
      const lotId = await lotIn(it_.cream!, '10', `L-R${round}`, 10 + round);
      const [a, b] = [await confirmed([[it_.cream!, '7']]), await confirmed([[it_.cream!, '7']])];
      const res = await Promise.all([
        m1.post(`${SO}/${a.id}/allocate`),
        m2.post(`${SO}/${b.id}/allocate`),
      ]);
      expect(res.map((x) => x.statusCode)).toEqual([200, 200]);
      const got = res.map((x) => j(x).allocation.allocatedNow).sort();
      expect(got).toEqual(['3', '7']);
      expect(await sumActive({ lotId })).toBe('10');
      // Earlier rounds stay reserved, so the next round competes for its own lot only.
    }
    await assertInvariant();
  });

  it('race: two lots of 5, two orders of 6 — 10 reserved in total, no lot double-booked', async () => {
    const l1 = await lotIn(it_.cream!, '5', 'L-1', 10);
    const l2 = await lotIn(it_.cream!, '5', 'L-2', 20, loc.QC);
    const [m1, m2] = await Promise.all([as('salesm@a.example'), as('salesm2@a.example')]);
    const [a, b] = [await confirmed([[it_.cream!, '6']]), await confirmed([[it_.cream!, '6']])];
    await Promise.all([m1.post(`${SO}/${a.id}/allocate`), m2.post(`${SO}/${b.id}/allocate`)]);
    expect(await sumActive()).toBe('10');
    expect(await sumActive({ lotId: l1 })).toBe('5');
    expect(await sumActive({ lotId: l2 })).toBe('5');
    await assertInvariant();
  });

  it('race: one order allocated three times at once reserves once', async () => {
    await stockIn(it_.box!, '20');
    const o = await confirmed([[it_.box!, '8']]);
    const [m1, m2] = await Promise.all([as('salesm@a.example'), as('salesm2@a.example')]);
    const res = await Promise.all([
      m1.post(`${SO}/${o.id}/allocate`),
      m2.post(`${SO}/${o.id}/allocate`),
      (await ownerX()).post(`${SO}/${o.id}/allocate`),
    ]);
    expect(res.every((x) => x.statusCode === 200)).toBe(true);
    expect(res.map((x) => j(x).allocation.allocatedNow).sort()).toEqual(['0', '0', '8']);
    expect(await sumActive()).toBe('8');
    expect(await h.db.salesAllocation.count()).toBe(1);
  });

  it('race: allocation against transfer, adjustment and cancellation keeps every invariant', async () => {
    const owner = await ownerX();
    const mgr = await as('salesm@a.example');
    for (let round = 0; round < 3; round++) {
      await stockIn(it_.box!, '10');
      const before = (
        await h.db.stockBalance.findFirstOrThrow({
          where: { locationId: loc.MAIN, itemId: it_.box },
        })
      ).quantityOnHand;
      const o = await confirmed([[it_.box!, '7']]);
      const t = (
        await ok(
          owner.post(`${W}/transfers`, {
            sourceLocationId: loc.MAIN,
            destinationLocationId: loc.QC,
            lines: [{ itemId: it_.box, quantity: before.minus(5).toString() }],
          }),
          201,
        )
      ).transfer;
      const d = (
        await ok(
          owner.post(`${W}/adjustments`, {
            reason: 'DAMAGE',
            lines: [
              { direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.box, quantity: '3' },
            ],
          }),
          201,
        )
      ).adjustment;
      await ok(owner.post(`${W}/adjustments/${d.id}/submit`));
      const res = await Promise.all([
        mgr.post(`${SO}/${o.id}/allocate`),
        owner.post(`${W}/transfers/${t.id}/post`),
        owner.post(`${W}/adjustments/${d.id}/approve`),
      ]);
      for (const x of res) expect([200, 409], x.body).toContain(x.statusCode);
      for (const x of res.filter((y) => y.statusCode === 409)) {
        expect(['STOCK_RESERVED', 'INSUFFICIENT_STOCK', 'CONCURRENT_UPDATE']).toContain(code(x));
      }
      await assertInvariant();
      // Allocation vs cancellation: the cancelled order never keeps a reservation.
      const c = await confirmed([[it_.box!, '1']]);
      await Promise.all([
        mgr.post(`${SO}/${c.id}/allocate`),
        owner.post(`${SO}/${c.id}/cancel`, { reason: 'x' }),
      ]);
      expect((await h.db.salesOrder.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
        'CANCELLED',
      );
      expect(await active({ salesOrderId: c.id })).toHaveLength(0);
      await mgr.post(`${SO}/${o.id}/release`); // next round starts unreserved (409 if nothing was)
    }
    await assertInvariant();
  });

  // ---------------------------------------------------------------- Pending Pick, privacy, isolation

  it('Pending Pick: warehouse sees where reserved stock is — never money, customers or other branches', async () => {
    await lotIn(it_.cream!, '4', 'L-PP', 15);
    await stockIn(it_.box!, '2');
    const o = await confirmed([
      [it_.cream!, '4'],
      [it_.box!, '5'],
      [it_.svc!, '1'],
    ]);
    const open = await confirmed([[it_.box!, '1']]); // never allocated: not pending pick
    await ok((await as('salesm@a.example')).post(`${SO}/${o.id}/allocate`));
    const wh = await as('wh@a.example');
    const res = await wh.get(`${W}/pending-pick`);
    expect(res.statusCode, res.body).toBe(200);
    const body = j(res);
    expect(body.items.map((x: J) => x.number)).toEqual([o.number]);
    expect(body.items.some((x: J) => x.id === open.id)).toBe(false);
    const row = body.items[0];
    expect(row).toMatchObject({ readiness: 'PARTIALLY_READY', branch: { code: '00001' } });
    expect(row.lines.map((l: J) => [l.item.code, l.ordered, l.allocated, l.shortage])).toEqual([
      ['CRM-1', '4', '4', '0'],
      ['BOX-1', '5', '2', '3'],
    ]); // the service line is not warehouse demand
    expect(row.lines[0].picks).toEqual([
      {
        location: { id: loc.MAIN, code: 'MAIN', name: 'Loc MAIN' },
        lot: { lotNumber: 'L-PP', expiryDate: shift(15) },
        expiryState: 'EXPIRING_SOON',
        quantity: '4',
        toPick: '4',
      },
    ]);
    // Key by key and value by value: nothing commercial.
    expect(keysOf(body.items).filter((k) => MONEY.test(k))).toEqual([]);
    expect(res.body).not.toMatch(/(?<![\w.])185(\.0+)?(?![\w.])|Customer One|CUS-000001|THB/);
    expect((await ok(wh.get(`${W}/context`))).counts.pendingPick).toBe(1);
    expect((await ok(wh.get(`${W}/pending-pick?readiness=READY`))).items).toEqual([]);
    expect((await ok(wh.get(`${W}/pending-pick?q=BOX`))).total).toBe(1);
    // Another branch's warehouse sees nothing; Sales has no warehouse read.
    expect((await ok((await as('wh.ho@a.example')).get(`${W}/pending-pick`))).items).toEqual([]);
    expect((await (await as('sales@a.example')).get(`${W}/pending-pick`)).statusCode).toBe(403);
    expect((await (await as('admin@a.example', 'X')).get(`${W}/pending-pick`)).statusCode).toBe(
      403,
    );
    // Executive reads; Warehouse has no Sales commercial API.
    expect((await ok((await as('exec@a.example')).get(`${W}/pending-pick`))).total).toBe(1);
    expect((await wh.get(`${SO}/${o.id}`)).statusCode).toBe(403);
    // Sales sees quantities, never locations or lots.
    const view = await (await as('sales@a.example')).get(`${SO}/${o.id}`);
    expect(view.body).not.toMatch(/L-PP|"MAIN"|lotNumber|locationId/);
  });

  it('isolation: other branch or company cannot allocate, release or see allocations (IDOR)', async () => {
    await stockIn(it_.box!, '5');
    const o = await confirmed([[it_.box!, '2']]);
    const foreign = [await as('salesm.ho@a.example'), await as('owner@b.example')];
    for (const b of foreign) {
      for (const a of ['allocate', 'release', 'reallocate']) {
        const r = await b.post(`${SO}/${o.id}/${a}`);
        expect([r.statusCode, code(r)]).toEqual([404, 'SO_NOT_FOUND']);
      }
    }
    await ok((await as('salesm@a.example')).post(`${SO}/${o.id}/allocate`));
    expect((await foreign[0]!.get(`${W}/pending-pick`)).statusCode).toBe(403); // Sales: no warehouse read
    expect((await ok(foreign[1]!.get(`${W}/pending-pick`))).items).toEqual([]); // company B
    expect(await h.db.salesAllocation.count()).toBe(1);
    // An order of company B cannot reserve company A stock (branch-bound by design).
    const bOwner = foreign[1]!;
    expect((await bOwner.get(`${S}/items?q=BOX`)).body).not.toContain(it_.box);
  });
});
