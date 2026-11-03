import { LOCATION_LOCKS, STRUCTURE_LOCKS } from '../master-data/policy.js';
import { lockLocations } from './ledger.js';

/*
 * EP31 registers the inventory usage check of the EP28 structure policy
 * point: once an item has a lot, a stock movement or a goods-receipt line, its
 * base unit and its inventory / lot / expiry tracking define how existing
 * quantities were counted and can no longer change.
 *
 * EP32 registers the location check: a location cannot be deactivated while
 * it holds stock (any balance ≠ 0), or a DRAFT transfer, a DRAFT / SUBMITTED
 * adjustment, a DRAFT receipt allocation or an open cycle count (any status
 * before POSTED / CANCELLED) names it. The location is taken exclusively first
 * (ledger.ts lockLocations), so a stock write in flight finishes before the
 * check and later writes see it INACTIVE.
 */

let registered = false;

export function registerInventoryLocks() {
  if (registered) return;
  registered = true;
  STRUCTURE_LOCKS.push(async (tx, item) => {
    const where = { companyId: item.companyId, itemId: item.id };
    const [movements, lots, lines] = await Promise.all([
      tx.stockMovement.count({ where }),
      tx.inventoryLot.count({ where }),
      tx.goodsReceiptLine.count({ where }),
    ]);
    if (movements) return 'STOCK_EXISTS';
    if (lots) return 'LOTS_EXIST';
    if (lines) return 'RECEIPTS_EXIST';
    return null;
  });
  LOCATION_LOCKS.push(async (tx, location) => {
    await lockLocations(tx, [location.id], 'exclusive');
    const id = location.id;
    const companyId = location.companyId;
    const [stock, transfers, adjustments, receipts, counts] = await Promise.all([
      tx.stockBalance.count({ where: { locationId: id, quantityOnHand: { not: 0 } } }),
      tx.inventoryTransfer.count({
        where: {
          companyId,
          status: 'DRAFT',
          OR: [{ sourceLocationId: id }, { destinationLocationId: id }],
        },
      }),
      tx.stockAdjustment.count({
        where: {
          companyId,
          status: { in: ['DRAFT', 'SUBMITTED'] },
          lines: { some: { locationId: id } },
        },
      }),
      tx.goodsReceiptAllocation.count({
        where: { companyId, locationId: id, line: { receipt: { status: 'DRAFT' } } },
      }),
      tx.cycleCount.count({
        where: {
          companyId,
          status: { in: ['DRAFT', 'COUNTING', 'REVIEW'] },
          locations: { some: { locationId: id } },
        },
      }),
    ]);
    if (stock) return { code: 'LOCATION_HAS_STOCK', details: { balances: stock } };
    if (transfers) return { code: 'LOCATION_IN_USE', details: { transfers } };
    if (adjustments) return { code: 'LOCATION_IN_USE', details: { adjustments } };
    if (receipts) return { code: 'LOCATION_IN_USE', details: { receipts } };
    if (counts) return { code: 'LOCATION_IN_USE', details: { counts } };
    return null;
  });
}
