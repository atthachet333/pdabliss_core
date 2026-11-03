import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import type { Db, Prisma } from '../db/client.js';
import { permissionDenied } from '../permissions/guard.js';
import { Decimal } from '../purchasing/money.js';
import {
  asDay,
  assertLotIdentity,
  assertPrecision,
  branchFilter,
  dateWhere,
  day,
  fail,
  iso,
  itemRef,
  itemsOf,
  itemView,
  knownLot,
  ledgerActor,
  locationRef,
  locationsOf,
  lockRow,
  lotOf,
  lotRef,
  lotView,
  nextNumber,
  page,
  person,
  timeline,
  today,
  who,
} from './documents.js';
import type {
  CountEntriesInput,
  CountLineInput,
  CreateCountInput,
  DocListInput,
  UpdateCountInput,
} from './input.js';
import { applyMovement, event, lockLocations, resolveLot } from './ledger.js';
import {
  allowedDocActions,
  assertDoc,
  COUNT_RULES,
  documentNotFound,
  inBranch,
  loadWarehouseActor,
  type WarehouseActor,
} from './policy.js';
import { CountRow, CountView } from './views.js';

/*
 * Cycle counts (EP32) — docs/CYCLE_COUNT.md. Physical counting of the stock of
 * some locations of one branch (optionally one item):
 *
 *   DRAFT ──start──▶ COUNTING ──review──▶ REVIEW ──post──▶ POSTED
 *     (cancel before POSTED)        ◀──reopen──┘
 *
 * START takes the scope's locations EXCLUSIVELY (ledger.ts lockLocations —
 * it waits for stock writes in flight) and snapshots every on-hand balance in
 * scope as an expected line (systemQuantity). From then until posting or
 * cancelling, the scope is LOCKED: any movement on those locations (for the
 * counted item, or every item) is refused by the ledger (COUNT_IN_PROGRESS) —
 * receipts, transfers, adjustments alike. Counters record counted quantities
 * (0 is a real count) and may add stock the system did not show. POST (a
 * manager) takes the locations exclusively again, refuses a stale count
 * (COUNT_STALE: a balance differs from its snapshot, or stock appeared in
 * scope) and writes one COUNT_CORRECTION (counted − system, signed) per line
 * that differs. A posted count is final; a later correction is an adjustment
 * or a new count.
 */

const include = {
  branch: { select: { id: true, code: true, name: true } },
  item: { select: { id: true, code: true, name: true } },
  locations: { include: { location: locationRef } },
  createdBy: person,
  startedBy: person,
  postedBy: person,
  cancelledBy: person,
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: { item: itemRef, lot: lotRef, location: locationRef, countedBy: person },
  },
} satisfies Prisma.CycleCountInclude;
type Full = Prisma.CycleCountGetPayload<{ include: typeof include }>;

const TIMELINE = [
  'CYCLE_COUNT_CREATED',
  'CYCLE_COUNT_STARTED',
  'CYCLE_COUNT_REVIEWED',
  'CYCLE_COUNT_REOPENED',
  'CYCLE_COUNT_POSTED',
  'CYCLE_COUNT_CANCELLED',
];

const variance = (l: { systemQuantity: Decimal; countedQuantity: Decimal | null }) =>
  l.countedQuantity === null ? null : l.countedQuantity.minus(l.systemQuantity);

export class CountService {
  constructor(private readonly db: Db) {}

  private async reader(ctx: AuthContext) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.inventory.view) throw permissionDenied('warehouse.inventory.view');
    return actor;
  }

  private async find(actor: WarehouseActor, id: string) {
    const c = await this.db.cycleCount.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
    if (!c || !inBranch(actor, c.branchId)) throw documentNotFound('COUNT');
    return c;
  }

  private row(c: Full) {
    return {
      id: c.id,
      number: c.number,
      status: c.status,
      branch: c.branch,
      locations: c.locations.map((s) => s.location).sort((a, b) => a.code.localeCompare(b.code)),
      item: c.item,
      countDate: day(c.countDate)!,
      lineCount: c.lines.length,
      countedLines: c.lines.filter((l) => l.countedQuantity !== null).length,
      varianceLines: c.lines.filter((l) => variance(l)?.isZero() === false).length,
      createdBy: who(c.createdBy),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private async view(actor: WarehouseActor, c: Full) {
    return {
      count: CountView.parse({
        ...this.row(c),
        note: c.note,
        createdAt: c.createdAt.toISOString(),
        startedAt: iso(c.startedAt),
        startedBy: who(c.startedBy),
        reviewAt: iso(c.reviewAt),
        postedAt: iso(c.postedAt),
        postedBy: who(c.postedBy),
        cancelledAt: iso(c.cancelledAt),
        cancelledBy: who(c.cancelledBy),
        cancellationReason: c.cancellationReason,
        lines: c.lines.map((l) => ({
          id: l.id,
          lineNo: l.lineNo,
          location: l.location,
          ...itemView(l.item),
          lot: lotView(l.lot),
          newLot: l.newLotNumber
            ? { lotNumber: l.newLotNumber, expiryDate: day(l.newLotExpiry) }
            : null,
          expected: l.expected,
          systemQuantity: l.systemQuantity.toString(),
          countedQuantity: l.countedQuantity?.toString() ?? null,
          variance: variance(l)?.toString() ?? null,
          countedBy: who(l.countedBy),
          countedAt: iso(l.countedAt),
          note: l.note,
        })),
        actions: allowedDocActions(actor, COUNT_RULES, c),
      }),
      timeline: await timeline(this.db, c.companyId, 'CycleCount', c.id, TIMELINE),
    };
  }

  async list(ctx: AuthContext, q: DocListInput) {
    const actor = await this.reader(ctx);
    const where: Prisma.CycleCountWhereInput = {
      companyId: actor.access.company.id,
      branchId: branchFilter(actor, q.branchId),
      ...(q.status ? { status: q.status as 'DRAFT' } : {}),
      ...(q.locationId ? { locations: { some: { locationId: q.locationId } } } : {}),
      ...(q.q ? { number: { contains: q.q, mode: 'insensitive' } } : {}),
      ...(dateWhere(q.from, q.to) ? { countDate: dateWhere(q.from, q.to) } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.cycleCount.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include,
      }),
      this.db.cycleCount.count({ where }),
    ]);
    return page(
      rows.map((c) => CountRow.parse(this.row(c))),
      total,
      q,
    );
  }

  async get(ctx: AuthContext, id: string) {
    const actor = await this.reader(ctx);
    return this.view(actor, await this.find(actor, id));
  }

  /** Scope: ACTIVE locations of one branch the member has; an optional stock item. */
  private async scope(
    tx: Prisma.TransactionClient | Db,
    actor: WarehouseActor,
    locationIds: readonly string[],
    itemId: string | null | undefined,
  ) {
    const map = await locationsOf(tx, actor, locationIds, { active: true });
    const branches = new Set([...map.values()].map((l) => l.branchId));
    if (branches.size !== 1)
      throw fail(422, 'CROSS_BRANCH', 'A count covers locations of one branch.');
    if (itemId) await itemsOf(tx, actor.access.company.id, [itemId]);
    return [...branches][0]!;
  }

  async create(ctx: AuthContext, input: CreateCountInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    if (!actor.counts.create) throw permissionDenied('warehouse.counts.create');
    const branchId = await this.scope(this.db, actor, input.locationIds, input.itemId);
    const onDay = today(actor);
    const id = await this.db.$transaction(async (tx) => {
      const number = await nextNumber(tx, actor.access.company.id, 'CC', onDay);
      const c = await tx.cycleCount.create({
        data: {
          companyId: actor.access.company.id,
          branchId,
          number,
          itemId: input.itemId ?? null,
          note: input.note ?? null,
          countDate: asDay(input.countDate ?? onDay),
          createdByMemberId: actor.memberId,
        },
      });
      await tx.cycleCountLocation.createMany({
        data: [...new Set(input.locationIds)].map((locationId) => ({
          cycleCountId: c.id,
          companyId: c.companyId,
          branchId,
          locationId,
        })),
      });
      await event(tx, ledgerActor(actor, meta), 'CYCLE_COUNT_CREATED', 'CycleCount', c.id, {
        number,
        locations: input.locationIds.length,
      });
      return c.id;
    });
    return this.get(ctx, id);
  }

  private async locked(
    tx: Prisma.TransactionClient,
    actor: WarehouseActor,
    id: string,
    action: keyof typeof COUNT_RULES,
  ) {
    await lockRow(tx, 'CycleCount', id);
    const c = await tx.cycleCount.findFirst({
      where: { id, companyId: actor.access.company.id },
      include: { locations: true },
    });
    if (!c || !inBranch(actor, c.branchId)) throw documentNotFound('COUNT');
    assertDoc(actor, action, COUNT_RULES[action], c);
    return c;
  }

  async update(ctx: AuthContext, id: string, input: UpdateCountInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const c = await this.locked(tx, actor, id, 'edit');
      const locationIds = input.locationIds ?? c.locations.map((s) => s.locationId);
      const itemId = input.itemId !== undefined ? input.itemId : c.itemId;
      const branchId = await this.scope(tx, actor, locationIds, itemId);
      if (branchId !== c.branchId) throw fail(422, 'CROSS_BRANCH', 'A count stays in its branch.');
      if (input.locationIds) {
        await tx.cycleCountLocation.deleteMany({ where: { cycleCountId: id } });
        await tx.cycleCountLocation.createMany({
          data: [...new Set(locationIds)].map((locationId) => ({
            cycleCountId: id,
            companyId: c.companyId,
            branchId,
            locationId,
          })),
        });
      }
      await tx.cycleCount.update({
        where: { id },
        data: {
          itemId,
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.countDate ? { countDate: asDay(input.countDate) } : {}),
        },
      });
      await event(tx, ledgerActor(actor, meta), 'CYCLE_COUNT_UPDATED', 'CycleCount', id, {
        number: c.number,
        locations: locationIds.length,
      });
    });
    return this.get(ctx, id);
  }

  /**
   * DRAFT → COUNTING: lock the scope's locations exclusively (writes in flight
   * finish first), refuse an overlapping active count, snapshot on-hand stock.
   */
  async start(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const c = await this.locked(tx, actor, id, 'start');
      const locationIds = c.locations.map((s) => s.locationId);
      await this.scope(tx, actor, locationIds, c.itemId);
      await lockLocations(tx, locationIds, 'exclusive');
      const overlap = await tx.cycleCount.findFirst({
        where: {
          companyId: c.companyId,
          id: { not: c.id },
          status: { in: ['COUNTING', 'REVIEW'] },
          locations: { some: { locationId: { in: locationIds } } },
          ...(c.itemId ? { OR: [{ itemId: null }, { itemId: c.itemId }] } : {}),
        },
        select: { number: true },
      });
      if (overlap) {
        throw fail(409, 'COUNT_OVERLAP', 'Another count is already counting this stock.', {
          count: overlap.number,
        });
      }
      const balances = await tx.stockBalance.findMany({
        where: {
          locationId: { in: locationIds },
          quantityOnHand: { gt: 0 },
          ...(c.itemId ? { itemId: c.itemId } : {}),
        },
        include: {
          location: { select: { code: true } },
          item: { select: { code: true } },
          lot: { select: { lotNumber: true } },
        },
      });
      balances.sort(
        (a, b) =>
          a.location.code.localeCompare(b.location.code) ||
          a.item.code.localeCompare(b.item.code) ||
          (a.lot?.lotNumber ?? '').localeCompare(b.lot?.lotNumber ?? ''),
      );
      await tx.cycleCountLine.createMany({
        data: balances.map((b, i) => ({
          companyId: c.companyId,
          branchId: c.branchId,
          cycleCountId: c.id,
          lineNo: i + 1,
          locationId: b.locationId,
          itemId: b.itemId,
          lotId: b.lotId,
          lotKey: b.lotKey,
          expected: true,
          systemQuantity: b.quantityOnHand,
        })),
      });
      await tx.cycleCount.update({
        where: { id },
        data: {
          status: 'COUNTING',
          startedAt: new Date(),
          startedByMemberId: actor.memberId,
          lineCounter: balances.length,
        },
      });
      await event(tx, ledgerActor(actor, meta), 'CYCLE_COUNT_STARTED', 'CycleCount', id, {
        number: c.number,
        from: 'DRAFT',
        to: 'COUNTING',
        lines: balances.length,
      });
    });
    return this.get(ctx, id);
  }

  /** Counted quantities, many lines at once (COUNTING only; 0 is a count, null clears). */
  async enter(ctx: AuthContext, id: string, input: CountEntriesInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const c = await this.locked(tx, actor, id, 'count');
      const lines = await tx.cycleCountLine.findMany({
        where: { cycleCountId: id, id: { in: input.entries.map((e) => e.lineId) } },
        include: { item: { select: { baseUnit: { select: { precision: true } } } } },
      });
      const now = new Date();
      for (const e of input.entries) {
        const l = lines.find((x) => x.id === e.lineId);
        if (!l) throw fail(404, 'COUNT_LINE_NOT_FOUND', 'This count line was not found.');
        if (e.countedQuantity !== null) {
          assertPrecision(e.countedQuantity, l.item.baseUnit.precision, l.lineNo);
        }
        await tx.cycleCountLine.update({
          where: { id: l.id },
          data: {
            countedQuantity: e.countedQuantity,
            countedAt: e.countedQuantity === null ? null : now,
            countedByMemberId: e.countedQuantity === null ? null : actor.memberId,
            ...(e.note !== undefined ? { note: e.note } : {}),
          },
        });
      }
      await tx.cycleCount.update({ where: { id }, data: { updatedAt: now } });
      await event(tx, ledgerActor(actor, meta), 'CYCLE_COUNT_COUNTED', 'CycleCount', id, {
        number: c.number,
        lines: input.entries.length,
      });
    });
    return this.get(ctx, id);
  }

  /** Stock found that the count did not expect (system 0): a location in scope, the item's lot rules. */
  async addLine(ctx: AuthContext, id: string, input: CountLineInput, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const c = await this.locked(tx, actor, id, 'count');
      if (!c.locations.some((s) => s.locationId === input.locationId)) {
        throw fail(422, 'OUT_OF_SCOPE', 'This location is not part of the count.', {
          field: 'locationId',
        });
      }
      if (c.itemId && c.itemId !== input.itemId) {
        throw fail(422, 'OUT_OF_SCOPE', 'This count covers another item.', { field: 'itemId' });
      }
      const item = (await itemsOf(tx, c.companyId, [input.itemId])).get(input.itemId)!;
      const lineNo = c.lineCounter + 1;
      assertPrecision(input.countedQuantity, item.baseUnit.precision, lineNo);
      assertLotIdentity(item, input, { lineNo, allowNew: true, today: today(actor) });
      if (input.lotId) await lotOf(tx, c.companyId, input.itemId, input.lotId);
      if (input.newLotNumber) {
        const known = await knownLot(
          tx,
          c.companyId,
          input.itemId,
          input.newLotNumber,
          input.newLotExpiry ?? null,
          lineNo,
        );
        if (known)
          throw fail(422, 'LOT_EXISTS', 'This lot is already known: choose it instead.', {
            lotId: known.id,
          });
      }
      const lotKey = input.lotId ?? (input.newLotNumber ? `new:${input.newLotNumber}` : '');
      const dup = await tx.cycleCountLine.findFirst({
        where: { cycleCountId: id, locationId: input.locationId, itemId: input.itemId, lotKey },
      });
      if (dup)
        throw fail(409, 'DUPLICATE_LINE', 'This stock is already on the count.', {
          lineNo: dup.lineNo,
        });
      await tx.cycleCountLine.create({
        data: {
          companyId: c.companyId,
          branchId: c.branchId,
          cycleCountId: id,
          lineNo,
          locationId: input.locationId,
          itemId: input.itemId,
          lotId: input.lotId ?? null,
          newLotNumber: input.newLotNumber ?? null,
          newLotExpiry: input.newLotExpiry ? asDay(input.newLotExpiry) : null,
          lotKey,
          expected: false,
          systemQuantity: 0,
          countedQuantity: input.countedQuantity,
          countedAt: new Date(),
          countedByMemberId: actor.memberId,
          note: input.note ?? null,
        },
      });
      await tx.cycleCount.update({ where: { id }, data: { lineCounter: lineNo } });
      await event(tx, ledgerActor(actor, meta), 'CYCLE_COUNT_COUNTED', 'CycleCount', id, {
        number: c.number,
        lineNo,
        unexpected: true,
      });
    });
    return this.get(ctx, id);
  }

  /** COUNTING → REVIEW (every line counted) and REVIEW → COUNTING (reopen). */
  async review(ctx: AuthContext, id: string, reopen: boolean, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const c = await this.locked(tx, actor, id, reopen ? 'reopen' : 'review');
      if (!reopen) {
        const open = await tx.cycleCountLine.count({
          where: { cycleCountId: id, countedQuantity: null },
        });
        if (open)
          throw fail(422, 'COUNT_INCOMPLETE', 'Count every line first.', { uncounted: open });
      }
      await tx.cycleCount.update({
        where: { id },
        data: reopen ? { status: 'COUNTING' } : { status: 'REVIEW', reviewAt: new Date() },
      });
      await event(
        tx,
        ledgerActor(actor, meta),
        reopen ? 'CYCLE_COUNT_REOPENED' : 'CYCLE_COUNT_REVIEWED',
        'CycleCount',
        id,
        { number: c.number, from: c.status, to: reopen ? 'COUNTING' : 'REVIEW' },
      );
    });
    return this.get(ctx, id);
  }

  /**
   * REVIEW → POSTED: under exclusive location locks, refuse a stale count
   * (COUNT_STALE), then one signed COUNT_CORRECTION per differing line.
   */
  async post(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const c = await this.locked(tx, actor, id, 'post');
      const locationIds = c.locations.map((s) => s.locationId);
      await lockLocations(tx, locationIds, 'exclusive');
      const lines = await tx.cycleCountLine.findMany({
        where: { cycleCountId: id },
        orderBy: { lineNo: 'asc' },
        include: { item: { select: { code: true } } },
      });
      // Stale? Every expected balance must still be what was snapshotted, and
      // no stock may have appeared in scope that the count does not cover.
      const balances = await tx.stockBalance.findMany({
        where: { locationId: { in: locationIds }, ...(c.itemId ? { itemId: c.itemId } : {}) },
      });
      const keyOf = (x: { locationId: string; itemId: string; lotKey: string }) =>
        `${x.locationId}/${x.itemId}/${x.lotKey}`;
      const byKey = new Map(balances.map((b) => [keyOf(b), b.quantityOnHand]));
      const covered = new Set(lines.filter((l) => l.expected).map(keyOf));
      for (const l of lines.filter((x) => x.expected)) {
        const now = byKey.get(keyOf(l)) ?? new Decimal(0);
        if (!now.eq(l.systemQuantity)) {
          throw fail(
            409,
            'COUNT_STALE',
            'Stock changed since the count started; it cannot be posted.',
            {
              lineNo: l.lineNo,
            },
          );
        }
      }
      for (const b of balances) {
        if (b.quantityOnHand.gt(0) && !covered.has(keyOf(b))) {
          throw fail(409, 'COUNT_STALE', 'Stock appeared in the count scope since it started.');
        }
      }
      const a = ledgerActor(actor, meta);
      const now = new Date();
      let corrections = 0;
      for (const l of lines) {
        const v = variance(l);
        if (v === null) throw fail(422, 'COUNT_INCOMPLETE', 'Count every line first.');
        if (v.isZero()) continue;
        let lotId = l.lotId;
        if (l.newLotNumber) {
          const lot = await resolveLot(tx, a, l.itemId, l.newLotNumber, day(l.newLotExpiry), null);
          lotId = lot.id;
          if (lot.created) {
            await event(tx, a, 'INVENTORY_LOT_CREATED', 'InventoryLot', lot.id, {
              number: l.newLotNumber,
              item: l.item.code,
              count: c.number,
            });
          }
        }
        await applyMovement(tx, a, {
          branchId: c.branchId,
          locationId: l.locationId,
          itemId: l.itemId,
          lotId,
          type: 'COUNT_CORRECTION',
          delta: v,
          source: { sourceType: 'CYCLE_COUNT', cycleCountId: c.id, cycleCountLineId: l.id },
          occurredAt: now,
          ownCountId: c.id,
        });
        corrections++;
      }
      await tx.cycleCount.update({
        where: { id },
        data: { status: 'POSTED', postedAt: now, postedByMemberId: actor.memberId },
      });
      await event(tx, a, 'CYCLE_COUNT_POSTED', 'CycleCount', id, {
        number: c.number,
        from: 'REVIEW',
        to: 'POSTED',
        lines: lines.length,
        corrections,
      });
    });
    return this.get(ctx, id);
  }

  /** Before posting: CANCELLED, the scope released, no stock effect. */
  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadWarehouseActor(this.db, ctx);
    await this.find(actor, id);
    await this.db.$transaction(async (tx) => {
      const c = await this.locked(tx, actor, id, 'cancel');
      await tx.cycleCount.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      await event(tx, ledgerActor(actor, meta), 'CYCLE_COUNT_CANCELLED', 'CycleCount', id, {
        number: c.number,
        from: c.status,
        to: 'CANCELLED',
      });
    });
    return this.get(ctx, id);
  }
}
