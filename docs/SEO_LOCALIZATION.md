# SEO and Localization — PDA BLISS CORE public site (EP17)

How the public site is localized, how every page describes itself to search engines, and the
rules that tests keep in place.

Route discoverability is documented separately in
[PUBLIC_ROUTE_DISCOVERABILITY.md](PUBLIC_ROUTE_DISCOVERABILITY.md).

## Locale architecture

There is one architecture and it is unchanged since EP05 (`frontend/src/i18n/locales.ts`).

| Locale | URL prefix | `<html lang>` / hreflang | Open Graph locale |
| --- | --- | --- | --- |
| Thai (default) | none — `/pricing` | `th` | `th_TH` |
| English | `/en` — `/en/pricing` | `en` | `en_US` |
| Simplified Chinese | `/zh` — `/zh/pricing` | `zh-CN` | `zh_CN` |

- **Unprefixed areas:** `/login` and `/app/*` are never prefixed.
- **Shell words:** live in `i18n/messages/{th,en,zh-CN}.ts`. English and Chinese load as separate
  chunks.
- **Page words:** live in each feature's `Localized<T>` copy object. TypeScript forces every locale
  to carry the same keys as Thai.
- **`<html lang>`:** set by `LocaleProvider`.
- **Thai inside English or Chinese pages:**
  - The real Thai product UI in inert / `aria-hidden` previews carries `lang="th"` (EP17).
  - The company address is printed in Thai on purpose, marked with `lang="th"`.
- **Chinese:** Simplified only. `zh-TW`, `zh-HK` and other Traditional variants are not offered.

### Language switch

The language selector, desktop and mobile, links to the same page in the other locale. It keeps
the query and the hash:

- `/pricing?plan=business#packages` → `/en/pricing?plan=business#packages`
- `/contact?interest=…`
- `/demo?role=warehouse`

Before EP17 the query was dropped.

### Locale preservation

All internal links go through `href()` / `localizePath()`. A test renders every public page
under `/en` and `/zh` and fails on any internal link that leaves the locale. The only exception
is `/login`, which carries the locale in router state (EP15).

## Metadata architecture

There is one route-aware source, and no second system. It is applied twice — at build time,
into each route's static HTML, and in the browser during client-side navigation:

- `frontend/src/lib/seo.ts` — the typed model:
  - `basePath()` — strip the locale, double slashes and any trailing slash
  - `absoluteUrl(path, locale)`
  - `alternatesOf(path)`
  - `OG_LOCALE`, `PAGE_DEFAULTS`, `pageTitle()`
  - `headFor()` → a `PageHead` (lang, title, description, canonical, alternates, OG locale,
    robots, JSON-LD), and `headHtml()` to serialize it
  - `websiteSchema(locale)`
- `frontend/src/seo/routeMeta.ts` — the build-time route registry: for every route in
  `config/publicRoutes.ts`, the title and description its page passes to `usePageMeta`, read from
  the **same copy objects** the page renders (never retyped), plus its approved structured data.
  `routeHead(route, locale)` returns the route's `PageHead`. Nothing in the client app imports it.
- `frontend/src/lib/usePageMeta.ts` — the hook every public page already called. A page passes
  localized `title` and `description`; the hook applies `headFor()` to the live document:
  - `<title>` as `Title | PDA BLISS CORE` (the homepage uses `PDA BLISS CORE — <positioning>`)
  - `meta[name=description]`, `og:title`, `og:description`
  - **one** `link[rel=canonical]` on the production origin, in the page's own locale
  - `link[rel=alternate][hreflang]` for `th`, `en`, `zh-CN` and `x-default` (→ Thai)
  - `og:url` (= canonical), `og:locale` and two `og:locale:alternate`
  - `meta[name=robots]=noindex` instead of canonical and alternates when `{ index: false }`

The hook marks the elements it owns and removes them when the page changes, so client-side
navigation never leaves stale or duplicate canonicals.

`index.html` is the template. Its route-specific tags sit between `<!-- seo:head -->` markers
(the Thai homepage defaults, used only by the dev server); `og:type`, `og:site_name`, the shared
`og:image` (`/brand/og-image.png`, 1200 × 630) and `twitter:card` are shared by every page.
Before EP17 it hard-coded `canonical` and `og:url` to the homepage for every route.

## Static prerendered head (EP17 follow-up)

**Why client-only metadata was not enough.** The site is a Vite/React SPA. Before this step the
build produced one shared `index.html`, so the initial HTML of every URL — `/en/pricing`,
`/zh/security` — carried the Thai homepage title and description and no canonical, alternates
or `og:url` until React mounted. Google renders JavaScript, but other crawlers and almost all
link-preview agents (LINE, Facebook, Slack, X…) read only the initial HTML.

**Strategy: build-time static head, no runtime server.** `npm run build` now runs:

1. `tsc -b` and `vite build` — the client bundle, unchanged.
2. `vite build --ssr src/seo/prerender.ts --outDir dist-prerender` — compiles the metadata
   registry for Node (Vite's own SSR mode; no new dependency).
3. `node scripts/prerender.mjs` — writes one HTML file per indexable URL from the built
   template, with its complete head, `<html lang>` and a localized `<noscript>`. The body is the
   unchanged SPA shell; pages still render client-side.
4. `node scripts/verify-prerender.mjs` — checks every written file without running JavaScript;
   any failure fails the build. It also runs alone: `npm run test:prerender`.

There is no Next.js, no SSR server and no headless browser. Body content is not prerendered;
only the head, which is what crawlers and previews need to identify the page.

**Generated output (108 HTML files, about 384 kB):**

| File | Serves | Head |
| --- | --- | --- |
| `index.html`, `en.html`, `zh.html` | `/`, `/en`, `/zh` | Homepage in that locale (+ WebSite JSON-LD) |
| `<route>.html`, `en/<route>.html`, `zh/<route>.html` (102) | every other public route | That route, in that locale |
| `login.html` | `/login` (and `/en/login`, `/zh/login` via rewrite) | Sign-in, `noindex`, no canonical |
| `404.html` | any unknown URL (HTTP 404) | Neutral `PDA BLISS CORE`, `noindex`; the app renders the localized 404 |
| `app.html` | `/app/*` via rewrite | Neutral, `noindex`; the prototype workspaces render client-side |
| `_redirects` | — | Host rules (below) |

Files are `<path>.html`, not `<path>/index.html`, so the host serves `/en/pricing` directly
with status 200 and never adds a trailing slash — the canonicals have none.

**Hand-over at runtime.** Elements the hook swaps during navigation (canonical, alternates,
`og:locale:alternate`, robots, JSON-LD) carry `data-prerendered`; `main.tsx` removes them
before the app mounts, and `usePageMeta` and the schema components recreate them, so nothing is
ever duplicated. Title, description, `og:title`, `og:description`, `og:url` and `og:locale` are
updated in place.

**Hosting requirement.** No backend is needed: `dist/` is a static site. The host must:

- serve `/<path>` from `<path>.html` with status 200 (Cloudflare Pages and Workers static
  assets do this by default; nginx: `try_files $uri $uri.html =404`)
- serve `404.html` with status 404 for unknown paths (Pages / Workers `not_found_handling:
  "404-page"`; nginx: `error_page 404 /404.html`), **not** an SPA fallback to `index.html` —
  that would give unknown URLs the homepage head
- apply `dist/_redirects` (Cloudflare Pages / Netlify syntax; translate for other hosts):

```
/th            /             301
/th/*          /:splat       301
/zh-CN         /zh           301
/zh-CN/*       /zh/:splat    301
/zh-hans       /zh           301
/zh-hans/*     /zh/:splat    301
/en/login      /login        200
/zh/login      /login        200
/app/*         /app          200
```

  The 301s make the locale aliases real redirects for crawlers (the app also redirects
  client-side). The 200 rewrites keep `/en/login`, `/zh/login` and `/app/*` working as SPA
  routes on their `noindex` shells.
- redirect `/path/` → `/path` (Pages and Workers' default `auto-trailing-slash` does).

There is no deployment configuration in the repository yet. These rules were verified against a
local static server that emulates the Pages resolution order; confirm them on the first real
deployment.

**Tests protecting the initial HTML.**

- `scripts/verify-prerender.mjs`, run after every build, parses all 105 files with jsdom
  (no script execution). For each it checks:
  - `<html lang>`, exactly one `<title>` and one description, both equal to the route's
  - canonical, the four alternates and `og:url`, computed independently from the URL rules
  - `og:title`, `og:description`, `og:locale` and its alternates, `og:image`
  - no robots block; the approved JSON-LD types only
  - no `localhost`; English and Chinese free of Thai, Chinese free of Traditional characters
  - the shared claim scanner over title, description and JSON-LD; no financial values in
    Warehouse metadata
  - unique titles and descriptions — so a generic homepage `index.html` copied to a route fails
    immediately (11 errors for one file in a deliberate test)
  - the shells are `noindex` with no canonical; exactly the expected 108 HTML files exist
- `src/test/seo.test.tsx` proves that what each page renders through `usePageMeta` equals
  `routeHead()` for all 105 URLs — the static HTML and the live page cannot drift apart.

**Social metadata.** X / Twitter reads the Open Graph tags; only `twitter:card` is declared. No
article dates or authors exist anywhere.

### Titles and descriptions

- Each of the 35 routes × 3 locales has a unique title and a unique description, tested.
- EP17 gave `/privacy` and `/terms` their own descriptions; they had reused the homepage
  description.
- English and Chinese metadata contain no Thai letters. `฿` is allowed on `/en/pricing` as a
  currency sign.
- Chinese metadata contains no Traditional characters.

## Canonical strategy

- **Self-referencing, per locale:** `/en/pricing` → `https://core.pdabliss.com/en/pricing`.
- **Query and hash** are not part of a page's identity: `?plan=` and `#packages` are dropped.
- **Trailing slash:** never in canonicals or the sitemap, except the Thai root
  `https://core.pdabliss.com/`. `/en/pricing/` renders and canonicalizes to `/en/pricing`.
- **Locale roots:** `/en` and `/zh`, with no trailing slash.
- **Origin:** `SITE.url`, which reads `VITE_SITE_URL` and defaults to `https://core.pdabliss.com`.
  The built HTML, sitemap and robots.txt contain no `localhost`, tested.

## Hreflang strategy

- **Alternates:** every indexable page lists the same four — `th`, `en`, `zh-CN` and `x-default`
  (the unprefixed Thai URL, which is the default locale).
- **Reciprocity:** all three locales compute alternates from the same base path, so they are
  reciprocal by construction. A test also checks each alternate against the canonicals actually
  rendered.
- **Sitemap:** declares the identical set per URL.
- **Static HTML:** every prerendered file carries the same alternates as plain `<link>` tags.

## Sitemap

- **File:** `frontend/public/sitemap.xml` is the single sitemap, with 105 URLs (35 routes × 3
  locales).
- **Tests check:**
  - the XML is well-formed
  - there are no duplicate URLs
  - the URL set equals `PUBLIC_ROUTES × locales` built with `absoluteUrl()`
  - each entry's `xhtml:link` alternates equal `alternatesOf()` for that route
  - there is no `/login`, `/app`, 404 or non-production host
- **Adding a page:** add it to `test/publicRoutes.ts`; the tests then say exactly which sitemap
  entries are missing.

## Robots and indexing

`robots.txt`: `Allow: /`, `Disallow: /app/`, `Sitemap: https://core.pdabliss.com/sitemap.xml`.

| Route | Policy | Why |
| --- | --- | --- |
| All public marketing pages, `/resources/*`, `/demo` | index | Public, content-bearing, linked |
| `/login` | `noindex`, no canonical, not in sitemap | A prototype sign-in gateway, not a landing page. It has no content worth ranking, and indexing it would invite credential searches. Reachable from the header and mobile menu. |
| `/demo` | **index** (sitemap 0.7) | A public, no-signup, no-personal-data interactive walkthrough of one work item — the most concrete explanation of the product. It is linked from How CORE Works, five department pages, Solutions, Why CORE and Resources. |
| `/privacy`, `/terms` | index | Real legal entry points, linked from every footer. They honestly say the official document is being prepared. |
| 404 (any unknown URL) | `noindex`, no canonical or alternates | Not a page |
| `/app/*` | disallowed in robots.txt, never linked from public pages, behind the prototype gate | Internal application |

## Structured data

Only schemas that match visible content are used:

| Page | Schema | Content |
| --- | --- | --- |
| `/` (each locale) | `WebSite` (EP17) | Site name, the locale's home URL, `inLanguage`, and the publisher PDA BLISS COMPANY LIMITED |
| `/about`, `/contact` | `Organization` (EP13) | Legal name (EN / TH), URL, the canonical address, phone, email and LINE — from `config/company.ts` |

The following are deliberately not used:

- **`BreadcrumbList`:** the only visible breadcrumb is in the resource guides (Resources ›
  category), and the category is not a page.
- **`FAQPage`:** the `/security` FAQ is real, but rich-result eligibility for FAQ is limited, so
  the schema adds little.
- **`SoftwareApplication`:** it would need offers and prices outside `/pricing`.
- **`Article`, `Review`, `AggregateRating` and `Person`.**

A test fails on any `aggregateRating`, `review`, `author`, `datePublished`, `award` or `offers`
in JSON-LD.

## 404, invalid locales and redirects

| URL | Result |
| --- | --- |
| `/anything-unknown` | Thai 404 inside the public shell, `noindex`, links to home, Resource Center and contact |
| `/en/unknown`, `/zh/unknown` | The same 404 in that locale (`lang`, copy and links) |
| `/fr/pricing` (unsupported locale) | Thai 404. It does not redirect to a guessed page. |
| `/en/en/pricing` (malformed) | English 404 |
| `/th/…`, `/zh-CN/…`, `/zh-hans/…` | Redirect to the canonical prefix (`/…`, `/zh/…`), keeping path, query and hash (EP05) |
| `/en/login`, `/zh/login` | Redirect to `/login` with the locale in router state (EP15) |
| `/pricing/` | Same page; canonical `/pricing` |

No legacy public routes were found in the history, so no new redirects were added. Every
redirect above is single-hop, with no loops (tested).

## Terminology (EP17 alignment)

The EP16 CORE Glossary is the reference. Concrete splits found and fixed in Simplified Chinese:

| Concept | Before | Now |
| --- | --- | --- |
| Executive (role) | 高管 (security, resources) vs 管理层 (department registry and 27 files) | **管理层** |
| Exception | 例外 (demo, departments, industries…) vs 异常 (glossary, How CORE Works, Solutions) | **异常** |
| Expiry | 保质期 (shelf life) vs 有效期 | **有效期** |
| Human Error | 人为错误 vs 人为差错 | **人为差错** |
| Operational Finance | 业务财务 vs 运营财务 | **运营财务** |

`移交` (handing documents over to Finance) is a different act from `交接` (work handoff) and was
kept.

Thai and English terms were consistent. Thai keeps established product terms in English
(Workflow, Lot, FEFO, Human Error, Handoff). `ตรวจสอบย้อนหลัง` names the audit capability,
distinct from `ย้อนรอย` (trace).

## Claim safety and boundaries

- **Shared scanner:** `frontend/src/test/claims.ts` (EP15, shared since EP16) now also runs over
  every page's title, description and JSON-LD in all locales. It blocks:
  - ISO / SOC 2 / PCI / HIPAA / GDPR / certified / compliant
  - guarantee, uptime
  - penetration testing
  - immutable / tamper-proof
  - RPO / RTO
  - "100 %"
  - the Thai and Chinese equivalents
- **Absolute error claims:** zero errors, error-free, eliminate, 零差错 and similar are blocked in
  metadata too.
- **Warehouse privacy:** warehouse-related metadata (`/departments/warehouse`,
  `/resources/warehouse-privacy`) contains no currency or amount in any locale.
- **Product boundaries:** EP17 adds no new claims, and the existing tests for these boundaries
  still pass. They are:
  - Accounting = operational finance (not a ledger, journal or tax system)
  - Retail is not a POS
  - Property is not PDA BLISS Property & Rental Management
  - Manufacturing is not an MRP / MES

## Known limitations

- **Head only:** the static HTML carries each page's complete head, but its body is the SPA
  shell — page text still needs JavaScript. Full body prerendering is not part of EP17.
- **Hreflang scope:** hreflang is per page, not per query (`?plan=`).
- **Unused message keys:** not exhaustively audited. TypeScript guarantees key parity across
  locales, not usage.
