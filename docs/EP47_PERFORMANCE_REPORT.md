# EP47 — Performance Report (bundle first)

All figures are from `npm run build` (`scripts/perf-budget.mjs`, local gzip-9 estimates). **No budget was raised.**

## 1. Before / after

| Budget                  | Cap       | EP46 baseline     | After Phase 1 (recovery) | EP47 final  | Change vs EP46 |
| ----------------------- | --------- | ----------------- | ------------------------ | ----------- | -------------- |
| All JS (raw)            | 4,300 KiB | **4,286.0**       | **4,124.9**              | **4,163.5** | **−122.5**     |
| Initial JS (gzip)       | 205 KiB   | 182.9             | 182.9                    | 182.8       | −0.1           |
| Initial CSS (gzip)      | 52 KiB    | 50.8              | 50.8                     | 50.8        | 0              |
| CORE World chunk (gzip) | 265 KiB   | 182.5             | **133.2**                | 133.2       | −49.3          |
| Static HTML (raw)       | 560 KiB   | 525.6             | 525.6                    | 525.1       | −0.5           |
| Static HTML files       | 111       | 111               | 111                      | 111         | —              |
| Largest route (gzip)    | 72 KiB    | 56.6 (/resources) | 56.6                     | 56.6        | —              |

Headroom on total JS: **14.0 KiB → 136.5 KiB**.

## 2. How the JS was recovered (Phase 1)

A source-mapped build was attributed per module (`node_modules` package or source file). Findings: no module is
emitted in two chunks; no licence banners; the weight is three.js (360 KiB), react-dom (202), **@react-three/fiber
(160)**, motion-dom (122), react-router (97), lucide (49) and live TH / EN / ZH copy. Earlier episodes already removed
dead copy (EP42.4) and the R3F `<Canvas>` that kept every three class (EP36).

The one safe, meaningful saving left was @react-three/fiber itself — a full React reconciler and store used for a
single homepage scene. The CORE World now renders through plain three.js:

- `features/landing/core-world/engine.ts` (new): renderer with R3F's settings for this scene (flat = NoToneMapping,
  linear output, antialias / alpha / power preference / no stencil, pixel ratio clamped like `dpr`), perspective camera
  sized from the container, the `always | demand | never` frame loop with R3F's invalidate rules, callbacks in priority
  then registration order, and pointer events by raycasting (hover = nearest hit with a hover handler, out before over;
  click = nearest hit also under the press).
- The six scene parts (`Atmosphere`, `CoreSphere`, `OrbitSystem`, `DataConnections`, `DepartmentNode`,
  `ParticleField`) build the same objects with the same per-frame code; `CoreWorld.tsx` assembles the same graph in the
  same order (rig first, then atmosphere, CORE, orbits, connections, departments, particles). Quality steps swap only
  the parts whose settings change (as R3F re-rendered them). StrictMode-safe: the context is released only on real
  removal (insertion-effect cleanup), as before.
- `@react-three/fiber` was removed from `package.json` (and its dependencies from the lockfile).

Verification: the production build compared side by side with the EP46 build in the browser (same frame at rest —
sphere, glow, lattice, orbits, spokes, nodes identical); hover / click raycast map at 600 px matches the EP46 build's
real-mouse hits; hover highlights the department, click selects it (others dim, spoke brightens, ring shows), click on
CORE deselects; leaving and returning to the homepage remounts cleanly; no console error. The public frontend freeze
treats this as a Category A performance fix (same content, routes, navigation and design).

Lazy loading alone was not counted as a saving: total emitted JS is what the cap measures.

## 3. What EP47 adds

| Chunk                                                                             | Raw      | Loaded                                                                                                  |
| --------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `DepartmentDashboard` (one generic view + TH / EN / ZH copy for five departments) | 36.0 KiB | only when a dashboard is shown (a one-department member's CORE home, or `/core/dashboards/:department`) |
| `CorePage` (+ route, landing logic, labels)                                       | +≈2 KiB  | signed-in CORE only                                                                                     |

No new dependency, no chart library, nothing on public routes (initial JS unchanged). The public bundle is still guarded
by the perf-budget eager-import checks.

## 4. Server side

Each dashboard is one request. Aggregation runs in PostgreSQL: the Sales stage query and the receive-progress /
order-progress queries are single `GROUP BY` statements with `LATERAL` sums (no N+1); other metrics are indexed
`count` / bounded `findMany` (`take 500`, `LIMIT 2000`). Production reuses the module's own context computation.
Refresh is bounded: 120 s while visible, never while hidden; no WebSocket.
