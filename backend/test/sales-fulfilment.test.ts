import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { BUSINESS_AUDIT_ENTITIES } from '../src/company/audit.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { permissionDefinition } from '../src/permissions/catalog.js';
import { Decimal } from '../src/purchasing/money.js';
import { companyDay } from '../src/purchasing/service.js';
import { fulfilmentStateOf } from '../src/sales/fulfilment.js';
import { FULFILMENT_FIELD_CLASSES } from '../src/warehouse/fulfilment-views.js';
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
 * EP35 sales fulfilment: pick → pack → shipment → dispatch → delivery. Stock
 * leaves ONLY at dispatch (one SALES_ISSUE per shipment line, the matching
 * reservation CONSUMED — split when partial); picks, packs and delivery never
 * move stock. Partial picks / packs / shipments, discrepancies, cancellation and
 * allocation guards, the dispatch races, Warehouse privacy, roles, isolation and
 * audit — and throughout: balance = Σ movements, reserved ≤ on hand, never negative.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const SO = '/api/v1/sales/orders';
const W = '/api/v1/warehouse';
const MONEY =
  /price|amount|discount|tax|total|margin|payment|cost|currency|deposit|credit|subtotal|invoice/i;

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

describe('Sales fulfilment contracts (EP35)', () => {
  it('fulfilment codes: picking is OPERATE, dispatch and delivery are MANAGE', () => {
    expect(permissionDefinition('warehouse.picking.process').tier).toBe('OPERATE');
    expect(permissionDefinition('warehouse.dispatch.confirm').tier).toBe('MANAGE');
    expect(permissionDefinition('warehouse.delivery.confirm').tier).toBe('MANAGE');
    for (const e of ['SalesPick', 'SalesPack', 'SalesShipment'])
      expect(BUSINESS_AUDIT_ENTITIES).toContain(e);
  });

  it('every fulfilment key is operational; none is money', () => {
    const keys = Object.keys(FULFILMENT_FIELD_CLASSES);
    expect(keys.filter((k) => MONEY.test(k))).toEqual([]);
    expect(new Set(Object.values(FULFILMENT_FIELD_CLASSES))).toEqual(new Set(['operational']));
  });

  it('derives one fulfilment state from per-line milestones', () => {
    const d = (n: number) => new Decimal(n);
    const p = (picked: number, dispatched: number, delivered: number) => ({
      allocated: d(10),
      picked: d(picked),
      packed: d(picked),
      dispatched: d(dispatched),
      delivered: d(delivered),
    });
    const one = (x: ReturnType<typeof p>, exception = false) =>
      fulfilmentStateOf('CONFIRMED', [{ ordered: d(10), p: x }], exception);
    expect(one(p(0, 0, 0))).toBe('NOT_STARTED');
    expect(one(p(4, 0, 0))).toBe('PARTIALLY_PICKED');
    expect(one(p(10, 0, 0))).toBe('PICKED');
    expect(one(p(10, 4, 0))).toBe('PARTIALLY_DISPATCHED');
    expect(one(p(10, 10, 0))).toBe('DISPATCHED');
    expect(one(p(10, 10, 3))).toBe('PARTIALLY_DELIVERED');
    expect(one(p(10, 10, 3), true)).toBe('EXCEPTION');
    expect(one(p(10, 10, 10), true)).toBe('DELIVERED');
    expect(fulfilmentStateOf('SUBMITTED', [{ ordered: d(1), p: p(0, 0, 0) }], false)).toBeNull();
    expect(fulfilmentStateOf('CONFIRMED', [], false)).toBeNull();
  });
});

// ------------------------------------------------------------------ enforcement

describeDb('Sales fulfilment (EP35)', () => {
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
    ['sales@a.example', 'DEPARTMENT_STAFF', 'A', ['SALES'], ['X']],
    ['wh@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['X']],
    ['whm@a.example', 'DEPARTMENT_MANAGER', 'A', ['WAREHOUSE'], ['X']],
    ['wh.ho@a.example', 'DEPARTMENT_MANAGER', 'A', ['WAREHOUSE'], ['HO']],
    ['owner@b.example', 'COMPANY_OWNER', 'B', [], null],
  ];

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    owner = undefined;
    people.clear();
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
    it_.oil = (await item('OIL-1', { baseUnitId: kg.id })).id;
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

  const people = new Map<string, Browser>();
  const as = async (email: string, branch: 'HO' | 'X' = 'X') => {
    const key = `${email}/${branch}`;
    const known = people.get(key);
    if (known) return known;
    const b = await signIn(h, email);
    await b.get('/api/v1/company/context');
    await b.post('/api/v1/company/context/branch', { branchId: br[branch] });
    people.set(key, b);
    return b;
  };
  const ok = async (res: Promise<ApiResponse>, status = 200) => {
    const r = await res;
    expect(r.statusCode, r.body).toBe(status);
    return j(r);
  };
  let owner: Browser | undefined;
  const ownerX = async () => (owner ??= await as('owner@a.example', 'X'));
  const stockIn = async (itemId: string, quantity: string, locationId = loc.MAIN!, lot: J = {}) => {
    const o = await ownerX();
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
    await ok(o.post(`${W}/adjustments/${d.id}/approve`));
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
  /** A CONFIRMED, allocated order in branch X. */
  const allocated = async (lines: [string, string][]) => {
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
    await ok(o.post(`${SO}/${d.id}/confirm`));
    return (await ok(o.post(`${SO}/${d.id}/allocate`))).order;
  };
  const wh = () => as('wh@a.example');
  const whm = () => as('whm@a.example');
  const pickAll = async (orderId: string, lines?: J[]) =>
    (
      await ok(
        (await wh()).post(`${W}/picks`, { salesOrderId: orderId, ...(lines ? { lines } : {}) }),
        201,
      )
    ).pick;
  const confirmAll = async (pick: J) =>
    (
      await ok(
        (await wh()).post(`${W}/picks/${pick.id}/confirm`, {
          lines: pick.lines.map((l: J) => ({ lineId: l.id, pickedQuantity: l.planned })),
        }),
      )
    ).pick;
  const packOf = async (orderId: string, lines?: J[]) => {
    const p = (
      await ok(
        (await wh()).post(`${W}/packs`, { salesOrderId: orderId, ...(lines ? { lines } : {}) }),
        201,
      )
    ).pack;
    return (await ok((await wh()).post(`${W}/packs/${p.id}/confirm`))).pack;
  };
  const shipOf = async (orderId: string, packIds?: string[]) =>
    (
      await ok(
        (await wh()).post(`${W}/shipments`, {
          salesOrderId: orderId,
          ...(packIds ? { packIds } : {}),
        }),
        201,
      )
    ).shipment;
  const dispatch = async (id: string) =>
    (await ok((await whm()).post(`${W}/shipments/${id}/dispatch`, {}))).shipment;
  const sumWhere = async (where: J) =>
    (await h.db.salesAllocation.findMany({ where }))
      .reduce((t, a) => t.plus(a.quantity), new Decimal(0))
      .toString();
  const onHand = async (itemId: string) =>
    (await h.db.stockBalance.findMany({ where: { itemId } }))
      .reduce((t, b) => t.plus(b.quantityOnHand), new Decimal(0))
      .toString();
  const issues = (where: J = {}) =>
    h.db.stockMovement.count({ where: { type: 'SALES_ISSUE', ...where } });
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
    // Every issued quantity has exactly one consumed reservation behind it.
    const unmatched = await h.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "StockMovement" m
      LEFT JOIN "SalesAllocation" a ON a."salesShipmentLineId" = m."salesShipmentLineId"
        AND a."status" = 'CONSUMED'
      WHERE m."type" = 'SALES_ISSUE' AND (a."id" IS NULL OR a."quantity" <> -m."quantityDelta")`;
    expect(Number(unmatched[0]!.n)).toBe(0);
  };

  // ---------------------------------------------------------------- full flow

  it('full flow: pick and pack never move stock; dispatch issues once and consumes the reservation', async () => {
    const lotA = await lotIn(it_.cream!, '10', 'L-A', 30);
    const o = await allocated([
      [it_.cream!, '6'],
      [it_.svc!, '1'],
    ]);
    const moves0 = await h.db.stockMovement.count();
    const pick = await pickAll(o.id);
    expect(
      pick.lines.map((l: J) => [l.item.code, l.lot.lotNumber, l.location.code, l.planned]),
    ).toEqual([['CRM-1', 'L-A', 'MAIN', '6']]);
    await ok((await wh()).post(`${W}/picks/${pick.id}/start`));
    const picked = await confirmAll(pick);
    expect(picked.status).toBe('PICKED');
    expect(picked.actions).toContain('pack');
    const pack = await packOf(o.id);
    expect(pack.status).toBe('PACKED');
    const ship = await shipOf(o.id);
    expect(ship.status).toBe('READY');
    expect(ship.shipToName).toBe('Customer One');
    expect(ship.reservationOk).toBe(true);
    // No movement, no balance change, reservation still ACTIVE through pick / pack / ship.
    expect(await h.db.stockMovement.count()).toBe(moves0);
    expect(await onHand(it_.cream!)).toBe('10');
    expect(await sumWhere({ status: 'ACTIVE', salesOrderId: o.id })).toBe('6');
    // Staff cannot dispatch; a Warehouse manager can.
    const staff = await (await wh()).post(`${W}/shipments/${ship.id}/dispatch`, {});
    expect(staff.statusCode).toBe(403);
    const sent = await dispatch(ship.id);
    expect(sent.status).toBe('DISPATCHED');
    const mv = await h.db.stockMovement.findMany({ where: { type: 'SALES_ISSUE' } });
    expect(
      mv.map((m) => [
        m.quantityDelta.toString(),
        m.lotId,
        m.locationId,
        m.sourceType,
        m.salesShipmentId,
      ]),
    ).toEqual([['-6', lotA, loc.MAIN, 'SALES_SHIPMENT', ship.id]]);
    expect(await onHand(it_.cream!)).toBe('4');
    expect(await sumWhere({ status: 'ACTIVE', salesOrderId: o.id })).toBe('0');
    expect(await sumWhere({ status: 'CONSUMED', salesOrderId: o.id })).toBe('6');
    const stock = (await ok((await wh()).get(`${W}/stock?itemId=${it_.cream}`))).items[0];
    expect([stock.quantityOnHand, stock.quantityReserved, stock.quantityAvailable]).toEqual([
      '4',
      '0',
      '4',
    ]);
    // A second dispatch is refused; deliver once; delivery twice is refused; no new movement.
    expect(code(await (await whm()).post(`${W}/shipments/${ship.id}/dispatch`, {}))).toBe(
      'INVALID_TRANSITION',
    );
    const done = (
      await ok(
        (await whm()).post(`${W}/shipments/${ship.id}/deliver`, {
          recipientName: 'Khun A',
          reference: 'POD-1',
        }),
      )
    ).shipment;
    expect(done.status).toBe('DELIVERED');
    expect(done.events.map((e: J) => [e.type, e.recipientName])).toEqual([['DELIVERED', 'Khun A']]);
    expect((await (await whm()).post(`${W}/shipments/${ship.id}/deliver`, {})).statusCode).toBe(
      409,
    );
    expect(await issues()).toBe(1);
    // Sales sees the progress per line (service line has none) and the shipment — no location / lot.
    const view = await ok((await ownerX()).get(`${SO}/${o.id}`));
    expect(view.order.lines.map((l: J) => l.progress)).toEqual([
      {
        ordered: '6',
        allocated: '6',
        picked: '6',
        packed: '6',
        dispatched: '6',
        delivered: '6',
        toDispatch: '0',
        toDeliver: '0',
      },
      {
        ordered: '1',
        allocated: null,
        picked: null,
        packed: null,
        dispatched: null,
        delivered: null,
        toDispatch: null,
        toDeliver: null,
      },
    ]);
    expect(view.fulfilment.state).toBe('DELIVERED');
    expect(view.fulfilment.shipments.map((s: J) => [s.number, s.status])).toEqual([
      [ship.number, 'DELIVERED'],
    ]);
    expect(keysOf(view.fulfilment)).not.toContain('location');
    // Issued stock: the order cannot be cancelled; the movement links to the shipment.
    const cancel = await (await ownerX()).post(`${SO}/${o.id}/cancel`, { reason: 'late' });
    expect(code(cancel)).toBe('SO_ALREADY_DISPATCHED');
    const mvView = (await ok((await wh()).get(`${W}/movements?sourceType=SALES_SHIPMENT`))).items;
    expect(mvView[0].source.shipment).toEqual({ id: ship.id, number: ship.number });
    expect(ship.number).toMatch(/^SHP-\d{6}-\d{6}$/);
    expect(pick.number).toMatch(/^PICK-\d{6}-\d{6}$/);
    expect(pack.number).toMatch(/^PACK-\d{6}-\d{6}$/);
    await assertInvariant();
  });

  it('partial shipments: 40 then 60 — the reservation splits, history kept, nothing over-issued', async () => {
    await stockIn(it_.box!, '100');
    const o = await allocated([[it_.box!, '100']]);
    const pick = await confirmAll(await pickAll(o.id));
    const [pl] = pick.lines;
    const packA = await packOf(o.id, [{ pickLineId: pl.id, quantity: '40' }]);
    const shipA = await shipOf(o.id, [packA.id]);
    await dispatch(shipA.id);
    expect(await onHand(it_.box!)).toBe('60');
    expect(await sumWhere({ status: 'ACTIVE', salesOrderId: o.id })).toBe('60');
    const consumed = await h.db.salesAllocation.findMany({ where: { status: 'CONSUMED' } });
    expect(consumed.map((c) => [c.quantity.toString(), !!c.splitFromId])).toEqual([['40', true]]);
    let view = await ok((await ownerX()).get(`${SO}/${o.id}`));
    expect(view.order.lines[0].progress).toMatchObject({
      dispatched: '40',
      toDispatch: '60',
      toDeliver: '40',
    });
    expect(view.fulfilment.state).toBe('PARTIALLY_DISPATCHED');
    // The second pack takes the rest; more than that is refused.
    const over = await (
      await wh()
    ).post(`${W}/packs`, {
      salesOrderId: o.id,
      lines: [{ pickLineId: pl.id, quantity: '61' }],
    });
    expect(code(over)).toBe('PACK_EXCEEDS_PICKED');
    const packB = await packOf(o.id);
    const shipB = await shipOf(o.id);
    expect(shipB.lines.map((l: J) => l.quantity)).toEqual(['60']);
    await dispatch(shipB.id);
    expect(await onHand(it_.box!)).toBe('0');
    expect(await sumWhere({ status: 'ACTIVE', salesOrderId: o.id })).toBe('0');
    expect(await sumWhere({ status: 'CONSUMED', salesOrderId: o.id })).toBe('100');
    expect(packB.status).toBe('PACKED');
    // Deliver A partly (exception keeps the rest outstanding), then the rest; B fully.
    const partA = (
      await ok(
        (await whm()).post(`${W}/shipments/${shipA.id}/deliver`, {
          lines: [{ lineId: shipA.lines[0].id, quantity: '30' }],
        }),
      )
    ).shipment;
    expect(partA.status).toBe('DELIVERY_EXCEPTION');
    expect(partA.lines[0]).toMatchObject({ delivered: '30', outstanding: '10' });
    const tooMuch = await (
      await whm()
    ).post(`${W}/shipments/${shipA.id}/deliver`, {
      lines: [{ lineId: shipA.lines[0].id, quantity: '11' }],
    });
    expect(code(tooMuch)).toBe('DELIVERY_EXCEEDS_DISPATCHED');
    view = await ok((await ownerX()).get(`${SO}/${o.id}`));
    expect(view.fulfilment.state).toBe('EXCEPTION');
    expect(view.order.lines[0].progress).toMatchObject({
      dispatched: '100',
      delivered: '30',
      toDeliver: '70',
    });
    await ok((await whm()).post(`${W}/shipments/${shipA.id}/deliver`, {}));
    await ok((await whm()).post(`${W}/shipments/${shipB.id}/deliver`, {}));
    view = await ok((await ownerX()).get(`${SO}/${o.id}`));
    expect(view.fulfilment.state).toBe('DELIVERED');
    expect(view.order.lines[0].progress).toMatchObject({ toDispatch: '0', toDeliver: '0' });
    expect(await issues()).toBe(2);
    await assertInvariant();
  });

  it('picking limits: exact reservation, no over-pick, discrepancies need a reason, claims are not double counted', async () => {
    await lotIn(it_.cream!, '5', 'L-1', 20);
    await lotIn(it_.cream!, '5', 'L-2', 40, loc.QC);
    const o = await allocated([[it_.cream!, '8']]);
    const allocs = await h.db.salesAllocation.findMany({
      where: { status: 'ACTIVE' },
      include: { lot: true },
    });
    const a1 = allocs.find((a) => a.lot?.lotNumber === 'L-1')!;
    // Named lines: more than reserved (or another order's / an unknown reservation) is refused.
    const over = await (
      await wh()
    ).post(`${W}/picks`, {
      salesOrderId: o.id,
      lines: [{ allocationId: a1.id, quantity: '6' }],
    });
    expect(code(over)).toBe('PICK_EXCEEDS_RESERVATION');
    expect(
      code(
        await (
          await wh()
        ).post(`${W}/picks`, {
          salesOrderId: o.id,
          lines: [{ allocationId: 'nope', quantity: '1' }],
        }),
      ),
    ).toBe('RESERVATION_NOT_ACTIVE');
    const p1 = await pickAll(o.id, [{ allocationId: a1.id, quantity: '3' }]);
    // The rest of L-1 (2) and L-2 (3) — FEFO order — then nothing is left to claim.
    const p2 = await pickAll(o.id);
    expect(p2.lines.map((l: J) => [l.lot.lotNumber, l.planned])).toEqual([
      ['L-1', '2'],
      ['L-2', '3'],
    ]);
    expect(code(await (await wh()).post(`${W}/picks`, { salesOrderId: o.id }))).toBe(
      'NOTHING_TO_PICK',
    );
    // Claims are not a second reservation: available = on hand − reserved, once.
    const stock = (await ok((await wh()).get(`${W}/stock?itemId=${it_.cream}&view=lots`))).items;
    expect(stock.map((s: J) => [s.lot.lotNumber, s.quantityReserved, s.quantityAvailable])).toEqual(
      expect.arrayContaining([
        ['L-1', '5', '0'],
        ['L-2', '3', '2'],
      ]),
    );
    // Confirm: every line, ≤ planned, short needs a discrepancy (OTHER needs a note).
    const confirm = (lines: J[]) =>
      (async () => (await wh()).post(`${W}/picks/${p1.id}/confirm`, { lines }))();
    expect(code(await confirm([]))).toBe('VALIDATION_FAILED');
    expect(code(await confirm([{ lineId: p1.lines[0].id, pickedQuantity: '4' }]))).toBe(
      'PICK_EXCEEDS_PLANNED',
    );
    expect(code(await confirm([{ lineId: p1.lines[0].id, pickedQuantity: '2' }]))).toBe(
      'DISCREPANCY_REQUIRED',
    );
    expect(
      code(await confirm([{ lineId: p1.lines[0].id, pickedQuantity: '2', discrepancy: 'OTHER' }])),
    ).toBe('NOTE_REQUIRED');
    expect(
      code(
        await confirm([{ lineId: p1.lines[0].id, pickedQuantity: '1.5', discrepancy: 'DAMAGED' }]),
      ),
    ).toBe('QUANTITY_PRECISION');
    const short = (
      await ok(confirm([{ lineId: p1.lines[0].id, pickedQuantity: '2', discrepancy: 'DAMAGED' }]))
    ).pick;
    expect(short.lines[0]).toMatchObject({ picked: '2', discrepancy: 'DAMAGED', toPack: '2' });
    // The short remainder stays reserved (never silently released) and can be picked again.
    expect(await sumWhere({ status: 'ACTIVE' })).toBe('8');
    const pp = (await ok((await wh()).get(`${W}/pending-pick`))).items[0];
    const l1 = pp.lines[0].picks.find((x: J) => x.lot.lotNumber === 'L-1');
    expect([l1.quantity, l1.toPick]).toEqual(['5', '1']);
    const p3 = await pickAll(o.id);
    expect(p3.lines.map((l: J) => [l.lot.lotNumber, l.planned])).toEqual([['L-1', '1']]);
    // Cancelling an open pick returns its claim; no stock ever moved.
    await ok((await wh()).post(`${W}/picks/${p3.id}/cancel`, {}));
    expect((await pickAll(o.id)).lines[0].planned).toBe('1');
    expect(await h.db.stockMovement.count({ where: { type: 'SALES_ISSUE' } })).toBe(0);
    await assertInvariant();
  });

  it('cancellation and allocation guards: staged work blocks release, reallocate and order cancel until unwound', async () => {
    await stockIn(it_.box!, '10');
    const o = await allocated([[it_.box!, '5']]);
    const pick = await confirmAll(await pickAll(o.id));
    const owner = await ownerX();
    expect(code(await owner.post(`${SO}/${o.id}/release`))).toBe('FULFILMENT_IN_PROGRESS');
    expect(code(await owner.post(`${SO}/${o.id}/reallocate`))).toBe('FULFILMENT_IN_PROGRESS');
    expect(code(await owner.post(`${SO}/${o.id}/cancel`, { reason: 'x' }))).toBe(
      'FULFILMENT_IN_PROGRESS',
    );
    // A picked pick: cancelled only with a reason, and only while nothing of it is packed.
    const pack = await packOf(o.id);
    expect(code(await (await wh()).post(`${W}/picks/${pick.id}/cancel`, { reason: 'x' }))).toBe(
      'PICK_ALREADY_PACKED',
    );
    const ship = await shipOf(o.id);
    expect(code(await (await wh()).post(`${W}/packs/${pack.id}/cancel`, {}))).toBe(
      'PACK_IN_SHIPMENT',
    );
    await ok((await wh()).post(`${W}/shipments/${ship.id}/cancel`, {}));
    // The pack is shippable again; cancel it, then the pick, then the order.
    expect((await ok((await wh()).get(`${W}/packs/${pack.id}`))).pack.actions).toEqual(
      expect.arrayContaining(['cancel', 'ship']),
    );
    await ok((await wh()).post(`${W}/packs/${pack.id}/cancel`, {}));
    expect(code(await (await wh()).post(`${W}/picks/${pick.id}/cancel`, {}))).toBe(
      'REASON_REQUIRED',
    );
    await ok((await wh()).post(`${W}/picks/${pick.id}/cancel`, { reason: 'customer called' }));
    const cancelled = (await ok(owner.post(`${SO}/${o.id}/cancel`, { reason: 'customer called' })))
      .order;
    expect(cancelled.status).toBe('CANCELLED');
    expect(await sumWhere({ status: 'ACTIVE' })).toBe('0');
    // A cancelled order gets no new pick, pack or shipment.
    expect(code(await (await wh()).post(`${W}/picks`, { salesOrderId: o.id }))).toBe(
      'SO_NOT_CONFIRMED',
    );
    expect(await h.db.stockMovement.count({ where: { type: 'SALES_ISSUE' } })).toBe(0);
    await assertInvariant();
  });

  it('decimal precision and per-unit progress: kilograms stay kilograms, never summed with pieces', async () => {
    await stockIn(it_.oil!, '2.5');
    await stockIn(it_.box!, '3');
    const o = await allocated([
      [it_.oil!, '2.25'],
      [it_.box!, '3'],
    ]);
    const pick = await confirmAll(await pickAll(o.id));
    const oilLine = pick.lines.find((l: J) => l.item.code === 'OIL-1');
    await packOf(o.id, [{ pickLineId: oilLine.id, quantity: '1.125' }]);
    const ship = await shipOf(o.id);
    await dispatch(ship.id);
    expect(await onHand(it_.oil!)).toBe('1.375');
    const view = await ok((await ownerX()).get(`${SO}/${o.id}`));
    expect(
      view.order.lines.map((l: J) => [l.unit.code, l.progress.dispatched, l.progress.toDispatch]),
    ).toEqual([
      ['KG', '1.125', '1.125'],
      ['PCS', '0', '3'],
    ]);
    expect(
      code(
        await (
          await wh()
        ).post(`${W}/packs`, {
          salesOrderId: o.id,
          lines: [{ pickLineId: oilLine.id, quantity: '0.0001' }],
        }),
      ),
    ).toBe('QUANTITY_PRECISION');
    await assertInvariant();
  });

  // ---------------------------------------------------------------- races

  it('race: three dispatches of one shipment issue once (3 rounds)', async () => {
    await stockIn(it_.box!, '30');
    for (let round = 0; round < 3; round++) {
      const o = await allocated([[it_.box!, '4']]);
      await confirmAll(await pickAll(o.id));
      await packOf(o.id);
      const ship = await shipOf(o.id);
      const m = await whm();
      const rs = await Promise.all(
        [1, 2, 3].map(() => m.post(`${W}/shipments/${ship.id}/dispatch`, {})),
      );
      expect(rs.map((r) => r.statusCode).sort()).toEqual([200, 409, 409]);
      expect(await issues({ salesShipmentId: ship.id })).toBe(1);
      expect(
        await h.db.salesAllocation.count({ where: { salesOrderId: o.id, status: 'CONSUMED' } }),
      ).toBe(1);
    }
    expect(await onHand(it_.box!)).toBe('18');
    await assertInvariant();
  });

  it('race: two picks claiming 7 of 10 each — never more than 10 claimed', async () => {
    await stockIn(it_.box!, '10');
    const o = await allocated([[it_.box!, '10']]);
    const [a] = await h.db.salesAllocation.findMany({ where: { status: 'ACTIVE' } });
    const w = await wh();
    const rs = await Promise.all(
      [1, 2].map(() =>
        w.post(`${W}/picks`, {
          salesOrderId: o.id,
          lines: [{ allocationId: a!.id, quantity: '7' }],
        }),
      ),
    );
    expect(rs.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const planned = await h.db.salesPickLine.aggregate({ _sum: { plannedQuantity: true } });
    expect(planned._sum.plannedQuantity!.toString()).toBe('7');
  });

  it('race: dispatch against release, reallocate, cancel, transfer, adjustment and an open count', async () => {
    await stockIn(it_.box!, '40');
    const owner = await ownerX();
    // vs release / reallocate / cancel: staged work blocks them, so dispatch always wins cleanly.
    for (const other of ['release', 'reallocate', 'cancel'] as const) {
      const o = await allocated([[it_.box!, '3']]);
      await confirmAll(await pickAll(o.id));
      await packOf(o.id);
      const ship = await shipOf(o.id);
      const [d, x] = await Promise.all([
        (await whm()).post(`${W}/shipments/${ship.id}/dispatch`, {}),
        owner.post(`${SO}/${o.id}/${other}`, other === 'cancel' ? { reason: 'race' } : undefined),
      ]);
      expect(d.statusCode, d.body).toBe(200);
      expect(x.statusCode).toBe(409);
      // Either the staged work blocks it, or the dispatch committed first and nothing is
      // left: release / reallocate then find no ACTIVE reservation (nothing written).
      expect([
        'FULFILMENT_IN_PROGRESS',
        'SO_ALREADY_DISPATCHED',
        ...(other === 'cancel' ? [] : ['SO_NOT_ALLOCATED']),
      ]).toContain(code(x));
      expect((await ok(owner.get(`${SO}/${o.id}`))).order.status).toBe('CONFIRMED');
    }
    // vs a transfer / adjustment of the same stock: the free part may move, the reserved part never.
    const o = await allocated([[it_.box!, '5']]);
    await confirmAll(await pickAll(o.id));
    await packOf(o.id);
    const ship = await shipOf(o.id);
    const tr = (
      await ok(
        owner.post(`${W}/transfers`, {
          sourceLocationId: loc.MAIN,
          destinationLocationId: loc.QC,
          lines: [{ itemId: it_.box!, quantity: '20' }],
        }),
        201,
      )
    ).transfer;
    const adj = (
      await ok(
        owner.post(`${W}/adjustments`, {
          reason: 'DAMAGE',
          lines: [{ direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.box!, quantity: '5' }],
        }),
        201,
      )
    ).adjustment;
    await ok(owner.post(`${W}/adjustments/${adj.id}/submit`));
    const [d, t, a] = await Promise.all([
      (await whm()).post(`${W}/shipments/${ship.id}/dispatch`, {}),
      owner.post(`${W}/transfers/${tr.id}/post`),
      owner.post(`${W}/adjustments/${adj.id}/approve`),
    ]);
    expect(d.statusCode, d.body).toBe(200);
    for (const r of [t, a]) expect([200, 409]).toContain(r.statusCode);
    await assertInvariant();
    // vs an open count of the location: the count lock refuses the issue (nothing written).
    const o2 = await allocated([[it_.box!, '1']]);
    await confirmAll(await pickAll(o2.id));
    await packOf(o2.id);
    const ship2 = await shipOf(o2.id);
    const count = (await ok(owner.post(`${W}/counts`, { locationIds: [loc.MAIN, loc.QC] }), 201))
      .count;
    await ok(owner.post(`${W}/counts/${count.id}/start`));
    const blocked = await (await whm()).post(`${W}/shipments/${ship2.id}/dispatch`, {});
    expect(code(blocked)).toBe('COUNT_IN_PROGRESS');
    expect((await ok((await wh()).get(`${W}/shipments/${ship2.id}`))).shipment.status).toBe(
      'READY',
    );
    expect(await issues({ salesShipmentId: ship2.id })).toBe(0);
    await ok(owner.post(`${W}/counts/${count.id}/cancel`, {}));
    await dispatch(ship2.id);
    await assertInvariant();
  });

  it('race: concurrent partial shipments and double delivery never over-issue or over-deliver', async () => {
    await stockIn(it_.box!, '10');
    const o = await allocated([[it_.box!, '10']]);
    const pick = await confirmAll(await pickAll(o.id));
    const pl = pick.lines[0];
    const s1 = await shipOf(o.id, [
      (await packOf(o.id, [{ pickLineId: pl.id, quantity: '6' }])).id,
    ]);
    const s2 = await shipOf(o.id, [
      (await packOf(o.id, [{ pickLineId: pl.id, quantity: '4' }])).id,
    ]);
    const m = await whm();
    const rs = await Promise.all(
      [s1, s2, s1, s2].map((s) => m.post(`${W}/shipments/${s.id}/dispatch`, {})),
    );
    expect(rs.filter((r) => r.statusCode === 200)).toHaveLength(2);
    expect(await onHand(it_.box!)).toBe('0');
    expect(await sumWhere({ status: 'CONSUMED' })).toBe('10');
    const ds = await Promise.all([1, 2].map(() => m.post(`${W}/shipments/${s1.id}/deliver`, {})));
    expect(ds.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const line = await h.db.salesShipmentLine.findFirstOrThrow({ where: { shipmentId: s1.id } });
    expect(line.deliveredQuantity.toString()).toBe('6');
    expect(await h.db.salesDeliveryEvent.count({ where: { shipmentId: s1.id } })).toBe(1);
    await assertInvariant();
  });

  it('numbering: concurrent picks get unique consecutive numbers', async () => {
    await stockIn(it_.box!, '12');
    const orders = [];
    for (let i = 0; i < 4; i++) orders.push(await allocated([[it_.box!, '3']]));
    const w = await wh();
    const rs = await Promise.all(orders.map((o) => w.post(`${W}/picks`, { salesOrderId: o.id })));
    const numbers = rs.map((r) => j(r).pick.number as string).sort();
    expect(new Set(numbers).size).toBe(4);
    expect(numbers.map((n) => Number(n.slice(-6)))).toEqual([1, 2, 3, 4]);
  });

  // ---------------------------------------------------------------- privacy, roles, isolation

  it('Warehouse sees no money anywhere in picks, packs or shipments; roles and branches are enforced', async () => {
    await stockIn(it_.box!, '10');
    const o = await allocated([[it_.box!, '2']]);
    const pick = await confirmAll(await pickAll(o.id));
    const pack = await packOf(o.id);
    const ship = await shipOf(o.id);
    const w = await wh();
    for (const path of [
      `${W}/picks`,
      `${W}/picks/${pick.id}`,
      `${W}/packs`,
      `${W}/packs/${pack.id}`,
      `${W}/shipments`,
      `${W}/shipments/${ship.id}`,
      `${W}/pending-pick`,
      `${W}/context`,
    ]) {
      const body = await ok(w.get(path));
      const paging = new Set(['total', 'page', 'pageSize', 'hasMore']);
      expect(
        keysOf(body).filter((k) => !paging.has(k) && MONEY.test(k)),
        path,
      ).toEqual([]);
      const text = JSON.stringify(body);
      expect(text, path).not.toMatch(/"185(\.0+)?"|370|CUS-000001/);
    }
    // Executive reads, never acts; System Admin (no Warehouse) and Sales cannot touch fulfilment.
    const exec = await as('exec@a.example');
    expect((await exec.get(`${W}/shipments/${ship.id}`)).statusCode).toBe(200);
    expect((await exec.post(`${W}/shipments/${ship.id}/dispatch`, {})).statusCode).toBe(403);
    expect((await exec.post(`${W}/picks`, { salesOrderId: o.id })).statusCode).toBe(403);
    for (const who of ['admin@a.example', 'salesm@a.example', 'sales@a.example']) {
      const b = await as(who);
      expect((await b.post(`${W}/shipments/${ship.id}/dispatch`, {})).statusCode, who).toBe(403);
      expect((await b.post(`${W}/picks`, { salesOrderId: o.id })).statusCode, who).toBe(403);
    }
    // Another branch's manager and another company: not found.
    const ho = await as('wh.ho@a.example', 'HO');
    expect((await ho.get(`${W}/shipments/${ship.id}`)).statusCode).toBe(404);
    expect((await ho.post(`${W}/shipments/${ship.id}/dispatch`, {})).statusCode).toBe(404);
    expect((await ho.post(`${W}/picks`, { salesOrderId: o.id })).statusCode).toBe(404);
    const b = await as('owner@b.example', 'X').catch(async () => signIn(h, 'owner@b.example'));
    expect((await b.get(`${W}/picks/${pick.id}`)).statusCode).toBe(404);
    expect((await b.post(`${W}/shipments/${ship.id}/dispatch`, {})).statusCode).toBe(404);
    // Mass assignment: server-owned fields are refused.
    for (const extra of [
      { status: 'DISPATCHED' },
      { number: 'SHP-1' },
      { branchId: br.HO },
      { quantity: '1' },
    ]) {
      expect((await w.post(`${W}/shipments`, { salesOrderId: o.id, ...extra })).statusCode).toBe(
        400,
      );
    }
    expect(
      (
        await w.post(`${W}/picks`, {
          salesOrderId: o.id,
          lines: [{ allocationId: 'a', quantity: '1', locationId: loc.QC }],
        })
      ).statusCode,
    ).toBe(400);
    // Audit: document numbers and counts only; Platform explorer redacts these entities.
    await dispatch(ship.id);
    const audit = await h.db.auditLog.findMany({
      where: { entityType: { in: ['SalesPick', 'SalesPack', 'SalesShipment'] } },
    });
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'SALES_PICK_CREATED',
        'SALES_PICK_CONFIRMED',
        'SALES_PACK_CREATED',
        'SALES_SHIPMENT_DISPATCHED',
      ]),
    );
    for (const a of audit) expect(keysOf(a.changes).filter((k) => MONEY.test(k))).toEqual([]);
  });

  it('delivery exceptions keep stock, reservations and Sales totals untouched', async () => {
    await stockIn(it_.box!, '5');
    const o = await allocated([[it_.box!, '5']]);
    await confirmAll(await pickAll(o.id));
    await packOf(o.id);
    const ship = await shipOf(o.id);
    await dispatch(ship.id);
    const before = [
      await onHand(it_.box!),
      await h.db.stockMovement.count(),
      (await ok((await ownerX()).get(`${SO}/${o.id}`))).order.grandTotal,
    ];
    const m = await whm();
    expect(code(await m.post(`${W}/shipments/${ship.id}/exception`, { reason: 'OTHER' }))).toBe(
      'NOTE_REQUIRED',
    );
    const ex = (
      await ok(
        m.post(`${W}/shipments/${ship.id}/exception`, {
          reason: 'RECIPIENT_UNAVAILABLE',
          note: 'closed',
        }),
      )
    ).shipment;
    expect(ex.status).toBe('DELIVERY_EXCEPTION');
    await ok(m.post(`${W}/shipments/${ship.id}/exception`, { reason: 'LOST_IN_TRANSIT' }));
    const after = [
      await onHand(it_.box!),
      await h.db.stockMovement.count(),
      (await ok((await ownerX()).get(`${SO}/${o.id}`))).order.grandTotal,
    ];
    expect(after).toEqual(before);
    const view = await ok((await ownerX()).get(`${SO}/${o.id}`));
    expect(view.fulfilment.shipments[0]).toMatchObject({
      status: 'DELIVERY_EXCEPTION',
      exception: 'LOST_IN_TRANSIT',
    });
    // A dispatched shipment cannot go back (database guard), and delivery evidence is immutable.
    await expect(
      h.db.salesShipment.update({ where: { id: ship.id }, data: { status: 'READY' } }),
    ).rejects.toThrow();
    await expect(
      h.db.salesDeliveryEvent.deleteMany({ where: { shipmentId: ship.id } }),
    ).rejects.toThrow();
    await expect(h.db.salesPick.deleteMany({})).rejects.toThrow();
    // A later successful attempt resolves it.
    expect(
      (await ok(m.post(`${W}/shipments/${ship.id}/deliver`, { recipientName: 'Khun B' }))).shipment
        .status,
    ).toBe('DELIVERED');
    await assertInvariant();
  });
});
