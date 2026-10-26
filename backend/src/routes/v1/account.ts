import type { FastifyPluginAsync } from 'fastify';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import { AUTH_RATE_LIMITS } from '../../auth/policy.js';
import { PackageBody } from '../../company/input.js';
import type { CompanyService } from '../../company/service.js';
import { parseInput } from '../../lib/validation.js';

/*
 * /api/v1/account — the signed-in customer's onboarding position (EP24):
 * which step they are on and the package they chose. No company id is ever
 * taken from the request; everything derives from the session.
 */

export const accountRoutes: FastifyPluginAsync<{ companies: CompanyService }> = async (
  app,
  { companies },
) => {
  app.addHook('preHandler', requireSession);

  app.get('/onboarding', async (request) => companies.onboarding(requireAuth(request)));

  app.post(
    '/package',
    { bodyLimit: 1024, config: { rateLimit: AUTH_RATE_LIMITS.packageSelection } },
    async (request) => {
      const { plan } = parseInput(PackageBody, request.body);
      return companies.selectPackage(requireAuth(request), plan, requestMeta(request));
    },
  );

  return Promise.resolve();
};
