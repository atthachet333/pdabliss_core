# EP42.4 — Document Context Completion (Warehouse control and fulfilment documents)

**Baseline:** `86c00a9` (EP42.3.1). **Scope:** the five lists EP42.3 left with a bare line count
(bug register K-13): Transfers, Stock adjustments, Cycle counts, Packing, Shipments. **Data:** a
disposable copy of the owner's UAT data (`pdabliss_core_uat_ep423`, refreshed by read-only dump), QA
stack on `localhost:2111/2112`, personas warehouse.demo, executive.demo and owner.demo, plus API probes
for every persona.

## 1. Audit — what each list had, and what the data supports

| List · route                                    | Who may read (unchanged)                                             | Already in the row                                               | Missing                                | Added (EP42.4)                                                                                                                                                                                                                                                 | Deliberately **not** added                                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Transfers `/core/warehouse/transfers`           | Warehouse (`warehouse.inventory.view`), Executive (read-only), Owner | number, status, source → destination location, date, creator     | what is moved                          | first item, quantity, unit, "+N more"; next action (draft → **Post**); named "From → To" column (was a bare "→")                                                                                                                                               | transfer "progress" — a transfer posts in one step (no in-transit stage), so there is none to show                             |
| Stock adjustments `/core/warehouse/adjustments` | same                                                                 | number, status, reason, affected location codes, date            | item and change                        | first item with the **signed** change (+0.5 KG / −1 PCS); location column no longer hidden at 768–1023 px; next action (draft → **Submit**, submitted → **Approve**)                                                                                           | any cost, value or valuation (none exists in the read model; none was added)                                                   |
| Cycle counts `/core/warehouse/counts`           | same                                                                 | number, status, locations, counted / total lines, variance lines | which items                            | item names and "+N more", **no quantity** (counts are blind — the system quantity never reaches a list); progress column no longer hidden at 768–1023 px; next action (draft → **Start counting**, counting → **Send for review**, review → **Confirm count**) | variance _quantity_ on the list (only the variance-line count is in the read model; the document page shows per-line variance) |
| Packing `/core/warehouse/packs`                 | same                                                                 | number, status, sales order, package count, shipment link        | items, packed vs required              | first item **packed of picked** ("6 / 10 BOX"); next action (draft → **Confirm pack**, packed without shipment → **Create shipment**)                                                                                                                          | "required" from the sales order — a pack packs what was picked, so _picked_ is the honest reference                            |
| Shipments `/core/warehouse/shipments`           | same                                                                 | number, status, sales order, ship-to name, carrier, tracking     | items, delivered vs outstanding, dates | first item **delivered of shipped** ("0 / 3 BOX" for an exception); dispatched and delivered **dates**; next action (ready → **Dispatch**, dispatched → **Record delivery**)                                                                                   | selling price, totals, customer terms — never on any Warehouse response                                                        |

"Next action" uses each document's existing action labels and is derived from its state. It says what
comes next, not that the reader may do it (staff still cannot post; the server decides).

## 2. API projection (read-only, server-authorized)

`summary` on the five list rows, built by the shared `backend/src/lib/line-summary.ts` (EP42.3)
under each endpoint's existing authorization and branch scope. EP42.4 extended it with two fields:

- `of` (optional): the quantity the figure is measured against (packed **of** picked, delivered **of** shipped);
- `quantity` may be `null` (cycle counts).

Keys stay `code, name, quantity, unit, more, of`, all classified operational in the Warehouse field
allow-lists (`CONTROL_FIELD_CLASSES`, `FULFILMENT_FIELD_CLASSES`). No endpoint was opened to a new
audience.

| Persona                                 | Five lists | Five details (preview source) | Money keys |
| --------------------------------------- | ---------- | ----------------------------- | ---------- |
| warehouse.demo                          | 200        | 200 (actions by role)         | none       |
| executive.demo                          | 200        | 200, `actions: []`            | none       |
| sales / purchasing / accounting / admin | 403        | —                             | —          |

## 3. Quick preview

The EP42.3 row preview now also covers all five lists, through the same shared list component. Each
list maps its own document lines:

- **transfers:** item, quantity, lot;
- **adjustments:** signed change, location · lot;
- **counts:** counted quantity, or "—" while not counted;
- **packs:** packed, location · lot;
- **shipments:** shipped, delivered, location · lot.

Every preview reads the same detail endpoint the full page uses, once per document. It is
keyboard-operable, contains no buttons, and links to the full document. A new **permission-denied**
state covers 403/404 ("You do not have access to this document's lines") next to the existing loading,
empty and failure states.

## 4. Before / after (warehouse.demo, Thai, 1440 px, real UAT copy)

| List        | Row before (visible cells)                                          | Row after                                                                                                               |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Transfers   | `TR-…0002 · Draft · MAIN → RECEIVING · 1 · Demo Warehouse · 10 Nov` | `TR-…0002 · Draft → Post transfer · MAIN → RECEIVING · PK-000001 Packaging box · 10 BOX`                                |
| Adjustments | `ADJ-…0004 · Posted · Other · MAIN · 2 · …`                         | `ADJ-…0004 · Posted · Other · MAIN · RM-000001 Cold-pressed coconut oil · +0.5 KG + 1 more`                             |
| Counts      | `CC-…0001 · Posted · RECEIVING · 2/2 · Δ 1 · 2 · …`                 | `CC-…0001 · Posted · RECEIVING · 2/2 · Δ 1 · FG-000001 Face cream 50 ml + 1 more`                                       |
| Packing     | `PACK-…0003 · Packed · SO-…0009 · 1 · …`                            | `PACK-…0003 · Packed → Create shipment · SO-…0009 · PK-000001 Packaging box · 6 / 10 BOX`                               |
| Shipments   | `SHP-…0002 · Delivery exception · SO-…0010 · Sample shop · 1 · …`   | `SHP-…0002 · Delivery exception · SO-…0010 · Sample shop · dispatched 10 Nov · — · PK-000001 Packaging box · 0 / 3 BOX` |

(Item names appear in Thai on screen; translated here.) Knowing what a document holds took **2
navigations** (open + back) before. It now takes **0** for the first line, or **1 in-place toggle** for
all lines. Screenshots were taken of Transfers before and after at 1440 px. The "who / when" columns
now appear only from 1536 px, which leaves the item context room at 1280–1440 px.

## 5. Responsive results (scripted measurements, all five lists + their detail pages)

| Width | Page overflow | Notes                                                                                                                          |
| ----- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 390   | none          | phone cards about 70 px shorter than before (who / when hidden on phones; e.g. Transfers 346 → 277 px, Shipments 407 → 338 px) |
| 768   | none          | facts one column in narrow containers                                                                                          |
| 1024  | none          | all 14 Warehouse tabs visible (EP42.3 wrap)                                                                                    |
| 1280  | none          | 4–7 visible columns; also checked in EN and ZH                                                                                 |
| 1440  | none          | detail pages: facts in two columns                                                                                             |
| 1920  | none          | content column 1,658 px; who / when columns appear                                                                             |

## 6. Remaining (recorded in the bug register)

- Production material issues (Operations list) still show a line count (K-13, reduced scope).
- Pack "required" is measured against the pick, not the sales-order line (by design, §1).
- Counts show no quantities on the list (blind count, by design).
