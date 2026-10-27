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
  'GET /api/v1/platform/companies': ok({
    companies: [
      row(1),
      row(2, { isDemo: true, name: 'PDA BLISS CORE DEMO COMPANY', plan: 'PROFESSIONAL' }),
    ],
    total: 2,
    nextCursor: null,
    developmentActivation: true,
  }),
  'GET /api/v1/platform/users': ok({ users: [] }),
  'GET /api/v1/platform/audit': ok({
    events: [
      {
        id: 'e1',
        type: 'LOGIN_SUCCESS',
        email: 'owner@pdabliss.test',
        ipAddress: null,
        occurredAt: '2026-10-27T03:00:00.000Z',
      },
    ],
  }),
  'GET /api/v1/platform/operators': ok({
    operators: [
      {
        userId: 'u1',
        email: 'owner@pdabliss.test',
        fullName: null,
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

describe('Platform overview (EP24.1)', () => {
  it('PLATFORM_OWNER: highest authority, real headline counts, lifecycle rail, owner-only operators', async () => {
    const api = fakeApi({ ...owner(), ...overviewApi });
    renderRoute('/platform');
    await screen.findByRole('heading', { level: 1, name: 'Platform Control Center' });
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    expect(document.querySelector('[data-platform-role="PLATFORM_OWNER"]')).toHaveTextContent(
      'Platform Owner',
    );
    expect(document.querySelector('[data-authority="PLATFORM_OWNER"]')).toBeInTheDocument();
    const headline = await waitFor(() => {
      const el = document.querySelector('[data-headline]');
      expect(el).toHaveTextContent('3');
      return el!;
    });
    expect(headline).toHaveTextContent('บริษัทลูกค้า');
    expect(headline).toHaveTextContent('7');
    // Lifecycle nodes are real counts and link into the filtered explorer.
    const rail = document.querySelector('[data-lifecycle]')!;
    expect(rail.querySelector('[data-stage="onboarding"]')).toHaveAttribute('data-count', '1');
    expect(rail.querySelector('[data-stage="waiting"]')).toHaveAttribute('data-count', '1');
    expect(rail.querySelector('[data-stage="active"]')).toHaveAttribute('data-count', '1');
    expect(within(rail as HTMLElement).getByRole('link', { name: /รอเปิดใช้งาน/ })).toHaveAttribute(
      'href',
      '/platform/companies?status=PENDING_SUBSCRIPTION&onboardingStatus=COMPLETED',
    );
    expect(document.querySelector('[data-attention-item="awaitingCompany"]')).toHaveAttribute(
      'data-count',
      '2',
    );
    // Owner-only operators, real data; no revenue / growth figures anywhere.
    expect(document.querySelector('[data-owner-only]')).toHaveTextContent('Ops Admin');
    expect(document.body.textContent).not.toMatch(/MRR|ARR|revenue|รายได้|growth/i);
    // Human event labels first, the raw code second.
    expect(document.querySelector('[data-security]')).toHaveTextContent('เข้าสู่ระบบสำเร็จ');
    expect(api.called('GET /api/v1/platform/operators')).toHaveLength(1);
    // The newest companies link into inspection; the demo company is tagged.
    expect(
      document.querySelector('[data-newest] a[href="/platform/companies/c1"]'),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-company-row="c2"]')).toHaveTextContent('สาธิต');
  });

  it('PLATFORM_ADMIN: visibly a lower level, no owner-only area or request', async () => {
    const api = fakeApi({ ...admin(), ...overviewApi });
    renderRoute('/platform');
    await screen.findByRole('heading', { level: 1, name: 'Platform Control Center' });
    await waitFor(() => expect(document.querySelector('[data-headline]')).toHaveTextContent('3'));
    expect(document.querySelector('[data-platform-role="PLATFORM_ADMIN"]')).toHaveTextContent(
      'Platform Admin',
    );
    expect(document.querySelector('[data-owner-only]')).toBeNull();
    expect(
      screen.getByText('การจัดการผู้ดูแลแพลตฟอร์มสงวนไว้สำหรับ Platform Owner'),
    ).toBeInTheDocument();
    expect(api.called('GET /api/v1/platform/operators')).toHaveLength(0);
  });

  it('a customer account is sent from every platform route to /account', async () => {
    for (const path of ['/platform', '/platform/companies', '/platform/companies/c1']) {
      fakeApi({ ...signedIn(identity()) });
      const { router } = renderRoute(path);
      await waitFor(() => expect(router.state.location.pathname).toBe('/account'));
      cleanup();
      resetIdentityForTests();
    }
  });

  it('names the error: forbidden, expired session, temporary failure (with retry)', async () => {
    fakeApi({ ...owner(), 'GET /api/v1/platform/overview': fail(403, 'FORBIDDEN') });
    renderRoute('/platform');
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่มีสิทธิ์');
    cleanup();
    resetIdentityForTests();

    fakeApi({ ...owner(), 'GET /api/v1/platform/overview': fail(401, 'UNAUTHENTICATED') });
    renderRoute('/platform');
    expect(await screen.findByRole('alert')).toHaveTextContent('เซสชันหมดอายุ');
    expect(screen.getByRole('link', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
    cleanup();
    resetIdentityForTests();

    fakeApi({ ...owner(), 'GET /api/v1/platform/overview': fail(500, 'INTERNAL') });
    renderRoute('/platform');
    expect(await screen.findByRole('alert')).toHaveTextContent('ชั่วคราว');
    expect(screen.getByRole('button', { name: 'ลองอีกครั้ง' })).toBeInTheDocument();
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
