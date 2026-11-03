-- EP32 — inventory transfers, stock adjustments and cycle counts (additive,
-- non-destructive). No existing row changes. Changes to existing objects: six
-- nullable source columns + indexes on StockMovement, its CHECK re-stated for the
-- new types (existing rows satisfy it) and the permission CHECK widened (a superset).

-- CreateEnum
CREATE TYPE "InventoryTransferStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockAdjustmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockAdjustmentReason" AS ENUM ('DAMAGE', 'LOSS', 'SHRINKAGE', 'FOUND', 'EXPIRED', 'COUNT_CORRECTION', 'DATA_CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "AdjustmentDirection" AS ENUM ('INCREASE', 'DECREASE');

-- CreateEnum
CREATE TYPE "CycleCountStatus" AS ENUM ('DRAFT', 'COUNTING', 'REVIEW', 'POSTED', 'CANCELLED');

-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.



-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "adjustmentId" TEXT,
ADD COLUMN     "adjustmentLineId" TEXT,
ADD COLUMN     "cycleCountId" TEXT,
ADD COLUMN     "cycleCountLineId" TEXT,
ADD COLUMN     "transferId" TEXT,
ADD COLUMN     "transferLineId" TEXT;

-- CreateTable
CREATE TABLE "InventoryTransfer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InventoryTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceLocationId" TEXT NOT NULL,
    "destinationLocationId" TEXT NOT NULL,
    "transferDate" DATE NOT NULL,
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

    CONSTRAINT "InventoryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransferLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "lotKey" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "StockAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" "StockAdjustmentReason" NOT NULL,
    "note" TEXT,
    "adjustmentDate" DATE NOT NULL,
    "lineCounter" INTEGER NOT NULL DEFAULT 0,
    "createdByMemberId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedByMemberId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByMemberId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByMemberId" TEXT,
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustmentLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "direction" "AdjustmentDirection" NOT NULL,
    "locationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "newLotNumber" TEXT,
    "newLotExpiry" DATE,
    "quantity" DECIMAL(18,6) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAdjustmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleCount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "CycleCountStatus" NOT NULL DEFAULT 'DRAFT',
    "itemId" TEXT,
    "note" TEXT,
    "countDate" DATE NOT NULL,
    "lineCounter" INTEGER NOT NULL DEFAULT 0,
    "createdByMemberId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "startedByMemberId" TEXT,
    "reviewAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "postedByMemberId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleCountLocation" (
    "cycleCountId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "CycleCountLocation_pkey" PRIMARY KEY ("cycleCountId","locationId")
);

-- CreateTable
CREATE TABLE "CycleCountLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cycleCountId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "locationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "newLotNumber" TEXT,
    "newLotExpiry" DATE,
    "lotKey" TEXT NOT NULL,
    "expected" BOOLEAN NOT NULL,
    "systemQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "countedQuantity" DECIMAL(18,6),
    "countedAt" TIMESTAMP(3),
    "countedByMemberId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryTransfer_companyId_branchId_status_updatedAt_idx" ON "InventoryTransfer"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "InventoryTransfer_sourceLocationId_idx" ON "InventoryTransfer"("sourceLocationId");

-- CreateIndex
CREATE INDEX "InventoryTransfer_destinationLocationId_idx" ON "InventoryTransfer"("destinationLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransfer_companyId_number_key" ON "InventoryTransfer"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransfer_id_branchId_companyId_key" ON "InventoryTransfer"("id", "branchId", "companyId");

-- CreateIndex
CREATE INDEX "InventoryTransferLine_itemId_idx" ON "InventoryTransferLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransferLine_transferId_lineNo_key" ON "InventoryTransferLine"("transferId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransferLine_transferId_itemId_lotKey_key" ON "InventoryTransferLine"("transferId", "itemId", "lotKey");

-- CreateIndex
CREATE INDEX "StockAdjustment_companyId_branchId_status_updatedAt_idx" ON "StockAdjustment"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_companyId_number_key" ON "StockAdjustment"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_id_branchId_companyId_key" ON "StockAdjustment"("id", "branchId", "companyId");

-- CreateIndex
CREATE INDEX "StockAdjustmentLine_locationId_idx" ON "StockAdjustmentLine"("locationId");

-- CreateIndex
CREATE INDEX "StockAdjustmentLine_itemId_idx" ON "StockAdjustmentLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustmentLine_adjustmentId_lineNo_key" ON "StockAdjustmentLine"("adjustmentId", "lineNo");

-- CreateIndex
CREATE INDEX "CycleCount_companyId_branchId_status_updatedAt_idx" ON "CycleCount"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCount_companyId_number_key" ON "CycleCount"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCount_id_branchId_companyId_key" ON "CycleCount"("id", "branchId", "companyId");

-- CreateIndex
CREATE INDEX "CycleCountLocation_locationId_idx" ON "CycleCountLocation"("locationId");

-- CreateIndex
CREATE INDEX "CycleCountLine_itemId_idx" ON "CycleCountLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCountLine_cycleCountId_lineNo_key" ON "CycleCountLine"("cycleCountId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCountLine_cycleCountId_locationId_itemId_lotKey_key" ON "CycleCountLine"("cycleCountId", "locationId", "itemId", "lotKey");

-- CreateIndex
CREATE INDEX "StockMovement_transferId_idx" ON "StockMovement"("transferId");

-- CreateIndex
CREATE INDEX "StockMovement_adjustmentId_idx" ON "StockMovement"("adjustmentId");

-- CreateIndex
CREATE INDEX "StockMovement_cycleCountId_idx" ON "StockMovement"("cycleCountId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_transferLineId_type_key" ON "StockMovement"("transferLineId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_adjustmentLineId_type_key" ON "StockMovement"("adjustmentLineId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_cycleCountLineId_type_key" ON "StockMovement"("cycleCountLineId", "type");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_transferId_branchId_companyId_fkey" FOREIGN KEY ("transferId", "branchId", "companyId") REFERENCES "InventoryTransfer"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_transferLineId_fkey" FOREIGN KEY ("transferLineId") REFERENCES "InventoryTransferLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_adjustmentId_branchId_companyId_fkey" FOREIGN KEY ("adjustmentId", "branchId", "companyId") REFERENCES "StockAdjustment"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_adjustmentLineId_fkey" FOREIGN KEY ("adjustmentLineId") REFERENCES "StockAdjustmentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_cycleCountId_branchId_companyId_fkey" FOREIGN KEY ("cycleCountId", "branchId", "companyId") REFERENCES "CycleCount"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_cycleCountLineId_fkey" FOREIGN KEY ("cycleCountLineId") REFERENCES "CycleCountLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_sourceLocationId_branchId_fkey" FOREIGN KEY ("sourceLocationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_destinationLocationId_branchId_fkey" FOREIGN KEY ("destinationLocationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_postedByMemberId_companyId_fkey" FOREIGN KEY ("postedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferLine" ADD CONSTRAINT "InventoryTransferLine_transferId_branchId_companyId_fkey" FOREIGN KEY ("transferId", "branchId", "companyId") REFERENCES "InventoryTransfer"("id", "branchId", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferLine" ADD CONSTRAINT "InventoryTransferLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferLine" ADD CONSTRAINT "InventoryTransferLine_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_submittedByMemberId_companyId_fkey" FOREIGN KEY ("submittedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_approvedByMemberId_companyId_fkey" FOREIGN KEY ("approvedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_rejectedByMemberId_companyId_fkey" FOREIGN KEY ("rejectedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_adjustmentId_branchId_companyId_fkey" FOREIGN KEY ("adjustmentId", "branchId", "companyId") REFERENCES "StockAdjustment"("id", "branchId", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_startedByMemberId_companyId_fkey" FOREIGN KEY ("startedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_postedByMemberId_companyId_fkey" FOREIGN KEY ("postedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLocation" ADD CONSTRAINT "CycleCountLocation_cycleCountId_branchId_companyId_fkey" FOREIGN KEY ("cycleCountId", "branchId", "companyId") REFERENCES "CycleCount"("id", "branchId", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLocation" ADD CONSTRAINT "CycleCountLocation_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_cycleCountId_branchId_companyId_fkey" FOREIGN KEY ("cycleCountId", "branchId", "companyId") REFERENCES "CycleCount"("id", "branchId", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_countedByMemberId_companyId_fkey" FOREIGN KEY ("countedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;



-- EP32 (hand-written) -------------------------------------------------------

-- The movement taxonomy widens: every type has a fixed sign (a count
-- correction is signed), and every movement names the document line that
-- caused it. Existing rows already satisfy this (receipts only).
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_check";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_check"
    CHECK (
        "quantityDelta" <> 0
        AND ("type" NOT IN ('PURCHASE_RECEIPT', 'TRANSFER_IN', 'TRANSFER_OUT_REVERSAL',
                            'ADJUSTMENT_IN', 'ADJUSTMENT_OUT_REVERSAL') OR "quantityDelta" > 0)
        AND ("type" NOT IN ('PURCHASE_RECEIPT_REVERSAL', 'TRANSFER_OUT', 'TRANSFER_IN_REVERSAL',
                            'ADJUSTMENT_OUT', 'ADJUSTMENT_IN_REVERSAL') OR "quantityDelta" < 0)
        AND "sourceType" IN ('GOODS_RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'CYCLE_COUNT')
        AND (("sourceType" = 'GOODS_RECEIPT') = ("type" IN ('PURCHASE_RECEIPT', 'PURCHASE_RECEIPT_REVERSAL')))
        AND (("sourceType" = 'TRANSFER') = ("type" IN ('TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER_OUT_REVERSAL', 'TRANSFER_IN_REVERSAL')))
        AND (("sourceType" = 'ADJUSTMENT') = ("type" IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ADJUSTMENT_IN_REVERSAL', 'ADJUSTMENT_OUT_REVERSAL')))
        AND (("sourceType" = 'CYCLE_COUNT') = ("type" = 'COUNT_CORRECTION'))
        AND ("sourceType" <> 'GOODS_RECEIPT'
            OR ("goodsReceiptId" IS NOT NULL AND "goodsReceiptLineId" IS NOT NULL AND "goodsReceiptAllocationId" IS NOT NULL))
        AND ("sourceType" <> 'TRANSFER' OR ("transferId" IS NOT NULL AND "transferLineId" IS NOT NULL))
        AND ("sourceType" <> 'ADJUSTMENT' OR ("adjustmentId" IS NOT NULL AND "adjustmentLineId" IS NOT NULL))
        AND ("sourceType" <> 'CYCLE_COUNT' OR ("cycleCountId" IS NOT NULL AND "cycleCountLineId" IS NOT NULL))
    );

-- Transfers: one branch, two different locations; status carries its record.
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_check"
    CHECK (
        "number" ~ '^TR-[0-9]{6}-[0-9]{6,}$'
        AND "lineCounter" >= 0
        AND "sourceLocationId" <> "destinationLocationId"
        AND (("status" = 'DRAFT') = ("postedAt" IS NULL AND "cancelledAt" IS NULL))
        AND (("postedAt" IS NULL) = ("postedByMemberId" IS NULL))
        AND ("status" <> 'POSTED' OR "postedAt" IS NOT NULL)
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
        AND ("status" <> 'CANCELLED' OR "postedAt" IS NULL OR "cancellationReason" IS NOT NULL)
    );

ALTER TABLE "InventoryTransferLine" ADD CONSTRAINT "InventoryTransferLine_check"
    CHECK ("lineNo" >= 1 AND "quantity" > 0 AND "lotKey" = COALESCE("lotId", ''));

-- Adjustments: approved = posted (one action); rejection and reversal carry a reason.
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_check"
    CHECK (
        "number" ~ '^ADJ-[0-9]{6}-[0-9]{6,}$'
        AND "lineCounter" >= 0
        AND (("submittedAt" IS NULL) = ("submittedByMemberId" IS NULL))
        AND (("approvedAt" IS NULL) = ("approvedByMemberId" IS NULL))
        AND ("status" <> 'DRAFT' OR ("submittedAt" IS NULL AND "approvedAt" IS NULL AND "rejectedAt" IS NULL))
        AND ("status" NOT IN ('SUBMITTED', 'POSTED', 'REJECTED') OR "submittedAt" IS NOT NULL)
        AND (("status" = 'POSTED' OR ("status" = 'CANCELLED' AND "approvedAt" IS NOT NULL)) = ("approvedAt" IS NOT NULL))
        AND (("status" = 'REJECTED') = ("rejectedAt" IS NOT NULL AND "rejectedByMemberId" IS NOT NULL AND "rejectionReason" IS NOT NULL))
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
        AND ("status" <> 'CANCELLED' OR "approvedAt" IS NULL OR "cancellationReason" IS NOT NULL)
        AND ("reason" <> 'OTHER' OR "note" IS NOT NULL)
    );

-- A line names an existing lot OR (increase only) a new one; never both.
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_check"
    CHECK (
        "lineNo" >= 1 AND "quantity" > 0
        AND ("lotId" IS NULL OR "newLotNumber" IS NULL)
        AND ("newLotNumber" IS NULL OR ("direction" = 'INCREASE' AND length(btrim("newLotNumber")) > 0))
        AND ("newLotExpiry" IS NULL OR "newLotNumber" IS NOT NULL)
    );

-- Counts: started before review, posted after review; cancellation has who / when.
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_check"
    CHECK (
        "number" ~ '^CC-[0-9]{6}-[0-9]{6,}$'
        AND "lineCounter" >= 0
        AND (("startedAt" IS NULL) = ("startedByMemberId" IS NULL))
        AND ("status" NOT IN ('COUNTING', 'REVIEW', 'POSTED') OR "startedAt" IS NOT NULL)
        AND ("status" NOT IN ('REVIEW', 'POSTED') OR "reviewAt" IS NOT NULL)
        AND (("status" = 'POSTED') = ("postedAt" IS NOT NULL AND "postedByMemberId" IS NOT NULL))
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
    );

-- Exact non-negative quantities (0 is a real count); lotKey mirrors the identity.
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_check"
    CHECK (
        "lineNo" >= 1
        AND "systemQuantity" >= 0
        AND ("countedQuantity" IS NULL OR "countedQuantity" >= 0)
        AND ("lotId" IS NULL OR "newLotNumber" IS NULL)
        AND ("newLotNumber" IS NULL OR (NOT "expected" AND length(btrim("newLotNumber")) > 0))
        AND ("newLotExpiry" IS NULL OR "newLotNumber" IS NOT NULL)
        AND ("expected" OR "systemQuantity" = 0)
        AND "lotKey" = CASE WHEN "lotId" IS NOT NULL THEN "lotId"
                            WHEN "newLotNumber" IS NOT NULL THEN 'new:' || "newLotNumber"
                            ELSE '' END
    );

-- EP27 permission CHECK, widened again (EP32 transfer and count codes; catalog order).
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
