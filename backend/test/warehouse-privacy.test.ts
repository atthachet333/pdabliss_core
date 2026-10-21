import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allowedFields } from '../src/domain/access/data-classification.js';
import {
  STOCK_ITEM_CLASSIFICATION,
  StockItemWarehouseView,
} from '../src/domain/inventory/stock-item.js';
import { buildTestApp } from './helpers.js';

const PRICING_KEY = /cost|price|amount|payment|margin|supplier/i;

describe('warehouse pricing privacy', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(() => app.close());

  it('the warehouse contract only contains fields warehouse is cleared for', () => {
    const allowed = new Set<string>(allowedFields(STOCK_ITEM_CLASSIFICATION, 'warehouse'));
    const derived = new Set(['available']);
    for (const key of Object.keys(StockItemWarehouseView.shape)) {
      expect(allowed.has(key) || derived.has(key), `field "${key}" leaks into warehouse view`).toBe(
        true,
      );
    }
  });

  it('GET /api/v1/demo/warehouse/stock omits all pricing fields from the payload', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/demo/warehouse/stock' });
    expect(res.statusCode).toBe(200);

    const body = res.json<{ items: Record<string, unknown>[] }>();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      for (const key of Object.keys(item)) {
        expect(key).not.toMatch(PRICING_KEY);
      }
    }
    // Belt and braces: the raw serialized body must not mention pricing keys at all.
    expect(res.body).not.toMatch(/unitCost|lastPurchasePrice|standardSalesPrice|supplierName/);
  });

  it('purchasing receives purchase-side commercial fields from the same records', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/demo/purchasing/stock' });
    const body = res.json<{ items: Record<string, unknown>[] }>();
    expect(body.items[0]).toHaveProperty('unitCost');
    expect(body.items[0]).toHaveProperty('supplierName');
    // Sales price is not part of the purchasing contract.
    expect(body.items[0]).not.toHaveProperty('standardSalesPrice');
  });

  it('demo routes are disabled when the flag is off', async () => {
    const prodLike = await buildTestApp({ ENABLE_DEMO_ROUTES: 'false' });
    const res = await prodLike.inject({ method: 'GET', url: '/api/v1/demo/warehouse/stock' });
    expect(res.statusCode).toBe(404);
    await prodLike.close();
  });
});
