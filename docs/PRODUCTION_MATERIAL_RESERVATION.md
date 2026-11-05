# Production Material Reservation and FEFO Allocation (EP37)

A production order's materials are **reserved** in the warehouse before production starts: the
production counterpart of the EP34 sales allocation. A reservation is a claim on physical stock at a
location / lot. It moves nothing: on hand is unchanged, and no StockMovement is written. Issue:
[PRODUCTION_MATERIAL_ISSUE.md](PRODUCTION_MATERIAL_ISSUE.md). Execution:
[PRODUCTION_EXECUTION.md](PRODUCTION_EXECUTION.md). Orders: [PRODUCTION_ORDER.md](PRODUCTION_ORDER.md).
Report: [EP37_REPORT.md](EP37_REPORT.md).

```
APPROVED / READY order → allocate (FEFO) → ACTIVE reservations → start → material issue (DRAFT)
→ post → reservation CONSUMED + PRODUCTION_CONSUMPTION movement
                    release / reallocate / cancel → reservation RELEASED (history kept)
```

## 1. Model — `ProductionMaterialAllocation`

| Field | Meaning |
| --- | --- |
| company / branch / `productionOrderId` | composite FK to `(order, branch, company)`: a reservation belongs to one order of one branch |
| `materialId` + `itemId` | composite FK to `(ProductionOrderMaterial, order, item)`: always a frozen requirement line of this order and its own item |
| `locationId` + `lotId` / `lotKey` | where the stock is held. Location FK `(location, branch)` = the order's branch; lot FK `(lot, item, company)` |
| `quantity` | `Decimal(18,6)` > 0 |
| `excess`, `excessReason` | manager-authorized extra material beyond the requirement (reason required) |
| `status` | `ACTIVE` → `CONSUMED` (by an issue line) or `RELEASED` (`releaseReason` RELEASED · REALLOCATED · ORDER_CANCELLED) |
| `activeSlot` | `true` while ACTIVE, `NULL` otherwise. Unique `(material, location, lotKey, excess, activeSlot)` = one ACTIVE row per place |
| `issueLineId` (unique), `consumedAt` | the issue line that consumed it |
| `splitFromId` | a CONSUMED part split off an ACTIVE row by a partial issue |
| created / released by and at | facts |

Database triggers refuse deletes, keep company / branch / order / material / item / location / lot
immutable, allow only ACTIVE → CONSUMED / RELEASED (terminal rows are frozen), and allow quantity
changes only on ACTIVE rows. No price, cost or value field exists.

## 2. One shared reservation guard (Sales + Production)

`warehouse/reservations.ts` is the only place that answers "how much of this balance is claimed":

```
reserved(balance) = Σ ACTIVE SalesAllocation + Σ ACTIVE ProductionMaterialAllocation
free(balance)     = on hand − reserved(balance)
```

`reservedBreakdown()` returns the two parts separately for screens. Every reader uses it:

- Sales availability (`stockFor`) and Sales FEFO allocation;
- Production availability, requirements and FEFO allocation;
- transfer and adjustment drafts (`usableOf`);
- the ledger's decrease check (`takeRespectingReservations` in `applyMovement`).

So a sales reservation can never take production-reserved stock, a production reservation can never
take sales-reserved stock, and no transfer, adjustment, count correction or goods-receipt reversal
can move reserved stock out from under either. All of these fail with 409 `STOCK_RESERVED`, whose
message now reads "reserved (for sales or production)". Dispatch consumes only its own sales rows.
Material issue consumes only its own production rows.

## 3. FEFO allocation — `production/allocation.ts`

`POST /production/orders/:id/materials/allocate` (no body). Allowed on APPROVED, READY,
IN_PRODUCTION and PAUSED orders. Needs `operations.materials.manage`.

```
stillNeeded(material) = required − (non-excess ACTIVE + non-excess CONSUMED)
candidates            = the order branch's balances of the item: active location, on hand > 0,
                        lot not expired (company-timezone today), ordered by byFefo
                        (expiry asc, none last; then receipt; then id)
take from each        = min(stillNeeded, free(balance))
```

- **Repeatable, never double.** A second allocate reserves only what is still needed. A fully
  reserved order reserves nothing and writes no audit event. An existing ACTIVE row for the same
  (material, location, lot, excess) grows instead of a second row being created.
- **Partial.** Short stock reserves what exists. The response `allocation` lists
  `required / reservedNow / covered / shortage` per material, and a later allocate tops up.
- **Branch-bound.** Other branches' stock is never a candidate; expired lots and inactive
  locations are never candidates.
- **Rounding.** Quantities are exact decimals at the unit's precision (the requirement was already
  rounded up at planning).
- **Locking.** Order row `FOR UPDATE` → `StockBalance` candidate rows `FOR UPDATE` in id order →
  reservation reads. Sales allocation locks the same balance rows, so a Sales and a Production
  allocation on the same stock serialize. The second sees the first's reservation and takes only
  what is still free (tested: 7 + 7 requested on 10 → exactly 10 reserved, three rounds). A
  deadlock becomes 409 `CONCURRENT_UPDATE`, never 500.

## 4. Release and reallocate

- `POST …/materials/release`: every ACTIVE row → RELEASED (`RELEASED`). CONSUMED history stays.
  409 `MO_NOT_RESERVED` when nothing is ACTIVE.
- `POST …/materials/reallocate`: release (`REALLOCATED`) and FEFO-allocate again from current stock,
  in one transaction. Use it after new stock with an earlier expiry arrives.
- Both are refused with 409 `MATERIAL_ISSUE_PENDING` while a DRAFT material issue exists, because
  the draft's lines point at specific reservations. Post or cancel the draft first.
- Cancelling the order releases every ACTIVE row (`ORDER_CANCELLED`) and cancels draft issues (see
  PRODUCTION_EXECUTION.md §3).

## 5. Excess material

`POST …/materials/:materialId/excess { quantity, reason }`. Allowed on IN_PRODUCTION / PAUSED orders.
Needs `operations.materials.manage`; the reason is required.

It FEFO-reserves extra material beyond the frozen requirement as `excess = true` rows. Excess never
counts toward `stillNeeded`, so it cannot hide a shortage. 409 `MATERIALS_SHORT` when nothing is free;
a partial excess is reported (`partial` in the audit event). Excess rows are issued like any other
reservation, and the material line shows `excess` separately.

## 6. Derived state (never stored)

Per material line in the order view:

| Field | Meaning |
| --- | --- |
| `required` | frozen requirement |
| `reserved` | ACTIVE (incl. excess) |
| `issued` | CONSUMED (incl. excess) |
| `used` | Σ recorded usage |
| `stillNeeded` | required − non-excess (reserved + issued) |
| `excess` | Σ excess (ACTIVE + CONSUMED) |
| `available` | free stock FEFO could still reserve now |
| `shortage` | max(0, stillNeeded − available) |
| `usageVariance` | used − required |
| `unrecorded` | issued − used |

Per order, `reservationState` is NOT_RESERVED · PARTIALLY_RESERVED · FULLY_RESERVED · PARTIALLY_ISSUED
· ISSUED. `GET /production/orders?stage=RESERVATION` lists APPROVED · READY · IN_PRODUCTION · PAUSED orders
(`stage=EXECUTION` only IN_PRODUCTION / PAUSED), and the requirements view adds
reserved / issued / stillNeeded per material.

## 7. Audit

`PRODUCTION_MATERIALS_ALLOCATED` (materials touched, short materials) ·
`PRODUCTION_MATERIALS_RELEASED` (reason, count) · `PRODUCTION_MATERIALS_REALLOCATED` (released,
materials) · `PRODUCTION_EXCESS_ALLOCATED` (material code, partial) on entity `ProductionOrder`.
Events record counts and codes only; quantities and reason text never appear in them.

## 8. Known limitations (deliberate)

- No manual pick of a specific lot / location (FEFO only); no cross-branch reservation.
- No reservation priority between Sales and Production: first committed wins, and the other sees
  less free stock.
- No automatic reallocation when stock changes; reallocate is explicit.
