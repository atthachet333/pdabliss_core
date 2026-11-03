# Stock Adjustment (EP32)

Correcting on-hand stock with a stated reason — damage, loss, found stock, data errors. Staff draft
and submit; a manager's approval **is** the posting. Every stock effect goes through the ledger
([INVENTORY_LEDGER.md](INVENTORY_LEDGER.md)).

## 1. Document

| Model | Notes |
| --- | --- |
| `StockAdjustment` | company, branch (the selected branch, or the member's only one — `BRANCH_SELECTION_REQUIRED` otherwise), `number` `ADJ-YYYYMM-NNNNNN`, `status`, `reason`, note, `adjustmentDate`, submitted / approved (= posted) / rejected / cancelled by + at, rejection and cancellation reasons |
| `StockAdjustmentLine` | explicit `direction` INCREASE / DECREASE, location (same branch), item, `lotId?`, or a new lot (`newLotNumber`, `newLotExpiry`) on an increase, `quantity` > 0, note |

The sign is never inferred from a negative number: a line says INCREASE or DECREASE and its
quantity is positive.

## 2. Reasons

| Reason | Direction | New lot allowed |
| --- | --- | --- |
| `DAMAGE`, `LOSS`, `SHRINKAGE`, `EXPIRED` | decrease only | — |
| `FOUND` | increase only | yes |
| `COUNT_CORRECTION`, `DATA_CORRECTION` | either | on an increase |
| `OTHER` | either (a note is required — `NOTE_REQUIRED`, also a DB CHECK) | on an increase |

A line that does not fit its reason is refused (`REASON_DIRECTION`). A new lot follows the item's
rules (`LOT_NOT_TRACKED`, `EXPIRY_REQUIRED`, `EXPIRY_NOT_TRACKED`), may not be expired
(`LOT_EXPIRED`), and an already-known lot number must keep its expiry (`LOT_EXPIRY_MISMATCH`). The
lot is created at approval (audit `INVENTORY_LOT_CREATED`) and the line is pointed at it.

## 3. Lifecycle

```
DRAFT ──submit (staff)──▶ SUBMITTED ──approve (manager)──▶ POSTED ──cancel + reason (manager)──▶ CANCELLED (reversal)
  │                           ├──reject + reason (manager)──▶ REJECTED
  └──cancel (staff)───────────┴──cancel (staff)──▶ CANCELLED (no stock effect)
```

| Action | Code |
| --- | --- |
| create / edit / replace lines / submit / cancel before posting | `warehouse.stock_adjustment.create` (EP27 code, OPERATE) |
| approve (= post), reject, reverse a posted adjustment | `warehouse.stock_adjustment.approve` (EP27 code, MANAGE) |
| read | `warehouse.inventory.view` |

One rule table (`ADJUSTMENT_RULES`). Submitting an empty adjustment: `DOCUMENT_EMPTY`.

## 4. Approval = posting — one transaction

Lock the row; re-check every line (location ACTIVE, item, lot rules, reason / direction); take the
locations' shared advisory locks (sorted); resolve new lots; per line `applyMovement`:
`ADJUSTMENT_IN` (+q, upsert) or `ADJUSTMENT_OUT` (−q, conditional decrement → `INSUFFICIENT_STOCK`).
`sourceType = ADJUSTMENT`, `(adjustmentLineId, type)` unique. Status POSTED with approved by / at;
audit `ADJUSTMENT_APPROVED` and `ADJUSTMENT_POSTED`. A location under an active cycle count refuses
the movement (`COUNT_IN_PROGRESS`).

Two decreases of 7 approved at once from a balance of 10: exactly one posts. The same adjustment
approved twice at once: one success, one movement.

## 5. Reversal

Cancelling a POSTED adjustment (reason required) writes the opposite movement per line —
`ADJUSTMENT_IN_REVERSAL` (−q) or `ADJUSTMENT_OUT_REVERSAL` (+q). If an increase's stock is no longer
there, the whole reversal is refused (`REVERSAL_NOT_POSSIBLE`).

## 6. API (`/api/v1/warehouse`)

```
GET    /adjustments              ?status, reason, locationId, branchId, q, from, to, page, pageSize
POST   /adjustments              {reason, adjustmentDate?, note?, lines?}  201
GET    /adjustments/:id          lines with `onHand` now, timeline, actions
PATCH  /adjustments/:id          DRAFT header
PUT    /adjustments/:id/lines    {lines: [{direction, locationId, itemId, lotId?, newLotNumber?, newLotExpiry?, quantity, note?}]}
POST   /adjustments/:id/submit | /approve
POST   /adjustments/:id/reject   {reason}
POST   /adjustments/:id/cancel   {reason?} (required when POSTED)
```

No price, cost or value is accepted or returned (`AdjustmentView` allow-list). An adjustment is a
quantity correction only; valuation belongs to a future Accounting episode.

## 7. Screens

`/core/warehouse/adjustments` (status and reason filters), `/new` (reason, note — Other needs a note
before Create is enabled), `/:id` (lines: direction, location, stock picked at the location, or an
item search with a new lot for increases; Submit / Approve and post / Reject with reason / Cancel /
Cancel and reverse, each confirmed). Own lazy chunk.
