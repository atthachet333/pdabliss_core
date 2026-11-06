# EP40 — Senior Security, Concurrency, Stress & Reliability Audit — Final Report

**Baseline:** `4d20f68` (EP39; `main` = `origin/main`, clean). **Result:** a local commit —
not pushed, not deployed; EP41 not started.

**Verdict: PASS (development-stage audit).** No P0 or P1 finding. The three P2 defects found
were fixed with regression tests. One P2 business-policy gap (separation of duties) stays open
by design and **blocks production release**. This PASS does **not** approve a production
deployment.

Detail: [Findings register](EP40_FINDINGS_REGISTER.md) ·
[Security audit](EP40_SECURITY_AUDIT.md) · [Stress & concurrency](EP40_STRESS_REPORT.md) ·
[Reliability](EP40_RELIABILITY_REPORT.md).

## What changed in code

| File | Change |
| --- | --- |
| `backend/src/config/env.ts` | Without an explicit `NODE_ENV` the demo surface is forced off (EP40-01) |
| `backend/src/auth/bootstrap.ts` | The demo seed refuses without an explicit non-production `NODE_ENV` (EP40-01) |
| `backend/src/sales/service.ts`, `production/service.ts`, `warehouse/documents.ts` | A removed working branch is never silently replaced on create (EP40-02) |
| `backend/src/app.ts` | A NUL in a URL → `400 INVALID_CHARACTERS`, not a 500 (EP40-03) |
| `backend/test/ep40-security.test.ts` (new) | Route-table sweeps (anonymous, cross-site, cross-company, Executive, System Admin), money-privacy sentinels, credential leakage, input abuse, revocation, replay, demo bypass |
| `backend/test/ep40-rollback.test.ts` (new) | Fault injection inside six posting / approval transactions |
| `backend/test/foundation`, `auth-bootstrap` | Fail-closed env and seed |
| 7 backend suites | Timestamp-safe privacy assertions (EP40-10) |

No frontend code, schema, migration, dependency, authentication or mail change. Performance caps
are unchanged.

## Results

| Area | Result |
| --- | --- |
| Baseline (before changes) | backend 485 / 485; frontend 1,122 / 1,122 (EP39 run on the identical tree), build, prerender and perf within budget |
| Attack surface | 285 routes from the live route table (172 state-changing, 18 public) |
| Authentication / sessions | hashed tokens, idle and absolute expiry, rotation, revocation, generic errors, throttling, OTP lockout — existing suites green; replay after logout refused (new) |
| Demo bypass | refused in production, for other addresses and by headers; **fail-closed without `NODE_ENV`** (fixed) |
| Revocation mid-session | DENY exception, branch removal, membership deactivation, account suspension — all effective on the next request |
| Company isolation | second company with the first one's ids on every route: no 2xx on id routes, no id leaked |
| Branch isolation | cross-branch refused; revocation enforced; **no silent branch move** (fixed) |
| BOLA / BFLA | anonymous 401 everywhere; Executive never writes; System Admin never operates; foreign Origin 403 on all 172 writes |
| Mass assignment | strict body schemas everywhere; server-owned fields refused |
| Department privacy | Warehouse sees no price / cost / total / deposit on any route; Sales, Operations, Purchasing and Accounting see no foreign-department prices (sentinel scan) |
| Audit / redaction | no password, token or code in any response or log |
| Ledger | one canonical writer; DB-unique (source line, type); movements immutable by trigger; **0 mismatches** at every stage |
| Shared reservations | `0 ≤ Sales + Production reserved ≤ on hand` per identity, at every check |
| Concurrency | 18 scenarios × 5 rounds = 90 rounds: 0 failing, 0 HTTP 5xx, 0 timeouts |
| Deadlocks / rollback | ordered locks; conflicts → 409 with nothing written; no retry; 6 / 6 injected failures rolled back completely |
| Database constraints | 88 CHECK, 250 FK (composite company / branch), non-negative balances, unique lots, posted-document guards |
| Backup / restore | identical rows (9,279) and schema; ledger clean; workflow suite 115 / 115 on the restored copy |
| Migrations | no drift (fresh chain and dev database); checksums consistent |
| Load (local, dev mode) | 33,137 requests, 0 errors. Reads p95 28 / 92 / 210 / 428 ms at 1 / 10 / 25 / 50 clients (≈ 215 req/s peak); writes p95 64–166 ms; CPU ≤ 57 %; backend RSS flat ≈ 660 MB; 11 DB connections |
| Dependencies | runtime: 0 vulnerabilities; dev toolchain: 10 moderate (ESLint `minimatch`), accepted |
| Browser security | CSP `default-src 'none'`, nosniff, frame-ancestors none, CORS allow-list, HttpOnly cookies, no client tokens, no source maps |
| Secrets | none tracked |
| Real-stack regression (EP39 suite) | 115 / 115 on the restored database |
| Demo personas / seed | 9 personas unchanged; the seed runs idempotently; the dev database is untouched by EP40 (0 rows changed) |
| Browser QA | **828 / 828** — 9 personas × 46 screens × TH / EN / ZH × 390 / 768 / 1024 / 1280 / 1440 / 1920 |
| Error resilience | unknown document → "not found" message; forbidden workspace → permission message; forged session → sign-in with the page kept (`next`); server down → "could not be loaded" with **Try again** |
| Performance | all JS 4,249.1 / 4,300 KiB · initial JS 182.7 / 205 KiB gzip · static HTML 526.9 / 560 KiB · headroom ≈ 50.9 KiB |

Final gates (backend and frontend tests after the last change) are recorded in the commit message.

## Coverage limits

- Accessibility used:
  - the custom DOM checks (headings, labels, target sizes, duplicate ids, focus order of the
    drawer and dialogs);
  - the existing keyboard and focus tests.

  No axe or pa11y engine is installed (none was added, to avoid a dependency). A small gap was
  seen: the "not found" and "no permission" states show a message without a page heading (P3).
- Load figures are a single development-mode process on a shared desktop, not production
  capacity.
- External penetration testing, TLS / edge configuration and email deliverability are outside a
  local audit.

## Production-readiness blockers (unchanged by a development-stage PASS)

1. **Separation of duties** (EP40-04): introduce a company `approvalPolicy` and refuse
   self-approval of consequential documents, with an audited owner override.
2. Production infrastructure:
   - a built, supervised server;
   - TLS and edge headers for the static frontend;
   - database backups, point-in-time recovery and monitoring.
3. Database immutability for `AuditLog` and posted warehouse documents (EP40-06), and a database
   role without `DELETE` on history tables.
4. A deployment configuration that sets `NODE_ENV=production` and the production secrets. With
   `NODE_ENV=production` the server refuses to start without the database, app URL, secret and
   SMTP settings.
5. Load and capacity testing on production-like hardware; an external security review.
6. The Accounting scope (no invoices, receivables or ledger yet).

## Recommendations for EP41

1. Separation-of-duties policy and its migration (register EP40-04).
2. Immutability triggers for `AuditLog`, `GoodsReceipt`, `InventoryTransfer`, `StockAdjustment`
   and `CycleCount` once posted (EP40-06).
3. A client request timeout mapped to the network-error message (EP40-07).
4. A page heading on the not-found and permission states.
5. Upgrade the ESLint toolchain when convenient (EP40-08).
6. Keep `ep40-security` as a gate: any new route is swept automatically.
