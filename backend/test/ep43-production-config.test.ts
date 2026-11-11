import { describe, expect, it } from 'vitest';
import { buildApp, loggerOptions } from '../src/app.js';
import { cookieNames, cookieOptions } from '../src/auth/http.js';
import type { ReadinessResponse } from '../src/routes/health.js';
import { DEV_AUTH_SECRET, parseEnv } from '../src/config/env.js';

/*
 * EP43 — production configuration fails closed (isolated: nothing here reaches a real database,
 * mail server or network service; the database host below does not resolve).
 */
const PRODUCTION = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://core_app:not-a-real-password@db.invalid:5432/pdabliss_core',
  PUBLIC_APP_URL: 'https://core.example.com',
  AUTH_SECRET: 'a-production-secret-that-is-long-enough-123',
  SMTP_HOST: 'smtp.example.com',
};

describe('production configuration (EP43)', () => {
  it('refuses to start without each required secret, or with the development secret', () => {
    for (const key of ['DATABASE_URL', 'PUBLIC_APP_URL', 'AUTH_SECRET', 'SMTP_HOST'] as const) {
      const env: Record<string, string> = { ...PRODUCTION };
      delete env[key];
      expect(() => parseEnv(env), key).toThrow(new RegExp(key));
    }
    expect(() => parseEnv({ ...PRODUCTION, AUTH_SECRET: DEV_AUTH_SECRET })).toThrow(/AUTH_SECRET/);
  });

  it('session cookies are __Host-, Secure, HttpOnly, SameSite=Lax in production', () => {
    const env = parseEnv(PRODUCTION);
    expect(cookieNames(env).session).toMatch(/^__Host-/);
    expect(cookieOptions(env, 1000)).toMatchObject({
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('logs redact authorization, cookies and set-cookie; no pretty printer in production', () => {
    const opts = loggerOptions(parseEnv(PRODUCTION)) as { redact: string[]; transport?: unknown };
    expect(opts.redact).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ]),
    );
    expect(opts.transport).toBeUndefined();
  });

  it('a production app: no proxy trust, no demo routes, and an unreachable database is "not ready" without detail', async () => {
    const app = await buildApp(parseEnv(PRODUCTION), { logger: false });
    app.get('/ep43-ip', (request) => ({ ip: request.ip }));
    await app.ready();
    // trustProxy is off: a client cannot choose its own address with X-Forwarded-For.
    const ip = await app.inject({
      method: 'GET',
      url: '/ep43-ip',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    expect(ip.json<{ ip: string }>().ip).not.toBe('203.0.113.9');
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/demo/warehouse/stock' })).statusCode,
    ).toBe(404);
    const live = await app.inject({ method: 'GET', url: '/health' });
    expect(live.json()).toMatchObject({ status: 'ok', environment: 'production' });
    const ready = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(ready.statusCode).toBe(503);
    expect(ready.json<ReadinessResponse>().checks.database).toBe('unavailable');
    expect(ready.body).not.toMatch(/db\.invalid|core_app|not-a-real-password|5432|pdabliss_core/);
    await app.close();
  }, 20_000);
});
