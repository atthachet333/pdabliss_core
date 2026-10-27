-- EP24.1 — account profile and Platform Company Explorer (additive, no data loss).
--
-- * User.displayName becomes the canonical person name: renamed in place to
--   fullName, so every existing value is kept (no second, competing name field).
-- * phone (E.164) and jobFunction are profile data only — never authorization.
-- * Company list index for newest-first cursor pagination.

-- CreateEnum
CREATE TYPE "JobFunction" AS ENUM ('OWNER', 'EXECUTIVE', 'ACCOUNTING', 'PURCHASING', 'SALES', 'OPERATIONS', 'WAREHOUSE', 'IT', 'OTHER');

-- AlterTable (rename keeps the data)
ALTER TABLE "User" RENAME COLUMN "displayName" TO "fullName";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "jobFunction" "JobFunction",
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE INDEX "Company_createdAt_id_idx" ON "Company"("createdAt" DESC, "id" DESC);
