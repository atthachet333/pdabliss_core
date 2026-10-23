# EP07 — Packages & Subscription Experience

**Date:** 2026-10-23 · **Owner:** PDA BLISS COMPANY LIMITED
**Baseline:** `f09e497b1b5fc2f4724f8e1c2b7b2d033bb3569c` (EP06, pushed to `origin/main` with the
owner's approval before EP07 started; local `main` == `origin/main`, clean tree)
**Commit:** `feat: create CORE package and subscription experience (EP07)` — local only,
**not pushed**

## Scope

Public frontend only: `/pricing` (`/en/pricing`, `/zh/pricing`) redesigned as the CORE package
and subscription experience, the แพ็คเกจ mega menu pointed at it, and a small contact-form
enhancement (`?interest=plans` pre-selects the packages topic).

Not touched: billing backend, payment gateway, subscription database, checkout persistence,
invoices, plan enforcement, auth, RBAC, `/login`, `/app/*`, `workspaces/`, `prototype/`,
`components/core`, `components/shell`, backend, Prisma (empty diff against the baseline).
The homepage stays pricing-light (no pricing section added).

Design reference: [PRICING_AND_PACKAGES.md](PRICING_AND_PACKAGES.md).

## What was built

- **Single source of truth** — `features/pricing/plans.ts`: four plans with every fact
  (price, department limit, Executive access, storage, workflow, approval, automation, roles,
  audit, notifications, reports, custom reports, dashboard, API, import/export, support, CTA),
  the annual policy and `annualPrices()`, department rules (`adjustDepartments`,
  `toggleDepartment`), add-on availability (derived from plan facts where they overlap) and the
  deterministic `recommendPlan()`.
- **Page** (13 sections): editorial hero with the four-layer capability visual → package
  explorer (tablist, billing toggle, expanded plan) → one company / every branch → annual
  relationship → find your package → configurator + future purchase flow → grouped comparison →
  add-ons → onboarding & support → Enterprise consultation flow → CORE Early Access → FAQ →
  closing CTA.
- **Copy** in Thai, English and Simplified Chinese; numbers come only from `plans.ts`.
- **URL state**: `?plan=<id>` (safe fallback to Business; `#plan-<id>` understood).
- **Mega menu**: plan items → `/pricing?plan=<id>#packages`; the note now reads
  "คิดค่าบริการต่อบริษัท · ทุกสาขาอยู่ใน Workspace เดียว" (the "sample structure · price to be
  confirmed" note was retired). The menu itself stays price-free.
- **Removed**: the EP00 sample plan data (`features/landing/plans.ts`) and `PlansGrid.tsx`,
  which were used only by the old pricing page.

## Approved facts as implemented

| | Starter | Business | Professional | Enterprise |
| - | - | - | - | - |
| Monthly | ฿399 | ฿699 (แนะนำ) | ฿999 | ขอใบเสนอราคา |
| Year 1 | ฿4,788 | ฿8,388 | ฿11,988 | — |
| Year 2 (pay 10, use 12) | ฿3,990 | ฿6,990 | ฿9,990 | — |
| Year 3+ (−15 %, ≈ nearest 10) | ≈ ฿4,070 | ≈ ฿7,130 | ≈ ฿10,190 | — |
| Departments | 2 | 4 | all 6 standard | all + custom |
| Executive | no | yes | yes (full) | yes |
| Storage | 3 GB | 10 GB | 30 GB | as agreed |
| Reports | basic | advanced | advanced + Custom Reports | custom + dashboards |
| API | not included | add-on | included | included + custom scope |

One company per subscription, all branches included, no fixed user limits, no free plan, no
VAT statement. Lot / Batch, Expiry, Stock Age and FEFO come with Warehouse in every package.

## Verification

### Gates (clean copy, `npm ci`)

| Package | npm ci | typecheck | lint | format | test | build |
| ------- | ------ | --------- | ---- | ------ | ---- | ----- |
| frontend | ✓ | ✓ | ✓ | ✓ (`format` made no changes; `format:check` clean) | ✓ 306 / 306 (15 files) | ✓ |
| backend | ✓ | ✓ | ✓ | ✓ | ✓ 21 / 21 (4 files) | ✓ |

New `features/pricing/pricing.test.tsx` — 43 tests: four plans and exact prices; Business
recommended; Enterprise without price and in quote mode; department limits 2 / 4 / all /
custom; Starter without Executive (logic and UI, with reason); all branches; storage
3 / 10 / 30 / agreed; API, reporting, workflow, support tiers; annual year 1 / 2 / 3+ values
including the exact and rounded year-3 figures; billing toggle updates prices; no free plan,
VAT, countdown or invented proof; Demo CTA; monthly cancellation, upgrade / downgrade copy;
add-ons without prices; migration statement and note; training and support model; department
enforcement and safe adjustment on plan change; add-ons never summed; future purchase flow
without payment fields; recommendation logic and UI; grouped comparison consistent with plan
data; FAQ answers from plan data; FAQ split into two columns in reading order; URL state (load, fallback, hash, write); English and Chinese
rendering with no Thai; unique metadata per locale; localized mega-menu links; contact topic
pre-selection; reduced motion.

Existing tests changed: `test/routes.test.tsx` (the "sample structure, no prices" test now
checks the four approved packages); `components/layout/header.test.tsx` (the dead-link check
ignores the `?plan=` query); `i18n/site-language.test.tsx` (the Thai-leak helper treats the
baht sign ฿ as a currency symbol, which the brief allows in English).

### Live QA — headless Chrome, emulated viewports

- `/pricing`, `/en/pricing`, `/zh/pricing` at 320×568, 375×667, 390×844, 430×932, 768×1024,
  1024×768, 1280×720, 1440×900 and 1920×1080, with every comparison group and FAQ item open:
  one H1, no horizontal overflow, no element outside the viewport, no interactive target under
  44 px, no console errors.
- Regression: `/`, `/features`, `/departments`, the six department pages, `/solutions`,
  `/pricing`, `/about`, `/contact`, `/privacy`, `/terms` in th / en / zh at 390 and 1440
  (90 checks): one H1, no overflow, no console errors.
- Mega menu (live, English): Packages → Professional opens `/en/pricing?plan=professional#packages`
  with Professional selected and the explorer in view; selecting another plan updates the URL
  without moving the page.
- `/login` renders its form; `/app/warehouse` signed out redirects to `/login` as before.
- Reduced motion: hero and explorer render their final state (th 1280, zh 1280).

### Bundle (vs. baseline `f09e497`)

| | Baseline | EP07 |
| - | - | - |
| Entry `index.js` | 738.0 KB (216.8 KB gz) | 737.8 KB (216.8 KB gz) |
| `PricingPage` chunk | 11.6 KB (4.1 KB gz) | 141.6 KB (36.1 KB gz) |
| All JS | 2,271 KB (666 KB gz) | 2,401 KB (698 KB gz) |
| CSS | 174.3 KB | 180.5 KB |
| JS chunks | 45 | 45 |

No new dependencies, images, fonts or WebGL. The pricing chunk loads only on `/pricing`; most
of it is the three-locale copy. The Vite large-chunk warning pre-dates EP07 (entry chunk).

### Text and scans

All 25 changed / new files: valid UTF-8, no BOM, no U+FFFD, no mojibake, LF; no Traditional
Chinese characters in Chinese copy.

## Fixed during QA

- Horizontal overflow on phones (English 320–430, Thai 320): the "Recommended" badge could not
  wrap in a half-width tab, and grid sections without a base column template let wide children
  stretch them → badge row wraps; every section grid has `grid-cols-1` below `lg`.
- Plan selectors meant to be 2 × 2 on phones rendered 3 + 1 (`cn` does not merge display
  classes) → `Segmented` uses the caller's grid layout.
- Letter-spaced uppercase styling on Thai labels → removed.
- Add-on cards were too tall → availability grouped into short "included / add-on / project
  scope" lines.
- Thai H1 orphaned its last word → line break rebalanced.
- `scrollIntoView` guarded for environments without it.

## Owner revision (after visual review)

- FAQ: heading across the top and the questions in two independent columns on desktop
  (first half left, second half right, reading order preserved; one answer open at a time).
  One column below `lg`. Verified at 1440 (th), 1280 (zh) and 390 (en): no overflow.

## Known limitations

- Presentation only: no billing, payment, account or workspace creation; prices and rules are
  not enforced anywhere.
- Add-ons, extra users, extra storage and extra departments have no published prices and route
  to the team.
- The billing-cycle choice is not stored in the URL; the selected plan is.
- Switching language keeps the path and hash but not the `?plan=` query (existing EP05
  language-switch behaviour), so the selection returns to Business after a language change.
- Contact form remains client-side only (EP00 behaviour); quotation and demo requests are not
  sent anywhere yet.
- QA used headless Chrome with emulated viewports only — no real devices, Safari or Firefox,
  and no screen-reader testing.
