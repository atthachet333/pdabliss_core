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
 * Effective permission codes only decide what the screens show.
 */

/**
 * EP27 permission codes (backend/src/permissions/catalog.ts is the source of
 * truth). The server sends each person's EFFECTIVE codes; the screens only
 * use them to show, disable or explain actions — every call is checked again.
 */
export type AdminPermission =
  | 'company.profile.view'
  | 'company.profile.edit'
  | 'company.branches.view'
  | 'company.branches.manage'
  | 'company.members.view'
  | 'company.members.manage'
  | 'company.departments.manage'
  | 'company.permissions.view'
  | 'company.permissions.manage'
  | 'company.subscription.view'
  | 'company.activity.view'
  | 'company.settings.manage'
  /** EP28: company-wide master-data administration (Owner, System Admin). */
  | 'company.master_data.manage';
type DepartmentPrefix =
  'sales' | 'operations' | 'warehouse' | 'purchasing' | 'accounting' | 'executive';
export type PermissionCode = AdminPermission | `${DepartmentPrefix}.${string}.${string}`;

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
  | { code: 'PERIOD_ENDING'; endsAt: string }
  /** EP26: active people whose branch access leaves them no active branch. */
  | { code: 'MEMBERS_WITHOUT_BRANCH'; count: number }
  | { code: 'BRANCHES_INACTIVE'; count: number };

export interface ControlOverview {
  company: CompanyProfile;
  me: {
    memberId: string;
    role: CompanyRole;
    jobTitle: string | null;
    /** EP27: this person's effective permission codes. */
    permissions: PermissionCode[];
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

/** Who works in a branch (EP26): active people with access, and their departments. */
export interface BranchAccessSummary {
  people: number;
  departments: DepartmentCode[];
}

export interface BranchList {
  branches: (BranchInfo & { access: BranchAccessSummary })[];
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

/** EP26 branch access: every active branch, or the listed ones. */
export type BranchScope = 'ALL_BRANCHES' | 'SELECTED_BRANCHES';

/** A branch named inside another record (access lists, invitations). */
export interface BranchRef {
  id: string;
  code: string;
  name: string;
  type: 'HEAD_OFFICE' | 'BRANCH';
  status: string;
}

export interface BranchAccess {
  scope: BranchScope;
  /** Empty for ALL_BRANCHES. */
  branches: BranchRef[];
}

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
  /** EP26: where this person may work (the owner is always ALL_BRANCHES). */
  branchAccess: BranchAccess;
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
  /** EP26 paging (the list is searched and filtered on the server). */
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  summary: { active: number; deactivated: number };
  invitations: Invitation[];
  branches: BranchRef[];
  assignableRoles: CompanyRole[];
  canManage: boolean;
  enabledDepartments: DepartmentCode[];
  defaultLocale: Locale;
}

export interface MemberQuery {
  q?: string;
  role?: CompanyRole | '';
  status?: MemberStatus | '';
  department?: DepartmentCode | '';
  branch?: string;
  page?: number;
  pageSize?: number;
}

export type MemberProtection = 'OWNER_PROTECTED' | 'SELF_CHANGE' | 'PEER_ADMIN';

export interface MemberDetail {
  member: Member;
  /** Why the caller may not change this person; null when they may (or only read). */
  protection: MemberProtection | null;
  assignableRoles: CompanyRole[];
  enabledDepartments: DepartmentCode[];
  branches: BranchRef[];
  history: ActivityItem[];
  canManage: boolean;
}

export interface BranchDetail {
  branch: BranchInfo;
  access: BranchAccessSummary & { allBranches: number; selected: number };
  /** null when the caller may not see people. */
  people:
    | {
        id: string;
        fullName: string | null;
        email: string;
        role: CompanyRole;
        scope: BranchScope;
        departments: { code: DepartmentCode; primary: boolean; active: boolean }[];
      }[]
    | null;
  peopleTotal: number | null;
  enabledDepartments: DepartmentCode[];
  canManage: boolean;
  canManagePeople: boolean;
}

export type InvitationState = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';

export interface InvitationRecord {
  id: string;
  email: string;
  role: CompanyRole;
  locale: Locale | null;
  state: InvitationState;
  departments: DepartmentCode[];
  branchAccess: BranchAccess;
  invitedBy: { email: string; fullName: string | null };
  acceptedBy: { email: string; fullName: string | null } | null;
  resent: boolean;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  canManage: boolean;
}

export interface InvitationList {
  invitations: InvitationRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  counts: Record<InvitationState, number>;
  canManage: boolean;
}

export interface InvitationInput {
  email: string;
  role: CompanyRole;
  locale: Locale;
  departments: DepartmentCode[];
  branchScope: BranchScope;
  branchIds?: string[];
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

/* ---- EP27 permission administration ---------------------------------- */

export type PermissionNamespace = 'COMPANY_ADMIN' | DepartmentCode;
export type PermissionTier = 'READ' | 'OPERATE' | 'MANAGE';
export type PermissionSource =
  'INVARIANT' | 'ROLE_DEFAULT' | 'ALLOW_OVERRIDE' | 'DENY_OVERRIDE' | 'NONE';
export type PermissionBlock = 'DEPARTMENT_DISABLED' | 'NOT_IN_PACKAGE' | 'NOT_ASSIGNED';
export type PermissionEffect = 'ALLOW' | 'DENY';

export interface PermissionDefinition {
  code: PermissionCode;
  namespace: PermissionNamespace;
  /** `<namespace>.<resource>`, the grouping key. */
  resource: string;
  action: string;
  scope: 'COMPANY' | 'BRANCH';
  tier: PermissionTier;
  /** Only operational permissions take per-member exceptions. */
  overridable: boolean;
}

export interface PermissionProfiles {
  catalog: PermissionDefinition[];
  roles: {
    role: CompanyRole;
    admin: AdminPermission[];
    operational: { tiers: PermissionTier[]; requiresAssignment: boolean };
  }[];
  enabledDepartments: DepartmentCode[];
  executiveAllowed: boolean;
  canManage: boolean;
}

export interface PermissionState {
  code: PermissionCode;
  effective: boolean;
  roleDefault: boolean;
  override: PermissionEffect | null;
  source: PermissionSource;
  blocked: PermissionBlock | null;
}

export interface MemberPermissions {
  member: {
    id: string;
    fullName: string | null;
    email: string;
    role: CompanyRole;
    status: MemberStatus;
    isOwner: boolean;
    isSelf: boolean;
  };
  assignedDepartments: DepartmentCode[];
  enabledDepartments: DepartmentCode[];
  executiveAllowed: boolean;
  permissions: PermissionState[];
  protection: MemberProtection | null;
  canManage: boolean;
}

export interface PermissionChange {
  permission: PermissionCode;
  /** null removes the exception (back to the role default). */
  effect: PermissionEffect | null;
}

export interface BranchContext {
  company: { id: string; displayName: string };
  role: CompanyRole;
  /** EP26: the person's branch scope. */
  scope?: BranchScope;
  /** Only branches this person may work in (server-filtered). */
  branches: BranchInfo[];
  selected: BranchInfo | null;
  needsSelection: boolean;
  /** EP26: set when no active branch is open to this person. */
  blocked?: 'NO_BRANCH_ACCESS' | null;
  departments: DepartmentCode[];
  /** EP27: effective permission codes (to show actions; the server checks again). */
  permissions?: PermissionCode[];
}

const C = '/api/v1/company';
const id = (v: string) => encodeURIComponent(v);

/** `?a=1&b=2` from the set values (empty ones are left out). */
const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

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
  branchDetail: (branchId: string) =>
    apiRequest<BranchDetail>('GET', `${C}/current/branches/${id(branchId)}/detail`),
  setBranchActive: (branchId: string, active: boolean) =>
    apiRequest<{ branch: BranchInfo }>(
      'POST',
      `${C}/current/branches/${id(branchId)}/${active ? 'reactivate' : 'deactivate'}`,
      {},
    ),

  members: (q: MemberQuery = {}) =>
    apiRequest<MemberList>('GET', `${C}/current/members${query({ ...q })}`),
  member: (memberId: string) =>
    apiRequest<MemberDetail>('GET', `${C}/current/members/${id(memberId)}`),
  setMemberBranches: (memberId: string, branchScope: BranchScope, branchIds: string[]) =>
    apiRequest<MemberDetail>('PUT', `${C}/current/members/${id(memberId)}/branches`, {
      branchScope,
      ...(branchScope === 'SELECTED_BRANCHES' ? { branchIds } : {}),
    }),
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
  invite: (body: InvitationInput) =>
    apiRequest<{ id: string; email: string; role: CompanyRole; expiresAt: string }>(
      'POST',
      `${C}/invitations`,
      body,
    ),
  invitations: (state: InvitationState | 'ALL', page = 1) =>
    apiRequest<InvitationList>(
      'GET',
      `${C}/current/invitations${query({ state, page, pageSize: 25 })}`,
    ),
  resendInvitation: (invitationId: string) =>
    apiRequest<{ id: string; email: string; role: CompanyRole; expiresAt: string }>(
      'POST',
      `${C}/invitations/${id(invitationId)}/resend`,
      {},
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

  permissionProfiles: () => apiRequest<PermissionProfiles>('GET', `${C}/current/permissions`),
  memberPermissions: (memberId: string) =>
    apiRequest<MemberPermissions>('GET', `${C}/current/members/${id(memberId)}/permissions`),
  setMemberPermissions: (memberId: string, changes: PermissionChange[]) =>
    apiRequest<MemberPermissions>('PUT', `${C}/current/members/${id(memberId)}/permissions`, {
      changes,
    }),

  context: () => apiRequest<BranchContext>('GET', `${C}/context`),
  selectBranch: (branchId: string) =>
    apiRequest<BranchContext>('POST', `${C}/context/branch`, { branchId }),
};

/** The logo URL for an <img> (the session cookie travels; `v` busts the cache). */
export const logoUrl = (version: string) =>
  `${API_URL}${C}/current/logo?v=${encodeURIComponent(version)}`;

export const can = (permissions: readonly string[], p: PermissionCode) => permissions.includes(p);
