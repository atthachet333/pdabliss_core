import type { FastifyPluginAsync } from 'fastify';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import { IdParams } from '../../company/input.js';
import type { Db } from '../../db/client.js';
import { parseInput } from '../../lib/validation.js';
import {
  CreateBody,
  LineBody,
  LineParams,
  ListQuery,
  OptionalReasonBody,
  OptionsQuery,
  ReasonBody,
  UpdateBody,
} from '../../purchasing/input.js';
import { PurchaseRequestService } from '../../purchasing/service.js';

/*
 * /api/v1/purchase-requests — purchase requests (EP29), docs/PURCHASING_REQUEST.md.
 *
 *   GET    /context                  what the caller may do; branches; selected branch
 *   GET    /                         list (?view=all|mine|department|queue, filters, pages)
 *   POST   /                         new DRAFT in the selected branch (201)
 *   GET    /:id                      one request, its allowed actions and timeline
 *   PATCH  /:id                      DRAFT header (department, purpose, need-by)
 *   POST   /:id/lines                add a DRAFT line
 *   PATCH  /:id/lines/:lineId        replace a DRAFT line
 *   DELETE /:id/lines/:lineId        remove a DRAFT line
 *   POST   /:id/submit · /approve · /reject {reason} · /cancel {reason?}
 *   GET    /item-options?q= · /unit-options     safe pickers for lines
 *
 * There is no status PATCH: each change of status is its own action, checked
 * by the transition policy. Requester, approver, branch, company and number
 * are the server's — never the client's.
 */

export const purchaseRequestRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const pr = new PurchaseRequestService(db);
  const auth = requireAuth;
  const meta = requestMeta;
  const idOf = (params: unknown) => parseInput(IdParams, params).id;
  const body = { bodyLimit: 64 * 1024 };

  app.get('/context', async (r) => pr.context(auth(r)));
  app.get('/item-options', async (r) =>
    pr.itemOptions(auth(r), parseInput(OptionsQuery, r.query).q),
  );
  app.get('/unit-options', async (r) => pr.unitOptions(auth(r)));

  app.get('/', async (r) => pr.list(auth(r), parseInput(ListQuery, r.query)));
  app.post('/', body, async (r, reply) =>
    reply.status(201).send(await pr.create(auth(r), parseInput(CreateBody, r.body), meta(r))),
  );
  app.get('/:id', async (r) => pr.get(auth(r), idOf(r.params)));
  app.patch('/:id', body, async (r) =>
    pr.update(auth(r), idOf(r.params), parseInput(UpdateBody, r.body), meta(r)),
  );

  app.post('/:id/lines', body, async (r, reply) =>
    reply
      .status(201)
      .send(await pr.addLine(auth(r), idOf(r.params), parseInput(LineBody, r.body), meta(r))),
  );
  app.patch('/:id/lines/:lineId', body, async (r) => {
    const { id, lineId } = parseInput(LineParams, r.params);
    return pr.updateLine(auth(r), id, lineId, parseInput(LineBody, r.body), meta(r));
  });
  app.delete('/:id/lines/:lineId', async (r) => {
    const { id, lineId } = parseInput(LineParams, r.params);
    return pr.removeLine(auth(r), id, lineId, meta(r));
  });

  app.post('/:id/submit', async (r) => pr.submit(auth(r), idOf(r.params), meta(r)));
  app.post('/:id/approve', async (r) => pr.approve(auth(r), idOf(r.params), meta(r)));
  app.post('/:id/reject', { bodyLimit: 4 * 1024 }, async (r) =>
    pr.reject(auth(r), idOf(r.params), parseInput(ReasonBody, r.body).reason, meta(r)),
  );
  app.post('/:id/cancel', { bodyLimit: 4 * 1024 }, async (r) =>
    pr.cancel(
      auth(r),
      idOf(r.params),
      parseInput(OptionalReasonBody, r.body ?? {}).reason ?? null,
      meta(r),
    ),
  );

  return Promise.resolve();
};
