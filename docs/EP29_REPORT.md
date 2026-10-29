# EP29 — Purchasing Request (PR) Foundation

**Status:** completed locally, awaiting owner review. **Not pushed. EP30 not started.**
Design and contracts: [PURCHASING_REQUEST.md](PURCHASING_REQUEST.md).

## Baseline

`main` at `e47afc6` (EP28.1), clean, equal to `origin/main`.

## What EP29 adds

- **Model** (additive migration `20261101090000_ep29_purchase_request`): `PurchaseRequest`,
  `PurchaseRequestLine`, `DocumentSequence`; enums `PurchaseRequestStatus` (DRAFT, SUBMITTED,
  APPROVED, REJECTED, CANCELLED) and `PurchaseRequestLineType` (ITEM, NON_ITEM). Company-bound
  foreign keys everywhere; CHECKs for number format, quantity > 0, line-type shape and decision
  consistency; indexes for company + status + updated, company + branch + status, company +
  requester, company + department + status. No price, cost, discount, tax, supplier or quote
  column (a test checks every column name).
- **Numbering** `PR-YYYYMM-NNNNNN`, company-wide, monthly, atomic `DocumentSequence` upsert in the
  creating transaction, immutable.
- **Transition policy** (`backend/src/purchasing/policy.ts`): one table decides edit / submit /
  approve / reject / cancel by status, authority and branch; transitions are conditional updates
  (one decision wins a race); line edits and submit lock the row and re-check DRAFT.
- **Permissions**: 9 new codes (`<dept>.purchase_requests.create` / `.approve` for Sales,
  Operations, Warehouse, Accounting; `purchasing.requests.cancel`), reusing
  `purchasing.requests.view` / `.create` / `.approve`; no new action words. The permission CHECK
  now lists 52 operational codes.
- **Visibility** server-side: own requests; non-drafts in permitted branches for Purchasing
  (queue) and for department deciders; drafts private; invisible = 404.
- **Lines**: ITEM (canonical item + base unit, server snapshots, active only, precision from the
  unit) and NON_ITEM (description, optional unit or unit text); exact decimal strings in and out.
- **Audit + timeline**; Company activity reads request events in words ("Purchase request
  PR-202610-000001 approved"); Platform Inspection redacts them like master-data events.
- **UI** (`/core/purchasing/*`, lazy chunk 34.6 KB): Purchasing workspace (real counts), list with
  views / filters / search / pages, create, draft editor (header + lines, item picker), in-place
  confirmations with reasons, timeline; CORE home links. TH / EN / ZH.
- **Demo**: four requests (DRAFT / SUBMITTED / APPROVED / REJECTED) across Warehouse, Sales,
  Operations and Purchasing personas, created once.

## Decisions to note

1. **Reuse, no synonyms**: submit ⊂ create, reject ⊂ approve (the decision). Documented in
   PERMISSION_ACTION_MATRIX.md.
2. **Department deciders**: a department manager decides their own department's requests by
   default (`<dept>.purchase_requests.approve`, MANAGE tier, deniable per member); Purchasing
   decides any department.
3. **No separation of duties in v1**: a decider may decide their own request (the scripted
   `purchasing.demo` scenario does). Easy to add in the policy table.
4. **Requester's own requests stay readable** while the membership is active even without branch
   access; actions on them need branch access.
5. **Snapshots**: item / unit at line write and refreshed at submit; branch and requester name at
   submit.
6. **System Admin** gets no Purchasing authority unless assigned (administration ≠ operations).

## JS budget (cap unchanged)

The first build was **4,300.9 / 4,300 KiB** — over. Without raising the cap: PR error messages
fall back to the Control Center copy already loaded with CORE (no duplicates), near-duplicate
labels were reused, one `SearchBox` and the responsive table-cell class are shared by Master Data
and Purchasing, and the create page and draft header share one form. Final: **4,297.5 / 4,300 KiB**
(EP28.1: 4,259.7; +37.8). Headroom is now **2.5 KiB** — not enough for EP30's UI.

**Owner decision needed before EP30:** the `/app/*` prototype workspaces are disabled in
production builds (the gate sends `/app` to the Account Portal) yet still shipped — measured
**≈ 134.6 KiB** of JS reachable only from them. Excluding them from production builds when
`VITE_ENABLE_PROTOTYPE` is not set would restore ample headroom without raising the cap. Not done
in EP29 because it changes what a production build contains.

## Gates

| Gate | Result |
| --- | --- |
| Backend Prisma validate · typecheck · lint · format · build | pass |
| Backend tests | **327 / 327** (22 files; 16 new in `purchase-requests.test.ts`, 1 new demo-PR test in `demo-personas.test.ts`) |
| Frontend typecheck · lint · format | pass |
| Frontend tests | **1040 / 1040** (46 files; 10 new in `purchasing.test.tsx`) |
| Build + prerender + verify | 108 pages + 3 shells |
| Perf | initial JS 183.3 / 205 gzip, largest route 63.8 / 72, all JS 4,297.5 / 4,300 KiB, static HTML 537.3 / 560 (public pages unchanged); PR code not in the public entry |

Timing note (not hidden): of six full frontend runs in EP29, three had one to three EP24 / EP25
tests (Company Control Center overview / locale, Platform Company Explorer — none touching EP29
code) exceed the 5,000 ms Testing Library wait under full-suite load; those files pass alone
(31 / 31) and the final full runs pass **1040 / 1040**. The same pattern was recorded in EP27 /
EP28; raising `asyncUtilTimeout` or splitting those tests is a candidate clean-up.

## Database / migration (scratch databases, dropped afterwards)

- **Fresh:** 10 migrations; demo seed twice → identical (users 11, members 9, assignments 6,
  branch grants 8, exceptions 1, units 3, categories 2, items 3, customers 1, suppliers 1,
  locations 3, purchase requests 4, lines 5).
- **EP28.1 → EP29 upgrade:** an EP28.1 checkout (`e47afc6`) migrated and seeded with all nine
  personas, plus an invitation and an extra exception. After the EP29 migration **all 22 existing
  tables are byte-identical** (companies, memberships, branch access, exceptions, invitations,
  users, credentials, audit, master data, code sequences …). Re-seeding with EP29 code creates the
  four demo requests once (second run "unchanged") and leaves memberships, grants, exceptions,
  invitations and master data unchanged.

## Real-stack QA (temporary API :1212 + Vite :1211 → scratch PostgreSQL)

**31 / 31 API checks:**

- `purchasing.demo`: two branches, raises from Purchasing, decides every department; selects
  Head Office; safe item picker; creates a draft; adds an item and a non-item line (server
  snapshots); precision enforced (BOX = 0 decimals); edits; submits (locked afterwards);
  approves; timeline created → submitted → approved; audit has created, two line additions,
  update, submit, approve — no purpose text; no financial key in any payload.
- `warehouse.demo`: Demo Branch only (auto-selected; Head Office refused); creates a Warehouse
  request in 00001; cannot raise for Purchasing; cannot approve its own; Head Office request
  invisible; suppliers 403.
- `sales.demo`: Head Office only; creates a Sales request; Demo Branch requests invisible; cannot
  choose Demo Branch.
- Executive reads, every mutation 403; System Admin has no Purchasing authority; a Purchasing
  Viewer reads the queue and cannot decide (and cannot see drafts).
- Second company: every read / mutation of a foreign request → not found; its list is empty.
- Concurrency: 10 simultaneous creates → 10 unique numbers; approve vs reject race 4 × → exactly
  one decision each time.

**Browser** (in-app Chromium, as `purchasing.demo`): branch selector → CORE → Purchasing
workspace (live counts) → new request → item line (precision error shown inline, focus kept) →
non-item line → submit and approve by keyboard (focus moves into the confirmation, then back to
the request heading; status announced) → timeline. **Fixed during QA:** the list was 116 px too
wide at 768 px (narrower purpose snippet; need-by column hidden only between 768 and 1023 px);
the details section heading read "Purpose" above a "Purpose" field (now "Request details").

## Responsive / accessibility

- Sweep of workspace, list, create and detail × 390 / 768 / 1440 / 1920: no page overflow, one
  `h1`, every control named, no broken ARIA references, no duplicate ids, scoped table headers.
  At 390 px the line editor and confirmation panel fit (358 px).
- Status is text plus a subtle tone (cancelled also struck through); errors in alerts, results in
  a polite live region; confirmations are labelled groups with Escape to back out.
- **axe not run** (not a project dependency; not loaded from a CDN).
- **Browsers:** in-app Chromium (full pass) and **Microsoft Edge 156 headless** (workspace EN,
  list TH, list ZH at 390, create EN — rendered, no JS errors, no overflow). **Firefox not
  installed** — not run.

## Regression

EP28 master data, EP28.1 personas (persona suite 14 / 14 with the demo-PR test), EP27
permissions (catalog / CHECK / labels tests), EP26 branch access, auth, public pages (prerender
unchanged; HTML 537.3 KiB), Platform (inspection redaction extended; operator 403 on requests) —
all in the passing suites above.

## Not done (by design)

Purchase orders, supplier quotations, deposits, invoices, payments, receiving, stock, lots /
expiry instances, FEFO, Sales orders, accounting posting, notifications / email, ordered or
remaining quantities.

## Known limitations

- JS headroom 2.5 KiB (owner decision above).
- No separation-of-duties rule (decider may decide their own request).
- One approval level; no configurable chains.
- Search uses `contains` (no trigram index).
- A purchase-request reason or purpose is not translated (by design).
- Pre-existing: the shared Company Control Center header overlaps at 390 px (EP25, not EP29).
- axe and Firefox not run.
