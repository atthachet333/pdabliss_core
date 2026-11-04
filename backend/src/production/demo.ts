import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import type { Db } from '../db/client.js';
import { BomService } from './bom.js';
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
  const plus = (days: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
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
  return changed ? ('created' as const) : ('unchanged' as const);
}
