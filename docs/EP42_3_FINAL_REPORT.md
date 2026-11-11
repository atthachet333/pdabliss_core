# EP42.3 — Cross-Department Information Density & Workspace UX Refinement — Final Report

**Baseline:** `029e76d` (EP42.2) on `main`, clean (verified). **Result:** one local commit. Not
pushed, not deployed. EP42.4 not started.

**Verdict: PASS.** Both owner-reported problems are addressed and every required gate passed.
**Human UAT: still NOT STARTED** — no owner case is marked; the checks below are the agent's, not
human acceptance. The owner's two observations are recorded as UAT-BUG-001 / 002, *FIXED (EP42.3) —
awaiting owner verification* via the new test-plan cases UX-01…UX-11.

Audit (Phase 1): [EP42_3_UX_AUDIT.md](EP42_3_UX_AUDIT.md).

## 1. What changed

### Document context (Phase 2)

| Change | Where | Notes |
| --- | --- | --- |
| **Row item summary** — first item (code, name), quantity, unit, "+N more" | Sales orders, Purchase requests, Purchase orders, Warehouse pending receive (*still to receive*), Accounting deposits, Goods receipts, Picks | New read-only projection `summary` on those list endpoints (`backend/src/lib/line-summary.ts`). Computed inside each endpoint's existing authorization; first line only (`take: 1`) where lines were not already loaded. Keys: `code, name, quantity, unit, more` — no price, amount, total or note. Added to the Warehouse / inventory / fulfilment field allow-lists. |
| **Next responsible department** ("→ Warehouse") under the status | Sales orders, Purchase requests, Purchase orders | Derived from the state with the same transitions the server enforces: SO draft/submitted → Sales, confirmed with nothing reserved → Sales (manager allocates), reserved and not delivered → Warehouse; PR draft/submitted → its department, approved → Purchasing; PO draft → Purchasing, waiting deposit → Accounting, pending receive → Warehouse. Presentation only (bug register K-17). |
| **Names in full** | PO / deposit supplier, PR purpose, GR supplier | Wrap (two lines for a purpose) instead of a one-line cut-off. |
| Secondary columns move to wide screens | Sales (created by, updated), PR (requester, request date), PO / deposits / GR (branch code, received by) | Shown from 1536 px (branch from 1280 px); still on the document page. |

### Workspace layout (Phase 3)

| Change | Effect (measured on the UAT clone) |
| --- | --- |
| CORE shell cap 100rem → **120rem** | 1920 px: content column 1,352 → **1,658 px**; no overflow at any width. |
| `Facts` become **two label/value pairs per row in containers ≥ 56rem** (container query, so narrow panels keep one) | PO detail at 1920 px: facts in two columns, the order lines move above the fold. |
| **Contextual sidebar**: the department of the current page lists all its sections; others keep their main entries | Warehouse: 14 sections, same permission codes as its tab strip, current marked. From 1280 px the Warehouse tab strip steps aside (the sidebar carries it); 768–1279 px the strip **wraps** — at 1024 px **0 of 14 tabs hidden** (was 5). Phones: unchanged swipe row + drawer. |
| **Sidebar filters** under Sales orders: Awaiting confirmation / Confirmed / Short of stock | URL filters the list already reads live; the one in use is `aria-current="page"` (`?lang` ignored). Other lists read filters only on open — not added (K-14). |
| **Denser phone cards** (`CELL`): label in a 7rem column beside the value; number cell heads the card | Sales order card 490 → **386 px** while showing more (items, next step); 14 orders 8,066 → **6,561 px**. PO 490 → 406, PR 490 → 416, GR 435 → 337 px. |

No three permanent columns anywhere: sidebar + content from 1280 px only; the preview opens *inside*
the list, not as a third column.

### Quick preview (Phase 4)

`Previewable` (in `docContext.tsx`): a chevron button beside the document number opens a read-only
panel under the row — every line (item, quantity, unit, and "… outstanding" where something is still
to deliver / receive) and **Open full document**.

- Keyboard: a real `<button>` with `aria-expanded` / `aria-controls`, named "Preview lines — PO-…";
  Enter / Space toggle; focus stays on the toggle; the panel is a labelled `region`; 44 px target on
  phones.
- No business action in the panel (tests assert no button inside it).
- States: loading, empty ("No lines yet"), error (alert + the full-document link; retried on the
  next opening).
- **No duplicate fetching:** nothing is read until the first opening; each document is read once
  per list (`usePreviewCache`), reopening uses it; a failed read is not cached.
- Permission-safe: it calls the same detail endpoint the person's own document page calls
  (Warehouse → its pending-receive view, no money). Withheld for the Executive on purchase orders,
  whose detail is a summary without lines (K-16).
- Where: Sales orders, Purchase requests, Purchase orders, Warehouse pending receive. Not a global
  framework — one ~120-line component and a cache hook.

### Visual consistency (Phase 5)

Existing Obsidian / Emerald tokens and components only (Pill, Facts, AreaLink, button styles,
lucide icons already in the CORE chunks). Summary text: mono code in muted caption, name in body,
quantity in tabular caption. No marketing page touched.

## 2. Quality gates (Phase 6)

| Gate | Result |
| --- | --- |
| Backend typecheck · ESLint · Prettier | pass · pass (0 problems) · pass |
| Backend tests (local PostgreSQL 18, `pdabliss_core_test`) | full suite **518 / 519**; the one failure was the Sales row-key contract test, which pins the exact list keys and now lists `summary` (intended contract change). After the update the affected files pass: `sales-orders`, `purchase-orders` (incl. Warehouse privacy), new `line-summary` — **38 / 38** |
| Frontend typecheck · ESLint · Prettier | pass · pass (0 problems) · pass |
| Frontend tests | **1,144 / 1,146** per full parallel run (62 files, incl. new `docContext.test.tsx` and EP42.3 cases in `coreNav`, `orders`, `allocation`). The 2 failures differ between runs (Company Control Center overview, production list filters, login countdown) and all pass in isolation. They are **pre-existing timing flakes under parallel load**: the untouched baseline `029e76d`, run in a temporary worktree, failed 4 tests in its full run (same login and Company Control Center tests) and failed the same three files in 3 of 3 isolated reruns, against 3 of 5 for EP42.3. None of those files' code was changed by EP42.3. Recorded, not fixed (out of scope). |
| Build + prerender + verify-prerender | pass — 108 pages + 3 shells carry their own head |
| Performance budget | **within budget** — all JS **4,272.9 / 4,300 KiB** (EP42.2 4,261.2, **+11.7**); initial JS **182.7 / 205 KiB gzip** (unchanged); static HTML **526.9 / 560 KiB**, 111 / 111 files (unchanged); initial CSS 50.8 / 52 KiB gzip (+0.2) |
| Permission & Warehouse privacy | new backend assertions: Warehouse pending-receive row `summary` has exactly the five operational keys and none of the order's prices (42.75 / 999.99) or price/amount/total/note words; field allow-lists include the summary keys; on the clone, Warehouse pending-receive / receipts / picks lists carry **no money keys**; frontend test: the Warehouse preview shows "ยังค้าง 8 KG", no price/total/deposit/THB, no button, one detail read |
| Real-stack cross-department regression | **46 / 46** on a fresh UAT clone (`localhost:2111/2112`): Sales draft → submit → confirm → allocate → Warehouse pick → pack → ship → dispatch → deliver; Purchasing PR + PO lists; Warehouse drafts (no posting rights); Operations output → owner accept → Warehouse FG receipt → owner post; Executive / System Admin refusals; EP42.3 summaries at each hand-off (SO row FG-000001 · 3 PCS, pick row, PR row 5 + 1 more, PO rows, pending-receive and receipt rows without money). Ledger reconciliation **0 / 0 / 0** after Sales, Production and at the end. Adapted to the UAT policy (independent approval: the owner gives an override reason on their own documents; operations.demo is refused accepting its own output — correct). |
| Browser QA (real stack, Chromium) | TH / EN / ZH headers, toggle names, sidebar sections on pending receive; 390 / 768 / 1024 / 1280 / 1440 / 1920 px — no page overflow on any audited route; keyboard: Enter opens the preview, focus kept; phone drawer: focus trapped, Escape closes and returns focus, current section marked; Executive: summaries, next step, no preview toggle, no create links |
| UAT sandbox isolation | `pdabliss_core_uat` 71-table content hash identical before work, after each clone, and at the end; 0 connections; ledger 0 violations (28 movements). The development database was never connected to. All audit and regression work ran on the disposable `pdabliss_core_uat_ep423`. |
| Secret scan | no session cookie, connection string with password, `DEMO_*_PASSWORD`, API key or private key in the changes; no personal paths |

## 3. Data safety

- Read-only `pg_dump` of `pdabliss_core_uat` → restored into `pdabliss_core_uat_ep423` (the UAT
  tool's own guarded helpers; name allowed by its `pdabliss_core_uat_<suffix>` rule). Re-cloned once
  for a clean regression run (earlier runs had used up stock on the copy).
- The UAT stack (1211 / 1212) was not started; the owner's UAT data and backups were not touched;
  no reset, restore or backup rotation.
- `.claude/launch.json` temporary `qa423-*` entries removed before the commit (file identical to
  `029e76d`).

## 4. Remaining limitations (recorded in the bug register)

- K-13: transfers, adjustments, counts, packs, shipments and production issues still show a line
  count (UAT-IDEA-001).
- K-14: sidebar filters for Sales orders only.
- K-15: Inventory at 768–1023 px keeps its tall card layout.
- K-16: no preview for the Executive on purchase orders (summary view has no lines) — by design.
- K-17: "next department" is guidance derived from status, not task assignment.
- JS headroom is now ≈ 27 KiB: the next large screen should recover JS first.

## 5. Commit

`feat: improve CORE cross-department document context and UX (EP42.3)` — local only.
