import { apiRequest } from '@/lib/api';
import type { DepartmentId } from '@/config/departments';
import type { PlanId } from '@/features/pricing/plans';
import type { CompanyRole } from '@/features/auth/api';

/*
 * Typed client for the EP24 company & subscription foundation
 * (/api/v1/account, /api/v1/company, /api/v1/platform/companies).
 * Contracts: docs/COMPANY_SUBSCRIPTION.md. The server decides plan, price,
 * status and ownership — this client never sends them.
 */

export const PLAN_CODES = ['STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const DEPARTMENT_CODES = [
  'SALES',
  'OPERATIONS',
  'WAREHOUSE',
  'PURCHASING',
  'ACCOUNTING',
  'EXECUTIVE',
] as const;
export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];

/** Public plan id (pricing page, `?plan=`) ↔ API plan code. */
export const planCode = (id: PlanId): PlanCode => id.toUpperCase() as PlanCode;
export const planId = (code: PlanCode): PlanId => code.toLowerCase() as PlanId;
/** API department code → the public department id (names, icons). */
export const departmentId = (code: DepartmentCode): DepartmentId =>
  code.toLowerCase() as DepartmentId;

export type OnboardingStage =
  | 'PLATFORM_OPERATOR'
  | 'NEEDS_PACKAGE'
  | 'NEEDS_COMPANY'
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CLOSED';

export interface Onboarding {
  stage: OnboardingStage;
  selectedPlan: PlanCode | null;
  company: { id: string; displayName: string; isDemo: boolean; role: CompanyRole } | null;
  canEnterCore: boolean;
}

export type CompanyStatus = 'PENDING_SUBSCRIPTION' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type SubscriptionStatus =
  'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED' | 'EXPIRED';
export type ApiEntitlement = 'NONE' | 'ADD_ON' | 'INCLUDED' | 'CUSTOM';

export interface Entitlements {
  plan: PlanCode;
  catalogVersion: number;
  maxDepartments: number | 'CUSTOM';
  executiveAllowed: boolean;
  storage: { gb: number } | 'CUSTOM';
  api: ApiEntitlement;
  allBranchesIncluded: true;
  warehouseLotExpiryFefo: 'INCLUDED_WITH_WAREHOUSE';
}

export interface BranchInfo {
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
}

export interface SubscriptionInfo {
  id: string;
  plan: PlanCode;
  status: SubscriptionStatus;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  monthlyPriceThb: number | null;
  catalogVersion: number;
  createdAt: string;
  activatedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface CompanyInfo {
  company: {
    id: string;
    displayName: string;
    legalName: string | null;
    taxId: string | null;
    registrationNumber: string | null;
    status: CompanyStatus;
    onboardingStatus: 'IN_PROGRESS' | 'COMPLETED';
    isDemo: boolean;
    createdAt: string;
    activatedAt: string | null;
  };
  role: CompanyRole;
  headOffice: BranchInfo | null;
  departments: DepartmentCode[];
  subscription: SubscriptionInfo | null;
  entitlements: Entitlements | null;
  access: { canEnterCore: boolean };
}

export interface CreateCompanyRequest {
  legalName: string;
  displayName: string;
  taxId?: string;
  registrationNumber?: string;
  headOffice: {
    name?: string;
    addressLine1: string;
    addressLine2?: string;
    subdistrict?: string;
    district?: string;
    province: string;
    postalCode: string;
    countryCode: string;
    phone?: string;
  };
  departments: DepartmentCode[];
  billingCycle: 'MONTHLY' | 'ANNUAL';
}

export interface PlatformCompanyRow {
  id: string;
  name: string;
  legalName: string | null;
  isDemo: boolean;
  status: CompanyStatus;
  onboardingStatus: 'IN_PROGRESS' | 'COMPLETED';
  owner: string | null;
  plan: PlanCode | null;
  subscriptionStatus: SubscriptionStatus | null;
  members: number;
  departments: number;
  branches: number;
  createdAt: string;
}

export interface PlatformCompanyDetail {
  company: CompanyInfo['company'];
  branches: BranchInfo[];
  departments: DepartmentCode[];
  subscriptions: SubscriptionInfo[];
  entitlements: Entitlements | null;
  members: { email: string; status: string; role: CompanyRole }[];
  access: { canEnterCore: boolean };
  /** True only outside production: the manual development activation exists. */
  developmentActivation: boolean;
}

export const companyApi = {
  onboarding: () => apiRequest<Onboarding>('GET', '/api/v1/account/onboarding'),
  selectPackage: (plan: PlanCode) =>
    apiRequest<{ selectedPlan: PlanCode }>('POST', '/api/v1/account/package', { plan }),
  create: (body: CreateCompanyRequest) =>
    apiRequest<CompanyInfo>('POST', '/api/v1/company/onboarding', body),
  current: () => apiRequest<CompanyInfo>('GET', '/api/v1/company/current'),
};

const P = '/api/v1/platform/companies';

export const platformCompanyApi = {
  list: () =>
    apiRequest<{ companies: PlatformCompanyRow[]; developmentActivation: boolean }>('GET', P),
  detail: (id: string) =>
    apiRequest<PlatformCompanyDetail>('GET', `${P}/${encodeURIComponent(id)}`),
  activateForDevelopment: (id: string) =>
    apiRequest<PlatformCompanyDetail>(
      'POST',
      `${P}/${encodeURIComponent(id)}/development-activation`,
      {},
    ),
};
