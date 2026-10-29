import { ApiError } from '@/lib/api';
import type { MasterRecord, Resource } from './api';
import type { MasterCopy } from './copy';

/*
 * What each Master Data form asks for (EP28) — only what CORE uses now, in
 * clear groups. The server validates everything again; these limits mirror
 * backend/src/master-data/input.ts so people see a problem before sending.
 *
 *   create     only on the create form (code, item type, branch) — fixed after
 *   structure  item base unit + tracking: on create, then only through the
 *              item's "Unit & tracking" form (the structure policy point)
 */

export type Group = 'identity' | 'contact' | 'address' | 'other' | 'tracking' | 'placement';
export type Options =
  'kinds' | 'types' | 'levels' | 'units' | 'categories' | 'branches' | 'parents';

export interface Field {
  key: string;
  kind: 'text' | 'area' | 'email' | 'tel' | 'select' | 'number' | 'check';
  group: Group;
  max?: number;
  required?: boolean;
  create?: boolean;
  structure?: boolean;
  options?: Options;
  /** Code-like value: monospace, upper case. */
  mono?: boolean;
}

const f = (key: string, kind: Field['kind'], group: Group, extra: Partial<Field> = {}): Field => ({
  key,
  kind,
  group,
  ...extra,
});

const code = (max = 32, required = false) =>
  f('code', 'text', 'identity', { max, required, create: true, mono: true });

const identity = (nameMax = 200) => [
  f('name', 'text', 'identity', { max: nameMax, required: true }),
];

const party = [
  f('legalName', 'text', 'identity', { max: 200 }),
  f('taxId', 'text', 'identity', { max: 40, mono: true }),
  f('taxBranch', 'text', 'identity', { max: 40 }),
  f('contactName', 'text', 'contact', { max: 120 }),
  f('phone', 'tel', 'contact', { max: 32 }),
  f('email', 'email', 'contact', { max: 254 }),
];

export const FIELDS: Record<Resource, Field[]> = {
  customers: [
    code(),
    f('kind', 'select', 'identity', { options: 'kinds', required: true }),
    ...identity(),
    ...party,
    f('lineId', 'text', 'contact', { max: 60 }),
    f('billingAddress', 'area', 'address', { max: 500 }),
    f('shippingAddress', 'area', 'address', { max: 500 }),
    f('notes', 'area', 'other', { max: 2000 }),
  ],
  suppliers: [
    code(),
    ...identity(),
    ...party,
    f('address', 'area', 'address', { max: 500 }),
    f('notes', 'area', 'other', { max: 2000 }),
  ],
  items: [
    code(),
    f('type', 'select', 'identity', { options: 'types', required: true, create: true }),
    ...identity(),
    f('description', 'area', 'identity', { max: 1000 }),
    f('sku', 'text', 'identity', { max: 64, mono: true }),
    f('barcode', 'text', 'identity', { max: 64, mono: true }),
    f('categoryId', 'select', 'identity', { options: 'categories' }),
    f('baseUnitId', 'select', 'tracking', { options: 'units', required: true, structure: true }),
    f('inventoryTracked', 'check', 'tracking', { structure: true }),
    f('lotTracking', 'select', 'tracking', { options: 'levels', structure: true }),
    f('expiryTracking', 'select', 'tracking', { options: 'levels', structure: true }),
  ],
  units: [
    code(16, true),
    ...identity(60),
    f('symbol', 'text', 'identity', { max: 16 }),
    f('precision', 'number', 'identity'),
  ],
  categories: [
    code(32, true),
    ...identity(120),
    f('description', 'area', 'identity', { max: 1000 }),
  ],
  locations: [
    f('branchId', 'select', 'placement', { options: 'branches', required: true, create: true }),
    code(32, true),
    ...identity(120),
    f('description', 'area', 'identity', { max: 500 }),
    f('parentId', 'select', 'placement', { options: 'parents' }),
    f('isDefault', 'check', 'placement'),
  ],
};

/** Example of the generated code, for the "leave empty" hint. */
export const CODE_EXAMPLE: Partial<Record<Resource, string>> = {
  customers: 'CUS-000001',
  suppliers: 'SUP-000001',
  items: 'FG-000001',
};

export type FormValues = Record<string, string | boolean>;

/** Form values of an existing record (references by id). */
export function valuesOf(r: MasterRecord, fields: Field[]): FormValues {
  const out: FormValues = {};
  for (const fd of fields) {
    const v =
      fd.key === 'baseUnitId'
        ? r.baseUnit?.id
        : fd.key === 'categoryId'
          ? r.category?.id
          : fd.key === 'parentId'
            ? r.parent?.id
            : fd.key === 'branchId'
              ? r.branch?.id
              : r[fd.key];
    out[fd.key] = fd.kind === 'check' ? v === true : v == null ? '' : String(v);
  }
  return out;
}

export function emptyValues(resource: Resource, fields: Field[]): FormValues {
  const out: FormValues = {};
  for (const fd of fields) out[fd.key] = fd.kind === 'check' ? fd.key === 'inventoryTracked' : '';
  if (resource === 'customers') out.kind = 'BUSINESS';
  if (resource === 'items') Object.assign(out, { lotTracking: 'NONE', expiryTracking: 'NONE' });
  if (resource === 'units') out.precision = '0';
  return out;
}

/**
 * The request body: on create, filled fields only; on edit, changed fields
 * only ('' clears an optional value).
 */
export function bodyOf(fields: Field[], values: FormValues, initial?: FormValues) {
  const body: Record<string, unknown> = {};
  for (const fd of fields) {
    const v = values[fd.key];
    if (initial && v === initial[fd.key]) continue;
    if (fd.kind === 'check') body[fd.key] = v === true;
    else if (fd.kind === 'number') body[fd.key] = Number(v);
    else if (typeof v === 'string') {
      const t = v.trim();
      if (t || initial) body[fd.key] = t;
    }
  }
  return body;
}

/** Client-side checks (the server decides): required, e-mail form, precision range. */
export function problems(fields: Field[], values: FormValues) {
  const out: Record<string, 'required' | 'invalid'> = {};
  for (const fd of fields) {
    const v = values[fd.key];
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (fd.required && !t) out[fd.key] = 'required';
    else if (fd.kind === 'email' && t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))
      out[fd.key] = 'invalid';
    else if (fd.kind === 'number' && !/^[0-6]$/.test(t)) out[fd.key] = 'invalid';
  }
  return out;
}

/** Field-level and form-level messages for an API error. */
export function readError(e: unknown, c: MasterCopy) {
  const fields: Record<string, string> = {};
  if (!(e instanceof ApiError)) return { fields, message: c.errors.generic };
  const details = e.details as unknown;
  if (Array.isArray(details)) {
    for (const d of details as { path?: string }[]) {
      const key = d.path?.split('.')[0];
      if (key) fields[key] = c.invalid;
    }
  }
  const field = (details as { field?: unknown } | undefined)?.field;
  const message =
    (c.errors as Record<string, string | undefined>)[e.code] ??
    (e.status === 403 ? c.errors.PERMISSION_DENIED : c.errors.generic);
  if (typeof field === 'string') fields[field] = message;
  return { fields, message };
}
