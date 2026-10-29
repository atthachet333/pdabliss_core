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
| Sales | `sales.demo` | Department Staff | Sales | Head Office `00000` | Sales Coordinator |
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
