# Accessibility and responsive baseline (EP19)

EP19 hardens the public CORE experience for keyboard, assistive-technology semantics, enlarged
content and narrow or short viewports. This is an engineering baseline, not a formal WCAG
certification.

## Supported public experience

- One visible H1 and one main landmark on every public page, sign-in page and localized 404.
- A skip link is first in the tab order on the public shell and on `/login`.
- Header, mega menus, language selector, mobile navigation, cookie preferences and the floating
  contact panel expose names, state and focus return. Escape closes temporary overlays.
- EP21: closing Cookie Settings without a choice returns focus to the control that opened it
  (the banner's Settings button, re-found after the banner re-mounts, or the footer button). The
  language button's accessible name starts with its visible code (`TH, ภาษา: ภาษาไทย`) so
  speech input and automated checks match it (WCAG 2.5.3). Mega-menu panels follow their
  trigger in the Tab order (see [GLOBAL_NAVIGATION.md](GLOBAL_NAVIGATION.md)).
- Focus uses a visible `:focus-visible` indicator. Controls remain at least 44 CSS pixels where
  they are primary touch actions, and public pill buttons may wrap and grow instead of clipping.
- Contact uses fieldsets and legends, focuses each new question, focuses the first invalid field,
  and is explicit that preparing a message does not submit it.
- Login keeps real labels, autocomplete tokens, keyboard submit, a single show/hide announcement,
  Caps Lock feedback and the prototype-only `user1/pass1` behavior.
- Selected, waiting and future states use labels, icons, borders or line styles in addition to
  color. Readable content is not de-emphasized by reducing the opacity of the whole block.

## Tables and horizontal content

Public tables use named column headers and row headers where applicable. Warehouse and Purchasing
tables that overflow at narrow widths become focusable named regions only while they actually
overflow. This avoids an unnecessary desktop tab stop while allowing keyboard users to use arrow
keys on the scroll container. At 320 CSS pixels the two Warehouse regions and the Purchasing
region were verified with `role="region"`, `tabindex="0"` and a real `aria-labelledby` target.

The Warehouse privacy guide uses a named header for its view column. Pricing, Security and guide
tables switch to their responsive representations where the page design calls for it. No public
table has an empty column header or a data cell in `<thead>`.

## Anchors and the fixed header

Hash targets carry an 80px scroll margin. The shell retries while lazy content mounts, then aligns
again after React Router scroll restoration settles. Direct checks covered Solutions approval,
How CORE Works approval, the Resource library and Pricing configuration; every target landed below
the fixed header. Locale switching preserves query strings and hashes.

## Motion

`prefers-reduced-motion: reduce` is honored through the global Framer Motion configuration, the
CSS reduced-motion rule and feature-specific final states. Browser emulation covered the homepage
CORE World and chapters, global reveals, menus and overlays, Pricing, How CORE Works, Solutions,
Contact, Demo, Security, Resources and Login. No long-running or infinite animation remained in
the nine-route reduced-motion scan.

The two EP18.1 animation defects are closed: Why CORE transitions the individual `translate`
property, and CORE World labels transition the individual `scale` property. Their visual design is
unchanged.

## Responsive behavior

The automated sweep covered widths 320, 360, 375, 390, 412, 430, 480, 640, 768, 820, 1024, 1180,
1280, 1366, 1440, 1536, 1600 and 1920 CSS pixels across 24 representative route families (432
combinations). Heights included 667, 720, 800 and 900; focused short-height checks used 1366×768,
1440×800, 390×667 and 667×390.

No combination produced page-level horizontal overflow, duplicate IDs, unresolved SVG URL
references, missing H1/main landmarks or empty table headers. Mobile navigation was opened by
keyboard at 320, 375, 390, 430 and 768 pixels. Its main navigation region scrolls in portrait and
landscape while Contact, Login and Language remain reachable.

Automated layout-equivalent zoom coverage used a 1440px desktop reference viewport reduced to
1152px (125%), 960px (150%) and 720px (200%). A separate 200% root-font enlargement pass covered
Homepage, Pricing, Contact, Resources, Security and Login. These are emulations, not manual browser
zoom-control tests.

## Browser and accessibility coverage

| Surface | Coverage |
| --- | --- |
| Chrome 156 | Installed browser, automated headless coverage |
| Edge 156 | Installed browser, automated headless coverage |
| Firefox 142 | Temporary Playwright Firefox outside repository dependencies |
| axe | 37-route Chrome pass plus nine representative routes in all three engines; zero final violations |
| Forced colors | Playwright `forcedColors: active` emulation on nine representative routes |
| Keyboard | Automated keyboard journeys and focus-visible sweeps in Chrome |
| Screen-reader semantics | Automated roles, names, states, landmarks and accessibility-rule checks |
| Narrator | Not tested; spoken output could not be observed in this agent environment |
| NVDA | Not installed; not tested |
| Safari | Not available on this Windows machine; not tested |
| Real phone/tablet | Not tested; responsive checks used desktop-browser emulation |

## Regression checks

EP19 keeps EP17 static SEO and the 105 localized indexable heads, EP18 navigation and route
discoverability, EP18.1 overlay behavior, the Warehouse financial-data boundary, approved Pricing
amounts and prototype authentication behavior. Temporary browser and audit harnesses live under
`D:\Temp\ep19-qa`; none are repository dependencies or committed project tooling.
