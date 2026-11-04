# Production BOM — Bills of Materials (EP36)

A bill of materials (BOM) says how much of each material makes a **base output quantity** of one
finished item. EP36 introduces it as the foundation of production planning
([PRODUCTION_ORDER.md](PRODUCTION_ORDER.md)). Report: [EP36_REPORT.md](EP36_REPORT.md).

Production lives in the **Operations** department (there is no separate Production department in
the EP25 catalog; Operations already covers production work). A BOM never moves, reserves or
creates stock.

## 1. Model

`ProductionBom` (one revision) and `ProductionBomLine` (its materials):

| Field | Meaning |
| --- | --- |
| `itemId` + `itemCode` / `itemName` | the finished item (snapshot refreshed at activation) |
| `code` | `BOM-<item code>` — the same for every revision of the item |
| `revision` | 1, 2, 3 … per finished item, never reused (serialized per item) |
| `outputQuantity` + unit snapshot | the quantity the lines make, in the item's **base unit** |
| `status` | `DRAFT` → `ACTIVE` → `RETIRED` |
| `activeSlot` | `true` while ACTIVE, NULL otherwise — unique per (company, item): one ACTIVE revision |
| `note`, creator, activated / retired by and at, retirement reason | audit facts |
| line: `itemId` + code / name / type, unit snapshot, `quantity`, `note`, `lineNo` | one material |

Composite foreign keys tie every row to its company (item, unit, member); a line carries
`bomItemId` with a foreign key to `(bom, item, company)` so the database itself refuses a finished
item consuming itself. Lines are unique per material (`(bomId, itemId)`).

## 2. Eligibility (reusing EP28 item types)

| Role | Items |
| --- | --- |
| Finished output | `FINISHED_GOOD`, inventory tracked, ACTIVE (`ITEM_NOT_MANUFACTURABLE` otherwise) |
| Material | inventory-tracked `RAW_MATERIAL`, `PACKAGING`, `CONSUMABLE` or another `FINISHED_GOOD` (single level — its own BOM is not exploded); never `NON_STOCK` / services (`MATERIAL_NOT_STOCK`) |

No new item flag was added: the existing type and `inventoryTracked` are enough. A purchased
finished good can have a BOM too; nothing forces production.

## 3. Validity

Refused with a clear code (422 unless noted): missing or other-company item / material
(`REFERENCE_NOT_FOUND` — never revealing another company's record), inactive item or material
(`REFERENCE_INACTIVE`), output / material quantity zero or negative (400), a finished item consuming
itself (`BOM_SELF_REFERENCE`), the same material twice (`DUPLICATE_MATERIAL`), more decimals than the
unit allows (`QUANTITY_PRECISION`), and **any unit other than the item's base unit**
(`UNIT_CONVERSION_UNSUPPORTED` — there is no unit conversion; KG is never silently turned into PCS).
Activation also needs at least one line (`BOM_EMPTY`) and re-validates everything against the
masters at that moment. Server-owned fields (status, revision, code, company, line numbers) are
refused with 400 (strict schemas).

## 4. Lifecycle and authority

| Action | From | Who | Result |
| --- | --- | --- | --- |
| create | — | `operations.bom.manage` | DRAFT revision = highest + 1 |
| edit | DRAFT | same | output quantity, note, lines (replaced whole) |
| activate | DRAFT | same | ACTIVE; the item's current ACTIVE revision → RETIRED ("Superseded by revision N"), same transaction |
| retire | DRAFT (abandon), ACTIVE (reason required) | same | RETIRED (final) |
| revise | ACTIVE, RETIRED | same | a new DRAFT copying the lines |

`operations.bom.view` (READ, company-wide) reads revisions. Managers and the Owner hold
`operations.bom.manage`; Staff, Executive and an Operations-assigned System Admin do not (MANAGE tier).

**Immutability.** An ACTIVE or RETIRED revision cannot change: the service refuses
(`BOM_NOT_EDITABLE`) and database triggers refuse it too (header fields, lines, status going back,
deletes). A change is a new revision. Production orders keep their own frozen copy, so retiring or
superseding a revision never alters approved history.

**Selection rule (deterministic).** At most one ACTIVE revision per finished item. A new order uses
the BOM named by the planner only if it is ACTIVE and makes the order's item; with none named, the
item's one ACTIVE revision; with no ACTIVE revision the draft has no BOM and cannot be submitted.
Never an arbitrary revision.

**Concurrency.** Revision numbering and activation take a per-item advisory lock; activation also
locks the revision row. Two drafts activated at once both succeed one after the other (the second
supersedes the first) and exactly one ACTIVE revision remains; the same draft activated twice
succeeds once (409 for the other). Tested in three rounds (backend and real stack).

## 5. Audit

`PRODUCTION_BOM_CREATED / UPDATED / ACTIVATED / RETIRED` on entity `ProductionBom` (code, revision,
from → to, line count — no quantities); redacted on the Platform explorer like every business entity.

## 6. API (`/api/v1/production`)

`GET /boms` (status, itemId, q, pages) · `POST /boms` · `GET /boms/:id` (lines, every revision of the
item, orders using it, timeline, actions) · `PATCH /boms/:id` · `POST /boms/:id/activate` ·
`POST /boms/:id/retire {reason?}` · `POST /boms/:id/revise` · `GET /items?role=OUTPUT|MATERIAL&q=`
(server item picker; no price, cost or supplier).

## 7. Limitations (deliberate)

- Single level only: no nested sub-assembly explosion, no phantom items, no scrap / yield factors,
  no alternates, no routings or work centres, no effective-date ranges (the active revision is the rule).
- No unit conversion: every quantity is in the item's base unit.
- No costing: a BOM carries no cost, price or value.
