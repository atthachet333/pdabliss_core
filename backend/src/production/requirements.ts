import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import { stockFor, stockOf } from '../sales/availability.js';

/*
 * Material requirements (EP36) — docs/PRODUCTION_ORDER.md §6. Pure arithmetic
 * plus one READ of the ledger. Nothing here writes or reserves stock.
 *
 *   required = target × bomLineQuantity ÷ bomOutputQuantity
 *
 * computed EXACTLY in integers (every quantity has at most 6 decimal places, so
 * each is an integer number of millionths) and rounded UP to the material
 * unit's decimal places — never truncated, never under-planned. `exact` says
 * whether rounding was needed (2 ÷ 3 PCS → 1 PCS, exact = false).
 *
 * Availability is the EP34 reservation-aware figure, the very one Sales uses
 * (sales/availability.ts → stockFor): Σ (on hand − ACTIVE sales reservations)
 * over the branch's balances FEFO would offer (on hand > 0, lot not expired).
 * It is a SNAPSHOT, not a claim: two orders may both see the same stock.
 * Material allocation / issue for production arrives in EP37.
 */

const SCALE = 1_000_000n;
const MAX = 10n ** 18n; // Decimal(18, 6): at most 12 integer digits → < 10^18 millionths

const toMicro = (v: Decimal | string) => {
  const d = new Decimal(v);
  if (d.decimalPlaces() > 6) throw new Error('more than 6 decimal places');
  return BigInt(d.times(1_000_000).toFixed(0));
};

export function requiredQuantity(
  target: Decimal | string,
  bomQuantity: Decimal | string,
  bomOutput: Decimal | string,
  precision: number,
): { quantity: Decimal; exact: boolean } {
  const t = toMicro(target);
  const q = toMicro(bomQuantity);
  const o = toMicro(bomOutput);
  if (o <= 0n) throw new Error('BOM output must be positive');
  const p = 10n ** BigInt(precision);
  // required × 10^p = t·q·10^p ÷ (o·10^6), rounded up
  const num = t * q * p;
  const den = o * SCALE;
  const whole = num / den;
  const exact = num % den === 0n;
  const scaled = exact ? whole : whole + 1n;
  if ((scaled * SCALE) / p >= MAX) {
    throw new AppError(
      422,
      'REQUIREMENT_TOO_LARGE',
      'A material requirement is larger than a quantity can hold.',
    );
  }
  const quantity = new Decimal(scaled.toString()).dividedBy(new Decimal(p.toString()));
  return { quantity, exact };
}

export type MaterialAvailability = 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE';
export type OrderMaterialState = 'MATERIALS_AVAILABLE' | 'MATERIALS_SHORT' | 'NOT_ASSESSED';

export function materialState(required: Decimal, available: Decimal) {
  const shortage = Decimal.max(ZERO, required.minus(available));
  const state: MaterialAvailability = shortage.isZero()
    ? 'AVAILABLE'
    : available.gt(0)
      ? 'PARTIALLY_AVAILABLE'
      : 'UNAVAILABLE';
  return { state, shortage };
}

export const orderMaterialState = (states: readonly MaterialAvailability[]): OrderMaterialState =>
  !states.length
    ? 'NOT_ASSESSED'
    : states.every((s) => s === 'AVAILABLE')
      ? 'MATERIALS_AVAILABLE'
      : 'MATERIALS_SHORT';

/** Statuses whose requirements are assessed against stock now (terminal ones are not). */
export const ASSESSED: readonly string[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'READY'];

/** Available-for-new-use stock per (branch, item) — one ledger read for many orders. */
export function availableFor(
  db: Db | Prisma.TransactionClient,
  companyId: string,
  today: string,
  pairs: readonly { branchId: string; itemId: string }[],
) {
  return stockFor(db, companyId, today, pairs);
}

export { stockOf };
