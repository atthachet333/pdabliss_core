-- EP25 — Company Control Center foundation (additive).
--
--   * Company profile fields (English name, phone, website, contact email,
--     business type) and the company default language. Existing rows keep
--     NULL — nothing is invented for older companies.
--   * CompanyLogo: the logo bytes in the database (no file system paths).
--   * Branch: INACTIVE status + deactivatedAt (company deactivation, reversible).
--   * CompanyMember: soft status (ACTIVE / DEACTIVATED) and job title.
--   * Membership.roleId becomes optional: Membership is the department
--     assignment; department roles arrive in EP27.
--   * Invitation.locale: the language of the invitation email.
--   * Session.branchId: the server-side branch context.
-- Every existing row stays valid: new columns are NULL or have defaults.

-- CreateEnum
CREATE TYPE "CompanyMemberStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- AlterEnum
ALTER TYPE "BranchStatus" ADD VALUE 'INACTIVE';

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_roleId_fkey";

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "defaultLocale" "AppLocale" NOT NULL DEFAULT 'th',
ADD COLUMN     "englishName" TEXT,
ADD COLUMN     "industry" "SignupIndustry",
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "CompanyMember" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "status" "CompanyMemberStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "locale" "AppLocale";

-- AlterTable
ALTER TABLE "Membership" ALTER COLUMN "roleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "branchSelectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CompanyLogo" (
    "companyId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLogo_pkey" PRIMARY KEY ("companyId")
);

-- CreateIndex
CREATE INDEX "Membership_departmentId_idx" ON "Membership"("departmentId");

-- AddForeignKey
ALTER TABLE "CompanyLogo" ADD CONSTRAINT "CompanyLogo_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- EP25 (hand-written): integrity rules the API also enforces.
-- The Company Owner can never be deactivated (there is always exactly one
-- active owner; ownership transfer is a separate, future flow).
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_owner_active_check"
    CHECK ("ownerSlot" IS NULL OR "status" = 'ACTIVE');

-- A deactivated membership carries its time, an active one does not.
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_deactivated_check"
    CHECK (("status" = 'DEACTIVATED') = ("deactivatedAt" IS NOT NULL));

-- The Head Office is always active (never deactivated or closed by a customer).
-- Written without the new INACTIVE label: PostgreSQL cannot use an enum value
-- added in the same transaction.
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_headOffice_active_check"
    CHECK ("type" <> 'HEAD_OFFICE' OR "status" = 'ACTIVE');
