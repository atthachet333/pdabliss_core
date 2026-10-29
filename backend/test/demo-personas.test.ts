import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bootstrapPlatform, parseSeedEnv, seedDemo } from '../src/auth/bootstrap.js';
import { DEMO_BYPASS_EMAILS } from '../src/auth/demo-bypass.js';
import { DEMO_PERSONA_EMAILS, DEMO_PERSONAS, DEMO_PERSONA_MARKER } from '../src/demo/personas.js';
import { isPermissionCode, ROLE_ADMIN_PERMISSIONS } from '../src/permissions/catalog.js';
import {
  Browser,
  createHarness,
  createUser,
  describeDb,
  resetDb,
  type ApiResponse,
  type Harness,
} from './support.js';

/*
 * EP28.1 demo personas: one canonical definition (src/demo/personas.ts), the
 * seed applies it once and never undoes an administrator's later change, the
 * development bypass allowlists exactly these accounts (never production),
 * and each persona's reach comes from the EP27 resolver — Warehouse privacy,
 * Sales / Purchasing / Accounting boundaries, Executive read-only, Owner and
 * System Admin invariants. All passwords are test fixtures.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;

const C = '/api/v1/company';
const MD = '/api/v1/master-data';
const FINANCIAL = /cost|price|margin|payment|financ|terms|credit|balance|bank|revenue/i;

const PASSWORDS = Object.fromEntries(
  DEMO_PERSONAS.map((p) => [p.passwordEnv, `${p.key.toLowerCase()} fixture passphrase 7`]),
);
const ENV = {
  NODE_ENV: 'development',
  PLATFORM_OWNER_EMAIL: 'the.owner@pdabliss.test',
  PLATFORM_OWNER_INITIAL_PASSWORD: 'owner fixture passphrase 1',
  ...PASSWORDS,
};
const passwordOf = (email: string) =>
  PASSWORDS[DEMO_PERSONAS.find((p) => p.email === email)!.passwordEnv]!;

// ------------------------------------------------------------------ static

describe('Demo persona definitions (EP28.1)', () => {
  it('is one canonical list: unique addresses, the bypass allowlist, real departments and codes', () => {
    expect(new Set(DEMO_PERSONA_EMAILS).size).toBe(DEMO_PERSONAS.length);
    expect(DEMO_BYPASS_EMAILS).toEqual(DEMO_PERSONA_EMAILS);
    expect(DEMO_PERSONA_EMAILS).toEqual([
      'owner.demo@pdabliss.com',
      'admin.demo@pdabliss.com',
      'executive.demo@pdabliss.com',
      'sales.demo@pdabliss.com',
      'operations.demo@pdabliss.com',
      'warehouse.demo@pdabliss.com',
      'purchasing.demo@pdabliss.com',
      'accounting.demo@pdabliss.com',
      'staff.demo@pdabliss.com',
    ]);
    for (const p of DEMO_PERSONAS) {
      // A department persona has only the department it needs — never all of them.
      expect(p.departments.length, p.key).toBeLessThanOrEqual(1);
      expect(p.passwordEnv, p.key).toMatch(/^DEMO_[A-Z_]+_PASSWORD$/);
      if (p.branches !== 'ALL') for (const b of p.branches) expect(b).toMatch(/^\d{5}$/);
      if (p.exception) {
        expect(isPermissionCode(p.exception.permission)).toBe(true);
        expect(p.exception.permission.startsWith('company.')).toBe(false);
      }
    }
    // Exactly one exception example; at least one non-admin persona has several branches.
    expect(DEMO_PERSONAS.filter((p) => p.exception)).toHaveLength(1);
    expect(
      DEMO_PERSONAS.some(
        (p) => p.branches !== 'ALL' && p.branches.length > 1 && p.role.startsWith('DEPARTMENT'),
      ),
    ).toBe(true);
    // Only the owner and the System Admin administer the company.
    for (const p of DEMO_PERSONAS) {
      const admin = ROLE_ADMIN_PERMISSIONS[p.role].includes('company.members.manage');
      expect(admin, p.key).toBe(p.key === 'OWNER' || p.key === 'SYSTEM_ADMIN');
    }
  });
});

// ------------------------------------------------------------------ seeded

describeDb('Demo personas (EP28.1)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'true' });
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    const env = parseSeedEnv(ENV);
    await bootstrapPlatform(h.db, env);
    await seedDemo(h.db, env);
  });

  const login = async (email: string) => {
    const b = new Browser(h.app);
    const res = await b.post('/api/v1/auth/login', { email, password: passwordOf(email) });
    expect(res.statusCode, res.body).toBe(200);
    expect(j(res).status, email).toBe('authenticated');
    // As the screens do: the branch context (one allowed branch is selected automatically, EP26).
    await b.get(`${C}/context`);
    return b;
  };
  const member = (email: string) =>
    h.db.companyMember.findFirstOrThrow({
      where: { user: { emailNormalized: email } },
      include: {
        user: { include: { memberships: { include: { department: true } } } },
        branchAccess: { include: { branch: true } },
        permissionOverrides: true,
      },
    });

  it('seeds every persona once: active, verified, role, departments, branch scope, job title', async () => {
    for (const p of DEMO_PERSONAS) {
      const m = await member(p.email);
      expect(m.status, p.key).toBe('ACTIVE');
      expect(m.user.status).toBe('ACTIVE');
      expect(m.user.emailVerifiedAt).not.toBeNull();
      expect(m.role, p.key).toBe(p.role);
      expect(m.jobTitle).toBe(p.jobTitle);
      expect(m.user.fullName).toBe(p.fullName);
      expect(
        m.user.memberships.map((x) => x.department.code),
        p.key,
      ).toEqual([...p.departments]);
      expect(m.branchScope, p.key).toBe(
        p.branches === 'ALL' ? 'ALL_BRANCHES' : 'SELECTED_BRANCHES',
      );
      expect(m.branchAccess.map((a) => a.branch.code).sort(), p.key).toEqual(
        p.branches === 'ALL' ? [] : [...p.branches],
      );
      expect(m.permissionOverrides.map((o) => [o.permission, o.effect])).toEqual(
        p.exception ? [[p.exception.permission, p.exception.effect]] : [],
      );
    }
    expect(await h.db.company.count()).toBe(1);
    expect(await h.db.auditLog.count({ where: { action: DEMO_PERSONA_MARKER } })).toBe(9);
  });

  it('seeding again duplicates nothing', async () => {
    const counts = async () =>
      Promise.all([
        h.db.user.count(),
        h.db.companyMember.count(),
        h.db.membership.count(),
        h.db.memberBranchAccess.count(),
        h.db.memberPermissionOverride.count(),
        h.db.item.count(),
        h.db.customer.count(),
        h.db.warehouseLocation.count(),
        h.db.purchaseRequest.count(),
        h.db.purchaseRequestLine.count(),
        h.db.auditLog.count(),
        h.db.masterCodeSequence
          .findMany({ orderBy: { prefix: 'asc' } })
          .then((rows) => rows.map((r) => [r.prefix, r.lastValue])),
      ]);
    const before = await counts();
    const env = parseSeedEnv(ENV);
    const report = await seedDemo(h.db, env);
    await seedDemo(h.db, env);
    expect(await counts()).toEqual(before);
    expect(Object.values(report.personas).every((o) => o === 'unchanged')).toBe(true);
  });

  it('never undoes an administrator’s later changes', async () => {
    const owner = await login('owner.demo@pdabliss.com');
    const wh = await member('warehouse.demo@pdabliss.com');
    const sales = await member('sales.demo@pdabliss.com');
    const staff = await member('staff.demo@pdabliss.com');
    expect(
      (await owner.put(`${C}/current/members/${wh.id}/branches`, { branchScope: 'ALL_BRANCHES' }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await owner.put(`${C}/current/members/${sales.id}/departments`, {
          departments: ['SALES', 'ACCOUNTING'],
          primary: 'SALES',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await owner.put(`${C}/current/members/${staff.id}/permissions`, {
          changes: [{ permission: 'warehouse.receiving.process', effect: null }],
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await owner.patch(`${C}/current/members/${sales.id}`, { jobTitle: 'Key Account Lead' }))
        .statusCode,
    ).toBe(200);

    await seedDemo(h.db, parseSeedEnv(ENV));

    const wh2 = await member('warehouse.demo@pdabliss.com');
    expect(wh2.branchScope).toBe('ALL_BRANCHES');
    const sales2 = await member('sales.demo@pdabliss.com');
    expect(sales2.user.memberships.map((x) => x.department.code).sort()).toEqual([
      'ACCOUNTING',
      'SALES',
    ]);
    expect(sales2.jobTitle).toBe('Key Account Lead');
    expect((await member('staff.demo@pdabliss.com')).permissionOverrides).toEqual([]);
  });

  it('completes an account from an earlier seed only where nothing was decided', async () => {
    // A pre-EP28.1 staff account: Warehouse, branch decided by an administrator, no job title, no marker.
    const staff = await member('staff.demo@pdabliss.com');
    await h.db.auditLog.deleteMany({ where: { action: DEMO_PERSONA_MARKER, entityId: staff.id } });
    await h.db.memberPermissionOverride.deleteMany({ where: { memberId: staff.id } });
    await h.db.companyMember.update({
      where: { id: staff.id },
      data: { jobTitle: null, branchScope: 'ALL_BRANCHES' },
    });
    await h.db.memberBranchAccess.deleteMany({ where: { memberId: staff.id } });
    await h.db.auditLog.create({
      data: {
        companyId: staff.companyId,
        action: 'MEMBER_BRANCH_ACCESS_CHANGED',
        entityType: 'CompanyMember',
        entityId: staff.id,
        requestId: 'test',
        changes: { actorScope: 'customer', toScope: 'ALL_BRANCHES' },
      },
    });
    const report = await seedDemo(h.db, parseSeedEnv(ENV));
    expect(report.personas.STAFF).toBe('completed');
    const after = await member('staff.demo@pdabliss.com');
    expect(after.jobTitle).toBe('Warehouse Assistant (legacy demo)');
    expect(after.branchScope).toBe('ALL_BRANCHES'); // the administrator's decision stands
    expect(after.user.memberships.map((x) => x.department.code)).toEqual(['WAREHOUSE']);
    expect(after.permissionOverrides).toHaveLength(1);
    expect(
      await h.db.auditLog.count({ where: { action: DEMO_PERSONA_MARKER, entityId: staff.id } }),
    ).toBe(1);
  });

  it('skips a department persona whose password is not set; the EP23 four stay required', async () => {
    await resetDb(h.db);
    const env = parseSeedEnv({ ...ENV, DEMO_SALES_PASSWORD: '' });
    await bootstrapPlatform(h.db, env);
    const report = await seedDemo(h.db, env);
    expect(report.personas.SALES).toMatch(/skipped \(DEMO_SALES_PASSWORD not set\)/);
    expect(await h.db.user.count({ where: { emailNormalized: 'sales.demo@pdabliss.com' } })).toBe(
      0,
    );
    await expect(seedDemo(h.db, parseSeedEnv({ ...ENV, DEMO_STAFF_PASSWORD: '' }))).rejects.toThrow(
      /DEMO_STAFF_PASSWORD is not set/,
    );
  });

  it('bypass: exactly the personas, password first, active membership only', async () => {
    for (const p of DEMO_PERSONAS) await login(p.email);
    expect(await h.db.authAuditEvent.count({ where: { type: 'DEMO_AUTH_BYPASS' } })).toBe(9);
    // Wrong password: no session.
    const wrong = await new Browser(h.app).post('/api/v1/auth/login', {
      email: 'warehouse.demo@pdabliss.com',
      password: 'not the fixture passphrase',
    });
    expect(wrong.statusCode).toBe(401);
    // A look-alike demo address inside the demo company still needs the code.
    const company = await h.db.company.findFirstOrThrow({ where: { isDemo: true } });
    await createUser(h.db, 'finance.demo@pdabliss.com', {
      companyRole: 'DEPARTMENT_STAFF',
      companyId: company.id,
      password: 'look alike fixture passphrase',
    });
    const lookAlike = await new Browser(h.app).post('/api/v1/auth/login', {
      email: 'finance.demo@pdabliss.com',
      password: 'look alike fixture passphrase',
    });
    expect(j(lookAlike).status).toBe('otp_required');
    // A deactivated persona membership loses the bypass.
    await h.db.companyMember.update({
      where: { id: (await member('sales.demo@pdabliss.com')).id },
      data: { status: 'DEACTIVATED', deactivatedAt: new Date() },
    });
    const inactive = await new Browser(h.app).post('/api/v1/auth/login', {
      email: 'sales.demo@pdabliss.com',
      password: passwordOf('sales.demo@pdabliss.com'),
    });
    expect(j(inactive).status).toBe('otp_required');
  });

  it('lists personas for the development sign-in page — addresses and labels only', async () => {
    const res = await new Browser(h.app).get('/api/v1/demo/personas');
    expect(res.statusCode).toBe(200);
    expect(j(res).personas.map((p: J) => p.email)).toEqual(DEMO_PERSONA_EMAILS);
    expect(res.body).not.toMatch(/password|passphrase/i);
  });

  it('each persona reaches exactly its departments and branches', async () => {
    const expected: Record<
      string,
      { departments: string[]; branches: string[]; selected: string | null }
    > = {
      'owner.demo@pdabliss.com': {
        departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
        branches: ['00000', '00001'],
        selected: null,
      },
      'admin.demo@pdabliss.com': { departments: [], branches: ['00000', '00001'], selected: null },
      'executive.demo@pdabliss.com': {
        departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
        branches: ['00000', '00001'],
        selected: null,
      },
      'sales.demo@pdabliss.com': { departments: ['SALES'], branches: ['00000'], selected: '00000' },
      'operations.demo@pdabliss.com': {
        departments: ['OPERATIONS'],
        branches: ['00000', '00001'],
        selected: null,
      },
      'warehouse.demo@pdabliss.com': {
        departments: ['WAREHOUSE'],
        branches: ['00001'],
        selected: '00001',
      },
      'purchasing.demo@pdabliss.com': {
        departments: ['PURCHASING'],
        branches: ['00000', '00001'],
        selected: null,
      },
      'accounting.demo@pdabliss.com': {
        departments: ['ACCOUNTING'],
        branches: ['00000'],
        selected: '00000',
      },
      'staff.demo@pdabliss.com': {
        departments: ['WAREHOUSE'],
        branches: ['00001'],
        selected: '00001',
      },
    };
    for (const [email, e] of Object.entries(expected)) {
      const b = await login(email);
      const ctx = j(await b.get(`${C}/context`));
      expect(ctx.departments, email).toEqual(e.departments);
      expect(
        ctx.branches.map((x: J) => x.code),
        email,
      ).toEqual(e.branches);
      expect(ctx.selected?.code ?? null, email).toBe(e.selected);
      expect(ctx.needsSelection, email).toBe(e.selected === null);
      // Company administration only for the owner and the System Admin.
      const control = j(await b.get(`${C}/control`));
      const admin = control.me.permissions.includes('company.members.manage');
      expect(admin, email).toBe(email.startsWith('owner.') || email.startsWith('admin.'));
      const people = (await b.get(`${C}/current/members`)).statusCode;
      expect(people, email).toBe(
        email.startsWith('owner.') || email.startsWith('admin.') || email.startsWith('executive.')
          ? 200
          : 403,
      );
    }
  });

  it('Warehouse: safe item identity and its branch’s locations — no customers, suppliers or money', async () => {
    const owner = await login('owner.demo@pdabliss.com');
    const hoMain = j(await owner.get(`${MD}/locations?q=MAIN`)).items.find(
      (l: J) => l.branch.code === '00000',
    );
    const wh = await login('warehouse.demo@pdabliss.com');
    const items = await wh.get(`${MD}/items`);
    expect(j(items).total).toBe(3);
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) {
          expect(k).not.toMatch(FINANCIAL);
          walk(x);
        }
    };
    for (const url of [`${MD}/items`, `${MD}/locations`, `${MD}/units`, `${MD}/context`]) {
      const res = await wh.get(url);
      expect(res.statusCode, url).toBe(200);
      walk(res.json());
      expect(res.body).not.toContain('SUP-000001');
      expect(res.body).not.toContain('CUS-000001');
    }
    expect(
      j(await wh.get(`${MD}/locations`)).items.every((l: J) => l.branch.code === '00001'),
    ).toBe(true);
    expect(code(await wh.get(`${MD}/locations/${hoMain.id}`))).toBe('BRANCH_NOT_ALLOWED');
    expect(code(await wh.get(`${MD}/customers`))).toBe('PERMISSION_DENIED');
    expect(code(await wh.get(`${MD}/suppliers`))).toBe('PERMISSION_DENIED');
    expect(code(await wh.post(`${MD}/items/${j(items).items[0].id}/deactivate`))).toBe(
      'PERMISSION_DENIED',
    );
    expect(code(await wh.get('/api/v1/operations/workspaces/accounting'))).toBe(
      'PERMISSION_DENIED',
    );
    expect((await wh.get(`${C}/current/permissions`)).statusCode).toBe(403);
  });

  it('Sales, Operations, Purchasing and Accounting stay inside their domain', async () => {
    const sales = await login('sales.demo@pdabliss.com');
    expect(j(await sales.get(`${MD}/customers`)).total).toBe(1);
    expect(j(await sales.get(`${MD}/items`)).total).toBe(3);
    expect(code(await sales.get(`${MD}/suppliers`))).toBe('PERMISSION_DENIED');
    expect(code(await sales.post(`${MD}/customers`, { name: 'x' }))).toBe('PERMISSION_DENIED');
    expect(code(await sales.get(`${MD}/locations`))).toBe('PERMISSION_DENIED');
    expect(code(await sales.post(`${MD}/suppliers`, { name: 'x' }))).toBe('PERMISSION_DENIED');
    expect((await sales.get('/api/v1/operations/workspaces/sales')).statusCode).toBe(200);
    expect(code(await sales.get('/api/v1/operations/workspaces/purchasing'))).toBe(
      'PERMISSION_DENIED',
    );

    const ops = await login('operations.demo@pdabliss.com');
    const pcs = j(await ops.get(`${MD}/units?q=PCS`)).items[0];
    expect(
      (await ops.post(`${MD}/items`, { type: 'CONSUMABLE', name: 'Gloves', baseUnitId: pcs.id }))
        .statusCode,
    ).toBe(201);
    expect(code(await ops.get(`${MD}/customers`))).toBe('PERMISSION_DENIED');
    expect(code(await ops.post(`${MD}/suppliers`, { name: 'x' }))).toBe('PERMISSION_DENIED');

    const buyer = await login('purchasing.demo@pdabliss.com');
    expect(
      j(await buyer.post(`${MD}/suppliers`, { name: 'Packaging Supplier' })).supplier.code,
    ).toBe('SUP-000002');
    expect(j(await buyer.get(`${MD}/items`)).total).toBe(4);
    expect(
      code(await buyer.post(`${MD}/items`, { type: 'CONSUMABLE', name: 'x', baseUnitId: pcs.id })),
    ).toBe('PERMISSION_DENIED');
    expect(code(await buyer.get(`${MD}/customers`))).toBe('PERMISSION_DENIED');
    expect((await buyer.get(`${C}/current/members`)).statusCode).toBe(403);
    const target = await member('sales.demo@pdabliss.com');
    expect(
      (
        await buyer.put(`${C}/current/members/${target.id}/permissions`, {
          changes: [{ permission: 'sales.orders.view', effect: 'DENY' }],
        })
      ).statusCode,
    ).toBe(403);

    const acct = await login('accounting.demo@pdabliss.com');
    expect(j(await acct.get(`${MD}/customers`)).total).toBe(1);
    expect(j(await acct.get(`${MD}/suppliers`)).total).toBe(2);
    expect(code(await acct.post(`${MD}/customers`, { name: 'x' }))).toBe('PERMISSION_DENIED');
    expect(code(await acct.get(`${MD}/items`))).toBe('PERMISSION_DENIED');
    expect(code(await acct.get(`${MD}/locations`))).toBe('PERMISSION_DENIED');
    expect(code(await acct.get('/api/v1/operations/workspaces/warehouse'))).toBe(
      'PERMISSION_DENIED',
    );
  });

  it('Executive reads everything enabled and changes nothing; Owner / System Admin invariants hold', async () => {
    const exec = await login('executive.demo@pdabliss.com');
    for (const r of ['customers', 'suppliers', 'items', 'units', 'categories', 'locations']) {
      expect((await exec.get(`${MD}/${r}`)).statusCode, r).toBe(200);
    }
    const item = j(await exec.get(`${MD}/items`)).items[0];
    for (const res of [
      await exec.post(`${MD}/customers`, { name: 'x' }),
      await exec.patch(`${MD}/items/${item.id}`, { name: 'x' }),
      await exec.post(`${MD}/items/${item.id}/deactivate`),
      await exec.patch(`${C}/current/profile`, { displayName: 'x' }),
    ]) {
      expect(res.statusCode).toBe(403);
    }
    const ctx = j(await exec.get(`${C}/context`));
    expect(ctx.permissions.some((p: string) => !p.endsWith('.view'))).toBe(false);

    const admin = await login('admin.demo@pdabliss.com');
    const owner = await member('owner.demo@pdabliss.com');
    expect(code(await admin.patch(`${C}/current/members/${owner.id}`, { jobTitle: 'x' }))).toBe(
      'OWNER_PROTECTED',
    );
    expect((await admin.post(`${MD}/suppliers`, { name: 'By admin' })).statusCode).toBe(201);
    expect((await admin.get('/api/v1/platform/companies')).statusCode).toBe(403);
    // Administration is not operations: no workspace without an assignment.
    expect(j(await admin.get(`${C}/context`)).departments).toEqual([]);
    const ownerAfter = await member('owner.demo@pdabliss.com');
    expect([
      ownerAfter.role,
      ownerAfter.ownerSlot,
      ownerAfter.status,
      ownerAfter.branchScope,
    ]).toEqual(['COMPANY_OWNER', true, 'ACTIVE', 'ALL_BRANCHES']);
    // The platform accounts are untouched by the personas.
    expect(await h.db.platformRoleAssignment.count()).toBe(1);
  });

  it('seeds four demo purchase requests once, visible by persona (EP29)', async () => {
    const rows = await h.db.purchaseRequest.findMany({ orderBy: { number: 'asc' } });
    expect(rows.map((r) => [r.department, r.status])).toEqual([
      ['WAREHOUSE', 'DRAFT'],
      ['SALES', 'SUBMITTED'],
      ['OPERATIONS', 'APPROVED'],
      ['PURCHASING', 'REJECTED'],
    ]);
    const PR = '/api/v1/purchase-requests';
    const buyer = await login('purchasing.demo@pdabliss.com');
    const queue = j(await buyer.get(`${PR}?view=queue`)).items;
    expect(queue.map((r: J) => r.department)).toEqual(['SALES']);
    expect(j(await buyer.get(PR)).total).toBe(3); // others' drafts stay private
    const wh = await login('warehouse.demo@pdabliss.com');
    expect(j(await wh.get(PR)).items.map((r: J) => r.status)).toEqual(['DRAFT']);
    const sales = await login('sales.demo@pdabliss.com');
    expect(j(await sales.get(PR)).items.map((r: J) => r.department)).toEqual(['SALES']);
    const exec = await login('executive.demo@pdabliss.com');
    expect(j(await exec.get(PR)).total).toBe(3);
    // Decided once: the buyer approves the Sales request; a later seed leaves it approved.
    expect(j(await buyer.post(`${PR}/${queue[0].id}/approve`)).request.status).toBe('APPROVED');
    await seedDemo(h.db, parseSeedEnv(ENV));
    expect(await h.db.purchaseRequest.count()).toBe(4);
    expect(
      (await h.db.purchaseRequest.findUniqueOrThrow({ where: { id: queue[0].id } })).status,
    ).toBe('APPROVED');
  });

  it('the legacy staff account carries the one exception: receiving is denied', async () => {
    const staff = await login('staff.demo@pdabliss.com');
    const res = await staff.get(
      '/api/v1/operations/authorize?permission=warehouse.receiving.process',
    );
    expect(code(res)).toBe('PERMISSION_DENIED');
    expect(
      (await staff.get('/api/v1/operations/authorize?permission=warehouse.inventory.view'))
        .statusCode,
    ).toBe(200);
  });
});
