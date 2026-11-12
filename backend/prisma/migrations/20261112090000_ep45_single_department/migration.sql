-- EP45 single-department enforcement (docs/EP45_DEPARTMENT_POLICY.md,
-- docs/EP45_MIGRATION_AND_ROLLBACK.md).
--
--   * A Manager / Staff member / Viewer holds at most ONE department assignment per company
--     (unique index). An Owner, System Admin or Executive holds none (guard triggers).
--   * The assignment, its department and the member share one company (composite foreign
--     keys) — an assignment to another company's department cannot exist.
--   * A pending invitation names at most one department, and none for System Admin /
--     Executive (CHECK). Closed invitations keep their history untouched.
--
-- 0. Preflight. Existing data is never "fixed" by this migration: if any person holds
--    several departments, a non-department role holds one, an assignment points at another
--    company's department, or a pending invitation carries an invalid intent, the migration
--    stops here and changes nothing (the whole script is one transaction). An administrator
--    resolves each case explicitly first — `npm run db:department-check` lists them.
DO $$
DECLARE
    several   integer;
    roles     integer;
    foreign_  integer;
    invites   integer;
BEGIN
    SELECT count(*) INTO several FROM (
        SELECT m."userId", d."companyId"
          FROM "Membership" m JOIN "Department" d ON d."id" = m."departmentId"
         GROUP BY m."userId", d."companyId" HAVING count(*) > 1) x;
    SELECT count(*) INTO roles
      FROM "Membership" m
      JOIN "Department" d ON d."id" = m."departmentId"
      JOIN "CompanyMember" cm ON cm."userId" = m."userId" AND cm."companyId" = d."companyId"
     WHERE cm."role" NOT IN ('DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER');
    SELECT count(*) INTO foreign_
      FROM "Membership" m
      JOIN "Department" d ON d."id" = m."departmentId"
     WHERE NOT EXISTS (SELECT 1 FROM "CompanyMember" cm
                        WHERE cm."userId" = m."userId" AND cm."companyId" = d."companyId");
    SELECT count(*) INTO invites
      FROM "Invitation"
     WHERE "status" = 'PENDING'
       AND (cardinality("departments") > 1
            OR ("role" NOT IN ('DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER')
                AND cardinality("departments") > 0));
    IF several + roles + foreign_ + invites > 0 THEN
        RAISE EXCEPTION 'EP45 preflight refused: % person(s) with several departments, % Owner / System Admin / Executive assignment(s), % assignment(s) to a department of another company, % pending invitation(s) with an invalid department intent. Nothing was changed.', several, roles, foreign_, invites
            USING ERRCODE = 'check_violation',
                  HINT = 'Run "npm run db:department-check" against this database and resolve each case in the Company Control Center (docs/EP45_MIGRATION_AND_ROLLBACK.md).';
    END IF;
END;
$$;

-- 1. Company-bound keys.
CREATE UNIQUE INDEX "Department_id_companyId_key" ON "Department"("id", "companyId");
CREATE UNIQUE INDEX "CompanyMember_userId_companyId_key" ON "CompanyMember"("userId", "companyId");

-- 2. Membership.companyId, derived from the department (the only source it can have).
ALTER TABLE "Membership" ADD COLUMN "companyId" TEXT;
UPDATE "Membership" m SET "companyId" = d."companyId" FROM "Department" d WHERE d."id" = m."departmentId";
ALTER TABLE "Membership" ALTER COLUMN "companyId" SET NOT NULL;

-- 3. One department per person and company (replaces the per-department uniqueness).
DROP INDEX "Membership_userId_departmentId_key";
CREATE UNIQUE INDEX "Membership_userId_companyId_key" ON "Membership"("userId", "companyId");
CREATE INDEX "Membership_companyId_idx" ON "Membership"("companyId");

-- 4. The department and the member must belong to the assignment's company.
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_departmentId_fkey";
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_departmentId_companyId_fkey"
    FOREIGN KEY ("departmentId", "companyId") REFERENCES "Department"("id", "companyId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_companyId_fkey"
    FOREIGN KEY ("userId", "companyId") REFERENCES "CompanyMember"("userId", "companyId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Only department roles hold an assignment. Both directions are guarded and lock the
--    member row, so a concurrent role change and assignment cannot both succeed.
CREATE FUNCTION "department_assignment_role_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    member_role "CompanyRole";
BEGIN
    SELECT "role" INTO member_role
      FROM "CompanyMember"
     WHERE "userId" = NEW."userId" AND "companyId" = NEW."companyId"
       FOR SHARE;
    -- A missing member is reported by the composite foreign key.
    IF member_role IS NOT NULL
       AND member_role NOT IN ('DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER') THEN
        RAISE EXCEPTION 'EP45: a % holds no department assignment', member_role
            USING ERRCODE = 'check_violation', CONSTRAINT = 'Membership_department_role_check';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "Membership_department_role"
    BEFORE INSERT OR UPDATE OF "userId", "companyId", "departmentId" ON "Membership"
    FOR EACH ROW EXECUTE FUNCTION "department_assignment_role_guard"();

CREATE FUNCTION "member_role_department_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."role" NOT IN ('DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER')
       AND EXISTS (SELECT 1 FROM "Membership"
                    WHERE "userId" = NEW."userId" AND "companyId" = NEW."companyId") THEN
        RAISE EXCEPTION 'EP45: remove the department assignment before giving the role %', NEW."role"
            USING ERRCODE = 'check_violation', CONSTRAINT = 'CompanyMember_department_role_check';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "CompanyMember_department_role"
    BEFORE UPDATE OF "role" ON "CompanyMember"
    FOR EACH ROW WHEN (NEW."role" IS DISTINCT FROM OLD."role")
    EXECUTE FUNCTION "member_role_department_guard"();

-- 6. A pending invitation carries a valid intent: at most one department, none for a role
--    without departments. Accepted / revoked rows are history and are not re-checked.
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_department_intent_check" CHECK (
    "status" <> 'PENDING'
    OR (cardinality("departments") <= 1
        AND ("role" IN ('DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER')
             OR cardinality("departments") = 0))
);
