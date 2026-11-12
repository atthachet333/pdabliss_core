import type { DepartmentCode } from '../billing/catalog.js';
import type { CompanyRole } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import { takesDepartment } from '../permissions/catalog.js';

/*
 * EP45 single-department policy — the administration-side checks
 * (docs/EP45_DEPARTMENT_POLICY.md). The database enforces the same rules
 * (Membership unique per person and company, composite company keys, role
 * guard triggers, the invitation CHECK); these turn them into clear 4xx
 * answers before anything is written, and the resolver fails closed if a row
 * ever got past both.
 *
 *   Manager / Staff / Viewer   zero or ONE department (zero = no operational access)
 *   Owner                      none: explicit cross-department authority by role
 *   System Admin               none: administration only
 *   Executive                  none: read-only oversight by role
 */

export const oneDepartmentOnly = (departments: readonly DepartmentCode[]) =>
  new AppError(422, 'ONE_DEPARTMENT_ONLY', 'A person belongs to one department. Choose one.', {
    departments,
  });

export const roleTakesNoDepartment = (role: CompanyRole) =>
  new AppError(
    422,
    'ROLE_TAKES_NO_DEPARTMENT',
    'Owners, System Admins and Executives are not assigned to a department.',
    { role },
  );

export const roleDepartmentConflict = (role: CompanyRole) =>
  new AppError(
    409,
    'ROLE_DEPARTMENT_CONFLICT',
    'Remove the department assignment before giving this role.',
    { role },
  );

/** Throws unless `departments` is a valid department intent for `role` (invitation or assignment). */
export function assertDepartmentIntent(role: CompanyRole, departments: readonly DepartmentCode[]) {
  if (departments.length > 1) throw oneDepartmentOnly(departments);
  if (departments.length && !takesDepartment(role)) throw roleTakesNoDepartment(role);
}

/**
 * Database refusals of an assignment write, as API errors: the unique index
 * (a concurrent second assignment) and the role guard triggers. Anything else
 * is rethrown unchanged.
 */
export function assignmentConflict(e: unknown, role: CompanyRole): never {
  const text = JSON.stringify(e, Object.getOwnPropertyNames(e ?? {})) + String(e);
  if (/Membership_userId_companyId_key|P2002/.test(text)) {
    throw new AppError(409, 'MEMBER_CHANGED', 'This member changed meanwhile.');
  }
  // The guard triggers (check_violation, raised with their own constraint names and messages).
  if (
    /_department_role_check|holds no department assignment|remove the department assignment/.test(
      text,
    )
  ) {
    throw roleDepartmentConflict(role);
  }
  throw e;
}
