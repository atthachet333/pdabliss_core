import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireSession } from '../../auth/http.js';
import type { Db } from '../../db/client.js';
import { ExecutiveService } from '../../executive/service.js';
import { IdParams } from '../../company/input.js';
import { parseInput } from '../../lib/validation.js';

/*
 * EP48 Executive Command Center — docs/EP48_EXECUTIVE_REQUIREMENTS.md. Read-only.
 *
 * /api/v1/executive
 *   GET /overview?branch=all|<branchId>       the company overview (Owner / Executive only)
 *   GET /documents/:kind/:id                  one document's work item and related documents
 *                                             (kind: sales-order | purchase-order | production-order)
 *
 * The company always comes from the session. The only accepted parameter is `branch`
 * (validated against the person's own active branches — anything else 404); any other
 * query parameter (a forged companyId, a department, …) is 400. No write route exists.
 */

const OverviewQuery = z
  .object({ branch: z.union([z.literal('all'), z.string().min(1).max(40)]).optional() })
  .strict();
const NoQuery = z.object({}).strict();
const Kind = z.object({ kind: z.string().max(40) }).loose();

export const executiveRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const s = new ExecutiveService(db);

  app.get('/overview', async (r) => s.overview(requireAuth(r), parseInput(OverviewQuery, r.query)));
  app.get('/documents/:kind/:id', async (r) => {
    parseInput(NoQuery, r.query);
    const { kind } = parseInput(Kind, r.params);
    const { id } = parseInput(IdParams, { id: (r.params as { id?: unknown }).id });
    return s.trace(requireAuth(r), kind, id);
  });
  return Promise.resolve();
};
