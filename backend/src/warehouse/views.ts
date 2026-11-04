import { z } from 'zod';
import type { DataClass } from '../domain/access/data-classification.js';
import { MOVEMENT_TYPES } from './input.js';

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
  /** EP34: claimed by active sales reservations; available = on hand − reserved. */
  quantityReserved: z.string(),
  quantityAvailable: z.string(),
  expiryState,
  daysToExpiry: z.number().nullable(),
  firstReceivedAt: z.string(),
  updatedAt: z.string(),
});

export const MovementRow = z.object({
  id: z.string(),
  occurredAt: z.string(),
  type: z.enum(MOVEMENT_TYPES),
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
    /** EP32 source documents (one of them is set, by `type`). */
    transfer: z.object({ id: z.string(), number: z.string() }).nullable(),
    adjustment: z.object({ id: z.string(), number: z.string() }).nullable(),
    count: z.object({ id: z.string(), number: z.string() }).nullable(),
    /** EP35: the dispatched shipment of a SALES_ISSUE. */
    shipment: z.object({ id: z.string(), number: z.string() }).nullable(),
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
  quantityReserved: z.string(),
  quantityAvailable: z.string(),
  expiryState,
  firstReceivedAt: z.string(),
});

/**
 * EP34 Pending Pick — what Warehouse needs to prepare a confirmed sales order:
 * the order number and dates, items, quantities, and WHERE the reserved stock is
 * (location, lot, expiry). Deliberately no customer (EP35 delivery decides what
 * ship-to identity Warehouse needs), no price, discount, tax, total, note or reference.
 */
export const PickDemandOrder = z.object({
  id: z.string(),
  number: z.string(),
  branch: ref,
  orderDate: z.string(),
  requestedDate: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  readiness: z.enum(['NOT_READY', 'PARTIALLY_READY', 'READY']),
  lines: z.array(
    z.object({
      lineNo: z.number(),
      item: ref,
      unit: z.object({ code: z.string() }),
      ordered: z.string(),
      allocated: z.string(),
      shortage: z.string(),
      picks: z.array(
        z.object({
          location: ref,
          lot: z.object({ lotNumber: z.string(), expiryDate: z.string().nullable() }).nullable(),
          expiryState,
          quantity: z.string(),
          /** EP35: reserved here and not yet claimed by a pick (what a new pick takes). */
          toPick: z.string(),
        }),
      ),
    }),
  ),
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
    ...Object.keys(PickDemandOrder.shape),
  ].map((k) => [k, 'operational' as const]),
);

// ---------------------------------------------------------------- EP32 documents
// Transfers, adjustments and cycle counts: identities, quantities, lots,
// locations, dates and people — the same operational allow-list rule.

const itemRef = ref.extend({ lotTracking: tracking, expiryTracking: tracking });
const unitRef = z.object({ code: z.string(), precision: z.number() });
const lotRef = z
  .object({ id: z.string(), lotNumber: z.string(), expiryDate: z.string().nullable() })
  .nullable();
const newLot = z.object({ lotNumber: z.string(), expiryDate: z.string().nullable() }).nullable();

export const TransferRow = z.object({
  id: z.string(),
  number: z.string(),
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']),
  branch: ref,
  source: ref,
  destination: ref,
  transferDate: z.string(),
  lineCount: z.number(),
  createdBy: person,
  updatedAt: z.string(),
});

const transferLine = z.object({
  id: z.string(),
  lineNo: z.number(),
  item: itemRef,
  unit: unitRef,
  lot: lotRef,
  quantity: z.string(),
  /** On hand at the source now (what a DRAFT can still take). */
  available: z.string(),
  note: z.string().nullable(),
});

export const TransferView = TransferRow.extend({
  note: z.string().nullable(),
  createdAt: z.string(),
  postedAt: z.string().nullable(),
  postedBy: person,
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  lines: z.array(transferLine),
  actions: z.array(z.enum(['edit', 'post', 'cancel'])),
});

const adjustmentReason = z.enum([
  'DAMAGE',
  'LOSS',
  'SHRINKAGE',
  'FOUND',
  'EXPIRED',
  'COUNT_CORRECTION',
  'DATA_CORRECTION',
  'OTHER',
]);

export const AdjustmentRow = z.object({
  id: z.string(),
  number: z.string(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'POSTED', 'REJECTED', 'CANCELLED']),
  branch: ref,
  reason: adjustmentReason,
  adjustmentDate: z.string(),
  locations: z.array(z.string()),
  lineCount: z.number(),
  createdBy: person,
  approvedBy: person,
  updatedAt: z.string(),
});

const adjustmentLine = z.object({
  id: z.string(),
  lineNo: z.number(),
  direction: z.enum(['INCREASE', 'DECREASE']),
  location: ref,
  item: itemRef,
  unit: unitRef,
  lot: lotRef,
  newLot,
  quantity: z.string(),
  /** On hand now for this stock identity (context; posting re-checks). */
  onHand: z.string(),
  note: z.string().nullable(),
});

export const AdjustmentView = AdjustmentRow.extend({
  note: z.string().nullable(),
  createdAt: z.string(),
  submittedAt: z.string().nullable(),
  submittedBy: person,
  approvedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectedBy: person,
  rejectionReason: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  lines: z.array(adjustmentLine),
  actions: z.array(z.enum(['edit', 'submit', 'approve', 'reject', 'cancel'])),
});

export const CountRow = z.object({
  id: z.string(),
  number: z.string(),
  status: z.enum(['DRAFT', 'COUNTING', 'REVIEW', 'POSTED', 'CANCELLED']),
  branch: ref,
  locations: z.array(ref),
  item: ref.nullable(),
  countDate: z.string(),
  lineCount: z.number(),
  countedLines: z.number(),
  varianceLines: z.number(),
  createdBy: person,
  updatedAt: z.string(),
});

const countLine = z.object({
  id: z.string(),
  lineNo: z.number(),
  location: ref,
  item: itemRef,
  unit: unitRef,
  lot: lotRef,
  newLot,
  expected: z.boolean(),
  /** On hand when the count started (0 for stock the system did not show). */
  systemQuantity: z.string(),
  countedQuantity: z.string().nullable(),
  /** counted − system (server-side), null until counted. */
  variance: z.string().nullable(),
  countedBy: person,
  countedAt: z.string().nullable(),
  note: z.string().nullable(),
});

export const CountView = CountRow.extend({
  note: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  startedBy: person,
  reviewAt: z.string().nullable(),
  postedAt: z.string().nullable(),
  postedBy: person,
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  lines: z.array(countLine),
  actions: z.array(z.enum(['edit', 'start', 'count', 'review', 'reopen', 'post', 'cancel'])),
});

/** Every EP32 key Warehouse can receive — all operational (checked by a test). */
export const CONTROL_FIELD_CLASSES: Record<string, DataClass> = Object.fromEntries(
  [
    ...Object.keys(TransferView.shape),
    ...Object.keys(transferLine.shape),
    ...Object.keys(AdjustmentView.shape),
    ...Object.keys(adjustmentLine.shape),
    ...Object.keys(CountView.shape),
    ...Object.keys(countLine.shape),
  ].map((k) => [k, 'operational' as const]),
);
