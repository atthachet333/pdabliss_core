# PDA BLISS CORE — Brand Identity

**Established:** EP24.1.3 (2026-10-27) · **Owner:** PDA BLISS COMPANY LIMITED

The production identity for **PDA BLISS CORE** is drawn from the owner-approved orbital concept
(`docs/assets/brand-reference/`, reference only). The concept is kept intact. It is drawn at
three **optical sizes** so that it holds up from a 16 px browser tab to a 512 px app icon.

## 1. Concept

**One operational core, held by several orbiting systems.**

- **Core:** a luminous teal sphere and the visual anchor. It stands for the CORE platform: one
  shared source of operational truth.
- **Silver ring:** a metallic band that passes in front of the core and behind it. It is heavier
  at the front and thinner at the sides, and it breaks where it goes behind the core. It stands
  for the platform that carries every department.
- **Teal orbit:** a second system on another axis, woven under the silver band. It stands for
  the flow of work between teams.
- **Nodes:** the connected departments. The front node is teal; the far ones are silver.
- **Ground:** a dark enterprise ground (deep navy / near-black). The teal centre reads as light
  against it.

**How depth is built:**

- the core has a controlled radial gradient, a darker rim and an inner highlight;
- the silver band has a linear metallic gradient;
- crossings are woven with masks, so a thin gap separates the layers wherever one passes in
  front of another;
- the core has a soft halo (a radial gradient, not a filter).

There are no SVG filters, no blur, no drop shadows and no embedded images.

## 2. Optical sizes: one concept, three drawings

The three sizes are not one drawing scaled up or down. Each has different requirements.

| Size                      | Range                                       | What it keeps                                                                                                                                                                                                                                                                                                                                                                                                              | Source                                        |
| ------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Micro (favicon)**       | 16–48 px (favicon, tab, tiny UI)            | Its own **round** mark, designed at 16 px first: a circular deep-navy disc (transparent outside it) with a 1 px teal rim, a **large teal core** (56 % of the diameter), **one silver ring** (1.5 px at 16 px) cut from the core by a navy gap, and **one teal node**. There are no fine orbits, small dots or translucency. The 32 / 48 px drawing adds only a metallic ring gradient, a brighter rim and a core highlight | `microInner(id, 16 \| 32)`                    |
| **Mark** (header / brand) | ~24–96 px (navigation, headers, documents)  | The tapered silver band, a broken back arc, the teal orbit woven under the band, a rimmed core with a highlight, and three nodes                                                                                                                                                                                                                                                                                           | `markInner(id, v)`                            |
| **Large**                 | ≥ 96 px (app icons, showcases, social card) | Everything in the mark, plus a third fine orbit with its node, a wider halo and a specular highlight. App icons put it on a dark squircle field                                                                                                                                                                                                                                                                            | `markInner(id, v, 'large')`, `appIconInner()` |

`<LogoMark size="micro" | "mark" | "large" />` picks the size in the UI. The header uses
`mark`, the 20 px home preview bar uses `micro`, and the About S2 tile uses `large`.

## 3. The logos

| Logo                 | Use                                                                                                                                                                                                                | Source                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| **Primary logo**     | Mark + "PDA BLISS" over a teal "CORE" between two fine rules. The default identity on headers, documents and the social card (with the large mark)                                                                 | `logoInner()`            |
| **Secondary lockup** | Primary logo + a rule + "DEPARTMENT / OPERATIONS". It is small, muted and never competes with the name, and appears only with generous room (public header ≥ 1536 px, footer). It is omitted in compact navigation | `<Logo />` (not compact) |

The wordmark is drawn as **vector monoline glyphs**: geometric caps, square terminals and a
weight balanced against the mark ("CORE" slightly heavier than "PDA BLISS"). It is not set in a
font, so it renders the same everywhere and never falls back to a system typeface.

## 4. Colour

| Token            | HEX       | RGB           | Role                                                             |
| ---------------- | --------- | ------------- | ---------------------------------------------------------------- |
| **CORE Teal**    | `#00E5C2` | 0, 229, 194   | Core accents, micro node, glow. 11.3 : 1 on Deep Navy            |
| **Teal Ink**     | `#00806F` | 0, 128, 111   | Teal on light ground: "CORE", orbit and nodes. 4.86 : 1 on white |
| **Deep Navy**    | `#0A1620` | 10, 22, 32    | Brand ground, favicon disc, knockouts; ink on light ground       |
| **Dark Surface** | `#050B12` | 5, 11, 18     | Site background (`--color-surface-dark`), social card, app field |
| **Silver**       | `#E2E8F0` | 226, 232, 240 | Micro ring, near nodes                                           |
| Silver Shade     | `#8396A0` | 131, 150, 160 | Ring gradient mid-tone, far nodes                                |
| Graphite         | `#3B4A54` | 59, 74, 84    | Ring and nodes on light ground                                   |
| **Off-White**    | `#EEF6F3` | 238, 246, 243 | Wordmark on dark ground (16.6 : 1 on Deep Navy)                  |
| **White**        | `#FFFFFF` | 255, 255, 255 | White monochrome, light ground                                   |
| Authority Gold   | `#F5B84B` | 245, 184, 75  | **Platform Owner authority only**: never in the logo             |

**Dark (official) tuning:**

- **Silver ring:** `#EEF2F5 → #C2CED5 → #7D919B → #DAE3E8`. It stays below pure white, so it reads
  as metal, not as a white line.
- **Core:** `#E9FFFA → #7DF5DF → #16D6B5 → #03967F → #035247` with a `#023E37` rim.
- **Wordmark "CORE":** `#19DDBC`, luminous without being neon.

**Light tuning** is drawn separately, not inverted:

- graphite-to-silver band (`#55666F → #9DADB5 → #3B4A54`);
- a deeper core ending in Teal Ink and CORE Deep;
- no halo.

**Site tokens are unchanged.** The frozen public UI keeps its own `brand-primary`, `brand-glow`
and so on (`src/styles/index.css`). The identity's teal sits in the same hue family.

**Contrast note:** on Off-White, Teal Ink is 4.43 : 1. Use it there only for large or graphic
elements, never for body text.

## 5. Variants

| Variant                      | File (`frontend/public/brand/`)                          | Ground                                                   |
| ---------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Full colour, dark (official) | `core-logo-dark.svg` · `core-mark-dark.svg`              | Deep Navy, Dark Surface, any dark photo-free ground      |
| Full colour, light           | `core-logo-light.svg` · `core-mark-light.svg`            | White, Off-White, light grey                             |
| White monochrome             | `core-logo-mono-white.svg` · `core-mark-mono-white.svg`  | Dark or coloured grounds, single-colour print, embossing |
| Dark monochrome              | `core-logo-mono-dark.svg` · `core-mark-mono-dark.svg`    | Light grounds, single-colour print, stamps               |
| Large mark                   | `core-mark-large.svg` · `core-app-icon.svg` (with field) | Dark ground; presentations, app stores, showcases        |
| Micro (favicon)              | `core-micro.svg`                                         | Self-contained round disc: any browser theme             |

Monochrome variants keep the woven gaps (masks), so they stay legible as a single ink.

## 6. Favicon and app icons

**Why round:** the favicon is a deliberately designed round object, not a reduced logo inside a
tile.

- The navy disc carries the silver ring and the knockouts on light tabs.
- The teal rim outlines the circle on dark tabs.
- Outside the circle is transparent.

It was checked rendered at 16, 20, 24, 32 and 48 px on white, light-grey, dark and dark-grey
grounds (DPR 1 and 2). It was also checked in real Chrome and Edge tab strips, light and dark,
beside the earlier square-tile version.

| File                                              | Size                        | Built from                                                                                   |
| ------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `/favicon.svg`                                    | vector                      | Round favicon mark, 16 px drawing                                                            |
| `/favicon.ico`                                    | 16 · 32 · 48 (PNG payloads) | 16 px drawing at 16, derived drawing at 32 / 48                                              |
| `/favicon.png`                                    | 32                          | Derived 32 px drawing                                                                        |
| `/brand/favicon-16.png` · `/brand/favicon-48.png` | 16 · 48                     | 16 px drawing · derived drawing                                                              |
| `/brand/apple-touch-icon.png`                     | 180                         | Large mark on the dark field, full-bleed (iOS rounds the corners)                            |
| `/brand/icon-192.png` · `/brand/icon-512.png`     | 192 · 512                   | Large mark on the dark squircle field. Linked as a 192 px icon; no web-app manifest (no PWA) |
| `/brand/og-image.png`                             | 1200 × 630                  | Primary logo with the large mark, plus "DEPARTMENT OPERATIONS PLATFORM", on Dark Surface     |

The SVG, the 32 px PNG, the 192 px icon and the touch icon are linked from `frontend/index.html`
(and so from every prerendered page). `favicon.ico` is not linked: browsers and crawlers request it
at that path by default.

## 7. Minimum sizes

| Mark         | Screen                                                     | Print                            |
| ------------ | ---------------------------------------------------------- | -------------------------------- |
| Primary logo | 28 px high (the site header uses 36 px, 40 px from 640 px) | 25 mm wide                       |
| Brand mark   | 24 px                                                      | 8 mm                             |
| Micro mark   | 16 px (designed for 16–48 px)                              | Do not print; use the brand mark |

Below 24 px, always use the micro mark.

## 8. Clear space

Keep clear space on every side equal to the **diameter of the core**, a little under half the
mark's height. Do not let text, edges or other logos enter that space.

When CORE appears with **S2** (About, partner chapter), each company keeps its own mark, its own
tile and its own name. The two marks are never merged, overlapped or recoloured into one lockup.

## 9. Misuse

Do not:

- recolour the core, ring or wordmark outside the variants above, or use Authority Gold in the
  logo;
- stretch, skew or rotate the logo, or re-angle the ring or orbit;
- add drop shadows, outer glows, bevels, blur or other filters;
- scale the micro mark up in place of the brand mark, or the brand mark down below 24 px;
- retype the wordmark in a font or change the letter spacing;
- place the dark variant on light ground or the light variant on dark ground;
- place the logo on busy imagery without a solid Deep Navy or white backing;
- use, crop or trace the concept board in `docs/assets/brand-reference/`;
- animate the logo beyond a subtle fade. The site's loading states do not animate it, and
  reduced-motion preferences are always respected.

## 10. Asset locations

| What                     | Where                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Single vector source** | `frontend/src/components/brand/geometry.ts` (palette, three optical sizes, app field, wordmark glyphs)   |
| React components         | `frontend/src/components/brand/Logo.tsx`: `<Logo compact? variant? />` and `<LogoMark variant? size? />` |
| Generated files          | `frontend/public/brand/*` and `frontend/public/favicon.{svg,ico,png}`                                    |
| Generator                | `frontend/scripts/build-brand.mjs` (`npm run assets:brand`; also part of `npm run assets`)               |
| Concept reference        | `docs/assets/brand-reference/`: **reference only, not a production asset**                               |

To change the identity, edit `geometry.ts` and run `npm run assets:brand`. The site chrome and
every file then update together.

## 11. In the product

| Surface                                 | Treatment                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Public header and mobile menu           | Primary logo (mark size) at 36 px, 40 px from 640 px. The secondary lockup appears from 1536 px. Navigation is unchanged (frozen) |
| Public footer                           | Secondary lockup                                                                                                                  |
| Login, register, verify, forgot / reset | Primary logo in the frame header; the brand mark alone below 400 px                                                               |
| Account / company portal                | Primary logo; the brand mark alone below 640 px                                                                                   |
| Platform Control Center                 | Primary logo; the brand mark alone below 640 px. Owner authority stays gold, separate from the logo                               |
| Department workspaces                   | Brand mark + text name                                                                                                            |
| Home preview bar (20 px)                | Micro mark                                                                                                                        |
| About — S2 chapter                      | Large CORE mark in its own tile beside the S2 logo: two separate companies                                                        |

The artwork is `aria-hidden`. Each logo link carries a single text name, for example
"PDA BLISS CORE Department Operations — home", so a screen reader announces it once.
