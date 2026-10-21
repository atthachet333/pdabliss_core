import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers.js';

describe('GET /health', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(() => app.close());

  it('reports a healthy API', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      service: 'pda-bliss-core-api',
      environment: 'test',
    });
  });

  it('assigns a request id and echoes a well-formed incoming one', async () => {
    const generated = await app.inject({ method: 'GET', url: '/health' });
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const echoed = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'upstream-req-12345' },
    });
    expect(echoed.headers['x-request-id']).toBe('upstream-req-12345');

    const rejected = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'bad id <script>' },
    });
    expect(rejected.headers['x-request-id']).not.toBe('bad id <script>');
  });

  it('sends security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the frontend origin via CORS and refuses others', async () => {
    const allowed = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:1111' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:1111');

    const denied = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('limits API routes but never the health check', async () => {
    const app = await buildTestApp({ RATE_LIMIT_MAX: '2' });
    const api = [];
    const health = [];
    for (let i = 0; i < 3; i++) {
      api.push((await app.inject({ method: 'GET', url: '/api/v1' })).statusCode);
      health.push((await app.inject({ method: 'GET', url: '/health' })).statusCode);
    }
    expect(api).toEqual([200, 200, 429]);
    expect(health).toEqual([200, 200, 200]);
    await app.close();
  });
});

describe('API v1 namespace and errors', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(() => app.close());

  it('exposes /api/v1', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ apiVersion: 'v1' });
  });

  it('returns a structured 404 envelope with the request id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string; requestId: string } }>();
    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers['x-request-id']);
  });
});
