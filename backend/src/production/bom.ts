import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import { recordCompanyEvent, type ProductionAuditAction } from '../company/audit.js';
import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { permissionDenied } from '../permissions/guard.js';
import type { BomLineInput, BomListInput, CreateBomInput, UpdateBomInput } from './input.js';
import {
  allowedBomActions,
  assertBom,
  bomNotFound,
  loadProductionActor,
  type BomAction,
  type ProductionActor,
} from './policy.js';
import { BomRow, BomView, ProductionItem } from './views.js';

/*
 * BOM revisions (EP36) — docs/PRODUCTION_BOM.md. Single level: a finished item
 * (FINISHED_GOOD, inventory tracked) made from stock materials (any inventory
 * tracked type other than itself; no explosion of a material's own BOM).
 * Every quantity is in the item's BASE unit — there is no unit conversion
 * (a different unit is refused, UNIT_CONVERSION_UNSUPPORTED). A DRAFT is
 * editable; ACTIVE is immutable (the database guards it too); a change is a
 * new revision. At most one ACTIVE revision per finished item: activating a
 * draft retires the item's current ACTIVE revision in the same transaction,
 * serialized per item by an advisory lock. Orders keep their own snapshot.
 */

const person = { select: { user: { select: { fullName: true, email: true } } } } as const;
const who = (m: { user: { fullName: string | null; email: string } } | null) =>
  m ? { name: m.user.fullName ?? m.user.email } : null;
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const places = (q: string) => (q.split('.')[1] ?? '').replace(/0+$/, '').length;
const fail = (status: number, code: string, message: string, details?: object) =>
  new AppError(status, code, message, details);

const include = {
  createdBy: person,
  activatedBy: person,
  retiredBy: person,
  lines: { orderBy: { lineNo: 'asc' as const } },
} satisfies Prisma.ProductionBomInclude;
type Full = Prisma.ProductionBomGetPayload<{ include: typeof include }>;

const TIMELINE: ProductionAuditAction[] = [
  'PRODUCTION_BOM_CREATED',
  'PRODUCTION_BOM_UPDATED',
  'PRODUCTION_BOM_ACTIVATED',
  'PRODUCTION_BOM_RETIRED',
];

/** Serializes revision numbering and activation of one finished item's BOMs. */
const lockItemBoms = (tx: Prisma.TransactionClient, itemId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bom:${itemId}`}))`;

export const MATERIAL_TYPES = ['RAW_MATERIAL', 'PACKAGING', 'CONSUMABLE', 'FINISHED_GOOD'] as const;

export class BomService {
  constructor(
    private readonly db: Db,
    private readonly scope: 'customer' | 'seed' = 'customer',
  ) {}

  private async reader(ctx: AuthContext) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.bomView) throw permissionDenied('operations.bom.view');
    return actor;
  }

  private async find(actor: ProductionActor, id: string) {
    const b = await this.db.productionBom.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
    if (!b) throw bomNotFound();
    return b;
  }

  private row(b: Full | (Omit<Full, 'createdBy' | 'activatedBy' | 'retiredBy'> & object)) {
    return {
      id: b.id,
      code: b.code,
      revision: b.revision,
      status: b.status,
      item: { id: b.itemId, code: b.itemCode, name: b.itemName },
      outputQuantity: b.outputQuantity.toString(),
      unit: { code: b.unitCode, precision: b.unitPrecision },
      lineCount: b.lines.length,
      activatedAt: iso(b.activatedAt),
      updatedAt: b.updatedAt.toISOString(),
    };
  }

  private async view(actor: ProductionActor, b: Full) {
    const [revisions, orderCount, timeline] = await Promise.all([
      this.db.productionBom.findMany({
        where: { companyId: b.companyId, itemId: b.itemId },
        orderBy: { revision: 'desc' },
        select: { id: true, revision: true, status: true, updatedAt: true },
      }),
      this.db.productionOrder.count({ where: { companyId: b.companyId, bomId: b.id } }),
      this.db.auditLog.findMany({
        where: {
          companyId: b.companyId,
          entityType: 'ProductionBom',
          entityId: b.id,
          action: { in: TIMELINE },
        },
        orderBy: { occurredAt: 'asc' },
        include: { actor: { select: { fullName: true, email: true } } },
      }),
    ]);
    return {
      bom: BomView.parse({
        ...this.row(b),
        note: b.note,
        lines: b.lines.map((l) => ({
          lineNo: l.lineNo,
          item: { id: l.itemId, code: l.itemCode, name: l.itemName, type: l.itemType },
          unit: { code: l.unitCode, precision: l.unitPrecision },
          quantity: l.quantity.toString(),
          note: l.note,
        })),
        createdBy: who(b.createdBy),
        createdAt: b.createdAt.toISOString(),
        activatedBy: who(b.activatedBy),
        retiredAt: iso(b.retiredAt),
        retiredBy: who(b.retiredBy),
        retirementReason: b.retirementReason,
        revisions: revisions.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })),
        orderCount,
        actions: allowedBomActions(actor, b.status),
      }),
      timeline: timeline.map((e) => ({
        type: e.action,
        at: e.occurredAt.toISOString(),
        actor: e.actor ? { name: e.actor.fullName ?? e.actor.email } : null,
      })),
    };
  }

  // ------------------------------------------------------------------ reads

  async list(ctx: AuthContext, q: BomListInput) {
    const actor = await this.reader(ctx);
    const and: Prisma.ProductionBomWhereInput[] = [{ companyId: actor.access.company.id }];
    if (q.status) and.push({ status: q.status });
    if (q.itemId) and.push({ itemId: q.itemId });
    if (q.q) {
      const c = { contains: q.q, mode: 'insensitive' as const };
      and.push({ OR: [{ code: c }, { itemCode: c }, { itemName: c }] });
    }
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      this.db.productionBom.findMany({
        where,
        orderBy: [{ itemCode: 'asc' }, { revision: 'desc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { lines: { select: { id: true } } },
      }),
      this.db.productionBom.count({ where }),
    ]);
    return {
      items: rows.map((b) =>
        BomRow.parse({
          id: b.id,
          code: b.code,
          revision: b.revision,
          status: b.status,
          item: { id: b.itemId, code: b.itemCode, name: b.itemName },
          // EP46: the output basis and size of a recipe are recipe data.
          outputQuantity: actor.recipes ? b.outputQuantity.toString() : null,
          unit: { code: b.unitCode, precision: b.unitPrecision },
          lineCount: actor.recipes ? b.lines.length : null,
          activatedAt: iso(b.activatedAt),
          updatedAt: b.updatedAt.toISOString(),
        }),
      ),
      recipes: actor.recipes,
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: (q.page - 1) * q.pageSize + rows.length < total,
    };
  }

  /**
   * EP46: a revision's lines, output basis and notes are the confidential recipe. The
   * permission is checked BEFORE the lookup, so the answer is the same 403 whether the id
   * exists or not (no existence oracle for guessed ids).
   */
  async get(ctx: AuthContext, id: string) {
    const actor = await this.reader(ctx);
    if (!actor.recipes) throw permissionDenied('operations.recipes.view');
    return this.view(actor, await this.find(actor, id));
  }

  /**
   * Items for a production picker (server search, active only): OUTPUT = finished
   * goods tracked in stock (with their ACTIVE revision), MATERIAL = stock items.
   * Needs order or BOM read authority. No price, cost or supplier.
   */
  async items(ctx: AuthContext, q: { q?: string; role: 'OUTPUT' | 'MATERIAL' }) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.view && !actor.bomView) throw permissionDenied('operations.orders.view');
    const c = q.q ? { contains: q.q, mode: 'insensitive' as const } : undefined;
    const items = await this.db.item.findMany({
      where: {
        companyId: actor.access.company.id,
        status: 'ACTIVE',
        inventoryTracked: true,
        type: q.role === 'OUTPUT' ? 'FINISHED_GOOD' : { in: [...MATERIAL_TYPES] },
        ...(c ? { OR: [{ code: c }, { name: c }, { sku: c }, { barcode: c }] } : {}),
      },
      orderBy: { code: 'asc' },
      take: 20,
      include: {
        baseUnit: true,
        productionBoms: {
          where: { status: 'ACTIVE' },
          select: { id: true, code: true, revision: true },
        },
      },
    });
    return {
      items: items.map((i) =>
        ProductionItem.parse({
          id: i.id,
          code: i.code,
          name: i.name,
          type: i.type,
          unit: { id: i.baseUnit.id, code: i.baseUnit.code, precision: i.baseUnit.precision },
          activeBom: i.productionBoms[0] ?? null,
        }),
      ),
    };
  }

  // ------------------------------------------------------------------ validation

  private async outputItem(tx: Prisma.TransactionClient | Db, companyId: string, itemId: string) {
    const item = await tx.item.findFirst({
      where: { id: itemId, companyId },
      include: { baseUnit: true },
    });
    if (!item) {
      throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', {
        field: 'itemId',
      });
    }
    if (item.type !== 'FINISHED_GOOD' || !item.inventoryTracked) {
      throw fail(
        422,
        'ITEM_NOT_MANUFACTURABLE',
        'Only a stock-tracked finished good can be produced.',
        { field: 'itemId' },
      );
    }
    if (item.status !== 'ACTIVE') {
      throw fail(422, 'REFERENCE_INACTIVE', 'This item is inactive.', { field: 'itemId' });
    }
    return item;
  }

  private header(
    item: Awaited<ReturnType<BomService['outputItem']>>,
    outputQuantity: string,
    unitId: string | undefined,
  ) {
    if (unitId && unitId !== item.baseUnitId) {
      throw fail(
        422,
        'UNIT_CONVERSION_UNSUPPORTED',
        'Quantities must use the item’s base unit; there is no unit conversion.',
        { field: 'unitId' },
      );
    }
    if (places(outputQuantity) > item.baseUnit.precision) {
      throw fail(
        422,
        'QUANTITY_PRECISION',
        'A quantity has more decimal places than its unit allows.',
        {
          field: 'outputQuantity',
          precision: item.baseUnit.precision,
        },
      );
    }
    return {
      itemCode: item.code,
      itemName: item.name,
      unitId: item.baseUnitId,
      unitCode: item.baseUnit.code,
      unitPrecision: item.baseUnit.precision,
      outputQuantity,
    };
  }

  /**
   * Lines → rows with snapshots (active stock materials, base unit, precision, no duplicates,
   * not itself). EP46: also validates a production order's MANUAL material plan.
   */
  async lineRows(
    tx: Prisma.TransactionClient | Db,
    companyId: string,
    outputItemId: string,
    lines: readonly BomLineInput[],
  ) {
    const items = await tx.item.findMany({
      where: { companyId, id: { in: [...new Set(lines.map((l) => l.itemId))] } },
      include: { baseUnit: true },
    });
    const seen = new Set<string>();
    return lines.map((l, i) => {
      const lineNo = i + 1;
      const item = items.find((x) => x.id === l.itemId);
      if (!item) {
        throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', {
          field: 'itemId',
          lineNo,
        });
      }
      if (item.id === outputItemId) {
        throw fail(422, 'BOM_SELF_REFERENCE', 'A finished item cannot consume itself.', { lineNo });
      }
      if (seen.has(item.id)) {
        throw fail(422, 'DUPLICATE_MATERIAL', 'Each material appears once in a BOM.', { lineNo });
      }
      seen.add(item.id);
      if (!item.inventoryTracked || item.type === 'NON_STOCK') {
        throw fail(
          422,
          'MATERIAL_NOT_STOCK',
          'A material must be a stock-tracked item (not a service or non-stock line).',
          { field: 'itemId', lineNo },
        );
      }
      if (item.status !== 'ACTIVE') {
        throw fail(422, 'REFERENCE_INACTIVE', 'This item is inactive.', {
          field: 'itemId',
          lineNo,
        });
      }
      if (l.unitId && l.unitId !== item.baseUnitId) {
        throw fail(
          422,
          'UNIT_CONVERSION_UNSUPPORTED',
          'Quantities must use the item’s base unit; there is no unit conversion.',
          { field: 'unitId', lineNo },
        );
      }
      if (places(l.quantity) > item.baseUnit.precision) {
        throw fail(
          422,
          'QUANTITY_PRECISION',
          'A quantity has more decimal places than its unit allows.',
          { lineNo, precision: item.baseUnit.precision },
        );
      }
      return {
        lineNo,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        itemType: item.type,
        unitId: item.baseUnitId,
        unitCode: item.baseUnit.code,
        unitPrecision: item.baseUnit.precision,
        quantity: l.quantity,
        note: l.note ?? null,
      };
    });
  }

  private async replaceLines(
    tx: Prisma.TransactionClient,
    b: { id: string; companyId: string; itemId: string },
    rows: Awaited<ReturnType<BomService['lineRows']>>,
  ) {
    await tx.productionBomLine.deleteMany({ where: { bomId: b.id } });
    if (rows.length) {
      await tx.productionBomLine.createMany({
        data: rows.map((r) => ({ ...r, companyId: b.companyId, bomId: b.id, bomItemId: b.itemId })),
      });
    }
    await tx.productionBom.update({ where: { id: b.id }, data: { lineCounter: rows.length } });
  }

  private event(
    tx: Prisma.TransactionClient,
    actor: ProductionActor,
    meta: RequestMeta,
    action: ProductionAuditAction,
    b: { id: string; code: string; revision: number },
    details: Record<string, string | number | boolean | null> = {},
  ) {
    return recordCompanyEvent(tx, meta, {
      action,
      actorId: actor.access.actor.userId,
      actorScope: this.scope,
      companyId: actor.access.company.id,
      entityType: 'ProductionBom',
      entityId: b.id,
      details: { code: b.code, revision: b.revision, ...details },
    });
  }

  private async locked(
    tx: Prisma.TransactionClient,
    actor: ProductionActor,
    id: string,
    action: BomAction,
  ) {
    if (!actor.bomView) throw permissionDenied('operations.bom.view');
    await tx.$queryRaw`SELECT "id" FROM "ProductionBom" WHERE "id" = ${id} FOR UPDATE`;
    const b = await tx.productionBom.findFirst({
      where: { id, companyId: actor.access.company.id },
    });
    if (!b) throw bomNotFound();
    assertBom(actor, action, b.status);
    return b;
  }

  // ------------------------------------------------------------------ writes

  /** A new DRAFT revision (revision = the item's highest + 1, serialized per item). */
  async create(ctx: AuthContext, input: CreateBomInput, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.bomManage) throw permissionDenied('operations.bom.manage');
    if (!actor.recipes) throw permissionDenied('operations.recipes.view');
    return this.createAs(actor, input, meta).then((id) => this.get(ctx, id));
  }

  /** Creation without a request (also used by the demo seed with a synthetic actor). */
  async createAs(actor: ProductionActor, input: CreateBomInput, meta: RequestMeta) {
    const companyId = actor.access.company.id;
    const item = await this.outputItem(this.db, companyId, input.itemId);
    const header = this.header(item, input.outputQuantity, input.unitId);
    const rows = await this.lineRows(this.db, companyId, item.id, input.lines);
    return this.db.$transaction(async (tx) => {
      await lockItemBoms(tx, item.id);
      const last = await tx.productionBom.aggregate({
        where: { companyId, itemId: item.id },
        _max: { revision: true },
      });
      const revision = (last._max.revision ?? 0) + 1;
      const b = await tx.productionBom.create({
        data: {
          companyId,
          itemId: item.id,
          code: `BOM-${item.code}`,
          revision,
          ...header,
          note: input.note ?? null,
          createdByMemberId: actor.memberId,
        },
      });
      await this.replaceLines(tx, b, rows);
      await this.event(tx, actor, meta, 'PRODUCTION_BOM_CREATED', b, { lines: rows.length });
      return b.id;
    });
  }

  async update(ctx: AuthContext, id: string, input: UpdateBomInput, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const b = await this.locked(tx, actor, id, 'edit');
      const item = await this.outputItem(tx, b.companyId, b.itemId);
      const header = this.header(
        item,
        input.outputQuantity ?? b.outputQuantity.toString(),
        input.unitId,
      );
      await tx.productionBom.update({
        where: { id },
        data: { ...header, ...(input.note !== undefined ? { note: input.note } : {}) },
      });
      if (input.lines) {
        await this.replaceLines(tx, b, await this.lineRows(tx, b.companyId, b.itemId, input.lines));
      }
      await this.event(tx, actor, meta, 'PRODUCTION_BOM_UPDATED', b, {
        fields: Object.keys(input).sort().join(','),
      });
    });
    return this.get(ctx, id);
  }

  /**
   * DRAFT → ACTIVE. Re-validates the item and every line against the master now
   * (active, stock, base unit, precision); the item's current ACTIVE revision is
   * retired (superseded) in the same transaction. One active revision per item.
   */
  async activate(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.activateAs(actor, id, meta);
    return this.get(ctx, id);
  }

  async activateAs(actor: ProductionActor, id: string, meta: RequestMeta) {
    await this.db.$transaction(async (tx) => {
      // The item lock comes first (the order every activation of this item follows).
      const peek = await tx.productionBom.findFirst({
        where: { id, companyId: actor.access.company.id },
        select: { itemId: true },
      });
      if (!peek) {
        if (!actor.bomView) throw permissionDenied('operations.bom.view');
        throw bomNotFound();
      }
      await lockItemBoms(tx, peek.itemId);
      const b = await this.locked(tx, actor, id, 'activate');
      const item = await this.outputItem(tx, b.companyId, b.itemId);
      const lines = await tx.productionBomLine.findMany({
        where: { bomId: id },
        orderBy: { lineNo: 'asc' },
      });
      if (!lines.length) throw fail(422, 'BOM_EMPTY', 'Add at least one material first.');
      this.header(item, b.outputQuantity.toString(), undefined);
      const rows = await this.lineRows(
        tx,
        b.companyId,
        b.itemId,
        lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity.toString(), note: l.note })),
      );
      // Refresh the snapshots one last time while still a draft, then freeze.
      await this.replaceLines(tx, b, rows);
      const current = await tx.productionBom.findFirst({
        where: { companyId: b.companyId, itemId: b.itemId, status: 'ACTIVE' },
      });
      const now = new Date();
      if (current) {
        await tx.productionBom.update({
          where: { id: current.id },
          data: {
            status: 'RETIRED',
            activeSlot: null,
            retiredAt: now,
            retiredByMemberId: actor.memberId,
            retirementReason: `Superseded by revision ${b.revision}`,
          },
        });
        await this.event(tx, actor, meta, 'PRODUCTION_BOM_RETIRED', current, {
          from: 'ACTIVE',
          to: 'RETIRED',
          supersededBy: b.revision,
        });
      }
      await tx.productionBom.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          activeSlot: true,
          activatedAt: now,
          activatedByMemberId: actor.memberId,
          itemCode: item.code,
          itemName: item.name,
        },
      });
      await this.event(tx, actor, meta, 'PRODUCTION_BOM_ACTIVATED', b, {
        from: 'DRAFT',
        to: 'ACTIVE',
        lines: rows.length,
      });
    });
  }

  /** DRAFT (abandon) or ACTIVE → RETIRED. Orders keep their snapshot. */
  async retire(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const b = await this.locked(tx, actor, id, 'retire');
      if (b.status === 'ACTIVE' && !reason) {
        throw fail(422, 'REASON_REQUIRED', 'Give a reason for retiring an active revision.', {
          field: 'reason',
        });
      }
      await tx.productionBom.update({
        where: { id },
        data: {
          status: 'RETIRED',
          activeSlot: null,
          retiredAt: new Date(),
          retiredByMemberId: actor.memberId,
          retirementReason: reason,
        },
      });
      await this.event(tx, actor, meta, 'PRODUCTION_BOM_RETIRED', b, {
        from: b.status,
        to: 'RETIRED',
      });
    });
    return this.get(ctx, id);
  }

  /** A new DRAFT revision copying an ACTIVE or RETIRED revision's lines. */
  async revise(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    const src = await this.db.productionBom.findFirst({
      where: { id, companyId: actor.access.company.id },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!src) {
      if (!actor.bomView) throw permissionDenied('operations.bom.view');
      throw bomNotFound();
    }
    assertBom(actor, 'revise', src.status);
    const newId = await this.createAs(
      actor,
      {
        itemId: src.itemId,
        outputQuantity: src.outputQuantity.toString(),
        note: src.note,
        lines: src.lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity.toString(),
          note: l.note,
        })),
      },
      meta,
    );
    return this.get(ctx, newId);
  }
}
