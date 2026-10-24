# EP13 — Contact / Consultation Experience + About WOW Enhancement

**Date:** 2026-10-24 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** `d2230b0e3752cc7c6331e2d55f5ee552374c4ddd` (EP12, approved and on `origin/main`).
Before work: branch `main`, local `main` == `origin/main`, working tree clean.

**Commit:** `feat: create consultation experience and elevate About page (EP13)` — local only,
**not pushed**. Awaiting owner visual review.

## Scope

Public frontend only — no backend, database, CRM, email sending, LINE Messaging API, payment,
auth or `/app/*` changes. No new dependencies, no WebGL, no images or video.

- **A. `/about` WOW layer** — the approved EP12 structure and copy stay; four signature scenes
  and a crafted chapter system are added. Details: [ABOUT_PDA_BLISS.md](ABOUT_PDA_BLISS.md#ep13--the-cinematic-layer).
- **B. `/contact`** — rebuilt as a guided consultation with a stable prefill contract and an
  honest delivery seam. Details: [CONTACT_EXPERIENCE.md](CONTACT_EXPERIENCE.md).

Approved copy changes on `/about` (asked for by the EP13 brief): the ending is now
*อยากให้เราช่วยดู Process ขององค์กรคุณ?* → `/contact?interest=consulting`; the product stack is
four layers (configuration and workflow adaptation separated); the hero CTA opens the
consultation path. Everything else in the EP12 story is unchanged in text.

## Signature moments on /about

1. Real work → CORE hero (scroll-driven pin on desktop, play-once on phones)
2. Process → Product design table (inspect any of ten steps: zone state, question, output)
3. Human Error defense rings (choose a layer; a work item stops at it)
4. Consulting work table (choose an artifact; three sides show their contribution)

Supporting: lock-in manifesto, drifting problem slips with disagreeing evidence, scroll-driven
common-design-vs-CORE shift, blueprint implementation path, assembling product stack, identity
lockup, product family, ghost chapter numbers + notation + chapter rail.

## Contact

Seven paths in three intent groups; six short steps; only topic, name, company and one matching
channel are required. Prefill: `?interest=`, `?plan=`, `?industry=`, `?department=`. A live
summary in the *talk directly* panel; review before the final action. **Nothing is sent by the
website**: the final action prepares the message and hands it to the visitor's email app, the
LINE OA chat (copy + exact central URL) or a phone call. No "sent" message exists.

## Files

New

- `frontend/src/features/about/motion.ts`, `Rail.tsx`, `scenes/` (`copy.ts`, `HeroScene.tsx`,
  `sketches.tsx`, `SystemShift.tsx`, `DefenseRings.tsx`, `WorkTable.tsx`, `ImplementationPath.tsx`)
- `frontend/src/features/contact/` (`model.ts`, `validation.ts`, `delivery.ts`, `state.ts`,
  `copy.ts`, `summaryText.ts`, `Summary.tsx`, `ContactFlow.tsx`, `Panels.tsx`, `contact.test.tsx`)
- `frontend/src/components/seo/OrganizationSchema.tsx`
- `docs/CONTACT_EXPERIENCE.md`, `docs/EP13_REPORT.md`

Changed

- About: `Hero.tsx`, `Belief.tsx`, `Method.tsx`, `Work.tsx`, `copy.ts`, `model.ts`,
  `about.test.tsx`; `features/story/parts.tsx` (StoryHead ghost / notation);
  `pages/public/AboutPage.tsx`, `pages/public/ContactPage.tsx`
- `config/company.ts` (`organizationSchema()`), `styles/index.css` (`loose` keyframes)
- CTA prefill: enterprise `Hero.tsx` / `Partnership.tsx`; pricing `PricingHero.tsx`,
  `PackageExplorer.tsx`, `Configurator.tsx`, `ClosingSections.tsx`; departments `ui.tsx` + six
  department pages; industries `parts.tsx`; why-core `model.ts`
- Tests following the new links / flow: enterprise, pricing, departments, industries, why-core,
  routes, site-language
- Docs: `ABOUT_PDA_BLISS.md`, `MOTION.md`, `BRAND.md`, `PUBLIC_SHELL.md`, `README.md`

## Quality gates

| Gate | Frontend | Backend |
| --- | --- | --- |
| `npm ci` | ✓ | ✓ |
| `npm run typecheck` | ✓ | ✓ |
| `npm run lint` | ✓ (0 problems) | ✓ |
| `npm run format` | ✓ | ✓ |
| `npm test` | ✓ 581 / 23 files (36 new) | ✓ 21 / 4 files |
| `npm run build` | ✓ | ✓ |

### Bundle (vs. `d2230b0`, both built from source)

| | Baseline | EP13 |
| - | - | - |
| `AboutPage` chunk | 80.0 kB (23.0 kB gz) | 129.8 kB (37.8 kB gz) |
| `ContactPage` chunk | 8.8 kB (3.5 kB gz) | 47.7 kB (15.1 kB gz) |
| Entry `index.js` | 754.4 kB (223.0 kB gz) | 759.5 kB (224.6 kB gz) |
| CSS | 270.9 kB (42.7 kB gz) | 280.8 kB (43.9 kB gz) |
| Images / video | — | none added |

The entry grew by 5.1 kB (1.6 kB gz): Rollup hoisted ~15 small shared lucide icons
(department and shell icons now also used by the contact flow) into the entry chunk. No
animation library was added; About motion uses the existing Framer Motion, SVG and CSS.

### Browser QA

`/about` and `/contact` at 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1280×720,
1440×900 and 1920×1080, plus EN/ZH at 320 and 1440: one H1, no horizontal overflow, no console
errors. Visual review at 1024, 1280, 1440 and 1920 of every signature scene and the contact flow
end to end (prefill → validation → review → prepared hand-off).

Fixed during QA: a positioning conflict in the hero scene; relationship lines hidden under cards
(now edge to edge); the compact CORE card and fragments overrunning 320 px; the defense-ring item
label clipping; the pinned headline clipping at 1280×720 (height-aware type and spacing); Thai
letter-spacing on work-table tags; duplicate direct links on desktop contact.

Regression smoke (H1, overflow, console): `/`, `/why-core`, `/industries`, an industry page,
`/enterprise`, `/solutions`, `/how-core-works`, `/pricing?plan=enterprise`, `/departments`,
`/departments/warehouse`, `/login`, `/app/warehouse` (demo gate), EN/ZH samples.

## Known limitations

- No inquiry is delivered by the website (by design until a backend exists — see
  CONTACT_EXPERIENCE.md *Connecting a real backend later*).
- The browser pane used for QA was in the background, so time-based playback (the phone hero's
  play-once) could not be watched there; its layout, final state and reduced-motion state were
  verified, and scroll-driven scenes were watched at desktop sizes. Chromium only.
- Copy-to-clipboard depends on the browser's Clipboard API permission; email, LINE and phone
  hand-offs do not.
- The entry chunk grew 1.6 kB gz from shared-icon hoisting (above).

## Recommended EP14

Connect the inquiry seam to a real, owner-approved delivery: a `POST /api/inquiries` route in the
existing backend (validation mirroring `validation.ts`, rate limiting, a stored record and an
email or LINE notification to PDA BLISS), a privacy notice for stored inquiries, and an honest
success state that appears only when delivery returns `ok`.
