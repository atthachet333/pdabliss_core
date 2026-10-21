import { z } from 'zod';
import type { FieldClassification } from '../access/data-classification.js';

/**
 * Internal stock record. This shape never leaves the server directly —
 * responses are always projected through an audience-specific view schema.
 */
export const StockItemRecord = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  unit: z.string(),
  warehouseCode: z.string(),
  lotNo: z.string().nullable(),
  manufacturedOn: z.iso.date().nullable(),
  expiresOn: z.iso.date().nullable(),
  onHand: z.number(),
  reserved: z.number(),
  reorderPoint: z.number(),
  supplierName: z.string(),
  unitCost: z.number(),
  lastPurchasePrice: z.number(),
  standardSalesPrice: z.number(),
});
export type StockItemRecord = z.infer<typeof StockItemRecord>;

export const STOCK_ITEM_CLASSIFICATION: FieldClassification<StockItemRecord> = {
  id: 'operational',
  sku: 'operational',
  name: 'operational',
  unit: 'operational',
  warehouseCode: 'operational',
  lotNo: 'operational',
  manufacturedOn: 'operational',
  expiresOn: 'operational',
  onHand: 'operational',
  reserved: 'operational',
  reorderPoint: 'operational',
  supplierName: 'commercial',
  unitCost: 'commercial',
  lastPurchasePrice: 'commercial',
  standardSalesPrice: 'commercial',
};

/**
 * Warehouse contract: operational fields only. `z.object` strips unknown keys
 * on parse, so pricing on the source record cannot leak into the response.
 */
export const StockItemWarehouseView = StockItemRecord.pick({
  id: true,
  sku: true,
  name: true,
  unit: true,
  warehouseCode: true,
  lotNo: true,
  manufacturedOn: true,
  expiresOn: true,
  onHand: true,
  reserved: true,
  reorderPoint: true,
}).extend({
  available: z.number(),
});
export type StockItemWarehouseView = z.infer<typeof StockItemWarehouseView>;

/** Purchasing contract: operational + commercial purchase-side fields. */
export const StockItemPurchasingView = StockItemWarehouseView.extend({
  supplierName: z.string(),
  unitCost: z.number(),
  lastPurchasePrice: z.number(),
});
export type StockItemPurchasingView = z.infer<typeof StockItemPurchasingView>;

export function toWarehouseView(record: StockItemRecord): StockItemWarehouseView {
  return StockItemWarehouseView.parse({ ...record, available: record.onHand - record.reserved });
}

export function toPurchasingView(record: StockItemRecord): StockItemPurchasingView {
  return StockItemPurchasingView.parse({ ...record, available: record.onHand - record.reserved });
}
