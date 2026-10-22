# Internal Design System — PDA BLISS CORE

**Introduced:** EP02 · **Code:** `frontend/src/components/core` (parts) and
`frontend/src/components/shell` (application shell) · **Live gallery:** `/app/prototype/ui`
(Design Lab, prototype only)

The public CORE Universe site is cinematic. The internal application is a **premium
enterprise command center**: calm, spacious, extremely readable, comfortable for all-day work.
Glow and motion appear only where they improve hierarchy.

Every internal screen is assembled from the parts below. Before inventing a new pattern in a
department episode, check the Design Lab — if something is missing, add it to
`components/core` (with a Design Lab entry) rather than building it inside one workspace.

```ts
import { PageHeader, Panel, DataTable, StatusBadge, EmptyState } from '@/components/core';
```

---

## 1. AppShell

```
┌──────────────────────────────────────────────────────────────┐
│ prototype banner (prototype builds only)                     │
├──────────────────────────────────────────────────────────────┤
│ ⇤  ◉ PDA BLISS CORE │ ▣ ฝ่ายขาย      [ค้นหา… Ctrl K] ⚗ 🔔 (US) │  top bar, sticky
├────────────┬─────────────────────────────────────────────────┤
│ ▣ ฝ่ายขาย   │ breadcrumb                                      │
│ ▌ภาพรวม     │ Page title  [status]          [secondary][primary]│
│  Customer PO│ description                                     │
│  …          │ content (max 1280px, centred)                   │
└────────────┴─────────────────────────────────────────────────┘
```

| Region | Contents | Notes |
| ------ | -------- | ----- |
| Top bar | collapse toggle (≥ 768px), PDA BLISS CORE identity (links to workspace overview), workspace name with department icon, search, prototype switcher, notifications, profile | Never more than these items. Search collapses to an icon on phones. |
| Sidebar | workspace identity tile, this department's modules only | Full (16rem) from 1280px, icon rail (4.5rem) on 768–1279px; user toggle remembered per device. |
| Main | one page, max width 1280px | Gutters 16 / 24 / 32 / 40px. |
| Phone bar | ≤ 4 destinations + **เพิ่มเติม** sheet | Below 768px only. |

- **Skip link** "ข้ามไปยังเนื้อหาหลัก" is the first focusable element.
- `AppShell` sets `--ws-accent` on the shell and on `<html>` (so drawers and dialogs, which
  portal to `<body>`, inherit it). Default is brand glow.
- The PDA BLISS CORE identity is always present and visually dominant; the department appears
  as a small icon + name, never a coloured background.

## 2. Navigation

- Each workspace has its **own** navigation, declared in `workspaces/registry.ts`. No global
  menu of every module.
- Active item: `fill-active` background + 3px accent bar + accent icon. Inactive: muted icon.
- Placeholder modules (Executive **การอนุมัติ**, Admin **Workflow**) carry a dashed
  "เร็ว ๆ นี้" marker.
- Rail mode keeps labels for screen readers (`sr-only`) and shows them as tooltips (`title`).
- **Navigation is not authorization.** The backend authorizes every request.

### Phone navigation (< 768px)

- A bottom bar with up to four destinations (`mobile: true` in the registry, overview first)
  plus **เพิ่มเติม**, which opens a bottom sheet with the remaining modules, the prototype
  workspace switcher and the Design Lab link.
- **Warehouse** replaces one slot with a raised centre **scan** button (barcode / QR) in thumb
  reach. It opens the scan prototype dialog; camera scanning arrives with the stock module.
- Touch targets ≥ 44px. The bar respects `env(safe-area-inset-bottom)`.

### Prototype workspace switcher

Dashed amber chip **สลับพื้นที่ทำงาน · ต้นแบบ**, labelled *ใช้สำหรับตรวจแบบเท่านั้น*, grouped
ศูนย์ควบคุม / แผนก / ระบบ. Production has no switcher: sign-in opens the user's assigned
workspace directly. Lives in `src/prototype/` for one-step removal.

## 3. Spacing & layout

- 4px base scale. Sections on a page are separated by `mb-10`; panels in a grid by `gap-6`;
  rows inside a list by hairline dividers, not gaps.
- Page grid: one main column; two-column splits use `minmax(0,1.6fr) minmax(0,1fr)` from
  1280px (`xl:`), stacking below.
- **Density:** 3–5 meaningful items beat 20 fake records. Show structure, not volume.

## 4. Typography (internal scale)

| Token | Size | Use |
| ----- | ---- | --- |
| `text-page` | 22 → 28px, 600 | Page title (`h1`) |
| `text-section` | 17px, 600 | Section and panel titles (`h2`/`h3`) |
| `text-metric` | 26 → 32px, 600, tabular | KPI values |
| `text-label` | 15px | Body text in the app, controls, table cells |
| `text-caption` | 13px | Metadata, help text |
| 12px | — | Only for badges, phone-bar labels, table micro-labels |

Thai line-heights stay generous (≥ 1.45 for headings). Numbers use `tabular`. Document
numbers never wrap (`whitespace-nowrap`).

## 5. Surface hierarchy & tokens

Layered dark surfaces — never pure black, each layer one step lighter:

| Token | Value | Use |
| ----- | ----- | --- |
| `canvas` | `#0b131b` | Page background |
| `nav` | `#0d1720` | Top bar, sidebar, phone bar |
| `panel` | `#0f1a24` | Panels, cards, tables |
| `panel-raised` | `#14222e` | Inputs, nested tiles, table header |
| `panel-overlay` | `#1a2a37` | Menus, dialogs, drawers |
| `line` / `line-strong` | mint 8% / 15% | Hairlines / controls |
| `fill-hover` / `fill-active` | white 4.5% / 8.5% | Hover / selected |
| `fill-muted` | `#1a2733` | Skeletons, progress tracks, quiet chips |
| `focus` | `#3ef0c0` | Focus ring (2px outline, 3px offset) |

| Text | Value | Contrast on `panel-overlay` (worst case) |
| ---- | ----- | ---------------------------------------- |
| `fg-primary` | `#eaf3f0` | 13.0 : 1 |
| `fg-secondary` | `#aebfba` | 7.7 : 1 |
| `fg-muted` | `#8a9e98` | 5.2 : 1 |
| `fg-disabled` | `#5c6e69` | 2.7 : 1 (disabled only, by design) |

Semantic: `success` `#34d399`, `warning` `#f5b84b`, `danger` `#f47272`, `info` `#6cb8ff`,
`neutral` `#a8b5b2`. Depth comes from `shadow-panel` (a 1px inner highlight) and
`shadow-overlay` for floating layers — **no glow on internal components**.

The public site keeps its own `surface-*` / `text-*` tokens; internal code uses the tokens above.

## 6. Department accents

| Workspace | Token | Hue |
| --------- | ----- | --- |
| Executive | `ws-executive` `#3ee0b4` | core green / teal |
| Sales | `ws-sales` `#6aaaf5` | cool blue |
| Warehouse | `ws-warehouse` `#4fd08f` | emerald |
| Purchasing | `ws-purchasing` `#dfb066` | amber |
| Operations | `ws-operations` `#a99af0` | violet |
| Accounting | `ws-accounting` `#6cc7e0` | cyan |
| Admin | `ws-admin` `#a3adb8` | graphite |

Allowed: workspace icon, active-nav bar, timeline current marker, unread dots, selected-row
tint (7%), focus of a filter chip. **Not allowed:** status, large fills, backgrounds, borders
on every card. Use the `accent` helpers in `components/core/styles.ts`.

## 7. Status

One component: **`StatusBadge`**. Ten statuses, five colour families, always icon + text.

| Status | Default label | Family | Icon |
| ------ | ------------- | ------ | ---- |
| `draft` | ร่าง | neutral | dashed circle |
| `pending` | รอดำเนินการ | warning | clock |
| `processing` | กำลังดำเนินการ | info | spinner circle |
| `partial` | บางส่วน | info | dotted circle |
| `completed` | เสร็จสิ้น | success | check |
| `closed` | ปิดแล้ว | neutral | lock |
| `rejected` | ไม่อนุมัติ | danger | x |
| `cancelled` | ยกเลิก | neutral | ban |
| `warning` | ต้องติดตาม | warning | triangle |
| `overdue` | เลยกำหนด | danger | alarm |

Documents may relabel (`label="รับบางส่วน"`) but must map onto one of these statuses — no
document invents a new status colour. Non-status labels use `Badge`; illustrative content is
marked with `SampleTag` (ตัวอย่าง); prototype-only controls with `PrototypeTag` (ต้นแบบ).

## 8. Page header & KPIs

`PageHeader`: breadcrumb → title (+ status) → one-line description → actions. Secondary
actions first, **one** primary last, then an `OverflowMenu`. Actions wrap under the title on
phones.

`Kpi` variants: `compact` (default), `primary` (the one number that matters; accent rail),
`alert` (warning/danger frame + icon). Props: label, value, unit, supporting text, optional
trend (always text, colour only for sentiment). `KpiGrid` caps at 3–4 columns. **Not every
page needs KPIs.**

## 9. Tables

`DataTable` + `TableToolbar` (`SearchField`, `FilterChip`, clear) + `Pagination`.

- **≥ 768px:** a real `<table>` with a hidden caption. Column `priority` decides visibility:
  `primary` / `status` / `high` always; `medium` from 1024px; `low` from 1280px.
- **< 768px — chosen pattern: card rows.** Each row becomes a card: title + status on top, up
  to three high/medium fields as label/value pairs, chevron; tap opens the **detail drawer**
  where low-priority fields live. No horizontal page scroll.
- States: header, hover (`fill-hover`), selected (accent 7% tint + checkbox + "เลือกแล้ว n
  รายการ" bar with bulk actions), sortable headers (`aria-sort`), row actions (overflow
  menu), empty (an `EmptyState` passed as `empty`), loading (`TableSkeleton`).
- Search / filter / sort are client-side in the prototype; the props are the integration
  points for server queries later. Column control is a planned extension of `Column`.

## 10. Forms

`FormField` wires label, required marker (`*` + sr-only "จำเป็น"), help, error,
`aria-describedby`, `aria-invalid`, disabled and read-only into the control via context.

Controls: `TextInput` (icon / suffix), `Textarea`, `Select`, `SearchableSelect` (combobox +
listbox, local filtering), `DateInput`, `NumberInput` (unit suffix, no spinners), `Checkbox`
(incl. indeterminate), `RadioGroup` (inside `FormField group`), `Switch` (applies
immediately), `FileDrop` (inert placeholder — no file storage yet). Layout helpers:
`FormGrid` (2 columns from 640px), `FormSection`, `FormActions` (full-width on phones).

Read-only fields render with a dashed border and the "อ่านอย่างเดียว" note. Errors are calm,
specific Thai sentences.

## 11. Empty states

`EmptyState` — kinds `empty`, `clear` (good news, success icon), `filtered` (offer
"ล้างตัวกรอง"); layouts `default`, `compact`, `inline`. A small icon in two faint rings (an
echo of the CORE orbit) — no large illustrations. Always say **what will appear and where it
comes from**. Standard copy in `EMPTY_COPY`: ยังไม่มีรายการ · ยังไม่มีงานที่ต้องดำเนินการ ·
ไม่มีรายการค้าง · ยังไม่มี Lot ที่ใกล้หมดอายุ · ไม่พบรายการตามตัวกรอง.

Module pages render their final table (columns, filters, primary action) with zero rows and
the module's empty state — the structure is the demo, not fake data.

## 12. Loading

`PageSkeleton` (route Suspense fallback), `KpiSkeleton`, `TableSkeleton` (desktop rows +
phone cards), `CardSkeleton`, `Skeleton`. Each occupies the space of its content (no layout
shift), announces "กำลังโหลด…" to screen readers, and pulses gently — stopped under
`prefers-reduced-motion`. Spinners only inside a button that is saving.

## 13. Errors

`ErrorState` kinds and copy (`ERROR_COPY`):

| Kind | Title | Retry |
| ---- | ----- | ----- |
| `pageLoad` | โหลดหน้านี้ไม่สำเร็จ | yes |
| `section` | โหลดส่วนนี้ไม่สำเร็จ (inline, rest of page keeps working) | yes |
| `permission` | คุณยังไม่มีสิทธิ์เข้าถึงส่วนนี้ | no — contact admin |
| `notFound` | ไม่พบหน้าที่ต้องการ | no — link back |
| `unexpected` | เกิดข้อผิดพลาดที่ไม่คาดคิด (+ reference code) | yes |

Route errors inside a workspace render `RouteError` within the shell; unknown module paths
render `WorkspaceNotFound` with a link back to the overview.

## 14. Modal vs Drawer vs Page

| Use | When | Examples |
| --- | ---- | -------- |
| **Modal** | One short decision or a tiny form; blocks the page; one primary button | Confirm delete (`ConfirmDialog tone="danger"`), reject with reason |
| **Drawer** | Record detail, quick edit, task context — the list stays visible behind | View SO / PO / Lot, update progress, assign an exception |
| **Page** | Complex documents with line items, anything needing its own URL, long editing or side-by-side reference | Create PO / SO / GR |
| **Sheet** | Phone-only overflow (navigation "เพิ่มเติม", quick pickers) | Phone bottom sheet |

All overlays: portal to `<body>`, `role="dialog"` + `aria-modal`, focus trapped, Escape closes
the top-most layer only, focus returns to the opener, page scroll locked. Drawer is full-screen
on phones; Modal anchors to the bottom edge on phones.

## 15. Record detail

```
ใบสั่งซื้อ (PO)
PO-000123  [รับบางส่วน]                                 [แก้ไข] […]
รายละเอียด · รายการ · การรับสินค้า · การจ่ายเงิน · ประวัติ
┌ main ─────────────────────────┐ ┌ side ──────────────┐
│ สรุป (SummaryList)              │ │ เอกสารที่เกี่ยวข้อง    │
│ ขั้นตอน (WorkflowTimeline)      │ │ ความเคลื่อนไหว       │
└────────────────────────────────┘ └────────────────────┘
```

Parts: `RecordHeader`, `Tabs`, `RecordLayout` (two columns from 1024px), `RecordSection`,
`SummaryList`, `RelatedDocuments`, `ActivityFeed`. The same parts render single-column inside a
Drawer (quick view). Templates only — no business logic.

## 16. Workflow timeline

`WorkflowTimeline` — states `completed` (filled brand check), `current` (accent ring + dot,
`aria-current="step"`), `upcoming` (hollow), `rejected` (danger ×), `blocked` (warning ⊘) with
an optional reason. Every step prints its state in text. Horizontal from 768px, vertical on
phones and inside drawers (`orientation="vertical"`).

## 17. Tasks & exceptions

- **`TaskItem` / `TaskList`** — the unit of future "งานของฉัน": priority (icon + sr text),
  title, reference, department, due (overdue said in words), status, one next-action verb.
- **`ExceptionItem` / `ExceptionList`** — severity rail + icon + label (วิกฤต / สูง / ปานกลาง /
  ต่ำ), title, reason, reference, department, time, one action. Executive uses this heavily.

## 18. Search & notifications

- **Search** (`SearchDialog`, Ctrl+K or "/"): jumps between pages of the current workspace
  today; record search targets (เอกสาร, Sales Order, PO, GR, สินค้า, ลูกค้า, Supplier) are shown
  and clearly marked as prototype.
- **Notifications** (`NotificationCenter`, right drawer): tabs ทั้งหมด / งาน / อนุมัติ /
  แจ้งเตือน / ระบบ, unread dots with sr text, mark-all-read. Samples contain no monetary
  values, so the panel is safe in Warehouse. No backend notification logic.

## 19. Motion

Quieter than the public site. Allowed: page enter fade (200ms, 4px), drawer/modal/sheet
transitions (200–400ms, `EASE_CORE`), hover colour feedback, menu fade, rail width transition,
progress width change. **Not used internally:** floating, parallax, moving backgrounds, glow
loops, magnetic buttons. Everything respects `prefers-reduced-motion` (Framer
`MotionConfig reducedMotion="user"` + the global CSS rule).

## 20. Accessibility checklist

- Keyboard: every control reachable; menus (arrow / Home / End / Escape), tabs (arrows),
  combobox (arrows / Enter / Escape), overlays (trap + return focus).
- Visible focus ring everywhere (`focus` token).
- Icon-only buttons have `aria-label` + `title`.
- Every form control has a label; errors are linked with `aria-describedby`.
- Status, priority, severity, timeline state and unread state are never colour-only.
- Touch targets ≥ 44px on phones (controls shrink to 36–40px only on pointer layouts ≥ 640px).
- No horizontal page overflow from 320px to 1440px.

## 21. Warehouse privacy

Warehouse UI shows quantities, Lots and dates only. Warehouse types contain no price, cost or
amount fields; tests assert no currency text on any warehouse page, drawer, notification panel
or search panel, and that warehouse module blueprints contain no pricing columns.
