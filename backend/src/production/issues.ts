import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import { recordCompanyEvent, type ProductionAuditAction } from '../company/audit.js';
import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { permissionDenied } from '../permissions/guard.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import { applyMovement, insufficientStock, lockLocations } from '../warehouse/ledger.js';
import type { CreateIssueInput, IssueLineInput, IssueListInput } from './input.js';
import {
  canSee,
  inBranch,
  issueNotFound,
  loadProductionActor,
  orderNotFound,
  type ProductionActor,
} from './policy.js';
import { IssueRow, IssueView, WarehouseIssueRow } from './views.js';

/*
 * Material issues (EP37) — docs/PRODUCTION_MATERIAL_ISSUE.md. A material issue
 * (MI-YYYYMM-NNNNNN) takes reserved materials out of the warehouse for one
 * production order IN_PRODUCTION: each line names one ACTIVE production
 * reservation (exact location and lot) and a quantity. DRAFT → POSTED (the
 * stock writer) or DRAFT → CANCELLED; both final (database guards).
 *
 * Posting is ONE transaction, in the global lock order:
 *   production order row → issue row → location advisory locks (shared, id
 *   order; an open count refuses) → stock balance rows (id order) → the
 *   reservation rows (id order); then per line: the reservation still ACTIVE
 *   with at least the line quantity → consume exactly that (the whole row
 *   CONSUMED, or the row reduced and a CONSUMED split created — history on
 *   both) → PRODUCTION_CONSUMPTION through ledger.ts applyMovement() with the
 *   reservation guard intact (what stays must still cover every other sales and
 *   production reservation) → issue POSTED → audit. Any refusal rolls back all.
 * A second post finds the issue no longer DRAFT (409) and the unique
 * (issue line, type) movement key refuses a duplicate again.
 */

const person = { select: { user: { select: { fullName: true, email: true } } } } as const;
const who = (m: { user: { fullName: string | null; email: string } } | null) =>
  m ? { name: m.user.fullName ?? m.user.email } : null;
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const places = (q: string) => (q.split('.')[1] ?? '').replace(/0+$/, '').length;
const fail = (status: number, code: string, message: string, details?: object) =>
  new AppError(status, code, message, details);

const lineInclude = {
  orderBy: { lineNo: 'asc' as const },
  include: {
    allocation: {
      select: {
        status: true,
        quantity: true,
        material: {
          select: {
            lineNo: true,
            itemCode: true,
            itemName: true,
            unitCode: true,
            unitPrecision: true,
          },
        },
      },
    },
    location: { select: { id: true, code: true, name: true } },
    lot: { select: { id: true, lotNumber: true, expiryDate: true } },
  },
};
const include = {
  branch: { select: { id: true, code: true, name: true } },
  order: {
    select: { id: true, number: true, status: true, createdByMemberId: true, branchId: true },
  },
  createdBy: person,
  postedBy: person,
  cancelledBy: person,
  lines: lineInclude,
} satisfies Prisma.ProductionMaterialIssueInclude;
type Full = Prisma.ProductionMaterialIssueGetPayload<{ include: typeof include }>;

const TIMELINE: ProductionAuditAction[] = [
  'MATERIAL_ISSUE_CREATED',
  'MATERIAL_ISSUE_UPDATED',
  'MATERIAL_ISSUE_POSTED',
  'MATERIAL_ISSUE_CANCELLED',
];

export class MaterialIssueService {
  constructor(
    private readonly db: Db,
    private readonly scope: 'customer' | 'seed' = 'customer',
  ) {}

  private async reader(ctx: AuthContext) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.view) throw permissionDenied('operations.orders.view');
    return actor;
  }

  private where(
    actor: ProductionActor,
    branchId?: string,
  ): Prisma.ProductionMaterialIssueWhereInput {
    const ids = actor.branches.map((b) => b.id);
    return {
      companyId: actor.access.company.id,
      branchId: { in: branchId ? ids.filter((b) => b === branchId) : ids },
    };
  }

  private async find(actor: ProductionActor, id: string) {
    const i = await this.db.productionMaterialIssue.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
    if (!i || !inBranch(actor, i.branchId)) throw issueNotFound();
    return i;
  }

  private row(i: Full) {
    return {
      id: i.id,
      number: i.number,
      status: i.status,
      branch: i.branch,
      order: { id: i.order.id, number: i.order.number, status: i.order.status },
      lineCount: i.lines.length,
      createdBy: who(i.createdBy),
      createdAt: i.createdAt.toISOString(),
      postedAt: iso(i.postedAt),
      updatedAt: i.updatedAt.toISOString(),
    };
  }

  private actions(actor: ProductionActor, i: Full) {
    if (i.status !== 'DRAFT') return [];
    const out: ('edit' | 'post' | 'cancel')[] = [];
    if (actor.issueCreate) out.push('edit');
    if (actor.issuePost && i.order.status === 'IN_PRODUCTION') out.push('post');
    if (actor.issueCreate || actor.issuePost) out.push('cancel');
    return out;
  }

  private async view(actor: ProductionActor, i: Full) {
    const timeline = await this.db.auditLog.findMany({
      where: {
        companyId: i.companyId,
        entityType: 'ProductionMaterialIssue',
        entityId: i.id,
        action: { in: TIMELINE },
      },
      orderBy: { occurredAt: 'asc' },
      include: { actor: { select: { fullName: true, email: true } } },
    });
    return {
      issue: IssueView.parse({
        ...this.row(i),
        note: i.note,
        postedBy: who(i.postedBy),
        cancelledAt: iso(i.cancelledAt),
        cancelledBy: who(i.cancelledBy),
        cancellationReason: i.cancellationReason,
        lines: i.lines.map((l) => ({
          id: l.id,
          lineNo: l.lineNo,
          materialLineNo: l.allocation.material.lineNo,
          item: {
            id: l.itemId,
            code: l.allocation.material.itemCode,
            name: l.allocation.material.itemName,
          },
          unit: {
            code: l.allocation.material.unitCode,
            precision: l.allocation.material.unitPrecision,
          },
          location: l.location,
          lot: l.lot ? { ...l.lot, expiryDate: day(l.lot.expiryDate) } : null,
          quantity: l.quantity.toString(),
          allocationId: l.allocationId,
          reserved:
            i.status === 'DRAFT'
              ? l.allocation.status === 'ACTIVE'
                ? l.allocation.quantity.toString()
                : '0'
              : null,
        })),
        actions: this.actions(actor, i),
      }),
      timeline: timeline.map((e) => ({
        type: e.action,
        at: e.occurredAt.toISOString(),
        actor: e.actor ? { name: e.actor.fullName ?? e.actor.email } : null,
      })),
    };
  }

  // ------------------------------------------------------------------ reads

  async list(ctx: AuthContext, q: IssueListInput) {
    const actor = await this.reader(ctx);
    const and: Prisma.ProductionMaterialIssueWhereInput[] = [this.where(actor, q.branchId)];
    if (q.status) and.push({ status: q.status });
    if (q.productionOrderId) and.push({ productionOrderId: q.productionOrderId });
    if (q.q) {
      const c = { contains: q.q, mode: 'insensitive' as const };
      and.push({ OR: [{ number: c }, { order: { number: c } }] });
    }
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      this.db.productionMaterialIssue.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include,
      }),
      this.db.productionMaterialIssue.count({ where }),
    ]);
    return {
      items: rows.map((i) => IssueRow.parse(this.row(i))),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: (q.page - 1) * q.pageSize + rows.length < total,
    };
  }

  async get(ctx: AuthContext, id: string) {
    const actor = await this.reader(ctx);
    return this.view(actor, await this.find(actor, id));
  }

  /** The Warehouse handoff: DRAFT and POSTED issues of the member's branches — what leaves, from where. */
  async warehouseList(
    ctx: AuthContext,
    q: { status?: 'DRAFT' | 'POSTED'; page: number; pageSize: number },
  ) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.warehouseIssues) throw permissionDenied('warehouse.material_issues.view');
    const where: Prisma.ProductionMaterialIssueWhereInput = {
      ...this.where(actor),
      status: q.status ? q.status : { in: ['DRAFT', 'POSTED'] },
    };
    const [rows, total] = await Promise.all([
      this.db.productionMaterialIssue.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include,
      }),
      this.db.productionMaterialIssue.count({ where }),
    ]);
    return {
      items: rows.map((i) =>
        WarehouseIssueRow.parse({
          id: i.id,
          number: i.number,
          status: i.status,
          branch: i.branch,
          order: { number: i.order.number },
          postedAt: iso(i.postedAt),
          createdAt: i.createdAt.toISOString(),
          lines: i.lines.map((l) => ({
            item: {
              id: l.itemId,
              code: l.allocation.material.itemCode,
              name: l.allocation.material.itemName,
            },
            unit: {
              code: l.allocation.material.unitCode,
              precision: l.allocation.material.unitPrecision,
            },
            location: l.location,
            lot: l.lot ? { ...l.lot, expiryDate: day(l.lot.expiryDate) } : null,
            quantity: l.quantity.toString(),
          })),
        }),
      ),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: (q.page - 1) * q.pageSize + rows.length < total,
    };
  }

  // ------------------------------------------------------------------ writes

  private event(
    tx: Prisma.TransactionClient,
    actor: ProductionActor,
    meta: RequestMeta,
    action: ProductionAuditAction,
    i: { id: string; number: string },
    details: Record<string, string | number | boolean | null> = {},
  ) {
    return recordCompanyEvent(tx, meta, {
      action,
      actorId: actor.access.actor.userId,
      actorScope: this.scope,
      companyId: actor.access.company.id,
      entityType: 'ProductionMaterialIssue',
      entityId: i.id,
      details: { number: i.number, ...details },
    });
  }

  /** The production order row, locked, visible and IN_PRODUCTION (draft and post both need it). */
  private async lockOrder(tx: Prisma.TransactionClient, actor: ProductionActor, orderId: string) {
    await tx.$queryRaw`SELECT "id" FROM "ProductionOrder" WHERE "id" = ${orderId} FOR UPDATE`;
    const o = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: actor.access.company.id },
    });
    if (!o || !canSee(actor, o)) throw orderNotFound();
    if (o.status !== 'IN_PRODUCTION') {
      throw fail(
        409,
        'MO_NOT_IN_PRODUCTION',
        'Materials are issued only to a production order in production.',
        { status: o.status },
      );
    }
    return o;
  }

  /**
   * Lines → rows: each names an ACTIVE reservation of this order; together the
   * draft lines of every issue never claim more than a reservation holds.
   * Without lines: every reservation's unclaimed quantity.
   */
  private async lineRows(
    tx: Prisma.TransactionClient,
    orderId: string,
    lines: readonly IssueLineInput[] | undefined,
    exceptIssueId?: string,
  ) {
    const [active, claims] = await Promise.all([
      tx.productionMaterialAllocation.findMany({
        where: { productionOrderId: orderId, status: 'ACTIVE' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { material: { select: { lineNo: true, unitPrecision: true, itemCode: true } } },
      }),
      tx.productionMaterialIssueLine.groupBy({
        by: ['allocationId'],
        where: {
          productionOrderId: orderId,
          issue: { status: 'DRAFT' },
          ...(exceptIssueId ? { issueId: { not: exceptIssueId } } : {}),
        },
        _sum: { quantity: true },
      }),
    ]);
    const claimed = new Map(claims.map((c) => [c.allocationId, c._sum.quantity ?? ZERO]));
    const free = (id: string) => {
      const r = active.find((a) => a.id === id)!;
      return Decimal.max(ZERO, r.quantity.minus(claimed.get(id) ?? ZERO));
    };
    const wanted = lines
      ? lines.map((l, i) => {
          const r = active.find((a) => a.id === l.allocationId);
          if (!r) {
            throw fail(409, 'RESERVATION_NOT_ACTIVE', 'This reservation is no longer active.', {
              lineNo: i + 1,
            });
          }
          if (lines.findIndex((x) => x.allocationId === l.allocationId) !== i) {
            throw fail(422, 'DUPLICATE_LINE', 'Each reservation appears once in an issue.', {
              lineNo: i + 1,
            });
          }
          if (places(l.quantity) > r.material.unitPrecision) {
            throw fail(
              422,
              'QUANTITY_PRECISION',
              'A quantity has more decimal places than its unit allows.',
              { lineNo: i + 1, precision: r.material.unitPrecision },
            );
          }
          if (new Decimal(l.quantity).gt(free(r.id))) {
            throw fail(
              409,
              'ISSUE_EXCEEDS_RESERVATION',
              'This is more than the reservation still holds for issuing.',
              { lineNo: i + 1, item: r.material.itemCode, free: free(r.id).toString() },
            );
          }
          return { r, quantity: new Decimal(l.quantity) };
        })
      : active.map((r) => ({ r, quantity: free(r.id) })).filter((x) => x.quantity.gt(0));
    if (!wanted.length) {
      throw fail(422, 'NOTHING_TO_ISSUE', 'Nothing is reserved and unclaimed to issue.');
    }
    return wanted.map((w, i) => ({
      lineNo: i + 1,
      materialId: w.r.materialId,
      allocationId: w.r.id,
      itemId: w.r.itemId,
      locationId: w.r.locationId,
      lotId: w.r.lotId,
      lotKey: w.r.lotKey,
      quantity: w.quantity,
    }));
  }

  private async writeLines(
    tx: Prisma.TransactionClient,
    i: { id: string; companyId: string; branchId: string; productionOrderId: string },
    rows: Awaited<ReturnType<MaterialIssueService['lineRows']>>,
  ) {
    await tx.productionMaterialIssueLine.deleteMany({ where: { issueId: i.id } });
    await tx.productionMaterialIssueLine.createMany({
      data: rows.map((r) => ({
        ...r,
        companyId: i.companyId,
        branchId: i.branchId,
        issueId: i.id,
        productionOrderId: i.productionOrderId,
      })),
    });
    await tx.productionMaterialIssue.update({
      where: { id: i.id },
      data: { lineCounter: rows.length },
    });
  }

  async create(ctx: AuthContext, input: CreateIssueInput, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.issueCreate) throw permissionDenied('operations.material_issues.create');
    const id = await this.createAs(actor, input, meta);
    return this.get(ctx, id);
  }

  async createAs(actor: ProductionActor, input: CreateIssueInput, meta: RequestMeta) {
    const companyId = actor.access.company.id;
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: actor.access.company.timezone,
    }).format(new Date());
    return this.db.$transaction(async (tx) => {
      const o = await this.lockOrder(tx, actor, input.productionOrderId);
      const rows = await this.lineRows(tx, o.id, input.lines);
      const period = today.slice(0, 7).replace('-', '');
      const seq = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
        VALUES (${companyId}, ${`MI:${period}`}, 1, NOW())
        ON CONFLICT ("companyId", "key")
        DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue"`;
      const number = `MI-${period}-${String(seq[0]!.lastValue).padStart(6, '0')}`;
      const i = await tx.productionMaterialIssue.create({
        data: {
          companyId,
          branchId: o.branchId,
          productionOrderId: o.id,
          number,
          note: input.note ?? null,
          createdByMemberId: actor.memberId,
        },
      });
      await this.writeLines(tx, i, rows);
      await this.event(tx, actor, meta, 'MATERIAL_ISSUE_CREATED', i, {
        order: o.number,
        lines: rows.length,
      });
      return i.id;
    });
  }

  /** Issue row locked after its order row (the global order), still a DRAFT. */
  private async lockedIssue(tx: Prisma.TransactionClient, actor: ProductionActor, id: string) {
    const peek = await tx.productionMaterialIssue.findFirst({
      where: { id, companyId: actor.access.company.id },
      select: { productionOrderId: true, branchId: true },
    });
    if (!peek || !inBranch(actor, peek.branchId)) throw issueNotFound();
    await tx.$queryRaw`SELECT "id" FROM "ProductionOrder" WHERE "id" = ${peek.productionOrderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "ProductionMaterialIssue" WHERE "id" = ${id} FOR UPDATE`;
    const i = await tx.productionMaterialIssue.findUniqueOrThrow({ where: { id } });
    if (i.status !== 'DRAFT') {
      throw fail(
        409,
        i.status === 'POSTED' ? 'MI_ALREADY_POSTED' : 'MI_INVALID_TRANSITION',
        'This material issue is no longer a draft.',
        { status: i.status },
      );
    }
    const o = await tx.productionOrder.findUniqueOrThrow({ where: { id: i.productionOrderId } });
    return { i, o };
  }

  async updateLines(
    ctx: AuthContext,
    id: string,
    input: { lines: IssueLineInput[]; note?: string | null },
    meta: RequestMeta,
  ) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.view) throw permissionDenied('operations.orders.view');
    await this.db.$transaction(async (tx) => {
      const { i } = await this.lockedIssue(tx, actor, id);
      if (!actor.issueCreate) throw permissionDenied('operations.material_issues.create');
      await this.lockOrder(tx, actor, i.productionOrderId);
      await this.writeLines(tx, i, await this.lineRows(tx, i.productionOrderId, input.lines, i.id));
      if (input.note !== undefined) {
        await tx.productionMaterialIssue.update({ where: { id }, data: { note: input.note } });
      }
      await this.event(tx, actor, meta, 'MATERIAL_ISSUE_UPDATED', i, { lines: input.lines.length });
    });
    return this.get(ctx, id);
  }

  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.view) throw permissionDenied('operations.orders.view');
    await this.db.$transaction(async (tx) => {
      const { i } = await this.lockedIssue(tx, actor, id);
      if (!actor.issueCreate && !actor.issuePost) {
        throw permissionDenied('operations.material_issues.create');
      }
      await tx.productionMaterialIssue.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      await this.event(tx, actor, meta, 'MATERIAL_ISSUE_CANCELLED', i, {
        from: 'DRAFT',
        to: 'CANCELLED',
      });
    });
    return this.get(ctx, id);
  }

  /** DRAFT → POSTED: the one production stock writer (see the header for the transaction). */
  async post(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.postAs(actor, id, meta);
    return this.get(ctx, id);
  }

  async postAs(actor: ProductionActor, id: string, meta: RequestMeta) {
    if (!actor.view) throw permissionDenied('operations.orders.view');
    await this.db.$transaction(async (tx) => {
      const { i, o } = await this.lockedIssue(tx, actor, id);
      if (!actor.issuePost) throw permissionDenied('operations.material_issues.approve');
      if (o.status !== 'IN_PRODUCTION') {
        throw fail(
          409,
          'MO_NOT_IN_PRODUCTION',
          'Materials are issued only to a production order in production.',
          { status: o.status },
        );
      }
      const lines = await tx.productionMaterialIssueLine.findMany({
        where: { issueId: id },
        orderBy: { lineNo: 'asc' },
        include: { allocation: { select: { material: { select: { itemCode: true } } } } },
      });
      if (!lines.length) throw fail(422, 'DOCUMENT_EMPTY', 'This material issue has no lines.');
      await lockLocations(
        tx,
        lines.map((l) => l.locationId),
        'shared',
      );
      // Balance rows, then reservation rows, each in id order (the allocation paths lock
      // balances in id order too; nothing locks a reservation before its balance).
      await tx.$queryRaw`
        SELECT b."id" FROM "StockBalance" b
        JOIN unnest(${lines.map((l) => l.locationId)}::text[], ${lines.map((l) => l.itemId)}::text[],
                    ${lines.map((l) => l.lotKey)}::text[]) AS k(loc, item, lot)
          ON b."locationId" = k.loc AND b."itemId" = k.item AND b."lotKey" = k.lot
        ORDER BY b."id" FOR UPDATE OF b`;
      await tx.$queryRaw`
        SELECT "id" FROM "ProductionMaterialAllocation"
        WHERE "id" = ANY(${[...new Set(lines.map((l) => l.allocationId))]}::text[])
        ORDER BY "id" FOR UPDATE`;
      const now = new Date();
      const ledger = {
        companyId: actor.access.company.id,
        memberId: actor.memberId,
        userId: actor.access.actor.userId,
        scope: this.scope,
        meta,
      };
      for (const l of lines) {
        const r = await tx.productionMaterialAllocation.findUniqueOrThrow({
          where: { id: l.allocationId },
        });
        if (r.status !== 'ACTIVE' || r.quantity.lt(l.quantity)) {
          throw fail(
            409,
            'RESERVATION_MISMATCH',
            'The reservation behind this line no longer holds the quantity. Nothing was issued.',
            { lineNo: l.lineNo, item: l.allocation.material.itemCode },
          );
        }
        // Consume exactly what leaves: the whole row, or split it (history kept on both).
        if (r.quantity.eq(l.quantity)) {
          await tx.productionMaterialAllocation.update({
            where: { id: r.id },
            data: { status: 'CONSUMED', activeSlot: null, consumedAt: now, issueLineId: l.id },
          });
        } else {
          await tx.productionMaterialAllocation.update({
            where: { id: r.id },
            data: { quantity: { decrement: l.quantity } },
          });
          await tx.productionMaterialAllocation.create({
            data: {
              companyId: r.companyId,
              branchId: r.branchId,
              productionOrderId: r.productionOrderId,
              materialId: r.materialId,
              itemId: r.itemId,
              locationId: r.locationId,
              lotId: r.lotId,
              lotKey: r.lotKey,
              quantity: l.quantity,
              excess: r.excess,
              excessReason: r.excessReason,
              status: 'CONSUMED',
              activeSlot: null,
              createdByMemberId: actor.memberId,
              consumedAt: now,
              issueLineId: l.id,
              splitFromId: r.id,
            },
          });
        }
        await applyMovement(tx, ledger, {
          branchId: l.branchId,
          locationId: l.locationId,
          itemId: l.itemId,
          lotId: l.lotId,
          type: 'PRODUCTION_CONSUMPTION',
          delta: ZERO.minus(l.quantity),
          source: {
            sourceType: 'PRODUCTION_ISSUE',
            productionMaterialIssueId: id,
            productionMaterialIssueLineId: l.id,
          },
          occurredAt: now,
          short: () =>
            insufficientStock({ lineNo: l.lineNo, item: l.allocation.material.itemCode }),
        });
      }
      await tx.productionMaterialIssue.update({
        where: { id },
        data: { status: 'POSTED', postedAt: now, postedByMemberId: actor.memberId },
      });
      await this.event(tx, actor, meta, 'MATERIAL_ISSUE_POSTED', i, {
        order: o.number,
        from: 'DRAFT',
        to: 'POSTED',
        lines: lines.length,
      });
    });
  }
}
