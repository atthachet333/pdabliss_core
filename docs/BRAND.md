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

**Simplified Chinese (EP05).** Plex has no Han glyphs, so `:lang(zh-CN)` uses `--font-zh`:
Plex for Latin, then PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC / CJK SC and
Source Han Sans SC — Simplified faces named explicitly so no Japanese or Traditional fallback is
picked. Never mix Traditional characters into `zh-CN` copy.

**Letter-spacing.** Wide tracking (`tracking-[0.14em+]`, uppercase) is for Latin overlines only
(*DEPARTMENTS*, *CONNECTED WORKFLOW*). Thai labels are never tracked — spaced Thai reads as
broken text.

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

## Public shell (EP05)

The header, mega menus, footer, cookie UI and floating utilities share one language — see
[PUBLIC_SHELL.md](PUBLIC_SHELL.md):

- **Smoked dark glass, not white boxes.** Overlays use near-black surfaces
  (`rgb(5–7 11–14 18–21 / 0.74–0.99)`), a hairline `border-soft`, and one fine emerald edge light
  (`via-brand-glow/40–55` gradient line) on top. Mega panels and popovers are near-opaque so
  the page never ghosts through.
- **Highlight panels** carry a faint CORE orbit (six nodes) at ≈ 20 % opacity and a radial
  emerald light from one corner — the whisper of the CORE mark, never a glow on every element.
- **Footer intensity ≈ 2/10.** Obsidian, one emerald hairline, a soft radial light, two
  restrained network curves; it should feel like a calm ending.
- **Contact styling stays on-brand.** Floating contact uses dark emerald icon tiles — no
  social-media blues/greens, no LINE brand colour, no chat-widget bubble.
- **Honest copy.** Planned capabilities are tagged *อยู่ในแผนพัฒนา*; cookie UI states which
  categories are not in use. No invented clients, uptime, certifications, counts or awards.
  (Approved package prices arrived in EP07 — see below.)

## About — cinematic layer (EP13)

See [ABOUT_PDA_BLISS.md](ABOUT_PDA_BLISS.md). The page is meant to make a visitor pause: four
signature scenes (real work → CORE, the design table, the defense rings, the work table) built
from DOM, SVG and CSS. Rules:

- **Motion is state, not decoration.** Disorder becomes structure; nothing floats for its own
  sake; the final state is always the calmest one.
- **Full width, not boxed.** The hero scene runs behind the headline across the viewport, with
  depth from three layers (foreground slips, mid connections, distant system lines).
- **Crafted chapter system.** Ghost numbers stay near-invisible; the notation (`fig. 05 — …`) is
  small mono text; numbers never outweigh content.
- **Amber = unstructured reality, teal = structure** (unchanged from EP12).
- **Calm ending.** Company information has no animation.

## Trust Center and sign-in (EP15)

See [SECURITY_TRUST_CENTER.md](SECURITY_TRUST_CENTER.md) and
[LOGIN_EXPERIENCE.md](LOGIN_EXPERIENCE.md).

- **Trust, not cyber.** Control, clarity, boundaries, responsibility and architecture. No giant
  padlocks, matrix rain, hacker imagery, neon or fake terminals.
- **The signature image.** One work item with role windows around it. Permitted fields flow in
  (teal); others stop at the boundary (controlled amber, dashed, with a tick).
- **Statuses** use the EP10 taxonomy, always as icon plus words.
- **The gateway.** Outside: department signals in their workspace colours. On the seam: the CORE
  gate. Inside: the form panel as the focused workspace, with a system-state pill instead of a
  spinner. Failure is controlled amber, never red alarm.
- **Voice.**
  - *ทุกคนไม่ควรเห็นทุกอย่าง* and *เข้าสู่พื้นที่ทำงานของคุณ*.
  - Never "Welcome back".
  - Never a certification, uptime or "guaranteed" claim.

## Interactive demo (EP14)

See [INTERACTIVE_DEMO.md](INTERACTIVE_DEMO.md). A calm working surface, not a game: one work
item, real-looking but clearly simulated (a *DEMO* tag and *ข้อมูลจำลอง — ไม่มีการบันทึก* stay
visible), department colours only as small dots, status always as icon + words. Amber marks the
open exception and the PREVENT notice; teal marks resolved and complete. Completion is quiet —
numbers from the trace, then the conversation CTA. Voice: *งานเดียวกัน แต่มุมมองต่างกัน*; no
claims of automation, accounting or real-time integration.

## Contact (EP13)

See [CONTACT_EXPERIENCE.md](CONTACT_EXPERIENCE.md). A working-session look: one question at a
time on a deep panel, choices as quiet rows and chips (never seven equal cards), a persistent
*talk directly* panel, LINE OA as the highlighted channel, an honest amber notice before the
final step. Voice: *start from the problem*; never "we will reply within…".

## Company story (EP12)

See [ABOUT_PDA_BLISS.md](ABOUT_PDA_BLISS.md) and [WHY_CORE.md](WHY_CORE.md). EP08 movement, EP09
friction, EP10 architecture, EP11 environments; EP12 is **belief, identity and craft** — the
most human, editorial pages on the site:

- **Statements first.** Two-tone display headlines (muted question → bright answer), generous
  whitespace, a manifesto instead of value cards, editorial definition lists instead of boxes.
- **Reality → structure.** Warm amber marks unstructured reality (notes, chat, slips, waiting
  gaps); CORE teal marks structure (states, workspaces, the shared layer). The methodology
  sketches move from hand-drawn to fully structured across four stages.
- **No stock imagery, no faces, no social proof.** Process fragments, department signals,
  documents, states and workflow only. No logo wall, counts, awards or testimonials.
- **Company vs product.** *PDA BLISS* is the company; *CORE* is the product. The Thai registered
  name appears on Thai pages; *PDA BLISS COMPANY LIMITED* in English and Chinese.
- **Thai typography.** Display lines carry authored wrap points (`|`) so Thai breaks
  naturally at 320–430 px; Thai labels never get wide letter-spacing.

## Industries (EP11)

See [INDUSTRIES_EXPERIENCE.md](INDUSTRIES_EXPERIENCE.md). EP08 is movement, EP09 friction, EP10
architecture; EP11 is **operational environments**:

- **Geometry, not colour.** The CORE palette stays; each industry is told apart by its motif —
  network (distribution), schedule grid (services), milestone architecture (projects), branch
  map (retail), skyline of sites (property), material lanes (manufacturing) — and by hero
  composition, section rhythm and signature section.
- **Environment patterns.** Dot grids, ruled schedules, phase columns, building grids and lane
  rules sit behind each hero at low contrast; the overview's windows carry the same patterns.
- **Shared language, different compositions.** Parts are shared (status tags, principle fit,
  boundaries, links); page layouts are not.
- **Boundaries are designed, not buried.** Retail (not a POS) and Property (not the Property &
  Rental Management product) state their boundary right after the hero.

## For organizations (EP10)

See [ENTERPRISE_EXPERIENCE.md](ENTERPRISE_EXPERIENCE.md). EP09 is friction → resolution; EP10 is
**structure, control and scale** — architectural, calm, intensity 6–8/10:

- **Floors, not cards.** Layered slabs (teams → processes → control → executive visibility),
  a growth staircase, an orbit of workspaces, a masked work object, terraces that descend to the
  source, a company tree, a roadmap and a readiness stack — thirteen chapters, thirteen
  compositions, no card grid.
- **Palette**: obsidian and graphite planes, navy bands, emerald/teal light for what is
  controlled or selected, silver for the System admin, amber only for conditions and the
  readiness boundary.
- **Honest status everywhere.** Four statuses, always icon + words: มีในต้นแบบปัจจุบัน ·
  กำหนดตามขอบเขต · เตรียมโครงสร้างไว้ · อยู่ในแผนพัฒนา. *พร้อมรองรับ ≠ การรับรองมาตรฐาน.*
- **Never claimed**: certifications, compliance, uptime, response times, customer size,
  partnerships, finished integrations or security guarantees (enforced by tests on all copy).

## Solutions (EP09)

See [SOLUTIONS_EXPERIENCE.md](SOLUTIONS_EXPERIENCE.md). EP08 is movement; EP09 is **friction →
resolution**:

- **Stable system, broken joins.** Departments stay calm and solid; problems appear between
  them as warm, dashed gaps — muted amber, red only for genuinely blocked states.
- **Clarity returns in emerald/teal.** Every "with CORE" state uses the brand light again.
- **Different visual logic per story** — tracks, lenses, lifecycle, paused pipeline, inventory
  timeline, receipt bar, document gates, rising signals, workspace line — never nine identical
  card grids.
- **Qualitative only.** Before/after pairs in users' own words; no numbers that imply results.

## How CORE works (EP08)

See [HOW_CORE_WORKS.md](HOW_CORE_WORKS.md). More kinetic than EP06, because the page explains
movement — but every motion carries meaning (travel, handoff, waiting, branching, completion).

- **Departments as lanes, work as light.** Each department is a quiet band with its workspace
  accent as a small tick; the route is one emerald line weaving between bands. What is done
  glows, what is ahead is dashed.
- **Status by shape and word**: circle (normal), triangle (attention), square with bar
  (blocked), dashed ring (waiting), filled check (complete) — never colour alone.
- **Calm until something is wrong.** Exceptions lift one step out of a still route; no red
  screens or alarm styling. The executive band marks only what needs attention.
- **Sample records, not data**: SO-1042, PO-2215, LOT-2410-A — no names, no amounts.

## Pricing (EP07)

See [PRICING_AND_PACKAGES.md](PRICING_AND_PACKAGES.md). Pricing must feel like CORE, not a
hosting, telecom or discount page:

- **Plans are layers of capability** — Foundation, Connected, Controlled, Tailored — drawn as
  stacked isometric plates on the CORE spine. The selected plan lights its layers and gains
  departments, cross-department links, controls, API ports and integrations.
- **Editorial first, cards second.** The page opens with the idea and the starting price; the
  four plans live in an explorer where the selected plan expands and the others stay visible.
- **Business is recommended quietly** — a small emerald badge, no oversized card. Enterprise is
  quieter still: neutral border, no price, a consultative CTA.
- **Calm commercial language.** No crossed-out prices, countdowns, urgency or red discount
  styling. Early Access is a premium panel, not a sale banner.
- **Prices are typographic, not decorative**: large tabular figures for the monthly price, a
  three-row relationship for annual, "ประมาณ" on rounded year-3 figures.
- Thai labels never use letter-spacing or uppercase; tracking is reserved for Latin eyebrows.

## Department experience (EP06)

See [DEPARTMENT_EXPERIENCE.md](DEPARTMENT_EXPERIENCE.md). One kit, six identities:

- **The workspace accent is the department's signature.** Each page exposes its
  `--color-ws-*` accent as `--dept`; small identifiers (eyebrows, rules, active states, hero
  strokes) use it through `color-mix(in oklab, var(--dept) N%, transparent)`. Emerald stays
  the brand light; the accent never replaces it on CTAs.
- **A page-wide backdrop motif per department**, at whisper intensity (≈ 4–10 % accent,
  masked at top and bottom): Executive horizon strata, Sales route arcs, Operations day
  columns, Warehouse floor grid, Purchasing supplier nodes, Accounting ruled ledger.
- **A unique hero visual and signature sections** for each department, so a mid-page
  screenshot still identifies it. Shared sections (Today, In/Do/Out, Manager, Preview,
  Connected, CTA) keep the rhythm calm and consistent.
- **Honest sample data.** Example states are labelled as examples; Warehouse shows quantities,
  lots, dates and locations only; Accounting shows "per PO terms", never figures.

## Imagery

Generated, abstract and brand-tinted (orbits, networks, racks, ledgers) — produced by
`frontend/scripts/build-assets.mjs` and committed as small WebP/AVIF/PNG files. No stock
photography, no AI people, no generic SaaS illustrations. Every image is decorative
(`alt=""`) and every surface has a CSS fallback, so the site reads fully without images.

**Department scenes (EP05 revision).** Seven cinematic environments — Sales, Operations,
Warehouse, Purchasing, Accounting, Reports, Executive — drawn in code by
`frontend/scripts/build-department-scenes.mjs` (one-point perspective, shared camera and room
language) and rendered to WebP at 960×540 and 400×225. Rules: dark obsidian / deep-navy rooms,
emerald / teal / cyan light only (amber only as a tiny status accent), large luminous screens
carrying each department's work (order pipeline, Gantt plan, lot labels, supplier network,
verification ledger, dashboards, command view), backlit anonymous silhouettes (no faces, no
identity), glowing floor lanes leading to the main display (the CORE thread), vignette and soft
volumetric light. Never prices or costs in the Warehouse scene; on-screen text is limited to
neutral codes (SO, PO, LOT, EXP, QTY). The files can be replaced by any 16:9 artwork with the
same names — the site never depends on them for meaning.

## Voice

Thai-first, calm, precise. Short declarative sentences. Talk about the work people do, not
about "digital transformation". Never diminish PDA ONE — the two products serve different needs.
