# Public Shell — PDA BLISS CORE (EP05, revised)

> **EP05 revision (2026-10-23):** the whole public site now switches language (page bodies
> included), the public contact shows a single phone number, mega menus carry visual support,
> and the CORE World shows department imagery. See [EP05_REVISION_REPORT.md](EP05_REVISION_REPORT.md).

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

## Header information architecture (EP18)

The full structure, with before/after, is in [GLOBAL_NAVIGATION.md](GLOBAL_NAVIGATION.md).
Thai is the default experience. Top level, in this order:

| Label | Behaviour |
| --- | --- |
| ภาพรวม | direct link → `/` |
| ผลิตภัณฑ์ | menu — what CORE is and how to use it (how it works, departments, demo, packages; the six departments) |
| โซลูชัน | menu — where CORE fits (problems, industries, for organizations; the six industries) |
| ความรู้ | menu — the Resource Center and its seven guides |
| เกี่ยวกับเรา | menu — PDA BLISS, why CORE, Security & Trust, approach |

**Right side:**

- Language selector (globe + `TH` / `EN` / `中文`).
- **ติดต่อเรา** as the primary pill (→ `/contact`, locale kept; from 768 px).
- **เข้าสู่ระบบ** (→ `/login`, never locale-prefixed), always with its label. EP18 removed the
  1280–1535 px icon-only state.

The menu that holds the current page is marked with `aria-current` and a quiet dot.

**States.**

- At the top of a page the header is near-transparent with a faint top-down shade.
- After scrolling, or while a menu is open, it becomes an 86 % obsidian surface with
  `backdrop-blur-md`, a hairline border and a soft shadow. EP18 reduced the glass and dropped the
  saturation boost.
- Height stays 72 px.

**Fit.**

- Labels are 15 px at every desktop width, with 14 px item padding (16 px from 1536 px).
- Measured spare space between the bar and the actions (TH / EN / ZH):
  - 1280 → 109 / 107 / 146 px
  - 1440 → 136 / 135 / 173 px
  - 1536–1920 → 173 / 172 / 210 px
- The full logo subtitle shows from 1536 px.

## Menus

`DesktopNav.tsx` (behaviour), `MegaPanel.tsx` (content) and `MegaVisuals.tsx` (one decorative
visual per menu).

**Panel.** Each panel has three parts: intro | sections | featured destination.

- **Feature rows:** icon tile, label and one line.
- **Index rows:** name-only links on a hairline.
- **Featured panel:** a visual, statement and one call to action.

No panel shows more than 12 links (tested; the most today is 11).

**No dead links.** Every destination is a live route or an existing anchor, and tests enforce
it. There are no informational (non-link) items any more.

**Behaviour.** Disclosure pattern:

- Each menu trigger is a `button` with `aria-expanded` / `aria-controls` controlling a `region`
  of ordinary links (no ARIA menu roles).
- Hover intent: 90 ms open, 180 ms close.
- Keyboard:
  - ←/→ move along the five items (wrapping)
  - ↓ opens a menu and focuses its first link
  - Escape closes and returns focus
- Tabbing out, clicking outside or navigating closes the menu.
- Panels use fully opaque surfaces.

**Shared overlay language (EP18.1).** Menus, the language list, mobile groups, the utility dock
panel and every FAQ/disclosure use `components/ui/overlay.ts` (`overlaySurface`,
`overlayRow`, `overlayLabel`, `overlayChip`, `disclosureItem`, `disclosureTrigger`) and
`components/ui/DisclosureIcon.tsx`. New overlays and disclosures should use them rather than
restyling locally. Rows mark the current page with `aria-current="page"`.

**Language selector (EP18.1).**

- The trigger is an outlined pill that turns emerald-edged while open.
- The list is an `overlaySurface`. Each row shows a decorative code badge (TH / EN / 中文), the
  language's own name, and a check on the current one (`aria-current`). The badge is
  `aria-hidden`, so link names stay the native names.
- Query and hash are kept when switching (EP17).

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

Between 768 and 1279 px the header shows logo · language · ติดต่อเรา · เข้าสู่ระบบ · menu; between
640 and 767 px logo · language · เข้าสู่ระบบ · menu; below 640 px logo · menu (language, contact
and sign-in live in the menu). Since EP16 the menu's rows are ภาพรวม plus seven groups — ติดต่อเรา
stays pinned at the bottom beside เข้าสู่ระบบ. EP18: five rows (ภาพรวม + four groups); a group
expands into titled sections — feature rows, then index chips — and its featured link.

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
`/zh/*`. `/en/login` and `/zh/login` redirect to `/login`, carrying the locale in router state
(EP15). Unknown prefixes (`/fr/...`) fall
through to the Thai 404. No browser-language sniffing or auto-redirects: a URL always renders
the same language. Existing URLs are unchanged.

**Architecture.**

- `config/navigation.ts` holds structure only (ids, `to`, icons); `messages/*` hold every word,
  keyed by those ids. `ShellMessages` (in `types.ts`) types all three dictionaries, so a missing
  string is a compile error; a test also checks every nav item has text in every locale.
- `LocaleProvider` exposes `useLocale()` → `{ locale, t, href }`; `href()` localizes internal
  paths (`/departments/sales` → `/en/departments/sales`) and leaves `/login`, `/app/*` and
  external URLs alone.
- The language selector links to the same page in the other locale (`switchLocalePath`), with
  `lang` and `hreflang` on each option.
- Shell dictionaries: Thai ships in the main bundle; English and Chinese are separate chunks
  loaded by the route's `lazy()` before it renders (no Thai flash).
- **Page content (EP05 revision)** lives next to the component that renders it, as a
  `Localized<T>` object (`{ th, en, 'zh-CN' }`) typed from the Thai source, read with
  `useCopy()` (`src/i18n/useCopy.ts`). A missing English or Chinese string is a compile error.
  Shared data modules expose locale-aware hooks with stable references per locale:
  `useDepartments()` / `useDepartment()` (`config/departments.ts`), `useWorlds()`,
  `useFlows()`, `usePlans()`, `useSafeguards()`. Page titles/descriptions are localized through
  `usePageMeta`; in-page links go through `href()` so visitors stay in their language.
- `<html lang>` follows the locale; leaving the public site restores `th`.

**Scope.** The whole public site switches language: header, mega menus, mobile navigation,
footer, cookie UI, floating contact, the homepage (hero, all eleven chapters, CTAs, labels),
the CORE World cards and detail, and `/departments`, `/features`, `/solutions`, `/how-core-works`,
`/enterprise`, `/industries` and its six pages, `/pricing`,
`/about`, `/why-core`, `/contact` (the EP13 consultation flow, including validation), `/demo` (the EP14
interactive demo — every label, guidance line, handoff and history row), `/privacy`, `/terms` and the 404 page.

**Security & Trust (EP15).** `/security` (`/en/security`, `/zh/security`) is in
`test/publicRoutes.ts` and `sitemap.xml` (81 URLs). It is linked from the สำหรับองค์กร mega menu
("Security & Trust"), the footer's องค์กร group ("ความปลอดภัย" / Security / 安全) and the sign-in
page. There is no new top-level header item. See
[SECURITY_TRUST_CENTER.md](SECURITY_TRUST_CENTER.md).

**Resources (EP16).** `/resources` and seven guides (`/resources/<slug>`, × th / en / zh) are in
`test/publicRoutes.ts` and `sitemap.xml` (105 URLs). They are reached from the new ความรู้ mega
menu and the footer's ลิงก์ด่วน group. See [RESOURCES_EXPERIENCE.md](RESOURCES_EXPERIENCE.md).

**Sign-in (EP15).** `/login` now renders outside the public header and footer: the CORE Gateway
has its own focused chrome (logo plus "กลับหน้าเว็บไซต์" to the locale's homepage). The header's
**เข้าสู่ระบบ** action still goes to `/login`. It is `noindex` and not in the sitemap. See
[LOGIN_EXPERIENCE.md](LOGIN_EXPERIENCE.md).

**Interactive demo (EP14).** `/demo` (`/en/demo`, `/zh/demo`) is a public route in
`test/publicRoutes.ts` and `sitemap.xml` (priority 0.7, hreflang). It renders its own `DemoShell`
inside the public layout — never the internal AppShell — and is linked from the วิธีการทำงาน menu,
the `/how-core-works` CTA, five department pages (`?role=`), `/solutions` and `/why-core`. See
[INTERACTIVE_DEMO.md](INTERACTIVE_DEMO.md).

**Wrapping buttons (EP14).** `buttonClasses()` drops its fixed height and `nowrap` when the
caller passes `whitespace-normal`, so long localized labels wrap on narrow screens instead of
clipping (`cn` does not merge conflicting utilities).

**Contact links (EP13).** Shell links (header, footer, floating panel) go to `/contact`; page
CTAs carry context through the stable query contract (`?interest=`, `?plan=`, `?industry=`,
`?department=`) — see [CONTACT_EXPERIENCE.md](CONTACT_EXPERIENCE.md). `href()` keeps the locale.
Deliberate exceptions: the company address is printed in Thai in every locale (`lang="th"`),
and the homepage product previews render the real EP02 product UI, which is Thai — their
captions say so. `/app/*` is not part of the public site and stays Thai. `/login` (EP15) stays one
unprefixed URL, but its gateway speaks the language the visitor came from (router state from the
header link or the `/en/login` and `/zh/login` redirects); a direct visit is Thai.
A test scans every page under `/en` and `/zh` and fails on visible Thai text (the page list is the
shared `test/publicRoutes.ts`, also used by the header and sitemap tests).

**Typography.** IBM Plex Sans Thai covers Thai and Latin only. `:lang(zh-CN)` switches to
`--font-zh`: Plex for Latin, then PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC /
CJK SC, Source Han Sans SC — Simplified faces listed explicitly so browsers never substitute a
Japanese or Traditional variant. The selector's 简体中文 option carries `lang="zh-CN"` on every
locale. Thai labels never use wide letter-spacing (tracking is for Latin overlines only).

## Footer

`PublicFooter.tsx` — a calm ending (effect intensity ≈ 2/10): obsidian `surface-dark`, a single
emerald hairline on top, a faint radial light, two restrained network curves and a whisper of
CORE orbit (desktop/tablet only; phones keep just the glow).

EP18 consolidated the footer into four zones (details in
[GLOBAL_NAVIGATION.md](GLOBAL_NAVIGATION.md)):

| Zone | Content |
| --- | --- |
| Brand | Logo (links home), *Department Operations Platform สำหรับองค์กร* + one sentence, *พัฒนาโดย PDA BLISS COMPANY LIMITED* |
| ผลิตภัณฑ์ | แผนก · วิธีการทำงาน · ทดลองใช้งาน CORE · แพ็คเกจ |
| สำรวจ | โซลูชัน · ประเภทธุรกิจ · สำหรับองค์กร · คลังความรู้ · เกี่ยวกับเรา |
| ติดต่อเรา | `ContactDetails compact`: address, one phone with its contact person, email, LINE OA; then "คุยกับทีม PDA BLISS" → `/contact` |

Removed in EP18:

- the call / LINE / email chips (they duplicated the contact zone)
- the network curves and orbit geometry
- ภาพรวม, ความปลอดภัย and the ติดต่อเรา text link — each has a better home in the header

On phones, Product and Explore sit side by side.

Legal bar: *© 2026 PDA BLISS COMPANY LIMITED. All rights reserved.* · นโยบายความเป็นส่วนตัว
(`/privacy`) · ข้อกำหนดการใช้งาน (`/terms`) · **การตั้งค่าคุกกี้** (button, reopens Cookie
Preferences). A security page does not exist yet, so it is not linked. The bar reserves right
and bottom clearance so the floating dock never covers its links.

Layout: four columns from 1024 px; two columns (brand and contact full width) from 768 px; one
column on phones.

## Contact configuration and LINE

`src/config/contact.ts` exports `CONTACT` (company, address, **one** `phone`, email, `lineId`,
`lineUrl`) and the `telHref()` / `mailtoHref()` helpers. The contact-person label for the phone
is localized (`contact.phoneLabel`: คุณวิน / Khun Win).

| Field | Value |
| --- | --- |
| Address | 186/42 หมู่ 6 ต.ทวีวัฒนา อ.ไทรน้อย จ.นนทบุรี 11110 (printed in Thai in every locale, `lang="th"`) |
| Phone | 063-869-3614 (คุณวิน) — `tel:+66638693614` · *the only public number (EP05 revision)* |
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

**Banner (compact since EP18).**

- **Container:** a non-blocking `region` with an emerald edge light. It is a bottom-left card
  (max 25 rem) from 640 px and a full-width bottom card on phones.
- **Text:** one sentence (*เราใช้เฉพาะคุกกี้ที่จำเป็นต่อการทำงานของเว็บไซต์
  คุกกี้ประเภทอื่นจะใช้เมื่อคุณอนุญาตเท่านั้น*), then the honesty note and the `/privacy` link
  inline.
- **Buttons:** **ยอมรับทั้งหมด** and **ปฏิเสธคุกกี้ที่ไม่จำเป็น** side by side, the same size and
  weight (no dark patterns). ตั้งค่าคุกกี้ is a quiet text button underneath.
- **What EP18 removed:** the icon tile and the glow. On a 390 px phone the banner now covers about
  a quarter of the screen instead of half.
- **Behaviour:** consent behaviour is unchanged. Soft enter after 0.5 s, soft exit.

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
  โทรหาเรา (063-869-3614 (คุณวิน), `tel:` — the same single number as the footer), LINE OA
  (@593oiwec, `CONTACT.lineUrl`), ส่งอีเมล
  (`mailto:`), ขอรับคำปรึกษา (→ `/contact`, closes the stack). Items reveal upward with a 45 ms
  stagger; closing is a fast fade. Dark emerald icon tiles, faint orbit geometry.
- Accessibility: trigger has `aria-expanded` / `aria-controls` and a state-specific name; on open
  focus moves to the first action; Escape closes and returns focus to the trigger; outside click
  or tabbing out closes.
- Phones (< 640 px): the stack becomes a full-width sheet above the trigger (inset 12 px, safe-area
  aware) with a dim scrim; verified inside 320 × 568.
- On the homepage the whole dock stays hidden while the CORE World section (scene, world cards
  and department selector) still covers the screen — until its bottom edge rises above 55 % of
  the viewport — so it never sits on the hero's controls.

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
in-use chips, switch glyphs); disclosure state shown by the icon's turn as well as its colour
(EP18.1); touch targets ≥ 44 px (footer text links ≥ 36 px tall in a
spaced list); `lang` on locale options, the Thai address and `<main>`.

EP19 adds the same skip-link contract to Login, includes each visible Logo/language token in its
accessible name, lets public pill buttons wrap at enlarged text, and aligns lazy hash targets only
after router scroll restoration settles. Mobile navigation was keyboard-opened at 320, 375, 390,
430 and 768 CSS pixels, including a 667×390 landscape viewport; its scrolling region kept
Language, Contact and Login reachable.

## SEO, 404 and language switching (EP17)

- **Metadata:** every page calls `usePageMeta(title, description)`. It sets the title,
  description, one self-referencing canonical, hreflang alternates (th / en / zh-CN / x-default)
  and Open Graph URL and locale. Sign-in and the 404 pass `{ index: false }` (`noindex`, no
  canonical).
- **Language selector:** keeps the query and hash (`/pricing?plan=business#packages` →
  `/en/pricing?plan=business#packages`).
- **404:** stays inside the shell, in the visitor's locale. It offers home, the Resource Center
  and contact.
- **Static head:** `npm run build` writes each public URL's head into its own HTML file
  (`en/pricing.html`…), so crawlers and link previews get the right page without JavaScript.
  The host must serve `404.html` (not `index.html`) for unknown paths.
- **More:** [SEO_LOCALIZATION.md](SEO_LOCALIZATION.md) and
  [PUBLIC_ROUTE_DISCOVERABILITY.md](PUBLIC_ROUTE_DISCOVERABILITY.md).

## Adding a public page

1. Create the page under `src/pages/public/` and add it to `publicPages()` in `app/router.tsx`
   — it is served at `/<path>`, `/en/<path>` and `/zh/<path>` automatically, inside the shell.
   Call `usePageMeta` with a unique localized title and description. Add the route to
   `test/publicRoutes.ts` and `sitemap.xml`, and give it a row with a real entry path in
   `test/discoverability.ts` (EP17).
2. Link to it from `config/navigation.ts` (structure) and add its labels to all three
   dictionaries; replace any informational item with a real `to` only once the page exists.
3. Never add a header, footer, contact widget or LINE URL inside the page.
