-- EP27 — Permission & action matrix foundation (additive, non-destructive).
--
--   * Role defaults live in code (backend/src/permissions/catalog.ts); nothing
--     is copied per membership.
--   * MemberPermissionOverride: an explicit ALLOW / DENY of one operational
--     permission for one membership. DENY beats every ALLOW. The foreign key
--     carries the company id, so an exception never points into another company.
-- No existing row changes: memberships, branch access and invitations are untouched.
-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateTable
CREATE TABLE "MemberPermissionOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberPermissionOverride_companyId_idx" ON "MemberPermissionOverride"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberPermissionOverride_memberId_permission_key" ON "MemberPermissionOverride"("memberId", "permission");

-- AddForeignKey
ALTER TABLE "MemberPermissionOverride" ADD CONSTRAINT "MemberPermissionOverride_memberId_companyId_fkey" FOREIGN KEY ("memberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;




-- EP27 (hand-written): only codes of the canonical catalog's operational
-- permissions. Company-administration permissions follow the role and are
-- never stored as exceptions. Adding a permission to the catalog adds it here
-- in the same episode's migration.
ALTER TABLE "MemberPermissionOverride" ADD CONSTRAINT "MemberPermissionOverride_permission_check"
    CHECK ("permission" IN (
        'sales.workspace.view',
        'sales.orders.view',
        'sales.orders.create',
        'sales.orders.edit',
        'sales.orders.approve',
        'sales.orders.cancel',
        'operations.workspace.view',
        'operations.orders.view',
        'operations.orders.create',
        'operations.orders.edit',
        'operations.orders.update_status',
        'warehouse.workspace.view',
        'warehouse.inventory.view',
        'warehouse.receiving.view',
        'warehouse.receiving.process',
        'warehouse.stock_adjustment.create',
        'warehouse.stock_adjustment.approve',
        'purchasing.workspace.view',
        'purchasing.requests.view',
        'purchasing.requests.create',
        'purchasing.requests.approve',
        'purchasing.orders.view',
        'purchasing.orders.create',
        'purchasing.orders.approve',
        'accounting.workspace.view',
        'accounting.payments.view',
        'accounting.payments.update_status',
        'accounting.documents.view',
        'executive.workspace.view',
        'executive.overview.view'
    ));
