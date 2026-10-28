import type { AuthContext } from '../auth/sessions.js';
import {
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
