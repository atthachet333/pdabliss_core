# EP48.5 — G0 run 3 readiness amendment (C-A0.4)

**Status:** G0 **BLOCK**. Another Full G0 requires separate owner approval.

**Basis:**
- Release `9d3776e` (C-A0.3a).
- Windows harness P1–P10 PASS and preflight W1–W9 PASS.
- Run-2 termination evidence (`ops-logs/incident-g0-20261117-161805/termination-evidence-20261117-195208.txt`) inconclusive.

Scope: EP48.5 tooling, tests and documentation only. No change under `backend/` or `frontend/`. Nothing pushed or deployed. No change to PM2, PostgreSQL, MariaDB, Cloudflare, the firewall, Windows services or scheduled tasks.

## 1. What the run-2 termination evidence shows

| Source                                          | Result                                                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows PowerShell 400/403/600                  | 86 events. Monitor rounds (`g0-facts.ps1 -Scope full`) and the collector, plus `powershell.exe -c gwmi win32_process -Filter 'ProcessId=…'` every 30 s, which is PM2's process-usage polling (read-only). |
| The facts round started 16:25:44.455            | **No engine-stop (403) event.** That PowerShell ended abruptly together with the monitor, which places the termination within about 0.5 s after 16:25:44.455.                                            |
| PowerShell 4103/4104, Security 4688/4689, Sysmon | Not enabled / not installed, so process creation and termination are not recorded.                                                                                                                       |
| Application, Defender, System, Task Scheduler   | No events in the window.                                                                                                                                                                                 |
| `.codex` files changed 16:20–16:30              | 2 sandbox files at 16:27:28–29 (after the event). No kill command was found in them.                                                                                                                     |

**The actor is still not identified.** Windows did not record it. Hence the three changes below:
1. production preservation that no longer depends on the monitor surviving;
2. an exact P7 test manifest;
3. owner-run agent isolation before run 3.

## 2. Architecture corrections

### 2.1 Production HTTP preservation, owned by the runner (`g0-supervisor.mjs i5-check`)

**Before:** the monitor alone compared production after G0. If it died (run 2), there was no I5 at all. The collector runs with `-NoHttpProbe`, so its success never was HTTP evidence.

**Now:**
- **Established baseline, version 3.** The monitor's `baseline.json` (taken at G0 start; G0 refuses an invalid one) now also records **`portOwners`**: for every production port, the owning process identity (`PID@start time`). The same builder is used by the read-only `baseline` command.
- **`Run-G0.ps1 -ExpectHttpEndpoints <n>` is required.** G0 stops at start unless the baseline covers exactly `n` endpoints. Run 2's baseline had 21.
- **Runner-owned I5 at shutdown, in every outcome.** After the temporary PostgreSQL is stopped and the monitor has ended (or died), `Complete-G0` runs `i5-check` as a bounded final phase. It:
  - re-probes **every** baseline endpoint, loopback only, `GET /`, exactly as the monitor does;
  - re-asks a differing status up to 3 times, 1 s apart, keeping every answer;
  - compares each endpoint's **status** and **owning process identity**;
  - compares the PM2 tree, PostgreSQL, MariaDB, cloudflared and the production listeners.
- **Verdicts:**

  | Verdict      | Meaning                                                              |
  | ------------ | -------------------------------------------------------------------- |
  | `PASS`       | everything is identical and every expected endpoint was checked      |
  | `FAIL`       | a change is proven                                                   |
  | `INCOMPLETE` | facts are missing, an endpoint was not probed, or the count is wrong |
  | `MISSING`    | there is no usable baseline or no expected count                     |

  Exit 0 only on PASS. Written to `g0\i5-after.json`.
- **Gates.** G0 can only be **PASS** if every phase passed **and** the monitor's final I5 is present **and** the runner-owned HTTP preservation is `PASS`. The summary prints `PRODUCTION HTTP PRESERVATION: <verdict> - <checked> of <expected> …` and `COLLECTOR AFTER: … not HTTP-preservation evidence`.
- **How G0 ended.** `census-at-end.json` is taken at every shutdown. It records:
  - **monitor end**: `normal`, `terminated-externally` (exit 0xFFFFFFFF and no exit line), `ended-without-exit-handler`, `signal`, `invalid-baseline` or `ended-itself`;
  - **who raised STOP**: runner, monitor, or other (owner or an outside process);
  - the G0 processes still alive;
  - any development agent alive.

  The census now reports the last **work** step, never a shutdown phase.

### 2.2 P7 exact test manifest (`ops/ep48_5/g0-test-manifest.mjs`)

**Before:** P7 globbed `ops/test/*.test.mjs` and accepted `pass = tests`, so a suite that silently stopped running would still pass.

**Now:**
- The manifest lists each file with its exact count, and the excluded files with a reason.
- P7 runs **exactly** these files with a second `node --test` reporter that records each test's file. `check` requires, **per file**, the exact count, all passed and 0 fail / skipped / todo / cancelled.
- It also requires:
  - no test from an unlisted file;
  - every `ops/test/*.test.mjs` either listed or excluded;
  - the TAP summary agreeing;
  - 0 non-loopback attempts.
- A suite that fails to load shows up as a failure of that file.

**A Node test pins the manifest to the repository:**
- the file lists match;
- the total equals the sum;
- the static `test(` count of each file equals its manifest count (so a count change must be made in the same commit);
- no skip / todo / only in a P7 suite.

**Counts (justified):**

| File                       | Before | Now | Reason                                     |
| -------------------------- | -----: | --: | ------------------------------------------ |
| g0-guard.test.mjs          |     18 |  18 | —                                          |
| g0-loopback.test.mjs       |      4 |   4 | —                                          |
| g0-preflight.test.mjs      |      6 |   9 | +3 manifest tests                          |
| g0-supervisor.test.mjs     |     27 |  37 | +10 run-3 readiness (R15–R15j)             |
| staging-launch.test.mjs    |     40 |  40 | —                                          |
| **P7 total**               | **95** | **108** |                                        |

- **Excluded from P7, with reasons:** `ops.test.mjs` (EP43; needs the backend's dependencies) and `staging-launch.g0.test.mjs` (T10; only inside G0). Both run in G0 `ops-tests`.
- **G0 ops expectation:** EP48.5 109 (P7's 108 + T10) + EP43 21 = **130** (previously 117).

### 2.3 Development-agent isolation (`g0-supervisor.mjs isolation`, `g0-harness/g0-tasks.ps1`)

**Read-only. Nothing is ever stopped.**

- **Production is identified first and is never classified as an agent:** the PM2 daemons and their trees, the shared postmaster tree, MariaDB and cloudflared.
- **Agents → BLOCK** (with every descendant): OpenAI Codex (`codex*.exe`, `codex-command-runner`, `cua_node`, `.codex` paths), Claude desktop / Claude Code, GitHub Copilot, Gemini CLI, Cursor, Windsurf, Continue and aider.
- **REVIEW items for the owner:**
  - IDEs (VS Code, Visual Studio, JetBrains);
  - runtimes outside production (`node`, `python`, `bun`, `deno`, `pwsh`, `powershell`);
  - non-Microsoft scheduled tasks running or due in the next 180 min.
- **Also BLOCK:** a due scheduled task whose action stops processes (`Stop-Process`, `taskkill`, `tskill`, `pskill`, `kill -9`, `killall`, `pkill`, `.Kill(`) or drives an agent.
- **Command lines** are redacted (connection strings, password / token values) and cut to 300 characters.
- **The runner enforces it:**
  - It requires `-AgentIsolationConfirmed`.
  - It runs `isolation-check` (read-only) before anything else and **stops on BLOCK**. The report is kept as `g0\isolation-at-start.json`.

The preflight (C2, `checkRunner`) now refuses a runner without these items:
- the runner-owned I5 as a final phase after the temporary PostgreSQL is stopped;
- the HTTP and monitor-final gates before PASS;
- the collector labelled as not HTTP evidence;
- `census-at-end`;
- the endpoint-count check;
- the isolation check before the first step, and `-AgentIsolationConfirmed`.

## 3. Owner checklist — agent isolation before G0 run 3 (read-only; the owner acts, G0 never does)

**Never** terminate processes by executable name (`taskkill /IM node.exe`, `Stop-Process -Name node`): the production PM2 apps run as `node.exe`. **Never** touch PM2, PostgreSQL, MariaDB, cloudflared or any production app.

1. **Pick a window** with no production deployments, no PM2 restarts and no maintenance planned. Plan about 2 hours.
2. **Run the report**, elevated, read-only:
   ```powershell
   cd D:\S2A_PROJECT\pdabliss_core
   node ops\ep48_5\g0-supervisor.mjs isolation --out ops-logs\ep48_5-g0\isolation-before-run3.json
   ```
   Review `status` and the lists `agents`, `blockingTasks`, `review` and `reviewTasks`. Check that `production` names the PM2 daemon and the postmaster you expect.
3. **Pause every agent through its own interface:**
   - quit the Codex app / CLI sessions;
   - quit the Claude desktop app and any Claude Code session (this also disconnects Claude's device bridge — expected);
   - stop Copilot agent / chat sessions or close the IDE;
   - quit Gemini CLI, Cursor, Windsurf, Continue and aider.

   If an agent cannot be closed through its UI, do not start G0. Never kill it by name.
4. **Review runtimes outside production.** For each `node` / `python` / `powershell` / `pwsh` process in `review`, decide whether it is yours (a dev server, a watcher). Stop your own through the terminal that started it (Ctrl+C). Leave unknown processes alone and note them; do not start G0 if you cannot account for one.
5. **Scheduled tasks.** A `blockingTasks` entry (a task that stops processes, due in the window) means: choose another window. Changing or disabling tasks is an owner decision outside G0. For `reviewTasks`, decide whether each may run during G0 (e.g. a NAS backup) and note it.
6. **Optional, owner decision (a Windows audit-policy change, not made by G0):** enable "Audit Process Creation" with command lines for the window, so a repeated termination can be attributed (Security 4688/4689). Restore it afterwards. Read-only check: `auditpol /get /subcategory:"Process Creation"`.
7. **Re-run step 2.** `status` must be `CLEAR`, or `REVIEW` with every item accepted and written down. `BLOCK` means do not start.
8. **Run the harness and preflight** (§4), then, within 30 minutes and only with the separate G0 authorization, run G0 with `-AgentIsolationConfirmed`. The runner repeats the check and refuses on BLOCK.
9. **During G0:** do not reopen agents, start new sessions or restart services. Keep the elevated console open.
10. **After G0:** resume your agents. Keep `isolation-before-run3.json` with the G0 evidence.

## 4. New Windows harness and preflight requirements

`Test-G0Harness.ps1`, elevated: **P1–P12 must all PASS.**
- **P7 (changed):** exactly the manifest — 108 tests in 5 files, per file, with 0 fail / skipped / todo / cancelled and 0 non-loopback attempts.
- **P11 (new):** runner-owned I5 on the real host, read-only (loopback `GET /` only, as the monitor):
  - a fresh baseline followed by an unchanged host gives **PASS** on every endpoint;
  - an altered status / owner gives **FAIL**;
  - a missing baseline gives **MISSING**.

  It reports the number of production endpoints. **The owner confirms it is 21** (or states the new number) before choosing `-ExpectHttpEndpoints`.
- **P12 (new):** the isolation report is produced and never classifies production as an agent. Its status is reported for the owner, not required.

`Preflight-G0.ps1 -Release <C-A0.4 sha>` must PASS (W1–W9, including the new C2 runner checks).

**G0 run 3 command, only after separate approval:**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\S2A_PROJECT\pdabliss_core\ops\ep48_5\g0-harness\Run-G0.ps1 -Release <C-A0.4 sha> -ExpectOps 130 -ExpectHttpEndpoints 21 -AgentIsolationConfirmed
```

## 5. Remaining risks

- **Run 2's terminator is unknown.** Isolation removes known agents but cannot exclude an unknown actor. Without process-creation auditing (step 6), a repeat would again be visible only through the census, the exit code and the PowerShell engine log.
- **Agent detection is pattern-based.** An unknown agent appears only as a "runtime outside production" review item, so the owner's review (step 4) is essential.
- **A legitimate production change during the window FAILs I5 and stops G0** (fail closed). That includes a PM2 restart, an app crash and restart, or a deployment. The owner then decides.
- **I5 checks `GET /`** status and process identity per endpoint, like the monitor. It does not test application behaviour beyond that.
- **The new Windows-only parts are not yet verified on Windows.** That covers the PowerShell 5.1 code, the reporter under Windows Node 24, `g0-tasks.ps1` and the real-host I5. They are covered by static checks and Linux tests only, until harness P7, P11 and P12 and the preflight run on S2A-SERVER.

> **Updated by O1 (2026-11-17):** the test counts changed with the O1 tooling (`docs/EP48_5_O1_REPORT.md` §2). P7 = **133** in 7 files, G0 `-ExpectOps` = **155**. Full G0 is now C1 (EP48.6); the command above takes `-ExpectOps 155`.
