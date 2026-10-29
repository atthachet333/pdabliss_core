import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext, ControlOverview } from '@/features/company-center/api';
import type { BranchInfo, DepartmentCode } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';

/*
 * EP28.1 demo personas in the UI. (1) The development-only persona list on
 * the sign-in page: shown only when the API lists personas, fills the email
 * and never a password. A production build contains none of it (checked on
 * the built bundle; the API refuses the list in production — backend tests).
 * (2) Each persona's context drives what the screens offer: the Control
 * Center menu from its administration codes, CORE from its departments. The
 * screens hold no persona logic — these are the server's answers rendered.
 */

const PERSONAS = [
  { key: 'OWNER', label: 'Owner', email: 'owner.demo@pdabliss.com', jobTitle: 'Managing Director' },
  { key: 'SALES', label: 'Sales', email: 'sales.demo@pdabliss.com', jobTitle: 'Sales Coordinator' },
  {
    key: 'WAREHOUSE',
    label: 'Warehouse',
    email: 'warehouse.demo@pdabliss.com',
    jobTitle: 'Warehouse Officer',
  },
];
const anonymous = { 'GET /api/v1/auth/me': fail(401, 'UNAUTHENTICATED') };

describe('development demo persona list (EP28.1)', () => {
  it('lists the personas the API offers and fills only the email', async () => {
    fakeApi({ ...anonymous, 'GET /api/v1/demo/personas': ok({ personas: PERSONAS }) });
    renderRoute('/login?lang=en');
    const list = await screen.findByRole('region', { name: 'Demo accounts (development only)' });
    const buttons = within(list).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Owner', 'Sales', 'Warehouse']);
    const user = userEvent.setup();
    await user.click(
      within(list).getByRole('button', {
        name: 'Use the Warehouse demo account (warehouse.demo@pdabliss.com)',
      }),
    );
    expect(screen.getByLabelText('Email')).toHaveValue('warehouse.demo@pdabliss.com');
    const password = screen.getByLabelText('Password');
    expect(password).toHaveValue('');
    expect(password).toHaveFocus();
    expect(list.textContent).not.toMatch(/passphrase|change-me/i);
  });

  it('is keyboard operable', async () => {
    fakeApi({ ...anonymous, 'GET /api/v1/demo/personas': ok({ personas: PERSONAS }) });
    renderRoute('/login?lang=en');
    const list = await screen.findByRole('region', { name: 'Demo accounts (development only)' });
    const sales = within(list).getByRole('button', { name: /Sales demo account/ });
    sales.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(screen.getByLabelText('Email')).toHaveValue('sales.demo@pdabliss.com');
  });

  it('stays hidden when the API offers no personas (demo off or production)', async () => {
    const api = fakeApi({ ...anonymous, 'GET /api/v1/demo/personas': fail(404, 'NOT_FOUND') });
    renderRoute('/login?lang=en');
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(api.called('GET /api/v1/demo/personas')).toHaveLength(1));
    expect(document.querySelector('[data-dev-personas]')).toBeNull();
  });
});

// ------------------------------------------------------------------ personas

const branch = (id: string, code: string, name: string): BranchInfo => ({
  id,
  code,
  name,
  type: code === '00000' ? 'HEAD_OFFICE' : 'BRANCH',
  status: 'ACTIVE',
  address: {
    line1: '1 Demo Road',
    line2: null,
    subdistrict: null,
    district: 'Demo',
    province: 'Bangkok',
    postalCode: '10110',
    countryCode: 'TH',
  },
  phone: null,
  deactivatedAt: null,
  createdAt: '2026-10-20T03:00:00.000Z',
  updatedAt: '2026-10-20T03:00:00.000Z',
});
const HO = branch('b0', '00000', 'Head Office');
const DEMO = branch('b1', '00001', 'Demo Branch');
const ALL: DepartmentCode[] = [
  'SALES',
  'OPERATIONS',
  'WAREHOUSE',
  'PURCHASING',
  'ACCOUNTING',
  'EXECUTIVE',
];
const ADMIN = [
  'company.profile.view',
  'company.profile.edit',
  'company.branches.view',
  'company.branches.manage',
  'company.members.view',
  'company.members.manage',
  'company.departments.manage',
  'company.permissions.view',
  'company.permissions.manage',
  'company.subscription.view',
  'company.activity.view',
  'company.settings.manage',
  'company.master_data.manage',
];
const DEPT_ADMIN = ['company.profile.view', 'company.branches.view'];

/** What the server answers for each seeded persona (src/demo/personas.ts + EP27 defaults). */
const PERSONA_STATE: Record<
  string,
  {
    role: CompanyRole;
    admin: string[];
    departments: DepartmentCode[];
    branches: BranchInfo[];
    ops: string[];
  }
> = {
  owner: {
    role: 'COMPANY_OWNER',
    admin: ADMIN,
    departments: ALL,
    branches: [HO, DEMO],
    ops: ['sales.customers.view'],
  },
  admin: { role: 'SYSTEM_ADMIN', admin: ADMIN, departments: [], branches: [HO, DEMO], ops: [] },
  executive: {
    role: 'EXECUTIVE',
    admin: [
      'company.profile.view',
      'company.branches.view',
      'company.members.view',
      'company.subscription.view',
    ],
    departments: ALL,
    branches: [HO, DEMO],
    ops: ['sales.customers.view', 'warehouse.items.view'],
  },
  sales: {
    role: 'DEPARTMENT_STAFF',
    admin: DEPT_ADMIN,
    departments: ['SALES'],
    branches: [HO],
    ops: ['sales.customers.view', 'sales.items.view'],
  },
  operations: {
    role: 'DEPARTMENT_MANAGER',
    admin: DEPT_ADMIN,
    departments: ['OPERATIONS'],
    branches: [HO, DEMO],
    ops: ['operations.items.view', 'operations.items.manage'],
  },
  warehouse: {
    role: 'DEPARTMENT_STAFF',
    admin: DEPT_ADMIN,
    departments: ['WAREHOUSE'],
    branches: [DEMO],
    ops: ['warehouse.items.view', 'warehouse.locations.view'],
  },
  purchasing: {
    role: 'DEPARTMENT_MANAGER',
    admin: DEPT_ADMIN,
    departments: ['PURCHASING'],
    branches: [HO, DEMO],
    ops: ['purchasing.suppliers.view', 'purchasing.items.view'],
  },
  accounting: {
    role: 'DEPARTMENT_MANAGER',
    admin: DEPT_ADMIN,
    departments: ['ACCOUNTING'],
    branches: [HO],
    ops: ['accounting.customers.view', 'accounting.suppliers.view'],
  },
};

function handlers(key: string) {
  const s = PERSONA_STATE[key]!;
  const one = s.branches.length === 1;
  const permissions = [
    ...s.admin,
    ...s.ops,
    ...s.departments.map((d) => `${d.toLowerCase()}.workspace.view`),
  ];
  const overview = {
    company: {
      id: 'c1',
      displayName: 'PDA BLISS CORE DEMO COMPANY',
      legalName: null,
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
      isDemo: true,
      createdAt: '2026-10-20T03:00:00.000Z',
      activatedAt: '2026-10-21T03:00:00.000Z',
      logo: null,
    },
    me: { memberId: 'm1', role: s.role, jobTitle: null, permissions, departments: s.departments },
    headOffice: null,
    plan: null,
    departments: { enabled: ALL, unassigned: [] },
    counts: {
      branches: { active: 2, total: 2 },
      members: { active: 9, deactivated: 0 },
      invitations: { open: 0, expired: 0 },
    },
    setup: { steps: [], complete: true },
    attention: [],
    access: { canEnterCore: true },
  } as unknown as ControlOverview;
  const context: BranchContext = {
    company: { id: 'c1', displayName: 'PDA BLISS CORE DEMO COMPANY' },
    role: s.role,
    scope:
      s.branches.length === 2 && !['sales', 'accounting', 'warehouse'].includes(key)
        ? 'ALL_BRANCHES'
        : 'SELECTED_BRANCHES',
    branches: s.branches,
    selected: one ? s.branches[0]! : HO,
    needsSelection: false,
    blocked: null,
    departments: s.departments,
    permissions: permissions as BranchContext['permissions'],
  };
  return {
    ...signedIn(
      identity({
        company: {
          id: 'c1',
          name: 'PDA BLISS CORE DEMO COMPANY',
          isDemo: true,
          role: s.role,
          canEnterCore: true,
        },
      }),
    ),
    'GET /api/v1/company/control': ok(overview),
    'GET /api/v1/company/context': ok(context),
  };
}

describe('demo personas in the screens (EP28.1)', () => {
  const MENU: Record<string, string[]> = {
    owner: [
      'Overview',
      'Company',
      'Branches',
      'Users',
      'Departments',
      'Subscription',
      'Security',
      'Master Data',
      'Permissions',
      'Settings',
    ],
    admin: [
      'Overview',
      'Company',
      'Branches',
      'Users',
      'Departments',
      'Subscription',
      'Security',
      'Master Data',
      'Permissions',
      'Settings',
    ],
    executive: [
      'Overview',
      'Company',
      'Branches',
      'Users',
      'Departments',
      'Subscription',
      'Master Data',
    ],
    sales: ['Overview', 'Company', 'Branches', 'Departments', 'Master Data'],
    operations: ['Overview', 'Company', 'Branches', 'Departments', 'Master Data'],
    warehouse: ['Overview', 'Company', 'Branches', 'Departments', 'Master Data'],
    purchasing: ['Overview', 'Company', 'Branches', 'Departments', 'Master Data'],
    accounting: ['Overview', 'Company', 'Branches', 'Departments', 'Master Data'],
  };

  for (const key of Object.keys(PERSONA_STATE)) {
    it(`${key}: Control Center menu and CORE departments follow the server`, async () => {
      fakeApi(handlers(key));
      const { unmount } = renderRoute('/company?lang=en');
      const nav = await screen.findByRole('navigation', { name: 'Company Control Center menu' });
      expect(
        within(nav)
          .getAllByRole('link')
          .map((l) => l.textContent),
      ).toEqual(MENU[key]);
      unmount();

      fakeApi(handlers(key));
      renderRoute('/core?lang=en');
      await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
      const shown = [...document.querySelectorAll<HTMLElement>('[data-department]')].map(
        (e) => e.dataset.department,
      );
      expect(shown).toEqual(PERSONA_STATE[key]!.departments);
    });
  }
});
