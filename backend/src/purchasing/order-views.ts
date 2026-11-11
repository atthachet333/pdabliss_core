import { z } from 'zod';
import { LINE_SUMMARY_KEYS, LineSummary } from '../lib/line-summary.js';
import type { DataClass } from '../domain/access/data-classification.js';

/*
 * Purchase-order response contracts (EP30), one per audience. Each is an
 * ALLOW-LIST: the service builds a projection and parses it through the
 * schema, and `z.object` drops every key the schema does not name — so a
 * field added to the projection by mistake never reaches that audience.
 *
 *   PurchasingPOView           Purchasing (and the Owner): everything, with actions
 *   AccountingDepositView      Accounting: order amounts + the deposit, no editing
 *   WarehousePendingReceiveView Warehouse: what arrives and how much — NEVER a
 *                              price, discount, tax, total, deposit or supplier terms
 *   ExecutivePOView            Executive: a read-only summary
 *
 * Field classes (src/domain/access/data-classification.ts): Warehouse is
 * cleared for `operational` only — a test checks every Warehouse key below.
 */

const branch = z.object({ id: z.string(), code: z.string(), name: z.string() });
const person = z.object({ name: z.string() }).nullable();
const day = z.string().nullable();

const operationalLine = z.object({
  id: z.string(),
  lineNo: z.number(),
  type: z.enum(['ITEM', 'NON_ITEM']),
  item: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable(),
  description: z.string().nullable(),
  unit: z.object({ code: z.string().nullable(), name: z.string().nullable() }).nullable(),
  quantity: z.string(),
  request: z.object({ id: z.string(), number: z.string(), lineNo: z.number() }),
});

const commercialLine = operationalLine.extend({
  unitPrice: z.string(),
  discountAmount: z.string(),
  taxRate: z.string(),
  lineSubtotal: z.string(),
  lineTax: z.string(),
  lineTotal: z.string(),
});

const totals = z.object({
  subtotal: z.string(),
  discountTotal: z.string(),
  taxTotal: z.string(),
  grandTotal: z.string(),
});

const deposit = z.object({
  type: z.enum(['NONE', 'AMOUNT', 'PERCENT']),
  value: z.string().nullable(),
  amount: z.string().nullable(),
  dueDate: day,
  note: z.string().nullable(),
  status: z.enum(['NOT_REQUIRED', 'PENDING', 'CONFIRMED', 'WAIVED']),
  confirmedAt: z.string().nullable(),
  confirmedBy: person,
  reference: z.string().nullable(),
  waivedAt: z.string().nullable(),
  waivedBy: person,
  waiveReason: z.string().nullable(),
});

const status = z.enum([
  'DRAFT',
  'ISSUED',
  'WAITING_DEPOSIT',
  'PENDING_RECEIVE',
  'RECEIVED',
  'CANCELLED',
]);

/** EP31: receive progress (quantities and dates only) — the same for every audience. */
const receiveState = z.enum(['NOT_RECEIVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED']);
const receiving = z.object({ state: receiveState, receivedAt: z.string().nullable() });
const receiptRef = z.object({
  id: z.string(),
  number: z.string(),
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']),
  receivedAt: z.string(),
});
const lineReceiving = z.object({
  receivable: z.boolean(),
  received: z.string(),
  rejected: z.string(),
  remaining: z.string(),
});

const tracking = z.enum(['NONE', 'OPTIONAL', 'REQUIRED']).nullable();

/**
 * One line to receive (the EP30 → EP31 handoff). `receivedQuantity` is what
 * posted receipts accepted, `rejectedQuantity` what they refused, and
 * `pendingQuantity` what is still to receive (EP31 progress.ts). The lot /
 * expiry requirements are the item's current ones (null on a NON_ITEM line);
 * `receivable` is false for a service or a non-stock item.
 */
const receiveLine = operationalLine.extend({
  orderedQuantity: z.string(),
  receivedQuantity: z.string(),
  rejectedQuantity: z.string(),
  pendingQuantity: z.string(),
  receivable: z.boolean(),
  lotTracking: tracking,
  expiryTracking: tracking,
});

/** Warehouse: operational fields only. */
export const WarehousePendingReceiveView = z.object({
  id: z.string(),
  number: z.string(),
  status,
  branch,
  supplier: z.object({ code: z.string().nullable(), name: z.string().nullable() }),
  orderDate: z.string(),
  expectedDate: day,
  issuedAt: z.string().nullable(),
  pendingReceiveAt: z.string().nullable(),
  receiving,
  lineCount: z.number(),
  /** EP42.3: the first line still to receive (item, quantity to receive, unit) and how many more. */
  summary: LineSummary.optional(),
  lines: z.array(receiveLine),
  receipts: z.array(receiptRef),
});
export type WarehousePendingReceiveView = z.infer<typeof WarehousePendingReceiveView>;
/** A queue row: the same allow-list without the lines and receipts. */
export const WarehousePendingReceiveRow = WarehousePendingReceiveView.omit({
  lines: true,
  receipts: true,
});

/** The classes of every Warehouse key (top level and line) — all operational. */
export const WAREHOUSE_FIELD_CLASSES: Record<string, DataClass> = Object.fromEntries(
  [
    ...Object.keys(WarehousePendingReceiveView.shape),
    ...Object.keys(receiveLine.shape),
    ...Object.keys(receiving.shape),
    ...Object.keys(receiptRef.shape),
    ...LINE_SUMMARY_KEYS,
  ].map((k) => [k, 'operational' as const]),
);

/** Fields that are commercial or financial and must never reach Warehouse. */
export const NON_OPERATIONAL_FIELDS = [
  'unitPrice',
  'discountAmount',
  'taxRate',
  'lineSubtotal',
  'lineTax',
  'lineTotal',
  'totals',
  'subtotal',
  'discountTotal',
  'taxTotal',
  'grandTotal',
  'currency',
  'deposit',
  'paymentTerms',
  'note',
  'taxId',
  'address',
  'contactName',
  'phone',
  'email',
] as const;

export const ExecutivePOView = z.object({
  id: z.string(),
  number: z.string(),
  status,
  branch,
  supplier: z.object({ code: z.string().nullable(), name: z.string().nullable() }),
  currency: z.string(),
  orderDate: z.string(),
  expectedDate: day,
  issuedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  grandTotal: z.string(),
  deposit: z.object({ status: deposit.shape.status, amount: z.string().nullable() }),
  receiving,
  lineCount: z.number(),
  requests: z.array(z.object({ id: z.string(), number: z.string() })),
});
export type ExecutivePOView = z.infer<typeof ExecutivePOView>;

export const AccountingDepositView = z.object({
  id: z.string(),
  number: z.string(),
  status,
  branch,
  supplier: z.object({
    code: z.string().nullable(),
    name: z.string().nullable(),
    taxId: z.string().nullable(),
    taxBranch: z.string().nullable(),
  }),
  currency: z.string(),
  orderDate: z.string(),
  issuedAt: z.string().nullable(),
  issuedBy: person,
  paymentTerms: z.string().nullable(),
  totals,
  deposit,
  receiving,
  lineCount: z.number(),
  summary: LineSummary.optional(),
  lines: z.array(commercialLine),
  actions: z.array(z.enum(['confirm_deposit', 'waive_deposit'])),
});
export type AccountingDepositView = z.infer<typeof AccountingDepositView>;
export const AccountingDepositRow = AccountingDepositView.omit({ lines: true, actions: true });

export const PurchasingPOView = z.object({
  id: z.string(),
  number: z.string(),
  status,
  branch,
  supplier: z
    .object({
      id: z.string(),
      code: z.string().nullable(),
      name: z.string().nullable(),
      taxId: z.string().nullable(),
      taxBranch: z.string().nullable(),
      address: z.string().nullable(),
      contactName: z.string().nullable(),
      phone: z.string().nullable(),
      email: z.string().nullable(),
      active: z.boolean(),
    })
    .nullable(),
  currency: z.string(),
  orderDate: z.string(),
  expectedDate: day,
  paymentTerms: z.string().nullable(),
  note: z.string().nullable(),
  totals,
  deposit,
  createdBy: person,
  createdAt: z.string(),
  updatedAt: z.string(),
  issuedAt: z.string().nullable(),
  issuedBy: person,
  pendingReceiveAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  lineCount: z.number(),
  lines: z.array(
    commercialLine.extend({
      note: z.string().nullable(),
      /** The request line: requested, ordered on other issued orders, remaining (before this order). */
      request: operationalLine.shape.request.extend({
        requested: z.string(),
        orderedElsewhere: z.string(),
        remaining: z.string(),
      }),
      itemActive: z.boolean().nullable(),
      receiving: lineReceiving,
    }),
  ),
  receiving: receiving.extend({ receipts: z.array(receiptRef) }),
  requests: z.array(z.object({ id: z.string(), number: z.string() })),
  actions: z.array(z.enum(['edit', 'issue', 'cancel', 'confirm_deposit', 'waive_deposit'])),
});
export type PurchasingPOView = z.infer<typeof PurchasingPOView>;
