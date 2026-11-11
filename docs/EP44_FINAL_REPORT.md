# EP44 — Production Readiness Audit, Infrastructure Gap Closure & Go/No-Go — Final Report

**Baseline:** `9861c2a` (EP43) = `origin/main` (live remote). **Result:** one local commit. Not pushed, not deployed,
no production infrastructure changed. EP45 not started.

**Verdict: PASS as a readiness assessment.** This is **not** a production GO.

| Milestone                       | Gate                      |
| ------------------------------- | ------------------------- |
| A. Internal demo (UAT sandbox)  | **PASS**                  |
| B. Controlled customer pilot    | **BLOCK** (B-1 … B-11)    |
| C. Public commercial production | **BLOCK** (B + C-1 … C-9) |

Documents:

- [EP44_PRODUCTION_READINESS_AUDIT.md](EP44_PRODUCTION_READINESS_AUDIT.md) — host checklist, tooling status, recovery,
  network, policy, capacity, UAT gate;
- [EP44_RELEASE_GATE_MATRIX.md](EP44_RELEASE_GATE_MATRIX.md) — every BLOCK with its requirement, risk, owner action,
  prerequisites and verification;
- [EP44_INFRASTRUCTURE_ACTIVATION_PLAN.md](EP44_INFRASTRUCTURE_ACTIVATION_PLAN.md) — phases 0–6 with owner
  checkpoints and rollback, **not executed**.

## 1. What changed in the repository

| Change                                                                                                                                                | Why                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRUST_PROXY` (backend env): none by default; `loopback` or explicit IPs / CIDRs; "trust everyone" refused at start-up; production warning when unset | Closes the code part of EP43 blocker B6. Behind the Cloudflare tunnel connector, without it every user shared one rate limit and the audit trail recorded the proxy's address                                                                              |
| `backend/test/ep44-trust-proxy.test.ts`                                                                                                               | Covers: config validation; real client IP through a loopback connector; spoofed `X-Forwarded-For` ignored from direct clients and from the client part of the chain; per-client rate limits behind the proxy, versus one shared bucket without the setting |
| Four EP44 documents; handbook and release-readiness updated                                                                                           | Assessment, gates, activation plan                                                                                                                                                                                                                         |

No product feature was added. Single-department enforcement, optional BOM, recipe confidentiality and the PDA ONE
integration remain open, deliberately and classified (audit §6).

## 2. Host

The execution machine is the **development workstation** (Windows 11 Enterprise, i5-12400, 15.7 GB). It has no PM2,
no cloudflared and no S2 runtime; a folder named `S2_NAS_BACKUPS` exists, contents not opened. **The production host
was not accessible and is not audited.** Every production statement is a plan or checklist (H1–H10).

## 3. Evidence executed in EP44

| Gate                                                                                   | Result                                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend: Prisma validate · typecheck · lint · format · build                           | pass                                                                                                                                                                               |
| Backend full suite                                                                     | **536 / 536** (38 files; includes the EP40 security sweep, tenant / branch / department permissions, Warehouse privacy, immutability)                                              |
| Ops tool tests                                                                         | **21 / 21**                                                                                                                                                                        |
| Frontend: typecheck · lint · format                                                    | pass                                                                                                                                                                               |
| Frontend full suite                                                                    | **1,159 / 1,159**                                                                                                                                                                  |
| Build + prerender + budgets                                                            | 108 pages + 3 shells; all JS **4,270.0 / 4,300 KiB**, initial JS **182.9 / 205 KiB gzip**, static HTML **525.6 / 560 KiB** (unchanged)                                             |
| Migration validation on scratch                                                        | fresh 26 / 26 as `core_owner` (EP43); **upgrade from a real EP34-schema database** 17 → 26 migrations as `core_owner`, 2 s, ledger 0, 14 history triggers, 159 / 159 objects owned |
| Real-stack regression (EP44 build, real backend as `core_app`, fresh copy of UAT data) | **51 / 51**, ledger reconciliation 0 / 0 / 0, 10-check integrity 0, readiness 200                                                                                                  |
| Least privilege                                                                        | 17 / 17 forbidden operations refused; `core_backup` read-only; `core_monitor` statistics only                                                                                      |
| Backup / restore verification                                                          | UAT 743 rows / dev 924 rows **VERIFIED** (read-only dumps; restore on a disposable cluster)                                                                                        |
| Accidental-deletion drill                                                              | draft deleted by the runtime → recovered from backup through a scratch restore in 1.7 s; a POSTED receipt delete refused by the trigger                                            |
| Retention                                                                              | dry run with 3 verified backups: 0 removed                                                                                                                                         |
| Secret scan                                                                            | clean                                                                                                                                                                              |

All database work ran on the disposable PostgreSQL cluster (scratchpad, port 55443), which was stopped at the end.

## 4. Preservation and impact

- `pdabliss_core_uat` and `pdabliss_core_dev`: **0 / 71 tables differ** (read-only content hashes before and after
  EP44). UAT: 0 sessions, ledger 0.
- Shared cluster: still only the `postgres` role and the same 27 databases (one read-only `pg_dump` of the leftover
  `pdabliss_core_up34` for the upgrade test).
- No service, setting, scheduled task, firewall rule, PM2 process, tunnel or DNS record was touched anywhere. Nothing
  was installed. No backup was deleted.

## 5. Risks remaining (top)

1. The production host is unaudited (B-1).
2. The superuser runtime on any server where CORE runs today (B-2).
3. No scheduled backups, and no off-machine copy (B-3, B-4) — host loss would mean total data loss.
4. No supervisor or restart after reboot (B-5); the real tunnel path is unverified (B-6).
5. Human UAT not done: 119 cases NOT TESTED (B-8).
6. Product-policy gaps: single department, mandatory BOM (pilot scoping), recipe visibility (production).

## 6. Decision

EP44 PASS = the assessment is complete, evidenced and classified. **Production GO: NO.** The next step is the owner's,
not code:

1. Approve **Checkpoint 0** of the activation plan (the host audit on the real server).
2. Run the human UAT.
3. Make the pilot scoping decisions (B-9, B-10).
