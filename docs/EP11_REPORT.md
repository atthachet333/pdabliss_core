# EP11 — Industries Experience

**Date:** 2026-10-24 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** `9d553f81073fd685e671cc51acb0008883dd3fe6` (EP10). It was already on
`origin/main` (pushed with owner approval). Local `main` == `origin/main` and the tree was
clean.

**Commit:** `feat: create industry experience pages (EP11)` — local only, **not pushed**.

## Scope

Public frontend only:

- `/industries` and six industry pages, in th / en / zh (21 pages).
- The links that lead to them.
- The sitemap and the permanent route set.

Not touched:

- Backend and database
- Industry templates or engines
- Integrations
- `/login`, `/app/*`, `workspaces/`, `prototype/`, `components/core`, `components/shell`
- Homepage visuals

Design reference: [INDUSTRIES_EXPERIENCE.md](INDUSTRIES_EXPERIENCE.md).

## What was built

- **Industry model** (`features/industries/model.ts`):
  - six industries with motif, departments, example workflow, stall point, signals, links and
    boundaries
  - shared principles, what stays and what changes
  - the fit navigator
  - deterministic signature data: order fulfilment, dependency reach, branch health, request
    paths, evidence, Work Order buildable quantity
- **Overview**:
  - CORE with six environment windows
  - what stays / what changes
  - the cinematic selector
  - six workflow silhouettes
  - the principles matrix
  - the fit navigator
  - consultation, with quiet enterprise and pricing links
- **Six pages**, each with its own hero composition, motif, rhythm, signature section and
  workflow form. Each answers the nine questions.
- **Discovery and linking**:
  - The โซลูชัน highlight CTA now goes to `/industries`.
  - The footer has a new ประเภทธุรกิจ link.
  - The `/enterprise` industries strip links to the six pages.
- **Sitemap**: all 24 public routes × 3 locales with hreflang. This fixes the EP10 gap.
- **Permanent route set**: `test/publicRoutes.ts`, now used by the header, language, route and
  sitemap tests.
- **Tests**: `industries.test.tsx` (46 tests) and `sitemap.test.ts` (3 tests). Shell, header,
  route and site-language tests were updated.

## Verification

### Gates (clean copy, `npm ci`)

| Package | npm ci | typecheck | lint | format | test | build |
| ------- | ------ | --------- | ---- | ------ | ---- | ----- |
| frontend | ✓ | ✓ | ✓ | ✓ (`format` changed nothing) | ✓ 499 / 499 (20 files) | ✓ |
| backend | ✓ | ✓ | ✓ | ✓ | ✓ 21 / 21 (4 files) | ✓ |

**`industries.test.tsx` covers:**

- **Model**:
  - exactly six industries and routes
  - a unique motif, workflow and signal set for each
  - real departments, Solutions anchors and How CORE works chapters
  - each industry's own operating story
  - required boundaries, including accounting wherever accounting appears
  - the signature calculations
  - the fit mapping
- **Copy**:
  - every step and signal is labelled, with notes, in every locale
  - the nine questions are answered
  - no certification, guarantee, customer or outcome claims
  - no "solution for every industry" claim
  - the Warehouse is money-free in every industry and locale
  - POS, MRP/MES and the property product appear only as boundaries
  - workflows are labelled illustrative
- **Overview**:
  - one H1 and the section order
  - orbit links
  - what changes for retail
  - phone selector (previous/next) and wide rail (tabs, End key)
  - silhouettes match the model
  - principle picker
  - fit result and its link
  - quiet enterprise and pricing links
- **Each industry page**:
  - one H1, hero id, step count, example label, four signals, seven principles, frictions,
    information, departments, limits, boundaries
  - department, Solutions, How CORE works, other-industry, enterprise and pricing links
- **Signature interactions**:
  - distribution: order ready after receipt, no money
  - services: closes only with full evidence
  - projects: exact downstream milestones
  - retail: POS boundary first, branch health
  - property: product boundary first, stuck request
  - manufacturing: 320 → 500, no money, MRP boundary
- **Discovery and localization**:
  - 21 unique titles and descriptions
  - no Traditional Chinese
  - locale-preserving links
  - Solutions menu and footer discovery
  - enterprise strip links
  - reduced motion

### Live QA (headless Chrome, emulated viewports)

- **Viewport sweep (91 runs)**: all seven Thai routes at 320, 375, 390, 430, 768, 1024, 1280,
  1440 and 1920, plus English and Chinese at 390 and 1440. Run after triggering every toggle and
  selecting the last radio option. Results: one H1, no horizontal overflow, no element outside
  the viewport, no target under 44 px, no console errors.
- **Regression**: 17 earlier public routes × th / en / zh at 390 and 1440 (102 checks), clean.
  `/login`, `/app` and `/app/sales` behave as before (redirect to sign-in when signed out).
- **Mega menu (live)**: from `/zh/about`, the Solutions highlight opens `/zh/industries`.
- **Reduced motion (live)**: all six overview windows are at full opacity on the first frame.
- **Visual review**: every section at 1440, and heroes and signatures at 390.
- **Visual differentiation test**: all six full pages side by side at thumbnail scale, where
  page names can't be read. The heroes are told apart by composition alone — network curves,
  centred schedule grid, rising phase bars, branch map, skyline, full-bleed lanes — and so are
  the signature sections.
- **Industry credibility review**: each page uses the trade's own vocabulary and failure
  points: SO/PO and partial receipts, job evidence, milestone dependencies, branch transfers
  and counts, vendor delays and done-not-closed, Work Order materials and output handoff. None
  of it is generic copy with a name swapped in.

### Bundle (vs. `9d553f8`, both built from source)

| | Baseline | EP11 |
| - | - | - |
| Entry `index.js` | 739.9 KB (217.3 KB gz) | 741.3 KB (217.7 KB gz) |
| `IndustriesPage` chunk | — | 20.1 KB (5.5 KB gz) |
| Shared industries chunk (parts + summary copy) | — | 58.8 KB (17.3 KB gz) |
| Industry page chunks | — | 28.6–31.2 KB each (9.4–10.1 KB gz) |
| `EnterprisePage` | 109.7 KB (28.6 KB gz) | 110.0 KB (28.8 KB gz) |
| CSS | 229.2 KB (37.9 KB gz) | 246.0 KB (39.7 KB gz) |

No new dependencies, images, fonts or WebGL.

### Text and scans

- All changed and new files are valid UTF-8, with no BOM, no U+FFFD, no mojibake, and LF line
  endings.
- The Chinese copy contains no Traditional characters.

## Fixed during QA

- **Selector panel**: the open panel scrolled internally. The rail now grows with its content.
- **Silhouettes**: the six were evenly spaced lines that looked alike. They now have six
  different shapes.
- **Projects hero**: SVG text rendered too large. The figure width is now constrained.
- **Projects staircase**: the first block's content overflowed. Blocks now grow to fit.
- **Property skyline**: text rendered too large. The skyline width is now constrained.
- **Projects mobile overflow**: the department × phase table widened the page on phones. Phones
  now get a stacked list.
- **Selector arrows**: shrank to 43 px at 320. They now stay 44 px.
- **Tests caught copy that named money or claims in negation**: the distribution note and a
  claims regex. The copy was reworded and the test tightened.
- **Fast-refresh lint**: a hook was exported from the parts file. It moved to
  `useIndustryMeta.ts`.

## Known limitations

- Illustration only: industry data, quantities and statuses are samples; nothing is computed
  from real operations.
- Industry vocabulary and examples should be reviewed by the owner with real customers'
  processes before launch.
- QA used headless Chrome with emulated viewports — no real devices, Safari, Firefox or
  screen-reader testing.
- The full SEO pass (canonical per route, structured data) is out of scope; only the sitemap
  was fixed.
