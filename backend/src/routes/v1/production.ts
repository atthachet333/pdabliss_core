import type { FastifyPluginAsync } from 'fastify';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import { DecisionBody } from '../../company/approval.js';
import { IdParams } from '../../company/input.js';
import type { Db } from '../../db/client.js';
import { parseInput } from '../../lib/validation.js';
import { z } from 'zod';
import { BomService } from '../../production/bom.js';
import { MaterialIssueService } from '../../production/issues.js';
import { OutputService } from '../../production/output.js';
import { FinishedGoodsService } from '../../production/receipts.js';
import {
  AcceptOutputBody,
  BomListQuery,
  BranchQuery,
  CompleteBody,
  CreateFgReceiptBody,
  CreateOutputBody,
  FgLinesBody,
  FgPendingQuery,
  FgReceiptListQuery,
  OptionalReasonBody,
  OutputListQuery,
  ReasonBody,
  ReviewBody,
  UpdateOutputBody,
  CreateBomBody,
  CreateIssueBody,
  ExcessBody,
  ExecutionBody,
  IssueLinesBody,
  IssueListQuery,
  UsageBody,
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
 * EP37 (docs/PRODUCTION_MATERIAL_RESERVATION.md, PRODUCTION_MATERIAL_ISSUE.md, PRODUCTION_EXECUTION.md):
 *   POST   /orders/:id/materials/allocate|release|reallocate   reserve FEFO / release / both (no body)
 *   POST   /orders/:id/materials/:materialId/excess {quantity, reason}   authorized extra (manager)
 *   POST   /orders/:id/start|pause|resume {note?}               execution (no stock effect)
 *   POST   /orders/:id/usage {materialId, quantity, note?}       actual usage — evidence only
 *   GET    /issues · POST /issues {productionOrderId, lines?, note?} · GET /issues/:id
 *   PUT    /issues/:id/lines {lines, note?} · POST /issues/:id/cancel {reason?}
 *   POST   /issues/:id/post                 the stock writer: PRODUCTION_CONSUMPTION via ledger.ts
 *
 * /api/v1/purchasing/production-shortages?branchId   (purchasing.production_shortages.view)
 * /api/v1/warehouse/material-issues?status          (warehouse.material_issues.view) — read-only handoff
 */
const MaterialParams = z.object({
  id: z.string().min(1).max(64),
  materialId: z.string().min(1).max(64),
});
const HandoffQuery = z
  .object({
    status: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['DRAFT', 'POSTED']).optional()),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const productionRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const s = new ProductionOrderService(db);
  const b = new BomService(db);
  const mi = new MaterialIssueService(db);
  const out = new OutputService(db);
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
  for (const action of ['submit', 'release'] as const) {
    app.post(`${O}/:id/${action}`, small, async (r) => {
      none(r);
      return s[action](auth(r), idOf(r.params), meta(r));
    });
  }
  // EP41: approval takes an empty body, or an owner override of independent approval.
  app.post(`${O}/:id/approve`, small, async (r) =>
    s.approve(
      auth(r),
      idOf(r.params),
      meta(r),
      parseInput(DecisionBody, r.body ?? {}).ownerOverride ?? null,
    ),
  );
  app.post(`${O}/:id/reject`, small, async (r) =>
    s.reject(auth(r), idOf(r.params), reason(r), meta(r)),
  );
  app.post(`${O}/:id/cancel`, small, async (r) =>
    s.cancel(auth(r), idOf(r.params), reason(r), meta(r)),
  );

  // EP37 materials and execution
  app.post(`${O}/:id/materials/allocate`, small, async (r) => {
    none(r);
    return s.allocate(auth(r), idOf(r.params), meta(r));
  });
  app.post(`${O}/:id/materials/release`, small, async (r) => {
    none(r);
    return s.unreserve(auth(r), idOf(r.params), meta(r));
  });
  app.post(`${O}/:id/materials/reallocate`, small, async (r) => {
    none(r);
    return s.reallocate(auth(r), idOf(r.params), meta(r));
  });
  app.post(`${O}/:id/materials/:materialId/excess`, small, async (r) => {
    const p = parseInput(MaterialParams, r.params);
    return s.excess(auth(r), p.id, p.materialId, parseInput(ExcessBody, r.body ?? {}), meta(r));
  });
  for (const action of ['start', 'pause', 'resume'] as const) {
    app.post(`${O}/:id/${action}`, small, async (r) =>
      s.execute(
        auth(r),
        idOf(r.params),
        action,
        parseInput(ExecutionBody, r.body ?? {}).note ?? null,
        meta(r),
      ),
    );
  }
  app.post(`${O}/:id/usage`, small, async (r) =>
    s.recordUsage(auth(r), idOf(r.params), parseInput(UsageBody, r.body), meta(r)),
  );
  const I = '/issues';
  app.get(I, async (r) => mi.list(auth(r), parseInput(IssueListQuery, r.query)));
  app.post(I, body, async (r, reply) =>
    reply.status(201).send(await mi.create(auth(r), parseInput(CreateIssueBody, r.body), meta(r))),
  );
  app.get(`${I}/:id`, async (r) => mi.get(auth(r), idOf(r.params)));
  app.put(`${I}/:id/lines`, body, async (r) =>
    mi.updateLines(auth(r), idOf(r.params), parseInput(IssueLinesBody, r.body), meta(r)),
  );
  app.post(`${I}/:id/cancel`, small, async (r) =>
    mi.cancel(auth(r), idOf(r.params), reason(r), meta(r)),
  );
  app.post(`${I}/:id/post`, small, async (r) =>
    mi.post(
      auth(r),
      idOf(r.params),
      meta(r),
      parseInput(DecisionBody, r.body ?? {}).ownerOverride ?? null,
    ),
  );

  // EP38: completion of an order
  app.post(`${O}/:id/review`, small, async (r) =>
    s.review(auth(r), idOf(r.params), parseInput(ReviewBody, r.body ?? {}).note ?? null, meta(r)),
  );
  app.post(`${O}/:id/reopen`, small, async (r) =>
    s.reopen(auth(r), idOf(r.params), parseInput(ReviewBody, r.body ?? {}).note ?? null, meta(r)),
  );
  app.post(`${O}/:id/complete`, small, async (r) =>
    s.complete(auth(r), idOf(r.params), parseInput(CompleteBody, r.body ?? {}), meta(r)),
  );
  // EP38: output reports
  const P = '/outputs';
  app.get(P, async (r) => out.list(auth(r), parseInput(OutputListQuery, r.query)));
  app.post(P, small, async (r, reply) =>
    reply
      .status(201)
      .send(await out.create(auth(r), parseInput(CreateOutputBody, r.body), meta(r))),
  );
  app.get(`${P}/:id`, async (r) => out.get(auth(r), idOf(r.params)));
  app.patch(`${P}/:id`, small, async (r) =>
    out.update(auth(r), idOf(r.params), parseInput(UpdateOutputBody, r.body ?? {}), meta(r)),
  );
  app.post(`${P}/:id/submit`, small, async (r) => {
    none(r);
    return out.submit(auth(r), idOf(r.params), meta(r));
  });
  app.post(`${P}/:id/accept`, small, async (r) => {
    const b = parseInput(AcceptOutputBody, r.body ?? {});
    return out.accept(auth(r), idOf(r.params), b.pendingGood, meta(r), b.ownerOverride ?? null);
  });
  app.post(`${P}/:id/reject`, small, async (r) =>
    out.reject(auth(r), idOf(r.params), parseInput(ReasonBody, r.body ?? {}).reason, meta(r)),
  );
  app.post(`${P}/:id/cancel`, small, async (r) =>
    out.cancel(
      auth(r),
      idOf(r.params),
      parseInput(OptionalReasonBody, r.body ?? {}).reason ?? null,
      meta(r),
    ),
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

/**
 * EP38: Warehouse finished goods — pending accepted output and the receipts that
 * put it into stock (the only Production stock increase). No Operations route
 * is opened to Warehouse; no price, cost or customer is in any response.
 */
export const finishedGoodsRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const fg = new FinishedGoodsService(db);
  const auth = requireAuth;
  const meta = requestMeta;
  const idOf = (params: unknown) => parseInput(IdParams, params).id;
  const body = { bodyLimit: 64 * 1024 };
  const small = { bodyLimit: 4 * 1024 };
  app.get('/', async (r) => fg.pending(auth(r), parseInput(FgPendingQuery, r.query)));
  app.get('/receipts', async (r) => fg.list(auth(r), parseInput(FgReceiptListQuery, r.query)));
  app.post('/receipts', body, async (r, reply) =>
    reply
      .status(201)
      .send(await fg.create(auth(r), parseInput(CreateFgReceiptBody, r.body), meta(r))),
  );
  app.get('/receipts/:id', async (r) => fg.get(auth(r), idOf(r.params)));
  app.put('/receipts/:id/lines', body, async (r) =>
    fg.updateLines(auth(r), idOf(r.params), parseInput(FgLinesBody, r.body), meta(r)),
  );
  app.post('/receipts/:id/post', small, async (r) =>
    fg.post(
      auth(r),
      idOf(r.params),
      meta(r),
      parseInput(DecisionBody, r.body ?? {}).ownerOverride ?? null,
    ),
  );
  app.post('/receipts/:id/cancel', small, async (r) =>
    fg.cancel(
      auth(r),
      idOf(r.params),
      parseInput(OptionalReasonBody, r.body ?? {}).reason ?? null,
      meta(r),
    ),
  );
  app.post('/receipts/:id/reverse', small, async (r) =>
    fg.reverse(auth(r), idOf(r.params), parseInput(ReasonBody, r.body ?? {}).reason, meta(r)),
  );
  return Promise.resolve();
};

/** EP37: the Warehouse read-only material issue handoff (no Operations route is opened to Warehouse). */
export const materialIssueHandoffRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const mi = new MaterialIssueService(db);
  app.get('/', async (r) => mi.warehouseList(requireAuth(r), parseInput(HandoffQuery, r.query)));
  return Promise.resolve();
};
