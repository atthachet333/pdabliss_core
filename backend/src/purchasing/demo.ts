import type { RequestMeta } from '../auth/audit.js';
import type { DepartmentCode } from '../billing/catalog.js';
import { recordCompanyEvent, type PurchaseRequestAuditAction } from '../company/audit.js';
import type { Db, Prisma } from '../db/client.js';
import type { PurchaseRequestStatus } from '../generated/prisma/enums.js';
import { companyDay } from './service.js';

/*
 * Demo purchase requests (EP29) — four small fixtures in the demo company, one
 * per status that matters to a reviewer: a Warehouse DRAFT (demo branch), a
 * Sales request SUBMITTED to Purchasing (Head Office), an Operations request
 * APPROVED by Purchasing, a Purchasing request REJECTED by the owner. EP30
 * adds a Head Office Purchasing request APPROVED by the owner, for the demo
 * purchase orders (order-demo.ts).
 *
 * Created ONCE each: the CREATED audit entry carries a stable `demo` key and
 * a fixture whose key exists is never touched again — whatever happened to it
 * since (edited, decided, cancelled). A fixture whose persona or item is
 * missing (persona password not set) is skipped. Numbers come from the normal
 * sequence; no price, supplier or cost anywhere.
 */

interface Fixture {
  key: string;
  requester: string;
  department: DepartmentCode;
  branch: string;
  purpose: string;
  status: PurchaseRequestStatus;
  decidedBy?: string;
  reason?: string;
  lines: (
    { item: string; quantity: string } | { description: string; quantity: string; unit: string }
  )[];
}

const FIXTURES: Fixture[] = [
  {
    key: 'PR_DRAFT_WAREHOUSE',
    requester: 'warehouse.demo@pdabliss.com',
    department: 'WAREHOUSE',
    branch: '00001',
    purpose: 'เติมกล่องบรรจุภัณฑ์สำหรับสาขาตัวอย่าง (ข้อมูลสาธิต)',
    status: 'DRAFT',
    lines: [{ item: 'PK-000001', quantity: '50' }],
  },
  {
    key: 'PR_SUBMITTED_SALES',
    requester: 'sales.demo@pdabliss.com',
    department: 'SALES',
    branch: '00000',
    purpose: 'สินค้าตัวอย่างสำหรับลูกค้าใหม่ (ข้อมูลสาธิต)',
    status: 'SUBMITTED',
    lines: [
      { item: 'FG-000001', quantity: '24' },
      { description: 'พิมพ์แผ่นพับแนะนำสินค้า (ข้อมูลสาธิต)', quantity: '200', unit: 'แผ่น' },
    ],
  },
  {
    key: 'PR_APPROVED_OPERATIONS',
    requester: 'operations.demo@pdabliss.com',
    department: 'OPERATIONS',
    branch: '00001',
    purpose: 'วัตถุดิบสำหรับรอบการผลิตถัดไป (ข้อมูลสาธิต)',
    status: 'APPROVED',
    decidedBy: 'purchasing.demo@pdabliss.com',
    lines: [{ item: 'RM-000001', quantity: '12.5' }],
  },
  {
    // EP30: the Head Office request the demo purchase orders are placed against.
    key: 'PR_APPROVED_PURCHASING',
    requester: 'purchasing.demo@pdabliss.com',
    department: 'PURCHASING',
    branch: '00000',
    purpose: 'สินค้าสำเร็จรูปและบรรจุภัณฑ์สำหรับไตรมาสถัดไป (ข้อมูลสาธิต)',
    status: 'APPROVED',
    decidedBy: 'owner.demo@pdabliss.com',
    lines: [
      { item: 'FG-000001', quantity: '48' },
      { item: 'PK-000001', quantity: '200' },
    ],
  },
  {
    key: 'PR_REJECTED_PURCHASING',
    requester: 'purchasing.demo@pdabliss.com',
    department: 'PURCHASING',
    branch: '00000',
    purpose: 'เก้าอี้สำนักงานฝ่ายจัดซื้อ (ข้อมูลสาธิต)',
    status: 'REJECTED',
    decidedBy: 'owner.demo@pdabliss.com',
    reason: 'ใช้เก้าอี้ที่มีอยู่ในคลังก่อน (ข้อมูลสาธิต)',
    lines: [{ description: 'เก้าอี้สำนักงาน (ข้อมูลสาธิต)', quantity: '4', unit: 'ตัว' }],
  },
];

export async function seedDemoPurchaseRequests(db: Db, companyId: string, meta: RequestMeta) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const today = companyDay(company.timezone);
  const period = today.slice(0, 7).replace('-', '');
  let created = 0;
  for (const f of FIXTURES) {
    const done = await db.auditLog.count({
      where: {
        companyId,
        action: 'PURCHASE_REQUEST_CREATED',
        changes: { path: ['demo'], equals: f.key },
      },
    });
    if (done) continue;
    const member = (email: string) =>
      db.companyMember.findFirst({
        where: { companyId, user: { emailNormalized: email } },
        include: { user: true },
      });
    const requester = await member(f.requester);
    const decider = f.decidedBy ? await member(f.decidedBy) : null;
    const branch = await db.branch.findUnique({
      where: { companyId_code: { companyId, code: f.branch } },
    });
    if (!requester || !branch || (f.decidedBy && !decider)) continue;
    const items = await db.item.findMany({
      where: {
        companyId,
        code: { in: f.lines.flatMap((l) => ('item' in l ? [l.item] : [])) },
      },
      include: { baseUnit: true },
    });
    if (items.length !== f.lines.filter((l) => 'item' in l).length) continue;

    await db.$transaction(async (tx) => {
      const seq = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "DocumentSequence" ("companyId", "key", "lastValue", "updatedAt")
        VALUES (${companyId}, ${`PR:${period}`}, 1, NOW())
        ON CONFLICT ("companyId", "key")
        DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1, "updatedAt" = NOW()
        RETURNING "lastValue"`;
      const number = `PR-${period}-${String(seq[0]!.lastValue).padStart(6, '0')}`;
      const now = new Date();
      const submitted = f.status !== 'DRAFT';
      const name = requester.user.fullName ?? requester.user.email;
      const data: Prisma.PurchaseRequestUncheckedCreateInput = {
        companyId,
        branchId: branch.id,
        number,
        department: f.department,
        requesterMemberId: requester.id,
        status: f.status,
        requestDate: new Date(`${today}T00:00:00Z`),
        purpose: f.purpose,
        lineCounter: f.lines.length,
        ...(submitted
          ? {
              submittedAt: now,
              branchCodeSnapshot: branch.code,
              branchNameSnapshot: branch.name,
              requesterNameSnapshot: name,
            }
          : {}),
        ...(f.status === 'APPROVED'
          ? { approvedAt: now, approvedByMemberId: decider!.id }
          : f.status === 'REJECTED'
            ? { rejectedAt: now, rejectedByMemberId: decider!.id, rejectionReason: f.reason! }
            : {}),
      };
      const r = await tx.purchaseRequest.create({ data });
      await tx.purchaseRequestLine.createMany({
        data: f.lines.map((l, i) => {
          if ('item' in l) {
            const item = items.find((x) => x.code === l.item)!;
            return {
              companyId,
              purchaseRequestId: r.id,
              lineNo: i + 1,
              type: 'ITEM' as const,
              itemId: item.id,
              itemCode: item.code,
              itemName: item.name,
              unitId: item.baseUnitId,
              unitCode: item.baseUnit.code,
              unitName: item.baseUnit.name,
              quantity: l.quantity,
            };
          }
          return {
            companyId,
            purchaseRequestId: r.id,
            lineNo: i + 1,
            type: 'NON_ITEM' as const,
            description: l.description,
            unitName: l.unit,
            quantity: l.quantity,
          };
        }),
      });
      const event = (
        action: PurchaseRequestAuditAction,
        actorId: string,
        details: Record<string, string>,
      ) =>
        recordCompanyEvent(tx, meta, {
          action,
          actorId,
          actorScope: 'seed',
          companyId,
          entityType: 'PurchaseRequest',
          entityId: r.id,
          details: { number, ...details },
        });
      await event('PURCHASE_REQUEST_CREATED', requester.userId, { demo: f.key });
      if (submitted)
        await event('PURCHASE_REQUEST_SUBMITTED', requester.userId, { to: 'SUBMITTED' });
      if (f.status === 'APPROVED')
        await event('PURCHASE_REQUEST_APPROVED', decider!.userId, { to: 'APPROVED' });
      if (f.status === 'REJECTED')
        await event('PURCHASE_REQUEST_REJECTED', decider!.userId, { to: 'REJECTED' });
    });
    created++;
  }
  return created ? (`created ${created}` as const) : ('unchanged' as const);
}
