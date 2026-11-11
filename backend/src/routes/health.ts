import fs from 'node:fs';
import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../db/client.js';
import { APP_VERSION, SERVICE_NAME } from '../meta.js';

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

/** EP43 readiness: statuses only — never a host, database name, migration name or error text. */
export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  checks: {
    database: 'ok' | 'unavailable' | 'not_configured';
    /** ok = the database has exactly the migrations this build ships; else behind / ahead / unknown. */
    schema: 'ok' | 'behind' | 'ahead' | 'unknown';
  };
  timestamp: string;
}

const PROBE_TIMEOUT_MS = 2000;
const CACHE_MS = 5000;

/** The newest migration this build ships (backend/prisma/migrations), read once at start. */
export function expectedMigration(
  dir: URL = new URL('../../prisma/migrations/', import.meta.url),
): string | null {
  try {
    const names = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
      .map((d) => d.name)
      .sort();
    return names.at(-1) ?? null;
  } catch {
    return null;
  }
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms).unref()),
  ]);

export const healthRoutes: FastifyPluginAsync<{
  environment: string;
  db?: Db | null;
  expected?: string | null;
}> = async (app, opts) => {
  /** Liveness: the process answers. It does not touch the database. */
  app.get('/health', { config: { rateLimit: false } }, (): HealthResponse => {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: APP_VERSION,
      environment: opts.environment,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  });

  /**
   * EP43 readiness: may this instance serve requests? The database must answer within 2 s
   * and carry exactly the migrations this build expects. 200 when ready, 503 otherwise. The
   * probe result is reused for 5 s and the route stays rate-limited, so a public caller
   * cannot turn it into database load.
   */
  const expected = opts.expected === undefined ? expectedMigration() : opts.expected;
  let cached: { at: number; body: ReadinessResponse } | null = null;
  app.get('/health/ready', async (_request, reply) => {
    void reply.header('cache-control', 'no-store');
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return reply.code(cached.body.status === 'ready' ? 200 : 503).send(cached.body);
    }
    const checks: ReadinessResponse['checks'] = { database: 'not_configured', schema: 'unknown' };
    if (opts.db) {
      try {
        const rows = await withTimeout(
          opts.db.$queryRaw<{ name: string | null; pending: bigint }[]>`
            SELECT max(migration_name) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS name,
                   count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS pending
            FROM _prisma_migrations`,
          PROBE_TIMEOUT_MS,
        );
        checks.database = 'ok';
        const applied = rows[0]?.name ?? null;
        if (!expected || !applied) checks.schema = 'unknown';
        else if (Number(rows[0]?.pending ?? 0) > 0 || applied < expected) checks.schema = 'behind';
        else if (applied > expected) checks.schema = 'ahead';
        else checks.schema = 'ok';
      } catch {
        checks.database = 'unavailable';
      }
    }
    const body: ReadinessResponse = {
      status: checks.database === 'ok' && checks.schema === 'ok' ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    };
    cached = { at: Date.now(), body };
    return reply.code(body.status === 'ready' ? 200 : 503).send(body);
  });
  return Promise.resolve();
};
