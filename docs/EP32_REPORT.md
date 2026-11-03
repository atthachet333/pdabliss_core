# EP32 Report — Inventory Transfer, Stock Adjustment, Cycle Count Foundation

**Verdict: PASS.** Baseline `85130dc` (EP31). Committed locally as
`feat: add CORE inventory control foundation (EP32)`; **not pushed**. EP33 not started.

Design: [INVENTORY_TRANSFER.md](INVENTORY_TRANSFER.md), [STOCK_ADJUSTMENT.md](STOCK_ADJUSTMENT.md),
[CYCLE_COUNT.md](CYCLE_COUNT.md), ledger changes in [INVENTORY_LEDGER.md](INVENTORY_LEDGER.md) §2 and §7.

## 1. What was built

| Area | Summary |
| --- | --- |
| Ledger | `applyMovement()` is the single stock writer (receipts, transfers, adjustments, counts): shared per-location advisory locks (sorted), cycle-count scope check, ACTIVE check on increases, upsert / conditional decrement, immutable movement. 9 new movement types; `StockMovement_check` restated per family (sign, `sourceType`, required source ids); unique `(line, type)` per family |
| Transfers | `InventoryTransfer` / lines, `TR-YYYYMM-NNNNNN`, DRAFT → POSTED → CANCELLED (reversal), same branch only, lot preserved, paired `TRANSFER_OUT` / `TRANSFER_IN`, reversal refused when the destination is short |
| Adjustments | `StockAdjustment` / lines, `ADJ-…`, DRAFT → SUBMITTED → POSTED / REJECTED, cancel before posting, reversal after; 8 reasons with direction rules; explicit INCREASE / DECREASE; new lots on increases where the reason allows; approval = posting |
| Cycle counts | `CycleCount` / locations / lines, `CC-…`, DRAFT → COUNTING ⇄ REVIEW → POSTED, cancel before posting; snapshot under exclusive location locks; scope lock (`COUNT_IN_PROGRESS`); 0 counts; found stock; `COUNT_STALE`; signed `COUNT_CORRECTION` |
| EP31 debt | A location cannot be deactivated with stock (`LOCATION_HAS_STOCK`) or while a draft transfer, draft / submitted adjustment, draft receipt allocation or open count names it (`LOCATION_IN_USE`) |
| Permissions | 5 new codes (`warehouse.transfers.create/.approve/.cancel`, `warehouse.counts.create/.approve`); adjustments use the EP27 `warehouse.stock_adjustment.create/.approve`; override CHECK 62 codes |
| UI | Lazy `TransfersArea`, `AdjustmentsArea`, `CountsArea` + shared `ctlParts`; nav, tiles, inventory row actions, movement labels and document links; TH / EN / ZH |
| Demo | 1 posted + 1 draft transfer, DAMAGE (−) and FOUND (+) posted adjustments, 1 posted count (one −1 correction) — drafted by `warehouse.demo` (still Staff), posted / approved by `owner.demo` |

## 2. Gates

| Gate | Result |
| --- | --- |
| Prisma validate · migrate diff (fresh DB) | valid · exit 0 (no drift) |
| Backend typecheck · lint · format · build | pass · 0 problems · clean · pass |
| Backend tests | **25 files, 385 tests passed** (new `inventory-control.test.ts`: 20) |
| Frontend typecheck · lint · format | pass · 0 problems · clean |
| Frontend tests | **50 files, 1,064 tests passed** (new `inventoryControl.test.tsx`: 7) |
| Build · prerender · verify-prerender · perf | pass · 108 pages + 3 shells · pass · within budget |
| Real-stack E2E (`qa-ep32` + extra) | **51 / 51** (43 + 8) |
| UI QA (headless, 4 widths × TH/EN/ZH) | **Edge 156: 100 / 100 · Chrome 156: 100 / 100**, 0 JS errors; Firefox not installed |
| Upgrade EP31 → EP32 | 19 tables byte-identical (counts + md5); EP32 seed idempotent; ledger = balances |
| Ledger reconciliation (QA DB, 86 movements) | 0 mismatches, 0 negative, 0 unbalanced transfer pairs, 0 counts left open |

**Note on frontend test stability.** While developing, two different pre-existing tests timed out once each
under load (`company-center … for the owner`, `auth register step 1`). The same timeout reproduces on the
committed EP31 frontend (1 of 3 runs), so it is not EP32; the final full run was green.

## 3. Performance

| Measure | Value |
| --- | --- |
| Initial JS (gzip) | 182.6 / 205 KiB (unchanged) |
| `/login` (gzip) | 64.5 / 72 KiB (unchanged) |
| Static HTML | 528 / 560 KiB |
| All JS (raw) | **4,298.2 / 4,300 KiB** (EP31: 4,251.9; **+46.3 KiB**) |
| EP32 chunks (raw / gzip) | TransfersArea 3.6 / 1.5 · AdjustmentsArea 5.3 / 2.0 · CountsArea 7.7 / 2.8 · ctlParts 25.8 / 9.0 KiB |
| Headroom | ≈ 1.8 KiB |

No cap was raised. A first version measured 4,309 KiB; it was brought under by sharing one document page
/ new-document form / line editor across the three screens, reusing EP31 copy keys, shorter confirmations,
suffix-based timeline labels and dropping five error messages for cases the UI already prevents. The
next Warehouse screens need JS recovered first (or an owner budget decision) — recorded in PERFORMANCE.md.

## 4. Known limitations (deliberate)

- Transfers are same-branch only (no in-transit stock).
- An adjustment or count corrects quantity only — no valuation (Accounting later).
- A posted count is final; corrections after it are adjustments or a new count.
- While a count is open its whole scope (or its item) is frozen; there is no per-bin "freeze while counting a
  subset" or blind-count mode.
- `COUNT_STALE` cannot be reached through the API (the scope lock prevents it); it guards any write that
  bypasses the ledger and is forced in tests.
- List screens offer status / search (+ reason for adjustments); the API also filters by location and date,
  and movements by source type and date — not all are exposed in the UI yet.
- Five rare refusals (`CROSS_BRANCH`, `ITEM_NOT_STOCKED`, `OUT_OF_SCOPE`, `NEW_LOT_NOT_ALLOWED`,
  `BRANCH_SELECTION_REQUIRED`) show the generic error text on EP32 screens; the UI does not offer those
  inputs.
- Unchanged from EP31: no unit conversion, no over-delivery tolerance, fixed 30-day expiry warning,
  no service / non-stock receiving, Firefox / axe not available on this machine.
