import { z } from 'zod';
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

const status = z.enum(['DRAFT', 'ISSUED', 'WAITING_DEPOSIT', 'PENDING_RECEIVE', 'CANCELLED']);

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
  lineCount: z.number(),
  lines: z.array(operationalLine),
});
export type WarehousePendingReceiveView = z.infer<typeof WarehousePendingReceiveView>;
/** A queue row: the same allow-list without the lines. */
export const WarehousePendingReceiveRow = WarehousePendingReceiveView.omit({ lines: true });

/** The classes of every Warehouse key (top level and line) — all operational. */
export const WAREHOUSE_FIELD_CLASSES: Record<string, DataClass> = Object.fromEntries(
  [...Object.keys(WarehousePendingReceiveView.shape), ...Object.keys(operationalLine.shape)].map(
    (k) => [k, 'operational' as const],
  ),
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
  lineCount: z.number(),
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
    }),
  ),
  requests: z.array(z.object({ id: z.string(), number: z.string() })),
  actions: z.array(z.enum(['edit', 'issue', 'cancel', 'confirm_deposit', 'waive_deposit'])),
});
export type PurchasingPOView = z.infer<typeof PurchasingPOView>;
