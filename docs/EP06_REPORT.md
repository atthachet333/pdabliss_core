# EP06 — Department Experience

**Date:** 2026-10-23 · **Owner:** PDA BLISS COMPANY LIMITED
**Baseline:** `29cb98e1c9870f4387a0c45703314e9b2f1df36b` (local `main` == `origin/main`, clean
tree — EP05 and its revision were pushed by the owner)
**Commit:** `feat: create department experience pages (EP06)` — local only, **not pushed**

## Scope

Public frontend only:

1. `/departments` redesigned as a philosophy page — not a card directory.
2. Six dedicated department pages: `/departments/{executive,sales,operations,warehouse,
   purchasing,accounting}`, each also under `/en/...` and `/zh/...`.
3. The แผนก mega menu (and the homepage / CORE World department links) point to the pages.

Not touched: `/login`, `/app/*`, prototype auth, internal AppShell, `components/core`,
`components/shell`, `workspaces/`, `prototype/`, `public/` assets, the backend, Prisma,
PostgreSQL, RBAC, persistence, billing (empty diff against the baseline for all of them).
Header, footer, homepage and CORE World are unchanged apart from department link targets.

Full design reference: [DEPARTMENT_EXPERIENCE.md](DEPARTMENT_EXPERIENCE.md).

## What was built

### `/departments` — philosophy page

Hero *หนึ่งองค์กร / หลายหน้าที่ / ไม่จำเป็นต้องใช้หน้าจอเดียวกัน* (CORE at the centre, six
environments opening outward) → why separate workspaces → interactive department stage
(tablist; selected department dominates; keyboard and touch) → six department index →
connected through CORE → employee · manager · executive → CTA.

### Six department pages

Built from one kit (`features/departments/ui.tsx`) for consistency, each with its own hero
concept, signature sections and page-wide backdrop motif:

| Department | Hero | Signature sections |
| ---------- | ---- | ------------------ |
| Executive | Signals converge on a command surface | Organization visibility · สิ่งที่ต้องจับตา · department pulse · exceptions · drill-down |
| Sales | An order travels its route | Customer-order responsibility · order progression · stock/Operations dependency · delivery visibility |
| Operations | Team lanes over five days with a now line | Intake · planning · Work Order · progress & delays · handoff (service, installation, projects — not manufacturing-only) |
| Warehouse | Location grid with lots and expiry | Operational privacy · receiving · stock · lot/batch · lot & expiry story · FEFO · movement · count |
| Purchasing | PR → PO → suppliers → Warehouse | Need → PR · supplier comparison (no prices) · PO chain · receiving status · late supplier |
| Accounting & Finance | Documents verified until payment unlocks | Operational-finance positioning · payment request · deposit · goods/document dependency · document completeness · outstanding |

Every page also has: งานที่เข้ามา / สิ่งที่ต้องทำ / สิ่งที่ส่งต่อ, "วันนี้" example states,
manager perspective, the real EP02 CORE screen (lazy, inert, captioned as Thai product UI with
sample data), 2–3 connected department links and a quiet CTA (ขอคำปรึกษา · ดูวิธีการทำงานของ
CORE · สำรวจแผนกอื่น).

### Navigation

- แผนก mega menu: six items → `/departments/<id>`, locale preserved.
- Solutions: Stock & Expiry Control → `/departments/warehouse`; Management Control →
  `/departments/executive`.
- Homepage Department Worlds and the CORE World detail → `departmentLink(id)`.

## Content safeguards

- **Warehouse:** no purchase price, cost, selling price, supplier payment or accounting amount
  anywhere — copy, sample data, preview or decoration. The words appear only in the privacy
  statement that says they are absent; no currency symbol appears on the page. A Warehouse
  handoff line that mentioned "payment" was reworded during testing.
- **Accounting:** positioned as operational finance; explicitly not a full accounting system,
  ledger, financial statements or tax filing; no implication that it replaces PDA ONE; amounts
  shown as "ตามเงื่อนไข PO".
- Minimal illustrative data, labelled as examples; no revenue, clients, counts or awards.
- Contact details unchanged and centralized in `config/contact.ts`.

## Verification

### Gates (clean copy, `npm ci`)

| Package | npm ci | typecheck | lint | format:check | test | build |
| ------- | ------ | --------- | ---- | ------------ | ---- | ----- |
| frontend | ✓ | ✓ | ✓ | ✓ | ✓ 263 / 263 (14 files) | ✓ |
| backend | ✓ | ✓ | ✓ | ✓ | ✓ 21 / 21 (4 files) | ✓ |

New `features/departments/departments.test.tsx` — 66 tests: 7 routes × 3 locales render one
H1 and the right `<html lang>`; unique title, description and H1 across all 21 pages; unknown
department → 404; department identity and In/Do/Out; Accounting positioning; Operations not
manufacturing-only; Warehouse no money/price/cost (th/en/zh, preview included); product
preview per page; no Thai in `/en` and `/zh` bodies; Simplified Chinese; mega-menu links (th
and en); connected department + CTA links; overview tablist keyboard; reduced motion. Existing
tests updated only for the new link targets.

### Live QA — headless Chrome, emulated viewports

- 390×844, 768×1024, 1280×720, 1440×900, 1920×1080 for all seven pages; 320×568 for
  `/departments` and Warehouse: one H1, zero horizontal overflow, no element outside the
  viewport, no console errors or exceptions.
- Touch targets: no interactive element under 44 px in either dimension (390 px).
- Reduced motion: heroes show finished states (EN Sales, ZH Accounting, ZH overview checked).
- `/app`, `/login`, `/contact`, `/en/contact` respond normally.
- **Side-by-side review** (mid-page screenshots with the title cropped): each department is
  identifiable from its signature section and backdrop motif — Executive dots/pulse,
  Sales route and chat bubble, Operations assignment grid, Warehouse lots/FEFO, Purchasing
  ordered-vs-received bars, Accounting document gate.

### Bundle (vs. baseline `29cb98e`)

| | Baseline | EP06 |
| - | - | - |
| Entry `index.js` | 736.3 KB (216.3 KB gz) | 738.0 KB (216.8 KB gz) |
| All JS | 2 035 KB (594 KB gz) | 2 271 KB (666 KB gz) |
| CSS | 148.3 KB | 174.3 KB |
| JS chunks | 36 | 45 |

Department pages are lazy chunks: Executive 8.5 KB gz, Sales 9.1, Operations 8.8, Warehouse
12.7, Purchasing 8.8, Accounting 8.6, shared kit 5.9; the overview chunk grew 5.7 → 34.9 KB.
No new images, fonts or WebGL — pages reuse the existing department scenes (lazy-loaded). The
Vite large-chunk warning pre-dates EP06 (entry chunk).

### Text and scans

All 36 files in the commit: valid UTF-8, no BOM, no U+FFFD, no mojibake, LF line endings; no
Traditional Chinese characters in `zh-CN` copy (the only hit is the test's own deny-list).

## Fixed during QA

- Chinese hero titles broke mid-phrase in the hero column → rewritten as short phrase lines.
- Warehouse → Accounting handoff wording mentioned payment → reworded to document matching.
- Department pages looked template-like mid-page → page-wide backdrop motif per department.

## Known limitations

- The receiving phone screen on the Warehouse page is a design direction, labelled as such.
- Product previews reuse the EP02 prototype screens; they are Thai in every locale by design.
- Some Thai hero titles wrap to four lines at 1280–1440 px (word-boundary wraps, no overflow).
