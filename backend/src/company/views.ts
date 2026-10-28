import { toApiLocale } from '../auth/locale.js';
import type { DepartmentCode } from '../billing/catalog.js';
import type { Branch, Company, Subscription } from '../generated/prisma/client.js';

/*
 * Response shapes shared by onboarding (EP24), Platform Inspection (EP24.1)
 * and the Company Control Center (EP25). Only these fields ever leave the
 * server — never internal slots, hashes or file bytes.
 */

export interface BranchView {
  id: string;
  code: string;
  name: string;
  type: 'HEAD_OFFICE' | 'BRANCH';
  status: string;
  address: {
    line1: string;
    line2: string | null;
    subdistrict: string | null;
    district: string | null;
    province: string;
    postalCode: string;
    countryCode: string;
  };
  phone: string | null;
  deactivatedAt: string | null;
  /** EP26: when the branch was created / last changed. */
  createdAt: string;
  updatedAt: string;
}

/** A branch named inside another record (access lists, invitations) — EP26. */
export interface BranchRef {
  id: string;
  code: string;
  name: string;
  type: 'HEAD_OFFICE' | 'BRANCH';
  status: string;
}

export const branchRef = (
  b: Pick<Branch, 'id' | 'code' | 'name' | 'type' | 'status'>,
): BranchRef => ({
  id: b.id,
  code: b.code,
  name: b.name,
  type: b.type,
  status: b.status,
});

/** A department assignment as the Control Center shows it. */
export const departmentView = (a: {
  isPrimary: boolean;
  department: { code: DepartmentCode; isActive: boolean };
}) => ({ code: a.department.code, primary: a.isPrimary, active: a.department.isActive });

export interface SubscriptionView {
  id: string;
  plan: Subscription['plan'];
  status: string;
  billingCycle: string;
  /** `null` for a quotation plan — or when the caller may not see prices (EP25). */
  monthlyPriceThb: number | null;
  catalogVersion: number;
  createdAt: string;
  activatedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export const branchView = (b: Branch): BranchView => ({
  id: b.id,
  code: b.code,
  name: b.name,
  type: b.type,
  status: b.status,
  address: {
    line1: b.addressLine1,
    line2: b.addressLine2,
    subdistrict: b.subdistrict,
    district: b.district,
    province: b.province,
    postalCode: b.postalCode,
    countryCode: b.countryCode,
  },
  phone: b.phone,
  deactivatedAt: b.deactivatedAt?.toISOString() ?? null,
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

export const subscriptionView = (s: Subscription, showPrice = true): SubscriptionView => ({
  id: s.id,
  plan: s.plan,
  status: s.status,
  billingCycle: s.billingCycle,
  monthlyPriceThb: showPrice ? s.monthlyPriceThb : null,
  catalogVersion: s.catalogVersion,
  createdAt: s.createdAt.toISOString(),
  activatedAt: s.activatedAt?.toISOString() ?? null,
  currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
  currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
});

export function companyFields(c: Company) {
  return {
    id: c.id,
    displayName: c.name,
    legalName: c.legalName,
    taxId: c.taxId,
    registrationNumber: c.registrationNumber,
    // EP25 profile — NULL for older companies until someone fills them in.
    englishName: c.englishName,
    phone: c.phone,
    website: c.website,
    contactEmail: c.contactEmail,
    industry: c.industry,
    timezone: c.timezone,
    defaultLocale: toApiLocale(c.defaultLocale),
    status: c.status,
    onboardingStatus: c.onboardingStatus,
    isDemo: c.isDemo,
    createdAt: c.createdAt.toISOString(),
    activatedAt: c.activatedAt?.toISOString() ?? null,
  };
}
