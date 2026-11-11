# EP44 — Production Readiness Audit

**Baseline:** `9861c2a` (EP43) = `origin/main` (live remote). **Date:** 2026-11-11. **Scope:** an evidence-based
review. The designated production server was **not accessible** to this session, so nothing in this document certifies
it. **EP44 PASS ≠ production GO.**

Status vocabulary used throughout:

| Status                   | Meaning                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| **DEV-VERIFIED**         | tested on the development workstation, or on a disposable PostgreSQL cluster there |
| **STAGING-VERIFIED**     | tested on a production-like staging host — none exists, so nothing has this status |
| **ACTIVE IN PRODUCTION** | running on the production host — nothing CORE-related has this status              |
| **NOT VERIFIED**         | no evidence                                                                        |
| **BLOCKED — OWNER**      | needs an owner decision or approval                                                |

## 1. Execution machine (Phase 1)

The same machine as EP43 (`EP43_INFRASTRUCTURE_AUDIT.md`), re-checked read-only today:

- Windows 11 **Enterprise** desktop, i5-12400, 15.7 GB RAM, up 3 h;
- **no PM2, no cloudflared, no S2 runtime**;
- a folder named `S2_NAS_BACKUPS` exists on D: (contents not opened), so this PC may hold copies of S2 backups — it is
  not the S2 / PDA application host.

**Conclusion:** non-invasive review only. Phase 2 below is an **audit checklist for the real host**, not a result.

## 2. Intended deployment architecture and production-host checklist (Phase 2)

```
Internet ─▶ Cloudflare (TLS, WAF) ─▶ cloudflared tunnel (on the PDA host) ─▶ 127.0.0.1:<core-api-port> CORE backend
                                                                        └─▶ static frontend (dist/) via the existing web layer
CORE backend ─▶ PostgreSQL (same host, loopback) — dedicated database `pdabliss_core`, role core_app
Shared host also runs S2 and other PDA applications (PM2-managed, per the owner)
```

**Checklist to run on the production host.** All steps are read-only; record the results in a host audit like EP43's
(section numbers refer to that audit).

| #   | Check                                                                   | Command (read-only)                                                                                                                                                                                            | Pass condition                                                           |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| H1  | OS, CPU, RAM, uptime, utilisation                                       | `Get-CimInstance Win32_OperatingSystem, Win32_Processor, Win32_ComputerSystem`; `Get-Counter '\Processor(_Total)\% Processor Time','\Memory\Available MBytes' -SampleInterval 5 -MaxSamples 60` at a busy hour | ≥ 2 GB RAM and ≥ 1 core of headroom at peak, beyond S2                   |
| H2  | Disks, free space, health                                               | `Get-PhysicalDisk`, `Get-Volume`                                                                                                                                                                               | database volume < 70 % used; backup volume separate from the data volume |
| H3  | PostgreSQL version, data / WAL location, roles, listen, pg_hba, archive | the EP43 `SHOW` / catalog queries (`BEGIN READ ONLY`)                                                                                                                                                          | 16+; loopback logins only; record existing roles and databases (S2's!)   |
| H4  | PM2 processes and their ports                                           | `pm2 jlist` (**only if PM2 is already running** — it starts a daemon otherwise), or `Get-Process node` + `Get-NetTCPConnection -State Listen`                                                                  | a free loopback port for CORE; no collision with S2                      |
| H5  | Cloudflare tunnel                                                       | `Get-Service cloudflared`; read the tunnel config file (do not edit)                                                                                                                                           | ingress rules known; CORE would be a new hostname rule (owner action)    |
| H6  | Ports and collisions                                                    | `Get-NetTCPConnection -State Listen`                                                                                                                                                                           | the CORE API and the static host bind to 127.0.0.1 only                  |
| H7  | Firewall exposure                                                       | `Get-NetFirewallProfile`; inbound rules listing 5432, 3389                                                                                                                                                     | PostgreSQL not exposed; RDP restricted                                   |
| H8  | Backup storage and off-machine                                          | the existing S2 backup jobs (names only), the target volume / NAS reachability                                                                                                                                 | a CORE backup target outside the data volume, plus an off-machine copy   |
| H9  | Restart and recovery                                                    | service start types; PM2 startup; UPS / power policy                                                                                                                                                           | PostgreSQL automatic; supervisor restarts CORE after reboot              |
| H10 | Resource isolation                                                      | the PostgreSQL `max_connections` budget used by S2 (`pg_stat_activity` per database); CPU priority                                                                                                             | CORE pool (≤ 40, `core_app` limit) fits; a cap on CORE's memory          |

## 3. EP43 tooling — status (Phase 3)

| Capability                                | Status                                                                        | Evidence (EP43 + re-run in EP44)                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /health/ready`                       | DEV-VERIFIED                                                                  | unit + real database + outage drill (EP43); 200 with the EP44 build as `core_app`                                          |
| Backup + verified scratch restore         | DEV-VERIFIED                                                                  | EP44 re-run: UAT 743 rows / dev 924 rows **VERIFIED** (2.3 s / 1.6 s restore); corrupt / truncated archives refused (EP43) |
| Retention safety                          | DEV-VERIFIED                                                                  | unit tests; EP44 dry run with 3 verified backups: 0 to remove                                                              |
| Storage thresholds                        | DEV-VERIFIED                                                                  | mocked warning → critical → recovery; real volumes ok                                                                      |
| Health monitoring and alert deduplication | DEV-VERIFIED                                                                  | outage drill: one warning, one recovery                                                                                    |
| Log redaction and rotation                | DEV-VERIFIED (ops logs) · NOT VERIFIED (backend log rotation — no supervisor) |                                                                                                                            |
| Least-privilege roles                     | DEV-VERIFIED (disposable cluster)                                             | EP44: **51 / 51** regression as `core_app` with the EP44 build; 17 / 17 forbidden operations refused                       |
| Failure-recovery procedures               | DEV-VERIFIED in part                                                          | outage, scratch restore, accidental-deletion drill (EP44); host-loss and failed-update procedures **NOT VERIFIED**         |
| Any of the above in production            | **BLOCKED — OWNER**                                                           | activation plan `EP44_INFRASTRUCTURE_ACTIVATION_PLAN.md`                                                                   |

## 4. Database and recovery (Phase 4)

| Check                                       | Result                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean migration                             | 26 / 26 on an empty database **as the non-superuser `core_owner`** (EP43)                                                                                                                                                                                                                                                  |
| **Upgrade path (new in EP44)**              | a real EP34-schema database (17 migrations, with data — read-only dump of a leftover scratch database) upgraded to 26 / 26 by `core_owner` in 2 s; ledger 0; 14 history triggers present; 159 / 159 objects owned                                                                                                          |
| Restricted runtime                          | real backend as `core_app`: 51 / 51 cross-department regression, ledger 0 / 0 / 0, 10-check integrity 0 (EP44 build)                                                                                                                                                                                                       |
| **Accidental-deletion drill (new in EP44)** | the runtime deleted a DRAFT purchase request (allowed by design). A POSTED goods receipt delete was **refused** by the trigger. The draft was recovered from a `core_backup` backup through a scratch restore in **1.7 s**                                                                                                 |
| Immutability                                | two layers verified: privileges (the runtime cannot change `AuditLog` / `StockMovement`) and EP41 triggers (even the owner cannot change posted documents or history)                                                                                                                                                      |
| Retention and off-machine                   | design only (B3 / B4)                                                                                                                                                                                                                                                                                                      |
| PITR / WAL archiving                        | **not active**. Enabling it is cluster-wide on a shared server (S2): it needs `archive_mode = on` (a restart), an archive target with its own capacity, and a restore drill. Recommendation: not needed for a controlled pilot if the owner accepts RPO 24 h; required before commercial production if RPO ≤ 1 h is wanted |
| Failed migration                            | backup-before-deploy plus restore is the only path (runbook 9); Prisma migrations are not reversible                                                                                                                                                                                                                       |
| Persistent Dev / UAT                        | read-only content hashes before and after EP44: see the final report                                                                                                                                                                                                                                                       |

**RPO / RTO by data-loss scenario** (proposed):

| Scenario                       | RPO                                                                 | RTO                                            |
| ------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------- |
| Accidental deletion of a draft | last backup (24 h)                                                  | < 1 h (scratch restore + re-enter / copy back) |
| Bad migration                  | 0 (pre-deploy backup)                                               | 1 h                                            |
| Database corruption            | 24 h (no PITR)                                                      | 1–2 h                                          |
| Host loss                      | 24 h, only if an off-machine copy exists — otherwise **total loss** | 1 business day                                 |

## 5. Cloudflare, network and authentication (Phase 5)

| Item                           | Status                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trusted proxy                  | **Fixed in EP44 (repository).** `TRUST_PROXY` (unset = none; `loopback`; or explicit IPs / CIDRs; "trust everyone" refused at start-up). Production without it logs a warning                                                              |
| Real client IP                 | tested: through a loopback connector the client is the right-most forwarded address; a direct client cannot spoof `X-Forwarded-For` (`test/ep44-trust-proxy.test.ts`). **NOT VERIFIED through a real Cloudflare tunnel** (activation step) |
| Rate limiting                  | per client IP; behind the connector each client gets its own budget (tested); sign-in also has per-account throttling (EP23 / EP40)                                                                                                        |
| Session cookies                | `__Host-`, Secure, HttpOnly, SameSite=Lax in production (EP43 test)                                                                                                                                                                        |
| CORS / origin                  | explicit `CORS_ORIGINS` allow-list; state-changing requests need an allowed Origin (EP40 tests)                                                                                                                                            |
| TLS                            | terminates at Cloudflare; the backend speaks HTTP on loopback only. **NOT VERIFIED** on the host                                                                                                                                           |
| Production-only authentication | e-mailed sign-in codes required; the demo bypass is development-only; the dev auth secret and dev mail sink are refused in production (tests)                                                                                              |
| Demo routes                    | off in production; forced off when `NODE_ENV` is missing (tests)                                                                                                                                                                           |
| Public endpoints               | an explicit allow-list of 19 (health, readiness, API index, packages, demo [dev only], auth entry points); every other route answers 401 anonymously (EP40 sweep, re-run in EP44)                                                          |

## 6. Product policy and tenant isolation (Phase 6)

| Owner model                                     | State (evidence)                                                                                  | Class                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| One company per workspace                       | IMPLEMENTED — a session works in one company (EP40 sweep)                                         | —                                                                                                                       |
| Shared database, strict company isolation       | IMPLEMENTED at application level; EP40 cross-company sweep; no database RLS                       | production: acceptable with the `core_app` role; RLS is a future hardening                                              |
| One operational department per regular employee | **NOT ENFORCED** — member input accepts up to all 6 departments (`company/input.ts:71, 302, 368`) | **Customer-pilot blocker** (when customer admins manage members) — mitigation for a pilot: PDA staff administer members |
| Warehouse financial privacy                     | IMPLEMENTED (allow-lists, EP42.4 / EP44 regression without money keys)                            | —                                                                                                                       |
| Executive read-only                             | IMPLEMENTED (EP40 sweep; EP44 regression)                                                         | —                                                                                                                       |
| Independent approval + owner override           | IMPLEMENTED (EP41; regression)                                                                    | —                                                                                                                       |
| Optional BOM                                    | **NOT MET** — submit / approve throws `BOM_REQUIRED` (`production/service.ts:1185`)               | **Customer-pilot blocker** for a customer without recipes; internal-demo acceptable                                     |
| Confidential recipes                            | **NOT MET** — `operations.bom.view` is company-wide (`permissions/catalog.ts:226`)                | **Production blocker** (a pilot only with the customer's written acknowledgement)                                       |
| PDA ONE accounting integration                  | **ABSENT** (no integration code)                                                                  | **Future feature**                                                                                                      |

## 7. Operational capacity — test plan (Phase 7)

EP40's load results are **development-stage evidence only**: a single dev-mode process on this workstation.

- Throughput saturates near 210–215 requests/s.
- p95 < 250 ms up to 25 concurrent readers; ≈ 430 ms at 50.
- 11 database connections; 0 errors.
- Write workflows at 84–101 requests/s, with invariants intact.

| Plan item                   | Proposal (assumptions marked)                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Expected users (pilot)      | assumption: ≤ 3 companies × ≤ 15 staff, ≤ 20 concurrent active users — owner to confirm                                                                                                          |
| Workload mix                | about 80 % reads (lists, documents), 15 % document edits, 5 % postings / approvals                                                                                                               |
| Test                        | k6 or the EP40 harness against a **staging copy on the production host class at a quiet hour**, never against S2's live hours. Steps 5 / 10 / 20 / 40 users × 10 min plus a 2 h soak at 10 users |
| Budgets / thresholds        | p95 < 500 ms reads, < 1 s writes; error rate < 0.1 %; CORE RSS < 600 MB; CPU < 50 % of one core average; PostgreSQL connections ≤ 20 for CORE                                                    |
| Database growth             | weekly database size, rows per month in `StockMovement` / `AuditLog` / document lines (the storage monitor and backup manifests record size)                                                     |
| Backup duration and storage | from the manifests (seconds, bytes) — alert if backup + verify exceeds 15 min, or retention storage exceeds 20 % of the backup volume                                                            |
| Monitoring overhead         | measured 44 ms CPU per 60 s cycle, 0 connections; re-measure on the host                                                                                                                         |
| Stop criteria               | any ledger / integrity violation, p95 > 2 s, S2 latency degradation reported, memory > 80 %                                                                                                      |

No capacity guarantee is given. No load test was run in EP44.

## 8. Owner UAT gate (Phase 8)

| Gate                         | State                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Automated QA                 | completed (§9 of the final report)                                                      |
| UAT sandbox                  | available (`127.0.0.1:1211`, EP42.2), data preserved                                    |
| Human operational acceptance | **pending** — 119 cases, **all NOT TESTED**; UAT-BUG-001 / 002 await owner verification |
| Customer pilot approval      | **pending** (owner)                                                                     |

No production GO is possible without explicit owner acceptance.
