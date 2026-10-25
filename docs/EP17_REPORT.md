# EP17 — Full Localization + SEO Hardening + Navigation Discoverability Audit

**Date:** 2026-10-25 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** `c65f126` (EP16, approved and pushed). Before work: branch `main`, `main` ==
`origin/main` == `c65f126`, working tree clean.

**Commit:** `feat: harden CORE localization SEO and public discovery (EP17)` — local only, **not
pushed**. Awaiting owner review.

## Scope

Public frontend hardening only. Unchanged:

- the header and footer design
- `/app/*`
- prototype auth mechanics
- the backend, database and Prisma

No new dependencies.

Details live in:

- [SEO_LOCALIZATION.md](SEO_LOCALIZATION.md)
- [PUBLIC_ROUTE_DISCOVERABILITY.md](PUBLIC_ROUTE_DISCOVERABILITY.md)

## Inventory

- **35 indexable public routes in each locale:**
  - TH 35, EN 35, ZH 35 → 105 URLs, all in the sitemap
  - plus `/login`, which is unprefixed and `noindex`
- **Not public:** `/app/*` and the Design Lab.

## Defects found and fixed

1. **Canonical:** `index.html` hard-coded `canonical` and `og:url` to the homepage, so every page
   declared itself a duplicate of `/`. Both are now route-aware, one per page.
2. **Hreflang:** no page emitted alternates (only the sitemap had them). Every indexable page now
   has reciprocal th / en / zh-CN / x-default alternates.
3. **Open Graph locale:** fixed at `th_TH` on English and Chinese pages. It now follows the page,
   with `og:locale:alternate`.
4. **Legal descriptions:** `/privacy` and `/terms` reused the homepage description in all three
   locales. They now have their own.
5. **404:** was indexable and carried the homepage canonical. It is now `noindex` with no
   canonical, and adds Resource Center and contact as onward paths.
6. **Language switch** dropped the query (`?plan=`, `?interest=`, `?role=`). It now keeps query
   and hash.
7. **Chinese terminology:**
   - Executive: 高管 → **管理层** (16)
   - Exception: 例外 → **异常** (43)
   - Expiry: 保质期 → **有效期** (13)
   - Human Error: 人为错误 → **人为差错** (8)
   - Operational Finance: 业务财务 → **运营财务** (1)
8. **Language of the Thai previews:** five inert / `aria-hidden` product-UI previews show the real
   Thai product on English and Chinese pages without `lang="th"`. They are now marked.
9. **Contextual discovery:** guides were only linked from inside the Resource Center. Three quiet
   links now lead from the product pages that raise the question:
   - How CORE Works → its guide
   - Security's Warehouse chapter → Warehouse Privacy
   - Enterprise implementation → Implementation Guide
10. **`/login` metadata:** it had its own ad-hoc `noindex` effect, now replaced by the shared
    `usePageMeta(..., { index: false })`. The visual and auth behaviour are unchanged.

## Added

- **`lib/seo.ts`** — one typed model: base path, absolute URL, alternates, Open Graph locales and
  the WebSite schema.
- **`usePageMeta`** — now the single route-aware head manager.
- **`WebSite` JSON-LD** on the homepage. Organization is unchanged on About and Contact.
- **`test/discoverability.ts` + `.test.tsx`** (7 tests):
  - a registry for every route
  - declared entries verified against the config and the rendered pages
  - a breadth-first walk from `/` (orphans, measured depth)
  - every rendered link resolves
  - every anchor exists (more than 20 checked)
- **`test/seo.test.tsx`** (27 tests). For all 105 pages it checks:
  - one H1, `lang`, a single description
  - one correct canonical
  - reciprocal hreflang
  - `og:url` and `og:locale`
  - unique titles and descriptions
  - localized metadata (no Thai, Simplified Chinese only)
  - the claim scan over titles, descriptions and JSON-LD
  - Warehouse metadata with no amounts
  - locale preservation of every internal link
  - structured-data types and a fake-schema guard

  It also covers:
  - `/login` noindex
  - five 404 cases, including an unsupported locale and a malformed prefix
  - four alias redirects with no loop
  - trailing-slash canonical
  - language switch keeping query and hash
  - sitemap XML validity, completeness and alternates
  - robots.txt
  - `index.html`
- **`GuideLink`** — the contextual guide link.

## Decisions

- **`/login`:** `noindex`, not in the sitemap, reachable from the header and mobile menu.
- **`/demo`:** indexable (sitemap 0.7). It is the most concrete public explanation of the product,
  with no sign-up or personal data.
- **`/privacy`, `/terms`:** indexable, honest placeholders, linked from every footer.
- **Breadcrumb JSON-LD:** not added. The only visible breadcrumb ends at a category, not a page.
- **FAQ, SoftwareApplication, Article and Review schemas:** not used.
- **Redirects:** no legacy public routes exist, so none were added. Existing alias redirects
  were verified.

## QA

- **Browser, desktop:**
  - canonical, hreflang, OG and `lang` verified live on `/en/pricing?plan=business`
  - client-side navigation swaps them cleanly (security → home with WebSite → contact with
    Organization → 404 with noindex)
- **Responsive sweep:** 14 representative routes (home, pricing, how-core-works, solutions,
  enterprise, an industry, about, contact, demo, security, resources, a guide, login, 404) at
  320 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920, across TH, EN and ZH samples. Every
  load has no horizontal overflow and one H1.
  - **Header items:** the bar never overflows. Contact and sign-in are in the header from 768
    px; below that they are in the mobile menu, as designed.
- **Mobile menu (ZH):** overview + seven groups; ความรู้ / 资源 shows all seven guides and the
  Resource Center; it scrolls; contact and sign-in are pinned.
- **Console:** fresh loads of 17 routes show no errors or warnings. Errors seen in the long-lived
  dev tab were hot-reload artefacts of the edits.
- **Landmarks:** one `main`, a site header and a footer on every public page, plus a skip link.
  Navs are labelled, except one inside an `aria-hidden` product preview.

## Follow-up: static prerendered head (owner review, conditional pass)

**Root cause.** The build emitted one shared `index.html`. Route metadata was correct only after
React ran, so the initial HTML of every URL carried the Thai homepage title and description and
no canonical, alternates or `og:url`. Crawlers and link-preview agents that do not run
JavaScript therefore saw the wrong page.

**Fix.** `npm run build` now prerenders each indexable URL's head into its own static file:
105 pages plus `login.html`, `404.html` and `app.html`. It uses:

- `src/seo/routeMeta.ts` — the route registry, built from the same copy objects the pages use
- `lib/seo.ts` — `headFor` / `headHtml`
- Vite's own SSR build mode
- `scripts/prerender.mjs`, then `scripts/verify-prerender.mjs`

There is no runtime server and no new dependency. Host rules ship in `dist/_redirects`. See
[SEO_LOCALIZATION.md](SEO_LOCALIZATION.md#static-prerendered-head-ep17-follow-up).

**Supporting changes:**

- `PUBLIC_ROUTES` moved to `src/config/publicRoutes.ts`; the test module re-exports it.
- The `/features` and legal copy moved into data modules, unchanged.
- `index.html` route tags sit between markers.
- `main.tsx` hands the prerendered tags over to `usePageMeta`.
- The locale aliases are real 301s at the host.

**Verified:**

- **Build-time check:** all 105 files, without JavaScript — lang, title, description,
  canonical, four alternates, OG title / description / URL / locale / alternates / image,
  JSON-LD, Thai and Chinese leakage, claims, Warehouse values, uniqueness, localhost.
- **Mutation:** copying the generic `index.html` over `en/pricing.html` makes the check fail with
  11 errors.
- **Runtime parity:** the vitest suite proves the runtime head equals `routeHead()` for all 105.
- **Browser on the built output** (local static host emulating Cloudflare Pages):
  - direct load and refresh on nested localized routes
  - client-side navigation with no duplicate canonical or JSON-LD
  - the language switch keeping `?plan=business#packages`
  - 404s (HTTP 404, localized page)
  - `/app/*` → gate → login
  - `/en/login` → English gateway
  - alias 301s
  - lazy chunks and no console errors
- **Timing:** about 3 s added to the build (SSR compile 1.3 s, writing 0.1 s, verification
  1.7 s); a full build takes about 15 s.

## Gates

| | Frontend | Backend |
| --- | --- | --- |
| Install | existing `node_modules` (lockfile unchanged; a fresh `npm ci` of the baseline in a temporary worktree also built) | `npm ci` (0 vulnerabilities) |
| Typecheck | pass | pass |
| Lint | pass | pass |
| Format | pass | pass |
| Tests | 29 files, **781 passed** (746 before) | 4 files, **21 passed** |
| Build | pass, with prerender + verification of 105 pages | pass |
| Built-output SEO | `npm run test:prerender`: 105 pages + 3 shells pass | — |

## Bundle (fresh baseline build of `c65f126` vs EP17, same toolchain)

| | EP16 | EP17 |
| --- | --- | --- |
| Initial JS (entry + preloaded chunks) | 912.3 kB (273.2 kB gz) | 917.2 kB (275.7 kB gz) |
| All JS | 3,755 kB | 3,760 kB |
| HTML | 1 file | 108 files, about 384 kB in total (about 3.6 kB each) |

**+4.9 kB raw / +2.4 kB gz** on first load. Route chunks are unchanged in size; no guide or page
copy entered the initial JS (the metadata registry is never imported by the client). The
increase comes from:

- the metadata layer
- the WebSite schema on the homepage
- the 404 links
- the query-preserving language switch
- the 0.5 kB hand-over of prerendered tags at boot

Rolldown also moved some shared modules between the entry and the shared `tokens` chunk; both
load initially, and the table counts them together.

## Deferred to EP18 (Global Visual / Navigation Refinement)

- **Header consolidation:** fewer top-level items. The 1280–1535 px icon-only sign-in is an
  accepted EP16 trade-off — not an accessibility bug, since the sign-in link keeps its accessible
  name.
- **Footer consolidation and density.**
- **Global visual polish.**

## Not done

- **Not started:** EP18.
- **Not pushed.**
