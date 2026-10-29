-- EP30 — Purchase order, deposit and pending-receive foundation (additive,
-- non-destructive).
--
--   * PurchaseOrder / PurchaseOrderLine: one company, one branch, one supplier,
--     one currency. Every line orders from one APPROVED request line; its
--     foreign keys carry (branch, company), so an order can only order from
--     requests of its own branch and company.
--   * Money is exact decimal (numeric); totals are the server's and the CHECKs
--     below hold the arithmetic. The deposit is part of the order record.
--   * Ordered / remaining quantities are derived (never stored on the request).
-- No existing row changes. Changes to existing objects: two new unique indexes
-- on the request tables (targets of the order lines' foreign keys) and the
-- permission CHECK widened to the new operational codes (a superset).

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ISSUED', 'WAITING_DEPOSIT', 'PENDING_RECEIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderDepositType" AS ENUM ('NONE', 'AMOUNT', 'PERCENT');

-- CreateEnum
CREATE TYPE "PurchaseOrderDepositStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'CONFIRMED', 'WAIVED');

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT,
    "currency" CHAR(3) NOT NULL DEFAULT 'THB',
    "orderDate" DATE NOT NULL,
    "expectedDate" DATE,
    "paymentTerms" TEXT,
    "note" TEXT,
    "lineCounter" INTEGER NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depositType" "PurchaseOrderDepositType" NOT NULL DEFAULT 'NONE',
    "depositValue" DECIMAL(18,4),
    "depositAmount" DECIMAL(18,2),
    "depositDueDate" DATE,
    "depositNote" TEXT,
    "depositStatus" "PurchaseOrderDepositStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "depositConfirmedAt" TIMESTAMP(3),
    "depositConfirmedByMemberId" TEXT,
    "depositReference" TEXT,
    "depositWaivedAt" TIMESTAMP(3),
    "depositWaivedByMemberId" TEXT,
    "depositWaiveReason" TEXT,
    "supplierCode" TEXT,
    "supplierName" TEXT,
    "supplierTaxId" TEXT,
    "supplierTaxBranch" TEXT,
    "supplierAddress" TEXT,
    "supplierContactName" TEXT,
    "supplierPhone" TEXT,
    "supplierEmail" TEXT,
    "branchCodeSnapshot" TEXT,
    "branchNameSnapshot" TEXT,
    "createdByMemberId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "issuedByMemberId" TEXT,
    "pendingReceiveAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "purchaseRequestLineId" TEXT NOT NULL,
    "prNumber" TEXT NOT NULL,
    "prLineNo" INTEGER NOT NULL,
    "type" "PurchaseRequestLineType" NOT NULL,
    "itemId" TEXT,
    "itemCode" TEXT,
    "itemName" TEXT,
    "description" TEXT,
    "unitId" TEXT,
    "unitCode" TEXT,
    "unitName" TEXT,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_status_updatedAt_idx" ON "PurchaseOrder"("companyId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_branchId_status_idx" ON "PurchaseOrder"("companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_supplierId_idx" ON "PurchaseOrder"("companyId", "supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_depositStatus_idx" ON "PurchaseOrder"("companyId", "depositStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_companyId_number_key" ON "PurchaseOrder"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_id_companyId_key" ON "PurchaseOrder"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_id_branchId_companyId_key" ON "PurchaseOrder"("id", "branchId", "companyId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseRequestLineId_idx" ON "PurchaseOrderLine"("purchaseRequestLineId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseRequestId_idx" ON "PurchaseOrderLine"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_itemId_idx" ON "PurchaseOrderLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_purchaseOrderId_lineNo_key" ON "PurchaseOrderLine"("purchaseOrderId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_purchaseOrderId_purchaseRequestLineId_key" ON "PurchaseOrderLine"("purchaseOrderId", "purchaseRequestLineId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_id_companyId_key" ON "PurchaseOrderLine"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_id_branchId_companyId_key" ON "PurchaseRequest"("id", "branchId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequestLine_id_purchaseRequestId_companyId_key" ON "PurchaseRequestLine"("id", "purchaseRequestId", "companyId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_companyId_fkey" FOREIGN KEY ("supplierId", "companyId") REFERENCES "Supplier"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_depositConfirmedByMemberId_companyId_fkey" FOREIGN KEY ("depositConfirmedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_depositWaivedByMemberId_companyId_fkey" FOREIGN KEY ("depositWaivedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_issuedByMemberId_companyId_fkey" FOREIGN KEY ("issuedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_branchId_companyId_fkey" FOREIGN KEY ("purchaseOrderId", "branchId", "companyId") REFERENCES "PurchaseOrder"("id", "branchId", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseRequestId_branchId_companyId_fkey" FOREIGN KEY ("purchaseRequestId", "branchId", "companyId") REFERENCES "PurchaseRequest"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseRequestLineId_purchaseRequestId__fkey" FOREIGN KEY ("purchaseRequestLineId", "purchaseRequestId", "companyId") REFERENCES "PurchaseRequestLine"("id", "purchaseRequestId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_unitId_companyId_fkey" FOREIGN KEY ("unitId", "companyId") REFERENCES "Unit"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- EP30 (hand-written) -------------------------------------------------------

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_number_format_check"
    CHECK ("number" ~ '^PO-[0-9]{6}-[0-9]{6,}$');

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_currency_check"
    CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_lineCounter_check"
    CHECK ("lineCounter" >= 0);

-- Totals are the server's arithmetic: never negative, and the grand total is
-- always subtotal − discounts + tax.
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_totals_check"
    CHECK (
        "subtotal" >= 0 AND "discountTotal" >= 0 AND "taxTotal" >= 0
        AND "discountTotal" <= "subtotal"
        AND "grandTotal" = "subtotal" - "discountTotal" + "taxTotal"
    );

-- A deposit is either not required (no amount) or has a positive value and
-- an explicit amount (0 only while a DRAFT has no prices yet); a percentage
-- is (0, 100]. Its status follows: CONFIRMED and WAIVED carry who and when (a
-- waiver its reason too).
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_deposit_check"
    CHECK (
        (("depositType" = 'NONE')
            = ("depositValue" IS NULL AND "depositAmount" IS NULL AND "depositStatus" = 'NOT_REQUIRED'))
        AND ("depositType" = 'NONE'
            OR ("depositValue" > 0 AND "depositAmount" IS NOT NULL AND "depositAmount" >= 0))
        AND ("depositType" <> 'PERCENT' OR "depositValue" <= 100)
        AND (("depositStatus" = 'CONFIRMED')
            = ("depositConfirmedAt" IS NOT NULL AND "depositConfirmedByMemberId" IS NOT NULL))
        AND (("depositStatus" = 'WAIVED')
            = ("depositWaivedAt" IS NOT NULL AND "depositWaivedByMemberId" IS NOT NULL
               AND "depositWaiveReason" IS NOT NULL))
    );

-- The order status and its record: an issued order has who / when, a supplier
-- and a positive deposit no larger than its total (if any); waiting for a deposit means one is
-- pending; pending receive means none is (or it was settled); a cancellation
-- has who / when.
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_status_check"
    CHECK (
        (("status" = 'DRAFT' OR ("status" = 'CANCELLED' AND "issuedAt" IS NULL))
            = ("issuedAt" IS NULL AND "issuedByMemberId" IS NULL))
        AND ("issuedAt" IS NULL OR ("supplierId" IS NOT NULL AND "supplierName" IS NOT NULL
            AND ("depositType" = 'NONE' OR ("depositAmount" > 0 AND "depositAmount" <= "grandTotal"))))
        AND ("status" <> 'WAITING_DEPOSIT' OR "depositStatus" = 'PENDING')
        AND ("status" <> 'PENDING_RECEIVE'
            OR ("depositStatus" IN ('NOT_REQUIRED', 'CONFIRMED', 'WAIVED') AND "pendingReceiveAt" IS NOT NULL))
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
    );

ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_lineNo_check"
    CHECK ("lineNo" >= 1 AND "prLineNo" >= 1);

-- Exact positive quantity; non-negative price and discount; a tax rate in
-- [0, 100]; the line arithmetic as stored (rounding is the service's).
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_amounts_check"
    CHECK (
        "quantity" > 0 AND "unitPrice" >= 0 AND "discountAmount" >= 0
        AND "taxRate" >= 0 AND "taxRate" <= 100
        AND "lineSubtotal" >= 0 AND "lineTax" >= 0
        AND "discountAmount" <= "lineSubtotal"
        AND "lineTotal" = "lineSubtotal" - "discountAmount" + "lineTax"
    );

-- Same shape as the request line it orders.
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_type_check"
    CHECK (
        ("type" = 'ITEM' AND "itemId" IS NOT NULL AND "unitId" IS NOT NULL
            AND "itemCode" IS NOT NULL AND "itemName" IS NOT NULL AND "unitCode" IS NOT NULL)
        OR ("type" = 'NON_ITEM' AND "itemId" IS NULL AND "itemCode" IS NULL
            AND "description" IS NOT NULL)
    );

-- EP27 permission CHECK, widened again (EP30 order / deposit codes; catalog order).
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
