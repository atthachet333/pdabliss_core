import type { Db, Prisma } from '../db/client.js';
import type { PurchaseOrderStatus } from '../generated/prisma/enums.js';
import { Decimal, ZERO } from './money.js';

/*
 * Ordered / remaining quantities of request lines (EP30) — always derived,
 * never stored on the request:
 *
 *   ordered   = Σ quantity on ISSUED, WAITING_DEPOSIT and PENDING_RECEIVE orders
 *   in draft  = Σ quantity on DRAFT orders (planned; reserves nothing)
 *   remaining = max(requested − ordered, 0)
 *
 * A cancelled order counts nowhere, so cancelling releases its quantities.
 */

export const ORDERED_STATUSES: PurchaseOrderStatus[] = [
  'ISSUED',
  'WAITING_DEPOSIT',
  'PENDING_RECEIVE',
];

/** Σ quantity per request line on orders in `statuses` (optionally not counting one order). */
export async function orderedQuantities(
  db: Db | Prisma.TransactionClient,
  requestLineIds: readonly string[],
  statuses: PurchaseOrderStatus[] = ORDERED_STATUSES,
  excludeOrderId?: string,
) {
  const sums = new Map<string, Decimal>();
  if (!requestLineIds.length) return sums;
  const rows = await db.purchaseOrderLine.groupBy({
    by: ['purchaseRequestLineId'],
    where: {
      purchaseRequestLineId: { in: [...requestLineIds] },
      order: { status: { in: statuses } },
      ...(excludeOrderId ? { purchaseOrderId: { not: excludeOrderId } } : {}),
    },
    _sum: { quantity: true },
  });
  for (const r of rows) sums.set(r.purchaseRequestLineId, r._sum.quantity ?? ZERO);
  return sums;
}

export type OrderState = 'NOT_ORDERED' | 'PARTIALLY_ORDERED' | 'FULLY_ORDERED';

export const orderState = (requested: Decimal, ordered: Decimal): OrderState =>
  ordered.lte(0) ? 'NOT_ORDERED' : ordered.gte(requested) ? 'FULLY_ORDERED' : 'PARTIALLY_ORDERED';

/**
 * The ordering picture of a request's lines, for its detail page. Order
 * numbers and statuses only for members who may read orders.
 */
export async function requestOrdering(
  db: Db,
  lines: readonly { id: string; quantity: Decimal }[],
  withOrders: boolean,
) {
  const ids = lines.map((l) => l.id);
  const [ordered, drafted, orderLines] = await Promise.all([
    orderedQuantities(db, ids),
    orderedQuantities(db, ids, ['DRAFT']),
    withOrders
      ? db.purchaseOrderLine.findMany({
          where: { purchaseRequestLineId: { in: ids } },
          orderBy: { createdAt: 'asc' },
          select: {
            purchaseRequestLineId: true,
            quantity: true,
            order: { select: { id: true, number: true, status: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const byLine = new Map(
    lines.map((l) => {
      const o = ordered.get(l.id) ?? ZERO;
      return [
        l.id,
        {
          requested: l.quantity.toString(),
          ordered: o.toString(),
          inDraft: (drafted.get(l.id) ?? ZERO).toString(),
          remaining: Decimal.max(l.quantity.minus(o), ZERO).toString(),
          state: orderState(l.quantity, o),
          orders: withOrders
            ? orderLines
                .filter((x) => x.purchaseRequestLineId === l.id)
                .map((x) => ({
                  id: x.order.id,
                  number: x.order.number,
                  status: x.order.status,
                  quantity: x.quantity.toString(),
                }))
            : null,
        },
      ];
    }),
  );
  const states = [...byLine.values()].map((v) => v.state);
  const overall: OrderState = states.every((s) => s === 'FULLY_ORDERED')
    ? 'FULLY_ORDERED'
    : states.every((s) => s === 'NOT_ORDERED')
      ? 'NOT_ORDERED'
      : 'PARTIALLY_ORDERED';
  return { byLine, overall };
}
