# EP03 — Interactive CORE Universe & Luxury Public Homepage

**Date:** 2026-10-22 · **Owner:** PDA BLISS COMPANY LIMITED
**Baseline:** `main` @ `1f0b2804e7b4a8148d371ab97fef16500b032f0b` (EP02) — verified clean before work began
**Commit:** `feat: create interactive CORE Universe experience (EP03)` (not pushed)

## Scope

Public homepage only. Not touched: `/login` behaviour, `/app/*`, prototype authentication,
the internal AppShell and every EP02 workspace file (git shows no change under
`components/core`, `components/shell`, `workspaces/`, `prototype/`), the backend, databases,
authentication and persistence. Other public pages were not redesigned; the shared public
header received only its scrolled-state polish.

## What was delivered

### Slide 01 — CORE World hero (design-locked)

A real-time WebGL scene (three.js r182 + @react-three/fiber 9; no drei, no GSAP, no
post-processing): an obsidian-glass CORE with procedural network lines, travelling data points,
internal emerald energy, fresnel rim and a pointer-lit glass highlight; a breathing halo and
geodesic lattice; three orbits; six department nodes (Sales, Operations, Warehouse,
Purchasing, Accounting, Reports) at varied radius and height; spokes into CORE with data
pulses; sparse particles and an atmospheric glow. Branding "PDA BLISS / CORE / One Source of
Truth" and all department labels are crisp DOM text projected onto the scene.

**Interaction model (final, after the owner's revision):**

| | Behaviour |
| - | --------- |
| Composition | Stable, presentation-like. Idle ring drift ±0.025 rad (≈ 3 px); nodes float gently; no camera move, no parallax, no background or cursor ring following the pointer |
| Pointer | Moves the glass highlight / rim light only, plus a ≤ 0.012 rad depth tilt |
| Drag | Only from the CORE / orbit area, with the mouse button held; yaw ±0.6 / pitch ±0.15 rad; restrained inertia; eases home after 2.6 s idle; grab / grabbing cursor |
| Hover / focus | Node grows and glows, its spoke and pulses brighten, other nodes dim, detail panel opens; pointer cursor |
| Click / Enter | Selects (persistent), synced with the DOM button (`aria-pressed`); detail links to `/departments#id` |
| Clear | Click CORE, Escape, or the focus-only "กลับสู่ภาพรวม CORE" button |
| Touch | Horizontal drag rotates; vertical swipes scroll the page, even when they start on the CORE |

Hero copy (Thai-first): eyebrow *Department Operations Platform*; H1 *ทุกแผนกทำงานได้เต็มที่ /
ทุกงานเชื่อมเป็นระบบเดียว*; CTAs **ดูภาพรวมระบบ** (→ `#preview`) and **สำรวจ CORE** (→ Slide 02).
"เริ่มทดลองใช้" is no longer the hero CTA.

### Slides 02–04 — presentation below the hero

| Slide | Animation language |
| ----- | ------------------ |
| 02 Departments | six workspace cards unfold outward from a central CORE emblem; connectors draw; five-value constellation line |
| 03 Flow | a document travels Sales → Operations → Purchasing → Warehouse → Accounting → Reports station by station (only while on screen) |
| 04 Workspace | a CORE node opens (clip-path) into the real Warehouse workspace built from EP02 `components/core`; data lines flatten into interface rules |

Full-height scenes activated by IntersectionObserver, plus a quiet desktop progress indicator
(four dots; labels on hover/focus; real anchors). **No scroll snapping** — see QA finding 4.
Existing homepage sections follow unchanged.

### Navigation

Public header: fully transparent at the top; after scrolling, dark glass (72 % navy, blur,
saturate), hairline border and a soft shadow; hover underline on links.

### Performance & resilience

- Tiers high / medium / low / reduced / static; DPR capped (≤ 1.5 / 1.25 / 1); runtime
  step-down on sustained slow frames.
- three + R3F + scene in a lazy `CoreWorld` chunk requested after first paint; a static SVG
  CORE paints immediately and cross-fades to WebGL (no spinner).
- Rendering pauses when the hero is offscreen or the tab is hidden; reduced motion renders on
  demand only.
- `WebGLBoundary` + `webglcontextlost` → static fallback; no WebGL / software GPU → static.

## Live QA

Real Chrome 155 with the real GPU (ANGLE D3D11, NVIDIA GTX 1660 Ti) driven over the DevTools
protocol with **real input events** (mouse, wheel, keyboard, touch) against the production
build (`vite preview`). The in-app Browser pane was used for the initial visual review and
baseline, but stops painting whenever it is reported hidden, so the timed WebGL checks were run
headless. Five full passes; the final pass is reported here.

### Desktop

| Check | 1920×1080 | 1440×900 | 1280×720 |
| ----- | --------- | -------- | -------- |
| Tier / frame rate | high / 146 fps* | high / 146 fps* | high / 146 fps* |
| Horizontal overflow / h1 count | 0 / 1 | 0 / 1 | 0 / 1 |
| Label ↔ hero copy collisions | none | none | none |
| Idle movement in 3 s (float incl.) | 6.2 px | 4.6 px | 4.1 px |
| Ordinary mouse sweep, no button | 6.3 px (hero top 0, scrollY 0) | 4.8 px | 4.2 px |
| Drag starting outside CORE/orbit | 4.6 px (= float, no rotation) | 2.8 px | 2.5 px |
| Deliberate drag on CORE | 249 px rotation | 183 px | 165 px |
| Inertia after release → settled | 2.5 → 1.2 px | 1.7 → 0.9 px | 1.5 → 0.8 px |
| Plain moves after a drag | 2.1 px (no rotation) | 2.1 px | 1.9 px |
| Second very long drag (clamp) | +2.6 px | +1.8 px | +1.6 px |
| Eases home after idle | yes (225 px back) | yes | yes |
| Cursor: over CORE / dragging / on node | grab / grabbing / pointer | same | same |
| Hover 3D node (real mouse) | Warehouse detail, node + spoke lit, others dim, composition moved ≤ 4.7 px | ✓ | ✓ |
| Click node → DOM button synced | คลังสินค้า pressed | ✓ | ✓ |
| Click CORE → cleared | ✓ | ✓ | ✓ |
| Keyboard Tab / Enter / Escape | focus previews ปฏิบัติการ / selects / clears | ✓ | ✓ |
| Two wheel notches from top | stays at 200 px | 200 | 200 |
| Flicks down / up through slides | 840 → 1880 → 2720 → back to 0, progress tracks slide | ✓ | ✓ |
| Slow wheel upward | steady 100 px steps | ✓ | ✓ |
| Hero paused offscreen / resumed | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ |
| Refresh on Slide 02 | position kept (1080), progress #core-story, 1 h1 | ✓ (900) | ✓ (720) |

\* Headless Chrome runs uncapped (no vsync); on a display the scene runs at the refresh rate.
Main thread 33–47 % busy while rendering uncapped; JS heap 11–15 MB.

### Mobile (touch emulation, mobile UA)

| Check | 390×844 | 320×568 |
| ----- | ------- | ------- |
| Tier | low | low |
| Overflow (top, after scrolling) / h1 | 0 / 1 | 0 / 1 |
| Floating labels (replaced by selector) | 0 | 0 |
| Department button size | ≥ 114 × 56 px | ≥ 91 × 56 px |
| Horizontal swipe on CORE | rotates (canvas Δ 9.05 vs idle 1.89); page scrollY 0, scrollX 0 | rotates (Δ 10.7 vs idle 7.8); page did not move |
| Vertical swipe starting on CORE | page scrolls 334 px | page scrolls 328 px |
| Tap department | selected + detail | selected + detail |
| Whole-page swipe through slides | 2918 px, no overflow | 1724 px, no overflow |

### Console / WebGL

Zero console warnings, errors or exceptions across all five viewports (production build).
No three.js warnings (r182; see CORE_WORLD.md for why r183+ is avoided).

### Findings fixed during live QA

1. **Hero copy layer blocked the canvas on desktop.** The full-width hero section sat above the
   WebGL canvas, so real-mouse hover, drag and CORE clicks never reached the scene (synthetic
   tests had dispatched straight to the stage). The section is now pointer-transparent with
   only the copy column interactive.
2. **Stale drag.** A mouse could keep rotating the world after the button was released elsewhere.
   Rotation now requires the button held; stale drags end on the next move; the cursor resets.
3. **Hover flicker** between a 3D node and its DOM label — clearing is debounced (80 ms).
4. **Scroll snap fought the visitor.** With `proximity` snap, a 1920×1080 downward flick
   reached ~245 px and was pulled back to 0 (one-viewport slides make every position "near" a
   snap point). Snapping was removed; slides are full-height scenes on native scroll.
5. **Progress indicator over a label at 1280×720.** Labels now appear only on hover/focus and
   the hit area is the dot only.
6. **Slide titles broke inside Thai compounds** ("ทุก / คน"); space-separated phrases are kept
   whole.

## Gates

| Gate | Frontend | Backend |
| ---- | -------- | ------- |
| typecheck | ✅ | ✅ |
| lint | ✅ 0 errors, 0 warnings | ✅ |
| format:check | ✅ | ✅ |
| test | ✅ **122 passed** (7 files; EP02: 106) | ✅ 21 passed (unchanged) |
| build | ✅ | ✅ |

New/updated frontend tests: hero copy and CTA anchors; one accessible control per orbiting
department (no Admin); selection → detail (Warehouse, price-free) → Escape; keyboard focus
preview + Enter; static fallback without WebGL (CORE identity kept); reduced-motion render
and tier; quality detection (no WebGL / software GPU → static, touch → low, step-down only);
WebGL error boundary contains failures; four slides with crawlable headings and the real
product UI; progress indicator anchors; no scroll snapping; no prototype credentials on the
homepage; public navigation. All EP02 tests kept (two homepage assertions updated for the
redesigned hero). The production bundle still contains no demo password.

**Bundle:** public entry 150.6 KB gzip (EP02: 140.3 KB, +10.3 KB). Lazy `CoreWorld` chunk
243.9 KB gzip (three + R3F + scene), requested after first paint. `ProductWindow` 1.8 KB gzip (lazy).

**UTF-8 / Thai:** see the commit's scan — 0 BOM, 0 invalid UTF-8, 0 U+FFFD, 0 mojibake, 0 CRLF.

## Known limitations

- three.js is pinned to the r182 line until @react-three/fiber stops using the deprecated
  `THREE.Clock` (r183+ logs a warning on every load).
- The `CoreWorld` chunk is large (≈ 244 KB gzip) because R3F includes all of three; it loads
  after first paint and only on the homepage.
- Live QA ran in headless Chrome on one discrete GPU; integrated-GPU laptops and real phones
  were not measured (the low tier and the runtime step-down exist for them).
- At 320 px the canvas was still fading in during the swipe measurement, so its rotation
  signal is weaker than at 390 px (both showed no page movement on horizontal swipes).
- The scene keeps story-stage hooks (spread / workspace rings / process arcs) for future
  episodes; the homepage uses the overview stage only.

## Recommended EP04

The public site's remaining pages (Features, Solutions, Departments) rebuilt on the
presentation language established here — reusing the slide patterns and the real EP02 UI —
with an SEO pass (structured data, Open Graph per page). Do not start before the owner signs
off EP03.
