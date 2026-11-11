# PDA BLISS CORE — Operations Handbook

For a developer or system administrator taking over CORE. Written in EP43 (2026-11-11). Every capability is marked:

| Mark            | Meaning                                           |
| --------------- | ------------------------------------------------- |
| **✅ VERIFIED** | implemented and tested                            |
| **⏸ INACTIVE**  | implemented but not activated                     |
| **📝 PROPOSED** | design only                                       |
| **⛔ BLOCKED**  | needs an owner / administrator decision (see §11) |

Detail: `docs/EP43_INFRASTRUCTURE_AUDIT.md`, `EP43_BACKUP_RECOVERY_DESIGN.md`, `EP43_DISASTER_RECOVERY_RUNBOOK.md`,
`EP43_DATABASE_ROLE_POLICY.md`, `EP43_MONITORING_DESIGN.md`.

## 1. Architecture

```
Browser ──HTTPS──▶ [edge / Cloudflare tunnel — not part of CORE] ──▶ frontend (static files, React)
                                                               └──▶ backend API (Node 24, Fastify, Prisma 7)
                                                                        │ pg (PrismaPg adapter)
                                                                        ▼
                                                               PostgreSQL 18 (one database per environment)
```

- **frontend/** — a Vite build: `frontend/dist` holds static HTML, JS and CSS (108 prerendered public pages plus app
  shells). It calls the API at `VITE_API_URL` (fixed at build time).
- **backend/** — the API: `npm run build` → `dist/`, started with `node dist/server.js`. Configuration comes from
  environment variables (`backend/src/config/env.ts`).
- **PostgreSQL** — schema by Prisma migrations (`backend/prisma/migrations`, 26 as of EP43). The EP41 triggers make
  posted documents, `AuditLog` and `StockMovement` immutable.
- **ops/** — the operations CLI (backup, verify, restore, retention, storage, health).
- **uat/** — the EP42.2 UAT sandbox tool. It is for the owner's acceptance testing on a workstation, **not** for
  production.

## 2. Required services

| Service                                                           | Notes                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| PostgreSQL 18                                                     | loopback login only; data directory on SSD; checksums on                                  |
| Node.js 24 LTS line                                               | backend runtime and the ops tools                                                         |
| A static file host / reverse proxy for `frontend/dist` and `/api` | provides HTTPS. CORE's cookies are `Secure` in production, so HTTPS in front is mandatory |
| A process supervisor for the backend                              | 📝 PROPOSED — none exists yet (§6)                                                        |

## 3. Configuration (backend environment)

| Variable                         | Production rule                                                               |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `NODE_ENV`                       | must be `production`. If it is missing, demo routes are forced off            |
| `DATABASE_URL`                   | the **`core_app`** role (⛔ BLOCKED until roles exist, B2) — never `postgres` |
| `AUTH_SECRET`                    | ≥ 32 characters, random; the development value is refused                     |
| `PUBLIC_APP_URL`, `CORS_ORIGINS` | the real HTTPS origin(s) only                                                 |
| `SMTP_HOST` (+ credentials)      | required; the dev mail sink is refused in production                          |
| `ENABLE_DEMO_ROUTES`             | must stay off (it is off by default in production)                            |
| `LOG_LEVEL`                      | `info`                                                                        |
| `HOST`, `PORT`                   | bind to `127.0.0.1` behind the proxy, never to `0.0.0.0`                      |

Startup **fails closed** (✅ VERIFIED, `test/ep43-production-config.test.ts`): a missing `DATABASE_URL`,
`PUBLIC_APP_URL`, `AUTH_SECRET` or `SMTP_HOST`, or the development secret, stops the server with the variable named.

**⚠ Trust proxy.** `trustProxy` is off. Behind a tunnel or proxy every request then appears to come from the proxy:

- the rate limit becomes shared by all users;
- the IP address recorded in the audit log is the proxy's.

Before go-live, configure trust for the local proxy only (a small backend change, B6). Never trust all proxies.

Secrets live in an env file readable only by administrators and the service account — never in the repository
(`.env*` is git-ignored), never in OneDrive.

## 4. Start-up and shutdown

**Today (development / UAT only):**

- dev: `npm --prefix backend run dev` and `npm --prefix frontend run dev`;
- UAT: `uat\uat.cmd start | stop | status`.

**Production (📝 PROPOSED, B5).** The backend runs under a supervisor (a Windows service via WinSW/NSSM, or PM2 if it
is already the standard on the PDA server — the owner decides), with:

- start after PostgreSQL, restart on failure with back-off, and start after reboot;
- graceful stop: SIGTERM / Ctrl-C → Fastify `close()` → database disconnect;
- a working directory of the current release folder (§8);
- stdout logged with rotation.

The frontend is static files served by the existing web or tunnel layer — no Node process.

The ops monitor (`ops health`) may run as a second supervised process or a scheduled task every minute. It never
restarts anything itself.

## 5. Health checks (✅ VERIFIED)

| Check         | Command / URL       | Healthy                                                                          |
| ------------- | ------------------- | -------------------------------------------------------------------------------- |
| Backend alive | `GET /health`       | 200 `{"status":"ok"}`                                                            |
| Backend ready | `GET /health/ready` | 200 `{"status":"ready","checks":{"database":"ok","schema":"ok"}}`; 503 otherwise |
| Everything    | `ops health --once` | exit 0 (exit 3 if anything is critical); `ops status` shows the last result      |
| Disks         | `ops storage`       | exit 0 (3 = critical)                                                            |

## 6. Backup and restore

| Task                            | Command                                                                               | Status                          |
| ------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------- |
| Backup + verify                 | `ops backup --profile <p> --verify`                                                   | ✅ VERIFIED (dev, UAT)          |
| Verify an existing file         | `ops verify --profile <p> --file <dump>`                                              | ✅ VERIFIED                     |
| Restore into a scratch database | `ops restore --profile <p> --file <dump> --target core_restore_<x>`                   | ✅ VERIFIED                     |
| Retention                       | `ops retention --profile <p>` (dry run) / `--apply`                                   | ✅ VERIFIED (tests); ⏸ INACTIVE |
| Daily schedule                  | Task Scheduler: backup + verify 02:00; retention `--apply` 03:00; health every minute | 📝 PROPOSED / ⛔ B3             |
| Production backups              | profile `production` (`enabled: false`)                                               | ⏸ INACTIVE / ⛔ B3              |
| Off-machine copy                | encrypted external disk / NAS                                                         | 📝 PROPOSED / ⛔ B4             |
| Restore over a live database    | manual procedure, runbook §R                                                          | 📝 approval required            |

**Setting up:**

1. Copy `ops/ops.config.example.json` to `ops/ops.config.json`.
2. Set the backup folders: absolute, outside the repository, **not in OneDrive** — the tool refuses otherwise.
3. Name the env files that hold the connection strings. Use the `core_backup` role for production backups.

## 7. Safe update procedure

1. Announce a maintenance window.
2. `ops backup --profile production --verify` must print **VERIFIED**. No verified backup, no deploy.
3. Build the new release into a **new** folder (`releases/<version>`). Never overwrite the running one.
4. Stop the backend.
5. As `core_owner`: `npx prisma migrate deploy`.
6. Point the supervisor to the new folder and start it.
7. `/health/ready` must answer 200 with `schema: ok`. Then a smoke test: sign in as one user per role, open a sales
   order and a warehouse list, check the dashboard counts.
8. Keep the previous release folder for rollback.

## 8. Rollback

- **No migration in the release:** stop, point the supervisor back at the previous folder, start. Readiness returns 200.
- **The release migrated:** the old version reports `schema: ahead` and stays not ready on purpose. Either fix forward,
  or restore the pre-deploy backup (runbook §R) and start the old version.

Never edit `_prisma_migrations` by hand.

## 9. Monitoring and alerts

- Alerts are deduplicated: raise, escalate, recover. Local log only — ✅ VERIFIED.
- Email: ⏸ INACTIVE (needs SMTP wiring and approval). LINE: 📝 interface only.
- Thresholds (configurable): 70 % observe, 80 % / 20 GB warning, 90 % / 10 GB critical; backup older than 26 h is a
  warning, older than 50 h critical.

## 10. Common incidents

See `EP43_DISASTER_RECOVERY_RUNBOOK.md`, which covers twelve scenarios:

- backend crash; frontend down;
- database connection failure; PostgreSQL service down;
- disk full; corruption or data loss;
- power failure; failed update; failed migration;
- credential exposure; backup failure; TLS.

The first questions are always:

1. Is `/health` up?
2. Is `/health/ready` ready?
3. What does `ops storage` say?
4. When was the last verified backup?

## 11. Escalation and open decisions

Escalate to the **owner** for any data loss, restore, credential exposure or production change; to the
**infrastructure owner** for the tunnel, DNS, firewall, the Windows host and the PostgreSQL service.

| #   | Blocked pending approval                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------- |
| B1  | Identify and audit the production host (the audited machine is a workstation)                                         |
| B2  | Create `core_owner` / `core_app` / `core_backup` / `core_monitor` on the production cluster; move CORE off `postgres` |
| B3  | Activate the production backup profile and schedule backup / verify / retention / health                              |
| B4  | Off-machine encrypted backup target, plus a tested restore from it                                                    |
| B5  | Process supervisor choice and installation (service / PM2), log rotation                                              |
| B6  | Trust-proxy setting for the tunnel (code change) and the HTTPS edge                                                   |
| B7  | `listen_addresses = 'localhost'` (needs a PostgreSQL restart)                                                         |
| B8  | SMTP credentials and recipients for alerts                                                                            |
| B9  | WAL archiving / PITR (if an RPO under 24 h is required)                                                               |
| B10 | Removal of the 21 leftover scratch databases on the development machine                                               |
| B11 | Data-retention periods (accounting, PDPA)                                                                             |
