import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { Decimal, ZERO } from '../purchasing/money.js';

/*
 * Reserved stock (EP34, EP37) — docs/SALES_ALLOCATION.md §3,
 * docs/PRODUCTION_MATERIAL_RESERVATION.md §2. The ONE place that knows how much
 * of a stock identity (location, item, lot) is claimed: the sum of its ACTIVE
 * sales reservations (SalesAllocation, EP34) AND its ACTIVE production
 * reservations (ProductionMaterialAllocation, EP37). Nothing here writes stock.
 *
 *   on hand        = StockBalance.quantityOnHand (physical truth, unchanged by reservations)
 *   reserved       = Σ ACTIVE sales reservations + Σ ACTIVE production reservations
 *   available      = on hand − reserved (≥ 0 — the invariant below keeps it so)
 *
 * Every reader (FEFO candidates, sales and production availability, transfer /
 * adjustment drafts) and every guard goes through `reservedOf`, so Sales can
 * never reserve what Production holds, Production never what Sales holds, and
 * no physical decrease (transfer, adjustment, count correction, reversals,
 * SALES_ISSUE, PRODUCTION_CONSUMPTION) eats into either. A dispatch / material
 * issue first consumes ITS OWN reservation, then passes the same guard.
 *
 * Invariant: sales reserved + production reserved ≤ on hand for every identity,
 * under concurrency. Every side serializes on the balance ROW lock:
 *   - a reservation (sales/allocation.ts, production/allocation.ts) locks the
 *     balances it may claim (`lockBalances`, id order) and only then reads what is
 *     reserved;
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

/** Σ ACTIVE sales and production reservations per identity, kept apart (missing = 0). */
export async function reservedBreakdown(tx: Tx, keys: readonly StockKey[]) {
  const sales = new Map<string, Decimal>();
  const production = new Map<string, Decimal>();
  if (!keys.length) return { sales, production };
  const where = {
    status: 'ACTIVE' as const,
    locationId: { in: [...new Set(keys.map((k) => k.locationId))] },
    itemId: { in: [...new Set(keys.map((k) => k.itemId))] },
  };
  const [s, p] = await Promise.all([
    tx.salesAllocation.groupBy({
      by: ['locationId', 'itemId', 'lotKey'],
      where,
      _sum: { quantity: true },
    }),
    tx.productionMaterialAllocation.groupBy({
      by: ['locationId', 'itemId', 'lotKey'],
      where,
      _sum: { quantity: true },
    }),
  ]);
  for (const r of s) sales.set(`${r.locationId}/${r.itemId}/${r.lotKey}`, r._sum.quantity ?? ZERO);
  for (const r of p)
    production.set(`${r.locationId}/${r.itemId}/${r.lotKey}`, r._sum.quantity ?? ZERO);
  return { sales, production };
}

/** Σ ACTIVE reservations (sales + production) per identity (missing = 0). */
export async function reservedOf(tx: Tx, keys: readonly StockKey[]) {
  const { sales, production } = await reservedBreakdown(tx, keys);
  const out = new Map(sales);
  for (const [k, v] of production) out.set(k, (out.get(k) ?? ZERO).plus(v));
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
    'This stock is reserved (for sales or production). Release or reallocate the reservation first.',
    details,
  );

/**
 * The physical decrease guard: takes `qty` (> 0) from one balance only if that
 * much is on hand (else `short()`) AND what stays covers the active
 * reservations — sales AND production — (else STOCK_RESERVED). Used by the ledger
 * for every decrease: transfers out, adjustment decreases, count corrections, all
 * reversals, SALES_ISSUE and PRODUCTION_CONSUMPTION (each after consuming its own
 * reservation, so it can never take the other side's).
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
