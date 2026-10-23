# Department Experience — PDA BLISS CORE (EP06)

The public department experience explains one idea: **one organization, many roles — each
role gets the workspace it needs, and every workspace is connected through CORE.** It is a
public, frontend-only experience: no login, no `/app/*`, no backend, no real data.

| Route | Page |
| ----- | ---- |
| `/departments` | Philosophy page — why separate workspaces, how they connect |
| `/departments/executive` | ผู้บริหาร · Executive |
| `/departments/sales` | ฝ่ายขาย · Sales |
| `/departments/operations` | ฝ่ายปฏิบัติการ · Operations |
| `/departments/warehouse` | คลังสินค้า · Warehouse |
| `/departments/purchasing` | จัดซื้อ · Purchasing |
| `/departments/accounting` | บัญชีและการเงิน · Accounting & Finance |

Every route is also served under `/en/...` and `/zh/...` (Simplified Chinese). Unknown
department ids (e.g. `/departments/marketing`) fall through to the 404 page.

## Code layout

```
frontend/src/features/departments/
├── catalog.ts          DEPT_PAGES, deptPath(), departmentLink(), accents, ADJACENT links
├── common.ts           shared localized labels (In/Do/Out, Today, Manager, Preview, CTA) + types
├── summaries.ts        one-line idea, today chips, takes-in / hands-on per department
├── tabs.ts             roving-focus keyboard handler for tablists (arrows, Home, End)
├── ui.tsx              the page kit (see below)
├── overview/           /departments — copy.ts + OverviewSections.tsx
├── executive/ sales/ operations/ warehouse/ purchasing/ accounting/
│                       copy.ts (th / en / zh-CN) + <Name>Page.tsx
└── departments.test.tsx
frontend/src/pages/public/DepartmentsPage.tsx   composes the overview
frontend/src/app/router.tsx                     DEPARTMENT_PAGES — lazy, inside publicPages()
```

Each page is its own lazy chunk; the department pages add ≈ 1.7 KB to the entry bundle.

### Page kit (`ui.tsx`)

| Component | Purpose |
| --------- | ------- |
| `DeptPage` | Sets `--dept` (the workspace accent), `data-department`, and the page-wide backdrop motif |
| `DeptHero` | Department hero: eyebrow, the page's only H1, lead, the signature visual |
| `DeptSwitcher` | Seven links (overview + six); the current page has `aria-current="page"` |
| `Section` / `SectionHead` | Labelled sections with an H2 |
| `FlowIO` | งานที่เข้ามา / สิ่งที่ต้องทำ / สิ่งที่ส่งต่อ — `columns` or `ledger` layout |
| `TodayBoard` | "วันนี้" example states — `tiles` or `lanes`, tone shown by icon **and** text |
| `ManagerLens` | Employee vs. department lead (or levels for Executive) |
| `ProductPreview` | The real EP02 prototype screen (lazy, `inert`, `aria-hidden`) with a caption saying it is the Thai product UI with sample data |
| `ConnectedDepartments` | The handoff chain and 2–3 linked departments (`ADJACENT`) |
| `DeptCta` | Quiet ending: ขอคำปรึกษา · ดูวิธีการทำงานของ CORE · สำรวจแผนกอื่น |

Shared sections keep the pages consistent; the **signature sections and hero visual are
unique to each department**, so a screenshot from the middle of a page still tells you which
department it is.

## The overview (`/departments`)

1. **Hero** — "หนึ่งองค์กร / หลายหน้าที่ / ไม่จำเป็นต้องใช้หน้าจอเดียวกัน", CORE at the centre
   with the six department environments opening outward (existing department scene images).
2. **Why separate workspaces** — the reasons one shared screen fails every role.
3. **Department stage** — a tablist (arrows / Home / End, touch-sized tabs). The selected
   department dominates: large environment image, its idea, today's chips, link to its page.
4. **Six departments** — an editorial index linking each page.
5. **Connected through CORE** — the handoffs between departments; animated pulses on wide
   screens, a readable ordered list everywhere.
6. **Employee · Manager · Executive** — the same data at three altitudes.
7. **CTA**.

## The six pages

| Department | Hero concept | Signature sections | Backdrop motif |
| ---------- | ------------ | ------------------ | -------------- |
| Executive | Signals from five departments converge on one command surface | Organization visibility, สิ่งที่ต้องจับตา, department pulse, exceptions (40 quiet dots, 3 raised), drill-down path | Wide horizon strata |
| Sales | An order travels its route, with a branch to Operations when stock is short | Customer-order responsibility, order progression stepper, stock / Operations dependency fork, delivery visibility with customer message | Concentric route arcs |
| Operations | Team lanes across five days, a late bar, a handoff, a "now" line | Work intake, planning grid, Work Order anatomy, progress & delays, handoff to Warehouse — generic teams (service, installation, projects, production) | Day columns + lane rules |
| Warehouse | A storage location grid with lots, expiry and hold states | Operational privacy, receiving (floor phone), stock by location, lot identity, lot & expiry story, FEFO vs nearest lot, movement log, count & hold/release | Square floor grid |
| Purchasing | PRs flow into POs, out to suppliers, back to Warehouse ("received 2 / 3") | Need → PR, supplier comparison (lead time, terms, history — no prices), PO chain, ordered vs received, late supplier impact | Supplier node field |
| Accounting & Finance | Source documents verified one by one until payment unlocks | Operational-finance positioning (does / is not), payment request, deposit rail, goods & document dependency, document gate, outstanding | Ruled ledger with margin |

### Content rules

- **Warehouse privacy (critical).** The Warehouse page never shows purchase price, cost,
  selling price, supplier payment or accounting amounts — not in copy, sample data, product
  preview or decoration. The only place those words appear is the privacy statement
  (`[data-privacy-statement]`) that says they are absent. Tests enforce this in all three
  locales, and currency symbols never appear on the page at all.
- **Accounting is operational finance.** It is explicitly *not* a full accounting system,
  general ledger, financial statements or tax filing, and never implies it replaces PDA ONE
  accounting. Amounts are shown as "ตามเงื่อนไข PO", never as figures.
- **Operations is not manufacturing-only.** Lanes and examples include service,
  installation and project teams.
- **Minimal illustrative data.** Sample items, lots and POs are labelled as examples
  ("ตัวอย่างสถานะ — ไม่ใช่ข้อมูลจริง"). No revenue, client names, counts or awards.
- **One H1, unique title and description** per page per locale.
- **Product previews** are the only intentional Thai in `/en` and `/zh`; they are `inert`,
  hidden from assistive tech, and captioned as Thai product UI.
- **Simplified Chinese only**; Chinese hero titles are written in short phrase lines so they
  never break mid-phrase.

## Navigation

- The แผนก mega menu links each department to its page; the locale is preserved
  (`/en/departments/warehouse`).
- Solutions → Stock & Expiry Control → `/departments/warehouse`; Management Control →
  `/departments/executive`.
- Homepage Department Worlds and the CORE World detail link to the department page via
  `departmentLink(id)` (ids without a page fall back to `/departments`).
- Every page links back to the overview (switcher + CTA) and to 2–3 connected departments.

## Motion

See [MOTION.md](MOTION.md#department-experience-ep06). Native scroll only, no snapping, no
new WebGL. Autoplaying hero loops (Sales order token, Accounting verification, Operations now
line, SVG pulses) stop under `prefers-reduced-motion` and show their finished state.

## Accessibility

- Tablists use roving focus (`tabs.ts`) with `aria-selected` / `aria-controls`; the
  Accounting document gate uses `role="switch"` with a `role="status"` result.
- Status tone is never colour alone — icon and text always accompany it.
- Interactive targets are at least 44 × 44 px at every tested width.
- Decorative visuals are `aria-hidden`; each hero figure has a localized `aria-label`.

## Adding a department page

1. Add the id to `DEPT_PAGES`, its accent to `DEPT_ACCENT`, its links to `ADJACENT` and a
   backdrop motif to `BACKDROP` in `ui.tsx`.
2. Add `summaries.ts` and overview copy entries in all three locales.
3. Create `<id>/copy.ts` (th / en / zh-CN) and `<id>/<Name>Page.tsx` built from the kit,
   with at least one signature section no other department has.
4. Register it in `DEPARTMENT_PAGES` (`app/router.tsx`) and the mega menu
   (`config/navigation.ts`).
5. The route, H1, meta, localization and connection tests pick it up from `DEPT_PAGES`.
