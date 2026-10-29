-- EP28 — Operational master data foundation (additive, non-destructive).
--
--   * One canonical, company-scoped record per customer, supplier, item, unit
--     and item category; warehouse locations belong to one branch. Every
--     relation carries the company id (or the branch id) in its foreign key,
--     so nothing can reference another company's record.
--   * Codes are unique per company (per branch for locations); generated codes
--     come from MasterCodeSequence, incremented atomically in the creating
--     transaction.
--   * Nothing here holds a price, cost, margin, balance or payment term.
-- No existing row changes. The only change to an existing object widens the
-- EP27 permission CHECK to the new operational codes (a superset: every
-- stored exception stays valid).
-- CreateEnum
CREATE TYPE "MasterStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CustomerKind" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('FINISHED_GOOD', 'RAW_MATERIAL', 'PACKAGING', 'CONSUMABLE', 'NON_STOCK');

-- CreateEnum
CREATE TYPE "TrackingRequirement" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');

-- CreateTable
CREATE TABLE "MasterCodeSequence" (
    "companyId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterCodeSequence_pkey" PRIMARY KEY ("companyId","prefix")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "CustomerKind" NOT NULL DEFAULT 'BUSINESS',
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "taxBranch" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "lineId" TEXT,
    "billingAddress" TEXT,
    "shippingAddress" TEXT,
    "notes" TEXT,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "taxBranch" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "precision" INTEGER NOT NULL DEFAULT 0,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "baseUnitId" TEXT NOT NULL,
    "categoryId" TEXT,
    "inventoryTracked" BOOLEAN NOT NULL DEFAULT true,
    "lotTracking" "TrackingRequirement" NOT NULL DEFAULT 'NONE',
    "expiryTracking" "TrackingRequirement" NOT NULL DEFAULT 'NONE',
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "defaultSlot" BOOLEAN,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_companyId_status_idx" ON "Customer"("companyId", "status");

-- CreateIndex
CREATE INDEX "Customer_companyId_name_idx" ON "Customer"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_code_key" ON "Customer"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_id_companyId_key" ON "Customer"("id", "companyId");

-- CreateIndex
CREATE INDEX "Supplier_companyId_status_idx" ON "Supplier"("companyId", "status");

-- CreateIndex
CREATE INDEX "Supplier_companyId_name_idx" ON "Supplier"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_companyId_code_key" ON "Supplier"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_id_companyId_key" ON "Supplier"("id", "companyId");

-- CreateIndex
CREATE INDEX "Unit_companyId_status_idx" ON "Unit"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_companyId_code_key" ON "Unit"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_id_companyId_key" ON "Unit"("id", "companyId");

-- CreateIndex
CREATE INDEX "ItemCategory_companyId_status_idx" ON "ItemCategory"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_companyId_code_key" ON "ItemCategory"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_id_companyId_key" ON "ItemCategory"("id", "companyId");

-- CreateIndex
CREATE INDEX "Item_companyId_status_idx" ON "Item"("companyId", "status");

-- CreateIndex
CREATE INDEX "Item_companyId_type_idx" ON "Item"("companyId", "type");

-- CreateIndex
CREATE INDEX "Item_companyId_name_idx" ON "Item"("companyId", "name");

-- CreateIndex
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");

-- CreateIndex
CREATE INDEX "Item_baseUnitId_idx" ON "Item"("baseUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_companyId_code_key" ON "Item"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_companyId_sku_key" ON "Item"("companyId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Item_companyId_barcode_key" ON "Item"("companyId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Item_id_companyId_key" ON "Item"("id", "companyId");

-- CreateIndex
CREATE INDEX "WarehouseLocation_companyId_status_idx" ON "WarehouseLocation"("companyId", "status");

-- CreateIndex
CREATE INDEX "WarehouseLocation_parentId_idx" ON "WarehouseLocation"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_branchId_code_key" ON "WarehouseLocation"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_branchId_defaultSlot_key" ON "WarehouseLocation"("branchId", "defaultSlot");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_id_branchId_key" ON "WarehouseLocation"("id", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_id_companyId_key" ON "WarehouseLocation"("id", "companyId");

-- AddForeignKey
ALTER TABLE "MasterCodeSequence" ADD CONSTRAINT "MasterCodeSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_baseUnitId_companyId_fkey" FOREIGN KEY ("baseUnitId", "companyId") REFERENCES "Unit"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_companyId_fkey" FOREIGN KEY ("categoryId", "companyId") REFERENCES "ItemCategory"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_parentId_branchId_fkey" FOREIGN KEY ("parentId", "branchId") REFERENCES "WarehouseLocation"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- EP28 (hand-written) -------------------------------------------------------

-- Codes: upper-case letters, digits and . _ / - (the service normalizes);
-- never empty, never surrounding spaces.
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_code_format_check"
    CHECK ("code" ~ '^[A-Z0-9]([A-Z0-9._/-]{0,30}[A-Z0-9])?$');
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_code_format_check"
    CHECK ("code" ~ '^[A-Z0-9]([A-Z0-9._/-]{0,30}[A-Z0-9])?$');
ALTER TABLE "Item" ADD CONSTRAINT "Item_code_format_check"
    CHECK ("code" ~ '^[A-Z0-9]([A-Z0-9._/-]{0,30}[A-Z0-9])?$');
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_code_format_check"
    CHECK ("code" ~ '^[A-Z0-9]([A-Z0-9._/-]{0,14}[A-Z0-9])?$');
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_code_format_check"
    CHECK ("code" ~ '^[A-Z0-9]([A-Z0-9._/-]{0,30}[A-Z0-9])?$');
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_code_format_check"
    CHECK ("code" ~ '^[A-Z0-9]([A-Z0-9._/-]{0,30}[A-Z0-9])?$');

-- Lifecycle: deactivatedAt is set exactly when the record is INACTIVE.
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_status_check"
    CHECK (("status" = 'INACTIVE') = ("deactivatedAt" IS NOT NULL));
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_status_check"
    CHECK (("status" = 'INACTIVE') = ("deactivatedAt" IS NOT NULL));
ALTER TABLE "Item" ADD CONSTRAINT "Item_status_check"
    CHECK (("status" = 'INACTIVE') = ("deactivatedAt" IS NOT NULL));
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_status_check"
    CHECK (("status" = 'INACTIVE') = ("deactivatedAt" IS NOT NULL));
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_status_check"
    CHECK (("status" = 'INACTIVE') = ("deactivatedAt" IS NOT NULL));
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_status_check"
    CHECK (("status" = 'INACTIVE') = ("deactivatedAt" IS NOT NULL));

-- Item tracking: a NON_STOCK item never tracks inventory; an untracked item
-- has no lot or expiry; expiry is recorded per lot, so expiry tracking needs
-- lot tracking at least as strict (OPTIONAL → lot OPTIONAL/REQUIRED,
-- REQUIRED → lot REQUIRED).
ALTER TABLE "Item" ADD CONSTRAINT "Item_tracking_check"
    CHECK (
        ("type" <> 'NON_STOCK' OR "inventoryTracked" IS FALSE)
        AND ("inventoryTracked" IS TRUE OR ("lotTracking" = 'NONE' AND "expiryTracking" = 'NONE'))
        AND (
            "expiryTracking" = 'NONE'
            OR ("expiryTracking" = 'OPTIONAL' AND "lotTracking" <> 'NONE')
            OR ("expiryTracking" = 'REQUIRED' AND "lotTracking" = 'REQUIRED')
        )
    );

-- Quantity precision: 0 (whole numbers) to 6 decimal places.
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_precision_check"
    CHECK ("precision" BETWEEN 0 AND 6);

-- Locations: never their own parent; the default slot is TRUE or NULL (one
-- per branch with the unique index) and only on an ACTIVE location.
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_parent_check"
    CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_defaultSlot_check"
    CHECK ("defaultSlot" IS NULL OR ("defaultSlot" IS TRUE AND "status" = 'ACTIVE'));

-- Code counters only count up from zero.
ALTER TABLE "MasterCodeSequence" ADD CONSTRAINT "MasterCodeSequence_value_check"
    CHECK ("lastValue" >= 0 AND "prefix" ~ '^[A-Z]{2,5}$');

-- EP27 CHECK, widened to the EP28 operational codes (the catalog's
-- operational permissions in catalog order; company administration is never
-- stored as an exception).
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
        'operations.workspace.view',
        'operations.orders.view',
        'operations.orders.create',
        'operations.orders.edit',
        'operations.orders.update_status',
        'operations.items.view',
        'operations.items.manage',
        'warehouse.workspace.view',
        'warehouse.inventory.view',
        'warehouse.receiving.view',
        'warehouse.receiving.process',
        'warehouse.stock_adjustment.create',
        'warehouse.stock_adjustment.approve',
        'warehouse.items.view',
        'warehouse.locations.view',
        'warehouse.locations.manage',
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
        'accounting.workspace.view',
        'accounting.payments.view',
        'accounting.payments.update_status',
        'accounting.documents.view',
        'accounting.customers.view',
        'accounting.suppliers.view',
        'executive.workspace.view',
        'executive.overview.view'
    ));
