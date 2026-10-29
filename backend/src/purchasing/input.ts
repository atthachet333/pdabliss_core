import { z } from 'zod';
import { DEPARTMENT_CODES } from '../billing/catalog.js';

/*
 * Request schemas for purchase requests (EP29). Strict objects: what the
 * server owns — company, branch, number, requester, status, decision fields,
 * item / unit snapshots, line numbers — is refused with 400, never ignored.
 * Status changes have their own actions (submit / approve / reject / cancel).
 * Quantities travel as decimal STRINGS (never JSON numbers / floats).
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

/** YYYY-MM-DD (a calendar day, no time). */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid date')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'invalid date');

/** A positive exact decimal as text: up to 12 integer and 6 decimal digits. */
export const quantityValue = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,6})?$/, 'invalid quantity')
  .refine((v) => /[1-9]/.test(v), 'quantity must be greater than zero');

const department = z.enum(DEPARTMENT_CODES);

const itemLine = z
  .object({
    type: z.literal('ITEM'),
    itemId: id,
    quantity: quantityValue,
    note: opt(text(500)),
  })
  .strict();
const nonItemLine = z
  .object({
    type: z.literal('NON_ITEM'),
    description: text(300),
    quantity: quantityValue,
    /** A canonical unit, or a short free unit text (not both). */
    unitId: opt(id),
    unitText: opt(text(30)),
    note: opt(text(500)),
  })
  .strict()
  .refine((v) => !(v.unitId && v.unitText), { message: 'unitId or unitText, not both' });

export const LineBody = z.discriminatedUnion('type', [itemLine, nonItemLine]);
export type LineInput = z.output<typeof LineBody>;

export const CreateBody = z
  .object({
    department,
    purpose: opt(text(1000)),
    needByDate: opt(day),
    lines: z.array(LineBody).max(100).default([]),
  })
  .strict();
export type CreateInput = z.output<typeof CreateBody>;

export const UpdateBody = z
  .object({
    department: department.optional(),
    purpose: opt(text(1000)),
    needByDate: opt(day),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateInput = z.output<typeof UpdateBody>;

export const ReasonBody = z.object({ reason: text(500) }).strict();
export const OptionalReasonBody = z.object({ reason: opt(text(500)) }).strict();

export const LineParams = z.object({ id, lineId: id });

/** `?x=` with an empty value means "not set". */
const param = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

export const PR_VIEWS = ['all', 'mine', 'department', 'queue'] as const;

export const ListQuery = z
  .object({
    view: param(z.enum(PR_VIEWS)),
    status: param(z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'])),
    department: param(department),
    branchId: param(id),
    q: param(z.string().trim().min(1).max(100)),
    from: param(day),
    to: param(day),
    sort: param(z.enum(['updated', 'number'])),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type ListInput = z.output<typeof ListQuery>;

export const OptionsQuery = z.object({ q: param(z.string().trim().min(1).max(100)) }).strict();
