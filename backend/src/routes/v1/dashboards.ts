import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireSession } from '../../auth/http.js';
import { DashboardService } from '../../dashboards/service.js';
import type { Db } from '../../db/client.js';
import { parseInput } from '../../lib/validation.js';

/*
 * EP47 department dashboards — docs/EP47_METRIC_DEFINITIONS.md. Read-only.
 *
 * /api/v1/dashboards
 *   GET /               the dashboards this person may open in the selected branch
 *   GET /:department    one department's metrics and work queues
 *                       (sales | operations | warehouse | purchasing | accounting)
 *
 * The company and branch always come from the session (requireOperationsContext);
 * the request names neither — any query parameter (e.g. a forged companyId or
 * branchId) is refused with 400. There is no write route here.
 */

const NoQuery = z.object({}).strict();
const Params = z
  .object({
    department: z
      .string()
      .max(20)
      .transform((v) => v.toUpperCase()),
  })
  .strict();

export const dashboardRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const s = new DashboardService(db);

  app.get('/', async (r) => {
    parseInput(NoQuery, r.query);
    return s.index(requireAuth(r));
  });
  app.get('/:department', async (r) => {
    parseInput(NoQuery, r.query);
    return s.dashboard(requireAuth(r), parseInput(Params, r.params).department);
  });
  return Promise.resolve();
};
