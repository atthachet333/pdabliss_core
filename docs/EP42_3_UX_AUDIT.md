# EP42.3 — Cross-Department UX Audit (Phase 1, read-only)

**Baseline:** `029e76d` (EP42.2) on `main`, clean. **Data:** the owner's UAT data, read through a
disposable copy — `pdabliss_core_uat` was dumped (read-only `pg_dump`) and restored into
`pdabliss_core_uat_ep423`; the audit stack ran on `localhost:2111` / `localhost:2112` against that
copy. `pdabliss_core_uat` itself was never connected to by a server and never written: its 71-table
content hash was identical before the audit, after the first clone, and mid-episode (see the final
report, §7).

**Method.** Each persona signed in (owner, sales, purchasing, warehouse, operations, accounting,
executive), selected its branch and opened every list and one detail per document type. For each
screen: what is on screen, what the list API already returns (`GET` row shapes captured per persona),
what is missing, how many clicks it takes to know *what a document holds*, and width / overflow /
sidebar behaviour measured in the browser at 390, 768, 1024, 1280, 1440 and 1920 px (scripted DOM
measurements: page overflow, elements past the viewport outside scroll containers, visible columns,
row heights, hidden tabs).

## 1. The two owner-reported problems — confirmed

| # | Owner's observation | Audit finding |
| --- | --- | --- |
| 1 | Lists show identifiers without enough context; understanding a document needs repeated navigation | Confirmed. 9 of the 13 document lists showed only a **line count** for the document's contents. To learn *what* a sales order, purchase request, purchase order, pending receipt, goods receipt or pick holds took **1 click + page load + back** per document (2 navigations), and the list position was lost each time. Supplier names and PR purposes were cut to one truncated line. Nothing said which department a document was waiting on. |
| 2 | Content crowded in the centre; sidebar / desktop space underused | Confirmed. The CORE shell capped content at **100rem (1,600 px)**: at 1920 px the content column was 1,352 px with ~320 px of empty margin. Document pages (SO, PO, receipt, deposit) stacked every fact in **one narrow label/value column**, pushing the lines below the fold at 1280–1920 px. The sidebar listed only 5 of Warehouse's 14 sections, so Warehouse navigation lived in a 14-tab strip that **hid 5 tabs off-screen at 1024 px** (scrollbar hidden). On phones every list row became a card with each field on two lines (label above value): a sales order card was **490 px** tall — 14 orders = 8,066 px of scrolling. |

## 2. Screen-by-screen

Clicks = navigations needed to know what the document contains. "API" = fields the existing list
endpoint already returned for that persona (nothing assumed).

### Sales (sales.demo, owner; executive read-only)

| Screen / route | On screen (before) | List API already returned | Missing context | Clicks | Width / overflow | Permissions |
| --- | --- | --- | --- | --- | --- | --- |
| Sales orders `/core/sales` | number, status, customer, stock/allocation/fulfilment pill, total, requested date, creator, updated | customer, dates, `lineCount`, totals, availability, allocation, pick readiness, fulfilment state | **items and quantities** (not in API — `lineCount` only); who acts next | 2 | 1440: 8 cols fit; 390: 490 px cards; no page overflow | Sales staff see own + submitted; Executive submitted only (server) |
| Sales order `/core/sales/orders/:id` | header facts (one column), lines, allocation | full order | — | — | 1920: facts one column, lines below fold | edit/confirm per `actions` |

### Purchasing (purchasing.demo; requesters in other departments)

| Screen / route | On screen (before) | List API already returned | Missing context | Clicks | Width / overflow | Permissions |
| --- | --- | --- | --- | --- | --- | --- |
| Purchase requests `/core/purchasing/requests` | number + purpose (truncated to one line), status, department, branch, requester, dates, `lines` count | purpose, department, requester, dates, `lineCount` | **items/quantities** (not in API); next department | 2 | 390: 490 px cards | views: all / mine / department / queue (server) |
| Purchase orders `/core/purchasing/orders` | number + supplier (truncated), status (+deposit), branch, PRs, dates, total | supplier, totals, deposit, dates, `lineCount`, PRs | **items/quantities** (not in API); next department (Accounting deposit, Warehouse receive) | 2 | 1280–1535: PRs/updated hidden by EP42.1 to avoid overflow | Executive: summary view, no lines in detail API |
| Purchase order `/core/purchasing/orders/:id` | sections stacked; facts one column | full order | — | — | 1920: lines below fold | |
| Production shortages | item, quantities, MO, dates | item rows already | none | 0 | ok | |

### Warehouse (warehouse.demo) — privacy: operational fields only

| Screen / route | On screen (before) | List API already returned | Missing context | Clicks | Width / overflow | Permissions |
| --- | --- | --- | --- | --- | --- | --- |
| Pending receive `/core/warehouse/pending-receive` | number, supplier, branch, expected date, `lines` count | supplier, dates, receiving state, `lineCount` | **what is still to receive** (not in API) | 2 | 1024: 5 of 14 tabs off-screen | `warehouse.receiving.view`; no money (allow-list) |
| Goods receipts `/core/warehouse/receipts` | number + supplier (truncated), PO, status, branch, received at/by, `lines` | PO number, supplier, `lineCount` | **items/quantities** (not in API) | 2 | 1024: tabs hidden | |
| Picks `/core/warehouse/picks` | number, status, SO, created | SO ref, `lineCount` | **items/quantities** (not in API) | 2 | ok | `warehouse.inventory.view` |
| Packs / Shipments | number, status, SO, ship-to (shipments) | SO ref, ship-to, carrier | items (not in API) | 2 | ok | |
| Transfers / Adjustments / Counts | number, status, locations / reason / variance | locations, reason, counts | items (not in API) | 2 | ok | |
| Pending pick, Material issues, Finished goods | items, quantities, lots | lines already in API | none | 0 | ok | |
| Inventory / Lots / Movements | item rows | item rows | none | 0 | 768–1023: inventory uses its own `max-lg` card layout (≈470 px rows) — recorded, not changed | |

### Operations (operations.demo)

| Screen / route | On screen | List API | Missing | Clicks | Width | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Production orders `/core/production` | item, quantity, unit, BOM, dates, material/reservation state, linked SO | same | none — already the model the other lists lacked | 0 | ok | |
| Outputs / Issues | item, quantities / MO | same | issues list: items (not in API) | 1–2 | ok | |

### Accounting (accounting.demo, branch 00000)

| Screen / route | On screen | List API | Missing | Clicks | Width | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Supplier deposits `/core/accounting/deposits` | number + supplier (truncated), deposit status, branch, total, deposit, due date | supplier (+tax id), totals, deposit, `lineCount` | **what is being bought** (not in API) | 2 | ok | |

### Executive (executive.demo, read-only)

Same lists as the departments it may view (sales, purchase orders, production, receipts, deposits).
The purchase-order *detail* API gives the Executive a summary **without lines**, so a line preview
would be empty — any preview must be withheld there.

### Shell and sidebar (all personas)

| Width | Before |
| --- | --- |
| 390 / 768 / 1024 | no sidebar (drawer) — correct; no page overflow on any route |
| 1280 / 1440 | sidebar 15.5rem; Warehouse group: 5 entries of 14 sections |
| 1920 | content capped at 1,600 px (1,352 px column beside the sidebar) |

## 3. Not available in the API (and what EP42.3 did about it)

The only missing *data* was the contents summary (item, quantity, unit) on list rows; everything
else (names, dates, states, linked documents) was already returned and only needed better use. A
narrowly scoped, server-side, read-only projection `summary` was added to the rows of: sales orders,
purchase requests, purchase orders (Purchasing / Executive), Warehouse pending receive (quantity =
**still to receive**), Accounting deposits, goods receipts (accepted quantity) and picks (planned
quantity). It is computed under each endpoint's existing authorization and carries no price, amount,
total or note (verified by tests and on the clone). Transfers, adjustments, counts, packs, shipments
and production issues were left as they are (lower value; recorded in the bug register as IDEA).
