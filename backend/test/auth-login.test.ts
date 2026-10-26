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

const LOGIN = '/api/v1/auth/login';
const OTP = '/api/v1/auth/login/otp';
const RESEND = '/api/v1/auth/login/otp/resend';

describeDb('login (EP23)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
  });

  it('a new browser must pass an emailed code before a session exists', async () => {
    await createUser(h.db, 'member@example.com');
    const b = new Browser(h.app);
    const res = await b.post(LOGIN, { email: 'Member@Example.com', password: PASSWORD });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      status: 'otp_required',
      trustDeviceAllowed: true,
      challenge: { maskedEmail: 'm•••@example.com' },
    });
    expect(JSON.stringify(body)).not.toMatch(/\b\d{6}\b/);
    expect(b.cookies.has('core_sid')).toBe(false);
    expect(b.cookies.has('core_pending')).toBe(true);
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(401);

    const ok = await b.post(OTP, {
      challengeId: body.challenge.id,
      code: codeFrom(h.mailer, 'member@example.com'),
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().identity).toMatchObject({
      user: { email: 'member@example.com', emailVerified: true },
      platformRole: null,
      onboarding: { state: 'onboarding_required' },
    });
    expect(b.cookies.has('core_sid')).toBe(true);
    expect(b.cookies.has('core_pending')).toBe(false);
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(200);
  });

  it('a trusted browser signs in without a code; logout-all forgets it', async () => {
    await createUser(h.db, 'member@example.com');
    const b = await signIn(h, 'member@example.com', { trustDevice: true });
    expect(b.cookies.has('core_device')).toBe(true);
    await b.post('/api/v1/auth/logout');
    h.mailer.clear();
    const again = await b.post(LOGIN, { email: 'member@example.com', password: PASSWORD });
    expect(again.json().status).toBe('authenticated');
    expect(h.mailer.sent).toHaveLength(0);

    await b.post('/api/v1/auth/logout-all');
    const after = await b.post(LOGIN, { email: 'member@example.com', password: PASSWORD });
    expect(after.json().status).toBe('otp_required');
  });

  it('gives one generic answer for a wrong password and an unknown account', async () => {
    await createUser(h.db, 'member@example.com');
    const wrong = await new Browser(h.app).post(LOGIN, {
      email: 'member@example.com',
      password: 'wrong password!!',
    });
    const unknown = await new Browser(h.app).post(LOGIN, {
      email: 'ghost@example.com',
      password: PASSWORD,
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe('Email or password is incorrect.');
    expect(unknown.json().error.code).toBe(wrong.json().error.code);
    expect(unknown.json().error.message).toBe(wrong.json().error.message);
  });

  it('refuses unverified and suspended accounts — only after the right password', async () => {
    await createUser(h.db, 'pending@example.com', { verified: false });
    await createUser(h.db, 'suspended@example.com', { status: 'SUSPENDED' });
    await createUser(h.db, 'disabled@example.com', { status: 'DISABLED' });
    const b = new Browser(h.app);
    expect(
      (await b.post(LOGIN, { email: 'pending@example.com', password: PASSWORD })).json().error.code,
    ).toBe('EMAIL_NOT_VERIFIED');
    expect(
      (await b.post(LOGIN, { email: 'suspended@example.com', password: PASSWORD })).json().error
        .code,
    ).toBe('ACCOUNT_UNAVAILABLE');
    expect(
      (await b.post(LOGIN, { email: 'disabled@example.com', password: PASSWORD })).json().error
        .code,
    ).toBe('ACCOUNT_UNAVAILABLE');
    expect(
      (await b.post(LOGIN, { email: 'suspended@example.com', password: 'wrong password!!' })).json()
        .error.code,
    ).toBe('INVALID_CREDENTIALS');
  });

  it('throttles repeated failures per email — known or unknown — then recovers', async () => {
    await createUser(h.db, 'member@example.com');
    for (const email of ['member@example.com', 'ghost@example.com']) {
      for (let i = 0; i < 10; i++) {
        // Different browsers/IPs: the per-account limit is not an IP limit.
        await new Browser(h.app).post(LOGIN, { email, password: 'wrong password!!' });
      }
      const blocked = await new Browser(h.app).post(LOGIN, { email, password: PASSWORD });
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().error.code).toBe('LOGIN_THROTTLED');
    }
    await h.db.authAuditEvent.updateMany({
      data: { occurredAt: new Date(Date.now() - 16 * 60_000) },
    });
    expect(
      (await new Browser(h.app).post(LOGIN, { email: 'member@example.com', password: PASSWORD }))
        .statusCode,
    ).toBe(200);
  });

  it('limits sign-in requests per IP', async () => {
    const b = new Browser(h.app);
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      statuses.push(
        (await b.post(LOGIN, { email: `n${i}@example.com`, password: 'wrong password!!' }))
          .statusCode,
      );
    }
    expect(statuses.slice(0, 60).every((s) => s === 401)).toBe(true);
    expect(statuses[60]).toBe(429);
  });

  it('rehashes a password stored with older Argon2 parameters', async () => {
    const user = await createUser(h.db, 'legacy@example.com');
    const { hash } = await import('@node-rs/argon2');
    await h.db.userCredential.update({
      where: { userId: user.id },
      data: {
        passwordHash: await hash(PASSWORD, { memoryCost: 8192, timeCost: 1, parallelism: 1 }),
      },
    });
    await new Browser(h.app).post(LOGIN, { email: 'legacy@example.com', password: PASSWORD });
    const cred = await h.db.userCredential.findUniqueOrThrow({ where: { userId: user.id } });
    expect(cred.passwordHash).toMatch(/m=19456,t=2,p=1/);
  });
});

describeDb('platform sign-in policy (EP23)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
  });

  it.each(['PLATFORM_OWNER', 'PLATFORM_ADMIN'] as const)(
    '%s always needs a code, never gets a trusted device, and gets a short session',
    async (role) => {
      await createUser(h.db, 'op@example.com', { platformRole: role });
      const probe = await new Browser(h.app).post(LOGIN, {
        email: 'op@example.com',
        password: PASSWORD,
      });
      expect(probe.json<{ trustDeviceAllowed: boolean }>().trustDeviceAllowed).toBe(false);
      const b = await signIn(h, 'op@example.com', { trustDevice: true });
      expect(b.cookies.has('core_device')).toBe(false);
      const me = (await b.get('/api/v1/auth/me')).json().identity;
      expect(me.platformRole).toBe(role);
      expect(me.onboarding.state).toBe('platform_operator');
      expect(me.session.privileged).toBe(true);
      expect(new Date(me.session.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(
        30 * 60_000,
      );

      await b.post('/api/v1/auth/logout');
      const again = await b.post(LOGIN, { email: 'op@example.com', password: PASSWORD });
      expect(again.json().status).toBe('otp_required');
      const success = await h.db.authAuditEvent.findFirstOrThrow({
        where: { type: 'LOGIN_SUCCESS' },
      });
      expect(success.metadata).toMatchObject({ otp: true, platformRole: role });
    },
  );

  it('a device cookie from a customer session gives a platform account no shortcut', async () => {
    await createUser(h.db, 'member@example.com');
    await createUser(h.db, 'op@example.com', { platformRole: 'PLATFORM_ADMIN' });
    const b = await signIn(h, 'member@example.com', { trustDevice: true });
    await b.post('/api/v1/auth/logout');
    const res = await b.post(LOGIN, { email: 'op@example.com', password: PASSWORD });
    expect(res.json().status).toBe('otp_required');
  });
});

describeDb('email one-time codes (EP23)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
    await createUser(h.db, 'member@example.com');
  });

  async function challenge(b = new Browser(h.app)) {
    const res = await b.post(LOGIN, { email: 'member@example.com', password: PASSWORD });
    return {
      b,
      id: res.json().challenge.id,
      code: codeFrom(h.mailer, 'member@example.com'),
    };
  }
  const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

  it('stores only a keyed hash of the code', async () => {
    const { id, code } = await challenge();
    const row = await h.db.otpChallenge.findUniqueOrThrow({ where: { id } });
    expect(row.codeHash).not.toContain(code);
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60_000);
  });

  it('rejects an incorrect code and reports the attempts left', async () => {
    const { b, id, code } = await challenge();
    const res = await b.post(OTP, { challengeId: id, code: wrong(code) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatchObject({
      code: 'OTP_INCORRECT',
      details: { attemptsRemaining: 4 },
    });
  });

  it('locks the challenge after five wrong codes — even the right code fails then', async () => {
    const { b, id, code } = await challenge();
    for (let i = 0; i < 4; i++) await b.post(OTP, { challengeId: id, code: wrong(code) });
    const fifth = await b.post(OTP, { challengeId: id, code: wrong(code) });
    expect(fifth.statusCode).toBe(429);
    expect(fifth.json().error.code).toBe('OTP_LOCKED');
    expect((await b.post(OTP, { challengeId: id, code })).json().error.code).toBe('OTP_LOCKED');
  });

  it('rejects an expired code', async () => {
    const { b, id, code } = await challenge();
    await h.db.otpChallenge.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    const res = await b.post(OTP, { challengeId: id, code });
    expect(res.statusCode).toBe(410);
    expect(res.json().error.code).toBe('OTP_EXPIRED');
  });

  it('a code works once', async () => {
    const { b, id, code } = await challenge();
    const binding = b.cookies.get('core_pending')!;
    expect((await b.post(OTP, { challengeId: id, code })).statusCode).toBe(200);
    // Replay with the genuine binding cookie restored: still refused.
    const replay = new Browser(h.app);
    replay.cookies.set('core_pending', binding);
    const res = await replay.post(OTP, { challengeId: id, code });
    expect(res.statusCode).toBe(410);
    expect(res.json().error.code).toBe('OTP_EXPIRED');
    expect(await h.db.session.count()).toBe(1);
  });

  it('two simultaneous correct submissions open one session at most', async () => {
    const { b, id, code } = await challenge();
    const [a, c] = await Promise.all([
      b.post(OTP, { challengeId: id, code }),
      b.post(OTP, { challengeId: id, code }),
    ]);
    expect([a.statusCode, c.statusCode].sort()).toEqual([200, 410]);
    expect(await h.db.session.count()).toBe(1);
  });

  it('is bound to the browser that passed the password', async () => {
    const { id, code } = await challenge();
    const other = new Browser(h.app);
    const res = await other.post(OTP, { challengeId: id, code });
    expect(res.statusCode).toBe(410);
    expect(await h.db.session.count()).toBe(0);
  });

  it('a new sign-in replaces the previous challenge', async () => {
    const b = new Browser(h.app);
    const first = await challenge(b);
    const second = await challenge(b);
    expect((await b.post(OTP, { challengeId: first.id, code: first.code })).json().error.code).toBe(
      'OTP_EXPIRED',
    );
    expect((await b.post(OTP, { challengeId: second.id, code: second.code })).statusCode).toBe(200);
  });

  it('resend: cooldown, a fresh code, and a cap on sends', async () => {
    const { b, id, code } = await challenge();
    const tooSoon = await b.post(RESEND, { challengeId: id });
    expect(tooSoon.statusCode).toBe(429);
    expect(tooSoon.json().error.code).toBe('OTP_RESEND_TOO_SOON');

    const age = () =>
      h.db.otpChallenge.update({
        where: { id },
        data: { lastSentAt: new Date(Date.now() - 61_000) },
      });
    await age();
    expect((await b.post(RESEND, { challengeId: id })).statusCode).toBe(200);
    const newCode = codeFrom(h.mailer, 'member@example.com');
    for (let i = 0; i < 3; i++) {
      await age();
      expect((await b.post(RESEND, { challengeId: id })).statusCode).toBe(200);
    }
    await age();
    const capped = await b.post(RESEND, { challengeId: id });
    expect(capped.json().error.code).toBe('OTP_RESEND_LIMIT');
    // Only the latest code is valid.
    const latest = codeFrom(h.mailer, 'member@example.com');
    if (code !== latest)
      expect((await b.post(OTP, { challengeId: id, code })).statusCode).toBe(400);
    expect(newCode).toMatch(/^\d{6}$/);
    expect((await b.post(OTP, { challengeId: id, code: latest })).statusCode).toBe(200);
  });

  it('caps new challenges per account per hour', async () => {
    for (let i = 0; i < 10; i++) await challenge();
    const res = await new Browser(h.app).post(LOGIN, {
      email: 'member@example.com',
      password: PASSWORD,
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('OTP_CHALLENGE_LIMIT');
  });

  it('rejects malformed codes before any check', async () => {
    const { b, id } = await challenge();
    for (const code of ['12345', '1234567', 'abcdef', '12 456']) {
      expect((await b.post(OTP, { challengeId: id, code })).statusCode).toBe(400);
    }
    expect((await h.db.otpChallenge.findUniqueOrThrow({ where: { id } })).attempts).toBe(0);
  });
});
