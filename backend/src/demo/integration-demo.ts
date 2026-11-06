import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import type { Db } from '../db/client.js';
import { BomService } from '../production/bom.js';
import { MaterialIssueService } from '../production/issues.js';
import { OutputService } from '../production/output.js';
import { loadProductionActor } from '../production/policy.js';
import { FinishedGoodsService } from '../production/receipts.js';
import { ProductionOrderService } from '../production/service.js';
import { allowedActiveBranches } from '../company/branch-access.js';
import { AppError } from '../lib/errors.js';
import { CreateBody as CreatePrBody } from '../purchasing/input.js';
import { CreateOrderBody } from '../purchasing/order-input.js';
import { PurchaseOrderService } from '../purchasing/order-service.js';
import { companyDay, PurchaseRequestService } from '../purchasing/service.js';
import { CreateSoBody } from '../sales/input.js';
import { SalesOrderService } from '../sales/service.js';
import { FulfilmentService } from '../warehouse/fulfilment.js';
import { CreateReceiptBody, LineBody as ReceiptLineBody } from '../warehouse/input.js';
import { ReceivingService } from '../warehouse/service.js';

/*
 * EP39 — the cross-department demo chain, in the demo branch (00001), after
 * every EP28–EP38 fixture. It only adds; it uses the EP39 master data
 * (FG-000002 / FG-000003, RM-000002 / RM-000003, PK-000002, CUS-000002 / 3,
 * SUP-000002 / 3), so the earlier fixtures and their stock are untouched.
 *
 * Everything goes through the REAL services, each persona acting within its
 * own unchanged permissions (audit scope 'seed'); every stock effect is the
 * services' own ledger path. Managers' steps (confirm, allocate, dispatch,
 * deliver, finished-goods posting) are the owner's — no persona is elevated.
 *
 *   PR_EP39_MATERIALS        operations.demo requests RM-000002 20 kg, PK-000002 300,
 *                            RM-000003 6 L; purchasing.demo approves
 *   PO_EP39_RECEIVED         purchasing.demo, SUP-000002: RM-000002 20 + PK-000002 300, issued
 *   GR_EP39_FULL             warehouse.demo receives it in full: RM-000002 in two lots
 *                            (GLY-DEMO-B expires first, at RECEIVING) → order RECEIVED
 *   PO_EP39_AWAITING         purchasing.demo, SUP-000003: RM-000003 6 L, issued, nothing
 *                            received yet — the supplier receipt the shortage waits for
 *   BOM FG-000002 / FG-000003   one ACTIVE formula each (operations.demo)
 *   MO_EP39_SHORT_CLOSED     FG-000002 × 20: reserved, started, issued, usage below the
 *                            issue (variance), output 16 good + 2 defective accepted,
 *                            16 received (lot SER-DEMO-01) → SHORT_CLOSED with a reason
 *   SO_EP39_DELIVERED        sales.demo → owner confirms and allocates the manufactured lot
 *                            (FEFO, by hand — never automatic) → warehouse.demo picks,
 *                            packs, ships → owner dispatches and records delivery
 *   SO_EP39_SUBMITTED        sales.demo, FG-000002 × 4, waiting for confirmation (in stock)
 *   SO_EP39_DRAFT            sales.demo, FG-000002 × 2, still a draft
 *   SO_EP39_DEMAND           sales.demo, FG-000003 × 12 — none in stock; owner confirms
 *   MO_EP39_FOR_SALES        operations.demo plans SO_EP39_DEMAND's line: approved, reserved —
 *                            PK-000002 reserved, RM-000003 short (waits for PO_EP39_AWAITING)
 *
 * Idempotent: each fixture runs once (its `demo` key on the CREATED audit
 * entry); a fixture whose persona, branch, item or predecessor is missing or
 * no longer where it expects is skipped. A second seed changes nothing.
 */

type Member = { id: string; userId: string; user: unknown };

export async function seedDemoIntegration(db: Db, companyId: string, meta: RequestMeta) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const today = companyDay(company.timezone);
  const plus = (days: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const member = (email: string) =>
    db.companyMember.findFirst({
      where: { companyId, status: 'ACTIVE', user: { emailNormalized: email } },
      include: { user: true },
    });
  const [sales, ops, wh, pur, owner, branch] = await Promise.all([
    member('sales.demo@pdabliss.com'),
    member('operations.demo@pdabliss.com'),
    member('warehouse.demo@pdabliss.com'),
    member('purchasing.demo@pdabliss.com'),
    db.companyMember.findFirst({
      where: { companyId, role: 'COMPANY_OWNER', status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    }),
    db.branch.findFirst({ where: { companyId, code: '00001', status: 'ACTIVE' } }),
  ]);
  if (!sales || !ops || !wh || !pur || !owner || !branch) return 'unchanged' as const;
  const ctx = (m: Member) =>
    ({ session: { branchId: branch.id }, user: m.user }) as unknown as AuthContext;
  const [asSales, asOps, asWh, asPur, asOwner] = [sales, ops, wh, pur, owner].map(ctx) as [
    AuthContext,
    AuthContext,
    AuthContext,
    AuthContext,
    AuthContext,
  ];

  const codes = ['FG-000002', 'FG-000003', 'RM-000002', 'RM-000003', 'PK-000002'];
  const items = await db.item.findMany({
    where: { companyId, code: { in: codes }, status: 'ACTIVE' },
  });
  const item = (code: string) => items.find((i) => i.code === code);
  const [fg2, fg3, rm2, rm3, pk2] = codes.map(item);
  const [cus2, cus3, sup2, sup3] = await Promise.all([
    db.customer.findFirst({ where: { companyId, code: 'CUS-000002', status: 'ACTIVE' } }),
    db.customer.findFirst({ where: { companyId, code: 'CUS-000003', status: 'ACTIVE' } }),
    db.supplier.findFirst({ where: { companyId, code: 'SUP-000002', status: 'ACTIVE' } }),
    db.supplier.findFirst({ where: { companyId, code: 'SUP-000003', status: 'ACTIVE' } }),
  ]);
  const locations = await db.warehouseLocation.findMany({
    where: { branchId: branch.id, status: 'ACTIVE', code: { in: ['MAIN', 'RECEIVING'] } },
  });
  const MAIN = locations.find((l) => l.code === 'MAIN')?.id;
  const RECEIVING = locations.find((l) => l.code === 'RECEIVING')?.id;
  if (!fg2 || !fg3 || !rm2 || !rm3 || !pk2 || !cus2 || !cus3 || !sup2 || !sup3 || !MAIN) {
    return 'unchanged' as const;
  }

  /** The entity a fixture created (its CREATED audit entry carries the key). */
  const marked = async (action: string, key: string) =>
    (
      await db.auditLog.findFirst({
        where: { companyId, action, changes: { path: ['demo'], equals: key } },
        orderBy: { occurredAt: 'asc' },
      })
    )?.entityId ?? null;
  const demo = (key: string) => ({ demo: key });
  let created = 0;
  const skipped: string[] = [];
  /**
   * A business refusal (a persona changed by an administrator since: branch access, role,
   * an exception) skips that fixture group with its code; anything else is a real failure.
   */
  const guard = async (name: string, work: () => Promise<unknown>) => {
    try {
      await work();
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      skipped.push(`${name} (${e.code})`);
    }
  };
  /**
   * Every persona acts in the demo branch. One an administrator has since taken out of it is
   * not silently moved elsewhere (the one-branch fallback): its fixtures are skipped.
   */
  const inDemoBranch = new Map<string, boolean>();
  for (const m of [sales, ops, wh, pur, owner]) {
    inDemoBranch.set(
      m.id,
      (await allowedActiveBranches(db, m)).some((b) => b.id === branch.id),
    );
  }
  const need = (...members: { id: string }[]) => {
    if (members.some((m) => !inDemoBranch.get(m.id))) {
      throw new AppError(
        409,
        'BRANCH_NOT_ALLOWED',
        'A persona no longer works in the demo branch.',
      );
    }
  };
  const outcome = () =>
    `${created ? `created ${created}` : 'unchanged'}${skipped.length ? `, skipped ${skipped.join('; ')}` : ''}`;

  // ---- Purchasing → Warehouse
  const prs = new PurchaseRequestService(db, 'seed');
  const pos = new PurchaseOrderService(db, 'seed');
  const receiving = new ReceivingService(db, 'seed');
  await guard('PR_EP39_MATERIALS', async () => {
    if (!(await marked('PURCHASE_REQUEST_CREATED', 'PR_EP39_MATERIALS'))) {
      need(ops, pur);
      await prs.create(
        asOps,
        CreatePrBody.parse({
          department: 'OPERATIONS',
          purpose: 'วัตถุดิบและบรรจุภัณฑ์สำหรับเซรั่มและโลชั่น (ข้อมูลสาธิต EP39)',
          needByDate: plus(10),
          lines: [
            { type: 'ITEM', itemId: rm2.id, quantity: '20' },
            { type: 'ITEM', itemId: pk2.id, quantity: '300' },
            { type: 'ITEM', itemId: rm3.id, quantity: '6' },
          ],
        }),
        meta,
        demo('PR_EP39_MATERIALS'),
      );
      const id = (await marked('PURCHASE_REQUEST_CREATED', 'PR_EP39_MATERIALS'))!;
      await prs.submit(asOps, id, meta);
      await prs.approve(asPur, id, meta);
      created++;
    }
  });
  const prId = await marked('PURCHASE_REQUEST_CREATED', 'PR_EP39_MATERIALS');
  const pr = prId
    ? await db.purchaseRequest.findFirst({
        where: { id: prId, status: 'APPROVED' },
        include: { lines: true },
      })
    : null;
  const prLine = (itemId: string) => pr?.lines.find((l) => l.itemId === itemId);
  const order = async (
    key: string,
    supplierId: string,
    lines: { itemId: string; quantity: string; unitPrice: string }[],
    paymentTerms: string,
  ) => {
    if (!pr || (await marked('PURCHASE_ORDER_CREATED', key))) return;
    if (lines.some((l) => !prLine(l.itemId))) return;
    need(pur);
    await pos.create(
      asPur,
      CreateOrderBody.parse({
        purchaseRequestId: pr.id,
        supplierId,
        expectedDate: plus(7),
        paymentTerms,
        deposit: { type: 'NONE' },
        lines: lines.map((l) => ({
          purchaseRequestLineId: prLine(l.itemId)!.id,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: '7',
        })),
      }),
      meta,
      demo(key),
    );
    await pos.issue(asPur, (await marked('PURCHASE_ORDER_CREATED', key))!, meta);
    created++;
  };
  await guard('PO_EP39_RECEIVED', async () => {
    await order(
      'PO_EP39_RECEIVED',
      sup2.id,
      [
        { itemId: rm2.id, quantity: '20', unitPrice: '85' },
        { itemId: pk2.id, quantity: '300', unitPrice: '6.5' },
      ],
      'เครดิต 30 วัน (ข้อมูลสาธิต)',
    );
  });
  await guard('PO_EP39_AWAITING', async () => {
    await order(
      'PO_EP39_AWAITING',
      sup3.id,
      [{ itemId: rm3.id, quantity: '6', unitPrice: '420' }],
      'เครดิต 45 วัน (ข้อมูลสาธิต)',
    );
  });
  const poId = await marked('PURCHASE_ORDER_CREATED', 'PO_EP39_RECEIVED');
  const po = poId
    ? await db.purchaseOrder.findFirst({ where: { id: poId, status: 'PENDING_RECEIVE' } })
    : null;
  await guard('GR_EP39_FULL', async () => {
    if (po && RECEIVING && !(await marked('GOODS_RECEIPT_CREATED', 'GR_EP39_FULL'))) {
      need(wh);
      await receiving.create(
        asWh,
        CreateReceiptBody.parse({ purchaseOrderId: po.id, defaultLocationId: MAIN }),
        meta,
        demo('GR_EP39_FULL'),
      );
      const grId = (await marked('GOODS_RECEIPT_CREATED', 'GR_EP39_FULL'))!;
      const lines = await db.goodsReceiptLine.findMany({ where: { goodsReceiptId: grId } });
      for (const l of lines) {
        const input =
          l.itemId === rm2.id
            ? {
                acceptedQuantity: '20',
                allocations: [
                  {
                    locationId: MAIN,
                    quantity: '12',
                    lotNumber: 'GLY-DEMO-A',
                    expiryDate: plus(240),
                  },
                  {
                    locationId: RECEIVING,
                    quantity: '8',
                    lotNumber: 'GLY-DEMO-B',
                    expiryDate: plus(40),
                  },
                ],
              }
            : { acceptedQuantity: '300', allocations: [{ locationId: MAIN, quantity: '300' }] };
        await receiving.saveLine(asWh, grId, l.id, ReceiptLineBody.parse(input), meta);
      }
      await receiving.post(asWh, grId, meta);
      created++;
    }
  });
  // ---- Production: formulas, then a short-closed order whose output reaches stock
  const opsActor = await loadProductionActor(db, asOps);
  const ownerActor = await loadProductionActor(db, asOwner);
  const boms = new BomService(db, 'seed');
  const mos = new ProductionOrderService(db, 'seed');
  const issues = new MaterialIssueService(db, 'seed');
  const outputs = new OutputService(db, 'seed');
  const fgReceipts = new FinishedGoodsService(db, 'seed');
  const canProduce =
    opsActor.bomManage &&
    opsActor.create &&
    opsActor.approve &&
    opsActor.materials &&
    opsActor.execution &&
    opsActor.issuePost &&
    opsActor.usage &&
    opsActor.outputCreate &&
    opsActor.outputApprove &&
    opsActor.complete &&
    ownerActor.fgConfirm;
  if (!canProduce) return outcome();

  const formula = async (fg: { id: string }, lines: { itemId: string; quantity: string }[]) => {
    if (await db.productionBom.count({ where: { companyId, itemId: fg.id } })) return;
    need(ops);
    const id = await boms.createAs(
      opsActor,
      { itemId: fg.id, outputQuantity: '1', note: 'Demo (EP39): standard formula', lines },
      meta,
    );
    await boms.activateAs(opsActor, id, meta);
    created++;
  };
  await guard('BOM_EP39', async () => {
    await formula(fg2, [
      { itemId: rm2.id, quantity: '0.05' },
      { itemId: pk2.id, quantity: '1' },
    ]);
    await formula(fg3, [
      { itemId: rm3.id, quantity: '0.1' },
      { itemId: pk2.id, quantity: '1' },
    ]);
  });
  const moOf = async (key: string) => {
    const id = await marked('PRODUCTION_ORDER_CREATED', key);
    return id ? db.productionOrder.findUnique({ where: { id } }) : null;
  };
  await guard('MO_EP39_SHORT_CLOSED', async () => {
    if (!(await moOf('MO_EP39_SHORT_CLOSED'))) {
      need(ops, owner);
      const id = await mos.createAs(
        opsActor,
        asOps,
        {
          itemId: fg2.id,
          branchId: branch.id,
          quantity: '20',
          plannedStartDate: today,
          requiredDate: plus(3),
          note: 'Demo (EP39): serum batch',
        },
        meta,
        demo('MO_EP39_SHORT_CLOSED'),
      );
      created++;
      await mos.transition(opsActor, id, 'submit', meta);
      await mos.transition(opsActor, id, 'approve', meta);
      const reserved = await mos.allocateAs(opsActor, id, meta);
      // Execution needs every material reserved; otherwise the order simply stays reserved.
      if (!reserved.some((l) => l.shortage.gt(0))) {
        await mos.transition(opsActor, id, 'release', meta);
        await mos.executeAs(opsActor, id, 'start', 'Demo (EP39): serum line', meta);
        await issues.postAs(
          opsActor,
          await issues.createAs(opsActor, { productionOrderId: id, note: 'Demo (EP39)' }, meta),
          meta,
        );
        for (const m of await db.productionOrderMaterial.findMany({
          where: { productionOrderId: id },
        })) {
          await mos.recordUsageAs(
            opsActor,
            id,
            {
              materialId: m.id,
              // Less than issued: a recorded usage variance (spillage / two bottles unused).
              quantity: m.itemId === rm2.id ? '0.95' : '18',
              note: 'Demo (EP39)',
            },
            meta,
          );
        }
        const out = await outputs.createAs(
          opsActor,
          {
            productionOrderId: id,
            productionDate: today,
            goodQuantity: '16',
            defectiveQuantity: '2',
            note: 'Demo (EP39): two bottles leaked',
          },
          meta,
        );
        await outputs.submitAs(opsActor, out, meta);
        await outputs.acceptAs(opsActor, out, undefined, meta);
        const fgr = await fgReceipts.createAs(
          ownerActor,
          {
            outputReportId: out,
            lines: [
              {
                locationId: MAIN,
                quantity: '16',
                lotNumber: 'SER-DEMO-01',
                expiryDate: plus(365),
                manufacturedDate: today,
              },
            ],
            note: 'Demo (EP39)',
          },
          meta,
        );
        await fgReceipts.postAs(ownerActor, fgr, meta);
        await mos.reviewAs(opsActor, id, null, meta);
        await mos.completeAs(
          opsActor,
          id,
          {
            outcome: 'SHORT_CLOSED',
            materialsReviewed: true,
            reason: 'สูญเสียระหว่างผลิต ไม่ผลิตเพิ่ม (ข้อมูลสาธิต)',
          },
          meta,
        );
      }
    }
  });
  // ---- Sales: the manufactured serum to a customer, end to end
  const so = new SalesOrderService(db, 'seed');
  const ful = new FulfilmentService(db, 'seed');
  const salesOrder = async (
    key: string,
    customerId: string,
    lines: { itemId: string; quantity: string; unitPrice: string }[],
    submit: boolean,
  ) => {
    if (await marked('SALES_ORDER_CREATED', key)) return null;
    need(sales);
    await so.create(
      asSales,
      CreateSoBody.parse({
        customerId,
        requestedDate: plus(5),
        customerReference: `DEMO-${key.replace(/_/g, '-')}`,
        lines: lines.map((l) => ({ ...l, taxRate: '7' })),
      }),
      meta,
      demo(key),
    );
    const id = (await marked('SALES_ORDER_CREATED', key))!;
    if (submit) await so.submit(asSales, id, meta);
    created++;
    return id;
  };
  await guard('SO_EP39_DELIVERED', async () => {
    if (!(await marked('SALES_ORDER_CREATED', 'SO_EP39_DELIVERED'))) need(sales, owner, wh);
    const deliveredId = await salesOrder(
      'SO_EP39_DELIVERED',
      cus2.id,
      [{ itemId: fg2.id, quantity: '6', unitPrice: '290' }],
      true,
    );
    if (deliveredId) {
      await so.confirm(asOwner, deliveredId, meta);
      const lot = await db.inventoryLot.findFirst({
        where: { companyId, itemId: fg2.id, lotNumber: 'SER-DEMO-01' },
      });
      if (lot) {
        await so.allocate(asOwner, deliveredId, meta);
        const reserved = await db.salesAllocation.findMany({
          where: { salesOrderId: deliveredId, status: 'ACTIVE' },
        });
        if (reserved.length) {
          const { pick } = await ful.createPick(
            asWh,
            { salesOrderId: deliveredId, note: null },
            meta,
          );
          await ful.startPick(asWh, pick.id, meta);
          await ful.confirmPick(
            asWh,
            pick.id,
            { lines: pick.lines.map((l) => ({ lineId: l.id, pickedQuantity: l.planned })) },
            meta,
          );
          const { pack } = await ful.createPack(
            asWh,
            {
              salesOrderId: deliveredId,
              packageCount: 1,
              packageReference: null,
              note: null,
            },
            meta,
          );
          await ful.confirmPack(asWh, pack.id, meta);
          const { shipment } = await ful.createShipment(
            asWh,
            {
              salesOrderId: deliveredId,
              packIds: [pack.id],
              shipToAddress: '25 ถนนทดลอง (ข้อมูลสาธิต) นนทบุรี 11000',
              carrier: 'รถบริษัท (ข้อมูลสาธิต)',
              trackingReference: null,
              note: null,
            },
            meta,
          );
          await ful.dispatch(
            asOwner,
            shipment.id,
            { handedOverTo: 'พนักงานขับรถ (ข้อมูลสาธิต)', note: null },
            meta,
          );
          await ful.deliver(
            asOwner,
            shipment.id,
            {
              recipientName: 'เภสัชกรผู้จัดการร้าน (ข้อมูลสาธิต)',
              reference: 'POD-DEMO-EP39',
              note: null,
            },
            meta,
          );
        }
      }
    }
  });
  await guard('SO_EP39_SUBMITTED / SO_EP39_DRAFT', async () => {
    await salesOrder(
      'SO_EP39_SUBMITTED',
      cus3.id,
      [{ itemId: fg2.id, quantity: '4', unitPrice: '290' }],
      true,
    );
    await salesOrder(
      'SO_EP39_DRAFT',
      cus2.id,
      [{ itemId: fg2.id, quantity: '2', unitPrice: '290' }],
      false,
    );
  });
  // ---- Sales demand nobody can ship yet → Production → a material shortage for Purchasing
  await guard('SO_EP39_DEMAND / MO_EP39_FOR_SALES', async () => {
    if (
      !(await marked('SALES_ORDER_CREATED', 'SO_EP39_DEMAND')) ||
      !(await moOf('MO_EP39_FOR_SALES'))
    ) {
      need(sales, owner, ops);
    }
    const demandId = await salesOrder(
      'SO_EP39_DEMAND',
      cus2.id,
      [{ itemId: fg3.id, quantity: '12', unitPrice: '350' }],
      true,
    );
    if (demandId) await so.confirm(asOwner, demandId, meta);
    if (!(await moOf('MO_EP39_FOR_SALES'))) {
      const soId = await marked('SALES_ORDER_CREATED', 'SO_EP39_DEMAND');
      const line = soId
        ? await db.salesOrderLine.findFirst({
            where: { salesOrderId: soId, itemId: fg3.id, order: { status: 'CONFIRMED' } },
          })
        : null;
      if (line) {
        const id = await mos.createAs(
          opsActor,
          asOps,
          {
            salesOrderLineId: line.id,
            quantity: '12',
            plannedStartDate: plus(2),
            requiredDate: plus(6),
            priority: 'HIGH',
            note: 'Demo (EP39): for the customer order',
          },
          meta,
          demo('MO_EP39_FOR_SALES'),
        );
        await mos.transition(opsActor, id, 'submit', meta);
        await mos.transition(opsActor, id, 'approve', meta);
        await mos.allocateAs(opsActor, id, meta);
        created++;
      }
    }
  });
  return outcome();
}
