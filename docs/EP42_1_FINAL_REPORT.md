# EP42.1 — Final Internal Demo Preparation & UAT Readiness — Final Report

**Baseline:** `aef2ff4` (EP41) on `main`, clean; `main` = `origin/main` (`aef2ff4`); EP41 verified as
the HEAD ancestor. **Result:** one local commit. Not pushed, not deployed. EP42.2 not started.
**Human UAT has not been performed** — this episode prepares it.

**Verdict: PASS (ready for owner UAT in EP42.2).** Every EP42.1 gate passed; no demo-blocking P0 / P1
was found. Two small P2 / P3 usability defects were fixed. Product-direction gaps are recorded,
not hidden, in [EP42_1_PRODUCT_GAP_MATRIX.md](EP42_1_PRODUCT_GAP_MATRIX.md); two of them are P1
**for the product direction** (production requires a BOM; one-department-per-employee is not
enforced) but neither blocks the internal demo.

Deliverables:
- [EP42_1_DEMO_USER_GUIDE.md](EP42_1_DEMO_USER_GUIDE.md) — Thai, for the owner
- [EP42_1_UAT_CHECKLIST.md](EP42_1_UAT_CHECKLIST.md) — Thai, 87 cases in hand-off order, none pre-marked
- [EP42_1_PRODUCT_GAP_MATRIX.md](EP42_1_PRODUCT_GAP_MATRIX.md) — implemented / partial / planned

## 1. Verified baseline and environment

| Item | Finding |
| --- | --- |
| Repository / branch | `atthachet333/pdabliss_core`, `main`, clean, HEAD `aef2ff4` = `origin/main` (no local divergence) |
| Other worktree | `ep29up` (scratch, detached `2f6c696`) — not touched |
| Database server | PostgreSQL 18.6 on `localhost:5432` (service `postgresql-x64-18`) |
| Intended dev database | `pdabliss_core_dev` (from `backend/.env`): 1 company (the demo company, `isDemo`), 2 branches, 9 members, 70 tables / 898 rows, approval policy **`SELF_APPROVAL_ALLOWED`** |
| Migrations | 26 found, 26 applied, "Database schema is up to date"; `migrate diff` dev → schema: **no difference** |
| Ports 1111 / 1112 | Verified: `npm --prefix backend run dev` listens on **1112** against the dev database (`/health` ok, `environment: development`, 9 demo personas listed); Vite serves **1111** `/login` (200). Only read-only requests were made. |
| Safe QA alternative | All consequential work ran on **2111 / 2112** against scratch databases (below). The desktop app's preview launcher hung on `tsx watch` for the 1112 entry (the same command from a shell starts in ~2 s) — an environment quirk, not a product defect; the 1112 check was done from a shell. |

### Data safety

- `pdabliss_core_dev` backup **before anything**: `C:/Users/User/pdabliss_backups/pdabliss_core_dev-before-EP42_1-20261110-092407.dump`
  (512,229 bytes, 71 table-data entries), restored into `pdabliss_core_devcopy421`, which matched
  dev **row for row** (0 changed / removed / added of 898).
- `pdabliss_core_dev` was **only read** (introspection, read-only transactions, `pg_dump`). A row
  snapshot taken at the start and re-checked twice later: **0 changed, 0 removed, 0 added**. Its
  approval policy was never changed; the nine personas and their memberships are untouched; the one
  user-created record (`PR-202611-000007`, cancelled 2026-11-04) is untouched.
- Scratch databases used for destructive work: `pdabliss_core_qa421` (fresh migrate + seed),
  `pdabliss_core_devcopy421` (restored dev copy, re-restored once), `pdabliss_core_test` (backend
  suite), `pdabliss_core_shadow421` (dropped).

## 2. Persona readiness (Phase 2)

Resolved from the live authorization service (`/company/context`, then real requests), 144 checks,
all passing:

| Persona | Role | Departments | Branches | Perms | Branch choice | Reads allowed | Refused (403) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| owner | Company Owner | all six | 00000 + 00001 | 94 | asked | every workspace, members | — |
| admin | System Admin | none | 00000 + 00001 | 13 | — | members, customers, suppliers | sales, purchasing, production, stock, pick, deposits |
| exec | Executive | all (view) | 00000 + 00001 | 33, all `.view` | asked | every workspace, members (read) | every write (E2E) |
| sales | Dept Staff | Sales | 00000 + 00001 | 9 | asked | sales orders, customers | purchasing, production, warehouse, deposits, suppliers, members |
| purchasing | Dept Manager | Purchasing | 00000 + 00001 | 16 | asked | POs, shortages, suppliers | sales, production, warehouse, deposits, customers |
| operations | Dept Manager | Operations | 00000 + 00001 | 22 | asked | production orders, BOMs | sales, purchasing, warehouse, deposits, masters |
| warehouse | Dept Staff | Warehouse | 00001 | 16 | preselected | stock, pending pick, … | sales, POs, deposits, customers, suppliers |
| accounting | Dept Manager | Accounting | 00000 | 12 | preselected | deposits, customers, suppliers (read) | sales, POs, production, warehouse |
| staff (legacy) | Dept Staff | Warehouse | 00001 | 15 | preselected | as warehouse | as warehouse **+ receiving (DENY exception)** |

- Sign-in: all nine authenticate without an e-mailed code (development bypass); a wrong password
  and a foreign `Origin` are refused.
- Branch selection: multi-branch personas are asked (nothing assigned silently); **creating work
  before choosing is refused** (`409 BRANCH_SELECTION_REQUIRED`); reads before choosing stay inside
  the member's own branches; the chosen branch persists in the session.
- Session: restored across requests and in a fresh client with the same cookie; after logout the
  cookie is refused (`401`) on `/auth/me` and on operational routes.
- Landing, menus and quick actions were read from the real UI for every persona (guide § 4).
- Executive and Owner having read access to members, and Accounting reading customers / suppliers,
  are **documented design** (`company/policy.ts`, `accounting.customers.view` /
  `accounting.suppliers.view`) — not escalations. No persona's permissions or memberships were
  changed.

## 3. Demo data readiness (Phase 3)

- The EP39 fixture set is complete on a fresh seed (master data 24, PR 6, PO 5, GR 3, inventory
  control 5, sales 16, fulfilment 4, production, integration 12) and on `pdabliss_core_dev`
  (every fixture key resolved to a document; numbers recorded in the guide).
- Every department has records and a journey (guide § 5–6). Numbers differ by database; the guide
  gives a search criterion for each.
- **Idempotency:** seed 2 on a fresh database: `unchanged` everywhere. Seed 3 **after** all
  workflow, race and UI traffic (2,832 rows): **0 changed / removed / added**. Seed on the dev
  copy: **0 changed / removed / added** of 898 — so running `db:seed:demo` on dev is safe.
- **Date-sensitive:** lot `FG-DEMO-B` (FG-000001) expires **2026-11-17** (7 days after this audit);
  after that day it is shown as expired — correct behaviour, documented in the guide. Other lots
  expire 36–361 days out. New documents in December get `-202612-` numbers. Fixtures are never
  rewritten (no false history was invented).

## 4. End-to-end rehearsal (Phase 4) — real HTTP, real authorization

| Suite | Database | Result |
| --- | --- | --- |
| EP39/EP41 E2E (A Purchasing → Warehouse, B Sales → Delivery, Sales → Production, C Production, Production → Sales, Shortage → Receipt, Executive, System Admin, Accounting, Warehouse privacy, Security, Races, Integrity) | `qa421` fresh, independent approval | **120 / 120** |
| EP42.1 additions: persona matrix (144), session (7), **Scenario D** (13), **Scenario G** (23), privacy (6), integrity (10) | `qa421` | **203 / 203** |
| EP41 controls: policy owner-only, override audit, SoD over all decisions, SQL immutability of history | `qa421` | **23 / 23** |
| Races: 18 scenarios × 3 rounds | `qa421` | **0 failing rounds**, no 5xx |
| **Owner-UAT rehearsal on dev's own numbers** (the checklist chains, self-approval policy) | `devcopy421` | **58 / 58** |

- **Scenario D** (sales shortage → production → finished goods → manual allocation → delivery):
  `SO_EP39_DEMAND` stays unallocated while the made lot is received; finished goods are **never**
  allocated automatically; the owner's FEFO allocation takes exactly the manufactured lot; pick →
  pack → dispatch → deliver; Sales reads *Delivered*; Purchasing's shortage clears. On the dev copy:
  `PO-202611-000007` → `MO-202611-000010` → `SO-202611-000014` delivered from lot `UAT-UVL-1`.
- **Scenario E (Accounting):** CORE has **supplier deposits only** (confirm with reference / waive
  with reason → PO to *Pending receive*). No AR / AP / invoices / GL exist and none were invented;
  that is PDA ONE's scope (gap matrix row 6–7).
- **Scenario F:** Executive reads every workspace and every write is refused; System Admin
  administers members / masters / settings view but gets 403 on every operational workspace and
  cannot change the approval policy.
- **Scenario G (approval policy, both states):** legacy — Operations approves its own production
  order and Purchasing its own request; an unnecessary override is refused (`400
  OVERRIDE_NOT_NEEDED`). Independent — self-approval refused (`409 SELF_APPROVAL_NOT_ALLOWED`,
  `overridable: false` for staff); a non-owner override `403 OVERRIDE_NOT_ALLOWED`; an independent
  approver (Purchasing / Owner) decides; owner-raised document → `overridable: true`; reason empty,
  < 10 characters or with control characters → 400; two simultaneous override approvals → exactly
  one 200 and one 409; a later reject → 409; exactly one `SELF_APPROVAL_OVERRIDE` audit row with
  reason, decision, number, branch and roles; both `APPROVAL_POLICY_CHANGED` rows; Activity shows
  both. Admin, Executive and Accounting cannot change the policy. The persistent dev company's
  policy was not changed (the dev-copy rehearsal switched and restored it on the copy).

## 5. Navigation and usability (Phase 5)

Measured in the real UI (scratch stack):

| Journey | Actions from sign-in |
| --- | --- |
| Sales: new sales order | sign in → choose branch (1 select + *Enter CORE*) → quick action **New sales order** (1 click) |
| Warehouse / Accounting / staff | sign in → CORE home directly (single branch, no question) |
| Owner | sign in → Control Center → **Enter CORE** → choose branch (one more step than staff, by design) |
| Approval hand-off | there is no notification; the next person finds work in their list (gap matrix row 15) |

The Sales order screen and customer picker (EP38 combobox) were exercised end to end: keyboard
customer choice, draft, lines, server totals (2 × 290 + 7 % = 620.60 THB), inline submit
confirmation with focus on its button, *Awaiting confirmation* with no Confirm button for staff.

### Defects found and fixed

| # | Severity | Finding | Fix | Verification |
| --- | --- | --- | --- | --- |
| EP42.1-01 | P2 (usability / keyboard) | In a sales order, the **Add an item** search ignored ↓ / ↑ — right after the customer field taught ↓ + Enter. Results were reachable only with Tab. | `ItemSearch` in `frontend/src/features/sales/SalesArea.tsx`: ↓ / ↑ move between the search box and its result buttons (Enter adds; Tab unchanged) | Frontend test extended (`sales.test.tsx`); real browser: ↓ focuses `FG-000002`, Enter adds the line |
| EP42.1-02 | P3 (responsive) | **Purchase orders** list overflowed the page at **1280 px** (Chinese: +30 px; English: +12 px with a visible scrollbar) — eight columns next to the sidebar. Found by the browser matrix (2 / 918). | `frontend/src/features/purchasing/OrdersArea.tsx`: the secondary *Requests* and *Updated* columns show from 1536 px (they were already hidden below 1280 px; requests stay on the order page) | Browser matrix 918 / 918; real browser at 1280 px with scrollbar: all 12 CORE lists × TH / EN / ZH, 0 overflow; 1440 / 1536 / 1920 checked |

### Observed, not changed (recorded)

| Severity | Observation |
| --- | --- |
| P3 | Executive opening `/core/sales/orders/new` sees "Page not found — this sales order was not found or you lack permission" (the route falls through to the order page); refusal is correct, wording is generic. |
| P3 | System Admin's CORE home says "no department assigned — contact the company owner or system administrator" to the system administrator. |
| P3 | CORE department cards reuse frozen public-site copy; the Accounting card promises payment requests and payables (gap matrix). |
| P3 | The sales order is created in two steps (header, then lines on the order page) — consistent and explained on screen, but one more save than a single form. |

## 6. Real browser QA (Phase 7)

| Check | Result |
| --- | --- |
| Persona matrix: 9 personas × their screens (54 pages incl. 404 / 403 pages and settings) × TH / EN / ZH × 390 / 768 / 1024 / 1280 / 1440 / 1920 (headless Chrome, real sessions). Each: content loaded, one h1, no horizontal overflow, labelled controls, targets ≥ 24 px, unique ids, sidebar *or* Menu, no API error, no redirect, no money on Warehouse screens | First run **916 / 918** (EP42.1-02); after the fix **918 / 918** |
| Real browser (app browser pane, screenshots taken): Sales CORE home, new-order form, customer combobox, line entry, submit; Owner Control Center; PO list at 1280 px ZH | as § 5 |
| Real browser, visible scrollbar: 12 CORE lists × 3 languages at 1280 px as the Owner | 36 / 36 no overflow |
| Permission refusals in the real UI | Admin `/core/sales`, Accounting `/core/warehouse/inventory`, Warehouse `/core/sales`: h1 **"ไม่มีสิทธิ์เข้าถึงหน้านี้"**, *Go back* + *CORE home*; Admin settings shows the owner-only notice |
| Keyboard | Customer combobox (type → ↓ → Enter), item search (↓ / ↑ / Enter, Tab), inline confirmation focus. The Owner override dialog's focus trap / Escape / disabled confirm were verified in a real browser in EP41 and are covered by `OwnerOverrideDialog.test.tsx` (green here); not re-driven by hand in EP42.1 |

Screenshots were inspected for the screens named above only; the 918-check matrix is DOM geometry
and accessibility-tree measurement, not screenshot review.

## 7. Data and security regression (Phase 8)

| Area | Result |
| --- | --- |
| EP40 route-coverage security sweep (anonymous, foreign Origin on every write, cross-company, Executive read-only, System Admin no operations, money sentinels) | in the backend suite — **519 / 519** passing |
| Tenant / branch isolation | backend suites + E2E Security (cross-branch, IDOR, mass assignment, branch spoofing) |
| Department boundaries / Warehouse financial privacy | 144 persona checks; 14 + 6 privacy endpoint checks; browser matrix money check |
| Demo sign-in restrictions | wrong password refused; foreign Origin refused; production refusal covered by `auth-demo-bypass` tests |
| Session revocation | logout invalidates the cookie (401); EP40 revocation suites green |
| Audit and posted-document immutability | SQL `UPDATE` / `DELETE` refused on `AuditLog`, posted receipts / transfers / adjustments / counts and their lines, `StockMovement`; drafts still editable (controls 23 / 23) |
| Stock movements, no duplicate posting | double dispatch, double FG post, double reversal → one success + one 409; exactly one movement each |
| Sales + Production reservations ≤ stock | integrity check `over_reserved_identities = 0` at every stage, races included |
| Ledger reconciliation (10 checks) | **0** on dev and on `qa421` before the rehearsal; **0** after E2E, after the additions, after races (159 movements), on the dev copy before and after the UAT rehearsal |
| Seed idempotency | § 3 |
| Secrets | the full EP42.1 diff and new docs: no connection string, password, cookie, token or key; every secret value in `backend/.env` checked by exact match — none present |

## 8. Quality gates (Phase 10)

| Gate | Result |
| --- | --- |
| Backend typecheck · lint · format · build | pass · pass · pass · pass |
| Backend tests | **519 / 519** (34 files) |
| Prisma validate · migrations | valid · 26 applied; fresh-deployed and dev databases show no difference to the schema |
| Frontend typecheck · lint · format | pass · pass · pass |
| Frontend tests | **1,139 / 1,139** (61 files). A first full run shared the CPU with the build chain and had one timing failure in `production.test.tsx` (an intermediate list query was asserted; production code untouched); that file passed 3 / 3 alone and the full suite passed on a quiet machine — the same load-sensitivity EP41 recorded |
| Frontend build · prerender | pass · 108 indexable pages + 3 shells, each with its own head |
| Real-stack E2E / personas / approval / races / UAT rehearsal | 120 / 203 / 23 / 54 rounds / 58 — all passing |
| TH / EN / ZH, responsive, accessibility | 918 / 918 + 36 / 36 real-scrollbar checks |
| Inventory reconciliation · seed idempotency · secret scan | clean · clean · clean |

## 9. Performance

| Budget | EP41 | EP42.1 | Cap |
| --- | --- | --- | --- |
| All JS (raw) | 4,260.9 KiB | **4,261.2 KiB** (+0.3, the item-search key handler) | 4,300 |
| Initial JS (gzip) | 182.7 KiB | **182.7 KiB** | 205 |
| Static HTML (raw) | 526.9 KiB | **526.9 KiB** (111 / 111 files) | 560 |
| Initial CSS (gzip) | 50.6 KiB | 50.6 KiB | 52 |

No cap was changed; JS headroom ≈ 38.8 KiB. API load was not re-measured (no backend code change).

## 10. Remaining limitations

- Product-direction gaps (production needs a BOM; one-department rule not enforced; BOM
  confidentiality; no dashboards / Command Center; no notifications; no PDA ONE contract) — see the
  gap matrix with priorities.
- Demo: no Sales Manager / Warehouse Manager persona; the owner performs manager steps.
- Release (unchanged from EP41): backups / restore drills, monitoring, least-privilege runtime DB
  role, incident response, external security review — **production blockers**, not internal-UAT
  blockers.
- Load figures were not re-measured in EP42.1 (no backend change); EP41's stand.

## 11. Final commit

`test: prepare CORE internal demo and owner UAT (EP42.1)` — local only.
Files: `frontend/src/features/sales/SalesArea.tsx`, `frontend/src/features/sales/sales.test.tsx`,
`frontend/src/features/purchasing/OrdersArea.tsx`, `docs/EP42_1_*.md` (4), `docs/PERFORMANCE.md`,
`README.md`. `.claude/launch.json` was restored to its original content (temporary QA entries
removed). No schema, migration, dependency, permission, persona or seed change.

## 12. Decision

**PASS** — ready for **EP42.2** owner UAT with the Thai guide and checklist. The owner should
expect the documented gaps and record anything else as a finding. EP42.2 was **not** started and
no human acceptance is claimed.
