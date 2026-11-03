-- EP31 — goods receipts, lots, the stock movement ledger and stock balances
-- (additive, non-destructive). No existing row changes. Changes to existing
-- objects: PurchaseOrder.receivedAt (nullable), one unique index on
-- PurchaseOrderLine (target of the receipt lines' foreign key), the order
-- status CHECK (RECEIVED) and the permission CHECK widened (a superset).

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptRejectReason" AS ENUM ('DAMAGED', 'WRONG_ITEM', 'EXPIRED', 'QUALITY', 'QUANTITY_DISCREPANCY', 'OTHER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_RECEIPT', 'PURCHASE_RECEIPT_REVERSAL');


-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "receivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "purchaseOrderId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierCode" TEXT,
    "supplierName" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "defaultLocationId" TEXT,
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

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitName" TEXT,
    "acceptedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "rejectedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "rejectReason" "ReceiptRejectReason",
    "rejectNote" TEXT,
    "replacementRequired" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptAllocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "goodsReceiptLineId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lotNumber" TEXT,
    "expiryDate" DATE,
    "manufacturedDate" DATE,
    "lotId" TEXT,
    "quantity" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "expiryDate" DATE,
    "manufacturedDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "type" "StockMovementType" NOT NULL,
    "quantityDelta" DECIMAL(18,6) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "goodsReceiptId" TEXT,
    "goodsReceiptLineId" TEXT,
    "goodsReceiptAllocationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actorMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "lotKey" TEXT NOT NULL,
    "quantityOnHand" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "firstReceivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_companyId_branchId_status_updatedAt_idx" ON "GoodsReceipt"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_companyId_number_key" ON "GoodsReceipt"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_id_companyId_key" ON "GoodsReceipt"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_id_branchId_companyId_key" ON "GoodsReceipt"("id", "branchId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_id_purchaseOrderId_branchId_companyId_key" ON "GoodsReceipt"("id", "purchaseOrderId", "branchId", "companyId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_purchaseOrderLineId_idx" ON "GoodsReceiptLine"("purchaseOrderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptLine_goodsReceiptId_purchaseOrderLineId_key" ON "GoodsReceiptLine"("goodsReceiptId", "purchaseOrderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptLine_goodsReceiptId_lineNo_key" ON "GoodsReceiptLine"("goodsReceiptId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptLine_id_itemId_branchId_companyId_key" ON "GoodsReceiptLine"("id", "itemId", "branchId", "companyId");

-- CreateIndex
CREATE INDEX "GoodsReceiptAllocation_goodsReceiptLineId_idx" ON "GoodsReceiptAllocation"("goodsReceiptLineId");

-- CreateIndex
CREATE INDEX "GoodsReceiptAllocation_lotId_idx" ON "GoodsReceiptAllocation"("lotId");

-- CreateIndex
CREATE INDEX "InventoryLot_companyId_expiryDate_idx" ON "InventoryLot"("companyId", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_companyId_itemId_lotNumber_key" ON "InventoryLot"("companyId", "itemId", "lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_id_itemId_companyId_key" ON "InventoryLot"("id", "itemId", "companyId");

-- CreateIndex
CREATE INDEX "StockMovement_companyId_branchId_itemId_occurredAt_idx" ON "StockMovement"("companyId", "branchId", "itemId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_locationId_lotId_occurredAt_idx" ON "StockMovement"("locationId", "lotId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_goodsReceiptId_idx" ON "StockMovement"("goodsReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_goodsReceiptAllocationId_type_key" ON "StockMovement"("goodsReceiptAllocationId", "type");

-- CreateIndex
CREATE INDEX "StockBalance_companyId_branchId_itemId_idx" ON "StockBalance"("companyId", "branchId", "itemId");

-- CreateIndex
CREATE INDEX "StockBalance_lotId_idx" ON "StockBalance"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_locationId_itemId_lotKey_key" ON "StockBalance"("locationId", "itemId", "lotKey");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_id_purchaseOrderId_companyId_key" ON "PurchaseOrderLine"("id", "purchaseOrderId", "companyId");

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_branchId_companyId_fkey" FOREIGN KEY ("purchaseOrderId", "branchId", "companyId") REFERENCES "PurchaseOrder"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_supplierId_companyId_fkey" FOREIGN KEY ("supplierId", "companyId") REFERENCES "Supplier"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_defaultLocationId_branchId_fkey" FOREIGN KEY ("defaultLocationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_postedByMemberId_companyId_fkey" FOREIGN KEY ("postedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_goodsReceiptId_purchaseOrderId_branchId_c_fkey" FOREIGN KEY ("goodsReceiptId", "purchaseOrderId", "branchId", "companyId") REFERENCES "GoodsReceipt"("id", "purchaseOrderId", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_purchaseOrderLineId_purchaseOrderId_compa_fkey" FOREIGN KEY ("purchaseOrderLineId", "purchaseOrderId", "companyId") REFERENCES "PurchaseOrderLine"("id", "purchaseOrderId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_unitId_companyId_fkey" FOREIGN KEY ("unitId", "companyId") REFERENCES "Unit"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptAllocation" ADD CONSTRAINT "GoodsReceiptAllocation_goodsReceiptLineId_itemId_branchId__fkey" FOREIGN KEY ("goodsReceiptLineId", "itemId", "branchId", "companyId") REFERENCES "GoodsReceiptLine"("id", "itemId", "branchId", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptAllocation" ADD CONSTRAINT "GoodsReceiptAllocation_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptAllocation" ADD CONSTRAINT "GoodsReceiptAllocation_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_goodsReceiptId_branchId_companyId_fkey" FOREIGN KEY ("goodsReceiptId", "branchId", "companyId") REFERENCES "GoodsReceipt"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_goodsReceiptAllocationId_fkey" FOREIGN KEY ("goodsReceiptAllocationId") REFERENCES "GoodsReceiptAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorMemberId_companyId_fkey" FOREIGN KEY ("actorMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_locationId_branchId_fkey" FOREIGN KEY ("locationId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_lotId_itemId_companyId_fkey" FOREIGN KEY ("lotId", "itemId", "companyId") REFERENCES "InventoryLot"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;



-- EP31 (hand-written) -------------------------------------------------------

-- The order status gains RECEIVED: like PENDING_RECEIVE it needs a settled
-- (or no) deposit, and it carries the moment of full receipt.
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_status_check";
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_status_check"
    CHECK (
        (("status" = 'DRAFT' OR ("status" = 'CANCELLED' AND "issuedAt" IS NULL))
            = ("issuedAt" IS NULL AND "issuedByMemberId" IS NULL))
        AND ("issuedAt" IS NULL OR ("supplierId" IS NOT NULL AND "supplierName" IS NOT NULL
            AND ("depositType" = 'NONE' OR ("depositAmount" > 0 AND "depositAmount" <= "grandTotal"))))
        AND ("status" <> 'WAITING_DEPOSIT' OR "depositStatus" = 'PENDING')
        AND ("status" NOT IN ('PENDING_RECEIVE', 'RECEIVED')
            OR ("depositStatus" IN ('NOT_REQUIRED', 'CONFIRMED', 'WAIVED') AND "pendingReceiveAt" IS NOT NULL))
        AND (("status" = 'RECEIVED') = ("receivedAt" IS NOT NULL))
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
    );

ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_number_format_check"
    CHECK ("number" ~ '^GR-[0-9]{6}-[0-9]{6,}$');

ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_lineCounter_check"
    CHECK ("lineCounter" >= 0);

-- A posted receipt has who / when; a cancelled one has who / when, and a
-- reason when it had been posted (its stock was reversed).
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_status_check"
    CHECK (
        (("status" = 'DRAFT') = ("postedAt" IS NULL AND "cancelledAt" IS NULL))
        AND ("postedAt" IS NULL) = ("postedByMemberId" IS NULL)
        AND ("status" <> 'POSTED' OR "postedAt" IS NOT NULL)
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
        AND ("status" <> 'CANCELLED' OR "postedAt" IS NULL OR "cancellationReason" IS NOT NULL)
    );

-- Exact non-negative quantities; a rejected quantity always has its reason.
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_quantities_check"
    CHECK (
        "lineNo" >= 1
        AND "acceptedQuantity" >= 0 AND "rejectedQuantity" >= 0
        AND (("rejectedQuantity" > 0) = ("rejectReason" IS NOT NULL))
        AND ("rejectedQuantity" > 0 OR "rejectNote" IS NULL)
    );

-- A positive quantity; an expiry or manufacture date belongs to a lot.
ALTER TABLE "GoodsReceiptAllocation" ADD CONSTRAINT "GoodsReceiptAllocation_check"
    CHECK (
        "quantity" > 0
        AND ("lotNumber" IS NULL OR length(btrim("lotNumber")) > 0)
        AND ("lotNumber" IS NOT NULL OR ("expiryDate" IS NULL AND "manufacturedDate" IS NULL AND "lotId" IS NULL))
    );

ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_check"
    CHECK (
        length(btrim("lotNumber")) > 0
        AND ("expiryDate" IS NULL OR "manufacturedDate" IS NULL OR "manufacturedDate" <= "expiryDate")
    );

-- Receipts add, reversals take away; never a zero movement.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_check"
    CHECK (
        "quantityDelta" <> 0
        AND ("type" <> 'PURCHASE_RECEIPT' OR "quantityDelta" > 0)
        AND ("type" <> 'PURCHASE_RECEIPT_REVERSAL' OR "quantityDelta" < 0)
        AND ("sourceType" <> 'GOODS_RECEIPT'
            OR ("goodsReceiptId" IS NOT NULL AND "goodsReceiptLineId" IS NOT NULL AND "goodsReceiptAllocationId" IS NOT NULL))
    );

-- The ledger is append-only: no movement is ever changed or removed.
CREATE FUNCTION "stock_movement_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'StockMovement rows are immutable (%): write a reversal movement instead', TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER "StockMovement_immutable"
    BEFORE UPDATE OR DELETE ON "StockMovement"
    FOR EACH ROW EXECUTE FUNCTION "stock_movement_immutable"();

-- Never negative; lotKey mirrors lotId so (location, item, no lot) is unique too.
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_check"
    CHECK ("quantityOnHand" >= 0 AND "lotKey" = COALESCE("lotId", ''));

-- EP27 permission CHECK, widened again (EP31 warehouse.receiving.cancel; catalog order).
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
