# EP37 Report — Material Reservation, FEFO Allocation, Material Issue & Production Execution Foundation

**Verdict: PASS.**

- **Baseline:** `a93f815` (EP36).
- **Work in progress:** checkpointed as `91cc7fc` and pushed by the owner for the office → condo
  handoff.
- **Final commit:** local only, `feat: add CORE material reservation and production execution
  foundation (EP37)`. **Not pushed, not deployed.**
- **EP38:** not started.

Design docs: [PRODUCTION_MATERIAL_RESERVATION.md](PRODUCTION_MATERIAL_RESERVATION.md),
[PRODUCTION_MATERIAL_ISSUE.md](PRODUCTION_MATERIAL_ISSUE.md) and
[PRODUCTION_EXECUTION.md](PRODUCTION_EXECUTION.md). Ledger: [INVENTORY_LEDGER.md](INVENTORY_LEDGER.md)
§11. Budget: [PERFORMANCE.md](PERFORMANCE.md).

## 1. Phase 0 — architecture and performance gate

**Bundle.** EP36 left 4,122.4 / 4,300 KiB, with about 178 KiB of headroom. The chunk graph was
inspected first:

- every EP37 screen is a lazy chunk inside the Production route;
- there are no eager Warehouse / Sales imports, no new dependency and no new UI framework;
- the EP36 `CoreCanvas` optimization is untouched.

No recovery was needed. EP37 adds **+44.6 KiB**, so all JS is **4,167.0 / 4,300**, with about
**133 KiB** of headroom.

**Architecture decisions** (made before implementation):

| Question | Decision |
| --- | --- |
| How do Production and Sales reservations coexist? | One shared guard, `warehouse/reservations.ts`: reserved = ACTIVE sales + ACTIVE production per (location, item, lot) |
| Who owns availability? | That module, for every reader: Sales, Production, transfer / adjustment drafts, the ledger decrease guard |
| How does an issue consume a reservation? | Each issue line names one reservation row (composite FK, same place). Posting consumes that row, never another |
| How does a partial issue work? | The row is decremented, and a CONSUMED split row (`splitFromId`) records the issued part |
| How is concurrency handled? | One lock order: order → document → location advisory locks → balances (id order) → reservations (id order). Allocations lock balances before reading reservations |
| Where does execution status live? | On `ProductionOrder` (`IN_PRODUCTION`, `PAUSED`), not in a separate entity |
| What is planned and what is physical? | Planned = frozen requirements; reserved / issued = physical claims and movements; used = evidence only |
| How does EP38 connect? | It adds completion and `PRODUCTION_OUTPUT` (positive) through `applyMovement()`; EP37 semantics do not change (§6) |

## 2. What was built

| Area | Summary |
| --- | --- |
| Quantities | on hand (StockBalance + ledger) · sales reserved · production reserved · total reserved · available for new allocation = on hand − total reserved (never negative) · issued to production |
| Reservation | `ProductionMaterialAllocation`: FEFO (expiry, receipt, id), same branch, active locations, unexpired lots; still needed = required − non-excess (ACTIVE + CONSUMED); partial reservation with the shortage reported; repeatable (never double); one ACTIVE row per place (unique slot); ACTIVE → CONSUMED / RELEASED (RELEASED · REALLOCATED · ORDER_CANCELLED); triggers keep the history |
| Release / reallocate | ACTIVE rows only; refused while a DRAFT issue exists (`MATERIAL_ISSUE_PENDING`); `MO_NOT_RESERVED` when there is nothing to release |
| Excess | manager-only, reason required, `excess = true` rows; never counts toward the requirement; issued like any reservation |
| Order status | + `IN_PRODUCTION`, `PAUSED` (their own enum migration). Start: READY, every material reserved + issued ≥ required (`MATERIALS_NOT_RESERVED`), sales source CONFIRMED. Pause ⇄ resume. Cancel only while nothing was issued (`MATERIAL_ALREADY_ISSUED`); it releases reservations and cancels draft issues |
| Material issue | `MI-YYYYMM-NNNNNN` (DocumentSequence `MI:YYYYMM`), DRAFT → POSTED / CANCELLED. Lines = this order's ACTIVE reservations (all unclaimed, or chosen quantities ≤ unclaimed). Posting is one transaction: consume the exact reservation (whole or split), then `PRODUCTION_CONSUMPTION` through `applyMovement()`. A second post → `MI_ALREADY_POSTED`; unique (issue line, type) |
| Usage | `ProductionMaterialUsage`, append-only. Σ ≤ issued (`USAGE_EXCEEDS_ISSUED`). No movement. Variance = used − required; unrecorded = issued − used |
| Leftover material | issued but unused material stays visible as `unrecorded`; no automatic return. A return document with its own positive movement type is future work |
| Guards | transfer, adjustment, count correction and GR reversal refuse reserved stock (sales or production) with `STOCK_RESERVED`; an open count blocks issue posting (`COUNT_IN_PROGRESS`); dispatch consumes only sales rows |
| Warehouse | read-only handoff `/core/warehouse/material-issues` (`warehouse.material_issues.view`): drafts to prepare, posted issues; location, lot, expiry, quantity; no money |
| Permissions | `operations.materials.manage` (MANAGE), `operations.material_issues.create` (OPERATE), `operations.material_issues.approve` (MANAGE = post), `operations.material_usage.create` (OPERATE), `operations.execution.manage` (MANAGE), `warehouse.material_issues.view` (READ). Override CHECK 70 → **76** |
| UI | lazy `ExecutionPanel` (order detail: state, materials table, actions with confirm box and focus return), `IssuesArea` (list, create, lines, post, cancel), Reservations and Execution lists, overview tiles, Warehouse handoff; TH / EN / ZH (`execCopy.ts`); cards below md |
| Audit | 8 order actions (allocated, released, reallocated, excess, started, paused, resumed, usage) + 4 issue actions (`ProductionMaterialIssue` in `BUSINESS_AUDIT_ENTITIES`, redacted on the Platform explorer); one order timeline |
| Demo | owner adjustment +5 kg RM-000001 / RM-DEMO-02 (`OTHER`, through AdjustmentService); approved order fully reserved; MO in production with MI #1 POSTED, usage recorded and MI #2 DRAFT; one partially reserved order; guarded and idempotent; no persona elevated |

## 3. Gates

| Gate | Result |
| --- | --- |
| Prisma validate · migrate diff | valid · no drift (migrated QA and upgrade DBs vs schema) |
| Backend typecheck · lint · format · build | pass · 0 problems · clean (4 files reformatted: line endings only) · pass |
| Backend tests | **30 files, 472 tests passed** (EP36: 29 / 453). New: `production-execution.test.ts` (19); `production`, `demo-personas` and `inventory-control` contracts updated |
| Frontend typecheck · lint · format | pass · 0 problems · clean |
| Frontend tests | **57 files, 1,108 tests passed** (EP36: 56 / 1,101). New: `execution.test.tsx` (7); `--maxWorkers=2` |
| Build · prerender · verify-prerender · perf | pass · 108 pages + 3 shells · pass · within budget |
| Fresh migration · seed twice | 22 migrations applied; second seed changed nothing (the `MasterCodeSequence` drift was fixed: `reserveThrough` only raises the counter) |
| Upgrade EP36 → EP37 | see below |
| Real-stack E2E (scratch `pdabliss_core_qa37`, ports 2111 / 2112) | **97 / 97** (`qa-ep37` 85 + deterministic section H 12), no server errors |
| UI QA — in-app browser · headless Edge 156 · headless Chrome 156 | **96 / 96 each** (8 screens × 390 / 768 / 1440 / 1920 px × TH / EN / ZH) |
| Ledger reconciliation (after every E2E section and race) | 0 mismatches · 0 negative balances · 0 unmatched PRODUCTION_CONSUMPTION · reserved (sales + production) ≤ on hand |
| Secret scan (EP37 diff + new files) | clean |

**Upgrade EP36 → EP37** (`pdabliss_core_up37`):

- the migration changed **no data** in the 63 EP36 tables;
- it added 4 tables and 6 nullable columns, with no drift;
- the EP37 seed changed only the demo StockBalance rows (the demo issue) and added rows;
- a second seed changed nothing;
- EP36 AuditLog / SalesOrder / SalesOrderLine / StockMovement rows are identical;
- invariants are 0, and both PRODUCTION_CONSUMPTION movements are matched.

**UI QA checks:** no horizontal overflow, one h1, labelled controls, targets ≥ 24 px, no duplicate
ids, no money outside Sales. The Warehouse handoff was also checked with the warehouse persona at 390
and 1440 px in three languages: read-only, with a visible keyboard focus ring on the filter. The
Warehouse persona gets 403 on a production order.

**E2E coverage (97):**

| Area | What was checked |
| --- | --- |
| FEFO | SOON 40 before LATER 60; expired and Head Office lots excluded |
| Partial / shortage | partial 10 with shortage 40; reservation writes zero movements |
| Start | refused until fully reserved |
| Issue posting | triple post → one 200 and two `MI_ALREADY_POSTED`; on hand −40 exactly; partial issue split history |
| Usage | usage 35 / unrecorded 5 / variance −65 with no stock change; usage race capped at issued |
| Sales vs Production | 7 + 7 on 10 → total 10, three rounds; dispatch consumes only sales rows |
| Guards | transfer 4 refused / 2 allowed; adjustment refused; count correction refused; GR reversal refused (`STOCK_RESERVED`); an open count blocks issue posting |
| Access | IDOR (other branch 404), roles (Staff cannot post / reserve / start; Executive read-only; System Admin / Sales / Accounting 403; Purchasing sees only its shortage handoff; Warehouse sees only the issue handoff, and System Admin / Sales get 403 on it) |
| Input / output | mass assignment 400; privacy (no price / cost / customer in any production or handoff response); audit without quantities |
| Races | issue vs dispatch (three rounds); issue vs order cancel (two concurrent rounds + one sequential round: posted → cancel `MATERIAL_ALREADY_ISSUED`) |
| Reconciliation | after every section |

**Backend tests (19):**

- reservation semantics: FEFO, partial, repeatable, branch, expiry, combined Sales / Production
  guard;
- release / reallocate / excess rules;
- execution transitions and start precondition;
- issue draft rules (claims, precision, duplicates);
- posting (exact consumption, split, double post, ledger effect, count lock);
- usage cap and no-stock effect;
- cancellation guards;
- transfer / adjustment / count / reversal guards;
- Warehouse handoff and permissions, privacy, isolation;
- races (allocation vs sales allocation, post vs post, post vs cancel).

**Regression:**

- every earlier backend suite (auth, platform / audit, company, permissions, master data, PR, PO,
  receiving / lots / FEFO, transfer / adjustment / count, sales orders, allocation, fulfilment, EP36
  production planning) passes;
- every frontend suite (public site, auth, CORE) passes.

**One EP35 race assertion was widened** (`sales-fulfilment.test.ts`, dispatch vs release /
reallocate):

- **The race.** When the dispatch commits first, nothing is staged and no reservation is ACTIVE, so
  release / reallocate correctly answer 409 `SO_NOT_ALLOCATED` and write nothing. The test had only
  listed the codes for the other ordering.
- **What it is.** The final gate run exposed this timing once. It is a test gap; no sales code
  changed in EP37.
- **What stays strict.** The other assertions (dispatch 200, the other side 409, order still
  CONFIRMED, invariants) are unchanged. Cancel still allows only its two codes.
- **Verification.** The suite then passed 15 / 15 three times in a row.

Contract updates on purpose: 76 override codes; demo stock and movement counts; `STOCK_RESERVED`
wording "(for sales or production)"; the `actions` lists including `allocate`.

## 4. Block conditions — all clear

None of these occurs:

- either side reserving the other's stock;
- combined reservations exceeding on hand;
- a reservation-only change to a balance;
- a double post, or a ledger bypass;
- a production issue consuming a sales reservation, or the reverse;
- negative or divergent stock;
- a partial issue consuming the whole reservation;
- usage changing stock;
- production output in inventory (none exists);
- over-reservation or over-issue under concurrency;
- a count lock bypass;
- cross-branch / company / lot / location misuse;
- unauthorized posting or privilege escalation;
- a financial leak, IDOR or mass assignment;
- a broken BOM snapshot;
- migration data loss;
- an EP36 / 35 / 34 / 32 regression;
- an exceeded cap;
- a tracked secret.

## 5. Performance

| Chunk | Raw / gzip |
| --- | --- |
| `ExecutionPanel` | 8.1 / 2.8 KiB |
| `IssuesArea` | 7.2 / 2.7 KiB |
| `execCopy` (TH / EN / ZH) | 20.0 / 6.3 KiB |
| `MaterialIssueHandoff` | 2.5 / 1.1 KiB |
| `ProductionArea` · `prodParts` | 32.3 / 8.6 · 40.1 / 12.2 KiB (EP36: 31.2 · 37.5) |

| Budget | Value |
| --- | --- |
| All JS | 4,167.0 / 4,300 KiB (+44.6) |
| Initial JS | 182.6 / 205 KiB gzip |
| Static HTML | 528 / 560 KiB |
| Headroom | ≈ 133 KiB |

No cap was changed.

## 6. EP38 integration contract

Manufacturing completion → finished goods receipt → `PRODUCTION_OUTPUT` (positive) through
`applyMovement()`, with lots / expiry per the EP31 rules. Only then does output become stock that
Sales can allocate. EP38 reads EP37's issued / used figures as evidence and changes no EP37 semantics:

- reservations stay claims;
- `PRODUCTION_CONSUMPTION` stays the only consumption movement;
- `COMPLETED` follows `IN_PRODUCTION`.

## 7. Known limitations (deliberate)

- No completion, finished goods receipt or `PRODUCTION_OUTPUT` (EP38).
- No material return, scrap or yield document; no posting reversal; variance is evidence only.
- FEFO only: no manual lot / location choice; no Sales vs Production priority (first committed wins).
- No costing, valuation, GL, payroll, labour, routing or capacity.
- Firefox and axe are not available on this machine (in-app Chromium, Edge and Chrome were checked).
