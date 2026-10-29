import type { AuthContext } from '../auth/sessions.js';
import { allowedActiveBranches } from '../company/branch-access.js';
import { memberPermissions, requireCompanyAccess, type CompanyAccess } from '../company/context.js';
import type { Db } from '../db/client.js';
import type { PurchaseOrderStatus } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import type { PermissionCode } from '../permissions/catalog.js';
import { permissionDenied } from '../permissions/guard.js';

/*
 * Who may do what with a purchase order (EP30) — the ONE place that answers
 * it (docs/PURCHASE_ORDER.md). Routes never compare statuses or roles; every
 * state change is a conditional update on the status it was decided from.
 *
 *   action           from                              who                            to
 *   edit             DRAFT                             purchasing.orders.edit, or the DRAFT
 *                                                      creator with .create
 *   issue            DRAFT                             purchasing.orders.approve      WAITING_DEPOSIT (deposit)
 *                                                                                     PENDING_RECEIVE (none)
 *   cancel           DRAFT                             as edit, or .cancel            CANCELLED
 *   cancel           WAITING_DEPOSIT, PENDING_RECEIVE  purchasing.orders.cancel       CANCELLED (reason)
 *   confirm_deposit  WAITING_DEPOSIT                   accounting.deposits.confirm    PENDING_RECEIVE
 *   waive_deposit    WAITING_DEPOSIT                   same (reason)                  PENDING_RECEIVE
 *   CANCELLED is terminal. Every action also needs the order's branch (EP26).
 *
 * An issued order's commercial content (supplier, lines, prices, deposit) is
 * immutable: a correction is cancel + a new order. No receipt exists before
 * EP31, so "cancel before any receipt" holds for every issued order today.
 */

export const PO_ACTIONS = ['edit', 'issue', 'cancel', 'confirm_deposit', 'waive_deposit'] as const;
export type PoAction = (typeof PO_ACTIONS)[number];

export interface PoActor {
  access: CompanyAccess;
  memberId: string;
  permissions: readonly PermissionCode[];
  branches: readonly { id: string; code: string; name: string; type: string }[];
  orders: { view: boolean; create: boolean; edit: boolean; issue: boolean; cancel: boolean };
  deposits: { view: boolean; confirm: boolean };
  receiving: { view: boolean };
  /** EXECUTIVE role: the read-only executive summary instead of the Purchasing view. */
  executive: boolean;
}

export async function loadPoActor(db: Db, ctx: AuthContext): Promise<PoActor> {
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
    orders: {
      view: has('purchasing.orders.view'),
      create: has('purchasing.orders.create'),
      edit: has('purchasing.orders.edit'),
      issue: has('purchasing.orders.approve'),
      cancel: has('purchasing.orders.cancel'),
    },
    deposits: {
      view: has('accounting.deposits.view'),
      confirm: has('accounting.deposits.confirm'),
    },
    receiving: { view: has('warehouse.receiving.view') },
    executive: access.member.role === 'EXECUTIVE',
  };
}

export interface OrderFacts {
  status: PurchaseOrderStatus;
  branchId: string;
  createdByMemberId: string;
}

const FROM: Record<PoAction, readonly PurchaseOrderStatus[]> = {
  edit: ['DRAFT'],
  issue: ['DRAFT'],
  cancel: ['DRAFT', 'WAITING_DEPOSIT', 'PENDING_RECEIVE'],
  confirm_deposit: ['WAITING_DEPOSIT'],
  waive_deposit: ['WAITING_DEPOSIT'],
};

const mayEditDraft = (actor: PoActor, o: OrderFacts) =>
  actor.orders.edit || (actor.orders.create && o.createdByMemberId === actor.memberId);

export function poRefusal(
  actor: PoActor,
  action: PoAction,
  o: OrderFacts,
): 'status' | 'authority' | 'branch' | null {
  let authority: boolean;
  if (action === 'edit') authority = mayEditDraft(actor, o);
  else if (action === 'issue') authority = actor.orders.issue;
  else if (action === 'cancel') {
    authority =
      o.status === 'DRAFT' ? mayEditDraft(actor, o) || actor.orders.cancel : actor.orders.cancel;
  } else authority = actor.deposits.confirm;
  // Without authority nothing about the state is revealed; with it, a wrong
  // status is a conflict (a second issue is 409, not 403).
  if (!authority) return 'authority';
  if (!FROM[action].includes(o.status)) return 'status';
  if (!actor.branches.some((b) => b.id === o.branchId)) return 'branch';
  return null;
}

export const poAllowedActions = (actor: PoActor, o: OrderFacts) =>
  PO_ACTIONS.filter((a) => poRefusal(actor, a, o) === null);

export function assertPo(actor: PoActor, action: PoAction, o: OrderFacts) {
  const why = poRefusal(actor, action, o);
  if (why === 'status') {
    throw new AppError(
      409,
      action === 'edit' ? 'PO_NOT_EDITABLE' : 'PO_INVALID_TRANSITION',
      'This action is not possible in the order’s current status.',
      { action, status: o.status },
    );
  }
  if (why === 'authority') throw permissionDenied(`purchase_order.${action}`);
  if (why === 'branch') {
    throw new AppError(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
  }
}

export const orderNotFound = () =>
  new AppError(404, 'PO_NOT_FOUND', 'This purchase order was not found.');

export const orderStateChanged = () =>
  new AppError(
    409,
    'PO_STATE_CHANGED',
    'This order was changed by someone else just now. Reload it and try again.',
  );
