import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { bootstrapPlatform, parseSeedEnv, seedDemo } from '../src/auth/bootstrap.js';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { DEMO_PERSONAS } from '../src/demo/personas.js';
import { byPriority, byQueue, FLOWS } from '../src/executive/service.js';
import { OverviewView, type WorkItemRow } from '../src/executive/view.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { routesOf } from './route-table.js';
import {
  Browser,
  createActiveCompany,
  createHarness,
  createUser,
  describeDb,
  resetDb,
  signIn,
  type ApiResponse,
  type Harness,
} from './support.js';

/*
 * EP48 — Executive Command Center (docs/EP48_SECURITY_MATRIX.md, …_BOTTLENECK_RULES.md).
 * S1 … S16 are the Phase 12 security cases; R1 … R19 the Phase 11 scenarios, run on the
 * seeded demo world in the disposable test database.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const API = '/api/v1';
const X = `${API}/executive`;
const C = `${API}/company`;
const P = `${API}/production`;
const W = `${API}/warehouse`;
const SO = `${API}/sales/orders`;

const item = (over: Partial<WorkItemRow>): WorkItemRow => ({
  kind: 'SALES_ORDER',
  id: 'a',
  number: 'SO-1',
  context: null,
  branch: { id: 'b', code: '00001', name: 'B' },
  department: 'SALES',
  next: 'WAREHOUSE',
  stage: 'SO_AWAITING_PICK',
  class: 'WAITING',
  reason: null,
  evidence: { code: 'X' },
  date: null,
  dateKind: null,
  overdueDays: null,
  since: null,
  ageDays: null,
  link: null,
  ...over,
});

describe('EP48 ordering and contract', () => {
  it('priority order is deterministic: blocked (by reason), overdue (most days), missing date, waiting, then age and number', () => {
    const list = [
      item({ id: '1', number: 'SO-9', class: 'WAITING', ageDays: 9 }),
      item({ id: '2', number: 'SO-2', class: 'OVERDUE', overdueDays: 2 }),
      item({ id: '3', number: 'MO-1', class: 'BLOCKED', reason: 'PRODUCTION_PAUSED' }),
      item({ id: '4', number: 'SO-5', class: 'OVERDUE', overdueDays: 7 }),
      item({ id: '5', number: 'SO-1', class: 'BLOCKED', reason: 'DELIVERY_EXCEPTION' }),
      item({ id: '6', number: 'PO-1', class: 'MISSING_DATE' }),
      item({ id: '7', number: 'SO-8', class: 'WAITING', ageDays: 9 }),
    ];
    expect([...list].sort(byPriority).map((i) => i.id)).toEqual([
      '5',
      '3',
      '4',
      '2',
      '6',
      '7',
      '1',
    ]);
    const disc = item({ id: '8', number: 'CC-1', reason: 'STOCK_DISCREPANCY', ageDays: 30 });
    expect([disc, list[1]!, list[2]!].sort(byQueue).map((i) => i.id)).toEqual(['3', '2', '8']);
  });

  it('the answer schema has no money, quantity or recipe field and refuses unknown fields', () => {
    const shape = JSON.stringify(z.toJSONSchema(OverviewView));
    expect(shape).not.toMatch(
      /"(amount|price|cost|discount|margin|quantity|bom\w*|recipe\w*|ratio)"/i,
    );
    const ok = OverviewView.safeParse({
      scope: { company: 'A', branches: [], selected: 'all' },
      role: 'EXECUTIVE',
      readOnly: true,
      today: '2026-11-16',
      generatedAt: 'x',
      visible: [],
      pulse: [],
      departments: [],
      bottlenecks: [],
      queue: { total: 0, items: [] },
      branchComparison: { keys: [], rows: [] },
      activity: [],
      notes: [],
    });
    expect(ok.success).toBe(true);
    expect(
      OverviewView.safeParse({ ...(ok.success ? ok.data : {}), grandTotal: '1' }).success,
    ).toBe(false);
    expect(
      OverviewView.safeParse({
        ...(ok.success ? ok.data : {}),
        queue: { total: 1, items: [{ ...item({}), unitPrice: '1' }] },
      }).success,
    ).toBe(false);
  });

  it('flows: every bottleneck stage belongs to exactly one flow', () => {
    const all = FLOWS.flatMap((f) => f.stages);
    expect(new Set(all).size).toBe(all.length);
  });
});

const PASSWORDS = Object.fromEntries(
  DEMO_PERSONAS.map((p) => [p.passwordEnv, `${p.key.toLowerCase()} fixture passphrase 7`]),
);
const ENV = {
  NODE_ENV: 'development',
  PLATFORM_OWNER_EMAIL: 'the.owner@pdabliss.test',
  PLATFORM_OWNER_INITIAL_PASSWORD: 'owner fixture passphrase 1',
  ...PASSWORDS,
};
const passwordOf = (email: string) =>
  PASSWORDS[DEMO_PERSONAS.find((p) => p.email === email)!.passwordEnv]!;
const VOLATILE = new Set([
  '_prisma_migrations',
  'Session',
  'AuthAuditEvent',
  'TrustedDevice',
  'OtpChallenge',
]);
const MONEY_KEY =
  /"(?!total")[a-zA-Z]*([pP]rice|[aA]mount|[tT]otal|[dD]iscount|[cC]ost|[mM]argin|[dD]eposit[A-Z][a-z]*|[pP]ayment)[a-zA-Z]*":\s*("|-?\d|\{)/;
const RECIPE_KEY =
  /"(bom[a-zA-Z]*|recipe[a-zA-Z]*|ratio|required[a-zA-Z]*|quantity|materials?|lines|available|shortage)":/;

describeDb('EP48 Executive Command Center (demo world)', () => {
  let h: Harness;
  const as: Record<string, Browser> = {};
  const ids: Record<string, string> = {};
  const member: Record<string, string> = {};
  let today = '';
  const plus = (n: number) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  const select = async (b: Browser, branch = '00001') => {
    const ctx = j(await b.get(`${C}/context`));
    const target = ctx.branches?.find((x: J) => x.code === branch);
    if (target && ctx.selected?.code !== branch && !ctx.blocked)
      await b.post(`${C}/context/branch`, { branchId: target.id });
    return b;
  };
  const persona = async (email: string, branch = '00001') => {
    const b = new Browser(h.app);
    const res = await b.post(`${API}/auth/login`, { email, password: passwordOf(email) });
    expect(res.statusCode, res.body).toBe(200);
    return select(b, branch);
  };
  const extraMember = async (email: string, role: CompanyRole, dept: DepartmentCode | null) => {
    const companyId = (await h.db.branch.findFirstOrThrow({ where: { code: '00001' } })).companyId;
    const u = await createUser(h.db, email, { companyRole: role, companyId });
    const m = await h.db.companyMember.findUniqueOrThrow({ where: { userId: u.id } });
    if (dept) {
      const d = await h.db.department.findFirstOrThrow({ where: { companyId, code: dept } });
      await h.db.membership.create({ data: { userId: u.id, companyId, departmentId: d.id } });
    }
    await h.db.companyMember.update({
      where: { id: m.id },
      data: {
        branchScope: 'SELECTED_BRANCHES',
        branchAccess: { create: [{ branchId: ids.branch! }] },
      },
    });
    member[email] = m.id;
    return select(await signIn(h, email));
  };
  const ok = (res: ApiResponse, label: string, status = [200, 201]) => {
    expect(status, `${label}: ${res.body}`).toContain(res.statusCode);
    return j(res);
  };
  const overview = async (b: Browser, branch?: string) =>
    ok(await b.get(`${X}/overview${branch ? `?branch=${branch}` : ''}`), 'overview');
  const pulse = async (b: Browser, branch?: string) => {
    const o = await overview(b, branch);
    return Object.fromEntries(
      o.pulse.flatMap((p: J) => p.metrics.map((m: J) => [`${p.department}.${m.key}`, m.value])),
    ) as Record<string, number>;
  };
  const delta = (a: Record<string, number>, b: Record<string, number>) =>
    Object.fromEntries(
      Object.keys(b)
        .filter((k) => b[k] !== a[k])
        .map((k) => [k, b[k]! - (a[k] ?? 0)]),
    );
  /** The document's one work item in the owner's company-wide overview (null: none). */
  const itemOf = async (id: string) => {
    const t = await as.owner!.get(`${X}/documents/${kindOf[id] ?? 'sales-order'}/${id}`);
    return t.statusCode === 200 ? (j(t).item as J | null) : null;
  };
  const kindOf: Record<string, string> = {};
  const integrity = async () => {
    const sql = readFileSync('../uat/integrity.sql', 'utf8');
    const [row] = await h.db.$queryRawUnsafe<Record<string, bigint>[]>(sql);
    return Object.entries(row!)
      .filter(([k, v]) => !['movements', 'balances'].includes(k) && Number(v) !== 0)
      .map(([k]) => k);
  };
  const stateHash = async () => {
    const tables = await h.db.$queryRaw<{ t: string }[]>`
      SELECT tablename AS t FROM pg_tables WHERE schemaname = current_schema() ORDER BY 1`;
    const out: Record<string, string> = {};
    for (const { t } of tables) {
      if (VOLATILE.has(t)) continue;
      const [row] = await h.db.$queryRawUnsafe<{ h: string }[]>(
        `SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM "${t}" x`,
      );
      out[t] = row!.h;
    }
    return out;
  };
  const stockIn = async (itemId: string, quantity: string, lot: J = {}) => {
    const adj = ok(
      await as.wh!.post(`${W}/adjustments`, {
        reason: 'FOUND',
        lines: [{ direction: 'INCREASE', locationId: ids.MAIN, itemId, quantity, ...lot }],
      }),
      'stock in',
    ).adjustment;
    ok(await as.wh!.post(`${W}/adjustments/${adj.id}/submit`), 'stock submit');
    ok(await as.owner!.post(`${W}/adjustments/${adj.id}/approve`), 'stock approve');
  };

  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'true' });
    await resetDb(h.db);
    const env = parseSeedEnv(ENV);
    await bootstrapPlatform(h.db, env);
    await seedDemo(h.db, env);
    const itemId = async (c: string) =>
      (await h.db.item.findFirstOrThrow({ where: { code: c } })).id;
    Object.assign(ids, {
      branch: (await h.db.branch.findFirstOrThrow({ where: { code: '00001' } })).id,
      ho: (await h.db.branch.findFirstOrThrow({ where: { code: '00000' } })).id,
      FG2: await itemId('FG-000002'),
      FG3: await itemId('FG-000003'),
      PK1: await itemId('PK-000001'),
      RM1: await itemId('RM-000001'),
      customer: (await h.db.customer.findFirstOrThrow({ where: { code: 'CUS-000002' } })).id,
      supplier: (await h.db.supplier.findFirstOrThrow({ where: { status: 'ACTIVE' } })).id,
    });
    ids.MAIN = (
      await h.db.warehouseLocation.findFirstOrThrow({
        where: { code: 'MAIN', branch: { code: '00001' } },
      })
    ).id;
    // Distinctive money: these digits in any Command Center answer are a leak.
    await h.db.purchaseOrderLine.updateMany({ data: { unitPrice: '987654.3219' } });
    await h.db.salesOrderLine.updateMany({ data: { unitPrice: '876543.2109' } });
    for (const [k, email] of [
      ['owner', 'owner.demo@pdabliss.com'],
      ['admin', 'admin.demo@pdabliss.com'],
      ['exec', 'executive.demo@pdabliss.com'],
      ['sales', 'sales.demo@pdabliss.com'],
      ['opm', 'operations.demo@pdabliss.com'],
      ['wh', 'warehouse.demo@pdabliss.com'],
      ['pur', 'purchasing.demo@pdabliss.com'],
      ['staff', 'staff.demo@pdabliss.com'],
    ] as const)
      as[k] = await persona(email);
    as.acc = await persona('accounting.demo@pdabliss.com', '00000');
    for (const p of DEMO_PERSONAS)
      member[p.email] = (
        await h.db.companyMember.findFirstOrThrow({ where: { user: { emailNormalized: p.email } } })
      ).id;
    as.ops = await extraMember('ops.staff@demo.example', 'DEPARTMENT_STAFF', 'OPERATIONS');
    as.unassigned = await extraMember('nobody@demo.example', 'DEPARTMENT_STAFF', null);
    as.execDept = await extraMember('exec.dept@demo.example', 'DEPARTMENT_MANAGER', 'EXECUTIVE');
    today = j(await as.owner!.get(`${P}/context`)).today as string;
  }, 300_000);
  afterAll(async () => h?.close());

  // ---------------------------------------------------------------- access (S3, S4, R14–R16)

  it('S3/S4/R15/R16: only the Owner and the Executive open the Command Center — never System Admin, staff, managers, viewers or the Executive department', async () => {
    for (const k of ['owner', 'exec']) {
      const o = await overview(as[k]!);
      expect(o.readOnly).toBe(true);
      expect(o.visible).toEqual(['SALES', 'PURCHASING', 'WAREHOUSE', 'OPERATIONS', 'ACCOUNTING']);
    }
    for (const k of [
      'admin',
      'sales',
      'opm',
      'ops',
      'wh',
      'staff',
      'pur',
      'acc',
      'unassigned',
      'execDept',
    ]) {
      const r = await as[k]!.get(`${X}/overview`);
      expect(r.statusCode, `${k} ${r.body}`).toBe(403);
      expect(code(r)).toBe('PERMISSION_DENIED');
      expect(Object.keys(j(r).error).sort()).toEqual(['code', 'details', 'message', 'requestId']);
      // The document trace is closed the same way.
      expect(
        (await as[k]!.get(`${X}/documents/sales-order/cm0000000000000000000000000`)).statusCode,
      ).toBe(403);
    }
    expect((await new Browser(h.app).get(`${X}/overview`)).statusCode).toBe(401);
    // The Executive department member still uses department access only.
    expect((await as.execDept!.get(`${API}/dashboards`)).statusCode).toBe(200);
  });

  it('S1/S2/S15/S16: no write or export route; Executive mutations and approvals stay refused; reads change nothing', async () => {
    const routes = routesOf(h).filter((r) => r.path.startsWith('/api/v1/executive'));
    expect(routes.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      'GET /api/v1/executive/documents/:kind/:id',
      'GET /api/v1/executive/overview',
    ]);
    expect(routesOf(h).some((r) => /export|download|csv/i.test(r.path))).toBe(false);
    const before = await stateHash();
    for (const k of ['exec', 'owner'])
      for (const m of ['post', 'put', 'patch', 'delete'] as const)
        for (const path of [`${X}/overview`, `${X}/documents/sales-order/x`, X])
          expect(
            (await (as[k]! as any)[m](path, { ownerOverride: { reason: 'command center' } }))
              .statusCode,
          ).toBe(404);
    for (const k of ['exec', 'owner']) {
      await overview(as[k]!);
      await overview(as[k]!, ids.branch);
    }
    expect(await stateHash()).toEqual(before);
    // The Executive's transactional / approval routes are refused by the modules (EP27/EP45).
    const so = (
      await h.db.salesOrder.findFirstOrThrow({
        where: { status: 'SUBMITTED', branchId: ids.branch },
      })
    ).id;
    const pr = (await h.db.purchaseRequest.findFirstOrThrow({ where: { status: 'SUBMITTED' } })).id;
    const mo = (await h.db.productionOrder.findFirstOrThrow({ where: { status: 'SUBMITTED' } })).id;
    for (const [path, body] of [
      [`${SO}/${so}/confirm`, {}],
      [`${API}/purchase-requests/${pr}/approve`, {}],
      [`${P}/orders/${mo}/approve`, {}],
      [`${P}/orders/${mo}/materials/allocate`, {}],
      [`${W}/adjustments`, { reason: 'FOUND', lines: [] }],
      [SO, { customerId: ids.customer }],
    ] as const)
      expect((await as.exec!.post(path, body)).statusCode, path).toBe(403);
    expect(await stateHash()).toEqual(before);
  });

  it("S7/S8/S9: a forged companyId or branchId, another company's branch, an unpermitted branch and guessed document ids are refused", async () => {
    expect(
      (await as.exec!.get(`${X}/overview?companyId=cm0000000000000000000000000`)).statusCode,
    ).toBe(400);
    expect((await as.exec!.get(`${X}/overview?department=SALES`)).statusCode).toBe(400);
    expect(
      (await as.exec!.get(`${X}/overview?branch=cm0000000000000000000000000`)).statusCode,
    ).toBe(404);
    const beta = await createActiveCompany(h.db, {
      name: 'Beta',
      plan: 'ENTERPRISE',
      departments: ['SALES', 'EXECUTIVE'],
    });
    expect((await as.exec!.get(`${X}/overview?branch=${beta.headOfficeId}`)).statusCode).toBe(404);
    // An Executive restricted to one branch cannot name another one of the company.
    await h.db.companyMember.update({
      where: { id: member['executive.demo@pdabliss.com']! },
      data: {
        branchScope: 'SELECTED_BRANCHES',
        branchAccess: { create: [{ branchId: ids.branch! }] },
      },
    });
    expect((await as.exec!.get(`${X}/overview?branch=${ids.ho}`)).statusCode).toBe(404);
    const narrowed = await overview(as.exec!);
    expect(narrowed.scope.branches.map((b: J) => b.code)).toEqual(['00001']);
    for (const p of narrowed.pulse)
      for (const m of p.metrics) expect(m.value).toBeGreaterThanOrEqual(0);
    expect(
      [...narrowed.queue.items, ...narrowed.bottlenecks.flatMap((b: J) => b.items)].every(
        (i: J) => i.branch.code === '00001',
      ),
    ).toBe(true);
    // A Head Office document is not reachable through the trace either.
    const hoSo = await h.db.salesOrder.findFirst({
      where: { branchId: ids.ho, status: { not: 'DRAFT' } },
    });
    if (hoSo)
      expect((await as.exec!.get(`${X}/documents/sales-order/${hoSo.id}`)).statusCode).toBe(404);
    await h.db.memberBranchAccess.deleteMany({
      where: { memberId: member['executive.demo@pdabliss.com']! },
    });
    await h.db.companyMember.update({
      where: { id: member['executive.demo@pdabliss.com']! },
      data: { branchScope: 'ALL_BRANCHES' },
    });
    // Guessed / foreign / wrong-kind ids: one answer.
    const realSo = (await h.db.salesOrder.findFirstOrThrow({ where: { status: 'CONFIRMED' } })).id;
    for (const path of [
      `${X}/documents/sales-order/cm0000000000000000000000000`,
      `${X}/documents/purchase-order/${realSo}`,
      `${X}/documents/unknown/${realSo}`,
    ])
      expect((await as.exec!.get(path)).statusCode, path).toBe(404);
    expect(
      (await as.exec!.get(`${X}/documents/sales-order/${realSo}?companyId=x`)).statusCode,
    ).toBe(400);
    // Draft purchase orders stay hidden from the Executive, as in the Purchasing module.
    const draftPo = await h.db.purchaseOrder.findFirst({ where: { status: 'DRAFT' } });
    if (draftPo) {
      expect((await as.exec!.get(`${X}/documents/purchase-order/${draftPo.id}`)).statusCode).toBe(
        404,
      );
      expect((await as.owner!.get(`${X}/documents/purchase-order/${draftPo.id}`)).statusCode).toBe(
        200,
      );
    }
  });

  it('S5/R19: another company sees nothing of this one (zeros, empty queue, no shared ids)', async () => {
    const beta = await createActiveCompany(h.db, {
      name: 'Gamma',
      plan: 'ENTERPRISE',
      departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
    });
    await createUser(h.db, 'owner@gamma.example', {
      companyRole: 'COMPANY_OWNER',
      companyId: beta.companyId,
    });
    const g = await signIn(h, 'owner@gamma.example');
    await select(g, '00000');
    const o = await overview(g);
    for (const p of o.pulse)
      for (const m of p.metrics) expect(m.value, `${p.department}.${m.key}`).toBe(0);
    expect(o.queue.total).toBe(0);
    expect(o.activity).toEqual([]);
    expect(o.bottlenecks.every((b: J) => b.total === 0)).toBe(true);
    expect(JSON.stringify(o)).not.toContain(ids.branch);
    const demoSo = (await h.db.salesOrder.findFirstOrThrow({ where: { status: 'CONFIRMED' } })).id;
    expect((await g.get(`${X}/documents/sales-order/${demoSo}`)).statusCode).toBe(404);
  });

  it("S6/R13: every item is attributed to its document's branch; branch rows add up to the company; a branch filter shows only that branch", async () => {
    const all = await overview(as.owner!);
    const items = [...all.queue.items, ...all.bottlenecks.flatMap((b: J) => b.items)];
    const model: Record<string, any> = {
      SALES_ORDER: h.db.salesOrder,
      PURCHASE_ORDER: h.db.purchaseOrder,
      PURCHASE_REQUEST: h.db.purchaseRequest,
      PRODUCTION_ORDER: h.db.productionOrder,
      GOODS_RECEIPT: h.db.goodsReceipt,
      STOCK_ADJUSTMENT: h.db.stockAdjustment,
      CYCLE_COUNT: h.db.cycleCount,
      INVENTORY_TRANSFER: h.db.inventoryTransfer,
    };
    for (const i of items) {
      const row = await model[i.kind].findUnique({ where: { id: i.id } });
      expect(row.branchId, `${i.kind} ${i.number}`).toBe(i.branch.id);
    }
    // Comparison rows add up to the company figure, metric by metric (no double counting).
    const totals = await pulse(as.owner!);
    for (const key of all.branchComparison.keys as string[]) {
      const [dept, m] = key.split('.');
      const pulseKey = `${dept!.toUpperCase()}.${m}`;
      const sum = all.branchComparison.rows.reduce((n: number, r: J) => n + r.values[key], 0);
      expect(sum, key).toBe(totals[pulseKey]);
    }
    // Per-branch overview equals that branch's comparison row.
    for (const row of all.branchComparison.rows) {
      const one = await overview(as.owner!, row.branch.id);
      expect(one.scope.selected).toBe(row.branch.id);
      expect(one.branchComparison.rows).toEqual([row]);
      expect(
        [...one.queue.items, ...one.bottlenecks.flatMap((b: J) => b.items), ...one.activity].every(
          (i: J) => i.branch.id === row.branch.id,
        ),
      ).toBe(true);
    }
    // Independent recounts against the database.
    expect(totals['SALES.awaitingConfirmation']).toBe(
      await h.db.salesOrder.count({ where: { status: 'SUBMITTED' } }),
    );
    expect(totals['PURCHASING.requestsAwaitingDecision']).toBe(
      await h.db.purchaseRequest.count({ where: { status: 'SUBMITTED' } }),
    );
    expect(totals['WAREHOUSE.receiptsToPost']).toBe(
      await h.db.goodsReceipt.count({ where: { status: 'DRAFT' } }),
    );
    expect(totals['OPERATIONS.awaitingApproval']).toBe(
      await h.db.productionOrder.count({ where: { status: 'SUBMITTED' } }),
    );
    expect(totals['ACCOUNTING.depositsPending']).toBe(
      await h.db.purchaseOrder.count({
        where: { status: 'WAITING_DEPOSIT', depositStatus: 'PENDING' },
      }),
    );
  });

  it('no document is counted twice: each id appears in one stage only, across queue, bottlenecks and department health', async () => {
    const o = await overview(as.owner!);
    const seen = new Map<string, string>();
    for (const i of [...o.queue.items, ...o.bottlenecks.flatMap((b: J) => b.items)]) {
      const prev = seen.get(`${i.kind}:${i.id}`);
      if (prev) expect(prev, i.number).toBe(i.stage);
      seen.set(`${i.kind}:${i.id}`, i.stage);
    }
    // Department health: "waiting" across departments = all items once (every item has one next).
    const sumWaiting = o.departments.reduce((n: number, d: J) => n + d.waiting, 0);
    const sumOpen = o.departments.reduce((n: number, d: J) => n + d.open, 0);
    expect(sumWaiting).toBe(sumOpen);
    for (const d of o.departments)
      expect(d.stages.reduce((n: number, s: J) => n + s.value, 0)).toBe(d.waiting);
  });

  it('S10/S11/S12/S13/R17/R18: no recipe line, ratio, material quantity, price, cost, total or deposit amount — overview or trace, Owner or Executive', async () => {
    const answers: string[] = [];
    for (const k of ['owner', 'exec']) {
      answers.push((await as[k]!.get(`${X}/overview`)).body);
      for (const [kind, model] of [
        ['sales-order', h.db.salesOrder],
        ['purchase-order', h.db.purchaseOrder],
        ['production-order', h.db.productionOrder],
      ] as const) {
        const rows = await (model as any).findMany({
          where: { status: { notIn: ['DRAFT'] } },
          take: 5,
        });
        for (const r of rows) {
          const t = await as[k]!.get(`${X}/documents/${kind}/${r.id}`);
          expect(t.statusCode, `${k} ${kind}`).toBe(200);
          answers.push(t.body);
        }
      }
    }
    for (const body of answers) {
      expect(body).not.toMatch(/987654|876543/);
      expect(MONEY_KEY.exec(body)?.[0] ?? null).toBeNull();
      expect(RECIPE_KEY.exec(body)?.[0] ?? null).toBeNull();
    }
    // The Executive's other routes keep their own EP46 rules (unchanged): no recipe detail.
    const bom = await h.db.productionBom.findFirstOrThrow();
    expect((await as.exec!.get(`${P}/boms/${bom.id}`)).statusCode).toBe(403);
  });

  it('S14: a revoked permission or a removed Executive role shows on the very next request; answers are never cached', async () => {
    const r = await as.exec!.get(`${X}/overview`);
    expect(r.headers['cache-control']).toMatch(/no-store/);
    const email = 'executive.demo@pdabliss.com';
    await as.owner!.put(`${C}/current/members/${member[email]}/permissions`, {
      changes: [{ permission: 'executive.overview.view', effect: 'DENY' }],
    });
    expect((await as.exec!.get(`${X}/overview`)).statusCode).toBe(403);
    await as.owner!.put(`${C}/current/members/${member[email]}/permissions`, {
      changes: [{ permission: 'executive.overview.view', effect: null }],
    });
    // A department read removed: that department disappears from the answer.
    await as.owner!.put(`${C}/current/members/${member[email]}/permissions`, {
      changes: [{ permission: 'sales.orders.view', effect: 'DENY' }],
    });
    const o = await overview(as.exec!);
    expect(o.visible).not.toContain('SALES');
    expect(JSON.stringify(o)).not.toContain('SALES_ORDER');
    await as.owner!.put(`${C}/current/members/${member[email]}/permissions`, {
      changes: [{ permission: 'sales.orders.view', effect: null }],
    });
    expect((await overview(as.exec!)).visible).toContain('SALES');
  });

  it('R14: every link the Owner and the Executive receive opens for them (overview and trace)', async () => {
    const API_OF: [RegExp, (m: RegExpExecArray) => string][] = [
      [/^\/core\/sales\/orders\/(\w+)$/, (m) => `${SO}/${m[1]}`],
      [/^\/core\/purchasing\/requests\/(\w+)$/, (m) => `${API}/purchase-requests/${m[1]}`],
      [/^\/core\/purchasing\/orders\/(\w+)$/, (m) => `${API}/purchase-orders/${m[1]}`],
      [/^\/core\/accounting\/deposits\/(\w+)$/, (m) => `${API}/accounting/deposits/${m[1]}`],
      [/^\/core\/warehouse\/pending-receive\/(\w+)$/, (m) => `${W}/pending-receive/${m[1]}`],
      [/^\/core\/warehouse\/receipts\/(\w+)$/, (m) => `${W}/receipts/${m[1]}`],
      [
        /^\/core\/warehouse\/(transfers|adjustments|counts|picks|packs|shipments)\/(\w+)$/,
        (m) => `${W}/${m[1]}/${m[2]}`,
      ],
      [/^\/core\/warehouse\/finished-goods\/(\w+)$/, (m) => `${W}/finished-goods/receipts/${m[1]}`],
      [/^\/core\/production\/orders\/(\w+)$/, (m) => `${P}/orders/${m[1]}`],
      [/^\/core\/production\/issues\/(\w+)$/, (m) => `${P}/issues/${m[1]}`],
      [/^\/core\/production\/output\/(\w+)$/, (m) => `${P}/outputs/${m[1]}`],
      [/^\/core\/dashboards\/(\w+)$/, (m) => `${API}/dashboards/${m[1]}`],
      [/^\/core\/warehouse\/lots$/, () => `${W}/stock?view=lots`],
    ];
    let checked = 0;
    for (const k of ['owner', 'exec']) {
      const o = await overview(as[k]!);
      const links = new Set<string>();
      const items = [...o.queue.items, ...o.bottlenecks.flatMap((b: J) => b.items)];
      for (const x of [
        ...items,
        ...o.activity,
        ...o.departments,
        ...o.pulse.flatMap((p: J) => p.metrics),
      ])
        if (x.link) links.add(x.link);
      for (const i of items.slice(0, 6)) {
        const kind = {
          SALES_ORDER: 'sales-order',
          PURCHASE_ORDER: 'purchase-order',
          PRODUCTION_ORDER: 'production-order',
        }[i.kind as string];
        if (!kind) continue;
        const t = ok(await as[k]!.get(`${X}/documents/${kind}/${i.id}`), 'trace');
        for (const r of [t.document, ...t.related]) if (r.link) links.add(r.link);
      }
      for (const link of links) {
        const rule = API_OF.find(([re]) => re.test(link));
        expect(rule, `${k} unmapped link ${link}`).toBeDefined();
        const res = await as[k]!.get(rule![1](rule![0].exec(link)!));
        expect(res.statusCode, `${k} ${link} → ${res.body.slice(0, 160)}`).toBe(200);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("EP47 fix: the Executive's Purchasing dashboard no longer counts or lists draft purchase orders (the module hides them)", async () => {
    const exec = j(await as.exec!.get(`${API}/dashboards/purchasing`));
    expect(exec.metrics.map((m: J) => m.key)).not.toContain('ordersToIssue');
    expect(exec.queues.flatMap((q: J) => q.items).some((i: J) => i.status === 'DRAFT')).toBe(false);
    const owner = j(await as.owner!.get(`${API}/dashboards/purchasing`));
    expect(owner.metrics.map((m: J) => m.key)).toContain('ordersToIssue');
  });

  // ---------------------------------------------------------------- scenarios (Phase 11)

  it('R1–R4: sales order — new, awaiting allocation (partial), picking, partial fulfilment and delivery move one stage at a time', async () => {
    await stockIn(ids.FG2!, '3', { newLotNumber: 'EP48-SO', newLotExpiry: plus(300) });
    const p0 = await pulse(as.exec!);
    const so = ok(
      await as.sales!.post(SO, {
        customerId: ids.customer,
        orderDate: plus(-5),
        requestedDate: plus(-2),
        lines: [{ itemId: ids.FG2, quantity: '500', unitPrice: '10' }],
      }),
      'SO',
    ).order;
    kindOf[so.id] = 'sales-order';
    // A draft is work in preparation: not on the Command Center.
    expect(delta(p0, await pulse(as.exec!))).toEqual({});
    ok(await as.sales!.post(`${SO}/${so.id}/submit`), 'submit');
    expect(delta(p0, await pulse(as.exec!))).toMatchObject({
      'SALES.openOrders': 1,
      'SALES.awaitingConfirmation': 1,
      'SALES.overdue': 1,
    });
    let it_ = await itemOf(so.id);
    expect(it_).toMatchObject({
      stage: 'SO_AWAITING_CONFIRMATION',
      next: 'SALES',
      class: 'OVERDUE',
      reason: 'OVERDUE_DELIVERY',
      overdueDays: 2,
      dateKind: 'REQUESTED',
    });
    ok(await as.owner!.post(`${SO}/${so.id}/confirm`), 'confirm');
    ok(await as.owner!.post(`${SO}/${so.id}/allocate`), 'allocate');
    // Only part of the order could be reserved: still awaiting allocation (Sales owns it).
    it_ = await itemOf(so.id);
    expect(it_).toMatchObject({
      stage: 'SO_AWAITING_ALLOCATION',
      next: 'SALES',
      evidence: { code: 'LINES_NOT_RESERVED', open: 1, total: 1 },
    });
    const q = await overview(as.exec!);
    expect(q.queue.items.some((i: J) => i.id === so.id)).toBe(true);
    const flow = q.bottlenecks.find((b: J) => b.key === 'SALES_TO_WAREHOUSE');
    expect(flow.stages.find((s: J) => s.key === 'SO_AWAITING_ALLOCATION').value).toBeGreaterThan(0);
    // Warehouse picks, packs, ships and dispatches the reserved part.
    const pick = ok(await as.wh!.post(`${W}/picks`, { salesOrderId: so.id }), 'pick').pick;
    ok(
      await as.wh!.post(`${W}/picks/${pick.id}/confirm`, {
        lines: pick.lines.map((l: J) => ({ lineId: l.id, pickedQuantity: l.planned })),
      }),
      'picked',
    );
    const pack = ok(await as.wh!.post(`${W}/packs`, { salesOrderId: so.id }), 'pack').pack;
    ok(await as.wh!.post(`${W}/packs/${pack.id}/confirm`), 'packed');
    const ship = ok(await as.wh!.post(`${W}/shipments`, { salesOrderId: so.id }), 'ship').shipment;
    ok(await as.owner!.post(`${W}/shipments/${ship.id}/dispatch`, {}), 'dispatch');
    ok(await as.owner!.post(`${W}/shipments/${ship.id}/deliver`, {}), 'deliver');
    const p5 = delta(p0, await pulse(as.exec!));
    // Partially fulfilled: still one open order, in allocation, partially delivered, lines open.
    expect(p5).toMatchObject({
      'SALES.openOrders': 1,
      'SALES.awaitingAllocation': 1,
      'SALES.partiallyDelivered': 1,
    });
    expect(p5['SALES.awaitingConfirmation'] ?? 0).toBe(0);
    // The full flow on a second order: allocation → pick → dispatch → delivery → done.
    await stockIn(ids.FG2!, '2', { newLotNumber: 'EP48-SO-2', newLotExpiry: plus(300) });
    const so2 = ok(
      await as.sales!.post(SO, {
        customerId: ids.customer,
        requestedDate: plus(5),
        lines: [{ itemId: ids.FG2, quantity: '1', unitPrice: '10' }],
      }),
      'SO2',
    ).order;
    kindOf[so2.id] = 'sales-order';
    ok(await as.sales!.post(`${SO}/${so2.id}/submit`), 'submit2');
    ok(await as.owner!.post(`${SO}/${so2.id}/confirm`), 'confirm2');
    ok(await as.owner!.post(`${SO}/${so2.id}/allocate`), 'allocate2');
    expect(await itemOf(so2.id)).toMatchObject({
      stage: 'SO_AWAITING_PICK',
      next: 'WAREHOUSE',
      class: 'WAITING',
    });
    const pick2 = ok(await as.wh!.post(`${W}/picks`, { salesOrderId: so2.id }), 'pick2').pick;
    ok(
      await as.wh!.post(`${W}/picks/${pick2.id}/confirm`, {
        lines: pick2.lines.map((l: J) => ({ lineId: l.id, pickedQuantity: l.planned })),
      }),
      'picked2',
    );
    expect(await itemOf(so2.id)).toMatchObject({
      stage: 'SO_AWAITING_DISPATCH',
      next: 'WAREHOUSE',
    });
    const pack2 = ok(await as.wh!.post(`${W}/packs`, { salesOrderId: so2.id }), 'pack2').pack;
    ok(await as.wh!.post(`${W}/packs/${pack2.id}/confirm`), 'packed2');
    const ship2 = ok(
      await as.wh!.post(`${W}/shipments`, { salesOrderId: so2.id }),
      'ship2',
    ).shipment;
    ok(await as.owner!.post(`${W}/shipments/${ship2.id}/dispatch`, {}), 'dispatch2');
    expect(await itemOf(so2.id)).toMatchObject({ stage: 'SO_IN_DELIVERY', next: 'WAREHOUSE' });
    ok(await as.owner!.post(`${W}/shipments/${ship2.id}/deliver`, {}), 'deliver2');
    expect(await itemOf(so2.id)).toBeNull();
    const done = await overview(as.exec!);
    expect(done.activity.some((a: J) => a.event === 'SHIPMENT_DELIVERED')).toBe(true);
    expect(await integrity()).toEqual([]);
  });

  it('R5–R8: purchase request pending → order awaiting receipt (overdue) → partial receipt → warehouse backlog', async () => {
    const p0 = await pulse(as.exec!);
    const pr = ok(
      await as.pur!.post(`${API}/purchase-requests`, {
        department: 'PURCHASING',
        purpose: 'EP48 flow',
        needByDate: plus(9),
        lines: [{ type: 'ITEM', itemId: ids.PK1, quantity: '6' }],
      }),
      'PR',
    ).request;
    ok(await as.pur!.post(`${API}/purchase-requests/${pr.id}/submit`), 'PR submit');
    expect(delta(p0, await pulse(as.exec!))).toEqual({ 'PURCHASING.requestsAwaitingDecision': 1 });
    ok(await as.owner!.post(`${API}/purchase-requests/${pr.id}/approve`, {}), 'approve');
    expect(delta(p0, await pulse(as.exec!))).toEqual({ 'PURCHASING.requestsToOrder': 1 });
    const po = ok(
      await as.pur!.post(`${API}/purchase-orders`, {
        purchaseRequestId: pr.id,
        supplierId: ids.supplier,
        expectedDate: plus(-1),
      }),
      'PO',
    ).order;
    kindOf[po.id] = 'purchase-order';
    for (const l of po.lines)
      ok(
        await as.pur!.patch(`${API}/purchase-orders/${po.id}/lines/${l.id}`, { unitPrice: '3' }),
        'price',
      );
    // Drafts are excluded (the Executive never reads a draft order).
    expect(delta(p0, await pulse(as.exec!))).toEqual({ 'PURCHASING.requestsToOrder': 1 });
    ok(await as.owner!.post(`${API}/purchase-orders/${po.id}/issue`), 'issue');
    expect(delta(p0, await pulse(as.exec!))).toEqual({
      'PURCHASING.ordersAwaitingReceipt': 1,
      'PURCHASING.linesToReceive': 1,
      'PURCHASING.overdueReceipts': 1,
    });
    expect(await itemOf(po.id)).toMatchObject({
      stage: 'PO_AWAITING_RECEIPT',
      department: 'PURCHASING',
      next: 'WAREHOUSE',
      class: 'OVERDUE',
      reason: 'OVERDUE_RECEIPT',
      dateKind: 'EXPECTED',
      evidence: { code: 'LINES_NOT_RECEIVED', open: 1, total: 1 },
    });
    const gr = ok(await as.wh!.post(`${W}/receipts`, { purchaseOrderId: po.id }), 'GR').receipt;
    expect(delta(p0, await pulse(as.exec!))).toMatchObject({ 'WAREHOUSE.receiptsToPost': 1 });
    ok(
      await as.wh!.put(`${W}/receipts/${gr.id}/lines/${gr.lines[0].id}`, {
        acceptedQuantity: '4',
        allocations: [{ locationId: ids.MAIN, quantity: '4' }],
      }),
      'GR line',
    );
    ok(await as.wh!.post(`${W}/receipts/${gr.id}/post`), 'GR post');
    expect(await itemOf(po.id)).toMatchObject({
      stage: 'PO_PARTIALLY_RECEIVED',
      next: 'WAREHOUSE',
      class: 'OVERDUE',
    });
    const d = delta(p0, await pulse(as.exec!));
    expect(d).toMatchObject({
      'PURCHASING.ordersAwaitingReceipt': 1,
      'PURCHASING.ordersPartiallyReceived': 1,
    });
    expect(d['WAREHOUSE.receiptsToPost'] ?? 0).toBe(0);
    const trace = ok(await as.exec!.get(`${X}/documents/purchase-order/${po.id}`), 'trace');
    expect(trace.related.map((r: J) => r.kind).sort()).toEqual([
      'GOODS_RECEIPT',
      'PURCHASE_REQUEST',
    ]);
    expect(await integrity()).toEqual([]);
  });

  const manufacture = async (mo: J, planner: Browser) => {
    kindOf[mo.id] = 'production-order';
    const stage = async () => (await itemOf(mo.id))?.stage ?? null;
    ok(await planner.post(`${P}/orders/${mo.id}/submit`), 'submit');
    expect(await stage()).toBe('MO_AWAITING_APPROVAL');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/approve`), 'approve');
    expect(await stage()).toBe('MO_AWAITING_RESERVATION');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/materials/allocate`), 'reserve');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/release`), 'release');
    expect(await stage()).toBe('MO_READY_TO_START');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/start`, { note: 'EP48' }), 'start');
    expect(await itemOf(mo.id)).toMatchObject({
      stage: 'MO_AWAITING_ISSUE',
      next: 'OPERATIONS',
      evidence: { code: 'RESERVED_NOT_ISSUED' },
    });
    const issue = ok(
      await planner.post(`${P}/issues`, { productionOrderId: mo.id, note: 'EP48' }),
      'issue',
    ).issue.id;
    ok(await as.opm!.post(`${P}/issues/${issue}/post`), 'issue post');
    expect(await stage()).toBe('MO_IN_PRODUCTION');
    for (const m of j(await as.opm!.get(`${P}/orders/${mo.id}`)).order.materials as J[])
      ok(
        await planner.post(`${P}/orders/${mo.id}/usage`, {
          materialId: m.id,
          quantity: m.issued,
          note: null,
        }),
        'usage',
      );
    const out = ok(
      await planner.post(`${P}/outputs`, {
        productionOrderId: mo.id,
        productionDate: today,
        goodQuantity: mo.quantity,
        defectiveQuantity: '0',
        note: 'EP48',
      }),
      'output',
    );
    const outId = (out.output ?? out.report).id as string;
    ok(await planner.post(`${P}/outputs/${outId}/submit`), 'output submit');
    expect(await stage()).toBe('MO_OUTPUT_TO_REVIEW');
    ok(await as.opm!.post(`${P}/outputs/${outId}/accept`, {}), 'accept');
    // Production → Warehouse handoff: finished goods to receive.
    expect(await itemOf(mo.id)).toMatchObject({
      stage: 'MO_FG_TO_RECEIVE',
      department: 'OPERATIONS',
      next: 'WAREHOUSE',
    });
    const fgr = ok(
      await as.wh!.post(`${W}/finished-goods/receipts`, {
        outputReportId: outId,
        lines: [
          {
            locationId: ids.MAIN,
            quantity: mo.quantity,
            lotNumber: `EP48-${mo.number}`,
            expiryDate: plus(365),
            manufacturedDate: today,
          },
        ],
        note: null,
      }),
      'FG',
    ).receipt.id;
    ok(await as.owner!.post(`${W}/finished-goods/receipts/${fgr}/post`), 'FG post');
    expect(await stage()).toBe('MO_IN_PRODUCTION');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/review`, {}), 'review');
    expect(await stage()).toBe('MO_COMPLETION_REVIEW');
    ok(
      await as.opm!.post(`${P}/orders/${mo.id}/complete`, {
        outcome: 'COMPLETED',
        materialsReviewed: true,
      }),
      'complete',
    );
    expect(await itemOf(mo.id)).toBeNull();
    expect(await integrity()).toEqual([]);
  };

  it('R9/R12: BOM_REQUIRED manufacturing — every stage, Production → Warehouse handoff, completion', async () => {
    const p0 = await pulse(as.exec!);
    const bom = ok(
      await as.owner!.post(`${P}/boms`, {
        itemId: ids.FG3,
        outputQuantity: '1',
        lines: [{ itemId: ids.PK1, quantity: '2' }],
      }),
      'BOM',
    ).bom;
    ok(await as.owner!.post(`${P}/boms/${bom.id}/activate`), 'BOM activate');
    await stockIn(ids.PK1!, '20');
    const mo = ok(
      await as.ops!.post(`${P}/orders`, { itemId: ids.FG3, quantity: '3', requiredDate: plus(4) }),
      'MO',
    ).order;
    await manufacture(mo, as.ops!);
    expect(delta(p0, await pulse(as.exec!))).toMatchObject({ 'OPERATIONS.completedRecently': 1 });
  });

  it('R10: BOM_OPTIONAL manufacturing — an explicit plan runs the same stages', async () => {
    ok(
      await as.owner!.patch(`${C}/current/settings`, { manufacturingMode: 'BOM_OPTIONAL' }),
      'mode',
    );
    await stockIn(ids.PK1!, '10');
    const mo = ok(
      await as.ops!.post(`${P}/orders`, {
        itemId: ids.FG2,
        quantity: '2',
        materialPlan: 'MANUAL',
        requiredDate: plus(4),
      }),
      'MO',
    ).order;
    ok(
      await as.ops!.put(`${P}/orders/${mo.id}/materials`, {
        lines: [{ itemId: ids.PK1, quantity: '5' }],
      }),
      'plan',
    );
    await manufacture(mo, as.ops!);
  });

  it('R11: a material shortage blocks production and hands it to Purchasing (evidence: materials short)', async () => {
    const mo = ok(
      await as.ops!.post(`${P}/orders`, {
        itemId: ids.FG2,
        quantity: '1',
        materialPlan: 'MANUAL',
        requiredDate: plus(3),
      }),
      'MO',
    ).order;
    kindOf[mo.id] = 'production-order';
    ok(
      await as.ops!.put(`${P}/orders/${mo.id}/materials`, {
        lines: [{ itemId: ids.RM1, quantity: '99999' }],
      }),
      'plan',
    );
    ok(await as.ops!.post(`${P}/orders/${mo.id}/submit`), 'submit');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/approve`), 'approve');
    const i = await itemOf(mo.id);
    expect(i).toMatchObject({
      stage: 'MO_MATERIALS_SHORT',
      department: 'OPERATIONS',
      next: 'PURCHASING',
      class: 'BLOCKED',
      reason: 'PRODUCTION_SHORTAGE',
      evidence: { code: 'MATERIALS_SHORT', count: 1 },
    });
    const o = await overview(as.exec!);
    const flow = o.bottlenecks.find((b: J) => b.key === 'PURCHASING_TO_PRODUCTION');
    expect(flow.items.some((x: J) => x.id === mo.id)).toBe(true);
    expect(o.queue.items.find((x: J) => x.id === mo.id)?.reason).toBe('PRODUCTION_SHORTAGE');
    // Blocked items lead the queue.
    const firstNonBlocked = o.queue.items.findIndex((x: J) => x.class !== 'BLOCKED');
    expect(o.queue.items.slice(firstNonBlocked).every((x: J) => x.class !== 'BLOCKED')).toBe(true);
    // No quantity in the evidence — only the number of short materials.
    expect(JSON.stringify(o)).not.toMatch(/99999/);
    ok(
      await as.opm!.post(`${P}/orders/${mo.id}/cancel`, { reason: 'EP48 shortage test' }),
      'cancel',
    );
    expect(await itemOf(mo.id)).toBeNull();
    expect(await integrity()).toEqual([]);
    ok(
      await as.owner!.patch(`${C}/current/settings`, { manufacturingMode: 'BOM_REQUIRED' }),
      'mode back',
    );
  });
});
