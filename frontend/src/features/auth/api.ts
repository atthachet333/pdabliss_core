import { apiRequest } from '@/lib/api';
import type {
  ContactPreference,
  JobFunction,
  SignupBusiness,
  SignupIndustry,
  SignupInterest,
  SignupTeamSize,
} from './profile';
import type { Locale } from '@/i18n/locales';

/*
 * Typed client for the EP23 account API (/api/v1/auth, /api/v1/platform).
 * Contracts: docs/AUTHENTICATION.md. The browser never sees a session token —
 * it lives in an HttpOnly cookie set by the API.
 */

export type PlatformRole = 'PLATFORM_OWNER' | 'PLATFORM_ADMIN';
export type CompanyRole =
  | 'COMPANY_OWNER'
  | 'SYSTEM_ADMIN'
  | 'EXECUTIVE'
  | 'DEPARTMENT_MANAGER'
  | 'DEPARTMENT_STAFF'
  | 'VIEWER';

export interface Identity {
  user: {
    id: string;
    email: string;
    /** EP24.1: the person's full name (null only for older accounts). */
    fullName: string | null;
    /** E.164; shown to the account holder and platform operators only. */
    phone: string | null;
    /** Self-described — never an authorization input. */
    jobFunction: JobFunction | null;
    /** What the person said about their business at sign-up (lead info; never authorization). */
    signup: {
      companyName: string;
      industry: SignupIndustry;
      teamSize: SignupTeamSize;
      preferredContact: ContactPreference;
      interests: SignupInterest[];
    } | null;
    locale: Locale;
    status: string;
    emailVerified: boolean;
    createdAt: string;
  };
  platformRole: PlatformRole | null;
  company: {
    id: string;
    name: string;
    isDemo: boolean;
    role: CompanyRole;
    /** EP25: DEACTIVATED when the company removed this person's access. */
    memberStatus: 'ACTIVE' | 'DEACTIVATED';
    /** EP25: the company and its subscription are active — the Company Control Center is open. */
    canEnterCore: boolean;
  } | null;
  onboarding: {
    state: 'platform_operator' | 'company_ready' | 'onboarding_required';
    planIntent: string | null;
  };
  session: {
    id: string;
    privileged: boolean;
    createdAt: string;
    expiresAt: string;
    stepUpValidUntil: string | null;
  };
}

export interface Challenge {
  id: string;
  purpose: 'LOGIN' | 'STEP_UP';
  expiresAt: string;
  resendAvailableAt: string;
  maskedEmail: string;
}

export type LoginResponse =
  | { status: 'authenticated'; identity: Identity }
  | { status: 'otp_required'; challenge: Challenge; trustDeviceAllowed: boolean };

export interface SessionRow {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
}

export const PLAN_INTENTS = ['starter', 'business', 'professional', 'enterprise'] as const;
export type PlanIntent = (typeof PLAN_INTENTS)[number];

export function planIntent(value: string | null): PlanIntent | null {
  return (PLAN_INTENTS as readonly string[]).includes(value ?? '') ? (value as PlanIntent) : null;
}

const A = '/api/v1/auth';

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    jobFunction?: JobFunction;
    business: SignupBusiness;
    locale: Locale;
    plan?: PlanIntent;
    acceptTerms: true;
  }) => apiRequest<{ status: 'verification_sent' }>('POST', `${A}/register`, body),
  verifyEmail: (token: string) =>
    apiRequest<{ status: 'verified' | 'already_verified' }>('POST', `${A}/verify-email`, { token }),
  resendVerification: (email: string) =>
    apiRequest<{ status: 'accepted' }>('POST', `${A}/verification/resend`, { email }),
  login: (email: string, password: string) =>
    apiRequest<LoginResponse>('POST', `${A}/login`, { email, password }),
  loginOtp: (challengeId: string, code: string, trustDevice: boolean) =>
    apiRequest<{ status: 'authenticated'; identity: Identity }>('POST', `${A}/login/otp`, {
      challengeId,
      code,
      trustDevice,
    }),
  resendLoginOtp: (challengeId: string) =>
    apiRequest<{ status: 'sent'; challenge: Challenge }>('POST', `${A}/login/otp/resend`, {
      challengeId,
    }),
  forgotPassword: (email: string) =>
    apiRequest<{ status: 'accepted' }>('POST', `${A}/password/forgot`, { email }),
  checkReset: (token: string) =>
    apiRequest<{ status: 'valid' }>('POST', `${A}/password/reset/check`, { token }),
  resetPassword: (token: string, password: string) =>
    apiRequest<{ status: 'password_reset' }>('POST', `${A}/password/reset`, { token, password }),
  me: () => apiRequest<{ identity: Identity }>('GET', `${A}/me`),
  logout: () => apiRequest<{ status: string }>('POST', `${A}/logout`, {}),
  logoutAll: () => apiRequest<{ status: string }>('POST', `${A}/logout-all`, {}),
  sessions: () => apiRequest<{ sessions: SessionRow[] }>('GET', `${A}/sessions`),
  revokeSession: (id: string) =>
    apiRequest<{ status: string }>('DELETE', `${A}/sessions/${encodeURIComponent(id)}`),
  acceptInvitation: (token: string) =>
    apiRequest<{ status: 'accepted'; company: { id: string; name: string }; role: CompanyRole }>(
      'POST',
      `${A}/invitations/accept`,
      { token },
    ),
};

const P = '/api/v1/platform';

type UserStatusCounts = Partial<
  Record<'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED', number>
>;

/** Real platform-wide counts (EP24.1). No revenue or growth — billing does not exist yet. */
export interface PlatformOverview {
  operator: { email: string; role: PlatformRole };
  users: UserStatusCounts;
  companies: {
    /** Customer companies (demo excluded). */
    customer: number;
    demo: number;
    byStatus: Record<'PENDING_SUBSCRIPTION' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED', number>;
    onboarding: Record<'IN_PROGRESS' | 'COMPLETED', number>;
  };
  /** Current subscriptions of customer companies, by status. */
  subscriptions: Partial<Record<'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED', number>>;
  /** Accounts with no platform role that do not belong to a demo company. */
  customerAccounts: { total: number; byStatus: UserStatusCounts };
  /** Accounts of demo companies — never customers (EP24.1.2). */
  demoAccounts: number;
  operators: Record<PlatformRole, number>;
  attention: {
    readyToActivate: number;
    onboardingIncomplete: number;
    awaitingCompany: number;
    unverifiedAccounts: number;
    suspendedCompanies: number;
    suspendedAccounts: number;
  };
  activeSessions: number;
}

export interface PlatformUser {
  id: string;
  email: string;
  fullName: string | null;
  /** Stated at sign-up — lead context, distinct from `company`. */
  signup: { companyName: string; industry: SignupIndustry; teamSize: SignupTeamSize } | null;
  status: string;
  emailVerified: boolean;
  platformRole: PlatformRole | null;
  company: { name: string; isDemo: boolean; role: CompanyRole } | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PlatformOperator {
  userId: string;
  email: string;
  fullName: string | null;
  status: string;
  role: PlatformRole;
  since: string;
}

export interface AuthEventRow {
  id: string;
  type: string;
  email: string | null;
  ipAddress: string | null;
  occurredAt: string;
}

/** One item of the platform activity timeline (EP24.1.2). Safe fields only. */
export interface ActivityItem {
  id: string;
  kind: 'security' | 'company';
  type: string;
  email: string | null;
  company: { id: string; name: string; isDemo: boolean } | null;
  actorScope: string | null;
  occurredAt: string;
}

export type ActivityScope = 'all' | 'security' | 'company';

export const platformApi = {
  activity: (limit: number, scope: ActivityScope = 'all') =>
    apiRequest<{ items: ActivityItem[] }>('GET', `${P}/activity?limit=${limit}&scope=${scope}`),
  overview: () => apiRequest<PlatformOverview>('GET', `${P}/overview`),
  users: () => apiRequest<{ users: PlatformUser[] }>('GET', `${P}/users`),
  audit: () => apiRequest<{ events: AuthEventRow[] }>('GET', `${P}/audit`),
  operators: () => apiRequest<{ operators: PlatformOperator[] }>('GET', `${P}/operators`),
};
