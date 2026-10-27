# EP24 — Company & Subscription Foundation

**Date:** 2026-10-27 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** WIP commit `d4b8105` (`wip: continue CORE company and subscription foundation
(EP24)`) on top of EP23 `4455abd`, already on `origin/main`. Continued on another machine — not
restarted, not reset, history not rewritten.

**Completion commit:** `feat: establish CORE company and subscription foundation (EP24)` — local
only, **not pushed**. EP24.1 and EP25 not started.

Design reference: [COMPANY_SUBSCRIPTION.md](COMPANY_SUBSCRIPTION.md).

## 1. What EP24 delivers

| Area | Result |
| --- | --- |
| Migration | `20261026150000_ep24_company_subscription_foundation`, additive; Department codes converted in place; owner backfill; CHECK constraints for owner, Head Office and current-subscription slots |
| Company | Transactional onboarding (company + owner + Head Office `00000` + departments + pending subscription + audit), one company per customer account, double-submit safe, lifecycle + onboarding status |
| Package catalog | `backend/src/billing/catalog.ts` — Starter ฿399, Business ฿699 (recommended), Professional ฿999, Enterprise quotation; annual terms; parity test against the frozen public `plans.ts` |
| Entitlements | From the subscription snapshot: Starter max 2 / no Executive / 3 GB / no API; Business max 4 / Executive / 10 GB / API add-on; Professional 6 / 30 GB / API included; Enterprise custom; all branches; Lot / Expiry / FEFO with Warehouse |
| Subscription | Starts `PENDING`; no paid state; customers cannot activate; development activation (platform operator + step-up) is not registered in production; audited `paid: false` |
| Security | Strict bodies (server-decided fields → 400); company from membership only; cross-company Company / Branch / Subscription / Department reads blocked (404 / 403) |
| Platform | Owner and admin: company list + detail (foundation level); owner-only capabilities unchanged |
| Demo | `PDA BLISS CORE DEMO COMPANY`: Professional, ACTIVE (demo state), six departments, Head Office `00000`; seed idempotent |
| Frontend | Account Portal onboarding (progress → package → company → pending / active); plan carry-over `/pricing` → `/login?plan=` → `/account?plan=`; Platform Control Center company list; public Pricing page unchanged |
| Auth & email polish | Check-your-email, verification, reset and code-step states; CORE email layout with one dominant button, small fallback link and true facts |

## 2. Completed in this continuation (after `d4b8105`)

**Inspection.** The 40-file WIP was reviewed against the repository: schema, migration, catalog,
entitlements, input schemas, company service, routes, seed, mail templates, Account Portal,
onboarding, Platform Control Center and tests. The server rules matched the brief; no client-side
only limit, no self-activation path, no fake paid state was found.

**Fixes**

| # | Finding | Severity | Fix |
| --- | --- | --- | --- |
| F1 | A plan picked on `/pricing` (`/login?plan=professional`) was silently dropped when the account already held a package from registration — the company form opened on the old plan | P2 (onboarding) | The package step is offered once, preselected, when `?plan` differs from the saved plan; keeping the saved plan continues to the form (+ 2 tests) |
| F2 | The step-up code email said "if you were not trying to sign in" — wrong for a step-up code | P3 (copy accuracy) | Purpose-specific wording in TH / EN / ZH (+ test) |
| F3 | Register terms checkbox label was a 20 px-high target at desktop widths | P3 (target size, WCAG 2.5.8) | `min-h-6` (24 px), layout unchanged |
| F4 | A doc comment in `session.ts` was separated from its function | P4 | Moved back |

**Not changed:** authentication security behaviour, pricing, public routes, header, footer, SEO,
Warehouse privacy, the EP24 platform view's foundation scope.

## 3. Verification

### Gates

| Gate | Result |
| --- | --- |
| Backend `npm ci`, typecheck, lint, format / format:check, build | pass |
| Prisma validate · `migrate deploy` · `migrate status` | valid · applied · up to date |
| Backend tests (test DB dropped and rebuilt from the migrations each run) | **14 files / 177 tests**, 0 skipped |
| Frontend `npm ci`, typecheck, lint, format / format:check | pass |
| Frontend tests | **37 files / 882 tests** (two clean full runs; one earlier run had a single register-test failure under concurrent load that did not reproduce) |
| Frontend build (+ prerender, verify, perf) · `npm run perf` | pass — 105 indexable pages + 3 shells; within budget |

### Database

- **Fresh path:** new database → `migrate deploy` (2 migrations) → seed: owner, admin, demo company,
  Head Office, subscription and four identities created; **second run: all `unchanged`**.
- **EP23 → EP24 upgrade** on a copy of an EP23 development database (7 users, 7 credentials, 25
  sessions, 101 auth events, 1 company, 4 members, 6 departments, 2 platform roles): every count
  identical after the migration; department codes `accounting…` → `ACCOUNTING…`; `COMPANY_OWNER`
  got the owner slot; the demo seed then added the Head Office and an ACTIVE Professional
  subscription; **password hashes unchanged**; second seed run `unchanged`. The original EP23
  database was not touched.

### Real-stack flows (API → PostgreSQL, dev mail sink) — 61/61

- **A. New customer:** register (plan intent) → unverified sign-in refused → verify → sign in with
  the emailed code → `NEEDS_COMPANY` with the carried plan → confirm package → create company →
  Head Office `00000`, `COMPANY_OWNER`, chosen departments, subscription `PENDING`, company
  `PENDING_SUBSCRIPTION`, no CORE access → `PENDING_ACTIVATION`; second company `409`. Done for
  Starter and Business.
- **Limits (server):** Starter + Executive `422`, Starter 3 departments `422`, Business 5 departments
  `422`; client `plan`, `status`, price fields `400`.
- **Isolation:** `?companyId=` ignored; Company A → Branch B `404`, Subscription B `404`,
  departments A only, platform detail of B `403`, platform list `403`; demo owner → customer branch
  `404`.
- **Self-activation:** customer → development activation `403`; no customer activation route
  (`404`).
- **B. Demo owner:** `ACTIVE`, Professional, six departments, Head Office `00000`, 30 GB, API
  included; demo staff sees the demo company as `DEPARTMENT_STAFF`.
- **C. PLATFORM_OWNER:** company list (demo + new companies, plan, status, counts), detail without
  secret hashes, operator list allowed, development activation → company `ACTIVE`, second
  activation `409`.
- **D. PLATFORM_ADMIN:** list and detail allowed; operator list and grant `403`; cannot onboard a
  company (`403`).

### Browser QA (EP24 / auth surfaces only)

Playwright against the real stack. Surfaces: `/login` (TH / EN / ZH), `/register` and its
check-your-email state, `/verify-email` (invalid, missing, verified EN, reused ZH),
`/forgot-password` and check-your-email, `/reset-password` (form, mismatch, success, used EN, invalid
ZH), the code step and a wrong code, `/account` (package step, company form with errors, pending,
reload, demo owner active), `/platform` (owner, admin). Each at **320, 390, 430, 768, 1024, 1440**:
no horizontal overflow, one `h1`, targets ≥ 24 px at 320 and 1440, axe (WCAG 2.0–2.2 A/AA + best
practice) at two widths per surface; keyboard: arrow keys between packages with a visible focus
indicator, focus to the first invalid field, focus to the code field, wrong code announced as
`role=alert`; reduced motion emulated.

| Chrome | Edge | Firefox |
| --- | --- | --- |
| 273/273 | 273/273 | **not run** — both installed Playwright Firefox builds fail to start on this machine ("side-by-side configuration is incorrect"); a fresh browser download was not made without approval |

Safari not available.

### Emails

Verification, sign-in code, step-up code, reset, password changed, existing account, invitation:
one PDA BLISS CORE band, one dominant button (none for a code), the link once more small, facts
matching the server policy (verify 24 h single use; code 10 min, single use, do not share; reset
30 min single use, every device signed out, current password keeps working; invitation 7 days,
bound to the address), "ignore if this was not you". No secret beyond the message's own token / code
(tokens only in the URL fragment).

### Public bundle and freeze

- No Company / Account / Platform module, API path or string in the homepage's initial chunks
  (checked in the built files); Account Portal, onboarding and Platform code are lazy route chunks.
- Initial JS 182.5 kB gzip / 205 (EP23 180.3). The +2.2 kB is lucide icon re-grouping by the EP20
  merge rule (`check-circle`, `alert-octagon`, `more-horizontal`, `shield-close` now sit in an
  entry-shared icon group) — icon data only, inside the budget.
- Since the EP22 freeze, `src/config`, pricing, shell / header / footer, contact, demo, SEO, `public/`
  are unchanged; EP24 itself changed only `LoginGateway` (plan carry-over) among public-adjacent
  files. 35 route families, 105 URLs, 3 shells, prerender verification, Warehouse privacy and claim
  suites pass.

### Secrets

Tracked and committed files scanned for `.env` files, database URLs with credentials, SMTP / Resend
credentials, `AUTH_SECRET`, owner / demo passwords, codes and tokens: only placeholders and
`@example.com` / `@pdabliss.test` fixtures. See §5 for a local working-copy issue that was **not**
committed.

## 4. Known limitations

- Firefox, Safari, real devices and screen readers not exercised in this continuation.
- No payment; activation is development-only. No branch management beyond the Head Office, no
  department changes after creation, storage / API not metered.
- Company Control Center, employee management, RBAC (EP25 / EP26) and the Platform Company Explorer
  (EP24.1) are not started.

## 5. Working-copy note for the owner

During this session `backend/.env.example` (tracked) was filled with real-looking values
(`AUTH_SECRET`, owner and demo passwords) and a `backend/.env` was created — not by this session.
Neither file was committed or modified here; `.env.example` must be restored to its placeholders
before any commit (`git restore backend/.env.example` once its values are saved elsewhere).

## 6. Status

- **Push status:** NOT PUSHED.
- **EP24.1:** NOT STARTED. **EP25:** NOT STARTED.
