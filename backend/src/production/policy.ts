import type { AuthContext } from '../auth/sessions.js';
import { allowedActiveBranches } from '../company/branch-access.js';
import { memberPermissions, requireCompanyAccess, type CompanyAccess } from '../company/context.js';
import type { Db } from '../db/client.js';
import type { ProductionBomStatus, ProductionOrderStatus } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import type { PermissionCode } from '../permissions/catalog.js';
import { permissionDenied } from '../permissions/guard.js';

/*
 * Who may do what in Production planning (EP36) — the ONE place that answers
 * it (docs/PRODUCTION_ORDER.md §4, docs/PRODUCTION_BOM.md §4). Production
 * lives in the Operations department and reuses its EP27 codes; EP36 adds
 * only `operations.orders.approve`, `operations.orders.cancel`,
 * `operations.bom.view`, `operations.bom.manage` (and the Purchasing handoff
 * `purchasing.production_shortages.view`).
 *
 *   order action  from                 who                                         to
 *   edit          DRAFT                its creator, holding operations.orders.create   DRAFT
 *   submit        DRAFT                same                                         SUBMITTED
 *   cancel        DRAFT                same (reason optional)                       CANCELLED
 *   approve       SUBMITTED            operations.orders.approve (MANAGE)           APPROVED
 *   reject        SUBMITTED            same, reason required                        REJECTED
 *   release       APPROVED             same; materials must be available now        READY
 *   cancel        APPROVED, READY      operations.orders.cancel (MANAGE), reason    CANCELLED
 *                 IN_PRODUCTION/PAUSED same — only while nothing was issued (EP37)
 *   allocate / unreserve / reallocate    APPROVED..PAUSED   operations.materials.manage (EP37)
 *   excess        IN_PRODUCTION, PAUSED      operations.materials.manage, reason
 *   start         READY                every material fully reserved; execution.manage → IN_PRODUCTION
 *   pause / resume IN_PRODUCTION ⇄ PAUSED   operations.execution.manage
 *   issue         IN_PRODUCTION        operations.material_issues.create (draft); posting needs .approve
 *   usage         IN_PRODUCTION, PAUSED      operations.material_usage.create (no stock effect)
 *   output        IN_PRODUCTION, PAUSED      operations.output.create (report; acceptance needs .approve) (EP38)
 *   review        IN_PRODUCTION, PAUSED      operations.orders.update_status → COMPLETION_REVIEW (EP38)
 *   reopen        COMPLETION_REVIEW          same → IN_PRODUCTION
 *   complete      COMPLETION_REVIEW          same → COMPLETED (outcome COMPLETED or SHORT_CLOSED)
 *   COMPLETION_REVIEW still allows release of reservations and usage records; COMPLETED,
 *   REJECTED and CANCELLED are terminal.
 *
 *   BOM action    from                 who
 *   edit          DRAFT                operations.bom.manage
 *   activate      DRAFT                same → ACTIVE (supersedes the item's ACTIVE revision → RETIRED)
 *   retire        DRAFT, ACTIVE        same → RETIRED
 *   revise        ACTIVE, RETIRED      same → a new DRAFT revision copying the lines
 *
 * Every order action also needs the order's branch (EP26). Reading needs
 * operations.orders.view in the branch; a DRAFT is visible only to its creator
 * and to approvers. BOMs are company-wide (operations.bom.view). Owner holds
 * everything; Executive reads; System Admin has no Production authority unless
 * assigned to Operations (and then never MANAGE).
 */

export const MO_ACTIONS = [
  'edit',
  'submit',
  'approve',
  'reject',
  'release',
  'cancel',
  // EP37: materials and execution
  'allocate',
  'unreserve',
  'reallocate',
  'excess',
  'start',
  'pause',
  'resume',
  'issue',
  'usage',
  // EP38: output and completion
  'output',
  'review',
  'reopen',
  'complete',
] as const;
export type MoAction = (typeof MO_ACTIONS)[number];
export const BOM_ACTIONS = ['edit', 'activate', 'retire', 'revise'] as const;
export type BomAction = (typeof BOM_ACTIONS)[number];

export interface ProductionActor {
  access: CompanyAccess;
  memberId: string;
  permissions: readonly PermissionCode[];
  branches: readonly { id: string; code: string; name: string; type: string }[];
  view: boolean;
  create: boolean;
  approve: boolean;
  cancel: boolean;
  bomView: boolean;
  bomManage: boolean;
  shortages: boolean;
  /** EP37 */
  materials: boolean;
  issueCreate: boolean;
  issuePost: boolean;
  usage: boolean;
  execution: boolean;
  warehouseIssues: boolean;
  /** EP38 */
  outputCreate: boolean;
  outputApprove: boolean;
  complete: boolean;
  /** EP46: confidential recipe data (BOM lines, ratios, BOM-derived quantities before release). */
  recipes: boolean;
  /** EP46: the company's manufacturing mode, read with the access (never from the client). */
  mode: 'BOM_REQUIRED' | 'BOM_OPTIONAL';
  fgView: boolean;
  fgProcess: boolean;
  fgConfirm: boolean;
}

export async function loadProductionActor(db: Db, ctx: AuthContext): Promise<ProductionActor> {
  const access = await requireCompanyAccess(db, ctx);
  const [{ permissions }, branches] = await Promise.all([
    memberPermissions(db, access),
    allowedActiveBranches(db, access.member),
  ]);
  const has = (code: PermissionCode) => permissions.includes(code);
  return {
    access,
    memberId: access.member.id,
    permissions,
    branches: branches.map((b) => ({ id: b.id, code: b.code, name: b.name, type: b.type })),
    view: has('operations.orders.view'),
    create: has('operations.orders.create'),
    approve: has('operations.orders.approve'),
    cancel: has('operations.orders.cancel'),
    bomView: has('operations.bom.view'),
    bomManage: has('operations.bom.manage'),
    recipes: has('operations.recipes.view'),
    mode: access.company.manufacturingMode,
    shortages: has('purchasing.production_shortages.view'),
    materials: has('operations.materials.manage'),
    issueCreate: has('operations.material_issues.create'),
    issuePost: has('operations.material_issues.approve'),
    usage: has('operations.material_usage.create'),
    execution: has('operations.execution.manage'),
    warehouseIssues: has('warehouse.material_issues.view'),
    outputCreate: has('operations.output.create'),
    outputApprove: has('operations.output.approve'),
    complete: has('operations.orders.update_status'),
    fgView: has('warehouse.finished_goods.view'),
    fgProcess: has('warehouse.finished_goods.process'),
    fgConfirm: has('warehouse.finished_goods.confirm'),
  };
}

export const inBranch = (actor: ProductionActor, branchId: string) =>
  actor.branches.some((b) => b.id === branchId);

type OrderFacts = { status: ProductionOrderStatus; branchId: string; createdByMemberId: string };

/** Whether the member may see the order at all (a hidden order is 404, never 403). */
export const canSee = (actor: ProductionActor, o: OrderFacts) =>
  actor.view &&
  inBranch(actor, o.branchId) &&
  (o.status !== 'DRAFT' || o.createdByMemberId === actor.memberId || actor.approve);

const FROM: Record<MoAction, readonly ProductionOrderStatus[]> = {
  edit: ['DRAFT'],
  submit: ['DRAFT'],
  approve: ['SUBMITTED'],
  reject: ['SUBMITTED'],
  release: ['APPROVED'],
  cancel: ['DRAFT', 'APPROVED', 'READY', 'IN_PRODUCTION', 'PAUSED'],
  allocate: ['APPROVED', 'READY', 'IN_PRODUCTION', 'PAUSED'],
  unreserve: ['APPROVED', 'READY', 'IN_PRODUCTION', 'PAUSED', 'COMPLETION_REVIEW'],
  reallocate: ['APPROVED', 'READY', 'IN_PRODUCTION', 'PAUSED'],
  excess: ['IN_PRODUCTION', 'PAUSED'],
  start: ['READY'],
  pause: ['IN_PRODUCTION'],
  resume: ['PAUSED'],
  issue: ['IN_PRODUCTION'],
  usage: ['IN_PRODUCTION', 'PAUSED', 'COMPLETION_REVIEW'],
  output: ['IN_PRODUCTION', 'PAUSED'],
  review: ['IN_PRODUCTION', 'PAUSED'],
  reopen: ['COMPLETION_REVIEW'],
  complete: ['COMPLETION_REVIEW'],
};

const CODE: Record<MoAction, PermissionCode> = {
  edit: 'operations.orders.create',
  submit: 'operations.orders.create',
  approve: 'operations.orders.approve',
  reject: 'operations.orders.approve',
  release: 'operations.orders.approve',
  cancel: 'operations.orders.cancel',
  allocate: 'operations.materials.manage',
  unreserve: 'operations.materials.manage',
  reallocate: 'operations.materials.manage',
  excess: 'operations.materials.manage',
  start: 'operations.execution.manage',
  pause: 'operations.execution.manage',
  resume: 'operations.execution.manage',
  issue: 'operations.material_issues.create',
  usage: 'operations.material_usage.create',
  output: 'operations.output.create',
  review: 'operations.orders.update_status',
  reopen: 'operations.orders.update_status',
  complete: 'operations.orders.update_status',
};

/** Why `action` is refused, or null. Without authority nothing about the state is revealed. */
export function moRefusal(
  actor: ProductionActor,
  action: MoAction,
  o: OrderFacts,
): 'status' | 'authority' | 'branch' | null {
  const own = o.createdByMemberId === actor.memberId && actor.create;
  const authority =
    action === 'approve' || action === 'reject' || action === 'release'
      ? actor.approve
      : action === 'cancel' && o.status !== 'DRAFT'
        ? actor.cancel
        : action === 'allocate' ||
            action === 'unreserve' ||
            action === 'reallocate' ||
            action === 'excess'
          ? actor.materials
          : action === 'start' || action === 'pause' || action === 'resume'
            ? actor.execution
            : action === 'issue'
              ? actor.issueCreate
              : action === 'usage'
                ? actor.usage
                : action === 'output'
                  ? actor.outputCreate
                  : action === 'review' || action === 'reopen' || action === 'complete'
                    ? actor.complete
                    : own;
  if (!authority) return 'authority';
  if (!FROM[action].includes(o.status)) return 'status';
  if (!inBranch(actor, o.branchId)) return 'branch';
  return null;
}

export const allowedMoActions = (actor: ProductionActor, o: OrderFacts) =>
  MO_ACTIONS.filter((a) => moRefusal(actor, a, o) === null);

export function assertMo(actor: ProductionActor, action: MoAction, o: OrderFacts) {
  const why = moRefusal(actor, action, o);
  if (why === 'authority') {
    throw permissionDenied(
      action === 'cancel' && o.status !== 'DRAFT'
        ? CODE.cancel
        : action === 'cancel'
          ? CODE.edit
          : CODE[action],
    );
  }
  if (why === 'branch') {
    throw new AppError(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
  }
  if (why === 'status') {
    const code =
      action === 'approve' && (o.status === 'APPROVED' || o.status === 'READY')
        ? 'MO_ALREADY_APPROVED'
        : action === 'edit'
          ? 'MO_NOT_EDITABLE'
          : action === 'start' && (o.status === 'IN_PRODUCTION' || o.status === 'PAUSED')
            ? 'MO_ALREADY_STARTED'
            : action === 'issue' || action === 'output'
              ? 'MO_NOT_IN_PRODUCTION'
              : o.status === 'COMPLETED'
                ? 'MO_COMPLETED'
                : 'MO_INVALID_TRANSITION';
    throw new AppError(
      409,
      code,
      'This action is not possible in the production order’s current status.',
      { action, status: o.status },
    );
  }
}

const BOM_FROM: Record<BomAction, readonly ProductionBomStatus[]> = {
  edit: ['DRAFT'],
  activate: ['DRAFT'],
  retire: ['DRAFT', 'ACTIVE'],
  revise: ['ACTIVE', 'RETIRED'],
};

export const allowedBomActions = (actor: ProductionActor, status: ProductionBomStatus) =>
  actor.bomManage && actor.recipes ? BOM_ACTIONS.filter((a) => BOM_FROM[a].includes(status)) : [];

export function assertBom(actor: ProductionActor, action: BomAction, status: ProductionBomStatus) {
  if (!actor.bomManage) throw permissionDenied('operations.bom.manage');
  // EP46: editing a recipe means seeing it.
  if (!actor.recipes) throw permissionDenied('operations.recipes.view');
  if (!BOM_FROM[action].includes(status)) {
    throw new AppError(
      409,
      action === 'edit' ? 'BOM_NOT_EDITABLE' : 'BOM_INVALID_TRANSITION',
      action === 'edit'
        ? 'Only a draft BOM revision can be edited: create a new revision.'
        : 'This action is not possible in the BOM revision’s current status.',
      { action, status },
    );
  }
}

export const orderNotFound = () =>
  new AppError(404, 'MO_NOT_FOUND', 'This production order was not found.');
export const issueNotFound = () =>
  new AppError(404, 'MI_NOT_FOUND', 'This material issue was not found.');
export const outputNotFound = () =>
  new AppError(404, 'OUTPUT_NOT_FOUND', 'This output report was not found.');
export const receiptNotFound = () =>
  new AppError(404, 'FGR_NOT_FOUND', 'This finished goods receipt was not found.');
export const bomNotFound = () => new AppError(404, 'BOM_NOT_FOUND', 'This BOM was not found.');
