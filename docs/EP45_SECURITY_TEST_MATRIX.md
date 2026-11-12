# EP45 — Security Test Matrix

Automated: `backend/test/ep45-department.test.ts` (23 tests, unit + database + the seeded demo world over the real
route table), the updated module suites, `frontend/src/features/company-center/admin.test.tsx` (EP45 blocks) and
`frontend/src/lib/api.test.ts`. Real stack: the EP45 regression script (113 checks) against the running backend on a
disposable migrated database (`EP45_FINAL_REPORT.md` §8). "Nothing changed" is proven by content hashes of every
non-session table before and after the refused calls.

| #   | Abuse case                                | How it is tested                                                                                                                                                                                                                                          | Expected                   | Result |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------ |
| A1  | Sales calls Warehouse mutations           | valid bodies: create / post receipt, dispatch, approve adjustment; plus every Warehouse state-changing route in the sweep                                                                                                                                 | 403 / 404, no state change | PASS   |
| A2  | Warehouse calls Purchasing                | issue PO, approve PR, raise PR "from Purchasing" (`DEPARTMENT_NOT_ALLOWED`); sweep                                                                                                                                                                        | 403 / 404, nothing written | PASS   |
| A3  | Purchasing calls Accounting mutations     | deposit confirm / waive; sweep                                                                                                                                                                                                                            | 403                        | PASS   |
| A4  | Production reaches commercial information | PO detail, SO detail, deposit queue; EP40 price-sentinel scan for Operations                                                                                                                                                                              | 403 / no sentinel          | PASS   |
| A5  | Executive posts documents                 | post receipt, confirm SO, approve MO; EP40 sweep of all 172 state-changing routes                                                                                                                                                                         | 403                        | PASS   |
| A6  | System Admin operational mutation         | receipt / SO / MO create; EP40 operational sweep; assignment refused (`ROLE_TAKES_NO_DEPARTMENT`)                                                                                                                                                         | 403 / 422                  | PASS   |
| A7  | Two department assignments                | API (`ONE_DEPARTMENT_ONLY`); direct SQL second row (unique index); resolver with two rows (fails closed, every role × pair)                                                                                                                               | refused / no access        | PASS   |
| A8  | Role inconsistent with department         | SQL assignment for Owner / System Admin / Executive (trigger); SQL role change keeping a department (trigger); API role change (`ROLE_DEPARTMENT_CONFLICT`); ALLOW outside the department (every code)                                                    | refused                    | PASS   |
| A9  | Cross-company department assignment       | SQL with another company's department (composite FK); SQL under another company (member FK); SQL move of an existing row; API with forged `departmentId` / `companyId` (400)                                                                              | refused                    | PASS   |
| A10 | Cross-branch resource access              | Warehouse (00001 only) selects / queries the Head Office; Accounting (00000) opens a 00001 order; module isolation suites                                                                                                                                 | 403 / 404                  | PASS   |
| A11 | Forged document ids                       | unknown id, an id of another document kind, another company's ids (EP40 sweep)                                                                                                                                                                            | 404, no leak               | PASS   |
| A12 | Forged department ids                     | `department` in a sales-order body (400), PR raised for another department (403), workspace gate and one-permission probe for another department (403), changing one's own department (403)                                                               | refused                    | PASS   |
| A13 | Stale permissions after reassignment      | same open session: department change, removal, role Staff → Viewer, DENY, branch scope change — each effective on the next request; the reassigned person sees no money on any Warehouse read; frontend re-reads the context on a stale-authorization 403 | immediate                  | PASS   |
| A14 | Membership deactivation                   | open session → `MEMBERSHIP_INACTIVE` on every request; reactivation restores                                                                                                                                                                              | immediate                  | PASS   |
| A15 | Company switching                         | no switching exists (one company per account); another company's branch → `BRANCH_NOT_FOUND`; `companyId` in a body → 400; `?companyId=` ignored                                                                                                          | refused                    | PASS   |
| A16 | Parallel department assignments           | 15 concurrent PUTs (five departments): exactly one row, audit chain consistent; 6 rounds of role change ↔ assignment races: never a System Admin with a department, never both succeed                                                                    | invariant holds            | PASS   |
| A17 | Reporting / summary endpoints             | no export route exists; each department's list / context / summary refused to other departments; sweep                                                                                                                                                    | 403                        | PASS   |
| A18 | Read-model data leakage                   | Warehouse personas: every GET route scanned for price sentinels and money keys (EP40 + EP45); real stack: pending pick, pick, shipment, pending receive, receipt, material-issue handoff, FG receipt                                                      | no money                   | PASS   |
| A19 | Owner override without a reason           | owner self-confirm without override (409), empty override / empty reason (400), non-owner override (`OVERRIDE_NOT_ALLOWED`); EP41 suite covers audit content                                                                                              | refused, nothing changed   | PASS   |
| A20 | Direct SQL integrity                      | second assignment, foreign department, non-department role, role change, pending invitation intent (CHECK), audit log UPDATE, posted receipt DELETE                                                                                                       | refused by the database    | PASS   |

## Sweep detail

`A1–A6 sweep` (EP45): for each department persona (Sales staff, Operations manager, Warehouse staff, legacy Warehouse
staff, Purchasing manager, Accounting manager) every state-changing route of **another** department and every
`/company/current/*` administration route is called with that persona's session: no 2xx, no 5xx, > 600 calls,

> 40 % answered by the authorization check itself (403; the rest fail input validation first), and the content
> hash of every business table is unchanged afterwards.

## Regression of earlier controls (unchanged, still passing)

EP40 sweeps (anonymous, cross-site Origin, another company, Executive, System Admin, department money privacy, input
abuse), EP41 separation of duties and history immutability, EP26 branch access, EP27 exceptions.

## Owner acceptance (human UAT) — NOT TESTED

New owner test cases `DP-01 … DP-08` were added to `EP42_2_OWNER_TEST_PLAN.md`; they stay **NOT TESTED** until the
owner runs them.
