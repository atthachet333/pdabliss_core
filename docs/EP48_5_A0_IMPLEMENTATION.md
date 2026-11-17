# EP48.5 — A-0 Implementation Record (fail-closed staging launchers + G0 isolation guard)

**Owner approval:** A-0 only (2026-11-17 10:49). **Not authorized:** A-1 … A-8, Stage B, deployment.

**Application baseline:** `cb21be1` (EP48). **No file under `backend/` or `frontend/` is changed.**

**Specification:** `EP48_5_STAGING_ARCHITECTURE.md` §4.2. This commit also carries the Stage A documents and the host
collector.

## 1. Files

| File                                       | Purpose                                                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ops/ep48_5/staging-launch.mjs`            | API service entry point; runs the launcher unconditionally                                                                                    |
| `ops/ep48_5/api-launcher.mjs`              | API launcher: P1–P8, L1–L14; builds the app itself (`buildApp`) and binds the constant 127.0.0.1:1312                                          |
| `ops/ep48_5/staging-web-launch.mjs`        | web service entry point                                                                                                                       |
| `ops/ep48_5/web-launcher.mjs`              | web launcher: W0–W6; Vite `preview()` on the constant 127.0.0.1:1311                                                                          |
| `ops/ep48_5/launch-common.mjs`             | shared constants and checks; refusal → exit 78 + sticky marker; exposure probe                                                                |
| `ops/ep48_5/g0-guard.mjs`                  | G0 guard I1–I5; the only entry point G0 uses to run the database / ops suites (exact counts, zero skipped)                                     |
| `ops/test/staging-launch.test.mjs`         | T1–T9 + web tests (Node built-ins only)                                                                                                       |
| `ops/test/g0-guard.test.mjs`               | guard tests (I1–I5, count enforcement)                                                                                                        |
| `ops/test/staging-launch.g0.test.mjs`      | T10: L9 against the live temporary instance, **only inside G0** (re-checks I1–I3 before connecting)                                            |

## 2. What the launchers guarantee (by construction, then by test)

| Requirement                          | Mechanism                                                                                                                                                                                                                        | Tests                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| No external network listener         | The bind host `127.0.0.1` is a code constant, never read from the environment (the API never imports `server.js`). After listen: the exact address, a single address, the expected port. TCP probe of every non-loopback address must fail. No debugger (L13). | T2, T8 (incl. real sockets), M1, M5, M6, M11 |
| No demo authentication bypass        | `ENABLE_DEMO_ROUTES` must be exactly `false`, required (an unset value would default to *on* in development). The application's own `parseEnv` result must also say `false` (L11).                                                | T5, T1-L11, M2, M7                       |
| No unsafe database connection        | URL = `core_app` @ `127.0.0.1:5433/pdabliss_core_staging`, no parameters. `PG*` variables refused. Live identity check: `core_app`, not superuser, right database and port, 2 s timeout.                                         | T3, T1-L9, P6, M3, M4; T10 in G0         |
| Fail closed                          | Every check, error, rejection or timeout during start-up → exit 78 + sticky marker. The entry points have no "main module" test (one that silently does nothing is impossible).                                                 | P2 tests (real child processes), entry-point test, M10, M14 |
| Right release, right place           | runs only from `<root>\releases\<sha>`; `RELEASE_SHA` = git HEAD; no `.env*` beside the release                                                                                                                                 | T6, L14, M13                             |

## 3. G0 isolation (owner requirement 5)

`g0-guard.mjs` enforces, **before any connection**:

| Guard | Check                                                                                                                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I2    | `TEST_DATABASE_URL` = `127.0.0.1:55443/pdabliss_core_test`, no parameters                                                                                                                      |
| I4    | no `.env*` in the checkout                                                                                                                                                                     |
| I1    | asks the server: `listen_addresses` = `127.0.0.1`; `password_encryption` = scram; every `pg_hba` rule scram / reject (no `trust`)                                                               |
| I3    | asks the server: port 55443; data directory inside the gates folder. **Refuses if the server holds any production database name** (`pda_one_*`, `pdabliss_property`, `pdabliss_staging`), so it can never act on the shared instance or `pda_one_test`. |
| I5    | `compare` of the before / after host collector baselines: postmaster PID and start, database list, production PM2 tree, listeners                                                              |

Then it runs the suite and refuses unless the count is exact and **0 skipped**: backend 611, frontend 1,192, ops 90 (after A-0.1).

## 4. Verification done in A-0 (agent sandbox: Linux VM, Node 22.23 — not the host)

| Check                                                                                                     | Result                                                                                         |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `node --check` on all new modules                                                                         | pass                                                                                           |
| New tests: `staging-launch.test.mjs`, `g0-guard.test.mjs`, `staging-launch.g0.test.mjs`                   | **47 / 48 pass, 0 fail, 1 skipped = T10** (live database; runs only in G0, where a skip is a failure) |
| Mutation testing: 15 protections deliberately broken, one at a time, in a scratch copy                     | **15 / 15 caught**; the no-change control run passes (see the table below)                     |
| `git diff cb21be1 -- backend frontend`                                                                    | empty                                                                                          |
| Existing EP43 ops tests (21)                                                                              | not runnable here (`pg` not installed) — G0                                                    |

**Mutations** (each must make the suite fail; the control must not):

| #   | Mutation                                             | Result     |
| --- | ---------------------------------------------------- | ---------- |
| M0  | **control — no change**                              | passes ✓   |
| M1  | bind host constant → `0.0.0.0`                       | caught (20 failures) |
| M2  | drop the `ENABLE_DEMO_ROUTES=false` lock             | caught     |
| M3  | allow query parameters in `DATABASE_URL`             | caught     |
| M4  | accept a superuser database session                  | caught     |
| M5  | skip the API exposure probe                          | caught     |
| M6  | ignore `NODE_OPTIONS`                                | caught     |
| M7  | skip the L11 parsed-configuration check              | caught     |
| M8  | G0 guard accepts any port                            | caught     |
| M9  | G0 guard ignores production database names          | caught     |
| M10 | a crash after start stays a sticky refusal           | caught     |
| M11 | web preview on `0.0.0.0`                             | caught     |
| M12 | web accepts the development API origin               | caught — **after a test fix**: the first run showed the test was masked by a second check under the same rule; a both-origins fixture was added |
| M13 | launcher runs from any folder                        | caught     |
| M14 | sticky marker ignored                                | caught     |
| M15 | G0 guard allows `trust` authentication               | caught     |

## 5. Known limitations (to be closed in G0 / G5, or accepted)

1. **The tests ran in the agent's Linux VM (Node 22), not on S2A-SERVER (Windows, Node 24).** Windows-specific
   behaviour — junction detection, case-insensitive paths, the real path through `current`, WinSW stop / restart —
   is first exercised in G0 (unit tests) and G5 (T11 on the host).
2. **No real backend build or Vite 8 was available** (no `node_modules`). The integration with the real `buildApp` /
   Fastify `addresses()` and Vite 8's `preview()` API is verified only in G0 / B5. If either differs, the launcher
   **refuses** rather than starting unchecked.
3. **T10** (live L9 against PostgreSQL) has not run; it runs in G0 behind I1–I4.
4. **Development-mode residuals accepted for loopback only** (architecture §4.1):
   - no `Secure` / `__Host-` cookie flags;
   - the development activation route (platform role + step-up, staging data);
   - `pino-pretty` logs;
   - `/health` reports `development`.
5. **Phase B imports `backend/dist/config/env.js`** before the database and app checks. It is a pure schema / constant
   module (no I/O, no listener). The application module itself is imported only after every pre-check passes.
6. **The exposure probe** covers IPv4 and global IPv6 addresses, not link-local IPv6. The primary control is the
   constant 127.0.0.1 bind (IPv4 only).
7. **L10 does not check the working tree.** It proves `RELEASE_SHA` = HEAD; a clean tree is verified in B2.
8. **The allow-list covers CORE, `PG*`, `VITE_*`, `NODE_OPTIONS` and `NODE_TLS_REJECT_UNAUTHORIZED`.** Other OS
   variables (for example `HTTP_PROXY`) are not restricted; none of them can open a listener.
9. **An administrator can always edit the launcher or the env files.** Administrators are trusted; the launcher guards
   against mistakes and drift, not against a malicious administrator.

## 6. A-0.1 corrective amendment (approved 2026-11-17 11:40, A-0.1 only)

The C-A0 verification found that `g0-guard.mjs ops-tests` passed a bare directory to `node --test` (V-1) and that T10 dropped its fixture database (V-2). The owner's A-0.1 approval also required three things:

- explicit database targets everywhere (V-3: Prisma's `localhost:5432` fallback);
- no live all-interface listener in any test (V-4: the firewall is off);
- a read-only Windows preflight.

All of it is recorded in **`docs/EP48_5_A0_1_AMENDMENT.md`**. After A-0.1:

- the ops expectation in G0 is **90** (EP43 21 + EP48.5 69, T10 included, 0 skipped);
- every G0 step runs through the guard with an explicit target and the loopback-only listener guard;
- the T8 real-socket test listens on 127.0.0.1 only.
