# EP35 Report — Picking, Packing, Dispatch & Delivery Foundation

**Verdict: PASS.** Baseline `b743966` (EP34, equal to `origin/main` when EP35 started). Committed
locally as `feat: add CORE sales fulfillment foundation (EP35)`; **not pushed, not deployed**. EP36 not
started. Design: [SALES_FULFILLMENT.md](SALES_FULFILLMENT.md). Budget: [PERFORMANCE.md](PERFORMANCE.md).

## 1. What was built

| Area | Summary |
| --- | --- |
| Documents | `SalesPick` / `SalesPickLine` (`PICK-`), `SalesPack` / `SalesPackLine` (`PACK-`), `SalesShipment` / `SalesShipmentLine` (`SHP-`), append-only `SalesDeliveryEvent`; numbers from `DocumentSequence` (atomic, monthly, immutable) |
| Integrity | composite FKs chain every line to its company, branch, order, order line, reservation and stock identity; CHECKs planned ≥ picked ≥ packed ≥ dispatched ≥ 0, delivered ≤ dispatched, discrepancy on short picks, status ⇔ actor / time; triggers: no deletes, immutable delivery events, dispatched shipments / packs never go back, delivered stays delivered, shipment lines only gain delivered quantity |
| Picking | from ACTIVE reservations only (exact location + lot, no substitution); partial (several picks per order); claims never exceed a reservation (order-row lock + counters); discrepancies SHORT_PICKED / DAMAGED / MISSING / WRONG_ITEM / OTHER — the reservation is never touched; cancel returns the claim |
| Packing / shipments | packs of picked quantities (no over-packing), several packs and shipments per order, packs grouped into a READY shipment (ship-to defaults to the order's customer name); cancel before dispatch frees everything |
| **Dispatch** | **the only stock write**: order → shipment → location (shared; counts refuse) → balances → reservations locked; exact reservation CONSUMED (split on partial dispatch, history kept) then `SALES_ISSUE` through `applyMovement()` with its guard intact; once only (state + unique keys) |
| Delivery | deliver all / per line (DELIVERED, or DELIVERY_EXCEPTION with the rest outstanding), exceptions (6 reasons) — evidence only, never stock, reservations or Sales totals |
| Sales | per-line `progress` (allocated / picked / packed / dispatched / delivered cumulative; toDispatch / toDeliver outstanding; null for services), `fulfilment.state` + shipments; cancel refused after dispatch (`SO_ALREADY_DISPATCHED`) or while work is staged (`FULFILMENT_IN_PROGRESS`); release / reallocate likewise; allocate counts consumed stock |
| Permissions | `warehouse.picking.process` (OPERATE), `warehouse.dispatch.confirm`, `warehouse.delivery.confirm` (MANAGE); override CHECK 65 |
| UI | lazy `FulfilmentArea` (picks / packs / shipments lists and pages, confirm-pick, pack, ship, dispatch, deliver, exception), Pending Pick "Create pick" / "To pick", nav + tiles, SALES_ISSUE label + shipment link, Sales fulfilment block; TH / EN / ZH |
| Audit | 12 `SALES_PICK_* / SALES_PACK_* / SALES_SHIPMENT_*` actions on the three new entity types (redacted on the Platform explorer) — numbers and counts only |
| Demo | ready-to-pick, partially picked, packed, partially dispatched with a delivered shipment, and a delivery exception — through the real service; `warehouse.demo` stays Staff; second seed changes nothing |

Fixes made while building / QA-ing (this session):

- Document confirmations (EP32 screens and EP35) dropped keyboard focus when the box closed — focus now
  returns to the document title (also on Escape).
- Document-number links in Warehouse lists and the movement ledger were 22 px tall at ≥ 768 px (EP32
  styling, inherited by the EP35 lists) — now ≥ 28 px.
- The EP33 / EP34 Sales copy still said "picking and delivery arrive later" and "on hand changes at
  delivery" — now accurate (stock leaves at dispatch).

## 2. Gates

| Gate | Result |
| --- | --- |
| Prisma validate · migrate diff (migrated DB vs schema) | valid · no difference |
| Backend typecheck · lint · format · build | pass · 0 problems · clean · pass |
| Backend tests | **28 files, 433 tests passed** (EP34: 27 / 417) (new `sales-fulfilment.test.ts`: 15; demo seed: +1) |
| Frontend typecheck · lint · format | pass · 0 problems · clean |
| Frontend tests | **55 files, 1,089 tests passed** (EP34: 54 / 1,080) (new `fulfilment.test.tsx`: 9) — run with `--maxWorkers=2` (see EP34 note) |
| Build · prerender · verify-prerender · perf | pass · 108 pages + 3 shells · pass · within budget |
| Real-stack E2E (`qa-ep35`, fresh scratch DB, ports 2111 / 2112) | **100 / 100**, no server errors |
| UI QA — in-app browser · headless Edge 156 · headless Chrome 156 | **108 / 108 each** (9 screens × 390 / 768 / 1440 / 1920 px × TH / EN / ZH): no horizontal overflow, one h1, labelled controls, targets ≥ 24 px, no duplicate ids, no money on Warehouse screens, 0 JS errors; Create pick → confirm short (refusal in Thai, then discrepancy) → pack → ship → keyboard dispatch driven through the UI |
| Upgrade EP34 → EP35 | migration changed **no data** in the 52 EP34 tables (+7 tables, +5 nullable columns), no drift; EP35 seed added 4 orders and their fulfilment and left every EP34 audit / order / line / movement row byte-identical (only the demo stock balances the dispatches drew down changed); second seed a no-op (pre-existing `MasterCodeSequence` bump); ledger, reservation and issue/consumption invariants 0 |
| Secret scan (EP35 diff + new files) | clean |

**E2E coverage (100):** demo states and persona authority; the full 14-step fulfilment (FEFO pick lines,
no movement through pick / pack / ship, staff dispatch 403, manager dispatch, SALES_ISSUE per line with
exact lots, on hand −8, reservation 8 CONSUMED / 0 ACTIVE, on hand / reserved / available, delivery with
evidence, Sales progress DELIVERED, no second issue, cancel refused, movement linked); partial 100 →
40 + 60 (split reservation, outstanding 60, partial delivery → exception → delivered, exactly 100 issued).

**Races (concurrent HTTP, 3 rounds each unless noted):** A triple dispatch → one issue, one consumption;
B two claims of 7 on 10 → one wins, 7 claimed; J two shipments (7 + 3) dispatched twice each at once →
exactly 10 issued; C dispatch vs release, D vs reallocate, H vs order cancel → dispatch issues once, the
other is refused, order stays CONFIRMED; E dispatch vs a transfer of 8 (drafted while free) → transfer
refused either way, no negative; F dispatch vs damage approval → never eats reserved stock; G dispatch vs
cycle-count start → issue before the snapshot or `COUNT_IN_PROGRESS`, deterministic; I triple delivery →
one terminal transition, one event. No 500 in any round; reserved ≤ on hand after every round.

**Privacy / IDOR:** every Warehouse fulfilment response (lists, details, Pending Pick, movements,
context) has no money key, no price value (a distinctive 777.77 unit price never appears) and no
customer code or tax id; other-branch documents and orders 404; Warehouse Staff, Executive, Sales,
System Admin, Purchasing, Accounting, Staff, Operations cannot dispatch; Executive reads but cannot
create; System Admin and Sales cannot read Warehouse fulfilment; staff cannot confirm delivery; mass
assignment (status, number, quantity, lot) 400; unknown ids 404; anonymous 401; audit without money.

**Ledger reconciliation (QA DB after the whole run):** balance = Σ movements for every identity, none
negative, reserved ≤ on hand, every SALES_ISSUE matched by a CONSUMED reservation of the same quantity
and vice versa, issued exactly for dispatched shipment lines, pick-line counters equal their packs and
dispatched shipments, no ACTIVE reservation on a non-CONFIRMED order, nothing delivered beyond dispatched.

**Regression:** every earlier backend suite (EP23–EP34: auth, platform, company, permissions, master
data, PR, PO / deposit, receiving / lots / FEFO, transfer / adjustment / count, sales orders, allocation)
and every frontend suite (public site, auth, CORE) pass. Contract updates made on purpose: 65 override
codes, Pending Pick `toPick`, the new `progress` shape, demo counts (10 orders, 2 SALES_ISSUE), the
Warehouse nav. The demo allocation-row test now sorts deterministically (rows of one allocation share a
timestamp — it could order them differently between runs).

## 3. Performance

| Measure | Value |
| --- | --- |
| Initial JS (gzip) | 182.6 / 205 KiB (unchanged) |
| Static HTML | 528 / 560 KiB (unchanged) |
| All JS (raw) | **4,252.8 / 4,300 KiB** (EP34: 4,212.7; **+40.1 KiB**) |
| EP35 chunk | `FulfilmentArea` 23.8 KiB raw / 7.4 KiB gzip (shares `ctlParts`, now 34.2 KiB) |
| Headroom | ≈ 47 KiB |

No cap was raised; no dependency added (the Edge / Chrome QA used Node's built-in WebSocket).

## 4. Known limitations (deliberate)

- No returns / RMA, credit notes, invoicing, COGS, carrier APIs, labels, GPS, routes or scanners.
- No lot / location substitution while picking (release / reallocate after unwinding is the path); a
  discrepancy does not correct stock — an adjustment or count does.
- A shipment belongs to one order (an order may have many shipments); delivery evidence is text (no
  attachment service yet); delivery is confirmed internally by a Warehouse manager (trust model in
  SALES_FULFILLMENT.md §8).
- Undelivered / lost quantities stay outstanding exceptions; a partially dispatched order stays
  CONFIRMED (no short-close); service lines have no physical fulfilment.
- Firefox and axe are not available on this machine (Chromium, Edge and Chrome were checked).
