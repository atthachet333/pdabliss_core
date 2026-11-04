-- EP37 material reservation, material issue and production execution
-- (docs/PRODUCTION_MATERIAL_RESERVATION.md, docs/PRODUCTION_MATERIAL_ISSUE.md, docs/PRODUCTION_EXECUTION.md).
-- Additive: four tables, three enums, nullable columns, CHECKs, guards and the widened permission CHECK.

-- CreateEnum
CREATE TYPE "ProductionAllocationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "ProductionAllocationRelease" AS ENUM ('RELEASED', 'REALLOCATED', 'ORDER_CANCELLED');

-- CreateEnum
CREATE TYPE "MaterialIssueStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.




-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "executionNote" TEXT,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "startedByMemberId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "productionMaterialIssueId" TEXT,
ADD COLUMN     "productionMaterialIssueLineId" TEXT;

-- CreateTable
CREATE TABLE "ProductionMaterialAllocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lotId" TEXT,
    "lotKey" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "excess" BOOLEAN NOT NULL DEFAULT false,
    "excessReason" TEXT,
    "status" "ProductionAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeSlot" BOOLEAN DEFAULT true,
    "createdByMemberId" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedByMemberId" TEXT,
    "releaseReason" "ProductionAllocationRelease",
    "consumedAt" TIMESTAMP(3),
    "issueLineId" TEXT,
    "splitFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionMaterialAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMaterialIssue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "MaterialIssueStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "lineCounter" INTEGER NOT NULL DEFAULT 0,
    "createdByMemberId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "postedByMemberId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionMaterialIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMaterialIssueLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "materialId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lotId" TEXT,
    "lotKey" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionMaterialIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMaterialUsage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "note" TEXT,
    "recordedByMemberId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionMaterialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMaterialAllocation_issueLineId_key" ON "ProductionMaterialAllocation"("issueLineId");

-- CreateIndex
CREATE INDEX "ProductionMaterialAllocation_locationId_itemId_lotKey_statu_idx" ON "ProductionMaterialAllocation"("locationId", "itemId", "lotKey", "status");

-- CreateIndex
CREATE INDEX "ProductionMaterialAllocation_companyId_branchId_itemId_stat_idx" ON "ProductionMaterialAllocation"("companyId", "branchId", "itemId", "status");

-- CreateIndex
CREATE INDEX "ProductionMaterialAllocation_productionOrderId_status_idx" ON "ProductionMaterialAllocation"("productionOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMaterialAllocation_materialId_locationId_lotKey_e_key" ON "ProductionMaterialAllocation"("materialId", "locationId", "lotKey", "excess", "activeSlot");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMaterialAllocation_id_productionOrderId_materialI_key" ON "ProductionMaterialAllocation"("id", "productionOrderId", "materialId", "locationId", "lotKey");

-- CreateIndex
CREATE INDEX "ProductionMaterialIssue_companyId_branchId_status_updatedAt_idx" ON "ProductionMaterialIssue"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProductionMaterialIssue_productionOrderId_idx" ON "ProductionMaterialIssue"("productionOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMaterialIssue_companyId_number_key" ON "ProductionMaterialIssue"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMaterialIssue_id_branchId_companyId_key" ON "ProductionMaterialIssue"("id", "branchId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMaterialIssue_id_productionOrderId_key" ON "ProductionMaterialIssue"("id", "productionOrderId");

-- CreateIndex
CREATE INDEX "ProductionMaterialIssueLine_allocationId_idx" ON "ProductionMaterialIssueLine"("allocationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMaterialIssueLine_issueId_lineNo_key" ON "ProductionMaterialIssueLine"("issueId", "lineNo");

-- CreateIndex
CREATE INDEX "ProductionMaterialUsage_productionOrderId_materialId_idx" ON "ProductionMaterialUsage"("productionOrderId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_id_branchId_companyId_key" ON "ProductionOrder"("id", "branchId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrderMaterial_id_productionOrderId_itemId_key" ON "ProductionOrderMaterial"("id", "productionOrderId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrderMaterial_id_productionOrderId_key" ON "ProductionOrderMaterial"("id", "productionOrderId");

-- CreateIndex
CREATE INDEX "StockMovement_productionMaterialIssueId_idx" ON "StockMovement"("productionMaterialIssueId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_productionMaterialIssueLineId_type_key" ON "StockMovement"("productionMaterialIssueLineId", "type");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productionMaterialIssueId_branchId_companyId_fkey" FOREIGN KEY ("productionMaterialIssueId", "branchId", "companyId") REFERENCES "ProductionMaterialIssue"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productionMaterialIssueLineId_fkey" FOREIGN KEY ("productionMaterialIssueLineId") REFERENCES "ProductionMaterialIssueLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_startedByMemberId_companyId_fkey" FOREIGN KEY ("startedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_productionOrderId_branchId_co_fkey" FOREIGN KEY ("productionOrderId", "branchId", "companyId") REFERENCES "ProductionOrder"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_materialId_productionOrderId__fkey" FOREIGN KEY ("materialId", "productionOrderId", "itemId") REFERENCES "ProductionOrderMaterial"("id", "productionOrderId", "itemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_releasedByMemberId_companyId_fkey" FOREIGN KEY ("releasedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_issueLineId_fkey" FOREIGN KEY ("issueLineId") REFERENCES "ProductionMaterialIssueLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_splitFromId_fkey" FOREIGN KEY ("splitFromId") REFERENCES "ProductionMaterialAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialIssue" ADD CONSTRAINT "ProductionMaterialIssue_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialIssue" ADD CONSTRAINT "ProductionMaterialIssue_productionOrderId_branchId_company_fkey" FOREIGN KEY ("productionOrderId", "branchId", "companyId") REFERENCES "ProductionOrder"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialIssue" ADD CONSTRAINT "ProductionMaterialIssue_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialIssue" ADD CONSTRAINT "ProductionMaterialIssue_postedByMemberId_companyId_fkey" FOREIGN KEY ("postedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialIssue" ADD CONSTRAINT "ProductionMaterialIssue_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialIssueLine" ADD CONSTRAINT "ProductionMaterialIssueLine_issueId_productionOrderId_fkey" FOREIGN KEY ("issueId", "productionOrderId") REFERENCES "ProductionMaterialIssue"("id", "productionOrderId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialIssueLine" ADD CONSTRAINT "ProductionMaterialIssueLine_allocationId_productionOrderId_fkey" FOREIGN KEY ("allocationId", "productionOrderId", "materialId", "locationId", "lotKey") REFERENCES "ProductionMaterialAllocation"("id", "productionOrderId", "materialId", "locationId", "lotKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialIssueLine" ADD CONSTRAINT "ProductionMaterialIssueLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialIssueLine" ADD CONSTRAINT "ProductionMaterialIssueLine_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialIssueLine" ADD CONSTRAINT "ProductionMaterialIssueLine_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialUsage" ADD CONSTRAINT "ProductionMaterialUsage_materialId_productionOrderId_fkey" FOREIGN KEY ("materialId", "productionOrderId") REFERENCES "ProductionOrderMaterial"("id", "productionOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterialUsage" ADD CONSTRAINT "ProductionMaterialUsage_recordedByMemberId_companyId_fkey" FOREIGN KEY ("recordedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------- EP37 integrity

-- The ledger: PRODUCTION_CONSUMPTION is negative and always names its posted issue line
-- (re-stated once more — a superset; every existing row satisfies it).
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_check";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_check"
    CHECK (
        "quantityDelta" <> 0
        AND ("type" NOT IN ('PURCHASE_RECEIPT', 'TRANSFER_IN', 'TRANSFER_OUT_REVERSAL',
                            'ADJUSTMENT_IN', 'ADJUSTMENT_OUT_REVERSAL') OR "quantityDelta" > 0)
        AND ("type" NOT IN ('PURCHASE_RECEIPT_REVERSAL', 'TRANSFER_OUT', 'TRANSFER_IN_REVERSAL',
                            'ADJUSTMENT_OUT', 'ADJUSTMENT_IN_REVERSAL', 'SALES_ISSUE',
                            'PRODUCTION_CONSUMPTION') OR "quantityDelta" < 0)
        AND "sourceType" IN ('GOODS_RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'CYCLE_COUNT', 'SALES_SHIPMENT',
                             'PRODUCTION_ISSUE')
        AND (("sourceType" = 'GOODS_RECEIPT') = ("type" IN ('PURCHASE_RECEIPT', 'PURCHASE_RECEIPT_REVERSAL')))
        AND (("sourceType" = 'TRANSFER') = ("type" IN ('TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER_OUT_REVERSAL', 'TRANSFER_IN_REVERSAL')))
        AND (("sourceType" = 'ADJUSTMENT') = ("type" IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ADJUSTMENT_IN_REVERSAL', 'ADJUSTMENT_OUT_REVERSAL')))
        AND (("sourceType" = 'CYCLE_COUNT') = ("type" = 'COUNT_CORRECTION'))
        AND (("sourceType" = 'SALES_SHIPMENT') = ("type" = 'SALES_ISSUE'))
        AND (("sourceType" = 'PRODUCTION_ISSUE') = ("type" = 'PRODUCTION_CONSUMPTION'))
        AND ("sourceType" <> 'GOODS_RECEIPT'
            OR ("goodsReceiptId" IS NOT NULL AND "goodsReceiptLineId" IS NOT NULL AND "goodsReceiptAllocationId" IS NOT NULL))
        AND ("sourceType" <> 'TRANSFER' OR ("transferId" IS NOT NULL AND "transferLineId" IS NOT NULL))
        AND ("sourceType" <> 'ADJUSTMENT' OR ("adjustmentId" IS NOT NULL AND "adjustmentLineId" IS NOT NULL))
        AND ("sourceType" <> 'CYCLE_COUNT' OR ("cycleCountId" IS NOT NULL AND "cycleCountLineId" IS NOT NULL))
        AND ("sourceType" <> 'SALES_SHIPMENT' OR ("salesShipmentId" IS NOT NULL AND "salesShipmentLineId" IS NOT NULL))
        AND ("sourceType" <> 'PRODUCTION_ISSUE'
            OR ("productionMaterialIssueId" IS NOT NULL AND "productionMaterialIssueLineId" IS NOT NULL))
    );

-- Production reservations: one status, its facts; the identity key matches the lot.
ALTER TABLE "ProductionMaterialAllocation" ADD CONSTRAINT "ProductionMaterialAllocation_check"
    CHECK (
        "quantity" > 0
        AND "lotKey" = COALESCE("lotId", '')
        AND (("status" = 'ACTIVE') = ("activeSlot" IS NOT NULL AND "activeSlot"))
        AND (("status" = 'RELEASED')
            = ("releasedAt" IS NOT NULL AND "releasedByMemberId" IS NOT NULL AND "releaseReason" IS NOT NULL))
        AND (("status" = 'CONSUMED') = ("consumedAt" IS NOT NULL AND "issueLineId" IS NOT NULL))
        AND ("excess" = ("excessReason" IS NOT NULL))
    );

ALTER TABLE "ProductionMaterialIssue" ADD CONSTRAINT "ProductionMaterialIssue_check"
    CHECK (
        "number" ~ '^MI-[0-9]{6}-[0-9]{6,}$'
        AND "lineCounter" >= 0
        AND (("status" = 'POSTED') = ("postedAt" IS NOT NULL AND "postedByMemberId" IS NOT NULL))
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
    );

ALTER TABLE "ProductionMaterialIssueLine" ADD CONSTRAINT "ProductionMaterialIssueLine_check"
    CHECK ("quantity" > 0 AND "lineNo" >= 1 AND "lotKey" = COALESCE("lotId", ''));

ALTER TABLE "ProductionMaterialUsage" ADD CONSTRAINT "ProductionMaterialUsage_check"
    CHECK ("quantity" > 0);

-- Production orders: execution facts per status (IN_PRODUCTION / PAUSED were started, PAUSED knows when).
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
    AND ("status" NOT IN ('APPROVED', 'READY', 'IN_PRODUCTION', 'PAUSED')
        OR ("approvedAt" IS NOT NULL AND "approvedByMemberId" IS NOT NULL))
    AND ("status" NOT IN ('READY', 'IN_PRODUCTION', 'PAUSED')
        OR ("releasedAt" IS NOT NULL AND "releasedByMemberId" IS NOT NULL))
    AND ("status" NOT IN ('IN_PRODUCTION', 'PAUSED')
        OR ("startedAt" IS NOT NULL AND "startedByMemberId" IS NOT NULL))
    AND (("startedAt" IS NULL) = ("startedByMemberId" IS NULL))
    AND (("status" = 'PAUSED') = ("pausedAt" IS NOT NULL))
    AND ("status" <> 'REJECTED' OR ("rejectedAt" IS NOT NULL AND "rejectedByMemberId" IS NOT NULL AND "rejectionReason" IS NOT NULL))
    AND ("status" <> 'CANCELLED' OR ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
);

-- The order lifecycle (EP36 guard, extended): READY → IN_PRODUCTION ⇄ PAUSED; a started
-- order keeps its start. COMPLETED does not exist yet (EP38).
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
        OR (OLD."status" = 'IN_PRODUCTION' AND NEW."status" IN ('IN_PRODUCTION', 'PAUSED', 'CANCELLED'))
        OR (OLD."status" = 'PAUSED' AND NEW."status" IN ('PAUSED', 'IN_PRODUCTION', 'CANCELLED'))
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

-- Nothing of execution history is ever deleted.
CREATE TRIGGER "ProductionMaterialAllocation_keep" BEFORE DELETE ON "ProductionMaterialAllocation"
    FOR EACH ROW EXECUTE FUNCTION "production_keep"();
CREATE TRIGGER "ProductionMaterialIssue_keep" BEFORE DELETE ON "ProductionMaterialIssue"
    FOR EACH ROW EXECUTE FUNCTION "production_keep"();
CREATE TRIGGER "ProductionMaterialUsage_keep" BEFORE DELETE ON "ProductionMaterialUsage"
    FOR EACH ROW EXECUTE FUNCTION "production_keep"();

-- Usage records are evidence: appended, never changed.
CREATE FUNCTION "production_usage_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'ProductionMaterialUsage rows are immutable';
END;
$$;
CREATE TRIGGER "ProductionMaterialUsage_immutable" BEFORE UPDATE ON "ProductionMaterialUsage"
    FOR EACH ROW EXECUTE FUNCTION "production_usage_immutable"();

-- A reservation keeps its identity for life; only an ACTIVE one changes (quantity, or to
-- RELEASED / CONSUMED); released and consumed history is final.
CREATE FUNCTION "production_allocation_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."productionOrderId" <> OLD."productionOrderId" OR NEW."materialId" <> OLD."materialId"
        OR NEW."itemId" <> OLD."itemId" OR NEW."locationId" <> OLD."locationId"
        OR NEW."lotKey" <> OLD."lotKey" OR NEW."branchId" <> OLD."branchId"
        OR NEW."excess" <> OLD."excess" OR NEW."companyId" <> OLD."companyId"
        OR NEW."splitFromId" IS DISTINCT FROM OLD."splitFromId" THEN
        RAISE EXCEPTION 'A production reservation keeps its order, material and stock identity';
    END IF;
    IF OLD."status" <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Released or consumed production reservations are history: they never change';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductionMaterialAllocation_guard" BEFORE UPDATE ON "ProductionMaterialAllocation"
    FOR EACH ROW EXECUTE FUNCTION "production_allocation_guard"();

-- A material issue: DRAFT → POSTED | CANCELLED, both final; its number and order never change.
CREATE FUNCTION "material_issue_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."number" <> OLD."number" OR NEW."productionOrderId" <> OLD."productionOrderId"
        OR NEW."branchId" <> OLD."branchId" OR NEW."companyId" <> OLD."companyId" THEN
        RAISE EXCEPTION 'A material issue keeps its number and production order';
    END IF;
    IF OLD."status" <> 'DRAFT' THEN
        RAISE EXCEPTION 'A posted or cancelled material issue is final';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductionMaterialIssue_guard" BEFORE UPDATE ON "ProductionMaterialIssue"
    FOR EACH ROW EXECUTE FUNCTION "material_issue_guard"();

-- Issue lines change only while their issue is a DRAFT (a posted line is immutable).
CREATE FUNCTION "material_issue_line_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    st "MaterialIssueStatus";
BEGIN
    SELECT "status" INTO st FROM "ProductionMaterialIssue"
        WHERE "id" = COALESCE(NEW."issueId", OLD."issueId");
    IF st IS DISTINCT FROM 'DRAFT' THEN
        RAISE EXCEPTION 'The lines of a posted or cancelled material issue are immutable';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductionMaterialIssueLine_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ProductionMaterialIssueLine"
    FOR EACH ROW EXECUTE FUNCTION "material_issue_line_guard"();

-- EP27 permission CHECK, widened again (EP37 codes; catalog order).
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
