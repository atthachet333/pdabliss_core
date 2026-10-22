# EP02 — Internal App Design System & Workspace Foundation

**Date:** 2026-10-22 · **Owner:** PDA BLISS COMPANY LIMITED
**Baseline:** `main` @ `c993e51ac8a2eaac665841ad1b13eb99fad9ce48` (EP01) — verified clean before work began
**Commit:** `feat: establish CORE internal design system (EP02)` on `main`

## Scope decision

Frontend-first product design. Postponed by owner decision and **not started**: PostgreSQL,
any database, Prisma migrations, seed data, production authentication, real RBAC and all
business persistence (PR / PO / Sales / Stock / Payment / Work Order), file storage, and real
notifications. The backend is unchanged. The prototype sign-in (`user1` / `pass1`) is unchanged
and still isolated in `frontend/src/prototype/`.

## What was delivered

### 1. Design tokens (`frontend/src/styles/index.css`)

New internal-app layer, separate from the public-site tokens:

- **Surfaces:** `canvas`, `nav`, `panel`, `panel-raised`, `panel-overlay` — layered dark,
  never pure black.
- **Lines / states:** `line`, `line-strong`, `fill-hover`, `fill-active`, `fill-muted`, `focus`.
- **Text:** `fg-primary` / `fg-secondary` / `fg-muted` / `fg-disabled` — primary-to-muted all
  ≥ 5.2:1 on the lightest app surface (computed).
- **Semantic:** success / warning / danger / info (existing) + new `neutral`.
- **Type:** `text-page`, `text-section`, `text-metric`. **Elevation:** `shadow-panel`,
  `shadow-overlay` (no glow internally).
- **Department accents** re-tuned to the requested families at low chroma: Executive
  green/teal `#3ee0b4`, Sales blue `#6aaaf5`, Warehouse emerald `#4fd08f`, Purchasing amber
  `#dfb066`, Operations violet `#a99af0`, Accounting cyan `#6cc7e0`, Admin graphite `#a3adb8`.
- `rail:` custom variant for the sidebar icon-rail state; default `--ws-accent` on `<html>`.

### 2. AppShell (`components/shell/`)

One shell for every workspace: slim prototype banner → sticky top bar (collapse toggle,
PDA BLISS CORE identity, workspace icon + name, search, prototype switcher, notifications,
profile) → workspace sidebar → page (max 1280px). Skip link, named landmarks, 200ms page fade.

| Width | Navigation |
| ----- | ---------- |
| ≥ 1280px | Full sidebar (16rem) — toggle to icon rail, choice remembered per device |
| 768–1279px | Icon rail (4.5rem) with tooltips — toggle to full |
| < 768px | Bottom bar: ≤ 4 destinations + **เพิ่มเติม** bottom sheet (rest of modules, prototype switcher, Design Lab). **Warehouse:** raised centre scan button (barcode / QR prototype dialog) |

### 3. Navigation (registry)

Each department has its own menu exactly as specified (Executive: ภาพรวม · แผนก · Exception ·
การอนุมัติ *(placeholder)* · รายงาน; Sales: ภาพรวม · Customer PO · Sales Order · การส่งมอบ ·
ลูกค้า · รายงาน; Warehouse: ภาพรวม · รับสินค้า · สต็อกสินค้า · Lot / Batch · วันหมดอายุ ·
การเคลื่อนไหว · ตรวจนับ · รายงาน; Purchasing: ภาพรวม · ใบขอซื้อ · ใบสั่งซื้อ · Supplier ·
ติดตามการรับ · รายงาน; Operations: ภาพรวม · Work Order · แผนงาน · ความคืบหน้า · งานเสร็จ ·
รายงาน; Accounting: ภาพรวม · คำขอจ่าย · การจ่ายเงิน · ยอดค้าง · เอกสาร · รายงาน; Admin:
ภาพรวม · ผู้ใช้งาน · แผนก · บทบาท · Workflow *(placeholder)* · การตั้งค่า). 44 routes in total.

Each module carries a **blueprint** (list columns with mobile priority, quick filters,
primary action, empty-state copy). The generic `ModulePage` renders it as the real
toolbar + table with zero rows — final structure, no fake records. Custom module pages:
Executive แผนก, Admin แผนก / บทบาท / การตั้งค่า (form system in context, values not saved).

### 4. Shared components (`components/core/`, one barrel import)

| Area | Parts |
| ---- | ----- |
| Actions | `Button` (primary / secondary / ghost / danger, sm / md, loading, `soon`), `IconButton`, `LinkButton`, `OverflowMenu`, `useMenu` |
| Labels | `StatusBadge` (10 statuses, 5 families), `Badge`, `SampleTag`, `PrototypeTag`, `CountBadge` |
| Page | `PageHeader` (breadcrumb, status, actions, overflow), `SectionHeader`, `Panel`, `Tabs` |
| Numbers | `Kpi` (compact / primary / alert, unit, supporting, trend), `KpiGrid`, `ProgressBar`, `StageCounts` |
| Tables | `DataTable` (priorities, card rows < 768px, selection + bulk bar, sort, row actions, loading, empty), `TableToolbar`, `SearchField`, `FilterChip`, `Pagination` |
| Forms | `FormField` (label, required, help, error, disabled, read-only), `TextInput`, `Textarea`, `Select`, `SearchableSelect`, `DateInput`, `NumberInput`, `Checkbox`, `RadioGroup`, `Switch`, `FileDrop`, `FormGrid`, `FormSection`, `FormActions` |
| States | `EmptyState` (empty / clear / filtered × default / compact / inline) + `EMPTY_COPY`; `PageSkeleton`, `KpiSkeleton`, `TableSkeleton`, `CardSkeleton`; `ErrorState` (pageLoad / section / permission / notFound / unexpected) + `ERROR_COPY` |
| Overlays | `Modal`, `ConfirmDialog`, `Drawer`, `Sheet` (focus trap, Escape top-most only, focus return, scroll lock) |
| Records | `RecordHeader`, `RecordLayout`, `RecordSection`, `SummaryList`, `RelatedDocuments`, `ActivityFeed` |
| Workflow | `WorkflowTimeline` (completed / current / upcoming / rejected / blocked; horizontal ≥ 768px, vertical on phones & drawers) |
| Work | `TaskItem` / `TaskList` (My Work), `ExceptionItem` / `ExceptionList` |

Shell-level: `SearchDialog` (Ctrl+K or "/", jumps to workspace pages; record search marked
prototype), `NotificationCenter` (งาน / อนุมัติ / แจ้งเตือน / ระบบ, unread, mark-all-read),
`ProfileMenu` (user, workspace, profile & preferences placeholders, Design Lab, functional
logout), `ScanDialog`.

### 5. Workspaces

| Workspace | Overview |
| --------- | -------- |
| Executive (Control Center) | 3 KPIs (alert: 3 exceptions) · department summary cards linking into each workspace (accent per card; noted as review-only navigation) · Exception list (PO ส่งล่าช้า, LOT ใกล้หมดอายุ, SO ใกล้กำหนดส่ง) → drawer with tracking timeline · approvals placeholder |
| Sales | Stage counts · Sales Order table (selection, row actions) → drawer with the รับออเดอร์ → ตรวจ Stock → Operations → พร้อมส่ง → จัดส่ง timeline, related docs, activity · My Work |
| Warehouse | Price-privacy notice · 4 thumb-sized task tiles · FEFO Lot table → Lot drawer (quantities/dates only) · receiving empty state · scan entry (desktop button, phone centre button) |
| Purchasing | PR → PO stage counts · receiving follow-up table (progress, overdue/partial) → **record-detail template** in a drawer with tabs รายละเอียด / รายการ / การรับสินค้า / การจ่ายเงิน / ประวัติ · My Work |
| Operations | Work-order board (4 columns ≥ 768px; stacked stages on phones, no sideways scroll) → drawer with blocked-step timeline · week plan |
| Accounting | Primary KPI (outstanding) · pending-payments table · inline "ไม่มีรายการค้าง" · document checklist with locked pay button |
| Admin | Config KPIs · users table (empty state) · canonical departments · role skeleton · settings page using the form system |

### 6. Design Lab — `/app/prototype/ui`

Every pattern in one page (tokens, buttons, status, forms, KPI & cards, table with live
search/filter/sort/selection/pagination and loading/empty toggles, empty, loading, errors,
timeline, tasks & exceptions, modal/confirm/drawer with the Modal-vs-Drawer-vs-Page guide,
full-page record template) plus a department-accent picker. Behind the prototype gate; reachable
by URL or the profile menu's prototype entry only — **not** in any workspace navigation.

### Removed

`components/app/WorkspaceLayout.tsx` and `components/app/primitives.tsx` (replaced by the shell
and core). The decorative hero motifs and radial glows are no longer used inside the app; the
image files remain for the public site.

## Verification

| Gate | Frontend | Backend |
| ---- | -------- | ------- |
| `npm ci` (clean copy of the working tree) | ✅ | ✅ |
| typecheck | ✅ | ✅ |
| lint | ✅ 0 errors, 0 warnings | ✅ |
| format:check | ✅ | ✅ |
| test | ✅ **106 passed** (6 files; EP01: 50) | ✅ 21 passed (unchanged) |
| build | ✅ | ✅ |

No database gate (none exists in this scope). The production bundle was re-checked: the demo
password does not appear in it.

### New frontend tests

- **core.test.tsx** — StatusBadge vocabulary (10 statuses → 5 families; every status has icon
  + text; relabelling keeps the family) · EmptyState copy and action · ErrorState retry vs
  permission · DataTable (desktop table + phone cards, priority classes, empty, selection bar,
  `aria-sort`, row open) · WorkflowTimeline (`aria-current`, state text) · FormField wiring
  (required, `aria-invalid`, description), disabled/read-only, Switch · Modal & Drawer (focus
  in, Escape, focus return) · OverflowMenu keyboard.
- **shell.test.tsx** — top-bar identity, search, notifications, skip link · each workspace's
  sidebar lists exactly its modules · responsive classes (sidebar `md:`, bottom bar
  `md:hidden`) · collapse toggle + persistence · phone bar (4 links + เพิ่มเติม sheet with the
  prototype switcher note) · Warehouse scan button · Ctrl+K search navigates · notification
  tabs + mark-all-read · profile menu (user, workspace, disabled placeholders, Design Lab) ·
  switcher marked prototype-only (7 options, current checked) · in-shell not-found · module
  blueprint table + filtered empty state · Design Lab behind the gate, absent from navigation,
  renders its sections.
- **registry.test.ts** — exact EP02 navigation per department, placeholders, ≤ 4 phone-bar
  destinations, warehouse blueprints free of pricing columns.
- **warehouse-privacy.test.tsx** — extended: Lot drawer, notification centre and search dialog
  in Warehouse show no monetary values.
- All EP01 tests kept (login, gate, switcher, sign-out, session, warehouse pages).

`src/test/setup.ts` now uses a 5s async timeout for lazy route chunks (one EP01 route test
flaked once under parallel load at the 1s default) and clears `localStorage` between tests.

### Browser QA (in-app browser, live dev server)

- Real flow: `/login?next=/app/executive` → sign in with the demo account → Executive.
- **Overflow sweep:** all 44 routes (7 overviews, 36 module pages, Design Lab) × 8 widths
  (320, 375, 390, 430, 768, 1024, 1280, 1440) = **352 checks, 0 px horizontal overflow, every
  page has an `h1`**.
- Shell measured: 768 / 1024 → 72px rail, bottom bar hidden; toggle expands to 256px with no
  overflow and collapses back; rail hides labels and caption in both `auto` and `collapsed`.
- Interactions exercised: sidebar toggle, phone bar + เพิ่มเติม sheet (navigated to
  วันหมดอายุ), Warehouse Lot drawer on a phone (full-screen, vertical timeline), Purchasing PO
  drawer with tabs at 1440, notification centre, prototype switcher, Executive at 1440,
  public landing page (unchanged, no overflow).
- **Console:** no errors on any page visited.
- Bugs found and fixed during QA: collapse toggle and Warehouse scan button visible on phones
  (component `inline-flex` beat `hidden` → `max-md:hidden`); prototype banner wrapped to two
  lines on phones (shortened below 640px); completed timeline markers not filled and alert-KPI
  border overridden (conflicting utility classes); portaled drawers lost the department accent
  (`--ws-accent` now also set on `<html>`); document numbers wrapping in tables at 1024px.
- Limitation: the Browser pane was ~420px wide and its captures cropped emulated desktop widths,
  so several desktop/tablet views were verified by DOM measurement rather than screenshot.

### Accessibility

Keyboard paths for menus, tabs, combobox, overlays (trap + return focus) and the skip link;
visible focus ring; icon buttons named; all form controls labelled with linked help/errors;
status, priority, severity, timeline state and unread state never colour-only; ≥ 44px touch
targets on phones; `prefers-reduced-motion` honoured (Framer + global CSS); text contrast
computed (muted ≥ 5.2:1).

### Thai / UTF-8

185 text files scanned (88 containing Thai): **0** BOM, **0** invalid UTF-8, **0** U+FFFD,
**0** mojibake patterns, **0** CRLF. All files written with UTF-8-safe tools (LF line endings).

## Known limitations

- Prototype sign-in is not security; navigation is not authorization.
- All sample values are illustrative; module lists are empty by design.
- Search jumps between pages only; filters/sort operate on local sample rows; primary
  business actions show "เร็ว ๆ นี้".
- Notifications, read state and the settings page are local to the page view (no persistence).
- File attachment is an inert placeholder; camera scanning is a prototype dialog.
- Dark theme only. Column visibility control is designed for (priorities) but not exposed.
- `npm ci` reports install scripts pending approval (npm `allow-scripts`); gates pass without them.

## Recommended EP03

Pick one end-to-end business flow and build it on this system — recommended: **Purchasing
PR → PO** as full-page documents (create / edit / approve / reject-with-reason) using the
record template, forms and timeline, still frontend-only with typed fixtures, so the document
page pattern is proven before persistence returns.
