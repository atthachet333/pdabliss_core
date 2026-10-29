import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DepartmentCode } from '../src/billing/catalog.js';
import { Prisma } from '../src/generated/prisma/client.js';
import type { CompanyRole } from '../src/generated/prisma/enums.js';
import { PERMISSION_CATALOG, ROLE_OPERATIONAL_PROFILE } from '../src/permissions/catalog.js';
import { refusal, type PrActor } from '../src/purchasing/policy.js';
import { companyDay } from '../src/purchasing/service.js';
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
 * EP29 purchase requests: numbering (atomic, concurrent), draft lines with
 * server-derived snapshots and exact decimal quantities, the transition
 * policy (submit / approve / reject / cancel, races), visibility by
 * permission and branch, department and branch tampering, mass assignment,
 * company isolation, audit and timeline.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
type J = Record<string, any>;
const j = (res: ApiResponse) => res.json<J>();
const code = (res: ApiResponse) => j(res).error?.code as string | undefined;
const PR = '/api/v1/purchase-requests';
const FINANCIAL = /price|cost|discount|tax|subtotal|amount|supplier|quote|margin|payment/i;

// ------------------------------------------------------------------ static

describe('Purchase request policy (EP29)', () => {
  it('adds department origin and decision codes without new action words', () => {
    const codes = PERMISSION_CATALOG.map((p) => p.code as string);
    for (const d of ['sales', 'operations', 'warehouse', 'accounting']) {
      expect(codes).toContain(`${d}.purchase_requests.create`);
      expect(codes).toContain(`${d}.purchase_requests.approve`);
    }
    expect(codes).toContain('purchasing.requests.cancel');
    expect(codes.some((c) => /\.(submit|reject)$/.test(c))).toBe(false);
    // Staff create, never decide; Managers decide.
    expect(ROLE_OPERATIONAL_PROFILE.DEPARTMENT_STAFF.tiers).not.toContain('MANAGE');
  });

  it('decides every transition in one table', () => {
    const actor = (over: Partial<PrActor> = {}): PrActor =>
      ({
        memberId: 'me',
        branches: [{ id: 'b1', code: '00001', name: 'B', type: 'BRANCH' }],
        createDepartments: ['WAREHOUSE'],
        decideDepartments: [],
        purchasingView: false,
        cancelApproved: false,
        ...over,
      }) as PrActor;
    const req = (status: any, over: J = {}) => ({
      status,
      department: 'WAREHOUSE' as DepartmentCode,
      branchId: 'b1',
      requesterMemberId: 'me',
      ...over,
    });
    expect(refusal(actor(), 'edit', req('DRAFT'))).toBeNull();
    expect(refusal(actor(), 'edit', req('SUBMITTED'))).toBe('status');
    expect(refusal(actor(), 'submit', req('DRAFT', { requesterMemberId: 'other' }))).toBe(
      'authority',
    );
    expect(refusal(actor({ createDepartments: [] }), 'submit', req('DRAFT'))).toBe('authority');
    expect(refusal(actor(), 'approve', req('SUBMITTED'))).toBe('authority');
    expect(
      refusal(actor({ decideDepartments: ['WAREHOUSE'] }), 'reject', req('SUBMITTED')),
    ).toBeNull();
    expect(refusal(actor({ decideDepartments: ['SALES'] }), 'approve', req('SUBMITTED'))).toBe(
      'authority',
    );
    expect(refusal(actor(), 'cancel', req('SUBMITTED'))).toBeNull();
    expect(refusal(actor(), 'cancel', req('APPROVED'))).toBe('authority');
    expect(refusal(actor({ cancelApproved: true }), 'cancel', req('APPROVED'))).toBeNull();
    for (const s of ['REJECTED', 'CANCELLED']) {
      for (const a of ['edit', 'submit', 'approve', 'reject', 'cancel'] as const) {
        expect(
          refusal(actor({ decideDepartments: ['WAREHOUSE'], cancelApproved: true }), a, req(s)),
        ).toBe('status');
      }
    }
    expect(refusal(actor(), 'edit', req('DRAFT', { branchId: 'b2' }))).toBe('branch');
  });

  it('dates in the company time zone', () => {
    expect(companyDay('Asia/Bangkok', new Date('2026-10-31T18:30:00Z'))).toBe('2026-11-01');
    expect(companyDay('UTC', new Date('2026-10-31T18:30:00Z'))).toBe('2026-10-31');
  });

  it('a request line has no commercial column', () => {
    for (const fields of [
      Prisma.PurchaseRequestScalarFieldEnum,
      Prisma.PurchaseRequestLineScalarFieldEnum,
    ]) {
      for (const f of Object.keys(fields)) expect(f).not.toMatch(FINANCIAL);
    }
  });
});

// ------------------------------------------------------------------ enforcement

describeDb('Purchase requests (EP29)', () => {
  let h: Harness;
  let A: { companyId: string; headOfficeId: string };
  let B: { companyId: string; headOfficeId: string };
  const br: Record<'HO' | 'X' | 'Y', string> = { HO: '', X: '', Y: '' };
  const ids: Record<string, string> = {};
  const it_: Record<string, string> = {};
  const PERIOD = companyDay('Asia/Bangkok').slice(0, 7).replace('-', '');

  // email, role, company, departments, branches (null = all)
  const PEOPLE: [string, CompanyRole, 'A' | 'B', DepartmentCode[], ('HO' | 'X' | 'Y')[] | null][] =
    [
      ['owner@a.example', 'COMPANY_OWNER', 'A', [], null],
      ['admin@a.example', 'SYSTEM_ADMIN', 'A', [], null],
      ['exec@a.example', 'EXECUTIVE', 'A', [], null],
      ['buyer@a.example', 'DEPARTMENT_MANAGER', 'A', ['PURCHASING'], null],
      ['buyer.staff@a.example', 'DEPARTMENT_STAFF', 'A', ['PURCHASING'], null],
      ['wh.staff@a.example', 'DEPARTMENT_STAFF', 'A', ['WAREHOUSE'], ['Y']],
      ['wh.mgr@a.example', 'DEPARTMENT_MANAGER', 'A', ['WAREHOUSE'], null],
      ['sales.staff@a.example', 'DEPARTMENT_STAFF', 'A', ['SALES'], ['HO']],
      ['multi@a.example', 'DEPARTMENT_STAFF', 'A', ['SALES', 'WAREHOUSE'], null],
      ['viewer@a.example', 'VIEWER', 'A', ['PURCHASING'], null],
      ['owner@b.example', 'COMPANY_OWNER', 'B', [], null],
    ];

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
    A = await createActiveCompany(h.db, {
      name: 'Alpha',
      departments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'],
    });
    B = await createActiveCompany(h.db, { name: 'Beta', departments: ['PURCHASING'] });
    br.HO = A.headOfficeId;
    for (const [key, c] of [
      ['X', '00001'],
      ['Y', '00002'],
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
      await h.db.user.update({ where: { id: u.id }, data: { fullName: email.split('@')[0] } });
      const m = await h.db.companyMember.findUniqueOrThrow({ where: { userId: u.id } });
      ids[email] = m.id;
      for (const d of depts) {
        const dept = await h.db.department.findFirstOrThrow({ where: { companyId, code: d } });
        await h.db.membership.create({ data: { userId: u.id, departmentId: dept.id } });
      }
      if (branches) {
        await h.db.companyMember.update({
          where: { id: m.id },
          data: {
            branchScope: 'SELECTED_BRANCHES',
            branchAccess: { create: branches.map((b) => ({ branchId: br[b] })) },
          },
        });
      }
    }
    const unit = (companyId: string, code: string, precision: number) =>
      h.db.unit.create({ data: { companyId, code, name: code, precision } });
    const pcs = await unit(A.companyId, 'PCS', 0);
    const kg = await unit(A.companyId, 'KG', 3);
    const item = (
      companyId: string,
      code: string,
      unitId: string,
      status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
    ) =>
      h.db.item.create({
        data: {
          companyId,
          code,
          type: 'RAW_MATERIAL',
          name: `Item ${code}`,
          baseUnitId: unitId,
          status,
          deactivatedAt: status === 'INACTIVE' ? new Date() : null,
        },
      });
    it_.pcs = pcs.id;
    it_.kg = kg.id;
    it_.box = (await item(A.companyId, 'BOX-1', pcs.id)).id;
    it_.oil = (await item(A.companyId, 'OIL-1', kg.id)).id;
    it_.old = (await item(A.companyId, 'OLD-1', pcs.id, 'INACTIVE')).id;
    const bpcs = await unit(B.companyId, 'PCS', 0);
    it_.foreign = (await item(B.companyId, 'B-1', bpcs.id)).id;
  });

  const as = async (email: string, branch?: 'HO' | 'X' | 'Y') => {
    const b = await signIn(h, email);
    await b.get('/api/v1/company/context');
    if (branch) {
      const res = await b.post('/api/v1/company/context/branch', { branchId: br[branch] });
      expect(res.statusCode, res.body).toBe(200);
    }
    return b;
  };
  const draft = async (b: Browser, body: J = {}) => {
    const res = await b.post(PR, {
      department: 'PURCHASING',
      purpose: 'Replenish packaging',
      lines: [{ type: 'ITEM', itemId: it_.box, quantity: '10' }],
      ...body,
    });
    expect(res.statusCode, res.body).toBe(201);
    return j(res).request;
  };
  const submitted = async (b: Browser, body: J = {}) => {
    const r = await draft(b, body);
    const res = await b.post(`${PR}/${r.id}/submit`);
    expect(res.statusCode, res.body).toBe(200);
    return j(res).request;
  };

  it('creates a numbered draft in the selected branch with server-derived lines', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const res = await buyer.post(PR, {
      department: 'PURCHASING',
      purpose: 'Office move',
      needByDate: '2099-01-31',
      lines: [
        { type: 'ITEM', itemId: it_.oil, quantity: '2.500', note: 'cold pressed' },
        { type: 'NON_ITEM', description: 'Electrician visit', quantity: '1', unitText: 'job' },
      ],
    });
    expect(res.statusCode, res.body).toBe(201);
    const body = j(res);
    expect(body.request).toMatchObject({
      number: `PR-${PERIOD}-000001`,
      status: 'DRAFT',
      department: 'PURCHASING',
      branch: { id: br.HO, code: '00000' },
      requester: { memberId: ids['buyer@a.example'], isMe: true },
      purpose: 'Office move',
      needByDate: '2099-01-31',
    });
    expect(body.request.lines).toEqual([
      expect.objectContaining({
        lineNo: 1,
        type: 'ITEM',
        item: { id: it_.oil, code: 'OIL-1', name: 'Item OIL-1', active: true },
        unit: { id: it_.kg, code: 'KG', name: 'KG' },
        quantity: '2.5',
        note: 'cold pressed',
      }),
      expect.objectContaining({
        lineNo: 2,
        type: 'NON_ITEM',
        item: null,
        description: 'Electrician visit',
        unit: { id: null, code: null, name: 'job' },
        quantity: '1',
      }),
    ]);
    expect(body.actions).toEqual(['edit', 'submit', 'cancel']);
    expect(body.timeline.map((t: J) => t.type)).toEqual(['PURCHASE_REQUEST_CREATED']);
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) {
          expect(k).not.toMatch(FINANCIAL);
          walk(x);
        }
    };
    walk(body);
    expect((await draft(buyer)).number).toBe(`PR-${PERIOD}-000002`);
  });

  it('refuses server-owned fields, client snapshots and float quantities', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const base = { department: 'PURCHASING' };
    for (const extra of [
      { status: 'APPROVED' },
      { number: 'PR-209901-000001' },
      { requesterMemberId: ids['wh.mgr@a.example'] },
      { companyId: B.companyId },
      { branchId: br.Y },
      { approvedByMemberId: ids['buyer@a.example'] },
      { approvedAt: new Date().toISOString() },
    ]) {
      expect((await buyer.post(PR, { ...base, ...extra })).statusCode, JSON.stringify(extra)).toBe(
        400,
      );
    }
    for (const line of [
      { type: 'ITEM', itemId: it_.box, quantity: '1', itemCode: 'FAKE' },
      { type: 'ITEM', itemId: it_.box, quantity: '1', unitId: it_.kg },
      { type: 'ITEM', itemId: it_.box, quantity: 1 },
      { type: 'ITEM', itemId: it_.box, quantity: '0' },
      { type: 'ITEM', itemId: it_.box, quantity: '-1' },
      { type: 'ITEM', itemId: it_.box, quantity: '1e3' },
      { type: 'ITEM', itemId: it_.box, quantity: '1', unitPrice: '9' },
      { type: 'NON_ITEM', description: 'x', quantity: '1', unitId: it_.pcs, unitText: 'job' },
    ]) {
      expect(
        (await buyer.post(PR, { ...base, lines: [line] })).statusCode,
        JSON.stringify(line),
      ).toBe(400);
    }
    // Status never moves through an edit.
    const r = await draft(buyer);
    expect((await buyer.patch(`${PR}/${r.id}`, { status: 'APPROVED' })).statusCode).toBe(400);
  });

  it('checks quantity precision, active items and units, and company of every reference', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const r = await draft(buyer);
    const add = (line: J) => buyer.post(`${PR}/${r.id}/lines`, line);
    const pcs = await add({ type: 'ITEM', itemId: it_.box, quantity: '1.5' });
    expect(j(pcs).error).toMatchObject({ code: 'QUANTITY_PRECISION', details: { precision: 0 } });
    expect((await add({ type: 'ITEM', itemId: it_.box, quantity: '2.000' })).statusCode).toBe(201);
    expect((await add({ type: 'ITEM', itemId: it_.oil, quantity: '1.234' })).statusCode).toBe(201);
    expect(code(await add({ type: 'ITEM', itemId: it_.oil, quantity: '1.2345' }))).toBe(
      'QUANTITY_PRECISION',
    );
    expect(j(await add({ type: 'ITEM', itemId: it_.old, quantity: '1' })).error).toMatchObject({
      code: 'REFERENCE_INACTIVE',
      details: { field: 'itemId' },
    });
    expect(j(await add({ type: 'ITEM', itemId: it_.foreign, quantity: '1' })).error).toMatchObject({
      code: 'REFERENCE_NOT_FOUND',
      details: { field: 'itemId' },
    });
    await h.db.unit.update({
      where: { id: it_.kg },
      data: { status: 'INACTIVE', deactivatedAt: new Date() },
    });
    expect(
      j(await add({ type: 'NON_ITEM', description: 'x', quantity: '1', unitId: it_.kg })).error,
    ).toMatchObject({ code: 'REFERENCE_INACTIVE', details: { field: 'unitId' } });
    expect(code(await add({ type: 'ITEM', itemId: it_.oil, quantity: '1' }))).toBe(
      'REFERENCE_INACTIVE',
    );
    // The database refuses a line pointing into another company even past the API.
    await expect(
      h.db.purchaseRequestLine.create({
        data: {
          companyId: A.companyId,
          purchaseRequestId: r.id,
          lineNo: 99,
          type: 'ITEM',
          itemId: it_.foreign,
          itemCode: 'B-1',
          itemName: 'x',
          unitId: it_.pcs,
          unitCode: 'PCS',
          quantity: '1',
        },
      }),
    ).rejects.toThrow();
  });

  it('edits a draft: header, lines added / changed / removed with stable numbers', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const r = await draft(buyer, { lines: [] });
    const l1 = j(
      await buyer.post(`${PR}/${r.id}/lines`, { type: 'ITEM', itemId: it_.box, quantity: '1' }),
    ).request.lines[0];
    await buyer.post(`${PR}/${r.id}/lines`, {
      type: 'NON_ITEM',
      description: 'Cleaning',
      quantity: '3',
    });
    const l3 = j(
      await buyer.post(`${PR}/${r.id}/lines`, { type: 'ITEM', itemId: it_.oil, quantity: '4' }),
    ).request.lines[2];
    await buyer.delete(
      `${PR}/${r.id}/lines/${j(await buyer.get(`${PR}/${r.id}`)).request.lines[1].id}`,
    );
    const after = j(
      await buyer.post(`${PR}/${r.id}/lines`, {
        type: 'NON_ITEM',
        description: 'Paint',
        quantity: '2',
      }),
    );
    expect(after.request.lines.map((l: J) => l.lineNo)).toEqual([1, 3, 4]);
    const changed = j(
      await buyer.patch(`${PR}/${r.id}/lines/${l1.id}`, {
        type: 'ITEM',
        itemId: it_.oil,
        quantity: '0.5',
        note: 'less',
      }),
    );
    expect(changed.request.lines[0]).toMatchObject({
      lineNo: 1,
      item: { code: 'OIL-1' },
      quantity: '0.5',
    });
    expect(
      code(
        await buyer.patch(`${PR}/${r.id}/lines/${l3.id}x`, {
          type: 'NON_ITEM',
          description: 'x',
          quantity: '1',
        }),
      ),
    ).toBe('PR_LINE_NOT_FOUND');
    const head = j(
      await buyer.patch(`${PR}/${r.id}`, { purpose: 'Updated', needByDate: '2099-12-31' }),
    );
    expect(head.request).toMatchObject({ purpose: 'Updated', needByDate: '2099-12-31' });
    const actions = (
      await h.db.auditLog.findMany({ where: { entityId: r.id }, orderBy: { occurredAt: 'asc' } })
    ).map((a) => a.action);
    expect(actions).toEqual([
      'PURCHASE_REQUEST_CREATED',
      'PURCHASE_REQUEST_LINE_ADDED',
      'PURCHASE_REQUEST_LINE_ADDED',
      'PURCHASE_REQUEST_LINE_ADDED',
      'PURCHASE_REQUEST_LINE_REMOVED',
      'PURCHASE_REQUEST_LINE_ADDED',
      'PURCHASE_REQUEST_LINE_UPDATED',
      'PURCHASE_REQUEST_UPDATED',
    ]);
    expect(JSON.stringify(await h.db.auditLog.findMany({ where: { entityId: r.id } }))).not.toMatch(
      /Cleaning|Paint|Updated/,
    );
  });

  it('submit validates, snapshots and locks the content', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const empty = await draft(buyer, { purpose: null, lines: [] });
    expect(j(await buyer.post(`${PR}/${empty.id}/submit`)).error).toMatchObject({
      code: 'PR_INCOMPLETE',
      details: { missing: ['purpose', 'lines'] },
    });
    const late = await draft(buyer, { needByDate: '2000-01-01' });
    expect(j(await buyer.post(`${PR}/${late.id}/submit`)).error.details).toEqual({
      missing: ['needByDate'],
    });
    const r = await draft(buyer);
    await h.db.item.update({ where: { id: it_.box }, data: { name: 'Box renamed' } });
    const done = j(await buyer.post(`${PR}/${r.id}/submit`));
    expect(done.request).toMatchObject({
      status: 'SUBMITTED',
      branch: { code: '00000' },
      requester: { name: 'buyer' },
    });
    expect(done.request.submittedAt).toBeTruthy();
    expect(done.request.lines[0].item.name).toBe('Box renamed');
    // Frozen: renaming later changes nothing on the submitted request.
    await h.db.item.update({ where: { id: it_.box }, data: { name: 'Renamed again' } });
    await h.db.branch.update({ where: { id: br.HO }, data: { name: 'New HO name' } });
    const again = j(await buyer.get(`${PR}/${r.id}`)).request;
    expect(again.lines[0].item.name).toBe('Box renamed');
    expect(again.branch.name).toBe('Head Office');
    for (const res of [
      await buyer.patch(`${PR}/${r.id}`, { purpose: 'x' }),
      await buyer.post(`${PR}/${r.id}/lines`, {
        type: 'NON_ITEM',
        description: 'x',
        quantity: '1',
      }),
      await buyer.delete(`${PR}/${r.id}/lines/${again.lines[0].id}`),
    ]) {
      expect(code(res)).toBe('PR_NOT_EDITABLE');
    }
    expect(code(await buyer.post(`${PR}/${r.id}/submit`))).toBe('PR_INVALID_TRANSITION');
    // An item deactivated while the request is a draft blocks the submit.
    const d2 = await draft(buyer);
    await h.db.item.update({
      where: { id: it_.box },
      data: { status: 'INACTIVE', deactivatedAt: new Date() },
    });
    expect(j(await buyer.post(`${PR}/${d2.id}/submit`)).error).toMatchObject({
      code: 'PR_LINE_INACTIVE',
      details: { lineNo: 1 },
    });
    // …while the submitted one keeps showing it (inactive) as history.
    expect(j(await buyer.get(`${PR}/${r.id}`)).request.lines[0].item.active).toBe(false);
  });

  it('approve, reject with reason, cancel rules and terminal states', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const a = await submitted(buyer);
    const approved = j(await buyer.post(`${PR}/${a.id}/approve`));
    expect(approved.request).toMatchObject({ status: 'APPROVED', approvedBy: { name: 'buyer' } });
    expect(approved.actions).toEqual(['cancel']);
    expect(approved.timeline.map((t: J) => [t.type, t.actor?.name])).toEqual([
      ['PURCHASE_REQUEST_CREATED', 'buyer'],
      ['PURCHASE_REQUEST_SUBMITTED', 'buyer'],
      ['PURCHASE_REQUEST_APPROVED', 'buyer'],
    ]);
    expect(code(await buyer.post(`${PR}/${a.id}/approve`))).toBe('PR_INVALID_TRANSITION');
    expect(code(await buyer.post(`${PR}/${a.id}/reject`, { reason: 'x' }))).toBe(
      'PR_INVALID_TRANSITION',
    );
    expect(code(await buyer.post(`${PR}/${a.id}/cancel`, {}))).toBe('REASON_REQUIRED');
    expect(
      j(await buyer.post(`${PR}/${a.id}/cancel`, { reason: 'Project stopped' })).request,
    ).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Project stopped',
      approvedBy: { name: 'buyer' },
    });

    const r = await submitted(buyer);
    expect((await buyer.post(`${PR}/${r.id}/reject`, {})).statusCode).toBe(400);
    const rejected = j(await buyer.post(`${PR}/${r.id}/reject`, { reason: 'Use existing stock' }));
    expect(rejected.request).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Use existing stock',
      rejectedBy: { name: 'buyer' },
    });
    expect(rejected.actions).toEqual([]);
    expect(code(await buyer.post(`${PR}/${r.id}/cancel`, { reason: 'x' }))).toBe(
      'PR_INVALID_TRANSITION',
    );

    // The requester cancels a draft freely, a submitted one with a reason, an approved one never.
    const staff = await as('buyer.staff@a.example', 'HO');
    const d = await draft(staff);
    expect(j(await staff.post(`${PR}/${d.id}/cancel`, {})).request.status).toBe('CANCELLED');
    const s = await submitted(staff);
    expect(code(await staff.post(`${PR}/${s.id}/cancel`, {}))).toBe('REASON_REQUIRED');
    expect(
      j(await staff.post(`${PR}/${s.id}/cancel`, { reason: 'Duplicate' })).request.status,
    ).toBe('CANCELLED');
    const s2 = await submitted(staff);
    await buyer.post(`${PR}/${s2.id}/approve`);
    expect(code(await staff.post(`${PR}/${s2.id}/cancel`, { reason: 'x' }))).toBe(
      'PERMISSION_DENIED',
    );
  });

  it('Staff, Viewer, Executive and System Admin never decide or mutate others’ requests', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const r = await submitted(buyer);
    const staff = await as('buyer.staff@a.example', 'HO');
    expect(j(await staff.get(`${PR}/${r.id}`)).actions).toEqual([]);
    expect(code(await staff.post(`${PR}/${r.id}/approve`))).toBe('PERMISSION_DENIED');
    expect(code(await staff.post(`${PR}/${r.id}/reject`, { reason: 'x' }))).toBe(
      'PERMISSION_DENIED',
    );
    expect(code(await staff.post(`${PR}/${r.id}/cancel`, { reason: 'x' }))).toBe(
      'PERMISSION_DENIED',
    );
    for (const email of ['viewer@a.example', 'exec@a.example']) {
      const b = await as(email, 'HO');
      const seen = j(await b.get(`${PR}/${r.id}`));
      expect(seen.request.number, email).toBe(r.number);
      expect(seen.actions, email).toEqual([]);
      for (const res of [
        await b.post(`${PR}/${r.id}/approve`),
        await b.post(`${PR}/${r.id}/reject`, { reason: 'x' }),
        await b.post(`${PR}/${r.id}/cancel`, { reason: 'x' }),
        await b.patch(`${PR}/${r.id}`, { purpose: 'x' }),
        await b.post(`${PR}/${r.id}/lines`, { type: 'NON_ITEM', description: 'x', quantity: '1' }),
        await b.post(PR, { department: 'PURCHASING' }),
      ]) {
        expect(res.statusCode, email).toBe(403);
      }
    }
    const admin = await as('admin@a.example', 'HO');
    expect(j(await admin.get(`${PR}/context`))).toMatchObject({
      createDepartments: [],
      decideDepartments: [],
      purchasingView: false,
    });
    expect(code(await admin.get(`${PR}/${r.id}`))).toBe('PR_NOT_FOUND');
    expect(code(await admin.post(PR, { department: 'PURCHASING' }))).toBe('DEPARTMENT_NOT_ALLOWED');
    expect(j(await buyer.get(`${PR}/${r.id}`)).request.status).toBe('SUBMITTED');
  });

  it('department managers decide their own department; branches and departments cannot be tampered with', async () => {
    // Warehouse staff works in branch Y only.
    const wh = await as('wh.staff@a.example');
    expect(j(await wh.get('/api/v1/company/context')).selected.code).toBe('00002');
    expect(code(await wh.post('/api/v1/company/context/branch', { branchId: br.HO }))).toBe(
      'BRANCH_NOT_ALLOWED',
    );
    expect(code(await wh.post(PR, { department: 'PURCHASING' }))).toBe('DEPARTMENT_NOT_ALLOWED');
    const mine = await submitted(wh, { department: 'WAREHOUSE', purpose: 'Pallets for branch Y' });
    expect(mine.branch.code).toBe('00002');
    expect(code(await wh.post(`${PR}/${mine.id}/approve`))).toBe('PERMISSION_DENIED');

    const sales = await as('sales.staff@a.example');
    expect(code(await sales.post(PR, { department: 'WAREHOUSE' }))).toBe('DEPARTMENT_NOT_ALLOWED');
    const salesPr = await submitted(sales, { department: 'SALES', purpose: 'Samples' });
    expect(salesPr.branch.code).toBe('00000');
    // Staff do not browse colleagues' requests; branch Y staff never see Head Office.
    expect(code(await wh.get(`${PR}/${salesPr.id}`))).toBe('PR_NOT_FOUND');
    expect(j(await wh.get(`${PR}?branchId=${br.HO}`)).total).toBe(0);
    expect(code(await sales.get(`${PR}/${mine.id}`))).toBe('PR_NOT_FOUND');

    // The warehouse manager decides warehouse requests only.
    const mgr = await as('wh.mgr@a.example', 'Y');
    expect(j(await mgr.get(`${PR}?view=queue`)).items.map((x: J) => x.number)).toEqual([
      mine.number,
    ]);
    expect(code(await mgr.get(`${PR}/${salesPr.id}`))).toBe('PR_NOT_FOUND');
    expect(j(await mgr.post(`${PR}/${mine.id}/approve`)).request.status).toBe('APPROVED');
    expect(code(await mgr.post(`${PR}/${mine.id}/cancel`, { reason: 'x' }))).toBe(
      'PERMISSION_DENIED',
    );

    // Several departments: choose among one's own only.
    const multi = await as('multi@a.example', 'X');
    expect(j(await multi.get(`${PR}/context`)).createDepartments).toEqual(['SALES', 'WAREHOUSE']);
    expect((await multi.post(PR, { department: 'WAREHOUSE' })).statusCode).toBe(201);
    expect(code(await multi.post(PR, { department: 'OPERATIONS' }))).toBe('DEPARTMENT_NOT_ALLOWED');
    const own = j(await multi.post(PR, { department: 'SALES' })).request;
    expect(code(await multi.patch(`${PR}/${own.id}`, { department: 'PURCHASING' }))).toBe(
      'DEPARTMENT_NOT_ALLOWED',
    );
    // No selected branch → no new request.
    const owner = await signIn(h, 'owner@a.example');
    expect(code(await owner.post(PR, { department: 'OPERATIONS' }))).toBe('BRANCH_REQUIRED');
    // Losing branch access closes the request's actions (it stays the requester's to read).
    await h.db.memberBranchAccess.deleteMany({ where: { memberId: ids['multi@a.example'] } });
    await h.db.companyMember.update({
      where: { id: ids['multi@a.example'] },
      data: { branchScope: 'SELECTED_BRANCHES', branchAccess: { create: [{ branchId: br.Y }] } },
    });
    expect(j(await multi.get(`${PR}/${own.id}`)).actions).toEqual([]);
    expect(code(await multi.post(`${PR}/${own.id}/submit`))).toBe('BRANCH_NOT_ALLOWED');
  });

  it('lists by view with filters, search and pages', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const staff = await as('buyer.staff@a.example', 'X');
    await draft(staff, { purpose: 'Staff draft' }); // invisible to the buyer
    const s1 = await submitted(staff, { purpose: 'Tape and labels' });
    await draft(buyer, { purpose: 'Buyer draft' });
    const s2 = await submitted(buyer, { purpose: 'Forklift service' });
    await buyer.post(`${PR}/${s2.id}/approve`);
    const list = async (b: Browser, qs: string) => j(await b.get(`${PR}?${qs}`));
    expect((await list(buyer, 'view=all')).items.map((x: J) => x.purpose).sort()).toEqual(
      ['Buyer draft', 'Forklift service', 'Tape and labels'].sort(),
    );
    expect((await list(buyer, 'view=mine')).total).toBe(2);
    expect((await list(buyer, 'view=queue')).items.map((x: J) => x.number)).toEqual([s1.number]);
    expect((await list(buyer, 'status=APPROVED')).items[0]).toMatchObject({
      number: s2.number,
      lineCount: 1,
      requester: { name: 'buyer', isMe: true },
    });
    expect((await list(buyer, `branchId=${br.X}`)).total).toBe(1);
    expect((await list(buyer, 'q=forklift')).total).toBe(1);
    expect((await list(buyer, `q=${s1.number}`)).total).toBe(1);
    expect((await list(buyer, 'q=buyer.staff')).total).toBe(1);
    expect((await list(buyer, 'department=SALES')).total).toBe(0);
    const today = companyDay('Asia/Bangkok');
    expect((await list(buyer, `from=${today}&to=${today}`)).total).toBe(3);
    expect((await list(buyer, 'from=2099-01-01')).total).toBe(0);
    const p1 = await list(buyer, 'pageSize=2&sort=number');
    expect(p1).toMatchObject({ total: 3, hasMore: true, page: 1 });
    // Purchasing staff see the Purchasing queue (every non-draft request) plus their own drafts.
    expect((await list(staff, 'view=all')).total).toBe(3);
    expect((await list(staff, 'view=department')).total).toBe(0);
    expect((await buyer.get(`${PR}?sort=status`)).statusCode).toBe(400);
    expect((await buyer.get(`${PR}?view=everything`)).statusCode).toBe(400);
  });

  it('IDOR: another company sees, decides and references nothing', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const r = await submitted(buyer);
    const line = r.lines[0];
    const other = await signIn(h, 'owner@b.example');
    await other.get('/api/v1/company/context');
    for (const res of [
      await other.get(`${PR}/${r.id}`),
      await other.patch(`${PR}/${r.id}`, { purpose: 'x' }),
      await other.post(`${PR}/${r.id}/lines`, {
        type: 'NON_ITEM',
        description: 'x',
        quantity: '1',
      }),
      await other.patch(`${PR}/${r.id}/lines/${line.id}`, {
        type: 'NON_ITEM',
        description: 'x',
        quantity: '1',
      }),
      await other.delete(`${PR}/${r.id}/lines/${line.id}`),
      await other.post(`${PR}/${r.id}/submit`),
      await other.post(`${PR}/${r.id}/approve`),
      await other.post(`${PR}/${r.id}/reject`, { reason: 'x' }),
      await other.post(`${PR}/${r.id}/cancel`, { reason: 'x' }),
    ]) {
      expect(code(res)).toBe('PR_NOT_FOUND');
    }
    expect(j(await other.get(PR)).total).toBe(0);
    const theirs = j(await other.post(PR, { department: 'PURCHASING', lines: [] })).request;
    expect(theirs.number).toBe(`PR-${PERIOD}-000001`);
    expect(
      code(
        await other.post(`${PR}/${theirs.id}/lines`, {
          type: 'ITEM',
          itemId: it_.box,
          quantity: '1',
        }),
      ),
    ).toBe('REFERENCE_NOT_FOUND');
    expect(code(await other.delete(`${PR}/${theirs.id}/lines/${line.id}`))).toBe(
      'PR_LINE_NOT_FOUND',
    );
    expect(j(await other.get(`${PR}/item-options`)).items.map((i: J) => i.code)).toEqual(['B-1']);
    // Item options: active items only, safe identity only.
    const opts = j(await buyer.get(`${PR}/item-options`)).items;
    expect(opts.map((i: J) => i.code)).toEqual(['BOX-1', 'OIL-1']);
    expect(Object.keys(opts[0]).sort()).toEqual(['code', 'id', 'name', 'type', 'unit']);
    expect(j(await buyer.get(`${PR}/item-options?q=oil`)).items).toHaveLength(1);
    // Platform Inspection: request events without details.
    await createUser(h.db, 'op@pdabliss.example', { platformRole: 'PLATFORM_ADMIN' });
    const op = await signIn(h, 'op@pdabliss.example');
    expect((await op.get(PR)).statusCode).toBe(403);
    const insp = await op.get(`/api/v1/platform/companies/${A.companyId}`);
    const events = j(insp).activity.filter((e: J) => e.entityType === 'PurchaseRequest');
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e: J) => Object.keys(e.details).length === 0)).toBe(true);
    expect(insp.body).not.toContain(r.number);
  });

  it('concurrency: unique numbers; one decision wins', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const N = 12;
    const created = await Promise.all(
      Array.from({ length: N }, () =>
        buyer.post(PR, {
          department: 'PURCHASING',
          purpose: 'p',
          lines: [{ type: 'ITEM', itemId: it_.box, quantity: '1' }],
        }),
      ),
    );
    const numbers = created.map((c) => j(c).request.number as string).sort();
    expect(new Set(numbers).size).toBe(N);
    expect(numbers).toEqual(
      Array.from({ length: N }, (_, i) => `PR-${PERIOD}-${String(i + 1).padStart(6, '0')}`),
    );
    const owner = await as('owner@a.example', 'HO');
    for (const c of created.slice(0, 6)) {
      const id = j(c).request.id;
      await buyer.post(`${PR}/${id}/submit`);
      const results = await Promise.all([
        buyer.post(`${PR}/${id}/approve`),
        owner.post(`${PR}/${id}/reject`, { reason: 'race' }),
        owner.post(`${PR}/${id}/approve`),
      ]);
      expect(results.filter((x) => x.statusCode === 200)).toHaveLength(1);
      for (const x of results.filter((y) => y.statusCode !== 200)) {
        expect(['PR_STATE_CHANGED', 'PR_INVALID_TRANSITION']).toContain(code(x));
      }
      const decisions = await h.db.auditLog.count({
        where: {
          entityId: id,
          action: { in: ['PURCHASE_REQUEST_APPROVED', 'PURCHASE_REQUEST_REJECTED'] },
        },
      });
      expect(decisions).toBe(1);
    }
  });

  it('the database keeps decisions consistent and quantities positive', async () => {
    const buyer = await as('buyer@a.example', 'HO');
    const r = await draft(buyer);
    await expect(
      h.db.purchaseRequest.update({ where: { id: r.id }, data: { status: 'APPROVED' } }),
    ).rejects.toThrow();
    await expect(
      h.db.purchaseRequest.update({
        where: { id: r.id },
        data: {
          status: 'REJECTED',
          submittedAt: new Date(),
          rejectedAt: new Date(),
          rejectedByMemberId: ids['buyer@a.example'],
        },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.purchaseRequestLine.updateMany({
        where: { purchaseRequestId: r.id },
        data: { quantity: '0' },
      }),
    ).rejects.toThrow();
    await expect(
      h.db.purchaseRequest.update({ where: { id: r.id }, data: { number: 'X-1' } }),
    ).rejects.toThrow();
  });
});
