# EP46 — Manufacturing Policy (optional BOM)

**Status:** implemented in EP46 (development). Audit, confidentiality: [EP46_RECIPE_CONFIDENTIALITY_MATRIX.md](EP46_RECIPE_CONFIDENTIALITY_MATRIX.md).

## 1. Company manufacturing mode

| Mode                     | Meaning                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BOM_REQUIRED` (default) | Every production order takes its materials from the item's ACTIVE BOM revision (EP36 behaviour, unchanged).                                                                    |
| `BOM_OPTIONAL`           | An order may instead carry an **explicit material plan** (`materialPlan: MANUAL`): materials and quantities entered for that order. BOM orders keep working exactly as before. |

- Stored on `Company.manufacturingMode`. **Every existing and every new company is `BOM_REQUIRED`** until the
  **Company Owner** changes it in Company Control Center → Settings (`PATCH /company/current/settings
{manufacturingMode}`). System Admin, Executive and everyone else get `403 OWNER_ONLY` (it is a business control, like
  the EP41 approval policy). Each change is audited `MANUFACTURING_MODE_CHANGED {from, to}`.
- The mode is read from the server-side company record on every request — never from the client (a
  `manufacturingMode` field in an order body is `400`).

## 2. Explicit material plan (BOM_OPTIONAL)

| Step                                 | Rule                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create                               | `POST /production/orders {itemId, quantity, materialPlan: 'MANUAL'}` — no `bomId` (422 `PLAN_CONFLICT`); in `BOM_REQUIRED` → 422 `BOM_REQUIRED_BY_POLICY`. The order starts with **no** materials — nothing is inferred from a BOM or from the quantity.                                                                                                                                |
| Plan                                 | `PUT /production/orders/:id/materials {lines: [{itemId, quantity}]}` — DRAFT only, by its creator (`operations.orders.create`); replaced whole; same material rules as a BOM line: active stock-tracked item, base unit, unit precision, quantity > 0, no duplicates, not the output item itself. The quantity **is** the requirement (`bomQuantity` is NULL — no recipe ratio exists). |
| Quantity change                      | never rescales an explicit plan                                                                                                                                                                                                                                                                                                                                                         |
| Switch                               | DRAFT only: `PATCH {materialPlan: 'BOM'}` recomputes from the active BOM; `PATCH {materialPlan: 'MANUAL'}` (BOM_OPTIONAL only) clears the plan                                                                                                                                                                                                                                          |
| Submit / approve                     | the plan must exist (≥ 1 line → otherwise 422 `MATERIAL_PLAN_REQUIRED`), every material still active, the company still `BOM_OPTIONAL` (else `BOM_REQUIRED_BY_POLICY`). From submission on, the plan is frozen (409). EP41 independent approval applies unchanged.                                                                                                                      |
| Reserve → issue → usage              | exactly the EP37 path: reservations (FEFO) up to each planned quantity, material issues from reservations, posting writes `PRODUCTION_CONSUMPTION` once; actual usage is recorded per material (evidence; `usageVariance`, `unrecorded` shown). Extra quantity needs the existing manager-authorized **excess** with a reason.                                                          |
| Output → finished goods → completion | unchanged EP38 path (quality decision, Warehouse receipt posted once, completion blockers).                                                                                                                                                                                                                                                                                             |

**Missing / partial / cancelled / adjusted:** an empty plan cannot be submitted; partial consumption is traced
(issued vs used vs planned); cancelling an approved order releases its reservations; a shortage is reported at
reservation and the order cannot be released until materials are available; an extra quantity is an audited excess,
never a silent change of the plan. Negative inventory, duplicate posting and illegal transitions stay refused by the
existing services and database guards (tested).

## 3. Switching back to BOM_REQUIRED

Orders already submitted or later with an explicit plan **continue** (their plan was approved). A BOM-free DRAFT can no
longer be submitted (`BOM_REQUIRED_BY_POLICY`) — its planner switches it to the BOM or discards it. No order is changed
automatically.

## 4. Database guarantees

- `ProductionOrder_manual_plan_check`: a MANUAL plan has no BOM fields.
- `ProductionOrder_check` (EP36, extended): an order past DRAFT has a BOM **or** a MANUAL plan.
- Trigger `ProductionOrder_manual_plan_mode`: an order can only _become_ MANUAL while its company is `BOM_OPTIONAL`.
- Existing EP36–EP41 guards (draft-only edits, frozen posted documents, append-only audit) unchanged.

## 5. Impact on existing data

None: the migration adds the mode (default `BOM_REQUIRED`) and the plan (default `BOM`); no company, order or
material row changes (verified on a copy of the EP45 QA database, 823 rows — see
[EP46_MIGRATION_ROLLBACK.md](EP46_MIGRATION_ROLLBACK.md)).

## 6. Not in EP46

Multi-level BOMs, unit conversion, yield / scrap, costing, adding an unplanned material to an approved order (use the
excess of an existing material, or cancel and re-plan).
