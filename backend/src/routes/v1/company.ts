import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import type { InvitationService } from '../../auth/invitations.js';
import { AUTH_RATE_LIMITS } from '../../auth/policy.js';
import { CreateCompanyBody, IdParams } from '../../company/input.js';
import type { CompanyService } from '../../company/service.js';
import { parseInput } from '../../lib/validation.js';

/*
 * /api/v1/company — the signed-in customer's own company.
 *
 * EP23: invitations (the service checks COMPANY_OWNER / SYSTEM_ADMIN).
 * EP24: onboarding (create the company) and the current-company context.
 * There is no endpoint that takes a company id: "current" is resolved from the
 * caller's membership, and branch / subscription ids are looked up inside it.
 * Full company RBAC is EP26.
 */

const CreateInvitationBody = z
  .object({
    email: z.string().trim().max(254).pipe(z.email()),
    role: z.enum(['SYSTEM_ADMIN', 'EXECUTIVE', 'DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER']),
  })
  .strict();

export const companyRoutes: FastifyPluginAsync<{
  invitations: InvitationService;
  companies: CompanyService;
}> = async (app, { invitations, companies }) => {
  app.addHook('preHandler', requireSession);

  // ---- onboarding -----------------------------------------------------------
  app.post(
    '/onboarding',
    { bodyLimit: 32 * 1024, config: { rateLimit: AUTH_RATE_LIMITS.companyCreate } },
    async (request, reply) => {
      const body = parseInput(CreateCompanyBody, request.body);
      const created = await companies.createCompany(
        requireAuth(request),
        body,
        requestMeta(request),
      );
      return reply.status(201).send(created);
    },
  );

  // ---- current company ------------------------------------------------------
  app.get('/current', async (request) => companies.current(requireAuth(request)));
  app.get('/current/branches', async (request) => ({
    branches: await companies.branches(requireAuth(request)),
  }));
  app.get('/current/branches/:id', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return { branch: await companies.branch(requireAuth(request), id) };
  });
  app.get('/current/subscription', async (request) => companies.subscription(requireAuth(request)));
  app.get('/current/subscriptions/:id', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return companies.subscription(requireAuth(request), id);
  });
  app.get('/current/departments', async (request) => companies.departments(requireAuth(request)));

  // ---- invitations (EP23) ---------------------------------------------------
  app.post('/invitations', { bodyLimit: 16 * 1024 }, async (request, reply) => {
    const body = parseInput(CreateInvitationBody, request.body);
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
