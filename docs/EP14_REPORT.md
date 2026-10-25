# EP14 — Explore CORE Interactive Demo

**Date:** 2026-10-25 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** `693fa3c` (EP13, approved and on `origin/main`). Before work: branch `main`, local
`main` == `origin/main`, working tree clean.

**Commit:** `feat: create interactive CORE public demo (EP14)` — local only, **not pushed**.
Awaiting owner visual review.

## Scope

Public frontend only. Not implemented, by design: database, Prisma, real auth, real APIs,
persistence, a backend workflow engine, notifications, RBAC, the inquiry backend
(`POST /api/inquiries` stays deferred), billing, user accounts and any `/app/*` change. No new
dependencies, no WebGL, no images or video.

`/demo`, `/en/demo` and `/zh/demo` give a no-login, in-memory demo of one work item (SO-1042)
moving through Sales, Warehouse, Purchasing, Accounting and the Executive view. Details:
[INTERACTIVE_DEMO.md](INTERACTIVE_DEMO.md).

## What a visitor experiences

1. Orientation — *ลองดูว่า CORE ทำงานอย่างไร — ผ่านงานหนึ่งชิ้น*, DEMO tag, *ข้อมูลจำลอง — ไม่มีการบันทึก*
2. Role selection — five roles, each with what it handles / sees / does not see
3. A shared work-item bar and a keyboard role tablist; switching roles never resets progress
4. Stock shortage (120 ordered, 20 on hand) → purchase request → PO
5. Partial receipt 80 / 100 → **DETECT** 20 outstanding → exception opens on the Executive view
6. Balance confirmed and received → exception clears
7. **PREVENT** — receiving cannot close without lot / expiry; the visitor records a sample lot
8. Accounting document gate (operational finance only) → approval
9. **FEFO** suggestion → picking → ready to deliver → delivered
10. Calm completion — 7 handoffs · 4 departments · 1 exception · 1 prevented · 13 events — then
    *ขอ Demo กับทีม PDA BLISS* → `/contact?interest=demo`, *ดูแพ็กเกจ* → `/pricing`, *ลองใหม่*

Guided mode follows the work to its next owner; Explore mode lets the visitor move freely. Reset
and Exit are always available; refresh also starts over.

## Warehouse privacy

`WarehouseView` contains no price, cost, margin, amount, currency or supplier terms. The data is
never built, so nothing is hidden with CSS. A test walks all 12 states and scans the Warehouse
view object. Another test confirms that Sales, Purchasing and Accounting do carry their sample
values.

## Files

New

- `frontend/src/features/demo/`: `scenario.ts`, `machine.ts`, `views.ts`, `copy.ts`, `format.ts`,
  `Landing.tsx`, `Shell.tsx`, `Workspaces.tsx`, `demo.test.tsx`
- `frontend/src/pages/public/DemoPage.tsx`
- `docs/INTERACTIVE_DEMO.md`, `docs/EP14_REPORT.md`

Changed

- Route: `app/router.tsx`, `test/publicRoutes.ts`, `public/sitemap.xml` (+3 URLs, 78 total)
- Discoverability:
  - `config/navigation.ts` and `i18n/messages/{th,en,zh-CN}.ts` (mega menu item)
  - `features/workflow/copy.ts` and `ChaptersView.tsx` (How CORE works CTA)
  - `features/departments/common.ts` and `ui.tsx` (`/demo?role=`)
  - `features/solutions/copy.ts` and `StoriesA.tsx`
  - `features/why-core/copy.ts`, `model.ts` and `Principles.tsx`
- `components/ui/buttonStyles.ts`: buttons passed `whitespace-normal` now wrap instead of
  clipping. Fixes long labels at 320 px in the demo, the EP13 contact hand-off and the homepage
  hero.
- Docs: `README.md`, `PUBLIC_SHELL.md`, `BRAND.md`, `MOTION.md`

Untouched: backend, `/app/*`, the prototype AppShell, the demo login and auth.

## Quality gates

| Gate | Frontend | Backend |
| --- | --- | --- |
| `npm ci` | ✓ | ✓ |
| `npm run typecheck` | ✓ | ✓ |
| `npm run lint` | ✓ (0 problems) | ✓ |
| `npm run format` / `format:check` | ✓ | ✓ |
| `npm test` | ✓ 611 / 24 files (30 new) | ✓ 21 / 4 files |
| `npm run build` | ✓ | ✓ |

### Bundle (vs. `693fa3c`)

| | Baseline | EP14 |
| - | - | - |
| `DemoPage` chunk | — | 86.4 kB (22.9 kB gz), lazy |
| Entry `index.js` | 759.5 kB (224.6 kB gz) | 760.5 kB (225.0 kB gz) |
| CSS | 280.8 kB (43.9 kB gz) | 283.8 kB (44.2 kB gz) |
| Images / video | — | none added |

### Browser QA

- **Viewports:** `/demo` at 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1280×720,
  1440×900 and 1920×1080. Each was checked in four states: landing, mid-scenario, open exception
  and complete. All had one H1, no horizontal overflow and no console errors.
- **Roles:** all five at 1440. Warehouse at 390, including the PREVENT notice and the FEFO pick.
- **Full scenario runs:** Thai at 1440 and 390. Representative EN and ZH paths at 320 and 1440.
- **Accessibility:** keyboard role switching (arrows / Home / End), focus moving to the handoff,
  live announcements, and reduced motion (no pulse, no fades).

Fixed during QA:

- the outstanding chip lingered after 100 / 100 (the exception now clears when the balance
  arrives)
- duplicate "go to owner" buttons
- the PREVENT notice was far from its action on phones (the lot form now comes first)
- clipped long button labels at 320 px (the `buttonClasses` wrap fix above)

Regression smoke (H1, overflow, console): `/`, `/about`, `/why-core`, `/contact?interest=demo`,
`/industries`, `/industries/property`, `/enterprise`, `/solutions`, `/how-core-works`,
`/pricing`, `/departments`, `/departments/warehouse`, `/login`, `/app/warehouse` (demo gate),
`/en/demo` and `/zh/contact`.

## Known limitations

- One scenario only (`customer-order`); other `?scenario=` values fall back to it.
- State is in memory only: refresh resets it, and there is no shareable progress link.
- The Operations department page has no demo link, because Operations has no role in this
  scenario.
- The QA browser pane ran in the background, so screenshots sometimes lagged a role switch.
  State was verified via the DOM. Chromium only.
- Inquiry delivery is still deferred: the completion CTA opens the existing `/contact` hand-off.

## Recommended EP15

Connect the EP13 inquiry seam to real, owner-approved delivery:

- a `POST /api/inquiries` route in the existing backend, with validation mirroring
  `contact/validation.ts`
- rate limiting and a stored record
- an email or LINE notification to PDA BLISS
- a privacy notice for stored inquiries
- a success state that appears only when delivery returns `ok`

The demo's *ขอ Demo* CTA would then end in a delivered request.
