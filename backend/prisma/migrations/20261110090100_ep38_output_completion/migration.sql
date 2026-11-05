-- EP38 finished goods output, receipt and production completion (docs/PRODUCTION_OUTPUT.md,
-- docs/PRODUCTION_FINISHED_GOODS_RECEIPT.md, docs/PRODUCTION_COMPLETION.md).

-- CreateEnum
CREATE TYPE "ProductionOutputStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinishedGoodsReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ProductionCompletionOutcome" AS ENUM ('COMPLETED', 'SHORT_CLOSED');

-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedByMemberId" TEXT,
ADD COLUMN     "completionOutcome" "ProductionCompletionOutcome",
ADD COLUMN     "completionReason" TEXT,
ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3),
ADD COLUMN     "reviewRequestedByMemberId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "productionGoodsReceiptId" TEXT,
ADD COLUMN     "productionGoodsReceiptLineId" TEXT;

-- CreateTable
CREATE TABLE "ProductionOutputReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ProductionOutputStatus" NOT NULL DEFAULT 'DRAFT',
    "productionDate" DATE NOT NULL,
    "goodQuantity" DECIMAL(18,6) NOT NULL,
    "defectiveQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pendingQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "acceptedQuantity" DECIMAL(18,6),
    "rejectedQuantity" DECIMAL(18,6),
    "note" TEXT,
    "createdByMemberId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedByMemberId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByMemberId" TEXT,
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOutputReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionGoodsReceipt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "outputReportId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "FinishedGoodsReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "lineCounter" INTEGER NOT NULL DEFAULT 0,
    "createdByMemberId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "postedByMemberId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedByMemberId" TEXT,
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionGoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionGoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lotNumber" TEXT,
    "expiryDate" DATE,
    "manufacturedDate" DATE,
    "lotId" TEXT,
    "quantity" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionGoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionOutputReport_companyId_branchId_status_updatedAt_idx" ON "ProductionOutputReport"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProductionOutputReport_productionOrderId_status_idx" ON "ProductionOutputReport"("productionOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOutputReport_companyId_number_key" ON "ProductionOutputReport"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOutputReport_id_productionOrderId_key" ON "ProductionOutputReport"("id", "productionOrderId");

-- CreateIndex
CREATE INDEX "ProductionGoodsReceipt_companyId_branchId_status_updatedAt_idx" ON "ProductionGoodsReceipt"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProductionGoodsReceipt_outputReportId_status_idx" ON "ProductionGoodsReceipt"("outputReportId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionGoodsReceipt_companyId_number_key" ON "ProductionGoodsReceipt"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionGoodsReceipt_id_branchId_companyId_key" ON "ProductionGoodsReceipt"("id", "branchId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionGoodsReceipt_id_productionOrderId_key" ON "ProductionGoodsReceipt"("id", "productionOrderId");

-- CreateIndex
CREATE INDEX "ProductionGoodsReceiptLine_lotId_idx" ON "ProductionGoodsReceiptLine"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionGoodsReceiptLine_receiptId_lineNo_key" ON "ProductionGoodsReceiptLine"("receiptId", "lineNo");

-- CreateIndex
CREATE INDEX "StockMovement_productionGoodsReceiptId_idx" ON "StockMovement"("productionGoodsReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_productionGoodsReceiptLineId_type_key" ON "StockMovement"("productionGoodsReceiptLineId", "type");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productionGoodsReceiptId_branchId_companyId_fkey" FOREIGN KEY ("productionGoodsReceiptId", "branchId", "companyId") REFERENCES "ProductionGoodsReceipt"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productionGoodsReceiptLineId_fkey" FOREIGN KEY ("productionGoodsReceiptLineId") REFERENCES "ProductionGoodsReceiptLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_reviewRequestedByMemberId_companyId_fkey" FOREIGN KEY ("reviewRequestedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_completedByMemberId_companyId_fkey" FOREIGN KEY ("completedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutputReport" ADD CONSTRAINT "ProductionOutputReport_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutputReport" ADD CONSTRAINT "ProductionOutputReport_productionOrderId_branchId_companyI_fkey" FOREIGN KEY ("productionOrderId", "branchId", "companyId") REFERENCES "ProductionOrder"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutputReport" ADD CONSTRAINT "ProductionOutputReport_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutputReport" ADD CONSTRAINT "ProductionOutputReport_submittedByMemberId_companyId_fkey" FOREIGN KEY ("submittedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutputReport" ADD CONSTRAINT "ProductionOutputReport_reviewedByMemberId_companyId_fkey" FOREIGN KEY ("reviewedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutputReport" ADD CONSTRAINT "ProductionOutputReport_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceipt" ADD CONSTRAINT "ProductionGoodsReceipt_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceipt" ADD CONSTRAINT "ProductionGoodsReceipt_productionOrderId_branchId_companyI_fkey" FOREIGN KEY ("productionOrderId", "branchId", "companyId") REFERENCES "ProductionOrder"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceipt" ADD CONSTRAINT "ProductionGoodsReceipt_outputReportId_productionOrderId_fkey" FOREIGN KEY ("outputReportId", "productionOrderId") REFERENCES "ProductionOutputReport"("id", "productionOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceipt" ADD CONSTRAINT "ProductionGoodsReceipt_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceipt" ADD CONSTRAINT "ProductionGoodsReceipt_postedByMemberId_companyId_fkey" FOREIGN KEY ("postedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceipt" ADD CONSTRAINT "ProductionGoodsReceipt_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceipt" ADD CONSTRAINT "ProductionGoodsReceipt_reversedByMemberId_companyId_fkey" FOREIGN KEY ("reversedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceiptLine" ADD CONSTRAINT "ProductionGoodsReceiptLine_receiptId_productionOrderId_fkey" FOREIGN KEY ("receiptId", "productionOrderId") REFERENCES "ProductionGoodsReceipt"("id", "productionOrderId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceiptLine" ADD CONSTRAINT "ProductionGoodsReceiptLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceiptLine" ADD CONSTRAINT "ProductionGoodsReceiptLine_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionGoodsReceiptLine" ADD CONSTRAINT "ProductionGoodsReceiptLine_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------- integrity rules (EP38)

-- Stock movements, re-stated once more (a superset — every existing row satisfies it):
-- PRODUCTION_OUTPUT (+) and PRODUCTION_OUTPUT_REVERSAL (−) belong to a finished goods receipt line.
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_check";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_check"
    CHECK (
        "quantityDelta" <> 0
        AND ("type" NOT IN ('PURCHASE_RECEIPT', 'TRANSFER_IN', 'TRANSFER_OUT_REVERSAL',
                            'ADJUSTMENT_IN', 'ADJUSTMENT_OUT_REVERSAL', 'PRODUCTION_OUTPUT') OR "quantityDelta" > 0)
        AND ("type" NOT IN ('PURCHASE_RECEIPT_REVERSAL', 'TRANSFER_OUT', 'TRANSFER_IN_REVERSAL',
                            'ADJUSTMENT_OUT', 'ADJUSTMENT_IN_REVERSAL', 'SALES_ISSUE',
                            'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT_REVERSAL') OR "quantityDelta" < 0)
        AND "sourceType" IN ('GOODS_RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'CYCLE_COUNT', 'SALES_SHIPMENT',
                             'PRODUCTION_ISSUE', 'PRODUCTION_RECEIPT')
        AND (("sourceType" = 'GOODS_RECEIPT') = ("type" IN ('PURCHASE_RECEIPT', 'PURCHASE_RECEIPT_REVERSAL')))
        AND (("sourceType" = 'TRANSFER') = ("type" IN ('TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER_OUT_REVERSAL', 'TRANSFER_IN_REVERSAL')))
        AND (("sourceType" = 'ADJUSTMENT') = ("type" IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ADJUSTMENT_IN_REVERSAL', 'ADJUSTMENT_OUT_REVERSAL')))
        AND (("sourceType" = 'CYCLE_COUNT') = ("type" = 'COUNT_CORRECTION'))
        AND (("sourceType" = 'SALES_SHIPMENT') = ("type" = 'SALES_ISSUE'))
        AND (("sourceType" = 'PRODUCTION_ISSUE') = ("type" = 'PRODUCTION_CONSUMPTION'))
        AND (("sourceType" = 'PRODUCTION_RECEIPT') = ("type" IN ('PRODUCTION_OUTPUT', 'PRODUCTION_OUTPUT_REVERSAL')))
        AND ("sourceType" <> 'GOODS_RECEIPT'
            OR ("goodsReceiptId" IS NOT NULL AND "goodsReceiptLineId" IS NOT NULL AND "goodsReceiptAllocationId" IS NOT NULL))
        AND ("sourceType" <> 'TRANSFER' OR ("transferId" IS NOT NULL AND "transferLineId" IS NOT NULL))
        AND ("sourceType" <> 'ADJUSTMENT' OR ("adjustmentId" IS NOT NULL AND "adjustmentLineId" IS NOT NULL))
        AND ("sourceType" <> 'CYCLE_COUNT' OR ("cycleCountId" IS NOT NULL AND "cycleCountLineId" IS NOT NULL))
        AND ("sourceType" <> 'SALES_SHIPMENT' OR ("salesShipmentId" IS NOT NULL AND "salesShipmentLineId" IS NOT NULL))
        AND ("sourceType" <> 'PRODUCTION_ISSUE'
            OR ("productionMaterialIssueId" IS NOT NULL AND "productionMaterialIssueLineId" IS NOT NULL))
        AND ("sourceType" <> 'PRODUCTION_RECEIPT'
            OR ("productionGoodsReceiptId" IS NOT NULL AND "productionGoodsReceiptLineId" IS NOT NULL))
    );

-- Production orders: completion facts per status. A COMPLETED order was reviewed and closed with
-- an outcome; a short close always says why.
ALTER TABLE "ProductionOrder" DROP CONSTRAINT "ProductionOrder_check";
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_check" CHECK (
    "quantity" > 0
    AND "unitPrecision" BETWEEN 0 AND 6
    AND (("source" = 'SALES_DEMAND') = ("salesOrderLineId" IS NOT NULL))
    AND (("salesOrderId" IS NULL) = ("salesOrderLineId" IS NULL))
    AND ("requiredDate" IS NULL OR "plannedStartDate" IS NULL OR "requiredDate" >= "plannedStartDate")
    AND (("bomId" IS NULL) = ("bomCode" IS NULL))
    AND (("bomId" IS NULL) = ("bomRevision" IS NULL))
    AND (("bomId" IS NULL) = ("bomOutputQuantity" IS NULL))
    AND ("bomOutputQuantity" IS NULL OR "bomOutputQuantity" > 0)
    AND ("status" IN ('DRAFT', 'CANCELLED') OR "bomId" IS NOT NULL)
    AND ("status" IN ('DRAFT', 'CANCELLED') OR ("submittedAt" IS NOT NULL AND "submittedByMemberId" IS NOT NULL))
    AND ("status" NOT IN ('APPROVED', 'READY', 'IN_PRODUCTION', 'PAUSED', 'COMPLETION_REVIEW', 'COMPLETED')
        OR ("approvedAt" IS NOT NULL AND "approvedByMemberId" IS NOT NULL))
    AND ("status" NOT IN ('READY', 'IN_PRODUCTION', 'PAUSED', 'COMPLETION_REVIEW', 'COMPLETED')
        OR ("releasedAt" IS NOT NULL AND "releasedByMemberId" IS NOT NULL))
    AND ("status" NOT IN ('IN_PRODUCTION', 'PAUSED', 'COMPLETION_REVIEW', 'COMPLETED')
        OR ("startedAt" IS NOT NULL AND "startedByMemberId" IS NOT NULL))
    AND (("startedAt" IS NULL) = ("startedByMemberId" IS NULL))
    AND (("status" = 'PAUSED') = ("pausedAt" IS NOT NULL))
    AND (("reviewRequestedAt" IS NULL) = ("reviewRequestedByMemberId" IS NULL))
    AND ("status" NOT IN ('COMPLETION_REVIEW', 'COMPLETED') OR "reviewRequestedAt" IS NOT NULL)
    AND (("status" = 'COMPLETED')
        = ("completedAt" IS NOT NULL AND "completedByMemberId" IS NOT NULL AND "completionOutcome" IS NOT NULL))
    AND ("completionOutcome" IS DISTINCT FROM 'SHORT_CLOSED' OR "completionReason" IS NOT NULL)
    AND ("status" <> 'REJECTED' OR ("rejectedAt" IS NOT NULL AND "rejectedByMemberId" IS NOT NULL AND "rejectionReason" IS NOT NULL))
    AND ("status" <> 'CANCELLED' OR ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
);

-- The order lifecycle (EP36 + EP37 guard, extended): IN_PRODUCTION / PAUSED → COMPLETION_REVIEW
-- → COMPLETED (terminal) or back to IN_PRODUCTION. Completion facts never change once closed.
CREATE OR REPLACE FUNCTION "production_order_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."number" <> OLD."number" OR NEW."companyId" <> OLD."companyId"
        OR NEW."branchId" <> OLD."branchId" OR NEW."source" <> OLD."source"
        OR NEW."itemId" <> OLD."itemId"
        OR NEW."salesOrderLineId" IS DISTINCT FROM OLD."salesOrderLineId"
        OR NEW."salesOrderId" IS DISTINCT FROM OLD."salesOrderId"
        OR NEW."createdByMemberId" <> OLD."createdByMemberId" THEN
        RAISE EXCEPTION 'A production order keeps its number, branch, source and item';
    END IF;
    IF NOT (
        (OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'SUBMITTED', 'CANCELLED'))
        OR (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('SUBMITTED', 'APPROVED', 'REJECTED'))
        OR (OLD."status" = 'APPROVED' AND NEW."status" IN ('APPROVED', 'READY', 'CANCELLED'))
        OR (OLD."status" = 'READY' AND NEW."status" IN ('READY', 'IN_PRODUCTION', 'CANCELLED'))
        OR (OLD."status" = 'IN_PRODUCTION' AND NEW."status" IN ('IN_PRODUCTION', 'PAUSED', 'COMPLETION_REVIEW', 'CANCELLED'))
        OR (OLD."status" = 'PAUSED' AND NEW."status" IN ('PAUSED', 'IN_PRODUCTION', 'COMPLETION_REVIEW', 'CANCELLED'))
        OR (OLD."status" = 'COMPLETION_REVIEW' AND NEW."status" IN ('COMPLETION_REVIEW', 'IN_PRODUCTION', 'COMPLETED'))
    ) THEN
        RAISE EXCEPTION 'A production order cannot move from % to %', OLD."status", NEW."status";
    END IF;
    IF OLD."status" NOT IN ('DRAFT', 'SUBMITTED') AND (
        NEW."quantity" <> OLD."quantity" OR NEW."bomId" IS DISTINCT FROM OLD."bomId"
        OR NEW."bomCode" IS DISTINCT FROM OLD."bomCode"
        OR NEW."bomRevision" IS DISTINCT FROM OLD."bomRevision"
        OR NEW."bomOutputQuantity" IS DISTINCT FROM OLD."bomOutputQuantity"
        OR NEW."unitId" <> OLD."unitId" OR NEW."unitCode" <> OLD."unitCode"
        OR NEW."unitPrecision" <> OLD."unitPrecision"
        OR NEW."itemCode" <> OLD."itemCode" OR NEW."itemName" <> OLD."itemName"
        OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
        OR NEW."approvedByMemberId" IS DISTINCT FROM OLD."approvedByMemberId"
    ) THEN
        RAISE EXCEPTION 'An approved production order keeps its plan and approval';
    END IF;
    IF OLD."startedAt" IS NOT NULL AND (NEW."startedAt" IS DISTINCT FROM OLD."startedAt"
        OR NEW."startedByMemberId" IS DISTINCT FROM OLD."startedByMemberId") THEN
        RAISE EXCEPTION 'A started production order keeps its start';
    END IF;
    IF OLD."status" = 'COMPLETED' OR (OLD."completedAt" IS NOT NULL AND (
        NEW."completedAt" IS DISTINCT FROM OLD."completedAt"
        OR NEW."completedByMemberId" IS DISTINCT FROM OLD."completedByMemberId"
        OR NEW."completionOutcome" IS DISTINCT FROM OLD."completionOutcome"
        OR NEW."completionReason" IS DISTINCT FROM OLD."completionReason")) THEN
        RAISE EXCEPTION 'A completed production order is final';
    END IF;
    IF OLD."status" = 'DRAFT' AND NEW."status" = 'DRAFT' THEN
        RETURN NEW;
    END IF;
    IF OLD."status" <> 'DRAFT' AND (
        NEW."quantity" <> OLD."quantity" OR NEW."bomId" IS DISTINCT FROM OLD."bomId"
        OR NEW."plannedStartDate" IS DISTINCT FROM OLD."plannedStartDate"
        OR NEW."requiredDate" IS DISTINCT FROM OLD."requiredDate"
        OR NEW."priority" <> OLD."priority"
    ) THEN
        RAISE EXCEPTION 'Only a draft production order can be edited';
    END IF;
    RETURN NEW;
END;
$$;

-- Output reports: OUT-YYYYMM-NNNNNN; reported quantities ≥ 0 and something reported; status facts;
-- an accepted report splits exactly what was reported into accepted good and rejected.
ALTER TABLE "ProductionOutputReport" ADD CONSTRAINT "ProductionOutputReport_check" CHECK (
    "number" ~ '^OUT-[0-9]{6}-[0-9]{6,}$'
    AND "goodQuantity" >= 0 AND "defectiveQuantity" >= 0 AND "pendingQuantity" >= 0
    AND "goodQuantity" + "defectiveQuantity" + "pendingQuantity" > 0
    AND ("status" = 'DRAFT' OR "status" = 'CANCELLED' OR ("submittedAt" IS NOT NULL AND "submittedByMemberId" IS NOT NULL))
    AND (("status" = 'ACCEPTED' OR ("status" = 'CANCELLED' AND "acceptedQuantity" IS NOT NULL))
        = ("acceptedQuantity" IS NOT NULL AND "rejectedQuantity" IS NOT NULL))
    AND ("acceptedQuantity" IS NULL OR ("acceptedQuantity" >= 0 AND "rejectedQuantity" >= 0
        AND "acceptedQuantity" + "rejectedQuantity" = "goodQuantity" + "defectiveQuantity" + "pendingQuantity"
        AND "acceptedQuantity" >= "goodQuantity"))
    AND ("status" NOT IN ('ACCEPTED', 'REJECTED') OR ("reviewedAt" IS NOT NULL AND "reviewedByMemberId" IS NOT NULL))
    AND ("status" <> 'REJECTED' OR "rejectionReason" IS NOT NULL)
    AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
);

-- DRAFT → SUBMITTED → ACCEPTED | REJECTED; DRAFT / SUBMITTED / ACCEPTED → CANCELLED. Reported
-- figures change only in a DRAFT; the acceptance split never changes.
CREATE FUNCTION "production_output_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."number" <> OLD."number" OR NEW."productionOrderId" <> OLD."productionOrderId"
        OR NEW."branchId" <> OLD."branchId" OR NEW."companyId" <> OLD."companyId"
        OR NEW."createdByMemberId" <> OLD."createdByMemberId" THEN
        RAISE EXCEPTION 'An output report keeps its number and production order';
    END IF;
    IF NOT (
        (OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'SUBMITTED', 'CANCELLED'))
        OR (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('ACCEPTED', 'REJECTED', 'CANCELLED'))
        OR (OLD."status" = 'ACCEPTED' AND NEW."status" IN ('ACCEPTED', 'CANCELLED'))
    ) THEN
        RAISE EXCEPTION 'An output report cannot move from % to %', OLD."status", NEW."status";
    END IF;
    IF OLD."status" <> 'DRAFT' AND (
        NEW."goodQuantity" <> OLD."goodQuantity" OR NEW."defectiveQuantity" <> OLD."defectiveQuantity"
        OR NEW."pendingQuantity" <> OLD."pendingQuantity" OR NEW."productionDate" <> OLD."productionDate"
        OR NEW."note" IS DISTINCT FROM OLD."note") THEN
        RAISE EXCEPTION 'A submitted output report keeps what was reported';
    END IF;
    IF OLD."acceptedQuantity" IS NOT NULL AND (NEW."acceptedQuantity" IS DISTINCT FROM OLD."acceptedQuantity"
        OR NEW."rejectedQuantity" IS DISTINCT FROM OLD."rejectedQuantity"
        OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt") THEN
        RAISE EXCEPTION 'An accepted output report keeps its quality decision';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductionOutputReport_guard" BEFORE UPDATE ON "ProductionOutputReport"
    FOR EACH ROW EXECUTE FUNCTION "production_output_guard"();
CREATE TRIGGER "ProductionOutputReport_keep" BEFORE DELETE ON "ProductionOutputReport"
    FOR EACH ROW EXECUTE FUNCTION "production_keep"();

-- Finished goods receipts: FGR-YYYYMM-NNNNNN; DRAFT → POSTED | CANCELLED, POSTED → REVERSED (reason).
ALTER TABLE "ProductionGoodsReceipt" ADD CONSTRAINT "ProductionGoodsReceipt_check" CHECK (
    "number" ~ '^FGR-[0-9]{6}-[0-9]{6,}$'
    AND "lineCounter" >= 0
    AND (("status" IN ('POSTED', 'REVERSED')) = ("postedAt" IS NOT NULL AND "postedByMemberId" IS NOT NULL))
    AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
    AND (("status" = 'REVERSED')
        = ("reversedAt" IS NOT NULL AND "reversedByMemberId" IS NOT NULL AND "reversalReason" IS NOT NULL))
);

CREATE FUNCTION "fg_receipt_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."number" <> OLD."number" OR NEW."productionOrderId" <> OLD."productionOrderId"
        OR NEW."outputReportId" <> OLD."outputReportId"
        OR NEW."branchId" <> OLD."branchId" OR NEW."companyId" <> OLD."companyId" THEN
        RAISE EXCEPTION 'A finished goods receipt keeps its number, order and output report';
    END IF;
    IF NOT (
        (OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'POSTED', 'CANCELLED'))
        OR (OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED')
    ) THEN
        RAISE EXCEPTION 'A finished goods receipt cannot move from % to %', OLD."status", NEW."status";
    END IF;
    IF OLD."status" = 'POSTED' AND (NEW."postedAt" IS DISTINCT FROM OLD."postedAt"
        OR NEW."postedByMemberId" IS DISTINCT FROM OLD."postedByMemberId"
        OR NEW."note" IS DISTINCT FROM OLD."note" OR NEW."lineCounter" <> OLD."lineCounter") THEN
        RAISE EXCEPTION 'A posted finished goods receipt keeps its posting';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductionGoodsReceipt_guard" BEFORE UPDATE ON "ProductionGoodsReceipt"
    FOR EACH ROW EXECUTE FUNCTION "fg_receipt_guard"();
CREATE TRIGGER "ProductionGoodsReceipt_keep" BEFORE DELETE ON "ProductionGoodsReceipt"
    FOR EACH ROW EXECUTE FUNCTION "production_keep"();

ALTER TABLE "ProductionGoodsReceiptLine" ADD CONSTRAINT "ProductionGoodsReceiptLine_check" CHECK (
    "quantity" > 0 AND "lineNo" >= 1
    AND ("lotNumber" IS NOT NULL OR ("expiryDate" IS NULL AND "manufacturedDate" IS NULL AND "lotId" IS NULL))
);

-- Lines change only while their receipt is a DRAFT (posting resolves the lot before the receipt
-- leaves DRAFT); a line always receives the order's finished item.
CREATE FUNCTION "fg_receipt_line_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    st "FinishedGoodsReceiptStatus";
    item TEXT;
BEGIN
    SELECT r."status", o."itemId" INTO st, item FROM "ProductionGoodsReceipt" r
        JOIN "ProductionOrder" o ON o."id" = r."productionOrderId"
        WHERE r."id" = COALESCE(NEW."receiptId", OLD."receiptId");
    IF st IS DISTINCT FROM 'DRAFT' THEN
        RAISE EXCEPTION 'The lines of a posted, cancelled or reversed finished goods receipt are immutable';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    IF NEW."itemId" <> item THEN
        RAISE EXCEPTION 'A finished goods receipt line receives the order''s finished item';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductionGoodsReceiptLine_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ProductionGoodsReceiptLine"
    FOR EACH ROW EXECUTE FUNCTION "fg_receipt_line_guard"();

-- EP27 permission CHECK, widened again (EP38 codes; catalog order).
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
        'operations.orders.approve',
        'operations.orders.cancel',
        'operations.bom.view',
        'operations.bom.manage',
        'operations.materials.manage',
        'operations.material_issues.create',
        'operations.material_issues.approve',
        'operations.material_usage.create',
        'operations.execution.manage',
        'operations.output.create',
        'operations.output.approve',
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
        'warehouse.material_issues.view',
        'warehouse.finished_goods.view',
        'warehouse.finished_goods.process',
        'warehouse.finished_goods.confirm',
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
        'purchasing.production_shortages.view',
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
