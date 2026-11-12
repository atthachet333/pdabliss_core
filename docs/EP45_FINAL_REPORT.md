# EP45 — Single-Department Enforcement & Department-Level Authorization Hardening — Final Report

**Baseline:** `a9a11db` (EP44) = `HEAD` = `origin/main`, clean tree. **Result:** one local commit
`feat: enforce single-department operational access (EP45)`. Not pushed, not deployed, EP46 not started. No CORE
staging or production infrastructure touched.

**Verdict: PASS** — every acceptance criterion below is met with evidence. Human UAT of the new behaviour
(`DP-01 … DP-08`) is **NOT TESTED** and stays the owner's.

Documents: [EP45_DEPARTMENT_POLICY.md](EP45_DEPARTMENT_POLICY.md) · [EP45_AUTHORIZATION_AUDIT.md](EP45_AUTHORIZATION_AUDIT.md) ·
[EP45_MIGRATION_AND_ROLLBACK.md](EP45_MIGRATION_AND_ROLLBACK.md) · [EP45_SECURITY_TEST_MATRIX.md](EP45_SECURITY_TEST_MATRIX.md).

## 1. What changed

| Area | Change |
| --- | --- |
| Policy | One operational department per Manager / Staff / Viewer per company; Owner cross-department by role; Executive read-only; System Admin administration only (§3) |
| Database | `Membership.companyId` + composite FKs to `Department (id, companyId)` and `CompanyMember (userId, companyId)`; unique `(userId, companyId)`; guard triggers on assignment and role change; pending-invitation CHECK; migration preflight that refuses ambiguous data |
| Resolver | `departmentAssignment()` status (ASSIGNED / UNASSIGNED / AMBIGUOUS / CROSS_DEPARTMENT / OVERSIGHT / ADMINISTRATIVE); a regular employee's codes come from their one department only; AMBIGUOUS fails closed; System Admin has no operational tier; an inapplicable ALLOW no longer removes a role default |
| Administration | single assignment that replaces (row-locked, audited `from → to`); `ONE_DEPARTMENT_ONLY`, `ROLE_TAKES_NO_DEPARTMENT`, `ROLE_DEPARTMENT_CONFLICT`; same rules for invitations and their acceptance |
| Context API | `/company/context` and `/operations/context` add `assignment {status, department}` |
| Frontend | CORE shows "Department: …" and explains a missing / invalid assignment; member editor and invite form offer one department (radio + "No department"); Owner / System Admin / Executive see why they have none; a stale-authorization 403 re-reads the context; TH / EN / ZH copy |
| Tooling | `npm run db:department-check` — read-only preflight / remediation report |
| Tests | `ep45-department.test.ts` (23), shared `route-table.ts`; module fixtures that encoded the old rule updated (§9) |

Files: 47 modified, 10 added (backend 26 + 5, frontend 10, docs 11 + 5) — see `git show --stat`.

## 2. Existing authorization findings (summary)

Full audit: [EP45_AUTHORIZATION_AUDIT.md](EP45_AUTHORIZATION_AUDIT.md). Key points at baseline: permissions recomputed per
request (no cache, no JWT); one company per account (no switching); every module funnels through one resolver; but
(1) staff could hold several departments, (2) an assigned System Admin got READ + OPERATE, (3) nothing in the database
bound an assignment's department to the member's company, (4) an inapplicable ALLOW could remove an Executive's READ.

## 3. Roles after EP45

| Role | Assignment | Operational access |
| --- | --- | --- |
| Owner | none (DB refuses) | every tier, every enabled department — under tenant, branch, state machine, inventory, SoD (`ownerOverride` + reason) and audit controls |
| Executive | none | READ only, every enabled department; no posting, approval, inventory, production or financial write |
| System Admin | none | **none operational** (was READ + OPERATE when assigned); all company administration unchanged |
| Manager / Staff / Viewer | exactly one or none | that department only, at the role's tier; none while unassigned or ambiguous |

## 4. Database and migration

Migration `20261112090000_ep45_single_department` (§1). Conflict handling: the preflight counts several-department
people, non-department-role assignments, foreign-company assignments and invalid pending invitations and **refuses with
no change** — it never chooses. Disposable-cluster evidence ([EP45_MIGRATION_AND_ROLLBACK.md](EP45_MIGRATION_AND_ROLLBACK.md) §5):
fresh apply + zero drift; EP44 demo database (691 rows) upgraded with every table's content unchanged; idempotent
re-seed; rollback to the exact EP44 schema (zero drift, identical data) and roll-forward; deliberate-conflict database
refused, recovered with `migrate resolve --rolled-back`; a read-only dump of the real Dev database upgraded EP24 → EP45
with zero drift.

## 5. Backend enforcement coverage

All operational modules (Sales, Warehouse incl. receiving / fulfilment / inventory control / finished goods,
Production, Purchasing requests and orders, Accounting deposits, master data, the operations gate) read permissions
through `memberPermissions()` → the resolver, so the department rule applies to every mutation and sensitive read
without per-controller logic. Payload departments (purchase requests) are checked against the caller's own codes;
other bodies are strict (a `departmentId` / `companyId` → 400). Cross-department references stay the minimal handoff
codes (policy §2). No route was added.

## 6. Session invalidation

No new mechanism was needed and none was added: authorization is recomputed from the database on every request.
Tested on open sessions: department reassignment and removal, role Staff → Viewer, DENY exception, branch-scope change
(the removed branch is never used again), membership deactivation (`MEMBERSHIP_INACTIVE`), logout (replayed cookie →
401). The frontend re-reads its context on `PERMISSION_DENIED` / `DEPARTMENT_NOT_ALLOWED` / `MEMBERSHIP_INACTIVE` /
`FORBIDDEN` and when the tab becomes visible. Login and recovery flows unchanged (auth suites pass).

## 7. Demo personas

No persona's role, department, branches or effective permissions changed — each department persona already held exactly
one department; Owner / System Admin / Executive hold none. Only the System Admin persona's description changed
("never department work"). Seed stays deterministic and idempotent (verified: re-seed changes 0 tables). Persistent UAT /
Dev data were not reset or migrated.

## 8. Evidence

| Gate | Result |
| --- | --- |
| Backend: Prisma validate · typecheck · lint · format · build | pass |
| Backend full suite (disposable cluster) | **559 / 559** (39 files; EP44 536 + 23 EP45; includes the EP40 sweeps, EP41 controls, Warehouse privacy, immutability) |
| Ops tool tests | 21 / 21 |
| Frontend: typecheck · lint · format | pass |
| Frontend full suite | **1,167 / 1,167** (64 files; +8 EP45 tests) |
| Build + prerender + budgets | 108 pages + 3 shells; all JS **4,276.6 / 4,300 KiB** (+6.6), initial JS **182.9 / 205 KiB gzip** (unchanged), static HTML **525.6 / 560 KiB** (unchanged); no cap raised |
| Real-stack regression (EP45 backend on a fresh disposable migrated + seeded DB, 9 real personas, HTTP) | **113 / 113** — Sales order → reservation → pick → pack → dispatch → delivery; purchase request → order → receiving → inventory; production order → reservation → issue → consumption → output → finished goods; Accounting deposit; Executive reads / no writes; System Admin no operations; branch refusal; live reassignment and deactivation; SQL refusals |
| Ledger reconciliation (`uat/integrity.sql`, 10 checks) | 0 violations at start, after each workflow and at the end (33 movements, 17 balances); no duplicate posting; reservations consumed exactly |
| Independent approval | creator self-decisions refused (PO issue, MO approve) and owner decisions accepted in the real-stack run; EP41 suite passes |
| Browser (QA stack 2111 / 2112) | department pill in TH / EN / ZH at 390 · 768 · 1024 · 1280 · 1440 · 1920 px with no horizontal overflow; unassigned explanation; direct URL to another department → "You do not have access to this page"; member editor = one radio group with meaningful labels, keyboard ArrowUp wraps to "No department", Tab → Save → Enter saves; System Admin page explains no department; invite form at 390 px (ZH) one radio group, no overflow; a live reassignment refreshed the open CORE page in place; no script errors |
| Authorization overhead | resolver 3.66 µs (EP44) vs 3.68 µs (EP45) per call; still 3 parallel queries per request, membership lookup on the new unique index; live p50 / p95: `/company/context` 4.9 / 6.0 ms, `/operations/context` 4.7 / 6.4 ms, `/sales/orders` 10.1 / 13.9 ms, a refused request 4.6 / 5.4 ms |
| Secret scan (added lines vs local `.env`, QA secrets, key patterns) | clean (only `NODE_ENV`, a loopback host and the public demo addresses match) |

## 9. Tests that encoded the old rule (changed deliberately)

| Test | Old expectation | New expectation |
| --- | --- | --- |
| `permissions.test` System Admin | assigned → READ + OPERATE | nothing operational, even with a row and an ALLOW |
| `production.test` roles | System Admin assigned to Operations plans | System Admin cannot be assigned; refused |
| `company-control.test` departments | one person, several departments | exactly one, replace, never add |
| `branch-user-admin.test` departments / invitations | two departments kept / applied | `ONE_DEPARTMENT_ONLY`, `ROLE_TAKES_NO_DEPARTMENT`; stale intent leaves the person unassigned |
| `purchase-requests.test` | a two-department person raises for both | one department; a forged department → 403, nothing written |
| `master-data.test` viewer | one viewer in three departments | one viewer per department; each reads only its own records |
| `demo-personas.test` | an admin may add a second department | reassignment survives a re-seed |

Thirteen fixtures that insert assignments directly now also write `companyId`.

## 10. Warehouse financial privacy, tenant and branch isolation

Warehouse personas: every GET route scanned for price sentinels and money keys (EP40 + EP45) — none; real-stack Warehouse
responses (pending pick, pick, shipment, pending receive, receipt, material-issue handoff, FG receipt) — no money key. A
person reassigned into Warehouse sees no money either. EP40 tenant and cross-site sweeps pass unchanged; another
company's branch → 404; Warehouse cannot select the Head Office.

## 11. Preservation

- `pdabliss_core_dev`: read-only content hashes at the start and end of EP45 — **0 / 21 tables differ** (one read-only
  `pg_dump` for the upgrade test).
- No UAT database exists on this workstation; none was created, migrated or reset.
- All migration, seed, test and real-stack work ran on a disposable PostgreSQL 18 cluster in the session scratchpad
  (`127.0.0.1:55443`), stopped at the end. The shared `postgres` service, other projects' databases, services, ports
  1111 / 1112 / 1211 / 1212, firewall and DNS were not touched. `.claude/launch.json` was restored after QA.

## 12. Remaining gaps

1. Owner UAT of `DP-01 … DP-08` (NOT TESTED).
2. Applying the migration to UAT / production needs owner approval (procedure in the migration document §6).
3. Not represented by a demo persona (unchanged from EP39): a Sales Manager and a Warehouse Manager — the owner performs
   their steps in the demo.
4. Optional BOM and recipe confidentiality (EP46); PDA ONE integration; multi-company accounts (v1 keeps one).
5. EP44 production blockers other than B-9 / C-3 are unchanged.

## 13. Status

Working tree committed locally · **Push: NOT PUSHED** · **Deploy: NOT DEPLOYED** · **EP46: NOT STARTED**.
