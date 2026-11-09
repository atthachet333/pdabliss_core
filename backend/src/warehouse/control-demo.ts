import type { RequestMeta } from '../auth/audit.js';
import type { Db, Prisma } from '../db/client.js';
import { companyDay } from '../purchasing/service.js';
import { Decimal } from '../purchasing/money.js';
import { asDay, nextNumber } from './documents.js';
import { applyMovement, event, lockLocations, type LedgerActor } from './ledger.js';

/*
 * Demo inventory control (EP32), after the EP31 demo receipts, in the demo
 * branch (00001: MAIN and RECEIVING). warehouse.demo drafts, counts and
 * submits; owner.demo (the company owner) posts and approves — the demo
 * warehouse persona stays staff. Every stock effect goes through
 * ledger.ts applyMovement, exactly as the API does:
 *
 *   TR_POSTED     FG-DEMO-B 4 pcs RECEIVING → MAIN (the lot kept), posted
 *   ADJ_DECREASE  DAMAGE  − 3 PK-000001 at MAIN, approved (= posted)
 *   ADJ_INCREASE  FOUND   + 2 PK-000001 at RECEIVING, approved (= posted)
 *   CC_POSTED     RECEIVING counted: FG-DEMO-B 2 → 2, PK-000001 2 → 1
 *                 (one COUNT_CORRECTION of − 1), posted
 *   TR_DRAFT      PK-000001 10 MAIN → RECEIVING, left as a DRAFT
 *
 * Created ONCE each (stable `demo` key on the CREATED audit entry); a fixture
 * is skipped when the stock it needs is not where it expects.
 */

type Tx = Prisma.TransactionClient;

export async function seedDemoInventoryControl(db: Db, companyId: string, meta: RequestMeta) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const today = companyDay(company.timezone);
  const [staff, owner] = await Promise.all([
    db.companyMember.findFirst({
      where: { companyId, user: { emailNormalized: 'warehouse.demo@pdabliss.com' } },
    }),
    db.companyMember.findFirst({
      where: { companyId, role: 'COMPANY_OWNER' },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const branch = await db.branch.findFirst({ where: { companyId, code: '00001' } });
  if (!staff || !owner || !branch) return 'unchanged' as const;
  const actor = (m: typeof staff): LedgerActor => ({
    companyId,
    memberId: m.id,
    userId: m.userId,
    scope: 'seed',
    meta,
  });
  const by = actor(staff);
  const approver = actor(owner);
  const locations = await db.warehouseLocation.findMany({
    where: { branchId: branch.id, status: 'ACTIVE', code: { in: ['MAIN', 'RECEIVING'] } },
  });
  const MAIN = locations.find((l) => l.code === 'MAIN')?.id;
  const RECEIVING = locations.find((l) => l.code === 'RECEIVING')?.id;
  const items = await db.item.findMany({
    where: { companyId, code: { in: ['FG-000001', 'PK-000001'] } },
  });
  const FG = items.find((i) => i.code === 'FG-000001')?.id;
  const PK = items.find((i) => i.code === 'PK-000001')?.id;
  const lotB = FG
    ? await db.inventoryLot.findFirst({ where: { companyId, itemId: FG, lotNumber: 'FG-DEMO-B' } })
    : null;
  if (!MAIN || !RECEIVING || !FG || !PK || !lotB) return 'unchanged' as const;

  const onHand = async (tx: Tx | Db, locationId: string, itemId: string, lotId: string | null) =>
    (
      await tx.stockBalance.findUnique({
        where: { locationId_itemId_lotKey: { locationId, itemId, lotKey: lotId ?? '' } },
      })
    )?.quantityOnHand ?? new Decimal(0);
  const done = async (key: string, action: string) =>
    (await db.auditLog.count({
      where: { companyId, action, changes: { path: ['demo'], equals: key } },
    })) > 0;
  const base = { companyId, branchId: branch.id };
  let created = 0;

  // ---- transfers
  const transfer = async (
    key: string,
    from: string,
    to: string,
    line: { itemId: string; lotId: string | null; quantity: string },
    post: boolean,
  ) => {
    if (await done(key, 'TRANSFER_CREATED')) return;
    if ((await onHand(db, from, line.itemId, line.lotId)).lt(line.quantity)) return;
    await db.$transaction(async (tx) => {
      const number = await nextNumber(tx, companyId, 'TR', today);
      const now = new Date();
      const t = await tx.inventoryTransfer.create({
        data: {
          ...base,
          number,
          sourceLocationId: from,
          destinationLocationId: to,
          transferDate: asDay(today),
          lineCounter: 1,
          createdByMemberId: staff.id,
        },
      });
      const l = await tx.inventoryTransferLine.create({
        data: {
          ...base,
          transferId: t.id,
          lineNo: 1,
          itemId: line.itemId,
          lotId: line.lotId,
          lotKey: line.lotId ?? '',
          quantity: line.quantity,
        },
      });
      // EP41: like the service, the lines exist before the header is posted (they freeze with it).
      if (post) {
        await tx.inventoryTransfer.update({
          where: { id: t.id },
          data: { status: 'POSTED', postedAt: now, postedByMemberId: owner.id },
        });
      }
      await event(tx, by, 'TRANSFER_CREATED', 'InventoryTransfer', t.id, { demo: key, number });
      if (!post) return;
      await lockLocations(tx, [from, to], 'shared');
      const q = new Decimal(line.quantity);
      const source = { sourceType: 'TRANSFER' as const, transferId: t.id, transferLineId: l.id };
      const m = {
        branchId: branch.id,
        itemId: line.itemId,
        lotId: line.lotId,
        source,
        occurredAt: now,
      };
      await applyMovement(tx, approver, {
        ...m,
        locationId: from,
        type: 'TRANSFER_OUT',
        delta: q.neg(),
      });
      await applyMovement(tx, approver, { ...m, locationId: to, type: 'TRANSFER_IN', delta: q });
      await event(tx, approver, 'TRANSFER_POSTED', 'InventoryTransfer', t.id, {
        number,
        from: 'DRAFT',
        to: 'POSTED',
        lines: 1,
      });
    });
    created++;
  };

  // ---- adjustments (submitted by warehouse.demo, approved = posted by the owner)
  const adjust = async (
    key: string,
    reason: 'DAMAGE' | 'FOUND',
    line: {
      direction: 'INCREASE' | 'DECREASE';
      locationId: string;
      itemId: string;
      quantity: string;
    },
  ) => {
    if (await done(key, 'ADJUSTMENT_CREATED')) return;
    if (
      line.direction === 'DECREASE' &&
      (await onHand(db, line.locationId, line.itemId, null)).lt(line.quantity)
    ) {
      return;
    }
    await db.$transaction(async (tx) => {
      const number = await nextNumber(tx, companyId, 'ADJ', today);
      const now = new Date();
      const d = await tx.stockAdjustment.create({
        data: {
          ...base,
          number,
          reason,
          note: reason === 'DAMAGE' ? 'กล่องเสียหายระหว่างจัดเก็บ (ตัวอย่าง)' : null,
          adjustmentDate: asDay(today),
          lineCounter: 1,
          createdByMemberId: staff.id,
          status: 'SUBMITTED',
          submittedAt: now,
          submittedByMemberId: staff.id,
        },
      });
      const l = await tx.stockAdjustmentLine.create({
        data: { ...base, adjustmentId: d.id, lineNo: 1, ...line },
      });
      // EP41: posted once its line exists (a posted adjustment's lines are frozen).
      await tx.stockAdjustment.update({
        where: { id: d.id },
        data: { status: 'POSTED', approvedAt: now, approvedByMemberId: owner.id },
      });
      await event(tx, by, 'ADJUSTMENT_CREATED', 'StockAdjustment', d.id, {
        demo: key,
        number,
        reason,
      });
      await event(tx, by, 'ADJUSTMENT_SUBMITTED', 'StockAdjustment', d.id, {
        number,
        from: 'DRAFT',
        to: 'SUBMITTED',
      });
      const q = new Decimal(line.quantity);
      await applyMovement(tx, approver, {
        branchId: branch.id,
        locationId: line.locationId,
        itemId: line.itemId,
        lotId: null,
        type: line.direction === 'INCREASE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        delta: line.direction === 'INCREASE' ? q : q.neg(),
        source: { sourceType: 'ADJUSTMENT', adjustmentId: d.id, adjustmentLineId: l.id },
        occurredAt: now,
      });
      await event(tx, approver, 'ADJUSTMENT_APPROVED', 'StockAdjustment', d.id, {
        number,
        from: 'SUBMITTED',
        to: 'POSTED',
      });
      await event(tx, approver, 'ADJUSTMENT_POSTED', 'StockAdjustment', d.id, { number, lines: 1 });
    });
    created++;
  };

  // ---- one posted cycle count of RECEIVING (counted PK one short)
  const count = async (key: string) => {
    if (await done(key, 'CYCLE_COUNT_CREATED')) return;
    await db.$transaction(async (tx) => {
      await lockLocations(tx, [RECEIVING], 'exclusive');
      const balances = await tx.stockBalance.findMany({
        where: { locationId: RECEIVING, quantityOnHand: { gt: 0 } },
        include: { item: { select: { code: true } } },
        orderBy: { item: { code: 'asc' } },
      });
      const number = await nextNumber(tx, companyId, 'CC', today);
      const now = new Date();
      const c = await tx.cycleCount.create({
        data: {
          ...base,
          number,
          note: 'นับสต็อกจุดรับสินค้า (ตัวอย่าง)',
          countDate: asDay(today),
          lineCounter: balances.length,
          createdByMemberId: staff.id,
          status: 'REVIEW',
          startedAt: now,
          startedByMemberId: staff.id,
          reviewAt: now,
        },
      });
      await tx.cycleCountLocation.create({
        data: { ...base, cycleCountId: c.id, locationId: RECEIVING },
      });
      await event(tx, by, 'CYCLE_COUNT_CREATED', 'CycleCount', c.id, {
        demo: key,
        number,
        locations: 1,
      });
      await event(tx, by, 'CYCLE_COUNT_STARTED', 'CycleCount', c.id, {
        number,
        from: 'DRAFT',
        to: 'COUNTING',
        lines: balances.length,
      });
      let corrections = 0;
      for (const [i, b] of balances.entries()) {
        const counted = b.itemId === PK ? b.quantityOnHand.minus(1) : b.quantityOnHand;
        const l = await tx.cycleCountLine.create({
          data: {
            ...base,
            cycleCountId: c.id,
            lineNo: i + 1,
            locationId: RECEIVING,
            itemId: b.itemId,
            lotId: b.lotId,
            lotKey: b.lotKey,
            expected: true,
            systemQuantity: b.quantityOnHand,
            countedQuantity: counted,
            countedAt: now,
            countedByMemberId: staff.id,
          },
        });
        const v = counted.minus(b.quantityOnHand);
        if (v.isZero()) continue;
        await applyMovement(tx, approver, {
          branchId: branch.id,
          locationId: RECEIVING,
          itemId: b.itemId,
          lotId: b.lotId,
          type: 'COUNT_CORRECTION',
          delta: v,
          source: { sourceType: 'CYCLE_COUNT', cycleCountId: c.id, cycleCountLineId: l.id },
          occurredAt: now,
          ownCountId: c.id,
        });
        corrections++;
      }
      // EP41: posted once its scope and lines exist (they freeze with it).
      await tx.cycleCount.update({
        where: { id: c.id },
        data: { status: 'POSTED', postedAt: now, postedByMemberId: owner.id },
      });
      await event(tx, by, 'CYCLE_COUNT_REVIEWED', 'CycleCount', c.id, {
        number,
        from: 'COUNTING',
        to: 'REVIEW',
      });
      await event(tx, approver, 'CYCLE_COUNT_POSTED', 'CycleCount', c.id, {
        number,
        from: 'REVIEW',
        to: 'POSTED',
        lines: balances.length,
        corrections,
      });
    });
    created++;
  };

  await transfer('TR_POSTED', RECEIVING, MAIN, { itemId: FG, lotId: lotB.id, quantity: '4' }, true);
  await adjust('ADJ_DECREASE', 'DAMAGE', {
    direction: 'DECREASE',
    locationId: MAIN,
    itemId: PK,
    quantity: '3',
  });
  await adjust('ADJ_INCREASE', 'FOUND', {
    direction: 'INCREASE',
    locationId: RECEIVING,
    itemId: PK,
    quantity: '2',
  });
  await count('CC_POSTED');
  await transfer('TR_DRAFT', MAIN, RECEIVING, { itemId: PK, lotId: null, quantity: '10' }, false);
  return created ? (`created ${created}` as const) : ('unchanged' as const);
}
