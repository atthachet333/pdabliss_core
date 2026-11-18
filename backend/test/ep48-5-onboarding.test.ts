import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  Browser,
  codeFrom,
  createActiveCompany,
  createHarness,
  createUser,
  describeDb,
  PASSWORD,
  resetDb,
  signIn,
  tokenFrom,
  type ApiResponse,
  type Harness,
} from './support.js';

/*
 * EP48.5 FINAL — controlled onboarding for the public CORE deployment.
 *
 * F1: with PUBLIC_SIGNUP=false the self-service sign-up routes do not exist; an invited person
 *     creates the account from the emailed invitation link (single use, expiring, bound to the
 *     invited address), joins with the invited role and department, then signs in normally.
 * F2: production manual activation — PLATFORM_OWNER only, a fresh emailed code (step-up), only
 *     for a company listed in MANUAL_ACTIVATION_COMPANY_IDS, with the display name retyped and a
 *     reason; audited, and never twice. The development activation stays development-only.
 */

const API = '/api/v1';
type Json = Record<string, unknown> & {
  status: string;
  error: { code: string };
  company: Record<string, unknown> & { id: string; name: string; status: string };
  subscription: { status: string };
  role: string;
  id: string;
  publicSignup: boolean;
  identity: { company?: { role: string } | null };
  challenge: { id: string };
};
const json = (res: ApiResponse) => res.json<Json>();
const PROD = () => ({
  NODE_ENV: 'production',
  PUBLIC_APP_URL: 'https://core.example.com',
  AUTH_SECRET: 'p'.repeat(48),
  SMTP_HOST: 'smtp.example.com',
  DATABASE_URL: process.env.TEST_DATABASE_URL!,
  LOG_LEVEL: 'silent',
});

describeDb('EP48.5 F1: invitation-only account creation', () => {
  let h: Harness;
  let companyId: string;
  beforeAll(async () => {
    h = await createHarness({ PUBLIC_SIGNUP: 'false' });
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
    ({ companyId } = await createActiveCompany(h.db, {
      name: 'Invite Co',
      departments: ['SALES', 'WAREHOUSE'],
    }));
    await createUser(h.db, 'boss@example.com', { companyRole: 'COMPANY_OWNER', companyId });
  });

  async function invite(email: string, extra: Record<string, unknown> = {}) {
    const boss = await signIn(h, 'boss@example.com');
    const res = await boss.post(`${API}/company/invitations`, {
      email,
      role: 'DEPARTMENT_STAFF',
      ...extra,
    });
    expect(res.statusCode, res.body).toBe(201);
    return { boss, id: json(res).id, token: tokenFrom(h.mailer, email, 'invitation') };
  }
  const register = (token: string, extra: Record<string, unknown> = {}) =>
    new Browser(h.app).post(`${API}/auth/invitations/register`, {
      token,
      password: PASSWORD,
      fullName: 'New Hire',
      acceptTerms: true,
      ...extra,
    });

  it('public self-service sign-up routes do not exist, and the API says so', async () => {
    const anon = new Browser(h.app);
    const reg = await anon.post(`${API}/auth/register`, { email: 'x@example.com' });
    expect(reg.statusCode).toBe(404);
    expect(json(reg).error.code).toBe('ROUTE_NOT_FOUND');
    const resend = await anon.post(`${API}/auth/verification/resend`, { email: 'x@example.com' });
    expect(resend.statusCode).toBe(404);
    expect(json(await anon.get(API)).publicSignup).toBe(false);
  });

  it('an invited person creates the account from the link, joins, then signs in with a code', async () => {
    const { token, id } = await invite('new.hire@example.com', { departments: ['SALES'] });
    const res = await register(token, { fullName: 'Somchai Jaidee', locale: 'en' });
    expect(res.statusCode, res.body).toBe(201);
    expect(json(res)).toMatchObject({
      status: 'account_created',
      company: { id: companyId, name: 'Invite Co' },
      role: 'DEPARTMENT_STAFF',
    });
    // No session is opened by registration: the person signs in normally (password + OTP).
    expect((res.cookies as { name: string }[]).some((c) => c.name.includes('core_sid'))).toBe(
      false,
    );
    const user = await h.db.user.findUniqueOrThrow({
      where: { emailNormalized: 'new.hire@example.com' },
    });
    expect(user).toMatchObject({ status: 'ACTIVE', fullName: 'Somchai Jaidee', locale: 'en' });
    expect(user.emailVerifiedAt).not.toBeNull();
    const member = await h.db.companyMember.findUniqueOrThrow({ where: { userId: user.id } });
    expect(member).toMatchObject({ companyId, role: 'DEPARTMENT_STAFF' });
    const dept = await h.db.membership.findMany({
      where: { userId: user.id },
      include: { department: true },
    });
    expect(dept.map((m) => m.department.code)).toEqual(['SALES']);
    expect(await h.db.invitation.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'ACCEPTED',
      acceptedById: user.id,
    });
    const events = await h.db.authAuditEvent.findMany({ where: { userId: user.id } });
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['REGISTER', 'EMAIL_VERIFIED', 'INVITATION_ACCEPTED']),
    );
    // Secrets never reach the audit trail.
    expect(JSON.stringify(events)).not.toContain(token);
    expect(JSON.stringify(events)).not.toContain(PASSWORD);

    const hire = await signIn(h, 'new.hire@example.com');
    expect(json(await hire.get(`${API}/auth/me`)).identity.company?.role).toBe('DEPARTMENT_STAFF');

    // Single use.
    const again = await register(token);
    expect(again.statusCode).toBe(410);
    expect(json(again).error.code).toBe('TOKEN_USED');
  });

  it('refuses unknown, revoked and expired links, and an address that already has an account', async () => {
    const unknown = await register('x'.repeat(43));
    expect(unknown.statusCode).toBe(400);
    expect(json(unknown).error.code).toBe('TOKEN_INVALID');

    const revoked = await invite('revoked@example.com');
    expect(
      (await revoked.boss.post(`${API}/company/invitations/${revoked.id}/revoke`)).statusCode,
    ).toBeLessThan(300);
    expect(json(await register(revoked.token)).error.code).toBe('TOKEN_EXPIRED');

    const expired = await invite('expired@example.com');
    await h.db.invitation.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(json(await register(expired.token)).error.code).toBe('TOKEN_EXPIRED');

    await createUser(h.db, 'known@example.com');
    const known = await invite('known@example.com');
    const taken = await register(known.token);
    expect(taken.statusCode).toBe(409);
    expect(json(taken).error.code).toBe('ACCOUNT_EXISTS');
    expect(await h.db.invitation.findUniqueOrThrow({ where: { id: known.id } })).toMatchObject({
      status: 'PENDING',
    });

    for (const email of ['revoked@example.com', 'expired@example.com']) {
      expect(await h.db.user.count({ where: { emailNormalized: email } })).toBe(0);
    }
    expect(await h.db.companyMember.count({ where: { companyId } })).toBe(1); // the boss only
  });

  it('the request cannot choose another address or role, and must meet the password rules', async () => {
    const { token, id } = await invite('shape@example.com');
    for (const extra of [
      { email: 'attacker@example.com' },
      { role: 'COMPANY_ADMIN' },
      { companyId: 'other' },
      { acceptTerms: false },
      { password: 'short' },
      { fullName: '' },
    ]) {
      const res = await register(token, extra);
      expect(res.statusCode, JSON.stringify(extra)).toBe(400);
    }
    expect(await h.db.user.count({ where: { emailNormalized: 'shape@example.com' } })).toBe(0);
    expect(await h.db.user.count({ where: { emailNormalized: 'attacker@example.com' } })).toBe(0);
    expect(await h.db.invitation.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'PENDING',
    });
  });

  it('two concurrent uses of one link create one account and one membership', async () => {
    const { token } = await invite('race@example.com');
    const results = await Promise.all([register(token), register(token)]);
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes[0]).toBe(201);
    expect([409, 410]).toContain(codes[1]);
    expect(await h.db.user.count({ where: { emailNormalized: 'race@example.com' } })).toBe(1);
    expect(await h.db.companyMember.count({ where: { companyId } })).toBe(2);
  });

  it('a suspended company accepts nobody', async () => {
    const { token } = await invite('late@example.com');
    await h.db.company.update({ where: { id: companyId }, data: { status: 'SUSPENDED' } });
    const res = await register(token);
    expect(res.statusCode).toBe(409);
    expect(json(res).error.code).toBe('COMPANY_UNAVAILABLE');
    expect(await h.db.user.count({ where: { emailNormalized: 'late@example.com' } })).toBe(0);
  });
});

describeDb('EP48.5 F2: production manual activation', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness(); // default env: public sign-up on, no allow-list
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
  });

  const COMPANY = (displayName: string) => ({
    legalName: `บริษัท ${displayName} จำกัด`,
    displayName,
    taxId: '0105536000011',
    headOffice: {
      addressLine1: '1 ถนนตัวอย่าง',
      subdistrict: 'บางกระสอ',
      district: 'เมืองนนทบุรี',
      province: 'นนทบุรี',
      postalCode: '11000',
    },
    billingCycle: 'MONTHLY',
    departments: ['SALES'],
  });
  /** A customer company that finished onboarding and waits for activation. */
  async function pendingCompany(email: string, displayName: string) {
    await createUser(h.db, email);
    const b = await signIn(h, email);
    expect((await b.post(`${API}/account/package`, { plan: 'STARTER' })).statusCode).toBe(200);
    const res = await b.post(`${API}/company/onboarding`, COMPANY(displayName));
    expect(res.statusCode, res.body).toBe(201);
    return { b, id: json(res).company.id };
  }
  const BODY = (confirmDisplayName: string) => ({
    confirmDisplayName,
    reason: 'EP48.5 UAT company approved by the owner',
  });

  it('the public API reports public sign-up on by default', async () => {
    expect(json(await new Browser(h.app).get(API)).publicSignup).toBe(true);
  });

  it('the route does not exist while the allow-list is empty', async () => {
    const { id } = await pendingCompany('a@example.com', 'บริษัทเอ');
    await createUser(h.db, 'owner@pdabliss.test', { platformRole: 'PLATFORM_OWNER' });
    const op = await signIn(h, 'owner@pdabliss.test');
    const url = `${API}/platform/companies/${id}/manual-activation`;
    const res = await op.post(url, BODY('บริษัทเอ'));
    expect(res.statusCode).toBe(404);
    expect(json(res).error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('production: owner only, fresh code, listed company only, retyped name; audited; once', async () => {
    const listed = await pendingCompany('uat.owner@example.com', 'บริษัททดสอบ');
    const other = await pendingCompany('other.owner@example.com', 'บริษัทอื่น');
    const owner = await createUser(h.db, 'owner@pdabliss.test', { platformRole: 'PLATFORM_OWNER' });
    await createUser(h.db, 'admin@pdabliss.test', { platformRole: 'PLATFORM_ADMIN' });

    const p = await createHarness({ ...PROD(), MANUAL_ACTIVATION_COMPANY_IDS: listed.id });
    try {
      const url = (id: string) => `${API}/platform/companies/${id}/manual-activation`;
      // The development path stays closed in production.
      const op = await signIn(p, 'owner@pdabliss.test');
      const dev = await op.post(`${API}/platform/companies/${listed.id}/development-activation`);
      expect(dev.statusCode).toBe(404);

      // Nobody but the Platform Owner.
      const anon = await new Browser(p.app).post(url(listed.id), BODY('บริษัททดสอบ'));
      expect(anon.statusCode).toBe(401);
      const customer = await signIn(p, 'uat.owner@example.com');
      expect((await customer.post(url(listed.id), BODY('บริษัททดสอบ'))).statusCode).toBe(403);
      const admin = await signIn(p, 'admin@pdabliss.test');
      expect((await admin.post(url(listed.id), BODY('บริษัททดสอบ'))).statusCode).toBe(403);

      // Only the allow-listed company.
      const unlisted = await op.post(url(other.id), BODY('บริษัทอื่น'));
      expect(unlisted.statusCode).toBe(404);

      // The display name must be retyped exactly; the reason is required.
      const mismatch = await op.post(url(listed.id), BODY('บริษัทอื่น'));
      expect(mismatch.statusCode).toBe(409);
      expect(json(mismatch).error.code).toBe('CONFIRMATION_MISMATCH');
      expect(
        (await op.post(url(listed.id), { confirmDisplayName: 'บริษัททดสอบ', reason: 'short' }))
          .statusCode,
      ).toBe(400);
      expect(
        (await op.post(url(listed.id), { ...BODY('บริษัททดสอบ'), plan: 'ENTERPRISE' })).statusCode,
      ).toBe(400);

      // A stale step-up is refused; a fresh emailed code unlocks it.
      await p.db.session.updateMany({
        where: { userId: owner.id },
        data: { stepUpAt: new Date(Date.now() - 11 * 60_000) },
      });
      const stale = await op.post(url(listed.id), BODY('บริษัททดสอบ'));
      expect(stale.statusCode).toBe(403);
      expect(json(stale).error.code).toBe('STEP_UP_REQUIRED');
      const start = await op.post(`${API}/auth/step-up`);
      expect(start.statusCode).toBe(200);
      const verify = await op.post(`${API}/auth/step-up/verify`, {
        challengeId: json(start).challenge.id,
        code: codeFrom(p.mailer, 'owner@pdabliss.test', 'step_up_otp'),
      });
      expect(verify.statusCode).toBe(200);

      // Nothing changed so far.
      for (const id of [listed.id, other.id]) {
        expect((await p.db.company.findUniqueOrThrow({ where: { id } })).status).toBe(
          'PENDING_SUBSCRIPTION',
        );
      }

      const ok = await op.post(url(listed.id), BODY('  บริษัททดสอบ '));
      expect(ok.statusCode, ok.body).toBe(200);
      expect(json(ok)).toMatchObject({ manualActivation: true });
      expect((await p.db.company.findUniqueOrThrow({ where: { id: listed.id } })).status).toBe(
        'ACTIVE',
      );
      expect((await p.db.company.findUniqueOrThrow({ where: { id: other.id } })).status).toBe(
        'PENDING_SUBSCRIPTION',
      );
      const sub = await p.db.auditLog.findFirstOrThrow({
        where: { companyId: listed.id, action: 'SUBSCRIPTION_STATUS_CHANGED' },
      });
      expect(sub.changes).toMatchObject({
        from: 'PENDING',
        to: 'ACTIVE',
        mode: 'operator_manual',
        paid: false,
        reason: 'EP48.5 UAT company approved by the owner',
      });
      expect(sub.actorId).toBe(owner.id);
      const co = await p.db.auditLog.findFirstOrThrow({
        where: { companyId: listed.id, action: 'COMPANY_STATUS_CHANGED' },
      });
      expect(co.changes).toMatchObject({
        from: 'PENDING_SUBSCRIPTION',
        to: 'ACTIVE',
        mode: 'operator_manual',
      });

      // Never twice.
      const replay = await op.post(url(listed.id), BODY('บริษัททดสอบ'));
      expect(replay.statusCode).toBe(409);
      expect(json(replay).error.code).toBe('INVALID_TRANSITION');
      expect(
        await p.db.auditLog.count({
          where: { companyId: listed.id, action: 'SUBSCRIPTION_STATUS_CHANGED' },
        }),
      ).toBe(1);
    } finally {
      await p.close();
    }
  });
});
