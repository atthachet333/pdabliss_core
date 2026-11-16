import type { AuthContext } from '../auth/sessions.js';
import type { DepartmentCode } from '../billing/catalog.js';
import { requireOperationsContext, type OperationsContext } from '../company/context.js';
import type { Db } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import {
  permissionDefinition,
  workspacePermission,
  type PermissionCode,
} from '../permissions/catalog.js';
import { permissionDenied } from '../permissions/guard.js';
import { receivedByReport } from '../production/output.js';
import { ProductionOrderService } from '../production/service.js';
import { companyDay } from '../purchasing/service.js';
import { Decimal, ZERO } from '../purchasing/money.js';
import { EXPIRING_SOON_DAYS } from '../warehouse/service.js';
import {
  DashboardIndexView,
  DashboardView,
  type DashboardAnswer,
  type MetricRow,
  type QueueBlock,
  type QueueRow,
} from './view.js';

/*
 * EP47 department dashboards — docs/EP47_METRIC_DEFINITIONS.md is the contract.
 *
 * READ-ONLY projections of the canonical documents. Nothing here writes, reserves,
 * posts or moves stock; no state is stored or cached (every request reads the
 * database again, so a revoked permission or a changed branch shows at once).
 *
 * Scope, for every number and row:
 *   company     the session's company (never from the request)
 *   branch      the session's SELECTED branch, validated by requireOperationsContext
 *               (another company's or a no-longer-permitted branch is refused there)
 *   department  `<dept>.workspace.view` opens the dashboard (EP45: a regular member
 *               holds it only in their one department; Executive READ; Owner all;
 *               System Admin none) — then EACH metric / queue needs the permission of
 *               the screen it summarizes, or it is left out entirely (no count leaks)
 * Rows carry identity and state, never prices, costs, discounts or totals; the one
 * money field is the deposit amount on the Accounting dashboard (accounting.deposits.view).
 * Production rows carry the order's planned output only — never recipe lines, ratios
 * or BOM-derived material quantities (EP46).
 */

export const DASHBOARD_DEPARTMENTS = [
  'SALES',
  'OPERATIONS',
  'WAREHOUSE',
  'PURCHASING',
  'ACCOUNTING',
] as const satisfies readonly DepartmentCode[];
export type DashboardDepartment = (typeof DASHBOARD_DEPARTMENTS)[number];

/** Rows per work queue (the full list is one click away on the document screens). */
export const QUEUE_LIMIT = 8;
/** "Recent" windows. */
export const RECENT_DAYS = 7;
const DAY_MS = 86_400_000;

const notAvailable = (department: string) =>
  new AppError(404, 'DASHBOARD_NOT_FOUND', 'There is no dashboard for this department.', {
    department,
  });

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const asDay = (v: string) => new Date(`${v}T00:00:00Z`);
const addDays = (v: string, n: number) => day(new Date(asDay(v).getTime() + n * DAY_MS))!;

type Has = (code: PermissionCode) => boolean;

interface Scope {
  op: OperationsContext;
  companyId: string;
  branchId: string;
  today: string;
  has: Has;
  mode: 'BOM_REQUIRED' | 'BOM_OPTIONAL';
  memberId: string;
}

/** A queue row with the defaults of the optional fields. */
const row = (
  r: Omit<QueueRow, 'progress' | 'quantity' | 'amount' | 'overdue'> &
    Partial<Pick<QueueRow, 'progress' | 'quantity' | 'amount' | 'overdue'>>,
): QueueRow => ({
  progress: null,
  quantity: null,
  amount: null,
  overdue: false,
  ...r,
});

const metric = (
  key: string,
  value: number,
  tone: MetricRow['tone'],
  link: string | null,
): MetricRow => ({ key, value, tone, link });

/** Highest tier the person holds in the department (presentation only). */
function accessOf(permissions: readonly PermissionCode[], department: DepartmentCode) {
  const tiers = new Set(
    permissions
      .map((p) => permissionDefinition(p))
      .filter((d) => d.namespace === department)
      .map((d) => d.tier),
  );
  return tiers.has('MANAGE') ? 'MANAGE' : tiers.has('OPERATE') ? 'OPERATE' : 'READ';
}

const isOverdue = (date: string | null, today: string) => !!date && date < today;

export class DashboardService {
  private readonly production: ProductionOrderService;

  constructor(private readonly db: Db) {
    this.production = new ProductionOrderService(db);
  }

  private async scope(ctx: AuthContext): Promise<Scope> {
    const op = await requireOperationsContext(this.db, ctx);
    const company = await this.db.company.findUniqueOrThrow({
      where: { id: op.companyId },
      select: { timezone: true, manufacturingMode: true },
    });
    const member = await this.db.companyMember.findFirstOrThrow({
      where: { companyId: op.companyId, userId: ctx.user.id },
      select: { id: true },
    });
    return {
      op,
      companyId: op.companyId,
      branchId: op.branch.id,
      today: companyDay(company.timezone),
      has: (code) => op.permissions.includes(code),
      mode: company.manufacturingMode,
      memberId: member.id,
    };
  }

  /** Which department dashboards this person may open in the selected branch. */
  async index(ctx: AuthContext) {
    const s = await this.scope(ctx);
    return DashboardIndexView.parse({
      branch: { id: s.op.branch.id, code: s.op.branch.code, name: s.op.branch.name },
      role: s.op.role,
      assignment: s.op.assignment,
      dashboards: DASHBOARD_DEPARTMENTS.filter((d) => s.has(workspacePermission(d))),
    });
  }

  async dashboard(ctx: AuthContext, department: string) {
    const dept = DASHBOARD_DEPARTMENTS.find((d) => d === department);
    if (!dept) throw notAvailable(department);
    const s = await this.scope(ctx);
    const gate = workspacePermission(dept);
    if (!s.has(gate)) throw permissionDenied(gate);
    const built = await {
      SALES: () => this.sales(s),
      PURCHASING: () => this.purchasing(s, ctx),
      WAREHOUSE: () => this.warehouse(s),
      OPERATIONS: () => this.operations(s, ctx),
      ACCOUNTING: () => this.accounting(s),
    }[dept]();
    const answer: DashboardAnswer = {
      department: dept,
      branch: { id: s.op.branch.id, code: s.op.branch.code, name: s.op.branch.name },
      today: s.today,
      generatedAt: new Date().toISOString(),
      access: accessOf(s.op.permissions, dept),
      manufacturingMode: dept === 'OPERATIONS' ? s.mode : null,
      notes: [],
      ...built,
    };
    return DashboardView.parse(answer);
  }

  // ===================================================================== SALES

  /**
   * Sales (sales.orders.view). Open CONFIRMED orders are put in exactly ONE fulfilment
   * stage from their inventory-tracked lines (exception → allocation → fulfilment →
   * delivery), from one aggregate query; nothing is counted twice.
   */
  private async sales(s: Scope) {
    if (!s.has('sales.orders.view')) return { metrics: [], queues: [] };
    const confirmer = s.has('sales.orders.approve');
    const base = { companyId: s.companyId, branchId: s.branchId };
    const since = asDay(addDays(s.today, -(RECENT_DAYS - 1)));
    const openStatuses = { in: ['SUBMITTED', 'CONFIRMED'] as ('SUBMITTED' | 'CONFIRMED')[] };

    const [drafts, recentNew, submitted, fulfilment] = await Promise.all([
      this.db.salesOrder.count({
        where: { ...base, status: 'DRAFT', createdByMemberId: s.memberId },
      }),
      this.db.salesOrder.count({
        where: { ...base, status: openStatuses, orderDate: { gte: since } },
      }),
      this.db.salesOrder.findMany({
        where: { ...base, status: 'SUBMITTED' },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          number: true,
          customerName: true,
          requestedDate: true,
          submittedAt: true,
          _count: { select: { lines: true } },
        },
        take: 500,
      }),
      this.db.$queryRaw<
        {
          id: string;
          number: string;
          customerName: string;
          requestedDate: Date | null;
          lines: number;
          unallocated: number;
          undispatched: number;
          undelivered: number;
          someDelivered: boolean;
          exception: boolean;
          lastDelivered: Date | null;
        }[]
      >`
        SELECT o."id", o."number", o."customerName", o."requestedDate",
          COUNT(*)::int AS "lines",
          COUNT(*) FILTER (WHERE a.q < l."quantity")::int AS "unallocated",
          COUNT(*) FILTER (WHERE s.dq < l."quantity")::int AS "undispatched",
          COUNT(*) FILTER (WHERE s.vq < l."quantity")::int AS "undelivered",
          BOOL_OR(s.vq > 0) AS "someDelivered",
          EXISTS (SELECT 1 FROM "SalesShipment" x WHERE x."salesOrderId" = o."id"
                  AND x."status" = 'DELIVERY_EXCEPTION') AS "exception",
          (SELECT MAX(x."deliveredAt") FROM "SalesShipment" x WHERE x."salesOrderId" = o."id"
                  AND x."status" = 'DELIVERED') AS "lastDelivered"
        FROM "SalesOrder" o
        JOIN "SalesOrderLine" l ON l."salesOrderId" = o."id" AND l."inventoryTracked"
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(sa."quantity"), 0) AS q FROM "SalesAllocation" sa
          WHERE sa."salesOrderLineId" = l."id" AND sa."status" IN ('ACTIVE', 'CONSUMED')
        ) a ON TRUE
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(sl."quantity"), 0) AS dq, COALESCE(SUM(sl."deliveredQuantity"), 0) AS vq
          FROM "SalesShipmentLine" sl JOIN "SalesShipment" sh ON sh."id" = sl."shipmentId"
          WHERE sl."salesOrderLineId" = l."id"
            AND sh."status" IN ('DISPATCHED', 'DELIVERED', 'DELIVERY_EXCEPTION')
        ) s ON TRUE
        WHERE o."companyId" = ${s.companyId} AND o."branchId" = ${s.branchId}
          AND o."status" = 'CONFIRMED'
        GROUP BY o."id"
        HAVING COUNT(*) FILTER (WHERE s.vq < l."quantity") > 0
          OR EXISTS (SELECT 1 FROM "SalesShipment" x WHERE x."salesOrderId" = o."id"
                     AND x."status" = 'DELIVERED' AND x."deliveredAt" >= ${since})
        ORDER BY o."requestedDate" ASC NULLS LAST, o."number" ASC
        LIMIT 2000
      `,
    ]);

    type Stage = 'EXCEPTION' | 'ALLOCATION' | 'FULFILMENT' | 'DELIVERY' | 'COMPLETED';
    const stageOf = (o: (typeof fulfilment)[number]): Stage =>
      o.undelivered === 0
        ? 'COMPLETED'
        : o.exception
          ? 'EXCEPTION'
          : o.unallocated > 0
            ? 'ALLOCATION'
            : o.undispatched > 0
              ? 'FULFILMENT'
              : 'DELIVERY';
    const open = fulfilment.map((o) => ({ o, stage: stageOf(o) }));
    const count = (st: Stage) => open.filter((x) => x.stage === st).length;
    const live = open.filter((x) => x.stage !== 'COMPLETED');
    const completed = open.filter(
      (x) => x.stage === 'COMPLETED' && x.o.lastDelivered && x.o.lastDelivered >= since,
    );
    const delayed =
      submitted.filter((o) => isOverdue(day(o.requestedDate), s.today)).length +
      live.filter((x) => isOverdue(day(x.o.requestedDate), s.today)).length;

    const list = '/core/sales';
    const link = (id: string) => `/core/sales/orders/${id}`;
    const ACT: Record<Exclude<Stage, 'COMPLETED'>, [string, DepartmentCode, PermissionCode]> = {
      EXCEPTION: ['SALES_ORDER.RESOLVE_DELIVERY', 'WAREHOUSE', 'warehouse.delivery.confirm'],
      ALLOCATION: ['SALES_ORDER.ALLOCATE', 'SALES', 'sales.orders.approve'],
      FULFILMENT: ['SALES_ORDER.FULFIL', 'WAREHOUSE', 'warehouse.picking.process'],
      DELIVERY: ['SALES_ORDER.CONFIRM_DELIVERY', 'WAREHOUSE', 'warehouse.delivery.confirm'],
    };
    const ORDER: Stage[] = ['EXCEPTION', 'ALLOCATION', 'FULFILMENT', 'DELIVERY'];

    const work: QueueRow[] = [
      ...submitted.map((o) =>
        row({
          id: o.id,
          kind: 'SALES_ORDER',
          number: o.number,
          status: 'SUBMITTED',
          context: o.customerName,
          action: 'SALES_ORDER.CONFIRM',
          responsible: 'SALES',
          canAct: confirmer,
          date: day(o.requestedDate),
          dateKind: 'REQUESTED',
          overdue: isOverdue(day(o.requestedDate), s.today),
          link: link(o.id),
        }),
      ),
      ...ORDER.flatMap((st) =>
        live
          .filter((x) => x.stage === st)
          .map(({ o }) => {
            const [action, responsible, perm] = ACT[st as Exclude<Stage, 'COMPLETED'>];
            return row({
              id: o.id,
              kind: 'SALES_ORDER',
              number: o.number,
              status: `CONFIRMED.${st}`,
              context: o.customerName,
              action,
              responsible,
              canAct: s.has(perm),
              date: day(o.requestedDate),
              dateKind: 'REQUESTED',
              overdue: isOverdue(day(o.requestedDate), s.today),
              progress: { open: o.undelivered, total: o.lines },
              link: link(o.id),
            });
          }),
      ),
    ];
    // Overdue work first, then the stage order above (stable).
    work.sort((a, b) => Number(b.overdue) - Number(a.overdue));

    return {
      metrics: [
        metric('newOrders', recentNew, 'info', list),
        metric('awaitingConfirmation', submitted.length, 'attention', list),
        metric('awaitingAllocation', count('ALLOCATION'), 'attention', list),
        metric('awaitingFulfilment', count('FULFILMENT'), 'progress', list),
        metric('inDelivery', count('DELIVERY'), 'progress', list),
        metric(
          'partiallyDelivered',
          live.filter((x) => x.o.someDelivered).length,
          'progress',
          list,
        ),
        metric(
          'outstandingLines',
          live.reduce((n, x) => n + x.o.undelivered, 0),
          'info',
          list,
        ),
        metric('deliveryExceptions', count('EXCEPTION'), 'blocked', list),
        metric('delayed', delayed, 'blocked', list),
        metric('completedRecently', completed.length, 'done', list),
        metric('myDrafts', drafts, 'info', list),
      ],
      queues: [
        { key: 'work', total: work.length, items: work.slice(0, QUEUE_LIMIT) },
        {
          key: 'completed',
          total: completed.length,
          items: completed
            .sort((a, b) => b.o.lastDelivered!.getTime() - a.o.lastDelivered!.getTime())
            .slice(0, 5)
            .map(({ o }) =>
              row({
                id: o.id,
                kind: 'SALES_ORDER',
                number: o.number,
                status: 'CONFIRMED.COMPLETED',
                context: o.customerName,
                action: 'SALES_ORDER.NONE',
                responsible: 'SALES',
                canAct: false,
                date: day(o.lastDelivered),
                dateKind: 'DELIVERED',
                progress: { open: 0, total: o.lines },
                link: link(o.id),
              }),
            ),
        },
      ] satisfies QueueBlock[],
    };
  }

  // ================================================================ PURCHASING

  /** Purchase orders waiting to be received, with line-level receive progress (POSTED receipts). */
  private receiving(s: Scope) {
    return this.db.$queryRaw<
      {
        id: string;
        number: string;
        supplierName: string | null;
        expectedDate: Date | null;
        lines: number;
        open: number;
        someReceived: boolean;
      }[]
    >`
      SELECT po."id", po."number", po."supplierName", po."expectedDate",
        COUNT(*)::int AS "lines",
        COUNT(*) FILTER (WHERE g.acc + g.closed < ol."quantity")::int AS "open",
        BOOL_OR(g.acc + g.rej > 0) AS "someReceived"
      FROM "PurchaseOrder" po
      JOIN "PurchaseOrderLine" ol ON ol."purchaseOrderId" = po."id" AND ol."type" = 'ITEM'
      JOIN "Item" i ON i."id" = ol."itemId" AND i."inventoryTracked"
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(gl."acceptedQuantity"), 0) AS acc,
               COALESCE(SUM(gl."rejectedQuantity"), 0) AS rej,
               COALESCE(SUM(gl."rejectedQuantity") FILTER (WHERE NOT gl."replacementRequired"), 0) AS closed
        FROM "GoodsReceiptLine" gl JOIN "GoodsReceipt" gr ON gr."id" = gl."goodsReceiptId"
        WHERE gl."purchaseOrderLineId" = ol."id" AND gr."status" = 'POSTED'
      ) g ON TRUE
      WHERE po."companyId" = ${s.companyId} AND po."branchId" = ${s.branchId}
        AND po."status" = 'PENDING_RECEIVE'
      GROUP BY po."id"
      ORDER BY po."expectedDate" ASC NULLS LAST, po."number" ASC
      LIMIT 2000
    `;
  }

  private async purchasing(s: Scope, ctx: AuthContext) {
    const base = { companyId: s.companyId, branchId: s.branchId };
    const metrics: MetricRow[] = [];
    const queues: QueueBlock[] = [];
    const reqView = s.has('purchasing.requests.view');
    const poView = s.has('purchasing.orders.view');

    if (reqView) {
      const [submitted, approvedOpen] = await Promise.all([
        this.db.purchaseRequest.findMany({
          where: { ...base, status: 'SUBMITTED' },
          orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            number: true,
            department: true,
            needByDate: true,
            _count: { select: { lines: true } },
          },
          take: 500,
        }),
        this.db.$queryRaw<
          {
            id: string;
            number: string;
            department: DepartmentCode;
            needByDate: Date | null;
            lines: number;
            open: number;
          }[]
        >`
          SELECT r."id", r."number", r."department", r."needByDate",
            COUNT(*)::int AS "lines",
            COUNT(*) FILTER (WHERE o.q < rl."quantity")::int AS "open"
          FROM "PurchaseRequest" r
          JOIN "PurchaseRequestLine" rl ON rl."purchaseRequestId" = r."id"
          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(ol."quantity"), 0) AS q
            FROM "PurchaseOrderLine" ol JOIN "PurchaseOrder" po ON po."id" = ol."purchaseOrderId"
            WHERE ol."purchaseRequestLineId" = rl."id"
              AND po."status" IN ('ISSUED', 'WAITING_DEPOSIT', 'PENDING_RECEIVE', 'RECEIVED')
          ) o ON TRUE
          WHERE r."companyId" = ${s.companyId} AND r."branchId" = ${s.branchId}
            AND r."status" = 'APPROVED'
          GROUP BY r."id"
          HAVING COUNT(*) FILTER (WHERE o.q < rl."quantity") > 0
          ORDER BY r."needByDate" ASC NULLS LAST, r."number" ASC
          LIMIT 2000
        `,
      ]);
      const list = '/core/purchasing/requests';
      const link = (id: string) => `/core/purchasing/requests/${id}`;
      metrics.push(
        metric('requestsAwaitingDecision', submitted.length, 'attention', list),
        metric('requestsToOrder', approvedOpen.length, 'attention', list),
      );
      const rq = [
        ...submitted.map((r) =>
          row({
            id: r.id,
            kind: 'PURCHASE_REQUEST',
            number: r.number,
            status: 'SUBMITTED',
            context: r.department,
            action: 'PURCHASE_REQUEST.DECIDE',
            responsible: 'PURCHASING',
            canAct: s.has('purchasing.requests.approve'),
            date: day(r.needByDate),
            dateKind: 'NEEDED_BY',
            overdue: isOverdue(day(r.needByDate), s.today),
            link: link(r.id),
          }),
        ),
        ...approvedOpen.map((r) =>
          row({
            id: r.id,
            kind: 'PURCHASE_REQUEST',
            number: r.number,
            status: 'APPROVED',
            context: r.department,
            action: 'PURCHASE_REQUEST.ORDER',
            responsible: 'PURCHASING',
            canAct: s.has('purchasing.orders.create'),
            date: day(r.needByDate),
            dateKind: 'NEEDED_BY',
            overdue: isOverdue(day(r.needByDate), s.today),
            progress: { open: r.open, total: r.lines },
            link: link(r.id),
          }),
        ),
      ];
      queues.push({ key: 'requests', total: rq.length, items: rq.slice(0, QUEUE_LIMIT) });
    }

    if (poView) {
      const [drafts, waitingDeposit, receiving] = await Promise.all([
        this.db.purchaseOrder.findMany({
          where: { ...base, status: 'DRAFT' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, number: true, supplierName: true, expectedDate: true },
          take: 500,
        }),
        this.db.purchaseOrder.findMany({
          where: { ...base, status: 'WAITING_DEPOSIT' },
          orderBy: [{ depositDueDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
          select: { id: true, number: true, supplierName: true, depositDueDate: true },
          take: 500,
        }),
        this.receiving(s),
      ]);
      const list = '/core/purchasing/orders';
      const link = (id: string) => `/core/purchasing/orders/${id}`;
      const overdue = receiving.filter((o) => isOverdue(day(o.expectedDate), s.today));
      metrics.push(
        metric('ordersToIssue', drafts.length, 'attention', list),
        metric('ordersWaitingDeposit', waitingDeposit.length, 'progress', list),
        metric('ordersOpen', receiving.length, 'progress', list),
        metric(
          'ordersPartiallyReceived',
          receiving.filter((o) => o.someReceived && o.open > 0).length,
          'progress',
          list,
        ),
        metric(
          'outstandingLines',
          receiving.reduce((n, o) => n + o.open, 0),
          'info',
          list,
        ),
        metric('receiptsOverdue', overdue.length, 'blocked', list),
      );
      const po = [
        ...drafts.map((o) =>
          row({
            id: o.id,
            kind: 'PURCHASE_ORDER',
            number: o.number,
            status: 'DRAFT',
            context: o.supplierName,
            action: 'PURCHASE_ORDER.ISSUE',
            responsible: 'PURCHASING',
            canAct: s.has('purchasing.orders.approve'),
            date: day(o.expectedDate),
            dateKind: 'EXPECTED',
            link: link(o.id),
          }),
        ),
        ...waitingDeposit.map((o) =>
          row({
            id: o.id,
            kind: 'PURCHASE_ORDER',
            number: o.number,
            status: 'WAITING_DEPOSIT',
            context: o.supplierName,
            action: 'PURCHASE_ORDER.DEPOSIT',
            responsible: 'ACCOUNTING',
            canAct: s.has('accounting.deposits.confirm'),
            date: day(o.depositDueDate),
            dateKind: 'DEPOSIT_DUE',
            overdue: isOverdue(day(o.depositDueDate), s.today),
            link: link(o.id),
          }),
        ),
        ...receiving.map((o) =>
          row({
            id: o.id,
            kind: 'PURCHASE_ORDER',
            number: o.number,
            status: 'PENDING_RECEIVE',
            context: o.supplierName,
            action: 'PURCHASE_ORDER.RECEIVE',
            responsible: 'WAREHOUSE',
            canAct: s.has('warehouse.receiving.process'),
            date: day(o.expectedDate),
            dateKind: 'EXPECTED',
            overdue: isOverdue(day(o.expectedDate), s.today),
            progress: { open: o.open, total: o.lines },
            link: link(o.id),
          }),
        ),
      ];
      po.sort((a, b) => Number(b.overdue) - Number(a.overdue));
      queues.push({ key: 'orders', total: po.length, items: po.slice(0, QUEUE_LIMIT) });
    }

    // EP36 / EP46 handoff: the NUMBER of short materials only — the shortage screen keeps
    // its own projection (no BOM field, no output quantity); nothing recipe-derived here.
    if (s.has('purchasing.production_shortages.view')) {
      const rows = await this.production.shortages(ctx, { branchId: s.branchId });
      metrics.push(
        metric(
          'productionShortages',
          rows.items.length,
          'blocked',
          '/core/purchasing/production-shortages',
        ),
      );
    }
    return { metrics, queues };
  }

  // ================================================================= WAREHOUSE

  /**
   * Warehouse — quantities, documents and next steps only. No price, cost, discount,
   * margin, total or deposit is read or returned (the selects below name every field).
   */
  private async warehouse(s: Scope) {
    const base = { companyId: s.companyId, branchId: s.branchId };
    const metrics: MetricRow[] = [];
    const queues: QueueBlock[] = [];
    const items: QueueRow[] = [];
    const inv = s.has('warehouse.inventory.view');

    if (s.has('warehouse.receiving.view')) {
      const [receiving, drafts] = await Promise.all([
        this.receiving(s),
        this.db.goodsReceipt.findMany({
          where: { ...base, status: 'DRAFT' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, number: true, supplierName: true, receivedAt: true },
          take: 500,
        }),
      ]);
      metrics.push(
        metric('incomingOrders', receiving.length, 'progress', '/core/warehouse/pending-receive'),
        metric(
          'incomingOverdue',
          receiving.filter((o) => isOverdue(day(o.expectedDate), s.today)).length,
          'blocked',
          '/core/warehouse/pending-receive',
        ),
        metric('receiptsToPost', drafts.length, 'attention', '/core/warehouse/receipts'),
      );
      items.push(
        ...drafts.map((r) =>
          row({
            id: r.id,
            kind: 'GOODS_RECEIPT',
            number: r.number,
            status: 'DRAFT',
            context: r.supplierName,
            action: 'GOODS_RECEIPT.POST',
            responsible: 'WAREHOUSE',
            canAct: s.has('warehouse.receiving.process'),
            date: day(r.receivedAt),
            dateKind: 'RECEIVED',
            link: `/core/warehouse/receipts/${r.id}`,
          }),
        ),
        ...receiving.map((o) =>
          row({
            id: o.id,
            kind: 'PURCHASE_ORDER',
            number: o.number,
            status: 'PENDING_RECEIVE',
            context: o.supplierName,
            action: 'PURCHASE_ORDER.RECEIVE',
            responsible: 'WAREHOUSE',
            canAct: s.has('warehouse.receiving.process'),
            date: day(o.expectedDate),
            dateKind: 'EXPECTED',
            overdue: isOverdue(day(o.expectedDate), s.today),
            progress: { open: o.open, total: o.lines },
            link: `/core/warehouse/pending-receive/${o.id}`,
          }),
        ),
      );
    }

    if (inv) {
      const soon = asDay(addDays(s.today, EXPIRING_SOON_DAYS));
      const todayDate = asDay(s.today);
      const lots = (expiryDate: { gte?: Date; lte?: Date; lt?: Date }) =>
        this.db.stockBalance
          .findMany({
            where: { ...base, quantityOnHand: { gt: 0 }, lot: { expiryDate } },
            select: { lotId: true },
            distinct: ['lotId'],
            take: 5000,
          })
          .then((r) => r.length);
      const [
        transfers,
        adjustDraft,
        adjustSubmitted,
        counts,
        picks,
        packs,
        shipments,
        pickable,
        expiring,
        expired,
      ] = await Promise.all([
        this.db.inventoryTransfer.findMany({
          where: { ...base, status: 'DRAFT' },
          orderBy: [{ transferDate: 'asc' }, { id: 'asc' }],
          select: { id: true, number: true, transferDate: true },
          take: 500,
        }),
        this.db.stockAdjustment.count({ where: { ...base, status: 'DRAFT' } }),
        this.db.stockAdjustment.findMany({
          where: { ...base, status: 'SUBMITTED' },
          orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
          select: { id: true, number: true, reason: true, adjustmentDate: true },
          take: 500,
        }),
        this.db.cycleCount.findMany({
          where: { ...base, status: { in: ['DRAFT', 'COUNTING', 'REVIEW'] } },
          orderBy: [{ countDate: 'asc' }, { id: 'asc' }],
          select: { id: true, number: true, status: true, countDate: true },
          take: 500,
        }),
        this.db.salesPick.findMany({
          where: { ...base, status: { in: ['DRAFT', 'IN_PROGRESS'] } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, number: true, status: true, createdAt: true },
          take: 500,
        }),
        this.db.salesPack.findMany({
          where: { ...base, status: 'DRAFT' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, number: true, createdAt: true },
          take: 500,
        }),
        this.db.salesShipment.findMany({
          where: { ...base, status: { in: ['READY', 'DISPATCHED', 'DELIVERY_EXCEPTION'] } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, number: true, status: true, createdAt: true, dispatchedAt: true },
          take: 500,
        }),
        // Pending Pick (EP34/35): confirmed orders with reserved stock not yet claimed by a pick.
        this.db.$queryRaw<{ n: number }[]>`
          SELECT COUNT(DISTINCT sa."salesOrderId")::int AS n
          FROM "SalesAllocation" sa
          JOIN "SalesOrder" o ON o."id" = sa."salesOrderId" AND o."status" = 'CONFIRMED'
          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(COALESCE(pl."pickedQuantity", pl."plannedQuantity") - pl."dispatchedQuantity"), 0) AS c
            FROM "SalesPickLine" pl JOIN "SalesPick" p ON p."id" = pl."pickId"
            WHERE pl."allocationId" = sa."id" AND p."status" <> 'CANCELLED'
          ) cl ON TRUE
          WHERE sa."companyId" = ${s.companyId} AND sa."branchId" = ${s.branchId}
            AND sa."status" = 'ACTIVE' AND sa."quantity" > cl.c
        `,
        lots({ gte: todayDate, lte: soon }),
        lots({ lt: todayDate }),
      ]);
      const readyToDispatch = shipments.filter((x) => x.status === 'READY');
      const inTransit = shipments.filter((x) => x.status === 'DISPATCHED');
      const exceptions = shipments.filter((x) => x.status === 'DELIVERY_EXCEPTION');
      metrics.push(
        metric('ordersToPick', pickable[0]?.n ?? 0, 'attention', '/core/warehouse/pending-pick'),
        metric('picksOpen', picks.length, 'progress', '/core/warehouse/picks'),
        metric('packsOpen', packs.length, 'progress', '/core/warehouse/packs'),
        metric('readyToDispatch', readyToDispatch.length, 'attention', '/core/warehouse/shipments'),
        metric('inTransit', inTransit.length, 'progress', '/core/warehouse/shipments'),
        metric('deliveryExceptions', exceptions.length, 'blocked', '/core/warehouse/shipments'),
        metric('transfersOpen', transfers.length, 'progress', '/core/warehouse/transfers'),
        metric('adjustmentsDraft', adjustDraft, 'info', '/core/warehouse/adjustments'),
        metric(
          'adjustmentsToApprove',
          adjustSubmitted.length,
          'attention',
          '/core/warehouse/adjustments',
        ),
        metric(
          'countsOpen',
          counts.filter((c) => c.status !== 'REVIEW').length,
          'progress',
          '/core/warehouse/counts',
        ),
        metric(
          'countsToReview',
          counts.filter((c) => c.status === 'REVIEW').length,
          'attention',
          '/core/warehouse/counts',
        ),
        metric('lotsExpiringSoon', expiring, 'attention', '/core/warehouse/lots'),
        metric('lotsExpired', expired, 'blocked', '/core/warehouse/lots'),
      );
      const fulfil = (
        kind: 'SALES_PICK' | 'SALES_PACK' | 'SALES_SHIPMENT',
        path: string,
        x: { id: string; number: string; status?: string; createdAt: Date },
        action: string,
        perm: PermissionCode,
      ) =>
        row({
          id: x.id,
          kind,
          number: x.number,
          status: x.status ?? 'DRAFT',
          context: null,
          action,
          responsible: 'WAREHOUSE',
          canAct: s.has(perm),
          date: day(x.createdAt),
          dateKind: 'CREATED',
          link: `/core/warehouse/${path}/${x.id}`,
        });
      items.push(
        ...exceptions.map((x) =>
          fulfil(
            'SALES_SHIPMENT',
            'shipments',
            x,
            'SALES_SHIPMENT.RESOLVE',
            'warehouse.delivery.confirm',
          ),
        ),
        ...readyToDispatch.map((x) =>
          fulfil(
            'SALES_SHIPMENT',
            'shipments',
            x,
            'SALES_SHIPMENT.DISPATCH',
            'warehouse.dispatch.confirm',
          ),
        ),
        ...inTransit.map((x) =>
          fulfil(
            'SALES_SHIPMENT',
            'shipments',
            x,
            'SALES_SHIPMENT.DELIVER',
            'warehouse.delivery.confirm',
          ),
        ),
        ...packs.map((x) =>
          fulfil('SALES_PACK', 'packs', x, 'SALES_PACK.PACK', 'warehouse.picking.process'),
        ),
        ...picks.map((x) =>
          fulfil('SALES_PICK', 'picks', x, 'SALES_PICK.PICK', 'warehouse.picking.process'),
        ),
        ...adjustSubmitted.map((a) =>
          row({
            id: a.id,
            kind: 'STOCK_ADJUSTMENT',
            number: a.number,
            status: 'SUBMITTED',
            context: a.reason,
            action: 'STOCK_ADJUSTMENT.APPROVE',
            responsible: 'WAREHOUSE',
            canAct: s.has('warehouse.stock_adjustment.approve'),
            date: day(a.adjustmentDate),
            dateKind: 'ADJUSTMENT',
            link: `/core/warehouse/adjustments/${a.id}`,
          }),
        ),
        ...counts.map((c) =>
          row({
            id: c.id,
            kind: 'CYCLE_COUNT',
            number: c.number,
            status: c.status,
            context: null,
            action: c.status === 'REVIEW' ? 'CYCLE_COUNT.POST' : 'CYCLE_COUNT.COUNT',
            responsible: 'WAREHOUSE',
            canAct: s.has(
              c.status === 'REVIEW' ? 'warehouse.counts.approve' : 'warehouse.counts.create',
            ),
            date: day(c.countDate),
            dateKind: 'COUNT',
            overdue: c.status !== 'REVIEW' && isOverdue(day(c.countDate), s.today),
            link: `/core/warehouse/counts/${c.id}`,
          }),
        ),
        ...transfers.map((t) =>
          row({
            id: t.id,
            kind: 'INVENTORY_TRANSFER',
            number: t.number,
            status: 'DRAFT',
            context: null,
            action: 'INVENTORY_TRANSFER.POST',
            responsible: 'WAREHOUSE',
            canAct: s.has('warehouse.transfers.approve'),
            date: day(t.transferDate),
            dateKind: 'TRANSFER',
            link: `/core/warehouse/transfers/${t.id}`,
          }),
        ),
      );
    }

    // Production handoffs (read-only for Warehouse; quantities stay on their own screens).
    if (s.has('warehouse.finished_goods.view')) {
      const fgDrafts = await this.db.productionGoodsReceipt.findMany({
        where: { ...base, status: 'DRAFT' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, number: true, createdAt: true },
        take: 500,
      });
      // Accepted output not yet fully received (EP38 rule: accepted − POSTED receipts > 0).
      const accepted = await this.db.productionOutputReport.findMany({
        where: {
          ...base,
          status: 'ACCEPTED',
          order: { status: { in: ['IN_PRODUCTION', 'PAUSED', 'COMPLETION_REVIEW'] } },
        },
        select: { id: true, acceptedQuantity: true },
        take: 500,
      });
      const received = await receivedByReport(
        this.db,
        accepted.map((r) => r.id),
      );
      const pendingOutput = accepted.filter((r) =>
        (r.acceptedQuantity ?? ZERO).gt(received.get(r.id) ?? ZERO),
      ).length;
      metrics.push(
        metric(
          'finishedGoodsToReceive',
          pendingOutput,
          'attention',
          '/core/warehouse/finished-goods',
        ),
        metric(
          'finishedGoodsDrafts',
          fgDrafts.length,
          'progress',
          '/core/warehouse/finished-goods',
        ),
      );
      items.push(
        ...fgDrafts.map((r) =>
          row({
            id: r.id,
            kind: 'FINISHED_GOODS_RECEIPT',
            number: r.number,
            status: 'DRAFT',
            context: null,
            action: 'FINISHED_GOODS_RECEIPT.POST',
            responsible: 'WAREHOUSE',
            canAct: s.has('warehouse.finished_goods.confirm'),
            date: day(r.createdAt),
            dateKind: 'CREATED',
            link: `/core/warehouse/finished-goods/${r.id}`,
          }),
        ),
      );
    }
    if (s.has('warehouse.material_issues.view')) {
      const posted = await this.db.productionMaterialIssue.count({
        where: { ...base, status: 'POSTED', postedAt: { gte: asDay(addDays(s.today, -6)) } },
      });
      metrics.push(
        metric('materialIssuesRecent', posted, 'info', '/core/warehouse/material-issues'),
      );
    }

    items.sort((a, b) => Number(b.overdue) - Number(a.overdue));
    if (items.length || metrics.length)
      queues.push({ key: 'work', total: items.length, items: items.slice(0, QUEUE_LIMIT) });
    return { metrics, queues };
  }

  // ================================================================ OPERATIONS

  /**
   * Production (operations.orders.view). Order states come from the Production
   * service's own context (the canonical counts, incl. material readiness); rows carry
   * the order's item and its planned / outstanding OUTPUT — never a material quantity,
   * a BOM line or a ratio, so Production Staff without operations.recipes.view see
   * exactly what they may (EP46). Both manufacturing modes are counted the same way.
   */
  private async operations(s: Scope, ctx: AuthContext) {
    if (!s.has('operations.orders.view')) return { metrics: [], queues: [] };
    const approver = s.has('operations.orders.approve');
    const visible = {
      companyId: s.companyId,
      branchId: s.branchId,
      ...(approver
        ? {}
        : { OR: [{ status: { not: 'DRAFT' as const } }, { createdByMemberId: s.memberId }] }),
    };
    const since = asDay(addDays(s.today, -(RECENT_DAYS - 1)));
    const [c, orders, completed] = await Promise.all([
      this.production.context(ctx),
      this.db.productionOrder.findMany({
        where: {
          ...visible,
          status: {
            in: [
              'DRAFT',
              'SUBMITTED',
              'APPROVED',
              'READY',
              'IN_PRODUCTION',
              'PAUSED',
              'COMPLETION_REVIEW',
            ],
          },
        },
        orderBy: [{ requiredDate: { sort: 'asc', nulls: 'last' } }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          status: true,
          itemName: true,
          unitCode: true,
          quantity: true,
          requiredDate: true,
          createdByMemberId: true,
        },
        take: 500,
      }),
      this.db.productionOrder.count({
        where: { ...visible, status: 'COMPLETED', completedAt: { gte: since } },
      }),
    ]);
    const accepted = await this.db.productionOutputReport.groupBy({
      by: ['productionOrderId'],
      where: { productionOrderId: { in: orders.map((o) => o.id) }, status: 'ACCEPTED' },
      _sum: { acceptedQuantity: true },
    });
    const done = new Map(accepted.map((a) => [a.productionOrderId, a._sum.acceptedQuantity]));
    const k = c.counts;
    const list = '/core/production/orders';
    const ACT: Record<string, [string, PermissionCode]> = {
      DRAFT: ['PRODUCTION_ORDER.SUBMIT', 'operations.orders.create'],
      SUBMITTED: ['PRODUCTION_ORDER.APPROVE', 'operations.orders.approve'],
      APPROVED: ['PRODUCTION_ORDER.RESERVE', 'operations.materials.manage'],
      READY: ['PRODUCTION_ORDER.START', 'operations.execution.manage'],
      IN_PRODUCTION: ['PRODUCTION_ORDER.OUTPUT', 'operations.output.create'],
      PAUSED: ['PRODUCTION_ORDER.RESUME', 'operations.execution.manage'],
      COMPLETION_REVIEW: ['PRODUCTION_ORDER.COMPLETE', 'operations.orders.update_status'],
    };
    const rank = [
      'PAUSED',
      'SUBMITTED',
      'COMPLETION_REVIEW',
      'APPROVED',
      'READY',
      'IN_PRODUCTION',
      'DRAFT',
    ];
    const work = orders
      .filter((o) => o.status !== 'DRAFT' || o.createdByMemberId === s.memberId)
      .map((o) => {
        const [action, perm] = ACT[o.status]!;
        const outstanding = Decimal.max(ZERO, o.quantity.minus(done.get(o.id) ?? ZERO));
        return row({
          id: o.id,
          kind: 'PRODUCTION_ORDER',
          number: o.number,
          status: o.status,
          context: o.itemName,
          action,
          responsible: 'OPERATIONS',
          canAct: s.has(perm),
          date: day(o.requiredDate),
          dateKind: 'REQUIRED',
          overdue: isOverdue(day(o.requiredDate), s.today),
          quantity: { value: outstanding.toString(), unit: o.unitCode },
          link: `/core/production/orders/${o.id}`,
        });
      })
      .sort(
        (a, b) =>
          Number(b.overdue) - Number(a.overdue) || rank.indexOf(a.status) - rank.indexOf(b.status),
      );

    return {
      metrics: [
        metric('myDrafts', k.myDrafts, 'info', list),
        metric('awaitingApproval', k.awaitingApproval, 'attention', list),
        metric('awaitingReservation', k.approved, 'attention', '/core/production/reservations'),
        metric('materialsShort', k.materialsShort, 'blocked', '/core/production/reservations'),
        metric('readyToStart', k.ready, 'progress', '/core/production/execution'),
        metric('issuesToPost', k.draftIssues, 'attention', '/core/production/issues'),
        metric('inProduction', k.inProduction, 'progress', '/core/production/execution'),
        metric('paused', k.paused, 'blocked', '/core/production/execution'),
        metric('outputToReview', k.outputToReview, 'attention', '/core/production/output'),
        metric('completionReview', k.inReview, 'attention', list),
        metric('overdue', work.filter((w) => w.overdue).length, 'blocked', list),
        metric('completedRecently', completed, 'done', list),
      ],
      queues: [{ key: 'work', total: work.length, items: work.slice(0, QUEUE_LIMIT) }],
    };
  }

  // ================================================================ ACCOUNTING

  /**
   * Accounting — CORE's limited scope: supplier deposits of issued purchase orders
   * (accounting.deposits.view). No ledger, receivable, tax or bank figure exists in CORE.
   */
  private async accounting(s: Scope) {
    const notes = ['ACCOUNTING_SCOPE'];
    if (!s.has('accounting.deposits.view')) return { metrics: [], queues: [], notes };
    const base = { companyId: s.companyId, branchId: s.branchId };
    const since = asDay(addDays(s.today, -29));
    const [pending, confirmed, waived] = await Promise.all([
      this.db.purchaseOrder.findMany({
        where: { ...base, status: 'WAITING_DEPOSIT', depositStatus: 'PENDING' },
        orderBy: [{ depositDueDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        select: {
          id: true,
          number: true,
          supplierName: true,
          depositDueDate: true,
          depositAmount: true,
          currency: true,
        },
        take: 500,
      }),
      this.db.purchaseOrder.count({
        where: { ...base, depositStatus: 'CONFIRMED', depositConfirmedAt: { gte: since } },
      }),
      this.db.purchaseOrder.count({
        where: { ...base, depositStatus: 'WAIVED', depositWaivedAt: { gte: since } },
      }),
    ]);
    const list = '/core/accounting/deposits';
    const items = pending.map((o) =>
      row({
        id: o.id,
        kind: 'SUPPLIER_DEPOSIT',
        number: o.number,
        status: 'PENDING',
        context: o.supplierName,
        action: 'SUPPLIER_DEPOSIT.CONFIRM',
        responsible: 'ACCOUNTING',
        canAct: s.has('accounting.deposits.confirm'),
        date: day(o.depositDueDate),
        dateKind: 'DEPOSIT_DUE',
        overdue: isOverdue(day(o.depositDueDate), s.today),
        amount: o.depositAmount
          ? { value: o.depositAmount.toFixed(2), currency: o.currency }
          : null,
        link: `/core/accounting/deposits/${o.id}`,
      }),
    );
    items.sort((a, b) => Number(b.overdue) - Number(a.overdue));
    return {
      notes,
      metrics: [
        metric('depositsPending', pending.length, 'attention', list),
        metric('depositsOverdue', items.filter((i) => i.overdue).length, 'blocked', list),
        metric('depositsConfirmed30', confirmed, 'done', list),
        metric('depositsWaived30', waived, 'info', list),
      ],
      queues: [{ key: 'deposits', total: items.length, items: items.slice(0, QUEUE_LIMIT) }],
    };
  }
}
