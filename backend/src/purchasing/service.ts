import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import { recordCompanyEvent, type PurchaseRequestAuditAction } from '../company/audit.js';
import { requireOperationsContext } from '../company/context.js';
import type { Db, Prisma } from '../db/client.js';
import type { PurchaseRequestStatus } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import { permissionDenied } from '../permissions/guard.js';
import type { CreateInput, LineInput, ListInput, UpdateInput } from './input.js';
import { requestOrdering } from './ordering.js';
import {
  allowedActions,
  assertCan,
  loadActor,
  requestNotFound,
  TARGET,
  type PrAction,
  type PrActor,
} from './policy.js';

/*
 * Purchase requests (EP29) — docs/PURCHASING_REQUEST.md.
 *
 * Every method loads the acting member's reach (policy.ts: EP27 permissions,
 * EP26 branches) on the server; nothing about requester, approver, branch,
 * company, number, status or snapshots comes from the client. A request the
 * member may not see is "not found". Every change runs in one transaction
 * with its audit entry; line edits lock the request row and re-check DRAFT;
 * decisions are conditional updates on the expected status, so of two
 * simultaneous approve / reject calls exactly one wins.
 */

const include = {
  branch: { select: { id: true, code: true, name: true, status: true } },
  requester: { select: { id: true, user: { select: { fullName: true, email: true } } } },
  approvedBy: { select: { user: { select: { fullName: true, email: true } } } },
  rejectedBy: { select: { user: { select: { fullName: true, email: true } } } },
  cancelledBy: { select: { user: { select: { fullName: true, email: true } } } },
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: { item: { select: { status: true } } },
  },
} satisfies Prisma.PurchaseRequestInclude;

type Full = Prisma.PurchaseRequestGetPayload<{ include: typeof include }>;

const who = (m: { user: { fullName: string | null; email: string } } | null) =>
  m ? { name: m.user.fullName ?? m.user.email } : null;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** The calendar day in the company's time zone (YYYY-MM-DD). */
export function companyDay(timeZone: string, at = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const v = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}

/**
 * Takes the next PR number of the period (PR-YYYYMM-NNNNNN) — one atomic
 * upsert on DocumentSequence in the creating transaction (never MAX + 1). The
 * sequence is company-wide (not per branch) and restarts each month.
 */
async function nextNumber(tx: Prisma.TransactionClient, companyId: string, period: string) {
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
    VALUES (${companyId}, ${`PR:${period}`}, 1, NOW())
    ON CONFLICT ("companyId", "key")
    DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
    RETURNING "lastValue"`;
  return `PR-${period}-${String(rows[0]!.lastValue).padStart(6, '0')}`;
}

/** Decimal places of a quantity string, ignoring trailing zeros ("2.500" → 1). */
const decimals = (q: string) => (q.split('.')[1] ?? '').replace(/0+$/, '').length;

const refNotFound = (field: string) =>
  new AppError(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', { field });
const refInactive = (field: string) =>
  new AppError(409, 'REFERENCE_INACTIVE', 'The selected record is inactive.', { field });

/**
 * The stored form of a line: canonical ids plus snapshots derived HERE from
 * the item / unit of this company (never from the client). Only ACTIVE items
 * and units are accepted; quantities must fit the unit's precision.
 */
async function lineData(tx: Prisma.TransactionClient, companyId: string, input: LineInput) {
  let precision = 6;
  let data: Omit<Prisma.PurchaseRequestLineUncheckedCreateInput, 'purchaseRequestId' | 'lineNo'>;
  if (input.type === 'ITEM') {
    const item = await tx.item.findFirst({
      where: { id: input.itemId, companyId },
      include: { baseUnit: true },
    });
    if (!item) throw refNotFound('itemId');
    if (item.status !== 'ACTIVE') throw refInactive('itemId');
    if (item.baseUnit.status !== 'ACTIVE') throw refInactive('unitId');
    precision = item.baseUnit.precision;
    data = {
      companyId,
      type: 'ITEM',
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      description: null,
      unitId: item.baseUnitId,
      unitCode: item.baseUnit.code,
      unitName: item.baseUnit.name,
      quantity: input.quantity,
      note: input.note ?? null,
    };
  } else {
    let unit = null;
    if (input.unitId) {
      unit = await tx.unit.findFirst({ where: { id: input.unitId, companyId } });
      if (!unit) throw refNotFound('unitId');
      if (unit.status !== 'ACTIVE') throw refInactive('unitId');
      precision = unit.precision;
    }
    data = {
      companyId,
      type: 'NON_ITEM',
      itemId: null,
      itemCode: null,
      itemName: null,
      description: input.description,
      unitId: unit?.id ?? null,
      unitCode: unit?.code ?? null,
      unitName: unit?.name ?? input.unitText ?? null,
      quantity: input.quantity,
      note: input.note ?? null,
    };
  }
  if (decimals(input.quantity) > precision) {
    throw new AppError(
      422,
      'QUANTITY_PRECISION',
      'This quantity has more decimal places than its unit allows.',
      { field: 'quantity', precision },
    );
  }
  return data;
}

/** Holds the request row for the rest of the transaction (line edits, submit). */
const lock = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT "id" FROM "PurchaseRequest" WHERE "id" = ${id} FOR UPDATE`;

const LIFECYCLE: PurchaseRequestAuditAction[] = [
  'PURCHASE_REQUEST_CREATED',
  'PURCHASE_REQUEST_SUBMITTED',
  'PURCHASE_REQUEST_APPROVED',
  'PURCHASE_REQUEST_REJECTED',
  'PURCHASE_REQUEST_CANCELLED',
];

export class PurchaseRequestService {
  constructor(private readonly db: Db) {}

  private event(
    tx: Prisma.TransactionClient,
    meta: RequestMeta,
    actor: PrActor,
    action: PurchaseRequestAuditAction,
    id: string,
    details: Record<string, string | number | boolean | null | readonly string[]>,
  ) {
    return recordCompanyEvent(tx, meta, {
      action,
      actorId: actor.access.actor.userId,
      actorScope: 'customer',
      companyId: actor.access.company.id,
      entityType: 'PurchaseRequest',
      entityId: id,
      details,
    });
  }

  /** May this member see this request at all? (else: not found) */
  private visible(
    actor: PrActor,
    r: Pick<Full, 'requesterMemberId' | 'branchId' | 'status' | 'department'>,
  ) {
    if (r.requesterMemberId === actor.memberId) return true;
    if (r.status === 'DRAFT' || !actor.branches.some((b) => b.id === r.branchId)) return false;
    return actor.purchasingView || actor.decideDepartments.includes(r.department);
  }

  private async load(actor: PrActor, id: string) {
    const r = await this.db.purchaseRequest.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
    if (!r || !this.visible(actor, r)) throw requestNotFound();
    return r;
  }

  private async view(actor: PrActor, r: Full) {
    const [events, ordering] = await Promise.all([
      this.db.auditLog.findMany({
        where: {
          companyId: actor.access.company.id,
          entityType: 'PurchaseRequest',
          entityId: r.id,
          action: { in: LIFECYCLE },
        },
        orderBy: { occurredAt: 'asc' },
        include: { actor: { select: { fullName: true, email: true } } },
      }),
      // EP30: what has been ordered (derived from purchase orders; order
      // numbers only for members who may read orders).
      r.status === 'APPROVED' || r.status === 'CANCELLED'
        ? requestOrdering(this.db, r.lines, actor.permissions.includes('purchasing.orders.view'))
        : Promise.resolve(null),
    ]);
    return {
      request: {
        id: r.id,
        number: r.number,
        status: r.status,
        department: r.department,
        branch: {
          id: r.branch.id,
          code: r.branchCodeSnapshot ?? r.branch.code,
          name: r.branchNameSnapshot ?? r.branch.name,
        },
        requester: {
          memberId: r.requesterMemberId,
          name: r.requesterNameSnapshot ?? who(r.requester)!.name,
          isMe: r.requesterMemberId === actor.memberId,
        },
        requestDate: day(r.requestDate),
        needByDate: day(r.needByDate),
        purpose: r.purpose,
        submittedAt: iso(r.submittedAt),
        approvedAt: iso(r.approvedAt),
        approvedBy: who(r.approvedBy),
        rejectedAt: iso(r.rejectedAt),
        rejectedBy: who(r.rejectedBy),
        rejectionReason: r.rejectionReason,
        cancelledAt: iso(r.cancelledAt),
        cancelledBy: who(r.cancelledBy),
        cancellationReason: r.cancellationReason,
        lines: r.lines.map((l) => ({
          id: l.id,
          lineNo: l.lineNo,
          type: l.type,
          item: l.itemId
            ? {
                id: l.itemId,
                code: l.itemCode!,
                name: l.itemName!,
                active: l.item?.status === 'ACTIVE',
              }
            : null,
          description: l.description,
          unit:
            l.unitId || l.unitName ? { id: l.unitId, code: l.unitCode, name: l.unitName } : null,
          quantity: l.quantity.toString(),
          note: l.note,
          ordering: ordering?.byLine.get(l.id) ?? null,
        })),
        orderState: ordering?.overall ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      },
      actions: allowedActions(actor, r),
      timeline: events.map((e) => ({
        type: e.action,
        at: e.occurredAt.toISOString(),
        actor: e.actor ? { name: e.actor.fullName ?? e.actor.email } : null,
      })),
    };
  }

  // ----------------------------------------------------------------- reads

  /** What this member may do with purchase requests here (screens only show / hide with it). */
  async context(ctx: AuthContext) {
    const actor = await loadActor(this.db, ctx);
    const selected = actor.branches.find((b) => b.id === ctx.session.branchId) ?? null;
    return {
      createDepartments: actor.createDepartments,
      decideDepartments: actor.decideDepartments,
      purchasingView: actor.purchasingView,
      cancelApproved: actor.cancelApproved,
      /** EP30: may raise purchase orders from approved requests. */
      createOrders: actor.permissions.includes('purchasing.orders.create'),
      branches: actor.branches,
      selectedBranch: selected,
    };
  }

  async list(ctx: AuthContext, q: ListInput) {
    const actor = await loadActor(this.db, ctx);
    const companyId = actor.access.company.id;
    const own: Prisma.PurchaseRequestWhereInput = { requesterMemberId: actor.memberId };
    const others: Prisma.PurchaseRequestWhereInput | null =
      actor.purchasingView || actor.decideDepartments.length
        ? {
            branchId: { in: actor.branches.map((b) => b.id) },
            status: { not: 'DRAFT' },
            ...(actor.purchasingView ? {} : { department: { in: actor.decideDepartments } }),
          }
        : null;
    const view = q.view ?? 'all';
    const scope: Prisma.PurchaseRequestWhereInput =
      view === 'mine'
        ? own
        : view === 'department'
          ? others
            ? { AND: [others, { department: { in: actor.decideDepartments } }] }
            : { id: { in: [] } }
          : view === 'queue'
            ? others
              ? { AND: [others, { status: 'SUBMITTED' }] }
              : { id: { in: [] } }
            : { OR: others ? [own, others] : [own] };
    const and: Prisma.PurchaseRequestWhereInput[] = [{ companyId }, scope];
    if (q.status) and.push({ status: q.status });
    if (q.department) and.push({ department: q.department });
    if (q.branchId) and.push({ branchId: q.branchId });
    if (q.from || q.to) {
      and.push({
        requestDate: {
          ...(q.from ? { gte: new Date(`${q.from}T00:00:00Z`) } : {}),
          ...(q.to ? { lte: new Date(`${q.to}T00:00:00Z`) } : {}),
        },
      });
    }
    if (q.q) {
      const c = { contains: q.q, mode: 'insensitive' as const };
      and.push({
        OR: [
          { number: c },
          { purpose: c },
          { requesterNameSnapshot: c },
          { requester: { user: { fullName: c } } },
        ],
      });
    }
    const where: Prisma.PurchaseRequestWhereInput = { AND: and };
    const orderBy: Prisma.PurchaseRequestOrderByWithRelationInput[] =
      q.sort === 'number' ? [{ number: 'desc' }] : [{ updatedAt: 'desc' }, { id: 'desc' }];
    const skip = (q.page - 1) * q.pageSize;
    const [rows, total] = await Promise.all([
      this.db.purchaseRequest.findMany({
        where,
        orderBy,
        skip,
        take: q.pageSize,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          requester: { select: { user: { select: { fullName: true, email: true } } } },
          _count: { select: { lines: true } },
        },
      }),
      this.db.purchaseRequest.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        number: r.number,
        status: r.status,
        department: r.department,
        branch: {
          id: r.branch.id,
          code: r.branchCodeSnapshot ?? r.branch.code,
          name: r.branchNameSnapshot ?? r.branch.name,
        },
        requester: {
          name: r.requesterNameSnapshot ?? who(r.requester)!.name,
          isMe: r.requesterMemberId === actor.memberId,
        },
        requestDate: day(r.requestDate),
        needByDate: day(r.needByDate),
        purpose: r.purpose,
        lineCount: r._count.lines,
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: skip + rows.length < total,
    };
  }

  async get(ctx: AuthContext, id: string) {
    const actor = await loadActor(this.db, ctx);
    return this.view(actor, await this.load(actor, id));
  }

  /** Active items for a request line — identity, type and base unit only (no master-data rights needed). */
  async itemOptions(ctx: AuthContext, q?: string) {
    const actor = await this.creator(ctx);
    const rows = await this.db.item.findMany({
      where: {
        companyId: actor.access.company.id,
        status: 'ACTIVE',
        baseUnit: { status: 'ACTIVE' },
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
                { barcode: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ code: 'asc' }],
      take: 20,
      include: { baseUnit: true },
    });
    return {
      items: rows.map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        type: i.type,
        unit: {
          id: i.baseUnit.id,
          code: i.baseUnit.code,
          name: i.baseUnit.name,
          precision: i.baseUnit.precision,
        },
      })),
    };
  }

  async unitOptions(ctx: AuthContext) {
    const actor = await this.creator(ctx);
    const rows = await this.db.unit.findMany({
      where: { companyId: actor.access.company.id, status: 'ACTIVE' },
      orderBy: { code: 'asc' },
      take: 200,
    });
    return {
      units: rows.map((u) => ({ id: u.id, code: u.code, name: u.name, precision: u.precision })),
    };
  }

  /** Someone who may raise requests from at least one department. */
  private async creator(ctx: AuthContext) {
    const actor = await loadActor(this.db, ctx);
    if (!actor.createDepartments.length) throw permissionDenied('purchase_request.create');
    return actor;
  }

  // ---------------------------------------------------------------- writes

  /**
   * A new DRAFT in the session's selected branch (EP26 context), from a
   * department the member may raise requests from; the member is the
   * requester. Number, request, lines and audit in one transaction.
   */
  async create(ctx: AuthContext, input: CreateInput, meta: RequestMeta) {
    // The branch is the session's selected branch, validated (EP26) — never a client id.
    const op = await requireOperationsContext(this.db, ctx);
    const actor = await loadActor(this.db, ctx);
    if (!actor.createDepartments.includes(input.department)) {
      throw new AppError(
        403,
        'DEPARTMENT_NOT_ALLOWED',
        'You cannot raise requests from this department.',
        { department: input.department },
      );
    }
    const companyId = actor.access.company.id;
    const today = companyDay(actor.access.company.timezone);
    const created = await this.db.$transaction(async (tx) => {
      const lines = [];
      for (const l of input.lines) lines.push(await lineData(tx, companyId, l));
      const number = await nextNumber(tx, companyId, today.slice(0, 7).replace('-', ''));
      const r = await tx.purchaseRequest.create({
        data: {
          companyId,
          branchId: op.branch.id,
          number,
          department: input.department,
          requesterMemberId: actor.memberId,
          requestDate: new Date(`${today}T00:00:00Z`),
          needByDate: input.needByDate ? new Date(`${input.needByDate}T00:00:00Z`) : null,
          purpose: input.purpose ?? null,
          lineCounter: lines.length,
        },
      });
      if (lines.length) {
        await tx.purchaseRequestLine.createMany({
          data: lines.map((l, i) => ({ ...l, purchaseRequestId: r.id, lineNo: i + 1 })),
        });
      }
      await this.event(tx, meta, actor, 'PURCHASE_REQUEST_CREATED', r.id, {
        number,
        department: input.department,
        branch: op.branch.code,
        lines: lines.length,
      });
      return r;
    });
    return this.get(ctx, created.id);
  }

  /** Header fields of a DRAFT (department within the member's own). */
  async update(ctx: AuthContext, id: string, input: UpdateInput, meta: RequestMeta) {
    const actor = await loadActor(this.db, ctx);
    const r = await this.load(actor, id);
    assertCan(actor, 'edit', r);
    if (input.department && !actor.createDepartments.includes(input.department)) {
      throw new AppError(
        403,
        'DEPARTMENT_NOT_ALLOWED',
        'You cannot raise requests from this department.',
        {
          department: input.department,
        },
      );
    }
    const data: Prisma.PurchaseRequestUncheckedUpdateInput = {};
    const fields: string[] = [];
    if (input.department && input.department !== r.department) {
      data.department = input.department;
      fields.push('department');
    }
    if (input.purpose !== undefined && input.purpose !== r.purpose) {
      data.purpose = input.purpose;
      fields.push('purpose');
    }
    if (input.needByDate !== undefined && input.needByDate !== day(r.needByDate)) {
      data.needByDate = input.needByDate ? new Date(`${input.needByDate}T00:00:00Z`) : null;
      fields.push('needByDate');
    }
    if (fields.length) {
      await this.db.$transaction(async (tx) => {
        await this.editable(tx, actor, id);
        await tx.purchaseRequest.update({ where: { id }, data });
        await this.event(tx, meta, actor, 'PURCHASE_REQUEST_UPDATED', id, {
          number: r.number,
          fields,
        });
      });
    }
    return this.get(ctx, id);
  }

  /** Inside a transaction: lock the row and re-check it is still an editable DRAFT. */
  private async editable(tx: Prisma.TransactionClient, actor: PrActor, id: string) {
    await lock(tx, id);
    const fresh = await tx.purchaseRequest.findUniqueOrThrow({ where: { id } });
    assertCan(actor, 'edit', fresh);
    return fresh;
  }

  async addLine(ctx: AuthContext, id: string, input: LineInput, meta: RequestMeta) {
    const actor = await loadActor(this.db, ctx);
    const r = await this.load(actor, id);
    assertCan(actor, 'edit', r);
    await this.db.$transaction(async (tx) => {
      const fresh = await this.editable(tx, actor, id);
      if ((await tx.purchaseRequestLine.count({ where: { purchaseRequestId: id } })) >= 100) {
        throw new AppError(422, 'PR_TOO_MANY_LINES', 'A request can have at most 100 lines.');
      }
      const data = await lineData(tx, fresh.companyId, input);
      const lineNo = fresh.lineCounter + 1;
      await tx.purchaseRequest.update({ where: { id }, data: { lineCounter: lineNo } });
      await tx.purchaseRequestLine.create({ data: { ...data, purchaseRequestId: id, lineNo } });
      await this.event(tx, meta, actor, 'PURCHASE_REQUEST_LINE_ADDED', id, {
        number: fresh.number,
        lineNo,
        kind: data.type,
        item: data.itemCode ?? null,
      });
    });
    return this.get(ctx, id);
  }

  async updateLine(
    ctx: AuthContext,
    id: string,
    lineId: string,
    input: LineInput,
    meta: RequestMeta,
  ) {
    const actor = await loadActor(this.db, ctx);
    const r = await this.load(actor, id);
    assertCan(actor, 'edit', r);
    await this.db.$transaction(async (tx) => {
      const fresh = await this.editable(tx, actor, id);
      const line = await tx.purchaseRequestLine.findFirst({
        where: { id: lineId, purchaseRequestId: id, companyId: fresh.companyId },
      });
      if (!line) throw new AppError(404, 'PR_LINE_NOT_FOUND', 'This request line was not found.');
      const data = await lineData(tx, fresh.companyId, input);
      await tx.purchaseRequestLine.update({ where: { id: line.id }, data });
      await tx.purchaseRequest.update({ where: { id }, data: { updatedAt: new Date() } });
      await this.event(tx, meta, actor, 'PURCHASE_REQUEST_LINE_UPDATED', id, {
        number: fresh.number,
        lineNo: line.lineNo,
        kind: data.type,
        item: data.itemCode ?? null,
      });
    });
    return this.get(ctx, id);
  }

  async removeLine(ctx: AuthContext, id: string, lineId: string, meta: RequestMeta) {
    const actor = await loadActor(this.db, ctx);
    const r = await this.load(actor, id);
    assertCan(actor, 'edit', r);
    await this.db.$transaction(async (tx) => {
      const fresh = await this.editable(tx, actor, id);
      const line = await tx.purchaseRequestLine.findFirst({
        where: { id: lineId, purchaseRequestId: id, companyId: fresh.companyId },
      });
      if (!line) throw new AppError(404, 'PR_LINE_NOT_FOUND', 'This request line was not found.');
      await tx.purchaseRequestLine.delete({ where: { id: line.id } });
      await tx.purchaseRequest.update({ where: { id }, data: { updatedAt: new Date() } });
      await this.event(tx, meta, actor, 'PURCHASE_REQUEST_LINE_REMOVED', id, {
        number: fresh.number,
        lineNo: line.lineNo,
      });
    });
    return this.get(ctx, id);
  }

  /**
   * DRAFT → SUBMITTED. Needs a purpose, at least one line, a need-by date not
   * before the request date, and item lines whose item and unit are still
   * active (snapshots are refreshed from them now and frozen from here on).
   * The branch and requester are snapshotted for the historical document.
   */
  async submit(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadActor(this.db, ctx);
    const r = await this.load(actor, id);
    assertCan(actor, 'submit', r);
    await this.db.$transaction(async (tx) => {
      await lock(tx, id);
      const fresh = await tx.purchaseRequest.findUniqueOrThrow({
        where: { id },
        include: {
          lines: { include: { item: { include: { baseUnit: true } } } },
          branch: true,
          requester: { include: { user: { select: { fullName: true, email: true } } } },
        },
      });
      assertCan(actor, 'submit', fresh);
      const missing: string[] = [];
      if (!fresh.purpose?.trim()) missing.push('purpose');
      if (!fresh.lines.length) missing.push('lines');
      if (fresh.needByDate && fresh.needByDate < fresh.requestDate) missing.push('needByDate');
      if (missing.length) {
        throw new AppError(422, 'PR_INCOMPLETE', 'This request is not ready to submit.', {
          missing,
        });
      }
      for (const l of fresh.lines) {
        if (l.type !== 'ITEM') continue;
        const item = l.item!;
        if (item.status !== 'ACTIVE' || item.baseUnit.status !== 'ACTIVE') {
          throw new AppError(409, 'PR_LINE_INACTIVE', 'A line names an inactive item or unit.', {
            lineNo: l.lineNo,
          });
        }
        if (item.baseUnitId !== l.unitId) {
          throw new AppError(409, 'PR_LINE_STALE', 'An item’s unit changed; edit the line.', {
            lineNo: l.lineNo,
          });
        }
        await tx.purchaseRequestLine.update({
          where: { id: l.id },
          data: {
            itemCode: item.code,
            itemName: item.name,
            unitCode: item.baseUnit.code,
            unitName: item.baseUnit.name,
          },
        });
      }
      const changed = await tx.purchaseRequest.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          branchCodeSnapshot: fresh.branch.code,
          branchNameSnapshot: fresh.branch.name,
          requesterNameSnapshot: fresh.requester.user.fullName ?? fresh.requester.user.email,
        },
      });
      if (changed.count !== 1) throw stateChanged();
      await this.event(tx, meta, actor, 'PURCHASE_REQUEST_SUBMITTED', id, {
        number: fresh.number,
        from: 'DRAFT',
        to: 'SUBMITTED',
        lines: fresh.lines.length,
      });
    });
    return this.get(ctx, id);
  }

  async approve(ctx: AuthContext, id: string, meta: RequestMeta) {
    return this.decide(ctx, id, 'approve', null, meta);
  }

  async reject(ctx: AuthContext, id: string, reason: string, meta: RequestMeta) {
    return this.decide(ctx, id, 'reject', reason, meta);
  }

  /**
   * Cancel: the requester for a DRAFT (reason optional) or a SUBMITTED
   * request (reason required); Purchasing with purchasing.requests.cancel for
   * an APPROVED one (reason required).
   */
  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    return this.decide(ctx, id, 'cancel', reason, meta);
  }

  private async decide(
    ctx: AuthContext,
    id: string,
    action: Exclude<PrAction, 'edit' | 'submit'>,
    reason: string | null,
    meta: RequestMeta,
  ) {
    const actor = await loadActor(this.db, ctx);
    const r = await this.load(actor, id);
    assertCan(actor, action, r);
    if (action === 'cancel' && r.status !== 'DRAFT' && !reason) {
      throw new AppError(422, 'REASON_REQUIRED', 'Give a reason for cancelling.', {
        field: 'reason',
      });
    }
    const now = new Date();
    const from: PurchaseRequestStatus = r.status;
    const data: Prisma.PurchaseRequestUncheckedUpdateManyInput =
      action === 'approve'
        ? { status: 'APPROVED', approvedAt: now, approvedByMemberId: actor.memberId }
        : action === 'reject'
          ? {
              status: 'REJECTED',
              rejectedAt: now,
              rejectedByMemberId: actor.memberId,
              rejectionReason: reason,
            }
          : {
              status: 'CANCELLED',
              cancelledAt: now,
              cancelledByMemberId: actor.memberId,
              cancellationReason: reason,
            };
    await this.db.$transaction(async (tx) => {
      if (action === 'cancel' && from === 'APPROVED') {
        // EP30: an approved request with a live purchase order (draft or issued)
        // stays; the lock orders this against an order being created or issued.
        await tx.$queryRaw`SELECT "id" FROM "PurchaseRequest" WHERE "id" = ${id} FOR UPDATE`;
        const live = await tx.purchaseOrderLine.count({
          where: { purchaseRequestId: id, order: { status: { not: 'CANCELLED' } } },
        });
        if (live) {
          throw new AppError(
            409,
            'PR_HAS_PURCHASE_ORDERS',
            'This request has purchase orders. Cancel those orders first.',
          );
        }
      }
      // Conditional on the status we decided from: a concurrent decision wins once.
      const changed = await tx.purchaseRequest.updateMany({
        where: { id, companyId: actor.access.company.id, status: from },
        data,
      });
      if (changed.count !== 1) throw stateChanged();
      const audit: Record<Exclude<PrAction, 'edit' | 'submit'>, PurchaseRequestAuditAction> = {
        approve: 'PURCHASE_REQUEST_APPROVED',
        reject: 'PURCHASE_REQUEST_REJECTED',
        cancel: 'PURCHASE_REQUEST_CANCELLED',
      };
      await this.event(tx, meta, actor, audit[action], id, {
        number: r.number,
        from,
        to: TARGET[action],
        withReason: !!reason,
      });
    });
    return this.get(ctx, id);
  }
}

const stateChanged = () =>
  new AppError(
    409,
    'PR_STATE_CHANGED',
    'This request was changed by someone else just now. Reload it and try again.',
  );
