# CORE World — the interactive homepage universe

**Introduced:** EP03 · **Code:** `frontend/src/features/landing/core-world/` (scene + DOM),
`frontend/src/features/landing/sections/HeroExperience.tsx` (Slide 01),
`frontend/src/features/landing/sections/PresentationSlides.tsx` (Slides 02–03, progress),
`frontend/src/features/landing/sections/ProductTransitionSection.tsx` (Slide 04: to product UI)

## 1. Visual philosophy

*Luxury enterprise technology + an interactive digital world + PDA BLISS identity.*

Every department works in its own environment; every department connects through CORE — the
single source of truth, the workflow centre, the operating brain of the organisation. The hero
makes that literal: a dark, sculptural CORE with six departments in orbit, data flowing into it.

The CORE is a **proprietary digital artefact**, not a planet, a gaming orb or a token:

- obsidian / smoked-glass body (`#0a1620`), opaque, with layered depth
- procedural latitude/longitude **network lines** (anti-aliased, thinned at the poles)
- **data points** travelling along half the meridians, each at its own pace
- an **internal emerald energy** volume faked in the shader (slow 3D noise seen through the centre)
- a fresnel **rim**: emerald below, teal/soft cyan toward the top — architectural, not neon
- a smoked-glass **highlight** that follows the pointer
- a back-face **halo** that breathes on two incommensurate sines, and a geodesic **lattice** shell

Palette: deep navy/black dominant · emerald primary light · teal secondary energy · soft cyan
as a minor highlight · cool white text. Departments are identified by icon, name and position —
never by six saturated colours.

Branding "PDA BLISS / CORE / One Source of Truth" sits on the sphere as **DOM text** (crisp,
selectable, never a flat rectangle on the object).

## 2. Component architecture

```
features/landing/
├── sections/HeroExperience.tsx      Slide 01: hero copy · CORE stage · selector / detail
├── sections/PresentationSlides.tsx  Slide 02 Departments · Slide 03 Flow · progress indicator
├── sections/slides.ts               slide ids / labels
├── sections/ProductTransitionSection.tsx   Slide 04: CORE node → real product UI
├── product/ProductWindow.tsx        Warehouse workspace built from components/core (lazy)
└── core-world/
    ├── CoreStage.tsx        quality decision, lazy WebGL, pointer/drag input, visibility pause,
    │                        fallback cross-fade, DOM labels, branding overlay, cursor glow
    ├── CoreWorld.tsx        <Canvas> + scene root (lazy chunk with three + R3F)
    ├── CoreSphere.tsx       obsidian shell shader, halo, lattice
    ├── OrbitSystem.tsx      department orbit (dashed) + two decorative orbits
    ├── DepartmentNode.tsx   glass bead, halo sprite, workspace ring, hit area
    ├── DataConnections.tsx  spokes to CORE, process arcs, all pulses in one draw call
    ├── Atmosphere.tsx       volumetric-like glow plane, distant network geometry
    ├── ParticleField.tsx    sparse motes, drift in the vertex shader
    ├── CoreWorldFallback.tsx static SVG CORE (no three.js) — loading state and fallback
    ├── WebGLBoundary.tsx    error boundary → fallback
    ├── DepartmentSelector.tsx accessible department buttons + detail panel
    ├── NodeLabel.tsx        floating department tag (visual + pointer target)
    ├── layout.ts            three-free placement/projection math shared by scene and fallback
    ├── quality.ts           capability probe, tiers, runtime step-down
    ├── constants.ts · types.ts · runtime.ts · controls.ts · sceneClock.ts · orbitList.ts
```

**Stack:** `three` (pinned to the r182 line) + `@react-three/fiber` 9. Framer Motion stays
for DOM motion. **drei is not used**: the only pieces we would take from it (HTML labels,
orbit controls) are replaced by ~100 lines of purpose-built code — projected DOM labels that
stay crisp and accessible, and a clamped drag rig with inertia that cannot reach ugly angles.
**GSAP is not used**: scroll choreography is Framer `useScroll` + IntersectionObserver.

Why three r182: react-three-fiber 9.8 (current) still constructs `THREE.Clock`, which three
deprecates from r183 with a console warning on every page load. r182 is the newest release
R3F runs on cleanly. Revisit when R3F moves to `THREE.Timer`.

**State model.** One React state (hovered, selected) lives in `HeroExperience`.
The scene copies it into a mutable `WorldRuntime` once per change; every `useFrame` reads from
there, so hovering never re-renders the scene graph. Canvas, labels and DOM buttons therefore
never disagree.

## 3. Interaction — stable, controllable, clickable

Slide 01 is a **design-locked composition**: a presentation slide, not a pointer-following
parallax page. Pointer = interact with CORE; scroll = move through the story. The two never mix.

| Input | Behaviour |
| ----- | --------- |
| Idle | CORE shell turns very slowly; orbits turn at different speeds; nodes float on their own phases (±0.035 units); data pulses travel. Ring drift is a whisper (±0.025 rad ≈ 3 px) — the composition never travels |
| Ordinary mouse movement | Moves **light only** — the CORE's glass highlight and rim — plus a ≤ 0.012 rad depth tilt (≈ 2–4 px). No parallax, no camera move, no background following the pointer, no cursor ring |
| Mouse drag | Only a press **on the CORE / orbit area** (a circle of 42 % of the stage's short side) starts a drag; grab/grabbing cursor. Rotates yaw ±0.6 rad and pitch ±0.15 rad (clamped); restrained inertia (settles < 1 s); after 2.6 s idle the composition eases home. A mouse rotates only while its button is held — a stale drag (button released outside the page) ends on the next move |
| Touch | Horizontal drag on the CORE rotates; vertical movement is left to the page (`touch-action: pan-y` + axis lock) — scrolling is never trapped |
| Hover / focus department | Node brightens and grows 35 %, its spoke brightens and its pulses speed up, CORE answers with a stronger rim; other nodes dim; detail panel shows. No camera move. Node ↔ label transitions are debounced (80 ms) so hover never flickers |
| Click / Enter department | Selects it (persistent emphasis + detail with **ดูแผนกนี้** → `/departments#id`); DOM button `aria-pressed` stays in sync. A drag never counts as a click (6 px threshold) |
| Click CORE | Clears the selection (overview). Keyboard: a "กลับสู่ภาพรวม CORE" button appears on focus while a department is selected |
| Escape | Clears the selection |

On desktop the hero copy section spans the stage, so it is `pointer-events: none` with only the
copy column interactive — the canvas beneath receives hover, drag and click.

## 4. Department nodes

Sales, Operations, Warehouse, Purchasing, Accounting, Reports — Admin and Executive are not
business departments in the orbit. Each has its own radius (2.5–2.85) and height (−0.7…0.62)
in a ring plane tilted 0.42 rad toward the viewer, so back nodes rise above CORE and front nodes
fall below it: depth without ever hiding a node behind the sphere. Labels are DOM tags
projected from the 3D positions every frame (Thai name + English small caps + icon).

## 5. Presentation slides (native scroll, no snapping)

The homepage opens like a keynote: four scenes, each with its own animation language.

| Slide | Section | Animation language |
| ----- | ------- | ------------------ |
| 01 CORE | `#core-world` — the hero (WebGL) | live, controllable 3D object |
| 02 Departments | `#core-story` | six workspace cards unfold outward from a central CORE emblem; connectors draw |
| 03 Flow | `#core-flow` | a document travels Sales → Operations → Purchasing → Warehouse → Accounting → Reports, station by station (runs only while on screen) |
| 04 Workspace | `#from-core-to-product` | a CORE node opens (clip-path circle) into the real Warehouse workspace UI; data lines flatten into interface rules |

- **No snapping.** Slides are full-height scenes on native scroll, activated as they enter
  the viewport. CSS `proximity` snap was tried and removed after live QA: with one-viewport
  slides it pulled a 1920×1080 visitor back to the top after a short scroll — wheel hijacking
  in effect. No wheel handlers, no fake scrollbar.
- **Progress:** a quiet indicator (dots, labels on hover/focus) on the right edge, desktop only;
  active slide via IntersectionObserver; real anchor links; hidden after the presentation.
- The WebGL scene lives only in Slide 01 and pauses (`frameloop="never"`) once it is offscreen.
- The scene still supports story stages (spread / workspace rings / process arcs / recede) as a
  hook for future episodes; the homepage keeps Slide 01 at the overview stage.

## 6. Accessibility

- All marketing copy (H1, story, product section) is DOM text; the canvas is `aria-hidden`.
- **DepartmentSelector**: one real `<button>` per department in a labelled group;
  `aria-pressed` for selection, `aria-controls` → the `aria-live` detail panel. Tab moves
  through departments; focus previews (same state as hovering a node); Enter/Space selects;
  Escape closes. Floating labels are pointer targets only (`aria-hidden`).
- Visible focus rings; touch targets ≥ 56 px; no information carried by motion alone.

## 7. Fallback & failure

`CoreWorldFallback` is a static SVG CORE laid out with the same projection as the 3D scene
(core, lattice ellipses, dashed orbit, spokes, nodes, labels, branding) and is interactive
(hover/select). It is:

- the **loading state** — painted immediately; the WebGL canvas cross-fades in after its first
  frames (no spinner, no splash);
- used when WebGL is unavailable, on software renderers (SwiftShader/llvmpipe), or when the
  scene fails: `WebGLBoundary` catches render/shader errors and `webglcontextlost` triggers
  the same switch. The rest of the page is unaffected.

## 8. Adaptive quality (`quality.ts`, `constants.ts`)

| Tier | When | DPR | Particles | Sphere | Shader | Pulses | Loop |
| ---- | ---- | --- | --------- | ------ | ------ | ------ | ---- |
| high | ≥ 8 cores, ≥ 8 GB, non-Intel GPU | 1–1.5 | 420 | 96 seg | full (2-octave energy) | 2/link | always |
| medium | default desktop | 1–1.25 | 240 | 72 | 1-octave | 2/link | always |
| low | touch, < 768 px, ≤ 4 cores or ≤ 4 GB | 1 | 110 | 48 | no energy noise, no AA | 1/link | always |
| reduced | `prefers-reduced-motion` | 1–1.25 | 140 (static) | 64 | 1-octave | none | on demand |
| static | no WebGL / software GPU / failure | — | — | — | — | — | SVG |

Runtime guard: if more than 2/3 of 150 sampled frames exceed ~31 ms, quality steps down one
tier (never up).

## 9. Performance decisions

- **Code split:** three + R3F + scene ≈ 244 KB gzip in a lazy `CoreWorld` chunk, requested
  after first paint (idle callback). The public entry grows only ≈ 8 KB gzip.
- **DPR capped** (never raw `devicePixelRatio`).
- **≈ 30 draw calls:** one shader for the whole CORE body; shared halo texture; all pulses in
  one `Points`; particles animate in the vertex shader; 11 tiny curves updated on the CPU.
- **Few transparent layers**, additive blending only for glows; no post-processing, no
  textures beyond a 64 px sprite, no environment maps.
- **Paused when unseen:** `frameloop="never"` when the stage is offscreen
  (IntersectionObserver) or the tab is hidden; reduced motion renders on demand only.

## 10. Mobile

Order: headline → copy → CTAs → CORE scene (24–34 rem tall, low tier) → department selector
(3 × 2 grid, ≥ 56 px targets) → detail → slides 02–04 as normal sections. Floating
labels are removed below 640 px (the selector replaces them). Horizontal drag rotates; vertical
swipes scroll the page even when they start on the CORE. 320 px is fully usable.

## 11. Reduced motion

No idle drift, orbit turning, particle travel or pulses; no tilt; the intro is skipped (scene
fully present on first frame); DOM intro animations are off; slide 02 shows its final layout and
slide 03 shows every station complete without the travelling pulse; the product transition shows
its final state. Hover, selection and drag still work (rendered on demand).
