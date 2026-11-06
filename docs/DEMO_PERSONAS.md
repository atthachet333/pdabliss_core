# Demo Personas (EP28.1)

**Development / demo fixtures only.** The demo company (`PDA BLISS CORE DEMO COMPANY`, `isDemo`)
has nine seeded accounts so each department can be demonstrated and tested as it really feels.
They are not customer defaults and do not exist in production.

Source of truth: `backend/src/demo/personas.ts` (one list: address, name, job title, role,
departments, branch scope, the one exception, purpose). The seed applies it, the development
sign-in bypass allowlists exactly these addresses, and the development persona list on `/login`
reads it. What each persona may do is **not** in that file: it comes from the EP27 role defaults
and resolver, given the persona's role, departments and branches.

## Personas

| Persona | Address (`@pdabliss.com`) | Role | Departments | Branches | Job title |
| --- | --- | --- | --- | --- | --- |
| Owner | `owner.demo` | Company Owner | — (owner reaches all) | all | Managing Director |
| System Admin | `admin.demo` | System Admin | — | all | IT & System Administrator |
| Executive | `executive.demo` | Executive | — (reads all enabled) | all | Executive Director |
| Sales | `sales.demo` | Department Staff | Sales | Head Office `00000` + Demo Branch `00001` (EP38.2) | Sales Coordinator |
| Operations | `operations.demo` | Department Manager | Operations | `00000` + `00001` | Operations Manager |
| Warehouse | `warehouse.demo` | Department Staff | Warehouse | Demo Branch `00001` | Warehouse Officer |
| Purchasing | `purchasing.demo` | Department Manager | Purchasing | `00000` + `00001` | Purchasing Manager |
| Accounting | `accounting.demo` | Department Manager | Accounting | `00000` | Accounting Manager |
| Staff (legacy) | `staff.demo` | Department Staff | Warehouse | `00001` | Warehouse Assistant (legacy demo) |

## What each one sees (EP27 defaults, verified on the real stack)

| Persona | Company administration | Master Data (view / manage) | CORE workspaces | Notable restrictions |
| --- | --- | --- | --- | --- |
| Owner | everything | all six / all six | all six | none (owner invariants) |
| System Admin | everything except owner powers | all six / all six (`company.master_data.manage`) | none (not assigned — administration is not operations) | cannot change the owner; no platform authority |
| Executive | read: profile, branches, people, package | all six / none | all six, read only | every create / edit / approve refused |
| Sales | profile, branches (read) | customers, items, units, categories / none | Sales | no suppliers, locations, Purchasing, Warehouse, Accounting, administration |
| Operations | profile, branches (read) | items, units, categories / items, units, categories | Operations | no customers or suppliers; must choose between two branches |
| Warehouse | profile, branches (read) | items, units, categories, locations (`00001`) / none | Warehouse | **privacy persona**: no customers, suppliers, cost, price, margin or terms in any response; Head Office locations refused |
| Purchasing | profile, branches (read) | suppliers, items, units, categories / suppliers | Purchasing | cannot manage items, customers, people or permissions — the EP29 purchase-request persona |
| Accounting | profile, branches (read) | customers, suppliers / none | Accounting | no items, locations, Warehouse actions; no bookkeeping records exist yet |
| Staff (legacy) | profile, branches (read) | as Warehouse | Warehouse | carries the **one** seeded exception: DENY `warehouse.receiving.process` |

`/company/users` shows each persona by name, job title, role, departments and branch scope;
`/company/permissions` explains every difference through the normal resolver — nothing in the
screens is demo-specific.

`staff.demo` is kept for backward compatibility (EP23–EP27 docs and tests use it). It is the
Warehouse staff profile plus one exception, so the exception screens have something real to show;
`warehouse.demo` is the clean Warehouse persona.

## Signing in (development)

- Passwords: only in your local `backend/.env` — `DEMO_COMPANY_OWNER_PASSWORD`,
  `DEMO_SYSTEM_ADMIN_PASSWORD`, `DEMO_EXECUTIVE_PASSWORD`, `DEMO_STAFF_PASSWORD` (required by the
  demo seed) and `DEMO_SALES_PASSWORD`, `DEMO_OPERATIONS_PASSWORD`, `DEMO_WAREHOUSE_PASSWORD`,
  `DEMO_PURCHASING_PASSWORD`, `DEMO_ACCOUNTING_PASSWORD` (a department persona is skipped, and the
  seed says so, until its password is set). Nothing is committed; `.env.example` leaves them empty.
- **Bypass** (no emailed code) applies only when ALL hold: `NODE_ENV` is not `production`;
  `ENABLE_DEMO_ROUTES=true`; the address is exactly one of the nine; the password is correct; the
  account is verified and ACTIVE with no platform role; and its membership of the demo company is
  ACTIVE. `NODE_ENV=production` with `ENABLE_DEMO_ROUTES=true` still has no bypass (tested).
- **Persona list on `/login`**: only in a development build (`import.meta.env.DEV`; a production
  build contains no code for it) and only when the API answers `GET /api/v1/demo/personas`, which
  exists only where the bypass does. Choosing a persona fills the **email** and moves focus to the
  password; it never knows a password. English labels — a developer utility.

## Seed safety

- `npm --prefix backend run db:seed:demo` is idempotent: running it again creates no user,
  membership, department assignment, branch grant, exception or master record.
- A persona is applied **once**. The marker is one `DEMO_PERSONA_APPLIED` audit entry on the
  membership (shown in Activity as "Demo persona set up"). After it, the seed never changes that
  membership again — an administrator's later change of role, departments, branch access, job
  title or exceptions stands.
- Accounts from earlier seeds (no marker yet) are completed only where nothing was decided: a
  missing job title, no departments at all, branch access never changed (EP26 audit), no
  exceptions. The role is never changed by a later seed.
- Passwords are set when an account is created and never reset by a normal seed run.
- No schema change: personas are ordinary users, memberships, assignments, branch grants and one
  exception. Demo-ness stays in the fixture (`Company.isDemo`, the persona file).

## EP38.2 — Sales demo branch alignment

All demo stock lives in the demo branch `00001`, where `warehouse.demo` works. `sales.demo` therefore
also has `00001`, so its orders can be allocated and fulfilled by Warehouse Staff.

- **What stays the same:**
  - Head Office access;
  - role Department Staff, the Sales department only, no exception;
  - confirm, allocate, dispatch and delivery stay Manager actions;
  - `warehouse.demo` (`00001`) and `accounting.demo` (`00000`) are unchanged.
- **Branch choice is explicit.** With two branches, CORE asks for a working branch first. An order
  is created in the working branch, and the server refuses with `BRANCH_SELECTION_REQUIRED` when
  none is chosen; nothing is assigned silently. The new-order screen states
  "Branch: <code> · <name>" and offers **Change branch**.
- **Fresh databases** get both branches from the seed.
- **Existing local databases** — a persona is applied once and later changes are never overwritten
  (above) — need a one-time refresh through the supported Company Control Center:
  1. Sign in as `owner.demo`.
  2. Open Company → Users → Demo Sales → Branch access, and keep **Selected branches**.
  3. Tick `00000` and `00001`, then save. This records `MEMBER_BRANCH_ACCESS_CHANGED` and clears
     a stale session branch.

  Equivalent API, as the owner: `PUT /api/v1/company/current/members/:id/branches`
  `{ "branchScope": "SELECTED_BRANCHES", "branchIds": [<00000>, <00001>] }`. A later
  `npm run db:seed:demo` leaves it as it is.
- **Demo flow:**
  1. `sales.demo` chooses `00001`, then creates and submits an order.
  2. `owner.demo` confirms and allocates.
  3. `warehouse.demo` picks, packs and prepares the shipment.
  4. `owner.demo` dispatches and records delivery.
  5. `sales.demo` sees "delivered".

## EP39 — Complete demo data and cross-department readiness

**No persona changed.** The nine accounts keep their roles, departments, branches and the one
exception (`sales.demo` still has `00000` + `00001` as Sales Staff; `warehouse.demo` still only
`00001`). The effective permissions, read from the running stack, are in
[DEMO_ACCOUNT_MATRIX.md](DEMO_ACCOUNT_MATRIX.md).

**What the seed adds** (`backend/src/demo/integration-demo.ts`, after every earlier fixture; data in
[DEMO_DATA_CATALOG.md](DEMO_DATA_CATALOG.md)):

- **Master data:** five items (two finished goods, two raw materials — one in litres — and
  bottles), two customers, two suppliers, the unit `L`, a packaging category.
- **A chain through the real services**, each persona acting in its own permissions:
  1. An Operations purchase request, approved by Purchasing.
  2. Two purchase orders: one received in full in two FEFO lots by Warehouse, one still awaiting
     the supplier.
  3. BOMs, and a production order short-closed with variance and partial output.
  4. That output received into stock and sold, delivered end to end.
  5. Sales orders in draft and submitted.
  6. A confirmed sales demand with no stock, planned as a production order that now waits on a
     material for Purchasing.

**Seed safety (EP39 additions):**

- Every fixture carries a stable `demo` key on its CREATED audit entry and runs once, as all
  earlier ones. To support this, the purchase-request, purchase-order, receiving and sales-order
  services accept the audit scope (`seed`) and extra CREATED details. Route handlers never pass
  them.
- Classification: `STATIC_DEMO_FIXTURE` (seed, `demo` key), `USER_CREATED_DEMO_RECORD` (no key —
  never touched) and `INTEGRATION_QA_RECORD` (only in disposable QA databases).
- Proven additive: on a restored copy of the development database, every one of its 747 rows
  stayed byte-identical except the document / code counters (which move forward). A second seed
  changes nothing at all (row-level and per-table hashes).
- Two consecutive seeds on a fresh database: 0 of 70 tables differ.
- A persona an administrator has since taken out of the demo branch is never moved elsewhere:
  its not-yet-created EP39 fixtures are skipped and the seed says so
  (`integration …, skipped <fixture> (BRANCH_NOT_ALLOWED)`). A business refusal in the middle of
  a chain leaves the documents already made, in valid states, and is never forced.

**Updating an existing development database:** take a backup first (`pg_dump -Fc`), then run
`npm --prefix backend run db:seed:demo` once. It reports `master data created 11, … integration
created 12` the first time and `unchanged` afterwards. No reset, no deletion, no migration
(EP39 has no schema change).
