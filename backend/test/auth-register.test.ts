import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  Browser,
  createHarness,
  createUser,
  describeDb,
  PASSWORD,
  resetDb,
  tokenFrom,
  type Harness,
} from './support.js';

describeDb('registration (EP23)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
  });

  const register = (b: Browser, body: Record<string, unknown>) =>
    b.post('/api/v1/auth/register', { password: PASSWORD, acceptTerms: true, ...body });

  it('creates a pending account and emails a verification link from notify@pdabliss.com', async () => {
    const res = await register(new Browser(h.app), {
      email: 'new.person@example.com',
      displayName: 'New Person',
      locale: 'en',
      plan: 'business',
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ status: 'verification_sent' });

    const user = await h.db.user.findUniqueOrThrow({
      where: { emailNormalized: 'new.person@example.com' },
      include: { credential: true, platformRole: true },
    });
    expect(user.status).toBe('PENDING_VERIFICATION');
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.planIntent).toBe('business');
    expect(user.platformRole).toBeNull();
    expect(user.credential?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(user.credential?.passwordHash).not.toContain(PASSWORD);

    const mail = h.mailer.last('new.person@example.com', 'verify_email')!;
    expect(mail.from).toBe('PDA BLISS CORE <notify@pdabliss.com>');
    expect(mail.subject).toMatch(/Verify your email/);
    expect(mail.text).toMatch(/^.*http:\/\/localhost:1111\/verify-email\?lang=en#token=/m);
    // The raw token is never stored.
    const token = tokenFrom(h.mailer, 'new.person@example.com', 'verify_email');
    const stored = await h.db.emailVerificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(stored.tokenHash).not.toBe(token);
  });

  it('normalizes the email: casing and spaces cannot create a second account', async () => {
    await register(new Browser(h.app), { email: '  Mixed.Case@Example.COM ' });
    const res = await register(new Browser(h.app), { email: 'mixed.case@example.com' });
    expect(res.statusCode).toBe(202);
    expect(await h.db.user.count()).toBe(1);
    const user = await h.db.user.findFirstOrThrow();
    expect(user.emailNormalized).toBe('mixed.case@example.com');
    expect(user.email).toBe('Mixed.Case@Example.COM');
  });

  it('answers a duplicate registration exactly like a new one, and mails the owner instead', async () => {
    await createUser(h.db, 'taken@example.com');
    const fresh = await register(new Browser(h.app), { email: 'fresh@example.com' });
    const dup = await register(new Browser(h.app), { email: 'TAKEN@example.com' });
    expect(dup.statusCode).toBe(fresh.statusCode);
    expect(dup.body).toBe(fresh.body);
    expect(await h.db.user.count({ where: { emailNormalized: 'taken@example.com' } })).toBe(1);
    expect(h.mailer.last('taken@example.com', 'existing_account')).toBeDefined();
    expect(h.mailer.last('taken@example.com', 'verify_email')).toBeUndefined();
  });

  it.each([
    ['short', 'too_short'],
    ['1234567890', 'too_common'],
    ['aaaaaaaaaaaaaa', 'too_common'],
    ['someone.long@example.com', 'contains_email'],
    ['x'.repeat(129), 'too_long'],
  ])('rejects the weak password %j (%s)', async (password, problem) => {
    const res = await register(new Browser(h.app), { email: 'someone.long@example.com', password });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatchObject({ code: 'PASSWORD_POLICY', details: { problem } });
    expect(await h.db.user.count()).toBe(0);
  });

  it('accepts a long passphrase', async () => {
    const res = await register(new Browser(h.app), {
      email: 'phrase@example.com',
      password: 'ฉันชอบกาแฟร้อนตอนเช้าที่ออฟฟิศนนทบุรี 2026',
    });
    expect(res.statusCode).toBe(202);
  });

  it.each(['not-an-email', 'a@', '@example.com', `${'a'.repeat(250)}@example.com`])(
    'rejects the malformed email %j',
    async (email) => {
      const res = await register(new Browser(h.app), { email });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_FAILED');
    },
  );

  it.each([
    { role: 'PLATFORM_OWNER' },
    { platformRole: 'PLATFORM_ADMIN' },
    { companyRole: 'COMPANY_OWNER' },
    { status: 'ACTIVE' },
    { emailVerifiedAt: '2026-01-01T00:00:00Z' },
  ])('refuses injected privileged fields %j — no account is created', async (extra) => {
    const res = await register(new Browser(h.app), { email: 'inject@example.com', ...extra });
    expect(res.statusCode).toBe(400);
    expect(await h.db.user.count()).toBe(0);
    expect(await h.db.platformRoleAssignment.count()).toBe(0);
  });

  it('requires accepting the terms and an allowed plan value', async () => {
    const b = new Browser(h.app);
    expect(
      (await b.post('/api/v1/auth/register', { email: 'x@example.com', password: PASSWORD }))
        .statusCode,
    ).toBe(400);
    expect((await register(b, { email: 'x@example.com', plan: 'free' })).statusCode).toBe(400);
  });

  it('refuses oversized payloads', async () => {
    const res = await register(new Browser(h.app), {
      email: 'big@example.com',
      displayName: 'x'.repeat(20_000),
    });
    expect(res.statusCode).toBe(413);
  });

  it('does not let an unverified account sign in', async () => {
    await register(new Browser(h.app), { email: 'pending@example.com' });
    const res = await new Browser(h.app).post('/api/v1/auth/login', {
      email: 'pending@example.com',
      password: PASSWORD,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

describeDb('email verification (EP23)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
  });

  async function registered(email = 'verify.me@example.com') {
    const b = new Browser(h.app);
    await b.post('/api/v1/auth/register', { email, password: PASSWORD, acceptTerms: true });
    return { b, token: tokenFrom(h.mailer, email, 'verify_email') };
  }

  it('verifies with the emailed link and activates the account', async () => {
    const { b, token } = await registered();
    const res = await b.post('/api/v1/auth/verify-email', { token });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'verified' });
    const user = await h.db.user.findFirstOrThrow();
    expect(user.status).toBe('ACTIVE');
    expect(user.emailVerifiedAt).not.toBeNull();
    // Verification does not sign anyone in.
    expect(b.cookies.size).toBe(0);
  });

  it('rejects an unknown token', async () => {
    const res = await new Browser(h.app).post('/api/v1/auth/verify-email', {
      token: 'x'.repeat(43),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TOKEN_INVALID');
  });

  it('rejects an expired token', async () => {
    const { b, token } = await registered();
    await h.db.emailVerificationToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await b.post('/api/v1/auth/verify-email', { token });
    expect(res.statusCode).toBe(410);
    expect(res.json().error.code).toBe('TOKEN_EXPIRED');
    expect((await h.db.user.findFirstOrThrow()).status).toBe('PENDING_VERIFICATION');
  });

  it('answers "already verified" when the link is used again', async () => {
    const { b, token } = await registered();
    await b.post('/api/v1/auth/verify-email', { token });
    const again = await b.post('/api/v1/auth/verify-email', { token });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ status: 'already_verified' });
  });

  it('resend replaces the previous link', async () => {
    const { b, token: first } = await registered();
    await h.db.emailVerificationToken.updateMany({
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    const res = await b.post('/api/v1/auth/verification/resend', {
      email: 'VERIFY.ME@example.com',
    });
    expect(res.statusCode).toBe(202);
    const second = tokenFrom(h.mailer, 'verify.me@example.com', 'verify_email');
    expect(second).not.toBe(first);
    expect((await b.post('/api/v1/auth/verify-email', { token: first })).statusCode).toBe(410);
    expect((await b.post('/api/v1/auth/verify-email', { token: second })).json()).toEqual({
      status: 'verified',
    });
  });

  it('resend is rate-limited per account and generic for unknown or verified addresses', async () => {
    const { b } = await registered();
    h.mailer.clear();
    // Within the cooldown: accepted, but nothing is sent.
    expect(
      (await b.post('/api/v1/auth/verification/resend', { email: 'verify.me@example.com' }))
        .statusCode,
    ).toBe(202);
    expect(h.mailer.sent).toHaveLength(0);
    const unknown = await b.post('/api/v1/auth/verification/resend', {
      email: 'nobody@example.com',
    });
    expect(unknown.statusCode).toBe(202);
    expect(unknown.json()).toEqual({ status: 'accepted' });
    await createUser(h.db, 'done@example.com');
    expect(
      (await b.post('/api/v1/auth/verification/resend', { email: 'done@example.com' })).statusCode,
    ).toBe(202);
    expect(h.mailer.sent).toHaveLength(0);
  });

  it('records audit events without secrets', async () => {
    const { b, token } = await registered();
    await b.post('/api/v1/auth/verify-email', { token });
    const events = await h.db.authAuditEvent.findMany({ orderBy: { occurredAt: 'asc' } });
    expect(events.map((e) => e.type)).toEqual([
      'REGISTER',
      'EMAIL_VERIFICATION_SENT',
      'EMAIL_VERIFIED',
    ]);
    const dump = JSON.stringify(events);
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(PASSWORD);
  });
});
