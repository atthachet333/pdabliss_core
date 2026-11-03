# EP30 — Purchase Order, Deposit and Pending Receive Foundation

**Status:** completed locally, awaiting owner review. **Not pushed. EP31 not started.**
Design and contracts: [PURCHASE_ORDER.md](PURCHASE_ORDER.md).

## Baseline

`main` at `2f6c696` (EP29) plus the transferred work-in-progress commit `e57ce31` ("wip: continue
EP30 bundle cleanup and purchase order foundation"), continued as is — no reset, no history
rewrite. The WIP already held the bundle cleanup, the schema / migration, the service, policy,
views, routes, demo fixtures, the three screens and most tests. On this machine it passed every
gate (backend 344 tests, frontend 1,051) before EP30 continued.

## 1. Bundle cleanup (the first approved EP30 task)

Normal production builds no longer ship the disabled `/app` prototype workspaces.

- `src/app/router.tsx`: `PROTOTYPE_BUILD = import.meta.env.DEV || VITE_ENABLE_PROTOTYPE === 'true'`
  is folded to a constant, so a normal build never reaches `import('./appRoutes')`; `/app` gets
  `prototypeOffRoutes` (0.6 KiB) — the same `PrototypeGate`, the same redirects.
- `vite.config.ts`: one `shell` chunk group for the entry's static graph. Without it the removal
  split the entry into eight preloaded files and static HTML rose to ≈ 604 KiB.
- `scripts/prerender.mjs`, `scripts/verify-prerender.mjs`: `app.html` preloads the workspaces chunk
  only when the build has one.
- Prototype source stays in the repository; on in `npm run dev` and with `VITE_ENABLE_PROTOTYPE=true`.

| Measure | KiB |
| --- | --- |
| All JS after EP29 | 4,297.5 |
| All JS after the cleanup alone (WIP session) | 4,118.3 |
| Recovered | ≈ 179.2 |
| **All JS, final EP30** | **4,194.8 / 4,300** |
| Initial JS (gzip) | 182.6 / 205 |
| Static HTML | 528 / 560 (111 files) |

EP30's own UI therefore costs ≈ 76.5 KiB raw, leaving 105.2 KiB of headroom. Lazy chunks:
`OrdersArea` 29.4 KiB (8.1 gz), `DepositsArea` 8.9 (3.0), `ReceiveArea` 5.7 (2.2), shared
`orderCopy` 24.1 (7.6) and `orderParts` 2.9 (1.3); none is loaded by a public page.

**Verified on real builds** (served statically against the QA API):

- normal build — no `appRoutes` or prototype workspace chunk exists; anonymous `/app` and
  `/app/warehouse/expiry` → `/login?next=…`; signed in → the person's home (`/company` for the
  Purchasing persona), no prototype chunk requested;
- `VITE_ENABLE_PROTOTYPE=true` build — `appRoutes` present (4,372 KiB in total: the cap applies to
  normal builds) and `/app` → the Executive prototype workspace; `npm run dev` → `/app/warehouse`
  renders the prototype.

## 2. What EP30 adds

- **Model** (additive migration `20261102090000_ep30_purchase_order`): `PurchaseOrder`,
  `PurchaseOrderLine`; enums `PurchaseOrderStatus`, `PurchaseOrderDepositType`,
  `PurchaseOrderDepositStatus`. Exact `numeric` money and quantities, CHECKs for number format,
  totals arithmetic, deposit and status consistency, line shape; composite foreign keys bind every
  order and line to one company and one branch (request, request line, supplier, item, unit,
  members). Two unique indexes added on the EP29 tables as FK targets; the permission CHECK widened
  (superset).
- **Numbering** `PO-YYYYMM-NNNNNN` from `DocumentSequence` (`PO:YYYYMM`), atomic upsert, immutable.
- **Lifecycle** DRAFT → issue → WAITING_DEPOSIT → confirm / waive → PENDING_RECEIVE (or straight
  to PENDING_RECEIVE without a deposit); cancel from DRAFT (reason optional) or after issue (reason
  required, Purchasing Manager / Owner). One policy table, conditional updates, no status PATCH.
- **Request → order**: partial and repeated ordering, any number of suppliers per request, ordered /
  remaining derived (never stored, requested never changed), cancelled orders release. Issue locks
  the order, then the request rows (share) and request lines (update, sorted) before reading what is
  already ordered.
- **Money**: line price / discount / tax rate; the server computes every amount (client totals are
  refused); deposit as amount or percentage, the amount always stored.
- **Snapshots**: supplier identity and document data, branch, item and unit refreshed at issue and
  frozen.
- **Three audiences, three allow-listed responses**: Purchasing (full), Accounting (amounts +
  deposit), Warehouse (quantities only); Executive gets a read-only summary.
- **Screens** (TH / EN / ZH): Purchasing workspace tiles, order list, create from request, order
  page (draft editor, issue / cancel, timeline), request progress; Accounting deposit queue and
  detail; Warehouse Pending Receive list and detail.
- **Demo**: a fifth approved request and four orders (DRAFT, WAITING_DEPOSIT, PENDING_RECEIVE,
  CANCELLED), created once each.

## 3. Completed in this session (on top of the WIP)

- **Warehouse handoff contract**: lines now carry `orderedQuantity`, `pendingQuantity` and the
  item's `lotTracking` / `expiryTracking`; shown on the Warehouse detail; allow-list and leak tests
  extended.
- **Timeline and audit**: new `PURCHASE_ORDER_WAITING_DEPOSIT` and `PURCHASE_ORDER_PENDING_RECEIVE`
  events (issue, confirm, waive, demo seed), ordered by lifecycle within one transaction; the order
  timeline reads Created → Issued → Waiting for deposit → Deposit confirmed / waived → Pending
  receive. Company activity now reads every order event in words ("Purchase order PO-… issued").
- **Zero deposit**: a percentage that rounds to 0.00 made issue fail on a database CHECK (500); it
  is now `422 PO_DEPOSIT_ZERO`.
- **Lists**: the order list gained order date and updated columns; the Accounting and Warehouse
  queues gained server paging ("Show more") instead of a silent 50-row cut.
- **Focus**: cancelling an issue / cancel / deposit confirmation now returns focus to the order
  heading (it was lost to the page).
- **Touch targets**: the workspace's section links are 44 px tall on phones.
- **Demo**: fixtures carry an expected delivery date.
- **Docs**: PURCHASE_ORDER.md (§13 EP31 contract, §14 decisions), PURCHASING_REQUEST.md,
  PERMISSION_ACTION_MATRIX.md, OPERATIONAL_MASTER_DATA.md, FRONTEND_BACKEND_HANDOFF.md,
  PERFORMANCE.md, README.

## 4. Decisions to note

1. **Issue = `purchasing.orders.approve`** (existing EP27 code); waive shares
   `accounting.deposits.confirm`. No synonyms.
2. **Tax**: one exclusive rate per line, half-up rounding per line, totals = sums of rounded lines.
   No tax codes, inclusive prices, withholding or filing.
3. **Drafts reserve nothing**; issue decides. A draft may lack a supplier.
4. **Lot / expiry requirement is live** (the item's current EP28 setting), not snapshotted —
   receiving enforces today's rule.
5. **Executive** reads orders (summary), deposits and pending receive; changes nothing.

## 5. Verification

| Gate | Result |
| --- | --- |
| Backend Prisma validate · typecheck · lint · format · build | pass |
| Backend tests | 23 files, 346 tests, pass (the purchase-order suite: 20) |
| Frontend typecheck · lint · format | pass |
| Frontend tests | 48 files, 1,051 tests, pass |
| Frontend build + prerender | 108 pages + 3 shells verified |
| Performance budget | within budget (numbers above) |

**Migration**, on scratch PostgreSQL 18:

- fresh database → all 11 migrations, demo seed, second seed "unchanged", `prisma migrate diff`
  empty;
- **EP29 → EP30 upgrade**: EP29 code (worktree at `2f6c696`) migrated and seeded, then the EP30
  migration applied — row counts (users 11, companies 1, members 9, branches 2, overrides 1,
  suppliers 1, items 3, units 3, requests 4, request lines 5) and md5 hashes of every request,
  request line, member and supplier row **identical** before and after; the EP30 seed then adds one
  request and the four orders; a second seed changes nothing.

**Real-stack QA** (real API, scratch database, real sessions of the seeded personas, 59 checks,
all pass): 100 → 60 (ordered 60, remaining 40) → 40 (fully ordered) with two suppliers; 41 of 40
refused; cancel releases 60; supplier rename / deactivation does not change an issued order;
inactive supplier refused; totals 2,469.00 − 19.00 + 171.50 = 2,621.50, 30 % deposit 786.45;
Purchasing cannot confirm or waive; Accounting confirms (who / when / reference) → Pending
Receive, cannot edit, issue or cancel; Warehouse JSON keys contain no price, discount, tax, total,
amount, deposit, currency, terms or note, and no such value; waive needs a reason and is not a
confirmation; zero deposit 422; 12 server-owned fields refused on create / PATCH, totals and
snapshots refused on lines, non-string money refused; persona matrix (owner, admin, executive,
sales, warehouse, purchasing, accounting) as designed — System Admin has no PO, deposit or receive
access. **Concurrency**: 12 simultaneous creates → 12 distinct consecutive numbers; **7 + 7 of a
remaining 10 issued at once, 25 rounds — every round exactly one wins, ordered stays 7**; issue vs
cancel, 10 rounds — always consistent, never a 500.

**UI** (normal production build, headless **Edge 156** and **Chrome 156**, 75 checks each, no JS
error): draft from a request, price edit, percentage deposit, keyboard issue (Enter opens the
confirmation, Escape backs out with focus on the heading, Enter issues), timeline, request progress
(requested / ordered / remaining, order link, status still Approved), Accounting confirm; Purchasing
(workspace, list, new, draft, issued), Accounting (queue, detail) and Warehouse (queue, detail) at
**390, 768, 1440 and 1920 px** — no horizontal overflow, one `h1`, every control labelled, no raw
keys or `null` — and in **TH / EN / ZH** at 1440; mobile line editor without overflow; Warehouse page
without any money word and without a receive action. **Firefox** is not installed here (not
tested). axe is not installed locally; checks were structural and keyboard-based.

## 6. Known limitations

- No goods receipt, received quantity, lot, expiry instance, stock, movement, putaway or FEFO
  (EP31).
- "Cancel only before any receipt" holds trivially until receipts exist.
- No supplier acknowledgement, PO document / PDF, email to supplier, invoice or payment.
- No FX, inclusive tax, withholding tax or header discount.
- No separation of duties between creating and issuing an order.
- Firefox and axe not run (not available locally).

## 7. EP31 starts from

The Warehouse Pending Receive contract in [PURCHASE_ORDER.md §13](PURCHASE_ORDER.md#13-the-ep31-contract):
PO, branch, supplier operational identity, item, unit, ordered / pending quantity, expected date,
lot requirement, expiry requirement — and no money.
