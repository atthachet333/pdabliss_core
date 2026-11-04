# EP36 Report — Production Order, BOM & Material Requirements Planning Foundation

**Verdict: PASS.** Baseline `4a52ee3` (EP35, equal to `origin/main` when EP36 started). Committed
locally as `feat: add CORE production order and material planning foundation (EP36)`; **not
pushed, not deployed**. EP37 not started. Design: [PRODUCTION_ORDER.md](PRODUCTION_ORDER.md),
[PRODUCTION_BOM.md](PRODUCTION_BOM.md). Budget: [PERFORMANCE.md](PERFORMANCE.md).

## 1. Phase 0 — bundle recovery (before any Production code)

| Measure | EP35 baseline | After cleanup | After EP36 |
| --- | --- | --- | --- |
| All JS (raw) | 4,252.8 KiB | **4,052.2 KiB** (−200.6) | **4,122.4 / 4,300 KiB** |
| CORE World chunk (gzip) | 235.5 KiB | 182.5 KiB | 182.5 KiB |
| Initial JS (gzip) | 182.6 / 205 | 182.6 | 182.6 |
| Static HTML | 528 / 560 KiB | 528 | 528 |
| Headroom | ≈ 47 KiB | ≈ 248 KiB | **≈ 178 KiB** |

`<Canvas>` from @react-three/fiber calls `extend(THREE)`, which keeps the whole three.js namespace in
the CORE World chunk. A small `CoreCanvas` (R3F's public `createRoot` / `events` / `extend`, only the
ten scene elements registered, insertion-effect disposal as in `<Canvas>`, errors → static fallback)
renders the same scene. Verified in the production build and the dev server (StrictMode): render,
hover, select, deselect, remount after navigation, 390 px, no console errors; landing tests 34/34;
the full frontend suite, typecheck, lint, format, build, prerender and perf passed before Production
work began. The audit found no unused copy keys worth removing, no duplicated modules and no unsafe
eager imports. No cap was raised; no dependency added.

## 2. What was built

| Area | Summary |
| --- | --- |
| Department | Production lives in **Operations** (no new department; Operations already covers production) |
| BOM | `ProductionBom` / `ProductionBomLine`: single level, versioned (`BOM-<item>`, revision 1, 2, …), DRAFT → ACTIVE → RETIRED, one ACTIVE per item (unique slot), activation supersedes the previous revision atomically, revise copies a revision into a new draft; validity (item types, company, self-reference, duplicates, stock materials, base unit only — no conversion, precision); immutable once ACTIVE (service + triggers) |
| Orders | `ProductionOrder` / `ProductionOrderMaterial`: `MO-YYYYMM-NNNNNN` (DocumentSequence), branch-bound, MANUAL or SALES_DEMAND (composite FKs to the same branch's confirmed sales line), DRAFT → SUBMITTED → APPROVED → READY, REJECTED, CANCELLED; transitions defined once and enforced by a trigger; no IN_PRODUCTION / COMPLETED |
| Requirements | `target × line ÷ BOM output`, exact integer arithmetic, rounded UP to the unit (never truncated), recomputed on draft changes, refreshed at submit / approval, **frozen** at approval (trigger) |
| Availability | EP34 reservation-aware stock (`stockFor`): per material AVAILABLE / PARTIALLY_AVAILABLE / UNAVAILABLE + shortage; per order MATERIALS_AVAILABLE / MATERIALS_SHORT / NOT_ASSESSED — a snapshot, never a reservation; READY only when everything is available at release |
| Sales demand | read-only queue: open = ordered − reserved − dispatched, available stock shared by requested date, planned orders counted once, `DEMAND_ALREADY_PLANNED` warning, explicit creation from a line (branch / item from the server), source re-validated at submit / approve / release, `SOURCE_CANCELLED` flag |
| Purchasing | read-only shortage handoff of APPROVED / READY orders (`purchasing.production_shortages.view`); no automatic purchase request |
| Permissions | `operations.orders.approve` · `.cancel`, `operations.bom.view` · `.manage`, `purchasing.production_shortages.view` (override CHECK 65 → **70**); reuses `operations.orders.view` · `.create` |
| UI | lazy `ProductionArea` (overview, orders, editor with live server preview, detail, BOMs, requirements, demand) + `ShortagesArea`; CORE links; TH / EN / ZH |
| Audit | 4 BOM + 7 order actions on `ProductionBom` / `ProductionOrder` (redacted on the Platform explorer) |
| Demo | BOM-FG-000001 R1 retired + R2 active; orders: draft, submitted, approved, approved-short, sales-linked submitted; `operations.demo` stays Manager; second seed changes nothing |

## 3. Gates

| Gate | Result |
| --- | --- |
| Prisma validate · migrate diff (migrated DB vs schema) | valid · no difference |
| Backend typecheck · lint · format · build | pass · 0 problems · clean · pass |
| Backend tests | **29 files, 453 tests passed** (EP35: 28 / 433) — new `production.test.ts` (19), demo seed (+1) |
| Frontend typecheck · lint · format | pass · 0 problems · clean |
| Frontend tests | **56 files, 1,101 tests passed** (EP35: 55 / 1,089) — new `production.test.tsx` (12); `--maxWorkers=2` |
| Build · prerender · verify-prerender · perf | pass · 108 pages + 3 shells · pass · within budget |
| Fresh migration · seed twice | 20 migrations applied; second seed: every section `unchanged` |
| Upgrade EP35 → EP36 (`pdabliss_core_up36`) | migration changed **no data** in the 59 EP35 tables (+4 tables, no column added), no drift; EP36 seed modified no existing row (+16 audit rows, +1 sequence row); second seed: only the pre-existing `MasterCodeSequence` bump; 0 production movements; ledger / reservation / issue invariants 0 |
| Real-stack E2E (`qa-ep36`, fresh `pdabliss_core_qa36`, ports 2111 / 2112) | **86 / 86**, no server errors |
| UI QA — in-app browser · headless Edge 156 · headless Chrome 156 | **96 / 96 each** (8 screens × 390 / 768 / 1440 / 1920 px × TH / EN / ZH): no horizontal overflow, one h1, labelled controls, targets ≥ 24 px, no duplicate ids, no money; plus the Purchasing shortage page and a keyboard create → submit → approve flow at 390 px (focus returns to the heading) |
| Ledger reconciliation (QA DB after everything) | 0 mismatches, 0 negative balances, 0 production movements, reserved ≤ on hand |
| Secret scan (EP36 diff + new files) | clean |

**E2E coverage (86).** Setup: the legacy `staff.demo` was assigned to Operations **in the scratch DB
only** (normal admin API) as Production Staff; `operations.demo` stayed Manager. A — manual order:
staff finds the item and its active BOM, preview RM 25 kg / PK 100, creates (MO number, branch,
requirements), Head Office stock not counted, submits, staff approve 403, manager approves (frozen),
a new BOM revision changes nothing (API and DB), the DB guard refuses editing requirements, zero
inventory change, release → READY. B — sales-linked: demand 100 ordered / 60 reserved → open 40,
no price / customer / note anywhere, branch or item from the client refused, linked order approved,
no finished goods added, demand planned 40 / suggested 0, duplicate flagged. C — shortage: RM 180
required / 30 available / 150 short, MATERIALS_SHORT, release refused, Purchasing sees the handoff
(no value), no purchase request, no reservation, reject needs a reason. D — 10 concurrent creations
(unique consecutive numbers); three rounds each of double submit, triple approve (one audit event),
approve vs reject, double cancel, draft edit vs submit, BOM double activation, sales cancel vs
approval. E — branch IDOR 404, foreign branch choice 403, Executive read-only, System Admin / Sales /
Warehouse / Accounting 403, mass assignment 400 (status, materials, companyId, approvedBy, available,
BOM status / revision, edit status), unknown ids 404, anonymous 401, privacy over every response,
audit without quantities. F — reconciliation.

**Backend tests (19).** Contracts (tiers, audit entities, no money / customer key in any view,
rounding table); BOM lifecycle and immutability (API + database); BOM validity (13 refusals);
manual order end to end with zero inventory writes; BOM selection rules (none / explicit / foreign /
retired / superseded at approval); reject / cancel / release rules; availability (reservation-aware,
per branch, expired lots excluded, two orders see the same stock, preview saves nothing, shortage
filter); sales demand (formula, privacy, derived branch / item, duplicates, ineligible sources,
other-branch line 404, allocation untouched); sales cancellation (approval refused / flagged);
Purchasing handoff; roles; isolation; races (numbering, transitions, BOM activation, sales cancel vs
approval); overview counts and server filters.

**Regression.** Every earlier backend suite (auth, platform / audit redaction, company, permissions,
master data, PR, PO / deposits, receiving / lots / FEFO, transfer / adjustment / count, sales orders,
allocation, fulfilment) and every frontend suite (public site, auth, CORE) pass. Contract updates on
purpose: 70 override codes, BOM codes company-wide in the scope rule, permission labels for
`operations.bom` / `purchasing.production_shortages` (and "Work and production orders"), the seed
report line `production …`.

## 4. Performance

| Chunk | Raw / gzip |
| --- | --- |
| `ProductionArea` | 31.2 / 8.2 KiB |
| `prodParts` (shared parts + TH / EN / ZH copy) | 37.5 / 11.7 KiB |
| `ShortagesArea` | 1.7 / 0.8 KiB |

All JS 4,122.4 / 4,300 KiB (+70.2 over the post-cleanup 4,052.2); initial JS 182.6 / 205 KiB gzip;
static HTML 528 / 560 KiB; headroom ≈ 178 KiB.

## 5. Known limitations (deliberate)

- Planning only: no material reservation, issue, consumption, execution, completion or finished
  goods receipt (EP37 / EP38 contracts in PRODUCTION_ORDER.md §9 and INVENTORY_LEDGER.md §10).
- Availability is a snapshot shared by every order; READY can become short again later.
- Single-level BOMs; base unit only (no conversion); no scrap, yield, routing, capacity or costing.
- No automatic production orders or purchase requests; no Production Staff demo persona (the
  Operations persona is a Manager by design).
- Firefox and axe are not available on this machine (in-app Chromium, Edge and Chrome were checked).
