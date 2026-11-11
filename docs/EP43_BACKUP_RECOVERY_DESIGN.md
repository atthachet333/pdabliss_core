# EP43 — Backup & Recovery Design

Tooling: `ops/` (`node ops/core-ops.mjs …` or `ops\core-ops.cmd …`), configuration
`ops/ops.config.json` (git-ignored; start from `ops/ops.config.example.json`). PostgreSQL native tools only
(`pg_dump`, `pg_restore`); Node uses the backend's own `pg` driver — no new dependency, no new service.

## 1. Status at a glance

| Capability                                                           | Status                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Full logical backup (custom format, timestamped, manifest + SHA-256) | **Implemented and verified** on dev and UAT (read-only dumps)                          |
| Restore verification into a disposable database                      | **Implemented and verified** (dev 924 rows, UAT 743 rows, 71 tables, ledger 0)         |
| Restore into a new scratch database                                  | **Implemented and verified** (drill 1.9 s)                                             |
| Retention (grandfather-father-son)                                   | **Implemented and verified** (unit tests; dry run on real folder) — not activated      |
| Scheduled daily backups                                              | **Proposed only** — needs an approved Task Scheduler entry on the production host (B3) |
| Production backups                                                   | **Implemented but not activated** — the `production` profile ships `enabled: false`    |
| Off-machine (external / NAS / off-site) copy                         | **Proposed only — not operational** (B4)                                               |
| Point-in-time recovery (WAL archiving)                               | **Proposed only** (needs `archive_mode` + a service restart — B9)                      |

## 2. Profiles and scope

A command always names a **profile** (`dev`, `uat`, `production`). Each profile names its database explicitly and
takes credentials from an env file:

- the connection string must name the same database, or the profile uses `credentialsOnly` (credentials from the
  env file, database from the profile — still explicit);
- before any work the server must report that database as `current_database()` (identity check);
- a missing env file or key is a refusal — there is **no fallback** to another database;
- the `production` profile works only with `enabled: true` **and** `approvedBy` (who approved it), and only on a
  local host unless `remoteAllowed` is set deliberately.

Backups of each profile go to that profile's own folder (`…/dev`, `…/uat`, `…/production`).

## 3. Backup procedure (what `backup` does)

1. Identity check (database name, server version, newest applied migration, migration count).
2. Opens a `REPEATABLE READ READ ONLY` transaction and exports its snapshot.
3. Counts the rows of every table **inside that snapshot**.
4. Runs `pg_dump -Fc --no-owner --no-privileges --snapshot=<that snapshot>`. The dump and the counts describe exactly
   the same moment, even while CORE is writing.
5. Writes to `<db>-<profile>-<UTC stamp>.dump.partial` and renames it only on success. An existing name is never
   overwritten (the manifest is created with exclusive-create).
6. Checks the result: exit status 0, file non-empty, and `pg_restore --list` shows table data (otherwise the partial
   file is removed and the run fails).
7. Writes the manifest `<file>.json`: database, version, migration, size, SHA-256, table count, row counts per table,
   duration.

**Credentials** reach `pg_dump` through `PGPASSWORD` in the child environment only — never on the command line.
Every console line and log line passes through redaction (URLs, `password=`, cookies, bearer tokens).

**Folder rules.** A backup folder must be:

- an **absolute** path;
- outside the repository;
- outside **OneDrive or any cloud-sync folder**. The repository itself sits in OneDrive on the audited machine, and a
  backup written there would be uploaded without anyone deciding to.

## 4. Verification — when is a backup "verified"?

Only when **every** check passes (`backup --verify`, or `verify --file`):

| #   | Check                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pg_dump` exit status 0                                                                                                                                                           |
| 2   | non-empty file, SHA-256 equal to the manifest (detects corruption: a flipped byte was refused in testing)                                                                         |
| 3   | `pg_restore --list` reads the archive and lists the same number of tables                                                                                                         |
| 4   | it **restores** (`--exit-on-error`) into a **new** disposable `core_restorecheck_<stamp>` database (a truncated archive whose checksum had been faked was caught here in testing) |
| 5   | the restored schema has the same tables, the same newest migration and migration count                                                                                            |
| 6   | every table's row count equals the snapshot counts in the manifest                                                                                                                |
| 7   | the ten inventory-ledger reconciliation checks (`uat/integrity.sql`) are zero                                                                                                     |

The result is stored in the manifest (`verified: { ok, at, restoreSeconds, checks … }`) and the disposable database is
dropped. A valid `pg_restore --list` alone is **not** treated as proof of recoverability.

The verification server is configurable (`verify` in the config). In EP43 it was a disposable PostgreSQL cluster
(own data folder, loopback only), so verification created nothing on the shared server. In production, use a restore
host or a dedicated scratch cluster, never the production cluster's own databases.

## 5. Retention

Grandfather-father-son, configurable (`retention.policy`). Default: the newest backup of each of the last **7 days**,
**4 ISO weeks** and **6 months**, plus the newest **3 verified** backups.

Safety rules:

- dry run unless `--apply`;
- only folders listed in `retention.allowDirs`;
- only files named `<db>-<profile>-<stamp>.dump` and their manifests — anything else is never touched;
- nothing is removed while fewer than `minKeep` verified backups exist;
- anything newer than the newest verified backup is kept;
- every decision is logged.

EP43 deleted **no** existing backup.

**Storage at today's size:** about 17 files × 0.48 MB ≈ 8 MB. The formula is (7 + 4 + 6) × backup size, plus one
scratch restore of the database's size. Re-estimate once real data exists (see the audit, §5).

## 6. Off-machine copy (disaster recovery) — proposed, not operational

All disks of the audited machine are in one PC. Options, cheapest first, none activated:

| Option                                                                                | Cost              | Notes                                                                                                                                                        |
| ------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Encrypted external USB disk, rotated weekly (two disks: one on site, one off site) | one-time          | BitLocker To Go (Windows Pro / Enterprise) or a 7-Zip AES-256 archive of the dump; copy with `robocopy`; restore-test monthly                                |
| B. Separate trusted machine / NAS on the LAN                                          | existing hardware | pull copy over SMB with a read-only share account; keep it off the CORE server's domain credentials (ransomware)                                             |
| C. Approved off-site / cloud bucket                                                   | monthly           | only after an explicit owner decision, client-side encryption, and a data-residency check — **never** silent upload (this is why OneDrive paths are refused) |

An off-machine copy counts as operational only when it is configured **and** a restore from it has been tested. That
has not happened (blocker B4).

## 7. Recovery objectives

| Objective                               | Proposal                                                                      | Measured today                                         | Depends on                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| RPO (data loss)                         | **24 h** with daily backups. ≤ 1 h needs hourly dumps or WAL archiving (PITR) | —                                                      | schedule (B3); PITR (B9)                                             |
| RTO, database restore on a working host | **1 h**                                                                       | restore of the UAT data: **1.9 – 2.1 s**; backup 0.7 s | data size; scales roughly linearly                                   |
| RTO, host lost                          | **1 business day**                                                            | not measured                                           | spare hardware, off-machine copy (B4), documented rebuild (handbook) |

These are **targets, not achievements**. The restore times are for 17 MB of demo data. Re-measure monthly with the
real database by running `verify` against the newest backup (the manifest records the restore seconds).
