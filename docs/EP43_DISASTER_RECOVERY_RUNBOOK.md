# EP43 — Disaster Recovery Runbook

For whoever operates CORE. Commands assume the repository root and an `ops/ops.config.json`. `ops` below means
`node ops/core-ops.mjs` (or `ops\core-ops.cmd`).

**Ground rules for every incident:**

- Never delete PostgreSQL data files, `pg_wal`, tables or `AuditLog` rows.
- Never restore over a live database without the approval in §R.
- Take a backup **before** any repair (`ops backup --profile <p> --verify`).
- Write down what you did, with times.

Health signals: `GET /health` = the process is alive (liveness); `GET /health/ready` = it may serve (database
reachable, schema matches). `ops health --once` checks frontend, liveness, readiness, storage and backup freshness;
`ops status` prints the last result.

---

### 1. Backend process crash

- **Symptoms:** pages show "The service could not be reached"; API calls fail.
- **Detection:** monitor `backend-live = critical`; `/health` does not answer.
- **Immediate actions:**
  1. Look at the backend log (last 200 lines) for the error.
  2. Check that PostgreSQL is up (`pg_isready -h localhost -p 5432`).
  3. Check disk space (`ops storage`).
- **Recovery:** start the backend with the documented command (handbook §4). If it crashes again at start-up, read the
  first error: a config error names the missing variable; `EnvValidationError` means a production requirement is
  missing.
- **Verification:** `/health` returns 200, `/health/ready` returns 200, and a test sign-in works.
- **Escalate if:** it crashes repeatedly within 10 minutes, or the log shows database or permission errors (→ scenarios 3 and 9).

### 2. Frontend unavailable

- **Symptoms:** the browser cannot load the site, or shows a blank page.
- **Detection:** monitor `frontend = critical`, while `backend-live` is ok.
- **Immediate actions:** check the static host / web server and whether the `dist/` files are present. Do **not**
  touch the Cloudflare tunnel configuration without its owner.
- **Recovery:** redeploy the last good `dist/` (handbook §8, rollback).
- **Verification:** `/login` loads in TH, EN and ZH, and the browser console shows no 404s for assets.
- **Escalate if:** the tunnel or DNS appears to be the cause — that belongs to the infrastructure owner.

### 3. PostgreSQL connection failure (service up)

- **Symptoms:** `/health` returns 200 but `/health/ready` returns 503 with `database: unavailable`; pages show errors
  while loading data.
- **Detection:** monitor `backend-ready = warning` (alive but not ready). This was tested in EP43: stopping the
  database turned readiness to 503 and the monitor raised one warning; restarting it gave one recovery, and the backend
  reconnected by itself.
- **Immediate actions:**
  1. `pg_isready`.
  2. Count connections (`SELECT count(*) FROM pg_stat_activity`) against `max_connections`.
  3. Check the role's connection limit, and the password in the env file.
- **Recovery:** fix the cause (password, connection limit, an idle-connection leak). The backend's pool reconnects
  without a restart.
- **Verification:** `/health/ready` returns 200.
- **Escalate if:** it is not resolved in 30 minutes, or there are authentication errors that nobody expected
  (→ scenario 10).

### 4. PostgreSQL service unavailable

- **Symptoms:** as in 3, and `pg_isready` reports "no response".
- **Detection:** monitor `backend-ready`. The direct `database` check is critical if it is configured.
- **Immediate actions:** look at the Windows service state (`Get-Service postgresql-x64-18`) and the newest file in
  `data/log`. Do **not** delete `postmaster.pid` or anything in `data/` by hand.
- **Recovery:** an administrator starts the service. If it refuses to start, read the log: disk full → scenario 5;
  corruption → scenario 6.
- **Verification:** `pg_isready` answers, `/health/ready` returns 200, and `ops health --once` is ok.
- **Escalate if:** the service will not start → database administrator plus the newest verified backup.

### 5. Disk approaching full

- **Symptoms:** the monitor raises `Storage <volume> WARNING / CRITICAL` with free GB, used %, a timestamp and the
  largest files.
- **Detection:** `ops storage` (exit 3 when critical). Thresholds: 70 % observe, 80 % warning, 90 % critical; also
  < 20 GB warning and < 10 GB critical.
- **Immediate actions (safe):**
  1. Run `ops retention --profile <p>` as a **dry run**, and apply it only if it removes old, verified-protected backups.
  2. Move old PostgreSQL server logs (`data/log/*.log` older than 30 days) to another disk.
  3. Remove unrelated large files with their owner's agreement.
- **Never:** delete files in `data/`, `pg_wal`, tables, audit rows, or the newest verified backups.
- **Recovery:** add capacity, or move the backup folder to another volume (config change).
- **Verification:** the monitor sends the recovery alert ("back to normal").
- **Escalate if:** critical with no safe space to free → the infrastructure owner immediately (PostgreSQL stops writing
  when the disk is full).

### 6. Database corruption or accidental data loss

- **Symptoms:** errors such as `invalid page`, a checksum failure (checksums are on), or missing / wrong business data.
- **Immediate actions:**
  1. **Stop writes:** stop the backend.
  2. Take a backup of the damaged state, if possible, as evidence.
  3. Note the time the damage happened.
- **Recovery (approval §R required):**
  1. `ops verify --file <newest backup before the damage>` to confirm it is good.
  2. `ops restore --file … --target core_restore_<incident>` to check the data in a scratch database.
  3. With approval, restore it as the live database (procedure §R).
- **Data loss to expect:** everything after that backup (RPO 24 h today; there is no PITR).
- **Verification:**
  1. the ledger checks are 0;
  2. sign in with each role;
  3. spot-check the latest documents against paper records;
  4. `/health/ready` returns 200.
- **Escalate:** always — the owner decides on the restore and how to re-enter lost transactions.

### 7. Host power failure

- **Symptoms:** everything is down; on return, the services may not have restarted.
- **Immediate actions:** after power returns, check that PostgreSQL started. It recovers through WAL by itself — let it.
  Then start the backend and frontend (there is no supervisor yet, B5).
- **Verification:** `ops health --once` is ok, and the ledger checks are 0.
- **Prevention:** a UPS with clean shutdown (not present on the audited machine).
- **Escalate if:** PostgreSQL reports recovery errors → scenario 6.

### 8. Failed application update

- **Symptoms:** errors after a deploy; readiness shows `schema: behind` or `ahead`.
- **Immediate actions:** stop the new version.
- **Recovery:** roll back to the previous release folder (handbook §8).
  - If the update ran **no** migration, the rollback is complete.
  - If it ran migrations, see scenario 9 — the previous version will report `schema: ahead` and is not ready by
    design.
- **Verification:** `/health/ready` returns 200, plus a smoke test (sign-in, open a sales order, a warehouse list).

### 9. Failed database migration

- **Symptoms:** `prisma migrate deploy` fails; readiness shows `schema: behind` (a pending or failed migration).
- **Immediate actions:**
  1. Do **not** edit `_prisma_migrations` or rerun anything blindly.
  2. Keep the failing output.
  3. The pre-deploy backup (mandatory, handbook §7) is your way back.
- **Recovery:**
  - Fix the migration and redeploy, or
  - restore the pre-deploy backup (§R) and deploy the previous application version.
- **Verification:** `/health/ready` reports `schema: ok`, and the ledger checks are 0.
- **Escalate:** always involve the developer who wrote the migration.

### 10. Credential exposure (database password, AUTH_SECRET, SMTP)

- **Immediate actions:**
  1. Rotate the exposed secret:
     - database role: `ALTER ROLE core_app PASSWORD …` as `core_owner` or an administrator, then update the env file
       and restart the backend;
     - `AUTH_SECRET`: rotating it invalidates outstanding one-time codes.
  2. Check `pg_stat_activity` and the PostgreSQL log for unknown clients.
  3. Check `AuditLog` for unexpected actions.
- **Verification:** the old secret no longer works, and the application is ready.
- **Escalate:** always (owner). If backups may have leaked, treat their data as exposed.

### 11. Backup job failure

- **Symptoms:** the monitor raises `backup:<profile>` warning (newest verified backup older than 26 h) or critical
  (> 50 h); the ops log contains `REFUSED` or `FAILED`.
- **Immediate actions:**
  1. Read `ops.log`; the refusal code names the cause (`IDENTITY_MISMATCH`, `CLOUD_SYNC_PATH`, `TOOL_FAILED`,
     `EMPTY_BACKUP`, `CORRUPT` …).
  2. Run `ops backup --profile <p> --verify` by hand.
- **Verification:** a new verified backup exists (its manifest contains `verified.ok: true`), and the monitor recovers.
- **Escalate if:** two consecutive days without a verified backup.

### 12. Expired or invalid TLS (where TLS applies)

- **Context:** CORE has no TLS of its own. Public TLS would terminate at the Cloudflare tunnel or edge, and
  PostgreSQL TLS is off (loopback only).
- **Symptoms:** browsers show certificate errors.
- **Action:** the tunnel or edge owner renews the certificate. CORE's cookies are `Secure` in production, so CORE
  needs HTTPS in front of it to work at all.
- **Escalate:** to the infrastructure owner.

---

## §R. Restoring a protected database (approval required)

The ops tool restores **only** into a new `core_restore_<suffix>` database, and refuses dev, UAT, production and
`postgres`. Replacing a live database is deliberately manual:

1. Written approval from the owner: incident, backup file, accepted data loss.
2. `ops verify --file <backup>` → `VERIFIED`.
3. `ops restore --file <backup> --target core_restore_<incident>` → inspect.
4. Stop the backend. Rename the live database (`ALTER DATABASE pdabliss_core RENAME TO pdabliss_core_broken_<date>`),
   then rename the restored one into place. Re-apply the role grants (`ops/roles.mjs` `grantRuntime`), because
   backups are taken `--no-owner --no-privileges`.
5. Start the backend: `/health/ready` returns 200, the ledger checks are 0, and a smoke test passes.
6. Keep the broken database until the owner confirms. Never drop it the same day.

## Measured (EP43, demo data)

| Step                                      | Time                                                      |
| ----------------------------------------- | --------------------------------------------------------- |
| Backup (UAT, 0.48 MB)                     | 0.7 s                                                     |
| Restore + verify (71 tables)              | 1.9 – 2.1 s                                               |
| Restore drill via CLI                     | 1.9 s                                                     |
| Database outage detection → readiness 503 | ≤ 5 s (readiness cache) + monitor interval (default 60 s) |
