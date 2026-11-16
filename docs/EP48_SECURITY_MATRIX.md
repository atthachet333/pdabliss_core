# EP48 — Security Matrix

Enforcement: `backend/src/executive/service.ts` (`scope`), the EP27/EP45 resolver (`memberPermissions`), EP26 branch
access (`allowedActiveBranches`), strict response schemas (`backend/src/executive/view.ts`). The frontend is never the
boundary. No new permission code; no write, export or download route.

## 1. Access

| Person                                                               | `GET /executive/overview`      | `GET /executive/documents/:kind/:id`                                                   |
| -------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Company Owner                                                        | 200 (every enabled department) | 200 within company + branches                                                          |
| Executive (`executive.overview.view`)                                | 200, `readOnly: true`          | 200 within company + branches; never a DRAFT purchase order (as the Purchasing module) |
| Executive with a DENY on `executive.overview.view`                   | 403 on the next request        | 403                                                                                    |
| System Admin                                                         | 403                            | 403                                                                                    |
| Department Manager / Staff / Viewer (incl. the Executive department) | 403                            | 403                                                                                    |
| Unassigned                                                           | 403                            | 403                                                                                    |
| Signed out                                                           | 401                            | 401                                                                                    |

## 2. Phase 12 negative tests

| #   | Case                                 | Test (backend/test/ep48-executive.test.ts)                                                                                                            | Result |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Executive transactional mutations    | S1/S2: POST sales order, adjustment as Executive → 403; any POST/PUT/PATCH/DELETE on `/executive/*` → 404                                             | PASS   |
| 2   | Executive approval attempts          | S1/S2: confirm SO, approve PR, approve MO, reserve materials → 403; business-table hash unchanged                                                     | PASS   |
| 3   | System Admin access                  | S3: 403 overview + trace                                                                                                                              | PASS   |
| 4   | Regular staff global access          | S4: Sales, Operations (manager + staff), Warehouse (staff + manager), Purchasing, Accounting, unassigned, Executive-department manager → 403          | PASS   |
| 5   | Cross-company aggregation            | S5: a second company sees only zeros, empty queue / activity / bottlenecks, no shared id; demo document via trace → 404                               | PASS   |
| 6   | Cross-branch aggregation             | S6: every item's document branch = item branch; branch rows sum to company; per-branch overview = its row                                             | PASS   |
| 7   | Forged companyId                     | S7: `?companyId=` → 400; on trace → 400                                                                                                               | PASS   |
| 8   | Forged branchId                      | S7: invented id, another company's branch, a branch outside the Executive's access → 404 (same answer)                                                | PASS   |
| 9   | Guessed document ids                 | S7: invented id, wrong kind, Head Office document for a one-branch Executive → 404                                                                    | PASS   |
| 10  | Recipe line disclosure               | S10: no `bom*`, `recipe*`, `lines`, `materials` key in overview or 15 traces (Owner + Executive); `/production/boms/:id` still 403 for Executive      | PASS   |
| 11  | Material-ratio disclosure            | S11/R11: no `ratio`, `quantity`, `required*`, `available`, `shortage` key; a 99,999 planned quantity never appears                                    | PASS   |
| 12  | Unauthorized financial fields        | S12: no price / amount / cost / total / discount / margin / deposit-amount key; schema has no money field (JSON-schema test)                          | PASS   |
| 13  | Warehouse financial privacy          | S13 + EP45 A18 sweep over every GET route (incl. `/executive/*`, 403 for Warehouse) + warehouse-privacy suite                                         | PASS   |
| 14  | Cached data after revocation         | S14: DENY `executive.overview.view` → 403 next request; DENY `sales.orders.view` → Sales disappears; `no-store`; UI test: a refusal replaces the page | PASS   |
| 15  | Dashboard-generated workflow changes | S1/S2: state hash of every business table unchanged after Owner / Executive reads; real stack: no movement, audit row or reservation from reads       | PASS   |
| 16  | Export routes                        | S16: route table has exactly two GET routes under `/executive`; no export / download / csv route anywhere                                             | PASS   |

## 3. Preserved guarantees

- **EP40**: the security sweeps over the real route table pass with the new routes (74 / 74 with the EP47 suite).
- **EP41**: independent approval and owner override live on the document routes only; the Command Center has none.
- **EP45**: no new code; access requires role Owner / Executive (a department member assigned to Executive is refused);
  each department's data needs its own read code.
- **EP46**: no recipe or quantity field; the Executive's BOM detail stays 403.
- **Warehouse privacy**: unchanged; Warehouse roles cannot open the Command Center.
- **EP47 fix**: the Executive no longer sees draft purchase-order counts or rows on the Purchasing dashboard (the
  Purchasing module hides them) — test "EP47 fix".
