import type { AuthContext } from '../auth/sessions.js';
import { allowedActiveBranches } from '../company/branch-access.js';
import { memberPermissions, requireCompanyAccess, type CompanyAccess } from '../company/context.js';
import type { Db } from '../db/client.js';
import type { SalesOrderStatus } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import type { PermissionCode } from '../permissions/catalog.js';
import { permissionDenied } from '../permissions/guard.js';

/*
 * Who may do what with a sales order (EP33) — the ONE place that answers it
 * (docs/SALES_ORDER.md). EP33 reuses the EP27 codes; there is no `submit` or
 * `confirm` word: submitting is part of `create`, confirming is `approve`.
 *
 *   action    from                  who                                    to
 *   edit      DRAFT                 its creator, holding sales.orders.create   DRAFT
 *   submit    DRAFT                 same                                   SUBMITTED
 *   cancel    DRAFT                 same (reason optional)                 CANCELLED
 *   confirm   SUBMITTED             sales.orders.approve (MANAGE)          CONFIRMED
 *   cancel    SUBMITTED, CONFIRMED  sales.orders.cancel (MANAGE), reason   CANCELLED
 *   allocate  CONFIRMED             sales.orders.approve (MANAGE)          CONFIRMED (stock reserved)
 *   release   CONFIRMED             same                                   CONFIRMED (reservations released)
 *   reallocate CONFIRMED            same                                   CONFIRMED (release + allocate, atomic)
 *   CANCELLED is terminal; CONFIRMED is commercially immutable (cancel + recreate).
 *   EP34: the allocation actions reuse `approve` — the manager who confirms the
 *   order commits stock to it; there is no separate allocation code.
 *
 * Every action also needs the order's branch (EP26). Reading needs
 * sales.orders.view in the order's branch; a DRAFT is visible only to its
 * creator and to members who may confirm (sales.orders.approve) — one
 * salesperson's unfinished work is not everyone's. `sales.orders.edit` stays
 * reserved (unused): editing a draft is part of creating it.
 */

export const SO_ACTIONS = [
  'edit',
  'submit',
  'confirm',
  'cancel',
  'allocate',
  'release',
  'reallocate',
] as const;
export type SoAction = (typeof SO_ACTIONS)[number];

export interface SalesActor {
  access: CompanyAccess;
  memberId: string;
  permissions: readonly PermissionCode[];
  branches: readonly { id: string; code: string; name: string; type: string }[];
  view: boolean;
  create: boolean;
  confirm: boolean;
  cancel: boolean;
}

export async function loadSalesActor(db: Db, ctx: AuthContext): Promise<SalesActor> {
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
    view: has('sales.orders.view'),
    create: has('sales.orders.create'),
    confirm: has('sales.orders.approve'),
    cancel: has('sales.orders.cancel'),
  };
}

export const inBranch = (actor: SalesActor, branchId: string) =>
  actor.branches.some((b) => b.id === branchId);

type OrderFacts = { status: SalesOrderStatus; branchId: string; createdByMemberId: string };

/** Whether the member may see the order at all (a hidden order is 404, never 403). */
export const canSee = (actor: SalesActor, o: OrderFacts) =>
  actor.view &&
  inBranch(actor, o.branchId) &&
  (o.status !== 'DRAFT' || o.createdByMemberId === actor.memberId || actor.confirm);

const FROM: Record<SoAction, readonly SalesOrderStatus[]> = {
  edit: ['DRAFT'],
  submit: ['DRAFT'],
  confirm: ['SUBMITTED'],
  cancel: ['DRAFT', 'SUBMITTED', 'CONFIRMED'],
  allocate: ['CONFIRMED'],
  release: ['CONFIRMED'],
  reallocate: ['CONFIRMED'],
};

export const TARGET: Record<'submit' | 'confirm' | 'cancel', SalesOrderStatus> = {
  submit: 'SUBMITTED',
  confirm: 'CONFIRMED',
  cancel: 'CANCELLED',
};

const CODE: Record<SoAction, PermissionCode> = {
  edit: 'sales.orders.create',
  submit: 'sales.orders.create',
  confirm: 'sales.orders.approve',
  cancel: 'sales.orders.cancel',
  allocate: 'sales.orders.approve',
  release: 'sales.orders.approve',
  reallocate: 'sales.orders.approve',
};

/** Why `action` is refused, or null. Without authority nothing about the state is revealed. */
export function soRefusal(
  actor: SalesActor,
  action: SoAction,
  o: OrderFacts,
): 'status' | 'authority' | 'branch' | null {
  const own = o.createdByMemberId === actor.memberId && actor.create;
  const authority =
    action === 'confirm' || action === 'allocate' || action === 'release' || action === 'reallocate'
      ? actor.confirm
      : action === 'cancel' && o.status !== 'DRAFT'
        ? actor.cancel
        : own;
  if (!authority) return 'authority';
  if (!FROM[action].includes(o.status)) return 'status';
  if (!inBranch(actor, o.branchId)) return 'branch';
  return null;
}

export const allowedSoActions = (actor: SalesActor, o: OrderFacts) =>
  SO_ACTIONS.filter((a) => soRefusal(actor, a, o) === null);

export function assertSo(actor: SalesActor, action: SoAction, o: OrderFacts) {
  const why = soRefusal(actor, action, o);
  if (why === 'authority') {
    throw permissionDenied(
      action === 'cancel' && o.status !== 'DRAFT' ? CODE.cancel : CODE[action],
    );
  }
  if (why === 'branch') {
    throw new AppError(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
  }
  if (why === 'status') {
    const code =
      action === 'confirm' && o.status === 'CONFIRMED'
        ? 'SO_ALREADY_CONFIRMED'
        : action === 'edit'
          ? 'SO_NOT_EDITABLE'
          : 'SO_INVALID_TRANSITION';
    throw new AppError(409, code, 'This action is not possible in the order’s current status.', {
      action,
      status: o.status,
    });
  }
}

export const orderNotFound = () =>
  new AppError(404, 'SO_NOT_FOUND', 'This sales order was not found.');
