import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapPlatform, parseSeedEnv, seedDemo } from '../src/auth/bootstrap.js';
import { DEPARTMENT_CODES, type DepartmentCode } from '../src/billing/catalog.js';
import { DEMO_PERSONAS } from '../src/demo/personas.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import {
  DEPARTMENT_ROLES,
  departmentOf,
  PERMISSION_CATALOG,
  takesDepartment,
  type OperationalPermission,
} from '../src/permissions/catalog.js';
import {
  departmentAssignment,
  effectivePermissions,
  type PermissionInputs,
} from '../src/permissions/resolver.js';
import { routesOf, urlWith, type Route } from './route-table.js';
import {
  Browser,
  createActiveCompany,
  createHarness,
  createUser,
  describeDb,
  resetDb,
  signIn,
  type ApiResponse,
  type Harness,
} from './support.js';

/*
 * EP45 — single-department enforcement (docs/EP45_DEPARTMENT_POLICY.md,
 * docs/EP45_SECURITY_TEST_MATRIX.md). The numbers in the test names are the
 * abuse cases of the EP45 brief (A1 … A20).
 *
 *   1. the resolver, exhaustively: a department role works in its ONE department only
 *   2. the database: constraints and guard triggers refuse what the API refuses
 *   3. administration: assign / reassign / remove, role conflicts, invitations, races
 *   4. the seeded demo world: cross-department abuse with the real personas, stale
 *      sessions, a sweep over the real route table, and Warehouse money privacy
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const C = '/api/v1/company';
const API = '/api/v1';

const inputs = (over: Partial<PermissionInputs>): PermissionInputs => ({
  role: 'DEPARTMENT_STAFF',
  active: true,
  enabled: [...DEPARTMENT_CODES],
  assigned: [],
  executiveAllowed: true,
  overrides: [],
  ...over,
});
const operational = (i: PermissionInputs) =>
  effectivePermissions(i).filter((c) => !c.startsWith('company.')) as OperationalPermission[];

// ------------------------------------------------------------------ resolver

describe('EP45 resolver — one department per department role', () => {
  it('a Manager / Staff / Viewer works only inside the ONE assigned department (every role × department)', () => {
    for (const role of DEPARTMENT_ROLES)
      for (const d of DEPARTMENT_CODES) {
        const codes = operational(inputs({ role, assigned: [d] }));
        expect(codes.length, `${role} ${d}`).toBeGreaterThan(0);
        for (const c of codes) expect(departmentOf(c), `${role} ${d} ${c}`).toBe(d);
      }
  });

  it('A7: two assignments (impossible in the database) fail closed — no operational permission at all', () => {
    for (const role of DEPARTMENT_ROLES)
      for (const a of DEPARTMENT_CODES)
        for (const b of DEPARTMENT_CODES) {
          if (a === b) continue;
          const i = inputs({
            role,
            assigned: [a, b],
            overrides: [{ permission: `${a.toLowerCase()}.workspace.view`, effect: 'ALLOW' }],
          });
          expect(operational(i), `${role} ${a}+${b}`).toEqual([]);
          expect(departmentAssignment(i)).toEqual({ status: 'AMBIGUOUS', department: null });
        }
  });

  it('no department → no operational access, explained as UNASSIGNED', () => {
    for (const role of DEPARTMENT_ROLES) {
      const i = inputs({ role, assigned: [] });
      expect(operational(i)).toEqual([]);
      expect(departmentAssignment(i)).toEqual({ status: 'UNASSIGNED', department: null });
    }
  });

  it('A8: an ALLOW exception never reaches another department (department beats role and exception)', () => {
    for (const p of PERMISSION_CATALOG) {
      const d = departmentOf(p.code);
      if (!d || d === 'WAREHOUSE') continue;
      const i = inputs({
        role: 'DEPARTMENT_MANAGER',
        assigned: ['WAREHOUSE'],
        overrides: [{ permission: p.code, effect: 'ALLOW' }],
      });
      expect(effectivePermissions(i), p.code).not.toContain(p.code);
    }
  });

  it('Owner, Executive and System Admin: explicit statuses; Executive READ only; System Admin nothing operational', () => {
    const status = (role: CompanyRole, assigned: DepartmentCode[] = []) =>
      departmentAssignment(inputs({ role, assigned })).status;
    expect(status('COMPANY_OWNER')).toBe('CROSS_DEPARTMENT');
    expect(status('EXECUTIVE')).toBe('OVERSIGHT');
    expect(status('SYSTEM_ADMIN')).toBe('ADMINISTRATIVE');
    expect(status('SYSTEM_ADMIN', ['SALES'])).toBe('ADMINISTRATIVE');
    expect(status('DEPARTMENT_STAFF', ['SALES'])).toBe('ASSIGNED');
    // Executive: every code it holds is a READ code — even with an assignment and ALLOWs.
    const ex = operational(
      inputs({
        role: 'EXECUTIVE',
        assigned: ['WAREHOUSE'],
        overrides: PERMISSION_CATALOG.filter((p) => departmentOf(p.code)).map((p) => ({
          permission: p.code,
          effect: 'ALLOW' as const,
        })),
      }),
    );
    expect(ex.length).toBeGreaterThan(0);
    for (const c of ex) expect(PERMISSION_CATALOG.find((p) => p.code === c)!.tier, c).toBe('READ');
    // System Admin: never an operational code, assigned or not, ALLOW or not.
    expect(
      operational(
        inputs({
          role: 'SYSTEM_ADMIN',
          assigned: ['SALES'],
          overrides: [{ permission: 'sales.orders.create', effect: 'ALLOW' }],
        }),
      ),
    ).toEqual([]);
    expect(takesDepartment('COMPANY_OWNER') || takesDepartment('SYSTEM_ADMIN')).toBe(false);
    expect(takesDepartment('EXECUTIVE')).toBe(false);
  });
});

// ------------------------------------------------------------------ database + administration

describeDb('EP45 database constraints and administration', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const ids: Record<string, string> = {};
  const users: Record<string, string> = {};
  const dept: Record<string, string> = {};

  const people: [string, CompanyRole, 'A' | 'B'][] = [
    ['owner@a.example', 'COMPANY_OWNER', 'A'],
    ['admin@a.example', 'SYSTEM_ADMIN', 'A'],
    ['exec@a.example', 'EXECUTIVE', 'A'],
    ['staff@a.example', 'DEPARTMENT_STAFF', 'A'],
    ['staff2@a.example', 'DEPARTMENT_STAFF', 'A'],
    ['viewer@a.example', 'VIEWER', 'A'],
    ['owner@b.example', 'COMPANY_OWNER', 'B'],
  ];

  beforeAll(async () => {
    h = await createHarness();
    await resetDb(h.db);
    A = await createActiveCompany(h.db, {
      name: 'Alpha',
      departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
    });
    B = await createActiveCompany(h.db, { name: 'Beta', departments: ['SALES', 'WAREHOUSE'] });
    for (const [email, companyRole, co] of people) {
      const u = await createUser(h.db, email, {
        companyRole,
        companyId: co === 'A' ? A.companyId : B.companyId,
      });
      users[email] = u.id;
      ids[email] = (await h.db.companyMember.findUniqueOrThrow({ where: { userId: u.id } })).id;
    }
    for (const d of await h.db.department.findMany())
      dept[`${d.companyId === A.companyId ? 'A' : 'B'}.${d.code}`] = d.id;
  });
  afterAll(async () => h?.close());

  const sqlRefused = async (sql: string, re: RegExp, ...params: unknown[]) => {
    await expect(h.db.$executeRawUnsafe(sql, ...params)).rejects.toThrow(re);
  };
  const insertAssignment = (userId: string, companyId: string, departmentId: string) =>
    h.db.$executeRawUnsafe(
      `INSERT INTO "Membership" ("id", "userId", "companyId", "departmentId", "isPrimary")
       VALUES (gen_random_uuid()::text, $1, $2, $3, true)`,
      userId,
      companyId,
      departmentId,
    );
  const assignmentsOf = (email: string) =>
    h.db.membership.count({ where: { userId: users[email] } });

  it('A20/A7: the database allows ONE assignment per person and company — a second row is refused', async () => {
    const u = users['staff@a.example']!;
    expect(await insertAssignment(u, A.companyId, dept['A.SALES']!)).toBe(1);
    await expect(insertAssignment(u, A.companyId, dept['A.WAREHOUSE']!)).rejects.toThrow(
      /Membership_userId_companyId_key|Unique constraint/,
    );
    // Moving the one row is allowed (reassignment), never duplicating it.
    await h.db.$executeRawUnsafe(
      `UPDATE "Membership" SET "departmentId" = $1 WHERE "userId" = $2`,
      dept['A.WAREHOUSE'],
      u,
    );
    expect(await assignmentsOf('staff@a.example')).toBe(1);
    await h.db.membership.deleteMany({ where: { userId: u } });
  });

  it('A9/A20: an assignment to another company’s department, or for a non-member, cannot exist', async () => {
    const u = users['staff@a.example']!;
    // Beta's department under Alpha's company id: the department does not belong to Alpha.
    await expect(insertAssignment(u, A.companyId, dept['B.SALES']!)).rejects.toThrow(
      /Membership_departmentId_companyId_fkey|Foreign key/,
    );
    // Beta's department under Beta's company id: the person is not a member of Beta.
    await expect(insertAssignment(u, B.companyId, dept['B.SALES']!)).rejects.toThrow(
      /Membership_userId_companyId_fkey|Foreign key/,
    );
    // Moving an existing row to another company's department is refused the same way.
    await insertAssignment(u, A.companyId, dept['A.SALES']!);
    await sqlRefused(
      `UPDATE "Membership" SET "departmentId" = $1 WHERE "userId" = $2`,
      /Membership_departmentId_companyId_fkey|foreign key/i,
      dept['B.SALES'],
      u,
    );
    await h.db.membership.deleteMany({ where: { userId: u } });
    expect(await assignmentsOf('staff@a.example')).toBe(0);
  });

  it('A8/A20: Owner, System Admin and Executive hold no assignment; a role change cannot keep one', async () => {
    for (const email of ['owner@a.example', 'admin@a.example', 'exec@a.example']) {
      await expect(
        insertAssignment(users[email]!, A.companyId, dept['A.SALES']!),
        email,
      ).rejects.toThrow(/holds no department assignment/);
    }
    const u = users['staff2@a.example']!;
    await insertAssignment(u, A.companyId, dept['A.SALES']!);
    for (const role of ['SYSTEM_ADMIN', 'EXECUTIVE']) {
      await sqlRefused(
        `UPDATE "CompanyMember" SET "role" = $1::"CompanyRole" WHERE "id" = $2`,
        /remove the department assignment/,
        role,
        ids['staff2@a.example'],
      );
    }
    // Between department roles the assignment stays valid.
    await h.db.$executeRawUnsafe(
      `UPDATE "CompanyMember" SET "role" = 'VIEWER' WHERE "id" = $1`,
      ids['staff2@a.example'],
    );
    await h.db.$executeRawUnsafe(
      `UPDATE "CompanyMember" SET "role" = 'DEPARTMENT_STAFF' WHERE "id" = $1`,
      ids['staff2@a.example'],
    );
    await h.db.membership.deleteMany({ where: { userId: u } });
  });

  it('A20: a pending invitation names at most one department, none for System Admin / Executive', async () => {
    const base = {
      companyId: A.companyId,
      email: 'x@person.example',
      emailNormalized: 'x@person.example',
      invitedById: users['owner@a.example']!,
      expiresAt: new Date(Date.now() + 86_400_000),
    };
    const add = (data: { role: CompanyRole; departments: DepartmentCode[] }) =>
      h.db.invitation.create({ data: { ...base, tokenHash: `t${Math.random()}`, ...data } });
    await expect(add({ role: 'VIEWER', departments: ['SALES', 'WAREHOUSE'] })).rejects.toThrow(
      /Invitation_department_intent_check|check constraint/i,
    );
    await expect(add({ role: 'SYSTEM_ADMIN', departments: ['SALES'] })).rejects.toThrow(
      /Invitation_department_intent_check|check constraint/i,
    );
    await expect(add({ role: 'EXECUTIVE', departments: ['SALES'] })).rejects.toThrow(
      /Invitation_department_intent_check|check constraint/i,
    );
    // History is untouched: a closed invitation keeps whatever it named.
    const ok = await add({ role: 'VIEWER', departments: ['SALES'] });
    await h.db.invitation.update({ where: { id: ok.id }, data: { status: 'REVOKED' } });
    await h.db.invitation.deleteMany({ where: { companyId: A.companyId } });
  });

  it('A7/A8/A11/A12: the administration API assigns exactly one enabled department of the own company', async () => {
    const owner = await signIn(h, 'owner@a.example');
    const put = (email: string, departments: string[], b: Browser = owner) =>
      b.put(`${C}/current/members/${ids[email]}/departments`, { departments });
    expect(code(await put('staff@a.example', ['SALES', 'WAREHOUSE']))).toBe('ONE_DEPARTMENT_ONLY');
    for (const email of ['admin@a.example', 'exec@a.example'])
      expect(code(await put(email, ['SALES'])), email).toBe('ROLE_TAKES_NO_DEPARTMENT');
    expect(code(await put('owner@a.example', ['SALES']))).toBe('OWNER_PROTECTED');
    expect((await put('staff@a.example', ['HACKED'])).statusCode).toBe(400);
    // A forged department id or company id is not part of the contract.
    expect(
      (
        await owner.put(`${C}/current/members/${ids['staff@a.example']}/departments`, {
          departments: ['SALES'],
          departmentId: dept['B.SALES'],
          companyId: B.companyId,
        })
      ).statusCode,
    ).toBe(400);
    // Another company's member is not found; own access cannot be changed.
    const beta = await signIn(h, 'owner@b.example');
    expect(code(await put('staff@a.example', ['SALES'], beta))).toBe('MEMBER_NOT_FOUND');
    const admin = await signIn(h, 'admin@a.example');
    expect(
      code(
        await admin.put(`${C}/current/members/${ids['admin@a.example']}/departments`, {
          departments: [],
        }),
      ),
    ).toBe('SELF_CHANGE');
    expect(await assignmentsOf('staff@a.example')).toBe(0);

    // Assign, reassign (replaces), remove — each audited with from / to.
    expect((await put('staff@a.example', ['SALES'])).statusCode).toBe(200);
    expect((await put('staff@a.example', ['WAREHOUSE'])).statusCode).toBe(200);
    expect((await put('staff@a.example', ['WAREHOUSE'])).statusCode).toBe(200); // no change
    expect(await assignmentsOf('staff@a.example')).toBe(1);
    expect((await put('staff@a.example', [])).statusCode).toBe(200);
    expect(await assignmentsOf('staff@a.example')).toBe(0);
    const events = await h.db.auditLog.findMany({
      where: { action: 'MEMBER_DEPARTMENTS_CHANGED', entityId: ids['staff@a.example'] },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((e) => [(e.changes as J).from, (e.changes as J).to])).toEqual([
      [null, 'SALES'],
      ['SALES', 'WAREHOUSE'],
      ['WAREHOUSE', null],
    ]);
  });

  it('A8: a role change to System Admin / Executive is refused while a department is assigned — never silently removed', async () => {
    const owner = await signIn(h, 'owner@a.example');
    const staff = ids['staff2@a.example']!;
    await owner.put(`${C}/current/members/${staff}/departments`, { departments: ['SALES'] });
    for (const role of ['SYSTEM_ADMIN', 'EXECUTIVE']) {
      const res = await owner.patch(`${C}/current/members/${staff}`, { role });
      expect(res.statusCode, role).toBe(409);
      expect(code(res)).toBe('ROLE_DEPARTMENT_CONFLICT');
    }
    expect((await h.db.companyMember.findUniqueOrThrow({ where: { id: staff } })).role).toBe(
      'DEPARTMENT_STAFF',
    );
    expect(await assignmentsOf('staff2@a.example')).toBe(1);
    // Remove first, then the role change is allowed.
    await owner.put(`${C}/current/members/${staff}/departments`, { departments: [] });
    expect(
      (await owner.patch(`${C}/current/members/${staff}`, { role: 'EXECUTIVE' })).statusCode,
    ).toBe(200);
    expect(
      (await owner.patch(`${C}/current/members/${staff}`, { role: 'DEPARTMENT_STAFF' })).statusCode,
    ).toBe(200);
  });

  it('A16: parallel department assignments never create two — the end state is exactly one, every change audited', async () => {
    const owner = await signIn(h, 'owner@a.example');
    const member = ids['viewer@a.example']!;
    const before = await h.db.auditLog.count({
      where: { action: 'MEMBER_DEPARTMENTS_CHANGED', entityId: member },
    });
    const order: DepartmentCode[] = [
      'SALES',
      'WAREHOUSE',
      'PURCHASING',
      'ACCOUNTING',
      'OPERATIONS',
    ];
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        owner.put(`${C}/current/members/${member}/departments`, {
          departments: [order[i % order.length]],
        }),
      ),
    );
    for (const r of results) expect([200, 409], r.body).toContain(r.statusCode);
    const rows = await h.db.membership.findMany({ where: { userId: users['viewer@a.example'] } });
    expect(rows).toHaveLength(1);
    const after = await h.db.auditLog.findMany({
      where: { action: 'MEMBER_DEPARTMENTS_CHANGED', entityId: member },
      orderBy: { occurredAt: 'asc' },
    });
    // Every recorded change chains from the previous one and ends on the stored department.
    const changes = after.slice(before).map((e) => e.changes as J);
    expect(changes.length).toBeGreaterThan(0);
    for (let i = 1; i < changes.length; i++) expect(changes[i]!.from).toBe(changes[i - 1]!.to);
    const stored = await h.db.department.findUniqueOrThrow({
      where: { id: rows[0]!.departmentId },
    });
    expect(changes.at(-1)!.to).toBe(stored.code);
  });

  it('A16/A8: a role change racing a department assignment never leaves a System Admin with a department', async () => {
    const owner = await signIn(h, 'owner@a.example');
    for (let round = 0; round < 6; round++) {
      const email = `race${round}@a.example`;
      const u = await createUser(h.db, email, {
        companyRole: 'DEPARTMENT_STAFF',
        companyId: A.companyId,
      });
      const m = await h.db.companyMember.findUniqueOrThrow({ where: { userId: u.id } });
      const [role, assign] = await Promise.all([
        owner.patch(`${C}/current/members/${m.id}`, { role: 'SYSTEM_ADMIN' }),
        owner.put(`${C}/current/members/${m.id}/departments`, { departments: ['SALES'] }),
      ]);
      expect(role.statusCode, role.body).toBeLessThan(500);
      expect(assign.statusCode, assign.body).toBeLessThan(500);
      const after = await h.db.companyMember.findUniqueOrThrow({ where: { id: m.id } });
      const held = await h.db.membership.count({ where: { userId: u.id } });
      // Exactly one of them won; the invariant holds either way.
      expect(after.role === 'SYSTEM_ADMIN' && held > 0).toBe(false);
      expect(role.statusCode === 200 && assign.statusCode === 200).toBe(false);
    }
  });

  it('A13: a department change reaches an open session on its very next request (no re-login, no cache)', async () => {
    const owner = await signIn(h, 'owner@a.example');
    const staff = ids['staff@a.example']!;
    await owner.put(`${C}/current/members/${staff}/departments`, { departments: ['SALES'] });
    const s = await signIn(h, 'staff@a.example');
    const ctx = async () => j(await s.get(`${C}/context`));
    expect((await ctx()).departments).toEqual(['SALES']);
    expect((await ctx()).assignment).toEqual({ status: 'ASSIGNED', department: 'SALES' });
    await owner.put(`${C}/current/members/${staff}/departments`, { departments: ['WAREHOUSE'] });
    const now = await ctx();
    expect(now.departments).toEqual(['WAREHOUSE']);
    expect(now.permissions.some((p: string) => p.startsWith('sales.'))).toBe(false);
    await owner.put(`${C}/current/members/${staff}/departments`, { departments: [] });
    const none = await ctx();
    expect(none.departments).toEqual([]);
    expect(none.assignment).toEqual({ status: 'UNASSIGNED', department: null });
    expect(none.permissions.every((p: string) => p.startsWith('company.'))).toBe(true);
  });
});

// ------------------------------------------------------------------ the seeded demo world

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

/** Which department owns the state-changing routes under a prefix (purchase requests are raised by every department). */
const OWNER_OF: [RegExp, DepartmentCode][] = [
  [/^\/api\/v1\/sales\//, 'SALES'],
  [/^\/api\/v1\/production\//, 'OPERATIONS'],
  [/^\/api\/v1\/warehouse\//, 'WAREHOUSE'],
  [/^\/api\/v1\/purchase-orders\/:id\/deposit\//, 'ACCOUNTING'],
  [/^\/api\/v1\/purchase-orders\//, 'PURCHASING'],
  [/^\/api\/v1\/accounting\//, 'ACCOUNTING'],
  [/^\/api\/v1\/master-data\/customers/, 'SALES'],
  [/^\/api\/v1\/master-data\/suppliers/, 'PURCHASING'],
  [/^\/api\/v1\/master-data\/(items|units|categories)/, 'OPERATIONS'],
  [/^\/api\/v1\/master-data\/locations/, 'WAREHOUSE'],
];
const ownerOf = (r: Route) => OWNER_OF.find(([re]) => re.test(`${r.path}/`))?.[1] ?? null;
/** Volatile tables: sign-ins write sessions and auth events; nothing else may change. */
const VOLATILE = new Set([
  '_prisma_migrations',
  'Session',
  'AuthAuditEvent',
  'TrustedDevice',
  'OtpChallenge',
]);

describeDb('EP45 department boundaries with the real demo personas', () => {
  let h: Harness;
  let routes: Route[];
  const ids: Record<string, string> = {};
  const as: Record<string, Browser> = {};
  const member: Record<string, string> = {};

  const marker = async (key: string) =>
    (await h.db.auditLog.findFirstOrThrow({ where: { changes: { path: ['demo'], equals: key } } }))
      .entityId;
  const persona = async (email: string, branch = '00001') => {
    const b = new Browser(h.app);
    const res = await b.post('/api/v1/auth/login', { email, password: passwordOf(email) });
    expect(res.statusCode, res.body).toBe(200);
    const ctx = j(await b.get(`${C}/context`));
    const target = ctx.branches?.find((x: J) => x.code === branch);
    if (target && ctx.selected?.code !== branch && !ctx.blocked)
      await b.post(`${C}/context/branch`, { branchId: target.id });
    return b;
  };
  /** Content hash of every non-volatile table — "nothing changed" means equal hashes. */
  const stateHash = async () => {
    const tables = await h.db.$queryRaw<{ t: string }[]>`
      SELECT tablename AS t FROM pg_tables WHERE schemaname = current_schema() ORDER BY 1`;
    const out: Record<string, string> = {};
    for (const { t } of tables) {
      if (VOLATILE.has(t)) continue;
      const [row] = await h.db.$queryRawUnsafe<{ h: string }[]>(
        `SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM "${t}" x`,
      );
      out[t] = row!.h;
    }
    return out;
  };
  const changed = (a: Record<string, string>, b: Record<string, string>) =>
    Object.keys(a).filter((k) => a[k] !== b[k]);
  const put = (email: string, body: J) =>
    as.owner!.put(`${C}/current/members/${member[email]}/departments`, body);

  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'true' });
    await resetDb(h.db);
    const env = parseSeedEnv(ENV);
    await bootstrapPlatform(h.db, env);
    await seedDemo(h.db, env);
    routes = routesOf(h);
    const first = async (model: any, where: J = {}) => (await model.findFirst({ where }))?.id;
    Object.assign(ids, {
      so: await marker('SO_FUL_SHIPPED'),
      pr: await marker('PR_EP39_MATERIALS'),
      po: await marker('PO_EP39_AWAITING'),
      deposit: await marker('PO_WAITING_DEPOSIT'),
      gr: await marker('GR_EP39_FULL'),
      mo: await marker('MO_EXEC'),
      transfer: await marker('TR_DRAFT'),
      adjustment: await marker('ADJ_DECREASE'),
      count: await marker('CC_POSTED'),
    });
    Object.assign(ids, {
      prLine: await first(h.db.purchaseRequestLine, { purchaseRequestId: ids.pr }),
      poLine: await first(h.db.purchaseOrderLine, { purchaseOrderId: ids.po }),
      grLine: await first(h.db.goodsReceiptLine, { goodsReceiptId: ids.gr }),
      material: await first(h.db.productionOrderMaterial, { productionOrderId: ids.mo }),
      pick: await first(h.db.salesPick),
      pack: await first(h.db.salesPack),
      shipment: await first(h.db.salesShipment),
      fgr: await first(h.db.productionGoodsReceipt),
      issue: await first(h.db.productionMaterialIssue),
      output: await first(h.db.productionOutputReport),
      bom: await first(h.db.productionBom),
      item: await first(h.db.item),
      customer: await first(h.db.customer),
      supplier: await first(h.db.supplier),
      unit: await first(h.db.unit),
      category: await first(h.db.itemCategory),
      location: await first(h.db.warehouseLocation),
      branch: await first(h.db.branch, { code: '00001' }),
      ho: await first(h.db.branch, { code: '00000' }),
      fg2: (await h.db.item.findFirstOrThrow({ where: { code: 'FG-000002' } })).id,
      rm2: (await h.db.item.findFirstOrThrow({ where: { code: 'RM-000002' } })).id,
      cus: (await h.db.customer.findFirstOrThrow({ where: { code: 'CUS-000002' } })).id,
    });
    // Distinctive money: any of these digits in a response that must not carry money is a leak.
    await h.db.purchaseOrderLine.updateMany({ data: { unitPrice: '987654.3219' } });
    await h.db.salesOrderLine.updateMany({ data: { unitPrice: '876543.2109' } });
    for (const p of DEMO_PERSONAS)
      member[p.email] = (
        await h.db.companyMember.findFirstOrThrow({
          where: { user: { emailNormalized: p.email } },
        })
      ).id;
    for (const [k, email] of [
      ['owner', 'owner.demo@pdabliss.com'],
      ['admin', 'admin.demo@pdabliss.com'],
      ['exec', 'executive.demo@pdabliss.com'],
      ['sales', 'sales.demo@pdabliss.com'],
      ['ops', 'operations.demo@pdabliss.com'],
      ['wh', 'warehouse.demo@pdabliss.com'],
      ['pur', 'purchasing.demo@pdabliss.com'],
      ['staff', 'staff.demo@pdabliss.com'],
    ] as const)
      as[k] = await persona(email);
    as.acc = await persona('accounting.demo@pdabliss.com', '00000');
  }, 300_000);
  afterAll(async () => h?.close());

  it('every demo persona has the department its responsibility needs — and only one', async () => {
    const expected: Record<string, J> = {
      owner: { status: 'CROSS_DEPARTMENT', department: null },
      admin: { status: 'ADMINISTRATIVE', department: null },
      exec: { status: 'OVERSIGHT', department: null },
      sales: { status: 'ASSIGNED', department: 'SALES' },
      ops: { status: 'ASSIGNED', department: 'OPERATIONS' },
      wh: { status: 'ASSIGNED', department: 'WAREHOUSE' },
      pur: { status: 'ASSIGNED', department: 'PURCHASING' },
      acc: { status: 'ASSIGNED', department: 'ACCOUNTING' },
      staff: { status: 'ASSIGNED', department: 'WAREHOUSE' },
    };
    for (const [k, a] of Object.entries(expected)) {
      const ctx = j(await as[k]!.get(`${C}/context`));
      expect(ctx.assignment, k).toEqual(a);
      if (a.department) expect(ctx.departments, k).toEqual([a.department]);
    }
    expect(j(await as.admin!.get(`${C}/context`)).departments).toEqual([]);
    // The database holds exactly one assignment per department persona, none for the others.
    const rows = await h.db.membership.groupBy({ by: ['userId'], _count: true });
    expect(rows.every((r) => r._count === 1)).toBe(true);
    expect(rows).toHaveLength(DEMO_PERSONAS.filter((p) => takesDepartment(p.role)).length);
  });

  it('A1–A6: cross-department mutations with valid bodies are refused (403) and write nothing', async () => {
    const before = await stateHash();
    // 403, or 404 where the record is not even visible to the caller (no existence leak).
    const refused = async (b: Browser, method: Route['method'], url: string, body?: J) => {
      const res = await b.request(method, url, body);
      expect([403, 404], `${method} ${url} ${res.body}`).toContain(res.statusCode);
      return code(res);
    };
    // A1 Sales → Warehouse stock mutation.
    await refused(as.sales!, 'POST', `${API}/warehouse/receipts`, { purchaseOrderId: ids.po });
    await refused(as.sales!, 'POST', `${API}/warehouse/receipts/${ids.gr}/post`, {});
    await refused(as.sales!, 'POST', `${API}/warehouse/shipments/${ids.shipment}/dispatch`, {});
    await refused(as.sales!, 'POST', `${API}/warehouse/adjustments/${ids.adjustment}/approve`, {});
    // A2 Warehouse → Purchasing.
    await refused(as.wh!, 'POST', `${API}/purchase-orders/${ids.po}/issue`, {});
    await refused(as.wh!, 'POST', `${API}/purchase-requests/${ids.pr}/approve`, {});
    expect(
      await refused(as.wh!, 'POST', `${API}/purchase-requests`, {
        department: 'PURCHASING',
        purpose: 'forged department',
        lines: [{ type: 'ITEM', itemId: ids.rm2, quantity: '1' }],
      }),
    ).toBe('DEPARTMENT_NOT_ALLOWED');
    // A3 Purchasing → Accounting (deposit authority).
    await refused(as.pur!, 'POST', `${API}/purchase-orders/${ids.deposit}/deposit/confirm`, {});
    await refused(as.pur!, 'POST', `${API}/purchase-orders/${ids.deposit}/deposit/waive`, {
      reason: 'not Purchasing’s decision',
    });
    // Production → Sales / Warehouse decisions.
    await refused(as.ops!, 'POST', `${API}/sales/orders`, {
      customerId: ids.cus,
      lines: [{ itemId: ids.fg2, quantity: '1', unitPrice: '1', taxRate: '7' }],
    });
    await refused(as.ops!, 'POST', `${API}/warehouse/finished-goods/receipts/${ids.fgr}/post`, {});
    // Accounting → everything operational.
    await refused(as.acc!, 'POST', `${API}/warehouse/receipts`, { purchaseOrderId: ids.po });
    await refused(as.acc!, 'POST', `${API}/purchase-orders/${ids.po}/issue`, {});
    // A5 Executive posting; A6 System Admin operational mutation.
    await refused(as.exec!, 'POST', `${API}/warehouse/receipts/${ids.gr}/post`, {});
    await refused(as.exec!, 'POST', `${API}/sales/orders/${ids.so}/confirm`, {});
    await refused(as.exec!, 'POST', `${API}/production/orders/${ids.mo}/approve`, {});
    await refused(as.admin!, 'POST', `${API}/warehouse/receipts`, { purchaseOrderId: ids.po });
    await refused(as.admin!, 'POST', `${API}/sales/orders`, {
      customerId: ids.cus,
      lines: [{ itemId: ids.fg2, quantity: '1', unitPrice: '1', taxRate: '7' }],
    });
    await refused(as.admin!, 'POST', `${API}/production/orders`, {
      itemId: ids.fg2,
      quantity: '1',
    });
    expect(changed(before, await stateHash())).toEqual([]);
  });

  it('A4/A17: department reads and summaries stay inside the department (commercial documents included)', async () => {
    const reads: [string, string][] = [
      // Production never opens commercial documents.
      ['ops', `${API}/purchase-orders/${ids.po}`],
      ['ops', `${API}/sales/orders/${ids.so}`],
      ['ops', `${API}/accounting/deposits`],
      // Sales sees no stock ledger, no purchasing, no production.
      ['sales', `${API}/warehouse/movements`],
      ['sales', `${API}/purchase-orders`],
      ['sales', `${API}/production/requirements`],
      ['sales', `${API}/purchasing/production-shortages`],
      // Warehouse never opens commercial documents or production orders.
      ['wh', `${API}/sales/orders`],
      ['wh', `${API}/purchase-orders/${ids.po}`],
      ['wh', `${API}/production/orders/${ids.mo}`],
      ['wh', `${API}/accounting/deposits`],
      // Purchasing reads orders, never deposits' accounting queue or sales.
      ['pur', `${API}/accounting/deposits`],
      ['pur', `${API}/sales/orders`],
      // Accounting reads deposits only.
      ['acc', `${API}/sales/orders`],
      ['acc', `${API}/warehouse/stock`],
      ['acc', `${API}/production/orders`],
    ];
    for (const [who, url] of reads)
      expect([403, 404], `${who} ${url}`).toContain((await as[who]!.get(url)).statusCode);
    // Workspace gates and the one-permission probe agree.
    for (const [who, d] of [
      ['sales', 'warehouse'],
      ['wh', 'sales'],
      ['pur', 'accounting'],
      ['ops', 'sales'],
      ['acc', 'purchasing'],
    ] as const) {
      expect((await as[who]!.get(`${API}/operations/workspaces/${d}`)).statusCode, who).toBe(403);
    }
    expect(
      (await as.sales!.get(`${API}/operations/authorize?permission=warehouse.receiving.process`))
        .statusCode,
    ).toBe(403);
  });

  it('A1–A6 sweep: no state-changing route of another department succeeds for any department persona — and nothing changes', async () => {
    const before = await stateHash();
    const bad: string[] = [];
    let refused403 = 0;
    let total = 0;
    const own: Record<string, DepartmentCode> = {
      sales: 'SALES',
      ops: 'OPERATIONS',
      wh: 'WAREHOUSE',
      staff: 'WAREHOUSE',
      pur: 'PURCHASING',
      acc: 'ACCOUNTING',
    };
    for (const [who, d] of Object.entries(own)) {
      for (const r of routes.filter((x) => x.method !== 'GET')) {
        const o = ownerOf(r);
        const company = /^\/api\/v1\/company\/current\//.test(r.path);
        if (!(company || (o && o !== d))) continue;
        total++;
        const res = await as[who]!.request(
          r.method,
          urlWith(ids, r.path),
          r.method === 'DELETE' ? undefined : {},
        );
        if (res.statusCode === 403) refused403++;
        if (res.statusCode < 300 || res.statusCode >= 500)
          bad.push(`${who} ${res.statusCode} ${r.method} ${r.path}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
    expect(total).toBeGreaterThan(600);
    // Most refusals are the authorization itself (the rest fail input validation first).
    expect(refused403 / total).toBeGreaterThan(0.4);
    expect(changed(before, await stateHash())).toEqual([]);
  });

  it('A10/A11/A15: forged ids, other branches and another company reach nothing', async () => {
    // A11 a well-formed id that does not exist, and an id of another kind of record.
    expect(
      (await as.sales!.get(`${API}/sales/orders/cm0000000000000000000000000`)).statusCode,
    ).toBe(404);
    expect((await as.sales!.get(`${API}/sales/orders/${ids.pr}`)).statusCode).toBe(404);
    expect((await as.wh!.get(`${API}/warehouse/receipts/${ids.so}`)).statusCode).toBe(404);
    // A10 Warehouse staff works in 00001 only: the Head Office cannot be selected or queried.
    expect(code(await as.wh!.post(`${C}/context/branch`, { branchId: ids.ho }))).toBe(
      'BRANCH_NOT_ALLOWED',
    );
    const ho = await as.wh!.get(`${API}/warehouse/receipts?branchId=${ids.ho}`);
    expect(ho.statusCode === 403 || (ho.statusCode === 200 && j(ho).items.length === 0)).toBe(true);
    // A15 there is no company switching: a client-named company is not part of any contract.
    const beta = await createActiveCompany(h.db, { name: 'Beta', departments: ['SALES'] });
    expect(code(await as.sales!.post(`${C}/context/branch`, { branchId: beta.headOfficeId }))).toBe(
      'BRANCH_NOT_FOUND',
    );
    expect(
      (
        await as.sales!.post(`${API}/sales/orders`, {
          customerId: ids.cus,
          companyId: beta.companyId,
          lines: [],
        })
      ).statusCode,
    ).toBe(400);
    expect(j(await as.sales!.get(`${C}/context?companyId=${beta.companyId}`)).company?.id).not.toBe(
      beta.companyId,
    );
  });

  it('A12: a forged department in the payload or path never widens access', async () => {
    expect(
      (
        await as.sales!.post(`${API}/sales/orders`, {
          customerId: ids.cus,
          department: 'WAREHOUSE',
          lines: [],
        })
      ).statusCode,
    ).toBe(400);
    // Raising a purchase request is allowed from the person's own department only.
    expect(
      code(
        await as.sales!.post(`${API}/purchase-requests`, {
          department: 'WAREHOUSE',
          purpose: 'forged',
          lines: [{ type: 'ITEM', itemId: ids.rm2, quantity: '1' }],
        }),
      ),
    ).toBe('DEPARTMENT_NOT_ALLOWED');
    // Nobody changes their own department.
    expect(
      code(
        await as.sales!.put(
          `${C}/current/members/${member['sales.demo@pdabliss.com']}/departments`,
          {
            departments: ['WAREHOUSE'],
          },
        ),
      ),
    ).toBe('FORBIDDEN');
  });

  it('A13/A14: reassignment, role removal, DENY, branch change and deactivation take effect on the open session at once', async () => {
    const s = as.sales!;
    const email = 'sales.demo@pdabliss.com';
    const salesList = () => s.get(`${API}/sales/orders`);
    expect((await salesList()).statusCode).toBe(200);

    // Department reassignment: Sales work closes, Warehouse reads open — same session.
    expect((await put(email, { departments: ['WAREHOUSE'] })).statusCode).toBe(200);
    expect((await salesList()).statusCode).toBe(403);
    expect((await s.get(`${API}/warehouse/stock`)).statusCode).toBe(200);
    // …and the reassigned person sees no money on any Warehouse read (A18 read-model leakage).
    const leaks: string[] = [];
    for (const r of routes.filter(
      (x) => x.method === 'GET' && x.path.startsWith('/api/v1/warehouse'),
    )) {
      const res = await s.get(urlWith(ids, r.path));
      if (res.statusCode < 300 && /987654|876543/.test(res.body)) leaks.push(r.path);
    }
    expect(leaks).toEqual([]);
    // Removing the department removes all operational access.
    expect((await put(email, { departments: [] })).statusCode).toBe(200);
    expect(j(await s.get(`${C}/context`)).assignment).toEqual({
      status: 'UNASSIGNED',
      department: null,
    });
    expect((await s.get(`${API}/warehouse/stock`)).statusCode).toBe(403);
    expect((await put(email, { departments: ['SALES'] })).statusCode).toBe(200);
    expect((await salesList()).statusCode).toBe(200);

    // Role removal: Staff → Viewer closes creating at once.
    const create = () =>
      s.post(`${API}/sales/orders`, {
        customerId: ids.cus,
        lines: [{ itemId: ids.fg2, quantity: '1', unitPrice: '1', taxRate: '7' }],
      });
    await as.owner!.patch(`${C}/current/members/${member[email]}`, { role: 'VIEWER' });
    expect((await create()).statusCode).toBe(403);
    await as.owner!.patch(`${C}/current/members/${member[email]}`, { role: 'DEPARTMENT_STAFF' });

    // Permission removal (DENY exception).
    await as.owner!.put(`${C}/current/members/${member[email]}/permissions`, {
      changes: [{ permission: 'sales.orders.create', effect: 'DENY' }],
    });
    expect((await create()).statusCode).toBe(403);
    await as.owner!.put(`${C}/current/members/${member[email]}/permissions`, {
      changes: [{ permission: 'sales.orders.create', effect: null }],
    });
    expect((await create()).statusCode).toBe(201);

    // Branch scope change: the chosen branch is no longer allowed → the context is dropped.
    await as.owner!.put(`${C}/current/members/${member[email]}/branches`, {
      branchScope: 'SELECTED_BRANCHES',
      branchIds: [ids.ho],
    });
    // The removed branch is never used again: the person's only remaining branch stands in
    // (EP40-02: only when no branch is left to choose between).
    const moved = await create();
    expect(moved.statusCode, moved.body).toBe(201);
    expect(j(moved).order.branch.code).toBe('00000');
    await as.owner!.put(`${C}/current/members/${member[email]}/branches`, {
      branchScope: 'SELECTED_BRANCHES',
      branchIds: [ids.ho, ids.branch],
    });
    await s.post(`${C}/context/branch`, { branchId: ids.branch });

    // A14 membership deactivation: every request refused, nothing kept from before.
    await as.owner!.post(`${C}/current/members/${member[email]}/deactivate`);
    expect(code(await salesList())).toBe('MEMBERSHIP_INACTIVE');
    expect(code(await s.get(`${C}/context`))).toBe('MEMBERSHIP_INACTIVE');
    await as.owner!.post(`${C}/current/members/${member[email]}/reactivate`);
    await s.post(`${C}/context/branch`, { branchId: ids.branch });
    expect((await salesList()).statusCode).toBe(200);

    // Logout ends the session: the same cookie gets nothing.
    const cookie = new Map(s.cookies);
    await s.post('/api/v1/auth/logout');
    const replay = new Browser(h.app);
    for (const [k, v] of cookie) replay.cookies.set(k, v);
    expect((await replay.get(`${API}/sales/orders`)).statusCode).toBe(401);
    as.sales = await persona(email);
  });

  it('A19: an owner override needs a reason and the owner; a non-owner cannot use one', async () => {
    const so = j(
      await as.owner!.post(`${API}/sales/orders`, {
        customerId: ids.cus,
        lines: [{ itemId: ids.fg2, quantity: '1', unitPrice: '290', taxRate: '7' }],
      }),
    ).order.id;
    await as.owner!.post(`${API}/sales/orders/${so}/submit`);
    expect(code(await as.owner!.post(`${API}/sales/orders/${so}/confirm`))).toBe(
      'SELF_APPROVAL_NOT_ALLOWED',
    );
    expect(
      code(await as.owner!.post(`${API}/sales/orders/${so}/confirm`, { ownerOverride: {} })),
    ).toBe('VALIDATION_FAILED');
    expect(
      code(
        await as.owner!.post(`${API}/sales/orders/${so}/confirm`, {
          ownerOverride: { reason: '' },
        }),
      ),
    ).toBe('VALIDATION_FAILED');
    expect((await h.db.salesOrder.findUniqueOrThrow({ where: { id: so } })).status).toBe(
      'SUBMITTED',
    );
    // A department manager deciding their own request cannot borrow the owner's override.
    const pr = j(
      await as.pur!.post(`${API}/purchase-requests`, {
        department: 'PURCHASING',
        purpose: 'EP45 own request',
        lines: [{ type: 'ITEM', itemId: ids.rm2, quantity: '2' }],
      }),
    ).request.id;
    await as.pur!.post(`${API}/purchase-requests/${pr}/submit`);
    expect(
      code(
        await as.pur!.post(`${API}/purchase-requests/${pr}/approve`, {
          ownerOverride: { reason: 'I would like to approve this myself' },
        }),
      ),
    ).toBe('OVERRIDE_NOT_ALLOWED');
  });

  it('A18: Warehouse personas receive no price, cost or total on any read route', async () => {
    const MONEY_KEY =
      /"(?!total")[a-zA-Z]*([pP]rice|[aA]mount|[tT]otal|[dD]iscount|[cC]ost|[mM]argin|[dD]eposit|[pP]ayment)[a-zA-Z]*":\s*("|-?\d)/;
    const bad: string[] = [];
    for (const who of ['wh', 'staff'])
      for (const r of routes.filter((x) => x.method === 'GET' && x.path.startsWith('/api/v1/'))) {
        // Public catalog routes (the package price list) are not company data.
        if (/^\/api\/v1\/(auth|demo|platform)\/|^\/api\/v1\/(packages)?$/.test(r.path)) continue;
        const res = await as[who]!.get(urlWith(ids, r.path));
        if (res.statusCode >= 500) bad.push(`${who} ${res.statusCode} ${r.path}`);
        if (res.statusCode >= 300) continue;
        if (/987654|876543/.test(res.body)) bad.push(`${who} SENTINEL ${r.path}`);
        const key = MONEY_KEY.exec(res.body)?.[0];
        if (key) bad.push(`${who} KEY ${key} ${r.path}`);
      }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
