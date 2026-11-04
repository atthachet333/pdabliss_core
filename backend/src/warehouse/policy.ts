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
  /** EP32 */
  transfers: { create: boolean; approve: boolean; cancel: boolean };
  adjustments: { create: boolean; approve: boolean };
  counts: { create: boolean; approve: boolean };
  /** EP35 sales fulfilment */
  fulfilment: { pick: boolean; dispatch: boolean; deliver: boolean };
  /** EP37: the read-only production material issue handoff */
  materialIssues: { view: boolean };
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
    transfers: {
      create: has('warehouse.transfers.create'),
      approve: has('warehouse.transfers.approve'),
      cancel: has('warehouse.transfers.cancel'),
    },
    adjustments: {
      create: has('warehouse.stock_adjustment.create'),
      approve: has('warehouse.stock_adjustment.approve'),
    },
    counts: {
      create: has('warehouse.counts.create'),
      approve: has('warehouse.counts.approve'),
    },
    fulfilment: {
      pick: has('warehouse.picking.process'),
      dispatch: has('warehouse.dispatch.confirm'),
      deliver: has('warehouse.delivery.confirm'),
    },
    materialIssues: { view: has('warehouse.material_issues.view') },
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

// ---------------------------------------------------------------- EP32 documents

/*
 * Transfers, adjustments and cycle counts (EP32) — the same convention: one
 * rule per action (the statuses it starts from, the code it needs); without the
 * code 403 and the state is not revealed; a wrong status is 409; every action
 * also needs the document's branch. Reading needs warehouse.inventory.view.
 *
 *   transfer    edit / post / cancel        DRAFT edit and cancel: transfers.create; post:
 *                                           transfers.approve; cancel a POSTED one: transfers.cancel
 *   adjustment  edit / submit / approve /   edit, submit, cancel DRAFT / SUBMITTED: stock_adjustment.create;
 *               reject / cancel             approve (= post), reject, cancel POSTED: stock_adjustment.approve
 *   count       edit / start / count /      edit and start a DRAFT, count and send a COUNTING one to
 *               review / reopen / post /    review, reopen a REVIEW one, cancel before posting:
 *               cancel                      counts.create; post a REVIEW one: counts.approve
 */

interface Rule<S extends string> {
  from: readonly S[];
  code: (s: S) => PermissionCode;
}

export function docRefusal<S extends string>(
  actor: WarehouseActor,
  rule: Rule<S>,
  d: { status: S; branchId: string },
): 'status' | 'authority' | 'branch' | null {
  if (!actor.permissions.includes(rule.code(d.status))) return 'authority';
  if (!rule.from.includes(d.status)) return 'status';
  if (!inBranch(actor, d.branchId)) return 'branch';
  return null;
}

export function assertDoc<S extends string>(
  actor: WarehouseActor,
  action: string,
  rule: Rule<S>,
  d: { status: S; branchId: string },
) {
  const why = docRefusal(actor, rule, d);
  if (why === 'authority') throw permissionDenied(rule.code(d.status));
  if (why === 'branch') {
    throw new AppError(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');
  }
  if (why === 'status') {
    const code =
      action === 'post' && d.status === 'POSTED'
        ? 'DOCUMENT_ALREADY_POSTED'
        : action === 'edit' || action === 'count'
          ? 'DOCUMENT_NOT_EDITABLE'
          : 'INVALID_TRANSITION';
    throw new AppError(409, code, 'This action is not possible in the document’s current status.', {
      action,
      status: d.status,
    });
  }
}

export const allowedDocActions = <S extends string, A extends string>(
  actor: WarehouseActor,
  rules: Record<A, Rule<S>>,
  d: { status: S; branchId: string },
) => (Object.keys(rules) as A[]).filter((a) => docRefusal(actor, rules[a], d) === null);

type TransferStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export const TRANSFER_RULES = {
  edit: { from: ['DRAFT'], code: () => 'warehouse.transfers.create' },
  post: { from: ['DRAFT'], code: () => 'warehouse.transfers.approve' },
  cancel: {
    from: ['DRAFT', 'POSTED'],
    code: (s) => (s === 'POSTED' ? 'warehouse.transfers.cancel' : 'warehouse.transfers.create'),
  },
} satisfies Record<string, Rule<TransferStatus>>;

type AdjustmentStatus = 'DRAFT' | 'SUBMITTED' | 'POSTED' | 'REJECTED' | 'CANCELLED';
export const ADJUSTMENT_RULES = {
  edit: { from: ['DRAFT'], code: () => 'warehouse.stock_adjustment.create' },
  submit: { from: ['DRAFT'], code: () => 'warehouse.stock_adjustment.create' },
  approve: { from: ['SUBMITTED'], code: () => 'warehouse.stock_adjustment.approve' },
  reject: { from: ['SUBMITTED'], code: () => 'warehouse.stock_adjustment.approve' },
  cancel: {
    from: ['DRAFT', 'SUBMITTED', 'POSTED'],
    code: (s) =>
      s === 'POSTED' ? 'warehouse.stock_adjustment.approve' : 'warehouse.stock_adjustment.create',
  },
} satisfies Record<string, Rule<AdjustmentStatus>>;

type CountStatus = 'DRAFT' | 'COUNTING' | 'REVIEW' | 'POSTED' | 'CANCELLED';
export const COUNT_RULES = {
  edit: { from: ['DRAFT'], code: () => 'warehouse.counts.create' },
  start: { from: ['DRAFT'], code: () => 'warehouse.counts.create' },
  count: { from: ['COUNTING'], code: () => 'warehouse.counts.create' },
  review: { from: ['COUNTING'], code: () => 'warehouse.counts.create' },
  reopen: { from: ['REVIEW'], code: () => 'warehouse.counts.create' },
  post: { from: ['REVIEW'], code: () => 'warehouse.counts.approve' },
  cancel: { from: ['DRAFT', 'COUNTING', 'REVIEW'], code: () => 'warehouse.counts.create' },
} satisfies Record<string, Rule<CountStatus>>;

/*
 * EP35 sales fulfilment (docs/SALES_FULFILLMENT.md §7) — the same convention.
 *
 *   pick      start / confirm / cancel    warehouse.picking.process (a PICKED pick is
 *                                         cancelled only while nothing of it is packed)
 *   pack      confirm / cancel            warehouse.picking.process (not while in a shipment)
 *   shipment  cancel (READY)              warehouse.picking.process
 *             dispatch (READY)            warehouse.dispatch.confirm — the stock issue
 *             deliver / exception         warehouse.delivery.confirm (DISPATCHED or
 *                                         DELIVERY_EXCEPTION)
 * Creating a pick, pack or shipment needs warehouse.picking.process and the order's branch.
 */
type PickStatus = 'DRAFT' | 'IN_PROGRESS' | 'PICKED' | 'CANCELLED';
export const PICK_RULES = {
  start: { from: ['DRAFT'], code: () => 'warehouse.picking.process' },
  confirm: { from: ['DRAFT', 'IN_PROGRESS'], code: () => 'warehouse.picking.process' },
  cancel: { from: ['DRAFT', 'IN_PROGRESS', 'PICKED'], code: () => 'warehouse.picking.process' },
} satisfies Record<string, Rule<PickStatus>>;

type PackStatus = 'DRAFT' | 'PACKED' | 'DISPATCHED' | 'CANCELLED';
export const PACK_RULES = {
  confirm: { from: ['DRAFT'], code: () => 'warehouse.picking.process' },
  cancel: { from: ['DRAFT', 'PACKED'], code: () => 'warehouse.picking.process' },
} satisfies Record<string, Rule<PackStatus>>;

type ShipmentStatus = 'READY' | 'DISPATCHED' | 'DELIVERED' | 'DELIVERY_EXCEPTION' | 'CANCELLED';
export const SHIPMENT_RULES = {
  cancel: { from: ['READY'], code: () => 'warehouse.picking.process' },
  dispatch: { from: ['READY'], code: () => 'warehouse.dispatch.confirm' },
  deliver: { from: ['DISPATCHED', 'DELIVERY_EXCEPTION'], code: () => 'warehouse.delivery.confirm' },
  exception: {
    from: ['DISPATCHED', 'DELIVERY_EXCEPTION'],
    code: () => 'warehouse.delivery.confirm',
  },
} satisfies Record<string, Rule<ShipmentStatus>>;

export const documentNotFound = (
  kind: 'TRANSFER' | 'ADJUSTMENT' | 'COUNT' | 'PICK' | 'PACK' | 'SHIPMENT',
) => new AppError(404, `${kind}_NOT_FOUND`, 'This document was not found.');
