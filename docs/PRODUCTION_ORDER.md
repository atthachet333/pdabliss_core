# Production Orders and Material Planning (EP36)

Production planning in the **Operations** department: what to make, why, from which BOM revision,
how much material that needs, whether it is available now, and which orders are ready. **Planning
only** — no production order creates, edits, submits, approves, releases or cancels anything in
inventory. BOMs: [PRODUCTION_BOM.md](PRODUCTION_BOM.md). Report: [EP36_REPORT.md](EP36_REPORT.md).

**EP37** adds material reservation, material issue and execution on top of the frozen plan:
[PRODUCTION_MATERIAL_RESERVATION.md](PRODUCTION_MATERIAL_RESERVATION.md),
[PRODUCTION_MATERIAL_ISSUE.md](PRODUCTION_MATERIAL_ISSUE.md),
[PRODUCTION_EXECUTION.md](PRODUCTION_EXECUTION.md), [EP37_REPORT.md](EP37_REPORT.md). Planning
itself (this document) still writes nothing to inventory. **EP38** closes the lifecycle: output
reports, finished goods receipts (`PRODUCTION_OUTPUT`) and completion / short close —
[PRODUCTION_OUTPUT.md](PRODUCTION_OUTPUT.md),
[PRODUCTION_FINISHED_GOODS_RECEIPT.md](PRODUCTION_FINISHED_GOODS_RECEIPT.md),
[PRODUCTION_COMPLETION.md](PRODUCTION_COMPLETION.md), [EP38_REPORT.md](EP38_REPORT.md).

```
Sales demand / manual need → production order (DRAFT) → BOM → material requirements
→ availability (snapshot) → SUBMITTED → APPROVED (frozen) → READY
→ EP37 reservation (FEFO) → IN_PRODUCTION ⇄ PAUSED → material issue (PRODUCTION_CONSUMPTION)
→ EP38 output report → finished goods receipt (PRODUCTION_OUTPUT) → COMPLETION_REVIEW → COMPLETED
```

## 1. Model

`ProductionOrder` (branch-bound) and `ProductionOrderMaterial` (its requirements):

| Field | Meaning |
| --- | --- |
| `number` | `MO-YYYYMM-NNNNNN` — atomic `DocumentSequence` upsert (key `MO:YYYYMM`), never MAX + 1, immutable |
| `branchId` | composite FK to `(Branch, company)`; one branch per order |
| `source` | `MANUAL` or `SALES_DEMAND` (+ `salesOrderId` / `salesOrderLineId`, composite FKs that force the same company, the same branch as the order, and the line of that order) |
| item + unit snapshot | the finished item and its base unit |
| `bomId` + `bomCode` / `bomRevision` / `bomOutputQuantity` | the revision used (FK to `(bom, item, company)`: always a BOM of this item) |
| `quantity` | target output (exact decimal, unit precision) |
| `plannedStartDate`, `requiredDate` (≥ start), `priority` (LOW · NORMAL · HIGH · URGENT), `note` | planning facts |
| creator, submitted / approved / released / rejected / cancelled by and at, reasons | lifecycle facts |
| material: item + unit snapshot, `bomQuantity`, `requiredQuantity`, `lineNo` | one requirement |

No price, cost, value, customer or commercial field exists on either table.

## 2. Lifecycle

```
DRAFT → SUBMITTED → APPROVED → READY → IN_PRODUCTION ⇄ PAUSED            (EP37)
IN_PRODUCTION / PAUSED → COMPLETION_REVIEW → COMPLETED | IN_PRODUCTION     (EP38)
DRAFT → CANCELLED · SUBMITTED → REJECTED · APPROVED / READY / IN_PRODUCTION / PAUSED → CANCELLED
```

Transitions are defined once (`backend/src/production/policy.ts`) and enforced again by a database
trigger (any other move, a changed number / branch / source / item, or a changed plan after approval
is refused). EP37 added `IN_PRODUCTION` / `PAUSED` (PRODUCTION_EXECUTION.md); EP38 added
`COMPLETION_REVIEW` / `COMPLETED` (PRODUCTION_COMPLETION.md) — COMPLETED is terminal.
REJECTED and CANCELLED are terminal and stay in history (no deletes; approval facts are kept).

| Action | From | Who | Notes |
| --- | --- | --- | --- |
| create / edit / submit | DRAFT | creator with `operations.orders.create` | edit: quantity, BOM, dates, priority, note — requirements recalculated by the server |
| cancel | DRAFT | creator | reason optional |
| approve | SUBMITTED | `operations.orders.approve` | re-validates (below) and **freezes** the plan |
| reject | SUBMITTED | same | reason required |
| release | APPROVED | same | → READY only if every material is available **now** (`MATERIALS_SHORT` 409 otherwise) |
| cancel | APPROVED, READY, IN_PRODUCTION, PAUSED (EP37) | `operations.orders.cancel` | reason required; refused once material was issued (`MATERIAL_ALREADY_ISSUED`); releases ACTIVE reservations and cancels draft issues |

**READY policy.** READY means "released for execution with all materials available at release
time". Release itself reserves nothing, so later stock changes can make a READY order short
again — its material state is always recomputed and shown. Since EP37 the order can hold real
reservations (allocate from APPROVED on), and start requires every material reserved.

**Submit / approve re-validation.** The output item is still an active manufacturable finished good,
the BOM revision is still ACTIVE (locked FOR SHARE, so a concurrent retirement waits), every material
is active, the quantity fits the unit, and a sales source is still CONFIRMED (sales order row locked
FOR SHARE). Requirements are recomputed and snapshots refreshed; at approval they freeze (a trigger
refuses any material change once the order is past SUBMITTED). A later BOM revision never changes an
approved order.

## 3. Draft editing

Only the creator edits a DRAFT. The client sends plan fields only; `materials`, `requiredQuantity`,
`available`, `status`, `companyId`, `approvedBy` and every other server-owned field are refused with
400 (strict schemas). A draft whose BOM revision was retired is flagged `BOM_RETIRED` and cannot be
submitted until the active revision is chosen.

## 4. Permissions (Operations codes — EP27 + EP36)

| Code | Tier | Use |
| --- | --- | --- |
| `operations.orders.view` | READ | orders, requirements, sales demand |
| `operations.orders.create` | OPERATE | draft, edit, submit, cancel own drafts |
| `operations.orders.approve` (EP36) | MANAGE | approve / reject / release |
| `operations.orders.cancel` (EP36) | MANAGE | cancel approved / ready orders |
| `operations.bom.view` / `.manage` (EP36) | READ / MANAGE | BOM revisions |
| `purchasing.production_shortages.view` (EP36) | READ | Purchasing shortage handoff |
| `operations.materials.manage` (EP37) | MANAGE | reserve, release, reallocate, excess |
| `operations.material_issues.create` / `.approve` (EP37) | OPERATE / MANAGE | draft / post material issues |
| `operations.material_usage.create` (EP37) | OPERATE | record usage |
| `operations.execution.manage` (EP37) | MANAGE | start / pause / resume |
| `warehouse.material_issues.view` (EP37) | READ | Warehouse read-only issue handoff |
| `operations.orders.edit`, `.update_status` | — | reserved (editing a draft is part of create) |

Role defaults (EP27 tiers): **Department Staff** in Operations = Production Staff (view, create,
submit, requirements); **Department Manager** in Operations = Production Manager (+ approve / reject
/ release / cancel / BOM manage); **Owner** everything; **Executive** reads only; **System Admin**
nothing unless assigned to Operations, and then never MANAGE; Sales, Warehouse and Accounting roles
hold no Production code. A DRAFT is visible only to its creator and approvers; every order needs the
member's branch access — another branch's or company's order is 404, an inaccessible branch choice
403 `BRANCH_NOT_ALLOWED`.

Demo: `operations.demo` stays **Department Manager** (branches 00000 + 00001) — the Production
Manager persona; no Production Staff persona was added (the real-stack QA assigned a staff member to
Operations in its scratch database only).

## 5. Sales-linked production

A SALES_DEMAND order is created **explicitly** from one line of a **CONFIRMED** sales order — never
automatically. The client sends `salesOrderLineId` (plus plan fields); item and branch come from the
line on the server (sending `itemId` or `branchId` as well is 400). The line must be a stock-tracked
finished good (`ITEM_NOT_MANUFACTURABLE`), in a branch the member works in (otherwise 404
`SALES_LINE_NOT_FOUND`), and its order CONFIRMED (`SALES_SOURCE_NOT_CONFIRMED`). The planner chooses
the quantity.

**Demand formula (read-only, deterministic)** — `GET /production/demand`:

```
allocated      = ACTIVE + CONSUMED reservations of the line (EP34/EP35)
open           = max(0, ordered − allocated)        (= ordered − reserved − dispatched)
availableShare = the branch's available stock (on hand − every ACTIVE reservation), shared out
                 line by line: requested date (none last), order number, line number
uncovered      = open − availableShare
planned        = Σ quantity of OPEN production orders (DRAFT · SUBMITTED · APPROVED · READY) of the line
suggested      = max(0, uncovered − planned)         — information only
```

**No double counting.** Planned quantities are subtracted once; a second open order for the same
line is allowed but both are flagged `DEMAND_ALREADY_PLANNED` (`demand.overPlanned`), and the demand
row lists every order planned for it.

**Not a reservation.** A production order reserves no sales stock, planned output is never
StockBalance, and Sales allocation never sees planned output (tested: allocated stays what stock
covered).

**Privacy.** Production sees the sales order number, status, requested date, line number, item,
unit and operational quantities — never price, discount, tax, total, margin, payment, customer name
or commercial note (allow-list views, tested key by key and value by value).

**Cancellation interaction.** New linked orders from a cancelled (or not yet confirmed) sales order
are refused; submit, approve and release re-validate the source; an order whose source is cancelled
afterwards stays as it is but is flagged `SOURCE_CANCELLED` (list `attention`, detail warning,
overview count) for explicit review — nothing is cancelled or deleted automatically. Sales cancel and
production approval serialize on the sales order row: either approval sees CONFIRMED and the cancel
follows (order flagged), or the cancel commits first and approval is refused — never an unflagged
approval against a cancelled source (tested, three rounds).

## 6. Material requirements

```
required = target × BOM line quantity ÷ BOM output quantity
```

Computed in exact integers (every quantity has ≤ 6 decimal places, so each is an integer number of
millionths) and **rounded UP** to the material unit's decimal places — never truncated, never
under-planned; `exact = false` marks a rounded line (e.g. 2 pieces ÷ 3 → 1, 0.000333 kg → 0.001).
Values larger than `Decimal(18,6)` are refused (`REQUIREMENT_TOO_LARGE`). The client never sends a
requirement; `GET /requirements/preview?bomId&quantity&branchId` returns the server's computation
without saving anything (the editor shows it before submission).

## 7. Availability (planning, not reservation)

```
available = Σ over the order's branch balances of the material that FEFO would offer
            (on hand > 0, lot not expired): on hand − ACTIVE sales AND production reservations
```

— exactly the reservation-aware figure Sales uses (`sales/availability.ts → stockFor`, through the
shared `warehouse/reservations.ts` guard since EP37), so it is never raw on hand. Other branches' stock never counts; expired lots never count. Per material:
`AVAILABLE` (available ≥ required) · `PARTIALLY_AVAILABLE` · `UNAVAILABLE` (none), shortage =
max(0, required − available). Per order: `MATERIALS_AVAILABLE` · `MATERIALS_SHORT` · `NOT_ASSESSED`
(no BOM yet, or REJECTED / CANCELLED). Recomputed on every read, never stored.

**A snapshot, not a claim — until reserved.** Two approved orders may both show the same available
stock; only an EP37 allocation turns availability into a claim (PRODUCTION_MATERIAL_RESERVATION.md). Cycle-count locks do not
change availability (they block movements, which EP36 never writes); EP37's material issue goes
through `applyMovement()` and meets them there.

`GET /production/requirements?branchId` aggregates the branch's SUBMITTED / APPROVED / READY orders
per material: required, available, shortage, state, order count, earliest required date.

## 8. Purchasing handoff (read-only)

`GET /api/v1/purchasing/production-shortages?branchId` (`purchasing.production_shortages.view`,
Purchasing roles by default): per APPROVED / READY order and material still short now — material,
required, available, shortage, required / planned start date, source order number, branch. No price,
cost, supplier or customer. Nothing is requested or ordered automatically (no purchase request is
created — tested). Purchasing cannot open production orders or BOMs.

## 9. Inventory integrity

Production **planning** writes **no** StockMovement, StockBalance or SalesAllocation row (tested before
and after every step: movement count, every balance and reservation with its `updatedAt`, purchase
requests and orders all identical). Since EP37 the only Production stock writer is a posted
material issue (`PRODUCTION_CONSUMPTION`); finished goods appear in stock only through a future
receipt.

**Implemented in EP37:** production order → material reservation (FEFO, the production counterpart
of EP34) → material issue → `PRODUCTION_CONSUMPTION` (negative) through `ledger.ts applyMovement()`,
count locks and the reserved-stock guard intact; frozen `ProductionOrderMaterial` rows are the issue
targets.

**Implemented in EP38** (the contract below): output report → finished goods receipt →
`PRODUCTION_OUTPUT` (positive) through `applyMovement()`; only then is output stock Sales can
allocate (PRODUCTION_FINISHED_GOODS_RECEIPT.md).

- **EP38 finished goods receipt:** manufacturing completion → finished goods receipt →
  `PRODUCTION_OUTPUT` (positive) through `applyMovement()`, lots / expiry per EP31 rules; only then
  does output become stock that Sales can allocate.

## 10. Concurrency

Every transition locks the order row (`FOR UPDATE`) and checks the action centrally: double submit,
triple approve, approve vs reject, release vs cancel, cancel twice — one transition, one audit event,
409 for the others, never 500. Draft edit vs submit: whichever is first wins and the stored
requirements always match the stored quantity. Numbering under 10 concurrent creates is unique and
consecutive. BOM activation and sales cancellation races: see above and PRODUCTION_BOM.md §4.

## 11. Audit

`PRODUCTION_ORDER_CREATED / UPDATED / SUBMITTED / APPROVED / REJECTED / RELEASED / CANCELLED` on
entity `ProductionOrder` (number, source, from → to, changed field names, material count — never
quantities or reasons' values), shown as each order's timeline and redacted on the Platform explorer.
EP37 adds `PRODUCTION_MATERIALS_ALLOCATED / RELEASED / REALLOCATED`, `PRODUCTION_EXCESS_ALLOCATED`,
`PRODUCTION_ORDER_STARTED / PAUSED / RESUMED`, `PRODUCTION_MATERIAL_USAGE_RECORDED` and the
`MATERIAL_ISSUE_*` events on `ProductionMaterialIssue` (shown in the same timeline).

## 12. API (`/api/v1/production`)

`GET /context` · `GET /orders` (status, branchId, itemId, source, materials=SHORT|AVAILABLE, from / to
planned start, q, page, pageSize ≤ 100) · `POST /orders` · `GET /orders/:id` · `PATCH /orders/:id` ·
`POST /orders/:id/submit|approve|release` (no body) · `POST /orders/:id/reject|cancel {reason?}` ·
`GET /requirements/preview` · `GET /requirements` · `GET /demand`. EP37: `stage=RESERVATION|EXECUTION`
on `GET /orders` · `POST /orders/:id/materials/allocate|release|reallocate` ·
`POST /orders/:id/materials/:materialId/excess` · `POST /orders/:id/start|pause|resume {note?}` ·
`POST /orders/:id/usage` · `/issues` (PRODUCTION_MATERIAL_ISSUE.md §7).

## 13. Screens (`/core/production`, one lazy chunk)

Overview (counts: my drafts, awaiting approval, approved, ready, materials short, sales demand to
review, sales source cancelled) · Production orders (server-paged, filters) · order editor (finished
item search, branch, the active BOM, quantity, dates, priority, note, live server preview) · order
detail (facts, demand, materials vs availability, warnings, draft editor, confirm-box actions with
focus return, timeline) · BOMs (list, draft editor, activate / retire / revise, revision history) ·
Material requirements · Sales demand (create from a line). Purchasing: `/core/purchasing/production-shortages`
(its own tiny chunk). TH / EN / ZH; cards below md (below lg for the two widest lists).

## 14. Known limitations (deliberate)

- EP37 added reservation, issue, consumption and start / pause / resume; EP38 added output,
  finished goods receipt and completion. Still no returns, rework, scrap, costing or routing.
- No capacity, routing, work centre, labour, machine or scheduling logic; dates are plain plan dates.
- Single-level BOMs only; no unit conversion; no scrap / yield.
- No automatic production orders and no automatic purchase requests.
- No costing, valuation or margin.

## EP46

- Optional BOM: an owner-chosen `BOM_OPTIONAL` company may plan an order's materials explicitly (`materialPlan:
  MANUAL`, `PUT /production/orders/:id/materials`) — [EP46_MANUFACTURING_POLICY.md](EP46_MANUFACTURING_POLICY.md).
- Recipes are confidential: BOM lines, output basis, previews and unreleased BOM quantities need
  `operations.recipes.view` — [EP46_RECIPE_CONFIDENTIALITY_MATRIX.md](EP46_RECIPE_CONFIDENTIALITY_MATRIX.md).
