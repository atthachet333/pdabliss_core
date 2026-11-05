# EP38.1 — Local Demo Runtime Recovery Report

**Verdict: PASS.** Baseline `4c2ac01` (EP38), equal to `origin/main`. This episode repaired the
**local development database**; no application code changed. The only repository change is this
report and one test-robustness fix (§7). Not pushed, not deployed, EP39 not started.

## 1. Root cause of the Sales 500

The local development database `pdabliss_core_dev` had **only the first 9 of 24 migrations**
(through EP28). The 15 committed migrations EP29 → EP38 were never applied. The code was EP38, so
every module added since EP29 queried tables that did not exist:

- `GET /api/v1/sales/context` → `PrismaClientKnownRequestError P2021` (`public.SalesOrder` missing)
  → 500 `INTERNAL_ERROR`;
- `GET /api/v1/purchase-requests` (Purchase Requisition list) → same cause (`PurchaseRequest`
  missing). The create form rendered because it needs only master data, which existed since EP28.

Company context and master data worked because their tables predate EP29. Nothing was wrong in the
code, the permissions or the frontend. The fix was the missing schema plus the demo fixtures that
come with it.

## 2. Database target verification

| Check | Result |
| --- | --- |
| Target read from `backend/.env` (credentials never printed) | `localhost:5432`, database `pdabliss_core_dev`, schema `public` |
| Backend server connection | the same file (`process.loadEnvFile('.env')` in `src/config`) |
| Prisma CLI connection | `prisma.config.ts` loads the same `.env`; `migrate status` reported the same datasource |
| Local development, not shared or production | `NODE_ENV=development`, `HOST=127.0.0.1`, `PORT=1112`, local PostgreSQL 18 service |
| Migration history before | 9 applied, 0 unfinished, 0 rolled back; no EP29+ table present (nothing partially applied) |
| Data before | 1 company, 11 users, 9 members, 2 branches, 3 items, 1 customer, 30 audit rows (31 tables, 11 MB) |
| Disk / tooling | C: 267 GB free; `pg_dump` / `pg_restore` 18 |

## 3. Backup

- **What:** a custom-format `pg_dump` of `pdabliss_core_dev`, taken before any change.
- **Where:** stored **outside the repository** at
  `C:\Users\User\pdabliss_backups\pdabliss_core_dev-before-EP38_1-20261105-134305.dump`
  (126 KB, 32 table-data entries).
- **Verified:** restored into a separate scratch database (`pdabliss_core_backupcheck`); row
  counts were identical for all 32 tables.
- **Restore if ever needed:** create an empty database, then
  `pg_restore -d <empty database> --no-owner <file>`.

## 4. Migration

**How it was applied:**

- Command: `npx prisma migrate deploy`, the committed migrations only. No `migrate dev`, `db push`,
  reset, drop, truncate or hand-written SQL.
- Applied: the 15 migrations from `20261101090000_ep29_purchase_request` to
  `20261110090100_ep38_output_completion`.
- Status after: 24 / 24 applied, "Database schema is up to date"; `migrate diff` against the
  schema showed no difference.

**What it changed:**

- 71 tables now (was 32). All 17 module tables checked are present: Sales, PR, PO, GR, stock,
  transfer, adjustment, count, allocation, pick, shipment, BOM, order, material issue, output and
  finished goods receipt.
- Existing data is preserved: per-table content hashes of all 31 pre-existing tables were
  **identical** before and after the migration.

**Runtime:**

- The Prisma Client already matched the EP38 schema; it was regenerated with no change, and the
  backend typecheck passes.
- The CORE backend already running on 1112 needed **no restart**. `GET /api/v1/sales/context` now
  answers 200 (Sales Staff and Owner) and 403 for roles without Sales — no P2021.

## 5. Demo seed

The existing seed (`npm run db:seed:demo`, the real services, idempotent) was used; no second seed
system was created.

1. **Rehearsal first** on the restored copy:
   - Seed 1 created the EP29–EP38 fixtures (6 purchase requests, 5 purchase orders, 3 goods
     receipts, inventory control, 16 sales documents, fulfilment, production) and changed **only**
     `AuditLog` among the existing tables.
   - Seed 2 changed nothing across all 70 tables.
2. **Then the dev database**, with the same result:
   - Seed 1 created the fixtures. "Demo company / Head Office / branch / subscription / master
     data: unchanged" — no company or user was recreated, and passwords were not reset
     (`BOOTSTRAP_RESET_PASSWORDS=false`).
   - Seed 2 was a **no-op across all 70 tables**.
   - Row changes in `Session`, `AuthAuditEvent` and `User` (last sign-in) came from my own API
     sign-ins during verification, not from the seed.
3. **Ledger on dev:**
   - 0 balance / movement mismatches, 0 negative balances, 0 over-reserved;
   - 21 movements, 10 sales orders, 6 PRs, 8 production orders.

**Fixtures vs. actions left for you:** the seed leaves real work to do —

- draft and submitted sales orders, submitted PRs;
- a draft and a submitted production order;
- a draft material issue;
- a submitted output report waiting for its quality decision;
- accepted output waiting for a Warehouse receipt.

Nothing is pre-completed beyond one example per lifecycle.

## 6. Personas — real accounts, real permissions

**Read audit (dev backend, GET only):** every persona × 23 module endpoints.

- No 5xx anywhere.
- 403 exactly where the role design says so.
- Server action flags were checked:

| Persona | Role / departments / branches | Verified |
| --- | --- | --- |
| Owner | Owner, all six, all branches | every list 200; all actions, subject to the domain rules |
| `sales.demo` | Staff, Sales, Head Office `00000` | Sales context and orders 200; `create` true, `confirm` false; no Warehouse / Production |
| `warehouse.demo` | Staff, Warehouse, `00001` | stock, transfers, adjustments, counts, pick and finished goods 200; may draft and pick; no approve, post, dispatch or deliver |
| `purchasing.demo` | Manager, Purchasing, both branches | PR / PO lists, production shortages 200; no Sales / Warehouse / Production |
| `operations.demo` | Manager, Operations, both branches | production context, orders, BOMs, issues, outputs 200; full Manager execution flags |
| `executive.demo` | Executive, read only | all lists 200; every create / approve flag false |
| `admin.demo` | System Admin | master-data reads only; every operational module 403 |
| `accounting.demo` | Manager, Accounting, `00000` | no operational modules (bookkeeping does not exist yet) |

**Workflow run** (real HTTP, real services, **39 / 39**) on the **disposable mirror**
(`pdabliss_core_backupcheck`, ports 2111 / 2112), so consequential stock actions never touched
your dev data.

- **Sales, as `sales.demo`:**
  - customer and item search;
  - draft with quantity, price and VAT (server totals, no stock moved);
  - header and line edit (persists on reload);
  - submit;
  - refused confirm and allocate (403).
- **Owner on that Head Office order:** confirm, then allocate. The allocation answers correctly
  but reserves 0 (see §8).
- **Branch 00001 path:**
  1. Owner sells, confirms and allocates 3 FEFO.
  2. `warehouse.demo` sees it in Pending Pick with no prices, then picks, packs and creates the
     shipment; dispatch and delivery are refused (403).
  3. Owner dispatches (SALES_ISSUE through the ledger) and records delivery.
  4. Progress is visible; the shipment view has no money; `sales.demo` cannot open the
     branch-00001 order (404).
- **Purchasing, as `purchasing.demo`:** PR list (seeded), item options, create a PR with an item
  line, add a non-item line, submit; PO list. Sales Staff gets 403 on POs.
- **Warehouse Staff:** transfer draft (posting 403), adjustment submitted (approval 403), cycle
  count created and cancelled; no movement from drafts.
- **Production:**
  1. `operations.demo` accepts submitted output.
  2. `warehouse.demo` sees it pending with no money, drafts the finished goods receipt, and is
     refused posting (403).
  3. Owner posts it (PRODUCTION_OUTPUT).
- **Denials and safety:** Executive cannot create or cancel; System Admin gets 403 on Sales,
  Warehouse and Production; unknown ids 404; mass assignment 400. Ledger reconciliation was 0
  after each section.

**Browser, on your real dev site** (`localhost:1111` → `localhost:1112`, read only):

| Page | Persona | What showed |
| --- | --- | --- |
| `/core/sales` | `sales.demo` | renders with real seeded orders, counts and **Create sales order**; no error |
| `/core/purchasing/requests` | `purchasing.demo` | renders the seeded PR list with **Create purchase request** |
| `/core/production` | `operations.demo` | live counts |
| `/core/warehouse/finished-goods` | `warehouse.demo` | pending output, no money |
| `/core/sales` | `executive.demo` | read only (no create action) |
| `/core/warehouse` | Owner | all 14 sections |

## 7. Gates

| Gate | Result |
| --- | --- |
| Prisma validate · migrate status · drift | valid · 24 / 24 · none |
| Backend typecheck | pass |
| Backend tests | **31 files, 483 tests passed** |
| Frontend tests | **58 files, 1,114 tests passed** (`--maxWorkers=2`, final run) |
| Frontend lint · format · typecheck | 0 problems · clean · pass |
| Application code changed in EP38.1 | none (EP38 lint / format / build / prerender / perf gates still hold: all JS 4,225.6 / 4,300 KiB, initial 182.6 / 205 KiB gzip, HTML 528 / 560 KiB) |
| Test fix | Under machine load, the robots-meta checks in `auth.test.tsx` / `login.test.tsx` read the tag synchronously, but `usePageMeta` adds it in an effect after render — they failed intermittently (unchanged EP23 / EP24 tests; they passed alone). The assertions now wait for the tag with `waitFor` (test-only, no product change). Earlier full runs on the busy machine also showed `findBy` timeouts in `company-center.test.tsx` (passed 14 / 14 three times alone); the final full run was clean. Seven leftover headless Edge / Chrome processes from my own earlier browser QA were stopped |
| Secret scan (report + test diff) | clean: no connection string, password or session value |

## 8. Remaining demo limitations (by design, not changed)

- **Sales Staff works in Head Office; Warehouse Staff works in branch 00001; all demo stock is in
  `00001`** (EP28.1 persona design, `docs/DEMO_PERSONAS.md`). So an order `sales.demo` creates can
  be confirmed but **not allocated** (no Head Office stock), and Warehouse Staff never sees Head
  Office orders. The persona design was preserved, and no branch access was widened. To demo the
  full chain with personas, sell from branch `00001` as the Owner (steps below). Giving
  `sales.demo` access to `00001`, or seeding Head Office stock, is a product decision for you.
- **Posting, dispatch, delivery and approvals are Manager actions.** The Warehouse, Sales and
  Production personas that hold them are the Owner and `operations.demo`; there is no Warehouse
  Manager or Sales Manager persona.
- Accounting has no bookkeeping screens yet. Firefox / axe are not installed here.

## 9. Repeat it yourself on `localhost:1111`

1. **Sales Staff** — sign in as `sales.demo` → CORE → Sales → **Create sales order** → choose the
   demo customer → add `FG-000001`, quantity, price, VAT → Save → edit → **Submit**.
2. **Owner** — sign in as `owner.demo` → choose branch `00001` → Sales → open the submitted
   order, or create one in `00001` → **Confirm** → **Allocate**.
3. **Warehouse Staff** — sign in as `warehouse.demo` → Warehouse → Pending pick → create the pick
   → confirm the picked quantities → Packs → create and confirm → Shipments → create.
4. **Owner** — Warehouse → Shipments → **Dispatch** (stock leaves) → **Record delivery**.
5. **Production** — sign in as `operations.demo`:
   - Production → Output & completion → open the submitted report → **Accept output**.
   - Then as `warehouse.demo`: Warehouse → Finished goods → **Create receipt** (lot / expiry as
     asked).
   - Then as the Owner: **Post receipt** (stock grows).
6. **Purchasing** — sign in as `purchasing.demo` → Purchasing → Requests → **Create purchase
   request** → add a line → Submit.

## 10. Starting the demo from a clean development setup

```bash
cd backend
npm install
npm run db:status        # what is applied
npm run db:migrate       # prisma migrate deploy: committed migrations only
npm run db:generate      # Prisma Client for the checked-out schema
npm run db:seed:demo     # idempotent; a second run changes nothing
npm run dev              # CORE API on http://127.0.0.1:1112
```

```bash
cd frontend
npm install
npm run dev              # http://localhost:1111
```

After pulling a new episode, always run `npm run db:status`. Then take a backup, run
`npm run db:migrate`, then `npm run db:seed:demo`. A backend error with Prisma code **P2021**
("table does not exist") means a migration has not been applied, not a code defect.
