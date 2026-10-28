# EP24.1.4.4 — Contact & Consultation Visual Recomposition

Status: **completed locally, awaiting owner review. NOT PUSHED.** Visual / UX patch on top of the
approved route split (`38ca4bf`). Routes, wizard logic, topic parameters, hand-off, map
behaviour, privacy, SEO and sitemap are unchanged. EP26 has not been started.

## 1. Why the previous design failed

- **Scale:** display-size headings and tall heroes pushed the useful content below the fold; the
  pages felt like marketing landings, not a company endpoint or a working tool.
- **Soft containers:** 28–32 px rounded cards (consultation workspace, invite panel, map frame)
  and big bright pills gave a friendly-startup, template look.
- **No CORE grammar:** none of the site's own language — compact uppercase metadata, numbered
  rows on thin teal rules, node-and-route motifs, precise geometry — appeared on these pages.
- **Hierarchy:** on Contact the consultation path was invisible on the first screen and the
  location did not lead; on Consultation the form was one big box with a second box beside it.

## 2. Principles taken from existing CORE surfaces

| Source | Principle reused |
| --- | --- |
| Homepage | Uppercase tracked metadata next to Thai headings; department nodes on a route |
| About (principles chapter) | Numbered rows on thin teal rules; `fig. 02` captions |
| Login | Mono `CORE · WORKSPACE` metadata; converging lines into a node |
| Why CORE / Connected Flow | Paths between points; restrained teal on obsidian |
| Brand system | Obsidian / navy, precise teal, restrained silver, no glow except on interaction |

## 3. Contact — "where the outside world connects to PDA BLISS"

**Hierarchy:** compact intro → endpoint rail → location (main visual) → consultation gateway.
At 1440 × 900 the identity, the three channels, the map and a consultation signpost are all in
the first viewport.

- **Intro:** `● ติดต่อ — PDA BLISS` metadata; H1 *คุยกับ PDA BLISS* at
  `clamp(2.125rem, 1.55rem + 2.1vw, 3.5rem)` (56 px at 1440, was 68 px). The lead sits in
  a right-hand column aligned to the headline's baseline (deliberate asymmetry) with a compact
  signpost: *ยังไม่แน่ใจว่าควรเริ่มตรงไหน? ปรึกษาแบบมีขั้นตอน →* to `/consultation`.
- **Endpoint rail:** one hairline rail with a teal segment and a node where each endpoint
  begins; three columns on desktop separated by thin rules. Each endpoint: small square icon tile
  (8 px corners), uppercase label (*PHONE · LINE OA · EMAIL*; Thai and Chinese labels in the sans
  face), strong value, ↗ on hover / focus. Tablets use weighted columns without icon tiles so no
  value breaks; phones stack.
- **Location:** an editorial split, ≈ one third identity / two thirds map. Left: `02 —
  ที่ตั้งบริษัท`, *PDA BLISS COMPANY LIMITED*, the address on four lines against a teal rail, a
  thin connector with a node running from the address into the map frame, the directions action
  as a text-and-rule link (*เปิดเส้นทางใน Google Maps ↗*), and a `fig. 02` caption saying the
  map is Google Maps, a third-party service. Right: the map in a deep, precise frame (12 px outer,
  8 px inner, hairline edge, teal top light, four small corner brackets) — 480–576 px tall on
  desktop, 420 px tablet, 320 px phone. The map is rendered dark with a CSS filter on the iframe
  so it sits in the obsidian surface; still the same keyless embed, still loading with the page.
- **Consultation gateway:** not a card. A band between hairlines (teal lead-in on the top
  rule), `03 — ปรึกษา`, *ยังไม่แน่ใจว่าควรเริ่มจากตรงไหน?*, the short explanation, and on the
  right a rail of six numbered nodes — the consultation's six steps — running into
  **เริ่มปรึกษาเรา →**, over a faint masked technical grid.

## 4. Consultation — "Guided Discovery"

- **Hero:** one line of navigation and metadata (`← กลับหน้าติดต่อเรา | ● ปรึกษา — DISCOVERY`),
  H1 at `clamp(1.875rem, 1.4rem + 1.8vw, 3.25rem)` (≈ 48 px at 1440, 52 px max; was ≈ 60 px) with
  the lead aligned right. Faint routes converge at the right edge. The first question and options
  are in the first viewport at 1440 × 900.
- **Workspace (≈ 75 %) + context rail (16.5–18 rem):** no card around the conversation; a
  vertical hairline divides the two; the rail is sticky on wide screens.
- **Progress:** a numbered technical rail — `01 … 06` above each label, active step with a 2 px
  strong-teal underline, completed steps muted teal, future steps graphite. Numbers come from a
  CSS counter, so each step's accessible name is still its plain label (`aria-current="step"`,
  disabled future steps). Labels appear only where all six fit (container query); narrower, the
  numbers plus the current step name.
- **Options as system paths:** each topic row carries a technical code (`DEMO`, `CONSULTING`,
  `IMPLEMENTATION`, `INTEGRATION`, `PACKAGES`, `ENTERPRISE`, `GENERAL`; decorative,
  `aria-hidden`), the label and the hint, with a compact indicator at the end. 10 px corners,
  hairline edge; selected: teal edge, 2 px teal left rail, soft left-to-right fill. Group legends
  are uppercase metadata followed by a hairline. Chips use 8 px corners and the same states.
- **Context rail:** `— สิ่งที่คุณเลือกตอนนี้`, a progress readout (`ความคืบหน้า 01 / 06` with
  six micro-segments), the chosen values stacked label-over-value, then — below a hairline — the
  quiet *ไม่สะดวกกรอกตอนนี้?* fallback with phone · LINE · email. On phones the rail follows
  the conversation as a disclosure.
- **Context banner:** a slim teal-ruled line instead of a rounded box.

## 5. Controls and geometry

- Page-local `coreControl()` (`features/contact/coreControls.ts`): 10 px corners, firm inset
  edge, small arrow that nudges on hover, light only on hover / focus; *line* and *quiet*
  variants. Used for Next / Back / Skip, Prepare, the hand-off actions and the gateway CTA. The
  site-wide `buttonClasses()` is unchanged.
- Radius on these pages: 6–12 px (map frame 12 / 8, options 10, chips 8, notices 8). The browser
  QA fails if any large surface on either page has a radius over 18 px.
- `metaText`: mono, 11 px, tracked, uppercase for Latin; Thai and Chinese use the sans face at
  caption size (tracking breaks Thai clusters and thins Chinese).

## 6. TH / EN / ZH

Reviewed in all three. Thai headings balance at the same clamp as English; long English
labels (*Implementation consultation*, *What you have chosen so far*) and Chinese
(*告诉我们 / 贵组织如何运作*) wrap cleanly; no Thai beyond the approved address in EN / ZH.

## 7. Verification

- **Screenshot review (human):** Contact TH and Consultation TH at 390 / 768 / 1440 / 1920,
  EN and ZH at 1440, the organization, details-with-errors, review and prepared states at 1440,
  and both pages with the cookie banner at 390 — compared side by side with the current
  Homepage, About (principles chapter) and Login. Verdict: they read as the same PDA BLISS CORE
  product.
- **Browser QA — Chrome and Edge, 254 / 254 checks each:** everything from EP24.1.4.3 (8
  widths × 3 languages, overflow, one h1, targets ≥ 24 px, map size and auto-load, channels once,
  topic preselection, unknown topic, wizard walk and hand-off, no Google on /consultation, axe
  WCAG 2.2 AA at 390 / 768 / 1440, cookie banner shown and dismissed with keyboard-focus
  reachability, legacy redirect, CTA destinations, no page errors) plus new design guards: H1 48–64
  px (Contact) and 44–60 px (Consultation) at 1440; channels, map and signpost in the first
  Contact viewport; first question and options in the first Consultation viewport; no large
  surface with radius > 18 px; map source caption; rail progress.
- **Focus not obscured (EP24.1.4.3):** kept — the cookie banner still reserves its height as
  bottom scroll padding; its behaviour is unchanged.
- **Gates:** typecheck ✓ · ESLint ✓ · Prettier ✓ · 974 tests ✓ (3 new focused tests: first-screen
  signpost with its own name, map source caption, rail progress) · build + prerender 108 + 3 ✓ ·
  verify-prerender ✓ · perf budget ✓.
- **Firefox:** not run (same reason as EP24.1.4.3: the cached Playwright Firefox builds do not
  launch with the installed Playwright version).

## 8. Performance

| | EP24.1.4.3 | EP24.1.4.4 | Budget |
| --- | --- | --- | --- |
| `/contact` chunk, gzip | 4.4 kB | 5.8 kB | — |
| `/consultation` chunk, gzip | 14.0 kB | 14.5 kB | — |
| Initial JS, gzip | 184.8 kB | 184.8 kB | 205 kB |
| All JS, raw | 4,114.8 kB | 4,124.8 kB | **4,300 kB (unchanged)** |
| Static HTML, raw | 543 kB | 544.3 kB | **560 kB (owner-approved, unchanged)** |

No new dependencies. The owner's approval of the 560 KiB static-HTML cap is recorded in
`docs/PERFORMANCE.md` and `scripts/perf-budget.mjs`; it is not to be raised again without owner
review.

## 9. Not changed

Route split, wizard steps and validation, `?topic=` / `?plan=` / `?industry=` / `?department=`
preselection, legacy redirect, the honest hand-off, map loading and privacy disclosure, SEO,
sitemap, header / navigation, other public pages, EP25 Company Control Center. Nothing pushed;
EP26 not started.
