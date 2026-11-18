# EP48.5 FINAL — CORE Backup Readiness

**Verdict: PENDING.** Method chosen and validated in isolation; the first production backup + restore verification
has NOT been run (writing it on the production host needs owner approval). A `pg_dump` exit code alone is not counted.

## What exists (inspected)

| Item | State | Evidence |
|---|---|---|
| CORE cluster | PostgreSQL 18.6, 127.0.0.1:5433 only, SCRAM, checksums on, `pdabliss_core_staging`, 28 migrations | Stage 1i / 1r logs |
| Backup role | `core_backup`: LOGIN, no superuser / createdb / createrole, `pg_read_all_data`, CONNECT on the database, limit 5 connections; password only in `config\core-roles.env` (Administrators + SYSTEM) | `ops/roles.mjs`, Stage 1r |
| Tooling | EP43 `ops/core-ops.mjs` `backup` / `verify` / `restore` / `retention` (in the deployed release) | `ops/backup.mjs`, `docs/EP43_*` |
| Destination | `D:\pdabliss-core-staging\backups` — does not exist yet; D: had 889.8 GB free (Stage 2 facts) | — |
| Existing backups / schedule / retention | none | — |
| Database size | unknown until the first run (the manifest records bytes) | — |

## Method (no new tool: EP43, unchanged)

- **backup** — `pg_dump -Fc --no-owner --no-privileges` as `core_backup`, inside one exported REPEATABLE READ snapshot
  that also records every table's row count; written as `.partial`, renamed when complete, never overwritten;
  SHA-256 + manifest; `pg_restore --list` must list table data.
- **verify** — SHA-256 again, archive listing, restore into a NEW `core_restorecheck_*` database on a **separate,
  temporary PostgreSQL 18 cluster** (127.0.0.1:55450, created and removed by the runner — never the live 5433 cluster,
  never 5432), then: migrations equal, table set equal, every row count equal, the ten inventory-ledger checks zero.
  The scratch database is dropped and the temporary cluster removed.
- Credentials: read from env files by the tool, passed to PostgreSQL tools via `PGPASSWORD` in the child environment
  only; nothing printed or logged.

Runner (owner-run, elevated). First the **read-only preflight** (no approval needed; writes nothing):
`Invoke-CoreBackupCheck.ps1 -PreflightOnly -ApprovedBy "<name>"` — connects AS `core_backup` in a read-only
transaction and refuses unless: the role is `core_backup`, has no superuser / createrole / createdb / replication /
bypassrls, is a member of `pg_read_all_data`, is NOT a member of `pg_write_all_data`, can INSERT / UPDATE / DELETE /
TRUNCATE none of the public tables, and the URL points at `pdabliss_core_staging` on 5433; free space on D: is at
least max(10 GB, 5 × database size); the verify port is not 5432 / 5433 / 1311 / 1312 and is free; the temporary
folder is a new folder under `<root>\gates`; all PostgreSQL tools exist. It prints the facts (never a password).

Then the backup (approval A1): `ops-logs\ep48_5-online\deploy\Invoke-CoreBackupCheck.ps1 -Approved -ApprovedBy "<name>"`
— creates the backup folder (inheritance removed; Administrators + SYSTEM), writes `config\ops.config.json` (no
credentials), starts the temporary verify cluster with file-redirected output (G0 incident 1 lesson), runs
`core-ops backup --profile production --verify`, stops / removes the temporary cluster, prints the manifest summary.
No live data change, no migration, no service restart. The temporary cluster is resource-limited (loopback only,
`max_connections 20`, `shared_buffers 64MB`, 2 workers, autovacuum off, fsync off — it is scratch) and its
`postgres.log` is kept in `logs\ops`; its data folder (a restored COPY of customer data) is removed.

**The verified backup is preserved.** The runner never deletes, overwrites or prunes a backup (`core-ops backup` runs
no retention). After verification it re-hashes the dump against the manifest SHA-256 and marks the dump and manifest
read-only. If verification fails the dump is kept for review and the backup is not counted as recoverable. Deleting
a backup is **never** a rollback step for any EP48.5 change; it needs its own explicit owner decision.

## Validation done here (isolated, Level B)

| Check | Result |
|---|---|
| The tool accepts the runner's config: production profile, `approvedBy` gate, database-name match, backup user | PASS (real `ops/lib.mjs`, stand-in `pg`) — unapproved → `NOT_APPROVED`, wrong database → `DATABASE_MISMATCH` |
| A `pg_read_all_data` role dumps a database whose schema, enum, function and append-only trigger belong to another role; restore with `--no-owner --no-privileges --exit-on-error` into a separate cluster that has none of those roles | PASS on PostgreSQL 16: 250/250 rows, migrations table, trigger present and still refusing `UPDATE` after restore |
| The same on PostgreSQL 18 with the real CORE schema | **PENDING** — first production run |

## Retention and limitations

- Proposed retention: daily 7 / weekly 4 / monthly 6, minimum 3 (`core-ops retention`, dry run unless `--apply`).
- **No schedule yet.** A daily scheduled task (backup) + weekly verified restore is a scheduled production job
  (approval) — proposed for EP48.7 together with power-failure recovery.
- **Same machine, same disk (D:).** No off-machine copy: a disk or host loss loses the backups. Off-machine copy
  (EP43 design) is an EP48.7 item.
- Logical backups only (no WAL archiving / point-in-time recovery): the recovery point is the last backup.
- Restoring over the live database is a manual, separately approved procedure (`docs/EP43_DISASTER_RECOVERY_RUNBOOK.md`);
  the tool refuses non-scratch targets.
