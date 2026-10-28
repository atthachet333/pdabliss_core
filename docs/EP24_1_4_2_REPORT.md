# EP24.1.4.1 – EP24.1.4.2 — One Contact Workspace & Simplified Live Map

Status: **completed locally, awaiting owner review. NOT PUSHED.** Owner-approved public Contact
correction on top of EP24.1.4 (`3928fc9`). EP24.1.4.1 (consolidation, live map) was reviewed before
commit and refined into EP24.1.4.2 (location side reduced to the essentials); both land in one
local commit.

## 1. Before

`/contact` felt like two contact pages stacked: the consultation with a sticky "Talk to us
directly" panel (phone / LINE / email, live summary, "what helps", company + address), then a
second full section (company identity, address, phone / email / LINE again, a map behind a
"Show map" gate, an Open in Google Maps button). Phone, LINE, email and the address each appeared
two or three times; the map felt appended.

## 2. After — one workspace

```
INTRO (hero)
CONTACT WORKSPACE   [ consultation + live summary  ≈ 55 % ] [ location  ≈ 45 %, sticky ]
FOOTER
```

- **Left — conversation:** the existing wizard (topic · organization · problems · reply method ·
  details · review) unchanged in logic, and its live summary under it. Phone, LINE and email are
  offered by the wizard's own final hand-off (and, site-wide, the footer and floating contact
  panel) — the page itself no longer repeats them.
- **Right — location only:** company name (restrained, label size) → address on four lines
  (`186/42 หมู่ 6 · ต.ทวีวัฒนา · อ.ไทรน้อย · จ.นนทบุรี 11110`, split from `CONTACT.address`) →
  a large Google map → one **Open in Google Maps** action. Nothing else.
- **Composition:** the company name aligns with the top of the form card; the map is the anchor
  (480–620 px high on wide screens, `clamp(30rem, 62vh, 38.75rem)`), framed by a deep-navy
  surface, a subtle teal hairline, generous radius and a soft shadow — no glow, labels or
  decorations on or around it. On wide screens the location column is sticky, so the map stays
  beside the form while it is filled in.
- **Breakpoints (decided, not forced):** side by side from 1280 px. At 1024 the wizard's six-step
  bar collided in a half-width column, so tablets stack: form → address → map → action
  (map 440 px; phones 340 px).
- **Shorter page:** the hero's decorative step chips (hidden from assistive tech and repeating the
  wizard's own step bar) were removed and its padding tightened; the workspace starts ≈ 100 px
  higher and the page is ≈ 200 px shorter than before (2,236 → 2,042 px at 1440, TH).
- Also fixed: the wizard's step labels now truncate inside their step (they ran into each other in
  English in the narrower form column).

### Removed (EP24.1.4.2)

Latitude / longitude display, the coordinate rail, the corner marks and location node, the
"CORE LOCATION" label, the "Talk to us directly" cards (phone, LINE, email), the hero's mobile
contact block, the old sticky direct panel ("what helps", company block, "See on map" link), the
second location section, the "Show map" gate / placeholder and the long privacy paragraph under
the map.

## 3. Google Maps — automatic loading and disclosure

- **Why it changed:** EP24.1.4 loaded the map only after a click, because the cookie copy promised
  no third-party cookies without permission. The owner decided (EP24.1.4.1) that visitors should
  see the map immediately. That supersedes click-to-load, so the public wording was corrected
  instead of hiding the map.
- **Embed:** unchanged keyless iframe (`maps.google.com/maps?q=13.956774,100.3378182&z=17&hl=…&output=embed`),
  no API key, no Maps JavaScript SDK, `loading="lazy"` (in the first screen on wide screens; loads
  when reached on phones), localized `title`, Contact chunk only. The action opens the exact
  owner-provided listing (`…!3d13.956774!4d100.3378182…`) in a new tab with
  `rel="noopener noreferrer"`.
- **Disclosure (concise, TH / EN / ZH):**
  - Cookie banner — "Our website uses only the cookies it needs to work; any others *of ours* only
    with your permission." + "This website does not currently use analytics or marketing cookies.
    The Contact page shows a Google Maps map, a third-party service that may use Google's own
    cookies."
  - Privacy Policy — "PDA BLISS sets no tracking cookies" (was "uses no tracking cookies") and one
    paragraph: the Contact page embeds Google Maps, a third-party service; opening it loads the map
    from Google, which may receive technical information such as the IP address and may use
    cookies or similar technologies under Google's own policies; PDA BLISS does not control that
    use. Shown on `/privacy` only.
  - It is not presented as PDA BLISS analytics or marketing, and no consent category gates it. No
    new tracking was added.

## 4. Verification

- **Frontend:** 41 files / 962 tests. New or updated: the map is present on load (no gate, keyless,
  lazy, official coordinates); the location side holds only H2 company → address → map → one
  link (no coordinates, labels, contact cards or long notes); one workspace (form, then location;
  one iframe, one listing link, the address once); listing link and labels in TH / EN / ZH, no Thai
  in EN / ZH; map loads whatever the cookie choice; the banner and the Privacy Policy disclose
  Google Maps (TH / EN / ZH; not on /terms); no map on `/`, `/about`, `/en/pricing`; channels
  still reachable via the footer; two shell / Thai-leak helpers adjusted to the single
  presentation.
- **Gates:** typecheck, lint, format, tests, build, prerender (105 pages + 3 shells, verified),
  perf — pass.
- **Browser QA (Chrome 221 / 221, Edge 221 / 221):** TH / EN / ZH × 320 / 375 / 390 / 430 / 768 /
  1024 / 1440 / 1920 — no overflow; map inside its column; exactly one link, no coordinates or
  contact cards on the location side; map height per breakpoint (phone 340, tablet 440, desktop
  558); ≥ 1280 side by side at 54–55 % form with the company name aligned to the form card;
  < 1280 stacked; at 1440 / 1920 the map starts in the first screen and stays in view while
  scrolling; on phones it loads when reached; wizard step labels contained at 640–1920; axe on the
  location section (incl. best practice) and on the whole page (WCAG A/AA) at 390 / 1440 / 1920 —
  clean; visible focus on the action; the cookie banner shows on a first visit, discloses Google
  Maps, and the wizard's Next and the map action stay reachable with it shown and after
  "Reject non-essential"; the map is present whatever the choice; `/privacy` in three languages
  carries the disclosure; no map or Google Maps request on `/`, `/about`, `/pricing`,
  `/en/features`, `/solutions`, `/resources`, `/privacy`; no page errors. Firefox not run (still
  cannot start on this Windows build).

## 5. Performance

Initial JS 184.6 KiB gzip (184.5 before: the longer banner sentence), initial CSS unchanged,
page budgets unchanged; all JS 4,103 KiB raw (4,112 at EP24.1.4; cap 4,300 not raised). The map URL
and coordinates exist only in the Contact chunk.

## 6. Scope

Changed: the Contact page, its copy, the cookie banner sentences, the Privacy Policy text, and
tests. Untouched: Homepage, About / partner layout, Pricing, Features, Solutions, Resources,
navigation, EP25 and every backend file.

## 7. Known limitations

- Google's map UI inside the iframe cannot be restyled and follows Google's own accessibility.
- The site-wide floating contact button sits at the right edge of the viewport and can overlap
  the map's edge while scrolling; it does not cover Google's controls at the tested sizes.
- The formal Privacy Policy is still "being prepared" (unchanged); only the Maps facts were added.

## 8. Status

Commit `fix: simplify CORE contact map experience (EP24.1.4.2)` — local only. **Push status:**
NOT PUSHED. **EP26:** NOT STARTED.
