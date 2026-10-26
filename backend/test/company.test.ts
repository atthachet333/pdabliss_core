import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { DepartmentCode, PlanCode } from '../src/billing/catalog.js';
import {
  Browser,
  createHarness,
  createUser,
  describeDb,
  resetDb,
  signIn,
  type ApiResponse,
  type Harness,
} from './support.js';

/*
 * EP24 company & subscription foundation, against the isolated test database:
 * onboarding, atomic creation, the one-company rule, plan limits, cross-company
 * isolation, platform views and the development-only activation.
 */

type Json = Record<string, unknown> & {
  stage: string;
  selectedPlan: string | null;
  canEnterCore: boolean;
  company: Record<string, unknown> & { id: string; status: string; onboardingStatus: string };
  headOffice: { id: string; code: string; type: string; name: string };
  departments: string[];
  subscription: { id: string; plan: string; status: string; monthlyPriceThb: number | null };
  entitlements: Record<string, unknown>;
  access: { canEnterCore: boolean };
  error: { code: string; details?: Record<string, unknown> };
  companies: Record<string, unknown>[];
  branches: { id: string }[];
  branch: { id: string };
};
const json = (res: ApiResponse) => res.json<Json>();

const COMPANY = {
  legalName: 'บริษัท ตัวอย่าง จำกัด',
  displayName: 'ตัวอย่าง',
  taxId: '0105536000011',
  headOffice: {
    addressLine1: '1 ถนนตัวอย่าง',
    subdistrict: 'บางกระสอ',
    district: 'เมืองนนทบุรี',
    province: 'นนทบุรี',
    postalCode: '11000',
  },
  billingCycle: 'MONTHLY',
};
const body = (departments: DepartmentCode[], extra: Record<string, unknown> = {}) => ({
  ...COMPANY,
  departments,
  ...extra,
});

describeDb('company & subscription foundation (EP24)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
    vi.restoreAllMocks();
  });

  /** A verified customer without a company, signed in. */
  async function customer(email: string) {
    await createUser(h.db, email);
    return signIn(h, email);
  }
  const choose = (b: Browser, plan: PlanCode) => b.post('/api/v1/account/package', { plan });
  const create = (b: Browser, departments: DepartmentCode[], extra?: Record<string, unknown>) =>
    b.post('/api/v1/company/onboarding', body(departments, extra));
  /** A customer who owns a company on `plan`. */
  async function owner(email: string, plan: PlanCode, departments: DepartmentCode[]) {
    const b = await customer(email);
    expect((await choose(b, plan)).statusCode).toBe(200);
    const res = await create(b, departments);
    expect(res.statusCode, res.body).toBe(201);
    return { b, view: json(res) };
  }

  it('publishes the package catalog with the frozen public values', async () => {
    const res = await new Browser(h.app).get('/api/v1/packages');
    expect(res.statusCode).toBe(200);
    const { packages } = res.json<{
      packages: { code: string; monthlyPriceThb: number | null }[];
    }>();
    expect(packages.map((p) => [p.code, p.monthlyPriceThb])).toEqual([
      ['STARTER', 399],
      ['BUSINESS', 699],
      ['PROFESSIONAL', 999],
      ['ENTERPRISE', null],
    ]);
  });

  it('walks the onboarding stages: package → company → pending activation', async () => {
    const b = await customer('new.owner@example.com');
    expect(json(await b.get('/api/v1/account/onboarding'))).toMatchObject({
      stage: 'NEEDS_PACKAGE',
      company: null,
      canEnterCore: false,
    });
    expect(json(await choose(b, 'BUSINESS'))).toEqual({ selectedPlan: 'BUSINESS' });
    expect(json(await b.get('/api/v1/account/onboarding'))).toMatchObject({
      stage: 'NEEDS_COMPANY',
      selectedPlan: 'BUSINESS',
    });
    const created = await create(b, ['SALES', 'WAREHOUSE', 'EXECUTIVE']);
    expect(created.statusCode).toBe(201);
    expect(json(created)).toMatchObject({
      role: 'COMPANY_OWNER',
      company: {
        displayName: 'ตัวอย่าง',
        legalName: 'บริษัท ตัวอย่าง จำกัด',
        status: 'PENDING_SUBSCRIPTION',
        onboardingStatus: 'COMPLETED',
      },
      headOffice: { code: '00000', type: 'HEAD_OFFICE', name: 'สำนักงานใหญ่' },
      departments: ['SALES', 'WAREHOUSE', 'EXECUTIVE'],
      subscription: {
        plan: 'BUSINESS',
        status: 'PENDING',
        monthlyPriceThb: 699,
        activatedAt: null,
      },
      entitlements: {
        maxDepartments: 4,
        executiveAllowed: true,
        storage: { gb: 10 },
        api: 'ADD_ON',
      },
      access: { canEnterCore: false },
    });
    expect(json(await b.get('/api/v1/account/onboarding'))).toMatchObject({
      stage: 'PENDING_ACTIVATION',
      canEnterCore: false,
      company: { role: 'COMPANY_OWNER' },
    });
    // Nothing claims a payment.
    expect(created.body).not.toMatch(/paid|payment/i);
  });

  it('creates every record atomically and audits each step', async () => {
    const { view } = await owner('atomic@example.com', 'PROFESSIONAL', ['SALES', 'ACCOUNTING']);
    const companyId = view.company.id;
    const member = await h.db.companyMember.findFirstOrThrow({ where: { companyId } });
    expect(member).toMatchObject({ role: 'COMPANY_OWNER', ownerSlot: true });
    expect(await h.db.branch.count({ where: { companyId } })).toBe(1);
    const sub = await h.db.subscription.findFirstOrThrow({ where: { companyId } });
    expect(sub).toMatchObject({
      plan: 'PROFESSIONAL',
      status: 'PENDING',
      currentSlot: true,
      catalogVersion: 1,
    });
    expect(sub.entitlements).toMatchObject({ maxDepartments: 6, storageGb: 30, api: 'INCLUDED' });
    const actions = (await h.db.auditLog.findMany({ where: { companyId } }))
      .map((a) => a.action)
      .sort();
    expect(actions).toEqual(
      [
        'COMPANY_CREATED',
        'COMPANY_ONBOARDING_COMPLETED',
        'COMPANY_OWNER_ASSIGNED',
        'DEPARTMENTS_SELECTED',
        'HEAD_OFFICE_CREATED',
        'SUBSCRIPTION_CREATED',
      ].sort(),
    );
    const pkg = await h.db.auditLog.findFirstOrThrow({ where: { action: 'PACKAGE_SELECTED' } });
    expect(pkg.changes).toMatchObject({ actorScope: 'customer', plan: 'PROFESSIONAL' });
  });

  it('rolls everything back when a step fails', async () => {
    const b = await customer('rollback@example.com');
    await choose(b, 'STARTER');
    const original = h.db.$transaction.bind(h.db);
    vi.spyOn(h.db, '$transaction').mockImplementation(((fn: (tx: unknown) => Promise<unknown>) =>
      original((tx) =>
        fn(
          new Proxy(tx, {
            get: (t, p) =>
              p === 'branch'
                ? {
                    create: () => {
                      throw new Error('simulated Head Office failure');
                    },
                  }
                : (t as Record<string | symbol, unknown>)[p],
          }),
        ),
      )) as typeof h.db.$transaction);
    const res = await create(b, ['SALES']);
    expect(res.statusCode).toBe(500);
    vi.restoreAllMocks();
    expect(await h.db.company.count()).toBe(0);
    expect(await h.db.companyMember.count()).toBe(0);
    expect(await h.db.subscription.count()).toBe(0);
    expect(await h.db.auditLog.count({ where: { action: { not: 'PACKAGE_SELECTED' } } })).toBe(0);
    // And the customer can still complete onboarding afterwards.
    expect((await create(b, ['SALES'])).statusCode).toBe(201);
  });

  it('one company per account: a retry, a double submit and a second company are refused', async () => {
    const { b } = await owner('once@example.com', 'STARTER', ['SALES']);
    const again = await create(b, ['SALES']);
    expect(again.statusCode).toBe(409);
    expect(json(again).error.code).toBe('COMPANY_EXISTS');
    expect(json(await choose(b, 'BUSINESS')).error.code).toBe('COMPANY_EXISTS');

    // Two simultaneous submits from a fresh account: exactly one company.
    const c = await customer('double@example.com');
    await choose(c, 'STARTER');
    const results = await Promise.all([create(c, ['SALES']), create(c, ['SALES'])]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await h.db.company.count()).toBe(2);
  });

  it('requires a chosen package and never takes plan, price, status or owner from the client', async () => {
    const b = await customer('no.plan@example.com');
    expect(json(await create(b, ['SALES'])).error.code).toBe('PACKAGE_REQUIRED');
    await choose(b, 'STARTER');
    for (const extra of [
      { plan: 'PROFESSIONAL' },
      { price: 0 },
      { monthlyPriceThb: 1 },
      { isPaid: true },
      { subscriptionStatus: 'ACTIVE' },
      { status: 'ACTIVE' },
      { ownerUserId: 'someone-else' },
      { platformRole: 'PLATFORM_OWNER' },
      { companyId: 'another-company' },
    ]) {
      const res = await create(b, ['SALES'], extra);
      expect(res.statusCode, JSON.stringify(extra)).toBe(400);
    }
    expect(await h.db.company.count()).toBe(0);
    // Unknown plan names cannot be chosen either.
    for (const plan of ['FREE', 'business', 'CUSTOM']) {
      expect((await b.post('/api/v1/account/package', { plan })).statusCode).toBe(400);
    }
    expect(
      (await b.post('/api/v1/account/package', { plan: 'BUSINESS', price: 1 })).statusCode,
    ).toBe(400);
  });

  it('enforces package limits on the server', async () => {
    const cases: [PlanCode, DepartmentCode[], number][] = [
      ['STARTER', ['SALES', 'WAREHOUSE'], 201],
      ['STARTER', ['SALES', 'WAREHOUSE', 'PURCHASING'], 422],
      ['STARTER', ['EXECUTIVE'], 422],
      ['STARTER', [], 422],
      ['BUSINESS', ['SALES', 'WAREHOUSE', 'PURCHASING', 'EXECUTIVE'], 201],
      ['BUSINESS', ['SALES', 'WAREHOUSE', 'PURCHASING', 'EXECUTIVE', 'ACCOUNTING'], 422],
      [
        'PROFESSIONAL',
        ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
        201,
      ],
      ['PROFESSIONAL', ['SALES', 'SALES'], 422],
    ];
    let n = 0;
    for (const [plan, departments, status] of cases) {
      const b = await customer(`limits${n++}@example.com`);
      await choose(b, plan);
      const res = await create(b, departments);
      expect(res.statusCode, `${plan} ${departments.join(',')}`).toBe(status);
      if (status === 422) {
        expect(['DEPARTMENT_LIMIT', 'DEPARTMENTS_REQUIRED']).toContain(json(res).error.code);
      }
    }
  });

  it('Enterprise is a quotation: pending, no price, departments may wait for the agreed scope', async () => {
    const b = await customer('enterprise@example.com');
    await choose(b, 'ENTERPRISE');
    const res = await create(b, []);
    expect(res.statusCode).toBe(201);
    expect(json(res)).toMatchObject({
      company: { status: 'PENDING_SUBSCRIPTION', onboardingStatus: 'IN_PROGRESS' },
      subscription: { plan: 'ENTERPRISE', status: 'PENDING', monthlyPriceThb: null },
      entitlements: { maxDepartments: 'CUSTOM', storage: 'CUSTOM' },
      access: { canEnterCore: false },
    });
  });

  it('validates company fields: Thai tax ID checksum, postal code, required names (UTF-8)', async () => {
    const b = await customer('fields@example.com');
    await choose(b, 'STARTER');
    expect((await create(b, ['SALES'], { taxId: '0105536000012' })).statusCode).toBe(400);
    expect(
      (await create(b, ['SALES'], { headOffice: { ...COMPANY.headOffice, postalCode: '1100' } }))
        .statusCode,
    ).toBe(400);
    expect((await create(b, ['SALES'], { legalName: '   ' })).statusCode).toBe(400);
    // Dashes and spaces in the tax ID are fine; Chinese names too.
    const ok = await create(b, ['SALES'], { taxId: '0-1055-36000-01-1', displayName: '示例公司' });
    expect(ok.statusCode).toBe(201);
    expect(json(ok).company).toMatchObject({ taxId: '0105536000011', displayName: '示例公司' });
  });

  it('isolates companies: A never reads B, by any id', async () => {
    const a = await owner('a@example.com', 'BUSINESS', ['SALES']);
    const bOwner = await owner('b@example.com', 'PROFESSIONAL', ['WAREHOUSE', 'PURCHASING']);
    const bHeadOffice = bOwner.view.headOffice.id;
    const bSubscription = bOwner.view.subscription.id;

    expect(json(await a.b.get('/api/v1/company/current')).company.id).toBe(a.view.company.id);
    // Query strings cannot redirect "current".
    expect(
      json(await a.b.get(`/api/v1/company/current?companyId=${bOwner.view.company.id}`)).company.id,
    ).toBe(a.view.company.id);
    expect((await a.b.get(`/api/v1/company/current/branches/${bHeadOffice}`)).statusCode).toBe(404);
    expect(
      (await a.b.get(`/api/v1/company/current/subscriptions/${bSubscription}`)).statusCode,
    ).toBe(404);
    expect(json(await a.b.get('/api/v1/company/current/departments')).enabled).toEqual(['SALES']);
    const branches = json(await a.b.get('/api/v1/company/current/branches')).branches;
    expect(branches.map((x) => x.id)).toEqual([a.view.headOffice.id]);
    // B's own ids work for B.
    expect((await bOwner.b.get(`/api/v1/company/current/branches/${bHeadOffice}`)).statusCode).toBe(
      200,
    );
    // No customer reaches the global list or the platform company detail.
    expect((await a.b.get('/api/v1/platform/companies')).statusCode).toBe(403);
    expect((await a.b.get(`/api/v1/platform/companies/${bOwner.view.company.id}`)).statusCode).toBe(
      403,
    );
    // A member of A (not the owner) sees A only.
    await createUser(h.db, 'a.staff@example.com', {
      companyRole: 'DEPARTMENT_STAFF',
      companyId: a.view.company.id,
    });
    const staff = await signIn(h, 'a.staff@example.com');
    expect(json(await staff.get('/api/v1/company/current'))).toMatchObject({
      company: { id: a.view.company.id },
      role: 'DEPARTMENT_STAFF',
    });
    // An account without a company has no "current" company.
    const none = await customer('none@example.com');
    expect((await none.get('/api/v1/company/current')).statusCode).toBe(404);
  });

  it('platform operators cannot onboard a customer company for themselves', async () => {
    await createUser(h.db, 'operator@pdabliss.test', { platformRole: 'PLATFORM_ADMIN' });
    const op = await signIn(h, 'operator@pdabliss.test');
    expect((await op.post('/api/v1/account/package', { plan: 'BUSINESS' })).statusCode).toBe(403);
    expect((await create(op, ['SALES'])).statusCode).toBe(403);
    expect(json(await op.get('/api/v1/account/onboarding')).stage).toBe('PLATFORM_OPERATOR');
    expect(await h.db.company.count()).toBe(0);
  });

  it('platform owner and admin see the canonical company list and detail', async () => {
    const a = await owner('listed@example.com', 'BUSINESS', ['SALES', 'EXECUTIVE']);
    await createUser(h.db, 'owner@pdabliss.test', { platformRole: 'PLATFORM_OWNER' });
    await createUser(h.db, 'admin@pdabliss.test', { platformRole: 'PLATFORM_ADMIN' });
    for (const email of ['owner@pdabliss.test', 'admin@pdabliss.test']) {
      const op = await signIn(h, email);
      const list = json(await op.get('/api/v1/platform/companies')).companies;
      expect(list).toEqual([
        expect.objectContaining({
          id: a.view.company.id,
          owner: 'listed@example.com',
          plan: 'BUSINESS',
          subscriptionStatus: 'PENDING',
          status: 'PENDING_SUBSCRIPTION',
          onboardingStatus: 'COMPLETED',
          branches: 1,
          departments: 2,
        }),
      ]);
      const detail = json(await op.get(`/api/v1/platform/companies/${a.view.company.id}`));
      expect(detail).toMatchObject({
        departments: ['SALES', 'EXECUTIVE'],
        members: [{ email: 'listed@example.com', role: 'COMPANY_OWNER' }],
        access: { canEnterCore: false },
        developmentActivation: true,
      });
      expect(JSON.stringify(detail)).not.toMatch(/passwordHash|tokenHash/);
    }
  });

  it('customers cannot activate; a platform operator can, in development only, with an audit trail', async () => {
    const a = await owner('activate@example.com', 'STARTER', ['SALES']);
    const id = a.view.company.id;
    // No customer path exists to activate or change the subscription.
    expect((await a.b.post('/api/v1/company/current/subscription/activate')).statusCode).toBe(404);
    expect(
      (await a.b.post(`/api/v1/platform/companies/${id}/development-activation`)).statusCode,
    ).toBe(403);
    await createUser(h.db, 'admin@pdabliss.test', { platformRole: 'PLATFORM_ADMIN' });
    const op = await signIn(h, 'admin@pdabliss.test');
    const res = await op.post(`/api/v1/platform/companies/${id}/development-activation`);
    expect(res.statusCode, res.body).toBe(200);
    expect(json(await a.b.get('/api/v1/account/onboarding'))).toMatchObject({
      stage: 'ACTIVE',
      canEnterCore: true,
    });
    const current = json(await a.b.get('/api/v1/company/current'));
    expect(current.subscription).toMatchObject({ status: 'ACTIVE' });
    expect(current.company).toMatchObject({ status: 'ACTIVE' });
    const audit = await h.db.auditLog.findFirstOrThrow({
      where: { companyId: id, action: 'SUBSCRIPTION_STATUS_CHANGED' },
    });
    expect(audit.changes).toMatchObject({
      actorScope: 'platform_admin',
      from: 'PENDING',
      to: 'ACTIVE',
      mode: 'development_manual',
      paid: false,
    });
    // Not twice.
    const again = await op.post(`/api/v1/platform/companies/${id}/development-activation`);
    expect(json(again).error.code).toBe('INVALID_TRANSITION');
  });

  it('an Enterprise company without agreed departments cannot be activated yet', async () => {
    const b = await customer('ent.pending@example.com');
    await choose(b, 'ENTERPRISE');
    const companyId = json(await create(b, [])).company.id;
    await createUser(h.db, 'owner@pdabliss.test', { platformRole: 'PLATFORM_OWNER' });
    const op = await signIn(h, 'owner@pdabliss.test');
    const res = await op.post(`/api/v1/platform/companies/${companyId}/development-activation`);
    expect(json(res).error.code).toBe('ONBOARDING_INCOMPLETE');
  });

  it('the database itself refuses a second owner, Head Office or current subscription', async () => {
    const a = await owner('invariants@example.com', 'PROFESSIONAL', ['SALES']);
    const companyId = a.view.company.id;
    const other = await createUser(h.db, 'second.owner@example.com');
    await expect(
      h.db.companyMember.create({
        data: { companyId, userId: other.id, role: 'COMPANY_OWNER', ownerSlot: true },
      }),
    ).rejects.toThrow();
    // An owner role without the slot is refused by the CHECK constraint.
    await expect(
      h.db.companyMember.create({ data: { companyId, userId: other.id, role: 'COMPANY_OWNER' } }),
    ).rejects.toThrow();
    const address = { addressLine1: 'x', province: 'x', postalCode: '10000' };
    await expect(
      h.db.branch.create({
        data: {
          companyId,
          code: '00000',
          name: 'HQ 2',
          type: 'HEAD_OFFICE',
          headOfficeSlot: true,
          ...address,
        },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.branch.create({
        data: { companyId, code: '00001', name: 'HQ?', type: 'HEAD_OFFICE', ...address },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.branch.create({
        data: { companyId, code: '00000', name: 'B', type: 'BRANCH', ...address },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.branch.create({
        data: { companyId, code: 'B-1', name: 'B', type: 'BRANCH', ...address },
      }),
    ).rejects.toThrow();
    // A normal branch is fine (codes are unique per company).
    await h.db.branch.create({
      data: { companyId, code: '00001', name: 'สาขา 1', type: 'BRANCH', ...address },
    });
    await expect(
      h.db.subscription.create({
        data: {
          companyId,
          plan: 'STARTER',
          catalogVersion: 1,
          entitlements: {},
          currentSlot: true,
        },
      }),
    ).rejects.toThrow();
    expect(await h.db.branch.count({ where: { companyId, type: 'HEAD_OFFICE' } })).toBe(1);
  });
});

describeDb('production has no development activation (EP24)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({
      NODE_ENV: 'production',
      PUBLIC_APP_URL: 'https://core.example.com',
      AUTH_SECRET: 'p'.repeat(48),
      SMTP_HOST: 'smtp.example.com',
      DATABASE_URL: process.env.TEST_DATABASE_URL!,
      LOG_LEVEL: 'silent',
    });
  });
  afterAll(async () => h.close());

  it('does not register the route at all', async () => {
    await resetDb(h.db);
    await createUser(h.db, 'owner@pdabliss.test', { platformRole: 'PLATFORM_OWNER' });
    const op = await signIn(h, 'owner@pdabliss.test');
    const res = await op.post('/api/v1/platform/companies/anything/development-activation');
    expect(res.statusCode).toBe(404);
    expect(json(res).error.code).toBe('ROUTE_NOT_FOUND');
  });
});
