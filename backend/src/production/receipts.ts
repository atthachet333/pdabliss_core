import type { RequestMeta } from '../auth/audit.js';
import { requireIndependentDecision, type OwnerOverride } from '../company/approval.js';
import type { AuthContext } from '../auth/sessions.js';
import { recordCompanyEvent, type ProductionAuditAction } from '../company/audit.js';
import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { permissionDenied } from '../permissions/guard.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import type { AllocationInput } from '../warehouse/input.js';
import { applyMovement, lockLocations, resolveLot, type LedgerActor } from '../warehouse/ledger.js';
import { assertKnownLots, assertLocations, normalizeLine } from '../warehouse/rules.js';
import type { CreateFgReceiptInput, FgReceiptListInput } from './input.js';
import { receivedByReport } from './output.js';
import {
  inBranch,
  loadProductionActor,
  outputNotFound,
  receiptNotFound,
  type ProductionActor,
} from './policy.js';

/*
 * Finished goods receipts (EP38) — docs/PRODUCTION_FINISHED_GOODS_RECEIPT.md.
 * Warehouse receives ACCEPTED good output of a production order into stock:
 * FGR-YYYYMM-NNNNNN, lines = location (the order's branch, ACTIVE) + lot /
 * expiry / production date per the item's tracking rules (warehouse/rules.ts,
 * the same rules as purchase receiving) + quantity.
 *
 *   DRAFT → POSTED (PRODUCTION_OUTPUT, +) | CANCELLED;  POSTED → REVERSED (reason,
 *   PRODUCTION_OUTPUT_REVERSAL, −, reservation-guarded).
 *
 * Posting is the ONLY moment finished goods become stock. ONE transaction, in
 * the global lock order: production order row → output report row → receipt
 * row → location advisory locks (shared; an open count refuses) → balances
 * (single-statement upsert). Re-checked under those locks: the receipt still
 * DRAFT, the report ACCEPTED, the order open (in production, paused or under
 * completion review), the item active and stocked, every line's rules, and
 * received + this receipt ≤ accepted — so two receipts racing for the same
 * output never receive more than was accepted, and a second post finds the
 * receipt POSTED (409; the unique (receipt line, type) movement key refuses a
 * duplicate again). The lot is resolved once per (company, item, number) —
 * concurrent creation of the same lot is one row — and keeps one expiry and one
 * production date. Warehouse views carry no price, cost, value or customer.
 */

const fail = (status: number, code: string, message: string, details?: object) =>
  new AppError(status, code, message, details);
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const person = { select: { user: { select: { fullName: true, email: true } } } } as const;
const who = (m: { user: { fullName: string | null; email: string } } | null) =>
  m ? { name: m.user.fullName ?? m.user.email } : null;
const sum = (xs: readonly Decimal[]) => xs.reduce<Decimal>((t, x) => t.plus(x), ZERO);

/** Orders whose accepted output may still be received (or reversed). */
const RECEIVABLE: readonly string[] = ['IN_PRODUCTION', 'PAUSED', 'COMPLETION_REVIEW'];

const include = {
  branch: { select: { id: true, code: true, name: true } },
  order: {
    select: {
      id: true,
      number: true,
      status: true,
      itemId: true,
      itemCode: true,
      itemName: true,
      unitCode: true,
      unitPrecision: true,
    },
  },
  outputReport: {
    select: {
      id: true,
      number: true,
      status: true,
      productionDate: true,
      acceptedQuantity: true,
    },
  },
  createdBy: person,
  postedBy: person,
  cancelledBy: person,
  reversedBy: person,
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: {
      location: { select: { id: true, code: true, name: true } },
      lot: { select: { id: true, lotNumber: true, expiryDate: true, manufacturedDate: true } },
    },
  },
} satisfies Prisma.ProductionGoodsReceiptInclude;
type Full = Prisma.ProductionGoodsReceiptGetPayload<{ include: typeof include }>;

const TIMELINE: ProductionAuditAction[] = [
  'FINISHED_GOODS_RECEIPT_CREATED',
  'FINISHED_GOODS_RECEIPT_UPDATED',
  'FINISHED_GOODS_RECEIPT_POSTED',
  'FINISHED_GOODS_RECEIPT_CANCELLED',
  'FINISHED_GOODS_RECEIPT_REVERSED',
];

const itemRules = {
  id: true,
  code: true,
  status: true,
  inventoryTracked: true,
  lotTracking: true,
  expiryTracking: true,
} as const;

export class FinishedGoodsService {
  constructor(
    private readonly db: Db,
    private readonly scope: 'customer' | 'seed' = 'customer',
  ) {}

  private today(actor: ProductionActor) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: actor.access.company.timezone }).format(
      new Date(),
    );
  }

  private async reader(ctx: AuthContext) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.fgView) throw permissionDenied('warehouse.finished_goods.view');
    return actor;
  }

  private branches(actor: ProductionActor) {
    return {
      companyId: actor.access.company.id,
      branchId: { in: actor.branches.map((b) => b.id) },
    };
  }

  private row(r: Full) {
    return {
      id: r.id,
      number: r.number,
      status: r.status,
      branch: r.branch,
      order: { id: r.order.id, number: r.order.number },
      output: { id: r.outputReport.id, number: r.outputReport.number },
      item: { id: r.order.itemId, code: r.order.itemCode, name: r.order.itemName },
      unit: { code: r.order.unitCode, precision: r.order.unitPrecision },
      quantity: sum(r.lines.map((l) => l.quantity)).toString(),
      lineCount: r.lines.length,
      createdBy: who(r.createdBy),
      createdAt: r.createdAt.toISOString(),
      postedAt: iso(r.postedAt),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private actions(actor: ProductionActor, r: Full) {
    const open = RECEIVABLE.includes(r.order.status);
    const out: ('edit' | 'post' | 'cancel' | 'reverse')[] = [];
    if (r.status === 'DRAFT') {
      if (actor.fgProcess && open) out.push('edit');
      if (actor.fgConfirm && open && r.outputReport.status === 'ACCEPTED') out.push('post');
      if (actor.fgProcess || actor.fgConfirm) out.push('cancel');
    } else if (r.status === 'POSTED' && actor.fgConfirm && open) {
      out.push('reverse');
    }
    return out;
  }

  // ------------------------------------------------------------------ reads

  /** Pending finished goods: accepted output of the member's branches not yet fully received. */
  async pending(ctx: AuthContext, q: { page: number; pageSize: number }) {
    const actor = await this.reader(ctx);
    const reports = await this.db.productionOutputReport.findMany({
      where: {
        ...this.branches(actor),
        status: 'ACCEPTED',
        order: {
          status: { in: [...RECEIVABLE] as ('IN_PRODUCTION' | 'PAUSED' | 'COMPLETION_REVIEW')[] },
        },
      },
      orderBy: [{ reviewedAt: 'asc' }, { id: 'asc' }],
      take: 500,
      include: {
        branch: { select: { id: true, code: true, name: true } },
        order: {
          select: {
            id: true,
            number: true,
            itemId: true,
            itemCode: true,
            itemName: true,
            unitCode: true,
            unitPrecision: true,
            item: { select: { lotTracking: true, expiryTracking: true } },
          },
        },
        receipts: { where: { status: 'DRAFT' }, select: { id: true } },
      },
    });
    const received = await receivedByReport(
      this.db,
      reports.map((r) => r.id),
    );
    const rows = reports
      .map((r) => {
        const got = received.get(r.id) ?? ZERO;
        const accepted = r.acceptedQuantity ?? ZERO;
        return {
          output: { id: r.id, number: r.number, productionDate: day(r.productionDate) },
          branch: r.branch,
          order: { id: r.order.id, number: r.order.number },
          item: { id: r.order.itemId, code: r.order.itemCode, name: r.order.itemName },
          unit: { code: r.order.unitCode, precision: r.order.unitPrecision },
          tracking: { lot: r.order.item.lotTracking, expiry: r.order.item.expiryTracking },
          accepted: accepted.toString(),
          received: got.toString(),
          pending: accepted.minus(got).toString(),
          draftReceipts: r.receipts.length,
        };
      })
      .filter((r) => new Decimal(r.pending).gt(0));
    const start = (q.page - 1) * q.pageSize;
    return {
      items: rows.slice(start, start + q.pageSize),
      total: rows.length,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: start + q.pageSize < rows.length,
    };
  }

  async list(ctx: AuthContext, q: FgReceiptListInput) {
    const actor = await this.reader(ctx);
    const and: Prisma.ProductionGoodsReceiptWhereInput[] = [this.branches(actor)];
    if (q.status) and.push({ status: q.status });
    if (q.outputReportId) and.push({ outputReportId: q.outputReportId });
    if (q.productionOrderId) and.push({ productionOrderId: q.productionOrderId });
    if (q.q) {
      const c = { contains: q.q, mode: 'insensitive' as const };
      and.push({
        OR: [{ number: c }, { order: { number: c } }, { outputReport: { number: c } }],
      });
    }
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      this.db.productionGoodsReceipt.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include,
      }),
      this.db.productionGoodsReceipt.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.row(r)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: (q.page - 1) * q.pageSize + rows.length < total,
    };
  }

  async get(ctx: AuthContext, id: string) {
    const actor = await this.reader(ctx);
    const r = await this.db.productionGoodsReceipt.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
    if (!r || !inBranch(actor, r.branchId)) throw receiptNotFound();
    const [timeline, received, item] = await Promise.all([
      this.db.auditLog.findMany({
        where: {
          companyId: r.companyId,
          entityType: 'ProductionGoodsReceipt',
          entityId: r.id,
          action: { in: TIMELINE },
        },
        orderBy: { occurredAt: 'asc' },
        include: { actor: { select: { fullName: true, email: true } } },
      }),
      receivedByReport(this.db, [r.outputReportId]),
      this.db.item.findUniqueOrThrow({
        where: { id: r.order.itemId },
        select: { lotTracking: true, expiryTracking: true },
      }),
    ]);
    const accepted = r.outputReport.acceptedQuantity ?? ZERO;
    const got = received.get(r.outputReportId) ?? ZERO;
    return {
      receipt: {
        ...this.row(r),
        note: r.note,
        tracking: { lot: item.lotTracking, expiry: item.expiryTracking },
        output: {
          id: r.outputReport.id,
          number: r.outputReport.number,
          status: r.outputReport.status,
          productionDate: day(r.outputReport.productionDate),
          accepted: accepted.toString(),
          received: got.toString(),
          pending: accepted.minus(got).toString(),
        },
        postedBy: who(r.postedBy),
        cancelledAt: iso(r.cancelledAt),
        cancelledBy: who(r.cancelledBy),
        cancellationReason: r.cancellationReason,
        reversedAt: iso(r.reversedAt),
        reversedBy: who(r.reversedBy),
        reversalReason: r.reversalReason,
        lines: r.lines.map((l) => ({
          id: l.id,
          lineNo: l.lineNo,
          location: l.location,
          lotNumber: l.lotNumber,
          expiryDate: day(l.expiryDate),
          manufacturedDate: day(l.manufacturedDate),
          lot: l.lot ? { id: l.lot.id, lotNumber: l.lot.lotNumber } : null,
          quantity: l.quantity.toString(),
        })),
        actions: this.actions(actor, r),
      },
      timeline: timeline.map((e) => ({
        type: e.action,
        at: e.occurredAt.toISOString(),
        actor: e.actor ? { name: e.actor.fullName ?? e.actor.email } : null,
      })),
    };
  }

  // ------------------------------------------------------------------ writes

  private event(
    tx: Prisma.TransactionClient,
    actor: ProductionActor,
    meta: RequestMeta,
    action: ProductionAuditAction,
    r: { id: string; number: string },
    details: Record<string, string | number | boolean | null> = {},
    entityType: 'ProductionGoodsReceipt' | 'InventoryLot' = 'ProductionGoodsReceipt',
  ) {
    return recordCompanyEvent(tx, meta, {
      action,
      actorId: actor.access.actor.userId,
      actorScope: this.scope,
      companyId: actor.access.company.id,
      entityType,
      entityId: r.id,
      details: { number: r.number, ...details },
    });
  }

  /** Order row → output report row (both FOR UPDATE), visible in the member's branches. */
  private async lockReport(tx: Prisma.TransactionClient, actor: ProductionActor, reportId: string) {
    const peek = await tx.productionOutputReport.findFirst({
      where: { id: reportId, companyId: actor.access.company.id },
      select: { productionOrderId: true, branchId: true },
    });
    if (!peek || !inBranch(actor, peek.branchId)) throw outputNotFound();
    await tx.$queryRaw`SELECT "id" FROM "ProductionOrder" WHERE "id" = ${peek.productionOrderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "ProductionOutputReport" WHERE "id" = ${reportId} FOR UPDATE`;
    const o = await tx.productionOrder.findUniqueOrThrow({ where: { id: peek.productionOrderId } });
    const report = await tx.productionOutputReport.findUniqueOrThrow({ where: { id: reportId } });
    return { o, report };
  }

  /** …then the receipt row (FOR UPDATE). */
  private async lockReceipt(tx: Prisma.TransactionClient, actor: ProductionActor, id: string) {
    const peek = await tx.productionGoodsReceipt.findFirst({
      where: { id, companyId: actor.access.company.id },
      select: { outputReportId: true, branchId: true },
    });
    if (!peek || !inBranch(actor, peek.branchId)) throw receiptNotFound();
    const { o, report } = await this.lockReport(tx, actor, peek.outputReportId);
    await tx.$queryRaw`SELECT "id" FROM "ProductionGoodsReceipt" WHERE "id" = ${id} FOR UPDATE`;
    const r = await tx.productionGoodsReceipt.findUniqueOrThrow({ where: { id } });
    return { o, report, r };
  }

  private receivable(o: { status: string }) {
    if (!RECEIVABLE.includes(o.status)) {
      throw fail(
        409,
        o.status === 'COMPLETED' ? 'MO_COMPLETED' : 'MO_NOT_RECEIVABLE',
        'Finished goods are received only for an order in production or under completion review.',
        { status: o.status },
      );
    }
  }

  private accepted(report: { status: string; acceptedQuantity: Decimal | null }) {
    if (report.status !== 'ACCEPTED' || !report.acceptedQuantity) {
      throw fail(409, 'OUTPUT_NOT_ACCEPTED', 'Only accepted good output can be received.', {
        status: report.status,
      });
    }
    return report.acceptedQuantity;
  }

  /**
   * The lines under the item's rules now (precision, lot / expiry tracking, expired,
   * production date, one expiry per lot), locations of the branch, known lots
   * consistent — the purchase-receiving rules, reused.
   */
  private async checkLines(
    tx: Prisma.TransactionClient,
    actor: ProductionActor,
    o: { branchId: string; itemId: string; unitPrecision: number },
    lines: readonly AllocationInput[],
  ) {
    const item = await tx.item.findUniqueOrThrow({ where: { id: o.itemId }, select: itemRules });
    if (item.status !== 'ACTIVE') {
      throw fail(409, 'REFERENCE_INACTIVE', 'The selected record is inactive.', {
        field: 'itemId',
      });
    }
    const total = sum(lines.map((l) => new Decimal(l.quantity)));
    const n = normalizeLine(
      { lineNo: 1, precision: o.unitPrecision, item },
      { acceptedQuantity: total.toString(), allocations: lines },
      this.today(actor),
    );
    await assertLocations(
      tx,
      o.branchId,
      n.allocations.map((a) => a.locationId),
    );
    await assertKnownLots(tx, actor.access.company.id, o.itemId, n.allocations, 1);
    await this.assertMadeDates(tx, actor.access.company.id, o.itemId, n.allocations);
    return { allocations: n.allocations, total };
  }

  /** A known lot keeps its production date too (expiry is checked by assertKnownLots). */
  private async assertMadeDates(
    tx: Prisma.TransactionClient,
    companyId: string,
    itemId: string,
    allocations: readonly { lotNumber: string | null; manufacturedDate: string | null }[],
  ) {
    const given = new Map<string, string | null>();
    for (const a of allocations) {
      if (!a.lotNumber) continue;
      if (given.has(a.lotNumber) && given.get(a.lotNumber) !== a.manufacturedDate) {
        throw fail(409, 'LOT_MANUFACTURED_MISMATCH', 'One lot has one production date.', {
          lotNumber: a.lotNumber,
        });
      }
      given.set(a.lotNumber, a.manufacturedDate);
    }
    if (!given.size) return;
    const lots = await tx.inventoryLot.findMany({
      where: { companyId, itemId, lotNumber: { in: [...given.keys()] } },
      select: { lotNumber: true, manufacturedDate: true },
    });
    for (const lot of lots) {
      const known = day(lot.manufacturedDate);
      const mine = given.get(lot.lotNumber) ?? null;
      if (known !== null && mine !== null && known !== mine) {
        throw fail(
          409,
          'LOT_MANUFACTURED_MISMATCH',
          'This lot is already known with another production date.',
          { lotNumber: lot.lotNumber, manufacturedDate: known },
        );
      }
    }
  }

  private async writeLines(
    tx: Prisma.TransactionClient,
    r: { id: string; companyId: string; branchId: string; productionOrderId: string },
    itemId: string,
    allocations: Awaited<ReturnType<FinishedGoodsService['checkLines']>>['allocations'],
  ) {
    await tx.productionGoodsReceiptLine.deleteMany({ where: { receiptId: r.id } });
    await tx.productionGoodsReceiptLine.createMany({
      data: allocations.map((a, i) => ({
        companyId: r.companyId,
        branchId: r.branchId,
        receiptId: r.id,
        productionOrderId: r.productionOrderId,
        lineNo: i + 1,
        itemId,
        locationId: a.locationId,
        lotNumber: a.lotNumber,
        expiryDate: a.expiryDate ? new Date(`${a.expiryDate}T00:00:00Z`) : null,
        manufacturedDate: a.manufacturedDate ? new Date(`${a.manufacturedDate}T00:00:00Z`) : null,
        quantity: a.quantity,
      })),
    });
    await tx.productionGoodsReceipt.update({
      where: { id: r.id },
      data: { lineCounter: allocations.length },
    });
  }

  private exceeds(pending: Decimal) {
    return fail(
      409,
      'FG_EXCEEDS_ACCEPTED',
      'This is more than the accepted good output still waiting to be received.',
      { pending: pending.toString() },
    );
  }

  async create(ctx: AuthContext, input: CreateFgReceiptInput, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    const id = await this.createAs(actor, input, meta);
    return this.get(ctx, id);
  }

  async createAs(actor: ProductionActor, input: CreateFgReceiptInput, meta: RequestMeta) {
    if (!actor.fgView) throw permissionDenied('warehouse.finished_goods.view');
    if (!actor.fgProcess) throw permissionDenied('warehouse.finished_goods.process');
    const companyId = actor.access.company.id;
    return this.db.$transaction(async (tx) => {
      const { o, report } = await this.lockReport(tx, actor, input.outputReportId);
      this.receivable(o);
      const accepted = this.accepted(report);
      const { allocations, total } = await this.checkLines(tx, actor, o, input.lines);
      // Drafts may overlap; posting re-checks against what is received by then.
      const pending = accepted.minus(
        (await receivedByReport(tx, [report.id])).get(report.id) ?? ZERO,
      );
      if (total.gt(pending)) throw this.exceeds(pending);
      const period = this.today(actor).slice(0, 7).replace('-', '');
      const seq = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
        VALUES (${companyId}, ${`FGR:${period}`}, 1, NOW())
        ON CONFLICT ("companyId", "key")
        DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue"`;
      const r = await tx.productionGoodsReceipt.create({
        data: {
          companyId,
          branchId: o.branchId,
          productionOrderId: o.id,
          outputReportId: report.id,
          number: `FGR-${period}-${String(seq[0]!.lastValue).padStart(6, '0')}`,
          note: input.note ?? null,
          createdByMemberId: actor.memberId,
        },
      });
      await this.writeLines(tx, r, o.itemId, allocations);
      await this.event(tx, actor, meta, 'FINISHED_GOODS_RECEIPT_CREATED', r, {
        order: o.number,
        output: report.number,
        lines: allocations.length,
      });
      return r.id;
    });
  }

  async updateLines(
    ctx: AuthContext,
    id: string,
    input: { lines: AllocationInput[]; note?: string | null },
    meta: RequestMeta,
  ) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.fgView) throw permissionDenied('warehouse.finished_goods.view');
    await this.db.$transaction(async (tx) => {
      const { o, report, r } = await this.lockReceipt(tx, actor, id);
      if (!actor.fgProcess) throw permissionDenied('warehouse.finished_goods.process');
      if (r.status !== 'DRAFT') {
        throw fail(409, 'FGR_NOT_EDITABLE', 'Only a draft receipt can be edited.', {
          status: r.status,
        });
      }
      this.receivable(o);
      const accepted = this.accepted(report);
      const { allocations, total } = await this.checkLines(tx, actor, o, input.lines);
      const pending = accepted.minus(
        (await receivedByReport(tx, [report.id])).get(report.id) ?? ZERO,
      );
      if (total.gt(pending)) throw this.exceeds(pending);
      await this.writeLines(tx, r, o.itemId, allocations);
      if (input.note !== undefined) {
        await tx.productionGoodsReceipt.update({ where: { id }, data: { note: input.note } });
      }
      await this.event(tx, actor, meta, 'FINISHED_GOODS_RECEIPT_UPDATED', r, {
        lines: allocations.length,
      });
    });
    return this.get(ctx, id);
  }

  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.fgView) throw permissionDenied('warehouse.finished_goods.view');
    await this.db.$transaction(async (tx) => {
      const { r } = await this.lockReceipt(tx, actor, id);
      if (!actor.fgProcess && !actor.fgConfirm) {
        throw permissionDenied('warehouse.finished_goods.process');
      }
      if (r.status !== 'DRAFT') {
        throw fail(
          409,
          'FGR_INVALID_TRANSITION',
          'Only a draft receipt can be cancelled; a posted one is reversed.',
          { status: r.status },
        );
      }
      await tx.productionGoodsReceipt.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      await this.event(tx, actor, meta, 'FINISHED_GOODS_RECEIPT_CANCELLED', r, {
        from: 'DRAFT',
        to: 'CANCELLED',
      });
    });
    return this.get(ctx, id);
  }

  private ledger(actor: ProductionActor, meta: RequestMeta): LedgerActor {
    return {
      companyId: actor.access.company.id,
      memberId: actor.memberId,
      userId: actor.access.actor.userId,
      scope: this.scope,
      meta,
    };
  }

  async post(
    ctx: AuthContext,
    id: string,
    meta: RequestMeta,
    override: OwnerOverride | null = null,
  ) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.postAs(actor, id, meta, override);
    return this.get(ctx, id);
  }

  /** DRAFT → POSTED: the one moment finished goods enter stock (see the header). */
  async postAs(
    actor: ProductionActor,
    id: string,
    meta: RequestMeta,
    override: OwnerOverride | null = null,
  ) {
    if (!actor.fgView) throw permissionDenied('warehouse.finished_goods.view');
    await this.db.$transaction(async (tx) => {
      const { o, report, r } = await this.lockReceipt(tx, actor, id);
      if (!actor.fgConfirm) throw permissionDenied('warehouse.finished_goods.confirm');
      // EP41: posting is independent of who drafted the receipt, when required.
      await requireIndependentDecision(
        tx,
        meta,
        actor.access,
        {
          decision: 'post',
          entityType: 'ProductionGoodsReceipt',
          entityId: id,
          number: r.number,
          branchId: r.branchId,
          originators: [{ role: 'creator', memberId: r.createdByMemberId }],
        },
        override,
        this.scope,
      );
      if (r.status !== 'DRAFT') {
        throw fail(
          409,
          r.status === 'POSTED' || r.status === 'REVERSED'
            ? 'FGR_ALREADY_POSTED'
            : 'FGR_INVALID_TRANSITION',
          'This receipt is no longer a draft.',
          { status: r.status },
        );
      }
      this.receivable(o);
      const accepted = this.accepted(report);
      const lines = await tx.productionGoodsReceiptLine.findMany({
        where: { receiptId: id },
        orderBy: { lineNo: 'asc' },
      });
      if (!lines.length) throw fail(422, 'DOCUMENT_EMPTY', 'This receipt has no lines.');
      const { allocations, total } = await this.checkLines(
        tx,
        actor,
        o,
        lines.map((l) => ({
          locationId: l.locationId,
          lotNumber: l.lotNumber,
          expiryDate: day(l.expiryDate),
          manufacturedDate: day(l.manufacturedDate),
          quantity: l.quantity.toString(),
        })),
      );
      // Read AFTER the order and report locks: every receipt posted before us is counted.
      const pending = accepted.minus(
        (await receivedByReport(tx, [report.id])).get(report.id) ?? ZERO,
      );
      if (total.gt(pending)) throw this.exceeds(pending);
      const a = this.ledger(actor, meta);
      await lockLocations(
        tx,
        lines.map((l) => l.locationId),
        'shared',
      );
      const now = new Date();
      let lotsCreated = 0;
      for (const [i, l] of lines.entries()) {
        const x = allocations[i]!;
        let lotId: string | null = null;
        if (x.lotNumber) {
          const lot = await resolveLot(
            tx,
            a,
            o.itemId,
            x.lotNumber,
            x.expiryDate,
            x.manufacturedDate,
          );
          lotId = lot.id;
          if (!lot.created && x.manufacturedDate) {
            // A lot created concurrently by another receipt: its production date must agree too.
            const known = await tx.inventoryLot.findUniqueOrThrow({
              where: { id: lot.id },
              select: { manufacturedDate: true },
            });
            if (known.manufacturedDate && day(known.manufacturedDate) !== x.manufacturedDate) {
              throw fail(
                409,
                'LOT_MANUFACTURED_MISMATCH',
                'This lot is already known with another production date.',
                { lotNumber: x.lotNumber, manufacturedDate: day(known.manufacturedDate) },
              );
            }
          }
          if (lot.created) {
            lotsCreated++;
            await this.event(
              tx,
              actor,
              meta,
              'INVENTORY_LOT_CREATED',
              { id: lot.id, number: x.lotNumber },
              { item: o.itemCode, receipt: r.number },
              'InventoryLot',
            );
          }
          await tx.productionGoodsReceiptLine.update({ where: { id: l.id }, data: { lotId } });
        }
        await applyMovement(tx, a, {
          branchId: o.branchId,
          locationId: l.locationId,
          itemId: o.itemId,
          lotId,
          type: 'PRODUCTION_OUTPUT',
          delta: l.quantity,
          source: {
            sourceType: 'PRODUCTION_RECEIPT',
            productionGoodsReceiptId: id,
            productionGoodsReceiptLineId: l.id,
          },
          occurredAt: now,
        });
      }
      const changed = await tx.productionGoodsReceipt.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'POSTED', postedAt: now, postedByMemberId: actor.memberId },
      });
      if (changed.count !== 1) {
        throw fail(409, 'FGR_ALREADY_POSTED', 'This receipt is no longer a draft.');
      }
      await this.event(tx, actor, meta, 'FINISHED_GOODS_RECEIPT_POSTED', r, {
        order: o.number,
        output: report.number,
        from: 'DRAFT',
        to: 'POSTED',
        lines: lines.length,
        lotsCreated,
      });
    });
  }

  async reverse(ctx: AuthContext, id: string, reason: string, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.reverseAs(actor, id, reason, meta);
    return this.get(ctx, id);
  }

  /**
   * POSTED → REVERSED: one PRODUCTION_OUTPUT_REVERSAL per line through the ledger.
   * The decrease guard refuses when the stock is no longer all on hand (sold,
   * moved, adjusted — INSUFFICIENT_STOCK) or is reserved for sales or
   * production (STOCK_RESERVED): finished goods already promised or gone are
   * never silently taken back. The output becomes receivable again.
   */
  async reverseAs(actor: ProductionActor, id: string, reason: string, meta: RequestMeta) {
    if (!actor.fgView) throw permissionDenied('warehouse.finished_goods.view');
    await this.db.$transaction(async (tx) => {
      const { o, r } = await this.lockReceipt(tx, actor, id);
      if (!actor.fgConfirm) throw permissionDenied('warehouse.finished_goods.confirm');
      if (r.status !== 'POSTED') {
        throw fail(409, 'FGR_INVALID_TRANSITION', 'Only a posted receipt can be reversed.', {
          status: r.status,
        });
      }
      this.receivable(o);
      const lines = await tx.productionGoodsReceiptLine.findMany({
        where: { receiptId: id },
        orderBy: { id: 'asc' },
      });
      const a = this.ledger(actor, meta);
      await lockLocations(
        tx,
        lines.map((l) => l.locationId),
        'shared',
      );
      const now = new Date();
      for (const l of lines) {
        await applyMovement(tx, a, {
          branchId: o.branchId,
          locationId: l.locationId,
          itemId: o.itemId,
          lotId: l.lotId,
          type: 'PRODUCTION_OUTPUT_REVERSAL',
          delta: ZERO.minus(l.quantity),
          source: {
            sourceType: 'PRODUCTION_RECEIPT',
            productionGoodsReceiptId: id,
            productionGoodsReceiptLineId: l.id,
          },
          occurredAt: now,
          short: () =>
            fail(
              409,
              'FGR_STOCK_GONE',
              'These finished goods are no longer all on hand, so the receipt cannot be reversed.',
              { lineNo: l.lineNo },
            ),
        });
      }
      const changed = await tx.productionGoodsReceipt.updateMany({
        where: { id, status: 'POSTED' },
        data: {
          status: 'REVERSED',
          reversedAt: now,
          reversedByMemberId: actor.memberId,
          reversalReason: reason,
        },
      });
      if (changed.count !== 1) {
        throw fail(409, 'FGR_INVALID_TRANSITION', 'Only a posted receipt can be reversed.');
      }
      await this.event(tx, actor, meta, 'FINISHED_GOODS_RECEIPT_REVERSED', r, {
        from: 'POSTED',
        to: 'REVERSED',
        lines: lines.length,
      });
    });
  }
}
