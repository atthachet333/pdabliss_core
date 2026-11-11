import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';

/*
 * EP44 — the trust boundary Cloudflare → tunnel connector (on this host) → CORE backend.
 * TRUST_PROXY=loopback trusts only a proxy on 127.0.0.1 / ::1; the client address is then the
 * right-most address that proxy reports. Anyone else's X-Forwarded-For is ignored.
 */

async function appWith(env: Record<string, string>) {
  const app = await buildApp(parseEnv({ NODE_ENV: 'test', ...env }));
  app.get('/ep44-ip', (request) => ({ ip: request.ip }));
  await app.ready();
  const ip = async (remoteAddress: string, xff?: string) =>
    (
      await app.inject({
        method: 'GET',
        url: '/ep44-ip',
        remoteAddress,
        headers: xff ? { 'x-forwarded-for': xff } : {},
      })
    ).json<{ ip: string }>().ip;
  return { app, ip };
}

describe('TRUST_PROXY (EP44)', () => {
  it('accepts none, loopback, or explicit IPs / CIDRs — and refuses "trust everyone"', () => {
    expect(parseEnv({ NODE_ENV: 'test' }).TRUST_PROXY).toBe(false);
    expect(parseEnv({ NODE_ENV: 'test', TRUST_PROXY: 'loopback' }).TRUST_PROXY).toEqual([
      'loopback',
    ]);
    expect(
      parseEnv({ NODE_ENV: 'test', TRUST_PROXY: '10.1.2.3, 192.168.10.0/24, ::1' }).TRUST_PROXY,
    ).toEqual(['10.1.2.3', '192.168.10.0/24', '::1']);
    for (const bad of ['true', '*', 'all', '2', 'cloudflare', '10.0.0.1/40', '999.1.1.1']) {
      expect(() => parseEnv({ NODE_ENV: 'test', TRUST_PROXY: bad }), bad).toThrow(/TRUST_PROXY/);
    }
  });

  it('default: the socket address is the client; forwarded headers are ignored', async () => {
    const { app, ip } = await appWith({});
    expect(await ip('127.0.0.1', '203.0.113.7')).toBe('127.0.0.1');
    await app.close();
  });

  it('loopback connector: the client is the address the connector appended; spoofing does not work', async () => {
    const { app, ip } = await appWith({ TRUST_PROXY: 'loopback' });
    // Cloudflare appends the real client after anything the client sent itself.
    expect(await ip('127.0.0.1', '203.0.113.7')).toBe('203.0.113.7');
    expect(await ip('127.0.0.1', '6.6.6.6, 203.0.113.7')).toBe('203.0.113.7');
    expect(await ip('::1', '198.51.100.20')).toBe('198.51.100.20');
    // A client reaching the backend directly (not through the trusted connector) cannot choose its IP.
    expect(await ip('198.51.100.9', '203.0.113.7')).toBe('198.51.100.9');
    await app.close();
  });

  it('behind the connector, each client has its own rate limit (not one shared bucket)', async () => {
    const app = await buildApp(
      parseEnv({ NODE_ENV: 'test', TRUST_PROXY: 'loopback', RATE_LIMIT_MAX: '2' }),
    );
    await app.ready();
    const hit = async (client: string) =>
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1',
          remoteAddress: '127.0.0.1',
          headers: { 'x-forwarded-for': client },
        })
      ).statusCode;
    expect([await hit('203.0.113.1'), await hit('203.0.113.1'), await hit('203.0.113.1')]).toEqual([
      200, 200, 429,
    ]);
    expect(await hit('203.0.113.2')).toBe(200);
    await app.close();

    // Without TRUST_PROXY the same traffic shares the proxy's single budget.
    const shared = await buildApp(parseEnv({ NODE_ENV: 'test', RATE_LIMIT_MAX: '2' }));
    await shared.ready();
    const codes = [];
    for (const c of ['203.0.113.1', '203.0.113.2', '203.0.113.3'])
      codes.push(
        (
          await shared.inject({
            method: 'GET',
            url: '/api/v1',
            remoteAddress: '127.0.0.1',
            headers: { 'x-forwarded-for': c },
          })
        ).statusCode,
      );
    expect(codes).toEqual([200, 200, 429]);
    await shared.close();
  });
});
