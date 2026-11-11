# EP43 — Infrastructure Audit (read-only)

**Date:** 2026-11-11 · **Baseline:** `cc34513` (= `origin/main`, verified on the live remote).
**Method:** read-only inspection only — CIM / WMI queries, `Get-PhysicalDisk`, `Get-Volume`, `Get-Service`,
`Get-NetTCPConnection`, process list, and PostgreSQL `SHOW` / catalog reads inside `BEGIN READ ONLY`. Nothing on
the host, the PostgreSQL service, its configuration or any database was changed. Private IP addresses, user names
and personal paths are deliberately left out of this document.

## 1. Which machine is this? — **not the production server**

| Fact                              | Value                                                                            | What it tells us                                               |
| --------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Operating system                  | Windows 11 **Enterprise** 10.0.26300 (64-bit)                                    | The brief's target is Windows 11 **Pro** — a different edition |
| Hardware                          | desktop chassis (ASUS board), no battery                                         | A workstation-class PC, no UPS reported                        |
| CPU / RAM                         | Intel Core i5-12400 (6 cores / 12 threads) · 15.7 GB (3.8 GB free at audit time) |                                                                |
| Uptime                            | 2.2 h at audit time                                                              | Rebooted today — not a long-running server                     |
| PM2                               | not installed / no process                                                       | The PDA production server runs PM2 (per the brief)             |
| Cloudflare tunnel (`cloudflared`) | no service, no process                                                           | The PDA production server publishes through Cloudflare tunnels |
| Web server (IIS / nginx / Caddy)  | none                                                                             |                                                                |
| Remote access                     | RDP (3389) and AnyDesk listening                                                 | Interactive remote administration is possible                  |
| Other applications                | MySQL (3306, all interfaces) and three non-CORE PostgreSQL databases             | Shared machine                                                 |
| Repository location               | inside a **OneDrive-synced** folder (OneDrive running)                           | Anything written into the repo is uploaded to the cloud        |

**Conclusion:** this is the owner's development / UAT workstation. The production host is **not identified and not
audited** — every production statement in the EP43 documents is a design, not an observation (blocker B1).

## 2. Storage

| Disk          | Bus / media | Size    | Health  | Volume                                  | Used  | Free    |
| ------------- | ----------- | ------- | ------- | --------------------------------------- | ----- | ------- |
| WD Blue SN580 | NVMe SSD    | 466 GB  | Healthy | C: (system, PostgreSQL)                 | 43 %  | 265 GB  |
| HS-SSD-E100   | SATA SSD    | 239 GB  | Healthy | E: (label of an older Windows install)  | 30 %  | 166 GB  |
| ST2000DM008   | SATA HDD    | 1.86 TB | Healthy | D: (data, the OneDrive-synced projects) | 4.5 % | 1.78 TB |

"Healthy" is the Windows storage-subsystem status; SMART attribute detail (reallocated sectors, wear level) needs an
administrator tool and was not read. All three disks are inside one PC: a second disk is **not** disaster recovery
(fire, theft, power surge or ransomware take all of them).

## 3. PostgreSQL

| Setting            | Value                                                                                                | Assessment                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version            | 18.6 (Windows service `postgresql-x64-18`, automatic start)                                          | current                                                                                                                                                           |
| Data directory     | `C:/Program Files/PostgreSQL/18/data` (0.59 GB) — on the NVMe C:                                     | fast; shares the system disk                                                                                                                                      |
| WAL                | `pg_wal` inside the data directory, 9 segments / 144 MB; `wal_level = replica`, `max_wal_size = 1GB` | same disk as data                                                                                                                                                 |
| Archiving / PITR   | `archive_mode = off`                                                                                 | no point-in-time recovery: the recovery point is the last logical backup                                                                                          |
| `listen_addresses` | `*` (all interfaces)                                                                                 | the port is reachable from the network …                                                                                                                          |
| `pg_hba`           | only loopback `host` rules (scram-sha-256)                                                           | … but only loopback clients may log in. Defence in depth would also bind to localhost (needs a config change + service restart — not done, blocker B7)            |
| TLS                | `ssl = off`                                                                                          | acceptable for loopback-only; required if the database is ever reached over a network                                                                             |
| Authentication     | `password_encryption = scram-sha-256`                                                                | good                                                                                                                                                              |
| Integrity          | `data_checksums = on`, `fsync = on`, `full_page_writes = on`, `synchronous_commit = on`              | good                                                                                                                                                              |
| Memory             | `shared_buffers = 128MB` (default), `effective_cache_size = 4GB`, `max_connections = 100`            | defaults; fine for the current size, worth tuning on a dedicated host                                                                                             |
| Server log         | `logging_collector = on`, `log/` in the data directory, rotation 10 MB / 1 day                       | old log files are not removed automatically — they grow slowly (0.01 GB now)                                                                                      |
| Roles              | **one**: `postgres` (superuser)                                                                      | CORE dev / UAT run as the superuser — the EP41 release blocker; EP43's role model is designed and tested on a disposable cluster (`EP43_DATABASE_ROLE_POLICY.md`) |

### Databases (logical names, not the data directory)

| Group                                                                                                                                             | Count | Size          |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------- |
| `pdabliss_core_dev`                                                                                                                               | 1     | 17.0 MB       |
| `pdabliss_core_uat` (owner UAT, untouched)                                                                                                        | 1     | 16.6 MB       |
| `pdabliss_core_test` (automated tests)                                                                                                            | 1     | 24.0 MB       |
| Leftover scratch copies from EP34–EP42.4 (`pdabliss_core_qa*`, `_up*`, `_ep*gen`, `_mig38`, `_e2e39`, `_devcopy39`, `_backupcheck`, `_uat_ep423`) | 21    | ≈ 330 MB      |
| Other projects (names withheld)                                                                                                                   | 3     | 7.8 – 22.5 MB |

The leftover scratch databases are harmless but should be removed by an owner decision (blocker list item B10) —
EP43 deleted nothing. Dev and UAT are both on all **26** migrations (newest `20261111090100_ep41_history_immutability`,
none unfinished).

## 4. Application environment

| Item                             | Value                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js / npm                    | v24.19.0 / 11.17.0                                                                                                                                      |
| Prisma / client · `pg` · Fastify | 7.10.1 · 8.23.1 · 5.12.7                                                                                                                                |
| Environments                     | dev `localhost:1111/1112` → `pdabliss_core_dev` · UAT `127.0.0.1:1211/1212` → `pdabliss_core_uat` (EP42.2 `uat/uat.mjs`) · tests → `pdabliss_core_test` |
| Startup model                    | developer-started processes (`npm run dev`, `uat start` runner); no service, no supervisor, no restart on reboot                                        |
| Existing backups                 | UAT tool backups (`uat backup`, 5 files, < 1 MB) in the user profile, outside OneDrive; no scheduled backup of anything CORE                            |
| Logs                             | UAT backend / frontend logs (append, no rotation); PostgreSQL server log (rotated, not pruned)                                                          |

## 5. Capacity — measured

| Measure                                                                   | Value                                                           |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| CORE database with full demo / UAT data                                   | 16.6 – 17.0 MB on disk                                          |
| Custom-format backup of it                                                | **0.48 MB** (compressed)                                        |
| Backup time / restore-verify time                                         | 0.7 s / 1.9 – 2.1 s (EP43 runs, UAT and dev)                    |
| GFS retention (7 daily + 4 weekly + 6 monthly ≈ 17 files) at today's size | < 10 MB                                                         |
| Health monitor cycle                                                      | 0.56 s wall, 44 ms CPU, ≈ 71 MB RSS, **0** database connections |
| Backup + verify                                                           | ≈ 62 MB peak (Node), 1 connection + `pg_dump` / `pg_restore`    |

**No growth forecast is possible yet:** the only data is demo / UAT data. What to measure once a pilot runs (the
storage monitor and backup manifests already record most of it): weekly database size, backup size, WAL volume per
day, and rows added per month in `StockMovement`, `AuditLog`, sales and purchase lines. Re-estimate retention storage
after four weeks of real use (rule of thumb: retention storage ≈ 17 × backup size, plus one spare full restore).

## 6. Risks found

| #   | Risk                                                                                                  | Severity | Status                                  |
| --- | ----------------------------------------------------------------------------------------------------- | -------- | --------------------------------------- |
| R1  | Production host unknown; nothing about it is verified                                                 | high     | blocker B1                              |
| R2  | CORE runs as the PostgreSQL superuser (can bypass the EP41 history triggers)                          | high     | role model tested; activation is B2     |
| R3  | No scheduled backup, no off-machine copy, no PITR                                                     | high     | tooling ready; activation B3 / B4       |
| R4  | The repository lives in OneDrive — a backup written there would leave the machine silently            | medium   | backup tooling refuses cloud-sync paths |
| R5  | PostgreSQL listens on all interfaces (login limited to loopback by pg_hba)                            | medium   | B7                                      |
| R6  | MySQL listening on all interfaces; RDP / AnyDesk exposed — another application's / the owner's choice | info     | not changed                             |
| R7  | No process supervisor, no restart after reboot                                                        | medium   | design only (B5)                        |
| R8  | 21 leftover scratch databases                                                                         | low      | B10                                     |
