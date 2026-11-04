import type { RequestMeta } from '../auth/audit.js';
import type { AuthContext } from '../auth/sessions.js';
import type { Db } from '../db/client.js';
import { FulfilmentService } from './fulfilment.js';

/*
 * Demo sales fulfilment (EP35), after the EP34 demo allocations, in the demo
 * branch (00001). It drives the REAL FulfilmentService (same checks, same
 * ledger path, audit scope 'seed'): warehouse.demo — still Warehouse STAFF —
 * picks, packs and prepares shipments; owner.demo dispatches and records
 * delivery (MANAGE). Packaging (PK-000001) only, small quantities:
 *
 *   SO_CONFIRMED      (EP34) allocated, no pick → ready to pick
 *   SO_FUL_PICKING    12 reserved, one pick of 5 picked → partially picked (7 to pick)
 *   SO_FUL_PACKED     6 picked and packed (2 packages), no shipment yet
 *   SO_FUL_SHIPPED    10 picked; 4 packed, shipped, dispatched and delivered; 6 packed,
 *                     waiting for a shipment → partially dispatched, one delivered shipment
 *   SO_FUL_EXCEPTION  3 dispatched, delivery failed (recipient unavailable)
 *
 * Idempotent: an order that already has a pick is left alone (a second seed changes nothing).
 */

export async function seedDemoFulfilment(db: Db, companyId: string, meta: RequestMeta) {
  const [staff, owner, branch] = await Promise.all([
    db.companyMember.findFirst({
      where: { companyId, user: { emailNormalized: 'warehouse.demo@pdabliss.com' } },
      include: { user: true },
    }),
    db.companyMember.findFirst({
      where: { companyId, role: 'COMPANY_OWNER' },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    }),
    db.branch.findFirst({ where: { companyId, code: '00001' } }),
  ]);
  if (!staff || !owner || !branch) return 'unchanged' as const;
  const ctx = (m: typeof staff) =>
    ({ session: { branchId: branch.id }, user: m.user }) as unknown as AuthContext;
  const asStaff = ctx(staff);
  const asOwner = ctx(owner);
  const s = new FulfilmentService(db, 'seed');

  const orderOf = async (key: string) => {
    const marker = await db.auditLog.findFirst({
      where: { companyId, action: 'SALES_ORDER_CREATED', changes: { path: ['demo'], equals: key } },
    });
    if (!marker) return null;
    const o = await db.salesOrder.findFirst({
      where: { id: marker.entityId, companyId, status: 'CONFIRMED' },
      include: {
        _count: { select: { picks: true } },
        allocations: { where: { status: 'ACTIVE' } },
      },
    });
    // Already fulfilled once, or nothing reserved to fulfil: leave it alone.
    return o && !o._count.picks && o.allocations.length ? o : null;
  };
  const pickAll = async (id: string, quantity?: string) => {
    const o = await db.salesOrder.findUniqueOrThrow({
      where: { id },
      include: { allocations: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } },
    });
    const { pick } = await s.createPick(
      asStaff,
      {
        salesOrderId: id,
        ...(quantity ? { lines: [{ allocationId: o.allocations[0]!.id, quantity }] } : {}),
        note: null,
      },
      meta,
    );
    await s.startPick(asStaff, pick.id, meta);
    return (
      await s.confirmPick(
        asStaff,
        pick.id,
        { lines: pick.lines.map((l) => ({ lineId: l.id, pickedQuantity: l.planned })) },
        meta,
      )
    ).pick;
  };
  const pack = async (
    id: string,
    packageCount: number,
    lines?: { pickLineId: string; quantity: string }[],
  ) => {
    const { pack: p } = await s.createPack(
      asStaff,
      {
        salesOrderId: id,
        packageCount,
        packageReference: null,
        note: null,
        ...(lines ? { lines } : {}),
      },
      meta,
    );
    return (await s.confirmPack(asStaff, p.id, meta)).pack;
  };
  const ship = async (id: string, packId: string) =>
    (
      await s.createShipment(
        asStaff,
        {
          salesOrderId: id,
          packIds: [packId],
          shipToAddress: '99/1 ถนนตัวอย่าง กรุงเทพฯ 10110 (ข้อมูลสาธิต)',
          carrier: 'รถบริษัท (ข้อมูลสาธิต)',
          trackingReference: null,
          note: null,
        },
        meta,
      )
    ).shipment;
  const dispatch = (id: string) =>
    s.dispatch(asOwner, id, { handedOverTo: 'พนักงานขับรถ (ข้อมูลสาธิต)', note: null }, meta);

  let created = 0;
  const picking = await orderOf('SO_FUL_PICKING');
  if (picking) {
    await pickAll(picking.id, '5');
    created++;
  }
  const packed = await orderOf('SO_FUL_PACKED');
  if (packed) {
    await pickAll(packed.id);
    await pack(packed.id, 2);
    created++;
  }
  const shipped = await orderOf('SO_FUL_SHIPPED');
  if (shipped) {
    const p = await pickAll(shipped.id);
    const first = await pack(shipped.id, 1, [{ pickLineId: p.lines[0]!.id, quantity: '4' }]);
    const shp = await ship(shipped.id, first.id);
    await dispatch(shp.id);
    await s.deliver(
      asOwner,
      shp.id,
      { recipientName: 'คุณสมชาย (ข้อมูลสาธิต)', reference: 'POD-DEMO-0001', note: null },
      meta,
    );
    await pack(shipped.id, 2);
    created++;
  }
  const failed = await orderOf('SO_FUL_EXCEPTION');
  if (failed) {
    await pickAll(failed.id);
    const p = await pack(failed.id, 1);
    const shp = await ship(failed.id, p.id);
    await dispatch(shp.id);
    await s.exception(
      asOwner,
      shp.id,
      { reason: 'RECIPIENT_UNAVAILABLE', note: 'ร้านปิด (ข้อมูลสาธิต)' },
      meta,
    );
    created++;
  }
  return created ? (`created ${created}` as const) : ('unchanged' as const);
}
