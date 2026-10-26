/*
 * CORE package catalog (EP24) — the authoritative plan rules for enforcement.
 *
 * The frozen public pricing page presents the same facts from
 * frontend/src/features/pricing/plans.ts; a frontend parity test imports this
 * file and fails if the two ever disagree. This module has no imports so both
 * packages can read it.
 *
 * Values are frozen by the owner (EP07 / EP22):
 *   Starter ฿399 / month · Business ฿699 / month (recommended) ·
 *   Professional ฿999 / month · Enterprise by quotation. No free plan.
 *
 * Subscriptions keep a snapshot of the definition they were created with
 * (`catalogVersion` + entitlements), so a later price or limit change never
 * rewrites what an existing subscription meant. Bump PLAN_CATALOG_VERSION
 * whenever a definition below changes.
 */

export const PLAN_CATALOG_VERSION = 1;

export const PLAN_CODES = ['STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

/** The six standard CORE departments. Executive is oversight — not System Admin. */
export const DEPARTMENT_CODES = [
  'SALES',
  'OPERATIONS',
  'WAREHOUSE',
  'PURCHASING',
  'ACCOUNTING',
  'EXECUTIVE',
] as const;
export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];

/** How API access reaches a plan. */
export type ApiEntitlement = 'NONE' | 'ADD_ON' | 'INCLUDED' | 'CUSTOM';

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  /** THB per month; `null` = quotation (Enterprise). */
  monthlyPriceThb: number | null;
  recommended: boolean;
  /** Self-service onboarding vs. a quotation agreed with PDA BLISS. */
  purchase: 'self_service' | 'quotation';
  /** Standard departments the company may enable; `null` = as agreed (custom). */
  maxDepartments: number | null;
  executiveAllowed: boolean;
  /** Storage in GB; `null` = as agreed (custom). */
  storageGb: number | null;
  api: ApiEntitlement;
  /** One subscription covers one company with every branch. Never priced per branch. */
  allBranchesIncluded: true;
  /** Lot / Expiry / FEFO is core whenever Warehouse is enabled — never a paid toggle. */
  lotExpiryFefoWithWarehouse: true;
}

export const PLAN_CATALOG: Readonly<Record<PlanCode, PlanDefinition>> = {
  STARTER: {
    code: 'STARTER',
    name: 'Starter',
    monthlyPriceThb: 399,
    recommended: false,
    purchase: 'self_service',
    maxDepartments: 2,
    executiveAllowed: false,
    storageGb: 3,
    api: 'NONE',
    allBranchesIncluded: true,
    lotExpiryFefoWithWarehouse: true,
  },
  BUSINESS: {
    code: 'BUSINESS',
    name: 'Business',
    monthlyPriceThb: 699,
    recommended: true,
    purchase: 'self_service',
    maxDepartments: 4,
    executiveAllowed: true,
    storageGb: 10,
    api: 'ADD_ON',
    allBranchesIncluded: true,
    lotExpiryFefoWithWarehouse: true,
  },
  PROFESSIONAL: {
    code: 'PROFESSIONAL',
    name: 'Professional',
    monthlyPriceThb: 999,
    recommended: false,
    purchase: 'self_service',
    maxDepartments: 6,
    executiveAllowed: true,
    storageGb: 30,
    api: 'INCLUDED',
    allBranchesIncluded: true,
    lotExpiryFefoWithWarehouse: true,
  },
  ENTERPRISE: {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    monthlyPriceThb: null,
    recommended: false,
    purchase: 'quotation',
    maxDepartments: null,
    executiveAllowed: true,
    storageGb: null,
    api: 'INCLUDED',
    allBranchesIncluded: true,
    lotExpiryFefoWithWarehouse: true,
  },
};

/**
 * Annual terms (public policy; invoicing itself belongs to the billing episode):
 * year 1 pays 12 months, year 2 pays 10 and uses 12, year 3 onward is 15 % off.
 */
export const ANNUAL_TERMS = {
  year1PaidMonths: 12,
  year2PaidMonths: 10,
  year3DiscountPercent: 15,
} as const;

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === 'string' && (PLAN_CODES as readonly string[]).includes(value);
}

export function isDepartmentCode(value: unknown): value is DepartmentCode {
  return typeof value === 'string' && (DEPARTMENT_CODES as readonly string[]).includes(value);
}

/**
 * Which annual subscription year `at` falls in (1, 2, 3, …), derived from the
 * activation date in UTC — never from a stored counter that could drift.
 */
export function annualTermYear(activatedAt: Date, at: Date): number {
  let years = at.getUTCFullYear() - activatedAt.getUTCFullYear();
  const anniversary = Date.UTC(
    at.getUTCFullYear(),
    activatedAt.getUTCMonth(),
    activatedAt.getUTCDate(),
    activatedAt.getUTCHours(),
    activatedAt.getUTCMinutes(),
    activatedAt.getUTCSeconds(),
  );
  if (at.getTime() < anniversary) years -= 1;
  return Math.max(1, years + 1);
}
