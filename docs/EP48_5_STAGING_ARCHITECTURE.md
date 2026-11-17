# EP48.5 — CORE Internal Staging: Architecture

**Status:** design for owner approval; **nothing is built.** Host facts come from `EP48_5_SERVER_AUDIT.md` (elevated
collector run, 2026-11-17, S2A-SERVER).

## 1. Identity

| Attribute | Value                                                                                         |
| --------- | --------------------------------------------------------------------------------------------- |
| Name / id | **CORE Internal Staging** / `core-staging`                                                    |
| Purpose   | internal owner UAT on the real server, demo data only                                         |
| Not       | production, a pilot, public, LAN-reachable, or a copy of Dev / UAT                            |
| Code      | application code = **`cb21be1`**, built from a clean, detached clone                         |
| Data      | demo seed only: demo company, Head Office `00000`, Demo Branch `00001`, 9 personas             |

## 2. Picture

```
 Browser ON S2A-SERVER (console / RDP / AnyDesk session)
   │ http://127.0.0.1:1311                (no tunnel, no DNS, no firewall change, no LAN listener)
   ▼
 core-staging-web  (Windows service, WinSW)          core-staging-api  (Windows service, WinSW)
 node ops/ep48_5/staging-web-launch.mjs ─ CORS ─▶    node ops/ep48_5/staging-launch.mjs → buildApp (dist/app.js)
 vite preview() bound to constant 127.0.0.1:1311      bound to constant 127.0.0.1:1312 · locked profile (§4)
                                                               │ core_app (DML only)
                                                               ▼
                                     pdabliss-core-staging-pg (Windows service, pg_ctl)
                                     PostgreSQL 18.6 binaries · data D:\pdabliss-core-staging\pgdata
                                     127.0.0.1:5433 · pdabliss_core_staging · English_United States.1252
 Backups → G:\pdabliss-core-staging-backups (HDD; outside G:\S2_NAS_DATA)

 NOT TOUCHED: PM2 (SYSTEM daemon 2228 + idle user daemons), shared PostgreSQL :5432, MariaDB, Cloudflare tunnels,
 firewall, existing scheduled tasks, every production app in the audit's §4.2.
```

## 3. Reassessment of the two heavy decisions (with host evidence)

### D1 — A separate PostgreSQL instance: **justified (recommended)**

| Evidence                                                                                                                                                                                                                                                         | Weight |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| The shared cluster is a **production database server**: `pda_one_prod`, `pdabliss_property`, plus PDA ONE dev / test / shadow and `pdabliss_staging`.                                                                                                             | high   |
| Staging there needs cluster-wide objects (four fixed-name `core_*` roles, F-4), a `CREATEDB` login for restore checks (F-5), and a later production `pdabliss_core` would share those role names. | high   |
| A separate instance changes **nothing** on `postgresql-x64-18`: no role, `pg_hba`, setting or restart. Removal = stop the service and delete a folder.                                                                                                            | high   |
| Cost: one Windows service, ≈ 150–300 MB RAM (39.8 GB free), and data on D: (891 GB free). It uses the installed 18.6 binaries.                                                                                                                                   | low    |
| Coupling: a future PostgreSQL 18 minor upgrade replaces the shared binaries. The staging service must be stopped for it and checked afterwards (operations handoff).                                                                                             | noted  |

The alternative (database on the shared cluster) stays available if the owner prefers fewer services. It needs an
explicit approval of cluster-wide role creation on the production database server.

### D2 — Windows services instead of PM2: **justified (required)**

Host evidence (audit §4.1, §4.3):

- production PM2 is a **SYSTEM** daemon, started by a boot task on the **interactive account's `PM2_HOME`**;
- **three idle user-account daemons** share that home;
- every logon adds more.

Any CORE use of PM2 means one of:

- operating the production daemon as SYSTEM, with its `dump.pm2` rewritten by `pm2 save`; or
- adding to the user daemons, which the next logon resurrect duplicates — while they share production's files.

Neither is acceptable.

| Supervisor option                    | Restart on failure | Start after reboot   | Log rotation | Third-party | Verdict          |
| ------------------------------------ | ------------------ | -------------------- | ------------ | ----------- | ---------------- |
| **WinSW** v2.12 (MIT)                | yes                | Automatic (delayed), with dependencies | built in | one exe, SHA-256 checked | **recommended**  |
| NSSM                                 | yes                | yes                  | yes          | unmaintained since 2017 | not chosen       |
| Task Scheduler boot task             | no                 | yes                  | no           | none        | insufficient     |
| PM2 (either daemon)                  | yes                | via shared files     | module       | —           | **rejected** (above) |

Three services in total: `pdabliss-core-staging-pg` (registered by `pg_ctl register`, no third party), `core-staging-api`
and `core-staging-web`.

## 4. Runtime profile — a **locked staging profile**, not open development mode

CORE has two runtime modes and no staging mode (audit F-1). Production mode cannot run demo-only staging: it refuses the
demo seed and requires STARTTLS SMTP. Running plain development mode would leave its conveniences open. The design locks
development mode down with configuration, and with a fail-closed launcher that refuses to start the API unless every
lock holds.

### 4.1 What development mode changes, and how each item is handled

| Development-mode behaviour (code evidence)                                                                    | Staging handling                                                                                                                       | Residual                                                    |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Demo sign-in bypass, `/demo/personas`, mock routes (`ENABLE_DEMO_ROUTES` defaults **on**)                       | `ENABLE_DEMO_ROUTES=false`, enforced by the launcher; tested (G6-S19: `/api/v1/demo/personas` 404, bypass refused)                     | none                                                        |
| `AUTH_SECRET` **falls back to a public constant** when unset                                                   | launcher: present, ≥ 43 characters (32 random bytes), ≠ the development constant                                                       | none                                                        |
| Production env validation skipped                                                                              | the launcher applies its own (§4.2)                                                                                                    | none                                                        |
| Payment-free subscription activation route (`POST /platform/companies/:id/development-activation`; platform role + recent step-up) | Only the two staging platform accounts can reach it, and it acts on staging data. Tested: company users get 403 / 404. | **accepted**: staging-only accounts, demo data; useful for onboarding UAT |
| Cookies without `Secure` / `__Host-`                                                                           | Loopback HTTP only; the 127.0.0.1 bind is verified; no other site shares the origin                                                    | **accepted** on loopback; blocks any exposure (§4.4)        |
| `pino-pretty` log formatting                                                                                   | same redaction rules apply (authorization / cookie / set-cookie); logs stay under `<root>\logs`                                       | **accepted**: format only                                   |
| `/health` reports `environment: development`                                                                   | identity from the service names, database name, port and root folder; the launcher logs `CORE Internal Staging` at start              | **accepted**: label only                                    |
| Error handler                                                                                                  | identical in all modes (no stack traces to clients)                                                                                    | none                                                        |

### 4.2 Fail-closed launchers (specified here; written at A-0 and tested in G0 before any service exists)

There are two launchers, one per service, both in `ops/ep48_5/`:

- **`staging-launch.mjs`** (API). It imports only `backend/dist/config/env.js` and `backend/dist/app.js` (`parseEnv`,
  `buildApp`, `DEV_AUTH_SECRET`). It **never** imports `server.js`, because `server.js` binds to whatever `HOST` says.
- **`staging-web-launch.mjs`** (frontend). It uses Vite's `preview()` API.

The application code stays `cb21be1`.

#### Fail-closed properties

| #   | Property                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | **Checks before side effects.** All checks run before any listener opens or any application module is imported.                                                                                                                |
| P2  | **Every failure path ends in refusal.** Any failed check, thrown error, rejected promise or timeout ends in exit code **78**. `uncaughtException` / `unhandledRejection` handlers are installed first. Nothing degrades to "start anyway". |
| P3  | **The bind address is a constant in code.** API `127.0.0.1:1312`; web `127.0.0.1:1311`. It is never read from the environment: `HOST` / `PORT` must merely *equal* the constants. No configuration value can produce a non-loopback listener; changing that needs a code change and a new approval. |
| P4  | **Post-bind proof.** After `listen`, the bound address must be exactly `127.0.0.1` (IPv4) and the expected port. Otherwise: close and exit 78.                                                                                  |
| P5  | **Exposure self-probe.** For every non-internal interface address (`os.networkInterfaces()`), a TCP connect to that address on the service port (1 s timeout) **must fail**. Any successful connect: close and exit 78.         |
| P6  | **Allow-list, not deny-list.** Every CORE-known variable present must be in the staging allow-list with the expected value. Any other CORE variable present is a refusal: `TRUST_PROXY`, `SMTP_*`, `PLATFORM_*`, `DEMO_*`, `BOOTSTRAP_*`, `TEST_DATABASE_URL`, `VITE_*`. |
| P7  | **Sticky refusal.** A refusal writes `D:\pdabliss-core-staging\run\launcher-refused.json` (rule id and time — never a value). While that file exists, every start is refused immediately. An administrator deletes it after fixing the cause. Together with the WinSW policy (restart 10 s, restart 30 s, then **no further restart**), there is no restart loop. |
| P8  | **Messages name the rule, never the value.** Secrets, URLs and paths from the environment are never printed.                                                                                                                  |

#### API checks

| #   | Check                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | `CORE_ENVIRONMENT=staging`                                                                                                                                                                           |
| L2  | `NODE_ENV=development` and `ENABLE_DEMO_ROUTES=false`, both explicit and exact; any other spelling (`FALSE`, `0`, empty) is refused                                                                    |
| L3  | `HOST` = `127.0.0.1` and `PORT` = `1312`, exact — `localhost`, `0.0.0.0`, `::`, `::1`, `127.0.0.2` or surrounding whitespace are refused                                                              |
| L4  | `AUTH_SECRET` ≥ 43 characters, no whitespace, ≠ `DEV_AUTH_SECRET`                                                                                                                                     |
| L5  | `DATABASE_URL` = `postgresql://core_app:…@127.0.0.1:5433/pdabliss_core_staging` with **no query parameters** (a `?host=` parameter could redirect the connection)                                    |
| L6  | `CORS_ORIGINS` = `PUBLIC_APP_URL` = `http://127.0.0.1:1311` exactly; `TRUST_PROXY` absent                                                                                                            |
| L7  | `MAIL_TRANSPORT=dev`; `DEV_MAIL_DIR` = `D:\pdabliss-core-staging\mail` (resolved, not a reparse point); no `SMTP_*`                                                                                  |
| L8  | no `.env` or `.env.*` in the working directory or in `backend\`                                                                                                                                       |
| L9  | live database identity (2 s timeout; failure = refusal, never "continue"): `current_user = core_app`, `rolsuper = false`, `current_database() = pdabliss_core_staging`, `inet_server_port() = 5433`   |
| L10 | `RELEASE_SHA` file = `git rev-parse HEAD` of the release = the approved release commit                                                                                                                 |
| L11 | the parsed CORE env (`parseEnv`) succeeds and yields `ENABLE_DEMO_ROUTES === false` — the application's own reading agrees with the launcher                                                         |
| L12 | after bind: P4 + P5                                                                                                                                                                                  |
| L13 | *(added in A-0)* no debugger: `NODE_OPTIONS` absent, no `--inspect*` flag, no active inspector — a debugger port would be an extra network listener                                                   |
| L14 | *(added in A-0)* the launcher runs from `<staging root>\releases\<sha>` (real path), never from a development checkout                                                                                |

#### Web checks

| #   | Check                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | `RELEASE_SHA` as L10                                                                                                                                                                                                                   |
| W2  | the built `frontend\dist` contains the API origin `http://127.0.0.1:1312` and **no** other API origin (in particular not the development default `localhost:1112`)                                                                    |
| W3  | the build excludes the prototype and persona picker (production build) — checked by the absence of their chunk markers                                                                                                                |
| W4  | `preview()` called with the constants `{ host: '127.0.0.1', port: 1311, strictPort: true, open: false }`; then P4 + P5                                                                                                                 |
| W0  | *(added in A-0)* `CORE_ENVIRONMENT=staging` (set in the web service's WinSW `<env>`); no other CORE variable at all, `VITE_*` included                                                                                                 |
| W5  | *(added in A-0)* as L13 (no debugger) and L14 (release location)                                                                                                                                                                      |
| W6  | *(added in A-0)* no `.env` / `.env.*` (other than `.env.example`) in the release or `frontend\` — Vite would read them                                                                                                               |

#### Test matrix (A-0 writes it, G0 runs it; Stage B creates no service unless all pass)

| #   | Tests                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | One violating fixture per rule L1–L11 and W1–W3 → exit 78 with that rule id, **and a sentinel target module is never imported** (the stub writes a marker file on import; the test asserts the marker is absent).         |
| T2  | Bind variants: `0.0.0.0`, `::`, `::1`, `localhost`, `127.0.0.2`, `" 127.0.0.1"`, empty → refused                                                                                                                            |
| T3  | Database URL variants: user `postgres` / `core_owner`; host `localhost` / `::1` / other; port 5432 / 55443; database `pdabliss_core`, `_dev`, `_uat`, `_test`; any query parameter → refused                                  |
| T4  | Secret missing, short, whitespace, equal to `DEV_AUTH_SECRET` → refused                                                                                                                                                     |
| T5  | Each disallowed CORE variable present; `ENABLE_DEMO_ROUTES` = `true` / `TRUE` / `1` / unset; `NODE_ENV` = `production` / `test` / unset → refused                                                                             |
| T6  | `.env` / `.env.test` present → refused; `RELEASE_SHA` missing or different → refused; sticky marker present → refused before any other check                                                                               |
| T7  | Exception injection: target throws on import; database connect hangs (timeout) → exit 78, no hang, no listener left                                                                                                         |
| T8  | Post-bind: simulated wildcard address → server closed, exit 78. Exposure probe: an injected probe reporting a successful connect → closed, exit 78. (Tests may vary only the port and the probe function, never the host constant.) |
| T9  | Positive: all valid → target imported, bound to 127.0.0.1, probe clean                                                                                                                                                       |
| T10 | Integration in G0 on the disposable cluster: L9 passes as `core_app`, refuses `core_owner` and a superuser, and refuses when the database is down                                                                            |
| T11 | On the host in Stage B (G5):<br>• the refusal drill (`ENABLE_DEMO_ROUTES=true` → refused, sticky marker written, service stays stopped; delete marker + fix → starts);<br>• `Test-NetConnection <LAN address> -Port 1311 / 1312 / 5433` → **all fail**;<br>• optionally the owner repeats that from a second LAN device. |

#### As implemented in A-0 (files and behaviour)

| File                                    | Role                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ops/ep48_5/staging-launch.mjs`         | API **entry point** (WinSW runs it). It calls `runCli` + `runApiLauncher()` **unconditionally**. A "main module" test was rejected because, through the `current` junction, it can silently do nothing.                                                                                                                         |
| `ops/ep48_5/api-launcher.mjs`           | API logic, in this order:<br>• **Phase A** — no application code: P7, L13, P6, L1–L8, L10, L14.<br>• **Phase B** — imports only `backend/dist/config/env.js`, a schema-and-constants module with no I/O and no listener, for `DEV_AUTH_SECRET` and `parseEnv` (L4, L11).<br>• **Phase C** — L9, the live database identity.<br>• **Phase D** — imports `backend/dist/app.js`.<br>• **Phase E** — binds to the constant, then L12. |
| `ops/ep48_5/staging-web-launch.mjs`     | web **entry point**                                                                                                                                                                                                                                                                                                            |
| `ops/ep48_5/web-launcher.mjs`           | web logic (W0–W6); Vite is resolved from the release's own `frontend/node_modules/vite/package.json` `exports`                                                                                                                                                                                                                  |
| `ops/ep48_5/launch-common.mjs`          | constants, refusal handling, sticky markers `run\launcher-refused-api.json` / `-web.json`, allow-list, probe, `runCli`                                                                                                                                                                                                          |
| `ops/ep48_5/g0-guard.mjs`               | G0 isolation guard I1–I5 and the only way G0 starts the backend / ops suites (exact counts, zero skipped)                                                                                                                                                                                                                        |
| `ops/test/staging-launch.test.mjs` · `g0-guard.test.mjs` · `staging-launch.g0.test.mjs` | T1–T9 and the web tests (Node built-ins only); guard tests; T10 (live database, inside G0 only)                                                                                                                                           |

- **`runCli` failure handling:**
  - every failure *during start-up* (refusal, exception, unhandled rejection, 60 s watchdog) → exit 78 + sticky marker;
  - *after* a successful start, the crash handlers are removed. A later crash is an ordinary exit 1, which WinSW may
    restart. It is not a sticky refusal.
- **Folder rights:** the services need modify rights on `<root>\run`, where the markers are written.

**External access stays prohibited:** there is no tunnel ingress, DNS record, firewall rule or LAN listener, and no
configuration switch that could create one.

### 4.3 Rejected profile options

| Option                                                                                     | Why not                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plain development mode (no launcher)                                                       | one missing variable silently re-enables the demo bypass or the public secret fallback                                                                                                                  |
| `NODE_ENV=production` runtime with a dev-mode seed                                         | Circumvents the seed's production guard. It needs STARTTLS SMTP: either real mail to non-existent demo mailboxes, or new TLS sink software. `__Host-` cookies over http work only on loopback. |

### 4.4 Exit condition (before any access beyond the server's own browser)

A separately approved **code** change adds an explicit staging identity (for example `CORE_ENV=staging`):

- production-grade cookies, JSON logs, `environment: staging`;
- no development activation unless explicitly enabled;
- demo seed and file mail sink allowed **only** under that identity.

Then a Cloudflare Access review: policy first, named identities, a new hostname, `TRUST_PROXY=loopback`, a
spoofed-header test, and a rebuild with the HTTPS origin.

## 5. Components, names, ports, paths

| Kind              | Value                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Ports (127.0.0.1) | web **1311** · api **1312** · PostgreSQL **5433**. All verified free (TCP / UDP), outside excluded ranges, no rule, no tunnel. Alternates 1411 / 1412 / 5434. |
| Services          | `pdabliss-core-staging-pg` (NetworkService), `core-staging-api` / `core-staging-web` (virtual accounts `NT SERVICE\…`)                       |
| Tasks             | folder `\PDA BLISS CORE Staging\`: `Backup` (03:20 daily), `Health` (every 5 min starting :02 → :02, :07, … never :05), `Retention` (created disabled) |
| Root (SATA SSD)   | `D:\pdabliss-core-staging\` → `releases\<sha>\`, `current` (junction), `config\` (ACL), `mail\` (ACL), `pgdata\`, `logs\`, `run\`, `tools\winsw\` |
| Backups (HDD)     | `G:\pdabliss-core-staging-backups\`, a new top-level folder outside `G:\S2_NAS_DATA`. The S2 NAS serving root is **verified** from its configuration and code (audit §4.7). The G: root is **not treated as private**: the folder gets its own ACL (inheritance removed; Administrators, SYSTEM, NetworkService only). C0 re-checks the S2 NAS roots and the host's SMB shares; if either check fails or cannot be done, use the **D: fallback** (§7). |
| Database          | `pdabliss_core_staging`, UTF8, **`English_United States.1252`, libc**: the same collation as every database on the shared cluster             |
| Roles             | `core_owner` (migrations), `core_app` (runtime, limit 40), `core_backup` (dump), `core_monitor`, `core_verify` (`CREATEDB`, restore checks), bootstrap `core_staging_admin` — **all on the staging cluster only** |

## 6. Isolation against the brief

| Requirement                        | Met by                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Dedicated database                 | own cluster and database                                                                                  |
| Restricted credentials             | DML-only runtime; launcher L5 / L9 refuse anything else                                                   |
| Separate secrets                   | generated on the server; nothing copied from Dev or any production `.env`                                  |
| Distinct listeners                 | 1311 / 1312 / 5433 on 127.0.0.1                                                                           |
| Isolated logs / backups            | `D:\pdabliss-core-staging\logs`, `G:\pdabliss-core-staging-backups`; retention `allowDirs` = that folder only |
| Explicit identity                  | `core-staging` names, launcher banner and marker. Gap: the `/health` label (§4.1).                         |
| Separate release directory         | `releases\<sha>` clone, detached                                                                          |
| No Dev / UAT access                | none on this host (verified); separate credentials                                                        |
| No shared mutable state            | Shared read-only: PostgreSQL 18.6 binaries, Node 24.19 runtime. No shared writable file, service, daemon or database. |

## 7. Data, backup, monitoring

- **Migrations / seed:** fresh database → `migrate deploy` as `core_owner` (28 / 28) → `grantRuntime` →
  `ownershipAudit` 0 → `forbiddenAttempts` 17 / 17 → demo seed → `uat/integrity.sql` 0 → verified reset-point backup.
- **Backup:**
  - EP43 ops with `CORE_OPS_CONFIG`, profile `staging`, as `core_backup`;
  - each backup is restore-verified on the staging cluster (`core_verify`);
  - retention runs as a dry run until 3 verified backups exist **and** the owner approves.
- **Off-machine:** none for staging (demo data). Mandatory before any pilot.
- **D: fallback** — `D:\pdabliss-core-staging-backups`, used only if OD-6's conditions fail:
  - **same physical SSD** as the staging data (`D:\pdabliss-core-staging\pgdata`), so a disk failure or ransomware on D:
    loses both;
  - it protects only against logical damage (a bad migration, deleted rows, a corrupted database) — **acceptable for demo
    data only**;
  - **not acceptable for any pilot**: a separate disk plus an off-machine copy are required first.
- **Monitor:**
  - `health --once` every 5 min checks liveness, readiness (database + schema), the frontend, backup age and storage
    (D:, G:, logs);
  - status file + rotated log. **No alert delivery** (no SMTP) — the owner checks `ops status` daily during UAT.
- **Reboot:** all services automatic (delayed) with dependencies. A reboot drill is a separate supervised window, not
  part of EP48.5.
