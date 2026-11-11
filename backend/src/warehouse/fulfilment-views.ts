import { z } from 'zod';
import { LINE_SUMMARY_KEYS, LineSummary } from '../lib/line-summary.js';
import type { DataClass } from '../domain/access/data-classification.js';
import { DELIVERY_EXCEPTIONS, PICK_DISCREPANCIES } from './input.js';
import { expiryState } from './views.js';

/*
 * Response contracts for EP35 sales fulfilment (picks, packs, shipments) — the
 * same ALLOW-LIST rule as every Warehouse view: the service builds a projection
 * and parses it here; a key not named never reaches the client. Operational
 * only: order number and dates, items, units, quantities, locations, lots,
 * expiry, people, and — on a shipment only — where it goes (ship-to name and
 * address, carrier, tracking, recipient). No price, discount, tax, total,
 * amount, cost, deposit, payment, customer code / tax id or order note, ever
 * (tested key by key and value by value).
 */

const ref = z.object({ id: z.string(), code: z.string(), name: z.string() });
const person = z.object({ name: z.string() }).nullable();
const unit = z.object({ code: z.string(), precision: z.number() });
const lot = z
  .object({ id: z.string(), lotNumber: z.string(), expiryDate: z.string().nullable() })
  .nullable();
const order = z.object({
  id: z.string(),
  number: z.string(),
  status: z.string(),
  requestedDate: z.string().nullable(),
});
const timelineEntry = z.object({ type: z.string(), at: z.string(), actor: person });

const common = {
  id: z.string(),
  number: z.string(),
  branch: ref,
  order,
  lineCount: z.number(),
  createdBy: person,
  createdAt: z.string(),
  updatedAt: z.string(),
};

// ---------------------------------------------------------------- picks

export const PickRow = z.object({
  ...common,
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'PICKED', 'CANCELLED']),
  /** EP42.3: first line (item, planned quantity, unit) and how many more — operational. */
  summary: LineSummary.optional(),
});

const pickLine = z.object({
  id: z.string(),
  lineNo: z.number(),
  orderLineNo: z.number(),
  item: ref,
  unit,
  location: ref,
  lot,
  expiryState,
  planned: z.string(),
  picked: z.string().nullable(),
  /** Picked and not yet packed (what a new pack can take). */
  toPack: z.string(),
  packed: z.string(),
  dispatched: z.string(),
  discrepancy: z.enum(PICK_DISCREPANCIES).nullable(),
  discrepancyNote: z.string().nullable(),
});

export const PickView = PickRow.extend({
  note: z.string().nullable(),
  startedAt: z.string().nullable(),
  startedBy: person,
  pickedAt: z.string().nullable(),
  pickedBy: person,
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  lines: z.array(pickLine),
  actions: z.array(z.enum(['start', 'confirm', 'cancel', 'pack'])),
});

// ---------------------------------------------------------------- packs

export const PackRow = z.object({
  ...common,
  status: z.enum(['DRAFT', 'PACKED', 'DISPATCHED', 'CANCELLED']),
  packageCount: z.number(),
  packageReference: z.string().nullable(),
  shipment: z.object({ id: z.string(), number: z.string() }).nullable(),
  /** EP42.4: first line (item, quantity, unit) and how many more — operational only. */
  summary: LineSummary.optional(),
});

const packLine = z.object({
  id: z.string(),
  lineNo: z.number(),
  pick: z.object({ id: z.string(), number: z.string() }),
  item: ref,
  unit,
  location: ref,
  lot,
  quantity: z.string(),
});

export const PackView = PackRow.extend({
  note: z.string().nullable(),
  packedAt: z.string().nullable(),
  packedBy: person,
  dispatchedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  lines: z.array(packLine),
  actions: z.array(z.enum(['confirm', 'cancel', 'ship'])),
});

// ---------------------------------------------------------------- shipments

const shipmentStatus = z.enum([
  'READY',
  'DISPATCHED',
  'DELIVERED',
  'DELIVERY_EXCEPTION',
  'CANCELLED',
]);

export const ShipmentRow = z.object({
  ...common,
  status: shipmentStatus,
  shipToName: z.string(),
  carrier: z.string().nullable(),
  trackingReference: z.string().nullable(),
  dispatchedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  /** EP42.4: first line (item, quantity, unit) and how many more — operational only. */
  summary: LineSummary.optional(),
});

const shipmentLine = z.object({
  id: z.string(),
  lineNo: z.number(),
  pack: z.object({ id: z.string(), number: z.string() }),
  item: ref,
  unit,
  location: ref,
  lot,
  quantity: z.string(),
  delivered: z.string(),
  /** Dispatched and not (yet) confirmed delivered. */
  outstanding: z.string(),
});

const deliveryEvent = z.object({
  type: z.enum(['DELIVERED', 'PARTIALLY_DELIVERED', 'EXCEPTION']),
  reason: z.enum([...DELIVERY_EXCEPTIONS, 'PARTIAL_DELIVERY']).nullable(),
  recipientName: z.string().nullable(),
  reference: z.string().nullable(),
  note: z.string().nullable(),
  occurredAt: z.string(),
  recordedBy: person,
});

export const ShipmentView = ShipmentRow.extend({
  shipToAddress: z.string().nullable(),
  note: z.string().nullable(),
  handedOverTo: z.string().nullable(),
  dispatchedBy: person,
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  packs: z.array(z.object({ id: z.string(), number: z.string(), packageCount: z.number() })),
  lines: z.array(shipmentLine),
  /** For a READY shipment: is every line still covered by its ACTIVE reservation? */
  reservationOk: z.boolean().nullable(),
  events: z.array(deliveryEvent),
  actions: z.array(z.enum(['cancel', 'dispatch', 'deliver', 'exception'])),
});

export const Timeline = z.array(timelineEntry);

/** Every EP35 key Warehouse can receive — all operational (checked by a test). */
export const FULFILMENT_FIELD_CLASSES: Record<string, DataClass> = Object.fromEntries(
  [
    ...Object.keys(PickView.shape),
    ...Object.keys(pickLine.shape),
    ...Object.keys(PackView.shape),
    ...Object.keys(packLine.shape),
    ...Object.keys(ShipmentView.shape),
    ...Object.keys(shipmentLine.shape),
    ...Object.keys(deliveryEvent.shape),
    ...Object.keys(order.shape),
    ...Object.keys(PickRow.shape),
    ...LINE_SUMMARY_KEYS,
  ].map((k) => [k, 'operational' as const]),
);
