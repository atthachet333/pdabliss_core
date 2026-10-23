# PDA BLISS CORE

**Department Operations Platform** — by PDA BLISS COMPANY LIMITED

PDA BLISS CORE gives every department its own operating environment — Sales, Warehouse,
Purchasing, Operations, Accounting, an Executive Control Center and System Admin — while
all of them run on one connected workflow and one shared source of truth.

> แต่ละแผนกทำงานได้เต็มที่ในแบบของตัวเอง — ทุกงานเชื่อมเป็นระบบเดียวทั้งองค์กร

CORE is a different product from PDA ONE. PDA ONE is company-centric business management;
CORE is department-, role-, task- and workflow-centric. See
[docs/PRODUCT_CONCEPT.md](docs/PRODUCT_CONCEPT.md).

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
| `npm run build`        | typecheck + production bundle  | compile to `dist/`              |
| `npm start`            | —                              | run compiled server             |
| `npm run typecheck`    | `tsc -b`                       | `tsc --noEmit`                  |
| `npm run lint`         | ESLint                         | ESLint (type-aware)             |
| `npm test`             | Vitest + Testing Library       | Vitest + Fastify `inject`       |
| `npm run format`       | Prettier                       | Prettier                        |
| `npm run assets`       | regenerate WebP/AVIF/PNG assets + department scenes | —          |
| `npm run db:validate`  | —                              | validate the Prisma schema      |

## Routes

Public: `/`, `/departments`, `/features`, `/solutions`, `/how-core-works`, `/enterprise`, `/pricing`,
`/about`, `/contact`, `/login`, `/privacy`, `/terms`

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

How CORE works (EP08): `/how-core-works` follows one illustrative piece of work through the
company — handoffs, decisions, approval, exceptions, role views, trace and replay. See
[docs/HOW_CORE_WORKS.md](docs/HOW_CORE_WORKS.md).

Department pages (EP06): `/departments/executive`, `/departments/sales`,
`/departments/operations`, `/departments/warehouse`, `/departments/purchasing`,
`/departments/accounting` — see [docs/DEPARTMENT_EXPERIENCE.md](docs/DEPARTMENT_EXPERIENCE.md).

Locales (EP05): Thai is the default and unprefixed; the whole public site is also served in
English under `/en/...` and Simplified Chinese under `/zh/...` — shell and page content alike.
`/login` and `/app/*` are never prefixed. See [docs/PUBLIC_SHELL.md](docs/PUBLIC_SHELL.md).

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
> See [docs/EP01_PROTOTYPE_REPORT.md](docs/EP01_PROTOTYPE_REPORT.md).

## Security model in one paragraph

Frontend navigation is **not** access control. The backend is authoritative: every response
contract is an allow-list built per audience, so data a workspace is not cleared for (e.g.
cost and price for Warehouse) is never serialized — it is not merely hidden in the UI.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security).

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

---

© PDA BLISS COMPANY LIMITED. All rights reserved.
