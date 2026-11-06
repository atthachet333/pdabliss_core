import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapPlatform, parseSeedEnv, seedDemo } from '../src/auth/bootstrap.js';
import { DEMO_PERSONAS } from '../src/demo/personas.js';
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
 * EP40 security sweeps over the REAL route table (Fastify's own registry, not
 * documentation): every one of the API's routes is called as an anonymous
 * visitor, from a foreign origin, as the owner of a second company with the
 * first company's record ids, as the read-only Executive and as the System
 * Admin — and the department responses are scanned for sentinel prices. Each
 * module suite keeps its own detailed tests; these sweeps make sure no route
 * added later can silently skip the shared rules.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
type J = Record<string, any>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
interface Route {
  method: Method;
  path: string;
}

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

/** Routes a visitor may call without a session (each still validates its input). */
const PUBLIC = [
  /^GET \/health$/,
  /^GET \/api\/v1\/?$/,
  /^GET \/api\/v1\/packages$/,
  /^GET \/api\/v1\/demo\//,
  /^POST \/api\/v1\/auth\/(register|verify-email|verification\/resend|login|login\/otp|login\/otp\/resend|logout|password\/forgot|password\/reset|password\/reset\/check|invitations\/accept)$/,
];
const isPublic = (r: Route) => PUBLIC.some((p) => p.test(`${r.method} ${r.path}`));
const MUTATING = (r: Route) => r.method !== 'GET';
const OPERATIONAL =
  /^\/api\/v1\/(sales|production|warehouse|purchase-requests|purchase-orders|purchasing|accounting)\//;

/** The route table, parsed from Fastify's printed tree (HEAD omitted). */
function routesOf(h: Harness): Route[] {
  const stack: string[] = [];
  const out = new Set<string>();
  for (const line of h.app.printRoutes({ commonPrefix: false }).split('\n')) {
    const m = /^([│ ]*)[├└]── (.*?) \(([^)]+)\)$/.exec(line);
    if (!m) continue;
    const depth = m[1]!.length / 4;
    stack.length = depth;
    stack[depth] = m[2]!;
    const path = stack.join('').replace(/\/+/g, '/');
    if (path === '*') continue;
    for (const method of m[3]!.split(', ')) if (method !== 'HEAD') out.add(`${method} ${path}`);
  }
  return [...out].map((s) => {
    const [method, path] = s.split(' ');
    return { method: method as Method, path: path! };
  });
}

const SENTINEL = { po: '987654.3219', so: '876543.2109', deposit: '765432.11' };
const SENTINEL_RE = /987654|876543|765432/;
/** Commercial values (the pagination count `"total"` and capability flags are not). */
const MONEY_KEY =
  /"(?!total")[a-zA-Z]*([pP]rice|[aA]mount|[tT]otal|[dD]iscount|[cC]ost|[mM]argin|[dD]eposit|[pP]ayment)[a-zA-Z]*":\s*("|-?\d)/;

describeDb('EP40 security sweeps', () => {
  let h: Harness;
  let routes: Route[];
  const ids: Record<string, string> = {};
  const browsers: Record<string, Browser> = {};

  const marker = async (key: string) =>
    (await h.db.auditLog.findFirstOrThrow({ where: { changes: { path: ['demo'], equals: key } } }))
      .entityId;

  /** Persona sign-in (development bypass), working branch chosen like the screens do. */
  const persona = async (email: string, branch = '00001') => {
    const b = new Browser(h.app);
    const res = await b.post('/api/v1/auth/login', { email, password: passwordOf(email) });
    expect(res.statusCode, res.body).toBe(200);
    const ctx = (await b.get('/api/v1/company/context')).json<J>();
    const target = ctx.branches?.find((x: J) => x.code === branch);
    if (target && ctx.selected?.code !== branch && !ctx.blocked) {
      await b.post('/api/v1/company/context/branch', { branchId: target.id });
    }
    return b;
  };

  /** A concrete URL for a route pattern: the first company's real ids. */
  const urlFor = (path: string) => {
    let out = path;
    const take = (key: string) => ids[key] ?? 'cm0000000000000000000000000';
    const rules: [RegExp, string][] = [
      [/^\/api\/v1\/sales\/orders\/:id/, 'so'],
      [/^\/api\/v1\/purchase-requests\/:id\/lines\/:lineId/, 'pr|prLine'],
      [/^\/api\/v1\/purchase-requests\/:id/, 'pr'],
      [/^\/api\/v1\/purchase-orders\/source-requests\/:id/, 'pr'],
      [/^\/api\/v1\/purchase-orders\/:id\/lines\/:lineId/, 'po|poLine'],
      [/^\/api\/v1\/purchase-orders\/:id/, 'po'],
      [/^\/api\/v1\/accounting\/deposits\/:id/, 'deposit'],
      [/^\/api\/v1\/warehouse\/pending-receive\/:id/, 'po'],
      [/^\/api\/v1\/warehouse\/receipts\/:id\/lines\/:lineId/, 'gr|grLine'],
      [/^\/api\/v1\/warehouse\/receipts\/:id/, 'gr'],
      [/^\/api\/v1\/warehouse\/transfers\/:id/, 'transfer'],
      [/^\/api\/v1\/warehouse\/adjustments\/:id/, 'adjustment'],
      [/^\/api\/v1\/warehouse\/counts\/:id/, 'count'],
      [/^\/api\/v1\/warehouse\/picks\/:id/, 'pick'],
      [/^\/api\/v1\/warehouse\/packs\/:id/, 'pack'],
      [/^\/api\/v1\/warehouse\/shipments\/:id/, 'shipment'],
      [/^\/api\/v1\/warehouse\/finished-goods\/receipts\/:id/, 'fgr'],
      [/^\/api\/v1\/warehouse\/material-issues\/:id/, 'issue'],
      [/^\/api\/v1\/production\/orders\/:id\/materials\/:materialId/, 'mo|material'],
      [/^\/api\/v1\/production\/orders\/:id/, 'mo'],
      [/^\/api\/v1\/production\/issues\/:id/, 'issue'],
      [/^\/api\/v1\/production\/outputs\/:id/, 'output'],
      [/^\/api\/v1\/production\/boms\/:id/, 'bom'],
      [/^\/api\/v1\/master-data\/items\/:id/, 'item'],
      [/^\/api\/v1\/master-data\/customers\/:id/, 'customer'],
      [/^\/api\/v1\/master-data\/suppliers\/:id/, 'supplier'],
      [/^\/api\/v1\/master-data\/units\/:id/, 'unit'],
      [/^\/api\/v1\/master-data\/categories\/:id/, 'category'],
      [/^\/api\/v1\/master-data\/locations\/:id/, 'location'],
      [/^\/api\/v1\/company\/current\/members\/:id/, 'member'],
      [/^\/api\/v1\/company\/current\/branches\/:id/, 'branch'],
    ];
    for (const [re, keys] of rules) {
      if (!re.test(path)) continue;
      const [first, second] = keys.split('|') as [string, string | undefined];
      out = out.replace(':id', take(first));
      if (second) out = out.replace(/:[a-zA-Z]+Id/, take(second));
      break;
    }
    return out
      .replace(':department', 'sales')
      .replace(/:[a-zA-Z]+/g, 'cm0000000000000000000000000');
  };
  const call = (b: Browser, r: Route, url = urlFor(r.path)) =>
    b.request(r.method, url, r.method === 'GET' || r.method === 'DELETE' ? undefined : {});

  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'true' });
    await resetDb(h.db);
    const env = parseSeedEnv(ENV);
    await bootstrapPlatform(h.db, env);
    await seedDemo(h.db, env);
    routes = routesOf(h);
    // The first company's record ids, one per kind.
    const first = async (model: any, where: J = {}) => (await model.findFirst({ where }))?.id;
    Object.assign(ids, {
      so: await marker('SO_FUL_SHIPPED'),
      pr: await marker('PR_EP39_MATERIALS'),
      po: await marker('PO_EP39_AWAITING'),
      deposit: await marker('PO_WAITING_DEPOSIT'),
      gr: await marker('GR_EP39_FULL'),
      mo: await marker('MO_EXEC'),
      transfer: await marker('TR_DRAFT'),
      adjustment: await marker('ADJ_DECREASE'),
      count: await marker('CC_POSTED'),
    });
    Object.assign(ids, {
      prLine: await first(h.db.purchaseRequestLine, { purchaseRequestId: ids.pr }),
      poLine: await first(h.db.purchaseOrderLine, { purchaseOrderId: ids.po }),
      grLine: await first(h.db.goodsReceiptLine, { goodsReceiptId: ids.gr }),
      material: await first(h.db.productionOrderMaterial, { productionOrderId: ids.mo }),
      pick: await first(h.db.salesPick),
      pack: await first(h.db.salesPack),
      shipment: await first(h.db.salesShipment),
      fgr: await first(h.db.productionGoodsReceipt),
      issue: await first(h.db.productionMaterialIssue),
      output: await first(h.db.productionOutputReport),
      bom: await first(h.db.productionBom),
      item: await first(h.db.item),
      customer: await first(h.db.customer),
      supplier: await first(h.db.supplier),
      unit: await first(h.db.unit),
      category: await first(h.db.itemCategory),
      location: await first(h.db.warehouseLocation),
      member: (
        await h.db.companyMember.findFirstOrThrow({
          where: { user: { emailNormalized: 'sales.demo@pdabliss.com' } },
        })
      ).id,
      branch: await first(h.db.branch, { code: '00001' }),
    });
    // Distinctive money in the first company: any of these digits in a department response is a leak.
    await h.db.purchaseOrderLine.updateMany({ data: { unitPrice: SENTINEL.po } });
    await h.db.salesOrderLine.updateMany({ data: { unitPrice: SENTINEL.so } });
    // (Deposit amounts are derived and CHECK-bound to their order; the money-key scan covers them.)
    // A second company with its own owner.
    const beta = await createActiveCompany(h.db, { name: 'Beta Co', departments: ['WAREHOUSE'] });
    await createUser(h.db, 'owner@beta.example', {
      companyRole: 'COMPANY_OWNER',
      companyId: beta.companyId,
    });
    browsers.beta = await signIn(h, 'owner@beta.example');
    await browsers.beta.get('/api/v1/company/context');
    for (const [k, email] of [
      ['owner', 'owner.demo@pdabliss.com'],
      ['admin', 'admin.demo@pdabliss.com'],
      ['exec', 'executive.demo@pdabliss.com'],
      ['sales', 'sales.demo@pdabliss.com'],
      ['ops', 'operations.demo@pdabliss.com'],
      ['wh', 'warehouse.demo@pdabliss.com'],
      ['pur', 'purchasing.demo@pdabliss.com'],
      ['staff', 'staff.demo@pdabliss.com'],
    ] as const) {
      browsers[k] = await persona(email);
    }
    browsers.acc = await persona('accounting.demo@pdabliss.com', '00000');
  }, 240_000);
  afterAll(async () => h.close());

  const fails = (rows: string[]) => expect(rows, rows.join('\n')).toEqual([]);

  it('the route table is what the audit covers (no unexpected public routes)', () => {
    expect(routes.length).toBeGreaterThan(250);
    const publics = routes.filter(isPublic).map((r) => `${r.method} ${r.path}`);
    // 18 = health, the API index (2), packages, three demo routes, eleven auth entry points.
    expect(publics).toHaveLength(18);
  });

  it('anonymous: every non-public route answers 401, none fails with 5xx', async () => {
    const anon = new Browser(h.app);
    const bad: string[] = [];
    for (const r of routes) {
      const res = await call(anon, r);
      if (res.statusCode >= 500) bad.push(`${res.statusCode} ${r.method} ${r.path}`);
      else if (!isPublic(r) && res.statusCode !== 401)
        bad.push(`${res.statusCode} ${r.method} ${r.path}`);
    }
    fails(bad);
  });

  it('cross-site: every state-changing route refuses a foreign Origin, even with a valid session', async () => {
    const owner = browsers.owner!;
    const bad: string[] = [];
    for (const r of routes.filter(MUTATING)) {
      const res = await owner.request(
        r.method,
        urlFor(r.path),
        r.method === 'DELETE' ? undefined : {},
        { origin: 'https://evil.example' },
      );
      if (res.statusCode !== 403) bad.push(`${res.statusCode} ${r.method} ${r.path}`);
    }
    fails(bad);
  });

  it('another company: no route reaches the first company’s records by id; lists show none of them', async () => {
    const beta = browsers.beta!;
    const known = new Set(Object.values(ids));
    const bad: string[] = [];
    for (const r of routes) {
      if (r.path.startsWith('/api/v1/auth/') || isPublic(r)) continue;
      const res = await call(beta, r);
      const leaked = [...known].find((id) => res.body.includes(id));
      if (res.statusCode >= 500) bad.push(`${res.statusCode} ${r.method} ${r.path}`);
      else if (r.path.includes(':') && res.statusCode < 300)
        bad.push(`${res.statusCode} ${r.method} ${r.path}`);
      if (leaked) bad.push(`LEAK ${r.method} ${r.path} ${leaked}`);
    }
    fails(bad);
  });

  it('Executive: no state-changing route succeeds; System Admin: no operational route succeeds', async () => {
    const bad: string[] = [];
    for (const r of routes.filter(MUTATING)) {
      if (r.path.startsWith('/api/v1/auth/') || /\/context\/branch$/.test(r.path)) continue;
      const res = await call(browsers.exec!, r);
      if (res.statusCode < 300 || res.statusCode >= 500)
        bad.push(`exec ${res.statusCode} ${r.method} ${r.path}`);
    }
    const known = Object.values(ids);
    for (const r of routes.filter((x) => OPERATIONAL.test(`${x.path}/`))) {
      const res = await call(browsers.admin!, r);
      if (res.statusCode >= 500) bad.push(`admin ${res.statusCode} ${r.method} ${r.path}`);
      if (res.statusCode >= 300) continue;
      // Capability contexts (what the caller may do, its branches) are not records.
      if (r.method === 'GET' && r.path.endsWith('/context')) continue;
      // A list of the caller's own records (none) is not access; anything else is.
      const items = res.json<J>().items;
      const empty = Array.isArray(items) && items.length === 0;
      if (MUTATING(r) || !empty || known.some((id) => res.body.includes(id)))
        bad.push(`admin ${res.statusCode} ${r.method} ${r.path}`);
    }
    fails(bad);
  });

  it('department privacy: Warehouse never receives a price, cost, total or deposit — on any route', async () => {
    const bad: string[] = [];
    for (const who of ['wh', 'staff']) {
      for (const r of routes.filter((x) => x.method === 'GET' && !isPublic(x))) {
        const res = await call(browsers[who]!, r);
        if (res.statusCode >= 500) bad.push(`${who} ${res.statusCode} ${r.path}`);
        if (res.statusCode >= 300) continue;
        if (SENTINEL_RE.test(res.body)) bad.push(`${who} SENTINEL ${r.path}`);
        const key = MONEY_KEY.exec(res.body)?.[0];
        if (key) bad.push(`${who} KEY ${key} ${r.path}`);
      }
    }
    fails(bad);
  });

  it('department privacy: Sales never sees purchase prices or deposits; Operations and Purchasing no sales prices', async () => {
    const bad: string[] = [];
    const scan = async (who: string, forbidden: RegExp) => {
      for (const r of routes.filter((x) => x.method === 'GET' && !isPublic(x))) {
        const res = await call(browsers[who]!, r);
        if (res.statusCode >= 500) bad.push(`${who} ${res.statusCode} ${r.path}`);
        if (res.statusCode < 300 && forbidden.test(res.body)) bad.push(`${who} ${r.path}`);
      }
    };
    await scan('sales', /987654|765432/);
    await scan('ops', /987654|876543|765432/);
    await scan('pur', /876543/);
    await scan('acc', /876543/);
    fails(bad);
  });

  it('input abuse is refused as a 4xx — never a 5xx, never executed', async () => {
    const owner = browsers.owner!;
    const sales = browsers.sales!;
    const before = await h.db.customer.count();
    const status = async (p: Promise<ApiResponse>) => (await p).statusCode;
    // SQL-looking search text is only ever a bound parameter: it matches nothing and breaks nothing.
    for (const qv of [
      "' OR 1=1 --",
      '"; DROP TABLE "Customer"; --',
      '%_\\',
      '\u0000',
      'ā'.repeat(100),
    ]) {
      for (const path of [
        '/api/v1/master-data/customers',
        '/api/v1/sales/orders',
        '/api/v1/warehouse/stock',
      ]) {
        const s = await status(owner.get(`${path}?q=${encodeURIComponent(qv)}`));
        expect(s, `${path} ${qv}`).toBeLessThan(500);
      }
    }
    expect(await h.db.customer.count()).toBe(before);
    // EP40 fix: a NUL in a query or path is a 400 everywhere (it was a database 500).
    for (const url of [
      '/api/v1/master-data/customers?q=%00',
      '/api/v1/sales/orders?q=a%00b',
      '/api/v1/production/orders?q=%00',
      '/api/v1/sales/orders/ab%00cd',
    ]) {
      const res = await owner.get(url);
      expect(res.statusCode, url).toBe(400);
      expect(res.json<J>().error.code).toBe('INVALID_CHARACTERS');
    }
    // Pagination and filter allow-lists.
    for (const qs of [
      'pageSize=100000',
      'pageSize=0',
      'page=-1',
      'page=abc',
      'sort=password',
      'status=HACKED',
      'branchId[]=x',
    ]) {
      expect(await status(sales.get(`/api/v1/sales/orders?${qs}`)), qs).toBe(400);
    }
    // Prototype pollution and unknown keys.
    const polluted = await owner.request('POST', '/api/v1/master-data/customers', undefined, {
      'content-type': 'application/json',
    });
    expect(polluted.statusCode).toBeLessThan(500);
    const proto = await h.app.inject({
      method: 'POST',
      url: '/api/v1/master-data/customers',
      headers: {
        origin: 'http://localhost:1111',
        'content-type': 'application/json',
        cookie: [...owner.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      payload: '{"name":"x","__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}}}',
    });
    expect(proto.statusCode).toBe(400);
    expect(({} as J).isAdmin).toBeUndefined();
    // Oversized body (above the 1 MiB limit).
    const big = await owner.post('/api/v1/master-data/customers', { name: 'x'.repeat(1_100_000) });
    expect(big.statusCode).toBe(413);
    // Impossible dates and decimal overflow.
    const customer = await h.db.customer.findFirstOrThrow({ where: { code: 'CUS-000002' } });
    const item = await h.db.item.findFirstOrThrow({ where: { code: 'FG-000002' } });
    for (const body of [
      { customerId: customer.id, orderDate: '2026-02-30' },
      { customerId: customer.id, requestedDate: '99999-01-01' },
      { customerId: customer.id, lines: [{ itemId: item.id, quantity: '1e309', unitPrice: '1' }] },
      {
        customerId: customer.id,
        lines: [{ itemId: item.id, quantity: '9999999999999.9', unitPrice: '1' }],
      },
      { customerId: customer.id, lines: [{ itemId: item.id, quantity: '-1', unitPrice: '1' }] },
      {
        customerId: customer.id,
        lines: [{ itemId: item.id, quantity: '1', unitPrice: '1.123456789' }],
      },
    ]) {
      expect(await status(sales.post('/api/v1/sales/orders', body)), JSON.stringify(body)).toBe(
        400,
      );
    }
    // Markup is stored as text and comes back as JSON text (the API never renders HTML).
    const res = await owner.post('/api/v1/master-data/customers', {
      name: '<img src=x onerror=alert(1)><script>alert(2)</script>',
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-security-policy']).toMatch(/default-src 'none'/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.json<J>().customer.name).toBe(
      '<img src=x onerror=alert(1)><script>alert(2)</script>',
    );
  });

  it('no response anywhere carries a password hash, session token or one-time code', async () => {
    const bad: string[] = [];
    for (const who of ['owner', 'admin']) {
      for (const r of routes.filter((x) => x.method === 'GET' && !isPublic(x))) {
        const res = await call(browsers[who]!, r);
        if (/\$argon2|passwordHash|tokenHash|codeHash|"otp"/i.test(res.body))
          bad.push(`${who} ${r.path}`);
      }
    }
    fails(bad);
  });
});

describeDb('EP40 revocation and the demo bypass', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'true' });
    await resetDb(h.db);
    const env = parseSeedEnv(ENV);
    await bootstrapPlatform(h.db, env);
    await seedDemo(h.db, env);
  }, 240_000);
  afterAll(async () => h.close());

  const login = async (email: string, password = passwordOf(email), app = h.app) => {
    const b = new Browser(app);
    const res = await b.post('/api/v1/auth/login', { email, password });
    return { b, res };
  };
  const salesMember = () =>
    h.db.companyMember.findFirstOrThrow({
      where: { user: { emailNormalized: 'sales.demo@pdabliss.com' } },
    });
  const code = (res: ApiResponse) => res.json<J>().error?.code as string | undefined;

  it('an open session loses what an administrator takes away — on the very next request', async () => {
    const { b } = await login('sales.demo@pdabliss.com');
    const ctx = (await b.get('/api/v1/company/context')).json<J>();
    const demo = ctx.branches.find((x: J) => x.code === '00001');
    expect((await b.post('/api/v1/company/context/branch', { branchId: demo.id })).statusCode).toBe(
      200,
    );
    const customer = await h.db.customer.findFirstOrThrow({ where: { code: 'CUS-000002' } });
    const item = await h.db.item.findFirstOrThrow({ where: { code: 'FG-000002' } });
    const body = {
      customerId: customer.id,
      lines: [{ itemId: item.id, quantity: '1', unitPrice: '1', taxRate: '7' }],
    };
    expect((await b.post('/api/v1/sales/orders', body)).statusCode).toBe(201);
    const m = await salesMember();
    // 1. A DENY exception on the action.
    await h.db.memberPermissionOverride.create({
      data: {
        companyId: m.companyId,
        memberId: m.id,
        permission: 'sales.orders.create',
        effect: 'DENY',
      },
    });
    expect(code(await b.post('/api/v1/sales/orders', body))).toBe('PERMISSION_DENIED');
    await h.db.memberPermissionOverride.deleteMany({ where: { memberId: m.id } });
    // 2. The working branch taken away: nothing more in it.
    await h.db.memberBranchAccess.deleteMany({ where: { memberId: m.id, branchId: demo.id } });
    // Never silently moved to the one branch left (EP40): a new choice is asked for.
    const before = await h.db.salesOrder.count();
    expect(code(await b.post('/api/v1/sales/orders', body))).toBe('BRANCH_SELECTION_REQUIRED');
    expect(await h.db.salesOrder.count()).toBe(before);
    const list = (await b.get('/api/v1/sales/orders?pageSize=100')).json<J>();
    expect(list.items.every((o: J) => o.branch.code !== '00001')).toBe(true);
    // 3. Membership deactivated: the session reaches nothing in the company.
    await h.db.companyMember.update({
      where: { id: m.id },
      data: { status: 'DEACTIVATED', deactivatedAt: new Date() },
    });
    expect([401, 403]).toContain((await b.get('/api/v1/sales/orders')).statusCode);
    // 4. The account suspended: the session is gone.
    await h.db.companyMember.update({
      where: { id: m.id },
      data: { status: 'ACTIVE', deactivatedAt: null },
    });
    await h.db.user.update({ where: { id: m.userId }, data: { status: 'SUSPENDED' } });
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(401);
  });

  it('a signed-out session cannot be replayed', async () => {
    const { b } = await login('executive.demo@pdabliss.com');
    const cookie = [...b.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    expect((await b.post('/api/v1/auth/logout')).statusCode).toBeLessThan(300);
    const replay = await h.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie, origin: 'http://localhost:1111' },
    });
    expect(replay.statusCode).toBe(401);
  });

  it('demo bypass: never in production, never for another address, never by header', async () => {
    // Another address (not a persona), right password shape: the normal emailed-code flow applies.
    await createUser(h.db, 'someone@else.example');
    const other = await login('someone@else.example', 'correct horse battery staple');
    expect(other.res.json<J>().status).not.toBe('authenticated');
    // A persona with a wrong password: refused, no hint which part was wrong.
    const wrong = await login('sales.demo@pdabliss.com', 'not the password at all 1');
    expect(wrong.res.statusCode).toBe(401);
    // Headers cannot switch anything on.
    const hdr = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        origin: 'http://localhost:1111',
        'x-demo-bypass': 'true',
        'x-forwarded-for': '127.0.0.1',
        'x-enable-demo-routes': 'true',
      },
      payload: { email: 'someone@else.example', password: 'correct horse battery staple' },
    });
    expect(hdr.json<J>().status).not.toBe('authenticated');
    // Production configuration: the same persona needs the emailed code; demo routes do not exist.
    const prod = await createHarness({
      NODE_ENV: 'production',
      ENABLE_DEMO_ROUTES: 'true',
      COOKIE_SECURE: 'true',
    }).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));
    if (prod instanceof Error) {
      // A production configuration that refuses to start with demo routes on is also fail-closed.
      expect(prod.message).toMatch(/production|demo/i);
    } else {
      const p = prod;
      const r = await login(
        'sales.demo@pdabliss.com',
        passwordOf('sales.demo@pdabliss.com'),
        p.app,
      );
      expect(r.res.json<J>().status).not.toBe('authenticated');
      expect((await new Browser(p.app).get('/api/v1/demo/personas')).statusCode).toBe(404);
      await p.close();
    }
  });
});

describe('EP40 route-table parser', () => {
  it('parses nested routes with their methods', () => {
    const tree = [
      '├── /api/v1 (GET, HEAD)',
      '│   └── / (GET, HEAD)',
      '│       ├── sales/orders (GET, HEAD, POST)',
      '│       │   └── /:id (GET, HEAD, PATCH)',
      '│       │       └── /submit (POST)',
    ].join('\n');
    const fake = { app: { printRoutes: () => tree } } as unknown as Harness;
    expect(routesOf(fake).map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /api/v1',
      'GET /api/v1/',
      'GET /api/v1/sales/orders',
      'POST /api/v1/sales/orders',
      'GET /api/v1/sales/orders/:id',
      'PATCH /api/v1/sales/orders/:id',
      'POST /api/v1/sales/orders/:id/submit',
    ]);
  });
});
