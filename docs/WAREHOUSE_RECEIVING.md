# Warehouse Receiving — Goods Receipts, Lots and Expiry (EP31)

The first real inventory movement in CORE. A **goods receipt (GR)** records what arrived against a
purchase order that is **pending receive** (EP30): how much was **accepted** into stock, how much
was **rejected**, and where each accepted quantity went — a **location**, and a **lot** with its
**expiry** where the item tracks them. Posting a receipt writes the stock ledger
([INVENTORY_LEDGER.md](INVENTORY_LEDGER.md)). Nothing in this module has a price, cost or value.

Source of truth: `backend/src/warehouse/` (`policy.ts` actor + transition table, `rules.ts`
receiving rules, `ledger.ts` the only writer of stock, `progress.ts` receive progress,
`service.ts`, `views.ts` allow-lists, `demo.ts`), `backend/src/routes/v1/warehouse.ts`, migrations
`20261103090000_ep31_po_received_status` and `20261103090100_ep31_goods_receipt_inventory`.
Screens: `frontend/src/features/warehouse/` (one lazy chunk each for the workspace, receipts,
inventory / lots and movements) and the extended `purchasing/ReceiveArea.tsx`.

## 1. Lifecycle

```
PENDING_RECEIVE order ──create──▶ GR DRAFT ──post──▶ GR POSTED ──cancel (reason)──▶ CANCELLED (reversed)
                                        └──cancel──▶ CANCELLED (no stock effect)
```

| Action | From | Who | Effect |
| --- | --- | --- | --- |
| create | — (order `PENDING_RECEIVE`, member's branch) | `warehouse.receiving.process` | DRAFT with one line per receivable order line that still has something to receive |
| edit header / line | DRAFT | `warehouse.receiving.process` | received time, default location, note; per line accepted / rejected / allocations |
| post | DRAFT | `warehouse.receiving.process` | movements + balances, receipt locked, order receive state moved on |
| cancel | DRAFT | `warehouse.receiving.process` | CANCELLED, no stock effect, reason optional |
| cancel | POSTED | `warehouse.receiving.cancel` (MANAGE) | reversal movements, balances reduced, order reopened; **reason required** |

One table decides it (`policy.ts`, `grRefusal()`): without authority 403 (the state is not
revealed); with it a wrong status is 409 (`GR_NOT_EDITABLE` / `GR_INVALID_TRANSITION`); every
action also needs the receipt's branch. There is no status PATCH and no way to edit a posted
receipt; a correction is a reversal and a new receipt. Lines with nothing accepted or rejected are
dropped when the receipt is posted.

**Numbering** `GR-YYYYMM-NNNNNN` from `DocumentSequence (companyId, 'GR:YYYYMM')`, one atomic upsert in
the creating transaction (company time zone month), immutable, never `MAX + 1`.

**Source and branch.** A receipt is only ever created from an order: there is no free-form receipt.
The order must be `PENDING_RECEIVE` and in one of the member's branches (else 404); the receipt
takes the order's branch (a composite foreign key `(order, branch, company)` makes another branch
impossible), its supplier code / name and order number as snapshots, and each line takes the
item, unit and quantities from its order line — the client names an order line, never an item.
Only lines of an **inventory-tracked item** are receivable; a service or non-stock line is not
received into stock (it stays on the order for Purchasing).

## 2. Quantities — ordered, accepted, rejected, remaining

Per order line, from **posted** receipts only (`progress.ts`):

| Figure | Meaning |
| --- | --- |
| ordered | the order line quantity (receive in the order unit — the item's base unit; no conversion) |
| accepted | Σ accepted — went into stock |
| rejected | Σ rejected — delivered and refused, **never stock** |
| closed | Σ rejected on lines marked *no replacement* (`replacementRequired = false`) |
| remaining | max(ordered − accepted − closed, 0) |

**Rejected quantity policy.** A rejection needs a reason (`DAMAGED`, `WRONG_ITEM`, `EXPIRED`,
`QUALITY`, `QUANTITY_DISCREPANCY`, `OTHER`; optional note). By default the supplier still owes it:
the rejected quantity stays **to receive**. Warehouse may mark the line *no replacement*, and then
the rejected quantity closes that much of the order line. In both cases **accepted + rejected on a
receipt never exceeds what remains** (`PO_LINE_OVER_RECEIVED`) — no over-delivery tolerance in v1.

Partial receiving and any number of receipts per order are normal. The order's own status stays
`PENDING_RECEIVE` until every receivable line has nothing left; then the post moves it to
**`RECEIVED`** (with `receivedAt`). Cancelling a posted receipt moves a `RECEIVED` order back to
`PENDING_RECEIVE`. Derived receive state for screens: `NOT_RECEIVED` / `PARTIALLY_RECEIVED` /
`FULLY_RECEIVED`. A purchase order with posted receipts can no longer be cancelled
(`PO_HAS_RECEIPTS` — reverse its receipts first).

**Over-receive under concurrency.** Posting locks the receipt row, then the **order row**, then reads
what posted receipts already took. Two receipts of one order are serialized on the order row: of
two posts of 7 against a remaining 10, the second sees the first's 7 and fails. Tested 6 × in the
API suite and 10 × on the real stack.

## 3. Locations and allocations

Accepted quantity is split into **allocations** — `(location, lot?, quantity)` rows under the line
(`GoodsReceiptAllocation`). They must add up to the accepted quantity exactly
(`ALLOCATION_MISMATCH`), each into an **ACTIVE** location of the receipt's branch (another branch's
location is "not found"; an inactive one 409). The branch's default location is preselected; any
active location of the branch may be chosen. One line may put lot A in MAIN and QC and lot B in MAIN.

## 4. Lots and expiry

| Item setting (EP28) | NONE | OPTIONAL | REQUIRED |
| --- | --- | --- | --- |
| `lotTracking` | no lot allowed (`LOT_NOT_TRACKED`) | lot may be given | every allocation names a lot (`LOT_REQUIRED`) |
| `expiryTracking` | no expiry allowed (`EXPIRY_NOT_TRACKED`) | expiry may be given (with a lot) | every lot has one (`EXPIRY_REQUIRED`) |

- **Lot identity is company-wide: `(company, item, lot number)`** — the same supplier lot can arrive
  in several branches and locations and is one lot. A lot has **one expiry**: the same lot number
  with another expiry is refused (`LOT_EXPIRY_MISMATCH`), on one line and against stock.
- Lot numbers are business values, kept verbatim (no control characters, up to 60 characters). No lot
  is generated: an OPTIONAL item without a lot number is stock without a lot.
- **Expired goods are never accepted** (`LOT_EXPIRED`, expiry before today in the company's time zone);
  record them as rejected with reason `EXPIRED`. A production date is optional and must be plausible.
- Lots are created when a receipt is **posted**, once even when two receipts race (unique key +
  `INSERT … ON CONFLICT DO NOTHING`).
- The rules are checked when a line is saved and again, with the item's settings at that time,
  when the receipt is posted. Once an item has lots, stock or receipt lines its unit and tracking
  can no longer change (EP28 structure lock: `ITEM_STRUCTURE_LOCKED`).

## 5. Permissions

| Code | Tier | Use |
| --- | --- | --- |
| `warehouse.receiving.view` | READ | pending receive and goods receipts |
| `warehouse.receiving.process` | OPERATE | create, edit and **post** a receipt; cancel a draft |
| `warehouse.receiving.cancel` (new) | MANAGE | cancel a **posted** receipt (reversal) |
| `warehouse.inventory.view` | READ | stock, lots / expiry, movements, FEFO order |

Warehouse Staff receive and post; Warehouse Managers also reverse; Viewers and the Executive read
only; the Owner may do everything (still bound by every rule); **System Admin has none of it**
unless assigned to Warehouse. Purchasing and Accounting have no receipt or stock access (they see
receive progress on the order — §7). Stock adjustment codes exist (EP27) but nothing uses them yet.

## 6. Warehouse privacy

Every response is an allow-list (`views.ts`): receipts, lines, allocations, stock rows, movements
and FEFO candidates carry identities, quantities, lots, locations, dates and people — **no unit
price, cost, purchase amount, discount, tax, order total, deposit, payment term or supplier
contact**, not hidden but absent. Tested key by key and value by value in the API suite and on the
real stack (nine Warehouse responses). Platform Inspection sees that receipt and lot events
happened, never their details.

## 7. Who sees receiving

- **Warehouse** — `/core/warehouse`: workspace (real counts: orders to receive, draft receipts, stock
  lines, lots expiring soon / expired), Pending receive (per line ordered / received / rejected /
  pending, lot and expiry requirement, the order's receipts, *Receive goods*), Goods receipts (list
  with status / search / paging; one receipt with lines, allocations, timeline and actions),
  Inventory, Lots & expiry, Movements.
- **Purchasing** — on the order: status `RECEIVED`, per line received / rejected / remaining, the
  posted and cancelled receipts (number, date), timeline (*Partly received*, *Fully received*,
  *Reopened for receiving*). No receipt or stock action.
- **Accounting** — on the deposit order: the receive state and date. No stock access.

## 8. API

`/api/v1/warehouse` (session required):

| Method | Path |
| --- | --- |
| GET | `/context` — capabilities, branches, locations, counts |
| GET · POST | `/receipts` (`?status&branchId&purchaseOrderId&q&page`) · `{ purchaseOrderId, receivedAt?, defaultLocationId?, note? }` |
| GET · PATCH | `/receipts/:id` · DRAFT header |
| PUT | `/receipts/:id/lines/:lineId` `{ acceptedQuantity, rejectedQuantity?, rejectReason?, rejectNote?, replacementRequired?, note?, allocations: [{ locationId, lotNumber?, expiryDate?, manufacturedDate?, quantity }] }` |
| POST | `/receipts/:id/post` · `/receipts/:id/cancel { reason? }` |
| GET | `/stock` (`?view=stock|lots&locationId&itemId&expiry&q&page`) · `/stock/fefo?itemId=` · `/movements` (`?type&itemId&lotId&locationId&q&page`) |
| GET | `/pending-receive` · `/pending-receive/:id` (EP30, now with receive progress and receipts) |

Strict bodies: company, branch, number, status, supplier, item, unit, ordered quantity, lot ids,
movement type / delta, balances and actors are refused (400); quantities are decimal strings within
the unit's precision; dates are calendar days.

## 9. Audit and timeline

`GOODS_RECEIPT_CREATED`, `_UPDATED`, `_LINE_UPDATED`, `_POSTED`, `_CANCELLED` (`reversed` true / false),
`INVENTORY_LOT_CREATED`, and on the order `PURCHASE_ORDER_PARTIALLY_RECEIVED`, `_RECEIVED`,
`_RECEIVE_REOPENED`. Details name numbers, item codes, line numbers and counts — never a price,
note or reason; one event per action, not per allocation. The receipt page shows Created / Posted /
Cancelled; the order page adds the receive events. Company activity reads them in words.

## 10. Demo

`db:seed:demo` (EP31 part, once each): a demo-branch request and order (finished goods + boxes) and
three posted receipts by `warehouse.demo` — 5 of 8 kg raw material (lot `RM-DEMO-01`, the order stays
partly received); finished goods in lots `FG-DEMO-A` (MAIN) and `FG-DEMO-B` (RECEIVING, expiring
soon) with 96 boxes accepted and 4 rejected as damaged without replacement; the last finished goods
in lot `FG-DEMO-C` → that order is **RECEIVED**. FEFO for FG-000001 in the demo branch: B, A, C.

## 11. Not in EP31

Sales stock issue, picking, packing, delivery, production consumption / output, transfers, stock
adjustments, cycle / physical counts, valuation, cost, invoices, AP, payments, serial numbers,
over-delivery tolerance, unit conversion, FEFO allocation. See [INVENTORY_LEDGER.md](INVENTORY_LEDGER.md) §6.
