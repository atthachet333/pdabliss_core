import { apiRequest } from '@/lib/api';
import type { DepartmentId } from '@/config/departments';
import type { PlanId } from '@/features/pricing/plans';
import type { CompanyRole } from '@/features/auth/api';
import type {
  ContactPreference,
  JobFunction,
  SignupIndustry,
  SignupInterest,
  SignupTeamSize,
} from '@/features/auth/profile';

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
  | 'CLOSED'
  /** EP25: the company deactivated this person's membership. */
  | 'MEMBERSHIP_INACTIVE';

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
export type BillingCycleCode = 'MONTHLY' | 'ANNUAL';

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
  /** EP25: set while the branch is deactivated. */
  deactivatedAt?: string | null;
}

export interface SubscriptionInfo {
  id: string;
  plan: PlanCode;
  status: SubscriptionStatus;
  billingCycle: BillingCycleCode;
  /** `null` for a quotation plan — or when this person may not see prices (EP25). */
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
  /** EP25: department roles never see what the company pays. */
  priceVisible?: boolean;
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
  /** Owner email / full name. */
  owner: string | null;
  ownerName: string | null;
  plan: PlanCode | null;
  subscriptionStatus: SubscriptionStatus | null;
  billingCycle: 'MONTHLY' | 'ANNUAL' | null;
  maxDepartments: number | 'CUSTOM' | null;
  enabledDepartments: DepartmentCode[];
  members: number;
  /** Count of enabled departments. */
  departments: number;
  branches: number;
  createdAt: string;
  /** Latest company audit event, when there is one. */
  lastActivityAt: string | null;
}

/** Explorer filters (EP24.1); all optional, combined with AND. */
export interface PlatformCompanyQuery {
  q?: string;
  plan?: PlanCode;
  subscriptionStatus?: 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED';
  status?: CompanyStatus;
  onboardingStatus?: 'IN_PROGRESS' | 'COMPLETED';
  department?: DepartmentCode;
  /** EP24.1.2: customer data only, demo only, or both (omitted). */
  demo?: 'exclude' | 'only';
  cursor?: string;
  limit?: number;
}

export interface PlatformCompanyPage {
  companies: PlatformCompanyRow[];
  total: number;
  nextCursor: string | null;
  developmentActivation: boolean;
}

export type DepartmentState = 'ENABLED' | 'NOT_ENABLED' | 'NOT_IN_PACKAGE';

export interface PlatformActivity {
  id: string;
  action: string;
  actorScope: 'customer' | 'platform_owner' | 'platform_admin' | 'seed' | null;
  actor: { email: string; fullName: string | null } | null;
  entityType: string;
  details: Record<string, unknown>;
  occurredAt: string;
}

export interface PlatformCompanyDetail {
  company: CompanyInfo['company'];
  owner: {
    email: string;
    fullName: string | null;
    phone: string | null;
    /** The owner's sign-up context — what they said, not company data. */
    signup: {
      companyName: string;
      industry: SignupIndustry;
      teamSize: SignupTeamSize;
      preferredContact: ContactPreference;
      lineId: string | null;
      interests: SignupInterest[];
      note: string | null;
    } | null;
  } | null;
  branches: BranchInfo[];
  departments: DepartmentCode[];
  departmentStates: { code: DepartmentCode; state: DepartmentState }[];
  subscriptions: SubscriptionInfo[];
  entitlements: Entitlements | null;
  members: {
    email: string;
    fullName: string | null;
    jobFunction: JobFunction | null;
    status: string;
    role: CompanyRole;
    joinedAt: string;
    lastLoginAt: string | null;
  }[];
  activity: PlatformActivity[];
  security: { id: string; type: string; email: string | null; occurredAt: string }[];
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
  list: (query: PlatformCompanyQuery = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query))
      if (v !== undefined && v !== '') params.set(k, String(v));
    const qs = params.toString();
    return apiRequest<PlatformCompanyPage>('GET', qs ? `${P}?${qs}` : P);
  },
  detail: (id: string) =>
    apiRequest<PlatformCompanyDetail>('GET', `${P}/${encodeURIComponent(id)}`),
  activateForDevelopment: (id: string) =>
    apiRequest<PlatformCompanyDetail>(
      'POST',
      `${P}/${encodeURIComponent(id)}/development-activation`,
      {},
    ),
};
