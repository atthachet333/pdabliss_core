import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { sha256 } from '../src/auth/crypto.js';
import {
  Browser,
  codeFrom,
  createHarness,
  createUser,
  describeDb,
  PASSWORD,
  resetDb,
  signIn,
  tokenFrom,
  type Harness,
} from './support.js';

describeDb('sessions (EP23)', () => {
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

  it('sets an HttpOnly, SameSite=Lax session cookie and stores only its hash', async () => {
    const b = new Browser(h.app);
    const login = await b.post('/api/v1/auth/login', {
      email: 'member@example.com',
      password: PASSWORD,
    });
    const res = await b.post('/api/v1/auth/login/otp', {
      challengeId: login.json().challenge.id,
      code: codeFrom(h.mailer, 'member@example.com'),
    });
    const cookie = (
      res.cookies as {
        name: string;
        httpOnly?: boolean;
        sameSite?: string;
        path?: string;
        maxAge?: number;
      }[]
    ).find((c) => c.name === 'core_sid')!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(cookie.maxAge).toBe(30 * 24 * 3600);
    const token = b.cookies.get('core_sid')!;
    const session = await h.db.session.findFirstOrThrow();
    expect(session.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(session)).not.toContain(token);
    expect(res.body).not.toContain(token);
  });

  it('/me returns safe identity fields only', async () => {
    const b = await signIn(h, 'member@example.com');
    const res = await b.get('/api/v1/auth/me');
    expect(res.statusCode).toBe(200);
    const body = res.body;
    for (const secret of ['passwordHash', 'tokenHash', 'codeHash', 'argon2', 'subjectHash']) {
      expect(body).not.toContain(secret);
    }
    expect(res.json().identity.company).toBeNull();
  });

  it('rejects a missing, forged or oversized token', async () => {
    const b = new Browser(h.app);
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(401);
    b.cookies.set('core_sid', 'forged-token-forged-token-forged-token-000');
    expect((await b.get('/api/v1/auth/me')).json().error.code).toBe('UNAUTHENTICATED');
    b.cookies.set('core_sid', 'x'.repeat(4000));
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(401);
  });

  it('expires on idle timeout and on the absolute limit', async () => {
    const b = await signIn(h, 'member@example.com');
    await h.db.session.updateMany({ data: { idleExpiresAt: new Date(Date.now() - 1) } });
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(401);
    const c = await signIn(h, 'member@example.com');
    await h.db.session.updateMany({
      where: { revokedAt: null, idleExpiresAt: { gt: new Date() } },
      data: { absoluteExpiresAt: new Date(Date.now() - 1) },
    });
    expect((await c.get('/api/v1/auth/me')).statusCode).toBe(401);
  });

  it('logout revokes the session server-side (a copied cookie stops working)', async () => {
    const b = await signIn(h, 'member@example.com');
    const copy = new Browser(h.app);
    copy.cookies.set('core_sid', b.cookies.get('core_sid')!);
    expect((await b.post('/api/v1/auth/logout')).statusCode).toBe(200);
    expect(b.cookies.has('core_sid')).toBe(false);
    expect((await copy.get('/api/v1/auth/me')).statusCode).toBe(401);
    expect((await h.db.session.findFirstOrThrow()).revokeReason).toBe('LOGOUT');
  });

  it('logout-all ends every session of the account', async () => {
    const one = await signIn(h, 'member@example.com');
    const two = await signIn(h, 'member@example.com');
    await createUser(h.db, 'other@example.com');
    const other = await signIn(h, 'other@example.com');
    expect((await one.post('/api/v1/auth/logout-all')).statusCode).toBe(200);
    expect((await one.get('/api/v1/auth/me')).statusCode).toBe(401);
    expect((await two.get('/api/v1/auth/me')).statusCode).toBe(401);
    expect((await other.get('/api/v1/auth/me')).statusCode).toBe(200);
  });

  it('lists own sessions and revokes one; another account’s session id is not found', async () => {
    const one = await signIn(h, 'member@example.com');
    const two = await signIn(h, 'member@example.com');
    const list = (await one.get('/api/v1/auth/sessions')).json().sessions as {
      id: string;
      current: boolean;
    }[];
    expect(list).toHaveLength(2);
    expect(list.filter((s) => s.current)).toHaveLength(1);
    const twoId = list.find((s) => !s.current)!.id;
    expect((await one.delete(`/api/v1/auth/sessions/${twoId}`)).statusCode).toBe(200);
    expect((await two.get('/api/v1/auth/me')).statusCode).toBe(401);

    await createUser(h.db, 'other@example.com');
    const other = await signIn(h, 'other@example.com');
    const otherId = (await other.get('/api/v1/auth/me')).json().identity.session.id;
    expect((await one.delete(`/api/v1/auth/sessions/${otherId}`)).statusCode).toBe(404);
    expect((await other.get('/api/v1/auth/me')).statusCode).toBe(200);
  });

  it('rotates an old token on /me, with a short grace period for the previous one', async () => {
    const b = await signIn(h, 'member@example.com');
    const before = b.cookies.get('core_sid')!;
    await h.db.session.updateMany({ data: { rotatedAt: new Date(Date.now() - 13 * 3600_000) } });
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(200);
    const after = b.cookies.get('core_sid')!;
    expect(after).not.toBe(before);

    const old = new Browser(h.app);
    old.cookies.set('core_sid', before);
    expect((await old.get('/api/v1/auth/me')).statusCode).toBe(200);
    await h.db.session.updateMany({ data: { previousValidUntil: new Date(Date.now() - 1) } });
    expect((await old.get('/api/v1/auth/me')).statusCode).toBe(401);
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(200);
  });

  it('a suspended account loses its live sessions immediately', async () => {
    const b = await signIn(h, 'member@example.com');
    await h.db.user.updateMany({ data: { status: 'SUSPENDED' } });
    expect((await b.get('/api/v1/auth/me')).statusCode).toBe(401);
  });
});

describeDb('forgot / reset password (EP23)', () => {
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

  const NEW_PASSWORD = 'a brand new passphrase 2026';
  const forgot = (email: string) =>
    new Browser(h.app).post('/api/v1/auth/password/forgot', { email });

  it('answers the same for known and unknown addresses; mails only the real account', async () => {
    const known = await forgot('member@example.com');
    const unknown = await forgot('nobody@example.com');
    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(known.body).toBe(unknown.body);
    expect(h.mailer.sent.map((m) => m.to)).toEqual(['member@example.com']);
    expect(h.mailer.sent[0]!.text).toMatch(/\/reset-password\?lang=th#token=/);
  });

  it('resets with a valid link, ends every session, and the new password works', async () => {
    const signedIn = await signIn(h, 'member@example.com', { trustDevice: true });
    await forgot('member@example.com');
    const token = tokenFrom(h.mailer, 'member@example.com', 'password_reset');
    const b = new Browser(h.app);
    expect((await b.post('/api/v1/auth/password/reset/check', { token })).json()).toEqual({
      status: 'valid',
    });
    const res = await b.post('/api/v1/auth/password/reset', { token, password: NEW_PASSWORD });
    expect(res.statusCode).toBe(200);

    expect((await signedIn.get('/api/v1/auth/me')).statusCode).toBe(401);
    expect(await h.db.trustedDevice.count({ where: { revokedAt: null } })).toBe(0);
    expect(h.mailer.last('member@example.com', 'password_changed')).toBeDefined();

    const old = await new Browser(h.app).post('/api/v1/auth/login', {
      email: 'member@example.com',
      password: PASSWORD,
    });
    expect(old.statusCode).toBe(401);
    await signIn(h, 'member@example.com', { password: NEW_PASSWORD });
    const events = (await h.db.authAuditEvent.findMany()).map((e) => e.type);
    expect(events).toContain('PASSWORD_RESET_REQUEST');
    expect(events).toContain('PASSWORD_RESET_SUCCESS');
  });

  it('cancels a code that was pending when the password changed', async () => {
    const b = new Browser(h.app);
    const login = await b.post('/api/v1/auth/login', {
      email: 'member@example.com',
      password: PASSWORD,
    });
    const code = codeFrom(h.mailer, 'member@example.com');
    await forgot('member@example.com');
    await new Browser(h.app).post('/api/v1/auth/password/reset', {
      token: tokenFrom(h.mailer, 'member@example.com', 'password_reset'),
      password: NEW_PASSWORD,
    });
    const res = await b.post('/api/v1/auth/login/otp', {
      challengeId: login.json().challenge.id,
      code,
    });
    expect(res.statusCode).toBe(410);
  });

  it('rejects invalid, expired and reused links', async () => {
    const b = new Browser(h.app);
    expect(
      (
        await b.post('/api/v1/auth/password/reset', {
          token: 'y'.repeat(43),
          password: NEW_PASSWORD,
        })
      ).json().error.code,
    ).toBe('TOKEN_INVALID');

    await forgot('member@example.com');
    const token = tokenFrom(h.mailer, 'member@example.com', 'password_reset');
    await b.post('/api/v1/auth/password/reset', { token, password: NEW_PASSWORD });
    const reused = await b.post('/api/v1/auth/password/reset', {
      token,
      password: 'yet another passphrase',
    });
    expect(reused.statusCode).toBe(410);
    expect(reused.json().error.code).toBe('TOKEN_USED');

    await h.db.passwordResetToken.deleteMany();
    await forgot('member@example.com');
    const expiring = tokenFrom(h.mailer, 'member@example.com', 'password_reset');
    await h.db.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });
    expect(
      (await b.post('/api/v1/auth/password/reset/check', { token: expiring })).json().error.code,
    ).toBe('TOKEN_EXPIRED');
  });

  it('a newer request replaces the older link', async () => {
    await forgot('member@example.com');
    const first = tokenFrom(h.mailer, 'member@example.com', 'password_reset');
    await forgot('member@example.com');
    const second = tokenFrom(h.mailer, 'member@example.com', 'password_reset');
    const b = new Browser(h.app);
    expect(
      (await b.post('/api/v1/auth/password/reset', { token: first, password: NEW_PASSWORD }))
        .statusCode,
    ).toBe(410);
    expect(
      (await b.post('/api/v1/auth/password/reset', { token: second, password: NEW_PASSWORD }))
        .statusCode,
    ).toBe(200);
  });

  it('enforces the password policy and the per-account request cap', async () => {
    await forgot('member@example.com');
    const token = tokenFrom(h.mailer, 'member@example.com', 'password_reset');
    const weak = await new Browser(h.app).post('/api/v1/auth/password/reset', {
      token,
      password: 'short',
    });
    expect(weak.json().error.code).toBe('PASSWORD_POLICY');
    h.mailer.clear();
    await forgot('member@example.com');
    await forgot('member@example.com');
    await forgot('member@example.com');
    expect(h.mailer.sent).toHaveLength(2); // 3 per hour, one already used above
  });

  it('two concurrent resets with one link: exactly one succeeds', async () => {
    await forgot('member@example.com');
    const token = tokenFrom(h.mailer, 'member@example.com', 'password_reset');
    const [a, b] = await Promise.all([
      new Browser(h.app).post('/api/v1/auth/password/reset', { token, password: NEW_PASSWORD }),
      new Browser(h.app).post('/api/v1/auth/password/reset', {
        token,
        password: 'another new passphrase',
      }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 410]);
  });
});
