import { describe, expect, it } from 'vitest';
// The backend's authoritative catalog (dependency-free on purpose, EP24).
import {
  ANNUAL_TERMS,
  DEPARTMENT_CODES,
  PLAN_CATALOG,
  PLAN_CODES,
} from '../../../../backend/src/billing/catalog';
import { ANNUAL_POLICY, PLANS, STANDARD_DEPARTMENTS } from './plans';

/*
 * One set of plan facts (EP24): the frozen public pricing page and the backend
 * that enforces packages must never disagree. If this fails, one side changed
 * without the other — fix the data, never this test.
 */

const API: Record<string, 'NONE' | 'ADD_ON' | 'INCLUDED'> = {
  no: 'NONE',
  addon: 'ADD_ON',
  included: 'INCLUDED',
};

describe('public pricing ↔ backend package catalog', () => {
  it('lists the same four plans in the same order', () => {
    expect(PLANS.map((p) => p.id.toUpperCase())).toEqual([...PLAN_CODES]);
  });

  it.each(PLANS.map((p) => [p.id, p] as const))('%s: same price, limits and rules', (_, p) => {
    const b = PLAN_CATALOG[p.id.toUpperCase() as (typeof PLAN_CODES)[number]];
    expect(b.monthlyPriceThb).toBe(p.monthlyPrice);
    expect(b.recommended).toBe(p.recommended);
    expect(b.purchase).toBe(p.cta === 'quote' ? 'quotation' : 'self_service');
    expect(b.storageGb).toBe(p.storageGb);
    expect(b.executiveAllowed).toBe(p.executiveAccess);
    expect(b.api).toBe(API[p.api]);
    expect(b.maxDepartments).toBe(
      typeof p.departmentLimit === 'number'
        ? p.departmentLimit
        : p.departmentLimit === 'all'
          ? STANDARD_DEPARTMENTS.length
          : null,
    );
    expect(b.allBranchesIncluded).toBe(p.allBranches);
  });

  it('keeps the frozen values themselves (399 / 699 / 999 / quotation)', () => {
    expect(PLAN_CODES.map((c) => PLAN_CATALOG[c].monthlyPriceThb)).toEqual([399, 699, 999, null]);
  });

  it('has the same six departments and annual terms', () => {
    expect([...DEPARTMENT_CODES].sort()).toEqual(
      STANDARD_DEPARTMENTS.map((d) => d.toUpperCase()).sort(),
    );
    expect(ANNUAL_TERMS.year1PaidMonths).toBe(ANNUAL_POLICY.year1PaidMonths);
    expect(ANNUAL_TERMS.year2PaidMonths).toBe(ANNUAL_POLICY.year2PaidMonths);
    expect(ANNUAL_TERMS.year3DiscountPercent).toBe(ANNUAL_POLICY.year3DiscountPercent);
  });
});
