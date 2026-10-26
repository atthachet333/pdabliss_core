-- EP24 — company & subscription foundation (additive; EP23 auth data untouched).
--
-- Hand-edited after `prisma migrate diff`:
--   * Department.code is converted in place (lower-case text → DepartmentCode)
--     instead of being dropped, so existing rows and the unique index survive.
--   * Existing COMPANY_OWNER memberships get their owner slot.
--   * CHECK constraints (not expressible in Prisma) pair every "slot" with its
--     meaning: one owner per company, one Head Office (code 00000) per company,
--     one current (non-ended) subscription per company.
-- Companies created before EP24 (only the demo company) are completed by the
-- demo seed (Head Office, subscription, status).

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING_SUBSCRIPTION', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CompanyOnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DepartmentCode" AS ENUM ('SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "BranchType" AS ENUM ('HEAD_OFFICE', 'BRANCH');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "onboardingStatus" "CompanyOnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING_SUBSCRIPTION',
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CompanyMember" ADD COLUMN     "ownerSlot" BOOLEAN;

-- Backfill: existing company owners take their company's owner slot.
UPDATE "CompanyMember" SET "ownerSlot" = TRUE WHERE "role" = 'COMPANY_OWNER';

-- AlterTable (in place: 'sales' → 'SALES', …)
ALTER TABLE "Department"
    ALTER COLUMN "code" TYPE "DepartmentCode" USING upper("code")::"DepartmentCode";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "planSelectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BranchType" NOT NULL,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "headOfficeSlot" BOOLEAN,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'TH',
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "plan" "PlanCode" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "catalogVersion" INTEGER NOT NULL,
    "monthlyPriceThb" INTEGER,
    "entitlements" JSONB NOT NULL,
    "currentSlot" BOOLEAN,
    "startsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "paymentProvider" TEXT,
    "providerSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_code_key" ON "Branch"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_headOfficeSlot_key" ON "Branch"("companyId", "headOfficeSlot");

-- CreateIndex
CREATE INDEX "Subscription_companyId_status_idx" ON "Subscription"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_companyId_currentSlot_key" ON "Subscription"("companyId", "currentSlot");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_occurredAt_idx" ON "AuditLog"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "Company_onboardingStatus_idx" ON "Company"("onboardingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_companyId_ownerSlot_key" ON "CompanyMember"("companyId", "ownerSlot");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- EP24 (hand-written): each slot is TRUE exactly when its meaning holds and NULL
-- otherwise; with the unique indexes above the database refuses a second
-- owner, a second Head Office and a second current subscription. "IS TRUE" /
-- "IS NULL" are used because a NULL comparison would let a CHECK pass.
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_ownerSlot_check"
    CHECK (
        ("role" = 'COMPANY_OWNER' AND "ownerSlot" IS TRUE)
        OR ("role" <> 'COMPANY_OWNER' AND "ownerSlot" IS NULL)
    );

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_code_format_check"
    CHECK ("code" ~ '^[0-9]{5}$');

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_headOffice_check"
    CHECK (
        ("type" = 'HEAD_OFFICE' AND "code" = '00000' AND "headOfficeSlot" IS TRUE)
        OR ("type" <> 'HEAD_OFFICE' AND "code" <> '00000' AND "headOfficeSlot" IS NULL)
    );

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_currentSlot_check"
    CHECK (
        ("status" IN ('CANCELED', 'EXPIRED') AND "currentSlot" IS NULL)
        OR ("status" NOT IN ('CANCELED', 'EXPIRED') AND "currentSlot" IS TRUE)
    );

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_price_check"
    CHECK ("monthlyPriceThb" IS NULL OR "monthlyPriceThb" > 0);
