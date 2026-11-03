import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { Decimal, ZERO } from '../purchasing/money.js';

/*
 * Reserved stock (EP34) — docs/SALES_ALLOCATION.md §3. The ONE place that
 * knows how much of a stock identity (location, item, lot) is claimed: the sum
 * of its ACTIVE SalesAllocation rows. Nothing here writes stock.
 *
 *   on hand   = StockBalance.quantityOnHand (physical truth, unchanged by reservations)
 *   reserved  = Σ ACTIVE reservations of the identity
 *   available = on hand − reserved (≥ 0 — the invariant below keeps it so)
 *
 * Invariant: reserved ≤ on hand for every identity, under concurrency. Both
 * sides serialize on the balance ROW lock:
 *   - a reservation (sales/allocation.ts) locks the balances it may claim
 *     (`lockBalances`, id order) and only then reads what is reserved;
 *   - every physical decrease (ledger.ts applyMovement → `takeRespectingReservations`)
 *     locks its balance row, then reads what is reserved, and refuses to go below it.
 * Reads after the lock are separate statements, so under READ COMMITTED they see
 * every reservation / decrease that committed while we waited.
 */

export interface StockKey {
  locationId: string;
  itemId: string;
  lotId: string | null;
}

export const keyOf = (k: StockKey) => `${k.locationId}/${k.itemId}/${k.lotId ?? ''}`;

type Tx = Prisma.TransactionClient | Db;

/** Σ ACTIVE reservations per identity (missing = 0). */
export async function reservedOf(tx: Tx, keys: readonly StockKey[]) {
  const out = new Map<string, Decimal>();
  if (!keys.length) return out;
  const rows = await tx.salesAllocation.groupBy({
    by: ['locationId', 'itemId', 'lotKey'],
    where: {
      status: 'ACTIVE',
      locationId: { in: [...new Set(keys.map((k) => k.locationId))] },
      itemId: { in: [...new Set(keys.map((k) => k.itemId))] },
    },
    _sum: { quantity: true },
  });
  for (const r of rows) {
    out.set(`${r.locationId}/${r.itemId}/${r.lotKey}`, r._sum.quantity ?? ZERO);
  }
  return out;
}

/** On hand − reserved now for one identity (draft checks and displays; never below 0). */
export async function usableOf(tx: Tx, k: StockKey) {
  const b = await tx.stockBalance.findUnique({
    where: {
      locationId_itemId_lotKey: {
        locationId: k.locationId,
        itemId: k.itemId,
        lotKey: k.lotId ?? '',
      },
    },
    select: { quantityOnHand: true },
  });
  const onHand = b?.quantityOnHand ?? ZERO;
  const reserved = (await reservedOf(tx, [k])).get(keyOf(k)) ?? ZERO;
  return { onHand, reserved, available: Decimal.max(ZERO, onHand.minus(reserved)) };
}

/** Row-locks the positive balances of `itemIds` in one branch, in id order (no deadlock between reservations). */
export async function lockBalances(
  tx: Prisma.TransactionClient,
  o: { companyId: string; branchId: string; itemIds: readonly string[] },
) {
  if (!o.itemIds.length) return;
  await tx.$queryRaw`
    SELECT "id" FROM "StockBalance"
    WHERE "companyId" = ${o.companyId} AND "branchId" = ${o.branchId}
      AND "itemId" = ANY(${[...o.itemIds]}::text[]) AND "quantityOnHand" > 0
    ORDER BY "id" FOR UPDATE`;
}

export const stockReserved = (details: object) =>
  new AppError(
    409,
    'STOCK_RESERVED',
    'This stock is reserved for sales orders. Release or reallocate the reservation first.',
    details,
  );

/**
 * The physical decrease guard: takes `qty` (> 0) from one balance only if that
 * much is on hand (else `short()`) AND what stays covers the active
 * reservations (else STOCK_RESERVED). Used by the ledger for every decrease —
 * transfers out, adjustment decreases, count corrections and all reversals.
 */
export async function takeRespectingReservations(
  tx: Prisma.TransactionClient,
  k: StockKey,
  qty: Decimal,
  short: () => AppError,
) {
  const locked = await tx.$queryRaw<{ id: string; quantityOnHand: Prisma.Decimal }[]>`
    SELECT "id", "quantityOnHand" FROM "StockBalance"
    WHERE "locationId" = ${k.locationId} AND "itemId" = ${k.itemId} AND "lotKey" = ${k.lotId ?? ''}
    FOR UPDATE`;
  const row = locked[0];
  const onHand = row ? new Decimal(row.quantityOnHand) : ZERO;
  if (!row || onHand.lt(qty)) throw short();
  const reserved = (await reservedOf(tx, [k])).get(keyOf(k)) ?? ZERO;
  if (onHand.minus(qty).lt(reserved)) {
    const [item, location] = await Promise.all([
      tx.item.findUnique({ where: { id: k.itemId }, select: { code: true } }),
      tx.warehouseLocation.findUnique({ where: { id: k.locationId }, select: { code: true } }),
    ]);
    throw stockReserved({
      item: item?.code,
      location: location?.code,
      onHand: onHand.toString(),
      reserved: reserved.toString(),
      available: Decimal.max(ZERO, onHand.minus(reserved)).toString(),
    });
  }
  await tx.$executeRaw`
    UPDATE "StockBalance"
    SET "quantityOnHand" = "quantityOnHand" - ${qty.toString()}::numeric,
        "updatedAt" = (NOW() AT TIME ZONE 'UTC')
    WHERE "id" = ${row.id}`;
}
