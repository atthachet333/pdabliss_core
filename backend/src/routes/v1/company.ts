import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import type { InvitationService } from '../../auth/invitations.js';
import { parseInput } from '../../lib/validation.js';

/*
 * /api/v1/company — the first Company Control Center endpoints (EP23
 * foundation): invitations only. The service checks that the caller is the
 * company's COMPANY_OWNER or SYSTEM_ADMIN; full company RBAC is EP25/EP26.
 */

const CreateBody = z
  .object({
    email: z.string().trim().max(254).pipe(z.email()),
    role: z.enum(['SYSTEM_ADMIN', 'EXECUTIVE', 'DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER']),
  })
  .strict();
const IdParams = z.object({ id: z.string().min(1).max(64) });

export const companyRoutes: FastifyPluginAsync<{ invitations: InvitationService }> = async (
  app,
  { invitations },
) => {
  app.addHook('preHandler', requireSession);

  app.post('/invitations', { bodyLimit: 16 * 1024 }, async (request, reply) => {
    const body = parseInput(CreateBody, request.body);
    const created = await invitations.create(requireAuth(request), body, requestMeta(request));
    return reply.status(201).send(created);
  });

  app.post('/invitations/:id/revoke', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    await invitations.revoke(requireAuth(request), id, requestMeta(request));
    return { status: 'revoked' };
  });

  return Promise.resolve();
};
