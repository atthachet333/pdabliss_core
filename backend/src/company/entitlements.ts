import {
  DEPARTMENT_CODES,
  PLAN_CATALOG,
  PLAN_CATALOG_VERSION,
  type ApiEntitlement,
  type DepartmentCode,
  type PlanCode,
} from '../billing/catalog.js';
import type { CompanyStatus, SubscriptionStatus } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';

/*
 * Entitlements (EP24) — the server's answer to "what may this company use?".
 * Every rule reads the subscription's snapshot, never the client and never the
 * live catalog, so a later catalog change cannot rewrite an existing plan.
 */

/** What a subscription stores in `entitlements` (JSON) at creation. */
export interface EntitlementSnapshot {
  catalogVersion: number;
  plan: PlanCode;
  monthlyPriceThb: number | null;
  /** `null` = as agreed (Enterprise): no numeric limit beyond the six departments. */
  maxDepartments: number | null;
  executiveAllowed: boolean;
  /** `null` = as agreed (Enterprise). */
  storageGb: number | null;
  api: ApiEntitlement;
  allBranchesIncluded: true;
  lotExpiryFefoWithWarehouse: true;
}

export function snapshotFor(plan: PlanCode): EntitlementSnapshot {
  const p = PLAN_CATALOG[plan];
  return {
    catalogVersion: PLAN_CATALOG_VERSION,
    plan: p.code,
    monthlyPriceThb: p.monthlyPriceThb,
    maxDepartments: p.maxDepartments,
    executiveAllowed: p.executiveAllowed,
    storageGb: p.storageGb,
    api: p.api,
    allBranchesIncluded: true,
    lotExpiryFefoWithWarehouse: true,
  };
}

/** Reads a stored snapshot defensively (it is JSON in the database). */
export function readSnapshot(value: unknown, fallbackPlan: PlanCode): EntitlementSnapshot {
  const base = snapshotFor(fallbackPlan);
  if (!value || typeof value !== 'object') return base;
  const v = value as Partial<EntitlementSnapshot>;
  return {
    ...base,
    catalogVersion: typeof v.catalogVersion === 'number' ? v.catalogVersion : base.catalogVersion,
    monthlyPriceThb:
      v.monthlyPriceThb === null || typeof v.monthlyPriceThb === 'number'
        ? v.monthlyPriceThb
        : base.monthlyPriceThb,
    maxDepartments:
      v.maxDepartments === null || typeof v.maxDepartments === 'number'
        ? v.maxDepartments
        : base.maxDepartments,
    executiveAllowed:
      typeof v.executiveAllowed === 'boolean' ? v.executiveAllowed : base.executiveAllowed,
    storageGb:
      v.storageGb === null || typeof v.storageGb === 'number' ? v.storageGb : base.storageGb,
    api: v.api ?? base.api,
  };
}

/** The public shape of a company's entitlements (typed answer for future enforcement). */
export interface EntitlementView {
  plan: PlanCode;
  catalogVersion: number;
  maxDepartments: number | 'CUSTOM';
  executiveAllowed: boolean;
  storage: { gb: number } | 'CUSTOM';
  api: ApiEntitlement;
  allBranchesIncluded: true;
  /** Lot / Expiry / FEFO comes with Warehouse; it is never a separate toggle. */
  warehouseLotExpiryFefo: 'INCLUDED_WITH_WAREHOUSE';
}

export function entitlementView(s: EntitlementSnapshot): EntitlementView {
  return {
    plan: s.plan,
    catalogVersion: s.catalogVersion,
    maxDepartments: s.maxDepartments ?? 'CUSTOM',
    executiveAllowed: s.executiveAllowed,
    storage: s.storageGb === null ? 'CUSTOM' : { gb: s.storageGb },
    api: s.api,
    allBranchesIncluded: true,
    warehouseLotExpiryFefo: 'INCLUDED_WITH_WAREHOUSE',
  };
}

export type DepartmentProblem = 'duplicate' | 'executive_not_allowed' | 'too_many';

/**
 * Checks a department selection against a plan snapshot. 0..max departments
 * are allowed here; onboarding itself asks for at least one where it applies.
 */
export function departmentProblem(
  s: EntitlementSnapshot,
  selected: readonly DepartmentCode[],
): DepartmentProblem | null {
  if (new Set(selected).size !== selected.length) return 'duplicate';
  if (selected.includes('EXECUTIVE') && !s.executiveAllowed) return 'executive_not_allowed';
  const max = s.maxDepartments ?? DEPARTMENT_CODES.length;
  if (selected.length > max) return 'too_many';
  return null;
}

export function assertDepartments(s: EntitlementSnapshot, selected: readonly DepartmentCode[]) {
  const problem = departmentProblem(s, selected);
  if (problem) {
    throw new AppError(
      422,
      'DEPARTMENT_LIMIT',
      problem === 'executive_not_allowed'
        ? `The ${PLAN_CATALOG[s.plan].name} package does not include the Executive department.`
        : problem === 'too_many'
          ? `The ${PLAN_CATALOG[s.plan].name} package allows at most ${s.maxDepartments} departments.`
          : 'Each department can be selected once.',
      { problem, plan: s.plan, maxDepartments: s.maxDepartments ?? 'CUSTOM' },
    );
  }
}

/**
 * The CORE access gate: operational access needs an ACTIVE company with an
 * ACTIVE subscription. Anything else stays in the Account Portal.
 */
export function canEnterCore(
  company: { status: CompanyStatus },
  subscription: { status: SubscriptionStatus } | null,
): boolean {
  return company.status === 'ACTIVE' && subscription?.status === 'ACTIVE';
}

/**
 * Legal subscription transitions. EP24 exposes only PENDING → ACTIVE (manual,
 * development activation); billing will drive the rest.
 */
export const SUBSCRIPTION_TRANSITIONS: Readonly<
  Record<SubscriptionStatus, readonly SubscriptionStatus[]>
> = {
  PENDING: ['ACTIVE', 'CANCELED'],
  ACTIVE: ['PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED'],
  PAST_DUE: ['ACTIVE', 'SUSPENDED', 'CANCELED', 'EXPIRED'],
  SUSPENDED: ['ACTIVE', 'CANCELED', 'EXPIRED'],
  CANCELED: [],
  EXPIRED: [],
};

export function assertSubscriptionTransition(from: SubscriptionStatus, to: SubscriptionStatus) {
  if (!SUBSCRIPTION_TRANSITIONS[from].includes(to)) {
    throw new AppError(409, 'INVALID_TRANSITION', `A ${from} subscription cannot become ${to}.`, {
      from,
      to,
    });
  }
}
