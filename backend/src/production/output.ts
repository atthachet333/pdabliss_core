import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import { recordCompanyEvent, type ProductionAuditAction } from '../company/audit.js';
import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { permissionDenied } from '../permissions/guard.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import type { CreateOutputInput, OutputListInput, UpdateOutputInput } from './input.js';
import {
  assertMo,
  canSee,
  inBranch,
  loadProductionActor,
  orderNotFound,
  outputNotFound,
  type ProductionActor,
} from './policy.js';

/*
 * Production output reports (EP38) — docs/PRODUCTION_OUTPUT.md. An output
 * report (OUT-YYYYMM-NNNNNN) records what production made for one order: good,
 * defective and pending-quality quantities of the order's finished item, in its
 * unit. It NEVER moves stock: only a POSTED finished goods receipt does
 * (receipts.ts → PRODUCTION_OUTPUT through ledger.ts).
 *
 *   DRAFT → SUBMITTED → ACCEPTED | REJECTED; DRAFT / SUBMITTED → CANCELLED;
 *   ACCEPTED → CANCELLED only while nothing of it is received.
 *
 * Acceptance is the quality decision: accepted = good + the pending part judged
 * good, rejected = defective + the rest. Σ accepted per order never exceeds the
 * target. Every write locks the production order row first, then the report
 * row (the global order: order → report → receipt → locations → balances).
 */

const fail = (status: number, code: string, message: string, details?: object) =>
  new AppError(status, code, message, details);
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const day = (d: Date) => d.toISOString().slice(0, 10);
const places = (q: string) => (q.split('.')[1] ?? '').replace(/0+$/, '').length;
const person = { select: { user: { select: { fullName: true, email: true } } } } as const;
const who = (m: { user: { fullName: string | null; email: string } } | null) =>
  m ? { name: m.user.fullName ?? m.user.email } : null;
const sum = (xs: readonly (Decimal | null | undefined)[]) =>
  xs.reduce<Decimal>((t, x) => t.plus(x ?? ZERO), ZERO);

type Tx = Prisma.TransactionClient | Db;

/** Σ posted (not reversed) finished goods receipt quantity per output report. */
export async function receivedByReport(tx: Tx, reportIds: readonly string[]) {
  const out = new Map<string, Decimal>();
  if (!reportIds.length) return out;
  const rows = await tx.productionGoodsReceiptLine.findMany({
    where: { receipt: { outputReportId: { in: [...reportIds] }, status: 'POSTED' } },
    select: { quantity: true, receipt: { select: { outputReportId: true } } },
  });
  for (const r of rows) {
    const k = r.receipt.outputReportId;
    out.set(k, (out.get(k) ?? ZERO).plus(r.quantity));
  }
  return out;
}

export interface OutputProgressFigures {
  target: Decimal;
  goodReported: Decimal;
  pendingReview: Decimal;
  accepted: Decimal;
  rejected: Decimal;
  received: Decimal;
  awaitingReceipt: Decimal;
  remaining: Decimal;
}

/** An order's output figures, derived (never stored): what was reported, accepted, received. */
export async function outputProgress(
  tx: Tx,
  o: { id: string; quantity: Decimal },
): Promise<OutputProgressFigures> {
  const reports = await tx.productionOutputReport.findMany({
    where: { productionOrderId: o.id, status: { in: ['SUBMITTED', 'ACCEPTED'] } },
    select: {
      id: true,
      status: true,
      goodQuantity: true,
      defectiveQuantity: true,
      pendingQuantity: true,
      acceptedQuantity: true,
      rejectedQuantity: true,
    },
  });
  const accepted = reports.filter((r) => r.status === 'ACCEPTED');
  const submitted = reports.filter((r) => r.status === 'SUBMITTED');
  const received = sum([
    ...(
      await receivedByReport(
        tx,
        accepted.map((r) => r.id),
      )
    ).values(),
  ]);
  const acc = sum(accepted.map((r) => r.acceptedQuantity));
  return {
    target: o.quantity,
    goodReported: sum(reports.map((r) => r.goodQuantity)),
    pendingReview: sum(submitted.map((r) => r.pendingQuantity)),
    accepted: acc,
    rejected: sum([
      ...accepted.map((r) => r.rejectedQuantity),
      ...submitted.map((r) => r.defectiveQuantity),
    ]),
    received,
    awaitingReceipt: acc.minus(received),
    remaining: Decimal.max(ZERO, o.quantity.minus(acc)),
  };
}

export const progressJson = (p: OutputProgressFigures) => ({
  target: p.target.toString(),
  goodReported: p.goodReported.toString(),
  pendingReview: p.pendingReview.toString(),
  accepted: p.accepted.toString(),
  rejected: p.rejected.toString(),
  received: p.received.toString(),
  awaitingReceipt: p.awaitingReceipt.toString(),
  remaining: p.remaining.toString(),
});

const include = {
  branch: { select: { id: true, code: true, name: true } },
  order: {
    select: {
      id: true,
      number: true,
      status: true,
      branchId: true,
      createdByMemberId: true,
      itemId: true,
      itemCode: true,
      itemName: true,
      unitCode: true,
      unitPrecision: true,
      quantity: true,
    },
  },
  createdBy: person,
  submittedBy: person,
  reviewedBy: person,
  cancelledBy: person,
  receipts: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      number: true,
      status: true,
      postedAt: true,
      lines: { select: { quantity: true } },
    },
  },
} satisfies Prisma.ProductionOutputReportInclude;
type Full = Prisma.ProductionOutputReportGetPayload<{ include: typeof include }>;

const TIMELINE: ProductionAuditAction[] = [
  'PRODUCTION_OUTPUT_CREATED',
  'PRODUCTION_OUTPUT_UPDATED',
  'PRODUCTION_OUTPUT_SUBMITTED',
  'PRODUCTION_OUTPUT_ACCEPTED',
  'PRODUCTION_OUTPUT_REJECTED',
  'PRODUCTION_OUTPUT_CANCELLED',
];
/** Output may be reviewed (accepted / rejected) while the order is still open or under review. */
const REVIEWABLE: readonly string[] = ['IN_PRODUCTION', 'PAUSED', 'COMPLETION_REVIEW'];

export class OutputService {
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
    if (!actor.view) throw permissionDenied('operations.orders.view');
    return actor;
  }

  private where(
    actor: ProductionActor,
    branchId?: string,
  ): Prisma.ProductionOutputReportWhereInput {
    const ids = actor.branches.map((b) => b.id);
    return {
      companyId: actor.access.company.id,
      branchId: { in: branchId ? ids.filter((b) => b === branchId) : ids },
    };
  }

  private received(r: Full) {
    return sum(
      r.receipts
        .filter((x) => x.status === 'POSTED')
        .flatMap((x) => x.lines.map((l) => l.quantity)),
    );
  }

  private row(r: Full) {
    const received = this.received(r);
    return {
      id: r.id,
      number: r.number,
      status: r.status,
      branch: r.branch,
      order: { id: r.order.id, number: r.order.number, status: r.order.status },
      item: { id: r.order.itemId, code: r.order.itemCode, name: r.order.itemName },
      unit: { code: r.order.unitCode, precision: r.order.unitPrecision },
      productionDate: day(r.productionDate),
      good: r.goodQuantity.toString(),
      defective: r.defectiveQuantity.toString(),
      pending: r.pendingQuantity.toString(),
      accepted: r.acceptedQuantity?.toString() ?? null,
      rejected: r.rejectedQuantity?.toString() ?? null,
      received: received.toString(),
      awaitingReceipt: r.acceptedQuantity ? r.acceptedQuantity.minus(received).toString() : '0',
      createdBy: who(r.createdBy),
      createdAt: r.createdAt.toISOString(),
      submittedAt: iso(r.submittedAt),
      reviewedAt: iso(r.reviewedAt),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private actions(actor: ProductionActor, r: Full) {
    const out: ('edit' | 'submit' | 'accept' | 'reject' | 'cancel')[] = [];
    const own = r.createdByMemberId === actor.memberId && actor.outputCreate;
    const open = r.order.status === 'IN_PRODUCTION' || r.order.status === 'PAUSED';
    if (r.status === 'DRAFT') {
      if (own && open) out.push('edit', 'submit');
      if (own || actor.outputApprove) out.push('cancel');
    } else if (r.status === 'SUBMITTED') {
      if (actor.outputApprove && REVIEWABLE.includes(r.order.status)) out.push('accept', 'reject');
      if (own || actor.outputApprove) out.push('cancel');
    } else if (r.status === 'ACCEPTED') {
      const blocked = r.receipts.some((x) => x.status === 'POSTED');
      if (actor.outputApprove && !blocked && REVIEWABLE.includes(r.order.status))
        out.push('cancel');
    }
    return out;
  }

  private async view(actor: ProductionActor, r: Full) {
    const timeline = await this.db.auditLog.findMany({
      where: {
        companyId: r.companyId,
        entityType: 'ProductionOutputReport',
        entityId: r.id,
        action: { in: TIMELINE },
      },
      orderBy: { occurredAt: 'asc' },
      include: { actor: { select: { fullName: true, email: true } } },
    });
    return {
      report: {
        ...this.row(r),
        note: r.note,
        submittedBy: who(r.submittedBy),
        reviewedBy: who(r.reviewedBy),
        rejectionReason: r.rejectionReason,
        cancelledAt: iso(r.cancelledAt),
        cancelledBy: who(r.cancelledBy),
        cancellationReason: r.cancellationReason,
        receipts: r.receipts.map((x) => ({
          id: x.id,
          number: x.number,
          status: x.status,
          postedAt: iso(x.postedAt),
          quantity: sum(x.lines.map((l) => l.quantity)).toString(),
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

  /** A DRAFT is visible to its reporter and to approvers only (like EP36 drafts). */
  private visible(actor: ProductionActor, r: { status: string; createdByMemberId: string }) {
    return r.status !== 'DRAFT' || r.createdByMemberId === actor.memberId || actor.outputApprove;
  }

  // ------------------------------------------------------------------ reads

  async list(ctx: AuthContext, q: OutputListInput) {
    const actor = await this.reader(ctx);
    const and: Prisma.ProductionOutputReportWhereInput[] = [this.where(actor, q.branchId)];
    if (!actor.outputApprove) {
      and.push({ OR: [{ status: { not: 'DRAFT' } }, { createdByMemberId: actor.memberId }] });
    }
    if (q.status) and.push({ status: q.status });
    if (q.productionOrderId) and.push({ productionOrderId: q.productionOrderId });
    if (q.q) {
      const c = { contains: q.q, mode: 'insensitive' as const };
      and.push({ OR: [{ number: c }, { order: { number: c } }, { order: { itemCode: c } }] });
    }
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      this.db.productionOutputReport.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include,
      }),
      this.db.productionOutputReport.count({ where }),
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
    const r = await this.db.productionOutputReport.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
    if (!r || !inBranch(actor, r.branchId) || !this.visible(actor, r)) throw outputNotFound();
    return this.view(actor, r);
  }

  // ------------------------------------------------------------------ writes

  private event(
    tx: Prisma.TransactionClient,
    actor: ProductionActor,
    meta: RequestMeta,
    action: ProductionAuditAction,
    r: { id: string; number: string },
    details: Record<string, string | number | boolean | null> = {},
  ) {
    return recordCompanyEvent(tx, meta, {
      action,
      actorId: actor.access.actor.userId,
      actorScope: this.scope,
      companyId: actor.access.company.id,
      entityType: 'ProductionOutputReport',
      entityId: r.id,
      details: { number: r.number, ...details },
    });
  }

  /** Order row FOR UPDATE (visible to the member), then the report row FOR UPDATE. */
  private async lockedReport(tx: Prisma.TransactionClient, actor: ProductionActor, id: string) {
    if (!actor.view) throw permissionDenied('operations.orders.view');
    const peek = await tx.productionOutputReport.findFirst({
      where: { id, companyId: actor.access.company.id },
      select: { productionOrderId: true, branchId: true, status: true, createdByMemberId: true },
    });
    if (!peek || !inBranch(actor, peek.branchId) || !this.visible(actor, peek)) {
      throw outputNotFound();
    }
    await tx.$queryRaw`SELECT "id" FROM "ProductionOrder" WHERE "id" = ${peek.productionOrderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "ProductionOutputReport" WHERE "id" = ${id} FOR UPDATE`;
    const o = await tx.productionOrder.findUniqueOrThrow({ where: { id: peek.productionOrderId } });
    const r = await tx.productionOutputReport.findUniqueOrThrow({ where: { id } });
    return { o, r };
  }

  private figures(
    o: { unitPrecision: number },
    input: { goodQuantity?: string; defectiveQuantity?: string; pendingQuantity?: string },
    base?: { goodQuantity: Decimal; defectiveQuantity: Decimal; pendingQuantity: Decimal },
  ) {
    const q = {
      goodQuantity: input.goodQuantity ?? base?.goodQuantity.toString() ?? '0',
      defectiveQuantity: input.defectiveQuantity ?? base?.defectiveQuantity.toString() ?? '0',
      pendingQuantity: input.pendingQuantity ?? base?.pendingQuantity.toString() ?? '0',
    };
    for (const [field, v] of Object.entries(q)) {
      if (places(v) > o.unitPrecision) {
        throw fail(
          422,
          'QUANTITY_PRECISION',
          'A quantity has more decimal places than its unit allows.',
          {
            field,
            precision: o.unitPrecision,
          },
        );
      }
    }
    const good = new Decimal(q.goodQuantity);
    const defective = new Decimal(q.defectiveQuantity);
    const pending = new Decimal(q.pendingQuantity);
    if (good.plus(defective).plus(pending).isZero()) {
      throw fail(422, 'OUTPUT_EMPTY', 'Report a good, defective or pending quantity.');
    }
    return { goodQuantity: good, defectiveQuantity: defective, pendingQuantity: pending };
  }

  private checkDate(actor: ProductionActor, o: { startedAt: Date | null }, date: string) {
    const started = o.startedAt
      ? new Intl.DateTimeFormat('en-CA', { timeZone: actor.access.company.timezone }).format(
          o.startedAt,
        )
      : null;
    if (date > this.today(actor) || (started && date < started)) {
      throw fail(
        422,
        'OUTPUT_DATE_INVALID',
        'The production date must be between the start of production and today.',
        { field: 'productionDate', earliest: started, latest: this.today(actor) },
      );
    }
  }

  async create(ctx: AuthContext, input: CreateOutputInput, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    const id = await this.createAs(actor, input, meta);
    return this.get(ctx, id);
  }

  async createAs(actor: ProductionActor, input: CreateOutputInput, meta: RequestMeta) {
    if (!actor.view) throw permissionDenied('operations.orders.view');
    if (!actor.outputCreate) throw permissionDenied('operations.output.create');
    const companyId = actor.access.company.id;
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ProductionOrder" WHERE "id" = ${input.productionOrderId} FOR UPDATE`;
      const o = await tx.productionOrder.findFirst({
        where: { id: input.productionOrderId, companyId },
      });
      if (!o || !canSee(actor, o)) throw orderNotFound();
      assertMo(actor, 'output', o);
      const q = this.figures(o, input);
      this.checkDate(actor, o, input.productionDate);
      const period = this.today(actor).slice(0, 7).replace('-', '');
      const seq = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
        VALUES (${companyId}, ${`OUT:${period}`}, 1, NOW())
        ON CONFLICT ("companyId", "key")
        DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue"`;
      const r = await tx.productionOutputReport.create({
        data: {
          companyId,
          branchId: o.branchId,
          productionOrderId: o.id,
          number: `OUT-${period}-${String(seq[0]!.lastValue).padStart(6, '0')}`,
          productionDate: new Date(`${input.productionDate}T00:00:00Z`),
          ...q,
          note: input.note ?? null,
          createdByMemberId: actor.memberId,
        },
      });
      await this.event(tx, actor, meta, 'PRODUCTION_OUTPUT_CREATED', r, { order: o.number });
      return r.id;
    });
  }

  async update(ctx: AuthContext, id: string, input: UpdateOutputInput, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const { o, r } = await this.lockedReport(tx, actor, id);
      if (r.createdByMemberId !== actor.memberId || !actor.outputCreate) {
        throw permissionDenied('operations.output.create');
      }
      if (r.status !== 'DRAFT') {
        throw fail(409, 'OUTPUT_NOT_EDITABLE', 'Only a draft output report can be edited.', {
          status: r.status,
        });
      }
      assertMo(actor, 'output', o);
      const q = this.figures(o, input, r);
      if (input.productionDate) this.checkDate(actor, o, input.productionDate);
      await tx.productionOutputReport.update({
        where: { id },
        data: {
          ...q,
          ...(input.productionDate
            ? { productionDate: new Date(`${input.productionDate}T00:00:00Z`) }
            : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
        },
      });
      await this.event(tx, actor, meta, 'PRODUCTION_OUTPUT_UPDATED', r);
    });
    return this.get(ctx, id);
  }

  /** Σ accepted good of the order's other reports (under the order lock). */
  private async acceptedElsewhere(tx: Prisma.TransactionClient, orderId: string, except: string) {
    const a = await tx.productionOutputReport.aggregate({
      where: { productionOrderId: orderId, status: 'ACCEPTED', id: { not: except } },
      _sum: { acceptedQuantity: true },
    });
    return a._sum.acceptedQuantity ?? ZERO;
  }

  async submit(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.submitAs(actor, id, meta);
    return this.get(ctx, id);
  }

  async submitAs(actor: ProductionActor, id: string, meta: RequestMeta) {
    await this.db.$transaction(async (tx) => {
      const { o, r } = await this.lockedReport(tx, actor, id);
      if (r.createdByMemberId !== actor.memberId || !actor.outputCreate) {
        throw permissionDenied('operations.output.create');
      }
      if (r.status !== 'DRAFT') {
        throw fail(409, 'OUTPUT_ALREADY_SUBMITTED', 'This output report was already submitted.', {
          status: r.status,
        });
      }
      assertMo(actor, 'output', o);
      // Good output never exceeds the target: what is accepted plus what waits for review.
      const submitted = await tx.productionOutputReport.aggregate({
        where: { productionOrderId: o.id, status: 'SUBMITTED' },
        _sum: { goodQuantity: true },
      });
      const claimed = (await this.acceptedElsewhere(tx, o.id, id))
        .plus(submitted._sum.goodQuantity ?? ZERO)
        .plus(r.goodQuantity);
      if (claimed.gt(o.quantity)) {
        throw fail(
          409,
          'OUTPUT_EXCEEDS_TARGET',
          'This is more good output than the order targets.',
          {
            target: o.quantity.toString(),
          },
        );
      }
      await tx.productionOutputReport.update({
        where: { id },
        data: { status: 'SUBMITTED', submittedAt: new Date(), submittedByMemberId: actor.memberId },
      });
      await this.event(tx, actor, meta, 'PRODUCTION_OUTPUT_SUBMITTED', r, {
        from: 'DRAFT',
        to: 'SUBMITTED',
      });
    });
  }

  async accept(ctx: AuthContext, id: string, pendingGood: string | undefined, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.acceptAs(actor, id, pendingGood, meta);
    return this.get(ctx, id);
  }

  async acceptAs(
    actor: ProductionActor,
    id: string,
    pendingGood: string | undefined,
    meta: RequestMeta,
  ) {
    await this.db.$transaction(async (tx) => {
      const { o, r } = await this.lockedReport(tx, actor, id);
      if (!actor.outputApprove) throw permissionDenied('operations.output.approve');
      if (r.status !== 'SUBMITTED') {
        throw fail(
          409,
          r.status === 'ACCEPTED' ? 'OUTPUT_ALREADY_ACCEPTED' : 'OUTPUT_INVALID_TRANSITION',
          'This output report is not waiting for review.',
          { status: r.status },
        );
      }
      this.reviewable(o);
      const extra = new Decimal(pendingGood ?? '0');
      if (places(pendingGood ?? '0') > o.unitPrecision || extra.gt(r.pendingQuantity)) {
        throw fail(
          422,
          'PENDING_DECISION_INVALID',
          'The good part of the pending quantity must be between zero and the pending quantity.',
          { field: 'pendingGood', pending: r.pendingQuantity.toString() },
        );
      }
      const accepted = r.goodQuantity.plus(extra);
      const rejected = r.defectiveQuantity.plus(r.pendingQuantity.minus(extra));
      if ((await this.acceptedElsewhere(tx, o.id, id)).plus(accepted).gt(o.quantity)) {
        throw fail(
          409,
          'OUTPUT_EXCEEDS_TARGET',
          'This is more good output than the order targets.',
          {
            target: o.quantity.toString(),
          },
        );
      }
      await tx.productionOutputReport.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          acceptedQuantity: accepted,
          rejectedQuantity: rejected,
          reviewedAt: new Date(),
          reviewedByMemberId: actor.memberId,
        },
      });
      await this.event(tx, actor, meta, 'PRODUCTION_OUTPUT_ACCEPTED', r, {
        from: 'SUBMITTED',
        to: 'ACCEPTED',
        withRejects: rejected.gt(0),
      });
    });
  }

  private reviewable(o: { status: string }) {
    if (!REVIEWABLE.includes(o.status)) {
      throw fail(
        409,
        o.status === 'COMPLETED' ? 'MO_COMPLETED' : 'MO_NOT_IN_PRODUCTION',
        'Output is reviewed only while the order is in production or under completion review.',
        { status: o.status },
      );
    }
  }

  async reject(ctx: AuthContext, id: string, reason: string, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const { o, r } = await this.lockedReport(tx, actor, id);
      if (!actor.outputApprove) throw permissionDenied('operations.output.approve');
      if (r.status !== 'SUBMITTED') {
        throw fail(
          409,
          'OUTPUT_INVALID_TRANSITION',
          'This output report is not waiting for review.',
          {
            status: r.status,
          },
        );
      }
      this.reviewable(o);
      await tx.productionOutputReport.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedAt: new Date(),
          reviewedByMemberId: actor.memberId,
        },
      });
      await this.event(tx, actor, meta, 'PRODUCTION_OUTPUT_REJECTED', r, {
        from: 'SUBMITTED',
        to: 'REJECTED',
      });
    });
    return this.get(ctx, id);
  }

  /**
   * DRAFT / SUBMITTED → CANCELLED (its reporter or an approver); ACCEPTED →
   * CANCELLED only by an approver, with a reason, while nothing of it was
   * received — its draft receipts are cancelled with it.
   */
  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.cancelAs(actor, id, reason, meta);
    return this.get(ctx, id);
  }

  async cancelAs(actor: ProductionActor, id: string, reason: string | null, meta: RequestMeta) {
    await this.db.$transaction(async (tx) => {
      const { o, r } = await this.lockedReport(tx, actor, id);
      const own = r.createdByMemberId === actor.memberId && actor.outputCreate;
      if (r.status === 'DRAFT' || r.status === 'SUBMITTED') {
        if (!own && !actor.outputApprove) throw permissionDenied('operations.output.create');
      } else if (r.status === 'ACCEPTED') {
        if (!actor.outputApprove) throw permissionDenied('operations.output.approve');
        if (!reason) {
          throw fail(422, 'REASON_REQUIRED', 'Give a reason for cancelling accepted output.', {
            field: 'reason',
          });
        }
        this.reviewable(o);
        const posted = await tx.productionGoodsReceipt.count({
          where: { outputReportId: id, status: 'POSTED' },
        });
        if (posted) {
          throw fail(
            409,
            'OUTPUT_ALREADY_RECEIVED',
            'Finished goods of this report are already in stock: reverse the receipt first.',
          );
        }
      } else {
        throw fail(409, 'OUTPUT_INVALID_TRANSITION', 'This output report is already closed.', {
          status: r.status,
        });
      }
      const now = new Date();
      const drafts = await tx.productionGoodsReceipt.updateMany({
        where: { outputReportId: id, status: 'DRAFT' },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledByMemberId: actor.memberId,
          cancellationReason: 'Output report cancelled',
        },
      });
      await tx.productionOutputReport.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledByMemberId: actor.memberId,
          cancellationReason: reason,
        },
      });
      await this.event(tx, actor, meta, 'PRODUCTION_OUTPUT_CANCELLED', r, {
        from: r.status,
        to: 'CANCELLED',
        draftReceipts: drafts.count,
      });
    });
  }
}
