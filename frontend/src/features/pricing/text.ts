import { fill, type PricingCopy } from './copy';
import { STANDARD_DEPARTMENTS, type PlanFacts } from './plans';

/*
 * Words for plan facts. Every function reads plans.ts, so the explorer,
 * configurator, comparison and FAQ can never disagree with each other.
 */

type Values = PricingCopy['values'];

export function departmentAllowance(plan: PlanFacts, v: Values): string {
  if (typeof plan.departmentLimit === 'number') return fill(v.upTo, { n: plan.departmentLimit });
  if (plan.departmentLimit === 'all')
    return fill(v.allStandard, { n: STANDARD_DEPARTMENTS.length });
  return v.custom;
}

export function storageText(plan: PlanFacts, v: Values): string {
  return plan.storageGb === null ? v.agreed : fill(v.gb, { n: plan.storageGb });
}

export function usersText(plan: PlanFacts, v: Values): string {
  return plan.cta === 'quote' ? v.usersCustom : v.users;
}

export function executiveText(plan: PlanFacts, v: Values): string {
  if (!plan.executiveAccess) return `${v.no} · ${v.starterNoExecutive}`;
  return plan.departmentLimit === 'all' || plan.departmentLimit === 'custom'
    ? `${v.yes} · ${v.fullExecutive}`
    : v.yes;
}
