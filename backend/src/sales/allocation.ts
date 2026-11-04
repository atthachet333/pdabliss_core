import type { Prisma } from '../db/client.js';
import type { SalesAllocationRelease } from '../generated/prisma/enums.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import { keyOf, lockBalances, reservedOf } from '../warehouse/reservations.js';
import { byFefo } from '../warehouse/service.js';

/*
 * Sales allocation (EP34) — docs/SALES_ALLOCATION.md. Reserves stock for the
 * inventory-tracked lines of a CONFIRMED sales order, in FEFO order, inside
 * the caller's transaction (the caller has locked the order row and checked
 * its status and the actor's authority). A reservation is NOT a movement:
 * StockMovement and StockBalance are never written here.
 *
 *   1. what each tracked line still needs = ordered − its ACTIVE and CONSUMED
 *      (EP35: dispatched) reservations (nothing → nothing to do: repeating an
 *      allocation never double-reserves);
 *   2. lock the order branch's positive balances of those items (id order), THEN
 *      read them, their lots / locations and what is reserved — never trust
 *      availability read before the lock;
 *   3. candidates: ACTIVE location, lot not expired (today, company calendar),
 *      on hand − reserved > 0; FEFO order (warehouse/service.ts `byFefo`);
 *   4. take min(free, needed) candidate by candidate, line by line (lineNo);
 *      an existing ACTIVE row for the same (line, location, lot) grows, else a
 *      row is created (one ACTIVE row per identity — the activeSlot unique key).
 * What cannot be covered stays a shortage; nothing is borrowed from another branch.
 */

export interface AllocationActor {
  companyId: string;
  memberId: string;
}

export interface LineResult {
  lineId: string;
  lineNo: number;
  ordered: Decimal;
  allocatedNow: Decimal;
  totalAllocated: Decimal;
  shortage: Decimal;
}

type OrderRef = { id: string; companyId: string; branchId: string };

/** ACTIVE + CONSUMED (EP35: dispatched stock no longer needs reserving) per line. */
async function activeByLine(tx: Prisma.TransactionClient, orderId: string) {
  const rows = await tx.salesAllocation.groupBy({
    by: ['salesOrderLineId'],
    where: { salesOrderId: orderId, status: { in: ['ACTIVE', 'CONSUMED'] } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.salesOrderLineId, r._sum.quantity ?? ZERO]));
}

export async function allocateOrder(
  tx: Prisma.TransactionClient,
  a: AllocationActor,
  o: OrderRef,
  today: string,
): Promise<LineResult[]> {
  const lines = await tx.salesOrderLine.findMany({
    where: { salesOrderId: o.id, inventoryTracked: true },
    orderBy: { lineNo: 'asc' },
    select: { id: true, lineNo: true, itemId: true, quantity: true },
  });
  const held = await activeByLine(tx, o.id);
  const need = new Map(
    lines.map((l) => [l.id, Decimal.max(ZERO, l.quantity.minus(held.get(l.id) ?? ZERO))]),
  );
  const now = new Map<string, Decimal>();
  const wanted = lines.filter((l) => need.get(l.id)!.gt(0));
  if (wanted.length) {
    const itemIds = [...new Set(wanted.map((l) => l.itemId))];
    await lockBalances(tx, { companyId: o.companyId, branchId: o.branchId, itemIds });
    const todayDate = new Date(`${today}T00:00:00Z`);
    const balances = await tx.stockBalance.findMany({
      where: {
        companyId: o.companyId,
        branchId: o.branchId,
        itemId: { in: itemIds },
        quantityOnHand: { gt: 0 },
        location: { status: 'ACTIVE' },
        OR: [
          { lotId: null },
          { lot: { expiryDate: null } },
          { lot: { expiryDate: { gte: todayDate } } },
        ],
      },
      include: {
        location: { select: { code: true } },
        lot: { select: { expiryDate: true, createdAt: true, lotNumber: true } },
      },
    });
    const reserved = await reservedOf(tx, balances);
    const free = new Map(
      balances.map((b) => [b.id, b.quantityOnHand.minus(reserved.get(keyOf(b)) ?? ZERO)]),
    );
    const candidates = balances.filter((b) => free.get(b.id)!.gt(0)).sort(byFefo);
    for (const l of wanted) {
      let left = need.get(l.id)!;
      for (const b of candidates) {
        if (left.isZero()) break;
        if (b.itemId !== l.itemId) continue;
        const take = Decimal.min(left, free.get(b.id)!);
        if (!take.gt(0)) continue;
        free.set(b.id, free.get(b.id)!.minus(take));
        left = left.minus(take);
        now.set(l.id, (now.get(l.id) ?? ZERO).plus(take));
        const grown = await tx.salesAllocation.updateMany({
          where: {
            salesOrderLineId: l.id,
            locationId: b.locationId,
            lotKey: b.lotKey,
            status: 'ACTIVE',
          },
          data: { quantity: { increment: take } },
        });
        if (!grown.count) {
          await tx.salesAllocation.create({
            data: {
              companyId: o.companyId,
              branchId: o.branchId,
              salesOrderId: o.id,
              salesOrderLineId: l.id,
              itemId: l.itemId,
              locationId: b.locationId,
              lotId: b.lotId,
              lotKey: b.lotKey,
              quantity: take,
              createdByMemberId: a.memberId,
            },
          });
        }
      }
    }
  }
  return lines.map((l) => {
    const allocatedNow = now.get(l.id) ?? ZERO;
    const total = (held.get(l.id) ?? ZERO).plus(allocatedNow);
    return {
      lineId: l.id,
      lineNo: l.lineNo,
      ordered: l.quantity,
      allocatedNow,
      totalAllocated: total,
      shortage: Decimal.max(ZERO, l.quantity.minus(total)),
    };
  });
}

/** Every ACTIVE reservation of the order → RELEASED (history kept). Returns how many. */
export async function releaseOrder(
  tx: Prisma.TransactionClient,
  a: AllocationActor,
  orderId: string,
  reason: SalesAllocationRelease,
) {
  const r = await tx.salesAllocation.updateMany({
    where: { salesOrderId: orderId, status: 'ACTIVE' },
    data: {
      status: 'RELEASED',
      activeSlot: null,
      releasedAt: new Date(),
      releasedByMemberId: a.memberId,
      releaseReason: reason,
    },
  });
  return r.count;
}

export type AllocationState = 'NOT_ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'FULLY_ALLOCATED';
export type PickReadiness = 'NOT_READY' | 'PARTIALLY_READY' | 'READY';

/**
 * The order's allocation state from its tracked lines (null: nothing to
 * allocate — not CONFIRMED, or no inventory-tracked line). READY = every
 * tracked line fully reserved; service lines never block it.
 */
export function allocationStateOf(
  status: string,
  lines: readonly { ordered: Decimal; allocated: Decimal }[],
): { state: AllocationState; readiness: PickReadiness } | null {
  if (status !== 'CONFIRMED' || !lines.length) return null;
  if (lines.every((l) => l.allocated.gte(l.ordered)))
    return { state: 'FULLY_ALLOCATED', readiness: 'READY' };
  if (lines.some((l) => l.allocated.gt(0)))
    return { state: 'PARTIALLY_ALLOCATED', readiness: 'PARTIALLY_READY' };
  return { state: 'NOT_ALLOCATED', readiness: 'NOT_READY' };
}
