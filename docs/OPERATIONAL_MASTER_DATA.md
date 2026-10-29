# Operational Master Data (EP28)

EP28 gives CORE **one canonical record per business identity** that every department shares:
customers, suppliers, items (with their units and categories) and warehouse locations. Future
Sales, Purchasing, Warehouse, Operations, Accounting and Executive modules reference these ids —
they never keep their own copy of a customer, supplier or item.

Source of truth: `backend/src/master-data/` (`access.ts` who may do what, `codes.ts` code
generation, `input.ts` request schemas, `views.ts` response views, `policy.ts` tracking and
structure rules, `service.ts`, `demo.ts`), `backend/src/routes/v1/master-data.ts`, migration
`20261031090000_ep28_operational_master_data`. Screens: `frontend/src/features/master-data/`.

## 1. Entities and scope

| Entity | Table | Scope | Code | Notes |
| --- | --- | --- | --- | --- |
| Customer | `Customer` | company | `CUS-000001` (or entered) | kind BUSINESS / INDIVIDUAL; identity + contact + addresses + notes |
| Supplier | `Supplier` | company | `SUP-000001` (or entered) | **general identity only** — no financial term |
| Item | `Item` | company | `FG-` `RM-` `PK-` `CS-` `NS-000001` (or entered) | type, base unit, category, SKU, barcode, tracking |
| Unit | `Unit` | company | entered (`PCS`, `KG`) | name, symbol, precision 0–6 |
| Item category | `ItemCategory` | company | entered (`FG`) | flat (no hierarchy in v1) |
| Warehouse location | `WarehouseLocation` | **branch** | entered, unique **per branch** (`MAIN`) | optional parent (same branch, ≤ 4 levels), one default per branch |

- Every record belongs to exactly one company. Customers, suppliers, items, units and categories
  are **never duplicated per branch**; future stock quantities will be per branch / location.
- Locations belong to one branch. The Head Office is just another branch (no special inventory
  rule for `00000`).
- A real organization may be both a customer and a supplier: two canonical records (no universal
  Party model in v1).
- **Domain name decision:** the canonical internal name is **Item** (not Product) because the
  catalogue covers finished goods, raw materials, packaging, consumables and non-stock items. The
  UI says รายการสินค้า / Items / 物料.

### Company isolation (database-enforced)

Every relation carries the company id in its foreign key:
`Item(baseUnitId, companyId) → Unit(id, companyId)`, `Item(categoryId, companyId) →
ItemCategory(id, companyId)`, `WarehouseLocation(branchId, companyId) → Branch(id, companyId)`,
`WarehouseLocation(parentId, branchId) → WarehouseLocation(id, branchId)`. The API also looks up
every id inside the caller's company (another company's id is simply "not found"), but even a
write past the API cannot reference another company's record. Every master table also has
`@@unique([id, companyId])` so future documents can use the same company-bound foreign keys.

## 2. Item model

| Field | Rule |
| --- | --- |
| `type` | `FINISHED_GOOD`, `RAW_MATERIAL`, `PACKAGING`, `CONSUMABLE`, `NON_STOCK` — fixed at creation (it chose the code prefix) |
| `name`, `description` | as entered, never translated |
| `sku`, `barcode` | optional, upper-cased identifiers, **company-unique** (database unique index). No scanning yet |
| `baseUnitId` | required, an ACTIVE unit of the same company |
| `categoryId` | optional, an ACTIVE category of the same company |
| `inventoryTracked` | default true; NON_STOCK defaults to (and must be) false |
| `lotTracking` | `NONE` · `OPTIONAL` · `REQUIRED` |
| `expiryTracking` | `NONE` · `OPTIONAL` · `REQUIRED` |

Tracking rules (service **and** database CHECK `Item_tracking_check`):

1. `NON_STOCK` ⇒ not inventory tracked.
2. Not inventory tracked ⇒ lot `NONE` and expiry `NONE`.
3. Expiry is recorded **per lot**, so expiry tracking needs lot tracking at least as strict:
   expiry `OPTIONAL` ⇒ lot `OPTIONAL`/`REQUIRED`; expiry `REQUIRED` ⇒ lot `REQUIRED`.

No stock quantity, lot instance, batch, cost, price or margin exists in EP28.

## 3. Units and quantity precision

`Unit.precision` = decimal places a quantity in that unit may carry (0 = whole numbers, e.g. PCS;
3 for KG). Future quantities are **exact decimals** (PostgreSQL `numeric` / Prisma `Decimal`),
never floating point, validated against the unit's precision. No unit conversion in EP28.

## 4. Codes

- Business identifiers: upper-case letters, digits and `. _ / -`, starting and ending
  alphanumeric (database CHECK); ≤ 32 characters (units ≤ 16). Never a database id.
- **Unique** per company (per branch for locations) — database unique indexes.
- **Generated** codes `PREFIX-NNNNNN` come from `MasterCodeSequence (companyId, prefix,
  lastValue)`. One atomic `INSERT … ON CONFLICT DO UPDATE SET lastValue = lastValue + 1 RETURNING`
  inside the transaction that also inserts the record and its audit entry. A concurrent create waits
  on that row and gets the next number; a failed create rolls the counter back (no gaps from
  errors). Never `MAX(code) + 1`. Item types have separate counters (FG-000001 and RM-000001 can
  coexist).
- **Entered** codes are allowed on creation (legacy numbering) when unique and valid, but may not
  take the generated form (`CUS-000123`, `FG-000045`, …) — that range belongs to the counter, so a
  generated code can never collide with an entered one (`CODE_RESERVED`).
- **Immutable** once created: no endpoint changes a code (the edit schemas refuse `code`). To fix
  a mistyped code before the record is used: deactivate it and create a new one. A future,
  audited "correct code" action for never-referenced records may be added; once transactions
  reference a record its code stays forever.
- Concurrency is tested: 16 simultaneous creates each of customers, suppliers and items give
  exactly `…-000001` … `…-000016`, one audit entry each.

## 5. Lifecycle (no hard delete)

`status ACTIVE | INACTIVE` with `deactivatedAt` (database CHECK: set exactly when INACTIVE).
Deactivate / reactivate are separate, audited endpoints; nothing is deleted, so a record that a
future document references stays identifiable forever.

| Case | Policy |
| --- | --- |
| Unit / category deactivated while items use it | allowed; the items keep it and show it as inactive; **no new assignment** of an inactive unit / category (`REFERENCE_INACTIVE`) |
| Item reactivated while its base unit is inactive | refused (`REFERENCE_INACTIVE`) |
| Location with active locations inside | cannot be deactivated (`LOCATION_HAS_ACTIVE_CHILDREN`) |
| Default location deactivated | it stops being the branch default (audited `defaultCleared`) |
| Location reactivated under an inactive parent or in an inactive branch | refused |
| Location created / edited in an inactive branch | refused (`BRANCH_INACTIVE`) |

**Future workflow contract:** new documents (PR, PO, SO, receipts…) must refuse choosing an
INACTIVE master record; historical documents keep displaying it (with a code / name snapshot).

## 6. The structure policy point

An item's base unit and inventory / lot / expiry tracking define how every future quantity is
counted. They change **only** through `PUT /master-data/items/:id/structure` →
`assertStructureChangeAllowed()` in `policy.ts` (item row locked, merged tracking checked, every
registered `STRUCTURE_LOCKS` entry consulted, audited as `ITEM_STRUCTURE_CHANGED` from → to). The
generic item edit cannot touch them. In EP28 nothing references items, so the list of locks is
empty and the change is allowed; Warehouse / Purchasing / Sales register their checks (stock
exists, lots exist, open document lines) and the change is then refused (`ITEM_STRUCTURE_LOCKED`)
or migrated deliberately. Unit precision is in the same situation (editable now; future stock
modules lock it).

## 7. Permissions (EP27 catalog, resolver and guard)

| Resource | View (any of) | Manage (any of) |
| --- | --- | --- |
| Customers | `sales.customers.view`, `accounting.customers.view` | `sales.customers.manage` |
| Suppliers | `purchasing.suppliers.view`, `accounting.suppliers.view` | `purchasing.suppliers.manage` |
| Items, units, categories | `operations.items.view`, `sales.items.view`, `purchasing.items.view`, `warehouse.items.view` | `operations.items.manage` |
| Locations | `warehouse.locations.view` **+ branch access** | `warehouse.locations.manage` **+ branch access** |
| Everything, every branch | `company.master_data.manage` (Owner, System Admin) | same |

- Customer / supplier / item codes are **COMPANY-scoped** operational permissions (no selected
  branch needed); location codes are **BRANCH-scoped**.
- Role defaults follow EP27 tiers: `.view` is READ (Staff, Viewer, Manager, Executive),
  `.manage` is MANAGE (Managers only). **Staff and Viewers never manage master data by default.**
  The Executive reads everything enabled, manages nothing. Owner and System Admin manage
  everything through `company.master_data.manage` (company administration, role-bound, not
  overridable).
- Exceptions work as in EP27 (DENY first; ALLOW only inside an assigned department).
- Guards: `requireAnyPermission(db, ctx, codes)` for company records and
  `requireBranchPermission(db, ctx, code, branchId, 'company.master_data.manage')` for a
  location's branch (`backend/src/permissions/guard.ts`). A branch-restricted member never reads
  or changes another branch's locations (`BRANCH_NOT_ALLOWED`); company administration reaches
  every branch (as for branches and people in EP26). No route checks a role by hand.

## 8. Warehouse privacy and response views

- Master tables hold **no** cost, price, margin, payment term, credit, balance or bank field (a
  test checks every column name). Supplier financial terms belong to future Purchasing /
  Accounting records Warehouse never receives.
- Every response is an explicit allow-list (`views.ts`), never a database row: no `companyId`,
  actor ids, counters or platform metadata. List rows are lean (no notes / addresses).
- Warehouse Staff reads items, units, categories and its branches' locations; it has **no**
  supplier or customer permission at all. A test calls every endpoint as Warehouse Staff and
  asserts no key or value of a financial kind and no supplier data in any payload.
- Platform operators have no customer master-data access (403); Platform Inspection shows that
  a master-data event happened, never its code, name or fields.

## 9. Search, filters, sort, pages

Server-side, company-scoped, 25 per page (≤ 100), `total` / `hasMore`:

| Resource | Search `q` | Filters |
| --- | --- | --- |
| Customers | code, name, legal name, tax ID (typed with or without dashes), contact, email, phone | status, kind |
| Suppliers | code, name, legal name, tax ID, contact, email, phone | status |
| Items | code, SKU, barcode, name | status, type, category, inventoryTracked, lotTracking / expiryTracking (`NONE`·`OPTIONAL`·`REQUIRED`·`TRACKED`) |
| Units / categories | code, name (+ symbol) | status |
| Locations | code, name | status, branch |

`sort` is a closed list — `code` (default; locations by branch then code), `name`, `updated` —
mapped to columns by the service; any other value is a 400. Unknown query parameters are refused.

## 10. Audit

`CUSTOMER_*`, `SUPPLIER_*`, `ITEM_*`, `UNIT_*`, `ITEM_CATEGORY_*`, `LOCATION_*` with
`CREATED` / `UPDATED` / `DEACTIVATED` / `REACTIVATED`, plus `ITEM_STRUCTURE_CHANGED`. Details:
code, name, changed field **names**, name from → to, tracking / unit from → to, precision from → to,
branch code, default changes. Never notes, addresses, phone numbers, e-mail addresses or tax IDs.
Activity shows them in words ("Customer CUS-000001 created").

## 11. API (`/api/v1/master-data`, session required)

| Method | Path |
| --- | --- |
| GET | `/context` — capabilities per resource, company-wide flag, branches whose locations the caller may see |
| GET · POST | `/customers` · `/suppliers` · `/items` · `/units` · `/categories` · `/locations` |
| GET · PATCH | `/<resource>/:id` |
| POST | `/<resource>/:id/deactivate` · `/<resource>/:id/reactivate` |
| PUT | `/items/:id/structure` |

Errors: `PERMISSION_DENIED` 403, `BRANCH_NOT_ALLOWED` 403, `BRANCH_NOT_FOUND` 404,
`MASTER_RECORD_NOT_FOUND` 404, `DUPLICATE_VALUE` 409 (`details.field`: code / sku / barcode),
`CODE_RESERVED` 422, `REFERENCE_NOT_FOUND` 422 / `REFERENCE_INACTIVE` 409 (`details.field`),
`TRACKING_INVALID` 422 (`details.reason`), `LOCATION_TOO_DEEP` / `LOCATION_CYCLE` 422,
`LOCATION_HAS_ACTIVE_CHILDREN` / `BRANCH_INACTIVE` / `RECORD_INACTIVE` 409, `VALIDATION_FAILED` 400
(strict bodies: `companyId`, `status`, `code` on edit, `creditLimit`, `paymentTerms`… are refused).

## 12. Screens (`/company/master-data/*`, one lazy chunk)

One **Master Data** entry in the Company Control Center menu (shown when the person may view any
master data), sub-navigation Customers · Suppliers · Items · Units · Categories · Locations (only
those the server allows). Lists are real tables on ≥ 768 px and labelled rows below; search,
filters, sort, "Show more"; empty states with Create for managers and a read-only explanation for
others. Each record has a dedicated page (facts in groups, Edit, Deactivate with in-place
confirmation, Reactivate) and items a separate **Unit & tracking** form. Tracking reads in words
(Stock · Lot · Required · Expiry · Optional), never colour alone. TH / EN / ZH; business names
are shown exactly as entered.

## 13. Demo seed

`npm run db:seed:demo` adds, once, to the demo company: units PCS / KG / BOX, categories FG / RM,
items FG-000001 (lot + expiry required), RM-000001 (lot + expiry optional), PK-000001, customer
CUS-000001, supplier SUP-000001, locations Head Office `MAIN` (default) and branch 00001 `MAIN`
(default) + `RECEIVING`. Stable codes; created only when missing; never overwritten; counters moved
past the seeded numbers. No price, cost or margin. Seeding twice changes nothing.

## 14. Future module contracts

**Warehouse (stock, receiving, FEFO).** Stock entities reference `itemId` + `branchId` +
`locationId` (+ `lotId` where the item tracks lots) — never a copy of item identity. A future
`Lot (companyId, itemId, lotNo, expiryDate?)` carries the expiry; FEFO picks, among lots of items
whose `expiryTracking ≠ NONE`, the earliest `expiryDate` first. Receiving requires a lot when
`lotTracking = REQUIRED` and an expiry when `expiryTracking = REQUIRED`. Quantities are exact
decimals checked against the base unit's precision. Warehouse registers a `STRUCTURE_LOCKS` entry
(stock or lots exist ⇒ no unit / tracking change). Warehouse views stay operational only.

**Purchasing (EP29 PR → PO).** PR / PO lines reference `itemId`, `unitId` (the base unit in v1)
and the PO `supplierId`; they **snapshot** item code / name and supplier code / name for the
historical document while keeping the canonical ids. Only ACTIVE items / suppliers may be chosen.
Prices, payment terms and supplier financial terms live in Purchasing records with their own
permissions and Warehouse-excluded views — never on the master records.

**Sales.** Sales order lines reference `customerId`, `itemId`, `unitId`, with the same snapshot
rule. Price lists, credit limits and receivables are later, separate records.

**Accounting.** References `supplierId` / `customerId` and document identities; no balances,
GL mapping or payment terms on master data.

## 15. Not in EP28

PR, PO, deposits, receiving, stock quantities, stock ledger, lot instances, expiry batches, FEFO
allocation, sales orders, backorders, production / BOM, payments, prices, costs, credit, GL,
executive KPIs, CSV import / export, barcode scanning, unit conversion, category hierarchy,
location types.
