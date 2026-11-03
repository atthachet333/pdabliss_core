# Cycle Count (EP32)

Counting the physical stock of chosen locations and correcting the ledger by the difference. Counts
use a **scoped lock**: while a count is open, its scope cannot move, so the snapshot stays true and
the posted correction is exact.

## 1. Document

| Model | Notes |
| --- | --- |
| `CycleCount` | company, branch, `number` `CC-YYYYMM-NNNNNN`, `status`, optional `itemId` (count one item only), note, `countDate`, started / reviewed / posted / cancelled by + at |
| `CycleCountLocation` | the scope: 1–20 ACTIVE locations of **one** branch (`CROSS_BRANCH`) |
| `CycleCountLine` | location, item, `lotId?` or a new lot (found stock), `lotKey`, `expected` (from the snapshot) or not (found), `systemQuantity` (snapshot; 0 when not expected), `countedQuantity?` (≥ 0), counted by / at, note; unique `(count, location, item, lotKey)` |

`variance = counted − system` is computed by the server, never sent by a client.

## 2. Lifecycle

```
DRAFT ──start──▶ COUNTING ──review──▶ REVIEW ──post (manager)──▶ POSTED
  │                 ▲          │
  │                 └─reopen───┘
  └──────────── cancel (before POSTED) ──────────▶ CANCELLED (no stock effect)
```

| Action | Code |
| --- | --- |
| create, edit scope, start, enter counts, add found stock, review, reopen, cancel | `warehouse.counts.create` (OPERATE) |
| post | `warehouse.counts.approve` (MANAGE) |
| read | `warehouse.inventory.view` |

One rule table (`COUNT_RULES`). Counting outside COUNTING: `DOCUMENT_NOT_EDITABLE`.

## 3. Start — snapshot under an exclusive lock

1. Lock the count row; re-check the scope (ACTIVE locations of one branch).
2. Take the scope's location advisory locks **exclusively** (sorted). Stock writers hold the same
   locks shared, so every movement already in flight finishes first.
3. Refuse an overlapping open count (same location; either count for all items, or the same item):
   `COUNT_OVERLAP`.
4. Snapshot every balance in scope with quantity > 0 (and the item, if the count has one) as an
   expected line with its `systemQuantity`; status COUNTING.

## 4. The scope lock

From start until posted or cancelled, `applyMovement` refuses any movement on a location in an open
count's scope — for every item, or only the counted item when the count has one — with
`COUNT_IN_PROGRESS`: receipts, receipt reversals, transfers, adjustments alike. The count's own
corrections pass (`ownCountId`). Because the check runs after the movement's shared location lock,
and starting takes that lock exclusively, a movement either finishes before the snapshot (and is in
it) or is refused — never lost between the two.

A location in an open count's scope cannot be deactivated (`LOCATION_IN_USE`).

## 5. Counting

- `PUT /counts/:id/entries` sets many counted quantities at once. **0 is a real count** (nothing
  there); `null` clears a count. Unit precision applies.
- `POST /counts/:id/lines` adds stock the snapshot did not show: a location in scope
  (`OUT_OF_SCOPE`), the count's item if it has one, the item's lot rules (an existing lot, or a new
  lot number / expiry), not already on the count (`DUPLICATE_LINE`). System quantity 0.
- Review needs every line counted (`COUNT_INCOMPLETE`); reopen goes back to COUNTING.

## 6. Post — stale check, then signed corrections

Under the scope's exclusive locks: every expected line's balance must still equal its
`systemQuantity`, and no balance > 0 may have appeared in scope that the count does not cover —
otherwise **`COUNT_STALE`** (409) and nothing is written; the count stays in REVIEW to be cancelled
and redone. The lock makes this rare (it guards any path that bypassed the ledger); the test suite
forces it.

Then per line with a variance ≠ 0: resolve a new lot if needed, and write one `COUNT_CORRECTION`
movement with the **signed** delta (`sourceType = CYCLE_COUNT`, `(cycleCountLineId, type)` unique) —
a decrease uses the conditional decrement. Status POSTED; the scope is released. A posted count is
final: a later correction is an adjustment (`COUNT_CORRECTION` reason) or a new count.

## 7. API (`/api/v1/warehouse`)

```
GET    /counts                 ?status, locationId, branchId, q, from, to, page, pageSize
POST   /counts                 {locationIds, itemId?, countDate?, note?}  201
GET    /counts/:id             lines (system, counted, variance, expected), timeline, actions
PATCH  /counts/:id             DRAFT scope / note / date
POST   /counts/:id/start
PUT    /counts/:id/entries     {entries: [{lineId, countedQuantity | null, note?}]}
POST   /counts/:id/lines       {locationId, itemId, lotId?, newLotNumber?, newLotExpiry?, countedQuantity, note?}  201
POST   /counts/:id/review | /reopen | /post
POST   /counts/:id/cancel      {reason?}
```

## 8. Screens

`/core/warehouse/counts` (status filter; counted / lines · variance lines), `/new` (choose
locations), `/:id` (lock notice while open; a count sheet — location, item, lot, system, counted,
variance — as a table on desktop and cards at 390 px; "add stock found that is not listed";
Start / Send to review / Back to counting / Post count / Cancel, each confirmed). Own lazy chunk.
