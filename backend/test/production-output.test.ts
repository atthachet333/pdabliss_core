import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { BUSINESS_AUDIT_ENTITIES } from '../src/company/audit.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { permissionDefinition } from '../src/permissions/catalog.js';
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
 * EP38 finished goods output, receipt and production completion. Reporting and
 * accepting output never moves stock; only a POSTED finished goods receipt
 * writes PRODUCTION_OUTPUT through ledger.ts — never more than was accepted,
 * never twice. Completion closes an order only when every output is reviewed and
 * every accepted unit is in stock; a short close keeps the shortfall visible.
 * Throughout: balance = Σ movements, nothing negative, Warehouse sees no money.
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

describeDb('Production output, receipt and completion (EP38)', () => {
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
  const mat = (o: J, itemId: string) => o.materials.find((m: J) => m.item.id === itemId);
  const allocate = async (id: string, who = opm) =>
    ok((await who()).post(`${P}/orders/${id}/materials/allocate`, {}));
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
  const movements = () => h.db.stockMovement.count();

  // ---------------------------------------------------------------- EP38 helpers

  const whs = () => as('wh@a.example');
  const whm = () => as('whm@a.example');
  /** An order IN_PRODUCTION of `qty` FG (materials PK 1:1 reserved and issued). */
  const producing = async (qty: string, item = it_.fg) => {
    if (!(await h.db.productionBom.findFirst({ where: { itemId: item, status: 'ACTIVE' } }))) {
      await activeBom(item, [[it_.pk, '1']]);
    }
    await stockIn(it_.pk, qty);
    const d = (await ok((await ops()).post(`${P}/orders`, { itemId: item, quantity: qty }), 201))
      .order;
    await ok((await ops()).post(`${P}/orders/${d.id}/submit`, {}));
    await ok((await opm()).post(`${P}/orders/${d.id}/approve`, {}));
    await allocate(d.id);
    await ok((await opm()).post(`${P}/orders/${d.id}/release`, {}));
    await ok((await opm()).post(`${P}/orders/${d.id}/start`, {}));
    await post((await draftIssue(d.id)).id);
    return (await ok((await opm()).get(`${P}/orders/${d.id}`))).order;
  };
  const report = async (orderId: string, good: string, extra: J = {}) =>
    (
      await ok(
        (await ops()).post(`${P}/outputs`, {
          productionOrderId: orderId,
          productionDate: TODAY,
          goodQuantity: good,
          ...extra,
        }),
        201,
      )
    ).report;
  /** Reported, submitted and accepted (pendingGood optional). */
  const accepted = async (orderId: string, good: string, extra: J = {}, pendingGood?: string) => {
    const r = await report(orderId, good, extra);
    await ok((await ops()).post(`${P}/outputs/${r.id}/submit`, {}));
    return (
      await ok(
        (await opm()).post(
          `${P}/outputs/${r.id}/accept`,
          pendingGood !== undefined ? { pendingGood } : {},
        ),
      )
    ).report;
  };
  const FG = `${W}/finished-goods`;
  const receipt = async (outputReportId: string, lines: J[]) =>
    (await ok((await whs()).post(`${FG}/receipts`, { outputReportId, lines }), 201)).receipt;
  const line = (quantity: string, over: J = {}) => ({ locationId: loc.MAIN, quantity, ...over });
  const postFg = async (id: string) =>
    (await ok((await whm()).post(`${FG}/receipts/${id}/post`, {}))).receipt;
  const order = async (id: string) => (await ok((await opm()).get(`${P}/orders/${id}`))).order;
  /** Balance = Σ movements, nothing negative; every PRODUCTION_OUTPUT is one line of a POSTED / REVERSED receipt. */
  const assertLedger = async () => {
    const ledger = await h.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "StockBalance" b
      WHERE b."quantityOnHand" < 0 OR b."quantityOnHand" <> (
        SELECT COALESCE(SUM(m."quantityDelta"), 0) FROM "StockMovement" m
        WHERE m."locationId" = b."locationId" AND m."itemId" = b."itemId"
          AND COALESCE(m."lotId", '') = b."lotKey")`;
    expect(Number(ledger[0]!.n)).toBe(0);
    const bad = await h.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "StockMovement" m
      LEFT JOIN "ProductionGoodsReceiptLine" l ON l."id" = m."productionGoodsReceiptLineId"
      LEFT JOIN "ProductionGoodsReceipt" r ON r."id" = l."receiptId"
      WHERE m."type" IN ('PRODUCTION_OUTPUT', 'PRODUCTION_OUTPUT_REVERSAL')
        AND (l."id" IS NULL OR r."status" NOT IN ('POSTED', 'REVERSED') OR abs(m."quantityDelta") <> l."quantity"
          OR (m."type" = 'PRODUCTION_OUTPUT_REVERSAL' AND r."status" <> 'REVERSED'))`;
    expect(Number(bad[0]!.n)).toBe(0);
    // Never more received than accepted, per output report.
    const over = await h.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "ProductionOutputReport" o
      WHERE COALESCE(o."acceptedQuantity", 0) < (
        SELECT COALESCE(SUM(l."quantity"), 0) FROM "ProductionGoodsReceiptLine" l
        JOIN "ProductionGoodsReceipt" r ON r."id" = l."receiptId"
        WHERE r."outputReportId" = o."id" AND r."status" = 'POSTED')`;
    expect(Number(over[0]!.n)).toBe(0);
  };

  // ---------------------------------------------------------------- EP38

  it('full completion: report → accept → receive (PRODUCTION_OUTPUT) → Sales sees it → complete', async () => {
    const o = await producing('10');
    const before = await movements();
    const r = await report(o.id, '10');
    expect(r.number).toMatch(/^OUT-\d{6}-\d{6}$/);
    // Reporting and accepting output never moves stock.
    expect(await onHand(it_.fg)).toBe('0');
    expect(code(await (await ops()).post(`${P}/outputs/${r.id}/accept`, {}))).toBe(
      'PERMISSION_DENIED',
    );
    await ok((await ops()).post(`${P}/outputs/${r.id}/submit`, {}));
    const acc = (await ok((await opm()).post(`${P}/outputs/${r.id}/accept`, {}))).report;
    expect(acc).toMatchObject({ status: 'ACCEPTED', accepted: '10', rejected: '0' });
    expect(await movements()).toBe(before);
    expect(await onHand(it_.fg)).toBe('0');
    // Sales cannot allocate output that is not in stock.
    const own = await owner();
    const so = (
      await ok(
        own.post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.fg, quantity: '4', unitPrice: '777.77' }],
        }),
        201,
      )
    ).order;
    await ok(own.post(`${SO}/${so.id}/submit`));
    await ok(own.post(`${SO}/${so.id}/confirm`));
    expect(await reservedSum('sales', { itemId: it_.fg })).toBe('0');
    // Warehouse: staff drafts, staff cannot post, manager posts.
    const pending = await ok((await whs()).get(FG));
    expect(pending.items).toHaveLength(1);
    expect(pending.items[0]).toMatchObject({ accepted: '10', received: '0', pending: '10' });
    expect(keysOf(pending.items).filter((k) => MONEY.test(k))).toEqual([]);
    const fgr = await receipt(r.id, [line('6'), line('4', { locationId: loc.QC })]);
    expect(fgr.number).toMatch(/^FGR-\d{6}-\d{6}$/);
    expect(await onHand(it_.fg)).toBe('0');
    expect(code(await (await whs()).post(`${FG}/receipts/${fgr.id}/post`, {}))).toBe(
      'PERMISSION_DENIED',
    );
    const posted = await postFg(fgr.id);
    expect(posted.status).toBe('POSTED');
    expect(keysOf(posted).filter((k) => MONEY.test(k))).toEqual([]);
    expect(JSON.stringify(posted)).not.toMatch(/777|Secret Customer/);
    expect(await onHand(it_.fg)).toBe('10');
    expect(
      await h.db.stockMovement.count({ where: { type: 'PRODUCTION_OUTPUT', itemId: it_.fg } }),
    ).toBe(2);
    // Now Sales allocation finds it — explicitly, never automatically.
    expect(await reservedSum('sales', { itemId: it_.fg })).toBe('0');
    await ok(own.post(`${SO}/${so.id}/allocate`));
    expect(await reservedSum('sales', { itemId: it_.fg })).toBe('4');
    // Completion: review, then complete (the PK reservations were all issued).
    let mo = await order(o.id);
    expect(mo.output).toMatchObject({
      target: '10',
      accepted: '10',
      received: '10',
      remaining: '0',
    });
    await ok((await opm()).post(`${P}/orders/${o.id}/review`, {}));
    mo = await order(o.id);
    expect(mo.status).toBe('COMPLETION_REVIEW');
    expect(mo.completion.blockers).toEqual([]);
    expect(
      code(
        await (
          await ops()
        ).post(`${P}/orders/${o.id}/complete`, { outcome: 'COMPLETED', materialsReviewed: true }),
      ),
    ).toBe('PERMISSION_DENIED');
    expect(
      (await (await opm()).post(`${P}/orders/${o.id}/complete`, { outcome: 'COMPLETED' }))
        .statusCode,
    ).toBe(400);
    mo = (
      await ok(
        (await opm()).post(`${P}/orders/${o.id}/complete`, {
          outcome: 'COMPLETED',
          materialsReviewed: true,
        }),
      )
    ).order;
    expect(mo).toMatchObject({ status: 'COMPLETED', completion: { outcome: 'COMPLETED' } });
    expect(mo.actions).toEqual([]);
    expect(mo.traceability.outputLots).toEqual([]);
    expect(mo.traceability.materialLots).toHaveLength(1);
    // A completed order accepts nothing more.
    expect(
      code(
        await (
          await ops()
        ).post(`${P}/outputs`, {
          productionOrderId: o.id,
          productionDate: TODAY,
          goodQuantity: '1',
        }),
      ),
    ).toBe('MO_NOT_IN_PRODUCTION');
    expect(code(await (await opm()).post(`${P}/orders/${o.id}/reopen`, {}))).toBe('MO_COMPLETED');
    expect(code(await (await opm()).post(`${P}/orders/${o.id}/materials/allocate`, {}))).toBe(
      'MO_COMPLETED',
    );
    expect(code(await (await ops()).post(`${P}/issues`, { productionOrderId: o.id }))).toBe(
      'MO_NOT_IN_PRODUCTION',
    );
    expect(code(await (await opm()).post(`${P}/orders/${o.id}/cancel`, { reason: 'x' }))).toBe(
      'MO_COMPLETED',
    );
    const timeline = (await ok((await opm()).get(`${P}/orders/${o.id}`))).timeline.map(
      (e: J) => e.type,
    );
    expect(timeline).toEqual(
      expect.arrayContaining(['PRODUCTION_ORDER_REVIEW_REQUESTED', 'PRODUCTION_ORDER_COMPLETED']),
    );
    await assertLedger();
  });

  it('partial production: 40 + 35 of 100 received, 25 outstanding, no early completion; short close', async () => {
    const o = await producing('100');
    const a = await accepted(o.id, '40', { defectiveQuantity: '5' });
    const b = await accepted(o.id, '35', { defectiveQuantity: '2' });
    expect(a).toMatchObject({ accepted: '40', rejected: '5' });
    await postFg((await receipt(a.id, [line('40')])).id);
    // One report, two receipts (partial receipt of one accepted output).
    await postFg((await receipt(b.id, [line('20')])).id);
    await postFg((await receipt(b.id, [line('15')])).id);
    let mo = await order(o.id);
    expect(mo.output).toMatchObject({
      target: '100',
      goodReported: '75',
      accepted: '75',
      rejected: '7',
      received: '75',
      awaitingReceipt: '0',
      remaining: '25',
    });
    expect(mo.status).toBe('IN_PRODUCTION');
    expect(await onHand(it_.fg)).toBe('75');
    // A fourth receipt over the accepted output is refused.
    expect(
      code(
        await (await whs()).post(`${FG}/receipts`, { outputReportId: b.id, lines: [line('1')] }),
      ),
    ).toBe('FG_EXCEEDS_ACCEPTED');
    await ok((await opm()).post(`${P}/orders/${o.id}/review`, {}));
    const full = await (
      await opm()
    ).post(`${P}/orders/${o.id}/complete`, { outcome: 'COMPLETED', materialsReviewed: true });
    expect(code(full)).toBe('SHORT_CLOSE_REQUIRED');
    expect(
      code(
        await (
          await opm()
        ).post(`${P}/orders/${o.id}/complete`, {
          outcome: 'SHORT_CLOSED',
          materialsReviewed: true,
        }),
      ),
    ).toBe('REASON_REQUIRED');
    // Reopen, more material reserved (excess), then short close releases it.
    await ok((await opm()).post(`${P}/orders/${o.id}/reopen`, {}));
    await stockIn(it_.pk, '5');
    const pkLine = mat(await order(o.id), it_.pk);
    await ok(
      (await opm()).post(`${P}/orders/${o.id}/materials/${pkLine.id}/excess`, {
        quantity: '5',
        reason: 'extra',
      }),
    );
    await ok((await opm()).post(`${P}/orders/${o.id}/review`, {}));
    mo = (
      await ok(
        (await opm()).post(`${P}/orders/${o.id}/complete`, {
          outcome: 'SHORT_CLOSED',
          reason: 'Line stopped',
          materialsReviewed: true,
        }),
      )
    ).order;
    expect(mo.completion).toMatchObject({ outcome: 'SHORT_CLOSED', reason: 'Line stopped' });
    expect(mo.quantity).toBe('100');
    expect(mo.output).toMatchObject({ accepted: '75', rejected: '7', remaining: '25' });
    expect(await reservedSum('production', { productionOrderId: o.id })).toBe('0');
    const closed = await h.db.productionMaterialAllocation.findMany({
      where: { productionOrderId: o.id, releaseReason: 'ORDER_CLOSED' },
    });
    expect(closed).toHaveLength(1);
    // Consumed material stays consumed; no finished goods for the missing units.
    expect(await onHand(it_.fg)).toBe('75');
    await assertLedger();
  });

  it('rejected goods: defective and the rejected pending part never enter stock', async () => {
    const o = await producing('50');
    const r = await report(o.id, '40', { defectiveQuantity: '5', pendingQuantity: '3' });
    await ok((await ops()).post(`${P}/outputs/${r.id}/submit`, {}));
    expect(
      code(await (await opm()).post(`${P}/outputs/${r.id}/accept`, { pendingGood: '4' })),
    ).toBe('PENDING_DECISION_INVALID');
    const acc = (await ok((await opm()).post(`${P}/outputs/${r.id}/accept`, { pendingGood: '1' })))
      .report;
    expect(acc).toMatchObject({
      good: '40',
      defective: '5',
      pending: '3',
      accepted: '41',
      rejected: '7',
    });
    expect(
      code(
        await (await whs()).post(`${FG}/receipts`, { outputReportId: r.id, lines: [line('42')] }),
      ),
    ).toBe('FG_EXCEEDS_ACCEPTED');
    await postFg((await receipt(r.id, [line('41')])).id);
    expect(await onHand(it_.fg)).toBe('41');
    // The database keeps the quality decision.
    await expect(
      h.db.productionOutputReport.update({ where: { id: r.id }, data: { acceptedQuantity: '48' } }),
    ).rejects.toThrow();
    await expect(
      h.db.productionOutputReport.update({ where: { id: r.id }, data: { goodQuantity: '50' } }),
    ).rejects.toThrow();
    await assertLedger();
  });

  it('output rules: target cap, precision, dates, empty, draft visibility, mass assignment', async () => {
    const o = await producing('10');
    expect(
      code(
        await (
          await ops()
        ).post(`${P}/outputs`, {
          productionOrderId: o.id,
          productionDate: TODAY,
          goodQuantity: '0',
        }),
      ),
    ).toBe('OUTPUT_EMPTY');
    expect(
      code(
        await (
          await ops()
        ).post(`${P}/outputs`, {
          productionOrderId: o.id,
          productionDate: TODAY,
          goodQuantity: '1.5',
        }),
      ),
    ).toBe('QUANTITY_PRECISION');
    expect(
      code(
        await (
          await ops()
        ).post(`${P}/outputs`, {
          productionOrderId: o.id,
          productionDate: shift(1),
          goodQuantity: '1',
        }),
      ),
    ).toBe('OUTPUT_DATE_INVALID');
    expect(
      (
        await (
          await ops()
        ).post(`${P}/outputs`, {
          productionOrderId: o.id,
          productionDate: TODAY,
          goodQuantity: '1',
          status: 'ACCEPTED',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await (
          await ops()
        ).post(`${P}/outputs`, {
          productionOrderId: o.id,
          productionDate: TODAY,
          goodQuantity: '1',
          acceptedQuantity: '1',
        })
      ).statusCode,
    ).toBe(400);
    const a = await report(o.id, '8');
    // A draft is visible to its reporter and approvers, not to Executive.
    expect((await (await as('exec@a.example')).get(`${P}/outputs/${a.id}`)).statusCode).toBe(404);
    await ok((await ops()).post(`${P}/outputs/${a.id}/submit`, {}));
    expect(code(await (await ops()).post(`${P}/outputs/${a.id}/submit`, {}))).toBe(
      'OUTPUT_ALREADY_SUBMITTED',
    );
    const b = await report(o.id, '3');
    expect(code(await (await ops()).post(`${P}/outputs/${b.id}/submit`, {}))).toBe(
      'OUTPUT_EXCEEDS_TARGET',
    );
    await ok(
      (await ops()).patch(`${P}/outputs/${b.id}`, { goodQuantity: '2', defectiveQuantity: '1' }),
    );
    await ok((await ops()).post(`${P}/outputs/${b.id}/submit`, {}));
    await ok((await opm()).post(`${P}/outputs/${a.id}/accept`, {}));
    expect(code(await (await opm()).post(`${P}/outputs/${a.id}/accept`, {}))).toBe(
      'OUTPUT_ALREADY_ACCEPTED',
    );
    expect(code(await (await opm()).post(`${P}/outputs/${b.id}/reject`, {}))).toBe(
      'VALIDATION_FAILED',
    );
    await ok((await opm()).post(`${P}/outputs/${b.id}/reject`, { reason: 'Rework needed' }));
    expect(code(await (await ops()).patch(`${P}/outputs/${a.id}`, { goodQuantity: '1' }))).toBe(
      'OUTPUT_NOT_EDITABLE',
    );
    // A review request waits for drafts; complete waits for reviews and receipts.
    const c = await report(o.id, '1');
    expect(code(await (await opm()).post(`${P}/orders/${o.id}/review`, {}))).toBe(
      'OUTPUT_DRAFT_PENDING',
    );
    await ok((await ops()).post(`${P}/outputs/${c.id}/cancel`, {}));
    await ok((await opm()).post(`${P}/orders/${o.id}/review`, {}));
    expect(
      code(
        await (
          await ops()
        ).post(`${P}/outputs`, {
          productionOrderId: o.id,
          productionDate: TODAY,
          goodQuantity: '1',
        }),
      ),
    ).toBe('MO_NOT_IN_PRODUCTION');
    const blocked = await (
      await opm()
    ).post(`${P}/orders/${o.id}/complete`, {
      outcome: 'SHORT_CLOSED',
      reason: 'x',
      materialsReviewed: true,
    });
    expect(code(blocked)).toBe('OUTPUT_NOT_RECEIVED');
    expect((await order(o.id)).completion.blockers).toEqual(['OUTPUT_NOT_RECEIVED']);
  });

  it('lots and expiry: tracking rules, mismatches, production date, branch locations, traceability', async () => {
    const fgLot = (
      await h.db.item.create({
        data: {
          companyId: A.companyId,
          code: 'FG-LOT',
          type: 'FINISHED_GOOD',
          name: 'Lot FG',
          baseUnitId: (await h.db.unit.findFirstOrThrow({ where: { code: 'PCS' } })).id,
          lotTracking: 'REQUIRED',
          expiryTracking: 'REQUIRED',
        },
      })
    ).id;
    const o = await producing('20', fgLot);
    const r = await accepted(o.id, '20');
    const tryLines = async (lines: J[]) =>
      code(await (await whs()).post(`${FG}/receipts`, { outputReportId: r.id, lines }));
    expect(await tryLines([line('5')])).toBe('LOT_REQUIRED');
    expect(await tryLines([line('5', { lotNumber: 'B1' })])).toBe('EXPIRY_REQUIRED');
    expect(await tryLines([line('5', { lotNumber: 'B1', expiryDate: shift(-1) })])).toBe(
      'LOT_EXPIRED',
    );
    expect(
      await tryLines([
        line('5', { lotNumber: 'B1', expiryDate: shift(90), manufacturedDate: shift(1) }),
      ]),
    ).toBe('MANUFACTURED_DATE_INVALID');
    expect(
      await tryLines([line('5', { lotNumber: 'B1', expiryDate: shift(90), locationId: loc.HO })]),
    ).toBe('REFERENCE_NOT_FOUND');
    expect(
      await tryLines([
        line('5', { lotNumber: 'B1', expiryDate: shift(90), locationId: foreignLoc }),
      ]),
    ).toBe('REFERENCE_NOT_FOUND');
    expect(
      await tryLines([
        line('2', { lotNumber: 'B1', expiryDate: shift(90) }),
        line('3', { lotNumber: 'B1', expiryDate: shift(80) }),
      ]),
    ).toBe('LOT_EXPIRY_MISMATCH');
    const one = await receipt(r.id, [
      line('12', { lotNumber: 'B1', expiryDate: shift(90), manufacturedDate: TODAY }),
    ]);
    await postFg(one.id);
    const lot = await h.db.inventoryLot.findFirstOrThrow({
      where: { itemId: fgLot, lotNumber: 'B1' },
    });
    expect(lot.manufacturedDate?.toISOString().slice(0, 10)).toBe(TODAY);
    // The known lot keeps its expiry and production date.
    expect(await tryLines([line('2', { lotNumber: 'B1', expiryDate: shift(60) })])).toBe(
      'LOT_EXPIRY_MISMATCH',
    );
    expect(
      await tryLines([
        line('2', { lotNumber: 'B1', expiryDate: shift(90), manufacturedDate: shift(-3) }),
      ]),
    ).toBe('LOT_MANUFACTURED_MISMATCH');
    await postFg((await receipt(r.id, [line('8', { lotNumber: 'B1', expiryDate: shift(90) })])).id);
    expect(await h.db.inventoryLot.count({ where: { itemId: fgLot } })).toBe(1);
    const mo = await order(o.id);
    expect(mo.traceability.outputLots.map((x: J) => [x.lotNumber, x.quantity])).toEqual([
      ['B1', '12'],
      ['B1', '8'],
    ]);
    expect(mo.traceability.materialLots[0]).toMatchObject({ item: 'PK-1', quantity: '20' });
    // Lines of a posted receipt never change (database guard).
    const l = await h.db.productionGoodsReceiptLine.findFirstOrThrow({
      where: { receiptId: one.id },
    });
    await expect(
      h.db.productionGoodsReceiptLine.update({ where: { id: l.id }, data: { quantity: '1' } }),
    ).rejects.toThrow();
    await expect(h.db.productionGoodsReceipt.delete({ where: { id: one.id } })).rejects.toThrow();
    await assertLedger();
  });

  it('race: triple post of one receipt and two receipts claiming the same output never over-receive', async () => {
    const o = await producing('10');
    const r = await accepted(o.id, '10');
    const x = await receipt(r.id, [line('4')]);
    const m = await whm();
    const rs = await Promise.all([1, 2, 3].map(() => m.post(`${FG}/receipts/${x.id}/post`, {})));
    expect(rs.map((q) => q.statusCode).sort()).toEqual([200, 409, 409]);
    expect(
      rs.filter((q) => q.statusCode === 409).every((q) => code(q) === 'FGR_ALREADY_POSTED'),
    ).toBe(true);
    expect(await h.db.stockMovement.count({ where: { productionGoodsReceiptId: x.id } })).toBe(1);
    for (let round = 0; round < 3; round++) {
      const o2 = await producing('10');
      const r2 = await accepted(o2.id, '10');
      const a = await receipt(r2.id, [line('7')]);
      const b = await receipt(r2.id, [line('7')]);
      const both = await Promise.all([a, b].map((q) => m.post(`${FG}/receipts/${q.id}/post`, {})));
      expect(both.map((q) => q.statusCode).sort()).toEqual([200, 409]);
      expect(both.map(code).filter(Boolean)).toEqual(['FG_EXCEEDS_ACCEPTED']);
      expect((await order(o2.id)).output.received).toBe('7');
    }
    await assertLedger();
  });

  it('races: post vs output cancel, post vs completion, completion vs new output, issue and release', async () => {
    for (let round = 0; round < 3; round++) {
      const o = await producing('10');
      const r = await accepted(o.id, '10');
      const x = await receipt(r.id, [line('10')]);
      const [p, c] = await Promise.all([
        (await whm()).post(`${FG}/receipts/${x.id}/post`, {}),
        (await opm()).post(`${P}/outputs/${r.id}/cancel`, { reason: 'race' }),
      ]);
      const st = (await h.db.productionOutputReport.findUniqueOrThrow({ where: { id: r.id } }))
        .status;
      if (p.statusCode === 200) {
        expect([code(c), st]).toEqual(['OUTPUT_ALREADY_RECEIVED', 'ACCEPTED']);
      } else {
        expect(st).toBe('CANCELLED');
        expect(
          (await h.db.productionGoodsReceipt.findUniqueOrThrow({ where: { id: x.id } })).status,
        ).toBe('CANCELLED');
      }
      // Post vs complete: completion waits for (or refuses on) the draft receipt.
      const o2 = await producing('5');
      const r2 = await accepted(o2.id, '5');
      const y = await receipt(r2.id, [line('5')]);
      await ok((await opm()).post(`${P}/orders/${o2.id}/review`, {}));
      const [p2, c2] = await Promise.all([
        (await whm()).post(`${FG}/receipts/${y.id}/post`, {}),
        (await opm()).post(`${P}/orders/${o2.id}/complete`, {
          outcome: 'COMPLETED',
          materialsReviewed: true,
        }),
      ]);
      expect(p2.statusCode).toBe(200);
      expect([200, 409]).toContain(c2.statusCode);
      if (c2.statusCode === 409) expect(code(c2)).toBe('RECEIPT_PENDING');
      // Review vs new output report / material issue post / release: serialized on the order row.
      const o3 = await producing('6');
      await stockIn(it_.pk, '2');
      const pk = mat(await order(o3.id), it_.pk);
      await ok(
        (await opm()).post(`${P}/orders/${o3.id}/materials/${pk.id}/excess`, {
          quantity: '2',
          reason: 'spare',
        }),
      );
      const di = await draftIssue(o3.id);
      const [rv, nr, ip] = await Promise.all([
        (await opm()).post(`${P}/orders/${o3.id}/review`, {}),
        (await ops()).post(`${P}/outputs`, {
          productionOrderId: o3.id,
          productionDate: TODAY,
          goodQuantity: '1',
        }),
        (await opm()).post(`${P}/issues/${di.id}/post`, {}),
      ]);
      for (const q of [rv, nr, ip]) expect([200, 201, 409]).toContain(q.statusCode);
      const st3 = (await h.db.productionOrder.findUniqueOrThrow({ where: { id: o3.id } })).status;
      if (rv.statusCode === 200) expect(st3).toBe('COMPLETION_REVIEW');
      if (nr.statusCode === 201)
        expect(rv.statusCode === 409 || st3 === 'COMPLETION_REVIEW').toBe(true);
      const rel = await (await opm()).post(`${P}/orders/${o3.id}/materials/release`, {});
      expect([200, 409]).toContain(rel.statusCode);
    }
    await assertLedger();
  });

  it('reversal: refused while Sales reserves the stock or after it left, allowed otherwise', async () => {
    const o = await producing('10');
    const r = await accepted(o.id, '10');
    const x = await postFg((await receipt(r.id, [line('10')])).id);
    const own = await owner();
    const so = (
      await ok(
        own.post(SO, {
          customerId: customer,
          lines: [{ itemId: it_.fg, quantity: '3', unitPrice: '1' }],
        }),
        201,
      )
    ).order;
    await ok(own.post(`${SO}/${so.id}/submit`));
    await ok(own.post(`${SO}/${so.id}/confirm`));
    // Reversal vs Sales allocation, concurrently: never both.
    const [rev, alloc] = await Promise.all([
      (await whm()).post(`${FG}/receipts/${x.id}/reverse`, { reason: 'Wrong count' }),
      own.post(`${SO}/${so.id}/allocate`),
    ]);
    if (rev.statusCode === 200) {
      expect(await reservedSum('sales', { itemId: it_.fg })).toBe('0');
      expect(await onHand(it_.fg)).toBe('0');
    } else {
      expect(code(rev)).toBe('STOCK_RESERVED');
      expect(alloc.statusCode).toBe(200);
      expect(await onHand(it_.fg)).toBe('10');
      // Stock moved out by an adjustment: the receipt can no longer be reversed.
      const d = (
        await ok(
          own.post(`${W}/adjustments`, {
            reason: 'DAMAGE',
            lines: [{ direction: 'DECREASE', locationId: loc.MAIN, itemId: it_.fg, quantity: '7' }],
          }),
          201,
        )
      ).adjustment;
      await ok(own.post(`${W}/adjustments/${d.id}/submit`));
      await ok(own.post(`${W}/adjustments/${d.id}/approve`));
      await ok(own.post(`${SO}/${so.id}/release`));
      expect(
        code(await (await whm()).post(`${FG}/receipts/${x.id}/reverse`, { reason: 'x' })),
      ).toBe('FGR_STOCK_GONE');
    }
    expect(code(await (await whm()).post(`${FG}/receipts/${x.id}/reverse`, {}))).toBe(
      'VALIDATION_FAILED',
    );
    await assertLedger();
  });

  it('reversal restores receivable output; order cancel refuses recorded output', async () => {
    const o = await producing('10');
    const r = await accepted(o.id, '10');
    const x = await postFg((await receipt(r.id, [line('10')])).id);
    const rev = (
      await ok((await whm()).post(`${FG}/receipts/${x.id}/reverse`, { reason: 'Recount' }))
    ).receipt;
    expect(rev).toMatchObject({ status: 'REVERSED', reversalReason: 'Recount' });
    expect(await onHand(it_.fg)).toBe('0');
    expect((await order(o.id)).output).toMatchObject({ received: '0', awaitingReceipt: '10' });
    expect(
      code(await (await whm()).post(`${FG}/receipts/${x.id}/reverse`, { reason: 'again' })),
    ).toBe('FGR_INVALID_TRANSITION');
    await postFg((await receipt(r.id, [line('10')])).id);
    expect(code(await (await opm()).post(`${P}/orders/${o.id}/cancel`, { reason: 'x' }))).toBe(
      'MATERIAL_ALREADY_ISSUED',
    );
    expect(await h.db.stockMovement.count({ where: { type: 'PRODUCTION_OUTPUT_REVERSAL' } })).toBe(
      1,
    );
    await assertLedger();
  });

  it('roles, isolation, IDOR and Warehouse privacy', async () => {
    const o = await producing('10');
    const r = await accepted(o.id, '10');
    const x = await receipt(r.id, [line('5')]);
    const get = async (who: string, url: string, branch: 'HO' | 'X' = 'X') =>
      (await (await as(who, branch)).get(url)).statusCode;
    // Executive reads production output, mutates nothing; System Admin / Sales / Purchasing have no output.
    expect(await get('exec@a.example', `${P}/outputs/${r.id}`)).toBe(200);
    expect(
      code(await (await as('exec@a.example')).post(`${P}/outputs/${r.id}/cancel`, { reason: 'x' })),
    ).toBe('PERMISSION_DENIED');
    expect(code(await (await as('exec@a.example')).post(`${FG}/receipts/${x.id}/post`, {}))).toBe(
      'PERMISSION_DENIED',
    );
    for (const who of ['admin@a.example', 'sales@a.example', 'pur@a.example']) {
      expect(await get(who, `${P}/outputs`)).toBe(403);
      expect(await get(who, FG)).toBe(403);
    }
    // Warehouse sees finished goods, never production orders or output reports; Operations has no FG route.
    expect(await get('wh@a.example', `${P}/outputs`)).toBe(403);
    expect(await get('wh@a.example', `${P}/orders/${o.id}`)).toBe(403);
    expect(await get('opm@a.example', FG)).toBe(403);
    // Another branch's manager and another company: 404.
    expect(await get('opm.ho@a.example', `${P}/outputs/${r.id}`, 'HO')).toBe(404);
    expect(await get('owner@b.example', `${P}/outputs/${r.id}`, 'HO')).toBe(404);
    // Mass assignment on receipts.
    expect(
      (
        await (
          await whs()
        ).post(`${FG}/receipts`, { outputReportId: r.id, lines: [line('1')], status: 'POSTED' })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await (
          await whs()
        ).post(`${FG}/receipts`, { outputReportId: r.id, lines: [line('1', { lotId: 'x' })] })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await (
          await whs()
        ).put(`${FG}/receipts/${x.id}/lines`, { lines: [line('1')], number: 'FGR-1' })
      ).statusCode,
    ).toBe(400);
    // Privacy over every Warehouse response.
    const views = [
      await ok((await whs()).get(FG)),
      await ok((await whs()).get(`${FG}/receipts`)),
      await ok((await whs()).get(`${FG}/receipts/${x.id}`)),
    ];
    for (const v of views) {
      expect(keysOf(v.items ?? v).filter((k) => MONEY.test(k))).toEqual([]);
      expect(JSON.stringify(v)).not.toMatch(/Secret Customer|777/);
    }
    // Audit: business entities without quantities.
    const events = await h.db.auditLog.findMany({
      where: { entityType: { in: ['ProductionOutputReport', 'ProductionGoodsReceipt'] } },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events.map((e) => e.changes))).not.toMatch(
      /"(good|goodQuantity|accepted|acceptedQuantity|quantity)":/i,
    );
    expect(BUSINESS_AUDIT_ENTITIES).toEqual(
      expect.arrayContaining(['ProductionOutputReport', 'ProductionGoodsReceipt']),
    );
  });

  it('codes, tiers and numbering under concurrency', async () => {
    expect(permissionDefinition('operations.output.create').tier).toBe('OPERATE');
    expect(permissionDefinition('operations.output.approve').tier).toBe('MANAGE');
    expect(permissionDefinition('operations.orders.update_status').tier).toBe('MANAGE');
    expect(permissionDefinition('warehouse.finished_goods.view').tier).toBe('READ');
    expect(permissionDefinition('warehouse.finished_goods.process').tier).toBe('OPERATE');
    expect(permissionDefinition('warehouse.finished_goods.confirm').tier).toBe('MANAGE');
    const o = await producing('30');
    const rs = await Promise.all(
      [1, 2, 3, 4, 5].map(async () =>
        (await ops()).post(`${P}/outputs`, {
          productionOrderId: o.id,
          productionDate: TODAY,
          goodQuantity: '1',
        }),
      ),
    );
    const numbers = rs.map((q) => j(q).report.number as string).sort();
    expect(new Set(numbers).size).toBe(5);
    expect(numbers.map((n) => Number(n.slice(-6)))).toEqual([1, 2, 3, 4, 5]);
  });
});
