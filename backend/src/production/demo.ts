import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import type { Db } from '../db/client.js';
import { AdjustmentService } from '../warehouse/adjustments.js';
import { BomService } from './bom.js';
import { MaterialIssueService } from './issues.js';
import { loadProductionActor } from './policy.js';
import { ProductionOrderService } from './service.js';

/*
 * Demo production planning (EP36), in the demo branch (00001), driven through
 * the REAL services (same validation, same arithmetic, audit scope 'seed').
 * operations.demo — the Operations MANAGER persona, role and branches
 * unchanged — owns the BOMs and the orders (falls back to the owner when its
 * password is not configured). Nothing here touches stock: planning only.
 *
 *   BOM-FG-000001 R1   RETIRED (history: 0.3 kg raw material + 1 box per piece)
 *   BOM-FG-000001 R2   ACTIVE  (0.25 kg raw material RM-000001 + 1 box PK-000001 per piece)
 *   MO_DRAFT           manual, 4 pieces, draft
 *   MO_SUBMITTED       manual, 6 pieces, awaiting approval
 *   MO_APPROVED        manual, 8 pieces, approved (requirements frozen)
 *   MO_SHORTAGE        manual, 40 pieces, approved — needs 10 kg raw material: short
 *   MO_SALES           sales demand of SO_ALLOC_PARTIAL's finished-good line, 4 pieces, submitted
 *
 * The demo branch's raw material is fully reserved by sales (EP34), so the
 * requirements show it as unavailable — availability is reservation-aware.
 * Idempotent: BOMs only when the item has none; each order once (stable `demo`
 * key on its CREATED audit entry). A second seed changes nothing.
 *
 * EP37 adds execution, through the same services as the API. The demo raw
 * material is all reserved by a sales order, so the owner first records ONE
 * labelled stock adjustment (+5 kg RM-000001, new lot RM-DEMO-02, reason OTHER)
 * through the Warehouse adjustment service and the ledger — no finished goods
 * are ever created:
 *
 *   MO_APPROVED   FEFO-reserved in full (RM 2 kg, PK 8) → FULLY_RESERVED
 *   MO_EXEC       manual, 10 pieces: approved, reserved, released, STARTED;
 *                 issue MI #1 POSTED (RM 1.5 of 2.5 kg, PK 10) → PARTIALLY_ISSUED;
 *                 usage recorded RM 1.5, PK 9 (1 box issued, not reported used);
 *                 issue MI #2 left as a DRAFT (the remaining RM 1 kg)
 *   MO_PARTIAL    manual, 6 pieces: approved and reserved — RM only partly (0.5 of
 *                 1.5 kg left after the others) → PARTIALLY_RESERVED with a shortage
 *   MO_SHORTAGE   stays unreserved (planning shortage, EP36)
 */

const FG = 'FG-000001';

export async function seedDemoProduction(db: Db, companyId: string, meta: RequestMeta) {
  const [manager, owner, branch, fg, rm, pk] = await Promise.all([
    db.companyMember.findFirst({
      where: { companyId, user: { emailNormalized: 'operations.demo@pdabliss.com' } },
      include: { user: true },
    }),
    db.companyMember.findFirst({
      where: { companyId, role: 'COMPANY_OWNER' },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    }),
    db.branch.findFirst({ where: { companyId, code: '00001' } }),
    db.item.findFirst({ where: { companyId, code: FG } }),
    db.item.findFirst({ where: { companyId, code: 'RM-000001' } }),
    db.item.findFirst({ where: { companyId, code: 'PK-000001' } }),
  ]);
  const who = manager ?? owner;
  const plus = (days: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  if (!who || !branch || !fg || !rm || !pk) return 'unchanged' as const;
  const ctx = { session: { branchId: branch.id }, user: who.user } as unknown as AuthContext;
  const actor = await loadProductionActor(db, ctx);
  if (!actor.bomManage || !actor.create || !actor.approve) return 'unchanged' as const;
  const boms = new BomService(db, 'seed');
  const orders = new ProductionOrderService(db, 'seed');
  let changed = false;

  if (!(await db.productionBom.count({ where: { companyId, itemId: fg.id } }))) {
    const r1 = await boms.createAs(
      actor,
      {
        itemId: fg.id,
        outputQuantity: '1',
        note: 'Demo: first formula',
        lines: [
          { itemId: rm.id, quantity: '0.3' },
          { itemId: pk.id, quantity: '1' },
        ],
      },
      meta,
    );
    await boms.activateAs(actor, r1, meta);
    const r2 = await boms.createAs(
      actor,
      {
        itemId: fg.id,
        outputQuantity: '1',
        note: 'Demo: less raw material per piece',
        lines: [
          { itemId: rm.id, quantity: '0.25' },
          { itemId: pk.id, quantity: '1' },
        ],
      },
      meta,
    );
    await boms.activateAs(actor, r2, meta); // supersedes R1 → RETIRED
    changed = true;
  }

  const exists = async (key: string) =>
    !!(await db.auditLog.findFirst({
      where: {
        companyId,
        action: 'PRODUCTION_ORDER_CREATED',
        changes: { path: ['demo'], equals: key },
      },
    }));
  const salesLine = async () => {
    const marker = await db.auditLog.findFirst({
      where: {
        companyId,
        action: 'SALES_ORDER_CREATED',
        changes: { path: ['demo'], equals: 'SO_ALLOC_PARTIAL' },
      },
    });
    if (!marker) return null;
    return db.salesOrderLine.findFirst({
      where: { salesOrderId: marker.entityId, itemId: fg.id, order: { status: 'CONFIRMED' } },
    });
  };

  const fixtures: {
    key: string;
    quantity: string;
    to: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
    sales?: boolean;
    start: number;
  }[] = [
    { key: 'MO_DRAFT', quantity: '4', to: 'DRAFT', start: 7 },
    { key: 'MO_SUBMITTED', quantity: '6', to: 'SUBMITTED', start: 5 },
    { key: 'MO_APPROVED', quantity: '8', to: 'APPROVED', start: 3 },
    { key: 'MO_SHORTAGE', quantity: '40', to: 'APPROVED', start: 10 },
    { key: 'MO_SALES', quantity: '4', to: 'SUBMITTED', sales: true, start: 2 },
  ];
  for (const f of fixtures) {
    if (await exists(f.key)) continue;
    const line = f.sales ? await salesLine() : null;
    if (f.sales && !line) continue;
    const id = await orders.createAs(
      actor,
      ctx,
      {
        ...(line ? { salesOrderLineId: line.id } : { itemId: fg.id, branchId: branch.id }),
        quantity: f.quantity,
        plannedStartDate: plus(f.start),
        requiredDate: plus(f.start + 3),
        priority: f.key === 'MO_SHORTAGE' ? 'HIGH' : 'NORMAL',
        note: null,
      },
      { ...meta },
      { demo: f.key },
    );
    if (f.to !== 'DRAFT') await orders.transition(actor, id, 'submit', meta);
    if (f.to === 'APPROVED') await orders.transition(actor, id, 'approve', meta);
    changed = true;
  }
  if (await seedDemoExecution(db, companyId, meta, { actor, ctx, owner, branch, fg, rm, plus })) {
    changed = true;
  }
  return changed ? ('created' as const) : ('unchanged' as const);
}

/** EP37 demo execution (see the header). Each step runs once; a second seed changes nothing. */
async function seedDemoExecution(
  db: Db,
  companyId: string,
  meta: RequestMeta,
  x: {
    actor: Awaited<ReturnType<typeof loadProductionActor>>;
    ctx: AuthContext;
    owner: { user: unknown } | null;
    branch: { id: string };
    fg: { id: string };
    rm: { id: string };
    plus: (days: number) => string;
  },
) {
  const { actor, ctx, branch, fg, rm, plus } = x;
  if (!actor.materials || !actor.execution || !actor.issuePost || !actor.usage) return false;
  const orders = new ProductionOrderService(db, 'seed');
  const issues = new MaterialIssueService(db, 'seed');
  let changed = false;
  const orderOf = async (key: string) => {
    const marker = await db.auditLog.findFirst({
      where: {
        companyId,
        action: 'PRODUCTION_ORDER_CREATED',
        changes: { path: ['demo'], equals: key },
      },
    });
    return marker ? db.productionOrder.findUnique({ where: { id: marker.entityId } }) : null;
  };
  const reserved = async (id: string) =>
    (await db.productionMaterialAllocation.count({ where: { productionOrderId: id } })) > 0;

  // One labelled raw-material receipt into stock (the ledger path), once.
  const lot = await db.inventoryLot.findFirst({
    where: { companyId, itemId: rm.id, lotNumber: 'RM-DEMO-02' },
  });
  if (!lot && x.owner) {
    const asOwner = {
      session: { branchId: branch.id },
      user: x.owner.user,
    } as unknown as AuthContext;
    const main = await db.warehouseLocation.findFirst({
      where: { branchId: branch.id, code: 'MAIN' },
    });
    if (!main) return false;
    const adj = new AdjustmentService(db);
    const { adjustment } = await adj.create(
      asOwner,
      {
        reason: 'OTHER',
        note: 'Demo: raw material for production execution (EP37)',
        lines: [
          {
            direction: 'INCREASE',
            locationId: main.id,
            itemId: rm.id,
            quantity: '5',
            newLotNumber: 'RM-DEMO-02',
            newLotExpiry: plus(180),
            note: null,
          },
        ],
      } as never,
      meta,
    );
    await adj.submit(asOwner, adjustment.id, meta);
    await adj.approve(asOwner, adjustment.id, meta);
    changed = true;
  }

  const approved = await orderOf('MO_APPROVED');
  if (approved?.status === 'APPROVED' && !(await reserved(approved.id))) {
    await orders.allocateAs(actor, approved.id, meta);
    changed = true;
  }

  const make = async (key: string, quantity: string) => {
    const id = await orders.createAs(
      actor,
      ctx,
      {
        itemId: fg.id,
        branchId: branch.id,
        quantity,
        plannedStartDate: plus(1),
        requiredDate: plus(4),
        note: null,
      },
      meta,
      { demo: key },
    );
    await orders.transition(actor, id, 'submit', meta);
    await orders.transition(actor, id, 'approve', meta);
    return id;
  };
  if (!(await orderOf('MO_EXEC'))) {
    const id = await make('MO_EXEC', '10');
    const lines = await orders.allocateAs(actor, id, meta);
    // Execution needs every material reserved; with other demo stock it simply stays reserved.
    if (lines.some((l) => l.shortage.gt(0))) return true;
    await orders.transition(actor, id, 'release', meta);
    await orders.executeAs(actor, id, 'start', 'Demo: first batch on line 1', meta);
    const active = await db.productionMaterialAllocation.findMany({
      where: { productionOrderId: id, status: 'ACTIVE' },
      include: { material: { select: { itemCode: true } } },
      orderBy: { id: 'asc' },
    });
    const rmRes = active.find((a) => a.material.itemCode === 'RM-000001');
    const pkRes = active.find((a) => a.material.itemCode !== 'RM-000001');
    if (rmRes && pkRes) {
      const first = await issues.createAs(
        actor,
        {
          productionOrderId: id,
          lines: [
            { allocationId: rmRes.id, quantity: '1.5' },
            { allocationId: pkRes.id, quantity: pkRes.quantity.toString() },
          ],
          note: 'Demo: first issue',
        },
        meta,
      );
      await issues.postAs(actor, first, meta);
      const mats = await db.productionOrderMaterial.findMany({ where: { productionOrderId: id } });
      for (const m of mats) {
        await orders.recordUsageAs(
          actor,
          id,
          { materialId: m.id, quantity: m.itemCode === 'RM-000001' ? '1.5' : '9', note: null },
          meta,
        );
      }
      await issues.createAs(
        actor,
        { productionOrderId: id, note: 'Demo: remaining raw material' },
        meta,
      );
    }
    changed = true;
  }

  if (!(await orderOf('MO_PARTIAL'))) {
    const id = await make('MO_PARTIAL', '6');
    await orders.allocateAs(actor, id, meta);
    changed = true;
  }
  return changed;
}
