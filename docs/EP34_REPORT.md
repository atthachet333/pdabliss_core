# EP34 Report — Sales Allocation and Pick Readiness Foundation

**Verdict: PASS.** Baseline `e89a195` (EP33), resumed from WIP `0549f64`. Committed locally as
`feat: add CORE sales allocation and pick readiness foundation (EP34)`; **not pushed**. EP35 not started.

Design: [SALES_ALLOCATION.md](SALES_ALLOCATION.md). Ledger: [INVENTORY_LEDGER.md](INVENTORY_LEDGER.md) §8.
Budget history: [PERFORMANCE.md](PERFORMANCE.md) (EP34 entry).

## 1. What was built

| Area | Summary |
| --- | --- |
| Schema | `SalesAllocation` (ACTIVE / RELEASED / CONSUMED-reserved), release reasons `RELEASED` · `REALLOCATED` · `ORDER_CANCELLED`; company / branch / order / line composite FKs; one ACTIVE row per (line, location, lot) through a nullable `activeSlot` unique key; CHECKs for quantity, `lotKey` and release fields; a trigger refuses deletes. Migration `20261106090000_ep34_sales_allocation` is purely additive |
| Reservation math | `warehouse/reservations.ts`: reserved = Σ ACTIVE rows, available = on hand − reserved; balance **row locks** serialize allocations and decreases so reserved ≤ on hand always holds |
| Ledger guard | every decrease in `applyMovement()` (transfers, adjustment decreases, count corrections, all reversals) refuses to take reserved stock (`409 STOCK_RESERVED`); transfers and adjustments also check at draft time; FEFO availability subtracts reservations |
| Sales actions | `POST /orders/:id/allocate` · `/release` · `/reallocate` (CONFIRMED, `sales.orders.approve`, no body — 400 if a client names anything); FEFO within the order's branch, repeatable without double-reserving; cancellation releases every reservation in the same transaction; deadlock / serialization aborts answer `409 CONCURRENT_UPDATE` |
| Read models | orders carry `allocationState` / `pickReadiness`; tracked lines `allocation` and `progress.allocated`; Warehouse `/stock` adds `quantityReserved` / `quantityAvailable`; **Pending Pick** `GET /warehouse/pending-pick` (read-only, allow-listed: no customer, price, tax, total, note or reference) and a `pendingPick` count |
| Audit | `SALES_ALLOCATION_CREATED` / `_RELEASED` / `_REALLOCATED`, `SALES_ORDER_FULLY_ALLOCATED` / `_PARTIALLY_ALLOCATED` — number and counts only |
| UI | lazy `AllocationSection` on confirmed orders (states, shortage, per line ordered / reserved / short, Allocate · Allocate again · Release confirmed in place); lazy `PendingPickArea` at `/core/warehouse/pending-pick`; inventory on hand / reserved / available; pickers list available stock; TH / EN / ZH |
| Demo | `SO_CONFIRMED` allocated → READY; new `SO_ALLOC_PARTIAL` (two FEFO lots + a short raw-material line) → PARTIALLY_ALLOCATED; new `SO_OPEN` left unallocated; second seed is a no-op |

Fixes made while resuming (this session):

- The Sales availability note still said stock shown was "not a reservation — other orders may see the
  same stock", now false on orders with reservations. Reworded in TH / EN / ZH: available = on hand −
  reserved for confirmed orders; only allocation holds stock.
- Inventory at 768 px overflowed the page sideways (eight columns), and its row links were 22 px tall
  (EN) or squeezed to 15 px wide with stacked characters (ZH). Rows are now labelled cards below 1024 px;
  row links are ≥ 24 px and never wrap.
- After confirming Allocate / Release, keyboard focus fell to `<body>` (the confirm box unmounts with the
  focused button). Focus now returns to the allocation section, as EP33 does for its own actions.
- The local Prisma client was stale after the WIP checkout (`prisma generate`; generated code is not
  committed).

## 2. Gates

| Gate | Result |
| --- | --- |
| Prisma validate · migrate diff (migrated DB vs schema) | valid · no difference |
| Backend typecheck · lint · format · build | pass · 0 problems · clean · pass |
| Backend tests | **27 files, 417 tests passed** (new `sales-allocation.test.ts`: 15) |
| Frontend typecheck · lint · format | pass · 0 problems · clean |
| Frontend tests | **54 files, 1,080 tests passed** (new `allocation.test.tsx`: 6) — see note |
| Build · prerender · verify-prerender · perf | pass · 108 pages + 3 shells · pass · within budget |
| Real-stack E2E (`qa-ep34`, fresh scratch DB, ports 2111 / 2112) | **98 / 98**, no server errors |
| UI QA (in-app browser, 4 widths × TH / EN / ZH × 4 screens) | **48 / 48** after the fixes above (first pass found the 768 px inventory issues); no horizontal overflow, one h1, labelled controls, targets ≥ 24 px, no duplicate ids, 0 JS errors; allocate → release driven through the UI with keyboard |
| Upgrade EP33 → EP34 | migration changed **none** of the 51 EP33 tables (counts + md5) and added only `SalesAllocation`; no schema drift; the EP34 seed added 2 orders / 3 lines / 6 reservations / 10 audit rows and left every earlier AuditLog, SalesOrder, SalesOrderLine, StockBalance and StockMovement row byte-identical; second seed a no-op (`MasterCodeSequence.updatedAt` bump is pre-existing since EP28); reserved ≤ on hand |
| Secret scan (EP34 diff + new files) | clean — no `.env` value, key, token, connection string, session cookie or scratch path |

E2E coverage: demo states and pick readiness; on hand / reserved / available on every stock row;
persona capabilities (owner allocates; Sales staff, Staff, Executive refused; Warehouse, System Admin,
Purchasing, Accounting 403 on Sales); FEFO across lots and locations, other branch never used; **no
movement and no balance change** from allocate / release / reallocate / cancel; repeat allocate never
double-reserves; client-chosen quantity / location / lot / status → 400; DRAFT / SUBMITTED / CANCELLED
refused; partial allocation keeps the shortage; release keeps RELEASED history; reallocate moves to the
newest FEFO-first lot; cancel releases (`ORDER_CANCELLED`); transfer and adjustment of reserved stock
refused (`STOCK_RESERVED`, no order number in the error) while free stock still moves; timeline and
audit without money.

**Races (HTTP, concurrent requests on the real stack):** same lot, 2 orders × 7 from 10, 3 rounds → Σ
reserved = 10; two lots of 5, 2 orders × 6, 3 rounds → Σ = 10, no lot over-reserved; one order allocated
three times at once → reserved once, one ACTIVE row, one event; allocate vs transfer post, 3 rounds; allocate
vs adjustment approval, 3 rounds; allocate vs order cancel, 3 rounds → always CANCELLED with nothing
reserved. Every outcome was one of the coherent orderings (the loser gets `STOCK_RESERVED`, a partial
allocation, or `409`), never a 500, and reserved ≤ on hand held for every balance after every round.

**Privacy / IDOR:** Pending Pick for the Warehouse persona carries no money, customer, note or reference
key and no customer code; only CONFIRMED orders with ACTIVE reservations; another branch's filter returns
nothing; Sales / Purchasing / Accounting / System Admin 403; anonymous 401; Warehouse stock and the
movement ledger show no order numbers or reservation entries; unknown ids 404; the Head Office sales
persona cannot see or act on branch 00001 orders; Executive and Warehouse cannot release, reallocate or
cancel — reservations unchanged afterwards.

**Ledger reconciliation (QA DB after the whole run):** Σ movements = on hand for every balance, no
movement identity without a balance, no reservation-type movement, one ACTIVE row per (line, location,
lot), no line reserved beyond its quantity, every reservation in its order's branch, no ACTIVE
reservation on a non-CONFIRMED order.

**Note on frontend test stability.** Default full runs timed out once each on three different
pre-existing tests (`company-center … for the owner`, `auth … invitation acceptance`, and on the committed
EP33 tree `platform … speaks English and Chinese`), each the first, CPU-heavy render in its file; each
passes in well under a second alone. The committed EP33 frontend shows the same timeout in a full run, so
it is load, not EP34 (EP32 recorded the same). The final full run with `--maxWorkers=2` (no config change)
was green.

## 3. Performance

| Measure | Value |
| --- | --- |
| Initial JS (gzip) | 182.6 / 205 KiB (unchanged) |
| Static HTML | 528 / 560 KiB (unchanged) |
| All JS (raw) | **4,212.7 / 4,300 KiB** (EP33: 4,195.6; **+17.1 KiB**) |
| EP34 chunks (raw / gzip) | AllocationSection 3.2 / 1.3 · PendingPickArea 6.5 / 2.6 KiB; SalesArea 36.3 → 43.1 KiB; InventoryArea 5.7 KiB |
| Headroom | ≈ 87 KiB |

No cap was raised.

## 4. Known limitations (deliberate)

- Whole-order allocation only: no per-line allocation and no manual choice of lot or location.
- No automatic allocation on confirm, no re-allocation when stock arrives, no priority between orders
  (first to allocate wins), no reservation expiry.
- No picking, packing, delivery or consumption of reservations (EP35); `CONSUMED` is defined, unused.
- Pending Pick lists orders with something reserved; an unallocated confirmed order is visible in Sales
  (shortage filter) only.
- A reserved lot that expires later stays reserved until released or reallocated (Pending Pick shows its
  expiry state).
- Unchanged from EP33: base unit only, THB, exclusive tax, no partial cancellation; Firefox / axe not
  available on this machine (accessibility checks were scripted in the in-app browser).
