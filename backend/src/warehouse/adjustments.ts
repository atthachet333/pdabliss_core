import type { RequestMeta } from '../auth/audit.js';
import { requireIndependentDecision, type OwnerOverride } from '../company/approval.js';
import type { AuthContext } from '../auth/sessions.js';
import type { Db, Prisma } from '../db/client.js';
import { permissionDenied } from '../permissions/guard.js';
import { ZERO } from '../purchasing/money.js';
import {
  asDay,
  assertLotIdentity,
  assertPrecision,
  branchFilter,
  dateWhere,
  day,
  fail,
  iso,
  itemRef,
  itemsOf,
  itemView,
  knownLot,
  ledgerActor,
  locationRef,
  locationsOf,
  lockRow,
  lotOf,
  lotRef,
  lotView,
  nextNumber,
  onHand,
  page,
  person,
  timeline,
  today,
  who,
  workingBranch,
} from './documents.js';
import type {
  AdjustmentLineInput,
  AdjustmentReason,
  CreateAdjustmentInput,
  DocListInput,
  UpdateAdjustmentInput,
} from './input.js';
import { applyMovement, event, lockLocations, resolveLot } from './ledger.js';
import {
  ADJUSTMENT_RULES,
  allowedDocActions,
  assertDoc,
  documentNotFound,
  inBranch,
  loadWarehouseActor,
  type WarehouseActor,
} from './policy.js';
import { AdjustmentRow, AdjustmentView } from './views.js';
import { stockReserved, usableOf } from './reservations.js';

/*
 * Stock adjustments (EP32) — docs/STOCK_ADJUSTMENT.md. A controlled
 * correction, never a free "edit the quantity": Warehouse drafts and submits
 * (warehouse.stock_adjustment.create), a manager approves — and approving POSTS
 * it in the same transaction — or rejects (warehouse.stock_adjustment.approve).
 * Each line is an explicit INCREASE or DECREASE of one stock identity
 * (location, item, lot) with a positive quantity:
 *
 *   increase  ADJUSTMENT_IN (+); into an existing lot, or a NEW lot (number +
 *             expiry by the item's rules) for FOUND / COUNT_CORRECTION /
 *             DATA_CORRECTION / OTHER only — never an expired one
 *   decrease  ADJUSTMENT_OUT (−); only what is on hand at posting time
 *
 * Reasons fix the direction: DAMAGE, LOSS, SHRINKAGE, EXPIRED only decrease,
 * FOUND only increases, the corrections and OTHER (note required) go either
 * way. A posted adjustment is reversed by cancelling it (reason required):
 * ADJUSTMENT_IN_REVERSAL (refused if that stock is no longer there) /
 * ADJUSTMENT_OUT_REVERSAL.
 */

const DECREASE_ONLY: readonly AdjustmentReason[] = ['DAMAGE', 'LOSS', 'SHRINKAGE', 'EXPIRED'];
const INCREASE_ONLY: readonly AdjustmentReason[] = ['FOUND'];
const NEW_LOT_REASONS: readonly AdjustmentReason[] = [
  'FOUND',
  'COUNT_CORRECTION',
  'DATA_CORRECTION',
  'OTHER',
];

const include = {
  branch: { select: { id: true, code: true, name: true } },
  createdBy: person,
  submittedBy: person,
  approvedBy: person,
  rejectedBy: person,
  cancelledBy: person,
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: { item: itemRef, lot: lotRef, location: locationRef },
  },
} satisfies Prisma.StockAdjustmentInclude;
type Full = Prisma.StockAdjustmentGetPayload<{ include: typeof include }>;

const TIMELINE = [
  'ADJUSTMENT_CREATED',
  'ADJUSTMENT_SUBMITTED',
  'ADJUSTMENT_APPROVED',
  'ADJUSTMENT_REJECTED',
  'ADJUSTMENT_POSTED',
  'ADJUSTMENT_CANCELLED',
];

export class AdjustmentService {
  constructor(private readonly db: Db) {}

  private async reader(ctx: AuthContext) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.inventory.view) throw permissionDenied('warehouse.inventory.view');
    return actor;
  }

  private async find(actor: WarehouseActor, id: string) {
    const d = await this.db.stockAdjustment.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
    if (!d || !inBranch(actor, d.branchId)) throw documentNotFound('ADJUSTMENT');
    return d;
  }

  private row(d: Full) {
    return {
      id: d.id,
      number: d.number,
      status: d.status,
      branch: d.branch,
      reason: d.reason,
      adjustmentDate: day(d.adjustmentDate)!,
      locations: [...new Set(d.lines.map((l) => l.location.code))],
      lineCount: d.lines.length,
      createdBy: who(d.createdBy),
      approvedBy: who(d.approvedBy),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  private async view(actor: WarehouseActor, d: Full) {
    const held = await Promise.all(
      d.lines.map((l) => onHand(this.db, l.locationId, l.itemId, l.lotId)),
    );
    return {
      adjustment: AdjustmentView.parse({
        ...this.row(d),
        note: d.note,
        createdAt: d.createdAt.toISOString(),
        submittedAt: iso(d.submittedAt),
        submittedBy: who(d.submittedBy),
        approvedAt: iso(d.approvedAt),
        rejectedAt: iso(d.rejectedAt),
        rejectedBy: who(d.rejectedBy),
        rejectionReason: d.rejectionReason,
        cancelledAt: iso(d.cancelledAt),
        cancelledBy: who(d.cancelledBy),
        cancellationReason: d.cancellationReason,
        lines: d.lines.map((l, i) => ({
          id: l.id,
          lineNo: l.lineNo,
          direction: l.direction,
          location: l.location,
          ...itemView(l.item),
          lot: lotView(l.lot),
          newLot: l.newLotNumber
            ? { lotNumber: l.newLotNumber, expiryDate: day(l.newLotExpiry) }
            : null,
          quantity: l.quantity.toString(),
          onHand: held[i]!.toString(),
          note: l.note,
        })),
        actions: allowedDocActions(actor, ADJUSTMENT_RULES, d),
      }),
      timeline: await timeline(this.db, d.companyId, 'StockAdjustment', d.id, TIMELINE),
    };
  }

  async list(ctx: AuthContext, q: DocListInput) {
    const actor = await this.reader(ctx);
    const where: Prisma.StockAdjustmentWhereInput = {
      companyId: actor.access.company.id,
      branchId: branchFilter(actor, q.branchId),
      ...(q.status ? { status: q.status as 'DRAFT' } : {}),
      ...(q.reason ? { reason: q.reason } : {}),
      ...(q.locationId ? { lines: { some: { locationId: q.locationId } } } : {}),
      ...(q.q ? { number: { contains: q.q, mode: 'insensitive' } } : {}),
      ...(dateWhere(q.from, q.to) ? { adjustmentDate: dateWhere(q.from, q.to) } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.stockAdjustment.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include,
      }),
      this.db.stockAdjustment.count({ where }),
    ]);
    return page(
      rows.map((d) => AdjustmentRow.parse(this.row(d))),
      total,
      q,
    );
  }

  async get(ctx: AuthContext, id: string) {
    const actor = await this.reader(ctx);
    return this.view(actor, await this.find(actor, id));
  }

  private assertReason(reason: AdjustmentReason, note: string | null | undefined) {
    if (reason === 'OTHER' && !note) {
      throw fail(422, 'NOTE_REQUIRED', 'Explain an adjustment with the reason Other.', {
        field: 'note',
      });
    }
  }

  /** Every line rule except the posting-time stock check (which is under lock). */
  private async checkLines(
    tx: Prisma.TransactionClient | Db,
    actor: WarehouseActor,
    branchId: string,
    reason: AdjustmentReason,
    lines: readonly AdjustmentLineInput[],
  ) {
    const companyId = actor.access.company.id;
    await locationsOf(
      tx,
      actor,
      lines.map((l) => l.locationId),
      { branchId, active: true },
    );
    const items = await itemsOf(
      tx,
      companyId,
      lines.map((l) => l.itemId),
    );
    const onDay = today(actor);
    for (const [i, l] of lines.entries()) {
      const lineNo = i + 1;
      const item = items.get(l.itemId)!;
      if (
        (l.direction === 'INCREASE' && DECREASE_ONLY.includes(reason)) ||
        (l.direction === 'DECREASE' && INCREASE_ONLY.includes(reason))
      ) {
        throw fail(422, 'REASON_DIRECTION', 'This reason does not fit that direction.', { lineNo });
      }
      assertPrecision(l.quantity, item.baseUnit.precision, lineNo);
      assertLotIdentity(item, l, {
        lineNo,
        allowNew: l.direction === 'INCREASE' && NEW_LOT_REASONS.includes(reason),
        today: onDay,
      });
      if (l.lotId) await lotOf(tx, companyId, l.itemId, l.lotId);
      if (l.newLotNumber) {
        await knownLot(tx, companyId, l.itemId, l.newLotNumber, l.newLotExpiry ?? null, lineNo);
      }
      if (l.direction === 'DECREASE') {
        // EP34: a decrease may not take reserved stock (posting checks again in the ledger).
        const u = await usableOf(tx, {
          locationId: l.locationId,
          itemId: l.itemId,
          lotId: l.lotId ?? null,
        });
        if (u.onHand.lt(l.quantity)) {
          throw fail(409, 'INSUFFICIENT_STOCK', 'There is not enough stock to take away.', {
            lineNo,
            available: u.onHand.toString(),
          });
        }
        if (u.available.lt(l.quantity)) {
          throw stockReserved({
            lineNo,
            reserved: u.reserved.toString(),
            available: u.available.toString(),
          });
        }
      }
    }
  }

  private lineRows(
    d: { id: string; companyId: string; branchId: string },
    lines: AdjustmentLineInput[],
  ) {
    return lines.map((l, i) => ({
      companyId: d.companyId,
      branchId: d.branchId,
      adjustmentId: d.id,
      lineNo: i + 1,
      direction: l.direction,
      locationId: l.locationId,
      itemId: l.itemId,
      lotId: l.lotId ?? null,
      newLotNumber: l.newLotNumber ?? null,
      newLotExpiry: l.newLotExpiry ? asDay(l.newLotExpiry) : null,
      quantity: l.quantity,
      note: l.note ?? null,
    }));
  }

  async create(ctx: AuthContext, input: CreateAdjustmentInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.adjustments.create) throw permissionDenied('warehouse.stock_adjustment.create');
    const branchId = workingBranch(actor, ctx);
    this.assertReason(input.reason, input.note);
    if (input.lines?.length)
      await this.checkLines(this.db, actor, branchId, input.reason, input.lines);
    const onDay = today(actor);
    const id = await this.db.$transaction(async (tx) => {
      const number = await nextNumber(tx, actor.access.company.id, 'ADJ', onDay);
      const d = await tx.stockAdjustment.create({
        data: {
          companyId: actor.access.company.id,
          branchId,
          number,
          reason: input.reason,
          note: input.note ?? null,
          adjustmentDate: asDay(input.adjustmentDate ?? onDay),
          lineCounter: input.lines?.length ?? 0,
          createdByMemberId: actor.memberId,
        },
      });
      if (input.lines?.length)
        await tx.stockAdjustmentLine.createMany({ data: this.lineRows(d, input.lines) });
      await event(tx, ledgerActor(actor, meta), 'ADJUSTMENT_CREATED', 'StockAdjustment', d.id, {
        number,
        reason: input.reason,
        lines: input.lines?.length ?? 0,
      });
      return d.id;
    });
    return this.get(ctx, id);
  }

  private async locked(
    tx: Prisma.TransactionClient,
    actor: WarehouseActor,
    id: string,
    action: keyof typeof ADJUSTMENT_RULES,
  ) {
    await lockRow(tx, 'StockAdjustment', id);
    const d = await tx.stockAdjustment.findFirst({
      where: { id, companyId: actor.access.company.id },
    });
    if (!d || !inBranch(actor, d.branchId)) throw documentNotFound('ADJUSTMENT');
    assertDoc(actor, action, ADJUSTMENT_RULES[action], d);
    return d;
  }

  async update(ctx: AuthContext, id: string, input: UpdateAdjustmentInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const d = await this.locked(tx, actor, id, 'edit');
      const reason = input.reason ?? d.reason;
      const note = input.note !== undefined ? input.note : d.note;
      this.assertReason(reason, note);
      if (input.reason && input.reason !== d.reason) {
        const lines = await tx.stockAdjustmentLine.findMany({
          where: { adjustmentId: id },
          orderBy: { lineNo: 'asc' },
        });
        await this.checkLines(
          tx,
          actor,
          d.branchId,
          reason,
          lines.map((l) => ({
            direction: l.direction,
            locationId: l.locationId,
            itemId: l.itemId,
            lotId: l.lotId,
            newLotNumber: l.newLotNumber,
            newLotExpiry: day(l.newLotExpiry),
            quantity: l.quantity.toString(),
            note: l.note,
          })),
        );
      }
      await tx.stockAdjustment.update({
        where: { id },
        data: {
          reason,
          note,
          ...(input.adjustmentDate ? { adjustmentDate: asDay(input.adjustmentDate) } : {}),
        },
      });
      await event(tx, ledgerActor(actor, meta), 'ADJUSTMENT_UPDATED', 'StockAdjustment', id, {
        number: d.number,
        fields: Object.keys(input).join(','),
      });
    });
    return this.get(ctx, id);
  }

  async saveLines(ctx: AuthContext, id: string, lines: AdjustmentLineInput[], meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const d = await this.locked(tx, actor, id, 'edit');
      await this.checkLines(tx, actor, d.branchId, d.reason, lines);
      await tx.stockAdjustmentLine.deleteMany({ where: { adjustmentId: id } });
      if (lines.length) await tx.stockAdjustmentLine.createMany({ data: this.lineRows(d, lines) });
      await tx.stockAdjustment.update({ where: { id }, data: { lineCounter: lines.length } });
      await event(tx, ledgerActor(actor, meta), 'ADJUSTMENT_UPDATED', 'StockAdjustment', id, {
        number: d.number,
        lines: lines.length,
      });
    });
    return this.get(ctx, id);
  }

  async submit(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const d = await this.locked(tx, actor, id, 'submit');
      const lines = await tx.stockAdjustmentLine.count({ where: { adjustmentId: id } });
      if (!lines) throw fail(422, 'DOCUMENT_EMPTY', 'Add at least one line first.');
      await tx.stockAdjustment.update({
        where: { id },
        data: { status: 'SUBMITTED', submittedAt: new Date(), submittedByMemberId: actor.memberId },
      });
      await event(tx, ledgerActor(actor, meta), 'ADJUSTMENT_SUBMITTED', 'StockAdjustment', id, {
        number: d.number,
        from: 'DRAFT',
        to: 'SUBMITTED',
      });
    });
    return this.get(ctx, id);
  }

  /**
   * SUBMITTED → POSTED in one transaction: approve, re-check every line under
   * the location locks, write the movements (a decrease only if on hand).
   */
  async approve(
    ctx: AuthContext,
    id: string,
    meta: RequestMeta,
    override: OwnerOverride | null = null,
  ) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const d = await this.locked(tx, actor, id, 'approve');
      // EP41: approving (posting) is independent of who raised and submitted it, when required.
      await requireIndependentDecision(
        tx,
        meta,
        actor.access,
        {
          decision: 'approve',
          entityType: 'StockAdjustment',
          entityId: id,
          number: d.number,
          branchId: d.branchId,
          originators: [
            { role: 'creator', memberId: d.createdByMemberId },
            { role: 'submitter', memberId: d.submittedByMemberId },
          ],
        },
        override,
      );
      const lines = await tx.stockAdjustmentLine.findMany({
        where: { adjustmentId: id },
        orderBy: { lineNo: 'asc' },
        include: { item: { select: { code: true } } },
      });
      await lockLocations(
        tx,
        lines.map((l) => l.locationId),
        'shared',
      );
      await this.checkLines(
        tx,
        actor,
        d.branchId,
        d.reason,
        lines.map((l) => ({
          direction: l.direction,
          locationId: l.locationId,
          itemId: l.itemId,
          lotId: l.lotId,
          newLotNumber: l.newLotNumber,
          newLotExpiry: day(l.newLotExpiry),
          quantity: l.quantity.toString(),
          note: l.note,
        })),
      );
      const a = ledgerActor(actor, meta);
      const now = new Date();
      for (const l of lines) {
        let lotId = l.lotId;
        if (l.newLotNumber) {
          const lot = await resolveLot(tx, a, l.itemId, l.newLotNumber, day(l.newLotExpiry), null);
          lotId = lot.id;
          if (lot.created) {
            await event(tx, a, 'INVENTORY_LOT_CREATED', 'InventoryLot', lot.id, {
              number: l.newLotNumber,
              item: l.item.code,
              adjustment: d.number,
            });
          }
          await tx.stockAdjustmentLine.update({
            where: { id: l.id },
            data: { lotId, newLotNumber: null, newLotExpiry: null },
          });
        }
        const increase = l.direction === 'INCREASE';
        await applyMovement(tx, a, {
          branchId: d.branchId,
          locationId: l.locationId,
          itemId: l.itemId,
          lotId,
          type: increase ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          delta: increase ? l.quantity : ZERO.minus(l.quantity),
          source: { sourceType: 'ADJUSTMENT', adjustmentId: d.id, adjustmentLineId: l.id },
          occurredAt: now,
          short: () =>
            fail(409, 'INSUFFICIENT_STOCK', 'There is not enough stock to take away.', {
              lineNo: l.lineNo,
              item: l.item.code,
            }),
        });
      }
      await tx.stockAdjustment.update({
        where: { id },
        data: { status: 'POSTED', approvedAt: now, approvedByMemberId: actor.memberId },
      });
      await event(tx, a, 'ADJUSTMENT_APPROVED', 'StockAdjustment', id, { number: d.number });
      await event(tx, a, 'ADJUSTMENT_POSTED', 'StockAdjustment', id, {
        number: d.number,
        from: 'SUBMITTED',
        to: 'POSTED',
        lines: lines.length,
      });
    });
    return this.get(ctx, id);
  }

  async reject(ctx: AuthContext, id: string, reason: string, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const d = await this.locked(tx, actor, id, 'reject');
      await tx.stockAdjustment.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedByMemberId: actor.memberId,
          rejectionReason: reason,
        },
      });
      await event(tx, ledgerActor(actor, meta), 'ADJUSTMENT_REJECTED', 'StockAdjustment', id, {
        number: d.number,
        from: 'SUBMITTED',
        to: 'REJECTED',
      });
    });
    return this.get(ctx, id);
  }

  /** DRAFT / SUBMITTED → CANCELLED; POSTED → CANCELLED with reversal movements (reason required). */
  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const d = await this.locked(tx, actor, id, 'cancel');
      const a = ledgerActor(actor, meta);
      const now = new Date();
      if (d.status === 'POSTED') {
        if (!reason)
          throw fail(422, 'REASON_REQUIRED', 'Give a reason for cancelling.', { field: 'reason' });
        const lines = await tx.stockAdjustmentLine.findMany({
          where: { adjustmentId: id },
          orderBy: { lineNo: 'asc' },
          include: { item: { select: { code: true } } },
        });
        await lockLocations(
          tx,
          lines.map((l) => l.locationId),
          'shared',
        );
        for (const l of lines) {
          const wasIn = l.direction === 'INCREASE';
          await applyMovement(tx, a, {
            branchId: d.branchId,
            locationId: l.locationId,
            itemId: l.itemId,
            lotId: l.lotId,
            type: wasIn ? 'ADJUSTMENT_IN_REVERSAL' : 'ADJUSTMENT_OUT_REVERSAL',
            delta: wasIn ? ZERO.minus(l.quantity) : l.quantity,
            source: { sourceType: 'ADJUSTMENT', adjustmentId: d.id, adjustmentLineId: l.id },
            occurredAt: now,
            short: () =>
              fail(
                409,
                'REVERSAL_NOT_POSSIBLE',
                'The added stock is no longer all on hand, so the adjustment cannot be reversed.',
                { lineNo: l.lineNo, item: l.item.code },
              ),
          });
        }
      }
      await tx.stockAdjustment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      await event(tx, a, 'ADJUSTMENT_CANCELLED', 'StockAdjustment', id, {
        number: d.number,
        from: d.status,
        to: 'CANCELLED',
        reversed: d.status === 'POSTED',
      });
    });
    return this.get(ctx, id);
  }
}
