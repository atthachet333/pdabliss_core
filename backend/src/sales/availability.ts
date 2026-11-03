import type { Db, Prisma } from '../db/client.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import type { Availability } from './input.js';

/*
 * Sales availability (EP33) — INFORMATIONAL ONLY, docs/SALES_ORDER.md §6.
 * It reads the ledger's balances and never writes anything: no reservation, no
 * allocation, no lot is marked. Two orders may both "see" the same stock;
 * EP34 allocation resolves who gets it.
 *
 *   onHand    = Σ balances of the item in the order's branch (every location, lot)
 *   available = Σ of those balances FEFO would offer: on hand > 0 and the lot not
 *               expired — exactly the set `fefoCandidates` (warehouse/service.ts)
 *               lists (a test keeps both equal)
 *   state     = AVAILABLE (available ≥ ordered) · PARTIALLY_AVAILABLE (0 < available
 *               < ordered) · UNAVAILABLE (available = 0) · NOT_STOCK_TRACKED
 *   shortage  = max(0, ordered − available)
 */

export interface Stock {
  onHand: Decimal;
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
      itemId: true,
      quantityOnHand: true,
      lot: { select: { expiryDate: true } },
    },
  });
  const todayDate = new Date(`${today}T00:00:00Z`);
  for (const r of rows) {
    const k = key(r.branchId, r.itemId);
    const s = out.get(k) ?? { onHand: ZERO, available: ZERO };
    const expired = !!r.lot?.expiryDate && r.lot.expiryDate < todayDate;
    out.set(k, {
      onHand: s.onHand.plus(r.quantityOnHand),
      available: expired ? s.available : s.available.plus(r.quantityOnHand),
    });
  }
  return out;
}

export const stockOf = (m: Map<string, Stock>, branchId: string, itemId: string): Stock =>
  m.get(key(branchId, itemId)) ?? { onHand: ZERO, available: ZERO };

export function lineAvailability(
  tracked: boolean,
  ordered: Decimal,
  s: Stock,
): {
  state: Availability;
  onHand: Decimal | null;
  available: Decimal | null;
  shortage: Decimal | null;
} {
  if (!tracked)
    return { state: 'NOT_STOCK_TRACKED', onHand: null, available: null, shortage: null };
  const shortage = Decimal.max(ZERO, ordered.minus(s.available));
  const state: Availability = shortage.isZero()
    ? 'AVAILABLE'
    : s.available.gt(0)
      ? 'PARTIALLY_AVAILABLE'
      : 'UNAVAILABLE';
  return { state, onHand: s.onHand, available: s.available, shortage };
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
