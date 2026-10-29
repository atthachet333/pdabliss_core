import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { Prisma } from '../src/generated/prisma/client.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { masterCapabilities } from '../src/master-data/access.js';
import { formatCode, isReservedCode } from '../src/master-data/codes.js';
import { trackingProblem } from '../src/master-data/policy.js';
import { PERMISSION_CATALOG } from '../src/permissions/catalog.js';
import { effectivePermissions, type PermissionInputs } from '../src/permissions/resolver.js';
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
 * EP28 operational master data: canonical customers, suppliers, items,
 * units, categories (company-scoped) and warehouse locations
 * (branch-scoped) — permissions through the EP27 resolver, company
 * isolation (IDOR + database foreign keys), atomic code generation under
 * concurrency, the lifecycle, the structure policy, Warehouse privacy and
 * the audit trail.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;

const MD = '/api/v1/master-data';
const FINANCIAL = /cost|price|margin|payment|financ|terms|credit|balance|bank|revenue/i;

// ------------------------------------------------------------------ static

describe('Master data contracts (EP28)', () => {
  it('adds domain-aware codes: company-scoped records, branch-scoped locations, no financial notion', () => {
    const byCode = new Map(PERMISSION_CATALOG.map((p) => [p.code as string, p]));
    for (const c of [
      'sales.customers.view',
      'sales.customers.manage',
      'sales.items.view',
      'operations.items.view',
      'operations.items.manage',
      'warehouse.items.view',
      'purchasing.suppliers.view',
      'purchasing.suppliers.manage',
      'purchasing.items.view',
      'accounting.customers.view',
      'accounting.suppliers.view',
    ]) {
      expect(byCode.get(c)?.scope, c).toBe('COMPANY');
      expect(byCode.get(c)?.tier, c).toBe(c.endsWith('.view') ? 'READ' : 'MANAGE');
    }
    expect(byCode.get('warehouse.locations.view')?.scope).toBe('BRANCH');
    expect(byCode.get('warehouse.locations.manage')?.tier).toBe('MANAGE');
    expect(byCode.get('company.master_data.manage')?.namespace).toBe('COMPANY_ADMIN');
    // Warehouse never gets a supplier code.
    expect([...byCode.keys()].some((c) => /^warehouse\..*supplier/.test(c))).toBe(false);
  });

  it('gives Staff and Viewers views only; Managers manage their own domain; Owner / System Admin everything', () => {
    const caps = (role: CompanyRole, assigned: DepartmentCode[]) => {
      const inputs: PermissionInputs = {
        role,
        active: true,
        enabled: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
        assigned,
        executiveAllowed: true,
        overrides: [],
      };
      return masterCapabilities(effectivePermissions(inputs)).resources;
    };
    const staff = caps('DEPARTMENT_STAFF', ['WAREHOUSE']);
    expect(staff.items).toEqual({ view: true, manage: false });
    expect(staff.locations).toEqual({ view: true, manage: false });
    expect(staff.suppliers).toEqual({ view: false, manage: false });
    expect(staff.customers).toEqual({ view: false, manage: false });
    const viewer = caps('VIEWER', ['SALES', 'WAREHOUSE']);
    expect(Object.values(viewer).every((c) => !c.manage)).toBe(true);
    expect(viewer.customers.view && viewer.items.view).toBe(true);
    expect(caps('DEPARTMENT_MANAGER', ['SALES']).customers.manage).toBe(true);
    expect(caps('DEPARTMENT_MANAGER', ['SALES']).items.manage).toBe(false);
    expect(caps('DEPARTMENT_MANAGER', ['OPERATIONS']).units.manage).toBe(true);
    expect(caps('DEPARTMENT_MANAGER', ['PURCHASING']).suppliers.manage).toBe(true);
    const exec = caps('EXECUTIVE', []);
    expect(Object.values(exec).every((c) => c.view && !c.manage)).toBe(true);
    const admin = caps('SYSTEM_ADMIN', []);
    expect(Object.values(admin).every((c) => c.view && c.manage)).toBe(true);
  });

  it('master tables hold no financial column (nothing sensitive to leak to Warehouse)', () => {
    for (const fields of [
      Prisma.ItemScalarFieldEnum,
      Prisma.SupplierScalarFieldEnum,
      Prisma.CustomerScalarFieldEnum,
      Prisma.UnitScalarFieldEnum,
      Prisma.ItemCategoryScalarFieldEnum,
      Prisma.WarehouseLocationScalarFieldEnum,
    ]) {
      for (const f of Object.keys(fields)) expect(f).not.toMatch(FINANCIAL);
    }
  });

  it('tracking rules: NON_STOCK untracked, untracked has no lot / expiry, expiry needs lot', () => {
    const t = (over: Partial<Parameters<typeof trackingProblem>[0]>) =>
      trackingProblem({
        type: 'FINISHED_GOOD',
        inventoryTracked: true,
        lotTracking: 'NONE',
        expiryTracking: 'NONE',
        ...over,
      });
    expect(t({})).toBeNull();
    expect(t({ type: 'NON_STOCK' })).toBe('NON_STOCK_TRACKED');
    expect(t({ type: 'NON_STOCK', inventoryTracked: false })).toBeNull();
    expect(t({ inventoryTracked: false, lotTracking: 'OPTIONAL' })).toBe('UNTRACKED_LOT_OR_EXPIRY');
    expect(t({ expiryTracking: 'OPTIONAL' })).toBe('EXPIRY_NEEDS_LOT');
    expect(t({ expiryTracking: 'OPTIONAL', lotTracking: 'OPTIONAL' })).toBeNull();
    expect(t({ expiryTracking: 'REQUIRED', lotTracking: 'OPTIONAL' })).toBe('EXPIRY_NEEDS_LOT');
    expect(t({ expiryTracking: 'REQUIRED', lotTracking: 'REQUIRED' })).toBeNull();
  });

  it('codes: generated form, reserved range', () => {
    expect(formatCode('CUS', 1)).toBe('CUS-000001');
    expect(formatCode('FG', 1_234_567)).toBe('FG-1234567');
    expect(isReservedCode('CUS-000123', ['CUS'])).toBe(true);
    expect(isReservedCode('CUS-0001', ['CUS'])).toBe(false);
    expect(isReservedCode('FG-000009', ['RM', 'FG'])).toBe(true);
    expect(isReservedCode('LEGACY-1', ['CUS'])).toBe(false);
  });
});

// ------------------------------------------------------------- enforcement

describeDb('Operational master data (EP28)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const br: Record<'HO' | 'A' | 'B', string> = { HO: '', A: '', B: '' };
  const ids: Record<string, string> = {};

  const PEOPLE: [string, CompanyRole, 'A' | 'B', DepartmentCode[], ('A' | 'B')[] | null][] = [
    ['owner@a.example', 'COMPANY_OWNER', 'A', [], null],
    // A System Admin restricted to Branch A still administers every branch's locations.
    ['admin@a.example', 'SYSTEM_ADMIN', 'A', [], ['A']],
    ['exec@a.example', 'EXECUTIVE', 'A', [], null],
    ['sales.mgr@a.example', 'DEPARTMENT_MANAGER', 'A', ['SALES'], null],
    ['sales.staff@a.example', 'DEPARTMENT_STAFF', 'A', ['SALES'], null],
    ['ops.mgr@a.example', 'DEPARTMENT_MANAGER', 'A', ['OPERATIONS'], null],
    ['wh.staff@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['A']],
    ['wh.mgr@a.example', 'DEPARTMENT_MANAGER', 'A', ['WAREHOUSE'], ['A']],
    ['buy.mgr@a.example', 'DEPARTMENT_MANAGER', 'A', ['PURCHASING'], null],
    ['acct.staff@a.example', 'DEPARTMENT_STAFF', 'A', ['ACCOUNTING'], null],
    ['viewer@a.example', 'VIEWER', 'A', ['SALES', 'WAREHOUSE', 'OPERATIONS'], null],
    ['owner@b.example', 'COMPANY_OWNER', 'B', [], null],
  ];

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
      departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
    });
    B = await createActiveCompany(h.db, { name: 'Beta', departments: ['SALES', 'WAREHOUSE'] });
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
    for (const [email, role, co, depts, branches] of PEOPLE) {
      const companyId = co === 'A' ? A.companyId : B.companyId;
      const u = await createUser(h.db, email, { companyRole: role, companyId });
      const member = await h.db.companyMember.findUniqueOrThrow({ where: { userId: u.id } });
      ids[email] = member.id;
      for (const d of depts) {
        const dept = await h.db.department.findFirstOrThrow({ where: { companyId, code: d } });
        await h.db.membership.create({ data: { userId: u.id, departmentId: dept.id } });
      }
      if (branches) {
        await h.db.companyMember.update({
          where: { id: member.id },
          data: {
            branchScope: 'SELECTED_BRANCHES',
            branchAccess: { create: branches.map((b) => ({ branchId: br[b] })) },
          },
        });
      }
    }
  });

  const as = async (email: string) => signIn(h, email);
  const unit = async (b: Browser, c: string, precision = 0) =>
    j(await b.post(`${MD}/units`, { code: c, name: c, precision })).unit;

  // ---------------------------------------------------------------- customers

  it('customers: generated and entered codes, edit, search, filters, pages, lifecycle', async () => {
    const owner = await as('owner@a.example');
    const first = await owner.post(`${MD}/customers`, {
      name: 'บริษัท ตัวอย่าง จำกัด',
      taxId: '0-1055-12345-67-8',
      phone: '081-234-5678',
      email: 'buyer@example.com',
      contactName: 'Somchai',
      notes: 'PRIVATE NOTE CONTENT',
    });
    expect(first.statusCode, first.body).toBe(201);
    const c1 = j(first).customer;
    expect(c1).toMatchObject({
      code: 'CUS-000001',
      kind: 'BUSINESS',
      taxId: '0105512345678',
      phone: '+66812345678',
      status: 'ACTIVE',
    });
    expect(c1).not.toHaveProperty('companyId');
    expect(c1).not.toHaveProperty('createdById');
    expect(
      j(await owner.post(`${MD}/customers`, { name: 'Walk-in', kind: 'INDIVIDUAL' })).customer.code,
    ).toBe('CUS-000002');
    // An entered code is normalized; duplicates and the generated range are refused.
    expect(
      j(await owner.post(`${MD}/customers`, { name: 'Legacy', code: ' c-legacy/1 ' })).customer
        .code,
    ).toBe('C-LEGACY/1');
    const dup = await owner.post(`${MD}/customers`, { name: 'Again', code: 'C-LEGACY/1' });
    expect(dup.statusCode).toBe(409);
    expect(j(dup).error).toMatchObject({ code: 'DUPLICATE_VALUE', details: { field: 'code' } });
    expect(code(await owner.post(`${MD}/customers`, { name: 'X', code: 'CUS-000777' }))).toBe(
      'CODE_RESERVED',
    );
    // Server-owned fields are refused, not ignored.
    for (const extra of [
      { companyId: B.companyId },
      { status: 'INACTIVE' },
      { createdById: 'x' },
      { creditLimit: 1000 },
    ]) {
      expect((await owner.post(`${MD}/customers`, { name: 'Y', ...extra })).statusCode).toBe(400);
    }
    expect((await owner.post(`${MD}/customers`, { name: 'Y', email: 'not-mail' })).statusCode).toBe(
      400,
    );
    expect((await owner.post(`${MD}/customers`, { name: '   ' })).statusCode).toBe(400);

    // Edit: fields change, the code never does.
    const edit = await owner.patch(`${MD}/customers/${c1.id}`, {
      name: 'Example Co., Ltd.',
      email: '',
    });
    expect(edit.statusCode, edit.body).toBe(200);
    expect(j(edit).customer).toMatchObject({ name: 'Example Co., Ltd.', email: null });
    expect((await owner.patch(`${MD}/customers/${c1.id}`, { code: 'NEW' })).statusCode).toBe(400);

    // Server-side search (name, code, tax id as typed with dashes), filters, pages.
    const search = async (qs: string) => j(await owner.get(`${MD}/customers?${qs}`));
    expect((await search('q=example')).items.map((c: J) => c.code)).toEqual(['CUS-000001']);
    expect((await search('q=0-1055-12345')).total).toBe(1);
    expect((await search('q=legacy')).items[0].code).toBe('C-LEGACY/1');
    expect((await search('kind=INDIVIDUAL')).items.map((c: J) => c.name)).toEqual(['Walk-in']);
    const page1 = await search('pageSize=2&sort=code');
    expect(page1).toMatchObject({ total: 3, page: 1, pageSize: 2, hasMore: true });
    expect(page1.items.map((c: J) => c.code)).toEqual(['C-LEGACY/1', 'CUS-000001']);
    expect((await search('pageSize=2&page=2')).hasMore).toBe(false);
    expect((await owner.get(`${MD}/customers?sort=companyId`)).statusCode).toBe(400);
    expect((await owner.get(`${MD}/customers?pageSize=1000`)).statusCode).toBe(400);
    // List rows are lean: no notes or addresses.
    expect(page1.items[1]).not.toHaveProperty('notes');

    // Deactivate / reactivate — reversible, the record stays.
    const off = await owner.post(`${MD}/customers/${c1.id}/deactivate`);
    expect(j(off).customer).toMatchObject({ status: 'INACTIVE' });
    expect(j(off).customer.deactivatedAt).toBeTruthy();
    expect((await search('status=INACTIVE')).items.map((c: J) => c.id)).toEqual([c1.id]);
    expect((await search('status=ACTIVE')).total).toBe(2);
    expect(j(await owner.post(`${MD}/customers/${c1.id}/reactivate`)).customer).toMatchObject({
      status: 'ACTIVE',
      deactivatedAt: null,
    });

    // Audit: human-readable, no note contents.
    const audit = await h.db.auditLog.findMany({
      where: { companyId: A.companyId, entityId: c1.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual([
      'CUSTOMER_CREATED',
      'CUSTOMER_UPDATED',
      'CUSTOMER_DEACTIVATED',
      'CUSTOMER_REACTIVATED',
    ]);
    expect(audit[1]!.changes).toMatchObject({
      code: 'CUS-000001',
      fields: ['name', 'email'],
      nameFrom: 'บริษัท ตัวอย่าง จำกัด',
      nameTo: 'Example Co., Ltd.',
    });
    expect(JSON.stringify(audit)).not.toContain('PRIVATE NOTE CONTENT');
    expect(JSON.stringify(audit)).not.toContain('buyer@example.com');
  });

  it('customers: Sales / Accounting read, Sales managers manage, everyone else is refused', async () => {
    const owner = await as('owner@a.example');
    const c = j(await owner.post(`${MD}/customers`, { name: 'Shared Customer' })).customer;
    for (const email of ['sales.staff@a.example', 'acct.staff@a.example', 'exec@a.example']) {
      const b = await as(email);
      expect((await b.get(`${MD}/customers/${c.id}`)).statusCode, email).toBe(200);
      const create = await b.post(`${MD}/customers`, { name: 'Nope' });
      expect(create.statusCode, email).toBe(403);
      expect(code(create)).toBe('PERMISSION_DENIED');
      expect(code(await b.post(`${MD}/customers/${c.id}/deactivate`))).toBe('PERMISSION_DENIED');
    }
    for (const email of ['wh.staff@a.example', 'buy.mgr@a.example']) {
      expect(code(await (await as(email)).get(`${MD}/customers`)), email).toBe('PERMISSION_DENIED');
    }
    const mgr = await as('sales.mgr@a.example');
    expect((await mgr.post(`${MD}/customers`, { name: 'By manager' })).statusCode).toBe(201);
    expect((await mgr.patch(`${MD}/customers/${c.id}`, { notes: 'ok' })).statusCode).toBe(200);
  });

  // ---------------------------------------------------------------- suppliers

  it('suppliers: identity only, Purchasing manages, Warehouse never reads them', async () => {
    const buyer = await as('buy.mgr@a.example');
    const res = await buyer.post(`${MD}/suppliers`, {
      name: 'Raw Supply Co.',
      taxId: '0105599999999',
      contactName: 'Mali',
      address: '1 Road\nBangkok',
    });
    expect(res.statusCode, res.body).toBe(201);
    const s = j(res).supplier;
    expect(s.code).toBe('SUP-000001');
    expect(Object.keys(s).sort()).toEqual(
      [
        'address',
        'code',
        'contactName',
        'createdAt',
        'deactivatedAt',
        'email',
        'id',
        'legalName',
        'name',
        'notes',
        'phone',
        'status',
        'taxBranch',
        'taxId',
        'updatedAt',
      ].sort(),
    );
    expect(code(await buyer.post(`${MD}/suppliers`, { name: 'X', paymentTerms: 30 }))).toBe(
      'VALIDATION_FAILED',
    );
    expect(j(await buyer.get(`${MD}/suppliers?q=mali`)).total).toBe(1);
    expect(
      (await (await as('acct.staff@a.example')).get(`${MD}/suppliers/${s.id}`)).statusCode,
    ).toBe(200);
    const wh = await as('wh.staff@a.example');
    expect(code(await wh.get(`${MD}/suppliers`))).toBe('PERMISSION_DENIED');
    expect(code(await wh.get(`${MD}/suppliers/${s.id}`))).toBe('PERMISSION_DENIED');
    expect(j(await wh.get(`${MD}/context`)).capabilities.suppliers).toEqual({
      view: false,
      manage: false,
    });
    // A real organization may be customer AND supplier: separate canonical records.
    const owner = await as('owner@a.example');
    expect((await owner.post(`${MD}/customers`, { name: 'Raw Supply Co.' })).statusCode).toBe(201);
    expect(j(await buyer.post(`${MD}/suppliers/${s.id}/deactivate`)).supplier.status).toBe(
      'INACTIVE',
    );
    expect(j(await buyer.post(`${MD}/suppliers/${s.id}/reactivate`)).supplier.status).toBe(
      'ACTIVE',
    );
    const actions = (
      await h.db.auditLog.findMany({ where: { entityId: s.id }, orderBy: { occurredAt: 'asc' } })
    ).map((a) => a.action);
    expect(actions).toEqual(['SUPPLIER_CREATED', 'SUPPLIER_DEACTIVATED', 'SUPPLIER_REACTIVATED']);
  });

  // ------------------------------------------------------- units / categories

  it('units and categories: unique codes, precision, deactivation keeps references and blocks new ones', async () => {
    const ops = await as('ops.mgr@a.example');
    const pcs = await unit(ops, 'pcs');
    expect(pcs).toMatchObject({ code: 'PCS', precision: 0, status: 'ACTIVE' });
    const kg = await unit(ops, 'KG', 3);
    expect(kg.precision).toBe(3);
    expect(j(await ops.post(`${MD}/units`, { code: 'PCS', name: 'again' })).error).toMatchObject({
      code: 'DUPLICATE_VALUE',
    });
    expect(
      (await ops.post(`${MD}/units`, { code: 'L', name: 'Litre', precision: 7 })).statusCode,
    ).toBe(400);
    const cat = j(
      await ops.post(`${MD}/categories`, { code: 'fg', name: 'Finished Goods' }),
    ).category;
    expect(cat.code).toBe('FG');

    const item = j(
      await ops.post(`${MD}/items`, {
        type: 'FINISHED_GOOD',
        name: 'Widget',
        baseUnitId: pcs.id,
        categoryId: cat.id,
      }),
    ).item;
    expect(j(await ops.get(`${MD}/units/${pcs.id}`)).usage).toEqual({ items: 1, activeItems: 1 });

    // Deactivate while referenced: allowed; the item still shows it (inactive).
    expect(j(await ops.post(`${MD}/units/${pcs.id}/deactivate`)).unit.status).toBe('INACTIVE');
    expect(j(await ops.post(`${MD}/categories/${cat.id}/deactivate`)).category.status).toBe(
      'INACTIVE',
    );
    const shown = j(await ops.get(`${MD}/items/${item.id}`)).item;
    expect(shown.baseUnit).toMatchObject({ code: 'PCS', status: 'INACTIVE' });
    expect(shown.category).toMatchObject({ code: 'FG', status: 'INACTIVE' });
    // …but no NEW assignment of an inactive unit / category.
    const noUnit = await ops.post(`${MD}/items`, {
      type: 'RAW_MATERIAL',
      name: 'R',
      baseUnitId: pcs.id,
    });
    expect(noUnit.statusCode).toBe(409);
    expect(j(noUnit).error).toMatchObject({
      code: 'REFERENCE_INACTIVE',
      details: { field: 'baseUnitId' },
    });
    expect(
      j(
        await ops.post(`${MD}/items`, {
          type: 'RAW_MATERIAL',
          name: 'R',
          baseUnitId: kg.id,
          categoryId: cat.id,
        }),
      ).error.details,
    ).toEqual({ field: 'categoryId' });
    // Editing the item's name keeps working with its inactive unit.
    expect((await ops.patch(`${MD}/items/${item.id}`, { name: 'Widget 2' })).statusCode).toBe(200);
    // An item whose base unit is inactive cannot be reactivated.
    await ops.post(`${MD}/items/${item.id}/deactivate`);
    expect(code(await ops.post(`${MD}/items/${item.id}/reactivate`))).toBe('REFERENCE_INACTIVE');
    await ops.post(`${MD}/units/${pcs.id}/reactivate`);
    expect(j(await ops.post(`${MD}/items/${item.id}/reactivate`)).item.status).toBe('ACTIVE');

    const actions = (
      await h.db.auditLog.findMany({
        where: { entityType: { in: ['Unit', 'ItemCategory'] } },
        orderBy: { occurredAt: 'asc' },
      })
    ).map((a) => a.action);
    expect(actions).toEqual([
      'UNIT_CREATED',
      'UNIT_CREATED',
      'ITEM_CATEGORY_CREATED',
      'UNIT_DEACTIVATED',
      'ITEM_CATEGORY_DEACTIVATED',
      'UNIT_REACTIVATED',
    ]);
  });

  // ------------------------------------------------------------------- items

  it('items: per-type codes, tracking rules, unique SKU / barcode, structure policy, filters', async () => {
    const owner = await as('owner@a.example');
    const pcs = await unit(owner, 'PCS');
    const kg = await unit(owner, 'KG', 3);
    const make = (body: J) => owner.post(`${MD}/items`, { baseUnitId: pcs.id, ...body });

    const fg = j(
      await make({ type: 'FINISHED_GOOD', name: 'Cream', sku: 'cr-1', barcode: '885000000001' }),
    ).item;
    expect(fg).toMatchObject({
      code: 'FG-000001',
      sku: 'CR-1',
      inventoryTracked: true,
      lotTracking: 'NONE',
      expiryTracking: 'NONE',
      baseUnit: { code: 'PCS' },
      category: null,
    });
    expect(j(await make({ type: 'RAW_MATERIAL', name: 'Oil', baseUnitId: kg.id })).item.code).toBe(
      'RM-000001',
    );
    expect(j(await make({ type: 'FINISHED_GOOD', name: 'Lotion' })).item.code).toBe('FG-000002');
    const service = j(await make({ type: 'NON_STOCK', name: 'Delivery fee' })).item;
    expect(service).toMatchObject({ code: 'NS-000001', inventoryTracked: false });

    // Tracking combinations the rules refuse.
    for (const body of [
      { type: 'NON_STOCK', name: 'x', inventoryTracked: true },
      { type: 'FINISHED_GOOD', name: 'x', inventoryTracked: false, lotTracking: 'REQUIRED' },
      { type: 'FINISHED_GOOD', name: 'x', expiryTracking: 'OPTIONAL' },
      { type: 'FINISHED_GOOD', name: 'x', lotTracking: 'OPTIONAL', expiryTracking: 'REQUIRED' },
    ]) {
      expect(code(await make(body)), JSON.stringify(body)).toBe('TRACKING_INVALID');
    }
    const fefo = j(
      await make({
        type: 'RAW_MATERIAL',
        name: 'Milk powder',
        lotTracking: 'REQUIRED',
        expiryTracking: 'REQUIRED',
      }),
    ).item;
    expect(fefo).toMatchObject({ lotTracking: 'REQUIRED', expiryTracking: 'REQUIRED' });

    // Identifiers are company-unique; a failed create does not consume a number.
    const dupBarcode = await make({ type: 'FINISHED_GOOD', name: 'x', barcode: '885000000001' });
    expect(j(dupBarcode).error).toMatchObject({
      code: 'DUPLICATE_VALUE',
      details: { field: 'barcode' },
    });
    const dupSku = await make({ type: 'FINISHED_GOOD', name: 'x', sku: 'CR-1' });
    expect(j(dupSku).error.details).toEqual({ field: 'sku' });
    expect(j(await make({ type: 'FINISHED_GOOD', name: 'Soap' })).item.code).toBe('FG-000003');
    expect(code(await make({ type: 'FINISHED_GOOD', name: 'x', code: 'RM-000050' }))).toBe(
      'CODE_RESERVED',
    );
    expect(j(await make({ type: 'FINISHED_GOOD', name: 'Old', code: 'old-01' })).item.code).toBe(
      'OLD-01',
    );

    // The generic edit cannot touch type, unit or tracking.
    for (const body of [
      { type: 'RAW_MATERIAL' },
      { baseUnitId: kg.id },
      { lotTracking: 'REQUIRED' },
      { code: 'Z' },
    ]) {
      expect(
        (await owner.patch(`${MD}/items/${fg.id}`, body)).statusCode,
        JSON.stringify(body),
      ).toBe(400);
    }
    // The structure policy point: base unit + tracking, audited from → to.
    const structure = await owner.put(`${MD}/items/${fg.id}/structure`, {
      baseUnitId: kg.id,
      lotTracking: 'OPTIONAL',
      expiryTracking: 'OPTIONAL',
    });
    expect(structure.statusCode, structure.body).toBe(200);
    expect(j(structure).item).toMatchObject({
      baseUnit: { code: 'KG' },
      lotTracking: 'OPTIONAL',
      expiryTracking: 'OPTIONAL',
    });
    expect(code(await owner.put(`${MD}/items/${fg.id}/structure`, { lotTracking: 'NONE' }))).toBe(
      'TRACKING_INVALID',
    );
    expect(
      code(await owner.put(`${MD}/items/${service.id}/structure`, { inventoryTracked: true })),
    ).toBe('TRACKING_INVALID');
    expect((await owner.put(`${MD}/items/${fg.id}/structure`, {})).statusCode).toBe(400);
    const changed = await h.db.auditLog.findFirstOrThrow({
      where: { entityId: fg.id, action: 'ITEM_STRUCTURE_CHANGED' },
    });
    expect(changed.changes).toMatchObject({
      code: 'FG-000001',
      baseUnitFrom: 'PCS',
      baseUnitTo: 'KG',
      lotTrackingFrom: 'NONE',
      lotTrackingTo: 'OPTIONAL',
      expiryTrackingFrom: 'NONE',
      expiryTrackingTo: 'OPTIONAL',
    });

    // Search (code, SKU, barcode, name) and the useful filters.
    const list = async (qs: string) => j(await owner.get(`${MD}/items?${qs}`));
    expect((await list('q=885000000001')).items.map((i: J) => i.code)).toEqual(['FG-000001']);
    expect((await list('q=cr-1')).total).toBe(1);
    expect((await list('type=RAW_MATERIAL')).items.map((i: J) => i.code)).toEqual([
      'RM-000001',
      'RM-000002',
    ]);
    expect((await list('inventoryTracked=false')).items.map((i: J) => i.code)).toEqual([
      'NS-000001',
    ]);
    expect((await list('expiryTracking=REQUIRED')).items.map((i: J) => i.name)).toEqual([
      'Milk powder',
    ]);
    expect((await list('lotTracking=OPTIONAL')).total).toBe(1);
    expect((await list('lotTracking=TRACKED')).items.map((i: J) => i.code)).toEqual([
      'FG-000001',
      'RM-000002',
    ]);
    expect((await list('sort=name&pageSize=2')).items.map((i: J) => i.name)).toEqual([
      'Cream',
      'Delivery fee',
    ]);
    expect((await owner.get(`${MD}/items?inventoryTracked=maybe`)).statusCode).toBe(400);

    // Who manages items: Operations managers and administration; Staff / other Managers only read.
    const ops = await as('ops.mgr@a.example');
    expect((await ops.patch(`${MD}/items/${fg.id}`, { description: 'ok' })).statusCode).toBe(200);
    for (const email of ['sales.mgr@a.example', 'buy.mgr@a.example', 'wh.mgr@a.example']) {
      const b = await as(email);
      expect((await b.get(`${MD}/items/${fg.id}`)).statusCode, email).toBe(200);
      expect(code(await b.patch(`${MD}/items/${fg.id}`, { name: 'x' })), email).toBe(
        'PERMISSION_DENIED',
      );
    }
    expect(code(await (await as('acct.staff@a.example')).get(`${MD}/items`))).toBe(
      'PERMISSION_DENIED',
    );
  });

  // ------------------------------------------------------- Warehouse privacy

  it('Warehouse receives safe item / location data only — even through direct API requests', async () => {
    const owner = await as('owner@a.example');
    const pcs = await unit(owner, 'PCS');
    const item = j(
      await owner.post(`${MD}/items`, {
        type: 'FINISHED_GOOD',
        name: 'Cream',
        baseUnitId: pcs.id,
        lotTracking: 'REQUIRED',
        expiryTracking: 'REQUIRED',
      }),
    ).item;
    await owner.post(`${MD}/suppliers`, { name: 'Supplier With Terms' });
    await owner.post(`${MD}/locations`, { branchId: br.A, code: 'MAIN', name: 'Main' });
    const wh = await as('wh.staff@a.example');
    for (const url of [
      `${MD}/items`,
      `${MD}/items/${item.id}`,
      `${MD}/units`,
      `${MD}/categories`,
      `${MD}/locations`,
      `${MD}/context`,
    ]) {
      const res = await wh.get(url);
      expect(res.statusCode, url).toBe(200);
      const walk = (v: unknown): void => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object')
          for (const [k, x] of Object.entries(v)) {
            expect(k, url).not.toMatch(FINANCIAL);
            walk(x);
          }
      };
      walk(res.json());
      expect(res.body).not.toMatch(
        /"(unitCost|cost|price|salePrice|margin|paymentTerms|financialTerms)"/,
      );
      expect(res.body).not.toContain('Supplier With Terms');
      expect(res.body).not.toContain(A.companyId);
    }
    // The item identity Warehouse needs is all there.
    expect(j(await wh.get(`${MD}/items/${item.id}`)).item).toMatchObject({
      code: 'FG-000001',
      name: 'Cream',
      baseUnit: { code: 'PCS' },
      lotTracking: 'REQUIRED',
      expiryTracking: 'REQUIRED',
      inventoryTracked: true,
    });
  });

  // ------------------------------------------------------------- locations

  it('locations: branch-scoped codes, tree rules, default location, lifecycle', async () => {
    const owner = await as('owner@a.example');
    const loc = async (body: J) => owner.post(`${MD}/locations`, body);
    const main = j(
      await loc({ branchId: br.A, code: 'main', name: 'Main warehouse', isDefault: true }),
    ).location;
    expect(main).toMatchObject({
      code: 'MAIN',
      isDefault: true,
      branch: { id: br.A, code: '00001' },
      parent: null,
    });
    // Same code in another branch is fine; twice in one branch is not.
    expect((await loc({ branchId: br.HO, code: 'MAIN', name: 'HO main' })).statusCode).toBe(201);
    expect(j(await loc({ branchId: br.A, code: 'MAIN', name: 'x' })).error).toMatchObject({
      code: 'DUPLICATE_VALUE',
      details: { field: 'code' },
    });
    const rack = j(
      await loc({ branchId: br.A, code: 'RACK-A', name: 'Rack A', parentId: main.id }),
    ).location;
    expect(rack.parent).toMatchObject({ code: 'MAIN' });
    const bin = j(
      await loc({ branchId: br.A, code: 'A-01', name: 'A-01', parentId: rack.id }),
    ).location;
    const sub = j(
      await loc({ branchId: br.A, code: 'A-01-1', name: 'Shelf', parentId: bin.id }),
    ).location;
    expect(code(await loc({ branchId: br.A, code: 'TOO-DEEP', name: 'x', parentId: sub.id }))).toBe(
      'LOCATION_TOO_DEEP',
    );
    // A parent must be in the same branch.
    const hoMain = j(await owner.get(`${MD}/locations?branchId=${br.HO}`)).items[0];
    expect(
      j(await loc({ branchId: br.A, code: 'X', name: 'x', parentId: hoMain.id })).error,
    ).toMatchObject({
      code: 'REFERENCE_NOT_FOUND',
      details: { field: 'parentId' },
    });
    // No cycles.
    expect(code(await owner.patch(`${MD}/locations/${main.id}`, { parentId: bin.id }))).toBe(
      'LOCATION_CYCLE',
    );
    expect((await owner.patch(`${MD}/locations/${main.id}`, { branchId: br.B })).statusCode).toBe(
      400,
    );
    expect((await owner.patch(`${MD}/locations/${main.id}`, { code: 'NEW' })).statusCode).toBe(400);

    // One default per branch: choosing another moves it.
    const recv = j(
      await loc({ branchId: br.A, code: 'RECV', name: 'Receiving', isDefault: true }),
    ).location;
    expect(recv.isDefault).toBe(true);
    expect(j(await owner.get(`${MD}/locations/${main.id}`)).location.isDefault).toBe(false);

    // Deactivation keeps the tree coherent.
    expect(code(await owner.post(`${MD}/locations/${bin.id}/deactivate`))).toBe(
      'LOCATION_HAS_ACTIVE_CHILDREN',
    );
    await owner.post(`${MD}/locations/${sub.id}/deactivate`);
    expect(j(await owner.post(`${MD}/locations/${bin.id}/deactivate`)).location.status).toBe(
      'INACTIVE',
    );
    expect(code(await owner.post(`${MD}/locations/${sub.id}/reactivate`))).toBe(
      'REFERENCE_INACTIVE',
    );
    const offDefault = j(await owner.post(`${MD}/locations/${recv.id}/deactivate`)).location;
    expect(offDefault).toMatchObject({ status: 'INACTIVE', isDefault: false });
    expect(code(await owner.patch(`${MD}/locations/${recv.id}`, { isDefault: true }))).toBe(
      'RECORD_INACTIVE',
    );

    // Lists: per branch, search, status.
    const inA = j(await owner.get(`${MD}/locations?branchId=${br.A}&status=ACTIVE`));
    expect(inA.items.map((l: J) => l.code)).toEqual(['MAIN', 'RACK-A']);
    expect(j(await owner.get(`${MD}/locations?q=rack`)).total).toBe(1);
    const events = (
      await h.db.auditLog.findMany({ where: { entityId: recv.id }, orderBy: { occurredAt: 'asc' } })
    ).map((a) => [a.action, (a.changes as J).defaultCleared ?? null]);
    expect(events).toEqual([
      ['LOCATION_CREATED', null],
      ['LOCATION_DEACTIVATED', true],
    ]);
  });

  it('locations: branch restrictions hold; company administration reaches every branch; inactive branches refuse new locations', async () => {
    const owner = await as('owner@a.example');
    const inB = j(
      await owner.post(`${MD}/locations`, { branchId: br.B, code: 'MAIN', name: 'B' }),
    ).location;
    await owner.post(`${MD}/locations`, { branchId: br.A, code: 'MAIN', name: 'A' });

    // Warehouse Staff, Branch A only: reads A, never B; cannot change anything.
    const staff = await as('wh.staff@a.example');
    const ctx = j(await staff.get(`${MD}/context`));
    expect(ctx.branches.map((b: J) => b.code)).toEqual(['00001']);
    expect(ctx.capabilities.locations).toEqual({ view: true, manage: false });
    expect(j(await staff.get(`${MD}/locations`)).items.map((l: J) => l.branch.code)).toEqual([
      '00001',
    ]);
    expect(code(await staff.get(`${MD}/locations?branchId=${br.B}`))).toBe('BRANCH_NOT_ALLOWED');
    expect(code(await staff.get(`${MD}/locations/${inB.id}`))).toBe('BRANCH_NOT_ALLOWED');
    expect(
      code(await staff.post(`${MD}/locations`, { branchId: br.A, code: 'S', name: 's' })),
    ).toBe('PERMISSION_DENIED');

    // Warehouse Manager, Branch A only: manages A, not B.
    const mgr = await as('wh.mgr@a.example');
    expect(
      (await mgr.post(`${MD}/locations`, { branchId: br.A, code: 'QC', name: 'QC' })).statusCode,
    ).toBe(201);
    expect(
      code(await mgr.post(`${MD}/locations`, { branchId: br.B, code: 'QC', name: 'QC' })),
    ).toBe('BRANCH_NOT_ALLOWED');
    expect(code(await mgr.patch(`${MD}/locations/${inB.id}`, { name: 'mine' }))).toBe(
      'BRANCH_NOT_ALLOWED',
    );
    expect(code(await mgr.post(`${MD}/locations/${inB.id}/deactivate`))).toBe('BRANCH_NOT_ALLOWED');

    // System Admin restricted to Branch A: company administration is company-wide (EP26 / EP27).
    const admin = await as('admin@a.example');
    expect(
      (await admin.post(`${MD}/locations`, { branchId: br.B, code: 'DAMAGED', name: 'Damaged' }))
        .statusCode,
    ).toBe(201);
    expect(j(await admin.get(`${MD}/context`)).branches.map((b: J) => b.code)).toEqual([
      '00000',
      '00001',
      '00002',
    ]);

    // An inactive branch: no new or reactivated locations there; restricted readers lose it.
    await h.db.branch.update({
      where: { id: br.A },
      data: { status: 'INACTIVE', deactivatedAt: new Date() },
    });
    expect(
      code(await owner.post(`${MD}/locations`, { branchId: br.A, code: 'NEW', name: 'n' })),
    ).toBe('BRANCH_INACTIVE');
    expect(j(await owner.get(`${MD}/locations?branchId=${br.A}`)).total).toBe(2);
    expect(code(await staff.get(`${MD}/locations?branchId=${br.A}`))).toBe('BRANCH_NOT_ALLOWED');
    expect(j(await staff.get(`${MD}/locations`)).total).toBe(0);
  });

  // ------------------------------------------------------------ isolation

  it('IDOR: another company cannot read, search, reference, change or deactivate any master record', async () => {
    const ownerA = await as('owner@a.example');
    const pcs = await unit(ownerA, 'PCS');
    const cat = j(await ownerA.post(`${MD}/categories`, { code: 'FG', name: 'FG' })).category;
    const records = {
      customers: j(await ownerA.post(`${MD}/customers`, { name: 'Alpha customer' })).customer.id,
      suppliers: j(await ownerA.post(`${MD}/suppliers`, { name: 'Alpha supplier' })).supplier.id,
      items: j(
        await ownerA.post(`${MD}/items`, {
          type: 'FINISHED_GOOD',
          name: 'Alpha item',
          baseUnitId: pcs.id,
        }),
      ).item.id,
      units: pcs.id,
      categories: cat.id,
      locations: j(
        await ownerA.post(`${MD}/locations`, { branchId: br.A, code: 'MAIN', name: 'Main' }),
      ).location.id,
    };
    const ownerB = await as('owner@b.example');
    for (const [resource, id] of Object.entries(records)) {
      expect(code(await ownerB.get(`${MD}/${resource}/${id}`)), resource).toBe(
        'MASTER_RECORD_NOT_FOUND',
      );
      expect(
        code(await ownerB.patch(`${MD}/${resource}/${id}`, { name: 'hijack' })),
        resource,
      ).toBe('MASTER_RECORD_NOT_FOUND');
      expect(code(await ownerB.post(`${MD}/${resource}/${id}/deactivate`)), resource).toBe(
        'MASTER_RECORD_NOT_FOUND',
      );
      const list = j(await ownerB.get(`${MD}/${resource}?q=alpha`));
      expect(list.total, resource).toBe(0);
      expect(JSON.stringify(list)).not.toContain(id);
    }
    expect(
      code(await ownerB.put(`${MD}/items/${records.items}/structure`, { lotTracking: 'OPTIONAL' })),
    ).toBe('MASTER_RECORD_NOT_FOUND');
    // Referencing A's unit / category / branch / parent from B.
    const bUnit = await unit(ownerB, 'PCS');
    expect(
      j(await ownerB.post(`${MD}/items`, { type: 'FINISHED_GOOD', name: 'x', baseUnitId: pcs.id }))
        .error,
    ).toMatchObject({ code: 'REFERENCE_NOT_FOUND', details: { field: 'baseUnitId' } });
    expect(
      j(
        await ownerB.post(`${MD}/items`, {
          type: 'FINISHED_GOOD',
          name: 'x',
          baseUnitId: bUnit.id,
          categoryId: cat.id,
        }),
      ).error.details,
    ).toEqual({ field: 'categoryId' });
    expect(
      code(await ownerB.post(`${MD}/locations`, { branchId: br.A, code: 'X', name: 'x' })),
    ).toBe('BRANCH_NOT_FOUND');
    expect(code(await ownerB.get(`${MD}/locations?branchId=${br.A}`))).toBe('BRANCH_NOT_FOUND');
    const bLoc = j(
      await ownerB.post(`${MD}/locations`, {
        branchId: B.headOfficeId,
        code: 'MAIN',
        name: 'B main',
      }),
    ).location;
    expect(
      code(await ownerB.patch(`${MD}/locations/${bLoc.id}`, { parentId: records.locations })),
    ).toBe('REFERENCE_NOT_FOUND');
    // B's codes are its own sequence.
    expect(j(await ownerB.post(`${MD}/customers`, { name: 'Beta customer' })).customer.code).toBe(
      'CUS-000001',
    );

    // The database refuses cross-company references even past the API.
    await expect(
      h.db.item.create({
        data: {
          companyId: B.companyId,
          code: 'X1',
          type: 'FINISHED_GOOD',
          name: 'x',
          baseUnitId: pcs.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.item.create({
        data: {
          companyId: B.companyId,
          code: 'X2',
          type: 'FINISHED_GOOD',
          name: 'x',
          baseUnitId: bUnit.id,
          categoryId: cat.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.warehouseLocation.create({
        data: { companyId: B.companyId, branchId: br.A, code: 'X', name: 'x' },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.item.create({
        data: {
          companyId: B.companyId,
          code: 'X3',
          type: 'NON_STOCK',
          name: 'x',
          baseUnitId: bUnit.id,
          inventoryTracked: true,
        },
      }),
    ).rejects.toThrow();
    // Platform operators have no customer master data access; Platform Inspection
    // shows that master-data events happened, never their codes or names.
    await createUser(h.db, 'operator@pdabliss.example', { platformRole: 'PLATFORM_ADMIN' });
    const operator = await as('operator@pdabliss.example');
    expect((await operator.get(`${MD}/customers`)).statusCode).toBe(403);
    expect((await operator.get(`${MD}/items/${records.items}`)).statusCode).toBe(403);
    const inspection = await operator.get(`/api/v1/platform/companies/${A.companyId}`);
    expect(inspection.statusCode, inspection.body).toBe(200);
    const events = j(inspection).activity.filter((e: J) => e.action === 'CUSTOMER_CREATED');
    expect(events).toHaveLength(1);
    expect(events[0].details).toEqual({});
    expect(inspection.body).not.toContain('Alpha customer');
    expect(inspection.body).not.toContain('Alpha supplier');
  });

  // ------------------------------------------------------- Viewer / exceptions

  it('Viewer reads what its departments allow and can never mutate — direct API calls included', async () => {
    const owner = await as('owner@a.example');
    const pcs = await unit(owner, 'PCS');
    const cat = j(await owner.post(`${MD}/categories`, { code: 'FG', name: 'FG' })).category;
    const cus = j(await owner.post(`${MD}/customers`, { name: 'C' })).customer;
    const item = j(
      await owner.post(`${MD}/items`, { type: 'FINISHED_GOOD', name: 'I', baseUnitId: pcs.id }),
    ).item;
    const loc = j(
      await owner.post(`${MD}/locations`, { branchId: br.A, code: 'MAIN', name: 'M' }),
    ).location;
    const viewer = await as('viewer@a.example');
    for (const url of [
      `${MD}/customers/${cus.id}`,
      `${MD}/items/${item.id}`,
      `${MD}/locations/${loc.id}`,
    ])
      expect((await viewer.get(url)).statusCode, url).toBe(200);
    expect(j(await viewer.get(`${MD}/items`)).canManage).toBe(false);
    const attempts: [string, string, unknown][] = [
      ['POST', `${MD}/customers`, { name: 'x' }],
      ['PATCH', `${MD}/customers/${cus.id}`, { name: 'x' }],
      ['POST', `${MD}/customers/${cus.id}/deactivate`, {}],
      ['POST', `${MD}/customers/${cus.id}/reactivate`, {}],
      ['POST', `${MD}/items`, { type: 'FINISHED_GOOD', name: 'x', baseUnitId: pcs.id }],
      ['PATCH', `${MD}/items/${item.id}`, { name: 'x' }],
      ['PUT', `${MD}/items/${item.id}/structure`, { lotTracking: 'OPTIONAL' }],
      ['POST', `${MD}/items/${item.id}/deactivate`, {}],
      ['POST', `${MD}/units`, { code: 'BOX', name: 'Box' }],
      ['POST', `${MD}/units/${pcs.id}/deactivate`, {}],
      ['PATCH', `${MD}/categories/${cat.id}`, { name: 'x' }],
      ['POST', `${MD}/locations`, { branchId: br.A, code: 'X', name: 'x' }],
      ['PATCH', `${MD}/locations/${loc.id}`, { name: 'x' }],
      ['POST', `${MD}/locations/${loc.id}/deactivate`, {}],
      ['POST', `${MD}/suppliers`, { name: 'x' }],
    ];
    for (const [method, url, body] of attempts) {
      const res = await viewer.request(method as 'POST', url, body);
      expect(res.statusCode, `${method} ${url}`).toBe(403);
    }
    expect(await h.db.customer.count()).toBe(1);
    expect((await h.db.item.findUniqueOrThrow({ where: { id: item.id } })).name).toBe('I');
  });

  it('a DENY exception closes master data on the next request; an ALLOW cannot reach another department', async () => {
    const owner = await as('owner@a.example');
    const pcs = await unit(owner, 'PCS');
    await owner.post(`${MD}/items`, { type: 'FINISHED_GOOD', name: 'I', baseUnitId: pcs.id });
    const staff = await as('wh.staff@a.example');
    expect((await staff.get(`${MD}/items`)).statusCode).toBe(200);
    const deny = await owner.put(
      `/api/v1/company/current/members/${ids['wh.staff@a.example']}/permissions`,
      {
        changes: [{ permission: 'warehouse.items.view', effect: 'DENY' }],
      },
    );
    expect(deny.statusCode, deny.body).toBe(200);
    expect(code(await staff.get(`${MD}/items`))).toBe('PERMISSION_DENIED');
    expect(j(await staff.get(`${MD}/context`)).capabilities.items.view).toBe(false);
    const allow = await owner.put(
      `/api/v1/company/current/members/${ids['wh.staff@a.example']}/permissions`,
      {
        changes: [{ permission: 'purchasing.suppliers.manage', effect: 'ALLOW' }],
      },
    );
    expect(code(allow)).toBe('PERMISSION_NOT_ELIGIBLE');
    // An administration code is never an exception.
    const admin = await owner.put(
      `/api/v1/company/current/members/${ids['wh.staff@a.example']}/permissions`,
      {
        changes: [{ permission: 'company.master_data.manage', effect: 'ALLOW' }],
      },
    );
    expect(code(admin)).toBe('PERMISSION_NOT_OVERRIDABLE');
  });

  // ----------------------------------------------------------- concurrency

  it('concurrent creates never share a code (customers, suppliers, items)', async () => {
    const owner = await as('owner@a.example');
    const pcs = await unit(owner, 'PCS');
    const N = 16;
    const burst = (url: string, body: (i: number) => unknown) =>
      Promise.all(Array.from({ length: N }, (_, i) => owner.post(url, body(i))));
    const [customers, suppliers, items] = await Promise.all([
      burst(`${MD}/customers`, (i) => ({ name: `Parallel customer ${i}` })),
      burst(`${MD}/suppliers`, (i) => ({ name: `Parallel supplier ${i}` })),
      burst(`${MD}/items`, (i) => ({
        type: 'RAW_MATERIAL',
        name: `Parallel item ${i}`,
        baseUnitId: pcs.id,
      })),
    ]);
    for (const [label, results, key, prefix] of [
      ['customers', customers, 'customer', 'CUS'],
      ['suppliers', suppliers, 'supplier', 'SUP'],
      ['items', items, 'item', 'RM'],
    ] as const) {
      for (const r of results) expect(r.statusCode, `${label}: ${r.body}`).toBe(201);
      const codes = results.map((r) => j(r)[key].code as string).sort();
      expect(new Set(codes).size, label).toBe(N);
      expect(codes, label).toEqual(
        Array.from({ length: N }, (_, i) => `${prefix}-${String(i + 1).padStart(6, '0')}`),
      );
    }
    const seq = await h.db.masterCodeSequence.findMany({
      where: { companyId: A.companyId },
      orderBy: { prefix: 'asc' },
    });
    expect(seq.map((s) => [s.prefix, s.lastValue])).toEqual([
      ['CUS', N],
      ['RM', N],
      ['SUP', N],
    ]);
    // Every create wrote exactly one audit entry.
    expect(await h.db.auditLog.count({ where: { action: 'CUSTOMER_CREATED' } })).toBe(N);
  });

  // --------------------------------------------------------- regressions

  it('leaves EP27 workspaces, branch context and the operational gate unchanged', async () => {
    const staff = await as('wh.staff@a.example');
    const ctx = j(await staff.get('/api/v1/company/context'));
    expect(ctx.selected.code).toBe('00001');
    expect(ctx.departments).toEqual(['WAREHOUSE']);
    expect(ctx.permissions).toEqual(
      expect.arrayContaining(['warehouse.items.view', 'warehouse.locations.view']),
    );
    expect(ctx.permissions).not.toContain('warehouse.locations.manage');
    expect((await staff.get('/api/v1/operations/workspaces/warehouse')).statusCode).toBe(200);
    const ok = await staff.get('/api/v1/operations/authorize?permission=warehouse.items.view');
    expect(ok.statusCode, ok.body).toBe(200);
    expect(
      code(await staff.get('/api/v1/operations/authorize?permission=purchasing.suppliers.view')),
    ).toBe('PERMISSION_DENIED');
  });
});
