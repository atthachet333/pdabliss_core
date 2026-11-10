# EP42.2 — Full-System UAT Sandbox & Owner Testing Preparation — Report

**Baseline:** `330e69f` (EP42.1) on `main`, clean; `origin/main` is `aef2ff4` (EP42.1 was never
pushed — expected). Worktree `ep29up` untouched. **Result:** one local commit. Not pushed, not
deployed. EP42.3 not started.

**Verdict: PASS — the UAT sandbox is ready for the owner.**
**Human UAT: NOT STARTED.** No case in the owner test plan is marked; nothing here is human acceptance.

| Item | Value |
| --- | --- |
| UAT database | `pdabliss_core_uat` (PostgreSQL 18.6, `localhost:5432`, user `postgres`) |
| UAT frontend | **<http://127.0.0.1:1211>** (sign-in: <http://127.0.0.1:1211/login>) |
| UAT backend | **<http://127.0.0.1:1212>** (`/health`) |
| Development stack | `localhost:1111` / `localhost:1112` / `pdabliss_core_dev` — **not altered** (both were running, started by the owner, before and after EP42.2) |
| Runtime data | `C:\Users\User\pdabliss_uat\` (baseline, backups, logs, run, mail) — outside the repository |
| Commands | `uat\uat.cmd <start|stop|status|doctor|verify|backup|reset|restore|init>` or `node uat/uat.mjs …` |

Deliverables (Thai): [EP42_2_UAT_START_GUIDE.md](EP42_2_UAT_START_GUIDE.md) ·
[EP42_2_OWNER_TEST_PLAN.md](EP42_2_OWNER_TEST_PLAN.md) (102 cases, all NOT TESTED) ·
[EP42_2_BUG_REGISTER.md](EP42_2_BUG_REGISTER.md) (template + 12 known limitations).

## 1. Baseline and safety checks (Phase 1–2)

| Check | Finding |
| --- | --- |
| Git | `main` clean at `330e69f`; `330e69f` exists; no unrelated local changes |
| Ports before creation | 1211 free, 1212 free (bind test); 1111 / 1112 in use by the owner's own dev servers (`tsx watch` started 10:14, not by EP42.2) — left running |
| Database before creation | no `pdabliss_core_uat*` database existed (nothing valuable to overwrite) |
| PostgreSQL identity | `postgres` @ `localhost:5432`, server 18.6, data directory `C:/Program Files/PostgreSQL/18/data` |
| Configuration | UAT backend is started with explicit `NODE_ENV=development`, `ENABLE_DEMO_ROUTES=true`, `MAIL_TRANSPORT=dev`, `HOST=127.0.0.1`, `PORT=1212`, `CORS_ORIGINS` / `PUBLIC_APP_URL=http://127.0.0.1:1211`, `DATABASE_URL` → `pdabliss_core_uat` tagged `application_name=pdabliss-uat-backend`; credentials are read from `backend/.env` at run time and never written to the repo. The demo sign-in bypass stays impossible in production (the backend refuses it with `NODE_ENV=production`, EP40; the UAT tool refuses to run at all under `NODE_ENV=production`). |
| Cookie isolation | UAT uses host `127.0.0.1`, development uses `localhost`; browsers scope cookies by host, so the two sessions never overwrite each other |

## 2. UAT tooling (Phase 5–6) — `uat/`

| File | Purpose |
| --- | --- |
| `uat/lib.mjs` | Configuration and every safety guard (target-name allow-list, dev-database refusal, local host only, no production), PostgreSQL helpers, verified `pg_dump`, guarded drop/restore, port and process checks |
| `uat/uat.mjs` | CLI: `doctor`, `status`, `start`, `stop`, `init`, `verify [--api]`, `backup`, `reset`, `restore` |
| `uat/runner.mjs` | Detached runner for one UAT server (marked with `--pdabliss-uat-runner`); logs to `%UAT_HOME%\logs` |
| `uat/uat.cmd` | Windows shortcut (`uat\uat.cmd start`) — works from PowerShell and Command Prompt |
| `uat/integrity.sql` | The ten inventory-ledger reconciliation checks |

Reset design:
- **Explicit only:** nothing resets on application start-up; `reset` / `restore` need
  `--confirm pdabliss_core_uat` plus the name typed again at an interactive prompt.
- **Targets:** only `pdabliss_core_uat` or `pdabliss_core_uat_<suffix>` on a local server; the
  development database named in `backend/.env`, `postgres`, `*_dev` / `*_prod` and every other name
  are refused before any connection.
- **Preconditions:** refused while the UAT backend runs (pid file or `/health`) or while any session
  is connected to the target; the baseline must match its manifest SHA-256.
- **Evidence first:** the current database is dumped and verified (`pg_restore --list`) **before**
  anything is dropped; a failed backup aborts the reset.
- **Deterministic:** the baseline dump (written once by `init`) is restored and checked against the
  manifest's per-table content hashes (70 tables) and the ledger.
- `restore --from <dump>` brings back any backup the same way.

## 3. Database creation and fixtures (Phase 3)

`node uat/uat.mjs init --confirm pdabliss_core_uat` (≈ 21 s):
- empty database → `prisma migrate deploy` (26 migrations) → canonical demo seed
  (`src/cli/seed.ts --demo`, the services, no direct `StockBalance` writes);
- **second seed changed nothing:** per-table content hashes identical (stronger than the seed's own
  `unchanged` report);
- baseline `pdabliss_core_uat-baseline.dump` (494,941 bytes, 71 table-data entries) + manifest
  (SHA-256, row counts, content hashes, policy, git head).

Fixture coverage (`verify`), all at or above the minimum: demo company 1, branches 2, members 9,
customers 3, suppliers 3, item types 3, locations 3, PR states 4, PO states 5, deposit waiting 1,
goods receipts posted 4, lots with expiry 11, transfer states 2, adjustments posted 4, cycle counts
posted 1, sales-order states 4, active reservations 9, picks 5, packs 5, delivered shipments 2,
delivery exception 1, active BOMs 3, production-order states 5, material issues posted 3, output
reports accepted 3, FG receipts posted 3, stock movements 28; ledger 10 / 10 zero.

Document numbers are stable across resets (the baseline is restored, not re-seeded); they are listed
in the start guide. The approval policy of the UAT company is **`INDEPENDENT_APPROVAL`** (new-company
default), unlike `pdabliss_core_dev`; the test plan is written for it and tests both states.

## 4. Nine personas

| Check | Result |
| --- | --- |
| Database (`verify`) | role, status, departments, branch access and the staff DENY exception match for all 9 |
| Live through the UAT backend (`verify --api`, real sign-in, no e-mailed code) | owner 94 permissions · admin 13 (no operational) · executive 33 (all `.view`) · sales 9 · purchasing 16 · operations 22 · warehouse 16 · accounting 12 · staff 15 (no receiving); multi-branch personas are asked to choose |
| Real browser on `127.0.0.1:1211` | login page lists the 9 accounts; Sales signs in through the real form (no OTP), chooses `00001`, enters CORE and sees the 14 demo sales orders; the session cookie is HttpOnly |

## 5. Workflow validation on a disposable clone (Phase 4)

`pdabliss_core_uat_rehearsal` was created **with the reset tool itself** from the UAT baseline
(identical content hashes), then exercised through the real API on a scratch backend (port 2112):

| Suite | Result |
| --- | --- |
| E2E: Purchasing → Warehouse; Sales → Warehouse → Delivery; Sales shortage → Production; Production → Warehouse; Production → Sales; Shortage → Receipt; Executive; System Admin; Accounting; Warehouse privacy; Security; Races; Integrity | **120 / 120** |
| EP42.1 additions: 9-persona access matrix (144), sessions (7), Scenario D sales shortage → production → FG → manual allocation → delivery (13), approval policy both states with owner override, reason rules, duplicate decisions and audit (23), privacy (6), integrity (10) | **203 / 203** |
| EP41 controls: policy owner-only, override audit, SoD over every decision since the switch, SQL immutability of history | **23 / 23** |
| **New (EP42.2):** stock transfer (Warehouse drafts, Owner posts, double post → one 200 + one 409, one OUT + one IN), adjustment (Owner approves, parallel second approval refused, reserved stock refused), cycle count (count may not cut reserved stock → `409 STOCK_RESERVED`, cancel unlocks, correction path on free stock, double post refused, one `COUNT_CORRECTION`), money privacy on all three, branch / department isolation (9 refusals) | **41 / 41** |
| Races: 18 scenarios × 3 rounds | **0 failing rounds**, no 5xx |
| Ledger reconciliation after everything (164 movements) | **10 / 10 zero** |

Accounting's implemented scope is supplier deposits only (confirm / waive); no invoices, AR, AP or
GL exist (PDA ONE's scope) — recorded as K-04.

## 6. Reset and restore tests (Phase 5)

All on disposable databases first, then on the UAT database itself before hand-over:

| Test | Result |
| --- | --- |
| `reset` / `init` / `restore` / `backup` aimed at `pdabliss_core_dev`, `pdabliss_core_test`, `postgres`, `pdabliss_core_uat_dev` | **refused** before connecting (exit 3) |
| Missing or wrong `--confirm` | refused, nothing changed |
| `NODE_ENV=production` | refused |
| `start` with no UAT database / second `start` while running | refused |
| Reset of `pdabliss_core_uat` while the UAT stack runs | **refused** (found in testing: an idle pool left no session, so the guard now also checks the UAT backend itself) |
| Reset of a used clone (2,884 rows) | evidence dump written and verified first; content then identical to the baseline (70 tables); ledger zero |
| Evidence round-trip: restore that automatic evidence dump into `pdabliss_core_uat_restoretest` | **0 rows changed / removed / added** vs. the used clone before reset |
| `stop` with a pid file pointing at an unrelated live process | that process was **left alone** |
| Runner whose pid file was lost | found by its unique marker; `status` warns, `stop` ends it (added after testing) |
| Final hand-over | `pdabliss_core_uat` reset to the baseline after the last smoke test (pre-reset state, containing only EP42.2 verification sign-ins, kept as `pdabliss_core_uat-before-reset-20261110-114802.dump`); content identical to the baseline, ledger zero |

## 7. QA gates (Phase 8)

| Gate | Result |
| --- | --- |
| Backend tests | **519 / 519** (34 files, incl. the EP40 route-coverage security sweep and EP41 controls) |
| Frontend tests | **1,139 / 1,139** (61 files) |
| Backend typecheck · lint · format · build | pass · pass · pass · pass |
| Frontend typecheck · lint · format · build · prerender | pass · pass · pass · pass · 108 pages + 3 shells, each with its own head |
| Prisma validate · migrations | valid · 26 migrations applied to `pdabliss_core_uat` by `migrate deploy`; `start` checks `migrate status` = up to date |
| Real-stack E2E / additions / controls / inventory control / races | 120 / 203 / 23 / 41 / 54 rounds — all passing |
| Seed idempotency | second seed: 0 table-content changes |
| Inventory reconciliation | zero on baseline, after rehearsal, after every reset |
| Permission and privacy regressions | persona matrix 144, privacy endpoint checks, 41-check inventory suite, EP40 route sweep in the backend suite |
| UAT start / status / stop / health smoke | start ≈ 2–11 s; duplicate start refused; reset while running refused; `verify --api` PASS; `status` confirms the backend is connected to `pdabliss_core_uat`; stop frees 1211 / 1212 only (dev 1111 / 1112 still running) |
| Windows script safety | every destructive call sits behind `assertSafeTarget` or the runner check (static review); refusal matrix above; `uat\uat.cmd` runs from PowerShell and Command Prompt; scripts pass `node --check` and the project's Prettier style |
| Secret scan | clean — no connection string, password, cookie, token or key in the diff; every secret value in `backend/.env` checked by exact match |

## 8. Performance

No frontend or backend source changed in EP42.2 (only `uat/`, docs and README).

| Budget | EP42.1 | EP42.2 | Cap |
| --- | --- | --- | --- |
| All JS (raw) | 4,261.2 KiB | **4,261.2 KiB** (unchanged) | 4,300 |
| Initial JS (gzip) | 182.7 KiB | **182.7 KiB** (unchanged) | 205 |
| Static HTML (raw) | 526.9 KiB | **526.9 KiB** (111 / 111, unchanged) | 560 |

## 9. Startup procedure (for the owner)

```bash
uat\uat.cmd start --open
```

Sign in at <http://127.0.0.1:1211/login> with a demo account (password from `backend/.env`,
`DEMO_*_PASSWORD`), follow the test plan, record failures in the bug register, and stop with
`uat\uat.cmd stop`. Back up daily with `uat\uat.cmd backup --label dayN`; return to the baseline only
by choice with `uat\uat.cmd reset --confirm pdabliss_core_uat`.

## 10. Remaining limitations

- Product gaps and known issues K-01 … K-12 (bug register § 3), unchanged from EP42.1: production
  requires a BOM; one department per employee not enforced; BOM confidentiality; no dashboards /
  notifications; Accounting = deposits only.
- `doctor` names the program on a busy port only where Windows lets `netstat` / CIM show it.
- The baseline was seeded on 2026-11-10: lot FG-DEMO-B expires 2026-11-22 and a reset does not move
  dates. A fresh baseline would need a new `init` on a new database name (the tool never overwrites).
- Development database: the tool never connects to it. Its rows differ from the EP42.1 snapshot only
  in one `Session` row — the owner's own dev sign-in activity while the dev servers were running.
- Scratch databases created in EP42.1 / EP42.2 (`qa421`, `devcopy421`, `uat_rehearsal`, `uat_restoretest`) were dropped; backups were kept.
- Not re-run in EP42.2 (no frontend change since EP42.1's 918 / 918): the full 9-persona × 3-language ×
  6-width browser matrix; a real-browser sign-in smoke on the UAT stack was done instead.
- Production blockers from EP41 remain (infrastructure), unrelated to internal UAT.

## 11. Commit

`test: prepare isolated CORE full-system UAT sandbox (EP42.2)` — local only. Files: `uat/` (5),
`docs/EP42_2_*.md` (4), `README.md`. `.claude/launch.json` restored to its original content.
No schema, migration, dependency, backend, frontend, persona or seed change.
