import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import { resetIdentityForTests } from '@/features/auth/session';
import type { BranchInfo } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import { ADMIN_COPY } from './adminCopy';
import type {
  BranchContext,
  BranchDetail,
  BranchList,
  AdminPermission,
  ControlOverview,
  InvitationList,
  InvitationRecord,
  Member,
  MemberDetail,
  MemberList,
} from './api';

/*
 * EP26 branch & user administration (UI). The screens follow the server's
 * answers — canManage, protection, branch access, invitation state. The
 * authorization itself (branch access, owner / peer protections, IDOR, token
 * rotation) is tested against the API in backend/test/branch-user-admin.test.ts.
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

const member = (role: CompanyRole) =>
  identity({
    company: { id: 'c1', name: 'Alpha Trading', isDemo: false, role, canEnterCore: true },
  });

const address = (district: string, province: string): BranchInfo['address'] => ({
  line1: '1 Main Road',
  line2: null,
  subdistrict: null,
  district,
  province,
  postalCode: '10120',
  countryCode: 'TH',
});

const HEAD: BranchInfo = {
  id: 'b0',
  code: '00000',
  name: 'Alpha Head Office',
  type: 'HEAD_OFFICE',
  status: 'ACTIVE',
  address: address('Sathorn', 'Bangkok'),
  phone: null,
  deactivatedAt: null,
  createdAt: '2026-10-20T03:00:00.000Z',
  updatedAt: '2026-10-20T03:00:00.000Z',
};
const BRANCH_A: BranchInfo = {
  ...HEAD,
  id: 'bA',
  code: '00001',
  name: 'Bang Yai',
  type: 'BRANCH',
  address: address('Bang Yai', 'Nonthaburi'),
};
const BRANCH_B: BranchInfo = {
  ...HEAD,
  id: 'bB',
  code: '00002',
  name: 'Chiang Mai',
  type: 'BRANCH',
  address: address('Mueang Chiang Mai', 'Chiang Mai'),
};
const CLOSED: BranchInfo = {
  ...BRANCH_A,
  id: 'bX',
  code: '00003',
  name: 'Old Depot',
  status: 'INACTIVE',
  deactivatedAt: '2026-10-25T03:00:00.000Z',
};
const ref = (b: BranchInfo) => ({
  id: b.id,
  code: b.code,
  name: b.name,
  type: b.type,
  status: b.status,
});

function overview(caps: AdminPermission[] = ADMIN): ControlOverview {
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
      memberId: 'm_admin',
      role: 'SYSTEM_ADMIN',
      jobTitle: null,
      permissions: caps,
      departments: [],
    },
    headOffice: HEAD,
    plan: null,
    departments: { enabled: ['SALES', 'WAREHOUSE'], unassigned: [] },
    counts: {
      branches: { active: 3, total: 4 },
      members: { active: 3, deactivated: 1 },
      invitations: { open: 1, expired: 1 },
    },
    setup: { steps: [], complete: true },
    attention: [],
    access: { canEnterCore: true },
  };
}

const control = (role: CompanyRole = 'SYSTEM_ADMIN', caps: AdminPermission[] = ADMIN) => ({
  ...signedIn(member(role)),
  'GET /api/v1/company/control': ok(overview(caps)),
});

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

const OWNER = person({
  id: 'm_owner',
  email: 'owner@alpha.example',
  fullName: 'Owner Person',
  role: 'COMPANY_OWNER',
  isOwner: true,
  canManage: false,
});
const RESTRICTED = person({
  id: 'm_staff',
  email: 'staff@alpha.example',
  fullName: 'Staff Person',
  departments: [{ code: 'WAREHOUSE', primary: true, active: true }],
  branchAccess: { scope: 'SELECTED_BRANCHES', branches: [ref(HEAD), ref(BRANCH_B)] },
});
const PEER = person({
  id: 'm_peer',
  email: 'peer@alpha.example',
  fullName: 'Peer Admin',
  role: 'SYSTEM_ADMIN',
  canManage: false,
});
const GONE = person({
  id: 'm_gone',
  email: 'gone@alpha.example',
  fullName: 'Gone Person',
  status: 'DEACTIVATED',
  deactivatedAt: '2026-10-26T03:00:00.000Z',
});

afterEach(() => {
  resetIdentityForTests();
});

/* ------------------------------------------------------------------ */

describe('Branches (EP26)', () => {
  const LIST: BranchList = {
    branches: [
      { ...HEAD, access: { people: 3, departments: ['SALES', 'WAREHOUSE'] } },
      { ...BRANCH_A, access: { people: 1, departments: [] } },
      { ...BRANCH_B, access: { people: 2, departments: ['WAREHOUSE'] } },
      { ...CLOSED, access: { people: 0, departments: [] } },
    ],
    suggestedCode: '00004',
    canManage: true,
  };

  it('lists branches code-first: Head Office identity, status, location, access and departments', async () => {
    fakeApi({ ...control(), 'GET /api/v1/company/current/branches': ok(LIST) });
    renderRoute('/company/branches?lang=en');
    const list = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-branch-list]');
      if (!el) throw new Error('branch list not rendered yet');
      return el;
    });
    const rows = [...list.querySelectorAll<HTMLElement>('[data-branch]')];
    expect(rows.map((r) => r.dataset.branch)).toEqual(['00000', '00001', '00002', '00003']);

    const head = within(rows[0]!);
    expect(head.getByText('Head Office')).toBeInTheDocument();
    expect(head.getByText('Sathorn, Bangkok')).toBeInTheDocument();
    expect(head.getByText('3 people')).toBeInTheDocument();
    expect(head.getByText('Sales')).toBeInTheDocument();
    expect(head.getByRole('link')).toHaveAttribute('href', '/company/branches/b0');

    // Department absence is said in words, not only by colour.
    expect(within(rows[1]!).getByText('No departments yet')).toBeInTheDocument();

    // Inactive is labelled, not only dimmed.
    expect(rows[3]!.dataset.status).toBe('INACTIVE');
    expect(within(rows[3]!).getAllByText('Inactive').length).toBeGreaterThan(0);
    expect(screen.getByText('3 of 4 branches active')).toBeInTheDocument();
  });

  it('creates a branch with the server-proposed code and never sends a company id', async () => {
    const api = fakeApi({
      ...control(),
      'GET /api/v1/company/current/branches': ok(LIST),
      'POST /api/v1/company/current/branches': ok({ branch: { ...BRANCH_A, code: '00004' } }),
    });
    const user = userEvent.setup();
    renderRoute('/company/branches?lang=en');
    await user.click(await screen.findByRole('button', { name: 'Add branch' }));
    const form = within(document.querySelector<HTMLElement>('[data-branch-form="new"]')!);
    expect(form.getByText('5 digits — leave empty to use 00004')).toBeInTheDocument();
    await user.type(form.getByLabelText(/^Branch name/), 'Rayong');
    await user.type(form.getByRole('textbox', { name: /^Address(?! line)/ }), '9 Sukhumvit Road');
    await user.type(form.getByLabelText(/^Province/), 'Rayong');
    await user.type(form.getByLabelText(/^Postal code/), '21000');
    await user.click(form.getByRole('button', { name: 'Create branch' }));
    await waitFor(() =>
      expect(api.called('POST /api/v1/company/current/branches')).toHaveLength(1),
    );
    const body = api.called('POST /api/v1/company/current/branches')[0]!.body as object;
    expect(body).toMatchObject({ name: 'Rayong', province: 'Rayong', postalCode: '21000' });
    expect(body).not.toHaveProperty('companyId');
    expect(await screen.findByText('Branch 00004 created')).toBeInTheDocument();
  });

  it('a department role cannot add branches (read only)', async () => {
    fakeApi({
      ...control('DEPARTMENT_MANAGER', ['company.profile.view', 'company.branches.view']),
      'GET /api/v1/company/current/branches': ok({ ...LIST, canManage: false }),
    });
    renderRoute('/company/branches?lang=en');
    await screen.findByText('Alpha Head Office');
    expect(screen.queryByRole('button', { name: 'Add branch' })).toBeNull();
  });
});

describe('Branch detail (EP26)', () => {
  const detail = (branch: BranchInfo, over: Partial<BranchDetail> = {}): BranchDetail => ({
    branch,
    access: { people: 2, departments: ['WAREHOUSE'], allBranches: 1, selected: 1 },
    people: [
      {
        id: 'm_owner',
        fullName: 'Owner Person',
        email: 'owner@alpha.example',
        role: 'COMPANY_OWNER',
        scope: 'ALL_BRANCHES',
        departments: [],
      },
      {
        id: 'm_staff',
        fullName: 'Staff Person',
        email: 'staff@alpha.example',
        role: 'DEPARTMENT_STAFF',
        scope: 'SELECTED_BRANCHES',
        departments: [{ code: 'WAREHOUSE', primary: true, active: true }],
      },
    ],
    peopleTotal: 2,
    enabledDepartments: ['SALES', 'WAREHOUSE'],
    canManage: true,
    canManagePeople: true,
    ...over,
  });

  it('shows identity, address, access and departments; edits only the changed fields', async () => {
    let current = BRANCH_B;
    const api = fakeApi({
      ...control(),
      'GET /api/v1/company/current/branches/bB/detail': () => ok(detail(current)),
      'PATCH /api/v1/company/current/branches/bB': (body) => {
        current = { ...current, ...(body as Partial<BranchInfo>) };
        return ok({ branch: current });
      },
    });
    const user = userEvent.setup();
    renderRoute('/company/branches/bB?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'Chiang Mai' });
    const page = document.querySelector<HTMLElement>('[data-branch-detail="00002"]')!;
    // A branch is never labelled as the Head Office address.
    expect(within(page).getByRole('heading', { name: 'Branch details' })).toBeInTheDocument();
    expect(within(page).queryByText(/Head Office address/)).toBeNull();
    expect(within(page).getByText(/1 Main Road Mueang Chiang Mai Chiang Mai 10120/)).toBeVisible();
    expect(within(page).getByText(/people with access can choose this branch/)).toBeVisible();
    expect(
      within(page).getByText('1 person has access to this branch specifically'),
    ).toBeInTheDocument();
    expect(within(page).getByText('1 person works in every branch')).toBeInTheDocument();
    const departments = page.querySelector<HTMLElement>('[data-branch-departments]')!;
    expect(within(departments).getByText('Warehouse')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit branch details' }));
    const form = within(document.querySelector<HTMLElement>('[data-branch-form="edit"]')!);
    // The code is fixed once set.
    expect(form.getByText('A branch code is set once and cannot change')).toBeInTheDocument();
    const name = form.getByLabelText(/^Branch name/);
    await user.clear(name);
    await user.type(name, 'Chiang Mai Centre');
    await user.click(form.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.called('PATCH /api/v1/company/current/branches/bB')).toHaveLength(1),
    );
    expect(api.called('PATCH /api/v1/company/current/branches/bB')[0]!.body).toEqual({
      name: 'Chiang Mai Centre',
    });
    expect(await screen.findByText('Branch saved')).toBeInTheDocument();
  });

  it('deactivates after confirmation and reactivates; the Head Office cannot be deactivated', async () => {
    let current = BRANCH_B;
    const api = fakeApi({
      ...control(),
      'GET /api/v1/company/current/branches/bB/detail': () => ok(detail(current)),
      'POST /api/v1/company/current/branches/bB/deactivate': () => {
        current = { ...current, status: 'INACTIVE' };
        return ok({ branch: current });
      },
      'POST /api/v1/company/current/branches/bB/reactivate': () => {
        current = { ...current, status: 'ACTIVE' };
        return ok({ branch: current });
      },
    });
    const user = userEvent.setup();
    renderRoute('/company/branches/bB?lang=en');
    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
    expect(screen.getByText(/Deactivate Chiang Mai\? People working in it/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Branch deactivated')).toBeInTheDocument();
    expect(screen.getByText(/Inactive — nobody can choose this branch/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reactivate' }));
    expect(await screen.findByText('Branch reactivated')).toBeInTheDocument();
    expect(api.called('POST /api/v1/company/current/branches/bB/deactivate')).toHaveLength(1);
    expect(api.called('POST /api/v1/company/current/branches/bB/reactivate')).toHaveLength(1);
    cleanup();
    resetIdentityForTests();

    fakeApi({
      ...control(),
      'GET /api/v1/company/current/branches/b0/detail': ok(detail(HEAD)),
    });
    renderRoute('/company/branches/b0?lang=en');
    expect(
      await screen.findByText(/The Head Office is always active and cannot be deactivated/),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-deactivate-branch]')).toBeNull();
  });

  it('says plainly when the branch is not in this company (no other company’s data)', async () => {
    fakeApi({
      ...control(),
      'GET /api/v1/company/current/branches/other/detail': fail(404, 'BRANCH_NOT_FOUND'),
    });
    renderRoute('/company/branches/other?lang=en');
    expect(await screen.findByText('This branch was not found in your company')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */

const PEOPLE: Member[] = [
  OWNER,
  RESTRICTED,
  PEER,
  GONE,
  ...Array.from({ length: 26 }, (_, i) =>
    person({ id: `m_${i}`, email: `p${String(i).padStart(2, '0')}@alpha.example` }),
  ),
];

/** A fake members endpoint that searches, filters and pages like the server. */
function membersEndpoint(all: Member[]) {
  return (_body: unknown, q: URLSearchParams) => {
    const text = (q.get('q') ?? '').toLowerCase();
    const rows = all.filter(
      (m) =>
        (!text || `${m.fullName ?? ''} ${m.email}`.toLowerCase().includes(text)) &&
        (!q.get('role') || m.role === q.get('role')) &&
        (!q.get('status') || m.status === q.get('status')),
    );
    const page = Number(q.get('page') ?? 1);
    const size = Number(q.get('pageSize') ?? 25);
    const list: MemberList = {
      members: rows.slice((page - 1) * size, page * size),
      total: rows.length,
      page,
      pageSize: size,
      hasMore: page * size < rows.length,
      summary: { active: 29, deactivated: 1 },
      invitations: [],
      branches: [HEAD, BRANCH_A, BRANCH_B, CLOSED].map(ref),
      assignableRoles: ['EXECUTIVE', 'DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER'],
      canManage: true,
      enabledDepartments: ['SALES', 'WAREHOUSE'],
      defaultLocale: 'th',
    };
    return ok(list);
  };
}

describe('People (EP26)', () => {
  it('searches on the server (debounced), filters, pages with Show more and routes to the member', async () => {
    const api = fakeApi({
      ...control(),
      'GET /api/v1/company/current/members': membersEndpoint(PEOPLE),
    });
    const user = userEvent.setup();
    renderRoute('/company/users?lang=en');
    await screen.findByText('30 people found · 29 active');
    const list = () => document.querySelectorAll('[data-member-list] [data-member]');
    expect(list()).toHaveLength(25);

    await user.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(list()).toHaveLength(30));
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(api.calls.at(-1)!.query).toMatchObject({ page: '2', pageSize: '25' });

    await user.type(screen.getByLabelText('Search'), 'staff');
    await screen.findByText(/^1 person found/);
    // One request for the whole typed word, not one per keystroke.
    const searches = api
      .called('GET /api/v1/company/current/members')
      .filter((c) => c.query.q !== undefined);
    expect(searches.map((c) => c.query.q)).toEqual(['staff']);
    const row = screen.getByRole('link', { name: /Staff Person/ });
    expect(row).toHaveAttribute('href', '/company/users/m_staff');
    // Selected branches are named by code; inactive ones are never listed as options.
    expect(within(row).getByText('00000')).toBeInTheDocument();
    expect(within(row).getByText('00002')).toBeInTheDocument();
    expect(within(row).queryByText('00001')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.selectOptions(screen.getByLabelText('Status'), 'DEACTIVATED');
    await screen.findByText(/^1 person found/);
    expect(api.calls.at(-1)!.query).toMatchObject({ status: 'DEACTIVATED', page: '1' });
    expect(screen.getByRole('link', { name: /Gone Person/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), '');
    await user.selectOptions(screen.getByLabelText('Role'), 'COMPANY_OWNER');
    await screen.findByText(/^1 person found/);
    expect(
      within(screen.getByRole('link', { name: /Owner Person/ })).getByText('All branches'),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Role'), 'VIEWER');
    expect(await screen.findByText('Nobody matches these filters')).toBeInTheDocument();
  });

  it('invites with role, departments and selected-branch intent (active branches only)', async () => {
    const api = fakeApi({
      ...control(),
      'GET /api/v1/company/current/members': membersEndpoint(PEOPLE),
      'POST /api/v1/company/invitations': ok({
        id: 'i9',
        email: 'new@alpha.example',
        role: 'DEPARTMENT_STAFF',
        expiresAt: '',
      }),
    });
    const user = userEvent.setup();
    renderRoute('/company/users?lang=en');
    await user.click(await screen.findByRole('button', { name: 'Invite user' }));
    const form = document.querySelector<HTMLElement>('[data-invite-form]')!;
    const f = within(form);
    await user.type(f.getByLabelText('Email'), 'new@alpha.example');
    await user.click(form.querySelector<HTMLElement>('[data-invite-department="WAREHOUSE"]')!);
    await user.click(form.querySelector<HTMLElement>('[data-scope="SELECTED_BRANCHES"]')!);
    // The inactive branch cannot be granted by an invitation.
    expect(form.querySelector('[data-branch-option="00003"]')).toBeNull();
    // Selected branches with none chosen is refused before sending.
    await user.click(f.getByRole('button', { name: 'Send invitation' }));
    expect(f.getByRole('alert')).toHaveTextContent('Choose at least one branch');
    expect(api.called('POST /api/v1/company/invitations')).toHaveLength(0);

    await user.click(form.querySelector<HTMLElement>('[data-branch-option="00000"]')!);
    await user.click(form.querySelector<HTMLElement>('[data-branch-option="00002"]')!);
    expect(
      f.getByText(/This access is checked again when the invitation is accepted/),
    ).toBeVisible();
    await user.click(f.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(api.called('POST /api/v1/company/invitations')).toHaveLength(1));
    expect(api.called('POST /api/v1/company/invitations')[0]!.body).toEqual({
      email: 'new@alpha.example',
      role: 'DEPARTMENT_STAFF',
      locale: 'th',
      departments: ['WAREHOUSE'],
      branchScope: 'SELECTED_BRANCHES',
      branchIds: ['b0', 'bB'],
    });
  });
});

describe('Member detail and branch access (EP26)', () => {
  const detail = (m: Member, over: Partial<MemberDetail> = {}): MemberDetail => ({
    member: m,
    protection: null,
    assignableRoles: ['EXECUTIVE', 'DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER'],
    enabledDepartments: ['SALES', 'WAREHOUSE'],
    branches: [HEAD, BRANCH_A, BRANCH_B, CLOSED].map(ref),
    history: [
      {
        id: 'e1',
        kind: 'admin',
        type: 'MEMBER_BRANCH_ACCESS_CHANGED',
        actor: { kind: 'member', email: 'admin@alpha.example', fullName: 'Admin Person' },
        entityType: 'CompanyMember',
        details: {},
        occurredAt: '2026-10-27T03:00:00.000Z',
      },
    ],
    canManage: true,
    ...over,
  });

  it('switches a member between all branches and selected branches (server decides)', async () => {
    let current = RESTRICTED;
    const api = fakeApi({
      ...control(),
      'GET /api/v1/company/current/members/m_staff': () => ok(detail(current)),
      'PUT /api/v1/company/current/members/m_staff/branches': (body) => {
        const b = body as {
          branchScope: 'ALL_BRANCHES' | 'SELECTED_BRANCHES';
          branchIds?: string[];
        };
        current = {
          ...current,
          branchAccess: {
            scope: b.branchScope,
            branches: [HEAD, BRANCH_A, BRANCH_B]
              .filter((x) => b.branchIds?.includes(x.id))
              .map(ref),
          },
        };
        return ok(detail(current));
      },
    });
    const user = userEvent.setup();
    renderRoute('/company/users/m_staff?lang=en');
    const editor = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-editor="branches"]');
      if (!el) throw new Error('branch editor not rendered yet');
      return el;
    });
    // Human-readable history.
    expect(screen.getByText('Branch access changed')).toBeInTheDocument();
    expect(within(editor).getByRole('radio', { name: /Selected branches/ })).toBeChecked();
    const option = (code: string) =>
      editor.querySelector<HTMLInputElement>(`[data-branch-option="${code}"]`);
    expect(option('00000')).toBeChecked();
    expect(option('00002')).toBeChecked();
    expect(option('00001')).not.toBeChecked();
    // An inactive branch is not offered unless already granted.
    expect(option('00003')).toBeNull();

    // Removing every branch is refused in place.
    await user.click(option('00000')!);
    await user.click(option('00002')!);
    await user.click(within(editor).getByRole('button', { name: 'Save branch access' }));
    expect(within(editor).getByRole('alert')).toHaveTextContent('Choose at least one branch');
    expect(api.called('PUT /api/v1/company/current/members/m_staff/branches')).toHaveLength(0);

    await user.click(option('00002')!);
    await user.click(within(editor).getByRole('button', { name: 'Save branch access' }));
    await waitFor(() =>
      expect(api.called('PUT /api/v1/company/current/members/m_staff/branches')).toHaveLength(1),
    );
    expect(api.called('PUT /api/v1/company/current/members/m_staff/branches')[0]!.body).toEqual({
      branchScope: 'SELECTED_BRANCHES',
      branchIds: ['bB'],
    });
    expect(await within(editor).findByText('Saved')).toBeInTheDocument();

    await user.click(within(editor).getByRole('radio', { name: /All branches/ }));
    await user.click(within(editor).getByRole('button', { name: 'Save branch access' }));
    await waitFor(() =>
      expect(api.called('PUT /api/v1/company/current/members/m_staff/branches')).toHaveLength(2),
    );
    expect(api.called('PUT /api/v1/company/current/members/m_staff/branches')[1]!.body).toEqual({
      branchScope: 'ALL_BRANCHES',
    });
  });

  it('removes and restores company access after confirmation', async () => {
    let current = RESTRICTED;
    const api = fakeApi({
      ...control(),
      'GET /api/v1/company/current/members/m_staff': () => ok(detail(current)),
      'POST /api/v1/company/current/members/m_staff/deactivate': () => {
        current = { ...current, status: 'DEACTIVATED' };
        return ok({});
      },
      'POST /api/v1/company/current/members/m_staff/reactivate': () => {
        current = { ...current, status: 'ACTIVE' };
        return ok({});
      },
    });
    const user = userEvent.setup();
    renderRoute('/company/users/m_staff?lang=en');
    await user.click(await screen.findByRole('button', { name: 'Remove company access' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText(/Access removed — the account and history stay/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Restore company access' }));
    expect(await screen.findByText(/Active — can use the Company Control Center/)).toBeVisible();
    expect(api.called('POST /api/v1/company/current/members/m_staff/deactivate')).toHaveLength(1);
    expect(api.called('POST /api/v1/company/current/members/m_staff/reactivate')).toHaveLength(1);
  });

  it('explains protected people instead of only hiding the controls', async () => {
    for (const [m, protection, text] of [
      [OWNER, 'OWNER_PROTECTED', /The Company Owner always works in every branch/],
      [PEER, 'PEER_ADMIN', /Only the Company Owner can change a System Admin/],
    ] as const) {
      fakeApi({
        ...control(),
        [`GET /api/v1/company/current/members/${m.id}`]: ok(
          detail(m, { protection, canManage: false }),
        ),
      });
      renderRoute(`/company/users/${m.id}?lang=en`);
      expect(await screen.findByText(text)).toBeVisible();
      expect(document.querySelector('[data-editor]')).toBeNull();
      expect(document.querySelector('[data-deactivate-member]')).toBeNull();
      if (m.isOwner) {
        expect(
          screen.getByText('Every active branch, including branches added later'),
        ).toBeVisible();
      } else {
        // Branch access never narrows a System Admin's administration.
        expect(
          screen.getByText(
            'Limiting branches never limits a System Admin’s company administration',
          ),
        ).toBeVisible();
      }
      cleanup();
      resetIdentityForTests();
    }
  });
});

/* ------------------------------------------------------------------ */

describe('Invitations (EP26)', () => {
  const inv = (
    over: Partial<InvitationRecord> & Pick<InvitationRecord, 'id' | 'email' | 'state'>,
  ) =>
    ({
      role: 'DEPARTMENT_STAFF',
      locale: 'en',
      departments: [],
      branchAccess: { scope: 'ALL_BRANCHES', branches: [] },
      invitedBy: { email: 'admin@alpha.example', fullName: 'Admin Person' },
      acceptedBy: null,
      resent: false,
      createdAt: '2026-10-20T03:00:00.000Z',
      expiresAt: '2026-11-03T03:00:00.000Z',
      acceptedAt: null,
      revokedAt: null,
      canManage: true,
      ...over,
    }) satisfies InvitationRecord;

  const ALL = [
    inv({
      id: 'i1',
      email: 'pending@alpha.example',
      state: 'PENDING',
      departments: ['WAREHOUSE'],
      branchAccess: { scope: 'SELECTED_BRANCHES', branches: [ref(BRANCH_B)] },
    }),
    inv({ id: 'i2', email: 'expired@alpha.example', state: 'EXPIRED' }),
    inv({
      id: 'i3',
      email: 'accepted@alpha.example',
      state: 'ACCEPTED',
      acceptedAt: '2026-10-22T03:00:00.000Z',
      canManage: false,
    }),
    inv({
      id: 'i4',
      email: 'revoked@alpha.example',
      state: 'REVOKED',
      revokedAt: '2026-10-23T03:00:00.000Z',
      canManage: false,
    }),
  ];
  const endpoint = (rows: InvitationRecord[]) => (_b: unknown, q: URLSearchParams) => {
    const state = q.get('state') ?? 'PENDING';
    const list = state === 'ALL' ? rows : rows.filter((r) => r.state === state);
    const counts = { PENDING: 0, EXPIRED: 0, ACCEPTED: 0, REVOKED: 0 };
    for (const r of rows) counts[r.state]++;
    return ok({
      invitations: list,
      total: list.length,
      page: 1,
      pageSize: 25,
      hasMore: false,
      counts,
      canManage: true,
    } satisfies InvitationList);
  };

  it('shows the server’s states with counts and intent; only open ones can be resent or revoked', async () => {
    const api = fakeApi({
      ...control(),
      'GET /api/v1/company/current/invitations': endpoint(ALL),
    });
    const user = userEvent.setup();
    renderRoute('/company/users/invitations?lang=en&state=ALL');
    const list = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-invitation-list]');
      if (!el) throw new Error('invitation list not rendered yet');
      return el;
    });
    expect(api.calls.at(-1)!.query).toMatchObject({ state: 'ALL' });
    const row = (state: string) => list.querySelector<HTMLElement>(`[data-state="${state}"]`)!;
    expect(within(row('PENDING')).getByText('Pending')).toBeInTheDocument();
    expect(within(row('PENDING')).getByText('Warehouse')).toBeInTheDocument();
    expect(within(row('PENDING')).getByText('00002')).toBeInTheDocument();
    expect(within(row('PENDING')).getByText('Department staff')).toBeInTheDocument();
    expect(within(row('EXPIRED')).getByText(/^Expired /)).toBeInTheDocument();
    expect(within(row('EXPIRED')).getByText('All branches')).toBeInTheDocument();
    expect(within(row('ACCEPTED')).getByText(/^Accepted /)).toBeInTheDocument();
    expect(within(row('REVOKED')).getByText(/^Revoked /)).toBeInTheDocument();

    // Resend for pending and expired; revoke only for pending; nothing for the closed ones.
    expect(row('PENDING').querySelector('[data-resend]')).not.toBeNull();
    expect(row('PENDING').querySelector('[data-revoke]')).not.toBeNull();
    expect(row('EXPIRED').querySelector('[data-resend]')).not.toBeNull();
    expect(row('EXPIRED').querySelector('[data-revoke]')).toBeNull();
    for (const s of ['ACCEPTED', 'REVOKED']) {
      expect(row(s).querySelector('[data-resend]')).toBeNull();
      expect(row(s).querySelector('[data-revoke]')).toBeNull();
    }

    // The state filter is a server query, with the server's counts.
    const filter = screen.getByRole('radiogroup', { name: 'Invitation state' });
    expect(within(filter).getByRole('radio', { name: /Expired\s*1/ })).toBeInTheDocument();
    await user.click(within(filter).getByRole('radio', { name: /Revoked/ }));
    await waitFor(() => expect(api.calls.at(-1)!.query).toMatchObject({ state: 'REVOKED' }));
    await waitFor(() => expect(document.querySelectorAll('[data-invitation]')).toHaveLength(1));
  });

  it('resends (old link stops) and revokes after confirmation', async () => {
    const api = fakeApi({
      ...control(),
      'GET /api/v1/company/current/invitations': endpoint(ALL),
      'POST /api/v1/company/invitations/i1/resend': ok({
        id: 'i1',
        email: 'pending@alpha.example',
        role: 'DEPARTMENT_STAFF',
        expiresAt: '2026-11-04T03:00:00.000Z',
      }),
      'POST /api/v1/company/invitations/i1/revoke': ok({ status: 'revoked' }),
    });
    const user = userEvent.setup();
    renderRoute('/company/users/invitations?lang=en');
    const pending = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-invitation="pending@alpha.example"]');
      if (!el) throw new Error('pending invitation not rendered yet');
      return el;
    });
    await user.click(within(pending).getByRole('button', { name: 'Resend' }));
    expect(
      await screen.findByText('Invitation resent — the previous link no longer works'),
    ).toBeInTheDocument();
    expect(api.called('POST /api/v1/company/invitations/i1/resend')).toHaveLength(1);

    const again = document.querySelector<HTMLElement>('[data-invitation="pending@alpha.example"]')!;
    await user.click(within(again).getByRole('button', { name: 'Revoke' }));
    expect(
      screen.getByText(/Revoke the invitation for pending@alpha.example\? The link/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Invitation revoked')).toBeInTheDocument();
    expect(api.called('POST /api/v1/company/invitations/i1/revoke')).toHaveLength(1);
  });

  it('reports a refused resend in words (e.g. already accepted elsewhere)', async () => {
    fakeApi({
      ...control(),
      'GET /api/v1/company/current/invitations': endpoint(ALL),
      'POST /api/v1/company/invitations/i1/resend': fail(404, 'INVITATION_NOT_FOUND'),
    });
    const user = userEvent.setup();
    renderRoute('/company/users/invitations?lang=en');
    const pending = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-invitation="pending@alpha.example"]');
      if (!el) throw new Error('pending invitation not rendered yet');
      return el;
    });
    await user.click(within(pending).getByRole('button', { name: 'Resend' }));
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')!.textContent).not.toBe(''),
    );
    expect(screen.queryByText('Invitation resent — the previous link no longer works')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe('CORE branch selector and context (EP26)', () => {
  const context = (over: Partial<BranchContext> = {}): BranchContext => ({
    company: { id: 'c1', displayName: 'Alpha Trading' },
    role: 'DEPARTMENT_STAFF',
    scope: 'SELECTED_BRANCHES',
    branches: [HEAD, BRANCH_B],
    selected: null,
    needsSelection: true,
    blocked: null,
    departments: ['WAREHOUSE'],
    ...over,
  });

  it('groups Head Office apart, shows code and location, lists only permitted branches', async () => {
    fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/context': ok(context()),
    });
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'Choose the branch you work in' });
    const head = screen.getByRole('group', { name: 'Head Office' });
    const others = screen.getByRole('group', { name: 'Branches' });
    expect(within(head).getByRole('radio', { name: /00000/ })).toBeInTheDocument();
    expect(within(head).getByText('Sathorn, Bangkok')).toBeInTheDocument();
    expect(within(others).getByRole('radio', { name: /00002.*Chiang Mai/ })).toBeInTheDocument();
    expect(within(others).getByText('Mueang Chiang Mai, Chiang Mai')).toBeInTheDocument();
    // Branch A (not permitted) is simply absent.
    expect(screen.queryByText('Bang Yai')).toBeNull();
    expect(document.querySelector('[data-branch-option="00001"]')).toBeNull();
    expect(screen.getByText('You can work in 2 branches')).toBeInTheDocument();
    // Nothing is chosen for the person.
    expect(screen.getByRole('button', { name: 'Enter CORE' })).toBeDisabled();
  });

  it('is keyboard-operable and names the working branch in the header once chosen', async () => {
    const api = fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/context': ok(context()),
      'POST /api/v1/company/context/branch': ok(
        context({ selected: BRANCH_B, needsSelection: false }),
      ),
    });
    const user = userEvent.setup();
    renderRoute('/core/branch?lang=en');
    const first = await screen.findByRole('radio', { name: /00000/ });
    first.focus();
    await user.keyboard(' ');
    expect(first).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /00002/ }));
    await user.click(screen.getByRole('button', { name: 'Enter CORE' }));
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    expect(api.called('POST /api/v1/company/context/branch')[0]!.body).toEqual({ branchId: 'bB' });
    const header = document.querySelector<HTMLElement>('[data-selected-branch]')!;
    expect(header.dataset.selectedBranch).toBe('00002');
    expect(header).toHaveTextContent('Working in: Chiang Mai · 00002');
    // Internal ids are never shown.
    expect(document.body.textContent).not.toMatch(/\bbB\b/);
  });

  it('names the Head Office by its role in the header', async () => {
    fakeApi({
      ...signedIn(member('COMPANY_OWNER')),
      'GET /api/v1/company/context': ok(
        context({
          role: 'COMPANY_OWNER',
          scope: 'ALL_BRANCHES',
          branches: [HEAD, BRANCH_A, BRANCH_B],
          selected: HEAD,
          needsSelection: false,
        }),
      ),
    });
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    expect(document.querySelector('[data-selected-branch]')).toHaveTextContent(
      'Head Office · 00000',
    );
    expect(screen.getByRole('link', { name: 'Change branch' })).toHaveAttribute(
      'href',
      '/core/branch',
    );
  });

  it('a refused branch (access just removed) refreshes the list instead of keeping it', async () => {
    let removed = false;
    const api = fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/context': () =>
        ok(
          removed
            ? context({ branches: [HEAD], selected: HEAD, needsSelection: false })
            : context(),
        ),
      'POST /api/v1/company/context/branch': () => {
        removed = true;
        return fail(403, 'BRANCH_NOT_ALLOWED');
      },
    });
    const user = userEvent.setup();
    renderRoute('/core/branch?lang=en');
    await user.click(await screen.findByRole('radio', { name: /00002/ }));
    await user.click(screen.getByRole('button', { name: 'Enter CORE' }));
    expect(await screen.findByText('You do not have access to this branch.')).toBeInTheDocument();
    await waitFor(() => expect(api.called('GET /api/v1/company/context')).toHaveLength(2));
    await waitFor(() => expect(document.querySelector('[data-branch-option="00002"]')).toBeNull());
    expect(document.querySelector('[data-selected-branch]')).toHaveTextContent('00000');
  });

  it('drops a stale branch from the header when the tab comes back and the server cleared it', async () => {
    let cleared = false;
    fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/context': () =>
        ok(
          cleared
            ? context({
                branches: [],
                selected: null,
                needsSelection: false,
                blocked: 'NO_BRANCH_ACCESS',
              })
            : context({ selected: BRANCH_B, needsSelection: false }),
        ),
    });
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    expect(document.querySelector('[data-selected-branch]')).toHaveTextContent('00002');
    cleared = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await screen.findByRole('heading', { level: 1, name: 'No branch is open to you yet' });
    expect(document.querySelector('[data-selected-branch]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Chiang Mai|00002/);
  });

  it('a deactivated membership found on revalidation closes CORE', async () => {
    let gone = false;
    fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/context': () =>
        gone
          ? fail(403, 'MEMBERSHIP_INACTIVE')
          : ok(context({ selected: BRANCH_B, needsSelection: false })),
    });
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    gone = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(document.querySelector('[data-core-home]')).toBeNull());
    expect(document.querySelector('[data-selected-branch]')).toBeNull();
  });

  it('with no permitted branch: a plain blocked state, no redirect loop, no branch names', async () => {
    const api = fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/context': ok(
        context({
          branches: [],
          selected: null,
          needsSelection: false,
          blocked: 'NO_BRANCH_ACCESS',
        }),
      ),
    });
    const { router } = renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'No branch is open to you yet' });
    expect(router.state.location.pathname).toBe('/core');
    expect(screen.getByText(/Contact the Company Owner or a System Admin/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Back to the Company Control Center' }),
    ).toHaveAttribute('href', '/company');
    await router.navigate('/core/branch?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'No branch is open to you yet' });
    expect(document.querySelector('[data-branch-selector]')).toBeNull();
    expect(api.called('GET /api/v1/company/context')).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */

describe('EP26 copy (TH / EN / ZH)', () => {
  const shape = (v: unknown): unknown =>
    typeof v === 'function'
      ? 'fn'
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
        : typeof v;

  it('has exactly the same structure in every language', () => {
    expect(shape(ADMIN_COPY.en)).toEqual(shape(ADMIN_COPY.th));
    expect(shape(ADMIN_COPY['zh-CN'])).toEqual(shape(ADMIN_COPY.th));
  });

  it('administration screens never leak Thai into EN / ZH', async () => {
    for (const lang of ['en', 'zh'] as const) {
      fakeApi({
        ...control(),
        'GET /api/v1/company/current/members': membersEndpoint(PEOPLE.slice(0, 4)),
      });
      renderRoute(`/company/users?lang=${lang}`);
      await waitFor(() => expect(document.querySelector('[data-member-list]')).not.toBeNull());
      expect(document.body.textContent).not.toMatch(/[฀-๿]/);
      cleanup();
      resetIdentityForTests();

      fakeApi({
        ...signedIn(member('DEPARTMENT_STAFF')),
        'GET /api/v1/company/context': ok({
          company: { id: 'c1', displayName: 'Alpha Trading' },
          role: 'DEPARTMENT_STAFF',
          scope: 'SELECTED_BRANCHES',
          branches: [HEAD, BRANCH_B],
          selected: null,
          needsSelection: true,
          blocked: null,
          departments: [],
        } satisfies BranchContext),
      });
      renderRoute(`/core/branch?lang=${lang}`);
      await waitFor(() => expect(document.querySelector('[data-branch-selector]')).not.toBeNull());
      expect(document.body.textContent).not.toMatch(/[฀-๿]/);
      cleanup();
      resetIdentityForTests();
    }
  });

  it('speaks Thai on the blocked state', async () => {
    fakeApi({
      ...signedIn(member('VIEWER')),
      'GET /api/v1/company/context': ok({
        company: { id: 'c1', displayName: 'Alpha Trading' },
        role: 'VIEWER',
        scope: 'SELECTED_BRANCHES',
        branches: [],
        selected: null,
        needsSelection: false,
        blocked: 'NO_BRANCH_ACCESS',
        departments: [],
      } satisfies BranchContext),
    });
    renderRoute('/core?lang=th');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'ยังไม่มีสาขาที่คุณทำงานได้' }),
    ).toBeInTheDocument();
  });
});
