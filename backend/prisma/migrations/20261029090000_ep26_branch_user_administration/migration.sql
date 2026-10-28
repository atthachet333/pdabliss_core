-- EP26 — Branch & user administration (additive, non-destructive).
--
--   * CompanyMember.branchScope: ALL_BRANCHES (default — every existing
--     membership keeps working in every active branch, nobody is locked out by
--     the upgrade) or SELECTED_BRANCHES (only the branches in MemberBranchAccess).
--   * MemberBranchAccess: the branches of a SELECTED_BRANCHES membership. Both
--     foreign keys carry the company id, so a grant can never mix companies.
--   * Invitation intent: departments to assign and branch access to give,
--     re-validated at acceptance; resentFromId links a resend to its original.
-- Every existing row stays valid: new columns are NULL or have defaults.

-- CreateEnum
CREATE TYPE "BranchAccessScope" AS ENUM ('ALL_BRANCHES', 'SELECTED_BRANCHES');

-- AlterTable
ALTER TABLE "CompanyMember" ADD COLUMN     "branchScope" "BranchAccessScope" NOT NULL DEFAULT 'ALL_BRANCHES';

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "branchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "branchScope" "BranchAccessScope" NOT NULL DEFAULT 'ALL_BRANCHES',
ADD COLUMN     "departments" "DepartmentCode"[] DEFAULT ARRAY[]::"DepartmentCode"[],
ADD COLUMN     "resentFromId" TEXT;

-- CreateTable
CREATE TABLE "MemberBranchAccess" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberBranchAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberBranchAccess_branchId_idx" ON "MemberBranchAccess"("branchId");

-- CreateIndex
CREATE INDEX "MemberBranchAccess_companyId_idx" ON "MemberBranchAccess"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberBranchAccess_memberId_branchId_key" ON "MemberBranchAccess"("memberId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_id_companyId_key" ON "CompanyMember"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_id_companyId_key" ON "Branch"("id", "companyId");

-- CreateIndex
CREATE INDEX "Invitation_companyId_createdAt_idx" ON "Invitation"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "MemberBranchAccess" ADD CONSTRAINT "MemberBranchAccess_memberId_companyId_fkey" FOREIGN KEY ("memberId", "companyId") REFERENCES "CompanyMember"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberBranchAccess" ADD CONSTRAINT "MemberBranchAccess_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;



-- EP26 (hand-written): integrity rules the API also enforces.
-- The Company Owner always works in every branch: branch restrictions can
-- never lock the owner out.
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_owner_all_branches_check"
    CHECK ("ownerSlot" IS NULL OR "branchScope" = 'ALL_BRANCHES');

-- Invitation intent: branch ids only for SELECTED_BRANCHES.
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_branch_intent_check"
    CHECK ("branchScope" = 'SELECTED_BRANCHES' OR cardinality("branchIds") = 0);

-- An invitation never carries the owner role (ownership is not invitable).
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_not_owner_check"
    CHECK ("role" <> 'COMPANY_OWNER');
