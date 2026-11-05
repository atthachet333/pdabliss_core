# Production Execution and Usage (EP37)

Production execution adds the shop-floor states to a production order: **start**, **pause** and
**resume**. It also adds usage evidence: what production actually used of the issued material. It
does not include completion or finished goods receipt (EP38). Orders:
[PRODUCTION_ORDER.md](PRODUCTION_ORDER.md). Reservations:
[PRODUCTION_MATERIAL_RESERVATION.md](PRODUCTION_MATERIAL_RESERVATION.md). Issues:
[PRODUCTION_MATERIAL_ISSUE.md](PRODUCTION_MATERIAL_ISSUE.md).

## 1. Lifecycle (EP36 + EP37)

```
DRAFT → SUBMITTED → APPROVED → READY → IN_PRODUCTION ⇄ PAUSED
cancel: DRAFT (creator) · APPROVED · READY · IN_PRODUCTION · PAUSED (only while nothing was issued)
```

`IN_PRODUCTION` and `PAUSED` are new `ProductionOrderStatus` values. They are added in their own
migration, `20261109090000_ep37_enum_values`, because PostgreSQL cannot use an enum value in the
transaction that adds it. The `production_order_guard` trigger enforces the same transitions as
`production/policy.ts`. `startedAt` / `startedByMemberId`, `pausedAt` and `executionNote` are new
nullable columns. EP38 continues the lifecycle with `COMPLETION_REVIEW` → `COMPLETED`
([PRODUCTION_COMPLETION.md](PRODUCTION_COMPLETION.md)): release and usage stay possible under review.

| Action | From | Code | Rule |
| --- | --- | --- | --- |
| allocate / release / reallocate | APPROVED · READY · IN_PRODUCTION · PAUSED | `operations.materials.manage` | see the reservation doc |
| excess | IN_PRODUCTION · PAUSED | `operations.materials.manage` | reason required |
| start `{ note? }` | READY | `operations.execution.manage` | every material reserved + issued ≥ required (409 `MATERIALS_NOT_RESERVED` lists the codes); a sales source still CONFIRMED (sales order row locked FOR SHARE) |
| pause `{ note? }` | IN_PRODUCTION | same | no stock effect; issue posting is refused while paused |
| resume `{ note? }` | PAUSED | same | no stock effect |
| usage `{ materialId, quantity, note? }` | IN_PRODUCTION · PAUSED | `operations.material_usage.create` | Σ usage ≤ issued |
| create / edit / cancel an issue | IN_PRODUCTION | `operations.material_issues.create` | |
| post an issue | IN_PRODUCTION | `operations.material_issues.approve` | |

Every action locks the order row first and is checked centrally. Double start, start vs cancel,
pause vs resume and similar races give one transition and 409 for the others, never 500.

## 2. Usage and variance

`ProductionMaterialUsage` is append-only evidence: material, quantity, note, who, when.

- **No stock effect.** It writes no movement, balance or reservation change. The material already
  left stock when the issue was posted.
- **The cap.** Σ usage of a material must stay ≤ issued for it (409 `USAGE_EXCEEDS_ISSUED`, with
  issued / used in the details). Concurrent usage records serialize on the order row, so the cap
  holds under races (tested).
- **The figures on each material line:**
  - `used` = Σ usage;
  - `usageVariance` = used − required (negative = less than planned so far);
  - `unrecorded` = issued − used (issued material not yet accounted for).
- **Correction.** No edits or deletes (triggers). A correction is a new record plus a note.

## 3. Cancel

Cancel is allowed while **nothing has been issued** (no CONSUMED reservation), otherwise 409
`MATERIAL_ALREADY_ISSUED`. Physical material has left stock, and EP37 has no return document.
Cancelling releases every ACTIVE reservation (`ORDER_CANCELLED`), cancels every DRAFT issue, and
keeps all history. The reason is required (except for the creator's own DRAFT).

## 4. Screens (`/core/production`, lazy chunks)

- **Order detail:** reservation state, a materials table (required / reserved / issued / used / still
  needed / shortage / excess / variance), and actions (allocate, release, reallocate, start, pause,
  resume, excess, record usage). Every action uses a confirm box with focus return. The panel is the
  lazy `ExecutionPanel`.
- **Reservations:** orders by reservation state.
- **Execution:** IN_PRODUCTION and PAUSED orders.
- **Material issues:** list, create, edit lines, post, cancel (lazy `IssuesArea`). The posting
  confirmation reads: "Posting this issue will deduct physical warehouse stock and consume matching
  Production reservations."
- **Overview tiles:** in production, paused, draft issues.
- **Warehouse:** `/core/warehouse/material-issues` (read-only handoff, `MaterialIssueHandoff`).

TH / EN / ZH copy lives in `execCopy.ts`. Tables become cards below md.

## 5. Demo (`production/demo.ts → seedDemoExecution`, idempotent)

- One owner adjustment through `AdjustmentService`: +5 kg RM-000001, lot RM-DEMO-02, reason OTHER.
  It gives the demo enough material and keeps the ledger canonical.
- The approved demo order is fully reserved.
- **MO_EXEC** (10 pcs) is reserved, released, started, then:
  - MI #1 POSTED (RM 1.5 kg, PK 10 pcs);
  - usage RM 1.5, PK 9;
  - MI #2 DRAFT.
- **MO_PARTIAL** (6 pcs) is partially reserved.

A guard stops the demo if a shortage appears instead of seeding a broken state. The second seed
changes nothing. No demo persona was elevated: `operations.demo` stays Department Manager and
`warehouse.demo` gains only the default READ handoff code.

## 6. Known limitations (deliberate)

- Completion, output and finished goods receipt arrived in EP38 (PRODUCTION_OUTPUT.md,
  PRODUCTION_FINISHED_GOODS_RECEIPT.md, PRODUCTION_COMPLETION.md).
- No material return, scrap or yield documents; variance is evidence only.
- No costing, labour, machine time, routing or work centres; no GL / payroll effect.
