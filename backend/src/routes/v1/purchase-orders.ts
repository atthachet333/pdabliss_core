import type { FastifyPluginAsync } from 'fastify';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import { IdParams } from '../../company/input.js';
import type { Db } from '../../db/client.js';
import { parseInput } from '../../lib/validation.js';
import {
  CancelBody,
  ConfirmDepositBody,
  CreateOrderBody,
  LineParams,
  LineUpdateBody,
  NewLineBody,
  OrderListQuery,
  QueueQuery,
  SearchQuery,
  UpdateOrderBody,
  WaiveBody,
} from '../../purchasing/order-input.js';
import { PurchaseOrderService } from '../../purchasing/order-service.js';

/*
 * Purchase orders, deposits and pending receive (EP30), docs/PURCHASE_ORDER.md.
 *
 * /api/v1/purchase-orders — Purchasing (Executive: read-only summary)
 *   GET    /context                         what the caller may do; branches
 *   GET    /                                list (?view=all|open, status, branch, supplier, request, q, pages)
 *   POST   /                                new DRAFT from an APPROVED request (201)
 *   GET    /:id                             one order (Purchasing view, or Executive summary)
 *   PATCH  /:id                             DRAFT header: supplier, currency, dates, terms, note, deposit
 *   POST · PATCH · DELETE /:id/lines[/:lineId]   DRAFT lines
 *   POST   /:id/issue                       DRAFT → WAITING_DEPOSIT | PENDING_RECEIVE
 *   POST   /:id/cancel {reason?}            → CANCELLED (reason required once issued)
 *   POST   /:id/deposit/confirm {reference?}  Accounting: → PENDING_RECEIVE
 *   POST   /:id/deposit/waive {reason}        Accounting: → PENDING_RECEIVE
 *   GET    /supplier-options?q= · /source-requests?q= · /source-requests/:id
 * /api/v1/accounting/deposits — GET / (?view=pending|all) · GET /:id   (AccountingDepositView)
 * /api/v1/warehouse/pending-receive — GET / · GET /:id   (WarehousePendingReceiveView: no money)
 *
 * There is no status PATCH; totals, numbers, snapshots and deposit status are
 * the server's.
 */

export const purchaseOrderRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const po = new PurchaseOrderService(db);
  const auth = requireAuth;
  const meta = requestMeta;
  const idOf = (params: unknown) => parseInput(IdParams, params).id;
  const body = { bodyLimit: 64 * 1024 };
  const small = { bodyLimit: 4 * 1024 };

  app.get('/context', async (r) => po.context(auth(r)));
  app.get('/supplier-options', async (r) =>
    po.supplierOptions(auth(r), parseInput(SearchQuery, r.query).q),
  );
  app.get('/source-requests', async (r) =>
    po.sourceRequests(auth(r), parseInput(SearchQuery, r.query).q),
  );
  app.get('/source-requests/:id', async (r) => po.sourceRequest(auth(r), idOf(r.params)));

  app.get('/', async (r) => po.list(auth(r), parseInput(OrderListQuery, r.query)));
  app.post('/', body, async (r, reply) =>
    reply.status(201).send(await po.create(auth(r), parseInput(CreateOrderBody, r.body), meta(r))),
  );
  app.get('/:id', async (r) => po.get(auth(r), idOf(r.params)));
  app.patch('/:id', body, async (r) =>
    po.update(auth(r), idOf(r.params), parseInput(UpdateOrderBody, r.body), meta(r)),
  );

  app.post('/:id/lines', body, async (r, reply) =>
    reply
      .status(201)
      .send(await po.addLine(auth(r), idOf(r.params), parseInput(NewLineBody, r.body), meta(r))),
  );
  app.patch('/:id/lines/:lineId', body, async (r) => {
    const { id, lineId } = parseInput(LineParams, r.params);
    return po.updateLine(auth(r), id, lineId, parseInput(LineUpdateBody, r.body), meta(r));
  });
  app.delete('/:id/lines/:lineId', async (r) => {
    const { id, lineId } = parseInput(LineParams, r.params);
    return po.removeLine(auth(r), id, lineId, meta(r));
  });

  app.post('/:id/issue', async (r) => po.issue(auth(r), idOf(r.params), meta(r)));
  app.post('/:id/cancel', small, async (r) =>
    po.cancel(
      auth(r),
      idOf(r.params),
      parseInput(CancelBody, r.body ?? {}).reason ?? null,
      meta(r),
    ),
  );
  app.post('/:id/deposit/confirm', small, async (r) =>
    po.confirmDeposit(
      auth(r),
      idOf(r.params),
      parseInput(ConfirmDepositBody, r.body ?? {}).reference ?? null,
      meta(r),
    ),
  );
  app.post('/:id/deposit/waive', small, async (r) =>
    po.waiveDeposit(auth(r), idOf(r.params), parseInput(WaiveBody, r.body).reason, meta(r)),
  );

  return Promise.resolve();
};

export const depositRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const po = new PurchaseOrderService(db);
  app.get('/', async (r) => po.depositQueue(requireAuth(r), parseInput(QueueQuery, r.query)));
  app.get('/:id', async (r) => po.depositOrder(requireAuth(r), parseInput(IdParams, r.params).id));
  return Promise.resolve();
};

export const pendingReceiveRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const po = new PurchaseOrderService(db);
  app.get('/', async (r) =>
    po.pendingReceiveQueue(requireAuth(r), parseInput(QueueQuery, r.query)),
  );
  app.get('/:id', async (r) =>
    po.pendingReceiveOrder(requireAuth(r), parseInput(IdParams, r.params).id),
  );
  return Promise.resolve();
};
