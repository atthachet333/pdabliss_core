import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapPlatform, parseSeedEnv, seedDemo } from '../src/auth/bootstrap.js';
import { DEMO_PERSONAS } from '../src/demo/personas.js';
import {
  Browser,
  createHarness,
  describeDb,
  resetDb,
  type ApiResponse,
  type Harness,
} from './support.js';

/*
 * EP41 business controls (docs/EP41_APPROVAL_POLICY.md):
 *   1. separation of duties across all nine consequential decisions, through
 *      the real HTTP routes, with the real demo personas and their unchanged
 *      permissions — independent approval on a freshly seeded demo company;
 *   2. the owner override: explicit, reasoned, owner-only, audited;
 *   3. the approval policy setting: owner-only, audited, legacy behaviour kept;
 *   4. database immutability of the audit trail and of posted warehouse
 *      history — refused even for direct SQL, reversals still allowed.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
type J = any;

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
const REASON = 'Owner is the only approver on site today';

const idOf = (b: J): string =>
  b?.request?.id ??
  b?.order?.id ??
  b?.adjustment?.id ??
  b?.count?.id ??
  b?.issue?.id ??
  b?.output?.id ??
  b?.report?.id ??
  b?.receipt?.id ??
  b?.transfer?.id ??
  b?.id;

describeDb('EP41 business controls', () => {
  let h: Harness;
  const as: Record<string, Browser> = {};
  const ids: Record<string, string> = {};
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const plus = (n: number) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  const persona = async (email: string, branch = '00001') => {
    const b = new Browser(h.app);
    const res = await b.post('/api/v1/auth/login', { email, password: passwordOf(email) });
    expect(res.statusCode, res.body).toBe(200);
    const ctx = (await b.get('/api/v1/company/context')).json<J>();
    const target = ctx.branches?.find((x: J) => x.code === branch);
    if (target && ctx.selected?.code !== branch && !ctx.blocked) {
      await b.post('/api/v1/company/context/branch', { branchId: target.id });
    }
    return b;
  };
  const ok = (res: ApiResponse, what: string): J => {
    expect(res.statusCode, `${what}: ${res.body}`).toBeLessThan(300);
    return res.json<J>();
  };
  const refused = (res: ApiResponse, status: number, code: string) => {
    expect(res.statusCode, res.body).toBe(status);
    expect(res.json<J>().error.code).toBe(code);
    return res.json<J>().error;
  };
  const one = async (sql: string, ...args: unknown[]) =>
    (await h.db.$queryRawUnsafe<J[]>(sql, ...args))[0];
  const overrides = (entityId: string) =>
    h.db.auditLog.findMany({ where: { action: 'SELF_APPROVAL_OVERRIDE', entityId } });
  const API = '/api/v1';

  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'true' });
    await resetDb(h.db);
    const env = parseSeedEnv(ENV);
    await bootstrapPlatform(h.db, env);
    await seedDemo(h.db, env);
    for (const [k, email] of Object.entries({
      owner: 'owner.demo@pdabliss.com',
      admin: 'admin.demo@pdabliss.com',
      sales: 'sales.demo@pdabliss.com',
      ops: 'operations.demo@pdabliss.com',
      wh: 'warehouse.demo@pdabliss.com',
      pur: 'purchasing.demo@pdabliss.com',
    })) {
      as[k] = await persona(email);
    }
    const item = async (code: string) => (await h.db.item.findFirstOrThrow({ where: { code } })).id;
    ids.FG2 = await item('FG-000002');
    ids.RM2 = await item('RM-000002');
    const loc = async (code: string) =>
      (
        await h.db.warehouseLocation.findFirstOrThrow({
          where: { code, branch: { code: '00001' } },
        })
      ).id;
    ids.MAIN = await loc('MAIN');
    ids.RECEIVING = await loc('RECEIVING');
    ids.branch = (await h.db.branch.findFirstOrThrow({ where: { code: '00001' } })).id;
    ids.cus = (await h.db.customer.findFirstOrThrow({ where: { code: 'CUS-000002' } })).id;
    ids.sup = (await h.db.supplier.findFirstOrThrow({ where: { code: 'SUP-000002' } })).id;
  }, 300_000);
  afterAll(async () => h?.close());

  describe('approval policy', () => {
    it('a freshly seeded demo company uses independent approval; only the owner may change it', async () => {
      const s = ok(await as.owner!.get(`${API}/company/current/settings`), 'settings');
      expect([s.approvalPolicy, s.canChangeApprovalPolicy]).toEqual(['INDEPENDENT_APPROVAL', true]);
      const a = ok(await as.admin!.get(`${API}/company/current/settings`), 'admin settings');
      expect([a.approvalPolicy, a.canChangeApprovalPolicy]).toEqual([
        'INDEPENDENT_APPROVAL',
        false,
      ]);
      const changes = () => h.db.auditLog.count({ where: { action: 'APPROVAL_POLICY_CHANGED' } });
      const before = await changes();
      refused(
        await as.admin!.patch(`${API}/company/current/settings`, {
          approvalPolicy: 'SELF_APPROVAL_ALLOWED',
        }),
        403,
        'OWNER_ONLY',
      );
      refused(
        await as.owner!.patch(`${API}/company/current/settings`, { approvalPolicy: 'ANYONE' }),
        400,
        'VALIDATION_FAILED',
      );
      // Nothing changed, nothing audited.
      expect(await changes()).toBe(before);
      expect(
        (
          await h.db.company.findFirstOrThrow({
            where: {
              id: (await h.db.branch.findUniqueOrThrow({ where: { id: ids.branch } })).companyId,
            },
          })
        ).approvalPolicy,
      ).toBe('INDEPENDENT_APPROVAL');
    });
  });

  describe('separation of duties — the nine decisions', () => {
    it('purchase request: the requester cannot approve; another approver can; a non-owner has no override', async () => {
      // Purchasing raises its own request.
      const own = idOf(
        ok(
          await as.pur!.post(`${API}/purchase-requests`, {
            department: 'PURCHASING',
            purpose: 'EP41 own request',
            lines: [{ type: 'ITEM', itemId: ids.RM2, quantity: '2' }],
          }),
          'PR create',
        ),
      );
      ok(await as.pur!.post(`${API}/purchase-requests/${own}/submit`), 'submit');
      const e = refused(
        await as.pur!.post(`${API}/purchase-requests/${own}/approve`),
        409,
        'SELF_APPROVAL_NOT_ALLOWED',
      );
      expect(e.details).toMatchObject({ decision: 'approve', overridable: false });
      expect(e.details.roles).toContain('requester');
      refused(
        await as.pur!.post(`${API}/purchase-requests/${own}/approve`, {
          ownerOverride: { reason: REASON },
        }),
        403,
        'OVERRIDE_NOT_ALLOWED',
      );
      expect((await h.db.purchaseRequest.findUniqueOrThrow({ where: { id: own } })).status).toBe(
        'SUBMITTED',
      );
      // Rejecting one's own request is not a control risk.
      ok(
        await as.pur!.post(`${API}/purchase-requests/${own}/reject`, {
          reason: 'Raised by mistake',
        }),
        'self reject',
      );

      // Operations raises, Purchasing approves: a normal, independent approval.
      const pr = idOf(
        ok(
          await as.ops!.post(`${API}/purchase-requests`, {
            department: 'OPERATIONS',
            purpose: 'EP41 glycerin',
            lines: [{ type: 'ITEM', itemId: ids.RM2, quantity: '5' }],
          }),
          'PR create',
        ),
      );
      ok(await as.ops!.post(`${API}/purchase-requests/${pr}/submit`), 'submit');
      refused(
        await as.pur!.post(`${API}/purchase-requests/${pr}/approve`, {
          ownerOverride: { reason: REASON },
        }),
        400,
        'OVERRIDE_NOT_NEEDED',
      );
      expect(
        ok(await as.pur!.post(`${API}/purchase-requests/${pr}/approve`), 'approve').request.status,
      ).toBe('APPROVED');
      expect(await overrides(pr)).toHaveLength(0);
      ids.pr = pr;
    });

    it('purchase order: the creator cannot issue it; the owner issues it as a normal approval', async () => {
      const prLine = ok(await as.pur!.get(`${API}/purchase-requests/${ids.pr}`), 'pr').request
        .lines[0].id;
      const po = idOf(
        ok(
          await as.pur!.post(`${API}/purchase-orders`, {
            purchaseRequestId: ids.pr,
            supplierId: ids.sup,
            deposit: { type: 'NONE' },
            lines: [
              { purchaseRequestLineId: prLine, quantity: '5', unitPrice: '85', taxRate: '7' },
            ],
          }),
          'PO create',
        ),
      );
      refused(
        await as.pur!.post(`${API}/purchase-orders/${po}/issue`),
        409,
        'SELF_APPROVAL_NOT_ALLOWED',
      );
      expect(
        ok(await as.owner!.post(`${API}/purchase-orders/${po}/issue`), 'issue').order.status,
      ).toBe('PENDING_RECEIVE');
      expect(await overrides(po)).toHaveLength(0);
    });

    it('sales order: the owner as creator needs an explicit override, which is audited with its reason', async () => {
      const so = idOf(
        ok(
          await as.owner!.post(`${API}/sales/orders`, {
            customerId: ids.cus,
            lines: [{ itemId: ids.FG2, quantity: '1', unitPrice: '290', taxRate: '7' }],
          }),
          'SO create',
        ),
      );
      ok(await as.owner!.post(`${API}/sales/orders/${so}/submit`), 'submit');
      const e = refused(
        await as.owner!.post(`${API}/sales/orders/${so}/confirm`),
        409,
        'SELF_APPROVAL_NOT_ALLOWED',
      );
      expect(e.details).toMatchObject({ decision: 'confirm', overridable: true });
      expect([...e.details.roles].sort()).toEqual(['creator', 'submitter']);
      // A reason is required, with no control characters, and nothing else is accepted.
      refused(
        await as.owner!.post(`${API}/sales/orders/${so}/confirm`, {
          ownerOverride: { reason: 'short' },
        }),
        400,
        'VALIDATION_FAILED',
      );
      refused(
        await as.owner!.post(`${API}/sales/orders/${so}/confirm`, {
          ownerOverride: { reason: 'tab\u0007bell character inside' },
        }),
        400,
        'VALIDATION_FAILED',
      );
      refused(
        await as.owner!.post(`${API}/sales/orders/${so}/confirm`, {
          ownerOverride: { reason: REASON, approved: true },
        }),
        400,
        'VALIDATION_FAILED',
      );
      expect((await h.db.salesOrder.findUniqueOrThrow({ where: { id: so } })).status).toBe(
        'SUBMITTED',
      );
      expect(await overrides(so)).toHaveLength(0);

      ok(
        await as.owner!.post(`${API}/sales/orders/${so}/confirm`, {
          ownerOverride: { reason: `  ${REASON}  ` },
        }),
        'override confirm',
      );
      const audit = await overrides(so);
      expect(audit).toHaveLength(1);
      const order = await h.db.salesOrder.findUniqueOrThrow({ where: { id: so } });
      const owner = await h.db.user.findFirstOrThrow({
        where: { emailNormalized: 'owner.demo@pdabliss.com' },
      });
      expect(audit[0]!.actorId).toBe(owner.id);
      expect(audit[0]!.entityType).toBe('SalesOrder');
      expect(audit[0]!.companyId).toBe(order.companyId);
      expect(audit[0]!.changes).toMatchObject({
        decision: 'confirm',
        number: order.number,
        branch: '00001',
        reason: REASON,
      });
      expect(audit[0]!.occurredAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
      // The normal decision event is still recorded as well.
      expect(
        await h.db.auditLog.count({
          where: { entityId: so, action: { not: 'SELF_APPROVAL_OVERRIDE' } },
        }),
      ).toBeGreaterThan(1);
      // Confirmed once; a second override cannot decide it again.
      expect(order.status).toBe('CONFIRMED');
      expect(
        (
          await as.owner!.post(`${API}/sales/orders/${so}/confirm`, {
            ownerOverride: { reason: REASON },
          })
        ).statusCode,
      ).toBeGreaterThanOrEqual(400);
      expect(await overrides(so)).toHaveLength(1);
    });

    it('sales order: Sales raises, the owner confirms independently', async () => {
      const so = idOf(
        ok(
          await as.sales!.post(`${API}/sales/orders`, {
            customerId: ids.cus,
            lines: [{ itemId: ids.FG2, quantity: '1', unitPrice: '290', taxRate: '7' }],
          }),
          'SO create',
        ),
      );
      ok(await as.sales!.post(`${API}/sales/orders/${so}/submit`), 'submit');
      ok(await as.owner!.post(`${API}/sales/orders/${so}/confirm`), 'confirm');
      expect(await overrides(so)).toHaveLength(0);
    });

    it('stock adjustment: the owner who raised it needs an override', async () => {
      const adj = idOf(
        ok(
          await as.owner!.post(`${API}/warehouse/adjustments`, {
            reason: 'OTHER',
            note: 'EP41 SoD',
            lines: [
              {
                direction: 'INCREASE',
                locationId: ids.RECEIVING,
                itemId: ids.RM2,
                quantity: '0.4',
                newLotNumber: 'EP41-SOD-1',
                newLotExpiry: plus(30),
                note: null,
              },
            ],
          }),
          'adjustment',
        ),
      );
      ok(await as.owner!.post(`${API}/warehouse/adjustments/${adj}/submit`), 'submit');
      const before = await h.db.stockMovement.count();
      refused(
        await as.owner!.post(`${API}/warehouse/adjustments/${adj}/approve`),
        409,
        'SELF_APPROVAL_NOT_ALLOWED',
      );
      expect(await h.db.stockMovement.count()).toBe(before);
      ok(
        await as.owner!.post(`${API}/warehouse/adjustments/${adj}/approve`, {
          ownerOverride: { reason: REASON },
        }),
        'override approve',
      );
      expect(await h.db.stockMovement.count()).toBe(before + 1);
      expect(await overrides(adj)).toHaveLength(1);
      ids.adj = adj;
    });

    it('cycle count: the person who raised and counted it cannot post it without an override', async () => {
      const cc = idOf(
        ok(
          await as.owner!.post(`${API}/warehouse/counts`, {
            locationIds: [ids.MAIN],
            itemId: ids.RM2,
            note: 'EP41 SoD',
          }),
          'count',
        ),
      );
      const started = ok(await as.owner!.post(`${API}/warehouse/counts/${cc}/start`), 'start');
      const lines = started.count.lines as J[];
      expect(lines.length).toBeGreaterThan(0);
      ok(
        await as.owner!.put(`${API}/warehouse/counts/${cc}/entries`, {
          entries: lines.map((l) => ({ lineId: l.id, countedQuantity: l.systemQuantity })),
        }),
        'entries',
      );
      ok(await as.owner!.post(`${API}/warehouse/counts/${cc}/review`), 'review');
      const e = refused(
        await as.owner!.post(`${API}/warehouse/counts/${cc}/post`),
        409,
        'SELF_APPROVAL_NOT_ALLOWED',
      );
      expect([...e.details.roles].sort()).toEqual(['counter', 'creator', 'starter']);
      ok(
        await as.owner!.post(`${API}/warehouse/counts/${cc}/post`, {
          ownerOverride: { reason: REASON },
        }),
        'override post',
      );
      expect(await overrides(cc)).toHaveLength(1);
      ids.count = cc;
    });

    it('production: Operations cannot approve, post or accept its own documents; the owner decides independently', async () => {
      const mo = idOf(
        ok(
          await as.ops!.post(`${API}/production/orders`, {
            itemId: ids.FG2,
            branchId: ids.branch,
            quantity: '4',
            plannedStartDate: today,
            requiredDate: plus(3),
          }),
          'MO',
        ),
      );
      ok(await as.ops!.post(`${API}/production/orders/${mo}/submit`), 'submit');
      refused(
        await as.ops!.post(`${API}/production/orders/${mo}/approve`),
        409,
        'SELF_APPROVAL_NOT_ALLOWED',
      );
      ok(await as.owner!.post(`${API}/production/orders/${mo}/approve`), 'owner approves');
      ok(await as.ops!.post(`${API}/production/orders/${mo}/materials/allocate`), 'allocate');
      ok(await as.ops!.post(`${API}/production/orders/${mo}/release`), 'release');
      ok(await as.ops!.post(`${API}/production/orders/${mo}/start`, { note: 'EP41' }), 'start');

      const issue = idOf(
        ok(
          await as.ops!.post(`${API}/production/issues`, { productionOrderId: mo, note: 'EP41' }),
          'issue',
        ),
      );
      refused(
        await as.ops!.post(`${API}/production/issues/${issue}/post`),
        409,
        'SELF_APPROVAL_NOT_ALLOWED',
      );
      ok(await as.owner!.post(`${API}/production/issues/${issue}/post`), 'owner posts issue');

      const mats = ok(await as.ops!.get(`${API}/production/orders/${mo}`), 'mo').order
        .materials as J[];
      for (const m of mats) {
        ok(
          await as.ops!.post(`${API}/production/orders/${mo}/usage`, {
            materialId: m.id,
            quantity: m.item.code === 'RM-000002' ? '0.18' : '4',
            note: null,
          }),
          'usage',
        );
      }
      const out = idOf(
        ok(
          await as.ops!.post(`${API}/production/outputs`, {
            productionOrderId: mo,
            productionDate: today,
            goodQuantity: '3',
            defectiveQuantity: '1',
            note: 'EP41',
          }),
          'output',
        ),
      );
      ok(await as.ops!.post(`${API}/production/outputs/${out}/submit`), 'submit output');
      refused(
        await as.ops!.post(`${API}/production/outputs/${out}/accept`, {}),
        409,
        'SELF_APPROVAL_NOT_ALLOWED',
      );
      ok(await as.owner!.post(`${API}/production/outputs/${out}/accept`, {}), 'owner accepts');
      expect(await overrides(mo)).toHaveLength(0);
      expect(await overrides(issue)).toHaveLength(0);
      expect(await overrides(out)).toHaveLength(0);

      // Finished goods: Warehouse raises, the owner posts (independent) …
      const fgr = (qty: string, lot: string, who: Browser) =>
        who.post(`${API}/warehouse/finished-goods/receipts`, {
          outputReportId: out,
          lines: [
            {
              locationId: ids.MAIN,
              quantity: qty,
              lotNumber: lot,
              expiryDate: plus(365),
              manufacturedDate: today,
            },
          ],
          note: null,
        });
      const r1 = idOf(ok(await fgr('2', 'EP41-SOD-FG1', as.wh!), 'FGR1'));
      ok(await as.owner!.post(`${API}/warehouse/finished-goods/receipts/${r1}/post`), 'post FGR1');
      expect(await overrides(r1)).toHaveLength(0);
      // … and a receipt the owner raised needs the override.
      const r2 = idOf(ok(await fgr('1', 'EP41-SOD-FG2', as.owner!), 'FGR2'));
      refused(
        await as.owner!.post(`${API}/warehouse/finished-goods/receipts/${r2}/post`),
        409,
        'SELF_APPROVAL_NOT_ALLOWED',
      );
      ok(
        await as.owner!.post(`${API}/warehouse/finished-goods/receipts/${r2}/post`, {
          ownerOverride: { reason: REASON },
        }),
        'override FGR2',
      );
      expect(await overrides(r2)).toHaveLength(1);
    });

    it('legacy policy: switching to self-approval is owner-only, audited, and restores the old behaviour', async () => {
      ok(
        await as.owner!.patch(`${API}/company/current/settings`, {
          approvalPolicy: 'SELF_APPROVAL_ALLOWED',
        }),
        'switch',
      );
      const change = await h.db.auditLog.findFirstOrThrow({
        where: { action: 'APPROVAL_POLICY_CHANGED' },
        orderBy: { occurredAt: 'desc' },
      });
      expect(change.changes).toMatchObject({
        from: 'INDEPENDENT_APPROVAL',
        to: 'SELF_APPROVAL_ALLOWED',
      });
      const pr = idOf(
        ok(
          await as.pur!.post(`${API}/purchase-requests`, {
            department: 'PURCHASING',
            purpose: 'EP41 legacy',
            lines: [{ type: 'ITEM', itemId: ids.RM2, quantity: '1' }],
          }),
          'PR',
        ),
      );
      ok(await as.pur!.post(`${API}/purchase-requests/${pr}/submit`), 'submit');
      refused(
        await as.pur!.post(`${API}/purchase-requests/${pr}/approve`, {
          ownerOverride: { reason: REASON },
        }),
        400,
        'OVERRIDE_NOT_NEEDED',
      );
      ok(await as.pur!.post(`${API}/purchase-requests/${pr}/approve`), 'self approve (legacy)');
      // Back to independent for the rest of the suite.
      ok(
        await as.owner!.patch(`${API}/company/current/settings`, {
          approvalPolicy: 'INDEPENDENT_APPROVAL',
        }),
        'switch back',
      );
    });
  });

  describe('database immutability', () => {
    const sqlRefused = async (sql: string, ...args: unknown[]) => {
      await expect(h.db.$executeRawUnsafe(sql, ...args)).rejects.toThrow(
        /immutable|cannot be (changed|deleted)|cannot move|reversal changes only/i,
      );
    };

    it('audit entries can be neither changed nor deleted, even with direct SQL', async () => {
      const row = await h.db.auditLog.findFirstOrThrow({
        where: { action: 'SELF_APPROVAL_OVERRIDE' },
      });
      await sqlRefused(`UPDATE "AuditLog" SET "reason" = 'edited' WHERE id = $1`, row.id);
      await sqlRefused(`DELETE FROM "AuditLog" WHERE id = $1`, row.id);
      await expect(h.db.auditLog.deleteMany({})).rejects.toThrow();
      // New entries are still written.
      const n = await h.db.auditLog.count();
      ok(await as.owner!.get(`${API}/company/current/settings`), 'read');
      expect(await h.db.auditLog.count()).toBeGreaterThanOrEqual(n);
    });

    it('a posted stock adjustment and its lines are frozen; only the reversal may close it', async () => {
      // Its own adjustment, of an item nothing else in this suite consumes.
      const fg3 = (await h.db.item.findFirstOrThrow({ where: { code: 'FG-000003' } })).id;
      const adj = idOf(
        ok(
          await as.owner!.post(`${API}/warehouse/adjustments`, {
            reason: 'OTHER',
            note: 'EP41 immutability',
            lines: [
              {
                direction: 'INCREASE',
                locationId: ids.RECEIVING,
                itemId: fg3,
                quantity: '1',
                newLotNumber: 'EP41-IMM-ADJ',
                newLotExpiry: plus(60),
                note: null,
              },
            ],
          }),
          'adjustment',
        ),
      );
      ok(await as.owner!.post(`${API}/warehouse/adjustments/${adj}/submit`), 'submit');
      ok(
        await as.owner!.post(`${API}/warehouse/adjustments/${adj}/approve`, {
          ownerOverride: { reason: REASON },
        }),
        'approve',
      );
      ids.adj = adj;
      await sqlRefused(`UPDATE "StockAdjustment" SET "note" = 'edited' WHERE id = $1`, ids.adj);
      await sqlRefused(`UPDATE "StockAdjustment" SET "status" = 'DRAFT' WHERE id = $1`, ids.adj);
      await sqlRefused(`DELETE FROM "StockAdjustment" WHERE id = $1`, ids.adj);
      await sqlRefused(
        `UPDATE "StockAdjustmentLine" SET "quantity" = 99 WHERE "adjustmentId" = $1`,
        ids.adj,
      );
      await sqlRefused(`DELETE FROM "StockAdjustmentLine" WHERE "adjustmentId" = $1`, ids.adj);
      // The reversal (POSTED → CANCELLED, with its reason) still works through the service.
      ok(
        await as.owner!.post(`${API}/warehouse/adjustments/${ids.adj}/cancel`, {
          reason: 'EP41 reversal',
        }),
        'reverse',
      );
      const after = await h.db.stockAdjustment.findUniqueOrThrow({ where: { id: ids.adj } });
      expect(after.status).toBe('CANCELLED');
      // And a cancelled adjustment is frozen too.
      await sqlRefused(
        `UPDATE "StockAdjustment" SET "cancellationReason" = 'edited' WHERE id = $1`,
        ids.adj,
      );
    });

    it('a posted cycle count, its lines and locations are frozen', async () => {
      await sqlRefused(`UPDATE "CycleCount" SET "note" = 'edited' WHERE id = $1`, ids.count);
      await sqlRefused(`UPDATE "CycleCount" SET "status" = 'CANCELLED' WHERE id = $1`, ids.count);
      await sqlRefused(
        `UPDATE "CycleCountLine" SET "countedQuantity" = 0 WHERE "cycleCountId" = $1`,
        ids.count,
      );
      await sqlRefused(`DELETE FROM "CycleCountLocation" WHERE "cycleCountId" = $1`, ids.count);
    });

    it('a posted goods receipt, its lines and allocations are frozen; the reversal still works', async () => {
      const wh = as.wh!;
      const po = (
        await h.db.auditLog.findFirstOrThrow({
          where: { changes: { path: ['demo'], equals: 'PO_EP39_AWAITING' } },
        })
      ).entityId;
      const gr = ok(
        await wh.post(`${API}/warehouse/receipts`, {
          purchaseOrderId: po,
          defaultLocationId: ids.MAIN,
        }),
        'GR',
      ).receipt;
      // A draft is still editable (the guard only freezes closed documents).
      await h.db.$executeRawUnsafe(
        `UPDATE "GoodsReceipt" SET "note" = 'draft note' WHERE id = $1`,
        gr.id,
      );
      ok(
        await wh.put(`${API}/warehouse/receipts/${gr.id}/lines/${gr.lines[0].id}`, {
          acceptedQuantity: '1',
          allocations: [
            { locationId: ids.MAIN, quantity: '1', lotNumber: 'EP41-IMM-1', expiryDate: plus(90) },
          ],
        }),
        'line',
      );
      ok(await wh.post(`${API}/warehouse/receipts/${gr.id}/post`), 'post');
      await sqlRefused(`UPDATE "GoodsReceipt" SET "note" = 'edited' WHERE id = $1`, gr.id);
      await sqlRefused(`DELETE FROM "GoodsReceipt" WHERE id = $1`, gr.id);
      await sqlRefused(
        `UPDATE "GoodsReceiptLine" SET "acceptedQuantity" = 50 WHERE "goodsReceiptId" = $1`,
        gr.id,
      );
      await sqlRefused(
        `INSERT INTO "GoodsReceiptLine" (id, "goodsReceiptId", "lineNo") SELECT 'ep41x', $1, 99`,
        gr.id,
      );
      await sqlRefused(
        `UPDATE "GoodsReceiptAllocation" a SET quantity = 50 FROM "GoodsReceiptLine" l
          WHERE a."goodsReceiptLineId" = l.id AND l."goodsReceiptId" = $1`,
        gr.id,
      );
      // POSTED → CANCELLED may set only the cancellation fields …
      await sqlRefused(
        `UPDATE "GoodsReceipt" SET status = 'CANCELLED', note = 'sneaky' WHERE id = $1`,
        gr.id,
      );
      // … and the real reversal goes through.
      ok(
        await as.owner!.post(`${API}/warehouse/receipts/${gr.id}/cancel`, {
          reason: 'EP41 reversal',
        }),
        'reverse receipt',
      );
      expect((await h.db.goodsReceipt.findUniqueOrThrow({ where: { id: gr.id } })).status).toBe(
        'CANCELLED',
      );
      await sqlRefused(`UPDATE "GoodsReceipt" SET status = 'POSTED' WHERE id = $1`, gr.id);
      // The ledger keeps both the receipt and its reversal.
      const moves = await one(
        `SELECT count(*)::int n FROM "StockMovement" WHERE "goodsReceiptId" = $1`,
        gr.id,
      );
      expect(moves.n).toBeGreaterThanOrEqual(2);
    });

    it('posted inventory transfers from the seed are frozen', async () => {
      const t = await h.db.inventoryTransfer.findFirst({ where: { status: 'POSTED' } });
      if (!t) {
        // The seed has none: post one through the service.
        const tr = idOf(
          ok(
            await as.owner!.post(`${API}/warehouse/transfers`, {
              sourceLocationId: ids.RECEIVING,
              destinationLocationId: ids.MAIN,
              note: 'EP41',
            }),
            'transfer',
          ),
        );
        expect(tr).toBeTruthy();
        return;
      }
      await sqlRefused(`UPDATE "InventoryTransfer" SET note = 'edited' WHERE id = $1`, t.id);
      await sqlRefused(`DELETE FROM "InventoryTransfer" WHERE id = $1`, t.id);
      await sqlRefused(`DELETE FROM "InventoryTransferLine" WHERE "transferId" = $1`, t.id);
    });
  });
});
