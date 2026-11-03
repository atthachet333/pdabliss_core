# EP31 — Goods Receipt, Lot, Expiry, Stock Movement and FEFO Foundation

**Status:** completed locally, awaiting owner review. **Not pushed. EP32 not started.**
Design and contracts: [WAREHOUSE_RECEIVING.md](WAREHOUSE_RECEIVING.md),
[INVENTORY_LEDGER.md](INVENTORY_LEDGER.md).

## Baseline

`main` at `2bad43d` (EP30), clean, equal to `origin/main`.

## What EP31 adds

- **Model** (two additive migrations: `20261103090000_ep31_po_received_status` adds the order status
  `RECEIVED` on its own — a new enum value must commit before use — and
  `20261103090100_ep31_goods_receipt_inventory`): `GoodsReceipt`, `GoodsReceiptLine`,
  `GoodsReceiptAllocation`, `InventoryLot`, `StockMovement`, `StockBalance`; enums
  `GoodsReceiptStatus`, `ReceiptRejectReason`, `StockMovementType`; `PurchaseOrder.receivedAt`.
  Composite company / branch foreign keys everywhere (receipt ↔ order and branch, line ↔ order line,
  allocation ↔ line / location / lot, lot ↔ item, movement and balance ↔ location / item / lot);
  CHECKs for number format, status consistency, quantities, reject reason, allocation and lot shape,
  movement sign, non-negative balances; an **immutability trigger** on `StockMovement`; unique
  `(allocation, type)` on movements, `(location, item, lotKey)` on balances, `(company, item, lot
  number)` on lots. The order status CHECK and the permission CHECK (57 codes) widened.
- **Receiving** (`backend/src/warehouse/`): receipts only from PENDING_RECEIVE orders of the member's
  branch; `GR-YYYYMM-NNNNNN`; partial and repeated receipts; accepted / rejected with reasons and a
  *no replacement* option; split location / lot allocations; lot and expiry rules from the EP28 item
  tracking; expired goods only as rejected; post and reversal in one transaction (`ledger.ts`, the
  only writer of stock); the order moves to RECEIVED and back; an order with receipts cannot be
  cancelled.
- **Inventory**: stock by item / location / lot, lots by expiry with states (expiring soon = 30 days),
  the movement ledger, a read-only FEFO order (`fefoCandidates`, `GET /warehouse/stock/fefo`).
- **Permissions**: `warehouse.receiving.cancel` (MANAGE) added; `receiving.view` / `.process` and
  `inventory.view` reused; the EP28 structure lock registered (no unit / tracking change once lots,
  stock or receipt lines exist).
- **Visibility**: Purchasing sees per line received / rejected / remaining, receipts and receive
  events on the order; Accounting sees the receive state on deposit orders; Executive reads receipts
  and stock; System Admin, Sales, Purchasing and Accounting have no stock access.
- **Screens** (TH / EN / ZH, `frontend/src/features/warehouse/`): Warehouse workspace (real counts),
  Pending receive (progress, receipts, *Receive goods*), Goods receipts (list; receipt with stacked line
  editor, nested allocation rows, post / reverse confirmations, timeline), Inventory, Lots & expiry,
  Movements; Purchasing order and Accounting deposit pages extended; Company activity reads receipt,
  lot and receive events in words.
- **Demo**: one more approved request and order in the demo branch; three posted receipts (partial raw
  material; finished goods in three lots + boxes with 4 rejected → order RECEIVED); FEFO B, A, C.

## Decisions

1. **Rejected quantity** is never stock and stays owed unless the line is marked *no replacement*,
   which closes that much of the order line. Accepted + rejected never exceeds what remains (no
   over-delivery tolerance).
2. **Lot identity is company-wide** `(item, lot number)` with **one expiry**; a re-delivery with another
   expiry is refused. No lot is generated for OPTIONAL items.
3. **Over-receive safety** comes from locking the order row on every post (receipts of one order are
   serialized); balances use single-statement upserts / conditional decrements.
4. **`RECEIVED`** is a real order status (the order lifecycle benefits from a terminal "done"), set and
   cleared only by the ledger; `ORDERED_STATUSES` includes it so requests stay ordered.
5. **Lot / expiry rules use the item's current settings**, and the structure lock keeps them stable
   once stock exists.
6. **New code `warehouse.receiving.cancel`**: reversing stock is a MANAGE decision; staff receive and post.

## Verification

| Gate | Result |
| --- | --- |
| Backend Prisma validate · typecheck · lint · format · build | pass |
| Backend tests | 24 files, 364 tests, pass (EP30: 346; + 17 warehouse, + 1 demo) |
| Frontend typecheck · lint · format | pass |
| Frontend tests | 49 files, 1,057 tests, pass |
| Frontend build + prerender | 108 pages + 3 shells verified |
| Performance budget | within budget |

**Performance.** All JS **4,252.5 / 4,300 KiB** (EP30: 4,194.8; +57.7), initial JS **182.6 KiB gzip**
(unchanged), static HTML **529 / 560 KiB** (+1), 111 files. Lazy chunks: `ReceiptsArea` 17.9 KiB (5.4
gzip), `InventoryArea` 4.0 (1.7), `MovementsArea` 4.1 (1.7), `WarehouseHome` 1.7 (0.9), shared
`whParts` with the copy 24.0 (8.1); `ReceiveArea` 7.4, `OrdersArea` 30.5. No dependency added, caps
unchanged. **Noted:** the public `/login` route grew 63.3 → 65.0 KiB gzip (budget 72): adding the lazy
Warehouse entries made the bundler's icon grouping (`entriesAware`) merge small lucide chunks so that
`/login` loads one 1.8 KiB icon chunk more. No login code changed; grouping the new screens into
fewer chunks did not change it, and the EP30-tuned chunk config was left alone. Headroom ≈ 48 KiB.

**Migration** (scratch PostgreSQL 18): fresh database → 13 migrations, demo seed, second seed
"unchanged", schema drift none. **EP30 → EP31 upgrade:** EP30 code (worktree at `2bad43d`) migrated and
seeded, then the EP31 migrations applied — counts and md5 row hashes of **13 tables identical**
(companies, members, branches, permission overrides, items, units, suppliers, locations, requests,
request lines, orders incl. deposit state, order lines, audit); the EP31 seed then adds its part once
(second run unchanged); ledger = balances.

**Real-stack QA** (real API, scratch database, seeded personas, **42 checks, all pass**):
warehouse.demo context (Demo Branch, process yes, cancel no); seeded partial order and FEFO B, A, C;
new order → Pending Receive → GR (lot required, expiry required, expired refused) → split lot QA-LOT-1
6 MAIN + 4 RECEIVING, 1 rejected damaged → stock and 3 movements → remaining 15 → second GR → order
RECEIVED; posted GR locked; Purchasing progress / receipts / timeline, no GR or stock API, cannot
cancel a received order; Accounting / Sales / System Admin closed; Executive reads only; nine Warehouse
responses with no financial key or value; staff cannot reverse, reversal needs a reason, owner reverses
→ balance restored, original + reversal movements, order reopened; FEFO with 2026-11-15, 2026-12-01,
2027-01-01 in that order; lots view sorted by expiry. **Concurrency:** 10 simultaneous GR creates →
distinct consecutive numbers; **7 + 7 of a remaining 10, 10 rounds — always exactly one posts**; the same
new lot into the same balance from two orders at once → one lot, balance 10; one GR posted 3× at once →
one success, one movement. After all QA: 0 balances differ from the ledger, 0 duplicate movements, 0
negative balances.

**API suite** (`backend/test/warehouse.test.ts`, 17 tests): the above plus precision, foreign-branch and
inactive locations, allocation sums, NONE / OPTIONAL / REQUIRED for lot and expiry, LOT_EXPIRY_MISMATCH
on a line and against stock, mass assignment, the 7 + 7 race 6 ×, concurrent same-lot / same-balance,
duplicate post, the immutability trigger (UPDATE and DELETE refused), negative-reversal refusal after a
simulated consumption, FEFO with expired and tied lots, search / filters / paging, permissions per role
(Executive, Viewer, System Admin, Purchasing, Accounting, other branch, other company), audit and the
structure lock.

**UI** (normal production build; headless **Edge 156** and **Chrome 156**, **69 checks each**, no JS
error): keyboard flow Pending receive → *Receive goods* → edit line (lot, expiry, two locations) →
save → post (Enter opens the confirmation, Escape backs out with focus kept, Enter posts); inventory,
lots, movements and the order show the result; Purchasing sees *Fully received* and the receipt;
workspace, pending receive (list, detail), receipts (list, detail), inventory, lots and movements at
**390, 768, 1440 and 1920 px** in TH and in **TH / EN / ZH at 1440** — no horizontal overflow, one `h1`,
every control labelled, no raw keys, no money word; the draft line editor with two allocation rows at
every width without overflow. Firefox is not installed here (not tested); axe is not installed
(structural and keyboard checks only).

## Known limitations

- No sales issue, picking, production, transfers, adjustments, counts, valuation or cost (later episodes).
- No over-delivery tolerance; no unit conversion (receiving in the item's base unit).
- A purchase-order line that is a service or a non-stock item is not received; an order made only of
  such lines never reaches RECEIVED.
- A location can be deactivated while it still holds stock (the stock stays counted; receiving into it
  is refused).
- Expiring-soon threshold fixed at 30 days (display only).
- `/login` +1.7 KiB gzip from icon regrouping (above). Firefox and axe not run.

## Next

[INVENTORY_LEDGER.md §6](INVENTORY_LEDGER.md#6-the-contract-for-later-inventory-episodes): every later
stock change writes `StockMovement` through the same ledger pattern, takes stock in FEFO order and adds
allocation / reservation itself.
