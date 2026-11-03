-- CreateEnum
CREATE TYPE "SalesAllocationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "SalesAllocationRelease" AS ENUM ('RELEASED', 'REALLOCATED', 'ORDER_CANCELLED');

-- CreateTable
CREATE TABLE "SalesAllocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "salesOrderLineId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lotId" TEXT,
    "lotKey" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "status" "SalesAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeSlot" BOOLEAN DEFAULT true,
    "createdByMemberId" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedByMemberId" TEXT,
    "releaseReason" "SalesAllocationRelease",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesAllocation_locationId_itemId_lotKey_status_idx" ON "SalesAllocation"("locationId", "itemId", "lotKey", "status");

-- CreateIndex
CREATE INDEX "SalesAllocation_companyId_branchId_itemId_status_idx" ON "SalesAllocation"("companyId", "branchId", "itemId", "status");

-- CreateIndex
CREATE INDEX "SalesAllocation_salesOrderId_status_idx" ON "SalesAllocation"("salesOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesAllocation_salesOrderLineId_locationId_lotKey_activeSl_key" ON "SalesAllocation"("salesOrderLineId", "locationId", "lotKey", "activeSlot");

-- AddForeignKey
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_salesOrderId_branchId_companyId_fkey" FOREIGN KEY ("salesOrderId", "branchId", "companyId") REFERENCES "SalesOrder"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_salesOrderLineId_salesOrderId_companyId_fkey" FOREIGN KEY ("salesOrderLineId", "salesOrderId", "companyId") REFERENCES "SalesOrderLine"("id", "salesOrderId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_releasedByMemberId_companyId_fkey" FOREIGN KEY ("releasedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------- hand-written CHECKs

-- A positive exact quantity; lotKey is the StockBalance identity key of lotId.
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_quantity_check"
    CHECK ("quantity" > 0 AND "lotKey" = COALESCE("lotId", ''));

-- ACTIVE holds the slot (one ACTIVE row per line, location and lot); a released
-- row records who, when and why; CONSUMED (EP35) is neither active nor released.
ALTER TABLE "SalesAllocation" ADD CONSTRAINT "SalesAllocation_status_check"
    CHECK (
        (("status" = 'ACTIVE') = ("activeSlot" IS NOT NULL AND "activeSlot"))
        AND (("status" = 'RELEASED')
            = ("releasedAt" IS NOT NULL AND "releasedByMemberId" IS NOT NULL AND "releaseReason" IS NOT NULL))
    );

-- Reservation history is kept: a released row is never deleted.
CREATE FUNCTION "sales_allocation_keep"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'SalesAllocation rows are never deleted: release them instead';
END;
$$;

CREATE TRIGGER "SalesAllocation_keep"
    BEFORE DELETE ON "SalesAllocation"
    FOR EACH ROW EXECUTE FUNCTION "sales_allocation_keep"();
