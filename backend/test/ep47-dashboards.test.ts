import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapPlatform, parseSeedEnv, seedDemo } from '../src/auth/bootstrap.js';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { DASHBOARD_DEPARTMENTS } from '../src/dashboards/service.js';
import { DashboardView } from '../src/dashboards/view.js';
import { DEMO_PERSONAS } from '../src/demo/personas.js';
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
 * EP47 — department dashboards (docs/EP47_METRIC_DEFINITIONS.md,
 * docs/EP47_PERMISSION_MATRIX.md). D1 … D15 are the negative cases of the EP47
 * brief (Phase 12); W1 … W4 the workflow transitions of Phase 13, run on the
 * seeded demo world in the disposable test database.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const API = '/api/v1';
const D = `${API}/dashboards`;
const C = `${API}/company`;
const P = `${API}/production`;
const W = `${API}/warehouse`;
const SO = `${API}/sales/orders`;

describe('EP47 dashboard catalog', () => {
  it('five operational dashboards; the Executive Command Center is not part of EP47', () => {
    expect(DASHBOARD_DEPARTMENTS).toEqual([
      'SALES',
      'OPERATIONS',
      'WAREHOUSE',
      'PURCHASING',
      'ACCOUNTING',
    ]);
    expect(DASHBOARD_DEPARTMENTS as readonly string[]).not.toContain('EXECUTIVE');
  });

  it('the response allow-list is strict: an unexpected field fails instead of leaking', () => {
    const answer = {
      department: 'WAREHOUSE',
      branch: { id: 'b', code: '00001', name: 'X' },
      today: '2026-11-16',
      generatedAt: new Date().toISOString(),
      access: 'READ',
      manufacturingMode: null,
      metrics: [],
      queues: [],
      notes: [],
    };
    expect(DashboardView.safeParse(answer).success).toBe(true);
    expect(DashboardView.safeParse({ ...answer, unitCost: '1' }).success).toBe(false);
    const item = {
      id: 'x',
      kind: 'GOODS_RECEIPT',
      number: 'GR-1',
      status: 'DRAFT',
      context: null,
      action: 'GOODS_RECEIPT.POST',
      responsible: 'WAREHOUSE',
      canAct: false,
      date: null,
      dateKind: null,
      overdue: false,
      progress: null,
      quantity: null,
      amount: null,
      link: null,
    };
    const q = (i: J) => ({ ...answer, queues: [{ key: 'work', total: 1, items: [i] }] });
    expect(DashboardView.safeParse(q(item)).success).toBe(true);
    expect(DashboardView.safeParse(q({ ...item, unitPrice: '5' })).success).toBe(false);
    expect(DashboardView.safeParse(q({ ...item, link: 'https://evil.example' })).success).toBe(
      false,
    );
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
/** Any money-shaped key with a value (the EP45 A18 rule, `total` of a queue excepted). */
const MONEY_KEY =
  /"(?!total")[a-zA-Z]*([pP]rice|[aA]mount|[tT]otal|[dD]iscount|[cC]ost|[mM]argin|[dD]eposit|[pP]ayment)[a-zA-Z]*":\s*("|-?\d|\{)/;
const RECIPE_KEY = /"(bom[a-zA-Z]*|recipe[a-zA-Z]*|ratio|required|materials?|lines)":/;

describeDb('EP47 department dashboards (demo world)', () => {
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
  /** An extra member of the demo company with ONE department, demo branch only. */
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
  const dash = async (b: Browser, dept: string) => ok(await b.get(`${D}/${dept}`), dept);
  /** Metric key → value (absent metrics are not in the map). */
  const nums = async (b: Browser, dept: string) =>
    Object.fromEntries((await dash(b, dept)).metrics.map((m: J) => [m.key, m.value])) as Record<
      string,
      number
    >;
  const delta = (a: Record<string, number>, b: Record<string, number>) =>
    Object.fromEntries(
      Object.keys(b)
        .filter((k) => b[k] !== a[k])
        .map((k) => [k, b[k]! - (a[k] ?? 0)]),
    );
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

  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'true' });
    await resetDb(h.db);
    const env = parseSeedEnv(ENV);
    await bootstrapPlatform(h.db, env);
    await seedDemo(h.db, env);
    const item = async (c: string) => (await h.db.item.findFirstOrThrow({ where: { code: c } })).id;
    Object.assign(ids, {
      branch: (await h.db.branch.findFirstOrThrow({ where: { code: '00001' } })).id,
      ho: (await h.db.branch.findFirstOrThrow({ where: { code: '00000' } })).id,
      FG2: await item('FG-000002'),
      FG3: await item('FG-000003'),
      PK1: await item('PK-000001'),
      customer: (await h.db.customer.findFirstOrThrow({ where: { code: 'CUS-000002' } })).id,
      supplier: (await h.db.supplier.findFirstOrThrow({ where: { status: 'ACTIVE' } })).id,
    });
    ids.MAIN = (
      await h.db.warehouseLocation.findFirstOrThrow({
        where: { code: 'MAIN', branch: { code: '00001' } },
      })
    ).id;
    // Distinctive money: these digits in an answer that must not carry money are a leak.
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
        await h.db.companyMember.findFirstOrThrow({
          where: { user: { emailNormalized: p.email } },
        })
      ).id;
    as.ops = await extraMember('ops.staff@demo.example', 'DEPARTMENT_STAFF', 'OPERATIONS');
    as.opsViewer = await extraMember('ops.viewer@demo.example', 'VIEWER', 'OPERATIONS');
    as.unassigned = await extraMember('nobody@demo.example', 'DEPARTMENT_STAFF', null);
    today = j(await as.owner!.get(`${P}/context`)).today as string;
  }, 300_000);
  afterAll(async () => h?.close());

  // ---------------------------------------------------------------- role-aware access

  const WHO: [string, DepartmentCode[]][] = [
    ['owner', [...DASHBOARD_DEPARTMENTS]],
    ['exec', [...DASHBOARD_DEPARTMENTS]],
    ['sales', ['SALES']],
    ['opm', ['OPERATIONS']],
    ['ops', ['OPERATIONS']],
    ['opsViewer', ['OPERATIONS']],
    ['wh', ['WAREHOUSE']],
    ['staff', ['WAREHOUSE']],
    ['pur', ['PURCHASING']],
    ['acc', ['ACCOUNTING']],
    ['admin', []],
    ['unassigned', []],
  ];

  it('D1/D5/D6/D10: each person opens exactly the dashboards of their access — every other is 403 on a direct request', async () => {
    for (const [k, mine] of WHO) {
      const index = await as[k]!.get(D);
      expect(index.statusCode, `${k} ${index.body}`).toBe(200);
      expect(j(index).dashboards, k).toEqual(mine);
      for (const d of DASHBOARD_DEPARTMENTS) {
        const res = await as[k]!.get(`${D}/${d.toLowerCase()}`);
        if (mine.includes(d)) {
          expect(res.statusCode, `${k} ${d} ${res.body}`).toBe(200);
          expect(j(res).department).toBe(d);
        } else {
          expect(res.statusCode, `${k} ${d}`).toBe(403);
          expect(code(res)).toBe('PERMISSION_DENIED');
          // A refusal names the permission only — no count, no row.
          expect(Object.keys(j(res).error).sort()).toEqual([
            'code',
            'details',
            'message',
            'requestId',
          ]);
        }
      }
      // The Executive Command Center is EP48: there is no executive dashboard here.
      expect((await as[k]!.get(`${D}/executive`)).statusCode).toBe(404);
    }
    // Signed out: 401.
    expect((await new Browser(h.app).get(`${D}/sales`)).statusCode).toBe(401);
  });

  it('D4/D12: there is no mutation route under /dashboards — not for the Executive, not for the owner, not with an override', async () => {
    const routes = routesOf(h).filter((r) => r.path.startsWith('/api/v1/dashboards'));
    expect(routes.length).toBeGreaterThanOrEqual(2);
    expect(routes.filter((r) => r.method !== 'GET')).toEqual([]);
    const before = await stateHash();
    for (const k of ['exec', 'owner'])
      for (const m of ['post', 'put', 'patch', 'delete'] as const)
        for (const path of [`${D}/sales`, `${D}/operations`, D])
          expect(
            (await (as[k]! as any)[m](path, { ownerOverride: { reason: 'dashboard' } })).statusCode,
          ).toBe(404);
    expect(await stateHash()).toEqual(before);
  });

  it('Executive: read-only — every queue row says it cannot act; Viewer the same', async () => {
    for (const k of ['exec', 'opsViewer'])
      for (const d of j(await as[k]!.get(D)).dashboards as string[]) {
        const body = await dash(as[k]!, d);
        expect(body.access, `${k} ${d}`).toBe('READ');
        for (const q of body.queues)
          for (const i of q.items) expect(i.canAct, `${k} ${d} ${i.number}`).toBe(false);
      }
  });

  it('D2/D14: Warehouse dashboards carry no price, cost, discount, total or deposit — for anyone who opens them', async () => {
    for (const k of ['wh', 'staff', 'owner', 'exec']) {
      const res = await as[k]!.get(`${D}/warehouse`);
      expect(res.statusCode).toBe(200);
      expect(res.body, k).not.toMatch(/987654|876543|765432/);
      expect(MONEY_KEY.exec(res.body)?.[0] ?? null, k).toBeNull();
      for (const q of j(res).queues) for (const i of q.items) expect(i.amount, k).toBeNull();
    }
    // No dashboard but Accounting's ever carries an amount; none carries a line price or total.
    for (const d of ['sales', 'purchasing', 'operations']) {
      const res = await as.owner!.get(`${D}/${d}`);
      expect(res.body, d).not.toMatch(/987654|876543|765432/);
      for (const q of j(res).queues) for (const i of q.items) expect(i.amount, d).toBeNull();
    }
  });

  it('D3/D14: Production Staff and Viewers read no recipe — no BOM line, ratio or material quantity in the production dashboard', async () => {
    for (const k of ['ops', 'opsViewer', 'exec', 'opm', 'owner']) {
      const res = await as[k]!.get(`${D}/operations`);
      expect(res.statusCode).toBe(200);
      expect(RECIPE_KEY.exec(res.body)?.[0] ?? null, k).toBeNull();
      const body = j(res);
      expect(['BOM_REQUIRED', 'BOM_OPTIONAL']).toContain(body.manufacturingMode);
      // The only quantity is the order's own outstanding OUTPUT, in the order's unit.
      for (const i of body.queues[0].items) {
        expect(i.kind).toBe('PRODUCTION_ORDER');
        const mo = await h.db.productionOrder.findUniqueOrThrow({ where: { id: i.id } });
        expect(i.quantity.unit).toBe(mo.unitCode);
        expect(Number(i.quantity.value)).toBeLessThanOrEqual(Number(mo.quantity));
      }
    }
    // The staff member still has a usable work queue (no confidential data needed for it).
    expect((await dash(as.ops!, 'operations')).queues[0].total).toBeGreaterThan(0);
  });

  it('D15: supplier-deposit amounts reach Accounting only; Purchasing sees the waiting state without money', async () => {
    const acc = await dash(as.acc!, 'accounting');
    expect(acc.notes).toEqual(['ACCOUNTING_SCOPE']);
    const pur = await as.pur!.get(`${D}/purchasing`);
    expect(pur.body).not.toMatch(/"amount":\{/);
    expect((await as.pur!.get(`${D}/accounting`)).statusCode).toBe(403);
    expect((await as.wh!.get(`${D}/accounting`)).statusCode).toBe(403);
    // In the Accounting branch (Head Office) deposits are listed with their amount.
    const pending = await h.db.purchaseOrder.count({
      where: { branchId: ids.ho, status: 'WAITING_DEPOSIT', depositStatus: 'PENDING' },
    });
    expect(acc.metrics.find((m: J) => m.key === 'depositsPending').value).toBe(pending);
    for (const i of acc.queues[0].items) {
      expect(i.kind).toBe('SUPPLIER_DEPOSIT');
      const po = await h.db.purchaseOrder.findUniqueOrThrow({ where: { id: i.id } });
      expect(i.amount).toEqual(
        po.depositAmount ? { value: po.depositAmount.toFixed(2), currency: po.currency } : null,
      );
    }
  });

  it('D9: a forged companyId / branchId is refused (400) — the session decides the scope', async () => {
    for (const q of [
      `?branchId=${ids.ho}`,
      '?companyId=cm0000000000000000000000000',
      '?department=WAREHOUSE',
    ]) {
      expect((await as.sales!.get(`${D}/sales${q}`)).statusCode, q).toBe(400);
      expect((await as.sales!.get(`${D}${q}`)).statusCode, q).toBe(400);
    }
    // The refused requests changed nothing: still the session's branch.
    expect(j(await as.sales!.get(`${D}/sales`)).branch.code).toBe('00001');
  });

  it('D8: every number and row belongs to the selected branch (owner in two branches)', async () => {
    const owner = await persona('owner.demo@pdabliss.com', '00000');
    const branchOfDoc: Record<string, (id: string) => Promise<string | undefined>> = {
      SALES_ORDER: async (id) => (await h.db.salesOrder.findUnique({ where: { id } }))?.branchId,
      PURCHASE_REQUEST: async (id) =>
        (await h.db.purchaseRequest.findUnique({ where: { id } }))?.branchId,
      PURCHASE_ORDER: async (id) =>
        (await h.db.purchaseOrder.findUnique({ where: { id } }))?.branchId,
      SUPPLIER_DEPOSIT: async (id) =>
        (await h.db.purchaseOrder.findUnique({ where: { id } }))?.branchId,
      GOODS_RECEIPT: async (id) =>
        (await h.db.goodsReceipt.findUnique({ where: { id } }))?.branchId,
      PRODUCTION_ORDER: async (id) =>
        (await h.db.productionOrder.findUnique({ where: { id } }))?.branchId,
      STOCK_ADJUSTMENT: async (id) =>
        (await h.db.stockAdjustment.findUnique({ where: { id } }))?.branchId,
      CYCLE_COUNT: async (id) => (await h.db.cycleCount.findUnique({ where: { id } }))?.branchId,
      INVENTORY_TRANSFER: async (id) =>
        (await h.db.inventoryTransfer.findUnique({ where: { id } }))?.branchId,
      SALES_PICK: async (id) => (await h.db.salesPick.findUnique({ where: { id } }))?.branchId,
      SALES_PACK: async (id) => (await h.db.salesPack.findUnique({ where: { id } }))?.branchId,
      SALES_SHIPMENT: async (id) =>
        (await h.db.salesShipment.findUnique({ where: { id } }))?.branchId,
      FINISHED_GOODS_RECEIPT: async (id) =>
        (await h.db.productionGoodsReceipt.findUnique({ where: { id } }))?.branchId,
    };
    for (const [b, branchId] of [
      [owner, ids.ho],
      [as.owner!, ids.branch],
    ] as const) {
      for (const d of DASHBOARD_DEPARTMENTS) {
        const body = await dash(b, d);
        expect(body.branch.id).toBe(branchId);
        for (const q of body.queues)
          for (const i of q.items) {
            const at = await branchOfDoc[i.kind]!(i.id);
            expect(at, `${d} ${i.kind} ${i.number}`).toBe(branchId);
          }
      }
      // Independent recounts per branch.
      const s = await nums(b, 'sales');
      expect(s.awaitingConfirmation).toBe(
        await h.db.salesOrder.count({ where: { branchId, status: 'SUBMITTED' } }),
      );
      const w = await nums(b, 'warehouse');
      expect(w.receiptsToPost).toBe(
        await h.db.goodsReceipt.count({ where: { branchId, status: 'DRAFT' } }),
      );
      expect(w.incomingOrders).toBe(
        await h.db.purchaseOrder.count({ where: { branchId, status: 'PENDING_RECEIVE' } }),
      );
      const p = await nums(b, 'purchasing');
      expect(p.requestsAwaitingDecision).toBe(
        await h.db.purchaseRequest.count({ where: { branchId, status: 'SUBMITTED' } }),
      );
    }
  });

  it('D7: another company sees none of this company in any aggregate', async () => {
    const beta = await createActiveCompany(h.db, {
      name: 'Beta',
      plan: 'ENTERPRISE',
      departments: [...DASHBOARD_DEPARTMENTS],
    });
    await createUser(h.db, 'owner@beta.example', {
      companyRole: 'COMPANY_OWNER',
      companyId: beta.companyId,
    });
    const b = await signIn(h, 'owner@beta.example');
    await select(b, '00000');
    const index = j(await b.get(D));
    for (const d of index.dashboards as string[]) {
      const body = await dash(b, d);
      for (const m of body.metrics) expect(m.value, `${d} ${m.key}`).toBe(0);
      for (const q of body.queues) expect(q.total, `${d} ${q.key}`).toBe(0);
    }
    // And the demo company's ids are not reachable through the dashboard either.
    expect(JSON.stringify(index)).not.toContain(ids.branch);
  });

  it('D11: a revoked permission or department shows on the very next request; answers are never cached', async () => {
    const res = await as.sales!.get(`${D}/sales`);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    const email = 'sales.demo@pdabliss.com';
    await as.owner!.put(`${C}/current/members/${member[email]}/permissions`, {
      changes: [{ permission: 'sales.workspace.view', effect: 'DENY' }],
    });
    expect((await as.sales!.get(`${D}/sales`)).statusCode).toBe(403);
    expect(j(await as.sales!.get(D)).dashboards).toEqual([]);
    await as.owner!.put(`${C}/current/members/${member[email]}/permissions`, {
      changes: [{ permission: 'sales.workspace.view', effect: null }],
    });
    // A metric's own permission removed: that metric disappears, the dashboard stays.
    await as.owner!.put(`${C}/current/members/${member[email]}/permissions`, {
      changes: [{ permission: 'sales.orders.view', effect: 'DENY' }],
    });
    const bare = await dash(as.sales!, 'sales');
    expect(bare.metrics).toEqual([]);
    expect(bare.queues).toEqual([]);
    await as.owner!.put(`${C}/current/members/${member[email]}/permissions`, {
      changes: [{ permission: 'sales.orders.view', effect: null }],
    });
    // Department reassigned: the old dashboard closes at once.
    await as.owner!.put(`${C}/current/members/${member[email]}/departments`, {
      departments: ['PURCHASING'],
    });
    expect((await as.sales!.get(`${D}/sales`)).statusCode).toBe(403);
    expect(j(await as.sales!.get(D)).dashboards).toEqual(['PURCHASING']);
    await as.owner!.put(`${C}/current/members/${member[email]}/departments`, {
      departments: ['SALES'],
    });
    expect((await as.sales!.get(`${D}/sales`)).statusCode).toBe(200);
  });

  it('D13: every drill-down link a person receives opens for that person (and only safe CORE paths are linked)', async () => {
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
    ];
    let checked = 0;
    for (const [k] of WHO) {
      const mine = j(await as[k]!.get(D)).dashboards as string[];
      for (const d of mine) {
        const body = await dash(as[k]!, d);
        for (const q of body.queues)
          for (const i of q.items) {
            if (!i.link) continue;
            const rule = API_OF.find(([re]) => re.test(i.link));
            expect(rule, `${k} unmapped link ${i.link}`).toBeDefined();
            const res = await as[k]!.get(rule![1](rule![0].exec(i.link)!));
            expect(res.statusCode, `${k} ${d} ${i.link} → ${res.body.slice(0, 200)}`).toBe(200);
            checked++;
          }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('dashboards never write: reading every dashboard as every person changes no business table', async () => {
    const before = await stateHash();
    for (const [k] of WHO)
      for (const d of DASHBOARD_DEPARTMENTS) await as[k]!.get(`${D}/${d.toLowerCase()}`);
    expect(await stateHash()).toEqual(before);
  });

  // ---------------------------------------------------------------- real workflow transitions

  /** Exactly one of `keys` moved by +1 (and the others not at all) — no double counting. */
  const onlyOne = (d: Record<string, number>, keys: string[], expected: string | null) => {
    const moved = keys.filter((k) => (d[k] ?? 0) !== 0);
    if (expected === null) expect(moved, JSON.stringify(d)).toEqual([]);
    else {
      expect(moved, JSON.stringify(d)).toContain(expected);
      expect(d[expected]).toBe(1);
    }
  };

  it('W1: sales order → submitted → confirmed → allocated → picked → packed → dispatched → delivered moves through exactly one stage at a time', async () => {
    const STAGES = [
      'awaitingConfirmation',
      'awaitingAllocation',
      'awaitingFulfilment',
      'inDelivery',
      'completedRecently',
    ];
    // Stock for the order (Warehouse staff count it in; the owner approves the adjustment).
    const adj = ok(
      await as.wh!.post(`${W}/adjustments`, {
        reason: 'FOUND',
        lines: [
          {
            direction: 'INCREASE',
            locationId: ids.MAIN,
            itemId: ids.FG2,
            quantity: '4',
            newLotNumber: 'EP47-SO-1',
            newLotExpiry: plus(300),
          },
        ],
      }),
      'adjustment',
    ).adjustment;
    ok(await as.wh!.post(`${W}/adjustments/${adj.id}/submit`), 'submit adj');
    ok(await as.owner!.post(`${W}/adjustments/${adj.id}/approve`), 'approve adj');

    const s0 = await nums(as.sales!, 'sales');
    const w0 = await nums(as.wh!, 'warehouse');
    const draft = ok(
      await as.sales!.post(SO, {
        customerId: ids.customer,
        requestedDate: plus(5),
        lines: [{ itemId: ids.FG2, quantity: '2', unitPrice: '10' }],
      }),
      'SO',
    ).order;
    const s1 = await nums(as.sales!, 'sales');
    expect(delta(s0, s1)).toEqual({ myDrafts: 1 });

    ok(await as.sales!.post(`${SO}/${draft.id}/submit`), 'submit');
    const s2 = await nums(as.sales!, 'sales');
    onlyOne(delta(s0, s2), STAGES, 'awaitingConfirmation');
    expect(delta(s0, s2).newOrders).toBe(1);
    const row = (await dash(as.sales!, 'sales')).queues[0].items.find((i: J) => i.id === draft.id);
    expect(row).toMatchObject({
      action: 'SALES_ORDER.CONFIRM',
      responsible: 'SALES',
      canAct: false,
    });
    const ownerRow = (await dash(as.owner!, 'sales')).queues[0].items.find(
      (i: J) => i.id === draft.id,
    );
    expect(ownerRow.canAct).toBe(true);

    ok(await as.owner!.post(`${SO}/${draft.id}/confirm`), 'confirm');
    onlyOne(delta(s0, await nums(as.sales!, 'sales')), STAGES, 'awaitingAllocation');

    ok(await as.owner!.post(`${SO}/${draft.id}/allocate`), 'allocate');
    const s4 = await nums(as.sales!, 'sales');
    onlyOne(delta(s0, s4), STAGES, 'awaitingFulfilment');
    expect(delta(w0, await nums(as.wh!, 'warehouse')).ordersToPick).toBe(1);

    const pick = ok(await as.wh!.post(`${W}/picks`, { salesOrderId: draft.id }), 'pick').pick;
    expect(delta(w0, await nums(as.wh!, 'warehouse'))).toMatchObject({ picksOpen: 1 });
    ok(
      await as.wh!.post(`${W}/picks/${pick.id}/confirm`, {
        lines: pick.lines.map((l: J) => ({ lineId: l.id, pickedQuantity: l.planned })),
      }),
      'pick confirm',
    );
    const pack = ok(await as.wh!.post(`${W}/packs`, { salesOrderId: draft.id }), 'pack').pack;
    expect(delta(w0, await nums(as.wh!, 'warehouse'))).toMatchObject({ packsOpen: 1 });
    ok(await as.wh!.post(`${W}/packs/${pack.id}/confirm`), 'pack confirm');
    const ship = ok(
      await as.wh!.post(`${W}/shipments`, { salesOrderId: draft.id }),
      'shipment',
    ).shipment;
    const w5 = delta(w0, await nums(as.wh!, 'warehouse'));
    expect(w5).toMatchObject({ readyToDispatch: 1 });
    expect(w5.picksOpen ?? 0).toBe(0);
    expect(w5.packsOpen ?? 0).toBe(0);
    // Still one stage for Sales: fulfilment, until stock leaves.
    onlyOne(delta(s0, await nums(as.sales!, 'sales')), STAGES, 'awaitingFulfilment');

    ok(await as.owner!.post(`${W}/shipments/${ship.id}/dispatch`, {}), 'dispatch');
    onlyOne(delta(s0, await nums(as.sales!, 'sales')), STAGES, 'inDelivery');
    expect(delta(w0, await nums(as.wh!, 'warehouse'))).toMatchObject({ inTransit: 1 });

    ok(await as.owner!.post(`${W}/shipments/${ship.id}/deliver`, {}), 'deliver');
    const s7 = delta(s0, await nums(as.sales!, 'sales'));
    onlyOne(s7, STAGES, 'completedRecently');
    expect(s7.outstandingLines ?? 0).toBe(0);
    const w7 = delta(w0, await nums(as.wh!, 'warehouse'));
    expect(w7.inTransit ?? 0).toBe(0);
    expect(w7.readyToDispatch ?? 0).toBe(0);
    expect(await integrity()).toEqual([]);
  });

  it('W2: purchase request → purchase order → goods receipt moves Purchasing and Warehouse counts together', async () => {
    const p0 = await nums(as.pur!, 'purchasing');
    const w0 = await nums(as.wh!, 'warehouse');
    const pr = ok(
      await as.pur!.post(`${API}/purchase-requests`, {
        department: 'PURCHASING',
        purpose: 'EP47 dashboard flow',
        needByDate: plus(10),
        lines: [{ type: 'ITEM', itemId: ids.PK1, quantity: '6' }],
      }),
      'PR',
    ).request;
    ok(await as.pur!.post(`${API}/purchase-requests/${pr.id}/submit`), 'PR submit');
    expect(delta(p0, await nums(as.pur!, 'purchasing'))).toEqual({ requestsAwaitingDecision: 1 });
    ok(await as.owner!.post(`${API}/purchase-requests/${pr.id}/approve`, {}), 'PR approve');
    expect(delta(p0, await nums(as.pur!, 'purchasing'))).toEqual({ requestsToOrder: 1 });

    const po = ok(
      await as.pur!.post(`${API}/purchase-orders`, {
        purchaseRequestId: pr.id,
        supplierId: ids.supplier,
        expectedDate: plus(7),
      }),
      'PO',
    ).order;
    for (const l of po.lines)
      ok(
        await as.pur!.patch(`${API}/purchase-orders/${po.id}/lines/${l.id}`, { unitPrice: '3' }),
        'price',
      );
    // A draft order reserves nothing: the request still waits to be ordered.
    expect(delta(p0, await nums(as.pur!, 'purchasing'))).toEqual({
      requestsToOrder: 1,
      ordersToIssue: 1,
    });
    ok(await as.owner!.post(`${API}/purchase-orders/${po.id}/issue`), 'issue');
    const p3 = delta(p0, await nums(as.pur!, 'purchasing'));
    expect(p3).toMatchObject({ ordersOpen: 1, outstandingLines: 1 });
    expect(p3.requestsToOrder ?? 0).toBe(0);
    expect(p3.ordersToIssue ?? 0).toBe(0);
    expect(delta(w0, await nums(as.wh!, 'warehouse'))).toEqual({ incomingOrders: 1 });

    const gr = ok(await as.wh!.post(`${W}/receipts`, { purchaseOrderId: po.id }), 'GR').receipt;
    expect(delta(w0, await nums(as.wh!, 'warehouse'))).toEqual({
      incomingOrders: 1,
      receiptsToPost: 1,
    });
    ok(
      await as.wh!.put(`${W}/receipts/${gr.id}/lines/${gr.lines[0].id}`, {
        acceptedQuantity: '6',
        allocations: [{ locationId: ids.MAIN, quantity: '6' }],
      }),
      'GR line',
    );
    ok(await as.wh!.post(`${W}/receipts/${gr.id}/post`), 'GR post');
    expect(delta(w0, await nums(as.wh!, 'warehouse'))).toEqual({});
    expect(delta(p0, await nums(as.pur!, 'purchasing'))).toEqual({});
    expect(await integrity()).toEqual([]);
  });

  const STATES = [
    'awaitingApproval',
    'awaitingReservation',
    'readyToStart',
    'inProduction',
    'paused',
    'completionReview',
    'completedRecently',
  ];

  /** One manufacturing order from submission to completion, checking the dashboards at each step. */
  const manufacture = async (mo: J) => {
    const o0 = await nums(as.ops!, 'operations');
    const w0 = await nums(as.wh!, 'warehouse');
    const step = async (expected: string | null, extra: Record<string, number> = {}) => {
      const d = delta(o0, await nums(as.ops!, 'operations'));
      onlyOne(d, STATES, expected);
      for (const [k, v] of Object.entries(extra)) expect(d[k] ?? 0, k).toBe(v);
    };
    ok(await as.ops!.post(`${P}/orders/${mo.id}/submit`), 'submit');
    await step('awaitingApproval', { myDrafts: -1 });
    const item = (await dash(as.ops!, 'operations')).queues[0].items.find((i: J) => i.id === mo.id);
    expect(item).toMatchObject({ action: 'PRODUCTION_ORDER.APPROVE', canAct: false });
    ok(await as.opm!.post(`${P}/orders/${mo.id}/approve`), 'approve');
    await step('awaitingReservation');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/materials/allocate`), 'reserve');
    await step('awaitingReservation', { materialsShort: 0 });
    ok(await as.opm!.post(`${P}/orders/${mo.id}/release`), 'release');
    await step('readyToStart');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/start`, { note: 'EP47' }), 'start');
    await step('inProduction');
    const before = await h.db.stockMovement.count();
    const issue = ok(
      await as.ops!.post(`${P}/issues`, { productionOrderId: mo.id, note: 'EP47' }),
      'issue',
    ).issue.id as string;
    await step('inProduction', { issuesToPost: 1 });
    ok(await as.opm!.post(`${P}/issues/${issue}/post`), 'issue post');
    await step('inProduction', { issuesToPost: 0 });
    expect(await h.db.stockMovement.count()).toBeGreaterThan(before);
    for (const m of j(await as.opm!.get(`${P}/orders/${mo.id}`)).order.materials as J[])
      ok(
        await as.ops!.post(`${P}/orders/${mo.id}/usage`, {
          materialId: m.id,
          quantity: m.issued,
          note: null,
        }),
        'usage',
      );
    const out = ok(
      await as.ops!.post(`${P}/outputs`, {
        productionOrderId: mo.id,
        productionDate: today,
        goodQuantity: mo.quantity,
        defectiveQuantity: '0',
        note: 'EP47',
      }),
      'output',
    );
    const outId = (out.output ?? out.report).id as string;
    ok(await as.ops!.post(`${P}/outputs/${outId}/submit`), 'output submit');
    await step('inProduction', { outputToReview: 1 });
    ok(await as.opm!.post(`${P}/outputs/${outId}/accept`, {}), 'accept');
    await step('inProduction', { outputToReview: 0 });
    expect(delta(w0, await nums(as.wh!, 'warehouse'))).toMatchObject({ finishedGoodsToReceive: 1 });
    const fgr = ok(
      await as.wh!.post(`${W}/finished-goods/receipts`, {
        outputReportId: outId,
        lines: [
          {
            locationId: ids.MAIN,
            quantity: mo.quantity,
            lotNumber: `EP47-${mo.number}`,
            expiryDate: plus(365),
            manufacturedDate: today,
          },
        ],
        note: null,
      }),
      'FG receipt',
    ).receipt.id as string;
    expect(delta(w0, await nums(as.wh!, 'warehouse'))).toMatchObject({
      finishedGoodsToReceive: 1,
      finishedGoodsDrafts: 1,
    });
    ok(await as.owner!.post(`${W}/finished-goods/receipts/${fgr}/post`), 'FG post');
    const wEnd = delta(w0, await nums(as.wh!, 'warehouse'));
    expect(wEnd.finishedGoodsToReceive ?? 0).toBe(0);
    expect(wEnd.finishedGoodsDrafts ?? 0).toBe(0);
    ok(await as.opm!.post(`${P}/orders/${mo.id}/review`, {}), 'review');
    await step('completionReview');
    ok(
      await as.opm!.post(`${P}/orders/${mo.id}/complete`, {
        outcome: 'COMPLETED',
        materialsReviewed: true,
      }),
      'complete',
    );
    await step('completedRecently');
    expect(await integrity()).toEqual([]);
  };

  const stockIn = async (itemId: string, quantity: string) => {
    const adj = ok(
      await as.wh!.post(`${W}/adjustments`, {
        reason: 'FOUND',
        lines: [{ direction: 'INCREASE', locationId: ids.MAIN, itemId, quantity }],
      }),
      'stock in',
    ).adjustment;
    ok(await as.wh!.post(`${W}/adjustments/${adj.id}/submit`), 'stock submit');
    ok(await as.owner!.post(`${W}/adjustments/${adj.id}/approve`), 'stock approve');
  };

  it('W3: BOM_REQUIRED — order → reservation → issue → consumption → output → finished goods → completion', async () => {
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
    const o0 = await nums(as.ops!, 'operations');
    const mo = ok(
      await as.ops!.post(`${P}/orders`, { itemId: ids.FG3, quantity: '3', requiredDate: plus(4) }),
      'MO',
    ).order;
    expect(delta(o0, await nums(as.ops!, 'operations'))).toEqual({ myDrafts: 1 });
    await manufacture(mo);
  });

  it('W4: BOM_OPTIONAL — an explicit material plan runs the same path with the same counts', async () => {
    ok(
      await as.owner!.patch(`${C}/current/settings`, { manufacturingMode: 'BOM_OPTIONAL' }),
      'mode',
    );
    expect((await dash(as.ops!, 'operations')).manufacturingMode).toBe('BOM_OPTIONAL');
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
    await manufacture(mo);
    ok(
      await as.owner!.patch(`${C}/current/settings`, { manufacturingMode: 'BOM_REQUIRED' }),
      'mode back',
    );
  });
});
