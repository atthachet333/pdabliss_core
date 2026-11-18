# EP48.5 FINAL — UAT Role Matrix and Enablement Design

**UAT COMPANY ENABLEMENT: BLOCK.** No UAT account or company exists. Two product defects (F1, F2) make a
supported, audited path impossible today; their designs are below. Expectations in the matrix come from the code
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
| 7 | `…+uat-acct` | DEPARTMENT_STAFF · ACCOUNTING | deposits view / confirm-waive, payment status | warehouse operations, PO edit |
| 8 | `…+uat-exec` | EXECUTIVE | executive command center, cross-department summaries | department write actions |

## F1 — onboarding is impossible in production (P1)

Root cause: accepting an invitation needs a signed-in account (`POST /auth/invitations/accept` has `requireSession`),
and the only way to create an account is `POST /auth/register`, which the WAF blocks (correctly — it is public
self-service sign-up). Invited employees therefore cannot join.

Design (smallest product fix, not yet implemented):
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

The COMPANY_OWNER is never invitable, so the one UAT company owner (#2) still needs an account: proposed as a single,
approved, logged operator registration on the server (`POST http://127.0.0.1:1312/api/v1/auth/register`, normal
validation, normal verification email, audited `REGISTER` event) — not a standing onboarding mechanism.

## F2 — production cannot activate a company (P1)

Root cause: the only activation logic (`CompanyService.activateForDevelopment`) and its route exist only when
`NODE_ENV !== 'production'`, and record `mode: development_manual`. It will **not** be invoked in production.

Design (not yet implemented):
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
