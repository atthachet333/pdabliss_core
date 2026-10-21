import type { FastifyPluginAsync } from 'fastify';
import { APP_VERSION, SERVICE_NAME } from '../meta.js';

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export const healthRoutes: FastifyPluginAsync<{ environment: string }> = async (app, opts) => {
  app.get('/health', { config: { rateLimit: false } }, (): HealthResponse => {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: APP_VERSION,
      environment: opts.environment,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  });
  return Promise.resolve();
};
