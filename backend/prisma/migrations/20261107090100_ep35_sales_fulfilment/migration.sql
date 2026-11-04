-- EP35 — sales fulfilment: picks, packs, shipments and delivery events (additive,
-- non-destructive). No existing row changes. Changes to existing objects: nullable
-- consumption columns on SalesAllocation, nullable shipment source columns on
-- StockMovement, the movement / reservation / permission CHECKs re-stated as supersets.

-- CreateEnum
CREATE TYPE "SalesPickStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PICKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesPickDiscrepancy" AS ENUM ('SHORT_PICKED', 'DAMAGED', 'MISSING', 'WRONG_ITEM', 'OTHER');

-- CreateEnum
CREATE TYPE "SalesPackStatus" AS ENUM ('DRAFT', 'PACKED', 'DISPATCHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesShipmentStatus" AS ENUM ('READY', 'DISPATCHED', 'DELIVERED', 'DELIVERY_EXCEPTION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesDeliveryEventType" AS ENUM ('DELIVERED', 'PARTIALLY_DELIVERED', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "SalesDeliveryException" AS ENUM ('FAILED_ATTEMPT', 'RECIPIENT_UNAVAILABLE', 'ADDRESS_ISSUE', 'DAMAGED_IN_TRANSIT', 'LOST_IN_TRANSIT', 'PARTIAL_DELIVERY', 'OTHER');


-- AlterTable
ALTER TABLE "SalesAllocation" ADD COLUMN     "consumedAt" TIMESTAMP(3),
ADD COLUMN     "salesShipmentLineId" TEXT,
ADD COLUMN     "splitFromId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "salesShipmentId" TEXT,
ADD COLUMN     "salesShipmentLineId" TEXT;

-- CreateTable
CREATE TABLE "SalesPick" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "SalesPickStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdByMemberId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "startedByMemberId" TEXT,
    "pickedAt" TIMESTAMP(3),
    "pickedByMemberId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPickLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "pickId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "salesOrderLineId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lotId" TEXT,
    "lotKey" TEXT NOT NULL,
    "plannedQuantity" DECIMAL(18,6) NOT NULL,
    "pickedQuantity" DECIMAL(18,6),
    "discrepancy" "SalesPickDiscrepancy",
    "discrepancyNote" TEXT,
    "packedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "dispatchedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPickLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPack" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "SalesPackStatus" NOT NULL DEFAULT 'DRAFT',
    "packageCount" INTEGER NOT NULL DEFAULT 1,
    "packageReference" TEXT,
    "note" TEXT,
    "shipmentId" TEXT,
    "createdByMemberId" TEXT NOT NULL,
    "packedAt" TIMESTAMP(3),
    "packedByMemberId" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPackLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "pickLineId" TEXT NOT NULL,
    "salesOrderLineId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesPackLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesShipment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "SalesShipmentStatus" NOT NULL DEFAULT 'READY',
    "shipToName" TEXT NOT NULL,
    "shipToAddress" TEXT,
    "carrier" TEXT,
    "trackingReference" TEXT,
    "note" TEXT,
    "createdByMemberId" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "dispatchedByMemberId" TEXT,
    "handedOverTo" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesShipmentLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "packLineId" TEXT NOT NULL,
    "pickLineId" TEXT NOT NULL,
    "salesOrderLineId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "deliveredQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesShipmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesDeliveryEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" "SalesDeliveryEventType" NOT NULL,
    "reason" "SalesDeliveryException",
    "recipientName" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesPick_companyId_branchId_status_updatedAt_idx" ON "SalesPick"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SalesPick_salesOrderId_idx" ON "SalesPick"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPick_companyId_number_key" ON "SalesPick"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPick_id_salesOrderId_branchId_companyId_key" ON "SalesPick"("id", "salesOrderId", "branchId", "companyId");

-- CreateIndex
CREATE INDEX "SalesPickLine_allocationId_idx" ON "SalesPickLine"("allocationId");

-- CreateIndex
CREATE INDEX "SalesPickLine_salesOrderId_idx" ON "SalesPickLine"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPickLine_pickId_lineNo_key" ON "SalesPickLine"("pickId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPickLine_id_salesOrderLineId_key" ON "SalesPickLine"("id", "salesOrderLineId");

-- CreateIndex
CREATE INDEX "SalesPack_companyId_branchId_status_updatedAt_idx" ON "SalesPack"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SalesPack_salesOrderId_idx" ON "SalesPack"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesPack_shipmentId_idx" ON "SalesPack"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPack_companyId_number_key" ON "SalesPack"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPack_id_salesOrderId_companyId_key" ON "SalesPack"("id", "salesOrderId", "companyId");

-- CreateIndex
CREATE INDEX "SalesPackLine_pickLineId_idx" ON "SalesPackLine"("pickLineId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPackLine_packId_lineNo_key" ON "SalesPackLine"("packId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPackLine_id_pickLineId_salesOrderLineId_key" ON "SalesPackLine"("id", "pickLineId", "salesOrderLineId");

-- CreateIndex
CREATE INDEX "SalesShipment_companyId_branchId_status_updatedAt_idx" ON "SalesShipment"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SalesShipment_salesOrderId_idx" ON "SalesShipment"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesShipment_companyId_number_key" ON "SalesShipment"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SalesShipment_id_branchId_companyId_key" ON "SalesShipment"("id", "branchId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesShipment_id_salesOrderId_companyId_key" ON "SalesShipment"("id", "salesOrderId", "companyId");

-- CreateIndex
CREATE INDEX "SalesShipmentLine_packLineId_idx" ON "SalesShipmentLine"("packLineId");

-- CreateIndex
CREATE INDEX "SalesShipmentLine_salesOrderLineId_idx" ON "SalesShipmentLine"("salesOrderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesShipmentLine_shipmentId_lineNo_key" ON "SalesShipmentLine"("shipmentId", "lineNo");

-- CreateIndex
CREATE INDEX "SalesDeliveryEvent_shipmentId_occurredAt_idx" ON "SalesDeliveryEvent"("shipmentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesAllocation_salesShipmentLineId_key" ON "SalesAllocation"("salesShipmentLineId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesAllocation_id_salesOrderLineId_locationId_lotKey_key" ON "SalesAllocation"("id", "salesOrderLineId", "locationId", "lotKey");

-- CreateIndex
CREATE INDEX "StockMovement_salesShipmentId_idx" ON "StockMovement"("salesShipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_salesShipmentLineId_type_key" ON "StockMovement"("salesShipmentLineId", "type");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_salesShipmentId_branchId_companyId_fkey" FOREIGN KEY ("salesShipmentId", "branchId", "companyId") REFERENCES "SalesShipment"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_salesShipmentLineId_fkey" FOREIGN KEY ("salesShipmentLineId") REFERENCES "SalesShipmentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_salesShipmentLineId_fkey" FOREIGN KEY ("salesShipmentLineId") REFERENCES "SalesShipmentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_splitFromId_fkey" FOREIGN KEY ("splitFromId") REFERENCES "SalesAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPick" ADD CONSTRAINT "SalesPick_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPick" ADD CONSTRAINT "SalesPick_salesOrderId_branchId_companyId_fkey" FOREIGN KEY ("salesOrderId", "branchId", "companyId") REFERENCES "SalesOrder"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPick" ADD CONSTRAINT "SalesPick_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPick" ADD CONSTRAINT "SalesPick_startedByMemberId_companyId_fkey" FOREIGN KEY ("startedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPick" ADD CONSTRAINT "SalesPick_pickedByMemberId_companyId_fkey" FOREIGN KEY ("pickedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPick" ADD CONSTRAINT "SalesPick_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPickLine" ADD CONSTRAINT "SalesPickLine_pickId_salesOrderId_branchId_companyId_fkey" FOREIGN KEY ("pickId", "salesOrderId", "branchId", "companyId") REFERENCES "SalesPick"("id", "salesOrderId", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPickLine" ADD CONSTRAINT "SalesPickLine_salesOrderLineId_salesOrderId_companyId_fkey" FOREIGN KEY ("salesOrderLineId", "salesOrderId", "companyId") REFERENCES "SalesOrderLine"("id", "salesOrderId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPickLine" ADD CONSTRAINT "SalesPickLine_allocationId_salesOrderLineId_locationId_lot_fkey" FOREIGN KEY ("allocationId", "salesOrderLineId", "locationId", "lotKey") REFERENCES "SalesAllocation"("id", "salesOrderLineId", "locationId", "lotKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPickLine" ADD CONSTRAINT "SalesPickLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPickLine" ADD CONSTRAINT "SalesPickLine_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPickLine" ADD CONSTRAINT "SalesPickLine_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPack" ADD CONSTRAINT "SalesPack_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPack" ADD CONSTRAINT "SalesPack_salesOrderId_branchId_companyId_fkey" FOREIGN KEY ("salesOrderId", "branchId", "companyId") REFERENCES "SalesOrder"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPack" ADD CONSTRAINT "SalesPack_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SalesShipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPack" ADD CONSTRAINT "SalesPack_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPack" ADD CONSTRAINT "SalesPack_packedByMemberId_companyId_fkey" FOREIGN KEY ("packedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPack" ADD CONSTRAINT "SalesPack_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPackLine" ADD CONSTRAINT "SalesPackLine_packId_salesOrderId_companyId_fkey" FOREIGN KEY ("packId", "salesOrderId", "companyId") REFERENCES "SalesPack"("id", "salesOrderId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPackLine" ADD CONSTRAINT "SalesPackLine_pickLineId_salesOrderLineId_fkey" FOREIGN KEY ("pickLineId", "salesOrderLineId") REFERENCES "SalesPickLine"("id", "salesOrderLineId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPackLine" ADD CONSTRAINT "SalesPackLine_salesOrderLineId_salesOrderId_companyId_fkey" FOREIGN KEY ("salesOrderLineId", "salesOrderId", "companyId") REFERENCES "SalesOrderLine"("id", "salesOrderId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesShipment" ADD CONSTRAINT "SalesShipment_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesShipment" ADD CONSTRAINT "SalesShipment_salesOrderId_branchId_companyId_fkey" FOREIGN KEY ("salesOrderId", "branchId", "companyId") REFERENCES "SalesOrder"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesShipment" ADD CONSTRAINT "SalesShipment_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesShipment" ADD CONSTRAINT "SalesShipment_dispatchedByMemberId_companyId_fkey" FOREIGN KEY ("dispatchedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesShipment" ADD CONSTRAINT "SalesShipment_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesShipmentLine" ADD CONSTRAINT "SalesShipmentLine_shipmentId_salesOrderId_companyId_fkey" FOREIGN KEY ("shipmentId", "salesOrderId", "companyId") REFERENCES "SalesShipment"("id", "salesOrderId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesShipmentLine" ADD CONSTRAINT "SalesShipmentLine_packLineId_pickLineId_salesOrderLineId_fkey" FOREIGN KEY ("packLineId", "pickLineId", "salesOrderLineId") REFERENCES "SalesPackLine"("id", "pickLineId", "salesOrderLineId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesShipmentLine" ADD CONSTRAINT "SalesShipmentLine_salesOrderLineId_salesOrderId_companyId_fkey" FOREIGN KEY ("salesOrderLineId", "salesOrderId", "companyId") REFERENCES "SalesOrderLine"("id", "salesOrderId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDeliveryEvent" ADD CONSTRAINT "SalesDeliveryEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SalesShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDeliveryEvent" ADD CONSTRAINT "SalesDeliveryEvent_recordedByMemberId_companyId_fkey" FOREIGN KEY ("recordedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- EP35 (hand-written) -------------------------------------------------------

-- The movement taxonomy widens once more: SALES_ISSUE is always negative and names
-- the dispatched shipment line. Existing rows already satisfy this.
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_check";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_check"
    CHECK (
        "quantityDelta" <> 0
        AND ("type" NOT IN ('PURCHASE_RECEIPT', 'TRANSFER_IN', 'TRANSFER_OUT_REVERSAL',
                            'ADJUSTMENT_IN', 'ADJUSTMENT_OUT_REVERSAL') OR "quantityDelta" > 0)
        AND ("type" NOT IN ('PURCHASE_RECEIPT_REVERSAL', 'TRANSFER_OUT', 'TRANSFER_IN_REVERSAL',
                            'ADJUSTMENT_OUT', 'ADJUSTMENT_IN_REVERSAL', 'SALES_ISSUE') OR "quantityDelta" < 0)
        AND "sourceType" IN ('GOODS_RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'CYCLE_COUNT', 'SALES_SHIPMENT')
        AND (("sourceType" = 'GOODS_RECEIPT') = ("type" IN ('PURCHASE_RECEIPT', 'PURCHASE_RECEIPT_REVERSAL')))
        AND (("sourceType" = 'TRANSFER') = ("type" IN ('TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER_OUT_REVERSAL', 'TRANSFER_IN_REVERSAL')))
        AND (("sourceType" = 'ADJUSTMENT') = ("type" IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ADJUSTMENT_IN_REVERSAL', 'ADJUSTMENT_OUT_REVERSAL')))
        AND (("sourceType" = 'CYCLE_COUNT') = ("type" = 'COUNT_CORRECTION'))
        AND (("sourceType" = 'SALES_SHIPMENT') = ("type" = 'SALES_ISSUE'))
        AND ("sourceType" <> 'GOODS_RECEIPT'
            OR ("goodsReceiptId" IS NOT NULL AND "goodsReceiptLineId" IS NOT NULL AND "goodsReceiptAllocationId" IS NOT NULL))
        AND ("sourceType" <> 'TRANSFER' OR ("transferId" IS NOT NULL AND "transferLineId" IS NOT NULL))
        AND ("sourceType" <> 'ADJUSTMENT' OR ("adjustmentId" IS NOT NULL AND "adjustmentLineId" IS NOT NULL))
        AND ("sourceType" <> 'CYCLE_COUNT' OR ("cycleCountId" IS NOT NULL AND "cycleCountLineId" IS NOT NULL))
        AND ("sourceType" <> 'SALES_SHIPMENT' OR ("salesShipmentId" IS NOT NULL AND "salesShipmentLineId" IS NOT NULL))
    );

-- Reservations: CONSUMED now carries what consumed it (the dispatched shipment line).
ALTER TABLE "SalesAllocation" DROP CONSTRAINT "SalesAllocation_status_check";
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_status_check"
    CHECK (
        (("status" = 'ACTIVE') = ("activeSlot" IS NOT NULL AND "activeSlot"))
        AND (("status" = 'RELEASED')
            = ("releasedAt" IS NOT NULL AND "releasedByMemberId" IS NOT NULL AND "releaseReason" IS NOT NULL))
        AND (("status" = 'CONSUMED') = ("consumedAt" IS NOT NULL AND "salesShipmentLineId" IS NOT NULL))
    );

-- Picks: started before picked; picked or cancelled carries who / when; a picked pick
-- that is cancelled (nothing packed) needs a reason.
ALTER TABLE "SalesPick" ADD CONSTRAINT "SalesPick_check"
    CHECK (
        "number" ~ '^PICK-[0-9]{6}-[0-9]{6,}$'
        AND (("startedAt" IS NULL) = ("startedByMemberId" IS NULL))
        AND ("status" <> 'IN_PROGRESS' OR "startedAt" IS NOT NULL)
        AND (("pickedAt" IS NULL) = ("pickedByMemberId" IS NULL))
        AND ("status" <> 'PICKED' OR "pickedAt" IS NOT NULL)
        AND ("status" NOT IN ('DRAFT', 'IN_PROGRESS') OR "pickedAt" IS NULL)
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
        AND ("status" <> 'CANCELLED' OR "pickedAt" IS NULL OR "cancellationReason" IS NOT NULL)
    );

-- The fulfilment chain per reservation: planned ≥ picked ≥ packed ≥ dispatched ≥ 0,
-- a short pick names its discrepancy, lotKey mirrors the identity.
ALTER TABLE "SalesPickLine" ADD CONSTRAINT "SalesPickLine_check"
    CHECK (
        "lineNo" >= 1
        AND "plannedQuantity" > 0
        AND "lotKey" = COALESCE("lotId", '')
        AND ("pickedQuantity" IS NULL OR ("pickedQuantity" >= 0 AND "pickedQuantity" <= "plannedQuantity"))
        AND ((COALESCE("pickedQuantity" < "plannedQuantity", false)) = ("discrepancy" IS NOT NULL))
        AND ("discrepancy" IS DISTINCT FROM 'OTHER' OR "discrepancyNote" IS NOT NULL)
        AND "packedQuantity" >= 0
        AND "packedQuantity" <= COALESCE("pickedQuantity", 0)
        AND "dispatchedQuantity" >= 0
        AND "dispatchedQuantity" <= "packedQuantity"
    );

ALTER TABLE "SalesPack" ADD CONSTRAINT "SalesPack_check"
    CHECK (
        "number" ~ '^PACK-[0-9]{6}-[0-9]{6,}$'
        AND "packageCount" BETWEEN 1 AND 9999
        AND (("packedAt" IS NULL) = ("packedByMemberId" IS NULL))
        AND ("status" NOT IN ('PACKED', 'DISPATCHED') OR "packedAt" IS NOT NULL)
        AND (("status" = 'DISPATCHED') = ("dispatchedAt" IS NOT NULL))
        AND ("status" <> 'DISPATCHED' OR "shipmentId" IS NOT NULL)
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
        AND ("status" <> 'CANCELLED' OR "shipmentId" IS NULL)
    );

ALTER TABLE "SalesPackLine" ADD CONSTRAINT "SalesPackLine_check"
    CHECK ("lineNo" >= 1 AND "quantity" > 0);

ALTER TABLE "SalesShipment" ADD CONSTRAINT "SalesShipment_check"
    CHECK (
        "number" ~ '^SHP-[0-9]{6}-[0-9]{6,}$'
        AND length(btrim("shipToName")) > 0
        AND (("dispatchedAt" IS NULL) = ("dispatchedByMemberId" IS NULL))
        AND (("status" IN ('DISPATCHED', 'DELIVERED', 'DELIVERY_EXCEPTION')) = ("dispatchedAt" IS NOT NULL))
        AND (("status" = 'DELIVERED') = ("deliveredAt" IS NOT NULL))
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
    );

ALTER TABLE "SalesShipmentLine" ADD CONSTRAINT "SalesShipmentLine_check"
    CHECK (
        "lineNo" >= 1
        AND "quantity" > 0
        AND "deliveredQuantity" >= 0
        AND "deliveredQuantity" <= "quantity"
    );

-- A delivery is plain; a partial delivery or an exception names why (OTHER: a note).
ALTER TABLE "SalesDeliveryEvent" ADD CONSTRAINT "SalesDeliveryEvent_check"
    CHECK (
        (("type" = 'DELIVERED') = ("reason" IS NULL))
        AND ("type" <> 'PARTIALLY_DELIVERED' OR "reason" = 'PARTIAL_DELIVERY')
        AND ("reason" IS DISTINCT FROM 'OTHER' OR "note" IS NOT NULL)
    );

-- Fulfilment history is never deleted: documents are cancelled, not removed.
CREATE FUNCTION "sales_fulfilment_keep"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% rows are never deleted: cancel the document instead', TG_TABLE_NAME;
END;
$$;
CREATE TRIGGER "SalesPick_keep" BEFORE DELETE ON "SalesPick"
    FOR EACH ROW EXECUTE FUNCTION "sales_fulfilment_keep"();
CREATE TRIGGER "SalesPickLine_keep" BEFORE DELETE ON "SalesPickLine"
    FOR EACH ROW EXECUTE FUNCTION "sales_fulfilment_keep"();
CREATE TRIGGER "SalesPack_keep" BEFORE DELETE ON "SalesPack"
    FOR EACH ROW EXECUTE FUNCTION "sales_fulfilment_keep"();
CREATE TRIGGER "SalesPackLine_keep" BEFORE DELETE ON "SalesPackLine"
    FOR EACH ROW EXECUTE FUNCTION "sales_fulfilment_keep"();
CREATE TRIGGER "SalesShipment_keep" BEFORE DELETE ON "SalesShipment"
    FOR EACH ROW EXECUTE FUNCTION "sales_fulfilment_keep"();
CREATE TRIGGER "SalesShipmentLine_keep" BEFORE DELETE ON "SalesShipmentLine"
    FOR EACH ROW EXECUTE FUNCTION "sales_fulfilment_keep"();

-- Delivery evidence is append-only.
CREATE FUNCTION "sales_delivery_event_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'SalesDeliveryEvent rows are immutable';
END;
$$;
CREATE TRIGGER "SalesDeliveryEvent_immutable" BEFORE UPDATE OR DELETE ON "SalesDeliveryEvent"
    FOR EACH ROW EXECUTE FUNCTION "sales_delivery_event_immutable"();

-- What was dispatched never goes back: a dispatched shipment (or pack) cannot return to a
-- pre-dispatch state, its dispatch record is fixed, and a delivered shipment stays delivered.
CREATE FUNCTION "sales_shipment_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD."dispatchedAt" IS NOT NULL AND (
        NEW."status" IN ('READY', 'CANCELLED')
        OR NEW."dispatchedAt" IS DISTINCT FROM OLD."dispatchedAt"
        OR NEW."dispatchedByMemberId" IS DISTINCT FROM OLD."dispatchedByMemberId"
        OR NEW."salesOrderId" <> OLD."salesOrderId"
        OR NEW."number" <> OLD."number"
    ) THEN
        RAISE EXCEPTION 'A dispatched shipment cannot be changed back';
    END IF;
    IF OLD."status" = 'DELIVERED' AND NEW."status" <> 'DELIVERED' THEN
        RAISE EXCEPTION 'A delivered shipment stays delivered';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "SalesShipment_guard" BEFORE UPDATE ON "SalesShipment"
    FOR EACH ROW EXECUTE FUNCTION "sales_shipment_guard"();

CREATE FUNCTION "sales_pack_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD."status" = 'DISPATCHED' AND (NEW."status" <> 'DISPATCHED' OR NEW."shipmentId" IS DISTINCT FROM OLD."shipmentId") THEN
        RAISE EXCEPTION 'A dispatched pack cannot be changed back';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "SalesPack_guard" BEFORE UPDATE ON "SalesPack"
    FOR EACH ROW EXECUTE FUNCTION "sales_pack_guard"();

-- Lines keep their identity; a shipment line only records more delivered quantity and a
-- pick line's dispatched quantity only grows.
CREATE FUNCTION "sales_shipment_line_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."quantity" <> OLD."quantity" OR NEW."shipmentId" <> OLD."shipmentId"
        OR NEW."packLineId" <> OLD."packLineId" OR NEW."pickLineId" <> OLD."pickLineId"
        OR NEW."salesOrderLineId" <> OLD."salesOrderLineId"
        OR NEW."deliveredQuantity" < OLD."deliveredQuantity" THEN
        RAISE EXCEPTION 'A shipment line changes only by recording more delivered quantity';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "SalesShipmentLine_guard" BEFORE UPDATE ON "SalesShipmentLine"
    FOR EACH ROW EXECUTE FUNCTION "sales_shipment_line_guard"();

CREATE FUNCTION "sales_pick_line_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."allocationId" <> OLD."allocationId" OR NEW."locationId" <> OLD."locationId"
        OR NEW."lotKey" <> OLD."lotKey" OR NEW."itemId" <> OLD."itemId"
        OR NEW."plannedQuantity" <> OLD."plannedQuantity"
        OR NEW."dispatchedQuantity" < OLD."dispatchedQuantity" THEN
        RAISE EXCEPTION 'A pick line keeps its reservation and plan; dispatched quantity only grows';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "SalesPickLine_guard" BEFORE UPDATE ON "SalesPickLine"
    FOR EACH ROW EXECUTE FUNCTION "sales_pick_line_guard"();

-- EP27 permission CHECK, widened again (EP35 fulfilment codes; catalog order).
ALTER TABLE "MemberPermissionOverride" DROP CONSTRAINT "MemberPermissionOverride_permission_check";
ALTER TABLE "MemberPermissionOverride" ADD CONSTRAINT "MemberPermissionOverride_permission_check"
    CHECK ("permission" IN (
        'sales.workspace.view',
        'sales.orders.view',
        'sales.orders.create',
        'sales.orders.edit',
        'sales.orders.approve',
        'sales.orders.cancel',
        'sales.customers.view',
        'sales.customers.manage',
        'sales.items.view',
        'sales.purchase_requests.create',
        'sales.purchase_requests.approve',
        'operations.workspace.view',
        'operations.orders.view',
        'operations.orders.create',
        'operations.orders.edit',
        'operations.orders.update_status',
        'operations.items.view',
        'operations.items.manage',
        'operations.purchase_requests.create',
        'operations.purchase_requests.approve',
        'warehouse.workspace.view',
        'warehouse.inventory.view',
        'warehouse.receiving.view',
        'warehouse.receiving.process',
        'warehouse.receiving.cancel',
        'warehouse.stock_adjustment.create',
        'warehouse.stock_adjustment.approve',
        'warehouse.transfers.create',
        'warehouse.transfers.approve',
        'warehouse.transfers.cancel',
        'warehouse.counts.create',
        'warehouse.counts.approve',
        'warehouse.picking.process',
        'warehouse.dispatch.confirm',
        'warehouse.delivery.confirm',
        'warehouse.items.view',
        'warehouse.locations.view',
        'warehouse.locations.manage',
        'warehouse.purchase_requests.create',
        'warehouse.purchase_requests.approve',
        'purchasing.workspace.view',
        'purchasing.requests.view',
        'purchasing.requests.create',
        'purchasing.requests.approve',
        'purchasing.orders.view',
        'purchasing.orders.create',
        'purchasing.orders.approve',
        'purchasing.suppliers.view',
        'purchasing.suppliers.manage',
        'purchasing.items.view',
        'purchasing.requests.cancel',
        'purchasing.orders.edit',
        'purchasing.orders.cancel',
        'accounting.workspace.view',
        'accounting.payments.view',
        'accounting.payments.update_status',
        'accounting.documents.view',
        'accounting.customers.view',
        'accounting.suppliers.view',
        'accounting.purchase_requests.create',
        'accounting.purchase_requests.approve',
        'accounting.deposits.view',
        'accounting.deposits.confirm',
        'executive.workspace.view',
        'executive.overview.view'
    ));
