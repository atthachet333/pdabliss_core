import type { RequestMeta } from '../auth/audit.js';
import { recordCompanyEvent, type PurchaseOrderAuditAction } from '../company/audit.js';
import type { Db } from '../db/client.js';
import type { PurchaseOrderStatus } from '../generated/prisma/enums.js';
import { depositAmount, lineAmounts, orderTotals } from './money.js';
import { companyDay } from './service.js';

/*
 * Demo purchase orders (EP30) — four fixtures, one per state a reviewer needs,
 * placed against the APPROVED demo requests with the demo supplier:
 *
 *   PO_DRAFT             Head Office, packaging, prices filled in, not issued
 *   PO_WAITING_DEPOSIT   Head Office, finished goods, 30 % deposit pending
 *                        (accounting.demo works at the Head Office)
 *   PO_PENDING_RECEIVE   demo branch, raw material 8 of 12.5 kg, no deposit
 *                        (warehouse.demo works in the demo branch)
 *   PO_CANCELLED         demo branch, the other 4.5 kg, issued then cancelled
 *                        (its quantity is released: the request is partly ordered)
 *
 * Created ONCE each (stable `demo` key in the CREATED audit entry), never
 * touched again; skipped when a persona, request or supplier is missing.
 * Numbers come from the normal PO sequence. Amounts are the server's
 * arithmetic (money.ts) — no client totals.
 */

interface Fixture {
  key: string;
  request: string;
  status: PurchaseOrderStatus;
  lines: {
    requestLineNo: number;
    quantity: string;
    unitPrice: string;
    discount?: string;
    taxRate: string;
  }[];
  deposit?: { type: 'PERCENT' | 'AMOUNT'; value: string; dueInDays: number };
  paymentTerms: string;
  cancelReason?: string;
}

const FIXTURES: Fixture[] = [
  {
    key: 'PO_DRAFT',
    request: 'PR_APPROVED_PURCHASING',
    status: 'DRAFT',
    lines: [{ requestLineNo: 2, quantity: '100', unitPrice: '12.5', taxRate: '7' }],
    paymentTerms: 'เครดิต 30 วัน (ข้อมูลสาธิต)',
  },
  {
    key: 'PO_WAITING_DEPOSIT',
    request: 'PR_APPROVED_PURCHASING',
    status: 'WAITING_DEPOSIT',
    lines: [{ requestLineNo: 1, quantity: '48', unitPrice: '120', discount: '100', taxRate: '7' }],
    deposit: { type: 'PERCENT', value: '30', dueInDays: 7 },
    paymentTerms: 'มัดจำ 30% ส่วนที่เหลือเครดิต 30 วัน (ข้อมูลสาธิต)',
  },
  {
    key: 'PO_PENDING_RECEIVE',
    request: 'PR_APPROVED_OPERATIONS',
    status: 'PENDING_RECEIVE',
    lines: [{ requestLineNo: 1, quantity: '8', unitPrice: '42.5', taxRate: '7' }],
    paymentTerms: 'เครดิต 30 วัน (ข้อมูลสาธิต)',
  },
  {
    key: 'PO_CANCELLED',
    request: 'PR_APPROVED_OPERATIONS',
    status: 'CANCELLED',
    lines: [{ requestLineNo: 1, quantity: '4.5', unitPrice: '40', taxRate: '7' }],
    paymentTerms: 'เงินสด (ข้อมูลสาธิต)',
    cancelReason: 'ผู้ขายแจ้งว่าสินค้าหมด (ข้อมูลสาธิต)',
  },
];

export async function seedDemoPurchaseOrders(db: Db, companyId: string, meta: RequestMeta) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const today = companyDay(company.timezone);
  const period = today.slice(0, 7).replace('-', '');
  const buyer = await db.companyMember.findFirst({
    where: { companyId, user: { emailNormalized: 'purchasing.demo@pdabliss.com' } },
  });
  const supplier = await db.supplier.findFirst({
    where: { companyId, code: 'SUP-000001', status: 'ACTIVE' },
  });
  if (!buyer || !supplier) return 'unchanged' as const;
  let created = 0;
  for (const f of FIXTURES) {
    const done = await db.auditLog.count({
      where: {
        companyId,
        action: 'PURCHASE_ORDER_CREATED',
        changes: { path: ['demo'], equals: f.key },
      },
    });
    if (done) continue;
    const marker = await db.auditLog.findFirst({
      where: {
        companyId,
        action: 'PURCHASE_REQUEST_CREATED',
        changes: { path: ['demo'], equals: f.request },
      },
    });
    const request = marker
      ? await db.purchaseRequest.findFirst({
          where: { id: marker.entityId, companyId, status: 'APPROVED' },
          include: { lines: true, branch: true },
        })
      : null;
    if (!request) continue;
    const picked = f.lines.map((l) => ({
      l,
      rl: request.lines.find((x) => x.lineNo === l.requestLineNo),
    }));
    if (picked.some((p) => !p.rl)) continue;
    const lines = picked.map(({ l, rl }, i) => {
      const fields = {
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discount ?? '0',
        taxRate: l.taxRate,
      };
      return {
        companyId,
        branchId: request.branchId,
        lineNo: i + 1,
        purchaseRequestId: request.id,
        purchaseRequestLineId: rl!.id,
        prNumber: request.number,
        prLineNo: rl!.lineNo,
        type: rl!.type,
        itemId: rl!.itemId,
        itemCode: rl!.itemCode,
        itemName: rl!.itemName,
        description: rl!.description,
        unitId: rl!.unitId,
        unitCode: rl!.unitCode,
        unitName: rl!.unitName,
        ...fields,
        ...lineAmounts(fields),
      };
    });
    const totals = orderTotals(lines);
    const issued = f.status !== 'DRAFT';
    const now = new Date();
    const due = new Date(`${today}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + (f.deposit?.dueInDays ?? 0));

    await db.$transaction(async (tx) => {
      const seq = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
        VALUES (${companyId}, ${`PO:${period}`}, 1, NOW())
        ON CONFLICT ("companyId", "key")
        DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue"`;
      const number = `PO-${period}-${String(seq[0]!.lastValue).padStart(6, '0')}`;
      const o = await tx.purchaseOrder.create({
        data: {
          companyId,
          branchId: request.branchId,
          number,
          status: f.status,
          supplierId: supplier.id,
          supplierCode: supplier.code,
          supplierName: supplier.name,
          supplierTaxId: supplier.taxId,
          supplierTaxBranch: supplier.taxBranch,
          supplierAddress: supplier.address,
          supplierContactName: supplier.contactName,
          supplierPhone: supplier.phone,
          supplierEmail: supplier.email,
          orderDate: new Date(`${today}T00:00:00Z`),
          paymentTerms: f.paymentTerms,
          lineCounter: lines.length,
          ...totals,
          ...(f.deposit
            ? {
                depositType: f.deposit.type,
                depositValue: f.deposit.value,
                depositAmount: depositAmount(f.deposit.type, f.deposit.value, totals.grandTotal),
                depositDueDate: due,
                depositStatus: 'PENDING' as const,
              }
            : {}),
          createdByMemberId: buyer.id,
          ...(issued
            ? {
                issuedAt: now,
                issuedByMemberId: buyer.id,
                branchCodeSnapshot: request.branch.code,
                branchNameSnapshot: request.branch.name,
              }
            : {}),
          ...(f.status === 'PENDING_RECEIVE' || f.status === 'CANCELLED'
            ? { pendingReceiveAt: now }
            : {}),
          ...(f.status === 'CANCELLED'
            ? {
                cancelledAt: now,
                cancelledByMemberId: buyer.id,
                cancellationReason: f.cancelReason,
              }
            : {}),
        },
      });
      await tx.purchaseOrderLine.createMany({
        data: lines.map((l) => ({ ...l, purchaseOrderId: o.id })),
      });
      const event = (action: PurchaseOrderAuditAction, details: Record<string, string>) =>
        recordCompanyEvent(tx, meta, {
          action,
          actorId: buyer.userId,
          actorScope: 'seed',
          companyId,
          entityType: 'PurchaseOrder',
          entityId: o.id,
          details: { number, ...details },
        });
      await event('PURCHASE_ORDER_CREATED', { demo: f.key, request: request.number });
      if (issued) {
        await event('PURCHASE_ORDER_ISSUED', {
          to: f.status === 'CANCELLED' ? 'PENDING_RECEIVE' : f.status,
        });
      }
      if (f.status === 'CANCELLED') await event('PURCHASE_ORDER_CANCELLED', { to: 'CANCELLED' });
    });
    created++;
  }
  return created ? (`created ${created}` as const) : ('unchanged' as const);
}
