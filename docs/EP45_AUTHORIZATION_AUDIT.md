# EP45 — Authorization Audit (as implemented at baseline `a9a11db`)

Read-only audit done before any EP45 change, from the code (`backend/src`), the Prisma schema and migrations,
the tests and the EP39–EP44 evidence. Section 7 lists what EP45 changed in response.

## 1. How a request is authorized (baseline)

```
session cookie → Session (revoked / idle / absolute expiry checked)             auth/sessions.ts
  → User (no platform role)                                                       company/context.ts
  → CompanyMember (userId UNIQUE → one company per account; status ACTIVE)        requireCompanyAccess
  → Company ACTIVE + current Subscription ACTIVE                                  canEnterCore
  → [branch-scoped] Session.branchId re-validated: own company, ACTIVE, allowed   requireOperationsContext
  → effective permissions = resolver(role, enabled departments, package,         permissions/resolver.ts
                                     department assignments, exceptions)
  → module policy table: permission + branch + status + ownership + SoD (EP41)    <module>/policy.ts
```

Nothing is cached: the resolver's three inputs (enabled departments, assignments, exceptions) are read on every
request; there is no JWT and no permission set held by the server between requests. The frontend's copy of
`permissions` is presentation only.

## 2. Findings

| #   | Question                                       | Finding at baseline                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How does a user belong to a company?           | `CompanyMember (companyId, userId)`; `userId` is UNIQUE → **one company per account**, no company switching (owner rule since EP00).                                                                                                                                                                                                                                                                  |
| 2   | How are roles given?                           | One `CompanyRole` per member: `COMPANY_OWNER`, `SYSTEM_ADMIN`, `EXECUTIVE`, `DEPARTMENT_MANAGER`, `DEPARTMENT_STAFF`, `VIEWER`. Owner unique per company (`ownerSlot` + CHECK).                                                                                                                                                                                                                       |
| 3   | How are permissions calculated?                | `resolvePermissions()` — code-defined role tiers (READ / OPERATE / MANAGE) × department eligibility (enabled, in package, assigned) × per-member ALLOW / DENY (DENY first). Admin codes (`company.*`) from the role only.                                                                                                                                                                             |
| 4   | How is department membership represented?      | `Membership (userId, departmentId, roleId?, isPrimary)`, unique per (user, department). **Several rows per person allowed** — the admin API accepted up to six departments plus a "primary".                                                                                                                                                                                                          |
| 5   | Company- or branch-scoped departments?         | Company-scoped (`Department (companyId, code)` unique). Branch access is separate (`branchScope` + `MemberBranchAccess`).                                                                                                                                                                                                                                                                             |
| 6   | Multiple assignments?                          | Yes (finding #4). A regular staff member could hold several departments → cross-department rights (EP42.1 gap #1, EP44 blocker B-9 / C-3).                                                                                                                                                                                                                                                            |
| 7   | Branch enforcement                             | Per request; selected branch re-validated and cleared when no longer allowed; record lookups scoped by company + permitted branches (404 otherwise).                                                                                                                                                                                                                                                  |
| 8   | Owner / Executive / System Admin               | Owner: all tiers everywhere, no assignment, exceptions ignored. Executive: READ everywhere, no assignment. **System Admin: READ + OPERATE in assigned departments** — an assignment turned the administrator into an operator.                                                                                                                                                                        |
| 9   | Active sessions                                | No permission snapshot; revocation applies on the next request. Branch context is cleared in the same transaction as access changes; deactivation clears branch context.                                                                                                                                                                                                                              |
| 10  | Explicit permission checks                     | Every operational route resolves through `memberPermissions()` (`load*Actor` in sales, warehouse, production, purchasing, deposits) or `requirePermission()` (operations gate, master data). EP40 sweeps over the real route table (285 routes) prove anonymous 401, foreign Origin 403, another company → nothing, Executive no write, System Admin no operational success, Warehouse money privacy. |
| 11  | Generic operational permissions?               | No route accepts "any operational permission". The only generic gate is `/operations/workspaces/:department` (needs that department's `workspace.view`).                                                                                                                                                                                                                                              |
| 12  | Ownership / createdBy                          | Drafts are private to their creator (+ deciders); EP41 independent approval refuses originators (`SELF_APPROVAL_NOT_ALLOWED`) unless the owner overrides with a reason.                                                                                                                                                                                                                               |
| 13  | Company switching                              | Not possible (finding #1). A client-sent `companyId` is rejected by strict schemas; another company's branch / record → 404.                                                                                                                                                                                                                                                                          |
| 14  | Cross-department roles for staff?              | **Yes, through several `Membership` rows** (finding #6), and for System Admin through any assignment (finding #8).                                                                                                                                                                                                                                                                                    |
| 15  | Department ↔ company integrity in the database | **Not enforced.** `Membership.departmentId` referenced any department; nothing tied it to the member's company (the resolver filtered by `department.companyId`, so such a row was ignored, but it could exist).                                                                                                                                                                                      |
| 16  | Payload department                             | Purchase requests carry `department`; the policy checks it against the caller's `<dept>.purchase_requests.create` codes → 403 `DEPARTMENT_NOT_ALLOWED`. Other bodies are `.strict()` — an unknown `departmentId` is 400.                                                                                                                                                                              |
| 17  | ALLOW exceptions                               | API refuses an ALLOW outside an assigned department; a row written past the API gave nothing. Side effect found: an inapplicable ALLOW on a code the role already held without assignment (Executive READ) **removed** it.                                                                                                                                                                            |
| 18  | Legacy data                                    | `Role` / `Permission` / `RolePermission` tables and `Membership.roleId` exist from EP23 and are not read by any code path since EP27.                                                                                                                                                                                                                                                                 |

## 3. Authorization matrix — baseline (role × department)

`●` = tier held by default (needs the department enabled + in package). `A` = only when assigned. `—` none.

| Role         | Sales     | Operations | Warehouse | Purchasing | Accounting | Executive dept | Company admin                             |
| ------------ | --------- | ---------- | --------- | ---------- | ---------- | -------------- | ----------------------------------------- |
| Owner        | R O M ●   | R O M ●    | R O M ●   | R O M ●    | R O M ●    | R ●            | all                                       |
| System Admin | R O (A)   | R O (A)    | R O (A)   | R O (A)    | R O (A)    | R (A)          | all (owner / peer limits)                 |
| Executive    | R ●       | R ●        | R ●       | R ●        | R ●        | R ●            | profile, branches, people, package (view) |
| Dept Manager | R O M (A) | R O M (A)  | R O M (A) | R O M (A)  | R O M (A)  | R (A)          | profile, branches (view)                  |
| Dept Staff   | R O (A)   | R O (A)    | R O (A)   | R O (A)    | R O (A)    | R (A)          | profile, branches (view)                  |
| Viewer       | R (A)     | R (A)      | R (A)     | R (A)      | R (A)      | R (A)          | profile, branches (view)                  |

With several assignments, the (A) cells added up — the gap EP45 closes.

## 4. Authorization matrix — after EP45

| Role         | Departments it can work in | Tiers | Assignment                         |
| ------------ | -------------------------- | ----- | ---------------------------------- |
| Owner        | all enabled                | R O M | none (refused)                     |
| System Admin | **none**                   | —     | none (refused)                     |
| Executive    | all enabled                | R     | none (refused)                     |
| Dept Manager | **its one department**     | R O M | exactly one, or none (= no access) |
| Dept Staff   | **its one department**     | R O   | exactly one, or none               |
| Viewer       | **its one department**     | R     | exactly one, or none               |

## 5. Route inventory (EP45 adds no route)

| Prefix                                                                  | Owning department (state-changing routes)                                                                                                                  | How the route authorizes                                                                   |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/sales/*`                                                              | Sales                                                                                                                                                      | `loadSalesActor` → resolver; branch + status + creator + SoD in `sales/policy.ts`          |
| `/production/*`                                                         | Operations                                                                                                                                                 | `loadProductionActor` → resolver; `production/policy.ts`                                   |
| `/warehouse/*` (incl. pending-receive, material-issues, finished-goods) | Warehouse                                                                                                                                                  | `loadWarehouseActor` → resolver; `warehouse/policy.ts`; response allow-lists without money |
| `/purchase-orders/*`                                                    | Purchasing (`/:id/deposit/*` → Accounting)                                                                                                                 | `loadPoActor`; `purchasing/order-policy.ts`                                                |
| `/purchase-requests/*`                                                  | raised by every department, decided by Purchasing / own manager                                                                                            | `loadActor`; `purchasing/policy.ts` (payload department checked)                           |
| `/accounting/deposits/*`                                                | Accounting                                                                                                                                                 | deposit actor; `accounting.deposits.*`                                                     |
| `/master-data/*`                                                        | customers → Sales, suppliers → Purchasing, items / units / categories → Operations, locations → Warehouse; `company.master_data.manage` for administrators | `requireAnyPermission` / `requireBranchPermission`                                         |
| `/operations/*`                                                         | — (GET: context, workspace gate, one-permission probe)                                                                                                     | `requireOperationsContext` / `requirePermission`                                           |
| `/company/*`                                                            | administration                                                                                                                                             | `requireCompanyAccess({permission})` + owner / self / peer invariants                      |

There are no export or report-download routes; summaries are the per-module `GET …/context` and list endpoints,
each behind its department's view code (swept in `ep45-department.test.ts`).

## 6. Session and invalidation mechanism

No authorization version is needed: permissions are recomputed from the database on every request, so a
department reassignment, role change, DENY, membership deactivation or branch change takes effect on the open
session's next request (tested). Branch context is cleared transactionally when access shrinks. Logout revokes the
session row; a replayed cookie gets 401. The authentication system was not changed.

## 7. What EP45 changed in response

| Finding                           | Change                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| #4, #6, #14 several departments   | DB: `Membership` unique per (user, company); resolver: exactly-one rule, AMBIGUOUS → nothing; API: `ONE_DEPARTMENT_ONLY` |
| #8 System Admin operator          | resolver: System Admin has no operational tier; DB trigger + API refuse its assignment                                   |
| #15 department ↔ company          | `Membership.companyId` + composite FKs to `Department (id, companyId)` and `CompanyMember (userId, companyId)`           |
| role changes keeping a department | DB trigger + API `ROLE_DEPARTMENT_CONFLICT`                                                                              |
| invitation intent                 | DB CHECK on pending invitations + API checks + acceptance re-check                                                       |
| #17 ALLOW side effect             | an inapplicable ALLOW no longer removes a role default                                                                   |
| stale UI permissions              | frontend re-reads the context on a stale-authorization 403                                                               |
| legacy data                       | read-only preflight (`npm run db:department-check`) + migration preflight that refuses ambiguous data                    |
