import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import { allowedActiveBranches } from '../company/branch-access.js';
import {
  masterEvent,
  recordCompanyEvent,
  type MasterAuditEntity,
  type MasterDataAuditAction,
} from '../company/audit.js';
import { memberPermissions, requireCompanyAccess } from '../company/context.js';
import type { Db, Prisma } from '../db/client.js';
import type { Unit, WarehouseLocation } from '../generated/prisma/client.js';
import type { MasterStatus, TrackingRequirement as Tracking } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import type { PermissionCode } from '../permissions/catalog.js';
import {
  permissionDenied,
  requireAnyPermission,
  requireBranchPermission,
  type PermissionAccess,
} from '../permissions/guard.js';
import {
  LOCATION_MANAGE,
  LOCATION_VIEW,
  MASTER_ACCESS,
  MASTER_ADMIN,
  masterCapabilities,
} from './access.js';
import {
  CUSTOMER_PREFIX,
  ITEM_PREFIX,
  isReservedCode,
  nextCode,
  SUPPLIER_PREFIX,
} from './codes.js';
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  CustomerCreateInput,
  CustomerListInput,
  CustomerUpdateInput,
  ItemCreateInput,
  ItemListInput,
  ItemStructureInput,
  ItemUpdateInput,
  ListInput,
  LocationCreateInput,
  LocationListInput,
  LocationUpdateInput,
  SORTS,
  SupplierCreateInput,
  SupplierUpdateInput,
  UnitCreateInput,
  UnitUpdateInput,
} from './input.js';
import {
  assertStructureChangeAllowed,
  assertTracking,
  LOCATION_MAX_DEPTH,
  type StructureChange,
} from './policy.js';
import {
  categoryView,
  customerView,
  itemView,
  locationView,
  supplierView,
  unitView,
} from './views.js';

/*
 * Operational master data (EP28) — customers, suppliers, items, units,
 * item categories (company-scoped) and warehouse locations (branch-scoped).
 *
 * Every method starts at the EP27 guard: requireAnyPermission for company
 * records (the codes in access.ts), requireBranchPermission for a location's
 * branch (permission + EP26 branch access, or company-wide administration).
 * Every query is scoped by the caller's company; an id from another company
 * is simply not found, and the database's company-bound foreign keys refuse
 * a cross-company reference even if a check were missed.
 *
 * Creates take the generated code, insert the record and write the audit
 * entry in ONE transaction. Nothing is deleted: deactivate / reactivate,
 * both audited. Codes and item types are fixed at creation.
 */

type Sort = (typeof SORTS)[number];
type Order = { code?: 'asc'; name?: 'asc'; updatedAt?: 'desc'; id?: 'asc' | 'desc' };

/** Whitelisted orderings — the client picks a name, never a column. */
function orderBy(sort: Sort = 'code'): Order[] {
  if (sort === 'name') return [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }];
  if (sort === 'updated') return [{ updatedAt: 'desc' }, { id: 'desc' }];
  return [{ code: 'asc' }, { id: 'asc' }];
}

const paging = (q: { page: number; pageSize: number }) => ({
  skip: (q.page - 1) * q.pageSize,
  take: q.pageSize,
});
const pageInfo = (q: { page: number; pageSize: number }, total: number, rows: number) => ({
  total,
  page: q.page,
  pageSize: q.pageSize,
  hasMore: (q.page - 1) * q.pageSize + rows < total,
});

const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const });
/** Tax ids are stored compact (no spaces / dashes): search them the same way. */
const compact = (q: string) => q.replace(/[\s.-]/g, '').toUpperCase();

const holds = (access: PermissionAccess, codes: readonly PermissionCode[]) =>
  codes.some((c) => access.permissions.includes(c));

export const masterNotFound = () =>
  new AppError(404, 'MASTER_RECORD_NOT_FOUND', 'This record was not found.');

const codeReserved = () =>
  new AppError(
    422,
    'CODE_RESERVED',
    'Codes in the automatic form (for example CUS-000001) are assigned by CORE. Leave the code empty or use another form.',
    { field: 'code' },
  );

const referenceNotFound = (field: string) =>
  new AppError(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', { field });

const referenceInactive = (field: string) =>
  new AppError(409, 'REFERENCE_INACTIVE', 'The selected record is inactive.', { field });

/** The database is the last word on uniqueness (concurrent creates, every path). */
function duplicateField(e: unknown): string | null {
  if (typeof e !== 'object' || e === null || (e as { code?: unknown }).code !== 'P2002') {
    return null;
  }
  const meta = JSON.stringify((e as { meta?: unknown }).meta ?? {});
  if (/barcode/i.test(meta)) return 'barcode';
  if (/sku/i.test(meta)) return 'sku';
  if (/defaultSlot/i.test(meta)) return 'isDefault';
  return 'code';
}

async function unique<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const field = duplicateField(e);
    if (field) {
      throw new AppError(409, 'DUPLICATE_VALUE', 'This value is already used in this company.', {
        field,
      });
    }
    throw e;
  }
}

/**
 * The fields of `input` that differ from `row` (undefined = not sent; null
 * clears). Returns the Prisma data and the changed field names for audit.
 */
function diff<R extends object>(row: R, input: object) {
  const data: Record<string, unknown> = {};
  const fields: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || (row as Record<string, unknown>)[key] === value) continue;
    data[key] = value;
    fields.push(key);
  }
  return { data, fields };
}

/** Audit details of an edit: field names; the name's before / after (short, not sensitive). */
const editDetails = (
  row: { code: string; name: string },
  fields: string[],
  data: Record<string, unknown>,
) => ({
  code: row.code,
  name: row.name,
  fields,
  ...(fields.includes('name') ? { nameFrom: row.name, nameTo: data.name as string } : {}),
});

const statusData = (status: MasterStatus) => ({
  status,
  deactivatedAt: status === 'INACTIVE' ? new Date() : null,
});

const itemInclude = { baseUnit: true, category: true } as const;
const locationInclude = {
  branch: { select: { id: true, code: true, name: true, type: true, status: true } },
  parent: { select: { id: true, code: true, name: true, status: true } },
} as const;

const customerList = (c: Prisma.CustomerGetPayload<object>) => ({
  id: c.id,
  code: c.code,
  kind: c.kind,
  name: c.name,
  taxId: c.taxId,
  contactName: c.contactName,
  phone: c.phone,
  email: c.email,
  status: c.status,
  updatedAt: c.updatedAt.toISOString(),
});

const supplierList = (s: Prisma.SupplierGetPayload<object>) => ({
  id: s.id,
  code: s.code,
  name: s.name,
  taxId: s.taxId,
  contactName: s.contactName,
  phone: s.phone,
  email: s.email,
  status: s.status,
  updatedAt: s.updatedAt.toISOString(),
});

export class MasterDataService {
  constructor(private readonly db: Db) {}

  private event(
    tx: Prisma.TransactionClient,
    meta: RequestMeta,
    access: PermissionAccess,
    entity: MasterAuditEntity,
    action: MasterDataAuditAction,
    entityId: string,
    details: Record<string, string | number | boolean | null | readonly string[]>,
  ) {
    return recordCompanyEvent(tx, meta, {
      action,
      actorId: access.actor.userId,
      actorScope: 'customer',
      companyId: access.company.id,
      entityType: entity,
      entityId,
      details,
    });
  }

  private actor(access: PermissionAccess) {
    return { createdById: access.actor.userId, updatedById: access.actor.userId };
  }

  // ----------------------------------------------------------------- context

  /**
   * What this person may do in Master Data, and the branches whose locations
   * they may see. Screens use it to show navigation and actions only.
   */
  async context(ctx: AuthContext) {
    const access = await requireCompanyAccess(this.db, ctx);
    const { permissions } = await memberPermissions(this.db, access);
    const caps = masterCapabilities(permissions);
    const branches = !caps.resources.locations.view
      ? []
      : caps.admin
        ? await this.db.branch.findMany({
            where: { companyId: access.company.id },
            orderBy: { code: 'asc' },
          })
        : await allowedActiveBranches(this.db, access.member);
    const manageHere = caps.admin || permissions.includes(LOCATION_MANAGE);
    return {
      capabilities: caps.resources,
      companyWide: caps.admin,
      branches: branches.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        type: b.type,
        status: b.status,
        canManage: manageHere && b.status === 'ACTIVE',
      })),
    };
  }

  // --------------------------------------------------------------- customers

  async customers(ctx: AuthContext, q: CustomerListInput) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.customers.view);
    const where: Prisma.CustomerWhereInput = { companyId: access.company.id };
    if (q.status) where.status = q.status;
    if (q.kind) where.kind = q.kind;
    if (q.q) {
      where.OR = [
        { code: contains(q.q) },
        { name: contains(q.q) },
        { legalName: contains(q.q) },
        { taxId: contains(compact(q.q)) },
        { contactName: contains(q.q) },
        { email: contains(q.q) },
        { phone: contains(q.q) },
      ];
    }
    const [rows, total] = await Promise.all([
      this.db.customer.findMany({ where, orderBy: orderBy(q.sort), ...paging(q) }),
      this.db.customer.count({ where }),
    ]);
    return {
      items: rows.map(customerList),
      ...pageInfo(q, total, rows.length),
      canManage: holds(access, MASTER_ACCESS.customers.manage),
    };
  }

  async customer(ctx: AuthContext, id: string) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.customers.view);
    const row = await this.db.customer.findFirst({ where: { id, companyId: access.company.id } });
    if (!row) throw masterNotFound();
    return {
      customer: customerView(row),
      canManage: holds(access, MASTER_ACCESS.customers.manage),
    };
  }

  async createCustomer(ctx: AuthContext, input: CustomerCreateInput, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.customers.manage);
    if (input.code && isReservedCode(input.code, [CUSTOMER_PREFIX])) throw codeReserved();
    const companyId = access.company.id;
    const row = await unique(() =>
      this.db.$transaction(async (tx) => {
        const code = input.code ?? (await nextCode(tx, companyId, CUSTOMER_PREFIX));
        const created = await tx.customer.create({
          data: { ...input, code, companyId, ...this.actor(access) },
        });
        await this.event(
          tx,
          meta,
          access,
          'Customer',
          masterEvent('Customer', 'CREATED'),
          created.id,
          {
            code,
            name: created.name,
          },
        );
        return created;
      }),
    );
    return { customer: customerView(row) };
  }

  async updateCustomer(
    ctx: AuthContext,
    id: string,
    input: CustomerUpdateInput,
    meta: RequestMeta,
  ) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.customers.manage);
    const row = await this.db.customer.findFirst({ where: { id, companyId: access.company.id } });
    if (!row) throw masterNotFound();
    const { data, fields } = diff(row, input);
    if (!fields.length) return { customer: customerView(row) };
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.customer.update({
        where: { id: row.id },
        data: { ...data, updatedById: access.actor.userId },
      });
      await this.event(tx, meta, access, 'Customer', masterEvent('Customer', 'UPDATED'), row.id, {
        ...editDetails(row, fields, data),
      });
      return next;
    });
    return { customer: customerView(updated) };
  }

  async setCustomerStatus(ctx: AuthContext, id: string, status: MasterStatus, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.customers.manage);
    const row = await this.db.customer.findFirst({ where: { id, companyId: access.company.id } });
    if (!row) throw masterNotFound();
    if (row.status === status) return { customer: customerView(row) };
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.customer.update({
        where: { id: row.id },
        data: { ...statusData(status), updatedById: access.actor.userId },
      });
      await this.statusEvent(tx, meta, access, 'Customer', row, status);
      return next;
    });
    return { customer: customerView(updated) };
  }

  private statusEvent(
    tx: Prisma.TransactionClient,
    meta: RequestMeta,
    access: PermissionAccess,
    entity: MasterAuditEntity,
    row: { id: string; code: string; name: string },
    status: MasterStatus,
    extra: Record<string, string | boolean> = {},
  ) {
    const verb = status === 'INACTIVE' ? 'DEACTIVATED' : 'REACTIVATED';
    return this.event(tx, meta, access, entity, masterEvent(entity, verb), row.id, {
      code: row.code,
      name: row.name,
      ...extra,
    });
  }

  // --------------------------------------------------------------- suppliers

  async suppliers(ctx: AuthContext, q: ListInput) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.suppliers.view);
    const where: Prisma.SupplierWhereInput = { companyId: access.company.id };
    if (q.status) where.status = q.status;
    if (q.q) {
      where.OR = [
        { code: contains(q.q) },
        { name: contains(q.q) },
        { legalName: contains(q.q) },
        { taxId: contains(compact(q.q)) },
        { contactName: contains(q.q) },
        { email: contains(q.q) },
        { phone: contains(q.q) },
      ];
    }
    const [rows, total] = await Promise.all([
      this.db.supplier.findMany({ where, orderBy: orderBy(q.sort), ...paging(q) }),
      this.db.supplier.count({ where }),
    ]);
    return {
      items: rows.map(supplierList),
      ...pageInfo(q, total, rows.length),
      canManage: holds(access, MASTER_ACCESS.suppliers.manage),
    };
  }

  async supplier(ctx: AuthContext, id: string) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.suppliers.view);
    const row = await this.db.supplier.findFirst({ where: { id, companyId: access.company.id } });
    if (!row) throw masterNotFound();
    return {
      supplier: supplierView(row),
      canManage: holds(access, MASTER_ACCESS.suppliers.manage),
    };
  }

  async createSupplier(ctx: AuthContext, input: SupplierCreateInput, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.suppliers.manage);
    if (input.code && isReservedCode(input.code, [SUPPLIER_PREFIX])) throw codeReserved();
    const companyId = access.company.id;
    const row = await unique(() =>
      this.db.$transaction(async (tx) => {
        const code = input.code ?? (await nextCode(tx, companyId, SUPPLIER_PREFIX));
        const created = await tx.supplier.create({
          data: { ...input, code, companyId, ...this.actor(access) },
        });
        await this.event(
          tx,
          meta,
          access,
          'Supplier',
          masterEvent('Supplier', 'CREATED'),
          created.id,
          {
            code,
            name: created.name,
          },
        );
        return created;
      }),
    );
    return { supplier: supplierView(row) };
  }

  async updateSupplier(
    ctx: AuthContext,
    id: string,
    input: SupplierUpdateInput,
    meta: RequestMeta,
  ) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.suppliers.manage);
    const row = await this.db.supplier.findFirst({ where: { id, companyId: access.company.id } });
    if (!row) throw masterNotFound();
    const { data, fields } = diff(row, input);
    if (!fields.length) return { supplier: supplierView(row) };
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.supplier.update({
        where: { id: row.id },
        data: { ...data, updatedById: access.actor.userId },
      });
      await this.event(tx, meta, access, 'Supplier', masterEvent('Supplier', 'UPDATED'), row.id, {
        ...editDetails(row, fields, data),
      });
      return next;
    });
    return { supplier: supplierView(updated) };
  }

  async setSupplierStatus(ctx: AuthContext, id: string, status: MasterStatus, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.suppliers.manage);
    const row = await this.db.supplier.findFirst({ where: { id, companyId: access.company.id } });
    if (!row) throw masterNotFound();
    if (row.status === status) return { supplier: supplierView(row) };
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.supplier.update({
        where: { id: row.id },
        data: { ...statusData(status), updatedById: access.actor.userId },
      });
      await this.statusEvent(tx, meta, access, 'Supplier', row, status);
      return next;
    });
    return { supplier: supplierView(updated) };
  }

  // ------------------------------------------------------------------- units

  async units(ctx: AuthContext, q: ListInput) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.units.view);
    const where: Prisma.UnitWhereInput = { companyId: access.company.id };
    if (q.status) where.status = q.status;
    if (q.q)
      where.OR = [{ code: contains(q.q) }, { name: contains(q.q) }, { symbol: contains(q.q) }];
    const [rows, total] = await Promise.all([
      this.db.unit.findMany({ where, orderBy: orderBy(q.sort), ...paging(q) }),
      this.db.unit.count({ where }),
    ]);
    return {
      items: rows.map(unitView),
      ...pageInfo(q, total, rows.length),
      canManage: holds(access, MASTER_ACCESS.units.manage),
    };
  }

  /** One unit and how many items use it (shown before deactivating). */
  async unit(ctx: AuthContext, id: string) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.units.view);
    const row = await this.db.unit.findFirst({ where: { id, companyId: access.company.id } });
    if (!row) throw masterNotFound();
    return {
      unit: unitView(row),
      usage: await this.usage({ baseUnitId: row.id, companyId: row.companyId }),
      canManage: holds(access, MASTER_ACCESS.units.manage),
    };
  }

  private async usage(where: Prisma.ItemWhereInput) {
    const [items, activeItems] = await Promise.all([
      this.db.item.count({ where }),
      this.db.item.count({ where: { ...where, status: 'ACTIVE' } }),
    ]);
    return { items, activeItems };
  }

  async createUnit(ctx: AuthContext, input: UnitCreateInput, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.units.manage);
    const row = await unique(() =>
      this.db.$transaction(async (tx) => {
        const created = await tx.unit.create({
          data: { ...input, companyId: access.company.id, ...this.actor(access) },
        });
        await this.event(tx, meta, access, 'Unit', masterEvent('Unit', 'CREATED'), created.id, {
          code: created.code,
          name: created.name,
          precision: created.precision,
        });
        return created;
      }),
    );
    return { unit: unitView(row) };
  }

  /**
   * Name, symbol and precision. Precision is allowed to change in EP28 (no
   * quantity exists yet); future stock modules lock it like the item structure.
   */
  async updateUnit(ctx: AuthContext, id: string, input: UnitUpdateInput, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.units.manage);
    const row = await this.db.unit.findFirst({ where: { id, companyId: access.company.id } });
    if (!row) throw masterNotFound();
    const { data, fields } = diff(row, input);
    if (!fields.length) return { unit: unitView(row) };
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.unit.update({
        where: { id: row.id },
        data: { ...data, updatedById: access.actor.userId },
      });
      await this.event(tx, meta, access, 'Unit', masterEvent('Unit', 'UPDATED'), row.id, {
        ...editDetails(row, fields, data),
        ...(fields.includes('precision')
          ? { precisionFrom: row.precision, precisionTo: next.precision }
          : {}),
      });
      return next;
    });
    return { unit: unitView(updated) };
  }

  /** Allowed while items use it: they keep it (shown inactive); new assignment is refused. */
  async setUnitStatus(ctx: AuthContext, id: string, status: MasterStatus, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.units.manage);
    const row = await this.db.unit.findFirst({ where: { id, companyId: access.company.id } });
    if (!row) throw masterNotFound();
    if (row.status === status) return { unit: unitView(row) };
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.unit.update({
        where: { id: row.id },
        data: { ...statusData(status), updatedById: access.actor.userId },
      });
      await this.statusEvent(tx, meta, access, 'Unit', row, status);
      return next;
    });
    return { unit: unitView(updated) };
  }

  // -------------------------------------------------------------- categories

  async categories(ctx: AuthContext, q: ListInput) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.categories.view);
    const where: Prisma.ItemCategoryWhereInput = { companyId: access.company.id };
    if (q.status) where.status = q.status;
    if (q.q) where.OR = [{ code: contains(q.q) }, { name: contains(q.q) }];
    const [rows, total] = await Promise.all([
      this.db.itemCategory.findMany({ where, orderBy: orderBy(q.sort), ...paging(q) }),
      this.db.itemCategory.count({ where }),
    ]);
    return {
      items: rows.map(categoryView),
      ...pageInfo(q, total, rows.length),
      canManage: holds(access, MASTER_ACCESS.categories.manage),
    };
  }

  async category(ctx: AuthContext, id: string) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.categories.view);
    const row = await this.db.itemCategory.findFirst({
      where: { id, companyId: access.company.id },
    });
    if (!row) throw masterNotFound();
    return {
      category: categoryView(row),
      usage: await this.usage({ categoryId: row.id, companyId: row.companyId }),
      canManage: holds(access, MASTER_ACCESS.categories.manage),
    };
  }

  async createCategory(ctx: AuthContext, input: CategoryCreateInput, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.categories.manage);
    const row = await unique(() =>
      this.db.$transaction(async (tx) => {
        const created = await tx.itemCategory.create({
          data: { ...input, companyId: access.company.id, ...this.actor(access) },
        });
        await this.event(
          tx,
          meta,
          access,
          'ItemCategory',
          masterEvent('ItemCategory', 'CREATED'),
          created.id,
          { code: created.code, name: created.name },
        );
        return created;
      }),
    );
    return { category: categoryView(row) };
  }

  async updateCategory(
    ctx: AuthContext,
    id: string,
    input: CategoryUpdateInput,
    meta: RequestMeta,
  ) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.categories.manage);
    const row = await this.db.itemCategory.findFirst({
      where: { id, companyId: access.company.id },
    });
    if (!row) throw masterNotFound();
    const { data, fields } = diff(row, input);
    if (!fields.length) return { category: categoryView(row) };
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.itemCategory.update({
        where: { id: row.id },
        data: { ...data, updatedById: access.actor.userId },
      });
      await this.event(
        tx,
        meta,
        access,
        'ItemCategory',
        masterEvent('ItemCategory', 'UPDATED'),
        row.id,
        { ...editDetails(row, fields, data) },
      );
      return next;
    });
    return { category: categoryView(updated) };
  }

  async setCategoryStatus(ctx: AuthContext, id: string, status: MasterStatus, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.categories.manage);
    const row = await this.db.itemCategory.findFirst({
      where: { id, companyId: access.company.id },
    });
    if (!row) throw masterNotFound();
    if (row.status === status) return { category: categoryView(row) };
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.itemCategory.update({
        where: { id: row.id },
        data: { ...statusData(status), updatedById: access.actor.userId },
      });
      await this.statusEvent(tx, meta, access, 'ItemCategory', row, status);
      return next;
    });
    return { category: categoryView(updated) };
  }

  // ------------------------------------------------------------------- items

  async items(ctx: AuthContext, q: ItemListInput) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.items.view);
    const where: Prisma.ItemWhereInput = { companyId: access.company.id };
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.inventoryTracked !== undefined) where.inventoryTracked = q.inventoryTracked;
    const level = (v: string) => (v === 'TRACKED' ? { not: 'NONE' as const } : (v as Tracking));
    if (q.lotTracking) where.lotTracking = level(q.lotTracking);
    if (q.expiryTracking) where.expiryTracking = level(q.expiryTracking);
    if (q.q) {
      where.OR = [
        { code: contains(q.q) },
        { sku: contains(q.q) },
        { barcode: contains(q.q) },
        { name: contains(q.q) },
      ];
    }
    const [rows, total] = await Promise.all([
      this.db.item.findMany({
        where,
        orderBy: orderBy(q.sort),
        include: itemInclude,
        ...paging(q),
      }),
      this.db.item.count({ where }),
    ]);
    return {
      items: rows.map(itemView),
      ...pageInfo(q, total, rows.length),
      canManage: holds(access, MASTER_ACCESS.items.manage),
    };
  }

  async item(ctx: AuthContext, id: string) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.items.view);
    const row = await this.db.item.findFirst({
      where: { id, companyId: access.company.id },
      include: itemInclude,
    });
    if (!row) throw masterNotFound();
    return { item: itemView(row), canManage: holds(access, MASTER_ACCESS.items.manage) };
  }

  /** A unit / category of THIS company that is active (new assignments only). */
  private async activeUnit(tx: Prisma.TransactionClient, companyId: string, id: string) {
    const unit = await tx.unit.findFirst({ where: { id, companyId } });
    if (!unit) throw referenceNotFound('baseUnitId');
    if (unit.status !== 'ACTIVE') throw referenceInactive('baseUnitId');
    return unit;
  }

  private async activeCategory(tx: Prisma.TransactionClient, companyId: string, id: string) {
    const category = await tx.itemCategory.findFirst({ where: { id, companyId } });
    if (!category) throw referenceNotFound('categoryId');
    if (category.status !== 'ACTIVE') throw referenceInactive('categoryId');
    return category;
  }

  async createItem(ctx: AuthContext, input: ItemCreateInput, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.items.manage);
    const companyId = access.company.id;
    const inventoryTracked = input.inventoryTracked ?? input.type !== 'NON_STOCK';
    assertTracking({ ...input, inventoryTracked });
    if (input.code && isReservedCode(input.code, Object.values(ITEM_PREFIX))) throw codeReserved();
    const row = await unique(() =>
      this.db.$transaction(async (tx) => {
        await this.activeUnit(tx, companyId, input.baseUnitId);
        if (input.categoryId) await this.activeCategory(tx, companyId, input.categoryId);
        const code = input.code ?? (await nextCode(tx, companyId, ITEM_PREFIX[input.type]));
        const created = await tx.item.create({
          data: {
            companyId,
            code,
            type: input.type,
            name: input.name,
            description: input.description ?? null,
            sku: input.sku ?? null,
            barcode: input.barcode ?? null,
            baseUnitId: input.baseUnitId,
            categoryId: input.categoryId ?? null,
            inventoryTracked,
            lotTracking: input.lotTracking,
            expiryTracking: input.expiryTracking,
            ...this.actor(access),
          },
          include: itemInclude,
        });
        await this.event(tx, meta, access, 'Item', masterEvent('Item', 'CREATED'), created.id, {
          code,
          name: created.name,
          type: created.type,
          baseUnit: created.baseUnit.code,
          inventoryTracked,
          lotTracking: created.lotTracking,
          expiryTracking: created.expiryTracking,
        });
        return created;
      }),
    );
    return { item: itemView(row) };
  }

  /** Identity fields only. Unit and tracking go through updateItemStructure. */
  async updateItem(ctx: AuthContext, id: string, input: ItemUpdateInput, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.items.manage);
    const companyId = access.company.id;
    const row = await this.db.item.findFirst({ where: { id, companyId }, include: itemInclude });
    if (!row) throw masterNotFound();
    const { data, fields } = diff(row, input);
    if (!fields.length) return { item: itemView(row) };
    const updated = await unique(() =>
      this.db.$transaction(async (tx) => {
        if (fields.includes('categoryId') && input.categoryId) {
          await this.activeCategory(tx, companyId, input.categoryId);
        }
        const next = await tx.item.update({
          where: { id: row.id },
          data: { ...data, updatedById: access.actor.userId },
          include: itemInclude,
        });
        await this.event(tx, meta, access, 'Item', masterEvent('Item', 'UPDATED'), row.id, {
          ...editDetails(row, fields, data),
        });
        return next;
      }),
    );
    return { item: itemView(updated) };
  }

  /**
   * Base unit and inventory / lot / expiry tracking — the structure policy
   * point (policy.ts). The item row is locked, the merged tracking checked,
   * every registered lock consulted, and the change audited from → to.
   */
  async updateItemStructure(
    ctx: AuthContext,
    id: string,
    input: ItemStructureInput,
    meta: RequestMeta,
  ) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.items.manage);
    const companyId = access.company.id;
    const exists = await this.db.item.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!exists) throw masterNotFound();
    const updated = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Item" WHERE "id" = ${id} FOR UPDATE`;
      const row = await tx.item.findUniqueOrThrow({ where: { id }, include: itemInclude });
      const next = {
        inventoryTracked: input.inventoryTracked ?? row.inventoryTracked,
        lotTracking: input.lotTracking ?? row.lotTracking,
        expiryTracking: input.expiryTracking ?? row.expiryTracking,
      };
      assertTracking({ type: row.type, ...next });
      const change: StructureChange = {};
      let unit: Unit = row.baseUnit;
      if (input.baseUnitId && input.baseUnitId !== row.baseUnitId) {
        unit = await this.activeUnit(tx, companyId, input.baseUnitId);
        change.baseUnit = { from: row.baseUnit, to: unit };
      }
      for (const key of ['inventoryTracked', 'lotTracking', 'expiryTracking'] as const) {
        if (next[key] !== row[key]) {
          (change as Record<string, unknown>)[key] = { from: row[key], to: next[key] };
        }
      }
      if (!Object.keys(change).length) return row;
      await assertStructureChangeAllowed(tx, row, change);
      const saved = await tx.item.update({
        where: { id },
        data: { ...next, baseUnitId: unit.id, updatedById: access.actor.userId },
        include: itemInclude,
      });
      const details: Record<string, string | boolean> = { code: row.code, name: row.name };
      if (change.baseUnit) {
        details.baseUnitFrom = change.baseUnit.from.code;
        details.baseUnitTo = change.baseUnit.to.code;
      }
      for (const key of ['inventoryTracked', 'lotTracking', 'expiryTracking'] as const) {
        const c = change[key];
        if (c) {
          details[`${key}From`] = c.from;
          details[`${key}To`] = c.to;
        }
      }
      await this.event(tx, meta, access, 'Item', 'ITEM_STRUCTURE_CHANGED', id, details);
      return saved;
    });
    return { item: itemView(updated) };
  }

  /** Reactivation needs an active base unit (the item would be usable again). */
  async setItemStatus(ctx: AuthContext, id: string, status: MasterStatus, meta: RequestMeta) {
    const access = await requireAnyPermission(this.db, ctx, MASTER_ACCESS.items.manage);
    const row = await this.db.item.findFirst({
      where: { id, companyId: access.company.id },
      include: itemInclude,
    });
    if (!row) throw masterNotFound();
    if (row.status === status) return { item: itemView(row) };
    if (status === 'ACTIVE' && row.baseUnit.status !== 'ACTIVE') {
      throw referenceInactive('baseUnitId');
    }
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.item.update({
        where: { id: row.id },
        data: { ...statusData(status), updatedById: access.actor.userId },
        include: itemInclude,
      });
      await this.statusEvent(tx, meta, access, 'Item', row, status);
      return next;
    });
    return { item: itemView(updated) };
  }

  // --------------------------------------------------------------- locations

  /**
   * Locations the caller may see: every branch of the company with
   * company-wide administration; otherwise `warehouse.locations.view` in
   * the active branches the member may work in (EP26). `branchId` narrows
   * to one branch (checked the same way).
   */
  async locations(ctx: AuthContext, q: LocationListInput) {
    let access: PermissionAccess;
    let branchIds: string[] | null;
    if (q.branchId) {
      access = await requireBranchPermission(this.db, ctx, LOCATION_VIEW, q.branchId, MASTER_ADMIN);
      branchIds = [q.branchId];
    } else {
      const company = await requireCompanyAccess(this.db, ctx);
      const { permissions } = await memberPermissions(this.db, company);
      access = { ...company, permissions };
      if (permissions.includes(MASTER_ADMIN)) branchIds = null;
      else if (permissions.includes(LOCATION_VIEW)) {
        branchIds = (await allowedActiveBranches(this.db, company.member)).map((b) => b.id);
      } else throw permissionDenied(LOCATION_VIEW);
    }
    const where: Prisma.WarehouseLocationWhereInput = { companyId: access.company.id };
    if (branchIds) where.branchId = { in: branchIds };
    if (q.status) where.status = q.status;
    if (q.q) where.OR = [{ code: contains(q.q) }, { name: contains(q.q) }];
    const order: Prisma.WarehouseLocationOrderByWithRelationInput[] =
      !q.sort || q.sort === 'code'
        ? [{ branch: { code: 'asc' } }, { code: 'asc' }, { id: 'asc' }]
        : orderBy(q.sort);
    const [rows, total] = await Promise.all([
      this.db.warehouseLocation.findMany({
        where,
        orderBy: order,
        include: locationInclude,
        ...paging(q),
      }),
      this.db.warehouseLocation.count({ where }),
    ]);
    return {
      items: rows.map(locationView),
      ...pageInfo(q, total, rows.length),
      canManage:
        access.permissions.includes(MASTER_ADMIN) || access.permissions.includes(LOCATION_MANAGE),
    };
  }

  private async findLocation(companyId: string, id: string) {
    const row = await this.db.warehouseLocation.findFirst({
      where: { id, companyId },
      include: locationInclude,
    });
    if (!row) throw masterNotFound();
    return row;
  }

  async location(ctx: AuthContext, id: string) {
    const company = await requireCompanyAccess(this.db, ctx);
    const row = await this.findLocation(company.company.id, id);
    const access = await requireBranchPermission(
      this.db,
      ctx,
      LOCATION_VIEW,
      row.branchId,
      MASTER_ADMIN,
    );
    const manage =
      access.permissions.includes(MASTER_ADMIN) || access.permissions.includes(LOCATION_MANAGE);
    const children = await this.db.warehouseLocation.count({
      where: { parentId: row.id, status: 'ACTIVE' },
    });
    return { location: locationView(row), activeChildren: children, canManage: manage };
  }

  /** Manage access to a location's branch; changes need the branch to be ACTIVE. */
  private async manageBranch(ctx: AuthContext, branchId: string, requireActive = true) {
    const access = await requireBranchPermission(
      this.db,
      ctx,
      LOCATION_MANAGE,
      branchId,
      MASTER_ADMIN,
    );
    if (requireActive && access.branch.status !== 'ACTIVE') {
      throw new AppError(409, 'BRANCH_INACTIVE', 'This branch is not active.');
    }
    return access;
  }

  /** Serializes tree and default changes inside one branch. */
  private lockBranch(tx: Prisma.TransactionClient, branchId: string) {
    return tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${branchId} FOR UPDATE`;
  }

  /** Depth of a location counted from the top (a root is 1). */
  private async depth(tx: Prisma.TransactionClient, id: string, avoid?: string) {
    let depth = 0;
    let cursor: string | null = id;
    while (cursor) {
      if (cursor === avoid) {
        throw new AppError(422, 'LOCATION_CYCLE', 'A location cannot be placed inside itself.', {
          field: 'parentId',
        });
      }
      depth++;
      if (depth > LOCATION_MAX_DEPTH + 1) break;
      const row: { parentId: string | null } | null = await tx.warehouseLocation.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = row?.parentId ?? null;
    }
    return depth;
  }

  /** Levels below a location (0 for a leaf). */
  private async height(tx: Prisma.TransactionClient, id: string) {
    let level = [id];
    let height = 0;
    while (level.length && height <= LOCATION_MAX_DEPTH) {
      const children = await tx.warehouseLocation.findMany({
        where: { parentId: { in: level } },
        select: { id: true },
      });
      if (!children.length) break;
      height++;
      level = children.map((c) => c.id);
    }
    return height;
  }

  /** A parent in the same branch, active, not the location itself or below it, within depth. */
  private async checkParent(
    tx: Prisma.TransactionClient,
    branchId: string,
    parentId: string,
    self?: Pick<WarehouseLocation, 'id'>,
  ) {
    const parent = await tx.warehouseLocation.findFirst({ where: { id: parentId, branchId } });
    if (!parent) throw referenceNotFound('parentId');
    if (parent.status !== 'ACTIVE') throw referenceInactive('parentId');
    const depth = await this.depth(tx, parent.id, self?.id);
    const below = self ? await this.height(tx, self.id) : 0;
    if (depth + 1 + below > LOCATION_MAX_DEPTH) {
      throw new AppError(422, 'LOCATION_TOO_DEEP', 'Locations can be nested four levels deep.', {
        field: 'parentId',
        max: LOCATION_MAX_DEPTH,
      });
    }
  }

  async createLocation(ctx: AuthContext, input: LocationCreateInput, meta: RequestMeta) {
    const access = await this.manageBranch(ctx, input.branchId);
    const row = await unique(() =>
      this.db.$transaction(async (tx) => {
        await this.lockBranch(tx, input.branchId);
        if (input.parentId) await this.checkParent(tx, input.branchId, input.parentId);
        if (input.isDefault) {
          await tx.warehouseLocation.updateMany({
            where: { branchId: input.branchId, defaultSlot: true },
            data: { defaultSlot: null },
          });
        }
        const created = await tx.warehouseLocation.create({
          data: {
            companyId: access.company.id,
            branchId: input.branchId,
            code: input.code,
            name: input.name,
            description: input.description ?? null,
            parentId: input.parentId ?? null,
            defaultSlot: input.isDefault ? true : null,
            ...this.actor(access),
          },
          include: locationInclude,
        });
        await this.event(
          tx,
          meta,
          access,
          'WarehouseLocation',
          masterEvent('WarehouseLocation', 'CREATED'),
          created.id,
          {
            code: created.code,
            name: created.name,
            branch: access.branch.code,
            isDefault: input.isDefault,
          },
        );
        return created;
      }),
    );
    return { location: locationView(row) };
  }

  async updateLocation(
    ctx: AuthContext,
    id: string,
    input: LocationUpdateInput,
    meta: RequestMeta,
  ) {
    const company = await requireCompanyAccess(this.db, ctx);
    const row = await this.findLocation(company.company.id, id);
    const access = await this.manageBranch(ctx, row.branchId);
    const { isDefault, ...fieldsInput } = input;
    const { data, fields } = diff(row, fieldsInput);
    const defaultChange = isDefault !== undefined && isDefault !== (row.defaultSlot === true);
    if (!fields.length && !defaultChange) return { location: locationView(row) };
    if (defaultChange && isDefault && row.status !== 'ACTIVE') {
      throw new AppError(409, 'RECORD_INACTIVE', 'Reactivate this location first.');
    }
    const updated = await unique(() =>
      this.db.$transaction(async (tx) => {
        await this.lockBranch(tx, row.branchId);
        if (fields.includes('parentId') && input.parentId) {
          await this.checkParent(tx, row.branchId, input.parentId, row);
        }
        if (defaultChange && isDefault) {
          await tx.warehouseLocation.updateMany({
            where: { branchId: row.branchId, defaultSlot: true },
            data: { defaultSlot: null },
          });
        }
        const next = await tx.warehouseLocation.update({
          where: { id: row.id },
          data: {
            ...data,
            ...(defaultChange ? { defaultSlot: isDefault ? true : null } : {}),
            updatedById: access.actor.userId,
          },
          include: locationInclude,
        });
        await this.event(
          tx,
          meta,
          access,
          'WarehouseLocation',
          masterEvent('WarehouseLocation', 'UPDATED'),
          row.id,
          {
            ...editDetails(row, defaultChange ? [...fields, 'isDefault'] : fields, data),
            branch: row.branch.code,
            ...(defaultChange ? { isDefault: !!isDefault } : {}),
          },
        );
        return next;
      }),
    );
    return { location: locationView(updated) };
  }

  /**
   * Deactivate: refused while active locations sit inside it; a default
   * location stops being the default. Reactivate: the branch and the parent
   * must be active.
   */
  async setLocationStatus(ctx: AuthContext, id: string, status: MasterStatus, meta: RequestMeta) {
    const company = await requireCompanyAccess(this.db, ctx);
    const row = await this.findLocation(company.company.id, id);
    const access = await this.manageBranch(ctx, row.branchId, status === 'ACTIVE');
    if (row.status === status) return { location: locationView(row) };
    const updated = await this.db.$transaction(async (tx) => {
      await this.lockBranch(tx, row.branchId);
      if (status === 'INACTIVE') {
        const children = await tx.warehouseLocation.count({
          where: { parentId: row.id, status: 'ACTIVE' },
        });
        if (children) {
          throw new AppError(
            409,
            'LOCATION_HAS_ACTIVE_CHILDREN',
            'Deactivate or move the locations inside it first.',
            { count: children },
          );
        }
      } else if (row.parentId) {
        const parent = await tx.warehouseLocation.findUnique({ where: { id: row.parentId } });
        if (parent?.status !== 'ACTIVE') throw referenceInactive('parentId');
      }
      const next = await tx.warehouseLocation.update({
        where: { id: row.id },
        data: {
          ...statusData(status),
          ...(status === 'INACTIVE' ? { defaultSlot: null } : {}),
          updatedById: access.actor.userId,
        },
        include: locationInclude,
      });
      await this.statusEvent(tx, meta, access, 'WarehouseLocation', row, status, {
        branch: row.branch.code,
        ...(status === 'INACTIVE' && row.defaultSlot ? { defaultCleared: true } : {}),
      });
      return next;
    });
    return { location: locationView(updated) };
  }
}
