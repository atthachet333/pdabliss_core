# EP48.5 — CORE Internal Staging: Deployment Plan (Stage B — NOT executed)

**Status:** ready for owner approval. **Nothing in this plan has run.** Every value comes from the verified host audit
(`EP48_5_SERVER_AUDIT.md`), except the owner decisions in `EP48_5_APPROVAL_CHECKLIST.md`.

**Standing rules for all of Stage B:**

- Stop at every ✋ checkpoint for written owner approval, and keep a log (time, command, result).
- **Never:**
  - run any `pm2` command;
  - touch `postgresql-x64-18`, MariaDB, the Cloudflare services, the firewall or any existing scheduled task / Run key;
  - restart or reconfigure any production app;
  - reboot;
  - copy Dev / UAT or production data;
  - push to Git.
- Any regression trigger (§6) → stop and follow `EP48_5_ROLLBACK_PLAN.md`.

## 0. Required statements

| Item                          | Plan                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact server                  | **S2A-SERVER**: Windows 11 Pro 10.0.26100, i7-10700, 63.7 GB, NVMe C: / SATA SSD D: / HDD G: (collector, elevated, 2026-11-17 09:56)                                                    |
| Application commit            | **`cb21be102a03495c1b6659d99fa8d49eef8eaa4e`** (EP48). The deployed release commit = `cb21be1` plus the EP48.5 `docs/` and `ops/ep48_5/` (launcher) only. Reported separately in the final report. |
| Ports                         | 127.0.0.1:**1311** web · 127.0.0.1:**1312** api · 127.0.0.1:**5433** staging PostgreSQL. All verified free, outside excluded ranges.                                                    |
| Database                      | `pdabliss_core_staging` on the dedicated staging cluster; UTF8, `English_United States.1252` (libc)                                                                                    |
| Services                      | `pdabliss-core-staging-pg`, `core-staging-api`, `core-staging-web`                                                                                                                      |
| Tasks                         | `\PDA BLISS CORE Staging\Backup` (03:20), `\…\Health` (every 5 min from :02), `\…\Retention` (created disabled)                                                                         |
| Directories                   | `D:\pdabliss-core-staging` (SATA SSD, 891 GB free). Backups: `G:\pdabliss-core-staging-backups` (HDD, separate disk, outside the verified S2 NAS roots, own ACL), or the D: fallback `D:\pdabliss-core-staging-backups` if the C0 OD-6 rule fails (same disk — demo-only limitation). |
| Secrets                       | B4: generated on the server into ACL-protected env files; never displayed, committed, chatted or copied                                                                                |
| Firewall / network            | **none**: loopback listeners only (the firewall is off on the active network, so the bind is verified at each start)                                                                  |
| Impact                        | §6. Build-time CPU burst in the window; steady state < 1 GB RAM of 39.8 GB free; three loopback ports; zero changes to shared objects                                                  |
| Backup / recovery             | B6, G7, G8; `EP48_5_ROLLBACK_PLAN.md`                                                                                                                                                  |
| Gates                         | G0–G11 (§5)                                                                                                                                                                           |
| Rollback                      | R1 stop → R4 full removal                                                                                                                                                              |
| Administrator actions         | §7                                                                                                                                                                                    |

**Conventions** (elevated Windows PowerShell 5.1; no secret is ever a command-line argument):

```powershell
$SHA  = 'cb21be102a03495c1b6659d99fa8d49eef8eaa4e'          # application code; the release commit is recorded at A-0
$R    = 'D:\pdabliss-core-staging'
$B    = 'G:\pdabliss-core-staging-backups'                   # or 'D:\pdabliss-core-staging-backups' if the C0 OD-6 rule says so
$PG   = 'C:\Program Files\PostgreSQL\18\bin'                  # 18.6 — read-only use of the shared installation's binaries
$NODE = 'C:\Program Files\nodejs\node.exe'                    # v24.19.0
$DEV  = 'D:\S2A_PROJECT\pdabliss_core'
function New-Secret([int]$n = 32) { $b = New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_') }
```

## 1. Checkpoints at a glance

| ✋   | After                                              | The owner confirms (in writing)                                                                                                                           |
| ---- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-A0 | A-0: both launchers + test matrix written, reviewed | the diff touches only `ops/ep48_5/`, `ops/test/` and `docs/`; the release commit SHA. The tests are **written** here and **run** in G0 (they need the installed dependencies). |
| C0   | pre-flight                                         | the "before" baseline (collector, elevated); `git fetch` shows `origin/main` = `cb21be1`; the maintenance window                                          |
| C1   | G0 quality gates                                   | all green with **0 skipped** (launcher tests T1–T10 included); isolation evidence (§4 G0 guards); A-8a cleanup done and logged                            |
| C2   | B1–B4 (folders, release, cluster, database, seed)  | database gates G1–G4 green; shared PostgreSQL PID 5764 unchanged; production tree unchanged                                                               |
| C3   | B5–B6 (services, backup, monitor)                  | G5, G7, G8 green; no regression                                                                                                                           |
| C4   | G6 smoke tests + G9–G11                            | all PASS → `EP48_5_STAGING_VALIDATION.md`, `EP48_5_OPERATIONS_HANDOFF.md` and `EP48_5_FINAL_REPORT.md` written; human UAT handed to the owner            |

## 2. Pre-Stage-B repository step A-0 (repository change only, no host change)

1. Write the two fail-closed launchers and their tests, exactly as specified in architecture §4.2:
   - `ops/ep48_5/staging-launch.mjs` (P1–P8, L1–L12);
   - `ops/ep48_5/staging-web-launch.mjs` (W1–W4);
   - `ops/test/staging-launch.test.mjs` (T1–T10).
2. Review the diff. **No file under `backend/` or `frontend/` changes.**
3. Local commit after the owner approves C-A0. **Not pushed.**

The tests cannot run before G0 (they need the installed dependencies and a disposable cluster). No service is created
unless they pass there.

## 3. Pre-flight (read-only) ✋ C0

1. Run the elevated collector (it now also lists SMB shares and port 55443) → `ops-logs\ep48_5-host-audit\<ts>` =
   **"before"**. It records:
   - production tree: daemon PID 2228, its 22 child PIDs and start times;
   - listeners; HTTP baseline;
   - shared PostgreSQL postmaster PID 5764 and start time; the database list;
   - SMB shares; CPU / RAM.
2. `git -C $DEV fetch origin` → `origin/main` = `cb21be1` (closes U-3).
3. Confirm 1311 / 1312 / 5433 / **55443** are free; D: ≥ 10 GB and G: ≥ 10 GB free.
4. **OD-6 decision rule** (backup location), re-checked from evidence on the day:

   | Check                                                                                                                                                                 | If it passes                     | If it fails or cannot be checked   |
   | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------- |
   | a. The S2 NAS `.env` still sets `S2_NAS_STORAGE_ROOT`, `S2_NAS_BACKUP_ROOT`, `S2_NAS_RESTORE_STAGE_ROOT` and `S2_NAS_REHEARSAL_STAGE_ROOT` under `G:/S2_NAS_DATA/` (path keys only, read-only) | G: allowed                       | **D: fallback**                    |
   | b. No SMB share other than the default administrative ones (`G$`, `C$`, `D$`, `ADMIN$`, `IPC$`) has a path equal to `G:\` or containing `G:\pdabliss-core-staging-backups` | G: allowed                       | **D: fallback**                    |

   `$B` is then fixed in the run log: `G:\pdabliss-core-staging-backups`, or `D:\pdabliss-core-staging-backups` with the
   limitation in architecture §7 recorded.
5. Window: avoid 00:30 / 06:30 / 12:30 / 18:30 (PDA ONE backup), :05 (PDA ONE billing), and 02:00 / Sunday 03:30 (S2 NAS
   backup / restore rehearsal). Measured load ≈ 1–3 % CPU.

## 4. Activation steps

### G0 — Quality gates on the host, isolated, SCRAM-authenticated ✋ C1

**Isolation design:**

| Aspect             | Temporary test PostgreSQL                                                       | Production cluster (`postgresql-x64-18`)         |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| Data directory     | `D:\pdabliss-core-staging\gates\pg` (new, empty)                                | `C:\Program Files\PostgreSQL\18\data`            |
| Port / address     | 55443 on 127.0.0.1 only                                                         | 5432                                             |
| Process            | plain `pg_ctl start` under the operator's account; no service; stopped at the end | Windows service                                  |
| Authentication     | **SCRAM-SHA-256**, superuser `gate` with a random 32-byte password held in session memory | unchanged                                        |
| Databases          | `pdabliss_core_test`, scratch migration databases — all on 55443                | **never connected to by G0**                     |
| Binaries           | the shared 18.6 `bin` (read-only)                                               | same binaries, untouched                         |

```powershell
$G = 'D:\pdabliss-core-staging\gates'
New-Item -ItemType Directory -Force $G | Out-Null
git clone --no-local $DEV "$G\src"; git -C "$G\src" checkout --detach <release-sha>
$gatePw = New-Secret 32                                                     # in memory only
$pwFile = "$G\initdb.pw"; [IO.File]::WriteAllText($pwFile, $gatePw)        # needed by initdb, deleted right after
icacls $pwFile /inheritance:r /grant:r "${env:USERNAME}:R" | Out-Null
& "$PG\initdb.exe" -D "$G\pg" -U gate --pwfile=$pwFile -A scram-sha-256 -E UTF8 --locale="English_United States.1252"
Remove-Item $pwFile
& "$PG\pg_ctl.exe" -D "$G\pg" -o "-p 55443 -c listen_addresses=127.0.0.1" -l "$G\pg.log" start   # not a service
$env:PGPASSWORD = $gatePw                                                   # session only; never written, never printed
$env:TEST_DATABASE_URL = "postgresql://gate:$([uri]::EscapeDataString($gatePw))@127.0.0.1:55443/pdabliss_core_test"
```

**Isolation guards** (each must pass before the step it protects; any failure → stop, R0):

| Guard | Check                                                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1    | `pg_hba.conf` in `$G\pg` has no `trust` line; port 55443 listens on 127.0.0.1 only                                                                                                                                                                             |
| I2    | `TEST_DATABASE_URL` host = `127.0.0.1`, port = `55443`, database exactly `pdabliss_core_test`. Reason: the test setup runs `DROP SCHEMA public CASCADE` on any `*_test` database it is pointed at, and the production cluster holds **`pda_one_test`**. |
| I3    | Server identity through that URL: `inet_server_port() = 55443` and `current_setting('data_directory')` = `$G\pg`                                                                                                                                                  |
| I4    | No `.env`, `.env.test` or `.env.*` anywhere in `$G\src` (the test setup would load `.env.test` over the session)                                                                                                                                                |
| I5    | The production postmaster PID 5764 and its start time, and the production database list, are unchanged after G0 (collector after G0)                                                                                                                             |

**Gates.** The database suites run **only through `ops\ep48_5\g0-guard.mjs`**:

- it checks I2 (URL) before any connection, then I4, then I1 / I3 by asking the server itself;
- then it runs the suite and enforces exact counts with **zero skipped**.

There is no way in this plan to start the backend or ops suites without the guard.

```powershell
$S = "$G\src"
# backend: npm ci; db:validate; typecheck; lint; format:check; build — then the guarded suite:
node "$S\ops\ep48_5\g0-guard.mjs" backend-tests  --gates $G --src $S --expect 611
# frontend: npm ci; typecheck; lint; format:check; npm run build (prerender + budgets) — then:
node "$S\ops\ep48_5\g0-guard.mjs" frontend-tests --gates $G --src $S --expect 1192
# ops: EP43 suite (21) + EP48.5 launcher / guard tests (48, including T10 on the live temporary instance) = 69
node "$S\ops\ep48_5\g0-guard.mjs" ops-tests      --gates $G --src $S --expect 69
# migration scratch on 55443 (after `g0-guard.mjs check`): roles via ops/roles.mjs, migrate deploy as core_owner → 28/28,
# ownershipAudit 0, forbiddenAttempts 17/17
# I5 after G0 — the elevated collector again, then:
node "$S\ops\ep48_5\g0-guard.mjs" compare --before <C0 host-audit.json> --after <post-G0 host-audit.json>
```

Pass (**zero skipped tests anywhere** — a missing database URL makes suites skip silently):

| Check                  | Target                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| Backend                | 611 / 611, 0 skipped                                                      |
| Frontend               | 1,192 / 1,192, 0 skipped                                                  |
| Ops                    | **69 / 69** (EP43 21 + EP48.5 48 incl. T10), 0 skipped                    |
| Static checks          | typecheck, lint and format clean                                          |
| Budgets                | ≤ 4,300 KiB, ≤ 205 KiB, ≤ 560 KiB                                         |
| Migrations             | 28 / 28                                                                   |
| Roles                  | 0 / 17 / 17                                                               |
| Isolation              | I1–I5                                                                     |

Workers are capped at 2.

**Cleanup = A-8a** (automatic, only for verified disposable artefacts):

1. Copy the test summaries (counts, durations) to `D:\pdabliss-core-staging\logs\g0\`.
2. `pg_ctl -D "$G\pg" stop -m fast`.
3. Verify the cluster is gone:
   - `pg_ctl status` reports no server;
   - 55443 is not listening;
   - no `postgres.exe` command line references `$G`.
4. `Remove-Item Env:PGPASSWORD, Env:TEST_DATABASE_URL`; clear `$gatePw`.
5. Delete `$G` **only** if its resolved path is exactly `D:\pdabliss-core-staging\gates` and contains no reparse point.
6. Log the file count and bytes removed.

If any precondition fails, nothing is deleted and the run stops for the owner.

### B1 — Folders and ACLs

```powershell
'releases','config','mail','pgdata','logs\postgres','logs\ops','run','tools\winsw' | % { New-Item -ItemType Directory -Force "$R\$_" | Out-Null }
New-Item -ItemType Directory -Force $B | Out-Null                       # $B as fixed at C0: G:\pdabliss-core-staging-backups (outside G:\S2_NAS_DATA) or the D: fallback
icacls $B /inheritance:r /grant:r "BUILTIN\Administrators:(OI)(CI)F" "SYSTEM:(OI)(CI)F" "NT AUTHORITY\NetworkService:(OI)(CI)M"   # G: root is not treated as private
icacls "$R\config" /inheritance:r /grant:r "BUILTIN\Administrators:(OI)(CI)F" "SYSTEM:(OI)(CI)F"
icacls "$R\mail"   /inheritance:r /grant:r "BUILTIN\Administrators:(OI)(CI)F" "SYSTEM:(OI)(CI)F"
icacls "$R\pgdata" /grant "NT AUTHORITY\NetworkService:(OI)(CI)M"; icacls "$R\logs\postgres" /grant "NT AUTHORITY\NetworkService:(OI)(CI)M"
```

### B2 — Release build

```powershell
git clone --no-local $DEV "$R\releases\<release-sha>"; git -C "$R\releases\<release-sha>" checkout --detach <release-sha>
# verify: rev-parse HEAD = <release-sha>; status --porcelain empty; `git diff --stat $SHA <release-sha> -- backend frontend` EMPTY
cd "$R\releases\<release-sha>\backend";  npm ci; npm run build
cd "$R\releases\<release-sha>\frontend"; npm ci
$env:VITE_API_URL='http://127.0.0.1:1312'; $env:VITE_SITE_URL='http://127.0.0.1:1311'; npm run build; Remove-Item Env:VITE_API_URL, Env:VITE_SITE_URL
Set-Content "$R\releases\<release-sha>\RELEASE_SHA" '<release-sha>'; cmd /c mklink /J "$R\current" "$R\releases\<release-sha>"
```

Check: no `.env` anywhere in the release; budgets pass.

### B3 — Dedicated staging cluster

1. `& "$PG\initdb.exe" -D "$R\pgdata" -U core_staging_admin --pwprompt -A scram-sha-256 -E UTF8 --locale-provider=libc --locale="English_United States.1252" --data-checksums`
   - The admin password is typed at the prompt and stored only in the owner's password manager.
2. Append a marked block to `postgresql.conf`:

   ```
   port = 5433
   listen_addresses = '127.0.0.1'
   max_connections = 60
   shared_buffers = 256MB
   password_encryption = scram-sha-256
   logging_collector = on
   log_directory = 'D:/pdabliss-core-staging/logs/postgres'
   log_rotation_size = 10MB
   log_rotation_age = 1d
   ```

3. `pg_hba.conf` keeps only `host all all 127.0.0.1/32 scram-sha-256`. Delete the `::1`, `local` and `replication` lines.
4. Register and start (administrator):

   ```powershell
   & "$PG\pg_ctl.exe" register -N pdabliss-core-staging-pg -U "NT AUTHORITY\NetworkService" -D "$R\pgdata" -S auto -w
   sc.exe config pdabliss-core-staging-pg start= delayed-auto
   Start-Service pdabliss-core-staging-pg
   ```

5. **G1:**
   - 5433 listening on 127.0.0.1 only;
   - `SHOW data_checksums` on; collation as specified;
   - `postgresql-x64-18` postmaster PID 5764 unchanged, its start time unchanged.

### B4 — Secrets, roles, database, migrations, seed

1. **Env files** in `$R\config`, written directly from `New-Secret` (UTF-8, no BOM, never echoed):

   | File               | Holds                                                                                                                                                                                         | Readable by                                |
   | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
   | `core-staging.env` | the locked staging profile: `CORE_ENVIRONMENT=staging`, `NODE_ENV=development`, `ENABLE_DEMO_ROUTES=false`, `HOST=127.0.0.1`, `PORT=1312`, `CORS_ORIGINS` / `PUBLIC_APP_URL=http://127.0.0.1:1311`, `AUTH_SECRET`, `DATABASE_URL` (`core_app` @ 127.0.0.1:5433/`pdabliss_core_staging`), `MAIL_TRANSPORT=dev`, `DEV_MAIL_DIR=D:\pdabliss-core-staging\mail`, `LOG_LEVEL=info` | `NT SERVICE\core-staging-api`              |
   | `core-owner.env`   | `core_owner` URL                                                                                                                                                                              | Administrators                             |
   | `seed.env`         | `NODE_ENV=development`, `core_owner` URL, Platform Owner / Admin addresses (OD-7) and initial passwords, 9 × `DEMO_*_PASSWORD`                                                                 | Administrators                             |
   | `core-backup.env`  | `CORE_BACKUP_DATABASE_URL` (`core_backup`)                                                                                                                                                    | NetworkService (tasks)                     |
   | `core-verify.env`  | `CORE_VERIFY_DATABASE_URL` (`core_verify` → database `postgres` on 5433)                                                                                                                      | NetworkService (tasks)                     |

   Persona passwords reach the owner through the password manager only.

2. **Roles + database**, as `core_staging_admin` (URL in memory):
   - `createRoles` / `createDatabase('pdabliss_core_staging')` from `ops/roles.mjs`. Port 5433 is not the guarded 5432.
   - Then `core_verify` (`LOGIN CREATEDB NOSUPERUSER NOCREATEROLE CONNECTION LIMIT 3`), password via `quote_literal`.
3. **Migrations:** `$R\current\backend`: `npx prisma migrate deploy` as `core_owner` → **28 / 28**; `migrate status` up to date.
4. **Grants and checks:** `grantRuntime` → `ownershipAudit` **0** → `forbiddenAttempts(core_app)` **17 / 17** (**G2**,
   **G3**).
5. **Seed:** `& $NODE --env-file="$R\config\seed.env" node_modules\tsx\dist\cli.mjs src\cli\seed.ts --demo` → outcomes only.
6. **G4:**
   - `uat\integrity.sql` as `core_app` → 0 on every check;
   - persona and fixture counts recorded.
7. **Reset point:** after B6's config exists, `backup --profile staging --verify` → **VERIFIED**; keep the file.

**✋ C2.**

### B5 — Application services (WinSW v2.12.0 x64; SHA-256 checked against its GitHub release)

| Setting           | `core-staging-api`                                                                                       | `core-staging-web`                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| executable        | `C:\Program Files\nodejs\node.exe`                                                                       | same                                                                                  |
| arguments         | `--env-file=D:\pdabliss-core-staging\config\core-staging.env --max-old-space-size=512 ops\ep48_5\staging-launch.mjs` | `ops\ep48_5\staging-web-launch.mjs` (binds the constant 127.0.0.1:1311 itself) |
| working directory | `D:\pdabliss-core-staging\current` (the launcher calls `buildApp` from `backend\dist\app.js`)            | `D:\pdabliss-core-staging\current`                                                     |
| depends on        | `pdabliss-core-staging-pg`                                                                               | —                                                                                     |
| start / recovery  | Automatic (delayed); restart after 10 s, then 30 s, **then no further restart** (no loop around a refusal); reset after 1 h | same                                                                                  |
| logs              | `D:\pdabliss-core-staging\logs`, roll-by-size 10 MB × 8                                                   | same                                                                                  |
| account           | `NT SERVICE\core-staging-api` (`sc.exe config … obj=`)                                                   | `NT SERVICE\core-staging-web`                                                          |

Grants:

- both virtual accounts: read on `$R\releases`; modify on `$R\logs` and `$R\run` (refusal markers);
- the web service's WinSW XML sets `<env name="CORE_ENVIRONMENT" value="staging"/>` (W0) and nothing else;
- api only: read on `core-staging.env`; modify on `$R\mail`.

**G5:**

- launcher banner logged, no refusal;
- `GET :1312/health` 200; `/health/ready` 200 with `database: ok, schema: ok`;
- `GET :1311/login` 200;
- `Get-NetTCPConnection` shows 1311 / 1312 on **127.0.0.1 only**;
- **launcher refusal drill (T11):**
  1. Set `ENABLE_DEMO_ROUTES=true` in the env → the service is refused with exit 78, `run\launcher-refused.json` is
     written, and WinSW stops after its two restarts.
  2. Restore the value: the start is **still refused** while the marker exists (sticky).
  3. An administrator deletes the marker → the service starts.
- **exposure check (T11):**
  - `Test-NetConnection <each LAN IPv4 / IPv6 address of the host> -Port 1311 / 1312 / 5433` → **all fail**;
  - optional: the owner repeats it from a second LAN device;
  - both launchers' logs show "exposure probe: clean".

### B6 — Backups and monitoring

1. `$R\config\ops.staging.json`:
   - `pgBin` = `$PG`;
   - one profile `staging` (`kind: staging`, `core-backup.env`, database `pdabliss_core_staging`, `backupDir` = `$B`);
   - `verify` → `core-verify.env`;
   - `retention.allowDirs` = [`$B`];
   - storage volumes `$R\pgdata`, `$B`, `$R\logs`;
   - health frontend `http://127.0.0.1:1311/login`, backend `http://127.0.0.1:1312`, backup max age 26 h / 50 h;
   - alerts off.
2. Run by hand (`CORE_OPS_CONFIG` set):
   - `backup --profile staging --verify` → VERIFIED;
   - `health --once` ok;
   - `status`;
   - `retention --profile staging` (dry run) lists only `$B`.
3. Register the tasks as `NT AUTHORITY\NetworkService`:
   - `Backup` daily 03:20;
   - `Health` every 5 min starting 00:02;
   - `Retention` daily 03:40, **created disabled**.

   Each action is `cmd.exe /c "set CORE_OPS_CONFIG=D:\pdabliss-core-staging\config\ops.staging.json&& D:\pdabliss-core-staging\current\ops\core-ops.cmd <command>"`.
4. Run each task once with `Start-ScheduledTask` → last result 0.

**✋ C3.**

## 5. Validation gates

| Gate | Check                                                                                                                                                       | Pass                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| G0   | quality gates (§4)                                                                                                                                          | all green                  |
| G1   | staging cluster loopback-only, scram-only, checksums, collation; shared postmaster PID 5764 / start time unchanged                                         | yes                        |
| G2   | ownership 0; forbidden 17 / 17; `core_app` not superuser                                                                                                    | yes                        |
| G3   | 28 / 28; readiness `schema: ok`                                                                                                                             | yes                        |
| G4   | seed + `integrity.sql` 0                                                                                                                                    | yes                        |
| G5   | services up; 127.0.0.1 binds (post-bind proof in both launcher logs); refusal drill incl. sticky marker; LAN-address probes on 1311 / 1312 / 5433 all fail | yes                        |
| G6   | smoke tests S1–S20 (below)                                                                                                                                  | all PASS                   |
| G7   | backup VERIFIED; restore row counts = source; a truncated copy → FAILED                                                                                     | yes                        |
| G8   | `Stop-Service core-staging-api` → health records the outage → start → recovery recorded; storage warning with a test config (`observePct: 1`), no disk filled | yes                        |
| G9   | no secret value (env files, read in memory) and no `user:password@` in `$R\logs`                                                                            | 0 hits                     |
| G10  | retention touches only `$B` (a planted outside file is never listed)                                                                                        | yes                        |
| G11  | "after" collector vs C0 (§6)                                                                                                                                | no adverse change          |

**G6 smoke tests.** Browser on the server plus scripted HTTP calls as each persona. Destructive steps run only on
documents created in the run, with references prefixed `STG-SMOKE-`; the B4 reset point can restore everything.

| #   | Area                                           | Expected                                                                                     |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| S1  | frontend, liveness, readiness                  | 200 / 200 / `schema: ok`                                                                      |
| S2  | `core_app` restrictions                        | G2                                                                                            |
| S3  | sign-in, all 9 personas (password + code from `$R\mail`, read by an administrator) | sessions issued                                          |
| S4  | company / branch context                       | warehouse persona limited to `00001`; another branch → 404                                    |
| S5–S9 | Sales, Purchasing, Warehouse (no money), Production (BOM_REQUIRED **and** BOM_OPTIONAL, owner restores the mode), Accounting dashboards | render, own department only |
| S10 | Executive Command Center                       | owner full; executive read-only, writes 403                                                   |
| S11 | independent approval (EP41)                    | a requester cannot approve their own document                                                 |
| S12 | branch isolation                               | `00000` documents invisible to `00001`-only staff                                             |
| S13 | department isolation (EP45)                    | sales → purchasing → 403                                                                      |
| S14 | recipe confidentiality (EP46)                  | warehouse / executive see no BOM detail                                                       |
| S15 | warehouse financial privacy                    | no price / amount fields                                                                      |
| S16 | System Admin                                   | no CORE workspace; Executive Command Center 403                                               |
| S17 | inventory ledger                               | `integrity.sql` 0 after the workflows                                                         |
| S18 | cross-department handoffs                      | `STG-SMOKE-` documents change stage and appear in the Executive queue                          |
| S19 | locked profile                                 | `/api/v1/demo/personas` 404; demo bypass refused; `/health` answers only on 127.0.0.1          |
| S20 | development activation route                   | company users 403 / 404; reachable only by staging platform accounts with step-up              |

## 6. Expected impact, regression measurement, stop triggers

| Resource   | Expected                                                                                     | Measured                                                                      |
| ---------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| CPU        | `npm ci` / build / tests: minutes of high CPU (2 workers) inside the window; steady ≈ idle   | collector samples                                                             |
| RAM        | api ≤ 512 MB heap (≈ 150–300 MB); web ≈ 100 MB; staging PostgreSQL ≈ 150–400 MB → **< 1 GB** | working sets                                                                  |
| Disk       | release 1–2 GB on D:; pgdata < 100 MB; backups < 1 MB each on G:; logs capped                  | free space before / after                                                     |
| PostgreSQL | **0** connections added to the shared cluster                                                 | shared `pg_stat_activity` before / after                                      |
| Network    | +3 loopback listeners                                                                        | listener diff                                                                 |
| Production | unchanged                                                                                    | same daemon PID 2228, same 22 child PIDs and start times, same HTTP status per port (200 / 404 as baseline), latency ≤ baseline + 50 % or + 50 ms |

**Stop triggers:**

- any production child PID or start time changes, or a port changes status;
- shared postmaster PID 5764 changes;
- CPU sustained above 80 %, or free RAM below 8 GB, attributable to staging;
- a volume crosses its warning threshold;
- any launcher refusal outside the drill.

## 7. Administrator actions (all in Stage B, after approval)

1. `pg_ctl register` / start `pdabliss-core-staging-pg`.
2. WinSW `install`, `sc.exe config … obj=`, start both app services.
3. `icacls` on `config`, `mail`, `pgdata`, `logs`, and the env files.
4. `Register-ScheduledTask` as NetworkService.
5. Creating `D:\pdabliss-core-staging` and `G:\pdabliss-core-staging-backups`.
6. Deleting `D:\pdabliss-core-staging\gates` after G0 under **A-8a**. Any other deletion needs its own **A-8b** authorization.

**Not needed:** the firewall, Cloudflare, DNS, PM2, the shared PostgreSQL superuser, MariaDB, or a reboot.

## 8. Risk register

| #   | Risk                                                                                       | Likelihood | Impact | Mitigation                                                                                                     |
| --- | ------------------------------------------------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| K1  | Build / test CPU burst slows production apps                                               | medium     | low    | window choice; `--maxWorkers=2`; latency watched; stop trigger                                                 |
| K2  | A staging listener binds to all interfaces (the firewall is off)                           | low        | high   | launcher L3; `vite --host 127.0.0.1 --strictPort`; `listen_addresses = 127.0.0.1`; verified in G5 / G1          |
| K3  | Development-mode behaviour leaks (bypass, secret fallback)                                 | low        | high   | locked profile + fail-closed launcher + refusal drill + S19                                                    |
| K4  | Touching production PM2 by mistake                                                         | low        | high   | no `pm2` command anywhere in the plan; regression via the process tree only                                    |
| K5  | The staging cluster interferes with the shared one (port, binaries, service)               | low        | high   | separate port, data dir and service; shared PID check; same binaries used read-only                            |
| K6  | Backups land in, or are exposed through, the S2 NAS store                                  | low        | medium | separate top-level folder outside `G:\S2_NAS_DATA`; OD-6 confirms the NAS root                                 |
| K7  | Sign-in codes / secrets readable by other accounts                                         | low        | medium | ACLs on `config` / `mail`; G9                                                                                  |
| K8  | WinSW binary integrity                                                                     | low        | high   | official release, SHA-256 compared; stored under `$R\tools`                                                    |
| K9  | Reboot recovery unverified                                                                 | medium     | low    | services automatic (delayed) with dependencies; drill scheduled separately                                     |
| K10 | No alert delivery                                                                          | high       | low    | daily `ops status` by the owner during UAT; SMTP before any pilot                                              |
| K11 | Future PostgreSQL 18 minor upgrade (shared binaries)                                       | medium     | low    | handoff procedure: stop staging first, verify both clusters after                                              |
| K12 | The test setup resets a `*_test` database on the wrong server (the production cluster holds `pda_one_test`)                 | low        | high   | G0 guards I2–I4 (exact host, port and database; server identity; no `.env.test`); session-only URL               |
| K13 | The G: root is readable by any local account or service; SMB exposure                                                        | medium     | medium | own ACL on `$B` (inheritance removed); C0 SMB-share check; D: fallback rule                                      |
| K14 | A cleanup step deletes more than disposable test artefacts                                                                   | low        | high   | A-8a limited to the exact `gates` path, after stop / port / process checks, no reparse points; everything else needs A-8b |
