# EP42.1 — Product Blueprint Gap Matrix

**Baseline:** `aef2ff4` (EP41). **Date:** 2026-11-10. **Kind:** an audit, not an implementation
plan. Nothing in the PLANNED column was started in EP42.1.

The confirmed direction (owner, EP42.1 brief): CORE is a **Department-First Operations Platform**
for medium-sized businesses — one company per workspace, several branches and warehouses, one
department per operational employee, read-only executives, no money for Warehouse, optional and
confidential BOMs, operational accounting that feeds PDA ONE later, responsive web first,
TH / EN / ZH, internal testing before any pilot.

## How each row was judged

| Status | Meaning |
| --- | --- |
| **IMPLEMENTED** | Present **and** exercised in EP42.1 (real API, real authorization, scratch database or real browser) or in the committed test suites that ran green in EP42.1 |
| **PARTIAL** | Something exists, but it does not yet meet the stated requirement — the gap is named |
| **PLANNED** | Not implemented. A menu entry, a marketing sentence, a catalog value or a placeholder does **not** count |

Evidence keys: **E2E** = real-stack suites on `pdabliss_core_qa421` (120 + 203 + 23 + 54 race rounds,
all passing); **BQA** = headless-Chrome persona matrix (918 checks); **BT** = backend tests; **UI** =
hands-on check in the app's browser pane.

## Matrix

| # | Requirement | Status | What exists (evidence) | Gap / what is missing | Suggested EP |
| --- | --- | --- | --- | --- | --- |
| 1 | One department per operational employee | **PARTIAL** | The seven operational demo personas each hold exactly one department (live `/company/context`, E2E Personas). Department permissions are scoped by department; Sales, Purchasing, Operations, Warehouse and Accounting are refused each other's workspaces (E2E, 144 persona checks). | **Not enforced.** Member administration accepts a list of up to all six departments plus a "primary" (`backend/src/company/input.ts:71,302,368`). An administrator can therefore give a staff member several departments and, with them, cross-department operational permissions. A rule (one department for `DEPARTMENT_STAFF` / `DEPARTMENT_MANAGER`, explicit exceptions only) and a migration check for existing members are needed. | EP43 (policy) |
| 2 | One company per workspace | **IMPLEMENTED** | Every business row carries `companyId` with composite company/branch foreign keys; a session works in one company. Cross-company access with the other company's ids returns no 2xx on any id route (EP40 route sweep, BT `ep40-security`). | — | — |
| 3 | Multiple branches | **IMPLEMENTED** | Branch `00000` + `00001`; member branch access; explicit working-branch choice (writes refused with `409 BRANCH_SELECTION_REQUIRED` until chosen, E2E); reads stay inside the member's own branches; branch isolation (Warehouse `00001` cannot open Head Office documents, E2E Security). | Branch-level **reporting roll-ups** do not exist (see 10). | — |
| 3b | Multiple warehouses per branch | **PARTIAL** | A branch has a location tree (`WarehouseLocation`, parent/child, default slot), e.g. `00001/MAIN` and `00001/RECEIVING`; FEFO, transfers, counts and adjustments work per location. | There is no *warehouse* entity above locations (no per-warehouse address, manager or stock roll-up). "Warehouse" today = a branch's location tree. | EP45+ |
| 4 | Optional BOM and confidentiality controls | **PARTIAL** | BOM revisions (DRAFT → ACTIVE → RETIRED), one active revision per item, permission `operations.bom.view` / `.manage`. Warehouse, Purchasing, Sales and System Admin are refused BOM lists (E2E probe: 403). | **Confidentiality:** every holder of `operations.bom.view` — all Operations members, the Executive and the Owner — reads every recipe in full (probe: Executive 200 with lines). No per-BOM restriction, no masked quantities, no confidential flag. Material issues and reservations also reveal recipe materials to Warehouse (by design for picking). | EP44+ |
| 5 | Production without a mandatory confidential recipe | **PARTIAL — conflicts with the direction** | A production order can be **drafted** without a BOM. | **Submit and approve require an active BOM** (`422 BOM_REQUIRED`, `backend/src/production/service.ts:1184`); material reservation and issue are driven only by BOM requirements. A company that does not want to record recipes cannot run production in CORE today. Needs a "no-BOM" mode (manual material lines or output-only orders). **Not a demo blocker** — the demo company uses BOMs. | EP44 (priority) |
| 6 | CORE operational accounting vs PDA ONE accounting ownership | **PARTIAL (by design)** | CORE keeps document money where the operation happens: sales order prices / discounts / tax / totals, purchase order prices / tax / totals, supplier **deposits** (confirm / waive by Accounting, E2E Accounting). Money is hidden from Warehouse (E2E 14 + 6 privacy checks; BQA). | No invoices, receivables, payables, customer payments, credit notes, cost of goods, stock valuation, journal or general ledger — **correctly**, because the ledger is PDA ONE's. But the CORE Accounting department card (shared public copy in `frontend/src/config/departments.ts:93`) promises "payment requests, deposits and payables" — only deposits exist. | Copy: EP43; integration: see 7 |
| 7 | PDA ONE integration readiness | **PLANNED** | Clean source documents with immutable history (`AuditLog` append-only, posted documents frozen — EP41 controls 23 / 23), server-computed totals, stable document numbers. | No integration contract, export, outbox / event feed, API keys, mapping of CORE documents to PDA ONE accounts, idempotent posting keys or reconciliation report. | EP46+ |
| 8 | PDA Property integration readiness | **PLANNED** | Only a sign-up "industry = PROPERTY" lead field (`SignupIndustry`). | No property, unit, lease or maintenance concept; no integration surface. | later |
| 9 | Department dashboards | **PARTIAL** | Each persona lands on CORE home: working branch, role, shortcut actions (e.g. Sales: *New sales order*, *New purchase request*), and its department card(s) (UI). Department workspaces show status counts and lists (Sales list counts, Warehouse overview tabs). | No KPI dashboards (targets, trends, overdue work, ageing, throughput, exceptions). The CORE home is a launcher, not a dashboard. | EP45 |
| 10 | Executive Command Center | **PARTIAL** | Executive sees every department read-only: 33 `.view` permissions only; every write refused (E2E Executive 12 checks; EP40 sweep). CORE home shows one read-only card per department (UI). | No cross-department summary: no company / branch KPIs, no exception feed, no drill-down roll-up. Reading = opening each department's lists. | EP45 |
| 11 | RFQ and Supplier Portal | **PLANNED** | Purchase requests → purchase orders → deposits → receiving (E2E Purchasing). | No RFQ / quotation comparison, no supplier login, no supplier confirmation of POs. | later |
| 12 | Quotation and promotions | **PLANNED** | Sales orders with unit price, line discount and tax (UI: 2 × 290 + 7 % = 620.60 THB, server-computed). | No sales quotation document, price lists, customer-specific prices or promotions. (The only "quotation" in code is the Enterprise *subscription* plan priced by quotation.) | later |
| 13 | Warehouse zones, barcode, serial and expiry traceability | **PARTIAL** | Lots and expiry with FEFO (by item rule), lot-level movements and balances, receipt lot / expiry capture, transfers, counts, adjustments, reservation guards (E2E, ledger 10 / 10 checks zero). Item **barcode** field (unique per company). Location tree can model zones. | **No barcode scanning** (the schema says "No scanning yet"), **no serial numbers**, no zone semantics (putaway rules, zone types), no recall / trace-forward report across sales and production (data exists, report does not). | EP45+ |
| 14 | Production capacity and QC | **PARTIAL** | Output reports with good / defective quantities and an accept / reject decision; finished-goods receipt only of accepted good output (E2E Production, Scenario D). | No capacity / work-centre / scheduling model; no QC plans, inspections, test results or QC hold workflow (a location named "QC" is only a location). | later |
| 15 | Notifications: Email, In-app, LINE Bot | **PLANNED** | Transactional **auth** e-mails only (verification, sign-in code, password reset, invitations). | No business notifications (approvals waiting, shortages, deliveries), no in-app inbox, no LINE integration. Approval hand-offs rely on people opening lists. | EP44+ |
| 16 | Self-service onboarding | **PARTIAL** | Registration, e-mail verification, company onboarding with Owner, Head Office `00000` and departments; subscription created as `PENDING` (README EP23–EP24). | No payment, so a new company waits for manual activation; no guided setup of branches, masters and opening stock. Internal testing comes first by owner decision — not a public self-service trial. | before public trial |
| 17 | Subscription billing | **PLANNED** | Plan catalog (Starter / Business / Professional / Enterprise) and entitlement snapshot per subscription; department limit enforced. | No payment provider, invoices, renewals, dunning or plan changes. | before paid pilot |
| 18 | Shared-database tenant isolation | **IMPLEMENTED (application level)** | Shared PostgreSQL; composite `(id, companyId)` / branch foreign keys (250 FKs, 88 CHECKs, EP40); company isolation sweep on every route; no id leakage (EP40, BT). | No database row-level security and no least-privilege runtime DB role yet (release blocker, `EP41_RELEASE_READINESS.md`). | release |
| 19 | Storage limits, monitoring and backups | **PLANNED** | `storageGb` in the plan snapshot (not enforced; only the company logo is stored). Manual `pg_dump` backups made by episodes (EP42.1: verified dump + restore). | No storage metering / enforcement, no monitoring / alerting, no scheduled backups or restore drills. | release |
| 20 | Responsive Web / mobile usability | **IMPLEMENTED (web)** | 9 personas × their screens × TH / EN / ZH × 390 / 768 / 1024 / 1280 / 1440 / 1920 px: **918 / 918** (BQA: one h1, no overflow, labelled controls, targets ≥ 24 px, unique ids, no API errors, Warehouse money privacy). Real-browser sweep of all 12 CORE lists at 1280 px with a visible scrollbar in TH / EN / ZH: no overflow (after the EP42.1 fix). | Native mobile apps are deferred by decision. No offline mode; no camera barcode scanning on phones (see 13). | — |

## Things that look implemented but are not

- **CORE department cards** reuse the public website's department copy
  (`frontend/src/config/departments.ts`, part of the frozen public frontend). In CORE they describe
  the product vision — Accounting "payment requests, deposits and payables", Warehouse "quality
  checks". Only deposits and receipt-time rejection exist. Recorded here, not changed (public
  frontend v1 freeze).
- **Subscription plans** carry storage, user and API figures; only the department limit is
  enforced.
- **Item barcode** is a stored, unique field; nothing scans it.

## Priority view (for the owner)

| Priority | Gap | Why |
| --- | --- | --- |
| P1 (direction) | 5 — production requires a BOM | Contradicts "BOM optional; confidential recipes never mandatory". Blocks companies that will not record recipes. |
| P1 (direction) | 1 — one department per employee not enforced | The safety of department-first permissions depends on it. |
| P2 | 4 — BOM confidentiality | Recipes are visible to every Operations member and the Executive. |
| P2 | 9 / 10 — dashboards and Executive Command Center | Medium-business buyers expect a cockpit; today it is lists. |
| P2 | 15 — notifications | Approval hand-offs are invisible without them. |
| P2 | 7 — PDA ONE integration contract | Defines what CORE must emit before more money fields are added. |
| P3 | 6 — Accounting card copy overclaims | Small wording fix once the public freeze allows. |
| Release | 17, 18 (DB role / RLS), 19 | Required before any paid customer, not for internal UAT. |

None of these is a blocker for the **internal** owner UAT in EP42.2: every main department has
records, a working journey and server-enforced boundaries today.
