# Public Frontend Performance

How PDA BLISS CORE's public website is measured, what it costs to load and run, the budgets
that guard it and the rules for keeping it that way. Established in EP20 (see
[EP20_REPORT.md](EP20_REPORT.md)); update the numbers whenever a change moves them.

> **Scope and honesty.** Every number here is a **local, synthetic, pre-production**
> measurement. None of it is real-user (field) Core Web Vitals data — there is no RUM yet.
> **Real production delivery through Cloudflare (compression, cache headers, HTTP/2–3, per-route
> HTML, redirects, 404) is NOT verified in EP20 or EP21**; it is verified on the public URL in the
> production-deployment phase, after the backend is built (EP21 roadmap update — EP22 freezes the
> public frontend; EP23+ is backend work; deployment and production checks come later).
> Never quote these figures as "the site loads in X seconds for users".

## 1. Measurement method

| | |
| --- | --- |
| Machine | Windows 11 Enterprise, Intel Core i5-12400 (6 cores / 12 threads), 32 GB RAM, NVIDIA GTX 1660 Ti + Intel UHD 730 |
| Runtime | Node 24.19.0, Vite 8.3.5 (Rolldown) production build (`npm run build`) |
| Browsers | Chrome 155 / Edge 156 (installed, headless), Firefox 141 (temporary Playwright build). Safari not available on Windows — **not tested** |
| Tools (temporary, outside the repo) | Playwright 1.64 (CDP throttling, Performance APIs, tracing), Lighthouse 12.8 |
| Server | A temporary local static server that mimics a static host: per-route HTML, `_redirects` (301 + 200 rewrites), `404.html`, brotli-11 / gzip-9 (precompressed), `immutable` cache for `/assets/*`, `no-cache` for HTML. HTTP/1.1 by default; an HTTP/2 + TLS (self-signed) mode for cross-checks |

**Profiles** (applied with CDP — real throttling, not a simulation):

| Profile | Viewport | CPU | Network |
| --- | --- | --- | --- |
| Desktop | 1440 × 900, DPR 1 | 1× | 20 ms latency, 10 Mbit/s down |
| Mobile | 390 × 844, DPR 3, touch | 4× slowdown | 150 ms latency, 1.6 Mbit/s down, 750 kbit/s up (≈ Lighthouse "slow 4G") |

**Runs.** Cold load = new browser context (empty cache) for every run; 3 runs per route and
profile, median reported. Metrics come from the browser itself: `PerformanceObserver` for LCP
(with the element), CLS (with sources), long tasks and paint; Resource Timing for bytes and
requests; CDP `Performance.getMetrics` for idle runtime cost; Event Timing for interactions.
TBT = Σ(long task − 50 ms) after FCP. Warm navigation = one session, in-app link clicks through
11 routes, twice. Lighthouse is used as diagnostic evidence only.

**Representative routes:** `/`, `/features`, `/pricing`, `/how-core-works`, `/solutions`,
`/enterprise`, `/industries/retail`, `/about`, `/contact`, `/demo`, `/security`, `/resources`,
`/resources/human-error` (long guide), `/login`, plus `/en`, `/zh`, `/en/pricing`,
`/zh/resources/human-error`.

## 2. Results (EP19 baseline → EP20)

### Bundle (KiB = 1024 B; gzip-9 / brotli-11 are local estimates)

| | EP19 baseline | EP20 |
| --- | --- | --- |
| Initial JS (entry + modulepreloads every page gets) | 886.6 raw · 267.2 gz · 218.5 br (4 files) | **564.9 raw · 179.4 gz · 151.9 br** (7 files) |
| Initial CSS (one Tailwind stylesheet) | 296.9 raw · 44.5 gz | 296.9 raw · 44.5 gz (unchanged) |
| Entry chunk `index` | 672.1 raw · 196.6 gz | 339.2 raw · 104.4 gz |
| CORE World chunk (three.js + R3F, lazy) | 883.9 raw · 235.5 gz | 884.0 raw · 235.5 gz (unchanged, still lazy) |
| All JS | 3,661 KiB, 94 files | 3,677 KiB, 115 files |
| Static HTML | 108 files, 374.8 KiB | 108 files, 502.7 KiB (per-route preload links, see §4) |
| Modules duplicated across chunks | — | 0 of 910 |

### Cold load, mobile profile (median of 3; ms)

| Route | FCP | LCP | CLS | Max task | Long-task total | JS transferred (KiB) |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 2996 → **2224** | 3856 → **3140** | 0.036 → **0.000** | 789 → **301** | 2272 → **1265** | 423.6 → 433.4 |
| `/features` | 2236 → 1988 | 2456 → 2144 | 0.301 → 0.000 | 276 → 169 | 550 → 377 | 228.3 → 166.8 |
| `/pricing` | 2260 → 2192 | 2964 → 2752 | 0.304 → 0.000 | 276 → 161 | 564 → 372 | 263.0 → 202.4 |
| `/how-core-works` | 2272 → 2120 | 3416 → 2608 | 0.300 → 0.000 | 292 → 174 | 577 → 523 | 273.7 → 238.8 |
| `/solutions` | 2224 → 2148 | 3428 → 2824 | 0.300 → 0.000 | 274 → 176 | 659 → 667 | 266.6 → 231.4 |
| `/enterprise` | 2232 → 2068 | 3344 → 2536 | 0.300 → 0.000 | 277 → 163 | 560 → 373 | 265.5 → 203.6 |
| `/industries/retail` | 2228 → 2080 | 2576 → 2360 | 0.333 → 0.000 | 270 → 160 | 759 → 655 | 250.1 → 186.2 |
| `/about` | 2248 → 2156 | 3656 → 3096 | 0.312 → 0.000 | 723 → 517 | 1613 → 1122 | 259.6 → 203.3 |
| `/contact` | 2212 → 2092 | 2464 → 2276 | 0.302 → 0.000 | 269 → 165 | 575 → 392 | 262.8 → 200.7 |
| `/demo` | 2208 → 2076 | 2392 → 2220 | 0.303 → 0.000 | 267 → 166 | 532 → 375 | 247.1 → 184.4 |
| `/security` | 2256 → 2176 | 3216 → 2568 | 0.300 → 0.000 | 307 → 253 | 870 → 621 | 271.4 → 207.7 |
| `/resources` | 2228 → 2124 | 3112 → 2488 | 0.300 → 0.000 | 277 → 161 | 546 → 374 | 273.2 → 212.9 |
| `/resources/human-error` | 2196 → 2144 | 2632 → 2484 | 0.302 → 0.000 | 276 → 219 | 802 → 670 | 253.9 → 194.2 |
| `/login` | 2592 → 2192 | 2592 → 2192 | 0.001 → 0.000 | 222 → 129 | 417 → 241 | 261.5 → 210.5 |
| `/en` | 2912 → 2108 | 3712 → 3172 | 0.002 → 0.000 | 579 → 290 | 1821 → 1540 | 426.0 → 435.8 |
| `/zh` | 3188 → 2120 | 4016 → 3296 | 0.001 → 0.000 | 854 → 570 | 2045 → 1899 | 426.3 → 436.1 |
| `/en/pricing` | 2312 → 2036 | 2960 → 2572 | 0.303 → 0.003 | 147 → 190 | 198 → 433 | 265.4 → 204.9 |
| `/zh/resources/human-error` | 2344 → 2028 | 2936 → 2520 | 0.303 → 0.003 | 391 → 391 | 599 → 905 | 256.6 → 196.9 |

Desktop profile: FCP 380–440 ms on every route (homepage 764 → 412); LCP improved by
208–320 ms on every lazy route (e.g. `/pricing` 744 → 520, `/resources` 724 → 464,
`/login` 740 → 436); lazy-route CLS 0.19–0.30 → 0.000; long-task total ≤ 160 ms everywhere
(homepage 511 → 55).

**LCP elements** are text everywhere — the page H1 or the lead paragraph (on the homepage
the hero lead paragraph, whose LCP time includes its intro fade). No route has an image or
canvas LCP; hero imagery is not on the critical path.

**TBT caveat.** Mobile TBT is not a clean before/after signal here. FCP now happens earlier
(the header paints before the page chunk has rendered), so the same page-render task that
used to sit *before* FCP now sits *after* it and is counted. Use "max task" and
"long-task total" for main-thread cost. Note that Chrome's Long Tasks API counts script
tasks only — style/layout render tasks are not in "long-task total" (CDP total task time is
reported separately in the follow-up below).

**Owner-review follow-up (initial render).** The first EP20 build raised long-task total on
`/en/pricing` (153 → 399 ms) and `/zh/resources/human-error` (647 → 855 ms) — repeatable over
12 interleaved samples, while total main-thread work *fell*. Cause (traced): with the page
chunk preloaded, the router has the page before React's first render, so the whole page was
rendered in the initial `root.render`, a blocking (unsliced) lane — one ≈ 190–250 ms script
task. Before EP20 the page arrived later and rendered in a time-sliced Suspense retry, invisible
to the Long Tasks API. Fix: `src/main.tsx` renders inside `startTransition`. Medians of 10
interleaved mobile samples, EP19 → EP20 → EP20 + fix:

| Route | Long-task total (ms) | Max task (ms) | CDP total task time (ms) | FCP / LCP (ms) |
| --- | --- | --- | --- | --- |
| `/en/pricing` | 253 → 502 → **185** | 168 → 213 → **131** | 1571 → 1463 → 1479 | 2364/3054 → 2090/2718 → 2122/2724 |
| `/zh/resources/human-error` | 657 → 926 → **574** | 430 → 412 → **403** | 1234 → 1168 → 1165 | 2390/2964 → 2048/2562 → 2058/2568 |
| `/` | 2100 → 1272 → **1004** | 745 → 318 → **315** | 7987 → 5012 → 5024 | 2880/3756 → 2224/3180 → 2226/3116 |
| `/pricing` | 531 → 390 → **115** | 270 → 169 → **115** | 1597 → 1299 → 1261 | 2222/2920 → 2204/2806 → 2198/2784 |

Interaction latency on these routes is unchanged (Event Timing, 4× CPU: pricing tab 32 ms, FAQ
80–88 ms, language selector 56 ms in all three builds) and scrolling either route after load
produced no long animation frames in any build.

### Lighthouse 12 (diagnostic; mobile unless noted)

| Route | Simulated (HTTP/1.1) score | Devtools throttling over HTTP/2 |
| --- | --- | --- |
| `/` | 57 → 68 (TBT 838 → 314, CLS 0.029 → 0) | 55 → 56; FCP 4079 → 3247, LCP 4942 → 4436, CLS 0.075 → 0 |
| `/pricing` | 66 → 85; desktop 84 → 100 | — |
| `/resources/human-error` | 68 → 87; desktop 84 → 100 | — |
| `/login` | 85 → 87; desktop 99 → 100 | — |
| `/en` | 54 → 61; desktop 84 → 99 | 53 → 58; FCP 4437 → 3092, LCP 5324 → 4140 |

Lighthouse's *simulated* LCP for `/` and `/en` came out worse (≈ +0.6 s). With real throttling
over HTTP/1.1 its own devtools mode also showed `/` LCP +0.2 s — that is the local server: one
HTTP/1.1 host allows 6 connections, and the EP20 page issues more, smaller requests. Over HTTP/2
(what a CDN serves) both the harness and Lighthouse devtools show LCP improving (`/` −0.5 s,
`/en` −1.2 s). The production-deployment phase must re-check on the real host.

### Warm navigation (desktop, first visit to each route in a session)

Before, a first in-app visit showed a blank placeholder and took ≈ 300 ms even with the chunk
cached (React's Suspense reveal throttle): `/pricing` 326 ms, `/features` 317 ms, `/login`
310 ms. After: the current page stays until the next is ready — `/pricing` 126, `/features` 69,
`/login` 80, others 56–176 ms; no blank state on any route. Second visits: 4–76 ms.

### Idle runtime cost (no input; main-thread work per second)

| Page state | Desktop 1× | Mobile 4× |
| --- | --- | --- |
| `/` hero in view (CORE World running) | 376 → 281 ms/s (layout 111 → 0 /s) | 921 → 497 ms/s |
| `/` at Department Worlds (art loops in view) | 222 → 145 | 646 → 570 |
| `/` scrolled to the footer | **161 → 2** (style 146 → 0 /s, layout 110 → 0 /s) | **500 → 0.3** |
| `/` tab hidden (simulated `visibilitychange`) | 172 → 0.1 | 610 → 0.2 |
| `/` reduced motion | 0.1 → 0.1 | 0.3 → 0.3 |

The headless browser ticks at ≈ 146 frames/s, so absolute per-second numbers are higher than on
a 60 Hz display; the before/after ratio is what matters. Pages whose loops are *in view* (How
CORE Works hero, sign-in gateway, Sales hero) still animate — by design.

### Interactions (Event Timing, longest event per interaction, 4× CPU)

Header Product menu 248 → 184 ms · language selector 128 → 112 · mobile menu 128 → 112 ·
CORE department select 224 → 192 · Pricing tab 32 → 32 · FAQ disclosure 96 → 88 · Contact
topic 56 → 64 · Demo action 176 → 184 · Resource search typing 56 → 64 · Glossary typing
40 → 40. No interaction regressed beyond noise; the slowest are menu/scene opens under 4×
throttling.

### Leak smoke (desktop, 3 rounds of 12 in-app navigations, forced GC)

Event listeners on window/document constant (20); one canvas after every return to `/`;
DOM size constant. WebGL contexts created: 14 → **8** (each homepage visit created the GPU
probe context *and* the scene context; the probe now runs once per session). Heap after GC
16.1 → 16.3 MB after 3 rounds (+≈ 0.8 MB per round both before and after EP20 — pre-existing,
small, noted for EP21). R3F disposes the renderer (`forceContextLoss`) on leave.

**EP21 follow-up — real leak found and fixed.** CDP DOM counters (after forced GC) showed every
homepage visit retaining ≈ 308 detached DOM nodes and 37 event listeners (the whole previous
hero). Heap-snapshot retainer paths traced it to two module-level GPU resources — the cached
CORE World halo texture and the one geometry three.js shares between all sprites — whose
`dispose` listeners kept every past renderer, its WebGL context, canvas and old DOM reachable.
`src/features/landing/core-world/halo.ts` now releases both when the scene unmounts.
Measured (6 homepage visits per round): before +1,848 nodes / +222 listeners / +1.1–2.1 MB per
round; after **0 nodes / 0 listeners**, heap flat within GC noise. One canvas and one WebGL
context per homepage visit; no other public page retains anything. (A Playwright
`ElementHandle` held by the test script itself also retains old DOM — measure with in-page
clicks.)

## 3. Performance budget (`scripts/perf-budget.mjs`)

Runs at the end of `npm run build` and alone with `npm run perf:budget`. Deterministic: file
sizes and the Vite manifest's chunk graph only — never timings. Budgets carry headroom over the
EP20 result, so normal content work fits but an accidental eager import or a heavy dependency
does not.

| Budget (KiB) | EP20 | Limit |
| --- | --- | --- |
| Initial JS, gzip | 179.4 | 205 |
| Initial CSS, gzip | 44.5 | 52 |
| Largest public page closure beyond the entry, gzip | ≈ 60 (`/resources`) | 72 |
| CORE World beyond the homepage, gzip | 235.5 | 265 |
| Critical fonts (Thai + Latin woff2, 400/500/600) | 88.4 | 100 |
| Hero + department thumbnails | 36.9 | 45 |
| All JS, raw | ≈ 3,677 | 4,300 (EP25; was 4,100) |
| Static HTML, raw | ≈ 543 | 560 (EP24.1.4.3, owner-approved in EP24.1.4.4; was 540) |
| Static HTML files | 108 | exactly 111 (EP24.1.4.3; was 108) |

It also fails when heavy code becomes eager: CORE World / three.js, the Demo, the homepage
chapters, the Login gateway, any Resource guide, industry or department page, or the `/app`
workspaces in the initial bundle; the Resources home statically importing a guide; one guide
statically importing another. `src/test/performance.test.tsx` adds source-level guards (route
preload map in step with the router, no static page imports in `router.tsx`, loop-region
behaviour). `scripts/verify-prerender.mjs` checks every page preloads its own chunk (and the
right fonts), never another route's.

**Changing a budget:** only with a reason recorded here (what grew, why it is worth it).

- **EP43 — no frontend change; budgets unchanged.** EP43 added a backend readiness route and the
  `ops/` operations tooling only. All JS 4,270.0 / 4,300 KiB, initial JS 182.9 / 205 KiB gzip,
  static HTML 525.6 / 560 KiB (re-measured by the EP43 build). Operations overhead measured: a
  health cycle 0.56 s wall / 44 ms CPU / ≈ 71 MB RSS / 0 database connections; backup + restore
  verification of the UAT database 0.7 s + ≈ 2 s, ≈ 62 MB peak (Node; `pg_dump` / `pg_restore` are
  separate processes).
- **EP42.4 — no budget changed; JS recovered first.** Before adding UI, a source-mapped build was
  attributed per module (no module appears in two chunks; unused exports are already tree-shaken), so
  the safe recovery was dead copy: 26 keys never read anywhere, removed from TH / EN / ZH (78 entries,
  every candidate checked by hand) — about **−5.8 KiB**. Then the Warehouse list summaries, next
  actions and previews (+≈2.5 KiB, in the existing `ctlParts` / area chunks) and the signed-in
  dictionary wait (`AuthLocale wait`). All JS **4,273.1 → 4,270.0 / 4,300 KiB (−3.1)**; headroom
  ≈ 30 KiB. Initial JS **182.7 → 182.9 / 205 KiB gzip**; static HTML **526.9 → 525.6 / 560 KiB**
  (111 / 111 files); initial CSS 50.8 / 52 KiB gzip unchanged. Remaining weight is live TH / EN / ZH
  copy, React and the separately budgeted CORE World chunk — further safe recovery is limited.
- **EP42.3 — no budget changed; no recovery needed.** Document context and workspace layout:
  the shared `company-center/docContext.tsx` + `docModel.ts` (row item summary, next-department hint,
  read-only row preview; its TH / EN / ZH copy), summary columns and previews in six lists, the
  contextual sidebar (all Warehouse sections, Sales filters) and layout classes (wider shell,
  two-column facts in wide containers, denser phone cards). No new dependency, no new lazy entry.
  All JS **4,261.2 → 4,272.9 / 4,300 KiB (+11.7)**; headroom ≈ 27.1 KiB. Initial JS 182.7 / 205 KiB
  gzip and static HTML 526.9 / 560 KiB (111 / 111 files) unchanged; initial CSS **50.6 → 50.8 / 52
  KiB gzip** (the new Tailwind classes — container queries and the hanging phone labels).
- **EP42.1 — no budget changed; no recovery needed.** Two small fixes only: arrow-key movement in
  the Sales line-item search and responsive column visibility on the Purchase-order list. All JS
  **4,260.9 → 4,261.2 / 4,300 KiB (+0.3)**; headroom ≈ 38.8 KiB. Initial JS 182.7 / 205 KiB gzip,
  static HTML 526.9 / 560 KiB (111 / 111 files) and initial CSS 50.6 / 52 KiB are unchanged.
- **EP41 — no budget changed; no recovery needed.** What was added:
  - the Owner override dialog, in its **own lazy chunk**, loaded only when an owner meets
    `SELF_APPROVAL_NOT_ALLOWED`;
  - the shared `PageError` and its TH / EN / ZH copy;
  - the approval-policy setting and request timeouts in `lib/api.ts`.

  No new dependency. Measured:
  - All JS **4,249.1 → 4,260.9 / 4,300 KiB (+11.8)**; headroom ≈ 39.1 KiB.
  - Initial JS 182.7 / 205 KiB gzip, static HTML 526.9 / 560 KiB (111 / 111 files) and initial
    CSS 50.6 / 52 KiB are unchanged.
- **EP40 — no budget changed; no frontend change.** EP40 added backend tests, a URL guard and
  branch rules only; the frontend bundle is unchanged (all JS 4,249.1 / 4,300 KiB, initial JS
  182.7 / 205 KiB gzip, static HTML 526.9 / 560 KiB — re-measured in the EP40 gates). API load
  baselines (local, development mode) are in [EP40_STRESS_REPORT.md](EP40_STRESS_REPORT.md).
- **EP39 — no budget changed; no recovery needed.** The chunk graph was inspected first. There is
  no new chunk or dependency: production movement labels (TH / EN / ZH) in the Warehouse chunk, a
  fulfilment pill in the Sales list, link sizes, and CORE focus / branch-return logic.
  - All JS **4,247.4 → 4,249.1 / 4,300 KiB (+1.7)**; headroom ≈ 50.9 KiB.
  - Initial JS 182.7 / 205 KiB gzip and static HTML 526.9 / 560 KiB are unchanged.
- **EP38.4 — no budget changed; no recovery needed.** The CORE menu (`CoreNav.tsx`, TH / EN / ZH)
  joins the existing lazy CORE shell chunk, and the customer combobox replaces the old picker in
  `SalesArea` (59.7 KiB raw / 17.5 gzip); no new dependency, nothing on public routes.
  - All JS **4,236.7 (EP38.3.1) → 4,247.4 / 4,300 KiB (+10.7)**; headroom ≈ 53 KiB.
  - Initial JS 182.7 / 205 KiB gzip and static HTML 526.9 / 560 KiB.
- **EP38 — no budget changed; no recovery needed.** The chunk graph was inspected first: every EP38
  screen is lazy, inside the existing Production and Warehouse routes, and adds no dependency.
  - New chunks:
    - `OutputArea`: ≈ 10.9 KiB raw / 3.7 KiB gzip;
    - `OutputPanel`: ≈ 5.4 / 1.9 (order detail only);
    - `FinishedGoodsArea`: ≈ 11.2 / 3.6;
    - shared `outParts`, with the TH / EN / ZH output copy and API: ≈ 28.3 / 8.3.
  - Existing chunks grow: `ProductionArea` 32.3 → 33.1 KiB and `prodParts` 40.1 → 41.1 KiB
    (statuses, nav, tiles).
  - All JS **4,167.0 → 4,225.6 / 4,300 KiB (+58.6)**; headroom ≈ 74 KiB. The next large screens
    should recover JS first.
  - Initial JS 182.6 / 205 KiB gzip and static HTML 528 / 560 KiB are unchanged.
- **EP37 — no budget changed; no recovery needed.** The chunk graph was inspected before building:
  every new screen is lazy, inside the Production route, and has no eager Warehouse / Sales import
  and no new dependency. The EP36 `CoreCanvas` optimization is untouched.
  - Production execution adds:
    - `ExecutionPanel`: ≈ 8.1 KiB raw / 2.8 KiB gzip (order detail only);
    - `IssuesArea`: ≈ 7.2 / 2.7;
    - `execCopy`: TH / EN / ZH execution copy, ≈ 20.0 / 6.3, loaded with those two;
    - the Warehouse `MaterialIssueHandoff`: ≈ 2.5 / 1.1.
  - Existing chunks grow: `ProductionArea` 31.2 → 32.3 KiB (reservation / execution lists, tiles)
    and `prodParts` 37.5 → 40.1 KiB (nav, statuses).
  - All JS **4,122.4 → 4,167.0 / 4,300 KiB (+44.6)**; headroom ≈ 133 KiB.
  - Initial JS 182.6 / 205 KiB gzip and static HTML 528 / 560 KiB are unchanged.
- **EP36 — no budget changed; JS recovered first.** Phase 0 took the total from 4,252.8 to
  **4,052.2 KiB (200.6 KiB recovered)** before any Production code: `<Canvas>` from
  @react-three/fiber registers the whole three.js namespace (`extend(THREE)`), which kept every
  three class in the CORE World chunk. The scene now renders through a small `CoreCanvas`
  (`features/landing/core-world/CoreCanvas.tsx`, R3F's public `createRoot` / `events` / `extend`)
  that registers only the ten elements it uses — CORE World chunk 905.3 → 699.9 KB raw, **235.5 →
  182.5 KiB gzip**; same scene, interactions (hover, select, deselect, drag), resize, remount,
  StrictMode, fallback on errors — checked in the production build and the dev server. Other audit
  targets (unused copy keys, duplicated modules, eager imports) showed no safe savings worth
  taking. Production then adds `ProductionArea` (≈ 31.1 KiB raw / 8.2 KiB gzip), `prodParts` with
  the TH / EN / ZH copy (≈ 36.9 / 11.5 KiB) and `ShortagesArea` (≈ 1.7 KiB): **+69.7 KiB**. All JS
  **4,121.8 / 4,300 KiB** (headroom ≈ 178 KiB); initial JS 182.6 KiB gzip and static HTML 528 / 560
  KiB unchanged.
- **EP35 — no budget changed.** Sales fulfilment adds one lazy `FulfilmentArea` chunk for the three
  documents (≈ 23.8 KiB raw / 7.4 KiB gzip, its own TH / EN / ZH copy) built on the EP32 `ctlParts`
  list / page (which grows to ≈ 34.2 KiB with the shared statuses, errors and the new kinds); Pending
  Pick gains "Create pick" (≈ 7.3 KiB), `AllocationSection` the Sales fulfilment block (≈ 5.5 KiB),
  `SalesArea` ≈ 46.7 KiB (copy). All JS **4,252.8 / 4,300 KiB** (EP34: 4,212.7; **+40.1 KiB**);
  initial JS unchanged at 182.6 KiB gzip; static HTML 528 / 560 KiB. Headroom ≈ 47 KiB — the next
  large screens should recover JS first.
- **EP34 — no budget changed.** Sales allocation adds two lazy chunks — `AllocationSection`
  (≈ 3.2 KiB raw / 1.3 KiB gzip, loaded only on confirmed orders) and `PendingPickArea` (≈ 6.5 / 2.6
  KiB) — and grows `SalesArea` to ≈ 43.1 KiB raw (allocation copy in TH / EN / ZH) and `InventoryArea`
  to ≈ 5.7 KiB (reserved / available columns). All JS **4,212.7 / 4,300 KiB** (EP33: 4,195.6; **+17.1
  KiB**); initial JS unchanged at 182.6 KiB gzip; static HTML 528 / 560 KiB. Headroom ≈ 87 KiB.
- **EP33 — no budget changed; JS recovered first.** Phase 0 took the total from 4,298.2 to
  4,158.7 KiB (**≈ 139.5 KiB recovered**) before any Sales code: the sign-in gateway no longer ships
  `react-hook-form`, `@hookform/resolvers` or `zod` (the three were removed from the frontend; the
  only client-side check they served, the email shape, is `lib/email.ts` — zod v4's pattern, with
  accepted and rejected shapes pinned by `email.test.ts`), and the homepage workspace previews import a small
  `workspaces/identity.ts` (names, icons, accents) instead of the whole prototype registry. Sales then
  adds one lazy `SalesArea` chunk (≈ 36.3 KiB raw / 11.3 KiB gzip, its own TH / EN / ZH copy) and the
  CORE home link: all JS **4,195.6 / 4,300 KiB** (+36.9 KiB over Phase 0); initial JS unchanged at
  182.6 KiB gzip; static HTML 528 / 560 KiB. Headroom ≈ 104 KiB.
- **EP32 — no budget changed.** Transfers, adjustments and cycle counts add three lazy chunks
  (≈ 3.6 / 5.3 / 7.7 KiB raw) and one shared `ctlParts` chunk (≈ 28 KiB: list / page / editor parts and
  the TH / EN / ZH copy, loaded only by those three); EP31 screens gain movement labels, nav entries,
  tiles and inventory row actions. All JS 4,298.2 / 4,300 KiB (+46.3 KiB); initial JS unchanged at
  182.6 KiB gzip; `/login` 64.5 / 72 KiB; static HTML 528 / 560 KiB. A first version measured 4,309 KiB;
  it was brought under by sharing one document page / form / line editor across the three screens,
  reusing EP31 copy keys instead of repeating them in three languages, shorter confirmations and
  timeline labels by suffix. **Headroom is now ≈ 1.8 KiB: the next Warehouse screens need JS
  recovered first, or a recorded budget decision by the owner.**
- **EP31 — no budget changed.** The Warehouse workspace, goods receipts (editor), inventory / lots and
  movements add ≈ 57 KiB raw in their own lazy chunks (all JS 4,251.9 / 4,300 KiB; initial JS
  unchanged at 182.6 KiB gzip; static HTML 529 / 560 KiB). Side effect noted: adding these lazy
  entries made the bundler's `entriesAware` lucide-icon grouping merge a few small icon chunks
  differently, so `/login` loads one 1.8 KiB (gzip) shared icon chunk more than in EP30 (63.3 →
  65.0 / 72 KiB). Grouping the new screens into fewer chunks did not change it; the chunk config
  was left as EP30 tuned it. Headroom is now ≈ 48 KiB of total JS — the next screens must be lean.
- **EP30 — no budget changed; JS recovered instead.** After EP29 the total stood at 4,297.5 / 4,300
  KiB. Normal production builds now leave out the `/app` prototype workspaces, which production
  disabled at runtime but still shipped: `router.tsx` folds `PROTOTYPE_BUILD` to a constant, so the
  bundler drops `appRoutes` and only a small gate chunk remains. Removing it first split the entry's
  graph into eight files preloaded by every prerendered page (static HTML ≈ 604 KiB); one `shell`
  chunk group in `vite.config.ts` keeps them together. **Do not rework that chunking without
  re-measuring static HTML.** A build with `VITE_ENABLE_PROTOTYPE=true` is larger than the cap by
  design: the cap is for normal production builds. Numbers: [EP30_REPORT.md](EP30_REPORT.md).

- **EP25 — All JS, raw: 4,100 → 4,300 KiB.** What grew: the signed-in areas built since EP20
  (Account Portal, Platform Control Center, and now the customer Company Control Center and the
  CORE Operations entry, ≈ 100 KiB raw / ≈ 30 KiB gzip in two lazy chunks plus their copy). None
  of it is loaded by a public page: the initial bundle grew by 0.5 KiB gzip (two route entries and
  the sign-in destination rules), every public-page budget is unchanged, and the cap still catches
  an accidental heavy dependency. Total after EP25: 4,103 KiB. *Approved by the owner (2026-10-28).*
- **EP24.1.4.3 — Static HTML: 540 → 560 KiB raw; 108 → 111 files.** What grew: /consultation
  became its own public, indexable route (the guided consultation split from /contact), so the
  prerender writes three more pages (th / en / zh, ≈ 4.4 KiB of head each): 543 KiB in total. The
  per-page weight is unchanged; the cap still catches bloated heads. The JS cap (4,300 KiB) is not
  touched. **Approved by the owner (EP24.1.4.4).** The cap is not to be raised again without
  owner review.

## 4. Route splitting and loading

- **Every public page is a router-managed lazy route** (`src/app/router.tsx`): `route.lazy` +
  a full-height `hydrateFallbackElement`. A client navigation keeps the current page until the
  next one is ready; a direct visit shows header + full-height placeholder, so the footer stays
  below the fold. (EP19's React.lazy/Suspense with a 70dvh fallback put the footer in view and
  then pushed it down — CLS ≈ 0.30 on every lazy route — and React 19's Suspense reveal
  throttle added ≈ 300 ms.)
- **The homepage is lazy too**, so non-home visitors do not download its eleven chapters.
- **Per-route preload.** `scripts/prerender.mjs` writes `<link rel="modulepreload">` for the
  route's own chunk and its static imports into that route's HTML (`src/seo/routeModules.ts`
  maps routes to modules; the Vite manifest maps modules to chunks; the manifest is moved out
  of `dist/`). `/en/*` and `/zh/*` also preload their shell dictionary — the router loads it in
  parallel with the page. Preload = the current page only. **Nothing is prefetched**; hover /
  intent prefetch was considered and not added (warm navigations are already 56–176 ms, and
  mobile bandwidth matters more).
- **`/app/*` is not in the public bundle.** The workspace shell, registry, module blueprints
  and React Query live in `src/app/appRoutes.tsx`, patched in by `patchRoutesOnNavigation` on
  the first navigation into `/app` (`app.html` preloads it). Public pages never fetch, so the
  query client lives there.
- **Icons.** lucide icons shared by several routes are grouped by the set of routes that use
  them (`vite.config.ts`, Rolldown `codeSplitting` `entriesAware`, groups < 2 KiB merged): ≈ 11
  files per page instead of up to 40 sub-kilobyte requests, for +0.6 % bytes.
- **Resources (EP16) is protected:** each guide is its own chunk; the Resources home and the
  search/glossary metadata never import a guide body (budget + test).
- **Initial render as a transition** (`src/main.tsx`): because the page chunk is usually
  ready before React's first render, the first render contains the whole page; rendering it
  inside `startTransition` lets React slice it instead of blocking for ≈ 0.2 s (see §2,
  follow-up).
- **Homepage chapters.** On a fresh load that opens at the top of `/`, the hero paints first and
  chapters 02–11 mount right after in a transition (one ~0.9 s task at 4× CPU became ≈ 0.26 s +
  ≈ 0.3 s). Reloads, back/forward, `#chapter` links and in-app navigation render everything at
  once, so scroll restoration and anchors keep working. Smaller batches were tried and measured
  worse (more total work).

## 5. CORE World

- three.js + R3F only in the lazy `CoreWorld` chunk; never in the entry (budget).
- Quality decided after first paint (idle callback); the GPU probe runs **once per page
  session** (`stageQuality`).
- `frameloop="never"` when the stage is offscreen (IntersectionObserver) or the tab is hidden;
  `demand` under reduced motion (0 frames when idle — measured); `always` otherwise, with the
  runtime guard stepping quality down on sustained slow frames. Labels are written (transform /
  opacity / z-index) each frame, never read back.
- Mobile: `low` tier (DPR 1, 110 particles, no AA, no shader noise). On a 390 × 844 phone the
  stage starts inside the first viewport (y ≈ 693), so deferring its load to scroll would not
  help; its three init tasks (≈ 110 / 170 / 220 ms at 4× CPU) run after LCP. Accepted.
- Leaving the homepage disposes the renderer; returning creates exactly one canvas.

## 6. Images

All raster images are small WebP (department scenes 7–13 KiB, thumbnails 2.4–4.5 KiB); every
`<img>` reserves its box (width/height attributes or a fixed-size / aspect-ratio class) and
decodes async; below-the-fold thumbnails are `loading="lazy"`. No LCP is an image, so no
`fetchpriority` or image preload is used. No `srcset` is needed: the largest file is 12.7 KiB.
`public/hero/atmosphere.{avif,webp}` (≈ 8 KiB each) are not referenced by the app — never
downloaded; left in place (removal is a content decision, not a performance one). The OG image
(72 KiB PNG) is only fetched by crawlers.

## 7. Fonts

- IBM Plex Sans Thai via `@fontsource`, weights 400/500/600/700 (all used), `font-display:
  swap`, split by Unicode range (Thai / Latin / Latin-ext; woff2 with woff fallback). A page
  downloads only what it renders (Thai pages ≈ 90 KiB of woff2 in total).
- **Thai pages preload the three Thai faces (400/500/600, ≈ 36 KiB)** and the Thai sign-in
  shell does too. Measured on the mobile profile: no slower first paint, CLS from font swaps →
  0, and up to four separate 60–250 ms font-swap relayouts disappear (homepage max task
  423 → 301 ms, Retail 267 → 158 ms).
- **English and Chinese pages preload no font:** preloading the Latin faces on `/en` measured
  FCP +0.17–0.24 s and LCP +0.14–0.37 s (they compete with JavaScript on slow 4G).
- Simplified Chinese glyphs come from the system CJK stack (`--font-zh`); no CJK web font is
  shipped and nothing is subset beyond the package's own ranges. Thai and Chinese glyph coverage
  is unchanged.

## 8. Animation and runtime rules

- Animate `transform` and `opacity` (SVG stroke offset for line pulses). See [MOTION.md](MOTION.md).
- **Every endless decorative loop lives in a loop region** (`useLoopRegion`): CSS animations
  pause (`[data-offscreen]` in `index.css`) and SVG timelines pause (`pauseAnimations()`) when
  the region is more than 200 px offscreen; interval-driven sequences also stop while the tab is
  hidden. Applied to every homepage/About/How/Login/department loop found in EP20.
- Reduced motion: the global CSS block stops every loop, SMIL is swapped for static art, CORE
  World renders on demand — nothing keeps running behind an opacity change (0 ms/s idle).
- Scroll: no app-level scroll handlers except the utility dock's two passive listeners
  (cheap reads on a clean layout); the header uses an IntersectionObserver sentinel; scroll-linked
  chapters read Framer's shared `useScroll`. No resize handler does layout work per event.
- `backdrop-filter`: header (86 % opaque, 12 px), mega panels, cookie panel, utility dock and
  the mobile menu keep their blur — EP20 found no measurable benefit in removing it, and it is
  part of the visual depth.
- Do not add `memo`/`useMemo`/`useCallback` without a measured reason. Interaction latency
  (§2) did not justify any.

## 9. Caching and delivery (recommendations — not verified on production)

- `/assets/*` filenames are content-hashed by Vite → serve with
  `Cache-Control: public, max-age=31536000, immutable`. Verified locally: a repeat visit
  transfers 0 bytes for assets (browser cache), HTML revalidates.
- HTML (every route file, `404.html`, `app.html`, `login.html`) → `no-cache` (or a short
  `max-age` with revalidation) so a deploy is picked up immediately and old HTML never points at
  removed chunks.
- Brotli (preferred) or gzip for HTML/JS/CSS/SVG/XML. Local brotli-11 estimates: initial JS
  151.9 KiB, CSS 35.1 KiB. A CDN's real compression level may differ.
- HTTP/2 or HTTP/3: the per-route preloads assume multiplexing (see the HTTP/1.1 caveat in §2).
- Fonts (`/assets/*.woff2`) are same-origin and hashed — same immutable rule; preload uses
  `crossorigin`.
- These are recommendations for the host configuration; nothing is hard-coded in the app.
  **The production-deployment phase (after the backend) verifies the real Cloudflare headers,
  compression, per-route HTML, redirects and 404.**

## 10. Regression rules

1. Run `npm run build` — it fails on a budget breach or an eager heavy import.
2. A new public page: add the lazy route in `router.tsx` **and** its module in
   `src/seo/routeModules.ts` (the test and `verify-prerender` fail otherwise).
3. A new endless animation: wrap its region with `useLoopRegion`.
4. A new heavy library: lazy-load it with the page that needs it; never import it from the
   shell, the header, the footer, the cookie UI or the utility dock.
5. Measure before and after with the method in §1; record changes here.

## 11. Known limitations

- Synthetic, local measurements only; no field data, no real low-end device (CPU throttling is
  an emulation), no Safari.
- Local server is not Cloudflare; HTTP/1.1 vs HTTP/2 visibly changes results for a page with
  many small chunks.
- The headless browser's frame rate (~146 Hz) inflates per-second idle numbers.
- Accepted debt: the CORE World chunk (≈ 236 KiB gzip; R3F pulls in most of three.js); the one
  Tailwind stylesheet includes `/app` workspace styles (≈ 44.5 KiB gzip, split not worth the
  architecture change); Framer Motion's full `motion` component (a `LazyMotion` migration
  touches every animated file). The heap growth noted in EP20 was a real leak and is fixed (EP21).
