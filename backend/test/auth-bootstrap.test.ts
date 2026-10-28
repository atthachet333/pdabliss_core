import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  bootstrapPlatform,
  DEMO_COMPANY_NAME,
  parseSeedEnv,
  seedDemo,
} from '../src/auth/bootstrap.js';
import { verifyPassword } from '../src/auth/password.js';
import { createHarness, describeDb, resetDb, signIn, type Harness } from './support.js';

/* Privileged bootstrap and demo seed (EP23). All addresses and passwords are test fixtures. */

const OWNER = 'the.owner@pdabliss.test';
const BASE = {
  NODE_ENV: 'development',
  PLATFORM_OWNER_EMAIL: OWNER,
  PLATFORM_OWNER_INITIAL_PASSWORD: 'owner fixture passphrase 1',
  PLATFORM_ADMIN_EMAIL: 'platform.admin@pdabliss.com',
  PLATFORM_ADMIN_INITIAL_PASSWORD: 'admin fixture passphrase 1',
};
const DEMO = {
  DEMO_COMPANY_OWNER_PASSWORD: 'demo owner passphrase 1',
  DEMO_SYSTEM_ADMIN_PASSWORD: 'demo admin passphrase 1',
  DEMO_EXECUTIVE_PASSWORD: 'demo executive passphrase 1',
  DEMO_STAFF_PASSWORD: 'demo staff passphrase 1',
};

describeDb('privileged bootstrap (EP23)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
  });

  const run = (env: Record<string, string>) => bootstrapPlatform(h.db, parseSeedEnv(env));

  it('creates the owner from PLATFORM_OWNER_EMAIL and the admin from PLATFORM_ADMIN_EMAIL', async () => {
    expect(await run(BASE)).toEqual({ owner: 'created', admin: 'created' });
    const roles = await h.db.platformRoleAssignment.findMany({ include: { user: true } });
    expect(
      roles.map((r) => [r.user.emailNormalized, r.role, r.user.status, !!r.user.emailVerifiedAt]),
    ).toEqual(
      expect.arrayContaining([
        [OWNER, 'PLATFORM_OWNER', 'ACTIVE', true],
        ['platform.admin@pdabliss.com', 'PLATFORM_ADMIN', 'ACTIVE', true],
      ]),
    );
    // The bootstrapped owner can sign in (with the emailed code) and sees the owner role.
    const b = await signIn(h, OWNER, { password: BASE.PLATFORM_OWNER_INITIAL_PASSWORD });
    expect((await b.get('/api/v1/auth/me')).json().identity.platformRole).toBe('PLATFORM_OWNER');
  });

  it('is idempotent: no duplicates and no password change on a normal re-run', async () => {
    await run(BASE);
    const changed = { ...BASE, PLATFORM_OWNER_INITIAL_PASSWORD: 'a different passphrase 2' };
    expect(await run(changed)).toEqual({ owner: 'unchanged', admin: 'unchanged' });
    expect(await h.db.user.count()).toBe(2);
    expect(await h.db.platformRoleAssignment.count()).toBe(2);
    const cred = await h.db.userCredential.findFirstOrThrow({
      where: { user: { emailNormalized: OWNER } },
    });
    expect(await verifyPassword(cred.passwordHash, BASE.PLATFORM_OWNER_INITIAL_PASSWORD)).toBe(
      true,
    );
  });

  it('changes a password only with BOOTSTRAP_RESET_PASSWORDS=true', async () => {
    await run(BASE);
    await run({
      ...BASE,
      PLATFORM_OWNER_INITIAL_PASSWORD: 'a different passphrase 2',
      BOOTSTRAP_RESET_PASSWORDS: 'true',
    });
    const cred = await h.db.userCredential.findFirstOrThrow({
      where: { user: { emailNormalized: OWNER } },
    });
    expect(await verifyPassword(cred.passwordHash, 'a different passphrase 2')).toBe(true);
  });

  it.each([
    [{ PLATFORM_OWNER_EMAIL: '' }, /PLATFORM_OWNER_EMAIL is not set/],
    [{ PLATFORM_OWNER_INITIAL_PASSWORD: '' }, /PLATFORM_OWNER_INITIAL_PASSWORD is not set/],
    [{ PLATFORM_OWNER_EMAIL: 'owner@example.com' }, /placeholder/],
    [{ PLATFORM_OWNER_INITIAL_PASSWORD: 'change-me' }, /placeholder/],
    [{ PLATFORM_OWNER_INITIAL_PASSWORD: 'short' }, /password policy/],
    [{ PLATFORM_ADMIN_INITIAL_PASSWORD: '' }, /PLATFORM_ADMIN_INITIAL_PASSWORD is not set/],
    [{ PLATFORM_ADMIN_EMAIL: OWNER }, /must differ/],
  ])('fails safely and creates nothing when %j', async (patch, message) => {
    await expect(run({ ...BASE, ...patch })).rejects.toThrow(message);
    expect(await h.db.platformRoleAssignment.count()).toBe(0);
  });

  it('never silently transfers ownership to another email', async () => {
    await run(BASE);
    await expect(
      run({ ...BASE, PLATFORM_OWNER_EMAIL: 'someone.else@pdabliss.test' }),
    ).rejects.toThrow(/different Platform Owner/);
    expect(await h.db.platformRoleAssignment.count({ where: { role: 'PLATFORM_OWNER' } })).toBe(1);
  });

  it('error messages never contain a password', async () => {
    const error = await run({ ...BASE, PLATFORM_OWNER_INITIAL_PASSWORD: 'tiny' }).catch(
      (e: Error) => e,
    );
    expect((error as Error).message).not.toContain('tiny');
  });

  it('runs without an admin when PLATFORM_ADMIN_EMAIL is empty', async () => {
    expect(
      await run({ ...BASE, PLATFORM_ADMIN_EMAIL: '', PLATFORM_ADMIN_INITIAL_PASSWORD: '' }),
    ).toEqual({
      owner: 'created',
      admin: 'skipped',
    });
  });
});

describeDb('demo seed (EP23)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => resetDb(h.db));

  it('creates the labelled demo company, six departments and four customer identities', async () => {
    const env = parseSeedEnv({ ...BASE, ...DEMO });
    await bootstrapPlatform(h.db, env);
    await seedDemo(h.db, env);
    await seedDemo(h.db, env); // idempotent
    const company = await h.db.company.findFirstOrThrow({
      include: { departments: true, members: { include: { user: true } } },
    });
    expect(company).toMatchObject({
      name: DEMO_COMPANY_NAME,
      isDemo: true,
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    });
    // EP24 canonical department codes.
    expect(company.departments.map((d) => d.code).sort()).toEqual([
      'ACCOUNTING',
      'EXECUTIVE',
      'OPERATIONS',
      'PURCHASING',
      'SALES',
      'WAREHOUSE',
    ]);
    // EP24: one Head Office, one Professional subscription — even after a second run.
    // EP25: plus one demo branch (00001) for the branch selector.
    const branches = await h.db.branch.findMany({
      where: { companyId: company.id },
      orderBy: { code: 'asc' },
    });
    expect(branches.map((b) => [b.code, b.type, b.status])).toEqual([
      ['00000', 'HEAD_OFFICE', 'ACTIVE'],
      ['00001', 'BRANCH', 'ACTIVE'],
    ]);
    // EP25: the demo staff works in Warehouse — one assignment, still one account.
    const assignments = await h.db.membership.findMany({
      where: { user: { emailNormalized: 'staff.demo@pdabliss.com' } },
      include: { department: true },
    });
    expect(assignments.map((a) => [a.department.code, a.isPrimary])).toEqual([['WAREHOUSE', true]]);
    const subscriptions = await h.db.subscription.findMany({ where: { companyId: company.id } });
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      monthlyPriceThb: 999,
      paymentProvider: null,
    });
    expect(
      Object.fromEntries(company.members.map((m) => [m.user.emailNormalized, m.role])),
    ).toEqual({
      'owner.demo@pdabliss.com': 'COMPANY_OWNER',
      'admin.demo@pdabliss.com': 'SYSTEM_ADMIN',
      'executive.demo@pdabliss.com': 'EXECUTIVE',
      'staff.demo@pdabliss.com': 'DEPARTMENT_STAFF',
    });
    // Demo identities are customers: no platform role, customer onboarding context.
    expect(await h.db.platformRoleAssignment.count()).toBe(2);
    const b = await signIn(h, 'owner.demo@pdabliss.com', {
      password: DEMO.DEMO_COMPANY_OWNER_PASSWORD,
    });
    const me = (await b.get('/api/v1/auth/me')).json().identity;
    expect(me).toMatchObject({
      platformRole: null,
      company: { name: DEMO_COMPANY_NAME, isDemo: true, role: 'COMPANY_OWNER' },
      onboarding: { state: 'company_ready' },
    });
    expect((await b.get('/api/v1/platform/overview')).statusCode).toBe(403);
  });

  it('refuses production and missing demo passwords', async () => {
    await expect(
      seedDemo(h.db, parseSeedEnv({ ...BASE, ...DEMO, NODE_ENV: 'production' })),
    ).rejects.toThrow(/never runs in production/);
    await expect(
      seedDemo(h.db, parseSeedEnv({ ...BASE, ...DEMO, DEMO_STAFF_PASSWORD: '' })),
    ).rejects.toThrow(/DEMO_STAFF_PASSWORD is not set/);
    expect(await h.db.company.count()).toBe(0);
  });
});
