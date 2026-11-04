import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { BUSINESS_AUDIT_ENTITIES } from '../src/company/audit.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { permissionDefinition } from '../src/permissions/catalog.js';
import { requiredQuantity } from '../src/production/requirements.js';
import {
  BomRow,
  BomView,
  DemandRow,
  MaterialLine,
  MoRow,
  MoView,
  RequirementRow,
  ShortageRow,
} from '../src/production/views.js';
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
 * EP36 production planning: BOM revisions (draft → active → retired, one
 * active per item, immutable once active), production orders (draft →
 * submitted → approved → ready; rejected / cancelled), server-computed
 * material requirements frozen at approval, reservation-aware availability,
 * sales-linked demand without double counting, the Purchasing shortage
 * handoff, permissions, isolation, races — and throughout: NOT ONE stock
 * movement, balance change or reservation from production planning.
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

// ------------------------------------------------------------------ static

describe('Production contracts (EP36)', () => {
  it('codes: view / BOM view are READ, approve / cancel / BOM manage are MANAGE', () => {
    expect(permissionDefinition('operations.orders.view').tier).toBe('READ');
    expect(permissionDefinition('operations.orders.create').tier).toBe('OPERATE');
    expect(permissionDefinition('operations.orders.approve').tier).toBe('MANAGE');
    expect(permissionDefinition('operations.orders.cancel').tier).toBe('MANAGE');
    expect(permissionDefinition('operations.bom.view')).toMatchObject({
      tier: 'READ',
      scope: 'COMPANY',
    });
    expect(permissionDefinition('operations.bom.manage').tier).toBe('MANAGE');
    expect(permissionDefinition('purchasing.production_shortages.view')).toMatchObject({
      tier: 'READ',
      namespace: 'PURCHASING',
    });
    for (const e of ['ProductionBom', 'ProductionOrder'])
      expect(BUSINESS_AUDIT_ENTITIES).toContain(e);
  });

  it('no Production response key is money, cost or customer', () => {
    const keys = [
      BomRow,
      BomView,
      MoRow,
      MoView,
      MaterialLine,
      RequirementRow,
      DemandRow,
      ShortageRow,
    ].flatMap((s) => shapeKeys(s as never));
    expect(keys.length).toBeGreaterThan(60);
    expect(keys.filter((k) => MONEY.test(k))).toEqual([]);
  });

  it('requirements: exact integer arithmetic, rounded UP to the unit — never truncated', () => {
    const r = (t: string, q: string, o: string, p: number) => {
      const x = requiredQuantity(t, q, o, p);
      return [x.quantity.toString(), x.exact];
    };
    expect(r('100', '2', '1', 0)).toEqual(['200', true]);
    expect(r('100', '0.5', '1', 3)).toEqual(['50', true]);
    expect(r('2', '1', '3', 0)).toEqual(['1', false]); // 0.666… → 1
    expect(r('1', '0.001', '3', 3)).toEqual(['0.001', false]); // 0.000333… → 0.001
    expect(r('7', '0.333', '2', 3)).toEqual(['1.166', false]); // 1.1655 → 1.166
    expect(r('3', '1', '3', 0)).toEqual(['1', true]);
    expect(r('0.000001', '0.000001', '1', 6)).toEqual(['0.000001', false]);
    expect(r('12.5', '0.4', '2.5', 3)).toEqual(['2', true]);
    expect(() => requiredQuantity('999999999999', '999999999999', '1', 0)).toThrow(
      /larger than a quantity/,
    );
  });
});

// ------------------------------------------------------------------ enforcement

describeDb('Production planning (EP36)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const br: Record<'HO' | 'X', string> = { HO: '', X: '' };
  const it_ = {} as Record<
    'fg' | 'fg2' | 'rm' | 'pk' | 'lotrm' | 'svc' | 'off' | 'pcs' | 'kg',
    string
  >;
  const loc: Record<string, string> = {};
  let customer = '';
  let foreignItem = '';
  const TODAY = companyDay('Asia/Bangkok');
  const shift = (days: number) => {
    const d = new Date(`${TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const PEOPLE: [string, CompanyRole, 'A' | 'B', DepartmentCode[], ('HO' | 'X')[] | null][] = [
    ['owner@a.example', 'COMPANY_OWNER', 'A', [], null],
    ['admin@a.example', 'SYSTEM_ADMIN', 'A', [], null],
    ['admin.ops@a.example', 'SYSTEM_ADMIN', 'A', ['OPERATIONS'], null],
    ['exec@a.example', 'EXECUTIVE', 'A', [], null],
    ['opm@a.example', 'DEPARTMENT_MANAGER', 'A', ['OPERATIONS'], ['X']],
    ['ops@a.example', 'DEPARTMENT_STAFF', 'A', ['OPERATIONS'], ['X']],
    ['ops2@a.example', 'DEPARTMENT_STAFF', 'A', ['OPERATIONS'], ['X']],
    ['opm.ho@a.example', 'DEPARTMENT_MANAGER', 'A', ['OPERATIONS'], ['HO']],
    ['sales@a.example', 'DEPARTMENT_STAFF', 'A', ['SALES'], ['X']],
    ['wh@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['X']],
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
    B = await createActiveCompany(h.db, { name: 'Beta', departments: ['SALES', 'OPERATIONS'] });
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
    it_.pcs = pcs.id;
    it_.kg = kg.id;
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
    it_.fg2 = (await item('FG-2')).id;
    it_.rm = (await item('RM-1', { type: 'RAW_MATERIAL', baseUnitId: kg.id })).id;
    it_.pk = (await item('PK-1', { type: 'PACKAGING' })).id;
    it_.lotrm = (
      await item('RM-LOT', {
        type: 'RAW_MATERIAL',
        baseUnitId: kg.id,
        lotTracking: 'REQUIRED',
        expiryTracking: 'REQUIRED',
      })
    ).id;
    it_.svc = (await item('SVC-1', { type: 'NON_STOCK', inventoryTracked: false })).id;
    it_.off = (
      await item('RM-OFF', { type: 'RAW_MATERIAL', status: 'INACTIVE', deactivatedAt: new Date() })
    ).id;
    const bpcs = await h.db.unit.create({
      data: { companyId: B.companyId, code: 'PCS', name: 'Piece', precision: 0 },
    });
    foreignItem = (
      await h.db.item.create({
        data: {
          companyId: B.companyId,
          code: 'RM-B',
          type: 'RAW_MATERIAL',
          name: 'Beta material',
          baseUnitId: bpcs.id,
        },
      })
    ).id;
    customer = (
      await h.db.customer.create({
        data: { companyId: A.companyId, code: 'CUS-000001', name: 'Secret Customer Ltd' },
      })
    ).id;
    const location = (branchId: string, c: string) =>
      h.db.warehouseLocation.create({
        data: { companyId: A.companyId, branchId, code: c, name: `Loc ${c}` },
      });
    loc.MAIN = (await location(br.X, 'MAIN')).id;
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
  const owner = () => as('owner@a.example');
  const opm = () => as('opm@a.example');
  const ops = () => as('ops@a.example');
  const stockIn = async (itemId: string, quantity: string, locationId = loc.MAIN!, lot: J = {}) => {
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
  /** An ACTIVE BOM (manager): per `output` FG, the given materials. */
  const activeBom = async (itemId: string, lines: [string, string][], output = '1') => {
    const m = await opm();
    const b = (
      await ok(
        m.post(`${P}/boms`, {
          itemId,
          outputQuantity: output,
          lines: lines.map(([i, quantity]) => ({ itemId: i, quantity })),
        }),
        201,
      )
    ).bom;
    return (await ok(m.post(`${P}/boms/${b.id}/activate`))).bom;
  };
  const draft = async (body: J, who = ops) =>
    (await ok((await who()).post(`${P}/orders`, body), 201)).order;
  const act = (b: Browser, id: string, action: string, body: J = {}) =>
    b.post(`${P}/orders/${id}/${action}`, body);
  /** A confirmed sales order in branch X with one line per [item, quantity]. */
  const confirmedSo = async (lines: [string, string][], allocate = false) => {
    const o = await owner();
    const d = (
      await ok(
        o.post(SO, {
          customerId: customer,
          note: 'Commercial note: secret',
          lines: lines.map(([itemId, quantity]) => ({ itemId, quantity, unitPrice: '777.77' })),
        }),
        201,
      )
    ).order;
    await ok(o.post(`${SO}/${d.id}/submit`));
    await ok(o.post(`${SO}/${d.id}/confirm`));
    if (allocate) await ok(o.post(`${SO}/${d.id}/allocate`));
    return (await ok(o.get(`${SO}/${d.id}`))).order;
  };
  /** The inventory state production must never change. */
  const inventory = async () => {
    const [moves, balances, allocations] = await Promise.all([
      h.db.stockMovement.count(),
      h.db.stockBalance.findMany({ orderBy: { id: 'asc' } }),
      h.db.salesAllocation.findMany({ orderBy: { id: 'asc' } }),
    ]);
    return JSON.stringify({
      moves,
      balances: balances.map((b) => [b.id, b.quantityOnHand.toString(), b.updatedAt]),
      allocations: allocations.map((a) => [a.id, a.status, a.quantity.toString(), a.updatedAt]),
    });
  };
  const assertLedger = async () => {
    const bad = await h.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "StockBalance" b
      WHERE b."quantityOnHand" < 0 OR b."quantityOnHand" <> (
        SELECT COALESCE(SUM(m."quantityDelta"), 0) FROM "StockMovement" m
        WHERE m."locationId" = b."locationId" AND m."itemId" = b."itemId"
          AND COALESCE(m."lotId", '') = b."lotKey")`;
    expect(Number(bad[0]!.n)).toBe(0);
  };

  // ---------------------------------------------------------------- BOM

  it('BOM: draft, edit, activate; active is immutable (API and database); revise supersedes', async () => {
    const staff = await ops();
    expect(
      (await staff.post(`${P}/boms`, { itemId: it_.fg, outputQuantity: '1', lines: [] }))
        .statusCode,
    ).toBe(403);
    const m = await opm();
    const d = (
      await ok(
        m.post(`${P}/boms`, {
          itemId: it_.fg,
          outputQuantity: '2',
          lines: [{ itemId: it_.rm, quantity: '0.5' }],
        }),
        201,
      )
    ).bom;
    expect(d).toMatchObject({ code: 'BOM-FG-1', revision: 1, status: 'DRAFT', lineCount: 1 });
    expect(d.actions).toEqual(['edit', 'activate', 'retire']);
    const e = (
      await ok(
        m.patch(`${P}/boms/${d.id}`, {
          outputQuantity: '1',
          lines: [
            { itemId: it_.rm, quantity: '0.25', unitId: it_.kg },
            { itemId: it_.pk, quantity: '1' },
          ],
        }),
      )
    ).bom;
    expect(e.lines.map((l: J) => [l.item.code, l.quantity, l.unit.code])).toEqual([
      ['RM-1', '0.25', 'KG'],
      ['PK-1', '1', 'PCS'],
    ]);
    const a = (await ok(m.post(`${P}/boms/${d.id}/activate`))).bom;
    expect(a).toMatchObject({ status: 'ACTIVE', actions: ['retire', 'revise'] });
    expect(code(await m.patch(`${P}/boms/${d.id}`, { outputQuantity: '3' }))).toBe(
      'BOM_NOT_EDITABLE',
    );
    expect(code(await m.post(`${P}/boms/${d.id}/activate`))).toBe('BOM_INVALID_TRANSITION');
    // The database refuses it as well.
    await expect(
      h.db.productionBom.update({ where: { id: d.id }, data: { outputQuantity: '5' } }),
    ).rejects.toThrow(/immutable/);
    const line = await h.db.productionBomLine.findFirstOrThrow({ where: { bomId: d.id } });
    await expect(
      h.db.productionBomLine.update({ where: { id: line.id }, data: { quantity: '9' } }),
    ).rejects.toThrow(/immutable/);
    await expect(h.db.productionBom.delete({ where: { id: d.id } })).rejects.toThrow(
      /never deleted/,
    );
    await expect(
      h.db.productionBom.update({
        where: { id: d.id },
        data: { status: 'DRAFT', activeSlot: null },
      }),
    ).rejects.toThrow();
    // A new revision copies the lines; activating it retires R1.
    const r2 = (await ok(m.post(`${P}/boms/${d.id}/revise`), 201)).bom;
    expect(r2).toMatchObject({ revision: 2, status: 'DRAFT', lineCount: 2 });
    await ok(m.patch(`${P}/boms/${r2.id}`, { lines: [{ itemId: it_.rm, quantity: '0.2' }] }));
    await ok(m.post(`${P}/boms/${r2.id}/activate`));
    const r1 = (await ok(m.get(`${P}/boms/${d.id}`))).bom;
    expect(r1).toMatchObject({ status: 'RETIRED', retirementReason: 'Superseded by revision 2' });
    expect(r1.revisions.map((r: J) => [r.revision, r.status])).toEqual([
      [2, 'ACTIVE'],
      [1, 'RETIRED'],
    ]);
    expect(await h.db.productionBom.count({ where: { itemId: it_.fg, status: 'ACTIVE' } })).toBe(1);
    // Retiring an active revision needs a reason; a retired one is final.
    expect(code(await m.post(`${P}/boms/${r2.id}/retire`, {}))).toBe('REASON_REQUIRED');
    await ok(m.post(`${P}/boms/${r2.id}/retire`, { reason: 'Formula withdrawn' }));
    expect(code(await m.post(`${P}/boms/${r2.id}/retire`, { reason: 'x' }))).toBe(
      'BOM_INVALID_TRANSITION',
    );
    // Lists and reads: staff and executive may read; executive may not manage.
    expect((await ok(staff.get(`${P}/boms?itemId=${it_.fg}`))).total).toBe(2);
    const exec = await as('exec@a.example');
    expect((await ok(exec.get(`${P}/boms`))).total).toBe(2);
    expect((await exec.post(`${P}/boms/${d.id}/revise`)).statusCode).toBe(403);
    const tl = (await ok(m.get(`${P}/boms/${d.id}`))).timeline.map((t: J) => t.type);
    expect(tl).toEqual([
      'PRODUCTION_BOM_CREATED',
      'PRODUCTION_BOM_UPDATED',
      'PRODUCTION_BOM_ACTIVATED',
      'PRODUCTION_BOM_RETIRED',
    ]);
  });

  it('BOM validity: items, company, type, self, duplicates, stock, units, precision, mass assignment', async () => {
    const m = await opm();
    const bom = (itemId: string, lines: J[], extra: J = {}) =>
      m.post(`${P}/boms`, { itemId, outputQuantity: '1', lines, ...extra });
    const rm = (q = '1', extra: J = {}) => ({ itemId: it_.rm, quantity: q, ...extra });
    expect(code(await bom('nope', [rm()]))).toBe('REFERENCE_NOT_FOUND');
    expect(code(await bom(it_.fg, [{ itemId: foreignItem, quantity: '1' }]))).toBe(
      'REFERENCE_NOT_FOUND',
    );
    expect(code(await bom(it_.rm, [{ itemId: it_.pk, quantity: '1' }]))).toBe(
      'ITEM_NOT_MANUFACTURABLE',
    );
    expect(code(await bom(it_.svc, [rm()]))).toBe('ITEM_NOT_MANUFACTURABLE');
    expect(code(await bom(it_.fg, [{ itemId: it_.fg, quantity: '1' }]))).toBe('BOM_SELF_REFERENCE');
    expect(code(await bom(it_.fg, [rm(), rm('2')]))).toBe('DUPLICATE_MATERIAL');
    expect(code(await bom(it_.fg, [{ itemId: it_.svc, quantity: '1' }]))).toBe(
      'MATERIAL_NOT_STOCK',
    );
    expect(code(await bom(it_.fg, [{ itemId: it_.off, quantity: '1' }]))).toBe(
      'REFERENCE_INACTIVE',
    );
    expect(code(await bom(it_.fg, [rm('0.0005')]))).toBe('QUANTITY_PRECISION');
    expect(code(await bom(it_.fg, [{ itemId: it_.pk, quantity: '1.5' }]))).toBe(
      'QUANTITY_PRECISION',
    );
    expect(code(await bom(it_.fg, [rm()], { outputQuantity: '0.5' }))).toBe('QUANTITY_PRECISION');
    expect(code(await bom(it_.fg, [rm('1', { unitId: it_.pcs })]))).toBe(
      'UNIT_CONVERSION_UNSUPPORTED',
    );
    expect(code(await bom(it_.fg, [rm()], { unitId: it_.kg }))).toBe('UNIT_CONVERSION_UNSUPPORTED');
    // Zero / negative quantities and server-owned fields are refused at the door.
    expect((await bom(it_.fg, [rm('0')])).statusCode).toBe(400);
    expect((await bom(it_.fg, [rm('-1')])).statusCode).toBe(400);
    expect((await bom(it_.fg, [rm()], { outputQuantity: '0' })).statusCode).toBe(400);
    for (const extra of [
      { status: 'ACTIVE' },
      { revision: 7 },
      { code: 'X' },
      { companyId: B.companyId },
    ])
      expect((await bom(it_.fg, [rm()], extra)).statusCode).toBe(400);
    expect((await bom(it_.fg, [rm('1', { lineNo: 3 })])).statusCode).toBe(400);
    // An empty draft cannot be activated; nothing was created by the refusals.
    const empty = (await ok(bom(it_.fg, []), 201)).bom;
    expect(code(await m.post(`${P}/boms/${empty.id}/activate`))).toBe('BOM_EMPTY');
    expect(await h.db.productionBom.count()).toBe(1);
    // Another company never sees it.
    const other = await signIn(h, 'owner@b.example');
    expect((await other.get(`${P}/boms/${empty.id}`)).statusCode).toBe(404);
    expect((await other.post(`${P}/boms/${empty.id}/activate`)).statusCode).toBe(404);
  });

  // ---------------------------------------------------------------- orders

  it('manual order: requirements computed, edited, submitted, approved and frozen — zero inventory writes', async () => {
    await stockIn(it_.rm, '30');
    await stockIn(it_.pk, '50');
    const bom = await activeBom(it_.fg, [
      [it_.rm, '0.25'],
      [it_.pk, '1'],
    ]);
    const before = await inventory();
    const staff = await ops();
    // The client never authors requirements, status or snapshots.
    for (const extra of [
      { materials: [] },
      { status: 'APPROVED' },
      { requiredQuantity: '1' },
      { approvedBy: 'x' },
      { companyId: B.companyId },
    ])
      expect(
        (await staff.post(`${P}/orders`, { itemId: it_.fg, quantity: '1', ...extra })).statusCode,
      ).toBe(400);
    const d = await draft({
      itemId: it_.fg,
      quantity: '100',
      plannedStartDate: shift(1),
      requiredDate: shift(4),
      priority: 'HIGH',
    });
    expect(d).toMatchObject({
      status: 'DRAFT',
      source: 'MANUAL',
      quantity: '100',
      bom: { id: bom.id, revision: 1 },
      materialState: 'MATERIALS_SHORT',
      actions: ['edit', 'submit', 'cancel'],
    });
    expect(d.number).toMatch(/^MO-\d{6}-000001$/);
    expect(
      d.materials.map((x: J) => [x.item.code, x.required, x.available, x.shortage, x.state]),
    ).toEqual([
      ['RM-1', '25', '30', '0', 'AVAILABLE'],
      ['PK-1', '100', '50', '50', 'PARTIALLY_AVAILABLE'],
    ]);
    // Editing recalculates on the server.
    const e = (await ok(staff.patch(`${P}/orders/${d.id}`, { quantity: '40' }))).order;
    expect(e.materials.map((x: J) => x.required)).toEqual(['10', '40']);
    expect(e.materialState).toBe('MATERIALS_AVAILABLE');
    expect(code(await staff.patch(`${P}/orders/${d.id}`, { quantity: '1.5' }))).toBe(
      'QUANTITY_PRECISION',
    );
    expect(
      code(
        await staff.patch(`${P}/orders/${d.id}`, {
          plannedStartDate: shift(9),
          requiredDate: shift(2),
        }),
      ),
    ).toBe('DATE_RANGE_INVALID');
    // Submit, staff cannot approve, manager approves.
    const s = (await ok(act(staff, d.id, 'submit'))).order;
    expect(s).toMatchObject({ status: 'SUBMITTED', actions: [] });
    expect(code(await act(staff, d.id, 'submit'))).toBe('MO_INVALID_TRANSITION');
    expect((await act(staff, d.id, 'approve')).statusCode).toBe(403);
    expect(code(await staff.patch(`${P}/orders/${d.id}`, { quantity: '5' }))).toBe(
      'MO_NOT_EDITABLE',
    );
    const m = await opm();
    const a = (await ok(act(m, d.id, 'approve'))).order;
    expect(a).toMatchObject({ status: 'APPROVED', frozen: true, approvedBy: { name: 'opm' } });
    expect(a.actions).toEqual(['release', 'cancel']);
    expect(code(await act(m, d.id, 'approve'))).toBe('MO_ALREADY_APPROVED');
    // Frozen: a new BOM revision changes nothing; the database refuses edits of the plan.
    const r2 = (await ok(m.post(`${P}/boms/${bom.id}/revise`), 201)).bom;
    await ok(m.patch(`${P}/boms/${r2.id}`, { lines: [{ itemId: it_.rm, quantity: '0.9' }] }));
    await ok(m.post(`${P}/boms/${r2.id}/activate`));
    const still = (await ok(m.get(`${P}/orders/${d.id}`))).order;
    expect(still.bom.revision).toBe(1);
    expect(still.materials.map((x: J) => [x.item.code, x.required])).toEqual([
      ['RM-1', '10'],
      ['PK-1', '40'],
    ]);
    await expect(
      h.db.productionOrderMaterial.updateMany({
        where: { productionOrderId: d.id },
        data: { requiredQuantity: '1' },
      }),
    ).rejects.toThrow(/frozen/);
    await expect(
      h.db.productionOrder.update({ where: { id: d.id }, data: { quantity: '1' } }),
    ).rejects.toThrow();
    await expect(
      h.db.productionOrder.update({ where: { id: d.id }, data: { status: 'DRAFT' } }),
    ).rejects.toThrow(/cannot move/);
    await expect(h.db.productionOrder.delete({ where: { id: d.id } })).rejects.toThrow(
      /never deleted/,
    );
    // Release to READY: every material available now (a snapshot, not a claim).
    const r = (await ok(act(m, d.id, 'release'))).order;
    expect(r).toMatchObject({ status: 'READY', releasedBy: { name: 'opm' }, actions: ['cancel'] });
    // Nothing in inventory moved, nothing was reserved, no finished goods appeared.
    expect(await inventory()).toBe(before);
    expect(await h.db.stockBalance.count({ where: { itemId: it_.fg } })).toBe(0);
    await assertLedger();
    const tl = (await ok(m.get(`${P}/orders/${d.id}`))).timeline.map((t: J) => t.type);
    expect(tl).toEqual([
      'PRODUCTION_ORDER_CREATED',
      'PRODUCTION_ORDER_UPDATED',
      'PRODUCTION_ORDER_SUBMITTED',
      'PRODUCTION_ORDER_APPROVED',
      'PRODUCTION_ORDER_RELEASED',
    ]);
    // Audit details: numbers and transitions only.
    const audit = await h.db.auditLog.findMany({ where: { entityType: 'ProductionOrder' } });
    for (const x of audit)
      expect(JSON.stringify(x.changes)).not.toMatch(/"quantity":|required|"40"|"100"/);
  });

  it('BOM selection: the one active revision, an explicit one, never an arbitrary or foreign one', async () => {
    const staff = await ops();
    // No active BOM: the draft has none and cannot be submitted.
    const none = await draft({ itemId: it_.fg, quantity: '5' });
    expect(none).toMatchObject({ bom: null, materials: [], materialState: 'NOT_ASSESSED' });
    expect(code(await act(staff, none.id, 'submit'))).toBe('BOM_REQUIRED');
    const b1 = await activeBom(it_.fg, [[it_.rm, '1']]);
    const other = await activeBom(it_.fg2, [[it_.rm, '2']]);
    // The draft picks up the active revision when edited.
    expect(
      (await ok(staff.patch(`${P}/orders/${none.id}`, { priority: 'LOW' }))).order.bom.id,
    ).toBe(b1.id);
    expect(
      code(await staff.post(`${P}/orders`, { itemId: it_.fg, quantity: '1', bomId: other.id })),
    ).toBe('BOM_ITEM_MISMATCH');
    expect(
      code(await staff.post(`${P}/orders`, { itemId: it_.fg, quantity: '1', bomId: 'nope' })),
    ).toBe('REFERENCE_NOT_FOUND');
    const m = await opm();
    const r2 = (await ok(m.post(`${P}/boms/${b1.id}/revise`), 201)).bom;
    expect(
      code(await staff.post(`${P}/orders`, { itemId: it_.fg, quantity: '1', bomId: r2.id })),
    ).toBe('BOM_NOT_ACTIVE');
    // Submitted on R1, then R2 is activated: approval refuses the superseded revision.
    await ok(act(staff, none.id, 'submit'));
    await ok(m.post(`${P}/boms/${r2.id}/activate`));
    expect(code(await act(m, none.id, 'approve'))).toBe('BOM_NOT_ACTIVE');
    // A draft on a retired revision is flagged.
    const d = await draft({ itemId: it_.fg2, quantity: '1' });
    await ok(m.post(`${P}/boms/${other.id}/retire`, { reason: 'Withdrawn' }));
    expect((await ok(staff.get(`${P}/orders/${d.id}`))).order.warnings).toEqual(['BOM_RETIRED']);
    // Manufacturing eligibility of the output.
    for (const itemId of [it_.rm, it_.svc, it_.off, foreignItem])
      expect((await staff.post(`${P}/orders`, { itemId, quantity: '1' })).statusCode).toBe(422);
  });

  it('reject, cancel and release rules; terminal states stay terminal', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    const staff = await ops();
    const m = await opm();
    const a = await draft({ itemId: it_.fg, quantity: '2' });
    await ok(act(staff, a.id, 'submit'));
    expect(code(await act(m, a.id, 'reject', {}))).toBe('REASON_REQUIRED');
    expect((await ok(act(m, a.id, 'reject', { reason: 'Not this week' }))).order).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Not this week',
      materialState: 'NOT_ASSESSED',
      actions: [],
    });
    expect(code(await act(m, a.id, 'approve'))).toBe('MO_INVALID_TRANSITION');
    // The creator cancels a draft (no reason); another staff member does not even see it.
    const b = await draft({ itemId: it_.fg, quantity: '2' });
    expect((await (await as('ops2@a.example')).get(`${P}/orders/${b.id}`)).statusCode).toBe(404);
    expect((await ok(act(staff, b.id, 'cancel'))).order.status).toBe('CANCELLED');
    // Approved: staff may not cancel; the manager needs a reason. Release needs materials.
    const c = await draft({ itemId: it_.fg, quantity: '3' });
    await ok(act(staff, c.id, 'submit'));
    await ok(act(m, c.id, 'approve'));
    expect((await act(staff, c.id, 'cancel', { reason: 'x' })).statusCode).toBe(403);
    const short = await act(m, c.id, 'release');
    expect([short.statusCode, code(short)]).toEqual([409, 'MATERIALS_SHORT']);
    expect(j(short).error.details.materials).toEqual(['RM-1']);
    await stockIn(it_.rm, '3');
    await ok(act(m, c.id, 'release'));
    expect(code(await act(m, c.id, 'cancel', {}))).toBe('REASON_REQUIRED');
    expect((await ok(act(m, c.id, 'cancel', { reason: 'Customer withdrew' }))).order.status).toBe(
      'CANCELLED',
    );
    expect(code(await act(m, c.id, 'release'))).toBe('MO_INVALID_TRANSITION');
    // Cancelled orders stay in history with their approval.
    const row = await h.db.productionOrder.findUniqueOrThrow({ where: { id: c.id } });
    expect(row.approvedAt).not.toBeNull();
  });

  it('availability is reservation-aware, per branch, excludes expired lots — and production reserves nothing', async () => {
    await stockIn(it_.rm, '10');
    await stockIn(it_.rm, '100', loc.HO); // another branch: never available to X
    await stockIn(it_.lotrm, '5', loc.MAIN, { newLotNumber: 'OLD', newLotExpiry: shift(10) });
    await stockIn(it_.lotrm, '7', loc.MAIN, { newLotNumber: 'NEW', newLotExpiry: shift(90) });
    await h.db.inventoryLot.updateMany({
      where: { lotNumber: 'OLD' },
      data: { expiryDate: new Date(`${shift(-1)}T00:00:00Z`) },
    });
    // Sales reserves 4 kg of the raw material in branch X.
    await confirmedSo([[it_.rm, '4']], true);
    await activeBom(it_.fg, [
      [it_.rm, '1'],
      [it_.lotrm, '1'],
    ]);
    const before = await inventory();
    const d = await draft({ itemId: it_.fg, quantity: '8' });
    expect(
      d.materials.map((x: J) => [x.item.code, x.required, x.available, x.shortage, x.state]),
    ).toEqual([
      ['RM-1', '8', '6', '2', 'PARTIALLY_AVAILABLE'],
      ['RM-LOT', '8', '7', '1', 'PARTIALLY_AVAILABLE'],
    ]);
    // Two orders see the same stock: a snapshot, not a claim.
    const d2 = await draft({ itemId: it_.fg, quantity: '6' });
    expect(d2.materials[0]).toMatchObject({ available: '6', shortage: '0', state: 'AVAILABLE' });
    const staff = await ops();
    await ok(act(staff, d.id, 'submit'));
    await ok(act(await opm(), d.id, 'approve'));
    expect(await inventory()).toBe(before);
    // Preview (nothing saved) and the branch requirements view agree.
    const bomId = d.bom.id;
    const pv = await ok(staff.get(`${P}/requirements/preview?bomId=${bomId}&quantity=3`));
    expect(pv).toMatchObject({ materialState: 'MATERIALS_AVAILABLE', quantity: '3' });
    expect(await h.db.productionOrder.count()).toBe(2);
    const req = await ok(staff.get(`${P}/requirements`));
    expect(
      req.items.map((x: J) => [x.item.code, x.required, x.available, x.shortage, x.orderCount]),
    ).toEqual([
      ['RM-1', '8', '6', '2', 1],
      ['RM-LOT', '8', '7', '1', 1],
    ]);
    // Shortage filter on the list.
    const short = await ok(staff.get(`${P}/orders?materials=SHORT`));
    expect(short.items.map((x: J) => x.id)).toEqual([d.id]);
  });

  // ---------------------------------------------------------------- sales demand

  it('sales demand: open = ordered − reserved − dispatched, shared stock, planned orders counted once, warnings', async () => {
    await stockIn(it_.fg, '60');
    await activeBom(it_.fg, [[it_.rm, '1']]);
    const so = await confirmedSo([[it_.fg, '100']], true); // 60 reserved from stock
    const staff = await ops();
    const q1 = await ok(staff.get(`${P}/demand`));
    expect(q1.items).toHaveLength(1);
    expect(q1.items[0]).toMatchObject({
      salesOrder: { number: so.number, status: 'CONFIRMED' },
      lineNo: 1,
      ordered: '100',
      reserved: '60',
      dispatched: '0',
      open: '40',
      availableShare: '0',
      uncovered: '40',
      planned: '0',
      suggested: '40',
    });
    // Nothing commercial leaks: no price, total, customer or note.
    const text = JSON.stringify(q1);
    expect(text).not.toMatch(/777|Secret|Commercial/);
    expect(keysOf(q1.items).filter((k) => MONEY.test(k))).toEqual([]);
    const lineId = q1.items[0].lineId;
    // The server takes branch and item from the sales line; the client cannot send them.
    expect(
      (
        await staff.post(`${P}/orders`, {
          salesOrderLineId: lineId,
          quantity: '40',
          branchId: br.X,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await staff.post(`${P}/orders`, {
          salesOrderLineId: lineId,
          quantity: '40',
          itemId: it_.fg,
        })
      ).statusCode,
    ).toBe(400);
    const mo = await draft({ salesOrderLineId: lineId, quantity: '40' });
    expect(mo).toMatchObject({
      source: 'SALES_DEMAND',
      branch: { id: br.X },
      item: { id: it_.fg },
      salesOrder: { number: so.number, lineNo: 1, status: 'CONFIRMED' },
      demand: { open: '40', plannedElsewhere: '0', overPlanned: false },
      warnings: [],
    });
    expect(JSON.stringify(mo)).not.toMatch(/777|Secret|Commercial/);
    expect(keysOf(mo).filter((k) => MONEY.test(k))).toEqual([]);
    const q2 = (await ok(staff.get(`${P}/demand`))).items[0];
    expect(q2).toMatchObject({ planned: '40', suggested: '0' });
    expect(q2.orders.map((o: J) => o.number)).toEqual([mo.number]);
    // A second order for the same shortage is allowed but flagged on both.
    const dup = await draft({ salesOrderLineId: lineId, quantity: '10' });
    expect(dup.warnings).toEqual(['DEMAND_ALREADY_PLANNED']);
    expect(dup.demand).toMatchObject({ plannedElsewhere: '40', overPlanned: true });
    expect((await ok(staff.get(`${P}/orders/${mo.id}`))).order.warnings).toEqual([
      'DEMAND_ALREADY_PLANNED',
    ]);
    // Cancelling the duplicate clears it; context counts the demand to review.
    await ok(act(staff, dup.id, 'cancel'));
    expect((await ok(staff.get(`${P}/orders/${mo.id}`))).order.warnings).toEqual([]);
    // Ineligible sources.
    const draftSo = (
      await ok(
        (await owner()).post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.fg, quantity: '5', unitPrice: '1' }],
        }),
        201,
      )
    ).order;
    const draftLine = (
      await h.db.salesOrderLine.findFirstOrThrow({ where: { salesOrderId: draftSo.id } })
    ).id;
    expect(
      code(await staff.post(`${P}/orders`, { salesOrderLineId: draftLine, quantity: '1' })),
    ).toBe('SALES_SOURCE_NOT_CONFIRMED');
    const svc = await confirmedSo([[it_.svc, '2']]);
    expect(
      code(await staff.post(`${P}/orders`, { salesOrderLineId: svc.lines[0].id, quantity: '1' })),
    ).toBe('ITEM_NOT_MANUFACTURABLE');
    expect(
      (await staff.post(`${P}/orders`, { salesOrderLineId: 'nope', quantity: '1' })).statusCode,
    ).toBe(404);
    // A line of a branch this member cannot work in is not found (no existence leak).
    expect(
      (
        await (
          await as('opm.ho@a.example', 'HO')
        ).post(`${P}/orders`, { salesOrderLineId: lineId, quantity: '1' })
      ).statusCode,
    ).toBe(404);
    // The planned output never becomes stock and never feeds Sales allocation.
    expect(
      (await ok((await owner()).get(`${SO}/${so.id}`))).order.lines[0].allocation.allocated,
    ).toBe('60');
  });

  it('sales cancellation: approval re-validates the source; a cancelled source is flagged, never silently active', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    const staff = await ops();
    const m = await opm();
    const so1 = await confirmedSo([[it_.fg, '5']]);
    const a = await draft({ salesOrderLineId: so1.lines[0].id, quantity: '5' });
    await ok(act(staff, a.id, 'submit'));
    await ok((await owner()).post(`${SO}/${so1.id}/cancel`, { reason: 'Customer cancelled' }));
    expect(code(await act(m, a.id, 'approve'))).toBe('SALES_SOURCE_NOT_CONFIRMED');
    expect((await ok(m.get(`${P}/orders/${a.id}`))).order).toMatchObject({
      attention: 'SOURCE_CANCELLED',
      warnings: ['SOURCE_CANCELLED'],
    });
    // Approved first, cancelled after: the order stays, flagged for review.
    const so2 = await confirmedSo([[it_.fg, '5']]);
    const b = await draft({ salesOrderLineId: so2.lines[0].id, quantity: '5' });
    await ok(act(staff, b.id, 'submit'));
    await ok(act(m, b.id, 'approve'));
    await ok((await owner()).post(`${SO}/${so2.id}/cancel`, { reason: 'Customer cancelled' }));
    expect((await ok(m.get(`${P}/orders/${b.id}`))).order).toMatchObject({
      status: 'APPROVED',
      attention: 'SOURCE_CANCELLED',
    });
    expect((await ok(m.get(`${P}/context`))).counts.sourceCancelled).toBe(2);
    // A new order from a cancelled sales order is refused; release too.
    expect(
      code(await staff.post(`${P}/orders`, { salesOrderLineId: so2.lines[0].id, quantity: '1' })),
    ).toBe('SALES_SOURCE_NOT_CONFIRMED');
    expect(code(await act(m, b.id, 'release'))).toBe('SALES_SOURCE_NOT_CONFIRMED');
    expect(
      (await ok(act(m, b.id, 'cancel', { reason: 'Source cancelled' }))).order.attention,
    ).toBeNull();
  });

  it('Purchasing handoff: read-only shortages of approved orders — no value, no customer', async () => {
    await stockIn(it_.rm, '2');
    await activeBom(it_.fg, [[it_.rm, '0.5']]);
    const staff = await ops();
    const m = await opm();
    const a = await draft({ itemId: it_.fg, quantity: '10', requiredDate: shift(5) });
    await ok(act(staff, a.id, 'submit'));
    const sub = await draft({ itemId: it_.fg, quantity: '100' }); // a draft: not handed off
    expect(sub.status).toBe('DRAFT');
    await ok(act(m, a.id, 'approve'));
    const pur = await as('pur@a.example');
    const s = await ok(pur.get('/api/v1/purchasing/production-shortages'));
    expect(s.items).toEqual([
      expect.objectContaining({
        order: expect.objectContaining({
          number: a.number,
          status: 'APPROVED',
          requiredDate: shift(5),
        }),
        material: expect.objectContaining({ code: 'RM-1' }),
        required: '5',
        available: '2',
        shortage: '3',
      }),
    ]);
    expect(keysOf(s).filter((k) => MONEY.test(k))).toEqual([]);
    // Purchasing reads the handoff only — never production orders or BOMs; no request was raised.
    expect((await pur.get(`${P}/orders`)).statusCode).toBe(403);
    expect((await pur.get(`${P}/boms`)).statusCode).toBe(403);
    expect((await pur.post(`${P}/orders/${a.id}/cancel`, { reason: 'x' })).statusCode).toBe(403);
    expect(await h.db.purchaseRequest.count()).toBe(0);
    expect(await h.db.purchaseOrder.count()).toBe(0);
    // Production staff do not hold the Purchasing handoff code.
    expect((await staff.get('/api/v1/purchasing/production-shortages')).statusCode).toBe(403);
  });

  // ---------------------------------------------------------------- authority & isolation

  it('roles: staff plan, managers approve, executive reads, System Admin / Sales / Warehouse have no Production', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    const d = await draft({ itemId: it_.fg, quantity: '1' });
    await ok(act(await ops(), d.id, 'submit'));
    const exec = await as('exec@a.example');
    expect((await ok(exec.get(`${P}/orders/${d.id}`))).order.actions).toEqual([]);
    expect((await ok(exec.get(`${P}/context`))).orders).toEqual({
      view: true,
      create: false,
      approve: false,
      cancel: false,
    });
    expect((await exec.post(`${P}/orders`, { itemId: it_.fg, quantity: '1' })).statusCode).toBe(
      403,
    );
    expect((await act(exec, d.id, 'approve')).statusCode).toBe(403);
    for (const email of ['admin@a.example', 'sales@a.example', 'wh@a.example']) {
      const b = await as(email);
      expect((await b.get(`${P}/context`)).statusCode, email).toBe(403);
      expect((await b.get(`${P}/orders/${d.id}`)).statusCode, email).toBe(403);
      expect(
        (await b.post(`${P}/orders`, { itemId: it_.fg, quantity: '1' })).statusCode,
        email,
      ).toBe(403);
      expect((await b.get(`${P}/demand`)).statusCode, email).toBe(403);
    }
    // A System Admin assigned to Operations may plan but never approve (no MANAGE).
    const sa = await as('admin.ops@a.example');
    expect((await ok(sa.get(`${P}/context`))).orders).toMatchObject({
      create: true,
      approve: false,
    });
    expect((await act(sa, d.id, 'approve')).statusCode).toBe(403);
    expect(
      (await sa.post(`${P}/boms`, { itemId: it_.fg2, outputQuantity: '1', lines: [] })).statusCode,
    ).toBe(403);
    // The owner holds everything.
    expect((await ok(act(await owner(), d.id, 'approve'))).order.status).toBe('APPROVED');
    // Anonymous.
    expect((await h.app.inject({ method: 'GET', url: `${P}/orders` })).statusCode).toBe(401);
  });

  it('isolation: other branches and companies get 404; branch choice is checked; drafts stay private', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    const d = await draft({ itemId: it_.fg, quantity: '1' });
    const ho = await as('opm.ho@a.example', 'HO');
    expect((await ho.get(`${P}/orders/${d.id}`)).statusCode).toBe(404);
    expect((await act(ho, d.id, 'cancel')).statusCode).toBe(404);
    expect((await ho.patch(`${P}/orders/${d.id}`, { quantity: '2' })).statusCode).toBe(404);
    expect((await ok(ho.get(`${P}/orders`))).total).toBe(0);
    const b = await signIn(h, 'owner@b.example');
    expect((await b.get(`${P}/orders/${d.id}`)).statusCode).toBe(404);
    expect((await b.post(`${P}/orders/${d.id}/submit`)).statusCode).toBe(404);
    // Staff of branch X may not plan in the Head Office.
    const staff = await ops();
    expect(
      code(await staff.post(`${P}/orders`, { itemId: it_.fg, quantity: '1', branchId: br.HO })),
    ).toBe('BRANCH_NOT_ALLOWED');
    expect((await staff.get(`${P}/demand?branchId=${br.HO}`)).statusCode).toBe(403);
    // An unknown id is 404 (never 500).
    expect((await staff.get(`${P}/orders/nope`)).statusCode).toBe(404);
    expect((await staff.get(`${P}/boms/nope`)).statusCode).toBe(404);
  });

  // ---------------------------------------------------------------- races

  it('race: concurrent creation numbers uniquely and consecutively', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    const staff = await ops();
    const res = await Promise.all(
      Array.from({ length: 8 }, () => staff.post(`${P}/orders`, { itemId: it_.fg, quantity: '1' })),
    );
    expect(res.map((r) => r.statusCode)).toEqual(Array(8).fill(201));
    const nums = res.map((r) => j(r).order.number as string).sort();
    expect(new Set(nums).size).toBe(8);
    expect(nums.map((n) => Number(n.slice(-6)))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('race: double submit, triple approve, approve vs reject, release vs cancel, edit vs submit — one transition each', async () => {
    await stockIn(it_.rm, '100');
    await activeBom(it_.fg, [[it_.rm, '1']]);
    const staff = await ops();
    const m = await opm();
    const o = await owner();
    for (let round = 0; round < 3; round++) {
      const d = await draft({ itemId: it_.fg, quantity: '2' });
      const subs = await Promise.all([act(staff, d.id, 'submit'), act(staff, d.id, 'submit')]);
      expect(subs.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      const apps = await Promise.all([
        act(m, d.id, 'approve'),
        act(m, d.id, 'approve'),
        act(o, d.id, 'approve'),
      ]);
      expect(apps.map((r) => r.statusCode).sort()).toEqual([200, 409, 409]);
      expect(
        await h.db.auditLog.count({
          where: { entityId: d.id, action: 'PRODUCTION_ORDER_APPROVED' },
        }),
      ).toBe(1);

      const e = await draft({ itemId: it_.fg, quantity: '2' });
      await ok(act(staff, e.id, 'submit'));
      const ar = await Promise.all([
        act(m, e.id, 'approve'),
        act(o, e.id, 'reject', { reason: 'No' }),
      ]);
      expect(ar.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      const final = await h.db.productionOrder.findUniqueOrThrow({ where: { id: e.id } });
      expect(['APPROVED', 'REJECTED']).toContain(final.status);
      expect(!!final.approvedAt && !!final.rejectedAt).toBe(false);

      const f = await draft({ itemId: it_.fg, quantity: '2' });
      await ok(act(staff, f.id, 'submit'));
      await ok(act(m, f.id, 'approve'));
      const rc = await Promise.all([
        act(m, f.id, 'release'),
        act(o, f.id, 'cancel', { reason: 'Stop' }),
      ]);
      expect(rc.map((r) => r.statusCode)).toContain(200);
      const ff = await h.db.productionOrder.findUniqueOrThrow({ where: { id: f.id } });
      expect(ff.status).toBe('CANCELLED'); // release then cancel, or cancel first (release refused)

      const g = await draft({ itemId: it_.fg, quantity: '2' });
      const es = await Promise.all([
        staff.patch(`${P}/orders/${g.id}`, { quantity: '7' }),
        act(staff, g.id, 'submit'),
      ]);
      expect(es.map((r) => r.statusCode)).toContain(200);
      const gg = await h.db.productionOrder.findUniqueOrThrow({
        where: { id: g.id },
        include: { materials: true },
      });
      // Whatever the order, the stored requirements match the stored quantity.
      expect(gg.materials[0]!.requiredQuantity.toString()).toBe(gg.quantity.toString());
    }
    await assertLedger();
  });

  it('race: BOM activation — one active revision per item, a draft activates once', async () => {
    const m = await opm();
    const o = await owner();
    for (let round = 0; round < 3; round++) {
      const mk = async (q: string) =>
        (
          await ok(
            m.post(`${P}/boms`, {
              itemId: it_.fg,
              outputQuantity: '1',
              lines: [{ itemId: it_.rm, quantity: q }],
            }),
            201,
          )
        ).bom;
      const [x, y] = await Promise.all([mk('1'), mk('2')]);
      expect(x.revision).not.toBe(y.revision);
      const both = await Promise.all([
        m.post(`${P}/boms/${x.id}/activate`),
        o.post(`${P}/boms/${y.id}/activate`),
      ]);
      expect(both.map((r) => r.statusCode)).toEqual([200, 200]);
      expect(await h.db.productionBom.count({ where: { itemId: it_.fg, status: 'ACTIVE' } })).toBe(
        1,
      );
      const z = await mk('3');
      const twice = await Promise.all([
        m.post(`${P}/boms/${z.id}/activate`),
        o.post(`${P}/boms/${z.id}/activate`),
      ]);
      expect(twice.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      expect(await h.db.productionBom.count({ where: { itemId: it_.fg, status: 'ACTIVE' } })).toBe(
        1,
      );
    }
    const revs = await h.db.productionBom.findMany({
      where: { itemId: it_.fg },
      orderBy: { revision: 'asc' },
    });
    expect(revs.map((r) => r.revision)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('race: sales order cancel vs production approval — never approved against a cancelled source unflagged', async () => {
    await activeBom(it_.fg, [[it_.rm, '1']]);
    const staff = await ops();
    const m = await opm();
    for (let round = 0; round < 3; round++) {
      const so = await confirmedSo([[it_.fg, '3']]);
      const d = await draft({ salesOrderLineId: so.lines[0].id, quantity: '3' });
      await ok(act(staff, d.id, 'submit'));
      const [ap, cn] = await Promise.all([
        act(m, d.id, 'approve'),
        (await owner()).post(`${SO}/${so.id}/cancel`, { reason: 'Race' }),
      ]);
      expect(cn.statusCode).toBe(200);
      const row = await h.db.productionOrder.findUniqueOrThrow({ where: { id: d.id } });
      const sales = await h.db.salesOrder.findUniqueOrThrow({ where: { id: so.id } });
      if (ap.statusCode === 200) {
        expect(row.approvedAt!.getTime()).toBeLessThanOrEqual(sales.cancelledAt!.getTime());
        expect((await ok(m.get(`${P}/orders/${d.id}`))).order.attention).toBe('SOURCE_CANCELLED');
      } else {
        expect(code(ap)).toBe('SALES_SOURCE_NOT_CONFIRMED');
        expect(row.status).toBe('SUBMITTED');
      }
    }
  });

  it('overview counts and list filters are server-side and paginated', async () => {
    await stockIn(it_.rm, '5');
    await activeBom(it_.fg, [[it_.rm, '1']]);
    const staff = await ops();
    const m = await opm();
    const mk = async (q: string, to: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'READY') => {
      const d = await draft({ itemId: it_.fg, quantity: q, plannedStartDate: shift(Number(q)) });
      if (to !== 'DRAFT') await ok(act(staff, d.id, 'submit'));
      if (to === 'APPROVED' || to === 'READY') await ok(act(m, d.id, 'approve'));
      if (to === 'READY') await ok(act(m, d.id, 'release'));
      return d;
    };
    await mk('1', 'DRAFT');
    await mk('2', 'SUBMITTED');
    await mk('3', 'APPROVED');
    await mk('4', 'READY');
    await mk('50', 'APPROVED'); // short
    const c = (await ok(staff.get(`${P}/context`))).counts;
    expect(c).toMatchObject({
      myDrafts: 1,
      awaitingApproval: 1,
      approved: 2,
      ready: 1,
      materialsShort: 1,
    });
    const page1 = await ok(staff.get(`${P}/orders?pageSize=2`));
    expect([page1.total, page1.items.length, page1.hasMore]).toEqual([5, 2, true]);
    expect((await ok(staff.get(`${P}/orders?status=APPROVED`))).total).toBe(2);
    expect((await ok(staff.get(`${P}/orders?source=SALES_DEMAND`))).total).toBe(0);
    expect((await ok(staff.get(`${P}/orders?from=${shift(2)}&to=${shift(4)}`))).total).toBe(3);
    expect((await ok(staff.get(`${P}/orders?q=FG-1`))).total).toBe(5);
    expect((await staff.get(`${P}/orders?status=IN_PRODUCTION`)).statusCode).toBe(400);
    expect((await staff.get(`${P}/orders?pageSize=500`)).statusCode).toBe(400);
  });
});
