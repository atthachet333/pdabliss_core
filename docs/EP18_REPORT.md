# EP18 — Global Luxury Visual, Navigation & Motion Refinement

**Date:** 2026-10-25 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** `105cbe1` (EP17, approved and pushed). Before work: branch `main`, `main` ==
`origin/main` == `105cbe1`, working tree clean.

**Commit:** `feat: refine CORE global navigation and visual experience (EP18)` — local only,
**not pushed**. Awaiting owner visual review.

## Scope

Public frontend only. Unchanged:

- `/app/*`, the prototype workflow and auth logic
- the backend, database, Prisma, payments and inquiry sending
- prices and pricing rules (Starter ฿399 / Business ฿699 / Professional ฿999 per month,
  Enterprise by quote, annual rules, no free plan)

No new dependency, animation framework or WebGL.

## 1. Navigation (details: [GLOBAL_NAVIGATION.md](GLOBAL_NAVIGATION.md))

**Header, before:**

- ภาพรวม · แผนก · แพ็คเกจ · วิธีการทำงาน · โซลูชัน · สำหรับองค์กร · ความรู้ · เกี่ยวกับเรา (8)
- language · ติดต่อเรา · sign-in that collapsed to an icon between 1280 and 1535 px
- 6 px item padding at 1280 px; 30 px spare in English

**Header, after:**

- **ภาพรวม · ผลิตภัณฑ์ · โซลูชัน · ความรู้ · เกี่ยวกับเรา** (5)
- language · ติดต่อเรา (primary pill) · **เข้าสู่ระบบ, labelled at every width**
- 14–16 px padding; type unchanged at 15 px
- spare space at 1280 px: 109 / 107 / 146 px (TH / EN / ZH)

**Menus.** Each menu answers one question and has three parts: intro | titled sections |
one featured destination.

- **Product:**
  - How CORE Works, Departments, Demo, Packages
  - the six departments as an index row
  - featured: CORE Demo
- **Solutions:**
  - problems, industries, for organizations
  - the six industries as an index row
  - featured: industries
- **Resources:**
  - Start here: Getting started
  - Core concepts: Workflow & Operations, Human Error, Warehouse Privacy
  - Reference: Implementation, Security & Data, Glossary
  - featured: Resource Center
- **About:**
  - PDA BLISS, Why CORE, Security & Trust (moved here from สำหรับองค์กร)
  - approach as an index row
  - featured: consulting

There are at most 11 links per menu (the old menus held up to 7 rows plus a CTA each, across
seven menus). Nothing is informational-only; every row is a live link.

**Active state.** The menu whose family contains the current page gets `aria-current="true"`,
primary text colour and a 4 px emerald dot. For example:

- a guide → ความรู้
- an industry page → โซลูชัน
- `/why-core` or `/security` → เกี่ยวกับเรา
- `/pricing` → ผลิตภัณฑ์

**Breakpoint.** The full bar starts at 1280 px. Below that, the mobile menu takes over:

- 768–1279 px: language · contact · sign-in · menu button
- 640–767 px: language · sign-in · menu button
- below 640 px: everything in the menu

**Mobile menu.** The closed menu is five rows and fits one phone screen. A group expands into
titled sections: feature rows, then index chips, then the featured link. Groups are collapsed by
default. Contact and sign-in stay pinned at the bottom.

**Keyboard.** Unchanged and tested:

- ←/→ move along the bar (wrapping)
- ↓ opens a menu and focuses its first link
- Escape closes and returns focus
- tabbing out, clicking outside or navigating closes the menu
- the mobile menu traps focus, closes on Escape and returns focus

**Discoverability.**

- The EP17 route graph still reaches every public route with zero orphans.
- Every route is now at depth ≤ 1. The six industry pages improved from 2 to 1.
- **Changed entry paths:**
  - Security: About menu + Security & Data guide (no longer in the footer)
  - Departments and industries: index rows in their menus
  - Pricing plan deep links (`?plan=`): chosen on the page
  - Anchor links (`/how-core-works#…`, `/solutions#…`, `/enterprise#…`): removed from the
    menus; the pages carry them

## 2. Footer

**Before:**

- a brand column with call / LINE / email chips
- ลิงก์ด่วน (5) and องค์กร (6)
- contact details as icon tiles
- network curves and orbit rings

**After:**

- four zones: **Brand · ผลิตภัณฑ์ (4) · สำรวจ (5) · ติดต่อเรา**, then one legal row
- the contact zone is a compact list (plain icons) plus "คุยกับทีม PDA BLISS" → `/contact`
- one faint glow

**Removed duplicate links:**

- ภาพรวม (the footer logo links home)
- ความปลอดภัย (About menu)
- the ติดต่อเรา text link (the contact zone link replaces it)
- the three contact chips (duplicated the contact list)
- the "by PDA BLISS" byline (*พัฒนาโดย PDA BLISS COMPANY LIMITED* says it)

**Legal row:** © · privacy · terms · cookie settings, with clearance for the floating dock on
phones.

**On phones:** Product and Explore sit side by side.

## 3. Global design

- **Typography:** unchanged (IBM Plex Sans Thai, 15 px navigation, existing scale). No text was
  shrunk to fit; the information architecture made room instead.
- **Surfaces:**
  - The scrolled header is 86 % obsidian with a medium blur and no saturation boost.
  - Menu featured panels lost their radial glow.
  - Footer decoration was reduced to one glow.
- **Buttons and CTAs:**
  - The header hierarchy is now explicit: contact = primary pill, sign-in = outline pill,
    language = quiet.
  - The footer has one text link to contact, with its own label so it never duplicates a page's
    "ขอคำปรึกษา" CTA (a test caught this).
  - No new button variants.
- **Icons:** feature rows only, at 16 px in an 8-unit tile; index rows carry none.
- **Cookie UI:**
  - Before: a 34 rem card with an icon tile, glow, two paragraphs and three stacked buttons, which
    covered about half of a 390 px screen.
  - After: a 25 rem card with one sentence, the honesty note and privacy link inline, two equal
    buttons side by side and a quiet settings link. It covers about a quarter of the screen.
  - The body copy was shortened to the same meaning in TH / EN / ZH (essential cookies only;
    others with consent).
  - Consent behaviour and the preferences dialog are unchanged.
- **Floating dock:** unchanged.
  - It already waits for the consent decision on phones.
  - Z-order is coherent: dock 40 < header 50 < cookie 60 < mobile menu 70.

## 4. Motion

**Removed:**

- the Warehouse hero lot's endless bob (it now arrives once)
- the Why CORE warning dot's endless pulse
- three animated menu visuals (department mosaic, tier steps, architecture stack)
- the footer network and orbit geometry

**Reduced** (global tokens, 18 files):

- reveal rises 12 px in 0.6 s, instead of 24 px in 0.75 s
- stagger is 0.06 s, instead of 0.08 s
- hover lift is 2 px, instead of 4 px

**Added:** the header current-dot fade (0.3 s).

**Kept:**

- CORE World
- the homepage department-world art loops (they illustrate work)
- slow ambient drifts
- the Product menu's moving dash (it shows a handoff)

Reduced motion still stops every CSS loop, and Framer Motion still honours the OS setting.

## 5. Page audit (classified before editing)

| Page | Class | EP18 action |
| --- | --- | --- |
| Homepage (EP04) | A — flagship | Left as is (CORE World intact); calmer reveals via tokens |
| Departments + six pages (EP06) | B | Warehouse hero bob removed. "Today" tiles kept (they mirror the product UI). Warehouse remains free of financial values. |
| Pricing (EP07) | B | Early-adopter benefits: cards-in-a-card → divided columns in one frame. Add-on cards kept (structured plan data). Prices unchanged. |
| How CORE Works (EP08) | B | Human Error: a 3 + 2 card grid → **one connected sequence** on a rail (PREVENT → TRACE), each with its concrete example beside it. Plus a guide link (EP17). |
| Solutions (EP09) | A | Unchanged |
| Enterprise (EP10) | A− | Unchanged (no card walls) |
| Industries (EP11) | A | Unchanged; motifs stay distinct |
| About (EP12–13) | A — signature | Unchanged |
| Why CORE (EP12) | A | Pulsing dot made static |
| Contact (EP13) | A | Unchanged (seven paths, multi-step, frontend-only honesty) |
| Demo (EP14) | A | Unchanged (role switch, states, Warehouse data model) |
| Security (EP15) | A | Unchanged; now reached from About |
| Resources + seven guides (EP16) | A | Unchanged |
| Login (EP15) | A — signature | Unchanged (auth logic untouched) |
| `/features` (legacy) | **C** | Card wall → **editorial numbered index on hairlines**; safeguards as divided columns |
| Privacy / Terms | B | Left calm and readable (placeholders) |
| 404 (EP17) | A | Unchanged |

**Changed most visually:**

- the header and all menus
- the footer
- the cookie banner
- `/features`
- the How CORE Works Human Error chapter
- the Pricing early-adopter block

**Left almost unchanged on purpose:** Homepage, Solutions, Enterprise, Industries, About, Why CORE,
Contact, Demo, Security, Resources and Login.

**Not done:** EP18 did not resize heroes or rewrite page sections beyond the above. That is
deliberate restraint, not an oversight.

## 6. Owner decisions to review (trade-offs)

1. **Pricing deep links.** The four package-specific header links (`?plan=…`) are gone; Product →
   แพ็คเกจ opens `/pricing`, and choosing a plan happens there. Deep links still work.
2. **Security placement.** It moved from สำหรับองค์กร to เกี่ยวกับเรา and left the footer.
3. **Index rows.** Departments and industries appear as compact name-only rows inside Product
   and Solutions. This keeps every one a single step away without a card grid.
4. **Cookie copy.** The banner body was shortened (same meaning, all three locales).
5. **New footer link label.** "คุยกับทีม PDA BLISS" / "Talk to the PDA BLISS team" /
   "与 PDA BLISS 团队沟通".
6. **Footer content removed:** the contact chips and the byline.

## 7. QA

- **Responsive sweep.** 15 representative routes (TH / EN / ZH mixed) at 320, 375, 390, 430,
  768, 820, 1024, 1280, 1366, 1440, 1536, 1600 and 1920 px — 195 loads. All passed:
  - no horizontal overflow and one H1
  - header bar overflow 0
  - sign-in labelled wherever the bar shows
- **Open menus at 1280 px (TH / EN / ZH):** no content overflow, 400–476 px tall, 5–11 links.
- **Browser review:**
  - header at 768, 1280, 1440 and 1920
  - all four menus (TH)
  - active state (EN Solutions on an industry page; ZH 资源 on a guide)
  - mobile menu, closed and expanded
  - footer at 1440 and 390
  - cookie banner at 1440 and 390
  - `/features`
  - the How CORE Works Human Error chapter
- **Console:** fresh loads of 18 routes, including the 404 and login, show no errors or
  warnings.

## 8. SEO and safety regression

- **EP17 contract** (all passing):
  - 105 static heads, canonical, hreflang, Open Graph
  - sitemap, robots and index policy
  - 404 and alias redirects
  - the route metadata registry
  - `npm run test:prerender`: 105 pages + 3 shells pass
- **Discoverability:** registry updated; walk and anchors pass.
- **Claim scan:** the shared scanner passes on all copy, and an extra scan of the rewritten shell
  dictionaries finds no claim, absolute-error wording or price value.
- **Product boundaries:** the Warehouse privacy, Accounting boundary and industry boundary suites
  pass. Pricing tests pass with prices unchanged.

## 9. Gates

| | Frontend | Backend |
| --- | --- | --- |
| Install | `npm ci` (0 vulnerabilities) | `npm ci` (0 vulnerabilities) |
| Typecheck | pass | pass |
| Lint | pass | pass |
| Format | pass | pass |
| Tests | 29 files, **789 passed** | 4 files, **21 passed** |
| Build | pass (≈ 13.7 s, includes the prerender and its verification) | pass |
| Prerender | 105 pages + 3 shells verified | — |

## 10. Performance (vs EP17 `105cbe1`)

| | EP17 | EP18 |
| --- | --- | --- |
| Initial JS (entry + preloaded) | 917.2 kB (275.7 kB gz) | **903.5 kB (272.5 kB gz)** — −13.8 kB / −3.2 kB gz |
| CSS | 299.3 kB (46.1 kB gz) | 297.3 kB (46.0 kB gz) |
| All JS | 3,760 kB | 3,744 kB |
| Route chunks (Pricing, How CORE Works, Features, About) | — | each within ±0.5 kB |
| Static HTML | 108 files, about 384 kB | unchanged |

The smaller first load comes from the shorter navigation dictionaries, the retired menu visuals
and the simpler footer. There is no new GPU work, and one fewer infinite animation.

## Deferred

- **EP19:** real-device responsive and accessibility coverage.
- **EP22.1:** production host verification of the static route HTML, `404.html` and `_redirects`.

## Not done

- **Not started:** EP19.
- **Not pushed.**
