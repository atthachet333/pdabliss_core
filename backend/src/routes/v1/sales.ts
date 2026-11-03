import type { FastifyPluginAsync } from 'fastify';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import { IdParams } from '../../company/input.js';
import type { Db } from '../../db/client.js';
import { parseInput } from '../../lib/validation.js';
import {
  CreateSoBody,
  SoItemQuery,
  SoLinesBody,
  SoListQuery,
  SoReasonBody,
  UpdateSoBody,
} from '../../sales/input.js';
import { SalesOrderService } from '../../sales/service.js';

/*
 * Sales orders (EP33) — docs/SALES_ORDER.md. Session required; responses are
 * Sales allow-lists (selling terms, never cost or margin). Nothing here writes
 * stock: availability is read from the ledger and is not a reservation.
 *
 * /api/v1/sales
 *   GET    /context                    capabilities, branches, operational counts
 *   GET    /items?q=&branchId=         items for a line, with the branch's available quantity
 *   GET    /orders                     list (?status, branchId, customerId, availability=SHORTAGE, from, to, q, pages)
 *   POST   /orders {customerId, orderDate?, requestedDate?, customerReference?, note?, lines?}   DRAFT (201)
 *   GET    /orders/:id                 the order (lines, availability, timeline, actions)
 *   PATCH  /orders/:id                 DRAFT header
 *   PUT    /orders/:id/lines {lines}   DRAFT lines, replaced whole
 *   POST   /orders/:id/submit          DRAFT → SUBMITTED
 *   POST   /orders/:id/confirm         SUBMITTED → CONFIRMED (manager; no stock effect)
 *   POST   /orders/:id/cancel {reason?}  → CANCELLED (reason required once submitted)
 * Customers are searched through /api/v1/master-data/customers (sales.customers.view).
 */

export const salesRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const s = new SalesOrderService(db);
  const auth = requireAuth;
  const meta = requestMeta;
  const idOf = (params: unknown) => parseInput(IdParams, params).id;
  const body = { bodyLimit: 64 * 1024 };
  const small = { bodyLimit: 4 * 1024 };
  const O = '/orders';

  app.get('/context', async (r) => s.context(auth(r)));
  app.get('/items', async (r) => s.items(auth(r), parseInput(SoItemQuery, r.query)));
  app.get(O, async (r) => s.list(auth(r), parseInput(SoListQuery, r.query)));
  app.post(O, body, async (r, reply) =>
    reply.status(201).send(await s.create(auth(r), parseInput(CreateSoBody, r.body), meta(r))),
  );
  app.get(`${O}/:id`, async (r) => s.get(auth(r), idOf(r.params)));
  app.patch(`${O}/:id`, small, async (r) =>
    s.update(auth(r), idOf(r.params), parseInput(UpdateSoBody, r.body), meta(r)),
  );
  app.put(`${O}/:id/lines`, body, async (r) =>
    s.saveLines(auth(r), idOf(r.params), parseInput(SoLinesBody, r.body).lines, meta(r)),
  );
  app.post(`${O}/:id/submit`, async (r) => s.submit(auth(r), idOf(r.params), meta(r)));
  app.post(`${O}/:id/confirm`, async (r) => s.confirm(auth(r), idOf(r.params), meta(r)));
  app.post(`${O}/:id/cancel`, small, async (r) =>
    s.cancel(
      auth(r),
      idOf(r.params),
      parseInput(SoReasonBody, r.body ?? {}).reason ?? null,
      meta(r),
    ),
  );
  return Promise.resolve();
};
