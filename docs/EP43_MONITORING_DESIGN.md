# EP43 — Monitoring, Alerts, Logging & Retention

## 1. Health model

| Signal              | Endpoint / check                               | Meaning                                                                                                                           | Exposes                                                                                                                                                        |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liveness            | `GET /health` (backend)                        | the process answers; does **not** touch the database                                                                              | service, version, environment, uptime                                                                                                                          |
| Readiness           | `GET /health/ready` (backend, **new in EP43**) | the database answered `SELECT … FROM _prisma_migrations` within 2 s **and** carries exactly the newest migration this build ships | statuses only: `database: ok / unavailable / not_configured`, `schema: ok / behind / ahead / unknown` — never a host, database or migration name or error text |
| Frontend            | `GET <frontendUrl>`                            | static site served                                                                                                                | —                                                                                                                                                              |
| Database (optional) | `SELECT 1` through `core_monitor`              | the server accepts logins                                                                                                         | —                                                                                                                                                              |
| Storage             | `ops storage`                                  | free space per volume                                                                                                             | —                                                                                                                                                              |
| Backup freshness    | the manifest of the newest **verified** backup | younger than 26 h is ok; 26–50 h warning; older critical                                                                          | —                                                                                                                                                              |

Readiness answers 200 when ready and 503 otherwise, with `cache-control: no-store`. Its result is reused for 5 s and
the route keeps the API rate limit, so public callers cannot turn it into database load. Liveness stays outside the
rate limit (unchanged).

**Verified (EP43):**

- A migrated database is ready.
- Unreachable, slow (> 2 s), behind, ahead, pending-migration and unconfigured databases are all `not_ready`, and an
  error message containing a host and password never leaks (`test/readiness.test.ts`).
- A production-configured app with an unresolvable database host reports `unavailable` without detail
  (`test/ep43-production-config.test.ts`).
- On the real stack, stopping PostgreSQL turned readiness to 503 while liveness stayed 200; restarting it brought
  readiness back to 200 without restarting the backend.

## 2. Monitor (`ops health`)

- **Checks:** frontend, backend-live, backend-ready, optional database, storage volumes, backup freshness per profile.
- **Timeouts and retries:** each check has a timeout (default 5 s) and retries (default 2, with a delay).
- **Severity:**
  - a dead check is **critical**;
  - alive-but-not-ready and a stale backup are **warnings**;
  - a check that cannot run is critical, never silently ok.
- **One instance only:** a lock file holds the PID. A second monitor refuses (`ALREADY_RUNNING`); a lock left by a
  dead process is taken over.
- **Intervals:** `health.intervalSeconds` (minimum 15, default 60). A cycle never overlaps the next.
- **Failure recovery:** an exception inside a cycle is logged and the loop continues.
- **Output:** a status file (`health.statusFile`, read by `ops status`) and the JSON-lines log.
- **Never restarts anything.** It reports; people or an approved supervisor act.

**Measured cost:** 0.56 s wall and 44 ms CPU per cycle, about 71 MB RSS, **0 database connections** (unless the
optional database check is configured: then 1 short connection per cycle).

## 3. Storage monitor (`ops storage`)

Volumes come from the config. Each is measured with `fs.statfs` (free bytes available to the user, total bytes) and
classified by **percentage and absolute free space**, both configurable. Defaults:

| Level    | Used % | or free below |
| -------- | ------ | ------------- |
| observe  | ≥ 70 % | —             |
| warning  | ≥ 80 % | 20 GB         |
| critical | ≥ 90 % | 10 GB         |

An alert carries:

- the volume, free GB, used %, the reasons and a timestamp;
- **diagnostics**: the largest files in the configured folders, listed read-only;
- advice that forbids deleting database files or WAL.

The command exits 3 when any volume is critical. A volume that cannot be measured is critical.

**Simulation (no disk was filled):** mocked statistics drove one volume through ok → 82 % (warning) → 83 % (no new
alert) → 94 % (critical, exit 3) → 94 % (no new alert) → normal (recovery alert). The unit tests also confirm that a
small disk at 50 % used with 8 GB free is critical, and that files in the watched folder are untouched.

## 4. Alerts

| Adapter                          | Status                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local log (JSON lines, redacted) | **implemented, active** whenever the monitor runs                                                                                                                              |
| Email                            | **interface implemented, not wired to SMTP, not activated**: it needs `alerts.email.enabled` plus a transport; without one it logs `NOT_CONFIGURED`. No email was sent in EP43 |
| LINE Bot                         | **interface only**: refuses with `NOT_CONFIGURED` until a later episode implements and authorizes it                                                                           |
| Windows Event Log                | proposed: writing a custom source needs one-time administrator registration                                                                                                    |

**Deduplication.** An alert is sent when a check _enters_ warning or critical (`raise`), when it gets worse
(`escalate`), and once when it returns to ok (`recover`). Nothing is sent while a level holds or improves without
recovering. The state is persisted, so a restart does not re-alert. A failing channel is logged, never fatal.
**No recurring external notification was created.**

## 5. Logging

| Log            | Content                                                                  | Redaction                                                                                                                                               | Rotation                                                                                                        |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Backend (pino) | request method, URL, host, remote address, status, response time; errors | `authorization`, `cookie`, `set-cookie` redacted; request bodies never logged; 500s answer "An unexpected error occurred" (the stack stays server-side) | **none in CORE** — stdout; the supervisor must rotate (proposal: the supervisor's log rotation, or `pino-roll`) |
| Ops tools      | JSON lines per command                                                   | every line passes `redact()` (URLs, `password=`, cookies, bearer tokens)                                                                                | built in: 5 MB × 5 files (configurable)                                                                         |
| UAT runner     | backend / frontend stdout                                                | as the backend                                                                                                                                          | none (append)                                                                                                   |
| PostgreSQL     | server log in `data/log`                                                 | —                                                                                                                                                       | rotated 10 MB / 1 day; **old files are not deleted**                                                            |
| Business audit | `AuditLog` table                                                         | no secrets by design (EP40 / EP41)                                                                                                                      | immutable (trigger + privilege) — never rotated                                                                 |

**Evidence:**

- The backend log of the full least-privilege regression contained no `core_sid` and no `password`.
- The ops logs and test logs contain no credentials (unit test with a credentialed URL).
- The production logger options keep the redact paths (`test/ep43-production-config.test.ts`).

**Gaps:**

- Query strings are logged (for example a search term such as a customer name). Acceptable internally; review before
  pilot.
- Backend log rotation must be provided by the production supervisor (B5).

**Access control:** the logs live under the service account's profile or `C:\ProgramData\pdabliss-core\logs`, with
administrators and the service account only. Never write them into the repository or OneDrive.

## 6. Data retention — decisions needed (nothing is deleted automatically)

| Data                                        | Today                                   | Question for the owner (legal / accounting advice)                                                                                                 |
| ------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sales and purchase documents                | kept forever                            | Thai accounting and tax records are commonly kept at least 5 years (Revenue Code / Accounting Act — confirm with the accountant); any upper limit? |
| Inventory movements (`StockMovement`)       | kept forever, immutable                 | the stock ledger is the basis of balances: keep for the company's life?                                                                            |
| Production documents                        | kept forever                            | same as above                                                                                                                                      |
| Audit history (`AuditLog`)                  | kept forever, immutable                 | minimum period; is archiving to cold storage allowed?                                                                                              |
| Sessions / sign-in history                  | sessions expire; rows remain            | delete expired sessions after N days? (PDPA data minimisation)                                                                                     |
| Personal data (users, customers, suppliers) | kept                                    | PDPA: retention purpose and period, the deletion-request process                                                                                   |
| Backups                                     | GFS 7 / 4 / 6 (proposed)                | longer monthly / yearly copies? off-site?                                                                                                          |
| Operational logs                            | ops 25 MB rolling; PostgreSQL unbounded | 30 / 90 days?                                                                                                                                      |
