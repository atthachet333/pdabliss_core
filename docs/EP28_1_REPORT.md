# EP28.1 — Department Demo Personas & Seed Expansion

**Status:** completed locally, awaiting owner review. **Not pushed. EP29 not started.**
Persona reference: [DEMO_PERSONAS.md](DEMO_PERSONAS.md).

## Baseline

`main` at `571f807` (EP28), clean. No schema change in this episode.

## What changed

- **One persona definition** — `backend/src/demo/personas.ts`: nine personas (the four EP23
  accounts, five department personas) with address, name, job title, role, departments, branch
  scope, purpose and, for one persona only, a permission exception. The seed, the bypass
  allowlist and the development persona list all read it.
- **Seed** (`src/auth/bootstrap.ts`): personas applied once per membership, marked by one
  `DEMO_PERSONA_APPLIED` audit entry; later administrator changes are never undone; accounts from
  earlier seeds are completed only where nothing was decided; the role is never changed after
  creation (the EP23 seed used to restore it). Department personas are seeded when their
  `DEMO_*_PASSWORD` is set (skipped with a message otherwise); the four EP23 passwords stay required.
- **Bypass** (`src/auth/demo-bypass.ts`): allowlist = the persona addresses; now also requires an
  ACTIVE membership. Production unchanged (refused whatever `ENABLE_DEMO_ROUTES` says).
- **`GET /api/v1/demo/personas`**: addresses and labels, registered only where the bypass exists.
- **Sign-in page**: a development-only persona list (fills the email, focuses the password; never a
  password), loaded only in development builds — none of its code is in a production build.
- **Activity label** for `DEMO_PERSONA_APPLIED` in TH / EN / ZH.
- `.env.example`: five empty `DEMO_*_PASSWORD` keys. Docs: DEMO_PERSONAS.md, this report, README,
  FRONTEND_BACKEND_HANDOFF.md, AUTHENTICATION.md, COMPANY_SUBSCRIPTION.md.

## Persona matrix (verified on the real stack)

| Persona | Role | Departments | Branches | Company Admin | Master Data view | Master Data manage | Operational workspaces | Expected restrictions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| owner.demo | Company Owner | (all, no assignment) | 00000 00001 | yes | all six | all six | all six | none (owner invariants) |
| admin.demo | System Admin | — | 00000 00001 | yes (below owner) | all six | all six | none | no owner changes, no platform |
| executive.demo | Executive | (reads all enabled) | 00000 00001 | read only (profile, branches, people, package) | all six | none | all six, read only | every mutation 403 |
| sales.demo | Dept. Staff | Sales | 00000 | no | customers, items, units, categories | none | Sales | suppliers, locations, other workspaces, admin refused |
| operations.demo | Dept. Manager | Operations | 00000 00001 | no | items, units, categories | items, units, categories | Operations | customers / suppliers refused |
| warehouse.demo | Dept. Staff | Warehouse | 00001 | no | items, units, categories, locations (00001) | none | Warehouse | no customers / suppliers / financial fields; HO locations refused |
| purchasing.demo | Dept. Manager | Purchasing | 00000 00001 | no | suppliers, items, units, categories | suppliers | Purchasing | items / customers / people / permissions management refused |
| accounting.demo | Dept. Manager | Accounting | 00000 | no | customers, suppliers | none | Accounting | items, locations, Warehouse refused |
| staff.demo (legacy) | Dept. Staff | Warehouse | 00001 | no | as Warehouse | none | Warehouse | + DENY `warehouse.receiving.process` |

Single-branch personas (Sales, Warehouse, Accounting, Staff) enter their branch automatically;
Operations and Purchasing get the branch selector (EP26).

## Gates

| Gate | Result |
| --- | --- |
| Backend Prisma validate · typecheck · lint · format · build | pass |
| Backend tests | **310 / 310** (21 files; 13 new in `demo-personas.test.ts`; `auth-demo-bypass.test.ts` now covers all nine personas and the production persona list) |
| Frontend typecheck · lint · format | pass |
| Frontend tests | **1030 / 1030** (45 files; 11 new in `dev-personas.test.tsx`: picker shown / hidden / keyboard, eight persona menus and CORE department lists) |
| Build + prerender + verify | 108 pages + 3 shells |
| Perf | initial JS 183.3 / 205 gzip, largest route 63.8 / 72, **all JS 4,259.7 / 4,300 KiB (+0.3 vs EP28)**, static HTML 537.7 / 560 (unchanged); caps unchanged |
| Production bundle | no file contains the persona list code or `demo/personas` |

## Seed proof (scratch database, dropped afterwards)

- Run 1 → run 2: users 11, members 9, department assignments 6, branch grants 8, exceptions 1,
  units 3, categories 2, items 3, customers 1, suppliers 1, locations 3, audit entries 26,
  persona markers 9 — **identical**; every persona reports `unchanged`.
- Admin changes then a third seed: owner widened `warehouse.demo` to all branches and gave
  `sales.demo` Sales + Warehouse → **both survived**.
- Tests also cover: a removed exception, a changed job title and changed departments survive; a
  pre-EP28.1 account is completed only where undecided (branch decision kept); a department
  persona without a password is skipped while a missing EP23 password still stops the seed.

## Real-stack QA (temporary API :1212 + Vite :1211 → scratch PostgreSQL)

**26 / 26 checks.** Every persona signed in through the bypass; departments, branches, automatic
selection vs. selector, Company Admin, Master Data view / manage matched the matrix; one forbidden
direct call per persona was refused (platform for owner / admin, customer create for Executive and
Operations, supplier create for Sales, suppliers for Warehouse, department change for Purchasing,
location create for Accounting, receiving for legacy staff). Warehouse: no financial key and no
customer / supplier code in any payload, Demo Branch locations only, customers 403. The persona
list returned nine entries with no secret. People page: all nine with job titles.

Browser (in-app Chromium, development build): persona list under the form at 1440 / 768 / 390,
no overflow, 44 px buttons, keyboard Tab → visible focus → Enter fills the email and focuses the
password; signed in as Warehouse → CORE lists Warehouse only in Demo Branch. (In that QA database
the owner had widened Warehouse to all branches — so it saw the selector, as preserved.)

## Regression

EP28 master data, EP27 permissions, EP26 branch access, auth (bypass still password-first,
verified, active, allowlisted; production unchanged), public pages (HTML unchanged in size,
login visual unchanged in production) and Platform (personas hold no platform role; the platform
accounts are untouched) — all covered by the unchanged suites plus the new ones.

## Known limitations

- The owner's existing local `backend/.env` needs the five new `DEMO_*_PASSWORD` keys before the
  department personas are seeded (until then the seed prints "skipped").
- The persona list uses English labels (developer utility).
- `staff.demo` and `warehouse.demo` share a profile by design; `staff.demo` differs by its one
  exception.
- The seed no longer restores a demo account's role (it used to); reset the scratch database to
  return to the original personas.
