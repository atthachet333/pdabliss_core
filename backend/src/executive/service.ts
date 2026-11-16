import type { AuthContext } from '../auth/sessions.js';
import type { DepartmentCode } from '../billing/catalog.js';
import { allowedActiveBranches } from '../company/branch-access.js';
import { memberPermissions, requireCompanyAccess } from '../company/context.js';
import {
  receivingProgress,
  requestsToOrder,
  salesProgress,
  salesStage,
} from '../dashboards/facts.js';
import type { Db } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import type { PermissionCode } from '../permissions/catalog.js';
import { permissionDenied } from '../permissions/guard.js';
import { receivedByReport } from '../production/output.js';
import { ProductionOrderService } from '../production/service.js';
import { ZERO } from '../purchasing/money.js';
import { companyDay } from '../purchasing/service.js';
import { EXPIRING_SOON_DAYS } from '../warehouse/service.js';
import {
  OverviewView,
  TraceView,
  type MetricEntry,
  type Overview,
  type WorkClass,
  type WorkItemRow,
} from './view.js';

/*
 * EP48 — Executive Command Center (docs/EP48_EXECUTIVE_REQUIREMENTS.md, …_METRIC_DICTIONARY.md,
 * …_BOTTLENECK_RULES.md). READ-ONLY: nothing here writes, reserves, posts or moves anything,
 * and nothing is stored or cached.
 *
 * Access (server-side, every request): the Company Owner or the Executive role, holding
 * `executive.overview.view` (so a disabled Executive department or a DENY exception closes it).
 * Ordinary Managers / Staff / Viewers — including a member assigned to the Executive
 * department — and the System Admin are refused (403). Each department's information
 * additionally needs that department's read permission (Owner: all; Executive: READ in every
 * enabled department) — otherwise it is left out entirely.
 *
 * Scope: the session's company (never from the request); the branches the person may work
 * in (EP26), all of them or one chosen with `?branch=<id>` — any other id is 404 (another
 * company's, inactive, not permitted or invented: the same answer, no oracle).
 *
 * The WORK-ITEM model: every open document becomes exactly ONE item in exactly ONE current
 * stage, with the department whose document it is, the department that acts next, a
 * classification (BLOCKED by a canonical condition / OVERDUE against the document's own date /
 * MISSING_DATE where lateness cannot be judged / WAITING) and the evidence. The pulse, the
 * department health, the bottlenecks, the priority queue and the branch comparison are all
 * views of that one list — so no document is counted twice. Stages come from the canonical
 * statuses and the shared aggregates (dashboards/facts.ts); there is no second state machine.
 * No money, quantity, recipe line or ratio is read into an item.
 */

const DAY_MS = 86_400_000;
export const RECENT_DAYS = 7;
export const BOTTLENECK_ITEMS = 5;
export const QUEUE_ITEMS = 25;
export const ACTIVITY_ITEMS = 20;
/** Per-document-type bound; reaching it marks the answer TRUNCATED (numbers are lower bounds). */
const BOUND = 5000;

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const asDay = (v: string) => new Date(`${v}T00:00:00Z`);
const addDays = (v: string, n: number) => day(new Date(asDay(v).getTime() + n * DAY_MS))!;
const daysBetween = (from: string, to: string) =>
  Math.round((asDay(to).getTime() - asDay(from).getTime()) / DAY_MS);

const notFound = () => new AppError(404, 'NOT_FOUND', 'Not found.');

type Branch = { id: string; code: string; name: string };
type Has = (code: PermissionCode) => boolean;

interface Scope {
  companyId: string;
  companyName: string;
  role: 'COMPANY_OWNER' | 'EXECUTIVE';
  allowed: Branch[];
  /** The branches this answer covers (all allowed, or the one chosen). */
  branches: Branch[];
  selected: string;
  today: string;
  has: Has;
}

/** The departments this person may see here, and what each needs. */
const SEES: Record<Exclude<DepartmentCode, 'EXECUTIVE'>, PermissionCode[]> = {
  SALES: ['sales.orders.view'],
  PURCHASING: ['purchasing.requests.view', 'purchasing.orders.view'],
  WAREHOUSE: ['warehouse.receiving.view', 'warehouse.inventory.view'],
  OPERATIONS: ['operations.orders.view'],
  ACCOUNTING: ['accounting.deposits.view'],
};
const DEPTS = Object.keys(SEES) as (keyof typeof SEES)[];

/** Cross-department flows (EP48 bottleneck rules §2): stages that belong to each handoff. */
export const FLOWS: { key: string; from: DepartmentCode; to: DepartmentCode; stages: string[] }[] =
  [
    {
      key: 'SALES_TO_WAREHOUSE',
      from: 'SALES',
      to: 'WAREHOUSE',
      stages: [
        'SO_AWAITING_ALLOCATION',
        'SO_AWAITING_PICK',
        'SO_AWAITING_DISPATCH',
        'SO_IN_DELIVERY',
        'SO_DELIVERY_EXCEPTION',
      ],
    },
    {
      key: 'PURCHASING_TO_WAREHOUSE',
      from: 'PURCHASING',
      to: 'WAREHOUSE',
      stages: ['PO_AWAITING_RECEIPT', 'PO_PARTIALLY_RECEIVED', 'GR_TO_POST'],
    },
    {
      key: 'PRODUCTION_TO_WAREHOUSE',
      from: 'OPERATIONS',
      to: 'WAREHOUSE',
      stages: ['MO_AWAITING_RESERVATION', 'MO_AWAITING_ISSUE', 'MO_FG_TO_RECEIVE'],
    },
    {
      key: 'PURCHASING_TO_PRODUCTION',
      from: 'PURCHASING',
      to: 'OPERATIONS',
      stages: ['MO_MATERIALS_SHORT'],
    },
    {
      key: 'ACCOUNTING_TO_PURCHASING',
      from: 'ACCOUNTING',
      to: 'PURCHASING',
      stages: ['PO_AWAITING_DEPOSIT'],
    },
  ];

const CLASS_RANK: Record<WorkClass, number> = {
  BLOCKED: 0,
  OVERDUE: 1,
  MISSING_DATE: 2,
  WAITING: 3,
};
const BLOCK_RANK = ['DELIVERY_EXCEPTION', 'PRODUCTION_SHORTAGE', 'PRODUCTION_PAUSED'];

/** Deterministic order: class, blocking reason, days overdue, age, number, id. */
export const byPriority = (a: WorkItemRow, b: WorkItemRow) =>
  CLASS_RANK[a.class] - CLASS_RANK[b.class] ||
  (a.class === 'BLOCKED' ? BLOCK_RANK.indexOf(a.reason!) - BLOCK_RANK.indexOf(b.reason!) : 0) ||
  (b.overdueDays ?? 0) - (a.overdueDays ?? 0) ||
  (b.ageDays ?? -1) - (a.ageDays ?? -1) ||
  a.number.localeCompare(b.number) ||
  a.id.localeCompare(b.id);

/** Queue order: blocked, then overdue, then stock discrepancies awaiting resolution. */
const queueTier = (i: WorkItemRow) => (i.class === 'BLOCKED' ? 0 : i.class === 'OVERDUE' ? 1 : 2);
export const byQueue = (a: WorkItemRow, b: WorkItemRow) =>
  queueTier(a) - queueTier(b) || byPriority(a, b);

interface Collected {
  items: WorkItemRow[];
  /** Per branch: counts that are not work items (completed, lines, lots, attributes). */
  extra: Map<string, Record<string, number>>;
  truncated: boolean;
}

export class ExecutiveService {
  private readonly production: ProductionOrderService;

  constructor(private readonly db: Db) {
    this.production = new ProductionOrderService(db);
  }

  // ------------------------------------------------------------------ access

  private async scope(ctx: AuthContext, branch?: string): Promise<Scope> {
    const access = await requireCompanyAccess(this.db, ctx);
    const { permissions } = await memberPermissions(this.db, access);
    const role = access.member.role;
    if (
      (role !== 'COMPANY_OWNER' && role !== 'EXECUTIVE') ||
      !permissions.includes('executive.overview.view')
    )
      throw permissionDenied('executive.overview.view');
    const allowed = (await allowedActiveBranches(this.db, access.member)).map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
    }));
    if (!allowed.length)
      throw new AppError(403, 'NO_BRANCH_ACCESS', 'No active branch is open to you.');
    let branches = allowed;
    if (branch && branch !== 'all') {
      const one = allowed.find((b) => b.id === branch);
      if (!one) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found.');
      branches = [one];
    }
    return {
      companyId: access.company.id,
      companyName: access.company.name,
      role,
      allowed,
      branches,
      selected: branches.length === 1 && branch && branch !== 'all' ? branches[0]!.id : 'all',
      today: companyDay(access.company.timezone),
      has: (c) => permissions.includes(c),
    };
  }

  private visible(s: Scope) {
    return DEPTS.filter((d) => SEES[d].some((c) => s.has(c)));
  }

  // ------------------------------------------------------------------ the work items

  /**
   * The work items of the scope. `only` (the document trace) limits the work to one document
   * kind — the same rules, fewer queries; the overview always collects everything.
   */
  private async collect(s: Scope, ctx: AuthContext, only?: string): Promise<Collected> {
    const want = (kind: string) => !only || only === kind;
    const ids = s.branches.map((b) => b.id);
    const ref = new Map(s.branches.map((b) => [b.id, b]));
    const base = { companyId: s.companyId, branchId: { in: ids } };
    const since = asDay(addDays(s.today, -(RECENT_DAYS - 1)));
    const items: WorkItemRow[] = [];
    const extra = new Map<string, Record<string, number>>(ids.map((id) => [id, {}]));
    let truncated = false;
    const bump = (branchId: string, key: string, n = 1) => {
      const e = extra.get(branchId);
      if (e) e[key] = (e[key] ?? 0) + n;
    };
    const watch = <T>(rows: T[]) => {
      if (rows.length >= BOUND) truncated = true;
      return rows;
    };
    const push = (
      x: Omit<WorkItemRow, 'class' | 'reason' | 'overdueDays' | 'ageDays' | 'branch' | 'since'> & {
        branchId: string;
        since: Date | null;
        blocked?: string;
        requireDate?: boolean;
        discrepancy?: boolean;
        overdueReason: string;
      },
    ) => {
      const { branchId, blocked, requireDate, discrepancy, overdueReason, since: at, ...rest } = x;
      const overdueDays = x.date && x.date < s.today ? daysBetween(x.date, s.today) : null;
      const cls: WorkClass = blocked
        ? 'BLOCKED'
        : overdueDays !== null
          ? 'OVERDUE'
          : requireDate && !x.date
            ? 'MISSING_DATE'
            : 'WAITING';
      const sinceDay = day(at);
      items.push({
        ...rest,
        branch: ref.get(branchId)!,
        class: cls,
        reason:
          blocked ??
          (overdueDays !== null ? overdueReason : discrepancy ? 'STOCK_DISCREPANCY' : null),
        overdueDays,
        since: sinceDay,
        ageDays: sinceDay ? Math.max(0, daysBetween(sinceDay, s.today)) : null,
      });
    };
    const link = (perm: PermissionCode, path: string) => (s.has(perm) ? path : null);
    const tasks: Promise<void>[] = [];

    // ---- Sales (sales.orders.view): one stage per order
    if (s.has('sales.orders.view') && want('SALES_ORDER'))
      tasks.push(
        (async () => {
          const [submitted, progress] = await Promise.all([
            this.db.salesOrder.findMany({
              where: { ...base, status: 'SUBMITTED' },
              select: {
                id: true,
                branchId: true,
                number: true,
                customerName: true,
                requestedDate: true,
                submittedAt: true,
              },
              take: BOUND,
            }),
            salesProgress(this.db, s.companyId, ids, since),
          ]);
          watch(submitted);
          watch(progress);
          const so = (id: string) => link('sales.orders.view', `/core/sales/orders/${id}`);
          for (const o of submitted)
            push({
              kind: 'SALES_ORDER',
              id: o.id,
              number: o.number,
              context: o.customerName,
              branchId: o.branchId,
              department: 'SALES',
              next: 'SALES',
              stage: 'SO_AWAITING_CONFIRMATION',
              evidence: { code: 'AWAITING_CONFIRMATION' },
              date: day(o.requestedDate),
              dateKind: 'REQUESTED',
              since: o.submittedAt,
              overdueReason: 'OVERDUE_DELIVERY',
              link: so(o.id),
            });
          for (const o of progress) {
            const st = salesStage(o);
            if (st === 'COMPLETED') {
              if (o.lastDelivered && o.lastDelivered >= since) bump(o.branchId, 'SO_DELIVERED');
              continue;
            }
            if (o.someDelivered) bump(o.branchId, 'SO_PARTIALLY_DELIVERED');
            bump(o.branchId, 'SO_LINES_TO_DELIVER', o.undelivered);
            const map = {
              EXCEPTION: [
                'SO_DELIVERY_EXCEPTION',
                'WAREHOUSE',
                { code: 'DELIVERY_EXCEPTION_OPEN' },
              ],
              ALLOCATION: [
                'SO_AWAITING_ALLOCATION',
                'SALES',
                { code: 'LINES_NOT_RESERVED', open: o.unallocated, total: o.lines },
              ],
              PICK: [
                'SO_AWAITING_PICK',
                'WAREHOUSE',
                { code: 'LINES_NOT_PICKED', open: o.unpicked, total: o.lines },
              ],
              DISPATCH: [
                'SO_AWAITING_DISPATCH',
                'WAREHOUSE',
                { code: 'LINES_NOT_DISPATCHED', open: o.undispatched, total: o.lines },
              ],
              DELIVERY: [
                'SO_IN_DELIVERY',
                'WAREHOUSE',
                { code: 'LINES_NOT_DELIVERED', open: o.undelivered, total: o.lines },
              ],
            } as const;
            const [stage, next, evidence] = map[st];
            push({
              kind: 'SALES_ORDER',
              id: o.id,
              number: o.number,
              context: o.customerName,
              branchId: o.branchId,
              department: 'SALES',
              next,
              stage,
              evidence: { ...evidence },
              date: day(o.requestedDate),
              dateKind: 'REQUESTED',
              since: st === 'DELIVERY' || st === 'EXCEPTION' ? o.lastDispatched : o.confirmedAt,
              blocked: st === 'EXCEPTION' ? 'DELIVERY_EXCEPTION' : undefined,
              overdueReason: 'OVERDUE_DELIVERY',
              link: so(o.id),
            });
          }
        })(),
      );

    // ---- Purchase requests (purchasing.requests.view); the originating department owns them
    if (s.has('purchasing.requests.view') && want('PURCHASE_REQUEST'))
      tasks.push(
        (async () => {
          const [submitted, open] = await Promise.all([
            this.db.purchaseRequest.findMany({
              where: { ...base, status: 'SUBMITTED' },
              select: {
                id: true,
                branchId: true,
                number: true,
                department: true,
                needByDate: true,
                submittedAt: true,
              },
              take: BOUND,
            }),
            requestsToOrder(this.db, s.companyId, ids),
          ]);
          watch(submitted);
          watch(open);
          const pr = (id: string) =>
            link('purchasing.requests.view', `/core/purchasing/requests/${id}`);
          for (const r of submitted)
            push({
              kind: 'PURCHASE_REQUEST',
              id: r.id,
              number: r.number,
              context: r.department,
              branchId: r.branchId,
              department: r.department,
              next: 'PURCHASING',
              stage: 'PR_AWAITING_DECISION',
              evidence: { code: 'AWAITING_DECISION' },
              date: day(r.needByDate),
              dateKind: 'NEEDED_BY',
              since: r.submittedAt,
              overdueReason: 'OVERDUE_REQUEST',
              link: pr(r.id),
            });
          for (const r of open)
            push({
              kind: 'PURCHASE_REQUEST',
              id: r.id,
              number: r.number,
              context: r.department,
              branchId: r.branchId,
              department: r.department,
              next: 'PURCHASING',
              stage: 'PR_AWAITING_ORDER',
              evidence: { code: 'LINES_NOT_ORDERED', open: r.open, total: r.lines },
              date: day(r.needByDate),
              dateKind: 'NEEDED_BY',
              since: r.approvedAt,
              overdueReason: 'OVERDUE_REQUEST',
              link: pr(r.id),
            });
        })(),
      );

    // ---- Purchase orders: deposit (→ Accounting) and receiving (→ Warehouse)
    const poView = s.has('purchasing.orders.view');
    const poLink = (id: string, alt: string | null) =>
      poView ? `/core/purchasing/orders/${id}` : alt;
    if ((poView || s.has('accounting.deposits.view')) && want('PURCHASE_ORDER'))
      tasks.push(
        (async () => {
          const [waiting, received] = await Promise.all([
            this.db.purchaseOrder.findMany({
              where: { ...base, status: 'WAITING_DEPOSIT', depositStatus: 'PENDING' },
              select: {
                id: true,
                branchId: true,
                number: true,
                supplierName: true,
                depositDueDate: true,
                issuedAt: true,
              },
              take: BOUND,
            }),
            this.db.purchaseOrder.groupBy({
              by: ['branchId'],
              where: { ...base, status: 'RECEIVED', receivedAt: { gte: since } },
              _count: { _all: true },
            }),
          ]);
          watch(waiting);
          for (const r of received) bump(r.branchId, 'PO_RECEIVED', r._count._all);
          for (const o of waiting)
            push({
              kind: 'PURCHASE_ORDER',
              id: o.id,
              number: o.number,
              context: o.supplierName,
              branchId: o.branchId,
              department: 'PURCHASING',
              next: 'ACCOUNTING',
              stage: 'PO_AWAITING_DEPOSIT',
              evidence: { code: 'DEPOSIT_PENDING' },
              date: day(o.depositDueDate),
              dateKind: 'DEPOSIT_DUE',
              since: o.issuedAt,
              overdueReason: 'OVERDUE_DEPOSIT',
              link: poLink(
                o.id,
                link('accounting.deposits.view', `/core/accounting/deposits/${o.id}`),
              ),
            });
        })(),
      );
    if ((poView || s.has('warehouse.receiving.view')) && want('PURCHASE_ORDER'))
      tasks.push(
        (async () => {
          const rows = watch(await receivingProgress(this.db, s.companyId, ids));
          for (const o of rows) {
            bump(o.branchId, 'PO_LINES_TO_RECEIVE', o.open);
            const partial = o.someReceived && o.open > 0;
            push({
              kind: 'PURCHASE_ORDER',
              id: o.id,
              number: o.number,
              context: o.supplierName,
              branchId: o.branchId,
              department: 'PURCHASING',
              next: 'WAREHOUSE',
              stage: partial ? 'PO_PARTIALLY_RECEIVED' : 'PO_AWAITING_RECEIPT',
              evidence: { code: 'LINES_NOT_RECEIVED', open: o.open, total: o.lines },
              date: day(o.expectedDate),
              dateKind: 'EXPECTED',
              since: o.pendingReceiveAt,
              requireDate: true,
              overdueReason: 'OVERDUE_RECEIPT',
              link: poLink(
                o.id,
                link('warehouse.receiving.view', `/core/warehouse/pending-receive/${o.id}`),
              ),
            });
          }
        })(),
      );

    // ---- Warehouse documents (receiving / inventory control)
    if (s.has('warehouse.receiving.view') && want('GOODS_RECEIPT'))
      tasks.push(
        (async () => {
          const [drafts, posted] = await Promise.all([
            this.db.goodsReceipt.findMany({
              where: { ...base, status: 'DRAFT' },
              select: {
                id: true,
                branchId: true,
                number: true,
                supplierName: true,
                createdAt: true,
              },
              take: BOUND,
            }),
            this.db.goodsReceipt.groupBy({
              by: ['branchId'],
              where: { ...base, status: 'POSTED', postedAt: { gte: since } },
              _count: { _all: true },
            }),
          ]);
          watch(drafts);
          for (const r of posted) bump(r.branchId, 'GR_POSTED', r._count._all);
          for (const r of drafts)
            push({
              kind: 'GOODS_RECEIPT',
              id: r.id,
              number: r.number,
              context: r.supplierName,
              branchId: r.branchId,
              department: 'WAREHOUSE',
              next: 'WAREHOUSE',
              stage: 'GR_TO_POST',
              evidence: { code: 'RECEIPT_DRAFT' },
              date: null,
              dateKind: null,
              since: r.createdAt,
              overdueReason: 'OVERDUE_RECEIPT',
              link: `/core/warehouse/receipts/${r.id}`,
            });
        })(),
      );
    if (s.has('warehouse.inventory.view') && want('INVENTORY'))
      tasks.push(
        (async () => {
          const soon = asDay(addDays(s.today, EXPIRING_SOON_DAYS));
          const todayDate = asDay(s.today);
          const [adjustments, counts, transfers, lots, adjPosted, countPosted] = await Promise.all([
            this.db.stockAdjustment.findMany({
              where: { ...base, status: 'SUBMITTED' },
              select: {
                id: true,
                branchId: true,
                number: true,
                reason: true,
                adjustmentDate: true,
                submittedAt: true,
              },
              take: BOUND,
            }),
            this.db.cycleCount.findMany({
              where: { ...base, status: { in: ['DRAFT', 'COUNTING', 'REVIEW'] } },
              select: {
                id: true,
                branchId: true,
                number: true,
                status: true,
                countDate: true,
                createdAt: true,
                startedAt: true,
                reviewAt: true,
              },
              take: BOUND,
            }),
            this.db.inventoryTransfer.findMany({
              where: { ...base, status: 'DRAFT' },
              select: {
                id: true,
                branchId: true,
                number: true,
                transferDate: true,
                createdAt: true,
              },
              take: BOUND,
            }),
            this.db.$queryRaw<{ branchId: string; expiring: number; expired: number }[]>`
              SELECT b."branchId",
                COUNT(DISTINCT b."lotId") FILTER (WHERE l."expiryDate" >= ${todayDate} AND l."expiryDate" <= ${soon})::int AS "expiring",
                COUNT(DISTINCT b."lotId") FILTER (WHERE l."expiryDate" < ${todayDate})::int AS "expired"
              FROM "StockBalance" b JOIN "InventoryLot" l ON l."id" = b."lotId"
              WHERE b."companyId" = ${s.companyId} AND b."branchId" = ANY(${ids}::text[])
                AND b."quantityOnHand" > 0
              GROUP BY b."branchId"
            `,
            this.db.stockAdjustment.groupBy({
              by: ['branchId'],
              where: { ...base, status: 'POSTED', approvedAt: { gte: since } },
              _count: { _all: true },
            }),
            this.db.cycleCount.groupBy({
              by: ['branchId'],
              where: { ...base, status: 'POSTED', postedAt: { gte: since } },
              _count: { _all: true },
            }),
          ]);
          watch(adjustments);
          watch(counts);
          watch(transfers);
          for (const r of lots) {
            bump(r.branchId, 'LOTS_EXPIRING', r.expiring);
            bump(r.branchId, 'LOTS_EXPIRED', r.expired);
          }
          for (const r of adjPosted) bump(r.branchId, 'ADJ_POSTED', r._count._all);
          for (const r of countPosted) bump(r.branchId, 'COUNT_POSTED', r._count._all);
          for (const a of adjustments)
            push({
              kind: 'STOCK_ADJUSTMENT',
              id: a.id,
              number: a.number,
              context: a.reason,
              branchId: a.branchId,
              department: 'WAREHOUSE',
              next: 'WAREHOUSE',
              stage: 'ADJ_TO_APPROVE',
              evidence: { code: 'ADJUSTMENT_SUBMITTED' },
              date: null,
              dateKind: null,
              since: a.submittedAt,
              discrepancy: true,
              overdueReason: 'OVERDUE_COUNT',
              link: `/core/warehouse/adjustments/${a.id}`,
            });
          for (const c of counts) {
            const review = c.status === 'REVIEW';
            push({
              kind: 'CYCLE_COUNT',
              id: c.id,
              number: c.number,
              context: null,
              branchId: c.branchId,
              department: 'WAREHOUSE',
              next: 'WAREHOUSE',
              stage: review ? 'COUNT_IN_REVIEW' : 'COUNT_OPEN',
              evidence: { code: review ? 'COUNT_IN_REVIEW' : 'COUNT_OPEN' },
              // A count under review is judged by its review, not its planned date.
              date: review ? null : day(c.countDate),
              dateKind: review ? null : 'COUNT',
              since: review ? c.reviewAt : (c.startedAt ?? c.createdAt),
              discrepancy: review,
              overdueReason: 'OVERDUE_COUNT',
              link: `/core/warehouse/counts/${c.id}`,
            });
          }
          for (const t of transfers)
            push({
              kind: 'INVENTORY_TRANSFER',
              id: t.id,
              number: t.number,
              context: null,
              branchId: t.branchId,
              department: 'WAREHOUSE',
              next: 'WAREHOUSE',
              stage: 'TRANSFER_TO_POST',
              evidence: { code: 'TRANSFER_DRAFT' },
              date: null,
              dateKind: null,
              since: t.createdAt,
              overdueReason: 'OVERDUE_COUNT',
              link: `/core/warehouse/transfers/${t.id}`,
            });
        })(),
      );

    // ---- Production (operations.orders.view): one stage per order; never a quantity
    if (s.has('operations.orders.view') && want('PRODUCTION_ORDER'))
      tasks.push(
        (async () => {
          const orders = watch(
            await this.db.productionOrder.findMany({
              where: {
                ...base,
                status: {
                  in: [
                    'SUBMITTED',
                    'APPROVED',
                    'READY',
                    'IN_PRODUCTION',
                    'PAUSED',
                    'COMPLETION_REVIEW',
                  ],
                },
              },
              select: {
                id: true,
                branchId: true,
                number: true,
                status: true,
                itemName: true,
                requiredDate: true,
                submittedAt: true,
                approvedAt: true,
                releasedAt: true,
                startedAt: true,
                pausedAt: true,
                reviewRequestedAt: true,
              },
              take: BOUND,
            }),
          );
          const moIds = orders.map((o) => o.id);
          const [reserved, submittedOut, accepted, completed, shortages] = await Promise.all([
            this.db.productionMaterialAllocation.groupBy({
              by: ['productionOrderId'],
              where: { productionOrderId: { in: moIds }, status: 'ACTIVE' },
              _count: { _all: true },
            }),
            this.db.productionOutputReport.groupBy({
              by: ['productionOrderId'],
              where: { productionOrderId: { in: moIds }, status: 'SUBMITTED' },
              _count: { _all: true },
            }),
            this.db.productionOutputReport.findMany({
              where: {
                productionOrderId: { in: moIds },
                status: 'ACCEPTED',
                order: { status: { in: ['IN_PRODUCTION', 'PAUSED', 'COMPLETION_REVIEW'] } },
              },
              select: { id: true, productionOrderId: true, acceptedQuantity: true },
            }),
            this.db.productionOrder.groupBy({
              by: ['branchId'],
              where: { ...base, status: 'COMPLETED', completedAt: { gte: since } },
              _count: { _all: true },
            }),
            // EP36/EP46 handoff: which approved orders lack materials now (the count only).
            s.has('purchasing.production_shortages.view')
              ? this.production.shortages(ctx, {}).then((r) => r.items)
              : Promise.resolve([]),
          ]);
          for (const r of completed) bump(r.branchId, 'MO_COMPLETED', r._count._all);
          const got = await receivedByReport(
            this.db,
            accepted.map((a) => a.id),
          );
          const fg = new Map<string, number>();
          for (const a of accepted)
            if ((a.acceptedQuantity ?? ZERO).gt(got.get(a.id) ?? ZERO))
              fg.set(a.productionOrderId, (fg.get(a.productionOrderId) ?? 0) + 1);
          const res = new Map(reserved.map((r) => [r.productionOrderId, r._count._all]));
          const out = new Map(submittedOut.map((r) => [r.productionOrderId, r._count._all]));
          const short = new Map<string, number>();
          for (const r of shortages) short.set(r.order.id, (short.get(r.order.id) ?? 0) + 1);
          for (const o of orders) {
            let stage: string;
            let next: DepartmentCode = 'OPERATIONS';
            let evidence: WorkItemRow['evidence'];
            let at: Date | null;
            let blocked: string | undefined;
            const fgPending = fg.get(o.id) ?? 0;
            if (o.status === 'SUBMITTED') {
              [stage, evidence, at] = [
                'MO_AWAITING_APPROVAL',
                { code: 'MO_SUBMITTED' },
                o.submittedAt,
              ];
            } else if (o.status === 'APPROVED') {
              at = o.approvedAt;
              const n = short.get(o.id) ?? 0;
              if (n > 0) {
                [stage, next, blocked] = [
                  'MO_MATERIALS_SHORT',
                  'PURCHASING',
                  'PRODUCTION_SHORTAGE',
                ];
                evidence = { code: 'MATERIALS_SHORT', count: n };
              } else
                [stage, evidence] = ['MO_AWAITING_RESERVATION', { code: 'AWAITING_RESERVATION' }];
            } else if (o.status === 'READY') {
              [stage, evidence, at] = [
                'MO_READY_TO_START',
                { code: 'RELEASED_NOT_STARTED' },
                o.releasedAt,
              ];
            } else if (o.status === 'PAUSED') {
              [stage, evidence, at, blocked] = [
                'MO_PAUSED',
                { code: 'PAUSED' },
                o.pausedAt,
                'PRODUCTION_PAUSED',
              ];
            } else if (fgPending > 0) {
              [stage, next, at] = [
                'MO_FG_TO_RECEIVE',
                'WAREHOUSE',
                o.reviewRequestedAt ?? o.startedAt,
              ];
              evidence = { code: 'OUTPUT_NOT_RECEIVED', count: fgPending };
            } else if (o.status === 'COMPLETION_REVIEW') {
              [stage, evidence, at] = [
                'MO_COMPLETION_REVIEW',
                { code: 'COMPLETION_REVIEW' },
                o.reviewRequestedAt,
              ];
            } else if ((out.get(o.id) ?? 0) > 0) {
              [stage, at] = ['MO_OUTPUT_TO_REVIEW', o.startedAt];
              evidence = { code: 'OUTPUT_SUBMITTED', count: out.get(o.id)! };
            } else if ((res.get(o.id) ?? 0) > 0) {
              [stage, at] = ['MO_AWAITING_ISSUE', o.startedAt];
              evidence = { code: 'RESERVED_NOT_ISSUED', count: res.get(o.id)! };
            } else
              [stage, evidence, at] = ['MO_IN_PRODUCTION', { code: 'IN_PRODUCTION' }, o.startedAt];
            push({
              kind: 'PRODUCTION_ORDER',
              id: o.id,
              number: o.number,
              context: o.itemName,
              branchId: o.branchId,
              department: 'OPERATIONS',
              next,
              stage,
              evidence,
              date: day(o.requiredDate),
              dateKind: 'REQUIRED',
              since: at,
              blocked,
              requireDate: o.status !== 'SUBMITTED',
              overdueReason: 'OVERDUE_PRODUCTION',
              link: `/core/production/orders/${o.id}`,
            });
          }
        })(),
      );

    // ---- Accounting: deposits confirmed / waived recently (the pending ones are PO items)
    if (s.has('accounting.deposits.view') && want('DEPOSIT'))
      tasks.push(
        (async () => {
          const [confirmed, waived] = await Promise.all([
            this.db.purchaseOrder.groupBy({
              by: ['branchId'],
              where: { ...base, depositStatus: 'CONFIRMED', depositConfirmedAt: { gte: since } },
              _count: { _all: true },
            }),
            this.db.purchaseOrder.groupBy({
              by: ['branchId'],
              where: { ...base, depositStatus: 'WAIVED', depositWaivedAt: { gte: since } },
              _count: { _all: true },
            }),
          ]);
          for (const r of confirmed) bump(r.branchId, 'DEPOSIT_CONFIRMED', r._count._all);
          for (const r of waived) bump(r.branchId, 'DEPOSIT_WAIVED', r._count._all);
        })(),
      );

    await Promise.all(tasks);
    items.sort(byPriority);
    return { items, extra, truncated };
  }

  // ------------------------------------------------------------------ the overview

  async overview(ctx: AuthContext, q: { branch?: string }) {
    const s = await this.scope(ctx, q.branch);
    const visible = this.visible(s);
    const { items, extra, truncated } = await this.collect(s, ctx);

    const countIf = (list: WorkItemRow[], f: (i: WorkItemRow) => boolean) => list.filter(f).length;
    const stageCount = (list: WorkItemRow[], ...stages: string[]) =>
      countIf(list, (i) => stages.includes(i.stage));
    const sumExtra = (branchIds: string[], key: string) =>
      branchIds.reduce((n, id) => n + (extra.get(id)?.[key] ?? 0), 0);
    const allIds = s.branches.map((b) => b.id);
    const dash = (d: string) => `/core/dashboards/${d.toLowerCase()}`;

    // ---- metric definitions (per a set of items + branches) — EP48 metric dictionary
    type Def = Omit<MetricEntry, 'value'> & {
      calc: (list: WorkItemRow[], branchIds: string[]) => number;
    };
    const SO = (i: WorkItemRow) => i.kind === 'SALES_ORDER';
    const PO_RECEIVE = ['PO_AWAITING_RECEIPT', 'PO_PARTIALLY_RECEIVED'];
    const MO_ACTIVE = (i: WorkItemRow) =>
      i.kind === 'PRODUCTION_ORDER' && i.stage !== 'MO_AWAITING_APPROVAL';
    const DEFS: Record<(typeof DEPTS)[number], Def[]> = {
      SALES: [
        {
          key: 'openOrders',
          unit: 'DOCUMENTS',
          tone: 'info',
          link: dash('SALES'),
          calc: (l) => countIf(l, SO),
        },
        {
          key: 'awaitingConfirmation',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('SALES'),
          calc: (l) => stageCount(l, 'SO_AWAITING_CONFIRMATION'),
        },
        {
          key: 'awaitingAllocation',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('SALES'),
          calc: (l) => stageCount(l, 'SO_AWAITING_ALLOCATION'),
        },
        {
          key: 'awaitingPick',
          unit: 'DOCUMENTS',
          tone: 'progress',
          link: dash('SALES'),
          calc: (l) => stageCount(l, 'SO_AWAITING_PICK'),
        },
        {
          key: 'awaitingDispatch',
          unit: 'DOCUMENTS',
          tone: 'progress',
          link: dash('SALES'),
          calc: (l) => stageCount(l, 'SO_AWAITING_DISPATCH'),
        },
        {
          key: 'outstandingDeliveries',
          unit: 'DOCUMENTS',
          tone: 'progress',
          link: dash('SALES'),
          calc: (l) => stageCount(l, 'SO_IN_DELIVERY'),
        },
        {
          key: 'deliveryExceptions',
          unit: 'DOCUMENTS',
          tone: 'blocked',
          link: dash('SALES'),
          calc: (l) => stageCount(l, 'SO_DELIVERY_EXCEPTION'),
        },
        {
          key: 'overdue',
          unit: 'DOCUMENTS',
          tone: 'blocked',
          link: dash('SALES'),
          calc: (l) => countIf(l, (i) => SO(i) && i.class === 'OVERDUE'),
        },
        {
          key: 'partiallyDelivered',
          unit: 'DOCUMENTS',
          tone: 'info',
          link: dash('SALES'),
          calc: (_, b) => sumExtra(b, 'SO_PARTIALLY_DELIVERED'),
        },
        {
          key: 'linesToDeliver',
          unit: 'LINES',
          tone: 'info',
          link: dash('SALES'),
          calc: (_, b) => sumExtra(b, 'SO_LINES_TO_DELIVER'),
        },
        {
          key: 'deliveredRecently',
          unit: 'DOCUMENTS',
          tone: 'done',
          link: dash('SALES'),
          calc: (_, b) => sumExtra(b, 'SO_DELIVERED'),
        },
      ],
      PURCHASING: [
        {
          key: 'requestsAwaitingDecision',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('PURCHASING'),
          calc: (l) => stageCount(l, 'PR_AWAITING_DECISION'),
        },
        {
          key: 'requestsToOrder',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('PURCHASING'),
          calc: (l) => stageCount(l, 'PR_AWAITING_ORDER'),
        },
        {
          key: 'ordersAwaitingDeposit',
          unit: 'DOCUMENTS',
          tone: 'progress',
          link: dash('PURCHASING'),
          calc: (l) => stageCount(l, 'PO_AWAITING_DEPOSIT'),
        },
        {
          key: 'ordersAwaitingReceipt',
          unit: 'DOCUMENTS',
          tone: 'progress',
          link: dash('PURCHASING'),
          calc: (l) => stageCount(l, ...PO_RECEIVE),
        },
        {
          key: 'ordersPartiallyReceived',
          unit: 'DOCUMENTS',
          tone: 'progress',
          link: dash('PURCHASING'),
          calc: (l) => stageCount(l, 'PO_PARTIALLY_RECEIVED'),
        },
        {
          key: 'linesToReceive',
          unit: 'LINES',
          tone: 'info',
          link: dash('PURCHASING'),
          calc: (_, b) => sumExtra(b, 'PO_LINES_TO_RECEIVE'),
        },
        {
          key: 'overdueReceipts',
          unit: 'DOCUMENTS',
          tone: 'blocked',
          link: dash('PURCHASING'),
          calc: (l) => countIf(l, (i) => PO_RECEIVE.includes(i.stage) && i.class === 'OVERDUE'),
        },
        {
          key: 'receivedRecently',
          unit: 'DOCUMENTS',
          tone: 'done',
          link: dash('PURCHASING'),
          calc: (_, b) => sumExtra(b, 'PO_RECEIVED'),
        },
      ],
      WAREHOUSE: [
        {
          key: 'receiptsToPost',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('WAREHOUSE'),
          calc: (l) => stageCount(l, 'GR_TO_POST'),
        },
        {
          key: 'adjustmentsToApprove',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('WAREHOUSE'),
          calc: (l) => stageCount(l, 'ADJ_TO_APPROVE'),
        },
        {
          key: 'countsInReview',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('WAREHOUSE'),
          calc: (l) => stageCount(l, 'COUNT_IN_REVIEW'),
        },
        {
          key: 'countsOpen',
          unit: 'DOCUMENTS',
          tone: 'progress',
          link: dash('WAREHOUSE'),
          calc: (l) => stageCount(l, 'COUNT_OPEN'),
        },
        {
          key: 'transfersToPost',
          unit: 'DOCUMENTS',
          tone: 'progress',
          link: dash('WAREHOUSE'),
          calc: (l) => stageCount(l, 'TRANSFER_TO_POST'),
        },
        {
          key: 'lotsExpiringSoon',
          unit: 'LOTS',
          tone: 'attention',
          link: '/core/warehouse/lots',
          calc: (_, b) => sumExtra(b, 'LOTS_EXPIRING'),
        },
        {
          key: 'lotsExpired',
          unit: 'LOTS',
          tone: 'blocked',
          link: '/core/warehouse/lots',
          calc: (_, b) => sumExtra(b, 'LOTS_EXPIRED'),
        },
        {
          key: 'receiptsPostedRecently',
          unit: 'DOCUMENTS',
          tone: 'done',
          link: dash('WAREHOUSE'),
          calc: (_, b) => sumExtra(b, 'GR_POSTED'),
        },
      ],
      OPERATIONS: [
        {
          key: 'activeOrders',
          unit: 'DOCUMENTS',
          tone: 'info',
          link: dash('OPERATIONS'),
          calc: (l) => countIf(l, MO_ACTIVE),
        },
        {
          key: 'awaitingApproval',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('OPERATIONS'),
          calc: (l) => stageCount(l, 'MO_AWAITING_APPROVAL'),
        },
        {
          key: 'awaitingMaterials',
          unit: 'DOCUMENTS',
          tone: 'blocked',
          link: dash('OPERATIONS'),
          calc: (l) => stageCount(l, 'MO_MATERIALS_SHORT'),
        },
        {
          key: 'awaitingReservation',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('OPERATIONS'),
          calc: (l) => stageCount(l, 'MO_AWAITING_RESERVATION'),
        },
        {
          key: 'awaitingIssue',
          unit: 'DOCUMENTS',
          tone: 'progress',
          link: dash('OPERATIONS'),
          calc: (l) => stageCount(l, 'MO_AWAITING_ISSUE'),
        },
        {
          key: 'inProduction',
          unit: 'DOCUMENTS',
          tone: 'progress',
          link: dash('OPERATIONS'),
          calc: (l) =>
            stageCount(l, 'MO_READY_TO_START', 'MO_IN_PRODUCTION', 'MO_OUTPUT_TO_REVIEW'),
        },
        {
          key: 'paused',
          unit: 'DOCUMENTS',
          tone: 'blocked',
          link: dash('OPERATIONS'),
          calc: (l) => stageCount(l, 'MO_PAUSED'),
        },
        {
          key: 'finishedGoodsBacklog',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('OPERATIONS'),
          calc: (l) => stageCount(l, 'MO_FG_TO_RECEIVE', 'MO_COMPLETION_REVIEW'),
        },
        {
          key: 'overdue',
          unit: 'DOCUMENTS',
          tone: 'blocked',
          link: dash('OPERATIONS'),
          calc: (l) => countIf(l, (i) => i.kind === 'PRODUCTION_ORDER' && i.class === 'OVERDUE'),
        },
        {
          key: 'completedRecently',
          unit: 'DOCUMENTS',
          tone: 'done',
          link: dash('OPERATIONS'),
          calc: (_, b) => sumExtra(b, 'MO_COMPLETED'),
        },
      ],
      ACCOUNTING: [
        {
          key: 'depositsPending',
          unit: 'DOCUMENTS',
          tone: 'attention',
          link: dash('ACCOUNTING'),
          calc: (l) => stageCount(l, 'PO_AWAITING_DEPOSIT'),
        },
        {
          key: 'depositsOverdue',
          unit: 'DOCUMENTS',
          tone: 'blocked',
          link: dash('ACCOUNTING'),
          calc: (l) =>
            countIf(l, (i) => i.stage === 'PO_AWAITING_DEPOSIT' && i.class === 'OVERDUE'),
        },
        {
          key: 'depositsSettledRecently',
          unit: 'DOCUMENTS',
          tone: 'done',
          link: dash('ACCOUNTING'),
          calc: (_, b) => sumExtra(b, 'DEPOSIT_CONFIRMED') + sumExtra(b, 'DEPOSIT_WAIVED'),
        },
      ],
    };
    const metric = (d: Def, list: WorkItemRow[], branchIds: string[]): MetricEntry => {
      const { calc, ...rest } = d;
      return { ...rest, value: calc(list, branchIds) };
    };

    const pulse = visible.map((department) => ({
      department,
      metrics: DEFS[department].map((d) => metric(d, items, allIds)),
    }));

    // ---- department health (from the same items)
    const tally = <K extends string>(list: WorkItemRow[], key: (i: WorkItemRow) => K) => {
      const m = new Map<K, number>();
      for (const i of list) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
      return m;
    };
    const COMPLETED_KEYS: Record<(typeof DEPTS)[number], string[]> = {
      SALES: ['SO_DELIVERED'],
      PURCHASING: ['PO_RECEIVED'],
      WAREHOUSE: ['GR_POSTED', 'ADJ_POSTED', 'COUNT_POSTED'],
      OPERATIONS: ['MO_COMPLETED'],
      ACCOUNTING: ['DEPOSIT_CONFIRMED', 'DEPOSIT_WAIVED'],
    };
    const departments = visible.map((department) => {
      const waiting = items.filter((i) => i.next === department);
      const own = items.filter((i) => i.department === department);
      return {
        department,
        open: own.length,
        waiting: waiting.length,
        blocked: countIf(waiting, (i) => i.class === 'BLOCKED'),
        overdue: countIf(waiting, (i) => i.class === 'OVERDUE'),
        stages: [...tally(waiting, (i) => i.stage)].map(([key, value]) => ({ key, value })),
        completed: COMPLETED_KEYS[department].map((key) => ({ key, value: sumExtra(allIds, key) })),
        waitsOn: [
          ...tally(
            own.filter((i) => i.next !== department),
            (i) => i.next,
          ),
        ].map(([d, value]) => ({ department: d, value })),
        awaitedBy: [
          ...tally(
            waiting.filter((i) => i.department !== department),
            (i) => i.department,
          ),
        ].map(([d, value]) => ({ department: d, value })),
        link: dash(department),
      };
    });

    // ---- bottlenecks: the cross-department flows
    const bottlenecks = FLOWS.filter(
      (f) =>
        items.some((i) => f.stages.includes(i.stage)) || (visible as string[]).includes(f.from),
    )
      .filter((f) => (visible as string[]).includes(f.from) || (visible as string[]).includes(f.to))
      .map((f) => {
        const list = items.filter((i) => f.stages.includes(i.stage));
        return {
          key: f.key,
          from: f.from,
          to: f.to,
          total: list.length,
          classes: [...tally(list, (i) => i.class)].map(([key, value]) => ({ key, value })),
          stages: f.stages.map((key) => ({ key, value: stageCount(list, key) })),
          items: list.slice(0, BOTTLENECK_ITEMS),
        };
      });

    // ---- priority queue
    const attention = items
      .filter(
        (i) => i.class === 'BLOCKED' || i.class === 'OVERDUE' || i.reason === 'STOCK_DISCREPANCY',
      )
      .sort(byQueue);

    // ---- branch comparison (each document belongs to exactly one branch)
    const COMPARE: [string, (typeof DEPTS)[number], string][] = [
      ['sales.openOrders', 'SALES', 'openOrders'],
      ['sales.overdue', 'SALES', 'overdue'],
      ['purchasing.requestsToOrder', 'PURCHASING', 'requestsToOrder'],
      ['purchasing.ordersAwaitingReceipt', 'PURCHASING', 'ordersAwaitingReceipt'],
      ['purchasing.overdueReceipts', 'PURCHASING', 'overdueReceipts'],
      ['warehouse.receiptsToPost', 'WAREHOUSE', 'receiptsToPost'],
      ['warehouse.countsInReview', 'WAREHOUSE', 'countsInReview'],
      ['operations.activeOrders', 'OPERATIONS', 'activeOrders'],
      ['operations.awaitingMaterials', 'OPERATIONS', 'awaitingMaterials'],
      ['accounting.depositsPending', 'ACCOUNTING', 'depositsPending'],
    ];
    const compare = COMPARE.filter(([, d]) => (visible as string[]).includes(d));
    const branchComparison = {
      keys: compare.map(([k]) => k),
      rows: s.branches.map((b) => {
        const mine = items.filter((i) => i.branch.id === b.id);
        return {
          branch: b,
          values: Object.fromEntries(
            compare.map(([k, d, key]) => [
              k,
              metric(
                DEFS[d].find((x) => x.key === key)!,
                mine,
                [b.id],
              ).value,
            ]),
          ),
        };
      }),
    };

    const answer: Overview = {
      scope: { company: s.companyName, branches: s.allowed, selected: s.selected },
      role: s.role,
      readOnly: true,
      today: s.today,
      generatedAt: new Date().toISOString(),
      visible,
      pulse,
      departments,
      bottlenecks,
      queue: { total: attention.length, items: attention.slice(0, QUEUE_ITEMS) },
      branchComparison,
      activity: await this.activity(s),
      notes: [
        'NO_FINANCIALS',
        'NO_TRENDS',
        'DRAFTS_EXCLUDED',
        ...(visible.includes('ACCOUNTING') ? ['ACCOUNTING_SCOPE'] : []),
        ...(truncated ? ['TRUNCATED'] : []),
      ],
    };
    return OverviewView.parse(answer);
  }

  // ------------------------------------------------------------------ recent activity

  private async activity(s: Scope) {
    const ids = s.branches.map((b) => b.id);
    const ref = new Map(s.branches.map((b) => [b.id, b]));
    const base = { companyId: s.companyId, branchId: { in: ids } };
    const since = asDay(addDays(s.today, -(RECENT_DAYS - 1)));
    const take = ACTIVITY_ITEMS;
    type Ev = {
      kind: string;
      id: string;
      number: string;
      event: string;
      at: Date;
      branchId: string;
      department: DepartmentCode;
      link: string | null;
    };
    const out: Ev[] = [];
    const q: Promise<void>[] = [];
    const add = <T extends { id: string; number: string; branchId: string }>(
      rows: T[],
      f: (r: T) => Omit<Ev, 'id' | 'number' | 'branchId'> | null,
    ) => {
      for (const r of rows) {
        const e = f(r);
        if (e) out.push({ id: r.id, number: r.number, branchId: r.branchId, ...e });
      }
    };
    const so = (id: string) => (s.has('sales.orders.view') ? `/core/sales/orders/${id}` : null);
    if (s.has('sales.orders.view')) {
      q.push(
        this.db.salesOrder
          .findMany({
            where: { ...base, confirmedAt: { gte: since } },
            orderBy: { confirmedAt: 'desc' },
            take,
            select: { id: true, number: true, branchId: true, confirmedAt: true },
          })
          .then((r) =>
            add(r, (x) => ({
              kind: 'SALES_ORDER',
              event: 'SO_CONFIRMED',
              at: x.confirmedAt!,
              department: 'SALES',
              link: so(x.id),
            })),
          ),
        this.db.salesShipment
          .findMany({
            where: { ...base, deliveredAt: { gte: since }, status: 'DELIVERED' },
            orderBy: { deliveredAt: 'desc' },
            take,
            select: {
              id: true,
              number: true,
              branchId: true,
              deliveredAt: true,
              salesOrderId: true,
            },
          })
          .then((r) =>
            add(r, (x) => ({
              kind: 'SALES_SHIPMENT',
              event: 'SHIPMENT_DELIVERED',
              at: x.deliveredAt!,
              department: 'WAREHOUSE',
              link: so(x.salesOrderId),
            })),
          ),
        this.db.salesShipment
          .findMany({
            where: { ...base, dispatchedAt: { gte: since } },
            orderBy: { dispatchedAt: 'desc' },
            take,
            select: {
              id: true,
              number: true,
              branchId: true,
              dispatchedAt: true,
              salesOrderId: true,
            },
          })
          .then((r) =>
            add(r, (x) => ({
              kind: 'SALES_SHIPMENT',
              event: 'SHIPMENT_DISPATCHED',
              at: x.dispatchedAt!,
              department: 'WAREHOUSE',
              link: so(x.salesOrderId),
            })),
          ),
      );
    }
    if (s.has('purchasing.orders.view'))
      q.push(
        this.db.purchaseOrder
          .findMany({
            where: { ...base, issuedAt: { gte: since } },
            orderBy: { issuedAt: 'desc' },
            take,
            select: { id: true, number: true, branchId: true, issuedAt: true },
          })
          .then((r) =>
            add(r, (x) => ({
              kind: 'PURCHASE_ORDER',
              event: 'PO_ISSUED',
              at: x.issuedAt!,
              department: 'PURCHASING',
              link: `/core/purchasing/orders/${x.id}`,
            })),
          ),
      );
    if (s.has('warehouse.receiving.view'))
      q.push(
        this.db.goodsReceipt
          .findMany({
            where: { ...base, status: 'POSTED', postedAt: { gte: since } },
            orderBy: { postedAt: 'desc' },
            take,
            select: { id: true, number: true, branchId: true, postedAt: true },
          })
          .then((r) =>
            add(r, (x) => ({
              kind: 'GOODS_RECEIPT',
              event: 'GR_POSTED',
              at: x.postedAt!,
              department: 'WAREHOUSE',
              link: `/core/warehouse/receipts/${x.id}`,
            })),
          ),
      );
    if (s.has('operations.orders.view'))
      q.push(
        this.db.productionOrder
          .findMany({
            where: {
              ...base,
              OR: [{ releasedAt: { gte: since } }, { completedAt: { gte: since } }],
            },
            orderBy: { updatedAt: 'desc' },
            take,
            select: {
              id: true,
              number: true,
              branchId: true,
              releasedAt: true,
              completedAt: true,
              status: true,
            },
          })
          .then((r) => {
            for (const x of r) {
              const link = `/core/production/orders/${x.id}`;
              if (x.releasedAt && x.releasedAt >= since)
                out.push({
                  kind: 'PRODUCTION_ORDER',
                  id: x.id,
                  number: x.number,
                  branchId: x.branchId,
                  event: 'MO_RELEASED',
                  at: x.releasedAt,
                  department: 'OPERATIONS',
                  link,
                });
              if (x.completedAt && x.completedAt >= since && x.status === 'COMPLETED')
                out.push({
                  kind: 'PRODUCTION_ORDER',
                  id: x.id,
                  number: x.number,
                  branchId: x.branchId,
                  event: 'MO_COMPLETED',
                  at: x.completedAt,
                  department: 'OPERATIONS',
                  link,
                });
            }
          }),
      );
    if (s.has('accounting.deposits.view'))
      q.push(
        this.db.purchaseOrder
          .findMany({
            where: { ...base, depositConfirmedAt: { gte: since }, depositStatus: 'CONFIRMED' },
            orderBy: { depositConfirmedAt: 'desc' },
            take,
            select: { id: true, number: true, branchId: true, depositConfirmedAt: true },
          })
          .then((r) =>
            add(r, (x) => ({
              kind: 'SUPPLIER_DEPOSIT',
              event: 'DEPOSIT_CONFIRMED',
              at: x.depositConfirmedAt!,
              department: 'ACCOUNTING',
              link: `/core/accounting/deposits/${x.id}`,
            })),
          ),
      );
    await Promise.all(q);
    return out
      .sort(
        (a, b) =>
          b.at.getTime() - a.at.getTime() ||
          a.number.localeCompare(b.number) ||
          a.event.localeCompare(b.event),
      )
      .slice(0, ACTIVITY_ITEMS)
      .map(({ branchId, at, ...e }) => ({
        ...e,
        at: at.toISOString(),
        branch: ref.get(branchId)!,
      }));
  }

  // ------------------------------------------------------------------ root-cause trace

  /**
   * One document and the documents around it (statuses, dates, links) — no money, no
   * quantity, no recipe. The document must be in the person's company and branches and of a
   * department they may read; anything else is the same 404 (no id oracle).
   */
  async trace(ctx: AuthContext, kind: string, id: string) {
    const s = await this.scope(ctx);
    const ids = s.allowed.map((b) => b.id);
    const ref = new Map(s.allowed.map((b) => [b.id, b]));
    const where = { id, companyId: s.companyId, branchId: { in: ids } };
    const d = (x: Date | null) => day(x);
    let doc: {
      kind: string;
      id: string;
      number: string;
      status: string;
      context: string | null;
      branchId: string;
      link: string | null;
    };
    let related: {
      kind: string;
      id: string;
      number: string;
      status: string;
      at: string | null;
      link: string | null;
    }[];

    if (kind === 'sales-order' && s.has('sales.orders.view')) {
      const o = await this.db.salesOrder.findFirst({
        where: { ...where, status: { not: 'DRAFT' } },
        select: {
          id: true,
          number: true,
          status: true,
          customerName: true,
          branchId: true,
          picks: {
            select: { id: true, number: true, status: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          packs: {
            select: { id: true, number: true, status: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          shipments: {
            select: { id: true, number: true, status: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          productionOrders: {
            where: { status: { not: 'DRAFT' } },
            select: { id: true, number: true, status: true, createdAt: true },
          },
        },
      });
      if (!o) throw notFound();
      const wh = s.has('warehouse.inventory.view');
      doc = {
        kind: 'SALES_ORDER',
        id: o.id,
        number: o.number,
        status: o.status,
        context: o.customerName,
        branchId: o.branchId,
        link: `/core/sales/orders/${o.id}`,
      };
      related = [
        ...o.picks.map((x) => ({
          kind: 'SALES_PICK',
          id: x.id,
          number: x.number,
          status: x.status,
          at: d(x.createdAt),
          link: wh ? `/core/warehouse/picks/${x.id}` : null,
        })),
        ...o.packs.map((x) => ({
          kind: 'SALES_PACK',
          id: x.id,
          number: x.number,
          status: x.status,
          at: d(x.createdAt),
          link: wh ? `/core/warehouse/packs/${x.id}` : null,
        })),
        ...o.shipments.map((x) => ({
          kind: 'SALES_SHIPMENT',
          id: x.id,
          number: x.number,
          status: x.status,
          at: d(x.createdAt),
          link: wh ? `/core/warehouse/shipments/${x.id}` : null,
        })),
        ...(s.has('operations.orders.view')
          ? o.productionOrders.map((x) => ({
              kind: 'PRODUCTION_ORDER',
              id: x.id,
              number: x.number,
              status: x.status,
              at: d(x.createdAt),
              link: `/core/production/orders/${x.id}`,
            }))
          : []),
      ];
    } else if (kind === 'purchase-order' && s.has('purchasing.orders.view')) {
      const o = await this.db.purchaseOrder.findFirst({
        // As in the Purchasing module, an Executive never reads a DRAFT order.
        where: { ...where, ...(s.role === 'EXECUTIVE' ? { status: { not: 'DRAFT' } } : {}) },
        select: {
          id: true,
          number: true,
          status: true,
          supplierName: true,
          branchId: true,
          depositStatus: true,
          lines: { select: { purchaseRequestId: true } },
          receipts: {
            select: { id: true, number: true, status: true, receivedAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!o) throw notFound();
      const prIds = [...new Set(o.lines.map((l) => l.purchaseRequestId))];
      const prs = s.has('purchasing.requests.view')
        ? await this.db.purchaseRequest.findMany({
            where: { id: { in: prIds }, companyId: s.companyId },
            select: { id: true, number: true, status: true, approvedAt: true },
          })
        : [];
      doc = {
        kind: 'PURCHASE_ORDER',
        id: o.id,
        number: o.number,
        status: o.status,
        context: o.supplierName,
        branchId: o.branchId,
        link: `/core/purchasing/orders/${o.id}`,
      };
      related = [
        ...prs.map((x) => ({
          kind: 'PURCHASE_REQUEST',
          id: x.id,
          number: x.number,
          status: x.status,
          at: d(x.approvedAt),
          link: `/core/purchasing/requests/${x.id}`,
        })),
        ...(o.depositStatus !== 'NOT_REQUIRED'
          ? [
              {
                kind: 'SUPPLIER_DEPOSIT',
                id: o.id,
                number: o.number,
                status: o.depositStatus,
                at: null,
                link: s.has('accounting.deposits.view')
                  ? `/core/accounting/deposits/${o.id}`
                  : null,
              },
            ]
          : []),
        ...o.receipts.map((x) => ({
          kind: 'GOODS_RECEIPT',
          id: x.id,
          number: x.number,
          status: x.status,
          at: d(x.receivedAt),
          link: s.has('warehouse.receiving.view') ? `/core/warehouse/receipts/${x.id}` : null,
        })),
      ];
    } else if (kind === 'production-order' && s.has('operations.orders.view')) {
      const o = await this.db.productionOrder.findFirst({
        where: { ...where, status: { not: 'DRAFT' } },
        select: {
          id: true,
          number: true,
          status: true,
          itemName: true,
          branchId: true,
          salesOrderId: true,
          issues: {
            select: { id: true, number: true, status: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          outputReports: {
            select: { id: true, number: true, status: true, productionDate: true },
            orderBy: { createdAt: 'asc' },
          },
          fgReceipts: {
            select: { id: true, number: true, status: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!o) throw notFound();
      const source =
        o.salesOrderId && s.has('sales.orders.view')
          ? await this.db.salesOrder.findFirst({
              where: { id: o.salesOrderId, companyId: s.companyId },
              select: { id: true, number: true, status: true, confirmedAt: true },
            })
          : null;
      doc = {
        kind: 'PRODUCTION_ORDER',
        id: o.id,
        number: o.number,
        status: o.status,
        context: o.itemName,
        branchId: o.branchId,
        link: `/core/production/orders/${o.id}`,
      };
      related = [
        ...(source
          ? [
              {
                kind: 'SALES_ORDER',
                id: source.id,
                number: source.number,
                status: source.status,
                at: d(source.confirmedAt),
                link: `/core/sales/orders/${source.id}`,
              },
            ]
          : []),
        ...o.issues.map((x) => ({
          kind: 'MATERIAL_ISSUE',
          id: x.id,
          number: x.number,
          status: x.status,
          at: d(x.createdAt),
          link: `/core/production/issues/${x.id}`,
        })),
        ...o.outputReports.map((x) => ({
          kind: 'OUTPUT_REPORT',
          id: x.id,
          number: x.number,
          status: x.status,
          at: d(x.productionDate),
          link: `/core/production/output/${x.id}`,
        })),
        ...o.fgReceipts.map((x) => ({
          kind: 'FINISHED_GOODS_RECEIPT',
          id: x.id,
          number: x.number,
          status: x.status,
          at: d(x.createdAt),
          link: s.has('warehouse.finished_goods.view')
            ? `/core/warehouse/finished-goods/${x.id}`
            : null,
        })),
      ];
    } else {
      // Unknown kind, or a department this person may not read: the same 404.
      throw notFound();
    }
    // Its current work item, computed exactly as on the overview (its branch only).
    const branch = ref.get(doc.branchId)!;
    const { items } = await this.collect({ ...s, branches: [branch] }, ctx, doc.kind);
    const item = items.find((i) => i.id === doc.id && i.kind === doc.kind) ?? null;
    const { branchId: _b, ...document } = doc;
    void _b;
    return TraceView.parse({ document: { ...document, branch }, item, related });
  }
}
