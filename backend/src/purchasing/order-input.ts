import { z } from 'zod';
import { quantityValue } from './input.js';

/*
 * Request schemas for purchase orders (EP30). Strict objects: what the server
 * owns — company, branch, number, status, creator / issuer, supplier and item
 * snapshots, line numbers, line amounts, totals, the deposit amount of a
 * percentage deposit, the deposit status — is refused with 400, never
 * ignored. Every status change is its own action (issue / cancel / deposit
 * confirm / waive). Money and quantities travel as decimal STRINGS.
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

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid date')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'invalid date');

/** Non-negative decimal text with at most `places` decimals (12 integer digits). */
const decimalText = (places: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{1,12}(\\.\\d{1,${places}})?$`), `at most ${places} decimal places`);

export const unitPriceValue = decimalText(4);
export const amountValue = decimalText(2);
/** 0–100, at most 2 decimals. */
export const taxRateValue = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'invalid tax rate')
  .refine((v) => Number(v) <= 100, 'tax rate is at most 100');

const currency = z.string().regex(/^[A-Z]{3}$/, 'ISO 4217 code');

const lineFields = {
  quantity: quantityValue,
  unitPrice: unitPriceValue.optional(),
  discountAmount: amountValue.optional(),
  taxRate: taxRateValue.optional(),
  note: opt(text(500)),
};

export const NewLineBody = z.object({ purchaseRequestLineId: id, ...lineFields }).strict();
export type NewLineInput = z.output<typeof NewLineBody>;

export const LineUpdateBody = z
  .object({
    quantity: quantityValue.optional(),
    unitPrice: unitPriceValue.optional(),
    discountAmount: amountValue.optional(),
    taxRate: taxRateValue.optional(),
    note: opt(text(500)),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type LineUpdateInput = z.output<typeof LineUpdateBody>;

/** The deposit as Purchasing sets it on a DRAFT: none, a fixed amount, or a percentage. */
const deposit = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NONE') }).strict(),
  z
    .object({
      type: z.literal('AMOUNT'),
      value: amountValue.refine((v) => /[1-9]/.test(v), 'must be greater than zero'),
      dueDate: opt(day),
      note: opt(text(300)),
    })
    .strict(),
  z
    .object({
      type: z.literal('PERCENT'),
      value: z
        .string()
        .trim()
        .regex(/^\d{1,3}(\.\d{1,2})?$/, 'invalid percentage')
        .refine((v) => Number(v) > 0 && Number(v) <= 100, 'between 0 and 100'),
      dueDate: opt(day),
      note: opt(text(300)),
    })
    .strict(),
]);
export type DepositInput = z.output<typeof deposit>;

const header = {
  supplierId: opt(id),
  currency: currency.optional(),
  expectedDate: opt(day),
  paymentTerms: opt(text(300)),
  note: opt(text(1000)),
  deposit: deposit.optional(),
};

/**
 * A new DRAFT from one APPROVED request. `lines` picks request lines and
 * quantities; omitted, every line with a remaining quantity is ordered in full
 * (prices to fill in).
 */
export const CreateOrderBody = z
  .object({
    purchaseRequestId: id,
    ...header,
    lines: z.array(NewLineBody).min(1).max(100).optional(),
  })
  .strict();
export type CreateOrderInput = z.output<typeof CreateOrderBody>;

export const UpdateOrderBody = z
  .object(header)
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateOrderInput = z.output<typeof UpdateOrderBody>;

export const CancelBody = z.object({ reason: opt(text(500)) }).strict();
export const WaiveBody = z.object({ reason: text(500) }).strict();
/** A payment reference (e.g. a transfer slip number) — never account numbers or credentials. */
export const ConfirmDepositBody = z.object({ reference: opt(text(100)) }).strict();

export const LineParams = z.object({ id, lineId: id });

const param = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

export const PO_STATUSES = [
  'DRAFT',
  'ISSUED',
  'WAITING_DEPOSIT',
  'PENDING_RECEIVE',
  'CANCELLED',
] as const;

export const OrderListQuery = z
  .object({
    status: param(z.enum(PO_STATUSES)),
    /** `open`: DRAFT, WAITING_DEPOSIT and PENDING_RECEIVE. */
    view: param(z.enum(['all', 'open'])),
    branchId: param(id),
    supplierId: param(id),
    purchaseRequestId: param(id),
    q: param(z.string().trim().min(1).max(100)),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type OrderListInput = z.output<typeof OrderListQuery>;

export const QueueQuery = z
  .object({
    branchId: param(id),
    q: param(z.string().trim().min(1).max(100)),
    /** Accounting: `pending` (default) or every deposit order. */
    view: param(z.enum(['pending', 'all'])),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type QueueInput = z.output<typeof QueueQuery>;

export const SearchQuery = z.object({ q: param(z.string().trim().min(1).max(100)) }).strict();
