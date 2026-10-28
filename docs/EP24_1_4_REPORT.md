# EP24.1.4 — Partner Layout Balance & Contact Map

Status: **completed locally, awaiting owner review. NOT PUSHED.** A small, owner-approved patch to
the frozen public site: two targeted changes, nothing else redesigned.

## 1. Baseline

`main` clean at `38c2981` (EP25 + approved 4,300 KiB all-JS cap), 2 commits ahead of `origin/main`
(unpushed EP25 work). `git diff --check` clean. No `/partners` route exists — the S2 partnership
lives only in /about chapter 07; this patch does not create a partner architecture.

## 2. A — PDA BLISS × S2 partner balance (/about, chapter 07)

**Before:** a three-column row with `items-center`: a 96 px dark CORE tile against a 192 px light S2
logo, headings of different lengths centred independently, the CORE node centred on the middle
column *including* its caption (so above the logos' axis), an action on the S2 side only, and the
S2 side entering later than PDA BLISS.

**After — the composition itself:**

- One symmetric grid, `minmax(0,1fr) | clamp(12.5rem,18vw,15rem) | minmax(0,1fr)` (200–240 px
  connector), max 78 rem. Both company zones have the same structural width at every desktop width
  (measured: 504 | 240 | 504 at 1440 / 1920, 372 | 200 | 372 at 1024).
- **Shared rows (CSS subgrid):** logo zone · field label · company name · secondary name · role ·
  points · action are seven rows shared by both sides and the connector, so labels, names, roles,
  bullet lists and actions line up whatever the language or name length. Long names (the Thai S2
  name wraps to two lines) centre on their shared row; everything else starts on the same line.
- **Optical balance of the logos:** both sit on plates of one size (9 rem desktop, 7 rem phone) at
  the inner edge of their side. The S2 artwork is unchanged — same file, aspect ratio, light plate,
  no recolouring, glow or stretch — and fills its plate; the small dark CORE mark is enlarged inside
  its plate and carries the teal ring/glow, so the light S2 plate does not dominate.
- **CORE connector:** the node sits on the logos' centre line, exactly at the grid centre
  (measured Δx = 0, Δy = 0), with identical gaps to both plates (76 px each at 1440). Line bundles are exact mirror
  images (teal from PDA BLISS, silver from S2), start at the plate edges, meet at the node,
  `non-scaling-stroke`, slightly lower opacity — visible but secondary. The node is a ring and the
  word CORE: no plate, no company name — the meeting point, not a third company. Its caption sits on
  the field-label row under it.
- **Equal actions:** PDA BLISS gets "How CORE works" (`/how-core-works`, localized) to match
  "Learn about S2" (external, `noopener noreferrer`, new tab announced). Same shape, size and
  weight; only the tone differs (teal / silver). Both sides enter together.
- Unchanged: positioning (Technology / Platform / System Design vs Accounting / Advisory /
  Business Process Insight), the "separate companies" statement, copy (one new action label per
  locale), EP24.1.3 brand. **Phones:** PDA BLISS → vertical teal line → CORE → silver line → S2,
  centred, names wrapping only between words.

## 3. B — Contact map (/contact)

- **Composition:** a new location section after the consultation flow — desktop
  `contact identity | map`, phones stacked. Left: "Where to find us", the registered company name
  (Thai name + English legal name on Thai pages), address, phone, email, LINE (the existing
  `ContactDetails`, compact) and **Open in Google Maps**. Right: the map. The "Talk to us directly"
  panel's company block links to it ("See the location on the map", `#location`). The address is
  always written out — the map only adds to it. No other Contact copy changed.
- **Location (owner-supplied):** `13.956774, 100.3378182`, listing
  `https://www.google.com/maps/place/PDA+BLISS+COMPANY+LIMITED/@13.9567792,100.3352433,17z/…!3d13.956774!4d100.3378182…`,
  kept once in `src/config/location.ts` (imported only by the Contact page; contact details stay in
  `CONTACT`).
- **Embed:** keyless iframe `https://maps.google.com/maps?q=13.956774,100.3378182&z=17&hl=<th|en|zh-CN>&output=embed`
  — no API key, no Maps JavaScript SDK, `loading="lazy"`, localized `title`,
  `referrerpolicy="strict-origin-when-cross-origin"`, framed in the CORE panel (deep navy, hairline,
  teal edge, 2 rem radius). The pin is at the listing's coordinates; "Open in Google Maps" opens the
  listing itself (name, reviews, directions).
- **CTA:** เปิดใน Google Maps / Open in Google Maps / 在 Google 地图中打开 — external, new tab
  announced, `rel="noopener noreferrer"`, raw URL never printed.
- **Consent:** the existing cookie categories (analytics / preferences / marketing) do not describe
  embedded third-party content, and the banner states that no marketing cookies are used. So the map
  **never loads by itself — not even after "Accept all"**: a deliberate placeholder (location node,
  company, address, "Map from Google — showing the map loads content from Google, which may set its
  own cookies", Privacy Policy link, **Show map** / แสดงแผนที่ / 显示地图, Open in Google Maps)
  loads it only when the visitor asks, for that page view. No second consent system; choosing a
  cookie option never loads it.
- **Sizes:** phone 340 px, tablet 400 px, desktop 484–526 px (stretches with the identity column);
  the placeholder grows with its text on very narrow phones. After "Show map" focus moves to the map
  and a polite status announces it.

## 4. Verification

- **Unit / component (frontend 41 files / 960 tests, +6):** about — symmetric grid
  (`1fr | connector | 1fr`, order PDA → CORE → S2, subgrid rows, equal plates, CORE node without a
  company name, matched actions, PDA action localized, EN without Thai); contact — placeholder by
  default with no iframe / Google URL, Show map → keyless lazy embed at the official coordinates
  with localized `title` / `hl` and focus, listing link safe and exact, no auto-load after Accept
  all, EN / ZH labels, no map on `/`, `/about`, `/en/pricing`. Two existing Thai-leak helpers now
  strip every occurrence of the (approved, Thai-in-every-locale) address instead of the first.
- **Gates:** typecheck, lint, format, tests, build + prerender (105 pages + 3 shells, verified),
  perf — all pass. One existing auth test timed out once under full-suite load and passed 33 / 33
  alone and in the rerun.
- **Browser QA (Vite :1211, API not needed):**

  | | Chrome | Edge |
  | --- | --- | --- |
  | About partner + Contact location, TH / EN / ZH × 320 / 375 / 390 / 430 / 768 / 1024 / 1440 / 1920: no overflow, equal plates, S2 logo square and loaded, nothing clipped; ≥ 1024: equal side widths, node centred (x) and on the logo line (y), equal gaps; map inside its section; axe (WCAG 2.0–2.2 A/AA + best practice) on both sections at 390 / 1440 / 1920 and with the map shown; no Google request before Show map, requests after; focus to map; map heights per breakpoint; listing link; S2 link; visible focus; EN / ZH no Thai; cookie banner shown on a first visit and every partner / map CTA reachable with it and after "Reject non-essential", which loads nothing; no map / Google Maps request on `/`, `/about`, `/pricing`, `/en/features`, `/solutions`, `/resources`; no page errors | 208 / 208 | 208 / 208 |

  Whole-page axe (WCAG A/AA) at 1440 on `/about` and `/contact`: no violations. The previously
  documented About decorative-number contrast note did not reproduce in this configuration;
  nothing new was introduced. **Firefox:** not run (Playwright Firefox still fails to start on this
  Windows build — not altered). Safari / real devices not available.

## 5. Performance

Initial JS 184.5 KiB gzip and initial CSS 47.9 KiB gzip — unchanged for the homepage entry. The map
URL and coordinates exist only in the Contact chunk (checked in `dist/`). All JS 4,103 → 4,112 KiB
raw (cap 4,300, not raised). `/about` closure 53.3 → 53.5 KiB gzip; page budgets unchanged.

## 6. SEO and freeze

Contact / About titles, descriptions, canonical / hreflang, prerender and `OrganizationSchema`
unchanged (the schema already carries the address; coordinates were not added). Pricing,
Homepage, Features, Solutions, Resources and navigation untouched (freeze tests pass).

## 7. Known limitations

- The embed pins the coordinates; the place name / reviews appear in the full listing behind
  "Open in Google Maps".
- The "Show map" choice lasts for the page view. Remembering it would need a third-party-content
  cookie category and updated cookie copy — an owner decision.
- Google's own map UI inside the iframe follows Google's accessibility, not CORE's.

## 8. Status

- Commit: `fix: balance CORE partner layout and add contact map (EP24.1.4)` — local only.
- **Push status:** NOT PUSHED. **EP26:** NOT STARTED.
