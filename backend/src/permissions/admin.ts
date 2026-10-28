import { z } from 'zod';
import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import { recordCompanyEvent } from '../company/audit.js';
import { requireCompanyAccess, type CompanyAccess } from '../company/context.js';
import { MEMBER_PROBLEM_MESSAGES } from '../company/control.js';
import { memberChangeProblem } from '../company/policy.js';
import type { Db } from '../db/client.js';
import type { CompanyRole } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import {
  departmentOf,
  OVERRIDABLE_PERMISSIONS,
  PERMISSION_CATALOG,
  ROLE_ADMIN_PERMISSIONS,
  ROLE_OPERATIONAL_PROFILE,
  isPermissionCode,
  type OperationalPermission,
} from './catalog.js';
import { loadPermissionInputs, resolvePermissions } from './resolver.js';

/*
 * Permission administration (EP27) — /company/permissions.
 *
 *   Role profiles   the code-defined defaults, read only (customers never
 *                   edit the global definitions)
 *   Member view     one member's effective permissions with their source
 *                   (role default · allowed / denied exception · invariant)
 *                   and why a default does not apply (department disabled,
 *                   not in the package, not assigned)
 *   Exceptions      ALLOW / DENY of operational permissions, several in one
 *                   transaction; the final state is returned
 *
 * Only Owner and System Admin hold company.permissions.view / .manage. The
 * member protections of policy.ts apply unchanged: nobody changes the owner,
 * themselves, or (as a System Admin) another System Admin. Company
 * administration permissions are role-bound and cannot be overridden, so an
 * exception can never create administrators, owners or platform authority.
 */

export const PermissionChangesBody = z
  .object({
    changes: z
      .array(
        z
          .object({
            permission: z.string().trim().min(1).max(80),
            /** null removes the exception (back to the role default). */
            effect: z.enum(['ALLOW', 'DENY']).nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const c of v.changes) {
      if (seen.has(c.permission)) {
        ctx.addIssue({ code: 'custom', path: ['changes'], message: 'duplicate permission' });
      }
      seen.add(c.permission);
    }
  });
export type PermissionChangesInput = z.output<typeof PermissionChangesBody>;

const notFound = () => new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found.');

export class PermissionAdminService {
  constructor(private readonly db: Db) {}

  /** The catalog and the role defaults, for administrators to read. */
  async profiles(ctx: AuthContext) {
    const access = await requireCompanyAccess(this.db, ctx, {
      permission: 'company.permissions.view',
    });
    const inputs = await loadPermissionInputs(this.db, access.member, access.subscription);
    return {
      catalog: PERMISSION_CATALOG.map((p) => ({
        code: p.code,
        namespace: p.namespace,
        resource: p.resource,
        action: p.action,
        scope: p.scope,
        tier: p.tier,
        overridable: p.namespace !== 'COMPANY_ADMIN',
      })),
      roles: (Object.keys(ROLE_OPERATIONAL_PROFILE) as CompanyRole[]).map((role) => ({
        role,
        admin: ROLE_ADMIN_PERMISSIONS[role],
        operational: ROLE_OPERATIONAL_PROFILE[role],
      })),
      enabledDepartments: inputs.enabled,
      executiveAllowed: inputs.executiveAllowed,
      canManage: access.adminPermissions.includes('company.permissions.manage'),
    };
  }

  /** One member's effective permissions, sources and exceptions. */
  async member(ctx: AuthContext, memberId: string) {
    const access = await requireCompanyAccess(this.db, ctx, {
      permission: 'company.permissions.view',
    });
    return this.view(access, memberId);
  }

  private async view(access: CompanyAccess, memberId: string) {
    const target = await this.db.companyMember.findFirst({
      where: { id: memberId, companyId: access.company.id },
      include: { user: { select: { email: true, fullName: true } } },
    });
    if (!target) throw notFound();
    const inputs = await loadPermissionInputs(this.db, target, access.subscription);
    const manage = access.adminPermissions.includes('company.permissions.manage');
    const protection = manage ? memberChangeProblem(access.actor, target) : null;
    return {
      member: {
        id: target.id,
        fullName: target.user.fullName,
        email: target.user.email,
        role: target.role,
        status: target.status,
        isOwner: target.role === 'COMPANY_OWNER',
        isSelf: target.id === access.actor.memberId,
      },
      assignedDepartments: inputs.assigned,
      enabledDepartments: inputs.enabled,
      executiveAllowed: inputs.executiveAllowed,
      permissions: resolvePermissions(inputs),
      protection,
      canManage: manage && protection === null,
    };
  }

  /**
   * Adds, changes or removes exceptions — all or nothing — and returns the
   * member's resulting state. Unknown codes and administration permissions
   * are refused; an ALLOW must fall inside a department the member can be in
   * (enabled, in the package, assigned — or the owner, who has no exceptions).
   */
  async setOverrides(
    ctx: AuthContext,
    memberId: string,
    input: PermissionChangesInput,
    meta: RequestMeta,
  ) {
    const access = await requireCompanyAccess(this.db, ctx, {
      permission: 'company.permissions.manage',
    });
    const target = await this.db.companyMember.findFirst({
      where: { id: memberId, companyId: access.company.id },
      include: { user: { select: { email: true } } },
    });
    if (!target) throw notFound();
    const problem = memberChangeProblem(access.actor, target);
    if (problem) throw new AppError(403, problem, MEMBER_PROBLEM_MESSAGES[problem]);

    for (const c of input.changes) {
      if (!isPermissionCode(c.permission)) {
        throw new AppError(422, 'PERMISSION_UNKNOWN', 'This permission does not exist.', {
          permission: c.permission,
        });
      }
      if (!(OVERRIDABLE_PERMISSIONS as readonly string[]).includes(c.permission)) {
        throw new AppError(
          422,
          'PERMISSION_NOT_OVERRIDABLE',
          'Company administration follows the role and cannot be changed per member.',
          { permission: c.permission },
        );
      }
    }
    const inputs = await loadPermissionInputs(this.db, target, access.subscription);
    for (const c of input.changes) {
      if (c.effect !== 'ALLOW') continue;
      const dept = departmentOf(c.permission as OperationalPermission)!;
      const reason = !inputs.enabled.includes(dept)
        ? 'DEPARTMENT_DISABLED'
        : dept === 'EXECUTIVE' && !inputs.executiveAllowed
          ? 'NOT_IN_PACKAGE'
          : !inputs.assigned.includes(dept)
            ? 'NOT_ASSIGNED'
            : null;
      if (reason) {
        throw new AppError(
          422,
          'PERMISSION_NOT_ELIGIBLE',
          'This person cannot hold this permission (department not enabled, not in the package, or not assigned).',
          { permission: c.permission, reason },
        );
      }
    }

    await this.db.$transaction(async (tx) => {
      // Serialize concurrent edits of the same member.
      await tx.$queryRaw`SELECT id FROM "CompanyMember" WHERE id = ${target.id} FOR UPDATE`;
      const existing = await tx.memberPermissionOverride.findMany({
        where: { memberId: target.id, companyId: access.company.id },
      });
      for (const c of input.changes) {
        const before = existing.find((e) => e.permission === c.permission)?.effect ?? null;
        if (before === c.effect) continue;
        if (c.effect === null) {
          await tx.memberPermissionOverride.delete({
            where: { memberId_permission: { memberId: target.id, permission: c.permission } },
          });
        } else {
          await tx.memberPermissionOverride.upsert({
            where: { memberId_permission: { memberId: target.id, permission: c.permission } },
            create: {
              companyId: access.company.id,
              memberId: target.id,
              permission: c.permission,
              effect: c.effect,
              createdById: access.actor.userId,
              updatedById: access.actor.userId,
            },
            update: { effect: c.effect, updatedById: access.actor.userId },
          });
        }
        await recordCompanyEvent(tx, meta, {
          action:
            before === null
              ? 'MEMBER_PERMISSION_OVERRIDE_ADDED'
              : c.effect === null
                ? 'MEMBER_PERMISSION_OVERRIDE_REMOVED'
                : 'MEMBER_PERMISSION_OVERRIDE_CHANGED',
          actorId: access.actor.userId,
          actorScope: 'customer',
          companyId: access.company.id,
          entityType: 'CompanyMember',
          entityId: target.id,
          details: {
            member: target.user.email,
            permission: c.permission,
            from: before,
            to: c.effect,
          },
        });
      }
    });
    return this.view(access, target.id);
  }
}
