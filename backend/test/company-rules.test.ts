import { describe, expect, it } from 'vitest';
import {
  ANNUAL_TERMS,
  annualTermYear,
  DEPARTMENT_CODES,
  PLAN_CATALOG,
  PLAN_CODES,
} from '../src/billing/catalog.js';
import {
  assertSubscriptionTransition,
  canEnterCore,
  departmentProblem,
  entitlementView,
  readSnapshot,
  snapshotFor,
} from '../src/company/entitlements.js';
import { isThaiTaxId } from '../src/company/input.js';
import { addMonthsUtc, selectedPlan } from '../src/company/service.js';

/* EP24 business rules that need no database. */

describe('package catalog (frozen public values)', () => {
  it('has exactly the four public plans, in order', () => {
    expect(PLAN_CODES).toEqual(['STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE']);
  });

  it('keeps the frozen prices: ฿399 / ฿699 (recommended) / ฿999 / Enterprise by quotation, no free plan', () => {
    expect(PLAN_CODES.map((c) => PLAN_CATALOG[c].monthlyPriceThb)).toEqual([399, 699, 999, null]);
    expect(PLAN_CODES.filter((c) => PLAN_CATALOG[c].recommended)).toEqual(['BUSINESS']);
    expect(PLAN_CATALOG.ENTERPRISE.purchase).toBe('quotation');
    for (const c of PLAN_CODES) expect(PLAN_CATALOG[c].monthlyPriceThb).not.toBe(0);
  });

  it('keeps the frozen limits', () => {
    expect(
      PLAN_CODES.map((c) => {
        const p = PLAN_CATALOG[c];
        return [p.storageGb, p.maxDepartments, p.executiveAllowed, p.api];
      }),
    ).toEqual([
      [3, 2, false, 'NONE'],
      [10, 4, true, 'ADD_ON'],
      [30, 6, true, 'INCLUDED'],
      [null, null, true, 'INCLUDED'],
    ]);
    for (const c of PLAN_CODES) {
      expect(PLAN_CATALOG[c].allBranchesIncluded).toBe(true);
      expect(PLAN_CATALOG[c].lotExpiryFefoWithWarehouse).toBe(true);
    }
  });

  it('keeps the six canonical departments and the annual terms', () => {
    expect(DEPARTMENT_CODES).toEqual([
      'SALES',
      'OPERATIONS',
      'WAREHOUSE',
      'PURCHASING',
      'ACCOUNTING',
      'EXECUTIVE',
    ]);
    expect(ANNUAL_TERMS).toEqual({
      year1PaidMonths: 12,
      year2PaidMonths: 10,
      year3DiscountPercent: 15,
    });
  });
});

describe('department entitlements', () => {
  const problem = (plan: (typeof PLAN_CODES)[number], ...d: (typeof DEPARTMENT_CODES)[number][]) =>
    departmentProblem(snapshotFor(plan), d);

  it('Starter: up to two, never Executive', () => {
    expect(problem('STARTER')).toBeNull();
    expect(problem('STARTER', 'SALES', 'WAREHOUSE')).toBeNull();
    expect(problem('STARTER', 'SALES', 'WAREHOUSE', 'PURCHASING')).toBe('too_many');
    expect(problem('STARTER', 'EXECUTIVE')).toBe('executive_not_allowed');
  });

  it('Business: up to four, Executive allowed', () => {
    expect(problem('BUSINESS', 'SALES', 'WAREHOUSE', 'PURCHASING', 'EXECUTIVE')).toBeNull();
    expect(problem('BUSINESS', 'SALES', 'WAREHOUSE', 'PURCHASING', 'EXECUTIVE', 'ACCOUNTING')).toBe(
      'too_many',
    );
  });

  it('Professional: all six', () => {
    expect(problem('PROFESSIONAL', ...DEPARTMENT_CODES)).toBeNull();
  });

  it('Enterprise: custom — no numeric plan limit beyond the six', () => {
    expect(problem('ENTERPRISE')).toBeNull();
    expect(problem('ENTERPRISE', ...DEPARTMENT_CODES)).toBeNull();
    expect(entitlementView(snapshotFor('ENTERPRISE'))).toMatchObject({
      maxDepartments: 'CUSTOM',
      storage: 'CUSTOM',
    });
  });

  it('refuses duplicates', () => {
    expect(problem('PROFESSIONAL', 'SALES', 'SALES')).toBe('duplicate');
  });

  it('answers the entitlement questions, Lot/Expiry/FEFO always with Warehouse', () => {
    expect(entitlementView(snapshotFor('BUSINESS'))).toEqual({
      plan: 'BUSINESS',
      catalogVersion: 1,
      maxDepartments: 4,
      executiveAllowed: true,
      storage: { gb: 10 },
      api: 'ADD_ON',
      allBranchesIncluded: true,
      warehouseLotExpiryFefo: 'INCLUDED_WITH_WAREHOUSE',
    });
  });

  it('reads the stored snapshot, not the live catalog (history is not rewritten)', () => {
    const stored = { ...snapshotFor('BUSINESS'), maxDepartments: 3, monthlyPriceThb: 650 };
    const s = readSnapshot(stored, 'BUSINESS');
    expect(s.maxDepartments).toBe(3);
    expect(s.monthlyPriceThb).toBe(650);
  });
});

describe('subscription lifecycle', () => {
  it('allows only the defined transitions', () => {
    expect(() => assertSubscriptionTransition('PENDING', 'ACTIVE')).not.toThrow();
    expect(() => assertSubscriptionTransition('ACTIVE', 'PENDING')).toThrow(/cannot become/);
    expect(() => assertSubscriptionTransition('CANCELED', 'ACTIVE')).toThrow(/cannot become/);
    expect(() => assertSubscriptionTransition('EXPIRED', 'ACTIVE')).toThrow(/cannot become/);
  });

  it('gates CORE on an ACTIVE company with an ACTIVE subscription', () => {
    expect(canEnterCore({ status: 'ACTIVE' }, { status: 'ACTIVE' })).toBe(true);
    expect(canEnterCore({ status: 'PENDING_SUBSCRIPTION' }, { status: 'PENDING' })).toBe(false);
    expect(canEnterCore({ status: 'ACTIVE' }, { status: 'PENDING' })).toBe(false);
    expect(canEnterCore({ status: 'SUSPENDED' }, { status: 'ACTIVE' })).toBe(false);
    expect(canEnterCore({ status: 'ACTIVE' }, null)).toBe(false);
  });

  it('derives the annual term year from the activation date (UTC)', () => {
    const start = new Date('2026-03-15T00:00:00Z');
    expect(annualTermYear(start, new Date('2026-03-15T00:00:00Z'))).toBe(1);
    expect(annualTermYear(start, new Date('2027-03-14T23:59:59Z'))).toBe(1);
    expect(annualTermYear(start, new Date('2027-03-15T00:00:00Z'))).toBe(2);
    expect(annualTermYear(start, new Date('2029-01-01T00:00:00Z'))).toBe(3);
  });

  it('adds months in UTC, clamping to month ends', () => {
    expect(addMonthsUtc(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T10:00:00.000Z',
    );
    expect(addMonthsUtc(new Date('2028-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
    expect(addMonthsUtc(new Date('2026-05-10T00:00:00Z'), 12).toISOString()).toBe(
      '2027-05-10T00:00:00.000Z',
    );
  });
});

describe('input rules', () => {
  it('checks the Thai 13-digit tax ID checksum (format only)', () => {
    expect(isThaiTaxId('0105536000011')).toBe(true);
    expect(isThaiTaxId('0105536000012')).toBe(false);
    expect(isThaiTaxId('010553600001')).toBe(false);
    expect(isThaiTaxId('abcdefghijklm')).toBe(false);
  });

  it('maps the stored package choice to a plan code, ignoring anything else', () => {
    expect(selectedPlan('business')).toBe('BUSINESS');
    expect(selectedPlan('free')).toBeNull();
    expect(selectedPlan(null)).toBeNull();
  });
});
