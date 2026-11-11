import { z } from 'zod';
import type { DataClass } from '../domain/access/data-classification.js';
import { LineSummary } from '../lib/line-summary.js';
import { AVAILABILITY } from './input.js';

/*
 * Sales order responses (EP33) — explicit allow-lists, parsed before sending.
 * Sales is cleared for operational + commercial data: selling price,
 * discount, tax and totals. There is no purchase cost, supplier price or
 * margin anywhere in Sales, and no Warehouse endpoint returns any of this.
 */

const ref = z.object({ id: z.string(), code: z.string(), name: z.string() });
const person = z.object({ name: z.string() }).nullable();
const status = z.enum(['DRAFT', 'SUBMITTED', 'CONFIRMED', 'CANCELLED']);
const availability = z.enum(AVAILABILITY);
/** EP34 — derived from ACTIVE reservations; null when nothing is to be allocated. */
const allocationState = z
  .enum(['NOT_ALLOCATED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED'])
  .nullable();
const pickReadiness = z.enum(['NOT_READY', 'PARTIALLY_READY', 'READY']).nullable();

export const FULFILMENT_STATES = [
  'NOT_STARTED',
  'PARTIALLY_PICKED',
  'PICKED',
  'PARTIALLY_DISPATCHED',
  'DISPATCHED',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'EXCEPTION',
] as const;

export const SoRow = z.object({
  id: z.string(),
  number: z.string(),
  status,
  branch: ref,
  customer: z.object({ id: z.string(), code: z.string(), name: z.string() }),
  orderDate: z.string(),
  requestedDate: z.string().nullable(),
  lineCount: z.number(),
  /** EP42.3: the first line (item, quantity, unit) and how many more — operational. */
  summary: LineSummary.optional(),
  currency: z.string(),
  grandTotal: z.string(),
  /** Now, from the ledger — informational, never a reservation (null for CANCELLED). */
  availability: availability.nullable(),
  allocationState,
  pickReadiness,
  /** EP39: the order's physical fulfilment (as on the order); null until confirmed. */
  fulfilmentState: z.enum(FULFILMENT_STATES).nullable().optional(),
  createdBy: person,
  updatedAt: z.string(),
});

const soLine = z.object({
  id: z.string(),
  lineNo: z.number(),
  item: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    type: z.string(),
    inventoryTracked: z.boolean(),
  }),
  unit: z.object({ code: z.string(), name: z.string(), precision: z.number() }),
  quantity: z.string(),
  unitPrice: z.string(),
  discountAmount: z.string(),
  taxRate: z.string(),
  lineSubtotal: z.string(),
  lineTax: z.string(),
  lineTotal: z.string(),
  note: z.string().nullable(),
  /** Derived now; null for a cancelled order. */
  availability: z
    .object({
      state: availability,
      onHand: z.string().nullable(),
      /** EP34: reserved by every order; available = what new demand can still get. */
      reserved: z.string().nullable(),
      available: z.string().nullable(),
      shortage: z.string().nullable(),
    })
    .nullable(),
  /** EP34, CONFIRMED tracked lines: reserved for this line, and what is still short. */
  allocation: z.object({ allocated: z.string(), shortage: z.string() }).nullable(),
  /**
   * The fulfilment contract (EP34 allocated, EP35 the rest): cumulative milestones
   * and two outstanding quantities, per line in its unit; null for a line that is
   * not inventory-tracked (no physical fulfilment) — never faked.
   */
  progress: z.object({
    ordered: z.string(),
    allocated: z.string().nullable(),
    picked: z.string().nullable(),
    packed: z.string().nullable(),
    dispatched: z.string().nullable(),
    delivered: z.string().nullable(),
    toDispatch: z.string().nullable(),
    toDeliver: z.string().nullable(),
  }),
});

export const SoView = SoRow.extend({
  customer: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    taxId: z.string().nullable(),
    taxBranch: z.string().nullable(),
  }),
  customerReference: z.string().nullable(),
  note: z.string().nullable(),
  subtotal: z.string(),
  discountTotal: z.string(),
  taxTotal: z.string(),
  taxTotalLabel: z.literal('exclusive'),
  shortageLines: z.number(),
  createdAt: z.string(),
  submittedAt: z.string().nullable(),
  submittedBy: person,
  confirmedAt: z.string().nullable(),
  confirmedBy: person,
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  lines: z.array(soLine),
  actions: z.array(
    z.enum(['edit', 'submit', 'confirm', 'cancel', 'allocate', 'release', 'reallocate']),
  ),
});

/** EP35: the order's physical fulfilment for Sales — shipment numbers, states and dates only. */
export const SoFulfilment = z.object({
  state: z.enum(FULFILMENT_STATES).nullable(),
  shipments: z.array(
    z.object({
      number: z.string(),
      status: z.enum(['READY', 'DISPATCHED', 'DELIVERED', 'DELIVERY_EXCEPTION']),
      dispatchedAt: z.string().nullable(),
      deliveredAt: z.string().nullable(),
      exception: z.string().nullable(),
    }),
  ),
});

/** What one allocate / reallocate did (quantities only — no location or lot for Sales). */
export const SoAllocationResult = z.object({
  state: allocationState,
  pickReadiness,
  allocatedNow: z.string(),
  lines: z.array(
    z.object({
      lineNo: z.number(),
      ordered: z.string(),
      allocatedNow: z.string(),
      totalAllocated: z.string(),
      shortage: z.string(),
    }),
  ),
});

/** An item a sales line can name, with the branch's availability (no cost, no location / lot). */
export const SoItem = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  inventoryTracked: z.boolean(),
  unit: z.object({ code: z.string(), name: z.string(), precision: z.number() }),
  available: z.string().nullable(),
});

const COMMERCIAL = new Set([
  'unitPrice',
  'discountAmount',
  'taxRate',
  'lineSubtotal',
  'lineTax',
  'lineTotal',
  'subtotal',
  'discountTotal',
  'taxTotal',
  'taxTotalLabel',
  'grandTotal',
  'currency',
]);

/** Every key a Sales order response can carry, with its class (checked by a test). */
export const SALES_FIELD_CLASSES: Record<string, DataClass> = Object.fromEntries(
  [
    ...Object.keys(SoView.shape),
    ...Object.keys(soLine.shape),
    ...Object.keys(SoItem.shape),
    ...Object.keys(SoAllocationResult.shape),
    ...Object.keys(SoFulfilment.shape),
  ].map((k) => [k, COMMERCIAL.has(k) ? 'commercial' : 'operational']),
);
