import { z } from 'zod';
import type { DataClass } from '../domain/access/data-classification.js';

/*
 * Response contracts for goods receipts and inventory (EP31). ALLOW-LISTS:
 * the service builds a projection and parses it here, and `z.object` drops
 * every key not named — a field added to a projection by mistake never
 * reaches the client. Every reader of these views (Warehouse, Executive, the
 * Owner) gets the same operational shape: identities, quantities, lots,
 * locations and dates. There is no price, cost, value, discount, tax, total,
 * deposit, payment term or supplier contact anywhere in them — not hidden,
 * absent (tested key by key).
 */

const ref = z.object({ id: z.string(), code: z.string(), name: z.string() });
const person = z.object({ name: z.string() }).nullable();
const tracking = z.enum(['NONE', 'OPTIONAL', 'REQUIRED']);
const status = z.enum(['DRAFT', 'POSTED', 'CANCELLED']);
const reason = z
  .enum(['DAMAGED', 'WRONG_ITEM', 'EXPIRED', 'QUALITY', 'QUANTITY_DISCREPANCY', 'OTHER'])
  .nullable();
export const expiryState = z.enum(['EXPIRED', 'EXPIRING_SOON', 'OK', 'NO_EXPIRY']);

const allocation = z.object({
  id: z.string(),
  location: ref,
  lotNumber: z.string().nullable(),
  lotId: z.string().nullable(),
  expiryDate: z.string().nullable(),
  manufacturedDate: z.string().nullable(),
  quantity: z.string(),
});

const receiptLine = z.object({
  id: z.string(),
  lineNo: z.number(),
  orderLine: z.object({ id: z.string(), lineNo: z.number() }),
  item: ref.extend({ lotTracking: tracking, expiryTracking: tracking }),
  unit: z.object({ code: z.string(), name: z.string().nullable(), precision: z.number() }),
  /** Ordered on the order line. */
  ordered: z.string(),
  /** Accepted on OTHER posted receipts. */
  receivedElsewhere: z.string(),
  /** What this receipt may still take (other posted receipts counted, this one not). */
  remaining: z.string(),
  acceptedQuantity: z.string(),
  rejectedQuantity: z.string(),
  rejectReason: reason,
  rejectNote: z.string().nullable(),
  replacementRequired: z.boolean(),
  note: z.string().nullable(),
  allocations: z.array(allocation),
});

export const GoodsReceiptRow = z.object({
  id: z.string(),
  number: z.string(),
  status,
  branch: ref,
  order: z.object({ id: z.string(), number: z.string() }),
  supplier: z.object({ code: z.string().nullable(), name: z.string().nullable() }),
  receivedAt: z.string(),
  createdBy: person,
  postedAt: z.string().nullable(),
  lineCount: z.number(),
  updatedAt: z.string(),
});

export const GoodsReceiptView = GoodsReceiptRow.extend({
  defaultLocation: ref.nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  postedBy: person,
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  lines: z.array(receiptLine),
  actions: z.array(z.enum(['edit', 'post', 'cancel'])),
});
export type GoodsReceiptView = z.infer<typeof GoodsReceiptView>;

export const StockRow = z.object({
  id: z.string(),
  branch: ref,
  location: ref,
  item: ref.extend({ lotTracking: tracking, expiryTracking: tracking }),
  unit: z.object({ code: z.string() }),
  lot: z
    .object({
      id: z.string(),
      lotNumber: z.string(),
      expiryDate: z.string().nullable(),
      manufacturedDate: z.string().nullable(),
    })
    .nullable(),
  quantityOnHand: z.string(),
  expiryState,
  daysToExpiry: z.number().nullable(),
  firstReceivedAt: z.string(),
  updatedAt: z.string(),
});

export const MovementRow = z.object({
  id: z.string(),
  occurredAt: z.string(),
  type: z.enum(['PURCHASE_RECEIPT', 'PURCHASE_RECEIPT_REVERSAL']),
  quantityDelta: z.string(),
  branch: ref,
  location: ref,
  item: ref,
  unit: z.object({ code: z.string() }),
  lot: z
    .object({ id: z.string(), lotNumber: z.string(), expiryDate: z.string().nullable() })
    .nullable(),
  source: z.object({
    type: z.string(),
    receipt: z.object({ id: z.string(), number: z.string() }).nullable(),
    order: z.object({ number: z.string() }).nullable(),
  }),
  actor: person,
});

export const FefoCandidate = z.object({
  rank: z.number(),
  balanceId: z.string(),
  location: ref,
  lot: z
    .object({ id: z.string(), lotNumber: z.string(), expiryDate: z.string().nullable() })
    .nullable(),
  quantityOnHand: z.string(),
  expiryState,
  firstReceivedAt: z.string(),
});

/** Every key Warehouse can receive from these views — all operational (checked by a test). */
export const INVENTORY_FIELD_CLASSES: Record<string, DataClass> = Object.fromEntries(
  [
    ...Object.keys(GoodsReceiptView.shape),
    ...Object.keys(receiptLine.shape),
    ...Object.keys(allocation.shape),
    ...Object.keys(StockRow.shape),
    ...Object.keys(MovementRow.shape),
    ...Object.keys(FefoCandidate.shape),
  ].map((k) => [k, 'operational' as const]),
);
