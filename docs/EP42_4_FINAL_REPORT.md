# EP42.4 — Final Cross-Department Context, UX Completion & Frontend Performance — Final Report

**Baseline:** `86c00a9` (EP42.3.1), verified equal to `origin/main` on the live remote before any change.
**Result:** one local commit. Not pushed, not deployed. EP43 / EP44 / EP45 not started.
**Human UAT: NOT COMPLETED** — the owner has deferred the full test plan. Nothing here is human
acceptance. UAT-BUG-001 / 002 stay _awaiting owner verification_.

**Verdict: PASS.**

Detail of the document work: [EP42_4_CONTEXT_COMPLETION_REPORT.md](EP42_4_CONTEXT_COMPLETION_REPORT.md).

## 1. What changed

| Area               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transfers          | Item + quantity on each row; "From → To" column; next action (draft → Post); line preview with lots                                                                                                                                                                                                                                                                                                                                                                                         |
| Adjustments        | Signed change (+/−) per row; location always shown from 768 px; next action (Submit / Approve); preview with location · lot                                                                                                                                                                                                                                                                                                                                                                 |
| Cycle counts       | Item names, **no quantities** (blind count); counted / total and variance lines always shown from 768 px; next action (Start / Review / Confirm); preview of counted figures                                                                                                                                                                                                                                                                                                                |
| Packing            | Packed **of** picked; next action (Confirm pack / Create shipment); preview                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Shipments          | Delivered **of** shipped; dispatched and delivered dates; next action (Dispatch / Record delivery); preview                                                                                                                                                                                                                                                                                                                                                                                 |
| Quick preview      | Shared list component (`DocList`) gains an optional preview; new **permission-denied** state (403 / 404) for every preview                                                                                                                                                                                                                                                                                                                                                                  |
| Layout             | Warehouse document lists: "who / when" columns only from 1536 px (and hidden on phones), giving the item context the room at 1280–1440 px; phone cards about 70 px shorter                                                                                                                                                                                                                                                                                                                  |
| Signed-in language | **Defect found and fixed.** Signed-in pages (`/company`, `/core`, `/account`, `/platform`) briefly showed the Thai skip link on English / Chinese pages, because the EN / ZH shell dictionary is a lazy chunk with a Thai fallback. `AuthLocale wait` now renders those areas only once their dictionary is loaded; if loading fails it renders anyway. They are not prerendered, so there is no hydration risk. Root cause of an intermittent failure of the Control Center language test. |
| Bundle             | 26 verified-dead copy keys removed from TH / EN / ZH (78 entries) — see §4                                                                                                                                                                                                                                                                                                                                                                                                                  |

Backend: a read-only `summary` projection on five Warehouse list endpoints (`line-summary.ts` gains
optional `of` and nullable `quantity`). No new endpoint, no permission change, no posting path.

## 2. Platform Company Explorer filter check (Phase 6)

| Scenario                                                                     | Result                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Two filters changed by two separate user events                              | Both kept (URL and request) — **not reproduced**           |
| Search typed, then a filter chosen immediately (debounce pending)            | Both kept, 3 of 3 runs                                     |
| Both changes forced into **one React batch** (not producible through the UI) | Second wins — the same React Router limitation as EP42.3.1 |

**Decision: no Explorer code change** (the spec forbids changing working behaviour on code similarity
alone). Two regression tests were added (`platform.test.tsx`), and the single-batch behaviour is recorded
as K-18.

## 3. Tests and QA

| Gate                                                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend: Prisma validate · typecheck · lint · format · build   | valid · pass · pass · pass · pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Backend full suite (local PostgreSQL 18, `pdabliss_core_test`) | **524 / 524** (35 files) — includes new assertions: transfer row quantity, signed adjustment, blind count, packed-of-picked, delivered-of-shipped, summary keys                                                                                                                                                                                                                                                                                                                                                                                 |
| Frontend: typecheck · lint · format                            | pass · pass · pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Frontend full suite                                            | **1,159 / 1,159 in 4 consecutive full runs** (2 normal, 2 with 12 CPU-burner threads), on the final code including the language fix                                                                                                                                                                                                                                                                                                                                                                                                             |
| Build + prerender + verify-prerender                           | pass — 108 pages + 3 shells                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Real-stack cross-department regression (UAT copy)              | **51 / 51**; new checks: transfer, signed adjustment, blind count, pack 3 of 3, shipment 0 of 3, all without money keys                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Stock ledger / reservations                                    | reconciliation 0 / 0 / 0 after Sales, after Production and at the end; UAT-tool integrity SQL (10 checks) on the copy: **0 violations** (30 movements, 16 balances)                                                                                                                                                                                                                                                                                                                                                                             |
| Browser QA (real stack, Chromium)                              | Five lists + five detail pages at 390 / 768 / 1024 / 1280 / 1440 / 1920 px: no page overflow. TH / EN / ZH at 1280 px, labels translated ("Item (Packed / Picked)", "物料 (已送达 / 数量)"). Keyboard: every preview opens from its button, focus stays on it, panel has no buttons. Executive: summaries + previews, no create / act controls, no money. Owner sweep of all departments' lists in ZH at 1280 px: no overflow, no error alerts; console: only the expected pre-sign-in 401. Before / after screenshots of Transfers at 1440 px. |
| Permission & privacy                                           | Five lists and details: Warehouse 200, Executive 200 (`actions: []`), Sales / Purchasing / Accounting / System Admin **403**; no money keys in any Warehouse or Executive response; no endpoint widened                                                                                                                                                                                                                                                                                                                                         |

Investigated rather than classified as flaky: one full run failed the Control Center language test
before the language fix. The DOM showed a Thai skip link on a Chinese page; that was the lazy-dictionary
defect above, now covered by `features/auth/locale.test.tsx`.

## 4. Performance

| Budget             | EP42.3.1    | EP42.4                 | Limit |
| ------------------ | ----------- | ---------------------- | ----- |
| All JS (raw)       | 4,273.1 KiB | **4,270.0 KiB** (−3.1) | 4,300 |
| Initial JS (gzip)  | 182.7 KiB   | **182.9 KiB** (+0.2)   | 205   |
| Static HTML        | 526.9 KiB   | **525.6 KiB** (−1.3)   | 560   |
| Initial CSS (gzip) | 50.8 KiB    | 50.8 KiB               | 52    |

How the bundle was examined:

- Source-mapped build plus per-module byte attribution (no new tool or dependency).
- No module is bundled twice and unused exports are already tree-shaken, so the safe saving was copy
  text no code reads. The candidate keys were found by script and every one was checked by hand; groups
  read through dynamic indexes (`timelineTypes[...]`, `reasons[...]`) were kept.
- Removed 26 keys × 3 languages, about **−5.8 KiB**: unused Platform strings in `auth/copy.ts` and
  `company/copy.ts`, plus single keys in Production, Purchasing, Sales and Warehouse copy.
- The new list features added about +2.5 KiB.
- Headroom is now **≈ 30 KiB**. Further safe recovery is limited: the remaining weight is live TH / EN /
  ZH copy, React and three.js (CORE World, separately budgeted).

## 5. Data and database safety

- Read-only content hashes of `pdabliss_core_uat` and `pdabliss_core_dev`, taken before any work and
  again at the end: **0 of 71 tables differ in each**.
- All writes went to the disposable `pdabliss_core_uat_ep423`.
- The UAT stack was never started; no reset, restore or migration of a persistent database.
- `.claude/launch.json` temporary entries were removed (file unchanged).

## 6. Security and policy boundaries (Phase 8)

Re-verified for the changed surfaces:

- company and branch isolation (existing EP40 sweeps in the 524);
- department permissions (403 matrix above);
- Warehouse financial privacy;
- Executive read-only and System Admin without operations;
- no new stock-mutation path, posting rules unchanged (ledger 0 / 0 / 0);
- audit trail untouched;
- independent approval unchanged (the regression exercises owner overrides and the not-overridable
  self-acceptance refusal).

Product-policy gaps remain as recorded in `EP42_1_PRODUCT_GAP_MATRIX.md`. The legacy multi-department
assignment was **not** rewritten in this UX episode:

- one department per staff member (not enforced);
- optional BOM (production still requires one);
- recipe confidentiality;
- PDA ONE accounting ownership and integration.

## 7. Remaining limitations

See [EP42_2_BUG_REGISTER.md](EP42_2_BUG_REGISTER.md) K-13 … K-19:

- production material issues still show a line count;
- sidebar filters exist for Sales orders only;
- Inventory keeps tall cards at 768–1023 px;
- the Explorer single-batch case (K-18);
- the shell-dictionary wait on signed-in pages (K-19).

**Production blockers (unchanged):** automated backups and restore drills, monitoring, a least-privilege
runtime database role, an external security review, payment / billing.
