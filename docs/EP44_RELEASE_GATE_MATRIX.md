# EP44 — Release Gate Matrix

Three separate milestones, three separate verdicts. Evidence: `EP44_PRODUCTION_READINESS_AUDIT.md`,
`EP44_FINAL_REPORT.md`, EP40–EP43 reports.

| Milestone                                                                       | Verdict   |
| ------------------------------------------------------------------------------- | --------- |
| **A. Internal demo** — PDA BLISS staff keep testing in the isolated UAT sandbox | **PASS**  |
| **B. Controlled customer pilot** — a few external customers, test or real data  | **BLOCK** |
| **C. Public commercial production** — self-registration, paid, open             | **BLOCK** |

## A. Internal demo — PASS

**Evidence:**

- The UAT sandbox is isolated: `127.0.0.1:1211/1212`, `pdabliss_core_uat`, with backup, reset and restore tooling
  (EP42.2). Its data is unchanged by EP44 (content hashes).
- Automated QA is green:
  - backend full suite and frontend 1,159 / 1,159;
  - ops tool tests 21 / 21;
  - real-stack regression 51 / 51 as the least-privilege runtime;
  - privacy, immutability and ledger checks 0.
- Demo personas only; no customer data; internal network.

**Conditions:**

- Keep it on `127.0.0.1` (not exposed).
- Back up before each test day (`uat backup`).
- Human UAT results go into the EP42.2 test plan and bug register.

## B. Controlled customer pilot — BLOCK

| #    | Missing requirement                                                      | Risk                                                                    | Owner action                                                             | Technical prerequisites                                  | Verification to close                                                                                                  |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| B-1  | Production host identified and audited (H1–H10)                          | unknown capacity, collisions with S2, exposure                          | name the host, grant read-only access for the audit                      | the checklist in audit §2                                | an audit document like EP43's, for that host                                                                           |
| B-2  | CORE runs as the `postgres` superuser                                    | a compromised app could bypass history triggers or reach S2's databases | approve role creation on the shared cluster (a cluster-wide object)      | activation plan Phase 2                                  | the `ownershipAudit` reports 0; the 17 forbidden operations are refused on the host; a smoke test passes               |
| B-3  | No scheduled, verified backups in production                             | data loss                                                               | approve the schedule and the backup volume                               | Task Scheduler entries (plan Phase 4)                    | 7 consecutive daily VERIFIED manifests; the monitor's `backup:production` stays ok                                     |
| B-4  | No off-machine copy                                                      | host loss = total loss                                                  | choose: an encrypted external disk / NAS (the existing S2 NAS?)          | plan Phase 4                                             | a restore **from the off-machine copy** into scratch → VERIFIED                                                        |
| B-5  | No process supervisor / restart after reboot; no backend log rotation    | outage after reboot; disk fill                                          | choose: PM2 (already used for S2) or a Windows service                   | plan Phase 3                                             | a reboot drill: CORE ready ≤ 5 min after boot; logs rotate                                                             |
| B-6  | HTTPS edge + `TRUST_PROXY=loopback` not verified through the real tunnel | wrong IPs, shared rate limit, cookies fail without HTTPS                | approve a **new** tunnel hostname (do not change S2's)                   | plan Phase 5                                             | a request through the tunnel logs the real client IP; a spoofed `X-Forwarded-For` is ignored; sign-in works over HTTPS |
| B-7  | Real e-mail delivery (sign-in codes) and alert e-mail                    | users cannot sign in                                                    | provide SMTP account / credentials                                       | `SMTP_*` env, alert recipients                           | a sign-in code is received; a test alert is received                                                                   |
| B-8  | Human UAT not done (119 cases NOT TESTED)                                | unknown usability and workflow defects                                  | execute the test plan; accept or list blockers                           | —                                                        | the test plan marked; no open P0 / P1                                                                                  |
| B-9  | Single-department enforcement absent                                     | a misconfigured member gets cross-department rights                     | decide: build enforcement (EP) **or** PDA staff administer pilot members | a server rule (one department for staff / manager roles) | a test refusing multi-department staff                                                                                 |
| B-10 | Optional BOM not supported                                               | a pilot customer without recipes cannot produce                         | pick a pilot customer that uses BOMs, **or** build the no-BOM mode       | —                                                        | a production order approved without a BOM (if built)                                                                   |
| B-11 | PDPA: privacy notice, processing agreement, retention periods            | legal exposure with real personal data                                  | legal review; decide retention (B11)                                     | documented retention / deletion procedure                | a signed pilot agreement                                                                                               |

**Path to PASS:**

- B-1 … B-8 are mandatory.
- B-9 and B-10 can be closed by a **pilot scoping decision** instead of code.
- B-11 is mandatory with real data; with test data only, it is advisable.

## C. Public commercial production — BLOCK

Everything in B, plus:

| #    | Missing requirement                                                                | Risk                                  | Owner action              | Technical prerequisites                    | Verification                                              |
| ---- | ---------------------------------------------------------------------------------- | ------------------------------------- | ------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| C-1  | Billing / payment (subscriptions start PENDING; activation is manual and dev-only) | no revenue, manual bottleneck         | choose a payment provider | integration, invoices, dunning             | an end-to-end paid sign-up in staging                     |
| C-2  | Confidential recipe controls (BOM visible company-wide)                            | customers' recipes exposed internally | approve the design        | per-BOM access / masking                   | permission tests                                          |
| C-3  | Single-department enforcement (code, not scoping)                                  | as B-9 at scale                       | —                         | as B-9                                     | tests                                                     |
| C-4  | Optional BOM (code)                                                                | lost customers                        | —                         | no-BOM mode                                | tests + UAT                                               |
| C-5  | Production-scale load test on the host class + 24 h soak                           | outages under load                    | approve a test window     | the capacity plan (audit §7)               | thresholds met                                            |
| C-6  | Independent security review / penetration test                                     | unknown vulnerabilities               | engage a reviewer         | —                                          | report with no open high findings                         |
| C-7  | PITR (if RPO < 24 h is promised) + documented SLA                                  | data-loss exposure vs promise         | decide RPO / SLA          | WAL archiving on a capacity-planned target | a PITR restore drill                                      |
| C-8  | Monitoring with external alerting (e-mail / LINE), on-call owner                   | incidents unnoticed                   | name an on-call           | alert adapters wired                       | test alerts delivered; dedup verified                     |
| C-9  | Terms of service, PDPA notices, support process, storage limits enforcement        | legal / operational                   | legal + product           | —                                          | published documents                                       |
| C-10 | PDA ONE accounting integration                                                     | —                                     | product decision          | —                                          | **future feature, not a blocker** unless sold as included |
