import type { CompanyRole } from '../generated/prisma/enums.js';
import { ROLE_ADMIN_PERMISSIONS, type AdminPermission } from '../permissions/catalog.js';

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
 *   the way into CORE. No administration.
 *
 * EP27: what each role may DO (administration and department actions) is the
 * permission catalog in src/permissions/; this file keeps the hard invariants.
 */

/**
 * Company-administration permission check (EP27: codes from the canonical
 * catalog, granted by role — see ROLE_ADMIN_PERMISSIONS). The hard invariants
 * below (owner protection, peers, ownership) apply on top and no permission
 * can lift them.
 */
export const can = (role: CompanyRole, permission: AdminPermission) =>
  ROLE_ADMIN_PERMISSIONS[role].includes(permission);

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
