# EP47 — Dashboard Permission Matrix

**Status:** implemented in EP47 (development). No new permission code was created: the dashboards reuse the EP27
catalog and the EP45 resolver (`backend/src/permissions/`). A dashboard is opened by the department's existing
`<department>.workspace.view`; each metric then needs the read code of the screen it summarizes
([EP47_METRIC_DEFINITIONS.md](EP47_METRIC_DEFINITIONS.md)). There is no broad "dashboard" permission that could bypass
EP45 single-department enforcement.

## 1. Who opens which dashboard (selected branch)

| Person                              | Sales                                                    | Production (Operations) | Warehouse | Purchasing | Accounting | Executive Command Center |
| ----------------------------------- | -------------------------------------------------------- | ----------------------- | --------- | ---------- | ---------- | ------------------------ |
| Company Owner                       | ✔ (all tiers)                                            | ✔                       | ✔         | ✔          | ✔          | EP48                     |
| Executive                           | ✔ READ                                                   | ✔ READ (no recipe)      | ✔ READ    | ✔ READ     | ✔ READ     | EP48                     |
| Department Manager / Staff / Viewer | only their ONE assigned department, at their role's tier |                         |           |            |            | —                        |
| System Admin                        | 403                                                      | 403                     | 403       | 403        | 403        | —                        |
| Unassigned or ambiguous member      | 403                                                      | 403                     | 403       | 403        | 403        | —                        |
| Signed out                          | 401                                                      | 401                     | 401       | 401        | 401        | —                        |

`GET /api/v1/dashboards` lists exactly the openable ones (`[]` for System Admin / unassigned). `GET
/api/v1/dashboards/executive` → `404` (not part of EP47). A department the company disabled, or a DENY exception on
`<dept>.workspace.view`, closes the dashboard on the next request.

## 2. Landing experience (CORE home)

| Person                                       | What the CORE home shows                                                                                                                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manager / Staff / Viewer with one department | that department's dashboard, embedded (the department-card list is replaced)                                                                                                                                                       |
| Owner                                        | department cards with **Dashboard** links to each department (`/core/dashboards/:department`); cross-department oversight without bypassing approval, workflow or audit controls (every step still happens on the document screen) |
| Executive                                    | the same cards and links, READ-only (every row `canAct: false`, access pill "Read-only"); the Executive card stays "later phase" (EP48)                                                                                            |
| System Admin                                 | "System Admins administer the company in the Company Control Center — no department work" + a button to the Company Control Center; no dashboard request is made                                                                   |
| Unassigned                                   | "No department yet" state; no dashboard request is made                                                                                                                                                                            |

## 3. Inside a dashboard

| Element                | Rule                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metric                 | Present only if the person holds its "Needs" code; otherwise absent (no 0, no hint).                                                                                                                                         |
| Queue row              | Rows are the documents the person may see on the module screen (drafts: creator or approver, as in each module).                                                                                                             |
| `canAct` / "Your step" | The person's effective permission for that step (e.g. `sales.orders.approve` for CONFIRM, `warehouse.dispatch.confirm` for DISPATCH). Viewer and Executive: always false. Never a button — the step happens on the document. |
| Link                   | Only to the canonical document / list the person may open (every link is opened as that person in test D13).                                                                                                                 |
| Money                  | Accounting deposit `amount` only (`accounting.deposits.view`); Warehouse never receives money (enforced by the builders and the strict response schema; tests D2 / D14 + EP45 A18).                                          |
| Recipes                | Production rows carry planned / outstanding output only — identical for Owner, Manager, Staff, Viewer and Executive (test D3).                                                                                               |
| Writes                 | None. `POST/PUT/PATCH/DELETE /api/v1/dashboards/*` → 404 for everyone, with or without `ownerOverride` (test D4 / D12; business tables unchanged).                                                                           |

## 4. Negative test map (Phase 12)

| #   | Case                                 | Test                                      | Result                                                                                                        |
| --- | ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Sales reads Warehouse dashboard      | D1 (matrix over 12 people × 5 dashboards) | 403 PERMISSION_DENIED                                                                                         |
| 2   | Warehouse receives financial values  | D2 / D14 + EP45 A18 sweep                 | no money key, no sentinel price                                                                               |
| 3   | Production Staff reads recipes       | D3                                        | no BOM / ratio / material quantity key                                                                        |
| 4   | Executive dashboard mutation         | D4 / Executive read-only test             | 404; every `canAct` false                                                                                     |
| 5   | System Admin reads operations data   | D1                                        | `[]`, 403 everywhere                                                                                          |
| 6   | Unassigned staff                     | D1 + UI test                              | `[]`, 403; UI makes no request                                                                                |
| 7   | Cross-company aggregation            | D7                                        | a second company sees only zeros / empty queues                                                               |
| 8   | Cross-branch aggregation             | D8                                        | every row's document in the selected branch; recounts per branch match                                        |
| 9   | Forged companyId / branchId          | D9                                        | 400; scope unchanged                                                                                          |
| 10  | Direct API to restricted dashboards  | D1                                        | 403 / 404                                                                                                     |
| 11  | Revoked permission with cached data  | D11 + UI tests                            | next request 403; metric of a denied source disappears; UI replaces numbers on refusal; `no-store`            |
| 12  | Owner override bypass                | D4 / D12                                  | no route accepts it; state hash unchanged                                                                     |
| 13  | Unauthorized drill-down              | D13                                       | every link received opens (200) for that person                                                               |
| 14  | Aggregates leaking restricted fields | strict schema test + D2 / D3 / D14        | unknown field fails the answer                                                                                |
| 15  | Supplier-deposit details             | D15                                       | amount for Accounting only; Purchasing / Warehouse 403 on the Accounting dashboard and no amount in their own |
