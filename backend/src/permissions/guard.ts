import type { AuthContext } from '../auth/sessions.js';
import { canWorkInBranch } from '../company/branch-access.js';
import {
  branchNotAllowed,
  memberPermissions,
  requireCompanyAccess,
  requireOperationsContext,
  type CompanyAccess,
  type OperationsContext,
} from '../company/context.js';
import type { Db } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import {
  permissionDefinition,
  type AdminPermission,
  type OperationalPermission,
  type PermissionCode,
} from './catalog.js';

/*
 * The one way an endpoint asks "may this session do X?" (EP27).
 *
 *   const op = await requirePermission(db, auth(request), 'purchasing.requests.create');
 *   // op.companyId, op.branch.id — scope every query by both
 *
 * Branch-scoped permissions resolve the operations context first (active
 * membership, eligible company, a selected branch the member may still work
 * in — EP26), then the effective permissions (EP27). Company-scoped
 * (administration) permissions resolve the company access and the role.
 * Both fail the same way: 403 PERMISSION_DENIED naming the permission.
 * Nothing is cached — a revoked permission fails on the next request.
 */

export const permissionDenied = (permission: string) =>
  new AppError(403, 'PERMISSION_DENIED', 'You do not have permission for this action.', {
    permission,
  });

export async function requirePermission(
  db: Db,
  ctx: AuthContext,
  permission: OperationalPermission,
): Promise<OperationsContext>;
export async function requirePermission(
  db: Db,
  ctx: AuthContext,
  permission: AdminPermission,
): Promise<CompanyAccess>;
export async function requirePermission(
  db: Db,
  ctx: AuthContext,
  permission: OperationalPermission | AdminPermission,
): Promise<OperationsContext | CompanyAccess> {
  const def = permissionDefinition(permission);
  if (def.namespace === 'COMPANY_ADMIN') {
    const access = await requireCompanyAccess(db, ctx);
    if (!access.adminPermissions.includes(permission as AdminPermission)) {
      throw permissionDenied(permission);
    }
    return access;
  }
  if (def.scope === 'COMPANY') {
    // An operational permission that is not tied to a branch (none yet).
    const access = await requireCompanyAccess(db, ctx);
    if (!(await memberPermissions(db, access)).permissions.includes(permission)) {
      throw permissionDenied(permission);
    }
    return access;
  }
  const op = await requireOperationsContext(db, ctx);
  if (!op.permissions.includes(permission)) {
    throw permissionDenied(permission);
  }
  return op;
}

/** Company access plus the member's effective permission codes (read once for this request). */
export interface PermissionAccess extends CompanyAccess {
  permissions: PermissionCode[];
}

/**
 * EP28: a company-scoped check that any one of several codes satisfies. One
 * canonical record (a customer, an item) is read through more than one
 * department — `sales.customers.view` or `accounting.customers.view` — and
 * administered by its owning department or the company administration
 * (`company.master_data.manage`). Codes must be COMPANY-scoped: a branch
 * permission is never satisfied without a branch (requireBranchPermission).
 */
export async function requireAnyPermission(
  db: Db,
  ctx: AuthContext,
  anyOf: readonly PermissionCode[],
): Promise<PermissionAccess> {
  if (anyOf.some((p) => permissionDefinition(p).scope !== 'COMPANY')) {
    throw new Error('requireAnyPermission takes company-scoped permissions only');
  }
  const access = await requireCompanyAccess(db, ctx);
  const { permissions } = await memberPermissions(db, access);
  if (!anyOf.some((p) => permissions.includes(p))) throw permissionDenied(anyOf.join(' | '));
  return { ...access, permissions };
}

/**
 * EP28: a branch-scoped permission for a branch named in the request (a
 * warehouse location's branch) rather than the session's selected branch.
 * The branch is looked up inside the caller's company (another company's
 * branch is not found). `companyWide` — an administration code such as
 * `company.master_data.manage` — reaches every branch of the company, as
 * company administration does in EP26; otherwise the member needs the
 * permission AND branch access to that active branch (EP26). Fails with
 * 404 BRANCH_NOT_FOUND, 403 PERMISSION_DENIED or 403 BRANCH_NOT_ALLOWED.
 */
export async function requireBranchPermission(
  db: Db,
  ctx: AuthContext,
  permission: OperationalPermission,
  branchId: string,
  companyWide?: AdminPermission,
): Promise<PermissionAccess & { branch: { id: string; code: string; status: string } }> {
  if (permissionDefinition(permission).scope !== 'BRANCH') {
    throw new Error('requireBranchPermission takes a branch-scoped permission');
  }
  const access = await requireCompanyAccess(db, ctx);
  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId: access.company.id },
    select: { id: true, code: true, status: true },
  });
  if (!branch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found.');
  const { permissions } = await memberPermissions(db, access);
  if (companyWide && permissions.includes(companyWide)) return { ...access, permissions, branch };
  if (!permissions.includes(permission)) throw permissionDenied(permission);
  if (!(await canWorkInBranch(db, access.member, branch.id))) throw branchNotAllowed();
  return { ...access, permissions, branch };
}
