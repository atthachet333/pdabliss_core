import { STRUCTURE_LOCKS } from '../master-data/policy.js';

/*
 * EP31 registers the inventory usage check of the EP28 structure policy
 * point: once an item has a lot, a stock movement or a goods-receipt line, its
 * base unit and its inventory / lot / expiry tracking define how existing
 * quantities were counted and can no longer change.
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
}
