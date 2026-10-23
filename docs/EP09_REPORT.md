# EP09 — Solutions Experience

**Date:** 2026-10-23 · **Owner:** PDA BLISS COMPANY LIMITED
**Baseline:** `ab990eb21e18cc7dc39efdad2875229cad610e64` — EP08, already on `origin/main`
(`git push` reported "Everything up-to-date"); local `main` == `origin/main`, clean tree.
**Commit:** `feat: create operational solutions experience (EP09)` — local only, **not pushed**

## Scope

Public frontend only: `/solutions` rebuilt (th / en / zh) and the links that should lead to it.
Not touched: backend, workflow engine, database, Prisma, auth, RBAC, notifications,
integrations, payments, report engine, `/login`, `/app/*`, `workspaces/`, `prototype/`,
`components/core`, `components/shell` (empty diff against the baseline).

Design reference: [SOLUTIONS_EXPERIENCE.md](SOLUTIONS_EXPERIENCE.md).

## What was built

- **Solution model** (`features/solutions/model.ts`): nine solutions with anchors, departments,
  How CORE works chapter, tone and map placement; map geometry; illustrative quantities;
  FEFO allocation; approval, lifecycle, gates, lenses and navigator lists.
- **Page**: pain-first hero (with the six causes), problem map, nine solution stories each with
  a different visual logic, navigator, CTA (How CORE works → departments → demo).
- **Links**: โซลูชัน mega menu → story anchors; homepage Complexity chapter → `/solutions`.
- **Tests**: `solutions.test.tsx` (28 tests); two existing tests updated for new targets and
  one race-prone language-switch assertion made deterministic.

## Verification

### Gates (clean copy, `npm ci`)

| Package | npm ci | typecheck | lint | format | test | build |
| ------- | ------ | --------- | ---- | ------ | ---- | ----- |
| frontend | ✓ | ✓ | ✓ | ✓ (`format` changed nothing) | ✓ 365 / 365 (17 files) | ✓ |
| backend | ✓ | ✓ | ✓ | ✓ | ✓ 21 / 21 (4 files) | ✓ |

`solutions.test.tsx` covers: nine stories and anchors; departments and How CORE works chapter
per story; map placement; FEFO picks 30/20/0 and outstanding 40; problem / where / impact /
response / before / after in every locale; no numeric claims in any copy; Stock copy free of
financial wording in every locale; accounting boundary in every locale; pain-first H1; every
story rendered with facts, response, before/after, department and workflow links; problem map
frictions → anchors and the resolved view; falling-through owner card; status lenses
(Warehouse lens money-free, keyboard End → Executive); human-error lifecycle (missing lot →
PREVENT); approval pause, elapsed note and continuation; Stock section money-free with the
preview loaded; supplier 100/60/40 and affected work; payment gates → ready, boundary text;
executive panel and six workspace links; navigator (stock → warehouse, `#exceptions`, `#stock`;
arrow keys); CTA order; reduced motion; English and Chinese without Thai, no Traditional
characters; unique metadata; locale-preserving department and workflow links; mega-menu story
links; homepage link.

Existing tests changed: `header.test.tsx` (the cross-page homepage-chapter test now uses
Enterprise → Audit & Control → `/#error-control`, since Solutions links moved to
`/solutions`), `site-language.test.tsx` (new `/solutions` H1; waits for the English heading
after switching instead of reading the still-mounted Thai one).

### Live QA — headless Chrome, emulated viewports

- `/solutions` in th / en / zh at 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768,
  1280×720, 1440×900, 1920×1080, after interacting with the map toggle, falling-through view,
  lenses, mistakes, approval kinds, payment gates and navigator: one H1, no horizontal
  overflow, no element outside the viewport, no target under 44 px, no console errors.
- Regression: 16 public routes × th / en / zh at 390 and 1440 (96 checks), including
  `/how-core-works`, `/pricing` and the six department pages: one H1, no overflow, no console
  errors.
- Mega menu (live): โซลูชัน → Stock & Expiry Control opens `/solutions#stock` with the story in
  view; switching to Chinese keeps it (`/zh/solutions#stock`).
- Visual review at 1440 and 390 of the hero, problem map (both states), and every story.

### Bundle (vs. baseline `ab990eb`)

| | Baseline | EP09 |
| - | - | - |
| Entry `index.js` | 738.5 KB (217.0 KB gz) | 739.0 KB (217.1 KB gz) |
| `SolutionsPage` chunk | 7.0 KB (3.0 KB gz) | 104.3 KB (27.9 KB gz) |
| CSS | 184.6 KB | 189.6 KB |

No new dependencies, images, fonts or WebGL. Previews reuse the existing lazy preview chunk;
department imagery reuses EP06 assets.

### Text and scans

All changed / new files: valid UTF-8, no BOM, no U+FFFD, no mojibake, LF; no Traditional
Chinese characters in Chinese copy.

## Fixed during QA

- Problem-map centre was crowded (two chords crossing at CORE) → ring layout with explicit
  friction positions along each join; CORE spokes in the resolved view.
- FEFO allocation mutated a variable during render (React Compiler lint) → pure `fefoPicks()`.
- The language-switch test could read the old heading → waits for the new one.

## Known limitations

- Illustration only: nothing is computed from real data; the elapsed approval wait is a
  sample.
- The problem map simplifies to a list below 768 px (by design).
- QA used headless Chrome with emulated viewports — no real devices, Safari, Firefox or
  screen-reader testing.

## Revision — visual layout & composition polish

Owner feedback: content and animation approved; layout and composition needed work. Only
layout changed — stories, problem map, navigator, interactions, animation, privacy and
accounting boundaries, localization, links and business tests are unchanged.

- Every chapter recomposed with its own structure (see SOLUTIONS_EXPERIENCE.md): cinematic
  hero, architectural map, editorial asymmetry, full-width split-screen, dark inspection layer,
  horizontal process stage, operational control surface, cause-and-effect timeline, compact
  gate, executive vertical hierarchy, wide synthesis, calm navigator, quiet CTA.
- New primitives: background planes (obsidian, navy, grid, glow, deep, clear), width frames
  (narrow / base / wide 1440 / full 1640), title scales (statement / title / compact), and
  open meta blocks (three arrangements) built from typography, hairlines and planes.
- Visible bordered boxes on the page: **188 → 28** (16 of the remaining are the problem map's
  department and friction chips; most others are segmented controls).
- Removed from boxes: fact cards, response chips, before/after cards, department link pills,
  hero story card, lens and stock cards, lifecycle and approval stage cards, signal cards,
  navigator option buttons, CTA box.
- The executive preview was removed from the Management chapter (it rendered too narrow
  inside the new executive band and broke the vertical hierarchy); the warehouse preview
  remains in the Stock chapter.
- Added short anchor phrases for layout: *ทุกงานต้องมีเจ้าของ*, *ต้องถาม*,
  *งานปกติควรไหล / สิ่งผิดปกติควรถูกเห็น*, *ชั้นตรวจสอบระหว่างทาง* (th / en / zh).
- Bundle: `SolutionsPage` 28.6 → 32.3 KB gz; CSS +1.5 KB gz; entry unchanged.
- QA: 27 viewport × locale runs (320 → 1920) with interactions — no overflow, collision,
  small targets or console errors; 96-check regression clean; 365 frontend and 21 backend tests
  pass; visual review at 1440, 1920 and 390.

## Revision round 2 — beauty / composition upgrade

Owner feedback: still not beautiful enough; too empty; sections felt placed rather than
composed. Only layout and finish changed — logic, interactions, animation, localization,
Warehouse privacy and the accounting boundary are unchanged.

- **Stage surfaces**: a layered backplate (deep gradient, faint inner grid, one controlled
  glow, hairline inner edge via inset light) now holds each dominant visual, so content no
  longer floats.
- **Hero**: the visual sits on a deep stage that bleeds to the right edge; the lead gets an
  accent rule; the six causes became an index band with numbered cells.
- **Approval**: rebuilt as one stage board — request-type selector and simulate-approve in the
  board header, the process line across the board, and *Waiting* as a lit tension zone with a
  larger pause node and elapsed time; support content is inset at the bottom of the board.
- **Human error / trace**: an audit layer on a stage — principles wired into a central lit
  scenario panel with a spine, before and with-CORE paired either side of the TRACE root,
  response and links inset beneath.
- **Stock**: the control surface stays dominant; the support below became a three-zone panel.
- **Supplier**: the timeline on a warm stage; the delay node drops a dashed line into an
  impact zone — receipt bar → outstanding → affected work, in one row.
- **Management**: a luminous executive band with signal icons; every department line
  converges into one lit node; the floor sits on its own dark plane.
- **Navigator**: on a stage — a numbered symptom list with a lit selected row, and a focused
  response surface ending in a "read next" action.
- **Support compositions**: before/after is now one paired comparison (warm tile → arrow →
  emerald tile); three arrangements (band panel, pair-led, inset in a stage) replace the flat
  strips.
- **Typography**: larger statements and titles, kickers with an accent rule, facts set as a
  readable lead sentence with quiet annotations; Thai line breaks rebalanced (hero, stock).
- Visible bordered boxes stay at **28** (structure comes from planes and inset light).
- Bundle: `SolutionsPage` 32.3 → 34.0 KB gz; CSS +1.2 KB gz; entry unchanged.
- QA: visual review at 1440, 1536, 1920 and 390; 27 viewport × locale runs clean; 96-check
  regression clean; 365 frontend and 21 backend tests pass.
