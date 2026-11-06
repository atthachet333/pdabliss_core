# EP39 — Full Operational Integration, Complete Demo Seed & Cross-Department Readiness

Baseline `e66ae06` (EP38.4, `main` = `origin/main`). Local commit only — not pushed, not
deployed, EP40 not started. **Demo readiness is not production readiness** (see §9).

## 1. What EP39 changed

| Area | Change |
| --- | --- |
| Demo seed | `backend/src/demo/integration-demo.ts`: a cross-department chain through the real services; the EP28 master data grows by 5 items, 2 customers, 2 suppliers, unit `L`, category `PK`. Additive, idempotent, no persona changed. |
| Services | The purchase-request, purchase-order, receiving and sales-order services accept an audit scope (`seed`) and extra CREATED details (the fixture key), like the EP35–EP38 services. Routes never pass them. |
| Defect fix (P1) | Warehouse movement list: HTTP 500 once any production movement existed (since EP37). Added the three production movement types, their TH / EN / ZH labels, and the issue / finished-goods-receipt source documents. |
| Defect fix (P2) | Sales list rows carry `fulfilmentState`. A delivered order now reads **Delivered** instead of only "Fully allocated", and its page no longer says "Ready to pick" once picking has started. |
| UX debt | Document-number links reach 28 px at tablet / desktop (44 px on phones) in the Purchasing, Warehouse receipt, Master data and Sales lists, and in the cross-document links (PO ↔ PR, receipt → PO). Inventory row actions are 28 px with a focus ring. The Sales "short of stock only" checkbox is 24 px inside a 44 px row. The Thai "เปิด" link on the Control Center is at least 24 px wide. |
| Navigation | **Change branch** returns to the page it was opened from (it always went to the CORE home). After any CORE page change, focus moves to the content instead of being lost on `<body>` (it happened when the branch choice closed). `AreaLink` keeps extra router state next to the language. |
| Tests | New EP39 seed test (states, links, handoff, privacy, ledger, reservation bound, no-op reseed). Episode seed tests now name the EP39 records explicitly. Fixed silent gaps: the EP32 movement check now asserts HTTP 200, timestamp-sensitive privacy regexes are replaced, and the EP38.2 backend lint error is fixed. |
| Docs | New: this report, `DEMO_ACCOUNT_MATRIX.md`, `DEMO_DATA_CATALOG.md`, `DEMO_WORKFLOW_GUIDE.md`. Updated: `DEMO_PERSONAS.md`, `INVENTORY_LEDGER.md`, `PERMISSION_ACTION_MATRIX.md`, `FRONTEND_BACKEND_HANDOFF.md`, `PERFORMANCE.md`, `README.md`. |

There is no schema change, no migration, no new dependency, and no auth / mail change.
Performance caps are unchanged.

## 2. Cross-department dependency matrix (from the code, EP28–EP38.4)

| # | Document / action | Source → destination | Actor (permission) | Company / branch | Workflow states | Quantity semantics | Inventory effect | Audit | Failure behaviour |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Purchase request | any department → Purchasing queue | `<dept>.purchase_requests.create`; decide: `purchasing.requests.approve` or `<dept>.purchase_requests.approve` | session branch; company-scoped | DRAFT → SUBMITTED → APPROVED / REJECTED; CANCELLED | requested, item base unit (or free unit for non-item lines) | none | `PURCHASE_REQUEST_*` | 409 `PR_INVALID_TRANSITION` (one decision wins); 403 |
| 2 | Purchase order | APPROVED request → supplier, Warehouse *Pending receive*, Accounting deposits | `purchasing.orders.create` / `.approve` (issue) / `.cancel` | the request's branch | DRAFT → (WAITING_DEPOSIT) → PENDING_RECEIVE → RECEIVED; CANCELLED | ordered ≤ request remaining; cancelled quantity returns to the request | none | `PURCHASE_ORDER_*` | 409 over-ordering, strict body (400 on unknown fields) |
| 3 | Supplier deposit | WAITING_DEPOSIT order → Accounting | `accounting.deposits.confirm` (confirm or waive) | order branch | PENDING → CONFIRMED / WAIVED (order → PENDING_RECEIVE) | amount / percent of the order total | none | `PURCHASE_ORDER_DEPOSIT_*` | conditional update, one decision wins |
| 4 | Goods receipt | PENDING_RECEIVE order → stock | `warehouse.receiving.process` (draft, post); `warehouse.receiving.cancel` (reverse) | order branch, the branch's locations | DRAFT → POSTED → CANCELLED (reversal) | accepted ≤ outstanding; rejected kept with reason; lot / expiry by item rules | `PURCHASE_RECEIPT` +; reversal − (never reserved or gone stock) | `GOODS_RECEIPT_*`, order `…RECEIVED` | 409 over-receipt; reversal refused when reserved |
| 5 | Transfer | location → location, same branch | `warehouse.transfers.create` / `.approve` | one branch | DRAFT → POSTED; CANCELLED | per lot | `TRANSFER_OUT` / `TRANSFER_IN` | `TRANSFER_*` | 409 `STOCK_RESERVED` / insufficient |
| 6 | Adjustment | Warehouse → stock | `warehouse.stock_adjustment.create` / `.approve` | one branch | DRAFT → SUBMITTED → POSTED; REJECTED, CANCELLED | reason required; new lots for increases | `ADJUSTMENT_IN` / `_OUT` | `ADJUSTMENT_*` | 409 `STOCK_RESERVED` (never takes reserved stock) |
| 7 | Cycle count | Warehouse → stock | `warehouse.counts.create` / `.approve` | locked locations | DRAFT → COUNTING → REVIEW → POSTED | counted − system | `COUNT_CORRECTION` | `CYCLE_COUNT_*` | location lock refuses other movements |
| 8 | Sales order | Sales → manager | `sales.orders.create` / `.edit`; confirm / cancel: `sales.orders.approve` / `.cancel` | working branch | DRAFT → SUBMITTED → CONFIRMED; CANCELLED | ordered, item base unit; availability informational only | none | `SALES_ORDER_*` | 403 for staff confirm; 400 strict body |
| 9 | Sales allocation | CONFIRMED order → Warehouse *Pending pick* | `sales.orders.approve` | order branch | NOT / PARTIALLY / FULLY_ALLOCATED | FEFO by lot and location, only free stock (Sales + Production reservations shared) | reservation only (`SalesAllocation`) | `SALES_ALLOCATION_*` | partial when short; never over-reserves |
| 10 | Pick → pack → shipment | Pending pick → customer | `warehouse.picking.process`; dispatch `warehouse.dispatch.confirm`; deliver `warehouse.delivery.confirm` | order branch | pick / pack / shipment states; delivered or exception | picked ≤ reserved; packed ≤ picked | `SALES_ISSUE` at dispatch, consuming the reservation | `SALES_PICK_*`, `SALES_PACK_*`, `SALES_SHIPMENT_*` (dispatched, delivered, exception) | 409 on double dispatch |
| 11 | Sales demand → production | CONFIRMED sales line → production order | `operations.orders.create` | the sales order's branch | MO source `SALES_DEMAND` | MO quantity ≤ demand | none | `PRODUCTION_ORDER_CREATED` | 409 when the line is not open |
| 12 | BOM | Operations | `operations.bom.manage` | company item, branch-free | DRAFT → ACTIVE → RETIRED (revisions) | per output quantity | none | `PRODUCTION_BOM_*` | one ACTIVE revision per item |
| 13 | Production order | Operations | `operations.orders.create` / `.approve` / `.update_status` / `.cancel` | its branch | DRAFT → SUBMITTED → APPROVED → READY → IN_PRODUCTION (⇄ PAUSED) → COMPLETION_REVIEW → COMPLETED; REJECTED, CANCELLED | requirements frozen at approval | none | `PRODUCTION_ORDER_*` | 409 invalid transition |
| 14 | Material reservation | approved order ← branch stock | `operations.materials.manage` | order branch | NOT / PARTIALLY / FULLY_RESERVED → (PARTIALLY_)ISSUED | FEFO, free stock only | reservation only | `PRODUCTION_MATERIALS_ALLOCATED` / `_RELEASED` / `_REALLOCATED` | never over-reserves (serialised per stock identity) |
| 15 | Production shortage handoff | short materials → Purchasing | `purchasing.production_shortages.view` (read) | member's branches | derived | required − reserved − issued vs available | none | — | read-only; no PR / PO generated |
| 16 | Material issue | reservations → production | `operations.material_issues.create` / `.approve` (post); Warehouse reads `warehouse.material_issues.view` | order branch | DRAFT → POSTED; CANCELLED | ≤ reserved | `PRODUCTION_CONSUMPTION`, consuming reservations | `MATERIAL_ISSUE_*` | 409 after review / completion |
| 17 | Material usage | Operations | `operations.material_usage.create` | order branch | per material | used vs issued = variance | none | `PRODUCTION_MATERIAL_USAGE_RECORDED` | — |
| 18 | Output report | Operations quality decision | `operations.output.create` / `.approve` | order branch | DRAFT → SUBMITTED → ACCEPTED / REJECTED; CANCELLED | good / defective / pending | none (never stock) | `PRODUCTION_OUTPUT_*` | 409 invalid transition |
| 19 | Finished-goods receipt | accepted output → stock | `warehouse.finished_goods.process` (draft); `.confirm` (post, reverse) | order branch locations | DRAFT → POSTED → REVERSED; CANCELLED | received ≤ accepted good; lot / expiry by item rules | `PRODUCTION_OUTPUT` +; reversal − (guarded) | `FINISHED_GOODS_RECEIPT_*` | 409 double post / over-receipt |
| 20 | Completion | Operations | `operations.orders.update_status` | order branch | COMPLETION_REVIEW → COMPLETED (good ≥ target) or SHORT_CLOSED (reason) | shortfall kept | releases remaining reservations | `PRODUCTION_ORDER_COMPLETED` / `PRODUCTION_ORDER_SHORT_CLOSED` | 409 when not reviewed / not entitled |
| 21 | Finished goods → sale | received lot → a sales order | `sales.orders.approve` (allocate, by hand) | branch stock | as 9–10 | FEFO | as 9–10 | as 9–10 | never automatic |

## 3. Disconnected-workflow audit — findings

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| D1 | Warehouse *Movements* (API and screen) failed with HTTP 500 as soon as a production movement existed, so Warehouse could not trace production consumption or output. The EP32 seed test only checked the error body for money words and passed. | P1 (since EP37) | Fixed: movement types, labels, source documents; tests assert HTTP 200 and the document numbers. |
| D2 | Sales could not see that an order was delivered: the list showed only "Fully allocated" (allocation is cumulative), and the order page still said "Ready to pick" after dispatch. | P2 | Fixed: `fulfilmentState` in list rows (same derivation as the order); "Ready to pick" only before picking starts. |
| D3 | Document-number links were 17–23 px on tablet / desktop in five lists. Inventory row actions were 24 px with no focus ring. The Sales shortage checkbox was 16 px. | P3 (a11y) | Fixed (28 px / 24 px; label rows 44 px). |
| D4 | Test quality: timestamp-sensitive "no money" regexes, a missing status assertion, and an EP38.2 backend lint error. | P3 | Fixed. |
| D4b | Switching branch from the CORE menu lost the current page and left keyboard focus on `<body>`. | P3 (a11y / navigation) | Fixed; frontend test added. |
| D4c | The demo seed acts through the services with a constructed session. A persona an administrator has since removed from the demo branch would have been moved silently to its only remaining branch (the EP26 one-branch fallback). | P3 (seed safety) | Fixed: each persona's demo-branch access is checked first; that fixture group is skipped with `BRANCH_NOT_ALLOWED` and reported; test added. Real requests were never affected: the session branch is re-checked on every request. |
| D5 | A department manager may approve their own department's purchase request: the EP29 v1 rule has no separation of duties. | design | Kept (documented v1 rule); a release consideration (§9). |
| D6 | No Sales Manager or Warehouse Manager persona: confirm, allocate, dispatch, deliver and posting finished goods are the owner's steps in the demo. | demo limitation | Kept: personas are not elevated; documented in the account matrix. |
| D7 | A material issue appears in Warehouse movements by number only (the Warehouse handoff is a list, with no detail page). | minor | Number shown for traceability. |
| D8 | Accounting has supplier deposits only; no invoices, receivables, ledger or customer payments exist. | scope | Not invented; documented. |

**Cross-branch.** Verified that:
- documents always live in their source's branch (order → receipt, sales line → production order);
- Warehouse `00001` cannot open a Head Office order;
- a branch the member lacks cannot be selected;
- a `branchId` in a sales order body is refused.

No incorrectly accepted or refused cross-branch reference was found.

## 4. Demo personas and data

- Nine personas, unchanged. Matrix: [DEMO_ACCOUNT_MATRIX.md](DEMO_ACCOUNT_MATRIX.md). Every
  operational persona has a workspace, records in its branch, a task it can complete, and server
  refusals for what it cannot do.
- Catalog: [DEMO_DATA_CATALOG.md](DEMO_DATA_CATALOG.md). Every fixture state EP39 asked for exists,
  except a short-closed order *with* a remaining partial receipt (it exists as MO_EXEC's partial
  receipt plus a separate short-closed order).
- **Idempotency:** two consecutive seeds on a fresh database → 0 of 70 tables changed (row
  counts and content hashes), `integration unchanged`. Second seed on the dev copy → 0 rows
  changed of 898.

## 5. Real-stack verification

Real HTTP against the backend on port 2112, with a fresh scratch database, real demo personas
and real cookies. The `qa-ep39` suites are a scratchpad harness, not committed:

| Suite | Checks | Result |
| --- | --- | --- |
| Purchasing → Warehouse (PR → approve → PO → partial + final receipt, lots, movements, outstanding) | 12 | pass |
| Sales → Warehouse (draft → submit → confirm → FEFO → pick → pack → ship → dispatch once → deliver) | 11 | pass |
| Sales → Production (shortage, sales-demand order, BOM requirements, no phantom stock, Purchasing reads) | 6 | pass |
| Production → Warehouse (reserve, start, issue, usage, output, accept, partial FG receipts, double post, short close, no issue after close) | 14 | pass |
| Production → Sales (manual allocation of the made lot → delivery) | 3 | pass |
| Shortage → receipt → new availability (receive the awaited PO → reserve again → shortage gone) | 3 | pass |
| Executive read-only | 12 | pass |
| System Admin restrictions | 5 | pass |
| Accounting visibility | 4 | pass |
| Warehouse privacy (8 endpoints, no money; 5 refused) | 14 | pass |
| Security (branch isolation, IDOR, mass assignment, branch spoofing, no session) | 9 | pass |
| Races (sales vs production allocation; dispatch vs adjustment; double FG post; receipt reversal twice; issue vs allocation; FG receipt vs allocation; completion vs new issue) | 12 | pass — handled 409s, no 500 |
| Ledger reconciliation after everything (10 checks) | 10 | all zero |
| **Total** | **115** | **115 / 115** |

The server log had no unhandled error during the run. Company isolation across two companies is
covered by the backend suites, which seed a second company (`a.example` / `b.example`):
`sales-orders`, `sales-allocation`, `sales-fulfilment`, `warehouse`, `production*`, `permissions`,
`master-data` and `company*`.

## 6. Development database

Target verified: PostgreSQL `localhost:5432`, database `pdabliss_core_dev`, 24 migrations, up
to date. Before any write:

1. `pg_dump -Fc` backup: `C:/Users/User/pdabliss_backups/pdabliss_core_dev-before-EP39-20261106-105909.dump`
   (491,953 bytes, 71 table-data entries), verified with `pg_restore --list` and by a full
   restore into `pdabliss_core_devcopy39`, which matched dev row for row (747 rows).
2. Rehearsal on that copy:
   - only additive — every pre-existing row unchanged except the 11 document and 5 master-code
     counters;
   - the hand-made purchase request was preserved;
   - integrity checks all zero;
   - a second seed changed nothing.
3. Applied to dev with `npm --prefix backend run db:seed:demo` (dev was first re-checked
   unchanged since the backup). The result was identical to the rehearsal:
   - master data created 11, integration created 12;
   - no row removed or changed except the counters;
   - 151 rows added (747 → 898);
   - integrity checks all zero.

   A second seed on dev changed nothing. The one hand-made document (PR-202611-000007,
   `USER_CREATED_DEMO_RECORD`) is untouched. Migration status: 24 migrations, up to date (EP39
   adds none). Nothing was reset or dropped.

## 7. Gates

| Gate | Result |
| --- | --- |
| Prisma validate · migration status | valid · 24 migrations, up to date (no EP39 migration) |
| Backend typecheck · lint · format · build | pass · pass (an EP38.2 lint error fixed) · pass · pass |
| Backend tests | **485 / 485** (31 files), including the new EP39 seed tests |
| Seed idempotency | fresh DB: second seed 0 / 70 tables changed; dev copy and dev: 0 / 898 rows changed |
| Ledger reconciliation | 0 mismatches in all 10 checks (fresh seed, dev copy, dev, after the E2E races) |
| Real-stack E2E | **115 / 115** in 13 suites (final run on a fresh database; no unhandled server error) |
| Frontend typecheck · lint · format | pass · pass · pass |
| Frontend tests | **1,122 / 1,122** (59 files) |
| Build · prerender | pass · 108 pages + 3 shells, each with its own head |
| Performance | all JS **4,249.1 / 4,300 KiB** · initial JS **182.7 / 205 KiB** gzip · static HTML **526.9 / 560 KiB** · every budget within its cap |
| Browser QA (headless Chrome, real sessions) | **828 / 828**: 9 personas × 46 screens × TH / EN / ZH × 390 / 768 / 1024 / 1280 / 1440 / 1920. Each check: content loaded, one h1, no horizontal overflow, no unlabelled control, targets ≥ 24 px, no duplicate id, sidebar or Menu (never both), no API error, no redirect, no money on Warehouse screens |
| Keyboard / focus (in-app browser) | branch choice with arrow keys + Enter; **Change branch** returns to the page; focus moves to the content. Drawer focus trap and customer combobox keyboard covered by the frontend tests (verified in a browser in EP38.4) |
| Secret scan of the diff | clean (no password, key, token, connection string or session) |

## 8. Remaining demo limitations

- Manager steps are the owner's (no Sales / Warehouse Manager persona).
- Accounting shows supplier deposits only.
- Dates are relative to the day the seed first ran; on a long-lived database, "expires in 12
  days" becomes expired. The fixtures are never rewritten (by design).
- Fixture numbers differ between databases (monthly sequences continue).

## 9. Technical debt and production release blockers

- **Separation of duties** for purchase-request decisions (D5) and other self-approvals is a
  v1 design choice to revisit before customers use it.
- No invoicing, receivables, general ledger or customer payments (Accounting scope).
- Production deployment items remain open and out of EP39 scope:
  - production infrastructure, backups and monitoring;
  - real mail delivery at volume;
  - Cloudflare / DNS;
  - a security review of the full system;
  - load and performance testing of the API;
  - data retention and privacy policy.
- The demo sign-in bypass is development-only (refused with `NODE_ENV=production`, tested in
  `auth-demo-bypass`), but demo seeding must never be run against a customer database.
- JS headroom is small: ≈ 50.9 KiB under the 4,300 KiB cap. The next large screens must
  recover bundle space first.
