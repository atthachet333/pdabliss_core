# EP44 — Infrastructure Activation Plan (for the production host — NOT executed)

A step-by-step procedure for bringing CORE onto the shared PDA Windows host (alongside S2). **Nothing here has been
run.**

- Each phase ends at an **owner checkpoint (✋)**: do not continue without written approval.
- Each phase has its own rollback.
- Run it in a maintenance window agreed with the S2 owner.
- Keep a log: the time, command and result of every step.

Conventions:

- `<core-dir>` = the CORE release root, for example `D:\pdabliss-core`.
- `<backup-dir>` = a backup folder on a **different volume** from the PostgreSQL data.
- `<pg>` = `"C:\Program Files\PostgreSQL\<ver>\bin"`.

Never edit S2's PM2 processes, tunnel rules, databases or roles. CORE gets its **own** database, roles, port, process
and tunnel hostname.

## Phase 0 — Host audit (read-only)

1. Run checklist H1–H10 (`EP44_PRODUCTION_READINESS_AUDIT.md` §2) and write the host audit.
2. Choose and record:
   - the CORE API port (free, bound to 127.0.0.1);
   - the backup volume and the off-machine target;
   - the supervisor (PM2 or a Windows service).
3. Take a baseline: S2's response times, CPU and RAM at its busy hour.

**✋ Checkpoint 0:** the owner approves the host, the ports, the volumes, the supervisor and the window. **Rollback:**
none needed (read-only).

## Phase 1 — Files and configuration

1. Create `<core-dir>\releases\<version>` from a clean checkout of the approved commit, then run
   `npm ci --omit=dev` in `backend`. Build `backend` and `frontend` — or copy build artefacts produced on a build
   machine.
2. Create `C:\ProgramData\pdabliss-core\core.env`, with an ACL of Administrators plus the service account only:
   - `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=<port>`;
   - `TRUST_PROXY=loopback`;
   - `CORS_ORIGINS` and `PUBLIC_APP_URL` set to `https://<core-hostname>`;
   - `AUTH_SECRET` = 48 random bytes, base64;
   - `SMTP_*`;
   - `DATABASE_URL` to the `core_app` role (filled in during Phase 2).
3. Create `ops\ops.config.json` from the example:
   - the `production` profile with `enabled: false` for now;
   - `backupDir=<backup-dir>\production`;
   - `envFile` pointing at a separate `core-backup.env` (the `core_backup` role).

**Rollback:** delete the release folder and the env files. Nothing is running yet.

## Phase 2 — Database and least-privilege roles (cluster-wide objects)

1. **Before:** back up every existing database on the cluster (S2's included), using its owner's procedure. Run
   `pg_dumpall --roles-only` to a protected file (a roles snapshot).
2. As a cluster administrator: set `CORE_OWNER_PASSWORD`, `CORE_APP_PASSWORD`, `CORE_BACKUP_PASSWORD` and
   `CORE_MONITOR_PASSWORD` (≥ 24 random characters each) in the session environment only. Then run
   `CORE_ROLES_ALLOW_SHARED_CLUSTER=yes`, followed by `createRoles` / `createDatabase('pdabliss_core')` from
   `ops/roles.mjs`.
   - The roles are NOSUPERUSER / NOCREATEDB / NOCREATEROLE, with connection limits.
   - PUBLIC loses CONNECT on the new database.
3. As `core_owner`: `npx prisma migrate deploy`. Expect 26 / 26 applied.
4. `grantRuntime('pdabliss_core')`, then `ownershipAudit` → 0 objects not owned by `core_owner`.
5. Seed the platform owner only (no demo data): `npm run db:seed` with the production variables (never `db:seed:demo`
   — demo seeding refuses production by design, `test/auth-bootstrap.test.ts`).
   - The script runs through `tsx`, a dev dependency, so run it from the build checkout (dev dependencies installed),
     pointed at the production database as `core_owner` — not from the `--omit=dev` release folder.
6. Verify with `forbiddenAttempts(core_app URL)`: **17 / 17 refused**.

**✋ Checkpoint 2:** the owner confirms S2 is unaffected (S2 smoke test; `pg_stat_activity` per database).

**Rollback:**

1. `DROP DATABASE pdabliss_core`.
2. `DROP ROLE core_app, core_backup, core_monitor, core_owner`.
3. Compare `pg_dumpall --roles-only` with the snapshot.

## Phase 3 — Process supervision

**Option P (PM2, already used for S2):**

1. `pm2 start <core-dir>\releases\<version>\backend\dist\server.js --name pdabliss-core-api --node-args="--env-file=C:\ProgramData\pdabliss-core\core.env" --max-memory-restart 600M`.
2. `pm2 save`.
3. Install `pm2-logrotate` **only if it is not already configured for S2** — it is global; consult the S2 owner.

**Option W (Windows service):**

1. WinSW / NSSM wrapper for `node dist\server.js`.
2. Automatic (delayed) start, dependent on `postgresql-x64-*`.
3. Restart on failure after 10 s / 30 s / 60 s.
4. stdout to `C:\ProgramData\pdabliss-core\logs`, with size rotation.

**Then:**

1. `GET http://127.0.0.1:<port>/health` must answer 200.
2. `GET /health/ready` must answer 200 with `schema: ok`.
3. Reboot drill (in the window): CORE must be ready within 5 minutes of boot, and S2 must be unaffected.

**✋ Checkpoint 3.** **Rollback:** `pm2 delete pdabliss-core-api && pm2 save` (or remove the service). The database
stays.

## Phase 4 — Backups, retention, off-machine, monitoring

1. Set `production.enabled = true` and `approvedBy = "<owner, date>"`.
2. Run `ops backup --profile production --verify` by hand. It must print **VERIFIED**. Point the `verify` server at a
   scratch cluster or a restore host, never `pdabliss_core` itself.
3. Task Scheduler (a dedicated "PDA BLISS CORE" folder; runs as the service account):

   | Time        | Task                                                                                            |
   | ----------- | ----------------------------------------------------------------------------------------------- |
   | 02:00       | `ops\core-ops.cmd backup --profile production --verify`                                         |
   | 03:00       | `ops\core-ops.cmd retention --profile production --apply` (only after 3 verified backups exist) |
   | every 5 min | `ops\core-ops.cmd health --once`                                                                |

4. Off-machine:
   - an encrypted copy of `<backup-dir>\production` to the approved target (external disk or the NAS), weekly at
     least, with `robocopy` and the copy's own log;
   - a monthly restore test **from the off-machine copy**.
5. Alerts: e-mail adapter, once SMTP is available and wired (a small follow-up). Until then the operator checks
   `ops status` daily.

**✋ Checkpoint 4:** 7 consecutive VERIFIED backups; one restore from the off-machine copy VERIFIED; the monitor log
shows no unexplained alerts.

**Rollback:** disable the three scheduled tasks. Backups already taken are kept.

## Phase 5 — Edge (Cloudflare tunnel)

1. In the existing tunnel, the infrastructure owner adds a **new** public hostname `<core-hostname>` →
   `http://127.0.0.1:<port>` (API) and the static frontend. **Do not modify S2's ingress rules.**
2. Check:
   - from outside, `https://<core-hostname>/health` answers 200;
   - the backend log shows the **real client IP** (`TRUST_PROXY=loopback`);
   - a request with a forged `X-Forwarded-For` still logs the real IP;
   - sign-in over HTTPS works (`__Host-` cookie set);
   - a request with a foreign Origin is refused.
3. Access policy for a pilot: Cloudflare Access (or an IP allow-list) restricted to the pilot users — recommended.

**✋ Checkpoint 5.** **Rollback:** remove the CORE hostname from the tunnel. S2 is untouched.

## Phase 6 — Pilot go-live gate

Close the remaining B-items of `EP44_RELEASE_GATE_MATRIX.md`:

- human UAT complete;
- the single-department and BOM scoping decisions;
- PDPA documents.

**✋ Final checkpoint:** written owner GO for the named pilot customers.

## Update and rollback (steady state)

**Update:**

1. Verified backup.
2. New release folder.
3. Stop the backend.
4. `migrate deploy` as `core_owner`.
5. Point the supervisor at the new folder.
6. Readiness 200 + smoke test.

**Rollback:**

- No migration in the release: point back to the previous folder.
- With a migration: restore the pre-deploy backup (runbook §R) and start the previous folder.

Never edit `_prisma_migrations`.
