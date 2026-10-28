import { DEPARTMENT_CODES, type DepartmentCode } from '../billing/catalog.js';
import type { Db, Prisma } from '../db/client.js';
import type { CompanyMember, Subscription } from '../generated/prisma/client.js';
import type { CompanyRole, PermissionEffect } from '../generated/prisma/enums.js';
import { readSnapshot } from '../company/entitlements.js';
import {
  isPermissionCode,
  isRoleDefault,
  PERMISSION_CATALOG,
  ROLE_OPERATIONAL_PROFILE,
  workspacePermission,
  type PermissionCode,
} from './catalog.js';

/*
 * The effective-permission resolver (EP27) — the only place that decides
 * whether a member holds an action. Pure: callers load the inputs once per
 * request (loadPermissionInputs) and nothing is cached, so a change of role,
 * department, override, membership or package takes effect on the very next
 * request of every session.
 *
 * For an operational permission (department D), in this order:
 *   1. D disabled for the company            → no (override kept, inactive)
 *   2. D not in the package (Executive)      → no — entitlements are upstream
 *   3. explicit DENY                         → no (DENY beats every ALLOW)
 *   4. explicit ALLOW                        → yes, if the member is in D
 *                                              (assigned, or the owner)
 *   5. role default                          → yes, if the role's profile
 *                                              covers the tier and, where the
 *                                              role requires it, D is assigned
 * Company administration permissions come from the role alone; overrides
 * never apply to them, and the owner ignores overrides altogether.
 * Branch-scoped permissions still need a valid selected branch: the
 * resolver says WHAT a member may do; branch access says WHERE.
 */

export interface PermissionInputs {
  role: CompanyRole;
  active: boolean;
  enabled: readonly DepartmentCode[];
  assigned: readonly DepartmentCode[];
  executiveAllowed: boolean;
  overrides: readonly { permission: string; effect: PermissionEffect }[];
}

export type PermissionSource =
  'INVARIANT' | 'ROLE_DEFAULT' | 'ALLOW_OVERRIDE' | 'DENY_OVERRIDE' | 'NONE';

export type PermissionBlock = 'DEPARTMENT_DISABLED' | 'NOT_IN_PACKAGE' | 'NOT_ASSIGNED';

export interface PermissionState {
  code: PermissionCode;
  effective: boolean;
  /** Part of the role's default profile (before department eligibility). */
  roleDefault: boolean;
  override: PermissionEffect | null;
  source: PermissionSource;
  /** Why a default or ALLOW does not take effect (department level). */
  blocked: PermissionBlock | null;
}

export function resolvePermissions(i: PermissionInputs): PermissionState[] {
  const owner = i.role === 'COMPANY_OWNER';
  const overrides = new Map<string, PermissionEffect>();
  if (!owner)
    for (const o of i.overrides)
      if (isPermissionCode(o.permission)) overrides.set(o.permission, o.effect);
  const profile = ROLE_OPERATIONAL_PROFILE[i.role];

  return PERMISSION_CATALOG.map(({ code, namespace }): PermissionState => {
    const roleDefault = isRoleDefault(i.role, code);
    if (!i.active) {
      return { code, effective: false, roleDefault, override: null, source: 'NONE', blocked: null };
    }
    if (namespace === 'COMPANY_ADMIN') {
      return {
        code,
        effective: roleDefault,
        roleDefault,
        override: null,
        source: roleDefault ? (owner ? 'INVARIANT' : 'ROLE_DEFAULT') : 'NONE',
        blocked: null,
      };
    }
    const override = overrides.get(code) ?? null;
    const dept: DepartmentCode = namespace;
    const blocked: PermissionBlock | null = !i.enabled.includes(dept)
      ? 'DEPARTMENT_DISABLED'
      : dept === 'EXECUTIVE' && !i.executiveAllowed
        ? 'NOT_IN_PACKAGE'
        : null;
    const assigned = i.assigned.includes(dept);
    if (blocked) {
      return {
        code,
        effective: false,
        roleDefault,
        override,
        source:
          override === 'DENY'
            ? 'DENY_OVERRIDE'
            : override === 'ALLOW'
              ? 'ALLOW_OVERRIDE'
              : roleDefault
                ? 'ROLE_DEFAULT'
                : 'NONE',
        blocked,
      };
    }
    if (override === 'DENY') {
      return {
        code,
        effective: false,
        roleDefault,
        override,
        source: 'DENY_OVERRIDE',
        blocked: null,
      };
    }
    if (override === 'ALLOW') {
      const inDept = owner || assigned;
      return {
        code,
        effective: inDept,
        roleDefault,
        override,
        source: 'ALLOW_OVERRIDE',
        blocked: inDept ? null : 'NOT_ASSIGNED',
      };
    }
    if (!roleDefault) {
      return { code, effective: false, roleDefault, override, source: 'NONE', blocked: null };
    }
    const eligible = !profile.requiresAssignment || assigned;
    return {
      code,
      effective: eligible,
      roleDefault,
      override,
      source: owner ? 'INVARIANT' : 'ROLE_DEFAULT',
      blocked: eligible ? null : 'NOT_ASSIGNED',
    };
  });
}

/** The codes a member holds now. */
export const effectivePermissions = (i: PermissionInputs): PermissionCode[] =>
  resolvePermissions(i)
    .filter((s) => s.effective)
    .map((s) => s.code);

/** Departments a member may open in CORE: those whose workspace they may view. */
export const workspaceDepartments = (codes: readonly PermissionCode[]): DepartmentCode[] =>
  DEPARTMENT_CODES.filter((d) => codes.includes(workspacePermission(d)));

type Tx = Db | Prisma.TransactionClient;

/** Everything the resolver needs for one membership, read in one round of queries. */
export async function loadPermissionInputs(
  db: Tx,
  member: Pick<CompanyMember, 'id' | 'companyId' | 'userId' | 'role' | 'status'>,
  subscription: Pick<Subscription, 'entitlements' | 'plan'> | null,
): Promise<PermissionInputs> {
  const [departments, assignments, overrides] = await Promise.all([
    db.department.findMany({
      where: { companyId: member.companyId, isActive: true },
      select: { code: true },
    }),
    db.membership.findMany({
      where: { userId: member.userId, department: { companyId: member.companyId } },
      select: { department: { select: { code: true } } },
    }),
    db.memberPermissionOverride.findMany({
      where: { memberId: member.id, companyId: member.companyId },
      select: { permission: true, effect: true },
    }),
  ]);
  return {
    role: member.role,
    active: member.status === 'ACTIVE',
    enabled: departments.map((d) => d.code),
    assigned: assignments.map((a) => a.department.code),
    executiveAllowed: subscription
      ? readSnapshot(subscription.entitlements, subscription.plan).executiveAllowed
      : false,
    overrides,
  };
}
