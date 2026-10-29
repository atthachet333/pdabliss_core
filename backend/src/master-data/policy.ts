import type { Prisma } from '../db/client.js';
import type { Item, Unit } from '../generated/prisma/client.js';
import type { ItemType, TrackingRequirement } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';

/*
 * Master-data rules that later modules build on (EP28).
 *
 * 1. Tracking consistency (also database CHECKs): NON_STOCK never tracks
 *    inventory; an untracked item has no lot and no expiry; expiry is
 *    recorded per lot, so expiry tracking needs lot tracking at least as
 *    strict. Future Warehouse picks earliest-expiry stock (FEFO) among the
 *    lots of items whose expiryTracking is not NONE.
 *
 * 2. The STRUCTURE policy point. An item's base unit and its inventory / lot
 *    / expiry tracking define how every future quantity of it is counted.
 *    They change only through `assertStructureChangeAllowed` (the
 *    PUT /items/:id/structure endpoint, audited as ITEM_STRUCTURE_CHANGED) —
 *    never through the generic edit. In EP28 nothing references items yet,
 *    so the change is allowed; the Warehouse / Purchasing / Sales episodes
 *    register their usage checks in STRUCTURE_LOCKS (stock, lots, document
 *    lines) and the change is then refused or migrated deliberately.
 *
 * 3. Reference lifecycle. A unit or category may be deactivated while items
 *    use it: those items keep showing it (marked inactive) and stay usable,
 *    but no NEW assignment of an inactive unit / category is accepted, and
 *    an item whose base unit is inactive cannot be reactivated. Future
 *    workflows refuse choosing any INACTIVE master record for new documents
 *    while historical documents keep displaying it.
 */

export interface Tracking {
  type: ItemType;
  inventoryTracked: boolean;
  lotTracking: TrackingRequirement;
  expiryTracking: TrackingRequirement;
}

export type TrackingProblem = 'NON_STOCK_TRACKED' | 'UNTRACKED_LOT_OR_EXPIRY' | 'EXPIRY_NEEDS_LOT';

export function trackingProblem(t: Tracking): TrackingProblem | null {
  if (t.type === 'NON_STOCK' && t.inventoryTracked) return 'NON_STOCK_TRACKED';
  if (!t.inventoryTracked && (t.lotTracking !== 'NONE' || t.expiryTracking !== 'NONE'))
    return 'UNTRACKED_LOT_OR_EXPIRY';
  if (t.expiryTracking === 'OPTIONAL' && t.lotTracking === 'NONE') return 'EXPIRY_NEEDS_LOT';
  if (t.expiryTracking === 'REQUIRED' && t.lotTracking !== 'REQUIRED') return 'EXPIRY_NEEDS_LOT';
  return null;
}

export function assertTracking(t: Tracking) {
  const problem = trackingProblem(t);
  if (problem) {
    throw new AppError(422, 'TRACKING_INVALID', 'This tracking combination is not allowed.', {
      reason: problem,
    });
  }
}

export interface StructureChange {
  baseUnit?: { from: Pick<Unit, 'id' | 'code'>; to: Pick<Unit, 'id' | 'code'> };
  inventoryTracked?: { from: boolean; to: boolean };
  lotTracking?: { from: TrackingRequirement; to: TrackingRequirement };
  expiryTracking?: { from: TrackingRequirement; to: TrackingRequirement };
}

/**
 * A check a later module registers: returns a reason when the change would
 * break its records (e.g. 'STOCK_EXISTS'), or null. Runs inside the change
 * transaction, after the item row is locked.
 */
export type StructureLock = (
  tx: Prisma.TransactionClient,
  item: Pick<Item, 'id' | 'companyId'>,
  change: StructureChange,
) => Promise<string | null>;

/** EP28: empty — no stock, lot or document references items yet. */
export const STRUCTURE_LOCKS: StructureLock[] = [];

export async function assertStructureChangeAllowed(
  tx: Prisma.TransactionClient,
  item: Pick<Item, 'id' | 'companyId'>,
  change: StructureChange,
) {
  for (const lock of STRUCTURE_LOCKS) {
    const reason = await lock(tx, item, change);
    if (reason) {
      throw new AppError(
        409,
        'ITEM_STRUCTURE_LOCKED',
        'The unit or tracking of this item can no longer be changed.',
        { reason },
      );
    }
  }
}

/** Maximum depth of the location tree (MAIN → RACK-A → A-01 → BIN). */
export const LOCATION_MAX_DEPTH = 4;
