import type { FastifyPluginAsync } from 'fastify';
import { requireAuth, requireSession } from '../../auth/http.js';
import { requireOperationsContext } from '../../company/context.js';
import type { Db } from '../../db/client.js';

/*
 * /api/v1/operations — CORE Operations (EP25: the entry only).
 *
 * Every operational route of later episodes goes through
 * requireOperationsContext(): an active member of an active company, working
 * in a selected, still-active branch of that company, and then only in the
 * departments that are both enabled for the company and permitted for the
 * person. EP25 exposes just that context — no department workflow yet.
 */
export const operationsRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);

  app.get('/context', async (request) => requireOperationsContext(db, requireAuth(request)));

  return Promise.resolve();
};
