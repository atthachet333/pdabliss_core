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
 * · manage, plus three domain actions with their own meaning: `process`
 * (receiving goods), `update_status` (move a record's status) and `confirm`
 * (confirm that money was paid or received — EP30 deposits). `delete`
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
 *
 * EP30 purchase orders, deposits and pending receive:
 *   purchasing.orders.view      read purchase orders (commercial view)
 *   purchasing.orders.create    create a DRAFT order from an approved request
 *   purchasing.orders.edit      edit / discard DRAFT orders (supplier, lines, prices, deposit)
 *   purchasing.orders.approve   ISSUE an order to the supplier (no separate `issue` action)
 *   purchasing.orders.cancel    cancel an issued order (reason required)
 *   accounting.deposits.view    supplier deposits of issued orders, with order amounts
 *   accounting.deposits.confirm confirm OR waive a required deposit (`confirm`: a
 *                               domain action like `process`)
 *   warehouse.receiving.view    orders pending receive — quantities only, never amounts
 *
 * EP31 goods receipts and inventory:
 *   warehouse.receiving.view     pending receive and goods receipts (quantities, lots, locations)
 *   warehouse.receiving.process  create, edit and POST a goods receipt (stock goes in)
 *   warehouse.receiving.cancel   cancel a POSTED receipt — its stock is reversed (MANAGE)
 *   warehouse.inventory.view     stock on hand, lots / expiry and the movement ledger
 *
 * EP32 inventory control (reads: warehouse.inventory.view):
 *   warehouse.transfers.create         create / edit / cancel a DRAFT transfer (OPERATE)
 *   warehouse.transfers.approve        POST a transfer — stock moves (MANAGE; no `post` action)
 *   warehouse.transfers.cancel         cancel a POSTED transfer — reversal (MANAGE)
 *   warehouse.stock_adjustment.create  draft / submit / cancel an adjustment (EP27 code, OPERATE)
 *   warehouse.stock_adjustment.approve approve (= post), reject, reverse (EP27 code, MANAGE)
 *   warehouse.counts.create            create, start, count, send to review, cancel (OPERATE)
 *   warehouse.counts.approve           post a reviewed count — corrections written (MANAGE)
 *
 * EP35 sales fulfilment (reads: warehouse.inventory.view):
 *   warehouse.picking.process   create / start / confirm / cancel picks, packs and shipments
 *                               (OPERATE — no stock moves before dispatch)
 *   warehouse.dispatch.confirm  dispatch a shipment — SALES_ISSUE, reservation consumed (MANAGE)
 *   warehouse.delivery.confirm  record delivery or a delivery exception (MANAGE)
 *
 * EP36 production planning — Production lives in the Operations department
 * (docs/PRODUCTION_ORDER.md, docs/PRODUCTION_BOM.md). Planning only: no code
 * here moves, reserves or creates stock.
 *   operations.orders.view       production orders, material requirements, sales demand (READ)
 *   operations.orders.create     draft, edit, submit and cancel own draft production orders
 *   operations.orders.approve    approve OR reject a submitted order; release it to READY (MANAGE)
 *   operations.orders.cancel     cancel an approved / ready order (MANAGE, reason required)
 *   operations.bom.view          BOM revisions (READ, company-wide)
 *   operations.bom.manage        draft, edit, activate, revise and retire BOMs (MANAGE)
 *   purchasing.production_shortages.view  read-only material shortages of approved
 *                                production orders — the Purchasing handoff (READ)
 *   operations.orders.edit stays reserved (editing a draft is part of create); update_status is used from EP38.
 *
 * EP37 material reservation, material issue and execution (Operations; reads: operations.orders.view):
 *   operations.materials.manage        reserve (FEFO), release, reallocate, authorize excess (MANAGE)
 *   operations.material_issues.create  draft, edit and cancel material issues (OPERATE)
 *   operations.material_issues.approve POST a material issue — stock leaves (MANAGE)
 *   operations.material_usage.create   record actual material usage — never a movement (OPERATE)
 *   operations.execution.manage        start, pause and resume production (MANAGE)
 *   warehouse.material_issues.view     the Warehouse read-only material issue handoff (READ)
 *
 * EP38 finished goods output, receipt and completion:
 *   operations.output.create           draft, edit, submit and cancel output reports (OPERATE)
 *   operations.output.approve          accept / reject output (quality decision), cancel accepted
 *                                      output not yet received (MANAGE)
 *   operations.orders.update_status    the EP27 code, now used: completion review, reopen,
 *                                      complete and short close (MANAGE)
 *   warehouse.finished_goods.view      pending finished goods and their receipts (READ)
 *   warehouse.finished_goods.process   draft, edit and cancel finished goods receipts (OPERATE)
 *   warehouse.finished_goods.confirm   POST a receipt (PRODUCTION_OUTPUT) or reverse a posted one (MANAGE)
 *
 * EP33 sales orders (EP27 codes, no new ones — backend/src/sales/policy.ts):
 *   sales.orders.view     read the branch's orders (a DRAFT only for its creator and confirmers)
 *   sales.orders.create   draft, edit, submit and discard own orders (submit is part of create)
 *   sales.orders.approve  CONFIRM a submitted order (no separate `confirm` code)
 *   sales.orders.cancel   cancel a submitted or confirmed order (reason required)
 *   sales.orders.edit     reserved (editing a draft is part of creating it)
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
  'confirm',
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
  confirm: 'MANAGE',
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
  def('operations.orders.approve', 'OPERATIONS', 'BRANCH'),
  def('operations.orders.cancel', 'OPERATIONS', 'BRANCH'),
  def('operations.bom.view', 'OPERATIONS', 'COMPANY'),
  def('operations.bom.manage', 'OPERATIONS', 'COMPANY'),
  def('operations.materials.manage', 'OPERATIONS', 'BRANCH'),
  def('operations.material_issues.create', 'OPERATIONS', 'BRANCH'),
  def('operations.material_issues.approve', 'OPERATIONS', 'BRANCH'),
  def('operations.material_usage.create', 'OPERATIONS', 'BRANCH'),
  def('operations.execution.manage', 'OPERATIONS', 'BRANCH'),
  def('operations.output.create', 'OPERATIONS', 'BRANCH'),
  def('operations.output.approve', 'OPERATIONS', 'BRANCH'),
  def('operations.items.view', 'OPERATIONS', 'COMPANY'),
  def('operations.items.manage', 'OPERATIONS', 'COMPANY'),
  def('operations.purchase_requests.create', 'OPERATIONS', 'BRANCH'),
  def('operations.purchase_requests.approve', 'OPERATIONS', 'BRANCH'),
  // ---- Warehouse (operational data only — never financial)
  def('warehouse.workspace.view', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.inventory.view', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.receiving.view', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.receiving.process', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.receiving.cancel', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.stock_adjustment.create', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.stock_adjustment.approve', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.transfers.create', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.transfers.approve', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.transfers.cancel', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.counts.create', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.counts.approve', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.picking.process', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.dispatch.confirm', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.delivery.confirm', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.material_issues.view', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.finished_goods.view', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.finished_goods.process', 'WAREHOUSE', 'BRANCH'),
  def('warehouse.finished_goods.confirm', 'WAREHOUSE', 'BRANCH'),
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
  def('purchasing.orders.edit', 'PURCHASING', 'BRANCH'),
  def('purchasing.orders.cancel', 'PURCHASING', 'BRANCH'),
  def('purchasing.production_shortages.view', 'PURCHASING', 'BRANCH'),
  // ---- Accounting
  def('accounting.workspace.view', 'ACCOUNTING', 'BRANCH'),
  def('accounting.payments.view', 'ACCOUNTING', 'BRANCH'),
  def('accounting.payments.update_status', 'ACCOUNTING', 'BRANCH'),
  def('accounting.documents.view', 'ACCOUNTING', 'BRANCH'),
  def('accounting.customers.view', 'ACCOUNTING', 'COMPANY'),
  def('accounting.suppliers.view', 'ACCOUNTING', 'COMPANY'),
  def('accounting.purchase_requests.create', 'ACCOUNTING', 'BRANCH'),
  def('accounting.purchase_requests.approve', 'ACCOUNTING', 'BRANCH'),
  def('accounting.deposits.view', 'ACCOUNTING', 'BRANCH'),
  def('accounting.deposits.confirm', 'ACCOUNTING', 'BRANCH'),
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
