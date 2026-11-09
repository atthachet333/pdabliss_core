# EP41 — Business Controls, Data Integrity & Release Hardening — Final Report

**Baseline:** `45da89c` (EP40), resumed from the WIP checkpoint `76dc8d1` (pushed before EP41
resumed). **Result:** one local commit. Not pushed, not deployed. EP42 not started.

**Verdict: PASS (development stage).**
- Every EP41 gate passed.
- EP40-04 (separation of duties, the production blocker) is resolved, as are EP40-06, -07, -08
  and -11.
- Production release is still gated by the **infrastructure** items in
  [EP41_RELEASE_READINESS.md](EP41_RELEASE_READINESS.md): backups and restore drills,
  monitoring, the runtime DB role, incident response and an external security review. Nothing
  here claims those exist.

Detail:
- [Approval policy](EP41_APPROVAL_POLICY.md)
- [Release readiness](EP41_RELEASE_READINESS.md)
- [Findings register](EP40_FINDINGS_REGISTER.md) (EP41 resolutions inline)
- [Permission matrix § EP41](PERMISSION_ACTION_MATRIX.md)
- [Inventory ledger § EP41](INVENTORY_LEDGER.md)
- [Demo workflow guide](DEMO_WORKFLOW_GUIDE.md)

## 1. Completed work

### Separation of duties with an audited owner override (EP40-04)

- `Company.approvalPolicy` takes two values:
  - `SELF_APPROVAL_ALLOWED` — the DB default; existing companies keep it.
  - `INDEPENDENT_APPROVAL` — the default for new companies and for a freshly seeded demo
    company.
- **One check** in `backend/src/company/approval.ts` covers all nine decisions:
  - PR approve and PO issue;
  - sales confirm;
  - adjustment approve and count post;
  - production approve, material-issue post and output accept;
  - FG receipt post.
- **How it runs:**
  - inside each decision's transaction;
  - after the unchanged permission, branch and status checks;
  - it never grants anything.
- **Owner override:**
  - `ownerOverride: { reason }`, with a reason of 10–500 characters and no control characters;
  - owner only (`403 OVERRIDE_NOT_ALLOWED` otherwise);
  - refused when not needed (`400 OVERRIDE_NOT_NEEDED`);
  - audited as `SELF_APPROVAL_OVERRIDE` in the same transaction: actor, reason, time, branch,
    document type, id and number, decision, and the roles the owner held.
- **Policy changes:** owner only (`403 OWNER_ONLY`), audited as `APPROVAL_POLICY_CHANGED`. The
  setting is in Control Center → Settings → *Document approval*.
- **No loops:** the owner can always decide. Historical documents are never touched.
- **UI:**
  - CORE registers one handler: a 409 that the owner may override opens a lazily loaded,
    accessible **Owner override** dialog, which then sends the same request **once more** with
    the reason;
  - Activity shows the override with its document number, branch and reason;
  - TH / EN / ZH throughout.

### Database immutability (EP40-06)

- `AuditLog` is append-only.
- Posted, cancelled or rejected goods receipts, transfers, adjustments and cycle counts are
  frozen, together with their lines, allocations and locations.
- The POSTED → CANCELLED reversal may set only its cancellation fields.
- `StockMovement` has stayed immutable since EP31.

### Client timeouts, no automatic retries (EP40-07)

- `apiRequest` bounds every call at 30 s, reported as `TIMEOUT` ("outcome unknown").
- The caller's abort stays an `AbortError`, and an unreachable service is `NETWORK_ERROR`.
- Nothing is retried automatically; the only second send is the owner-confirmed override.

### Accessible 403 / 404 / unavailable pages (EP40-11)

- A shared `PageError` gives every page-level load error in CORE and the Control Center (37
  sites in 27 files, including the CORE frame) one `h1` naming the case, the message, a way back and a link
  home.
- The deep link and branch recovery are preserved, as verified in the browser.

### Dependency maintenance (EP40-08)

- A `minimatch` 11.0.5 override in both packages takes `npm audit` from 10 moderate advisories
  to **0**.
- The toolchain is otherwise unchanged, and lint coverage is identical.

### Supporting fixes found by EP41's own tests

| Fix | Problem it solved |
| --- | --- |
| `warehouse/control-demo.ts` posts a header after its lines (EP41-01) | The new child guards refused the old order |
| Development seed decisions (`scope: 'seed'`) are treated as history | A later seed run can complete fixtures on an independent-approval demo company |
| Decision routes keep their pre-EP41 body handling | Production routes stay strict (mass assignment); the others still ignore extra keys |
| The override dialog sends focus to `main` when its opener is gone | Focus fell back to `<body>` |

## 2. Files

| Area | Files |
| --- | --- |
| Schema | `prisma/schema.prisma`; migrations `20261111090000_ep41_approval_policy`, `20261111090100_ep41_history_immutability` |
| Policy core | `src/company/approval.ts` (new), `audit.ts`, `control.ts`, `input.ts`, `service.ts`; `src/auth/bootstrap.ts` |
| Decisions | `purchasing/service.ts`, `order-service.ts`; `sales/service.ts`; `warehouse/adjustments.ts`, `counts.ts`; `production/service.ts`, `issues.ts`, `output.ts`, `receipts.ts`, `input.ts`; routes `purchase-requests`, `purchase-orders`, `sales`, `warehouse`, `production` |
| Seed | `warehouse/control-demo.ts` |
| Frontend | `lib/api.ts`; `company-center/OwnerOverrideDialog.tsx` (new), `CoreArea.tsx`, `parts.tsx` (`PageError`), `SettingsPage.tsx`, `SecurityPage.tsx`, `api.ts`, `copy.ts`; 25 more area/page files converted to `PageError` |
| Tests | `backend/test/ep41-controls.test.ts` (new); `ep40-rollback`, `demo-personas`, `company-control` adjusted; `frontend/src/lib/api.test.ts` (new), `OwnerOverrideDialog.test.tsx` (new), `company-center`, `coreNav`, `permissions` tests extended |
| Tooling | `backend/package.json` + lock, `frontend/package.json` + lock (`overrides.minimatch`) |
| Docs | this report, `EP41_APPROVAL_POLICY.md`, `EP41_RELEASE_READINESS.md`; updated `EP40_FINDINGS_REGISTER.md`, `PERMISSION_ACTION_MATRIX.md`, `INVENTORY_LEDGER.md`, `DEMO_WORKFLOW_GUIDE.md`, `PERFORMANCE.md`, `README.md` |

No authentication, mail or role-default change. No demo persona permission changed.

## 3. Test results

| Gate | Result |
| --- | --- |
| Backend tests | **519 / 519** (34 files; was 485 at EP40). New: `ep41-controls` covers the 9 decisions, the override, the policy setting and DB immutability |
| Frontend tests | **1,139 / 1,139** (61 files; was 1,122). New: timeout/abort/network, the override retry and cancel, the dialog's keyboard and focus, CORE frame wiring, `PageError`, the settings policy UI, override details in Activity |
| Typecheck / lint / format | Clean in both packages |
| Build / prerender | Pass. 108 pages + 3 shells carry their own head |
| Prisma | `validate` passes. A fresh database applies 26 migrations. `migrate diff` reports no difference (fresh database and upgraded copy) |
| Upgrade path | A restored copy of `pdabliss_core_dev` was migrated: 0 rows changed, removed or added (70 tables). The guards refuse SQL changes to its existing history. A re-seed is `unchanged` and the policy stays `SELF_APPROVAL_ALLOWED` |
| Real-stack E2E (9 personas, fresh seed, independent approval) | **120 / 120**: Purchasing, Sales, Sales→Production, Production, Production→Sales, Shortage→Receipt, Executive, System Admin, Accounting, Warehouse privacy (14), Security (9), Races (13), Integrity (10). It includes 5 new SoD refusals |
| EP41 real-stack controls | **23 / 23**. Policy owner-only (System Admin `403 OWNER_ONLY`, Executive refused). Every override records the owner, reason, branch, number, decision and roles. **346 decisions** were made after the policy switch: 0 self-decisions without an override, 54 explicit overrides. SQL UPDATE / DELETE is refused on `AuditLog` and on posted receipts, transfers, adjustments, counts, their lines and `StockMovement`. Drafts are still editable |
| Security and permissions regression | The EP40 285-route sweep (anonymous, foreign Origin on 172 writes, cross-company, Executive read-only, System Admin no operations, money sentinels) passes unchanged. Cross-branch isolation passes in the E2E |
| Warehouse financial privacy | E2E 14 / 14; browser: Warehouse and staff screens show no money in TH / EN / ZH at every width |
| Races / load | Races: 18 scenarios × 3 rounds, 0 failing rounds, 0 HTTP 5xx. Load: every request 2xx, invariants intact (50 concurrent readers at about 190 req/s, p95 471 ms; write stages p95 ≤ 137 ms) |
| Seed idempotency | Seed 2 reports `unchanged` everywhere. A row snapshot before and after seed 3 shows **0** changed, removed or added rows (70 tables, 669 rows) |
| Ledger reconciliation | The 10 checks are 0 after the E2E, races and load, on the upgraded copy, and on `pdabliss_core_dev` after migration |
| Browser QA (TH / EN / ZH × 390, 768, 1024, 1280, 1440, 1920) | **918 / 918** across all 9 personas: one h1, no overflow, labelled controls, targets ≥ 24 px, unique ids, no API errors, privacy. It includes the settings page and the 404 pages (Sales, Purchasing, Production). The first run found an unconverted production-detail error page, which is now fixed |
| Keyboard / screen reader (real browser) | The Owner override dialog: `role=dialog`, `aria-modal`, labelled and described. Focus starts in the reason field, Tab stays inside, Escape cancels with nothing decided, focus returns to the opener or to `main`. Confirm is disabled until 10 characters. The override posted the adjustment and appears in Activity. 404: the h1 names the case, plus "Go back" and the CORE home link; the deep link survives the branch choice |
| Dependency audit | `npm audit`: 0 vulnerabilities (backend and frontend) |
| Secret scan | The full `45da89c..working tree` diff is clean |
| Test-run note | Two full frontend runs that shared the CPU with the backend suite or the browser QA each had one heading lookup time out (a different test each time; each file passes alone). The final run on a quiet machine was 1,139 / 1,139 |

## 4. Performance

| Budget | EP40 | EP41 | Cap |
| --- | --- | --- | --- |
| All JS (raw) | 4,249.1 KiB | **4,260.9 KiB** (+11.8) | 4,300 |
| Initial JS (gzip) | 182.7 KiB | **182.7 KiB** | 205 |
| Static HTML (raw) | 526.9 KiB | **526.9 KiB** (111 / 111 files) | 560 |
| Initial CSS (gzip) | 50.6 KiB | 50.6 KiB | 52 |

The Owner override dialog is its own lazy chunk. No cap was changed, and about 39 KiB of JS
headroom remains (`PERFORMANCE.md`).

## 5. Data safety (what was and was not touched)

- **`pdabliss_core_dev`:**
  - backed up twice with `pg_dump -Fc`, verified with `pg_restore --list` (71 table-data
    entries);
  - the migration was rehearsed on a restored copy (`pdabliss_core_up41`);
  - then the two additive EP41 migrations were applied: **0 rows changed, removed or added**
    across 70 tables, no drift, ledger checks zero;
  - its demo company **stays `SELF_APPROVAL_ALLOWED`**; the owner switches it in Settings for
    UAT (demo guide).
  - Nothing was reset, truncated or dropped.
- **Destructive and concurrency tests** ran only on scratch databases: `pdabliss_core_ep41_test`,
  `pdabliss_core_qa41`, `pdabliss_core_up41` and `pdabliss_core_ep41mig`.
- **Unchanged:** demo personas and their permissions, existing migrations, business documents,
  `EP37-backup.bundle` (still ignored) and the `ep29up` worktree.

## 6. Remaining risks

| Risk | Severity | Note |
| --- | --- | --- |
| Infrastructure items (backups/restore drill, monitoring, runtime DB role, log retention, incident response, production-like load test, external security review) | **Production blocker** | `EP41_RELEASE_READINESS.md`; none exists yet |
| The table owner can `TRUNCATE` or disable triggers | P3 | Needs the least-privilege runtime role |
| A `User` / `Company` with audit history cannot be deleted | Info | By design now; no app path deletes them |
| Policy scope excludes transfers, completion, fulfilment and deposits | Info (owner decision D) | Documented; can be extended deliberately |
| Existing companies stay on self-approval until their owner switches | Info (owner decision B) | Including the dev demo company |
| Timeout of a write = outcome unknown | Info | The UI says so; the user reloads to see the real state (no automatic retry, by design) |
| Accounting is deposits only | Scope | No GL, invoicing or tax |

## 7. EP42

EP42 may begin once the owner has reviewed this commit. There is no development blocker; the
production blockers above are infrastructure work, not code debt. EP42 was **not** started.
