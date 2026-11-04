import type { Db, Prisma } from '../db/client.js';
import type { ProductionAllocationRelease } from '../generated/prisma/enums.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import { keyOf, lockBalances, reservedOf } from '../warehouse/reservations.js';
import { byFefo } from '../warehouse/service.js';

/*
 * Production material reservation (EP37) — docs/PRODUCTION_MATERIAL_RESERVATION.md.
 * Reserves stock for the frozen material requirements of an approved production
 * order, in FEFO order, inside the caller's transaction (the caller has locked
 * the order row and checked status and authority). A reservation is NOT a
 * movement: StockMovement and StockBalance are never written here.
 *
 * It is the production twin of sales/allocation.ts and shares its guard: the
 * order branch's positive balances of the materials are row-locked in id order
 * FIRST, then read, and what is free = on hand − (sales + production ACTIVE
 * reservations) from warehouse/reservations.ts `reservedOf`. Sales allocation
 * locks the same rows in the same order, so the two never over-reserve.
 *
 *   still needed (per material) = required − ACTIVE − CONSUMED (non-excess)
 *   candidates = ACTIVE location, lot not expired (company day), free > 0, FEFO
 *   an existing ACTIVE row of (material, location, lot, excess) grows, else one is created
 * What cannot be covered stays a shortage; no other branch, no expired lot,
 * nothing from the client except which material and (excess only) how much.
 */

export interface ProdAllocActor {
  companyId: string;
  memberId: string;
}

type OrderRef = { id: string; companyId: string; branchId: string };

export interface MaterialResult {
  materialId: string;
  lineNo: number;
  itemCode: string;
  required: Decimal;
  reservedNow: Decimal;
  covered: Decimal;
  shortage: Decimal;
}

/** Per material: ACTIVE, CONSUMED (issued) and excess quantities; usage recorded. */
export async function materialProgress(db: Db | Prisma.TransactionClient, orderIds: string[]) {
  const out = new Map<
    string,
    { reserved: Decimal; issued: Decimal; excess: Decimal; baseCovered: Decimal; used: Decimal }
  >();
  if (!orderIds.length) return out;
  const [alloc, usage] = await Promise.all([
    db.productionMaterialAllocation.groupBy({
      by: ['materialId', 'status', 'excess'],
      where: { productionOrderId: { in: orderIds }, status: { in: ['ACTIVE', 'CONSUMED'] } },
      _sum: { quantity: true },
    }),
    db.productionMaterialUsage.groupBy({
      by: ['materialId'],
      where: { productionOrderId: { in: orderIds } },
      _sum: { quantity: true },
    }),
  ]);
  const get = (id: string) => {
    const p = out.get(id) ?? {
      reserved: ZERO,
      issued: ZERO,
      excess: ZERO,
      baseCovered: ZERO,
      used: ZERO,
    };
    out.set(id, p);
    return p;
  };
  for (const r of alloc) {
    const p = get(r.materialId);
    const q = r._sum.quantity ?? ZERO;
    if (r.status === 'ACTIVE') p.reserved = p.reserved.plus(q);
    else p.issued = p.issued.plus(q);
    if (r.excess) p.excess = p.excess.plus(q);
    else p.baseCovered = p.baseCovered.plus(q);
  }
  for (const u of usage) get(u.materialId).used = u._sum.quantity ?? ZERO;
  return out;
}

/**
 * FEFO reservation of what each material still needs (or, `excess`, of an
 * authorized extra quantity of one material). Repeating it never double-reserves.
 */
export async function allocateMaterials(
  tx: Prisma.TransactionClient,
  a: ProdAllocActor,
  o: OrderRef,
  today: string,
  excess?: { materialId: string; quantity: Decimal; reason: string },
): Promise<MaterialResult[]> {
  const materials = await tx.productionOrderMaterial.findMany({
    where: { productionOrderId: o.id, ...(excess ? { id: excess.materialId } : {}) },
    orderBy: { lineNo: 'asc' },
  });
  const progress = await materialProgress(tx, [o.id]);
  const need = new Map(
    materials.map((m) => [
      m.id,
      excess
        ? excess.quantity
        : Decimal.max(ZERO, m.requiredQuantity.minus(progress.get(m.id)?.baseCovered ?? ZERO)),
    ]),
  );
  const now = new Map<string, Decimal>();
  const wanted = materials.filter((m) => need.get(m.id)!.gt(0));
  if (wanted.length) {
    const itemIds = [...new Set(wanted.map((m) => m.itemId))];
    await lockBalances(tx, { companyId: o.companyId, branchId: o.branchId, itemIds });
    const todayDate = new Date(`${today}T00:00:00Z`);
    const balances = await tx.stockBalance.findMany({
      where: {
        companyId: o.companyId,
        branchId: o.branchId,
        itemId: { in: itemIds },
        quantityOnHand: { gt: 0 },
        location: { status: 'ACTIVE' },
        OR: [
          { lotId: null },
          { lot: { expiryDate: null } },
          { lot: { expiryDate: { gte: todayDate } } },
        ],
      },
      include: {
        location: { select: { code: true } },
        lot: { select: { expiryDate: true, createdAt: true, lotNumber: true } },
      },
    });
    const reserved = await reservedOf(tx, balances);
    const free = new Map(
      balances.map((b) => [b.id, b.quantityOnHand.minus(reserved.get(keyOf(b)) ?? ZERO)]),
    );
    const candidates = balances.filter((b) => free.get(b.id)!.gt(0)).sort(byFefo);
    for (const m of wanted) {
      let left = need.get(m.id)!;
      for (const b of candidates) {
        if (left.isZero()) break;
        if (b.itemId !== m.itemId) continue;
        const take = Decimal.min(left, free.get(b.id)!);
        if (!take.gt(0)) continue;
        free.set(b.id, free.get(b.id)!.minus(take));
        left = left.minus(take);
        now.set(m.id, (now.get(m.id) ?? ZERO).plus(take));
        const grown = await tx.productionMaterialAllocation.updateMany({
          where: {
            materialId: m.id,
            locationId: b.locationId,
            lotKey: b.lotKey,
            excess: !!excess,
            status: 'ACTIVE',
          },
          data: { quantity: { increment: take } },
        });
        if (!grown.count) {
          await tx.productionMaterialAllocation.create({
            data: {
              companyId: o.companyId,
              branchId: o.branchId,
              productionOrderId: o.id,
              materialId: m.id,
              itemId: m.itemId,
              locationId: b.locationId,
              lotId: b.lotId,
              lotKey: b.lotKey,
              quantity: take,
              excess: !!excess,
              excessReason: excess ? excess.reason : null,
              createdByMemberId: a.memberId,
            },
          });
        }
      }
    }
  }
  return materials.map((m) => {
    const p = progress.get(m.id);
    const reservedNow = now.get(m.id) ?? ZERO;
    const target = excess ? excess.quantity : m.requiredQuantity;
    const covered = excess ? reservedNow : (p?.baseCovered ?? ZERO).plus(reservedNow);
    return {
      materialId: m.id,
      lineNo: m.lineNo,
      itemCode: m.itemCode,
      required: target,
      reservedNow,
      covered,
      shortage: Decimal.max(ZERO, target.minus(covered)),
    };
  });
}

/** Every ACTIVE reservation of the order → RELEASED (consumed history untouched). Returns how many. */
export async function releaseMaterials(
  tx: Prisma.TransactionClient,
  a: ProdAllocActor,
  orderId: string,
  reason: ProductionAllocationRelease,
) {
  const r = await tx.productionMaterialAllocation.updateMany({
    where: { productionOrderId: orderId, status: 'ACTIVE' },
    data: {
      status: 'RELEASED',
      activeSlot: null,
      releasedAt: new Date(),
      releasedByMemberId: a.memberId,
      releaseReason: reason,
    },
  });
  return r.count;
}

export type ReservationState =
  'NOT_RESERVED' | 'PARTIALLY_RESERVED' | 'FULLY_RESERVED' | 'PARTIALLY_ISSUED' | 'ISSUED';

/** The order's material commitment, derived from its materials (null before approval). */
export function reservationStateOf(
  lines: readonly { required: Decimal; reserved: Decimal; issued: Decimal }[],
): ReservationState | null {
  if (!lines.length) return null;
  if (lines.every((l) => l.issued.gte(l.required))) return 'ISSUED';
  if (lines.some((l) => l.issued.gt(0))) return 'PARTIALLY_ISSUED';
  if (lines.every((l) => l.reserved.plus(l.issued).gte(l.required))) return 'FULLY_RESERVED';
  if (lines.some((l) => l.reserved.gt(0))) return 'PARTIALLY_RESERVED';
  return 'NOT_RESERVED';
}
