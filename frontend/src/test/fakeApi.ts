import { vi } from 'vitest';
import type { Identity, SessionRow } from '@/features/auth/api';
import type { CompanyInfo, Onboarding } from '@/features/company/api';

/*
 * A fake account API for component tests (EP23): routes `METHOD /path` to a
 * canned or computed JSON response and records every call. Nothing reaches
 * a network. src/test/setup.ts restores the offline fetch after each test.
 */

export interface Reply {
  status: number;
  body: unknown;
}
type Handler = Reply | ((body: unknown, query: URLSearchParams) => Reply | Promise<Reply>);
export interface Call {
  method: string;
  path: string;
  body: unknown;
  /** The query string, as an object (EP24.1: explorer search and filters). */
  query: Record<string, string>;
  credentials: RequestCredentials | undefined;
}

export const ok = (body: unknown): Reply => ({ status: 200, body });
export const fail = (status: number, code: string, details?: Record<string, unknown>): Reply => ({
  status,
  body: { error: { code, message: code, ...(details ? { details } : {}) } },
});

export function fakeApi(handlers: Record<string, Handler>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const { pathname, searchParams } = new URL(url);
      const method = init?.method ?? 'GET';
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({
        method,
        path: pathname,
        body,
        query: Object.fromEntries(searchParams),
        credentials: init?.credentials,
      });
      const handler = handlers[`${method} ${pathname}`];
      const reply = !handler
        ? fail(404, 'ROUTE_NOT_FOUND')
        : typeof handler === 'function'
          ? await handler(body, searchParams)
          : handler;
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return { calls, called: (key: string) => calls.filter((c) => `${c.method} ${c.path}` === key) };
}

export function identity(
  overrides: {
    platformRole?: Identity['platformRole'];
    company?: Identity['company'];
    planIntent?: string | null;
    email?: string;
    fullName?: string | null;
  } = {},
): Identity {
  const platformRole = overrides.platformRole ?? null;
  const company = overrides.company ?? null;
  return {
    user: {
      id: 'u_1',
      email: overrides.email ?? 'person@example.com',
      fullName: overrides.fullName === undefined ? 'Person Example' : overrides.fullName,
      phone: '+66812345678',
      jobFunction: null,
      signup: null,
      locale: 'th',
      status: 'ACTIVE',
      emailVerified: true,
      createdAt: '2026-10-01T03:00:00.000Z',
    },
    platformRole,
    company,
    onboarding: {
      state: platformRole ? 'platform_operator' : company ? 'company_ready' : 'onboarding_required',
      planIntent: overrides.planIntent ?? null,
    },
    session: {
      id: 's_1',
      privileged: !!platformRole,
      createdAt: '2026-10-26T03:00:00.000Z',
      expiresAt: '2026-10-26T03:30:00.000Z',
      stepUpValidUntil: null,
    },
  };
}

export const SESSIONS: SessionRow[] = [
  {
    id: 's_1',
    current: true,
    createdAt: '2026-10-26T03:00:00.000Z',
    lastSeenAt: '2026-10-26T03:05:00.000Z',
    expiresAt: '2026-11-02T03:05:00.000Z',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36',
  },
];

/** Handlers for a signed-in browser. */
export function signedIn(who: Identity): Record<string, Handler> {
  return {
    'GET /api/v1/auth/me': ok({ identity: who }),
    'POST /api/v1/auth/logout': ok({ status: 'signed_out' }),
    'POST /api/v1/auth/logout-all': ok({ status: 'signed_out_everywhere' }),
    'GET /api/v1/auth/sessions': ok({ sessions: SESSIONS }),
  };
}

export const signedOut: Record<string, Handler> = {
  'GET /api/v1/auth/me': fail(401, 'UNAUTHENTICATED'),
};

/* EP24 company fixtures — shaped like the real API (backend/src/company/service.ts). */

export const DEMO_ONBOARDING: Onboarding = {
  stage: 'ACTIVE',
  selectedPlan: null,
  company: {
    id: 'c1',
    displayName: 'PDA BLISS CORE DEMO COMPANY',
    isDemo: true,
    role: 'COMPANY_OWNER',
  },
  canEnterCore: true,
};

export const DEMO_COMPANY: CompanyInfo = {
  company: {
    id: 'c1',
    displayName: 'PDA BLISS CORE DEMO COMPANY',
    legalName: 'PDA BLISS CORE DEMO COMPANY (ข้อมูลสาธิต — ไม่ใช่บริษัทจริง)',
    taxId: null,
    registrationNumber: null,
    status: 'ACTIVE',
    onboardingStatus: 'COMPLETED',
    isDemo: true,
    createdAt: '2026-10-26T03:00:00.000Z',
    activatedAt: '2026-10-26T03:00:00.000Z',
  },
  role: 'COMPANY_OWNER',
  headOffice: {
    id: 'b1',
    code: '00000',
    name: 'สำนักงานใหญ่ (ข้อมูลตัวอย่าง)',
    type: 'HEAD_OFFICE',
    status: 'ACTIVE',
    address: {
      line1: '99 ถนนตัวอย่าง (ข้อมูลสาธิต)',
      line2: null,
      subdistrict: 'บางกระสอ',
      district: 'เมืองนนทบุรี',
      province: 'นนทบุรี',
      postalCode: '11000',
      countryCode: 'TH',
    },
    phone: null,
  },
  departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
  subscription: {
    id: 's1',
    plan: 'PROFESSIONAL',
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    monthlyPriceThb: 999,
    catalogVersion: 1,
    createdAt: '2026-10-26T03:00:00.000Z',
    activatedAt: '2026-10-26T03:00:00.000Z',
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  },
  entitlements: {
    plan: 'PROFESSIONAL',
    catalogVersion: 1,
    maxDepartments: 6,
    executiveAllowed: true,
    storage: { gb: 30 },
    api: 'INCLUDED',
    allBranchesIncluded: true,
    warehouseLotExpiryFefo: 'INCLUDED_WITH_WAREHOUSE',
  },
  access: { canEnterCore: true },
};
