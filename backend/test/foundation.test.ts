import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { buildAuditEntry } from '../src/domain/audit/audit-entry.js';

const PRODUCTION = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://core@db.internal:5432/core',
  PUBLIC_APP_URL: 'https://core.example.com',
  AUTH_SECRET: 'a-production-secret-that-is-long-enough-123',
  SMTP_HOST: 'smtp.example.com',
};

describe('environment validation', () => {
  it('applies defaults for local development', () => {
    const env = parseEnv({});
    expect(env.PORT).toBe(1112);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:1111']);
    expect(env.ENABLE_DEMO_ROUTES).toBe(true);
  });

  it('disables demo routes by default in production', () => {
    expect(parseEnv(PRODUCTION).ENABLE_DEMO_ROUTES).toBe(false);
  });

  it('rejects invalid configuration with readable issues', () => {
    expect(() => parseEnv({ PORT: 'abc', CORS_ORIGINS: 'not-a-url' })).toThrow(/PORT/);
  });
});

describe('audit entries', () => {
  it('records only changed fields with before/after values', () => {
    const entry = buildAuditEntry({
      actorId: 'u_1',
      action: 'purchase_request.approve',
      entityType: 'PurchaseRequest',
      entityId: 'pr_1',
      requestId: 'req-1',
      before: { status: 'submitted', note: 'x', approvedBy: null },
      after: { status: 'approved', note: 'x', approvedBy: 'u_1' },
      now: new Date('2026-10-21T00:00:00Z'),
    });
    expect(entry.changes).toEqual([
      { field: 'approvedBy', before: null, after: 'u_1' },
      { field: 'status', before: 'submitted', after: 'approved' },
    ]);
    expect(entry.occurredAt).toBe('2026-10-21T00:00:00.000Z');
  });
});
