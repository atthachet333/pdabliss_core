# PDA BLISS CORE

**Department Operations Platform** — by PDA BLISS COMPANY LIMITED

PDA BLISS CORE gives every department its own operating environment — Sales, Warehouse,
Purchasing, Operations, Accounting, an Executive Control Center and System Admin — while
all of them run on one connected workflow and one shared source of truth.

> แต่ละแผนกทำงานได้เต็มที่ในแบบของตัวเอง — ทุกงานเชื่อมเป็นระบบเดียวทั้งองค์กร

CORE is a different product from PDA ONE. PDA ONE is company-centric business management;
CORE is department-, role-, task- and workflow-centric. See
[docs/PRODUCT_CONCEPT.md](docs/PRODUCT_CONCEPT.md).

## Project status

The **public frontend v1** passed its release-candidate audit in EP21
([docs/EP21_RELEASE_AUDIT.md](docs/EP21_RELEASE_AUDIT.md)) and is frozen by EP22 as
**CORE Public Frontend v1 — EP22 Freeze** ([docs/PUBLIC_FRONTEND_V1_FREEZE.md](docs/PUBLIC_FRONTEND_V1_FREEZE.md)).
That does **not** mean the product is production-ready: real authentication, the database, RBAC
and the CORE engines are built from EP23 on
([docs/FRONTEND_BACKEND_HANDOFF.md](docs/FRONTEND_BACKEND_HANDOFF.md)), and production deployment
(with real Cloudflare and SEO verification) comes only after full-system QA.

**EP23** (completed locally, awaiting owner review) establishes the account and real-authentication
foundation on PostgreSQL + Prisma: registration, email verification, sign-in with emailed one-time
codes, sessions, password recovery, Platform Owner / Platform Admin, the Account Portal and the
Platform Control Center ([docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)). Payment, company setup and
the Company Control Center come later.

**EP24** (completed locally, awaiting owner review) establishes the company & subscription
foundation: package catalog (one source for enforcement, parity-tested against public pricing),
company onboarding with its Company Owner, Head Office `00000` and departments, a subscription that
waits for activation (no payment, no fake paid state), server-side entitlements, company isolation,
the Platform Control Center company list and an active Professional demo company
([docs/COMPANY_SUBSCRIPTION.md](docs/COMPANY_SUBSCRIPTION.md)). It also includes the **Auth &
Transactional Email Polish** (below).

**EP24.1** (completed locally, awaiting owner review) turns the platform layer into the **Platform
Control Center**: an overview built from real counts (company lifecycle rail, what needs
attention), the **Company Explorer** (server search, filters, cursor paging) and **Platform
Inspection** of one company (subscription, entitlements, departments, branches, members, activity
and security — read-only, audited, never impersonation). Registration now collects the person
(full name, phone, optional role) and, in a second step, business context for PDA BLISS — without
creating the company. Auth screens gained a large-screen companion panel, emails a refined layout,
and /about a chapter on S2 ACCOUNTING CONSULTANT ([docs/EP24_1_REPORT.md](docs/EP24_1_REPORT.md)).

**EP24.1.2** (completed locally, awaiting owner review) reworks `/platform` for daily operator work:
real-customer figures first with demo and platform data counted separately, the customer path,
latest customer companies next to what needs attention, an isolated demo environment, a quick
company search in the header, and new Activity and Operators areas; session details are folded
away ([docs/EP24_1_2_REPORT.md](docs/EP24_1_2_REPORT.md)).

**EP24.1.3** (completed locally, awaiting owner review) establishes the production brand identity:
the orbital CORE mark, a vector wordmark, a micro mark for favicons, light / dark / monochrome
variants, favicons and app icons, and a new social card — all generated from one vector source
([docs/BRAND_IDENTITY.md](docs/BRAND_IDENTITY.md)).
**EP25** (completed locally, awaiting owner review) establishes the customer **Company Control
Center** (`/company`): overview from real data, company profile and logo, Head Office and branches,
users and invitations, owner protection, department configuration and assignment within the
package, a factual subscription page, company activity, settings, and the server-side branch
context leading into a neutral CORE Operations entry (`/core`)
([docs/COMPANY_CONTROL_CENTER.md](docs/COMPANY_CONTROL_CENTER.md), [docs/EP25_REPORT.md](docs/EP25_REPORT.md)).
**EP24.1.4** (completed locally, awaiting owner review) is a small approved public patch: the
PDA BLISS × S2 chapter on /about rebuilt as one symmetric composition (equal sides, CORE centred on
the logos' axis, matched actions), and a consent-aware Google map on /contact that loads only when
the visitor asks ([docs/EP24_1_4_REPORT.md](docs/EP24_1_4_REPORT.md)).
**EP24.1.4.1 – EP24.1.4.2** (completed locally, awaiting owner review) turns /contact into one
workspace — the consultation beside a location column with only the company name, address, a
large live Google map (loaded with the page, disclosed in the cookie banner and Privacy Policy) and
one Open in Google Maps action ([docs/EP24_1_4_2_REPORT.md](docs/EP24_1_4_2_REPORT.md)).
Next: EP26 (not started).

### Auth & Transactional Email Polish (EP24)

- Account screens: clear "check your email" states after registration and forgot-password, email
  verification states (verifying, verified, already verified, expired, used, invalid, missing link),
  reset-password form / success / expired-used-invalid states, and the one-time-code step —
  checked at 320–1440 px, keyboard, focus, errors and TH / EN / ZH.
- Emails (verification, sign-in / step-up code, password reset, password changed, existing account,
  invitation): one PDA BLISS CORE band, one dominant button, a small fallback link, and only true
  facts — single use, the real expiry (24 h / 10 min / 30 min / 7 days), sign-out of every device
  after a reset, "ignore if this was not you". Authentication behaviour is unchanged.

Roadmap:

1. EP20 Performance → EP21 Release-candidate audit → **EP22 Public Frontend Freeze**
2. EP23 Account & Real Authentication → EP24 Company & Subscription Foundation → EP24.1 Platform
   Control Center, Company Explorer & Account Profile → **EP24.1.2 Operator-first Platform Control
   Center** → EP24.1.3 Brand identity → **EP25 Company Control Center foundation** →
   EP26 Organization / Users / Departments → EP27 Audit / Notifications / Activity → EP28 Master Data
3. EP29 Sales → EP30 Warehouse → EP31 Purchasing → EP32 Operations → EP33 Accounting Operations →
   EP34 Executive
4. EP35 Workflow → EP36 Approval → EP37 Exception → EP38 Human Error Engine → EP39 Notification
   Engine → EP40 Reports / Custom Reports → EP41 API / Integration
5. Full-system final QA / security / stress / release readiness → production deployment →
   production SEO launch / Search Console / indexing

After the freeze, public-frontend changes follow the categories in the freeze manifest (allowed /
owner approval / never silently).

## Repository layout

```
pdabliss_core/
├── frontend/   React + TypeScript + Vite (+ three.js) — public website and department workspaces (port 1111)
├── backend/    Node.js + TypeScript + Fastify — API foundation (port 1112)
├── docs/       Architecture, brand, motion, product concept, episode reports
├── README.md
└── .gitignore
```

## Requirements

- Node.js **22.12+** (developed on Node 24)
- npm 10+

## Getting started

```bash
# Backend — http://localhost:1112
cd backend
npm install
cp .env.example .env      # optional; defaults work for local development
npm run dev

# Frontend — http://localhost:1111
cd frontend
npm install
npm run dev
```

Health check: <http://localhost:1112/health>

Ports are fixed: frontend **1111**, backend **1112**. Both servers fail loudly if their port
is taken (Vite `strictPort`, Fastify `EADDRINUSE` handler) instead of silently moving.

## Scripts

| Command                | frontend                       | backend                         |
| ---------------------- | ------------------------------ | ------------------------------- |
| `npm run dev`          | Vite dev server on 1111        | `tsx watch` on 1112             |
| `npm run build`        | typecheck + production bundle + prerendered head for all 105 public URLs (verified) + performance budget | compile to `dist/` |
| `npm run test:prerender` | re-check the built HTML of every public URL (no JavaScript) | — |
| `npm run perf` / `perf:budget` | re-check bundle / chunk / asset / HTML budgets of the last build (docs/PERFORMANCE.md) | — |
| `npm start`            | —                              | run compiled server             |
| `npm run typecheck`    | `tsc -b`                       | `tsc --noEmit`                  |
| `npm run lint`         | ESLint                         | ESLint (type-aware)             |
| `npm test`             | Vitest + Testing Library       | Vitest + Fastify `inject`       |
| `npm run format`       | Prettier                       | Prettier                        |
| `npm run assets`       | regenerate WebP/AVIF/PNG assets + department scenes + brand set | — |
| `npm run assets:brand` | regenerate logo / mark / favicon / app-icon / OG files from `geometry.ts` | — |
| `npm run db:validate`  | —                              | validate the Prisma schema      |

## Routes

Public: `/`, `/departments`, `/features`, `/solutions`, `/how-core-works`, `/enterprise`,
`/industries` (+ six `/industries/<id>` pages), `/pricing`, `/about`, `/why-core`, `/contact`, `/demo`,
`/security`, `/resources` (+ seven `/resources/<slug>` guides), `/login`, `/privacy`, `/terms`. The permanent public route set lives in `frontend/src/test/publicRoutes.ts`;
`frontend/public/sitemap.xml` lists every route in th / en / zh with hreflang alternates (a test
keeps the two in sync). Since EP17 every page also sets a self-referencing canonical, hreflang
alternates and Open Graph URL / locale from one route-aware source (`lib/seo.ts` +
`lib/usePageMeta.ts`); `/login` and the 404 are `noindex`. See
[docs/SEO_LOCALIZATION.md](docs/SEO_LOCALIZATION.md).

Signed-in (noindex, never locale-prefixed, lazy): `/account`, `/platform/*` and, since EP25, the
Company Control Center `/company` (`/profile`, `/branches`, `/users`, `/departments`,
`/subscription`, `/security`, `/settings`) and the CORE Operations entry `/core` (`/core/branch`).
See [docs/COMPANY_CONTROL_CENTER.md](docs/COMPANY_CONTROL_CENTER.md).

Pricing (EP07): `/pricing` is the package & subscription experience — four packages, annual
relationship, configurator, comparison, add-ons and FAQ; `?plan=<id>` selects a plan. See
[docs/PRICING_AND_PACKAGES.md](docs/PRICING_AND_PACKAGES.md).

Solutions (EP09): `/solutions` starts from organizational pain — a problem map, nine solution
stories and a navigator. See [docs/SOLUTIONS_EXPERIENCE.md](docs/SOLUTIONS_EXPERIENCE.md).

For organizations (EP10): `/enterprise` shows the same CORE philosophy with stronger
organizational controls — role-based visibility, approval control, traceability, executive
visibility, custom workflow, integration, multi-branch, implementation, support and an honest
readiness model (every capability carries a status). See
[docs/ENTERPRISE_EXPERIENCE.md](docs/ENTERPRISE_EXPERIENCE.md).

Industries (EP11): `/industries` and six industry pages — distribution, services, projects,
retail operations, property operations and manufacturing — show how the same CORE principles
adapt to different operating environments, each with its own visual motif, example workflow,
manager signals and explicit boundaries. See
[docs/INDUSTRIES_EXPERIENCE.md](docs/INDUSTRIES_EXPERIENCE.md).

About PDA BLISS and Why CORE (EP12): `/about` is the company story — process before
features, what PDA BLISS believes, the operational problem, the signature methodology (real
work → responsibility map → workflow → CORE screen), consulting, implementation, product vs
customization and the approved company details. `/why-core` is the product origin — work stuck
between departments, organizational growth, ONE LARGE SYSTEM → CORE (interactive), department-
centric yet connected, Human Error, executive signals. Company names live in
`frontend/src/config/company.ts`; contact values stay in `config/contact.ts`. See
[docs/ABOUT_PDA_BLISS.md](docs/ABOUT_PDA_BLISS.md) and [docs/WHY_CORE.md](docs/WHY_CORE.md).

EP13: `/about` gained a cinematic layer — four signature scenes (real work → CORE, the
design table, Human Error defense rings, the consulting work table) whose motion is state
transformation over native scroll, with full reduced-motion final states. `/contact` became a
guided consultation (topic → organization → situation → reply method → details → review) with a
stable prefill contract and honest delivery: nothing is sent by the website yet; the prepared
message is handed to email, LINE OA or phone. See
[docs/CONTACT_EXPERIENCE.md](docs/CONTACT_EXPERIENCE.md).

Interactive demo (EP14): `/demo` lets a visitor follow one simulated work item (SO-1042) through
Sales, Warehouse, Purchasing, Accounting and the Executive view — shortage, handoffs, a partial
receipt with DETECT, a lot / expiry PREVENT, FEFO, a document gate and an exception that clears.
No login, no sign-up, nothing stored; Warehouse never receives commercial data. `?role=` selects a
view. See [docs/INTERACTIVE_DEMO.md](docs/INTERACTIVE_DEMO.md).

Security & Trust and sign-in (EP15): `/security` is the public Trust Center. It covers visibility by
responsibility (one work item, six role windows), the Warehouse boundary, Executive ≠ Admin,
"UI visibility ≠ security boundary", the intended trace, controls, data principles, an EP10-status
readiness matrix and an FAQ. It makes no certification, uptime or recovery claims. `/login` is
redesigned as the CORE Gateway: department signals align into one gate that resolves into a
focused workspace. It is a visual layer only; the prototype sign-in mechanics are unchanged. See
[docs/SECURITY_TRUST_CENTER.md](docs/SECURITY_TRUST_CENTER.md) and
[docs/LOGIN_EXPERIENCE.md](docs/LOGIN_EXPERIENCE.md).

Resources (EP16): `/resources` is the CORE knowledge library — in-memory search, guided entries
by question, problem, department and organization stage, and seven real guides (getting started,
how CORE works, human error, warehouse privacy, implementation, security & data, glossary). See
[docs/RESOURCES_EXPERIENCE.md](docs/RESOURCES_EXPERIENCE.md).

How CORE works (EP08): `/how-core-works` follows one illustrative piece of work through the
company — handoffs, decisions, approval, exceptions, role views, trace and replay. See
[docs/HOW_CORE_WORKS.md](docs/HOW_CORE_WORKS.md).

Department pages (EP06): `/departments/executive`, `/departments/sales`,
`/departments/operations`, `/departments/warehouse`, `/departments/purchasing`,
`/departments/accounting` — see [docs/DEPARTMENT_EXPERIENCE.md](docs/DEPARTMENT_EXPERIENCE.md).

Locales (EP05): Thai is the default and unprefixed; the whole public site is also served in
English under `/en/...` and Simplified Chinese under `/zh/...` — shell and page content alike.
`/login` and `/app/*` are never prefixed (since EP15 the sign-in gateway follows the visitor's
language via router state). See [docs/PUBLIC_SHELL.md](docs/PUBLIC_SHELL.md).

Public contact details (address, the single public phone, email, LINE) live only in
`frontend/src/config/contact.ts`.

Workspaces (prototype, sign-in required): `/app/executive`, `/app/sales`, `/app/warehouse`,
`/app/purchasing`, `/app/operations`, `/app/accounting`, `/app/admin` — each with its own
module routes (e.g. `/app/warehouse/expiry`). Design Lab (prototype only): `/app/prototype/ui`

API: `GET /health`, `GET /api/v1`, demo-only `GET /api/v1/demo/{warehouse,purchasing}/stock`

## Workspace prototype (EP01-PROTOTYPE)

To review the department workspaces locally:

1. `cd frontend && npm run dev`
2. Open <http://localhost:1111/login>
3. Sign in with the **demo-only** account `user1` / `pass1`
4. Use the **สลับพื้นที่ทำงาน · ต้นแบบ** switcher in the top bar (on phones: **เพิ่มเติม** in the
   bottom bar) to move between workspaces
5. Open **Design Lab** from the profile menu to review every internal UI pattern

> **This is not authentication.** The demo account lives in `frontend/src/prototype/`, is
> checked in the browser only, and protects nothing but sample UI. The workspace switcher is
> prototype-only — in production a user signs in and lands directly in their assigned
> department workspace. The prototype is always on in `npm run dev`; production builds
> exclude it (and the demo password) unless `VITE_ENABLE_PROTOTYPE=true` is set.
> See [docs/EP01_PROTOTYPE_REPORT.md](docs/EP01_PROTOTYPE_REPORT.md). EP15 redesigned the sign-in
> page visually (the CORE Gateway). The check, session flag and `?next=` handling are unchanged,
> and the credentials are never shown on the page. See
> [docs/LOGIN_EXPERIENCE.md](docs/LOGIN_EXPERIENCE.md).

## Security model in one paragraph

Frontend navigation is **not** access control. The backend is authoritative: every response
contract is an allow-list built per audience, so data a workspace is not cleared for (e.g.
cost and price for Warehouse) is never serialized — it is not merely hidden in the UI.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security). The public explanation, with honest
statuses, is `/security` ([docs/SECURITY_TRUST_CENTER.md](docs/SECURITY_TRUST_CENTER.md)).

## Documentation

- [docs/PRODUCT_CONCEPT.md](docs/PRODUCT_CONCEPT.md) — what CORE is, PDA ONE vs CORE
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — frontend/backend architecture, ports, domain model
- [docs/BRAND.md](docs/BRAND.md) — colour, typography, spacing, surfaces, glow
- [docs/MOTION.md](docs/MOTION.md) — motion principles and reduced-motion behaviour
- [docs/EP00_REPORT.md](docs/EP00_REPORT.md) — what EP00 delivered and verified
- [docs/EP01_PROTOTYPE_REPORT.md](docs/EP01_PROTOTYPE_REPORT.md) — department workspace UX prototype
- [docs/INTERNAL_DESIGN_SYSTEM.md](docs/INTERNAL_DESIGN_SYSTEM.md) — internal app shell, tokens and UI patterns
- [docs/EP02_REPORT.md](docs/EP02_REPORT.md) — internal design system & workspace foundation
- [docs/CORE_WORLD.md](docs/CORE_WORLD.md) — the interactive CORE World homepage (WebGL)
- [docs/EP03_REPORT.md](docs/EP03_REPORT.md) — interactive CORE Universe & luxury public homepage
- [docs/HOMEPAGE_EXPERIENCE.md](docs/HOMEPAGE_EXPERIENCE.md) — the eleven-chapter public homepage, header and mega menus
- [docs/EP04_REPORT.md](docs/EP04_REPORT.md) — flagship homepage experience
- [docs/PUBLIC_SHELL.md](docs/PUBLIC_SHELL.md) — public header, mega menus, localization, footer, contact, cookies, utilities
- [docs/EP05_REPORT.md](docs/EP05_REPORT.md) — public shell & localization foundation
- [docs/EP05_REVISION_REPORT.md](docs/EP05_REVISION_REPORT.md) — EP05 revision: full-site language, single phone, mega-menu visuals, CORE World imagery
- [docs/DEPARTMENT_EXPERIENCE.md](docs/DEPARTMENT_EXPERIENCE.md) — the `/departments` philosophy page and the six department pages
- [docs/EP06_REPORT.md](docs/EP06_REPORT.md) — department experience
- [docs/PRICING_AND_PACKAGES.md](docs/PRICING_AND_PACKAGES.md) — packages, annual policy, add-ons, quote model, future checkout
- [docs/EP07_REPORT.md](docs/EP07_REPORT.md) — package & subscription experience
- [docs/HOW_CORE_WORKS.md](docs/HOW_CORE_WORKS.md) — the connected workflow experience: model, branches, boundaries, roles, trace
- [docs/EP08_REPORT.md](docs/EP08_REPORT.md) — how CORE works / connected operations experience
- [docs/SOLUTIONS_EXPERIENCE.md](docs/SOLUTIONS_EXPERIENCE.md) — problem-first solutions: model, map, navigator, boundaries
- [docs/EP09_REPORT.md](docs/EP09_REPORT.md) — operational solutions experience
- [docs/ENTERPRISE_EXPERIENCE.md](docs/ENTERPRISE_EXPERIENCE.md) — for organizations: model, statuses, access, control, readiness
- [docs/EP10_REPORT.md](docs/EP10_REPORT.md) — enterprise organization experience
- [docs/INDUSTRIES_EXPERIENCE.md](docs/INDUSTRIES_EXPERIENCE.md) — industries: shared vs variable model, six environments, boundaries
- [docs/EP11_REPORT.md](docs/EP11_REPORT.md) — industry experience pages
- [docs/ABOUT_PDA_BLISS.md](docs/ABOUT_PDA_BLISS.md) — `/about`: company identity, philosophy, methodology, consulting, claim boundaries
- [docs/WHY_CORE.md](docs/WHY_CORE.md) — `/why-core`: product origin, ONE LARGE SYSTEM → CORE, Human Error, executive view
- [docs/EP12_REPORT.md](docs/EP12_REPORT.md) — PDA BLISS and CORE story experience
- [docs/CONTACT_EXPERIENCE.md](docs/CONTACT_EXPERIENCE.md) — `/contact`: inquiry model, prefill contract, delivery limitation, privacy
- [docs/EP13_REPORT.md](docs/EP13_REPORT.md) — consultation experience and About enhancement
- [docs/INTERACTIVE_DEMO.md](docs/INTERACTIVE_DEMO.md) — `/demo`: scenario, state machine, role boundaries, handoffs, PREVENT, FEFO
- [docs/EP14_REPORT.md](docs/EP14_REPORT.md) — interactive CORE public demo
- [docs/SECURITY_TRUST_CENTER.md](docs/SECURITY_TRUST_CENTER.md) — `/security`: access philosophy, Warehouse boundary, UI vs server enforcement, statuses, claim safety
- [docs/LOGIN_EXPERIENCE.md](docs/LOGIN_EXPERIENCE.md) — the CORE Gateway sign-in: composition, states, credential boundary, locale
- [docs/EP15_REPORT.md](docs/EP15_REPORT.md) — Trust Center and signature CORE login
- [docs/RESOURCES_EXPERIENCE.md](docs/RESOURCES_EXPERIENCE.md) — `/resources`: knowledge library, registry, search, glossary, seven guides, claim boundaries
- [docs/EP16_REPORT.md](docs/EP16_REPORT.md) — CORE knowledge resource experience
- [docs/SEO_LOCALIZATION.md](docs/SEO_LOCALIZATION.md) — locales, metadata, canonical, hreflang, sitemap, robots, structured data, 404, terminology
- [docs/PUBLIC_ROUTE_DISCOVERABILITY.md](docs/PUBLIC_ROUTE_DISCOVERABILITY.md) — every public route, how visitors reach it, orphan rules
- [docs/EP17_REPORT.md](docs/EP17_REPORT.md) — localization, SEO hardening and navigation discoverability audit
- [docs/GLOBAL_NAVIGATION.md](docs/GLOBAL_NAVIGATION.md) — four-menu header, menus, mobile menu, footer zones, active state
- [docs/EP18_REPORT.md](docs/EP18_REPORT.md) — global navigation, visual and motion refinement
- [docs/EP18_1_REPORT.md](docs/EP18_1_REPORT.md) — dropdown, overlay and disclosure visual polish
- [docs/ACCESSIBILITY_RESPONSIVE.md](docs/ACCESSIBILITY_RESPONSIVE.md) — public accessibility, keyboard, responsive and browser baseline
- [docs/EP19_REPORT.md](docs/EP19_REPORT.md) — responsive and accessibility hardening report
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md) — public performance method, baseline, budgets, loading and runtime rules
- [docs/EP20_REPORT.md](docs/EP20_REPORT.md) — public performance hardening report
- [docs/EP21_RELEASE_AUDIT.md](docs/EP21_RELEASE_AUDIT.md) — public frontend release-candidate audit (findings, fixes, verdict)
- [docs/PUBLIC_FRONTEND_RELEASE_CHECKLIST.md](docs/PUBLIC_FRONTEND_RELEASE_CHECKLIST.md) — reusable checklist for every future public release review
- [docs/PUBLIC_FRONTEND_V1_FREEZE.md](docs/PUBLIC_FRONTEND_V1_FREEZE.md) — canonical public frontend v1 freeze manifest: baselines, route inventory, change policy
- [docs/FRONTEND_BACKEND_HANDOFF.md](docs/FRONTEND_BACKEND_HANDOFF.md) — what the backend episodes (EP23+) inherit from the frozen frontend
- [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) — accounts, roles, sign-in, one-time codes, sessions, recovery, rate limits, audit, bootstrap, testing
- [docs/EP23_REPORT.md](docs/EP23_REPORT.md) — account and real authentication foundation report
- [docs/COMPANY_SUBSCRIPTION.md](docs/COMPANY_SUBSCRIPTION.md) — company, Head Office, package catalog, entitlements, subscription lifecycle, isolation, demo company
- [docs/EP24_REPORT.md](docs/EP24_REPORT.md) — company and subscription foundation report
- [docs/EP24_1_REPORT.md](docs/EP24_1_REPORT.md) — Platform Control Center, Company Explorer, Platform Inspection, account profile, About S2 chapter
- [docs/EP24_1_2_REPORT.md](docs/EP24_1_2_REPORT.md) — operator-first Platform Control Center: customer/demo separation, attention rules, activity, operators

---

© PDA BLISS COMPANY LIMITED. All rights reserved.
