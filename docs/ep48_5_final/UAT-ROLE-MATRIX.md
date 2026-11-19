# EP48.5 FINAL — UAT Role Matrix and Enablement Design

> **Update 2026-11-19: UAT ENABLEMENT PASS.** F1/F2/F3 deployed in release `5ba9d04` (G1 PASS); UAT company
> `cmwn2xumn0001nol4sziqtioo` ACTIVE via the audited owner activation; six accounts created through invitation links only
> (ACCEPTED 6, spare REVOKED, members 7, roles / departments / ALL_BRANCHES as planned). Text below is the original plan.

**UAT COMPANY ENABLEMENT: BLOCK (code ready, not yet gate-tested or deployed).** No UAT account or company exists.
F1, F2 and F3 are implemented in local commit `dcffb1d` (not pushed); the backend / frontend suites, typecheck,
lint and builds have **not** run yet (no package registry in the authoring environment) — they run in the isolated
gate (`EP48.5-FINAL-APPROVAL-PACKAGE.md`). Until the gate passes and the release is deployed, enablement stays BLOCK. Expectations in the matrix come from the code
(`permissions/catalog.ts`, `company/policy.ts`) and existing tests — **none has been verified live yet**.

## Role model (from the code)

- **Platform** roles (`PLATFORM_OWNER`, `PLATFORM_ADMIN`) are a separate system: no customer permission reaches them, and
  a platform account cannot create or join a company (`company/service.ts` refuses `platformRole`).
- **Company** roles: `COMPANY_OWNER` (one, never invitable), `SYSTEM_ADMIN`, `EXECUTIVE`, `DEPARTMENT_MANAGER`,
  `DEPARTMENT_STAFF`, `VIEWER`. Only Manager / Staff / Viewer take a department; Owner / System Admin / Executive do not.
- **Departments**: SALES, OPERATIONS (production), WAREHOUSE, PURCHASING, ACCOUNTING, EXECUTIVE. Permissions are
  `<namespace>.<resource>.<action>`, COMPANY- or BRANCH-scoped; a permission never grants branch access.
- **Confidential** (recipes / BOM-derived quantities): only `COMPANY_OWNER` and `DEPARTMENT_MANAGER` by default.
- **Warehouse holds no financial resource**: no cost, purchase price, margin, payment amounts, supplier terms
  (`warehouse.receiving.view` = quantities, lots, locations only; tests `purchase-orders` "never a price, total, deposit
  or terms, by any route", `warehouse-privacy`).

## Proposed UAT accounts (fake data; one real inbox via Gmail "+" aliases)

| # | Account | Role / department | Must be able to | Must be refused (expect 403 / hidden) |
|---|---|---|---|---|
| 1 | Platform Owner (exists) | PLATFORM_OWNER | Platform overview, company explorer, users, audit | any `/api/v1/company/*`; creating a company |
| 2 | `…+uat-owner` | COMPANY_OWNER | everything in the company incl. confidential, members, invitations | `/api/v1/platform/*`, other companies |
| 3 | `…+uat-purch` | DEPARTMENT_MANAGER · PURCHASING | PR approve, PO create / edit / issue, prices, deposits view | warehouse receiving post, accounting confirm |
| 4 | `…+uat-wh` | DEPARTMENT_STAFF · WAREHOUSE | pending receive (qty), goods receipt post, stock / lots / expiry | **any price, cost, total, deposit, terms — API and UI**; PO edit |
| 5 | `…+uat-sales` | DEPARTMENT_STAFF · SALES | sales orders, fulfilment view | warehouse locations / lots detail, purchase prices |
| 6 | `…+uat-ops` | DEPARTMENT_MANAGER · OPERATIONS | production orders, progress, recipes (confidential) | purchase prices unless granted |
| 7 | `…+uat-acct` | DEPARTMENT_STAFF · ACCOUNTING | deposits view, payment status (**confirm / waive is MANAGE: Accounting manager or owner**; corrected 2026-11-19) | warehouse operations, PO edit, deposit confirm |
| 8 | `…+uat-exec` | EXECUTIVE | executive command center, cross-department summaries | department write actions |

## F1 — onboarding is impossible in production (P1)

Root cause: accepting an invitation needs a signed-in account (`POST /auth/invitations/accept` has `requireSession`),
and the only way to create an account is `POST /auth/register`, which the WAF blocks (correctly — it is public
self-service sign-up). Invited employees therefore cannot join.

**Status: IMPLEMENTED in `dcffb1d` — gate PENDING.** As designed, with: no session is opened (the person then signs
in with password + OTP); an existing account → `409 ACCOUNT_EXISTS`; a concurrent second use → one account only.
Verified read-only on the live edge (2026-11-18): `POST /api/v1/auth/invitations/register` reaches the origin (404 on
the old release, no Cloudflare block) while `/api/v1/auth/register` stays WAF-blocked (403) — no WAF change needed.

Design (as implemented):
1. `POST /api/v1/auth/invitations/register` — body `{ token, fullName, password, locale, acceptTerms }`. The invitation
   token (256-bit, SHA-256 stored, single use, 7-day expiry, email-bound) proves the mailbox: in ONE transaction create
   the user for the invitation's email (email verified), consume the invitation and create the membership with its
   departments / branch access (existing `InvitationService` rules). Generic errors, rate limit like `invitationAccept`,
   audit `REGISTER` + `INVITATION_ACCEPTED`. If the email already has an account → "sign in, then accept" (unchanged path).
   Not blocked by the WAF rule (different path); the WAF rule stays as it is.
2. `PUBLIC_SIGNUP=false` in the online profile → `POST /auth/register` and `/verification/resend` answer 404 in code
   (defence in depth for release blocker B1); the API info document says `publicSignup: false`.
3. Frontend: `/account/invitation` signed out → "create your account" form (TH/EN/ZH) instead of the blocked
   `/register`; the login page hides "สมัครใช้งาน" when `publicSignup` is false (**fixes F3**).
4. Tests: valid token → user + membership + departments; expired / revoked / used / unknown token → same generic error;
   token for another email impossible; existing account → refused with sign-in hint; `PUBLIC_SIGNUP=false` → 404;
   rate limit; audit rows.

The COMPANY_OWNER is never invitable, so the one UAT company owner (#2) still needs an account. The invitation-only
release has no `/auth/register` (and its launcher refuses `PUBLIC_SIGNUP=true`), so this account is created ONCE,
**before** the release switch, on the current release: `Deploy-CoreOnline.ps1 -Stage OR` (owner-run, loopback only,
normal validation + verification e-mail + audited `REGISTER`, password typed locally and never logged). It is not a
standing onboarding mechanism. **Known gap:** after the switch there is no way to create a further company-owner
account; a Platform-issued owner invitation is proposed for EP48.6.

## F2 — production cannot activate a company (P1)

Root cause: the only activation logic (`CompanyService.activateForDevelopment`) and its route exist only when
`NODE_ENV !== 'production'`, and record `mode: development_manual`. It will **not** be invoked in production.

**Status: IMPLEMENTED in `dcffb1d` — gate PENDING.** As designed; additionally the company update is now conditional
(`PENDING_SUBSCRIPTION` → `ACTIVE` only), so neither a replay nor a race can activate twice; the allow-list is
validated at start-up (company-id format) and the online launcher refuses more than one id (`L12_MANUAL_ACTIVATION`).

Design (as implemented):
1. Refactor the transition into one canonical method `activateSubscription(ctx, companyId, meta, { mode, reason })`
   (state checks unchanged: subscription PENDING, company PENDING_SUBSCRIPTION, onboarding COMPLETED; one transaction;
   `SUBSCRIPTION_STATUS_CHANGED` + `COMPANY_STATUS_CHANGED` with `paid: false`). The development route keeps
   `mode: development_manual`.
2. Production route `POST /api/v1/platform/companies/:id/manual-activation` — registered only when
   `MANUAL_ACTIVATION_COMPANY_IDS` (online env) is non-empty; `PLATFORM_OWNER` only (not PLATFORM_ADMIN);
   `requireRecentStepUp` (fresh e-mailed one-time code); the id must be in the allow-list (others → 404); body
   `{ confirmDisplayName, reason }` must match; audit `mode: operator_manual`, reason, actor. One button on the
   Platform company detail page, shown only when the API marks the company eligible.
3. Tests: route absent with an empty allow-list; 404 outside the list; 403 for PLATFORM_ADMIN and company users;
   step-up required; wrong name / wrong state refused; exactly two audit rows; development route unchanged.
4. Compensation: CORE has no suspend action yet → rollback = the verified backup taken before activation (approved
   restore), or EP48.6 suspend. After use the allow-list is emptied (config change + API restart) → route gone.

## F3 — sign-up link lands on the WAF block page (P2): fixed by F1 step 3.

**Status: IMPLEMENTED in `dcffb1d` — gate PENDING.** Built with `VITE_PUBLIC_SIGNUP=false`, the login page shows
"ยังไม่มีบัญชี? บัญชี CORE สร้างได้จากอีเมลคำเชิญของบริษัทคุณเท่านั้น" (TH/EN/ZH) instead of the `/register` link, hides
"resend verification", and `/register` (still WAF-blocked publicly) renders an invitation-only notice without a form.
