# Public Route Discoverability (EP17)

**Question for every public page:** how does a normal visitor reach it without typing the URL?

**Source of truth:** `frontend/src/test/discoverability.ts`, checked by
`frontend/src/test/discoverability.test.tsx`. This document is the readable version. When a route
is added to `test/publicRoutes.ts`, the test fails until it has a row here and a real entry in
the UI.

## Inventory

The inventory is derived from the router (`app/router.tsx`) and the shared route set
(`test/publicRoutes.ts`).

- **35 indexable public routes per locale:** Thai unprefixed, English under `/en`, Simplified
  Chinese under `/zh`. That is **105 localized URLs**, all in the sitemap.
- **`/login`:** one unprefixed sign-in route, `noindex`.
- **Not public:** `/app/*` (prototype workspaces behind the demo sign-in) and
  `/app/prototype/ui` (Design Lab). Both are excluded by robots.txt and never linked from public
  pages.

Every route exists in all three locales. The route-family check is the SEO test that renders all
105 and compares their canonicals and alternates.

## Method

1. **Render:** every public page is rendered (Thai), and every link in the site header, page body
   and footer is collected.
2. **Mega menus:** they are not rendered until opened, so their items come from
   `config/navigation.ts` (`shellLinkTargets()`) and count as available on every page.
3. **Walk:** the site is walked breadth-first from `/`. Every route must be reached (no orphans),
   no deeper than its declared depth.
4. **Declared entries:** each row's primary and secondary entry must really exist, as one of:
   - `header` — rendered in the site header
   - `mega` — the item or highlight CTA of that group in `MEGA_GROUPS`
   - `footer` — in `FOOTER_GROUPS` or the rendered legal bar
   - `page` — a rendered link in the body of the named page
5. **Single entry:** a route with only one entry must be one of the documented exceptions below.
6. **Link checks:**
   - every rendered link points at a real route (no empty, `#`, `javascript:`, `localhost` or
     `//` hrefs)
   - every `#anchor` exists on its target page, more than 20 contextual anchors in all
7. **Other locales:** a separate SEO test renders all `/en` and `/zh` pages and fails on any link
   that leaves the locale.

**Depth** counts page navigations from the homepage. Opening a mega menu is not a navigation, so a
mega-menu item is depth 1.

## Matrix

All rows have status **PASS**. There are no NEEDS LINK and no INTENTIONALLY INDIRECT routes.
Locale is preserved on every entry path, in every row.

| Route | Purpose | Primary entry | Secondary entry | Depth |
| --- | --- | --- | --- | --- |
| `/` | Homepage — CORE Universe | Header logo / ภาพรวม | Footer ลิงก์ด่วน | 0 |
| `/features` | Capability overview by department | Homepage final chapter → สำรวจ CORE เพิ่มเติม | — | 1 |
| `/departments` | Department philosophy | แผนก menu → สำรวจทุกแผนก | Footer ลิงก์ด่วน | 1 |
| `/departments/executive` | Executive | แผนก menu → ผู้บริหาร | `/departments` | 1 |
| `/departments/sales` | Sales | แผนก menu → ฝ่ายขาย | `/departments` | 1 |
| `/departments/operations` | Operations | แผนก menu → ฝ่ายปฏิบัติการ | `/departments` | 1 |
| `/departments/warehouse` | Warehouse | แผนก menu → คลังสินค้า | `/departments` | 1 |
| `/departments/purchasing` | Purchasing | แผนก menu → จัดซื้อ | `/departments` | 1 |
| `/departments/accounting` | Accounting & Finance | แผนก menu → บัญชีและการเงิน | `/departments` | 1 |
| `/solutions` | Problem-first solutions | โซลูชัน menu → any problem | Footer องค์กร | 1 |
| `/how-core-works` | One work item through the company | วิธีการทำงาน menu → CORE ทำงานอย่างไร | Footer ลิงก์ด่วน | 1 |
| `/enterprise` | For organizations | สำหรับองค์กร menu → สำหรับองค์กรขนาดใหญ่ | Footer องค์กร | 1 |
| `/industries` | Industry overview | โซลูชัน menu → ดูตามประเภทธุรกิจ | Footer องค์กร | 1 |
| `/industries/distribution` | Distribution / wholesale | `/industries` | `/enterprise` industries strip | 2 |
| `/industries/services` | Services | `/industries` | `/enterprise` industries strip | 2 |
| `/industries/projects` | Projects | `/industries` | `/enterprise` industries strip | 2 |
| `/industries/retail` | Retail | `/industries` | `/enterprise` industries strip | 2 |
| `/industries/property` | Property operations | `/industries` | `/enterprise` industries strip | 2 |
| `/industries/manufacturing` | Manufacturing | `/industries` | `/enterprise` industries strip | 2 |
| `/pricing` | Packages & subscription | แพ็คเกจ menu → Starter … Enterprise | Footer ลิงก์ด่วน | 1 |
| `/about` | PDA BLISS | เกี่ยวกับเรา menu → PDA BLISS | Footer องค์กร | 1 |
| `/why-core` | Why CORE exists | เกี่ยวกับเรา menu → ทำไมเราถึงสร้าง CORE | `/about` | 1 |
| `/contact` | Guided consultation | Header ติดต่อเรา action (mobile menu below 768 px) | Footer องค์กร + page CTAs | 1 |
| `/demo` | Interactive demo | วิธีการทำงาน menu → ทดลองใช้งาน CORE | `/how-core-works` CTA | 1 |
| `/security` | Security & Trust Center | สำหรับองค์กร menu → Security & Trust | Footer องค์กร | 1 |
| `/resources` | Resource Center | ความรู้ menu → เปิดคลังความรู้ | Footer ลิงก์ด่วน | 1 |
| `/resources/getting-started` | Guide | ความรู้ menu | `/resources` library | 1 |
| `/resources/how-core-works` | Guide | ความรู้ menu → Workflow & Operations | `/resources` + `/how-core-works` CTA (EP17) | 1 |
| `/resources/human-error` | Guide | ความรู้ menu → Human Error | `/resources` | 1 |
| `/resources/warehouse-privacy` | Guide | ความรู้ menu → Warehouse Privacy | `/resources` + `/security` Warehouse chapter (EP17) | 1 |
| `/resources/implementation-guide` | Guide | ความรู้ menu → Implementation Guide | `/resources` + `/enterprise#implementation` (EP17) | 1 |
| `/resources/security-and-data` | Guide | ความรู้ menu → Security & Data | `/resources` | 1 |
| `/resources/core-glossary` | Guide | ความรู้ menu → CORE Glossary | `/resources` | 1 |
| `/privacy` | Privacy policy (placeholder) | Footer legal bar | Cookie banner link | 1 |
| `/terms` | Terms of use (placeholder) | Footer legal bar | — | 1 |
| `/login` | Prototype sign-in (noindex) | Header เข้าสู่ระบบ (icon-only 1280–1535 px; mobile menu below 640 px) | — | 1 |

**Documented single-entry routes:**

- `/features` — linked from the homepage close. It is a legacy overview and is not promoted
  further.
- `/terms` — the footer is the conventional and sufficient place.
- `/login` — the header action is the one intended entry.

## Coverage by surface

- **Header (top level):**
  - ภาพรวม plus seven mega menus: แผนก, แพ็คเกจ, วิธีการทำงาน, โซลูชัน, สำหรับองค์กร, ความรู้,
    เกี่ยวกับเรา
  - ติดต่อเรา and เข้าสู่ระบบ as actions
  - Pricing is one interaction away (แพ็คเกจ)
- **Mega menus:**
  - 39 items plus 7 highlight CTAs; every one is a live route or anchor
  - Demo, Security, Why CORE, Industries and all seven guides are reachable here
- **Mobile menu:**
  - the same seven groups, expanding to the same items and highlight CTA
  - contact and sign-in pinned at the bottom
  - checked in TH / EN / ZH
- **Footer (unchanged in EP17):**
  - ลิงก์ด่วน: ภาพรวม, แผนก, แพ็คเกจ, วิธีการทำงาน, ความรู้
  - องค์กร: โซลูชัน, ประเภทธุรกิจ, สำหรับองค์กร, ความปลอดภัย, เกี่ยวกับเรา, ติดต่อเรา
  - legal: privacy, terms, cookie settings
- **Contextual:**
  - department pages link to each other and to `/demo?role=…`
  - `/industries` and `/enterprise` link to the six industry pages
  - Solutions links to departments and the demo; How CORE Works links to departments, pricing and the demo
  - the Resource Center and guides link to Solutions, How CORE Works, Security, Demo, Enterprise
    and Pricing anchors
  - EP17 added three links from product pages into guides (see Matrix)

## Rules for new routes

1. Add the route to `test/publicRoutes.ts`; this drives the sitemap, SEO, language and header
   tests.
2. Add a row to `test/discoverability.ts` with a real primary entry.
3. Prefer a contextual entry at the decision point over a new header or footer item. Header and
   footer density is an EP18 topic.
4. A page with a single entry needs a stated reason in this document.

## Deferred to EP18

- **Header:** desktop navigation consolidation (fewer top-level items) and the 1280–1535 px
  icon-only sign-in trade-off.
- **Footer:** information density.
