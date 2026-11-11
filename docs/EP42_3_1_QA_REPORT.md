# EP42.3.1 — QA Stabilization & Full Regression Closure — Report

**Baseline:** `449fdf8` (EP42.3) on `main`, clean; the EP42.3 Sales row-field fix is present
(`backend/test/sales-orders.test.ts` lists `summary`). **Result:** one local commit. Not pushed, not
deployed, no database reset. EP42.4 not started.

**Verdict: PASS.** The full backend suite passes (**523 / 523**). The full frontend suite passed
**6 of 6** consecutive complete runs (**1,152 / 1,152** each): 2 normal, 2 under 12 CPU-burner
threads and 2 under 16, on a 12-core machine. Before the fixes it failed in every constrained run.

No test was skipped, quarantined, deleted or loosened, and no timeout was raised. All three
intermittent failure modes had a concrete cause: one real product defect, one test-isolation leak
and one time-anchored test fixture. Each is reproduced deterministically by a new test that fails
on the old code and passes on the new.

## 1. The failures

| Run | Code | Failed tests (exact) |
| --- | --- | --- |
| EP42.3 full run 1 | `449fdf8` | `company-center.test.tsx` › Company Control Center overview (EP25) › *speaks Thai, English and Simplified Chinese without Thai leaking into EN / ZH* — `Unable to find role="heading" and name "What needs attention"` · `production.test.tsx` › Production planning (EP36) › *order list: filters are server-side query parameters; rows show status and material readiness* — `expected { materials: 'SHORT', page: '1', … } to match object { status: 'APPROVED', … }` |
| EP42.3 full run 2 | `449fdf8` | `login.test.tsx` › real sign-in (EP23) › *resend waits for its countdown* — `Unable to find role="button" and name /ส่งรหัสใหม่ได้ใน \d+ วินาที/` · the same production test, same assertion |
| EP42.2 baseline full run | `029e76d` (temporary worktree) | `auth.test.tsx` › invitation acceptance › *keeps the token through sign-in, then accepts it…* · `company-center.test.tsx` › *answers company, package, departments, counts, setup and attention for the owner* · `platform.test.tsx` › Platform overview › *speaks English and Chinese* · `login.test.tsx` › *resend waits for its countdown* (+ `profile-parity.test.ts` could not resolve `zod` — the worktree had no backend `node_modules`; an artefact of that worktree, not of the suite) |
| EP42.3.1 pre-fix, normal | `449fdf8` + race fix | `auth.test.tsx` › invitation acceptance (DOM: *โหลดข้อมูลบัญชีไม่สำเร็จ — เชื่อมต่อระบบไม่ได้*) |
| EP42.3.1 pre-fix, 12 burners | same | `company-center.test.tsx` › speaks Thai, English…; `login.test.tsx` › resend waits for its countdown |

The failing tests rotated between runs, and the untouched EP42.2 code failed the same family. Each
of these tests passed when its file ran alone. So the failures were not caused by the EP42.3
features, but they were real defects in the code under test and in the suite.

## 2. Root causes and fixes

### A. Filters lost on a quick second change — a real product defect (Sales, Production)

*Failure mode:* the last list request carried the second filter only (`materials=SHORT`, no
`status`).

*Cause:* React Router 8.5.0 builds the next URL from the `searchParams` of the **last render**,
including in its function form. The source is in
`node_modules/react-router/dist/development/lib/dom/lib.js` (`useSearchParams`). Both lists rebuilt
the URL from render-time values. A second filter change made before the router re-rendered (a quick
second click, a slow device, a loaded test worker) therefore started from stale params and
**dropped the first filter**. Users could hit this: the Sales status dropdown and the "short of
stock" checkbox each rewrote both filters.

*Fix:* `useUrlFilters()` in `frontend/src/features/warehouse/whModel.ts` builds each change on its
own still-pending result until the router has rendered it. It is used by the Production order list
and the Sales order list. Sales' controls now change only their own filter; a count tile still sets
both filters, as before.

*Deterministic reproduction:* two new tests change both filters in the same tick with `fireEvent`:
- `production.test.tsx` › *two filter changes before the list re-renders keep both filters*
- `sales.test.tsx` › *two filters changed in one tick are both sent and both shown*

Each fails on the old code with the original assertion message and passes now. Real stack (browser,
UAT clone): both lists keep both filters in the URL, in the controls and in the request
(`status=CONFIRMED&availability=SHORTAGE`, `status=APPROVED&materials=SHORT`).

### B. Identity leaking from one test into the next — test isolation (all signed-in pages)

*Failure mode:* the next test's page opened directly on **"The service could not be reached / Try
again"** (Thai: *โหลดข้อมูลบัญชีไม่สำเร็จ — เชื่อมต่อระบบไม่ได้*). The page's own wait then ran out
looking for its heading. This was visible in the failure DOM dumps, and it covers the Control
Center, invitation and platform failures.

*Cause:* Vitest 5.0.5 runs `afterEach` hooks in **reverse** registration order (default
`sequence.hooks: 'stack'`). In `src/test/setup.ts` the offline `fetch` stub and the identity reset
therefore ran **before** `cleanup()` unmounted the finished test's page. A page that was still
finishing async work could mount in that window; on a loaded machine this was typically a lazy
route chunk that resolved late. It found the module-level identity `idle`, asked `/auth/me` through
the offline stub and stored `status: 'error'`. The next test then inherited that state. A sibling
path: an `/auth/me` answer that arrived after the reset was also written into the next test.

*Fix:*
- `setup.ts` now has **one** `afterEach` with an explicit order: `cleanup()` first, then the
  localStorage clear, then offline `fetch` and the identity reset.
- `features/auth/session.ts`: `resetIdentityForTests()` bumps a generation, and a refresh started
  before a reset no longer writes its answer. The app's behaviour is unchanged, because the
  generation moves only in the test reset.

*Deterministic reproduction:* new `src/test/isolation.test.tsx`.
- *an answer to a request made before a reset is not kept* fails on the old code (`expected
  { status: 'ready', … } to deeply equal { status: 'idle' }`) and passes now.
- The mount-between-hooks path cannot be forced in jsdom: React renders on a macrotask that the hook
  sequence normally does not yield to. Its guard test ("a test ends while its page is still loading"
  → the next test starts idle and offline) documents the contract. The evidence for this path is the
  repeat runs: the "could not be reached" signature appeared in every constrained pre-fix run and in
  **none** of the 10 post-fix runs.

### C. A countdown fixture dated when the file loaded — time-anchored test data (login)

*Failure mode:* the OTP step was on screen, but the button already read **"ส่งรหัสใหม่"** (Resend)
instead of "ส่งรหัสใหม่ได้ใน N วินาที" (Resend in N seconds).

*Cause:* `login.test.tsx` computed `resendAvailableAt = Date.now() + 60 s` **once, at file load**.
Under load the file reached *resend waits for its countdown* more than 60 s later. The window had
really passed, and the login page correctly offered Resend.

*Fix:* `otpRequired()` is now a fake-API handler that dates the challenge **when it answers** (the
server's behaviour). No other test file computes dates at load time (searched).

*Deterministic reproduction:* new *the resend countdown runs from the server answer, however late in
the run it comes* starts with the clock 61 s past file load (`vi.useFakeTimers({ toFake: ['Date'] })`).
It fails with the old fixture (same message as the intermittent failure) and passes now.

## 3. Repeatability

| Run (full frontend suite) | CPU contention | Result |
| --- | --- | --- |
| pre-fix normal | — | 1 failed (B) |
| pre-fix | 12 burners | 2 failed (B, C) |
| A + B fixed, normal ×2 | — | clean ×2 |
| A + B fixed, 12 burners ×2 | 12 burners | 1 failed each (C only) |
| **final, normal ×2** | — | **1,152 / 1,152 ×2** |
| **final, 12 burners ×2** | 12 burner threads | **1,152 / 1,152 ×2** |
| **final, 16 burners ×2** | 16 burner threads (12 cores) | **1,152 / 1,152 ×2** |

The "could not be reached" signature appeared in 0 of the 10 post-fix runs. Test count: 1,146 →
1,152 (6 new tests: 3 isolation, 1 Production, 1 Sales, 1 login).

## 4. Gates

| Gate | Result |
| --- | --- |
| Backend tests (local PostgreSQL 18, `pdabliss_core_test`) | **523 / 523**, 35 files, full run |
| Frontend tests | 6 consecutive clean full runs (§3) |
| Typecheck · ESLint · Prettier (both packages) | pass · pass · pass |
| Build + prerender + verify-prerender | pass — 108 pages + 3 shells |
| Performance budget | within budget — all JS **4,273.1 / 4,300 KiB** (+0.2: `useUrlFilters`); initial JS **182.7 / 205 KiB gzip**; static HTML **526.9 / 560 KiB**, 111 / 111 files; initial CSS 50.8 / 52 |
| Real-stack cross-department regression (fresh UAT clone `pdabliss_core_uat_ep423`, ports 2111 / 2112) | **46 / 46**; ledger reconciliation 0 / 0 / 0 after Sales, Production and at the end |
| Permission & Warehouse financial privacy | backend privacy tests in the 523; on the real stack, Warehouse pick / pending-receive / receipt / stock / shipment / finished-goods responses carry **no money keys**; staff refusals (confirm, allocate, dispatch, deliver, post) and Executive / System Admin refusals pass |
| UAT and Dev databases | read-only content hashes taken before any work and at the end: **`pdabliss_core_uat` 0 / 71 tables differ, `pdabliss_core_dev` 0 / 71 tables differ**; UAT has 0 sessions, ledger 0 violations. The UAT stack was not started; nothing was reset. |
| Secret scan | no cookie, credentialed connection string, API key or private key in the changes. The only hit is the fake `PASSWORD` constant in `login.test.tsx`, which predates this episode. |

## 5. Remaining limitations

- **Platform Company Explorer** (`features/platform/CompanyExplorer.tsx`) uses the function form of
  `setSearchParams`, which has the same last-render staleness (cause A). No test failed there and it
  is outside CORE, so it was left unchanged; it should move to the same pattern in a later episode.
- The mount-between-teardown-hooks path (B) is evidenced by the repeat runs, not by a deterministic
  test (see §2.B).
- The temporary EP42.2 baseline worktree lacked backend `node_modules`, so `profile-parity.test.ts`
  could not run there. This only affects that comparison run; the main tree runs it.
- The disposable `pdabliss_core_uat_ep423` copy still exists (re-cloned from UAT for this run); it
  can be dropped at any time.
- Human UAT: still NOT STARTED.

## 6. Commit

`test: stabilize CORE full regression suite (EP42.3.1)` — local only.
