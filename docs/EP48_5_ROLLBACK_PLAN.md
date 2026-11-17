# EP48.5 — CORE Internal Staging: Rollback Plan

**Principle:** CORE staging creates only its own objects:

- three Windows services (`pdabliss-core-staging-pg`, `core-staging-api`, `core-staging-web`);
- three tasks in `\PDA BLISS CORE Staging\`;
- `D:\pdabliss-core-staging` and the backup folder `$B`;
- one PostgreSQL cluster inside `D:\pdabliss-core-staging\pgdata`;
- during G0 only, a temporary test cluster in `D:\pdabliss-core-staging\gates` (127.0.0.1:55443).

It changes **no** shared object:

- PM2 daemons, `dump.pm2` or `PM2_HOME`;
- `postgresql-x64-18`, MariaDB, Cloudflare services, firewall, Run keys or existing tasks;
- any production app.

Rollback therefore only stops or removes CORE staging objects; nothing of another application is ever restored.

Placeholders: `$R` = `D:\pdabliss-core-staging`, `$B` = the backup folder fixed at C0 (`G:\pdabliss-core-staging-backups` or the D: fallback `D:\pdabliss-core-staging-backups`),
`$PG` = `C:\Program Files\PostgreSQL\18\bin`. **No step runs `pm2`.**

## 1. Triggers

| Trigger                                                                                                   | Action                                   |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| A production child PID / start time changes, a production port changes HTTP status, or latency regresses beyond the limit | **R1 immediately**; assess; R4 if staging is implicated |
| Shared postmaster PID 5764 changes                                                                        | R1; R4 if implicated                     |
| CPU > 80 % sustained or free RAM < 8 GB attributable to staging; a volume warning                         | R1                                       |
| Launcher refusal outside the drill; a staging listener seen on anything but 127.0.0.1                    | R1 (if exposed, stop first, then diagnose) |
| A staging-only defect (gate or smoke failure)                                                             | R2 / R3 or R1                            |
| The owner withdraws approval                                                                              | R4                                       |

## 2. Rollback per checkpoint

| Stopped at / after | State                                                     | Rollback                                                                                                  |
| ------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| C-A0               | local commit only                                         | none on the host; the commit can be left unpushed or reverted locally                                     |
| C0                 | nothing changed                                           | none                                                                                                      |
| C1 (G0)            | `D:\pdabliss-core-staging\gates` + a temporary cluster process on :55443 | stop it (`pg_ctl … stop -m fast`), verify stopped, then delete the folder under **A-8a**               |
| C2 (B1–B4)         | folders, release, staging cluster service, database        | R1 → R4 (no app services exist yet)                                                                       |
| C3 (B5–B6)         | + app services + tasks                                    | R1 (pause) or R4 (remove)                                                                                 |
| C4                 | complete                                                  | R1 / R2 / R3 / R4 as needed                                                                               |

## 3. Deletion authority (A-8a / A-8b)

| Kind                                                    | Authority                                                                                                                       | Scope                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A-8a — automatic cleanup of verified disposable test artefacts** | signed once in advance; runs without asking again, but only when every precondition holds | (1) `D:\pdabliss-core-staging\gates` after G0 — only once the temporary cluster is stopped, 55443 is free, no process references the folder, summaries are copied out, and the resolved path has no reparse point. (2) The `core_restorecheck_*` scratch databases that the ops `verify` step creates and drops **on the staging cluster** (name-checked by the tool's `SCRATCH` pattern). Nothing else. |
| **A-8b — explicit destructive authorization**           | **never pre-approved.** A separate written owner approval **each time**, naming the exact target and the reason             | deleting a staging release folder · `DROP DATABASE pdabliss_core_staging` (R3) · unregistering the staging cluster or deleting `pgdata` (R4) · deleting any staging backup file or the backup folder · secure-deleting `config` / `mail` (R4) · enabling `retention --apply` (also OD-9) |

A precondition that fails under A-8a turns into "do nothing, report". It never escalates into a wider deletion.

## 4. Levels

### R1 — Stop (seconds, fully reversible)

```powershell
Get-ScheduledTask -TaskPath '\PDA BLISS CORE Staging\' -ErrorAction SilentlyContinue | Disable-ScheduledTask
Stop-Service core-staging-web, core-staging-api -ErrorAction SilentlyContinue
Stop-Service pdabliss-core-staging-pg -ErrorAction SilentlyContinue
```

Verify:

- 1311 / 1312 / 5433 not listening;
- the collector shows the production tree, postmaster 5764 and the HTTP baseline as at C0.

Undo: start the services (pg first) and enable the tasks.

### R2 — Previous release

1. Stop the web and api services.
2. Repoint the junction: `cmd /c rmdir "$R\current"`, then `cmd /c mklink /J "$R\current" "$R\releases\<previous>"`.
   `rmdir` removes the link only.
3. Start both services.
4. The launcher's L10 and `/health/ready` (`schema: ok`) must pass.

If the newer release added a migration, do R3 first: Prisma migrations are not reversible, and `_prisma_migrations` is
never edited. (EP48.5 has no previous release; R2 applies to later staging updates.)

### R3 — Staging database back to the reset point (demo data only) — **needs A-8b**

1. Stop the api.
2. As `core_staging_admin`: `DROP DATABASE pdabliss_core_staging WITH (FORCE)`, then `createDatabase`.
3. `pg_restore --no-owner --role=core_owner` of the B4 reset-point backup.
4. `grantRuntime` → `ownershipAudit` 0 → `integrity.sql` 0.
5. Start the api.

Alternative: drop, then repeat B4 steps 2–6.

### R4 — Full removal (the host returns to its C0 state) — **needs A-8b** for steps 4–5

1. R1.
2. Remove the tasks, then delete the empty `\PDA BLISS CORE Staging\` folder:
   `Get-ScheduledTask -TaskPath '\PDA BLISS CORE Staging\' | Unregister-ScheduledTask -Confirm:$false`.
3. Remove the services:
   - `$R\tools\winsw\core-staging-web.exe uninstall`;
   - `$R\tools\winsw\core-staging-api.exe uninstall`;
   - `& "$PG\pg_ctl.exe" unregister -N pdabliss-core-staging-pg`.
4. **Archive first** (owner's choice):
   - copy `$R\logs` and the newest VERIFIED backup to an archive folder outside OneDrive;
   - **securely delete** `$R\config` and `$R\mail` (secrets, sign-in codes); never archive them.
5. Delete `$R` and `$B` — only with the **A-8b** authorization naming both paths.
6. Verify with the elevated collector against C0. Identical:
   - listeners;
   - services, tasks and Run keys;
   - production PM2 tree (PIDs and start times);
   - shared PostgreSQL PID, databases and roles;
   - firewall profiles.

## 5. What rollback never does

- Never runs `pm2`, never touches `%USERPROFILE%\.pm2`, never ends a PM2 daemon, the idle ones included (audit §4.3).
- Never touches `postgresql-x64-18`. Staging has no object there; anything named `core_*` / `pdabliss_core*` found there
  later is not EP48.5's and is left alone.
- Never deletes outside `$R`, `$B` and the task folder.
- Never touches `G:\S2_NAS_DATA` or any existing backup folder.
- Never reboots.

## 6. Feasibility

| Level | Time      | Administrator | Data loss                                     | Rehearsed in Stage B                  |
| ----- | --------- | ------------- | --------------------------------------------- | ------------------------------------- |
| R1    | < 1 min   | yes           | none                                          | yes (G8 outage drill, api service)    |
| R2    | < 5 min   | yes           | none (unless migrations → R3)                 | no (no previous release yet)          |
| R3    | < 10 min  | yes           | staging changes since the reset point         | yes (G7 restore into scratch)         |
| R4    | ≈ 15 min  | yes           | the staging environment (by design)           | checked against the created-object inventory in `EP48_5_OPERATIONS_HANDOFF.md` (Stage B) |
