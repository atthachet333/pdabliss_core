# Global Navigation — PDA BLISS CORE public site (EP18)

The site grew from seven pages to 35 routes in three languages. By EP17 the header carried eight
top-level items, a contact pill and a sign-in that had to collapse to an icon between 1280 and
1535 px. The footer listed eleven links plus duplicate contact chips. EP18 solves this with
information architecture, not smaller type: **fewer choices at once, clearer categories,
stronger hierarchy.**

Structure lives in `frontend/src/config/navigation.ts`. Words live in
`frontend/src/i18n/messages/{th,en,zh-CN}.ts`.

## Header

| | Before (EP17) | After (EP18) |
| --- | --- | --- |
| Text navigation | ภาพรวม · แผนก · แพ็คเกจ · วิธีการทำงาน · โซลูชัน · สำหรับองค์กร · ความรู้ · เกี่ยวกับเรา (8) | **ภาพรวม · ผลิตภัณฑ์ · โซลูชัน · ความรู้ · เกี่ยวกับเรา** (5) |
| English | Overview · Departments · Packages · How it works · Solutions · Enterprise · Resources · About | Overview · Product · Solutions · Resources · About |
| Chinese | 概览 · 部门 · 方案 · 工作方式 · 解决方案 · 面向企业 · 资源 · 关于我们 | 概览 · 产品 · 解决方案 · 资源 · 关于我们 |
| Actions | Language · ติดต่อเรา · icon-only sign-in (1280–1535 px) | Language · **ติดต่อเรา** (primary pill) · **เข้าสู่ระบบ** (labelled at every width) |
| Item padding | 6 px (1280–1535) to 8 px | 14 px, 16 px from 1536 px; type stays 15 px |
| Spare space at 1280 px (TH / EN / ZH) | 71 / 30 / 114 px | **109 / 107 / 146 px** |
| Full logo subtitle | from 1680 px | from 1536 px |
| Scrolled surface | 74 % obsidian, `blur-lg`, saturate 150 % | 86 % obsidian, `blur-md`, no colour boost (less glass) |

### Breakpoint

The full desktop bar starts at **1280 px** (`NAV_DESKTOP_QUERY`, `--breakpoint-nav`). Below
that, the dedicated mobile menu takes over, so the bar is never squeezed. From 768 px the
header also shows the language selector, ติดต่อเรา and เข้าสู่ระบบ beside the menu button; from
640 px, language and sign-in; below 640 px, everything lives in the menu.

### Current section

`activeGroup(path)` maps the locale-free path to the menu whose `family` holds it:

- **Product:** `/departments*`, `/how-core-works`, `/demo`, `/pricing`, `/features`
- **Solutions:** `/solutions`, `/industries*`, `/enterprise`
- **Resources:** `/resources*`
- **About:** `/about`, `/why-core`, `/security`

That menu's trigger gets `aria-current="true"`, primary text colour and a 4 px dot under the
label. There is no bar. The homepage marks nothing; ภาพรวม shows the dot on `/`.

## The four menus

Each menu answers one question. Its panel has three parts: intro | sections | one featured
destination.

- **Feature rows:** icon, label and a one-line description.
- **Index rows:** compact, name-only links (departments, industries, reference guides) on a
  hairline.

No menu shows more than 11 links (tested; the cap is 12). Panels are 400–480 px tall.

| Menu | Question | Feature rows | Index row | Featured |
| --- | --- | --- | --- | --- |
| **ผลิตภัณฑ์ Product** | What is CORE, and how do I use it? | *เข้าใจ CORE*: CORE ทำงานอย่างไร `/how-core-works` · แผนก `/departments` — *ลองและเลือก*: ทดลองใช้งาน CORE `/demo` · แพ็คเกจ `/pricing` | *ดูตามแผนก*: the six department pages | CORE Demo → `/demo` |
| **โซลูชัน Solutions** | Where does CORE fit my business? | ปัญหาที่ CORE ช่วยจัดการ `/solutions` · ประเภทธุรกิจ `/industries` · สำหรับองค์กร `/enterprise` | *ตามประเภทธุรกิจ*: the six industry pages | ดูตามประเภทธุรกิจ → `/industries` |
| **ความรู้ Resources** | How do I understand it? | *เริ่มที่นี่*: เริ่มต้นกับ CORE — *แนวคิดหลัก*: Workflow & Operations · Human Error · Warehouse Privacy | *อ้างอิง*: Implementation Guide · Security & Data · CORE Glossary | เปิดคลังความรู้ → `/resources` |
| **เกี่ยวกับเรา About** | Who builds it, why, and can I trust it? | PDA BLISS `/about` · ทำไมเราถึงสร้าง CORE `/why-core` · Security & Trust `/security` | *วิธีที่เราทำงาน*: แนวทางการพัฒนาระบบ `/about#approach` | การวางระบบและคำปรึกษา → `/about#consulting` |

ติดต่อเรา is not repeated inside any menu: it is the header's primary action.

### What left the header, and where it lives now

| Former header item | Now |
| --- | --- |
| Package-specific links (`/pricing?plan=…#packages`) | Product → แพ็คเกจ; the plan is chosen on `/pricing` (deep links still work) |
| How CORE Works chapter anchors (`#handoff`, `#approval`, `#trace`, `#human-error`) | Product → CORE ทำงานอย่างไร; the chapters are on the page; the Human Error guide is under Resources |
| Solutions problem anchors (six) | Solutions → ปัญหาที่ CORE ช่วยจัดการ; the problems are the page itself |
| Enterprise chapter anchors (audit, workflow, integration, implementation) | Solutions → สำหรับองค์กร; the chapters are on the page |
| Security & Trust (was under สำหรับองค์กร) | About → Security & Trust |

No route was removed.

### Menu visuals

There is one restrained, `aria-hidden` visual per featured panel:

| Menu | Visual |
| --- | --- |
| Product | Work routed through CORE (moving dash = handoff) |
| Solutions | Problem fragments → ordered sequence |
| Resources | Search over an index |
| About | Editorial image |

The department mosaic, tier steps and architecture stack were retired with their menus.

### Panel surface (EP18.1)

The menus use the shared overlay language in `components/ui/overlay.ts` (see
[EP18_1_REPORT.md](EP18_1_REPORT.md)):

- **Panel:** an opaque obsidian gradient with a hairline edge and an inner top light. The open
  trigger sits on a soft pill (`bg-white/[0.06]`) so it reads as joined to its panel.
- **Feature sections** sit in quiet trays, titled with an emerald tick (`overlayLabel`). A menu
  with a single feature section (About) spreads it across three columns instead of leaving a
  half-empty column.
- **Rows** (`overlayRow`) have a hover surface with a faint inner edge. The **page you are on**
  gets an emerald tint, an inner emerald edge and `aria-current="page"`; anchors never count as
  current.
- **Index rows** sit in one framed strip as outlined chips (`overlayChip`). Department chips
  carry their workspace colour as a 6 px dot.
- **Featured panel:** an emerald-edged card with a top edge light and a pill call to action.

### Keyboard and semantics

The keyboard and semantics are unchanged from EP05, and tested:

- Disclosure buttons carry `aria-expanded` and `aria-controls`, and each controls a `region` of
  ordinary links.
- ←/→ move along the five items and wrap.
- ↓ opens a menu and focuses its first link.
- Escape closes and returns focus.
- Tabbing out or clicking outside closes the menu, as does navigating.
- EP21: an open panel follows its trigger in the Tab order. Enter / Space opens it with focus on
  the trigger; Tab moves to the panel's first link, Shift+Tab from that link returns to the
  trigger, and Tab from the last link closes the panel and moves to the next item. (The panel is
  rendered after the whole bar, so without this the other triggers were visited first.)

## Mobile menu

The mobile menu has five rows — ภาพรวม plus four groups — so the closed menu fits one phone
screen. Contact and sign-in are pinned at the bottom, and the language selector sits below the
rows.

A group expands into the same titled sections: feature rows (≥ 56 px), index rows as wrapped
44 px chips, then the featured link. Groups are collapsed by default, so the seven guides are
never all expanded at once. The dialog behaviour is unchanged: focus trap, Escape, scroll lock
and focus return.

EP18.1: the group you are in carries the same emerald dot as on desktop, plus
`aria-current="true"`. Each group's open/closed state is shown by the shared `DisclosureIcon`
(a chevron in a ring that turns and goes emerald when open). An open group hangs from an emerald
rail. Its rows and chips mark the current page, and its featured link is a tinted, bordered
button.

## Footer

| | Before | After |
| --- | --- | --- |
| Zones | Brand (with call / LINE / email chips) · ลิงก์ด่วน (5) · องค์กร (6) · contact details · legal | **Brand · ผลิตภัณฑ์ · สำรวจ · ติดต่อเรา** · legal row |
| Product | — | แผนก · วิธีการทำงาน · ทดลองใช้งาน CORE · แพ็คเกจ |
| Explore | — | โซลูชัน · ประเภทธุรกิจ · สำหรับองค์กร · คลังความรู้ · เกี่ยวกับเรา |
| Contact | Address, phone, email and LINE as icon tiles, plus duplicate chips in the brand column | One compact list (plain icons) + "คุยกับทีม PDA BLISS" → `/contact` |
| Removed from the footer (still in the header / pages) | ภาพรวม (the footer logo now links home), ความปลอดภัย (About menu), ติดต่อเรา text link (replaced by the contact zone link), the call / LINE / email chips (duplicated the contact list), the "by PDA BLISS" byline (said again by "พัฒนาโดย PDA BLISS COMPANY LIMITED") | |
| Decoration | Network curves, orbit circles, two glows | One faint glow and the top hairline |
| Phones | Five sections stacked | Brand → Product and Explore side by side → contact → legal |

The legal row keeps privacy, terms, cookie settings and copyright, with right clearance so the
floating dock never covers it.

## Discoverability

The EP17 rule holds: every public route has a real UI entry path, tested by a breadth-first walk
from the homepage (`src/test/discoverability.test.tsx`).

After EP18:

- **Depth:** every route is at depth ≤ 1 except the homepage (0).
- **Industry pages:** were depth 2; now one step away via Solutions → ตามประเภทธุรกิจ.
- **Departments and guides:** remain one step away.

The changed entry paths are recorded in
[PUBLIC_ROUTE_DISCOVERABILITY.md](PUBLIC_ROUTE_DISCOVERABILITY.md).
