-- EP33 Sales Order foundation (docs/SALES_ORDER.md). Additive only: two new
-- tables and an enum. No existing table, row or permission code changes (EP33
-- reuses the EP27 sales.orders.* codes). A sales order never writes stock.
--
-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerTaxId" TEXT,
    "customerTaxBranch" TEXT,
    "orderDate" DATE NOT NULL,
    "requestedDate" DATE,
    "customerReference" TEXT,
    "note" TEXT,
    "currency" CHAR(3) NOT NULL DEFAULT 'THB',
    "lineCounter" INTEGER NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdByMemberId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedByMemberId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByMemberId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "inventoryTracked" BOOLEAN NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "unitPrecision" INTEGER NOT NULL,
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

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_branchId_status_updatedAt_idx" ON "SalesOrder"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_customerId_idx" ON "SalesOrder"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_orderDate_idx" ON "SalesOrder"("companyId", "orderDate");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_requestedDate_idx" ON "SalesOrder"("companyId", "requestedDate");

-- CreateIndex
CREATE INDEX "SalesOrder_createdByMemberId_idx" ON "SalesOrder"("createdByMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_companyId_number_key" ON "SalesOrder"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_id_companyId_key" ON "SalesOrder"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_id_branchId_companyId_key" ON "SalesOrder"("id", "branchId", "companyId");

-- CreateIndex
CREATE INDEX "SalesOrderLine_companyId_itemId_idx" ON "SalesOrderLine"("companyId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrderLine_salesOrderId_lineNo_key" ON "SalesOrderLine"("salesOrderId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrderLine_id_salesOrderId_companyId_key" ON "SalesOrderLine"("id", "salesOrderId", "companyId");

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_submittedByMemberId_companyId_fkey" FOREIGN KEY ("submittedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_confirmedByMemberId_companyId_fkey" FOREIGN KEY ("confirmedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_branchId_companyId_fkey" FOREIGN KEY ("salesOrderId", "branchId", "companyId") REFERENCES "SalesOrder"("id", "branchId", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_unitId_companyId_fkey" FOREIGN KEY ("unitId", "companyId") REFERENCES "Unit"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------- hand-written CHECKs

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_number_format_check"
    CHECK ("number" ~ '^SO-[0-9]{6}-[0-9]{6,}$');

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_currency_check"
    CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_lineCounter_check"
    CHECK ("lineCounter" >= 0);

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_dates_check"
    CHECK ("requestedDate" IS NULL OR "requestedDate" >= "orderDate");

-- Totals are the server's arithmetic: never negative; grand = subtotal − discounts + tax.
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_totals_check"
    CHECK (
        "subtotal" >= 0 AND "discountTotal" >= 0 AND "taxTotal" >= 0
        AND "discountTotal" <= "subtotal"
        AND "grandTotal" = "subtotal" - "discountTotal" + "taxTotal"
    );

-- Each step leaves its record; a cancellation always has a reason once the
-- order left DRAFT (a draft may be cancelled without one).
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_status_check"
    CHECK (
        (("status" = 'DRAFT' OR ("status" = 'CANCELLED' AND "submittedAt" IS NULL))
            = ("submittedAt" IS NULL AND "submittedByMemberId" IS NULL))
        AND (("status" = 'CONFIRMED' OR ("status" = 'CANCELLED' AND "confirmedAt" IS NOT NULL))
            = ("confirmedAt" IS NOT NULL AND "confirmedByMemberId" IS NOT NULL))
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
        AND ("status" <> 'CANCELLED' OR "submittedAt" IS NULL OR "cancellationReason" IS NOT NULL)
    );

ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_lineNo_check"
    CHECK ("lineNo" >= 1 AND "unitPrecision" BETWEEN 0 AND 6);

-- Exact positive quantity within the unit's decimals; non-negative price and
-- discount; a tax rate in [0, 100]; the line arithmetic as stored.
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_amounts_check"
    CHECK (
        "quantity" > 0 AND "quantity" = round("quantity", "unitPrecision")
        AND "unitPrice" >= 0 AND "discountAmount" >= 0
        AND "taxRate" >= 0 AND "taxRate" <= 100
        AND "lineSubtotal" >= 0 AND "lineTax" >= 0
        AND "discountAmount" <= "lineSubtotal"
        AND "lineTotal" = "lineSubtotal" - "discountAmount" + "lineTax"
    );
