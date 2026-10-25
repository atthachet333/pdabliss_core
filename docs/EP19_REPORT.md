# EP19 — Responsive + Accessibility Hardening

## 1–5. Baseline, commit and issue matrix

- Baseline branch: `main`.
- Baseline and `origin/main` before EP19: `7313f66` (`feat: polish CORE dropdown and overlay
  surfaces (EP18.1)`).
- EP19 continues the inherited uncommitted work; no reset, checkout or history rewrite was used.
- Final local commit message: `feat: harden CORE responsive and accessible experience (EP19)`.
  The final hash is reported by the completion handoff because embedding a commit's own hash would
  change it. Push status: **NOT PUSHED**.
- Final defect matrix: P0 0, P1 0, P2 34 fixed, P3 0. Unresolved product defects: none.

The 34 P2 findings cover: focus treatment (3), accessible names/announcements and landmarks (6),
disclosure/tab/list semantics (4), table headers and keyboard scrolling (4), responsive clipping,
wrapping and map overlap (4), contrast and non-color state communication (6), duplicate HTML/SVG
IDs (2), fixed-header hash behavior (1), reduced-motion/animation correctness (2), touch targets
(1), and resource definition-list semantics (1).

Important fixes include the Pricing user stepper focus ring; Resources/Glossary focus; Login skip
link and show/hide announcement; Logo and language accessible-name alignment; valid Industries
disclosures; conditional keyboard scroll regions; named headers; wrapping buttons; Solutions map
breakpoints; readable future/inactive states; unique SVG definitions; leaner FAQ/guide landmarks;
valid `<dl>` and resource-table structure; robust hash alignment; and the two EP18.1 individual
translate/scale animation fixes.

## 6–13. Responsive, height, zoom and text enlargement

- Widths: 320, 360, 375, 390, 412, 430, 480, 640, 768, 820, 1024, 1180, 1280, 1366, 1440,
  1536, 1600 and 1920.
- Main sweep: 24 route families × 18 widths = 432 mounted-page checks; zero failures.
- Heights: 667, 720, 800 and 900 in the matrix. Dedicated short/landscape checks: 1366×768,
  1440×800, 390×667 and 667×390.
- Portrait and landscape mobile menus scroll while pinned actions remain reachable.
- 125%, 150% and 200% used layout-equivalent CSS viewports of 1152×640, 960×533 and 720×400
  from a 1440px reference. These were automated emulations, not manual browser UI zoom.
- A separate 200% root-font enlargement pass covered Homepage, Pricing, Contact, Resources,
  Security and Login with no page overflow, missing controls or structural failures.

## 14–19. Browsers and devices

- Chrome 156.0.8078.47: installed browser, automated headless coverage.
- Edge 156.0.4314.42: installed browser, automated headless coverage.
- Firefox 142.0.1: temporary Playwright browser under `D:\Temp`, outside repository dependencies.
- Nine representative routes in each engine: Homepage, Pricing, How CORE Works, Solutions,
  Contact, Demo, Security, Resources and Login. All had one H1/main, no overflow, no duplicate or
  unresolved SVG IDs, no console errors and no final axe violations.
- Safari: **NOT TESTED**; unavailable on Windows. Devices were browser emulations only; no real
  phone or tablet was tested.

## 20–30. Keyboard-only journeys

- Skip link is first and moves focus to `main`.
- Header Product menu opens with Enter; Escape closes and restores trigger focus. Arrow/Home/End
  behavior remains covered by navigation regression tests.
- Mobile menu opens with Enter, disclosures respond to Space, focus stays in the dialog, Escape
  closes, and focus returns. Contact, Login and Language were present at all tested widths.
- Language selector opens by keyboard and returns focus on Escape.
- Pricing package tabs support arrows/Home/End; the user-count input is visibly focusable.
- Contact completed topic → optional steps → method → details → validation → review → prepare by
  keyboard. The first invalid field received focus and no non-GET submission occurred.
- Demo role choice, start and role tabs worked by keyboard.
- Resources search and Glossary search were focus-visible; existing tests cover filters,
  no-results, department picker, disclosures and guide links.
- Login invalid submit returned focus to Password; `user1/pass1` still entered the prototype.
- Cookie settings, switches, Escape, Reject and stored essential-only choice worked by keyboard.

## 31–43. Accessibility

- Landmarks/headings: all 37 public, Login and 404 routes have one H1 and one main; unintended
  nested complementary landmarks were removed.
- Links/buttons and ARIA: navigation remains links, disclosures remain buttons, expanded/current/
  selected state is explicit, and unnecessary roles were removed.
- Names: visible Logo/language text is included in accessible names; table headers are named.
- Focus: six-route, 18-step focus sweeps found visible focus indicators on every focusable sample.
- Contrast: final axe checks were clean on all 37 Chrome routes and the nine-route cross-engine
  matrix. A rebuilt effective-contrast scan covered 17 long routes viewport by viewport; after
  settled reveal fades it found no visible low-contrast text. Fully hidden alternate states were
  excluded from contrast evaluation.
- Color-only state: future stages use dashed borders/markers and “Not reached yet” labels; stopped
  values use readable text plus strike-through; existing icons/text accompany status colors.
- Forms: labels, fieldsets/legends, validation summaries and error focus were checked.
- Tables: no empty column headers or `<td>` cells in `<thead>`; narrow Warehouse/Purchasing tables
  expose named focusable scroll regions only while overflowing.
- Diagrams: decorative SVGs remain hidden from assistive technology; unique definition IDs avoid
  cross-instance/Firefox failures; essential meaning is duplicated in text.
- Touch/hover: primary targets remain keyboard/touch reachable and information does not require
  hover.

## 44–52. Screen reader

Automated semantic smoke coverage checked names, roles, expanded/collapsed state, current state,
reading landmarks, form labels, tables and decorative SVG behavior for Header, mega menu,
Homepage, Pricing, Contact, a Resource guide, Cookie and Login. Axe ran in Chrome, Edge and Firefox.

**Narrator was not audibly tested in this agent environment.** It would be inaccurate to claim a
real Narrator listening pass. NVDA is not installed and was not tested. These are coverage
limitations, not known DOM defects.

## 53–59. Motion

- Actual Playwright `prefers-reduced-motion: reduce` emulation covered nine representative routes.
- No long-running/infinite browser animation remained in CORE World, global Reveal content,
  menus/overlays, Demo, Why CORE, workflow, Security, Resources or Login.
- Static/final states remain readable and interactive; required information does not rely on a
  moving token or autoplay.
- EP18.1 Why CORE slide and CORE World label enlargement now transition `translate` and `scale`
  respectively. Regression tests lock the corrected property lists.

## 60–77. Page review

The responsive/semantic sweep included Homepage, Features, Departments plus Operations/Warehouse/
Purchasing representatives, Pricing, How CORE Works, Solutions, Enterprise, Industries plus
Manufacturing, About, Why CORE, Contact, Demo, Security, Resources, Warehouse Privacy, Glossary,
Privacy, Terms, Login and localized 404. The all-route axe/console/structure pass covered all 35
public route definitions plus Login and 404 (37 total), including every department, industry and
guide route.

## 78–83. Shell

- Header: five top-level navigation items, four mega menus, language, Contact and Login preserved.
- Footer: EP18 zones and legal row preserved; Logo name corrected.
- Cookie: first visit, settings, switch, Escape, reject and persistence checked. At 320, 390, 768,
  1024 and 1440 it did not overlap the utility dock.
- Floating controls: focus, contact panel, back-to-top, responsive placement and cookie coexistence
  retain regression coverage.
- Safe/short areas: mobile menu and cookie surfaces remain internally scrollable.
- Fixed header/anchors: direct localized hash targets settle below the header after lazy mounting
  and ScrollRestoration.

## 84–88. Locales

TH, EN and Simplified ZH were stressed at 320×667 and 1440×800 on Homepage, Pricing, Contact,
Resources and Login (30 combinations). No overflow, duplicate ID, broken SVG reference or missing
H1 occurred. Long English department labels wrap; Thai line height and Chinese compact labels
remain intact. Locale switching continues to preserve path, query and hash.

## 89–98. Locked regressions

- EP17: 105 indexable static heads, canonical/hreflang/Open Graph, sitemap, robots, localized 404,
  redirects, Login noindex and prerender verification remain locked.
- EP18: navigation consolidation, discoverability and zero-orphan tests remain locked.
- EP18.1: overlay primitives, desktop/mobile visual language, focus/escape behavior and disclosure
  treatment remain locked.
- Warehouse privacy tests still reject financial values and enforce operational-only clearance.
- Security, Human Error, Accounting, Retail, Property and Manufacturing claim scanners remain.
- Prices remain Starter ฿399, Business ฿699, Professional ฿999 and Enterprise quote; no free plan.
- Prototype Login behavior and `user1/pass1` remain unchanged.

## 99–108. Quality gates

Both packages received a clean `npm ci`. Final recorded gates:

| Package | Typecheck | Lint | Format | Tests | Build | Prerender |
| --- | --- | --- | --- | --- | --- | --- |
| Frontend | PASS | PASS | PASS | PASS | PASS | PASS |
| Backend | PASS | PASS | PASS | PASS | PASS | n/a |

Browser console coverage: zero errors or React/DOM warnings in the nine-route three-engine matrix
and the 37-route Chrome pass. UTF-8 scan: no BOM, replacement character, mojibake or broken Thai/
Simplified Chinese in changed files.

## 109–111. Documentation

- Added `docs/ACCESSIBILITY_RESPONSIVE.md`.
- Added this `docs/EP19_REPORT.md`.
- Updated `README.md`, `docs/PUBLIC_SHELL.md` and `docs/MOTION.md` only for the EP19 baseline and
  verified behavior.

## 112–115. Known limitations

- Safari: not available; not tested.
- Narrator: spoken output not observed; not claimed. NVDA: not installed; not tested.
- Real phone/tablet and manual browser UI zoom: not tested. Coverage used Playwright/browser
  emulation and layout-equivalent viewports.
- This was not a formal WCAG conformance audit.

## 116–118. Git

- Pre-commit state and full diff were reviewed with `git status`, `git diff --stat`, `git diff` and
  `git diff --check`.
- Final local commit uses the required EP19 message.
- Push status: **NOT PUSHED**. EP20 was not started.
