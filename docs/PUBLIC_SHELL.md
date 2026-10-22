# Public Shell — PDA BLISS CORE (EP05)

The public shell is the frame every public page renders inside: header and mega menus, mobile
navigation, footer, cookie consent and the floating utility dock. It lives in
`frontend/src/components/layout/PublicLayout.tsx` and is mounted once per locale by the router.
**Pages never build their own navigation, footer or contact widgets** — new public pages are
added as children of the public routes and inherit the whole shell.

```
PublicLayout (locale)
└── LocaleProvider ─ CookieConsent (context + banner + preferences dialog)
    ├── skip link → #main
    ├── PublicHeader ─ DesktopNav + MegaPanel · LanguageSelector · MobileMenu
    ├── <main id="main" tabIndex={-1}>  ← page
    ├── PublicFooter ─ ContactDetails
    └── UtilityDock ─ back-to-top · contact panel
```

| Concern | Source of truth |
| --- | --- |
| Information architecture (ids, destinations, icons) | `src/config/navigation.ts` |
| Every visible shell word | `src/i18n/messages/{th,en,zh-CN}.ts` (typed by `src/i18n/types.ts`) |
| Locales and URL mapping | `src/i18n/locales.ts` |
| Company contact details, LINE URL | `src/config/contact.ts` |
| Cookie consent record | `src/features/consent/consent.ts` |
| Nav breakpoint | `--breakpoint-nav` in `styles/index.css` + `NAV_DESKTOP_QUERY` |

## Header information architecture

Thai is the default experience. Top level, in this order:

| Label | Behaviour |
| --- | --- |
| ภาพรวม | direct link → `/` |
| แผนก | mega menu |
| แพ็คเกจ | mega menu |
| วิธีการทำงาน | mega menu |
| โซลูชัน | mega menu |
| สำหรับองค์กร | mega menu |
| เกี่ยวกับเรา | mega menu |
| ติดต่อเรา | direct link → `/contact` |

Right side: language selector (globe + `TH` / `EN` / `中文`) and **เข้าสู่ระบบ** (→ `/login`,
never locale-prefixed). English labels (Product, Departments, Industries…) are not used on the
Thai experience; small English overlines (*Department Experience*, *Connected Workflow*,
*Enterprise*) appear only as secondary labels inside panels.

**States.** At the top of a page the header is near-transparent with a faint top-down shade for
legibility. After scrolling (IntersectionObserver sentinel, no scroll listener) or while a mega
menu is open it becomes smoked dark glass: `rgb(5 11 18 / 0.74)`, `backdrop-blur-lg`, hairline
border, controlled shadow. Height stays 72 px.

**Fit.** Labels are 15 px (`text-[0.9375rem]`) at every desktop width — overflow is never solved
by shrinking type. Measured clearances: 1280 → 34 px on each side of the nav; 1366 → 54 px;
1440 → 54 px; 1920 → 68 px (with the full logo subtitle from 1680 px).

## Mega menus

`DesktopNav.tsx` (behaviour) + `MegaPanel.tsx` (content). Each panel is an editorial layer, not a
list of links:

1. **Intro** — English overline, Thai heading (intentional line breaks via `\n`), one paragraph,
   optional honesty note (e.g. *โครงสร้างแพ็คเกจตัวอย่าง · ราคาอยู่ระหว่างกำหนด*).
2. **Items** — two-column grid; icon tile, label, description; arrow reveal on hover/focus.
3. **Highlight panel** — overline, statement, optional body, call to action; faint CORE orbit
   geometry and a radial emerald light.

| Menu | Items → destination | Highlight CTA |
| --- | --- | --- |
| แผนก | ผู้บริหาร, ฝ่ายขาย, ฝ่ายปฏิบัติการ, คลังสินค้า, จัดซื้อ, บัญชีและการเงิน → `/departments#<id>` | สำรวจทุกแผนก → `/departments` |
| แพ็คเกจ | Starter, Business, Professional, Enterprise → `/pricing#plan-<id>` (no prices) | ขอคำปรึกษา → `/contact` |
| วิธีการทำงาน | CORE ทำงานอย่างไร `/#why-core` · การทำงานข้ามแผนก `/#connected-flow` · Workflow และ Approval `/features` · การติดตามสถานะ `/#executive` · Human Error Prevention `/#error-control` | ดูวิธีการทำงาน → `/#connected-flow` |
| โซลูชัน | ลด Human Error `/#error-control` · เชื่อมการทำงานหลายแผนก `/#department-worlds` · Workflow & Approval `/#connected-flow` · Stock & Expiry Control `/departments#warehouse` · Operational Visibility `/#executive` · Management Control `/departments#executive` | ดูตัวอย่างการใช้งาน → `/solutions` |
| สำหรับองค์กร | สำหรับองค์กรขนาดใหญ่ `/#enterprise` · **Security & Access** (planned) · Audit & Control `/#error-control` · Custom Workflow `/#connected-flow` · **API & Integration** (planned) · Implementation & Support `/contact` | พูดคุยกับทีม PDA BLISS → `/contact` |
| เกี่ยวกับเรา | PDA BLISS `/about` · ทำไมเราถึงสร้าง CORE `/#trust` · แนวทางการพัฒนาระบบ `/about#approach` · ที่ปรึกษา `/contact` | ติดต่อทีมงาน → `/contact` |

**No dead links.** Every destination is a live route or an existing anchor (`plan-*` on
`/pricing` and `approach` on `/about` were added as plain ids). An item without `to` renders as
information with an *อยู่ในแผนพัฒนา* tag — never a link to an unfinished page. The สำหรับองค์กร
panel also says *บางความสามารถอยู่ในแผนพัฒนา*. Tests enforce both rules.

**Behaviour.** Disclosure pattern — each mega item is a `button` with `aria-expanded` /
`aria-controls` controlling a `region` of ordinary links (no ARIA menu roles). Hover intent:
90 ms open, 180 ms close; a click within 450 ms of a hover-open keeps the panel open instead of
toggling it shut. Keyboard: ←/→ move along all eight items (wrapping), ↓ opens a panel and
focuses its first link, Escape closes and returns focus to the trigger, tabbing out or clicking
outside closes, navigating closes. The panel is near-opaque (`/0.99`) so the page never ghosts
through.

## Mobile and tablet navigation (< 1280 px)

`MobileMenu.tsx` — a dedicated full-screen layer, not a compressed mega menu.

- Own top bar (logo + close button) so focus can stay trapped inside the dialog.
- `role="dialog"`, `aria-modal`, focus starts on **ปิดเมนู**, Tab/Shift+Tab wrap, Escape closes,
  focus returns to the hamburger, body scroll locked.
- Eight rows in IA order, ≥ 64 px tall; mega groups expand into intro, items (≥ 56 px targets),
  planned tags and the highlight CTA.
- Language as a three-way segmented control; ติดต่อเรา and เข้าสู่ระบบ pinned at the bottom
  within thumb reach (safe-area aware).
- Closes on navigation, and automatically when the viewport grows past the nav breakpoint.

Between 640 and 1279 px the header shows logo · language · เข้าสู่ระบบ · menu; below 640 px
logo · menu (language lives in the menu).

## Localization

**Locales.** `th` (default) · `en` · `zh-CN`, displayed as ภาษาไทย · English · 简体中文.
Simplified Chinese only; Traditional variants resolve to Thai.

**URL strategy (SEO-ready).**

| Locale | Prefix | Example |
| --- | --- | --- |
| th | none | `/`, `/departments` |
| en | `/en` | `/en`, `/en/departments` |
| zh-CN | `/zh` | `/zh`, `/zh/departments` |

Aliases redirect to the canonical URL: `/th/*` → unprefixed, `/zh-CN/*` and `/zh-hans/*` →
`/zh/*`. `/en/login` and `/zh/login` redirect to `/login`. Unknown prefixes (`/fr/...`) fall
through to the Thai 404. No browser-language sniffing or auto-redirects: a URL always renders
the same language. Existing URLs are unchanged.

**Architecture.**

- `config/navigation.ts` holds structure only (ids, `to`, icons); `messages/*` hold every word,
  keyed by those ids. `ShellMessages` (in `types.ts`) types all three dictionaries, so a missing
  string is a compile error; a test also checks every nav item has text in every locale.
- `LocaleProvider` exposes `useLocale()` → `{ locale, t, href }`; `href()` localizes internal
  paths (`/departments#sales` → `/en/departments#sales`) and leaves `/login`, `/app/*` and
  external URLs alone.
- The language selector links to the same page in the other locale (`switchLocalePath`), with
  `lang` and `hreflang` on each option.
- Thai ships in the main bundle. English and Chinese dictionaries are separate chunks loaded by
  the route's `lazy()` before it renders (no Thai flash); Thai visitors never download them.
- `<html lang>` follows the shell locale; leaving the public site restores `th`. Because page
  bodies are still Thai, `<main>` carries `lang="th"` under `/en` and `/zh`.

**Scope in EP05.** Header, mega menus, mobile navigation, footer, cookie banner and preferences,
floating contact and utility labels are complete in all three languages. Page bodies are **not**
translated yet (they render in Thai under `/en` and `/zh`, and the language menu says so).

**Typography.** IBM Plex Sans Thai covers Thai and Latin only. `:lang(zh-CN)` switches to
`--font-zh`: Plex for Latin, then PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC /
CJK SC, Source Han Sans SC — Simplified faces listed explicitly so browsers never substitute a
Japanese or Traditional variant. The selector's 简体中文 option carries `lang="zh-CN"` on every
locale. Thai labels never use wide letter-spacing (tracking is for Latin overlines only).

## Footer

`PublicFooter.tsx` — a calm ending (effect intensity ≈ 2/10): obsidian `surface-dark`, a single
emerald hairline on top, a faint radial light, two restrained network curves and a whisper of
CORE orbit (desktop/tablet only; phones keep just the glow).

| Column | Content |
| --- | --- |
| 1 — Brand | Logo, *by PDA BLISS*, *Department Operations Platform สำหรับองค์กร* + one sentence, quick contact chips (โทร · LINE · Email), *พัฒนาโดย PDA BLISS COMPANY LIMITED* |
| 2 — ลิงก์ด่วน | ภาพรวม · แผนก · แพ็คเกจ · วิธีการทำงาน (visually lighter) |
| 3 — องค์กร | โซลูชัน · สำหรับองค์กร · เกี่ยวกับเรา · ติดต่อเรา (visually lighter) |
| 4 — ติดต่อเรา | `ContactDetails`: address, three phone numbers with labels, email, LINE |

Legal bar: *© 2026 PDA BLISS COMPANY LIMITED. All rights reserved.* · นโยบายความเป็นส่วนตัว
(`/privacy`) · ข้อกำหนดการใช้งาน (`/terms`) · **การตั้งค่าคุกกี้** (button, reopens Cookie
Preferences). A security page does not exist yet, so it is not linked. The bar reserves right
and bottom clearance so the floating dock never covers its links.

Layout: four columns from 1024 px; two columns (brand and contact full width) from 768 px; one
column on phones.

## Contact configuration and LINE

`src/config/contact.ts` exports `CONTACT` (company, address, phones, email, `lineId`,
`lineUrl`), `PRIMARY_PHONE` and the `telHref()` / `mailtoHref()` helpers.

| Field | Value |
| --- | --- |
| Address | 186/42 หมู่ 6 ต.ทวีวัฒนา อ.ไทรน้อย จ.นนทบุรี 11110 (printed in Thai in every locale, `lang="th"`) |
| Phones | 064-924-5544 (Office) · 090-662-5464 (คุณผึ้ง) · 063-869-3614 (คุณอิน) — `tel:+66…` |
| Email | pdablissoffice@gmail.com — `mailto:` |
| LINE | @593oiwec — `https://line.me/R/ti/p/@593oiwec` |

Every LINE link on the public site — footer chip, footer details, contact page, floating panel,
and any future CTA — uses `CONTACT.lineUrl`, opens in a new tab with
`rel="noopener noreferrer"`, and announces *(เปิดในแท็บใหม่)*. LINE itself decides what happens:
on desktop it shows its add-friend / QR page, on phones the OS hands the link to the LINE app.
There is no custom QR page. A test scans every non-test source file and fails if a contact value
appears outside `config/contact.ts`.

## Cookie consent

`features/consent/` — `consent.ts` (store), `CookieConsent.tsx` (banner + dialog + context),
`useCookieSettings()` (open the dialog from anywhere).

**Honesty.** The site sets no analytics, preference or marketing cookies today. The banner says
so (*ขณะนี้เว็บไซต์ยังไม่ได้ใช้คุกกี้วิเคราะห์หรือคุกกี้การตลาด*) and each optional category in the
dialog is tagged *ยังไม่ได้ใช้งานบนเว็บไซต์นี้*. `IN_USE` in `CookieConsent.tsx` must be flipped in
the same change that introduces a tool, and that tool must check the stored consent first. No
legal-compliance claims are made.

**Banner.** Non-blocking `region`, smoked glass with an emerald edge light; bottom-left card
(max 34 rem) from 640 px, full-width bottom card on phones. Buttons: **ยอมรับทั้งหมด** ·
**ปฏิเสธคุกกี้ที่ไม่จำเป็น** (same size and weight — no dark patterns) · ตั้งค่าคุกกี้. Link to
`/privacy`. Soft enter after 0.5 s, soft exit.

**Cookie Preferences.** Modal dialog (`aria-modal`, focus trap starting on the close button,
Escape, scroll lock), centred on desktop, bottom sheet on phones. Categories: คุกกี้ที่จำเป็น
(Essential, switch disabled and checked, *เปิดใช้งานเสมอ*), คุกกี้วิเคราะห์การใช้งาน (Analytics),
คุกกี้เพื่อประสบการณ์การใช้งาน (Preferences), คุกกี้การตลาด (Marketing). Switches are
`role="switch"` with a check glyph when on, labelled and described by their row. Actions:
ปฏิเสธคุกกี้ที่ไม่จำเป็น · ยอมรับทั้งหมด · บันทึกการตั้งค่า. Reopen any time from the footer.

**Record** (`localStorage['pdabliss-core:cookie-consent']`, never sent anywhere):

```json
{ "version": 1, "essential": true, "analytics": false, "preferences": false,
  "marketing": false, "updatedAt": "2026-10-22T15:58:06.298Z" }
```

A missing, malformed or older-version record shows the banner again. If storage is blocked the
choice holds for the page view. Changes sync across tabs (`storage` event). After a decision,
focus moves to `<main>` (never lost to `<body>`) and a polite status announces
*บันทึกการตั้งค่าคุกกี้แล้ว*.

## Floating utility dock

`UtilityDock.tsx` — bottom-right, `role="group"` *เครื่องมือด่วน*.

- **Back to top** (44 px, dark glass, emerald outer ring): hidden until ~one screen of scroll
  (`max(560 px, 0.9 × viewport)`); smooth scroll, or an instant jump under
  `prefers-reduced-motion`; focus moves to `<main>` because the button hides at the top. Fade +
  slight scale, no bounce.
- **Contact** (48 px, chat icon → ✕): opens a stack, never navigates by itself. States closed →
  opening → open → closing via `AnimatePresence`. Stack: *ติดต่อทีม PDA BLISS* header, then
  โทรหาเรา (064-924-5544 (Office), `tel:`), LINE OA (@593oiwec, `CONTACT.lineUrl`), ส่งอีเมล
  (`mailto:`), ขอรับคำปรึกษา (→ `/contact`, closes the stack). Items reveal upward with a 45 ms
  stagger; closing is a fast fade. Dark emerald icon tiles, faint orbit geometry.
- Accessibility: trigger has `aria-expanded` / `aria-controls` and a state-specific name; on open
  focus moves to the first action; Escape closes and returns focus to the trigger; outside click
  or tabbing out closes.
- Phones (< 640 px): the stack becomes a full-width sheet above the trigger (inset 12 px, safe-area
  aware) with a dim scrim; verified inside 320 × 568.
- On the homepage the whole dock stays hidden while the CORE hero is in view (until 45 % of a
  viewport has scrolled), so it never covers the hero's department selector.

## Layering (z-index)

| z | Layer | Notes |
| --- | --- | --- |
| 30 | Homepage chapter indicator | ≥ 1536 px, middle-right |
| 40 | Utility dock + contact stack + its scrim | bottom-right |
| 50 | Header (mega menus and language popover live inside it) | top |
| 60 | Cookie banner | bottom-left / bottom full width on phones |
| 70 | Mobile navigation | full screen, covers everything below |
| 80 | Cookie Preferences dialog | modal, top-most interactive layer |
| 90 | Skip link (when focused) | |

Collision rules: on phones (< 768 px) the dock is hidden while the cookie banner awaits a
decision; from 768 px the banner (left, ≤ 34 rem) and the dock (right) never overlap. The dock
hides over the homepage hero. The footer legal bar reserves space for the dock. The mobile menu
covers banner and dock; the preferences dialog sits above all.

## Motion

All values come from `motion/tokens.ts`; `MotionConfig reducedMotion="user"` plus the global CSS
reduced-motion block apply.

| Element | Motion |
| --- | --- |
| Header | 500 ms colour/blur transition between states |
| Mega menu | 200 ms fade + 6 px rise; content cross-fade when switching groups |
| Mobile menu | 200 ms fade; rows 25 ms stagger; groups expand by height |
| Cookie banner | 0.5 s delay, 400 ms rise; 200 ms exit |
| Cookie dialog | 200 ms backdrop fade, 400 ms rise |
| Contact stack | 400 ms rise, 45 ms upward stagger; 120 ms exit |
| Back to top | 200 ms fade + scale 0.85 → 1 |

No elastic or bounce easing anywhere. No new WebGL.

## Accessibility checklist

Skip link; one `nav` per menu with a localized name; disclosure buttons with `aria-expanded` /
`aria-controls`; links stay links; visible `:focus-visible` ring everywhere; focus trap +
restore for mobile menu and cookie dialog; focus management for the contact stack and
dismissed banner; Escape closes every overlay; status text accompanies colour (planned tag,
in-use chips, switch glyphs); touch targets ≥ 44 px (footer text links ≥ 36 px tall in a
spaced list); `lang` on locale options, the Thai address and `<main>`.

## Adding a public page

1. Create the page under `src/pages/public/` and add it to `publicPages()` in `app/router.tsx`
   — it is served at `/<path>`, `/en/<path>` and `/zh/<path>` automatically, inside the shell.
2. Link to it from `config/navigation.ts` (structure) and add its labels to all three
   dictionaries; replace any informational item with a real `to` only once the page exists.
3. Never add a header, footer, contact widget or LINE URL inside the page.
