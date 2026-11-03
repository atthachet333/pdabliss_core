import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import { recordCompanyEvent, type SalesOrderAuditAction } from '../company/audit.js';
import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { permissionDenied } from '../permissions/guard.js';
import { lineAmounts, money, orderTotals, ZERO, type Decimal } from '../purchasing/money.js';
import { companyDay } from '../purchasing/service.js';
import {
  lineAvailability,
  orderAvailability,
  stockFor,
  stockOf,
  type Stock,
} from './availability.js';
import type {
  Availability,
  CreateSoInput,
  SoLineInput,
  SoListInput,
  UpdateSoInput,
} from './input.js';
import {
  allowedSoActions,
  assertSo,
  canSee,
  inBranch,
  loadSalesActor,
  orderNotFound,
  type SalesActor,
  type SoAction,
} from './policy.js';
import { SoItem, SoRow, SoView } from './views.js';

/*
 * Sales orders (EP33) — docs/SALES_ORDER.md. Commercial demand truth: a
 * customer, items, quantities, selling terms and server-computed totals in one
 * branch. A sales order NEVER writes stock: no StockMovement, no StockBalance,
 * no reservation. Availability is read from the ledger on every response and
 * never stored. Snapshots (customer, item, unit) follow the master while the
 * order is a DRAFT, are refreshed at submit and confirm, and freeze at
 * CONFIRMED; a confirmed order changes only by cancellation.
 */

const person = { select: { user: { select: { fullName: true, email: true } } } } as const;
const include = {
  branch: { select: { id: true, code: true, name: true } },
  createdBy: person,
  submittedBy: person,
  confirmedBy: person,
  cancelledBy: person,
  lines: { orderBy: { lineNo: 'asc' as const } },
} satisfies Prisma.SalesOrderInclude;
type Full = Prisma.SalesOrderGetPayload<{ include: typeof include }>;

const who = (m: { user: { fullName: string | null; email: string } } | null) =>
  m ? { name: m.user.fullName ?? m.user.email } : null;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const asDay = (v: string) => new Date(`${v}T00:00:00Z`);
const places = (q: string) => (q.split('.')[1] ?? '').replace(/0+$/, '').length;
const fail = (status: number, code: string, message: string, details?: object) =>
  new AppError(status, code, message, details);

const TIMELINE: SalesOrderAuditAction[] = [
  'SALES_ORDER_CREATED',
  'SALES_ORDER_SUBMITTED',
  'SALES_ORDER_CONFIRMED',
  'SALES_ORDER_CANCELLED',
];
const OPEN = ['SUBMITTED', 'CONFIRMED'] as const;

export class SalesOrderService {
  constructor(private readonly db: Db) {}

  private today(actor: SalesActor) {
    return companyDay(actor.access.company.timezone);
  }

  private async reader(ctx: AuthContext) {
    const actor = await loadSalesActor(this.db, ctx);
    if (!actor.view) throw permissionDenied('sales.orders.view');
    return actor;
  }

  /** The order's branch for a new order: the selected one, or the member's only one. */
  private workingBranch(actor: SalesActor, ctx: AuthContext) {
    const b =
      actor.branches.find((x) => x.id === ctx.session.branchId) ??
      (actor.branches.length === 1 ? actor.branches[0] : undefined);
    if (!b) throw fail(409, 'BRANCH_SELECTION_REQUIRED', 'Choose the branch you work in first.');
    return b;
  }

  private visibleWhere(actor: SalesActor, branchId?: string): Prisma.SalesOrderWhereInput {
    const ids = actor.branches.map((b) => b.id);
    return {
      companyId: actor.access.company.id,
      branchId: { in: branchId ? ids.filter((b) => b === branchId) : ids },
      ...(actor.confirm
        ? {}
        : { OR: [{ status: { not: 'DRAFT' } }, { createdByMemberId: actor.memberId }] }),
    };
  }

  private async find(actor: SalesActor, id: string) {
    const o = await this.db.salesOrder.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
    if (!o || !canSee(actor, o)) throw orderNotFound();
    return o;
  }

  // ------------------------------------------------------------------ availability

  /** Per-line availability, consuming the branch's stock line by line within the order. */
  private lineStates(o: Pick<Full, 'branchId' | 'status' | 'lines'>, stock: Map<string, Stock>) {
    if (o.status === 'CANCELLED') return o.lines.map(() => null);
    const left = new Map<string, Decimal>();
    return o.lines.map((l) => {
      const s = stockOf(stock, o.branchId, l.itemId);
      const remaining = left.get(l.itemId) ?? s.available;
      const a = lineAvailability(l.inventoryTracked, l.quantity, {
        onHand: s.onHand,
        available: remaining,
      });
      if (l.inventoryTracked)
        left.set(
          l.itemId,
          remaining.minus(l.quantity).isNeg() ? ZERO : remaining.minus(l.quantity),
        );
      return { ...a, available: l.inventoryTracked ? remaining : null };
    });
  }

  private async stockForOrders(actor: SalesActor, orders: Pick<Full, 'branchId' | 'lines'>[]) {
    const pairs = orders.flatMap((o) =>
      o.lines
        .filter((l) => l.inventoryTracked)
        .map((l) => ({ branchId: o.branchId, itemId: l.itemId })),
    );
    return stockFor(this.db, actor.access.company.id, this.today(actor), pairs);
  }

  /** Ids of open (submitted / confirmed) orders in scope with a line short of stock now. */
  private async shortageIds(actor: SalesActor, where: Prisma.SalesOrderWhereInput) {
    const open = await this.db.salesOrder.findMany({
      where: { ...where, status: { in: [...OPEN] } },
      select: { id: true, branchId: true, status: true, lines: { orderBy: { lineNo: 'asc' } } },
      take: 1000,
      orderBy: { updatedAt: 'desc' },
    });
    const stock = await this.stockForOrders(actor, open);
    return open
      .filter((o) => this.lineStates(o, stock).some((a) => a?.shortage && a.shortage.gt(0)))
      .map((o) => o.id);
  }

  // ------------------------------------------------------------------ views

  private row(o: Full, states: ReturnType<SalesOrderService['lineStates']>) {
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      branch: o.branch,
      customer: { id: o.customerId, code: o.customerCode, name: o.customerName },
      orderDate: day(o.orderDate)!,
      requestedDate: day(o.requestedDate),
      lineCount: o.lines.length,
      currency: o.currency,
      grandTotal: money(o.grandTotal)!,
      availability:
        o.status === 'CANCELLED' || !o.lines.length
          ? null
          : orderAvailability(states.map((s): Availability => s?.state ?? 'NOT_STOCK_TRACKED')),
      createdBy: who(o.createdBy),
      updatedAt: o.updatedAt.toISOString(),
    };
  }

  private async view(actor: SalesActor, o: Full) {
    const states = this.lineStates(o, await this.stockForOrders(actor, [o]));
    const timeline = await this.db.auditLog.findMany({
      where: {
        companyId: o.companyId,
        entityType: 'SalesOrder',
        entityId: o.id,
        action: { in: TIMELINE },
      },
      orderBy: { occurredAt: 'asc' },
      include: { actor: { select: { fullName: true, email: true } } },
    });
    return {
      order: SoView.parse({
        ...this.row(o, states),
        customer: {
          id: o.customerId,
          code: o.customerCode,
          name: o.customerName,
          taxId: o.customerTaxId,
          taxBranch: o.customerTaxBranch,
        },
        customerReference: o.customerReference,
        note: o.note,
        subtotal: money(o.subtotal),
        discountTotal: money(o.discountTotal),
        taxTotal: money(o.taxTotal),
        taxTotalLabel: 'exclusive',
        shortageLines: states.filter((s) => s?.shortage?.gt(0)).length,
        createdAt: o.createdAt.toISOString(),
        submittedAt: iso(o.submittedAt),
        submittedBy: who(o.submittedBy),
        confirmedAt: iso(o.confirmedAt),
        confirmedBy: who(o.confirmedBy),
        cancelledAt: iso(o.cancelledAt),
        cancelledBy: who(o.cancelledBy),
        cancellationReason: o.cancellationReason,
        lines: o.lines.map((l, i) => {
          const a = states[i];
          return {
            id: l.id,
            lineNo: l.lineNo,
            item: {
              id: l.itemId,
              code: l.itemCode,
              name: l.itemName,
              type: l.itemType,
              inventoryTracked: l.inventoryTracked,
            },
            unit: { code: l.unitCode, name: l.unitName, precision: l.unitPrecision },
            quantity: l.quantity.toString(),
            unitPrice: l.unitPrice.toString(),
            discountAmount: money(l.discountAmount),
            taxRate: l.taxRate.toString(),
            lineSubtotal: money(l.lineSubtotal),
            lineTax: money(l.lineTax),
            lineTotal: money(l.lineTotal),
            note: l.note,
            availability: a
              ? {
                  state: a.state,
                  onHand: a.onHand?.toString() ?? null,
                  available: a.available?.toString() ?? null,
                  shortage: a.shortage?.toString() ?? null,
                }
              : null,
            progress: {
              ordered: l.quantity.toString(),
              allocated: null,
              picked: null,
              delivered: null,
              outstanding: null,
            },
          };
        }),
        actions: allowedSoActions(actor, o),
      }),
      timeline: timeline.map((e) => ({
        type: e.action,
        at: e.occurredAt.toISOString(),
        actor: e.actor ? { name: e.actor.fullName ?? e.actor.email } : null,
      })),
    };
  }

  // ------------------------------------------------------------------ reads

  async context(ctx: AuthContext) {
    const actor = await this.reader(ctx);
    const selected =
      actor.branches.find((b) => b.id === ctx.session.branchId) ??
      (actor.branches.length === 1 ? actor.branches[0]! : null);
    const where = this.visibleWhere(actor, selected?.id);
    const [drafts, submitted, confirmed, shortage] = await Promise.all([
      this.db.salesOrder.count({
        where: { ...where, status: 'DRAFT', createdByMemberId: actor.memberId },
      }),
      this.db.salesOrder.count({ where: { ...where, status: 'SUBMITTED' } }),
      this.db.salesOrder.count({ where: { ...where, status: 'CONFIRMED' } }),
      this.shortageIds(actor, where).then((ids) => ids.length),
    ]);
    return {
      orders: {
        view: actor.view,
        create: actor.create,
        confirm: actor.confirm,
        cancel: actor.cancel,
      },
      branches: actor.branches,
      selectedBranch: selected,
      counts: {
        myDrafts: drafts,
        awaitingConfirmation: submitted,
        confirmed,
        withShortage: shortage,
      },
      today: this.today(actor),
    };
  }

  async list(ctx: AuthContext, q: SoListInput) {
    const actor = await this.reader(ctx);
    const base = this.visibleWhere(actor, q.branchId);
    const and: Prisma.SalesOrderWhereInput[] = [base];
    if (q.status) and.push({ status: q.status });
    if (q.customerId) and.push({ customerId: q.customerId });
    if (q.from || q.to) {
      and.push({
        orderDate: {
          ...(q.from ? { gte: asDay(q.from) } : {}),
          ...(q.to ? { lte: asDay(q.to) } : {}),
        },
      });
    }
    if (q.q) {
      const c = { contains: q.q, mode: 'insensitive' as const };
      and.push({
        OR: [{ number: c }, { customerName: c }, { customerCode: c }, { customerReference: c }],
      });
    }
    if (q.availability === 'SHORTAGE')
      and.push({ id: { in: await this.shortageIds(actor, base) } });
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      this.db.salesOrder.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include,
      }),
      this.db.salesOrder.count({ where }),
    ]);
    const stock = await this.stockForOrders(actor, rows);
    return {
      items: rows.map((o) => SoRow.parse(this.row(o, this.lineStates(o, stock)))),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: (q.page - 1) * q.pageSize + rows.length < total,
    };
  }

  async get(ctx: AuthContext, id: string) {
    const actor = await this.reader(ctx);
    return this.view(actor, await this.find(actor, id));
  }

  /** Items a sales line can name (active, server search) with the branch's available quantity. */
  async items(ctx: AuthContext, q: { q?: string; branchId?: string }) {
    const actor = await this.reader(ctx);
    const branchId = q.branchId ?? this.workingBranch(actor, ctx).id;
    if (!inBranch(actor, branchId)) {
      throw fail(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
    }
    const c = q.q ? { contains: q.q, mode: 'insensitive' as const } : undefined;
    const items = await this.db.item.findMany({
      where: {
        companyId: actor.access.company.id,
        status: 'ACTIVE',
        ...(c ? { OR: [{ code: c }, { name: c }, { sku: c }, { barcode: c }] } : {}),
      },
      orderBy: { code: 'asc' },
      take: 20,
      include: { baseUnit: true },
    });
    const stock = await stockFor(
      this.db,
      actor.access.company.id,
      this.today(actor),
      items.filter((i) => i.inventoryTracked).map((i) => ({ branchId, itemId: i.id })),
    );
    return {
      items: items.map((i) =>
        SoItem.parse({
          id: i.id,
          code: i.code,
          name: i.name,
          type: i.type,
          inventoryTracked: i.inventoryTracked,
          unit: { code: i.baseUnit.code, name: i.baseUnit.name, precision: i.baseUnit.precision },
          available: i.inventoryTracked
            ? stockOf(stock, branchId, i.id).available.toString()
            : null,
        }),
      ),
    };
  }

  // ------------------------------------------------------------------ validation

  private async customerSnapshot(tx: Prisma.TransactionClient | Db, actor: SalesActor, id: string) {
    const c = await tx.customer.findFirst({ where: { id, companyId: actor.access.company.id } });
    if (!c)
      throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', {
        field: 'customerId',
      });
    if (c.status !== 'ACTIVE') {
      throw fail(422, 'REFERENCE_INACTIVE', 'The selected customer is inactive.', {
        field: 'customerId',
      });
    }
    return {
      customerId: c.id,
      customerCode: c.code,
      customerName: c.name,
      customerTaxId: c.taxId,
      customerTaxBranch: c.taxBranch,
    };
  }

  /** Lines → rows with snapshots and server amounts (active items only, unit precision). */
  private async lineRows(
    tx: Prisma.TransactionClient | Db,
    actor: SalesActor,
    lines: readonly SoLineInput[],
  ) {
    const items = await tx.item.findMany({
      where: {
        companyId: actor.access.company.id,
        id: { in: [...new Set(lines.map((l) => l.itemId))] },
      },
      include: { baseUnit: true },
    });
    return lines.map((l, i) => {
      const lineNo = i + 1;
      const item = items.find((x) => x.id === l.itemId);
      if (!item) {
        throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', {
          field: 'itemId',
          lineNo,
        });
      }
      if (item.status !== 'ACTIVE') {
        throw fail(422, 'REFERENCE_INACTIVE', 'This item is inactive.', {
          field: 'itemId',
          lineNo,
        });
      }
      if (places(l.quantity) > item.baseUnit.precision) {
        throw fail(
          422,
          'QUANTITY_PRECISION',
          'A quantity has more decimal places than its unit allows.',
          {
            lineNo,
            precision: item.baseUnit.precision,
          },
        );
      }
      const discountAmount = l.discountAmount ?? '0';
      const taxRate = l.taxRate ?? '0';
      const amounts = lineAmounts({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount,
        taxRate,
      });
      if (amounts.lineSubtotal.lt(discountAmount)) {
        throw fail(422, 'DISCOUNT_EXCEEDS_SUBTOTAL', 'A discount cannot exceed its line amount.', {
          lineNo,
        });
      }
      return {
        lineNo,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        itemType: item.type,
        inventoryTracked: item.inventoryTracked,
        unitId: item.baseUnitId,
        unitCode: item.baseUnit.code,
        unitName: item.baseUnit.name,
        unitPrecision: item.baseUnit.precision,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount,
        taxRate,
        ...amounts,
        note: l.note ?? null,
      };
    });
  }

  private dates(orderDate: string, requested: string | null) {
    if (requested && requested < orderDate) {
      throw fail(
        422,
        'REQUESTED_DATE_INVALID',
        'The requested date cannot be before the order date.',
        {
          field: 'requestedDate',
        },
      );
    }
  }

  private async replaceLines(
    tx: Prisma.TransactionClient,
    o: { id: string; companyId: string; branchId: string },
    rows: Awaited<ReturnType<SalesOrderService['lineRows']>>,
  ) {
    await tx.salesOrderLine.deleteMany({ where: { salesOrderId: o.id } });
    if (rows.length) {
      await tx.salesOrderLine.createMany({
        data: rows.map((r) => ({
          ...r,
          companyId: o.companyId,
          branchId: o.branchId,
          salesOrderId: o.id,
        })),
      });
    }
    await tx.salesOrder.update({
      where: { id: o.id },
      data: { lineCounter: rows.length, ...orderTotals(rows) },
    });
  }

  private event(
    tx: Prisma.TransactionClient,
    actor: SalesActor,
    meta: RequestMeta,
    action: SalesOrderAuditAction,
    id: string,
    details: Record<string, string | number | boolean | null>,
  ) {
    return recordCompanyEvent(tx, meta, {
      action,
      actorId: actor.access.actor.userId,
      actorScope: 'customer',
      companyId: actor.access.company.id,
      entityType: 'SalesOrder',
      entityId: id,
      details,
    });
  }

  private async locked(
    tx: Prisma.TransactionClient,
    actor: SalesActor,
    id: string,
    action: SoAction,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "SalesOrder" WHERE "id" = ${id} FOR UPDATE`;
    const o = await tx.salesOrder.findFirst({ where: { id, companyId: actor.access.company.id } });
    if (!o || !canSee(actor, o)) throw orderNotFound();
    assertSo(actor, action, o);
    return o;
  }

  // ------------------------------------------------------------------ writes

  async create(ctx: AuthContext, input: CreateSoInput, meta: RequestMeta) {
    const actor = await loadSalesActor(this.db, ctx);
    if (!actor.create) throw permissionDenied('sales.orders.create');
    const branch = this.workingBranch(actor, ctx);
    const orderDate = input.orderDate ?? this.today(actor);
    this.dates(orderDate, input.requestedDate ?? null);
    const customer = await this.customerSnapshot(this.db, actor, input.customerId);
    const rows = await this.lineRows(this.db, actor, input.lines ?? []);
    const companyId = actor.access.company.id;
    const id = await this.db.$transaction(async (tx) => {
      const period = orderDate.slice(0, 7).replace('-', '');
      const seq = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
        VALUES (${companyId}, ${`SO:${period}`}, 1, NOW())
        ON CONFLICT ("companyId", "key")
        DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue"`;
      const number = `SO-${period}-${String(seq[0]!.lastValue).padStart(6, '0')}`;
      const o = await tx.salesOrder.create({
        data: {
          companyId,
          branchId: branch.id,
          number,
          ...customer,
          orderDate: asDay(orderDate),
          requestedDate: input.requestedDate ? asDay(input.requestedDate) : null,
          customerReference: input.customerReference ?? null,
          note: input.note ?? null,
          createdByMemberId: actor.memberId,
        },
      });
      await this.replaceLines(tx, o, rows);
      await this.event(tx, actor, meta, 'SALES_ORDER_CREATED', o.id, {
        number,
        lines: rows.length,
      });
      return o.id;
    });
    return this.get(ctx, id);
  }

  async update(ctx: AuthContext, id: string, input: UpdateSoInput, meta: RequestMeta) {
    const actor = await loadSalesActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const o = await this.locked(tx, actor, id, 'edit');
      const orderDate = input.orderDate ?? day(o.orderDate)!;
      const requested =
        input.requestedDate !== undefined ? input.requestedDate : day(o.requestedDate);
      this.dates(orderDate, requested);
      const customer = await this.customerSnapshot(tx, actor, input.customerId ?? o.customerId);
      await tx.salesOrder.update({
        where: { id },
        data: {
          ...customer,
          orderDate: asDay(orderDate),
          requestedDate: requested ? asDay(requested) : null,
          ...(input.customerReference !== undefined
            ? { customerReference: input.customerReference }
            : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
        },
      });
      await this.event(tx, actor, meta, 'SALES_ORDER_UPDATED', id, {
        number: o.number,
        fields: Object.keys(input).sort().join(','),
      });
    });
    return this.get(ctx, id);
  }

  async saveLines(ctx: AuthContext, id: string, lines: SoLineInput[], meta: RequestMeta) {
    const actor = await loadSalesActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const o = await this.locked(tx, actor, id, 'edit');
      await this.replaceLines(tx, o, await this.lineRows(tx, actor, lines));
      await this.event(tx, actor, meta, 'SALES_ORDER_UPDATED', id, {
        number: o.number,
        lines: lines.length,
      });
    });
    return this.get(ctx, id);
  }

  /**
   * Re-validate against the master now (active customer and items, precision)
   * and refresh the snapshots — used by submit and confirm.
   */
  private async refresh(
    tx: Prisma.TransactionClient,
    actor: SalesActor,
    o: { id: string; companyId: string; branchId: string; customerId: string },
  ) {
    const lines = await tx.salesOrderLine.findMany({
      where: { salesOrderId: o.id },
      orderBy: { lineNo: 'asc' },
    });
    if (!lines.length) throw fail(422, 'SO_EMPTY', 'Add at least one line first.');
    const customer = await this.customerSnapshot(tx, actor, o.customerId);
    const rows = await this.lineRows(
      tx,
      actor,
      lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        discountAmount: l.discountAmount.toString(),
        taxRate: l.taxRate.toString(),
        note: l.note,
      })),
    );
    await tx.salesOrder.update({ where: { id: o.id }, data: customer });
    await this.replaceLines(tx, o, rows);
    return rows.length;
  }

  async submit(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadSalesActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const o = await this.locked(tx, actor, id, 'submit');
      const n = await this.refresh(tx, actor, o);
      await tx.salesOrder.update({
        where: { id },
        data: { status: 'SUBMITTED', submittedAt: new Date(), submittedByMemberId: actor.memberId },
      });
      await this.event(tx, actor, meta, 'SALES_ORDER_SUBMITTED', id, {
        number: o.number,
        from: 'DRAFT',
        to: 'SUBMITTED',
        lines: n,
      });
    });
    return this.get(ctx, id);
  }

  /** SUBMITTED → CONFIRMED: snapshots refreshed one last time, then frozen. No stock effect. */
  async confirm(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadSalesActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const o = await this.locked(tx, actor, id, 'confirm');
      const n = await this.refresh(tx, actor, o);
      await tx.salesOrder.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedByMemberId: actor.memberId },
      });
      await this.event(tx, actor, meta, 'SALES_ORDER_CONFIRMED', id, {
        number: o.number,
        from: 'SUBMITTED',
        to: 'CONFIRMED',
        lines: n,
      });
    });
    return this.get(ctx, id);
  }

  /** A draft (its creator, reason optional) or a submitted / confirmed order (manager, reason). */
  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadSalesActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const o = await this.locked(tx, actor, id, 'cancel');
      if (o.status !== 'DRAFT' && !reason) {
        throw fail(422, 'REASON_REQUIRED', 'Give a reason for cancelling.', { field: 'reason' });
      }
      await tx.salesOrder.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      await this.event(tx, actor, meta, 'SALES_ORDER_CANCELLED', id, {
        number: o.number,
        from: o.status,
        to: 'CANCELLED',
      });
    });
    return this.get(ctx, id);
  }
}
