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
   pulses). No layout-affecting properties. Reveals use IntersectionObserver; scroll-linked
   chapters only *read* the native scroll position (Framer `useScroll`) — never intercept it.
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

Physics: exponential damping (frame-rate independent) and ease-out curves — no elastic springs.
CTA magnetic pull is ≤ 3 px with a critically-damped spring.

### Homepage chapters (EP04 — see [HOMEPAGE_EXPERIENCE.md](HOMEPAGE_EXPERIENCE.md))

| Chapter | Motion | Timing |
| ------- | ------ | ------ |
| Chapter mark | data line draws down (`scaleY`), once | 0.9 s |
| Who For | short desktop pin; organization diagram evolves through four stages from scroll position | `250vh`, stage = scroll ÷ 4 |
| Complexity | fragments drift and tilt apart; tangle lines fade in (scroll-linked transforms) | whole chapter |
| Why CORE | statements blur-in once; short pin morphs ONE LARGE SYSTEM → CORE geometry | `230vh`, morph over 20–75 % |
| Department Worlds | world switch: environment crossfades with a 1.03 → 1 settle; text and preview rise 12–16 px | 0.45–0.8 s |
| World art | CSS loops per world (route dashes, now line, rack scan, approval dot, verification ticks, horizon) | 4.5–14 s |
| Connected Flow | route draws (`pathLength`); a pulse follows the route geometry (measured with `getPointAtLength`) station to station — only while in view; pausable | 1.6 s draw, 2.4 s / station |
| Human Error | scenario phases: flow → interrupted → identified → corrected → continued — only while in view; replayable | 1.1–2.6 s per phase |
| Executive | five signal lines draw into the command view, staggered | 1.4 s, 120 ms stagger |
| Enterprise | layer stack separates as the chapter scrolls into view | scroll-linked |
| Final | orbit rings turn, core light breathes (CSS) | 140–220 s / 7 s |
| Header | glass fades in after scroll; mega panel rises 8 px; mobile menu groups stagger 30 ms | 0.2–0.4 s |

Pins use a tall wrapper with a `sticky` viewport and read progress from the native scroll
position — no snapping, no wheel or touch handling.

### How CORE works (EP08 — see [HOW_CORE_WORKS.md](HOW_CORE_WORKS.md))

| Where | Motion | Timing |
| ----- | ------ | ------ |
| Hero | the work object travels into CORE, then pulses travel each department branch (SVG `animateMotion`) | 1.6 s in · 3.2 s per branch, staggered 0.4 s |
| Route map | the travelled part of the route glows; steps ahead stay quiet; the work token moves to the current step | 0.7 s transform |
| Exceptions | the selected step lifts 10 px out of the calm route | 0.5 s |
| Replay | one step every 1.6 s — only after the visitor presses Play | manual by default |
| Approval, roles, decisions | state changes fade / recolour; dimmed steps recede | 0.3–0.5 s |

### Pricing (EP07 — see [PRICING_AND_PACKAGES.md](PRICING_AND_PACKAGES.md))

| Where | Motion | Timing |
| ----- | ------ | ------ |
| Capability stack | plates above the selected plan fade and lift 6 px; layer content fades | 0.5 s CSS transition, no autoplay |
| Plan tabs, choices | border / background colour transitions | 0.2–0.3 s |
| Comparison, FAQ | chevron rotates; panels open without animation | 0.3 s |
| In-page links | smooth scroll to the section (instant under reduced motion) | browser |

### Department experience (EP06 — see [DEPARTMENT_EXPERIENCE.md](DEPARTMENT_EXPERIENCE.md))

| Where | Motion | Timing |
| ----- | ------ | ------ |
| Overview hero | six environments open outward from CORE (staggered 70 ms); connection lines flow (CSS dash) | 0.6 s, flow loop 6 s |
| Overview stage | selected department panel slides in 24 px, previous slides out | 0.45 s |
| Overview connected map | pulses travel each handoff (SVG `animateMotion`, ≥ sm only) | 4 s + 0.6 s per line |
| Executive hero | signals travel from the departments into the command surface | 3.2 s + 0.5 s per line |
| Sales hero | the order token moves station to station; route dashes flow | 1.7 s / station, dash 8 s |
| Operations hero | the "now" line sweeps the week (SVG `animate`) | 16 s |
| Purchasing hero | requests travel PR → PO; goods travel supplier → Warehouse (SVG `animateMotion`) | 2.8 s + 0.4 s / 3.6 s + 0.6 s per line |
| Accounting hero | documents check off one by one, then the payment unlocks | 1.2 s / document |
| Sections | `Reveal` / `RevealItem` entrances; tab panels crossfade | tokens |


- Section headers and content reveal once (`y: 24 → 0`, fade in).
- Card groups stagger by 80 ms.
- Chapter marks and Executive signal lines draw once (transform / `pathLength` only).
- Counters count up once when in view; they render the final value in the HTML first.

### Hover / press

- Department cards: lift 4 px, border glow, icon scales, connector to the core bus lights up.
- Primary buttons: glow sweep passes once across; optional magnetic pull (5 px); press 0.97.
- World / scenario / flow selectors: accent underline or fill transitions; content crossfades with a short rise.

## Reduced motion

When the OS requests reduced motion (`prefers-reduced-motion: reduce`):

- `<MotionConfig reducedMotion="user">` disables Framer Motion transform/layout animation
  app-wide (opacity fades remain).
- A global CSS rule collapses all CSS animations and transitions to effectively zero.
- The CORE World uses its `reduced` tier: no drift, orbit turning, particles travel or pulses,
  no parallax, intro skipped, rendering on demand only; hover/selection/drag still work.
  Magnetic buttons are disabled; the product transition shows its final state.
- Counters show their final value immediately.
- Homepage chapters (EP04) read the preference live: pins show their final composition,
  scroll-linked transforms are disabled, Connected Flow shows every step at once and Human
  Error shows the finished annotated scenario — no autoplay, so no pause controls are needed.
- How CORE works (EP08): no moving work object or branch pulses, no autoplay replay (Play is
  removed; manual steps remain), route and lift transitions are instant.
- Pricing (EP07): nothing autoplays; capability-stack transitions are instant and in-page
  links jump instead of scrolling smoothly.
- Department pages (EP06): every hero loop and SVG pulse is removed; Sales shows the order at
  "ready", Accounting shows every document checked and the payment ready, Operations shows a
  static now line, and tab panels switch without sliding.

The page is fully readable and complete in this mode — motion never carries information that
is not also present statically.

## Adding motion

Use the tokens. Prefer `Reveal`/`RevealItem` for entrances. Ask: what does this movement
explain? If the answer is "nothing", do not add it.
