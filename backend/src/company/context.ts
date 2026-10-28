import { forbidden } from '../auth/errors.js';
import type { AuthContext } from '../auth/sessions.js';
import { DEPARTMENT_CODES, type DepartmentCode } from '../billing/catalog.js';
import type { Db } from '../db/client.js';
import type { Company, CompanyMember, Subscription } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { allowedActiveBranches, canWorkInBranch, effectiveScope } from './branch-access.js';
import { canEnterCore } from './entitlements.js';
import { can, departmentAccess, ROLE_CAPABILITIES, type CompanyCapability } from './policy.js';
import { branchView, type BranchView } from './views.js';

/*
 * The customer's company context (EP25) — resolved from the server-side
 * session on every request, never from the request body or path:
 *
 *   session → user → CompanyMember (ACTIVE) → company (+ current subscription)
 *           → capabilities from the role policy
 *           → branches the member may work in (EP26 branch access)
 *           → selected branch (Session.branchId, re-validated every time)
 *           → departments the member may enter
 *
 * Platform operators have no company context: the customer routes refuse them
 * (Platform Inspection is their read-only window, at platform level).
 */

export const noCompany = () =>
  new AppError(404, 'NO_COMPANY', 'This account has no CORE company yet.');

export const membershipInactive = () =>
  new AppError(403, 'MEMBERSHIP_INACTIVE', 'Your access to this company has been deactivated.');

export const companyNotActive = () =>
  new AppError(
    403,
    'COMPANY_NOT_ACTIVE',
    'The Company Control Center opens once the company and its subscription are active.',
  );

export const branchRequired = () =>
  new AppError(409, 'BRANCH_REQUIRED', 'Choose the branch you are working in first.');

export const branchNotAllowed = () =>
  new AppError(403, 'BRANCH_NOT_ALLOWED', 'You do not have access to this branch.');

export interface CompanyAccess {
  member: CompanyMember;
  company: Company;
  subscription: Subscription | null;
  canEnterCore: boolean;
  capabilities: readonly CompanyCapability[];
  /** The acting member, for the owner / peer protections. */
  actor: { memberId: string; userId: string; role: CompanyMember['role'] };
}

/**
 * The caller's company access, or an error. `eligible` (default) requires an
 * ACTIVE company with an ACTIVE subscription — the Company Control Center and
 * CORE Operations are closed before activation (the Account Portal covers that).
 */
export async function requireCompanyAccess(
  db: Db,
  ctx: AuthContext,
  opts: { capability?: CompanyCapability; eligible?: boolean } = {},
): Promise<CompanyAccess> {
  if (ctx.user.platformRole) throw forbidden();
  const member = await db.companyMember.findUnique({
    where: { userId: ctx.user.id },
    include: { company: true },
  });
  if (!member) throw noCompany();
  if (member.status !== 'ACTIVE') throw membershipInactive();
  const subscription = await db.subscription.findFirst({
    where: { companyId: member.companyId, currentSlot: true },
  });
  const enter = canEnterCore(member.company, subscription);
  if ((opts.eligible ?? true) && !enter) throw companyNotActive();
  if (opts.capability && !can(member.role, opts.capability)) throw forbidden();
  const { company, ...plain } = member;
  return {
    member: plain,
    company,
    subscription,
    canEnterCore: enter,
    capabilities: ROLE_CAPABILITIES[member.role],
    actor: { memberId: member.id, userId: member.userId, role: member.role },
  };
}

/** The departments a company has enabled (soft-disabled ones excluded), in CORE order. */
export async function enabledDepartments(db: Db, companyId: string): Promise<DepartmentCode[]> {
  const rows = await db.department.findMany({
    where: { companyId, isActive: true },
    select: { code: true },
  });
  const codes = rows.map((r) => r.code);
  return DEPARTMENT_CODES.filter((c) => codes.includes(c));
}

/** A member's department assignments inside one company. */
export async function assignedDepartments(db: Db, userId: string, companyId: string) {
  const rows = await db.membership.findMany({
    where: { userId, department: { companyId } },
    include: { department: { select: { code: true, isActive: true } } },
  });
  return rows.map((r) => ({
    code: r.department.code,
    primary: r.isPrimary,
    active: r.department.isActive,
  }));
}

/** Departments this member may enter now: enabled for the company AND permitted for the person. */
export async function allowedDepartments(db: Db, access: CompanyAccess) {
  const [enabled, assigned] = await Promise.all([
    enabledDepartments(db, access.company.id),
    assignedDepartments(db, access.member.userId, access.company.id),
  ]);
  return departmentAccess(
    access.member.role,
    enabled,
    assigned.map((a) => a.code),
  );
}

export interface BranchContextView {
  company: { id: string; displayName: string };
  role: CompanyMember['role'];
  /** EP26: ALL_BRANCHES or SELECTED_BRANCHES (the owner is always ALL_BRANCHES). */
  scope: CompanyMember['branchScope'];
  /** Active branches this person may work in, Head Office first. */
  branches: BranchView[];
  selected: BranchView | null;
  /** True when the person must choose (several allowed branches, none selected). */
  needsSelection: boolean;
  /** EP26: 'NO_BRANCH_ACCESS' when no active branch is open to this person. */
  blocked: 'NO_BRANCH_ACCESS' | null;
  /** Departments this person may open in CORE Operations. */
  departments: DepartmentCode[];
}

/**
 * The branch context of this session. Only branches the person may work in
 * are listed (EP26). Exactly one is selected automatically; with several, the
 * person chooses; with none, the context is blocked. A stored branch that is
 * no longer valid (another company, deactivated, access removed) is dropped,
 * never trusted.
 */
export async function branchContext(db: Db, ctx: AuthContext): Promise<BranchContextView> {
  const access = await requireCompanyAccess(db, ctx);
  const companyId = access.company.id;
  const branches = await allowedActiveBranches(db, access.member);
  let selected = branches.find((b) => b.id === ctx.session.branchId) ?? null;
  if (!selected && branches.length === 1) {
    selected = branches[0]!;
    await db.session.update({
      where: { id: ctx.session.id },
      data: { branchId: selected.id, branchSelectedAt: new Date() },
    });
  } else if (!selected && ctx.session.branchId) {
    await db.session.update({
      where: { id: ctx.session.id },
      data: { branchId: null, branchSelectedAt: null },
    });
  }
  return {
    company: { id: companyId, displayName: access.company.name },
    role: access.member.role,
    scope: effectiveScope(access.member),
    branches: branches.map(branchView),
    selected: selected ? branchView(selected) : null,
    needsSelection: !selected && branches.length > 0,
    blocked: branches.length === 0 ? 'NO_BRANCH_ACCESS' : null,
    departments: await allowedDepartments(db, access),
  };
}

/**
 * Selects the branch for this session — only an ACTIVE branch of the caller's
 * own company that the caller may work in (EP26). Another company's branch is
 * simply not found; a branch of the own company outside the caller's access is
 * refused.
 */
export async function selectBranch(db: Db, ctx: AuthContext, branchId: string) {
  const access = await requireCompanyAccess(db, ctx);
  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId: access.company.id },
  });
  if (!branch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found.');
  if (branch.status !== 'ACTIVE') {
    throw new AppError(409, 'BRANCH_INACTIVE', 'This branch is not active.');
  }
  if (!(await canWorkInBranch(db, access.member, branch.id))) throw branchNotAllowed();
  await db.session.update({
    where: { id: ctx.session.id },
    data: { branchId: branch.id, branchSelectedAt: new Date() },
  });
  return branchContext(db, { ...ctx, session: { ...ctx.session, branchId: branch.id } });
}

export interface OperationsContext {
  companyId: string;
  branch: { id: string; code: string; name: string; type: 'HEAD_OFFICE' | 'BRANCH' };
  role: CompanyMember['role'];
  departments: DepartmentCode[];
}

/**
 * The gate every future operational API goes through: an active member of an
 * eligible company, working in a selected, still-active branch of that same
 * company that the member may still work in (EP26). Callers then scope every
 * query by `companyId` + `branch.id` and check the department against
 * `departments`. A stored branch that fails any of this is cleared from the
 * session, so a stale context cannot be reused.
 */
export async function requireOperationsContext(
  db: Db,
  ctx: AuthContext,
): Promise<OperationsContext> {
  const access = await requireCompanyAccess(db, ctx);
  const stored = ctx.session.branchId;
  const branch =
    stored && (await canWorkInBranch(db, access.member, stored))
      ? await db.branch.findFirst({
          where: { id: stored, companyId: access.company.id, status: 'ACTIVE' },
          select: { id: true, code: true, name: true, type: true },
        })
      : null;
  if (!branch) {
    if (stored) {
      await db.session.update({
        where: { id: ctx.session.id },
        data: { branchId: null, branchSelectedAt: null },
      });
    }
    throw branchRequired();
  }
  return {
    companyId: access.company.id,
    branch,
    role: access.member.role,
    departments: await allowedDepartments(db, access),
  };
}

/** Throws unless `department` is one this operations context may open. */
export function assertDepartmentAccess(context: OperationsContext, department: DepartmentCode) {
  if (!context.departments.includes(department)) {
    throw new AppError(
      403,
      'DEPARTMENT_NOT_ALLOWED',
      'This department is not available to you in this company.',
      { department },
    );
  }
}
