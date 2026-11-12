# Demo Account Matrix (EP39)

**Development / demo only.** The demo company `PDA BLISS CORE DEMO COMPANY` (`isDemo`) has
**nine** seeded accounts. They are defined in one place, `backend/src/demo/personas.ts`. What
each one may do is **not** in that file: it comes from the EP27 role defaults and resolver, given
the persona's role, departments and branches. Nothing was elevated for the demo.

The matrix below was read from the running stack (`GET /api/v1/company/context` for each
persona on a freshly seeded database, EP39), not copied from documentation.

Branches: `00000` Head Office · `00001` Demo Branch (all demo stock lives in `00001`).

## Identity, scope and landing

| Account (`@pdabliss.com`) | Department | Role tier | Branches | Working branch at sign-in | Lands on |
| --- | --- | --- | --- | --- | --- |
| `owner.demo` | all (owner) | Company Owner | all (`00000`, `00001`) | chosen: CORE asks first | Company Control Center → Enter CORE |
| `admin.demo` | — (administration) | System Admin | all | — (no operational department) | Company Control Center |
| `executive.demo` | all enabled, read only | Executive | all | chosen: CORE asks first | CORE (branch choice) |
| `sales.demo` | Sales | Department Staff | `00000` + `00001` | chosen: CORE asks first | CORE (branch choice) |
| `purchasing.demo` | Purchasing | Department Manager | `00000` + `00001` | chosen: CORE asks first | CORE (branch choice) |
| `operations.demo` | Operations | Department Manager | `00000` + `00001` | chosen: CORE asks first | CORE (branch choice) |
| `warehouse.demo` | Warehouse | Department Staff | `00001` | `00001` (only one) | CORE home |
| `accounting.demo` | Accounting | Department Manager | `00000` | `00000` (only one) | CORE home |
| `staff.demo` (legacy) | Warehouse | Department Staff + 1 exception | `00001` | `00001` | CORE home |

With two or more branches, nothing is assigned silently: CORE asks for the working branch
(`BRANCH_SELECTION_REQUIRED` on the server until one is chosen), then returns to the page that
was asked for (EP38.4).

## What each account can do

| Account | Visible CORE workspaces | Create / process | Approve / manage | Explicitly forbidden (server-refused) |
| --- | --- | --- | --- | --- |
| `owner.demo` | all six | every create / process action | every approve / manage action, all administration | owner invariants only (cannot remove the last owner) |
| `admin.demo` | none | company profile | branches, members, departments, permissions, settings, master data | every operational workspace and action (not assigned to a department) |
| `executive.demo` | all six, read only | — | — | every create, edit, approve, cancel, post (33 `.view` codes only) |
| `sales.demo` | Sales | sales orders (create / edit / submit), purchase requests for Sales | — | confirm, allocate, release, cancel a confirmed order; Warehouse, Purchasing, Production, suppliers, locations |
| `purchasing.demo` | Purchasing | purchase requests, purchase orders | approve / cancel requests (any department), approve / cancel orders, manage suppliers | items, customers, people, permissions; Warehouse actions; production changes |
| `operations.demo` | Operations | production orders, material issues (draft), usage, output reports, purchase requests for Operations | approve / release / execute / complete production orders, BOMs, material reservations, post material issues, approve output, manage items | customers, suppliers; posting finished goods receipts; Sales and Purchasing documents |
| `warehouse.demo` | Warehouse | goods receipts (create + post), transfers, adjustments, counts (draft / count / submit), picks, packs, shipments (prepare), finished-goods receipts (draft), purchase requests for Warehouse | — | approve transfers / adjustments / counts, dispatch, delivery, post finished-goods receipts, any price / cost / customer / supplier |
| `accounting.demo` | Accounting | purchase requests for Accounting | confirm / waive supplier deposits, approve Accounting requests | Warehouse, Production and Sales actions; items and locations |
| `staff.demo` | Warehouse | as `warehouse.demo` **minus receiving** | — | `warehouse.receiving.process` (the one seeded DENY exception) |

## Intended demo workflow per account

| Account | Workflow it demonstrates |
| --- | --- |
| `owner.demo` | Manager steps the staff personas cannot take: confirm and allocate sales orders, dispatch and deliver shipments, approve warehouse transfers / adjustments / counts, post finished-goods receipts. |
| `admin.demo` | Company administration only: users, branch access, permission exceptions, master data. Shows that administration is not operations. |
| `executive.demo` | Reads every department's real status (orders, stock, production, purchasing) and can change nothing. |
| `sales.demo` | Chooses `00001`, drafts and submits sales orders for stocked serum (FG-000002), follows a delivered order and a shortage. |
| `purchasing.demo` | Approves requests from other departments, places and issues purchase orders, reads production material shortages (read-only handoff). |
| `operations.demo` | Plans production from BOMs, reserves and issues materials, records usage and output, short-closes or completes orders; raises material purchase requests. |
| `warehouse.demo` | Receives the awaited purchase order, works Pending Pick → pick → pack → shipment, drafts finished-goods receipts — without ever seeing money. |
| `accounting.demo` | Reads and confirms the Head Office supplier deposit (the only payment-related workflow CORE has). |
| `staff.demo` | Exception screens: the same Warehouse profile with receiving denied. |

Not represented by any account (by design): a Sales **Manager**, a Warehouse **Manager**. Their
steps are the owner's in the demo; adding such personas would change the persona list, which is
a product decision (see `docs/EP39_INTEGRATION_REPORT.md` → limitations).

Detailed, click-by-click test steps: `docs/DEMO_WORKFLOW_GUIDE.md`. Data: `docs/DEMO_DATA_CATALOG.md`.

## EP45 — department identity (re-verified on a disposable stack)

| Account | `assignment.status` | Department |
| --- | --- | --- |
| `owner.demo` | `CROSS_DEPARTMENT` | — (all, by role) |
| `admin.demo` | `ADMINISTRATIVE` | — (cannot be assigned) |
| `executive.demo` | `OVERSIGHT` | — (all, read only) |
| `sales.demo` | `ASSIGNED` | Sales |
| `operations.demo` | `ASSIGNED` | Operations |
| `warehouse.demo` | `ASSIGNED` | Warehouse |
| `purchasing.demo` | `ASSIGNED` | Purchasing |
| `accounting.demo` | `ASSIGNED` | Accounting |
| `staff.demo` | `ASSIGNED` | Warehouse (+ the receiving DENY exception) |

No persona's effective permissions changed. CORE shows "Department: …" next to the branch and role.
