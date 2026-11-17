# EP48.5 O1 — Online deployment tooling (repository only)

**Authorized:** 2026-11-17 21:22 (O1). **Base:** `c848b22`. **Scope:** `ops/`, `ops/test/`, EP48.5 documentation.

**Not done (by design):**
- no change under `backend/` or `frontend/`;
- no service installed or started;
- no database touched, no migration;
- no Cloudflare / DNS / WAF change;
- no PM2 command, no public port;
- no Full G0;
- nothing pushed or deployed.

Owner's O0b note: the 19 public hostnames of tunnel `s2aconsultant-server` do not include `core.pdabliss.com`, and public DNS is NXDOMAIN. The remaining dashboard checks (Workers routes, Access applications, DNS, redirect / WAF rules naming the hostname) are still required before O6.

## 1. What was built

| Area                                    | Files                                                                                                                                                         | Behaviour                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Online runtime profile (API)            | `ops/ep48_5/api-launcher.mjs` (profiles), `launch-common.mjs` (constants), **`online-launch.mjs`** (new entry point)                                         | <ul><li>Fixed profile `online`, chosen by the entry point and never by the environment. `CORE_ENVIRONMENT=online-uat`, `NODE_ENV=production`, `ENABLE_DEMO_ROUTES=false`, the constant bind 127.0.0.1:1312.</li><li>`CORS_ORIGINS = PUBLIC_APP_URL = https://core.pdabliss.com`; `TRUST_PROXY=loopback` exactly.</li><li>SMTP: `MAIL_TRANSPORT=smtp`, 587 / STARTTLS or 465 / TLS only, a DNS host name, a `pdabliss.com` mailbox and sender.</li><li>Refused: `DEV_MAIL_DIR`, `RATE_LIMIT_*`, seed / build / `PG*` variables.</li><li>The application's own parsed production configuration must agree (L11).</li><li>All existing locks unchanged: L4 secret, L5 / L9 database, L8 `.env`, L10 release, L12 post-bind proof and LAN self-probe, L13 no debugger, L14 location, P7 sticky refusal.</li><li>Production mode is what gives `__Host-` Secure cookies, no demo bypass and no development activation (verified in `cb21be1` code).</li><li>The staging profile and `staging-launch.mjs` are unchanged (40 / 40 existing tests).</li></ul> |
| Hardened static web server              | **`ops/ep48_5/static-server.mjs`**, `web-launcher.mjs` (`runOnlineWebLauncher`), **`online-web-launch.mjs`**                                                | <ul><li>The build (`frontend/dist`) is indexed once at start-up and requests are answered only by exact lookup, so traversal cannot name a file outside it.</li><li>A link / junction in the build, a missing `index.html` / `404.html` or an unsupported `_redirects` rule refuses start-up.</li><li>Dot paths, source maps and `_redirects` are never served; there is no listing.</li><li>Routing = the build's own `_redirects` contract plus the router's `/company/*` and `/core/*` app routes (not in `_redirects`).</li><li>GET / HEAD only; Host must be `core.pdabliss.com` or loopback (else 421); 414 above 2,048 characters.</li><li>Headers: nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, COOP / CORP, HSTS (this host only), a non-script CSP (`frame-ancestors`, `base-uri`, `object-src`, `form-action`), `X-Robots-Tag: noindex, nofollow` (OD-P4).</li><li>Assets are immutable; HTML is revalidated.</li><li>The online build must target `https://core.pdabliss.com`, with no loopback or development origin and no development chunks.</li><li>Same constant bind 127.0.0.1:1311, post-bind proof and self-probe.</li><li>**Vite `preview()` is not used online.**</li></ul> |
| Production preservation fix             | `ops/ep48_5/g0-supervisor.mjs` (`coreOwnedPids`, `identifyProduction`, isolation)                                                                            | <ul><li>A process is CORE-owned when it, or an ancestor (WinSW wrapper, `pg_ctl runservice`), names `D:\pdabliss-core-staging`.</li><li>CORE-owned processes are never production: the CORE cluster on 5433, the CORE tunnel connector, the CORE services.</li><li>The shared postmaster is the service postmaster outside CORE, or the one listening on **5432**. If that is ambiguous it counts as not found (the baseline is refused, fail closed), never chosen by list order.</li><li>Real changes still FAIL: postmaster restart, production connector restart, PM2 child restart, the 5432 owner, a new `cloudflared` outside CORE.</li><li>The isolation report lists CORE processes separately.</li></ul> |
| Non-destructive online checks           | **`ops/ep48_5/core-online-check.mjs`**                                                                                                                       | <ul><li>`release`: application safeguards in the release source (A1–A4, C1–C2, D1–D3, M1, E1) plus the known blockers.</li><li>`build`: the online frontend, offline.</li><li>`smtp`: settings and an optional TLS-only conversation (no AUTH, no mail).</li><li>`db-target`: URL and a read-only live session check.</li><li>`local`: CORE ports loopback-only and CORE-owned, production identifiable.</li><li>`remote`: outside checks for mode R / P, credential-free (nothing created).</li></ul> |
| Cloudflare (prepared, **not created**)  | **`ops/ep48_5/online/pdabliss-core.tunnel.json`**, **`pdabliss-core.access.json`**                                                                           | <ul><li>Dedicated tunnel `pdabliss-core`, ingress in order:<ol><li>sign-up API → `http_status:404`;</li><li>`/register`, `/en/register`, `/zh/register` → 404;</li><li>`^/api(/.*)?$` → 127.0.0.1:1312;</li><li>`^/health(/ready)?$` → 1312 (the backend owns both; verified);</li><li>everything else → 1311;</li><li>catch-all → 404.</li></ol></li><li>Fallback: one hostname-scoped WAF block rule.</li><li>Access: A1 (`/platform*`, `/api/v1/platform/*`, named operators, until EP48.6); A2 (whole hostname, mode R only, named testers).</li><li>`s2aconsultant-server` and the other tunnels are untouched.</li></ul> |
| Service templates (prepared, **not installed**) | **`ops/ep48_5/online/winsw/pdabliss-core-api.xml`**, **`-web.xml`**, **`-tunnel.xml`**                                                                 | <ul><li>Dedicated services, virtual accounts set with `sc.exe config … obj= "NT SERVICE\…"`.</li><li>API depends on `pdabliss-core-staging-pg`; the tunnel depends on API **and** web, so a refusal keeps the door closed.</li><li>Restart 10 s, then 30 s, then none; reset after 1 h.</li><li>Logs roll 10 MB × 8 under `logs\api|web|tunnel`.</li><li>Secrets only in `config\core-online.env` / `config\core-tunnel.token`.</li><li>The connector is a **pinned copy** of `cloudflared.exe` under `tools\cloudflared`, so production's binary is never shared.</li><li>Metrics on 127.0.0.1:20243.</li></ul> |

**Final service names** (they replace the plan's earlier working names):
- `pdabliss-core-api` (was `core-staging-api`);
- `pdabliss-core-web` (was `core-staging-web`);
- `pdabliss-core-tunnel` (was `core-tunnel`);
- unchanged: the database service `pdabliss-core-staging-pg` and the root `D:\pdabliss-core-staging`.

## 2. Tests (counts updated in the same commit; P7 manifest `ops/ep48_5/g0-test-manifest.mjs`)

| File                                     | Before | Now | Change                                                                                                    |
| ---------------------------------------- | -----: | --: | --------------------------------------------------------------------------------------------------------- |
| g0-guard.test.mjs                        |     18 |  18 | —                                                                                                         |
| g0-loopback.test.mjs                     |      4 |   4 | —                                                                                                         |
| **g0-online.test.mjs** (new)             |      — |   9 | ON1–ON9: release safeguards and regressions, SMTP, database target, local isolation, remote R / P, tunnel / Access specs, WinSW |
| g0-preflight.test.mjs                    |      9 |   9 | —                                                                                                         |
| g0-supervisor.test.mjs                   |     37 |  40 | R16–R16c: CORE is not production; real changes still FAIL; isolation buckets                             |
| **staging-launch.online.test.mjs** (new) |      — |  13 | online API profile (O-T9, L1 / L2, L6, L7, P6, L11, profiles), online web (W9, W1 + offline `build`), static server S1–S4 |
| staging-launch.test.mjs                  |     40 |  40 | — (the staging profile is unchanged)                                                                      |
| **P7 total (Windows harness)**           |    108 | **133** |                                                                                                       |
| G0 `ops-tests` (`-ExpectOps`)            |    130 | **155** | 133 + T10 (1) + EP43 (21)                                                                             |

**Results (Linux; Windows not yet run):**
- **Device VM, full repository, P7 set with the manifest reporter:** 133 / 133, 0 fail / skipped / todo / cancelled, manifest check `ok`.
- **Full ops suite:** the EP43 `ops.test.mjs` cannot load in the VM (no backend `node_modules`, `pg`), the same as before O1 and the reason P7 excludes it. T10 skips outside G0 (by design).
- **Mutation checks:** 17 breakages; 16 were caught directly and 1 by the test once both of its layers were removed (hidden files: the index **and** the request filter). They covered:
  - 587 without STARTTLS;
  - `TRUST_PROXY` not enforced;
  - development mode;
  - origin not enforced;
  - Host check, methods, app routes;
  - a link in the build;
  - the online build origin;
  - postmaster by list order;
  - CORE not excluded;
  - route-hook check;
  - Access detection;
  - loopback requirement;
  - ingress order;
  - unbounded restarts.
- **Static checks:** the PowerShell variable checks are clean on all harness scripts; `checkRunner` reports nothing; the repository preflight passes.

**Windows-specific behaviour is NOT yet verified:** the junction refusal on NTFS, `g0-facts` on the real host for `local`, and the real-host production identity with the new rule. It is verified by §3.

## 3. Windows verification (S2A-SERVER, elevated Windows PowerShell 5.1; all read-only)

```powershell
cd D:\S2A_PROJECT\pdabliss_core
git log -1 --format=%H                         # = the O1 commit
git status --porcelain                         # empty
git diff --stat cb21be102a03495c1b6659d99fa8d49eef8eaa4e HEAD -- backend frontend   # empty
New-Item -ItemType Directory -Force ops-logs\ep48_5-online | Out-Null
powershell -NoProfile -ExecutionPolicy Bypass -File .\ops\ep48_5\g0-harness\Test-G0Harness.ps1
#   P1-P12 PASS; P7 = exactly the manifest: 133 tests in 7 files, 0 fail / skipped / todo / cancelled, 0 non-loopback attempts
powershell -NoProfile -ExecutionPolicy Bypass -File .\ops\ep48_5\g0-harness\Preflight-G0.ps1 -Release (git log -1 --format=%H)
#   PASS (W1-W9)
node ops\ep48_5\core-online-check.mjs release --release-root . --out ops-logs\ep48_5-online\o1-release.json
#   exit 0; blockers listed: B1_PUBLIC_SIGN_UP (edge block before O7), I1_HEALTH_DISCLOSURE
node ops\ep48_5\core-online-check.mjs local --expect absent --out ops-logs\ep48_5-online\o1-local.json
#   exit 0: nothing on 1311 / 1312 / 5433 / 20243; shared postmaster (5432) and the PM2 daemon identified
node ops\ep48_5\g0-supervisor.mjs isolation --out ops-logs\ep48_5-online\o1-isolation.json
#   status reported (CLEAR / REVIEW / BLOCK) for the O2 window; production never listed as an agent
```

Pass for O1 on Windows: harness P1–P12 PASS, preflight PASS, `release` exit 0, `local --expect absent` exit 0.

## 4. Deployment blockers and remaining risks

| #   | Item                                                                                                                       | Status / control                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Public self-registration and verification-resend exist in the application and cannot be disabled by configuration (application-level) | **Blocker for public mode (O7)**, not for mode R. Edge block in the tunnel ingress (or the WAF fallback), verified by `remote --mode P` (P1). Code switch: EP48.6.                  |
| B2  | Administration reachable for sign-in attempts                                                                              | Access A1 (prepared). Verified by `remote` (P2).                                                                                                                                         |
| B3  | Vite `preview()`                                                                                                           | **Resolved in O1** (hardened static server).                                                                                                                                            |
| B4  | SMTP not configured                                                                                                        | **Open**: owner decision OD-P6 (Hostinger mailbox `notify@pdabliss.com` + credential). The launcher refuses to start without valid settings; `smtp --connect` verifies TLS without sending. |
| B5  | Tooling on Windows                                                                                                         | Implemented; **Windows verification §3 pending**.                                                                                                                                        |
| B6  | Dormant hostname configuration                                                                                             | Partly checked by the owner (tunnel `s2aconsultant-server`, DNS). **Remaining dashboard checks before O6.**                                                                              |
| I1  | `/health` is public once routed (owner instruction): it shows service, version, `environment` and uptime; `/health/ready` shows database / schema status | Low (no secret). It can be dropped from the ingress at any time.                                                                                                                       |
| R1  | Demo seed exception (OD-P5)                                                                                                | Owner decision pending.                                                                                                                                                                  |
| R2  | Run-2 terminator unidentified                                                                                              | Agents paused during change windows (isolation report).                                                                                                                                 |
| R3  | HSTS, CSP                                                                                                                  | HSTS without `includeSubDomains`; script CSP deferred to EP48.6.                                                                                                                         |

## 5. O2 proposal — release on disk (no service, no database, no Cloudflare)

**Preconditions:**
- §3 passed on Windows;
- a window with development agents paused (isolation CLEAR / REVIEW accepted);
- separate O2 authorization.

| Step | Action (administrator PowerShell)                                                                                                                                                                                                                                                                                                                                      | Evidence                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| O2-0 | `node ops\ep48_5\g0-supervisor.mjs baseline --out ops-logs\ep48_5-online\o2-baseline.json --g0-dir D:\pdabliss-core-staging --temp-pg-port 55443` (read-only; production endpoints + process identities)                                                                                                                                                              | baseline valid; endpoint count (expect 21)                                                    |
| O2-1 | Folders under `D:\pdabliss-core-staging`: `releases`, `config`, `logs\{api,web,tunnel,postgres}`, `run`, `services`, `tools\{winsw,cloudflared}`, `npm-cache`. ACLs:<br>• `config`: inheritance removed, Administrators + SYSTEM only (service accounts are added at O4 / O5);<br>• `logs` / `run`: modify for the future service accounts (added at O4). | ACL listing                                                                                   |
| O2-2 | `git clone --no-local D:\S2A_PROJECT\pdabliss_core D:\pdabliss-core-staging\releases\<sha>`; `git -C … checkout --detach <sha>`; `Set-Content …\RELEASE_SHA <sha>` (ASCII). `current` junction created **at O4**, not now.                                                                                                                                                    | `rev-parse HEAD` = sha; `status --porcelain` empty; `git diff cb21be1 <sha> -- backend frontend` empty |
| O2-3 | `$env:npm_config_cache='D:\pdabliss-core-staging\npm-cache'`. Backend: `npm ci`, `npm run build`. Frontend: `$env:VITE_API_URL='https://core.pdabliss.com'; $env:VITE_SITE_URL='https://core.pdabliss.com'; npm ci; npm run build` (prerender + budgets); then remove both variables. No `.env` anywhere.                                                                       | exit 0; budgets pass                                                                          |
| O2-4 | `node ops\ep48_5\core-online-check.mjs release --release-root <release>`, then `build --release-root <release>` (both from the **release** folder)                                                                                                                                                                                                                        | exit 0 both                                                                                   |
| O2-5 | Copy WinSW v2.12.0 x64 (SHA-256 checked against its GitHub release) to `tools\winsw\WinSW-x64.exe`; copy the installed `cloudflared.exe` to `tools\cloudflared\` and record `--version` and SHA-256. **Nothing is registered or started.**                                                                                                                         | hashes recorded                                                                               |
| O2-6 | `node ops\ep48_5\g0-supervisor.mjs i5-check --baseline ops-logs\ep48_5-online\o2-baseline.json --out ops-logs\ep48_5-online\o2-i5.json --g0-dir D:\pdabliss-core-staging --temp-pg-port 55443 --expect-endpoints 21`; `core-online-check local --expect absent`                                                                                                         | **PASS**; nothing listening on CORE ports                                                     |

**Stop at O2** if any of these happens:
- any step fails;
- `i5-check` is not PASS;
- a production PID or start time changes;
- anything listens on a CORE port.

**O2 rollback** (nothing runs, so nothing is stopped):
- the release folder, `npm-cache` and `tools` copies stay in place;
- **deleting them needs a separate written approval (A-8b)**;
- no production object is involved, so there is nothing to restore.

**After O2** (each separately authorized; plan §0.4):
- **O3** database: cluster, migrations on the verified target (`db-target --live`), platform bootstrap, OD-P5 seed, reset point;
- **O4** services on loopback (`local --expect running`, refusal and R1 drills);
- **O5** Access A1 / A2 and the tunnel without a hostname;
- **O6** mode R (`remote --mode R`);
- **O7** public login only after `remote --mode P` passes and P5 / P6 / P9 are recorded.

## 6. Confirmation

No production or Cloudflare resource was created, changed, started or stopped in O1:
- PM2, PostgreSQL 5432, MariaDB, the `Cloudflared` / `CloudflaredS2A` (`s2aconsultant-server`) services and their dashboard configuration, DNS, WAF, the firewall, Windows services and scheduled tasks are unchanged;
- no listener was opened on the host (tests bind 127.0.0.1 inside the Linux workspace / VM only).
