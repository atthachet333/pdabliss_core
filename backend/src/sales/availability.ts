import type { Db, Prisma } from '../db/client.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import { keyOf, reservedOf } from '../warehouse/reservations.js';
import type { Availability } from './input.js';

/*
 * Sales availability (EP33, EP34) — docs/SALES_ORDER.md §6. It reads balances
 * and reservations and writes nothing; only allocation (allocation.ts) reserves.
 *
 *   onHand    = Σ balances of the item in the order's branch (every location, lot)
 *   reserved  = Σ ACTIVE reservations of those balances (any order)
 *   available = Σ (on hand − reserved) of the balances FEFO would offer: on hand > 0
 *               and the lot not expired — exactly the `quantityAvailable` of
 *               `fefoCandidates` (warehouse/service.ts; a test keeps both equal)
 *   state     = AVAILABLE (available ≥ ordered) · PARTIALLY_AVAILABLE (0 < available
 *               < ordered) · UNAVAILABLE (available = 0) · NOT_STOCK_TRACKED
 *   shortage  = max(0, ordered − available)
 */

export interface Stock {
  onHand: Decimal;
  reserved: Decimal;
  available: Decimal;
}

const key = (branchId: string, itemId: string) => `${branchId}/${itemId}`;

/** One read for many (branch, item) pairs. */
export async function stockFor(
  db: Db | Prisma.TransactionClient,
  companyId: string,
  today: string,
  pairs: readonly { branchId: string; itemId: string }[],
) {
  const out = new Map<string, Stock>();
  if (!pairs.length) return out;
  const branches = [...new Set(pairs.map((p) => p.branchId))];
  const items = [...new Set(pairs.map((p) => p.itemId))];
  const rows = await db.stockBalance.findMany({
    where: {
      companyId,
      branchId: { in: branches },
      itemId: { in: items },
      quantityOnHand: { gt: ZERO },
    },
    select: {
      branchId: true,
      locationId: true,
      itemId: true,
      lotId: true,
      quantityOnHand: true,
      lot: { select: { expiryDate: true } },
    },
  });
  const reserved = await reservedOf(db, rows);
  const todayDate = new Date(`${today}T00:00:00Z`);
  for (const r of rows) {
    const k = key(r.branchId, r.itemId);
    const s = out.get(k) ?? { onHand: ZERO, reserved: ZERO, available: ZERO };
    const held = reserved.get(keyOf(r)) ?? ZERO;
    const expired = !!r.lot?.expiryDate && r.lot.expiryDate < todayDate;
    out.set(k, {
      onHand: s.onHand.plus(r.quantityOnHand),
      reserved: s.reserved.plus(held),
      available: expired
        ? s.available
        : s.available.plus(Decimal.max(ZERO, r.quantityOnHand.minus(held))),
    });
  }
  return out;
}

export const stockOf = (m: Map<string, Stock>, branchId: string, itemId: string): Stock =>
  m.get(key(branchId, itemId)) ?? { onHand: ZERO, reserved: ZERO, available: ZERO };

/**
 * One line: what it still needs (ordered − already allocated to it) against what
 * is available to new demand. A fully allocated line is AVAILABLE whatever the
 * branch has left; `shortage` = what neither its reservations nor stock cover.
 */
export function lineAvailability(
  tracked: boolean,
  ordered: Decimal,
  s: Stock,
  allocated: Decimal = ZERO,
): {
  state: Availability;
  onHand: Decimal | null;
  reserved: Decimal | null;
  available: Decimal | null;
  shortage: Decimal | null;
} {
  if (!tracked)
    return {
      state: 'NOT_STOCK_TRACKED',
      onHand: null,
      reserved: null,
      available: null,
      shortage: null,
    };
  const needed = Decimal.max(ZERO, ordered.minus(allocated));
  const shortage = Decimal.max(ZERO, needed.minus(s.available));
  const state: Availability = shortage.isZero()
    ? 'AVAILABLE'
    : s.available.gt(0) || allocated.gt(0)
      ? 'PARTIALLY_AVAILABLE'
      : 'UNAVAILABLE';
  return { state, onHand: s.onHand, reserved: s.reserved, available: s.available, shortage };
}

/** The order's state: the worst of its stock lines; NOT_STOCK_TRACKED only when no line is tracked. */
export function orderAvailability(states: readonly Availability[]): Availability {
  const tracked = states.filter((s) => s !== 'NOT_STOCK_TRACKED');
  if (!tracked.length) return 'NOT_STOCK_TRACKED';
  if (tracked.includes('UNAVAILABLE') && tracked.every((s) => s === 'UNAVAILABLE')) {
    return 'UNAVAILABLE';
  }
  if (tracked.some((s) => s !== 'AVAILABLE')) return 'PARTIALLY_AVAILABLE';
  return 'AVAILABLE';
}
