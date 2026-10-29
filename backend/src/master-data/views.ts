import type {
  Customer,
  Item,
  ItemCategory,
  Supplier,
  Unit,
  WarehouseLocation,
} from '../generated/prisma/client.js';

/*
 * What a master record looks like on the wire (EP28). Every view is an
 * explicit allow-list built field by field — never a spread of a database
 * row — so a column added later cannot leak by accident. No view carries
 * the company id, the actor ids, counters or platform metadata.
 *
 * These views are what EVERY audience receives, Warehouse included: master
 * records hold no cost, price, margin, payment or financial term, so there
 * is nothing sensitive to strip (backend/test/master-data.test.ts asserts
 * both the columns and the payloads). A future audience-specific field
 * (e.g. a purchase price) must get its own view and its own permission.
 */

const iso = (d: Date | null) => (d ? d.toISOString() : null);

const lifecycle = (r: {
  status: 'ACTIVE' | 'INACTIVE';
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  status: r.status,
  deactivatedAt: iso(r.deactivatedAt),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export const customerView = (c: Customer) => ({
  id: c.id,
  code: c.code,
  kind: c.kind,
  name: c.name,
  legalName: c.legalName,
  taxId: c.taxId,
  taxBranch: c.taxBranch,
  contactName: c.contactName,
  phone: c.phone,
  email: c.email,
  lineId: c.lineId,
  billingAddress: c.billingAddress,
  shippingAddress: c.shippingAddress,
  notes: c.notes,
  ...lifecycle(c),
});

/** Supplier IDENTITY (EP28) — no financial term exists on the record to show. */
export const supplierView = (s: Supplier) => ({
  id: s.id,
  code: s.code,
  name: s.name,
  legalName: s.legalName,
  taxId: s.taxId,
  taxBranch: s.taxBranch,
  contactName: s.contactName,
  phone: s.phone,
  email: s.email,
  address: s.address,
  notes: s.notes,
  ...lifecycle(s),
});

export const unitRef = (u: Unit) => ({
  id: u.id,
  code: u.code,
  name: u.name,
  symbol: u.symbol,
  precision: u.precision,
  status: u.status,
});

export const unitView = (u: Unit) => ({ ...unitRef(u), ...lifecycle(u) });

export const categoryRef = (c: ItemCategory) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  status: c.status,
});

export const categoryView = (c: ItemCategory) => ({
  ...categoryRef(c),
  description: c.description,
  ...lifecycle(c),
});

/**
 * The item as every department sees it — identity, unit, category and
 * tracking requirements. This is the Warehouse-safe view: it has no cost,
 * price, margin or supplier term because the item has none.
 */
export const itemView = (i: Item & { baseUnit: Unit; category: ItemCategory | null }) => ({
  id: i.id,
  code: i.code,
  type: i.type,
  name: i.name,
  description: i.description,
  sku: i.sku,
  barcode: i.barcode,
  baseUnit: unitRef(i.baseUnit),
  category: i.category ? categoryRef(i.category) : null,
  inventoryTracked: i.inventoryTracked,
  lotTracking: i.lotTracking,
  expiryTracking: i.expiryTracking,
  ...lifecycle(i),
});

type BranchRef = { id: string; code: string; name: string; type: string; status: string };

export const locationView = (
  l: WarehouseLocation & {
    branch: BranchRef;
    parent: Pick<WarehouseLocation, 'id' | 'code' | 'name' | 'status'> | null;
  },
) => ({
  id: l.id,
  code: l.code,
  name: l.name,
  description: l.description,
  branch: {
    id: l.branch.id,
    code: l.branch.code,
    name: l.branch.name,
    type: l.branch.type,
    status: l.branch.status,
  },
  parent: l.parent
    ? { id: l.parent.id, code: l.parent.code, name: l.parent.name, status: l.parent.status }
    : null,
  isDefault: l.defaultSlot === true,
  ...lifecycle(l),
});

export type ItemView = ReturnType<typeof itemView>;
export type SupplierView = ReturnType<typeof supplierView>;
