# Sales Fulfilment — Picking, Packing, Dispatch and Delivery (EP35)

A CONFIRMED, allocated sales order is fulfilled physically by the Warehouse:
**pick → pack → shipment → dispatch → delivery**. Partial picks, several packs and several shipments
per order are normal. Report: [EP35_REPORT.md](EP35_REPORT.md). Reservations:
[SALES_ALLOCATION.md](SALES_ALLOCATION.md). Ledger: [INVENTORY_LEDGER.md](INVENTORY_LEDGER.md) §9.

```
CONFIRMED order ─ allocate (EP34: ACTIVE reservation, no movement)
   └─ pick ─ confirm (picked)          no movement, reservation ACTIVE
        └─ pack ─ confirm (packed)     no movement, reservation ACTIVE
             └─ shipment (READY)       no movement, reservation ACTIVE
                  └─ DISPATCH          SALES_ISSUE (−), reservation CONSUMED — the ONLY stock write
                       └─ deliver / exception   evidence only — no movement, ever
```

## 1. The stock issue point

**Physical stock is deducted at successful dispatch confirmation** — not at picking, packing or
delivery. Picking and packing handle stock still inside the Warehouse's custody; dispatch is when the
Warehouse hands it over; delivery is the customer's receipt, recorded as evidence.

| Action | On hand | Reservation | StockMovement |
| --- | --- | --- | --- |
| Allocate (EP34) | unchanged | ACTIVE + | none |
| Pick / confirm pick | unchanged | stays ACTIVE | none |
| Pack / confirm pack | unchanged | stays ACTIVE | none |
| Create / cancel shipment | unchanged | stays ACTIVE | none |
| **Dispatch** | **− quantity** | **consumed (exact quantity)** | **one SALES_ISSUE per shipment line** |
| Deliver / exception | unchanged | unchanged | none |
| Cancel before dispatch | unchanged | released only by the order cancel / release | none |
| Delivery failure after dispatch | no automatic change | no automatic change | no automatic reversal |

## 2. Documents

| Document | Number | Lifecycle | Holds |
| --- | --- | --- | --- |
| `SalesPick` + `SalesPickLine` | `PICK-YYYYMM-NNNNNN` | DRAFT → IN_PROGRESS → PICKED; DRAFT / IN_PROGRESS / PICKED (nothing packed) → CANCELLED | one line per ACTIVE reservation: its exact location, lot, item; planned / picked / packed / dispatched |
| `SalesPack` + `SalesPackLine` | `PACK-YYYYMM-NNNNNN` | DRAFT → PACKED → DISPATCHED; DRAFT / PACKED (not in a shipment) → CANCELLED | quantities of picked pick lines; package count, reference, note |
| `SalesShipment` + `SalesShipmentLine` | `SHP-YYYYMM-NNNNNN` | READY → DISPATCHED → DELIVERED, or → DELIVERY_EXCEPTION → DELIVERED; READY → CANCELLED | one line per pack line; ship-to, carrier, tracking, handover, delivered quantity |
| `SalesDeliveryEvent` | — | append-only | DELIVERED / PARTIALLY_DELIVERED / EXCEPTION, reason, recipient, reference, note, business time, recorder |

Numbers come from the atomic `DocumentSequence` upsert (company-wide, monthly, immutable — never
MAX + 1; concurrent creates tested unique and consecutive). Migrations
`20261107090000_ep35_movement_types` (the enum value, alone) and
`20261107090100_ep35_sales_fulfilment` are additive.

**Integrity in the database.** Composite foreign keys keep every line on the same company, branch,
order, order line and stock identity: a pick line references its reservation by
`(allocationId, salesOrderLineId, locationId, lotKey)`, a pack line its pick line by
`(pickLineId, salesOrderLineId)`, a shipment line its pack line by
`(packLineId, pickLineId, salesOrderLineId)`, a movement its shipment by
`(salesShipmentId, branchId, companyId)`. CHECKs: per pick line
**planned ≥ picked ≥ packed ≥ dispatched ≥ 0**, a short pick names a discrepancy (OTHER needs a note);
delivered ≤ dispatched per shipment line; number formats; status ⇔ timestamp / actor pairs.
Triggers: fulfilment rows are never deleted (documents are cancelled); delivery events are immutable;
a dispatched shipment or pack can never return to READY / PACKED / CANCELLED and its dispatch record
is fixed; a delivered shipment stays delivered; a shipment line changes only by recording more
delivered quantity; a pick line keeps its reservation and plan and its dispatched quantity only grows.

## 3. Picking

- **Create** (`POST /picks {salesOrderId, lines?}`): from a CONFIRMED order in the member's branch.
  Without `lines` the pick takes every ACTIVE reservation's **unclaimed** quantity (order line, then
  FEFO: expiry, lot age, location). With `lines` each names an `allocationId` of that order and a
  quantity ≤ its unclaimed quantity (`PICK_EXCEEDS_RESERVATION`). A client never names a lot or a
  location — the reservation decides. Nothing left → `NOTHING_TO_PICK`.
- **Start** (DRAFT → IN_PROGRESS) is optional; **confirm** (DRAFT / IN_PROGRESS → PICKED) gives every
  line's picked quantity (0 allowed; ≤ planned, `PICK_EXCEEDS_PLANNED`; unit precision). Less than
  planned requires a **discrepancy** (SHORT_PICKED, DAMAGED, MISSING, WRONG_ITEM, OTHER + note).
- **Partial picking** is several picks per order: what one pick does not claim stays pickable.
- A discrepancy **never** releases or alters the reservation: the unpicked remainder simply becomes
  unclaimed again (pickable by another pick). Releasing it, reallocating, or correcting stock (an
  adjustment, a count) are explicit follow-ups, possible once the order has no staged work (§7).
- **Cancel**: DRAFT / IN_PROGRESS freely; PICKED only while nothing of it is packed
  (`PICK_ALREADY_PACKED`) and with a reason. Its claim returns to the reservation; no movement.

## 4. Claims are not reservations

Per ACTIVE reservation:

```
reserved (ACTIVE)          the EP34 reservation — counted ONCE in available stock
claimed (staged)           Σ over its pick lines of non-cancelled picks: (picked, or planned while
                           not yet picked) − dispatched
unclaimed (to pick)        reserved − claimed   (Pending Pick shows it per location: "To pick")
```

A claim is not a second reservation: EP34 availability (on hand − ACTIVE reserved) is unchanged by
picking or packing. All writes that create or move claims lock the **order row** first, so two picks
can never claim the same quantity (race-tested: two picks of 7 from 10 → one 201, one 409).

## 5. Packing and shipments

- **Pack** (`POST /packs {salesOrderId, lines?, packageCount?, packageReference?, note?}`): picked,
  not yet packed quantities of PICKED picks (named pick lines + quantity, or all). The pick line's
  `packedQuantity` grows at once (a DRAFT pack already claims), so nothing is packed twice
  (`PACK_EXCEEDS_PICKED`, and the database CHECK packed ≤ picked). Confirm → PACKED. Cancel (DRAFT /
  PACKED, not in a shipment — `PACK_IN_SHIPMENT`) gives the quantities back to "picked, not packed".
- **Shipment** (`POST /shipments {salesOrderId, packIds?, shipToName?, shipToAddress?, carrier?,
  trackingReference?, note?}`): PACKED packs of the order not in another shipment (named, or all).
  `shipToName` defaults to the order's customer name (operational ship-to). One order may have many
  packs and many shipments; one pack may hold several order lines. Cancel (READY only) frees its packs.

## 6. Dispatch (READY → DISPATCHED) — `warehouse.dispatch.confirm`

One transaction, all or nothing:

1. lock the sales ORDER row, then the shipment row; it must still be READY and the order CONFIRMED;
2. its packs must be PACKED; take the locations' advisory locks **shared** (an open cycle count holds
   them exclusively → `COUNT_IN_PROGRESS`, nothing written);
3. lock the stock balance rows, then the reservation rows, each in id order;
4. per shipment line: the reservation behind it must be ACTIVE with at least that quantity
   (`RESERVATION_MISMATCH` otherwise) — **consume exactly that quantity**: the whole row becomes
   CONSUMED, or (partial) the ACTIVE row is reduced and a CONSUMED row of the dispatched quantity is
   created (`splitFromId` → the original; history kept on both);
5. then `applyMovement()` writes the **SALES_ISSUE** (−quantity, source `SALES_SHIPMENT` + shipment
   line) — the EP34 guard still runs and still requires on hand − quantity ≥ what stays reserved; it
   passes because the matching reservation was consumed in the same transaction (no guard is
   disabled, no window opens);
6. the pick line's dispatched quantity grows; packs → DISPATCHED; shipment → DISPATCHED with who,
   when and to whom it was handed over; audit.

A second dispatch waits on the order lock and finds the shipment no longer READY (409). A unique
`(salesShipmentLineId, type)` on movements and a unique `salesShipmentLineId` on consumed
reservations make a duplicate impossible even outside the API. After dispatch:
**on hand ≥ ACTIVE reserved** still holds everywhere (tested after every race round).

## 7. Allocation, cancellation and recovery

- **Release / reallocate** (EP34) are refused while the order has staged work
  (`FULFILMENT_IN_PROGRESS`): an open pick, picked or packed stock not yet dispatched, a READY
  shipment. Unwind first (cancel shipment → cancel pack → cancel pick). After a partial dispatch the
  remaining ACTIVE reservation can be released or reallocated as usual; dispatched (CONSUMED) stock
  is never released.
- **Allocate** again is always allowed; what a line still needs counts ACTIVE **and** CONSUMED
  reservations, so dispatched quantities are never reserved twice.
- **Order cancel**: refused with `SO_ALREADY_DISPATCHED` once anything was dispatched (issued stock is
  never silently restored — returns are a future workflow); refused with `FULFILMENT_IN_PROGRESS`
  while staged work exists; otherwise EP34 behaviour (reservations released). A cancelled order gets
  no new pick, pack or shipment (`SO_NOT_CONFIRMED`).

## 8. Delivery — `warehouse.delivery.confirm`

- **Deliver** (`POST /shipments/:id/deliver {lines?, recipientName?, reference?, note?, deliveredAt?}`)
  from DISPATCHED or DELIVERY_EXCEPTION: all outstanding, or per line (≤ outstanding,
  `DELIVERY_EXCEEDS_DISPATCHED`). Everything delivered → **DELIVERED** (terminal) with a DELIVERED
  event; anything left → **DELIVERY_EXCEPTION** with a PARTIALLY_DELIVERED event — the rest stays an
  explicit outstanding quantity. A later delivery resolves it. Time must be after dispatch and not in
  the future.
- **Exception** (`POST /shipments/:id/exception {reason, note?}`): FAILED_ATTEMPT,
  RECIPIENT_UNAVAILABLE, ADDRESS_ISSUE, DAMAGED_IN_TRANSIT, LOST_IN_TRANSIT, OTHER (+ note). It never
  creates a receipt, reverses an issue, refunds, changes Sales totals or creates an order.
- **Trust model (v1):** delivery is confirmed **internally** by a Warehouse manager (or the owner) from
  the carrier's / customer's proof — recipient name and a reference are recorded; there is no
  signature capture, GPS or carrier API, and no attachment (no file infrastructure yet).

## 9. Quantities and states (per sales order line)

Cumulative milestones (each counts everything that reached that step; cancelled documents count
nothing): **allocated** (ACTIVE + CONSUMED), **picked**, **packed**, **dispatched**, **delivered**;
outstanding: **toDispatch = ordered − dispatched**, **toDeliver = dispatched − delivered** (never
negative). Per line, in the line's unit — never summed across lines or units. Lines that are not
inventory-tracked (services) have `null` progress: they are not physical fulfilment and never block it.

Order `fulfilment.state` (CONFIRMED orders with tracked lines; null otherwise), from the tracked lines:
DELIVERED (all delivered) → EXCEPTION (a shipment in DELIVERY_EXCEPTION) → PARTIALLY_DELIVERED →
DISPATCHED → PARTIALLY_DISPATCHED → PICKED → PARTIALLY_PICKED → NOT_STARTED. The commercial status
stays CONFIRMED — nothing completes an order in EP35.

## 10. Permissions

| Code (new) | Tier | Covers |
| --- | --- | --- |
| `warehouse.picking.process` | OPERATE (Staff) | create / start / confirm / cancel picks; create / confirm / cancel packs; create / cancel shipments |
| `warehouse.dispatch.confirm` | MANAGE | dispatch (the stock issue) |
| `warehouse.delivery.confirm` | MANAGE | deliver, record exceptions |

Reading picks, packs and shipments uses `warehouse.inventory.view`. Warehouse Staff pick, pack and
prepare shipments but do not dispatch; Warehouse Managers (and the Owner) dispatch and confirm
delivery; Executive reads only; System Admin has nothing unless assigned to Warehouse (then Staff
tiers, never MANAGE); Sales Staff and Managers read progress on the order and hold no Warehouse code.
Every action also needs the document's branch; another branch's or company's document is 404.

## 11. Warehouse privacy

Pick, pack and shipment responses are allow-lists (`warehouse/fulfilment-views.ts`): order number /
status / requested date, items, units, quantities, locations, lots, expiry, people, dates, and — on a
shipment only — the operational ship-to name and address, carrier, tracking and recipient. **No
price, discount, tax, total, amount, cost, margin, deposit, payment, invoice, customer code, tax id or
order note** — tested key by key and value by value (a distinctive unit price never appears). Pending
Pick stays customer-free. Movements of type SALES_ISSUE link the shipment, nothing commercial.

## 12. Audit and timelines

`SALES_PICK_CREATED / _UPDATED (start) / _CONFIRMED / _CANCELLED`,
`SALES_PACK_CREATED / _CONFIRMED / _CANCELLED`,
`SALES_SHIPMENT_CREATED / _CANCELLED / _DISPATCHED / _DELIVERED / _EXCEPTION` on the document
(entity types `SalesPick`, `SalesPack`, `SalesShipment`) with document and order numbers and counts —
never money or customer data. Each document shows its timeline; the shipment shows its delivery
history. The Platform explorer redacts the three entity types (business entities). The demo writes
them with actor scope `seed`.

## 13. Screens

- **Warehouse** (lazy `FulfilmentArea`, one chunk): `/core/warehouse/picks`, `/packs`, `/shipments`
  lists (status, search, paging); pick page (confirm form per line: picked quantity, discrepancy when
  short), "Pack picked goods" (package count / reference), pack page with "Create shipment" (ship-to,
  address, carrier, tracking), shipment page (reservation state, lines with delivered / outstanding,
  delivery history, Dispatch with the confirmation *"Dispatching will deduct stock and consume the
  corresponding reservation. This action cannot be undone by editing the shipment."*, delivery and
  exception forms). Pending Pick: "Create pick" and "To pick" per location. Home tiles and nav for the
  three documents; movement history labels SALES_ISSUE and links the shipment.
- **Sales** order (inside the lazy `AllocationSection`): fulfilment state, per-line picked / packed /
  dispatched / delivered / to dispatch / to deliver, and shipments by number, status and date — no
  location, lot or Warehouse link.
- TH / EN / ZH; cards below 768 px; every confirmation box (start, dispatch, cancel …) returns focus to
  the document title when it closes (also on Escape); forms announce the result in the live notice.

## 14. Demo (`warehouse/fulfilment-demo.ts`, through the real service)

| Order | State |
| --- | --- |
| `SO_CONFIRMED` (EP34) | allocated, no pick → ready to pick |
| `SO_FUL_PICKING` | 12 reserved, one pick of 5 picked → partially picked (7 to pick) |
| `SO_FUL_PACKED` | 6 picked and packed (2 packages), no shipment |
| `SO_FUL_SHIPPED` | 4 shipped, dispatched and delivered (POD reference); 6 packed waiting → partially dispatched |
| `SO_FUL_EXCEPTION` | 3 dispatched, recipient unavailable |

`warehouse.demo` (Warehouse **Staff**, branch 00001) picks and packs; `owner.demo` dispatches and
records delivery. An order that already has a pick is left alone: a second seed changes nothing.

## 15. Separation and future contracts

- **Production (EP36+)** keeps its own movement types and sources (`PRODUCTION_CONSUMPTION`,
  `PRODUCTION_OUTPUT`) through `applyMovement()`; it never uses sales reservations or SALES_ISSUE.
- **Returns / reverse logistics (future):** a return will add its own document and a positive movement
  type (e.g. `SALES_RETURN`) referencing the dispatched shipment line; delivered / outstanding
  quantities and exception events are the evidence it starts from. A SALES_ISSUE is never edited or
  deleted; nothing in EP35 restores stock automatically.
- **Invoicing / AR (future)** reads dispatched / delivered quantities per line; EP35 carries no money.

## 16. Known limitations (deliberate)

- No barcode / scanner flow, carrier API, label printing, GPS, route planning or rates.
- No re-pick of a *different* lot or location: substitution means release / reallocate (EP34) after
  unwinding staged work. A discrepancy does not adjust stock — a separate adjustment or count does.
- One shipment belongs to one order (several shipments per order are supported).
- Delivery evidence is text (recipient, reference, note); no attachment until a file service exists.
- Lost or undelivered quantities stay outstanding exceptions; closing them (write-off, return,
  credit) is a future workflow. A partially dispatched order stays CONFIRMED.
- Service lines have no physical fulfilment and no completion marker.
