# Sales Allocation and Pick Readiness (EP34)

A manager reserves stock for a **CONFIRMED** sales order. The reservation says which stock (location,
item, lot) is promised to which order line; it is **not a movement** — `StockMovement` and
`StockBalance` are never written by Sales. On hand changes only when stock physically moves (EP35
picking / delivery will consume reservations). Warehouse sees the reserved demand as **Pending Pick**.

Report: [EP34_REPORT.md](EP34_REPORT.md). Sales orders: [SALES_ORDER.md](SALES_ORDER.md). Ledger:
[INVENTORY_LEDGER.md](INVENTORY_LEDGER.md) §8.

## 1. Boundaries

- Only CONFIRMED orders allocate; only **inventory-tracked** lines reserve. Service / non-stock lines
  never block readiness.
- Stock comes from the **order's branch** only (any ACTIVE location of it); nothing is borrowed from
  another branch.
- The server decides every quantity, location and lot. `allocate` / `release` / `reallocate` take **no
  body** — a client that names a quantity, location, lot or status gets 400.
- No picking, packing, delivery, invoicing or partial cancellation (EP35+).

## 2. Data model — `SalesAllocation`

| Column | Meaning |
| --- | --- |
| `companyId`, `branchId`, `salesOrderId`, `salesOrderLineId` | composite FKs: the line belongs to the order, the order to the branch and company |
| `itemId`, `locationId`, `lotId`, `lotKey` | the `StockBalance` identity reserved (`lotKey` = `lotId` or `''`); the location FK carries `branchId`, so a reservation cannot sit in another branch |
| `quantity` | > 0, `Decimal(18,6)` |
| `status` | `ACTIVE` · `RELEASED` · `CONSUMED` (EP35: dispatched — `consumedAt`, `salesShipmentLineId`, `splitFromId` when a partial dispatch split the row) |
| `activeSlot` | `true` while ACTIVE, `NULL` after — unique `(line, location, lotKey, activeSlot)` = **one ACTIVE row per identity per line** |
| `releasedAt`, `releasedByMemberId`, `releaseReason` | set together exactly when RELEASED; reasons `RELEASED` · `REALLOCATED` · `ORDER_CANCELLED` |
| `createdByMemberId`, timestamps | who reserved |

Migration `20261106090000_ep34_sales_allocation` is **purely additive** (one table, two enums, three
indexes). Hand-written guards: `SalesAllocation_quantity_check` (quantity > 0, `lotKey` matches
`lotId`), `SalesAllocation_status_check` (ACTIVE ⇔ slot held; RELEASED ⇔ who / when / why) and a
`BEFORE DELETE` trigger — **reservation history is never deleted**, only released.

## 3. Reserved and available

`backend/src/warehouse/reservations.ts` is the one place that knows how much is claimed:

```
on hand   = StockBalance.quantityOnHand        (physical truth, unchanged by reservations)
reserved  = Σ ACTIVE SalesAllocation of the identity
available = on hand − reserved                 (never below 0 — the invariant keeps it so)
```

**Invariant: reserved ≤ on hand for every identity, under concurrency.** Both sides serialize on the
`StockBalance` **row lock**:

- an allocation locks the branch's positive balances of the items it needs (`lockBalances`, id order)
  and only then reads balances, lots and what is reserved;
- every physical decrease goes through `applyMovement()` → `takeRespectingReservations()`: it locks the
  balance row, reads what is reserved and refuses to leave less than that (`409 STOCK_RESERVED`, details
  item / location / onHand / reserved / available — never an order number).

Reads after the lock are separate statements, so under READ COMMITTED they see every reservation or
decrease that committed while waiting. If PostgreSQL still aborts one side (deadlock / serialization
failure), the API answers `409 CONCURRENT_UPDATE` ("try again") — nothing was written.

What respects reservations: transfers (draft check + posting), adjustment decreases (draft check +
posting), cycle-count corrections, and every reversal (receipt, transfer, adjustment). Inventory screens
and the transfer / adjustment stock pickers offer **available** stock, not on hand.

## 4. Allocation algorithm (`backend/src/sales/allocation.ts`)

Inside the caller's transaction (the order row is already locked and its status / the actor's
authority checked):

1. each tracked line still needs `ordered − Σ its ACTIVE reservations` (nothing → nothing to do, so a
   repeated allocate **never double-reserves**);
2. lock the branch's positive balances of those items, then read them;
3. candidates: ACTIVE location, lot not expired (today in the company's timezone), `on hand − reserved
   > 0`, in **FEFO** order (`warehouse/service.ts byFefo` — the same order as `/stock/fefo`);
4. lines in `lineNo` order take `min(free, needed)` candidate by candidate; an existing ACTIVE row for
   the same (line, location, lot) grows, otherwise a row is created.

What cannot be covered stays a **shortage**; the order can be allocated again when stock arrives.

## 5. States

Derived on every read from the tracked lines of a CONFIRMED order (`null` otherwise):

| Allocation state | Pick readiness | When |
| --- | --- | --- |
| `NOT_ALLOCATED` | `NOT_READY` | no tracked line has anything reserved |
| `PARTIALLY_ALLOCATED` | `PARTIALLY_READY` | some reserved, some line short |
| `FULLY_ALLOCATED` | `READY` | every tracked line fully reserved |

Each tracked line of a CONFIRMED order carries `allocation: { allocated, shortage }`, and
`progress.allocated` is filled (EP33 left it null). `picked` / `delivered` / `outstanding` stay null
until EP35.

## 6. Actions and policy

| Action | From | Permission | Effect |
| --- | --- | --- | --- |
| `POST /orders/:id/allocate` | CONFIRMED, not fully allocated | `sales.orders.approve` | reserve what is still short (FEFO) |
| `POST /orders/:id/release` | CONFIRMED with reservations | `sales.orders.approve` | every ACTIVE row → RELEASED (`RELEASED`) |
| `POST /orders/:id/reallocate` | CONFIRMED with reservations | `sales.orders.approve` | release (`REALLOCATED`) + allocate again, one transaction |
| `POST /orders/:id/cancel` | SUBMITTED / CONFIRMED | `sales.orders.cancel` | EP33 cancel; **EP34: every ACTIVE row → RELEASED (`ORDER_CANCELLED`) in the same transaction** |

No new permission code: the manager who confirms an order commits stock to it (`approve`). Staff,
Executive and Viewer see allocation progress and act on nothing; Warehouse, Accounting, Purchasing and
System Admin without the Sales department get 403 on every Sales endpoint. A hidden order is 404.
Refusals: allocating a DRAFT / SUBMITTED / CANCELLED order is `409 SO_INVALID_TRANSITION`; release or
reallocate with nothing reserved is `409 SO_NOT_ALLOCATED`. `allocate` / `reallocate` responses add an
`allocation` result (state, readiness, `allocatedNow`, per line ordered / allocatedNow /
totalAllocated / shortage — quantities only; Sales never sees locations or lots).

Every action locks the order row first, so allocate / release / reallocate / cancel on one order
serialize: allocate racing cancel ends CANCELLED with nothing reserved.

## 7. Sales availability (EP33 → EP34)

`sales/availability.ts` now reads reservations too: per line `onHand`, `reserved` (by every order),
`available` (= on hand − reserved over the FEFO candidate set, equal to `fefoCandidates`'
`quantityAvailable` — a test keeps both equal). A line compares what it **still needs** (ordered −
its own reservations) with `available`, so a fully allocated line is AVAILABLE whatever the branch has
left. The UI note reads "Available = on hand − stock reserved for confirmed orders, as of now. Only
allocation holds stock."

## 8. Pending Pick — `GET /api/v1/warehouse/pending-pick`

Read with `warehouse.inventory.view`, in the member's branches (`?branchId=` narrows; another branch
yields an empty list), `?readiness=`, `?q=` (order number or item code), paged. It lists CONFIRMED
orders with at least one ACTIVE reservation: number, branch, order / requested / confirmed dates,
readiness, and per tracked line ordered / allocated / shortage plus **where** the reserved stock is
(location, lot, expiry, expiry state, quantity).

Parsed through an allow-list (`warehouse/views.ts PickDemandOrder`): **no customer, price, discount,
tax, total, note or reference** ever leaves it. EP35: each reserved location also says what is still
**to pick** (reserved − claimed by open picks); picks are created from it ([SALES_FULFILLMENT.md](SALES_FULFILLMENT.md)). The
Warehouse context adds a `pendingPick` count; `/stock` rows add `quantityReserved` /
`quantityAvailable`. The movement ledger contains no reservation entries.

## 9. Audit and timeline

`SALES_ALLOCATION_CREATED` (lines touched), `SALES_ORDER_FULLY_ALLOCATED` /
`SALES_ORDER_PARTIALLY_ALLOCATED` (short line count), `SALES_ALLOCATION_RELEASED` (reason,
reservation count), `SALES_ALLOCATION_REALLOCATED` (released count). Details carry the order number
and counts — **never quantities of value, prices, customers or notes**. A repeat allocate that adds
nothing records nothing. The order timeline shows them; the Platform explorer redacts `SalesOrder`
events as in EP33.

## 10. Frontend

- **Sales order** (`/core/sales/orders/:id`): a lazy `AllocationSection` on CONFIRMED orders — state
  and readiness pills, shortage summary (`role="status"`), per line ordered / reserved / short, and the
  actions the server lists (Allocate, Allocate again, Release), each confirmed in place; focus returns to
  the section after the confirm box closes and the result is announced.
- **Warehouse** (`/core/warehouse/pending-pick`): lazy `PendingPickArea` — readiness filter, search,
  orders as cards (every width) with lines and pick locations / lots / expiry. A home tile shows the count.
- **Inventory**: on hand / reserved / available columns; rows are labelled cards below 1024 px (eight
  columns do not fit a 768 px table). Transfer and adjustment pickers list available stock.
- TH / EN / ZH throughout.

## 11. Demo data (`sales/demo.ts`, created once each)

| Key | Branch | State |
| --- | --- | --- |
| `SO_CONFIRMED` (EP33) | 00001 | allocated in full → `READY` (FG lot FG-DEMO-B from MAIN + RECEIVING, packaging) |
| `SO_ALLOC_PARTIAL` | 00001 | FG 14 (FG-DEMO-A 12 + FG-DEMO-C 2, two FEFO lots) + raw material 8 kg of which 5 exist → `PARTIALLY_ALLOCATED` |
| `SO_OPEN` | 00001 | packaging 10, confirmed, left unallocated → `NOT_ALLOCATED` |

Allocated through the same `allocateOrder()` as the API, by `owner.demo`; a stable `demo` key in the
audit entry makes a second seed a no-op. `sales.demo` stays Staff.

## 12. EP35 — what became of the contract

Done in EP35 ([SALES_FULFILLMENT.md](SALES_FULFILLMENT.md)):

- **Dispatch consumes reservations** in the same transaction as its `SALES_ISSUE`: the exact quantity
  of the matching ACTIVE row becomes CONSUMED — the whole row, or (partial dispatch) the ACTIVE row is
  reduced and a CONSUMED row of the dispatched quantity is created with `splitFromId`. The CHECK now
  reads: CONSUMED ⇔ `consumedAt` and `salesShipmentLineId` set; one consumption per shipment line
  (unique). The ledger's decrease guard is **not** bypassed: the reservation is consumed first, then
  the movement passes the same check as every other decrease.
- What a line still needs (allocate) and its allocation state count ACTIVE **and** CONSUMED rows, so
  dispatched stock is never reserved again; `release` / `reallocate` touch ACTIVE rows only and are
  refused while picks, packs or a READY shipment hold staged stock (`FULFILMENT_IN_PROGRESS`).
- Order cancel is refused once anything was dispatched (`SO_ALREADY_DISPATCHED`) or while work is
  staged; otherwise it releases as before.
- `progress` carries picked / packed / dispatched / delivered / toDispatch / toDeliver.
- No `SALES_ISSUE_REVERSAL` was added: a dispatched issue is never reversed in EP35 (returns later).

## 13. Known limitations (deliberate)

- Allocation is whole-order (no per-line allocate or manual lot / location choice).
- No automatic allocation on confirm and no re-allocation when stock arrives — a manager allocates again.
- No priority between orders: whoever allocates first gets the stock (FEFO within the branch).
- No reservation expiry.
- Pending Pick lists only orders with something reserved; a confirmed order with nothing reserved is
  visible in Sales (shortage filter), not in Warehouse.
- Expired lots are never reserved; a reserved lot that expires later stays reserved (shown with its
  expiry state in Pending Pick) until released or reallocated.
