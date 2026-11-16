# EP47 — Department Dashboards & Operational Work Visibility — Final Report

**Baseline:** `04bf246` (EP46) = `HEAD` = `origin/main`, clean tree. **Result:** one local commit
`feat: add CORE department operational dashboards (EP47)`. Not pushed, not deployed, EP48 not started. No staging or
production infrastructure touched.

**Verdict: PASS** — all 17 acceptance criteria met with evidence (§9). Human UAT cases `DB-01 … DB-10` are
**NOT TESTED**.

Documents: [EP47_DASHBOARD_REQUIREMENTS.md](EP47_DASHBOARD_REQUIREMENTS.md) (Phase 0 audit) ·
[EP47_METRIC_DEFINITIONS.md](EP47_METRIC_DEFINITIONS.md) (contract) ·
[EP47_PERMISSION_MATRIX.md](EP47_PERMISSION_MATRIX.md) · [EP47_PERFORMANCE_REPORT.md](EP47_PERFORMANCE_REPORT.md).

## 1. What changed

| Area             | Change                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle (Phase 1) | The homepage CORE World renders on plain three.js (`core-world/engine.ts`; scene parts converted from JSX to object construction with identical per-frame code); `@react-three/fiber` removed. All JS **4,286.0 → 4,124.9 KiB** before any dashboard code.                                                                                          |
| Backend          | `backend/src/dashboards/` — `service.ts` (five read-only department projections), `view.ts` (strict response allow-list); `routes/v1/dashboards.ts`: `GET /api/v1/dashboards`, `GET /api/v1/dashboards/:department`. No migration, no new permission code, no write route.                                                                          |
| Frontend         | `features/dashboards/` — one generic, data-driven `DepartmentDashboard` (lazy chunk), TH / EN / ZH copy, API types; CORE home: a one-department member lands on their dashboard; Owner / Executive get a Dashboard link per department and `/core/dashboards/:department`; System Admin gets a Company Control Center button; unassigned unchanged. |
| Tests            | `backend/test/ep47-dashboards.test.ts` (18: D1–D15 negative cases, strict-schema, read-only, W1–W4 workflow transitions); `frontend/src/features/dashboards/dashboards.test.tsx` (13).                                                                                                                                                              |
| Docs             | 5 new EP47 documents; UAT plan (DB-01 … DB-10), bug register (K-05, K-06), product-gap matrix (#9), permission matrix, release-gate matrix, PERFORMANCE.md, CORE_WORLD.md updated.                                                                                                                                                                  |

## 2. Dashboard coverage by department

| Department              | Metrics                                                                                                                                                                                                                                                                         | Work queues                                                         | Notes                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| Sales                   | 11 (new 7 d, awaiting confirmation / allocation / fulfilment, in delivery, partially delivered, lines outstanding, delivery exceptions, delayed, delivered 7 d, my drafts)                                                                                                      | work (SUBMITTED + exactly-one fulfilment stage), recently delivered | fulfilment state of own orders without Warehouse rights     |
| Production (Operations) | 12 (drafts, awaiting approval, awaiting reservation, materials short, ready, issues to post, in production, paused, output to review, completion review, overdue, completed 7 d)                                                                                                | work with outstanding OUTPUT                                        | both BOM modes; manufacturing mode shown; no recipe data    |
| Warehouse               | 19 (incoming, overdue incoming, receipts to post, orders to pick, picks, packs, ready to dispatch, in transit, delivery exceptions, transfers, adjustments draft / to approve, counts open / to review, lots expiring / expired, FG to receive, FG drafts, material issues 7 d) | one work queue                                                      | quantities only — no money                                  |
| Purchasing              | 9 (requests awaiting decision, approved not ordered, POs to issue, waiting deposit, open, partially received, lines outstanding, overdue receipts, production shortages)                                                                                                        | requests, orders                                                    | no deposit amount, no Accounting action                     |
| Accounting              | 4 (deposits pending, overdue, confirmed 30 d, waived 30 d)                                                                                                                                                                                                                      | supplier deposits (with amount)                                     | scope note: no GL / AR / tax / bank; no PDA ONE integration |

## 3. Metric definitions and aggregation sources

Every metric's source table, status interpretation, company / branch scope, department access rule, time range,
refresh behaviour, empty-state meaning, pending / blocked definition and drill-down are in
[EP47_METRIC_DEFINITIONS.md](EP47_METRIC_DEFINITIONS.md). Aggregation: PostgreSQL `GROUP BY` + `LATERAL` sums for Sales
stages, purchase-request ordering and purchase-order receive progress (one statement each, no N+1); indexed counts and
bounded lists elsewhere; Production reuses `ProductionOrderService.context()` (the module's own canonical counts).
Nothing is stored; no second state machine.

## 4. Work-queue coverage

Rows carry document number, business context (customer / supplier / item / department / reason), status, next step,
responsible department, relevant date (+ overdue), line progress or output quantity, and a link to the canonical
document — only when the person may open it. `canAct` ("Your step") reflects the effective permission for that step;
the step happens on the document screen (EP41 independent approval and owner override unchanged). No mutation flow was
built into the dashboard.

## 5. Owner / Executive / System Admin

- **Owner:** every department dashboard (cards + `/core/dashboards/:department`), `canAct` where the owner holds the step;
  approvals still enforce independent approval on the document (no dashboard write route accepts `ownerOverride`).
- **Executive:** every enabled department, READ-only (`access: READ`, every `canAct: false`); the Executive card stays
  "later phase"; `GET /dashboards/executive` → 404 (EP48).
- **System Admin:** no dashboard (`[]`, 403 everywhere), administrative functions via the Company Control Center button.
- **Unassigned / ambiguous:** no dashboard, no operational request.

## 6. Security and privacy evidence

| Evidence                                | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EP47 backend suite (disposable cluster) | **18 / 18**: D1 matrix 12 people × 5 dashboards; D2 / D14 Warehouse no money (sentinel prices, money-key regex, `amount` null); D3 no recipe keys for Staff / Viewer / Executive / Manager / Owner; D4 / D12 no write route, state hash unchanged; D7 second company sees zeros; D8 every row in the selected branch + per-branch recounts; D9 forged ids 400; D11 DENY / reassignment effective on the next request, `no-store`; D13 every link opens for its holder; D15 deposit amount Accounting-only; strict schema refuses unknown fields; reading every dashboard as everyone changes no business table |
| Existing sweeps over the new routes     | EP40 security, EP45 department (incl. A18 Warehouse money sweep over every GET route), EP46 recipe sweep, warehouse privacy: **56 / 56**                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Frontend                                | 13 dashboard tests: landing per role, read-only queue (only button: Refresh), revoked permission clears numbers, stale-on-network-failure, other-branch answer discarded, session ended, no refresh loop on own 403, interval only while visible, copy parity                                                                                                                                                                                                                                                                                                                                                  |

## 7. Test counts

| Gate                                                         | Result                                                                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend: Prisma validate · typecheck · lint · format · build | pass                                                                                                                                                 |
| Backend full suite (disposable cluster `127.0.0.1:55443`)    | **593 / 593** (41 files; EP46 575 + 18 EP47)                                                                                                         |
| Frontend: typecheck · lint · format                          | pass                                                                                                                                                 |
| Frontend full suite                                          | **1,185 / 1,185** (65 files; EP46 1,172 + 13 EP47)                                                                                                   |
| Build + prerender + budgets                                  | 108 pages + 3 shells; all JS **4,163.5 / 4,300**; initial JS **182.8 / 205** gzip; initial CSS 50.8 / 52; static HTML **525.1 / 560**; no cap raised |
| Ops tool tests                                               | 21 / 21                                                                                                                                              |
| Secret scan (staged added lines)                             | SECRET_SCAN                                                                                                                                          |

## 8. Real-stack verification

Fresh database on the disposable cluster (`pdabliss_core_ep47_qa`: `prisma migrate deploy` + demo seed), the EP47
backend running over HTTP on port 2112, nine real personas signing in: **129 / 129** checks —

- access matrix (index + 5 dashboards × 9 personas), `no-store`, no write route (Owner / Executive), forged branch 400,
  Warehouse answer without money, Executive without recipe keys and never `canAct`;
- reading every dashboard creates no stock movement and no audit row;
- **Sales order** created → submitted → confirmed → allocated → picked → packed → dispatched → delivered: Sales stage moves
  through exactly one metric at a time; Warehouse picks / packs / ready / in transit move and return;
- **Purchase requisition → purchase order → goods receipt**: Purchasing and Warehouse counts move together and return
  to baseline after posting;
- **Manufacturing order** (BOM_REQUIRED and BOM_OPTIONAL): submitted → approved → reserved → released → started → issue
  (draft / posted) → consumption → output (review / accepted) → finished goods (to receive / posted) → completion review →
  completed — exactly one state metric at each step, the same in both modes;
- `uat/integrity.sql` **0 mismatches** after every flow and at the end.

The first full run reported 128 / 129: the one failure was the script's own check (a case-insensitive regex that matched
the _value_ `"REQUIRED"` of a `dateKind`, not a recipe key); with the check limited to keys, as in test D3, the run is
129 / 129.

The same four flows run in the backend suite (W1–W4) on the seeded test database. (The API's global rate limit, 300
requests / min, was raised to 5,000 for the disposable QA backend only, via its environment, because the script sends
several hundred requests per minute; no code or default changed.)

## 9. Browser, accessibility and responsiveness

QA stack (frontend 2111 → backend 2112, disposable DB). Verified in the browser pane:

- Sales staff lands on the Sales dashboard (TH); Owner sees Dashboard links on five department cards (EN) and opens the
  Warehouse dashboard **by keyboard** (focus + Enter); Production dashboard in **ZH** with mode pill and "Your step"
  rows for the owner; Accounting manager at **390 px** in TH with the scope note; System Admin landing with the Control
  Center button; Executive read-only via API.
- No horizontal page overflow at **390 / 768 / 1024 / 1280 / 1440 / 1920 px** (`scrollWidth ≤ innerWidth`, no element
  past the right edge).
- Structure: one `h1` (CORE home) → dashboard `h2` → group / queue `h3`; regions labelled by the dashboard title;
  every link and button has a name; update time in an `aria-live` region; status and overdue shown as text (+ icon),
  never colour alone; reduced motion respected (spinner static).
- No backend error logged; the CORE World production build compared with the EP46 build (identical frame, hover /
  click / deselect, remount).
- The CORE World also checked on the dev server (React StrictMode double mount): one canvas, live WebGL context, no error.

**Found and fixed during QA:** (1) a refresh loop — the dashboard listened to the global "authorization changed" event,
which its own 403 raises; it now ignores the event while its own request is out and re-checks only when numbers are on
screen (regression test added); (2) the EP21 guard requires shared GPU resources to be released by an unmount effect —
restored exactly; (3) one existing test encoded the pre-EP47 landing (an assigned member saw a department card) and now
expects the member's dashboard.

## 10. JS bundle

All JS **4,286.0 → 4,124.9 (recovery) → 4,163.5 KiB** (−122.5 vs EP46; headroom 14 → 136.5 KiB); CORE World chunk 182.5 →
133.2 KiB gzip; initial JS 182.9 → 182.8 KiB gzip; initial CSS 50.8 unchanged; static HTML 525.6 → 525.1 KiB. Details:
[EP47_PERFORMANCE_REPORT.md](EP47_PERFORMANCE_REPORT.md).

## 11. Inventory reconciliation

`uat/integrity.sql`: 0 on every check after each workflow (backend suite W1–W4 and real stack). Dashboards issue only
reads: no `StockMovement`, `StockBalance`, reservation or audit row is written by any dashboard request (state-hash and
row-count checks).

## 12. Dev / UAT data preservation

All database work used the disposable PostgreSQL 18 cluster `127.0.0.1:55443` (session scratchpad): test database
`pdabliss_core_ep47_test` (28 migrations applied by the suite) and QA database `pdabliss_core_ep47_qa`. The owner's
`pdabliss_core_dev` (localhost:5432) was only read once at the end, read-only: its newest write anywhere is
**2026-10-26** — nothing written by EP47. No UAT database exists on this workstation; none was created. Ports 1111 /
1112 were not used. `.claude/launch.json` restored after QA.

## 13. Remaining limitations

1. Owner UAT `DB-01 … DB-10` NOT TESTED.
2. No targets, trends or charts (no meaningful trend data yet); no notifications; no export.
3. The Executive Command Center (cross-department oversight) is EP48; the Executive uses the department dashboards.
4. Material readiness (`materialsShort`) and `partiallyDelivered` are attribute counts that overlap the state metrics
   by design (documented); all state / stage metrics are mutually exclusive.
5. Work queues show the first 8 rows (true total shown); the full list is on the module screens.
6. Dashboards refresh by polling every 120 s while visible (no push); a change made in another tab appears on the next
   refresh or on Refresh.
7. EP44 production blockers unchanged.

## 14. Status

Committed locally · **Push: NOT PUSHED** · **Deploy: NOT DEPLOYED** · **EP48: NOT STARTED**.
