# EP46 — Migration and Rollback

Migration: `backend/prisma/migrations/20261113090000_ep46_optional_bom_recipes/migration.sql` (additive).
**No persistent database was migrated.** All work ran on the disposable PostgreSQL 18 cluster in the session
scratchpad (`127.0.0.1:55443`).

## 1. What it does

| Step | Change                                                                                                                                                   | Data effect                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1    | enum `ManufacturingMode`; `Company.manufacturingMode` NOT NULL DEFAULT `BOM_REQUIRED`                                                                    | every company stays BOM-required (no automatic conversion) |
| 2    | enum `ProductionMaterialPlan`; `ProductionOrder.materialPlan` NOT NULL DEFAULT `BOM`; CHECK `ProductionOrder_manual_plan_check` (MANUAL ⇒ no BOM fields) | every order stays a BOM plan                               |
| 2b   | `ProductionOrder_check` (EP38 version) re-created with one change: past DRAFT an order needs a BOM **or** a MANUAL plan                                  | none                                                       |
| 3    | `ProductionOrderMaterial.bomQuantity` nullable (MANUAL lines have no recipe ratio)                                                                       | none                                                       |
| 4    | trigger `ProductionOrder_manual_plan_mode` — an order can become MANUAL only while its company is BOM_OPTIONAL                                           | none                                                       |
| 5    | override CHECK re-created with the new code `operations.recipes.view` (82 codes, catalog order)                                                          | none                                                       |

**Permission effect at deploy (documented, intentional):** the Executive and Operations Staff / Viewers lose recipe
detail (BOM lines, ratios, previews, unreleased BOM quantities); Owner and Operations Managers keep it. Nobody gains
anything. Companies that want a staff member to see recipes grant `operations.recipes.view` as an exception.

## 2. Applying it later (owner-approved; not executed)

1. Verified backup (`ops backup --verify`; UAT: `node uat/uat.mjs backup`).
2. `npx prisma migrate deploy` with the EP46 build (no preflight is needed — nothing can conflict).
3. Smoke: production order list / detail, BOM list, settings page.

## 3. Rollback (down) — restores the EP45 schema exactly

Run with the EP45 code. **Refused while any order uses a MANUAL plan** (EP45 cannot represent it — finish or cancel
those orders, or stay on EP46). Recipe exceptions (`operations.recipes.view`) are removed because EP45 has no such
permission; nothing else is deleted. `MANUFACTURING_MODE_CHANGED` audit rows stay (append-only).

```sql
-- EP46 rollback (down): restores the EP45 schema exactly. Run only with the EP45 code.
-- Refused while any production order uses a MANUAL material plan (EP45 cannot represent one):
-- finish or cancel such orders first, or keep EP46.
BEGIN;
DO $$
DECLARE n integer;
BEGIN
    SELECT count(*) INTO n FROM "ProductionOrder" WHERE "materialPlan" = 'MANUAL';
    IF n > 0 THEN
        RAISE EXCEPTION 'EP46 rollback refused: % production order(s) use a manual material plan.', n;
    END IF;
END;
$$;
-- Recipe exceptions mean nothing to EP45 (no such permission); they are removed.
DELETE FROM "MemberPermissionOverride" WHERE "permission" = 'operations.recipes.view';
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
DROP TRIGGER "ProductionOrder_manual_plan_mode" ON "ProductionOrder";
DROP FUNCTION "production_manual_plan_guard"();
ALTER TABLE "ProductionOrderMaterial" ALTER COLUMN "bomQuantity" SET NOT NULL;
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
ALTER TABLE "ProductionOrder" DROP CONSTRAINT "ProductionOrder_manual_plan_check";
ALTER TABLE "ProductionOrder" DROP COLUMN "materialPlan";
DROP TYPE "ProductionMaterialPlan";
ALTER TABLE "Company" DROP COLUMN "manufacturingMode";
DROP TYPE "ManufacturingMode";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261113090000_ep46_optional_bom_recipes';
COMMIT;
```

## 4. Evidence (disposable cluster)

| Scenario                                                                                            | Result                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fresh database, 28 migrations                                                                       | applied; `prisma migrate diff` database ↔ `schema.prisma`: **empty**                                                                                         |
| Copy of the EP45 QA database (demo seed + the EP45 real-stack activity: 71 tables, 823 rows) → EP46 | 3.0 s; **every table's content identical** apart from the two new defaulted columns; 1 company `BOM_REQUIRED`, 11 orders `BOM`; trigger present; drift empty |
| → rollback (§3) with the EP45 code                                                                  | drift against the EP45 `schema.prisma`: **empty**; all 71 tables identical to the original EP45 copy                                                         |
| → roll forward                                                                                      | applied; drift empty                                                                                                                                         |
| rollback while one MANUAL order exists                                                              | refused (`EP46 rollback refused: 1 production order(s) use a manual material plan.`), **no table changed**                                                   |
| fresh migrated + seeded database under the running EP46 backend                                     | EP45 real-stack regression 113 / 113, EP46 both-mode regression 77 / 77                                                                                      |

`pdabliss_core_dev` was only read (content hashes: **0 / 21 tables differ** across EP45 + EP46). No UAT database exists
on this workstation; none was created.
