import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { DEMO_BYPASS_EMAILS, demoBypassEnabled } from '../src/auth/demo-bypass.js';
import {
  Browser,
  createHarness,
  createUser,
  describeDb,
  PASSWORD,
  resetDb,
  type Harness,
} from './support.js';

/*
 * Development-only demo sign-in bypass: the four seeded demo customers skip the
 * emailed login code after a correct password — and nobody else, and never in
 * production. See src/auth/demo-bypass.ts.
 */

const DEMO_ROLES = {
  'owner.demo@pdabliss.com': 'COMPANY_OWNER',
  'admin.demo@pdabliss.com': 'SYSTEM_ADMIN',
  'executive.demo@pdabliss.com': 'EXECUTIVE',
  'staff.demo@pdabliss.com': 'DEPARTMENT_STAFF',
} as const;

async function demoCompany(h: Harness) {
  return (await h.db.company.create({ data: { name: 'Demo', isDemo: true } })).id;
}

async function login(h: Harness, email: string, password = PASSWORD) {
  const b = new Browser(h.app);
  const res = await b.post('/api/v1/auth/login', { email, password });
  return { b, res, body: res.json() };
}

it('gates on NODE_ENV and ENABLE_DEMO_ROUTES together', () => {
  expect(demoBypassEnabled({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: true })).toBe(true);
  expect(demoBypassEnabled({ NODE_ENV: 'test', ENABLE_DEMO_ROUTES: true })).toBe(true);
  expect(demoBypassEnabled({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: false })).toBe(false);
  // Production never, even with demo routes forced on.
  expect(demoBypassEnabled({ NODE_ENV: 'production', ENABLE_DEMO_ROUTES: true })).toBe(false);
  expect(DEMO_BYPASS_EMAILS).toEqual(Object.keys(DEMO_ROLES));
});

describeDb('demo sign-in bypass — development', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'true' });
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.sent.length = 0;
  });

  it('each seeded demo customer gets a normal session without a code, audited', async () => {
    expect(h.logs.join('')).toContain('Demo sign-in bypass is ON');
    const companyId = await demoCompany(h);
    for (const [email, companyRole] of Object.entries(DEMO_ROLES)) {
      const user = await createUser(h.db, email, { companyRole, companyId });
      const { b, res, body } = await login(h, email);
      expect(res.statusCode, res.body).toBe(200);
      expect(body.status).toBe('authenticated');
      expect(h.mailer.last(email, 'login_otp')).toBeUndefined();
      // An ordinary customer session: not privileged, no step-up.
      const session = await h.db.session.findFirstOrThrow({ where: { userId: user.id } });
      expect(session).toMatchObject({ privileged: false, stepUpAt: null, revokedAt: null });
      const me = await b.get('/api/v1/auth/me');
      expect(me.statusCode).toBe(200);
      expect(me.json().identity.company).toMatchObject({ role: companyRole });
      const event = await h.db.authAuditEvent.findFirstOrThrow({
        where: { userId: user.id, type: 'DEMO_AUTH_BYPASS' },
      });
      expect(event.metadata).toEqual({ skipped: 'login_otp' });
      expect(JSON.stringify(event)).not.toContain(PASSWORD);
      expect(
        await h.db.authAuditEvent.count({ where: { userId: user.id, type: 'LOGIN_SUCCESS' } }),
      ).toBe(1);
    }
  });

  it('the password is still checked first: a wrong one gets no session and no bypass', async () => {
    const user = await createUser(h.db, 'owner.demo@pdabliss.com', {
      companyRole: 'COMPANY_OWNER',
      companyId: await demoCompany(h),
    });
    const { b, res } = await login(h, 'owner.demo@pdabliss.com', 'wrong password entirely');
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(401);
    expect(await h.db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await h.db.authAuditEvent.count({ where: { type: 'DEMO_AUTH_BYPASS' } })).toBe(0);
  });

  it('an unverified or suspended demo account is refused as usual', async () => {
    const companyId = await demoCompany(h);
    await createUser(h.db, 'staff.demo@pdabliss.com', {
      verified: false,
      companyRole: 'DEPARTMENT_STAFF',
      companyId,
    });
    expect((await login(h, 'staff.demo@pdabliss.com')).res.json().error.code).toBe(
      'EMAIL_NOT_VERIFIED',
    );
    await createUser(h.db, 'executive.demo@pdabliss.com', {
      status: 'SUSPENDED',
      companyRole: 'EXECUTIVE',
      companyId,
    });
    expect((await login(h, 'executive.demo@pdabliss.com')).res.statusCode).toBe(403);
    expect(await h.db.authAuditEvent.count({ where: { type: 'DEMO_AUTH_BYPASS' } })).toBe(0);
  });

  it('never for platform accounts — even with a demo address', async () => {
    await createUser(h.db, 'owner.demo@pdabliss.com', { platformRole: 'PLATFORM_OWNER' });
    await createUser(h.db, 'admin.demo@pdabliss.com', { platformRole: 'PLATFORM_ADMIN' });
    for (const email of ['owner.demo@pdabliss.com', 'admin.demo@pdabliss.com']) {
      expect((await login(h, email)).body.status).toBe('otp_required');
    }
    expect(await h.db.authAuditEvent.count({ where: { type: 'DEMO_AUTH_BYPASS' } })).toBe(0);
  });

  it('never for other @pdabliss.com addresses, normal customers or a demo address outside the demo company', async () => {
    const demo = await demoCompany(h);
    const real = (await h.db.company.create({ data: { name: 'Real Co', isDemo: false } })).id;
    // Same domain, not on the list (also look-alikes of listed addresses).
    await createUser(h.db, 'sales@pdabliss.com', {
      companyRole: 'DEPARTMENT_STAFF',
      companyId: demo,
    });
    await createUser(h.db, 'owner.demo+x@pdabliss.com', {
      companyRole: 'VIEWER',
      companyId: demo,
    });
    await createUser(h.db, 'owner.demo@pdabliss.com.evil.test', {
      companyRole: 'VIEWER',
      companyId: demo,
    });
    // A normal customer.
    await createUser(h.db, 'customer@example.com', {
      companyRole: 'COMPANY_OWNER',
      companyId: real,
    });
    // A listed address that belongs to a real company, or to none.
    await createUser(h.db, 'admin.demo@pdabliss.com', {
      companyRole: 'SYSTEM_ADMIN',
      companyId: real,
    });
    await createUser(h.db, 'staff.demo@pdabliss.com');
    for (const email of [
      'sales@pdabliss.com',
      'owner.demo+x@pdabliss.com',
      'owner.demo@pdabliss.com.evil.test',
      'customer@example.com',
      'admin.demo@pdabliss.com',
      'staff.demo@pdabliss.com',
    ]) {
      expect((await login(h, email)).body.status, email).toBe('otp_required');
    }
    expect(await h.db.authAuditEvent.count({ where: { type: 'DEMO_AUTH_BYPASS' } })).toBe(0);
  });

  it('does not widen access: a bypassed demo session is still a customer session', async () => {
    await createUser(h.db, 'owner.demo@pdabliss.com', {
      companyRole: 'COMPANY_OWNER',
      companyId: await demoCompany(h),
    });
    const { b } = await login(h, 'owner.demo@pdabliss.com');
    expect((await b.get('/api/v1/platform/companies')).statusCode).toBe(403);
    expect((await b.get('/api/v1/platform/overview')).statusCode).toBe(403);
  });
});

describeDb('demo sign-in bypass — off without demo routes', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'false' });
  });
  afterAll(async () => h.close());

  it('asks the demo accounts for a code like everyone else', async () => {
    await resetDb(h.db);
    await createUser(h.db, 'owner.demo@pdabliss.com', {
      companyRole: 'COMPANY_OWNER',
      companyId: await demoCompany(h),
    });
    expect((await login(h, 'owner.demo@pdabliss.com')).body.status).toBe('otp_required');
    expect(await h.db.authAuditEvent.count({ where: { type: 'DEMO_AUTH_BYPASS' } })).toBe(0);
  });
});

describeDb('demo sign-in bypass — production', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({
      NODE_ENV: 'production',
      // Forced on: production must still refuse the bypass.
      ENABLE_DEMO_ROUTES: 'true',
      PUBLIC_APP_URL: 'https://core.example.com',
      AUTH_SECRET: 'p'.repeat(48),
      SMTP_HOST: 'smtp.example.com',
      DATABASE_URL: process.env.TEST_DATABASE_URL!,
      LOG_LEVEL: 'silent',
    });
  });
  afterAll(async () => h.close());

  it('has no bypass: every demo account must enter the emailed code', async () => {
    await resetDb(h.db);
    expect(h.logs.join('')).not.toContain('Demo sign-in bypass is ON');
    const companyId = await demoCompany(h);
    for (const [email, companyRole] of Object.entries(DEMO_ROLES)) {
      await createUser(h.db, email, { companyRole, companyId });
      const { res, body } = await login(h, email);
      expect(res.statusCode, res.body).toBe(200);
      expect(body.status, email).toBe('otp_required');
    }
    expect(await h.db.session.count()).toBe(0);
    expect(await h.db.authAuditEvent.count({ where: { type: 'DEMO_AUTH_BYPASS' } })).toBe(0);
  });
});
