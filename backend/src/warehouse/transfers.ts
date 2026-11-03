import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import type { Db, Prisma } from '../db/client.js';
import { permissionDenied } from '../permissions/guard.js';
import { ZERO } from '../purchasing/money.js';
import {
  asDay,
  assertPrecision,
  branchFilter,
  dateWhere,
  day,
  fail,
  iso,
  itemRef,
  itemsOf,
  itemView,
  ledgerActor,
  locationRef,
  locationsOf,
  lockRow,
  lotOf,
  lotRef,
  lotView,
  nextNumber,
  page,
  person,
  timeline,
  today,
  who,
} from './documents.js';
import type {
  CreateTransferInput,
  DocListInput,
  TransferLineInput,
  UpdateTransferInput,
} from './input.js';
import { applyMovement, event, lockLocations } from './ledger.js';
import {
  allowedDocActions,
  assertDoc,
  documentNotFound,
  inBranch,
  loadWarehouseActor,
  TRANSFER_RULES,
  type WarehouseActor,
} from './policy.js';
import { TransferRow, TransferView } from './views.js';
import { stockReserved, usableOf } from './reservations.js';

/*
 * Inventory transfers (EP32) — docs/INVENTORY_TRANSFER.md. Moves existing
 * stock between two ACTIVE locations of ONE branch (no in-transit state, no
 * cross-branch move in EP32). A line names the exact stock identity at the
 * source (item + lot, or item without a lot); the lot travels unchanged (same
 * lot id, so the same expiry). Posting writes a TRANSFER_OUT (−) at the source
 * and a TRANSFER_IN (+) at the destination per line, the source taken only if
 * that much is on hand at posting time. Cancelling a posted transfer writes
 * TRANSFER_IN_REVERSAL (− at the destination, refused if it is no longer
 * there) and TRANSFER_OUT_REVERSAL (+ at the source).
 */

const include = {
  branch: { select: { id: true, code: true, name: true } },
  sourceLocation: locationRef,
  destinationLocation: locationRef,
  createdBy: person,
  postedBy: person,
  cancelledBy: person,
  lines: { orderBy: { lineNo: 'asc' as const }, include: { item: itemRef, lot: lotRef } },
} satisfies Prisma.InventoryTransferInclude;
type Full = Prisma.InventoryTransferGetPayload<{ include: typeof include }>;

const TIMELINE = ['TRANSFER_CREATED', 'TRANSFER_POSTED', 'TRANSFER_CANCELLED'];

export class TransferService {
  constructor(private readonly db: Db) {}

  private async reader(ctx: AuthContext) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.inventory.view) throw permissionDenied('warehouse.inventory.view');
    return actor;
  }

  private async find(actor: WarehouseActor, id: string) {
    const t = await this.db.inventoryTransfer.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
    if (!t || !inBranch(actor, t.branchId)) throw documentNotFound('TRANSFER');
    return t;
  }

  private async view(actor: WarehouseActor, t: Full) {
    // EP34: what can leave the source — on hand less what Sales has reserved there.
    const available = await Promise.all(
      t.lines.map(
        async (l) =>
          (
            await usableOf(this.db, {
              locationId: t.sourceLocationId,
              itemId: l.itemId,
              lotId: l.lotId,
            })
          ).available,
      ),
    );
    return {
      transfer: TransferView.parse({
        ...this.row(t),
        note: t.note,
        createdAt: t.createdAt.toISOString(),
        postedAt: iso(t.postedAt),
        postedBy: who(t.postedBy),
        cancelledAt: iso(t.cancelledAt),
        cancelledBy: who(t.cancelledBy),
        cancellationReason: t.cancellationReason,
        lines: t.lines.map((l, i) => ({
          id: l.id,
          lineNo: l.lineNo,
          ...itemView(l.item),
          lot: lotView(l.lot),
          quantity: l.quantity.toString(),
          available: available[i]!.toString(),
          note: l.note,
        })),
        actions: allowedDocActions(actor, TRANSFER_RULES, t),
      }),
      timeline: await timeline(this.db, t.companyId, 'InventoryTransfer', t.id, TIMELINE),
    };
  }

  private row(t: Full | (Full & { _count?: unknown })) {
    return {
      id: t.id,
      number: t.number,
      status: t.status,
      branch: t.branch,
      source: t.sourceLocation,
      destination: t.destinationLocation,
      transferDate: day(t.transferDate)!,
      lineCount: t.lines.length,
      createdBy: who(t.createdBy),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async list(ctx: AuthContext, q: DocListInput) {
    const actor = await this.reader(ctx);
    const where: Prisma.InventoryTransferWhereInput = {
      companyId: actor.access.company.id,
      branchId: branchFilter(actor, q.branchId),
      ...(q.status ? { status: q.status as 'DRAFT' } : {}),
      ...(q.locationId
        ? { OR: [{ sourceLocationId: q.locationId }, { destinationLocationId: q.locationId }] }
        : {}),
      ...(q.q ? { number: { contains: q.q, mode: 'insensitive' } } : {}),
      ...(dateWhere(q.from, q.to) ? { transferDate: dateWhere(q.from, q.to) } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.inventoryTransfer.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include,
      }),
      this.db.inventoryTransfer.count({ where }),
    ]);
    return page(
      rows.map((t) => TransferRow.parse(this.row(t))),
      total,
      q,
    );
  }

  async get(ctx: AuthContext, id: string) {
    const actor = await this.reader(ctx);
    return this.view(actor, await this.find(actor, id));
  }

  /** Source and destination: ACTIVE, same company, same branch, the member's, not the same. */
  private async endpoints(
    tx: Prisma.TransactionClient | Db,
    actor: WarehouseActor,
    sourceId: string,
    destinationId: string,
  ) {
    if (sourceId === destinationId) {
      throw fail(422, 'SAME_LOCATION', 'Source and destination must be different locations.');
    }
    const map = await locationsOf(tx, actor, [sourceId, destinationId], { active: true });
    const source = map.get(sourceId)!;
    if (map.get(destinationId)!.branchId !== source.branchId) {
      throw fail(
        422,
        'CROSS_BRANCH',
        'A transfer moves stock inside one branch (between-branch transfers come later).',
      );
    }
    return source.branchId;
  }

  /** Line rules at the source: stock item, exact lot of that item, precision, enough on hand now. */
  private async checkLines(
    tx: Prisma.TransactionClient | Db,
    actor: WarehouseActor,
    sourceId: string,
    lines: readonly TransferLineInput[],
  ) {
    const companyId = actor.access.company.id;
    const items = await itemsOf(
      tx,
      companyId,
      lines.map((l) => l.itemId),
    );
    const seen = new Set<string>();
    for (const [i, l] of lines.entries()) {
      const lineNo = i + 1;
      const item = items.get(l.itemId)!;
      assertPrecision(l.quantity, item.baseUnit.precision, lineNo);
      if (l.lotId) {
        if (item.lotTracking === 'NONE') {
          throw fail(422, 'LOT_NOT_TRACKED', 'This item is not tracked by lot.', { lineNo });
        }
        await lotOf(tx, companyId, l.itemId, l.lotId);
      } else if (item.lotTracking === 'REQUIRED') {
        throw fail(422, 'LOT_REQUIRED', 'Choose the lot to move.', { lineNo });
      }
      const key = `${l.itemId}/${l.lotId ?? ''}`;
      if (seen.has(key))
        throw fail(422, 'DUPLICATE_LINE', 'This stock is already on the transfer.', { lineNo });
      seen.add(key);
      const u = await usableOf(tx, {
        locationId: sourceId,
        itemId: l.itemId,
        lotId: l.lotId ?? null,
      });
      if (u.onHand.lt(l.quantity)) {
        throw fail(409, 'INSUFFICIENT_STOCK', 'There is not enough stock at the source.', {
          lineNo,
          available: u.available.toString(),
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

  private lineRows(
    t: { id: string; companyId: string; branchId: string },
    lines: TransferLineInput[],
  ) {
    return lines.map((l, i) => ({
      companyId: t.companyId,
      branchId: t.branchId,
      transferId: t.id,
      lineNo: i + 1,
      itemId: l.itemId,
      lotId: l.lotId ?? null,
      lotKey: l.lotId ?? '',
      quantity: l.quantity,
      note: l.note ?? null,
    }));
  }

  async create(ctx: AuthContext, input: CreateTransferInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.transfers.create) throw permissionDenied('warehouse.transfers.create');
    const branchId = await this.endpoints(
      this.db,
      actor,
      input.sourceLocationId,
      input.destinationLocationId,
    );
    if (input.lines?.length)
      await this.checkLines(this.db, actor, input.sourceLocationId, input.lines);
    const onDay = today(actor);
    const id = await this.db.$transaction(async (tx) => {
      const number = await nextNumber(tx, actor.access.company.id, 'TR', onDay);
      const t = await tx.inventoryTransfer.create({
        data: {
          companyId: actor.access.company.id,
          branchId,
          number,
          sourceLocationId: input.sourceLocationId,
          destinationLocationId: input.destinationLocationId,
          transferDate: asDay(input.transferDate ?? onDay),
          note: input.note ?? null,
          lineCounter: input.lines?.length ?? 0,
          createdByMemberId: actor.memberId,
        },
      });
      if (input.lines?.length) {
        await tx.inventoryTransferLine.createMany({ data: this.lineRows(t, input.lines) });
      }
      await event(tx, ledgerActor(actor, meta), 'TRANSFER_CREATED', 'InventoryTransfer', t.id, {
        number,
        lines: input.lines?.length ?? 0,
      });
      return t.id;
    });
    return this.get(ctx, id);
  }

  /** Inside a transaction: lock the transfer and re-check the action on its fresh state. */
  private async locked(
    tx: Prisma.TransactionClient,
    actor: WarehouseActor,
    id: string,
    action: keyof typeof TRANSFER_RULES,
  ) {
    await lockRow(tx, 'InventoryTransfer', id);
    const t = await tx.inventoryTransfer.findFirst({
      where: { id, companyId: actor.access.company.id },
    });
    if (!t || !inBranch(actor, t.branchId)) throw documentNotFound('TRANSFER');
    assertDoc(actor, action, TRANSFER_RULES[action], t);
    return t;
  }

  async update(ctx: AuthContext, id: string, input: UpdateTransferInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const t = await this.locked(tx, actor, id, 'edit');
      const source = input.sourceLocationId ?? t.sourceLocationId;
      const destination = input.destinationLocationId ?? t.destinationLocationId;
      const branchId = await this.endpoints(tx, actor, source, destination);
      if (branchId !== t.branchId) {
        throw fail(422, 'CROSS_BRANCH', 'A transfer stays in the branch it was created in.');
      }
      await tx.inventoryTransfer.update({
        where: { id },
        data: {
          sourceLocationId: source,
          destinationLocationId: destination,
          ...(input.transferDate ? { transferDate: asDay(input.transferDate) } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
        },
      });
      await event(tx, ledgerActor(actor, meta), 'TRANSFER_UPDATED', 'InventoryTransfer', id, {
        number: t.number,
        fields: Object.keys(input).join(','),
      });
    });
    return this.get(ctx, id);
  }

  /** Replaces the DRAFT's lines (each checked against the source now; posting re-checks). */
  async saveLines(ctx: AuthContext, id: string, lines: TransferLineInput[], meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const t = await this.locked(tx, actor, id, 'edit');
      await this.checkLines(tx, actor, t.sourceLocationId, lines);
      await tx.inventoryTransferLine.deleteMany({ where: { transferId: id } });
      if (lines.length)
        await tx.inventoryTransferLine.createMany({ data: this.lineRows(t, lines) });
      await tx.inventoryTransfer.update({ where: { id }, data: { lineCounter: lines.length } });
      await event(tx, ledgerActor(actor, meta), 'TRANSFER_UPDATED', 'InventoryTransfer', id, {
        number: t.number,
        lines: lines.length,
      });
    });
    return this.get(ctx, id);
  }

  /** DRAFT → POSTED: per line TRANSFER_OUT at the source (only if on hand) and TRANSFER_IN at the destination. */
  async post(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const t = await this.locked(tx, actor, id, 'post');
      await this.endpoints(tx, actor, t.sourceLocationId, t.destinationLocationId);
      const lines = await tx.inventoryTransferLine.findMany({
        where: { transferId: id },
        orderBy: { lineNo: 'asc' },
        include: { item: { select: { code: true } } },
      });
      if (!lines.length) throw fail(422, 'DOCUMENT_EMPTY', 'Add at least one line first.');
      await lockLocations(tx, [t.sourceLocationId, t.destinationLocationId], 'shared');
      const a = ledgerActor(actor, meta);
      const now = new Date();
      for (const l of lines) {
        const source = { sourceType: 'TRANSFER' as const, transferId: t.id, transferLineId: l.id };
        await applyMovement(tx, a, {
          branchId: t.branchId,
          locationId: t.sourceLocationId,
          itemId: l.itemId,
          lotId: l.lotId,
          type: 'TRANSFER_OUT',
          delta: ZERO.minus(l.quantity),
          source,
          occurredAt: now,
          short: () =>
            fail(409, 'INSUFFICIENT_STOCK', 'There is not enough stock at the source.', {
              lineNo: l.lineNo,
              item: l.item.code,
            }),
        });
        await applyMovement(tx, a, {
          branchId: t.branchId,
          locationId: t.destinationLocationId,
          itemId: l.itemId,
          lotId: l.lotId,
          type: 'TRANSFER_IN',
          delta: l.quantity,
          source,
          occurredAt: now,
        });
      }
      await tx.inventoryTransfer.update({
        where: { id },
        data: { status: 'POSTED', postedAt: now, postedByMemberId: actor.memberId },
      });
      await event(tx, a, 'TRANSFER_POSTED', 'InventoryTransfer', id, {
        number: t.number,
        from: 'DRAFT',
        to: 'POSTED',
        lines: lines.length,
      });
    });
    return this.get(ctx, id);
  }

  /** DRAFT → CANCELLED, or POSTED → CANCELLED with the reversal pair per line (reason required). */
  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const t = await this.locked(tx, actor, id, 'cancel');
      const a = ledgerActor(actor, meta);
      const now = new Date();
      if (t.status === 'POSTED') {
        if (!reason)
          throw fail(422, 'REASON_REQUIRED', 'Give a reason for cancelling.', { field: 'reason' });
        const lines = await tx.inventoryTransferLine.findMany({
          where: { transferId: id },
          orderBy: { lineNo: 'asc' },
          include: { item: { select: { code: true } } },
        });
        await lockLocations(tx, [t.sourceLocationId, t.destinationLocationId], 'shared');
        for (const l of lines) {
          const source = {
            sourceType: 'TRANSFER' as const,
            transferId: t.id,
            transferLineId: l.id,
          };
          await applyMovement(tx, a, {
            branchId: t.branchId,
            locationId: t.destinationLocationId,
            itemId: l.itemId,
            lotId: l.lotId,
            type: 'TRANSFER_IN_REVERSAL',
            delta: ZERO.minus(l.quantity),
            source,
            occurredAt: now,
            short: () =>
              fail(
                409,
                'REVERSAL_NOT_POSSIBLE',
                'The moved stock is no longer all at the destination, so the transfer cannot be reversed.',
                { lineNo: l.lineNo, item: l.item.code },
              ),
          });
          await applyMovement(tx, a, {
            branchId: t.branchId,
            locationId: t.sourceLocationId,
            itemId: l.itemId,
            lotId: l.lotId,
            type: 'TRANSFER_OUT_REVERSAL',
            delta: l.quantity,
            source,
            occurredAt: now,
          });
        }
      }
      await tx.inventoryTransfer.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      await event(tx, a, 'TRANSFER_CANCELLED', 'InventoryTransfer', id, {
        number: t.number,
        from: t.status,
        to: 'CANCELLED',
        reversed: t.status === 'POSTED',
      });
    });
    return this.get(ctx, id);
  }
}
