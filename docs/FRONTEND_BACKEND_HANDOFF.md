# Frontend → Backend Handoff (after the v1 freeze)

**Written at:** EP22 — Public Frontend Freeze, 2026-10-26.
**Frozen baseline:** [PUBLIC_FRONTEND_V1_FREEZE.md](PUBLIC_FRONTEND_V1_FREEZE.md).

## 1. Purpose

Tell the backend episodes (EP23 onwards) exactly what the frozen public frontend and the internal
`/app` prototype already do, what is only a prototype or static content, and which rules the
backend must make real. The frontend's promises are design statements; from EP23 the backend turns
them into enforced behaviour without changing the frozen public site.

## 2. Current frontend state

- **Public site (frozen):** 35 route families × TH / EN / ZH = 105 prerendered indexable pages,
  plus `login`, `404` and `app` shells. Static HTML + lazy route chunks; no server rendering at
  request time and no backend call from any public page.
- **Internal workspaces (`/app/*`, prototype):** Executive, Sales, Warehouse, Purchasing,
  Operations, Accounting and Admin workspaces with module routes (`src/workspaces/`,
  `src/workspaces/registry.ts`), discovered at navigation time by `patchRoutesOnNavigation`
  (`src/app/appRoutes.tsx`) so they are never part of the public entry bundle. All data shown
  there is mock data.
- **API client:** `src/lib/api.ts` — `apiGet` with `credentials: 'include'` (ready for an
  HttpOnly session cookie, no call-site change), `ApiError(status, code, message)` reading the
  backend error envelope `{ error: { code, message } }`. Base URL `VITE_API_URL`.
- **Environment:** `VITE_SITE_URL` (canonical origin), `VITE_API_URL`, `VITE_ENABLE_PROTOTYPE`.
  Ports: frontend 1111, backend 1112.

## 3. What is prototype or static

| Area | Today | Becomes |
| --- | --- | --- |
| Login (`/login`) | CORE Gateway UI; in dev or with `VITE_ENABLE_PROTOTYPE=true` a browser-only check of a demo-only reviewer account (`src/prototype/config.ts`); production builds exclude it and show "sign-in opens when ready" | Real authentication (EP23) |
| Session | `sessionStorage` flag (`pbc.prototype.session`), not a token | Server session / HttpOnly cookie (EP23) |
| Workspace switcher | Prototype-only, lets the reviewer open any workspace | Removed; a user lands in their assigned department workspace |
| `/app` data | Mock fixtures in the frontend | API data filtered per audience (EP24–EP25 and module episodes) |
| Contact | Prepared message, hand-off by LINE / email / copy / phone; `UNAVAILABLE` delivery | `POST /api/inquiries` behind the existing seam (§10) |
| Demo (`/demo`) | Deterministic client-side scenario SO-1042 | Stays static (§11) |
| Pricing | Static plan table (`src/features/pricing/plans.ts`); since EP24 parity-tested against the backend catalog | Billing / checkout is out of scope until the owner schedules it |

The demo-only reviewer credentials are **not production credentials** and must never appear in
production documentation, public UI or a production bundle.

## 4. Real Auth handoff (EP23)

- Replace `src/prototype/` (gate, session, switcher, Design Lab access) in one step; it was isolated
  for that purpose. `PrototypeGate` is the single place `/app` checks a session today.
- Keep the frozen Login route, shell, layout and copy; Category B (owner approval) applies to any
  visible change of the gateway. The `?next=` return handling must keep rejecting external URLs.
- Session: secure HttpOnly cookie set by the backend; the frontend never stores tokens or
  passwords in `localStorage` / `sessionStorage`. `apiGet` already sends credentials.
- After sign-in the user lands in their assigned department workspace (no selector for company;
  one deployment = one company).
- CORS: the backend `CORS_ORIGINS` allow-list must include the real frontend origin, with
  credentials; rate limiting already exists (`@fastify/rate-limit`).

**EP23 outcome (2026-10-26):** done as the account / real-authentication foundation — see
[AUTHENTICATION.md](AUTHENTICATION.md) and [EP23_REPORT.md](EP23_REPORT.md). The prototype gate now
requires a real server session (the EP01 browser-only credential is gone); sign-in lands customers in
the Account Portal (`/account`) and platform operators in the Platform Control Center (`/platform`),
not yet in a department workspace — that needs company setup and RBAC (later episodes). The login
gateway gained the real form (Category B, presented for owner review).

## 5. Database handoff (EP24)

- `backend/prisma/schema.prisma` (PostgreSQL, `prisma-client` generator) defines Company,
  Department, User (+ `UserStatus`), Membership, Role, Permission, RolePermission and AuditLog.
  There is **no migration, no database and no `DATABASE_URL` in use** yet (`DATABASE_URL` is an
  optional env value).
- Branches are part of the product model (one company, many branches, all included in the price)
  but are **not yet in the schema** — add them in EP24/EP26.
- Company stays a single row per deployment; do not introduce multi-company tenancy.

**EP23 update:** PostgreSQL + Prisma are now in use for accounts and authentication (migration
`20261026083839_ep23_account_auth_foundation`, local `pdabliss_core_dev` / `pdabliss_core_test`).
The account tables (users, credentials, platform roles, sessions, tokens, invitations, auth audit)
exist; company, branch and master-data modelling beyond the demo company remains EP24+ work.

**EP24 update (company & subscription foundation):** see [COMPANY_SUBSCRIPTION.md](COMPANY_SUBSCRIPTION.md)
and [EP24_REPORT.md](EP24_REPORT.md). The product direction is now SaaS: **one CORE workspace = one
company, one company per customer account** (`CompanyMember.userId` unique — still no company
selector or switching), many companies on the platform. Added: `Company` lifecycle and onboarding
status, `Branch` with exactly one Head Office (`00000`, enforced in SQL), canonical
`DepartmentCode`, `Subscription` with a plan snapshot (`PENDING` until activation; no payment),
the authoritative package catalog `backend/src/billing/catalog.ts` (parity-tested against the frozen
`plans.ts`), server-side entitlements, membership-derived company context (no company id from the
browser) and the platform company list. Master data, branch management and department modules are
still later episodes.

**EP24.1 update (platform explorer & account profile):** see [EP24_1_REPORT.md](EP24_1_REPORT.md).

- *Account profile:* `User.fullName` (renamed from `displayName`, data kept), `phone` (E.164),
  `jobFunction` (self-described, never authorization) and `AccountSignupContext` (stated company
  name, industry, team size, contact preference, interests, note) — lead information captured at
  registration, separate from `Company`. Contract: [AUTHENTICATION.md](AUTHENTICATION.md) › Account
  profile.
- *Platform / customer boundary:* platform operators read companies only through
  `/api/v1/platform/companies` (paginated: `q`, `plan`, `subscriptionStatus`, `status`,
  `onboardingStatus`, `department`, `cursor`, `limit` ≤ 100) and
  `/api/v1/platform/companies/:id` (Platform Inspection: read-only, audited as
  `PLATFORM_COMPANY_INSPECTED` once per operator and company per 15 minutes). Inspection never
  creates a membership or a customer session — it is not impersonation. Customer routes keep
  deriving the company from the caller's membership.
- *Not yet:* operator actions on companies beyond the development activation (suspend / close /
  plan change), billing data, branch or member management, impersonation — none exists, none is
  shown.

**EP24.1.2 update (operator-first Platform Control Center):** see
[EP24_1_2_REPORT.md](EP24_1_2_REPORT.md). Customer vs demo vs platform populations are decided on
the server (`Company.isDemo`, demo-company membership, platform roles): the overview's
`customerAccounts` excludes demo accounts and adds `demoAccounts` / `operators`; the company list
takes `demo=exclude|only`; `GET /api/v1/platform/activity` is one safe-field timeline of security
and company events. New internal routes `/platform/activity` and `/platform/operators` (lazy,
noindex, served by the existing `/platform/*` shell rewrite).

## 6. RBAC handoff (EP25)

- Access is decided on the server. Frontend navigation and hidden UI are **not** access control.
- Starting point: `backend/src/domain/access/data-classification.ts` — data classes
  `operational`, `commercial`, `financial` and `WORKSPACE_DATA_CLEARANCE`:
  - Warehouse: operational only.
  - Sales, Purchasing: operational + commercial.
  - Operations, Admin: operational.
  - Executive, Accounting: all three.
- Response contracts are allow-lists built per audience: a field the audience is not cleared for
  is never serialized (see [ARCHITECTURE.md](ARCHITECTURE.md#security)).
- Package limits (departments per plan, Executive availability, API availability, storage) from
  §8 of the freeze manifest become server-side entitlements.
- **EP24:** these entitlements now exist (`backend/src/company/entitlements.ts`, from the
  subscription snapshot); department limits are enforced at company creation. EP25 enforces data
  boundaries per role on top of them.
- **EP25 (Company Control Center foundation):** see [COMPANY_CONTROL_CENTER.md](COMPANY_CONTROL_CENTER.md)
  and [EP25_REPORT.md](EP25_REPORT.md). Customer company roles are now enforced for company
  administration (`backend/src/company/policy.ts`: Owner / System Admin administer, Executive
  reads, department roles get the overview and CORE entry; the Company Owner cannot be demoted,
  deactivated or replaced). Every customer request resolves the company from the session
  (`requireCompanyAccess()`); ids in paths are looked up inside it. Department access =
  enabled ∩ permitted (`departmentAccess()`), the branch context lives on the server-side session,
  and **every operational API of EP29+ must start with `requireOperationsContext()`** and scope its
  queries by `companyId` + `branch.id`, then call `assertDepartmentAccess()`. Data-class
  clearance per department (Warehouse: operational only) is still applied per response by the
  module episodes; EP25 already withholds the subscription price from department roles.

- **EP26 (Branch & User Administration):** see [BRANCH_USER_ADMINISTRATION.md](BRANCH_USER_ADMINISTRATION.md)
  and [EP26_REPORT.md](EP26_REPORT.md). The authorization foundation is now: Company Membership +
  Company Role + Enabled Departments + Member Department Assignments + Branch Access
  (`CompanyMember.branchScope` + `MemberBranchAccess`) + Selected Branch (`Session.branchId`).
  `requireOperationsContext()` already requires a selected branch the member may still work in;
  every access change clears stale session branches in the same transaction. Branch access is
  operational scope only — administration authority stays with the role (a restricted System Admin
  still administers the company). **EP27** adds the action / permission matrix on top; do not
  re-derive branch or department reach in module code — call the existing gate.

- **EP27 (Permission & Action Matrix):** see [PERMISSION_ACTION_MATRIX.md](PERMISSION_ACTION_MATRIX.md)
  and [EP27_REPORT.md](EP27_REPORT.md). The chain is complete: membership + role + enabled
  department + package + assignment + branch access + selected branch + **action permission**.
  Every operational route starts with
  `requirePermission(db, auth(request), '<dept>.<resource>.<action>')` (from
  `backend/src/permissions/guard.ts`), then scopes by `op.companyId` + `op.branch.id`. Add new
  codes to the catalog (+ migration CHECK + TH/EN/ZH labels); never check roles or departments by
  hand. The frontend reads `context.permissions` to show / disable / explain only.

- **EP28 (Operational Master Data):** see [OPERATIONAL_MASTER_DATA.md](OPERATIONAL_MASTER_DATA.md)
  and [EP28_REPORT.md](EP28_REPORT.md). Canonical, company-scoped `Customer`, `Supplier`, `Item`
  (+ `Unit`, `ItemCategory`) and branch-scoped `WarehouseLocation` under `/api/v1/master-data`.
  Modules **reference these ids and never copy the identity**; documents snapshot code / name for
  history. New documents refuse INACTIVE master records. Item base unit and tracking change only
  through the structure policy point (`backend/src/master-data/policy.ts`), where Warehouse /
  Purchasing / Sales register their locks. Master records hold no price, cost, margin or
  financial term — those belong to module records with their own permissions and views.

## 7. Warehouse boundary

Warehouse must never receive price, unit cost, total cost, margin, payment amount, supplier
financial terms or any other protected financial value — from any endpoint, export, report,
notification, search result or error message. Enforcement is at the data / API boundary.
The existing demo route `GET /api/v1/demo/warehouse/stock` and `backend/test/warehouse-privacy.test.ts`
show the pattern; demo routes are disabled in production (`ENABLE_DEMO_ROUTES` defaults to off when
`NODE_ENV=production`).

## 8. Executive / Admin boundary

- **Executive** is a department: read-oriented, cross-department oversight, exceptions, approvals
  where the workflow says so. Requires a plan that includes Executive (not Starter).
- **Admin** (`admin` workspace) manages users, roles, departments and configuration. It is not a
  business department, is not one of the six public departments, and does not imply financial
  clearance beyond operational data.
- Executive ≠ System Admin: never grant one by granting the other.

## 9. Departments and modules

Six departments: Executive, Sales, Operations, Warehouse, Purchasing, Accounting. EP25: the
company enables them (soft) within its package, and people are assigned through `Membership`
(one account, several departments)
(`backend/src/domain/access/workspaces.ts` adds `admin`). Module episodes EP29–EP34 build the real
department modules behind the existing `/app` routes; the public department pages stay frozen.
Lot / Expiry / FEFO is core whenever Warehouse is enabled. Accounting is operational finance and
document workflow only — no GL, journals or tax filing.

## 10. Contact handoff

- Seam: `frontend/src/features/contact/delivery.ts` — `getInquiryDelivery()` returns `UNAVAILABLE`
  today; a real implementation returns `{ ok: true, reference? }` only after the server accepted
  the inquiry. The page never says "sent" otherwise.
- Backend: `POST /api/inquiries` with the same validation rules as
  `src/features/contact/validation.ts`, rate-limited, stored or forwarded. The seven paths and the
  prefill contract (`interest`, `plan`, `industry`, `department`) are frozen.
- Until then the final state remains **prepared, not submitted**. Wiring delivery changes public
  behaviour and needs owner approval (Category B).

## 11. Demo boundary

The public Demo is a static, deterministic teaching scenario (SO-1042). It must **never** read
from or write to production data or the production API, now or later. Demo API routes in the
backend are development fixtures only.

**Demo personas (EP28.1).** The demo company has nine seeded accounts — owner, System Admin,
Executive, one per department (Sales, Operations, Warehouse, Purchasing, Accounting) and the legacy
staff account — defined once in `backend/src/demo/personas.ts` and described in
[DEMO_PERSONAS.md](DEMO_PERSONAS.md). They differ only by role, department assignment and branch
access; the EP27 resolver decides the rest. They are fixtures: no demo field exists in the domain,
the sign-in bypass and the development persona list exist only outside production with demo routes
on, and passwords live only in each developer's `.env`. Use `purchasing.demo@pdabliss.com` for EP29
purchase requests and `warehouse.demo@pdabliss.com` for Warehouse privacy checks.

## 12. Localization

TH (primary, unprefixed), EN (`/en`), ZH Simplified (`/zh`, `zh-CN`). The internal `/app`
prototype UI is Thai. Backend error codes are stable identifiers; user-facing text is
localized in the frontend, never assembled from server strings in a single language.

## 13. Public / internal routing

- `/app/*` is internal: `noindex`, disallowed in `robots.txt`, absent from the sitemap, served by
  the `app.html` shell, loaded only through route discovery. It must not enter the public bundle
  (the performance budget and `performance.test.tsx` route-module sync catch it).
- `/login` (and `/en/login`, `/zh/login`) is a `noindex` shell.
- The API lives on its own origin (`VITE_API_URL`); public pages make no API request.

## 14. SEO / prerender constraints

`npm run build` prerenders exactly 105 indexable pages + 3 shells and fails otherwise
(`scripts/verify-prerender.mjs`, `scripts/perf-budget.mjs`). Backend work must not add
request-time rendering or API calls to public pages, change canonical / hreflang / sitemap
output, or make `/app` or `/login` indexable. Production SEO (Search Console, indexing) is a later
phase.

## 15. Performance constraints

Budgets (gzip): initial JS 205 KiB (179.6 at freeze), CSS 52, largest route 72, CORE World 265,
fonts 100, hero assets 45, all JS 4,100, HTML 540, exactly 108 HTML files. Auth and data code
belongs in `/app` chunks, never the public entry. Raising a budget needs owner approval.

## 16. Security claim constraints

Public copy describes server enforcement as **design** ("today / planned" on `/security`) until
the backend enforces it (`src/test/release.test.ts`). When an EP makes something real, the copy may
be updated to say so — with owner approval and evidence. Never add certification, compliance,
guarantee, uptime, immutability or zero-error claims.

## 17. Change policy

The public frontend v1 is frozen ([PUBLIC_FRONTEND_V1_FREEZE.md](PUBLIC_FRONTEND_V1_FREEZE.md)
§19–§20). Backend and `/app` work is Category A as long as public output stays identical; any
change to public routes, navigation, pricing, contact, claims or design is Category B; the
Category C list is never done silently. Each episode is committed locally, reviewed by the owner
and pushed only after approval.

## 18. EP23 starting point

**EP23 = REAL AUTHENTICATION.**

- Starts from the frozen baseline: the EP22 commit on `main`, after the owner approves and pushes
  EP22. EP23 is **not started** in EP22.
- Scope: user sign-in and sign-out, server session (HttpOnly cookie), password handling on the
  server, replacing `src/prototype/` gating for `/app`, landing in the assigned workspace, and
  tests. Database persistence arrives in EP24 and RBAC enforcement in EP25; EP23 must not claim
  either.
- Out of scope for EP23: deployment, production credentials, DNS / Cloudflare, Search Console.

**EP23 result:** completed locally (not pushed) on top of WIP `b2cbc49`. The scope grew with the
owner-approved SaaS direction (registration, email verification, one-time codes, Platform Owner /
Admin, Account Portal, Platform Control Center, invitation foundation) and uses PostgreSQL + Prisma.
Payment, subscriptions, company creation and the Company Control Center are not part of it.
