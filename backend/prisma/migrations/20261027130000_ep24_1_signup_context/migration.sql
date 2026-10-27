-- EP24.1 — sign-up business context (additive).
--
-- What a person says about their business when registering: lead information
-- for PDA BLISS. Separate from Company (created later, in onboarding) and never
-- an authorization input. Deleted with the account.

-- CreateEnum
CREATE TYPE "SignupIndustry" AS ENUM ('DISTRIBUTION', 'SERVICES', 'PROJECTS', 'RETAIL', 'PROPERTY', 'MANUFACTURING', 'OTHER');

-- CreateEnum
CREATE TYPE "SignupTeamSize" AS ENUM ('SIZE_1_10', 'SIZE_11_50', 'SIZE_51_200', 'SIZE_201_500', 'SIZE_500_PLUS');

-- CreateEnum
CREATE TYPE "ContactPreference" AS ENUM ('EMAIL', 'PHONE', 'LINE');

-- CreateEnum
CREATE TYPE "SignupInterest" AS ENUM ('SALES', 'WAREHOUSE', 'PURCHASING', 'OPERATIONS', 'ACCOUNTING_WORKFLOW', 'EXECUTIVE_VISIBILITY', 'FULL_ORGANIZATION');

-- CreateTable
CREATE TABLE "AccountSignupContext" (
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "industry" "SignupIndustry" NOT NULL,
    "teamSize" "SignupTeamSize" NOT NULL,
    "preferredContact" "ContactPreference" NOT NULL DEFAULT 'EMAIL',
    "lineId" TEXT,
    "interests" "SignupInterest"[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountSignupContext_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "AccountSignupContext" ADD CONSTRAINT "AccountSignupContext_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
