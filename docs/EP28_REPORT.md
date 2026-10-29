# EP28 — Operational Master Data Foundation

**Status:** completed locally, awaiting owner review. **Not pushed. EP29 not started.**
Design and contracts: [OPERATIONAL_MASTER_DATA.md](OPERATIONAL_MASTER_DATA.md).

## Baseline

`main` at `7ec08f1` (EP27), clean, equal to `origin/main`. On this machine the git-ignored
generated Prisma client was older than the EP27 schema (25 backend tests failed until
`prisma generate`); after regenerating, the baseline was **279 / 279** backend tests.

## What EP28 adds

- **Canonical, company-scoped** `Customer`, `Supplier`, `Item`, `Unit`, `ItemCategory` and
  **branch-scoped** `WarehouseLocation` (one record per business identity; nothing copied per
  department or branch). Domain name **Item** (covers finished goods, raw materials, packaging,
  consumables, non-stock).
- **Item model:** five types; base unit (required, active, same company); optional flat category;
  SKU / barcode (company-unique); `inventoryTracked`; `lotTracking` and `expiryTracking`
  (`NONE / OPTIONAL / REQUIRED`) with rules enforced by service **and** database CHECK
  (NON_STOCK untracked; untracked ⇒ no lot / expiry; expiry needs lot at least as strict).
- **Units** with precision 0–6 (exact-decimal contract for future quantities); **categories** flat.
- **Locations:** code unique per branch, optional parent in the same branch (composite FK), no
  cycles, ≤ 4 levels, one default per branch, branch must be active for changes.
- **Codes:** `CUS-` `SUP-` `FG-` `RM-` `PK-` `CS-` `NS-000001` from `MasterCodeSequence` — one
  atomic upsert in the same transaction as the record and its audit entry (never MAX + 1);
  entered codes allowed on creation but not in the generated form; codes immutable.
- **Lifecycle:** ACTIVE / INACTIVE (+ `deactivatedAt`, CHECK), reversible, audited; no deletes.
  Inactive units / categories stay on items but cannot be newly assigned.
- **Structure policy point** (`policy.ts`): base unit + tracking change only via
  `PUT /items/:id/structure`, audited `ITEM_STRUCTURE_CHANGED`, with `STRUCTURE_LOCKS` for later
  modules.
- **Permissions on the EP27 matrix:** 14 new codes (1 administration + 13 operational), domain
  aware, view READ / manage MANAGE; two guard functions (`requireAnyPermission`,
  `requireBranchPermission`) built on the same resolver; no role checks.
- **Warehouse-safe views:** explicit allow-list DTOs; no financial column exists on any master
  table; Warehouse has no supplier / customer permission.
- **Platform:** Platform Inspection now redacts master-data audit details (operators see that an
  event happened, never the code / name).
- **UI:** one **Master Data** entry in the Company Control Center (lazy chunk), six areas,
  server-side search / filters / sort / pages, record pages with edit, in-place deactivation
  confirmation, Unit & tracking form, TH / EN / ZH.
- **Demo seed:** PCS / KG / BOX, FG / RM, 3 items, 1 customer, 1 supplier, 3 locations — stable,
  idempotent, no prices.

## Policy decisions to note

1. Customer / supplier / item permissions are **COMPANY-scoped** operational codes (one record per
   company). The EP27 test asserting "every operational code is BRANCH" was updated to this
   contract; locations remain BRANCH-scoped.
2. Location permissions apply to the **branch named in the request**, checked against EP26 branch
   access each time (not the session's selected branch) — so the Master Data area can list several
   permitted branches. `company.master_data.manage` reaches every branch, like branch / people
   administration.
3. Items are managed by **Operations managers** (`operations.items.manage`) and company
   administration; Sales / Purchasing / Warehouse managers read items. Exceptions can extend this
   only inside an assigned department (EP27 rule).
4. Codes are **immutable** after creation (no correction flow in EP28).
5. The EP27 permission CHECK was dropped and re-added as a strict superset (the only change to an
   existing object; every stored exception stays valid).

## Gates

| Gate | Result |
| --- | --- |
| Backend Prisma validate · typecheck · lint · format · build | pass |
| Backend tests | **297 / 297** (20 files; 18 new in `master-data.test.ts`; `permissions.test.ts` 2 assertions updated for EP28) |
| Frontend typecheck · lint · format | pass |
| Frontend tests | **1019 / 1019** (44 files; 12 new in `master-data.test.tsx`) |
| Build + prerender + verify | 108 pages + 3 shells |
| Perf budget | within budget (below) |

One full frontend run failed the EP25 test "speaks Thai, English and Simplified Chinese" at
5,025 ms while the machine was loaded; it passed alone (1.6 s) and in two later full runs — the
load-sensitivity EP27 already documented, not an EP28 change.

## Performance (same machine, EP27 baseline rebuilt for comparison)

| Budget | EP27 | EP28 | Cap |
| --- | --- | --- | --- |
| All JS (raw) | 4,210.9 KiB | **4,259.4 KiB** (+48.5) | 4,300 |
| Initial JS (gzip) | 184.6 | 183.3 | 205 |
| Largest route (gzip) | 63.9 | 63.8 | 72 |
| Static HTML (raw) | 545.6 | 537.7 | 560 |

Master Data is its own 47.6 KB chunk (`MasterDataArea-*.js`), imported only by the Company Control
Center chunk; the public entry closure does not contain it. All 111 prerendered HTML files are
identical to EP27 apart from chunk hashes and one fewer `modulepreload` (the shared `cn` helper
now lives in a shared chunk), which is the −7.9 KiB HTML. **Caps unchanged.** Remaining JS
headroom: 40.6 KiB.

## Database / migration (scratch PostgreSQL cluster in the session scratch directory; dropped)

- **Fresh:** 9 migrations apply; demo seed creates 13 master records; a second seed changes
  nothing (identical counts and counters).
- **EP27 → EP28 upgrade:** an EP27 checkout (`7ec08f1`) migrated and seeded, plus an intent
  invitation (Warehouse, branch 00001) and a DENY exception; after the EP28 migration **every row
  of 15 tables** (Company, CompanyMember, MemberBranchAccess, MemberPermissionOverride, Invitation,
  Branch, Membership, Department, Subscription, User, UserCredential, AuditLog, Session,
  AuthAuditEvent, PlatformRoleAssignment) is **byte-identical**; re-seeding with EP28 adds the
  master data and leaves memberships, branch access, exceptions and invitations unchanged.
- The owner's `pdabliss_core_dev` and ports 1111 / 1112 were not touched.

## Real-stack QA (temporary API :1212 + Vite :1211 → scratch PostgreSQL, dev mail sink)

**41 / 41 API checks** with real sessions (demo bypass for seeded accounts, emailed codes from the
mail sink for others): generated codes after the seeded ones (CUS-000002, SUP-000002, FG-000002,
NS-000001), duplicate barcode refused, tax-ID search, edit, deactivate → reactivate, audit present
without tax ID / phone; a second company cannot read, list, reference or use the demo company's
records or branch; **Warehouse Staff** sees items / units / categories / its branch's locations
only, receives no financial key and no supplier data in any payload, gets 403 on suppliers and
customers (by list and by id), `BRANCH_NOT_ALLOWED` on the Head Office location, 403 on every
mutation; **Viewer** reads and every mutation is 403; **Executive** reads, cannot create;
**System Admin** manages, has no platform authority and cannot read another company's record;
**platform operator** 403 on master data and Platform Inspection shows master-data events with
empty details.

Browser (in-app Chromium): sign-in → Master Data; item list / record / Unit & tracking (server
rule shown as an alert); keyboard-only deactivate → focus lands on Confirm → Enter → status
changes (fixed during QA: focus now returns to the status button afterwards); Warehouse Staff
sees four areas, read-only, no create.

**Fixed during QA:** codes wrapped mid-code at 1440 px (now `nowrap`); at 390 px the mobile rows
were 465 px wide (a native select's longest option widened the grid tracks — invisible to a
plain overflow check because the mobile layout viewport grew to 514 px); all Master Data grids
now use `minmax(0, 1fr)` tracks.

## Responsive / accessibility

- Automated sweep, 8 surfaces (6 lists, an item record, the create form) × 390 / 768 / 1440 /
  1920: layout viewport equals the device width, no page overflow, one `h1`, every control named,
  no broken ARIA references, no duplicate ids, table headers scoped. The only off-screen elements
  are tabs inside the intentionally scrollable sub-menu.
- Tables on ≥ 768 px; labelled stacked rows below. Tracking in words (Stock · Lot · Required ·
  Expiry · Optional), never colour alone. Status as text. Errors in `role=alert`, results / saves
  in a polite live region, field errors tied with `aria-describedby`, first invalid field focused.
- **axe not run:** axe-core is not a project dependency and is not loaded from a CDN.
- **Browsers:** in-app Chromium (full pass) and **Microsoft Edge 156 headless** (4 checks: EN
  items 1440, TH customers, ZH locations, EN items 390 — rendered, no JS errors, no overflow).
  **Firefox is not installed** on this machine — not run.

## Not changed

Public pages (HTML identical modulo chunk names), auth flows, Platform Control Center code
(only the inspection payload redaction), EP26 branch / member administration, EP27 resolver
semantics.

## Known limitations

- Codes cannot be corrected after creation (deactivate and recreate).
- Search uses case-insensitive `contains` within one company (no trigram index yet).
- Unit precision and item structure are editable until later modules register their locks.
- No CSV import / export, unit conversion, category hierarchy, location types, barcode scanning,
  prices, costs, credit or balances (by design).
- A tracking-rule refusal is shown as a form message, not attached to one field.
- Pre-existing (EP25 shell, not EP28): at 390 px the Control Center header's "Enter CORE" button
  overlaps the company tile.
- axe and Firefox not run (see above).
