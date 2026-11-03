import { z } from 'zod';
import { amountValue, taxRateValue, unitPriceValue } from '../purchasing/order-input.js';
import { quantityValue } from '../purchasing/input.js';
import { dayValue } from '../warehouse/input.js';

/*
 * Request schemas for sales orders (EP33). Strict objects: what the server owns
 * — company, branch, number, status, customer / item / unit snapshots, line
 * numbers, line amounts, totals, availability, the people and times of each
 * step (and any allocated / picked / delivered quantity) — is refused with 400,
 * never ignored. Status changes are their own actions. Money and quantities
 * travel as decimal STRINGS.
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
/** A real calendar day (2026-02-30 is refused, never rolled over). */
const day = dayValue;
const param = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), s.optional());

export const SoLineBody = z
  .object({
    itemId: id,
    quantity: quantityValue,
    unitPrice: unitPriceValue,
    discountAmount: amountValue.optional(),
    taxRate: taxRateValue.optional(),
    note: opt(text(500)),
  })
  .strict();
export type SoLineInput = z.output<typeof SoLineBody>;

const header = {
  customerId: id,
  orderDate: day.optional(),
  requestedDate: opt(day),
  customerReference: opt(text(60)),
  note: opt(text(1000)),
};

export const CreateSoBody = z
  .object({ ...header, lines: z.array(SoLineBody).max(100).optional() })
  .strict();
export type CreateSoInput = z.output<typeof CreateSoBody>;

export const UpdateSoBody = z
  .object({ ...header, customerId: id.optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateSoInput = z.output<typeof UpdateSoBody>;

export const SoLinesBody = z.object({ lines: z.array(SoLineBody).max(100) }).strict();
export const SoReasonBody = z.object({ reason: opt(text(500)) }).strict();
/** EP34 allocate / release / reallocate: the server decides every quantity, location and lot. */
export const SoNoBody = z.object({}).strict();

export const SO_STATUSES = ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'CANCELLED'] as const;
export const AVAILABILITY = [
  'AVAILABLE',
  'PARTIALLY_AVAILABLE',
  'UNAVAILABLE',
  'NOT_STOCK_TRACKED',
] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const SoListQuery = z
  .object({
    status: param(z.enum(SO_STATUSES)),
    branchId: param(id),
    customerId: param(id),
    /** SHORTAGE: open (submitted / confirmed) orders with a line short of stock now. */
    availability: param(z.enum(['SHORTAGE'])),
    from: param(day),
    to: param(day),
    q: param(z.string().trim().min(1).max(100)),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type SoListInput = z.output<typeof SoListQuery>;

export const SoItemQuery = z
  .object({ q: param(z.string().trim().min(1).max(100)), branchId: param(id) })
  .strict();
