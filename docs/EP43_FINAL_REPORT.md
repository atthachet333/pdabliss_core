# EP43 — Production Infrastructure, Backup, Monitoring & DR Foundation — Final Report

**Baseline:** `cc34513` (EP42.4), equal to `origin/main` on the live remote before any change. **Result:** one local
commit. Not pushed, not deployed. EP44 not started.

**Verdict: PASS — as an infrastructure foundation.**

This verdict means the tooling, role model, monitoring and runbooks exist and were verified on disposable
environments and read-only on dev / UAT. It does **not** mean that any of the following are active:

- production backups;
- scheduled monitoring;
- an off-machine copy;
- the least-privilege role on a persistent server;
- process supervision.

The production host was not available to audit (§1).

Documents: [infrastructure audit](EP43_INFRASTRUCTURE_AUDIT.md) · [backup & recovery](EP43_BACKUP_RECOVERY_DESIGN.md) ·
[DR runbook](EP43_DISASTER_RECOVERY_RUNBOOK.md) · [role policy](EP43_DATABASE_ROLE_POLICY.md) ·
[monitoring, logging & retention](EP43_MONITORING_DESIGN.md) · [operations handbook](CORE_OPERATIONS_HANDBOOK.md).

## 1. Host discovered

The audited machine is a **development workstation, not the production server**:

- Windows 11 Enterprise 10.0.26300 (the target is Windows 11 Pro);
- desktop i5-12400, 15.7 GB RAM, rebooted the same day;
- no PM2, no cloudflared, no web server;
- the repository sits in a **OneDrive-synced** folder.

Storage: NVMe C: 466 GB (43 % used, PostgreSQL), SATA SSD E: 239 GB (30 %), HDD D: 1.86 TB (4.5 %), all three
reported Healthy (SMART detail not read without an administrator tool).

**PostgreSQL 18.6:**

- data and WAL on C:;
- `listen_addresses = *`, but `pg_hba` allows loopback logins only; TLS off; scram-sha-256;
- checksums on; `archive_mode` off (no PITR);
- a single superuser role `postgres`, used by CORE;
- 27 databases: CORE dev 17 MB, UAT 16.6 MB, test 24 MB, 21 leftover scratch copies (≈ 330 MB), 3 other projects.

**Capacity:** a CORE backup is 0.48 MB. A growth forecast needs real data — the measurement plan is in the audit, §5.

## 2. What EP43 built

| Part                                                                 | Files                                                                                                  | Status                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Readiness endpoint `GET /health/ready`                               | `backend/src/routes/health.ts`, `app.ts`                                                               | ✅ in code, tested; public by design (statuses only), listed in the EP40 public-route audit |
| Ops CLI: backup, verify, restore, retention, storage, health, status | `ops/*.mjs`, `ops/core-ops.cmd`, `ops/ops.config.example.json`                                         | ✅ verified; ⏸ not scheduled                                                                |
| Least-privilege roles                                                | `ops/roles.mjs`                                                                                        | ✅ verified on a disposable cluster; ⛔ not applied to a persistent server                  |
| Tests                                                                | `backend/test/readiness.test.ts`, `ep43-production-config.test.ts`, `ops/test/ops.test.mjs` (21 tests) | ✅                                                                                          |
| Docs                                                                 | six EP43 documents + handbook; release-readiness and performance updated                               | ✅                                                                                          |

## 3. Evidence

| Area                        | Result                                                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backups                     | UAT and dev: read-only `pg_dump` (snapshot-consistent row counts), 0.48 / 0.49 MB, 0.7 s; **VERIFIED** by restore into a disposable cluster: 71 tables, 743 / 924 rows equal, migrations equal, ledger 0                                 |
| Verification catches damage | flipped byte → `CORRUPT` (checksum); truncated archive with a faked checksum → fails at restore (`TOOL_FAILED`)                                                                                                                          |
| Target guards               | production profile refused while disabled / unapproved; profile ↔ connection mismatch refused; OneDrive and repository folders refused; restore into dev / UAT / `postgres` refused; restore into an existing database refused           |
| Restore drill               | 1.9 s, 26 migrations, ledger 0, scratch dropped                                                                                                                                                                                          |
| Retention                   | unit-tested (GFS, minKeep block, allow-list, dry run vs apply, foreign files untouched); dry run on the real folder removed nothing (1 verified < 3)                                                                                     |
| Roles                       | fresh `migrate deploy` as `core_owner` (26 / 26, 3 s); 159 / 159 objects owned; **51 / 51** cross-department regression with the real backend as `core_app`; **17 / 17** forbidden operations refused; EP41 triggers also stop the owner |
| Monitoring                  | outage drill: database stopped → readiness 503, liveness 200, one warning alert; restarted → readiness 200, one recovery, backend reconnected by itself                                                                                  |
| Storage alerts              | real check ok (C: 265 GB free, D: 1.78 TB free); mocked sequence warning → critical (exit 3) → recovery, no duplicate alerts, nothing deleted                                                                                            |
| Alert delivery              | local log active; email adapter ⏸ (no SMTP wired, nothing sent); LINE interface only                                                                                                                                                     |
| Logs                        | no session cookie, password or connection string in the backend log of the full least-privilege regression; ops logs redacted and rotating (5 MB × 5)                                                                                    |
| Security config             | production startup fails closed for each missing secret and for the dev secret; `__Host-` / Secure / HttpOnly / SameSite=Lax cookies; spoofed `X-Forwarded-For` ignored; demo routes off                                                 |

## 4. Quality gates

| Gate                                                                            | Result                                                                                                                                                                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend: Prisma validate · migration status · typecheck · lint · format · build | valid · dev / UAT 26 / 26 applied, fresh 26 / 26 as non-superuser · pass · pass · pass · pass                                                                                              |
| Backend full suite                                                              | **532 / 532** (37 files) on a clean full run, after one real finding was fixed: the EP40 sweep flagged the new public route until it was listed deliberately                               |
| Security route sweep (EP40)                                                     | passes; `/health/ready` added to the explicit public-route list (18 → 19)                                                                                                                  |
| Ops tests                                                                       | 21 / 21 (`node --test ops/test/ops.test.mjs`)                                                                                                                                              |
| Frontend: typecheck · lint · format · full suite · build · prerender · budgets  | pass · pass · pass · **1,159 / 1,159** · pass · 108 pages + 3 shells · within budget                                                                                                       |
| Performance (no frontend change)                                                | all JS **4,270.0 / 4,300 KiB**, initial JS **182.9 / 205 KiB gzip**, static HTML **525.6 / 560 KiB**                                                                                       |
| Business regressions                                                            | 51 / 51 real-stack (as least-privilege runtime): Purchasing, Warehouse, Sales, Production, Executive, Accounting scope, company / branch isolation, ledger 0 / 0 / 0, 10-check integrity 0 |
| Secret scan                                                                     | clean (test fixtures use obvious fakes)                                                                                                                                                    |

## 5. Resource overhead (measured)

- **Health cycle:** 0.56 s wall, 44 ms CPU, ≈ 71 MB RSS, 0 database connections.
- **Backup + verify (UAT):** ≈ 62 MB peak Node memory and 0.2 s Node CPU; `pg_dump` / `pg_restore` run as short child
  processes; 1 database connection during the dump.
- No stress test was run on the shared host.

## 6. Preservation and impact

- `pdabliss_core_uat` and `pdabliss_core_dev`: **0 / 71 tables differ** between the read-only content hashes taken
  before and after the episode. UAT: no sessions, ledger 0.
- Shared cluster: still only the `postgres` role and the same 27 databases. No `core_*` database was created there;
  every restore and role test ran on a **disposable** PostgreSQL 18 cluster (own data folder in the session
  scratchpad, loopback port 55443, started and stopped with `pg_ctl` as the current user, no service).
- The PostgreSQL service, its configuration, Windows services and tasks, firewall, RDP, the MySQL instance, the other
  projects' databases, Cloudflare and DNS were not touched. No software was installed. No backup was deleted.
- The EP43 test backups were written to the session scratchpad, not to the user profile or OneDrive.

## 7. Production readiness checklist

| Item                                                      | State                          |
| --------------------------------------------------------- | ------------------------------ |
| Fail-closed configuration, secure cookies, no demo routes | ✅                             |
| Readiness / liveness                                      | ✅                             |
| Backup + verified restore tooling                         | ✅                             |
| Least-privilege role model                                | ✅ designed and tested · ⛔ B2 |
| Scheduled backups / monitor                               | ⛔ B3                          |
| Off-machine copy                                          | ⛔ B4                          |
| Process supervisor, restart on reboot, log rotation       | ⛔ B5                          |
| Trust proxy for the tunnel                                | ⛔ B6                          |
| `listen_addresses = localhost`                            | ⛔ B7                          |
| Alert e-mail                                              | ⛔ B8                          |
| PITR                                                      | ⛔ B9 (optional, RPO-driven)   |
| Load test, external security review (EP41 items)          | not done                       |

**Proposed RPO / RTO** (targets, not achievements):

- RPO 24 h (daily backups); ≤ 1 h needs PITR or hourly dumps;
- RTO 1 h for a database restore on a working host (2 s measured on demo data);
- 1 business day after a host loss (needs B4).

## 8. Blockers requiring the owner's approval

- **B1:** identify and audit the production host.
- **B2:** create the roles on production and move CORE off `postgres`.
- **B3:** activate and schedule the production profile and the monitor.
- **B4:** an off-machine encrypted target, plus a restore test from it.
- **B5:** the supervisor (service or PM2) and log rotation.
- **B6:** trust proxy for the local tunnel (code change) and the HTTPS edge.
- **B7:** PostgreSQL bind to localhost (needs a service restart).
- **B8:** SMTP credentials for alerts.
- **B9:** PITR decision.
- **B10:** removal of the 21 leftover scratch databases.
- **B11:** data-retention periods (accounting, PDPA).

Not blockers for EP43 itself:

- **UNVERIFIED:** SMART disk attributes (need an administrator tool); the real production host behaviour (B1).
- **Note:** ESLint is not configured for the new `ops/` folder. It is covered by `node --check`, Prettier and 21
  unit tests.
