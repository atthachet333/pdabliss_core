import type { FastifyPluginAsync } from 'fastify';
import { API_VERSION, SERVICE_NAME } from '../../meta.js';
import { demoRoutes } from './demo.js';

export const v1Routes: FastifyPluginAsync<{ enableDemoRoutes: boolean }> = async (app, opts) => {
  app.get('/', () => ({
    service: SERVICE_NAME,
    apiVersion: API_VERSION,
    demoRoutes: opts.enableDemoRoutes,
  }));

  if (opts.enableDemoRoutes) {
    await app.register(demoRoutes, { prefix: '/demo' });
  }
};
