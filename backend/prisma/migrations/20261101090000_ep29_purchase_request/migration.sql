-- EP29 — Purchase request foundation (additive, non-destructive).
--
--   * PurchaseRequest / PurchaseRequestLine: one company, one branch, one
--     originating department, one requester; every relation carries the
--     company id, so nothing can point into another company.
--   * DocumentSequence: per-company, per-period document counters
--     (PR-YYYYMM-NNNNNN), incremented atomically in the creating transaction.
--   * No price, cost, supplier, tax or discount column exists on a request.
-- No existing row changes. The only change to an existing object widens the
-- permission CHECK to the new operational codes (a superset).
-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseRequestLineType" AS ENUM ('ITEM', 'NON_ITEM');

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("companyId","key")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "department" "DepartmentCode" NOT NULL,
    "requesterMemberId" TEXT NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "requestDate" DATE NOT NULL,
    "needByDate" DATE,
    "purpose" TEXT,
    "lineCounter" INTEGER NOT NULL DEFAULT 0,
    "branchCodeSnapshot" TEXT,
    "branchNameSnapshot" TEXT,
    "requesterNameSnapshot" TEXT,
    "submittedAt" TIMESTAMP(3),
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

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "type" "PurchaseRequestLineType" NOT NULL,
    "itemId" TEXT,
    "itemCode" TEXT,
    "itemName" TEXT,
    "description" TEXT,
    "unitId" TEXT,
    "unitCode" TEXT,
    "unitName" TEXT,
    "quantity" DECIMAL(18,6) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseRequest_companyId_status_updatedAt_idx" ON "PurchaseRequest"("companyId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PurchaseRequest_companyId_branchId_status_idx" ON "PurchaseRequest"("companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_companyId_requesterMemberId_idx" ON "PurchaseRequest"("companyId", "requesterMemberId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_companyId_department_status_idx" ON "PurchaseRequest"("companyId", "department", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_companyId_number_key" ON "PurchaseRequest"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_id_companyId_key" ON "PurchaseRequest"("id", "companyId");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_itemId_idx" ON "PurchaseRequestLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequestLine_purchaseRequestId_lineNo_key" ON "PurchaseRequestLine"("purchaseRequestId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequestLine_id_companyId_key" ON "PurchaseRequestLine"("id", "companyId");

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_requesterMemberId_companyId_fkey" FOREIGN KEY ("requesterMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_approvedByMemberId_companyId_fkey" FOREIGN KEY ("approvedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_rejectedByMemberId_companyId_fkey" FOREIGN KEY ("rejectedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_purchaseRequestId_companyId_fkey" FOREIGN KEY ("purchaseRequestId", "companyId") REFERENCES "PurchaseRequest"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_unitId_companyId_fkey" FOREIGN KEY ("unitId", "companyId") REFERENCES "Unit"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- EP29 (hand-written) -------------------------------------------------------

ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_number_format_check"
    CHECK ("number" ~ '^PR-[0-9]{6}-[0-9]{6,}$');

ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_lineCounter_check"
    CHECK ("lineCounter" >= 0);

-- A decision is recorded with who and when; only SUBMITTED requests are
-- decided; a rejection always has its reason; a cancellation has its time.
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_status_check"
    CHECK (
        ("status" = 'DRAFT' OR "status" = 'CANCELLED' OR "submittedAt" IS NOT NULL)
        AND (("status" = 'APPROVED' OR ("status" = 'CANCELLED' AND "approvedAt" IS NOT NULL))
             = ("approvedAt" IS NOT NULL AND "approvedByMemberId" IS NOT NULL))
        AND (("status" = 'REJECTED')
             = ("rejectedAt" IS NOT NULL AND "rejectedByMemberId" IS NOT NULL
                AND "rejectionReason" IS NOT NULL))
        AND (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
    );

-- Quantities are positive exact decimals.
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_quantity_check"
    CHECK ("quantity" > 0);

ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_lineNo_check"
    CHECK ("lineNo" >= 1);

-- An ITEM line names a canonical item and unit (with snapshots); a NON_ITEM
-- line describes the need and names no item.
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_type_check"
    CHECK (
        ("type" = 'ITEM' AND "itemId" IS NOT NULL AND "unitId" IS NOT NULL
            AND "itemCode" IS NOT NULL AND "itemName" IS NOT NULL AND "unitCode" IS NOT NULL)
        OR ("type" = 'NON_ITEM' AND "itemId" IS NULL AND "itemCode" IS NULL
            AND "description" IS NOT NULL)
    );

ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_value_check"
    CHECK ("lastValue" >= 0 AND "key" ~ '^[A-Z]{2,5}:[0-9]{6}$');

-- EP27 permission CHECK, widened again (EP29 purchase-request codes; catalog order).
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
        'accounting.workspace.view',
        'accounting.payments.view',
        'accounting.payments.update_status',
        'accounting.documents.view',
        'accounting.customers.view',
        'accounting.suppliers.view',
        'accounting.purchase_requests.create',
        'accounting.purchase_requests.approve',
        'executive.workspace.view',
        'executive.overview.view'
    ));
