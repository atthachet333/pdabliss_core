# Motion System

Motion is part of the CORE identity: a calm system in constant, controlled operation.
It is never random, fast or attention-seeking.

Source of truth: `frontend/src/motion/tokens.ts` (Framer Motion) and the `--ease-*` /
`--animate-*` tokens in `frontend/src/styles/index.css` (CSS keyframes).

## Principles

1. **Meaningful.** Every motion explains something: data flowing into the CORE, work moving
   between departments, a section arriving, an element responding to you.
2. **Slow ambient, quick response.** Ambient loops take 6–220 s; UI responses take 120–400 ms.
3. **Restrained travel.** Public-site pointer parallax is capped at 12 px (the CORE World hero uses none — the pointer only moves light); magnetic buttons at 5 px; hover
   lift at 4 px.
4. **Cheap to render.** Animate `transform` and `opacity` (plus SVG stroke offset for line
   pulses). No layout-affecting properties, no scroll listeners — reveals use
   IntersectionObserver.
5. **Once.** Scroll reveals, line draws and counters run once per page view.
6. **Optional.** Everything degrades to a static, complete layout under reduced motion.

## Tokens

| Token         | Value                          | Use                                   |
| ------------- | ------------------------------ | ------------------------------------- |
| `EASE_CORE`   | `cubic-bezier(.22, 1, .36, 1)` | Entrances, UI response (decelerating) |
| `EASE_CALM`   | `cubic-bezier(.45, 0, .25, 1)` | Ambient loops (symmetric)             |
| `instant`     | 120 ms                         | Press feedback                        |
| `fast`        | 200 ms                         | Hover, exits                          |
| `base`        | 400 ms                         | Tab swaps, nav indicator              |
| `reveal`      | 750 ms                         | Section reveals                       |
| `draw`        | 1.6 s                          | Workflow line draw                    |
| `STAGGER`     | 80 ms                          | Card groups                           |

## Catalogue

### Homepage presentation — CORE World (EP03, WebGL — see [CORE_WORLD.md](CORE_WORLD.md))

| Element | Motion | Timing |
| ------- | ------ | ------ |
| Intro | atmosphere → CORE (scale .86→1) → rim → orbits → links draw → nodes (staggered 60 ms) | 0.1–1.3 s, no splash |
| Hero text | eyebrow → H1 → copy → CTAs → values, `y 16 → 0` | 0.1–0.6 s |
| CORE shell | slow rotation; internal energy currents; data points on meridians | ~0.03 rad/s |
| Halo / rim | breathing on two incommensurate sines (never a visible loop) | ~20–65 s periods |
| Orbits | three rings turning at different speeds | 0.009–0.021 rad/s |
| Ring drift | ±0.025 rad on two slow sines (≈ 3 px — the composition never travels) | ~90 s / ~215 s |
| Nodes | float ±0.035 units, own phase each | ~12 s |
| Pulses | travel node → CORE; faster on the focused department | 2–5 s per trip |
| Particles | drift in the vertex shader | 2–3 min cycles |
| Pointer | moves the glass highlight / rim light only, plus a ≤ 0.012 rad depth tilt (≈ 2–4 px); no parallax | λ ≈ 4/s |
| Drag | only from the CORE / orbit area, button held; yaw ±0.6, pitch ±0.15 rad; restrained inertia (settles < 1 s); eases home after 2.6 s idle | λ ≈ 6/s |
| Hover / select | node grows and glows, its spoke and pulses brighten, others dim — no camera move | λ ≈ 9/s |
| Slide 02 | workspace cards unfold outward from a CORE emblem (staggered 80 ms), connectors draw | 0.75 s, once |
| Slide 03 | a data pulse travels the department route station by station; stations complete in turn (only while on screen) | 1.1 s / station |
| Slides | full-height scenes activated on entry, progress dots — native scroll, no snapping, no wheel handling | — |
| Product transition | CORE node clip-path circle → product window; data lines flatten into rules | scroll-linked |

Physics: exponential damping (frame-rate independent) and ease-out curves — no elastic springs.
CTA magnetic pull is ≤ 3 px with a critically-damped spring.

### Scroll

- Section headers and content reveal once (`y: 24 → 0`, fade in).
- Card groups stagger by 80 ms.
- Connected-workflow line draws once (`scaleX` desktop, `scaleY` mobile — transform only).
- Counters count up once when in view; they render the final value in the HTML first.

### Hover / press

- Department cards: lift 4 px, border glow, icon scales, connector to the core bus lights up.
- Primary buttons: glow sweep passes once across; optional magnetic pull (5 px); press 0.97.
- Product preview tabs: shared-layout pill slides; preview crossfades with a slight blur/slide.

## Reduced motion

When the OS requests reduced motion (`prefers-reduced-motion: reduce`):

- `<MotionConfig reducedMotion="user">` disables Framer Motion transform/layout animation
  app-wide (opacity fades remain).
- A global CSS rule collapses all CSS animations and transitions to effectively zero.
- The CORE World uses its `reduced` tier: no drift, orbit turning, particles travel or pulses,
  no parallax, intro skipped, rendering on demand only; hover/selection/drag still work.
  Magnetic buttons are disabled; the product transition shows its final state.
- Counters show their final value immediately.

The page is fully readable and complete in this mode — motion never carries information that
is not also present statically.

## Adding motion

Use the tokens. Prefer `Reveal`/`RevealItem` for entrances. Ask: what does this movement
explain? If the answer is "nothing", do not add it.
