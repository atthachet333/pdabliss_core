import { z } from 'zod';
import { normalizePhone } from '../auth/profile.js';

/*
 * Request schemas for operational master data (EP28). Every object is
 * strict: what the server owns — company, status, code after creation, item
 * type after creation, counters, audit fields, ids of the actor — is refused
 * with 400, never silently ignored. References (unit, category, parent,
 * branch) are ids, re-checked inside the caller's company by the service.
 * Status changes have their own endpoints (deactivate / reactivate).
 */

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
// eslint-disable-next-line no-control-regex
const LINE_CONTROL = /[\u0000-\u001f\u007f]/;

/** One line of business text (a name), trimmed, no control characters, NFC. */
const line = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !LINE_CONTROL.test(v), 'invalid characters')
    .transform((v) => v.replace(/\s+/g, ' ').normalize('NFC'));

/** Free text that may span lines (address, notes). */
const block = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !CONTROL.test(v), 'invalid characters')
    .transform((v) => v.replace(/\r\n?/g, '\n').normalize('NFC'));

/** Optional on create; `null` or '' clears it on update. */
const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    schema.nullable().optional(),
  );

/** A business code: upper-cased; letters, digits and . _ / - ; starts and ends alphanumeric. */
export const codeValue = (max: number) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .max(max)
    .regex(/^[A-Z0-9]([A-Z0-9._/-]*[A-Z0-9])?$/, 'invalid code');

/** A tax id as entered, normalized: no spaces / dashes / dots, upper case, 3–30 letters or digits. */
const taxIdValue = z
  .string()
  .max(40)
  .transform((v) => v.replace(/[\s.-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{3,30}$/, 'invalid tax ID'));

const phoneValue = z
  .string()
  .max(32)
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'invalid phone number' });
      return z.NEVER;
    }
    return phone;
  });

const emailValue = z.string().trim().max(254).pipe(z.email());

/** SKU / barcode: an identifier, upper-cased, no spaces. */
const identifier = z
  .string()
  .trim()
  .toUpperCase()
  .max(64)
  .regex(/^[A-Z0-9][A-Z0-9._/-]*$/, 'invalid identifier');

const id = z.string().min(1).max(64);

const MASTER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
const TRACKING = ['NONE', 'OPTIONAL', 'REQUIRED'] as const;
export const ITEM_TYPES = [
  'FINISHED_GOOD',
  'RAW_MATERIAL',
  'PACKAGING',
  'CONSUMABLE',
  'NON_STOCK',
] as const;

// ---------------------------------------------------------------- customers

const customerFields = {
  kind: z.enum(['INDIVIDUAL', 'BUSINESS']),
  name: line(200),
  legalName: opt(line(200)),
  taxId: opt(taxIdValue),
  taxBranch: opt(line(40)),
  contactName: opt(line(120)),
  phone: opt(phoneValue),
  email: opt(emailValue),
  lineId: opt(line(60)),
  billingAddress: opt(block(500)),
  shippingAddress: opt(block(500)),
  notes: opt(block(2000)),
};

export const CustomerCreateBody = z
  .object({
    ...customerFields,
    code: opt(codeValue(32)),
    kind: customerFields.kind.default('BUSINESS'),
  })
  .strict();
export const CustomerUpdateBody = z
  .object({ ...customerFields, kind: customerFields.kind.optional(), name: line(200).optional() })
  .strict();
export type CustomerCreateInput = z.output<typeof CustomerCreateBody>;
export type CustomerUpdateInput = z.output<typeof CustomerUpdateBody>;

// ---------------------------------------------------------------- suppliers

const supplierFields = {
  name: line(200),
  legalName: opt(line(200)),
  taxId: opt(taxIdValue),
  taxBranch: opt(line(40)),
  contactName: opt(line(120)),
  phone: opt(phoneValue),
  email: opt(emailValue),
  address: opt(block(500)),
  notes: opt(block(2000)),
};

export const SupplierCreateBody = z
  .object({ ...supplierFields, code: opt(codeValue(32)) })
  .strict();
export const SupplierUpdateBody = z
  .object({ ...supplierFields, name: line(200).optional() })
  .strict();
export type SupplierCreateInput = z.output<typeof SupplierCreateBody>;
export type SupplierUpdateInput = z.output<typeof SupplierUpdateBody>;

// -------------------------------------------------------------------- units

export const UnitCreateBody = z
  .object({
    code: codeValue(16),
    name: line(60),
    symbol: opt(line(16)),
    precision: z.number().int().min(0).max(6).default(0),
  })
  .strict();
export const UnitUpdateBody = z
  .object({
    name: line(60).optional(),
    symbol: opt(line(16)),
    precision: z.number().int().min(0).max(6).optional(),
  })
  .strict();
export type UnitCreateInput = z.output<typeof UnitCreateBody>;
export type UnitUpdateInput = z.output<typeof UnitUpdateBody>;

// --------------------------------------------------------------- categories

export const CategoryCreateBody = z
  .object({ code: codeValue(32), name: line(120), description: opt(block(1000)) })
  .strict();
export const CategoryUpdateBody = z
  .object({ name: line(120).optional(), description: opt(block(1000)) })
  .strict();
export type CategoryCreateInput = z.output<typeof CategoryCreateBody>;
export type CategoryUpdateInput = z.output<typeof CategoryUpdateBody>;

// -------------------------------------------------------------------- items

/** Base unit and tracking — changed only through the structure policy (policy.ts). */
const structureFields = {
  baseUnitId: id,
  inventoryTracked: z.boolean(),
  lotTracking: z.enum(TRACKING),
  expiryTracking: z.enum(TRACKING),
};

export const ItemCreateBody = z
  .object({
    code: opt(codeValue(32)),
    type: z.enum(ITEM_TYPES),
    name: line(200),
    description: opt(block(1000)),
    sku: opt(identifier),
    barcode: opt(identifier),
    categoryId: opt(id),
    baseUnitId: structureFields.baseUnitId,
    inventoryTracked: structureFields.inventoryTracked.optional(),
    lotTracking: structureFields.lotTracking.default('NONE'),
    expiryTracking: structureFields.expiryTracking.default('NONE'),
  })
  .strict();
export const ItemUpdateBody = z
  .object({
    name: line(200).optional(),
    description: opt(block(1000)),
    sku: opt(identifier),
    barcode: opt(identifier),
    categoryId: opt(id),
  })
  .strict();
export const ItemStructureBody = z
  .object({
    baseUnitId: structureFields.baseUnitId.optional(),
    inventoryTracked: structureFields.inventoryTracked.optional(),
    lotTracking: structureFields.lotTracking.optional(),
    expiryTracking: structureFields.expiryTracking.optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'nothing to change');
export type ItemCreateInput = z.output<typeof ItemCreateBody>;
export type ItemUpdateInput = z.output<typeof ItemUpdateBody>;
export type ItemStructureInput = z.output<typeof ItemStructureBody>;

// ---------------------------------------------------------------- locations

export const LocationCreateBody = z
  .object({
    branchId: id,
    code: codeValue(32),
    name: line(120),
    description: opt(block(500)),
    parentId: opt(id),
    isDefault: z.boolean().default(false),
  })
  .strict();
export const LocationUpdateBody = z
  .object({
    name: line(120).optional(),
    description: opt(block(500)),
    parentId: opt(id),
    isDefault: z.boolean().optional(),
  })
  .strict();
export type LocationCreateInput = z.output<typeof LocationCreateBody>;
export type LocationUpdateInput = z.output<typeof LocationUpdateBody>;

// -------------------------------------------------------------------- lists

/** `?x=` with an empty value means "not set" (a cleared filter in the UI). */
const param = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

/** Sorting is a closed list mapped to columns by the service — never a raw field name. */
export const SORTS = ['code', 'name', 'updated'] as const;

const listBase = {
  q: param(z.string().trim().min(1).max(100)),
  status: param(z.enum(MASTER_STATUSES)),
  sort: param(z.enum(SORTS)),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const ListQuery = z.object(listBase).strict();
export const CustomerListQuery = z
  .object({ ...listBase, kind: param(z.enum(['INDIVIDUAL', 'BUSINESS'])) })
  .strict();
export const ItemListQuery = z
  .object({
    ...listBase,
    type: param(z.enum(ITEM_TYPES)),
    categoryId: param(id),
    inventoryTracked: param(bool),
    /** TRACKED = OPTIONAL or REQUIRED (any lot / expiry tracking). */
    lotTracking: param(z.enum([...TRACKING, 'TRACKED'])),
    expiryTracking: param(z.enum([...TRACKING, 'TRACKED'])),
  })
  .strict();
export const LocationListQuery = z.object({ ...listBase, branchId: param(id) }).strict();

export type ListInput = z.output<typeof ListQuery>;
export type CustomerListInput = z.output<typeof CustomerListQuery>;
export type ItemListInput = z.output<typeof ItemListQuery>;
export type LocationListInput = z.output<typeof LocationListQuery>;
