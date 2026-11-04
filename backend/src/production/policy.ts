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
 *   REJECTED and CANCELLED are terminal. IN_PRODUCTION / COMPLETED do not exist
 *   in EP36 — they belong to physical execution (EP37+).
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

export const MO_ACTIONS = ['edit', 'submit', 'approve', 'reject', 'release', 'cancel'] as const;
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
    shortages: has('purchasing.production_shortages.view'),
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
  cancel: ['DRAFT', 'APPROVED', 'READY'],
};

const CODE: Record<MoAction, PermissionCode> = {
  edit: 'operations.orders.create',
  submit: 'operations.orders.create',
  approve: 'operations.orders.approve',
  reject: 'operations.orders.approve',
  release: 'operations.orders.approve',
  cancel: 'operations.orders.cancel',
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
  actor.bomManage ? BOM_ACTIONS.filter((a) => BOM_FROM[a].includes(status)) : [];

export function assertBom(actor: ProductionActor, action: BomAction, status: ProductionBomStatus) {
  if (!actor.bomManage) throw permissionDenied('operations.bom.manage');
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
export const bomNotFound = () => new AppError(404, 'BOM_NOT_FOUND', 'This BOM was not found.');
