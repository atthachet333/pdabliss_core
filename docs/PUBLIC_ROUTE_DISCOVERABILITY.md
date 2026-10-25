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

## Matrix (EP18 entry paths)

All rows have status **PASS**. There are no NEEDS LINK and no INTENTIONALLY INDIRECT routes.
Locale is preserved on every entry path, in every row. EP18 replaced the eight-item header with
four menus (see [GLOBAL_NAVIGATION.md](GLOBAL_NAVIGATION.md)); the entry paths below reflect it.

| Route | Purpose | Primary entry | Secondary entry | Depth |
| --- | --- | --- | --- | --- |
| `/` | Homepage — CORE Universe | Header logo / ภาพรวม | Footer logo | 0 |
| `/features` | Capability overview by department | Homepage final chapter → สำรวจ CORE เพิ่มเติม | — | 1 |
| `/departments` | Department philosophy | ผลิตภัณฑ์ → แผนก | Footer ผลิตภัณฑ์ | 1 |
| `/departments/<six>` | The six departments | ผลิตภัณฑ์ → ดูตามแผนก → name | `/departments` | 1 |
| `/solutions` | Problem-first solutions | โซลูชัน → ปัญหาที่ CORE ช่วยจัดการ | Footer สำรวจ | 1 |
| `/how-core-works` | One work item through the company | ผลิตภัณฑ์ → CORE ทำงานอย่างไร | Footer ผลิตภัณฑ์ | 1 |
| `/enterprise` | For organizations | โซลูชัน → สำหรับองค์กร | Footer สำรวจ | 1 |
| `/industries` | Industry overview | โซลูชัน → ประเภทธุรกิจ | Footer สำรวจ | 1 |
| `/industries/<six>` | The six industries | โซลูชัน → ตามประเภทธุรกิจ → name (**was depth 2**) | `/industries` | 1 |
| `/pricing` | Packages & subscription | ผลิตภัณฑ์ → แพ็คเกจ | Footer ผลิตภัณฑ์ | 1 |
| `/about` | PDA BLISS | เกี่ยวกับเรา → PDA BLISS | Footer สำรวจ | 1 |
| `/why-core` | Why CORE exists | เกี่ยวกับเรา → ทำไมเราถึงสร้าง CORE | `/about` | 1 |
| `/contact` | Guided consultation | Header ติดต่อเรา action (mobile menu below 768 px) | Footer contact zone → คุยกับทีม PDA BLISS + page CTAs | 1 |
| `/demo` | Interactive demo | ผลิตภัณฑ์ → ทดลองใช้งาน CORE (also its featured link) | Footer ผลิตภัณฑ์ + `/how-core-works` CTA | 1 |
| `/security` | Security & Trust Center | เกี่ยวกับเรา → Security & Trust (**moved from สำหรับองค์กร**) | Security & Data guide; no longer in the footer | 1 |
| `/resources` | Resource Center | ความรู้ → เปิดคลังความรู้ | Footer สำรวจ | 1 |
| `/resources/<seven>` | The seven guides | ความรู้ → เริ่มที่นี่ / แนวคิดหลัก / อ้างอิง | `/resources` library | 1 |
| `/privacy`, `/terms` | Legal (placeholders) | Footer legal row | Cookie banner (privacy) | 1 |
| `/login` | Prototype sign-in (noindex) | Header เข้าสู่ระบบ (labelled at every desktop width since EP18; mobile menu below 640 px) | — | 1 |

**Documented single-entry routes:**

- `/features` — linked from the homepage close. It is a legacy overview and is not promoted
  further.
- `/terms` — the footer is the conventional and sufficient place.
- `/login` — the header action is the one intended entry.

## Coverage by surface (EP18)

- **Header:**
  - ภาพรวม plus four menus: ผลิตภัณฑ์, โซลูชัน, ความรู้, เกี่ยวกับเรา
  - ติดต่อเรา and a labelled เข้าสู่ระบบ as actions
- **Menus:**
  - 34 links in total (30 rows + 4 featured), at most 11 per menu
  - every department, industry and guide is one step away
  - anchors were removed from the menus; the pages carry them
- **Mobile menu:** the same four groups and sections; contact and sign-in pinned; checked in
  TH / EN / ZH.
- **Footer:**
  - Product (4) and Explore (5)
  - the contact zone with one link to `/contact`
  - the legal row
  - no anchors, departments, industries or guides (tested)
- **Contextual:** unchanged from EP17, including the three EP17 guide links (How CORE Works,
  Security, Enterprise).

## Rules for new routes

1. Add the route to `test/publicRoutes.ts`; this drives the sitemap, SEO, language and header
   tests.
2. Add a row to `test/discoverability.ts` with a real primary entry.
3. Prefer a contextual entry at the decision point over a new header or footer item. Header and
   footer density is an EP18 topic.
4. A page with a single entry needs a stated reason in this document.

## Deferred

Header consolidation and footer density were resolved in EP18. Real-device responsive and
accessibility coverage is EP19.
