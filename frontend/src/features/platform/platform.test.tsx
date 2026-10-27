import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PlatformOverview } from '@/features/auth/api';
import type { PlatformCompanyDetail, PlatformCompanyRow } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { resetIdentityForTests } from '@/features/auth/session';
import { renderRoute } from '@/test/render';

/*
 * EP24.1 Platform Control Center: overview (real counts only), Company
 * Explorer (server search / filters / cursor paging, URL state), Platform
 * Inspection (explicitly not impersonation), authority levels and the four
 * error kinds. Server-side authorization is tested in
 * backend/test/platform-explorer.test.ts — the UI is never the boundary.
 */

const OVERVIEW: PlatformOverview = {
  operator: { email: 'owner@pdabliss.test', role: 'PLATFORM_OWNER' },
  users: { ACTIVE: 9, PENDING_VERIFICATION: 2 },
  companies: {
    customer: 3,
    demo: 1,
    byStatus: { PENDING_SUBSCRIPTION: 2, ACTIVE: 1, SUSPENDED: 0, CLOSED: 0 },
    onboarding: { IN_PROGRESS: 1, COMPLETED: 2 },
  },
  subscriptions: { PENDING: 2, ACTIVE: 1 },
  customerAccounts: { total: 7, byStatus: { ACTIVE: 5, PENDING_VERIFICATION: 2 } },
  demoAccounts: 4,
  operators: { PLATFORM_OWNER: 1, PLATFORM_ADMIN: 1 },
  attention: {
    readyToActivate: 1,
    onboardingIncomplete: 1,
    awaitingCompany: 2,
    unverifiedAccounts: 2,
    suspendedCompanies: 0,
    suspendedAccounts: 0,
  },
  activeSessions: 4,
};

const row = (i: number, extra: Partial<PlatformCompanyRow> = {}): PlatformCompanyRow => ({
  id: `c${i}`,
  name: `Company ${i}`,
  legalName: `Company ${i} Co., Ltd.`,
  isDemo: false,
  status: 'PENDING_SUBSCRIPTION',
  onboardingStatus: 'COMPLETED',
  owner: `owner${i}@example.com`,
  ownerName: `Owner ${i}`,
  plan: 'STARTER',
  subscriptionStatus: 'PENDING',
  billingCycle: 'MONTHLY',
  maxDepartments: 2,
  enabledDepartments: ['SALES', 'WAREHOUSE'],
  members: 1,
  departments: 2,
  branches: 1,
  createdAt: '2026-10-27T03:00:00.000Z',
  lastActivityAt: '2026-10-27T03:05:00.000Z',
  ...extra,
});

const DETAIL: PlatformCompanyDetail = {
  company: {
    id: 'c1',
    displayName: 'Siam Trade',
    legalName: 'บริษัท สยามเทรด จำกัด',
    taxId: '0105536000011',
    registrationNumber: null,
    status: 'PENDING_SUBSCRIPTION',
    onboardingStatus: 'COMPLETED',
    isDemo: false,
    createdAt: '2026-10-27T03:00:00.000Z',
    activatedAt: null,
  },
  owner: {
    email: 'owner1@example.com',
    fullName: 'สมชาย เจ้าของ',
    phone: '+66812345678',
    signup: {
      companyName: 'สยามเทรด',
      industry: 'DISTRIBUTION',
      teamSize: 'SIZE_51_200',
      preferredContact: 'LINE',
      lineId: '@siamtrade',
      interests: ['WAREHOUSE'],
      note: 'สต็อกไม่ตรงกับบัญชี',
    },
  },
  branches: [
    {
      id: 'b1',
      code: '00000',
      name: 'สำนักงานใหญ่',
      type: 'HEAD_OFFICE',
      status: 'ACTIVE',
      address: {
        line1: '1 ถนนทดสอบ',
        line2: null,
        subdistrict: null,
        district: null,
        province: 'นนทบุรี',
        postalCode: '11000',
        countryCode: 'TH',
      },
      phone: null,
    },
  ],
  departments: ['SALES', 'WAREHOUSE'],
  departmentStates: [
    { code: 'SALES', state: 'ENABLED' },
    { code: 'OPERATIONS', state: 'NOT_ENABLED' },
    { code: 'WAREHOUSE', state: 'ENABLED' },
    { code: 'PURCHASING', state: 'NOT_ENABLED' },
    { code: 'ACCOUNTING', state: 'NOT_ENABLED' },
    { code: 'EXECUTIVE', state: 'NOT_IN_PACKAGE' },
  ],
  subscriptions: [
    {
      id: 's1',
      plan: 'STARTER',
      status: 'PENDING',
      billingCycle: 'MONTHLY',
      monthlyPriceThb: 399,
      catalogVersion: 1,
      createdAt: '2026-10-27T03:00:00.000Z',
      activatedAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  ],
  entitlements: {
    plan: 'STARTER',
    catalogVersion: 1,
    maxDepartments: 2,
    executiveAllowed: false,
    storage: { gb: 3 },
    api: 'NONE',
    allBranchesIncluded: true,
    warehouseLotExpiryFefo: 'INCLUDED_WITH_WAREHOUSE',
  },
  members: [
    {
      email: 'owner1@example.com',
      fullName: 'สมชาย เจ้าของ',
      jobFunction: 'OWNER',
      status: 'ACTIVE',
      role: 'COMPANY_OWNER',
      joinedAt: '2026-10-27T03:00:00.000Z',
      lastLoginAt: '2026-10-27T03:10:00.000Z',
    },
  ],
  activity: [
    {
      id: 'a2',
      action: 'PLATFORM_COMPANY_INSPECTED',
      actorScope: 'platform_owner',
      actor: { email: 'owner@pdabliss.test', fullName: 'Platform Owner' },
      entityType: 'Company',
      details: { mode: 'read_only' },
      occurredAt: '2026-10-27T04:00:00.000Z',
    },
    {
      id: 'a1',
      action: 'COMPANY_CREATED',
      actorScope: 'customer',
      actor: { email: 'owner1@example.com', fullName: 'สมชาย เจ้าของ' },
      entityType: 'Company',
      details: { plan: 'STARTER' },
      occurredAt: '2026-10-27T03:00:00.000Z',
    },
  ],
  security: [
    {
      id: 'e1',
      type: 'PASSWORD_RESET_SUCCESS',
      email: 'owner1@example.com',
      occurredAt: '2026-10-27T03:20:00.000Z',
    },
  ],
  access: { canEnterCore: false },
  developmentActivation: true,
};

const owner = () =>
  signedIn(identity({ platformRole: 'PLATFORM_OWNER', email: 'owner@pdabliss.test' }));
const admin = () =>
  signedIn(identity({ platformRole: 'PLATFORM_ADMIN', email: 'admin@pdabliss.test' }));

const overviewApi = {
  'GET /api/v1/platform/overview': ok(OVERVIEW),
  'GET /api/v1/platform/companies': (_body: unknown, query: URLSearchParams) =>
    ok({
      companies:
        query.get('demo') === 'only'
          ? [
              row(9, {
                isDemo: true,
                name: 'PDA BLISS CORE DEMO COMPANY',
                plan: 'PROFESSIONAL',
                status: 'ACTIVE',
                subscriptionStatus: 'ACTIVE',
                members: 4,
                departments: 6,
              }),
            ]
          : [row(1, { status: 'ACTIVE', subscriptionStatus: 'ACTIVE' }), row(2), row(3)],
      total: query.get('demo') === 'only' ? 1 : 3,
      nextCursor: null,
      developmentActivation: true,
    }),
  'GET /api/v1/platform/activity': ok({
    items: [
      {
        id: 'c_1',
        kind: 'company',
        type: 'PLATFORM_COMPANY_INSPECTED',
        email: 'owner@pdabliss.test',
        company: { id: 'c1', name: 'Company 1', isDemo: false },
        actorScope: 'platform_owner',
        occurredAt: '2026-10-27T03:00:00.000Z',
      },
      {
        id: 'a_1',
        kind: 'security',
        type: 'LOGIN_FAILURE',
        email: 'someone@example.com',
        company: null,
        actorScope: null,
        occurredAt: '2026-10-27T02:00:00.000Z',
      },
      {
        // Routine: not "key" activity, so the overview leaves it out.
        id: 'a_2',
        kind: 'security',
        type: 'OTP_SENT',
        email: 'someone@example.com',
        company: null,
        actorScope: null,
        occurredAt: '2026-10-27T01:00:00.000Z',
      },
    ],
  }),
  'GET /api/v1/platform/operators': ok({
    operators: [
      {
        userId: 'u1',
        email: 'owner@pdabliss.test',
        fullName: 'Platform Owner',
        status: 'ACTIVE',
        role: 'PLATFORM_OWNER',
        since: '2026-10-26T03:00:00.000Z',
      },
      {
        userId: 'u2',
        email: 'admin@pdabliss.test',
        fullName: 'Ops Admin',
        status: 'ACTIVE',
        role: 'PLATFORM_ADMIN',
        since: '2026-10-26T03:00:00.000Z',
      },
    ],
  }),
};

/** Scenario A — the development database: no real customers, one demo company. */
const SCENARIO_A: PlatformOverview = {
  ...OVERVIEW,
  companies: {
    customer: 0,
    demo: 1,
    byStatus: { PENDING_SUBSCRIPTION: 0, ACTIVE: 0, SUSPENDED: 0, CLOSED: 0 },
    onboarding: { IN_PROGRESS: 0, COMPLETED: 0 },
  },
  subscriptions: {},
  customerAccounts: { total: 0, byStatus: {} },
  demoAccounts: 4,
  operators: { PLATFORM_OWNER: 1, PLATFORM_ADMIN: 1 },
  attention: {
    readyToActivate: 0,
    onboardingIncomplete: 0,
    awaitingCompany: 0,
    unverifiedAccounts: 0,
    suspendedCompanies: 0,
    suspendedAccounts: 0,
  },
};

const metric = (key: string) => document.querySelector(`[data-metric="${key}"]`);

describe('Platform overview — operator first (EP24.1.2)', () => {
  it('scenario A: zero customers reads as zero customers, demo kept apart and labelled', async () => {
    fakeApi({
      ...owner(),
      ...overviewApi,
      'GET /api/v1/platform/overview': ok(SCENARIO_A),
      'GET /api/v1/platform/companies': (_b: unknown, q: URLSearchParams) =>
        ok({
          companies:
            q.get('demo') === 'only'
              ? [
                  row(9, {
                    isDemo: true,
                    name: 'PDA BLISS CORE DEMO COMPANY',
                    plan: 'PROFESSIONAL',
                    members: 4,
                    departments: 6,
                  }),
                ]
              : [],
          total: q.get('demo') === 'only' ? 1 : 0,
          nextCursor: null,
          developmentActivation: true,
        }),
    });
    renderRoute('/platform');
    await screen.findByRole('heading', { level: 1, name: 'Platform Control Center' });
    await waitFor(() => expect(metric('companies')).toHaveAttribute('data-count', '0'));
    expect(metric('accounts')).toHaveAttribute('data-count', '0');
    // Demo and the platform team are counted beside the customer figures, never inside.
    expect(document.querySelector('[data-separate-demo]')).toHaveTextContent(
      'สาธิต · 1 บริษัท · 4 บัญชี',
    );
    expect(document.querySelector('[data-separate-operators]')).toHaveTextContent(
      '1 Owner · 1 Admin',
    );
    // Deliberate empty states, not empty boxes.
    expect(screen.getByText('ยังไม่มีบริษัทลูกค้า')).toBeInTheDocument();
    expect(screen.getByText(/บริษัทสาธิตแสดงแยกไว้ด้านล่าง/)).toBeInTheDocument();
    expect(document.querySelector('[data-path-empty]')).toBeInTheDocument();
    expect(document.querySelector('[data-attention-none]')).toBeInTheDocument();
    expect(document.querySelector('[data-attention-count]')).toBeNull();
    // The demo company lives only in the demo environment.
    const demo = document.querySelector('[data-demo-environment]')!;
    expect(demo).toHaveTextContent('PDA BLISS CORE DEMO COMPANY');
    expect(demo).toHaveTextContent('สาธิต');
    expect(demo).toHaveTextContent('บัญชีสาธิต 4 บัญชี');
    expect(document.querySelector('[data-latest]')).not.toHaveTextContent('DEMO COMPANY');
    expect(document.body.textContent).not.toMatch(/MRR|ARR|revenue|รายได้|growth/i);
  });

  it('scenario B: customer metrics, path, attention and latest customers link into the explorer', async () => {
    const api = fakeApi({ ...owner(), ...overviewApi });
    renderRoute('/platform');
    await waitFor(() => expect(metric('companies')).toHaveAttribute('data-count', '3'));
    expect(metric('active')).toHaveAttribute('data-count', '1');
    expect(metric('pending')).toHaveAttribute('data-count', '2');
    expect(metric('accounts')).toHaveAttribute('data-count', '7');
    expect(within(metric('pending') as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/platform/companies?demo=exclude&status=PENDING_SUBSCRIPTION',
    );
    // The customer path, from real counts.
    expect(document.querySelector('[data-stage="registered"]')).toHaveAttribute('data-count', '2');
    expect(document.querySelector('[data-stage="setup"]')).toHaveAttribute('data-count', '1');
    // Needs attention: only real, non-zero items; the header shows the counted total.
    expect(document.querySelector('[data-attention-item="readyToActivate"] a')).toHaveAttribute(
      'href',
      '/platform/companies?demo=exclude&status=PENDING_SUBSCRIPTION&onboardingStatus=COMPLETED',
    );
    expect(document.querySelector('[data-attention-item="suspendedCompanies"]')).toBeNull();
    expect(document.querySelector('[data-attention-count]')).toHaveAttribute(
      'data-attention-count',
      '4',
    );
    // Latest customers: customer-only request, rows open the inspection.
    expect(
      api.calls.find((c) => c.path === '/api/v1/platform/companies' && c.query.demo === 'exclude'),
    ).toBeTruthy();
    expect(document.querySelector('[data-latest-row="c1"] a')).toHaveAttribute(
      'href',
      '/platform/companies/c1',
    );
    // Key activity only (OTP_SENT is routine), human label first.
    const activity = document.querySelector('[data-key-activity]')!;
    expect(activity).toHaveTextContent('ทีมแพลตฟอร์มเปิดดูข้อมูล');
    expect(activity).toHaveTextContent('เข้าสู่ระบบไม่สำเร็จ');
    expect(activity.querySelector('[data-type="OTP_SENT"]')).toBeNull();
    // Session details are folded away.
    expect(document.querySelector('[data-session]')).not.toHaveAttribute('open');
  });

  it('PLATFORM_OWNER gets the Operators area; PLATFORM_ADMIN does not', async () => {
    fakeApi({ ...owner(), ...overviewApi });
    renderRoute('/platform');
    await waitFor(() => expect(metric('companies')).toBeInTheDocument());
    expect(document.querySelector('[data-platform-role="PLATFORM_OWNER"]')).toHaveTextContent(
      'Platform Owner',
    );
    expect(screen.getByRole('link', { name: /ผู้ดูแล$/ })).toHaveAttribute(
      'href',
      '/platform/operators',
    );
    cleanup();
    resetIdentityForTests();

    const api = fakeApi({ ...admin(), ...overviewApi });
    renderRoute('/platform');
    await waitFor(() => expect(metric('companies')).toBeInTheDocument());
    expect(document.querySelector('[data-platform-role="PLATFORM_ADMIN"]')).toHaveTextContent(
      'Platform Admin',
    );
    expect(screen.queryByRole('link', { name: /ผู้ดูแล$/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'ดูผู้ดูแลแพลตฟอร์ม' })).toBeNull();
    expect(api.called('GET /api/v1/platform/operators')).toHaveLength(0);
  });

  it('header quick search opens the Company Explorer with the query', async () => {
    fakeApi({ ...owner(), ...overviewApi });
    const { router } = renderRoute('/platform');
    await waitFor(() => expect(metric('companies')).toBeInTheDocument());
    await userEvent.type(screen.getByRole('searchbox', { name: 'ค้นหาบริษัท' }), 'siam{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/platform/companies'));
    expect(router.state.location.search).toBe('?q=siam');
  });

  it('speaks English and Chinese', async () => {
    for (const [lang, locale, title, demoLine] of [
      ['en', 'en', 'Real customers', 'Demo · 1 company · 4 accounts'],
      ['zh', 'zh-CN', '真实客户', '演示 · 1 家公司 · 4 个账户'],
    ] as const) {
      fakeApi({
        ...signedIn({
          ...identity({ platformRole: 'PLATFORM_OWNER' }),
          user: { ...identity().user, locale },
        }),
        ...overviewApi,
        'GET /api/v1/platform/overview': ok(SCENARIO_A),
      });
      renderRoute(`/platform?lang=${lang}`);
      await waitFor(() =>
        expect(document.querySelector('[data-separate-demo]')).toHaveTextContent(demoLine),
      );
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
      expect(document.querySelector('main')!.textContent).not.toMatch(/[฀-๿]/);
      cleanup();
      resetIdentityForTests();
    }
  });

  it('a customer account is sent from every platform route to /account', async () => {
    for (const path of [
      '/platform',
      '/platform/companies',
      '/platform/companies/c1',
      '/platform/activity',
      '/platform/operators',
    ]) {
      fakeApi({ ...signedIn(identity()) });
      const { router } = renderRoute(path);
      await waitFor(() => expect(router.state.location.pathname).toBe('/account'));
      cleanup();
      resetIdentityForTests();
    }
  });

  it('names the error: forbidden, expired session, temporary failure (with retry)', async () => {
    fakeApi({
      ...owner(),
      ...overviewApi,
      'GET /api/v1/platform/overview': fail(403, 'FORBIDDEN'),
    });
    renderRoute('/platform');
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่มีสิทธิ์');
    cleanup();
    resetIdentityForTests();

    fakeApi({
      ...owner(),
      ...overviewApi,
      'GET /api/v1/platform/overview': fail(401, 'UNAUTHENTICATED'),
    });
    renderRoute('/platform');
    expect(await screen.findByRole('alert')).toHaveTextContent('เซสชันหมดอายุ');
    cleanup();
    resetIdentityForTests();

    fakeApi({ ...owner(), ...overviewApi, 'GET /api/v1/platform/overview': fail(500, 'INTERNAL') });
    renderRoute('/platform');
    expect(await screen.findByRole('alert')).toHaveTextContent('ชั่วคราว');
    expect(screen.getByRole('button', { name: 'ลองอีกครั้ง' })).toBeInTheDocument();
  });
});

describe('Platform activity and operators (EP24.1.2)', () => {
  it('activity: one readable timeline with three views over the server feed', async () => {
    const api = fakeApi({ ...owner(), ...overviewApi });
    renderRoute('/platform/activity');
    await screen.findByRole('heading', { level: 1, name: 'กิจกรรมแพลตฟอร์ม' });
    await waitFor(() =>
      expect(document.querySelectorAll('[data-activity-list] > li')).toHaveLength(3),
    );
    expect(document.querySelector('[data-type="OTP_SENT"]')).toHaveTextContent('ส่งรหัสยืนยัน');
    await userEvent.click(screen.getByRole('button', { name: 'การเข้าสู่ระบบและความปลอดภัย' }));
    await waitFor(() =>
      expect(api.calls.at(-1)!.query).toMatchObject({ scope: 'security', limit: '100' }),
    );
    expect(screen.getByRole('button', { name: 'การเข้าสู่ระบบและความปลอดภัย' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('operators: the Owner above, Admins below; an Admin sees why, not an error', async () => {
    fakeApi({ ...owner(), ...overviewApi });
    renderRoute('/platform/operators');
    await screen.findByRole('heading', { level: 1, name: 'ผู้ดูแลแพลตฟอร์ม' });
    await waitFor(() =>
      expect(document.querySelector('[data-operator-group="owner"]')).toHaveTextContent(
        'Platform Owner',
      ),
    );
    expect(document.querySelector('[data-operator-group="admin"]')).toHaveTextContent('Ops Admin');
    cleanup();
    resetIdentityForTests();

    const api = fakeApi({ ...admin(), ...overviewApi });
    renderRoute('/platform/operators');
    await screen.findByRole('heading', { level: 1, name: 'ผู้ดูแลแพลตฟอร์ม' });
    expect(
      screen.getByText('รายชื่อผู้ดูแลแพลตฟอร์มสงวนไว้สำหรับ Platform Owner'),
    ).toBeInTheDocument();
    expect(api.called('GET /api/v1/platform/operators')).toHaveLength(0);
  });
});

describe('Company Explorer (EP24.1)', () => {
  it('searches and filters on the server, keeps the query in the URL, and pages by cursor', async () => {
    const api = fakeApi({
      ...owner(),
      'GET /api/v1/platform/companies': (_body, query) => {
        if (query.get('q') === 'nothing')
          return ok({ companies: [], total: 0, nextCursor: null, developmentActivation: true });
        if (query.get('cursor') === 'c25') {
          return ok({
            companies: [row(26)],
            total: 26,
            nextCursor: null,
            developmentActivation: true,
          });
        }
        const rows = Array.from({ length: 25 }, (_, i) => row(i + 1));
        return ok({ companies: rows, total: 26, nextCursor: 'c25', developmentActivation: true });
      },
    });
    const { router } = renderRoute('/platform/companies');
    await screen.findByRole('heading', { level: 1, name: 'Company Explorer' });
    expect(await screen.findByText('แสดง 25 จาก 26 บริษัท')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-explorer-rows] > li')).toHaveLength(25);
    // Each row is one keyboard-reachable link to its inspection.
    const first = document.querySelector<HTMLAnchorElement>('[data-company-row="c1"]')!;
    expect(first.tagName).toBe('A');
    expect(first).toHaveAttribute('href', '/platform/companies/c1');
    expect(first).toHaveAccessibleName(/Company 1/);

    await userEvent.click(screen.getByRole('button', { name: 'แสดงเพิ่ม' }));
    expect(await screen.findByText('แสดง 26 จาก 26 บริษัท')).toBeInTheDocument();
    expect(api.calls.at(-1)!.query).toMatchObject({ cursor: 'c25', limit: '25' });
    expect(screen.queryByRole('button', { name: 'แสดงเพิ่ม' })).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText('แพ็กเกจ'), 'STARTER');
    await waitFor(() => expect(router.state.location.search).toContain('plan=STARTER'));
    await waitFor(() => expect(api.calls.at(-1)!.query).toMatchObject({ plan: 'STARTER' }));

    await userEvent.type(screen.getByRole('searchbox', { name: 'ค้นหา' }), 'nothing');
    expect(await screen.findByText('ไม่พบบริษัทที่ตรงกับเงื่อนไข')).toBeInTheDocument();
    expect(api.calls.at(-1)!.query).toMatchObject({ q: 'nothing', plan: 'STARTER' });
    await userEvent.click(screen.getAllByRole('button', { name: 'ล้างตัวกรอง' })[0]!);
    await waitFor(() => expect(router.state.location.search).toBe(''));
    // Many real interaction steps: more than the default budget under a parallel run.
  }, 20_000);

  it('opens with filters from the URL (links from the overview)', async () => {
    const api = fakeApi({
      ...admin(),
      'GET /api/v1/platform/companies': ok({
        companies: [row(1)],
        total: 1,
        nextCursor: null,
        developmentActivation: false,
      }),
    });
    renderRoute('/platform/companies?status=SUSPENDED');
    await screen.findByText('แสดง 1 จาก 1 บริษัท');
    expect(api.called('GET /api/v1/platform/companies')[0]!.query).toMatchObject({
      status: 'SUSPENDED',
    });
    expect(screen.getByLabelText('สถานะบริษัท')).toHaveValue('SUSPENDED');
  });

  it('an empty platform says so calmly (not a dashed placeholder)', async () => {
    fakeApi({
      ...owner(),
      'GET /api/v1/platform/companies': ok({
        companies: [],
        total: 0,
        nextCursor: null,
        developmentActivation: true,
      }),
    });
    renderRoute('/platform/companies');
    expect(await screen.findByText('ยังไม่มีบริษัทลูกค้า')).toBeInTheDocument();
    expect(document.querySelector('[data-placeholder]')).toBeNull();
  });
});

describe('Platform Inspection (EP24.1)', () => {
  it('states inspection, not impersonation, and shows the real company facts', async () => {
    fakeApi({ ...owner(), 'GET /api/v1/platform/companies/c1': ok(DETAIL) });
    renderRoute('/platform/companies/c1');
    await screen.findByRole('heading', { level: 1, name: 'Siam Trade' });
    const band = document.querySelector('[data-inspection-band]')!;
    expect(band).toHaveTextContent('Platform Inspection');
    expect(band).toHaveTextContent('ไม่ได้เข้าสู่ระบบในนามบริษัท');
    expect(band).toHaveTextContent('Platform Owner');
    expect(screen.getByRole('link', { name: /กลับไปที่รายการบริษัท/ })).toHaveAttribute(
      'href',
      '/platform/companies',
    );
    // Facts, departments (with the package rule), Warehouse privacy, members, subscription.
    expect(document.querySelector('[data-facts]')).toHaveTextContent('2 / 2');
    expect(document.querySelector('[data-dept="EXECUTIVE"]')).toHaveAttribute(
      'data-state',
      'NOT_IN_PACKAGE',
    );
    expect(document.querySelector('[data-dept="WAREHOUSE"]')).toHaveTextContent('ไม่เห็นต้นทุน');
    expect(document.querySelector('[data-members]')).toHaveTextContent('เจ้าของกิจการ');
    expect(screen.getByText('ราคาในแคตตาล็อก (ตอนสร้าง)')).toBeInTheDocument();
    expect(screen.getByText('ยังไม่มีการชำระเงินในระบบ')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ชำระเงินแล้ว|\bpaid\b/i);
    // Timeline from the audit trail; human labels with codes secondary.
    expect(document.querySelector('[data-step="created"]')).toHaveAttribute('data-done', 'true');
    expect(document.querySelector('[data-step="activated"]')).toHaveAttribute('data-done', 'false');
    expect(document.querySelector('[data-activity]')).toHaveTextContent(
      'ทีมแพลตฟอร์มเปิดดูข้อมูล (อ่านอย่างเดียว)',
    );
    expect(document.querySelector('[data-member-security]')).toHaveTextContent(
      'ตั้งรหัสผ่านใหม่แล้ว',
    );
    // Sign-up context is labelled as self-described.
    expect(document.querySelector('[data-signup-context]')).toHaveTextContent('สยามเทรด');
    expect(document.querySelector('[data-signup-context]')).toHaveTextContent('@siamtrade');
  });

  it('back returns to the exact explorer view it came from', async () => {
    fakeApi({
      ...owner(),
      'GET /api/v1/platform/companies': ok({
        companies: [row(1)],
        total: 1,
        nextCursor: null,
        developmentActivation: true,
      }),
      'GET /api/v1/platform/companies/c1': ok(DETAIL),
    });
    const { router } = renderRoute('/platform/companies?plan=STARTER');
    await screen.findByText('แสดง 1 จาก 1 บริษัท');
    await userEvent.click(document.querySelector<HTMLAnchorElement>('[data-company-row="c1"]')!);
    await screen.findByRole('heading', { level: 1, name: 'Siam Trade' });
    await userEvent.click(screen.getByRole('link', { name: /กลับไปที่รายการบริษัท/ }));
    await waitFor(() => expect(router.state.location.search).toBe('?plan=STARTER'));
  });

  it('development activation only where the server offers it, with the step-up explained', async () => {
    const api = fakeApi({
      ...owner(),
      'GET /api/v1/platform/companies/c1': ok(DETAIL),
      'POST /api/v1/platform/companies/c1/development-activation': fail(403, 'STEP_UP_REQUIRED'),
    });
    renderRoute('/platform/companies/c1');
    await screen.findByRole('heading', { level: 1, name: 'Siam Trade' });
    await userEvent.click(screen.getByRole('button', { name: 'เปิดใช้งาน (พัฒนา/ทดสอบเท่านั้น)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ยืนยันรหัสทางอีเมลอีกครั้ง');
    expect(api.called('POST /api/v1/platform/companies/c1/development-activation')).toHaveLength(1);
    cleanup();
    resetIdentityForTests();

    fakeApi({
      ...owner(),
      'GET /api/v1/platform/companies/c1': ok({ ...DETAIL, developmentActivation: false }),
    });
    renderRoute('/platform/companies/c1');
    await screen.findByRole('heading', { level: 1, name: 'Siam Trade' });
    expect(document.querySelector('[data-dev-activation]')).toBeNull();
  });

  it('an unknown company is "not found", not a blank page', async () => {
    fakeApi({ ...owner(), 'GET /api/v1/platform/companies/nope': fail(404, 'NOT_FOUND') });
    renderRoute('/platform/companies/nope');
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบบริษัทนี้');
    expect(document.querySelector('[data-inspection-band]')).toBeInTheDocument();
  });

  it('speaks English and Chinese', async () => {
    for (const [lang, band, back] of [
      ['en', 'You are inspecting this company at platform level', 'Back to Companies'],
      ['zh', '您正在平台层面查看此公司', '返回公司列表'],
    ] as const) {
      fakeApi({
        ...signedIn({
          ...identity({ platformRole: 'PLATFORM_OWNER' }),
          user: { ...identity().user, locale: lang === 'en' ? 'en' : 'zh-CN' },
        }),
        'GET /api/v1/platform/companies/c1': ok(DETAIL),
      });
      renderRoute(`/platform/companies/c1?lang=${lang}`);
      await screen.findByRole('heading', { level: 1, name: 'Siam Trade' });
      expect(document.querySelector('[data-inspection-band]')).toHaveTextContent(band);
      expect(screen.getByRole('link', { name: new RegExp(back) })).toBeInTheDocument();
      cleanup();
      resetIdentityForTests();
    }
  });
});
