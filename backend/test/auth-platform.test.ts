import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  Browser,
  codeFrom,
  createHarness,
  createUser,
  describeDb,
  PASSWORD,
  resetDb,
  signIn,
  type Harness,
} from './support.js';

/* Privilege separation (EP23): PLATFORM_OWNER > PLATFORM_ADMIN > customers. */

describeDb('platform authority (EP23)', () => {
  let h: Harness;
  let ownerId: string;
  let adminId: string;
  let customerId: string;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
    ownerId = (await createUser(h.db, 'owner@pdabliss.test', { platformRole: 'PLATFORM_OWNER' }))
      .id;
    adminId = (await createUser(h.db, 'admin@pdabliss.test', { platformRole: 'PLATFORM_ADMIN' }))
      .id;
    customerId = (await createUser(h.db, 'customer@example.com', { companyRole: 'COMPANY_OWNER' }))
      .id;
  });

  const owner = () => signIn(h, 'owner@pdabliss.test');
  const admin = () => signIn(h, 'admin@pdabliss.test');
  const customer = () => signIn(h, 'customer@example.com');

  it('anonymous requests to the platform API are 401', async () => {
    const b = new Browser(h.app);
    for (const path of ['/overview', '/users', '/companies', '/audit', '/operators']) {
      expect((await b.get(`/api/v1/platform${path}`)).statusCode).toBe(401);
    }
  });

  it('customer accounts — even a COMPANY_OWNER — get 403 on every platform route', async () => {
    const b = await customer();
    for (const path of ['/overview', '/users', '/companies', '/audit', '/operators']) {
      expect((await b.get(`/api/v1/platform${path}`)).statusCode).toBe(403);
    }
    expect((await b.post(`/api/v1/platform/users/${adminId}/suspend`)).statusCode).toBe(403);
  });

  it('PLATFORM_OWNER reaches the owner-only operator list; PLATFORM_ADMIN does not', async () => {
    const o = await owner();
    const list = await o.get('/api/v1/platform/operators');
    expect(list.statusCode).toBe(200);
    expect(list.json().operators.map((x: { role: string }) => x.role)).toEqual([
      'PLATFORM_OWNER',
      'PLATFORM_ADMIN',
    ]);

    const a = await admin();
    expect((await a.get('/api/v1/platform/overview')).statusCode).toBe(200);
    expect((await a.get('/api/v1/platform/operators')).statusCode).toBe(403);
    expect(
      (await a.post('/api/v1/platform/operators', { email: 'customer@example.com' })).statusCode,
    ).toBe(403);
    expect((await a.delete(`/api/v1/platform/operators/${ownerId}`)).statusCode).toBe(403);
  });

  it('PLATFORM_ADMIN cannot suspend, reactivate or otherwise touch the owner', async () => {
    const a = await admin();
    const res = await a.post(`/api/v1/platform/users/${ownerId}/suspend`);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('OWNER_PROTECTED');
    expect((await a.post(`/api/v1/platform/users/${ownerId}/reactivate`)).json().error.code).toBe(
      'OWNER_PROTECTED',
    );
    expect((await h.db.user.findUniqueOrThrow({ where: { id: ownerId } })).status).toBe('ACTIVE');
  });

  it('PLATFORM_ADMIN cannot act on another admin; the owner can', async () => {
    const other = await createUser(h.db, 'admin2@pdabliss.test', {
      platformRole: 'PLATFORM_ADMIN',
    });
    const a = await admin();
    expect((await a.post(`/api/v1/platform/users/${other.id}/suspend`)).statusCode).toBe(403);
    const o = await owner();
    expect((await o.post(`/api/v1/platform/users/${other.id}/suspend`)).statusCode).toBe(200);
  });

  it('nobody can revoke or suspend the owner role, the owner included', async () => {
    const o = await owner();
    const revoke = await o.delete(`/api/v1/platform/operators/${ownerId}`);
    expect(revoke.json().error.code).toBe('OWNER_PROTECTED');
    expect((await o.post(`/api/v1/platform/users/${ownerId}/suspend`)).statusCode).toBe(403);
    expect(await h.db.platformRoleAssignment.count({ where: { role: 'PLATFORM_OWNER' } })).toBe(1);
  });

  it('the database refuses a second owner and an owner slot on an admin', async () => {
    const extra = await createUser(h.db, 'second@pdabliss.test');
    await expect(
      h.db.platformRoleAssignment.create({
        data: { userId: extra.id, role: 'PLATFORM_OWNER', ownerSlot: true },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.platformRoleAssignment.create({
        data: { userId: extra.id, role: 'PLATFORM_ADMIN', ownerSlot: true },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.platformRoleAssignment.create({ data: { userId: extra.id, role: 'PLATFORM_OWNER' } }),
    ).rejects.toThrow();
  });

  it('there is no API path that creates a PLATFORM_OWNER', async () => {
    const o = await owner();
    const res = await o.post('/api/v1/platform/operators', {
      email: 'customer@example.com',
      role: 'PLATFORM_OWNER',
    });
    expect(res.statusCode).toBe(400);
    expect(await h.db.platformRoleAssignment.count({ where: { role: 'PLATFORM_OWNER' } })).toBe(1);
  });

  it('owner grants and revokes PLATFORM_ADMIN with an audit trail; the target is signed out', async () => {
    const plain = await createUser(h.db, 'staff@pdabliss.test');
    const staffBrowser = await signIn(h, 'staff@pdabliss.test');
    const o = await owner();
    const granted = await o.post('/api/v1/platform/operators', { email: 'Staff@PDABLISS.test' });
    expect(granted.statusCode).toBe(201);
    expect((await staffBrowser.get('/api/v1/auth/me')).statusCode).toBe(401);
    // Customer company accounts cannot become operators.
    expect(
      (await o.post('/api/v1/platform/operators', { email: 'customer@example.com' })).json().error
        .code,
    ).toBe('CUSTOMER_ACCOUNT');

    expect((await o.delete(`/api/v1/platform/operators/${plain.id}`)).statusCode).toBe(200);
    const types = (await h.db.authAuditEvent.findMany({ where: { actorId: ownerId } })).map(
      (e) => e.type,
    );
    expect(types).toEqual(
      expect.arrayContaining(['PLATFORM_ROLE_GRANTED', 'PLATFORM_ROLE_REVOKED']),
    );
  });

  it('sensitive actions need a recent step-up code', async () => {
    const a = await admin();
    await h.db.session.updateMany({ data: { stepUpAt: new Date(Date.now() - 11 * 60_000) } });
    const stale = await a.post(`/api/v1/platform/users/${customerId}/suspend`);
    expect(stale.statusCode).toBe(403);
    expect(stale.json().error.code).toBe('STEP_UP_REQUIRED');

    const start = await a.post('/api/v1/auth/step-up');
    expect(start.statusCode).toBe(200);
    const before = a.cookies.get('core_sid');
    const verify = await a.post('/api/v1/auth/step-up/verify', {
      challengeId: start.json().challenge.id,
      code: codeFrom(h.mailer, 'admin@pdabliss.test', 'step_up_otp'),
    });
    expect(verify.statusCode).toBe(200);
    expect(a.cookies.get('core_sid')).not.toBe(before); // rotated on elevation
    expect((await a.post(`/api/v1/platform/users/${customerId}/suspend`)).statusCode).toBe(200);
  });

  it('a step-up code belongs to its session', async () => {
    const a = await admin();
    const start = await a.post('/api/v1/auth/step-up');
    const other = await admin();
    const res = await other.post('/api/v1/auth/step-up/verify', {
      challengeId: start.json().challenge.id,
      code: codeFrom(h.mailer, 'admin@pdabliss.test', 'step_up_otp'),
    });
    expect(res.statusCode).toBe(410);
  });

  it('suspending a customer ends their sessions and blocks sign-in; reactivation restores it', async () => {
    const c = await customer();
    const a = await admin();
    expect((await a.post(`/api/v1/platform/users/${customerId}/suspend`)).statusCode).toBe(200);
    expect((await c.get('/api/v1/auth/me')).statusCode).toBe(401);
    const login = await new Browser(h.app).post('/api/v1/auth/login', {
      email: 'customer@example.com',
      password: PASSWORD,
    });
    expect(login.json().error.code).toBe('ACCOUNT_UNAVAILABLE');
    expect((await a.post(`/api/v1/platform/users/${customerId}/reactivate`)).statusCode).toBe(200);
    await customer();
    const events = await h.db.authAuditEvent.findMany({
      where: { type: { in: ['ACCOUNT_SUSPENDED', 'ACCOUNT_REACTIVATED'] } },
    });
    expect(events.every((e) => e.actorId === adminId && e.userId === customerId)).toBe(true);
  });

  it('a role removed mid-session invalidates the privileged session', async () => {
    const a = await admin();
    await h.db.platformRoleAssignment.delete({ where: { userId: adminId } });
    expect((await a.get('/api/v1/auth/me')).statusCode).toBe(401);
  });

  it('platform data views expose no secrets', async () => {
    const o = await owner();
    for (const path of ['/overview', '/users', '/companies', '/audit', '/operators']) {
      const res = await o.get(`/api/v1/platform${path}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toMatch(/passwordHash|tokenHash|codeHash|subjectHash|argon2/);
    }
  });
});
