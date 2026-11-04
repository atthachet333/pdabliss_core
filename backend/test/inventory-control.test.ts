import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { allowedFields } from '../src/domain/access/data-classification.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { PERMISSION_CATALOG, isRoleDefault } from '../src/permissions/catalog.js';
import { companyDay } from '../src/purchasing/service.js';
import {
  ADJUSTMENT_RULES,
  COUNT_RULES,
  docRefusal,
  TRANSFER_RULES,
  type WarehouseActor,
} from '../src/warehouse/policy.js';
import { CONTROL_FIELD_CLASSES } from '../src/warehouse/views.js';
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
 * EP32 inventory control: transfers (paired movements, lot kept, reversal),
 * stock adjustments (reasons, staff submit / manager approve = post,
 * reversal), cycle counts (snapshot, scoped lock, zero and unexpected counts,
 * stale refusal, signed corrections), the location deactivation guard,
 * concurrency (oversell, double post, concurrent reversal, numbering),
 * permissions per role, branch / company isolation, mass assignment, privacy
 * and audit. Ledger = balance is asserted after every scenario.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const W = '/api/v1/warehouse';
const TR = `${W}/transfers`;
const ADJ = `${W}/adjustments`;
const CC = `${W}/counts`;
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

describe('Inventory control policy and contracts (EP32)', () => {
  it('adds five codes; reuses the EP27 adjustment codes; tiers by role', () => {
    const ep32 = [
      ['warehouse.transfers.create', 'OPERATE'],
      ['warehouse.transfers.approve', 'MANAGE'],
      ['warehouse.transfers.cancel', 'MANAGE'],
      ['warehouse.counts.create', 'OPERATE'],
      ['warehouse.counts.approve', 'MANAGE'],
      ['warehouse.stock_adjustment.create', 'OPERATE'],
      ['warehouse.stock_adjustment.approve', 'MANAGE'],
    ] as const;
    for (const [c, tier] of ep32) {
      const p = PERMISSION_CATALOG.find((x) => x.code === c);
      expect(p, c).toMatchObject({ namespace: 'WAREHOUSE', tier, scope: 'BRANCH' });
      expect(isRoleDefault('DEPARTMENT_STAFF', c)).toBe(tier === 'OPERATE');
      expect(isRoleDefault('DEPARTMENT_MANAGER', c)).toBe(true);
      expect(isRoleDefault('EXECUTIVE', c)).toBe(false);
      expect(isRoleDefault('VIEWER', c)).toBe(false);
      expect(isRoleDefault('COMPANY_OWNER', c)).toBe(true);
    }
    // 70 operational codes since EP36 (the override CHECK), plus the COMPANY_ADMIN codes.
    expect(PERMISSION_CATALOG.filter((x) => x.namespace !== 'COMPANY_ADMIN')).toHaveLength(70);
    expect(PERMISSION_CATALOG.some((x) => /\.(post|reverse|submit|reject)$/.test(x.code))).toBe(
      false,
    );
  });

  it('decides every document transition in one table per document', () => {
    const actor = (permissions: string[]) =>
      ({
        branches: [{ id: 'b1', code: '00001', name: 'B', type: 'BRANCH' }],
        permissions,
      }) as unknown as WarehouseActor;
    const d = (status: any, branchId = 'b1') => ({ status, branchId });
    const staff = actor([
      'warehouse.transfers.create',
      'warehouse.stock_adjustment.create',
      'warehouse.counts.create',
    ]);
    const mgr = actor([
      ...staff.permissions,
      'warehouse.transfers.approve',
      'warehouse.transfers.cancel',
      'warehouse.stock_adjustment.approve',
      'warehouse.counts.approve',
    ]);
    expect(docRefusal(staff, TRANSFER_RULES.post, d('DRAFT'))).toBe('authority');
    expect(docRefusal(mgr, TRANSFER_RULES.post, d('DRAFT'))).toBeNull();
    expect(docRefusal(mgr, TRANSFER_RULES.post, d('POSTED'))).toBe('status');
    expect(docRefusal(staff, TRANSFER_RULES.cancel, d('DRAFT'))).toBeNull();
    expect(docRefusal(staff, TRANSFER_RULES.cancel, d('POSTED'))).toBe('authority');
    expect(docRefusal(mgr, TRANSFER_RULES.cancel, d('CANCELLED'))).toBe('status');
    expect(docRefusal(mgr, TRANSFER_RULES.post, d('DRAFT', 'b2'))).toBe('branch');
    expect(docRefusal(staff, ADJUSTMENT_RULES.submit, d('DRAFT'))).toBeNull();
    expect(docRefusal(staff, ADJUSTMENT_RULES.approve, d('SUBMITTED'))).toBe('authority');
    expect(docRefusal(mgr, ADJUSTMENT_RULES.approve, d('DRAFT'))).toBe('status');
    expect(docRefusal(mgr, ADJUSTMENT_RULES.reject, d('SUBMITTED'))).toBeNull();
    expect(docRefusal(staff, ADJUSTMENT_RULES.cancel, d('POSTED'))).toBe('authority');
    expect(docRefusal(mgr, ADJUSTMENT_RULES.cancel, d('REJECTED'))).toBe('status');
    expect(docRefusal(staff, COUNT_RULES.start, d('DRAFT'))).toBeNull();
    expect(docRefusal(staff, COUNT_RULES.post, d('REVIEW'))).toBe('authority');
    expect(docRefusal(mgr, COUNT_RULES.post, d('COUNTING'))).toBe('status');
    expect(docRefusal(mgr, COUNT_RULES.cancel, d('POSTED'))).toBe('status');
    expect(docRefusal(staff, COUNT_RULES.reopen, d('REVIEW'))).toBeNull();
  });

  it('every transfer / adjustment / count key is operational — none is financial', () => {
    const allowed = new Set<string>(
      allowedFields(CONTROL_FIELD_CLASSES as Record<string, any>, 'warehouse') as string[],
    );
    for (const k of Object.keys(CONTROL_FIELD_CLASSES)) {
      expect(allowed.has(k), k).toBe(true);
      expect(k, k).not.toMatch(MONEY);
    }
  });
});

// ------------------------------------------------------------------ database

describeDb('Inventory transfers, adjustments and cycle counts (EP32)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const br: Record<'HO' | 'X', string> = { HO: '', X: '' };
  const ids: Record<string, string> = {};
  const it_: Record<string, string> = {};
  const loc: Record<string, string> = {};
  let bLoc = '';
  const PERIOD = companyDay('Asia/Bangkok').slice(0, 7).replace('-', '');

  const PEOPLE: [string, CompanyRole, 'A' | 'B', DepartmentCode[], ('HO' | 'X')[] | null][] = [
    ['owner@a.example', 'COMPANY_OWNER', 'A', [], null],
    ['admin@a.example', 'SYSTEM_ADMIN', 'A', [], null],
    ['exec@a.example', 'EXECUTIVE', 'A', [], null],
    ['wh@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['X']],
    ['wh2@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['X']],
    ['whm@a.example', 'DEPARTMENT_MANAGER', 'A', ['WAREHOUSE'], ['X']],
    ['whm2@a.example', 'DEPARTMENT_MANAGER', 'A', ['WAREHOUSE'], ['X']],
    ['wh.ho@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['HO']],
    ['viewer@a.example', 'VIEWER', 'A', ['WAREHOUSE'], ['X']],
    ['acct@a.example', 'DEPARTMENT_MANAGER', 'A', ['ACCOUNTING'], null],
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
    const unit = (c: string, name: string, precision: number) =>
      h.db.unit.create({ data: { companyId: A.companyId, code: c, name, precision } });
    const pcs = await unit('PCS', 'Piece', 0);
    const kg = await unit('KG', 'Kilogram', 3);
    const item = (c: string, unitId: string, t: J = {}) =>
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
    it_.box = (await item('BOX-1', pcs.id)).id;
    it_.oil = (
      await item('OIL-1', kg.id, { lotTracking: 'OPTIONAL', expiryTracking: 'OPTIONAL' })
    ).id;
    it_.cream = (
      await item('CRM-1', pcs.id, { lotTracking: 'REQUIRED', expiryTracking: 'REQUIRED' })
    ).id;
    it_.svc = (await item('SVC-1', pcs.id, { type: 'NON_STOCK', inventoryTracked: false })).id;
    const location = (companyId: string, branchId: string, c: string, off = false) =>
      h.db.warehouseLocation.create({
        data: {
          companyId,
          branchId,
          code: c,
          name: `Loc ${c}`,
          status: off ? 'INACTIVE' : 'ACTIVE',
          deactivatedAt: off ? new Date() : null,
        },
      });
    loc.MAIN = (await location(A.companyId, br.X, 'MAIN')).id;
    loc.QC = (await location(A.companyId, br.X, 'QC')).id;
    loc.SHELF = (await location(A.companyId, br.X, 'SHELF')).id;
    loc.OLD = (await location(A.companyId, br.X, 'OLD', true)).id;
    loc.HO = (await location(A.companyId, br.HO, 'HO-MAIN')).id;
    bLoc = (await location(B.companyId, B.headOfficeId, 'B-MAIN')).id;
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

  /** Ledger = balance for every (location, item, lot) of company A; never negative. */
  const assertLedger = async () => {
    const rows = await h.db.$queryRaw<{ bad: bigint }[]>`
      SELECT count(*) AS bad FROM "StockBalance" b
      WHERE b."companyId" = ${A.companyId} AND (b."quantityOnHand" < 0 OR b."quantityOnHand" <> (
        SELECT COALESCE(SUM(m."quantityDelta"), 0) FROM "StockMovement" m
        WHERE m."locationId" = b."locationId" AND m."itemId" = b."itemId"
          AND COALESCE(m."lotId", '') = b."lotKey"))`;
    expect(Number(rows[0]!.bad)).toBe(0);
  };
  const onHand = async (itemId: string, locationId = loc.MAIN!, lotId: string | null = null) =>
    (
      await h.db.stockBalance.findUnique({
        where: { locationId_itemId_lotKey: { locationId, itemId, lotKey: lotId ?? '' } },
      })
    )?.quantityOnHand.toFixed(6) ?? '0.000000';

  /** Stock in through a real FOUND adjustment approved by the owner (the ledger path). */
  const stockIn = async (itemId: string, quantity: string, locationId = loc.MAIN!, lot: J = {}) => {
    const owner = await as('owner@a.example', locationId === loc.HO ? 'HO' : 'X');
    const d = (
      await ok(
        owner.post(ADJ, {
          reason: 'FOUND',
          lines: [{ direction: 'INCREASE', locationId, itemId, quantity, ...lot }],
        }),
        201,
      )
    ).adjustment;
    await ok(owner.post(`${ADJ}/${d.id}/submit`));
    return (await ok(owner.post(`${ADJ}/${d.id}/approve`))).adjustment;
  };
  const transfer = async (b: Browser, lines: J[], from = loc.MAIN, to = loc.QC) =>
    (await ok(b.post(TR, { sourceLocationId: from, destinationLocationId: to, lines }), 201))
      .transfer;

  // ---------------------------------------------------------------- transfers

  it('transfers stock between locations of one branch: paired movements, lot preserved', async () => {
    await stockIn(it_.box!, '10');
    const lot = (
      await stockIn(it_.cream!, '8', loc.MAIN, {
        newLotNumber: 'C-1',
        newLotExpiry: '2099-01-01',
      })
    ).lines[0].lot;
    const wh = await as('wh@a.example', 'X');
    const t = await transfer(wh, [
      { itemId: it_.box, quantity: '4' },
      { itemId: it_.cream, lotId: lot.id, quantity: '3' },
    ]);
    expect(t).toMatchObject({
      number: `TR-${PERIOD}-000001`,
      status: 'DRAFT',
      source: { code: 'MAIN' },
      destination: { code: 'QC' },
      actions: ['edit', 'cancel'],
    });
    expect(t.lines[0]).toMatchObject({ quantity: '4', available: '10' });
    // Staff cannot post; a manager can.
    expect(code(await wh.post(`${TR}/${t.id}/post`))).toBe('PERMISSION_DENIED');
    const whm = await as('whm@a.example', 'X');
    const posted = (await ok(whm.post(`${TR}/${t.id}/post`))).transfer;
    expect(posted.status).toBe('POSTED');
    expect(posted.postedBy).toEqual({ name: 'whm' });
    expect(await onHand(it_.box!)).toBe('6.000000');
    expect(await onHand(it_.box!, loc.QC)).toBe('4.000000');
    expect(await onHand(it_.cream!, loc.QC, lot.id)).toBe('3.000000');
    const mv = await h.db.stockMovement.findMany({
      where: { transferId: t.id },
      orderBy: [{ type: 'asc' }],
    });
    expect(mv.map((m) => [m.type, m.quantityDelta.toString(), m.lotId])).toEqual(
      expect.arrayContaining([
        ['TRANSFER_OUT', '-4', null],
        ['TRANSFER_IN', '4', null],
        ['TRANSFER_OUT', '-3', lot.id],
        ['TRANSFER_IN', '3', lot.id],
      ]),
    );
    expect(mv.every((m) => m.sourceType === 'TRANSFER')).toBe(true);
    // Movement ledger: labels by type, source link, filters.
    const ledger = await ok(wh.get(`${W}/movements?sourceType=TRANSFER`));
    expect(ledger.total).toBe(4);
    expect(ledger.items[0].source.transfer).toEqual({ id: t.id, number: t.number });
    expect((await ok(wh.get(`${W}/movements?type=TRANSFER_IN`))).total).toBe(2);
    expect((await ok(wh.get(`${W}/movements?q=${t.number}`))).total).toBe(4);
    // Double post: refused, nothing moves twice.
    expect(code(await whm.post(`${TR}/${t.id}/post`))).toBe('DOCUMENT_ALREADY_POSTED');
    expect(await h.db.stockMovement.count({ where: { transferId: t.id } })).toBe(4);
    await assertLedger();
  });

  it('validates transfers: same location, inactive, cross-branch, lots, precision, stock, empty', async () => {
    await stockIn(it_.box!, '5');
    await stockIn(it_.oil!, '2.5');
    const wh = await as('wh@a.example', 'X');
    const make = (body: J) => wh.post(TR, body);
    expect(code(await make({ sourceLocationId: loc.MAIN, destinationLocationId: loc.MAIN }))).toBe(
      'SAME_LOCATION',
    );
    expect(code(await make({ sourceLocationId: loc.MAIN, destinationLocationId: loc.OLD }))).toBe(
      'LOCATION_INACTIVE',
    );
    expect(code(await make({ sourceLocationId: loc.MAIN, destinationLocationId: loc.HO }))).toBe(
      'BRANCH_NOT_ALLOWED',
    );
    const owner = await as('owner@a.example', 'X');
    expect(
      code(await owner.post(TR, { sourceLocationId: loc.MAIN, destinationLocationId: loc.HO })),
    ).toBe('CROSS_BRANCH');
    expect(code(await make({ sourceLocationId: loc.MAIN, destinationLocationId: bLoc }))).toBe(
      'REFERENCE_NOT_FOUND',
    );
    const t = await transfer(wh, []);
    const lines = (l: J[]) => wh.put(`${TR}/${t.id}/lines`, { lines: l });
    expect(code(await lines([{ itemId: it_.box, quantity: '6' }]))).toBe('INSUFFICIENT_STOCK');
    expect(code(await lines([{ itemId: it_.box, quantity: '1.5' }]))).toBe('QUANTITY_PRECISION');
    expect(code(await lines([{ itemId: it_.svc, quantity: '1' }]))).toBe('ITEM_NOT_STOCKED');
    expect(code(await lines([{ itemId: it_.cream, quantity: '1' }]))).toBe('LOT_REQUIRED');
    expect(
      code(
        await lines([
          { itemId: it_.box, quantity: '1' },
          { itemId: it_.box, quantity: '2' },
        ]),
      ),
    ).toBe('DUPLICATE_LINE');
    expect((await lines([{ itemId: it_.oil, quantity: '2.125' }])).statusCode).toBe(200);
    // Mass assignment: server-owned keys are refused.
    expect(
      (
        await wh.put(`${TR}/${t.id}/lines`, {
          lines: [{ itemId: it_.box, quantity: '1', lotKey: 'x' }],
        })
      ).statusCode,
    ).toBe(400);
    expect((await wh.patch(`${TR}/${t.id}`, { status: 'POSTED' })).statusCode).toBe(400);
    expect(
      (
        await wh.post(TR, {
          sourceLocationId: loc.MAIN,
          destinationLocationId: loc.QC,
          branchId: br.HO,
          number: 'TR-1',
        })
      ).statusCode,
    ).toBe(400);
    const e = await transfer(wh, []);
    const whm = await as('whm@a.example', 'X');
    expect(code(await whm.post(`${TR}/${e.id}/post`))).toBe('DOCUMENT_EMPTY');
    await assertLedger();
  });

  it('cancels a draft without effect and reverses a posted transfer (refused when the destination is short)', async () => {
    await stockIn(it_.box!, '10');
    const wh = await as('wh@a.example', 'X');
    const whm = await as('whm@a.example', 'X');
    const d = await transfer(wh, [{ itemId: it_.box, quantity: '2' }]);
    expect((await ok(wh.post(`${TR}/${d.id}/cancel`, {}))).transfer.status).toBe('CANCELLED');
    expect(await h.db.stockMovement.count({ where: { transferId: d.id } })).toBe(0);

    const t = await transfer(wh, [{ itemId: it_.box, quantity: '6' }]);
    await ok(whm.post(`${TR}/${t.id}/post`));
    expect(code(await wh.post(`${TR}/${t.id}/cancel`, { reason: 'x' }))).toBe('PERMISSION_DENIED');
    expect(code(await whm.post(`${TR}/${t.id}/cancel`, {}))).toBe('REASON_REQUIRED');
    // 5 of the 6 moved on from QC: the reversal would make QC negative.
    const on = await transfer(whm, [{ itemId: it_.box, quantity: '5' }], loc.QC, loc.SHELF);
    await ok(whm.post(`${TR}/${on.id}/post`));
    expect(code(await whm.post(`${TR}/${t.id}/cancel`, { reason: 'Wrong shelf' }))).toBe(
      'REVERSAL_NOT_POSSIBLE',
    );
    expect((await h.db.inventoryTransfer.findUniqueOrThrow({ where: { id: t.id } })).status).toBe(
      'POSTED',
    );
    // Bring it back, then the reversal works: TRANSFER_IN_REVERSAL + TRANSFER_OUT_REVERSAL.
    await ok(whm.post(`${TR}/${on.id}/cancel`, { reason: 'Back' }));
    const c = (await ok(whm.post(`${TR}/${t.id}/cancel`, { reason: 'Wrong shelf' }))).transfer;
    expect(c).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Wrong shelf',
      actions: [],
    });
    expect(await onHand(it_.box!)).toBe('10.000000');
    expect(await onHand(it_.box!, loc.QC)).toBe('0.000000');
    const types = (await h.db.stockMovement.findMany({ where: { transferId: t.id } }))
      .map((m) => m.type)
      .sort();
    expect(types).toEqual([
      'TRANSFER_IN',
      'TRANSFER_IN_REVERSAL',
      'TRANSFER_OUT',
      'TRANSFER_OUT_REVERSAL',
    ]);
    expect(code(await whm.post(`${TR}/${t.id}/cancel`, { reason: 'again' }))).toBe(
      'INVALID_TRANSITION',
    );
    await assertLedger();
  });

  it('race: 7 + 7 transferred from a balance of 10 — exactly one posts', async () => {
    await stockIn(it_.box!, '10');
    const wh = await as('wh@a.example', 'X');
    const t1 = await transfer(wh, [{ itemId: it_.box, quantity: '7' }]);
    const t2 = await transfer(wh, [{ itemId: it_.box, quantity: '7' }], loc.MAIN, loc.SHELF);
    const [m1, m2] = [await as('whm@a.example', 'X'), await as('whm2@a.example', 'X')];
    const res = await Promise.all([m1.post(`${TR}/${t1.id}/post`), m2.post(`${TR}/${t2.id}/post`)]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(code(res.find((r) => r.statusCode === 409)!)).toBe('INSUFFICIENT_STOCK');
    expect(await onHand(it_.box!)).toBe('3.000000');
    await assertLedger();
  });

  it('race: the same transfer posted twice at once — once; and a concurrent reversal — once', async () => {
    await stockIn(it_.box!, '10');
    const wh = await as('wh@a.example', 'X');
    const t = await transfer(wh, [{ itemId: it_.box, quantity: '4' }]);
    const [m1, m2] = [await as('whm@a.example', 'X'), await as('whm2@a.example', 'X')];
    const posts = await Promise.all([m1.post(`${TR}/${t.id}/post`), m2.post(`${TR}/${t.id}/post`)]);
    expect(posts.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await h.db.stockMovement.count({ where: { transferId: t.id } })).toBe(2);
    const cancels = await Promise.all([
      m1.post(`${TR}/${t.id}/cancel`, { reason: 'a' }),
      m2.post(`${TR}/${t.id}/cancel`, { reason: 'b' }),
    ]);
    expect(cancels.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await h.db.stockMovement.count({ where: { transferId: t.id } })).toBe(4);
    expect(await onHand(it_.box!)).toBe('10.000000');
    await assertLedger();
  });

  // ---------------------------------------------------------------- adjustments

  it('adjusts stock: staff submit, manager approve = post; increase, decrease, new lot', async () => {
    await stockIn(it_.box!, '10');
    const wh = await as('wh@a.example', 'X');
    const d = (
      await ok(
        wh.post(ADJ, {
          reason: 'DAMAGE',
          note: 'Forklift',
          lines: [{ direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.box, quantity: '3' }],
        }),
        201,
      )
    ).adjustment;
    expect(d).toMatchObject({
      number: `ADJ-${PERIOD}-000002`,
      status: 'DRAFT',
      reason: 'DAMAGE',
      locations: ['MAIN'],
    });
    expect(d.lines[0]).toMatchObject({ direction: 'DECREASE', quantity: '3', onHand: '10' });
    expect(d.actions).toEqual(['edit', 'submit', 'cancel']);
    expect(code(await wh.post(`${ADJ}/${d.id}/approve`))).toBe('PERMISSION_DENIED');
    const s = (await ok(wh.post(`${ADJ}/${d.id}/submit`))).adjustment;
    expect(s.status).toBe('SUBMITTED');
    expect(code(await wh.put(`${ADJ}/${d.id}/lines`, { lines: [] }))).toBe('DOCUMENT_NOT_EDITABLE');
    expect(code(await wh.post(`${ADJ}/${d.id}/approve`))).toBe('PERMISSION_DENIED');
    const whm = await as('whm@a.example', 'X');
    const p = (await ok(whm.post(`${ADJ}/${d.id}/approve`))).adjustment;
    expect(p).toMatchObject({ status: 'POSTED', approvedBy: { name: 'whm' } });
    expect(await onHand(it_.box!)).toBe('7.000000');
    const mv = await h.db.stockMovement.findFirstOrThrow({ where: { adjustmentId: d.id } });
    expect([mv.type, mv.quantityDelta.toString(), mv.sourceType]).toEqual([
      'ADJUSTMENT_OUT',
      '-3',
      'ADJUSTMENT',
    ]);
    expect(code(await whm.post(`${ADJ}/${d.id}/approve`))).toBe('INVALID_TRANSITION');

    // Increase into a new lot (FOUND): the lot is created at approval.
    const f = await stockIn(it_.cream!, '4', loc.QC, {
      newLotNumber: 'NEW-9',
      newLotExpiry: '2099-02-02',
    });
    expect(f.lines[0].lot).toMatchObject({ lotNumber: 'NEW-9', expiryDate: '2099-02-02' });
    expect(await onHand(it_.cream!, loc.QC, f.lines[0].lot.id)).toBe('4.000000');
    expect(
      (await ok(wh.get(`${W}/movements?sourceType=ADJUSTMENT&type=ADJUSTMENT_IN`))).items[0].source
        .adjustment.number,
    ).toBe(f.number);
    await assertLedger();
  });

  it('validates adjustments: reason vs direction, Other needs a note, lots, stock, new-lot rules', async () => {
    await stockIn(it_.box!, '2');
    const wh = await as('wh@a.example', 'X');
    const make = (reason: string, l: J, note?: string) =>
      wh.post(ADJ, {
        reason,
        ...(note ? { note } : {}),
        lines: [{ locationId: loc.MAIN, itemId: it_.box, quantity: '1', ...l }],
      });
    expect(code(await make('DAMAGE', { direction: 'INCREASE' }))).toBe('REASON_DIRECTION');
    expect(code(await make('FOUND', { direction: 'DECREASE' }))).toBe('REASON_DIRECTION');
    expect(code(await make('OTHER', { direction: 'INCREASE' }))).toBe('NOTE_REQUIRED');
    expect((await make('OTHER', { direction: 'INCREASE' }, 'Audit fix')).statusCode).toBe(201);
    expect(code(await make('LOSS', { direction: 'DECREASE', quantity: '3' }))).toBe(
      'INSUFFICIENT_STOCK',
    );
    expect(code(await make('DAMAGE', { direction: 'DECREASE', newLotNumber: 'X' }))).toBe(
      'LOT_NOT_TRACKED',
    );
    expect(
      code(
        await wh.post(ADJ, {
          reason: 'DAMAGE',
          lines: [
            {
              direction: 'DECREASE',
              locationId: loc.MAIN,
              itemId: it_.cream,
              quantity: '1',
              newLotNumber: 'Z',
              newLotExpiry: '2099-01-01',
            },
          ],
        }),
      ),
    ).toBe('NEW_LOT_NOT_ALLOWED');
    expect(
      code(
        await wh.post(ADJ, {
          reason: 'FOUND',
          lines: [
            {
              direction: 'INCREASE',
              locationId: loc.MAIN,
              itemId: it_.cream,
              quantity: '1',
              newLotNumber: 'Z',
              newLotExpiry: '2000-01-01',
            },
          ],
        }),
      ),
    ).toBe('LOT_EXPIRED');
    expect(
      code(
        await wh.post(ADJ, {
          reason: 'FOUND',
          lines: [{ direction: 'INCREASE', locationId: loc.OLD, itemId: it_.box, quantity: '1' }],
        }),
      ),
    ).toBe('LOCATION_INACTIVE');
    expect(
      code(
        await wh.post(ADJ, {
          reason: 'FOUND',
          lines: [{ direction: 'INCREASE', locationId: loc.HO, itemId: it_.box, quantity: '1' }],
        }),
      ),
    ).toBe('BRANCH_NOT_ALLOWED');
    expect((await wh.post(ADJ, { reason: 'FOUND', status: 'POSTED' })).statusCode).toBe(400);
    expect((await wh.post(ADJ, { reason: 'NOPE' })).statusCode).toBe(400);
    const e = (await ok(wh.post(ADJ, { reason: 'LOSS' }), 201)).adjustment;
    expect(code(await wh.post(`${ADJ}/${e.id}/submit`))).toBe('DOCUMENT_EMPTY');
    await assertLedger();
  });

  it('rejects with a reason, cancels drafts, reverses a posted adjustment (refused when consumed)', async () => {
    await stockIn(it_.box!, '10');
    const wh = await as('wh@a.example', 'X');
    const whm = await as('whm@a.example', 'X');
    const d = (
      await ok(
        wh.post(ADJ, {
          reason: 'SHRINKAGE',
          lines: [{ direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.box, quantity: '1' }],
        }),
        201,
      )
    ).adjustment;
    await ok(wh.post(`${ADJ}/${d.id}/submit`));
    expect((await whm.post(`${ADJ}/${d.id}/reject`, {})).statusCode).toBe(400);
    const r = (await ok(whm.post(`${ADJ}/${d.id}/reject`, { reason: 'Recount first' }))).adjustment;
    expect(r).toMatchObject({ status: 'REJECTED', rejectionReason: 'Recount first', actions: [] });
    const c = (await ok(wh.post(ADJ, { reason: 'LOSS' }), 201)).adjustment;
    expect((await ok(wh.post(`${ADJ}/${c.id}/cancel`, {}))).adjustment.status).toBe('CANCELLED');

    // Posted increase of 5, then 12 of the 15 transferred away: reversing would go below zero.
    const inc = await stockIn(it_.box!, '5');
    const t = await transfer(whm, [{ itemId: it_.box, quantity: '12' }]);
    await ok(whm.post(`${TR}/${t.id}/post`));
    expect(code(await wh.post(`${ADJ}/${inc.id}/cancel`, { reason: 'x' }))).toBe(
      'PERMISSION_DENIED',
    );
    expect(code(await whm.post(`${ADJ}/${inc.id}/cancel`, {}))).toBe('REASON_REQUIRED');
    expect(code(await whm.post(`${ADJ}/${inc.id}/cancel`, { reason: 'Typo' }))).toBe(
      'REVERSAL_NOT_POSSIBLE',
    );
    await ok(whm.post(`${TR}/${t.id}/cancel`, { reason: 'back' }));
    const rev = (await ok(whm.post(`${ADJ}/${inc.id}/cancel`, { reason: 'Typo' }))).adjustment;
    expect(rev.status).toBe('CANCELLED');
    expect(await onHand(it_.box!)).toBe('10.000000');
    expect(
      (await h.db.stockMovement.findMany({ where: { adjustmentId: inc.id } }))
        .map((m) => m.type)
        .sort(),
    ).toEqual(['ADJUSTMENT_IN', 'ADJUSTMENT_IN_REVERSAL']);
    await assertLedger();
  });

  it('race: 7 + 7 adjusted away from a balance of 10 — exactly one posts; double approve — once', async () => {
    await stockIn(it_.box!, '10');
    const wh = await as('wh@a.example', 'X');
    const mk = async () => {
      const d = (
        await ok(
          wh.post(ADJ, {
            reason: 'LOSS',
            lines: [
              { direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.box, quantity: '7' },
            ],
          }),
          201,
        )
      ).adjustment;
      await ok(wh.post(`${ADJ}/${d.id}/submit`));
      return d;
    };
    const [a1, a2] = [await mk(), await mk()];
    const [m1, m2] = [await as('whm@a.example', 'X'), await as('whm2@a.example', 'X')];
    const res = await Promise.all([
      m1.post(`${ADJ}/${a1.id}/approve`),
      m2.post(`${ADJ}/${a2.id}/approve`),
    ]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(code(res.find((r) => r.statusCode === 409)!)).toBe('INSUFFICIENT_STOCK');
    expect(await onHand(it_.box!)).toBe('3.000000');
    const a3 = (
      await ok(
        wh.post(ADJ, {
          reason: 'LOSS',
          lines: [{ direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.box, quantity: '1' }],
        }),
        201,
      )
    ).adjustment;
    await ok(wh.post(`${ADJ}/${a3.id}/submit`));
    const twice = await Promise.all([
      m1.post(`${ADJ}/${a3.id}/approve`),
      m2.post(`${ADJ}/${a3.id}/approve`),
    ]);
    expect(twice.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await h.db.stockMovement.count({ where: { adjustmentId: a3.id } })).toBe(1);
    expect(await onHand(it_.box!)).toBe('2.000000');
    await assertLedger();
  });

  it('race: numbering stays unique and gapless under concurrent creation', async () => {
    const wh = await as('wh@a.example', 'X');
    const res = await Promise.all(
      Array.from({ length: 8 }, () =>
        wh.post(TR, { sourceLocationId: loc.MAIN, destinationLocationId: loc.QC }),
      ),
    );
    const numbers = res.map((r) => j(r).transfer.number as string).sort();
    expect(numbers).toEqual(
      Array.from({ length: 8 }, (_, i) => `TR-${PERIOD}-${String(i + 1).padStart(6, '0')}`),
    );
    const counts = await Promise.all(
      Array.from({ length: 4 }, () => wh.post(CC, { locationIds: [loc.MAIN] })),
    );
    expect(new Set(counts.map((r) => j(r).count.number)).size).toBe(4);
  });

  // ---------------------------------------------------------------- cycle counts

  it('counts stock: snapshot, scope lock, zero and unexpected counts, signed corrections', async () => {
    await stockIn(it_.box!, '10');
    await stockIn(it_.oil!, '2.5', loc.QC);
    const lot = (
      await stockIn(it_.cream!, '6', loc.MAIN, { newLotNumber: 'C-7', newLotExpiry: '2099-05-05' })
    ).lines[0].lot;
    const wh = await as('wh@a.example', 'X');
    const c = (await ok(wh.post(CC, { locationIds: [loc.MAIN, loc.QC], note: 'Monthly' }), 201))
      .count;
    expect(c).toMatchObject({
      number: `CC-${PERIOD}-000001`,
      status: 'DRAFT',
      lineCount: 0,
      actions: ['edit', 'start', 'cancel'],
    });
    const s = (await ok(wh.post(`${CC}/${c.id}/start`))).count;
    expect(s.status).toBe('COUNTING');
    expect(
      s.lines.map((l: J) => [l.location.code, l.item.code, l.systemQuantity, l.countedQuantity]),
    ).toEqual([
      ['MAIN', 'BOX-1', '10', null],
      ['MAIN', 'CRM-1', '6', null],
      ['QC', 'OIL-1', '2.5', null],
    ]);
    // The scope is locked: no movement on MAIN / QC until the count ends.
    const whm = await as('whm@a.example', 'X');
    const t = await transfer(whm, [{ itemId: it_.box, quantity: '1' }], loc.MAIN, loc.SHELF);
    expect(code(await whm.post(`${TR}/${t.id}/post`))).toBe('COUNT_IN_PROGRESS');
    // An overlapping count cannot start.
    const other = (await ok(wh.post(CC, { locationIds: [loc.QC] }), 201)).count;
    expect(code(await wh.post(`${CC}/${other.id}/start`))).toBe('COUNT_OVERLAP');
    // Review needs every line counted.
    expect(code(await wh.post(`${CC}/${c.id}/review`))).toBe('COUNT_INCOMPLETE');
    const line = (code_: string) => s.lines.find((l: J) => l.item.code === code_);
    await ok(
      wh.put(`${CC}/${c.id}/entries`, {
        entries: [
          { lineId: line('BOX-1').id, countedQuantity: '8' },
          { lineId: line('CRM-1').id, countedQuantity: '0' },
          { lineId: line('OIL-1').id, countedQuantity: '2.5' },
        ],
      }),
    );
    expect(
      code(
        await wh.put(`${CC}/${c.id}/entries`, {
          entries: [{ lineId: line('BOX-1').id, countedQuantity: '8.5' }],
        }),
      ),
    ).toBe('QUANTITY_PRECISION');
    // Unexpected stock found: a new lot of cream on QC; the box on QC.
    expect(
      code(
        await wh.post(`${CC}/${c.id}/lines`, {
          locationId: loc.SHELF,
          itemId: it_.box,
          countedQuantity: '1',
        }),
      ),
    ).toBe('OUT_OF_SCOPE');
    expect(
      code(
        await wh.post(`${CC}/${c.id}/lines`, {
          locationId: loc.MAIN,
          itemId: it_.box,
          countedQuantity: '1',
        }),
      ),
    ).toBe('DUPLICATE_LINE');
    await ok(
      wh.post(`${CC}/${c.id}/lines`, { locationId: loc.QC, itemId: it_.box, countedQuantity: '3' }),
      201,
    );
    const u = (
      await ok(
        wh.post(`${CC}/${c.id}/lines`, {
          locationId: loc.QC,
          itemId: it_.cream,
          newLotNumber: 'C-NEW',
          newLotExpiry: '2099-09-09',
          countedQuantity: '2',
        }),
        201,
      )
    ).count;
    expect(u).toMatchObject({ lineCount: 5, countedLines: 5, varianceLines: 4 });
    expect(u.lines.find((l: J) => l.newLot)?.variance).toBe('2');
    const r = (await ok(wh.post(`${CC}/${c.id}/review`))).count;
    expect(r.status).toBe('REVIEW');
    expect(
      code(
        await wh.put(`${CC}/${c.id}/entries`, {
          entries: [{ lineId: line('BOX-1').id, countedQuantity: '9' }],
        }),
      ),
    ).toBe('DOCUMENT_NOT_EDITABLE');
    expect(code(await wh.post(`${CC}/${c.id}/post`))).toBe('PERMISSION_DENIED');
    // Reopen and back.
    expect((await ok(wh.post(`${CC}/${c.id}/reopen`))).count.status).toBe('COUNTING');
    await ok(wh.post(`${CC}/${c.id}/review`));
    const p = (await ok(whm.post(`${CC}/${c.id}/post`))).count;
    expect(p).toMatchObject({ status: 'POSTED', postedBy: { name: 'whm' }, actions: [] });
    expect(await onHand(it_.box!)).toBe('8.000000');
    expect(await onHand(it_.cream!, loc.MAIN, lot.id)).toBe('0.000000');
    expect(await onHand(it_.box!, loc.QC)).toBe('3.000000');
    expect(await onHand(it_.oil!, loc.QC)).toBe('2.500000');
    const mv = await h.db.stockMovement.findMany({ where: { cycleCountId: c.id } });
    expect(mv.map((m) => m.quantityDelta.toString()).sort()).toEqual(['-2', '-6', '2', '3']);
    expect(mv.every((m) => m.type === 'COUNT_CORRECTION' && m.sourceType === 'CYCLE_COUNT')).toBe(
      true,
    );
    const newLot = await h.db.inventoryLot.findFirstOrThrow({ where: { lotNumber: 'C-NEW' } });
    expect(await onHand(it_.cream!, loc.QC, newLot.id)).toBe('2.000000');
    expect(code(await whm.post(`${CC}/${c.id}/post`))).toBe('DOCUMENT_ALREADY_POSTED');
    // The scope is free again.
    expect((await whm.post(`${TR}/${t.id}/post`)).statusCode).toBe(200);
    expect(
      (await ok(wh.get(`${W}/movements?sourceType=CYCLE_COUNT`))).items[0].source.count.number,
    ).toBe(c.number);
    await assertLedger();
  });

  it('refuses a stale count: stock changed after the snapshot (an item-scoped count)', async () => {
    await stockIn(it_.box!, '10');
    await stockIn(it_.oil!, '1');
    const wh = await as('wh@a.example', 'X');
    const whm = await as('whm@a.example', 'X');
    // Counting only the oil: the box on MAIN can still move.
    const c = (await ok(wh.post(CC, { locationIds: [loc.MAIN], itemId: it_.oil }), 201)).count;
    const s = (await ok(wh.post(`${CC}/${c.id}/start`))).count;
    expect(s.lines).toHaveLength(1);
    const t = await transfer(whm, [{ itemId: it_.box, quantity: '1' }]);
    expect((await whm.post(`${TR}/${t.id}/post`)).statusCode).toBe(200);
    await ok(
      wh.put(`${CC}/${c.id}/entries`, {
        entries: [{ lineId: s.lines[0].id, countedQuantity: '0.75' }],
      }),
    );
    await ok(wh.post(`${CC}/${c.id}/review`));
    // Simulate a write that slipped past the lock (e.g. a pre-EP32 path): the post must refuse.
    await h.db
      .$executeRaw`UPDATE "CycleCountLine" SET "systemQuantity" = 2 WHERE "cycleCountId" = ${c.id}`;
    expect(code(await whm.post(`${CC}/${c.id}/post`))).toBe('COUNT_STALE');
    expect((await h.db.cycleCount.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      'REVIEW',
    );
    expect(await h.db.stockMovement.count({ where: { cycleCountId: c.id } })).toBe(0);
    // Cancel releases the scope with no stock effect.
    expect((await ok(wh.post(`${CC}/${c.id}/cancel`, { reason: 'Redo' }))).count.status).toBe(
      'CANCELLED',
    );
    await assertLedger();
  });

  it('race: a count starting while stock posts — the post either lands before the snapshot or is refused', async () => {
    await stockIn(it_.box!, '10');
    const wh = await as('wh@a.example', 'X');
    const whm = await as('whm@a.example', 'X');
    const c = (await ok(wh.post(CC, { locationIds: [loc.MAIN] }), 201)).count;
    const t = await transfer(whm, [{ itemId: it_.box, quantity: '4' }]);
    const [start, post] = await Promise.all([
      wh.post(`${CC}/${c.id}/start`),
      whm.post(`${TR}/${t.id}/post`),
    ]);
    expect(start.statusCode, start.body).toBe(200);
    const snap = j(start).count.lines[0].systemQuantity;
    if (post.statusCode === 200) expect(snap).toBe('6');
    else {
      expect(code(post)).toBe('COUNT_IN_PROGRESS');
      expect(snap).toBe('10');
    }
    expect(await onHand(it_.box!)).toBe(`${snap}.000000`);
    await assertLedger();
  });

  // ---------------------------------------------------------------- locations, roles, isolation, audit

  it('refuses deactivating a location with stock, a draft transfer or an open count', async () => {
    await stockIn(it_.box!, '1', loc.QC);
    const owner = await as('owner@a.example', 'X');
    const off = (id: string) => owner.post(`/api/v1/master-data/locations/${id}/deactivate`);
    expect(code(await off(loc.QC!))).toBe('LOCATION_HAS_STOCK');
    const t = await transfer(owner, [], loc.MAIN, loc.SHELF);
    expect(code(await off(loc.SHELF!))).toBe('LOCATION_IN_USE');
    await ok(owner.post(`${TR}/${t.id}/cancel`, {}));
    const c = (await ok(owner.post(CC, { locationIds: [loc.SHELF] }), 201)).count;
    expect(code(await off(loc.SHELF!))).toBe('LOCATION_IN_USE');
    await ok(owner.post(`${CC}/${c.id}/cancel`, {}));
    expect((await off(loc.SHELF!)).statusCode).toBe(200);
    // Stock cannot go into it now.
    expect(
      code(
        await owner.post(ADJ, {
          reason: 'FOUND',
          lines: [{ direction: 'INCREASE', locationId: loc.SHELF, itemId: it_.box, quantity: '1' }],
        }),
      ),
    ).toBe('LOCATION_INACTIVE');
  });

  it('roles: executive reads only, system admin and other departments see nothing, viewer reads', async () => {
    await stockIn(it_.box!, '3');
    const wh = await as('wh@a.example', 'X');
    const t = await transfer(wh, [{ itemId: it_.box, quantity: '1' }]);
    const exec = await as('exec@a.example', 'X');
    expect((await exec.get(TR)).statusCode).toBe(200);
    expect((await exec.get(`${TR}/${t.id}`)).statusCode).toBe(200);
    expect(j(await exec.get(`${TR}/${t.id}`)).transfer.actions).toEqual([]);
    expect(
      code(await exec.post(TR, { sourceLocationId: loc.MAIN, destinationLocationId: loc.QC })),
    ).toBe('PERMISSION_DENIED');
    expect(code(await exec.post(ADJ, { reason: 'LOSS' }))).toBe('PERMISSION_DENIED');
    expect(code(await exec.post(CC, { locationIds: [loc.MAIN] }))).toBe('PERMISSION_DENIED');
    expect(code(await exec.post(`${TR}/${t.id}/post`))).toBe('PERMISSION_DENIED');
    const viewer = await as('viewer@a.example', 'X');
    expect((await viewer.get(ADJ)).statusCode).toBe(200);
    expect(code(await viewer.post(ADJ, { reason: 'LOSS' }))).toBe('PERMISSION_DENIED');
    for (const who of ['admin@a.example', 'acct@a.example']) {
      const b = await as(who, 'X');
      for (const url of [TR, ADJ, CC, `${TR}/${t.id}`])
        expect((await b.get(url)).statusCode, `${who} ${url}`).toBe(403);
      expect(
        (await b.post(TR, { sourceLocationId: loc.MAIN, destinationLocationId: loc.QC }))
          .statusCode,
      ).toBe(403);
    }
  });

  it('isolation: another branch or company cannot read or act on a document (IDOR)', async () => {
    await stockIn(it_.box!, '3');
    const wh = await as('wh@a.example', 'X');
    const t = await transfer(wh, [{ itemId: it_.box, quantity: '1' }]);
    const a = (await ok(wh.post(ADJ, { reason: 'LOSS' }), 201)).adjustment;
    const c = (await ok(wh.post(CC, { locationIds: [loc.MAIN] }), 201)).count;
    const ho = await as('wh.ho@a.example', 'HO');
    const other = await as('owner@b.example');
    for (const [b, label] of [
      [ho, 'HO'],
      [other, 'B'],
    ] as const) {
      expect(code(await b.get(`${TR}/${t.id}`)), label).toBe('TRANSFER_NOT_FOUND');
      expect(code(await b.get(`${ADJ}/${a.id}`)), label).toBe('ADJUSTMENT_NOT_FOUND');
      expect(code(await b.get(`${CC}/${c.id}`)), label).toBe('COUNT_NOT_FOUND');
      expect(code(await b.post(`${TR}/${t.id}/post`)), label).toBe('TRANSFER_NOT_FOUND');
      expect(code(await b.post(`${CC}/${c.id}/start`)), label).toBe('COUNT_NOT_FOUND');
      expect(j(await b.get(TR)).total ?? 0, label).toBe(0);
    }
    // Company B cannot reference company A's locations or items.
    expect(
      code(await other.post(TR, { sourceLocationId: loc.MAIN, destinationLocationId: bLoc })),
    ).toBe('REFERENCE_NOT_FOUND');
    expect(code(await other.post(CC, { locationIds: [loc.MAIN] }))).toBe('REFERENCE_NOT_FOUND');
  });

  it('privacy, paging and audit: no money keys anywhere; every step audited', async () => {
    await stockIn(it_.box!, '5');
    const wh = await as('wh@a.example', 'X');
    const whm = await as('whm@a.example', 'X');
    const t = await transfer(wh, [{ itemId: it_.box, quantity: '1' }]);
    await ok(whm.post(`${TR}/${t.id}/post`));
    const c = (await ok(wh.post(CC, { locationIds: [loc.QC] }), 201)).count;
    await ok(wh.post(`${CC}/${c.id}/start`));
    const adj = (await h.db.stockAdjustment.findFirstOrThrow()).id;
    for (const url of [
      TR,
      `${TR}/${t.id}`,
      ADJ,
      `${ADJ}/${adj}`,
      CC,
      `${CC}/${c.id}`,
      `${W}/movements`,
    ]) {
      const body = await ok(wh.get(url));
      delete body.total; // a row count, not money
      for (const k of keysOf(body)) expect(k, `${url} ${k}`).not.toMatch(MONEY);
    }
    const p = await ok(wh.get(`${TR}?pageSize=1&page=1`));
    expect(p).toMatchObject({ total: 1, page: 1, pageSize: 1, hasMore: false });
    expect((await ok(wh.get(`${TR}?status=POSTED`))).total).toBe(1);
    expect((await ok(wh.get(`${TR}?status=DRAFT`))).total).toBe(0);
    expect((await wh.get(`${TR}?status=NOPE`)).statusCode).toBe(400);
    expect((await ok(wh.get(`${ADJ}?reason=FOUND`))).total).toBe(1);
    expect((await ok(wh.get(`${CC}?status=COUNTING`))).total).toBe(1);
    const actions = (
      await h.db.auditLog.findMany({ where: { companyId: A.companyId }, select: { action: true } })
    ).map((x) => x.action);
    for (const a of [
      'TRANSFER_CREATED',
      'TRANSFER_POSTED',
      'ADJUSTMENT_CREATED',
      'ADJUSTMENT_SUBMITTED',
      'ADJUSTMENT_APPROVED',
      'ADJUSTMENT_POSTED',
      'CYCLE_COUNT_CREATED',
      'CYCLE_COUNT_STARTED',
    ]) {
      expect(actions, a).toContain(a);
    }
    const tl = (await ok(wh.get(`${TR}/${t.id}`))).timeline.map((e: J) => e.type);
    expect(tl).toEqual(['TRANSFER_CREATED', 'TRANSFER_POSTED']);
    // Movements stay immutable.
    await expect(
      h.db.$executeRaw`UPDATE "StockMovement" SET "quantityDelta" = 0`,
    ).rejects.toThrow();
    await expect(h.db.$executeRaw`DELETE FROM "StockMovement"`).rejects.toThrow();
  });
});
