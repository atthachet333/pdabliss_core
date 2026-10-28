import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import {
  createActiveCompany,
  createHarness,
  createUser,
  describeDb,
  resetDb,
  signIn,
  tokenFrom,
  type ApiResponse,
  type Browser,
  type Harness,
} from './support.js';

/*
 * EP26 branch & user administration, against the isolated test database:
 * branch access (default all-branch compatibility, the owner guarantee,
 * restricted selection, stale context), member administration (search,
 * filters, detail, roles, self / peer protection), invitations (intent,
 * revoke, resend, one-time tokens, concurrent acceptance), deactivation,
 * company isolation (IDOR) and mass assignment.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;

const C = '/api/v1/company';

describeDb('Branch & user administration (EP26)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  /** Company A branches: 00000 (Head Office), 00001 (Branch A), 00002 (Branch B). */
  const br: Record<'HO' | 'A' | 'B' | 'BETA_HO', string> = { HO: '', A: '', B: '', BETA_HO: '' };
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    h.mailer.clear();
    A = await createActiveCompany(h.db, {
      name: 'Alpha',
      plan: 'PROFESSIONAL',
      departments: ['SALES', 'WAREHOUSE', 'EXECUTIVE'],
    });
    B = await createActiveCompany(h.db, { name: 'Beta', plan: 'STARTER', departments: ['SALES'] });
    br.HO = A.headOfficeId;
    br.BETA_HO = B.headOfficeId;
    for (const [key, codeValue, name] of [
      ['A', '00001', 'Branch A'],
      ['B', '00002', 'Branch B'],
    ] as const) {
      br[key] = (
        await h.db.branch.create({
          data: {
            companyId: A.companyId,
            code: codeValue,
            name,
            type: 'BRANCH',
            addressLine1: `${codeValue} Road`,
            province: 'Bangkok',
            postalCode: '10110',
          },
        })
      ).id;
    }
    const people: [string, CompanyRole, string][] = [
      ['owner@a.example', 'COMPANY_OWNER', A.companyId],
      ['admin@a.example', 'SYSTEM_ADMIN', A.companyId],
      ['admin2@a.example', 'SYSTEM_ADMIN', A.companyId],
      ['exec@a.example', 'EXECUTIVE', A.companyId],
      ['manager@a.example', 'DEPARTMENT_MANAGER', A.companyId],
      ['staff@a.example', 'DEPARTMENT_STAFF', A.companyId],
      ['viewer@a.example', 'VIEWER', A.companyId],
      ['owner@b.example', 'COMPANY_OWNER', B.companyId],
    ];
    for (const [email, companyRole, companyId] of people) {
      const u = await createUser(h.db, email, { companyRole, companyId });
      await h.db.user.update({
        where: { id: u.id },
        data: { fullName: email.split('@')[0]!.replace(/\d/, '') + ' Person' },
      });
      ids[email] = (await h.db.companyMember.findUniqueOrThrow({ where: { userId: u.id } })).id;
    }
  });

  const as = (email: string) => signIn(h, email);
  const setBranches = (browser: Browser, memberId: string, body: unknown) =>
    browser.put(`${C}/current/members/${memberId}/branches`, body);
  const restrict = (browser: Browser, memberId: string, branchIds: string[]) =>
    setBranches(browser, memberId, { branchScope: 'SELECTED_BRANCHES', branchIds });

  // ------------------------------------------------------- branch access model

  it('keeps every existing membership on all branches (backward compatible)', async () => {
    const rows = await h.db.companyMember.findMany({ where: { companyId: A.companyId } });
    expect(rows.every((m) => m.branchScope === 'ALL_BRANCHES')).toBe(true);
    const staff = await as('staff@a.example');
    const ctx = j(await staff.get(`${C}/context`));
    expect(ctx.scope).toBe('ALL_BRANCHES');
    expect(ctx.branches.map((b: J) => b.code)).toEqual(['00000', '00001', '00002']);
    expect(ctx).toMatchObject({ needsSelection: true, blocked: null, selected: null });
  });

  it('restricts a member to selected branches — enforced by the server, not the UI', async () => {
    const owner = await as('owner@a.example');
    const res = await restrict(owner, ids['staff@a.example']!, [br.HO, br.B]);
    expect(res.statusCode, res.body).toBe(200);
    expect(j(res).member.branchAccess).toMatchObject({
      scope: 'SELECTED_BRANCHES',
      branches: [{ code: '00000' }, { code: '00002' }],
    });

    const staff = await as('staff@a.example');
    const ctx = j(await staff.get(`${C}/context`));
    expect(ctx.branches.map((b: J) => b.code)).toEqual(['00000', '00002']);
    expect(ctx.needsSelection).toBe(true);
    // Branch A is never selectable, even by id.
    const forbidden = await staff.post(`${C}/context/branch`, { branchId: br.A });
    expect(forbidden.statusCode).toBe(403);
    expect(code(forbidden)).toBe('BRANCH_NOT_ALLOWED');
    // Another company's branch is simply not found.
    expect(code(await staff.post(`${C}/context/branch`, { branchId: br.BETA_HO }))).toBe(
      'BRANCH_NOT_FOUND',
    );
    // Allowed branches work, and the operations gate agrees.
    expect((await staff.post(`${C}/context/branch`, { branchId: br.B })).statusCode).toBe(200);
    expect(j(await staff.get('/api/v1/operations/context')).branch).toMatchObject({
      code: '00002',
    });

    // Access to Branch B is removed: the selected context is cleared at once.
    expect((await restrict(owner, ids['staff@a.example']!, [br.HO])).statusCode).toBe(200);
    const session = await h.db.session.findFirstOrThrow({
      where: { user: { emailNormalized: 'staff@a.example' }, revokedAt: null },
    });
    expect(session.branchId).toBeNull();
    expect(code(await staff.get('/api/v1/operations/context'))).toBe('BRANCH_REQUIRED');
    // One allowed branch left → selected automatically.
    const after = j(await staff.get(`${C}/context`));
    expect(after.branches.map((b: J) => b.code)).toEqual(['00000']);
    expect(after.selected.code).toBe('00000');
    expect(after.needsSelection).toBe(false);
  });

  it('never trusts a stale stored branch: the gate clears it', async () => {
    const owner = await as('owner@a.example');
    await restrict(owner, ids['staff@a.example']!, [br.HO]);
    const staff = await as('staff@a.example');
    // Simulate a context left from before (written behind the API's back).
    await h.db.session.updateMany({
      where: { user: { emailNormalized: 'staff@a.example' } },
      data: { branchId: br.A },
    });
    expect(code(await staff.get('/api/v1/operations/context'))).toBe('BRANCH_REQUIRED');
    const sessions = await h.db.session.findMany({
      where: { user: { emailNormalized: 'staff@a.example' }, revokedAt: null },
    });
    expect(sessions.every((s) => s.branchId === null)).toBe(true);
  });

  it('blocks clearly when no allowed branch is active, and tells the admins', async () => {
    const owner = await as('owner@a.example');
    await restrict(owner, ids['staff@a.example']!, [br.A]);
    expect((await owner.post(`${C}/current/branches/${br.A}/deactivate`)).statusCode).toBe(200);
    const staff = await as('staff@a.example');
    const ctx = j(await staff.get(`${C}/context`));
    expect(ctx).toMatchObject({
      branches: [],
      selected: null,
      needsSelection: false,
      blocked: 'NO_BRANCH_ACCESS',
    });
    expect(code(await staff.get('/api/v1/operations/context'))).toBe('BRANCH_REQUIRED');
    const attention = j(await owner.get(`${C}/control`)).attention;
    expect(attention).toEqual(
      expect.arrayContaining([
        { code: 'MEMBERS_WITHOUT_BRANCH', count: 1 },
        { code: 'BRANCHES_INACTIVE', count: 1 },
      ]),
    );
    // Reactivating the branch restores the saved access.
    await owner.post(`${C}/current/branches/${br.A}/reactivate`);
    expect(j(await staff.get(`${C}/context`)).selected.code).toBe('00001');
  });

  it('a deactivated branch drops every session working in it', async () => {
    const staff = await as('staff@a.example');
    await staff.post(`${C}/context/branch`, { branchId: br.B });
    const owner = await as('owner@a.example');
    await owner.post(`${C}/current/branches/${br.B}/deactivate`);
    expect(code(await staff.get('/api/v1/operations/context'))).toBe('BRANCH_REQUIRED');
    expect(j(await staff.get(`${C}/context`)).branches.map((b: J) => b.code)).toEqual([
      '00000',
      '00001',
    ]);
  });

  it('the Company Owner always keeps every branch — API and database', async () => {
    const owner = await as('owner@a.example');
    const admin = await as('admin@a.example');
    expect(code(await restrict(admin, ids['owner@a.example']!, [br.HO]))).toBe('OWNER_PROTECTED');
    expect(code(await restrict(owner, ids['owner@a.example']!, [br.HO]))).toBe('OWNER_PROTECTED');
    await expect(
      h.db.companyMember.update({
        where: { id: ids['owner@a.example'] },
        data: { branchScope: 'SELECTED_BRANCHES' },
      }),
    ).rejects.toThrow();
    // Even a grant row cannot narrow the owner: the owner sees every branch.
    await h.db.memberBranchAccess.create({
      data: { companyId: A.companyId, memberId: ids['owner@a.example']!, branchId: br.HO },
    });
    expect(j(await owner.get(`${C}/context`)).branches).toHaveLength(3);
  });

  it('nobody narrows their own access; a System Admin leaves System Admins to the owner', async () => {
    const admin = await as('admin@a.example');
    expect(code(await restrict(admin, ids['admin@a.example']!, [br.HO]))).toBe('SELF_CHANGE');
    expect(code(await restrict(admin, ids['admin2@a.example']!, [br.HO]))).toBe('PEER_ADMIN');
    // The owner may restrict a System Admin's operational branches…
    const owner = await as('owner@a.example');
    expect((await restrict(owner, ids['admin@a.example']!, [br.HO])).statusCode).toBe(200);
    // …which never limits administration: the admin still manages every branch and person.
    expect((await admin.patch(`${C}/current/branches/${br.B}`, { name: 'B2' })).statusCode).toBe(
      200,
    );
    expect((await restrict(admin, ids['staff@a.example']!, [br.A])).statusCode).toBe(200);
    expect(j(await admin.get(`${C}/current/branches`)).branches).toHaveLength(3);
  });

  it('validates branch access strictly (no foreign, inactive, duplicate or extra values)', async () => {
    const owner = await as('owner@a.example');
    const staff = ids['staff@a.example']!;
    expect(code(await setBranches(owner, staff, { branchScope: 'SELECTED_BRANCHES' }))).toBe(
      'VALIDATION_FAILED',
    );
    expect(
      code(await setBranches(owner, staff, { branchScope: 'ALL_BRANCHES', branchIds: [br.HO] })),
    ).toBe('VALIDATION_FAILED');
    expect(code(await restrict(owner, staff, [br.HO, br.HO]))).toBe('VALIDATION_FAILED');
    expect(code(await restrict(owner, staff, [br.BETA_HO]))).toBe('BRANCH_NOT_AVAILABLE');
    expect(code(await restrict(owner, staff, ['nope']))).toBe('BRANCH_NOT_AVAILABLE');
    await owner.post(`${C}/current/branches/${br.A}/deactivate`);
    expect(code(await restrict(owner, staff, [br.A]))).toBe('BRANCH_NOT_AVAILABLE');
    for (const extra of [{ companyId: B.companyId }, { ownerSlot: true }, { role: 'VIEWER' }]) {
      expect(code(await setBranches(owner, staff, { branchScope: 'ALL_BRANCHES', ...extra }))).toBe(
        'VALIDATION_FAILED',
      );
    }
  });

  it('the database refuses a grant that mixes companies, and duplicates', async () => {
    await expect(
      h.db.memberBranchAccess.create({
        data: { companyId: A.companyId, memberId: ids['staff@a.example']!, branchId: br.BETA_HO },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.memberBranchAccess.create({
        data: { companyId: B.companyId, memberId: ids['staff@a.example']!, branchId: br.BETA_HO },
      }),
    ).rejects.toThrow();
    await h.db.memberBranchAccess.create({
      data: { companyId: A.companyId, memberId: ids['staff@a.example']!, branchId: br.A },
    });
    await expect(
      h.db.memberBranchAccess.create({
        data: { companyId: A.companyId, memberId: ids['staff@a.example']!, branchId: br.A },
      }),
    ).rejects.toThrow();
  });

  it('audits branch access changes with old scope, new scope and the actor', async () => {
    const owner = await as('owner@a.example');
    await restrict(owner, ids['staff@a.example']!, [br.B, br.HO]);
    await setBranches(owner, ids['staff@a.example']!, { branchScope: 'ALL_BRANCHES' });
    const events = await h.db.auditLog.findMany({
      where: { action: 'MEMBER_BRANCH_ACCESS_CHANGED', entityId: ids['staff@a.example'] },
      orderBy: { occurredAt: 'asc' },
      include: { actor: { select: { emailNormalized: true } } },
    });
    expect(events.map((e) => e.changes)).toEqual([
      {
        actorScope: 'customer',
        fromScope: 'ALL_BRANCHES',
        fromBranches: [],
        toScope: 'SELECTED_BRANCHES',
        toBranches: ['00000', '00002'],
      },
      {
        actorScope: 'customer',
        fromScope: 'SELECTED_BRANCHES',
        fromBranches: ['00000', '00002'],
        toScope: 'ALL_BRANCHES',
        toBranches: [],
      },
    ]);
    expect(events.every((e) => e.actor?.emailNormalized === 'owner@a.example')).toBe(true);
    // An unchanged save records nothing.
    await setBranches(owner, ids['staff@a.example']!, { branchScope: 'ALL_BRANCHES' });
    expect(
      await h.db.auditLog.count({
        where: { action: 'MEMBER_BRANCH_ACCESS_CHANGED', entityId: ids['staff@a.example'] },
      }),
    ).toBe(2);
    // The member's detail shows the history.
    const detail = j(await owner.get(`${C}/current/members/${ids['staff@a.example']}`));
    expect(detail.history.map((e: J) => e.type)).toContain('MEMBER_BRANCH_ACCESS_CHANGED');
  });

  // ------------------------------------------------------------------ people

  it('searches and filters people on the server, page by page', async () => {
    const owner = await as('owner@a.example');
    await h.db.companyMember.update({
      where: { id: ids['manager@a.example'] },
      data: { jobTitle: 'Warehouse Lead' },
    });
    await owner.put(`${C}/current/members/${ids['staff@a.example']}/departments`, {
      departments: ['WAREHOUSE'],
    });
    await restrict(owner, ids['staff@a.example']!, [br.B]);
    await owner.post(`${C}/current/members/${ids['viewer@a.example']}/deactivate`);
    const list = async (query: string) => j(await owner.get(`${C}/current/members?${query}`));
    const emails = (r: J) => r.members.map((m: J) => m.email);

    expect((await list('')).total).toBe(7);
    expect(emails(await list('q=STAFF'))).toEqual(['staff@a.example']);
    expect(emails(await list('q=warehouse lead'))).toEqual(['manager@a.example']);
    expect(emails(await list('role=SYSTEM_ADMIN'))).toEqual([
      'admin@a.example',
      'admin2@a.example',
    ]);
    expect(emails(await list('status=DEACTIVATED'))).toEqual(['viewer@a.example']);
    expect(emails(await list('department=WAREHOUSE'))).toEqual(['staff@a.example']);
    // Who works in Branch A: everyone on all branches, not the staff restricted to B.
    expect(emails(await list(`branch=${br.A}`))).not.toContain('staff@a.example');
    expect(emails(await list(`branch=${br.B}`))).toContain('staff@a.example');
    // Cleared filters are ignored; bad ones are refused.
    expect((await list('role=&status=&q=')).total).toBe(7);
    expect(code(await owner.get(`${C}/current/members?role=PLATFORM_OWNER`))).toBe(
      'VALIDATION_FAILED',
    );
    expect(code(await owner.get(`${C}/current/members?pageSize=500`))).toBe('VALIDATION_FAILED');
    // Pages.
    const first = await list('pageSize=3');
    expect(first).toMatchObject({ total: 7, page: 1, pageSize: 3, hasMore: true });
    const last = await list('pageSize=3&page=3');
    expect(last.members).toHaveLength(1);
    expect(last.hasMore).toBe(false);
    expect(first.summary).toEqual({ active: 6, deactivated: 1 });
  });

  it('a member detail tells what the caller may change, and why not', async () => {
    const admin = await as('admin@a.example');
    const owner = j(await admin.get(`${C}/current/members/${ids['owner@a.example']}`));
    expect(owner.protection).toBe('OWNER_PROTECTED');
    expect(owner.member.branchAccess.scope).toBe('ALL_BRANCHES');
    expect(j(await admin.get(`${C}/current/members/${ids['admin@a.example']}`)).protection).toBe(
      'SELF_CHANGE',
    );
    expect(j(await admin.get(`${C}/current/members/${ids['admin2@a.example']}`)).protection).toBe(
      'PEER_ADMIN',
    );
    const staff = j(await admin.get(`${C}/current/members/${ids['staff@a.example']}`));
    expect(staff).toMatchObject({ protection: null, canManage: true });
    expect(staff.member.canManage).toBe(true);
    expect(staff.assignableRoles).not.toContain('SYSTEM_ADMIN');
    expect(staff.branches.map((b: J) => b.code)).toEqual(['00000', '00001', '00002']);
    // Never credentials or sessions.
    expect(JSON.stringify(staff)).not.toMatch(/passwordHash|tokenHash|session/i);
    // Executive reads; department roles do not open people.
    const exec = j(
      await (await as('exec@a.example')).get(`${C}/current/members/${ids['staff@a.example']}`),
    );
    expect(exec).toMatchObject({ canManage: false, protection: null, assignableRoles: [] });
    for (const email of ['manager@a.example', 'staff@a.example', 'viewer@a.example']) {
      const res = await (await as(email)).get(`${C}/current/members/${ids['admin@a.example']}`);
      expect(res.statusCode).toBe(403);
    }
  });

  it('refuses role escalation server-side', async () => {
    const admin = await as('admin@a.example');
    const staff = ids['staff@a.example']!;
    expect(
      code(await admin.patch(`${C}/current/members/${staff}`, { role: 'COMPANY_OWNER' })),
    ).toBe('VALIDATION_FAILED');
    expect(code(await admin.patch(`${C}/current/members/${staff}`, { role: 'SYSTEM_ADMIN' }))).toBe(
      'ROLE_NOT_ASSIGNABLE',
    );
    expect(
      code(
        await admin.patch(`${C}/current/members/${ids['admin@a.example']}`, { role: 'EXECUTIVE' }),
      ),
    ).toBe('SELF_CHANGE');
    for (const body of [
      { platformRole: 'PLATFORM_ADMIN' },
      { ownerSlot: true },
      { companyId: B.companyId },
      { status: 'ACTIVE' },
      { branchScope: 'ALL_BRANCHES' },
    ]) {
      expect(code(await admin.patch(`${C}/current/members/${staff}`, body))).toBe(
        'VALIDATION_FAILED',
      );
    }
    // The owner may make someone a System Admin — audited with from / to / actor.
    const owner = await as('owner@a.example');
    expect(
      (await owner.patch(`${C}/current/members/${staff}`, { role: 'SYSTEM_ADMIN' })).statusCode,
    ).toBe(200);
    const event = await h.db.auditLog.findFirstOrThrow({
      where: { action: 'MEMBER_ROLE_CHANGED', entityId: staff },
      include: { actor: true },
    });
    expect(event.changes).toMatchObject({ from: 'DEPARTMENT_STAFF', to: 'SYSTEM_ADMIN' });
    expect(event.actor?.emailNormalized).toBe('owner@a.example');
    // Nothing reached the platform level.
    expect(await h.db.platformRoleAssignment.count()).toBe(0);
    expect(
      await h.db.companyMember.count({ where: { companyId: A.companyId, role: 'COMPANY_OWNER' } }),
    ).toBe(1);
  });

  it('departments: only enabled ones, kept on deactivation, restored on reactivation', async () => {
    const owner = await as('owner@a.example');
    const staff = ids['staff@a.example']!;
    expect(
      code(
        await owner.put(`${C}/current/members/${staff}/departments`, {
          departments: ['PURCHASING'],
        }),
      ),
    ).toBe('DEPARTMENT_NOT_ENABLED');
    await owner.put(`${C}/current/members/${staff}/departments`, {
      departments: ['WAREHOUSE', 'SALES'],
      primary: 'WAREHOUSE',
    });
    await restrict(owner, staff, [br.B]);
    const browser = await as('staff@a.example');
    expect(j(await browser.get(`${C}/context`)).departments).toEqual(['SALES', 'WAREHOUSE']);

    await owner.post(`${C}/current/members/${staff}/deactivate`);
    expect(code(await browser.get(`${C}/context`))).toBe('MEMBERSHIP_INACTIVE');
    expect(code(await browser.get('/api/v1/operations/context'))).toBe('MEMBERSHIP_INACTIVE');
    // Nothing deleted: the account, its assignments and its branch access stay.
    expect(
      await h.db.membership.count({ where: { user: { emailNormalized: 'staff@a.example' } } }),
    ).toBe(2);
    expect(await h.db.memberBranchAccess.count({ where: { memberId: staff } })).toBe(1);

    await owner.post(`${C}/current/members/${staff}/reactivate`);
    const ctx = j(await browser.get(`${C}/context`));
    expect(ctx.branches.map((b: J) => b.code)).toEqual(['00002']);
    expect(ctx.departments).toEqual(['SALES', 'WAREHOUSE']);
    const statusEvents = await h.db.auditLog.findMany({
      where: { action: 'MEMBER_STATUS_CHANGED', entityId: staff },
    });
    expect(statusEvents).toHaveLength(2);
  });

  // ---------------------------------------------------------------- branches

  it('branches show who works there; the detail answers access for a branch', async () => {
    const owner = await as('owner@a.example');
    await owner.put(`${C}/current/members/${ids['staff@a.example']}/departments`, {
      departments: ['WAREHOUSE'],
    });
    await restrict(owner, ids['staff@a.example']!, [br.B]);
    const list = j(await owner.get(`${C}/current/branches`)).branches;
    const of = (c: string) => list.find((b: J) => b.code === c);
    expect(of('00000').access).toEqual({ people: 6, departments: [] });
    expect(of('00002').access).toEqual({ people: 7, departments: ['WAREHOUSE'] });
    expect(of('00000')).toMatchObject({ type: 'HEAD_OFFICE', createdAt: expect.any(String) });

    const detail = j(await owner.get(`${C}/current/branches/${br.B}/detail`));
    expect(detail.branch.code).toBe('00002');
    expect(detail.access).toMatchObject({ allBranches: 6, selected: 1, people: 7 });
    expect(detail.people.find((p: J) => p.email === 'staff@a.example')).toMatchObject({
      scope: 'SELECTED_BRANCHES',
      departments: [{ code: 'WAREHOUSE' }],
    });
    // Staff may read the branch, not the people in it.
    const staffView = j(
      await (await as('staff@a.example')).get(`${C}/current/branches/${br.B}/detail`),
    );
    expect(staffView.people).toBeNull();
    expect(staffView.canManage).toBe(false);
  });

  it('Head Office stays the only Head Office, active and fixed', async () => {
    const owner = await as('owner@a.example');
    expect(code(await owner.post(`${C}/current/branches/${br.HO}/deactivate`))).toBe(
      'HEAD_OFFICE_PROTECTED',
    );
    for (const body of [
      { type: 'HEAD_OFFICE' },
      { headOfficeSlot: true },
      { code: '00000' },
      { status: 'INACTIVE' },
    ]) {
      expect(code(await owner.patch(`${C}/current/branches/${br.A}`, body))).toBe(
        'VALIDATION_FAILED',
      );
    }
    expect(
      code(
        await owner.post(`${C}/current/branches`, {
          code: '00000',
          name: 'Second HO',
          addressLine1: '1 Road',
          province: 'Bangkok',
          postalCode: '10110',
        }),
      ),
    ).toBe('VALIDATION_FAILED');
    expect(
      await h.db.branch.count({ where: { companyId: A.companyId, type: 'HEAD_OFFICE' } }),
    ).toBe(1);
  });

  // ------------------------------------------------------------- invitations

  it('an invitation carries departments and branches, and applies them on acceptance', async () => {
    const owner = await as('owner@a.example');
    const res = await owner.post(`${C}/invitations`, {
      email: 'new@person.example',
      role: 'DEPARTMENT_STAFF',
      departments: ['WAREHOUSE'],
      branchScope: 'SELECTED_BRANCHES',
      branchIds: [br.B],
    });
    expect(res.statusCode, res.body).toBe(201);
    const mail = h.mailer.last('new@person.example', 'invitation')!;
    expect(mail.text).toMatch(/คลังสินค้า/);
    expect(mail.text).not.toMatch(/Branch B|00002/);

    const list = j(await owner.get(`${C}/current/invitations`));
    expect(list.invitations[0]).toMatchObject({
      email: 'new@person.example',
      state: 'PENDING',
      departments: ['WAREHOUSE'],
      branchAccess: { scope: 'SELECTED_BRANCHES', branches: [{ code: '00002' }] },
      invitedBy: { email: 'owner@a.example' },
      canManage: true,
    });
    expect(JSON.stringify(list)).not.toMatch(/tokenHash|token/);

    await createUser(h.db, 'new@person.example');
    const invitee = await as('new@person.example');
    const token = tokenFrom(h.mailer, 'new@person.example', 'invitation');
    expect((await invitee.post('/api/v1/auth/invitations/accept', { token })).statusCode).toBe(200);
    const ctx = j(await invitee.get(`${C}/context`));
    expect(ctx).toMatchObject({ scope: 'SELECTED_BRANCHES', departments: ['WAREHOUSE'] });
    expect(ctx.selected.code).toBe('00002');
    expect(j(await owner.get(`${C}/current/invitations?state=ACCEPTED`)).invitations).toHaveLength(
      1,
    );
  });

  it('checks invitation intent when sending and again when accepting', async () => {
    const owner = await as('owner@a.example');
    const send = (body: J) =>
      owner.post(`${C}/invitations`, { email: 'x@person.example', role: 'VIEWER', ...body });
    expect(code(await send({ departments: ['PURCHASING'] }))).toBe('DEPARTMENT_NOT_ENABLED');
    expect(code(await send({ branchScope: 'SELECTED_BRANCHES', branchIds: [br.BETA_HO] }))).toBe(
      'BRANCH_NOT_AVAILABLE',
    );
    expect(code(await send({ branchScope: 'SELECTED_BRANCHES' }))).toBe('VALIDATION_FAILED');
    expect(code(await send({ role: 'COMPANY_OWNER' }))).toBe('VALIDATION_FAILED');
    for (const extra of [{ companyId: B.companyId }, { ownerSlot: true }, { status: 'ACCEPTED' }]) {
      expect(code(await send(extra))).toBe('VALIDATION_FAILED');
    }
    // Starter company: Executive is not part of the package, so not assignable.
    const beta = await as('owner@b.example');
    expect(
      code(
        await beta.post(`${C}/invitations`, {
          email: 'y@person.example',
          role: 'VIEWER',
          departments: ['EXECUTIVE'],
        }),
      ),
    ).toBe('DEPARTMENT_NOT_ENABLED');

    // Valid when sent, stale when accepted: only what is still valid is applied.
    expect(
      (
        await send({
          departments: ['WAREHOUSE', 'SALES'],
          branchScope: 'SELECTED_BRANCHES',
          branchIds: [br.A],
        })
      ).statusCode,
    ).toBe(201);
    await owner.put(`${C}/current/departments`, { departments: ['SALES', 'EXECUTIVE'] });
    await owner.post(`${C}/current/branches/${br.A}/deactivate`);
    await createUser(h.db, 'x@person.example');
    const invitee = await as('x@person.example');
    const token = tokenFrom(h.mailer, 'x@person.example', 'invitation');
    expect((await invitee.post('/api/v1/auth/invitations/accept', { token })).statusCode).toBe(200);
    const ctx = j(await invitee.get(`${C}/context`));
    expect(ctx).toMatchObject({ blocked: 'NO_BRANCH_ACCESS', departments: ['SALES'] });
    const accepted = await h.db.auditLog.findFirstOrThrow({
      where: { action: 'INVITATION_ACCEPTED', companyId: A.companyId },
    });
    expect(accepted.changes).toMatchObject({
      departments: ['SALES'],
      droppedDepartments: ['WAREHOUSE'],
      branchScope: 'SELECTED_BRANCHES',
      branches: [],
      droppedBranches: 1,
    });
  });

  it('revoke: the token never works again; System Admin invitations stay with the owner', async () => {
    const owner = await as('owner@a.example');
    const sent = j(
      await owner.post(`${C}/invitations`, { email: 'r@person.example', role: 'SYSTEM_ADMIN' }),
    );
    const token = tokenFrom(h.mailer, 'r@person.example', 'invitation');
    const admin = await as('admin@a.example');
    expect(code(await admin.post(`${C}/invitations/${sent.id}/revoke`))).toBe('PEER_ADMIN');
    expect(code(await admin.post(`${C}/invitations/${sent.id}/resend`))).toBe('PEER_ADMIN');
    expect((await owner.post(`${C}/invitations/${sent.id}/revoke`)).statusCode).toBe(200);
    expect(code(await owner.post(`${C}/invitations/${sent.id}/revoke`))).toBe(
      'INVITATION_NOT_FOUND',
    );
    await createUser(h.db, 'r@person.example');
    const invitee = await as('r@person.example');
    expect((await invitee.post('/api/v1/auth/invitations/accept', { token })).statusCode).toBe(410);
    expect(
      await h.db.companyMember.count({ where: { user: { emailNormalized: 'r@person.example' } } }),
    ).toBe(0);
    expect(
      j(await owner.get(`${C}/current/invitations?state=REVOKED`)).invitations[0],
    ).toMatchObject({
      email: 'r@person.example',
      state: 'REVOKED',
      canManage: false,
    });
  });

  it('resend replaces the invitation with a fresh token; the old one is dead', async () => {
    const owner = await as('owner@a.example');
    const first = j(
      await owner.post(`${C}/invitations`, {
        email: 'again@person.example',
        role: 'DEPARTMENT_STAFF',
        departments: ['SALES'],
      }),
    );
    const oldToken = tokenFrom(h.mailer, 'again@person.example', 'invitation');
    // Too soon after sending.
    expect(code(await owner.post(`${C}/invitations/${first.id}/resend`))).toBe('RESEND_TOO_SOON');
    // Later (and even after expiry), it can be resent.
    await h.db.invitation.update({
      where: { id: first.id },
      data: {
        createdAt: new Date(Date.now() - 8 * 86_400_000),
        expiresAt: new Date(Date.now() - 86_400_000),
      },
    });
    expect(j(await owner.get(`${C}/current/invitations?state=EXPIRED`)).invitations).toHaveLength(
      1,
    );
    const res = await owner.post(`${C}/invitations/${first.id}/resend`);
    expect(res.statusCode, res.body).toBe(201);
    const second = j(res);
    expect(second.id).not.toBe(first.id);
    const newToken = tokenFrom(h.mailer, 'again@person.example', 'invitation');
    expect(newToken).not.toBe(oldToken);
    const rows = await h.db.invitation.findMany({
      where: { emailNormalized: 'again@person.example' },
    });
    expect(rows.find((r) => r.id === first.id)?.status).toBe('REVOKED');
    expect(rows.find((r) => r.id === second.id)).toMatchObject({
      status: 'PENDING',
      resentFromId: first.id,
      departments: ['SALES'],
    });
    const event = await h.db.auditLog.findFirstOrThrow({ where: { action: 'INVITATION_RESENT' } });
    expect(event.changes).toMatchObject({ previousInvitationId: first.id });
    // The old id cannot be resent again; the old token is dead; the new one works once.
    expect(code(await owner.post(`${C}/invitations/${first.id}/resend`))).toBe(
      'INVITATION_NOT_FOUND',
    );
    await createUser(h.db, 'again@person.example');
    const invitee = await as('again@person.example');
    expect(
      (await invitee.post('/api/v1/auth/invitations/accept', { token: oldToken })).statusCode,
    ).toBe(410);
    expect(
      (await invitee.post('/api/v1/auth/invitations/accept', { token: newToken })).statusCode,
    ).toBe(200);
    expect(
      (await invitee.post('/api/v1/auth/invitations/accept', { token: newToken })).statusCode,
    ).toBe(410);
    expect(code(await owner.post(`${C}/invitations/${second.id}/resend`))).toBe(
      'INVITATION_NOT_FOUND',
    );
  });

  it('concurrent acceptance creates exactly one membership', async () => {
    const owner = await as('owner@a.example');
    await owner.post(`${C}/invitations`, {
      email: 'race@person.example',
      role: 'VIEWER',
      branchScope: 'SELECTED_BRANCHES',
      branchIds: [br.HO],
    });
    const token = tokenFrom(h.mailer, 'race@person.example', 'invitation');
    await createUser(h.db, 'race@person.example');
    const one = await as('race@person.example');
    const two = await as('race@person.example');
    const results = await Promise.all([
      one.post('/api/v1/auth/invitations/accept', { token }),
      two.post('/api/v1/auth/invitations/accept', { token }),
      one.post('/api/v1/auth/invitations/accept', { token }),
    ]);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.every((r) => r.statusCode === 200 || r.statusCode >= 400)).toBe(true);
    const members = await h.db.companyMember.findMany({
      where: { user: { emailNormalized: 'race@person.example' } },
    });
    expect(members).toHaveLength(1);
    expect(await h.db.memberBranchAccess.count({ where: { memberId: members[0]!.id } })).toBe(1);
  });

  it('an account in another company cannot join (no silent move)', async () => {
    const owner = await as('owner@a.example');
    await owner.post(`${C}/invitations`, { email: 'owner@b.example', role: 'VIEWER' });
    const token = tokenFrom(h.mailer, 'owner@b.example', 'invitation');
    const beta = await as('owner@b.example');
    expect(code(await beta.post('/api/v1/auth/invitations/accept', { token }))).toBe(
      'ALREADY_IN_COMPANY',
    );
    const member = await h.db.companyMember.findFirstOrThrow({
      where: { user: { emailNormalized: 'owner@b.example' } },
    });
    expect(member.companyId).toBe(B.companyId);
  });

  // -------------------------------------------------------------------- IDOR

  it('another company’s members, branches and invitations are simply not found', async () => {
    const alpha = await as('owner@a.example');
    const invite = j(
      await alpha.post(`${C}/invitations`, { email: 'i@person.example', role: 'VIEWER' }),
    );
    const beta = await as('owner@b.example');
    const staff = ids['staff@a.example']!;
    const checks: [Promise<ApiResponse>, string][] = [
      [beta.get(`${C}/current/members/${staff}`), 'MEMBER_NOT_FOUND'],
      [restrict(beta, staff, [br.BETA_HO]), 'MEMBER_NOT_FOUND'],
      [beta.patch(`${C}/current/members/${staff}`, { role: 'VIEWER' }), 'MEMBER_NOT_FOUND'],
      [
        beta.put(`${C}/current/members/${staff}/departments`, { departments: [] }),
        'MEMBER_NOT_FOUND',
      ],
      [beta.post(`${C}/current/members/${staff}/deactivate`), 'MEMBER_NOT_FOUND'],
      [beta.get(`${C}/current/branches/${br.A}/detail`), 'BRANCH_NOT_FOUND'],
      [beta.patch(`${C}/current/branches/${br.A}`, { name: 'x' }), 'BRANCH_NOT_FOUND'],
      [beta.post(`${C}/invitations/${invite.id}/resend`), 'INVITATION_NOT_FOUND'],
      [beta.post(`${C}/invitations/${invite.id}/revoke`), 'INVITATION_NOT_FOUND'],
    ];
    for (const [request, expected] of checks) expect(code(await request)).toBe(expected);
    // Beta's lists hold nothing of Alpha.
    expect(JSON.stringify(j(await beta.get(`${C}/current/members?branch=${br.A}`)))).not.toMatch(
      /a\.example/,
    );
    expect(j(await beta.get(`${C}/current/invitations?state=ALL`)).invitations).toHaveLength(0);
    // Nothing of Alpha changed.
    expect((await h.db.companyMember.findUniqueOrThrow({ where: { id: staff } })).branchScope).toBe(
      'ALL_BRANCHES',
    );
  });

  // ------------------------------------------------------------ role matrix

  it('administration surfaces follow the role policy', async () => {
    const target = ids['viewer@a.example']!;
    const matrix: [
      string,
      { list: number; detail: number; branches: number; invitations: number },
    ][] = [
      ['owner@a.example', { list: 200, detail: 200, branches: 200, invitations: 200 }],
      ['admin@a.example', { list: 200, detail: 200, branches: 200, invitations: 200 }],
      ['exec@a.example', { list: 200, detail: 200, branches: 403, invitations: 200 }],
      ['manager@a.example', { list: 403, detail: 403, branches: 403, invitations: 403 }],
      ['staff@a.example', { list: 403, detail: 403, branches: 403, invitations: 403 }],
      ['viewer@a.example', { list: 403, detail: 403, branches: 403, invitations: 403 }],
    ];
    for (const [email, expected] of matrix) {
      const b = await as(email);
      expect((await b.get(`${C}/current/members`)).statusCode, email).toBe(expected.list);
      expect((await b.get(`${C}/current/members/${target}`)).statusCode, email).toBe(
        expected.detail,
      );
      expect((await b.get(`${C}/current/invitations`)).statusCode, email).toBe(
        expected.invitations,
      );
      const access = await restrict(b, ids['staff@a.example']!, [br.HO]);
      expect(access.statusCode, email).toBe(email === 'staff@a.example' ? 403 : expected.branches);
      // Everyone in the company may read the branch list.
      expect((await b.get(`${C}/current/branches`)).statusCode, email).toBe(200);
    }
    // Platform operators have no customer membership API.
    await createUser(h.db, 'op@pdabliss.example', { platformRole: 'PLATFORM_ADMIN' });
    const op = await as('op@pdabliss.example');
    for (const url of [
      `${C}/current/members`,
      `${C}/current/invitations`,
      `${C}/current/members/${target}`,
    ]) {
      expect((await op.get(url)).statusCode).toBe(403);
    }
    expect((await restrict(op, target, [br.HO])).statusCode).toBe(403);
  });
});
