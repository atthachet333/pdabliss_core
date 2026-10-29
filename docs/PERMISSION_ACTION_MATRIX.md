# Permission & Action Matrix (EP27)

EP27 adds the action layer to CORE's authorization: **what** a member may do. It builds on EP26
(where a member may work) and is the contract every operational module (EP29+) uses. The server
decides; screens only show, disable or explain.

Source of truth: `backend/src/permissions/` — `catalog.ts` (codes, role defaults),
`resolver.ts` (effective permissions), `guard.ts` (`requirePermission`), `admin.ts`
(administration API).

## 1. The full authorization chain

An action is allowed only when **all** hold, checked on the server on every request:

```
active Company Membership             requireCompanyAccess()         (EP25)
AND a valid Company Role              policy.ts invariants           (EP25)
AND the department is enabled         Department.isActive            (EP25)
AND the department is in the package  subscription entitlements      (EP24)
AND the member is in the department   Membership (where the role requires it)
AND branch access allows the branch   branchScope + MemberBranchAccess (EP26)
AND the selected branch is valid      Session.branchId, re-checked   (EP26)
AND the action permission is granted  role default ± exception, DENY first (EP27)
```

Nothing is cached: a change of role, department assignment, exception, membership status,
branch access or enabled departments takes effect on the next request of every open session.

## 2. Naming

`<namespace>.<resource>.<action>` — lower case, `_` inside words.

- **Namespaces:** `company` (Company Control Center administration — not an operational
  department), `sales`, `operations`, `warehouse`, `purchasing`, `accounting`, `executive`.
  No `platform.*` code exists: platform roles are a separate system and no customer permission
  can reach them.
- **Actions:** `view`, `create`, `edit`, `approve`, `cancel`, `delete`, `export`, `manage`, plus
  two domain actions: `process` (receiving goods) and `update_status` (move a record's status —
  the one status action; there is no `manage_status`, `update`, `modify` or `change`).
  `delete` never means hard delete; business records cancel / void / archive.
- **Scope** (metadata on every code): `COMPANY` (administration, and since EP28 the canonical
  company-wide master records: customers, suppliers, items) or `BRANCH` (every other operational
  code — valid only inside a permitted branch). A permission never grants a branch.
- **Tier** (metadata, drives role defaults): `READ` = view · `OPERATE` = create, edit, process ·
  `MANAGE` = approve, cancel, delete, export, manage, update_status.

## 3. Catalog (foundation contracts — the resources themselves arrive with their modules)

| Area | Codes |
| --- | --- |
| Company administration | `company.profile.view` · `.edit`, `company.branches.view` · `.manage`, `company.members.view` · `.manage`, `company.departments.manage`, `company.permissions.view` · `.manage`, `company.subscription.view`, `company.activity.view`, `company.settings.manage` |
| Sales | `sales.workspace.view`, `sales.orders.view` · `.create` · `.edit` · `.approve` · `.cancel` |
| Operations | `operations.workspace.view`, `operations.orders.view` · `.create` · `.edit` · `.update_status` |
| Warehouse | `warehouse.workspace.view`, `warehouse.inventory.view`, `warehouse.receiving.view` · `.process`, `warehouse.stock_adjustment.create` · `.approve` |
| Purchasing | `purchasing.workspace.view`, `purchasing.requests.view` · `.create` · `.approve`, `purchasing.orders.view` · `.create` · `.approve` |
| Accounting | `accounting.workspace.view`, `accounting.payments.view` · `.update_status`, `accounting.documents.view` |
| Executive | `executive.workspace.view`, `executive.overview.view` |
| **EP28 master data** | `company.master_data.manage` (administration) · `sales.customers.view` · `.manage`, `sales.items.view`, `operations.items.view` · `.manage`, `warehouse.items.view`, `warehouse.locations.view` · `.manage`, `purchasing.suppliers.view` · `.manage`, `purchasing.items.view`, `accounting.customers.view`, `accounting.suppliers.view` |
| **EP29 purchase requests** | `purchasing.requests.view` · `.create` · `.approve` (existing) + `purchasing.requests.cancel`; `sales` · `operations` · `warehouse` · `accounting` `.purchase_requests.create` · `.approve` |

**EP29 note.** No `submit` / `reject` action words were added: submitting is part of `create`
(OPERATE) and rejecting is the negative side of the `approve` decision (MANAGE). A request is
raised from a department (`<dept>.purchase_requests.create`, or `purchasing.requests.create`) and
decided by Purchasing (`purchasing.requests.approve`, any department) or by the originating
department's manager (`<dept>.purchase_requests.approve`). Who may do what in each status is one
policy table (`backend/src/purchasing/policy.ts`); see [PURCHASING_REQUEST.md](PURCHASING_REQUEST.md).

**EP28 scope note.** Canonical master records are one per company, so the customer, supplier and
item codes are **COMPANY-scoped** operational permissions (department, package, assignment and
exceptions apply as usual; no selected branch is needed). Warehouse locations stay BRANCH-scoped
and also need branch access to the named branch. Several departments read one record — a check
can accept any of several codes (`requireAnyPermission`). `.manage` is MANAGE tier: Managers
only by default; Staff and Viewers read. See [OPERATIONAL_MASTER_DATA.md](OPERATIONAL_MASTER_DATA.md) §7.

**Warehouse holds no financial notion** — no cost, purchase price, margin, payment amount,
supplier terms or financial reporting (a test enforces it). Those belong to Purchasing,
Accounting and Executive, and the per-response data-class rules still apply.

## 4. Role defaults (code-defined; customers cannot edit them)

| Role | Company administration | Operational departments |
| --- | --- | --- |
| Company Owner | everything (invariant) | every tier, every enabled department, no assignment needed |
| System Admin | everything (the owner / peer / self protections still apply), incl. `company.master_data.manage` (EP28) | READ + OPERATE in **assigned** departments — administration is not operations |
| Executive | view profile, branches, people, package | READ in every enabled department; no create / edit / approve |
| Department Manager | view profile, branches | READ + OPERATE + MANAGE in assigned departments |
| Department Staff | view profile, branches | READ + OPERATE in assigned departments (no approve / manage) |
| Viewer | view profile, branches | READ in assigned departments |

`/company/permissions` shows this as the read-only **Role profiles** view.

## 5. Exceptions (per member) and precedence

`MemberPermissionOverride (companyId, memberId, permission, effect ALLOW | DENY)`, unique per
member × permission; nothing is copied per membership.

- Only **operational** codes take exceptions. Company administration is role-bound — an
  exception can never create an administrator, an owner or platform authority
  (`PERMISSION_NOT_OVERRIDABLE`). Unknown codes are refused (`PERMISSION_UNKNOWN`, 422) by the API
  and by a database `CHECK` listing the catalog's operational codes.
- Resolution for an operational code: department disabled → **no** · not in the package
  (Executive on Starter) → **no** · **DENY → no (beats every ALLOW and default)** · ALLOW → yes
  if the member is in the department (assigned, or the owner) · otherwise the role default
  (with assignment where the role requires it).
- An ALLOW must fit the member when it is set (`PERMISSION_NOT_ELIGIBLE`, reason
  `DEPARTMENT_DISABLED` / `NOT_IN_PACKAGE` / `NOT_ASSIGNED`); a row written past the API still
  gives nothing (tested).
- When a department is disabled, its exceptions stay (shown "Inactive — department disabled")
  and come back with the department.
- The **owner** has no exceptions (refused `OWNER_PROTECTED`; the resolver ignores any row).

## 6. Who manages exceptions

`company.permissions.view` / `.manage`: Company Owner and System Admin. The EP25 member
invariants apply unchanged: nobody changes the owner (`OWNER_PROTECTED`), themselves
(`SELF_CHANGE`), or — as a System Admin — another System Admin (`PEER_ADMIN`). Changes are
submitted as a batch, applied in one transaction (the member row is locked), and the resulting
state is returned. A change that removes a permission the person currently holds is confirmed
in the UI first.

## 7. Audit

`MEMBER_PERMISSION_OVERRIDE_ADDED` / `_CHANGED` / `_REMOVED` on the member, with `member`
(email), `permission`, `from`, `to` and the actor — nothing else. History stays after removal.
Activity renders them in words, e.g. "Denied Stock adjustments — Approve for somchai@…".

## 8. API

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/company/current/permissions` — catalog + role profiles | `company.permissions.view` |
| GET | `/api/v1/company/current/members/:id/permissions` — effective state, source, inactive reason, exceptions, protection | `company.permissions.view` |
| PUT | `/api/v1/company/current/members/:id/permissions` `{ changes: [{ permission, effect: ALLOW \| DENY \| null }] }` | `company.permissions.manage` |
| GET | `/api/v1/company/context` — adds `permissions` (the caller's own effective codes) | session |
| GET | `/api/v1/operations/context` — adds `permissions` | branch context |
| GET | `/api/v1/operations/workspaces/:department` — the gate into a workspace | `<dept>.workspace.view` |
| GET | `/api/v1/operations/authorize?permission=` — one operational check in the current branch | that permission |

Another company's member is simply not found (404). No response carries passwords, sessions,
tokens, platform internals or other people's permissions except to administrators.

**EP28 guards** (same resolver, no role checks):

| Function | Use |
| --- | --- |
| `requireAnyPermission(db, ctx, codes)` | company-scoped check satisfied by any listed code (a customer read via Sales **or** Accounting); returns company access + effective codes |
| `requireBranchPermission(db, ctx, code, branchId, companyWide?)` | a branch-scoped code for a branch named in the request (a location's branch): the branch is looked up in the caller's company; `companyWide` (an administration code) reaches every branch; otherwise the code **and** EP26 branch access are required |

## 9. How a future module protects an endpoint

```ts
import { requirePermission } from '../../permissions/guard.js';

app.post('/purchasing/requests', async (request) => {
  const op = await requirePermission(db, requireAuth(request), 'purchasing.requests.create');
  // op.companyId, op.branch.id: scope EVERY query and insert by both
  // op.permissions: effective codes (e.g. to decide what the response may include)
  return purchasing.createRequest(op, parseInput(CreateRequestBody, request.body));
});
```

Rules for module authors:

1. Add new codes to `PERMISSION_CATALOG` (and its migration `CHECK`, and the TH / EN / ZH labels
   in `frontend/src/features/company-center/permissionCopy.ts` — a test checks both).
2. Call `requirePermission()` first in every operational route — never check roles, departments
   or branches by hand, never trust a branch or company id from the client.
3. Scope by `op.companyId` + `op.branch.id`; the Warehouse rule and data-class allow-lists still
   decide which fields a response may contain.
4. The frontend reads `context.permissions` to show / disable / explain actions only.

## 10. Frontend

- Company Control Center navigation and pages use the caller's effective codes
  (`overview.me.permissions`); a page outside them explains why it is closed.
- CORE lists only departments whose `<dept>.workspace.view` the server grants (department
  enabled + in the package + assigned where required + not denied), with the access level in
  words ("View only" / "Can work" / "Can approve / manage"). The context is re-read when the tab
  becomes visible again (EP26), so a revoked workspace disappears.
- `/company/permissions`: Role profiles (matrix on wide screens, cards below 1280 px) and Member
  exceptions (person picker → grouped areas → resources → actions with state, source, inactive
  reason and an exception selector; raw codes secondary).
