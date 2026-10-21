# Motion System

Motion is part of the CORE identity: a calm system in constant, controlled operation.
It is never random, fast or attention-seeking.

Source of truth: `frontend/src/motion/tokens.ts` (Framer Motion) and the `--ease-*` /
`--animate-*` tokens in `frontend/src/styles/index.css` (CSS keyframes).

## Principles

1. **Meaningful.** Every motion explains something: data flowing into the CORE, work moving
   between departments, a section arriving, an element responding to you.
2. **Slow ambient, quick response.** Ambient loops take 6–220 s; UI responses take 120–400 ms.
3. **Restrained travel.** Pointer parallax is capped at 12 px; magnetic buttons at 5 px; hover
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

### Hero — CORE Universe

| Element            | Motion                                                        | Duration        |
| ------------------ | ------------------------------------------------------------- | --------------- |
| CORE halo          | Breathing glow (opacity .75→1, scale 1→1.045)                 | 7 s loop        |
| CORE rings         | Very slow rotation, inner and outer counter-rotating          | 140 s / 220 s   |
| Department nodes   | Gentle float (±6 px), staggered phases                        | 7–10 s loop     |
| Connection lines   | Flowing pulse along each path (stroke-dashoffset)             | 6 s loop        |
| Data particles     | One particle per line travelling to / from the CORE (SVG)     | 5.5–7.8 s loop  |
| Starfield          | Slow atmospheric drift                                        | 60 s alternate  |
| Pointer parallax   | Three depth layers, spring-smoothed, max 12 px                | —               |
| Node hover/focus   | Node glows, its connection brightens                          | 300 ms          |

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
- The hero does not render SMIL data particles, stops node floating and ignores pointer
  parallax; magnetic buttons are disabled.
- Counters show their final value immediately.

The page is fully readable and complete in this mode — motion never carries information that
is not also present statically.

## Adding motion

Use the tokens. Prefer `Reveal`/`RevealItem` for entrances. Ask: what does this movement
explain? If the answer is "nothing", do not add it.
