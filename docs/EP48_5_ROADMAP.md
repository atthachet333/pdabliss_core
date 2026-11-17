# PDA BLISS CORE — Roadmap (revised 2026-11-17)

The full feature history (EP20 … EP48) is in `README.md` → "Roadmap". This file records the owner's revised delivery order of 2026-11-17 (20:45). It is kept in `docs/` so that a release containing it stays inside the EP48.5 release scope (`docs/EP48_5_*`), which the preflight (W-check) and the G0 runner enforce. Merge it into `README.md` when a release may touch files outside that scope.

## Revised delivery order

| # | Phase      | Goal                                                                                                                                                                                                          | Status                          |
| - | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1 | **EP48.5** | **Minimum Safe Online Deployment:** `core.pdabliss.com`, tester-only behind Cloudflare Access, demo data, application code `cb21be1` in production mode on S2A-SERVER (isolated database and services). Plan: `EP48_5_ONLINE_DEPLOYMENT_PLAN.md` | plan ready; awaiting O0         |
| 2 | **EP48.6** | **Guard, Security Hardening and Production Readiness:**<br>• full environment qualification (G0 has **not** passed yet);<br>• production profile and database;<br>• off-machine backups;<br>• web hardening;<br>• onboarding controls;<br>• security review.<br>Required before any commercial customer (plan §3.2, C1–C8). | after EP48.5 sign-off           |
| 3 | **EP49**   | Notifications & Work Queues                                                                                                                                                                                   | after EP48.6                    |
| 4 | **EP50**   | Supplier RFQ & Quotation                                                                                                                                                                                      |                                 |
| 5 | **EP50.1** | SEO Enhancement, in the separate **`pdablissv2`** repository                                                                                                                                                  |                                 |

New feature development (EP49 onward) does not start before EP48.6 is complete.

## Status (2026-11-17)

| Step                       | Status                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| EP48.5 O0 readiness        | done (`EP48_5_O0_REPORT.md`)                                                              |
| EP48.5 O1 tooling          | implemented, local commit; Windows verification pending (`EP48_5_O1_REPORT.md` §3)       |
| EP48.5 O2 … O8             | each needs separate authorization; O2 proposal in `EP48_5_O1_REPORT.md` §5               |
| EP48.6                     | after EP48.5 sign-off; includes full G0 (C1, `-ExpectOps 155`)                            |
