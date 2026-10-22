# EP04 — Flagship Luxury Homepage Experience

**Date:** 2026-10-22 · **Owner:** PDA BLISS COMPANY LIMITED
**Baseline:** `main` @ `9fd62ef483b4ee61c6bd1edda8223e8ed3726c30` (EP03, on `origin/main`) — verified clean before work began
**Commit:** `feat: create flagship CORE homepage experience (EP04)` — local only, **not pushed**

## Scope

The public homepage `/` and the shared public header. Not touched: `/login`, `/app/*`, prototype
authentication, AppShell, every EP02 internal file (`git diff` against the baseline is empty
under `components/core`, `components/shell`, `workspaces/`, `prototype/`), the backend,
databases, RBAC, persistence, billing and contact submission. `/pricing` still exists; only its
import path changed (`PlansSection.tsx` → `PlansGrid.tsx`, the homepage wrapper removed).

The design is documented in [HOMEPAGE_EXPERIENCE.md](HOMEPAGE_EXPERIENCE.md).

## What was delivered

### Story (11 chapters, each with its own art direction)

| # | Chapter | Highlights |
| - | ------- | ---------- |
| 01 | CORE World | EP03 scene unchanged. New eyebrow *PDA BLISS CORE · Department Operations Platform*, H1 *แต่ละแผนกทำงานได้เต็มที่ / ทุกงานเชื่อมเป็นระบบเดียว*, CTAs **สำรวจ CORE** (→ `#who-for`) and **ดูว่า CORE เหมาะกับองค์กรของคุณหรือไม่** (→ `#fit`) |
| 02 | Who For | Living organization diagram TEAM → DEPARTMENTS → CONNECTED OPERATIONS → ORGANIZATION (Growing Business, Multi-Department Organization, Operational Business, Enterprise Organization); short desktop pin; fit checklist `#fit` |
| 03 | Complexity | Cold, grainy, fragmented: nine abstract friction artefacts (no brand logos) drift apart with scroll |
| 04 | Why CORE | Editorial statements; ONE LARGE SYSTEM → CORE morph (short pin); no competitor named |
| 05 | Department Worlds | Six worlds with procedural SVG environments and accent light; tablist; real EP02 previews (lazy, sample data); *แยกประสบการณ์การทำงาน แต่ไม่แยกข้อมูล*; Warehouse price-free with an explicit note |
| 06 | Connected Flow | Route map through CORE; five flows (การขาย, การจัดซื้อ, การรับสินค้า, การส่งมอบ, การจ่ายเงิน); pulse along the drawn route while in view; pause control; labelled illustrative |
| 07 | Human Error | Statement + PREVENT/DETECT/ALERT/CONTROL/TRACE band; five scenarios that interrupt → identify → correct → continue; replay; "CORE ถูกออกแบบมาเพื่อรองรับ…" wording and an honest roadmap note |
| 08 | Executive | Five department signal lines converge into the real executive preview — qualitative states only |
| 09 | Enterprise | Isometric stack of eight "-ready" layers separating on scroll; note that "ready" is not a certification |
| 10 | Trust | Editorial: philosophy quote, PDA BLISS COMPANY LIMITED, links to `/about`, `/#why-core`, `/contact` |
| 11 | Final CTA | CSS orbits + breathing light; statement; ขอคำปรึกษา, สำรวจ CORE เพิ่มเติม, ดูแผนกทั้งหมด; no price |

No pricing section on the homepage. A quiet chapter indicator appears on ≥ 1536 px after the hero.

### Header

Seven desktop items (Product, Departments, Solutions, Industries, Enterprise, Resources,
Company) + TH, ติดต่อเรา, เข้าสู่ระบบ; Pricing reachable from Product → แพ็กเกจ and the footer.
Transparent at top, smoked glass after scroll or while a menu is open. Mega menus (disclosure
pattern, hover intent, full keyboard support) with no dead links — unbuilt destinations are
plain-text notes. Full-screen mobile menu below 1280 px (dialog, focus trap, scroll lock,
Escape). Cross-page hash links scroll to their chapter.

### Removed

Homepage-only EP03 sections superseded by the chapters: `PresentationSlides` (+ `slides.ts`),
`ProductTransitionSection`, `DifferenceSection`, `DepartmentExperiencesSection`,
`RoleWorkspaceSection`, `ConnectedWorkflowSection`, `ErrorPreventionSection`,
`ProductPreviewSection`, `FinalCtaSection`, `previews/`, `product/ProductWindow.tsx`, and the
unused `PUBLIC_NAV` constant.

## Verification

### Gates (clean copy, `npm ci`)

| | npm ci | typecheck | lint | format | test | build |
| - | - | - | - | - | - | - |
| Frontend | ✅ | ✅ | ✅ | ✅ | ✅ 139 / 139 (9 files) | ✅ |
| Backend | ✅ | ✅ | ✅ | ✅ | ✅ 21 / 21 (4 files) | ✅ |

New / updated tests: `features/landing/home/home.test.tsx` (chapters & order, one h1, required
statements, no pricing section, no unsupported claims or credentials, every in-page link has a
target, world tablist keyboard, Warehouse price-free preview, previews hidden from AT, flow
selector, pause control, error scenarios, executive without financial figures, reduced motion),
`components/layout/header.test.tsx` (items, no Pricing, no dead mega-menu links, keyboard
disclosure pattern, cross-page section link, mobile menu open/expand/Escape/close on navigate),
updated `landing.test.tsx` and `routes.test.tsx`. Warehouse privacy, `/app/*` gating and
public-route tests continue to pass unchanged.

### Live QA — production build, headless Chrome (GPU), real input events

| Viewport | Overflow | h1 | Header fits | Menu | Worlds / Flow / Error | Scroll | EP03 regressions |
| -------- | -------- | -- | ----------- | ---- | --------------------- | ------ | ---------------- |
| 320×568 | 0 | 1 | ✅ | mobile ✅ | ✅ / ✅ / ✅ | monotonic, no snap | vertical swipe on CORE scrolls 303–305 px ✅ |
| 375×667 | 0 | 1 | ✅ | mobile ✅ | ✅ | ✅ | swipe ✅ |
| 390×844 | 0 | 1 | ✅ | mobile ✅ | ✅ | ✅ | swipe ✅ |
| 430×932 | 0 | 1 | ✅ | mobile ✅ | ✅ | ✅ | swipe ✅ |
| 768×1024 | 0 | 1 | ✅ | mobile ✅ | ✅ | ✅ | swipe ✅, WebGL paused offscreen ✅ |
| 1024×768 | 0 | 1 | ✅ | mobile ✅ | ✅ | ✅ | drag/click/Escape ✅ |
| 1280×720 | 0 | 1 | ✅ (1265/1265) | mega ✅ kbd ✅ | ✅ | ✅ | ✅ |
| 1440×900 | 0 | 1 | ✅ (1320/1320) | mega ✅ kbd ✅ | ✅ | ✅ | ✅ |
| 1920×1080 | 0 | 1 | ✅ (1440/1440) | mega ✅ kbd ✅ | ✅ | ✅ | ✅ |
| 1440 reduced motion | 0 | 1 | ✅ | ✅ | static: no pause/replay, all steps shown, final scenario | ✅ | idle drift 0 px |

EP03 behaviour (desktop): idle drift 2.7–5.8 px over 2.5 s (restrained, no mouse-follow; sweep
2.1–4.1 px), drag outside CORE ≤ 2.9 px (no rotation), drag on CORE 122–249 px then settles
(residual ≤ 1 px), drag selects nothing, node click selects, CORE click and Escape clear,
WebGL pauses offscreen (phones verified by canvas pixels: on-screen diff 1.8–6.5, offscreen 0).
Scroll: no snap-back after 1.5 s; wheel/touch traces strictly monotonic.

**Performance:** 147 fps hero (rAF, headless), 126–144 fps while scrolling; JS heap 11–13 MB.
**Console:** zero warnings/errors across all runs (no WebGL warnings, no THREE.Clock warning
in the production build).

**Bundle:** critical path 259.7 KB gzip (EP03: 250.9 KB, +8.8 KB). Rolldown now inlines the
router and Framer chunks into `index` (234.5 KB gzip), which is why that single file looks
larger. Lazy: `previews` 3.8 KB gzip (+ the shared internal-UI chunk on demand), `CoreWorld`
243.9 KB gzip, unchanged.

### UTF-8

All 39 new/changed text files (plus 13 deleted): valid UTF-8, no BOM, no CR, no U+FFFD, no
mojibake, no NBSP; 32 contain Thai.

## Fixed during QA

- Header overflowed at 1280–1920 → tighter triggers, compact logo below 2xl, wider container at 2xl.
- Chapter indicator's invisible labels blocked CORE clicks at 1920 → hidden over the hero, dot-only hit area.
- Flow pulse and the purchasing art dot drifted off their routes (CSS `offset-path` ignores the
  SVG viewBox scale) → pulse measured with `getPointAtLength`; art dot uses SVG `animateMotion`.
- Mega panel let the hero show through (nested backdrop blur) → near-opaque panel.
- Executive preview truncated department names → full-width layout without the sidebar.
- Mobile menu decorative glow widened its box → `overflow-hidden`.

## Known limitations

- Industry pages, Analytics, Mobile, Integrations, Security, Scalability, API, Product Guide,
  FAQ and Updates have no pages yet — they appear as notes, not links.
- The language pill shows TH only (no EN content yet).
- Live QA ran in headless Chrome with emulated touch; real iOS Safari / Android devices were
  not tested in this episode.
- The running dev server on :1111 may print a THREE.Clock warning from a stale Vite pre-bundle
  (`node_modules/.vite`); restarting it with `--force` clears it. Production is unaffected.
- `index` chunk exceeds Vite's 500 KB advisory (pre-existing; critical path +8.8 KB gzip).
