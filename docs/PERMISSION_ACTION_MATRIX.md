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
| **EP31 receiving and inventory** | `warehouse.receiving.view` · `.process` (existing) + `warehouse.receiving.cancel`; `warehouse.inventory.view` (existing) |
| **EP32 inventory control** | `warehouse.transfers.create` · `.approve` · `.cancel`, `warehouse.counts.create` · `.approve` (new); `warehouse.stock_adjustment.create` · `.approve` (EP27, now used); reads with `warehouse.inventory.view` |
| **EP33 sales orders** | `sales.orders.view` · `.create` · `.approve` · `.cancel` (EP27, now used); `sales.orders.edit` reserved; customers via `sales.customers.view` |
| **EP34 sales allocation** | allocate · release · reallocate with `sales.orders.approve` (no new code); Pending Pick with `warehouse.inventory.view` |
| **EP35 sales fulfilment** | `warehouse.picking.process` (new, OPERATE) · `warehouse.dispatch.confirm` (new, MANAGE) · `warehouse.delivery.confirm` (new, MANAGE); reads with `warehouse.inventory.view` |
| **EP36 production planning** | `operations.orders.view` · `.create` (EP27, now used) · `operations.orders.approve` · `.cancel` (new, MANAGE) · `operations.bom.view` (new, READ, COMPANY) · `operations.bom.manage` (new, MANAGE, COMPANY) · `purchasing.production_shortages.view` (new, READ); `operations.orders.edit` · `.update_status` reserved |
| **EP38 output, finished goods, completion** | `operations.output.create` (new, OPERATE: report output) · `operations.output.approve` (new, MANAGE: quality decision) · `operations.orders.update_status` (EP27 code, now used, MANAGE: completion review / reopen / complete / short close) · `warehouse.finished_goods.view` (new, READ) · `.process` (new, OPERATE: receipt drafts) · `.confirm` (new, MANAGE: post / reverse); all BRANCH-scoped |
| **EP37 production execution** | `operations.materials.manage` (new, MANAGE: reserve / release / reallocate / excess) · `operations.material_issues.create` (new, OPERATE: draft / edit / cancel issues) · `operations.material_issues.approve` (new, MANAGE: post — stock leaves) · `operations.material_usage.create` (new, OPERATE: usage evidence) · `operations.execution.manage` (new, MANAGE: start / pause / resume) · `warehouse.material_issues.view` (new, READ: Warehouse handoff); all BRANCH-scoped |
| **EP30 purchase orders** | `purchasing.orders.view` · `.create` · `.approve` (existing) + `purchasing.orders.edit` · `.cancel`; `accounting.deposits.view` · `.confirm`; `warehouse.receiving.view` (existing) |

**EP29 note.** No `submit` / `reject` action words were added: submitting is part of `create`
(OPERATE) and rejecting is the negative side of the `approve` decision (MANAGE). A request is
raised from a department (`<dept>.purchase_requests.create`, or `purchasing.requests.create`) and
decided by Purchasing (`purchasing.requests.approve`, any department) or by the originating
department's manager (`<dept>.purchase_requests.approve`). Who may do what in each status is one
policy table (`backend/src/purchasing/policy.ts`); see [PURCHASING_REQUEST.md](PURCHASING_REQUEST.md).

**EP30 note.** No `issue` or `waive` action words: `purchasing.orders.approve` (MANAGE) issues an
order, and `accounting.deposits.confirm` (MANAGE, a domain action like `process`) confirms or waives a
deposit. Purchasing never gains deposit authority; Accounting never gains order editing; System Admin
gets neither unless assigned to the department; Warehouse reads pending receive only. The override
CHECK lists 56 operational codes. One policy table: `backend/src/purchasing/order-policy.ts`; see
[PURCHASE_ORDER.md](PURCHASE_ORDER.md).

**EP31 note.** One new code, `warehouse.receiving.cancel` (MANAGE): reversing a posted goods receipt
takes stock away and reopens the order, which is a manager decision, not day-to-day receiving.
`warehouse.receiving.process` (OPERATE) creates, edits and **posts** receipts (posting is part of
processing — no `post` action word). `warehouse.inventory.view` reads stock, lots and movements. No
stock-adjustment code is used yet. System Admin gets none of it unless assigned to Warehouse;
Executive reads only; Purchasing and Accounting see receive progress on orders, never stock. The
override CHECK lists 57 operational codes. One policy table: `backend/src/warehouse/policy.ts`; see
[WAREHOUSE_RECEIVING.md](WAREHOUSE_RECEIVING.md).

**EP38 note.** Five new BRANCH-scoped codes (override CHECK now **81**); completion reuses the
reserved EP27 `operations.orders.update_status` (MANAGE). Role defaults follow the tiers:

- **Operations Staff** report output.
- **Operations Managers** accept / reject it and review, complete or short-close orders.
- **Warehouse Staff** draft finished goods receipts.
- **Warehouse Managers** post and reverse them. The Owner holds everything, under every domain check.
- **Executive** reads. An assigned System Admin never gets MANAGE. Sales, Purchasing and Accounting
  hold none of these codes.
- **No cross-reading:** Warehouse cannot open production orders or output reports, and Operations
  has no finished goods route.

No demo persona was elevated. See [PRODUCTION_COMPLETION.md](PRODUCTION_COMPLETION.md) §1 and
[PRODUCTION_FINISHED_GOODS_RECEIPT.md](PRODUCTION_FINISHED_GOODS_RECEIPT.md) §8.

**EP37 note.** Six new BRANCH-scoped codes (override CHECK now **76**), see the EP37 catalog row.
Operations Staff draft material issues and record usage (OPERATE); Operations Managers also reserve,
release, reallocate, authorize excess, post issues and start / pause / resume production (MANAGE);
the Owner holds everything; Executive reads; an Operations-assigned System Admin never gets MANAGE;
Warehouse roles read only the material issue handoff (`warehouse.material_issues.view`) and cannot open
production orders; Sales / Purchasing / Accounting hold no execution code. No demo persona was
elevated. See [PRODUCTION_EXECUTION.md](PRODUCTION_EXECUTION.md) §1.

**EP36 note.** Production lives in the **Operations** department (no new department). Five new
codes (override CHECK now **70**): `operations.orders.approve` (approve / reject / release),
`operations.orders.cancel` (cancel approved / ready), `operations.bom.view` and `operations.bom.manage`
(COMPANY-scoped like items — BOM revisions describe items), and `purchasing.production_shortages.view`
(the read-only Purchasing handoff). Operations Staff plan (view, create, submit); Operations Managers
also approve, reject, release, cancel and manage BOMs; Executive reads; System Admin has nothing unless
assigned to Operations and then never MANAGE; Sales / Warehouse / Accounting hold no Production code;
Purchasing reads only the shortage handoff. `operations.demo` stays Manager. See
[PRODUCTION_ORDER.md](PRODUCTION_ORDER.md) §4.

**EP35 note.** Three new BRANCH-scoped Warehouse codes (override CHECK now **65**):
`warehouse.picking.process` (OPERATE — Staff: picks, packs, shipments; no stock moves),
`warehouse.dispatch.confirm` (MANAGE — the stock issue; `confirm` maps to MANAGE) and
`warehouse.delivery.confirm` (MANAGE — delivery and exceptions). Warehouse Staff (including
`warehouse.demo`) pick and pack but never dispatch; Managers and the Owner dispatch and confirm delivery;
Executive reads; System Admin only with a Warehouse assignment and then without MANAGE; Sales roles hold
no Warehouse code — they read progress on the order. See [SALES_FULFILLMENT.md](SALES_FULFILLMENT.md) §10.

**EP34 note.** No new codes (override CHECK still 62). Allocating, releasing and reallocating a
CONFIRMED order reuse `sales.orders.approve` (MANAGE) — the manager who confirms an order commits stock
to it; cancelling (`sales.orders.cancel`) also releases its reservations. Staff, Executive and Viewer
see allocation progress only. Warehouse reads reserved demand at `GET /warehouse/pending-pick` with
`warehouse.inventory.view` — no customer or money. See [SALES_ALLOCATION.md](SALES_ALLOCATION.md).

**EP33 note.** No new codes, so the override CHECK is unchanged (62). `sales.orders.create`
(OPERATE) drafts, edits, submits and discards the member's **own** orders (submitting is part of
creating); `sales.orders.approve` (MANAGE) confirms a submitted order (no `confirm` word);
`sales.orders.cancel` (MANAGE) cancels a submitted or confirmed order with a reason;
`sales.orders.view` reads the branch's orders — a DRAFT only for its creator and for members who may
confirm. `sales.orders.edit` stays reserved (unused). Executive and Viewer read submitted work and act
on nothing; Warehouse, Accounting, Purchasing and System Admin without the Sales department get 403.
One policy table: `backend/src/sales/policy.ts`; see [SALES_ORDER.md](SALES_ORDER.md).

**EP32 note.** Five new codes, all BRANCH-scoped: `warehouse.transfers.create` (OPERATE: draft,
edit, cancel a draft), `.approve` (MANAGE: post — no `post` word), `.cancel` (MANAGE: reverse a posted
transfer); `warehouse.counts.create` (OPERATE: create, start, count, review, reopen, cancel) and
`.approve` (MANAGE: post). Adjustments use the EP27 codes: `warehouse.stock_adjustment.create`
(OPERATE: draft, submit, cancel before posting) and `.approve` (MANAGE: approve = post, reject, reverse).
So Warehouse Staff create and count, Warehouse Managers post / approve / reverse, Executive reads
(`warehouse.inventory.view`) and acts on nothing, System Admin gets nothing unless assigned to
Warehouse, the owner has everything. The override CHECK lists 62 operational codes. Rule tables:
`TRANSFER_RULES`, `ADJUSTMENT_RULES`, `COUNT_RULES` in `backend/src/warehouse/policy.ts`; see
[INVENTORY_TRANSFER.md](INVENTORY_TRANSFER.md), [STOCK_ADJUSTMENT.md](STOCK_ADJUSTMENT.md),
[CYCLE_COUNT.md](CYCLE_COUNT.md).

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
| System Admin | everything (the owner / peer / self protections still apply), incl. `company.master_data.manage` (EP28) | **none** (EP45: administration is not operations; a System Admin holds no department) |
| Executive | view profile, branches, people, package | READ in every enabled department; no create / edit / approve |
| Department Manager | view profile, branches | READ + OPERATE + MANAGE in its **one** assigned department (EP45) |
| Department Staff | view profile, branches | READ + OPERATE in its **one** assigned department (no approve / manage) |
| Viewer | view profile, branches | READ in its **one** assigned department |

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

## EP39 — integration check (no permission change)

- No code, role default or persona changed. The effective permissions of every demo account
  were read from the running stack (`/company/context`) into
  [DEMO_ACCOUNT_MATRIX.md](DEMO_ACCOUNT_MATRIX.md).
- Verified end to end over HTTP:
  - Sales Staff cannot confirm or allocate;
  - Warehouse Staff cannot dispatch, approve or post finished goods, and sees no money;
  - Executive is refused every write (403) and holds only `.view` codes;
  - System Admin reaches no operational workspace;
  - Accounting reaches deposits only;
  - the legacy staff exception (DENY `warehouse.receiving.process`) holds.
- **Known v1 rule, not changed:** a department manager may decide their own department's purchase
  request (EP29: no separation-of-duties rule). It is listed as a release consideration in
  `EP39_INTEGRATION_REPORT.md`.

## EP40 — security audit (enforcement sweeps)

- **No role default or permission changed.** `backend/test/ep40-security.test.ts` sweeps the
  *real* route table (285 routes):
  - anonymous → 401;
  - a foreign Origin → 403 on all 172 state-changing routes;
  - another company's owner with this company's ids → nothing;
  - Executive → no successful write;
  - System Admin → no operational access;
  - per-department money privacy, checked with sentinel prices.
- **Working branch (EP40-02):**
  - a member's only branch stands in only when no branch was ever chosen;
  - a chosen branch an administrator has since removed answers `409 BRANCH_SELECTION_REQUIRED`
    on create (Sales, Production, Warehouse adjustments and counts), as purchase requests already
    did. It is never silently replaced.
- **Separation of duties (EP40-04, open by policy):** no module stops the originator from
  deciding their own document when they hold the approve / manage permission. It is a production
  release blocker; the EP41 proposal (`approvalPolicy`, a `SELF_APPROVAL_NOT_ALLOWED` refusal and
  an audited owner override) is in `EP40_FINDINGS_REGISTER.md`.

## EP41 — separation of duties (no permission change)

- **No role default, permission or demo persona changed.** Each consequential decision still
  needs exactly its EP40 permission.
- **Who** may use that permission is narrowed by the company's approval policy
  (`EP41_APPROVAL_POLICY.md`):

  | Decision | Permission | Under `INDEPENDENT_APPROVAL` the decider must not be |
  | --- | --- | --- |
  | Purchase request approve | `purchasing.requests.approve` / `<dept>.purchase_requests.approve` | the requester |
  | Purchase order issue | `purchasing.orders.approve` | the creator |
  | Sales order confirm | `sales.orders.approve` | the creator or submitter |
  | Stock adjustment approve | `warehouse.stock_adjustment.approve` | the creator or submitter |
  | Cycle count post | `warehouse.counts.approve` | the creator, starter or any counter |
  | Production order approve | `operations.orders.approve` | the creator or submitter |
  | Material issue post | `operations.material_issues.approve` | the creator |
  | Output accept | `operations.output.approve` | the creator or submitter |
  | Finished goods receipt post | `warehouse.finished_goods.confirm` | the creator |

- **Refusal order** (the check runs after permission, branch and status):
  - `403` permission / `404` other branch or company — as before;
  - `409 SELF_APPROVAL_NOT_ALLOWED` — the decider is an originator;
  - with `ownerOverride`: `403 OVERRIDE_NOT_ALLOWED` for a non-owner, `400 OVERRIDE_NOT_NEEDED`
    when nothing needs overriding.
- **Policy setting:** only `COMPANY_OWNER` may change `approvalPolicy` (`PATCH
  /company/current/settings`; anyone else gets `403 OWNER_ONLY`). `company.settings.manage` still
  covers the time zone and language.
- **Regression:**
  - the EP40 285-route sweep (`ep40-security.test.ts`) passes unchanged;
  - `ep41-controls.test.ts` covers the matrix with the real personas;
  - Warehouse money privacy and cross-branch isolation pass in the real-stack E2E
    (`EP41_FINAL_REPORT.md`).

## EP45 — single department (supersedes the "unless assigned" notes above)

- **One department per regular employee per company.** A Department Manager, Department Staff member or Viewer
  holds zero or one department assignment (database unique index); zero = no operational access. The resolver
  grants codes of that one department only — role defaults and ALLOW exceptions included. Two rows (impossible in
  the database) resolve to **no** operational access (`DEPARTMENT_AMBIGUOUS`).
- **System Admin:** administration only. The earlier notes that a System Admin "gets nothing unless assigned"
  (EP30–EP38) no longer apply: a System Admin cannot be assigned (`ROLE_TAKES_NO_DEPARTMENT`, database trigger) and
  holds no operational code.
- **Owner / Executive:** unchanged (Owner every tier under every control; Executive READ everywhere). Neither holds an
  assignment.
- **ALLOW precedence fix:** an ALLOW that cannot apply (outside the person's department) no longer removes a code the
  role already gives without an assignment (an Executive's READ).
- No permission code, role tier or catalog entry changed; the override CHECK still lists the same codes.
- Policy: [EP45_DEPARTMENT_POLICY.md](EP45_DEPARTMENT_POLICY.md) · audit: [EP45_AUTHORIZATION_AUDIT.md](EP45_AUTHORIZATION_AUDIT.md) ·
  tests: [EP45_SECURITY_TEST_MATRIX.md](EP45_SECURITY_TEST_MATRIX.md).

## EP46 — confidential recipes

- New code **`operations.recipes.view`** (OPERATIONS, COMPANY scope, READ tier, **confidential**). Confidential codes are a
  role default only for the Company Owner and a Department Manager of the department; Staff / Viewers need an explicit
  ALLOW; the Executive's cross-department READ never includes them. Override CHECK: **82** codes.
- `operations.bom.view` now means the BOM **catalogue identity** (code, revision, item, status). Recipe lines, output basis,
  previews and BOM-derived quantities of unreleased orders need `operations.recipes.view`; BOM changes need
  `operations.bom.manage` **and** `operations.recipes.view`.
- Company setting `manufacturingMode` (BOM required / optional) — owner only (`OWNER_ONLY`), like the approval policy.
- Matrix and projections: [EP46_RECIPE_CONFIDENTIALITY_MATRIX.md](EP46_RECIPE_CONFIDENTIALITY_MATRIX.md); policy:
  [EP46_MANUFACTURING_POLICY.md](EP46_MANUFACTURING_POLICY.md).
