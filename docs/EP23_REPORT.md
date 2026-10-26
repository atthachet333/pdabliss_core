# EP23 — Account & Real Authentication Foundation

**Date:** 2026-10-26 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** WIP commit `b2cbc49` (`wip: continue CORE account and authentication foundation
(EP23)`) on top of the EP22 freeze `bc97424`. The WIP was moved from another machine and is already
on `origin/main`; it was continued, not restarted or rewritten.

**Completion commit:** `feat: establish CORE account and real authentication foundation (EP23)` —
local only, **not pushed**. EP24 not started.

Design reference: [AUTHENTICATION.md](AUTHENTICATION.md).

## 1. What EP23 delivers

| Area | Result |
| --- | --- |
| Database | PostgreSQL + Prisma, one migration `20261026083839_ep23_account_auth_foundation`; users, credentials, platform roles (single owner enforced in SQL), sessions, trusted devices, OTP challenges, verification / reset tokens, invitations, auth audit; normalized-email uniqueness |
| Registration | Strict schema (role injection refused), normalized email, duplicate-safe generic answer, password policy (≥ 10, common / email-derived refused), plan intent recorded |
| Verification | Fragment-delivered single-use link, 24 h, resend cooldown + daily cap, "already verified" |
| Sign-in | Argon2id, enumeration-safe, timing-equalised; status revealed only after the right password |
| OTP | Random 6 digits, 10 min, single use, 5 tries, resend cooldown / caps, HMAC at rest, browser-bound; every sign-in for platform accounts; no static or test code |
| Sessions | Server-side, HttpOnly cookie, hash at rest, idle + absolute expiry (shorter for platform), rotation with grace, logout / logout-all / per-device revoke, reset & suspension revocation |
| Recovery | Generic forgot, 30-min single-use reset link, all sessions + devices + pending codes revoked |
| Platform | Owner-only operator management with step-up; admin cannot touch the owner or other admins; customers 403 |
| Invitations | Email + company binding, inviter, 7-day expiry, single use, revoke; no full UI (later episode) |
| Audit | 23 event types, keyed-hash attribution, no secrets |
| Frontend | `/login` (real), `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account`, `/account/invitation`, `/platform`; `/app` behind the real session |

## 2. Completed in this continuation (after `b2cbc49`)

**Inspection** — 91-file WIP reviewed. The auth core (crypto, password, OTP, sessions, platform
authorization, schema constraints) was read in full; no bypass, no static code, no plaintext
storage found.

**Fixes**

| # | Finding | Severity | Fix |
| --- | --- | --- | --- |
| F1 | `backend/.env.example` (in the pushed WIP) held the owner's **real email and a real-looking owner password** | P0 (secret) | Replaced with placeholders (`owner@example.com`, `platform.admin@example.com`, `change-me`), which the seed refuses. History is already pushed and is not rewritten (no force-push): the value must be treated as **exposed** and never used — the local owner password was regenerated (see §6). |
| F2 | `.claude/launch.json` committed two QA servers pointing at another machine's temp folder | P3 (temp file) | Restored to the EP22 version |
| F3 | Per-IP 429 answered with code `BAD_REQUEST` | P3 | `RATE_LIMITED` (+ test) |
| F4 | "Forgot password?" link on `/login` 20 px tall | P2 (target size) | 44 px hit area, layout unchanged (+ test) |
| F5 | After sign-in, keyboard focus fell back to `<body>` | P2 (a11y) | Portal / Control Center start focus at `<main>` when nothing holds focus (+ test) |
| F6 | During local setup a real `DATABASE_URL` (with password) was written into the working copy of `backend/.env.example` | P0 if committed | Caught by the pre-commit secret scan and restored to the placeholder — **never committed** |

**Added tests**

- `backend/test/auth-audit.test.ts` — one full journey records `REGISTER`, `EMAIL_VERIFIED`,
  `LOGIN_FAILURE`, `OTP_SENT`, `OTP_FAILURE`, `OTP_SUCCESS`, `LOGIN_SUCCESS`, `SESSION_REVOKED`,
  `LOGOUT`, `LOGOUT_ALL`, `PASSWORD_RESET_REQUEST`, `PASSWORD_RESET_SUCCESS` with no password, code,
  token or cookie in any stored event (six of these were not asserted before).
- `auth-login.test.ts` — the 60/5-min per-IP sign-in limit does not widen guessing: from one IP,
  one account is throttled after 10 failures while a colleague on the same IP still signs in; per-IP
  429 code.
- Frontend — `/platform` overflow fix guarded (long addresses wrap or truncate in shrinkable boxes;
  cards `min-w-0`); 44 px forgot link; focus at `<main>` after sign-in.

## 3. Verification

### Gates

| Gate | Result |
| --- | --- |
| Frontend `npm ci`, typecheck, lint, format:check | pass |
| Frontend tests | **35 files / 860 tests** |
| Frontend build (+ prerender, verify, perf budget) | pass — 105 indexable pages + 3 shells; initial JS 180.3 kB gzip / 205 kB (frozen 179.6 kB; +0.7 kB is the lazy route table) |
| Backend `npm ci`, typecheck, lint, format:check, build | pass |
| Prisma validate / `migrate deploy` / `migrate status` | valid · applied · up to date |
| Backend tests (`pdabliss_core_test`, rebuilt each run) | **11 files / 128 tests**, 0 skipped |

### Bootstrap and seed (`pdabliss_core_dev`)

- First run: owner + admin created. Second run: both **unchanged** (idempotent, no password change).
- Demo seed: labelled demo company, 6 departments, `COMPANY_OWNER`, `SYSTEM_ADMIN`, `EXECUTIVE`,
  `DEPARTMENT_STAFF` created; second run unchanged.
- Database: exactly one `PLATFORM_OWNER` (owner slot, configured email), one `PLATFORM_ADMIN`
  (`platform.admin@pdabliss.com`); 6 credentials, all Argon2id.
- The seed correctly **refused** too-short initial passwords before anything was written.

### Real-stack role verification (UI + API, web :1111 → API :1112 → dev database)

45 checks per browser; codes and links read from the development mail sink.

| | Chrome | Edge | Firefox |
| --- | --- | --- | --- |
| Role verification | 45/45 | 45/45 | 45/45 |

Covered: owner sign-in (password + emailed code) → `/platform`, UI shows PLATFORM_OWNER, owner-only
area and API; a customer cannot be made platform admin (409); two browsers, session list,
logout-all ends both; logout; generic forgot answer; reset by emailed link revokes the live session;
reset link single use. Admin → `/platform`, no owner-only area; backend **403** for operator list,
grant, revoke, and suspending the owner (`OWNER_PROTECTED`). COMPANY_OWNER / SYSTEM_ADMIN /
EXECUTIVE / STAFF demo → `/account`, no platform role server-side, platform API 403, `/platform`
redirects to `/account`, no payment/company claims. Registration with `role=PLATFORM_OWNER` → 400.
Wrong password and unknown account answer alike.

Rate limits observed live: a repeated QA run hit the per-IP forgot limit (generic `429`) and the
owner's hourly reset cap (silent, generic) — both by design; QA aged dev-database rows between
runs instead of loosening limits.

### Responsive and accessibility (EP23 screens only)

- `/login` (TH/EN/ZH), `/register` (TH/EN), `/forgot-password`, `/reset-password`, `/verify-email`,
  the code step, `/account` (staff, company owner), `/platform` (owner, admin) at **320, 375, 390,
  430, 768, 1024, 1440**: no page overflow, no off-screen or clipped controls, one `h1`, **no axe
  violations** (WCAG 2.x A/AA + best practice) — Chrome, Edge, Firefox.
- Keyboard-only sign-in (all three browsers): skip link first; wrong password → alert with
  `aria-invalid` / `aria-describedby`; focus moves to the code field; wrong code announced with
  tries left; landing focus on `<main>`; keyboard sign-out.
- Code input: labelled, `autocomplete="one-time-code"`, numeric keyboard.
- Checkboxes (terms, trust browser) are 18 px inside full-width labels (the label is the target).
- Reduced motion: EP23 spinners stop (`motion-reduce:animate-none`); other transitions are colour
  only and neutralised by the global reduced-motion rule.

### Public freeze regression

- 35 route families, 105 indexable URLs, 3 shells, prerender verification, sitemap (no new
  routes), robots, redirects (`_redirects` serves the new routes from `login.html` / `app.html`,
  both `noindex`), discoverability and SEO suites — pass.
- Bundle isolation: every auth / account / platform page is a lazy dynamic entry; none of their
  modules or strings is in the homepage's initial chunks; `/app` stays separate.
- Pricing, header / footer, Warehouse privacy and claim suites unchanged and passing.
- The login gateway's form changed with real authentication (Category B in the freeze policy) —
  presented here for owner review.

### Secrets

- Tracked files scanned for `.env`, emails, passwords, tokens, SMTP credentials, `DATABASE_URL`
  credentials: only placeholders and `*@pdabliss.test` / `@example.com` fixtures remain (F1 fixed).
- `backend/.env` and `backend/.env.test` are git-ignored. The QA server log (12 k lines) contains no
  password, secret, code, link token or session cookie value.

## 4. Known limitations

- Real SMTP delivery not exercised (dev sink + test mailer only).
- Safari and real devices unavailable; Windows Chrome / Edge / Firefox (Playwright build) only.
- Screen-reader output not heard: accessibility verified by axe, the accessibility tree and
  keyboard runs.
- Per-account throttling allows a targeted temporary sign-in block (15 min).
- The previously exposed owner password remains in pushed history (`b2cbc49`).
- Payment, subscriptions, company creation, branches, Company Control Center, employee management
  and in-product RBAC are not in EP23.

## 5. Status

- **Push status:** NOT PUSHED.
- **EP24:** not started.

## 6. Local setup note for the owner

During verification the local `backend/.env` was completed (values never printed): a random
`AUTH_SECRET`, random demo passwords, `PLATFORM_ADMIN_EMAIL=platform.admin@pdabliss.com`, and
**new random owner / admin initial passwords** (the previous owner value was the exposed one and was
also too short). `backend/.env.test` points the suites at `pdabliss_core_test`. During the reset
check the owner password was reset to the same `.env` value, so `.env` stays correct.
