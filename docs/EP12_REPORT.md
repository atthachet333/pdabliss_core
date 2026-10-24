# EP12 — About PDA BLISS / Why CORE

**Date:** 2026-10-24 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** `20c0e6e922787e216cee4f96ea3304dc2937a3c7` (EP11, already on `origin/main`).
Before work: branch `main`, local `main` == `origin/main`, working tree clean.

**Commit:** `feat: create PDA BLISS and CORE story experience (EP12)` — local only,
**not pushed**. Awaiting owner visual review.

## Scope

Public frontend only. No backend, CMS, database, Prisma, staff directory, advisor backend,
auth, contact submission, careers, blog or trust/security backend. No new dependencies.

- `/about` (+ `/en/about`, `/zh/about`) — redesigned: who PDA BLISS is and how it works.
- `/why-core` (+ `/en/why-core`, `/zh/why-core`) — new: why CORE exists.
- About mega menu, homepage Trust links, route registry and sitemap updated.

See [ABOUT_PDA_BLISS.md](ABOUT_PDA_BLISS.md) and [WHY_CORE.md](WHY_CORE.md) for the full
design of each page.

## Files

New

- `frontend/src/config/company.ts` — `COMPANY` (approved identity, built from `CONTACT`),
  `companyName(locale)`, `PRODUCTS`
- `frontend/src/features/story/parts.tsx` — `Lines`, `StoryHead`, `QuietLink`, `ExternalLink`,
  `DeptDot`
- `frontend/src/features/about/` — `model.ts`, `copy.ts`, `Hero.tsx`, `Belief.tsx`,
  `Method.tsx`, `Work.tsx`, `about.test.tsx`
- `frontend/src/features/why-core/` — `model.ts`, `copy.ts`, `Hero.tsx`, `Principles.tsx`,
  `why-core.test.tsx`
- `frontend/src/pages/public/WhyCorePage.tsx`
- `docs/ABOUT_PDA_BLISS.md`, `docs/WHY_CORE.md`, `docs/EP12_REPORT.md`

Changed

- `frontend/src/pages/public/AboutPage.tsx` — replaced (was a three-card stub)
- `frontend/src/app/router.tsx` — lazy `why-core` route in every locale
- `frontend/src/config/navigation.ts` — About menu: `why` → `/why-core`, `consulting` →
  `/about#consulting`
- `frontend/src/features/landing/home/TrustChapter.tsx` — *Why We Built CORE* → `/why-core`
- `frontend/src/test/publicRoutes.ts` — `/why-core` added to the permanent route set
- `frontend/public/sitemap.xml` — `/why-core` × th / en / zh with hreflang alternates
- `README.md`, `docs/PUBLIC_SHELL.md`, `docs/BRAND.md`, `docs/HOMEPAGE_EXPERIENCE.md`,
  `docs/MOTION.md`

Footer structure unchanged (its *เกี่ยวกับเรา* link already reaches `/about`, which links to
`/why-core` twice; adding a sixth company link would crowd the footer).

## Claim safety

- Company facts are limited to: Thai and English registered names, office address, phone
  (คุณวิน), email, LINE OA. All contact values come from `CONTACT`; the shell test that scans
  every source file for hardcoded contact values still passes.
- Not invented anywhere: founding year, headcount, revenue, office count, clients, projects,
  awards, certifications, partnerships, registration number, testimonials, advisor or founder
  names, portraits, biographies. Tests scan all copy in three locales and the rendered pages.
- The address is called an office; tests fail on house / home / residence wording.
- Consulting is explicitly *not* accounting, tax or legal advisory.
- Human Error safeguards are "what CORE is designed to support", explicitly not a guarantee.
- No competitors are named or criticized; the ONE LARGE SYSTEM comparison says it is a design
  philosophy and that many organizations use centralized systems well.
- No Google Maps link is configured in the project, so none is shown and no coordinates exist.

## Quality gates

| Gate | Frontend | Backend |
| --- | --- | --- |
| `npm ci` | ✓ | ✓ |
| `npm run typecheck` | ✓ | ✓ |
| `npm run lint` | ✓ (0 problems) | ✓ |
| `npm run format` | ✓ (`format:check` clean) | ✓ |
| `npm test` | ✓ 545 tests / 22 files (43 new) | ✓ 21 tests / 4 files |
| `npm run build` | ✓ | ✓ |

No database was touched.

### Bundle (vs. `20c0e6e`, both built from source the same way)

| | Baseline | EP12 |
| - | - | - |
| Entry `index.js` | 759.1 kB (224.5 kB gz) | 754.4 kB (223.0 kB gz) |
| `AboutPage` chunk | 4.2 kB (2.2 kB gz) | 80.0 kB (23.0 kB gz) |
| `WhyCorePage` chunk | — | 62.8 kB (18.0 kB gz) |
| CSS | 251.9 kB (40.8 kB gz) | 270.9 kB (42.7 kB gz) |

Both pages are lazy chunks; the entry did not grow. No images, fonts, WebGL or dependencies.

### Browser QA

Checked in the dev server at 320, 390, 768, 1280, 1440 and 1920 px for all six localized
pages: exactly one H1, no horizontal overflow (a 9 px overflow at 768 from scattered problem
slips was found and fixed by limiting their offsets to `lg`), no console errors. Regression
smoke (H1, overflow, console) on `/`, `/industries` and two industry pages, `/enterprise`,
`/solutions`, `/how-core-works`, `/pricing`, `/departments`, `/departments/warehouse`,
`/contact`, `/login`, `/app/warehouse` (demo gate), plus EN/ZH samples.

Fixed during QA: lost spaces where Thai meets Latin at authored wrap points ("COREยังคง");
letter-spacing on Thai labels; heading text that concatenated lines ("askingwhat") —
`Lines` now ends every line with a collapsed space; hero threads that stopped short of the
CORE layer; an empty gap in the CORE panel (now a convergence to the shared state).

## Known limitations

- Visual QA was done in the in-app browser (Chromium) only; Safari / Firefox not checked.
- The consulting chapter is a company-level description: no advisor information exists in an
  approved source. When it does, chapter 06 is where it belongs.
- Products by PDA BLISS describe PDA ONE and Property & Rental Management only as far as
  existing docs do; product pages or links for them do not exist on this site.
- `/why-core` is not linked from the footer (structure intentionally unchanged).
- No structured data is emitted yet; `COMPANY` is shaped so Organization schema can be added
  without new data collection.

## Recommended EP13

A conversion and trust pass on `/contact`: connect the contact form to a real (owner-approved)
delivery channel, add an inquiry-type flow that reuses the Solutions / Industries / Enterprise
context the visitor came from, and add Organization structured data from `COMPANY` — still
without inventing company facts.
