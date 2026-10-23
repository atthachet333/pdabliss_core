# EP08 — How CORE Works / Connected Operations Experience

**Date:** 2026-10-23 · **Owner:** PDA BLISS COMPANY LIMITED
**Baseline:** `26a589e038cd038a4da401b2c815e5dda7f685a6` — EP07 plus the approved FAQ
two-column revision, pushed to `origin/main` before EP08 started (local `main` ==
`origin/main`, clean tree).
**Commit:** `feat: create connected workflow experience (EP08)` — local only, **not pushed**

## Before EP08

- EP07 FAQ revision applied: heading on top, questions in two independent columns on desktop
  (reading order kept, one answer open at a time), one column below `lg`; test added.
- EP07 regression: typecheck, lint, format, 306 tests and build passed.
- Committed as `fix: show the pricing FAQ in two columns on desktop (EP07 revision)` and pushed
  with the EP07 commit (`f09e497..26a589e`).

## Scope

Public frontend only: the new `/how-core-works` page (th / en / zh) and the links that should
lead to it. Not touched: workflow engine, backend, database, Prisma, auth, RBAC, payments,
`/login`, `/app/*`, `workspaces/`, `prototype/`, `components/core`, `components/shell`
(empty diff against the baseline).

Design reference: [HOW_CORE_WORKS.md](HOW_CORE_WORKS.md).

## What was built

- **Workflow model** (`features/workflow/model.ts`): 16 illustrative steps on 7 lanes, five
  statuses, decisions → `buildRoute()`, information boundaries, handoff parts, approval chain,
  exceptions, human-error safeguards, role focus, trace and provenance, adaptation list.
- **Page** — hero + 12 chapters + CTA: one work many departments · work enters CORE ·
  responsibility routing & information boundaries · handoffs · decision points · approval &
  control · exceptions · human-error prevention · visibility by role · complete trace · replay ·
  adapt to your organization.
- **Visual language**: department lanes with the work as a glowing route (desktop), a
  numbered legend under the map, a vertical step stack on phones (focused + "show all").
- **Links**: วิธีการทำงาน mega menu items → page sections; highlight CTA and footer → page;
  Solutions "Workflow & Approval" → `#approval`; Enterprise "Custom Workflow" → `#adapt`;
  department-page CTA "ดูวิธีการทำงานของ CORE" → page; homepage Connected Flow → quiet link.
- **Shared utilities**: `Segmented` moved to `components/ui/Segmented.tsx` and `fill` to
  `lib/fill.ts`, so `/how-core-works` does not load the pricing copy. In grid layouts
  `Segmented` options may wrap (fixed a 3 px overflow at 320 px).

## Verification

### Gates (clean copy, `npm ci`)

| Package | npm ci | typecheck | lint | format | test | build |
| ------- | ------ | --------- | ---- | ------ | ---- | ----- |
| frontend | ✓ | ✓ | ✓ | ✓ (`format` changed nothing) | ✓ 337 / 337 (16 files) | ✓ |
| backend | ✓ | ✓ | ✓ | ✓ | ✓ 21 / 21 (4 files) | ✓ |

New `features/workflow/workflow.test.tsx` — 31 tests: main flow order; full default route;
stock-enough route (Purchasing/Accounting absent); optional Operations, Purchasing, Accounting
branches; QC hold and unresolved shortage pauses; Warehouse fields and Warehouse step words in
all locales free of money/currency; provenance; one H1 and twelve H2 chapters; departments
and flow order rendered; stock decision switching and reset; deposit → Accounting; QC hold
pause; handoff routing; approval waiting and continuation; exception raise and calm state;
five principles with the 100/80/−20 example; Warehouse-first information boundaries and
keyboard tab switching; role switcher by keyboard; trace history and provenance views; replay
next/previous/restart without autoplay; replay follows the chosen route; phone list collapse
toggle; adaptation links to pricing; reduced motion (no Play, no `animateMotion`); English and
Chinese without Thai; unique metadata; locale-preserving department, pricing and contact links;
mega-menu section links; homepage and footer links.

Existing tests changed only for new link targets: `header.test.tsx` (route list +
Workflow & Approval → `/how-core-works#approval`), `landing.test.tsx` (same).

### Live QA — headless Chrome, emulated viewports

- `/how-core-works` in th / en / zh at 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768,
  1280×720, 1440×900, 1920×1080, after interacting with replay, roles and trace: one H1, no
  horizontal overflow, no element outside the viewport, no target under 44 px, no console
  errors (after the `Segmented` wrap fix).
- Regression: `/`, `/features`, `/departments`, six department pages, `/solutions`,
  `/pricing`, `/how-core-works`, `/about`, `/contact`, `/privacy`, `/terms` in th / en / zh at
  390 and 1440 (96 checks): one H1, no overflow, no console errors. `/pricing` re-checked at
  320 / 375 / 390 in all locales after the shared-control change.
- Mega menu (live): วิธีการทำงาน → Workflow และ Approval opens `/how-core-works#approval` with
  the section in view; switching to English keeps it (`/en/how-core-works#approval`).
- Visual review at 1440 and 390 of hero, problem, work entering, routing, handoff, decisions,
  approval, exceptions, human error, roles, trace and replay. The first route map read like a
  line chart in half-width columns; it was rebuilt as full-width department bands with a
  numbered legend (see below).

### Bundle (vs. baseline `26a589e`)

| | Baseline | EP08 |
| - | - | - |
| Entry `index.js` | 737.8 KB (216.7 KB gz) | 738.5 KB (217.0 KB gz) |
| `HowCoreWorksPage` chunk | — | 106.9 KB (28.8 KB gz) |
| Shared `plans` chunk | — | 5.8 KB (2.3 KB gz) |
| `PricingPage` chunk | 141.7 KB (36.2 KB gz) | 136.4 KB (34.6 KB gz) |
| CSS | 180.7 KB | 184.6 KB |

No new dependencies, images, fonts or WebGL. The product previews in chapter 03 reuse the
existing lazy preview chunk.

### Text and scans

All changed / new files: valid UTF-8, no BOM, no U+FFFD, no mojibake, LF; no Traditional
Chinese characters in Chinese copy.

## Fixed during QA

- Route map looked like a chart: rebuilt with department bands, larger labels, step numbers and
  a visible numbered legend; the map now always gets the full width.
- Emphasised step labels overlapped on the role map → halo instead of labels.
- Human-error cards cramped in five columns → three.
- Long 16-row lists repeated on phones → focused lists with "show all steps".
- Replay next/previous used a stale index on rapid clicks → functional updates.
- 3 px overflow at 320 px (English trace toggle) → grid segmented options wrap.
- `/how-core-works` pulled the pricing copy through shared imports → utilities moved.

## Known limitations

- Illustration only: no workflow engine, real states, notifications or documents.
- No sticky scroll-driven diagram; each chapter carries its own view of the same workflow.
- The phone route lists collapse by default in exceptions, roles and replay.
- The replay's play state is not kept when the route changes; it continues from the clamped
  step.
- QA used headless Chrome with emulated viewports — no real devices, Safari, Firefox or
  screen-reader testing.
