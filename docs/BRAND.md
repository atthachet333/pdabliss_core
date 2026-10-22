# Brand — PDA BLISS CORE

**Direction:** Luxury Enterprise + Core Universe + Department Operations.

Premium, cinematic, controlled and trustworthy. Not a SaaS template, not an admin theme, not
a gaming or cyberpunk UI. The recurring idea is a luminous **CORE** with departments orbiting
and connecting into it.

## Tokens

All tokens live in `frontend/src/styles/index.css` (`@theme`). Components use them via
Tailwind utilities (`bg-surface-raised`, `text-text-secondary`, `border-border-soft`, …).
**Never introduce raw hex values in components.**

### Colour

| Token                 | Value                    | Use                                              |
| --------------------- | ------------------------ | ------------------------------------------------ |
| `brand-primary`       | `#19c39a`                | Primary actions, active states, key accents      |
| `brand-deep`          | `#0b5e4f`                | Deep fills, core body edge, gradients            |
| `brand-glow`          | `#3ef0c0`                | Luminous highlights, focus ring, eyebrows        |
| `brand-soft`          | `#b9f5e4`                | Soft text on brand fills, icon tint              |
| `brand-cool`          | `#5aa9ff`                | Secondary supporting light — sparingly           |
| `surface-dark`        | `#050b12`                | Page background (near-black navy)                |
| `surface-base`        | `#08121b`                | Sections, panels                                 |
| `surface-raised`      | `#0c1822`                | Cards, tiles, inputs                             |
| `surface-overlay`     | `#12222e`                | Menus, chips, hover                              |
| `surface-highlight`   | `#183040`                | Progress tracks, subtle emphasis                 |
| `text-primary`        | `#eef6f3`                | Headings and body                                |
| `text-secondary`      | `#a3b8b2`                | Supporting copy                                  |
| `text-muted`          | `#758c86`                | Captions, metadata (≥ 4.5:1 on surface-dark)     |
| `text-inverse`        | `#04110d`                | Text on brand-primary buttons                    |
| `border-soft`         | mint @ 9 %               | Default hairlines                                |
| `border-strong`       | mint @ 18 %              | Controls, frames                                 |
| `border-brand`        | glow @ 38 %              | Selected / emphasised edges                      |
| `success`             | `#34d399`                | State only                                       |
| `warning`             | `#f5b84b`                | State only                                       |
| `danger`              | `#f47272`                | State only                                       |
| `info`                | `#6cb8ff`                | State only                                       |
| `chart-1` / `chart-2` | `#14a883` / `#4f8fe8`    | Data series (validated, see below)               |

### Workspace accents (EP02)

Each department has one contextual accent. Accents identify *where you are* — the workspace
icon, the active-navigation bar, small markers — and are never status colours or large fills.
Chroma is held low so seven of them never read as a rainbow; brand green/teal stays dominant.
Internal surfaces, text and semantic tokens are documented in
[INTERNAL_DESIGN_SYSTEM.md](INTERNAL_DESIGN_SYSTEM.md).

| Token                  | Value     | Workspace   | Family |
| ---------------------- | --------- | ----------- | ------ |
| `ws-executive`         | `#3ee0b4` | Executive   | PDA BLISS core green / teal |
| `ws-sales`             | `#6aaaf5` | Sales       | cool blue |
| `ws-warehouse`         | `#4fd08f` | Warehouse   | emerald |
| `ws-purchasing`        | `#dfb066` | Purchasing  | amber |
| `ws-operations`        | `#a99af0` | Operations  | violet |
| `ws-accounting`        | `#6cc7e0` | Accounting  | cyan |
| `ws-admin`             | `#a3adb8` | System Admin | graphite |

Rules:

- Green/teal is the signature. Blue is a supporting light, never a co-lead. No rainbow neon.
- Status colours are reserved for state and always ship with an icon **and** a label
  (`StatusBadge`), never colour alone. Purchasing's amber accent and the warning status share
  a hue family; they never meet on one element, and status always carries its icon and text.
- Chart series colours were validated for the dark surface with a colour-vision-deficiency
  checker (lightness band, chroma, CVD ΔE, contrast all pass). The second series is also
  dashed, so identity never relies on colour alone.

### Typography

**IBM Plex Sans Thai** (self-hosted via `@fontsource`, weights 400/500/600/700) — designed for
Thai and Latin together, with Thai-first readability.

| Token          | Size                                   | Line height | Use                     |
| -------------- | -------------------------------------- | ----------- | ----------------------- |
| `text-display` | clamp(34px → 56px)                     | 1.36        | Hero headline           |
| `text-h1`      | clamp(32px → 52px)                     | 1.36        | Page titles             |
| `text-h2`      | clamp(26px → 40px)                     | 1.40        | Section titles          |
| `text-h3`      | clamp(19px → 23px)                     | 1.45        | Card titles             |
| `text-body-lg` | 18px                                   | 1.80        | Leads                   |
| `text-body`    | 16px                                   | 1.75        | Body                    |
| `text-label`   | 15px                                   | 1.50        | UI labels, nav, buttons |
| `text-caption` | 13px                                   | 1.55        | Metadata                |
| `text-kpi`     | clamp(28px → 38px), tabular figures    | 1.10        | Numeric KPIs            |

Thai stacks vowels and tone marks above and below the baseline, so line-heights are more
generous than a Latin-only system would use. The smallest text in the product is 12px (inside
illustrative mockups only); real UI text is ≥ 13px. Numbers use `tabular-nums` (`.tabular`).

### Spacing & layout

- Tailwind's 4px scale. Sections breathe: `py-24` mobile / `py-32` desktop.
- Content container: max 1240px, 16px side gutter on phones, 24px tablet, 32px desktop.
- Radius: `rounded-card` 20px, `rounded-panel` 16px, `rounded-control` 12px, pills full.

### Surfaces

- **surface-card** — raised gradient + soft border + deep shadow.
- **surface-glass** — translucent overlay with backdrop blur; for floating UI only (header,
  hero nodes, login card).
- **bg-grid** — a faint 56px grid, always masked so it fades out; suggests structure.

### Glow

Glow marks the focus of attention. It is never decoration on everything.

| Token            | Use                                                           |
| ---------------- | ------------------------------------------------------------- |
| `shadow-glow-sm` | Primary button rest state, small live indicators              |
| `shadow-glow-md` | Hovered/selected cards, the featured plan, active nodes       |
| `shadow-glow-lg` | Reserved for the CORE itself                                  |

Large ambient glows are radial gradients, not CSS `blur()` filters, to keep GPU cost low.

## CORE World (EP03)

The homepage hero is a real-time scene, documented in [CORE_WORLD.md](CORE_WORLD.md).

- **Materials:** obsidian / smoked glass, dark architectural metal (lattice), clear glass edges
  (fresnel rim), emerald light, soft volumetric-like glow. No plastic, no glossy gaming cards,
  no neon outline on every element, no heavy glassmorphism.
- **Palette in the scene:** navy/black dominant, emerald `#19c39a` / glow `#3ef0c0` primary
  light, teal `#2bb5a8` secondary energy, soft cyan `#7fd6ff` minor highlight only. Department
  accents from the internal app are **not** used in the hero — departments are identified by
  icon, name and position.
- **Atmosphere:** deep navy gradient, one emerald light that follows the mouse, faint radial
  structure, subtle grain — no starfield, nebula or lens flare.
- The CORE is never an Earth globe, a power orb or a token. Branding sits on it as DOM text.

## Homepage chapters (EP04)

The homepage is eleven chapters with their own art direction — see
[HOMEPAGE_EXPERIENCE.md](HOMEPAGE_EXPERIENCE.md). Shared rules:

- **One thread.** A thin vertical data line and an index (`01 — CORE`) open every chapter
  (`ChapterMark`), in brand, cold, warm or calm tone.
- **Mood by chapter, not by decoration.** Complexity is colder and desaturated (`#7d97a8`,
  grain); Human Error carries a restrained amber (`--color-warning`); Department Worlds takes
  each workspace's EP02 accent (`--color-ws-*`) as the room's light — the only place the public
  site uses workspace accents.
- **Procedural art only.** Department environments are inline SVG (routes, timelines, rack
  grids, supplier networks, ledgers, horizon), stroked in `currentColor` and tinted per world.
  No stock imagery, no third-party logos (the "before CORE" chapter shows tools abstractly).
- **Real product, not screenshots.** Previews are the EP02 components with sample data.
- The final chapter brings the CORE back in CSS (orbits, breathing light) — no second WebGL
  canvas.

## Imagery

Generated, abstract and brand-tinted (orbits, networks, racks, ledgers) — produced by
`frontend/scripts/build-assets.mjs` and committed as small WebP/AVIF/PNG files. No stock
photography, no AI people, no generic SaaS illustrations. Every image is decorative
(`alt=""`) and every surface has a CSS fallback, so the site reads fully without images.

## Voice

Thai-first, calm, precise. Short declarative sentences. Talk about the work people do, not
about "digital transformation". Never diminish PDA ONE — the two products serve different needs.
