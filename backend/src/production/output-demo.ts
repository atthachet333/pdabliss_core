import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import type { Db } from '../db/client.js';
import { AdjustmentService } from '../warehouse/adjustments.js';
import { OutputService } from './output.js';
import { loadProductionActor } from './policy.js';
import { FinishedGoodsService } from './receipts.js';
import { ProductionOrderService } from './service.js';
import { MaterialIssueService } from './issues.js';

/*
 * Demo finished goods output, receipt and completion (EP38), in the demo branch,
 * through the REAL services and the ledger (audit scope 'seed'). operations.demo
 * (the Operations Manager persona, unchanged) reports and accepts output; the
 * owner posts the Warehouse receipts (no persona is elevated).
 *
 *   MO_EXEC   OUT #1 good 4 + defective 1, ACCEPTED (4 good / 1 rejected);
 *             FGR #1 POSTED 2 pieces → 2 accepted pieces still waiting for Warehouse;
 *             OUT #2 good 3, SUBMITTED (waiting for the quality decision)
 *   MO_DONE   manual, 2 pieces: its materials come from ONE labelled owner
 *             adjustment (+0.5 kg RM-000001 lot RM-DEMO-03, +2 PK-000001, reason
 *             OTHER); reserved, started, issued, output 2 accepted, received in
 *             full, reviewed and COMPLETED.
 *
 * Idempotent: MO_EXEC's output only when it has none; MO_DONE once (its demo key).
 */

export async function seedDemoOutput(
  db: Db,
  companyId: string,
  meta: RequestMeta,
  x: {
    ctx: AuthContext;
    owner: { user: unknown } | null;
    branch: { id: string };
    fg: { id: string; lotTracking: string; expiryTracking: string };
    rm: { id: string; lotTracking: string };
    pk: { id: string; lotTracking: string };
    plus: (days: number) => string;
    orderOf: (key: string) => Promise<{ id: string; status: string } | null>;
  },
) {
  const { ctx, branch, fg, plus } = x;
  if (!x.owner) return false;
  const actor = await loadProductionActor(db, ctx);
  const asOwner = {
    session: { branchId: branch.id },
    user: x.owner.user,
  } as unknown as AuthContext;
  const ownerActor = await loadProductionActor(db, asOwner);
  if (!actor.outputCreate || !actor.outputApprove || !actor.complete || !ownerActor.fgConfirm) {
    return false;
  }
  const outputs = new OutputService(db, 'seed');
  const receipts = new FinishedGoodsService(db, 'seed');
  const orders = new ProductionOrderService(db, 'seed');
  const issues = new MaterialIssueService(db, 'seed');
  const main = await db.warehouseLocation.findFirst({
    where: { branchId: branch.id, code: 'MAIN' },
  });
  if (!main) return false;
  const today = plus(0);
  /** A receipt line under the finished item's own lot / expiry rules. */
  const fgLine = (quantity: string, lotNumber: string) => {
    const lot = fg.lotTracking === 'NONE' ? {} : { lotNumber };
    const expiry =
      fg.lotTracking !== 'NONE' && fg.expiryTracking !== 'NONE' ? { expiryDate: plus(365) } : {};
    const made = fg.lotTracking !== 'NONE' ? { manufacturedDate: today } : {};
    return { locationId: main.id, quantity, ...lot, ...expiry, ...made };
  };
  let changed = false;

  const exec = await x.orderOf('MO_EXEC');
  if (
    exec?.status === 'IN_PRODUCTION' &&
    !(await db.productionOutputReport.count({ where: { productionOrderId: exec.id } }))
  ) {
    const one = await outputs.createAs(
      actor,
      {
        productionOrderId: exec.id,
        productionDate: today,
        goodQuantity: '4',
        defectiveQuantity: '1',
        note: 'Demo: first batch (one box crushed)',
      },
      meta,
    );
    await outputs.submitAs(actor, one, meta);
    await outputs.acceptAs(actor, one, undefined, meta);
    const fgr = await receipts.createAs(
      ownerActor,
      { outputReportId: one, lines: [fgLine('2', 'FG-DEMO-OUT-A')], note: 'Demo: first pallet' },
      meta,
    );
    await receipts.postAs(ownerActor, fgr, meta);
    const two = await outputs.createAs(
      actor,
      {
        productionOrderId: exec.id,
        productionDate: today,
        goodQuantity: '3',
        note: 'Demo: second batch',
      },
      meta,
    );
    await outputs.submitAs(actor, two, meta);
    changed = true;
  }

  if (!(await x.orderOf('MO_DONE'))) {
    // Materials for one small completed order: one labelled adjustment through the ledger.
    const adj = new AdjustmentService(db);
    const stockLine = (itemId: string, quantity: string, tracking: string, lot: string) => ({
      direction: 'INCREASE',
      locationId: main.id,
      itemId,
      quantity,
      ...(tracking === 'NONE' ? {} : { newLotNumber: lot, newLotExpiry: plus(180) }),
      note: null,
    });
    const { adjustment } = await adj.create(
      asOwner,
      {
        reason: 'OTHER',
        note: 'Demo: materials for a completed production order (EP38)',
        lines: [
          stockLine(x.rm.id, '0.5', x.rm.lotTracking, 'RM-DEMO-03'),
          stockLine(x.pk.id, '2', x.pk.lotTracking, 'PK-DEMO-03'),
        ],
      } as never,
      meta,
    );
    await adj.submit(asOwner, adjustment.id, meta);
    await adj.approve(asOwner, adjustment.id, meta);
    const id = await orders.createAs(
      actor,
      ctx,
      {
        itemId: fg.id,
        branchId: branch.id,
        quantity: '2',
        plannedStartDate: today,
        requiredDate: plus(2),
        note: null,
      },
      meta,
      { demo: 'MO_DONE' },
    );
    await orders.transition(actor, id, 'submit', meta);
    await orders.transition(actor, id, 'approve', meta);
    const lines = await orders.allocateAs(actor, id, meta);
    if (lines.some((l) => l.shortage.gt(0))) return true; // stays reserved: no broken state
    await orders.transition(actor, id, 'release', meta);
    await orders.executeAs(actor, id, 'start', 'Demo: small batch', meta);
    await issues.postAs(actor, await issues.createAs(actor, { productionOrderId: id }, meta), meta);
    const out = await outputs.createAs(
      actor,
      { productionOrderId: id, productionDate: today, goodQuantity: '2' },
      meta,
    );
    await outputs.submitAs(actor, out, meta);
    await outputs.acceptAs(actor, out, undefined, meta);
    const fgr = await receipts.createAs(
      ownerActor,
      { outputReportId: out, lines: [fgLine('2', 'FG-DEMO-OUT-B')] },
      meta,
    );
    await receipts.postAs(ownerActor, fgr, meta);
    await orders.reviewAs(actor, id, null, meta);
    await orders.completeAs(
      actor,
      id,
      { outcome: 'COMPLETED', materialsReviewed: true, reason: null },
      meta,
    );
    changed = true;
  }
  return changed;
}
