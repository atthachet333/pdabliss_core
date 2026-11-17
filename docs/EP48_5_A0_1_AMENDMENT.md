# EP48.5 — A-0.1 Corrective Amendment (record)

| Item                 | Value                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Owner approval       | A-0.1 ONLY (2026-11-17 11:40). Not an approval of G0, A-2…A-8 or Stage B.                                 |
| Base                 | `f1b54fffd5fd50995f907d6fd89e00d695ee76f2` (A-0)                                                           |
| Application baseline | `cb21be1` — **no file under `backend/` or `frontend/` changed**                                           |
| Scope                | `ops/ep48_5/`, `ops/test/` and `docs/EP48_5_*` only                                                        |
| Checkpoint           | **C-A0.1**. Full G0 needs a separate owner confirmation.                                                   |

## 1. Why (findings from the C-A0 verification)

| #   | Finding in `f1b54ff`                                                                                                                         | Effect                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| V-1 | `g0-guard.mjs ops-tests` ran `node --test ops/test/`; current Node treats a bare directory as a module path ("Cannot find module …\ops\test"). | G0 would always block at the ops step (fail-closed, never a false pass).         |
| V-2 | T10 dropped its own fixture database.                                                                                                        | Conflicted with "nothing deleted without A-8a".                                  |
| V-3 | `backend/prisma.config.ts` falls back to `postgresql://localhost:5432/pdabliss_core` when `DATABASE_URL` is unset (code we may not change).  | Any Prisma command without an explicit target could reach the shared cluster.    |
| V-4 | Test T8 opened a real listener on `0.0.0.0` for a few milliseconds; the S2A-SERVER firewall is off.                                           | A test service briefly reachable from the LAN.                                   |
| V-5 | `node --test` ran with its default file concurrency (CPU count − 1).                                                                         | Conflicted with "test concurrency two workers".                                  |

## 2. What changed (by owner condition)

### Condition 1 — the G0 test runner

- `discoverOpsTests(src)` lists `ops/test/*.test.mjs` **as explicit files** (forward slashes, sorted). No directory or glob is handed to Node, so the same call works on Windows and elsewhere.
- Flags: `--test --test-reporter=tap --test-concurrency=2`. Vitest is run with `--pool=forks --maxWorkers=2`.
- Regression tests:
  - a temporary tree with `x.test.mjs`, `helper.mjs`, `x.test.mjs.bak` and `sub/y.test.mjs` must discover exactly one file;
  - every argument must be an existing **file**;
  - the real invocation must run 2 / 2 tests;
  - this repository's six test files must all be discovered.
- Mutation-verified: both returning the directory and dropping the concurrency flag make tests fail (§4).
- **Verified count:** EP48.5 69 (g0-guard 18, g0-loopback 4, g0-preflight 6, staging-launch 40, staging-launch.g0 1 = T10) + EP43 21 = **90**. G0 must be run with `-ExpectOps 90`. Zero skipped is enforced, so T10 must run.

### Condition 2 — T10 fixture handling

- The fixture database is `pdabliss_core_launcher_g0_<8 random hex>`, and T10 asserts that format.
- Before creating it, T10 verifies:
  - URL (I2);
  - address, port 55443, role `gate`, database, **instance system identifier**, scram-only hba and data directory inside the gates folder (I1 / I3);
  - that the name does not exist yet (`assertDatabaseAbsent` → `COLLISION`).
- Every URL that T10 hands to the launcher check passes `checkTarget` first.
- Nothing is dropped; the fixture goes with the disposable instance under A-8a.
- The migration scratch check also refuses an existing `pdabliss_core_g0_migrate` and never drops it.

### Condition 3 — no unsafe database fallback

Every G0 step now runs through `g0-guard.mjs`, and the runner never sets a database variable itself:

| Target   | What the child gets                                                                                 | Used for                                                       |
| -------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `none`   | no `DATABASE_URL`, `TEST_DATABASE_URL`, `PG*`, `DIRECT_URL`, `SHADOW_DATABASE_URL`                   | lint, format, frontend, launcher smoke                          |
| `static` | `DATABASE_URL = postgresql://g0-static@127.0.0.1:55443/g0_no_such_database` (explicit; no such role or database) | backend `npm ci` / `db:validate` / `typecheck` / `build` (`prisma generate` / `validate`) |
| `test`   | `TEST_DATABASE_URL` only, after verification                                                         | backend tests, ops tests, migration scratch                    |

- **Rejected inputs:**
  - a missing target, or an unknown one;
  - inherited `PG*`, `DATABASE_URL`, `DIRECT_URL`, `SHADOW_DATABASE_URL` or `NODE_OPTIONS` (the guard fails with `ENV`; the runner removes them from its own process first);
  - a URL whose authority is not exactly `127.0.0.1:55443`: another host, a host list, no port (= 5432) or `localhost`;
  - any query string (`?host=` / `?port=` overrides);
  - a database or role that is not the expected one;
  - `.env` files in the checkout.
- **Verified before any destructive operation** (DDL, test-setup `DROP SCHEMA`, migrations):
  - `host(inet_server_addr()) = 127.0.0.1`;
  - `inet_server_port() = 55443`;
  - `current_user` and `current_database()` are the expected ones;
  - `pg_control_system().system_identifier` equals the value read with `pg_controldata` right after `initdb`; it is unique per cluster, so the shared cluster can never match;
  - `listen_addresses = 127.0.0.1`, SCRAM only, data directory inside the gates folder, no production database names.
- **Creating the test database:** `createdb.exe` / `PGPASSWORD` were removed. `g0-guard.mjs create-test-db` verifies the instance through `postgres`, refuses if `pdabliss_core_test` exists, then creates it.
- **Backend test setup** (unchanged code): its only Prisma call passes `DATABASE_URL: url` explicitly. Preflight check C5 verifies that statically, and the URL is the verified `TEST_DATABASE_URL`.
- **Migration scratch:**
  - the core_owner URL passes `checkTarget`;
  - the core_owner session is verified to be the same instance (address, port, role, database, postmaster start time);
  - Prisma gets that explicit `DATABASE_URL` and nothing else.
- **Defence in depth:** the monitor still stops G0 on any G0 process connected to port 5432.

### Condition 4 — no live all-interface listener

- **T8 rewrite.** T8 no longer listens on `0.0.0.0`. It now proves detection in two ways:
  - an injected connector reports reachable LAN / IPv6 addresses, ignores refused and silent ones, and makes the launcher close and refuse (`L12_EXPOSED`), with the server itself only ever on 127.0.0.1;
  - real sockets on **127.0.0.1 only** show that a reachable listener is detected, a closed port is not, and LAN addresses do not reach a 127.0.0.1 listener.
- **Loopback-only guard** (`g0-loopback.mjs`, preloaded by the guard into **every** G0 process and its children through `NODE_OPTIONS=--import=…`):
  - a `listen` or UDP `bind` on `0.0.0.0`, `::`, no address, a bare port, port + backlog, options without `host`, a LAN address or an inherited handle **throws before a socket exists** and is recorded;
  - allowed: `127.0.0.0/8`, `::1`, `localhost`, named pipes;
  - every step must show at least 1 armed process and 0 refused attempts, otherwise it fails (`LOOPBACK`).
- **Monitor.** A non-loopback listener owned by any G0 process now stops G0 **in the same round**; previously it was tolerated for 2 rounds.
- **Launcher smoke.** It runs under the guard and listens only on 127.0.0.1. Its 5432 / 5433 URLs are refusal / stand-in fixtures; they are marked and no client is created for them.

### Condition 5 — read-only Windows preflight

`ops\ep48_5\g0-harness\Preflight-G0.ps1` (Windows PowerShell 5.1, elevated). It calls `ops\ep48_5\g0-preflight.mjs` for the static checks. `Run-G0.ps1` runs it first, with `-FromRunner`, and **a BLOCK stops G0** before anything is created.

| Check | What                                                                                                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1    | PowerShell 5.1 Desktop, FullLanguage, required cmdlets, and the PowerShell **parser** on Run-G0, monitor, preflight and collector (0 errors)                                                   |
| W2    | Host is S2A-SERVER; elevated                                                                                                                                                              |
| W3    | Release is a commit and is the repository HEAD; clean tree; `backend/` / `frontend/` = `cb21be1`; only EP48.5 paths changed; no `.env` committed; harness SHA-256 recorded                 |
| W4    | Node ≥ 24, npm CLI next to node.exe, git                                                                                                                                                  |
| W5    | `initdb` / `pg_ctl` / `postgres` / `pg_controldata` present in the 18.x `bin` (only `--version` runs)                                                                                       |
| W6    | Port 55443 free (all states, IPv4 / IPv6) and outside excluded port ranges                                                                                                                 |
| W7    | Unsafe variables (Process / User / Machine scope; **names only**) and `.env` files. WARN when run standalone; FAIL from the runner if any survive in its process                              |
| W8    | Production baseline: PM2 daemon and children, postmaster, MariaDB, cloudflared, production ports' HTTP status / latency; RAM ≥ 10 GB, D: ≥ 20 GB, CPU                                       |
| W9    | C1–C9 below                                                                                                                                                                               |

| Static check | What                                                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1           | Guard and runner target 127.0.0.1:55443                                                                                                                                                                    |
| C2           | Runner: every step through the guard; explicit `--target`; no `DATABASE_URL` / `PG*` / `NODE_OPTIONS` assignment; no 5432; no database tool; no delete other than environment variables; preflight first; system identifier recorded |
| C3           | Monitor stops on any non-loopback G0 listener at once and watches port 5432                                                                                                                                 |
| C4           | Every connection string in the harness and guard targets 55443 (marked fixtures excepted)                                                                                                                  |
| C5           | Every Prisma CLI call in the backend test setup passes `DATABASE_URL` explicitly                                                                                                                            |
| C6           | No wildcard / address-less / bare-port `listen` in backend tests, frontend tests, ops tests or harness                                                                                                    |
| C7           | Every guard target is explicit and preloads the loopback guard                                                                                                                                             |
| C8           | Self-test: a child node with the preload; 7 refused cases (0.0.0.0, ::, no address, options without host, LAN address, port + backlog, UDP wildcard) → all refused, **no socket bound**                       |
| C9           | Ops test files listed explicitly, concurrency 2                                                                                                                                                            |

**What the preflight does not do:** no npm, no database connection or creation, no migration, no service / task / listener, no PM2 / PostgreSQL / MariaDB / Cloudflare / firewall change, nothing deleted.

**What it writes:** only its report, to `ops-logs\ep48_5-g0\preflight-<timestamp>\` (git-ignored).

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\S2A_PROJECT\pdabliss_core\ops\ep48_5\g0-harness\Preflight-G0.ps1 -Release <A-0.1 commit sha>
```

### Condition 6 — scope

- **Changed paths:** only `ops/ep48_5/`, `ops/test/` and `docs/EP48_5_*`.
- **The harness is now committed.** That way the runner, the monitor and the preflight run from the reviewed commit, and the harness `.mjs` files run from the G0 checkout itself.
- **No deletion anywhere.** The runner no longer deletes the one-time `initdb` password file; it overwrites it empty and keeps it.

## 3. Verification done for A-0.1

Where these runs happened: the agent's Linux VMs (Node 22.23), **not** S2A-SERVER.

| Run                                                                                                                                   | Result                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| EP48.5 suites (5 files, explicit list, concurrency 2)                                                                                 | 69 tests: 68 pass, 0 fail, 1 skipped (T10 — G0 only by design; G0 refuses any skip)                          |
| Same, with the loopback guard preloaded exactly as G0 does                                                                            | 69 / 68 / 0 / 1; guard armed in 5 processes, **0 refused attempts**                                          |
| EP43 `ops.test.mjs` (stand-in `pg` module that throws on use: these tests never connect; real `pg` is not installed outside G0)        | 21 tests: 20 pass, 1 fail. The failure is a Windows-path assertion (`C:/Users/…/OneDrive`) that Linux treats as relative; that code is unchanged since EP43 and runs on Windows in G0. 0 refused listener attempts |
| `g0-preflight.mjs --src <repo>`                                                                                                       | C1–C9 PASS (126 test / harness files scanned, 13 `listen` calls, 1 Prisma CLI call — explicit)                |

**Mutation check** (each mutation on a scratch copy; the suite must fail):

| #    | Mutation                                                    | Caught |
| ---- | ----------------------------------------------------------- | ------ |
| M0   | none (control)                                              | 0 fail |
| M1   | ops runner given `ops/test/` (the V-1 bug)                  | yes    |
| M2   | concurrency flag removed                                    | yes    |
| M3   | loopback guard allows everything                            | yes (3 tests + preflight C8 7/7) |
| M4   | `PG*` variables reach the child                             | yes    |
| M5   | static target without `DATABASE_URL` (Prisma fallback)      | yes    |
| M6   | system identifier not compared                              | yes    |
| M7   | role not compared                                           | yes    |
| M8   | host list / other host accepted                             | yes    |
| M9   | collision check removed                                     | yes    |
| M10  | loopback preload not set                                    | yes    |
| M11  | monitor tolerates 2 rounds                                  | yes    |
| M12  | a runner step bypasses the guard                            | yes    |
| M13  | runner sets `DATABASE_URL` itself                           | yes    |
| M14  | a test listens on `0.0.0.0`                                 | yes (C6) |
| M15  | exposure probe ignores the injected connector               | yes    |
| M16  | discovery returns the directory                             | yes    |
| M17  | T10 fixture name fixed                                      | only in G0 (T10 runs only there; its name assertion and the collision check apply there) |

**Disclosure:** M3 and M14 deliberately allowed a wildcard listener. On the device side they ran in the agent's sandboxed Linux VM, not on the Windows network stack. M3 was re-checked in the agent's cloud workspace.

## 4. Remaining Windows-specific uncertainties (first exercised by the preflight / G0 on the host)

1. **PowerShell scripts never executed here.** No PowerShell is available to the agent. W1 parses them on the host first.
2. **`NODE_OPTIONS=--import=file:///D:/…` on Windows Node 24.** Expected to work (URL from `pathToFileURL`). The guard fails a step that shows 0 armed processes, so a silent miss is impossible.
3. **Vitest forks and the preload.** `--pool=forks` is forced, and child processes inherit `NODE_OPTIONS`. If Vitest 5 started worker threads instead, those would not be armed; the monitor's same-round non-loopback stop remains the backstop.
4. **`pg_controldata` output format.** The runner matches "system identifier: <digits>". A localized message catalogue would make it refuse (fail-closed).
5. **`pg_control_system()`** needs superuser; the guard connects as `gate` (the bootstrap superuser).
6. **`npx prisma` in the backend test setup** runs through `cmd.exe` (`shell: true` on win32) at BelowNormal priority; the preload also applies there.
7. **`localhost`** is allowed by the loopback guard; Windows resolves it internally to 127.0.0.1 / ::1.
8. **Junction refusal (L7), IPv6 exposure and Vite 8 preview** are exercised only by the Windows launcher smoke in G0.
9. **Preflight timing.** It reads the PM2 tree as SYSTEM-owned processes (elevated) and probes production ports with one HTTP GET each, as the G0 monitor baseline does.
