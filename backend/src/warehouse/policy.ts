import type { AuthContext } from '../auth/sessions.js';
import { allowedActiveBranches } from '../company/branch-access.js';
import { memberPermissions, requireCompanyAccess, type CompanyAccess } from '../company/context.js';
import type { Db } from '../db/client.js';
import type { GoodsReceiptStatus } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import type { PermissionCode } from '../permissions/catalog.js';
import { permissionDenied } from '../permissions/guard.js';

/*
 * Who may do what with a goods receipt (EP31) — the ONE place that answers it
 * (docs/WAREHOUSE_RECEIVING.md). Every state change is a conditional update
 * (or a row lock) on the status it was decided from.
 *
 *   action   from     who                           to
 *   edit     DRAFT    warehouse.receiving.process   DRAFT (header, lines, allocations)
 *   post     DRAFT    warehouse.receiving.process   POSTED — stock goes in, the receipt locks
 *   cancel   DRAFT    warehouse.receiving.process   CANCELLED (no stock effect)
 *   cancel   POSTED   warehouse.receiving.cancel    CANCELLED — reversal movements, reason required
 *   CANCELLED is terminal. Every action also needs the receipt's branch (EP26).
 *
 * Reading: warehouse.receiving.view for receipts and pending receive,
 * warehouse.inventory.view for stock, lots and movements — both in the
 * member's branches. System Admin holds none of it unless assigned to
 * Warehouse; Executive reads, never acts.
 */

export const GR_ACTIONS = ['edit', 'post', 'cancel'] as const;
export type GrAction = (typeof GR_ACTIONS)[number];

export interface WarehouseActor {
  access: CompanyAccess;
  memberId: string;
  permissions: readonly PermissionCode[];
  branches: readonly { id: string; code: string; name: string; type: string }[];
  receiving: { view: boolean; process: boolean; cancel: boolean };
  inventory: { view: boolean };
}

export async function loadWarehouseActor(db: Db, ctx: AuthContext): Promise<WarehouseActor> {
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
    receiving: {
      view: has('warehouse.receiving.view'),
      process: has('warehouse.receiving.process'),
      cancel: has('warehouse.receiving.cancel'),
    },
    inventory: { view: has('warehouse.inventory.view') },
  };
}

export const inBranch = (actor: WarehouseActor, branchId: string) =>
  actor.branches.some((b) => b.id === branchId);

const FROM: Record<GrAction, readonly GoodsReceiptStatus[]> = {
  edit: ['DRAFT'],
  post: ['DRAFT'],
  cancel: ['DRAFT', 'POSTED'],
};

export function grRefusal(
  actor: WarehouseActor,
  action: GrAction,
  r: { status: GoodsReceiptStatus; branchId: string },
): 'status' | 'authority' | 'branch' | null {
  const authority =
    action === 'cancel' && r.status === 'POSTED' ? actor.receiving.cancel : actor.receiving.process;
  // Without authority nothing about the state is revealed; with it, a wrong status is a conflict.
  if (!authority) return 'authority';
  if (!FROM[action].includes(r.status)) return 'status';
  if (!inBranch(actor, r.branchId)) return 'branch';
  return null;
}

export const grAllowedActions = (
  actor: WarehouseActor,
  r: { status: GoodsReceiptStatus; branchId: string },
) => GR_ACTIONS.filter((a) => grRefusal(actor, a, r) === null);

export function assertGr(
  actor: WarehouseActor,
  action: GrAction,
  r: { status: GoodsReceiptStatus; branchId: string },
) {
  const why = grRefusal(actor, action, r);
  if (why === 'status') {
    throw new AppError(
      409,
      action === 'edit' ? 'GR_NOT_EDITABLE' : 'GR_INVALID_TRANSITION',
      'This action is not possible in the receipt’s current status.',
      { action, status: r.status },
    );
  }
  if (why === 'authority') {
    throw permissionDenied(
      action === 'cancel' && r.status === 'POSTED'
        ? 'warehouse.receiving.cancel'
        : 'warehouse.receiving.process',
    );
  }
  if (why === 'branch') {
    throw new AppError(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
  }
}

export const receiptNotFound = () =>
  new AppError(404, 'GR_NOT_FOUND', 'This goods receipt was not found.');

export const receiptStateChanged = () =>
  new AppError(
    409,
    'GR_STATE_CHANGED',
    'This receipt was changed by someone else just now. Reload it and try again.',
  );
