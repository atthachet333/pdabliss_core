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

### Workspace accents (EP01-PROTOTYPE)

Each department workspace has one restrained accent, all within the green → teal → blue
family. Accents are used for icons, hairlines and soft glows only — never for status.

| Token                  | Value     | Workspace   |
| ---------------------- | --------- | ----------- |
| `ws-executive`         | `#3ef0c0` | Executive   |
| `ws-sales`             | `#2dd4bf` | Sales       |
| `ws-warehouse`         | `#86efac` | Warehouse   |
| `ws-purchasing`        | `#60a5fa` | Purchasing  |
| `ws-operations`        | `#a3d9a5` | Operations  |
| `ws-accounting`        | `#a5b4fc` | Accounting  |
| `ws-admin`             | `#94a3b8` | System Admin |

Rules:

- Green/teal is the signature. Blue is a supporting light, never a co-lead. No rainbow neon.
- Status colours are reserved for state and always ship with an icon **and** a label
  (`StatusPill`), never colour alone.
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

## Imagery

Generated, abstract and brand-tinted (orbits, networks, racks, ledgers) — produced by
`frontend/scripts/build-assets.mjs` and committed as small WebP/AVIF/PNG files. No stock
photography, no AI people, no generic SaaS illustrations. Every image is decorative
(`alt=""`) and every surface has a CSS fallback, so the site reads fully without images.

## Voice

Thai-first, calm, precise. Short declarative sentences. Talk about the work people do, not
about "digital transformation". Never diminish PDA ONE — the two products serve different needs.
