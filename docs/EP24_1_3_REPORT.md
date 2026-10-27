# EP24.1.3 — Brand Identity & Logo Integration

**Date:** 2026-10-27 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline (local, not pushed):** `44862e6` (EP24.1.2).

**Completion commit:** `feat: establish PDA BLISS CORE production brand identity (EP24.1.3)`. It
is local only and **not pushed**. EP25 has not started.

## 1. What changed

- **One vector source:** `frontend/src/components/brand/geometry.ts`. It holds the palette, the
  brand mark, the micro mark and the monoline wordmark glyphs. The React logo and the asset
  generator (`scripts/build-brand.mjs`, `npm run assets:brand`) both render from it.
- **Marks:**
  - primary logo (mark + "PDA BLISS / CORE");
  - secondary lockup (+ "Department Operations");
  - brand mark;
  - micro mark (navy tile, one ring, one node) for 16–48 px.
- **Variants:** full-colour dark and light, white mono, dark mono. Files are
  `public/brand/core-{logo,mark}-{dark,light,mono-white,mono-dark}.svg` and `core-micro.svg`.
- **Favicons and icons:**
  - `favicon.svg`;
  - `favicon.ico` (16/32/48);
  - `favicon.png` (32);
  - `brand/favicon-{16,48}.png`;
  - `brand/apple-touch-icon.png` (180);
  - `brand/icon-{192,512}.png`;
  - a new `brand/og-image.png`.

  The `index.html` icon links were updated. There is no manifest and no PWA.

- **Retired:** `brand/logo-mark.svg` (the placeholder mark, unreferenced) and the old mark and OG
  code in `build-assets.mjs`.
- **In the product:** `Logo` / `LogoMark` render the new geometry. Every existing surface picks
  it up without layout changes: public header, mobile menu, footer, auth frame, login gateway,
  account portal, Platform Control Center, workspaces, home previews and the About S2 chapter.
  Navigation and page structure are unchanged.
- **Accessibility:** the artwork is `aria-hidden` with one sr-only name, and labelled links
  override it, so the name is announced once.
- **Docs:**
  - `docs/BRAND_IDENTITY.md` (new);
  - `docs/assets/brand-reference/`: the concept board, marked **REFERENCE ONLY — NOT
    PRODUCTION LOGO ASSET**;
  - README.
- **Test fix:** an auth test's platform-overview fixture predated EP24.1.2 and lacked
  `attention`. That caused an unhandled rejection, which made `vitest run` exit non-zero.

## 1a. Owner refinement passes

**1. Optical sizes.** The owner found the first mark too flat and thin and the favicon too soft.
The single drawing became three drawings:

- **Header / brand mark:**
  - a tapered silver ring band (heavy at the front, thin at the sides);
  - broken back arcs;
  - the teal orbit woven under the band with mask knockouts;
  - a larger core with a darker rim and an inner highlight.
- **Large mark:** a third orbit, a wider halo and a specular highlight. It is used for the app
  icons (on a dark squircle field), the OG image and the About S2 tile.
- **Wordmark:** about 17 % heavier, with a larger, heavier "CORE" and thicker rules. The header
  logo is 40 px from 640 px. "Department Operations" is smaller and quieter.

**2. Round favicon.** The owner rejected the tile favicon as a reduced logo in a box. The
favicon is now its own round mark, designed at 16 px first:

- a circular navy disc with a 1 px teal rim, transparent outside it;
- a teal core 56 % of the diameter;
- one silver ring (1.5 px) cut from the core by a navy gap;
- one teal node.

32 / 48 px use a derived drawing: a metallic ring gradient, a brighter rim and a core
highlight. It was checked rendered at 16 / 20 / 24 / 32 / 48 px on four tab colours, and in
real Chrome and Edge tab strips (light and dark) beside the old tile.

## 2. Verification

The owner approved the round favicon and the header / app-icon system.

**Frontend gates:**

| Gate                    | Result                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format | Pass                                                                                                                  |
| Tests                   | 40 files / 940 tests, including the new `brand.test.tsx` (28)                                                         |
| Build                   | Pass; 105 pages + 3 shells prerendered and verified                                                                   |
| Perf                    | Within budget                                                                                                         |
| `npm ci`                | Clean against the lockfile (run in a clean copy; the repo's own `node_modules` was held open by a running dev server) |

**Test fixes:**

- Two platform-overview fixtures predated EP24.1.2. They are updated, which removes the
  unhandled rejection that made `vitest run` exit non-zero.
- The departments "every page in every locale" test gets the repo's usual 20 s budget.

**Performance:**

| Measure            | Before   | After    | Budget |
| ------------------ | -------- | -------- | ------ |
| Initial JS (gzip)  | 181.0 kB | 184.0 kB | 205 kB |
| Initial CSS (gzip) | 47.1 kB  | 47.1 kB  | 52 kB  |
| Static HTML        | 517.7 kB | 528.2 kB | 540 kB |

The static HTML grows because of the icon links in every prerendered head.

**Real-stack browser QA** (scratch database; Chrome and Edge each 349 / 351):

- the public header at 320–1920 px in TH / EN / ZH, with no overflow and the logo-link name
  announced once;
- the mobile menu, footer and 1536 px+ lockup;
- About / S2, with the large CORE mark and the S2 logo kept separate;
- login, register, verify, forgot and reset;
- the signed-in Platform Control Center (Owner authority still gold and separate) and the
  account portal;
- every brand file served, every gradient and mask reference resolving;
- no console errors.

**The two failures:** both are the same **pre-existing** axe colour-contrast finding on About: the
`aria-hidden` decorative chapter number in `features/story/parts.tsx`. That file is unchanged since
`44862e6` and frozen, so it is left as is.

**Favicon:**

- rendered in Chrome at 16 / 20 / 24 / 32 / 48 px, DPR 1 and 2, on four tab colours;
- inspected in real Chrome and Edge tab strips (light and dark) beside the old tile.

Firefox is still unavailable on this Windows build.

## 3. Status

- **Push status:** NOT PUSHED.
- **EP25:** NOT STARTED.
