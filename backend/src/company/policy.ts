import { DEPARTMENT_CODES, type DepartmentCode } from '../billing/catalog.js';
import type { CompanyRole } from '../generated/prisma/enums.js';

/*
 * Company role policy (EP25) — what each customer role may do in the Company
 * Control Center. The server reads this table on every request; the browser
 * only receives the result (to decide what to show), never the authority.
 *
 * - COMPANY_OWNER: everything, including System Admins. Cannot be demoted,
 *   deactivated or replaced here (ownership transfer is a future, separate flow).
 * - SYSTEM_ADMIN: normal company administration (profile, branches, users,
 *   invitations, departments, settings) — but never the owner, never another
 *   System Admin, never ownership, never anything at platform level.
 * - EXECUTIVE: a business role. Broad read access (people, package), no
 *   configuration rights. Not a System Admin and not a platform role.
 * - DEPARTMENT_MANAGER / DEPARTMENT_STAFF / VIEWER: the company overview and
 *   the way into CORE. No administration (deeper department rules: EP27).
 */

export const COMPANY_CAPABILITIES = [
  /** Overview, company profile (read), branches (read), departments (read). */
  'company.view',
  'profile.edit',
  'branches.manage',
  /** The people list and open invitations. */
  'members.view',
  /** Invite, change role / job title / departments, deactivate / reactivate. */
  'members.manage',
  'departments.manage',
  /** Package, status, price and entitlements. */
  'subscription.view',
  /** Company activity and members' security events. */
  'activity.view',
  'settings.manage',
] as const;
export type CompanyCapability = (typeof COMPANY_CAPABILITIES)[number];

const ADMIN: readonly CompanyCapability[] = COMPANY_CAPABILITIES;

export const ROLE_CAPABILITIES: Readonly<Record<CompanyRole, readonly CompanyCapability[]>> = {
  COMPANY_OWNER: ADMIN,
  SYSTEM_ADMIN: ADMIN,
  EXECUTIVE: ['company.view', 'members.view', 'subscription.view'],
  DEPARTMENT_MANAGER: ['company.view'],
  DEPARTMENT_STAFF: ['company.view'],
  VIEWER: ['company.view'],
};

export const can = (role: CompanyRole, capability: CompanyCapability) =>
  ROLE_CAPABILITIES[role].includes(capability);

/**
 * Roles an administrator may give — by invitation or by a role change.
 * COMPANY_OWNER is never given here; a System Admin cannot create its peers.
 */
export const ASSIGNABLE_ROLES: Readonly<Record<CompanyRole, readonly CompanyRole[]>> = {
  COMPANY_OWNER: ['SYSTEM_ADMIN', 'EXECUTIVE', 'DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER'],
  SYSTEM_ADMIN: ['EXECUTIVE', 'DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER'],
  EXECUTIVE: [],
  DEPARTMENT_MANAGER: [],
  DEPARTMENT_STAFF: [],
  VIEWER: [],
};

export type MemberChangeProblem = 'OWNER_PROTECTED' | 'SELF_CHANGE' | 'PEER_ADMIN';

/**
 * May `actor` change `target` (role, status, job title, departments)? The
 * owner is untouchable; nobody edits their own access (no self-escalation, no
 * lock-out); a System Admin leaves other System Admins to the owner.
 */
export function memberChangeProblem(
  actor: { memberId: string; role: CompanyRole },
  target: { id: string; role: CompanyRole },
): MemberChangeProblem | null {
  if (target.role === 'COMPANY_OWNER') return 'OWNER_PROTECTED';
  if (target.id === actor.memberId) return 'SELF_CHANGE';
  if (actor.role === 'SYSTEM_ADMIN' && target.role === 'SYSTEM_ADMIN') return 'PEER_ADMIN';
  return null;
}

/**
 * The departments a member may enter in CORE Operations: always within the
 * departments the company has enabled. The owner reaches every enabled
 * department; an Executive the Executive department; everyone else (System
 * Admin included — administration is not operations) exactly the departments
 * assigned to them.
 */
export function departmentAccess(
  role: CompanyRole,
  enabled: readonly DepartmentCode[],
  assigned: readonly DepartmentCode[],
): DepartmentCode[] {
  const allowed = new Set<DepartmentCode>(assigned);
  if (role === 'EXECUTIVE') allowed.add('EXECUTIVE');
  return DEPARTMENT_CODES.filter(
    (code) => enabled.includes(code) && (role === 'COMPANY_OWNER' || allowed.has(code)),
  );
}
