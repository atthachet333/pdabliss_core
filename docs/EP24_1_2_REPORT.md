# EP24.1.2 — Platform Control Center UX Rework (operator first)

**Date:** 2026-10-27 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline (local, not pushed):** `db4bf32` (S2 chapter) on top of `5d75a26` EP24.1, `5e9c498`,
`3c43feb`, `90fc8e6` EP24.

**Completion commit:** `feat: rework CORE platform control center for operator workflows
(EP24.1.2)` — local only, **not pushed**. EP25 not started.

## 1. Why

The owner reviewed `/platform` and found it hard to scan: equal-weight sections, customer and demo
data mixed (0 customers with a demo company below), unclear account counts, session information too
prominent, too much vertical scanning. EP24.1.2 reorganises the screen around one question:
**what does the Platform Owner need to see or do right now?**

## 2. Operator-first hierarchy

| Level | Content |
| --- | --- |
| Top bar | Overview · Companies · Activity · Operators (Owner only), quick company search, needs-attention count, authority, sign out |
| 1 | **Real customers** band: customer companies · active · pending activation · suspended · customer accounts — each a link to the customer-only explorer view. Beside it, **counted separately**: demo (companies · accounts) and the platform team (Owner · Admin) |
| 1 | **Customer path** strip: registered (no company) → company setup → pending activation → active → suspended, real counts; a one-line state when nobody has signed up |
| 2 | **Latest customer companies** (5, demo excluded) next to **Needs attention** — both in the first screen at 1440 |
| 3 | Key activity (sample), **Demo environment** (striped, tagged, isolated), Accounts & operators |
| 4 | Your session and devices — folded by default |

On phones the order is: metrics → attention → latest customers → demo → activity → accounts →
session. Wide screens use two independent stacks (no row gaps) within a 120 rem frame.

## 3. Metric definitions (server-side)

- **Customer company:** `Company.isDemo = false`. **Demo company:** `isDemo = true` (never by name).
- **Customer account:** no platform role **and** not a member of a demo company (includes verified
  people who have not created their company yet).
- **Demo account:** member of a demo company. **Platform operators:** platform role holders,
  by role.
- Active / pending / suspended: customer companies by `Company.status`.
- No revenue, MRR, ARR, conversion, growth or scores — billing does not exist yet.

## 4. Needs-attention rules (`ATTENTION_RULES`, one definition for list and badge)

| Item | Counted in badge | Opens |
| --- | --- | --- |
| Set up, awaiting activation (PENDING + onboarding complete) | yes | explorer, customer-only filter |
| Company setup incomplete | yes | explorer |
| Suspended companies | yes | explorer |
| Suspended customer accounts | yes | — |
| Verified, no company yet | yes | — |
| Email not verified | shown, not counted (their next step) | — |

Only non-zero items render; with none, a one-line "Nothing needs the platform team right now".

## 5. New / changed routes and APIs

| | Change |
| --- | --- |
| `GET /api/v1/platform/overview` | `customerAccounts` now excludes demo accounts; adds `demoAccounts`, `operators`; suspended-accounts attention excludes demo |
| `GET /api/v1/platform/companies` | `demo=exclude|only` filter (default: both) |
| `GET /api/v1/platform/activity` | new: one timeline of security and company events (`scope=all|security|company`, `limit` ≤ 100), safe fields only (no IPs, hashes, raw metadata) |
| `/platform/activity` | new page: the full timeline with three views |
| `/platform/operators` | new page: Owner above Admins, read-only; an Admin sees the reason (API is owner-only) |
| Explorer | new "Data" filter (customers only / demo only), URL-held |

Unchanged: Company Explorer search / filters / cursor paging / keyboard rows; Platform Inspection
(band, read-only, audited) — re-verified.

## 6. Verification

- **Backend:** 16 files / 211 tests (+3: scenario A separation, scenario B lifecycle counts,
  activity timeline + scope + customer 403). Typecheck, lint, format, build.
- **Frontend:** 39 files / 912 tests (platform suite rewritten: scenario A, scenario B, operator
  areas by role, header search, TH / EN / ZH, customer redirect from all five platform routes,
  error kinds, activity scopes, operators by role). Typecheck, lint, format, build + 105 / 3
  prerender, perf.
- **Real-stack browser QA** (fresh scenario databases; nothing added to a normal dev database):

  | | Chrome | Edge |
  | --- | --- | --- |
  | Scenario A — 0 customers, 1 demo company, 4 demo accounts, Owner + Admin | 56/56 | 56/56 |
  | Scenario B — 5 customers (active, pending ×3 incl. Enterprise setup incomplete, suspended; Business / Professional / Enterprise) + demo | 58/58 | 58/58 |

  Each run: headline figures equal database counts; demo only in the demo environment; latest =
  min(5, customers); empty states (A) / attention + badge (B); customers, attention and latest start
  in the first 1440 screen; session folded; header search → explorer; customer-only filter; inspection
  band; activity and operators pages; admin without Operators; EN / ZH without Thai UI text;
  320–1920 px no overflow, axe clean at 390 / 1440 / 1920, targets ≥ 24 px; no console errors.
  Firefox not available on this Windows build (unchanged).
- Defects found in QA and fixed: metric tiles and accounts used invalid `<dl>` nesting (now labelled
  lists), event codes below contrast, company links in activity distinguishable by colour only (now
  underlined), header wrapping at 1440, row gaps between zones, raw codes / emails breaking mid-word.
- **Public bundle:** platform code stays in lazy routes; the homepage entry gains only the two new route paths (initial JS 180.7 → 181.0 kB, CSS 46.5 → 47.1 kB, within budget).

## 7. Deferred

- Operator actions on companies (suspend / reactivate / close / plan change), billing data,
  operator grant / revoke UI (the API exists, owner-only with step-up), impersonation — none built.
- Activity paging beyond the latest 100; per-company security drill-down lives in Inspection.
- Firefox / Safari / real devices.

## 8. Status

- **Push status:** NOT PUSHED.
- **EP25:** NOT STARTED.
