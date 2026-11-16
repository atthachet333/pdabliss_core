# EP48 — Executive Metric Dictionary

Code: `backend/src/executive/service.ts` (`collect` → work items; `DEFS` → metrics), shared aggregates
`backend/src/dashboards/facts.ts`. Every value is computed per request from canonical tables; nothing is stored.

## 1. Rules for every metric

| Aspect                | Rule                                                                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit                  | `DOCUMENTS` (one document = 1), `LINES` (document lines, never summed across items or units), `LOTS` (distinct lots). Quantities are **never** shown or added.                                                                                                                                                     |
| Double counting       | Each open document is one work item in one stage; stage metrics are mutually exclusive within a document type. Metrics marked _attribute_ (partially delivered, overdue) are subsets of the open documents and say so.                                                                                             |
| Cancelled / completed | Cancelled documents count nowhere. Completed work appears only in the "recently" metrics (7 company-calendar days including today).                                                                                                                                                                                |
| Drafts                | Not counted (work in preparation, not yet handed to anyone; the Executive never reads draft purchase orders, and sales / production / request drafts are their creator's).                                                                                                                                         |
| Company scope         | The session's company; the request cannot name another (`companyId` → 400).                                                                                                                                                                                                                                        |
| Branch scope          | All active branches the person may work in (EP26), or one chosen (`?branch=`; any other id → 404). Every document has exactly one branch → per-branch values add up to the company value (tested).                                                                                                                 |
| Authorization         | A department's metrics appear only if the viewer holds its read code (Sales `sales.orders.view`; Purchasing `purchasing.requests.view` / `purchasing.orders.view`; Warehouse `warehouse.receiving.view` / `warehouse.inventory.view`; Operations `operations.orders.view`; Accounting `accounting.deposits.view`). |
| Time                  | "Overdue" = the document's own date (requested, needed-by, expected, deposit due, count date, required) is before today in the company time zone. "Recently" = last 7 days. No SLA, no invented threshold.                                                                                                         |
| Empty state           | `0` = no document in that state. A missing department block = no permission.                                                                                                                                                                                                                                       |
| Bounds                | Each document type is read up to 5,000 rows per request; reaching the bound adds the note `TRUNCATED` (values become lower bounds).                                                                                                                                                                                |

## 2. Metrics

### Sales (responsible: Sales, then Warehouse for fulfilment)

| Key                     | Meaning                                                | Source / calculation                                                        | Included statuses           | Drill-down               |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------- | ------------------------ |
| `openOrders`            | Sales orders in progress                               | SO items: SUBMITTED + CONFIRMED with a tracked line not fully delivered     | SUBMITTED, CONFIRMED (open) | `/core/dashboards/sales` |
| `awaitingConfirmation`  | Waiting for a Sales manager                            | stage `SO_AWAITING_CONFIRMATION`                                            | SUBMITTED                   | same                     |
| `awaitingAllocation`    | Confirmed, a line not fully reserved                   | stage `SO_AWAITING_ALLOCATION` (allocated = ACTIVE + CONSUMED reservations) | CONFIRMED                   | same                     |
| `awaitingPick`          | Reserved, a line not fully picked                      | `SO_AWAITING_PICK` (picked = PICKED picks)                                  | CONFIRMED                   | same                     |
| `awaitingDispatch`      | Picked, a line not yet dispatched (packing + dispatch) | `SO_AWAITING_DISPATCH`                                                      | CONFIRMED                   | same                     |
| `outstandingDeliveries` | Dispatched, delivery not yet confirmed                 | `SO_IN_DELIVERY`                                                            | CONFIRMED                   | same                     |
| `deliveryExceptions`    | An open delivery exception                             | `SO_DELIVERY_EXCEPTION` (shipment DELIVERY_EXCEPTION)                       | CONFIRMED                   | same                     |
| `overdue`               | _attribute_: open orders past requested date           | SO items with class OVERDUE                                                 | as open                     | same                     |
| `partiallyDelivered`    | _attribute_: open orders with some delivered quantity  | facts: `someDelivered`                                                      | CONFIRMED                   | same                     |
| `linesToDeliver`        | Lines not fully delivered (LINES)                      | Σ `undelivered` lines of open orders                                        | CONFIRMED                   | same                     |
| `deliveredRecently`     | Fully delivered, last delivery in 7 days               | facts: stage COMPLETED + `lastDelivered`                                    | CONFIRMED                   | same                     |

### Purchasing (responsible: Purchasing; Accounting for deposits; Warehouse for receiving)

| Key                        | Meaning                                                                                           | Calculation                                     | Statuses                                | Drill-down                    |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------- | ----------------------------- |
| `requestsAwaitingDecision` | PRs to approve / reject                                                                           | `PR_AWAITING_DECISION`                          | SUBMITTED                               | `/core/dashboards/purchasing` |
| `requestsToOrder`          | Approved PRs with a line not fully ordered (draft orders reserve nothing — EP30)                  | `PR_AWAITING_ORDER`                             | APPROVED                                | same                          |
| `ordersAwaitingDeposit`    | Issued, deposit pending                                                                           | `PO_AWAITING_DEPOSIT`                           | WAITING_DEPOSIT + depositStatus PENDING | same                          |
| `ordersAwaitingReceipt`    | Issued, not fully received                                                                        | `PO_AWAITING_RECEIPT` + `PO_PARTIALLY_RECEIVED` | PENDING_RECEIVE                         | same                          |
| `ordersPartiallyReceived`  | Some posted receipt, a line still open (EP31: remaining = ordered − accepted − closed rejections) | `PO_PARTIALLY_RECEIVED`                         | PENDING_RECEIVE                         | same                          |
| `linesToReceive`           | Receivable lines still open (LINES)                                                               | Σ open lines                                    | PENDING_RECEIVE                         | same                          |
| `overdueReceipts`          | _attribute_: awaiting receipt past expected date                                                  | receipt stages with class OVERDUE               | PENDING_RECEIVE                         | same                          |
| `receivedRecently`         | Fully received in 7 days                                                                          | `receivedAt`                                    | RECEIVED                                | same                          |

### Warehouse (responsible: Warehouse)

| Key                      | Meaning                                               | Calculation                                | Drill-down                   |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------ | ---------------------------- |
| `receiptsToPost`         | Goods receipts recorded, not posted                   | `GR_TO_POST` (GR DRAFT)                    | `/core/dashboards/warehouse` |
| `adjustmentsToApprove`   | Stock discrepancies submitted for approval            | `ADJ_TO_APPROVE` (SUBMITTED)               | same                         |
| `countsInReview`         | Counted, differences awaiting review                  | `COUNT_IN_REVIEW` (REVIEW)                 | same                         |
| `countsOpen`             | Counts not finished                                   | `COUNT_OPEN` (DRAFT / COUNTING)            | same                         |
| `transfersToPost`        | Draft transfers                                       | `TRANSFER_TO_POST`                         | same                         |
| `lotsExpiringSoon`       | Distinct lots in stock expiring within 30 days (LOTS) | StockBalance > 0 × InventoryLot.expiryDate | `/core/warehouse/lots`       |
| `lotsExpired`            | Distinct expired lots still in stock (LOTS)           | same, expiry < today                       | same                         |
| `receiptsPostedRecently` | Receipts posted in 7 days                             | GR POSTED `postedAt`                       | dashboard                    |

Sales fulfilment work waiting on Warehouse (pick / dispatch / delivery / exception) is counted once, as Sales-order
items whose next department is Warehouse (department health, Sales → Warehouse flow) — not again as picks, packs or
shipments.

### Operations / Production (responsible: Operations; Purchasing for shortages; Warehouse for finished goods)

| Key                    | Meaning                                                         | Calculation                                                                                           | Drill-down                    |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------- |
| `activeOrders`         | Approved and not completed                                      | MO items except `MO_AWAITING_APPROVAL`                                                                | `/core/dashboards/operations` |
| `awaitingApproval`     | Submitted orders                                                | `MO_AWAITING_APPROVAL`                                                                                | same                          |
| `awaitingMaterials`    | Approved, materials short now (cannot be released)              | `MO_MATERIALS_SHORT` — the EP36 shortage handoff (`purchasing.production_shortages.view`); count only | same                          |
| `awaitingReservation`  | Approved, no shortage, reserve and release                      | `MO_AWAITING_RESERVATION`                                                                             | same                          |
| `awaitingIssue`        | In production with active reservations not yet issued           | `MO_AWAITING_ISSUE`                                                                                   | same                          |
| `inProduction`         | Released / in production / output to review                     | `MO_READY_TO_START` + `MO_IN_PRODUCTION` + `MO_OUTPUT_TO_REVIEW`                                      | same                          |
| `paused`               | Paused                                                          | `MO_PAUSED`                                                                                           | same                          |
| `finishedGoodsBacklog` | Accepted output not yet received, or awaiting completion review | `MO_FG_TO_RECEIVE` + `MO_COMPLETION_REVIEW`                                                           | same                          |
| `overdue`              | _attribute_: open orders past required date                     | class OVERDUE                                                                                         | same                          |
| `completedRecently`    | Completed in 7 days                                             | `completedAt`                                                                                         | same                          |

Material readiness is a **state** (short / not short) and a count of short materials — no material quantity, BOM line
or ratio (EP46). Both manufacturing modes are counted the same way (tested with BOM_REQUIRED and BOM_OPTIONAL).

### Accounting (responsible: Accounting — supplier deposits only)

| Key                       | Meaning                            | Calculation                              | Drill-down                    |
| ------------------------- | ---------------------------------- | ---------------------------------------- | ----------------------------- |
| `depositsPending`         | Deposits to confirm or waive       | `PO_AWAITING_DEPOSIT`                    | `/core/dashboards/accounting` |
| `depositsOverdue`         | _attribute_: past deposit due date | class OVERDUE                            | same                          |
| `depositsSettledRecently` | Confirmed or waived in 7 days      | `depositConfirmedAt` / `depositWaivedAt` | same                          |

No amount is shown (the Command Center has no money field). General ledger, revenue, profit, margin, payables,
receivables, cash, tax and bank reconciliation do not exist in CORE and are not invented.

## 3. Branch comparison measures

`sales.openOrders`, `sales.overdue`, `purchasing.requestsToOrder`, `purchasing.ordersAwaitingReceipt`,
`purchasing.overdueReceipts`, `warehouse.receiptsToPost`, `warehouse.countsInReview`, `operations.activeOrders`,
`operations.awaitingMaterials`, `accounting.depositsPending` — each the metric above computed on that branch's items
(only the measures of departments the viewer may see).

## 4. Known measurement limitations

1. No history: CORE stores states, not snapshots — no trend, throughput or SLA can be measured honestly.
2. "Days in stage" uses the timestamp of the state where the record keeps one (submitted / approved / released /
   started / paused / review / issued / pending-receive / dispatched / created); some stages (e.g. a sales order waiting
   for picking) use the confirmation time.
3. Counts are documents; a document's size (lines, quantities) differs, so departments and branches are not ranked.
4. The production-shortage state needs `purchasing.production_shortages.view` (Owner and Executive hold it); without
   it, approved orders show as awaiting reservation.
