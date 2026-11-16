# EP47 — Dashboard Metric Definitions (the contract)

**Status:** implemented in EP47 (development). Code: `backend/src/dashboards/service.ts` (projections),
`backend/src/dashboards/view.ts` (strict response allow-list), `frontend/src/features/dashboards/` (one generic,
data-driven view). Tests: `backend/test/ep47-dashboards.test.ts`, `frontend/src/features/dashboards/dashboards.test.tsx`.

## 1. Rules that apply to every number and row

| Aspect                | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source**            | The canonical document tables only (`SalesOrder`, `PurchaseRequest`, `PurchaseOrder`, `GoodsReceipt`, `InventoryTransfer`, `StockAdjustment`, `CycleCount`, `SalesPick` / `SalesPack` / `SalesShipment`, `StockBalance` + `InventoryLot`, `ProductionOrder`, `ProductionMaterialIssue`, `ProductionOutputReport`, `ProductionGoodsReceipt`) and their line / allocation / receipt tables. Nothing is stored, cached or pre-aggregated; no second state machine exists — every "stage" below is derived from the documents' own statuses and posted quantities, with the same rules the module services use. |
| **Company scope**     | The session's company (`requireOperationsContext`). The request names no company; any query parameter is refused (`400`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Branch scope**      | The session's **selected** branch only (validated: active, in the member's branch access; a stale selection is cleared and refused). Another branch never contributes to a count or a row.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Department access** | `GET /api/v1/dashboards/:department` needs `<department>.workspace.view` (EP45: a regular member holds it only in their ONE department; Executive READ in every enabled department; Owner every department; System Admin none) → otherwise `403 PERMISSION_DENIED`. Each metric / queue additionally needs the permission of the screen it summarizes (column "Needs"); without it the metric is **left out** (not shown as 0, not counted).                                                                                                                                                                |
| **Money**             | No price, cost, discount, margin, tax or total is read into any projection. The only money field is the supplier-deposit `amount` on the **Accounting** dashboard (`accounting.deposits.view`).                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Recipes (EP46)**    | Production rows carry the order's item and planned / outstanding **output** quantity only — never a BOM line, ratio, material quantity or requirement. Material readiness is a **state count** (EP46 lists availability state as operational).                                                                                                                                                                                                                                                                                                                                                              |
| **Time ranges**       | "Recent" metrics: the last **7 company-calendar days including today** (company time zone); Accounting confirmations / waivers: **30 days**. Everything else is "open now" (no time window). "Overdue" = the document's own date (requested / needed-by / expected / deposit-due / required / count date) is **before today** in the company's time zone.                                                                                                                                                                                                                                                   |
| **Bounds**            | Every list is bounded (`take 500` per document type; aggregate SQL `LIMIT 2000`); work queues return at most **8** rows (`QUEUE_LIMIT`) plus the true `total`. Aggregation is done in PostgreSQL (`GROUP BY` + `LATERAL` sums) — no per-row queries (no N+1).                                                                                                                                                                                                                                                                                                                                               |
| **Refresh**           | Loaded when opened; re-loaded every **120 s while the tab is visible** (never while hidden), when the tab becomes visible again after **30 s**, on **Refresh**, and when another CORE request reports changed authorization (a 403 elsewhere). A refusal (401 / 403 / 404) **replaces** what was on screen; a network failure keeps the last result marked stale. The view is keyed by branch, so a branch change starts empty; an answer for another branch than the one on screen is discarded. API answers carry `Cache-Control: no-store` (EP46 platform rule). No WebSocket is used.                   |
| **Empty state**       | `0` means "no document in that state in this branch now". A metric that is **absent** means the person lacks its source permission. An empty queue says "No open work in this queue". A dashboard with neither metrics nor queues says the person's permissions do not cover its information.                                                                                                                                                                                                                                                                                                               |
| **Drill-down**        | Each metric links to the list screen behind it; each row links to its canonical document screen. A link is only a navigation — the target screen and API check permission again (test D13 opens every link each persona receives).                                                                                                                                                                                                                                                                                                                                                                          |
| **Actions**           | A row names the next step (`action`) and the department that owns it (`responsible`). `canAct` is `true` only when the person holds the effective permission for that step; the step is taken on the document screen (where EP41 independent approval and owner override apply unchanged). The dashboard has **no** mutation route.                                                                                                                                                                                                                                                                         |

## 2. Sales — `sales.workspace.view`; every metric needs `sales.orders.view`

Open CONFIRMED orders are placed in **exactly one** stage from their inventory-tracked lines, by one aggregate query
(allocated = ACTIVE + CONSUMED reservations; dispatched / delivered = shipment lines of DISPATCHED / DELIVERED /
DELIVERY_EXCEPTION shipments — the EP35 milestones):

`EXCEPTION` (an open DELIVERY_EXCEPTION shipment) → `ALLOCATION` (a line allocated < ordered) → `FULFILMENT` (fully
allocated, a line dispatched < ordered) → `DELIVERY` (all dispatched, a line delivered < ordered) → `COMPLETED` (all
delivered). Orders with no inventory-tracked line have no physical fulfilment and are not staged.

| Metric                 | Definition                                                                                                                | Tone      | Drill-down    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------- | ------------- |
| `newOrders`            | SUBMITTED or CONFIRMED orders with `orderDate` in the last 7 days                                                         | info      | `/core/sales` |
| `awaitingConfirmation` | status SUBMITTED (next: a Sales manager confirms)                                                                         | attention | `/core/sales` |
| `awaitingAllocation`   | stage ALLOCATION (next: Sales manager allocates)                                                                          | attention | `/core/sales` |
| `awaitingFulfilment`   | stage FULFILMENT (next: Warehouse picks / packs / dispatches)                                                             | progress  | `/core/sales` |
| `inDelivery`           | stage DELIVERY (next: Warehouse records delivery)                                                                         | progress  | `/core/sales` |
| `partiallyDelivered`   | open staged orders with some delivered quantity (**a subset** across stages, not a stage)                                 | progress  | `/core/sales` |
| `outstandingLines`     | Σ over open staged orders of tracked lines with delivered < ordered (lines, never quantities summed across items / units) | info      | `/core/sales` |
| `deliveryExceptions`   | stage EXCEPTION                                                                                                           | blocked   | `/core/sales` |
| `delayed`              | SUBMITTED + open staged orders whose `requestedDate` < today                                                              | blocked   | `/core/sales` |
| `completedRecently`    | stage COMPLETED with the last delivery in the last 7 days                                                                 | done      | `/core/sales` |
| `myDrafts`             | DRAFT orders created by this person                                                                                       | info      | `/core/sales` |

Queues: **work** (SUBMITTED + the four open stages, overdue first; `progress` = lines open / lines) and **completed**
(last 5 completed). Actions: `CONFIRM` / `ALLOCATE` (Sales, `sales.orders.approve`), `FULFIL`
(Warehouse, `warehouse.picking.process`), `CONFIRM_DELIVERY` / `RESOLVE_DELIVERY` (Warehouse,
`warehouse.delivery.confirm`). Sales sees the fulfilment **state** of its own orders without any Warehouse permission.

## 3. Purchasing — `purchasing.workspace.view`

| Metric                     | Needs                                  | Definition                                                                                                                                                    | Tone      | Drill-down                              |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------- |
| `requestsAwaitingDecision` | `purchasing.requests.view`             | PR status SUBMITTED                                                                                                                                           | attention | `/core/purchasing/requests`             |
| `requestsToOrder`          | `purchasing.requests.view`             | PR APPROVED with a line whose ordered quantity (ISSUED / WAITING_DEPOSIT / PENDING_RECEIVE / RECEIVED orders — EP30 rule; drafts reserve nothing) < requested | attention | same                                    |
| `ordersToIssue`            | `purchasing.orders.view`               | PO DRAFT                                                                                                                                                      | attention | `/core/purchasing/orders`               |
| `ordersWaitingDeposit`     | same                                   | PO WAITING_DEPOSIT (supplier-related waiting state; **no amount**)                                                                                            | progress  | same                                    |
| `ordersOpen`               | same                                   | PO PENDING_RECEIVE                                                                                                                                            | progress  | same                                    |
| `ordersPartiallyReceived`  | same                                   | PENDING_RECEIVE with posted receipt quantity and a line still open (EP31 rule: remaining = ordered − accepted − closed rejections)                            | progress  | same                                    |
| `outstandingLines`         | same                                   | Σ receivable lines still open on PENDING_RECEIVE orders                                                                                                       | info      | same                                    |
| `receiptsOverdue`          | same                                   | PENDING_RECEIVE with `expectedDate` < today                                                                                                                   | blocked   | same                                    |
| `productionShortages`      | `purchasing.production_shortages.view` | number of short material rows of the EP36 handoff (the screen keeps its own EP46-safe projection; the dashboard shows only the count)                         | blocked   | `/core/purchasing/production-shortages` |

Queues: **requests** (`DECIDE` — `purchasing.requests.approve`; `ORDER` — `purchasing.orders.create`) and **orders**
(`ISSUE` — `purchasing.orders.approve`; `DEPOSIT` — owned by Accounting, `accounting.deposits.confirm`; `RECEIVE` — owned
by Warehouse, `warehouse.receiving.process`). No Accounting write action is reachable from Purchasing.

## 4. Warehouse — `warehouse.workspace.view` (quantities and documents only)

| Metric                   | Needs                            | Definition                                                                                    | Tone      | Drill-down                        |
| ------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------- | --------- | --------------------------------- |
| `incomingOrders`         | `warehouse.receiving.view`       | PO PENDING_RECEIVE                                                                            | progress  | `/core/warehouse/pending-receive` |
| `incomingOverdue`        | same                             | … with `expectedDate` < today                                                                 | blocked   | same                              |
| `receiptsToPost`         | same                             | GoodsReceipt DRAFT                                                                            | attention | `/core/warehouse/receipts`        |
| `ordersToPick`           | `warehouse.inventory.view`       | CONFIRMED orders with an ACTIVE reservation not yet claimed by an open pick (EP35 claim rule) | attention | `/core/warehouse/pending-pick`    |
| `picksOpen`              | same                             | SalesPick DRAFT / IN_PROGRESS                                                                 | progress  | `/core/warehouse/picks`           |
| `packsOpen`              | same                             | SalesPack DRAFT                                                                               | progress  | `/core/warehouse/packs`           |
| `readyToDispatch`        | same                             | SalesShipment READY                                                                           | attention | `/core/warehouse/shipments`       |
| `inTransit`              | same                             | SalesShipment DISPATCHED                                                                      | progress  | same                              |
| `deliveryExceptions`     | same                             | SalesShipment DELIVERY_EXCEPTION                                                              | blocked   | same                              |
| `transfersOpen`          | same                             | InventoryTransfer DRAFT                                                                       | progress  | `/core/warehouse/transfers`       |
| `adjustmentsDraft`       | same                             | StockAdjustment DRAFT                                                                         | info      | `/core/warehouse/adjustments`     |
| `adjustmentsToApprove`   | same                             | StockAdjustment SUBMITTED                                                                     | attention | same                              |
| `countsOpen`             | same                             | CycleCount DRAFT / COUNTING                                                                   | progress  | `/core/warehouse/counts`          |
| `countsToReview`         | same                             | CycleCount REVIEW                                                                             | attention | same                              |
| `lotsExpiringSoon`       | same                             | distinct lots with on-hand > 0 expiring today … +30 days (`EXPIRING_SOON_DAYS`)               | attention | `/core/warehouse/lots`            |
| `lotsExpired`            | same                             | distinct lots with on-hand > 0 and expiry < today                                             | blocked   | same                              |
| `finishedGoodsToReceive` | `warehouse.finished_goods.view`  | ACCEPTED output reports of receivable orders with accepted > posted receipts (EP38 rule)      | attention | `/core/warehouse/finished-goods`  |
| `finishedGoodsDrafts`    | same                             | ProductionGoodsReceipt DRAFT                                                                  | progress  | same                              |
| `materialIssuesRecent`   | `warehouse.material_issues.view` | material issues POSTED in the last 7 days (read-only handoff)                                 | info      | `/core/warehouse/material-issues` |

Queue **work**: shipments (resolve / dispatch / deliver), packs, picks, adjustments to approve, counts, transfers,
goods receipts, pending-receive orders, finished-goods receipts — overdue first. Rows carry document number, status,
supplier name or adjustment reason, dates and line progress; **no money** (asserted by D2 / D14 and the EP45 A18
sweep over every GET route).

## 5. Production (Operations) — `operations.workspace.view`; every metric needs `operations.orders.view`

State counts come from `ProductionOrderService.context()` (the Production module's own canonical counts, including
material readiness); drafts follow the module's visibility (a draft is visible to its creator and to approvers).

| Metric                | Definition                                                                       | Tone      | Drill-down                      |
| --------------------- | -------------------------------------------------------------------------------- | --------- | ------------------------------- |
| `myDrafts`            | DRAFT orders created by this person                                              | info      | `/core/production/orders`       |
| `awaitingApproval`    | SUBMITTED                                                                        | attention | same                            |
| `awaitingReservation` | APPROVED (reserve materials, then release)                                       | attention | `/core/production/reservations` |
| `materialsShort`      | open orders whose material state is MATERIALS_SHORT (**a subset** across states) | blocked   | same                            |
| `readyToStart`        | READY (released)                                                                 | progress  | `/core/production/execution`    |
| `issuesToPost`        | ProductionMaterialIssue DRAFT                                                    | attention | `/core/production/issues`       |
| `inProduction`        | IN_PRODUCTION                                                                    | progress  | `/core/production/execution`    |
| `paused`              | PAUSED                                                                           | blocked   | same                            |
| `outputToReview`      | output reports SUBMITTED                                                         | attention | `/core/production/output`       |
| `completionReview`    | COMPLETION_REVIEW                                                                | attention | `/core/production/orders`       |
| `overdue`             | open orders (as listed) with `requiredDate` < today                              | blocked   | same                            |
| `completedRecently`   | COMPLETED with `completedAt` in the last 7 days                                  | done      | same                            |

Queue **work**: open orders, overdue first then PAUSED → SUBMITTED → COMPLETION_REVIEW → APPROVED → READY →
IN_PRODUCTION → own DRAFT; `quantity` = planned output − accepted output, in the order's unit. Actions: `SUBMIT`
(`operations.orders.create`), `APPROVE` (`operations.orders.approve`), `RESERVE` (`operations.materials.manage`),
`START` / `RESUME` (`operations.execution.manage`), `OUTPUT` (`operations.output.create`), `COMPLETE`
(`operations.orders.update_status`). The answer names the company's `manufacturingMode`; both modes are counted the
same way (tests W3 / W4).

## 6. Accounting — `accounting.workspace.view`; metrics need `accounting.deposits.view`

| Metric                | Definition                                             | Tone      | Drill-down                  |
| --------------------- | ------------------------------------------------------ | --------- | --------------------------- |
| `depositsPending`     | PO WAITING_DEPOSIT with depositStatus PENDING          | attention | `/core/accounting/deposits` |
| `depositsOverdue`     | … with `depositDueDate` < today                        | blocked   | same                        |
| `depositsConfirmed30` | depositStatus CONFIRMED, confirmed in the last 30 days | done      | same                        |
| `depositsWaived30`    | depositStatus WAIVED, waived in the last 30 days       | info      | same                        |

Queue **deposits**: PO number, supplier, due date, deposit amount + currency; `CONFIRM` (`accounting.deposits.confirm`).
The answer always carries the note `ACCOUNTING_SCOPE`: CORE Accounting covers supplier deposits only — no general
ledger, receivables, tax filing or bank reconciliation (and no PDA ONE integration in EP47).

## 7. Not in EP47

The cross-department Executive Command Center (EP48), targets / trends / charts (no meaningful trend data yet — no
chart was added), notifications, exports.
