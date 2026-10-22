# EP05 — Public Navigation, Localization Foundation, Premium Footer & Utility Experience

**Date:** 2026-10-22 · **Owner:** PDA BLISS COMPANY LIMITED
**Baseline:** `main` @ `53ad933ea62bb262194b21a1dad9b3018acfc871` (EP04, on `origin/main`) — verified
clean before work began
**Commit:** `feat: establish public shell and localization foundation (EP05)` — local only,
**not pushed** (awaiting owner visual review)

## Scope

Public frontend only. The shared public shell around the EP04 homepage: header and Thai mega
menus, mobile navigation, localization foundation (th / en / zh-CN), footer, central contact
configuration, cookie consent and preferences, and the floating utility dock.

Not touched (empty `git diff` against the baseline): `/login` (`LoginPage.tsx`), `/app/*`,
`components/core`, `components/shell`, `workspaces/`, `prototype/`, the whole `backend/`,
Prisma, migrations, seed data, auth, RBAC, persistence, billing and contact submission. Page
bodies were not redesigned; the only page edits are two anchor ids (`plan-<id>` on the pricing
cards, `approach` on the About beliefs grid) and a contact-channels card on `/contact` that reads
the central config.

Design and behaviour are documented in [PUBLIC_SHELL.md](PUBLIC_SHELL.md).

## What was delivered

### Header

Thai top level in the approved order — **ภาพรวม** (→ `/`) · **แผนก** · **แพ็คเกจ** ·
**วิธีการทำงาน** · **โซลูชัน** · **สำหรับองค์กร** · **เกี่ยวกับเรา** · **ติดต่อเรา** (→ `/contact`) —
then the language selector and **เข้าสู่ระบบ** (→ `/login`). No English top-level labels on the
Thai experience. Near-transparent at the top, smoked glass after scroll or with a menu open. 15 px
labels at every desktop width; full navigation from 1280 px.

### Mega menus (six)

Each: English overline, Thai heading, one paragraph, optional honesty note, two-column items with
descriptions, and a highlight statement panel with CTA and faint CORE orbit geometry. Content is
exactly the approved copy (แผนก, แพ็คเกจ, วิธีการทำงาน, โซลูชัน, สำหรับองค์กร, เกี่ยวกับเรา);
headings/intros were written where the brief gave none (วิธีการทำงาน intro, โซลูชัน heading/intro,
สำหรับองค์กร intro, เกี่ยวกับเรา heading/intro). No prices. Security & Access and API &
Integration are informational with an *อยู่ในแผนพัฒนา* tag. Every link resolves to a live route or
anchor.

### Mobile / tablet navigation (< 1280 px)

Full-screen dialog with its own top bar and close button, focus trap, scroll lock, Escape, eight
large rows, expandable groups with items and CTA, segmented language control, contact and sign-in
pinned at the bottom; closes on navigation and when resized to desktop.

### Localization foundation

`th` (default, `/`), `en` (`/en`), `zh-CN` (`/zh`). Structure/words split
(`config/navigation.ts` vs `i18n/messages/*`), typed dictionaries, `useLocale()` with path
localization, aliases (`/th`, `/zh-CN`, `/zh-hans`) redirecting to canonical URLs, unknown
prefixes falling back to Thai, `/login` and `/app/*` never prefixed. EN and zh-CN dictionaries
are lazy chunks loaded by their routes. Shell copy is complete in all three languages; page
bodies remain Thai (stated in the language menu; `<main lang="th">`). Chinese font stack added.

### Footer

Column 1 brand (PDA BLISS CORE, by PDA BLISS, positioning, quick contact chips โทร · LINE · Email,
*พัฒนาโดย PDA BLISS COMPANY LIMITED*), two light link groups (ลิงก์ด่วน, องค์กร), column 4
ติดต่อเรา with the exact address, three phones, email and LINE; legal bar with copyright,
privacy, terms and การตั้งค่าคุกกี้. Obsidian with ≈ 2/10 geometry.

### Contact configuration

`src/config/contact.ts` is the only place contact values exist. Every LINE link uses
`https://line.me/R/ti/p/@593oiwec`. A test fails the build if any other source file contains a
contact literal.

### Cookie consent

Banner (accept all / reject non-essential with equal weight / settings), Cookie Preferences
dialog (essential locked on; analytics, preferences, marketing toggles), versioned
`localStorage` record, reopen from the footer, honest "not in use" statements, nothing sent to a
backend.

### Floating utility dock

Back-to-top (appears after ~one screen, smooth or instant under reduced motion) and a contact
control that expands into a stack: โทรหาเรา, LINE OA, ส่งอีเมล, ขอรับคำปรึกษา. Keyboard and touch
accessible; full-width sheet with scrim on phones; hidden over the homepage hero and on phones
while the cookie banner awaits a decision.

## Verification

### Gates — clean copy with `npm ci` (dev server left untouched)

| | npm ci | typecheck | lint | format | test | build |
| - | - | - | - | - | - | - |
| Frontend | ✅ | ✅ | ✅ 0 problems | ✅ | ✅ 170 / 170 (11 files) | ✅ |
| Backend | ✅ | ✅ | ✅ | ✅ | ✅ 21 / 21 (4 files) | ✅ |

The frontend suite was run 8 consecutive times green after fixing one timing-sensitive assertion
(`toBeVisible()` during the panel's fade-in).

New tests: `components/layout/header.test.tsx` (rewritten — exact Thai labels and order, no
English labels, direct links, six mega menus' content and live destinations, planned items not
links, packages without prices, keyboard pattern incl. wrap, outside click, cross-page anchor,
mobile dialog focus trap / scroll lock / language / Escape / close on navigate),
`components/layout/shell.test.tsx` (contact config values, no stray contact literals, footer
columns and exact links, all LINE links central, cookie banner accept / reject / settings /
essential locked / persistence / reopen / stale version / no network, back-to-top show + smooth
+ reduced motion, contact stack links / focus / Escape / navigation, hidden over the hero),
`i18n/i18n.test.tsx` (locales, fallback, path mapping, dictionary completeness, no Traditional
characters, `/en` `/zh` shells and `<html lang>`, alias and login redirects, unknown prefix).
Updated `home.test.tsx` (hash targets from the new IA) and `landing.test.tsx` (navigation
reaches `/features`). Routes, login, prototype gating and warehouse privacy tests are unchanged
and green.

### Live QA — dev server, in-app Chromium, emulated viewports

| Viewport | Overflow | Header | Notes |
| --- | --- | --- | --- |
| 320×568 | 0 | logo + menu | banner 353 px tall, dock hidden until decision; contact sheet 12–308 px wide, top at 115 px; footer clear of dock |
| 390×844 | 0 | logo + menu | mobile menu: focus on close, scroll lock, 8 rows, groups expand, language → `/en` releases lock |
| 768×1024 | 0 | logo · TH · เข้าสู่ระบบ · menu | footer two-column; dock and banner apart |
| 1024×768 | 0 | same as tablet | |
| 1280×720 | 0 | full nav, 34 px clearance each side | all six panels ≤ 411 px tall; hover, click, Escape, keyboard |
| 1366×768 | 0 | 54 px clearance | |
| 1440×900 | 0 | 54 px clearance | |
| 1920×1080 | 0 | 68 px clearance, full logo | |

Also verified live: Accept All / Reject / save from preferences persist the exact record; focus
goes to `<main>` after the banner closes; preferences reopen from the footer reflecting stored
choices and return focus; contact panel focus/Escape and exact `tel:` / LINE / `mailto:` /
`/contact` hrefs; `/pricing#plan-business` lands below the header; `/zh` renders Han glyphs with
the zh font stack; `/app/warehouse` still redirects to `/login?next=…`; zero console warnings or
errors (after adding a hydrate fallback for the lazy locale routes).

Reduced motion was verified by tests (instant back-to-top) and by the existing global CSS /
`MotionConfig` rules; the in-app browser cannot emulate the OS setting.

### Bundle

| Chunk | EP04 | EP05 | Δ |
| --- | --- | --- | --- |
| `index` JS (gzip) | 234.5 KB | 245.1 KB | +10.5 KB |
| `index` CSS (gzip) | 28.2 KB | 30.0 KB | +1.7 KB |
| `en` dictionary (lazy, `/en` only) | — | 3.4 KB | |
| `zh-CN` dictionary (lazy, `/zh` only) | — | 3.9 KB | |

The increase covers header/mega/mobile rewrite, footer, cookie banner + dialog, utility dock, the
Thai dictionary and the locale layer. No dependencies were added; `CoreWorld` is unchanged. The
`index` chunk's 500 KB advisory warning is pre-existing.

### UTF-8 / text

34 new or changed text files: valid UTF-8, no BOM, no CR, no U+FFFD, no mojibake, no orphan Thai
combining marks. Thai renders with correct tone marks; zh-CN copy contains no Traditional forms
(test-enforced).

### Content facts

Address `186/42 หมู่ 6 ต.ทวีวัฒนา อ.ไทรน้อย จ.นนทบุรี 11110` everywhere; no outdated address
existed in the repository (only `Asia/Bangkok` timezone and a fictional demo supplier name in
backend fixtures, which are not addresses). No S2 Accounting reference. No fake clients, uptime,
certifications, counts, awards or legal-compliance claims.

## Fixed during QA

- Hover-open followed by a click closed the mega menu → 450 ms hover-click grace.
- Floating contact button covered the hero's department selector at 1280×720 → dock hidden over
  the homepage hero.
- Dock covered the footer's การตั้งค่าคุกกี้ at page bottom → right/bottom clearance on the
  legal bar.
- Focus fell to `<body>` after the banner closed (exit animation outlived the check) → focus
  moves to `<main>` while the banner is still mounted.
- Thai labels with Latin letter-spacing looked broken (ภ า ษ า) → tracking removed from Thai.
- Footer network curves became stray diagonals on phones → geometry from 768 px only.
- Banner took ~70 % of a 320×568 screen → tighter copy and padding.
- Mega/language panels let page text ghost through → near-opaque surfaces.
- `HydrateFallback` warning on direct `/en` loads → quiet fallback element.

## Known limitations

- Page bodies are not translated; `/en` and `/zh` render Thai content inside a localized shell.
  No `hreflang` alternates in `<head>` and no per-locale `<title>`/description yet — add them
  with the content localization (until then consider `noindex` for `/en` and `/zh` at deploy).
- Planned capabilities (Security & Access, API & Integration) and a security page have no
  destination yet and are not linked.
- Legal pages (`/privacy`, `/terms`) are still placeholders from EP00; their text does not yet
  describe the consent record.
- Contact form still validates client-side only (backend submission out of scope).
- Live QA used the in-app Chromium with emulated viewports; real iOS Safari / Android and OS
  reduced-motion were not exercised on devices.
- `PRIMARY_PHONE` (Office) is the single number in "call us" actions; the other two numbers
  appear in the footer and on `/contact`.
