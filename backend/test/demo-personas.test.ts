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

  it('seeds the demo purchase requests once, visible by persona (EP29, EP30)', async () => {
    const rows = await h.db.purchaseRequest.findMany({ orderBy: { number: 'asc' } });
    expect(rows.map((r) => [r.department, r.status])).toEqual([
      ['WAREHOUSE', 'DRAFT'],
      ['SALES', 'SUBMITTED'],
      ['OPERATIONS', 'APPROVED'],
      ['PURCHASING', 'APPROVED'],
      ['WAREHOUSE', 'APPROVED'],
      ['PURCHASING', 'REJECTED'],
    ]);
    const PR = '/api/v1/purchase-requests';
    const buyer = await login('purchasing.demo@pdabliss.com');
    const queue = j(await buyer.get(`${PR}?view=queue`)).items;
    expect(queue.map((r: J) => r.department)).toEqual(['SALES']);
    expect(j(await buyer.get(PR)).total).toBe(5); // others' drafts stay private
    const wh = await login('warehouse.demo@pdabliss.com');
    expect(
      j(await wh.get(PR))
        .items.map((r: J) => r.status)
        .sort(),
    ).toEqual(['APPROVED', 'DRAFT']);
    const sales = await login('sales.demo@pdabliss.com');
    expect(j(await sales.get(PR)).items.map((r: J) => r.department)).toEqual(['SALES']);
    const exec = await login('executive.demo@pdabliss.com');
    expect(j(await exec.get(PR)).total).toBe(5);
    // Decided once: the buyer approves the Sales request; a later seed leaves it approved.
    expect(j(await buyer.post(`${PR}/${queue[0].id}/approve`)).request.status).toBe('APPROVED');
    await seedDemo(h.db, parseSeedEnv(ENV));
    expect(await h.db.purchaseRequest.count()).toBe(6);
    expect(
      (await h.db.purchaseRequest.findUniqueOrThrow({ where: { id: queue[0].id } })).status,
    ).toBe('APPROVED');
  });

  it('seeds five demo purchase orders once — each persona sees its own part (EP30, EP31)', async () => {
    const rows = await h.db.purchaseOrder.findMany({
      orderBy: { number: 'asc' },
      include: { branch: true },
    });
    expect(rows.map((o) => [o.status, o.branch.code, o.depositStatus])).toEqual([
      ['DRAFT', '00000', 'NOT_REQUIRED'],
      ['WAITING_DEPOSIT', '00000', 'PENDING'],
      ['PENDING_RECEIVE', '00001', 'NOT_REQUIRED'],
      ['CANCELLED', '00001', 'NOT_REQUIRED'],
      ['RECEIVED', '00001', 'NOT_REQUIRED'],
    ]);
    const PO = '/api/v1/purchase-orders';
    const buyer = await login('purchasing.demo@pdabliss.com');
    expect(j(await buyer.get(PO)).total).toBe(5);
    // The operations request is partly ordered: 8 of 12.5 kg (the cancelled 4.5 released).
    const ops = rows[2]!;
    const line = await h.db.purchaseOrderLine.findFirstOrThrow({
      where: { purchaseOrderId: ops.id },
    });
    const pr = j(await buyer.get(`/api/v1/purchase-requests/${line.purchaseRequestId}`)).request;
    expect(pr.orderState).toBe('PARTIALLY_ORDERED');
    expect(pr.lines[0].ordering).toMatchObject({ ordered: '8', remaining: '4.5' });
    const acct = await login('accounting.demo@pdabliss.com');
    const deposits = j(await acct.get('/api/v1/accounting/deposits')).items;
    expect(deposits.map((d: J) => d.number)).toEqual([rows[1]!.number]);
    expect(deposits[0].deposit).toMatchObject({ type: 'PERCENT', status: 'PENDING' });
    const wh = await login('warehouse.demo@pdabliss.com');
    const pending = await wh.get('/api/v1/warehouse/pending-receive');
    expect(j(pending).items.map((o: J) => o.number)).toEqual([ops.number]);
    expect(pending.body).not.toMatch(/price|amount|grandTotal|subtotal|deposit|42\.5/i);
    await seedDemo(h.db, parseSeedEnv(ENV));
    expect(await h.db.purchaseOrder.count()).toBe(5);
  });

  it('seeds three posted goods receipts: a partial one, a fully received order, FEFO lots (EP31)', async () => {
    const receipts = await h.db.goodsReceipt.findMany({ orderBy: { number: 'asc' } });
    expect(receipts.map((r) => r.status)).toEqual(['POSTED', 'POSTED', 'POSTED']);
    const wh = await login('warehouse.demo@pdabliss.com');
    const W = '/api/v1/warehouse';
    // The raw-material order is partly received: 5 of 8 kg; the other order is RECEIVED.
    const pending = j(await wh.get(`${W}/pending-receive`)).items;
    expect(pending).toHaveLength(1);
    expect(pending[0].receiving.state).toBe('PARTIALLY_RECEIVED');
    const fg = await h.db.item.findFirstOrThrow({ where: { code: 'FG-000001' } });
    const fefo = j(await wh.get(`${W}/stock/fefo?itemId=${fg.id}`)).candidates;
    // EP32 moved 4 of lot B from RECEIVING to MAIN; EP34 demo orders then reserved all
    // of B and A and 2 of C — the FEFO list offers only what is still available.
    // EP38: the demo finished goods receipts added two produced lots (2 pieces each).
    expect(fefo.map((c: J) => [c.lot.lotNumber, c.quantityOnHand, c.quantityAvailable])).toEqual([
      ['FG-DEMO-C', '12', '10'],
      ['FG-DEMO-OUT-A', '2', '2'],
      ['FG-DEMO-OUT-B', '2', '2'],
    ]);
    const stock = await wh.get(`${W}/stock`);
    // EP37: + the labelled raw-material lot RM-DEMO-02 the production demo adds through an adjustment;
    // EP38: + the two produced finished-goods lots received by the demo receipts.
    expect(j(stock).total).toBe(10);
    expect(stock.body).not.toMatch(/price|amount|cost|deposit|\b120\b|12\.5/i);
    // Ledger = balances.
    const balances = await h.db.stockBalance.findMany();
    for (const b of balances) {
      const sum = await h.db.stockMovement.aggregate({
        where: { locationId: b.locationId, itemId: b.itemId, lotId: b.lotId },
        _sum: { quantityDelta: true },
      });
      expect(sum._sum.quantityDelta!.toString()).toBe(b.quantityOnHand.toString());
    }
    await seedDemo(h.db, parseSeedEnv(ENV));
    expect(await h.db.goodsReceipt.count()).toBe(3);
    expect(await h.db.stockMovement.count({ where: { sourceType: 'GOODS_RECEIPT' } })).toBe(5);
  });

  it('seeds inventory control: transfers, adjustments and a posted count — staff drafts, the owner posts (EP32)', async () => {
    const W = '/api/v1/warehouse';
    const wh = await login('warehouse.demo@pdabliss.com');
    const transfers = j(await wh.get(`${W}/transfers`)).items;
    expect(transfers.map((t: J) => t.status).sort()).toEqual(['DRAFT', 'POSTED']);
    const adjustments = j(await wh.get(`${W}/adjustments`)).items;
    expect(adjustments.map((a: J) => [a.reason, a.status]).sort()).toEqual([
      ['DAMAGE', 'POSTED'],
      ['FOUND', 'POSTED'],
      ['OTHER', 'POSTED'], // EP37: demo raw material for production execution (the owner)
      ['OTHER', 'POSTED'], // EP38: materials of the demo completed order (the owner)
    ]);
    expect(
      adjustments
        .filter((a: J) => a.reason !== 'OTHER')
        .every((a: J) => a.approvedBy.name !== a.createdBy.name),
    ).toBe(true);
    const counts = j(await wh.get(`${W}/counts`)).items;
    expect(counts).toHaveLength(1);
    expect(counts[0]).toMatchObject({ status: 'POSTED', lineCount: 2, varianceLines: 1 });
    // The demo warehouse persona stays staff: it cannot post or approve.
    const draft = transfers.find((t: J) => t.status === 'DRAFT');
    expect(j(await wh.get(`${W}/transfers/${draft.id}`)).transfer.actions).toEqual([
      'edit',
      'cancel',
    ]);
    const types = (await h.db.stockMovement.findMany()).map((m) => m.type).sort();
    expect(types.filter((t) => t !== 'PURCHASE_RECEIPT')).toEqual([
      'ADJUSTMENT_IN',
      'ADJUSTMENT_IN', // EP37: demo raw material for production
      'ADJUSTMENT_IN', // EP38: materials of the demo completed order (two lines)
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'COUNT_CORRECTION',
      'PRODUCTION_CONSUMPTION', // EP37: the posted demo material issue (two lines)
      'PRODUCTION_CONSUMPTION',
      'PRODUCTION_CONSUMPTION', // EP38: the completed order's issue (two lines)
      'PRODUCTION_CONSUMPTION',
      'PRODUCTION_OUTPUT', // EP38: the two posted finished goods receipts
      'PRODUCTION_OUTPUT',
      'SALES_ISSUE', // EP35: the two demo dispatches
      'SALES_ISSUE',
      'TRANSFER_IN',
      'TRANSFER_OUT',
    ]);
    const balances = await h.db.stockBalance.findMany();
    for (const b of balances) {
      const sum = await h.db.stockMovement.aggregate({
        where: { locationId: b.locationId, itemId: b.itemId, lotId: b.lotId },
        _sum: { quantityDelta: true },
      });
      expect(sum._sum.quantityDelta!.toString()).toBe(b.quantityOnHand.toString());
    }
    const body = (await wh.get(`${W}/movements`)).body;
    expect(body).not.toMatch(/price|amount|cost|deposit/i);
    await seedDemo(h.db, parseSeedEnv(ENV));
    expect(await h.db.stockMovement.count()).toBe(21); // EP35: 2 SALES_ISSUE; EP37: +1 adjustment, 2 consumptions; EP38: +2 adjustment lines, 2 consumptions, 2 outputs
    expect(await h.db.inventoryTransfer.count()).toBe(2);
  });

  it('seeds sales orders and allocations once — FEFO reservations, no stock effect (EP33, EP34)', async () => {
    const S = '/api/v1/sales';
    const movements = await h.db.stockMovement.count();
    const onHand = JSON.stringify(
      await h.db.stockBalance.findMany({
        orderBy: { id: 'asc' },
        select: { quantityOnHand: true },
      }),
    );
    const owner = await login('owner.demo@pdabliss.com');
    const all = j(await owner.get(`${S}/orders`)).items;
    expect(all.map((o: J) => o.status).sort()).toEqual([
      'CANCELLED',
      ...Array(7).fill('CONFIRMED'),
      'DRAFT',
      'SUBMITTED',
    ]);
    const by = (status: string) => all.find((o: J) => o.status === status);
    expect(by('SUBMITTED')).toMatchObject({
      branch: { code: '00000' },
      availability: 'UNAVAILABLE',
    });
    expect(by('CANCELLED').availability).toBeNull();
    const states = all
      .filter((o: J) => o.status === 'CONFIRMED')
      .map((o: J) => [o.lineCount, o.allocationState, o.pickReadiness])
      .sort();
    expect(states).toEqual(
      [
        [1, 'NOT_ALLOCATED', 'NOT_READY'], // SO_OPEN
        [2, 'FULLY_ALLOCATED', 'READY'], // SO_CONFIRMED
        [2, 'PARTIALLY_ALLOCATED', 'PARTIALLY_READY'], // SO_ALLOC_PARTIAL
        ...Array(4).fill([1, 'FULLY_ALLOCATED', 'READY']), // EP35 SO_FUL_*
      ].sort(),
    );
    const full = all.find((o: J) => o.allocationState === 'FULLY_ALLOCATED' && o.lineCount === 2);
    expect(j(await owner.get(`${S}/orders/${full.id}`)).order.grandTotal).toBe('1572.90');
    // FEFO from the real demo stock: lot B (two locations) for SO_CONFIRMED, then A + C and
    // the 5 kg of raw material that exist for SO_ALLOC_PARTIAL.
    const rows = await h.db.salesAllocation.findMany({
      where: { status: 'ACTIVE' },
      include: { lot: true, location: true, line: true, order: true },
    });
    // Deterministic order (rows of one allocation share a timestamp): item, order, lot, location.
    const key = (r: (typeof rows)[number]) =>
      [r.line.itemCode, r.order.number, r.lot?.lotNumber ?? '', r.location.code].join('|');
    rows.sort((x, y) => key(x).localeCompare(key(y)));
    expect(
      rows.map((r) => [r.line.itemCode, r.lot?.lotNumber, r.location.code, r.quantity.toString()]),
    ).toEqual([
      ['FG-000001', 'FG-DEMO-B', 'MAIN', '4'],
      ['FG-000001', 'FG-DEMO-B', 'RECEIVING', '2'],
      ['FG-000001', 'FG-DEMO-A', 'MAIN', '12'],
      ['FG-000001', 'FG-DEMO-C', 'MAIN', '2'],
      ['PK-000001', undefined, 'MAIN', '20'],
      // EP35 fulfilment orders: what is still reserved (SO_FUL_SHIPPED keeps 6 of 10).
      ['PK-000001', undefined, 'MAIN', '12'],
      ['PK-000001', undefined, 'MAIN', '6'],
      ['PK-000001', undefined, 'MAIN', '6'],
      ['RM-000001', 'RM-DEMO-01', 'MAIN', '5'],
    ]);
    // The demo sales persona stays staff at the Head Office: no demo-branch orders, no allocation.
    const sales = await login('sales.demo@pdabliss.com');
    const mine = j(await sales.get(`${S}/orders`)).items;
    expect(mine.map((o: J) => o.status).sort()).toEqual(['CANCELLED', 'DRAFT', 'SUBMITTED']);
    expect((await sales.post(`${S}/orders/${full.id}/release`)).statusCode).toBe(404);
    // Warehouse never reaches Sales, but sees the demo branch's Pending Pick (no money).
    const wh = await login('warehouse.demo@pdabliss.com');
    expect((await wh.get(`${S}/orders`)).statusCode).toBe(403);
    const pick = await wh.get('/api/v1/warehouse/pending-pick');
    expect(
      j(pick)
        .items.map((o: J) => o.readiness)
        .sort(),
    ).toEqual(['PARTIALLY_READY', 'READY', 'READY', 'READY', 'READY']);
    expect(JSON.stringify(j(pick).items)).not.toMatch(
      /price|amount|total|discount|tax|185|customer/i,
    );
    await seedDemo(h.db, parseSeedEnv(ENV));
    expect(await h.db.salesOrder.count()).toBe(10);
    expect(await h.db.salesAllocation.count()).toBe(11);
    expect(await h.db.stockMovement.count()).toBe(movements);
    expect(
      JSON.stringify(
        await h.db.stockBalance.findMany({
          orderBy: { id: 'asc' },
          select: { quantityOnHand: true },
        }),
      ),
    ).toBe(onHand);
  });

  it('seeds fulfilment once through the real service — pick, pack, ship, dispatch, deliver (EP35)', async () => {
    const W = '/api/v1/warehouse';
    const moves = await h.db.stockMovement.count();
    const wh = await login('warehouse.demo@pdabliss.com');
    const picks = j(await wh.get(`${W}/picks`)).items;
    expect(picks.map((p: J) => p.status)).toEqual(Array(4).fill('PICKED'));
    const packs = j(await wh.get(`${W}/packs`)).items;
    expect(packs.map((p: J) => p.status).sort()).toEqual([
      'DISPATCHED',
      'DISPATCHED',
      'PACKED',
      'PACKED',
    ]);
    const ships = j(await wh.get(`${W}/shipments`)).items;
    expect(ships.map((x: J) => x.status).sort()).toEqual(['DELIVERED', 'DELIVERY_EXCEPTION']);
    const issues = await h.db.stockMovement.findMany({ where: { type: 'SALES_ISSUE' } });
    expect(issues.map((m) => m.quantityDelta.toString()).sort()).toEqual(['-3', '-4']);
    // The demo warehouse persona stays staff: it reads, picks and packs but never dispatches.
    const ready = j(await wh.get(`${W}/shipments/${ships[0].id}`)).shipment;
    expect(ready.actions).toEqual([]);
    expect(JSON.stringify(ships)).not.toMatch(/price|amount|total|discount|tax|"18"/i);
    const owner = await login('owner.demo@pdabliss.com');
    const states = j(await owner.get('/api/v1/sales/orders?pageSize=50'))
      .items.filter((o: J) => o.status === 'CONFIRMED')
      .map((o: J) => o.number);
    expect(states).toHaveLength(7);
    await seedDemo(h.db, parseSeedEnv(ENV));
    expect(await h.db.stockMovement.count()).toBe(moves);
    expect(await h.db.salesPick.count()).toBe(4);
    expect(await h.db.salesShipment.count()).toBe(2);
  });

  it('seeds production planning once through the real services — no stock effect (EP36)', async () => {
    const P = '/api/v1/production';
    const snapshot = async () =>
      JSON.stringify({
        moves: await h.db.stockMovement.count(),
        balances: (await h.db.stockBalance.findMany({ orderBy: { id: 'asc' } })).map((b) => [
          b.id,
          b.quantityOnHand.toString(),
        ]),
        allocations: await h.db.salesAllocation.count(),
        boms: await h.db.productionBom.count(),
        orders: await h.db.productionOrder.count(),
        materials: await h.db.productionOrderMaterial.count(),
        audit: await h.db.auditLog.count(),
      });
    const ops = await login('operations.demo@pdabliss.com');
    const boms = j(await ops.get(`${P}/boms`)).items;
    expect(boms.map((b: J) => [b.code, b.revision, b.status])).toEqual([
      ['BOM-FG-000001', 2, 'ACTIVE'],
      ['BOM-FG-000001', 1, 'RETIRED'],
    ]);
    const orders = j(await ops.get(`${P}/orders?pageSize=50`)).items;
    expect(orders.map((o: J) => [o.status, o.source, o.quantity]).sort()).toEqual(
      [
        ['APPROVED', 'MANUAL', '40'],
        ['APPROVED', 'MANUAL', '8'],
        ['APPROVED', 'MANUAL', '6'], // EP37 MO_PARTIAL
        ['COMPLETED', 'MANUAL', '2'], // EP38 MO_DONE
        ['DRAFT', 'MANUAL', '4'],
        ['IN_PRODUCTION', 'MANUAL', '10'], // EP37 MO_EXEC
        ['SUBMITTED', 'MANUAL', '6'],
        ['SUBMITTED', 'SALES_DEMAND', '4'],
      ].sort(),
    );
    const short = orders.find((o: J) => o.quantity === '40');
    const detail = j(await ops.get(`${P}/orders/${short.id}`)).order;
    expect(detail.materialState).toBe('MATERIALS_SHORT');
    expect(detail.materials.map((m: J) => [m.item.code, m.required])).toEqual([
      ['RM-000001', '10'],
      ['PK-000001', '40'],
    ]);
    // The Operations persona keeps its role (manager) and branches; production is planning only.
    const ctx = j(await ops.get(`${P}/context`));
    expect(ctx.orders).toEqual({ view: true, create: true, approve: true, cancel: true });
    expect(
      await h.db.stockBalance.count({
        where: { item: { code: 'FG-000001' }, quantityOnHand: { gt: 30 } },
      }),
    ).toBe(0);
    const before = await snapshot();
    await seedDemo(h.db, parseSeedEnv(ENV));
    expect(await snapshot()).toBe(before);
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
