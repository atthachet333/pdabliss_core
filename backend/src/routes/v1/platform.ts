import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  requestMeta,
  requireAuth,
  requireOwner,
  requirePlatform,
  requireRecentStepUp,
} from '../../auth/http.js';
import type { PlatformService } from '../../auth/platform.js';
import { parseInput } from '../../lib/validation.js';

/*
 * /api/v1/platform — Platform Control Center (EP23). Every route requires a
 * platform role from the server-side session; mutations also require a
 * recent one-time-code step-up; managing platform operators is owner-only.
 */

const UserParams = z.object({ userId: z.string().min(1).max(64) });
const GrantBody = z.object({ email: z.string().trim().max(254).pipe(z.email()) }).strict();

export const platformRoutes: FastifyPluginAsync<{ platform: PlatformService }> = async (
  app,
  { platform },
) => {
  app.addHook('preHandler', requirePlatform);

  app.get('/overview', async (request) => {
    const ctx = requireAuth(request);
    return {
      operator: { email: ctx.user.email, role: ctx.user.platformRole?.role },
      ...(await platform.overview()),
    };
  });

  app.get('/users', async () => ({ users: await platform.listUsers() }));
  app.get('/companies', async () => ({ companies: await platform.listCompanies() }));
  app.get('/audit', async () => ({ events: await platform.recentAuthEvents() }));

  // ---- owner-only -----------------------------------------------------------
  app.get('/operators', { preHandler: requireOwner }, async () => ({
    operators: await platform.listOperators(),
  }));

  app.post(
    '/operators',
    { preHandler: [requireOwner, requireRecentStepUp] },
    async (request, reply) => {
      const body = parseInput(GrantBody, request.body);
      const granted = await platform.grantAdmin(
        requireAuth(request),
        body.email,
        requestMeta(request),
      );
      return reply.status(201).send(granted);
    },
  );

  app.delete(
    '/operators/:userId',
    { preHandler: [requireOwner, requireRecentStepUp] },
    async (request) => {
      const { userId } = parseInput(UserParams, request.params);
      await platform.revokeAdmin(requireAuth(request), userId, requestMeta(request));
      return { status: 'revoked' };
    },
  );

  // ---- account status (owner: anyone but the owner; admin: customers only) --
  app.post('/users/:userId/suspend', { preHandler: requireRecentStepUp }, async (request) => {
    const { userId } = parseInput(UserParams, request.params);
    await platform.suspend(requireAuth(request), userId, requestMeta(request));
    return { status: 'suspended' };
  });

  app.post('/users/:userId/reactivate', { preHandler: requireRecentStepUp }, async (request) => {
    const { userId } = parseInput(UserParams, request.params);
    await platform.reactivate(requireAuth(request), userId, requestMeta(request));
    return { status: 'active' };
  });

  return Promise.resolve();
};
