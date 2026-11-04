import type { RequestMeta } from '../auth/audit.js';
import { recordCompanyEvent, type SalesOrderAuditAction } from '../company/audit.js';
import type { Db } from '../db/client.js';
import type { SalesOrderStatus } from '../generated/prisma/enums.js';
import { lineAmounts, orderTotals } from '../purchasing/money.js';
import { companyDay } from '../purchasing/service.js';
import { allocateOrder } from './allocation.js';

/*
 * Demo sales orders (EP33, EP34) — four EP33 fixtures, one per state a reviewer needs,
 * for the demo customer (CUS-000001). sales.demo (staff, Head Office) drafts
 * and submits; owner.demo (the company owner) confirms and cancels — the demo
 * sales persona stays staff. Nothing here touches stock: availability is read
 * from the ledger when an order is shown.
 *
 *   SO_DRAFT      Head Office, sales.demo, packaging, not submitted
 *   SO_SUBMITTED  Head Office, sales.demo, finished goods — awaiting confirmation
 *                 (the Head Office holds no demo stock: a visible shortage)
 *   SO_CONFIRMED  demo branch, owner.demo, finished goods + packaging, confirmed
 *                 (the EP31 / EP32 demo stock covers it)
 *   SO_CANCELLED  Head Office, sales.demo, submitted then cancelled by owner.demo
 *
 * EP34 adds two demo-branch orders and allocates through the same code as the
 * API (allocation.ts — FEFO from the EP31 / EP32 demo stock, never a movement):
 *
 *   SO_CONFIRMED      allocated in full → READY (FG-DEMO-B from two locations + packaging)
 *   SO_ALLOC_PARTIAL  demo branch, owner.demo, confirmed: FG 14 (FG-DEMO-A 12 + FG-DEMO-C 2,
 *                     two FEFO lots) and raw material 8 kg of which 5 exist → PARTIALLY_ALLOCATED
 *   SO_OPEN           demo branch, owner.demo, confirmed, packaging 10, left unallocated
 *
 * EP35 adds four confirmed, allocated packaging orders (12 / 6 / 10 / 3) that
 * warehouse/fulfilment-demo.ts picks, packs and ships through the real service.
 *
 * Created ONCE each (stable `demo` key in the CREATED / ALLOCATION_CREATED audit
 * entry), never touched again; skipped when a persona, branch, customer or item
 * is missing. Numbers come from the normal SO sequence; amounts are the server's
 * arithmetic (purchasing/money.ts).
 */

interface Fixture {
  key: string;
  branch: '00000' | '00001';
  by: 'SALES' | 'OWNER';
  status: SalesOrderStatus;
  lines: { item: string; quantity: string; unitPrice: string; discount?: string }[];
  reference?: string;
  cancelReason?: string;
}

const FIXTURES: Fixture[] = [
  {
    key: 'SO_DRAFT',
    branch: '00000',
    by: 'SALES',
    status: 'DRAFT',
    lines: [{ item: 'PK-000001', quantity: '50', unitPrice: '18' }],
  },
  {
    key: 'SO_SUBMITTED',
    branch: '00000',
    by: 'SALES',
    status: 'SUBMITTED',
    lines: [{ item: 'FG-000001', quantity: '12', unitPrice: '185', discount: '60' }],
    reference: 'PO-DEMO-0042',
  },
  {
    key: 'SO_CONFIRMED',
    branch: '00001',
    by: 'OWNER',
    status: 'CONFIRMED',
    lines: [
      { item: 'FG-000001', quantity: '6', unitPrice: '185' },
      { item: 'PK-000001', quantity: '20', unitPrice: '18' },
    ],
    reference: 'PO-DEMO-0043',
  },
  {
    key: 'SO_CANCELLED',
    branch: '00000',
    by: 'SALES',
    status: 'CANCELLED',
    lines: [{ item: 'FG-000001', quantity: '3', unitPrice: '185' }],
    cancelReason: 'ลูกค้าขอยกเลิกคำสั่งซื้อ (ข้อมูลสาธิต)',
  },
  {
    key: 'SO_ALLOC_PARTIAL',
    branch: '00001',
    by: 'OWNER',
    status: 'CONFIRMED',
    lines: [
      { item: 'FG-000001', quantity: '14', unitPrice: '185' },
      { item: 'RM-000001', quantity: '8', unitPrice: '95' },
    ],
    reference: 'PO-DEMO-0044',
  },
  {
    key: 'SO_OPEN',
    branch: '00001',
    by: 'OWNER',
    status: 'CONFIRMED',
    lines: [{ item: 'PK-000001', quantity: '10', unitPrice: '18' }],
  },
  // EP35: confirmed, allocated packaging orders the fulfilment demo
  // (warehouse/fulfilment-demo.ts) takes through picking, packing and shipping.
  ...(['SO_FUL_PICKING', 'SO_FUL_PACKED', 'SO_FUL_SHIPPED', 'SO_FUL_EXCEPTION'] as const).map(
    (key, i): Fixture => ({
      key,
      branch: '00001',
      by: 'OWNER',
      status: 'CONFIRMED',
      lines: [{ item: 'PK-000001', quantity: ['12', '6', '10', '3'][i]!, unitPrice: '18' }],
    }),
  ),
];

/** EP34: orders the demo allocates, in this order (FEFO depends on it). */
const ALLOCATE = [
  'SO_CONFIRMED',
  'SO_ALLOC_PARTIAL',
  'SO_FUL_PICKING',
  'SO_FUL_PACKED',
  'SO_FUL_SHIPPED',
  'SO_FUL_EXCEPTION',
];

const TAX_RATE = '7';

export async function seedDemoSalesOrders(db: Db, companyId: string, meta: RequestMeta) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const today = companyDay(company.timezone);
  const period = today.slice(0, 7).replace('-', '');
  const [sales, owner, customer, branches, items] = await Promise.all([
    db.companyMember.findFirst({
      where: { companyId, user: { emailNormalized: 'sales.demo@pdabliss.com' } },
    }),
    db.companyMember.findFirst({
      where: { companyId, role: 'COMPANY_OWNER' },
      orderBy: { createdAt: 'asc' },
    }),
    db.customer.findFirst({ where: { companyId, code: 'CUS-000001', status: 'ACTIVE' } }),
    db.branch.findMany({ where: { companyId, code: { in: ['00000', '00001'] } } }),
    db.item.findMany({
      where: {
        companyId,
        code: { in: ['FG-000001', 'PK-000001', 'RM-000001'] },
        status: 'ACTIVE',
      },
      include: { baseUnit: true },
    }),
  ]);
  if (!sales || !owner || !customer) return 'unchanged' as const;
  let created = 0;
  for (const f of FIXTURES) {
    const done = await db.auditLog.count({
      where: {
        companyId,
        action: 'SALES_ORDER_CREATED',
        changes: { path: ['demo'], equals: f.key },
      },
    });
    if (done) continue;
    const branch = branches.find((b) => b.code === f.branch);
    const picked = f.lines.map((l) => ({ l, item: items.find((i) => i.code === l.item) }));
    if (!branch || picked.some((p) => !p.item)) continue;
    const creator = f.by === 'OWNER' ? owner : sales;
    const lines = picked.map(({ l, item }, i) => {
      const fields = {
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discount ?? '0',
        taxRate: TAX_RATE,
      };
      return {
        companyId,
        branchId: branch.id,
        lineNo: i + 1,
        itemId: item!.id,
        itemCode: item!.code,
        itemName: item!.name,
        itemType: item!.type,
        inventoryTracked: item!.inventoryTracked,
        unitId: item!.baseUnitId,
        unitCode: item!.baseUnit.code,
        unitName: item!.baseUnit.name,
        unitPrecision: item!.baseUnit.precision,
        ...fields,
        ...lineAmounts(fields),
      };
    });
    const submitted = f.status !== 'DRAFT';
    const now = new Date();
    const orderDate = new Date(`${today}T00:00:00Z`);

    await db.$transaction(async (tx) => {
      const seq = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
        VALUES (${companyId}, ${`SO:${period}`}, 1, NOW())
        ON CONFLICT ("companyId", "key")
        DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue"`;
      const number = `SO-${period}-${String(seq[0]!.lastValue).padStart(6, '0')}`;
      const o = await tx.salesOrder.create({
        data: {
          companyId,
          branchId: branch.id,
          number,
          status: f.status,
          customerId: customer.id,
          customerCode: customer.code,
          customerName: customer.name,
          customerTaxId: customer.taxId,
          customerTaxBranch: customer.taxBranch,
          orderDate,
          requestedDate: new Date(orderDate.getTime() + 7 * 86_400_000),
          customerReference: f.reference ?? null,
          lineCounter: lines.length,
          ...orderTotals(lines),
          createdByMemberId: creator.id,
          ...(submitted ? { submittedAt: now, submittedByMemberId: creator.id } : {}),
          ...(f.status === 'CONFIRMED' ? { confirmedAt: now, confirmedByMemberId: owner.id } : {}),
          ...(f.status === 'CANCELLED'
            ? {
                cancelledAt: now,
                cancelledByMemberId: owner.id,
                cancellationReason: f.cancelReason,
              }
            : {}),
        },
      });
      await tx.salesOrderLine.createMany({
        data: lines.map((l) => ({ ...l, salesOrderId: o.id })),
      });
      const event = (
        action: SalesOrderAuditAction,
        by: typeof owner,
        details: Record<string, string | number>,
      ) =>
        recordCompanyEvent(tx, meta, {
          action,
          actorId: by.userId,
          actorScope: 'seed',
          companyId,
          entityType: 'SalesOrder',
          entityId: o.id,
          details: { number, ...details },
        });
      await event('SALES_ORDER_CREATED', creator, { demo: f.key, lines: lines.length });
      if (submitted) {
        await event('SALES_ORDER_SUBMITTED', creator, {
          from: 'DRAFT',
          to: 'SUBMITTED',
          lines: lines.length,
        });
      }
      if (f.status === 'CONFIRMED') {
        await event('SALES_ORDER_CONFIRMED', owner, {
          from: 'SUBMITTED',
          to: 'CONFIRMED',
          lines: lines.length,
        });
      }
      if (f.status === 'CANCELLED') {
        await event('SALES_ORDER_CANCELLED', owner, { from: 'SUBMITTED', to: 'CANCELLED' });
      }
    });
    created++;
  }
  for (const key of ALLOCATE) {
    const marker = await db.auditLog.findFirst({
      where: { companyId, action: 'SALES_ORDER_CREATED', changes: { path: ['demo'], equals: key } },
    });
    const done = await db.auditLog.count({
      where: {
        companyId,
        action: 'SALES_ALLOCATION_CREATED',
        changes: { path: ['demo'], equals: `ALLOC_${key}` },
      },
    });
    if (!marker || done) continue;
    const allocatedNow = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "SalesOrder" WHERE "id" = ${marker.entityId} FOR UPDATE`;
      const o = await tx.salesOrder.findFirst({
        where: { id: marker.entityId, companyId, status: 'CONFIRMED' },
      });
      if (!o) return false;
      const lines = await allocateOrder(tx, { companyId, memberId: owner.id }, o, today);
      const touched = lines.filter((l) => l.allocatedNow.gt(0)).length;
      if (!touched) return false;
      const event = (action: SalesOrderAuditAction, details: Record<string, string | number>) =>
        recordCompanyEvent(tx, meta, {
          action,
          actorId: owner.userId,
          actorScope: 'seed',
          companyId,
          entityType: 'SalesOrder',
          entityId: o.id,
          details: { number: o.number, ...details },
        });
      await event('SALES_ALLOCATION_CREATED', { demo: `ALLOC_${key}`, lines: touched });
      const short = lines.filter((l) => l.shortage.gt(0)).length;
      await event(short ? 'SALES_ORDER_PARTIALLY_ALLOCATED' : 'SALES_ORDER_FULLY_ALLOCATED', {
        shortLines: short,
      });
      return true;
    });
    if (allocatedNow) created++;
  }
  return created ? (`created ${created}` as const) : ('unchanged' as const);
}
