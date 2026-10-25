# EP16 — CORE Knowledge Resource Experience

**Date:** 2026-10-25 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** `86b16f7` (EP15, approved and on `origin/main`). Before EP16 began: branch `main`,
local `main` == `origin/main`, working tree clean.

**Commit:** `feat: create CORE knowledge resource experience (EP16)` — local only, **not
pushed**. Awaiting owner visual review.

**Two sessions.** A first session built the registry, search, `/resources` home and all seven
guides in TH / EN / ZH, then hit its limit before routing. A second session continued from that
uncommitted tree without regenerating the guides. It completed:

- routing
- the navigation change the owner requested mid-episode
- metadata and sitemap
- tests
- QA and fixes
- documentation

Details of the experience are in [RESOURCES_EXPERIENCE.md](RESOURCES_EXPERIENCE.md).

## Scope

Public frontend only. Not changed:

- `/app/*`
- prototype auth / login behaviour
- backend business logic
- the database and Prisma

No new dependencies.

## Delivered

**Routes.** These are lazy route chunks, each in th / en / zh:

- `/resources`
- `/resources/getting-started`
- `/resources/how-core-works`
- `/resources/human-error`
- `/resources/warehouse-privacy`
- `/resources/implementation-guide`
- `/resources/security-and-data`
- `/resources/core-glossary`

**Header (owner request during EP16).**

- **Text navigation:** ภาพรวม · แผนก · แพ็คเกจ · วิธีการทำงาน · โซลูชัน · สำหรับองค์กร ·
  **ความรู้** · เกี่ยวกับเรา.
- **ความรู้ (Resources / 资源):** opens a mega menu with the seven guides, including Warehouse
  Privacy. Its highlight is the Resource Center → `/resources`, and it has its own small "search
  over an index" visual.
- **ติดต่อเรา:** moved out of the text navigation into a primary pill beside the language
  selector and เข้าสู่ระบบ, shown from 768 px. The mobile menu keeps it pinned at the bottom.
  `/contact` remains reachable from the header, footer, mobile menu, floating dock and every page
  CTA.
- **Fit:**
  - Type stays 15 px.
  - Between 1280 and 1535 px the bar uses tighter item padding and a smaller chevron, and
    sign-in becomes an icon button that keeps its accessible name.
  - Measured free space is at least 30 px (English, the longest) at 1280, 1366, 1440, 1536, 1680
    and 1920 px in all three locales.

**Footer.** ความรู้ → `/resources` was added to ลิงก์ด่วน. There is no other footer change.

**Metadata.** Each of the 24 route × locale pages has a unique title, description and OG title /
description, and exactly one H1. There are no dates, authors or Article structured data.

**Sitemap.** 81 → 105 URLs, using the existing hreflang pattern. `/resources` has priority 0.7;
guides have 0.6. The routes are in the shared `test/publicRoutes.ts`.

## Fixes and refinements made while finishing

- **Type error:** the How CORE Works guide failed typecheck (union of stage shapes). It now uses
  a widened view type.
- **Lint:**
  - The search normalizer contained literal zero-width characters (`no-irregular-whitespace`);
    they are now escaped.
  - `CATEGORY_ACCENT` moved to `accent.ts` (react-refresh).
- **Filter keyboard:** the library, glossary and department filters were radio groups without
  arrow-key support, and showed selection by fill only. They now share one `ChipGroup`: a single
  tab stop, arrows / Home / End, and a check mark on the selected chip.
- **Checklist:** the implementation checklist gained **Reset** ("ล้างรายการ"). It is still in
  memory only.
- **Glossary:** 12 more terms gained an example (19 of 22, TH / EN / ZH), all built on the
  SO-1042 scenario.
- **Reading times:** How CORE Works 8 → 6 min and Implementation 9 → 5 min, to match the copy
  (a test now checks every estimate).
- **Related links:** "Related on this site" repeated destinations on Human Error and Warehouse
  Privacy. It now lists each destination once (tested).
- **Warehouse clearance table:** overflowed its figure at 390 px in English. It is now a
  fixed-layout table with tighter mobile cells.
- **Figure captions:** the "Diagram" label no longer wraps on narrow screens.
- **Claim scanner:** the EP15 scanner moved to `src/test/claims.ts`, shared by `/security` and
  the Resource Center. It was moved, not weakened or duplicated.

## Tests

- **New:** `features/resources/resources.test.tsx`, 70 tests.
  - **Registry:** slugs, read-next, guided entries vs EP09 ids, reading time.
  - **Routes:** all 8 × 3 render one H1; unique title, description and OG; article outline order;
    no author or date.
  - **Links:** every internal link on every resource page in every locale:
    - resolves to a public route
    - keeps the locale
    - every `#anchor` exists on its target page (rendered)
    - in-page glossary anchors exist
  - **Read next, related (unique) and CTA.**
  - **Search:**
    - TH / EN / ZH titles, tags, terms and categories
    - normalization (full-width, spacing, zero-width)
    - empty and no-result
    - keyboard (Tab to clear, then results; Escape clears)
    - suggestion chips
    - localized result links
  - **Filters:** category filter, arrow keys, one tab stop, non-colour mark, department picker.
  - **Glossary:**
    - every term has a definition and a localized "where explained" link in every locale
    - example coverage
    - search, A–Z sync and category filter
    - ZH and EN search
  - **Checklist:** toggle, keyboard, reset, no storage, no fetch, no form or submit.
  - **Language:**
    - no Thai in EN / ZH copy or rendered pages
    - Simplified Chinese only
    - ZH is not copied from EN
  - **Claims:** the shared scanner on all copy modules × 3 locales, the absolute-error scan, the
    Accounting ledger / tax negation and the Security guide structure.
  - **Warehouse privacy:**
    - no currency or amount in any locale (copy and rendered)
    - the sample view is operational only
    - the clearance mirrors the backend map
- **Updated:**
  - `header.test.tsx` (+2): the ความรู้ menu, and locale kept on the Resources menu and contact
    action. Top-level order, contact action and keyboard wrap were updated too.
  - `i18n.test.tsx`: English navigation order and contact action.
  - `shell.test.tsx`: footer quick links.
  - `security.test.tsx`: imports the shared scanner.
  - `test/publicRoutes.ts`: +8 routes, which also feed the route, header, language and sitemap
    tests.

## Gates

| | Frontend | Backend |
| --- | --- | --- |
| Install | existing `node_modules` | `npm ci` (0 vulnerabilities) |
| Typecheck | pass | pass |
| Lint | pass (0 warnings) | pass |
| Format | `prettier --check` pass | `prettier --check` pass |
| Tests | 27 files, **746 passed** | 4 files, **21 passed** |
| Build | pass | pass |

No database was used.

## Bundle (vs. the EP15 report's figures)

| Chunk | EP15 | EP16 |
| --- | --- | --- |
| Entry `index.js` | 760.6 kB (225.2 kB gz) | 766.8 kB (226.6 kB gz) — header, ความรู้ menu copy and visual only |
| CSS | 291.6 kB (45.2 kB gz) | 299.3 kB (46.1 kB gz) |
| `ResourcesPage` | — | 20.9 kB (5.7 kB gz), lazy |
| `search` (registry, meta, glossary, search; home + glossary) | — | 25.1 kB (8.7 kB gz), lazy |
| `Article` (shared reading system) | — | 11.0 kB (3.9 kB gz), lazy |
| Guides | — | 7.5–29.2 kB each (3.5–10.3 kB gz), lazy, one chunk per guide |

Full guide copy is never in the home chunk.

## QA

- **Overflow:** no horizontal overflow on all 8 routes at 320 / 390 / 768 / 1280 / 1440 / 1920 px,
  across TH / EN / ZH samples. The only elements wider than the viewport are the intentional
  horizontally scrolling filter-chip rows.
- **Visual review:**
  - `/resources` at 390 and 1440 (TH)
  - Human Error at 1440 (EN)
  - Warehouse Privacy at 390 (ZH)
  - How CORE Works at 1440 (ZH, expanded example)
  - Glossary at 1440 (EN)
  - Implementation checklist at 390 (TH)
- **Regression in the browser:**
  - 16 earlier-episode pages (home, departments, pricing, how-core-works, solutions, enterprise,
    industries, about, why-core, contact, demo, security, `/en/demo`, `/zh/security`): one H1,
    no overflow, no header overflow at 1280.
  - Prototype login: an invalid password shows the alert; `user1` / `pass1` opens
    `/app/executive`.
- **Console:** no errors on fresh loads of all guides. The only errors seen came from one
  transient hot-reload state between two edits.

## Known limitations

- **Search** is substring-based (no typo tolerance or Thai word segmentation).
- **Glossary:** the A–Z index uses English term names in every locale.
- **Metadata** is client-side, like the rest of the site (no prerender).
- **Clearance mirror:** the backend clearance map is mirrored, not imported, in the frontend test.
- **Bundle baseline:** the comparison uses the EP15 report's numbers, not a fresh baseline build.
- **Header at 1280–1535 px:** sign-in is icon-only there to fit nine destinations plus the
  contact pill.

## Not done (by design)

- **Not started:** EP17.
- **Not pushed.**
