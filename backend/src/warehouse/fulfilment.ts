import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import type { Db, Prisma } from '../db/client.js';
import type { ActorScope, SalesFulfilmentAuditAction } from '../company/audit.js';
import { permissionDenied } from '../permissions/guard.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import { pickClaims } from '../sales/fulfilment.js';
import {
  assertPrecision,
  branchFilter,
  day,
  fail,
  iso,
  ledgerActor,
  locationRef,
  lockRow,
  lotRef,
  lotView,
  nextNumber,
  page,
  person,
  timeline,
  today,
  who,
} from './documents.js';
import {
  PackView,
  PickView,
  ShipmentRow,
  ShipmentView,
  PackRow,
  PickRow,
} from './fulfilment-views.js';
import type {
  ConfirmPickInput,
  CreatePackInput,
  CreatePickInput,
  CreateShipmentInput,
  DeliverInput,
  DeliveryExceptionInput,
  DispatchInput,
  FulfilmentListInput,
} from './input.js';
import { applyMovement, event, insufficientStock, lockLocations } from './ledger.js';
import {
  allowedDocActions,
  assertDoc,
  documentNotFound,
  inBranch,
  loadWarehouseActor,
  PACK_RULES,
  PICK_RULES,
  SHIPMENT_RULES,
  type WarehouseActor,
} from './policy.js';
import { expiryStateOf } from './service.js';

/*
 * Sales fulfilment (EP35) — docs/SALES_FULFILLMENT.md. Picks, packs and
 * shipments turn a CONFIRMED order's reservations into a physical handover.
 *
 *   pick      take reserved stock (the reservation's exact location + lot) off the
 *             shelf — never a movement; the reservation stays ACTIVE
 *   pack      box picked quantities — never a movement
 *   shipment  packs handed over together; DISPATCH is THE stock issue point:
 *             in one transaction the matching reservation is CONSUMED (split when
 *             partial) and a SALES_ISSUE movement takes the same quantity out
 *             through ledger.ts — exactly once
 *   delivery  evidence only: delivered quantities, exceptions — never stock
 *
 * Every write locks the sales ORDER row first, then its document row (picks,
 * packs, shipments and the allocation / cancel actions of Sales all serialize on
 * the order), so claims are read after every earlier write committed. Dispatch
 * then takes the location locks (shared; a cycle count holds them exclusively)
 * and the balance and reservation rows, in id order. Quantity chains are also
 * CHECKed in the database: planned ≥ picked ≥ packed ≥ dispatched per pick line.
 */

type Tx = Prisma.TransactionClient;

const orderRef = { select: { id: true, number: true, status: true, requestedDate: true } } as const;
const orderView = (o: {
  id: string;
  number: string;
  status: string;
  requestedDate: Date | null;
}) => ({
  id: o.id,
  number: o.number,
  status: o.status,
  requestedDate: day(o.requestedDate),
});
const lineRef = {
  select: { lineNo: true, itemCode: true, itemName: true, unitCode: true, unitPrecision: true },
} as const;
const itemOf = (itemId: string, l: { itemCode: string; itemName: string }) => ({
  id: itemId,
  code: l.itemCode,
  name: l.itemName,
});
const unitOf = (l: { unitCode: string; unitPrecision: number }) => ({
  code: l.unitCode,
  precision: l.unitPrecision,
});
const branch = { select: { id: true, code: true, name: true } } as const;

const pickInclude = {
  branch,
  order: orderRef,
  createdBy: person,
  startedBy: person,
  pickedBy: person,
  cancelledBy: person,
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: { orderLine: lineRef, location: locationRef, lot: lotRef },
  },
} satisfies Prisma.SalesPickInclude;
type FullPick = Prisma.SalesPickGetPayload<{ include: typeof pickInclude }>;

const packInclude = {
  branch,
  order: orderRef,
  shipment: { select: { id: true, number: true } },
  createdBy: person,
  packedBy: person,
  cancelledBy: person,
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: {
      orderLine: lineRef,
      pickLine: {
        select: {
          itemId: true,
          location: locationRef,
          lot: lotRef,
          pick: { select: { id: true, number: true } },
        },
      },
    },
  },
} satisfies Prisma.SalesPackInclude;
type FullPack = Prisma.SalesPackGetPayload<{ include: typeof packInclude }>;

const shipmentPacks = {
  orderBy: { number: 'asc' as const },
  select: { id: true, number: true, packageCount: true },
} as const;
const shipmentEvents = {
  orderBy: { createdAt: 'asc' as const },
  include: { recordedBy: person },
} as const;

const PICK_TIMELINE: SalesFulfilmentAuditAction[] = [
  'SALES_PICK_CREATED',
  'SALES_PICK_UPDATED',
  'SALES_PICK_CONFIRMED',
  'SALES_PICK_CANCELLED',
];
const PACK_TIMELINE: SalesFulfilmentAuditAction[] = [
  'SALES_PACK_CREATED',
  'SALES_PACK_CONFIRMED',
  'SALES_PACK_CANCELLED',
];
const SHIPMENT_TIMELINE: SalesFulfilmentAuditAction[] = [
  'SALES_SHIPMENT_CREATED',
  'SALES_SHIPMENT_CANCELLED',
  'SALES_SHIPMENT_DISPATCHED',
  'SALES_SHIPMENT_DELIVERED',
  'SALES_SHIPMENT_EXCEPTION',
];

const orderNotFound = () => fail(404, 'SALES_ORDER_NOT_FOUND', 'This sales order was not found.');
const notConfirmed = (status: string) =>
  fail(409, 'SO_NOT_CONFIRMED', 'Only a confirmed sales order can be fulfilled.', { status });
const duplicate = (field: string) =>
  fail(422, 'DUPLICATE_LINE', 'The same line is named twice.', { field });

const sumBy = <T>(rows: readonly T[], key: (r: T) => string, q: (r: T) => Decimal) => {
  const m = new Map<string, Decimal>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? ZERO).plus(q(r)));
  return m;
};

export class FulfilmentService {
  /** `scope`: 'seed' when the demo drives the service (audit shows it), else the API's 'customer'. */
  constructor(
    private readonly db: Db,
    private readonly scope: ActorScope = 'customer',
  ) {}

  private ledger(actor: WarehouseActor, meta: RequestMeta) {
    return { ...ledgerActor(actor, meta), scope: this.scope };
  }

  // ------------------------------------------------------------------ shared

  private async reader(ctx: AuthContext) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.inventory.view) throw permissionDenied('warehouse.inventory.view');
    return actor;
  }

  private async picker(ctx: AuthContext) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.fulfilment.pick) throw permissionDenied('warehouse.picking.process');
    return actor;
  }

  private emit(
    tx: Tx,
    actor: WarehouseActor,
    meta: RequestMeta,
    action: SalesFulfilmentAuditAction,
    entityType: 'SalesPick' | 'SalesPack' | 'SalesShipment',
    id: string,
    details: Record<string, string | number | boolean | null>,
  ) {
    return event(tx, this.ledger(actor, meta), action, entityType, id, details);
  }

  /** Locks the order row; the order must exist in the company, be visible (branch) and CONFIRMED. */
  private async lockOrder(tx: Tx, actor: WarehouseActor, orderId: string) {
    await lockRow(tx, 'SalesOrder', orderId);
    const o = await tx.salesOrder.findFirst({
      where: { id: orderId, companyId: actor.access.company.id },
      select: { id: true, number: true, status: true, branchId: true, customerName: true },
    });
    if (!o || !inBranch(actor, o.branchId)) throw orderNotFound();
    if (o.status !== 'CONFIRMED') throw notConfirmed(o.status);
    return o;
  }

  /** Order row first, then the document row (one lock order for every fulfilment write). */
  private async lockDoc<T extends { salesOrderId: string; branchId: string }>(
    tx: Tx,
    actor: WarehouseActor,
    table: 'SalesPick' | 'SalesPack' | 'SalesShipment',
    id: string,
    read: () => Promise<T | null>,
  ) {
    const kind = table === 'SalesPick' ? 'PICK' : table === 'SalesPack' ? 'PACK' : 'SHIPMENT';
    const first = await read();
    if (!first || !inBranch(actor, first.branchId)) throw documentNotFound(kind);
    await lockRow(tx, 'SalesOrder', first.salesOrderId);
    await lockRow(tx, table, id);
    const d = await read();
    if (!d) throw documentNotFound(kind);
    return d;
  }

  private listWhere(actor: WarehouseActor, q: FulfilmentListInput) {
    return {
      companyId: actor.access.company.id,
      branchId: branchFilter(actor, q.branchId),
      ...(q.status ? { status: q.status } : {}),
      ...(q.salesOrderId ? { salesOrderId: q.salesOrderId } : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q, mode: 'insensitive' as const } },
              { order: { number: { contains: q.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
  }

  // ------------------------------------------------------------------ picks

  async listPicks(ctx: AuthContext, q: FulfilmentListInput) {
    const actor = await this.reader(ctx);
    const where = this.listWhere(actor, q) as Prisma.SalesPickWhereInput;
    const [rows, total] = await Promise.all([
      this.db.salesPick.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          branch,
          order: orderRef,
          createdBy: person,
          _count: { select: { lines: true } },
        },
      }),
      this.db.salesPick.count({ where }),
    ]);
    return page(
      rows.map((p) =>
        PickRow.parse({
          ...this.common(p),
          status: p.status,
          lineCount: p._count.lines,
        }),
      ),
      total,
      q,
    );
  }

  private common(d: {
    id: string;
    number: string;
    branch: { id: string; code: string; name: string };
    order: { id: string; number: string; status: string; requestedDate: Date | null };
    createdBy: { user: { fullName: string | null; email: string } } | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: d.id,
      number: d.number,
      branch: d.branch,
      order: orderView(d.order),
      createdBy: who(d.createdBy),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async getPick(ctx: AuthContext, id: string) {
    const actor = await this.reader(ctx);
    const p = await this.db.salesPick.findFirst({
      where: { id, companyId: actor.access.company.id },
      include: pickInclude,
    });
    if (!p || !inBranch(actor, p.branchId)) throw documentNotFound('PICK');
    return this.pickView(actor, p);
  }

  private async pickView(actor: WarehouseActor, p: FullPick) {
    const now = today(actor);
    const lines = p.lines.map((l) => {
      const toPack = Decimal.max(ZERO, (l.pickedQuantity ?? ZERO).minus(l.packedQuantity));
      const expiry = day(l.lot?.expiryDate ?? null);
      return {
        id: l.id,
        lineNo: l.lineNo,
        orderLineNo: l.orderLine.lineNo,
        item: itemOf(l.itemId, l.orderLine),
        unit: unitOf(l.orderLine),
        location: l.location,
        lot: lotView(l.lot),
        expiryState: expiryStateOf(expiry, now),
        planned: l.plannedQuantity.toString(),
        picked: l.pickedQuantity?.toString() ?? null,
        toPack: toPack.toString(),
        packed: l.packedQuantity.toString(),
        dispatched: l.dispatchedQuantity.toString(),
        discrepancy: l.discrepancy,
        discrepancyNote: l.discrepancyNote,
        packedAny: l.packedQuantity.gt(0),
      };
    });
    const actions: ('start' | 'confirm' | 'cancel' | 'pack')[] = allowedDocActions(
      actor,
      PICK_RULES,
      p,
    ).filter((a) => a !== 'cancel' || !lines.some((l) => l.packedAny));
    if (
      p.status === 'PICKED' &&
      p.order.status === 'CONFIRMED' &&
      actor.fulfilment.pick &&
      inBranch(actor, p.branchId) &&
      lines.some((l) => l.toPack !== '0')
    ) {
      actions.push('pack');
    }
    return {
      pick: PickView.parse({
        ...this.common(p),
        status: p.status,
        lineCount: p.lines.length,
        note: p.note,
        startedAt: iso(p.startedAt),
        startedBy: who(p.startedBy),
        pickedAt: iso(p.pickedAt),
        pickedBy: who(p.pickedBy),
        cancelledAt: iso(p.cancelledAt),
        cancelledBy: who(p.cancelledBy),
        cancellationReason: p.cancellationReason,
        lines,
        actions,
      }),
      timeline: await timeline(this.db, p.companyId, 'SalesPick', p.id, PICK_TIMELINE),
    };
  }

  /** A pick of a CONFIRMED order: named reservations, or everything not yet claimed (FEFO). */
  async createPick(ctx: AuthContext, input: CreatePickInput, meta: RequestMeta) {
    const actor = await this.picker(ctx);
    const id = await this.db.$transaction(async (tx) => {
      const o = await this.lockOrder(tx, actor, input.salesOrderId);
      const active = await tx.salesAllocation.findMany({
        where: { salesOrderId: o.id, status: 'ACTIVE' },
        include: {
          line: { select: { lineNo: true, unitPrecision: true } },
          location: { select: { code: true } },
          lot: { select: { expiryDate: true, createdAt: true } },
        },
      });
      const claims = await pickClaims(
        tx,
        active.map((a) => a.id),
      );
      const free = (a: (typeof active)[number]) =>
        Decimal.max(ZERO, a.quantity.minus(claims.get(a.id) ?? ZERO));
      let wanted: { a: (typeof active)[number]; q: Decimal }[];
      if (input.lines) {
        const seen = new Set<string>();
        wanted = input.lines.map((l, i) => {
          if (seen.has(l.allocationId)) throw duplicate('allocationId');
          seen.add(l.allocationId);
          const a = active.find((x) => x.id === l.allocationId);
          if (!a) {
            throw fail(
              409,
              'RESERVATION_NOT_ACTIVE',
              'This reservation is not active for the order.',
              {
                lineNo: i + 1,
              },
            );
          }
          assertPrecision(l.quantity, a.line.unitPrecision, i + 1);
          const q = new Decimal(l.quantity);
          if (q.gt(free(a))) {
            throw fail(
              409,
              'PICK_EXCEEDS_RESERVATION',
              'This is more than is reserved and not yet being picked.',
              {
                lineNo: i + 1,
                available: free(a).toString(),
              },
            );
          }
          return { a, q };
        });
      } else {
        // Order line first, then FEFO (expiry, lot age, location) — the order the stock was reserved in.
        const ts = (d: Date | null | undefined) => d?.getTime() ?? Number.POSITIVE_INFINITY;
        wanted = active
          .map((a) => ({ a, q: free(a) }))
          .filter((x) => x.q.gt(0))
          .sort(
            (x, y) =>
              x.a.line.lineNo - y.a.line.lineNo ||
              ts(x.a.lot?.expiryDate) - ts(y.a.lot?.expiryDate) ||
              ts(x.a.lot?.createdAt) - ts(y.a.lot?.createdAt) ||
              x.a.location.code.localeCompare(y.a.location.code),
          );
      }
      if (!wanted.length) {
        throw fail(
          409,
          'NOTHING_TO_PICK',
          'Everything reserved for this order is already being picked.',
        );
      }
      const number = await nextNumber(tx, actor.access.company.id, 'PICK', today(actor));
      const p = await tx.salesPick.create({
        data: {
          companyId: actor.access.company.id,
          branchId: o.branchId,
          salesOrderId: o.id,
          number,
          note: input.note ?? null,
          createdByMemberId: actor.memberId,
        },
      });
      await tx.salesPickLine.createMany({
        data: wanted.map(({ a, q }, i) => ({
          companyId: a.companyId,
          branchId: a.branchId,
          salesOrderId: o.id,
          pickId: p.id,
          lineNo: i + 1,
          salesOrderLineId: a.salesOrderLineId,
          allocationId: a.id,
          itemId: a.itemId,
          locationId: a.locationId,
          lotId: a.lotId,
          lotKey: a.lotKey,
          plannedQuantity: q,
        })),
      });
      await this.emit(tx, actor, meta, 'SALES_PICK_CREATED', 'SalesPick', p.id, {
        number,
        order: o.number,
        lines: wanted.length,
      });
      return p.id;
    });
    return this.getPick(ctx, id);
  }

  private lockedPick(tx: Tx, actor: WarehouseActor, id: string, action: keyof typeof PICK_RULES) {
    return this.lockDoc(tx, actor, 'SalesPick', id, () =>
      tx.salesPick.findFirst({ where: { id, companyId: actor.access.company.id } }),
    ).then((p) => {
      assertDoc(actor, action, PICK_RULES[action], p);
      return p;
    });
  }

  async startPick(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const p = await this.lockedPick(tx, actor, id, 'start');
      await tx.salesPick.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startedAt: new Date(), startedByMemberId: actor.memberId },
      });
      await this.emit(tx, actor, meta, 'SALES_PICK_UPDATED', 'SalesPick', id, {
        number: p.number,
        to: 'IN_PROGRESS',
      });
    });
    return this.getPick(ctx, id);
  }

  /** DRAFT / IN_PROGRESS → PICKED: what was taken per line; short lines name a discrepancy. */
  async confirmPick(ctx: AuthContext, id: string, input: ConfirmPickInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const p = await this.lockedPick(tx, actor, id, 'confirm');
      const lines = await tx.salesPickLine.findMany({
        where: { pickId: id },
        include: { orderLine: { select: { unitPrecision: true } } },
      });
      const given = new Map<string, (typeof input.lines)[number]>();
      for (const l of input.lines) {
        if (given.has(l.lineId)) throw duplicate('lineId');
        given.set(l.lineId, l);
      }
      if (given.size !== lines.length || lines.some((l) => !given.has(l.id))) {
        throw fail(
          422,
          'LINES_INCOMPLETE',
          'Give the picked quantity of every line (0 is allowed).',
        );
      }
      let short = 0;
      for (const l of lines) {
        const g = given.get(l.id)!;
        assertPrecision(g.pickedQuantity, l.orderLine.unitPrecision, l.lineNo);
        const picked = new Decimal(g.pickedQuantity);
        if (picked.gt(l.plannedQuantity)) {
          throw fail(422, 'PICK_EXCEEDS_PLANNED', 'More than planned cannot be picked.', {
            lineNo: l.lineNo,
            planned: l.plannedQuantity.toString(),
          });
        }
        const isShort = picked.lt(l.plannedQuantity);
        if (isShort && !g.discrepancy) {
          throw fail(422, 'DISCREPANCY_REQUIRED', 'Say why less than planned was picked.', {
            lineNo: l.lineNo,
          });
        }
        if (isShort && g.discrepancy === 'OTHER' && !g.discrepancyNote) {
          throw fail(422, 'NOTE_REQUIRED', 'Describe the discrepancy.', { lineNo: l.lineNo });
        }
        if (isShort) short++;
        await tx.salesPickLine.update({
          where: { id: l.id },
          data: {
            pickedQuantity: picked,
            discrepancy: isShort ? g.discrepancy! : null,
            discrepancyNote: isShort ? (g.discrepancyNote ?? null) : null,
          },
        });
      }
      await tx.salesPick.update({
        where: { id },
        data: { status: 'PICKED', pickedAt: new Date(), pickedByMemberId: actor.memberId },
      });
      await this.emit(tx, actor, meta, 'SALES_PICK_CONFIRMED', 'SalesPick', id, {
        number: p.number,
        lines: lines.length,
        shortLines: short,
      });
    });
    return this.getPick(ctx, id);
  }

  /** Cancels a pick before anything of it is packed: its claim returns to the reservation (no movement). */
  async cancelPick(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const p = await this.lockedPick(tx, actor, id, 'cancel');
      if (p.status === 'PICKED') {
        const packed = await tx.salesPickLine.count({
          where: { pickId: id, packedQuantity: { gt: 0 } },
        });
        if (packed) {
          throw fail(
            409,
            'PICK_ALREADY_PACKED',
            'Part of this pick is packed. Cancel those packs first.',
          );
        }
        if (!reason) {
          throw fail(422, 'REASON_REQUIRED', 'Give a reason for cancelling a picked pick.', {
            field: 'reason',
          });
        }
      }
      await tx.salesPick.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      await this.emit(tx, actor, meta, 'SALES_PICK_CANCELLED', 'SalesPick', id, {
        number: p.number,
        from: p.status,
      });
    });
    return this.getPick(ctx, id);
  }

  // ------------------------------------------------------------------ packs

  async listPacks(ctx: AuthContext, q: FulfilmentListInput) {
    const actor = await this.reader(ctx);
    const where = this.listWhere(actor, q) as Prisma.SalesPackWhereInput;
    const [rows, total] = await Promise.all([
      this.db.salesPack.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          branch,
          order: orderRef,
          createdBy: person,
          shipment: { select: { id: true, number: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.db.salesPack.count({ where }),
    ]);
    return page(
      rows.map((p) =>
        PackRow.parse({
          ...this.common(p),
          status: p.status,
          lineCount: p._count.lines,
          packageCount: p.packageCount,
          packageReference: p.packageReference,
          shipment: p.shipment,
        }),
      ),
      total,
      q,
    );
  }

  async getPack(ctx: AuthContext, id: string) {
    const actor = await this.reader(ctx);
    const p = await this.db.salesPack.findFirst({
      where: { id, companyId: actor.access.company.id },
      include: packInclude,
    });
    if (!p || !inBranch(actor, p.branchId)) throw documentNotFound('PACK');
    return this.packView(actor, p);
  }

  private async packView(actor: WarehouseActor, p: FullPack) {
    const actions: ('confirm' | 'cancel' | 'ship')[] = allowedDocActions(
      actor,
      PACK_RULES,
      p,
    ).filter((a) => a !== 'cancel' || !p.shipmentId);
    if (
      p.status === 'PACKED' &&
      !p.shipmentId &&
      actor.fulfilment.pick &&
      p.order.status === 'CONFIRMED'
    ) {
      actions.push('ship');
    }
    return {
      pack: PackView.parse({
        ...this.common(p),
        status: p.status,
        lineCount: p.lines.length,
        packageCount: p.packageCount,
        packageReference: p.packageReference,
        shipment: p.shipment,
        note: p.note,
        packedAt: iso(p.packedAt),
        packedBy: who(p.packedBy),
        dispatchedAt: iso(p.dispatchedAt),
        cancelledAt: iso(p.cancelledAt),
        cancelledBy: who(p.cancelledBy),
        cancellationReason: p.cancellationReason,
        lines: p.lines.map((l) => ({
          id: l.id,
          lineNo: l.lineNo,
          pick: l.pickLine.pick,
          item: itemOf(l.pickLine.itemId, l.orderLine),
          unit: unitOf(l.orderLine),
          location: l.pickLine.location,
          lot: lotView(l.pickLine.lot),
          quantity: l.quantity.toString(),
        })),
        actions,
      }),
      timeline: await timeline(this.db, p.companyId, 'SalesPack', p.id, PACK_TIMELINE),
    };
  }

  /** A pack of picked stock: named pick lines, or everything picked and not yet packed. */
  async createPack(ctx: AuthContext, input: CreatePackInput, meta: RequestMeta) {
    const actor = await this.picker(ctx);
    const id = await this.db.$transaction(async (tx) => {
      const o = await this.lockOrder(tx, actor, input.salesOrderId);
      const picked = await tx.salesPickLine.findMany({
        where: { salesOrderId: o.id, pick: { status: 'PICKED' } },
        include: {
          orderLine: { select: { lineNo: true, unitPrecision: true } },
          pick: { select: { number: true } },
        },
        orderBy: [{ pick: { number: 'asc' } }, { lineNo: 'asc' }],
      });
      const toPack = (l: (typeof picked)[number]) =>
        Decimal.max(ZERO, (l.pickedQuantity ?? ZERO).minus(l.packedQuantity));
      let wanted: { l: (typeof picked)[number]; q: Decimal }[];
      if (input.lines) {
        const seen = new Set<string>();
        wanted = input.lines.map((x, i) => {
          if (seen.has(x.pickLineId)) throw duplicate('pickLineId');
          seen.add(x.pickLineId);
          const l = picked.find((p) => p.id === x.pickLineId);
          if (!l) {
            throw fail(
              409,
              'PICK_LINE_NOT_PACKABLE',
              'Only lines of a picked pick of this order can be packed.',
              {
                lineNo: i + 1,
              },
            );
          }
          assertPrecision(x.quantity, l.orderLine.unitPrecision, i + 1);
          const q = new Decimal(x.quantity);
          if (q.gt(toPack(l))) {
            throw fail(
              409,
              'PACK_EXCEEDS_PICKED',
              'This is more than was picked and not yet packed.',
              {
                lineNo: i + 1,
                available: toPack(l).toString(),
              },
            );
          }
          return { l, q };
        });
      } else {
        wanted = picked.map((l) => ({ l, q: toPack(l) })).filter((x) => x.q.gt(0));
      }
      if (!wanted.length) {
        throw fail(
          409,
          'NOTHING_TO_PACK',
          'Nothing picked for this order is waiting to be packed.',
        );
      }
      const number = await nextNumber(tx, actor.access.company.id, 'PACK', today(actor));
      const p = await tx.salesPack.create({
        data: {
          companyId: actor.access.company.id,
          branchId: o.branchId,
          salesOrderId: o.id,
          number,
          packageCount: input.packageCount ?? 1,
          packageReference: input.packageReference ?? null,
          note: input.note ?? null,
          createdByMemberId: actor.memberId,
        },
      });
      let n = 0;
      for (const { l, q } of wanted) {
        await tx.salesPackLine.create({
          data: {
            companyId: l.companyId,
            salesOrderId: o.id,
            packId: p.id,
            lineNo: ++n,
            pickLineId: l.id,
            salesOrderLineId: l.salesOrderLineId,
            quantity: q,
          },
        });
        // The claim on the pick line (the database CHECK keeps packed ≤ picked).
        await tx.salesPickLine.update({
          where: { id: l.id },
          data: { packedQuantity: { increment: q } },
        });
      }
      await this.emit(tx, actor, meta, 'SALES_PACK_CREATED', 'SalesPack', p.id, {
        number,
        order: o.number,
        lines: wanted.length,
      });
      return p.id;
    });
    return this.getPack(ctx, id);
  }

  private lockedPack(tx: Tx, actor: WarehouseActor, id: string, action: keyof typeof PACK_RULES) {
    return this.lockDoc(tx, actor, 'SalesPack', id, () =>
      tx.salesPack.findFirst({ where: { id, companyId: actor.access.company.id } }),
    ).then((p) => {
      assertDoc(actor, action, PACK_RULES[action], p);
      return p;
    });
  }

  async confirmPack(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const p = await this.lockedPack(tx, actor, id, 'confirm');
      await tx.salesPack.update({
        where: { id },
        data: { status: 'PACKED', packedAt: new Date(), packedByMemberId: actor.memberId },
      });
      await this.emit(tx, actor, meta, 'SALES_PACK_CONFIRMED', 'SalesPack', id, {
        number: p.number,
      });
    });
    return this.getPack(ctx, id);
  }

  /** Cancels a pack that is not in a shipment: its quantities return to "picked, not packed". */
  async cancelPack(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const p = await this.lockedPack(tx, actor, id, 'cancel');
      if (p.shipmentId) {
        throw fail(
          409,
          'PACK_IN_SHIPMENT',
          'This pack is in a shipment. Cancel the shipment first.',
        );
      }
      const lines = await tx.salesPackLine.findMany({ where: { packId: id } });
      for (const l of lines) {
        await tx.salesPickLine.update({
          where: { id: l.pickLineId },
          data: { packedQuantity: { decrement: l.quantity } },
        });
      }
      await tx.salesPack.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      await this.emit(tx, actor, meta, 'SALES_PACK_CANCELLED', 'SalesPack', id, {
        number: p.number,
        from: p.status,
      });
    });
    return this.getPack(ctx, id);
  }

  // ------------------------------------------------------------------ shipments

  async listShipments(ctx: AuthContext, q: FulfilmentListInput) {
    const actor = await this.reader(ctx);
    const where = this.listWhere(actor, q) as Prisma.SalesShipmentWhereInput;
    const [rows, total] = await Promise.all([
      this.db.salesShipment.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          branch,
          order: orderRef,
          createdBy: person,
          _count: { select: { lines: true } },
        },
      }),
      this.db.salesShipment.count({ where }),
    ]);
    return page(
      rows.map((s) => ShipmentRow.parse({ ...this.shipmentRow(s), lineCount: s._count.lines })),
      total,
      q,
    );
  }

  private shipmentRow(
    s: Parameters<FulfilmentService['common']>[0] & {
      status: string;
      shipToName: string;
      carrier: string | null;
      trackingReference: string | null;
      dispatchedAt: Date | null;
      deliveredAt: Date | null;
    },
  ) {
    return {
      ...this.common(s),
      status: s.status,
      shipToName: s.shipToName,
      carrier: s.carrier,
      trackingReference: s.trackingReference,
      dispatchedAt: iso(s.dispatchedAt),
      deliveredAt: iso(s.deliveredAt),
    };
  }

  private async loadShipment(actor: WarehouseActor, id: string) {
    const s = await this.db.salesShipment.findFirst({
      where: { id, companyId: actor.access.company.id },
      include: {
        branch,
        order: orderRef,
        createdBy: person,
        dispatchedBy: person,
        cancelledBy: person,
        packs: shipmentPacks,
        events: shipmentEvents,
        lines: {
          orderBy: { lineNo: 'asc' },
          include: {
            orderLine: lineRef,
            packLine: {
              select: {
                pack: { select: { id: true, number: true } },
                pickLine: {
                  select: {
                    itemId: true,
                    allocationId: true,
                    location: locationRef,
                    lot: lotRef,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!s || !inBranch(actor, s.branchId)) throw documentNotFound('SHIPMENT');
    return s;
  }

  async getShipment(ctx: AuthContext, id: string) {
    const actor = await this.reader(ctx);
    const s = await this.loadShipment(actor, id);
    // A READY shipment: is every line still covered by its ACTIVE reservation?
    let reservationOk: boolean | null = null;
    if (s.status === 'READY') {
      const need = sumBy(
        s.lines,
        (l) => l.packLine.pickLine.allocationId,
        (l) => l.quantity,
      );
      const rows = await this.db.salesAllocation.findMany({
        where: { id: { in: [...need.keys()] } },
        select: { id: true, status: true, quantity: true },
      });
      reservationOk = [...need].every(([aid, q]) => {
        const a = rows.find((r) => r.id === aid);
        return !!a && a.status === 'ACTIVE' && a.quantity.gte(q);
      });
    }
    return {
      shipment: ShipmentView.parse({
        ...this.shipmentRow(s),
        lineCount: s.lines.length,
        shipToAddress: s.shipToAddress,
        note: s.note,
        handedOverTo: s.handedOverTo,
        dispatchedBy: who(s.dispatchedBy),
        cancelledAt: iso(s.cancelledAt),
        cancelledBy: who(s.cancelledBy),
        cancellationReason: s.cancellationReason,
        packs: s.packs,
        lines: s.lines.map((l) => ({
          id: l.id,
          lineNo: l.lineNo,
          pack: l.packLine.pack,
          item: itemOf(l.packLine.pickLine.itemId, l.orderLine),
          unit: unitOf(l.orderLine),
          location: l.packLine.pickLine.location,
          lot: lotView(l.packLine.pickLine.lot),
          quantity: l.quantity.toString(),
          delivered: l.deliveredQuantity.toString(),
          outstanding: l.quantity.minus(l.deliveredQuantity).toString(),
        })),
        reservationOk,
        events: s.events.map((e) => ({
          type: e.type,
          reason: e.reason,
          recipientName: e.recipientName,
          reference: e.reference,
          note: e.note,
          occurredAt: e.occurredAt.toISOString(),
          recordedBy: who(e.recordedBy),
        })),
        actions: allowedDocActions(actor, SHIPMENT_RULES, s),
      }),
      timeline: await timeline(this.db, s.companyId, 'SalesShipment', s.id, SHIPMENT_TIMELINE),
    };
  }

  /** A shipment of PACKED packs not yet shipped (named, or every one of the order). */
  async createShipment(ctx: AuthContext, input: CreateShipmentInput, meta: RequestMeta) {
    const actor = await this.picker(ctx);
    const id = await this.db.$transaction(async (tx) => {
      const o = await this.lockOrder(tx, actor, input.salesOrderId);
      const candidates = await tx.salesPack.findMany({
        where: { salesOrderId: o.id, status: 'PACKED', shipmentId: null },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
        orderBy: { number: 'asc' },
      });
      let packs = candidates;
      if (input.packIds) {
        if (new Set(input.packIds).size !== input.packIds.length) throw duplicate('packIds');
        packs = input.packIds.map((pid) => {
          const p = candidates.find((c) => c.id === pid);
          if (!p) {
            throw fail(
              409,
              'PACK_NOT_SHIPPABLE',
              'Only packed packs of this order that are not shipped can go.',
              {
                packId: pid,
              },
            );
          }
          return p;
        });
      }
      if (!packs.length) {
        throw fail(
          409,
          'NOTHING_TO_SHIP',
          'No packed pack of this order is waiting for a shipment.',
        );
      }
      const number = await nextNumber(tx, actor.access.company.id, 'SHP', today(actor));
      const s = await tx.salesShipment.create({
        data: {
          companyId: actor.access.company.id,
          branchId: o.branchId,
          salesOrderId: o.id,
          number,
          shipToName: input.shipToName ?? o.customerName,
          shipToAddress: input.shipToAddress ?? null,
          carrier: input.carrier ?? null,
          trackingReference: input.trackingReference ?? null,
          note: input.note ?? null,
          createdByMemberId: actor.memberId,
        },
      });
      let n = 0;
      for (const p of packs) {
        for (const l of p.lines) {
          await tx.salesShipmentLine.create({
            data: {
              companyId: l.companyId,
              salesOrderId: o.id,
              shipmentId: s.id,
              lineNo: ++n,
              packLineId: l.id,
              pickLineId: l.pickLineId,
              salesOrderLineId: l.salesOrderLineId,
              quantity: l.quantity,
            },
          });
        }
      }
      await tx.salesPack.updateMany({
        where: { id: { in: packs.map((p) => p.id) } },
        data: { shipmentId: s.id },
      });
      await this.emit(tx, actor, meta, 'SALES_SHIPMENT_CREATED', 'SalesShipment', s.id, {
        number,
        order: o.number,
        packs: packs.length,
        lines: n,
      });
      return s.id;
    });
    return this.getShipment(ctx, id);
  }

  private lockedShipment(
    tx: Tx,
    actor: WarehouseActor,
    id: string,
    action: keyof typeof SHIPMENT_RULES,
  ) {
    return this.lockDoc(tx, actor, 'SalesShipment', id, () =>
      tx.salesShipment.findFirst({ where: { id, companyId: actor.access.company.id } }),
    ).then((s) => {
      assertDoc(actor, action, SHIPMENT_RULES[action], s);
      return s;
    });
  }

  /** READY → CANCELLED: its packs wait for another shipment (nothing was issued). */
  async cancelShipment(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const s = await this.lockedShipment(tx, actor, id, 'cancel');
      await tx.salesPack.updateMany({ where: { shipmentId: id }, data: { shipmentId: null } });
      await tx.salesShipment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      await this.emit(tx, actor, meta, 'SALES_SHIPMENT_CANCELLED', 'SalesShipment', id, {
        number: s.number,
      });
    });
    return this.getShipment(ctx, id);
  }

  /**
   * READY → DISPATCHED — the stock issue point. One transaction: order, shipment,
   * locations (shared; an open count refuses), balances and reservations (id order);
   * per line the exact reservation is CONSUMED (split when partial) and a SALES_ISSUE
   * of the same quantity goes through the ledger (its guard still keeps on hand ≥ what
   * stays reserved). A second dispatch finds the shipment no longer READY.
   */
  async dispatch(ctx: AuthContext, id: string, input: DispatchInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const s = await this.lockedShipment(tx, actor, id, 'dispatch');
      const o = await tx.salesOrder.findUniqueOrThrow({
        where: { id: s.salesOrderId },
        select: { status: true, number: true },
      });
      if (o.status !== 'CONFIRMED') throw notConfirmed(o.status);
      const lines = await tx.salesShipmentLine.findMany({
        where: { shipmentId: id },
        orderBy: { lineNo: 'asc' },
        include: {
          packLine: {
            select: {
              pack: { select: { status: true } },
              pickLine: {
                select: {
                  id: true,
                  allocationId: true,
                  locationId: true,
                  itemId: true,
                  lotId: true,
                  lotKey: true,
                  branchId: true,
                },
              },
            },
          },
          orderLine: { select: { itemCode: true } },
        },
      });
      if (!lines.length) throw fail(422, 'DOCUMENT_EMPTY', 'This shipment has no lines.');
      if (lines.some((l) => l.packLine.pack.status !== 'PACKED')) {
        throw fail(409, 'PACK_NOT_SHIPPABLE', 'Every pack in the shipment must be packed.');
      }
      const ids = lines.map((l) => l.packLine.pickLine);
      await lockLocations(
        tx,
        ids.map((x) => x.locationId),
        'shared',
      );
      // Balance rows, then reservation rows, each in id order (the allocation path locks
      // balances in id order too; nothing locks a reservation before its balance).
      await tx.$queryRaw`
        SELECT b."id" FROM "StockBalance" b
        JOIN unnest(${ids.map((x) => x.locationId)}::text[], ${ids.map((x) => x.itemId)}::text[],
                    ${ids.map((x) => x.lotKey)}::text[]) AS k(loc, item, lot)
          ON b."locationId" = k.loc AND b."itemId" = k.item AND b."lotKey" = k.lot
        ORDER BY b."id" FOR UPDATE OF b`;
      await tx.$queryRaw`
        SELECT "id" FROM "SalesAllocation"
        WHERE "id" = ANY(${[...new Set(ids.map((x) => x.allocationId))]}::text[])
        ORDER BY "id" FOR UPDATE`;
      const now = new Date();
      const a = this.ledger(actor, meta);
      for (const l of lines) {
        const k = l.packLine.pickLine;
        const r = await tx.salesAllocation.findUniqueOrThrow({ where: { id: k.allocationId } });
        if (r.status !== 'ACTIVE' || r.quantity.lt(l.quantity)) {
          throw fail(
            409,
            'RESERVATION_MISMATCH',
            'The reservation behind this line is no longer there in full. Nothing was dispatched.',
            { lineNo: l.lineNo, item: l.orderLine.itemCode },
          );
        }
        // Consume exactly what leaves: the whole row, or split it (history kept on both).
        if (r.quantity.eq(l.quantity)) {
          await tx.salesAllocation.update({
            where: { id: r.id },
            data: {
              status: 'CONSUMED',
              activeSlot: null,
              consumedAt: now,
              salesShipmentLineId: l.id,
            },
          });
        } else {
          await tx.salesAllocation.update({
            where: { id: r.id },
            data: { quantity: { decrement: l.quantity } },
          });
          await tx.salesAllocation.create({
            data: {
              companyId: r.companyId,
              branchId: r.branchId,
              salesOrderId: r.salesOrderId,
              salesOrderLineId: r.salesOrderLineId,
              itemId: r.itemId,
              locationId: r.locationId,
              lotId: r.lotId,
              lotKey: r.lotKey,
              quantity: l.quantity,
              status: 'CONSUMED',
              activeSlot: null,
              createdByMemberId: actor.memberId,
              consumedAt: now,
              salesShipmentLineId: l.id,
              splitFromId: r.id,
            },
          });
        }
        await applyMovement(tx, a, {
          branchId: k.branchId,
          locationId: k.locationId,
          itemId: k.itemId,
          lotId: k.lotId,
          type: 'SALES_ISSUE',
          delta: ZERO.minus(l.quantity),
          source: { sourceType: 'SALES_SHIPMENT', salesShipmentId: id, salesShipmentLineId: l.id },
          occurredAt: now,
          short: () => insufficientStock({ lineNo: l.lineNo, item: l.orderLine.itemCode }),
        });
        await tx.salesPickLine.update({
          where: { id: k.id },
          data: { dispatchedQuantity: { increment: l.quantity } },
        });
      }
      await tx.salesPack.updateMany({
        where: { shipmentId: id },
        data: { status: 'DISPATCHED', dispatchedAt: now },
      });
      await tx.salesShipment.update({
        where: { id },
        data: {
          status: 'DISPATCHED',
          dispatchedAt: now,
          dispatchedByMemberId: actor.memberId,
          handedOverTo: input.handedOverTo ?? null,
          ...(input.note ? { note: input.note } : {}),
        },
      });
      await this.emit(tx, actor, meta, 'SALES_SHIPMENT_DISPATCHED', 'SalesShipment', id, {
        number: s.number,
        order: o.number,
        lines: lines.length,
      });
    });
    return this.getShipment(ctx, id);
  }

  private occurredAt(input: string | undefined, dispatchedAt: Date | null) {
    const at = input ? new Date(input) : new Date();
    if ((dispatchedAt && at < dispatchedAt) || at.getTime() > Date.now() + 5 * 60_000) {
      throw fail(
        422,
        'DELIVERY_TIME_INVALID',
        'The time must be after dispatch and not in the future.',
        {
          field: 'deliveredAt',
        },
      );
    }
    return at;
  }

  /**
   * Delivered (all outstanding, or per line): DELIVERED when nothing is outstanding,
   * otherwise DELIVERY_EXCEPTION with a PARTIALLY_DELIVERED event — the rest stays an
   * explicit outstanding quantity. Never a movement.
   */
  async deliver(ctx: AuthContext, id: string, input: DeliverInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const s = await this.lockedShipment(tx, actor, id, 'deliver');
      const at = this.occurredAt(input.deliveredAt, s.dispatchedAt);
      const lines = await tx.salesShipmentLine.findMany({
        where: { shipmentId: id },
        include: { orderLine: { select: { unitPrecision: true } } },
      });
      const open = (l: (typeof lines)[number]) => l.quantity.minus(l.deliveredQuantity);
      let now: { l: (typeof lines)[number]; q: Decimal }[];
      if (input.lines) {
        const seen = new Set<string>();
        now = input.lines.map((x) => {
          if (seen.has(x.lineId)) throw duplicate('lineId');
          seen.add(x.lineId);
          const l = lines.find((y) => y.id === x.lineId);
          if (!l)
            throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', {
              field: 'lineId',
            });
          assertPrecision(x.quantity, l.orderLine.unitPrecision, l.lineNo);
          const q = new Decimal(x.quantity);
          if (q.gt(open(l))) {
            throw fail(
              409,
              'DELIVERY_EXCEEDS_DISPATCHED',
              'This is more than was dispatched and not yet delivered.',
              {
                lineNo: l.lineNo,
                outstanding: open(l).toString(),
              },
            );
          }
          return { l, q };
        });
      } else {
        now = lines.map((l) => ({ l, q: open(l) })).filter((x) => x.q.gt(0));
      }
      if (!now.length)
        throw fail(409, 'NOTHING_TO_DELIVER', 'Everything in this shipment is delivered.');
      for (const { l, q } of now) {
        await tx.salesShipmentLine.update({
          where: { id: l.id },
          data: { deliveredQuantity: { increment: q } },
        });
      }
      const after = await tx.salesShipmentLine.findMany({
        where: { shipmentId: id },
        select: { quantity: true, deliveredQuantity: true },
      });
      const complete = after.every((l) => l.deliveredQuantity.eq(l.quantity));
      await tx.salesDeliveryEvent.create({
        data: {
          companyId: s.companyId,
          shipmentId: id,
          type: complete ? 'DELIVERED' : 'PARTIALLY_DELIVERED',
          reason: complete ? null : 'PARTIAL_DELIVERY',
          recipientName: input.recipientName ?? null,
          reference: input.reference ?? null,
          note: input.note ?? null,
          occurredAt: at,
          recordedByMemberId: actor.memberId,
        },
      });
      await tx.salesShipment.update({
        where: { id },
        data: complete
          ? { status: 'DELIVERED', deliveredAt: at }
          : { status: 'DELIVERY_EXCEPTION' },
      });
      await this.emit(tx, actor, meta, 'SALES_SHIPMENT_DELIVERED', 'SalesShipment', id, {
        number: s.number,
        complete,
        lines: now.length,
      });
    });
    return this.getShipment(ctx, id);
  }

  /** A failed or troubled delivery: evidence only — stock, reservations and Sales totals stay. */
  async exception(ctx: AuthContext, id: string, input: DeliveryExceptionInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const s = await this.lockedShipment(tx, actor, id, 'exception');
      if (input.reason === 'OTHER' && !input.note) {
        throw fail(422, 'NOTE_REQUIRED', 'Describe what happened.', { field: 'note' });
      }
      const at = this.occurredAt(input.occurredAt, s.dispatchedAt);
      await tx.salesDeliveryEvent.create({
        data: {
          companyId: s.companyId,
          shipmentId: id,
          type: 'EXCEPTION',
          reason: input.reason,
          note: input.note ?? null,
          occurredAt: at,
          recordedByMemberId: actor.memberId,
        },
      });
      await tx.salesShipment.update({ where: { id }, data: { status: 'DELIVERY_EXCEPTION' } });
      await this.emit(tx, actor, meta, 'SALES_SHIPMENT_EXCEPTION', 'SalesShipment', id, {
        number: s.number,
        reason: input.reason,
      });
    });
    return this.getShipment(ctx, id);
  }
}
