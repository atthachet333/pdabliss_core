# EP40 Findings Register

Every finding below was reproduced with executable evidence (a test, a real-stack script or a
database query), not inferred from documentation. Severities follow the EP40 brief (P0 critical
→ P3 low). Fix files are in the EP40 commit; "suite" names refer to `backend/test/*.test.ts`.

| ID | Severity | Module / endpoint | Finding | Status |
| --- | --- | --- | --- | --- |
| EP40-01 | P2 | configuration (`src/config/env.ts`, demo seed) | Demo surface fails open when `NODE_ENV` is missing | Fixed |
| EP40-02 | P2 | Sales, Production, Warehouse create paths | A removed working branch is silently replaced by the member's only branch | Fixed |
| EP40-03 | P2 | all list / detail routes (path and query) | A NUL character in the URL causes HTTP 500 | Fixed |
| EP40-04 | P2 (policy) · **production blocker** | every approve / post / confirm step | No separation of duties: the originator may approve their own document | Open by policy — EP41 proposal |
| EP40-05 | P3 | `GET /purchase-requests`, `/purchase-requests/context` | Answer 200 (empty) to a member with no Purchasing role, where other modules answer 403 | Accepted (no data) |
| EP40-06 | P3 | database | `AuditLog` and posted goods receipts / transfers / adjustments / counts have no database-level immutability trigger | Recommendation |
| EP40-07 | P3 | frontend `src/lib/api.ts` | No client-side request timeout (a hung server leaves a spinner) | Recommendation |
| EP40-08 | P3 | dev tooling | 10 moderate advisories in the ESLint toolchain (`minimatch` ReDoS), dev-only | Accepted |
| EP40-10 | P3 | backend test suites | Timestamp-sensitive "no money" assertions (a bare `370` matched `…32.370Z`) — flaky, not a leak | Fixed |
| EP40-11 | P3 | frontend error states | "Not found" and "no permission" states show a message without a page heading (h1) | Recommendation |
| EP40-09 | Info | deployment | Cookie `Secure` / `__Host-` prefix and the production checks depend on `NODE_ENV=production` | Documented |

No P0 or P1 finding was found. Earlier episodes' P1 (EP39 movement list) stays fixed and is
covered by the EP40 sweeps.

## EP40-01 — Demo surface fails open when `NODE_ENV` is missing (P2, fixed)

- **Evidence:** `parseEnv({})` returned `ENABLE_DEMO_ROUTES: true` (the old foundation test
  asserted exactly that); the demo seed accepted an environment without `NODE_ENV`.
- **Impact:** a host that forgot `NODE_ENV` would expose the mock demo routes, the persona list
  and the sign-in bypass (still password-checked, still restricted to the nine demo addresses of
  a seeded `isDemo` company), and the seed would accept demo data. Requires a misconfiguration;
  no default deployment does this.
- **Root cause:** `NODE_ENV` defaults to `development`, and the demo flag derives from it.
- **Fix:** without an explicit `NODE_ENV`, `ENABLE_DEMO_ROUTES` is forced off, whatever else is
  set (`src/config/env.ts`). The demo seed refuses without an explicit non-production `NODE_ENV`
  (`src/auth/bootstrap.ts`). The local `.env` and `.env.example` already set it, so local work is
  unchanged.
- **Regression tests:**
  - `foundation`: "EP40: without an explicit NODE_ENV the demo surface stays off";
  - `auth-bootstrap`: the seed refuses without `NODE_ENV`;
  - `ep40-security`: the bypass is refused in production, for other addresses and via headers.
- **Verification:** suites pass.
- **Residual risk:** none for the demo surface. Other defaults (dev mail sink, non-Secure
  cookies) still apply without `NODE_ENV`; see EP40-09.

## EP40-02 — Silent working-branch replacement on create (P2, fixed)

- **Evidence:** race scenario 16 (`qa-ep40-races`):
  1. `sales.demo` selects branch `00001`.
  2. An administrator removes `00001` from its branch access.
  3. The next "new sales order" was created at Head Office `00000`, which the person never chose.
- **Impact:** a document lands in the wrong branch without the user noticing. Not an
  authorization bypass: the person may work in `00000`. It is a business-control defect.
- **Root cause:** the Sales, Production and Warehouse (adjustment / count) services used "the
  selected branch, else the member's only branch" even when a *different* branch had been
  selected. The shared operations context (purchase requests) already refused it.
- **Fix:** the one-branch fallback now applies only when no branch was ever chosen. A stale choice
  answers `409 BRANCH_SELECTION_REQUIRED`. Files: `src/sales/service.ts`,
  `src/production/service.ts`, `src/warehouse/documents.ts`.
- **Regression tests:**
  - `ep40-security` "an open session loses what an administrator takes away";
  - race 16: 5/5 rounds, 409 or created in `00001` — never `00000`.
- **Verification:** suites and races pass.
- **Residual risk:** the read-only contexts still show the remaining branch (by design, visibly).

## EP40-03 — NUL character in a path or query → HTTP 500 (P2, fixed)

- **Evidence:** `GET …?q=%00` and `GET …/orders/ab%00cd` answered 500 on every module probed
  (master data, sales, warehouse, purchasing, production). JSON bodies were already refused
  (400).
- **Impact:** any signed-in user could trigger unhandled server errors. The response was generic,
  with no data disclosure and no write.
- **Root cause:** PostgreSQL text cannot hold `\0`. The search and path parameter schemas did not
  refuse control characters.
- **Fix:** one early request hook (`src/app.ts`) refuses a NUL anywhere in the URL with
  `400 INVALID_CHARACTERS`, before authentication or any database call.
- **Regression test:** `ep40-security` "input abuse is refused as a 4xx".
- **Verification:** passes.
- **Residual risk:** none known.

## EP40-04 — No separation of duties (P2 policy; production release blocker)

- **Evidence:** the audit trail of a freshly seeded database:

  | Step | Same actor as creator |
  | --- | --- |
  | Production order approved | 7 / 7 |
  | Sales order confirmed | 14 / 16 |
  | Purchase order issued | 6 / 6 |
  | Output accepted | 3 / 3 |
  | Finished goods posted | 3 / 3 |
  | Material issue posted | 3 / 3 |
  | Adjustment approved | 2 / 4 |

  No policy in `src/*/policy.ts` compares the approver with the originator. The exceptions are
  member administration (`SELF_CHANGE`) and the EP29 rule, which is documented explicitly.
- **Classification:** not an authorization bypass (every step requires its approve / manage
  permission), and it is the documented v1 policy (EP29 `purchasing/policy.ts`: "no
  separation-of-duties rule in v1"). It is a **material business-control weakness for production
  use**. Following the EP40 brief, the approval policy was not changed silently: changing it
  would break existing single-manager workflows, including the demo flows.
- **EP41 proposal (migration-safe):**
  1. A company setting `approvalPolicy` (`ALLOW_SELF` default for existing companies;
     `REQUIRE_SECOND_PERSON` recommended for new ones).
  2. With `REQUIRE_SECOND_PERSON`, every consequential decision is refused with
     `409 SELF_APPROVAL_NOT_ALLOWED` when the decider created, requested or last submitted the
     document. This covers PR and PO decisions, adjustment, transfer and count posting, sales
     confirmation, production approval, output acceptance, finished-goods posting and
     completion.
  3. An owner override that is explicit, reason-required and audited as `SELF_APPROVAL_OVERRIDE`.
  4. Activity shows self-approvals.
  5. Tests per action, plus a demo persona pair for each control.
- **Residual risk until then:** one manager can raise and approve their own purchasing,
  inventory and production documents (fully audited).

## EP40-05 — Purchase-request list is 200 (empty) for non-Purchasing members (P3, accepted)

- **Evidence:** the System Admin sweep: `GET /purchase-requests` and `/purchase-requests/context`
  answer 200, where other operational modules answer 403.
- **Impact:** none. The list contains only the caller's own requests (none), and the context
  contains capability flags and the branches the System Admin already administers.
- **Status:** accepted. The sweep asserts "2xx only when no record is exposed". Making it 403
  would change the EP29 contract (anyone may follow their own requests).

## EP40-06 — No database-level immutability for some history (P3, recommendation)

- **Evidence:** immutability triggers exist for `StockMovement` (UPDATE / DELETE blocked) and for
  production / fulfilment documents. None exist for `AuditLog` or for posted `GoodsReceipt`,
  `InventoryTransfer`, `StockAdjustment` and `CycleCount` rows.
- **Impact:** application code never updates or deletes them (grep-verified), but a database user
  with write rights could.
- **Recommendation (EP41 or the infrastructure episode):**
  - add `_immutable` triggers in the same style;
  - run the application with a role that has no `DELETE` on history tables.

## EP40-07 — No client request timeout (P3, recommendation)

`apiRequest` has no `AbortSignal.timeout`. A hung API leaves the screen loading until the browser
gives up. Network failure and server errors already show a message (verified in the browser).
Recommendation: a 30 s default timeout mapped to the existing network-error copy.

## EP40-08 — Dev-only dependency advisories (P3, accepted)

`npm audit` reports 10 moderate advisories in each package, all through `eslint`,
`typescript-eslint` and `minimatch` (glob ReDoS). `npm audit --omit=dev` reports
**0 vulnerabilities** for backend and frontend. There is no runtime exposure, and the fix is a
toolchain major upgrade, deferred to avoid churn.

## EP40-09 — Production cookie and safety flags depend on `NODE_ENV` (info, documented)

`Secure` and `__Host-` cookies, the required production variables (DB, `PUBLIC_APP_URL`,
`AUTH_SECRET`, SMTP) and the refusal of the dev mail sink all key on `NODE_ENV=production`. Any
deployment guide must set it; EP40-01 already makes the demo surface independent of the default.

## EP40-10 — Timestamp-sensitive privacy assertions (P3, fixed)

- **Evidence:** the final full-suite run failed once in `sales-fulfilment`. Its `not.toMatch(/…|370|…/)`
  matched `"packedAt":"…07:22:32.370Z"`, a timestamp and not a price. Seven suites used bare
  sentinel numbers (`185`, `370`, `777`, `999`, `42.5`, `9.99`); EP39 had fixed one such case.
- **Impact:** about a 1-in-1000 false failure per assertion; no product defect.
- **Fix:** each sentinel is matched only as a standalone number
  (`(?<![\w.])370(\.0+)?(?![\w.])`), which catches it as a JSON string or number but not inside
  a timestamp or an id. Files: `sales-fulfilment`, `sales-allocation`, `sales-orders`,
  `warehouse`, `production`, `production-output`, `demo-personas` tests.
- **Verification:** the 7 suites pass 115/115. The pattern was checked against a string price, a
  numeric price, a timestamp and a cuid.

## Non-findings (tested, no defect)

- **Isolation:**
  - Company: a second company, with the first company’s record ids on all 285 routes — no 2xx
    on an id route and no id leaked in any response.
  - Branch: revocation is effective on the next request, and branch spoofing is refused.
- **Function-level authorization:**
  - anonymous visitors get 401 on every non-public route;
  - every state-changing route refuses a foreign Origin;
  - Executive has no successful write;
  - System Admin has no operational access.
- **Privacy:** Warehouse receives no price, cost, total or deposit on any route. Sentinel prices
  never reached Sales (purchase prices), Operations (either), Purchasing (sales prices) or
  Accounting (sales prices).
- **Credentials:** no password hash, session token or one-time code in any response.
- **Ledger:** one canonical writer (`applyMovement`). Every decrease is reservation-guarded.
  Movements are DB-immutable, with DB-unique (source line, type) pairs. There are 0 mismatches at
  every stage.
- **Concurrency:** 18 race scenarios × 5 rounds — 0 failing rounds, 0 HTTP 5xx, 0 timeouts.
- **Rollback:** 6 injected failures inside real transactions, with no partial effect.
- **Reliability:** backup → restore gives identical rows (9,279) and schema, ledger integrity is
  clean, and the workflow suite passes 115/115 on the restored copy.
- **Migrations:** no drift (fresh chain and dev database), and checksums are consistent.
