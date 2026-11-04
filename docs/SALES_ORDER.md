# Sales Order (EP33)

Commercial demand truth: **what a customer ordered, in which branch, at what selling terms**, with
server-computed totals. A sales order **never moves, reserves or allocates stock** — availability is
read from the EP31 ledger on every response and never stored. Allocation is EP34; picking, delivery
and completion are EP35.

Code: `backend/src/sales/` (policy, input, availability, service, views, demo),
`backend/src/routes/v1/sales.ts`, `frontend/src/features/sales/`. Tests:
`backend/test/sales-orders.test.ts`, `frontend/src/features/sales/sales.test.tsx`.

## 1. Boundaries

| Sales order does | Sales order does not |
| --- | --- |
| Record customer, items, quantities, unit price, discount, tax, totals | Write `StockMovement` / `StockBalance` |
| Show availability **now** per line and per order (information) | Reserve, allocate, or mark any lot |
| Snapshot customer / item / unit identity, freeze it at confirmation | Show purchase cost, supplier price, margin or valuation |
| Keep an audit trail and a timeline | Invoice, deliver, take payment (later episodes) |

## 2. Data model

`SalesOrder` (company, branch, number, status, customer snapshot, `orderDate` / `requestedDate`
as calendar days, `customerReference`, note, currency `THB`, totals, the person and time of every
step, `cancellationReason`) and `SalesOrderLine` (item / unit / type / `inventoryTracked`
snapshots, `unitPrecision`, quantity `Decimal(18,6)`, unit price `Decimal(18,4)`, discount, tax rate,
line amounts, note). Company-bound composite foreign keys everywhere (`[id, companyId]`); a line
belongs to its order **and branch** (`[salesOrderId, branchId, companyId]`). Database CHECKs: number
format, status / step consistency, dates, totals, line amounts, line numbers. The migration
(`20261105090000_ep33_sales_order`) is purely additive.

## 3. Lifecycle and policy

`backend/src/sales/policy.ts` is the one place that answers *who may do what*. EP33 reuses the EP27
codes; there is no `submit` or `confirm` code.

| Action | From | Who | To |
| --- | --- | --- | --- |
| edit header / lines | DRAFT | its creator, holding `sales.orders.create` | DRAFT |
| submit | DRAFT | same | SUBMITTED |
| cancel (discard) | DRAFT | same; reason optional | CANCELLED |
| confirm | SUBMITTED | `sales.orders.approve` (MANAGE) | CONFIRMED |
| cancel | SUBMITTED, CONFIRMED | `sales.orders.cancel` (MANAGE); **reason required** | CANCELLED |

- CANCELLED is terminal. CONFIRMED is commercially immutable — change = cancel + new order.
- Every action also needs the order's branch (EP26 branch access).
- **Reading** needs `sales.orders.view` in the order's branch. A **DRAFT is visible only to its
  creator and to members who may confirm** — one salesperson's unfinished work is not everyone's.
  An order the member may not see is **404 `SO_NOT_FOUND`**, never 403 (no existence leak).
- Without authority, the refusal says nothing about the state (403 before 409).
- `sales.orders.edit` stays reserved (unused): editing a draft is part of creating it.
- Role defaults (EP27): Staff = view + create; Manager adds approve + cancel; Executive / Viewer read
  (submitted work only); Warehouse, Accounting, Purchasing and System Admin without the Sales
  department see nothing (403).

Refusal codes: `SO_NOT_EDITABLE`, `SO_INVALID_TRANSITION`, `SO_ALREADY_CONFIRMED`, `SO_EMPTY`,
`REASON_REQUIRED`, `REFERENCE_NOT_FOUND`, `REFERENCE_INACTIVE`, `QUANTITY_PRECISION`,
`DISCOUNT_EXCEEDS_SUBTOTAL`, `REQUESTED_DATE_INVALID`, `BRANCH_SELECTION_REQUIRED`,
`BRANCH_NOT_ALLOWED`, `PERMISSION_DENIED`.

## 4. Numbering

`SO-YYYYMM-NNNNNN`, a company-wide monthly sequence (`DocumentSequence` key `SO:YYYYMM`, the same
upsert-and-return pattern as PO / PR), taken in the creating transaction from the **order date's**
month. Immutable; unique per company; gapless under concurrent creation (tested).

## 5. Money

The EP30 arithmetic (`purchasing/money.ts`), exact decimals, half-up to 2 places **per line**:
`lineSubtotal = round2(qty × unitPrice)`, `lineTax = round2((lineSubtotal − discount) × rate / 100)`,
`lineTotal = lineSubtotal − discount + lineTax`; order totals are sums. Tax is **exclusive**
(`taxTotalLabel: 'exclusive'`). A discount may not exceed its line subtotal. The client sends only
quantity, unit price, discount and rate as decimal **strings**; any total, amount, number, status or
snapshot in a request is **400** (strict schemas), never ignored.

## 6. Availability (informational only)

`backend/src/sales/availability.ts` reads balances and writes nothing. **EP34:** it also reads
reservations — `available` is on hand − reserved, and a line compares what it still needs after its own
reservations; see [SALES_ALLOCATION.md](SALES_ALLOCATION.md) §7.

- `onHand` = Σ balances of the item in the **order's branch** (every location and lot).
- `available` = Σ of the balances FEFO would offer: on hand > 0 and lot not expired — exactly the
  set `fefoCandidates` lists (a test keeps both equal).
- Within one order, lines of the same item consume `available` in line order.
- Per line: `AVAILABLE` (available ≥ ordered) · `PARTIALLY_AVAILABLE` · `UNAVAILABLE` (0) ·
  `NOT_STOCK_TRACKED` (item not tracked); `shortage = max(0, ordered − available)`.
- Per order: the worst tracked line; `NOT_STOCK_TRACKED` only when no line is tracked; `null` for a
  cancelled or empty order.
- Two orders may both "see" the same stock. **It is not a reservation**; EP34 allocation decides who
  gets it (the UI note now reads "Only allocation holds stock").
- `GET /orders?availability=SHORTAGE` and the `withShortage` count consider **open** orders
  (SUBMITTED, CONFIRMED) with a line short now (bounded to the 1,000 most recently updated open
  orders in scope).

## 7. Snapshots

Customer (code, name, tax ID, tax branch) and line item / unit / type / tracking / precision are
copied from the master on every draft change, **re-validated and refreshed at submit and at
confirm** (an inactive customer or item blocks the step with `REFERENCE_INACTIVE`), then frozen.
Later master changes never reach a confirmed order.

## 8. API — `/api/v1/sales` (session required)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/context` | capabilities, branches, selected branch, counts (my drafts, awaiting confirmation, confirmed, with shortage), company day |
| GET | `/items?q=&branchId=` | active items (code / name / SKU / barcode), unit, the branch's `available` — no cost, no location / lot |
| GET | `/orders` | `?status, branchId, customerId, availability=SHORTAGE, from, to, q, page, pageSize≤100` |
| POST | `/orders` | `{customerId, orderDate?, requestedDate?, customerReference?, note?, lines?}` → 201 DRAFT in the working branch |
| GET | `/orders/:id` | `{order, timeline}` with lines, availability, `progress`, `actions` |
| PATCH | `/orders/:id` | DRAFT header (only changed fields) |
| PUT | `/orders/:id/lines` | DRAFT lines, replaced whole (≤ 100) |
| POST | `/orders/:id/submit` · `/confirm` · `/cancel {reason?}` | transitions above |

Customers for the picker come from `/api/v1/master-data/customers` (`sales.customers.view`).

## 9. Privacy

Responses are explicit allow-lists (`sales/views.ts`, parsed before sending). Sales is cleared for
operational + commercial data: selling price, discount, tax, totals. `SALES_FIELD_CLASSES` classifies
every key; none is financial, and a test refuses any key matching cost / margin / supplier. No
Warehouse endpoint returns sales data, and Warehouse members get 403 on every Sales endpoint. The
Platform explorer sees that a `SalesOrder` event happened, never its number or details.

## 10. Audit and timeline

`SALES_ORDER_CREATED`, `_UPDATED` (changed field names / line count), `_SUBMITTED`, `_CONFIRMED`,
`_CANCELLED` (from → to). Details carry the number, statuses and line counts — **never prices,
totals, notes or reasons**. The order's timeline shows created / submitted / confirmed / cancelled
with actor and time.

## 11. Concurrency

Every write locks the order row (`SELECT … FOR UPDATE`) and re-checks visibility and policy inside
the transaction: two confirms → one 200 + one 409; confirm vs cancel → one consistent outcome; an
edit racing a submit lands before it or is refused (`SO_NOT_EDITABLE`). Numbers come from the
sequence upsert (unique, gapless).

## 12. Frontend — `/core/sales/*` (one lazy chunk, ≈ 36 KiB raw)

- **Workspace** — count tiles (they filter the list; state in the URL), search, status filter,
  "short of stock only", server-paged list (number, status, customer, availability, grand total,
  requested date, creator, updated). Cards below 768 px.
- **New order** — customer search + select, order / requested dates, customer reference, note.
- **Order** — facts, header editor and line editor while DRAFT (the creator), read-only lines with
  amounts and availability afterwards, server totals, the actions the server lists (each confirmed in
  place; cancelling a submitted / confirmed order requires a reason), timeline.
- Quantities are checked against the unit's decimal places before sending; amounts are always the
  server's. TH / EN / ZH. The CORE home links the Sales card to `/core/sales` for members with
  `sales.orders.view`.

## 13. Demo data (`sales/demo.ts`, created once each)

| Key | Branch | By | State |
| --- | --- | --- | --- |
| `SO_DRAFT` | 00000 | sales.demo | DRAFT, packaging |
| `SO_SUBMITTED` | 00000 | sales.demo | awaiting confirmation; Head Office has no demo stock → UNAVAILABLE |
| `SO_CONFIRMED` | 00001 | owner.demo | confirmed; the EP31 / EP32 demo stock covers it → AVAILABLE |
| `SO_CANCELLED` | 00000 | sales.demo → owner.demo | submitted, then cancelled with a reason |

`sales.demo` stays Staff (it cannot confirm); `owner.demo` confirms and cancels.

## 14. Contract for EP34 / EP35

- `SalesOrderLine` has a unique `[id, salesOrderId, companyId]` as the target of allocation foreign keys.
- Each line's `progress` already carries `ordered`; `allocated`, `picked`, `delivered` and
  `outstanding` are **null** until those episodes fill them — never faked.
- EP34 may allocate only CONFIRMED lines; cancelling an order with allocations will need a rule there.
  **Done in EP34** ([SALES_ALLOCATION.md](SALES_ALLOCATION.md)): `progress.allocated` is filled for
  tracked lines, and cancelling releases every reservation (`ORDER_CANCELLED`) in the same transaction.
- **EP35** ([SALES_FULFILLMENT.md](SALES_FULFILLMENT.md) §9): `progress` is now
  `{ordered, allocated, picked, packed, dispatched, delivered, toDispatch, toDeliver}` — cumulative
  milestones plus two outstanding quantities, per line in its unit (`outstanding` was replaced by
  `toDispatch` / `toDeliver`); null for lines that are not inventory-tracked. The order view adds
  `fulfilment: {state, shipments[]}` (shipment number, status, dispatched / delivered time, exception
  reason — no location or lot). A confirmed order with dispatched stock can no longer be cancelled
  (`SO_ALREADY_DISPATCHED`); with staged picks / packs / shipments it is refused until those are
  cancelled (`FULFILMENT_IN_PROGRESS`).

## 15. Known limitations (deliberate)

- No price lists, customer-specific prices or credit limits; the unit price is typed.
- One currency (THB); tax exclusive only.
- Lines in the item's base unit only (no unit conversion).
- No partial cancellation or line-level status; a confirmed order changes only by cancellation.
- Availability is branch-wide (all locations), not per location; no ATP / incoming stock.
- No customer purchase-order document (the earlier prototype's "Customer PO") — the customer's
  reference is a text field.
