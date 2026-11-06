import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import type { Db, Prisma } from '../db/client.js';
import type { TrackingRequirement } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import { companyDay } from '../purchasing/service.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import type { LedgerActor } from './ledger.js';
import { inBranch, type WarehouseActor } from './policy.js';
import { decimalPlaces } from './rules.js';

/*
 * Shared pieces of the EP32 inventory documents (transfers, adjustments,
 * cycle counts): numbering, the branch a document works in, location / item /
 * lot checks, precision, on-hand reads, timelines. Stock itself is only ever
 * changed by ledger.ts.
 */

export const person = { select: { user: { select: { fullName: true, email: true } } } } as const;
export const who = (m: { user: { fullName: string | null; email: string } } | null) =>
  m ? { name: m.user.fullName ?? m.user.email } : null;
export const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
export const iso = (d: Date | null) => (d ? d.toISOString() : null);
export const asDay = (v: string) => new Date(`${v}T00:00:00Z`);
export const locationRef = { select: { id: true, code: true, name: true } } as const;
export const itemRef = {
  select: {
    id: true,
    code: true,
    name: true,
    lotTracking: true,
    expiryTracking: true,
    baseUnit: { select: { code: true, precision: true } },
  },
} as const;
export const lotRef = { select: { id: true, lotNumber: true, expiryDate: true } } as const;

export const lotView = (l: { id: string; lotNumber: string; expiryDate: Date | null } | null) =>
  l ? { id: l.id, lotNumber: l.lotNumber, expiryDate: day(l.expiryDate) } : null;
export const itemView = (i: {
  id: string;
  code: string;
  name: string;
  lotTracking: TrackingRequirement;
  expiryTracking: TrackingRequirement;
  baseUnit: { code: string; precision: number };
}) => ({
  item: {
    id: i.id,
    code: i.code,
    name: i.name,
    lotTracking: i.lotTracking,
    expiryTracking: i.expiryTracking,
  },
  unit: { code: i.baseUnit.code, precision: i.baseUnit.precision },
});

export const today = (actor: WarehouseActor) => companyDay(actor.access.company.timezone);

export const ledgerActor = (actor: WarehouseActor, meta: RequestMeta): LedgerActor => ({
  companyId: actor.access.company.id,
  memberId: actor.memberId,
  userId: actor.access.actor.userId,
  scope: 'customer',
  meta,
});

/** XX-YYYYMM-NNNNNN from DocumentSequence (one atomic upsert, never MAX + 1). */
export async function nextNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  prefix: 'TR' | 'ADJ' | 'CC' | 'PICK' | 'PACK' | 'SHP',
  onDay: string,
) {
  const period = onDay.slice(0, 7).replace('-', '');
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
    VALUES (${companyId}, ${`${prefix}:${period}`}, 1, NOW())
    ON CONFLICT ("companyId", "key")
    DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
    RETURNING "lastValue"`;
  return `${prefix}-${period}-${String(rows[0]!.lastValue).padStart(6, '0')}`;
}

export const lockRow = (tx: Prisma.TransactionClient, table: string, id: string) =>
  tx.$queryRawUnsafe(`SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id);

/** The branch a new adjustment / count works in: the selected one, or the member's only one. */
export function workingBranch(actor: WarehouseActor, ctx: AuthContext) {
  // EP40: the member's only branch stands in only when none was chosen. A chosen branch since
  // taken away is never silently replaced by another (the request asks for a choice again).
  const id =
    actor.branches.find((b) => b.id === ctx.session.branchId)?.id ??
    (!ctx.session.branchId && actor.branches.length === 1 ? actor.branches[0]!.id : null);
  if (!id) {
    throw new AppError(409, 'BRANCH_SELECTION_REQUIRED', 'Choose the branch you work in first.');
  }
  return id;
}

export const fail = (status: number, code: string, message: string, details?: object) =>
  new AppError(status, code, message, details);

/**
 * Locations of the company, by id. Another company's location does not exist
 * (REFERENCE_NOT_FOUND); `branchId` (when given) must match (CROSS_BRANCH);
 * the member needs the branch; `active` refuses an inactive one (LOCATION_INACTIVE).
 */
export async function locationsOf(
  tx: Prisma.TransactionClient | Db,
  actor: WarehouseActor,
  ids: readonly string[],
  opts: { branchId?: string; active?: boolean; field?: string } = {},
) {
  const unique = [...new Set(ids)];
  const rows = await tx.warehouseLocation.findMany({
    where: { id: { in: unique }, companyId: actor.access.company.id },
    select: { id: true, code: true, name: true, branchId: true, status: true },
  });
  const field = opts.field ?? 'locationId';
  for (const id of unique) {
    const row = rows.find((r) => r.id === id);
    if (!row)
      throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', { field });
    if (!inBranch(actor, row.branchId)) {
      throw fail(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
    }
    if (opts.branchId && row.branchId !== opts.branchId) {
      throw fail(422, 'CROSS_BRANCH', 'Every location must be in the same branch.', { field });
    }
    if (opts.active && row.status !== 'ACTIVE') {
      throw fail(409, 'LOCATION_INACTIVE', 'The selected location is inactive.', {
        field,
        location: row.code,
      });
    }
  }
  return new Map(rows.map((r) => [r.id, r]));
}

export interface ItemFacts {
  id: string;
  code: string;
  status: string;
  inventoryTracked: boolean;
  lotTracking: TrackingRequirement;
  expiryTracking: TrackingRequirement;
  baseUnit: { precision: number };
}

/** Stock items of the company: must exist and be kept in stock. */
export async function itemsOf(
  tx: Prisma.TransactionClient | Db,
  companyId: string,
  ids: readonly string[],
) {
  const rows = await tx.item.findMany({
    where: { id: { in: [...new Set(ids)] }, companyId },
    select: {
      id: true,
      code: true,
      status: true,
      inventoryTracked: true,
      lotTracking: true,
      expiryTracking: true,
      baseUnit: { select: { precision: true } },
    },
  });
  for (const id of new Set(ids)) {
    const it = rows.find((r) => r.id === id);
    if (!it)
      throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', {
        field: 'itemId',
      });
    if (!it.inventoryTracked)
      throw fail(422, 'ITEM_NOT_STOCKED', 'This item is not kept in stock.');
  }
  return new Map<string, ItemFacts>(rows.map((r) => [r.id, r]));
}

/** An existing lot of this item (another item's or company's lot does not exist). */
export async function lotOf(
  tx: Prisma.TransactionClient | Db,
  companyId: string,
  itemId: string,
  lotId: string,
) {
  const lot = await tx.inventoryLot.findFirst({ where: { id: lotId, itemId, companyId } });
  if (!lot)
    throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', {
      field: 'lotId',
    });
  return lot;
}

export function assertPrecision(q: string, precision: number, lineNo: number) {
  if (decimalPlaces(q) > precision) {
    throw fail(
      422,
      'QUANTITY_PRECISION',
      'A quantity has more decimal places than its unit allows.',
      {
        lineNo,
        precision,
      },
    );
  }
}

/**
 * The lot rules of the item for a stock identity a document names: an existing
 * lot (lotId), a new lot (number + expiry — only where `allowNew`), or none.
 */
export function assertLotIdentity(
  item: ItemFacts,
  l: { lotId?: string | null; newLotNumber?: string | null; newLotExpiry?: string | null },
  opts: { lineNo: number; allowNew: boolean; today: string },
) {
  const at = { lineNo: opts.lineNo };
  if (l.lotId && l.newLotNumber) throw fail(422, 'LOT_AMBIGUOUS', 'Name one lot.', at);
  if (item.lotTracking === 'NONE' && (l.lotId || l.newLotNumber || l.newLotExpiry)) {
    throw fail(422, 'LOT_NOT_TRACKED', 'This item is not tracked by lot.', at);
  }
  if (item.lotTracking === 'REQUIRED' && !l.lotId && !l.newLotNumber) {
    throw fail(422, 'LOT_REQUIRED', 'This item needs a lot.', at);
  }
  if (l.newLotExpiry && !l.newLotNumber) {
    throw fail(422, 'LOT_REQUIRED', 'An expiry date belongs to a lot.', at);
  }
  if (l.newLotNumber) {
    if (!opts.allowNew)
      throw fail(422, 'NEW_LOT_NOT_ALLOWED', 'A new lot cannot be created here.', at);
    if (item.expiryTracking === 'NONE' && l.newLotExpiry) {
      throw fail(422, 'EXPIRY_NOT_TRACKED', 'This item is not tracked by expiry.', at);
    }
    if (item.expiryTracking === 'REQUIRED' && !l.newLotExpiry) {
      throw fail(422, 'EXPIRY_REQUIRED', 'Every lot of this item needs an expiry date.', at);
    }
    if (l.newLotExpiry && l.newLotExpiry < opts.today) {
      throw fail(422, 'LOT_EXPIRED', 'An expired lot cannot be added to stock.', at);
    }
  }
}

/** A new lot number that already exists for the item keeps its expiry (or is refused). */
export async function knownLot(
  tx: Prisma.TransactionClient | Db,
  companyId: string,
  itemId: string,
  lotNumber: string,
  expiry: string | null,
  lineNo: number,
) {
  const lot = await tx.inventoryLot.findUnique({
    where: { companyId_itemId_lotNumber: { companyId, itemId, lotNumber } },
  });
  if (lot && expiry !== null && day(lot.expiryDate) !== expiry) {
    throw fail(409, 'LOT_EXPIRY_MISMATCH', 'This lot is already known with another expiry date.', {
      lineNo,
      lotNumber,
      expiryDate: day(lot.expiryDate),
    });
  }
  return lot;
}

/** On hand now for (location, item, lot). */
export async function onHand(
  tx: Prisma.TransactionClient | Db,
  locationId: string,
  itemId: string,
  lotId: string | null,
) {
  const b = await tx.stockBalance.findUnique({
    where: { locationId_itemId_lotKey: { locationId, itemId, lotKey: lotId ?? '' } },
    select: { quantityOnHand: true },
  });
  return b?.quantityOnHand ?? ZERO;
}

export async function timeline(
  db: Db,
  companyId: string,
  entityType: string,
  entityId: string,
  actions: readonly string[],
) {
  const events = await db.auditLog.findMany({
    where: { companyId, entityType, entityId, action: { in: [...actions] } },
    orderBy: { occurredAt: 'asc' },
    include: { actor: { select: { fullName: true, email: true } } },
  });
  return events.map((e) => ({
    type: e.action,
    at: e.occurredAt.toISOString(),
    actor: e.actor ? { name: e.actor.fullName ?? e.actor.email } : null,
  }));
}

export const dateWhere = (from?: string, to?: string) =>
  from || to
    ? { ...(from ? { gte: asDay(from) } : {}), ...(to ? { lte: asDay(to) } : {}) }
    : undefined;

export const branchFilter = (actor: WarehouseActor, branchId?: string) => {
  const ids = actor.branches.map((b) => b.id);
  return { in: branchId ? ids.filter((b) => b === branchId) : ids };
};

export const page = <T>(items: T[], total: number, q: { page: number; pageSize: number }) => ({
  items,
  total,
  page: q.page,
  pageSize: q.pageSize,
  hasMore: (q.page - 1) * q.pageSize + items.length < total,
});

export { Decimal };
