# EP48.5 — Server Audit (Stage A, read-only)

**Date:** 2026-11-17 · **Baseline:** `cb21be1` (EP48) · **Scope:** Stage A, Phases 0–2 and 7 ·
**Status: COMPLETE.** Host identity, the collision map, startup mechanisms, PostgreSQL, storage, firewall and the
availability baseline are verified. The quality gates are carried to Stage B as G0 (§6).

**Evidence** (collected on the host by the owner, read by the agent from `ops-logs/`, git-ignored):

| Run | Folder                                    | Collector              | Elevated | Errors / warnings / elevation gaps |
| --- | ----------------------------------------- | ---------------------- | -------- | ---------------------------------- |
| 1   | `ops-logs/ep48_5-host-audit/20261117-093204` | v1                     | no       | 1 error (`pm2` JSON) + 3 unrecorded |
| 2   | `ops-logs/ep48_5-host-audit/20261117-095646` | **v2**                 | **yes**  | **0 / 6 / 0**                       |

The six run-2 warnings are the response bodies of six HTTP 404s from API back ends that have no `GET /` route (§4.5).
**They are not failures.**

Nothing on the host was changed by this audit, except one disclosed side effect of collector v1 (§4.3). User names,
private IP addresses, secrets and connection strings are left out; profile paths are written as `%USERPROFILE%`.

## 1. Method

- The agent's shell is a sandboxed Linux VM on the host with only the repository mounted. All Windows-side evidence comes
  from `ops/ep48_5/Collect-HostAudit.ps1`, run by the owner.
- **Collector v2:**
  - read-only;
  - **never runs `pm2`**;
  - PostgreSQL only in a `default_transaction_read_only` session with a prompted, unstored password;
  - secrets redacted;
  - one `GET /` per local node port.
- PM2 inventory comes from the process tree plus PM2's own `pids\*.pid` files and `dump.pm2`. The dump is parsed by node
  with every environment block dropped.
- **v1 → v2 fixes:**

  | v1 problem                                              | Cause                                                                                                                                                         | v2                                                       |
  | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
  | `Measure-Object` / `-ExpandProperty`: property not found | records were `[ordered]` dictionaries, which PS 5.1 `Measure-Object -Property` / `-ExpandProperty` do not read                                                 | null-safe helpers and explicit loops                     |
  | `pm2: Invalid JSON primitive`                           | a `[PM2] …` status line was taken as JSON. `pm2 jlist` under the interactive account also reaches the wrong daemon and can spawn one (§4.3). | no `pm2` command                                         |
  | non-terminating errors lost                             | `Continue` preference                                                                                                                                          | recorded as warnings                                     |
  | pid-file "alive" true for reused PIDs                   | Windows reuses PIDs                                                                                                                                            | alive only if the PID is an app process (fixed after run 2) |

## 2. Repository (Phase 0) — PASS

| Check            | Result                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| HEAD = `origin/main` | `cb21be102a03495c1b6659d99fa8d49eef8eaa4e` (EP48), confirmed from the VM and on Windows                                      |
| Working tree     | only the untracked EP48.5 files (`docs/EP48_5_*.md`, `ops/ep48_5/`)                                                            |
| Build state      | no `node_modules` / `dist` / `.env`: CORE has never been built or run on this host                                            |
| Migrations       | 28                                                                                                                            |
| Live remote      | not reachable from the agent → the owner runs `git fetch` and confirms `origin/main` = `cb21be1` at C0                         |

## 3. Host identity and capacity (Phase 1) — VERIFIED

| Item             | Evidence                                                                                                                                       | Brief       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Host             | **S2A-SERVER**, workgroup; Lenovo 30DHS11T00 desktop; no battery / UPS reported                                                                  | —           |
| OS               | **Windows 11 Pro** 10.0.26100 (installed 2024-12-30); booted 2026-11-15 18:37                                                                   | ✓           |
| CPU / RAM        | **Intel Core i7-10700** 8 C / 16 T · **63.7 GB**                                                                                                 | ✓ / ✓       |
| Load             | run 1: CPU avg 2.7 %, max 9 %. Run 2: CPU avg 1.1 %, max 3 %. Free RAM ≥ **39.8 GB**; disk time 0 %.                                           | headroom ✓  |
| C:               | **NVMe SSD** SK Hynix 238 GB: system, shared PostgreSQL data; 101 GB free (57 % used)                                                           | ✓           |
| D:               | **SATA SSD** Transcend 954 GB: all project repositories, `D:\S2A_BACKUP`, `D:\backups`; 891 GB free (6.5 %)                                     | ✓           |
| G: "S2_NAS_DATA" | **SATA HDD** WD 2 TB, internal: holds the **S2 NAS document store** `G:\S2_NAS_DATA` (373,048 files, 172 GB, written today 02:02); 1.69 TB free | ✓           |
| Network drives   | none; G: is **not** off-machine                                                                                                                 | —           |
| OneDrive         | running in the user profile; the projects folder is not synced                                                                                  | —           |
| Runtime          | Node **v24.19.0** (`C:\Program Files\nodejs\node.exe`), npm 11.17.0, PM2 7.0.4 (global, in the user profile), git 2.55                          | Node ≥ 22.12 ✓ |
| Local accounts   | two enabled administrator accounts (including the interactive one) and two enabled standard accounts                              | —           |

## 4. Shared-host collision map (Phase 2) — VERIFIED

### 4.1 Production PM2: startup mechanism

| Layer                         | Evidence                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Boot**                      | Scheduled task **`\PM2 Auto Resurrect Boot`** (SYSTEM, highest, Boot trigger) runs `C:\Scripts\pm2-resurrect.ps1`, which sets **`PM2_HOME = %USERPROFILE%\.pm2`** (the interactive account's PM2 home). Last run 2026-11-15 18:38:33. |
| Production daemon             | **PID 2228**, `pm2\lib\Daemon.js`, **NT AUTHORITY\SYSTEM**, started 18:39:09 (36 s later), 22 children                                                                                            |
| Resurrection list             | `%USERPROFILE%\.pm2\dump.pm2`, last saved 2026-11-11 16:19, **23 apps**                                                                                                                          |
| **Logon** (interactive account) | Run keys **`PM2`** (`pm2-windows-startup` → `pm2_resurrect.cmd`) and **`PM2 Auto Start`** (`C:\Scripts\pm2-autostart.vbs`). Each starts a **user-account** PM2 daemon on the **same `PM2_HOME`**. |
| Disabled / legacy             | Tasks `\PM2 Auto Resurrect User`, `\HR-LINE-BOT`, `\HR-LINE-BOT-CRON`, `\S2A-ERP-Backend`, `\S2A-ERP-Frontend` (all disabled). Task `\PDA Bliss Backend` (logon, enabled) starts a second Property backend on the already-occupied port 5778. |

### 4.2 Production process → port map (PM2 pid files ↔ process tree ↔ listeners)

| PM2 app                       | Port     | Bind          | Kind (from `dump.pm2`)                                 | `GET /` (run 2) |
| ----------------------------- | -------- | ------------- | ------------------------------------------------------ | --------------- |
| `pda-bliss-solution`          | 1369     | 127.0.0.1     | node back end (release folder)                         | 200 · 47 ms     |
| `pda-surprise`                | 1371     | 127.0.0.1     | node back end (release folder)                         | 200 · 24 ms     |
| `s2a-frontend` (S2A ERP)      | 1414     | 127.0.0.1     | vite preview                                           | 200 · 13 ms     |
| `s2a-backend` (S2A ERP)       | 1415     | 0.0.0.0       | node back end                                          | 404 (API) · 18 ms |
| `s2apayroll-frontend`         | 2233     | 127.0.0.1     | vite preview (memory cap 600 MB)                       | 200 · 11 ms     |
| `s2apayroll-backend`          | 2234     | 0.0.0.0       | node back end (memory cap 600 MB)                      | 404 (API) · 2 ms |
| `hr-line-bot`                 | 3333     | `::`          | Next.js                                                | 200 · 38 ms     |
| `bot-cron`                    | —        | —             | HR LINE Bot cron worker (tsx)                          | —               |
| `pda-one-marketing`           | 4242     | `::`          | Next.js                                                | 200 · 64 ms     |
| `pda-one-backend`             | 4243     | `::`          | node back end                                          | 404 (API) · 3 ms |
| `pda-one-app`                 | 4244     | 0.0.0.0       | vite preview                                           | 200 · 10 ms     |
| `pdabliss-frontend`           | 4546     | 0.0.0.0       | `pm2 serve` static                                     | 200 · 9 ms      |
| `pdabliss-backend`            | 4547     | `::`          | node back end                                          | 404 (API) · 10 ms |
| `pda-bliss-web-v2`            | 4610     | 127.0.0.1     | Next.js (memory cap 700 MB)                            | 200 · 123 ms    |
| `s2-pro-web`                  | 5173     | 0.0.0.0       | `pm2 serve` static (**not** a Vite dev server)         | 200 · 15 ms     |
| `pda-bliss-web` (legacy)      | 5555     | 0.0.0.0       | `pm2 serve` static                                     | 200 · 15 ms     |
| `pdabliss-property-frontend`  | 5777     | 0.0.0.0       | vite preview                                           | 200 · 9 ms      |
| `pdabliss-property-backend`   | 5778     | `::`          | node back end                                          | 404 (API) · 2 ms |
| `s2-nas-frontend`             | 8888     | 0.0.0.0       | vite preview                                           | 200 · 18 ms     |
| `s2-nas-backend`              | 8889     | 0.0.0.0       | node back end                                          | 404 (API) · 8 ms |
| `s2a-web-frontend`            | 9898     | `::`          | Next.js                                                | 200 · 106 ms    |
| `s2a-web-backend`             | 9899     | `::`          | node back end                                          | 200 · 11 ms     |
| `pos-app` (streamlit :8501)   | —        | —             | in `dump.pm2`, **not running** (no live process, no listener) | —        |

Other listeners:

| Port(s)                 | Owner                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 5432                    | PostgreSQL 18 (0.0.0.0, `::`)                                                                                          |
| 3306                    | MariaDB 12.3 (0.0.0.0, `::`)                                                                                           |
| 20241 / 20242           | `cloudflared` metrics (127.0.0.1)                                                                                      |
| 3389, 7070, 50195       | RDP, AnyDesk                                                                                                           |
| 135 / 139 / 445 / 623 / 16992 | Windows, Intel AMT                                                                                               |
| 9222                    | a browser debugging port (127.0.0.1)                                                                                   |

The listener sets of runs 1 and 2 are **identical**.

**Excluded port ranges:** 2869, 50000–50059.

**Candidate CORE staging ports 1311 / 1312 / 5433** (and alternates 1411 / 1412 / 5434):

- no TCP or UDP use;
- outside the excluded ranges;
- no firewall rule;
- no local tunnel config.

### 4.3 Idle PM2 daemons (examined; none terminated)

| PID       | Account       | Started                 | Children | Memory | Origin                                                                                     |
| --------- | ------------- | ----------------------- | -------- | ------ | ------------------------------------------------------------------------------------------ |
| 18776     | interactive   | 2026-11-16 08:26:22     | 0        | 68 MB  | logon Run key (`PM2` or `PM2 Auto Start`)                                                  |
| 16972     | interactive   | 2026-11-16 08:26:48     | 0        | 68 MB  | the other logon Run key                                                                    |
| **26680** | interactive   | **2026-11-17 09:32:15** | 0        | 64 MB  | **spawned by EP48.5 collector v1's `pm2 jlist`** (run 1 started 09:32:04): an EP48.5 side effect, disclosed |

**Why they matter:** all three share **`%USERPROFILE%\.pm2`** with the SYSTEM production daemon (pid files, logs,
`dump.pm2`). The 40 dead pid files there show earlier resurrect attempts.

**Risks (inference from PM2's design, not observed failures):**

- a `pm2` command typed under the interactive account reaches one of these daemons, never production;
- a `pm2 save` there could **overwrite the production resurrection list** with an empty or partial one. The next boot
  would then resurrect nothing;
- a logon resurrect could start a **second `bot-cron`** (no port, so no port clash stops it).

**Recommendation (owner, outside EP48.5):**

1. Copy `dump.pm2` to a safe place.
2. Remove the duplicate logon Run keys.
3. In a maintenance window, end the three idle user-account daemons by PID after re-confirming 0 children.

**EP48.5 changes none of this.**

### 4.4 PostgreSQL (shared cluster; read-only session, run 2)

| Fact                | Value                                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service             | `postgresql-x64-18` (NetworkService, Automatic), **18.6**, postmaster PID 5764 started 2026-11-15 18:38:04; data `C:\Program Files\PostgreSQL\18\data` (NVMe C:) |
| Network             | `listen_addresses = *`; `pg_hba` = loopback `scram-sha-256` only; `ssl = off`                                                                                                                         |
| Settings            | `max_connections` 100 (10 client sessions in use), `shared_buffers` 128 MB, `archive_mode = off`, `data_checksums = on`                                                                               |
| Databases           | `pda_one_dev`, `pda_one_prod`, `pda_one_shadow`, `pda_one_test`, `pdabliss_property`, `pdabliss_staging` (not CORE), `postgres` — 8–34 MB each                                                        |
| Roles               | `postgres` (superuser), `pda_one_app`                                                                                                                                                                  |
| CORE presence       | **none**: no `pdabliss_core*` database, no `core_*` role                                                                                                                                              |
| **Collation**       | every database: UTF8, **`English_United States.1252`** collate / ctype, provider **libc**                                                                                                             |
| Sessions            | `pdabliss_property` connects as the superuser `postgres` (another project; noted)                                                                                                                     |

### 4.5 Availability baseline (run 2)

- 21 / 21 production listeners answered: **15 × 200, 6 × 404**, no timeout, no 5xx, 2–123 ms.
- The 404s are API back ends without a `GET /` route. They answered with their own JSON / Express "route not found"
  bodies, which became the 6 warnings: s2a-backend, s2apayroll-backend, pda-one-backend, pdabliss-backend, Property
  back end, s2-nas-backend.
- **Actual failure found:** none among the running apps. `pos-app` is listed in `dump.pm2` but is not running (§4.2). It
  is the owner's call whether that is intended.

### 4.6 Cloudflare, firewall, backups

| Area        | Evidence                                                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare  | `Cloudflared` and `CloudflaredS2A` services (LocalSystem, Automatic), both **token-file, remotely managed**. Ingress lives in the Cloudflare dashboard; there is no local config. Not needed for loopback staging. |
| Firewall    | Domain profile on; **Private and Public off**; the active Ethernet network is **Public** → **firewall off for the active network**. Every `0.0.0.0` / `::` listener is reachable from the LAN. 147 inbound allow rules exist (including MariaDB "any port, any address"), moot while the profile is off. |
| Backups     | **`\PDA ONE Production Backup`** (SYSTEM, every 6 h from 00:30 → 00:30 / 06:30 / 12:30 / 18:30, last result 0) writes `D:\S2A_BACKUP`. Other folders hold older manual dumps (`D:\backups` 15 × `.sql`, 1.9 GB, newest 2026-10-21). |
| Off-machine | none visible. All backup folders are on C:, D: and G: inside this machine. Windows Backup is unused.                                                                                                                 |

### 4.7 S2 NAS serving root (OD-6) — VERIFIED from configuration and code

Read-only inspection of `D:\S2A_PROJECT\S2_NAS` (folder access granted by the owner for this check; only path-type keys
were read, secrets not displayed). Commit `a331766`, 2026-09-18.

| Source                                   | Evidence                                                                                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend\.env`                           | `S2_NAS_STORAGE_ROOT = G:/S2_NAS_DATA/storage`; `S2_NAS_BACKUP_ROOT = G:/S2_NAS_DATA/backups`; restore-staging and rehearsal roots under `G:/S2_NAS_DATA/backups/`. Backend on 0.0.0.0:8889.                                     |
| `src\core\storage.ts`                    | every file access goes through `resolveInsideStorage()`, which throws `INVALID_PATH` for any path that resolves outside the storage root (path-traversal guard)                                                               |
| other directory walks                    | only under the storage root (`resources/`, `temp/`), the backup and restore roots, and the OCR temp root — **nothing enumerates `G:\`**                                                                                       |
| `src\config\env.ts`                      | refuses a backup root nested with the storage root                                                                                                                                                                            |
| S2 NAS schedule (defaults)               | backup 02:00 daily; restore rehearsal Sunday 03:30                                                                                                                                                                            |
| **Running build** `backend\dist` (built 2026-09-21) | the same `resolveInsideStorage` guard, used by `local.provider.js` and `file-storage.js`; the same five directory-walk modules. **The conclusion holds for what actually runs**, not only for the source. (The S2 NAS working tree has uncommitted source edits in its storage files — not EP48.5's, read only, left untouched.) |

**Conclusion:** the S2 NAS application serves `G:\S2_NAS_DATA\storage` only, and `G:\pdabliss-core-staging-backups` lies
outside every S2 NAS root.

**Two limits remain** (the owner's caution applies):

- the G: root is **not private at the filesystem level**: any local account or service can read it unless a folder has
  its own ACL;
- **SMB shares** were not in runs 1–2. Port 445 is LAN-reachable while the firewall profile is off.

Hence the backup folder gets its own ACL. The collector now lists SMB shares, and C0 applies the OD-6 decision rule (G:
only if the S2 NAS roots and the SMB shares check out; otherwise the D: fallback).

## 5. Design findings

| #    | Finding                                                                                                                                                                                                                                         | Consequence for staging                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| F-1  | CORE has no staging mode. Development mode differs from production in **exactly** six code paths: `pino-pretty` logs; `/health` label; cookies (no `Secure`, no `__Host-`); the dev-only **payment-free subscription activation** route (platform role + recent step-up); `AUTH_SECRET` **falls back to a public constant** if unset; production-only env validation. The demo sign-in bypass, persona list and mock routes additionally need `ENABLE_DEMO_ROUTES=true`. The error handler is identical (no stack traces). | a **locked staging profile** plus a fail-closed launcher (architecture D2)                                     |
| F-2  | Sign-in = password + e-mailed code; without SMTP, codes go to `DEV_MAIL_DIR`. Production SMTP requires STARTTLS (`requireTLS`).                                                                                                                  | file mail sink, ACL-protected                                                                                 |
| F-3  | The frontend bakes `VITE_API_URL` in at build time; no production static server in the repository                                                                                                                                              | loopback build served by `vite preview` (the same pattern several production apps here use)                    |
| F-4  | `ops/roles.mjs` role names are fixed and cluster-wide                                                                                                                                                                                          | dedicated staging cluster                                                                                     |
| F-5  | Restore verification needs `CREATEDB`                                                                                                                                                                                                          | harmless on the dedicated cluster                                                                             |
| F-6  | Production PM2 = SYSTEM daemon on the interactive account's `PM2_HOME`, with three idle user daemons sharing it (§4.1, §4.3)                                                                                                                    | CORE staging must not use PM2 in any way                                                                      |
| F-7  | No alert delivery (no SMTP)                                                                                                                                                                                                                    | monitor records only                                                                                          |
| F-8  | Firewall off on the active network                                                                                                                                                                                                             | 127.0.0.1 binds are the only network control: verified at every start                                         |
| F-9  | `pdabliss_staging` exists on the shared cluster (not CORE)                                                                                                                                                                                     | CORE's database is `pdabliss_core_staging` on its own cluster                                                  |
| F-10 | PDA ONE backup at 00:30 / 06:30 / 12:30 / 18:30; billing hourly at :05                                                                                                                                                                         | staging backup at 03:20; health checks avoid :05                                                              |
| F-11 | G: holds the S2 NAS document store; its serving root is verified as `G:\S2_NAS_DATA\storage` (§4.7)                                                                                                                                       | backups in `G:\pdabliss-core-staging-backups` with their own ACL, subject to the C0 OD-6 rule (S2 NAS roots + SMB shares); otherwise the D: fallback |

## 6. Quality gates (Phase 7) — NOT RUN (carried to Stage B as G0)

| Gate                                                     | Result                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Secret scan (1,023 tracked files)                        | **clean**                                                                                              |
| Static review of configuration, dependencies and migrations | **done** (F-1 … F-11)                                                                                |
| Ops tests                                                | **NOT RUN** — `Cannot find module 'pg'`                                                                |
| Backend 611, frontend 1,192, typecheck, lint, format, build, prerender, budgets, migration scratch run | **NOT RUN** — needs `npm ci` and a disposable cluster on the host, which Stage A forbids (no installs) |

## 7. Owner findings outside EP48.5 (nothing changed)

| #   | Finding                                                                                                                                                  | Severity (opinion) |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| O-1 | Production PM2 shares `PM2_HOME` with three idle user-account daemons; logon Run keys create more at every logon; risk of a `pm2 save` overwriting production's `dump.pm2` | **high**           |
| O-2 | Windows Firewall off on the active network; MariaDB, RDP, AnyDesk, SMB and 16 app ports on 0.0.0.0 / `::` reachable from the LAN                          | **high**           |
| O-3 | No off-machine backup; no UPS detected                                                                                                                   | high               |
| O-4 | The Property app uses the PostgreSQL superuser; PostgreSQL listens on all interfaces without TLS (logins loopback-only)                                    | medium             |
| O-5 | The `\PDA Bliss Backend` logon task duplicates a PM2-managed back end; `pos-app` sits in the dump but is not running                                     | low                |
| O-6 | The server doubles as an interactive workstation (coding agents, browsers, media / office software)                                                      | medium             |

## 8. Remaining unknowns

| #   | Unknown                                                      | Needed for EP48.5? |
| --- | ------------------------------------------------------------ | ------------------ |
| U-1 | Cloudflare ingress (dashboard-managed)                       | no (loopback staging) |
| U-2 | MariaDB accounts / hosts                                     | no                 |
| U-3 | Live GitHub `origin/main`                                    | yes → owner `git fetch` at C0 |
| U-4 | Whether the S2 NAS app can see `G:\` outside `G:\S2_NAS_DATA` | **closed**: it cannot (§4.7) |
| U-6 | SMB shares on the host                                       | yes → collector at C0 (OD-6 rule) |
| U-5 | Quality gates                                                | yes → G0           |

## 9. Audit verdict

**PASS (audit complete).** Server identity, workloads, ports, startup mechanisms, PostgreSQL, collation, storage, firewall
and baseline are verified with host evidence. The only Stage A item not executed is Phase 7, deliberately carried as the
first Stage B gate (G0).
