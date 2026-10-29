import type { AuthContext } from '../auth/sessions.js';
import type { DepartmentCode } from '../billing/catalog.js';
import { allowedActiveBranches } from '../company/branch-access.js';
import { memberPermissions, requireCompanyAccess, type CompanyAccess } from '../company/context.js';
import type { Db } from '../db/client.js';
import type { PurchaseRequestStatus } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import type { OperationalPermission, PermissionCode } from '../permissions/catalog.js';
import { permissionDenied } from '../permissions/guard.js';

/*
 * Who may do what with a purchase request (EP29) — the ONE place that
 * answers it. Routes never compare statuses or roles; the service asks
 * `can(actor, action, request)` / `assertCan(…)`, and every state change is a
 * conditional update on the expected status (a concurrent second decision
 * finds the status changed and fails).
 *
 * Permissions are EP27 catalog codes resolved per request (role defaults,
 * department + package + assignment, exceptions with DENY first). Branch:
 * every action on a request needs the member to work in its branch (EP26:
 * active branch, branch access); creation uses the session's selected branch.
 *
 *   action    from                  who                                      to
 *   edit      DRAFT                 the requester, still allowed to raise    DRAFT
 *                                   requests from the request's department
 *   submit    DRAFT                 same                                     SUBMITTED
 *   cancel    DRAFT, SUBMITTED      same (reason required once submitted)   CANCELLED
 *   approve   SUBMITTED             a decider for the request's department   APPROVED
 *   reject    SUBMITTED             same (reason required)                   REJECTED
 *   cancel    APPROVED              purchasing.requests.cancel (reason)     CANCELLED
 *   REJECTED and CANCELLED are terminal.
 *
 * Deciders: purchasing.requests.approve (any department) or
 * <department>.purchase_requests.approve (that department's requests). The
 * requester may decide their own request when they hold that authority (no
 * separation-of-duties rule in v1 — docs/PURCHASING_REQUEST.md).
 */

export const PR_ACTIONS = ['edit', 'submit', 'approve', 'reject', 'cancel'] as const;
export type PrAction = (typeof PR_ACTIONS)[number];

/** Departments a request can come from, and the code that lets a member raise one. */
export const CREATE_CODE: Partial<Record<DepartmentCode, OperationalPermission>> = {
  PURCHASING: 'purchasing.requests.create',
  SALES: 'sales.purchase_requests.create',
  OPERATIONS: 'operations.purchase_requests.create',
  WAREHOUSE: 'warehouse.purchase_requests.create',
  ACCOUNTING: 'accounting.purchase_requests.create',
};

/** Department managers decide their own department's requests. */
const DEPARTMENT_APPROVE_CODE: Partial<Record<DepartmentCode, OperationalPermission>> = {
  SALES: 'sales.purchase_requests.approve',
  OPERATIONS: 'operations.purchase_requests.approve',
  WAREHOUSE: 'warehouse.purchase_requests.approve',
  ACCOUNTING: 'accounting.purchase_requests.approve',
};

export const REQUEST_DEPARTMENTS = Object.keys(CREATE_CODE) as DepartmentCode[];

export interface PrActor {
  access: CompanyAccess;
  memberId: string;
  permissions: readonly PermissionCode[];
  /** Active branches the member may work in (EP26). */
  branches: readonly { id: string; code: string; name: string; type: string }[];
  /** Departments the member may raise requests from. */
  createDepartments: DepartmentCode[];
  /** Departments whose requests the member may decide (and therefore see). */
  decideDepartments: DepartmentCode[];
  /** purchasing.requests.view — the Purchasing queue. */
  purchasingView: boolean;
  /** purchasing.requests.cancel — cancel an approved request. */
  cancelApproved: boolean;
}

/** Loads the acting member's purchase-request reach — fresh on every request. */
export async function loadActor(db: Db, ctx: AuthContext): Promise<PrActor> {
  const access = await requireCompanyAccess(db, ctx);
  const [{ permissions }, branches] = await Promise.all([
    memberPermissions(db, access),
    allowedActiveBranches(db, access.member),
  ]);
  const has = (code: PermissionCode | undefined) => !!code && permissions.includes(code);
  const decideAll = has('purchasing.requests.approve');
  return {
    access,
    memberId: access.member.id,
    permissions,
    branches: branches.map((b) => ({ id: b.id, code: b.code, name: b.name, type: b.type })),
    createDepartments: REQUEST_DEPARTMENTS.filter((d) => has(CREATE_CODE[d])),
    decideDepartments: REQUEST_DEPARTMENTS.filter(
      (d) => decideAll || has(DEPARTMENT_APPROVE_CODE[d]),
    ),
    purchasingView: has('purchasing.requests.view'),
    cancelApproved: has('purchasing.requests.cancel'),
  };
}

type RequestFacts = {
  status: PurchaseRequestStatus;
  department: DepartmentCode;
  branchId: string;
  requesterMemberId: string;
};

const FROM: Record<PrAction, readonly PurchaseRequestStatus[]> = {
  edit: ['DRAFT'],
  submit: ['DRAFT'],
  approve: ['SUBMITTED'],
  reject: ['SUBMITTED'],
  cancel: ['DRAFT', 'SUBMITTED', 'APPROVED'],
};

export const TARGET: Record<Exclude<PrAction, 'edit'>, PurchaseRequestStatus> = {
  submit: 'SUBMITTED',
  approve: 'APPROVED',
  reject: 'REJECTED',
  cancel: 'CANCELLED',
};

/** Why `action` is refused, or null. `status` is the state problem, `authority` the person's. */
export function refusal(
  actor: PrActor,
  action: PrAction,
  r: RequestFacts,
): 'status' | 'authority' | 'branch' | null {
  const inBranch = actor.branches.some((b) => b.id === r.branchId);
  const ownAndAllowed =
    r.requesterMemberId === actor.memberId && actor.createDepartments.includes(r.department);
  const decider = actor.decideDepartments.includes(r.department);
  let authority: boolean;
  if (action === 'approve' || action === 'reject') authority = decider;
  else if (action === 'cancel' && r.status === 'APPROVED') authority = actor.cancelApproved;
  else authority = ownAndAllowed;
  // Someone without authority learns nothing about the state; for the others
  // the status decides next (a second approve is a state conflict, not a denial).
  if (!authority) return 'authority';
  if (!FROM[action].includes(r.status)) return 'status';
  if (!inBranch) return 'branch';
  return null;
}

export const can = (actor: PrActor, action: PrAction, r: RequestFacts) =>
  refusal(actor, action, r) === null;

export const allowedActions = (actor: PrActor, r: RequestFacts) =>
  PR_ACTIONS.filter((a) => can(actor, a, r));

export function assertCan(actor: PrActor, action: PrAction, r: RequestFacts) {
  const why = refusal(actor, action, r);
  if (why === 'status') {
    throw new AppError(
      409,
      action === 'edit' ? 'PR_NOT_EDITABLE' : 'PR_INVALID_TRANSITION',
      'This action is not possible in the request’s current status.',
      { action, status: r.status },
    );
  }
  if (why === 'authority') throw permissionDenied(`purchase_request.${action}`);
  if (why === 'branch') {
    throw new AppError(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
  }
}

/** A request the member may not see does not exist for them. */
export const requestNotFound = () =>
  new AppError(404, 'PR_NOT_FOUND', 'This purchase request was not found.');
