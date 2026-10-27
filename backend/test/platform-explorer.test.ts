import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { snapshotFor } from '../src/company/entitlements.js';
import type { DepartmentCode, PlanCode } from '../src/billing/catalog.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import {
  type Browser,
  createHarness,
  createUser,
  describeDb,
  resetDb,
  signIn,
  type Harness,
} from './support.js';

/*
 * EP24.1 Platform Company Explorer and Platform Inspection: paging, search,
 * filters, the read-only inspection (audited, never impersonation), the
 * overview counts, and who may call any of it.
 */

/** The response shapes these tests read (only the fields they assert on). */
interface Row {
  id: string;
  name: string;
  isDemo: boolean;
  [field: string]: unknown;
}
interface Page {
  companies: Row[];
  total: number;
  nextCursor: string | null;
}
interface Detail {
  company: Record<string, unknown>;
  owner: unknown;
  branches: unknown[];
  departmentStates: { code: string; state: string }[];
  entitlements: unknown;
  subscriptions: unknown[];
  members: (Record<string, unknown> & { lastLoginAt: string | null })[];
  activity: { action: string }[];
  security: { type: string }[];
}
interface Overview {
  companies: unknown;
  subscriptions: unknown;
  attention: unknown;
  customerAccounts: { total: number };
}
const json = <T>(res: { json(): unknown }) => res.json() as T;

describeDb('Platform Company Explorer (EP24.1)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
  });

  /** A company written directly (fast, deterministic createdAt). */
  async function company(
    i: number,
    opts: {
      name?: string;
      plan?: PlanCode;
      departments?: DepartmentCode[];
      status?: 'PENDING_SUBSCRIPTION' | 'ACTIVE' | 'SUSPENDED';
      onboarding?: 'IN_PROGRESS' | 'COMPLETED';
      subscription?: 'PENDING' | 'ACTIVE';
      owner?: { email: string; fullName?: string };
      isDemo?: boolean;
    } = {},
  ) {
    const plan = opts.plan ?? 'BUSINESS';
    const snap = snapshotFor(plan);
    const c = await h.db.company.create({
      data: {
        name: opts.name ?? `Company ${String(i).padStart(2, '0')}`,
        legalName: `Legal ${i} Co., Ltd.`,
        status: opts.status ?? 'PENDING_SUBSCRIPTION',
        onboardingStatus: opts.onboarding ?? 'COMPLETED',
        isDemo: opts.isDemo ?? false,
        createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)),
        branches: {
          create: {
            code: '00000',
            name: 'HQ',
            type: 'HEAD_OFFICE',
            headOfficeSlot: true,
            addressLine1: '1 Road',
            province: 'Bangkok',
            postalCode: '10110',
          },
        },
        departments: {
          create: (opts.departments ?? ['SALES']).map((code) => ({ code, name: code })),
        },
        subscriptions: {
          create: {
            plan,
            status: opts.subscription ?? 'PENDING',
            catalogVersion: snap.catalogVersion,
            monthlyPriceThb: snap.monthlyPriceThb,
            entitlements: { ...snap },
            currentSlot: true,
          },
        },
      },
    });
    if (opts.owner) {
      const user = await createUser(h.db, opts.owner.email, {
        companyRole: 'COMPANY_OWNER',
        companyId: c.id,
      });
      if (opts.owner.fullName) {
        await h.db.user.update({ where: { id: user.id }, data: { fullName: opts.owner.fullName } });
      }
    }
    return c;
  }

  async function operator(role: 'PLATFORM_OWNER' | 'PLATFORM_ADMIN') {
    const email = role === 'PLATFORM_OWNER' ? 'owner@pdabliss.test' : 'admin@pdabliss.test';
    await createUser(h.db, email, { platformRole: role });
    return signIn(h, email);
  }

  const list = (op: Browser, query = '') => op.get(`/api/v1/platform/companies${query}`);

  it('pages newest first with a cursor: no duplicates, no gaps, a total', async () => {
    for (let i = 1; i <= 30; i++) await company(i);
    const op = await operator('PLATFORM_OWNER');
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res = await list(op, `?limit=10${cursor ? `&cursor=${cursor}` : ''}`);
      expect(res.statusCode, res.body).toBe(200);
      const body = json<Page>(res);
      expect(body.total).toBe(30);
      expect(body.companies.length).toBeLessThanOrEqual(10);
      seen.push(...body.companies.map((c) => c.name));
      cursor = body.nextCursor;
      pages++;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(30);
    expect(seen[0]).toBe('Company 30');
    expect(seen.at(-1)).toBe('Company 01');
    // Default page size, and bounded limits / strict parameters.
    expect(json<Page>(await list(op)).companies).toHaveLength(25);
    expect((await list(op, '?limit=500')).statusCode).toBe(400);
    expect((await list(op, '?sort=name')).statusCode).toBe(400);
  });

  it('searches company names, legal names, owner email and owner name (case-insensitive)', async () => {
    await company(1, { name: 'Siam Fresh Foods', owner: { email: 'nok@siamfresh.co.th' } });
    await company(2, {
      name: 'Delta Parts',
      owner: { email: 'k.delta@example.com', fullName: 'กมล ศรีสุข' },
    });
    await company(3, { name: 'Other' });
    const op = await operator('PLATFORM_ADMIN');
    const names = async (q: string) =>
      json<Page>(await list(op, `?q=${encodeURIComponent(q)}`)).companies.map((c) => c.name);
    expect(await names('siam fresh')).toEqual(['Siam Fresh Foods']);
    expect(await names('SIAMFRESH.CO')).toEqual(['Siam Fresh Foods']);
    expect(await names('legal 2')).toEqual(['Delta Parts']);
    expect(await names('ศรีสุข')).toEqual(['Delta Parts']);
    const none = json<Page>(await list(op, '?q=nothing-matches'));
    expect(none).toMatchObject({ companies: [], total: 0, nextCursor: null });
  });

  it('filters by package, subscription, company status, onboarding and department', async () => {
    await company(1, { plan: 'STARTER', departments: ['SALES', 'WAREHOUSE'] });
    await company(2, {
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      subscription: 'ACTIVE',
      departments: ['SALES', 'EXECUTIVE', 'ACCOUNTING'],
    });
    await company(3, { plan: 'ENTERPRISE', onboarding: 'IN_PROGRESS', departments: [] });
    await company(4, { plan: 'BUSINESS', status: 'SUSPENDED', departments: ['WAREHOUSE'] });
    const op = await operator('PLATFORM_OWNER');
    const ids = async (query: string) =>
      json<Page>(await list(op, query))
        .companies.map((c) => c.name)
        .sort();
    expect(await ids('?plan=STARTER')).toEqual(['Company 01']);
    expect(await ids('?subscriptionStatus=ACTIVE')).toEqual(['Company 02']);
    expect(await ids('?status=SUSPENDED')).toEqual(['Company 04']);
    expect(await ids('?onboardingStatus=IN_PROGRESS')).toEqual(['Company 03']);
    expect(await ids('?department=WAREHOUSE')).toEqual(['Company 01', 'Company 04']);
    expect(await ids('?department=WAREHOUSE&plan=BUSINESS')).toEqual(['Company 04']);
    // Empty values are "no filter"; unknown values are refused.
    expect(await ids('?plan=&status=')).toHaveLength(4);
    expect((await list(op, '?plan=FREE')).statusCode).toBe(400);
    // Row facts the explorer shows.
    const row = json<Page>(await list(op, '?plan=PROFESSIONAL')).companies[0];
    expect(row).toMatchObject({
      plan: 'PROFESSIONAL',
      subscriptionStatus: 'ACTIVE',
      status: 'ACTIVE',
      enabledDepartments: ['SALES', 'ACCOUNTING', 'EXECUTIVE'],
      departments: 3,
      maxDepartments: 6,
      branches: 1,
    });
  });

  it('the demo company is listed and marked; the overview counts customers apart from demo', async () => {
    await company(1, { name: 'PDA BLISS CORE DEMO COMPANY', isDemo: true, status: 'ACTIVE' });
    await company(2, { status: 'ACTIVE', subscription: 'ACTIVE' });
    await company(3);
    await company(4, { onboarding: 'IN_PROGRESS', departments: [] });
    await createUser(h.db, 'no.company.yet@example.com');
    await createUser(h.db, 'unverified@example.com', { verified: false });
    const op = await operator('PLATFORM_OWNER');
    const demo = json<Page>(await list(op, '?q=demo')).companies[0];
    expect(demo).toMatchObject({ isDemo: true });
    const o = json<Overview>(await op.get('/api/v1/platform/overview'));
    expect(o.companies).toMatchObject({
      customer: 3,
      demo: 1,
      byStatus: { ACTIVE: 1, PENDING_SUBSCRIPTION: 2, SUSPENDED: 0 },
      onboarding: { IN_PROGRESS: 1, COMPLETED: 2 },
    });
    expect(o.subscriptions).toMatchObject({ ACTIVE: 1, PENDING: 2 });
    expect(o.attention).toMatchObject({
      readyToActivate: 1,
      onboardingIncomplete: 1,
      awaitingCompany: 1,
      unverifiedAccounts: 1,
      suspendedCompanies: 0,
    });
    // Platform operators are not customer accounts.
    expect(o.customerAccounts.total).toBe(2);
    expect(JSON.stringify(o)).not.toMatch(/revenue|mrr|arr/i);
  });

  it('Platform Inspection: real company facts, department states, members, activity — no secrets', async () => {
    // A real onboarding through the API, so the audit trail is the genuine one.
    await createUser(h.db, 'starter.owner@example.com');
    await h.db.user.update({
      where: { emailNormalized: 'starter.owner@example.com' },
      data: { fullName: 'สมชาย เจ้าของ', phone: '+66812345678', jobFunction: 'OWNER' },
    });
    const customer = await signIn(h, 'starter.owner@example.com');
    await customer.post('/api/v1/account/package', { plan: 'STARTER' });
    const created = await customer.post('/api/v1/company/onboarding', {
      legalName: 'บริษัท ตรวจสอบ จำกัด',
      displayName: 'Inspect Co',
      headOffice: { addressLine1: '1 ถนน', province: 'นนทบุรี', postalCode: '11000' },
      departments: ['SALES', 'WAREHOUSE'],
    });
    expect(created.statusCode, created.body).toBe(201);
    const id = json<{ company: { id: string } }>(created).company.id;

    const op = await operator('PLATFORM_ADMIN');
    const res = await op.get(`/api/v1/platform/companies/${id}`);
    expect(res.statusCode, res.body).toBe(200);
    const d = json<Detail>(res);
    expect(d.company).toMatchObject({ displayName: 'Inspect Co', status: 'PENDING_SUBSCRIPTION' });
    expect(d.owner).toEqual({
      email: 'starter.owner@example.com',
      fullName: 'สมชาย เจ้าของ',
      phone: '+66812345678',
      signup: null,
    });
    expect(d.branches).toEqual([expect.objectContaining({ code: '00000', type: 'HEAD_OFFICE' })]);
    expect(Object.fromEntries(d.departmentStates.map((s) => [s.code, s.state]))).toEqual({
      SALES: 'ENABLED',
      OPERATIONS: 'NOT_ENABLED',
      WAREHOUSE: 'ENABLED',
      PURCHASING: 'NOT_ENABLED',
      ACCOUNTING: 'NOT_ENABLED',
      EXECUTIVE: 'NOT_IN_PACKAGE',
    });
    expect(d.entitlements).toMatchObject({ plan: 'STARTER', maxDepartments: 2, api: 'NONE' });
    expect(d.subscriptions).toEqual([expect.objectContaining({ status: 'PENDING' })]);
    expect(d.members).toEqual([
      expect.objectContaining({
        email: 'starter.owner@example.com',
        fullName: 'สมชาย เจ้าของ',
        jobFunction: 'OWNER',
        role: 'COMPANY_OWNER',
        status: 'ACTIVE',
      }),
    ]);
    expect(d.members[0]?.lastLoginAt).not.toBeNull();
    const actions = d.activity.map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'COMPANY_CREATED',
        'HEAD_OFFICE_CREATED',
        'SUBSCRIPTION_CREATED',
        'PLATFORM_COMPANY_INSPECTED',
      ]),
    );
    expect(d.security.map((e) => e.type)).toContain('LOGIN_SUCCESS');
    expect(JSON.stringify(d)).not.toMatch(/passwordHash|tokenHash|codeHash|subjectHash|ipAddress/);
  });

  it('an inspection is audited once per operator and window, and is never impersonation', async () => {
    const c = await company(1);
    const owner = await operator('PLATFORM_OWNER');
    for (let i = 0; i < 3; i++) {
      expect((await owner.get(`/api/v1/platform/companies/${c.id}`)).statusCode).toBe(200);
    }
    const events = await h.db.auditLog.findMany({
      where: { companyId: c.id, action: 'PLATFORM_COMPANY_INSPECTED' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.changes).toMatchObject({ actorScope: 'platform_owner', mode: 'read_only' });
    // The operator is still a platform operator with no company context.
    expect(json<{ stage: string }>(await owner.get('/api/v1/account/onboarding')).stage).toBe(
      'PLATFORM_OPERATOR',
    );
    expect((await owner.get('/api/v1/company/current')).statusCode).toBe(404);
    expect(await h.db.companyMember.count({ where: { companyId: c.id } })).toBe(0);
    // Unknown company: 404, nothing audited.
    expect((await owner.get('/api/v1/platform/companies/c_missing')).statusCode).toBe(404);
  });

  it('customer roles never reach any platform route — even with a company id', async () => {
    const c = await company(1);
    const roles: CompanyRole[] = ['COMPANY_OWNER', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPARTMENT_STAFF'];
    for (const role of roles) {
      const email = `${role.toLowerCase()}@example.com`;
      await createUser(h.db, email, {
        companyRole: role === 'COMPANY_OWNER' ? undefined : role,
        companyId: role === 'COMPANY_OWNER' ? undefined : c.id,
      });
      if (role === 'COMPANY_OWNER') {
        const own = await company(2, { name: 'Own' });
        const user = await h.db.user.findUniqueOrThrow({ where: { emailNormalized: email } });
        await h.db.companyMember.create({
          data: { companyId: own.id, userId: user.id, role, ownerSlot: true },
        });
      }
      const b = await signIn(h, email);
      for (const path of [
        '/api/v1/platform/overview',
        '/api/v1/platform/companies',
        `/api/v1/platform/companies/${c.id}`,
        '/api/v1/platform/users',
        '/api/v1/platform/audit',
        '/api/v1/platform/operators',
      ]) {
        expect((await b.get(path)).statusCode, `${role} ${path}`).toBe(403);
      }
    }
    expect(await h.db.auditLog.count({ where: { action: 'PLATFORM_COMPANY_INSPECTED' } })).toBe(0);
  });

  it('Platform Admin inspects but has no owner authority', async () => {
    const c = await company(1);
    const admin = await operator('PLATFORM_ADMIN');
    await createUser(h.db, 'owner@pdabliss.test', { platformRole: 'PLATFORM_OWNER' });
    const ownerId = (
      await h.db.user.findUniqueOrThrow({ where: { emailNormalized: 'owner@pdabliss.test' } })
    ).id;
    expect((await list(admin)).statusCode).toBe(200);
    expect((await admin.get(`/api/v1/platform/companies/${c.id}`)).statusCode).toBe(200);
    expect((await admin.get('/api/v1/platform/operators')).statusCode).toBe(403);
    expect(
      (await admin.post('/api/v1/platform/operators', { email: 'x@example.com' })).statusCode,
    ).toBe(403);
    expect((await admin.delete(`/api/v1/platform/operators/${ownerId}`)).statusCode).toBe(403);
    const suspend = await admin.post(`/api/v1/platform/users/${ownerId}/suspend`);
    expect(suspend.statusCode).toBe(403);
    expect(await h.db.user.count({ where: { id: ownerId, status: 'ACTIVE' } })).toBe(1);
  });
});
