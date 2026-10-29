import type { DepartmentCode } from '../billing/catalog.js';
import type { CompanyRole } from '../generated/prisma/enums.js';

/*
 * The CORE permission catalog (EP27) — the one list of actions customer
 * companies can be authorized for. Codes are `<namespace>.<resource>.<action>`;
 * every module, route, test and screen uses these constants, never a free
 * string. Platform authority is NOT here: platform roles are a separate
 * system and no customer permission can reach it.
 *
 *   namespace  COMPANY_ADMIN (Company Control Center) or one of the six
 *              operational departments
 *   scope      COMPANY (company-wide) or BRANCH (only inside the selected,
 *              permitted branch — a permission never grants branch access)
 *   tier       READ    view only
 *              OPERATE day-to-day work: create, edit, process
 *              MANAGE  approve, cancel, update status, manage
 *
 * Action vocabulary: view · create · edit · approve · cancel · delete · export
 * · manage, plus two domain actions with their own meaning: `process`
 * (receiving goods) and `update_status` (move a record's status). `delete`
 * never implies a hard delete; business records will cancel / void / archive.
 *
 * Warehouse holds no financial action or resource (cost, purchase price,
 * margin, payment amounts, supplier terms, financial reporting) — those
 * belong to Purchasing / Accounting / Executive.
 *
 * EP28 operational master data. Canonical records (customers, suppliers,
 * items with their units and categories) are COMPANY-scoped: one record for
 * the whole company, read through the department that needs it
 * (`<dept>.<resource>.view`, READ tier) and maintained by the department that
 * owns it (`.manage`, MANAGE tier — Managers, never Staff or Viewers by
 * default). Warehouse locations are BRANCH-scoped and also need branch
 * access. `company.master_data.manage` is the company administration
 * authority over all of it (Owner and System Admin, every branch).
 *
 * EP29 purchase requests. A request is raised FROM a department and decided
 * by Purchasing or by the originating department's manager:
 *   purchasing.requests.view     the Purchasing queue (every non-draft request
 *                                in the member's branches)
 *   purchasing.requests.create   raise / edit / submit / cancel own requests
 *                                from Purchasing (submit is part of create)
 *   purchasing.requests.approve  decide any request: approve OR reject
 *   purchasing.requests.cancel   cancel an approved request
 *   <dept>.purchase_requests.create   raise own requests from that department
 *   <dept>.purchase_requests.approve  decide (and see) that department's requests
 * No `submit` / `reject` actions: they are the create and approve tiers.
 */

export const PERMISSION_NAMESPACES = [
  'COMPANY_ADMIN',
  'SALES',
  'OPERATIONS',
  'WAREHOUSE',
  'PURCHASING',
  'ACCOUNTING',
  'EXECUTIVE',
] as const;
export type PermissionNamespace = (typeof PERMISSION_NAMESPACES)[number];

export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'edit',
  'approve',
  'cancel',
  'delete',
  'export',
  'manage',
  'process',
  'update_status',
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type PermissionScope = 'COMPANY' | 'BRANCH';
export type PermissionTier = 'READ' | 'OPERATE' | 'MANAGE';

export interface PermissionDefinition {
  code: string;
  namespace: PermissionNamespace;
  /** `<namespace>.<resource>` — the grouping key on screens. */
  resource: string;
  action: PermissionAction;
  scope: PermissionScope;
  tier: PermissionTier;
}

const TIER: Record<PermissionAction, PermissionTier> = {
  view: 'READ',
  export: 'MANAGE',
  create: 'OPERATE',
  edit: 'OPERATE',
  process: 'OPERATE',
  approve: 'MANAGE',
  cancel: 'MANAGE',
  delete: 'MANAGE',
  manage: 'MANAGE',
  update_status: 'MANAGE',
};

const def = <C extends string>(
  code: C,
  namespace: PermissionNamespace,
  scope: PermissionScope,
): PermissionDefinition & { code: C } => {
  const [ns, resource, action] = code.split('.') as [string, string, PermissionAction];
  return {
    code,
    namespace,
    resource: `${ns}.${resource}`,
    action,
    scope,
    tier: TIER[action],
  };
};

const A = 'COMPANY_ADMIN';
export const PERMISSION_CATALOG = [
  // ---- Company Control Center (role-bound; not an operational department)
  def('company.profile.view', A, 'COMPANY'),
  def('company.profile.edit', A, 'COMPANY'),
  def('company.branches.view', A, 'COMPANY'),
  def('company.branches.manage', A, 'COMPANY'),
  def('company.members.view', A, 'COMPANY'),
  def('company.members.manage', A, 'COMPANY'),
  def('company.departments.manage', A, 'COMPANY'),
  def('company.permissions.view', A, 'COMPANY'),
  def('company.permissions.manage', A, 'COMPANY'),
  def('company.subscription.view', A, 'COMPANY'),
  def('company.activity.view', A, 'COMPANY'),
  def('company.settings.manage', A, 'COMPANY'),
  def('company.master_data.manage', A, 'COMPANY'),
  // ---- Sales
  def('sales.workspace.view', 'SALES', 'BRANCH'),
  def('sales.orders.view', 'SALES', 'BRANCH'),
  def('sales.orders.create', 'SALES', 'BRANCH'),
  def('sales.orders.edit', 'SALES', 'BRANCH'),
  def('sales.orders.approve', 'SALES', 'BRANCH'),
  def('sales.orders.cancel', 'SALES', 'BRANCH'),
  def('sales.customers.view', 'SALES', 'COMPANY'),
  def('sales.customers.manage', 'SALES', 'COMPANY'),
  def('sales.items.view', 'SALES', 'COMPANY'),
  def('sales.purchase_requests.create', 'SALES', 'BRANCH'),
  def('sales.purchase_requests.approve', 'SALES', 'BRANCH'),
  // ---- Operations
  def('operations.workspace.view', 'OPERATIONS', 'BRANCH'),
  def('operations.orders.view', 'OPERATIONS', 'BRANCH'),
  def('operations.orders.create', 'OPERATIONS', 'BRANCH'),
  def('operations.orders.edit', 'OPERATIONS', 'BRANCH'),
  def('operations.orders.update_status', 'OPERATIONS', 'BRANCH'),
  def('operations.items.view', 'OPERATIONS', 'COMPANY'),
  def('operations.items.manage', 'OPERATIONS', 'COMPANY'),
  def('operations.purchase_requests.create', 'OPERATIONS', 'BRANCH'),
  def('operations.purchase_requests.approve', 'OPERATIONS', 'BRANCH'),
  // ---- Warehouse (operational data only — never financial)
  def('warehouse.workspace.view', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.inventory.view', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.receiving.view', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.receiving.process', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.stock_adjustment.create', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.stock_adjustment.approve', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.items.view', 'WAREHOUSE', 'COMPANY'),
  def('warehouse.locations.view', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.locations.manage', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.purchase_requests.create', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.purchase_requests.approve', 'WAREHOUSE', 'BRANCH'),
  // ---- Purchasing
  def('purchasing.workspace.view', 'PURCHASING', 'BRANCH'),
  def('purchasing.requests.view', 'PURCHASING', 'BRANCH'),
  def('purchasing.requests.create', 'PURCHASING', 'BRANCH'),
  def('purchasing.requests.approve', 'PURCHASING', 'BRANCH'),
  def('purchasing.orders.view', 'PURCHASING', 'BRANCH'),
  def('purchasing.orders.create', 'PURCHASING', 'BRANCH'),
  def('purchasing.orders.approve', 'PURCHASING', 'BRANCH'),
  def('purchasing.suppliers.view', 'PURCHASING', 'COMPANY'),
  def('purchasing.suppliers.manage', 'PURCHASING', 'COMPANY'),
  def('purchasing.items.view', 'PURCHASING', 'COMPANY'),
  def('purchasing.requests.cancel', 'PURCHASING', 'BRANCH'),
  // ---- Accounting
  def('accounting.workspace.view', 'ACCOUNTING', 'BRANCH'),
  def('accounting.payments.view', 'ACCOUNTING', 'BRANCH'),
  def('accounting.payments.update_status', 'ACCOUNTING', 'BRANCH'),
  def('accounting.documents.view', 'ACCOUNTING', 'BRANCH'),
  def('accounting.customers.view', 'ACCOUNTING', 'COMPANY'),
  def('accounting.suppliers.view', 'ACCOUNTING', 'COMPANY'),
  def('accounting.purchase_requests.create', 'ACCOUNTING', 'BRANCH'),
  def('accounting.purchase_requests.approve', 'ACCOUNTING', 'BRANCH'),
  // ---- Executive
  def('executive.workspace.view', 'EXECUTIVE', 'BRANCH'),
  def('executive.overview.view', 'EXECUTIVE', 'BRANCH'),
] as const;

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]['code'];
export type AdminPermission = Extract<PermissionCode, `company.${string}`>;
export type OperationalPermission = Exclude<PermissionCode, AdminPermission>;

const BY_CODE = new Map<string, PermissionDefinition>(PERMISSION_CATALOG.map((p) => [p.code, p]));

export const isPermissionCode = (v: unknown): v is PermissionCode =>
  typeof v === 'string' && BY_CODE.has(v);

export const permissionDefinition = (code: PermissionCode) => BY_CODE.get(code)!;

/** Operational permissions belong to a department; Company Control Center ones do not. */
export const departmentOf = (code: PermissionCode): DepartmentCode | null => {
  const ns = permissionDefinition(code).namespace;
  return ns === 'COMPANY_ADMIN' ? null : ns;
};

export const ADMIN_PERMISSIONS = PERMISSION_CATALOG.filter(
  (p) => p.namespace === 'COMPANY_ADMIN',
).map((p) => p.code) as AdminPermission[];

/**
 * Only operational permissions take per-member exceptions. Company
 * administration follows the role (owner / System Admin protections, no
 * self-escalation) and cannot be granted or removed by an override.
 */
export const OVERRIDABLE_PERMISSIONS = PERMISSION_CATALOG.filter(
  (p) => p.namespace !== 'COMPANY_ADMIN',
).map((p) => p.code) as OperationalPermission[];

/** `<dept>.workspace.view` — the way into a department in CORE. */
export const workspacePermission = (department: DepartmentCode) =>
  `${department.toLowerCase()}.workspace.view` as OperationalPermission;

// ------------------------------------------------------------- role defaults

/**
 * Company administration by role. Owner and System Admin administer the
 * company; the System Admin's limits on people (owner, peers, ownership) are
 * hard invariants in policy.ts, not permissions.
 */
export const ROLE_ADMIN_PERMISSIONS: Readonly<Record<CompanyRole, readonly AdminPermission[]>> = {
  COMPANY_OWNER: ADMIN_PERMISSIONS,
  SYSTEM_ADMIN: ADMIN_PERMISSIONS,
  EXECUTIVE: [
    'company.profile.view',
    'company.branches.view',
    'company.members.view',
    'company.subscription.view',
  ],
  DEPARTMENT_MANAGER: ['company.profile.view', 'company.branches.view'],
  DEPARTMENT_STAFF: ['company.profile.view', 'company.branches.view'],
  VIEWER: ['company.profile.view', 'company.branches.view'],
};

/**
 * Operational defaults: which tiers a role holds in a department, and whether
 * the person must be assigned to it.
 *
 *   COMPANY_OWNER       every tier, every enabled department, no assignment needed
 *   SYSTEM_ADMIN        READ + OPERATE in assigned departments (administration is not operations)
 *   EXECUTIVE           READ in every enabled department (cross-functional view), nothing more
 *   DEPARTMENT_MANAGER  READ + OPERATE + MANAGE in assigned departments
 *   DEPARTMENT_STAFF    READ + OPERATE in assigned departments
 *   VIEWER              READ in assigned departments
 */
export interface OperationalProfile {
  tiers: readonly PermissionTier[];
  /** True: only departments the member is assigned to. */
  requiresAssignment: boolean;
}

export const ROLE_OPERATIONAL_PROFILE: Readonly<Record<CompanyRole, OperationalProfile>> = {
  COMPANY_OWNER: { tiers: ['READ', 'OPERATE', 'MANAGE'], requiresAssignment: false },
  SYSTEM_ADMIN: { tiers: ['READ', 'OPERATE'], requiresAssignment: true },
  EXECUTIVE: { tiers: ['READ'], requiresAssignment: false },
  DEPARTMENT_MANAGER: { tiers: ['READ', 'OPERATE', 'MANAGE'], requiresAssignment: true },
  DEPARTMENT_STAFF: { tiers: ['READ', 'OPERATE'], requiresAssignment: true },
  VIEWER: { tiers: ['READ'], requiresAssignment: true },
};

/** Is `code` part of this role's default profile (before department eligibility)? */
export function isRoleDefault(role: CompanyRole, code: PermissionCode): boolean {
  const p = permissionDefinition(code);
  if (p.namespace === 'COMPANY_ADMIN') {
    return (ROLE_ADMIN_PERMISSIONS[role] as readonly string[]).includes(code);
  }
  return ROLE_OPERATIONAL_PROFILE[role].tiers.includes(p.tier);
}
