import type { Db, Prisma } from '../db/client.js';
import { Decimal, ZERO } from '../purchasing/money.js';

/*
 * Receive progress of purchase-order lines (EP31) — always derived from
 * POSTED goods receipts, never stored on the order:
 *
 *   accepted   = Σ acceptedQuantity          (went into stock)
 *   rejected   = Σ rejectedQuantity          (delivered, refused; never stock)
 *   closed     = Σ rejectedQuantity where replacementRequired = false
 *                (the supplier owes no replacement: that much of the line is settled)
 *   remaining  = max(ordered − accepted − closed, 0)
 *
 * A rejected quantity that needs a replacement stays to receive. A cancelled
 * receipt counts nowhere, so cancelling it restores what remains. Only lines
 * of an inventory-tracked item are receivable (a service or a non-stock item
 * is not received into stock).
 */

export interface LineProgress {
  accepted: Decimal;
  rejected: Decimal;
  closed: Decimal;
}

export type ReceiveState = 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED';

const EMPTY: LineProgress = { accepted: ZERO, rejected: ZERO, closed: ZERO };

/** Posted progress per order line (optionally not counting one receipt). */
export async function receiveProgress(
  db: Db | Prisma.TransactionClient,
  orderLineIds: readonly string[],
  excludeReceiptId?: string,
) {
  const out = new Map<string, LineProgress>();
  if (!orderLineIds.length) return out;
  const where = {
    purchaseOrderLineId: { in: [...orderLineIds] },
    receipt: { status: 'POSTED' as const },
    ...(excludeReceiptId ? { goodsReceiptId: { not: excludeReceiptId } } : {}),
  };
  const [all, closed] = await Promise.all([
    db.goodsReceiptLine.groupBy({
      by: ['purchaseOrderLineId'],
      where,
      _sum: { acceptedQuantity: true, rejectedQuantity: true },
    }),
    db.goodsReceiptLine.groupBy({
      by: ['purchaseOrderLineId'],
      where: { ...where, replacementRequired: false },
      _sum: { rejectedQuantity: true },
    }),
  ]);
  for (const r of all) {
    out.set(r.purchaseOrderLineId, {
      accepted: r._sum.acceptedQuantity ?? ZERO,
      rejected: r._sum.rejectedQuantity ?? ZERO,
      closed: ZERO,
    });
  }
  for (const r of closed) {
    const p = out.get(r.purchaseOrderLineId) ?? { ...EMPTY };
    out.set(r.purchaseOrderLineId, { ...p, closed: r._sum.rejectedQuantity ?? ZERO });
  }
  return out;
}

export const progressOf = (map: Map<string, LineProgress>, lineId: string) =>
  map.get(lineId) ?? EMPTY;

export const remainingOf = (ordered: Decimal, p: LineProgress) =>
  Decimal.max(ordered.minus(p.accepted).minus(p.closed), ZERO);

/** A line Warehouse receives into stock: an inventory-tracked item. */
export const isReceivable = (l: { type: string; item?: { inventoryTracked: boolean } | null }) =>
  l.type === 'ITEM' && !!l.item?.inventoryTracked;

export function receiveState(
  lines: readonly { ordered: Decimal; progress: LineProgress; receivable: boolean }[],
): ReceiveState {
  const r = lines.filter((l) => l.receivable);
  if (!r.length) return 'NOT_RECEIVED';
  if (r.every((l) => remainingOf(l.ordered, l.progress).isZero())) return 'FULLY_RECEIVED';
  return r.some((l) => l.progress.accepted.gt(0) || l.progress.closed.gt(0))
    ? 'PARTIALLY_RECEIVED'
    : 'NOT_RECEIVED';
}
