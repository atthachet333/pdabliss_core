import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  Browser,
  codeFrom,
  createHarness,
  describeDb,
  PASSWORD,
  resetDb,
  signIn,
  tokenFrom,
  type Harness,
} from './support.js';

/*
 * EP23 audit coverage: one account's whole journey must leave every required
 * event in AuthAuditEvent — and no password, code, token or cookie value.
 */

describeDb('auth audit trail (EP23)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
  });

  it('records every required event for a full journey, without secrets', async () => {
    const email = 'journey@example.com';
    const NEW_PASSWORD = 'a brand new passphrase 2026';
    const secrets: string[] = [PASSWORD, NEW_PASSWORD];

    // Register → verify.
    const first = new Browser(h.app);
    const reg = await first.post('/api/v1/auth/register', {
      email,
      password: PASSWORD,
      acceptTerms: true,
    });
    expect(reg.statusCode, reg.body).toBe(202);
    const verifyToken = tokenFrom(h.mailer, email, 'verify_email');
    secrets.push(verifyToken);
    expect((await first.post('/api/v1/auth/verify-email', { token: verifyToken })).statusCode).toBe(
      200,
    );

    // A wrong password, then a wrong code, then the right one.
    expect(
      (await first.post('/api/v1/auth/login', { email, password: 'not the password!' })).statusCode,
    ).toBe(401);
    const login = await first.post('/api/v1/auth/login', { email, password: PASSWORD });
    const challengeId = login.json().challenge.id;
    const code = codeFrom(h.mailer, email);
    secrets.push(code);
    const wrong = code === '000000' ? '000001' : '000000';
    expect(
      (await first.post('/api/v1/auth/login/otp', { challengeId, code: wrong })).statusCode,
    ).toBe(400);
    expect((await first.post('/api/v1/auth/login/otp', { challengeId, code })).statusCode).toBe(
      200,
    );
    secrets.push(first.cookies.get('core_sid')!);

    // A second browser; the first revokes it, then logs out; a third is ended by logout-all.
    const second = await signIn(h, email);
    secrets.push(second.cookies.get('core_sid')!);
    const sessions = (await first.get('/api/v1/auth/sessions')).json().sessions;
    const other = sessions.find((s) => !s.current)!;
    expect((await first.delete(`/api/v1/auth/sessions/${other.id}`)).statusCode).toBeLessThan(300);
    expect((await first.post('/api/v1/auth/logout')).statusCode).toBeLessThan(300);
    const third = await signIn(h, email);
    expect((await third.post('/api/v1/auth/logout-all')).statusCode).toBeLessThan(300);

    // Forgot → reset.
    const anon = new Browser(h.app);
    expect((await anon.post('/api/v1/auth/password/forgot', { email })).statusCode).toBe(202);
    const resetToken = tokenFrom(h.mailer, email, 'password_reset');
    secrets.push(resetToken);
    const reset = await anon.post('/api/v1/auth/password/reset', {
      token: resetToken,
      password: NEW_PASSWORD,
    });
    expect(reset.statusCode, reset.body).toBeLessThan(300);

    const events = await h.db.authAuditEvent.findMany({ orderBy: { occurredAt: 'asc' } });
    const types = new Set(events.map((e) => e.type));
    for (const required of [
      'REGISTER',
      'EMAIL_VERIFIED',
      'LOGIN_FAILURE',
      'OTP_SENT',
      'OTP_FAILURE',
      'OTP_SUCCESS',
      'LOGIN_SUCCESS',
      'SESSION_REVOKED',
      'LOGOUT',
      'LOGOUT_ALL',
      'PASSWORD_RESET_REQUEST',
      'PASSWORD_RESET_SUCCESS',
    ] as const) {
      expect(types, `missing ${required}`).toContain(required);
    }

    // Nothing secret in any stored event (metadata, user agent, everything).
    const dump = JSON.stringify(events);
    for (const s of secrets) expect(dump).not.toContain(s);
    // The failed sign-in is attributed by keyed hash, never by the typed address.
    const failure = events.find((e) => e.type === 'LOGIN_FAILURE')!;
    expect(failure.subjectHash).toBeTruthy();
    expect(JSON.stringify(failure.metadata)).not.toContain(email);
  });
});
