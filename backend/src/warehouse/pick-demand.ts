import type { AuthContext } from '../auth/sessions.js';
import type { Db, Prisma } from '../db/client.js';
import { permissionDenied } from '../permissions/guard.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import { companyDay } from '../purchasing/service.js';
import { allocationStateOf } from '../sales/allocation.js';
import { day } from './documents.js';
import type { PickDemandInput } from './input.js';
import { loadWarehouseActor } from './policy.js';
import { expiryStateOf } from './service.js';
import { PickDemandOrder } from './views.js';

/*
 * Pending Pick (EP34) — docs/SALES_ALLOCATION.md §8. A READ-ONLY,
 * warehouse-safe view of sales demand: CONFIRMED orders in the member's
 * branches with at least one ACTIVE reservation, their inventory-tracked
 * lines (ordered / allocated / shortage) and where the reserved stock is.
 * Read with `warehouse.inventory.view`. It is parsed through an allow-list
 * (views.ts PickDemandOrder): no customer, price, discount, tax, total, note
 * or reference ever leaves here. There is no pick action until EP35.
 */

const MAX = 1000;

export class PickDemandService {
  constructor(private readonly db: Db) {}

  async list(ctx: AuthContext, q: PickDemandInput) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.inventory.view) throw permissionDenied('warehouse.inventory.view');
    const today = companyDay(actor.access.company.timezone);
    const ids = actor.branches.map((b) => b.id);
    const where: Prisma.SalesOrderWhereInput = {
      companyId: actor.access.company.id,
      branchId: { in: q.branchId ? ids.filter((b) => b === q.branchId) : ids },
      status: 'CONFIRMED',
      allocations: { some: { status: 'ACTIVE' } },
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q, mode: 'insensitive' } },
              { lines: { some: { itemCode: { contains: q.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const orders = await this.db.salesOrder.findMany({
      where,
      orderBy: [{ requestedDate: { sort: 'asc', nulls: 'last' } }, { number: 'asc' }],
      take: MAX,
      select: {
        id: true,
        number: true,
        status: true,
        orderDate: true,
        requestedDate: true,
        confirmedAt: true,
        branch: { select: { id: true, code: true, name: true } },
        lines: {
          where: { inventoryTracked: true },
          orderBy: { lineNo: 'asc' },
          select: {
            id: true,
            lineNo: true,
            itemId: true,
            itemCode: true,
            itemName: true,
            unitCode: true,
            quantity: true,
          },
        },
        allocations: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          select: {
            salesOrderLineId: true,
            quantity: true,
            location: { select: { id: true, code: true, name: true } },
            lot: { select: { lotNumber: true, expiryDate: true } },
          },
        },
      },
    });
    const views = orders.map((o) => {
      const lines = o.lines.map((l) => {
        const picks = o.allocations.filter((x) => x.salesOrderLineId === l.id);
        const allocated = picks.reduce((t, x) => t.plus(x.quantity), ZERO);
        return { l, picks, allocated };
      });
      const derived = allocationStateOf(
        o.status,
        lines.map((x) => ({ ordered: x.l.quantity, allocated: x.allocated })),
      );
      return PickDemandOrder.parse({
        id: o.id,
        number: o.number,
        branch: o.branch,
        orderDate: day(o.orderDate),
        requestedDate: day(o.requestedDate),
        confirmedAt: o.confirmedAt?.toISOString() ?? null,
        readiness: derived?.readiness ?? 'NOT_READY',
        lines: lines.map(({ l, picks, allocated }) => ({
          lineNo: l.lineNo,
          item: { id: l.itemId, code: l.itemCode, name: l.itemName },
          unit: { code: l.unitCode },
          ordered: l.quantity.toString(),
          allocated: allocated.toString(),
          shortage: Decimal.max(ZERO, l.quantity.minus(allocated)).toString(),
          picks: picks.map((x) => {
            const expiry = day(x.lot?.expiryDate ?? null);
            return {
              location: x.location,
              lot: x.lot ? { lotNumber: x.lot.lotNumber, expiryDate: expiry } : null,
              expiryState: expiryStateOf(expiry, today),
              quantity: x.quantity.toString(),
            };
          }),
        })),
      });
    });
    const filtered = q.readiness ? views.filter((v) => v.readiness === q.readiness) : views;
    const skip = (q.page - 1) * q.pageSize;
    const items = filtered.slice(skip, skip + q.pageSize);
    return {
      items,
      total: filtered.length,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: skip + items.length < filtered.length,
      today,
    };
  }
}
