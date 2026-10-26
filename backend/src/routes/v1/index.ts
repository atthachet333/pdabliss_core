import type { FastifyPluginAsync } from 'fastify';
import { authUnavailable } from '../../auth/errors.js';
import type { InvitationService } from '../../auth/invitations.js';
import type { PlatformService } from '../../auth/platform.js';
import type { AuthService } from '../../auth/service.js';
import type { Env } from '../../config/env.js';
import { API_VERSION, SERVICE_NAME } from '../../meta.js';
import { authRoutes } from './auth.js';
import { companyRoutes } from './company.js';
import { demoRoutes } from './demo.js';
import { platformRoutes } from './platform.js';

export interface AccountServices {
  auth: AuthService;
  platform: PlatformService;
  invitations: InvitationService;
}

export const v1Routes: FastifyPluginAsync<{
  env: Env;
  enableDemoRoutes: boolean;
  services: AccountServices | null;
}> = async (app, opts) => {
  app.get('/', () => ({
    service: SERVICE_NAME,
    apiVersion: API_VERSION,
    demoRoutes: opts.enableDemoRoutes,
    accounts: opts.services !== null,
  }));

  if (opts.enableDemoRoutes) {
    await app.register(demoRoutes, { prefix: '/demo' });
  }

  const { services } = opts;
  if (services) {
    await app.register(authRoutes, { prefix: '/auth', env: opts.env, ...services });
    await app.register(platformRoutes, { prefix: '/platform', platform: services.platform });
    await app.register(companyRoutes, { prefix: '/company', invitations: services.invitations });
  } else {
    // No DATABASE_URL (development only — production refuses to start without it).
    for (const prefix of ['/auth', '/platform', '/company']) {
      app.all(`${prefix}/*`, () => {
        throw authUnavailable();
      });
    }
  }
};
