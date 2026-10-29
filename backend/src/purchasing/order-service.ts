import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import { recordCompanyEvent, type PurchaseOrderAuditAction } from '../company/audit.js';
import type { Db, Prisma } from '../db/client.js';
import type { PurchaseOrderStatus } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import { permissionDenied } from '../permissions/guard.js';
import { depositAmount, Decimal, exact, lineAmounts, money, orderTotals, ZERO } from './money.js';
import type {
  CreateOrderInput,
  DepositInput,
  LineUpdateInput,
  NewLineInput,
  OrderListInput,
  QueueInput,
  UpdateOrderInput,
} from './order-input.js';
import {
  assertPo,
  loadPoActor,
  orderNotFound,
  orderStateChanged,
  poAllowedActions,
  type PoAction,
  type PoActor,
} from './order-policy.js';
import { ORDERED_STATUSES, orderedQuantities } from './ordering.js';
import {
  AccountingDepositRow,
  AccountingDepositView,
  ExecutivePOView,
  PurchasingPOView,
  WarehousePendingReceiveRow,
  WarehousePendingReceiveView,
} from './order-views.js';
import { companyDay } from './service.js';

/*
 * Purchase orders, deposits and pending receive (EP30) — docs/PURCHASE_ORDER.md.
 *
 * An order is created from an APPROVED purchase request, in that request's
 * branch, and orders some or all of its lines. Ordered / remaining quantities
 * are DERIVED: ordered = Σ quantity on issued, not-cancelled orders; remaining
 * = requested − ordered (the request's quantities are never changed). Drafts
 * reserve nothing; ISSUE re-checks every line under row locks on the request
 * lines, so two orders issued at once can never exceed what was requested.
 * Cancelling an issued order releases its quantities (they stop counting).
 *
 * Every response goes through an audience allow-list (order-views.ts):
 * Warehouse never receives a price, discount, tax, total, deposit or terms —
 * not even through a direct API call.
 */

const person = { select: { user: { select: { fullName: true, email: true } } } } as const;

const include = {
  branch: { select: { id: true, code: true, name: true } },
  supplier: {
    select: {
      id: true,
      status: true,
      code: true,
      name: true,
      taxId: true,
      taxBranch: true,
      address: true,
      contactName: true,
      phone: true,
      email: true,
    },
  },
  createdBy: person,
  issuedBy: person,
  cancelledBy: person,
  depositConfirmedBy: person,
  depositWaivedBy: person,
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: {
      item: { select: { status: true } },
      requestLine: { select: { quantity: true } },
    },
  },
} satisfies Prisma.PurchaseOrderInclude;

type Full = Prisma.PurchaseOrderGetPayload<{ include: typeof include }>;

const who = (m: { user: { fullName: string | null; email: string } } | null) =>
  m ? { name: m.user.fullName ?? m.user.email } : null;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const toDay = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00Z`) : null);

const decimals = (q: string) => (q.split('.')[1] ?? '').replace(/0+$/, '').length;

async function nextOrderNumber(tx: Prisma.TransactionClient, companyId: string, period: string) {
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
    VALUES (${companyId}, ${`PO:${period}`}, 1, NOW())
    ON CONFLICT ("companyId", "key")
    DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
    RETURNING "lastValue"`;
  return `PO-${period}-${String(rows[0]!.lastValue).padStart(6, '0')}`;
}

const lockOrder = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${id} FOR UPDATE`;

/** A request may not be cancelled or change state while an order line is placed against it. */
const shareRequests = (tx: Prisma.TransactionClient, ids: string[]) =>
  tx.$queryRaw`SELECT "id" FROM "PurchaseRequest" WHERE "id" = ANY(${[...ids].sort()}) ORDER BY "id" FOR SHARE`;

/** Serializes issues against the same request lines (sorted: no deadlock between two issues). */
const lockRequestLines = (tx: Prisma.TransactionClient, ids: string[]) =>
  tx.$queryRaw`SELECT "id" FROM "PurchaseRequestLine" WHERE "id" = ANY(${[...ids].sort()}) ORDER BY "id" FOR UPDATE`;

const refNotFound = (field: string) =>
  new AppError(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', { field });
const refInactive = (field: string) =>
  new AppError(409, 'REFERENCE_INACTIVE', 'The selected record is inactive.', { field });
const exceedsRemaining = (remaining: Decimal, lineNo?: number) =>
  new AppError(
    409,
    'PO_QUANTITY_EXCEEDS_REMAINING',
    'This quantity is more than the request still has to order.',
    { remaining: remaining.toString(), ...(lineNo ? { lineNo } : {}) },
  );

const LIFECYCLE: PurchaseOrderAuditAction[] = [
  'PURCHASE_ORDER_CREATED',
  'PURCHASE_ORDER_ISSUED',
  'PURCHASE_ORDER_DEPOSIT_CONFIRMED',
  'PURCHASE_ORDER_DEPOSIT_WAIVED',
  'PURCHASE_ORDER_CANCELLED',
];

type RequestLine = Prisma.PurchaseRequestLineGetPayload<{
  include: { request: true; unit: true; item: { include: { baseUnit: true } } };
}>;

export class PurchaseOrderService {
  constructor(private readonly db: Db) {}

  private event(
    tx: Prisma.TransactionClient,
    meta: RequestMeta,
    actor: PoActor,
    action: PurchaseOrderAuditAction,
    id: string,
    details: Record<string, string | number | boolean | null | readonly string[]>,
  ) {
    return recordCompanyEvent(tx, meta, {
      action,
      actorId: actor.access.actor.userId,
      actorScope: 'customer',
      companyId: actor.access.company.id,
      entityType: 'PurchaseOrder',
      entityId: id,
      details,
    });
  }

  private inBranch = (actor: PoActor, branchId: string) =>
    actor.branches.some((b) => b.id === branchId);

  /** Purchasing (and Executive) visibility: orders.view in the order's branch; drafts not for Executive. */
  private purchasingVisible(actor: PoActor, o: { branchId: string; status: PurchaseOrderStatus }) {
    if (!actor.orders.view || !this.inBranch(actor, o.branchId)) return false;
    return !(actor.executive && o.status === 'DRAFT');
  }

  /** Accounting visibility: issued orders with a deposit, in the member's branches. */
  private accountingVisible(
    actor: PoActor,
    o: { branchId: string; status: PurchaseOrderStatus; depositType: string },
  ) {
    return (
      actor.deposits.view &&
      this.inBranch(actor, o.branchId) &&
      o.status !== 'DRAFT' &&
      o.depositType !== 'NONE'
    );
  }

  private async find(actor: PoActor, id: string) {
    return this.db.purchaseOrder.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
  }

  // ------------------------------------------------------------- projections

  private deposit(o: Full) {
    return {
      type: o.depositType,
      value: exact(o.depositValue),
      amount: money(o.depositAmount),
      dueDate: day(o.depositDueDate),
      note: o.depositNote,
      status: o.depositStatus,
      confirmedAt: iso(o.depositConfirmedAt),
      confirmedBy: who(o.depositConfirmedBy),
      reference: o.depositReference,
      waivedAt: iso(o.depositWaivedAt),
      waivedBy: who(o.depositWaivedBy),
      waiveReason: o.depositWaiveReason,
    };
  }

  private branchOf(o: Full) {
    return {
      id: o.branch.id,
      code: o.branchCodeSnapshot ?? o.branch.code,
      name: o.branchNameSnapshot ?? o.branch.name,
    };
  }

  private requests(o: Full) {
    const seen = new Map<string, string>();
    for (const l of o.lines) seen.set(l.purchaseRequestId, l.prNumber);
    return [...seen].map(([id, number]) => ({ id, number }));
  }

  private operationalLine(l: Full['lines'][number]) {
    return {
      id: l.id,
      lineNo: l.lineNo,
      type: l.type,
      item: l.itemId ? { id: l.itemId, code: l.itemCode!, name: l.itemName! } : null,
      description: l.description,
      unit: l.unitCode || l.unitName ? { code: l.unitCode, name: l.unitName } : null,
      quantity: l.quantity.toString(),
      request: { id: l.purchaseRequestId, number: l.prNumber, lineNo: l.prLineNo },
    };
  }

  private commercialLine(l: Full['lines'][number]) {
    return {
      ...this.operationalLine(l),
      unitPrice: l.unitPrice.toString(),
      discountAmount: money(l.discountAmount)!,
      taxRate: l.taxRate.toString(),
      lineSubtotal: money(l.lineSubtotal)!,
      lineTax: money(l.lineTax)!,
      lineTotal: money(l.lineTotal)!,
    };
  }

  private totals(o: Full) {
    return {
      subtotal: money(o.subtotal)!,
      discountTotal: money(o.discountTotal)!,
      taxTotal: money(o.taxTotal)!,
      grandTotal: money(o.grandTotal)!,
    };
  }

  private async purchasingView(actor: PoActor, o: Full) {
    const [events, ordered] = await Promise.all([
      this.db.auditLog.findMany({
        where: {
          companyId: actor.access.company.id,
          entityType: 'PurchaseOrder',
          entityId: o.id,
          action: { in: LIFECYCLE },
        },
        orderBy: { occurredAt: 'asc' },
        include: { actor: { select: { fullName: true, email: true } } },
      }),
      orderedQuantities(
        this.db,
        o.lines.map((l) => l.purchaseRequestLineId),
        ORDERED_STATUSES,
        o.id,
      ),
    ]);
    const s = o.supplier;
    const order = PurchasingPOView.parse({
      id: o.id,
      number: o.number,
      status: o.status,
      branch: this.branchOf(o),
      supplier: s
        ? {
            id: s.id,
            code: o.supplierCode ?? s.code,
            name: o.supplierName ?? s.name,
            taxId: o.supplierTaxId,
            taxBranch: o.supplierTaxBranch,
            address: o.supplierAddress,
            contactName: o.supplierContactName,
            phone: o.supplierPhone,
            email: o.supplierEmail,
            active: s.status === 'ACTIVE',
          }
        : null,
      currency: o.currency,
      orderDate: day(o.orderDate),
      expectedDate: day(o.expectedDate),
      paymentTerms: o.paymentTerms,
      note: o.note,
      totals: this.totals(o),
      deposit: this.deposit(o),
      createdBy: who(o.createdBy),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      issuedAt: iso(o.issuedAt),
      issuedBy: who(o.issuedBy),
      pendingReceiveAt: iso(o.pendingReceiveAt),
      cancelledAt: iso(o.cancelledAt),
      cancelledBy: who(o.cancelledBy),
      cancellationReason: o.cancellationReason,
      lineCount: o.lines.length,
      lines: o.lines.map((l) => {
        const requested = l.requestLine.quantity;
        const elsewhere = ordered.get(l.purchaseRequestLineId) ?? ZERO;
        return {
          ...this.commercialLine(l),
          note: l.note,
          request: {
            id: l.purchaseRequestId,
            number: l.prNumber,
            lineNo: l.prLineNo,
            requested: requested.toString(),
            orderedElsewhere: elsewhere.toString(),
            remaining: Decimal.max(requested.minus(elsewhere), ZERO).toString(),
          },
          itemActive: l.itemId ? l.item?.status === 'ACTIVE' : null,
        };
      }),
      requests: this.requests(o),
      actions: poAllowedActions(actor, o),
    });
    return {
      view: 'purchasing' as const,
      order,
      timeline: events.map((e) => ({
        type: e.action,
        at: e.occurredAt.toISOString(),
        actor: e.actor ? { name: e.actor.fullName ?? e.actor.email } : null,
      })),
    };
  }

  private executiveView(o: Full) {
    return {
      view: 'executive' as const,
      order: ExecutivePOView.parse({
        id: o.id,
        number: o.number,
        status: o.status,
        branch: this.branchOf(o),
        supplier: { code: o.supplierCode, name: o.supplierName },
        currency: o.currency,
        orderDate: day(o.orderDate),
        expectedDate: day(o.expectedDate),
        issuedAt: iso(o.issuedAt),
        cancelledAt: iso(o.cancelledAt),
        grandTotal: money(o.grandTotal),
        deposit: { status: o.depositStatus, amount: money(o.depositAmount) },
        lineCount: o.lines.length,
        requests: this.requests(o),
      }),
    };
  }

  private accountingView(actor: PoActor, o: Full) {
    return {
      view: 'accounting' as const,
      order: AccountingDepositView.parse({
        id: o.id,
        number: o.number,
        status: o.status,
        branch: this.branchOf(o),
        supplier: {
          code: o.supplierCode,
          name: o.supplierName,
          taxId: o.supplierTaxId,
          taxBranch: o.supplierTaxBranch,
        },
        currency: o.currency,
        orderDate: day(o.orderDate),
        issuedAt: iso(o.issuedAt),
        issuedBy: who(o.issuedBy),
        paymentTerms: o.paymentTerms,
        totals: this.totals(o),
        deposit: this.deposit(o),
        lineCount: o.lines.length,
        lines: o.lines.map((l) => this.commercialLine(l)),
        actions: poAllowedActions(actor, o).filter(
          (a) => a === 'confirm_deposit' || a === 'waive_deposit',
        ),
      }),
    };
  }

  private warehouseView(o: Full) {
    return {
      view: 'warehouse' as const,
      order: WarehousePendingReceiveView.parse({
        id: o.id,
        number: o.number,
        status: o.status,
        branch: this.branchOf(o),
        supplier: { code: o.supplierCode, name: o.supplierName },
        orderDate: day(o.orderDate),
        expectedDate: day(o.expectedDate),
        issuedAt: iso(o.issuedAt),
        pendingReceiveAt: iso(o.pendingReceiveAt),
        lineCount: o.lines.length,
        lines: o.lines.map((l) => this.operationalLine(l)),
      }),
    };
  }

  // ------------------------------------------------------------------ reads

  async context(ctx: AuthContext) {
    const actor = await loadPoActor(this.db, ctx);
    return {
      orders: actor.orders,
      deposits: actor.deposits,
      receiving: actor.receiving,
      executive: actor.executive,
      branches: actor.branches,
      selectedBranch: actor.branches.find((b) => b.id === ctx.session.branchId) ?? null,
    };
  }

  /** The Purchasing order (or the Executive summary). */
  async get(ctx: AuthContext, id: string) {
    const actor = await loadPoActor(this.db, ctx);
    const o = await this.find(actor, id);
    if (!o || !this.purchasingVisible(actor, o)) throw orderNotFound();
    return actor.executive ? this.executiveView(o) : this.purchasingView(actor, o);
  }

  private branchFilter(actor: PoActor, branchId?: string) {
    const ids = actor.branches.map((b) => b.id);
    return { in: branchId ? ids.filter((b) => b === branchId) : ids };
  }

  async list(ctx: AuthContext, q: OrderListInput) {
    const actor = await loadPoActor(this.db, ctx);
    if (!actor.orders.view) throw permissionDenied('purchasing.orders.view');
    const and: Prisma.PurchaseOrderWhereInput[] = [
      { companyId: actor.access.company.id, branchId: this.branchFilter(actor, q.branchId) },
    ];
    if (actor.executive) and.push({ status: { not: 'DRAFT' } });
    if (q.view === 'open') {
      and.push({ status: { in: ['DRAFT', 'WAITING_DEPOSIT', 'PENDING_RECEIVE'] } });
    }
    if (q.status) and.push({ status: q.status });
    if (q.supplierId) and.push({ supplierId: q.supplierId });
    if (q.purchaseRequestId)
      and.push({ lines: { some: { purchaseRequestId: q.purchaseRequestId } } });
    if (q.q) {
      const c = { contains: q.q, mode: 'insensitive' as const };
      and.push({
        OR: [
          { number: c },
          { supplierName: c },
          { supplierCode: c },
          { lines: { some: { prNumber: c } } },
        ],
      });
    }
    const where: Prisma.PurchaseOrderWhereInput = { AND: and };
    const skip = (q.page - 1) * q.pageSize;
    const [rows, total, counts] = await Promise.all([
      this.db.purchaseOrder.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: q.pageSize,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          supplier: { select: { code: true, name: true } },
          lines: { select: { purchaseRequestId: true, prNumber: true } },
        },
      }),
      this.db.purchaseOrder.count({ where }),
      this.db.purchaseOrder.groupBy({
        by: ['status'],
        where: { AND: and.slice(0, actor.executive ? 2 : 1) },
        _count: { _all: true },
      }),
    ]);
    return {
      items: rows.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        branch: {
          id: o.branch.id,
          code: o.branchCodeSnapshot ?? o.branch.code,
          name: o.branchNameSnapshot ?? o.branch.name,
        },
        supplier:
          o.supplierName || o.supplier
            ? {
                code: o.supplierCode ?? o.supplier?.code ?? null,
                name: o.supplierName ?? o.supplier?.name ?? null,
              }
            : null,
        currency: o.currency,
        grandTotal: money(o.grandTotal),
        deposit: { status: o.depositStatus, amount: money(o.depositAmount) },
        orderDate: day(o.orderDate),
        expectedDate: day(o.expectedDate),
        lineCount: o.lines.length,
        requests: [...new Map(o.lines.map((l) => [l.purchaseRequestId, l.prNumber]))].map(
          ([id, number]) => ({ id, number }),
        ),
        updatedAt: o.updatedAt.toISOString(),
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: skip + rows.length < total,
    };
  }

  /** Active suppliers for an order (identity only). */
  async supplierOptions(ctx: AuthContext, q?: string) {
    const actor = await loadPoActor(this.db, ctx);
    if (!actor.orders.create && !actor.orders.edit)
      throw permissionDenied('purchasing.orders.edit');
    const rows = await this.db.supplier.findMany({
      where: {
        companyId: actor.access.company.id,
        status: 'ACTIVE',
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { taxId: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { code: 'asc' },
      take: 20,
    });
    return { suppliers: rows.map((s) => ({ id: s.id, code: s.code, name: s.name })) };
  }

  /** Request lines with what is still to order (issued orders only). */
  private async remainingLines(requestIds: string[]) {
    const lines = await this.db.purchaseRequestLine.findMany({
      where: { purchaseRequestId: { in: requestIds } },
      orderBy: { lineNo: 'asc' },
      include: { unit: { select: { precision: true } } },
    });
    const [ordered, drafted] = await Promise.all([
      orderedQuantities(
        this.db,
        lines.map((l) => l.id),
      ),
      orderedQuantities(
        this.db,
        lines.map((l) => l.id),
        ['DRAFT'],
      ),
    ]);
    return lines.map((l) => {
      const o = ordered.get(l.id) ?? ZERO;
      return {
        line: l,
        ordered: o,
        inDraft: drafted.get(l.id) ?? ZERO,
        remaining: Decimal.max(l.quantity.minus(o), ZERO),
      };
    });
  }

  /** APPROVED requests in the member's branches that still have something to order. */
  async sourceRequests(ctx: AuthContext, q?: string) {
    const actor = await loadPoActor(this.db, ctx);
    if (!actor.orders.create) throw permissionDenied('purchasing.orders.create');
    const rows = await this.db.purchaseRequest.findMany({
      where: {
        companyId: actor.access.company.id,
        status: 'APPROVED',
        branchId: { in: actor.branches.map((b) => b.id) },
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { purpose: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: { branch: { select: { id: true, code: true, name: true } } },
    });
    const remaining = await this.remainingLines(rows.map((r) => r.id));
    return {
      requests: rows
        .map((r) => {
          const mine = remaining.filter((x) => x.line.purchaseRequestId === r.id);
          return {
            id: r.id,
            number: r.number,
            department: r.department,
            branch: {
              id: r.branch.id,
              code: r.branchCodeSnapshot ?? r.branch.code,
              name: r.branchNameSnapshot ?? r.branch.name,
            },
            purpose: r.purpose,
            needByDate: day(r.needByDate),
            approvedAt: iso(r.approvedAt),
            lineCount: mine.length,
            openLines: mine.filter((x) => x.remaining.gt(0)).length,
          };
        })
        .filter((r) => r.openLines > 0)
        .slice(0, 20),
    };
  }

  /** One APPROVED request's lines with requested / ordered / in draft / remaining — for building an order. */
  async sourceRequest(ctx: AuthContext, id: string) {
    const actor = await loadPoActor(this.db, ctx);
    if (!actor.orders.create && !actor.orders.edit)
      throw permissionDenied('purchasing.orders.create');
    const r = await this.db.purchaseRequest.findFirst({
      where: { id, companyId: actor.access.company.id, status: 'APPROVED' },
      include: { branch: { select: { id: true, code: true, name: true } } },
    });
    if (!r || !this.inBranch(actor, r.branchId)) {
      throw new AppError(404, 'PR_NOT_FOUND', 'This purchase request was not found.');
    }
    const lines = await this.remainingLines([r.id]);
    return {
      request: {
        id: r.id,
        number: r.number,
        department: r.department,
        branch: {
          id: r.branch.id,
          code: r.branchCodeSnapshot ?? r.branch.code,
          name: r.branchNameSnapshot ?? r.branch.name,
        },
        purpose: r.purpose,
        needByDate: day(r.needByDate),
        lines: lines.map(({ line: l, ordered, inDraft, remaining }) => ({
          id: l.id,
          lineNo: l.lineNo,
          type: l.type,
          item: l.itemId ? { id: l.itemId, code: l.itemCode!, name: l.itemName! } : null,
          description: l.description,
          unit: l.unitCode || l.unitName ? { code: l.unitCode, name: l.unitName } : null,
          precision: l.unit?.precision ?? 6,
          requested: l.quantity.toString(),
          ordered: ordered.toString(),
          inDraft: inDraft.toString(),
          remaining: remaining.toString(),
        })),
      },
    };
  }

  // ---------------------------------------------------- accounting / warehouse

  async depositQueue(ctx: AuthContext, q: QueueInput) {
    const actor = await loadPoActor(this.db, ctx);
    if (!actor.deposits.view) throw permissionDenied('accounting.deposits.view');
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId: actor.access.company.id,
      branchId: this.branchFilter(actor, q.branchId),
      depositType: { not: 'NONE' },
      status: (q.view ?? 'pending') === 'pending' ? 'WAITING_DEPOSIT' : { not: 'DRAFT' },
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q, mode: 'insensitive' } },
              { supplierName: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (q.page - 1) * q.pageSize;
    const [rows, total] = await Promise.all([
      this.db.purchaseOrder.findMany({
        where,
        orderBy: [
          { depositDueDate: { sort: 'asc', nulls: 'last' } },
          { issuedAt: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take: q.pageSize,
        include,
      }),
      this.db.purchaseOrder.count({ where }),
    ]);
    return {
      items: rows.map((o) => AccountingDepositRow.parse(this.accountingView(actor, o).order)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: skip + rows.length < total,
    };
  }

  async depositOrder(ctx: AuthContext, id: string) {
    const actor = await loadPoActor(this.db, ctx);
    const o = await this.find(actor, id);
    if (!o || !this.accountingVisible(actor, o)) throw orderNotFound();
    return this.accountingView(actor, o);
  }

  async pendingReceiveQueue(ctx: AuthContext, q: QueueInput) {
    const actor = await loadPoActor(this.db, ctx);
    if (!actor.receiving.view) throw permissionDenied('warehouse.receiving.view');
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId: actor.access.company.id,
      branchId: this.branchFilter(actor, q.branchId),
      status: 'PENDING_RECEIVE',
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q, mode: 'insensitive' } },
              { supplierName: { contains: q.q, mode: 'insensitive' } },
              { lines: { some: { itemCode: { contains: q.q, mode: 'insensitive' } } } },
              { lines: { some: { itemName: { contains: q.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const skip = (q.page - 1) * q.pageSize;
    const [rows, total] = await Promise.all([
      this.db.purchaseOrder.findMany({
        where,
        orderBy: [
          { expectedDate: { sort: 'asc', nulls: 'last' } },
          { pendingReceiveAt: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take: q.pageSize,
        include,
      }),
      this.db.purchaseOrder.count({ where }),
    ]);
    return {
      items: rows.map((o) => WarehousePendingReceiveRow.parse(this.warehouseView(o).order)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: skip + rows.length < total,
    };
  }

  async pendingReceiveOrder(ctx: AuthContext, id: string) {
    const actor = await loadPoActor(this.db, ctx);
    const o = await this.find(actor, id);
    if (
      !o ||
      !actor.receiving.view ||
      !this.inBranch(actor, o.branchId) ||
      o.status !== 'PENDING_RECEIVE'
    ) {
      throw orderNotFound();
    }
    return this.warehouseView(o);
  }

  // ----------------------------------------------------------------- writes

  private supplierSnapshot(s: {
    id: string;
    code: string;
    name: string;
    taxId: string | null;
    taxBranch: string | null;
    address: string | null;
    contactName: string | null;
    phone: string | null;
    email: string | null;
  }) {
    return {
      supplierId: s.id,
      supplierCode: s.code,
      supplierName: s.name,
      supplierTaxId: s.taxId,
      supplierTaxBranch: s.taxBranch,
      supplierAddress: s.address,
      supplierContactName: s.contactName,
      supplierPhone: s.phone,
      supplierEmail: s.email,
    };
  }

  private async activeSupplier(tx: Prisma.TransactionClient, companyId: string, id: string) {
    const s = await tx.supplier.findFirst({ where: { id, companyId } });
    if (!s) throw refNotFound('supplierId');
    if (s.status !== 'ACTIVE') throw refInactive('supplierId');
    return s;
  }

  /** The deposit columns for a DRAFT, its amount taken from the current grand total. */
  private depositData(input: DepositInput, grandTotal: Decimal) {
    if (input.type === 'NONE') {
      return {
        depositType: 'NONE' as const,
        depositValue: null,
        depositAmount: null,
        depositDueDate: null,
        depositNote: null,
        depositStatus: 'NOT_REQUIRED' as const,
      };
    }
    return {
      depositType: input.type,
      depositValue: input.value,
      depositAmount: depositAmount(input.type, input.value, grandTotal),
      depositDueDate: toDay(input.dueDate),
      depositNote: input.note ?? null,
      depositStatus: 'PENDING' as const,
    };
  }

  /** Re-derives the totals (and a percentage deposit's amount) from the stored lines. */
  private async recalc(tx: Prisma.TransactionClient, id: string) {
    const o = await tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { lines: true } });
    const t = orderTotals(o.lines);
    await tx.purchaseOrder.update({
      where: { id },
      data: {
        subtotal: t.subtotal,
        discountTotal: t.discountTotal,
        taxTotal: t.taxTotal,
        grandTotal: t.grandTotal,
        depositAmount:
          o.depositType === 'NONE' || !o.depositValue
            ? null
            : depositAmount(o.depositType, o.depositValue, t.grandTotal),
      },
    });
  }

  /** Validated stored form of an order line from a request line (snapshots from the request line). */
  private lineData(
    rl: RequestLine,
    fields: {
      quantity: string;
      unitPrice: string;
      discountAmount: string;
      taxRate: string;
      note: string | null;
    },
    remaining: Decimal,
  ) {
    const precision = rl.type === 'ITEM' ? rl.item!.baseUnit.precision : (rl.unit?.precision ?? 6);
    if (decimals(fields.quantity) > precision) {
      throw new AppError(
        422,
        'QUANTITY_PRECISION',
        'This quantity has more decimal places than its unit allows.',
        { field: 'quantity', precision },
      );
    }
    if (new Decimal(fields.quantity).gt(remaining)) throw exceedsRemaining(remaining);
    const amounts = lineAmounts({
      quantity: fields.quantity,
      unitPrice: fields.unitPrice,
      discountAmount: fields.discountAmount,
      taxRate: fields.taxRate,
    });
    if (new Decimal(fields.discountAmount).gt(amounts.lineSubtotal)) {
      throw new AppError(
        422,
        'PO_DISCOUNT_TOO_LARGE',
        'The discount is more than the line amount.',
        {
          field: 'discountAmount',
        },
      );
    }
    return {
      purchaseRequestId: rl.purchaseRequestId,
      purchaseRequestLineId: rl.id,
      prNumber: rl.request.number,
      prLineNo: rl.lineNo,
      type: rl.type,
      itemId: rl.itemId,
      itemCode: rl.itemCode,
      itemName: rl.itemName,
      description: rl.description,
      unitId: rl.unitId,
      unitCode: rl.unitCode,
      unitName: rl.unitName,
      quantity: fields.quantity,
      unitPrice: fields.unitPrice,
      discountAmount: fields.discountAmount,
      taxRate: fields.taxRate,
      ...amounts,
      note: fields.note,
    };
  }

  private requestLine(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.purchaseRequestLine.findFirst({
      where: { id, companyId },
      include: { request: true, unit: true, item: { include: { baseUnit: true } } },
    });
  }

  /**
   * A new DRAFT from one APPROVED request, in that request's branch. The
   * number is taken now (PO-YYYYMM-NNNNNN, company-wide, monthly, atomic).
   */
  async create(ctx: AuthContext, input: CreateOrderInput, meta: RequestMeta) {
    const actor = await loadPoActor(this.db, ctx);
    if (!actor.orders.create) throw permissionDenied('purchase_order.create');
    const companyId = actor.access.company.id;
    const pr = await this.db.purchaseRequest.findFirst({
      where: { id: input.purchaseRequestId, companyId },
    });
    if (!pr || !this.inBranch(actor, pr.branchId)) {
      throw new AppError(404, 'PR_NOT_FOUND', 'This purchase request was not found.');
    }
    const today = companyDay(actor.access.company.timezone);
    const id = await this.db.$transaction(async (tx) => {
      await shareRequests(tx, [pr.id]);
      const fresh = await tx.purchaseRequest.findUniqueOrThrow({ where: { id: pr.id } });
      if (fresh.status !== 'APPROVED') {
        throw new AppError(409, 'PR_NOT_APPROVED', 'Only an approved request can be ordered.', {
          number: fresh.number,
        });
      }
      const requestLines = await tx.purchaseRequestLine.findMany({
        where: { purchaseRequestId: pr.id },
        orderBy: { lineNo: 'asc' },
        include: { request: true, unit: true, item: { include: { baseUnit: true } } },
      });
      const ordered = await orderedQuantities(
        tx,
        requestLines.map((l) => l.id),
      );
      const remainingOf = (l: RequestLine) =>
        Decimal.max(l.quantity.minus(ordered.get(l.id) ?? ZERO), ZERO);
      const picks: NewLineInput[] =
        input.lines ??
        requestLines
          .filter((l) => remainingOf(l).gt(0))
          .map((l) => ({ purchaseRequestLineId: l.id, quantity: remainingOf(l).toString() }));
      if (!picks.length) {
        throw new AppError(
          409,
          'PR_FULLY_ORDERED',
          'Everything on this request is already ordered.',
        );
      }
      const seen = new Set<string>();
      const lines = picks.map((p) => {
        const rl = requestLines.find((l) => l.id === p.purchaseRequestLineId);
        if (!rl) throw refNotFound('purchaseRequestLineId');
        if (seen.has(rl.id)) {
          throw new AppError(
            409,
            'PO_LINE_DUPLICATE',
            'This request line is already on the order.',
          );
        }
        seen.add(rl.id);
        return this.lineData(
          rl,
          {
            quantity: p.quantity,
            unitPrice: p.unitPrice ?? '0',
            discountAmount: p.discountAmount ?? '0',
            taxRate: p.taxRate ?? '0',
            note: p.note ?? null,
          },
          remainingOf(rl),
        );
      });
      const supplier = input.supplierId
        ? this.supplierSnapshot(await this.activeSupplier(tx, companyId, input.supplierId))
        : {};
      const number = await nextOrderNumber(tx, companyId, today.slice(0, 7).replace('-', ''));
      const totals = orderTotals(lines);
      const o = await tx.purchaseOrder.create({
        data: {
          companyId,
          branchId: pr.branchId,
          number,
          ...supplier,
          currency: input.currency ?? 'THB',
          orderDate: new Date(`${today}T00:00:00Z`),
          expectedDate: toDay(input.expectedDate),
          paymentTerms: input.paymentTerms ?? null,
          note: input.note ?? null,
          lineCounter: lines.length,
          createdByMemberId: actor.memberId,
          ...totals,
          ...(input.deposit ? this.depositData(input.deposit, totals.grandTotal) : {}),
        },
      });
      await tx.purchaseOrderLine.createMany({
        data: lines.map((l, i) => ({
          ...l,
          companyId,
          branchId: pr.branchId,
          purchaseOrderId: o.id,
          lineNo: i + 1,
        })),
      });
      await this.event(tx, meta, actor, 'PURCHASE_ORDER_CREATED', o.id, {
        number,
        request: pr.number,
        lines: lines.length,
      });
      return o.id;
    });
    return this.get(ctx, id);
  }

  /** Loads a visible order and checks the action before any transaction. */
  private async actionable(actor: PoActor, id: string, action: PoAction) {
    const o = await this.find(actor, id);
    const visible =
      !!o &&
      (this.purchasingVisible(actor, o) ||
        ((action === 'confirm_deposit' || action === 'waive_deposit') &&
          this.accountingVisible(actor, o)));
    if (!o || !visible) throw orderNotFound();
    assertPo(actor, action, o);
    return o;
  }

  /** Inside a transaction: lock the order and re-check the action on its fresh state. */
  private async locked(tx: Prisma.TransactionClient, actor: PoActor, id: string, action: PoAction) {
    await lockOrder(tx, id);
    const fresh = await tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
    assertPo(actor, action, fresh);
    return fresh;
  }

  async update(ctx: AuthContext, id: string, input: UpdateOrderInput, meta: RequestMeta) {
    const actor = await loadPoActor(this.db, ctx);
    await this.actionable(actor, id, 'edit');
    await this.db.$transaction(async (tx) => {
      const fresh = await this.locked(tx, actor, id, 'edit');
      const data: Prisma.PurchaseOrderUncheckedUpdateInput = {};
      const fields: string[] = [];
      if (input.supplierId !== undefined && input.supplierId !== fresh.supplierId) {
        Object.assign(
          data,
          input.supplierId
            ? this.supplierSnapshot(
                await this.activeSupplier(tx, fresh.companyId, input.supplierId),
              )
            : {
                supplierId: null,
                supplierCode: null,
                supplierName: null,
                supplierTaxId: null,
                supplierTaxBranch: null,
                supplierAddress: null,
                supplierContactName: null,
                supplierPhone: null,
                supplierEmail: null,
              },
        );
        fields.push('supplier');
      }
      if (input.currency && input.currency !== fresh.currency) {
        data.currency = input.currency;
        fields.push('currency');
      }
      if (input.expectedDate !== undefined && input.expectedDate !== day(fresh.expectedDate)) {
        data.expectedDate = toDay(input.expectedDate);
        fields.push('expectedDate');
      }
      if (input.paymentTerms !== undefined && input.paymentTerms !== fresh.paymentTerms) {
        data.paymentTerms = input.paymentTerms;
        fields.push('paymentTerms');
      }
      if (input.note !== undefined && input.note !== fresh.note) {
        data.note = input.note;
        fields.push('note');
      }
      if (input.deposit) {
        Object.assign(data, this.depositData(input.deposit, fresh.grandTotal));
        fields.push('deposit');
      }
      if (!fields.length) return;
      await tx.purchaseOrder.update({ where: { id }, data });
      await this.recalc(tx, id);
      await this.event(tx, meta, actor, 'PURCHASE_ORDER_UPDATED', id, {
        number: fresh.number,
        fields,
      });
    });
    return this.get(ctx, id);
  }

  async addLine(ctx: AuthContext, id: string, input: NewLineInput, meta: RequestMeta) {
    const actor = await loadPoActor(this.db, ctx);
    await this.actionable(actor, id, 'edit');
    await this.db.$transaction(async (tx) => {
      const fresh = await this.locked(tx, actor, id, 'edit');
      const rl = await this.requestLine(tx, fresh.companyId, input.purchaseRequestLineId);
      if (!rl) throw refNotFound('purchaseRequestLineId');
      if (rl.request.branchId !== fresh.branchId) {
        throw new AppError(
          422,
          'PO_BRANCH_MISMATCH',
          'An order can only order from requests of its own branch.',
        );
      }
      await shareRequests(tx, [rl.purchaseRequestId]);
      const request = await tx.purchaseRequest.findUniqueOrThrow({
        where: { id: rl.purchaseRequestId },
      });
      if (request.status !== 'APPROVED') {
        throw new AppError(409, 'PR_NOT_APPROVED', 'Only an approved request can be ordered.', {
          number: request.number,
        });
      }
      if (
        await tx.purchaseOrderLine.count({
          where: { purchaseOrderId: id, purchaseRequestLineId: rl.id },
        })
      ) {
        throw new AppError(409, 'PO_LINE_DUPLICATE', 'This request line is already on the order.');
      }
      if ((await tx.purchaseOrderLine.count({ where: { purchaseOrderId: id } })) >= 100) {
        throw new AppError(422, 'PO_TOO_MANY_LINES', 'An order can have at most 100 lines.');
      }
      const ordered = (await orderedQuantities(tx, [rl.id])).get(rl.id) ?? ZERO;
      const data = this.lineData(
        rl,
        {
          quantity: input.quantity,
          unitPrice: input.unitPrice ?? '0',
          discountAmount: input.discountAmount ?? '0',
          taxRate: input.taxRate ?? '0',
          note: input.note ?? null,
        },
        Decimal.max(rl.quantity.minus(ordered), ZERO),
      );
      const lineNo = fresh.lineCounter + 1;
      await tx.purchaseOrder.update({ where: { id }, data: { lineCounter: lineNo } });
      await tx.purchaseOrderLine.create({
        data: {
          ...data,
          companyId: fresh.companyId,
          branchId: fresh.branchId,
          purchaseOrderId: id,
          lineNo,
        },
      });
      await this.recalc(tx, id);
      await this.event(tx, meta, actor, 'PURCHASE_ORDER_LINE_ADDED', id, {
        number: fresh.number,
        lineNo,
        request: rl.request.number,
        item: rl.itemCode ?? null,
      });
    });
    return this.get(ctx, id);
  }

  async updateLine(
    ctx: AuthContext,
    id: string,
    lineId: string,
    input: LineUpdateInput,
    meta: RequestMeta,
  ) {
    const actor = await loadPoActor(this.db, ctx);
    await this.actionable(actor, id, 'edit');
    await this.db.$transaction(async (tx) => {
      const fresh = await this.locked(tx, actor, id, 'edit');
      const line = await tx.purchaseOrderLine.findFirst({
        where: { id: lineId, purchaseOrderId: id, companyId: fresh.companyId },
      });
      if (!line) throw new AppError(404, 'PO_LINE_NOT_FOUND', 'This order line was not found.');
      const rl = (await this.requestLine(tx, fresh.companyId, line.purchaseRequestLineId))!;
      const ordered = (await orderedQuantities(tx, [rl.id])).get(rl.id) ?? ZERO;
      const data = this.lineData(
        rl,
        {
          quantity: input.quantity ?? line.quantity.toString(),
          unitPrice: input.unitPrice ?? line.unitPrice.toString(),
          discountAmount: input.discountAmount ?? line.discountAmount.toString(),
          taxRate: input.taxRate ?? line.taxRate.toString(),
          note: input.note !== undefined ? input.note : line.note,
        },
        Decimal.max(rl.quantity.minus(ordered), ZERO),
      );
      await tx.purchaseOrderLine.update({
        where: { id: line.id },
        data: {
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          discountAmount: data.discountAmount,
          taxRate: data.taxRate,
          lineSubtotal: data.lineSubtotal,
          lineTax: data.lineTax,
          lineTotal: data.lineTotal,
          note: data.note,
        },
      });
      await this.recalc(tx, id);
      await this.event(tx, meta, actor, 'PURCHASE_ORDER_LINE_UPDATED', id, {
        number: fresh.number,
        lineNo: line.lineNo,
        fields: Object.keys(input),
      });
    });
    return this.get(ctx, id);
  }

  async removeLine(ctx: AuthContext, id: string, lineId: string, meta: RequestMeta) {
    const actor = await loadPoActor(this.db, ctx);
    await this.actionable(actor, id, 'edit');
    await this.db.$transaction(async (tx) => {
      const fresh = await this.locked(tx, actor, id, 'edit');
      const line = await tx.purchaseOrderLine.findFirst({
        where: { id: lineId, purchaseOrderId: id, companyId: fresh.companyId },
      });
      if (!line) throw new AppError(404, 'PO_LINE_NOT_FOUND', 'This order line was not found.');
      await tx.purchaseOrderLine.delete({ where: { id: line.id } });
      await this.recalc(tx, id);
      await this.event(tx, meta, actor, 'PURCHASE_ORDER_LINE_REMOVED', id, {
        number: fresh.number,
        lineNo: line.lineNo,
      });
    });
    return this.get(ctx, id);
  }

  /**
   * DRAFT → WAITING_DEPOSIT (a deposit is required) or PENDING_RECEIVE (none).
   * Needs an active supplier, at least one line, a price on every line and a
   * deposit no larger than the total. Under locks — the request rows shared,
   * the request lines exclusive (sorted) — every line's quantity is checked
   * against what is still unordered on ISSUED orders, so of two orders issued
   * at once for the same remaining quantity only one can succeed. Supplier,
   * branch and item snapshots are refreshed now and frozen from here on.
   */
  async issue(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadPoActor(this.db, ctx);
    await this.actionable(actor, id, 'issue');
    await this.db.$transaction(async (tx) => {
      await this.locked(tx, actor, id, 'issue');
      const o = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: {
          branch: true,
          supplier: true,
          lines: { orderBy: { lineNo: 'asc' }, include: { item: { include: { baseUnit: true } } } },
        },
      });
      const missing: string[] = [];
      if (!o.supplier) missing.push('supplier');
      if (!o.lines.length) missing.push('lines');
      const unpriced = o.lines.filter((l) => !l.unitPrice.gt(0)).map((l) => l.lineNo);
      if (unpriced.length) missing.push('unitPrice');
      if (missing.length) {
        throw new AppError(422, 'PO_INCOMPLETE', 'This order is not ready to issue.', {
          missing,
          ...(unpriced.length ? { lines: unpriced.join(',') } : {}),
        });
      }
      if (o.supplier!.status !== 'ACTIVE') throw refInactive('supplierId');
      if (o.depositType !== 'NONE' && o.depositAmount && o.depositAmount.gt(o.grandTotal)) {
        throw new AppError(
          422,
          'PO_DEPOSIT_EXCEEDS_TOTAL',
          'The deposit is more than the order total.',
          { field: 'deposit' },
        );
      }
      const requestIds = [...new Set(o.lines.map((l) => l.purchaseRequestId))];
      await shareRequests(tx, requestIds);
      const requests = await tx.purchaseRequest.findMany({ where: { id: { in: requestIds } } });
      const notApproved = requests.find((r) => r.status !== 'APPROVED');
      if (notApproved) {
        throw new AppError(409, 'PR_NOT_APPROVED', 'Only an approved request can be ordered.', {
          number: notApproved.number,
        });
      }
      const lineIds = o.lines.map((l) => l.purchaseRequestLineId);
      await lockRequestLines(tx, lineIds);
      // Read AFTER the locks: under READ COMMITTED this sees every issue that committed before us.
      // (One connection: the transaction's queries run one after another.)
      const requested = await tx.purchaseRequestLine.findMany({ where: { id: { in: lineIds } } });
      const ordered = await orderedQuantities(tx, lineIds, ORDERED_STATUSES, id);
      for (const l of o.lines) {
        const rl = requested.find((r) => r.id === l.purchaseRequestLineId)!;
        const remaining = Decimal.max(rl.quantity.minus(ordered.get(rl.id) ?? ZERO), ZERO);
        if (l.quantity.gt(remaining)) throw exceedsRemaining(remaining, l.lineNo);
        if (l.type !== 'ITEM') continue;
        const item = l.item!;
        if (item.status !== 'ACTIVE' || item.baseUnit.status !== 'ACTIVE') {
          throw new AppError(409, 'PO_LINE_INACTIVE', 'A line names an inactive item or unit.', {
            lineNo: l.lineNo,
          });
        }
        if (item.baseUnitId !== l.unitId) {
          throw new AppError(
            409,
            'PO_LINE_STALE',
            'An item’s unit changed since it was requested.',
            {
              lineNo: l.lineNo,
            },
          );
        }
        await tx.purchaseOrderLine.update({
          where: { id: l.id },
          data: {
            itemCode: item.code,
            itemName: item.name,
            unitCode: item.baseUnit.code,
            unitName: item.baseUnit.name,
          },
        });
      }
      const now = new Date();
      const deposit = o.depositType !== 'NONE';
      const to: PurchaseOrderStatus = deposit ? 'WAITING_DEPOSIT' : 'PENDING_RECEIVE';
      const changed = await tx.purchaseOrder.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          status: to,
          issuedAt: now,
          issuedByMemberId: actor.memberId,
          pendingReceiveAt: deposit ? null : now,
          depositStatus: deposit ? 'PENDING' : 'NOT_REQUIRED',
          ...this.supplierSnapshot(o.supplier!),
          branchCodeSnapshot: o.branch.code,
          branchNameSnapshot: o.branch.name,
        },
      });
      if (changed.count !== 1) throw orderStateChanged();
      await this.event(tx, meta, actor, 'PURCHASE_ORDER_ISSUED', id, {
        number: o.number,
        from: 'DRAFT',
        to,
        lines: o.lines.length,
        deposit,
      });
    });
    return this.get(ctx, id);
  }

  /**
   * Cancel: a DRAFT by its editors (reason optional); an issued order by
   * purchasing.orders.cancel, reason required, before any receipt (none exist
   * before EP31). Its quantities stop counting as ordered.
   */
  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadPoActor(this.db, ctx);
    const o = await this.actionable(actor, id, 'cancel');
    if (o.status !== 'DRAFT' && !reason) {
      throw new AppError(422, 'REASON_REQUIRED', 'Give a reason for cancelling.', {
        field: 'reason',
      });
    }
    await this.db.$transaction(async (tx) => {
      const changed = await tx.purchaseOrder.updateMany({
        where: { id, companyId: actor.access.company.id, status: o.status },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      if (changed.count !== 1) throw orderStateChanged();
      await this.event(tx, meta, actor, 'PURCHASE_ORDER_CANCELLED', id, {
        number: o.number,
        from: o.status,
        to: 'CANCELLED',
        withReason: !!reason,
      });
    });
    return this.get(ctx, id);
  }

  async confirmDeposit(ctx: AuthContext, id: string, reference: string | null, meta: RequestMeta) {
    return this.settleDeposit(ctx, id, 'confirm_deposit', reference, meta);
  }

  async waiveDeposit(ctx: AuthContext, id: string, reason: string, meta: RequestMeta) {
    return this.settleDeposit(ctx, id, 'waive_deposit', reason, meta);
  }

  /** WAITING_DEPOSIT → PENDING_RECEIVE, conditional on the pending deposit (one decision wins). */
  private async settleDeposit(
    ctx: AuthContext,
    id: string,
    action: 'confirm_deposit' | 'waive_deposit',
    text: string | null,
    meta: RequestMeta,
  ) {
    const actor = await loadPoActor(this.db, ctx);
    const o = await this.actionable(actor, id, action);
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const changed = await tx.purchaseOrder.updateMany({
        where: {
          id,
          companyId: actor.access.company.id,
          status: 'WAITING_DEPOSIT',
          depositStatus: 'PENDING',
        },
        data:
          action === 'confirm_deposit'
            ? {
                status: 'PENDING_RECEIVE',
                pendingReceiveAt: now,
                depositStatus: 'CONFIRMED',
                depositConfirmedAt: now,
                depositConfirmedByMemberId: actor.memberId,
                depositReference: text,
              }
            : {
                status: 'PENDING_RECEIVE',
                pendingReceiveAt: now,
                depositStatus: 'WAIVED',
                depositWaivedAt: now,
                depositWaivedByMemberId: actor.memberId,
                depositWaiveReason: text,
              },
      });
      if (changed.count !== 1) throw orderStateChanged();
      await this.event(
        tx,
        meta,
        actor,
        action === 'confirm_deposit'
          ? 'PURCHASE_ORDER_DEPOSIT_CONFIRMED'
          : 'PURCHASE_ORDER_DEPOSIT_WAIVED',
        id,
        { number: o.number, from: 'WAITING_DEPOSIT', to: 'PENDING_RECEIVE' },
      );
    });
    return actor.deposits.view ? this.depositOrder(ctx, id) : this.get(ctx, id);
  }
}
