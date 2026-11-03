# Inventory Ledger — Stock Movements, Balances and FEFO (EP31)

How CORE knows what is in stock. Written by EP31 for purchase receipts; **every future stock
change (sales issue, production, transfers, adjustments) must use the same ledger.**

## 1. Stock truth

```
StockMovement  — immutable rows: one per quantity change of (location, item, lot)
StockBalance   — on-hand per (location, item, lot) = Σ its movements, maintained with them
```

- **The ledger is the truth.** A balance is a materialized sum for fast reads, never edited on its
  own: no API writes it, and every change to it happens in the same transaction as the movement
  that explains it. A test checks Σ movements = balance for every row after each scenario; the
  real-stack QA checks it on the whole database.
- **Movements are immutable.** A database trigger (`StockMovement_immutable`) refuses UPDATE and
  DELETE, even for the database owner. A correction is a new, opposite movement (a reversal).
- Quantities are exact `numeric(18,6)`, within the item unit's decimal places. No cost, price or
  value is stored anywhere in inventory.

## 2. Dimensions

| Table | Key | Notes |
| --- | --- | --- |
| `StockBalance` | `(location, item, lotKey)` unique | `lotKey` = lotId or `''`, so stock without a lot is unique too; branch and company come with the location; `firstReceivedAt` kept for future stock age / FIFO |
| `StockMovement` | `(allocation, type)` unique | company, branch, location, item, lot?, `type`, signed `quantityDelta`, `sourceType` + receipt / line / allocation ids, `occurredAt` (business time), actor, `createdAt` |
| `InventoryLot` | `(company, item, lot number)` unique | one expiry date, optional production date; FEFO keys off it |

Every relation is company-bound by composite foreign keys (location → its branch; item, lot and
actor → the company); a lot belongs to its item. Another company's location or lot cannot be
referenced. CHECKs: a balance is never negative; a receipt movement is positive, a reversal
negative, never zero.

**Movement types.** `PURCHASE_RECEIPT` (+) and `PURCHASE_RECEIPT_REVERSAL` (−) — the only two EP31
writes. Later episodes add their own types (e.g. sales issue, production consumption / output,
transfer out / in, adjustment) with their own source documents; none exists yet.

## 3. Posting a receipt — one transaction

`ledger.ts` `postReceipt()`:

1. lock the receipt row (`FOR UPDATE`) and check it is still DRAFT — a second post of the same
   receipt finds it POSTED and fails (`GR_INVALID_TRANSITION`): **no duplicate movement on retry**;
   the unique `(allocation, type)` index is a second guard;
2. lock the order row, check it is `PENDING_RECEIVE`, then read what posted receipts already took —
   receipts of one order are serialized here, so over-receiving is impossible under concurrency;
3. re-check every receiving rule with the item's current tracking;
4. per allocation: resolve the lot (`INSERT … ON CONFLICT DO NOTHING`, then read — two receipts
   creating the same new lot at once produce one lot), insert the movement, and add the quantity to
   the balance in **one statement** (`INSERT … ON CONFLICT (location, item, lotKey) DO UPDATE SET
   quantityOnHand = quantityOnHand + EXCLUDED…`) — concurrent receipts into the same balance never
   lose an update;
5. mark the receipt POSTED (conditional on DRAFT), move the order to RECEIVED when nothing is
   left, audit.

All or nothing: any failure rolls everything back.

## 4. Reversal and negative stock

`reverseReceipt()` (cancelling a POSTED receipt, reason required): per allocation, subtract its
quantity from the balance **only if that much is on hand** (`UPDATE … WHERE quantityOnHand >= qty`)
and insert a `PURCHASE_RECEIPT_REVERSAL` movement; mark the receipt CANCELLED; reopen a RECEIVED
order. If any balance would go below zero — because later movements already took that stock — the
whole reversal is refused (`STOCK_INSUFFICIENT`) and nothing changes. EP31 has no outbound movement
yet, so today that can only happen through future modules; the guard is tested by simulating one.
The original receipt and its movements stay; nothing is deleted.

## 5. FEFO foundation

`fefoCandidates(db, { companyId, branchId, itemId, locationId?, today, includeExpired? })`
(`service.ts`, read-only, also `GET /api/v1/warehouse/stock/fefo?itemId=`) returns the item's
on-hand balances in **First-Expiry-First-Out** order:

1. lots **with an expiry, earliest first** — expired lots are excluded unless asked for;
2. then lots without an expiry, then stock without a lot;
3. ties: the lot's creation (first receipt) time, then lot number, then the balance's first
   receipt time, location code and id — fully deterministic.

Expiry state for screens (display only): `EXPIRED` (before today), `EXPIRING_SOON` (within **30
days**), `OK`, `NO_EXPIRY`. **Nothing allocates or reserves stock in EP31.**

## 6. The contract for later inventory episodes

Every later stock change must:

- write `StockMovement` rows with its own `type`, `sourceType` and source document ids — never
  edit or delete a movement, never set a balance directly;
- change the matching `StockBalance` in the same transaction with a single atomic statement; an
  outbound change uses the conditional decrement (refuse rather than go negative);
- lock its source document (and the shared parent it consumes from) before reading quantities, so
  a retry or a race cannot double-post;
- take stock in **FEFO order** for expiry-tracked items (`fefoCandidates`), FIFO by
  `firstReceivedAt` otherwise — allocation and reservation (a `reserved` quantity or a reservation
  table) are theirs to add;
- keep every response operational for Warehouse (allow-lists, no value);
- after an outbound movement exists, reversing a purchase receipt that fed it is refused by the
  balance guard — the business flow is to return or adjust, not to rewrite history.
