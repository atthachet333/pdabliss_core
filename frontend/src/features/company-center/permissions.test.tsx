import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import { resetIdentityForTests } from '@/features/auth/session';
import type { BranchInfo } from '@/features/company/api';
import { fakeApi, fail, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type {
  AdminPermission,
  BranchContext,
  ControlOverview,
  Member,
  MemberList,
  MemberPermissions,
  PermissionDefinition,
  PermissionProfiles,
  PermissionState,
} from './api';
import { PERMISSION_COPY } from './permissionCopy';

/*
 * EP27 permission screens (UI). Every state shown comes from the server
 * (effective permissions, sources, inactive reasons, protection); the
 * enforcement itself is tested in backend/test/permissions.test.ts.
 */

const ADMIN: AdminPermission[] = [
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
];
const STAFF: AdminPermission[] = ['company.profile.view', 'company.branches.view'];

const member = (role: CompanyRole) =>
  identity({
    company: { id: 'c1', name: 'Alpha Trading', isDemo: false, role, canEnterCore: true },
  });

function overview(permissions: string[]): ControlOverview {
  return {
    company: {
      id: 'c1',
      displayName: 'Alpha Trading',
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
      isDemo: false,
      createdAt: '2026-10-20T03:00:00.000Z',
      activatedAt: '2026-10-21T03:00:00.000Z',
      logo: null,
    },
    me: {
      memberId: 'm_admin',
      role: permissions.includes('company.permissions.manage')
        ? 'SYSTEM_ADMIN'
        : 'DEPARTMENT_STAFF',
      jobTitle: null,
      permissions: permissions as ControlOverview['me']['permissions'],
      departments: [],
    },
    headOffice: null,
    plan: null,
    departments: { enabled: ['SALES', 'WAREHOUSE'], unassigned: [] },
    counts: {
      branches: { active: 1, total: 1 },
      members: { active: 3, deactivated: 0 },
      invitations: { open: 0, expired: 0 },
    },
    setup: { steps: [], complete: true },
    attention: [],
    access: { canEnterCore: true },
  };
}

const def = (code: string, overridable = !code.startsWith('company.')): PermissionDefinition => {
  const [ns, resource, action] = code.split('.') as [string, string, string];
  return {
    code: code as PermissionDefinition['code'],
    namespace: (ns === 'company'
      ? 'COMPANY_ADMIN'
      : ns.toUpperCase()) as PermissionDefinition['namespace'],
    resource: `${ns}.${resource}`,
    action,
    scope: ns === 'company' ? 'COMPANY' : 'BRANCH',
    tier:
      action === 'view'
        ? 'READ'
        : ['create', 'edit', 'process'].includes(action)
          ? 'OPERATE'
          : 'MANAGE',
    overridable,
  };
};
const CATALOG = [
  'company.members.manage',
  'company.permissions.manage',
  'sales.workspace.view',
  'sales.orders.view',
  'sales.orders.create',
  'warehouse.workspace.view',
  'warehouse.inventory.view',
  'warehouse.stock_adjustment.create',
  'warehouse.stock_adjustment.approve',
  'purchasing.workspace.view',
  'purchasing.requests.create',
  'executive.workspace.view',
].map((c) => def(c));

const PROFILES: PermissionProfiles = {
  catalog: CATALOG,
  roles: [
    {
      role: 'COMPANY_OWNER',
      admin: ADMIN,
      operational: { tiers: ['READ', 'OPERATE', 'MANAGE'], requiresAssignment: false },
    },
    {
      role: 'SYSTEM_ADMIN',
      admin: ADMIN,
      operational: { tiers: ['READ', 'OPERATE'], requiresAssignment: true },
    },
    {
      role: 'EXECUTIVE',
      admin: [
        'company.profile.view',
        'company.branches.view',
        'company.members.view',
        'company.subscription.view',
      ],
      operational: { tiers: ['READ'], requiresAssignment: false },
    },
    {
      role: 'DEPARTMENT_MANAGER',
      admin: STAFF,
      operational: { tiers: ['READ', 'OPERATE', 'MANAGE'], requiresAssignment: true },
    },
    {
      role: 'DEPARTMENT_STAFF',
      admin: STAFF,
      operational: { tiers: ['READ', 'OPERATE'], requiresAssignment: true },
    },
    { role: 'VIEWER', admin: STAFF, operational: { tiers: ['READ'], requiresAssignment: true } },
  ],
  enabledDepartments: ['SALES', 'WAREHOUSE', 'PURCHASING'],
  executiveAllowed: false,
  canManage: true,
};

const st = (code: string, over: Partial<PermissionState> = {}): PermissionState => ({
  code: code as PermissionState['code'],
  effective: false,
  roleDefault: false,
  override: null,
  source: 'NONE',
  blocked: null,
  ...over,
});

const STAFF_STATES: PermissionState[] = [
  st('company.members.manage'),
  st('company.permissions.manage'),
  st('sales.workspace.view', {
    roleDefault: true,
    source: 'ROLE_DEFAULT',
    blocked: 'NOT_ASSIGNED',
  }),
  st('sales.orders.view', { roleDefault: true, source: 'ROLE_DEFAULT', blocked: 'NOT_ASSIGNED' }),
  st('sales.orders.create', { roleDefault: true, source: 'ROLE_DEFAULT', blocked: 'NOT_ASSIGNED' }),
  st('warehouse.workspace.view', { effective: true, roleDefault: true, source: 'ROLE_DEFAULT' }),
  st('warehouse.inventory.view', { roleDefault: true, override: 'DENY', source: 'DENY_OVERRIDE' }),
  st('warehouse.stock_adjustment.create', {
    effective: true,
    roleDefault: true,
    source: 'ROLE_DEFAULT',
  }),
  st('warehouse.stock_adjustment.approve', {
    effective: true,
    override: 'ALLOW',
    source: 'ALLOW_OVERRIDE',
  }),
  st('purchasing.workspace.view', {
    roleDefault: true,
    source: 'ROLE_DEFAULT',
    blocked: 'NOT_ASSIGNED',
  }),
  st('purchasing.requests.create', {
    roleDefault: true,
    source: 'ROLE_DEFAULT',
    blocked: 'NOT_ASSIGNED',
  }),
  st('executive.workspace.view', { blocked: 'NOT_IN_PACKAGE' }),
];

const person = (over: Partial<Member> & Pick<Member, 'id' | 'email'>): Member => ({
  fullName: null,
  phone: null,
  jobTitle: null,
  role: 'DEPARTMENT_STAFF',
  status: 'ACTIVE',
  accountStatus: 'ACTIVE',
  joinedAt: '2026-10-22T03:00:00.000Z',
  deactivatedAt: null,
  lastLoginAt: null,
  departments: [],
  branchAccess: { scope: 'ALL_BRANCHES', branches: [] },
  isOwner: false,
  isSelf: false,
  canManage: true,
  ...over,
});
const PEOPLE: MemberList = {
  members: [
    person({
      id: 'm_owner',
      email: 'owner@alpha.example',
      fullName: 'Owner Person',
      role: 'COMPANY_OWNER',
      isOwner: true,
    }),
    person({ id: 'm_staff', email: 'staff@alpha.example', fullName: 'Staff Person' }),
  ],
  total: 2,
  page: 1,
  pageSize: 50,
  hasMore: false,
  summary: { active: 2, deactivated: 0 },
  invitations: [],
  branches: [],
  assignableRoles: [],
  canManage: true,
  enabledDepartments: ['SALES', 'WAREHOUSE', 'PURCHASING'],
  defaultLocale: 'th',
};

const memberView = (over: Partial<MemberPermissions> = {}): MemberPermissions => ({
  member: {
    id: 'm_staff',
    fullName: 'Staff Person',
    email: 'staff@alpha.example',
    role: 'DEPARTMENT_STAFF',
    status: 'ACTIVE',
    isOwner: false,
    isSelf: false,
  },
  assignedDepartments: ['WAREHOUSE'],
  enabledDepartments: ['SALES', 'WAREHOUSE', 'PURCHASING'],
  executiveAllowed: false,
  permissions: STAFF_STATES,
  protection: null,
  canManage: true,
  ...over,
});

const admin = (extra: Parameters<typeof fakeApi>[0] = {}) => ({
  ...signedIn(member('SYSTEM_ADMIN')),
  'GET /api/v1/company/control': ok(overview(ADMIN)),
  'GET /api/v1/company/current/permissions': ok(PROFILES),
  'GET /api/v1/company/current/members': ok(PEOPLE),
  ...extra,
});

const row = (code: string) => document.querySelector<HTMLElement>(`[data-permission="${code}"]`)!;

afterEach(() => {
  resetIdentityForTests();
});

describe('Permissions — role profiles (EP27)', () => {
  it('shows each role’s defaults as a grouped matrix plus readable role cards, read only', async () => {
    fakeApi(admin());
    renderRoute('/company/permissions?lang=en');
    const nav = await screen.findByRole('navigation', { name: 'Company Control Center menu' });
    expect(within(nav).getByRole('link', { name: 'Permissions' })).toHaveAttribute(
      'href',
      '/company/permissions',
    );
    const matrix = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-role-matrix]');
      if (!el) throw new Error('matrix not rendered yet');
      return el;
    });
    const table = within(matrix).getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual([
      'Capability group',
      'Company owner',
      'Company system admin',
      'Executive',
      'Department manager',
      'Department staff',
      'Viewer',
    ]);
    const groups = [...matrix.querySelectorAll<HTMLElement>('[data-group]')].map(
      (r) => r.dataset.group,
    );
    expect(groups).toEqual([
      'COMPANY_ADMIN',
      'SALES',
      'OPERATIONS',
      'WAREHOUSE',
      'PURCHASING',
      'ACCOUNTING',
      'EXECUTIVE',
    ]);
    const wh = within(matrix.querySelector<HTMLElement>('[data-group="WAREHOUSE"]')!);
    expect(wh.getAllByText('View · Work · Approve / manage')).toHaveLength(2); // owner, manager
    expect(wh.getAllByText('View · Work')).toHaveLength(2); // system admin, staff
    // Departments the company has not enabled / the package lacks are said in words.
    expect(
      within(matrix.querySelector<HTMLElement>('[data-group="OPERATIONS"]')!).getByText(
        'Not enabled in this company',
      ),
    ).toBeInTheDocument();
    expect(
      within(matrix.querySelector<HTMLElement>('[data-group="EXECUTIVE"]')!).getByText(
        'Not enabled in this company',
      ),
    ).toBeInTheDocument();
    // Narrow screens get the cards; the matrix is hidden below xl, never squeezed.
    expect(matrix.className).toContain('max-xl:hidden');
    const cards = document.querySelectorAll('[data-role-cards] [data-role]');
    expect(cards).toHaveLength(6);
    expect(
      within(document.querySelector<HTMLElement>('[data-role="EXECUTIVE"]')!).getByText(
        /does not administer/,
      ),
    ).toBeInTheDocument();
    // Nothing on this view edits the global definitions.
    expect(
      document.querySelector('[data-role-matrix] select, [data-role-cards] select'),
    ).toBeNull();
  });

  it('is closed to roles without company.permissions.view, and not in their menu', async () => {
    fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/control': ok(overview(STAFF)),
    });
    renderRoute('/company/permissions?lang=en');
    expect(await screen.findByText('Your role cannot open this page')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Company Control Center menu' });
    expect(within(nav).queryByRole('link', { name: 'Permissions' })).toBeNull();
  });
});

describe('Permissions — member exceptions (EP27)', () => {
  it('lists people, opens one, and shows grouped effective states with their source', async () => {
    fakeApi(admin({ 'GET /api/v1/company/current/members/m_staff/permissions': ok(memberView()) }));
    const user = userEvent.setup();
    const { router } = renderRoute('/company/permissions?lang=en&view=members');
    expect(await screen.findByText(/Choose a person to see/)).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: /Staff Person/ }));
    expect(router.state.location.search).toContain('member=m_staff');
    await screen.findByRole('heading', { level: 2, name: 'Staff Person' });
    expect(
      screen.getByText(/3 of 12 permissions allowed · Assigned departments: Warehouse/),
    ).toBeInTheDocument();

    const groups = [...document.querySelectorAll<HTMLElement>('[data-permission-group]')].map(
      (g) => g.dataset.permissionGroup,
    );
    expect(groups).toEqual([
      'COMPANY_ADMIN',
      'SALES',
      'OPERATIONS',
      'WAREHOUSE',
      'PURCHASING',
      'ACCOUNTING',
      'EXECUTIVE',
    ]);
    const wh = document.querySelector<HTMLElement>('[data-permission-group="WAREHOUSE"]')!;
    expect(wh).toHaveAttribute('open');
    expect(within(wh).getByText('Stock adjustments')).toBeInTheDocument();
    // Default, allowed exception, denied exception — in words, not colour.
    expect(
      within(row('warehouse.stock_adjustment.create')).getByText('Allowed'),
    ).toBeInTheDocument();
    expect(
      within(row('warehouse.stock_adjustment.create')).getByText('· Role default'),
    ).toBeInTheDocument();
    expect(
      within(row('warehouse.stock_adjustment.approve')).getByText(/Exception: allowed/),
    ).toBeInTheDocument();
    expect(within(row('warehouse.inventory.view')).getByText('Not allowed')).toBeInTheDocument();
    expect(
      within(row('warehouse.inventory.view')).getByText(/Exception: denied/),
    ).toBeInTheDocument();
    // Inactive defaults explain why.
    expect(
      within(row('purchasing.requests.create')).getByText(
        /Inactive — not assigned to this department/,
      ),
    ).toBeInTheDocument();
    expect(
      within(row('executive.workspace.view')).getByText(/Inactive — not in the package/),
    ).toBeInTheDocument();
    // Raw code is secondary.
    expect(
      within(row('warehouse.inventory.view')).getByText('warehouse.inventory.view'),
    ).toBeInTheDocument();
    // Administration follows the role: no exception control there.
    const adminGroup = document.querySelector<HTMLElement>(
      '[data-permission-group="COMPANY_ADMIN"]',
    )!;
    expect(within(adminGroup).getByText(/cannot be set per person/)).toBeInTheDocument();
    expect(adminGroup.querySelector('select')).toBeNull();
    // An ALLOW the server would refuse is not offered.
    const purch = within(row('purchasing.requests.create')).getByLabelText(
      /Exception: Purchase requests — Create/,
    );
    expect(within(purch).getByRole('option', { name: 'Allow' })).toBeDisabled();
  });

  it('saves several exceptions in one request; a denial that removes access is confirmed first', async () => {
    const api = fakeApi(
      admin({
        'GET /api/v1/company/current/members/m_staff/permissions': ok(memberView()),
        'PUT /api/v1/company/current/members/m_staff/permissions': (body) => {
          const changes = (body as { changes: { permission: string; effect: string | null }[] })
            .changes;
          return ok(
            memberView({
              permissions: STAFF_STATES.map((s) => {
                const c = changes.find((x) => x.permission === s.code);
                if (!c) return s;
                return c.effect === 'DENY'
                  ? { ...s, effective: false, override: 'DENY', source: 'DENY_OVERRIDE' }
                  : c.effect === null
                    ? { ...s, effective: true, override: null, source: 'ROLE_DEFAULT' }
                    : { ...s, effective: true, override: 'ALLOW', source: 'ALLOW_OVERRIDE' };
              }),
            }),
          );
        },
      }),
    );
    const user = userEvent.setup();
    renderRoute('/company/permissions?lang=en&member=m_staff');
    const create = await screen.findByLabelText(/Exception: Stock adjustments — Create/);
    await user.selectOptions(create, 'DENY');
    await user.selectOptions(screen.getByLabelText(/Exception: Inventory — View/), 'DEFAULT');
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save exceptions' }));
    // One effective permission would be lost → confirmation, nothing sent yet.
    const confirm = screen.getByRole('group', { name: 'Confirm denial' });
    expect(within(confirm).getByText(/loses 1 permission they hold now/)).toBeInTheDocument();
    // Keyboard focus moves onto the confirmation.
    expect(within(confirm).getByRole('button', { name: 'Confirm and save' })).toHaveFocus();
    expect(api.called('PUT /api/v1/company/current/members/m_staff/permissions')).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Confirm and save' }));
    await waitFor(() =>
      expect(api.called('PUT /api/v1/company/current/members/m_staff/permissions')).toHaveLength(1),
    );
    expect(api.called('PUT /api/v1/company/current/members/m_staff/permissions')[0]!.body).toEqual({
      changes: [
        { permission: 'warehouse.stock_adjustment.create', effect: 'DENY' },
        { permission: 'warehouse.inventory.view', effect: null },
      ],
    });
    expect(
      await screen.findByText(/Exceptions saved — they apply to this person’s next request/),
    ).toBeInTheDocument();
    // The server's final state is shown.
    expect(
      within(row('warehouse.stock_adjustment.create')).getByText(/Exception: denied/),
    ).toBeInTheDocument();
    expect(within(row('warehouse.inventory.view')).getByText('Allowed')).toBeInTheDocument();
    expect(screen.queryByText(/unsaved/)).toBeNull();
  });

  it('an ALLOW alone saves without confirmation; a refusal is explained', async () => {
    const api = fakeApi(
      admin({
        'GET /api/v1/company/current/members/m_staff/permissions': ok(memberView()),
        'PUT /api/v1/company/current/members/m_staff/permissions': fail(
          422,
          'PERMISSION_NOT_ELIGIBLE',
        ),
      }),
    );
    const user = userEvent.setup();
    renderRoute('/company/permissions?lang=en&member=m_staff');
    await user.selectOptions(
      await screen.findByLabelText(/Exception: Sales orders — View/),
      'DENY',
    );
    await user.selectOptions(screen.getByLabelText(/Exception: Sales orders — View/), 'DEFAULT');
    expect(screen.queryByText(/unsaved/)).toBeNull(); // back to the current value
    await user.selectOptions(
      screen.getByLabelText(/Exception: Stock adjustments — Approve/),
      'DEFAULT',
    );
    await user.click(screen.getByRole('button', { name: 'Save exceptions' }));
    expect(
      await screen.findByText(/not in that department, or the department is not enabled/),
    ).toBeInTheDocument();
    expect(api.called('PUT /api/v1/company/current/members/m_staff/permissions')[0]!.body).toEqual({
      changes: [{ permission: 'warehouse.stock_adjustment.approve', effect: null }],
    });
  });

  it('explains the protected owner and shows no controls', async () => {
    fakeApi(
      admin({
        'GET /api/v1/company/current/members/m_owner/permissions': ok(
          memberView({
            member: {
              id: 'm_owner',
              fullName: 'Owner Person',
              email: 'owner@alpha.example',
              role: 'COMPANY_OWNER',
              status: 'ACTIVE',
              isOwner: true,
              isSelf: false,
            },
            permissions: STAFF_STATES.map((s) => ({
              ...s,
              effective: true,
              override: null,
              source: 'INVARIANT',
              blocked: null,
            })),
            protection: 'OWNER_PROTECTED',
            canManage: false,
          }),
        ),
      }),
    );
    renderRoute('/company/permissions?lang=en&member=m_owner');
    expect(
      await screen.findByText(/The Company Owner always works in every branch/),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-exception]')).toBeNull();
    expect(
      within(row('warehouse.inventory.view')).getByText(/Company Owner — always/),
    ).toBeInTheDocument();
  });
});

describe('CORE navigation by effective permission (EP27)', () => {
  const HEAD: BranchInfo = {
    id: 'b0',
    code: '00000',
    name: 'Head Office',
    type: 'HEAD_OFFICE',
    status: 'ACTIVE',
    address: {
      line1: '1 Road',
      line2: null,
      subdistrict: null,
      district: 'Sathorn',
      province: 'Bangkok',
      postalCode: '10120',
      countryCode: 'TH',
    },
    phone: null,
  };
  const ctx = (over: Partial<BranchContext>): BranchContext => ({
    company: { id: 'c1', displayName: 'Alpha Trading' },
    role: 'DEPARTMENT_STAFF',
    scope: 'ALL_BRANCHES',
    branches: [HEAD],
    selected: HEAD,
    needsSelection: false,
    blocked: null,
    departments: [],
    permissions: [],
    ...over,
  });

  it('lists only departments the server says may be opened, with the access level in words', async () => {
    fakeApi({
      ...signedIn(member('EXECUTIVE')),
      'GET /api/v1/company/context': ok(
        ctx({
          role: 'EXECUTIVE',
          departments: ['WAREHOUSE', 'PURCHASING'],
          permissions: [
            'warehouse.workspace.view',
            'warehouse.inventory.view',
            'purchasing.workspace.view',
            'purchasing.requests.create',
            'purchasing.requests.approve',
          ],
        }),
      ),
    });
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    const list = document.querySelector<HTMLElement>('[data-core-departments]')!;
    expect(
      [...list.querySelectorAll<HTMLElement>('[data-department]')].map((d) => d.dataset.department),
    ).toEqual(['WAREHOUSE', 'PURCHASING']);
    expect(
      within(list.querySelector<HTMLElement>('[data-department="WAREHOUSE"]')!).getByText(
        'View only',
      ),
    ).toBeInTheDocument();
    expect(
      within(list.querySelector<HTMLElement>('[data-department="PURCHASING"]')!).getByText(
        'Can approve / manage',
      ),
    ).toBeInTheDocument();
    // Executive is not offered unless the server lists it.
    expect(list.querySelector('[data-department="EXECUTIVE"]')).toBeNull();
  });
});

describe('Permission activity and languages (EP27)', () => {
  it('says what changed for whom in Activity (raw code never the main text)', async () => {
    fakeApi(
      admin({
        'GET /api/v1/company/current/activity': ok({
          items: [
            {
              id: 'a1',
              kind: 'admin',
              type: 'MEMBER_PERMISSION_OVERRIDE_ADDED',
              actor: { kind: 'member', email: 'admin@alpha.example', fullName: 'Admin Person' },
              entityType: 'CompanyMember',
              details: {
                member: 'staff@alpha.example',
                permission: 'warehouse.stock_adjustment.approve',
                from: null,
                to: 'DENY',
              },
              occurredAt: '2026-10-28T03:00:00.000Z',
            },
            {
              id: 'a2',
              kind: 'admin',
              type: 'MEMBER_PERMISSION_OVERRIDE_REMOVED',
              actor: { kind: 'member', email: 'admin@alpha.example', fullName: 'Admin Person' },
              entityType: 'CompanyMember',
              details: {
                member: 'staff@alpha.example',
                permission: 'warehouse.inventory.view',
                from: 'DENY',
                to: null,
              },
              occurredAt: '2026-10-28T02:00:00.000Z',
            },
          ],
        }),
      }),
    );
    renderRoute('/company/security?lang=en');
    expect(
      await screen.findByText('Denied Stock adjustments — Approve for staff@alpha.example'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Removed the Inventory — View exception for staff@alpha.example (back to the role default)',
      ),
    ).toBeInTheDocument();
  });

  it('has the same copy shape in TH / EN / ZH and no Thai in EN / ZH screens', async () => {
    const shape = (v: unknown): unknown =>
      typeof v === 'function'
        ? 'fn'
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.entries(v)
                .sort()
                .map(([k, x]) => [k, shape(x)]),
            )
          : typeof v;
    expect(shape(PERMISSION_COPY.en)).toEqual(shape(PERMISSION_COPY.th));
    expect(shape(PERMISSION_COPY['zh-CN'])).toEqual(shape(PERMISSION_COPY.th));

    for (const lang of ['en', 'zh'] as const) {
      for (const path of ['/company/permissions', '/company/permissions?member=m_staff']) {
        fakeApi(
          admin({ 'GET /api/v1/company/current/members/m_staff/permissions': ok(memberView()) }),
        );
        renderRoute(`${path}${path.includes('?') ? '&' : '?'}lang=${lang}`);
        await waitFor(() =>
          expect(
            document.querySelector('[data-role-matrix], [data-member-permissions]'),
          ).not.toBeNull(),
        );
        expect(document.body.textContent).not.toMatch(/[฀-๿]/);
        cleanup();
        resetIdentityForTests();
      }
    }
    fakeApi(admin());
    renderRoute('/company/permissions?lang=th');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'สิทธิ์การใช้งาน' }),
    ).toBeInTheDocument();
  });
});
