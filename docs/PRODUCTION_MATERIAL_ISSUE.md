# Production Material Issue (EP37)

A **material issue** (`MI-YYYYMM-NNNNNN`) moves reserved material out of warehouse stock into
production. Posting it is the only Production action that changes physical stock. It writes a
`PRODUCTION_CONSUMPTION` movement through the canonical ledger (`ledger.ts applyMovement()`) and
consumes exactly the reservations it names. Reservations:
[PRODUCTION_MATERIAL_RESERVATION.md](PRODUCTION_MATERIAL_RESERVATION.md). Ledger:
[INVENTORY_LEDGER.md](INVENTORY_LEDGER.md) §11.

```
IN_PRODUCTION order → create issue (DRAFT, lines = reservations) → edit lines → post (POSTED)
                                                                 → cancel (CANCELLED)
```

## 1. Model

`ProductionMaterialIssue`:

| Field | Meaning |
| --- | --- |
| company / branch / `productionOrderId` | composite FK to the order's `(order, branch, company)` |
| `number` | `MI-YYYYMM-NNNNNN` — atomic `DocumentSequence` upsert (`MI:YYYYMM`), unique per company, immutable |
| `status` | DRAFT → POSTED or DRAFT → CANCELLED (+ `cancellationReason`); POSTED and CANCELLED are terminal |
| `note` | optional |
| `lineCounter` | number of lines |
| created / posted / cancelled by and at | facts |

`ProductionMaterialIssueLine`:

| Field | Meaning |
| --- | --- |
| `lineNo` | line number |
| `materialId` | the requirement line |
| `allocationId` | composite FK `(allocation, order, material, location, lotKey)`: the reservation it draws from, which must be the same place |
| item / location / lot | where the material comes from |
| `quantity` | > 0 |

Triggers refuse deletes of issues, keep numbers / order / branch immutable, allow only the two
transitions, and freeze lines once the issue is not DRAFT. A `StockMovement` carries
`productionMaterialIssueId` / `productionMaterialIssueLineId` (FK to the line) and is unique per
`(productionMaterialIssueLineId, type)`, so one line can never be posted twice.

## 2. Draft

`POST /production/issues { productionOrderId, lines?, note? }` needs `operations.material_issues.create`
and an IN_PRODUCTION order (409 `MO_NOT_IN_PRODUCTION`).

- **Without `lines`**, the draft takes every ACTIVE reservation's unclaimed quantity (FEFO order).
- **With `lines`** (`[{ allocationId, quantity }]`), each must be one of this order's ACTIVE
  reservations, and is checked for:
  - an inactive reservation → 409 `RESERVATION_NOT_ACTIVE`;
  - a duplicate line → 422 `DUPLICATE_LINE`;
  - too many decimals for the unit → 422 `QUANTITY_PRECISION`;
  - more than the reservation still holds after other drafts' claims → 409 `ISSUE_EXCEEDS_RESERVATION`.
- 422 `NOTHING_TO_ISSUE` when nothing is free to claim.

`PUT /production/issues/:id/lines { lines }` replaces a draft's lines under the same rules (the
draft's own claims are excluded). `POST /production/issues/:id/cancel { reason? }` cancels a draft
(either issue code). The reservations stay ACTIVE for the next issue.

**A draft moves nothing**: on hand, balances and reservations are unchanged until posting.

## 3. Posting

`POST /production/issues/:id/post` needs `operations.material_issues.approve` (MANAGE) and an
IN_PRODUCTION order. A paused order cannot receive material. One transaction:

1. Lock the production order row `FOR UPDATE`, then the issue row (409 `MI_ALREADY_POSTED` /
   `MI_INVALID_TRANSITION` if it is no longer DRAFT).
2. Take the location advisory locks (shared; a cycle count takes them exclusive). Stock under an
   open count cannot move: the ledger refuses it with 409 `COUNT_IN_PROGRESS` (tested).
3. Lock the `StockBalance` rows, then the reservation rows, each in id order.
4. For each line, re-check that the reservation is still ACTIVE and holds the quantity (409
   `RESERVATION_MISMATCH`, nothing issued). Then **consume exactly what leaves**:
   - all of the reservation → the row becomes CONSUMED with `issueLineId`;
   - part of it → the row is decremented and a CONSUMED split row (`splitFromId`, same excess flag
     and reason) is created for the issued part.
5. `applyMovement(type PRODUCTION_CONSUMPTION, delta −quantity, sourceType PRODUCTION_ISSUE)`. The
   reservation is already consumed, so the reserved-stock guard sees this stock as free for this
   movement only. A shortage fails with `INSUFFICIENT_STOCK`, and negative stock is impossible.
6. Issue → POSTED, then audit `MATERIAL_ISSUE_POSTED`.

Any failure rolls the whole issue back. Concurrency (tested, three rounds each):

- triple post → one 200, two 409 `MI_ALREADY_POSTED`, one movement per line;
- issue post vs a sales dispatch of the same item → each consumes only its own reservation;
- issue post vs order cancel → either posted and the cancel refused (`MATERIAL_ALREADY_ISSUED`), or
  cancelled with the draft issue cancelled and the post refused.

Reconciliation after every race: Σ movements = on hand per balance, no negative balance, and every
PRODUCTION_CONSUMPTION movement matches one CONSUMED reservation of the same quantity.

## 4. Warehouse handoff (read-only)

`GET /api/v1/warehouse/material-issues?status=DRAFT|POSTED` needs `warehouse.material_issues.view`
(READ, Warehouse roles by default). It lists issue number, status, order number, date and lines
(item, location, lot, expiry, quantity, unit) for the member's branches. Warehouse cannot create,
edit, post or cancel an issue, and cannot open production orders. The screen is
`/core/warehouse/material-issues`, linked from the Warehouse menu when the context allows it.

## 5. Privacy and isolation

There are no price, cost, value, customer or sales-commercial fields in any issue view (allow-list
views, tested key by key). Another branch's or company's issue is 404, and mass assignment of
`status`, `number`, `postedBy`, `companyId`, … is 400 (strict schemas).

## 6. Audit

`MATERIAL_ISSUE_CREATED / UPDATED / POSTED / CANCELLED` on entity `ProductionMaterialIssue`
(number, order number, from → to, line count — never quantities). The entity is in
`BUSINESS_AUDIT_ENTITIES` and is redacted on the Platform explorer. The order timeline shows issue
events next to order events.

## 7. API (`/api/v1/production/issues`)

`GET /` (status, productionOrderId, branchId, q, page, pageSize ≤ 100) · `POST /` · `GET /:id` · `PUT /:id/lines` ·
`POST /:id/post` (no body) · `POST /:id/cancel { reason? }`.

## 8. Known limitations (deliberate)

- No return of unused material to stock (a return / reversal document is future work); variance is
  recorded as usage evidence only.
- No posting reversal; a posted issue is final.
- No finished goods output (EP38: `PRODUCTION_OUTPUT`).
