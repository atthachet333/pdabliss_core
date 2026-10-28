import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import {
  Browser,
  codeFrom,
  createHarness,
  createActiveCompany,
  createUser,
  describeDb,
  PASSWORD,
  resetDb,
  signIn,
  tokenFrom,
  type Harness,
} from './support.js';
import { describe } from 'vitest';

/* Cross-site requests, CORS, invitations and secret hygiene (EP23). */

describeDb('cross-site request protection (EP23)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    await createUser(h.db, 'member@example.com');
  });

  it('refuses state-changing calls from a foreign Origin', async () => {
    const b = await signIn(h, 'member@example.com');
    const res = await b.request(
      'POST',
      '/api/v1/auth/logout',
      {},
      { origin: 'https://evil.example' },
    );
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CSRF_REJECTED');
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(200);
  });

  it('refuses a cookie-carrying call without an Origin', async () => {
    const b = await signIn(h, 'member@example.com');
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout-all',
      headers: { cookie: `core_sid=${b.cookies.get('core_sid')}` },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('accepts JSON only (no text/plain or form posts that skip the CORS preflight)', async () => {
    for (const type of ['text/plain', 'application/x-www-form-urlencoded']) {
      const res = await h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:1111', 'content-type': type },
        payload: 'email=member@example.com&password=x',
      });
      expect(res.statusCode).toBe(415);
    }
  });

  it('CORS allows credentials for the allow-listed origin only', async () => {
    const preflight = (origin: string) =>
      h.app.inject({
        method: 'OPTIONS',
        url: '/api/v1/auth/login',
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });
    const ok = await preflight('http://localhost:1111');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:1111');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const bad = await preflight('https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describeDb('invitations (EP23 foundation)', () => {
  let h: Harness;
  let companyId: string;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
    // EP25: invitations are sent from the Company Control Center of an ACTIVE company.
    ({ companyId } = await createActiveCompany(h.db, { name: 'Invite Co' }));
    await createUser(h.db, 'boss@example.com', { companyRole: 'COMPANY_OWNER', companyId });
    await createUser(h.db, 'staff@example.com', { companyRole: 'DEPARTMENT_STAFF', companyId });
  });

  async function invite(email = 'new.hire@example.com', role = 'DEPARTMENT_STAFF') {
    const boss = await signIn(h, 'boss@example.com');
    const res = await boss.post('/api/v1/company/invitations', { email, role });
    return {
      boss,
      res,
      token: res.statusCode === 201 ? tokenFrom(h.mailer, email, 'invitation') : '',
    };
  }

  it('the company owner invites; the invitee accepts with the bound email', async () => {
    const { res, token } = await invite();
    expect(res.statusCode).toBe(201);
    expect(h.mailer.last('new.hire@example.com', 'invitation')!.text).toMatch(
      /\/account\/invitation\?lang=th#token=/,
    );
    await createUser(h.db, 'new.hire@example.com');
    const hire = await signIn(h, 'new.hire@example.com');
    const accepted = await hire.post('/api/v1/auth/invitations/accept', { token });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({
      company: { name: 'Invite Co' },
      role: 'DEPARTMENT_STAFF',
    });
    expect((await hire.get('/api/v1/auth/me')).json().identity.company?.role).toBe(
      'DEPARTMENT_STAFF',
    );
    expect((await hire.post('/api/v1/auth/invitations/accept', { token })).json().error.code).toBe(
      'TOKEN_USED',
    );
  });

  it('staff cannot invite, nobody can invite a COMPANY_OWNER, and a platform role is not invitable', async () => {
    const staff = await signIn(h, 'staff@example.com');
    expect(
      (await staff.post('/api/v1/company/invitations', { email: 'x@example.com', role: 'VIEWER' }))
        .statusCode,
    ).toBe(403);
    const boss = await signIn(h, 'boss@example.com');
    expect(
      (
        await boss.post('/api/v1/company/invitations', {
          email: 'x@example.com',
          role: 'COMPANY_OWNER',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await boss.post('/api/v1/company/invitations', {
          email: 'x@example.com',
          role: 'PLATFORM_ADMIN',
        })
      ).statusCode,
    ).toBe(400);
  });

  it('a different account cannot accept; revoked and expired invitations are refused', async () => {
    const { boss, res, token } = await invite();
    await createUser(h.db, 'intruder@example.com');
    const intruder = await signIn(h, 'intruder@example.com');
    expect(
      (await intruder.post('/api/v1/auth/invitations/accept', { token })).json().error.code,
    ).toBe('INVITATION_EMAIL_MISMATCH');

    expect(
      (await boss.post(`/api/v1/company/invitations/${res.json().id}/revoke`)).statusCode,
    ).toBe(200);
    await createUser(h.db, 'new.hire@example.com');
    const hire = await signIn(h, 'new.hire@example.com');
    expect((await hire.post('/api/v1/auth/invitations/accept', { token })).json().error.code).toBe(
      'TOKEN_EXPIRED',
    );

    const second = await invite();
    await h.db.invitation.updateMany({
      where: { status: 'PENDING' },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect(
      (await hire.post('/api/v1/auth/invitations/accept', { token: second.token })).statusCode,
    ).toBe(410);
    expect(
      await h.db.companyMember.count({
        where: { user: { emailNormalized: 'new.hire@example.com' } },
      }),
    ).toBe(0);
  });

  it('an account already in a company cannot join a second one (no company switching)', async () => {
    const other = await createActiveCompany(h.db, { name: 'Other Co' });
    await createUser(h.db, 'elsewhere@example.com', {
      companyRole: 'VIEWER',
      companyId: other.companyId,
    });
    // Creating the invitation does not reveal that the address belongs to another company …
    const { res, token } = await invite('elsewhere@example.com', 'VIEWER');
    expect(res.statusCode).toBe(201);
    // … accepting it is refused clearly.
    const elsewhere = await signIn(h, 'elsewhere@example.com');
    expect(
      (await elsewhere.post('/api/v1/auth/invitations/accept', { token })).json().error.code,
    ).toBe('ALREADY_IN_COMPANY');
    // Someone already in THIS company is not invited again (EP25).
    const again = await invite('staff@example.com', 'VIEWER');
    expect(again.res.statusCode).toBe(409);
    expect(again.res.json().error.code).toBe('ALREADY_MEMBER');
  });
});

describeDb('secret hygiene (EP23)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => resetDb(h.db));

  it('passwords, codes, tokens and session cookies never reach the logs', async () => {
    const b = new Browser(h.app);
    await b.post('/api/v1/auth/register', {
      email: 'logs@example.com',
      password: PASSWORD,
      fullName: 'Log Person',
      phone: '0812345678',
      business: { companyName: 'Test Co', industry: 'SERVICES', teamSize: 'SIZE_1_10' },
      acceptTerms: true,
    });
    const verifyToken = tokenFrom(h.mailer, 'logs@example.com', 'verify_email');
    await b.post('/api/v1/auth/verify-email', { token: verifyToken });
    const login = await b.post('/api/v1/auth/login', {
      email: 'logs@example.com',
      password: PASSWORD,
    });
    const code = codeFrom(h.mailer, 'logs@example.com');
    await b.post('/api/v1/auth/login/otp', { challengeId: login.json().challenge.id, code });
    const session = b.cookies.get('core_sid')!;
    await b.get('/api/v1/auth/me');
    await b.post('/api/v1/auth/password/forgot', { email: 'logs@example.com' });
    const resetToken = tokenFrom(h.mailer, 'logs@example.com', 'password_reset');
    await b.post('/api/v1/auth/password/reset', {
      token: resetToken,
      password: 'another passphrase 2026',
    });

    const logs = h.logs.join('\n');
    expect(logs.length).toBeGreaterThan(0);
    for (const secret of [PASSWORD, 'another passphrase 2026', verifyToken, resetToken, session]) {
      expect(logs).not.toContain(secret);
    }
    expect(logs).not.toMatch(new RegExp(`\\b${code}\\b`));
    const events = JSON.stringify(await h.db.authAuditEvent.findMany());
    for (const secret of [PASSWORD, verifyToken, resetToken, session, code]) {
      expect(events).not.toContain(secret);
    }
  });
});

describe('production configuration (EP23)', () => {
  const PROD = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://core@db.internal:5432/core',
    PUBLIC_APP_URL: 'https://core.example.com/',
    AUTH_SECRET: 'a-production-secret-that-is-long-enough-123',
    SMTP_HOST: 'smtp.example.com',
  };

  it('requires a database, app URL, secret and SMTP, and refuses the dev mail sink', () => {
    expect(parseEnv(PROD).PUBLIC_APP_URL).toBe('https://core.example.com');
    expect(parseEnv(PROD).MAIL_TRANSPORT).toBe('smtp');
    for (const key of ['DATABASE_URL', 'PUBLIC_APP_URL', 'AUTH_SECRET', 'SMTP_HOST'] as const) {
      expect(() => parseEnv({ ...PROD, [key]: '' })).toThrow(new RegExp(key));
    }
    expect(() => parseEnv({ ...PROD, MAIL_TRANSPORT: 'dev' })).toThrow(/MAIL_TRANSPORT/);
    expect(() => parseEnv({ ...PROD, AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET/);
  });

  it('never echoes a configured secret in a validation error', () => {
    const secret = 'super-secret-value-that-should-not-appear';
    try {
      parseEnv({ ...PROD, SMTP_PASSWORD: secret, PORT: 'bad' });
    } catch (e) {
      expect(String(e)).not.toContain(secret);
    }
  });
});
