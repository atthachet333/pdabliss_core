# Company & Subscription Foundation (EP24)

**Episode:** EP24 · **Report:** [EP24_REPORT.md](EP24_REPORT.md) · **Builds on:**
[AUTHENTICATION.md](AUTHENTICATION.md) (EP23).

EP24 gives a verified customer account its CORE company: a package, the company itself, its
Company Owner, a Head Office, the departments it will use and a subscription that **waits for
activation**. It also gives platform operators a foundation-level list of every company.

EP24 is **not**: a payment gateway, the Company Control Center, full RBAC, master data, department
modules, or the EP24.1 Platform Company Explorer. Nothing in EP24 takes or records a payment.

## 1. Model

| Table | Purpose | Database invariants |
| --- | --- | --- |
| `Company` | One customer workspace. `status` (`PENDING_SUBSCRIPTION`, `ACTIVE`, `SUSPENDED`, `CLOSED`) and `onboardingStatus` (`IN_PROGRESS`, `COMPLETED`) are separate. `isDemo` marks seeded data. | — |
| `CompanyMember` | A user's place in a company, with a `CompanyRole`. | `userId` unique (one company per account, no switching); `ownerSlot` TRUE ⇔ `COMPANY_OWNER` (CHECK) and unique per company → exactly one owner |
| `Branch` | Head Office and branches (address, province, postal code, ISO country). | 5-digit `code` (CHECK), unique per company; `HEAD_OFFICE` ⇔ code `00000` ⇔ `headOfficeSlot` TRUE (CHECK), unique per company → one Head Office |
| `Department` | A department the company enabled (configuration only). `code` is the `DepartmentCode` enum. | unique `(companyId, code)` |
| `Subscription` | One company, every branch. Plan, status, billing cycle, a **snapshot** of the plan (catalog version, monthly price, entitlements JSON), period fields, future payment-provider references (unused). | `currentSlot` TRUE ⇔ status not `CANCELED`/`EXPIRED` (CHECK), unique per company → one current subscription; price NULL or > 0 |
| `AuditLog` | Business audit trail; EP24 adds `companyId`. | append-only by convention |

Migration `20261026150000_ep24_company_subscription_foundation` is additive: EP23 auth data is
untouched, `Department.code` is converted in place (`sales` → `SALES`), existing owners get their
owner slot. Companies that existed before EP24 (only the demo company) are completed by the demo
seed.

## 2. Package catalog

Authoritative source: `backend/src/billing/catalog.ts` (`PLAN_CATALOG_VERSION = 1`). The public
pricing page (`frontend/src/features/pricing/plans.ts`, frozen) shows the same facts;
`frontend/src/features/pricing/catalog-parity.test.ts` imports the backend catalog and fails if they
ever differ. Public read: `GET /api/v1/packages`.

| Plan | Monthly | Departments | Executive | Storage | API | Purchase |
| --- | --- | --- | --- | --- | --- | --- |
| Starter | ฿399 | max 2 | no | 3 GB | none | self-service |
| Business (recommended) | ฿699 | max 4 | yes | 10 GB | add-on | self-service |
| Professional | ฿999 | all 6 | yes | 30 GB | included | self-service |
| Enterprise | quotation | as agreed | yes | as agreed | included / custom | quotation |

- No free plan. Priced per company, **all branches included**.
- Annual: year 1 pays 12 months, year 2 pays 10 and uses 12, year 3+ is 15 % off
  (`ANNUAL_TERMS`; `annualTermYear()` derives the year from the activation date). Invoicing is a
  later episode.
- Lot / Expiry / FEFO is core whenever Warehouse is enabled — never a paid toggle.
- A subscription keeps the snapshot it was created with; a later catalog change does not rewrite
  it. Change a definition ⇒ bump `PLAN_CATALOG_VERSION`.

## 3. Entitlements

`backend/src/company/entitlements.ts` answers "what may this company use?" from the subscription
snapshot, never from the client or the live catalog:

- department selection: no duplicates, Executive only where allowed, at most `maxDepartments`
  (Enterprise: up to the six) → `422 DEPARTMENT_LIMIT`;
- storage, API and branch facts as a typed `EntitlementView`;
- **CORE gate:** `canEnterCore` = company `ACTIVE` **and** subscription `ACTIVE`. Anything else stays
  in the Account Portal.

## 4. Onboarding flow

```
verified account → choose package → create company (Head Office 00000, departments)
                → subscription PENDING / company PENDING_SUBSCRIPTION → (activation) → ACTIVE
```

Stages (`GET /api/v1/account/onboarding`): `NEEDS_PACKAGE`, `NEEDS_COMPANY`, `PENDING_ACTIVATION`,
`ACTIVE`, `SUSPENDED`, `CLOSED`, and `PLATFORM_OPERATOR` for platform accounts (they never own a
customer company).

- **Package:** `POST /api/v1/account/package { plan }`. A plan chosen on `/pricing` travels as the
  registration intent or as `?plan=` through `/login` to `/account?plan=…`, where the package step
  preselects it (offered once when it differs from the saved choice).
- **Company:** `POST /api/v1/company/onboarding` — strict body: `legalName`, `displayName`, optional
  `taxId` (Thai 13-digit checksum when the country is TH — a format check, not a Revenue Department
  verification), `registrationNumber`, `headOffice` (address, province, postal code, country, phone),
  `departments`, `billingCycle`. Plan, price, status, owner or any other server-decided field is a
  `400`. One transaction creates the company, the `COMPANY_OWNER` membership, the Head Office
  (`00000`), the departments, the `PENDING` subscription with its snapshot, and the audit events; a
  failure rolls all of it back.
- **One company per account:** a retry, a double submit or a second company answers `409
  COMPANY_EXISTS` (unique membership + a unique-violation catch for concurrent requests).
- **Enterprise:** may be created without departments (scope agreed later); onboarding stays
  `IN_PROGRESS` and the company cannot be activated until it is completed.

## 5. Subscription lifecycle

Transitions (`SUBSCRIPTION_TRANSITIONS`): `PENDING → ACTIVE | CANCELED`; `ACTIVE → PAST_DUE |
SUSPENDED | CANCELED | EXPIRED`; `PAST_DUE → ACTIVE | SUSPENDED | CANCELED | EXPIRED`; `SUSPENDED →
ACTIVE | CANCELED | EXPIRED`; `CANCELED` and `EXPIRED` are final.

EP24 exposes exactly one transition: **`PENDING → ACTIVE` by development activation**
(`POST /api/v1/platform/companies/:id/development-activation`):

- platform operators only, with a fresh step-up code; customers have no activation path (403 /
  404);
- the route is **not registered when `NODE_ENV=production`** (tested: `404 ROUTE_NOT_FOUND`);
- refuses incomplete onboarding and any non-pending state; sets the period (1 or 12 months, UTC);
- audited as `SUBSCRIPTION_STATUS_CHANGED` / `COMPANY_STATUS_CHANGED` with `mode:
  development_manual`, `paid: false`.

There is no "paid" state anywhere in EP24. Real activation follows payment in a later episode.

## 6. Company isolation

- Customer endpoints never take a company id: `/api/v1/company/current…` derives the company from
  the caller's membership (session → user → `CompanyMember`). A `?companyId=` is ignored.
- Branch and subscription ids are looked up **inside** that company: another company's id is `404`,
  indistinguishable from a missing one.
- `GET /current`, `/current/branches`, `/current/branches/:id`, `/current/subscription`,
  `/current/subscriptions/:id`, `/current/departments`.
- Platform company data is under `/api/v1/platform/companies` behind `requirePlatform` (customers
  `403`). Platform responses carry no password, token or code hash.

## 7. Platform company foundation

`GET /api/v1/platform/companies` (owner and admin): name, legal name, demo flag, status, onboarding
status, owner email, plan, subscription status, member / department / branch counts, creation
time. `GET /api/v1/platform/companies/:id`: branches, departments, subscription history,
entitlements, members, CORE access. The Platform Control Center shows this list (with the
development activation where the route exists). Owner-only capabilities (operator management) stay
owner-only. This is **foundation level**; the clickable Company Explorer, search / filter and
inspection UX are EP24.1.

## 8. Audit events (AuditLog)

`PACKAGE_SELECTED`, `COMPANY_CREATED`, `COMPANY_OWNER_ASSIGNED`, `HEAD_OFFICE_CREATED`,
`DEPARTMENTS_SELECTED`, `SUBSCRIPTION_CREATED`, `COMPANY_ONBOARDING_COMPLETED`,
`SUBSCRIPTION_STATUS_CHANGED`, `COMPANY_STATUS_CHANGED` — each with actor, `actorScope`
(`customer`, `platform_owner`, `platform_admin`, `seed`), company, target, request id and small
non-secret details.

## 9. Demo company

`npm --prefix backend run db:seed:demo` makes `PDA BLISS CORE DEMO COMPANY` (`isDemo`) a complete
workspace: Professional, `ACTIVE` (a controlled demo state, `mode: demo_seed`, `paid: false`), all
six departments, Head Office `00000` at an illustrative address, and the four demo identities.
Idempotent: the second run reports every item `unchanged` and changes no password. Refused in
production.

## 10. Account Portal (frontend)

`/account` (lazy, `noindex`) shows the progress (verified → package → company → activation), then
the package step, the company form (Head Office, departments with live plan limits — Executive
disabled on Starter, further departments disabled at the limit — billing cycle), or the company
summary (status, Head Office, departments, package, entitlements). Copy is TH / EN / ZH and never
says "paid"; the limits shown only help people choose — the server enforces them. Errors use an
alert summary, `aria-invalid` fields and focus on the first problem.

## 11. Known limitations

- No payment, invoices, proration or provider integration; activation is development-only.
- No branch management beyond the Head Office; no department changes after creation.
- No Company Control Center, employee management or in-product RBAC (EP25 / EP26).
- Storage and API entitlements are reported, not yet metered or enforced on usage.
- Tax ID is a checksum / format check only.
