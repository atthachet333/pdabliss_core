import type { DepartmentCode } from '../billing/catalog.js';
import type { Db } from '../db/client.js';

/*
 * Canonical operational aggregates shared by the EP47 department dashboards and
 * the EP48 Executive Command Center — ONE definition of each derived state.
 * Read-only PostgreSQL aggregation (GROUP BY + LATERAL sums, no per-row
 * queries), always filtered by company AND an explicit list of branches the
 * caller has already authorized. Nothing is stored.
 *
 * Sales fulfilment (EP35 milestones, per inventory-tracked line):
 *   allocated   ACTIVE + CONSUMED reservations
 *   picked      picked quantity of PICKED picks
 *   dispatched  shipment lines of DISPATCHED / DELIVERED / DELIVERY_EXCEPTION shipments
 *   delivered   delivered quantity of those lines
 * Purchase receiving (EP31): remaining = ordered − accepted − closed rejections, POSTED receipts only.
 * Request ordering (EP30): ordered on ISSUED / WAITING_DEPOSIT / PENDING_RECEIVE / RECEIVED orders.
 */

export interface SalesProgressRow {
  id: string;
  branchId: string;
  number: string;
  customerName: string;
  requestedDate: Date | null;
  confirmedAt: Date | null;
  lines: number;
  unallocated: number;
  unpicked: number;
  undispatched: number;
  undelivered: number;
  someDelivered: boolean;
  exception: boolean;
  lastDelivered: Date | null;
  lastDispatched: Date | null;
}

/** CONFIRMED orders still open, plus those whose last delivery is on/after `since`. */
export function salesProgress(db: Db, companyId: string, branchIds: string[], since: Date) {
  return db.$queryRaw<SalesProgressRow[]>`
    SELECT o."id", o."branchId", o."number", o."customerName", o."requestedDate", o."confirmedAt",
      COUNT(*)::int AS "lines",
      COUNT(*) FILTER (WHERE a.q < l."quantity")::int AS "unallocated",
      COUNT(*) FILTER (WHERE p.pq < l."quantity")::int AS "unpicked",
      COUNT(*) FILTER (WHERE s.dq < l."quantity")::int AS "undispatched",
      COUNT(*) FILTER (WHERE s.vq < l."quantity")::int AS "undelivered",
      BOOL_OR(s.vq > 0) AS "someDelivered",
      EXISTS (SELECT 1 FROM "SalesShipment" x WHERE x."salesOrderId" = o."id"
              AND x."status" = 'DELIVERY_EXCEPTION') AS "exception",
      (SELECT MAX(x."deliveredAt") FROM "SalesShipment" x WHERE x."salesOrderId" = o."id"
              AND x."status" = 'DELIVERED') AS "lastDelivered",
      (SELECT MAX(x."dispatchedAt") FROM "SalesShipment" x WHERE x."salesOrderId" = o."id"
              AND x."status" IN ('DISPATCHED', 'DELIVERED', 'DELIVERY_EXCEPTION')) AS "lastDispatched"
    FROM "SalesOrder" o
    JOIN "SalesOrderLine" l ON l."salesOrderId" = o."id" AND l."inventoryTracked"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(sa."quantity"), 0) AS q FROM "SalesAllocation" sa
      WHERE sa."salesOrderLineId" = l."id" AND sa."status" IN ('ACTIVE', 'CONSUMED')
    ) a ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(pl."pickedQuantity"), 0) AS pq
      FROM "SalesPickLine" pl JOIN "SalesPick" pk ON pk."id" = pl."pickId"
      WHERE pl."salesOrderLineId" = l."id" AND pk."status" = 'PICKED'
    ) p ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(sl."quantity"), 0) AS dq, COALESCE(SUM(sl."deliveredQuantity"), 0) AS vq
      FROM "SalesShipmentLine" sl JOIN "SalesShipment" sh ON sh."id" = sl."shipmentId"
      WHERE sl."salesOrderLineId" = l."id"
        AND sh."status" IN ('DISPATCHED', 'DELIVERED', 'DELIVERY_EXCEPTION')
    ) s ON TRUE
    WHERE o."companyId" = ${companyId} AND o."branchId" = ANY(${branchIds}::text[])
      AND o."status" = 'CONFIRMED'
    GROUP BY o."id"
    HAVING COUNT(*) FILTER (WHERE s.vq < l."quantity") > 0
      OR EXISTS (SELECT 1 FROM "SalesShipment" x WHERE x."salesOrderId" = o."id"
                 AND x."status" = 'DELIVERED' AND x."deliveredAt" >= ${since})
    ORDER BY o."requestedDate" ASC NULLS LAST, o."number" ASC
    LIMIT 5000
  `;
}

/**
 * Exactly one fulfilment stage per CONFIRMED order (the first that applies):
 * all delivered → COMPLETED; an open delivery exception → EXCEPTION; a line not fully
 * reserved → ALLOCATION; a line not fully picked → PICK; a line not fully dispatched →
 * DISPATCH (packing and dispatch); otherwise DELIVERY (dispatched, awaiting delivery).
 */
export type SalesStage =
  'EXCEPTION' | 'ALLOCATION' | 'PICK' | 'DISPATCH' | 'DELIVERY' | 'COMPLETED';
export const salesStage = (o: SalesProgressRow): SalesStage =>
  o.undelivered === 0
    ? 'COMPLETED'
    : o.exception
      ? 'EXCEPTION'
      : o.unallocated > 0
        ? 'ALLOCATION'
        : o.unpicked > 0
          ? 'PICK'
          : o.undispatched > 0
            ? 'DISPATCH'
            : 'DELIVERY';

export interface ReceivingRow {
  id: string;
  branchId: string;
  number: string;
  supplierName: string | null;
  expectedDate: Date | null;
  pendingReceiveAt: Date | null;
  lines: number;
  open: number;
  someReceived: boolean;
}

/** PENDING_RECEIVE orders with line-level receive progress (receivable lines only). */
export function receivingProgress(db: Db, companyId: string, branchIds: string[]) {
  return db.$queryRaw<ReceivingRow[]>`
    SELECT po."id", po."branchId", po."number", po."supplierName", po."expectedDate",
      po."pendingReceiveAt",
      COUNT(*)::int AS "lines",
      COUNT(*) FILTER (WHERE g.acc + g.closed < ol."quantity")::int AS "open",
      BOOL_OR(g.acc + g.rej > 0) AS "someReceived"
    FROM "PurchaseOrder" po
    JOIN "PurchaseOrderLine" ol ON ol."purchaseOrderId" = po."id" AND ol."type" = 'ITEM'
    JOIN "Item" i ON i."id" = ol."itemId" AND i."inventoryTracked"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(gl."acceptedQuantity"), 0) AS acc,
             COALESCE(SUM(gl."rejectedQuantity"), 0) AS rej,
             COALESCE(SUM(gl."rejectedQuantity") FILTER (WHERE NOT gl."replacementRequired"), 0) AS closed
      FROM "GoodsReceiptLine" gl JOIN "GoodsReceipt" gr ON gr."id" = gl."goodsReceiptId"
      WHERE gl."purchaseOrderLineId" = ol."id" AND gr."status" = 'POSTED'
    ) g ON TRUE
    WHERE po."companyId" = ${companyId} AND po."branchId" = ANY(${branchIds}::text[])
      AND po."status" = 'PENDING_RECEIVE'
    GROUP BY po."id"
    ORDER BY po."expectedDate" ASC NULLS LAST, po."number" ASC
    LIMIT 5000
  `;
}

export interface RequestToOrderRow {
  id: string;
  branchId: string;
  number: string;
  department: DepartmentCode;
  needByDate: Date | null;
  approvedAt: Date | null;
  lines: number;
  open: number;
}

/** APPROVED requests with a line not yet fully ordered (draft orders reserve nothing). */
export function requestsToOrder(db: Db, companyId: string, branchIds: string[]) {
  return db.$queryRaw<RequestToOrderRow[]>`
    SELECT r."id", r."branchId", r."number", r."department", r."needByDate", r."approvedAt",
      COUNT(*)::int AS "lines",
      COUNT(*) FILTER (WHERE o.q < rl."quantity")::int AS "open"
    FROM "PurchaseRequest" r
    JOIN "PurchaseRequestLine" rl ON rl."purchaseRequestId" = r."id"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(ol."quantity"), 0) AS q
      FROM "PurchaseOrderLine" ol JOIN "PurchaseOrder" po ON po."id" = ol."purchaseOrderId"
      WHERE ol."purchaseRequestLineId" = rl."id"
        AND po."status" IN ('ISSUED', 'WAITING_DEPOSIT', 'PENDING_RECEIVE', 'RECEIVED')
    ) o ON TRUE
    WHERE r."companyId" = ${companyId} AND r."branchId" = ANY(${branchIds}::text[])
      AND r."status" = 'APPROVED'
    GROUP BY r."id"
    HAVING COUNT(*) FILTER (WHERE o.q < rl."quantity") > 0
    ORDER BY r."needByDate" ASC NULLS LAST, r."number" ASC
    LIMIT 5000
  `;
}
