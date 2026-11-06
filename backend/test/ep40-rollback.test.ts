import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { RequestMeta } from '../src/auth/audit.js';
import { bootstrapPlatform, parseSeedEnv, seedDemo } from '../src/auth/bootstrap.js';
import type { AuthContext } from '../src/auth/sessions.js';
import type { Db } from '../src/db/client.js';
import { DEMO_PERSONAS } from '../src/demo/personas.js';
import { MaterialIssueService } from '../src/production/issues.js';
import { FinishedGoodsService } from '../src/production/receipts.js';
import { PurchaseRequestService } from '../src/purchasing/service.js';
import { SalesOrderService } from '../src/sales/service.js';
import { FulfilmentService } from '../src/warehouse/fulfilment.js';
import { ReceivingService } from '../src/warehouse/service.js';
import { createHarness, describeDb, resetDb, type Harness } from './support.js';

/*
 * EP40 transaction rollback: a failure is injected INSIDE the real service
 * transactions — after the balance / reservation / status writes of the step
 * and just before (or at) its last write — and nothing of the business effect
 * may remain: no movement, no balance change, no new lot, no consumed
 * reservation, no status change, no audit entry. Test-only: the failure comes
 * from a Prisma client extension around the test database; production code is
 * untouched.
 */

const PASSWORDS = Object.fromEntries(
  DEMO_PERSONAS.map((p) => [p.passwordEnv, `${p.key.toLowerCase()} fixture passphrase 7`]),
);
const ENV = {
  NODE_ENV: 'development',
  PLATFORM_OWNER_EMAIL: 'the.owner@pdabliss.test',
  PLATFORM_OWNER_INITIAL_PASSWORD: 'owner fixture passphrase 1',
  ...PASSWORDS,
};
const META: RequestMeta = { requestId: 'ep40-rollback', ip: '127.0.0.1', userAgent: 'vitest' };

describeDb('EP40 transaction rollback', () => {
  let h: Harness;
  /** The model operation that fails next (once armed), e.g. 'stockMovement.create'. */
  let failOn: string | null = null;
  let faulty: Db;

  beforeAll(async () => {
    h = await createHarness({ NODE_ENV: 'development', ENABLE_DEMO_ROUTES: 'true' });
    faulty = h.db.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (failOn === `${model.charAt(0).toLowerCase()}${model.slice(1)}.${operation}`) {
              failOn = null;
              throw new Error(`EP40 injected failure at ${model}.${operation}`);
            }
            return query(args);
          },
        },
      },
    }) as unknown as Db;
  });
  afterAll(async () => h.close());
  beforeEach(async () => {
    failOn = null;
    await resetDb(h.db);
    const env = parseSeedEnv(ENV);
    await bootstrapPlatform(h.db, env);
    await seedDemo(h.db, env);
  }, 240_000);

  const ctxOf = async (email: string): Promise<AuthContext> => {
    const m = await h.db.companyMember.findFirstOrThrow({
      where: { user: { emailNormalized: email } },
      include: { user: true },
    });
    const branch = await h.db.branch.findFirstOrThrow({ where: { code: '00001' } });
    return { session: { branchId: branch.id }, user: m.user } as unknown as AuthContext;
  };
  const marker = async (key: string) =>
    (await h.db.auditLog.findFirstOrThrow({ where: { changes: { path: ['demo'], equals: key } } }))
      .entityId;
  /** Everything a failed step must leave exactly as it was. */
  const state = async () =>
    JSON.stringify({
      balances: (await h.db.stockBalance.findMany({ orderBy: { id: 'asc' } })).map((b) => [
        b.id,
        b.quantityOnHand.toString(),
      ]),
      movements: await h.db.stockMovement.count(),
      lots: await h.db.inventoryLot.count(),
      sales: (await h.db.salesAllocation.findMany({ orderBy: { id: 'asc' } })).map((a) => [
        a.id,
        a.status,
        a.quantity.toString(),
      ]),
      production: (
        await h.db.productionMaterialAllocation.findMany({ orderBy: { id: 'asc' } })
      ).map((a) => [a.id, a.status, a.quantity.toString()]),
      audit: await h.db.auditLog.count(),
    });
  const fails = async (on: string, step: () => Promise<unknown>) => {
    const before = await state();
    failOn = on;
    await expect(step()).rejects.toThrow(/EP40 injected failure/);
    expect(failOn, `the injection point ${on} was never reached`).toBeNull();
    expect(await state()).toBe(before);
  };

  it('goods receipt posting: a failure at the movement write leaves no stock, lot or status change', async () => {
    const wh = await ctxOf('warehouse.demo@pdabliss.com');
    const po = await marker('PO_EP39_AWAITING');
    const main = await h.db.warehouseLocation.findFirstOrThrow({
      where: { code: 'MAIN', branch: { code: '00001' } },
    });
    const svc = new ReceivingService(h.db);
    await svc.create(wh, { purchaseOrderId: po, defaultLocationId: main.id }, META);
    const gr = await h.db.goodsReceipt.findFirstOrThrow({
      where: { purchaseOrderId: po },
      include: { lines: true },
    });
    await svc.saveLine(
      wh,
      gr.id,
      gr.lines[0]!.id,
      {
        acceptedQuantity: '6',
        allocations: [
          { locationId: main.id, quantity: '6', lotNumber: 'EP40-ROLLBACK', expiryDate: null },
        ],
      },
      META,
    );
    await fails('stockMovement.create', () => new ReceivingService(faulty).post(wh, gr.id, META));
    expect((await h.db.goodsReceipt.findUniqueOrThrow({ where: { id: gr.id } })).status).toBe(
      'DRAFT',
    );
    expect(await h.db.inventoryLot.count({ where: { lotNumber: 'EP40-ROLLBACK' } })).toBe(0);
    // And the same step succeeds afterwards: nothing was left half-done.
    await new ReceivingService(h.db).post(wh, gr.id, META);
    expect((await h.db.goodsReceipt.findUniqueOrThrow({ where: { id: gr.id } })).status).toBe(
      'POSTED',
    );
  });

  it('sales dispatch: a failure after the reservation is consumed leaves it active and the stock in place', async () => {
    const wh = await ctxOf('warehouse.demo@pdabliss.com');
    const owner = await ctxOf('owner.demo@pdabliss.com');
    const so = await marker('SO_FUL_SHIPPED');
    const packs = await h.db.salesPack.findMany({
      where: { salesOrderId: so, status: 'PACKED' },
    });
    const ful = new FulfilmentService(h.db);
    const { shipment } = await ful.createShipment(
      wh,
      {
        salesOrderId: so,
        packIds: packs.map((p) => p.id),
        shipToAddress: 'EP40',
        carrier: 'EP40',
        trackingReference: null,
        note: null,
      },
      META,
    );
    await fails('stockMovement.create', () =>
      new FulfilmentService(faulty).dispatch(
        owner,
        shipment.id,
        { handedOverTo: 'EP40', note: null },
        META,
      ),
    );
    expect(
      (await h.db.salesShipment.findUniqueOrThrow({ where: { id: shipment.id } })).status,
    ).toBe('READY');
  });

  it('sales allocation: a failure at the audit entry leaves no reservation', async () => {
    const owner = await ctxOf('owner.demo@pdabliss.com');
    const so = await marker('SO_OPEN');
    await fails('auditLog.create', () => new SalesOrderService(faulty).allocate(owner, so, META));
    expect(await h.db.salesAllocation.count({ where: { salesOrderId: so } })).toBe(0);
  });

  it('purchase request approval: a failure at the audit entry leaves it submitted', async () => {
    const pur = await ctxOf('purchasing.demo@pdabliss.com');
    const branch = await h.db.branch.findFirstOrThrow({ where: { code: '00000' } });
    const hoPur = { ...pur, session: { ...pur.session, branchId: branch.id } } as AuthContext;
    const pr = await marker('PR_SUBMITTED_SALES');
    await fails('auditLog.create', () =>
      new PurchaseRequestService(faulty).approve(hoPur, pr, META),
    );
    expect((await h.db.purchaseRequest.findUniqueOrThrow({ where: { id: pr } })).status).toBe(
      'SUBMITTED',
    );
  });

  it('material issue posting: a failure at the last movement keeps every reservation and the issue draft', async () => {
    const ops = await ctxOf('operations.demo@pdabliss.com');
    const mo = await marker('MO_EXEC');
    const draft = await h.db.productionMaterialIssue.findFirstOrThrow({
      where: { productionOrderId: mo, status: 'DRAFT' },
    });
    await fails('stockMovement.create', () =>
      new MaterialIssueService(faulty).post(ops, draft.id, META),
    );
    expect(
      (await h.db.productionMaterialIssue.findUniqueOrThrow({ where: { id: draft.id } })).status,
    ).toBe('DRAFT');
  });

  it('finished goods receipt posting: a failure at the movement leaves the output unreceived', async () => {
    const wh = await ctxOf('warehouse.demo@pdabliss.com');
    const owner = await ctxOf('owner.demo@pdabliss.com');
    const mo = await marker('MO_EXEC');
    const out = await h.db.productionOutputReport.findFirstOrThrow({
      where: { productionOrderId: mo, status: 'ACCEPTED' },
    });
    const main = await h.db.warehouseLocation.findFirstOrThrow({
      where: { code: 'MAIN', branch: { code: '00001' } },
    });
    const fg = new FinishedGoodsService(h.db);
    const created = (await fg.create(
      wh,
      {
        outputReportId: out.id,
        lines: [
          {
            locationId: main.id,
            quantity: '2',
            lotNumber: 'EP40-FG',
            expiryDate: '2027-12-31',
            manufacturedDate: '2026-11-06',
          },
        ],
        note: null,
      },
      META,
    )) as { receipt: { id: string } };
    await fails('stockMovement.create', () =>
      new FinishedGoodsService(faulty).post(owner, created.receipt.id, META),
    );
    expect(
      (await h.db.productionGoodsReceipt.findUniqueOrThrow({ where: { id: created.receipt.id } }))
        .status,
    ).toBe('DRAFT');
  });
});
