# EP46 — Optional BOM & Confidential Recipe Authorization — Final Report

**Baseline:** `1e551d1` (EP45, local, not pushed) = `HEAD`, clean tree. **Result:** one local commit
`feat: support optional BOM and confidential recipes (EP46)`. Not pushed, not deployed, EP47 not started. No staging or
production infrastructure touched.

**Verdict: PASS** — all 14 acceptance criteria met with evidence. Human UAT cases `RB-01 … RB-07` are **NOT TESTED**.

Documents: [EP46_MANUFACTURING_POLICY.md](EP46_MANUFACTURING_POLICY.md) ·
[EP46_RECIPE_CONFIDENTIALITY_MATRIX.md](EP46_RECIPE_CONFIDENTIALITY_MATRIX.md) ·
[EP46_MIGRATION_ROLLBACK.md](EP46_MIGRATION_ROLLBACK.md) · [EP46_SECURITY_TEST_MATRIX.md](EP46_SECURITY_TEST_MATRIX.md).

## 1. What changed

| Area              | Change                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy            | Company `manufacturingMode` BOM_REQUIRED (default, all companies) / BOM_OPTIONAL — owner only, audited                                                                                                                                                                                                                                            |
| Production orders | `materialPlan` BOM / MANUAL; explicit plan endpoint `PUT /production/orders/:id/materials`; plan switching in DRAFT; submit/approve validate the plan (never inferred, never rescaled); the unchanged EP37/EP38 reservation → issue → usage → output → finished goods → completion path                                                           |
| Recipes           | new confidential permission `operations.recipes.view` (Owner + Operations Managers by default); BOM detail, preview and BOM writes need it; order projections hide `bomQuantity` / output basis, and BOM-derived quantities until release, for everyone else; BOM catalogue identity only; requirements aggregate and allocation results filtered |
| Platform          | `Cache-Control: no-store` on every `/api/*` answer without its own policy                                                                                                                                                                                                                                                                         |
| Database          | additive migration: two enums + columns with safe defaults, nullable `bomQuantity`, MANUAL CHECK, EP36 order CHECK extended, MANUAL-mode trigger, override CHECK (82 codes)                                                                                                                                                                       |
| Frontend          | Settings: manufacturing mode (owner; others read-only); production overview mode pill; new-order plan choice; explicit-plan editor (shared line editor with the BOM editor); withheld-quantity notice; BOM catalogue without recipe links for non-recipe users; TH / EN / ZH                                                                      |
| Tests             | `ep46-recipes.test.ts` (16); permission / production fixtures adjusted (§6); 5 frontend tests                                                                                                                                                                                                                                                     |

Files: 35 modified, 7 added (see `git show --stat`).

## 2. Evidence

| Gate                                                                      | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend: Prisma validate · typecheck · lint · format · build              | pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Backend full suite (disposable cluster)                                   | **575 / 575** (40 files; EP45 559 + 16 EP46; includes the EP40 sweeps, EP41 controls, EP45 department suite)                                                                                                                                                                                                                                                                                                                                                              |
| Frontend: typecheck · lint · format                                       | pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Frontend full suite                                                       | **1,172 / 1,172** (64 files; +5 EP46)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Build + prerender + budgets                                               | 108 pages + 3 shells; all JS **4,286.0 / 4,300 KiB** (+9.4 vs EP45; the plan editor reuses the BOM line editor), initial JS **182.9 / 205 KiB gzip** (unchanged), static HTML **525.6 / 560 KiB** (unchanged); no cap raised                                                                                                                                                                                                                                              |
| Ops tool tests                                                            | 21 / 21                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Security / route sweeps                                                   | EP40 sweeps, EP45 department sweep and the EP46 recipe sweep over every GET route (9 personas) pass                                                                                                                                                                                                                                                                                                                                                                       |
| Real stack (fresh migrated + seeded DB, running EP46 backend, 9 personas) | **EP45 regression 113 / 113** + **EP46 77 / 77**: BOM-required MO → reservation → partial + full issue → consumption → output → finished goods → completed; BOM-optional explicit plan → same path with partial consumption (issued 1.5, used 1.4); cancellation releases reservations; shortage blocks release; unauthorized operations refused; parallel issue / FG posts once                                                                                          |
| Ledger                                                                    | `uat/integrity.sql` 10 checks = 0 at start, after each flow and at the end; no duplicate posting                                                                                                                                                                                                                                                                                                                                                                          |
| Migration                                                                 | fresh + zero drift; EP45 copy (823 rows) upgraded with identical content; rollback exact (zero drift vs EP45, identical data) and refused while a MANUAL order exists; roll-forward                                                                                                                                                                                                                                                                                       |
| Browser (QA 2111 / 2112)                                                  | Executive: unreleased BOM order shows items + state, quantities "—" with the TH / EN / ZH notice, BOM catalogue with the confidentiality note and no recipe links — 390 · 768 · 1024 · 1280 · 1440 · 1920 px, no horizontal overflow; Ops Manager: mode pill, explicit-plan editor operated by keyboard only (edit → Tab order quantity → remove → search → save → Enter) and saved `3` with no recipe ratio; Owner: settings mode select in TH (390 px) and ZH (1440 px) |
| Secret scan                                                               | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## 3. Security summary

R1–R15 all PASS ([EP46_SECURITY_TEST_MATRIX.md](EP46_SECURITY_TEST_MATRIX.md)). Recipe permission checked before lookups (no
id oracle); no export route; another company → 404; System Admin no production access; Executive read-only and now
without recipe detail; Warehouse / Purchasing / Sales / Accounting see no recipe field; EP45 single-department and
EP41 independent-approval / owner-override controls unchanged.

## 4. Role and persona impact

| Who                          | Before        | After                                                                  |
| ---------------------------- | ------------- | ---------------------------------------------------------------------- |
| Owner, Operations Manager    | full recipes  | unchanged                                                              |
| Operations Staff / Viewer    | full recipes  | catalogue identity; batch quantities once released; MANUAL plans fully |
| Executive (`executive.demo`) | full recipes  | catalogue identity and operational order views only                    |
| everyone else                | no production | unchanged                                                              |

No persona needed a recipe for its demo work; no exception was seeded.

## 5. Preservation

`pdabliss_core_dev`: read-only hashes **0 / 21 tables differ**. No UAT database on this workstation; none created. All
database work on the disposable cluster (`127.0.0.1:55443`). `.claude/launch.json` restored after QA. No service,
port 1111 / 1112, other project or infrastructure touched.

## 6. Tests adjusted for the new policy

`permissions.test.ts`: recipes are company-scoped like BOMs; the Executive's READ excludes confidential codes.
`production.test.ts`: the EP36 planning assertions plan as `ops@`, which now holds an explicit recipe ALLOW (documented
in the fixture); `ops2@` keeps the default. `inventory-control.test.ts`: the operational catalog has 82 codes (was 81).
`company-control.test.ts`: the settings answer now also carries `manufacturingMode` / `canChangeManufacturingMode`.

## 7. Remaining gaps

1. Owner UAT `RB-01 … RB-07` (NOT TESTED); UAT / production migration needs approval.
2. By design, people executing a **released** order see that batch's quantities; stricter secrecy would need per-order
   assignment (not in scope).
3. Purchasing shortages show per-order required quantities of approved orders (no BOM, no output quantity) — kept as the
   EP36 handoff.
4. No unplanned material can be added to an approved MANUAL order (excess on existing lines or cancel and re-plan).
5. EP44 production blockers other than B-10 / C-2 / C-4 unchanged.

## 8. Status

Committed locally · **Push: NOT PUSHED** · **Deploy: NOT DEPLOYED** · **EP47: NOT STARTED**.
