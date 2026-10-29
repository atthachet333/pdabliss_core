# Purchase Orders, Deposits and Pending Receive (EP30)

The second operational document in CORE. A purchase order (PO) is placed with **one supplier**
for goods or services that an **APPROVED purchase request** (EP29) asked for. It carries the
commercial terms the request never had — prices, discounts, tax, currency, payment terms and an
optional supplier **deposit** — and ends, for EP30, in **pending receive**: the order is ready to
arrive. Receiving goods, stock balances, lots and goods receipts are **not** part of EP30.

Source of truth: `backend/src/purchasing/` (`order-policy.ts` actor + transition policy,
`order-input.ts` schemas, `order-service.ts`, `order-views.ts` audience allow-lists, `money.ts`
arithmetic, `ordering.ts` derived quantities, `order-demo.ts`), `backend/src/routes/v1/purchase-orders.ts`,
migration `20261102090000_ep30_purchase_order`. Screens: `frontend/src/features/purchasing/`
(`OrdersArea.tsx`, `DepositsArea.tsx`, `ReceiveArea.tsx` — one lazy chunk each).

## 1. Lifecycle

```
APPROVED PR ──create──▶ PO DRAFT ──issue──┬─(no deposit)──────────────────────────▶ PENDING_RECEIVE
                                          └─(deposit)──▶ WAITING_DEPOSIT ──confirm / waive──▶ PENDING_RECEIVE
DRAFT, WAITING_DEPOSIT, PENDING_RECEIVE ──cancel──▶ CANCELLED (terminal)
```

Statuses: `DRAFT`, `ISSUED`, `WAITING_DEPOSIT`, `PENDING_RECEIVE`, `CANCELLED`. `ISSUED` is the
moment of issue: an issued order lands in `WAITING_DEPOSIT` or `PENDING_RECEIVE` in the same
transaction (the value is kept for a future supplier-acknowledgement step; no row holds it today).
The **deposit state is separate**: `NOT_REQUIRED`, `PENDING`, `CONFIRMED`, `WAIVED`.

| Action | From | Who | To | Notes |
| --- | --- | --- | --- | --- |
| create | — (APPROVED request) | `purchasing.orders.create` | DRAFT | in the request's branch |
| edit (header, lines, deposit) | DRAFT | `purchasing.orders.edit`, or the creator with `.create` | DRAFT | |
| issue | DRAFT | `purchasing.orders.approve` | WAITING_DEPOSIT / PENDING_RECEIVE | needs supplier, ≥ 1 line, a price on every line, deposit ≤ total |
| cancel | DRAFT | as edit, or `.cancel` | CANCELLED | reason optional |
| cancel | WAITING_DEPOSIT, PENDING_RECEIVE | `purchasing.orders.cancel` | CANCELLED | **reason required**; before any receipt (none exist before EP31) |
| deposit confirm | WAITING_DEPOSIT | `accounting.deposits.confirm` | PENDING_RECEIVE | optional payment reference |
| deposit waive | WAITING_DEPOSIT | `accounting.deposits.confirm` | PENDING_RECEIVE | **reason required** |

One table decides all of it (`order-policy.ts`, `poRefusal()`): someone without authority gets
403 without learning the state; with authority, a wrong status is 409 (`PO_NOT_EDITABLE` /
`PO_INVALID_TRANSITION`); every action also needs the order's branch (EP26). Transitions are
conditional updates on the status they were decided from — of two simultaneous decisions
(confirm vs waive, cancel vs issue) exactly one succeeds; the other gets `PO_STATE_CHANGED`.

**An issued order is commercially immutable** (supplier, lines, quantities, prices, deposit).
A correction is *cancel + a new order*. There is no arbitrary status PATCH: only
`POST /:id/issue`, `/cancel`, `/deposit/confirm`, `/deposit/waive`.

## 2. Numbering

`PO-YYYYMM-NNNNNN` (e.g. `PO-202610-000001`): company-wide, restarting each month (company time
zone), taken when the draft is created and immutable. Counter: `DocumentSequence (companyId,
'PO:YYYYMM')`, one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` in the creating transaction —
never `MAX + 1`. A cancelled draft keeps its number (gaps are normal).

## 3. Request → order mapping and quantities

- Every PO line references `purchaseRequestId` **and** `purchaseRequestLineId` (snapshots of the
  request number and line number are kept for display).
- **Branch equality is database-enforced**: an order line carries `branchId` and its foreign keys
  are `(purchaseOrderId, branchId, companyId) → PurchaseOrder` and `(purchaseRequestId, branchId,
  companyId) → PurchaseRequest`, plus `(purchaseRequestLineId, purchaseRequestId, companyId) →
  PurchaseRequestLine`. An order therefore only orders from requests of its own branch and
  company, and a line's request line belongs to that request.
- Derived, never stored on the request (`ordering.ts`):
  - **ordered** = Σ quantity on `ISSUED` / `WAITING_DEPOSIT` / `PENDING_RECEIVE` orders;
  - **in draft** = Σ quantity on `DRAFT` orders (planned — **reserves nothing**);
  - **remaining** = max(requested − ordered, 0).
  The request's own quantity is never changed; a cancelled order counts nowhere, so cancelling
  **releases** its quantities.
- Partial ordering, several orders per request and different suppliers per request are normal;
  one request line appears at most once per order.
- The request stays `APPROVED`; its detail shows per line `NOT_ORDERED` / `PARTIALLY_ORDERED` /
  `FULLY_ORDERED`, requested / ordered / remaining and links to its orders (order numbers only for
  members who may read orders). An approved request with a live order (draft or issued) cannot be
  cancelled (`PR_HAS_PURCHASE_ORDERS`); the lock orders this against an order being created.

**Concurrency (remaining 10, two orders of 7 issued at once).** Issue locks, in this order: the
order row (`FOR UPDATE`), the request rows (`FOR SHARE`, sorted), the request lines (`FOR UPDATE`,
sorted — no deadlock between two issues), and only then reads what is already ordered. Under
PostgreSQL READ COMMITTED the second issue waits for the first, then sees its committed quantity
and fails with `PO_QUANTITY_EXCEEDS_REMAINING` (409). Issued totals can never exceed the
request. Tested 4 × in the API suite and on the real stack.

## 4. Money

Exact decimals end to end (PostgreSQL `numeric`, `Prisma.Decimal` / decimal.js on the server,
decimal strings in JSON, `Intl.NumberFormat` on strings in the browser — never floats).

| Column | Type | Rule |
| --- | --- | --- |
| quantity | numeric(18,6) | > 0, within the unit's precision, ≤ remaining |
| unitPrice | numeric(18,4) | ≥ 0 (> 0 to issue) |
| discountAmount | numeric(18,2) | ≥ 0, ≤ line subtotal |
| taxRate | numeric(5,2) | 0–100 (e.g. 7 for VAT 7 %) |
| lineSubtotal | numeric(18,2) | round2(quantity × unitPrice) |
| lineTax | numeric(18,2) | round2((lineSubtotal − discount) × taxRate / 100) |
| lineTotal | numeric(18,2) | lineSubtotal − discount + lineTax |
| subtotal / discountTotal / taxTotal | numeric(18,2) | Σ lines |
| grandTotal | numeric(18,2) | subtotal − discountTotal + taxTotal |

Rounding is half-up per line; totals are sums of rounded lines, so the stored lines always add up
to the stored totals — database CHECKs hold the same equations. **The server computes every
amount; client totals are refused (400) and never read.** One currency per order (ISO 4217,
`THB` by default; no conversion).

**Deposit**: `NONE`, a fixed `AMOUNT`, or a `PERCENT` (0 < p ≤ 100) of the grand total. The
explicit amount is always stored (a percentage is recomputed whenever the total changes while
DRAFT), with an optional due date and note. At issue it must be > 0 and ≤ the grand total
(`PO_DEPOSIT_EXCEEDS_TOTAL`). Accounting confirms it (who, when, an optional payment reference —
the UI warns never to enter account numbers or credentials) or waives it (who, when, reason).

## 5. Supplier and snapshots

One **active** supplier per order (`REFERENCE_INACTIVE` / `REFERENCE_NOT_FOUND` otherwise; another
company's supplier is "not found"). Supplier code, name, tax ID / branch, address, contact name,
phone and email are copied when chosen, refreshed at issue and **frozen** from then on (a later
rename does not rewrite the order). Item code / name and unit come from the request line and are
refreshed from the item master at issue (an inactive item or a changed base unit refuses the
issue: `PO_LINE_INACTIVE` / `PO_LINE_STALE`). Branch code / name and the request number are
snapshotted too; prices are the order's own.

## 6. Permissions (EP27 catalog)

| Code | Tier | Meaning |
| --- | --- | --- |
| `purchasing.orders.view` | READ | read orders (Purchasing view; Executive gets a summary) |
| `purchasing.orders.create` | OPERATE | create a DRAFT from an approved request; edit / discard own drafts |
| `purchasing.orders.edit` (new) | OPERATE | edit / discard any DRAFT in the member's branches |
| `purchasing.orders.approve` | MANAGE | **issue** an order (no separate `issue` code — approving an order is issuing it) |
| `purchasing.orders.cancel` (new) | MANAGE | cancel an issued order |
| `accounting.deposits.view` (new) | READ | the deposit queue, with order amounts |
| `accounting.deposits.confirm` (new) | MANAGE | confirm **or** waive a deposit (`confirm`: a domain action like `process`) |
| `warehouse.receiving.view` | READ | orders pending receive — quantities only |

Role defaults: **Purchasing Manager** — every order action; **Purchasing Staff** — view, create,
edit drafts (never issue or cancel issued); **Accounting Manager** — deposits view + confirm
(financial read of the order; no order editing, `GET /purchase-orders` is 403); **Accounting
Staff** — deposits view; **Warehouse** (all tiers) — pending receive view; **Executive** — read
everywhere (Executive summary, no drafts, no actions); **Owner** — everything; **System Admin** —
nothing unless assigned to the department (administration ≠ operations). Exceptions (ALLOW / DENY)
work as in EP27. The override CHECK lists **56** operational codes.

## 7. Audience views (server-side allow-lists)

Each response is built for one audience and parsed through a zod schema that **drops every key it
does not name** (`order-views.ts`):

| View | For | Contains |
| --- | --- | --- |
| `PurchasingPOView` | Purchasing, Owner | everything: supplier identity and contact, terms, note, lines with prices / tax / totals, request requested / ordered / remaining, deposit, actions, timeline |
| `AccountingDepositView` | Accounting | number, status, branch, supplier code / name / tax ID, currency, terms, totals, lines with amounts, the deposit, deposit actions — no note, contact or editing |
| `WarehousePendingReceiveView` | Warehouse | number, status, branch, supplier code / name, dates, lines (item / description, unit, quantity, request number) — **no price, discount, tax, total, currency, deposit, terms, note or supplier contact** |
| `ExecutivePOView` | Executive | number, status, branch, supplier name, currency, grand total, deposit status / amount, line count, request numbers — no lines, contact, terms or actions |

Warehouse privacy holds **by any route**: `GET /purchase-orders/*` and `/accounting/deposits/*`
are closed to Warehouse (403 / 404), and the pending-receive list and detail are tested key by key
and string by string (no amount, price, terms, tax ID or contact appears). Every Warehouse key is
classified `operational` (`WAREHOUSE_FIELD_CLASSES`, checked against
`domain/access/data-classification.ts`).

## 8. Visibility

- Purchasing: `purchasing.orders.view` + the order's branch. Drafts are team work (visible to the
  Purchasing readers of the branch). Executive: everything but drafts.
- Accounting: `accounting.deposits.view` + branch, issued orders **with** a deposit only.
- Warehouse: `warehouse.receiving.view` + branch, `PENDING_RECEIVE` only.
- An order a member may not see is "not found" (404). Another company's orders, requests and
  suppliers do not exist for them.

## 9. Audit and timeline

`PURCHASE_ORDER_CREATED`, `_UPDATED` (field names), `_LINE_ADDED` / `_LINE_UPDATED` /
`_LINE_REMOVED` (line no, request number, item code, field names), `_ISSUED` (from → to, whether
a deposit is required), `_CANCELLED` (from → to, whether a reason was given),
`_DEPOSIT_CONFIRMED`, `_DEPOSIT_WAIVED`. **Never amounts, prices, supplier names, deposit values,
references or reasons.** The order page shows a timeline (created / issued / deposit confirmed or
waived / cancelled). Platform Inspection lists that order events happened — no number, amount or
supplier (`PurchaseOrder` ∈ `BUSINESS_AUDIT_ENTITIES`).

## 10. API

`/api/v1/purchase-orders` (session required):

| Method | Path |
| --- | --- |
| GET | `/context` — order / deposit / receiving authority, branches |
| GET · POST | `/` (list `?view=all|open&status&branchId&supplierId&purchaseRequestId&q&page` with status counts · new DRAFT `{ purchaseRequestId, supplierId?, currency?, expectedDate?, paymentTerms?, note?, deposit?, lines? }`) |
| GET · PATCH | `/:id` (detail · DRAFT header incl. `deposit: { type, value?, dueDate?, note? }`) |
| POST · PATCH · DELETE | `/:id/lines` `{ purchaseRequestLineId, quantity, unitPrice?, discountAmount?, taxRate?, note? }` · `/:id/lines/:lineId` |
| POST | `/:id/issue` · `/:id/cancel {reason?}` · `/:id/deposit/confirm {reference?}` · `/:id/deposit/waive {reason}` |
| GET | `/supplier-options?q=` · `/source-requests?q=` · `/source-requests/:id` (lines with requested / ordered / in draft / remaining) |

`/api/v1/accounting/deposits` — `GET /?view=pending|all` · `GET /:id`.
`/api/v1/warehouse/pending-receive` — `GET /` · `GET /:id`.

Strict bodies: `status`, `number`, `branchId`, `companyId`, totals, line amounts, `depositAmount`,
`depositStatus`, snapshots, actors and any unknown field are refused (400); money and quantities
must be decimal strings with the allowed places.

## 11. Screens

- **Purchasing workspace** (`/core/purchasing`): request tiles plus order tiles — requests to
  order, draft orders, waiting for deposit, pending receive — counted by the API.
- **Orders** (`/core/purchasing/orders`): list (all / in progress, status, branch, search);
  **new** from a request (only lines with something left, default = what remains, checked before
  sending; optional supplier); **one order**: facts, supplier and terms (editable while DRAFT),
  lines (price / discount / tax per line, edited in place; add from the order's requests), amounts
  (server totals) and deposit editor, issue / cancel confirmed in place, timeline. Executive:
  read-only summary.
- **Request page**: per line ordered / remaining, state and order links; "Order from this
  request".
- **Accounting — Deposits to confirm** (`/core/accounting/deposits`, linked from the Accounting
  card): queue (to confirm / all), one order with amounts and lines, confirm (reference) / waive
  (reason).
- **Warehouse — Pending receive** (`/core/warehouse/pending-receive`, linked from the Warehouse
  card): list and detail with quantities only; a note that receiving comes later; no receive
  action.

TH / EN / ZH; status is text plus a subtle tone; errors in alerts, results in a polite live
region; confirmations are labelled groups (Escape backs out, focus returns to the heading).

## 12. Demo data

`db:seed:demo` adds (once each, stable `demo` keys): a fifth request — Purchasing, Head Office,
APPROVED by the owner — and four orders with the demo supplier `SUP-000001`:

| Key | Branch | State | For |
| --- | --- | --- | --- |
| `PO_DRAFT` | 00000 | DRAFT (packaging, priced) | `purchasing.demo` |
| `PO_WAITING_DEPOSIT` | 00000 | WAITING_DEPOSIT, 30 % deposit | `accounting.demo` (Head Office) |
| `PO_PENDING_RECEIVE` | 00001 | PENDING_RECEIVE, 8 of 12.5 kg | `warehouse.demo` (demo branch) |
| `PO_CANCELLED` | 00001 | CANCELLED after issue (4.5 kg released) | history |

## 13. Next (EP31+)

Goods receipt against `PENDING_RECEIVE` lines (`warehouse.receiving.process`), received quantities,
lots / expiry from the EP28 item tracking, stock balances, FEFO; supplier invoices and payments;
"cancel before any receipt" becomes a real check once receipts exist.
