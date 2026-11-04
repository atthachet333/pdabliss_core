import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { Decimal, ZERO } from '../purchasing/money.js';

/*
 * Sales fulfilment quantities (EP35) — docs/SALES_FULFILLMENT.md §6. Read-only
 * arithmetic over the fulfilment documents; nothing here writes.
 *
 * Per sales order line, CUMULATIVE milestones (each counts everything that has
 * reached that step, including what went further; cancelled documents count
 * nothing):
 *   allocated   ACTIVE + CONSUMED reservations (reserved now, or already issued)
 *   picked      Σ picked quantity of PICKED picks
 *   packed      Σ pack lines of PACKED / DISPATCHED packs
 *   dispatched  Σ shipment lines of dispatched shipments (stock has left)
 *   delivered   Σ delivered quantity of those shipment lines
 * and two OUTSTANDING quantities (never negative):
 *   toDispatch  ordered − dispatched
 *   toDeliver   dispatched − delivered (in transit, or an exception)
 * Quantities stay per line, in the line's unit — never summed across lines.
 *
 * "Staged" stock is what picks hold that has not left yet: per pick line of a
 * non-cancelled pick, (picked, or planned while not yet picked) − dispatched.
 * It is the pick CLAIM on a reservation — not a second reservation: available
 * stock already excludes the reservation once.
 */

type Tx = Prisma.TransactionClient | Db;

export interface LineProgress {
  allocated: Decimal;
  picked: Decimal;
  packed: Decimal;
  dispatched: Decimal;
  delivered: Decimal;
}

const DISPATCHED = ['DISPATCHED', 'DELIVERED', 'DELIVERY_EXCEPTION'] as const;

const add = (m: Map<string, LineProgress>, id: string, k: keyof LineProgress, q: Decimal) => {
  const p = m.get(id) ?? {
    allocated: ZERO,
    picked: ZERO,
    packed: ZERO,
    dispatched: ZERO,
    delivered: ZERO,
  };
  p[k] = p[k].plus(q);
  m.set(id, p);
};

/** Cumulative milestones per sales order line of these orders (missing line = all zero). */
export async function lineProgress(db: Tx, orderIds: readonly string[]) {
  const out = new Map<string, LineProgress>();
  if (!orderIds.length) return out;
  const ids = [...orderIds];
  const [held, picked, packed, shipped] = await Promise.all([
    db.salesAllocation.groupBy({
      by: ['salesOrderLineId'],
      where: { salesOrderId: { in: ids }, status: { in: ['ACTIVE', 'CONSUMED'] } },
      _sum: { quantity: true },
    }),
    db.salesPickLine.groupBy({
      by: ['salesOrderLineId'],
      where: { salesOrderId: { in: ids }, pick: { status: 'PICKED' } },
      _sum: { pickedQuantity: true },
    }),
    db.salesPackLine.groupBy({
      by: ['salesOrderLineId'],
      where: { salesOrderId: { in: ids }, pack: { status: { in: ['PACKED', 'DISPATCHED'] } } },
      _sum: { quantity: true },
    }),
    db.salesShipmentLine.groupBy({
      by: ['salesOrderLineId'],
      where: { salesOrderId: { in: ids }, shipment: { status: { in: [...DISPATCHED] } } },
      _sum: { quantity: true, deliveredQuantity: true },
    }),
  ]);
  for (const r of held) add(out, r.salesOrderLineId, 'allocated', r._sum.quantity ?? ZERO);
  for (const r of picked) add(out, r.salesOrderLineId, 'picked', r._sum.pickedQuantity ?? ZERO);
  for (const r of packed) add(out, r.salesOrderLineId, 'packed', r._sum.quantity ?? ZERO);
  for (const r of shipped) {
    add(out, r.salesOrderLineId, 'dispatched', r._sum.quantity ?? ZERO);
    add(out, r.salesOrderLineId, 'delivered', r._sum.deliveredQuantity ?? ZERO);
  }
  return out;
}

export type FulfilmentState =
  | 'NOT_STARTED'
  | 'PARTIALLY_PICKED'
  | 'PICKED'
  | 'PARTIALLY_DISPATCHED'
  | 'DISPATCHED'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'EXCEPTION';

/**
 * One state for the order's physical fulfilment, from its inventory-tracked lines
 * (null: not CONFIRMED, or nothing to fulfil physically). The furthest step decides;
 * an open delivery exception wins over everything but full delivery.
 */
export function fulfilmentStateOf(
  status: string,
  lines: readonly { ordered: Decimal; p: LineProgress }[],
  exception: boolean,
): FulfilmentState | null {
  if (status !== 'CONFIRMED' || !lines.length) return null;
  const all = (k: keyof LineProgress) => lines.every((l) => l.p[k].gte(l.ordered));
  const some = (k: keyof LineProgress) => lines.some((l) => l.p[k].gt(0));
  if (all('delivered')) return 'DELIVERED';
  if (exception) return 'EXCEPTION';
  if (some('delivered')) return 'PARTIALLY_DELIVERED';
  if (all('dispatched')) return 'DISPATCHED';
  if (some('dispatched')) return 'PARTIALLY_DISPATCHED';
  if (all('picked')) return 'PICKED';
  if (some('picked')) return 'PARTIALLY_PICKED';
  return 'NOT_STARTED';
}

/** Per ACTIVE reservation: how much open picks already claim (staged, not yet dispatched). */
export async function pickClaims(db: Tx, allocationIds: readonly string[]) {
  const out = new Map<string, Decimal>();
  if (!allocationIds.length) return out;
  const rows = await db.salesPickLine.findMany({
    where: { allocationId: { in: [...allocationIds] }, pick: { status: { not: 'CANCELLED' } } },
    select: {
      allocationId: true,
      plannedQuantity: true,
      pickedQuantity: true,
      dispatchedQuantity: true,
    },
  });
  for (const r of rows) {
    const staged = (r.pickedQuantity ?? r.plannedQuantity).minus(r.dispatchedQuantity);
    out.set(r.allocationId, (out.get(r.allocationId) ?? ZERO).plus(staged));
  }
  return out;
}

/**
 * The order's fulfilment work in flight: staged stock (picked or being picked, not
 * yet dispatched) and whether anything was ever dispatched. Allocation changes and
 * cancellation consult it inside their transaction (the order row is locked).
 */
export async function fulfilmentHold(db: Tx, orderId: string) {
  const [lines, issued] = await Promise.all([
    db.salesPickLine.findMany({
      where: { salesOrderId: orderId, pick: { status: { not: 'CANCELLED' } } },
      select: { plannedQuantity: true, pickedQuantity: true, dispatchedQuantity: true },
    }),
    db.salesAllocation.count({ where: { salesOrderId: orderId, status: 'CONSUMED' } }),
  ]);
  const staged = lines.some((l) =>
    (l.pickedQuantity ?? l.plannedQuantity).minus(l.dispatchedQuantity).gt(0),
  );
  return { staged, dispatched: issued > 0 };
}

export const fulfilmentInProgress = () =>
  new AppError(
    409,
    'FULFILMENT_IN_PROGRESS',
    'Picking, packing or a shipment is in progress for this order. Cancel that work first.',
  );

export const alreadyDispatched = () =>
  new AppError(
    409,
    'SO_ALREADY_DISPATCHED',
    'Stock has already been dispatched for this order; it cannot be cancelled. Returns come later.',
  );

export { Decimal };
