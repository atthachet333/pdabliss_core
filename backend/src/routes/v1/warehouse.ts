import type { FastifyPluginAsync } from 'fastify';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import { IdParams } from '../../company/input.js';
import type { Db } from '../../db/client.js';
import { parseInput } from '../../lib/validation.js';
import {
  CancelReceiptBody,
  CreateReceiptBody,
  FefoQuery,
  LineBody,
  MovementQuery,
  ReceiptLineParams,
  ReceiptListQuery,
  StockQuery,
  UpdateReceiptBody,
} from '../../warehouse/input.js';
import { registerInventoryLocks } from '../../warehouse/locks.js';
import { ReceivingService } from '../../warehouse/service.js';

/*
 * Warehouse receiving and inventory (EP31) — docs/WAREHOUSE_RECEIVING.md,
 * docs/INVENTORY_LEDGER.md. Session required; every response is an
 * operational allow-list (no price, cost or value of any kind).
 *
 * /api/v1/warehouse
 *   GET    /context                         capabilities, branches, locations, real counts
 *   GET    /receipts                        list (?status, branchId, purchaseOrderId, q, pages)
 *   POST   /receipts {purchaseOrderId, receivedAt?, defaultLocationId?, note?}   new DRAFT (201)
 *   GET    /receipts/:id                    one receipt (lines, allocations, timeline, actions)
 *   PATCH  /receipts/:id                    DRAFT header
 *   PUT    /receipts/:id/lines/:lineId      DRAFT line: accepted / rejected / allocations (replaced whole)
 *   POST   /receipts/:id/post               DRAFT → POSTED (stock in)
 *   POST   /receipts/:id/cancel {reason?}   DRAFT → CANCELLED, or POSTED → CANCELLED (reversal, reason)
 *   GET    /stock                           stock on hand (?view=stock|lots, branch, location, item, expiry, q)
 *   GET    /stock/fefo?itemId=              FEFO order of an item's stock (read-only)
 *   GET    /movements                       the movement ledger (?branch, location, item, lot, type, q)
 * Pending receive (EP30, extended in EP31): /api/v1/warehouse/pending-receive.
 * There is no status PATCH, no stock PATCH and no movement write endpoint.
 */

export const warehouseRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  registerInventoryLocks();
  app.addHook('preHandler', requireSession);
  const w = new ReceivingService(db);
  const auth = requireAuth;
  const meta = requestMeta;
  const idOf = (params: unknown) => parseInput(IdParams, params).id;
  const body = { bodyLimit: 64 * 1024 };
  const small = { bodyLimit: 4 * 1024 };

  app.get('/context', async (r) => w.context(auth(r)));

  app.get('/receipts', async (r) => w.list(auth(r), parseInput(ReceiptListQuery, r.query)));
  app.post('/receipts', small, async (r, reply) =>
    reply.status(201).send(await w.create(auth(r), parseInput(CreateReceiptBody, r.body), meta(r))),
  );
  app.get('/receipts/:id', async (r) => w.get(auth(r), idOf(r.params)));
  app.patch('/receipts/:id', small, async (r) =>
    w.update(auth(r), idOf(r.params), parseInput(UpdateReceiptBody, r.body), meta(r)),
  );
  app.put('/receipts/:id/lines/:lineId', body, async (r) => {
    const { id, lineId } = parseInput(ReceiptLineParams, r.params);
    return w.saveLine(auth(r), id, lineId, parseInput(LineBody, r.body), meta(r));
  });
  app.post('/receipts/:id/post', async (r) => w.post(auth(r), idOf(r.params), meta(r)));
  app.post('/receipts/:id/cancel', small, async (r) =>
    w.cancel(
      auth(r),
      idOf(r.params),
      parseInput(CancelReceiptBody, r.body ?? {}).reason ?? null,
      meta(r),
    ),
  );

  app.get('/stock', async (r) => w.stock(auth(r), parseInput(StockQuery, r.query)));
  app.get('/stock/fefo', async (r) => w.fefo(auth(r), parseInput(FefoQuery, r.query)));
  app.get('/movements', async (r) => w.movements(auth(r), parseInput(MovementQuery, r.query)));
  return Promise.resolve();
};
