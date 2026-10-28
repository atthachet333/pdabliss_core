import { API_URL } from '@/config/site';
import type { Locale } from '@/i18n/locales';
import { apiRequest } from '@/lib/api';
import type { CompanyRole } from '@/features/auth/api';
import type { SignupIndustry } from '@/features/auth/profile';
import type {
  BillingCycleCode,
  BranchInfo,
  CompanyStatus,
  DepartmentCode,
  Entitlements,
  PlanCode,
  SubscriptionInfo,
  SubscriptionStatus,
} from '@/features/company/api';

/*
 * Typed client for the EP25 Company Control Center (/api/v1/company/…,
 * /api/v1/operations/context). Contracts: docs/COMPANY_CONTROL_CENTER.md.
 *
 * The client never sends a company id, a role it holds or a branch it "is
 * in": the server resolves the company from the session, checks the role
 * policy, and keeps the selected branch on the server-side session.
 * `capabilities` only decide what the screens show.
 */

export type Capability =
  | 'company.view'
  | 'profile.edit'
  | 'branches.manage'
  | 'members.view'
  | 'members.manage'
  | 'departments.manage'
  | 'subscription.view'
  | 'activity.view'
  | 'settings.manage';

export interface CompanyProfile {
  id: string;
  displayName: string;
  legalName: string | null;
  englishName: string | null;
  taxId: string | null;
  registrationNumber: string | null;
  phone: string | null;
  website: string | null;
  contactEmail: string | null;
  industry: SignupIndustry | null;
  timezone: string;
  defaultLocale: Locale;
  status: CompanyStatus;
  onboardingStatus: 'IN_PROGRESS' | 'COMPLETED';
  isDemo: boolean;
  createdAt: string;
  activatedAt: string | null;
  /** `version` changes whenever the logo does (cache key). */
  logo: { version: string } | null;
}

export type Attention =
  | { code: 'PROFILE_INCOMPLETE'; fields: ('legalName' | 'taxId' | 'phone')[] }
  | { code: 'ONLY_OWNER' }
  | { code: 'DEPARTMENTS_UNASSIGNED'; departments: DepartmentCode[] }
  | { code: 'INVITATIONS_PENDING'; count: number }
  | { code: 'INVITATIONS_EXPIRED'; count: number }
  | { code: 'PERIOD_ENDING'; endsAt: string };

export interface ControlOverview {
  company: CompanyProfile;
  me: {
    memberId: string;
    role: CompanyRole;
    jobTitle: string | null;
    capabilities: Capability[];
    /** Departments this person may open in CORE Operations. */
    departments: DepartmentCode[];
  };
  headOffice: BranchInfo | null;
  /** The package — never its price (that is on the subscription page, for those allowed). */
  plan: {
    plan: PlanCode;
    status: SubscriptionStatus;
    billingCycle: BillingCycleCode;
    maxDepartments: number | 'CUSTOM';
    executiveAllowed: boolean;
  } | null;
  departments: { enabled: DepartmentCode[]; unassigned: DepartmentCode[] };
  counts: {
    branches: { active: number; total: number };
    members: { active: number; deactivated: number };
    invitations: { open: number; expired: number };
  };
  setup: {
    steps: { id: 'profile' | 'logo' | 'team' | 'departments'; done: boolean; optional?: boolean }[];
    complete: boolean;
  };
  attention: Attention[];
  access: { canEnterCore: boolean };
}

export interface ProfileUpdate {
  displayName?: string;
  legalName?: string;
  englishName?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  phone?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  industry?: SignupIndustry | null;
  headOffice?: {
    addressLine1: string;
    addressLine2?: string;
    subdistrict?: string;
    district?: string;
    province: string;
    postalCode: string;
    countryCode: string;
  };
}

export interface BranchList {
  branches: BranchInfo[];
  /** The next free code, proposed for a new branch. */
  suggestedCode: string | null;
  canManage: boolean;
}

export interface BranchInput {
  code?: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  province: string;
  postalCode: string;
  countryCode: string;
  phone?: string | null;
}

export type MemberStatus = 'ACTIVE' | 'DEACTIVATED';

export interface Member {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  role: CompanyRole;
  status: MemberStatus;
  accountStatus: string;
  joinedAt: string;
  deactivatedAt: string | null;
  lastLoginAt: string | null;
  departments: { code: DepartmentCode; primary: boolean; active: boolean }[];
  isOwner: boolean;
  isSelf: boolean;
  /** Whether the caller may change this person (decided by the server). */
  canManage: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  role: CompanyRole;
  locale: Locale | null;
  state: 'OPEN' | 'EXPIRED';
  invitedBy: { email: string; fullName: string | null };
  createdAt: string;
  expiresAt: string;
}

export interface MemberList {
  members: Member[];
  invitations: Invitation[];
  assignableRoles: CompanyRole[];
  canManage: boolean;
  enabledDepartments: DepartmentCode[];
  defaultLocale: Locale;
}

export type DepartmentState = 'ENABLED' | 'AVAILABLE' | 'NOT_IN_PACKAGE';

export interface DepartmentConfig {
  enabled: DepartmentCode[];
  entitlements: Entitlements | null;
  departments: { code: DepartmentCode; state: DepartmentState; assigned: number }[];
  canManage: boolean;
}

export interface SubscriptionSummary {
  subscription: SubscriptionInfo;
  entitlements: Entitlements;
  departments: { enabled: DepartmentCode[] };
  branches: { active: number; total: number };
  priceVisible: boolean;
}

export interface ActivityItem {
  id: string;
  kind: 'admin' | 'security';
  type: string;
  actor:
    | { kind: 'member'; email: string; fullName: string | null }
    | { kind: 'platform' }
    | { kind: 'system' };
  entityType: string;
  details: Record<string, unknown>;
  occurredAt: string;
}

export interface CompanySettings {
  timezone: string;
  defaultLocale: Locale;
}

export interface BranchContext {
  company: { id: string; displayName: string };
  role: CompanyRole;
  branches: BranchInfo[];
  selected: BranchInfo | null;
  needsSelection: boolean;
  departments: DepartmentCode[];
}

const C = '/api/v1/company';
const id = (v: string) => encodeURIComponent(v);

export const controlApi = {
  overview: () => apiRequest<ControlOverview>('GET', `${C}/control`),
  updateProfile: (body: ProfileUpdate) =>
    apiRequest<ControlOverview & { changed: string[] }>('PATCH', `${C}/current/profile`, body),
  uploadLogo: (contentType: string, data: string) =>
    apiRequest<{ logo: { version: string } }>('PUT', `${C}/current/logo`, { contentType, data }),
  removeLogo: () => apiRequest<{ logo: null }>('DELETE', `${C}/current/logo`),

  branches: () => apiRequest<BranchList>('GET', `${C}/current/branches`),
  createBranch: (body: BranchInput) =>
    apiRequest<{ branch: BranchInfo }>('POST', `${C}/current/branches`, body),
  updateBranch: (branchId: string, body: Partial<BranchInput>) =>
    apiRequest<{ branch: BranchInfo }>('PATCH', `${C}/current/branches/${id(branchId)}`, body),
  setBranchActive: (branchId: string, active: boolean) =>
    apiRequest<{ branch: BranchInfo }>(
      'POST',
      `${C}/current/branches/${id(branchId)}/${active ? 'reactivate' : 'deactivate'}`,
      {},
    ),

  members: () => apiRequest<MemberList>('GET', `${C}/current/members`),
  updateMember: (memberId: string, body: { role?: CompanyRole; jobTitle?: string | null }) =>
    apiRequest<MemberList>('PATCH', `${C}/current/members/${id(memberId)}`, body),
  setMemberActive: (memberId: string, active: boolean) =>
    apiRequest<MemberList>(
      'POST',
      `${C}/current/members/${id(memberId)}/${active ? 'reactivate' : 'deactivate'}`,
      {},
    ),
  setMemberDepartments: (
    memberId: string,
    departments: DepartmentCode[],
    primary: DepartmentCode | null,
  ) =>
    apiRequest<MemberList>('PUT', `${C}/current/members/${id(memberId)}/departments`, {
      departments,
      primary,
    }),
  invite: (body: { email: string; role: CompanyRole; locale: Locale }) =>
    apiRequest<{ id: string; email: string; role: CompanyRole; expiresAt: string }>(
      'POST',
      `${C}/invitations`,
      body,
    ),
  revokeInvitation: (invitationId: string) =>
    apiRequest<{ status: 'revoked' }>('POST', `${C}/invitations/${id(invitationId)}/revoke`, {}),

  departments: () => apiRequest<DepartmentConfig>('GET', `${C}/current/departments`),
  setDepartments: (departments: DepartmentCode[]) =>
    apiRequest<DepartmentConfig>('PUT', `${C}/current/departments`, { departments }),

  subscription: () => apiRequest<SubscriptionSummary>('GET', `${C}/current/subscription`),

  activity: (scope: 'all' | 'admin' | 'security') =>
    apiRequest<{ items: ActivityItem[] }>('GET', `${C}/current/activity?scope=${scope}&limit=60`),

  settings: () => apiRequest<CompanySettings>('GET', `${C}/current/settings`),
  updateSettings: (body: Partial<CompanySettings>) =>
    apiRequest<CompanySettings>('PATCH', `${C}/current/settings`, body),

  context: () => apiRequest<BranchContext>('GET', `${C}/context`),
  selectBranch: (branchId: string) =>
    apiRequest<BranchContext>('POST', `${C}/context/branch`, { branchId }),
};

/** The logo URL for an <img> (the session cookie travels; `v` busts the cache). */
export const logoUrl = (version: string) =>
  `${API_URL}${C}/current/logo?v=${encodeURIComponent(version)}`;

export const can = (capabilities: readonly Capability[], c: Capability) => capabilities.includes(c);
