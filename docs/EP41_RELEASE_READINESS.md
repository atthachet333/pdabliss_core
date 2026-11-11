# EP41 Release Readiness — what exists, what an operator must still provide

Status as of EP41 (2026-11-09). This is a **checklist**, not an implementation.
- Nothing below has been deployed.
- **No backup, monitoring, alerting or log-retention system exists yet** in this repository or
  on any server.
- Items marked **Operator** must be built, configured and verified on the target infrastructure
  before a production release.

> **EP43 update (2026-11-11):** the infrastructure foundation now exists in `ops/` and is verified
> on disposable environments — see [CORE_OPERATIONS_HANDBOOK.md](CORE_OPERATIONS_HANDBOOK.md) and
> [EP43_FINAL_REPORT.md](EP43_FINAL_REPORT.md). Status per section below:
>
> | § | EP43 status |
> | --- | --- |
> | 1 Production configuration | fail-closed startup re-verified; trust-proxy for the tunnel still open (B6) |
> | 2 Backups and verified restore | **tooling verified** (backup, 7-check restore verification, scratch restore, GFS retention); production schedule and off-machine copy not active (B3, B4) |
> | 3 Migration and rollback | procedure in the handbook §7–8; migrations proven to run as a non-superuser owner |
> | 4 Monitoring and alerts | readiness endpoint + monitor + storage alerts verified; email / LINE not active (B8) |
> | 5 Log retention and redaction | redaction verified; ops logs rotate; backend log rotation needs the supervisor (B5) |
> | 6 Data retention | decisions listed in `EP43_MONITORING_DESIGN.md` §6 (B11) |
> | 7 Incident response | 12-scenario runbook `EP43_DISASTER_RECOVERY_RUNBOOK.md` |
> | 8 Load testing | unchanged (not done) |
> | 9 Independent security review | unchanged (not done) |
> | Least-privilege database role | **designed and verified on a disposable cluster** (17/17 forbidden operations refused, 51/51 regression as `core_app`); not applied to any persistent server (B2) |

Legend:
- **In code** — implemented and tested in this repository.
- **Documented** — the procedure is written down, never exercised on production.
- **Operator** — not started; needs infrastructure work.

## 1. Production environment configuration

| Item | State | Notes |
| --- | --- | --- |
| `NODE_ENV=production` | In code (fail-closed) | Turns on `Secure` / `__Host-` cookies and the production variable checks, and refuses the dev mail sink. Since EP40 the demo surface stays off unless `NODE_ENV` is set explicitly (EP40-01). **Must** be set by the deployment. |
| Required variables | In code | The server refuses to start in production without `DATABASE_URL`, `PUBLIC_APP_URL`, `AUTH_SECRET` (not the development value) and `SMTP_HOST`, and with the dev mail transport. `SMTP_USER` / `SMTP_PASSWORD` are needed by most SMTP relays but are not checked. |
| `ENABLE_DEMO_ROUTES` | In code | Must be unset or `false` in production; the demo seed refuses `NODE_ENV=production`. |
| `CORS_ORIGINS` | In code | Exactly the public app origin(s); the Origin check protects every state-changing route (EP40: 172 routes). |
| `RATE_LIMIT_MAX` / `_WINDOW` | In code | Defaults 300 / minute; tune per deployment. QA used a raised limit on a scratch stack only. |
| Secrets storage | **Operator** | Secrets live only in the host's secret store or environment, never in Git (the EP41 secret scan of the diff is clean). |
| Runtime database role | **Operator** | Run the API as a role with DML only, not the table owner: no DDL, no `TRUNCATE`, no `ALTER TABLE … DISABLE TRIGGER`. The EP41 immutability triggers stop the application role, not the owner. Migrations run as a separate owner role. |
| Approval policy | In code | New companies start with `INDEPENDENT_APPROVAL`, existing ones keep `SELF_APPROVAL_ALLOWED` until the owner switches (`EP41_APPROVAL_POLICY.md`). Decide per customer at onboarding. |

## 2. PostgreSQL backups and a verified restore

| Item | State |
| --- | --- |
| Logical backup procedure | Documented, rehearsed locally only. EP40 and EP41 took `pg_dump -Fc` of the development database, checked it with `pg_restore --list` (71 table-data entries), restored it into a scratch database and migrated that copy. |
| Scheduled backups (frequency, retention, encryption, off-host copy) | **Operator** |
| Point-in-time recovery (WAL archiving) | **Operator** — decide the RPO / RTO first. |
| Restore drill on production-sized data, timed | **Operator** — a backup counts only once a restore has been verified: row counts, ledger checks zero, and a login. |

## 3. Migration and rollback procedure

| Item | State |
| --- | --- |
| Forward migration | Documented. `npm --prefix backend run db:migrate` (`prisma migrate deploy`) runs the 26 migrations. EP41 adds two: a column with a default, and triggers. Both are additive. Rehearsed on a restored copy of the development database: 0 rows changed, no drift (`migrate diff` reports no difference). |
| Order | Documented. Take a backup → migrate → deploy the API → deploy the frontend. The EP41 API needs the EP41 schema (it reads `Company.approvalPolicy`). |
| Rollback | Documented, not automated. Prisma has no down-migrations. Roll back by restoring the pre-migration backup, or by hand: drop the EP41 triggers and functions, then the column and enum. Note that a restore loses writes made after the backup. |
| Zero-downtime | **Operator** — not designed. Plan a short maintenance window. |

## 4. Monitoring and alerts

**Operator** — nothing is in place. Minimum:
- uptime of `/health`;
- 5xx rate and p95 latency per route group;
- database connections against the pool;
- disk usage;
- failed-login and rate-limit spikes;
- mail delivery failures;
- migration status.

EP40/EP41 measured local baselines only (`EP40_STRESS_REPORT.md`). They are not production
capacity numbers.

## 5. Log retention and redaction

| Item | State |
| --- | --- |
| Redaction | In code. Request bodies are never logged; `authorization`, `cookie` and `set-cookie` are redacted (`backend/src/app.ts`). Audit entries store no passwords, codes or tokens. |
| Retention period, storage, access control, deletion | **Operator** — choose a retention period consistent with Thai PDPA and the customer contracts. |

## 6. Data retention decisions

**Operator / owner decision** — not decided:
- how long to keep audit entries, sessions, invitation records and closed business documents;
- what happens to a closed company's data.

Since EP41, `AuditLog` and posted warehouse history cannot be deleted or changed by the
application role. Any retention purge must be a controlled, owner-role procedure with its own
audit record.

## 7. Incident response

**Operator** — not written. It needs:
- an owner and on-call contact;
- severity levels;
- the first steps for a suspected credential leak:
  - revoke sessions (EP40 verified that revocation works);
  - rotate SMTP credentials and database passwords;
  - rotate `AUTH_SECRET`, which keys one-time codes and e-mail subject hashes (check its effect
    on pending codes first);
- customer notification (PDPA, 72 hours);
- the order for restoring from backup.

## 8. Production-like load testing

**Operator.** EP40/EP41 ran bounded load on a laptop against a scratch database, in development
mode:
- 50 concurrent readers: about 190 requests/s, p95 about 470 ms;
- write stages ran with 0 errors and no invariant broken.

A production-like test needs:
- the production build;
- a production-sized database;
- the real network path and TLS;
- the agreed concurrency targets.

## 9. Independent security review

**Operator.** EP40 was an internal audit:
- 285-route sweeps, isolation, CSRF/Origin, privacy and races (`EP40_SECURITY_AUDIT.md`);
- no P0/P1 found.

An external penetration test and a review of the deployment (TLS, headers, the database role,
secrets) are still required before go-live.

## 10. Accounting scope

Current scope:
- Accounting can read and confirm purchase-order **deposits** (EP30/EP39).
- There is no general ledger, invoicing, payment reconciliation, tax reporting or period close.
- The EP41 approval policy does not check deposit confirmation, which is documented as an
  explicit exception.

Selling CORE as an accounting system needs its own episode(s).

## 11. Release verdict input (EP41)

| Gate | EP41 result |
| --- | --- |
| Business controls (SoD + override) | In code, tested, verified on the real stack |
| History immutability | In code, tested, upgrade path verified |
| Client timeouts / no automatic write retries | In code, tested |
| Accessible error pages | In code, tested in the browser (TH / EN / ZH, 6 widths) |
| Dependency advisories | 0 in both packages |
| Items 1–10 above marked **Operator** | **Open.** They block a *production* release, but not continued development or UAT on a non-production stack. |
