# EP01-PROTOTYPE — Department Workspace UX Preview

**Date:** 2026-10-21 · **Owner:** PDA BLISS COMPANY LIMITED
**Baseline:** `main` @ `166b7e48ad196b7eafb33bc867984d9f8cd8dc27` (EP00)

## Scope decision

The original EP01 brief (PostgreSQL, Prisma migrations, real authentication, refresh-token
rotation, password reset, invitations) was **deferred by owner decision** before anything
was committed. This episode instead delivers a clean internal prototype for reviewing how each
department workspace looks and behaves.

Deferred, not started:

- PostgreSQL setup and database creation (no database was created or contacted)
- Prisma migrations and seed data (the EP00 schema is unchanged)
- Real authentication: Argon2id hashing, access/refresh cookies, rotation, sessions
- Forgot/reset password, invitations, suspension, persisted auth audit events
- Real user persistence and server-side authorization of `/app` data

Local EP01 auth/database work that had been started (dependency additions, a schema draft,
an offline-generated migration file and a generated Prisma client) was **reverted before any
commit**; the tree was confirmed identical to the EP00 baseline before prototype work began.

## What was delivered

### Demo-only access (isolated in `frontend/src/prototype/`)

| Item                | Behaviour                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| Login               | `/login`, username + password, show/hide password, Thai validation, brief loading state, error state |
| Demo account        | `user1` / `pass1` — checked in the browser only; **not authentication**   |
| Session             | `sessionStorage` flag `pbc.prototype.session` (ends with the tab). The password is never stored |
| Gate                | `/app/*` redirects anonymous visitors to `/login?next=…`                   |
| Redirect            | After sign-in → `next` (same-app `/app/...` paths only) or the last viewed workspace (default Executive) |
| Workspace switcher  | Top-bar menu, labelled *สลับพื้นที่ทำงาน · ต้นแบบ*, with a note that production opens the assigned workspace automatically |
| Sign-out            | User menu → *ออกจากระบบ* clears the flag and returns to `/login`           |
| Prototype marker    | A thin banner on every workspace page: *ต้นแบบ · โหมดตรวจ UX … ไม่ใช่ระบบเข้าสู่ระบบจริง* |
| Production builds   | Prototype disabled unless `VITE_ENABLE_PROTOTYPE=true`; verified that `pass1` is absent from the production bundle |

Future production behaviour is unchanged: **user signs in → the system opens the assigned
department workspace.** No company selector exists anywhere.

### Workspaces

Every workspace shares one calm shell (sidebar, top bar, mobile bottom nav) but has its own
accent, hero motif and layout. Content is minimal: small labelled samples (*ตัวอย่าง*) and
empty states instead of datasets. No transaction history.

| Workspace  | Overview layout                                                                 | Modules |
| ---------- | ------------------------------------------------------------------------------- | ------- |
| Executive  | Today summary (4 metrics) · 5 department cards, each in its own department hue, linking to that workspace · exception area (2 samples) | ข้อยกเว้น, รายแผนก |
| Sales      | 5-step sales workflow · orders (empty state) · delivery status                  | คำสั่งซื้อ, สถานะการจัดส่ง, ลูกค้า |
| Warehouse  | Pricing-privacy notice · 4 large task cards (receiving, stock, lot/expiry, stock count) · receiving (empty) · FEFO lots (2 samples) · mobile scan button | รับสินค้า, สต็อก, ล็อต / วันหมดอายุ, ตรวจนับ |
| Purchasing | PR → PO pipeline · PR approvals (empty) · supplier follow-up (2 samples)        | ใบขอซื้อ (PR), ใบสั่งซื้อ (PO), ติดตามซัพพลายเออร์ |
| Operations | Work-order board (4 columns, mostly empty) · week planning strip                | ใบสั่งงาน, วางแผน, ความคืบหน้า |
| Accounting | Summary · payment requests (empty) · pending payments (2 samples) · "conditions before paying" document checklist with a locked pay button | คำขอจ่ายเงิน, รอชำระ, ยอดค้างจ่าย |
| Admin      | Users (empty — no stored users) · canonical departments with stable codes · 5 role placeholders | ผู้ใช้งาน, แผนก, บทบาท |

Module pages show the module's purpose, an empty state and planned capabilities — no fake records.

Removed from EP00: the dense mock tables, the fictional staff personas in the top bar, the
Executive chart (and the now-unused Recharts dependency), and the workspace API-status poller.
The public CORE Universe site is unchanged.

## Verification

| Gate                         | Result |
| ---------------------------- | ------ |
| Frontend `npm ci`            | ✅ 0 vulnerabilities |
| Frontend typecheck           | ✅ |
| Frontend lint                | ✅ 0 errors, 0 warnings |
| Frontend format check        | ✅ |
| Frontend tests               | ✅ 50 passed (4 files) |
| Frontend build               | ✅ |
| Backend (unchanged) db:validate / typecheck / lint / format / tests / build | ✅ / ✅ / ✅ / ✅ / 21 passed / ✅ |

Frontend tests cover: the gate for every workspace (anonymous → `/login?next=…`); each
workspace rendering its own navigation and the prototype marker; `/app` opening a workspace
directly with no company picker; login validation, wrong-credential error, loading state,
redirect to the requested workspace, password toggle, and rejection of off-site `next`
targets; the switcher; sign-out; demo-session storage (flag only, never the password);
distinct accents; warehouse privacy on the overview and every warehouse module page.

### Browser QA (in-app browser)

- Real flow through the UI: anonymous `/app/warehouse` → login → wrong password error →
  correct sign-in → landed on `/app/warehouse` → switcher → Accounting → sign-out →
  `/app/sales` redirected back to login.
- Visual review at 390px: Executive, Accounting, Operations, Admin, Warehouse, switcher menu,
  login. (The Browser pane was ~280px wide during this session, so desktop layouts were
  verified structurally rather than by screenshot: sidebar shown, bottom nav hidden, content
  1176px, Executive 5 department columns, Warehouse 2 task columns, Admin 5 role columns.)
- Horizontal overflow: 7 workspaces × 8 widths (320, 375, 390, 430, 768, 1024, 1280, 1440) =
  56 checks, 0 px overflow. One overflow found at very narrow widths in the Warehouse task
  cards was fixed during QA.
- Network: the seven workspaces make zero cross-origin requests.
- Warehouse: no currency or price text on any warehouse page.

### UTF-8 / Thai integrity

Scanned 129 text files (47 containing Thai): 0 BOMs, 0 invalid UTF-8 sequences,
0 U+FFFD characters, 0 cp1252-mojibake patterns. All edits were made with UTF-8-safe tools.

## Known limitations

- The demo sign-in is not security: anyone with the dev server can sign in; it guards only
  sample UI. Real authentication remains future work.
- Sample numbers are illustrative and not connected to any data.
- Primary actions (create PO, record payment, invite user, scan barcode) are visibly disabled.
- Workspaces use the dark theme only.

## Later: EP15 sign-in redesign

EP15 replaced the sign-in page's look with the CORE Gateway ([LOGIN_EXPERIENCE.md](LOGIN_EXPERIENCE.md)).
The prototype mechanics described above are unchanged: `prototypeSignIn()`, the sessionStorage
flag, `?next=` handling, `PrototypeGate` and the production disable. The page no longer prints any
credential, and the demo account is documented only here, in the README and in tests.

## Next steps (when the owner is ready)

1. Owner provisions PostgreSQL credentials (`pdabliss_core_dev` / `pdabliss_core_test`).
2. Resume the original EP01 identity & authentication scope, replacing `src/prototype/`.
