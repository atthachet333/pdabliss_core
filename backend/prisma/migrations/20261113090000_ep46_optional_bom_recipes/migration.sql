-- EP46 optional BOM and confidential recipes (docs/EP46_MANUFACTURING_POLICY.md,
-- docs/EP46_MIGRATION_ROLLBACK.md). Additive only: no row is changed, no company changes mode.

-- 1. Company manufacturing mode. Every existing company keeps BOM_REQUIRED (the column default);
--    only the Company Owner can change it, through the application.
CREATE TYPE "ManufacturingMode" AS ENUM ('BOM_REQUIRED', 'BOM_OPTIONAL');
ALTER TABLE "Company" ADD COLUMN "manufacturingMode" "ManufacturingMode" NOT NULL DEFAULT 'BOM_REQUIRED';

-- 2. Production order material plan. Every existing order is a BOM plan (the column default).
CREATE TYPE "ProductionMaterialPlan" AS ENUM ('BOM', 'MANUAL');
ALTER TABLE "ProductionOrder" ADD COLUMN "materialPlan" "ProductionMaterialPlan" NOT NULL DEFAULT 'BOM';
-- A MANUAL plan never carries a BOM (no imaginary recipe).
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_manual_plan_check"
    CHECK ("materialPlan" = 'BOM' OR ("bomId" IS NULL AND "bomOutputQuantity" IS NULL));

-- 2b. EP36 required a BOM once an order left DRAFT; a MANUAL plan is the one other source of
--     requirements (its explicit materials are checked by the application at submit / approve).
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
    AND ("status" IN ('DRAFT', 'CANCELLED') OR "bomId" IS NOT NULL OR "materialPlan" = 'MANUAL')
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

-- 3. A MANUAL material line has no BOM quantity (no recipe ratio exists for it).
ALTER TABLE "ProductionOrderMaterial" ALTER COLUMN "bomQuantity" DROP NOT NULL;

-- 4. Defence in depth: an order can be (re)planned MANUAL only while its company is BOM_OPTIONAL.
--    Orders already MANUAL keep working if the owner later returns to BOM_REQUIRED.
CREATE FUNCTION "production_manual_plan_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    mode "ManufacturingMode";
BEGIN
    IF NEW."materialPlan" = 'MANUAL'
       AND (TG_OP = 'INSERT' OR OLD."materialPlan" IS DISTINCT FROM NEW."materialPlan") THEN
        SELECT "manufacturingMode" INTO mode FROM "Company" WHERE "id" = NEW."companyId";
        IF mode IS DISTINCT FROM 'BOM_OPTIONAL' THEN
            RAISE EXCEPTION 'EP46: a manual material plan needs the BOM_OPTIONAL manufacturing mode'
                USING ERRCODE = 'check_violation', CONSTRAINT = 'ProductionOrder_manual_plan_mode_check';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductionOrder_manual_plan_mode"
    BEFORE INSERT OR UPDATE OF "materialPlan" ON "ProductionOrder"
    FOR EACH ROW EXECUTE FUNCTION "production_manual_plan_guard"();

-- 5. The new confidential permission may take a per-member exception (EP27 rules).
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
        'operations.recipes.view',
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
