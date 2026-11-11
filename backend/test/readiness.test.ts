import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { Db } from '../src/db/client.js';
import { expectedMigration, healthRoutes, type ReadinessResponse } from '../src/routes/health.js';
import { buildTestApp } from './helpers.js';
import { TEST_DB_URL } from './support.js';

/*
 * EP43 readiness (GET /health/ready): liveness says the process answers; readiness says it may
 * serve — the database answers in time and carries exactly this build's migrations. Statuses
 * only: no host, database name, migration name or error text ever leaves the endpoint.
 */

const LATEST = expectedMigration();
const fakeDb = (rows: unknown[] | Error, delayMs = 0) =>
  ({
    $queryRaw: () =>
      new Promise((resolve, reject) =>
        setTimeout(() => (rows instanceof Error ? reject(rows) : resolve(rows)), delayMs),
      ),
  }) as unknown as Db;
async function probe(
  db: Db | null,
  expected: string | null = '20261111090100_ep41_history_immutability',
) {
  const app = Fastify();
  await app.register(healthRoutes, { environment: 'test', db, expected });
  const res = await app.inject({ method: 'GET', url: '/health/ready' });
  await app.close();
  return res;
}

describe('GET /health/ready (EP43)', () => {
  it('this build knows its newest migration', () => {
    expect(LATEST).toMatch(/^\d{14}_/);
  });

  it.skipIf(!TEST_DB_URL)('ready on the migrated test database (real PostgreSQL)', async () => {
    const app = await buildTestApp({ DATABASE_URL: TEST_DB_URL! });
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ready', checks: { database: 'ok', schema: 'ok' } });
    expect(res.headers['cache-control']).toBe('no-store');
    await app.close();
  });

  it('not ready (503) when the database is unreachable, slow, behind or ahead — statuses only', async () => {
    const down = await probe(
      fakeDb(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret')),
    );
    expect(down.statusCode).toBe(503);
    expect(down.json()).toMatchObject({ status: 'not_ready', checks: { database: 'unavailable' } });
    expect(down.body).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|5432|secret|password/);

    const slow = await probe(fakeDb([{ name: 'x', pending: 0n }], 2600));
    expect(slow.json<ReadinessResponse>().checks.database).toBe('unavailable');

    const behind = await probe(fakeDb([{ name: '20261101000000_old', pending: 0n }]));
    expect(behind.statusCode).toBe(503);
    expect(behind.json<ReadinessResponse>().checks).toEqual({ database: 'ok', schema: 'behind' });
    expect(behind.body).not.toContain('20261101000000_old');

    const pending = await probe(
      fakeDb([{ name: '20261111090100_ep41_history_immutability', pending: 1n }]),
    );
    expect(pending.json<ReadinessResponse>().checks.schema).toBe('behind');

    const ahead = await probe(fakeDb([{ name: '20991231000000_future', pending: 0n }]));
    expect(ahead.json<ReadinessResponse>().checks.schema).toBe('ahead');

    const none = await probe(null);
    expect(none.statusCode).toBe(503);
    expect(none.json<ReadinessResponse>().checks.database).toBe('not_configured');
    // The plain test app has no database: not ready, said plainly.
    const bare = await buildTestApp();
    expect((await bare.inject({ method: 'GET', url: '/health/ready' })).statusCode).toBe(503);
    await bare.close();
  });

  it('ready only when database and schema agree', async () => {
    const ok = await probe(
      fakeDb([{ name: '20261111090100_ep41_history_immutability', pending: 0n }]),
    );
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ status: 'ready', checks: { database: 'ok', schema: 'ok' } });
  });
});
