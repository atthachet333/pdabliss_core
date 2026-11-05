# EP38 Report — Finished Goods Receipt, Production Output & Production Completion Foundation

**Verdict: PASS.**

- **Baseline:** `8876ff5` (EP37), equal to `origin/main` when EP38 started.
- **Final commit:** local only, `feat: add CORE finished goods receipt and production completion
  foundation (EP38)`. **Not pushed, not deployed.**
- **EP39:** not started.

Design docs: [PRODUCTION_OUTPUT.md](PRODUCTION_OUTPUT.md),
[PRODUCTION_FINISHED_GOODS_RECEIPT.md](PRODUCTION_FINISHED_GOODS_RECEIPT.md),
[PRODUCTION_COMPLETION.md](PRODUCTION_COMPLETION.md). Ledger: [INVENTORY_LEDGER.md](INVENTORY_LEDGER.md)
§12. Budget: [PERFORMANCE.md](PERFORMANCE.md).

## 1. Architecture

```
reserve → issue (PRODUCTION_CONSUMPTION) → execution → usage → OUTPUT REPORT (no stock)
→ quality decision (ACCEPTED: good / rejected) → FINISHED GOODS RECEIPT POSTED (PRODUCTION_OUTPUT +)
→ StockBalance grows → COMPLETION_REVIEW → COMPLETED / SHORT_CLOSED
```

- **Stock boundary.** Manufacturing progress (reports and acceptance) is separate from physical
  receipt. Only a posted receipt writes stock, through `ledger.ts applyMovement()`; there is no
  second ledger.
- **Lock order.** Order row → output report row → receipt row → location advisory locks → balances.
- **Phase 0 bundle.** EP37 ended at 4,167.0 / 4,300 KiB. The chunk graph was inspected first; every
  EP38 screen is lazy inside the existing Production and Warehouse routes. No recovery was needed,
  and the EP36 `CoreCanvas` optimization is untouched.

## 2. What was built

| Area | Summary |
| --- | --- |
| Output report | `ProductionOutputReport` `OUT-YYYYMM-NNNNNN` (DocumentSequence): production date (start day … today), good / defective / pending-quality (≥ 0, unit precision, something reported). DRAFT → SUBMITTED → ACCEPTED / REJECTED (reason); DRAFT / SUBMITTED → CANCELLED; ACCEPTED → CANCELLED only while nothing is in stock. Acceptance = quality decision: accepted = good + `pendingGood`, rejected = defective + the rest. Σ accepted ≤ target. Reported figures and the decision are immutable (CHECK + trigger) |
| Quantities | target · good reported · pending review · accepted · rejected · received · awaiting receipt · remaining — derived, order unit, counted once by status |
| Receipt | `ProductionGoodsReceipt` + lines `FGR-YYYYMM-NNNNNN`: output report (ACCEPTED), location of the branch, lot / expiry / production date per item tracking (the EP31 receiving rules, reused), quantity. DRAFT → POSTED / CANCELLED; POSTED → REVERSED (reason). Lines immutable once not DRAFT; the line item is always the order's (trigger) |
| Posting | one transaction under the locks: re-validate everything, received + this ≤ accepted (`FG_EXCEEDS_ACCEPTED`), lot resolved once (concurrent same-lot creation = one row; expiry and production date must agree), `PRODUCTION_OUTPUT` per line (unique per line and type), POSTED, audit |
| Reversal | `PRODUCTION_OUTPUT_REVERSAL` through the decrease guard: refused when reserved (`STOCK_RESERVED`), gone (`FGR_STOCK_GONE`) or counted; output receivable again |
| Completion | IN_PRODUCTION / PAUSED → COMPLETION_REVIEW → COMPLETED (outcome COMPLETED or SHORT_CLOSED with reason) or back to IN_PRODUCTION. Blockers: output to review, draft receipt, accepted not received, draft material issue; material review confirmed. COMPLETED needs target reached and no reservation; SHORT_CLOSED releases reservations (`ORDER_CLOSED`) and keeps the target and shortfall. COMPLETED is terminal (policy + trigger) |
| Unused material | issued − used stays `unrecorded`; nothing returned automatically (no return document yet) |
| Sales | received goods are ordinary stock; allocation stays explicit (EP34); unreceived output invisible |
| Traceability | order view: output lots (receipt, quantity, expiry) and consumed material lots (issue, quantity) — order-level granularity, said so on screen |
| Permissions | `operations.output.create` (OPERATE), `operations.output.approve` (MANAGE), `warehouse.finished_goods.view` (READ) · `.process` (OPERATE) · `.confirm` (MANAGE); completion reuses the EP27 `operations.orders.update_status` (MANAGE). Override CHECK 76 → **81** |
| UI | lazy `OutputArea` (list, new report, report with quality decision), `OutputPanel` (order: figures, reports, receipts, blockers, review / reopen / complete / short close with material-review checkbox, traceability), `FinishedGoodsArea` (pending queue, receipts, editor, post / cancel / reverse with the exact warning); overview tiles; TH / EN / ZH |
| Audit | 6 output + 5 receipt actions (business entities, redacted on the Platform explorer), 4 completion actions on the order timeline, `INVENTORY_LOT_CREATED` |
| Demo | MO_EXEC: OUT #1 good 4 + defective 1 ACCEPTED, FGR #1 POSTED 2 (2 awaiting Warehouse), OUT #2 SUBMITTED; MO_DONE (2 pcs) reserved → issued → output → received → COMPLETED, its materials from one labelled owner adjustment; real ledger operations; no persona elevated; second seed changes nothing |

## 3. Gates

| Gate | Result |
| --- | --- |
| Prisma validate · migrate diff | valid · no drift (fresh QA DB and upgrade DB) |
| Backend typecheck · lint · format · build | pass · 0 problems · clean · pass |
| Backend tests | **31 files, 483 tests passed** (EP37: 30 / 472). New: `production-output.test.ts` (11). Updated on purpose: `production` (COMPLETED is a status now), `production-execution` (complete exists, only from review), `inventory-control` (81 codes), `demo-personas` (demo output, receipts, completed order) |
| Frontend typecheck · lint · format | pass · 0 problems · clean |
| Frontend tests | **58 files, 1,114 tests passed** (EP37: 57 / 1,108). New: `output.test.tsx` (6); `production.test.tsx` nav updated; `--maxWorkers=2`. One earlier full run had a timing failure in the unchanged `login.test.tsx` (robots meta, while the backend suite ran in parallel); it passed 32 / 32 alone, and the full rerun passed |
| Build · prerender · verify-prerender · perf | pass · 108 pages + 3 shells · pass · within budget |
| Fresh migration · seed twice | 24 migrations; second seed: every section `unchanged` |
| Upgrade EP37 → EP38 (`pdabliss_core_up38`) | below |
| Real-stack E2E (`qa-ep38`, fresh `pdabliss_core_qa38`, ports 2111 / 2112) | **77 / 77**, no server errors |
| UI QA — in-app browser · headless Edge 156 · headless Chrome 156 | **96 / 96 each** (8 screens × 390 / 768 / 1440 / 1920 px × TH / EN / ZH) |
| Ledger reconciliation | 0 after every E2E section and race |
| Secret scan (EP38 diff + new files) | clean |

**Upgrade EP37 → EP38:**

- the migration changed **no data** in the 67 EP37 tables;
- it added 3 tables and 8 nullable columns, with no drift;
- the EP38 seed modified only existing `StockBalance` rows (the demo consumption and output) and
  added rows;
- a second seed changed nothing;
- EP37 AuditLog / SalesOrder / SalesOrderLine / StockMovement rows are identical;
- invariants are 0.

**UI QA checks:** no horizontal overflow, one h1, labelled controls, targets ≥ 24 px, no duplicate
ids, no money. Keyboard: the confirm box opens from the focused action, and on cancel focus returns
to the page heading.

**E2E coverage (77):**

| Scenario | What was checked |
| --- | --- |
| A — full completion | reservation → start → issue → usage → report (no stock) → staff cannot accept → accept (no movement) → Sales allocation before receipt reserves nothing → Warehouse queue (lot / expiry required, no money) → staff drafts, cannot post → owner posts → two PRODUCTION_OUTPUT +4 / +6 → on hand +10 → Sales allocates 4 only when asked → review → COMPLETED → history, traceability, timeline → closed order refuses output / reopen / allocate / issue / cancel |
| B — partial | 40 + 35 of 100 received in three receipts, remaining 25, still in production; over-receipt refused; SHORT_CLOSE_REQUIRED; short close needs a reason, keeps target and shortfall |
| C — rejected | +75 only, defective never; pending decision 41 / 7 |
| D — concurrency | three rounds each: triple post (one 200, one movement); three receipts of 5 on 6 remaining (exactly one posts); post vs output cancel; post vs completion; review vs new output vs issue post; completion vs release; same new lot from two receipts (one lot, both posted); lot expiry mismatch; reversal vs Sales allocation; reversal vs Sales dispatch (dispatch wins, reversal refused) |
| E — integrity | reconciliation after every section (mismatch, negative, duplicate output, orphan output, over-received, over-reserved all 0); no output movement without a receipt; no accepted output above target |
| F — privacy and IDOR | Warehouse views allow-listed (no price / customer); Warehouse cannot read production orders or reports; Operations has no finished goods route; Executive read-only; System Admin / Sales / Purchasing / Accounting 403; another branch's location refused; unknown ids 404; mass assignment 400 (status, acceptedQuantity, lotId, receipt status, completion status); audit without quantities |

**Backend tests (11):**

- full completion (no stock at report or accept, exact output movements, Sales sees only received
  goods, closed-order protection);
- partial production and short close (reservations released as `ORDER_CLOSED`);
- rejected goods and the immutable quality decision;
- output rules (empty, precision, dates, target cap, draft visibility, mass assignment, review and
  complete blockers);
- lots and expiry (required, expired, production date, branch locations, foreign location,
  mismatches, one lot, traceability, database guards);
- races: triple post and competing receipts; post vs cancel, post vs complete, review vs output /
  issue / release;
- reversal vs Sales allocation, after adjustment (`FGR_STOCK_GONE`), restoring receivable output;
- roles / isolation / IDOR / privacy / audit;
- codes, tiers and numbering under concurrency.

## 4. Block conditions — all clear

None of these occurs:

- an output report creating stock;
- a double post;
- over-receipt;
- defective goods in stock;
- an editable posted receipt;
- a lot / expiry mismatch;
- a cross-company or cross-branch receipt;
- a ledger bypass;
- divergent stock;
- a closed order accepting output;
- completion with unresolved blockers;
- Sales seeing unreceived output;
- automatic Sales reservations;
- a Warehouse money leak;
- unauthorized posting or privilege escalation;
- IDOR or mass assignment;
- duplicate output under a race;
- migration damage;
- an EP37 – EP29 regression;
- an exceeded cap;
- a tracked secret.

## 5. Performance

| Chunk | Raw / gzip |
| --- | --- |
| `OutputArea` | 10.9 / 3.7 KiB |
| `OutputPanel` | 5.4 / 1.9 KiB |
| `FinishedGoodsArea` | 11.2 / 3.6 KiB |
| `outParts` (+ TH / EN / ZH copy, API) | 28.3 / 8.3 KiB |
| `ProductionArea` · `prodParts` | 33.1 / 8.8 · 41.1 / 12.5 KiB |

| Budget | Value |
| --- | --- |
| All JS | 4,225.6 / 4,300 KiB (+58.6) |
| Initial JS | 182.6 / 205 KiB gzip |
| Static HTML | 528 / 560 KiB |
| Headroom | ≈ 74 KiB |

No cap was changed.

## 6. Known limitations (deliberate)

- No material return, rework, scrap or quarantine documents. Rejected output is evidence only.
  Unused issued material stays `unrecorded`.
- Order-level traceability; no lot-to-lot genealogy.
- One finished item per order (no co- or by-products). No costing, valuation, GL, payroll, routing
  or capacity.
- Reversal is refused once goods are reserved, sold or moved; returns (future) will handle those.
- Firefox and axe are not available on this machine (in-app Chromium, Edge and Chrome were checked).
