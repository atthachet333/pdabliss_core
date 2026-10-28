import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import { destinationFor, homeFor, resetIdentityForTests, safeNext } from '@/features/auth/session';
import type { BranchInfo } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type {
  BranchContext,
  Capability,
  ControlOverview,
  DepartmentConfig,
  MemberList,
  SubscriptionSummary,
} from './api';

/*
 * EP25 Company Control Center (UI). What the screens show follows the
 * server's answers — capabilities, canManage, package states, the branch
 * context. Authorization itself is tested against the API in
 * backend/test/company-control.test.ts; the UI is never the boundary.
 */

const ALL: Capability[] = [
  'company.view',
  'profile.edit',
  'branches.manage',
  'members.view',
  'members.manage',
  'departments.manage',
  'subscription.view',
  'activity.view',
  'settings.manage',
];

const member = (role: CompanyRole) =>
  identity({
    company: { id: 'c1', name: 'Alpha Trading', isDemo: false, role, canEnterCore: true },
  });

const HEAD: BranchInfo = {
  id: 'b0',
  code: '00000',
  name: 'Head Office',
  type: 'HEAD_OFFICE',
  status: 'ACTIVE',
  address: {
    line1: '77 Sathorn Road',
    line2: null,
    subdistrict: null,
    district: 'Sathorn',
    province: 'Bangkok',
    postalCode: '10120',
    countryCode: 'TH',
  },
  phone: null,
  deactivatedAt: null,
};
const SECOND: BranchInfo = { ...HEAD, id: 'b1', code: '00001', name: 'Chiang Mai', type: 'BRANCH' };

function overview(over: Partial<ControlOverview> = {}, caps: Capability[] = ALL): ControlOverview {
  return {
    company: {
      id: 'c1',
      displayName: 'Alpha Trading',
      legalName: 'Alpha Trading Co., Ltd.',
      englishName: null,
      taxId: null,
      registrationNumber: null,
      phone: null,
      website: null,
      contactEmail: null,
      industry: null,
      timezone: 'Asia/Bangkok',
      defaultLocale: 'th',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      isDemo: false,
      createdAt: '2026-10-20T03:00:00.000Z',
      activatedAt: '2026-10-21T03:00:00.000Z',
      logo: null,
    },
    me: {
      memberId: 'm_owner',
      role: caps.includes('members.manage') ? 'COMPANY_OWNER' : 'DEPARTMENT_STAFF',
      jobTitle: null,
      capabilities: caps,
      departments: caps.includes('members.manage') ? ['SALES', 'WAREHOUSE'] : ['WAREHOUSE'],
    },
    headOffice: HEAD,
    plan: {
      plan: 'BUSINESS',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      maxDepartments: 4,
      executiveAllowed: true,
    },
    departments: { enabled: ['SALES', 'WAREHOUSE'], unassigned: ['SALES'] },
    counts: {
      branches: { active: 2, total: 2 },
      members: { active: 3, deactivated: 0 },
      invitations: { open: 1, expired: 0 },
    },
    setup: {
      steps: [
        { id: 'profile', done: false },
        { id: 'logo', done: false, optional: true },
        { id: 'team', done: true },
        { id: 'departments', done: false },
      ],
      complete: false,
    },
    attention: caps.includes('members.manage')
      ? [
          { code: 'PROFILE_INCOMPLETE', fields: ['taxId', 'phone'] },
          { code: 'DEPARTMENTS_UNASSIGNED', departments: ['SALES'] },
          { code: 'INVITATIONS_PENDING', count: 1 },
        ]
      : [],
    access: { canEnterCore: true },
    ...over,
  };
}

const STAFF_CAPS: Capability[] = ['company.view'];

const MEMBERS: MemberList = {
  members: [
    {
      id: 'm_owner',
      fullName: 'Owner Person',
      email: 'owner@alpha.example',
      phone: null,
      jobTitle: 'Managing Director',
      role: 'COMPANY_OWNER',
      status: 'ACTIVE',
      accountStatus: 'ACTIVE',
      joinedAt: '2026-10-20T03:00:00.000Z',
      deactivatedAt: null,
      lastLoginAt: '2026-10-28T03:00:00.000Z',
      departments: [],
      isOwner: true,
      isSelf: false,
      canManage: false,
    },
    {
      id: 'm_staff',
      fullName: 'Staff Person',
      email: 'staff@alpha.example',
      phone: null,
      jobTitle: null,
      role: 'DEPARTMENT_STAFF',
      status: 'ACTIVE',
      accountStatus: 'ACTIVE',
      joinedAt: '2026-10-22T03:00:00.000Z',
      deactivatedAt: null,
      lastLoginAt: null,
      departments: [{ code: 'WAREHOUSE', primary: true, active: true }],
      isOwner: false,
      isSelf: false,
      canManage: true,
    },
  ],
  invitations: [
    {
      id: 'i1',
      email: 'new@alpha.example',
      role: 'VIEWER',
      locale: 'en',
      state: 'OPEN',
      invitedBy: { email: 'admin@alpha.example', fullName: 'Admin Person' },
      createdAt: '2026-10-27T03:00:00.000Z',
      expiresAt: '2026-11-03T03:00:00.000Z',
    },
  ],
  assignableRoles: ['EXECUTIVE', 'DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER'],
  canManage: true,
  enabledDepartments: ['SALES', 'WAREHOUSE'],
  defaultLocale: 'th',
};

afterEach(() => {
  resetIdentityForTests();
});

describe('Company Control Center routing (EP25)', () => {
  it('sends an active company member to /company, everyone else where they belong', () => {
    const active = member('DEPARTMENT_STAFF');
    expect(homeFor(active)).toBe('/company');
    const pending = identity({
      company: { id: 'c1', name: 'Alpha', isDemo: false, role: 'COMPANY_OWNER' },
    });
    expect(homeFor(pending)).toBe('/account');
    expect(homeFor(identity({ platformRole: 'PLATFORM_ADMIN' }))).toBe('/platform');
    expect(homeFor(identity())).toBe('/account');
    // `next` may only lead where the identity may go.
    expect(destinationFor(active, '/company/users')).toBe('/company/users');
    expect(destinationFor(active, '/account')).toBe('/account');
    expect(destinationFor(pending, '/company')).toBe('/account');
    expect(destinationFor(identity({ platformRole: 'PLATFORM_OWNER' }), '/company')).toBe(
      '/platform',
    );
    expect(destinationFor(active, '/platform')).toBe('/company');
    expect(safeNext('/core/branch')).toBe('/core/branch');
    expect(safeNext('//evil.example/company')).toBeNull();
  });

  it('keeps a pending company owner out of /company and a platform operator out of /core', async () => {
    fakeApi({
      ...signedIn(
        identity({ company: { id: 'c1', name: 'Alpha', isDemo: false, role: 'COMPANY_OWNER' } }),
      ),
      'GET /api/v1/account/onboarding': ok({
        stage: 'PENDING_ACTIVATION',
        selectedPlan: null,
        company: { id: 'c1', displayName: 'Alpha', isDemo: false, role: 'COMPANY_OWNER' },
        canEnterCore: false,
      }),
      'GET /api/v1/company/current': fail(500, 'X'),
    });
    const { router } = renderRoute('/company/users');
    await waitFor(() => expect(router.state.location.pathname).toBe('/account'));
    cleanup();
    resetIdentityForTests();

    fakeApi({ ...signedIn(identity({ platformRole: 'PLATFORM_OWNER' })) });
    const second = renderRoute('/core');
    await waitFor(() => expect(second.router.state.location.pathname).toBe('/platform'));
  });
});

describe('Company Control Center overview (EP25)', () => {
  it('answers company, package, departments, counts, setup and attention for the owner', async () => {
    fakeApi({
      ...signedIn(member('COMPANY_OWNER')),
      'GET /api/v1/company/control': ok(overview()),
    });
    renderRoute('/company?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'Alpha Trading' });
    expect(screen.getByText('Package: Business')).toBeInTheDocument();
    const attention = document.querySelector('[data-attention]')!;
    expect(
      within(attention as HTMLElement).getByText('Company details are incomplete'),
    ).toBeInTheDocument();
    expect(within(attention as HTMLElement).getByText('Tax ID · Phone')).toBeInTheDocument();
    expect(document.querySelector('[data-setup="open"]')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Enter CORE/ })[0]).toHaveAttribute('href', '/core');
    // Initials stand in for a missing logo.
    expect(document.querySelector('[data-company-initials]')).toHaveTextContent('AT');
    // Every admin area is listed.
    const nav = screen.getByRole('navigation', { name: 'Company Control Center menu' });
    for (const name of [
      'Overview',
      'Company',
      'Branches',
      'Users',
      'Departments',
      'Subscription',
      'Security',
      'Settings',
    ])
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    // The overview never shows a price.
    expect(document.querySelector('main')!.textContent).not.toMatch(/฿|699/);
  });

  it('shows department staff the company and their departments — no administration', async () => {
    fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/control': ok(overview({}, STAFF_CAPS)),
    });
    renderRoute('/company?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'Alpha Trading' });
    const nav = screen.getByRole('navigation', { name: 'Company Control Center menu' });
    expect(within(nav).queryByRole('link', { name: 'Users' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Subscription' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Security' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Settings' })).toBeNull();
    expect(document.querySelector('[data-attention]')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Your departments in CORE' })).toBeInTheDocument();
  });

  it('says when the Control Center is not available and leads to the Account Portal', async () => {
    fakeApi({
      ...signedIn(member('COMPANY_OWNER')),
      'GET /api/v1/company/control': fail(403, 'COMPANY_NOT_ACTIVE'),
    });
    renderRoute('/company?lang=en');
    expect(
      await screen.findByText(/opens once the company and its subscription are active/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to my account' })).toHaveAttribute(
      'href',
      '/account',
    );
  });

  it('speaks Thai, English and Simplified Chinese without Thai leaking into EN / ZH', async () => {
    for (const [lang, locale, title] of [
      ['en', 'en', 'What needs attention'],
      ['zh', 'zh-CN', '需要处理的事项'],
      ['th', 'th', 'สิ่งที่ควรทำ'],
    ] as const) {
      fakeApi({
        ...signedIn({ ...member('COMPANY_OWNER'), user: { ...identity().user, locale } }),
        'GET /api/v1/company/control': ok(overview()),
      });
      renderRoute(`/company?lang=${lang}`);
      await screen.findByRole('heading', { level: 2, name: title });
      if (lang !== 'th') expect(document.body.textContent).not.toMatch(/[฀-๿]/);
      cleanup();
      resetIdentityForTests();
    }
  });
});

describe('Company Control Center people (EP25)', () => {
  it('lists members and invitations; the owner is protected; invitations carry the chosen language', async () => {
    const api = fakeApi({
      ...signedIn(member('SYSTEM_ADMIN')),
      'GET /api/v1/company/control': ok(overview()),
      'GET /api/v1/company/current/members': ok(MEMBERS),
      'POST /api/v1/company/invitations': ok({
        id: 'i2',
        email: 'x@alpha.example',
        role: 'VIEWER',
        expiresAt: '',
      }),
    });
    const user = userEvent.setup();
    renderRoute('/company/users?lang=en');
    const owner = await screen.findByRole('article', { name: 'Owner Person' });
    expect(within(owner).queryByRole('button', { name: 'Manage' })).toBeNull();
    expect(within(owner).getByText('Company Owner — protected')).toBeInTheDocument();
    const staff = screen.getByRole('article', { name: 'Staff Person' });
    await user.click(within(staff).getByRole('button', { name: 'Manage' }));
    const panel = within(staff).getByRole('form', { name: 'Manage Staff Person' });
    // Only the roles the server says this admin may give.
    const roles = within(panel).getByLabelText('Company role');
    expect([...(roles as HTMLSelectElement).options].map((o) => o.value)).not.toContain(
      'SYSTEM_ADMIN',
    );

    await user.click(screen.getByRole('button', { name: 'Invite user' }));
    const form = within(document.querySelector<HTMLElement>('[data-invite-form]')!);
    await user.type(form.getByLabelText('Email'), 'x@alpha.example');
    await user.selectOptions(form.getByLabelText('Company role'), 'VIEWER');
    await user.selectOptions(form.getByLabelText('Invitation email language'), 'en');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(api.called('POST /api/v1/company/invitations')).toHaveLength(1));
    // Never a company id or anything the server owns.
    expect(api.called('POST /api/v1/company/invitations')[0]!.body).toEqual({
      email: 'x@alpha.example',
      role: 'VIEWER',
      locale: 'en',
    });
    expect(await screen.findByText(/Invitation sent to x@alpha.example/)).toBeInTheDocument();
  });

  it('shows the server’s reason when a change is refused', async () => {
    fakeApi({
      ...signedIn(member('SYSTEM_ADMIN')),
      'GET /api/v1/company/control': ok(overview()),
      'GET /api/v1/company/current/members': ok(MEMBERS),
      'PATCH /api/v1/company/current/members/m_staff': fail(403, 'PEER_ADMIN'),
    });
    const user = userEvent.setup();
    renderRoute('/company/users?lang=en');
    const staff = await screen.findByRole('article', { name: 'Staff Person' });
    await user.click(within(staff).getByRole('button', { name: 'Manage' }));
    await user.selectOptions(within(staff).getByLabelText('Company role'), 'VIEWER');
    await user.click(within(staff).getByRole('button', { name: 'Save role and departments' }));
    expect(
      await within(staff).findByText('Only the Company Owner can change a System Admin'),
    ).toBeInTheDocument();
  });

  it('department roles do not open the people page', async () => {
    fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/control': ok(overview({}, STAFF_CAPS)),
    });
    renderRoute('/company/users?lang=en');
    expect(await screen.findByText('Your role cannot open this page')).toBeInTheDocument();
  });
});

describe('Company Control Center configuration (EP25)', () => {
  const DEPTS: DepartmentConfig = {
    enabled: ['SALES', 'WAREHOUSE'],
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
    departments: [
      { code: 'SALES', state: 'ENABLED', assigned: 1 },
      { code: 'OPERATIONS', state: 'AVAILABLE', assigned: 0 },
      { code: 'WAREHOUSE', state: 'ENABLED', assigned: 0 },
      { code: 'PURCHASING', state: 'AVAILABLE', assigned: 0 },
      { code: 'ACCOUNTING', state: 'AVAILABLE', assigned: 0 },
      { code: 'EXECUTIVE', state: 'NOT_IN_PACKAGE', assigned: 0 },
    ],
    canManage: true,
  };

  it('guides by the package (limit, Executive) and lets the server decide on save', async () => {
    const api = fakeApi({
      ...signedIn(member('COMPANY_OWNER')),
      'GET /api/v1/company/control': ok(overview()),
      'GET /api/v1/company/current/departments': ok(DEPTS),
      'PUT /api/v1/company/current/departments': (body) =>
        ok({ ...DEPTS, enabled: (body as { departments: string[] }).departments }),
    });
    const user = userEvent.setup();
    renderRoute('/company/departments?lang=en');
    await screen.findByText('2 of 2 departments used');
    expect(screen.getByRole('switch', { name: 'Purchasing' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Executive' })).toBeDisabled();
    expect(
      screen.getByText('The Executive department starts with the Business package'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Warehouse never sees price, cost, margin/)).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Sales' }));
    await user.click(screen.getByRole('switch', { name: 'Purchasing' }));
    await user.click(screen.getByRole('button', { name: 'Save departments' }));
    await waitFor(() =>
      expect(api.called('PUT /api/v1/company/current/departments')).toHaveLength(1),
    );
    expect(api.called('PUT /api/v1/company/current/departments')[0]!.body).toEqual({
      departments: ['WAREHOUSE', 'PURCHASING'],
    });
    expect(await screen.findByText('Departments saved')).toBeInTheDocument();
  });

  it('shows honest subscription facts: no invoices, no checkout — contact PDA BLISS', async () => {
    const summary: SubscriptionSummary = {
      subscription: {
        id: 's1',
        plan: 'BUSINESS',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        monthlyPriceThb: 699,
        catalogVersion: 1,
        createdAt: '2026-10-20T03:00:00.000Z',
        activatedAt: '2026-10-21T03:00:00.000Z',
        currentPeriodStart: '2026-10-21T03:00:00.000Z',
        currentPeriodEnd: '2026-11-21T03:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
      entitlements: {
        ...DEPTS.entitlements!,
        plan: 'BUSINESS',
        maxDepartments: 4,
        executiveAllowed: true,
        storage: { gb: 10 },
        api: 'ADD_ON',
      },
      departments: { enabled: ['SALES', 'WAREHOUSE'] },
      branches: { active: 2, total: 2 },
      priceVisible: true,
    };
    fakeApi({
      ...signedIn(member('COMPANY_OWNER')),
      'GET /api/v1/company/control': ok(overview()),
      'GET /api/v1/company/current/subscription': ok(summary),
    });
    renderRoute('/company/subscription?lang=en');
    await screen.findByText('Business');
    expect(screen.getByText(/฿699/)).toBeInTheDocument();
    expect(screen.getByText('Every branch included (2 now)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact PDA BLISS' })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(document.querySelector('[data-no-invoices]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay|checkout|upgrade now/i })).toBeNull();
  });

  it('profile is read-only for an executive and editable (changed fields only) for the owner', async () => {
    fakeApi({
      ...signedIn(member('EXECUTIVE')),
      'GET /api/v1/company/control': ok(
        overview({}, ['company.view', 'members.view', 'subscription.view']),
      ),
    });
    renderRoute('/company/profile?lang=en');
    expect(await screen.findByText(/Read only/)).toBeInTheDocument();
    expect(document.querySelector('[data-profile-form]')).toBeNull();
    cleanup();
    resetIdentityForTests();

    const api = fakeApi({
      ...signedIn(member('COMPANY_OWNER')),
      'GET /api/v1/company/control': ok(overview()),
      'PATCH /api/v1/company/current/profile': (body) =>
        ok({
          ...overview(),
          company: { ...overview().company, ...(body as object) },
          changed: ['phone'],
        }),
    });
    const user = userEvent.setup();
    renderRoute('/company/profile?lang=en');
    const phone = await screen.findByLabelText('Company phone (optional)');
    await user.type(phone, '02 123 4567');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.called('PATCH /api/v1/company/current/profile')).toHaveLength(1),
    );
    expect(api.called('PATCH /api/v1/company/current/profile')[0]!.body).toEqual({
      phone: '02 123 4567',
    });
  });
});

describe('Branch context and CORE Operations entry (EP25)', () => {
  const context = (over: Partial<BranchContext> = {}): BranchContext => ({
    company: { id: 'c1', displayName: 'Alpha Trading' },
    role: 'DEPARTMENT_STAFF',
    branches: [HEAD, SECOND],
    selected: null,
    needsSelection: true,
    departments: ['WAREHOUSE'],
    ...over,
  });

  it('asks for a branch when there are several, stores it on the server, then shows only permitted departments', async () => {
    const api = fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/context': ok(context()),
      'POST /api/v1/company/context/branch': ok(
        context({ selected: SECOND, needsSelection: false }),
      ),
    });
    const user = userEvent.setup();
    const { router } = renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'Choose the branch you work in' });
    expect(router.state.location.pathname).toBe('/core/branch');
    await user.click(screen.getByRole('radio', { name: /Chiang Mai/ }));
    await user.click(screen.getByRole('button', { name: 'Enter CORE' }));
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    expect(api.called('POST /api/v1/company/context/branch')[0]!.body).toEqual({ branchId: 'b1' });
    const list = document.querySelector('[data-core-departments]')!;
    expect(list.querySelectorAll('[data-department]')).toHaveLength(1);
    expect(list.querySelector('[data-department="WAREHOUSE"]')).not.toBeNull();
    expect(screen.getByText(/Department workspaces open in a later phase/)).toBeInTheDocument();
    // No business figures on the entry.
    expect(document.querySelector('main')!.textContent).not.toMatch(/฿|\d+%/);
  });

  it('goes straight in with one branch and says plainly when no department is assigned', async () => {
    fakeApi({
      ...signedIn(member('VIEWER')),
      'GET /api/v1/company/context': ok(
        context({
          branches: [HEAD],
          selected: HEAD,
          needsSelection: false,
          departments: [],
          role: 'VIEWER',
        }),
      ),
    });
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    expect(
      screen.getByText(/No department is assigned to you in this company yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Change branch' })).toBeNull();
  });
});
