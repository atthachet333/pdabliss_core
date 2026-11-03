import { randomUUID } from 'node:crypto';
import type { RequestMeta } from '../auth/audit.js';
import {
  recordCompanyEvent,
  type ActorScope,
  type GoodsReceiptAuditAction,
  type PurchaseOrderAuditAction,
} from '../company/audit.js';
import type { Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { ZERO, type Decimal } from '../purchasing/money.js';
import { isReceivable, progressOf, receiveProgress, remainingOf } from './progress.js';
import { assertKnownLots, assertLocations, normalizeLine } from './rules.js';

/*
 * The inventory ledger (EP31) — docs/INVENTORY_LEDGER.md. The only code that
 * writes StockMovement and StockBalance. Every stock change is ONE
 * transaction that:
 *
 *   1. locks the receipt row, then the order row (always in this order — two
 *      receipts of one order are serialized on the order row, so what remains
 *      to receive is read after every earlier post has committed);
 *   2. checks the state it decides from (a second post or cancel of the same
 *      receipt finds it no longer DRAFT / POSTED and fails — no duplicate
 *      movement; a unique (allocation, type) index guards it again);
 *   3. writes one movement per allocation and adds its delta to the matching
 *      balance with a single atomic statement (no read-modify-write);
 *   4. moves the receipt (and the order's receive state) on and audits.
 *
 * Movements are never updated or deleted (a database trigger refuses it); a
 * reversal subtracts with a conditional update that refuses to go below zero.
 * Balance = Σ movements per (location, item, lot) — tested.
 */

export interface LedgerActor {
  companyId: string;
  memberId: string;
  userId: string;
  scope: ActorScope;
  meta: RequestMeta;
}

const event = (
  tx: Prisma.TransactionClient,
  a: LedgerActor,
  action: GoodsReceiptAuditAction | PurchaseOrderAuditAction,
  entityType: 'GoodsReceipt' | 'PurchaseOrder' | 'InventoryLot',
  entityId: string,
  details: Record<string, string | number | boolean | null>,
) =>
  recordCompanyEvent(tx, a.meta, {
    action,
    actorId: a.userId,
    actorScope: a.scope,
    companyId: a.companyId,
    entityType,
    entityId,
    details,
  });

const lockReceipt = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT "id" FROM "GoodsReceipt" WHERE "id" = ${id} FOR UPDATE`;
const lockOrder = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${id} FOR UPDATE`;

export const invalidReceiptTransition = (status: string) =>
  new AppError(
    409,
    'GR_INVALID_TRANSITION',
    'This action is not possible in the receipt’s current status.',
    {
      status,
    },
  );

export const overReceived = (remaining: Decimal, lineNo: number) =>
  new AppError(
    409,
    'PO_LINE_OVER_RECEIVED',
    'This is more than the order line still has to receive.',
    { lineNo, remaining: remaining.toString() },
  );

/** The lot for (company, item, number): created once even when two receipts race (unique key). */
async function resolveLot(
  tx: Prisma.TransactionClient,
  a: LedgerActor,
  itemId: string,
  lotNumber: string,
  expiryDate: string | null,
  manufacturedDate: string | null,
) {
  const created = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "InventoryLot" ("id", "companyId", "itemId", "lotNumber", "expiryDate", "manufacturedDate", "createdAt")
    VALUES (${randomUUID()}, ${a.companyId}, ${itemId}, ${lotNumber},
            ${expiryDate}::date, ${manufacturedDate}::date, (NOW() AT TIME ZONE 'UTC'))
    ON CONFLICT ("companyId", "itemId", "lotNumber") DO NOTHING
    RETURNING "id"`;
  if (created[0]) return { id: created[0].id, created: true };
  const lot = await tx.inventoryLot.findUniqueOrThrow({
    where: { companyId_itemId_lotNumber: { companyId: a.companyId, itemId, lotNumber } },
  });
  const known = lot.expiryDate ? lot.expiryDate.toISOString().slice(0, 10) : null;
  if (expiryDate !== null && known !== expiryDate) {
    throw new AppError(
      409,
      'LOT_EXPIRY_MISMATCH',
      'This lot is already known with another expiry date.',
      {
        lotNumber,
        expiryDate: known,
      },
    );
  }
  return { id: lot.id, created: false };
}

/** Adds `delta` (> 0) to one balance in a single statement — concurrent receipts never lose an update. */
const addToBalance = (
  tx: Prisma.TransactionClient,
  k: {
    companyId: string;
    branchId: string;
    locationId: string;
    itemId: string;
    lotId: string | null;
  },
  delta: Decimal,
) => tx.$executeRaw`
  INSERT INTO "StockBalance" ("id", "companyId", "branchId", "locationId", "itemId", "lotId", "lotKey",
                              "quantityOnHand", "firstReceivedAt", "createdAt", "updatedAt")
  VALUES (${randomUUID()}, ${k.companyId}, ${k.branchId}, ${k.locationId}, ${k.itemId}, ${k.lotId},
          ${k.lotId ?? ''}, ${delta.toString()}::numeric,
          (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC'))
  ON CONFLICT ("locationId", "itemId", "lotKey")
  DO UPDATE SET "quantityOnHand" = "StockBalance"."quantityOnHand" + EXCLUDED."quantityOnHand",
                "updatedAt" = (NOW() AT TIME ZONE 'UTC')`;

/** Subtracts `qty` (> 0) only if that much is on hand; false when it would go negative. */
const takeFromBalance = async (
  tx: Prisma.TransactionClient,
  k: { locationId: string; itemId: string; lotId: string | null },
  qty: Decimal,
) =>
  (await tx.$executeRaw`
    UPDATE "StockBalance"
    SET "quantityOnHand" = "quantityOnHand" - ${qty.toString()}::numeric,
        "updatedAt" = (NOW() AT TIME ZONE 'UTC')
    WHERE "locationId" = ${k.locationId} AND "itemId" = ${k.itemId} AND "lotKey" = ${k.lotId ?? ''}
      AND "quantityOnHand" >= ${qty.toString()}::numeric`) === 1;

const lineInclude = {
  allocations: { orderBy: { createdAt: 'asc' as const } },
  unit: { select: { precision: true } },
  item: {
    select: {
      id: true,
      code: true,
      status: true,
      inventoryTracked: true,
      lotTracking: true,
      expiryTracking: true,
    },
  },
} as const;

/**
 * Re-derives the order's receive state after a post or a reversal: RECEIVED
 * when every receivable line has nothing left, otherwise PENDING_RECEIVE.
 */
async function settleOrder(
  tx: Prisma.TransactionClient,
  a: LedgerActor,
  orderId: string,
  after: 'post' | 'reverse',
) {
  const o = await tx.purchaseOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { lines: { include: { item: { select: { inventoryTracked: true } } } } },
  });
  const lines = o.lines.filter(isReceivable);
  const progress = await receiveProgress(
    tx,
    lines.map((l) => l.id),
  );
  const done = lines.every((l) => remainingOf(l.quantity, progressOf(progress, l.id)).isZero());
  if (after === 'post') {
    if (done && o.status === 'PENDING_RECEIVE') {
      await tx.purchaseOrder.update({
        where: { id: o.id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
      await event(tx, a, 'PURCHASE_ORDER_RECEIVED', 'PurchaseOrder', o.id, {
        number: o.number,
        from: 'PENDING_RECEIVE',
        to: 'RECEIVED',
      });
    } else {
      await event(tx, a, 'PURCHASE_ORDER_PARTIALLY_RECEIVED', 'PurchaseOrder', o.id, {
        number: o.number,
      });
    }
  } else if (!done && o.status === 'RECEIVED') {
    await tx.purchaseOrder.update({
      where: { id: o.id },
      data: { status: 'PENDING_RECEIVE', receivedAt: null },
    });
    await event(tx, a, 'PURCHASE_ORDER_RECEIVE_REOPENED', 'PurchaseOrder', o.id, {
      number: o.number,
      from: 'RECEIVED',
      to: 'PENDING_RECEIVE',
    });
  }
  return done;
}

/**
 * DRAFT → POSTED: stock goes in. Inside the caller's transaction. `today` is
 * the company's calendar day (expiry rules).
 */
export async function postReceipt(
  tx: Prisma.TransactionClient,
  a: LedgerActor,
  receiptId: string,
  today: string,
) {
  await lockReceipt(tx, receiptId);
  const r = await tx.goodsReceipt.findUniqueOrThrow({ where: { id: receiptId } });
  if (r.status !== 'DRAFT') throw invalidReceiptTransition(r.status);
  await lockOrder(tx, r.purchaseOrderId);
  const order = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: r.purchaseOrderId } });
  if (order.status !== 'PENDING_RECEIVE') {
    throw new AppError(409, 'PO_NOT_RECEIVABLE', 'This order is not waiting to be received.', {
      status: order.status,
    });
  }
  // Lines with nothing on them are dropped: a posted receipt shows what arrived.
  await tx.goodsReceiptLine.deleteMany({
    where: { goodsReceiptId: r.id, acceptedQuantity: 0, rejectedQuantity: 0 },
  });
  const lines = await tx.goodsReceiptLine.findMany({
    where: { goodsReceiptId: r.id },
    orderBy: { lineNo: 'asc' },
    include: { ...lineInclude, orderLine: { select: { quantity: true } } },
  });
  if (!lines.length) {
    throw new AppError(422, 'GR_EMPTY', 'Nothing was received or rejected on this receipt.');
  }
  // Read AFTER the order lock: every receipt posted before us is counted.
  const progress = await receiveProgress(
    tx,
    lines.map((l) => l.purchaseOrderLineId),
    r.id,
  );
  let movements = 0;
  for (const l of lines) {
    const n = normalizeLine(
      { lineNo: l.lineNo, precision: l.unit.precision, item: l.item },
      {
        acceptedQuantity: l.acceptedQuantity.toString(),
        rejectedQuantity: l.rejectedQuantity.toString(),
        rejectReason: l.rejectReason,
        rejectNote: l.rejectNote,
        allocations: l.allocations.map((x) => ({
          locationId: x.locationId,
          lotNumber: x.lotNumber,
          expiryDate: x.expiryDate?.toISOString().slice(0, 10) ?? null,
          manufacturedDate: x.manufacturedDate?.toISOString().slice(0, 10) ?? null,
          quantity: x.quantity.toString(),
        })),
      },
      today,
    );
    if (l.item.status !== 'ACTIVE' && n.accepted.gt(0)) {
      throw new AppError(409, 'REFERENCE_INACTIVE', 'The selected record is inactive.', {
        field: 'itemId',
        lineNo: l.lineNo,
      });
    }
    const remaining = remainingOf(
      l.orderLine.quantity,
      progressOf(progress, l.purchaseOrderLineId),
    );
    if (n.accepted.plus(n.rejected).gt(remaining)) throw overReceived(remaining, l.lineNo);
    await assertLocations(
      tx,
      r.branchId,
      l.allocations.map((x) => x.locationId),
      l.lineNo,
    );
    for (const x of l.allocations) {
      let lotId: string | null = null;
      if (x.lotNumber) {
        const lot = await resolveLot(
          tx,
          a,
          l.itemId,
          x.lotNumber,
          x.expiryDate?.toISOString().slice(0, 10) ?? null,
          x.manufacturedDate?.toISOString().slice(0, 10) ?? null,
        );
        lotId = lot.id;
        if (lot.created) {
          await event(tx, a, 'INVENTORY_LOT_CREATED', 'InventoryLot', lot.id, {
            number: x.lotNumber,
            item: l.itemCode,
            receipt: r.number,
          });
        }
        await tx.goodsReceiptAllocation.update({ where: { id: x.id }, data: { lotId } });
      }
      await tx.stockMovement.create({
        data: {
          companyId: r.companyId,
          branchId: r.branchId,
          locationId: x.locationId,
          itemId: l.itemId,
          lotId,
          type: 'PURCHASE_RECEIPT',
          quantityDelta: x.quantity,
          sourceType: 'GOODS_RECEIPT',
          goodsReceiptId: r.id,
          goodsReceiptLineId: l.id,
          goodsReceiptAllocationId: x.id,
          occurredAt: r.receivedAt,
          actorMemberId: a.memberId,
        },
      });
      await addToBalance(
        tx,
        {
          companyId: r.companyId,
          branchId: r.branchId,
          locationId: x.locationId,
          itemId: l.itemId,
          lotId,
        },
        x.quantity,
      );
      movements++;
    }
  }
  const changed = await tx.goodsReceipt.updateMany({
    where: { id: r.id, status: 'DRAFT' },
    data: { status: 'POSTED', postedAt: new Date(), postedByMemberId: a.memberId },
  });
  if (changed.count !== 1) throw invalidReceiptTransition('POSTED');
  await event(tx, a, 'GOODS_RECEIPT_POSTED', 'GoodsReceipt', r.id, {
    number: r.number,
    order: r.poNumber,
    from: 'DRAFT',
    to: 'POSTED',
    lines: lines.length,
    movements,
  });
  const fully = await settleOrder(tx, a, r.purchaseOrderId, 'post');
  return { movements, fully };
}

/**
 * POSTED → CANCELLED: one reversal movement per allocation, balances reduced
 * (never below zero), the order reopened if it was RECEIVED. Nothing is deleted.
 */
export async function reverseReceipt(
  tx: Prisma.TransactionClient,
  a: LedgerActor,
  receiptId: string,
  reason: string,
) {
  await lockReceipt(tx, receiptId);
  const r = await tx.goodsReceipt.findUniqueOrThrow({ where: { id: receiptId } });
  if (r.status !== 'POSTED') throw invalidReceiptTransition(r.status);
  await lockOrder(tx, r.purchaseOrderId);
  const allocations = await tx.goodsReceiptAllocation.findMany({
    where: { line: { goodsReceiptId: r.id } },
    include: { line: { select: { lineNo: true, itemCode: true } } },
    orderBy: { id: 'asc' },
  });
  const now = new Date();
  for (const x of allocations) {
    const ok = await takeFromBalance(
      tx,
      { locationId: x.locationId, itemId: x.itemId, lotId: x.lotId },
      x.quantity,
    );
    if (!ok) {
      throw new AppError(
        409,
        'STOCK_INSUFFICIENT',
        'This receipt’s stock is no longer all on hand, so it cannot be reversed.',
        { lineNo: x.line.lineNo, item: x.line.itemCode },
      );
    }
    await tx.stockMovement.create({
      data: {
        companyId: r.companyId,
        branchId: r.branchId,
        locationId: x.locationId,
        itemId: x.itemId,
        lotId: x.lotId,
        type: 'PURCHASE_RECEIPT_REVERSAL',
        quantityDelta: ZERO.minus(x.quantity),
        sourceType: 'GOODS_RECEIPT',
        goodsReceiptId: r.id,
        goodsReceiptLineId: x.goodsReceiptLineId,
        goodsReceiptAllocationId: x.id,
        occurredAt: now,
        actorMemberId: a.memberId,
      },
    });
  }
  const changed = await tx.goodsReceipt.updateMany({
    where: { id: r.id, status: 'POSTED' },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledByMemberId: a.memberId,
      cancellationReason: reason,
    },
  });
  if (changed.count !== 1) throw invalidReceiptTransition('CANCELLED');
  await event(tx, a, 'GOODS_RECEIPT_CANCELLED', 'GoodsReceipt', r.id, {
    number: r.number,
    order: r.poNumber,
    from: 'POSTED',
    to: 'CANCELLED',
    reversed: true,
    movements: allocations.length,
  });
  await settleOrder(tx, a, r.purchaseOrderId, 'reverse');
  return { movements: allocations.length };
}

/** Saves one DRAFT line (all rules but the order's remaining quantity, which posting re-checks). */
export async function saveReceiptLine(
  tx: Prisma.TransactionClient,
  a: LedgerActor,
  r: { id: string; number: string; branchId: string },
  lineId: string,
  input: Parameters<typeof normalizeLine>[1] & {
    replacementRequired?: boolean;
    note?: string | null;
  },
  today: string,
) {
  const line = await tx.goodsReceiptLine.findFirst({
    where: { id: lineId, goodsReceiptId: r.id },
    include: { ...lineInclude, orderLine: { select: { quantity: true } } },
  });
  if (!line) throw new AppError(404, 'GR_LINE_NOT_FOUND', 'This receipt line was not found.');
  const n = normalizeLine(
    { lineNo: line.lineNo, precision: line.unit.precision, item: line.item },
    input,
    today,
  );
  await assertLocations(
    tx,
    r.branchId,
    n.allocations.map((x) => x.locationId),
    line.lineNo,
  );
  await assertKnownLots(tx, a.companyId, line.itemId, n.allocations, line.lineNo);
  const progress = await receiveProgress(tx, [line.purchaseOrderLineId], r.id);
  const remaining = remainingOf(
    line.orderLine.quantity,
    progressOf(progress, line.purchaseOrderLineId),
  );
  if (n.accepted.plus(n.rejected).gt(remaining)) throw overReceived(remaining, line.lineNo);
  await tx.goodsReceiptAllocation.deleteMany({ where: { goodsReceiptLineId: line.id } });
  if (n.allocations.length) {
    await tx.goodsReceiptAllocation.createMany({
      data: n.allocations.map((x) => ({
        companyId: a.companyId,
        branchId: r.branchId,
        goodsReceiptLineId: line.id,
        itemId: line.itemId,
        locationId: x.locationId,
        lotNumber: x.lotNumber,
        expiryDate: x.expiryDate ? new Date(`${x.expiryDate}T00:00:00Z`) : null,
        manufacturedDate: x.manufacturedDate ? new Date(`${x.manufacturedDate}T00:00:00Z`) : null,
        quantity: x.quantity,
      })),
    });
  }
  await tx.goodsReceiptLine.update({
    where: { id: line.id },
    data: {
      acceptedQuantity: n.accepted,
      rejectedQuantity: n.rejected,
      rejectReason: n.rejectReason,
      rejectNote: n.rejectNote,
      ...(input.replacementRequired !== undefined
        ? { replacementRequired: input.replacementRequired }
        : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });
  await event(tx, a, 'GOODS_RECEIPT_LINE_UPDATED', 'GoodsReceipt', r.id, {
    number: r.number,
    lineNo: line.lineNo,
    item: line.itemCode,
    allocations: n.allocations.length,
  });
}
