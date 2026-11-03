import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import { recordCompanyEvent } from '../company/audit.js';
import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { permissionDenied } from '../permissions/guard.js';
import { companyDay } from '../purchasing/service.js';
import { ZERO } from '../purchasing/money.js';
import type {
  CreateReceiptInput,
  ExpiryState,
  LineInput,
  MovementInput,
  ReceiptListInput,
  StockInput,
  UpdateReceiptInput,
} from './input.js';
import { postReceipt, reverseReceipt, saveReceiptLine, type LedgerActor } from './ledger.js';
import {
  assertGr,
  grAllowedActions,
  inBranch,
  loadWarehouseActor,
  receiptNotFound,
  receiptStateChanged,
  type GrAction,
  type WarehouseActor,
} from './policy.js';
import { isReceivable, progressOf, receiveProgress, remainingOf } from './progress.js';
import { assertLocations } from './rules.js';
import {
  FefoCandidate,
  GoodsReceiptRow,
  GoodsReceiptView,
  MovementRow,
  StockRow,
} from './views.js';

/*
 * Goods receipts, stock, lots and the movement ledger (EP31) —
 * docs/WAREHOUSE_RECEIVING.md, docs/INVENTORY_LEDGER.md.
 *
 * A receipt is created from a PENDING_RECEIVE order in one of the member's
 * branches (never a free-form receipt), with one line per receivable order
 * line that still has something to receive. Warehouse fills in what was
 * accepted and rejected and where the accepted quantity went (location, lot,
 * expiry); posting writes the ledger (ledger.ts). The order's item, unit,
 * supplier and quantities come from the order — the client names an order
 * line, never an item.
 */

/** Expiring soon: within this many days (display only). */
export const EXPIRING_SOON_DAYS = 30;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const who = (m: { user: { fullName: string | null; email: string } } | null) =>
  m ? { name: m.user.fullName ?? m.user.email } : null;
const person = { select: { user: { select: { fullName: true, email: true } } } } as const;
const loc = { select: { id: true, code: true, name: true } } as const;

const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export function expiryStateOf(expiry: string | null, today: string): ExpiryState {
  if (!expiry) return 'NO_EXPIRY';
  if (expiry < today) return 'EXPIRED';
  return expiry <= addDays(today, EXPIRING_SOON_DAYS) ? 'EXPIRING_SOON' : 'OK';
}

const daysBetween = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );

const receiptInclude = {
  branch: { select: { id: true, code: true, name: true } },
  defaultLocation: loc,
  createdBy: person,
  postedBy: person,
  cancelledBy: person,
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: {
      item: {
        select: { id: true, code: true, name: true, lotTracking: true, expiryTracking: true },
      },
      unit: { select: { code: true, name: true, precision: true } },
      orderLine: { select: { id: true, lineNo: true, quantity: true } },
      allocations: { orderBy: { createdAt: 'asc' as const }, include: { location: loc } },
    },
  },
} satisfies Prisma.GoodsReceiptInclude;
type FullReceipt = Prisma.GoodsReceiptGetPayload<{ include: typeof receiptInclude }>;

const TIMELINE = ['GOODS_RECEIPT_CREATED', 'GOODS_RECEIPT_POSTED', 'GOODS_RECEIPT_CANCELLED'];

export class ReceivingService {
  constructor(private readonly db: Db) {}

  private ledgerActor(actor: WarehouseActor, meta: RequestMeta): LedgerActor {
    return {
      companyId: actor.access.company.id,
      memberId: actor.memberId,
      userId: actor.access.actor.userId,
      scope: 'customer',
      meta,
    };
  }

  private today(actor: WarehouseActor) {
    return companyDay(actor.access.company.timezone);
  }

  private branchFilter(actor: WarehouseActor, branchId?: string) {
    const ids = actor.branches.map((b) => b.id);
    return { in: branchId ? ids.filter((b) => b === branchId) : ids };
  }

  // ------------------------------------------------------------- context

  /** What the caller may do, their branches, the selected branch's locations and real counts. */
  async context(ctx: AuthContext) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.receiving.view && !actor.inventory.view) {
      throw permissionDenied('warehouse.receiving.view');
    }
    const companyId = actor.access.company.id;
    const selected =
      actor.branches.find((b) => b.id === ctx.session.branchId) ??
      (actor.branches.length === 1 ? actor.branches[0]! : null);
    const branchIds = selected ? [selected.id] : actor.branches.map((b) => b.id);
    const today = this.today(actor);
    const soon = new Date(`${addDays(today, EXPIRING_SOON_DAYS)}T00:00:00Z`);
    const todayDate = new Date(`${today}T00:00:00Z`);
    const lotStock = (expiryDate: Prisma.DateTimeNullableFilter) => ({
      companyId,
      branchId: { in: branchIds },
      quantityOnHand: { gt: 0 },
      lot: { expiryDate },
    });
    const scoped = { companyId, branchId: { in: branchIds } };
    const [locations, pending, drafts, stockRows, expiring, expired, ...control] =
      await Promise.all([
        this.db.warehouseLocation.findMany({
          where: { companyId, branchId: { in: branchIds }, status: 'ACTIVE' },
          orderBy: [{ defaultSlot: 'asc' }, { code: 'asc' }],
          select: { id: true, code: true, name: true, branchId: true, defaultSlot: true },
        }),
        actor.receiving.view
          ? this.db.purchaseOrder.count({
              where: { companyId, branchId: { in: branchIds }, status: 'PENDING_RECEIVE' },
            })
          : null,
        actor.receiving.view
          ? this.db.goodsReceipt.count({
              where: { companyId, branchId: { in: branchIds }, status: 'DRAFT' },
            })
          : null,
        actor.inventory.view
          ? this.db.stockBalance.count({
              where: { companyId, branchId: { in: branchIds }, quantityOnHand: { gt: 0 } },
            })
          : null,
        actor.inventory.view
          ? this.db.stockBalance.count({ where: lotStock({ gte: todayDate, lte: soon }) })
          : null,
        actor.inventory.view
          ? this.db.stockBalance.count({ where: lotStock({ lt: todayDate }) })
          : null,
        // EP32: open inventory-control work (read with warehouse.inventory.view).
        actor.inventory.view
          ? this.db.inventoryTransfer.count({ where: { ...scoped, status: 'DRAFT' } })
          : null,
        actor.inventory.view
          ? this.db.stockAdjustment.count({ where: { ...scoped, status: 'SUBMITTED' } })
          : null,
        actor.inventory.view
          ? this.db.cycleCount.count({
              where: { ...scoped, status: { in: ['COUNTING', 'REVIEW'] } },
            })
          : null,
      ]);
    const [draftTransfers, submittedAdjustments, activeCounts] = control;
    return {
      receiving: actor.receiving,
      inventory: actor.inventory,
      transfers: actor.transfers,
      adjustments: actor.adjustments,
      cycleCounts: actor.counts,
      branches: actor.branches,
      selectedBranch: selected,
      locations: locations.map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        branchId: l.branchId,
        isDefault: l.defaultSlot === true,
      })),
      counts: {
        pendingReceive: pending,
        draftReceipts: drafts,
        stockRows,
        expiring,
        expired,
        draftTransfers: draftTransfers ?? null,
        submittedAdjustments: submittedAdjustments ?? null,
        activeCounts: activeCounts ?? null,
      },
      expiringSoonDays: EXPIRING_SOON_DAYS,
      today,
    };
  }

  // ------------------------------------------------------------- receipts

  private visible(actor: WarehouseActor, r: { branchId: string }) {
    return actor.receiving.view && inBranch(actor, r.branchId);
  }

  private async find(actor: WarehouseActor, id: string) {
    return this.db.goodsReceipt.findFirst({
      where: { id, companyId: actor.access.company.id },
      include: receiptInclude,
    });
  }

  private async view(actor: WarehouseActor, r: FullReceipt) {
    const [progress, events] = await Promise.all([
      receiveProgress(
        this.db,
        r.lines.map((l) => l.purchaseOrderLineId),
        r.id,
      ),
      this.db.auditLog.findMany({
        where: {
          companyId: r.companyId,
          entityType: 'GoodsReceipt',
          entityId: r.id,
          action: { in: TIMELINE },
        },
        orderBy: { occurredAt: 'asc' },
        include: { actor: { select: { fullName: true, email: true } } },
      }),
    ]);
    const receipt = GoodsReceiptView.parse({
      id: r.id,
      number: r.number,
      status: r.status,
      branch: r.branch,
      order: { id: r.purchaseOrderId, number: r.poNumber },
      supplier: { code: r.supplierCode, name: r.supplierName },
      receivedAt: r.receivedAt.toISOString(),
      createdBy: who(r.createdBy),
      postedAt: iso(r.postedAt),
      lineCount: r.lines.length,
      updatedAt: r.updatedAt.toISOString(),
      defaultLocation: r.defaultLocation,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      postedBy: who(r.postedBy),
      cancelledAt: iso(r.cancelledAt),
      cancelledBy: who(r.cancelledBy),
      cancellationReason: r.cancellationReason,
      lines: r.lines.map((l) => {
        const p = progressOf(progress, l.purchaseOrderLineId);
        return {
          id: l.id,
          lineNo: l.lineNo,
          orderLine: { id: l.orderLine.id, lineNo: l.orderLine.lineNo },
          item: l.item,
          unit: l.unit,
          ordered: l.orderLine.quantity.toString(),
          receivedElsewhere: p.accepted.toString(),
          remaining: remainingOf(l.orderLine.quantity, p).toString(),
          acceptedQuantity: l.acceptedQuantity.toString(),
          rejectedQuantity: l.rejectedQuantity.toString(),
          rejectReason: l.rejectReason,
          rejectNote: l.rejectNote,
          replacementRequired: l.replacementRequired,
          note: l.note,
          allocations: l.allocations.map((x) => ({
            id: x.id,
            location: x.location,
            lotNumber: x.lotNumber,
            lotId: x.lotId,
            expiryDate: day(x.expiryDate),
            manufacturedDate: day(x.manufacturedDate),
            quantity: x.quantity.toString(),
          })),
        };
      }),
      actions: grAllowedActions(actor, r),
    });
    return {
      receipt,
      timeline: events.map((e) => ({
        type: e.action,
        at: e.occurredAt.toISOString(),
        actor: e.actor ? { name: e.actor.fullName ?? e.actor.email } : null,
      })),
    };
  }

  async list(ctx: AuthContext, q: ReceiptListInput) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.receiving.view) throw permissionDenied('warehouse.receiving.view');
    const where: Prisma.GoodsReceiptWhereInput = {
      companyId: actor.access.company.id,
      branchId: this.branchFilter(actor, q.branchId),
      ...(q.status ? { status: q.status } : {}),
      ...(q.purchaseOrderId ? { purchaseOrderId: q.purchaseOrderId } : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q, mode: 'insensitive' } },
              { poNumber: { contains: q.q, mode: 'insensitive' } },
              { supplierName: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (q.page - 1) * q.pageSize;
    const [rows, total, counts] = await Promise.all([
      this.db.goodsReceipt.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: q.pageSize,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          createdBy: person,
          _count: { select: { lines: true } },
        },
      }),
      this.db.goodsReceipt.count({ where }),
      this.db.goodsReceipt.groupBy({
        by: ['status'],
        where: {
          companyId: actor.access.company.id,
          branchId: this.branchFilter(actor, q.branchId),
        },
        _count: { _all: true },
      }),
    ]);
    return {
      items: rows.map((r) =>
        GoodsReceiptRow.parse({
          id: r.id,
          number: r.number,
          status: r.status,
          branch: r.branch,
          order: { id: r.purchaseOrderId, number: r.poNumber },
          supplier: { code: r.supplierCode, name: r.supplierName },
          receivedAt: r.receivedAt.toISOString(),
          createdBy: who(r.createdBy),
          postedAt: iso(r.postedAt),
          lineCount: r._count.lines,
          updatedAt: r.updatedAt.toISOString(),
        }),
      ),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: skip + rows.length < total,
    };
  }

  async get(ctx: AuthContext, id: string) {
    const actor = await loadWarehouseActor(this.db, ctx);
    const r = await this.find(actor, id);
    if (!r || !this.visible(actor, r)) throw receiptNotFound();
    return this.view(actor, r);
  }

  private receivedAt(value: string | undefined) {
    if (!value) return new Date();
    const at = new Date(value);
    if (at.getTime() > Date.now() + 5 * 60_000) {
      throw new AppError(422, 'RECEIVED_AT_INVALID', 'The receipt time cannot be in the future.', {
        field: 'receivedAt',
      });
    }
    return at;
  }

  /**
   * A DRAFT receipt for a PENDING_RECEIVE order: one line per receivable
   * order line with something left, nothing accepted yet. Number GR-YYYYMM-NNNNNN.
   */
  async create(ctx: AuthContext, input: CreateReceiptInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.receiving.process) throw permissionDenied('warehouse.receiving.process');
    const companyId = actor.access.company.id;
    const order = await this.db.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, companyId },
    });
    if (!order || !inBranch(actor, order.branchId) || order.status === 'DRAFT') {
      throw new AppError(404, 'PO_NOT_FOUND', 'This purchase order was not found.');
    }
    const receivedAt = this.receivedAt(input.receivedAt);
    const today = this.today(actor);
    const id = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${order.id} FOR SHARE`;
      const o = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          lines: {
            orderBy: { lineNo: 'asc' },
            include: { item: { select: { inventoryTracked: true } } },
          },
        },
      });
      if (o.status !== 'PENDING_RECEIVE') {
        throw new AppError(409, 'PO_NOT_RECEIVABLE', 'This order is not waiting to be received.', {
          status: o.status,
        });
      }
      const receivable = o.lines.filter(isReceivable);
      const progress = await receiveProgress(
        tx,
        receivable.map((l) => l.id),
      );
      const open = receivable.filter((l) =>
        remainingOf(l.quantity, progressOf(progress, l.id)).gt(0),
      );
      if (!open.length) {
        throw new AppError(409, 'PO_NOTHING_TO_RECEIVE', 'Everything on this order is received.');
      }
      let defaultLocationId = input.defaultLocationId ?? null;
      if (defaultLocationId) {
        await assertLocations(tx, o.branchId, [defaultLocationId]);
      } else if (input.defaultLocationId === undefined) {
        const main = await tx.warehouseLocation.findFirst({
          where: { branchId: o.branchId, defaultSlot: true, status: 'ACTIVE' },
        });
        defaultLocationId = main?.id ?? null;
      }
      const period = today.slice(0, 7).replace('-', '');
      const seq = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
        VALUES (${companyId}, ${`GR:${period}`}, 1, NOW())
        ON CONFLICT ("companyId", "key")
        DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue"`;
      const number = `GR-${period}-${String(seq[0]!.lastValue).padStart(6, '0')}`;
      const r = await tx.goodsReceipt.create({
        data: {
          companyId,
          branchId: o.branchId,
          number,
          purchaseOrderId: o.id,
          poNumber: o.number,
          supplierId: o.supplierId,
          supplierCode: o.supplierCode,
          supplierName: o.supplierName,
          receivedAt,
          defaultLocationId,
          note: input.note ?? null,
          lineCounter: open.length,
          createdByMemberId: actor.memberId,
        },
      });
      await tx.goodsReceiptLine.createMany({
        data: open.map((l, i) => ({
          companyId,
          branchId: o.branchId,
          goodsReceiptId: r.id,
          purchaseOrderId: o.id,
          purchaseOrderLineId: l.id,
          lineNo: i + 1,
          itemId: l.itemId!,
          itemCode: l.itemCode!,
          itemName: l.itemName!,
          unitId: l.unitId!,
          unitCode: l.unitCode!,
          unitName: l.unitName,
        })),
      });
      await recordCompanyEvent(tx, meta, {
        action: 'GOODS_RECEIPT_CREATED',
        actorId: actor.access.actor.userId,
        actorScope: 'customer',
        companyId,
        entityType: 'GoodsReceipt',
        entityId: r.id,
        details: { number, order: o.number, lines: open.length },
      });
      return r.id;
    });
    return this.get(ctx, id);
  }

  /** Loads a visible receipt and checks the action before any transaction. */
  private async actionable(actor: WarehouseActor, id: string, action: GrAction) {
    const r = await this.db.goodsReceipt.findFirst({
      where: { id, companyId: actor.access.company.id },
    });
    if (!r || !this.visible(actor, r)) throw receiptNotFound();
    assertGr(actor, action, r);
    return r;
  }

  /** Inside a transaction: lock the receipt and re-check the action on its fresh state. */
  private async locked(
    tx: Prisma.TransactionClient,
    actor: WarehouseActor,
    id: string,
    action: GrAction,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "GoodsReceipt" WHERE "id" = ${id} FOR UPDATE`;
    const fresh = await tx.goodsReceipt.findUniqueOrThrow({ where: { id } });
    assertGr(actor, action, fresh);
    return fresh;
  }

  async update(ctx: AuthContext, id: string, input: UpdateReceiptInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.actionable(actor, id, 'edit');
    await this.db.$transaction(async (tx) => {
      const r = await this.locked(tx, actor, id, 'edit');
      const data: Prisma.GoodsReceiptUncheckedUpdateInput = {};
      const fields: string[] = [];
      if (input.receivedAt !== undefined) {
        data.receivedAt = this.receivedAt(input.receivedAt);
        fields.push('receivedAt');
      }
      if (input.defaultLocationId !== undefined) {
        if (input.defaultLocationId)
          await assertLocations(tx, r.branchId, [input.defaultLocationId]);
        data.defaultLocationId = input.defaultLocationId;
        fields.push('defaultLocation');
      }
      if (input.note !== undefined) {
        data.note = input.note;
        fields.push('note');
      }
      await tx.goodsReceipt.update({ where: { id }, data });
      await recordCompanyEvent(tx, meta, {
        action: 'GOODS_RECEIPT_UPDATED',
        actorId: actor.access.actor.userId,
        actorScope: 'customer',
        companyId: r.companyId,
        entityType: 'GoodsReceipt',
        entityId: id,
        details: { number: r.number, fields },
      });
    });
    return this.get(ctx, id);
  }

  async saveLine(
    ctx: AuthContext,
    id: string,
    lineId: string,
    input: LineInput,
    meta: RequestMeta,
  ) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.actionable(actor, id, 'edit');
    await this.db.$transaction(async (tx) => {
      const r = await this.locked(tx, actor, id, 'edit');
      await saveReceiptLine(tx, this.ledgerActor(actor, meta), r, lineId, input, this.today(actor));
      await tx.goodsReceipt.update({ where: { id }, data: { updatedAt: new Date() } });
    });
    return this.get(ctx, id);
  }

  /** DRAFT → POSTED (ledger.ts): stock in, receipt locked, order receive state moved on. */
  async post(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.actionable(actor, id, 'post');
    await this.db.$transaction(async (tx) => {
      await this.locked(tx, actor, id, 'post');
      await postReceipt(tx, this.ledgerActor(actor, meta), id, this.today(actor));
    });
    return this.get(ctx, id);
  }

  /** DRAFT → CANCELLED (no stock effect), or POSTED → CANCELLED with reversal movements and a reason. */
  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    const r = await this.actionable(actor, id, 'cancel');
    if (r.status === 'POSTED' && !reason) {
      throw new AppError(422, 'REASON_REQUIRED', 'Give a reason for cancelling.', {
        field: 'reason',
      });
    }
    await this.db.$transaction(async (tx) => {
      const fresh = await this.locked(tx, actor, id, 'cancel');
      if (fresh.status !== r.status) throw receiptStateChanged();
      if (fresh.status === 'POSTED') {
        await reverseReceipt(tx, this.ledgerActor(actor, meta), id, reason!);
        return;
      }
      const changed = await tx.goodsReceipt.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      if (changed.count !== 1) throw receiptStateChanged();
      await recordCompanyEvent(tx, meta, {
        action: 'GOODS_RECEIPT_CANCELLED',
        actorId: actor.access.actor.userId,
        actorScope: 'customer',
        companyId: fresh.companyId,
        entityType: 'GoodsReceipt',
        entityId: id,
        details: { number: fresh.number, from: 'DRAFT', to: 'CANCELLED', reversed: false },
      });
    });
    return this.get(ctx, id);
  }

  // ------------------------------------------------------------- inventory

  private async inventoryActor(ctx: AuthContext) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.inventory.view) throw permissionDenied('warehouse.inventory.view');
    return actor;
  }

  /** Stock on hand by (branch, location, item, lot); `lots` = lot stock by expiry. */
  async stock(ctx: AuthContext, q: StockInput) {
    const actor = await this.inventoryActor(ctx);
    const today = this.today(actor);
    const todayDate = new Date(`${today}T00:00:00Z`);
    const soon = new Date(`${addDays(today, EXPIRING_SOON_DAYS)}T00:00:00Z`);
    const expiry: Record<ExpiryState, Prisma.StockBalanceWhereInput> = {
      EXPIRED: { lot: { expiryDate: { lt: todayDate } } },
      EXPIRING_SOON: { lot: { expiryDate: { gte: todayDate, lte: soon } } },
      OK: { lot: { expiryDate: { gt: soon } } },
      NO_EXPIRY: { OR: [{ lotId: null }, { lot: { expiryDate: null } }] },
    };
    const lots = q.view === 'lots';
    const and: Prisma.StockBalanceWhereInput[] = [
      {
        companyId: actor.access.company.id,
        branchId: this.branchFilter(actor, q.branchId),
        quantityOnHand: { gt: 0 },
      },
    ];
    if (lots) and.push({ lotId: { not: null } });
    if (q.locationId) and.push({ locationId: q.locationId });
    if (q.itemId) and.push({ itemId: q.itemId });
    if (q.expiry) and.push(expiry[q.expiry]);
    if (q.q) {
      const c = { contains: q.q, mode: 'insensitive' as const };
      and.push({
        OR: [
          { item: { code: c } },
          { item: { name: c } },
          { lot: { lotNumber: c } },
          { location: { code: c } },
        ],
      });
    }
    const where: Prisma.StockBalanceWhereInput = { AND: and };
    const skip = (q.page - 1) * q.pageSize;
    const [rows, total] = await Promise.all([
      this.db.stockBalance.findMany({
        where,
        orderBy: lots
          ? [
              { lot: { expiryDate: { sort: 'asc', nulls: 'last' } } },
              { lot: { lotNumber: 'asc' } },
              { id: 'asc' },
            ]
          : [
              { item: { code: 'asc' } },
              { location: { code: 'asc' } },
              { lotKey: 'asc' },
              { id: 'asc' },
            ],
        skip,
        take: q.pageSize,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          location: loc,
          item: {
            select: {
              id: true,
              code: true,
              name: true,
              lotTracking: true,
              expiryTracking: true,
              baseUnit: { select: { code: true } },
            },
          },
          lot: true,
        },
      }),
      this.db.stockBalance.count({ where }),
    ]);
    return {
      items: rows.map((b) => {
        const exp = day(b.lot?.expiryDate ?? null);
        return StockRow.parse({
          id: b.id,
          branch: b.branch,
          location: b.location,
          item: b.item,
          unit: { code: b.item.baseUnit.code },
          lot: b.lot
            ? {
                id: b.lot.id,
                lotNumber: b.lot.lotNumber,
                expiryDate: exp,
                manufacturedDate: day(b.lot.manufacturedDate),
              }
            : null,
          quantityOnHand: b.quantityOnHand.toString(),
          expiryState: expiryStateOf(exp, today),
          daysToExpiry: exp ? daysBetween(today, exp) : null,
          firstReceivedAt: b.firstReceivedAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        });
      }),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: skip + rows.length < total,
      today,
      expiringSoonDays: EXPIRING_SOON_DAYS,
    };
  }

  /** The movement ledger, newest first. */
  async movements(ctx: AuthContext, q: MovementInput) {
    const actor = await this.inventoryActor(ctx);
    const and: Prisma.StockMovementWhereInput[] = [
      { companyId: actor.access.company.id, branchId: this.branchFilter(actor, q.branchId) },
    ];
    if (q.locationId) and.push({ locationId: q.locationId });
    if (q.itemId) and.push({ itemId: q.itemId });
    if (q.lotId) and.push({ lotId: q.lotId });
    if (q.type) and.push({ type: q.type });
    if (q.sourceType) and.push({ sourceType: q.sourceType });
    if (q.from || q.to) {
      const start = (d: string) => new Date(`${d}T00:00:00Z`);
      and.push({
        occurredAt: {
          ...(q.from ? { gte: start(q.from) } : {}),
          ...(q.to ? { lt: new Date(start(q.to).getTime() + 86_400_000) } : {}),
        },
      });
    }
    if (q.q) {
      const c = { contains: q.q, mode: 'insensitive' as const };
      and.push({
        OR: [
          { item: { code: c } },
          { item: { name: c } },
          { lot: { lotNumber: c } },
          { receipt: { number: c } },
          { receipt: { poNumber: c } },
          { transfer: { number: c } },
          { adjustment: { number: c } },
          { cycleCount: { number: c } },
        ],
      });
    }
    const where: Prisma.StockMovementWhereInput = { AND: and };
    const skip = (q.page - 1) * q.pageSize;
    const [rows, total] = await Promise.all([
      this.db.stockMovement.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: q.pageSize,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          location: loc,
          item: {
            select: { id: true, code: true, name: true, baseUnit: { select: { code: true } } },
          },
          lot: { select: { id: true, lotNumber: true, expiryDate: true } },
          receipt: { select: { id: true, number: true, poNumber: true } },
          transfer: { select: { id: true, number: true } },
          adjustment: { select: { id: true, number: true } },
          cycleCount: { select: { id: true, number: true } },
          actor: person,
        },
      }),
      this.db.stockMovement.count({ where }),
    ]);
    return {
      items: rows.map((m) =>
        MovementRow.parse({
          id: m.id,
          occurredAt: m.occurredAt.toISOString(),
          type: m.type,
          quantityDelta: m.quantityDelta.toString(),
          branch: m.branch,
          location: m.location,
          item: { id: m.item.id, code: m.item.code, name: m.item.name },
          unit: { code: m.item.baseUnit.code },
          lot: m.lot ? { ...m.lot, expiryDate: day(m.lot.expiryDate) } : null,
          source: {
            type: m.sourceType,
            receipt: m.receipt ? { id: m.receipt.id, number: m.receipt.number } : null,
            order: m.receipt ? { number: m.receipt.poNumber } : null,
            transfer: m.transfer,
            adjustment: m.adjustment,
            count: m.cycleCount,
          },
          actor: who(m.actor),
        }),
      ),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: skip + rows.length < total,
    };
  }

  /** Read-only FEFO candidates of one item (fefo.ts) — no allocation, no reservation. */
  async fefo(ctx: AuthContext, q: { itemId: string; branchId?: string; locationId?: string }) {
    const actor = await this.inventoryActor(ctx);
    // The asked branch, else the session's, else the member's only branch.
    const branchId =
      q.branchId ??
      ctx.session.branchId ??
      (actor.branches.length === 1 ? actor.branches[0]!.id : undefined);
    if (!branchId || !inBranch(actor, branchId)) {
      throw new AppError(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
    }
    const today = this.today(actor);
    const rows = await fefoCandidates(this.db, {
      companyId: actor.access.company.id,
      branchId,
      itemId: q.itemId,
      locationId: q.locationId,
      today,
    });
    return {
      itemId: q.itemId,
      branchId,
      candidates: rows.map((c, i) =>
        FefoCandidate.parse({
          rank: i + 1,
          balanceId: c.id,
          location: c.location,
          lot: c.lot
            ? { id: c.lot.id, lotNumber: c.lot.lotNumber, expiryDate: day(c.lot.expiryDate) }
            : null,
          quantityOnHand: c.quantityOnHand.toString(),
          expiryState: expiryStateOf(day(c.lot?.expiryDate ?? null), today),
          firstReceivedAt: c.firstReceivedAt.toISOString(),
        }),
      ),
    };
  }
}

/**
 * FEFO order of the stock of one item in one branch (EP31 foundation for
 * future Sales / Production allocation — nothing allocates yet):
 *
 *   1. lots with an expiry date, earliest first (expired lots excluded unless asked)
 *   2. then lots without an expiry, then stock without a lot
 *   3. ties: the lot's creation (first receipt) time, then lot number, then
 *      the balance's first receipt time, location code and id — fully deterministic.
 */
export async function fefoCandidates(
  db: Db | Prisma.TransactionClient,
  o: {
    companyId: string;
    branchId: string;
    itemId: string;
    locationId?: string;
    today: string;
    includeExpired?: boolean;
  },
) {
  const rows = await db.stockBalance.findMany({
    where: {
      companyId: o.companyId,
      branchId: o.branchId,
      itemId: o.itemId,
      quantityOnHand: { gt: ZERO },
      ...(o.locationId ? { locationId: o.locationId } : {}),
    },
    include: { lot: true, location: loc },
  });
  const key = (d: Date | null | undefined) => (d ? d.toISOString() : '');
  return rows
    .filter((b) => o.includeExpired || !b.lot?.expiryDate || day(b.lot.expiryDate)! >= o.today)
    .sort((a, b) => {
      const tier = (x: typeof a) => (x.lot?.expiryDate ? 0 : x.lot ? 1 : 2);
      return (
        tier(a) - tier(b) ||
        key(a.lot?.expiryDate).localeCompare(key(b.lot?.expiryDate)) ||
        key(a.lot?.createdAt).localeCompare(key(b.lot?.createdAt)) ||
        (a.lot?.lotNumber ?? '').localeCompare(b.lot?.lotNumber ?? '') ||
        key(a.firstReceivedAt).localeCompare(key(b.firstReceivedAt)) ||
        a.location.code.localeCompare(b.location.code) ||
        a.id.localeCompare(b.id)
      );
    });
}
