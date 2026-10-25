# EP18.1 — Dropdown / Overlay Visual Polish

**Date:** 2026-10-25 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** `c02c23e` (EP18, approved and pushed). Before work: branch `main`, `main` ==
`origin/main` == `c02c23e`, working tree clean.

**Commit:** `feat: polish CORE dropdown and overlay surfaces (EP18.1)` — local only, **not
pushed**. Awaiting owner visual review.

## Scope

This is a public shell refinement: frontend only, with no change to navigation IA. Unchanged:

- `/app/*`, auth logic, the backend, the database / Prisma and the APIs
- business rules and pricing logic
- SEO behaviour: the prerendered head still verifies for all 105 pages and 3 shells
- the EP18 navigation: the same five items, four menus, sections, links, order, keyboard model
  and breakpoints

There is no new dependency.

## The shared system

Two new files define one vocabulary for everything that opens.

**`components/ui/overlay.ts`** — class tokens:

| Token | Use | Look |
| --- | --- | --- |
| `overlaySurface` | language list, utility dock panel | Opaque obsidian gradient `rgb(12 23 33)` → `rgb(6 13 20)`. Also a 7 % white hairline, a 4.5 % inner top light and a deep soft shadow. |
| `overlayRow(current)` | menu rows, language rows, mobile rows | 12 px radius. Hover: 4.5 % white plus a faint inner edge. Current: 9 % emerald tint plus a 26 % emerald inner edge. |
| `overlayLabel` | section titles | Muted caption led by a 12 px emerald tick |
| `overlayChip(current)` | department / industry / reference / approach entries | Outlined chip. Hover: emerald edge. Current: emerald tint. |
| `disclosureItem(open?)` | FAQ, comparison groups, guide examples | Contained rounded frame. Open: emerald edge and a slightly lighter surface. Without `open` it follows `<details open>`. |
| `disclosureTrigger` | disclosure buttons / `<summary>` | ≥ 56 px, full-width, no native marker |

**`components/ui/DisclosureIcon.tsx`** — the one open/closed affordance:

- A chevron in a ring (32 px, or 24 px for `size="sm"`).
- Open: it turns 180° and the ring goes emerald with a tint, so state is shown by shape and
  colour together.
- It is decorative (`aria-hidden`); the trigger carries `aria-expanded` or the native state.
- It is stateful through `open`, or follows `group-open` inside `<details>`.

The focus ring still comes from the global `:focus-visible` style; rows add a surface under it.
Every transition is a colour, border or single rotation, and each has
`motion-reduce:transition-none`.

## Visual decisions, surface by surface

### Header mega menus (`DesktopNav.tsx`, `MegaPanel.tsx`)

- **Panel:** an opaque gradient (`rgb(9 18 27)` → `rgb(5 11 18)`), a hairline bottom edge and
  an inner top light, replacing the flat `surface-dark` block.
- **Trigger:** the open trigger sits on a soft pill (`white/6 %`); hover shows `white/3 %`. The
  EP18 current-section dot and `aria-current` are unchanged.
- **Feature sections:** each is a quiet tray (`white/1.8 %` with a faint inner edge), titled with
  the emerald tick. A menu with one feature section (About) spreads it across three columns,
  where it used to leave a half-empty column.
- **Rows:** use `overlayRow`. The page you are on is tinted emerald with `aria-current="page"`.
  Anchors (`/#…`) never count as current.
- **Index rows:** one framed strip with a label and outlined chips, replacing loose text links on
  a hairline. Department chips carry their workspace colour as a 6 px dot.
- **Featured panel:**
  - an emerald-edged card (`border-brand/25`) with a radial + linear depth and a top edge light
  - orbit lines at 14 %
  - its call to action is now a pill button (≥ 44 px) instead of a text link

### Language selector (`LanguageSelector.tsx`)

- **Trigger:** an outlined pill, so it reads as a control. It turns emerald-edged while open, and
  the chevron turns.
- **List:**
  - `overlaySurface`, 20 px radius
  - a tick label heading
  - 48 px rows, each with a code badge (TH / EN / 中文), the language's own name and a check on
    the current one
  - the note sits under a 6 % divider
- **Unchanged:**
  - the badge is `aria-hidden`, so link names stay the native names
  - `aria-current`, Escape with focus return, outside-click close
  - the EP17 query/hash preservation

### Mobile menu (`MobileMenu.tsx`)

- **Current section:** the group you are in shows the same emerald dot as desktop, plus
  `aria-current="true"`.
- **Group state:**
  - `DisclosureIcon` replaces the bare chevron
  - the eyebrow turns emerald while the group is open
- **Open group:**
  - hangs from a 1 px emerald rail
  - section titles use the tick label
  - rows and chips use `overlayRow` / `overlayChip` and mark the current page
  - the featured link is a tinted, bordered button
- **Targets:** every interactive element in an open group is ≥ 44 px tall (verified at 320–1024
  px in all locales).

### FAQs and disclosures

| Surface | Before | After |
| --- | --- | --- |
| Pricing FAQ (`ClosingSections.tsx`) | divided text list, bare chevron | contained `disclosureItem` rows, 8 px apart, `DisclosureIcon`, answer padded to the frame |
| Pricing comparison groups, < 1024 px (`Comparison.tsx`) | bordered box, tinted header, bare chevron | `disclosureItem` frame, `disclosureTrigger`, `DisclosureIcon` |
| Security FAQ (`security/Chapters.tsx`) | divided list, `+` glyph rotating to × | contained `<details>` rows, `DisclosureIcon` (follows `open`) |
| Guide examples (`resources/article/Article.tsx`) | inset box, chevron-right | `disclosureItem` frame, small `DisclosureIcon` |
| Contact summary on phones (`contact/Panels.tsx`) | `▾` text glyph | small `DisclosureIcon` (hidden at ≥ 1024 px, as before) |
| Demo stage list on phones (`demo/Shell.tsx`) | `▾` text glyph | small `DisclosureIcon` |
| How CORE Works "show all steps" (`workflow/visuals.tsx`) | text-only pill | pill with a small `DisclosureIcon` that reflects expanded / focused |
| Utility dock contact panel (`UtilityDock.tsx`) | 90 % translucent panel with backdrop blur | `overlaySurface` (opaque; one fewer blur layer) |

## QA

**Gates:**

- frontend: `typecheck`, `lint`, `format:check`
- frontend tests: **30 files / 795 tests**
- `build`, with the prerender plus verify of 105 pages and 3 shells, and `test:prerender`
- backend: `typecheck`, `lint`, `format:check`, tests (4 files / 21)

**New tests:**

- `components/ui/overlay.test.tsx`:
  - the current page is marked in its menu (and only once)
  - a department chip is current on its page, keeping `/en`
  - the language list marks the current language, with names unchanged
  - the mobile menu marks the current group and page
  - a FAQ's icon state follows open/closed
- one Resources regression test (below)

**Sweep:**

- **Widths:** 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920
- **Locales:** TH, EN, ZH
- **Routes:** `/`, `/pricing`, `/how-core-works`, `/resources`, `/resources/human-error`, `/about`,
  `/contact`, `/security`, `/demo`
- That makes 243 page loads. Each checks:
  - horizontal overflow, before and after opening every `<details>`
  - header overflow
  - a single `h1`
- Below 1280 px it also checks the mobile menu: each group expanded in turn, every link and
  button inside the viewport and ≥ 44 px tall.

**Hands-on:**

- all four mega menus (current row / chip, one-section spread, 1280 px fit, keyboard ↓ entry
  and focus ring)
- the language list (real-click exclusivity with the mega menus, Escape and focus return)
- the mobile menu at 375 px (current dot, rail, current row)
- the pricing and security FAQs, the guide example, contact summary, demo stages and the
  workflow toggle

**Integrity checks:**

- **Console:** no errors or warnings on fresh loads of the review routes.
- **UTF-8:** no BOM, no U+FFFD, no mojibake and LF only across all changed files.
- **Whitespace:** `git diff --check` clean.

**Found and fixed during QA:**

- **The disclosure icon snapped instead of turning.** Tailwind v4 `rotate-*` sets the CSS
  `rotate` property, and the icon's transition listed `transform`. It now lists `rotate` (verified
  mid-turn).
- **`/en/resources` overflowed by 27 px at 320 px** (pre-existing since EP16):
  - "Accounting & Finance" could not wrap in the department picker.
  - `cn()` joins without merging, so the chip's base `whitespace-nowrap` beat the picker's
    `whitespace-normal` override.
  - Wrapping is now decided in one place (`resources/parts.tsx`), with a regression test.

## Performance

Initial load (entry plus preloads plus CSS) against EP18:

| | EP18 | EP18.1 | Change |
| --- | --- | --- | --- |
| JS | 903.5 kB (272.5 gz) | 907.6 kB (274.3 gz) | +4.1 kB (+1.8 gz) |
| CSS | 297.3 kB | 302.7 kB (46.3 gz) | +5.4 kB |

This is not material. There is no new runtime work beyond one `useLocation` read in the
menus, and the dock panel lost a backdrop-blur layer.

## Known limitations

- Reduced motion is verified by class (`motion-reduce:transition-none` on every new transition,
  plus the global reduced-motion block). It was not emulated in the browser.
- The mega menu's two feature columns can differ in height (Resources: one guide beside three).
  The trays align to the taller one, which leaves calm empty space rather than a stretched row.
- The same Tailwind v4 pitfall exists outside the overlay system, pre-existing and not changed
  here:
  - `WhyCoreChapter.tsx`: the panel slide uses `translate-y-*`, so the slide snaps and only the
    fade animates.
  - `core-world/NodeLabel.tsx`: the active label's `scale-[1.08]` snaps.

  The fix is the same as here: name `translate` / `scale` in the transition list. Capability
  stack and workflow visuals set inline `transform` and animate correctly.

**Push status: NOT PUSHED.**
