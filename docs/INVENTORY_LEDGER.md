# Inventory Ledger — Stock Movements, Balances and FEFO (EP31, EP32)

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

**Movement types** (sign enforced by `StockMovement_check`; each family has its own `sourceType`
and required source ids):

| Type | Sign | `sourceType` | Source | Episode |
| --- | --- | --- | --- | --- |
| `PURCHASE_RECEIPT` / `PURCHASE_RECEIPT_REVERSAL` | + / − | `GOODS_RECEIPT` | receipt, line, allocation | EP31 |
| `TRANSFER_OUT` / `TRANSFER_IN` | − / + | `TRANSFER` | transfer, line | EP32 |
| `TRANSFER_OUT_REVERSAL` / `TRANSFER_IN_REVERSAL` | + / − | `TRANSFER` | transfer, line | EP32 |
| `ADJUSTMENT_IN` / `ADJUSTMENT_OUT` | + / − | `ADJUSTMENT` | adjustment, line | EP32 |
| `ADJUSTMENT_IN_REVERSAL` / `ADJUSTMENT_OUT_REVERSAL` | − / + | `ADJUSTMENT` | adjustment, line | EP32 |
| `COUNT_CORRECTION` | ± (never 0) | `CYCLE_COUNT` | count, line | EP32 |

`(line, type)` is unique per source family, so no line can post the same movement twice. Sales issue
and production consumption / output are future types ([§7](#7-ep32-locks-and-the-contract-for-sales--production)).

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
whole reversal is refused (`STOCK_INSUFFICIENT`) and nothing changes. Since EP32 a transfer, an
adjustment or a count can take that stock away first; the guard is tested with a real transfer.
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

## 7. EP32 locks and the contract for Sales / Production

EP32 moved every stock write into one function, **`applyMovement()`** (`backend/src/warehouse/ledger.ts`):

1. take the location's advisory lock **shared** (`pg_advisory_xact_lock_shared(hashtext('loc:'+id))`);
   documents touching several locations pre-lock them all in sorted order (`lockLocations`), so
   writers never deadlock on each other;
2. refuse a movement on a location an open cycle count covers (`COUNT_IN_PROGRESS`), unless it is
   that count's own correction;
3. an increase needs the location ACTIVE (`LOCATION_INACTIVE`) and upserts the balance; a decrease
   uses the conditional decrement and throws the caller's refusal (`INSUFFICIENT_STOCK`,
   `REVERSAL_NOT_POSSIBLE`, `STOCK_INSUFFICIENT`) instead of going negative;
4. insert the immutable movement.

Cycle counts (start and post) and location deactivation take the same locks **exclusively**: they
wait for writes in flight and block new ones for their transaction. Goods receipts, transfers,
adjustments and counts all go through this path; **nothing else writes `StockBalance`.**

Location deactivation (EP31 debt, fixed in EP32): a location cannot become INACTIVE while any balance
there is ≠ 0 (`LOCATION_HAS_STOCK`), or a DRAFT transfer, a DRAFT / SUBMITTED adjustment, a DRAFT
receipt allocation or an open count names it (`LOCATION_IN_USE`). The check is a hook
(`LOCATION_LOCKS`, registered by `warehouse/locks.ts`) run by Master Data inside the status
transaction after the exclusive location lock.

**Future Sales issue / Production consumption and output must:**

- add their own movement types and `sourceType` (e.g. `SALES_ISSUE` / `SALES_ISSUE_REVERSAL`,
  `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT`) with typed source FK columns and a unique
  `(line, type)`, widening `StockMovement_check` in a migration (enum values in a separate migration
  from their first use);
- call `applyMovement` for every change, after `lockLocations` on all locations involved, inside the
  transaction that locks their own document row;
- pick stock FEFO (`fefoCandidates`) for expiry-tracked items, FIFO by `firstReceivedAt` otherwise,
  and add reservations themselves if they need them;
- respect open counts (the ledger refuses for them) and never bypass the stale check;
- reverse with opposite movements, never by editing or deleting.

## 8. EP34 reservations (Sales allocation)

A sales reservation (`SalesAllocation`, [SALES_ALLOCATION.md](SALES_ALLOCATION.md)) claims stock of one
identity (location, item, lot) for a confirmed order line. **It is not a movement**: no
`StockMovement` row, no `StockBalance` change, no reservation movement type. Stock views add
`quantityReserved` (Σ ACTIVE reservations) and `quantityAvailable` (on hand − reserved); FEFO
candidates expose the same available quantity.

`applyMovement()` keeps the invariant **reserved ≤ on hand**: every decrease now runs
`takeRespectingReservations()` (`warehouse/reservations.ts`) — lock the balance row, read what is
reserved, refuse with `409 STOCK_RESERVED` when the decrease would leave less than that (otherwise the
EP32 shortage refusals). Allocation locks the same balance rows before reading, so the two serialize.
Transfers and adjustment decreases also check available stock at draft time; cycle-count corrections and
all reversals are guarded at posting. EP35's sales issue will consume reservations in the same
transaction as its movement.

## 9. EP35 SALES_ISSUE (dispatch)

`SALES_ISSUE` is the only movement Sales fulfilment writes: negative, `sourceType = 'SALES_SHIPMENT'`
with `salesShipmentId` + `salesShipmentLineId` (composite FK to the shipment's branch and company),
one per shipment line (unique `(salesShipmentLineId, type)`), written through `applyMovement()` at
**dispatch** — never at pick, pack or delivery ([SALES_FULFILLMENT.md](SALES_FULFILLMENT.md) §6).
Dispatch locks the order and shipment rows, takes the location locks shared (an open count refuses it
with `COUNT_IN_PROGRESS`), locks balances then reservations in id order, consumes the exact
reservation, then issues: the decrease guard runs unchanged and keeps on hand ≥ what stays reserved.
`StockMovement_check` was re-stated once more (a superset; existing rows satisfy it). There is no
`SALES_ISSUE_REVERSAL`: issued stock is never restored automatically; returns will add their own
positive type. Reconciliation after every QA run: balance = Σ movements per identity, nothing
negative, every SALES_ISSUE matched by a CONSUMED reservation of the same quantity and vice versa.
