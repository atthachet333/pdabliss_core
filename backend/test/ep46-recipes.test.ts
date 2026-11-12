import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapPlatform, parseSeedEnv, seedDemo } from '../src/auth/bootstrap.js';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { DEMO_PERSONAS } from '../src/demo/personas.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { isRoleDefault, permissionDefinition } from '../src/permissions/catalog.js';
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
 * EP46 — optional BOM manufacturing and confidential recipes
 * (docs/EP46_MANUFACTURING_POLICY.md, docs/EP46_RECIPE_CONFIDENTIALITY_MATRIX.md,
 * docs/EP46_SECURITY_TEST_MATRIX.md). Case numbers R1 … R15 are the EP46 brief's.
 *
 * The seeded demo world plus an Operations Staff member and an Operations Viewer in the demo
 * branch (no recipe access by default). A recipe revision with a distinctive line quantity
 * (0.137 kg) is the sentinel: it must never reach a member without operations.recipes.view.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const API = '/api/v1';
const P = `${API}/production`;
const idOf = (b: J): string =>
  b?.order?.id ?? b?.issue?.id ?? b?.output?.id ?? b?.report?.id ?? b?.receipt?.id ?? b?.bom?.id;

const SENTINEL = '0.137';
const RECIPE_KEY = /"(bomQuantity|bomOutputQuantity|outputQuantity)":\s*("|-?\d)/;

describe('EP46 permission catalog', () => {
  it('operations.recipes.view is confidential: Owner and Operations Managers by default, nobody else', () => {
    const def = permissionDefinition('operations.recipes.view');
    expect(def).toMatchObject({ namespace: 'OPERATIONS', scope: 'COMPANY', confidential: true });
    const roles: [CompanyRole, boolean][] = [
      ['COMPANY_OWNER', true],
      ['DEPARTMENT_MANAGER', true],
      ['DEPARTMENT_STAFF', false],
      ['VIEWER', false],
      ['EXECUTIVE', false],
      ['SYSTEM_ADMIN', false],
    ];
    for (const [role, expected] of roles)
      expect(isRoleDefault(role, 'operations.recipes.view'), role).toBe(expected);
    // Routine production codes are unchanged.
    expect(isRoleDefault('DEPARTMENT_STAFF', 'operations.orders.create')).toBe(true);
    expect(isRoleDefault('DEPARTMENT_STAFF', 'operations.bom.view')).toBe(true);
  });
});

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

describeDb('EP46 optional BOM and confidential recipes (demo world)', () => {
  let h: Harness;
  let routes: Route[];
  const as: Record<string, Browser> = {};
  const ids: Record<string, string> = {};
  const member: Record<string, string> = {};
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const plus = (n: number) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  const marker = async (key: string) =>
    (await h.db.auditLog.findFirstOrThrow({ where: { changes: { path: ['demo'], equals: key } } }))
      .entityId;
  const select = async (b: Browser, branch = '00001') => {
    const ctx = j(await b.get(`${API}/company/context`));
    const target = ctx.branches?.find((x: J) => x.code === branch);
    if (target && ctx.selected?.code !== branch && !ctx.blocked)
      await b.post(`${API}/company/context/branch`, { branchId: target.id });
    return b;
  };
  const persona = async (email: string, branch = '00001') => {
    const b = new Browser(h.app);
    const res = await b.post(`${API}/auth/login`, { email, password: passwordOf(email) });
    expect(res.statusCode, res.body).toBe(200);
    return select(b, branch);
  };
  /** An extra Operations member of the demo company, demo branch only. */
  const operationsMember = async (email: string, role: CompanyRole) => {
    const companyId = (await h.db.branch.findFirstOrThrow({ where: { code: '00001' } })).companyId;
    const u = await createUser(h.db, email, { companyRole: role, companyId });
    const m = await h.db.companyMember.findUniqueOrThrow({ where: { userId: u.id } });
    const dept: DepartmentCode = 'OPERATIONS';
    const d = await h.db.department.findFirstOrThrow({ where: { companyId, code: dept } });
    await h.db.membership.create({ data: { userId: u.id, companyId, departmentId: d.id } });
    await h.db.companyMember.update({
      where: { id: m.id },
      data: {
        branchScope: 'SELECTED_BRANCHES',
        branchAccess: { create: [{ branchId: ids.branch! }] },
      },
    });
    member[email] = m.id;
    return select(await signIn(h, email));
  };
  const ok = (res: ApiResponse, label: string, status = [200, 201]) => {
    expect(status, `${label}: ${res.body}`).toContain(res.statusCode);
    return j(res);
  };
  const integrity = async () => {
    const sql = readFileSync('../uat/integrity.sql', 'utf8');
    const [row] = await h.db.$queryRawUnsafe<Record<string, bigint>[]>(sql);
    return Object.entries(row!)
      .filter(([k, v]) => !['movements', 'balances'].includes(k) && Number(v) !== 0)
      .map(([k]) => k);
  };
  const setMode = (b: Browser, manufacturingMode: string) =>
    b.patch(`${API}/company/current/settings`, { manufacturingMode });

  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'true' });
    await resetDb(h.db);
    const env = parseSeedEnv(ENV);
    await bootstrapPlatform(h.db, env);
    await seedDemo(h.db, env);
    routes = routesOf(h);
    const item = async (c: string) => (await h.db.item.findFirstOrThrow({ where: { code: c } })).id;
    Object.assign(ids, {
      branch: (await h.db.branch.findFirstOrThrow({ where: { code: '00001' } })).id,
      FG1: await item('FG-000001'),
      FG2: await item('FG-000002'),
      FG3: await item('FG-000003'),
      RM1: await item('RM-000001'),
      RM2: await item('RM-000002'),
      RM3: await item('RM-000003'),
      PK1: await item('PK-000001'),
      PK2: await item('PK-000002'),
      released: await marker('MO_EXEC'),
    });
    ids.MAIN = (
      await h.db.warehouseLocation.findFirstOrThrow({
        where: { code: 'MAIN', branch: { code: '00001' } },
      })
    ).id;
    for (const [k, email] of [
      ['owner', 'owner.demo@pdabliss.com'],
      ['admin', 'admin.demo@pdabliss.com'],
      ['exec', 'executive.demo@pdabliss.com'],
      ['opm', 'operations.demo@pdabliss.com'],
      ['wh', 'warehouse.demo@pdabliss.com'],
      ['pur', 'purchasing.demo@pdabliss.com'],
      ['sales', 'sales.demo@pdabliss.com'],
    ] as const)
      as[k] = await persona(email);
    as.acc = await persona('accounting.demo@pdabliss.com', '00000');
    ids.branch = (await h.db.branch.findFirstOrThrow({ where: { code: '00001' } })).id;
    as.ops = await operationsMember('ops.staff@demo.example', 'DEPARTMENT_STAFF');
    as.viewer = await operationsMember('ops.viewer@demo.example', 'VIEWER');
    // The sentinel recipe: a new ACTIVE revision of FG-000003, made by the owner.
    const bom = ok(
      await as.owner!.post(`${P}/boms`, {
        itemId: ids.FG3,
        outputQuantity: '1',
        lines: [
          { itemId: ids.RM3, quantity: SENTINEL },
          { itemId: ids.PK2, quantity: '1' },
        ],
      }),
      'BOM create',
    ).bom;
    ok(await as.owner!.post(`${P}/boms/${bom.id}/activate`), 'BOM activate');
    ids.bom = bom.id;
    // An unreleased order planned from it (Operations staff plan, nobody approves yet).
    const mo = ok(
      await as.ops.post(`${P}/orders`, { itemId: ids.FG3, quantity: '3' }),
      'MO create',
    ).order;
    ok(await as.ops.post(`${P}/orders/${mo.id}/submit`), 'MO submit');
    ids.unreleased = mo.id;
  }, 300_000);
  afterAll(async () => h?.close());

  // ---------------------------------------------------------------- recipe confidentiality

  it('R1: Operations Staff / Viewer cannot read a recipe; a Manager and the owner can', async () => {
    for (const k of ['ops', 'viewer']) {
      const r = await as[k]!.get(`${P}/boms/${ids.bom}`);
      expect(r.statusCode, k).toBe(403);
      expect(r.body).not.toContain(SENTINEL);
      expect(code(r)).toBe('PERMISSION_DENIED');
      // The catalogue stays usable — identity only.
      const list = j(await as[k]!.get(`${P}/boms?itemId=${ids.FG3}`));
      expect(list.recipes).toBe(false);
      for (const row of list.items)
        expect([row.outputQuantity, row.lineCount]).toEqual([null, null]);
      expect(code(await as[k]!.get(`${P}/requirements/preview?bomId=${ids.bom}&quantity=3`))).toBe(
        'PERMISSION_DENIED',
      );
    }
    for (const k of ['opm', 'owner']) {
      const r = await as[k]!.get(`${P}/boms/${ids.bom}`);
      expect(r.statusCode, k).toBe(200);
      expect(j(r).bom.lines.map((l: J) => l.quantity)).toContain('0.137');
      expect(r.headers['cache-control']).toBe('no-store');
    }
  });

  it('R1/R7: an unreleased BOM order shows staff what they need — items and state — never the quantities', async () => {
    const staff = j(await as.ops!.get(`${P}/orders/${ids.unreleased}`)).order;
    expect(staff.quantitiesHidden).toBe(true);
    expect(staff.bomOutputQuantity).toBeNull();
    expect(staff.materials.map((m: J) => m.item.code)).toEqual(['RM-000003', 'PK-000002']);
    for (const m of staff.materials) {
      expect(m.state).not.toBeUndefined();
      for (const f of [
        'bomQuantity',
        'exact',
        'required',
        'available',
        'shortage',
        'reserved',
        'issued',
        'used',
      ])
        expect(m[f], f).toBeNull();
    }
    // The planner (recipe holder) sees everything.
    const mgr = j(await as.opm!.get(`${P}/orders/${ids.unreleased}`)).order;
    expect(mgr.quantitiesHidden).toBe(false);
    expect(mgr.materials[0]).toMatchObject({ bomQuantity: '0.137', required: '0.411' });
    // A released order: the batch quantities are operational, the recipe fields are not.
    const rel = j(await as.ops!.get(`${P}/orders/${ids.released}`)).order;
    expect(rel.quantitiesHidden).toBe(false);
    expect(rel.bomOutputQuantity).toBeNull();
    for (const m of rel.materials) {
      expect(m.bomQuantity).toBeNull();
      expect(m.required).not.toBeNull();
    }
  });

  it('R2: guessed recipe ids answer exactly like real ones (403 before any lookup)', async () => {
    const real = await as.ops!.get(`${P}/boms/${ids.bom}`);
    const fake = await as.ops!.get(`${P}/boms/cm0000000000000000000000000`);
    const strip = (r: ApiResponse) => ({ ...j(r).error, requestId: undefined });
    expect([real.statusCode, fake.statusCode]).toEqual([403, 403]);
    expect(strip(real)).toEqual(strip(fake));
    const p1 = await as.ops!.get(`${P}/requirements/preview?bomId=${ids.bom}&quantity=1`);
    const p2 = await as.ops!.get(
      `${P}/requirements/preview?bomId=cm0000000000000000000000000&quantity=1`,
    );
    expect(strip(p1)).toEqual(strip(p2));
  });

  it('R3/R4/R8: no route — list, detail, search, handoff, summary — gives the recipe to anyone without recipe access', async () => {
    expect(
      routes.filter((r) => /export|csv|download|print/i.test(r.path)).map((r) => r.path),
    ).toEqual([]);
    const bad: string[] = [];
    let opmHit = false;
    for (const who of ['ops', 'viewer', 'exec', 'wh', 'pur', 'sales', 'acc', 'admin', 'opm']) {
      for (const r of routes.filter((x) => x.method === 'GET')) {
        if (/^\/api\/v1\/(auth|demo|platform)\/|^\/api\/v1\/?$|^\/health/.test(r.path)) continue;
        let url = urlWith({ ...ids, bom: ids.bom, mo: ids.unreleased }, r.path);
        if (r.path.endsWith('/requirements/preview')) url += `?bomId=${ids.bom}&quantity=3`;
        if (r.path.endsWith('/boms')) url += `?itemId=${ids.FG3}`;
        const res = await as[who]!.get(url);
        if (res.statusCode >= 500) bad.push(`${who} ${res.statusCode} ${r.path}`);
        if (res.statusCode >= 300) continue;
        const leak = res.body.includes(SENTINEL) || RECIPE_KEY.test(res.body);
        if (who === 'opm') opmHit ||= leak;
        else if (leak) bad.push(`${who} ${r.path} ${RECIPE_KEY.exec(res.body)?.[0] ?? SENTINEL}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
    // Sanity: the sweep would see the recipe where it is allowed.
    expect(opmHit).toBe(true);
  });

  it('R5: other companies and other branches reach no recipe', async () => {
    const beta = await createActiveCompany(h.db, { name: 'Beta', departments: ['OPERATIONS'] });
    await createUser(h.db, 'owner@beta.example', {
      companyRole: 'COMPANY_OWNER',
      companyId: beta.companyId,
    });
    const b = await signIn(h, 'owner@beta.example');
    expect((await b.get(`${P}/boms/${ids.bom}`)).statusCode).toBe(404);
    expect((await b.get(`${P}/requirements/preview?bomId=${ids.bom}&quantity=1`)).statusCode).toBe(
      404,
    );
    expect(j(await b.get(`${P}/boms`)).items).toEqual([]);
    expect((await b.get(`${P}/orders/${ids.unreleased}`)).statusCode).toBe(404);
    // Accounting works at the Head Office only and has no Operations department at all.
    expect((await as.acc!.get(`${P}/boms`)).statusCode).toBe(403);
  });

  it('R6/R7: System Admin reaches no recipe; Executive reads the catalogue only and changes nothing', async () => {
    for (const url of [`${P}/boms`, `${P}/boms/${ids.bom}`, `${P}/orders/${ids.unreleased}`])
      expect((await as.admin!.get(url)).statusCode, url).toBe(403);
    expect((await as.exec!.get(`${P}/boms`)).statusCode).toBe(200);
    expect((await as.exec!.get(`${P}/boms/${ids.bom}`)).statusCode).toBe(403);
    const before = await h.db.productionBom.count();
    for (const [m, url, body] of [
      ['POST', `${P}/boms`, { itemId: ids.FG3, outputQuantity: '1', lines: [] }],
      ['PATCH', `${P}/boms/${ids.bom}`, { note: 'x' }],
      ['POST', `${P}/boms/${ids.bom}/retire`, { reason: 'x' }],
      ['POST', `${P}/boms/${ids.bom}/revise`, {}],
      ['PUT', `${P}/orders/${ids.unreleased}/materials`, { lines: [] }],
    ] as const)
      expect((await as.exec!.request(m, url, body)).statusCode, url).toBe(403);
    expect(await h.db.productionBom.count()).toBe(before);
    // A BOM manager without recipe access cannot edit what it cannot see.
    expect(j(await as.exec!.get(`${API}/production/context`)).bom).toMatchObject({ manage: false });
  });

  it('R11: EP45 still holds — other departments reach no production data, and a recipe ALLOW cannot cross departments', async () => {
    for (const k of ['sales', 'wh', 'pur'])
      for (const url of [`${P}/boms`, `${P}/orders`])
        expect((await as[k]!.get(url)).statusCode, `${k} ${url}`).toBe(403);
    const res = await as.owner!.put(
      `${API}/company/current/members/${await memberOf('sales.demo@pdabliss.com')}/permissions`,
      { changes: [{ permission: 'operations.recipes.view', effect: 'ALLOW' }] },
    );
    expect(code(res)).toBe('PERMISSION_NOT_ELIGIBLE');
    expect(j(res).error.details.reason).toBe('NOT_ASSIGNED');
  });

  const memberOf = async (email: string) =>
    (
      await h.db.companyMember.findFirstOrThrow({
        where: { user: { emailNormalized: email } },
      })
    ).id;

  it('R12: granting and revoking recipe access applies to open sessions at once', async () => {
    const staffId = member['ops.staff@demo.example']!;
    const set = (effect: 'ALLOW' | 'DENY' | null, memberId = staffId) =>
      as.owner!.put(`${API}/company/current/members/${memberId}/permissions`, {
        changes: [{ permission: 'operations.recipes.view', effect }],
      });
    expect((await set('ALLOW')).statusCode).toBe(200);
    expect((await as.ops!.get(`${P}/boms/${ids.bom}`)).statusCode).toBe(200);
    expect(j(await as.ops!.get(`${P}/orders/${ids.unreleased}`)).order.quantitiesHidden).toBe(
      false,
    );
    expect((await set(null)).statusCode).toBe(200);
    expect((await as.ops!.get(`${P}/boms/${ids.bom}`)).statusCode).toBe(403);
    // A DENY closes even a manager's default.
    const opm = await memberOf('operations.demo@pdabliss.com');
    expect((await set('DENY', opm)).statusCode).toBe(200);
    expect((await as.opm!.get(`${P}/boms/${ids.bom}`)).statusCode).toBe(403);
    expect(j(await as.opm!.get(`${P}/orders/${ids.unreleased}`)).order.quantitiesHidden).toBe(true);
    expect((await set(null, opm)).statusCode).toBe(200);
    expect((await as.opm!.get(`${P}/boms/${ids.bom}`)).statusCode).toBe(200);
  });

  it('R15: an active recipe cannot be changed — not by the API, not by SQL', async () => {
    expect(code(await as.owner!.patch(`${P}/boms/${ids.bom}`, { note: 'changed' }))).toBe(
      'BOM_NOT_EDITABLE',
    );
    await expect(
      h.db.$executeRawUnsafe(
        `UPDATE "ProductionBomLine" SET "quantity" = 9 WHERE "bomId" = $1`,
        ids.bom,
      ),
    ).rejects.toThrow();
    const line = await h.db.productionBomLine.findFirstOrThrow({
      where: { bomId: ids.bom, itemId: ids.RM3 },
    });
    expect(line.quantity.toString()).toBe('0.137');
  });

  // ---------------------------------------------------------------- manufacturing mode

  it('R10: only the owner changes the manufacturing mode; everyone else is refused and nothing changes', async () => {
    const settings = j(await as.owner!.get(`${API}/company/current/settings`));
    expect(settings).toMatchObject({
      manufacturingMode: 'BOM_REQUIRED',
      canChangeManufacturingMode: true,
    });
    expect(
      j(await as.admin!.get(`${API}/company/current/settings`)).canChangeManufacturingMode,
    ).toBe(false);
    expect(code(await setMode(as.admin!, 'BOM_OPTIONAL'))).toBe('OWNER_ONLY');
    for (const k of ['exec', 'opm', 'ops'])
      expect((await setMode(as[k]!, 'BOM_OPTIONAL')).statusCode, k).toBe(403);
    expect(code(await setMode(as.owner!, 'ANYTHING'))).toBe('VALIDATION_FAILED');
    expect(
      (await h.db.company.findFirstOrThrow({ where: { isDemo: true } })).manufacturingMode,
    ).toBe('BOM_REQUIRED');
    expect(await h.db.auditLog.count({ where: { action: 'MANUFACTURING_MODE_CHANGED' } })).toBe(0);
  });

  it('R9: a forged configuration is refused — BOM-required companies get no BOM-free order', async () => {
    expect(
      code(
        await as.ops!.post(`${P}/orders`, {
          itemId: ids.FG1,
          quantity: '1',
          materialPlan: 'MANUAL',
        }),
      ),
    ).toBe('BOM_REQUIRED_BY_POLICY');
    expect(
      (
        await as.ops!.post(`${P}/orders`, {
          itemId: ids.FG1,
          quantity: '1',
          manufacturingMode: 'BOM_OPTIONAL',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      code(await as.ops!.put(`${P}/orders/${ids.unreleased}/materials`, { lines: [] })),
    ).toBeDefined();
    // The database refuses it too, whatever the API (on a draft — later orders are frozen anyway).
    const company = await h.db.company.findFirstOrThrow({ where: { isDemo: true } });
    const draft = ok(
      await as.ops!.post(`${P}/orders`, { itemId: ids.FG2, quantity: '1' }),
      'draft',
    ).order;
    await expect(
      h.db.$executeRawUnsafe(
        `UPDATE "ProductionOrder" SET "materialPlan" = 'MANUAL', "bomId" = NULL, "bomCode" = NULL,
                "bomRevision" = NULL, "bomOutputQuantity" = NULL WHERE "id" = $1`,
        draft.id,
      ),
    ).rejects.toThrow(/manual material plan needs the BOM_OPTIONAL/);
    await h.db.company.update({
      where: { id: company.id },
      data: { manufacturingMode: 'BOM_OPTIONAL' },
    });
    // A MANUAL plan that still names a BOM is refused by the CHECK.
    await expect(
      h.db.$executeRawUnsafe(
        `UPDATE "ProductionOrder" SET "materialPlan" = 'MANUAL' WHERE "id" = $1`,
        draft.id,
      ),
    ).rejects.toThrow(/ProductionOrder_manual_plan_check|check constraint/);
    await h.db.company.update({
      where: { id: company.id },
      data: { manufacturingMode: 'BOM_REQUIRED' },
    });
    ok(await as.ops!.post(`${P}/orders/${draft.id}/cancel`, {}), 'discard draft');
  });

  it('BOM-optional end to end: explicit plan → reservation → issue → partial consumption → finished goods, ledger exact', async () => {
    const before = await h.db.stockMovement.count();
    expect((await setMode(as.owner!, 'BOM_OPTIONAL')).statusCode).toBe(200);
    expect(
      await h.db.auditLog.count({
        where: {
          action: 'MANUFACTURING_MODE_CHANGED',
          changes: { path: ['to'], equals: 'BOM_OPTIONAL' },
        },
      }),
    ).toBe(1);
    expect(j(await as.ops!.get(`${P}/context`)).manufacturingMode).toBe('BOM_OPTIONAL');
    // FG-000001 HAS an active BOM — the planner still chooses an explicit plan.
    const mo = ok(
      await as.ops!.post(`${P}/orders`, {
        itemId: ids.FG1,
        quantity: '10',
        materialPlan: 'MANUAL',
        plannedStartDate: today,
        requiredDate: plus(3),
      }),
      'manual MO',
    ).order;
    expect(mo).toMatchObject({ materialPlan: 'MANUAL', bom: null, materials: [] });
    // R13: an empty plan cannot be submitted; nothing is inferred from the BOM or the quantity.
    expect(code(await as.ops!.post(`${P}/orders/${mo.id}/submit`))).toBe('MATERIAL_PLAN_REQUIRED');
    const plan = (lines: J[]) => as.ops!.put(`${P}/orders/${mo.id}/materials`, { lines });
    for (const [lines, expected] of [
      [[{ itemId: ids.RM1, quantity: '0' }], 400],
      [[{ itemId: ids.RM1, quantity: '-1' }], 400],
      [[{ itemId: ids.RM1, quantity: '1.0005' }], 'QUANTITY_PRECISION'],
      [[{ itemId: ids.FG1, quantity: '1' }], 'BOM_SELF_REFERENCE'],
      [
        [
          { itemId: ids.RM1, quantity: '1' },
          { itemId: ids.RM1, quantity: '2' },
        ],
        'DUPLICATE_MATERIAL',
      ],
      [[{ itemId: 'cm0000000000000000000000000', quantity: '1' }], 'REFERENCE_NOT_FOUND'],
    ] as const) {
      const r = await plan(lines as unknown as J[]);
      if (typeof expected === 'number') expect(r.statusCode).toBe(expected);
      else expect(code(r)).toBe(expected);
    }
    const planned = ok(
      await plan([
        { itemId: ids.RM2, quantity: '2.5' },
        { itemId: ids.PK1, quantity: '10' },
      ]),
      'plan',
    ).order;
    expect(planned.materials.map((m: J) => [m.item.code, m.required, m.bomQuantity])).toEqual([
      ['RM-000002', '2.5', null],
      ['PK-000001', '10', null],
    ]);
    // A changed order quantity never rescales an explicit plan.
    const resized = ok(
      await as.ops!.patch(`${P}/orders/${mo.id}`, { quantity: '12' }),
      'resize',
    ).order;
    expect(resized.materials.map((m: J) => m.required)).toEqual(['2.5', '10']);
    ok(await as.ops!.patch(`${P}/orders/${mo.id}`, { quantity: '10' }), 'resize back');
    ok(await as.ops!.post(`${P}/orders/${mo.id}/submit`), 'submit');
    // Frozen once submitted.
    expect((await plan([{ itemId: ids.RM1, quantity: '1' }])).statusCode).toBe(409);
    // Independent approval still applies (the planner cannot approve; another manager can).
    ok(await as.opm!.post(`${P}/orders/${mo.id}/approve`), 'approve');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/materials/allocate`), 'allocate');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/release`), 'release');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/start`, { note: 'EP46' }), 'start');
    expect(await h.db.stockMovement.count()).toBe(before);
    // Staff draft the issue from the reservations; the manager posts it (once).
    const issue = idOf(
      ok(await as.ops!.post(`${P}/issues`, { productionOrderId: mo.id, note: 'EP46' }), 'issue'),
    );
    const posts = await Promise.all([
      as.opm!.post(`${P}/issues/${issue}/post`),
      as.opm!.post(`${P}/issues/${issue}/post`),
    ]);
    expect(posts.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const consumption = await h.db.stockMovement.findMany({
      where: { type: 'PRODUCTION_CONSUMPTION', productionMaterialIssueId: issue },
    });
    expect(consumption.reduce((t, m) => t + Number(m.quantityDelta), 0)).toBe(-12.5);
    // R13: actual usage — explicit, positive, of the order's own materials only.
    const mats = j(await as.ops!.get(`${P}/orders/${mo.id}`)).order.materials as J[];
    const rm = mats.find((m) => m.item.code === 'RM-000002')!;
    const pk = mats.find((m) => m.item.code === 'PK-000001')!;
    expect(
      (await as.ops!.post(`${P}/orders/${mo.id}/usage`, { materialId: rm.id, quantity: '-1' }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await as.ops!.post(`${P}/orders/${mo.id}/usage`, {
          materialId: 'cm0000000000000000000000000',
          quantity: '1',
        })
      ).statusCode,
    ).toBeGreaterThanOrEqual(400);
    ok(
      await as.ops!.post(`${P}/orders/${mo.id}/usage`, {
        materialId: rm.id,
        quantity: '2.4',
        note: null,
      }),
      'usage rm',
    );
    ok(
      await as.ops!.post(`${P}/orders/${mo.id}/usage`, {
        materialId: pk.id,
        quantity: '10',
        note: null,
      }),
      'usage pk',
    );
    const after = j(await as.ops!.get(`${P}/orders/${mo.id}`)).order.materials as J[];
    expect(after.find((m) => m.item.code === 'RM-000002')).toMatchObject({
      issued: '2.5',
      used: '2.4',
      usageVariance: '-0.1',
      unrecorded: '0.1',
    });
    // Output, quality decision, finished goods (posted once), completion.
    const out = idOf(
      ok(
        await as.ops!.post(`${P}/outputs`, {
          productionOrderId: mo.id,
          productionDate: today,
          goodQuantity: '10',
          defectiveQuantity: '0',
          note: 'EP46',
        }),
        'output',
      ),
    );
    ok(await as.ops!.post(`${P}/outputs/${out}/submit`), 'output submit');
    ok(await as.opm!.post(`${P}/outputs/${out}/accept`, {}), 'output accept');
    const fgr = idOf(
      ok(
        await as.wh!.post(`${API}/warehouse/finished-goods/receipts`, {
          outputReportId: out,
          lines: [
            {
              locationId: ids.MAIN,
              quantity: '10',
              lotNumber: 'EP46-BF-1',
              expiryDate: plus(365),
              manufacturedDate: today,
            },
          ],
          note: null,
        }),
        'FG receipt',
      ),
    );
    const fgPosts = await Promise.all([
      as.owner!.post(`${API}/warehouse/finished-goods/receipts/${fgr}/post`),
      as.owner!.post(`${API}/warehouse/finished-goods/receipts/${fgr}/post`),
    ]);
    expect(fgPosts.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      await h.db.stockMovement.count({
        where: { type: 'PRODUCTION_OUTPUT', productionGoodsReceiptId: fgr },
      }),
    ).toBe(1);
    ok(await as.opm!.post(`${P}/orders/${mo.id}/review`, {}), 'review');
    const done = ok(
      await as.opm!.post(`${P}/orders/${mo.id}/complete`, {
        outcome: 'COMPLETED',
        materialsReviewed: true,
      }),
      'complete',
    ).order;
    expect(done.status).toBe('COMPLETED');
    expect(await integrity()).toEqual([]);
  });

  it('BOM-optional: cancellation releases the reservation; a shortage is reported, never over-reserved', async () => {
    const mo = ok(
      await as.ops!.post(`${P}/orders`, { itemId: ids.FG2, quantity: '5', materialPlan: 'MANUAL' }),
      'MO',
    ).order;
    ok(
      await as.ops!.put(`${P}/orders/${mo.id}/materials`, {
        lines: [{ itemId: ids.RM1, quantity: '999' }],
      }),
      'plan',
    );
    ok(await as.ops!.post(`${P}/orders/${mo.id}/submit`), 'submit');
    ok(await as.opm!.post(`${P}/orders/${mo.id}/approve`), 'approve');
    const alloc = ok(await as.opm!.post(`${P}/orders/${mo.id}/materials/allocate`), 'allocate');
    expect(Number(alloc.allocation.materials[0].shortage)).toBeGreaterThan(0);
    expect(code(await as.opm!.post(`${P}/orders/${mo.id}/release`))).toBeDefined();
    expect(await integrity()).toEqual([]);
    ok(await as.opm!.post(`${P}/orders/${mo.id}/cancel`, { reason: 'EP46 shortage' }), 'cancel');
    expect(
      await h.db.productionMaterialAllocation.count({
        where: { productionOrderId: mo.id, status: 'ACTIVE' },
      }),
    ).toBe(0);
    expect(await integrity()).toEqual([]);
  });

  it('back to BOM-required: a BOM-free draft cannot be submitted, an order already in progress continues', async () => {
    const draft = ok(
      await as.ops!.post(`${P}/orders`, { itemId: ids.FG2, quantity: '1', materialPlan: 'MANUAL' }),
      'draft',
    ).order;
    ok(
      await as.ops!.put(`${P}/orders/${draft.id}/materials`, {
        lines: [{ itemId: ids.PK2, quantity: '1' }],
      }),
      'plan',
    );
    const running = ok(
      await as.ops!.post(`${P}/orders`, { itemId: ids.FG2, quantity: '1', materialPlan: 'MANUAL' }),
      'running',
    ).order;
    ok(
      await as.ops!.put(`${P}/orders/${running.id}/materials`, {
        lines: [{ itemId: ids.PK2, quantity: '1' }],
      }),
      'plan2',
    );
    ok(await as.ops!.post(`${P}/orders/${running.id}/submit`), 'submit2');
    ok(await as.opm!.post(`${P}/orders/${running.id}/approve`), 'approve2');
    expect((await setMode(as.owner!, 'BOM_REQUIRED')).statusCode).toBe(200);
    expect(code(await as.ops!.post(`${P}/orders/${draft.id}/submit`))).toBe(
      'BOM_REQUIRED_BY_POLICY',
    );
    // The draft can go back to its BOM (the item's active revision).
    const back = ok(
      await as.ops!.patch(`${P}/orders/${draft.id}`, { materialPlan: 'BOM' }),
      'back to BOM',
    ).order;
    expect(back.materialPlan).toBe('BOM');
    expect(back.bom).not.toBeNull();
    // Approved work keeps its plan.
    ok(await as.opm!.post(`${P}/orders/${running.id}/materials/allocate`), 'allocate2');
    ok(await as.opm!.post(`${P}/orders/${running.id}/release`), 'release2');
    expect(await integrity()).toEqual([]);
  });

  it('BOM-required unchanged: the existing demo BOM flow still plans from the active revision', async () => {
    const mo = ok(
      await as.opm!.post(`${P}/orders`, { itemId: ids.FG2, quantity: '4' }),
      'MO',
    ).order;
    expect(mo.materialPlan).toBe('BOM');
    expect(mo.materials.map((m: J) => [m.item.code, m.bomQuantity, m.required])).toEqual([
      ['RM-000002', '0.05', '0.2'],
      ['PK-000002', '1', '4'],
    ]);
  });
});
