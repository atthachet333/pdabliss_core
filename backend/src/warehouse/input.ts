import { z } from 'zod';

/*
 * Request schemas for goods receipts and inventory (EP31). Strict objects:
 * what the server owns — company, branch, number, status, the order, its
 * supplier, item and unit, ordered quantities, lots' ids, movement types and
 * deltas, balances, actors — is refused with 400. Quantities and dates travel
 * as STRINGS (exact decimals, calendar days).
 */

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !CONTROL.test(v), 'invalid characters')
    .transform((v) => v.replace(/\r\n?/g, '\n').normalize('NFC'));

/** Optional; `null` or '' clears it. */
const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    schema.nullable().optional(),
  );

const id = z.string().min(1).max(64);

/** A calendar day, 2000-01-01 … 2100-12-31, that exists. */
export const dayValue = z
  .string()
  .regex(/^(20\d{2}|2100)-\d{2}-\d{2}$/, 'invalid date')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'invalid date');

/** A non-negative exact decimal: up to 12 integer and 6 decimal digits. */
const amount = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,6})?$/, 'invalid quantity');
const positive = amount.refine((v) => /[1-9]/.test(v), 'quantity must be greater than zero');

/** An instant (ISO 8601 with a time zone). */
const instant = z
  .string()
  .max(40)
  .refine((v) => /T/.test(v) && !Number.isNaN(Date.parse(v)), 'invalid date-time');

/** A lot number as printed by the supplier or the company: kept verbatim, no control characters. */
const lotNumber = text(60);

export const REJECT_REASONS = [
  'DAMAGED',
  'WRONG_ITEM',
  'EXPIRED',
  'QUALITY',
  'QUANTITY_DISCREPANCY',
  'OTHER',
] as const;

export const AllocationBody = z
  .object({
    locationId: id,
    lotNumber: opt(lotNumber),
    expiryDate: opt(dayValue),
    manufacturedDate: opt(dayValue),
    quantity: positive,
  })
  .strict();
export type AllocationInput = z.output<typeof AllocationBody>;

/** The whole receipt line, replacing what was there (allocations included). */
export const LineBody = z
  .object({
    acceptedQuantity: amount,
    rejectedQuantity: amount.optional(),
    rejectReason: opt(z.enum(REJECT_REASONS)),
    rejectNote: opt(text(300)),
    replacementRequired: z.boolean().optional(),
    note: opt(text(500)),
    allocations: z.array(AllocationBody).max(50).default([]),
  })
  .strict();
export type LineInput = z.output<typeof LineBody>;

export const CreateReceiptBody = z
  .object({
    purchaseOrderId: id,
    receivedAt: instant.optional(),
    defaultLocationId: opt(id),
    note: opt(text(1000)),
  })
  .strict();
export type CreateReceiptInput = z.output<typeof CreateReceiptBody>;

export const UpdateReceiptBody = z
  .object({
    receivedAt: instant.optional(),
    defaultLocationId: opt(id),
    note: opt(text(1000)),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateReceiptInput = z.output<typeof UpdateReceiptBody>;

export const CancelReceiptBody = z.object({ reason: opt(text(500)) }).strict();

export const ReceiptLineParams = z.object({ id, lineId: id });

const param = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());
const page = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const ReceiptListQuery = z
  .object({
    status: param(z.enum(['DRAFT', 'POSTED', 'CANCELLED'])),
    branchId: param(id),
    purchaseOrderId: param(id),
    q: param(z.string().trim().min(1).max(100)),
    ...page,
  })
  .strict();
export type ReceiptListInput = z.output<typeof ReceiptListQuery>;

export const EXPIRY_STATES = ['EXPIRED', 'EXPIRING_SOON', 'OK', 'NO_EXPIRY'] as const;
export type ExpiryState = (typeof EXPIRY_STATES)[number];

export const StockQuery = z
  .object({
    /** `stock` (default): by item and location; `lots`: lot-tracked stock by expiry. */
    view: param(z.enum(['stock', 'lots'])),
    branchId: param(id),
    locationId: param(id),
    itemId: param(id),
    expiry: param(z.enum(EXPIRY_STATES)),
    q: param(z.string().trim().min(1).max(100)),
    ...page,
  })
  .strict();
export type StockInput = z.output<typeof StockQuery>;

/** EP34 Pending Pick: confirmed sales orders with stock reserved (warehouse-safe read model). */
export const PickDemandQuery = z
  .object({
    branchId: param(id),
    readiness: param(z.enum(['READY', 'PARTIALLY_READY'])),
    q: param(z.string().trim().min(1).max(100)),
    ...page,
  })
  .strict();
export type PickDemandInput = z.output<typeof PickDemandQuery>;

export const MOVEMENT_TYPES = [
  'PURCHASE_RECEIPT',
  'PURCHASE_RECEIPT_REVERSAL',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT_REVERSAL',
  'TRANSFER_IN_REVERSAL',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'ADJUSTMENT_IN_REVERSAL',
  'ADJUSTMENT_OUT_REVERSAL',
  'COUNT_CORRECTION',
  'SALES_ISSUE',
] as const;

export const MovementQuery = z
  .object({
    branchId: param(id),
    locationId: param(id),
    itemId: param(id),
    lotId: param(id),
    type: param(z.enum(MOVEMENT_TYPES)),
    sourceType: param(
      z.enum(['GOODS_RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'CYCLE_COUNT', 'SALES_SHIPMENT']),
    ),
    from: param(dayValue),
    to: param(dayValue),
    q: param(z.string().trim().min(1).max(100)),
    ...page,
  })
  .strict();
export type MovementInput = z.output<typeof MovementQuery>;

export const FefoQuery = z
  .object({ itemId: id, branchId: param(id), locationId: param(id) })
  .strict();

// ---------------------------------------------------------------- EP32 documents
//
// Transfers, adjustments and cycle counts. Lines are replaced whole (PUT); the
// server owns company, branch (from the locations), number, status, actors,
// movement types and deltas, balances, the count snapshot and every variance —
// sending one is refused (400).

const lines = <T extends z.ZodType>(line: T) => z.array(line).max(100);
const dateRange = { from: param(dayValue), to: param(dayValue) };
const q = param(z.string().trim().min(1).max(100));

export const TransferLineBody = z
  .object({ itemId: id, lotId: opt(id), quantity: positive, note: opt(text(300)) })
  .strict();
export type TransferLineInput = z.output<typeof TransferLineBody>;

export const CreateTransferBody = z
  .object({
    sourceLocationId: id,
    destinationLocationId: id,
    transferDate: dayValue.optional(),
    note: opt(text(1000)),
    lines: lines(TransferLineBody).optional(),
  })
  .strict();
export type CreateTransferInput = z.output<typeof CreateTransferBody>;

export const UpdateTransferBody = z
  .object({
    sourceLocationId: id.optional(),
    destinationLocationId: id.optional(),
    transferDate: dayValue.optional(),
    note: opt(text(1000)),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateTransferInput = z.output<typeof UpdateTransferBody>;

export const LinesBody = <T extends z.ZodType>(line: T) =>
  z.object({ lines: lines(line) }).strict();

export const ADJUSTMENT_REASONS = [
  'DAMAGE',
  'LOSS',
  'SHRINKAGE',
  'FOUND',
  'EXPIRED',
  'COUNT_CORRECTION',
  'DATA_CORRECTION',
  'OTHER',
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const AdjustmentLineBody = z
  .object({
    direction: z.enum(['INCREASE', 'DECREASE']),
    locationId: id,
    itemId: id,
    lotId: opt(id),
    /** Increase only: a lot not yet known (number + expiry by the item's rules). */
    newLotNumber: opt(lotNumber),
    newLotExpiry: opt(dayValue),
    quantity: positive,
    note: opt(text(300)),
  })
  .strict();
export type AdjustmentLineInput = z.output<typeof AdjustmentLineBody>;

export const CreateAdjustmentBody = z
  .object({
    reason: z.enum(ADJUSTMENT_REASONS),
    adjustmentDate: dayValue.optional(),
    note: opt(text(1000)),
    lines: lines(AdjustmentLineBody).optional(),
  })
  .strict();
export type CreateAdjustmentInput = z.output<typeof CreateAdjustmentBody>;

export const UpdateAdjustmentBody = z
  .object({
    reason: z.enum(ADJUSTMENT_REASONS).optional(),
    adjustmentDate: dayValue.optional(),
    note: opt(text(1000)),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateAdjustmentInput = z.output<typeof UpdateAdjustmentBody>;

export const ReasonBody = z.object({ reason: text(500) }).strict();
export const OptionalReasonBody = z.object({ reason: opt(text(500)) }).strict();

export const CreateCountBody = z
  .object({
    locationIds: z.array(id).min(1).max(20),
    itemId: opt(id),
    countDate: dayValue.optional(),
    note: opt(text(1000)),
  })
  .strict();
export type CreateCountInput = z.output<typeof CreateCountBody>;

export const UpdateCountBody = z
  .object({
    locationIds: z.array(id).min(1).max(20).optional(),
    itemId: opt(id),
    countDate: dayValue.optional(),
    note: opt(text(1000)),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateCountInput = z.output<typeof UpdateCountBody>;

/** Counted quantities, many at once (null clears a count; 0 is a real count). */
export const CountEntriesBody = z
  .object({
    entries: z
      .array(
        z.object({ lineId: id, countedQuantity: amount.nullable(), note: opt(text(300)) }).strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();
export type CountEntriesInput = z.output<typeof CountEntriesBody>;

/** Stock found that the count did not expect (system quantity 0). */
export const CountLineBody = z
  .object({
    locationId: id,
    itemId: id,
    lotId: opt(id),
    newLotNumber: opt(lotNumber),
    newLotExpiry: opt(dayValue),
    countedQuantity: amount,
    note: opt(text(300)),
  })
  .strict();
export type CountLineInput = z.output<typeof CountLineBody>;

export const TransferListQuery = z
  .object({
    status: param(z.enum(['DRAFT', 'POSTED', 'CANCELLED'])),
    locationId: param(id),
    branchId: param(id),
    q,
    ...dateRange,
    ...page,
  })
  .strict();
export const AdjustmentListQuery = z
  .object({
    status: param(z.enum(['DRAFT', 'SUBMITTED', 'POSTED', 'REJECTED', 'CANCELLED'])),
    reason: param(z.enum(ADJUSTMENT_REASONS)),
    locationId: param(id),
    branchId: param(id),
    q,
    ...dateRange,
    ...page,
  })
  .strict();
export const CountListQuery = z
  .object({
    status: param(z.enum(['DRAFT', 'COUNTING', 'REVIEW', 'POSTED', 'CANCELLED'])),
    locationId: param(id),
    branchId: param(id),
    q,
    ...dateRange,
    ...page,
  })
  .strict();
export type DocListInput = Omit<z.output<typeof TransferListQuery>, 'status'> & {
  status?: string;
  reason?: AdjustmentReason;
};

// ---------------------------------------------------------------- EP35 sales fulfilment
// Every quantity is checked against the reservation / pick / pack it comes from and
// the order line's unit; numbers, statuses, identities (location, lot, item) and the
// order's branch are the server's. A client never names a lot or location.

export const PICK_DISCREPANCIES = [
  'SHORT_PICKED',
  'DAMAGED',
  'MISSING',
  'WRONG_ITEM',
  'OTHER',
] as const;
export const DELIVERY_EXCEPTIONS = [
  'FAILED_ATTEMPT',
  'RECIPIENT_UNAVAILABLE',
  'ADDRESS_ISSUE',
  'DAMAGED_IN_TRANSIT',
  'LOST_IN_TRANSIT',
  'OTHER',
] as const;

const lines100 = <T extends z.ZodType>(line: T) => z.array(line).min(1).max(100);

/** A pick of a confirmed order: every unclaimed reservation, or named ones (allocationId + quantity). */
export const CreatePickBody = z
  .object({
    salesOrderId: id,
    lines: lines100(z.object({ allocationId: id, quantity: positive }).strict()).optional(),
    note: opt(text(1000)),
  })
  .strict();
export type CreatePickInput = z.output<typeof CreatePickBody>;

/** Confirming a pick: what was actually picked per line; less than planned names why. */
export const ConfirmPickBody = z
  .object({
    lines: lines100(
      z
        .object({
          lineId: id,
          pickedQuantity: amount,
          discrepancy: opt(z.enum(PICK_DISCREPANCIES)),
          discrepancyNote: opt(text(300)),
        })
        .strict(),
    ),
  })
  .strict();
export type ConfirmPickInput = z.output<typeof ConfirmPickBody>;

/** A pack: everything picked and not yet packed, or named pick lines + quantity. */
export const CreatePackBody = z
  .object({
    salesOrderId: id,
    lines: lines100(z.object({ pickLineId: id, quantity: positive }).strict()).optional(),
    packageCount: z.number().int().min(1).max(9999).optional(),
    packageReference: opt(text(60)),
    note: opt(text(1000)),
  })
  .strict();
export type CreatePackInput = z.output<typeof CreatePackBody>;

/** A shipment: every PACKED pack of the order not yet shipped, or named packs. */
export const CreateShipmentBody = z
  .object({
    salesOrderId: id,
    packIds: z.array(id).min(1).max(50).optional(),
    shipToName: opt(text(200)),
    shipToAddress: opt(text(500)),
    carrier: opt(text(100)),
    trackingReference: opt(text(100)),
    note: opt(text(1000)),
  })
  .strict();
export type CreateShipmentInput = z.output<typeof CreateShipmentBody>;

export const DispatchBody = z
  .object({ handedOverTo: opt(text(200)), note: opt(text(1000)) })
  .strict();
export type DispatchInput = z.output<typeof DispatchBody>;

/** Delivered now: all that is outstanding, or per shipment line (≤ its outstanding). */
export const DeliverBody = z
  .object({
    lines: lines100(z.object({ lineId: id, quantity: positive }).strict()).optional(),
    recipientName: opt(text(200)),
    reference: opt(text(100)),
    note: opt(text(1000)),
    deliveredAt: instant.optional(),
  })
  .strict();
export type DeliverInput = z.output<typeof DeliverBody>;

export const DeliveryExceptionBody = z
  .object({
    reason: z.enum(DELIVERY_EXCEPTIONS),
    note: opt(text(1000)),
    occurredAt: instant.optional(),
  })
  .strict();
export type DeliveryExceptionInput = z.output<typeof DeliveryExceptionBody>;

const fulfilmentList = (statuses: readonly [string, ...string[]]) =>
  z
    .object({
      status: param(z.enum(statuses)),
      branchId: param(id),
      salesOrderId: param(id),
      q,
      ...page,
    })
    .strict();
export const PickListQuery = fulfilmentList(['DRAFT', 'IN_PROGRESS', 'PICKED', 'CANCELLED']);
export const PackListQuery = fulfilmentList(['DRAFT', 'PACKED', 'DISPATCHED', 'CANCELLED']);
export const ShipmentListQuery = fulfilmentList([
  'READY',
  'DISPATCHED',
  'DELIVERED',
  'DELIVERY_EXCEPTION',
  'CANCELLED',
]);
export type FulfilmentListInput = z.output<typeof PickListQuery>;
