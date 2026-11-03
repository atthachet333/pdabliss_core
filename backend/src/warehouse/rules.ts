import type { Prisma } from '../db/client.js';
import type { ReceiptRejectReason, TrackingRequirement } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import type { AllocationInput } from './input.js';

/*
 * The receiving rules (EP31), checked when a line is saved AND again when the
 * receipt is posted (with the item's tracking as it is then):
 *
 *   quantities  exact, at most the unit's decimal places; accepted ≥ 0,
 *               rejected ≥ 0; a rejected quantity needs a reason
 *   allocations Σ quantity = accepted (none when nothing is accepted); each
 *               into an ACTIVE location of the receipt's branch
 *   lot         item lotTracking NONE → no lot; OPTIONAL → may; REQUIRED → every
 *               allocation names a lot
 *   expiry      item expiryTracking NONE → no expiry; OPTIONAL → may;
 *               REQUIRED → every lot has one. An expiry before today (company
 *               time zone) cannot be ACCEPTED — record it as rejected (EXPIRED)
 *   one lot     the same lot number has one expiry, on this line and in stock
 */

export const decimalPlaces = (q: string) => (q.split('.')[1] ?? '').replace(/0+$/, '').length;

const fail = (status: number, code: string, message: string, details?: object) =>
  new AppError(status, code, message, details);

export interface ItemRules {
  id: string;
  code: string;
  status: string;
  inventoryTracked: boolean;
  lotTracking: TrackingRequirement;
  expiryTracking: TrackingRequirement;
}

export interface LineFacts {
  lineNo: number;
  precision: number;
  item: ItemRules;
}

export interface NormalizedAllocation {
  locationId: string;
  lotNumber: string | null;
  expiryDate: string | null;
  manufacturedDate: string | null;
  quantity: Decimal;
}

export interface NormalizedLine {
  accepted: Decimal;
  rejected: Decimal;
  rejectReason: ReceiptRejectReason | null;
  rejectNote: string | null;
  allocations: NormalizedAllocation[];
}

/** Shape-level rules of one line (no database). Throws the first broken rule. */
export function normalizeLine(
  f: LineFacts,
  input: {
    acceptedQuantity: string;
    rejectedQuantity?: string;
    rejectReason?: ReceiptRejectReason | null;
    rejectNote?: string | null;
    allocations: readonly AllocationInput[];
  },
  today: string,
): NormalizedLine {
  const at = { lineNo: f.lineNo };
  const quantities = [
    input.acceptedQuantity,
    input.rejectedQuantity ?? '0',
    ...input.allocations.map((a) => a.quantity),
  ];
  if (quantities.some((q) => decimalPlaces(q) > f.precision)) {
    throw fail(
      422,
      'QUANTITY_PRECISION',
      'A quantity has more decimal places than its unit allows.',
      {
        ...at,
        precision: f.precision,
      },
    );
  }
  const accepted = new Decimal(input.acceptedQuantity);
  const rejected = new Decimal(input.rejectedQuantity ?? '0');
  if (rejected.gt(0) && !input.rejectReason) {
    throw fail(422, 'REJECT_REASON_REQUIRED', 'Say why the quantity was rejected.', at);
  }
  if (accepted.gt(0) && !f.item.inventoryTracked) {
    throw fail(422, 'ITEM_NOT_STOCKED', 'This item is not kept in stock.', at);
  }
  const total = input.allocations.reduce((s, a) => s.plus(a.quantity), ZERO);
  if (!total.eq(accepted)) {
    throw fail(
      422,
      'ALLOCATION_MISMATCH',
      'The allocations must add up to the accepted quantity.',
      {
        ...at,
        accepted: accepted.toString(),
        allocated: total.toString(),
      },
    );
  }
  const expiryOf = new Map<string, string | null>();
  const allocations = input.allocations.map((a) => {
    const lot = a.lotNumber ?? null;
    const expiry = a.expiryDate ?? null;
    const made = a.manufacturedDate ?? null;
    if (f.item.lotTracking === 'NONE' && (lot || expiry || made)) {
      throw fail(422, 'LOT_NOT_TRACKED', 'This item is not tracked by lot.', at);
    }
    if (f.item.lotTracking === 'REQUIRED' && !lot) {
      throw fail(422, 'LOT_REQUIRED', 'Every quantity of this item needs a lot number.', at);
    }
    if (!lot && (expiry || made)) {
      throw fail(422, 'LOT_REQUIRED', 'An expiry or production date belongs to a lot.', at);
    }
    if (f.item.expiryTracking === 'NONE' && expiry) {
      throw fail(422, 'EXPIRY_NOT_TRACKED', 'This item is not tracked by expiry.', at);
    }
    if (f.item.expiryTracking === 'REQUIRED' && lot && !expiry) {
      throw fail(422, 'EXPIRY_REQUIRED', 'Every lot of this item needs an expiry date.', at);
    }
    if (expiry && expiry < today) {
      throw fail(
        422,
        'LOT_EXPIRED',
        'Expired goods cannot be accepted — record them as rejected (expired).',
        { ...at, lotNumber: lot },
      );
    }
    if (made && (made > today || (expiry && made > expiry))) {
      throw fail(422, 'MANUFACTURED_DATE_INVALID', 'The production date is not plausible.', at);
    }
    if (lot) {
      if (expiryOf.has(lot) && expiryOf.get(lot) !== expiry) {
        throw fail(409, 'LOT_EXPIRY_MISMATCH', 'One lot has one expiry date.', {
          ...at,
          lotNumber: lot,
        });
      }
      expiryOf.set(lot, expiry);
    }
    return {
      locationId: a.locationId,
      lotNumber: lot,
      expiryDate: expiry,
      manufacturedDate: made,
      quantity: new Decimal(a.quantity),
    };
  });
  return {
    accepted,
    rejected,
    rejectReason: rejected.gt(0) ? (input.rejectReason ?? null) : null,
    rejectNote: rejected.gt(0) ? (input.rejectNote ?? null) : null,
    allocations,
  };
}

/** Every location is an ACTIVE location of the receipt's branch. */
export async function assertLocations(
  tx: Prisma.TransactionClient,
  branchId: string,
  ids: readonly string[],
  lineNo?: number,
) {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const rows = await tx.warehouseLocation.findMany({
    where: { id: { in: unique }, branchId },
    select: { id: true, status: true },
  });
  for (const lid of unique) {
    const row = rows.find((r) => r.id === lid);
    if (!row) {
      throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', {
        field: 'locationId',
        ...(lineNo ? { lineNo } : {}),
      });
    }
    if (row.status !== 'ACTIVE') {
      throw fail(409, 'REFERENCE_INACTIVE', 'The selected record is inactive.', {
        field: 'locationId',
        ...(lineNo ? { lineNo } : {}),
      });
    }
  }
}

/** A lot already known for this item keeps its expiry: a different one is refused. */
export async function assertKnownLots(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
  allocations: readonly NormalizedAllocation[],
  lineNo: number,
) {
  const numbers = [...new Set(allocations.map((a) => a.lotNumber).filter((n): n is string => !!n))];
  if (!numbers.length) return;
  const lots = await tx.inventoryLot.findMany({
    where: { companyId, itemId, lotNumber: { in: numbers } },
    select: { lotNumber: true, expiryDate: true },
  });
  for (const lot of lots) {
    const known = lot.expiryDate ? lot.expiryDate.toISOString().slice(0, 10) : null;
    const given = allocations.find((a) => a.lotNumber === lot.lotNumber)!.expiryDate;
    if (given !== null && known !== given) {
      throw fail(
        409,
        'LOT_EXPIRY_MISMATCH',
        'This lot is already known with another expiry date.',
        {
          lineNo,
          lotNumber: lot.lotNumber,
          expiryDate: known,
        },
      );
    }
  }
}
