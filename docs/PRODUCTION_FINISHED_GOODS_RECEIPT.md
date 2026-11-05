# Finished Goods Receipt (EP38)

A **finished goods receipt** (`FGR-YYYYMM-NNNNNN`) is Warehouse's confirmation that accepted good
output physically arrived in stock. **Posting it is the only moment finished goods become
inventory.** It writes `PRODUCTION_OUTPUT` (positive) through the canonical ledger
(`ledger.ts applyMovement()`). Output: [PRODUCTION_OUTPUT.md](PRODUCTION_OUTPUT.md). Ledger:
[INVENTORY_LEDGER.md](INVENTORY_LEDGER.md) §12.

```
ACCEPTED output report → receipt DRAFT (lines) → POSTED (PRODUCTION_OUTPUT +)  → REVERSED (reason, −)
                                               → CANCELLED
```

## 1. Model

`ProductionGoodsReceipt`:

| Field | Meaning |
| --- | --- |
| company / branch / order / `outputReportId` | composite FKs: the order's branch, and a report of that order |
| `number` | `FGR-YYYYMM-NNNNNN`, atomic `DocumentSequence` (`FGR:YYYYMM`), unique, immutable |
| `status` | DRAFT → POSTED / CANCELLED; POSTED → REVERSED (reason) |
| facts | created, posted, cancelled and reversed by and at, reasons |

`ProductionGoodsReceiptLine`:

| Field | Meaning |
| --- | --- |
| `lineNo` | line number |
| item | always the order's finished item (trigger) |
| location | composite FK to the order's branch |
| `lotNumber`, `expiryDate`, `manufacturedDate` | lot data entered on the line |
| `lotId` | resolved at posting |
| `quantity` | > 0 |

Lines change only while the receipt is a DRAFT (trigger). A posted receipt never changes and nothing
is deleted. `StockMovement.productionGoodsReceiptId / productionGoodsReceiptLineId` reference the
receipt. The unique `(productionGoodsReceiptLineId, type)` allows one PRODUCTION_OUTPUT and at most
one PRODUCTION_OUTPUT_REVERSAL per line.

## 2. Line rules (the purchase-receiving rules, reused)

`warehouse/rules.ts normalizeLine` checks lines at draft and again at posting, with the item's
tracking at that moment:

- **Precision:** quantities exact, at the unit's precision.
- **Lot:** `lotTracking` NONE → no lot; REQUIRED → every line names one.
- **Expiry:** `expiryTracking` REQUIRED → every lot has an expiry; NONE → none.
- **Dates:** an expired lot cannot be received (`LOT_EXPIRED`); a production date in the future or
  after expiry is refused (`MANUFACTURED_DATE_INVALID`).
- **One lot, one set of dates:** one expiry and one production date per lot, on the receipt and in
  stock (`LOT_EXPIRY_MISMATCH`, `LOT_MANUFACTURED_MISMATCH`).
- **Location:** an ACTIVE location of the order's branch (`REFERENCE_NOT_FOUND` /
  `REFERENCE_INACTIVE`). There is no cross-branch receipt; a transfer moves stock later.
- **Item:** active and stock-tracked.

**Lots.** `resolveLot` creates the lot once per (company, item, number); concurrent creation of the
same lot yields one row. A lot created concurrently by another receipt is checked for its expiry
and production date. A lot is never shared across items or companies (the lot key is
`(company, item, number)` and the FKs carry the item and company).

## 3. Partial receiving

Several receipts per output report and several reports per order are allowed:

```
accepted 100 → receipt A 40 · receipt B 35 → received 75 · pending 25
```

A draft may hold at most the accepted quantity not yet received. Drafts may overlap each other;
posting re-checks under the locks (`FG_EXCEEDS_ACCEPTED`).

## 4. Posting — one transaction

1. Lock the production order row `FOR UPDATE`, then the output report row, then the receipt row.
2. Re-check: receipt still DRAFT (`FGR_ALREADY_POSTED`), report ACCEPTED (`OUTPUT_NOT_ACCEPTED`),
   order IN_PRODUCTION / PAUSED / COMPLETION_REVIEW (`MO_NOT_RECEIVABLE` / `MO_COMPLETED`), member
   in the branch, every line rule.
3. received (posted, read after the locks) + this receipt ≤ accepted (`FG_EXCEEDS_ACCEPTED`).
4. Location advisory locks (shared; an open count refuses with `COUNT_IN_PROGRESS`).
5. Per line: resolve or create the lot (audit `INVENTORY_LOT_CREATED`), then
   `applyMovement(PRODUCTION_OUTPUT, +quantity, sourceType PRODUCTION_RECEIPT)`. This is a
   single-statement balance upsert, so concurrent receipts never lose an update.
6. Receipt POSTED (conditional update), then audit.

Any failure rolls everything back.

**Concurrency** (tested in the backend and on the real stack, three rounds each):

- triple post → one 200, two 409 `FGR_ALREADY_POSTED`, one movement per line;
- two or three receipts claiming the same accepted output → never more than accepted
  (`FG_EXCEEDS_ACCEPTED` for the rest);
- post vs output cancel → posted (cancel refused `OUTPUT_ALREADY_RECEIVED`), or cancelled (draft
  receipt cancelled, post refused);
- post vs completion → completion refuses while the draft exists (`RECEIPT_PENDING`), or completes
  after the post.

## 5. Reversal (controlled correction)

`POST …/reverse { reason }`, with `warehouse.finished_goods.confirm`, while the order is not
COMPLETED. It writes one `PRODUCTION_OUTPUT_REVERSAL` per line through `applyMovement()`. The
decrease guard refuses with 409 when:

- the goods are reserved for sales or production (`STOCK_RESERVED`);
- the goods are no longer all on hand — sold, moved or adjusted (`FGR_STOCK_GONE`);
- the location is under an open count (`COUNT_IN_PROGRESS`).

Stock is never taken back silently. The receipt becomes REVERSED and its output is receivable
again. Reversal vs Sales allocation and reversal vs Sales dispatch were raced on the real stack:
never both, and reconciliation stayed 0.

## 6. Sales availability

Posted finished goods are ordinary stock. Sales sees them through the shared reservation-aware
availability and FEFO, and a manager allocates them **explicitly** (EP34). Nothing is reserved
automatically for the originating sales order. Output that is reported or accepted but not received
is invisible to Sales (tested: allocation before the receipt reserves nothing).

## 7. Warehouse screens and privacy

| Screen | Content |
| --- | --- |
| `/core/warehouse/finished-goods` | pending accepted output per report (accepted, received, pending, lot / expiry requirements, draft receipts) and the receipts list |
| `…/new?output=` | the receipt editor |
| `…/:id` | the receipt, with post / cancel / reverse |

The posting confirmation reads: *"Posting this receipt will add the finished goods to physical
warehouse stock."* Views are allow-listed: no price, cost, value, margin, customer or commercial
field (tested key by key and value by value).

## 8. Permissions

| Code | Tier | Use |
| --- | --- | --- |
| `warehouse.finished_goods.view` | READ | queue, list, detail |
| `warehouse.finished_goods.process` | OPERATE | create, edit and cancel drafts (Warehouse Staff) |
| `warehouse.finished_goods.confirm` | MANAGE | post and reverse (Warehouse Manager, Owner) |

Operations roles hold none of these; Warehouse roles cannot open production orders or output reports.

## 9. API (`/api/v1/warehouse/finished-goods`)

`GET /` (pending) · `GET /receipts` (status, outputReportId, productionOrderId, q, pages) ·
`POST /receipts { outputReportId, lines[], note? }` · `GET /receipts/:id` ·
`PUT /receipts/:id/lines { lines[], note? }` · `POST /receipts/:id/post` ·
`POST /receipts/:id/cancel { reason? }` · `POST /receipts/:id/reverse { reason }`.
