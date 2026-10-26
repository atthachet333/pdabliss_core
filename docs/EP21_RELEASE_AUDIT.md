# EP21 — Public Frontend Release-Candidate Audit

**Verdict: PASS WITH ACCEPTED LIMITATIONS — EP22 (Public Frontend Freeze) is recommended.**

This audit answers one question: *if the public frontend were frozen now, is there any known
reason not to trust it?* It found three real P2 defects and six P3 issues, fixed all nine with
regression tests, and accepts five P3 items plus six environmental limitations listed below.

> **Scope.** Passing EP21 means **Public Frontend v1 is ready to freeze**. It does **not** mean
> PDA BLISS CORE is production-ready as a complete product: real authentication, the database,
> RBAC, organizations/users, audit, master data and the CORE engines are built from EP23 on, and
> production deployment, real Cloudflare delivery and production SEO/indexing are verified only
> after full-system QA.

The reusable checklist distilled from this audit:
[PUBLIC_FRONTEND_RELEASE_CHECKLIST.md](PUBLIC_FRONTEND_RELEASE_CHECKLIST.md).

## Baseline and method

- **Baseline:** `a8e65b37ae6fc4554e72e789b4e3a99fed8a9d0e` (EP20 follow-up) — `main`, clean,
  `HEAD` = `origin/main`, verified before work.
- **Builds audited:** the production `dist` from `npm run build`, served by a local static-host
  emulation (per-route HTML, `_redirects` 301/200, `404.html`, brotli/gzip, immutable assets),
  re-measured after every fix round (five builds). A second build with
  `VITE_ENABLE_PROTOTYPE=true` was used only for the prototype sign-in journeys. The Vite dev
  server was used once, read-only, to collect React development warnings.
- **Machine / tools:** Windows 11, i5-12400, 32 GB, GTX 1660 Ti. Temporary tools outside the
  repository: Playwright 1.64 (Chrome 155, Edge 156), Playwright 1.55 Firefox 141 (browser files
  under `D:\Temp\pw-browsers`), axe-core 4.14, Chrome DevTools Protocol (DOM counters, heap
  snapshots). No permanent dependency added. Safari: **not available on Windows — not tested.**
- **Automation (all in a scratch folder, not committed):** full crawler (every sitemap URL, every
  header menu opened, links/anchors/IDs/text/console/network), content scanners (claims, absolute
  words, fake proof, money in Warehouse, contact data, CTA inventory, Thai/Traditional leakage),
  journeys A–H, all seven Contact paths, keyboard/cookie/short-height UI checks, an 18-width sweep,
  reduced-motion and forced-colors checks, axe, heap/DOM-counter investigation with retainer
  tracing, and 36 release-candidate screenshots (kept outside Git).

## Coverage

| Area | Coverage |
| --- | --- |
| Routes | 35 public routes × TH / EN / ZH = **105 indexable URLs** + `/login` + 3 shells (`login.html`, `404.html`, `app.html`) — derived from `src/config/publicRoutes.ts` and the sitemap |
| Link crawl | 9,863 internal links at 1440 (every mega-menu panel opened) and 6,431 at 390 (mobile menu), 916 anchors |
| Browsers | Chrome 155, Edge 156, Firefox 141 — Safari not tested |
| Widths | 320, 360, 375, 390, 412, 430, 480, 640, 768, 820, 1024, 1180, 1280, 1366, 1440, 1536, 1600, 1920 (14 routes × 18 widths in Chrome = 252 checks; 6 × 18 in Firefox = 108) plus full crawls at 320/390/1440 |
| Short / landscape | 390×667, 1366×768, 1440×800, 844×390 |
| Journeys | A new visitor · B purchase · C enterprise · D knowledge · E industry · F valid prototype sign-in · G wrong password and recovery · H TH→EN→ZH→TH with query and hash, plus Back — 39 steps × 3 engines |
| Contact | all 7 paths in TH + 2 EN + 2 ZH, in Chrome and Firefox |
| Accessibility | axe (WCAG 2.0/2.1/2.2 A–AA tags) on 22 routes × 3 locales × 390/1440 + open mega menu / mobile menu (Chrome), TH/EN subset in Firefox; keyboard-only journey; reduced motion; forced colors |

## Findings matrix

Severity: P0 release blocker · P1 serious · P2 fix before freeze · P3 low priority.

### Fixed

| ID | Route / area | Locale | Browser / viewport | Category | Sev. | Description | Reproduction | Expected | Actual (before) | Fix | Regression test | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EP21-01 | `/features` safeguards, `/departments` (Warehouse line), `/departments/warehouse` | TH / EN / ZH | all | Claims honesty | P2 | Server-side enforcement stated as current fact although no backend enforces it ("Server-enforced permissions", "the server sends no price data", "the server never sends them") | Read the Safeguards list, the Warehouse department card, the Warehouse privacy lead | Product pages describe enforcement as CORE's design; Security separates today / planned | Present-tense claims of a running server | Wording: "Designed so…", "ออกแบบให้…", "设计为…" — meaning unchanged | `src/test/release.test.ts` (server statements need a design qualifier; old phrases banned) | Fixed |
| EP21-02 | Header mega menus | all | Chrome / Edge / Firefox ≥ 1280 | Keyboard | P2 | After Enter opened a panel, Tab skipped it and went to the next trigger; the panel's links came only after the remaining triggers | Focus "ผลิตภัณฑ์", Enter, Tab | Tab enters the open panel | Focus moved to "โซลูชัน" | Tab on an open trigger → first panel link; Shift+Tab from first link → trigger; Tab from last link → closes panel, next trigger | `header.test.tsx` "keeps an open panel next in the Tab order (EP21)"; verified in 3 engines | Fixed |
| EP21-03 | `/` (CORE World) | all | Chrome (DevTools Protocol) | Runtime / memory | P2 | Every homepage visit retained ≈ 308 detached DOM nodes, 37 listeners, the old WebGL context and canvas | Home ↔ any page, forced GC, CDP `Memory.getDOMCounters` | Nothing retained after leaving | +1,848 nodes / +222 listeners / +1.1–2.1 MB per round of 6 home visits | `core-world/halo.ts` releases the cached halo texture and three.js's shared sprite geometry on scene unmount (their `dispose` listeners kept every past renderer alive) | `core-world/halo.test.ts` | Fixed — 0 nodes / 0 listeners per round |
| EP21-04 | Cookie Settings dialog | all | all | Focus management | P3 | Closing Cookie Settings without a choice sent focus to `<main>`, not to the control that opened it | Banner → Cookie settings → Escape | Focus returns to the opener | Focus on `main` | Remember the opener; restore it (re-found in the re-mounted banner), `main` only as fallback | `shell.test.tsx` "closing Cookie Settings returns focus…" | Fixed |
| EP21-05 | Header language button | all | ≥ 640 | Accessibility (WCAG 2.5.3) | P3 | Accessible name "ภาษา: ภาษาไทย (TH)" failed axe *label-content-name-mismatch* on every page | axe at 1440 | Visible code part of the name, matched by tools | 44 page-state violations | Name starts with the visible code: "TH, ภาษา: ภาษาไทย" (EN/ZH same pattern) | Header, site-language, SEO and overlay tests updated; axe now clean | Fixed |
| EP21-06 | Contact CTAs (Pricing, Enterprise, Industries) | TH (+1 ZH) | all | Content consistency | P3 | The same "talk to the team" action used three Thai labels (คุยกับ / พูดคุยกับ / ปรึกษาทีม) and one Chinese outlier, while English used one | CTA inventory over all pages | One label per action and locale | 3 Thai variants, 2 Chinese | Normalised to "คุยกับทีม PDA BLISS" / "与 PDA BLISS 团队沟通" | `release.test.ts` (variants banned) | Fixed |
| EP21-07 | `/product-preview/README.md` | — | — | Source hygiene | P3 | A stale developer note (pointing at a path that no longer exists) shipped publicly | Request the URL | No developer files in the public site | 200 OK | File removed | `release.test.ts` ("public folder ships no developer notes") | Fixed |
| EP21-08 | `security.test.tsx` | — | Vitest | Test reliability | P3 | One test asserted `document.title` synchronously; the title is set by an effect and occasionally lagged under parallel load | Full suite, repeated | Every title assertion waits for the effect (13 of 14 already did) | 1 failure in 3 runs | `waitFor` like the other 13 | Suite 3 × 813/813 | Fixed |
| EP21-09 | `docs/PERFORMANCE.md` | — | — | Documentation | P3 | Said production Cloudflare verification happens in "EP22.1" (contradicts the roadmap) and listed the heap growth as unexplained | — | Matches the roadmap and the EP21 finding | Outdated | Updated, plus README project status | — | Fixed |

### Accepted

| ID | Area | Sev. | Description | Why accepted |
| --- | --- | --- | --- | --- |
| EP21-A1 | `/about` | P3 | axe *color-contrast* on the large ghost chapter numbers (contrast 1.06) | Pure decoration, `aria-hidden`; WCAG 1.4.3 exempts decoration. Only remaining axe result in all engines |
| EP21-A2 | EN / ZH product pages | P3 | Thai text appears in EN/ZH bodies: the inert, `aria-hidden`, captioned Thai product-UI previews, and the office address | Approved and documented since EP05/EP06/EP17; the address is printed exactly as registered |
| EP21-A3 | `public/hero/atmosphere.{avif,webp}` | P3 | Two unused 8 KiB images ship but are never requested | Never downloaded; removal is a content decision |
| EP21-A4 | Test suite under artificial load | P3 | Running two full suites at once makes heavy multi-route tests hit the 5 s timeout | Same at the EP19 baseline; normal runs pass 3 × 813/813 in place and in a clean `npm ci` copy |
| EP21-A5 | CORE World | P3 | react-three-fiber keeps a module-level reference to the most recently rendered scene until the next render | Bounded (one scene), library-internal; measured growth across repeated visits is 0 |

### Deferred (not frontend-freeze blockers)

Real production delivery (Cloudflare compression and cache headers, HTTP/2–3, per-route HTML,
`_redirects` behaviour including query preservation on 301, 404) and production SEO/indexing —
the production-deployment phase after the backend. Real devices, field Core Web Vitals and
Safari — later full-system QA. Real authentication and server-side permission enforcement — EP23+.

**Counts: P0 0 · P1 0 · P2 3 (all fixed) · P3 11 (6 fixed, 5 accepted) · fixed 9 · accepted
findings 5 · accepted environmental limitations 6.**

## Report

### Baseline

1. **Baseline:** `a8e65b3` — `perf: slice the initial CORE page render (EP20 follow-up)`, pushed.
2. **Final commit:** `test: complete CORE public release candidate audit (EP21)` (local, the
   commit containing this report).
3. **Release verdict:** PASS WITH ACCEPTED LIMITATIONS.
4. **P0:** 0. 5. **P1:** 0. 6. **P2:** 3 (fixed). 7. **P3:** 11 (6 fixed, 5 accepted).
8. **Fixed:** 9. 9. **Accepted limitations:** 5 findings + 6 environmental (Safari, real devices,
   synthetic performance, production delivery not verified, prototype auth by design, backend
   enforcement not built).
10. **EP22 recommended:** yes.

### Routes

11. **Public routes:** 35 per locale (Homepage, Features, Departments + 6 departments, Solutions,
    How CORE Works, Enterprise, Industries + 6 industries, Pricing, About, Why CORE, Contact, Demo,
    Security, Resources + 7 guides, Privacy, Terms) + `/login`.
12. **TH:** 35. 13. **EN:** 35. 14. **ZH:** 35 — 105 indexable URLs.
15. **Shells:** 3 (`login.html`, `404.html`, `app.html`).
16. **Broken routes:** 0. 17. **Orphan routes:** 0.
18. **Redirects:** `/th/*`, `/zh-CN/*`, `/zh-hans/*` → 301 to the canonical prefix; `/en/login`,
    `/zh/login` → sign-in shell; `/app/*` → app shell (redirects to `/login?next=…` without a
    session). No loops.
19. **404:** real 404 status; localized title, H1 and links (home, resources, contact); `noindex`;
    doubled (`/en/en/…`) and malformed (`/fr/…`) locales → 404.
20. **Link crawl:** 9,863 (1440, all menus) + 6,431 (390) internal links — 0 broken, 0 empty, 0
    doubled locale, 0 localhost, locale preserved.
21. **Anchor crawl:** 916 anchors, 0 missing; hash targets land below the fixed header (journeys
    B, E, H).

### Navigation

22. **Header:** pass — five items, family activation verified per journey, no overflow 1280–1920.
23. **Product menu:** pass — Departments, How CORE Works, Demo, Pricing, six departments.
24. **Solutions menu:** pass — problems, industries (6), Enterprise.
25. **Knowledge menu:** pass — Resource Center + 7 guides.
26. **About menu:** pass — About, Why CORE, Security & Trust, approach / consulting anchors.
27. **Language selector:** pass — keeps path, query, hash; name fixed (EP21-05).
28. **Contact:** pass. 29. **Login:** pass.
30. **Mobile menu:** pass — 320–430, 390×667 last item reachable, Escape / focus return.
31. **Footer:** pass — approved contact data, legal row, locale-preserving links, no dock overlap.
32. **Discoverability:** pass — 0 orphans; EP17 discoverability tests green.
    Keyboard order into open panels fixed (EP21-02).

### Pages

33. **Homepage:** pass — 11 chapters, no pricing section, CORE World load / fallback / reduced /
    offscreen / hidden-tab pause, one canvas per visit; memory leak fixed (EP21-03).
34. **Features:** pass — editorial sequence, safeguards wording fixed (EP21-01).
35. **Departments:** pass — six department pages; Warehouse money scan clean.
36. **Pricing:** pass — values, annual table arithmetic, configurator, FAQ, CTAs.
37. **How CORE Works:** pass. 38. **Solutions:** pass (problem map, all themes).
39. **Enterprise:** pass. 40. **Industries:** pass (overview + 6, boundaries present).
41. **About:** pass (accepted A1). 42. **Why CORE:** pass. 43. **Contact:** pass (7 paths).
44. **Demo:** pass (scenario values, all states tested). 45. **Security:** pass (today / planned
    framing). 46. **Resources:** pass (search, filters, no-result state, glossary links).
47. **Seven guides:** pass — standalone, no fake author / date / download, related links resolve.
48. **Login:** pass — production closed state; prototype journeys F/G.
49. **Privacy:** pass. 50. **Terms:** pass. 51. **404:** pass.

### Claims and boundaries

52. **Pricing rules:** Starter ฿399 · Business ฿699 (recommended) · Professional ฿999 · Enterprise
    quote; Year 1 = 12 × monthly (฿4,788 / ฿8,388 / ฿11,988), Year 2 = 10 × (฿3,990 / ฿6,990 /
    ฿9,990), Year 3+ ≈ 15 % off (฿4,070 / ฿7,130 / ฿10,190); no free plan. Unchanged.
53. **Package consistency:** storage, departments, API and FEFO rules unchanged; pricing tests green.
54. **Warehouse privacy:** pass — no money values on any Warehouse page in any locale; Demo
    Warehouse view tested in every state; Security shows money fields only as "stops before this
    view".
55. **Security claims:** pass — claim scanner clean (hits are negations); server enforcement now
    framed as design (EP21-01).
56. **Human Error:** pass — PREVENT / DETECT / ALERT / CONTROL / TRACE; "not a guarantee that
    mistakes never happen" in all locales.
57. **Accounting boundary:** pass — "not a full accounting system, general ledger or tax filing".
58. **Retail:** pass — "not a POS". 59. **Property:** pass — does not replace PDA BLISS Property &
    Rental Management. 60. **Manufacturing:** pass — "not a full MRP or MES".
61. **Contact honesty:** pass — "ready — but it has not been sent"; no network request.
62. **Prototype / auth honesty:** pass — Security and Login say sign-in is a prototype; the
    production bundle contains no demo password; prototype auth retires in EP23.
63. **Fake-claim audit:** pass — no customer counts, ROI, testimonials, awards, certifications,
    fake authors or dates (illustrations are labelled as such).

### Localization and SEO

64. **Thai:** pass. 65. **English:** pass (approved exceptions A2). 66. **Chinese:** pass —
    Simplified only, 0 Traditional characters.
67. **Hard-coded strings:** none found in public chrome or bodies beyond approved exceptions.
68. **Language switch:** pass — route, query and hash kept; Back works (journey H, 3 engines).
69. **Metadata:** pass. 70. **Canonical:** pass. 71. **hreflang:** pass (th / en / zh-CN /
    x-default). 72. **OG:** pass. 73. **Structured data:** pass (WebSite, Organization where
    expected).
74. **Sitemap:** valid XML, 105 unique URLs, 420 alternates, no `/app` or `/login`.
75. **Robots:** allow `/`, disallow `/app/`, sitemap listed.
76. **Initial HTML:** verified before JavaScript for all 105 + 3 (`npm run test:prerender`).
77. **Prerender:** 105 pages + 3 shells, per-route preloads and Thai font preloads intact.

### Accessibility

78. **Axe:** Chrome 22 routes × 3 locales × 2 widths + open menus, Firefox TH/EN — only A1 remains.
79. **Keyboard:** skip link → header → mega menu (Tab order fixed) → Pricing tabs → Contact →
    Resource search → Login → cookie banner — pass in 3 engines.
80. **Focus:** visible; Cookie Settings focus return fixed (EP21-04).
81. **Landmarks:** one `main`, header, footer, named navs. 82. **Headings:** one H1, no skipped
    levels found by the crawl.
83. **ARIA:** disclosures, regions, dialogs, `aria-current` checked. 84. **Forms:** Contact and
    Login labels, validation, autocomplete. 85. **Tables:** pass (EP19 structure unchanged).
86. **Disclosures:** pass. 87. **Contrast:** pass except decorative A1.
88. **Reduced motion:** 0 infinite animations and 0 SMIL loops on Homepage, About, How CORE
    Works, Sales, Login, Demo; CORE World on its `reduced` tier (Chrome and Firefox).
89. **Forced colors:** pages render, controls visible, no overflow (Chromium emulation).
90. **Screen readers:** not tested with real screen readers; coverage is automated semantics,
    axe and keyboard.

### Responsive and browsers

91. **Widths:** 18 widths, 360 page×width checks — 0 overflow, 0 clipped controls.
92. **Short heights:** pass (390×667, 1366×768, 1440×800). 93. **Landscape:** pass (844×390,
    cookie controls reachable).
94. **Chrome:** pass. 95. **Edge:** pass. 96. **Firefox:** pass.
97. **Safari:** not available — not tested.
98. **Visual consistency:** 36 screenshots reviewed (11 pages × 390/1440, menus at
    1280/1440/1920, footer) — consistent with EP18/EP18.1/EP20; no redesign.

### Performance

99. **Initial JS:** 179.6 KiB gzip (budget 205; EP20 179.4).
100. **CSS:** 44.5 KiB gzip (budget 52). 101. **Budget:** within budget (`npm run perf`).
102. **CLS:** ≤ 0.003 measured on the final build (EP20 harness: 10 routes × desktop and
     throttled mobile).
103. **LCP direction:** in line with EP20 (e.g. mobile homepage 3,088 ms vs 3,140; `/pricing`
     2,808 vs 2,752; desktop lazy routes 448–652 ms); no loading-path change in EP21.
104. **Long tasks:** in line with EP20 (mobile max task: homepage 309 ms, `/pricing` 110 ms);
     the EP20 follow-up (sliced initial render) is intact.
105. **CORE World runtime:** 0 frames offscreen / hidden / reduced; one canvas per visit.
106. **Heap growth:** real leak found and fixed (EP21-03); the EP20 "≈ 0.8 MB per round" was this
     leak. After: 0 retained nodes / listeners per round; heap flat within GC noise.
107. **Network / build:** no failed assets, no wrong-locale chunks, no preload warnings.
108. **Production caveat:** local synthetic measurements only; production not deployed.

### Quality gates

109. **npm ci (frontend):** pass in a clean copy (286 packages). In place it is blocked by a
     frontend dev server already running from this checkout (not started in this session, not
     stopped).
110. **Typecheck:** pass. 111. **Lint:** pass, 0 warnings. 112. **Format:** pass.
113. **Tests:** 813 / 813 (was 805; +8 EP21 regression tests), three consecutive runs.
114. **Build:** pass. 115. **Prerender:** pass. 116. **Perf budget:** pass.
117. **Backend:** `npm ci`, typecheck, lint, format, test (21/21), build — pass; no backend file
     changed.
118. **Console:** no errors or warnings on any route (production crawl) or in development mode.
119. **UTF-8:** changed files UTF-8 without BOM; no replacement characters; Thai/Chinese intact.
120. **Source / debug scan:** no `console.log`, `debugger`, `alert(`, lorem or temporary code; one
     intentional `console.warn` (WebGL fallback) and one `TODO(backend)` developer comment.
121. **Secret hygiene:** no secrets; public env values are `VITE_SITE_URL` / `VITE_API_URL`;
     `user1/pass1` exists only in prototype code, excluded from the default production bundle.

### Documentation

122. **EP21_RELEASE_AUDIT:** this document.
123. **PUBLIC_FRONTEND_RELEASE_CHECKLIST:** created.
124. **Other docs:** README (project status, scripts, links), PERFORMANCE (roadmap, leak),
     CORE_WORLD, GLOBAL_NAVIGATION, ACCESSIBILITY_RESPONSIVE.
125. **Known limitations:** Safari; no real devices or screen readers; synthetic performance only;
     production delivery and SEO not verified; prototype auth by design; backend enforcement not
     built.
126. **Deferred:** production delivery / SEO (deployment phase), real devices and Safari
     (full-system QA), real auth and enforcement (EP23+).

### Git

127. **git status:** clean after the commit.
128. **Commit:** `test: complete CORE public release candidate audit (EP21)` on local `main`.
129. **Push status: NOT PUSHED.**
130. **EP22 status: NOT STARTED.**

## EP22 recommendation

Proceed to **EP22 — Public Frontend Freeze**: lock the v1 scope (routes, content, design), record
the frozen baseline, define the post-freeze change policy (fix-only, using the release checklist),
set the backend hand-off boundaries (prototype auth, inquiry delivery seam, permission enforcement)
and prepare EP23. EP22 should not deploy production and should not start the production SEO launch.
