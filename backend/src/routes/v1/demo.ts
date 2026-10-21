import type { FastifyPluginAsync } from 'fastify';
import { DEMO_STOCK_RECORDS } from '../../demo/stock-fixtures.js';
import { toPurchasingView, toWarehouseView } from '../../domain/inventory/stock-item.js';

/**
 * EP00 demo endpoints — mock data, no authentication, disabled by default in
 * production. They exist to demonstrate audience-specific response contracts:
 * the same internal record is projected differently per workspace.
 *
 * When authentication lands, the workspace comes from the verified session —
 * never from a path, header, or query parameter supplied by the client.
 */
export const demoRoutes: FastifyPluginAsync = (app) => {
  app.get('/warehouse/stock', () => ({
    workspace: 'warehouse',
    items: DEMO_STOCK_RECORDS.map(toWarehouseView),
  }));

  app.get('/purchasing/stock', () => ({
    workspace: 'purchasing',
    items: DEMO_STOCK_RECORDS.map(toPurchasingView),
  }));

  return Promise.resolve();
};
