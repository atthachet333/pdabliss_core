import type { RequestMeta } from '../auth/audit.js';
import { recordCompanyEvent } from '../company/audit.js';
import type { Db } from '../db/client.js';
import { companyDay } from '../purchasing/service.js';
import { postReceipt, saveReceiptLine, type LedgerActor } from './ledger.js';

/*
 * Demo goods receipts (EP31) — three posted receipts in the demo branch,
 * made by warehouse.demo through the same ledger code as the API (rules,
 * lots, movements, balances, order state):
 *
 *   GR_PARTIAL      PO_PENDING_RECEIVE: 5 of 8 kg raw material, lot RM-DEMO-01
 *                   (optional lot / expiry given) → the order stays partly received
 *   GR_RECEIVED_1   PO_RECEIVED: finished goods 18 in two lots (FG-DEMO-A in MAIN,
 *                   FG-DEMO-B — the sooner expiry — at RECEIVING); packaging 96
 *                   accepted, 4 rejected as damaged with no replacement
 *   GR_RECEIVED_2   PO_RECEIVED: the last 12 finished goods, lot FG-DEMO-C (latest
 *                   expiry) → the order is RECEIVED
 *
 * FEFO for FG-000001 in the demo branch is therefore B, A, C. Expiry dates are
 * relative to the seed day (B expiring soon, A and C fine). Created ONCE each
 * (stable `demo` key on the CREATED audit entry); skipped when the order is
 * not where the fixture expects it.
 */

interface Allocation {
  location: 'MAIN' | 'RECEIVING';
  quantity: string;
  lot?: string;
  expiresInDays?: number;
}

interface Fixture {
  key: string;
  order: string;
  lines: {
    item: string;
    accepted: string;
    rejected?: { quantity: string; reason: 'DAMAGED'; replacementRequired: boolean };
    allocations: Allocation[];
  }[];
}

const FIXTURES: Fixture[] = [
  {
    key: 'GR_PARTIAL',
    order: 'PO_PENDING_RECEIVE',
    lines: [
      {
        item: 'RM-000001',
        accepted: '5',
        allocations: [{ location: 'MAIN', quantity: '5', lot: 'RM-DEMO-01', expiresInDays: 200 }],
      },
    ],
  },
  {
    key: 'GR_RECEIVED_1',
    order: 'PO_RECEIVED',
    lines: [
      {
        item: 'FG-000001',
        accepted: '18',
        allocations: [
          { location: 'MAIN', quantity: '12', lot: 'FG-DEMO-A', expiresInDays: 45 },
          { location: 'RECEIVING', quantity: '6', lot: 'FG-DEMO-B', expiresInDays: 12 },
        ],
      },
      {
        item: 'PK-000001',
        accepted: '96',
        rejected: { quantity: '4', reason: 'DAMAGED', replacementRequired: false },
        allocations: [{ location: 'MAIN', quantity: '96' }],
      },
    ],
  },
  {
    key: 'GR_RECEIVED_2',
    order: 'PO_RECEIVED',
    lines: [
      {
        item: 'FG-000001',
        accepted: '12',
        allocations: [{ location: 'MAIN', quantity: '12', lot: 'FG-DEMO-C', expiresInDays: 75 }],
      },
    ],
  },
];

const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export async function seedDemoReceipts(db: Db, companyId: string, meta: RequestMeta) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const today = companyDay(company.timezone);
  const receiver = await db.companyMember.findFirst({
    where: { companyId, user: { emailNormalized: 'warehouse.demo@pdabliss.com' } },
  });
  if (!receiver) return 'unchanged' as const;
  const actor: LedgerActor = {
    companyId,
    memberId: receiver.id,
    userId: receiver.userId,
    scope: 'seed',
    meta,
  };
  let created = 0;
  for (const f of FIXTURES) {
    const done = await db.auditLog.count({
      where: {
        companyId,
        action: 'GOODS_RECEIPT_CREATED',
        changes: { path: ['demo'], equals: f.key },
      },
    });
    if (done) continue;
    const marker = await db.auditLog.findFirst({
      where: {
        companyId,
        action: 'PURCHASE_ORDER_CREATED',
        changes: { path: ['demo'], equals: f.order },
      },
    });
    const order = marker
      ? await db.purchaseOrder.findFirst({
          where: { id: marker.entityId, companyId, status: 'PENDING_RECEIVE' },
          include: { lines: true },
        })
      : null;
    if (!order) continue;
    const locations = await db.warehouseLocation.findMany({
      where: { branchId: order.branchId, status: 'ACTIVE', code: { in: ['MAIN', 'RECEIVING'] } },
    });
    const locationId = (code: string) => locations.find((l) => l.code === code)?.id;
    const picked = f.lines.map((l) => ({ l, ol: order.lines.find((x) => x.itemCode === l.item) }));
    if (
      picked.some((p) => !p.ol) ||
      f.lines.some((l) => l.allocations.some((a) => !locationId(a.location)))
    ) {
      continue;
    }
    await db.$transaction(async (tx) => {
      const period = today.slice(0, 7).replace('-', '');
      const seq = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
        VALUES (${companyId}, ${`GR:${period}`}, 1, NOW())
        ON CONFLICT ("companyId", "key")
        DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue"`;
      const number = `GR-${period}-${String(seq[0]!.lastValue).padStart(6, '0')}`;
      const r = await tx.goodsReceipt.create({
        data: {
          companyId,
          branchId: order.branchId,
          number,
          purchaseOrderId: order.id,
          poNumber: order.number,
          supplierId: order.supplierId,
          supplierCode: order.supplierCode,
          supplierName: order.supplierName,
          receivedAt: new Date(),
          defaultLocationId: locationId('MAIN')!,
          lineCounter: picked.length,
          createdByMemberId: receiver.id,
        },
      });
      const lines = [];
      for (const [i, { ol }] of picked.entries()) {
        lines.push(
          await tx.goodsReceiptLine.create({
            data: {
              companyId,
              branchId: order.branchId,
              goodsReceiptId: r.id,
              purchaseOrderId: order.id,
              purchaseOrderLineId: ol!.id,
              lineNo: i + 1,
              itemId: ol!.itemId!,
              itemCode: ol!.itemCode!,
              itemName: ol!.itemName!,
              unitId: ol!.unitId!,
              unitCode: ol!.unitCode!,
              unitName: ol!.unitName,
            },
          }),
        );
      }
      await recordCompanyEvent(tx, meta, {
        action: 'GOODS_RECEIPT_CREATED',
        actorId: receiver.userId,
        actorScope: 'seed',
        companyId,
        entityType: 'GoodsReceipt',
        entityId: r.id,
        details: { demo: f.key, number, order: order.number, lines: lines.length },
      });
      for (const [i, { l }] of picked.entries()) {
        await saveReceiptLine(
          tx,
          actor,
          r,
          lines[i]!.id,
          {
            acceptedQuantity: l.accepted,
            rejectedQuantity: l.rejected?.quantity,
            rejectReason: l.rejected?.reason ?? null,
            replacementRequired: l.rejected?.replacementRequired,
            allocations: l.allocations.map((a) => ({
              locationId: locationId(a.location)!,
              lotNumber: a.lot ?? null,
              expiryDate: a.expiresInDays !== undefined ? addDays(today, a.expiresInDays) : null,
              manufacturedDate: null,
              quantity: a.quantity,
            })),
          },
          today,
        );
      }
      await postReceipt(tx, actor, r.id, today);
    });
    created++;
  }
  return created ? (`created ${created}` as const) : ('unchanged' as const);
}
