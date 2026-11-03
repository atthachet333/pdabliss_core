# EP33 Report — Bundle Recovery + Sales Order Foundation

**Verdict: PASS.** Baseline `ea7e33e` (EP32), resumed from WIP `ec4ddea`. Committed locally as
`feat: add CORE sales order foundation (EP33)`; **not pushed**. EP34 not started.

Design: [SALES_ORDER.md](SALES_ORDER.md). Budget history: [PERFORMANCE.md](PERFORMANCE.md) (EP33 entry).

## 1. What was built

| Area | Summary |
| --- | --- |
| Phase 0 — JS recovery | 4,298.2 → 4,158.7 KiB (**≈ 139.5 KiB recovered**) before any Sales code: `react-hook-form`, `@hookform/resolvers` and `zod` removed from the frontend (the sign-in gateway no longer ships them; email shape check in `lib/email.ts`); homepage previews import a small `workspaces/identity.ts` instead of the prototype registry. Parity tests (`identity.test.ts`, `email.test.ts`) pass |
| Schema | `SalesOrderStatus`, `SalesOrder`, `SalesOrderLine`; company-bound composite FKs; line ↔ order ↔ branch key; CHECKs for number format, step records, dates, totals, line arithmetic and unit precision. Migration `20261105090000_ep33_sales_order` is purely additive |
| Policy | One table (`sales/policy.ts`), EP27 codes only: creator edits / submits / discards own DRAFT; `sales.orders.approve` confirms; `sales.orders.cancel` cancels SUBMITTED / CONFIRMED with a reason. Drafts visible to their creator and confirmers only; hidden = 404 |
| Service / API | `/api/v1/sales`: context + counts, item search with branch availability, list (status, branch, customer, shortage, dates, search, paging), create, header PATCH, lines PUT, submit, confirm, cancel. Strict input (server-owned fields → 400); every write locks the order row; snapshots refreshed at submit and confirm, frozen after |
| Money | EP30 arithmetic, half-up per line, exclusive tax; client never sends totals |
| Availability | Read-only from balances (`sales/availability.ts`) = FEFO candidate set (tested equal); per-line consumption within an order; AVAILABLE / PARTIALLY_AVAILABLE / UNAVAILABLE / NOT_STOCK_TRACKED; shortage filter and count over open orders. **Never a reservation, never a stock write** |
| Privacy / audit | Sales allow-lists (selling terms; no cost / margin / supplier key anywhere); Warehouse 403 on every Sales endpoint; audit details without prices, totals, notes or reasons; Platform explorer redacts `SalesOrder` events |
| Fulfilment contract | `progress.ordered` per line; `allocated` / `picked` / `delivered` / `outstanding` null until EP34 / EP35; allocation FK target on the line |
| UI | Lazy `SalesArea` at `/core/sales/*`: count tiles (URL filters), list with search / status / shortage, new order, draft header + line editor (unit-precision checks), read-only lines with amounts and availability, confirm / cancel in place (reason required once submitted), timeline; TH / EN / ZH; CORE home links the Sales card |
| Demo | `SO_DRAFT`, `SO_SUBMITTED` (HO, no stock → UNAVAILABLE), `SO_CONFIRMED` (00001, AVAILABLE), `SO_CANCELLED`; `sales.demo` stays Staff, `owner.demo` confirms / cancels; created once each |

Fixes made while resuming: the order / requested date accepted impossible days (`2026-02-30` rolled
over to 2 March) — the Sales schema now uses the strict EP31 `dayValue`; list filters replaced the
whole query string and dropped the router state (the page fell back to Thai) — they now keep other
parameters and the language; order-number links were 23 px tall at ≥ 768 px — now ≥ 24 px.

## 2. Gates

| Gate | Result |
| --- | --- |
| Prisma validate · migrate diff (migrated DB vs schema) | valid · no difference |
| Backend typecheck · lint · format · build | pass · 0 problems · clean · pass |
| Backend tests | **26 files, 402 tests passed** (new `sales-orders.test.ts`: 16; demo seed test: 1) |
| Frontend typecheck · lint · format | pass · 0 problems · clean |
| Frontend tests | **53 files, 1,074 tests passed** (new `sales.test.tsx`: 7) |
| Build · prerender · verify-prerender · perf | pass · 108 pages + 3 shells · pass · within budget |
| Real-stack E2E (`qa-ep33`, fresh scratch DB, ports 2111 / 2112) | **58 / 58** |
| UI QA (in-app browser, 4 widths × TH / EN / ZH × 4 screens) | **48 / 48**, no horizontal overflow, labelled controls, one h1, 0 JS errors; a full draft → lines → submit flow driven through the UI |
| Upgrade EP32 → EP33 | 49 EP32 tables unchanged (counts + md5; audit log / document sequences append-only, 87 / 87 earlier audit rows kept; `MasterCodeSequence` values unchanged — its `updatedAt` is bumped by every EP28 seed run, pre-existing); EP33 seed created 4 orders, then idempotent |

E2E coverage: persona capabilities and counts; demo states and availability; server numbering and
money; 400 for client totals / status; unit precision; submit / confirm / edit refusals; **double
confirm race (one 200, one 409)**; **6 concurrent creates (unique, consecutive)**; **submit vs discard
race (one outcome, one event)**; cancel needs a reason; timeline; shortage filter; **IDOR** (other
branch, another member's draft, PATCH / PUT / submit / cancel on hidden ids, unknown id, another
branch's items); executive read-only; Warehouse / Accounting / Purchasing / System Admin 403;
Warehouse ledger free of sales numbers and prices; audit without amounts; **no stock movement or
balance changed by any EP33 step**; Platform redaction.

## 3. Performance

| Measure | Value |
| --- | --- |
| Initial JS (gzip) | 182.6 / 205 KiB (unchanged) |
| Static HTML | 528 / 560 KiB (unchanged) |
| All JS (raw) | **4,195.6 / 4,300 KiB** (EP32: 4,298.2; Phase 0: 4,158.7; Sales: **+36.9 KiB**) |
| EP33 chunk | `SalesArea` 36.3 KiB raw / 11.3 KiB gzip (own copy; shares `whModel` 0.7 KiB) |
| Headroom | ≈ 104 KiB |

No cap was raised.

## 4. Known limitations (deliberate)

- No allocation, picking, delivery or completion (EP34 / EP35); availability is information only.
- No price lists, customer prices, credit limits, multi-currency or inclusive tax; base unit only.
- A confirmed order changes only by cancellation (no partial cancel, no line status).
- A manager cannot discard another member's draft (only its creator can).
- The list shows the selected-branch counts; members with several branches see every branch's
  orders in the list (filterable by `branchId` in the API, not yet in the UI).
- Firefox / axe are still not available on this machine; accessibility checks were scripted in the
  in-app browser (labels, names, headings, target size, overflow, duplicate ids).
