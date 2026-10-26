# EP20 Report — Public Performance Hardening

EP20 made the public website lighter to load and cheaper to run without changing how it
looks, reads or navigates. Every change below is backed by a measurement taken before it was
made. Method, full tables, budgets and rules: [PERFORMANCE.md](PERFORMANCE.md).

All figures are **local, synthetic** measurements (Playwright + CDP throttling, Lighthouse
as diagnostic). They are not field Core Web Vitals. **Production Cloudflare delivery was not
tested — EP22.1 verifies it.**

## Summary of changes

| # | Change | BEFORE | AFTER | REASON | VISUAL IMPACT |
| --- | --- | --- | --- | --- | --- |
| 1 | Public pages became router-managed lazy routes with a full-height placeholder (was React.lazy + Suspense with a 70dvh fallback) | CLS ≈ 0.30 on every lazy route (footer in view, then pushed down); first in-app visit ≈ 300 ms with a blank page (React 19 Suspense reveal throttle) | CLS 0.000–0.003; first in-app visit 56–176 ms, current page stays until the next is ready | The single biggest layout-stability defect; avoidable blank state | None. Placeholder is the same empty dark area, now full height |
| 2 | Per-route `modulepreload` in every prerendered HTML file (`src/seo/routeModules.ts` + Vite manifest) | Page chunk requested only after the 672 KiB entry had run (serial waterfall) | Page chunk downloads in parallel with the entry; desktop LCP −208…−320 ms on lazy routes | Removes a network round trip from every direct visit | None |
| 3 | `/app/*` workspaces + React Query moved out of the public bundle (`app/appRoutes.tsx`, `patchRoutesOnNavigation`) | Workspace shell, registry, module blueprints, ≈ 30 icons and the query client in every public page's entry | Loaded only on the first navigation into `/app` (`app.html` preloads it) | ≈ 130 KiB raw of code no public visitor used | None (workspace behaviour unchanged, tests pass) |
| 4 | Homepage made lazy like every other page | 11 chapters (≈ 150 KiB raw) in every visitor's entry | Only homepage visitors download them (preloaded on `/` so the homepage is not slower) | Non-home landings paid for the homepage | None |
| 5 | Homepage: hero first, chapters 02–11 in a transition right after (fresh loads at the top only) | One ≈ 900 ms main-thread task at 4× CPU before the first paint | ≈ 260 ms hero + ≈ 300 ms chapters; mobile FCP 2996 → 2224, LCP 3856 → 3140, max task 789 → 301 | Long blocking first render | None. Chapters are below the fold and appear before any scroll; anchors, reload and back/forward render everything at once |
| 6 | `useLoopRegion`: CSS keyframes and SVG SMIL loops pause while their region is offscreen; interval sequences pause offscreen / in hidden tabs | Homepage at the footer: 146 style recalcs + 110 layouts per second, ≈ 160 ms/s desktop, ≈ 500 ms/s on 4× CPU | 0 recalcs, 0 layouts; ≈ 2 ms/s desktop, ≈ 0.3 ms/s 4× CPU | Continuous offscreen work | None — loops hold their frame and resume where they stopped |
| 7 | Thai pages preload the three Thai faces (400/500/600) | Up to four font-swap relayouts of 60–250 ms after first paint (mobile) and small swap shifts | Relayouts gone; homepage max task 423 → 301, Retail 267 → 158; no slower FCP | Measured; English/Chinese pages tested and deliberately left without font preloads (Latin preload was slower) | None (text no longer swaps visibly on Thai pages) |
| 8 | CORE World GPU probe runs once per page session | A throwaway WebGL context on every homepage visit (2 contexts per visit) | 1 context per visit (14 → 8 over 3 navigation rounds) | Repeated initialization | None |
| 9 | lucide icons grouped by the routes that share them (Rolldown `codeSplitting`, entries-aware, < 2 KiB groups merged; short `icons-[hash]` names) | Route change splitting would have produced up to 40 sub-kilobyte icon requests per page | ≈ 11 files per page, +0.6 % bytes | Avoid microscopic chunks | None |
| 10 | Deterministic performance budget (`scripts/perf-budget.mjs`, part of `npm run build`), guard tests, prerender preload checks | — | Fails on budget breach or any eager heavy import | Regression guard | None |

## BASELINE

1. **Baseline commit:** `6c86332a6849e29e1df7f2f9050d2d739bac2cfe` (EP19). Verified before work:
   branch `main`, clean tree, `HEAD` = `origin/main` = baseline.
2. **Final local commit:** `perf: harden CORE public runtime and delivery (EP20)` — the commit
   that contains this report (not pushed).
3. **Files changed:** 34 modified, 7 added. Added: `docs/PERFORMANCE.md`, `docs/EP20_REPORT.md`,
   `frontend/scripts/perf-budget.mjs`, `frontend/src/app/appRoutes.tsx`,
   `frontend/src/motion/useLoopRegion.ts`, `frontend/src/seo/routeModules.ts`,
   `frontend/src/test/performance.test.tsx`. Modified: router, providers, HomePage, prerender +
   verify scripts, Vite/ESLint config, `package.json` scripts, `index.css` (one rule), CORE Stage
   / quality, ten components gaining a loop region, four tests (async waits / router options),
   docs (README, ARCHITECTURE, BRAND, CORE_WORLD, MOTION, PUBLIC_SHELL).
4. **Measurement environment:** Windows 11 Enterprise; i5-12400 (6C/12T); 32 GB; GTX 1660 Ti +
   UHD 730; Node 24.19.0; production build; local static-host emulation (brotli/gzip,
   immutable assets, no-cache HTML; HTTP/1.1, plus HTTP/2 cross-checks). Profiles: desktop
   1440×900 1× CPU 10 Mbit/s 20 ms; mobile 390×844 DPR 3, 4× CPU, 1.6 Mbit/s, 150 ms.
5. **Tools used (temporary, outside the repository):** Playwright 1.64 (Chrome 155, Edge 156),
   Playwright 1.55 Firefox 141 (browser files under `D:\Temp\pw-browsers` — the newer build
   failed to load on this machine), Lighthouse 12.8.2, `source-map-js` from the existing
   dependency tree for bundle attribution. No new permanent dependency.

## BASELINE PERFORMANCE

6. **Initial JS before:** 886.6 KiB raw · 267.2 gzip · 218.5 brotli (entry 672.1 KiB raw —
   react-dom 207 KiB, workspace code ≈ 103 KiB, homepage chapters ≈ 90 KiB, lucide 33 KiB,
   React Query 24 KiB — plus jsx-runtime, framer-motion/react-router shared chunk, lucide base).
7. **Initial CSS before:** 296.9 KiB raw · 44.5 gzip (EP18.1 historical: 302.7 / 46.3 by Vite's
   kB).
8. **Largest route chunks before (raw/gzip KiB):** CoreWorld 883.9/235.5 (lazy) · PricingPage
   136.1/34.4 · AboutPage 126.7/36.7 · SolutionsPage 122.9/31.9 · HowCoreWorksPage 102.7/27.9 ·
   DemoPage 84.3/22.3 · SecurityPage 80.8/22.2.
9. **Static output before:** 108 HTML files, 374.8 KiB; 254 files in `dist/`.
10. **Build time before:** ≈ 11.5 s client build (≈ 74 s full `npm run build` incl. `tsc -b`
    and prerender, cold).
11. **Lighthouse/profile baseline (mobile simulated):** `/` 57, `/pricing` 66, guide 68,
    `/login` 85, `/en` 54; desktop `/pricing` 84, guide 84. Trace: homepage cold load on 4×
    CPU = one 903 ms render task + 366 ms entry evaluation + two 160–190 ms font-swap relayouts.
12. **Mobile/throttled baseline:** FCP 2.2–3.2 s, LCP 2.4–4.0 s, CLS 0.30 on every lazy route,
    homepage TBT 593 ms / max task 789 ms (full table in PERFORMANCE.md §2).

## BUNDLE

13. **Initial JS after:** 564.9 KiB raw · 179.4 gzip · 151.9 brotli (−321.7 raw, −87.8 gzip,
    −66.6 brotli).
14. **Initial CSS after:** 296.9 KiB raw · 44.5 gzip (unchanged; one rule added).
15. **Largest route chunks after:** CoreWorld 884.0/235.5 (lazy, unchanged) · HomePage
    147.0/47.5 (new, homepage only) · PricingPage 131.8/32.5 · AboutPage 125.8/36.3 ·
    SolutionsPage 122.7/31.7 · HowCoreWorksPage 102.3/27.5. Largest page closure beyond the entry:
    `/resources` ≈ 60 KiB gzip.
16. **Shared chunks:** entry (react-dom, react-router, shell, Thai dictionary) + `tokens`
    (framer-motion/motion-dom + router internals, 65.8 KiB gzip) + jsx-runtime + small icon
    groups. `appRoutes` 64 KiB raw is shared only by `/app`.
17. **Duplicated modules:** 0 of 910 source modules appear in more than one chunk (sourcemap
    audit). three.js and R3F only in CoreWorld; React Query only in appRoutes.
18. **Lazy route coverage:** 100 % of public pages (36 page modules) and `/login` are lazy;
    `/app/*` discovered lazily; 7 workspace dashboards and the Design Lab lazy (unchanged).
19. **Resources splitting:** each of the 7 guides is its own chunk (GlossaryGuide … HumanErrorGuide
    7.5–29 KiB raw); the Resources home and search/glossary metadata import no guide; no guide
    imports another (enforced by `perf-budget`).
20. **Demo splitting:** DemoPage (84.4 KiB raw) loads only on `/demo`; never in the entry (budget).
21. **CORE World splitting:** three.js + R3F + scene only in the lazy CoreWorld chunk, requested
    after first paint on the homepage only; budget 265 KiB gzip beyond the homepage.

## CORE WEB VITALS / RUNTIME

22. **LCP:** text on every route (H1 or lead paragraph; homepage = hero lead paragraph after its
    intro fade). Mobile: −148…−808 ms on every route (e.g. `/how-core-works` 3416 → 2608, `/zh`
    4016 → 3296). Desktop: −208…−320 ms on lazy routes, homepage 1528 → 1396.
23. **CLS:** every route ≤ 0.003 after (was 0.19–0.33 on lazy routes; homepage 0.036 → 0.000).
24. **INP direction:** Event Timing at 4× CPU unchanged or better (header menu 248 → 184 ms,
    CORE department select 224 → 192, others within noise). Field INP not measured.
25. **FCP:** mobile −50…−1070 ms everywhere (homepage 2996 → 2224, `/zh` 3188 → 2120); desktop
    380–440 ms everywhere.
26. **Long tasks:** max task lower on 16 of 18 mobile entries (homepage 789 → 301, `/zh` 854 →
    570). `/en/pricing` 147 → 190, `/zh/resources/human-error` unchanged at 391 — both resolved
    in the owner-review follow-up below.
27. **Main-thread work:** long-task total lower on 15 of 18 mobile entries (homepage 2272 → 1265
    ms). Higher on `/solutions` (659 → 667, flat), `/en/pricing` (198 → 433) and
    `/zh/resources/human-error` (599 → 905). (The original explanation here — font-swap
    relayouts — was wrong; see the follow-up below for the measured cause and fix.)
    TBT is not a clean signal (it is FCP-relative and FCP moved earlier; see PERFORMANCE.md §2).
28. **Cold load:** transferred bytes on non-home routes −34…−62 KiB (e.g. `/pricing` 390 → 330
    KiB); homepage +10 KiB (chapters + Thai font preload, offset by the smaller entry). Requests
    rose (e.g. `/pricing` 22 → 30) — small preloaded chunks in parallel.
29. **Warm navigation:** first in-app visits 56–176 ms with no blank state (was ≈ 300 ms with a
    blank placeholder for routes whose chunk had to load); repeat visits 4–76 ms; focus,
    scroll-to-top and EP19 skip link unchanged.

## CORE WORLD

30. **Initialization:** after first paint via `requestIdleCallback` (500 ms timeout); GPU probe
    once per session; WebGL contexts per homepage visit 2 → 1.
31. **RAF behaviour:** one R3F frame loop; ≈ display rate while visible (desktop high tier ≈ 0.9
    ms script per frame); labels written per frame, never read.
32. **Offscreen behaviour:** `frameloop="never"` — 0 animation frames scrolled away (measured).
33. **Hidden-tab behaviour:** 0 frames after `visibilitychange` (simulated hide; headless pages
    are always visible); resumes without duplicate loops.
34. **Reduced-motion behaviour:** `demand` frame loop, 0 frames and 0.1–0.3 ms/s idle.
35. **Mobile behaviour:** `low` tier; the stage is in the first viewport on 390×844 (y ≈ 693),
    so it still loads after first paint; init tasks ≈ 110/170/220 ms at 4× CPU after LCP
    (accepted).
36. **Cleanup:** R3F disposes the renderer and forces context loss on leave; one canvas after
    every return; listener count constant (20).

## MOTION

37. **Global animation audit:** 13 CSS keyframe loops, SMIL in 7 components, 3 interval
    sequences, Framer one-shots and scroll-linked transforms; no Framer `repeat: Infinity`.
38. **RAF/timers:** CORE World (paused offscreen/hidden), Connected Flow interval (already
    in-view gated), Sales/Accounting intervals (now paused offscreen and in hidden tabs), About
    `usePlayOnce` (finite), hash-scroll retry (bounded 120 frames).
39. **Scroll handlers:** only the utility dock's two passive listeners; header uses an
    IntersectionObserver sentinel; chapters use Framer's shared `useScroll`. Left unchanged (no
    measurable cost).
40. **Resize handlers:** utility dock (passive, same cheap read); ResizeObservers in About and
    Security. No per-event layout work found; unchanged.
41. **Blur/filter cost:** `backdrop-filter` on header (86 % opaque), mega panels, cookie panel,
    utility dock, mobile menu; no animated filters. No measurable benefit found → kept.
42. **GPU/compositor impact:** offscreen SVG/CSS loops no longer force style + layout each frame;
    composited loops (Final chapter rings) also hold when offscreen.

## ASSETS

43. **Image inventory:** 14 department WebP (2.4–12.7 KiB), hero atmosphere AVIF/WebP (≈ 8 KiB,
    unused by the app), OG PNG 72 KiB (crawlers only), favicons, 2 SVG textures (< 0.4 KiB).
44. **Image formats:** WebP throughout; AVIF variant exists for the atmosphere; no conversion
    needed.
45. **Responsive images:** not needed — the largest image is 12.7 KiB.
46. **Lazy images:** below-the-fold thumbnails `loading="lazy"`; hero/world cards eager
    (visible); every image reserves its box.
47. **LCP image policy:** no LCP is an image, so no `fetchpriority`/image preload.
48. **SVG:** inline diagrams kept (accessible, crisp); duplicate SVG ids 0 on all checked routes
    in three engines (EP19 guard intact).
49. **SVG filters:** none animated; SMIL loops now paused offscreen.

## FONTS

50. **Loaded fonts:** IBM Plex Sans Thai via `@fontsource` (16 `@font-face`, Thai / Latin /
    Latin-ext). Thai pages download ≈ 90 KiB woff2.
51. **Weights:** 400/500/600/700 all used (700 in two places + SVG labels) — none removed.
52. **font-display:** `swap` on all 16 faces.
53. **Preload:** Thai pages + Thai sign-in shell preload Thai 400/500/600 (≈ 36 KiB); English and
    Chinese pages none (measured slower with Latin preload).
54. **Thai coverage:** unchanged (same font files).
55. **Chinese coverage:** unchanged — system Simplified-Chinese stack, no CJK web font.
56. **FOUT/FOIT:** no FOIT (`swap`); FOUT on Thai pages largely removed by the preload (font-swap
    CLS → 0); English/Chinese keep a brief Latin swap (CLS ≤ 0.003).

## CSS

57. **Production CSS:** one 296.9 KiB stylesheet (44.5 KiB gzip); ≈ 32 KiB theme/base/properties,
    the rest utilities.
58. **Retired styles:** no stale EP18 navigation rules found in the output. Tailwind emits only
    used utilities and keyframes: `surface-card` and the `drift` keyframe are defined in
    `index.css` but unused, so they cost 0 bytes (left in the token source).
59. **Tailwind output:** automatic source detection from the Vite root; no `@source` override, no
    safelist; class names are written as full literals. The stylesheet includes `/app` workspace utilities (accepted; splitting
    CSS per area would change the styling architecture).
60. **Animation CSS:** 13 keyframes, all used; one EP20 rule pauses loops in `[data-offscreen]`.

## INTERACTION (Event Timing, 4× CPU)

61. **Header:** Product menu 248 → 184 ms.
62. **Mobile menu:** 128 → 112 ms.
63. **Language selector:** 128 → 112 ms.
64. **Pricing:** package tab 32 → 32 ms; FAQ disclosure 96 → 88 ms.
65. **Contact:** topic step 56 → 64 ms (noise).
66. **Demo:** first action 176 → 184 ms (noise); no background work while hidden.
67. **Resource search:** typing 56 → 64 ms; glossary typing 40 → 40 ms (search is memoized and
    deferred already; dataset small — unchanged).
68. **Disclosures:** FAQ 96 → 88 ms; EP18.1 DisclosureIcon untouched.

## PAGE RESULTS (mobile profile; full desktop data in PERFORMANCE.md)

69. **Homepage:** FCP 2996 → 2224, LCP 3856 → 3140, CLS 0.036 → 0, max task 789 → 301; idle at
    the footer 500 → 0.3 ms/s.
70. **Features:** LCP 2456 → 2144, CLS 0.301 → 0.
71. **Pricing:** LCP 2964 → 2752, CLS 0.304 → 0; Lighthouse 66 → 85 (desktop 84 → 100).
72. **How CORE Works:** LCP 3416 → 2608, CLS 0.300 → 0; hero SMIL pauses once scrolled away.
73. **Solutions:** LCP 3428 → 2824, CLS 0.300 → 0; problem map untouched (EP19 overlap fixes
    intact).
74. **Enterprise:** LCP 3344 → 2536, CLS 0.300 → 0.
75. **Industry sample (`/industries/retail`):** LCP 2576 → 2360, CLS 0.333 → 0.
76. **About:** LCP 3656 → 3096, CLS 0.312 → 0, max task 723 → 517; hero fragments pause after the
    scene; signature moments unchanged.
77. **Contact:** LCP 2464 → 2276, CLS 0.302 → 0.
78. **Demo:** LCP 2392 → 2220, CLS 0.303 → 0; 12 states and behaviour unchanged.
79. **Security:** LCP 3216 → 2568, CLS 0.300 → 0.
80. **Resources:** LCP 3112 → 2488, CLS 0.300 → 0.
81. **Guide (`/resources/human-error`):** LCP 2632 → 2484, CLS 0.302 → 0; Lighthouse 68 → 87
    (desktop 84 → 100).
82. **Login:** FCP/LCP 2592 → 2192, max task 222 → 129; hidden layout variant's SMIL now idle;
    prototype auth unchanged.

## NETWORK

83. **Request count:** up on every page (e.g. `/pricing` 22 → 30, `/` 27 → 50) — small chunks
    requested in parallel from the HTML; fewer bytes on all non-home pages.
84. **Duplicate requests:** none (verify-prerender rejects duplicate preloads; waterfall checked).
85. **Preload:** the route's own chunk + static imports; locale dictionary on `/en`, `/zh`; Thai
    fonts on Thai pages. No preload of another route (verified for all 108 files). No "preloaded
    but not used" warning observed (108 cold loads waited ≥ 3 s in Chrome; smoke runs in Edge
    and Firefox).
86. **Prefetch:** none. Intent prefetch evaluated and not added (warm navigations already fast;
    would spend mobile bandwidth).
87. **Font chain:** Thai faces start with the HTML instead of after CSS + render.
88. **Asset chain:** entry → page chunk serial chain removed; `/en` dictionary → page chain
    removed (parallel).

## CACHE / DELIVERY

89. **Hashed assets:** every JS/CSS/font file in `/assets` is content-hashed (icon groups named
    `icons-[hash].js`).
90. **Repeat-load cache behaviour:** verified locally — second visit: 0 of 28 assets from the
    network; a different page fetched only its 1 new chunk.
91. **HTML behaviour:** per-route HTML, `no-cache` recommended so deploys are picked up; the build
    manifest is moved out of `dist/` (verify-prerender rejects `dist/.vite`).
92. **Compression measurement:** local estimates only — initial JS 179.4 KiB gzip-9 / 151.9 KiB
    brotli-11; CSS 44.5 / 35.1.
93. **Production-host caveat:** recommendations in PERFORMANCE.md §9; nothing hard-coded; real
    Cloudflare headers, compression, HTTP/2–3, redirects and 404 **not verified — EP22.1**.

## REGRESSION

94. **EP17 SEO:** 105 indexable heads + 3 shells, canonical, hreflang, OG, JSON-LD unchanged
    (verify-prerender passes; `seo.test` passes).
95. **Prerender:** same 108 files; only additions are preload links before `</head>`.
96. **Sitemap:** unchanged (`sitemap.test` passes).
97. **Discoverability:** unchanged (`discoverability.test` passes).
98. **EP18 navigation:** 5 top-level items, menus, footer and route discovery untouched.
99. **EP18.1 overlays:** overlay surface, dropdowns, DisclosureIcon untouched.
100. **EP19 accessibility:** skip link first and moves focus to `main` (verified), one H1/main on
     every checked route in three engines, ChapterProgress keeps its tab-order position,
     reduced motion unchanged. No ARIA, focus or touch-target code changed.
101. **Responsive regression:** no overflow at 390 and 1440 on 17 routes × 3 engines; visual
     review of screenshots — no flashes, missing animation, empty placeholders or layout jumps.
102. **Warehouse privacy:** unchanged (warehouse-privacy tests pass, backend tests pass).
103. **Pricing:** Starter ฿399 / Business ฿699 / Professional ฿999 / Enterprise quote and annual
     logic untouched (pricing tests pass; screenshot shows ฿399).
104. **Claim safety:** no public copy changed; claim scanners pass; no performance-marketing
     wording added.
105. **Prototype Login:** unchanged; `/app/*` without a session still redirects to
     `/login?next=…`; sign-in → workspace tests pass.

## CROSS-BROWSER / LOCALE

106. **Chrome 155:** 34/34 route×width checks pass; all measurements.
107. **Edge 156:** 34/34 pass.
108. **Firefox 141:** 34/34 pass; loop regions pause; no console errors.
109. **Safari:** NOT TESTED (unavailable on Windows). Only standard APIs are used
     (`IntersectionObserver`, `SVGSVGElement.pauseAnimations`, `animation-play-state`,
     `modulepreload` — Safari 17+); each degrades to "keeps animating" or "loads normally".
110. **Thai:** default locale; font preload; all checks pass.
111. **English:** `/en`, `/en/pricing`, `/en/resources/human-error` measured; mobile LCP
     −388…−540 ms; no font preload by design.
112. **Chinese:** `/zh`, `/zh/resources/human-error` measured; `lang="zh-CN"` intact; glyphs from
     the system Simplified-Chinese stack.

## PERFORMANCE BUDGET

113. **Budget definition:** initial JS gzip, initial CSS gzip, largest page closure, CORE World
     beyond the homepage, critical fonts, hero assets, all JS, static HTML size and count, plus
     eager-import and guide-isolation rules (PERFORMANCE.md §3).
114. **Budget results:** 179.4/205 · 44.5/52 · 59.6/72 · 235.5/265 · 88.4/100 · 36.9/45 ·
     3,677/4,100 · 502.7/540 · 108/108 — within budget.
115. **Regression script:** `scripts/perf-budget.mjs` (runs in `npm run build`; `npm run
     perf:budget` alone); `src/test/performance.test.tsx`; preload checks in
     `scripts/verify-prerender.mjs`.
116. **Headroom:** ≈ 12–20 % per budget; HTML 7 %; file count exact.

## QUALITY

117. **Frontend `npm ci`:** passes in a clean copy of `frontend/` (286 packages). In place it was
     blocked: a Vite dev server already running from this checkout (started outside this
     session, not stopped) holds `lightningcss.win32-x64-msvc.node`. `node_modules` was restored
     with `npm install`; `package-lock.json` unchanged.
118. **Typecheck:** pass (in place and clean copy).
119. **Lint:** pass, 0 warnings (route-table modules share the existing react-refresh override).
120. **Format:** pass (`npm run format`, `prettier --check`).
121. **Tests:** 805/805 pass (was 799; +6 EP20 guards). Under an artificial double load (two
     full suites at once) 2–3 heavy multi-route tests hit the 5 s timeout — the EP19 baseline
     shows the same (3 failures), so this is pre-existing.
122. **Build:** pass; the only Vite warning is the > 500 kB CoreWorld chunk (intentional lazy
     three.js chunk, budgeted; not suppressed).
123. **Prerender:** 105 pages + 3 shells written and verified.
124. **Performance-budget test:** pass.
125. **Backend gates:** `npm ci`, typecheck, lint, format, test (21/21), build — pass. No backend
     file changed.
126. **Console:** no errors or warnings in production (18 routes × 2 profiles × 3 runs; 17 routes ×
     3 engines × 2 widths) or in development mode (12 routes incl. `/app/sales`, 404); no chunk
     load errors, no WebGL errors, no aborted-preload warnings.
127. **UTF-8:** all changed files UTF-8 without BOM; no replacement characters; Thai and Chinese
     strings unchanged.

## DOCUMENTATION

128. **PERFORMANCE:** `docs/PERFORMANCE.md` — method, routes, baseline and results, budgets,
     splitting, CORE World, images, fonts, runtime rules, caching, regression rules,
     limitations.
129. **EP20_REPORT:** this file.
130. **Other docs:** README (scripts, docs index), ARCHITECTURE (routing), PUBLIC_SHELL (page
     loading, dictionaries), MOTION (runtime cost rules), BRAND (font loading), CORE_WORLD
     (performance decisions).

## KNOWN LIMITATIONS

131. **Synthetic vs real-user:** all local lab data; no RUM, no field CWV.
132. **Low-end hardware:** CPU throttling emulation only; no real low-end phone tested.
133. **Production Cloudflare:** not used; HTTP/1.1 vs HTTP/2 visibly changed results locally.
     EP22.1 verifies headers, compression, protocol, per-route HTML, redirects, 404.
134. **Safari:** not tested.
135. **Accepted performance debt:** CoreWorld chunk ≈ 236 KiB gzip (R3F pulls most of three.js);
     one stylesheet incl. `/app` utilities; full Framer `motion` (a `LazyMotion` migration
     touches every animated file); ≈ 0.8 MB heap per 12-route navigation round (pre-existing);
     mobile TBT reads higher on some routes because FCP moved earlier; unused
     `public/hero/atmosphere.*` (never downloaded).

## OWNER-REVIEW FOLLOW-UP — `/en/pricing` and `/zh/resources/human-error`

- **Method:** EP19 build vs EP20 build (and EP20 + fix), same Chrome 155, mobile profile (390×844,
  4× CPU, 1.6 Mbit/s / 150 ms), cold context per run, fixed 10 s window, builds interleaved;
  12 samples per build (first pass), 10 per build (three-way pass); medians with p25–p75;
  traces of tasks > 8 ms to attribute work; CDP total task time beside the Long Tasks total.
- **Finding:** repeatable (not variance). Total main-thread work was *lower* after EP20, but the
  page's render became one blocking script task: with the chunk preloaded, the whole page was
  rendered in React's initial (unsliced) render instead of a time-sliced Suspense retry. The
  Long Tasks API counts script tasks only, so the old sliced render was invisible to it.
  Classification: C (scheduling shift caused by earlier readiness), plus a real but small
  increase in the largest script task (≈ +45 ms on `/en/pricing`).
- **Fix:** initial `root.render` inside `startTransition` (`src/main.tsx`, one change).
- **Result (medians, EP19 → EP20 → fixed):** `/en/pricing` long-task total 253 → 502 → 185 ms,
  max task 168 → 213 → 131 ms; `/zh/resources/human-error` 657 → 926 → 574 ms, max 430 → 412 →
  403 ms; homepage 2100 → 1272 → 1004 ms; `/pricing` 531 → 390 → 115 ms. FCP/LCP unchanged vs
  EP20 (within ≈ 30 ms); CDP total task time unchanged vs EP20. Full table: PERFORMANCE.md §2.
- **User-visible impact:** none negative before or after the fix — content appeared earlier in
  EP20 (FCP −0.3 s, LCP −0.4 s on both routes), interactions measured the same, no scroll jank;
  the fix shortens the longest blocking task during load.
- **Re-verified after the fix:** initial JS 179.4 KiB gzip, budget within limits, `/app` not in
  the entry, route preloads and 108 prerendered files verified, CLS ≤ 0.004, homepage mobile
  FCP 2152 / LCP 2844 ms, CORE World 0 frames offscreen / hidden / reduced motion, 2 WebGL
  contexts per homepage round trip, Chrome + Firefox smoke, routing (hash, back/forward, reload
  scroll restoration, `/app` redirect, 404, skip link) and the development console.
- `npm run perf` added as an alias of `npm run perf:budget`.

## GIT

136. **git status:** clean after the commit.
137. **Commit:** `perf: harden CORE public runtime and delivery (EP20)` on local `main`.
138. **Push status: NOT PUSHED.** EP21 not started.
