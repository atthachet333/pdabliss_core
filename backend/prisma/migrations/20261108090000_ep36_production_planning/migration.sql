-- EP36 production planning foundation (docs/PRODUCTION_BOM.md, docs/PRODUCTION_ORDER.md).
-- Additive only: four tables, four enums, CHECKs, guards and the widened permission CHECK.

-- CreateEnum
CREATE TYPE "ProductionBomStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'READY', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionOrderSource" AS ENUM ('MANUAL', 'SALES_DEMAND');

-- CreateEnum
CREATE TYPE "ProductionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "ProductionBom" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "outputQuantity" DECIMAL(18,6) NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitPrecision" INTEGER NOT NULL,
    "status" "ProductionBomStatus" NOT NULL DEFAULT 'DRAFT',
    "activeSlot" BOOLEAN,
    "note" TEXT,
    "lineCounter" INTEGER NOT NULL DEFAULT 0,
    "createdByMemberId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "activatedByMemberId" TEXT,
    "retiredAt" TIMESTAMP(3),
    "retiredByMemberId" TEXT,
    "retirementReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionBom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBomLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "bomItemId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitPrecision" INTEGER NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionBomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "ProductionOrderSource" NOT NULL,
    "salesOrderId" TEXT,
    "salesOrderLineId" TEXT,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitPrecision" INTEGER NOT NULL,
    "bomId" TEXT,
    "bomCode" TEXT,
    "bomRevision" INTEGER,
    "bomOutputQuantity" DECIMAL(18,6),
    "quantity" DECIMAL(18,6) NOT NULL,
    "plannedStartDate" DATE,
    "requiredDate" DATE,
    "priority" "ProductionPriority" NOT NULL DEFAULT 'NORMAL',
    "note" TEXT,
    "createdByMemberId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedByMemberId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByMemberId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releasedByMemberId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByMemberId" TEXT,
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByMemberId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrderMaterial" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitPrecision" INTEGER NOT NULL,
    "bomQuantity" DECIMAL(18,6) NOT NULL,
    "requiredQuantity" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionOrderMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionBom_companyId_status_updatedAt_idx" ON "ProductionBom"("companyId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBom_companyId_itemId_revision_key" ON "ProductionBom"("companyId", "itemId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBom_companyId_itemId_activeSlot_key" ON "ProductionBom"("companyId", "itemId", "activeSlot");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBom_id_companyId_key" ON "ProductionBom"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBom_id_itemId_companyId_key" ON "ProductionBom"("id", "itemId", "companyId");

-- CreateIndex
CREATE INDEX "ProductionBomLine_companyId_itemId_idx" ON "ProductionBomLine"("companyId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBomLine_bomId_lineNo_key" ON "ProductionBomLine"("bomId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBomLine_bomId_itemId_key" ON "ProductionBomLine"("bomId", "itemId");

-- CreateIndex
CREATE INDEX "ProductionOrder_companyId_branchId_status_updatedAt_idx" ON "ProductionOrder"("companyId", "branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProductionOrder_companyId_itemId_idx" ON "ProductionOrder"("companyId", "itemId");

-- CreateIndex
CREATE INDEX "ProductionOrder_salesOrderLineId_idx" ON "ProductionOrder"("salesOrderLineId");

-- CreateIndex
CREATE INDEX "ProductionOrder_bomId_idx" ON "ProductionOrder"("bomId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_companyId_number_key" ON "ProductionOrder"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_id_companyId_key" ON "ProductionOrder"("id", "companyId");

-- CreateIndex
CREATE INDEX "ProductionOrderMaterial_companyId_itemId_idx" ON "ProductionOrderMaterial"("companyId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrderMaterial_productionOrderId_lineNo_key" ON "ProductionOrderMaterial"("productionOrderId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrderMaterial_productionOrderId_itemId_key" ON "ProductionOrderMaterial"("productionOrderId", "itemId");

-- AddForeignKey
ALTER TABLE "ProductionBom" ADD CONSTRAINT "ProductionBom_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBom" ADD CONSTRAINT "ProductionBom_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBom" ADD CONSTRAINT "ProductionBom_unitId_companyId_fkey" FOREIGN KEY ("unitId", "companyId") REFERENCES "Unit"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBom" ADD CONSTRAINT "ProductionBom_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBom" ADD CONSTRAINT "ProductionBom_activatedByMemberId_companyId_fkey" FOREIGN KEY ("activatedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBom" ADD CONSTRAINT "ProductionBom_retiredByMemberId_companyId_fkey" FOREIGN KEY ("retiredByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomLine" ADD CONSTRAINT "ProductionBomLine_bomId_bomItemId_companyId_fkey" FOREIGN KEY ("bomId", "bomItemId", "companyId") REFERENCES "ProductionBom"("id", "itemId", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomLine" ADD CONSTRAINT "ProductionBomLine_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomLine" ADD CONSTRAINT "ProductionBomLine_unitId_companyId_fkey" FOREIGN KEY ("unitId", "companyId") REFERENCES "Unit"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_salesOrderId_branchId_companyId_fkey" FOREIGN KEY ("salesOrderId", "branchId", "companyId") REFERENCES "SalesOrder"("id", "branchId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_salesOrderLineId_salesOrderId_companyId_fkey" FOREIGN KEY ("salesOrderLineId", "salesOrderId", "companyId") REFERENCES "SalesOrderLine"("id", "salesOrderId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_unitId_companyId_fkey" FOREIGN KEY ("unitId", "companyId") REFERENCES "Unit"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_bomId_itemId_companyId_fkey" FOREIGN KEY ("bomId", "itemId", "companyId") REFERENCES "ProductionBom"("id", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_createdByMemberId_companyId_fkey" FOREIGN KEY ("createdByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_submittedByMemberId_companyId_fkey" FOREIGN KEY ("submittedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_approvedByMemberId_companyId_fkey" FOREIGN KEY ("approvedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_releasedByMemberId_companyId_fkey" FOREIGN KEY ("releasedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_rejectedByMemberId_companyId_fkey" FOREIGN KEY ("rejectedByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_cancelledByMemberId_companyId_fkey" FOREIGN KEY ("cancelledByMemberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderMaterial" ADD CONSTRAINT "ProductionOrderMaterial_productionOrderId_companyId_fkey" FOREIGN KEY ("productionOrderId", "companyId") REFERENCES "ProductionOrder"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderMaterial" ADD CONSTRAINT "ProductionOrderMaterial_itemId_companyId_fkey" FOREIGN KEY ("itemId", "companyId") REFERENCES "Item"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderMaterial" ADD CONSTRAINT "ProductionOrderMaterial_unitId_companyId_fkey" FOREIGN KEY ("unitId", "companyId") REFERENCES "Unit"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------- EP36 integrity
-- Production planning never touches stock: no StockMovement / StockBalance /
-- SalesAllocation column or trigger is added or changed by this migration.

ALTER TABLE "ProductionBom" ADD CONSTRAINT "ProductionBom_check" CHECK (
    "outputQuantity" > 0
    AND "revision" >= 1
    AND "unitPrecision" BETWEEN 0 AND 6
    AND "lineCounter" >= 0
    AND ("activeSlot" IS NULL OR "activeSlot")
    AND (("status" = 'ACTIVE') = ("activeSlot" IS NOT NULL))
    AND ("status" = 'DRAFT' OR "status" = 'RETIRED' OR ("activatedAt" IS NOT NULL AND "activatedByMemberId" IS NOT NULL))
    AND ("status" <> 'RETIRED' OR ("retiredAt" IS NOT NULL AND "retiredByMemberId" IS NOT NULL))
    AND ("status" <> 'DRAFT' OR ("activatedAt" IS NULL AND "retiredAt" IS NULL))
);

ALTER TABLE "ProductionBomLine" ADD CONSTRAINT "ProductionBomLine_check" CHECK (
    "quantity" > 0
    AND "lineNo" >= 1
    AND "unitPrecision" BETWEEN 0 AND 6
    AND "itemId" <> "bomItemId"
);

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
    AND ("status" NOT IN ('APPROVED', 'READY') OR ("approvedAt" IS NOT NULL AND "approvedByMemberId" IS NOT NULL))
    AND ("status" <> 'READY' OR ("releasedAt" IS NOT NULL AND "releasedByMemberId" IS NOT NULL))
    AND ("status" <> 'REJECTED' OR ("rejectedAt" IS NOT NULL AND "rejectedByMemberId" IS NOT NULL AND "rejectionReason" IS NOT NULL))
    AND ("status" <> 'CANCELLED' OR ("cancelledAt" IS NOT NULL AND "cancelledByMemberId" IS NOT NULL))
);

ALTER TABLE "ProductionOrderMaterial" ADD CONSTRAINT "ProductionOrderMaterial_check" CHECK (
    "lineNo" >= 1
    AND "bomQuantity" > 0
    AND "requiredQuantity" > 0
    AND "unitPrecision" BETWEEN 0 AND 6
);

-- History is never deleted: BOM revisions and production orders are retired / cancelled.
CREATE FUNCTION "production_keep"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% rows are never deleted: retire or cancel instead', TG_TABLE_NAME;
END;
$$;
CREATE TRIGGER "ProductionBom_keep" BEFORE DELETE ON "ProductionBom"
    FOR EACH ROW EXECUTE FUNCTION "production_keep"();
CREATE TRIGGER "ProductionOrder_keep" BEFORE DELETE ON "ProductionOrder"
    FOR EACH ROW EXECUTE FUNCTION "production_keep"();

-- A BOM revision is editable only as a DRAFT; ACTIVE is immutable and only retires;
-- RETIRED is final. Status never goes back.
CREATE FUNCTION "production_bom_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."itemId" <> OLD."itemId" OR NEW."revision" <> OLD."revision" OR NEW."code" <> OLD."code"
        OR NEW."companyId" <> OLD."companyId" THEN
        RAISE EXCEPTION 'A BOM keeps its item and revision';
    END IF;
    IF NOT (
        (OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'ACTIVE', 'RETIRED'))
        OR (OLD."status" = 'ACTIVE' AND NEW."status" IN ('ACTIVE', 'RETIRED'))
        OR (OLD."status" = 'RETIRED' AND NEW."status" = 'RETIRED')
    ) THEN
        RAISE EXCEPTION 'A BOM revision cannot move from % to %', OLD."status", NEW."status";
    END IF;
    IF OLD."status" <> 'DRAFT' AND (
        NEW."outputQuantity" <> OLD."outputQuantity" OR NEW."unitId" <> OLD."unitId"
        OR NEW."unitCode" <> OLD."unitCode" OR NEW."unitPrecision" <> OLD."unitPrecision"
        OR NEW."itemCode" <> OLD."itemCode" OR NEW."itemName" <> OLD."itemName"
        OR NEW."lineCounter" <> OLD."lineCounter" OR NEW."note" IS DISTINCT FROM OLD."note"
        OR NEW."activatedAt" IS DISTINCT FROM OLD."activatedAt"
    ) THEN
        RAISE EXCEPTION 'An active or retired BOM revision is immutable: create a new revision';
    END IF;
    IF OLD."status" = 'RETIRED' AND (NEW."retiredAt" IS DISTINCT FROM OLD."retiredAt"
        OR NEW."retirementReason" IS DISTINCT FROM OLD."retirementReason") THEN
        RAISE EXCEPTION 'A retired BOM revision is final';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductionBom_guard" BEFORE UPDATE ON "ProductionBom"
    FOR EACH ROW EXECUTE FUNCTION "production_bom_guard"();

-- BOM lines change only while their BOM is a DRAFT.
CREATE FUNCTION "production_bom_line_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    st "ProductionBomStatus";
BEGIN
    SELECT "status" INTO st FROM "ProductionBom"
        WHERE "id" = COALESCE(NEW."bomId", OLD."bomId");
    IF st IS DISTINCT FROM 'DRAFT' THEN
        RAISE EXCEPTION 'The lines of an active or retired BOM revision are immutable';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductionBomLine_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ProductionBomLine"
    FOR EACH ROW EXECUTE FUNCTION "production_bom_line_guard"();

-- The order lifecycle, enforced by the database too: only the permitted transitions,
-- identity fixed for life, plan (item, BOM, quantity, snapshots) frozen from approval.
CREATE FUNCTION "production_order_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
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
        OR (OLD."status" = 'READY' AND NEW."status" IN ('READY', 'CANCELLED'))
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
CREATE TRIGGER "ProductionOrder_guard" BEFORE UPDATE ON "ProductionOrder"
    FOR EACH ROW EXECUTE FUNCTION "production_order_guard"();

-- Requirements are recomputed while DRAFT / SUBMITTED and frozen from approval on.
CREATE FUNCTION "production_material_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    st "ProductionOrderStatus";
BEGIN
    SELECT "status" INTO st FROM "ProductionOrder"
        WHERE "id" = COALESCE(NEW."productionOrderId", OLD."productionOrderId");
    IF st IS NULL OR st NOT IN ('DRAFT', 'SUBMITTED') THEN
        RAISE EXCEPTION 'Material requirements are frozen once a production order is approved';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductionOrderMaterial_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ProductionOrderMaterial"
    FOR EACH ROW EXECUTE FUNCTION "production_material_guard"();

-- EP27 permission CHECK, widened again (EP36 production codes; catalog order).
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
