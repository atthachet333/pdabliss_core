import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import { recordCompanyEvent, type ProductionAuditAction } from '../company/audit.js';
import type { Db, Prisma } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { permissionDenied } from '../permissions/guard.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import { companyDay } from '../purchasing/service.js';
import { lineProgress } from '../sales/fulfilment.js';
import type { CreateMoInput, MoListInput, UpdateMoInput } from './input.js';
import {
  allowedMoActions,
  assertMo,
  canSee,
  inBranch,
  loadProductionActor,
  orderNotFound,
  type MoAction,
  type ProductionActor,
} from './policy.js';
import {
  ASSESSED,
  availableFor,
  materialState,
  orderMaterialState,
  requiredQuantity,
  stockOf,
  type MaterialAvailability,
} from './requirements.js';
import { DemandRow, MoRow, MoView, Preview, RequirementRow, ShortageRow } from './views.js';

/*
 * Production orders (EP36) — docs/PRODUCTION_ORDER.md. Planning truth: what to
 * make (one finished item, one branch), how much, from which ACTIVE BOM
 * revision, by when, and what materials that needs. A production order NEVER
 * writes stock: no StockMovement, no StockBalance, no reservation, no output.
 * Requirements are computed by the server from the BOM (the client never sends
 * them), recomputed on every draft change, refreshed at submit and approval,
 * and frozen from approval on (the database guards it). Availability is read
 * from the ledger on every response — a snapshot, never a claim.
 */

const person = { select: { user: { select: { fullName: true, email: true } } } } as const;
const who = (m: { user: { fullName: string | null; email: string } } | null) =>
  m ? { name: m.user.fullName ?? m.user.email } : null;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const asDay = (v: string) => new Date(`${v}T00:00:00Z`);
const places = (q: string) => (q.split('.')[1] ?? '').replace(/0+$/, '').length;
const fail = (status: number, code: string, message: string, details?: object) =>
  new AppError(status, code, message, details);

const include = {
  branch: { select: { id: true, code: true, name: true } },
  createdBy: person,
  submittedBy: person,
  approvedBy: person,
  releasedBy: person,
  rejectedBy: person,
  cancelledBy: person,
  materials: { orderBy: { lineNo: 'asc' as const } },
  salesOrder: { select: { id: true, number: true, status: true, requestedDate: true } },
  salesOrderLine: { select: { lineNo: true, quantity: true } },
  bom: { select: { status: true } },
} satisfies Prisma.ProductionOrderInclude;
type Full = Prisma.ProductionOrderGetPayload<{ include: typeof include }>;

const TIMELINE: ProductionAuditAction[] = [
  'PRODUCTION_ORDER_CREATED',
  'PRODUCTION_ORDER_UPDATED',
  'PRODUCTION_ORDER_SUBMITTED',
  'PRODUCTION_ORDER_APPROVED',
  'PRODUCTION_ORDER_REJECTED',
  'PRODUCTION_ORDER_RELEASED',
  'PRODUCTION_ORDER_CANCELLED',
];
/** Orders that still plan output (they count as planned demand). */
export const OPEN = ['DRAFT', 'SUBMITTED', 'APPROVED', 'READY'] as const;
/** Committed plans: the shortage handoff to Purchasing. */
const COMMITTED = ['APPROVED', 'READY'] as const;
const FROZEN: readonly string[] = ['APPROVED', 'READY', 'REJECTED', 'CANCELLED'];

type Stock = Awaited<ReturnType<typeof availableFor>>;
type BomWithLines = Prisma.ProductionBomGetPayload<{ include: { lines: true } }>;

export class ProductionOrderService {
  constructor(
    private readonly db: Db,
    private readonly scope: 'customer' | 'seed' = 'customer',
  ) {}

  private today(actor: ProductionActor) {
    return companyDay(actor.access.company.timezone);
  }

  private async reader(ctx: AuthContext) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.view) throw permissionDenied('operations.orders.view');
    return actor;
  }

  /** The branch for a new manual order: the one asked for, the selected one, or the only one. */
  private workingBranch(actor: ProductionActor, ctx: AuthContext, asked?: string) {
    if (asked) {
      const b = actor.branches.find((x) => x.id === asked);
      if (!b) throw fail(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
      return b;
    }
    const b =
      actor.branches.find((x) => x.id === ctx.session.branchId) ??
      (actor.branches.length === 1 ? actor.branches[0] : undefined);
    if (!b) throw fail(409, 'BRANCH_SELECTION_REQUIRED', 'Choose the branch you work in first.');
    return b;
  }

  private branchFilter(actor: ProductionActor, branchId?: string) {
    const ids = actor.branches.map((b) => b.id);
    return branchId ? ids.filter((b) => b === branchId) : ids;
  }

  private visibleWhere(
    actor: ProductionActor,
    branchId?: string,
  ): Prisma.ProductionOrderWhereInput {
    return {
      companyId: actor.access.company.id,
      branchId: { in: this.branchFilter(actor, branchId) },
      ...(actor.approve
        ? {}
        : { OR: [{ status: { not: 'DRAFT' } }, { createdByMemberId: actor.memberId }] }),
    };
  }

  private async find(actor: ProductionActor, id: string) {
    const o = await this.db.productionOrder.findFirst({
      where: { id, companyId: actor.access.company.id },
      include,
    });
    if (!o || !canSee(actor, o)) throw orderNotFound();
    return o;
  }

  // ------------------------------------------------------------------ requirements

  /** The BOM an order uses: the one named (same item, ACTIVE) or the item's one ACTIVE revision. */
  private async resolveBom(
    tx: Prisma.TransactionClient | Db,
    companyId: string,
    itemId: string,
    bomId: string | undefined | null,
  ): Promise<BomWithLines | null> {
    if (bomId) {
      const b = await tx.productionBom.findFirst({
        where: { id: bomId, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
      if (!b) {
        throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', {
          field: 'bomId',
        });
      }
      if (b.itemId !== itemId) {
        throw fail(422, 'BOM_ITEM_MISMATCH', 'This BOM does not make the selected item.', {
          field: 'bomId',
        });
      }
      if (b.status !== 'ACTIVE') {
        throw fail(422, 'BOM_NOT_ACTIVE', 'Only an active BOM revision can be planned.', {
          field: 'bomId',
        });
      }
      return b;
    }
    return tx.productionBom.findFirst({
      where: { companyId, itemId, status: 'ACTIVE' },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
  }

  /** Requirement rows for `quantity` of the BOM's output (rounded UP to each unit's places). */
  private materialRows(bom: BomWithLines, quantity: string) {
    return bom.lines.map((l) => ({
      lineNo: l.lineNo,
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      unitId: l.unitId,
      unitCode: l.unitCode,
      unitPrecision: l.unitPrecision,
      bomQuantity: l.quantity,
      requiredQuantity: requiredQuantity(quantity, l.quantity, bom.outputQuantity, l.unitPrecision)
        .quantity,
    }));
  }

  private bomFields(bom: BomWithLines | null) {
    return {
      bomId: bom?.id ?? null,
      bomCode: bom?.code ?? null,
      bomRevision: bom?.revision ?? null,
      bomOutputQuantity: bom?.outputQuantity ?? null,
    };
  }

  private async writeMaterials(
    tx: Prisma.TransactionClient,
    o: { id: string; companyId: string },
    rows: ReturnType<ProductionOrderService['materialRows']>,
  ) {
    await tx.productionOrderMaterial.deleteMany({ where: { productionOrderId: o.id } });
    if (rows.length) {
      await tx.productionOrderMaterial.createMany({
        data: rows.map((r) => ({ ...r, companyId: o.companyId, productionOrderId: o.id })),
      });
    }
  }

  private async stockForOrders(
    actor: ProductionActor,
    orders: readonly { branchId: string; status: string; materials: { itemId: string }[] }[],
  ) {
    const pairs = orders
      .filter((o) => ASSESSED.includes(o.status))
      .flatMap((o) => o.materials.map((m) => ({ branchId: o.branchId, itemId: m.itemId })));
    return availableFor(this.db, actor.access.company.id, this.today(actor), pairs);
  }

  /** Per material: required vs available now (null for terminal orders). */
  private assess(
    o: {
      branchId: string;
      status: string;
      quantity: Decimal;
      bomOutputQuantity: Decimal | null;
      materials: Full['materials'];
    },
    stock: Stock,
  ) {
    const assessed = ASSESSED.includes(o.status);
    const lines = o.materials.map((m) => {
      const exact = o.bomOutputQuantity
        ? requiredQuantity(o.quantity, m.bomQuantity, o.bomOutputQuantity, m.unitPrecision).exact
        : true;
      const base = {
        lineNo: m.lineNo,
        item: { id: m.itemId, code: m.itemCode, name: m.itemName },
        unit: { code: m.unitCode, precision: m.unitPrecision },
        bomQuantity: m.bomQuantity.toString(),
        required: m.requiredQuantity.toString(),
        exact,
      };
      if (!assessed) return { ...base, available: null, shortage: null, state: null };
      const available = stockOf(stock, o.branchId, m.itemId).available;
      const a = materialState(m.requiredQuantity, available);
      return {
        ...base,
        available: available.toString(),
        shortage: a.shortage.toString(),
        state: a.state,
      };
    });
    const state = assessed
      ? orderMaterialState(lines.map((l) => l.state as MaterialAvailability))
      : 'NOT_ASSESSED';
    return { lines, state };
  }

  // ------------------------------------------------------------------ views

  private attention(o: Pick<Full, 'source' | 'status' | 'salesOrder'>) {
    return o.source === 'SALES_DEMAND' &&
      (OPEN as readonly string[]).includes(o.status) &&
      o.salesOrder?.status === 'CANCELLED'
      ? ('SOURCE_CANCELLED' as const)
      : null;
  }

  private row(o: Full, state: string) {
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      source: o.source,
      branch: o.branch,
      item: { id: o.itemId, code: o.itemCode, name: o.itemName },
      unit: { code: o.unitCode, precision: o.unitPrecision },
      quantity: o.quantity.toString(),
      bom:
        o.bomId && o.bomCode && o.bomRevision
          ? { id: o.bomId, code: o.bomCode, revision: o.bomRevision }
          : null,
      plannedStartDate: day(o.plannedStartDate),
      requiredDate: day(o.requiredDate),
      priority: o.priority,
      materialState: state,
      salesOrder:
        o.salesOrder && o.salesOrderLine
          ? {
              id: o.salesOrder.id,
              number: o.salesOrder.number,
              status: o.salesOrder.status,
              requestedDate: day(o.salesOrder.requestedDate),
              lineNo: o.salesOrderLine.lineNo,
            }
          : null,
      attention: this.attention(o),
      createdBy: who(o.createdBy),
      updatedAt: o.updatedAt.toISOString(),
    };
  }

  /** Sales demand of the linked line: what is open, and what other open orders already plan. */
  private async demandOf(o: Full) {
    if (!o.salesOrderLineId || !o.salesOrderId || !o.salesOrderLine) return null;
    const [progress, others] = await Promise.all([
      lineProgress(this.db, [o.salesOrderId]),
      this.db.productionOrder.aggregate({
        where: {
          salesOrderLineId: o.salesOrderLineId,
          status: { in: [...OPEN] },
          id: { not: o.id },
        },
        _sum: { quantity: true },
      }),
    ]);
    const p = progress.get(o.salesOrderLineId);
    const ordered = o.salesOrderLine.quantity;
    const allocated = p?.allocated ?? ZERO;
    const dispatched = p?.dispatched ?? ZERO;
    const open = Decimal.max(ZERO, ordered.minus(allocated));
    const elsewhere = others._sum.quantity ?? ZERO;
    const mine = (OPEN as readonly string[]).includes(o.status) ? o.quantity : ZERO;
    return {
      ordered: ordered.toString(),
      dispatched: dispatched.toString(),
      reserved: Decimal.max(ZERO, allocated.minus(dispatched)).toString(),
      open: open.toString(),
      plannedElsewhere: elsewhere.toString(),
      overPlanned: elsewhere.plus(mine).gt(open),
    };
  }

  private async view(actor: ProductionActor, o: Full) {
    const stock = await this.stockForOrders(actor, [o]);
    const a = this.assess(o, stock);
    const demand = await this.demandOf(o);
    const timeline = await this.db.auditLog.findMany({
      where: {
        companyId: o.companyId,
        entityType: 'ProductionOrder',
        entityId: o.id,
        action: { in: TIMELINE },
      },
      orderBy: { occurredAt: 'asc' },
      include: { actor: { select: { fullName: true, email: true } } },
    });
    const open = (OPEN as readonly string[]).includes(o.status);
    const warnings: ('DEMAND_ALREADY_PLANNED' | 'SOURCE_CANCELLED' | 'BOM_RETIRED')[] = [];
    if (open && demand?.overPlanned) warnings.push('DEMAND_ALREADY_PLANNED');
    if (this.attention(o)) warnings.push('SOURCE_CANCELLED');
    if (open && !FROZEN.includes(o.status) && o.bom && o.bom.status !== 'ACTIVE')
      warnings.push('BOM_RETIRED');
    return {
      order: MoView.parse({
        ...this.row(o, a.state),
        note: o.note,
        bomOutputQuantity: o.bomOutputQuantity?.toString() ?? null,
        createdAt: o.createdAt.toISOString(),
        submittedAt: iso(o.submittedAt),
        submittedBy: who(o.submittedBy),
        approvedAt: iso(o.approvedAt),
        approvedBy: who(o.approvedBy),
        releasedAt: iso(o.releasedAt),
        releasedBy: who(o.releasedBy),
        rejectedAt: iso(o.rejectedAt),
        rejectedBy: who(o.rejectedBy),
        rejectionReason: o.rejectionReason,
        cancelledAt: iso(o.cancelledAt),
        cancelledBy: who(o.cancelledBy),
        cancellationReason: o.cancellationReason,
        frozen: FROZEN.includes(o.status) && !!o.approvedAt,
        materials: a.lines,
        demand,
        warnings,
        actions: allowedMoActions(actor, o),
      }),
      timeline: timeline.map((e) => ({
        type: e.action,
        at: e.occurredAt.toISOString(),
        actor: e.actor ? { name: e.actor.fullName ?? e.actor.email } : null,
      })),
    };
  }

  // ------------------------------------------------------------------ reads

  /** Open, visible orders in scope with their material state now (capped, newest first). */
  private async openStates(actor: ProductionActor, where: Prisma.ProductionOrderWhereInput) {
    const open = await this.db.productionOrder.findMany({
      where: { ...where, status: { in: ['SUBMITTED', 'APPROVED', 'READY'] } },
      include,
      take: 1000,
      orderBy: { updatedAt: 'desc' },
    });
    const stock = await this.stockForOrders(actor, open);
    return open.map((o) => ({ o, state: this.assess(o, stock).state }));
  }

  async context(ctx: AuthContext) {
    const actor = await this.reader(ctx);
    const selected =
      actor.branches.find((b) => b.id === ctx.session.branchId) ??
      (actor.branches.length === 1 ? actor.branches[0]! : null);
    const where = this.visibleWhere(actor, selected?.id);
    const [drafts, submitted, approved, ready, states, demand] = await Promise.all([
      this.db.productionOrder.count({
        where: { ...where, status: 'DRAFT', createdByMemberId: actor.memberId },
      }),
      this.db.productionOrder.count({ where: { ...where, status: 'SUBMITTED' } }),
      this.db.productionOrder.count({ where: { ...where, status: 'APPROVED' } }),
      this.db.productionOrder.count({ where: { ...where, status: 'READY' } }),
      this.openStates(actor, where),
      this.demandRows(actor, selected?.id),
    ]);
    return {
      orders: {
        view: actor.view,
        create: actor.create,
        approve: actor.approve,
        cancel: actor.cancel,
      },
      bom: { view: actor.bomView, manage: actor.bomManage },
      branches: actor.branches,
      selectedBranch: selected,
      counts: {
        myDrafts: drafts,
        awaitingApproval: submitted,
        approved,
        ready,
        materialsShort: states.filter((s) => s.state === 'MATERIALS_SHORT').length,
        demandToReview: demand.filter((d) => new Decimal(d.suggested).gt(0)).length,
        sourceCancelled: states.filter((s) => this.attention(s.o)).length,
      },
      today: this.today(actor),
    };
  }

  async list(ctx: AuthContext, q: MoListInput) {
    const actor = await this.reader(ctx);
    const base = this.visibleWhere(actor, q.branchId);
    const and: Prisma.ProductionOrderWhereInput[] = [base];
    if (q.status) and.push({ status: q.status });
    if (q.itemId) and.push({ itemId: q.itemId });
    if (q.source) and.push({ source: q.source });
    if (q.from || q.to) {
      and.push({
        plannedStartDate: {
          ...(q.from ? { gte: asDay(q.from) } : {}),
          ...(q.to ? { lte: asDay(q.to) } : {}),
        },
      });
    }
    if (q.q) {
      const c = { contains: q.q, mode: 'insensitive' as const };
      and.push({
        OR: [{ number: c }, { itemCode: c }, { itemName: c }, { salesOrder: { number: c } }],
      });
    }
    if (q.materials) {
      const want = q.materials === 'SHORT' ? 'MATERIALS_SHORT' : 'MATERIALS_AVAILABLE';
      const ids = (await this.openStates(actor, base))
        .filter((s) => s.state === want)
        .map((s) => s.o.id);
      and.push({ id: { in: ids } });
    }
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      this.db.productionOrder.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include,
      }),
      this.db.productionOrder.count({ where }),
    ]);
    const stock = await this.stockForOrders(actor, rows);
    return {
      items: rows.map((o) => MoRow.parse(this.row(o, this.assess(o, stock).state))),
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

  /** Requirements of `quantity` from one ACTIVE BOM in a branch — computed, not saved. */
  async preview(ctx: AuthContext, q: { bomId: string; quantity: string; branchId?: string }) {
    const actor = await this.reader(ctx);
    const branch = this.workingBranch(actor, ctx, q.branchId);
    const bom = await this.db.productionBom.findFirst({
      where: { id: q.bomId, companyId: actor.access.company.id },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!bom) throw fail(404, 'BOM_NOT_FOUND', 'This BOM was not found.');
    if (bom.status !== 'ACTIVE') {
      throw fail(422, 'BOM_NOT_ACTIVE', 'Only an active BOM revision can be planned.', {
        field: 'bomId',
      });
    }
    if (places(q.quantity) > bom.unitPrecision) {
      throw fail(
        422,
        'QUANTITY_PRECISION',
        'A quantity has more decimal places than its unit allows.',
        {
          field: 'quantity',
          precision: bom.unitPrecision,
        },
      );
    }
    const rows = this.materialRows(bom, q.quantity).map((r) => ({ ...r, id: '' }));
    const stock = await availableFor(
      this.db,
      actor.access.company.id,
      this.today(actor),
      rows.map((r) => ({ branchId: branch.id, itemId: r.itemId })),
    );
    const a = this.assess(
      {
        branchId: branch.id,
        status: 'DRAFT',
        quantity: new Decimal(q.quantity),
        bomOutputQuantity: bom.outputQuantity,
        materials: rows as unknown as Full['materials'],
      },
      stock,
    );
    return Preview.parse({
      bom: { id: bom.id, code: bom.code, revision: bom.revision },
      quantity: q.quantity,
      materialState: a.state,
      materials: a.lines,
    });
  }

  /**
   * Material requirements across the branch's open, submitted-or-later orders,
   * per material: Σ required vs available now. Planning only — the same stock may
   * appear available to several orders (no production reservation exists).
   */
  async requirements(ctx: AuthContext, q: { branchId?: string }) {
    const actor = await this.reader(ctx);
    const branchId = this.workingBranch(actor, ctx, q.branchId).id;
    const orders = await this.db.productionOrder.findMany({
      where: {
        ...this.visibleWhere(actor, branchId),
        status: { in: ['SUBMITTED', 'APPROVED', 'READY'] },
      },
      select: { requiredDate: true, materials: true },
    });
    const by = new Map<
      string,
      {
        item: { id: string; code: string; name: string };
        unit: { code: string; precision: number };
        required: Decimal;
        orders: number;
        earliest: Date | null;
      }
    >();
    for (const o of orders) {
      for (const m of o.materials) {
        const r = by.get(m.itemId) ?? {
          item: { id: m.itemId, code: m.itemCode, name: m.itemName },
          unit: { code: m.unitCode, precision: m.unitPrecision },
          required: ZERO,
          orders: 0,
          earliest: null,
        };
        r.required = r.required.plus(m.requiredQuantity);
        r.orders += 1;
        if (o.requiredDate && (!r.earliest || o.requiredDate < r.earliest))
          r.earliest = o.requiredDate;
        by.set(m.itemId, r);
      }
    }
    const stock = await availableFor(
      this.db,
      actor.access.company.id,
      this.today(actor),
      [...by.keys()].map((itemId) => ({ branchId, itemId })),
    );
    const items = [...by.values()]
      .map((r) => {
        const available = stockOf(stock, branchId, r.item.id).available;
        const s = materialState(r.required, available);
        return RequirementRow.parse({
          item: r.item,
          unit: r.unit,
          required: r.required.toString(),
          available: available.toString(),
          shortage: s.shortage.toString(),
          state: s.state,
          orderCount: r.orders,
          earliestRequiredDate: day(r.earliest),
        });
      })
      .sort(
        (a, b) =>
          Number(b.shortage !== '0') - Number(a.shortage !== '0') ||
          a.item.code.localeCompare(b.item.code),
      );
    return { branchId, items };
  }

  /**
   * Sales demand eligible for production (read-only): lines of CONFIRMED sales
   * orders in the member's branches whose item is a stock-tracked finished good.
   *
   *   open        = ordered − allocated (ACTIVE + CONSUMED: reserved or already dispatched)
   *   availableShare = the branch's available stock (on hand − every reservation),
   *                 shared out line by line: requested date, then order number, then line
   *   uncovered   = open − availableShare
   *   planned     = Σ quantity of OPEN production orders linked to the line
   *   suggested   = max(0, uncovered − planned) — information only; nothing is created
   * No customer, price, discount, tax or total.
   */
  private async demandRows(actor: ProductionActor, branchId?: string, search?: string) {
    const branches = this.branchFilter(actor, branchId);
    const c = search ? { contains: search, mode: 'insensitive' as const } : undefined;
    const lines = await this.db.salesOrderLine.findMany({
      where: {
        companyId: actor.access.company.id,
        branchId: { in: branches },
        itemType: 'FINISHED_GOOD',
        inventoryTracked: true,
        order: { status: 'CONFIRMED' },
        ...(c ? { OR: [{ itemCode: c }, { itemName: c }, { order: { number: c } }] } : {}),
      },
      select: {
        id: true,
        lineNo: true,
        branchId: true,
        itemId: true,
        itemCode: true,
        itemName: true,
        unitCode: true,
        unitPrecision: true,
        quantity: true,
        order: {
          select: {
            id: true,
            number: true,
            status: true,
            requestedDate: true,
            branch: { select: { id: true, code: true, name: true } },
          },
        },
        productionOrders: {
          where: { status: { in: [...OPEN] } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, number: true, status: true, quantity: true },
        },
      },
      take: 500,
    });
    lines.sort(
      (a, b) =>
        (day(a.order.requestedDate) ?? '9999').localeCompare(
          day(b.order.requestedDate) ?? '9999',
        ) ||
        a.order.number.localeCompare(b.order.number) ||
        a.lineNo - b.lineNo,
    );
    const [progress, stock, boms] = await Promise.all([
      lineProgress(this.db, [...new Set(lines.map((l) => l.order.id))]),
      availableFor(
        this.db,
        actor.access.company.id,
        this.today(actor),
        lines.map((l) => ({ branchId: l.branchId, itemId: l.itemId })),
      ),
      this.db.productionBom.findMany({
        where: {
          companyId: actor.access.company.id,
          status: 'ACTIVE',
          itemId: { in: [...new Set(lines.map((l) => l.itemId))] },
        },
        select: { id: true, itemId: true, code: true, revision: true },
      }),
    ]);
    const left = new Map<string, Decimal>();
    const rows = lines.map((l) => {
      const p = progress.get(l.id);
      const allocated = p?.allocated ?? ZERO;
      const dispatched = p?.dispatched ?? ZERO;
      const open = Decimal.max(ZERO, l.quantity.minus(allocated));
      const k = `${l.branchId}/${l.itemId}`;
      const pool = left.get(k) ?? stockOf(stock, l.branchId, l.itemId).available;
      const share = Decimal.min(pool, open);
      left.set(k, pool.minus(share));
      const uncovered = open.minus(share);
      const planned = l.productionOrders.reduce((t, o) => t.plus(o.quantity), ZERO);
      const bom = boms.find((b) => b.itemId === l.itemId);
      return DemandRow.parse({
        salesOrder: {
          id: l.order.id,
          number: l.order.number,
          status: l.order.status,
          requestedDate: day(l.order.requestedDate),
        },
        lineId: l.id,
        lineNo: l.lineNo,
        branch: l.order.branch,
        item: { id: l.itemId, code: l.itemCode, name: l.itemName },
        unit: { code: l.unitCode, precision: l.unitPrecision },
        ordered: l.quantity.toString(),
        dispatched: dispatched.toString(),
        reserved: Decimal.max(ZERO, allocated.minus(dispatched)).toString(),
        open: open.toString(),
        availableShare: share.toString(),
        uncovered: uncovered.toString(),
        planned: planned.toString(),
        suggested: Decimal.max(ZERO, uncovered.minus(planned)).toString(),
        activeBom: bom ? { id: bom.id, code: bom.code, revision: bom.revision } : null,
        orders: l.productionOrders.map((o) => ({ ...o, quantity: o.quantity.toString() })),
      });
    });
    return rows.filter((r) => r.open !== '0' || r.orders.length);
  }

  async demand(
    ctx: AuthContext,
    q: { branchId?: string; q?: string; page: number; pageSize: number },
  ) {
    const actor = await this.reader(ctx);
    if (q.branchId && !inBranch(actor, q.branchId)) {
      throw fail(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
    }
    const all = await this.demandRows(actor, q.branchId, q.q);
    const items = all.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    return {
      items,
      total: all.length,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: q.page * q.pageSize < all.length,
    };
  }

  /**
   * The Purchasing handoff (purchasing.production_shortages.view): materials that
   * APPROVED / READY production orders lack now, in the member's branches. Read-only;
   * nothing is requested or ordered automatically.
   */
  async shortages(ctx: AuthContext, q: { branchId?: string }) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.shortages) throw permissionDenied('purchasing.production_shortages.view');
    if (q.branchId && !inBranch(actor, q.branchId)) {
      throw fail(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
    }
    const orders = await this.db.productionOrder.findMany({
      where: {
        companyId: actor.access.company.id,
        branchId: { in: this.branchFilter(actor, q.branchId) },
        status: { in: [...COMMITTED] },
      },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        materials: { orderBy: { lineNo: 'asc' } },
      },
      orderBy: [{ requiredDate: { sort: 'asc', nulls: 'last' } }, { number: 'asc' }],
      take: 500,
    });
    const stock = await availableFor(
      this.db,
      actor.access.company.id,
      this.today(actor),
      orders.flatMap((o) => o.materials.map((m) => ({ branchId: o.branchId, itemId: m.itemId }))),
    );
    const items = orders.flatMap((o) =>
      o.materials.flatMap((m) => {
        const available = stockOf(stock, o.branchId, m.itemId).available;
        const s = materialState(m.requiredQuantity, available);
        if (s.shortage.isZero()) return [];
        return [
          ShortageRow.parse({
            order: {
              id: o.id,
              number: o.number,
              status: o.status,
              requiredDate: day(o.requiredDate),
              plannedStartDate: day(o.plannedStartDate),
            },
            branch: o.branch,
            material: { id: m.itemId, code: m.itemCode, name: m.itemName },
            unit: { code: m.unitCode, precision: m.unitPrecision },
            required: m.requiredQuantity.toString(),
            available: available.toString(),
            shortage: s.shortage.toString(),
          }),
        ];
      }),
    );
    return { items };
  }

  // ------------------------------------------------------------------ validation

  private async outputItem(tx: Prisma.TransactionClient | Db, companyId: string, itemId: string) {
    const item = await tx.item.findFirst({
      where: { id: itemId, companyId },
      include: { baseUnit: true },
    });
    if (!item) {
      throw fail(422, 'REFERENCE_NOT_FOUND', 'The selected record does not exist.', {
        field: 'itemId',
      });
    }
    if (item.type !== 'FINISHED_GOOD' || !item.inventoryTracked) {
      throw fail(
        422,
        'ITEM_NOT_MANUFACTURABLE',
        'Only a stock-tracked finished good can be produced.',
        { field: 'itemId' },
      );
    }
    if (item.status !== 'ACTIVE') {
      throw fail(422, 'REFERENCE_INACTIVE', 'This item is inactive.', { field: 'itemId' });
    }
    return item;
  }

  private checkQuantity(quantity: string, precision: number) {
    if (places(quantity) > precision) {
      throw fail(
        422,
        'QUANTITY_PRECISION',
        'A quantity has more decimal places than its unit allows.',
        { field: 'quantity', precision },
      );
    }
  }

  private dates(start: string | null, required: string | null) {
    if (start && required && required < start) {
      throw fail(
        422,
        'DATE_RANGE_INVALID',
        'The required completion date cannot be before the planned start.',
        { field: 'requiredDate' },
      );
    }
  }

  /** The confirmed sales line a sales-demand order answers, locked (FOR SHARE) while we decide. */
  private async salesLine(tx: Prisma.TransactionClient, actor: ProductionActor, lineId: string) {
    const line = await tx.salesOrderLine.findFirst({
      where: { id: lineId, companyId: actor.access.company.id },
      select: {
        id: true,
        salesOrderId: true,
        branchId: true,
        itemId: true,
        itemType: true,
        inventoryTracked: true,
      },
    });
    // Another company's line, or a branch this member cannot work in: not found.
    if (!line || !inBranch(actor, line.branchId)) {
      throw fail(404, 'SALES_LINE_NOT_FOUND', 'This sales order line was not found.');
    }
    await this.lockSales(tx, line.salesOrderId);
    if (line.itemType !== 'FINISHED_GOOD' || !line.inventoryTracked) {
      throw fail(
        422,
        'ITEM_NOT_MANUFACTURABLE',
        'Only a stock-tracked finished good can be produced.',
        { field: 'salesOrderLineId' },
      );
    }
    return line;
  }

  /** Locks the sales order row (shared) and requires it CONFIRMED — serialized with its cancel. */
  private async lockSales(tx: Prisma.TransactionClient, salesOrderId: string) {
    const rows = await tx.$queryRaw<{ status: string }[]>`
      SELECT "status"::text AS "status" FROM "SalesOrder" WHERE "id" = ${salesOrderId} FOR SHARE`;
    if (rows[0]?.status !== 'CONFIRMED') {
      throw fail(
        409,
        'SALES_SOURCE_NOT_CONFIRMED',
        'The linked sales order is no longer confirmed: review this demand.',
      );
    }
  }

  private event(
    tx: Prisma.TransactionClient,
    actor: ProductionActor,
    meta: RequestMeta,
    action: ProductionAuditAction,
    o: { id: string; number: string },
    details: Record<string, string | number | boolean | null> = {},
  ) {
    return recordCompanyEvent(tx, meta, {
      action,
      actorId: actor.access.actor.userId,
      actorScope: this.scope,
      companyId: actor.access.company.id,
      entityType: 'ProductionOrder',
      entityId: o.id,
      details: { number: o.number, ...details },
    });
  }

  private async locked(
    tx: Prisma.TransactionClient,
    actor: ProductionActor,
    id: string,
    action: MoAction,
  ) {
    // No Production access at all is 403; an order hidden from a Production member is 404.
    if (!actor.view) throw permissionDenied('operations.orders.view');
    await tx.$queryRaw`SELECT "id" FROM "ProductionOrder" WHERE "id" = ${id} FOR UPDATE`;
    const o = await tx.productionOrder.findFirst({
      where: { id, companyId: actor.access.company.id },
    });
    if (!o || !canSee(actor, o)) throw orderNotFound();
    assertMo(actor, action, o);
    return o;
  }

  /**
   * Re-validate the plan against the masters now and recompute its requirements:
   * the item still a manufacturable active finished good, the BOM revision still
   * ACTIVE (locked FOR SHARE: a retirement waits), every material active; the
   * sales source still CONFIRMED. Used by submit and approve.
   */
  private async refresh(tx: Prisma.TransactionClient, o: Prisma.ProductionOrderGetPayload<object>) {
    if (o.source === 'SALES_DEMAND' && o.salesOrderId) await this.lockSales(tx, o.salesOrderId);
    if (!o.bomId) {
      throw fail(422, 'BOM_REQUIRED', 'Choose an active BOM revision first.', { field: 'bomId' });
    }
    await tx.$queryRaw`SELECT "id" FROM "ProductionBom" WHERE "id" = ${o.bomId} FOR SHARE`;
    const item = await this.outputItem(tx, o.companyId, o.itemId);
    const bom = await tx.productionBom.findFirst({
      where: { id: o.bomId, companyId: o.companyId },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!bom || bom.status !== 'ACTIVE') {
      throw fail(
        409,
        'BOM_NOT_ACTIVE',
        'The BOM revision of this order is no longer active: choose the current revision.',
      );
    }
    const inactive = await tx.item.count({
      where: { id: { in: bom.lines.map((l) => l.itemId) }, status: { not: 'ACTIVE' } },
    });
    if (inactive) {
      throw fail(422, 'MATERIAL_INACTIVE', 'A material of this BOM is inactive.');
    }
    const quantity = o.quantity.toString();
    this.checkQuantity(quantity, item.baseUnit.precision);
    const rows = this.materialRows(bom, quantity);
    await this.writeMaterials(tx, o, rows);
    await tx.productionOrder.update({
      where: { id: o.id },
      data: {
        itemCode: item.code,
        itemName: item.name,
        unitCode: item.baseUnit.code,
        unitPrecision: item.baseUnit.precision,
        ...this.bomFields(bom),
      },
    });
    return rows.length;
  }

  // ------------------------------------------------------------------ writes

  async create(ctx: AuthContext, input: CreateMoInput, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    if (!actor.create) throw permissionDenied('operations.orders.create');
    const id = await this.createAs(actor, ctx, input, meta);
    return this.get(ctx, id);
  }

  /** `extra`: additional audit details (the demo seed's stable fixture key). */
  async createAs(
    actor: ProductionActor,
    ctx: AuthContext,
    input: CreateMoInput,
    meta: RequestMeta,
    extra: Record<string, string> = {},
  ) {
    const companyId = actor.access.company.id;
    const today = this.today(actor);
    this.dates(input.plannedStartDate ?? null, input.requiredDate ?? null);
    return this.db.$transaction(async (tx) => {
      let branchId: string;
      let itemId: string;
      let sales: { salesOrderId: string; salesOrderLineId: string } | null = null;
      if (input.salesOrderLineId) {
        const line = await this.salesLine(tx, actor, input.salesOrderLineId);
        branchId = line.branchId;
        itemId = line.itemId;
        sales = { salesOrderId: line.salesOrderId, salesOrderLineId: line.id };
      } else {
        branchId = this.workingBranch(actor, ctx, input.branchId).id;
        itemId = input.itemId!;
      }
      const item = await this.outputItem(tx, companyId, itemId);
      this.checkQuantity(input.quantity, item.baseUnit.precision);
      const bom = await this.resolveBom(tx, companyId, item.id, input.bomId);
      const period = today.slice(0, 7).replace('-', '');
      const seq = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
        VALUES (${companyId}, ${`MO:${period}`}, 1, NOW())
        ON CONFLICT ("companyId", "key")
        DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue"`;
      const number = `MO-${period}-${String(seq[0]!.lastValue).padStart(6, '0')}`;
      const o = await tx.productionOrder.create({
        data: {
          companyId,
          branchId,
          number,
          source: sales ? 'SALES_DEMAND' : 'MANUAL',
          ...(sales ?? {}),
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          unitId: item.baseUnitId,
          unitCode: item.baseUnit.code,
          unitPrecision: item.baseUnit.precision,
          ...this.bomFields(bom),
          quantity: input.quantity,
          plannedStartDate: input.plannedStartDate ? asDay(input.plannedStartDate) : null,
          requiredDate: input.requiredDate ? asDay(input.requiredDate) : null,
          priority: input.priority ?? 'NORMAL',
          note: input.note ?? null,
          createdByMemberId: actor.memberId,
        },
      });
      if (bom) await this.writeMaterials(tx, o, this.materialRows(bom, input.quantity));
      await this.event(tx, actor, meta, 'PRODUCTION_ORDER_CREATED', o, {
        source: o.source,
        materials: bom?.lines.length ?? 0,
        ...extra,
      });
      return o.id;
    });
  }

  async update(ctx: AuthContext, id: string, input: UpdateMoInput, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.db.$transaction(async (tx) => {
      const o = await this.locked(tx, actor, id, 'edit');
      const start =
        input.plannedStartDate !== undefined ? input.plannedStartDate : day(o.plannedStartDate);
      const required = input.requiredDate !== undefined ? input.requiredDate : day(o.requiredDate);
      this.dates(start, required);
      const quantity = input.quantity ?? o.quantity.toString();
      this.checkQuantity(quantity, o.unitPrecision);
      const bom =
        input.bomId !== undefined
          ? await this.resolveBom(tx, o.companyId, o.itemId, input.bomId)
          : o.bomId
            ? await tx.productionBom.findFirst({
                where: { id: o.bomId },
                include: { lines: { orderBy: { lineNo: 'asc' } } },
              })
            : await this.resolveBom(tx, o.companyId, o.itemId, null);
      await tx.productionOrder.update({
        where: { id },
        data: {
          quantity,
          ...this.bomFields(bom),
          plannedStartDate: start ? asDay(start) : null,
          requiredDate: required ? asDay(required) : null,
          ...(input.priority ? { priority: input.priority } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
        },
      });
      await this.writeMaterials(tx, o, bom ? this.materialRows(bom, quantity) : []);
      await this.event(tx, actor, meta, 'PRODUCTION_ORDER_UPDATED', o, {
        fields: Object.keys(input).sort().join(','),
      });
    });
    return this.get(ctx, id);
  }

  async submit(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.transition(actor, id, 'submit', meta);
    return this.get(ctx, id);
  }

  async approve(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.transition(actor, id, 'approve', meta);
    return this.get(ctx, id);
  }

  async release(ctx: AuthContext, id: string, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.transition(actor, id, 'release', meta);
    return this.get(ctx, id);
  }

  async reject(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.transition(actor, id, 'reject', meta, reason);
    return this.get(ctx, id);
  }

  async cancel(ctx: AuthContext, id: string, reason: string | null, meta: RequestMeta) {
    const actor = await loadProductionActor(this.db, ctx);
    await this.transition(actor, id, 'cancel', meta, reason);
    return this.get(ctx, id);
  }

  /** Every status change: order row locked, action checked centrally, one audit event. */
  async transition(
    actor: ProductionActor,
    id: string,
    action: Exclude<MoAction, 'edit'>,
    meta: RequestMeta,
    reason: string | null = null,
  ) {
    await this.db.$transaction(async (tx) => {
      const o = await this.locked(tx, actor, id, action);
      const now = new Date();
      const by = actor.memberId;
      if (action === 'submit') {
        const n = await this.refresh(tx, o);
        await tx.productionOrder.update({
          where: { id },
          data: { status: 'SUBMITTED', submittedAt: now, submittedByMemberId: by },
        });
        await this.event(tx, actor, meta, 'PRODUCTION_ORDER_SUBMITTED', o, {
          from: 'DRAFT',
          to: 'SUBMITTED',
          materials: n,
        });
      } else if (action === 'approve') {
        // Last refresh (sales source CONFIRMED, BOM revision ACTIVE, masters active), then frozen.
        const n = await this.refresh(tx, o);
        await tx.productionOrder.update({
          where: { id },
          data: { status: 'APPROVED', approvedAt: now, approvedByMemberId: by },
        });
        await this.event(tx, actor, meta, 'PRODUCTION_ORDER_APPROVED', o, {
          from: 'SUBMITTED',
          to: 'APPROVED',
          materials: n,
        });
      } else if (action === 'reject') {
        if (!reason) {
          throw fail(422, 'REASON_REQUIRED', 'Give a reason for rejecting.', { field: 'reason' });
        }
        await tx.productionOrder.update({
          where: { id },
          data: {
            status: 'REJECTED',
            rejectedAt: now,
            rejectedByMemberId: by,
            rejectionReason: reason,
          },
        });
        await this.event(tx, actor, meta, 'PRODUCTION_ORDER_REJECTED', o, {
          from: 'SUBMITTED',
          to: 'REJECTED',
        });
      } else if (action === 'release') {
        // READY means released with every material available NOW (a snapshot; nothing is reserved).
        if (o.source === 'SALES_DEMAND' && o.salesOrderId) await this.lockSales(tx, o.salesOrderId);
        const materials = await tx.productionOrderMaterial.findMany({
          where: { productionOrderId: id },
        });
        const stock = await availableFor(
          tx,
          o.companyId,
          this.today(actor),
          materials.map((m) => ({ branchId: o.branchId, itemId: m.itemId })),
        );
        const short = materials.filter(
          (m) =>
            !materialState(
              m.requiredQuantity,
              stockOf(stock, o.branchId, m.itemId).available,
            ).shortage.isZero(),
        );
        if (short.length) {
          throw fail(
            409,
            'MATERIALS_SHORT',
            'Materials are short now: an order is released only when every material is available.',
            { materials: short.map((m) => m.itemCode) },
          );
        }
        await tx.productionOrder.update({
          where: { id },
          data: { status: 'READY', releasedAt: now, releasedByMemberId: by },
        });
        await this.event(tx, actor, meta, 'PRODUCTION_ORDER_RELEASED', o, {
          from: 'APPROVED',
          to: 'READY',
        });
      } else {
        if (o.status !== 'DRAFT' && !reason) {
          throw fail(422, 'REASON_REQUIRED', 'Give a reason for cancelling.', { field: 'reason' });
        }
        await tx.productionOrder.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelledByMemberId: by,
            cancellationReason: reason,
          },
        });
        await this.event(tx, actor, meta, 'PRODUCTION_ORDER_CANCELLED', o, {
          from: o.status,
          to: 'CANCELLED',
        });
      }
    });
  }
}
