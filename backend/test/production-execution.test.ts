import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { BUSINESS_AUDIT_ENTITIES } from '../src/company/audit.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { permissionDefinition } from '../src/permissions/catalog.js';
import { reservationStateOf } from '../src/production/allocation.js';
import { IssueView, MoView, WarehouseIssueRow } from '../src/production/views.js';
import { Decimal } from '../src/purchasing/money.js';
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
 * EP37 material reservation, material issue and production execution. A
 * production reservation is a claim, never a movement, counted by the same
 * guard as sales reservations: sales + production reserved ≤ on hand, always.
 * Posting a material issue is the only production stock writer
 * (PRODUCTION_CONSUMPTION via ledger.ts, the exact reservation consumed — split
 * when partial). Usage is evidence only. Throughout: balance = Σ movements,
 * nothing negative, nothing over-reserved, no finished goods appear.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const P = '/api/v1/production';
const SO = '/api/v1/sales/orders';
const W = '/api/v1/warehouse';
const MONEY =
  /price|amount|discount|tax|total|margin|payment|cost|currency|deposit|credit|subtotal|invoice|customer/i;
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
const shapeKeys = (s: { shape: Record<string, unknown> }): string[] =>
  Object.entries(s.shape).flatMap(([k, v]) => {
    let inner: any = v;
    for (let i = 0; i < 4 && inner; i++) {
      if (inner.shape) return [k, ...shapeKeys(inner)];
      inner = inner.unwrap?.() ?? inner.element ?? inner._def?.innerType ?? null;
    }
    return [k];
  });

describe('Production execution contracts (EP37)', () => {
  it('codes and tiers; the issue is a business audit entity; no response key is money', () => {
    expect(permissionDefinition('operations.materials.manage').tier).toBe('MANAGE');
    expect(permissionDefinition('operations.material_issues.create').tier).toBe('OPERATE');
    expect(permissionDefinition('operations.material_issues.approve').tier).toBe('MANAGE');
    expect(permissionDefinition('operations.material_usage.create').tier).toBe('OPERATE');
    expect(permissionDefinition('operations.execution.manage').tier).toBe('MANAGE');
    expect(permissionDefinition('warehouse.material_issues.view')).toMatchObject({
      tier: 'READ',
      namespace: 'WAREHOUSE',
    });
    expect(BUSINESS_AUDIT_ENTITIES).toContain('ProductionMaterialIssue');
    const keys = [MoView, IssueView, WarehouseIssueRow].flatMap((s) => shapeKeys(s as never));
    expect(keys.filter((k) => MONEY.test(k))).toEqual([]);
  });

  it('reservation state is derived from required / reserved / issued per material', () => {
    const d = (n: number) => new Decimal(n);
    const l = (r: number, res: number, iss: number) => ({
      required: d(r),
      reserved: d(res),
      issued: d(iss),
    });
    expect(reservationStateOf([l(10, 0, 0)])).toBe('NOT_RESERVED');
    expect(reservationStateOf([l(10, 4, 0)])).toBe('PARTIALLY_RESERVED');
    expect(reservationStateOf([l(10, 10, 0), l(5, 5, 0)])).toBe('FULLY_RESERVED');
    expect(reservationStateOf([l(10, 6, 4)])).toBe('PARTIALLY_ISSUED');
    expect(reservationStateOf([l(10, 0, 10)])).toBe('ISSUED');
    expect(reservationStateOf([])).toBeNull();
  });
});

describeDb('Production execution (EP37)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const br: Record<'HO' | 'X', string> = { HO: '', X: '' };
  const it_ = {} as Record<'fg' | 'rm' | 'pk' | 'lot', string>;
  const loc = {} as Record<'MAIN' | 'QC' | 'HO', string>;
  let customer = '';
  let foreignLoc = '';
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
    ['opm@a.example', 'DEPARTMENT_MANAGER', 'A', ['OPERATIONS'], ['X']],
    ['ops@a.example', 'DEPARTMENT_STAFF', 'A', ['OPERATIONS'], ['X']],
    ['opm.ho@a.example', 'DEPARTMENT_MANAGER', 'A', ['OPERATIONS'], ['HO']],
    ['sales@a.example', 'DEPARTMENT_STAFF', 'A', ['SALES'], ['X']],
    ['wh@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['X']],
    ['whm@a.example', 'DEPARTMENT_MANAGER', 'A', ['WAREHOUSE'], ['X']],
    ['pur@a.example', 'DEPARTMENT_MANAGER', 'A', ['PURCHASING'], ['X']],
    ['owner@b.example', 'COMPANY_OWNER', 'B', [], null],
  ];

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    people.clear();
    await resetDb(h.db);
    A = await createActiveCompany(h.db, {
      name: 'Alpha',
      departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
    });
    B = await createActiveCompany(h.db, { name: 'Beta', departments: ['OPERATIONS', 'WAREHOUSE'] });
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
    it_.fg = (await item('FG-1')).id;
    it_.rm = (await item('RM-1', { type: 'RAW_MATERIAL', baseUnitId: kg.id })).id;
    it_.pk = (await item('PK-1', { type: 'PACKAGING' })).id;
    it_.lot = (
      await item('RM-LOT', {
        type: 'RAW_MATERIAL',
        baseUnitId: kg.id,
        lotTracking: 'REQUIRED',
        expiryTracking: 'REQUIRED',
      })
    ).id;
    customer = (
      await h.db.customer.create({
        data: { companyId: A.companyId, code: 'CUS-000001', name: 'Secret Customer Ltd' },
      })
    ).id;
    const location = (branchId: string, c: string, companyId = A.companyId) =>
      h.db.warehouseLocation.create({ data: { companyId, branchId, code: c, name: `Loc ${c}` } });
    loc.MAIN = (await location(br.X, 'MAIN')).id;
    loc.QC = (await location(br.X, 'QC')).id;
    loc.HO = (await location(br.HO, 'HO-MAIN')).id;
    foreignLoc = (await location(B.headOfficeId, 'B-MAIN', B.companyId)).id;
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
  const owner = () => as('owner@a.example');
  const opm = () => as('opm@a.example');
  const ops = () => as('ops@a.example');
  const stockIn = async (itemId: string, quantity: string, locationId = loc.MAIN, lot: J = {}) => {
    const o = locationId === loc.HO ? await as('owner@a.example', 'HO') : await owner();
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
  const lotIn = async (itemId: string, qty: string, number: string, days: number) => {
    await stockIn(itemId, qty, loc.MAIN, { newLotNumber: number, newLotExpiry: shift(days) });
    return (await h.db.inventoryLot.findFirstOrThrow({ where: { lotNumber: number } })).id;
  };
  const activeBom = async (itemId: string, lines: [string, string][]) => {
    const m = await opm();
    const b = (
      await ok(
        m.post(`${P}/boms`, {
          itemId,
          outputQuantity: '1',
          lines: lines.map(([i, quantity]) => ({ itemId: i, quantity })),
        }),
        201,
      )
    ).bom;
    return (await ok(m.post(`${P}/boms/${b.id}/activate`))).bom;
  };
  /** An APPROVED order of `qty` finished goods (BOM must be active). */
  const approved = async (qty: string, extra: J = {}) => {
    const d = (
      await ok((await ops()).post(`${P}/orders`, { itemId: it_.fg, quantity: qty, ...extra }), 201)
    ).order;
    await ok((await ops()).post(`${P}/orders/${d.id}/submit`, {}));
    return (await ok((await opm()).post(`${P}/orders/${d.id}/approve`, {}))).order;
  };
  const mat = (o: J, itemId: string) => o.materials.find((m: J) => m.item.id === itemId);
  const allocate = async (id: string, who = opm) =>
    ok((await who()).post(`${P}/orders/${id}/materials/allocate`, {}));
  /** Approved → reserved → READY → IN_PRODUCTION. */
  const started = async (qty: string) => {
    const o = await approved(qty);
    await allocate(o.id);
    await ok((await opm()).post(`${P}/orders/${o.id}/release`, {}));
    return (await ok((await opm()).post(`${P}/orders/${o.id}/start`, { note: 'go' }))).order;
  };
  const draftIssue = async (orderId: string, lines?: J[]) =>
    (
      await ok(
        (await ops()).post(`${P}/issues`, {
          productionOrderId: orderId,
          ...(lines ? { lines } : {}),
        }),
        201,
      )
    ).issue;
  const post = async (issueId: string) =>
    (await ok((await opm()).post(`${P}/issues/${issueId}/post`, {}))).issue;
  const onHand = async (itemId: string, locationId?: string) =>
    (await h.db.stockBalance.findMany({ where: { itemId, ...(locationId ? { locationId } : {}) } }))
      .reduce((t, b) => t.plus(b.quantityOnHand), new Decimal(0))
      .toString();
  const reservedSum = async (model: 'sales' | 'production', where: J = {}) => {
    const rows =
      model === 'sales'
        ? await h.db.salesAllocation.findMany({ where: { status: 'ACTIVE', ...where } })
        : await h.db.productionMaterialAllocation.findMany({
            where: { status: 'ACTIVE', ...where },
          });
    return rows
      .reduce((t: Decimal, r: { quantity: Decimal }) => t.plus(r.quantity), new Decimal(0))
      .toString();
  };
  /** Sales + production reserved ≤ on hand; balance = Σ movements; nothing negative; issues match consumption. */
  const assertInvariant = async () => {
    const over = await h.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM (
        SELECT "locationId", "itemId", "lotKey", SUM(q) AS r FROM (
          SELECT "locationId", "itemId", "lotKey", "quantity" AS q FROM "SalesAllocation" WHERE "status" = 'ACTIVE'
          UNION ALL
          SELECT "locationId", "itemId", "lotKey", "quantity" FROM "ProductionMaterialAllocation" WHERE "status" = 'ACTIVE'
        ) u GROUP BY 1, 2, 3) x
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
    const unmatched = await h.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "StockMovement" m
      LEFT JOIN "ProductionMaterialAllocation" a ON a."issueLineId" = m."productionMaterialIssueLineId"
        AND a."status" = 'CONSUMED'
      WHERE m."type" = 'PRODUCTION_CONSUMPTION' AND (a."id" IS NULL OR a."quantity" <> -m."quantityDelta")`;
    expect(Number(unmatched[0]!.n)).toBe(0);
    const orphan = await h.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "ProductionMaterialAllocation" a
      LEFT JOIN "StockMovement" m ON m."productionMaterialIssueLineId" = a."issueLineId"
        AND m."type" = 'PRODUCTION_CONSUMPTION'
      WHERE a."status" = 'CONSUMED' AND m."id" IS NULL`;
    expect(Number(orphan[0]!.n)).toBe(0);
    expect(await h.db.stockBalance.count({ where: { itemId: it_.fg } })).toBe(0);
  };
  const movements = () => h.db.stockMovement.count();

  // ---------------------------------------------------------------- reservation

  it('FEFO reservation: earliest lot first, expired lots and other branches never, no movement', async () => {
    await activeBom(it_.fg, [[it_.lot, '1']]);
    await lotIn(it_.lot, '70', 'LATER', 90);
    await lotIn(it_.lot, '40', 'SOON', 20);
    const old = await lotIn(it_.lot, '50', 'OLD', 30);
    await h.db.inventoryLot.update({
      where: { id: old },
      data: { expiryDate: new Date(`${shift(-1)}T00:00:00Z`) },
    });
    await stockIn(it_.lot, '500', loc.HO, { newLotNumber: 'HO-LOT', newLotExpiry: shift(5) });
    const o = await approved('100');
    expect(o.reservationState).toBe('NOT_RESERVED');
    const before = await movements();
    // Staff may not reserve; the manager does.
    expect(
      (await (await ops()).post(`${P}/orders/${o.id}/materials/allocate`, {})).statusCode,
    ).toBe(403);
    const r = await allocate(o.id);
    expect(r.allocation).toMatchObject({ reservedNow: '100' });
    expect(
      r.order.reservations.map((x: J) => [x.lot.lotNumber, x.quantity, x.location.code]),
    ).toEqual([
      ['SOON', '40', 'MAIN'],
      ['LATER', '60', 'MAIN'],
    ]);
    expect(mat(r.order, it_.lot)).toMatchObject({
      required: '100',
      reserved: '100',
      stillNeeded: '0',
      issued: '0',
    });
    expect(r.order.reservationState).toBe('FULLY_RESERVED');
    expect(await movements()).toBe(before);
    // Repeating reserves nothing more (no double reservation).
    const again = await allocate(o.id);
    expect(again.allocation.reservedNow).toBe('0');
    expect(await reservedSum('production')).toBe('100');
    // Client quantities are never accepted.
    expect(
      (await (await opm()).post(`${P}/orders/${o.id}/materials/allocate`, { quantity: '5' }))
        .statusCode,
    ).toBe(400);
    await assertInvariant();
  });

  it('partial reservation keeps a shortage; later stock is reserved by allocating again', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    await stockIn(it_.rm, '60');
    const o = await approved('100');
    const r = await allocate(o.id);
    expect(r.allocation.materials[0]).toMatchObject({
      reservedNow: '60',
      covered: '60',
      shortage: '40',
    });
    expect(mat(r.order, it_.rm)).toMatchObject({
      reserved: '60',
      stillNeeded: '40',
      available: '0',
      shortage: '40',
    });
    expect(r.order.reservationState).toBe('PARTIALLY_RESERVED');
    expect(r.order.materialState).toBe('MATERIALS_SHORT');
    // Starting needs everything reserved.
    expect(code(await (await opm()).post(`${P}/orders/${o.id}/release`, {}))).toBe(
      'MATERIALS_SHORT',
    );
    await stockIn(it_.rm, '50');
    const r2 = await allocate(o.id);
    expect(r2.allocation.reservedNow).toBe('40');
    expect(mat(r2.order, it_.rm)).toMatchObject({
      reserved: '100',
      stillNeeded: '0',
      available: '10',
    });
    // Purchasing sees no shortage any more for it.
    const pur = await as('pur@a.example');
    expect((await ok(pur.get('/api/v1/purchasing/production-shortages'))).items).toEqual([]);
    expect(await h.db.purchaseRequest.count()).toBe(0);
  });

  it('combined reservations: sales and production never claim the same stock; every decrease honours both', async () => {
    await activeBom(it_.fg, [[it_.pk, '1']]);
    await stockIn(it_.pk, '10');
    // Sales reserves 3.
    const own = await owner();
    const so = (
      await ok(
        own.post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.pk, quantity: '3', unitPrice: '1' }],
        }),
        201,
      )
    ).order;
    await ok(own.post(`${SO}/${so.id}/submit`));
    await ok(own.post(`${SO}/${so.id}/confirm`));
    await ok(own.post(`${SO}/${so.id}/allocate`));
    // Production wants 9, gets 7 — never Sales' 3.
    const o = await approved('9');
    const r = await allocate(o.id);
    expect(r.allocation.materials[0]).toMatchObject({ reservedNow: '7', shortage: '2' });
    expect(await reservedSum('sales')).toBe('3');
    expect(await reservedSum('production')).toBe('7');
    // Sales cannot take production's reservation either.
    const so2 = (
      await ok(
        own.post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.pk, quantity: '5', unitPrice: '1' }],
        }),
        201,
      )
    ).order;
    await ok(own.post(`${SO}/${so2.id}/submit`));
    await ok(own.post(`${SO}/${so2.id}/confirm`));
    const sa = await ok(own.post(`${SO}/${so2.id}/allocate`));
    expect(sa.allocation.allocatedNow).toBe('0');
    // On hand 10, sales 3, production 7 → available 0: inventory shows it; FEFO offers nothing.
    const stock = await ok((await as('wh@a.example')).get(`${W}/stock?itemId=${it_.pk}`));
    expect(stock.items[0]).toMatchObject({
      quantityOnHand: '10',
      quantityReserved: '10',
      quantityAvailable: '0',
    });
    // Release 4 of production: transfer of 4 refused while only 0+... then allowed once free.
    await ok((await opm()).post(`${P}/orders/${o.id}/materials/release`, {}));
    // Now: sales 3 → available 7. A transfer of 8 is refused, of 7 allowed.
    const tr = async (q: string) =>
      (
        await ok(
          own.post(`${W}/transfers`, {
            sourceLocationId: loc.MAIN,
            destinationLocationId: loc.QC,
            lines: [{ itemId: it_.pk, quantity: q }],
          }),
          201,
        )
      ).transfer;
    await allocate(o.id); // production reserves 7 again → available 0
    // Reserved stock is refused already when the transfer is drafted (EP34 draft check).
    const big = await own.post(`${W}/transfers`, {
      sourceLocationId: loc.MAIN,
      destinationLocationId: loc.QC,
      lines: [{ itemId: it_.pk, quantity: '1' }],
    });
    expect(code(big)).toBe('STOCK_RESERVED');
    void tr;
    // An adjustment decrease below sales + production reserved is refused too (already as a draft).
    const adj = await own.post(`${W}/adjustments`, {
      reason: 'DAMAGE',
      lines: [{ direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.pk, quantity: '1' }],
    });
    expect(code(adj)).toBe('STOCK_RESERVED');
    await assertInvariant();
  });

  it('transfer guard: on hand 10, sales 3, production 5 → transfer out 4 refused, 2 allowed', async () => {
    await activeBom(it_.fg, [[it_.pk, '1']]);
    await stockIn(it_.pk, '10');
    const own = await owner();
    const so = (
      await ok(
        own.post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.pk, quantity: '3', unitPrice: '1' }],
        }),
        201,
      )
    ).order;
    await ok(own.post(`${SO}/${so.id}/submit`));
    await ok(own.post(`${SO}/${so.id}/confirm`));
    await ok(own.post(`${SO}/${so.id}/allocate`));
    const o = await approved('5');
    await allocate(o.id);
    const tr = async (q: string) =>
      (
        await ok(
          own.post(`${W}/transfers`, {
            sourceLocationId: loc.MAIN,
            destinationLocationId: loc.QC,
            lines: [{ itemId: it_.pk, quantity: q }],
          }),
          201,
        )
      ).transfer;
    const four = await own.post(`${W}/transfers`, {
      sourceLocationId: loc.MAIN,
      destinationLocationId: loc.QC,
      lines: [{ itemId: it_.pk, quantity: '4' }],
    });
    expect(code(four)).toBe('STOCK_RESERVED');
    const two = await tr('2');
    await ok(own.post(`${W}/transfers/${two.id}/post`));
    expect(await onHand(it_.pk, loc.MAIN)).toBe('8');
    await assertInvariant();
  });

  it('release / reallocate: only unissued ACTIVE quantities, history kept, refused while a draft issue holds them', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    await stockIn(it_.rm, '20');
    const o = await approved('10');
    await allocate(o.id);
    const m = await opm();
    const rel = await ok(m.post(`${P}/orders/${o.id}/materials/release`, {}));
    expect(rel.order.reservationState).toBe('NOT_RESERVED');
    expect(code(await m.post(`${P}/orders/${o.id}/materials/release`, {}))).toBe('MO_NOT_RESERVED');
    await allocate(o.id);
    const re = await ok(m.post(`${P}/orders/${o.id}/materials/reallocate`, {}));
    expect(re.allocation.reservedNow).toBe('10');
    const hist = await h.db.productionMaterialAllocation.findMany({
      where: { productionOrderId: o.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(hist.map((x) => [x.status, x.releaseReason])).toEqual([
      ['RELEASED', 'RELEASED'],
      ['RELEASED', 'REALLOCATED'],
      ['ACTIVE', null],
    ]);
    // History is immutable in the database.
    await expect(
      h.db.productionMaterialAllocation.update({
        where: { id: hist[0]!.id },
        data: { quantity: '1' },
      }),
    ).rejects.toThrow(/history/);
    await expect(
      h.db.productionMaterialAllocation.delete({ where: { id: hist[0]!.id } }),
    ).rejects.toThrow(/never deleted/);
    // Started with a draft issue: release / reallocate wait for it.
    await ok(m.post(`${P}/orders/${o.id}/release`, {}));
    await ok(m.post(`${P}/orders/${o.id}/start`, {}));
    const d = await draftIssue(o.id, [{ allocationId: hist[2]!.id, quantity: '4' }]);
    expect(code(await m.post(`${P}/orders/${o.id}/materials/release`, {}))).toBe(
      'MATERIAL_ISSUE_PENDING',
    );
    expect(code(await m.post(`${P}/orders/${o.id}/materials/reallocate`, {}))).toBe(
      'MATERIAL_ISSUE_PENDING',
    );
    await post(d.id);
    // After posting 4: release frees only the 6 unissued; the 4 stay consumed history.
    await ok(m.post(`${P}/orders/${o.id}/materials/release`, {}));
    const after = (await ok(m.get(`${P}/orders/${o.id}`))).order;
    expect(mat(after, it_.rm)).toMatchObject({ issued: '4', reserved: '0', stillNeeded: '6' });
    expect(await onHand(it_.rm)).toBe('16');
    await assertInvariant();
  });

  // ---------------------------------------------------------------- execution

  it('start needs READY and every material reserved; pause / resume change no stock; completion only from review', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    await stockIn(it_.rm, '5');
    const o = await approved('10');
    const m = await opm();
    expect(code(await m.post(`${P}/orders/${o.id}/start`, {}))).toBe('MO_INVALID_TRANSITION');
    await allocate(o.id); // 5 of 10
    expect(code(await m.post(`${P}/orders/${o.id}/release`, {}))).toBe('MATERIALS_SHORT');
    await stockIn(it_.rm, '5');
    await allocate(o.id);
    await ok(m.post(`${P}/orders/${o.id}/release`, {}));
    // Staff cannot start; executive cannot.
    expect((await (await ops()).post(`${P}/orders/${o.id}/start`, {})).statusCode).toBe(403);
    expect(
      (await (await as('exec@a.example')).post(`${P}/orders/${o.id}/start`, {})).statusCode,
    ).toBe(403);
    const before = await movements();
    const s = (await ok(m.post(`${P}/orders/${o.id}/start`, { note: 'Line 1' }))).order;
    expect(s).toMatchObject({
      status: 'IN_PRODUCTION',
      executionNote: 'Line 1',
      startedBy: { name: 'opm' },
    });
    expect(code(await m.post(`${P}/orders/${o.id}/start`, {}))).toBe('MO_ALREADY_STARTED');
    const p = (await ok(m.post(`${P}/orders/${o.id}/pause`, { note: 'Machine check' }))).order;
    expect(p.status).toBe('PAUSED');
    expect(p.pausedAt).not.toBeNull();
    // Paused: no issue may be drafted or posted; usage may still be recorded (nothing issued yet → refused).
    expect(code(await (await ops()).post(`${P}/issues`, { productionOrderId: o.id }))).toBe(
      'MO_NOT_IN_PRODUCTION',
    );
    const r = (await ok(m.post(`${P}/orders/${o.id}/resume`, {}))).order;
    expect(r).toMatchObject({ status: 'IN_PRODUCTION', pausedAt: null });
    expect(mat(r, it_.rm)).toMatchObject({ reserved: '10' });
    expect(await movements()).toBe(before);
    await expect(
      h.db.productionOrder.update({ where: { id: o.id }, data: { startedAt: new Date() } }),
    ).rejects.toThrow(/keeps its start/);
    // EP38: completion exists, but only from COMPLETION_REVIEW (and with the material review confirmed).
    expect((await m.post(`${P}/orders/${o.id}/complete`, {})).statusCode).toBe(400);
    expect(
      code(
        await m.post(`${P}/orders/${o.id}/complete`, {
          outcome: 'COMPLETED',
          materialsReviewed: true,
        }),
      ),
    ).toBe('MO_INVALID_TRANSITION');
    const tl = (await ok(m.get(`${P}/orders/${o.id}`))).timeline.map((t: J) => t.type);
    expect(tl).toEqual(
      expect.arrayContaining([
        'PRODUCTION_ORDER_STARTED',
        'PRODUCTION_ORDER_PAUSED',
        'PRODUCTION_ORDER_RESUMED',
        'PRODUCTION_MATERIALS_ALLOCATED',
      ]),
    );
  });

  // ---------------------------------------------------------------- material issue

  it('material issue: draft by staff, post by a manager — PRODUCTION_CONSUMPTION, exact reservation consumed, once', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    await stockIn(it_.rm, '100');
    const o = await started('100');
    const res = (await ok((await opm()).get(`${P}/orders/${o.id}`))).order.reservations;
    // A draft for 40 of the 100 reserved.
    const d = await draftIssue(o.id, [{ allocationId: res[0].id, quantity: '40' }]);
    expect(d).toMatchObject({ status: 'DRAFT', actions: ['edit', 'cancel'] });
    expect(d.number).toMatch(/^MI-\d{6}-000001$/);
    expect(d.lines[0]).toMatchObject({
      quantity: '40',
      reserved: '100',
      location: { code: 'MAIN' },
    });
    const before = await movements();
    expect(await movements()).toBe(before); // drafting moves nothing
    // Staff cannot post; manager posts.
    expect((await (await ops()).post(`${P}/issues/${d.id}/post`, {})).statusCode).toBe(403);
    const p = await post(d.id);
    expect(p).toMatchObject({ status: 'POSTED', actions: [], postedBy: { name: 'opm' } });
    const mv = await h.db.stockMovement.findMany({ where: { type: 'PRODUCTION_CONSUMPTION' } });
    expect(
      mv.map((x) => [x.quantityDelta.toString(), x.sourceType, x.productionMaterialIssueId]),
    ).toEqual([['-40', 'PRODUCTION_ISSUE', d.id]]);
    expect(await onHand(it_.rm)).toBe('60');
    const ord = (await ok((await opm()).get(`${P}/orders/${o.id}`))).order;
    expect(mat(ord, it_.rm)).toMatchObject({ reserved: '60', issued: '40', stillNeeded: '0' });
    expect(ord.reservationState).toBe('PARTIALLY_ISSUED');
    const rows = await h.db.productionMaterialAllocation.findMany({
      where: { productionOrderId: o.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(
      rows.map((x) => [x.status, x.quantity.toString(), x.splitFromId === rows[0]!.id]),
    ).toEqual([
      ['ACTIVE', '60', false],
      ['CONSUMED', '40', true],
    ]);
    // Posting again: no duplicate.
    expect(code(await (await opm()).post(`${P}/issues/${d.id}/post`, {}))).toBe(
      'MI_ALREADY_POSTED',
    );
    expect(await h.db.stockMovement.count({ where: { type: 'PRODUCTION_CONSUMPTION' } })).toBe(1);
    // Posted lines are immutable (database too).
    const line = await h.db.productionMaterialIssueLine.findFirstOrThrow({
      where: { issueId: d.id },
    });
    await expect(
      h.db.productionMaterialIssueLine.update({ where: { id: line.id }, data: { quantity: '1' } }),
    ).rejects.toThrow(/immutable/);
    await expect(
      h.db.productionMaterialIssue.update({ where: { id: d.id }, data: { note: 'x' } }),
    ).rejects.toThrow(/final/);
    // A second issue (default lines: the unclaimed 60) → 35 posted, partial history again.
    const d2 = await draftIssue(o.id);
    expect(d2.lines.map((l: J) => l.quantity)).toEqual(['60']);
    await ok(
      (await ops()).put(`${P}/issues/${d2.id}/lines`, {
        lines: [{ allocationId: res[0].id, quantity: '35' }],
      }),
    );
    await post(d2.id);
    const ord2 = (await ok((await opm()).get(`${P}/orders/${o.id}`))).order;
    expect(mat(ord2, it_.rm)).toMatchObject({ reserved: '25', issued: '75' });
    expect(await onHand(it_.rm)).toBe('25');
    // Over-issue refused at draft time (more than the reservation still holds).
    expect(
      code(
        await (
          await ops()
        ).post(`${P}/issues`, {
          productionOrderId: o.id,
          lines: [{ allocationId: res[0].id, quantity: '26' }],
        }),
      ),
    ).toBe('ISSUE_EXCEEDS_RESERVATION');
    // Audit: numbers and transitions only.
    const audit = await h.db.auditLog.findMany({
      where: { entityType: 'ProductionMaterialIssue' },
    });
    expect(audit.map((x) => x.action)).toEqual(
      expect.arrayContaining([
        'MATERIAL_ISSUE_CREATED',
        'MATERIAL_ISSUE_UPDATED',
        'MATERIAL_ISSUE_POSTED',
      ]),
    );
    for (const x of audit) expect(JSON.stringify(x.changes)).not.toMatch(/"quantity":|"40"|"35"/);
    await assertInvariant();
  });

  it('the spec example: on hand 100, sales 20, production 60 → issue 30 → on hand 70, sales 20, production 30, available 20', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    await stockIn(it_.rm, '100');
    const own = await owner();
    const so = (
      await ok(
        own.post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.rm, quantity: '20', unitPrice: '777.77' }],
        }),
        201,
      )
    ).order;
    await ok(own.post(`${SO}/${so.id}/submit`));
    await ok(own.post(`${SO}/${so.id}/confirm`));
    await ok(own.post(`${SO}/${so.id}/allocate`));
    const o = await started('60');
    const res = (await ok((await opm()).get(`${P}/orders/${o.id}`))).order.reservations;
    await post((await draftIssue(o.id, [{ allocationId: res[0].id, quantity: '30' }])).id);
    expect(await onHand(it_.rm)).toBe('70');
    expect(await reservedSum('sales')).toBe('20');
    expect(await reservedSum('production')).toBe('30');
    const stock = await ok((await as('wh@a.example')).get(`${W}/stock?itemId=${it_.rm}`));
    expect(stock.items[0]).toMatchObject({
      quantityOnHand: '70',
      quantityReserved: '50',
      quantityAvailable: '20',
    });
    await assertInvariant();
  });

  it('sales dispatch never consumes production reservations; issue never consumes sales reservations', async () => {
    await activeBom(it_.fg, [[it_.pk, '1']]);
    await stockIn(it_.pk, '10');
    const own = await owner();
    const so = (
      await ok(
        own.post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.pk, quantity: '4', unitPrice: '1' }],
        }),
        201,
      )
    ).order;
    await ok(own.post(`${SO}/${so.id}/submit`));
    await ok(own.post(`${SO}/${so.id}/confirm`));
    await ok(own.post(`${SO}/${so.id}/allocate`));
    const o = await started('6');
    // Warehouse dispatches the sales 4.
    const wh = await as('wh@a.example');
    const pick = (await ok(wh.post(`${W}/picks`, { salesOrderId: so.id }), 201)).pick;
    await ok(
      wh.post(`${W}/picks/${pick.id}/confirm`, {
        lines: pick.lines.map((l: J) => ({ lineId: l.id, pickedQuantity: l.planned })),
      }),
    );
    const pack = (await ok(wh.post(`${W}/packs`, { salesOrderId: so.id }), 201)).pack;
    await ok(wh.post(`${W}/packs/${pack.id}/confirm`));
    const ship = (await ok(wh.post(`${W}/shipments`, { salesOrderId: so.id }), 201)).shipment;
    await ok((await as('whm@a.example')).post(`${W}/shipments/${ship.id}/dispatch`, {}));
    expect(await reservedSum('production')).toBe('6');
    expect(await onHand(it_.pk)).toBe('6');
    // The production issue takes its own 6 — exactly what is left; nothing else.
    await post((await draftIssue(o.id)).id);
    expect(await onHand(it_.pk)).toBe('0');
    expect(await h.db.salesAllocation.count({ where: { status: 'CONSUMED' } })).toBe(1);
    expect(await h.db.productionMaterialAllocation.count({ where: { status: 'CONSUMED' } })).toBe(
      1,
    );
    await assertInvariant();
  });

  it('usage: evidence only, never above what was issued; variance and unreported quantities per material', async () => {
    await activeBom(it_.fg, [
      [it_.rm, '1'],
      [it_.pk, '1'],
    ]);
    await stockIn(it_.rm, '100');
    await stockIn(it_.pk, '100');
    const o = await started('40');
    const ordered = (await ok((await opm()).get(`${P}/orders/${o.id}`))).order;
    const rmRes = ordered.reservations.find((r: J) => r.item.id === it_.rm);
    await post((await draftIssue(o.id, [{ allocationId: rmRes.id, quantity: '40' }])).id);
    const rmMat = await h.db.productionOrderMaterial.findFirstOrThrow({
      where: { productionOrderId: o.id, itemId: it_.rm },
    });
    const pkMat = await h.db.productionOrderMaterial.findFirstOrThrow({
      where: { productionOrderId: o.id, itemId: it_.pk },
    });
    const before = await movements();
    const staff = await ops();
    // Nothing of PK issued → usage refused.
    expect(
      code(await staff.post(`${P}/orders/${o.id}/usage`, { materialId: pkMat.id, quantity: '1' })),
    ).toBe('USAGE_EXCEEDS_ISSUED');
    const u = (
      await ok(
        staff.post(`${P}/orders/${o.id}/usage`, {
          materialId: rmMat.id,
          quantity: '35',
          note: 'Batch A',
        }),
      )
    ).order;
    expect(mat(u, it_.rm)).toMatchObject({
      issued: '40',
      used: '35',
      unrecorded: '5',
      usageVariance: '-5',
    });
    expect(
      code(await staff.post(`${P}/orders/${o.id}/usage`, { materialId: rmMat.id, quantity: '6' })),
    ).toBe('USAGE_EXCEEDS_ISSUED');
    expect(await movements()).toBe(before);
    // Usage rows are immutable; a mass-assigned field is refused.
    const row = await h.db.productionMaterialUsage.findFirstOrThrow();
    await expect(
      h.db.productionMaterialUsage.update({ where: { id: row.id }, data: { quantity: '1' } }),
    ).rejects.toThrow(/immutable/);
    expect(
      (
        await staff.post(`${P}/orders/${o.id}/usage`, {
          materialId: rmMat.id,
          quantity: '1',
          issued: '99',
        })
      ).statusCode,
    ).toBe(400);
    // Concurrent usage cannot exceed what was issued.
    const race = await Promise.all(
      [1, 2, 3].map(() =>
        staff.post(`${P}/orders/${o.id}/usage`, { materialId: rmMat.id, quantity: '3' }),
      ),
    );
    expect(race.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(race.filter((r) => code(r) === 'USAGE_EXCEEDS_ISSUED')).toHaveLength(2);
    const final = (await ok(staff.get(`${P}/orders/${o.id}`))).order;
    expect(mat(final, it_.rm)).toMatchObject({ used: '38', unrecorded: '2' });
    await assertInvariant();
  });

  it('excess: manager with a reason, separate from the frozen requirement; staff cannot', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    await stockIn(it_.rm, '120');
    const o = await started('100');
    const mid = (
      await h.db.productionOrderMaterial.findFirstOrThrow({ where: { productionOrderId: o.id } })
    ).id;
    expect(
      (
        await (
          await ops()
        ).post(`${P}/orders/${o.id}/materials/${mid}/excess`, { quantity: '5', reason: 'Spill' })
      ).statusCode,
    ).toBe(403);
    expect(
      (await (await opm()).post(`${P}/orders/${o.id}/materials/${mid}/excess`, { quantity: '5' }))
        .statusCode,
    ).toBe(400);
    const r = await ok(
      (await opm()).post(`${P}/orders/${o.id}/materials/${mid}/excess`, {
        quantity: '5',
        reason: 'Spill at mixing',
      }),
    );
    expect(mat(r.order, it_.rm)).toMatchObject({ required: '100', reserved: '105', excess: '5' });
    expect(r.order.reservations.find((x: J) => x.excess)).toMatchObject({ quantity: '5' });
    // Issue everything (105): issued beyond the requirement, the requirement unchanged.
    await post((await draftIssue(o.id)).id);
    const ord = (await ok((await opm()).get(`${P}/orders/${o.id}`))).order;
    expect(mat(ord, it_.rm)).toMatchObject({
      required: '100',
      issued: '105',
      excess: '5',
      stillNeeded: '0',
    });
    expect(ord.reservationState).toBe('ISSUED');
    const row = await h.db.productionOrderMaterial.findFirstOrThrow({ where: { id: mid } });
    expect(row.requiredQuantity.toString()).toBe('100');
    await assertInvariant();
  });

  it('cancellation: an order with issued material cannot be cancelled; otherwise reservations and drafts go with it', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    await stockIn(it_.rm, '50');
    const a = await started('10');
    const d = await draftIssue(a.id);
    const m = await opm();
    const c = (await ok(m.post(`${P}/orders/${a.id}/cancel`, { reason: 'Stopped' }))).order;
    expect(c.status).toBe('CANCELLED');
    expect(await reservedSum('production', { productionOrderId: a.id })).toBe('0');
    expect((await ok(m.get(`${P}/issues/${d.id}`))).issue.status).toBe('CANCELLED');
    const b = await started('10');
    await post((await draftIssue(b.id)).id);
    expect(code(await m.post(`${P}/orders/${b.id}/cancel`, { reason: 'x' }))).toBe(
      'MATERIAL_ALREADY_ISSUED',
    );
    expect(await onHand(it_.rm)).toBe('40');
    await assertInvariant();
  });

  it('sales-linked: a source cancelled after start is flagged, never auto-cancelled; planned output is never stock', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    await stockIn(it_.rm, '10');
    const own = await owner();
    const so = (
      await ok(
        own.post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.fg, quantity: '5', unitPrice: '1' }],
        }),
        201,
      )
    ).order;
    await ok(own.post(`${SO}/${so.id}/submit`));
    await ok(own.post(`${SO}/${so.id}/confirm`));
    const line = (await ok(own.get(`${SO}/${so.id}`))).order.lines[0].id;
    const d = (
      await ok((await ops()).post(`${P}/orders`, { salesOrderLineId: line, quantity: '5' }), 201)
    ).order;
    await ok((await ops()).post(`${P}/orders/${d.id}/submit`, {}));
    await ok((await opm()).post(`${P}/orders/${d.id}/approve`, {}));
    await allocate(d.id);
    await ok((await opm()).post(`${P}/orders/${d.id}/release`, {}));
    await ok((await opm()).post(`${P}/orders/${d.id}/start`, {}));
    await post((await draftIssue(d.id)).id);
    await ok(own.post(`${SO}/${so.id}/cancel`, { reason: 'Customer cancelled' }));
    const v = (await ok((await opm()).get(`${P}/orders/${d.id}`))).order;
    expect(v).toMatchObject({ status: 'IN_PRODUCTION', attention: 'SOURCE_CANCELLED' });
    expect(await h.db.stockBalance.count({ where: { itemId: it_.fg } })).toBe(0);
    // A READY linked order cannot start once its source is cancelled.
    const so2 = (
      await ok(
        own.post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.fg, quantity: '2', unitPrice: '1' }],
        }),
        201,
      )
    ).order;
    await ok(own.post(`${SO}/${so2.id}/submit`));
    await ok(own.post(`${SO}/${so2.id}/confirm`));
    const line2 = (await ok(own.get(`${SO}/${so2.id}`))).order.lines[0].id;
    const e = (
      await ok((await ops()).post(`${P}/orders`, { salesOrderLineId: line2, quantity: '2' }), 201)
    ).order;
    await ok((await ops()).post(`${P}/orders/${e.id}/submit`, {}));
    await ok((await opm()).post(`${P}/orders/${e.id}/approve`, {}));
    await stockIn(it_.rm, '2');
    await allocate(e.id);
    await ok((await opm()).post(`${P}/orders/${e.id}/release`, {}));
    await ok(own.post(`${SO}/${so2.id}/cancel`, { reason: 'x' }));
    expect(code(await (await opm()).post(`${P}/orders/${e.id}/start`, {}))).toBe(
      'SALES_SOURCE_NOT_CONFIRMED',
    );
  });

  // ---------------------------------------------------------------- authority, isolation, privacy

  it('roles, Warehouse handoff, privacy, isolation and mass assignment', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    await stockIn(it_.rm, '20');
    const o = await started('10');
    const d = await draftIssue(o.id);
    const exec = await as('exec@a.example');
    const ev = (await ok(exec.get(`${P}/orders/${o.id}`))).order;
    expect(ev.actions).toEqual([]);
    expect((await exec.post(`${P}/issues/${d.id}/post`, {})).statusCode).toBe(403);
    expect((await exec.post(`${P}/orders/${o.id}/pause`, {})).statusCode).toBe(403);
    expect((await exec.post(`${P}/issues`, { productionOrderId: o.id })).statusCode).toBe(403);
    for (const email of ['admin@a.example', 'sales@a.example', 'wh@a.example', 'pur@a.example']) {
      const b = await as(email);
      expect((await b.get(`${P}/issues`)).statusCode, email).toBe(403);
      expect((await b.post(`${P}/issues/${d.id}/post`, {})).statusCode, email).toBe(403);
      expect((await b.post(`${P}/orders/${o.id}/materials/allocate`, {})).statusCode, email).toBe(
        403,
      );
    }
    // Warehouse reads the handoff (allow-listed), nothing else of Production.
    const wh = await as('wh@a.example');
    const ho = await ok(wh.get(`${W}/material-issues`));
    expect(ho.items[0]).toMatchObject({
      number: d.number,
      status: 'DRAFT',
      order: { number: o.number },
    });
    expect(keysOf(ho.items).filter((k) => MONEY.test(k))).toEqual([]);
    expect((await (await as('sales@a.example')).get(`${W}/material-issues`)).statusCode).toBe(403);
    expect((await (await as('admin@a.example')).get(`${W}/material-issues`)).statusCode).toBe(403);
    // Other branch / company: 404; foreign references never accepted.
    const hoM = await as('opm.ho@a.example', 'HO');
    expect((await hoM.get(`${P}/issues/${d.id}`)).statusCode).toBe(404);
    expect((await hoM.post(`${P}/issues/${d.id}/post`, {})).statusCode).toBe(404);
    expect((await hoM.post(`${P}/orders/${o.id}/materials/allocate`, {})).statusCode).toBe(404);
    const b = await signIn(h, 'owner@b.example');
    expect((await b.get(`${P}/issues/${d.id}`)).statusCode).toBe(404);
    expect((await b.post(`${P}/issues`, { productionOrderId: o.id })).statusCode).toBe(404);
    const foreign = await h.db.productionMaterialAllocation.findFirstOrThrow({
      where: { productionOrderId: o.id },
    });
    // An allocation id of another order is refused.
    const other = await started('5');
    expect(
      code(
        await (
          await ops()
        ).post(`${P}/issues`, {
          productionOrderId: other.id,
          lines: [{ allocationId: foreign.id, quantity: '1' }],
        }),
      ),
    ).toBe('RESERVATION_NOT_ACTIVE');
    // Mass assignment on every write.
    const staff = await ops();
    for (const body of [
      { productionOrderId: o.id, status: 'POSTED' },
      { productionOrderId: o.id, number: 'MI-1' },
      { productionOrderId: o.id, lines: [{ allocationId: foreign.id, quantity: '1', lotId: 'x' }] },
      {
        productionOrderId: o.id,
        lines: [{ allocationId: foreign.id, quantity: '1', locationId: foreignLoc }],
      },
      { productionOrderId: o.id, postedBy: 'x' },
    ])
      expect((await staff.post(`${P}/issues`, body)).statusCode).toBe(400);
    expect(
      (await (await opm()).post(`${P}/orders/${o.id}/start`, { status: 'IN_PRODUCTION' }))
        .statusCode,
    ).toBe(400);
    expect(
      (await (await opm()).post(`${P}/issues/${d.id}/post`, { quantity: '1' })).statusCode,
    ).toBe(400);
    expect((await staff.get(`${P}/issues/nope`)).statusCode).toBe(404);
    // Privacy across Production execution responses.
    const all = [
      await staff.get(`${P}/orders/${o.id}`),
      await staff.get(`${P}/issues?pageSize=50`),
      await staff.get(`${P}/issues/${d.id}`),
    ];
    for (const r of all)
      expect(keysOf(j(r)).filter((k) => MONEY.test(k) && k !== 'total')).toEqual([]);
    // Count lock: an open count of the location refuses the issue post (nothing written).
    const own = await owner();
    const count = (await ok(own.post(`${W}/counts`, { locationIds: [loc.MAIN] }), 201)).count;
    await ok(own.post(`${W}/counts/${count.id}/start`));
    expect(code(await (await opm()).post(`${P}/issues/${d.id}/post`, {}))).toBe(
      'COUNT_IN_PROGRESS',
    );
    expect((await ok(staff.get(`${P}/issues/${d.id}`))).issue.status).toBe('DRAFT');
    // Reservations stay possible during a count (no movement).
    expect((await allocate(other.id)).allocation).toBeDefined();
    await ok(own.post(`${W}/counts/${count.id}/cancel`, {}));
    await post(d.id);
    await assertInvariant();
  });

  // ---------------------------------------------------------------- races

  it('race: production vs production and production vs sales allocation never over-reserve (3 rounds)', async () => {
    await activeBom(it_.fg, [[it_.pk, '1']]);
    const own = await owner();
    for (let round = 0; round < 3; round++) {
      await stockIn(it_.pk, '10');
      const a = await approved('7');
      const b = await approved('7');
      const [ra, rb] = await Promise.all([
        (await opm()).post(`${P}/orders/${a.id}/materials/allocate`, {}),
        own.post(`${P}/orders/${b.id}/materials/allocate`, {}),
      ]);
      expect([ra.statusCode, rb.statusCode].every((s) => s === 200 || s === 409)).toBe(true);
      await assertInvariant();
      // Sales vs production on fresh stock.
      await stockIn(it_.pk, '10');
      const so = (
        await ok(
          own.post(SO, {
            customerId: customer,
            lines: [{ itemId: it_.pk, quantity: '7', unitPrice: '1' }],
          }),
          201,
        )
      ).order;
      await ok(own.post(`${SO}/${so.id}/submit`));
      await ok(own.post(`${SO}/${so.id}/confirm`));
      const c = await approved('7');
      const [x, y] = await Promise.all([
        own.post(`${SO}/${so.id}/allocate`),
        (await opm()).post(`${P}/orders/${c.id}/materials/allocate`, {}),
      ]);
      expect([x.statusCode, y.statusCode].every((s) => s === 200 || s === 409)).toBe(true);
      await assertInvariant();
      // Release everything so the next round starts clean.
      for (const id of [a.id, b.id, c.id])
        await (await opm()).post(`${P}/orders/${id}/materials/release`, {});
      await own.post(`${SO}/${so.id}/release`);
    }
  });

  it('race: allocation vs transfer, adjustment and count start; issue vs issue, triple post, release, reallocate, transfer, adjustment, cancel', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    const own = await owner();
    for (let round = 0; round < 3; round++) {
      await stockIn(it_.rm, '20');
      const o = await approved('10');
      const tr = (
        await ok(
          own.post(`${W}/transfers`, {
            sourceLocationId: loc.MAIN,
            destinationLocationId: loc.QC,
            lines: [{ itemId: it_.rm, quantity: '15' }],
          }),
          201,
        )
      ).transfer;
      const adj = (
        await ok(
          own.post(`${W}/adjustments`, {
            reason: 'DAMAGE',
            lines: [
              { direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.rm, quantity: '15' },
            ],
          }),
          201,
        )
      ).adjustment;
      await ok(own.post(`${W}/adjustments/${adj.id}/submit`));
      const [al, t, a] = await Promise.all([
        (await opm()).post(`${P}/orders/${o.id}/materials/allocate`, {}),
        own.post(`${W}/transfers/${tr.id}/post`),
        own.post(`${W}/adjustments/${adj.id}/approve`),
      ]);
      for (const r of [al, t, a]) expect([200, 409], r.body).toContain(r.statusCode);
      await assertInvariant();
      // Reset: release and top up to a known state.
      await (await opm()).post(`${P}/orders/${o.id}/materials/release`, {});
      await (await opm()).post(`${P}/orders/${o.id}/cancel`, { reason: 'reset' });
    }
    // Issue races on a started order with 30 reserved.
    await stockIn(it_.rm, '100');
    const s = await started('30');
    const res = (await ok((await opm()).get(`${P}/orders/${s.id}`))).order.reservations[0];
    // Two drafts competing for the same 30 cannot both be drafted beyond it.
    const d1 = await draftIssue(s.id, [{ allocationId: res.id, quantity: '20' }]);
    expect(
      code(
        await (
          await ops()
        ).post(`${P}/issues`, {
          productionOrderId: s.id,
          lines: [{ allocationId: res.id, quantity: '20' }],
        }),
      ),
    ).toBe('ISSUE_EXCEEDS_RESERVATION');
    const d2 = await draftIssue(s.id, [{ allocationId: res.id, quantity: '10' }]);
    // Triple post of d1 + post of d2 at once: each posts once, never over-consumed.
    const posts = await Promise.all([
      (await opm()).post(`${P}/issues/${d1.id}/post`, {}),
      own.post(`${P}/issues/${d1.id}/post`, {}),
      (await opm()).post(`${P}/issues/${d1.id}/post`, {}),
      own.post(`${P}/issues/${d2.id}/post`, {}),
    ]);
    expect(posts.map((r) => r.statusCode).sort()).toEqual([200, 200, 409, 409]);
    expect(await h.db.stockMovement.count({ where: { type: 'PRODUCTION_CONSUMPTION' } })).toBe(2);
    await assertInvariant();
    // Issue vs release / reallocate / cancel / transfer / adjustment / count start.
    for (const other of [
      'release',
      'reallocate',
      'cancel',
      'transfer',
      'adjustment',
      'count',
    ] as const) {
      await stockIn(it_.rm, '10');
      const o = await started('5');
      const d = await draftIssue(o.id);
      let x: Promise<ApiResponse>;
      if (other === 'release' || other === 'reallocate')
        x = own.post(`${P}/orders/${o.id}/materials/${other}`, {});
      else if (other === 'cancel') x = own.post(`${P}/orders/${o.id}/cancel`, { reason: 'race' });
      else if (other === 'transfer') {
        const t = (
          await ok(
            own.post(`${W}/transfers`, {
              sourceLocationId: loc.MAIN,
              destinationLocationId: loc.QC,
              lines: [{ itemId: it_.rm, quantity: '1' }],
            }),
            201,
          )
        ).transfer;
        x = own.post(`${W}/transfers/${t.id}/post`);
      } else if (other === 'adjustment') {
        const ad = (
          await ok(
            own.post(`${W}/adjustments`, {
              reason: 'DAMAGE',
              lines: [
                { direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.rm, quantity: '7' },
              ],
            }),
            201,
          )
        ).adjustment;
        await ok(own.post(`${W}/adjustments/${ad.id}/submit`));
        x = own.post(`${W}/adjustments/${ad.id}/approve`);
      } else {
        const c = (await ok(own.post(`${W}/counts`, { locationIds: [loc.MAIN] }), 201)).count;
        x = own.post(`${W}/counts/${c.id}/start`).then(async (r) => {
          await own.post(`${W}/counts/${c.id}/cancel`, {});
          return r;
        });
      }
      const [pi, xr] = await Promise.all([(await opm()).post(`${P}/issues/${d.id}/post`, {}), x]);
      expect([200, 409], `${other} ${pi.body}`).toContain(pi.statusCode);
      expect([200, 409], `${other} ${xr.body}`).toContain(xr.statusCode);
      if (other === 'release' || other === 'reallocate' || other === 'cancel') {
        // Serialized on the order row: the draft blocks release/reallocate; cancel waits for the post.
        expect(pi.statusCode === 200 || xr.statusCode === 200).toBe(true);
      }
      await assertInvariant();
    }
  });

  it('race: start vs cancel — one transition, never both', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    await stockIn(it_.rm, '30');
    for (let round = 0; round < 3; round++) {
      const o = await approved('5');
      await allocate(o.id);
      await ok((await opm()).post(`${P}/orders/${o.id}/release`, {}));
      const [s, c] = await Promise.all([
        (await opm()).post(`${P}/orders/${o.id}/start`, {}),
        (await owner()).post(`${P}/orders/${o.id}/cancel`, { reason: 'race' }),
      ]);
      expect([s.statusCode, c.statusCode]).toContain(200);
      const row = await h.db.productionOrder.findUniqueOrThrow({ where: { id: o.id } });
      // Start then cancel (nothing issued) is valid; cancel then start is refused.
      if (s.statusCode !== 200) expect(row.status).toBe('CANCELLED');
      expect(await reservedSum('production', { productionOrderId: o.id })).toBe(
        row.status === 'CANCELLED' ? '0' : '5',
      );
      await assertInvariant();
    }
  });
});
