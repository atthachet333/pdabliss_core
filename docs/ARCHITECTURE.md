# Architecture

## Overview

```
 Browser ──► frontend (Vite/React SPA)  http://localhost:1111
                │  fetch, credentials: include, CORS allow-list
                ▼
            backend (Fastify API)       http://localhost:1112
                │  /health
                │  /api/v1/...
                ▼
            PostgreSQL (planned — Prisma schema in backend/prisma)
```

Two independent npm projects — no monorepo tooling, no microservices, no containers in EP00.

| Concern  | Frontend (`frontend/`)                                         | Backend (`backend/`)                              |
| -------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Runtime  | Browser, React 19                                              | Node.js 22.12+, Fastify 5                         |
| Language | TypeScript 6 (strict)                                          | TypeScript 6 (strict, NodeNext ESM)               |
| Build    | Vite 8 (code-split per route/workspace)                        | `tsc` → `dist/`                                   |
| Styling  | Tailwind CSS 4 with CSS-first design tokens                    | —                                                 |
| Data     | TanStack Query 5                                               | Zod 4 contracts, Prisma 7 schema (no DB yet)      |
| Forms    | React Hook Form + Zod                                          | —                                                 |
| Motion   | Framer Motion + CSS keyframes (see MOTION.md)                  | —                                                 |
| Tests    | Vitest + Testing Library (jsdom)                               | Vitest + `fastify.inject`                         |
| Quality  | ESLint 10 + typescript-eslint, Prettier                        | ESLint 10 (type-aware), Prettier                  |

### Ports

| Service  | Port | Enforcement                                                            |
| -------- | ---- | ---------------------------------------------------------------------- |
| Frontend | 1111 | `server.strictPort: true` — Vite exits instead of picking another port |
| Backend  | 1112 | `EADDRINUSE` is logged as fatal and the process exits                  |

## Frontend

```
frontend/src/
├── app/            router (public route table, lazy chunks), appRoutes (/app/*, Query), providers (MotionConfig)
├── components/
│   ├── ui/         Button, Section, Badge, Field (+ *Styles.ts class helpers)
│   ├── brand/      Logo / LogoMark
│   ├── layout/     public shell (EP05): PublicLayout, PublicHeader, DesktopNav, MegaPanel,
│   │               MobileMenu, LanguageSelector, PublicFooter, UtilityDock; PageHero
│   ├── contact/    ContactDetails (reads config/contact.ts)
│   ├── core/       internal design system (EP02): StatusBadge, PageHeader, Kpi, DataTable,
│   │               forms, Modal/Drawer/Sheet, WorkflowTimeline, Task/ExceptionItem, states…
│   └── shell/      AppShell: top bar, sidebar/rail, phone bottom bar, search, notifications
├── config/         site constants, department content model, public IA (navigation.ts),
│                   central contact details (contact.ts)
├── i18n/           public-shell locales (th default, en, zh-CN), typed dictionaries, URL mapping
├── features/consent/ cookie consent store, banner and preferences dialog
├── features/landing/
│   ├── universe/   CORE Universe hero visual (SVG geometry + HTML nodes)
│   ├── sections/   the ten landing-page sections
│   └── previews/   illustrative department mockups (container-query responsive)
├── motion/         motion tokens, Reveal, CountUp
├── pages/          public pages, 404
├── prototype/      demo sign-in, route gate, workspace switcher, Design Lab (removable)
├── workspaces/     registry (navigation, accent, module blueprints) + one folder per workspace
├── lib/            api client, formatting, page meta, cn
└── styles/         index.css — the design-token source of truth
```

- **Routing.** React Router 8 data router. Since EP20 every public page — the homepage
  included — is a router-managed lazy route (`lazy` + a full-height `hydrateFallbackElement`),
  and each prerendered HTML file preloads its own page chunk (`src/seo/routeModules.ts`). The
  `/app/*` prototype routes and the React Query client live in `app/appRoutes.tsx`, patched in
  by `patchRoutesOnNavigation` on the first navigation into `/app` — public visitors never
  download them. Every workspace dashboard is its own lazy chunk. See [PERFORMANCE.md](PERFORMANCE.md).
- **Public shell (EP05).** Every public page renders inside `PublicLayout`: header + mega menus,
  mobile navigation, footer, cookie consent and the floating utility dock — pages never build
  their own. Structure lives in `config/navigation.ts`, words in `i18n/messages/*`, contact
  values only in `config/contact.ts`. See [PUBLIC_SHELL.md](PUBLIC_SHELL.md).
- **Locale routing (EP05).** `publicPages()` is mounted three times: unprefixed (Thai, default,
  plus `/login`), `/en` and `/zh`. The prefixed groups load their shell dictionary with the
  route's `lazy()` before rendering; `/th/*`, `/zh-CN/*`, `/zh-hans/*` redirect to canonical
  URLs; `/login` and `/app/*` are never prefixed.
- **Page localization (EP05 revision).** Every public page body is localized. Copy lives beside
  its component as `Localized<T>` (`{ th, en, 'zh-CN' }`, typed from the Thai source) and is read
  with `useCopy()`; shared content modules expose locale hooks (`useDepartments`, `useWorlds`,
  `useFlows`, `usePlans`, `useSafeguards`) that return stable per-locale references. Internal
  links go through `useLocale().href()`. The internal app (`/app/*`, `/login`) is not localized.
- **Department imagery (EP05 revision).** `scripts/build-department-scenes.mjs` renders seven
  department scenes to `public/departments/<id>{,-sm}.webp` (`npm run assets`). They are used
  by the CORE World cards and detail, the แผนก mega menu, the mobile selector and
  `/departments`; always decorative (`alt=""`).
- **Cookie consent (EP05).** A versioned record in `localStorage`
  (`pdabliss-core:cookie-consent`), read through `useConsent()`; nothing is sent to the
  backend. No analytics/marketing tools exist yet — any future one must check consent first.
- **Workspaces.** `workspaces/registry.ts` declares each workspace's navigation, accent colour,
  phone-bar destinations and module *blueprints* (list columns, filters, primary action, empty
  copy). Route groups `/app/<workspace>/<module>` are generated from it; modules without their
  own page render the generic blueprint `ModulePage`. **This is navigation, not
  authorization.** `AppShell` sets `--ws-accent` (on the shell and on `<html>` for portaled
  overlays); every `components/core` part inherits it so one component set takes on each
  department's own hue. Unknown module paths render an in-shell not-found state; page errors
  render `RouteError` inside the shell.
- **Internal design system (EP02).** Screens are assembled from `components/core` only — see
  [INTERNAL_DESIGN_SYSTEM.md](INTERNAL_DESIGN_SYSTEM.md). The public site keeps its own
  `components/ui` + `layout` and is not affected by internal changes.
- **Design Lab (prototype).** `/app/prototype/ui` renders every core pattern inside the shell
  of the reviewer's last workspace. It sits behind the prototype gate and is linked only from
  the profile menu's prototype entry — never from workspace navigation.
- **No company picker.** There is never a company selection step.
- **Prototype access (EP01-PROTOTYPE).** `/app/*` sits behind `prototype/PrototypeGate`, a
  demo-only sign-in (`user1` / `pass1`) checked in the browser with a sessionStorage flag.
  It exists solely for UX review and is **not authentication**. The top-bar workspace switcher
  is prototype-only; production sign-in will open the user's assigned workspace directly.
  Everything lives in `src/prototype/` so it can be removed in one step when real
  authentication arrives: replace `PrototypeGate`, delete `WorkspaceSwitcher`, and drop the
  prototype branch in `LoginPage`. Production builds exclude the prototype (the demo password
  is dead-code-eliminated) unless `VITE_ENABLE_PROTOTYPE=true`.
- **API access.** `lib/api.ts` uses `credentials: 'include'` so an HttpOnly session cookie can
  be introduced without touching call sites. Base URL from `VITE_API_URL`.

## Backend

```
backend/src/
├── server.ts              process entry: env, listen, graceful shutdown
├── app.ts                 buildApp(env): plugins, hooks, routes (used by tests too)
├── config/env.ts          Zod-validated environment
├── plugins/error-handler  uniform error envelope, 404 handler
├── routes/
│   ├── health.ts          GET /health
│   └── v1/                GET /api/v1, demo routes (flagged)
├── domain/
│   ├── access/            workspaces, data classification & clearance
│   ├── inventory/         stock item record + per-audience view contracts
│   ├── workflow/          generic per-document state machine
│   ├── purchasing/        Purchase Request workflow (reference implementation)
│   └── audit/             audit entry builder with before/after diff
├── demo/                  EP00 mock fixtures
└── lib/                   AppError hierarchy, input parsing
```

Cross-cutting behaviour in `app.ts`:

- **Request IDs** — accepts a well-formed upstream `x-request-id` (8–128 safe chars), otherwise
  generates a UUID; echoed on every response and in every error body; exposed via CORS.
- **Security headers** — `@fastify/helmet`, API-appropriate CSP (`default-src 'none'`).
- **CORS** — explicit origin allow-list from `CORS_ORIGINS` (default `http://localhost:1111`),
  credentials enabled.
- **Rate limiting** — `@fastify/rate-limit` (default 300 req/min/client; `/health` exempt).
- **Structured logging** — Pino; pretty in development, JSON in production; auth/cookie
  headers redacted.
- **Errors** — `AppError` subclasses map to stable `code`s; unknown errors become a generic 500
  and are logged, never leaked.
- **Graceful shutdown** — SIGINT/SIGTERM close the server with a 10 s hard timeout.
- **API versioning** — everything business-related lives under `/api/v1`.

### Environment

See `backend/.env.example`. Secrets only via environment variables; `.env` is git-ignored.
`ENABLE_DEMO_ROUTES` defaults to `true` outside production and `false` in production.

## Security

### Principles

1. **The frontend is never trusted for permissions.** Hidden menu items and hidden columns
   are UX, not security.
2. **Response contracts are allow-lists per audience.** Each field is classified
   (`operational`, `commercial`, `financial`); each workspace has a clearance
   (`domain/access/data-classification.ts`). View schemas are built with Zod `pick`, and Zod
   strips unknown keys on parse — so a field that is not in the contract cannot be serialized
   even if the source record contains it.
3. **Warehouse never receives pricing.** `StockItemWarehouseView` has no cost/price/supplier
   fields. Tests assert both the contract shape and the raw HTTP payload.
4. **Authorization (planned, EP01+):** authenticated sessions (HttpOnly, Secure, SameSite
   cookies), RBAC by role + department membership, object-level checks in services, and the
   workspace derived from the verified session — never from a client-supplied header, path or
   query parameter.
5. **Every important mutation is audited** with actor, request ID, reason and before/after
   field values (`domain/audit/audit-entry.ts`).

### Human-error prevention architecture

Business rules live in domain code, not in UI:

- `domain/workflow/state-machine.ts` — each document type declares its own states and
  transitions. `applyTransition` rejects invalid transitions (409 `INVALID_TRANSITION`),
  enforces guards (422 with a rule code) and required reasons (422 `REASON_REQUIRED`).
  `defineMachine` refuses transitions out of terminal states or to unknown states.
- `domain/purchasing/purchase-request.workflow.ts` — reference machine: cannot submit an empty
  PR; requester cannot approve their own PR; reject/cancel require a reason.

Future rules slot into the same pattern: receiving more than the open PO quantity, paying
without approval or complete documents, issuing an expired lot, duplicate submission
(idempotency keys), unauthorized edits (object-level checks).

## Data model

### Implemented in EP00 (`backend/prisma/schema.prisma`)

`Company`, `Department`, `User`, `Membership` (user × department × role), `Role`,
`Permission`, `RolePermission`, `AuditLog`. The schema validates (`npm run db:validate`);
no database connection or migrations are required yet.

### Planned domain model

| Area        | Entities                                                                  |
| ----------- | ------------------------------------------------------------------------- |
| Identity    | Company (one per deployment), Department, User, Membership, Role, Permission |
| Master data | Customer, Supplier, Product/Item, Warehouse                               |
| Sales       | SalesOrder, SalesOrderLine                                                |
| Purchasing  | PurchaseRequest(+Line), PurchaseOrder(+Line)                              |
| Inventory   | GoodsReceipt(+Line), StockBalance, StockMovement, Lot                     |
| Operations  | WorkOrder                                                                 |
| Finance     | PaymentRequest, Payment                                                   |
| Workflow    | Approval, WorkflowEvent                                                   |
| Platform    | Notification, Attachment, AuditLog, Subscription                          |

Each document entity will carry its own status enum matching its state machine.
