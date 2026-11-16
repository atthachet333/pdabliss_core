# EP48 — Executive Command Center & Cross-Department Operational Intelligence — Final Report

**Baseline:** `0c90bf0` (EP47) = `HEAD` = `origin/main`, clean tree. **Result:** one local commit
`feat: add CORE executive command center (EP48)`. Not pushed, not deployed, EP48.5 not started.

**Verdict: PASS** — all 21 acceptance criteria met with evidence (§17). Human UAT cases `EX-01 … EX-12` are
**NOT TESTED**.

Documents: [EP48_EXECUTIVE_REQUIREMENTS.md](EP48_EXECUTIVE_REQUIREMENTS.md) (Phase 0 audit, information architecture) ·
[EP48_EXECUTIVE_METRIC_DICTIONARY.md](EP48_EXECUTIVE_METRIC_DICTIONARY.md) ·
[EP48_BOTTLENECK_RULES.md](EP48_BOTTLENECK_RULES.md) · [EP48_SECURITY_MATRIX.md](EP48_SECURITY_MATRIX.md) ·
[EP48_PERFORMANCE_REPORT.md](EP48_PERFORMANCE_REPORT.md).

## 1. Changed files

| Area               | Files                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend (new)      | `src/executive/service.ts` (work-item model, overview, activity, document trace), `src/executive/view.ts` (strict answers: no money / quantity / recipe field), `src/routes/v1/executive.ts` (two GET routes), `src/dashboards/facts.ts` (shared aggregates), `test/ep48-executive.test.ts` (18) |
| Backend (changed)  | `src/routes/v1/index.ts` (registration), `src/dashboards/service.ts` (uses the shared facts; **fix:** no draft purchase orders for the Executive)                                                                                                                                                |
| Frontend (new)     | `features/executive/CommandCenter.tsx` (page + investigation, lazy), `execApi.ts`, `execCopy.ts` (TH / EN / ZH), `executive.test.tsx` (7); `features/dashboards/liveResource.ts` (shared refresh rules)                                                                                          |
| Frontend (changed) | `company-center/CoreArea.tsx` (routes, CORE-home button, Executive card link), `company-center/CoreNav.tsx` (menu entry), `dashboards/DepartmentDashboard.tsx` + `dashApi.ts` (shared hook; accessible link name)                                                                                |
| Docs               | 6 new EP48 documents; updated permission matrix, navigation report (EP38.4), owner UAT plan (EX-01 … EX-12), bug register (K-05, K-20), release-gate matrix, product-gap matrix (#10), operations handbook, PERFORMANCE.md, EP47 metric definitions                                              |

No migration, no new permission code, no new dependency.

## 2. Coverage

| Area              | Delivered                                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operational pulse | 40 metrics across Sales (11), Purchasing (8), Warehouse (8), Operations (10), Accounting (3) — documents, lines or lots, never quantities or money                                           |
| Department health | per department: work waiting on it, blocked, overdue, its open documents, stage breakdown, waits-on / awaited-by departments, completed in 7 days, link to the EP47 dashboard                |
| Bottlenecks       | 5 flows: Sales → Warehouse, Purchasing → Warehouse, Production → Warehouse, Purchasing → Production, Accounting → Purchasing — totals, class counts, stage counts, top 5 items with evidence |
| Priority queue    | blocked (delivery exception, production shortage, paused) → overdue (most days first) → stock discrepancies; top 25 + total; deterministic                                                   |
| Branch comparison | 10 measures per permitted branch; rows add up to the company (tested); `?branch=` filter (all / one)                                                                                         |
| Recent activity   | last 20 document events in 7 days (8 event types), with links                                                                                                                                |
| Investigation     | sales / purchase / production order: its current work item and related documents with localized statuses and permitted links                                                                 |

## 3. Metric definitions

Every metric's meaning, source, calculation, statuses, time scope, scope, authorization, empty state, drill-down and
limitations: [EP48_EXECUTIVE_METRIC_DICTIONARY.md](EP48_EXECUTIVE_METRIC_DICTIONARY.md). The **work-item model** gives
every open, non-draft document exactly one stage, so nothing is counted twice (tested: department `waiting` sums equal
`open` sums; per-document stage uniqueness).

## 4. Department health

Sales, Purchasing, Warehouse, Operations (production) and Accounting (supplier deposits only). Departments are not ranked
and the page states that document counts are not workload comparisons. No write, approval or posting control exists.

## 5. Bottleneck rules

26 stages, each from canonical statuses and the shared aggregates (EP35 milestones, EP30 ordering, EP31 receiving,
EP36 shortages, EP38 output receipts); classes BLOCKED / OVERDUE / MISSING_DATE / WAITING without invented thresholds;
the next responsible department is named, a cause is never attributed. Details: [EP48_BOTTLENECK_RULES.md](EP48_BOTTLENECK_RULES.md).

## 6. Priority queue behaviour

Read-only rows with document, type, context, owning department, branch, stage, class, reason, evidence, next department,
date, days overdue, days in stage, link and "Investigate". Ordering: `byQueue` (unit-tested). No action shortcut.

## 7. Branch comparison

Every document carries exactly one `branchId`; per-branch rows are computed from the same items and add up to the
company values (S6). Only active branches the person may work in appear; another id is 404. No metric in EP48 needs
cross-branch attribution (master data is excluded).

## 8. Owner / Executive / System Admin

| Who                                                         | Result                                                                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Owner                                                       | full overview; drill-down to the canonical screens, which keep EP41 approval / override and audit; no shortcut    |
| Executive                                                   | READ-only (`readOnly: true`, no action button); never draft purchase orders; no recipe detail; no financial value |
| System Admin                                                | 403; administration in the Company Control Center                                                                 |
| Managers / Staff / Viewers (incl. the Executive department) | 403; their EP47 dashboard                                                                                         |

## 9. Security regression

All 16 Phase 12 cases PASS ([EP48_SECURITY_MATRIX.md](EP48_SECURITY_MATRIX.md)). Existing sweeps with the new routes:
EP47 suite + EP40 security + EP45 department + EP46 recipes + warehouse privacy **74 / 74**.

## 10. Test counts

| Gate                                                         | Result                                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend: Prisma validate · typecheck · lint · format · build | pass                                                                                                                                                                     |
| Backend full suite (disposable cluster `127.0.0.1:55443`)    | **611 / 611** (42 files; EP47 593 + 18 EP48), run on the final code                                                                                                      |
| Frontend: typecheck · lint · format                          | pass                                                                                                                                                                     |
| Frontend full suite                                          | **1,192 / 1,192** (66 files; EP47 1,185 + 7 EP48)                                                                                                                        |
| Build + prerender + budgets                                  | 108 pages + 3 shells; all budgets pass (§13)                                                                                                                             |
| Ops tool tests                                               | **21 / 21**                                                                                                                                                              |
| Migration verification                                       | no migration in EP48; the test and QA databases were migrated fresh (28 migrations)                                                                                      |
| Secret scan (staged added lines)                             | clean — no password, connection string, key or token; the only `.env` values present are public (`development`, `localhost`, demo persona addresses already in the repo) |

## 11. Real-stack scenarios

Fresh database `pdabliss_core_ep48_qa` on the disposable cluster (`prisma migrate deploy` + demo seed), EP48 backend over
HTTP (port 2112), nine real personas. Two full runs: **73 / 73**, then **76 / 76** on the busier data (more items to
attribute). Scenarios 1–19: new order (drafts not counted), awaiting allocation (partial reservation), picking pending,
partial fulfilment, requisition pending, PO awaiting receipt (overdue), partial receiving, warehouse backlog,
BOM-required and BOM-optional manufacturing (nine stages each in order), material shortage (blocked → Purchasing, in the
queue, no quantity), completion, branch filter, Executive drill-down (traces), System Admin and staff denied, recipe
confidentiality, warehouse financial privacy, company attribution of every item. Each checks count deltas, stage,
next department, branch attribution, links and that reads write nothing (movements, audit rows, reservations unchanged).
The backend suite runs the same flows (R1–R12).

## 12. Stock ledger

`uat/integrity.sql`: **0** on every check after each workflow (suite and real stack) and at the end.

## 13. Browser / accessibility

QA stack (frontend 2111 → backend 2112). Verified:

- Executive at 1440 px (EN): pulse, queue, bottlenecks, health, branches, activity; read-only pill; only "Refresh".
- No horizontal page overflow at **390 / 768 / 1024 / 1280 / 1440 / 1920 px** (the branch table scrolls inside its own
  labelled, focusable region).
- Thai at 390 px: branch filter operated **by keyboard** (focus + ArrowDown) — URL, rows and language follow.
- Chinese at 768 px: investigation page (delivery-exception order → pick, pack, shipment chain), localized statuses.
- Owner: CORE-home button, Executive card link, menu entry. Accounting manager typing the URL: Thai refusal, no
  sections, no menu entry. System Admin, Sales staff, Warehouse staff, Operations manager: 403 from the server.
- Structure: one `h1`, section `h2`, card `h3`; labelled `select`; table with caption and row / column headers; reasons,
  classes and overdue as text (+ icon), nothing hover-only; link names include kind and number (fixed during QA, also
  in EP47 rows).
- Not exercised in the browser: an unassigned member and an Operations _staff_ member (no demo persona) — covered by
  backend (403) and UI tests (no entry).

## 14. TH / EN / ZH

All Command Center copy exists in three languages with the same shape (copy-parity test over metrics, stages, classes,
reasons, evidence, flows, events, statuses, notes). Viewed in TH, EN and ZH in the browser.

## 15. Performance and queries

Overview: **59** SQL statements, constant for all branches or one (does not grow with documents); median ≈ 20 ms, p95
≈ 26 ms; trace 39 statements, ≈ 13 ms (development measurements — no production capacity claim). One overview request per
page load; refresh every 120 s only while visible. Details: [EP48_PERFORMANCE_REPORT.md](EP48_PERFORMANCE_REPORT.md).

## 16. JS / HTML

All JS **4,163.5 → 4,223.1 / 4,300 KiB**; initial JS **182.8 / 205** KiB gzip (unchanged); initial CSS **50.9 / 52**;
static HTML **525.1 / 560** KiB (111 / 111 files). No cap raised.

## 17. Acceptance criteria

| #   | Criterion                                              | Evidence                                          |
| --- | ------------------------------------------------------ | ------------------------------------------------- |
| 1   | Owner and Executive see a usable company-wide overview | browser checks, S3, real stack                    |
| 2   | Executive strictly read-only                           | S1 / S2 / S15, no action button (UI test)         |
| 3   | Metrics from canonical records                         | metric dictionary; independent recounts (S6)      |
| 4   | Department health reflects workflow states             | R1–R12 stage assertions                           |
| 5   | Bottlenecks with evidence and next step                | bottleneck rules; R2, R3, R7, R11                 |
| 6   | Queue with authorized drill-down                       | R14 (every link opens for Owner and Executive)    |
| 7   | Branch metrics accurately attributed                   | S6, real stack                                    |
| 8   | Company isolation                                      | S5, real stack                                    |
| 9   | EP45 department enforcement                            | S4 + EP45 suite                                   |
| 10  | EP46 recipe confidentiality                            | S10 / S11 + EP46 suite                            |
| 11  | Warehouse financial privacy                            | S13 + EP45 A18 + warehouse-privacy suite          |
| 12  | No unauthorized financial exposure                     | S12, schema test                                  |
| 13  | No duplicate state machine                             | shared `facts.ts`; stages from canonical statuses |
| 14  | No dashboard-generated writes                          | state hash, real-stack counters                   |
| 15  | Full backend tests                                     | §10                                               |
| 16  | Full frontend tests                                    | §10                                               |
| 17  | Real-stack regression                                  | §11                                               |
| 18  | Browser and accessibility QA                           | §13                                               |
| 19  | Performance budgets                                    | §16                                               |
| 20  | Dev / UAT data unchanged                               | §18                                               |
| 21  | Documentation and UAT cases                            | 6 documents + updates; EX-01 … EX-12 NOT TESTED   |

## 18. UAT / Dev preservation

All database work on the disposable cluster `127.0.0.1:55443` (this session's scratchpad): `pdabliss_core_ep48_test`
(suites) and `pdabliss_core_ep48_qa` (QA stack, statement logging enabled on that database only). The owner's
`pdabliss_core_dev` (localhost:5432) was read once, read-only, at the end: newest write anywhere **2026-10-26**. No UAT
database exists here; none created. Ports 1111 / 1112 unused. `.claude/launch.json` restored.

## 19. Owner UAT cases added

`EX-01 … EX-12` in [EP42_2_OWNER_TEST_PLAN.md](EP42_2_OWNER_TEST_PLAN.md) — all **NOT TESTED**.

## 20. Remaining limitations

1. No trends, history or SLAs (CORE stores states, not snapshots); "days in stage" uses the timestamp each record keeps.
2. Counts are documents; departments and branches are not workload-ranked.
3. Queue shows 25 rows, flows 5 items, activity 20 events (true totals shown); lists bounded at 5,000 documents per type
   (`TRUNCATED` note if reached).
4. Investigation covers sales, purchase and production orders.
5. Polling (120 s while visible), no push; no notifications, no export.
6. Owner UAT not run.

## 21. Production blockers

Unchanged from EP44 ([EP44_RELEASE_GATE_MATRIX.md](EP44_RELEASE_GATE_MATRIX.md)): backup / restore automation,
monitoring and alerting, least-privilege DB roles, capacity test (C-5), external security review (C-6), PDPA and terms,
billing; EP45 / EP46 migrations need approval for UAT / production. EP48 adds none.

## 22. Status

Committed locally · **Push: NOT PUSHED** · **Deploy: NOT DEPLOYED** · **EP48.5: NOT STARTED**.
