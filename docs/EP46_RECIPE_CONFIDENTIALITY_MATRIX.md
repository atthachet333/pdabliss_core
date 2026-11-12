# EP46 — Recipe Confidentiality Matrix

## 1. Audit at baseline (`1e551d1`)

`operations.bom.view` (a READ code) gave **every** Operations Staff member and Viewer, and the Executive, the full
recipe: BOM lines and quantities, output basis, notes, revision history, the requirement preview for any quantity, and
per-order `bomQuantity` / required quantities from the moment a draft existed. A staff member could also reconstruct
any recipe by creating draft orders. Audit events of BOMs carried counts only (no quantities) — safe.

## 2. What is "recipe data" (confidential)

| Field / view                                                                      | Where                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BOM lines (materials, quantities, notes), output basis, line count, revision page | `GET /production/boms/:id`; `outputQuantity`, `lineCount` in `GET /production/boms`                                                                                                                          |
| Per-unit ratio and rounding of an order                                           | `materials[].bomQuantity`, `materials[].exact`, `order.bomOutputQuantity`                                                                                                                                    |
| Requirement preview (scales the recipe)                                           | `GET /production/requirements/preview`                                                                                                                                                                       |
| BOM-derived quantities of an order **not yet released**                           | `materials[].required/available/shortage/reserved/issued/used/stillNeeded/excess/usageVariance/unrecorded`, `reservations[].quantity/claimed`, allocation results, `GET /production/requirements` aggregates |

**Operational (not confidential):** BOM identity (code, revision, item, status); an order's material **items** and
availability **state**; the batch quantities of an order **released** for execution (people physically issue and use
them — released by recipe holders); an explicit (MANUAL) plan, which is the planner's data, not a recipe; Warehouse
issue and finished-goods quantities; Purchasing shortages (no BOM field, no order output quantity).

## 3. Permission

`operations.recipes.view` — OPERATIONS, COMPANY scope, **confidential**: a role default only for the **Company Owner**
and **Operations Managers**. Staff and Viewers in Operations need an explicit ALLOW (EP27 exception, Operations members
only — EP45). The **Executive** never holds it (oversight is not recipe access). **System Admin** has no operational
code at all (EP45). A DENY closes even a manager's access, on the next request.
`operations.bom.manage` (create / edit / activate / retire / revise) now **also** requires `operations.recipes.view`.

## 4. Route-by-route projection

| Route                                               | Owner / Ops Manager           | Ops Staff / Viewer                                         | Executive     | Warehouse                             | Purchasing                                                                 | Sales / Accounting | System Admin |
| --------------------------------------------------- | ----------------------------- | ---------------------------------------------------------- | ------------- | ------------------------------------- | -------------------------------------------------------------------------- | ------------------ | ------------ |
| `GET /production/boms`                              | full                          | identity only                                              | identity only | 403                                   | 403                                                                        | 403                | 403          |
| `GET /production/boms/:id`                          | full                          | **403** (checked before lookup)                            | **403**       | 403                                   | 403                                                                        | 403                | 403          |
| BOM writes                                          | if `bom.manage` + recipes     | 403                                                        | 403           | 403                                   | 403                                                                        | 403                | 403          |
| `GET /production/requirements/preview`              | full                          | **403**                                                    | **403**       | 403                                   | 403                                                                        | 403                | 403          |
| `GET /production/orders/:id` (BOM plan, unreleased) | full                          | items + state, quantities `null`, `quantitiesHidden: true` | same          | 403                                   | 403                                                                        | 403                | 403          |
| `GET /production/orders/:id` (released)             | full                          | quantities, no `bomQuantity` / `bomOutputQuantity`         | same          | 403                                   | 403                                                                        | 403                | 403          |
| `GET /production/orders/:id` (MANUAL plan)          | full                          | quantities (planner data)                                  | same          | 403                                   | 403                                                                        | 403                | 403          |
| `GET /production/orders` (list)                     | rows (no material quantities) | same                                                       | same          | 403                                   | 403                                                                        | 403                | 403          |
| `GET /production/requirements`                      | all orders                    | released or MANUAL orders only                             | same          | 403                                   | 403                                                                        | 403                | 403          |
| allocation results                                  | full                          | redacted when hidden                                       | —             | —                                     | —                                                                          | —                  | —            |
| `GET /warehouse/material-issues`                    | —                             | —                                                          | —             | issued quantities (post-release only) | —                                                                          | —                  | —            |
| `GET /purchasing/production-shortages`              | —                             | —                                                          | —             | —                                     | material, required, available, shortage — no BOM field, no output quantity | —                  | —            |

Other properties:

- **Guessed ids:** the recipe permission is checked before any lookup → identical 403 for real and invented ids.
- **Other companies / branches:** BOMs are company-scoped (another company → 404); orders stay branch-scoped (EP26).
- **Exports / reports:** no export, CSV, download or print route exists (asserted against the real route table).
- **Errors:** refusals carry only the permission code; validation errors of the explicit plan name a line number,
  never a recipe quantity.
- **Caching:** every `/api/*` answer without its own policy is `Cache-Control: no-store` (EP46).
- **Frontend:** non-recipe users see "Recipe details are confidential" / "quantities appear once released" in TH / EN /
  ZH, no link into a recipe page, no preview call — but the server is the boundary (sweep tests).

## 5. Demo personas

| Persona                                                                                          | Recipe access   | Change                                                                                 |
| ------------------------------------------------------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------- |
| `owner.demo`                                                                                     | yes (invariant) | —                                                                                      |
| `operations.demo` (Manager)                                                                      | yes (default)   | —                                                                                      |
| `executive.demo`                                                                                 | **no**          | before EP46 read every recipe; now catalogue identity and operational order views only |
| `admin.demo`, `sales.demo`, `warehouse.demo`, `staff.demo`, `purchasing.demo`, `accounting.demo` | no              | none had production access                                                             |

No persona needs a recipe to do its demo work; no exception was seeded.
