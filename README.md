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
├── frontend/   React + TypeScript + Vite — public website and department workspaces (port 1111)
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
| `npm run assets`       | regenerate WebP/AVIF/PNG assets | —                              |
| `npm run db:validate`  | —                              | validate the Prisma schema      |

## Routes

Public: `/`, `/departments`, `/features`, `/solutions`, `/pricing`, `/about`, `/contact`,
`/login`, `/privacy`, `/terms`

Workspaces (demo data in EP00): `/app/executive`, `/app/sales`, `/app/warehouse`,
`/app/purchasing`, `/app/operations`, `/app/accounting`, `/app/admin`

API: `GET /health`, `GET /api/v1`, demo-only `GET /api/v1/demo/{warehouse,purchasing}/stock`

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

---

© PDA BLISS COMPANY LIMITED. All rights reserved.
