# EP48.5 — Stage B Approval Checklist

> **2026-11-17 20:45 — revised strategy (owner decision):** EP48.5 is now the *Minimum Safe Online Deployment* at `core.pdabliss.com`, tester-only behind Cloudflare Access (`docs/EP48_5_ONLINE_DEPLOYMENT_PLAN.md`). The online checkpoints and decisions are in **Part 6**. Parts 1–5 stay as signed / recorded. Part 4's "no public listeners / DNS / Cloudflare change" is lifted **only** for the Part 6 items, each when signed. **Full G0 has not passed** and is not counted as PASS.

Stage B starts **only** when Parts 2 and 3 are answered and signed. Approving this list is **not** approval of a customer
pilot, LAN / public access, real data or commercial production.

## Part 1 — Evidence (Stage A)

| #    | Evidence                                                                                                               | Status                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| E-1  | Host identity: S2A-SERVER, Windows 11 Pro, i7-10700, 63.7 GB, NVMe C: / SATA SSD D: / HDD G:                            | **verified** (elevated collector)         |
| E-2  | Production PM2: SYSTEM daemon 2228, started by `\PM2 Auto Resurrect Boot` on the interactive account's `PM2_HOME`; 22 processes ↔ 21 ports mapped by name | **verified**                             |
| E-3  | Idle PM2 daemons 16972, 18776 (logon Run keys) and 26680 (EP48.5 collector v1 side effect): 0 children, examined, not terminated | **verified**                             |
| E-4  | Ports 1311 / 1312 / 5433 (and 1411 / 1412 / 5434): no TCP / UDP use, outside excluded ranges                              | **verified**                              |
| E-5  | Shared PostgreSQL 18.6: no CORE database or role; collation `English_United States.1252` (libc) everywhere              | **verified**                              |
| E-6  | Storage: D: 891 GB free (SSD); G: 1.69 TB free (HDD, holds the S2 NAS store `G:\S2_NAS_DATA`)                           | **verified**                              |
| E-7  | Backup schedule on the host: PDA ONE backup 00:30 / 06:30 / 12:30 / 18:30; billing hourly :05 → staging backup 03:20     | **verified**                              |
| E-8  | HTTP baseline: 21 / 21 production listeners answered (15 × 200, 6 × API 404 by design), no failure                      | **verified**                              |
| E-9  | Firewall off on the active network → loopback-only staging, bind verified at each start                                | **verified**                              |
| E-10 | Repository `cb21be1`, clean except the EP48.5 files                                                                     | **verified**; live remote → owner `git fetch` at C0 |
| E-11 | Quality gates                                                                                                           | **NOT RUN** — first Stage B gate G0       |
| E-12 | S2 NAS serving root = `G:\S2_NAS_DATA\storage`, from its `.env` and its path-traversal guard in code; nothing enumerates `G:\` (audit §4.7) | **verified**; SMB shares → collector at C0 |

## Part 2 — Owner decisions

| #     | Decision                                                                                                                         | Recommended                                                                                       | Owner's answer |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------- |
| OD-1  | S2A-SERVER is the intended PDA BLISS server                                                                                       | yes (E-1)                                                                                         |                |
| OD-2  | PostgreSQL topology                                                                                                               | **separate staging instance on 127.0.0.1:5433** (architecture D1)                                 |                |
| OD-3  | Supervision                                                                                                                       | **Windows services via WinSW**; no PM2 involvement (D2)                                           |                |
| OD-4  | Runtime profile                                                                                                                   | **Locked staging profile + two fail-closed launchers** (architecture §4.2):<br>• bind address is a **code constant** 127.0.0.1;<br>• post-bind proof and LAN-address exposure probe;<br>• allow-listed environment; sticky refusal; WinSW stops after two restarts;<br>• test matrix T1–T11, run in G0 / G5 with 0 skipped.<br>Accept the four residuals in §4.1 for loopback-only use. **External access remains prohibited**: no configuration can enable it. |                |
| OD-5  | Access                                                                                                                            | **loopback only**: a browser on the server; no tunnel / DNS / firewall change                     |                |
| OD-6  | Locations: `D:\pdabliss-core-staging`; backups in `G:\pdabliss-core-staging-backups` **under the C0 decision rule**:<br>• (a) the S2 NAS roots are still under `G:/S2_NAS_DATA/` — verified today from its config and code;<br>• (b) no non-administrative SMB share exposes `G:\` or the backup folder.<br>Otherwise, or if unverifiable on the day → the **D: fallback** `D:\pdabliss-core-staging-backups`. | Approve the rule. G: is not treated as private, so the folder gets its own ACL. D: fallback limitation accepted for **demo data only**: same SSD as the data, so no protection against disk loss; not acceptable for a pilot. |                |
| OD-7  | Platform Owner / Admin e-mail addresses for the staging seed                                                                      | dedicated internal addresses; no mail leaves the server (file sink)                               |                |
| OD-8  | Off-machine copy of staging backups                                                                                               | not for staging; mandatory before any pilot                                                       |                |
| OD-9  | Backup 03:20 daily; retention `--apply` disabled until 3 VERIFIED backups + written OK                                            | yes                                                                                               |                |
| OD-10 | Install WinSW v2.12.0 (MIT, SHA-256 checked)                                                                                      | yes                                                                                               |                |
| OD-11 | Maintenance window (S2 / PDA owner informed)                                                                                      | a quiet hour; avoid xx:05 and 00:30 / 06:30 / 12:30 / 18:30                                       |                |
| OD-12 | Reboot drill                                                                                                                      | **not in Stage B**; a separate supervised window                                                  |                |
| OD-13 | Acknowledge the host findings outside EP48.5 (audit §7, O-1 … O-6: PM2 home shared with idle daemons, firewall off, no off-machine backup, superuser app login, duplicate logon starters, workstation use) | acknowledge; handle as a separate infrastructure task. **EP48.5 changes none of them.** |                |
| OD-14 | The three idle user-account PM2 daemons, including 26680 created by the EP48.5 collector v1                                       | Leave untouched in EP48.5. Remove them later in the infrastructure task (back up `dump.pm2` first; end by PID). |                |

## Part 3 — Approvals (each signed separately; checkpoint in brackets)

Stop conditions common to every step:

- any production child PID / start time or HTTP status changes; latency beyond baseline + 50 % or + 50 ms;
- shared postmaster PID 5764 changes;
- CPU > 80 % sustained, or free RAM < 8 GB, attributable to staging;
- any staging listener not on 127.0.0.1.

On any of these: stop and roll back per `EP48_5_ROLLBACK_PLAN.md`.

| #        | Approval                                                                                                                                                                                                                                                                                                                                       | Step-specific stop conditions                                                                                                                                                                  | Signed (name, date) |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **A-0**  | Write `ops/ep48_5/staging-launch.mjs`, `ops/ep48_5/staging-web-launch.mjs` and `ops/test/staging-launch.test.mjs` exactly per architecture §4.2 (P1–P8, L1–L12, W1–W4, T1–T10). Review; local commit after C-A0; **not pushed**. No host change. | the diff touches anything under `backend/` or `frontend/`; a check from §4.2 is missing; any configurable bind address [C-A0]                                                                   |                     |
| **A-0.1** | Corrective amendment (approved 2026-11-17 11:40): explicit ops test files + concurrency 2; T10 unique fixture, no drop; explicit database target for every step and instance-identity check (system identifier); no wildcard listener in any test + loopback-only guard; read-only Windows preflight. Record: `docs/EP48_5_A0_1_AMENDMENT.md`. Local commit; **not pushed**. No host change. | anything under `backend/` or `frontend/` changes; a test binds a non-loopback address; any skipped test in G0 [C-A0.1] | |
| **A-0.2** | G0 incident `g0-20261117-134458` corrective amendment: PowerShell monitor replaced by `g0-supervisor.mjs` (typed, unit-tested; fail-closed baseline; de-duplicated findings; ends with the runner); every runner program through `Invoke-G0Bounded` (files, polled STOP / monitor / deadline); verified stop-tree and verified graceful `pg_ctl stop`; PowerShell variable-collision checks; Windows PS 5.1 tests `Test-G0Harness.ps1`. Record: `docs/EP48_5_G0_INCIDENT_20261117.md`. G0 ops expectation 117 (after C-A0.3). Local commit; **not pushed**. | anything under `backend/` or `frontend/` changes; any Test-G0Harness P1–P7 FAIL; preflight BLOCK [C-A0.2] | |
| **C-A0.2 fix** | Windows harness P4 (20 s > 15 s): stop-tree took a full Windows snapshot per PID. Now one process-only snapshot to plan, one identity query to verify, liveness polling, bounded wait, timings recorded; P4 strengthened (decoy, wrong start time, cleanup), P8 no-leak. Record: `docs/EP48_5_G0_INCIDENT_20261117.md` §5. Local commit; **not pushed**. | any of Test-G0Harness P1–P8 FAIL; preflight BLOCK | |
| **C-A0.3** | G0 run 2 (`g0-20261117-161805`): monitor and backend-tests step terminated by another process (exit 0xFFFFFFFF); actor not confirmed. Diagnostics only: monitor heartbeat / exit log, signal → STOP, exit-code meanings, census at STOP, `childEndedFirst`, `monitorFinal` MISSING in the summary; harness P9–P10. Ops expectation **117**. Record: `docs/EP48_5_G0_INCIDENT_20261117.md` §6. Local commit; **not pushed**. | any of Test-G0Harness P1–P10 FAIL; preflight BLOCK; external terminator not identified or other automation not paused during G0 | |
| **C-A0.4** | G0 run 3 readiness: runner-owned production I5 (`i5-check`: status and owning process identity of every baseline endpoint, in every outcome, also when the monitor dies; only PASS passes; collector not HTTP evidence); baseline v3 with port owners; `-ExpectHttpEndpoints` (21) enforced; P7 exact per-file test manifest (108); read-only agent isolation check + owner checklist, `-AgentIsolationConfirmed`; census at end (monitor end, STOP origin, agents); harness P11–P12. Ops expectation **130**. Record: `docs/EP48_5_G0_RUN3_READINESS.md`. Local commit; **not pushed**. | any of Test-G0Harness P1–P12 FAIL; preflight BLOCK; isolation BLOCK or unreviewed items; production endpoint count not confirmed by the owner | |
| **A-1**  | **G0** in `D:\pdabliss-core-staging\gates`:<br>• clean clone of the release commit;<br>• **temporary SCRAM-authenticated PostgreSQL** on 127.0.0.1:55443 (plain process, not a service, random password in session memory only);<br>• `npm ci` and every gate with 2 workers;<br>• isolation guards I1–I5. | any test failed **or skipped**; any of I1–I5 fails (wrong host / port / database, server identity, a `.env*` present, production postmaster or database list changed); latency regression [C1] |                     |
| **A-2**  | B1–B2:<br>• create `D:\pdabliss-core-staging` folders and `$B` as fixed by the OD-6 rule at C0;<br>• ACLs (`config`, `mail`, `$B` with inheritance removed);<br>• clone, build and verify the release.                                                                                                                                   | HEAD ≠ release commit; `git diff cb21be1 -- backend frontend` not empty; any `.env` in the release; budgets fail                                                                                |                     |
| A-3      | B3: staging PostgreSQL instance as a Windows service on 127.0.0.1:5433 [C2]                                                                                                                                                                                                                                                                    | 5433 on any other address; production postmaster changed; collation differs                                                                                                                   |                     |
| A-4      | B4: secrets, staging roles and database, 28 migrations, demo seed, reset-point backup [C2]                                                                                                                                                                                                                                                     | any check value off; any secret visible in output or logs                                                                                                                                      |                     |
| A-5      | B5: WinSW + `core-staging-api` / `core-staging-web`; refusal drill; LAN-address probes [C3]                                                                                                                                                                                                                                                    | SHA-256 mismatch; refusal outside the drill; post-bind or exposure probe failure                                                                                                               |                     |
| A-6      | B6: staging Backup / Health tasks; Retention created disabled [C3]                                                                                                                                                                                                                                                                             | backup not VERIFIED; retention lists anything outside `$B`                                                                                                                                     |                     |
| A-7      | G6 smoke tests; destructive steps only on `STG-SMOKE-` documents [C4]                                                                                                                                                                                                                                                                          | any smoke test fails                                                                                                                                                                           |                     |
| **A-8a** | **Automatic cleanup of verified disposable test artefacts only** (rollback plan §3):<br>• `D:\pdabliss-core-staging\gates` after G0 — only when the temporary cluster is stopped, 55443 is free, no process references the folder, summaries are copied out, and the path has no reparse point;<br>• `core_restorecheck_*` scratch databases on the staging cluster created and dropped by ops `verify`. | any precondition not met → nothing deleted, report                                                                                                                                             |                     |
| **A-8b** | **Not signable in advance.** Every deletion of a staging release, the staging database, the staging cluster / `pgdata`, any staging backup or the backup folder, `config` / `mail`, and enabling `retention --apply` needs a **separate written authorization at the time**, naming the exact target. | —                                                                                                                                                                                              | (per event)         |

## Part 4 — Explicitly NOT approved

- Any change to PM2 (any daemon, `dump.pm2`, Run keys, tasks), the shared PostgreSQL, MariaDB, Cloudflare, DNS, the
  firewall or existing scheduled tasks.
- Restarting any production app, or the server.
- Real customer data, customer accounts, LAN or public listeners.
- `git push`, CORE commercial production, or EP49.

## Part 5 — Go / no-go

| Condition                          | Met?                          |
| ---------------------------------- | ----------------------------- |
| Part 1 evidence                    | yes, except E-11 (G0, by design) |
| Part 2 answered                    |                               |
| Part 3 signed (A-0 first; A-1, A-2 and A-8a before host work) |            |
| Window agreed                      |                               |

**Decision:** GO / NO-GO — owner ____________________ date ________

## Part 6 — Revised strategy: Minimum Safe Online Deployment (2026-11-17)

New execution order (`docs/EP48_5_ROADMAP.md`):
1. **EP48.5** Minimum Safe Online Deployment;
2. **EP48.6** Guard, Security Hardening and Production Readiness;
3. **EP49** Notifications & Work Queues;
4. **EP50** Supplier RFQ & Quotation;
5. **EP50.1** SEO Enhancement (separate `pdablissv2` repository).

### 6.1 Owner decisions (plan §1.1)

| #    | Decision                                                                                                                                      | Recommended                                                                                     | Owner's answer |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------- |
| OO-1 | Current use of `core.pdabliss.com` (something answers today); the DNS record recorded before any change                                       | identify at O0; if in use: replace, or use a temporary tester hostname                            |                |
| OO-2 | Production runtime mode via the online launcher profile; the demo seed run once in development mode on the isolated demo-only cluster (recorded exception) | accept for tester-only UAT; the code-level runtime identity is EP48.6 (C2)                       |                |
| OO-3 | SMTP provider and dedicated send credential (STARTTLS 587 or TLS 465)                                                                          | dedicated send-only credential, config-folder ACL                                                |                |
| OO-4 | Code delivery for the `*.demo@pdabliss.com` personas                                                                                           | aliases routed to named testers, or testers' own invited accounts                                 |                |
| OO-5 | Tester list and Access identity method                                                                                                         | named e-mails; company IdP or one-time PIN; session ≤ 24 h                                       |                |
| OO-6 | A dedicated Cloudflare tunnel `pdabliss-core` (production tunnels untouched)                                                                    | yes                                                                                              |                |
| OO-7 | HTTP → HTTPS scoped to this hostname only, if not already in place; no zone-wide change                                                       | verify first                                                                                     |                |
| OO-8 | Deployment windows with development agents paused (run-3 isolation checklist)                                                                  | yes                                                                                              |                |

### 6.2 Checkpoints (each signed separately; plan §5.1)

| #  | Approval                                                                                                                                       | Mandatory evidence (plan §3.1)        | Signed |
| -- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------ |
| O0 | Owner decisions + read-only preflight                                                                                                           | OO-1 … OO-8; preflight report          |        |
| O1 | Tooling amendment (online launcher profile, production-identity exclusion fix, WinSW templates, outside-check script); repository only, local commit | M3 (tooling), M12 (harness P1–P12)     |        |
| O2 | Release on disk: folders / ACLs, clone, builds with the HTTPS origin                                                                            | M1, M2, M9, M14                        |        |
| O3 | CORE database: cluster 5433, migrations on the verified target, demo seed (OO-2), verified reset point                                           | M4, M13, M9, M14                       |        |
| O4 | CORE services on loopback; local health; LAN exposure test; refusal drill; R1 drill                                                              | M5, M10 (local), M11, M9, M14          |        |
| O5 | Cloudflare Access application + allow policy (no hostname yet)                                                                                   | M6 (part 1)                            |        |
| O6 | Dedicated tunnel, `core-tunnel` service, public hostname / DNS; outside checks                                                                   | M6, M7, M8, M10, M13, M9, M14          |        |
| O7 | Tester UAT opened                                                                                                                               | all of M1–M14 recorded                 |        |

### 6.3 Classification of the remaining checks (plan §3)

- **Mandatory before any internet-reachable deployment: M1–M14.** Missing evidence = no exposure.
- **Required before commercial customers, EP48.6: C1–C8.** C1 is the full environment qualification (G0 run 3 or equivalent CI) and must PASS.
- **Deferrable: D1–D5.** D5 (production SEO) is EP50.1 in `pdablissv2`.

Still **not** approved by this part:
- commercial customers or real customer data;
- `git push`;
- any change to PM2, the shared PostgreSQL, MariaDB, the production tunnels, other Access applications, zone-wide Cloudflare settings or the firewall;
- EP49.

