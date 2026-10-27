import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  Browser,
  createHarness,
  createUser,
  describeDb,
  PASSWORD,
  resetDb,
  signIn,
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
    b.post('/api/v1/auth/register', {
      password: PASSWORD,
      fullName: 'สมชาย ใจดี',
      phone: '081-234-5678',
      business: { companyName: 'Test Co', industry: 'SERVICES', teamSize: 'SIZE_1_10' },
      acceptTerms: true,
      ...body,
    });

  it('creates a pending account and emails a verification link from notify@pdabliss.com', async () => {
    const res = await register(new Browser(h.app), {
      email: 'new.person@example.com',
      fullName: 'New Person',
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
      fullName: 'x'.repeat(20_000),
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
    await b.post('/api/v1/auth/register', {
      email,
      password: PASSWORD,
      fullName: 'Verify Person',
      phone: '0812345678',
      business: { companyName: 'Test Co', industry: 'SERVICES', teamSize: 'SIZE_1_10' },
      acceptTerms: true,
    });
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

describeDb('registration profile (EP24.1)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
  });

  const base = {
    email: 'profile@example.com',
    password: PASSWORD,
    fullName: '  สมหญิง   รักงาน ',
    phone: '081-234-5678',
    business: {
      companyName: 'บริษัท ตัวอย่าง จำกัด',
      industry: 'DISTRIBUTION',
      teamSize: 'SIZE_11_50',
    },
    acceptTerms: true,
  };
  const register = (body: Record<string, unknown>) =>
    new Browser(h.app).post('/api/v1/auth/register', body);
  const fieldsOf = (res: { json(): { error: { details?: unknown } } }) =>
    ((res.json().error.details ?? []) as { path: string }[]).map((d) => d.path);

  it('stores the person: normalized full name, E.164 phone and the optional job function', async () => {
    expect((await register({ ...base, jobFunction: 'ACCOUNTING' })).statusCode).toBe(202);
    const user = await h.db.user.findUniqueOrThrow({
      where: { emailNormalized: 'profile@example.com' },
    });
    expect(user).toMatchObject({
      fullName: 'สมหญิง รักงาน',
      phone: '+66812345678',
      jobFunction: 'ACCOUNTING',
    });
  });

  it('accepts Thai and international phone formats and normalizes them', async () => {
    const cases: [string, string][] = [
      ['0812345678', '+66812345678'],
      ['02 123 4567', '+6621234567'],
      ['+66 81 234 5678', '+66812345678'],
      ['(081) 234.5678', '+66812345678'],
      ['+1 415 555 0100', '+14155550100'],
      ['0044 20 7946 0958', '+442079460958'],
    ];
    for (const [i, [input, stored]] of cases.entries()) {
      const email = `phone${i}@example.com`;
      const res = await register({ ...base, email, phone: input });
      expect(res.statusCode, `${input}: ${res.body}`).toBe(202);
      const user = await h.db.user.findUniqueOrThrow({ where: { emailNormalized: email } });
      expect(user.phone).toBe(stored);
    }
  });

  it('requires a real full name and a valid phone, with field-level errors', async () => {
    for (const body of [
      { ...base, fullName: undefined },
      { ...base, fullName: ' ' },
      { ...base, fullName: 'A' },
      { ...base, fullName: '12345' },
      { ...base, fullName: '<b>Admin</b>' },
    ]) {
      const res = await register(body);
      expect(res.statusCode, JSON.stringify(body.fullName)).toBe(400);
      expect(fieldsOf(res)).toContain('fullName');
    }
    for (const phone of [
      undefined,
      '',
      '12345',
      '081-234',
      'call me',
      '+66 0812345678',
      '+0123456789',
    ]) {
      const res = await register({ ...base, phone });
      expect(res.statusCode, String(phone)).toBe(400);
      expect(fieldsOf(res)).toContain('phone');
    }
    expect((await register({ ...base, jobFunction: 'CEO' })).statusCode).toBe(400);
    expect(await h.db.user.count()).toBe(0);
  });

  it('refuses injected fields: roles, company, status, the old displayName', async () => {
    for (const extra of [
      { role: 'COMPANY_OWNER' },
      { platformRole: 'PLATFORM_OWNER' },
      { companyRole: 'SYSTEM_ADMIN' },
      { companyId: 'c1' },
      { status: 'ACTIVE' },
      { emailVerified: true },
      { displayName: 'Nick' },
      { phoneVerified: true },
    ]) {
      expect((await register({ ...base, ...extra })).statusCode, JSON.stringify(extra)).toBe(400);
    }
    expect(await h.db.user.count()).toBe(0);
  });

  it('a job function never grants anything: no role, no company, no platform access', async () => {
    await register({ ...base, jobFunction: 'OWNER' });
    const token = tokenFrom(h.mailer, 'profile@example.com', 'verify_email');
    const b = new Browser(h.app);
    await b.post('/api/v1/auth/verify-email', { token });
    const signedIn = await signIn(h, 'profile@example.com', { browser: b });
    const me = (await signedIn.get('/api/v1/auth/me')).json().identity;
    expect(me).toMatchObject({
      platformRole: null,
      company: null,
      user: { fullName: 'สมหญิง รักงาน', phone: '+66812345678', jobFunction: 'OWNER' },
    });
    expect(await h.db.companyMember.count()).toBe(0);
    expect(await h.db.platformRoleAssignment.count()).toBe(0);
    expect((await signedIn.get('/api/v1/platform/companies')).statusCode).toBe(403);
    expect((await signedIn.get('/api/v1/company/current')).statusCode).toBe(404);
  });

  it('registering an existing address changes nothing about that account', async () => {
    await createUser(h.db, 'profile@example.com');
    await register({ ...base, fullName: 'Someone Else', phone: '0899999999' });
    const user = await h.db.user.findUniqueOrThrow({
      where: { emailNormalized: 'profile@example.com' },
    });
    expect(user.fullName).toBeNull();
    expect(user.phone).toBeNull();
  });
});

describeDb('registration business context (EP24.1)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
  });

  const business = {
    companyName: '  บริษัท สยามเทรด จำกัด ',
    industry: 'DISTRIBUTION',
    teamSize: 'SIZE_51_200',
    preferredContact: 'LINE',
    lineId: '@siamtrade',
    interests: ['WAREHOUSE', 'PURCHASING', 'WAREHOUSE'],
    note: 'สต็อกไม่ตรงกับบัญชีทุกสิ้นเดือน',
  };
  const register = (b: Record<string, unknown>, email = 'lead@example.com') =>
    new Browser(h.app).post('/api/v1/auth/register', {
      email,
      password: PASSWORD,
      fullName: 'ผู้ติดต่อ ทดสอบ',
      phone: '0812345678',
      acceptTerms: true,
      business: b,
    });

  it('stores the business context with the person — not as a company', async () => {
    expect((await register(business)).statusCode).toBe(202);
    const user = await h.db.user.findUniqueOrThrow({
      where: { emailNormalized: 'lead@example.com' },
      include: { signupContext: true, companyMember: true },
    });
    expect(user.signupContext).toMatchObject({
      companyName: 'บริษัท สยามเทรด จำกัด',
      industry: 'DISTRIBUTION',
      teamSize: 'SIZE_51_200',
      preferredContact: 'LINE',
      lineId: '@siamtrade',
      interests: ['WAREHOUSE', 'PURCHASING'],
      note: 'สต็อกไม่ตรงกับบัญชีทุกสิ้นเดือน',
    });
    // Lead information never creates or claims a CORE company.
    expect(user.companyMember).toBeNull();
    expect(await h.db.company.count()).toBe(0);
  });

  it('defaults to email contact and no interests; the note is optional', async () => {
    const res = await register({
      companyName: 'Minimal Co',
      industry: 'OTHER',
      teamSize: 'SIZE_1_10',
    });
    expect(res.statusCode, res.body).toBe(202);
    const ctx = await h.db.accountSignupContext.findFirstOrThrow();
    expect(ctx).toMatchObject({
      preferredContact: 'EMAIL',
      interests: [],
      note: null,
      lineId: null,
    });
  });

  it('requires the business basics and refuses unknown or server-decided fields', async () => {
    const bad = [
      undefined,
      { ...business, companyName: '' },
      { ...business, industry: 'BANKING' },
      { ...business, teamSize: '1000' },
      { ...business, preferredContact: 'LINE', lineId: undefined },
      { ...business, lineId: 'not a line id!' },
      { ...business, interests: ['PAYROLL'] },
      { ...business, note: 'x'.repeat(1001) },
      { ...business, plan: 'PROFESSIONAL' },
      { ...business, companyId: 'c1' },
      { ...business, departments: ['SALES'] },
    ];
    for (const b of bad) {
      expect((await register(b as Record<string, unknown>)).statusCode, JSON.stringify(b)).toBe(
        400,
      );
    }
    expect(await h.db.user.count()).toBe(0);
  });

  it('the account holder sees it; platform inspection shows it as sign-up context', async () => {
    await register(business);
    const token = tokenFrom(h.mailer, 'lead@example.com', 'verify_email');
    const b = new Browser(h.app);
    await b.post('/api/v1/auth/verify-email', { token });
    const me = await signIn(h, 'lead@example.com', { browser: b });
    const identity = (await me.get('/api/v1/auth/me')).json().identity;
    expect(identity.user.signup).toMatchObject({
      companyName: 'บริษัท สยามเทรด จำกัด',
      interests: ['WAREHOUSE', 'PURCHASING'],
    });
    await createUser(h.db, 'admin@pdabliss.test', { platformRole: 'PLATFORM_ADMIN' });
    const op = await signIn(h, 'admin@pdabliss.test');
    const users = (await op.get('/api/v1/platform/users')).json<{
      users: { email: string; signup: unknown }[];
    }>().users;
    expect(users.find((u) => u.email === 'lead@example.com')?.signup).toMatchObject({
      companyName: 'บริษัท สยามเทรด จำกัด',
      industry: 'DISTRIBUTION',
    });
  });

  it('an existing address keeps its own context; nothing is overwritten', async () => {
    await register(business);
    await register({ ...business, companyName: 'Someone Else Co' });
    expect(await h.db.accountSignupContext.count()).toBe(1);
    expect((await h.db.accountSignupContext.findFirstOrThrow()).companyName).toBe(
      'บริษัท สยามเทรด จำกัด',
    );
  });
});
