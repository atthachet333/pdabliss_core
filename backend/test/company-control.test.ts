import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import {
  Browser,
  createActiveCompany,
  createUser,
  describeDb,
  resetDb,
  signIn,
  tokenFrom,
  type ApiResponse,
  type Harness,
  createHarness,
} from './support.js';

/*
 * EP25 Company Control Center, against the isolated test database: role
 * policy, owner protection, company isolation (IDOR), mass assignment,
 * branches and the Head Office, invitations, department configuration and
 * assignment, subscription visibility, activity, settings, the logo and the
 * server-side branch context.
 */

// Response bodies are read loosely here: this suite asserts on many shapes and
// every assertion is explicit. (Typed contracts live in the frontend client.)
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

const BRANCH = {
  name: 'Chiang Mai',
  addressLine1: '9 Nimman Road',
  district: 'Mueang',
  province: 'Chiang Mai',
  postalCode: '50200',
};

describeDb('Company Control Center (EP25)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
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
    const people: [string, CompanyRole, string][] = [
      ['owner@a.example', 'COMPANY_OWNER', A.companyId],
      ['admin@a.example', 'SYSTEM_ADMIN', A.companyId],
      ['admin2@a.example', 'SYSTEM_ADMIN', A.companyId],
      ['exec@a.example', 'EXECUTIVE', A.companyId],
      ['staff@a.example', 'DEPARTMENT_STAFF', A.companyId],
      ['owner@b.example', 'COMPANY_OWNER', B.companyId],
    ];
    for (const [email, companyRole, companyId] of people) {
      const u = await createUser(h.db, email, { companyRole, companyId });
      ids[email] = (await h.db.companyMember.findUniqueOrThrow({ where: { userId: u.id } })).id;
    }
  });

  const as = (email: string) => signIn(h, email);

  // -------------------------------------------------------------- overview

  it('the overview answers which company, package, departments, counts and what needs attention', async () => {
    const owner = await as('owner@a.example');
    const res = await owner.get('/api/v1/company/control');
    expect(res.statusCode, res.body).toBe(200);
    const o = j(res);
    expect(o.company).toMatchObject({ displayName: 'Alpha', status: 'ACTIVE', logo: null });
    expect(o.me.role).toBe('COMPANY_OWNER');
    // EP27: catalog permission codes (administration by role, departments by the resolver).
    expect(o.me.permissions).toContain('company.members.manage');
    expect(o.me.permissions).toContain('warehouse.stock_adjustment.approve');
    expect(o.plan).toMatchObject({ plan: 'PROFESSIONAL', status: 'ACTIVE' });
    expect(o.plan.monthlyPriceThb).toBeUndefined();
    expect(o.departments.enabled).toEqual(['SALES', 'WAREHOUSE', 'EXECUTIVE']);
    expect(o.counts).toMatchObject({
      branches: { active: 1, total: 1 },
      members: { active: 5, deactivated: 0 },
    });
    expect(o.headOffice.code).toBe('00000');
    // Real gaps only: no tax ID / phone yet, nobody assigned to the departments.
    expect(o.attention).toEqual(
      expect.arrayContaining([
        { code: 'PROFILE_INCOMPLETE', fields: ['taxId', 'phone'] },
        { code: 'DEPARTMENTS_UNASSIGNED', departments: ['SALES', 'WAREHOUSE', 'EXECUTIVE'] },
      ]),
    );
    expect(o.setup.complete).toBe(false);
    expect(o.me.departments).toEqual(['SALES', 'WAREHOUSE', 'EXECUTIVE']);

    // Staff: same company facts, no administration, no attention list.
    const staff = j(await (await as('staff@a.example')).get('/api/v1/company/control'));
    expect(staff.me.permissions).toEqual(['company.profile.view', 'company.branches.view']);
    expect(staff.attention).toEqual([]);
    expect(staff.me.departments).toEqual([]);
  });

  it('is closed to pending companies, deactivated members and platform operators', async () => {
    await h.db.company.update({
      where: { id: A.companyId },
      data: { status: 'PENDING_SUBSCRIPTION' },
    });
    const owner = await as('owner@a.example');
    expect(code(await owner.get('/api/v1/company/control'))).toBe('COMPANY_NOT_ACTIVE');
    expect((await owner.get('/api/v1/auth/me')).json().identity.company).toMatchObject({
      canEnterCore: false,
      memberStatus: 'ACTIVE',
    });

    await createUser(h.db, 'operator@pdabliss.example', { platformRole: 'PLATFORM_ADMIN' });
    const operator = await as('operator@pdabliss.example');
    for (const url of [
      '/api/v1/company/control',
      '/api/v1/company/current/members',
      '/api/v1/company/context',
      '/api/v1/operations/context',
    ]) {
      expect((await operator.get(url)).statusCode, url).toBe(403);
    }
  });

  // --------------------------------------------------------------- profile

  it('Owner and System Admin edit the profile; other roles cannot; server-owned fields are refused', async () => {
    const owner = await as('owner@a.example');
    const res = await owner.patch('/api/v1/company/current/profile', {
      englishName: 'Alpha Trading',
      taxId: '0-1055-36000-01-1',
      phone: '02 123 4567',
      website: 'alpha.example.com',
      contactEmail: 'hello@alpha.example',
      industry: 'DISTRIBUTION',
      headOffice: {
        addressLine1: '77 Sathorn Road',
        district: 'Sathorn',
        province: 'Bangkok',
        postalCode: '10120',
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(j(res).company).toMatchObject({
      englishName: 'Alpha Trading',
      taxId: '0105536000011',
      phone: '+6621234567',
      website: 'https://alpha.example.com/',
      industry: 'DISTRIBUTION',
    });
    expect(j(res).headOffice.address).toMatchObject({
      line1: '77 Sathorn Road',
      postalCode: '10120',
    });
    expect(j(res).changed).toContain('headOfficeAddress');
    const log = await h.db.auditLog.findFirstOrThrow({
      where: { action: 'COMPANY_PROFILE_UPDATED' },
    });
    expect(log.companyId).toBe(A.companyId);

    // Clearing an optional field.
    expect(
      j(await owner.patch('/api/v1/company/current/profile', { englishName: null })).company
        .englishName,
    ).toBeNull();

    const admin = await as('admin@a.example');
    expect(
      (await admin.patch('/api/v1/company/current/profile', { displayName: 'Alpha Co' }))
        .statusCode,
    ).toBe(200);
    for (const email of ['exec@a.example', 'staff@a.example']) {
      const b = await as(email);
      expect(
        (await b.patch('/api/v1/company/current/profile', { displayName: 'X' })).statusCode,
      ).toBe(403);
    }
    // Mass assignment: status, demo flag, plan, another company — refused, not ignored.
    for (const body of [
      { status: 'SUSPENDED' },
      { isDemo: true },
      { plan: 'ENTERPRISE' },
      { companyId: B.companyId, displayName: 'Hijack' },
      { website: 'javascript:alert(1)' },
      { taxId: '1234567890123' },
    ]) {
      expect(
        (await owner.patch('/api/v1/company/current/profile', body)).statusCode,
        JSON.stringify(body),
      ).toBe(400);
    }
    expect((await h.db.company.findUniqueOrThrow({ where: { id: B.companyId } })).name).toBe(
      'Beta',
    );
  });

  it('accepts a raster logo checked by its bytes and serves it safely', async () => {
    const owner = await as('owner@a.example');
    const data = PNG.toString('base64');
    const up = await owner.put('/api/v1/company/current/logo', { contentType: 'image/png', data });
    expect(up.statusCode, up.body).toBe(200);
    const got = await owner.get('/api/v1/company/current/logo');
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toBe('image/png');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    expect(got.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(got.rawPayload.equals(PNG)).toBe(true);
    expect(j(await owner.get('/api/v1/company/control')).company.logo.version).toBe(
      j(up).logo.version,
    );

    // Declared type must match the bytes; SVG and unknown types are refused.
    expect(
      (await owner.put('/api/v1/company/current/logo', { contentType: 'image/jpeg', data }))
        .statusCode,
    ).toBe(415);
    expect(
      (
        await owner.put('/api/v1/company/current/logo', {
          contentType: 'image/svg+xml',
          data: Buffer.from('<svg onload="alert(1)"/>').toString('base64'),
        })
      ).statusCode,
    ).toBe(400);
    const big = Buffer.concat([JPEG_HEAD, Buffer.alloc(300 * 1024)]).toString('base64');
    expect(
      [400, 413].includes(
        (await owner.put('/api/v1/company/current/logo', { contentType: 'image/jpeg', data: big }))
          .statusCode,
      ),
    ).toBe(true);
    const staff = await as('staff@a.example');
    expect(
      (await staff.put('/api/v1/company/current/logo', { contentType: 'image/png', data }))
        .statusCode,
    ).toBe(403);
    // Company B has no logo — B never sees A's.
    expect(
      (await (await as('owner@b.example')).get('/api/v1/company/current/logo')).statusCode,
    ).toBe(404);

    expect((await owner.delete('/api/v1/company/current/logo')).statusCode).toBe(200);
    expect((await owner.get('/api/v1/company/current/logo')).statusCode).toBe(404);
    expect(
      await h.db.auditLog.count({
        where: { action: { in: ['COMPANY_LOGO_UPDATED', 'COMPANY_LOGO_REMOVED'] } },
      }),
    ).toBe(2);
  });

  // -------------------------------------------------------------- branches

  it('creates and edits branches with unique 5-digit codes; the Head Office stays protected', async () => {
    const owner = await as('owner@a.example');
    const list = j(await owner.get('/api/v1/company/current/branches'));
    expect(list).toMatchObject({ suggestedCode: '00001', canManage: true });

    const first = await owner.post('/api/v1/company/current/branches', BRANCH);
    expect(first.statusCode, first.body).toBe(201);
    expect(j(first).branch).toMatchObject({ code: '00001', type: 'BRANCH', status: 'ACTIVE' });
    const explicit = await owner.post('/api/v1/company/current/branches', {
      ...BRANCH,
      code: '00010',
    });
    expect(j(explicit).branch.code).toBe('00010');
    expect(j(await owner.get('/api/v1/company/current/branches')).suggestedCode).toBe('00011');
    // Unique within the company (server-side), but another company may reuse it.
    expect(
      code(await owner.post('/api/v1/company/current/branches', { ...BRANCH, code: '00010' })),
    ).toBe('BRANCH_CODE_TAKEN');
    const beta = await as('owner@b.example');
    expect(
      (await beta.post('/api/v1/company/current/branches', { ...BRANCH, code: '00010' }))
        .statusCode,
    ).toBe(201);
    for (const bad of ['00000', '123', 'ABCDE', '123456']) {
      expect(
        (await owner.post('/api/v1/company/current/branches', { ...BRANCH, code: bad })).statusCode,
        bad,
      ).toBe(400);
    }

    const id = j(first).branch.id as string;
    const edited = await owner.patch(`/api/v1/company/current/branches/${id}`, {
      name: 'Chiang Mai 2',
      phone: '053 123 456',
    });
    expect(j(edited).branch).toMatchObject({ name: 'Chiang Mai 2', phone: '+6653123456' });
    for (const body of [
      { code: '00099' },
      { type: 'HEAD_OFFICE' },
      { status: 'CLOSED' },
      { companyId: B.companyId },
    ]) {
      expect((await owner.patch(`/api/v1/company/current/branches/${id}`, body)).statusCode).toBe(
        400,
      );
    }

    // Head Office: editable details, never deactivated, never deleted.
    expect(
      j(await owner.patch(`/api/v1/company/current/branches/${A.headOfficeId}`, { name: 'HQ' }))
        .branch.name,
    ).toBe('HQ');
    expect(
      code(await owner.post(`/api/v1/company/current/branches/${A.headOfficeId}/deactivate`)),
    ).toBe('HEAD_OFFICE_PROTECTED');
    expect(
      (await owner.delete(`/api/v1/company/current/branches/${A.headOfficeId}`)).statusCode,
    ).toBe(404);
    expect((await owner.delete(`/api/v1/company/current/branches/${id}`)).statusCode).toBe(404);
    await expect(
      h.db.branch.update({ where: { id: A.headOfficeId }, data: { status: 'INACTIVE' } }),
    ).rejects.toThrow();

    // Deactivate / reactivate, audited.
    expect(
      j(await owner.post(`/api/v1/company/current/branches/${id}/deactivate`)).branch.status,
    ).toBe('INACTIVE');
    expect(
      j(await owner.post(`/api/v1/company/current/branches/${id}/reactivate`)).branch.status,
    ).toBe('ACTIVE');
    expect(await h.db.auditLog.count({ where: { action: 'BRANCH_STATUS_CHANGED' } })).toBe(2);
    expect(
      await h.db.auditLog.count({ where: { action: 'BRANCH_CREATED', companyId: A.companyId } }),
    ).toBe(2);

    // IDOR: Company B's branch is "not found" for A, for every verb.
    expect((await owner.get(`/api/v1/company/current/branches/${B.headOfficeId}`)).statusCode).toBe(
      404,
    );
    expect(
      (await owner.patch(`/api/v1/company/current/branches/${B.headOfficeId}`, { name: 'x' }))
        .statusCode,
    ).toBe(404);
    expect(
      (await owner.post(`/api/v1/company/current/branches/${B.headOfficeId}/deactivate`))
        .statusCode,
    ).toBe(404);

    // Administration only.
    for (const email of ['exec@a.example', 'staff@a.example']) {
      const b = await as(email);
      expect((await b.post('/api/v1/company/current/branches', BRANCH)).statusCode).toBe(403);
      expect((await b.post(`/api/v1/company/current/branches/${id}/deactivate`)).statusCode).toBe(
        403,
      );
    }
    expect(
      (await (await as('admin@a.example')).post('/api/v1/company/current/branches', BRANCH))
        .statusCode,
    ).toBe(201);
  });

  // ---------------------------------------------------------------- people

  it('lists people for administrators and executives only, without secrets', async () => {
    const owner = await as('owner@a.example');
    const res = await owner.get('/api/v1/company/current/members');
    expect(res.statusCode).toBe(200);
    const body = j(res);
    expect(body.members).toHaveLength(5);
    expect(body.assignableRoles).toEqual([
      'SYSTEM_ADMIN',
      'EXECUTIVE',
      'DEPARTMENT_MANAGER',
      'DEPARTMENT_STAFF',
      'VIEWER',
    ]);
    const me = body.members.find((m: J) => m.isSelf);
    expect(me).toMatchObject({ role: 'COMPANY_OWNER', isOwner: true, canManage: false });
    expect(res.body).not.toMatch(/passwordHash|tokenHash|credential|ipAddress/);
    expect(res.body).not.toContain('owner@b.example');

    expect(
      j(await (await as('exec@a.example')).get('/api/v1/company/current/members')).canManage,
    ).toBe(false);
    expect(
      (await (await as('staff@a.example')).get('/api/v1/company/current/members')).statusCode,
    ).toBe(403);
    const admin = j(await (await as('admin@a.example')).get('/api/v1/company/current/members'));
    expect(admin.assignableRoles).not.toContain('SYSTEM_ADMIN');
    // A System Admin manages neither the owner nor other System Admins.
    const byEmail = (e: string) => admin.members.find((m: J) => m.email === e);
    expect(byEmail('owner@a.example').canManage).toBe(false);
    expect(byEmail('admin2@a.example').canManage).toBe(false);
    expect(byEmail('staff@a.example').canManage).toBe(true);
  });

  it('protects the Company Owner: no demotion, deactivation, transfer or self-change', async () => {
    const ownerId = ids['owner@a.example']!;
    const admin = await as('admin@a.example');
    expect(
      code(await admin.patch(`/api/v1/company/current/members/${ownerId}`, { role: 'VIEWER' })),
    ).toBe('OWNER_PROTECTED');
    expect(code(await admin.post(`/api/v1/company/current/members/${ownerId}/deactivate`))).toBe(
      'OWNER_PROTECTED',
    );
    expect(
      code(
        await admin.put(`/api/v1/company/current/members/${ownerId}/departments`, {
          departments: [],
        }),
      ),
    ).toBe('OWNER_PROTECTED');
    // Seizing ownership: COMPANY_OWNER is never a value the API accepts.
    expect(
      (
        await admin.patch(`/api/v1/company/current/members/${ids['admin@a.example']}`, {
          role: 'COMPANY_OWNER',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await admin.post('/api/v1/company/invitations', {
          email: 'x@a.example',
          role: 'COMPANY_OWNER',
        })
      ).statusCode,
    ).toBe(400);
    // Peers and self.
    expect(
      code(
        await admin.patch(`/api/v1/company/current/members/${ids['admin2@a.example']}`, {
          role: 'VIEWER',
        }),
      ),
    ).toBe('PEER_ADMIN');
    expect(
      code(
        await admin.post(`/api/v1/company/current/members/${ids['admin2@a.example']}/deactivate`),
      ),
    ).toBe('PEER_ADMIN');
    expect(
      code(
        await admin.patch(`/api/v1/company/current/members/${ids['admin@a.example']}`, {
          role: 'VIEWER',
        }),
      ),
    ).toBe('SELF_CHANGE');
    expect(
      code(
        await admin.patch(`/api/v1/company/current/members/${ids['staff@a.example']}`, {
          role: 'SYSTEM_ADMIN',
        }),
      ),
    ).toBe('ROLE_NOT_ASSIGNABLE');

    const owner = await as('owner@a.example');
    expect(
      code(await owner.patch(`/api/v1/company/current/members/${ownerId}`, { role: 'VIEWER' })),
    ).toBe('OWNER_PROTECTED');
    expect(code(await owner.post(`/api/v1/company/current/members/${ownerId}/deactivate`))).toBe(
      'OWNER_PROTECTED',
    );
    // The owner may manage System Admins.
    expect(
      (
        await owner.patch(`/api/v1/company/current/members/${ids['admin2@a.example']}`, {
          role: 'EXECUTIVE',
        })
      ).statusCode,
    ).toBe(200);

    // The database agrees: one owner, always active.
    await expect(
      h.db.companyMember.update({
        where: { id: ownerId },
        data: { status: 'DEACTIVATED', deactivatedAt: new Date() },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.companyMember.update({
        where: { id: ids['admin@a.example']! },
        data: { role: 'COMPANY_OWNER', ownerSlot: true },
      }),
    ).rejects.toThrow();
    expect(
      await h.db.companyMember.count({ where: { companyId: A.companyId, role: 'COMPANY_OWNER' } }),
    ).toBe(1);
  });

  it('changes roles and job titles, deactivates and reactivates members — audited, within the company', async () => {
    const admin = await as('admin@a.example');
    const staffId = ids['staff@a.example']!;
    const res = await admin.patch(`/api/v1/company/current/members/${staffId}`, {
      role: 'DEPARTMENT_MANAGER',
      jobTitle: 'Warehouse lead',
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(j(res).members.find((m: J) => m.id === staffId)).toMatchObject({
      role: 'DEPARTMENT_MANAGER',
      jobTitle: 'Warehouse lead',
    });
    expect(
      (await admin.patch(`/api/v1/company/current/members/${staffId}`, { status: 'ACTIVE' }))
        .statusCode,
    ).toBe(400);

    const staff = await as('staff@a.example');
    expect((await staff.get('/api/v1/company/control')).statusCode).toBe(200);
    expect(
      (await admin.post(`/api/v1/company/current/members/${staffId}/deactivate`)).statusCode,
    ).toBe(200);
    expect(code(await staff.get('/api/v1/company/control'))).toBe('MEMBERSHIP_INACTIVE');
    expect(code(await staff.get('/api/v1/company/current'))).toBe('MEMBERSHIP_INACTIVE');
    expect((await staff.get('/api/v1/account/onboarding')).json<J>().stage).toBe(
      'MEMBERSHIP_INACTIVE',
    );
    expect((await staff.get('/api/v1/auth/me')).json().identity.company).toMatchObject({
      memberStatus: 'DEACTIVATED',
      canEnterCore: false,
    });
    expect(
      (await admin.post(`/api/v1/company/current/members/${staffId}/reactivate`)).statusCode,
    ).toBe(200);
    expect((await staff.get('/api/v1/company/control')).statusCode).toBe(200);

    expect(
      (await h.db.auditLog.findMany({ where: { companyId: A.companyId, entityId: staffId } }))
        .map((a) => a.action)
        .sort(),
    ).toEqual([
      'MEMBER_JOB_TITLE_CHANGED',
      'MEMBER_ROLE_CHANGED',
      'MEMBER_STATUS_CHANGED',
      'MEMBER_STATUS_CHANGED',
    ]);

    // IDOR: B's owner is not found from A; executives and staff cannot manage.
    expect(
      (
        await admin.patch(`/api/v1/company/current/members/${ids['owner@b.example']}`, {
          jobTitle: 'x',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await (
          await as('exec@a.example')
        ).patch(`/api/v1/company/current/members/${staffId}`, { jobTitle: 'x' })
      ).statusCode,
    ).toBe(403);
  });

  // ----------------------------------------------------------- invitations

  it('invites by email with a single-use, expiring token; an existing account joins without a second user', async () => {
    const owner = await as('owner@a.example');
    await createUser(h.db, 'known@person.example'); // already has an account, no company
    const users = await h.db.user.count();
    const res = await owner.post('/api/v1/company/invitations', {
      email: 'Known@Person.example',
      role: 'DEPARTMENT_STAFF',
      locale: 'en',
    });
    expect(res.statusCode, res.body).toBe(201);
    const mail = h.mailer.last('Known@Person.example', 'invitation')!;
    expect(mail.subject).toBe('Invitation to join Alpha on PDA BLISS CORE');
    expect(mail.text).toContain('Department Staff');
    expect(mail.text).toContain('/account/invitation?lang=en#token=');
    const stored = await h.db.invitation.findFirstOrThrow({ where: { companyId: A.companyId } });
    const token = tokenFrom(h.mailer, 'Known@Person.example', 'invitation');
    expect(stored.tokenHash).not.toContain(token);
    expect(JSON.stringify(await h.db.auditLog.findMany())).not.toContain(token);

    const list = j(await owner.get('/api/v1/company/current/members'));
    expect(list.invitations).toEqual([
      expect.objectContaining({
        email: 'Known@Person.example',
        role: 'DEPARTMENT_STAFF',
        state: 'OPEN',
        locale: 'en',
      }),
    ]);

    const known = await as('known@person.example');
    expect((await known.post('/api/v1/auth/invitations/accept', { token })).statusCode).toBe(200);
    expect(await h.db.user.count()).toBe(users);
    expect((await known.post('/api/v1/auth/invitations/accept', { token })).statusCode).toBe(410);
    expect(await h.db.companyMember.count({ where: { companyId: A.companyId } })).toBe(6);
    expect(
      (
        await h.db.auditLog.findMany({
          where: { companyId: A.companyId, action: { startsWith: 'INVITATION_' } },
        })
      )
        .map((a) => a.action)
        .sort(),
    ).toEqual(['INVITATION_ACCEPTED', 'INVITATION_SENT']);
  });

  it('expired and revoked invitations are refused; only administrators invite, within their roles', async () => {
    const admin = await as('admin@a.example');
    const sent = await admin.post('/api/v1/company/invitations', {
      email: 'late@person.example',
      role: 'VIEWER',
    });
    expect(sent.statusCode).toBe(201);
    const token = tokenFrom(h.mailer, 'late@person.example', 'invitation');
    await h.db.invitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await createUser(h.db, 'late@person.example');
    const late = await as('late@person.example');
    expect(code(await late.post('/api/v1/auth/invitations/accept', { token }))).toBe(
      'TOKEN_EXPIRED',
    );
    expect(j(await admin.get('/api/v1/company/current/members')).invitations[0].state).toBe(
      'EXPIRED',
    );
    expect(
      await h.db.companyMember.count({
        where: { user: { emailNormalized: 'late@person.example' } },
      }),
    ).toBe(0);

    expect(
      code(
        await admin.post('/api/v1/company/invitations', {
          email: 'boss@person.example',
          role: 'SYSTEM_ADMIN',
        }),
      ),
    ).toBe('ROLE_NOT_ASSIGNABLE');
    for (const email of ['exec@a.example', 'staff@a.example']) {
      const b = await as(email);
      expect(
        (await b.post('/api/v1/company/invitations', { email: 'n@person.example', role: 'VIEWER' }))
          .statusCode,
      ).toBe(403);
    }
    // The company id cannot be smuggled in.
    expect(
      (
        await admin.post('/api/v1/company/invitations', {
          email: 'n@person.example',
          role: 'VIEWER',
          companyId: B.companyId,
        })
      ).statusCode,
    ).toBe(400);
    // Revoking another company's invitation: not found.
    const beta = await as('owner@b.example');
    const bInvite = j(
      await beta.post('/api/v1/company/invitations', { email: 'b@person.example', role: 'VIEWER' }),
    );
    expect((await admin.post(`/api/v1/company/invitations/${bInvite.id}/revoke`)).statusCode).toBe(
      404,
    );
    expect((await beta.post(`/api/v1/company/invitations/${bInvite.id}/revoke`)).statusCode).toBe(
      200,
    );
  });

  it('caps invitations per company per day', async () => {
    const inviter = await h.db.user.findFirstOrThrow({
      where: { emailNormalized: 'owner@a.example' },
    });
    await h.db.invitation.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        companyId: A.companyId,
        email: `bulk${i}@person.example`,
        emailNormalized: `bulk${i}@person.example`,
        role: 'VIEWER' as const,
        tokenHash: `hash-${i}`,
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      })),
    });
    const owner = await as('owner@a.example');
    expect(
      code(
        await owner.post('/api/v1/company/invitations', {
          email: 'one.more@person.example',
          role: 'VIEWER',
        }),
      ),
    ).toBe('INVITATION_LIMIT');
  });

  // ----------------------------------------------------------- departments

  it('configures departments within the package — the server decides, disabling is soft and audited', async () => {
    const owner = await as('owner@a.example');
    const res = await owner.put('/api/v1/company/current/departments', {
      departments: ['SALES', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'OPERATIONS', 'EXECUTIVE'],
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(j(res).enabled).toHaveLength(6);
    const off = await owner.put('/api/v1/company/current/departments', {
      departments: ['SALES', 'EXECUTIVE'],
    });
    expect(j(off).enabled).toEqual(['SALES', 'EXECUTIVE']);
    expect(j(off).departments.find((d: J) => d.code === 'WAREHOUSE').state).toBe('AVAILABLE');
    // Soft: the rows stay.
    expect(await h.db.department.count({ where: { companyId: A.companyId } })).toBe(6);
    expect(await h.db.auditLog.count({ where: { action: 'DEPARTMENT_DISABLED' } })).toBe(4);
    expect(code(await owner.put('/api/v1/company/current/departments', { departments: [] }))).toBe(
      'DEPARTMENTS_REQUIRED',
    );

    // Starter: at most 2, never Executive (Company B).
    const beta = await as('owner@b.example');
    expect(
      code(
        await beta.put('/api/v1/company/current/departments', {
          departments: ['SALES', 'EXECUTIVE'],
        }),
      ),
    ).toBe('DEPARTMENT_LIMIT');
    expect(
      code(
        await beta.put('/api/v1/company/current/departments', {
          departments: ['SALES', 'WAREHOUSE', 'PURCHASING'],
        }),
      ),
    ).toBe('DEPARTMENT_LIMIT');
    expect(
      j(
        await beta.put('/api/v1/company/current/departments', {
          departments: ['SALES', 'WAREHOUSE'],
        }),
      ).enabled,
    ).toEqual(['SALES', 'WAREHOUSE']);
    const bDepts = j(await beta.get('/api/v1/company/current/departments')).departments;
    expect(bDepts.find((d: J) => d.code === 'EXECUTIVE').state).toBe('NOT_IN_PACKAGE');

    // Business: at most 4.
    await h.db.subscription.updateMany({
      where: { companyId: B.companyId },
      data: {
        plan: 'BUSINESS',
        entitlements: { plan: 'BUSINESS', maxDepartments: 4, executiveAllowed: true },
      },
    });
    expect(
      code(
        await beta.put('/api/v1/company/current/departments', {
          departments: ['SALES', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
        }),
      ),
    ).toBe('DEPARTMENT_LIMIT');

    for (const email of ['exec@a.example', 'staff@a.example']) {
      const b = await as(email);
      expect(
        (await b.put('/api/v1/company/current/departments', { departments: ['SALES'] })).statusCode,
      ).toBe(403);
    }
  });

  it('assigns one person to several departments — one user, only enabled departments, reflected in CORE access', async () => {
    const admin = await as('admin@a.example');
    const staffId = ids['staff@a.example']!;
    const res = await admin.put(`/api/v1/company/current/members/${staffId}/departments`, {
      departments: ['WAREHOUSE', 'SALES'],
      primary: 'WAREHOUSE',
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(j(res).members.find((m: J) => m.id === staffId).departments).toEqual([
      { code: 'SALES', primary: false, active: true },
      { code: 'WAREHOUSE', primary: true, active: true },
    ]);
    expect(await h.db.user.count({ where: { emailNormalized: 'staff@a.example' } })).toBe(1);
    expect(
      code(
        await admin.put(`/api/v1/company/current/members/${staffId}/departments`, {
          departments: ['ACCOUNTING'],
        }),
      ),
    ).toBe('DEPARTMENT_NOT_ENABLED');
    expect(
      (
        await admin.put(`/api/v1/company/current/members/${staffId}/departments`, {
          departments: ['SALES', 'SALES'],
        })
      ).statusCode,
    ).toBe(400);

    const staff = await as('staff@a.example');
    expect(j(await staff.get('/api/v1/company/context')).departments).toEqual([
      'SALES',
      'WAREHOUSE',
    ]);
    // A disabled department leaves CORE access but keeps the assignment.
    const owner = await as('owner@a.example');
    await owner.put('/api/v1/company/current/departments', {
      departments: ['WAREHOUSE', 'EXECUTIVE'],
    });
    expect(j(await staff.get('/api/v1/company/context')).departments).toEqual(['WAREHOUSE']);
    expect(
      await h.db.membership.count({ where: { user: { emailNormalized: 'staff@a.example' } } }),
    ).toBe(2);
    // EP27: Executives read every enabled department (cross-functional view, READ only);
    // System Admin only what is assigned.
    expect(
      j(await (await as('exec@a.example')).get('/api/v1/company/context')).departments,
    ).toEqual(['WAREHOUSE', 'EXECUTIVE']);
    expect(j(await admin.get('/api/v1/company/context')).departments).toEqual([]);
  });

  // ----------------------------------------------------------- subscription

  it('shows the subscription summary to Owner, System Admin and Executive — never prices to department roles', async () => {
    for (const email of ['owner@a.example', 'admin@a.example', 'exec@a.example']) {
      const res = await (await as(email)).get('/api/v1/company/current/subscription');
      expect(res.statusCode, email).toBe(200);
      expect(j(res)).toMatchObject({
        subscription: { plan: 'PROFESSIONAL', status: 'ACTIVE', monthlyPriceThb: 999 },
        entitlements: { maxDepartments: 6, storage: { gb: 30 } },
        departments: { enabled: ['SALES', 'WAREHOUSE', 'EXECUTIVE'] },
        branches: { active: 1, total: 1 },
      });
      expect(res.body).not.toMatch(/invoice|receipt|card|paidAmount/i);
    }
    const staff = await as('staff@a.example');
    expect((await staff.get('/api/v1/company/current/subscription')).statusCode).toBe(403);
    const current = j(await staff.get('/api/v1/company/current'));
    expect(current.priceVisible).toBe(false);
    expect(current.subscription.monthlyPriceThb).toBeNull();
  });

  // -------------------------------------------------------- activity, settings

  it('shows company activity and members’ security events without IPs; operators appear as PDA BLISS', async () => {
    const owner = await as('owner@a.example');
    await owner.patch('/api/v1/company/current/profile', { phone: '021234567' });
    await h.db.auditLog.create({
      data: {
        action: 'PLATFORM_COMPANY_INSPECTED',
        companyId: A.companyId,
        entityType: 'Company',
        entityId: A.companyId,
        requestId: 'r',
        changes: { actorScope: 'platform_admin', mode: 'read_only' },
      },
    });
    const res = await owner.get('/api/v1/company/current/activity');
    expect(res.statusCode).toBe(200);
    const items = j(res).items as J[];
    expect(
      items.some(
        (i) => i.type === 'COMPANY_PROFILE_UPDATED' && i.actor.email === 'owner@a.example',
      ),
    ).toBe(true);
    expect(items.some((i) => i.type === 'LOGIN_SUCCESS' && i.kind === 'security')).toBe(true);
    expect(items.find((i) => i.type === 'PLATFORM_COMPANY_INSPECTED')?.actor).toEqual({
      kind: 'platform',
    });
    expect(res.body).not.toMatch(/ipAddress|userAgent|10\.0\.|tokenHash|owner@b\.example/);
    expect(
      j(await owner.get('/api/v1/company/current/activity?scope=security')).items.every(
        (i: J) => i.kind === 'security',
      ),
    ).toBe(true);
    expect(
      (await (await as('exec@a.example')).get('/api/v1/company/current/activity')).statusCode,
    ).toBe(403);
  });

  it('keeps real settings only — time zone and default language — and invitations follow the default', async () => {
    const admin = await as('admin@a.example');
    expect(j(await admin.get('/api/v1/company/current/settings'))).toEqual({
      timezone: 'Asia/Bangkok',
      defaultLocale: 'th',
    });
    const res = await admin.patch('/api/v1/company/current/settings', {
      timezone: 'Asia/Singapore',
      defaultLocale: 'zh-CN',
    });
    expect(j(res)).toEqual({ timezone: 'Asia/Singapore', defaultLocale: 'zh-CN' });
    expect(
      (await admin.patch('/api/v1/company/current/settings', { timezone: 'Mars/Olympus' }))
        .statusCode,
    ).toBe(400);
    expect(
      (await admin.patch('/api/v1/company/current/settings', { closeCompany: true })).statusCode,
    ).toBe(400);
    expect(
      (await (await as('exec@a.example')).get('/api/v1/company/current/settings')).statusCode,
    ).toBe(403);
    await admin.post('/api/v1/company/invitations', { email: 'zh@person.example', role: 'VIEWER' });
    expect(h.mailer.last('zh@person.example', 'invitation')!.subject).toContain('邀请您加入');
  });

  // --------------------------------------------------------- branch context

  it('keeps the branch context on the server: auto-select one branch, choose among several, never trust a stale one', async () => {
    const staff = await as('staff@a.example');
    let ctx = j(await staff.get('/api/v1/company/context'));
    expect(ctx).toMatchObject({ needsSelection: false, selected: { code: '00000' } });
    expect(j(await staff.get('/api/v1/operations/context')).branch.code).toBe('00000');

    const owner = await as('owner@a.example');
    const second = j(await owner.post('/api/v1/company/current/branches', BRANCH)).branch;
    // A new session with two active branches must choose.
    const fresh = await as('staff@a.example');
    ctx = j(await fresh.get('/api/v1/company/context'));
    expect(ctx.needsSelection).toBe(true);
    expect(ctx.branches.map((b: J) => b.code)).toEqual(['00000', '00001']);
    expect(code(await fresh.get('/api/v1/operations/context'))).toBe('BRANCH_REQUIRED');
    // Another company's branch is never selectable; nor is an id in the body trusted for anything else.
    expect(
      (await fresh.post('/api/v1/company/context/branch', { branchId: B.headOfficeId })).statusCode,
    ).toBe(404);
    expect(
      (
        await fresh.post('/api/v1/company/context/branch', {
          branchId: second.id,
          companyId: B.companyId,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      j(await fresh.post('/api/v1/company/context/branch', { branchId: second.id })).selected.code,
    ).toBe('00001');
    expect(j(await fresh.get('/api/v1/operations/context'))).toMatchObject({
      companyId: A.companyId,
      branch: { code: '00001' },
    });
    // Deactivating the branch ends the context; selecting it is refused.
    await owner.post(`/api/v1/company/current/branches/${second.id}/deactivate`);
    expect(code(await fresh.get('/api/v1/operations/context'))).toBe('BRANCH_REQUIRED');
    expect(code(await fresh.post('/api/v1/company/context/branch', { branchId: second.id }))).toBe(
      'BRANCH_INACTIVE',
    );
    // One active branch again → automatic.
    expect(j(await fresh.get('/api/v1/company/context')).selected.code).toBe('00000');
  });

  it('platform inspection still sees the company, now with membership status', async () => {
    await createUser(h.db, 'po@pdabliss.example', { platformRole: 'PLATFORM_OWNER' });
    const po = await as('po@pdabliss.example');
    const res = await po.get(`/api/v1/platform/companies/${A.companyId}`);
    expect(res.statusCode).toBe(200);
    expect(j(res).members[0]).toHaveProperty('membershipStatus', 'ACTIVE');
    expect(j(res).company).toHaveProperty('englishName', null);
    // And Browser is a separate client per person — the customer cannot use platform routes.
    expect(
      (await (await as('owner@a.example')).get(`/api/v1/platform/companies/${A.companyId}`))
        .statusCode,
    ).toBe(403);
    expect(new Browser(h.app)).toBeTruthy();
  });
});
