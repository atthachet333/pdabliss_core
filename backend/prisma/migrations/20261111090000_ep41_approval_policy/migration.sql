-- EP41 separation of duties (docs/EP41_APPROVAL_POLICY.md).
-- Existing companies keep the pre-EP41 behaviour (the default); onboarding sets
-- INDEPENDENT_APPROVAL for new companies in the application.

-- CreateEnum
CREATE TYPE "ApprovalPolicy" AS ENUM ('SELF_APPROVAL_ALLOWED', 'INDEPENDENT_APPROVAL');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "approvalPolicy" "ApprovalPolicy" NOT NULL DEFAULT 'SELF_APPROVAL_ALLOWED';
