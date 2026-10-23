import { DEPT_PAGES, type DeptKey } from '@/features/departments/catalog';

/*
 * CORE packages (EP07) — the single source of truth for plan FACTS.
 *
 * Every price, limit and rule shown on /pricing, in the configurator, the
 * comparison, the recommendation and the FAQ is derived from this file. Copy
 * files hold words only. This is PRESENTATION LOGIC: there is no billing
 * backend yet, so nothing here charges, enforces or persists anything.
 *
 * Model: one subscription = one company. Every branch of that company is
 * included. No per-branch pricing, no fixed public user limits, no free plan.
 */

export const PLAN_IDS = ['starter', 'business', 'professional', 'enterprise'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const isPlanId = (v: unknown): v is PlanId =>
  typeof v === 'string' && (PLAN_IDS as readonly string[]).includes(v);

/** The standard CORE departments (the EP06 department pages). */
export const STANDARD_DEPARTMENTS: readonly DeptKey[] = DEPT_PAGES;

export type Layer = 'foundation' | 'connected' | 'controlled' | 'tailored';
export type WorkflowLevel = 'basic' | 'crossDepartment' | 'custom' | 'organization';
export type ApprovalLevel = 'single' | 'multiStep' | 'multiLevel' | 'custom';
export type ReportLevel = 'basic' | 'advanced' | 'advancedCustom' | 'organization';
/** How a capability reaches a plan. */
export type Availability = 'no' | 'addon' | 'included' | 'scope';
export type AuditLevel = 'none' | 'basic' | 'advanced' | 'custom';
export type NotificationLevel = 'basic' | 'advanced' | 'alerting' | 'custom';
export type SupportLevel = 'standard' | 'priority' | 'higherPriority' | 'dedicated';

export interface PlanFacts {
  id: PlanId;
  name: string;
  /** Position in the capability stack, 0–3. */
  level: 0 | 1 | 2 | 3;
  layer: Layer;
  /** THB per month; `null` = quotation only. */
  monthlyPrice: number | null;
  recommended: boolean;
  /** Companies covered by one subscription. Always 1. */
  companies: 1;
  /** Every branch of the company is included. Always true. */
  allBranches: true;
  /** Standard departments the plan may enable. */
  departmentLimit: number | 'all' | 'custom';
  executiveAccess: boolean;
  /** Storage in GB; `null` = as agreed. */
  storageGb: number | null;
  workflow: WorkflowLevel;
  approval: ApprovalLevel;
  automation: Availability;
  customRoles: Availability;
  audit: AuditLevel;
  notifications: NotificationLevel;
  reports: ReportLevel;
  customReports: Availability;
  customDashboard: Availability;
  api: Availability;
  advancedImportExport: boolean;
  support: SupportLevel;
  /** Normal plans go to the (future) checkout flow; Enterprise asks for a quotation. */
  cta: 'checkout' | 'quote';
}

export const PLANS: readonly PlanFacts[] = [
  {
    id: 'starter',
    name: 'Starter',
    level: 0,
    layer: 'foundation',
    monthlyPrice: 399,
    recommended: false,
    companies: 1,
    allBranches: true,
    departmentLimit: 2,
    executiveAccess: false,
    storageGb: 3,
    workflow: 'basic',
    approval: 'single',
    automation: 'no',
    customRoles: 'no',
    audit: 'none',
    notifications: 'basic',
    reports: 'basic',
    customReports: 'no',
    customDashboard: 'no',
    api: 'no',
    advancedImportExport: false,
    support: 'standard',
    cta: 'checkout',
  },
  {
    id: 'business',
    name: 'Business',
    level: 1,
    layer: 'connected',
    monthlyPrice: 699,
    recommended: true,
    companies: 1,
    allBranches: true,
    departmentLimit: 4,
    executiveAccess: true,
    storageGb: 10,
    workflow: 'crossDepartment',
    approval: 'multiStep',
    automation: 'addon',
    customRoles: 'no',
    audit: 'basic',
    notifications: 'advanced',
    reports: 'advanced',
    customReports: 'addon',
    customDashboard: 'addon',
    api: 'addon',
    advancedImportExport: false,
    support: 'priority',
    cta: 'checkout',
  },
  {
    id: 'professional',
    name: 'Professional',
    level: 2,
    layer: 'controlled',
    monthlyPrice: 999,
    recommended: false,
    companies: 1,
    allBranches: true,
    departmentLimit: 'all',
    executiveAccess: true,
    storageGb: 30,
    workflow: 'custom',
    approval: 'multiLevel',
    automation: 'included',
    customRoles: 'included',
    audit: 'advanced',
    notifications: 'alerting',
    reports: 'advancedCustom',
    customReports: 'included',
    customDashboard: 'included',
    api: 'included',
    advancedImportExport: true,
    support: 'higherPriority',
    cta: 'checkout',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    level: 3,
    layer: 'tailored',
    monthlyPrice: null,
    recommended: false,
    companies: 1,
    allBranches: true,
    departmentLimit: 'custom',
    executiveAccess: true,
    storageGb: null,
    workflow: 'organization',
    approval: 'custom',
    automation: 'included',
    customRoles: 'scope',
    audit: 'custom',
    notifications: 'custom',
    reports: 'organization',
    customReports: 'included',
    customDashboard: 'included',
    // Included, with integrations defined in the project scope.
    api: 'included',
    advancedImportExport: true,
    support: 'dedicated',
    cta: 'quote',
  },
];

export function getPlan(id: PlanId): PlanFacts {
  return PLANS.find((p) => p.id === id)!;
}

/** Lowest published monthly price ("starting from"). */
export const STARTING_PRICE = Math.min(
  ...PLANS.flatMap((p) => (p.monthlyPrice === null ? [] : [p.monthlyPrice])),
);

/* ------------------------------------------------------------------ */
/* Annual relationship                                                  */
/* ------------------------------------------------------------------ */

/**
 * Annual billing policy (presentation logic — not implemented in billing yet):
 * - Year 1: pay the full 12 months.
 * - Year 2: pay 10 months, use 12 months.
 * - Year 3 onward: 15 % off the normal annual price (monthly × 12).
 * Year 3+ amounts are displayed rounded to the nearest 10 THB and marked as
 * approximate; the exact value is kept for reference.
 */
export const ANNUAL_POLICY = {
  year1PaidMonths: 12,
  year2PaidMonths: 10,
  year3DiscountPercent: 15,
  displayRoundTo: 10,
} as const;

export interface AnnualPrices {
  /** Normal annual price: monthly × 12. */
  normal: number;
  year1: number;
  year2: number;
  /** Year 3 onward, exact. */
  year3Exact: number;
  /** Year 3 onward, rounded for display (approximate). */
  year3: number;
}

export function annualPrices(monthly: number): AnnualPrices {
  const normal = monthly * 12;
  const year3Exact = (normal * (100 - ANNUAL_POLICY.year3DiscountPercent)) / 100;
  const r = ANNUAL_POLICY.displayRoundTo;
  return {
    normal,
    year1: monthly * ANNUAL_POLICY.year1PaidMonths,
    year2: monthly * ANNUAL_POLICY.year2PaidMonths,
    year3Exact: Math.round(year3Exact * 100) / 100,
    year3: Math.round(year3Exact / r) * r,
  };
}

export type Billing = 'monthly' | 'annual';

/** Thousands-separated number, identical in every locale (no currency conversion). */
export const formatNumber = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/* ------------------------------------------------------------------ */
/* Departments                                                          */
/* ------------------------------------------------------------------ */

/** Maximum standard departments a plan can enable at once. */
export function departmentMax(plan: PlanFacts): number {
  return typeof plan.departmentLimit === 'number'
    ? plan.departmentLimit
    : STANDARD_DEPARTMENTS.length;
}

/** Whether a department can be enabled in a plan at all. */
export function isDepartmentAllowed(plan: PlanFacts, dept: DeptKey): boolean {
  return dept === 'executive' ? plan.executiveAccess : true;
}

/** Plans with every standard department included select them all. */
export const includesAllDepartments = (plan: PlanFacts) => typeof plan.departmentLimit !== 'number';

/**
 * Adjust a department selection to a plan: drops departments the plan cannot
 * use (Executive in Starter), trims to the plan's limit keeping the earliest
 * choices, and fills every department for plans that include them all.
 */
export function adjustDepartments(
  plan: PlanFacts,
  selected: readonly DeptKey[],
): { selected: DeptKey[]; removed: DeptKey[] } {
  if (includesAllDepartments(plan)) return { selected: [...STANDARD_DEPARTMENTS], removed: [] };
  const allowed = selected.filter((d) => isDepartmentAllowed(plan, d));
  const kept = allowed.slice(0, departmentMax(plan));
  return { selected: kept, removed: selected.filter((d) => !kept.includes(d)) };
}

/** Toggle one department, respecting the plan's rules. Returns the same array when refused. */
export function toggleDepartment(
  plan: PlanFacts,
  selected: readonly DeptKey[],
  dept: DeptKey,
): readonly DeptKey[] {
  if (includesAllDepartments(plan) || !isDepartmentAllowed(plan, dept)) return selected;
  if (selected.includes(dept)) return selected.filter((d) => d !== dept);
  if (selected.length >= departmentMax(plan)) return selected;
  return [...selected, dept];
}

/* ------------------------------------------------------------------ */
/* Add-ons                                                              */
/* ------------------------------------------------------------------ */

export const ADDON_IDS = [
  'department',
  'users',
  'storage',
  'api',
  'workflow',
  'report',
  'dashboard',
  'automation',
  'onlineTraining',
  'onsiteTraining',
  'implementation',
  'support',
] as const;
export type AddonId = (typeof ADDON_IDS)[number];

/**
 * How each add-on reaches each plan. No add-on has a published price: anything
 * that is not included is "assessed by scope".
 * - included: already part of the plan
 * - addon:    can be added; assessed by scope
 * - scope:    defined in the Enterprise project scope
 * - no:       not available on this plan (start from a higher plan)
 */
const byPlan = (pick: (p: PlanFacts) => Availability) =>
  Object.fromEntries(PLANS.map((p) => [p.id, pick(p)])) as Record<PlanId, Availability>;
const fixed = (
  starter: Availability,
  business: Availability,
  professional: Availability,
  enterprise: Availability,
) => ({ starter, business, professional, enterprise }) as Record<PlanId, Availability>;

export const ADDON_AVAILABILITY: Record<AddonId, Record<PlanId, Availability>> = {
  // More standard departments: Business adds them; Professional has them all.
  department: fixed('no', 'addon', 'included', 'scope'),
  users: fixed('addon', 'addon', 'addon', 'scope'),
  storage: fixed('addon', 'addon', 'addon', 'scope'),
  api: byPlan((p) => p.api),
  workflow: byPlan((p) =>
    p.workflow === 'custom'
      ? 'included'
      : p.workflow === 'organization'
        ? 'scope'
        : p.workflow === 'crossDepartment'
          ? 'addon'
          : 'no',
  ),
  report: byPlan((p) => p.customReports),
  dashboard: byPlan((p) => p.customDashboard),
  automation: byPlan((p) => p.automation),
  // Training and implementation are charged per engagement; Enterprise may include them in its quotation.
  onlineTraining: fixed('addon', 'addon', 'addon', 'scope'),
  onsiteTraining: fixed('addon', 'addon', 'addon', 'scope'),
  implementation: fixed('addon', 'addon', 'addon', 'scope'),
  // Priority support comes with Business and Professional; Enterprise agrees dedicated support.
  support: byPlan((p) =>
    p.support === 'standard' ? 'addon' : p.support === 'dedicated' ? 'scope' : 'included',
  ),
};

/** The first plan where an add-on is available, for "start from" hints. */
export function addonFirstPlan(id: AddonId): PlanFacts {
  return PLANS.find((p) => ADDON_AVAILABILITY[id][p.id] !== 'no')!;
}

/* ------------------------------------------------------------------ */
/* Recommendation                                                       */
/* ------------------------------------------------------------------ */

export type DeptRange = '1-2' | '3-4' | '5-6' | 'more';

export interface FitAnswers {
  departments: DeptRange;
  executive: boolean;
  customWorkflow: boolean;
  api: boolean;
  customReports: boolean;
  complex: boolean;
}

export type FitReason =
  | 'complex'
  | 'moreDepartments'
  | 'allDepartments'
  | 'customWorkflow'
  | 'apiOrReports'
  | 'fourDepartments'
  | 'executive'
  | 'start';

/** Deterministic package recommendation. No personal data is involved. */
export function recommendPlan(a: FitAnswers): { plan: PlanId; reasons: FitReason[] } {
  if (a.complex || a.departments === 'more') {
    return {
      plan: 'enterprise',
      reasons: [a.complex ? 'complex' : 'moreDepartments'],
    };
  }
  const pro: FitReason[] = [];
  if (a.departments === '5-6') pro.push('allDepartments');
  if (a.customWorkflow) pro.push('customWorkflow');
  if (a.api || a.customReports) pro.push('apiOrReports');
  if (pro.length) return { plan: 'professional', reasons: pro };
  const biz: FitReason[] = [];
  if (a.departments === '3-4') biz.push('fourDepartments');
  if (a.executive) biz.push('executive');
  if (biz.length) return { plan: 'business', reasons: biz };
  return { plan: 'starter', reasons: ['start'] };
}
