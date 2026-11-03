import type { FastifyPluginAsync } from 'fastify';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import { IdParams } from '../../company/input.js';
import type { Db } from '../../db/client.js';
import { parseInput } from '../../lib/validation.js';
import { AdjustmentService } from '../../warehouse/adjustments.js';
import { CountService } from '../../warehouse/counts.js';
import {
  AdjustmentLineBody,
  AdjustmentListQuery,
  CancelReceiptBody,
  CountEntriesBody,
  CountLineBody,
  CountListQuery,
  CreateAdjustmentBody,
  CreateCountBody,
  CreateReceiptBody,
  CreateTransferBody,
  FefoQuery,
  LineBody,
  LinesBody,
  MovementQuery,
  OptionalReasonBody,
  ReasonBody,
  ReceiptLineParams,
  ReceiptListQuery,
  StockQuery,
  TransferLineBody,
  TransferListQuery,
  UpdateAdjustmentBody,
  UpdateCountBody,
  UpdateReceiptBody,
  UpdateTransferBody,
} from '../../warehouse/input.js';
import { registerInventoryLocks } from '../../warehouse/locks.js';
import { ReceivingService } from '../../warehouse/service.js';
import { TransferService } from '../../warehouse/transfers.js';

/*
 * Warehouse receiving and inventory (EP31) and inventory control (EP32) —
 * docs/WAREHOUSE_RECEIVING.md, docs/INVENTORY_LEDGER.md,
 * docs/INVENTORY_TRANSFER.md, docs/STOCK_ADJUSTMENT.md, docs/CYCLE_COUNT.md.
 * Session required; every response is an operational allow-list (no price,
 * cost or value of any kind).
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
 *   GET    /movements                       the movement ledger (?branch, location, item, lot, type, sourceType, from, to, q)
 *
 *   GET    /transfers  POST /transfers  GET|PATCH /transfers/:id  PUT /transfers/:id/lines
 *   POST   /transfers/:id/post              DRAFT → POSTED (TRANSFER_OUT + TRANSFER_IN)
 *   POST   /transfers/:id/cancel {reason?}  DRAFT → CANCELLED, or POSTED → CANCELLED (reversal pair, reason)
 *
 *   GET    /adjustments  POST /adjustments  GET|PATCH /adjustments/:id  PUT /adjustments/:id/lines
 *   POST   /adjustments/:id/submit          DRAFT → SUBMITTED
 *   POST   /adjustments/:id/approve         SUBMITTED → POSTED (ADJUSTMENT_IN / ADJUSTMENT_OUT)
 *   POST   /adjustments/:id/reject {reason} SUBMITTED → REJECTED
 *   POST   /adjustments/:id/cancel {reason?} DRAFT|SUBMITTED → CANCELLED, or POSTED → CANCELLED (reversal, reason)
 *
 *   GET    /counts  POST /counts  GET|PATCH /counts/:id
 *   POST   /counts/:id/start                DRAFT → COUNTING (snapshot; the scope is locked)
 *   PUT    /counts/:id/entries {entries}    counted quantities (0 counts; null clears)
 *   POST   /counts/:id/lines                stock the system did not show (201)
 *   POST   /counts/:id/review | /reopen     COUNTING ⇄ REVIEW
 *   POST   /counts/:id/post                 REVIEW → POSTED (COUNT_CORRECTION; refused when stale)
 *   POST   /counts/:id/cancel {reason?}     before POSTED → CANCELLED
 * Pending receive (EP30, extended in EP31): /api/v1/warehouse/pending-receive.
 * There is no status PATCH, no stock PATCH and no movement write endpoint.
 */

export const warehouseRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  registerInventoryLocks();
  app.addHook('preHandler', requireSession);
  const w = new ReceivingService(db);
  const tr = new TransferService(db);
  const adj = new AdjustmentService(db);
  const cc = new CountService(db);
  const auth = requireAuth;
  const meta = requestMeta;
  const idOf = (params: unknown) => parseInput(IdParams, params).id;
  const body = { bodyLimit: 64 * 1024 };
  const small = { bodyLimit: 4 * 1024 };
  const optReason = (b: unknown) => parseInput(OptionalReasonBody, b ?? {}).reason ?? null;

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

  // ---------------------------------------------------------------- transfers
  app.get('/transfers', async (r) => tr.list(auth(r), parseInput(TransferListQuery, r.query)));
  app.post('/transfers', small, async (r, reply) =>
    reply
      .status(201)
      .send(await tr.create(auth(r), parseInput(CreateTransferBody, r.body), meta(r))),
  );
  app.get('/transfers/:id', async (r) => tr.get(auth(r), idOf(r.params)));
  app.patch('/transfers/:id', small, async (r) =>
    tr.update(auth(r), idOf(r.params), parseInput(UpdateTransferBody, r.body), meta(r)),
  );
  app.put('/transfers/:id/lines', body, async (r) =>
    tr.saveLines(
      auth(r),
      idOf(r.params),
      parseInput(LinesBody(TransferLineBody), r.body).lines,
      meta(r),
    ),
  );
  app.post('/transfers/:id/post', async (r) => tr.post(auth(r), idOf(r.params), meta(r)));
  app.post('/transfers/:id/cancel', small, async (r) =>
    tr.cancel(auth(r), idOf(r.params), optReason(r.body), meta(r)),
  );

  // ---------------------------------------------------------------- adjustments
  app.get('/adjustments', async (r) => adj.list(auth(r), parseInput(AdjustmentListQuery, r.query)));
  app.post('/adjustments', small, async (r, reply) =>
    reply
      .status(201)
      .send(await adj.create(auth(r), parseInput(CreateAdjustmentBody, r.body), meta(r))),
  );
  app.get('/adjustments/:id', async (r) => adj.get(auth(r), idOf(r.params)));
  app.patch('/adjustments/:id', small, async (r) =>
    adj.update(auth(r), idOf(r.params), parseInput(UpdateAdjustmentBody, r.body), meta(r)),
  );
  app.put('/adjustments/:id/lines', body, async (r) =>
    adj.saveLines(
      auth(r),
      idOf(r.params),
      parseInput(LinesBody(AdjustmentLineBody), r.body).lines,
      meta(r),
    ),
  );
  app.post('/adjustments/:id/submit', async (r) => adj.submit(auth(r), idOf(r.params), meta(r)));
  app.post('/adjustments/:id/approve', async (r) => adj.approve(auth(r), idOf(r.params), meta(r)));
  app.post('/adjustments/:id/reject', small, async (r) =>
    adj.reject(auth(r), idOf(r.params), parseInput(ReasonBody, r.body).reason, meta(r)),
  );
  app.post('/adjustments/:id/cancel', small, async (r) =>
    adj.cancel(auth(r), idOf(r.params), optReason(r.body), meta(r)),
  );

  // ---------------------------------------------------------------- cycle counts
  app.get('/counts', async (r) => cc.list(auth(r), parseInput(CountListQuery, r.query)));
  app.post('/counts', small, async (r, reply) =>
    reply.status(201).send(await cc.create(auth(r), parseInput(CreateCountBody, r.body), meta(r))),
  );
  app.get('/counts/:id', async (r) => cc.get(auth(r), idOf(r.params)));
  app.patch('/counts/:id', small, async (r) =>
    cc.update(auth(r), idOf(r.params), parseInput(UpdateCountBody, r.body), meta(r)),
  );
  app.post('/counts/:id/start', async (r) => cc.start(auth(r), idOf(r.params), meta(r)));
  app.put('/counts/:id/entries', body, async (r) =>
    cc.enter(auth(r), idOf(r.params), parseInput(CountEntriesBody, r.body), meta(r)),
  );
  app.post('/counts/:id/lines', small, async (r, reply) =>
    reply
      .status(201)
      .send(await cc.addLine(auth(r), idOf(r.params), parseInput(CountLineBody, r.body), meta(r))),
  );
  app.post('/counts/:id/review', async (r) => cc.review(auth(r), idOf(r.params), false, meta(r)));
  app.post('/counts/:id/reopen', async (r) => cc.review(auth(r), idOf(r.params), true, meta(r)));
  app.post('/counts/:id/post', async (r) => cc.post(auth(r), idOf(r.params), meta(r)));
  app.post('/counts/:id/cancel', small, async (r) =>
    cc.cancel(auth(r), idOf(r.params), optReason(r.body), meta(r)),
  );
  return Promise.resolve();
};
