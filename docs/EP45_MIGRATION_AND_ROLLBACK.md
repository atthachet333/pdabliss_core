# EP45 — Migration, Remediation and Rollback

Migration: `backend/prisma/migrations/20261112090000_ep45_single_department/migration.sql`.
Preflight tool: `npm run db:department-check` (`backend/src/cli/department-check.ts`, read only).

**No persistent database (Dev, UAT, any server) was migrated in EP45.** Everything below was executed on a
disposable PostgreSQL 18 cluster (own data folder in the session scratchpad, `127.0.0.1:55443`, started and stopped
with `pg_ctl` as the current user, no service).

## 1. What the migration does

| Step | Change                                                                                                                                                                                                    | Data effect                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 0    | **Preflight** (`DO` block): counts people with several departments, Owner / System Admin / Executive assignments, assignments to another company's department, pending invitations with an invalid intent | if any count > 0 → `RAISE EXCEPTION` (23514) naming the counts; the script is one transaction, so **nothing is changed** |
| 1    | unique `Department (id, companyId)`, unique `CompanyMember (userId, companyId)`                                                                                                                           | none (both already unique by their first column)                                                                         |
| 2    | `Membership.companyId` added, filled from the department, then `NOT NULL`                                                                                                                                 | derived only — no choice is made                                                                                         |
| 3    | `Membership (userId, departmentId)` unique → `Membership (userId, companyId)` unique; index on `companyId`                                                                                                | none                                                                                                                     |
| 4    | FK `departmentId` → composite FKs `(departmentId, companyId)` → `Department`, `(userId, companyId)` → `CompanyMember`                                                                                     | none                                                                                                                     |
| 5    | triggers `Membership_department_role`, `CompanyMember_department_role` (lock the member row; refuse assignments for non-department roles and role changes that would keep one)                            | none                                                                                                                     |
| 6    | `Invitation_department_intent_check`: a **pending** invitation names ≤ 1 department and none for System Admin / Executive                                                                                 | closed invitations (history) are never re-checked                                                                        |

No row is deleted or rewritten. Audit history (`AuditLog`, append-only since EP41) is untouched.

## 2. Before migrating any persistent database

1. Back it up (EP43 tooling: `ops/core-ops.mjs backup`, verified restore).
2. Run the preflight **against that database** (read only — `BEGIN READ ONLY`, rolled back):
   ```bash
   DATABASE_URL=postgresql://…/<db> npm --prefix backend run db:department-check
   ```
   Exit 0 = no blocking conflict; exit 2 = conflicts (listed). `--json` gives a machine-readable report.
3. Resolve every **BLOCK** line explicitly in the Company Control Center (People → member → Department), as the
   company administrator decides — the migration never picks a department for anyone:

   | Conflict                | Resolution                                                                                       |
   | ----------------------- | ------------------------------------------------------------------------------------------------ |
   | `SEVERAL_DEPARTMENTS`   | choose the person's one department (the EP44 UI still allows editing before upgrade)             |
   | `ROLE_HOLDS_DEPARTMENT` | remove the department, or change the role to a department role if the person really works in one |
   | `FOREIGN_DEPARTMENT`    | remove the assignment (it never granted anything — the resolver ignored it)                      |
   | `PENDING_INVITATION`    | revoke and re-send with one department (or none for System Admin / Executive)                    |

   `NO_DEPARTMENT`, `HISTORICAL_INVITATION` and `LEGACY_ROLE_LINK` are informational: an unassigned regular
   member simply has no operational access until an administrator assigns one.

4. Re-run the preflight until it reports no blocking conflict, then `prisma migrate deploy` with the EP45 code.

## 3. If the migration was attempted with conflicts

`migrate deploy` stops with `P3018` and the preflight message; the database is unchanged apart from Prisma's failed
record in `_prisma_migrations`. Recover with:

```bash
npx prisma migrate resolve --rolled-back 20261112090000_ep45_single_department
```

then resolve the conflicts (§2.3) and deploy again. The EP44 application keeps running meanwhile (schema unchanged).

## 4. Rollback (down) — restores the EP44 schema exactly

Run **together with the EP44 code** (the EP45 code requires `Membership.companyId`). No business data is lost:
`companyId` is derived. Assignments made under EP45 stay valid under EP44.

```sql
BEGIN;
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_department_intent_check";
DROP TRIGGER "CompanyMember_department_role" ON "CompanyMember";
DROP FUNCTION "member_role_department_guard"();
DROP TRIGGER "Membership_department_role" ON "Membership";
DROP FUNCTION "department_assignment_role_guard"();
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_userId_companyId_fkey";
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_departmentId_companyId_fkey";
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "Membership_companyId_idx";
DROP INDEX "Membership_userId_companyId_key";
CREATE UNIQUE INDEX "Membership_userId_departmentId_key" ON "Membership"("userId", "departmentId");
ALTER TABLE "Membership" DROP COLUMN "companyId";
DROP INDEX "CompanyMember_userId_companyId_key";
DROP INDEX "Department_id_companyId_key";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261112090000_ep45_single_department';
COMMIT;
```

## 5. Evidence (disposable cluster)

| Scenario                                                                                                                                                                                           | Result                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh database, all 27 migrations                                                                                                                                                                  | applied; `prisma migrate diff` database ↔ `schema.prisma`: **empty**                                                                                                                                                                                           |
| EP44 code + EP44 demo seed (71 tables, 691 rows) → preflight                                                                                                                                       | no conflict (exit 0)                                                                                                                                                                                                                                           |
| → EP45 migration                                                                                                                                                                                   | 4.4 s; **every table's content identical** before / after (Membership compared without the new column), +1 ledger row; all 6 assignments have `companyId` = their department's company; 2 triggers present; drift empty                                        |
| → EP45 demo seed run again                                                                                                                                                                         | idempotent: 0 tables changed                                                                                                                                                                                                                                   |
| → rollback (§4) with the EP44 code                                                                                                                                                                 | drift against the EP44 `schema.prisma`: **empty**; data identical to the original EP44 database; `migrate status` up to date                                                                                                                                   |
| → roll forward again                                                                                                                                                                               | applied; drift empty                                                                                                                                                                                                                                           |
| EP44 database with deliberate conflicts (several departments, System Admin with a department, another company's department, pending two-department invitation, accepted two-department invitation) | preflight tool: 4 BLOCK + 2 info, exit 2; `migrate deploy`: refused with the four counts, **no table changed** except Prisma's failed record; `migrate resolve --rolled-back` → explicit resolution → deploy succeeded; the accepted invitation's history kept |
| Read-only `pg_dump` of the real **Dev** database (EP24 schema, 21 tables, 513 rows) restored and upgraded through all migrations to EP45                                                           | preflight: no conflict (1 informational `NO_DEPARTMENT`: `staff.demo`); 4.0 s; drift empty; no pre-existing table lost a row                                                                                                                                   |

The Dev database itself was only read (`pg_dump`, read-only content hashes before and after: **0 / 21 tables
differ**). No UAT database exists on this workstation; none was created.

## 6. Applying to UAT later (owner-approved procedure, not executed)

1. `node uat/uat.mjs backup` (verified dump).
2. `DATABASE_URL=<uat> npm --prefix backend run db:department-check` — the EP42.2 baseline personas have exactly one
   department each, so no conflict is expected.
3. Stop the UAT stack, `prisma migrate deploy` with the EP45 build, start, `node uat/uat.mjs verify --api`.
4. Never `reset` the sandbox for this; if anything fails, restore the backup from step 1.
