/**
 * Workspaces are the department-scoped operating environments of CORE.
 * A CORE deployment serves exactly one company; there is no company switching.
 *
 * `executive` is read-oriented oversight across departments.
 * `admin` manages configuration (users, roles, workflows) — it is not a business department.
 */
export const WORKSPACES = [
  'executive',
  'sales',
  'warehouse',
  'purchasing',
  'operations',
  'accounting',
  'admin',
] as const;

export type WorkspaceCode = (typeof WORKSPACES)[number];

export function isWorkspaceCode(value: string): value is WorkspaceCode {
  return (WORKSPACES as readonly string[]).includes(value);
}
