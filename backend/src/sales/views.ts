import { z } from 'zod';
import type { DataClass } from '../domain/access/data-classification.js';
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

export const SoRow = z.object({
  id: z.string(),
  number: z.string(),
  status,
  branch: ref,
  customer: z.object({ id: z.string(), code: z.string(), name: z.string() }),
  orderDate: z.string(),
  requestedDate: z.string().nullable(),
  lineCount: z.number(),
  currency: z.string(),
  grandTotal: z.string(),
  /** Now, from the ledger — informational, never a reservation (null for CANCELLED). */
  availability: availability.nullable(),
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
      available: z.string().nullable(),
      shortage: z.string().nullable(),
    })
    .nullable(),
  /**
   * The fulfilment contract (EP34 / EP35). EP33 has only `ordered`; the others
   * stay null until allocation, picking and delivery exist — never faked.
   */
  progress: z.object({
    ordered: z.string(),
    allocated: z.null(),
    picked: z.null(),
    delivered: z.null(),
    outstanding: z.null(),
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
  actions: z.array(z.enum(['edit', 'submit', 'confirm', 'cancel'])),
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
  [...Object.keys(SoView.shape), ...Object.keys(soLine.shape), ...Object.keys(SoItem.shape)].map(
    (k) => [k, COMMERCIAL.has(k) ? 'commercial' : 'operational'],
  ),
);
