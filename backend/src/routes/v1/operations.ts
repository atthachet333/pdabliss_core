import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DEPARTMENT_CODES } from '../../billing/catalog.js';
import { requireAuth, requireSession } from '../../auth/http.js';
import { requireOperationsContext } from '../../company/context.js';
import type { Db } from '../../db/client.js';
import { AppError } from '../../lib/errors.js';
import { parseInput } from '../../lib/validation.js';
import {
  departmentOf,
  isPermissionCode,
  OVERRIDABLE_PERMISSIONS,
  workspacePermission,
  type OperationalPermission,
} from '../../permissions/catalog.js';
import { requirePermission } from '../../permissions/guard.js';

/*
 * /api/v1/operations — CORE Operations.
 *
 * EP25: the operations context. EP27: every operational route goes through
 * requirePermission(db, auth, '<department>.<resource>.<action>') — active
 * membership, eligible company, a selected branch the member may work in,
 * and the effective permission (role default, department + package
 * eligibility, exceptions with DENY first). No department workflow exists
 * yet; these routes are the gate the module episodes build on.
 */

const DepartmentParams = z.object({
  department: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(DEPARTMENT_CODES)),
});
const AuthorizeQuery = z.object({ permission: z.string().trim().min(1).max(80) }).strict();

export const operationsRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);

  app.get('/context', async (request) => requireOperationsContext(db, requireAuth(request)));

  /** The way into one department workspace (placeholder until its module exists). */
  app.get('/workspaces/:department', async (request) => {
    const { department } = parseInput(DepartmentParams, request.params);
    const op = await requirePermission(db, requireAuth(request), workspacePermission(department));
    return {
      department,
      branch: op.branch,
      permissions: op.permissions.filter(
        (p) => departmentOf(p as OperationalPermission) === department,
      ),
    };
  });

  /** "May I do this here?" — one operational permission in the current branch context. */
  app.get('/authorize', async (request) => {
    const { permission } = parseInput(AuthorizeQuery, request.query);
    if (
      !isPermissionCode(permission) ||
      !(OVERRIDABLE_PERMISSIONS as readonly string[]).includes(permission)
    ) {
      throw new AppError(422, 'PERMISSION_UNKNOWN', 'This permission does not exist.', {
        permission,
      });
    }
    const op = await requirePermission(
      db,
      requireAuth(request),
      permission as OperationalPermission,
    );
    return { permission, allowed: true, branch: op.branch };
  });

  return Promise.resolve();
};
