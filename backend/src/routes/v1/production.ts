import type { FastifyPluginAsync } from 'fastify';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import { IdParams } from '../../company/input.js';
import type { Db } from '../../db/client.js';
import { parseInput } from '../../lib/validation.js';
import { BomService } from '../../production/bom.js';
import {
  BomListQuery,
  BranchQuery,
  CreateBomBody,
  CreateMoBody,
  DemandQuery,
  ItemQuery,
  MoListQuery,
  MoNoBody,
  MoReasonBody,
  PreviewQuery,
  UpdateBomBody,
  UpdateMoBody,
} from '../../production/input.js';
import { ProductionOrderService } from '../../production/service.js';

/*
 * Production planning (EP36) — docs/PRODUCTION_ORDER.md, docs/PRODUCTION_BOM.md.
 * Production lives in the Operations department. Session required; responses
 * are operational allow-lists (no price, cost, margin or customer). NOTHING
 * here writes, reserves or creates stock: material availability is read from
 * the ledger and is never a claim.
 *
 * /api/v1/production
 *   GET    /context                       capabilities, branches, counts
 *   GET    /items?role=OUTPUT|MATERIAL&q= production item picker (active stock items)
 *   GET    /boms                          BOM revisions (?status, itemId, q, pages)
 *   POST   /boms {itemId, outputQuantity, unitId?, note?, lines}   DRAFT revision (201)
 *   GET    /boms/:id                      revision, lines, other revisions, timeline, actions
 *   PATCH  /boms/:id                      DRAFT: output quantity, note, lines (replaced whole)
 *   POST   /boms/:id/activate             DRAFT → ACTIVE (supersedes the item's ACTIVE revision)
 *   POST   /boms/:id/retire {reason?}     DRAFT / ACTIVE → RETIRED (reason required when ACTIVE)
 *   POST   /boms/:id/revise               new DRAFT revision copying this one (201)
 *   GET    /orders                        list (?status, branchId, itemId, source, materials=SHORT|AVAILABLE, from, to, q, pages)
 *   POST   /orders                        DRAFT (manual: itemId[, branchId]; sales demand: salesOrderLineId) (201)
 *   GET    /orders/:id                    order, materials + availability, demand, timeline, actions
 *   PATCH  /orders/:id                    DRAFT: quantity, bomId, dates, priority, note
 *   POST   /orders/:id/submit|approve|release            transitions (no body)
 *   POST   /orders/:id/reject|cancel {reason?}           reason required to reject / cancel approved
 *   GET    /requirements/preview?bomId&quantity&branchId  computed requirements, nothing saved
 *   GET    /requirements?branchId         materials of the branch's submitted-or-later orders
 *   GET    /demand?branchId&q             confirmed sales demand eligible for production
 *
 * /api/v1/purchasing/production-shortages?branchId   (purchasing.production_shortages.view)
 */

export const productionRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const s = new ProductionOrderService(db);
  const b = new BomService(db);
  const auth = requireAuth;
  const meta = requestMeta;
  const idOf = (params: unknown) => parseInput(IdParams, params).id;
  const body = { bodyLimit: 64 * 1024 };
  const small = { bodyLimit: 4 * 1024 };
  const none = (r: { body: unknown }) => parseInput(MoNoBody, r.body ?? {});
  const reason = (r: { body: unknown }) => parseInput(MoReasonBody, r.body ?? {}).reason ?? null;

  app.get('/context', async (r) => s.context(auth(r)));
  app.get('/items', async (r) => b.items(auth(r), parseInput(ItemQuery, r.query)));

  app.get('/boms', async (r) => b.list(auth(r), parseInput(BomListQuery, r.query)));
  app.post('/boms', body, async (r, reply) =>
    reply.status(201).send(await b.create(auth(r), parseInput(CreateBomBody, r.body), meta(r))),
  );
  app.get('/boms/:id', async (r) => b.get(auth(r), idOf(r.params)));
  app.patch('/boms/:id', body, async (r) =>
    b.update(auth(r), idOf(r.params), parseInput(UpdateBomBody, r.body), meta(r)),
  );
  app.post('/boms/:id/activate', small, async (r) => {
    none(r);
    return b.activate(auth(r), idOf(r.params), meta(r));
  });
  app.post('/boms/:id/retire', small, async (r) =>
    b.retire(auth(r), idOf(r.params), reason(r), meta(r)),
  );
  app.post('/boms/:id/revise', small, async (r, reply) => {
    none(r);
    return reply.status(201).send(await b.revise(auth(r), idOf(r.params), meta(r)));
  });

  const O = '/orders';
  app.get(O, async (r) => s.list(auth(r), parseInput(MoListQuery, r.query)));
  app.post(O, body, async (r, reply) =>
    reply.status(201).send(await s.create(auth(r), parseInput(CreateMoBody, r.body), meta(r))),
  );
  app.get(`${O}/:id`, async (r) => s.get(auth(r), idOf(r.params)));
  app.patch(`${O}/:id`, small, async (r) =>
    s.update(auth(r), idOf(r.params), parseInput(UpdateMoBody, r.body), meta(r)),
  );
  for (const action of ['submit', 'approve', 'release'] as const) {
    app.post(`${O}/:id/${action}`, small, async (r) => {
      none(r);
      return s[action](auth(r), idOf(r.params), meta(r));
    });
  }
  app.post(`${O}/:id/reject`, small, async (r) =>
    s.reject(auth(r), idOf(r.params), reason(r), meta(r)),
  );
  app.post(`${O}/:id/cancel`, small, async (r) =>
    s.cancel(auth(r), idOf(r.params), reason(r), meta(r)),
  );

  app.get('/requirements/preview', async (r) =>
    s.preview(auth(r), parseInput(PreviewQuery, r.query)),
  );
  app.get('/requirements', async (r) => s.requirements(auth(r), parseInput(BranchQuery, r.query)));
  app.get('/demand', async (r) => s.demand(auth(r), parseInput(DemandQuery, r.query)));
  return Promise.resolve();
};

/** The Purchasing handoff: read-only material shortages of approved production orders. */
export const productionShortageRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const s = new ProductionOrderService(db);
  app.get('/', async (r) => s.shortages(requireAuth(r), parseInput(BranchQuery, r.query)));
  return Promise.resolve();
};
