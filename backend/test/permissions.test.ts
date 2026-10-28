import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import {
  ADMIN_PERMISSIONS,
  OVERRIDABLE_PERMISSIONS,
  PERMISSION_ACTIONS,
  PERMISSION_CATALOG,
  type PermissionCode,
} from '../src/permissions/catalog.js';
import {
  effectivePermissions,
  resolvePermissions,
  type PermissionInputs,
} from '../src/permissions/resolver.js';
import {
  createActiveCompany,
  createHarness,
  createUser,
  describeDb,
  resetDb,
  signIn,
  type ApiResponse,
  type Browser,
  type Harness,
} from './support.js';

/*
 * EP27 permission & action matrix: the catalog contract, the pure resolver
 * (role defaults, exceptions, DENY precedence, department / package /
 * assignment eligibility) and, against the test database, the server
 * enforcement — administration API, branch intersection, active-session
 * revocation, audit, IDOR and the owner / System Admin boundaries.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;

const ALL_DEPTS = [
  'SALES',
  'OPERATIONS',
  'WAREHOUSE',
  'PURCHASING',
  'ACCOUNTING',
  'EXECUTIVE',
] as const;

const inputs = (over: Partial<PermissionInputs> = {}): PermissionInputs => ({
  role: 'DEPARTMENT_STAFF',
  active: true,
  enabled: [...ALL_DEPTS],
  assigned: ['WAREHOUSE'],
  executiveAllowed: true,
  overrides: [],
  ...over,
});
const has = (i: PermissionInputs) => new Set<string>(effectivePermissions(i));

// ------------------------------------------------------------------ catalog

describe('Permission catalog (EP27)', () => {
  it('is unique, well-formed, namespaced and free of platform authority', () => {
    const codes = PERMISSION_CATALOG.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const p of PERMISSION_CATALOG) {
      expect(p.code).toMatch(/^[a-z]+\.[a-z_]+\.[a-z_]+$/);
      expect(PERMISSION_ACTIONS).toContain(p.action);
      const prefix = p.code.split('.')[0]!;
      expect(p.namespace).toBe(prefix === 'company' ? 'COMPANY_ADMIN' : prefix.toUpperCase());
      expect(p.scope).toBe(p.namespace === 'COMPANY_ADMIN' ? 'COMPANY' : 'BRANCH');
    }
    expect(codes.some((c) => c.startsWith('platform.'))).toBe(false);
    // Every operational department has a workspace entry.
    for (const d of ALL_DEPTS) expect(codes).toContain(`${d.toLowerCase()}.workspace.view`);
    // One status action, no synonyms.
    expect(PERMISSION_ACTIONS).not.toContain('update');
    expect(PERMISSION_ACTIONS).not.toContain('manage_status');
  });

  it('keeps every financial notion out of Warehouse', () => {
    const warehouse = PERMISSION_CATALOG.filter((p) => p.namespace === 'WAREHOUSE');
    expect(warehouse.length).toBeGreaterThan(0);
    for (const p of warehouse) {
      expect(p.code).not.toMatch(/cost|price|margin|payment|supplier|financ|invoice|terms/);
    }
  });

  it('lists exactly the operational codes in the database CHECK', () => {
    const sql = readFileSync(
      'prisma/migrations/20261030090000_ep27_permission_action_matrix/migration.sql',
      'utf8',
    );
    const listed = [...sql.matchAll(/^\s+'([a-z_.]+)'/gm)].map((m) => m[1]);
    expect(listed).toEqual(OVERRIDABLE_PERMISSIONS);
    expect(ADMIN_PERMISSIONS.every((a) => !listed.includes(a))).toBe(true);
  });

  it('has a label for every resource and action in the TH / EN / ZH screen copy', () => {
    const copy = readFileSync('../frontend/src/features/company-center/permissionCopy.ts', 'utf8');
    const resources = new Set(PERMISSION_CATALOG.map((p) => p.resource));
    for (const r of resources) expect(copy.split(`'${r}':`).length - 1, r).toBe(3);
    for (const a of PERMISSION_ACTIONS) {
      expect(copy.split(new RegExp(`\\n\\s+${a}: `)).length - 1, a).toBe(3);
    }
  });
});

// ------------------------------------------------------------------ resolver

describe('Permission resolver (EP27)', () => {
  it('gives the owner every permission of every enabled department, without assignment', () => {
    const owner = has(inputs({ role: 'COMPANY_OWNER', assigned: [] }));
    for (const p of PERMISSION_CATALOG) expect(owner.has(p.code), p.code).toBe(true);
    const states = resolvePermissions(
      inputs({
        role: 'COMPANY_OWNER',
        overrides: [{ permission: 'sales.orders.view', effect: 'DENY' }],
      }),
    );
    // Owner authority is invariant: exceptions are ignored.
    expect(states.find((s) => s.code === 'sales.orders.view')).toMatchObject({
      effective: true,
      source: 'INVARIANT',
      override: null,
    });
  });

  it('System Admin: all administration; operations only where assigned, never MANAGE', () => {
    const none = has(inputs({ role: 'SYSTEM_ADMIN', assigned: [] }));
    for (const a of ADMIN_PERMISSIONS) expect(none.has(a)).toBe(true);
    expect([...none].some((c) => !c.startsWith('company.'))).toBe(false);
    const wh = has(inputs({ role: 'SYSTEM_ADMIN', assigned: ['WAREHOUSE'] }));
    expect(wh.has('warehouse.stock_adjustment.create')).toBe(true);
    expect(wh.has('warehouse.stock_adjustment.approve')).toBe(false);
  });

  it('Executive: READ across enabled departments, no create / edit / approve, no administration', () => {
    const ex = has(inputs({ role: 'EXECUTIVE', assigned: [] }));
    for (const p of PERMISSION_CATALOG.filter((x) => x.namespace !== 'COMPANY_ADMIN')) {
      expect(ex.has(p.code), p.code).toBe(p.tier === 'READ');
    }
    expect(ex.has('company.members.manage')).toBe(false);
    expect(ex.has('company.permissions.view')).toBe(false);
    expect(ex.has('company.members.view')).toBe(true);
  });

  it('Manager / Staff / Viewer: tiers inside assigned departments only', () => {
    const mgr = has(inputs({ role: 'DEPARTMENT_MANAGER' }));
    const staff = has(inputs({ role: 'DEPARTMENT_STAFF' }));
    const viewer = has(inputs({ role: 'VIEWER' }));
    expect(mgr.has('warehouse.stock_adjustment.approve')).toBe(true);
    expect(staff.has('warehouse.stock_adjustment.create')).toBe(true);
    expect(staff.has('warehouse.receiving.process')).toBe(true);
    expect(staff.has('warehouse.stock_adjustment.approve')).toBe(false);
    expect(viewer.has('warehouse.inventory.view')).toBe(true);
    expect(
      [...viewer].filter((c) => !c.startsWith('company.')).every((c) => c.endsWith('.view')),
    ).toBe(true);
    for (const s of [mgr, staff, viewer]) {
      expect(s.has('purchasing.workspace.view')).toBe(false);
      expect(s.has('company.members.manage')).toBe(false);
    }
  });

  it('ALLOW adds, DENY removes, and DENY wins over the role default', () => {
    const base = inputs({
      overrides: [
        { permission: 'warehouse.stock_adjustment.approve', effect: 'ALLOW' },
        { permission: 'warehouse.inventory.view', effect: 'DENY' },
      ],
    });
    const s = has(base);
    expect(s.has('warehouse.stock_adjustment.approve')).toBe(true);
    expect(s.has('warehouse.inventory.view')).toBe(false);
    const states = resolvePermissions(base);
    expect(states.find((x) => x.code === 'warehouse.inventory.view')).toMatchObject({
      roleDefault: true,
      override: 'DENY',
      source: 'DENY_OVERRIDE',
    });
  });

  it('an ALLOW never reaches a department the member is not in, a disabled one, or one outside the package', () => {
    const allow = (permission: PermissionCode) => [{ permission, effect: 'ALLOW' as const }];
    const notAssigned = resolvePermissions(
      inputs({ overrides: allow('purchasing.requests.create') }),
    );
    expect(notAssigned.find((s) => s.code === 'purchasing.requests.create')).toMatchObject({
      effective: false,
      blocked: 'NOT_ASSIGNED',
    });
    const disabled = resolvePermissions(
      inputs({ enabled: ['SALES'], overrides: allow('warehouse.inventory.view') }),
    );
    expect(disabled.find((s) => s.code === 'warehouse.inventory.view')).toMatchObject({
      effective: false,
      override: 'ALLOW',
      blocked: 'DEPARTMENT_DISABLED',
    });
    const starter = resolvePermissions(
      inputs({
        role: 'EXECUTIVE',
        assigned: ['EXECUTIVE'],
        executiveAllowed: false,
        overrides: allow('executive.workspace.view'),
      }),
    );
    expect(starter.find((s) => s.code === 'executive.workspace.view')).toMatchObject({
      effective: false,
      blocked: 'NOT_IN_PACKAGE',
    });
  });

  it('an inactive membership holds nothing; unknown stored codes are ignored', () => {
    expect(effectivePermissions(inputs({ role: 'COMPANY_OWNER', active: false }))).toEqual([]);
    const s = has(
      inputs({ overrides: [{ permission: 'warehouse.give_me_everything', effect: 'ALLOW' }] }),
    );
    expect(s.has('warehouse.give_me_everything')).toBe(false);
  });
});

// ------------------------------------------------------------ server (database)

const C = '/api/v1/company';
const OPS = '/api/v1/operations';

describeDb('Permission enforcement (EP27)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const br: Record<'HO' | 'A' | 'B', string> = { HO: '', A: '', B: '' };
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
      departments: ['SALES', 'WAREHOUSE', 'PURCHASING', 'EXECUTIVE'],
    });
    B = await createActiveCompany(h.db, { name: 'Beta', plan: 'STARTER', departments: ['SALES'] });
    br.HO = A.headOfficeId;
    for (const [key, c] of [
      ['A', '00001'],
      ['B', '00002'],
    ] as const) {
      br[key] = (
        await h.db.branch.create({
          data: {
            companyId: A.companyId,
            code: c,
            name: `Branch ${key}`,
            type: 'BRANCH',
            addressLine1: 'x',
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
      ['staff@b.example', 'DEPARTMENT_STAFF', B.companyId],
    ];
    for (const [email, role, companyId] of people) {
      const u = await createUser(h.db, email, { companyRole: role, companyId });
      ids[email] = (await h.db.companyMember.findUniqueOrThrow({ where: { userId: u.id } })).id;
    }
    const wh = await h.db.department.findFirstOrThrow({
      where: { companyId: A.companyId, code: 'WAREHOUSE' },
    });
    for (const email of ['manager@a.example', 'staff@a.example', 'viewer@a.example']) {
      const userId = (await h.db.companyMember.findUniqueOrThrow({ where: { id: ids[email] } }))
        .userId;
      await h.db.membership.create({ data: { userId, departmentId: wh.id, isPrimary: true } });
    }
    // Staff: Branch A only. Manager: A + B.
    const grant = (email: string, branches: string[]) =>
      h.db.companyMember.update({
        where: { id: ids[email] },
        data: {
          branchScope: 'SELECTED_BRANCHES',
          branchAccess: { create: branches.map((branchId) => ({ branchId })) },
        },
      });
    await grant('staff@a.example', [br.A]);
    await grant('manager@a.example', [br.A, br.B]);
  });

  const as = (email: string) => signIn(h, email);
  const overrides = (b: Browser, email: string, changes: unknown) =>
    b.put(`${C}/current/members/${ids[email]}/permissions`, { changes });
  const authorize = (b: Browser, permission: string) =>
    b.get(`${OPS}/authorize?permission=${encodeURIComponent(permission)}`);

  it('Staff in Branch A: workspace + day-to-day actions, no approval, no Branch B, no Purchasing', async () => {
    const staff = await as('staff@a.example');
    const ctx = j(await staff.get(`${C}/context`));
    expect(ctx.selected.code).toBe('00001'); // the only allowed branch
    expect(ctx.departments).toEqual(['WAREHOUSE']);
    expect(ctx.permissions).toContain('warehouse.workspace.view');
    expect(ctx.permissions).not.toContain('warehouse.stock_adjustment.approve');
    expect((await authorize(staff, 'warehouse.inventory.view')).statusCode).toBe(200);
    expect((await authorize(staff, 'warehouse.stock_adjustment.create')).statusCode).toBe(200);
    const approve = await authorize(staff, 'warehouse.stock_adjustment.approve');
    expect(approve.statusCode).toBe(403);
    expect(j(approve).error).toMatchObject({
      code: 'PERMISSION_DENIED',
      details: { permission: 'warehouse.stock_adjustment.approve' },
    });
    expect(code(await authorize(staff, 'purchasing.workspace.view'))).toBe('PERMISSION_DENIED');
    expect((await staff.get(`${OPS}/workspaces/warehouse`)).statusCode).toBe(200);
    expect(code(await staff.get(`${OPS}/workspaces/purchasing`))).toBe('PERMISSION_DENIED');
    // A permission never grants a branch.
    expect(code(await staff.post(`${C}/context/branch`, { branchId: br.B }))).toBe(
      'BRANCH_NOT_ALLOWED',
    );
    expect(code(await authorize(staff, 'warehouse.give_me_everything'))).toBe('PERMISSION_UNKNOWN');
    expect(code(await authorize(staff, 'company.members.manage'))).toBe('PERMISSION_UNKNOWN');
  });

  it('a permission check needs a selected branch first', async () => {
    const manager = await as('manager@a.example');
    expect(code(await authorize(manager, 'warehouse.inventory.view'))).toBe('BRANCH_REQUIRED');
    await manager.post(`${C}/context/branch`, { branchId: br.B });
    expect((await authorize(manager, 'warehouse.stock_adjustment.approve')).statusCode).toBe(200);
  });

  it('Manager: a DENY removes the permission on the next request; removing it restores the default', async () => {
    const manager = await as('manager@a.example');
    await manager.post(`${C}/context/branch`, { branchId: br.A });
    const admin = await as('admin@a.example');
    expect((await authorize(manager, 'warehouse.stock_adjustment.approve')).statusCode).toBe(200);

    const denied = await overrides(admin, 'manager@a.example', [
      { permission: 'warehouse.stock_adjustment.approve', effect: 'DENY' },
    ]);
    expect(denied.statusCode, denied.body).toBe(200);
    const state = j(denied).permissions.find(
      (p: J) => p.code === 'warehouse.stock_adjustment.approve',
    );
    expect(state).toMatchObject({ effective: false, source: 'DENY_OVERRIDE', roleDefault: true });
    // Same session, no sign-out.
    expect(code(await authorize(manager, 'warehouse.stock_adjustment.approve'))).toBe(
      'PERMISSION_DENIED',
    );
    expect(j(await manager.get(`${C}/context`)).permissions).not.toContain(
      'warehouse.stock_adjustment.approve',
    );

    await overrides(admin, 'manager@a.example', [
      { permission: 'warehouse.stock_adjustment.approve', effect: null },
    ]);
    expect((await authorize(manager, 'warehouse.stock_adjustment.approve')).statusCode).toBe(200);

    // Denying the workspace removes the department from CORE.
    await overrides(admin, 'manager@a.example', [
      { permission: 'warehouse.workspace.view', effect: 'DENY' },
    ]);
    expect(j(await manager.get(`${C}/context`)).departments).toEqual([]);
    expect(code(await manager.get(`${OPS}/workspaces/warehouse`))).toBe('PERMISSION_DENIED');
  });

  it('Viewer: views the workspace; every action is refused, even through an ALLOW of a non-view action it is not assigned for', async () => {
    const viewer = await as('viewer@a.example');
    await viewer.post(`${C}/context/branch`, { branchId: br.HO });
    expect((await viewer.get(`${OPS}/workspaces/warehouse`)).statusCode).toBe(200);
    for (const p of [
      'warehouse.stock_adjustment.create',
      'warehouse.receiving.process',
      'warehouse.stock_adjustment.approve',
    ]) {
      expect(code(await authorize(viewer, p)), p).toBe('PERMISSION_DENIED');
    }
    const ws = j(await viewer.get(`${OPS}/workspaces/warehouse`));
    expect(ws.permissions.every((p: string) => p.endsWith('.view'))).toBe(true);
  });

  it('refuses unknown, administration and platform codes; nothing is stored; all-or-nothing', async () => {
    const owner = await as('owner@a.example');
    for (const [permission, expected] of [
      ['warehouse.give_me_everything', 'PERMISSION_UNKNOWN'],
      ['platform.companies.manage', 'PERMISSION_UNKNOWN'],
      ['company.members.manage', 'PERMISSION_NOT_OVERRIDABLE'],
      ['company.permissions.manage', 'PERMISSION_NOT_OVERRIDABLE'],
    ] as const) {
      const res = await overrides(owner, 'staff@a.example', [{ permission, effect: 'ALLOW' }]);
      expect(res.statusCode).toBe(422);
      expect(code(res)).toBe(expected);
    }
    // One bad change sinks the whole request.
    const mixed = await overrides(owner, 'staff@a.example', [
      { permission: 'warehouse.inventory.view', effect: 'DENY' },
      { permission: 'warehouse.nope.view', effect: 'DENY' },
    ]);
    expect(mixed.statusCode).toBe(422);
    expect(await h.db.memberPermissionOverride.count()).toBe(0);
    // Malformed bodies.
    expect(
      (
        await overrides(owner, 'staff@a.example', [
          { permission: 'sales.orders.view', effect: 'MAYBE' },
        ])
      ).statusCode,
    ).toBe(400);
    expect((await overrides(owner, 'staff@a.example', [])).statusCode).toBe(400);
    // The database refuses an unknown code even when the API is bypassed.
    await expect(
      h.db.memberPermissionOverride.create({
        data: {
          companyId: A.companyId,
          memberId: ids['staff@a.example']!,
          permission: 'warehouse.give_me_everything',
          effect: 'ALLOW',
        },
      }),
    ).rejects.toThrow();
  });

  it('an ALLOW must fit the member: unassigned, disabled or out-of-package departments are refused and stay ineffective', async () => {
    const owner = await as('owner@a.example');
    const notAssigned = await overrides(owner, 'staff@a.example', [
      { permission: 'purchasing.requests.create', effect: 'ALLOW' },
    ]);
    expect(code(notAssigned)).toBe('PERMISSION_NOT_ELIGIBLE');
    expect(j(notAssigned).error.details).toMatchObject({ reason: 'NOT_ASSIGNED' });

    // A malformed row written past the API still gives nothing.
    await h.db.memberPermissionOverride.create({
      data: {
        companyId: A.companyId,
        memberId: ids['staff@a.example']!,
        permission: 'purchasing.requests.create',
        effect: 'ALLOW',
      },
    });
    const staff = await as('staff@a.example');
    expect(j(await staff.get(`${C}/context`)).permissions).not.toContain(
      'purchasing.requests.create',
    );
    expect(code(await authorize(staff, 'purchasing.requests.create'))).toBe('PERMISSION_DENIED');

    // Disabling a department keeps the exception but makes it inactive; enabling brings it back.
    const ok = await overrides(owner, 'staff@a.example', [
      { permission: 'warehouse.stock_adjustment.approve', effect: 'ALLOW' },
    ]);
    expect(ok.statusCode).toBe(200);
    expect((await authorize(staff, 'warehouse.stock_adjustment.approve')).statusCode).toBe(200);
    await owner.put(`${C}/current/departments`, { departments: ['SALES', 'PURCHASING'] });
    const view = j(await owner.get(`${C}/current/members/${ids['staff@a.example']}/permissions`));
    expect(
      view.permissions.find((p: J) => p.code === 'warehouse.stock_adjustment.approve'),
    ).toMatchObject({
      override: 'ALLOW',
      effective: false,
      blocked: 'DEPARTMENT_DISABLED',
    });
    expect(code(await authorize(staff, 'warehouse.stock_adjustment.approve'))).toBe(
      'PERMISSION_DENIED',
    );
    expect(
      await h.db.memberPermissionOverride.count({ where: { memberId: ids['staff@a.example'] } }),
    ).toBe(2);
    await owner.put(`${C}/current/departments`, {
      departments: ['SALES', 'WAREHOUSE', 'PURCHASING', 'EXECUTIVE'],
    });
    expect((await authorize(staff, 'warehouse.stock_adjustment.approve')).statusCode).toBe(200);
  });

  it('a manual exception cannot bypass the package (Starter has no Executive)', async () => {
    // Force an Executive department row and an exception into the Starter company.
    const dept = await h.db.department.create({
      data: { companyId: B.companyId, code: 'EXECUTIVE', name: 'EXECUTIVE' },
    });
    const staffB = await h.db.companyMember.findUniqueOrThrow({
      where: { id: ids['staff@b.example'] },
    });
    await h.db.membership.create({ data: { userId: staffB.userId, departmentId: dept.id } });
    await h.db.memberPermissionOverride.create({
      data: {
        companyId: B.companyId,
        memberId: staffB.id,
        permission: 'executive.workspace.view',
        effect: 'ALLOW',
      },
    });
    const staff = await as('staff@b.example');
    const ctx = j(await staff.get(`${C}/context`));
    expect(ctx.permissions).not.toContain('executive.workspace.view');
    expect(code(await staff.get(`${OPS}/workspaces/executive`))).toBe('PERMISSION_DENIED');
    const ownerB = await as('owner@b.example');
    const res = await ownerB.put(`${C}/current/members/${staffB.id}/permissions`, {
      changes: [{ permission: 'executive.overview.view', effect: 'ALLOW' }],
    });
    expect(code(res)).toBe('PERMISSION_NOT_ELIGIBLE');
    expect(j(res).error.details).toMatchObject({ reason: 'NOT_IN_PACKAGE' });
  });

  it('protects the owner, refuses self-change and peers, and keeps administration role-bound', async () => {
    const admin = await as('admin@a.example');
    expect(
      code(
        await overrides(admin, 'owner@a.example', [
          { permission: 'sales.orders.view', effect: 'DENY' },
        ]),
      ),
    ).toBe('OWNER_PROTECTED');
    expect(
      code(
        await overrides(admin, 'admin@a.example', [
          { permission: 'sales.orders.view', effect: 'ALLOW' },
        ]),
      ),
    ).toBe('SELF_CHANGE');
    expect(
      code(
        await overrides(admin, 'admin2@a.example', [
          { permission: 'sales.orders.view', effect: 'DENY' },
        ]),
      ),
    ).toBe('PEER_ADMIN');
    expect(
      code(
        await overrides(admin, 'staff@a.example', [
          { permission: 'company.settings.manage', effect: 'ALLOW' },
        ]),
      ),
    ).toBe('PERMISSION_NOT_OVERRIDABLE');
    // Viewing the owner explains the protection.
    const ownerView = j(
      await admin.get(`${C}/current/members/${ids['owner@a.example']}/permissions`),
    );
    expect(ownerView).toMatchObject({ protection: 'OWNER_PROTECTED', canManage: false });
    expect(
      ownerView.permissions.every(
        (p: J) => (p.effective && p.source === 'INVARIANT') || !p.code.startsWith('company.'),
      ),
    ).toBe(true);
    // Non-administrators cannot read or write exceptions.
    for (const email of [
      'exec@a.example',
      'manager@a.example',
      'staff@a.example',
      'viewer@a.example',
    ]) {
      const b = await as(email);
      expect((await b.get(`${C}/current/permissions`)).statusCode).toBe(403);
      expect(
        (await b.get(`${C}/current/members/${ids['staff@a.example']}/permissions`)).statusCode,
      ).toBe(403);
      expect(
        (
          await overrides(b, 'viewer@a.example', [
            { permission: 'sales.orders.view', effect: 'ALLOW' },
          ])
        ).statusCode,
      ).toBe(403);
    }
  });

  it('never crosses companies (no existence leak) and never answers a platform operator', async () => {
    const ownerB = await as('owner@b.example');
    const res = await ownerB.put(`${C}/current/members/${ids['staff@a.example']}/permissions`, {
      changes: [{ permission: 'sales.orders.view', effect: 'DENY' }],
    });
    expect(res.statusCode).toBe(404);
    expect(
      (await ownerB.get(`${C}/current/members/${ids['staff@a.example']}/permissions`)).statusCode,
    ).toBe(404);
    expect((await ownerB.get(`${C}/current/members/does-not-exist/permissions`)).statusCode).toBe(
      404,
    );
    await createUser(h.db, 'operator@platform.example', { platformRole: 'PLATFORM_OWNER' });
    const op = await as('operator@platform.example');
    expect((await op.get(`${C}/current/permissions`)).statusCode).toBe(403);
    expect((await op.get(`${OPS}/authorize?permission=sales.orders.view`)).statusCode).toBe(403);
  });

  it('a deactivated member loses everything at once', async () => {
    const staff = await as('staff@a.example');
    await staff.get(`${C}/context`); // selects the only allowed branch
    expect((await authorize(staff, 'warehouse.inventory.view')).statusCode).toBe(200);
    const owner = await as('owner@a.example');
    await owner.post(`${C}/current/members/${ids['staff@a.example']}/deactivate`);
    const res = await authorize(staff, 'warehouse.inventory.view');
    expect([401, 403]).toContain(res.statusCode);
  });

  it('records added / changed / removed exceptions with member, code and effects only', async () => {
    const owner = await as('owner@a.example');
    const p = 'warehouse.stock_adjustment.approve';
    await overrides(owner, 'staff@a.example', [{ permission: p, effect: 'ALLOW' }]);
    await overrides(owner, 'staff@a.example', [{ permission: p, effect: 'ALLOW' }]); // no-op
    await overrides(owner, 'staff@a.example', [{ permission: p, effect: 'DENY' }]);
    await overrides(owner, 'staff@a.example', [{ permission: p, effect: null }]);
    const rows = await h.db.auditLog.findMany({
      where: {
        companyId: A.companyId,
        action: {
          in: [
            'MEMBER_PERMISSION_OVERRIDE_ADDED',
            'MEMBER_PERMISSION_OVERRIDE_CHANGED',
            'MEMBER_PERMISSION_OVERRIDE_REMOVED',
          ],
        },
      },
      orderBy: { occurredAt: 'asc' },
    });
    expect(rows.map((r) => [r.action, (r.changes as J).from, (r.changes as J).to])).toEqual([
      ['MEMBER_PERMISSION_OVERRIDE_ADDED', null, 'ALLOW'],
      ['MEMBER_PERMISSION_OVERRIDE_CHANGED', 'ALLOW', 'DENY'],
      ['MEMBER_PERMISSION_OVERRIDE_REMOVED', 'DENY', null],
    ]);
    for (const r of rows) {
      expect(r.entityId).toBe(ids['staff@a.example']);
      expect(Object.keys(r.changes as J).sort()).toEqual([
        'actorScope',
        'from',
        'member',
        'permission',
        'to',
      ]);
    }
    // History survives the removal; the activity feed shows it.
    const activity = j(await owner.get(`${C}/current/activity?scope=admin&limit=20`));
    expect(
      activity.items.filter((i: J) => i.type.startsWith('MEMBER_PERMISSION_OVERRIDE')),
    ).toHaveLength(3);
  });

  it('profiles: the catalog and code-defined role defaults, read only', async () => {
    const admin = await as('admin@a.example');
    const res = await admin.get(`${C}/current/permissions`);
    expect(res.statusCode).toBe(200);
    const body = j(res);
    expect(body.catalog).toHaveLength(PERMISSION_CATALOG.length);
    expect(body.roles.map((r: J) => r.role)).toEqual([
      'COMPANY_OWNER',
      'SYSTEM_ADMIN',
      'EXECUTIVE',
      'DEPARTMENT_MANAGER',
      'DEPARTMENT_STAFF',
      'VIEWER',
    ]);
    expect(body.canManage).toBe(true);
    // There is no endpoint that edits role defaults.
    expect((await admin.put(`${C}/current/permissions`, { roles: [] })).statusCode).toBe(404);
  });
});
