# Production Completion and Short Close (EP38)

Closing a production order is an explicit, reviewed decision. It is never automatic and never
triggered by one output report. Output: [PRODUCTION_OUTPUT.md](PRODUCTION_OUTPUT.md). Receipts:
[PRODUCTION_FINISHED_GOODS_RECEIPT.md](PRODUCTION_FINISHED_GOODS_RECEIPT.md). Execution:
[PRODUCTION_EXECUTION.md](PRODUCTION_EXECUTION.md).

```
READY → IN_PRODUCTION ⇄ PAUSED → COMPLETION_REVIEW → COMPLETED (outcome COMPLETED | SHORT_CLOSED)
                                         └→ IN_PRODUCTION (reopen)
```

`COMPLETION_REVIEW` and `COMPLETED` are new `ProductionOrderStatus` values (their own migration,
`20261110090000_ep38_enum_values`). The `production_order_guard` trigger allows exactly these moves,
makes COMPLETED terminal and keeps the completion facts immutable:

- `reviewRequestedAt / By`;
- `completedAt / By`;
- `completionOutcome`;
- `completionReason` (required for SHORT_CLOSED).

## 1. Actions (`operations.orders.update_status`, MANAGE — the EP27 code, now used)

| Action | From | Rule |
| --- | --- | --- |
| review `{ note? }` | IN_PRODUCTION · PAUSED | no DRAFT output report left (`OUTPUT_DRAFT_PENDING`) |
| reopen `{ note? }` | COMPLETION_REVIEW | back to IN_PRODUCTION (more output, more material) |
| complete `{ outcome, reason?, materialsReviewed: true }` | COMPLETION_REVIEW | below |

**While under review:**

- **Allowed:** accept or reject submitted output, post or reverse receipts, release reservations,
  record usage.
- **Refused:** new output reports, new reservations, excess, material issues and pause / start
  (`MO_NOT_IN_PRODUCTION` / `MO_INVALID_TRANSITION`).

## 2. Completion checks (one transaction, under the order lock)

| Check | Refusal |
| --- | --- |
| no output report DRAFT or SUBMITTED | `OUTPUT_REVIEW_PENDING` |
| no DRAFT finished goods receipt | `RECEIPT_PENDING` |
| every accepted unit is in stock (accepted − received = 0) | `OUTPUT_NOT_RECEIVED` |
| no DRAFT material issue | `MATERIAL_ISSUE_PENDING` |
| the material review is confirmed (`materialsReviewed: true`) | 400 (schema) |
| **COMPLETED**: accepted ≥ target, no ACTIVE reservation | `SHORT_CLOSE_REQUIRED`, `RESERVATIONS_ACTIVE` |
| **SHORT_CLOSED**: accepted < target, reason given | `NOT_SHORT`, `REASON_REQUIRED` |

The order view lists the current blockers (`completion.blockers`), so the screen shows what is
still to do.

**Full completion example:** target 100, accepted 100, received 100, nothing outstanding → COMPLETED.

**Short close example:** target 100, accepted 85, rejected 10, 5 never produced → SHORT_CLOSED with
the reason. What a short close keeps and changes:

- **Kept:** the original target, the good and rejected totals, and the shortfall (`remaining` 5).
- **Released:** remaining ACTIVE reservations (`ORDER_CLOSED`).
- **Never done:** consumed material is not restored, and no finished goods are created for the
  missing units.

## 3. Material reconciliation

The order view keeps the per-material figures from EP37, for review only:

- frozen requirement · reserved · issued · used;
- variance (used − required) · unrecorded (issued − used) · ACTIVE reservations.

Usage is **not** forced to equal the BOM. Issued but unused material stays visible as `unrecorded`.
Nothing is returned to stock automatically, since there is no return document yet. A future
return / disposition workflow will add its own positive movement type.

## 4. Closed order protection

A COMPLETED order accepts none of the following:

- new output reports (`MO_NOT_IN_PRODUCTION`) and accept / reject of output (`MO_COMPLETED`);
- receipts or reversals (`MO_COMPLETED`);
- reservations, material issues or execution changes (`MO_COMPLETED` / `MO_NOT_IN_PRODUCTION`);
- reopen or cancel (`MO_COMPLETED`).

These are enforced in the service policy and the database guard. Cancelling an order before
completion is refused once material was issued (EP37) or output was accepted
(`OUTPUT_ALREADY_RECORDED`).

## 5. Sales demand

Completion allocates nothing. Received finished goods are ordinary stock: the sales order that
caused the production order is allocated or reallocated **explicitly** by Sales (EP34). There are
no hidden reservations.

## 6. Traceability (granularity stated)

The order view returns:

- `traceability.outputLots`: the lots received by the order's posted receipts, with receipt and
  quantity;
- `traceability.materialLots`: the material lots consumed by its posted material issues, with
  issue and quantity.

The link is **order level**: every finished lot of the order connects to all the material issued to
that order:

```
finished lot → receipt → output report → production order → BOM revision → material issues → material lots
```

EP38 does not pair a particular material lot with a particular output batch, and does not pretend
to.

## 7. Audit and screens

**Audit:**

- `PRODUCTION_ORDER_REVIEW_REQUESTED / REOPENED / COMPLETED / SHORT_CLOSED`;
- `PRODUCTION_MATERIALS_RELEASED` with `ORDER_CLOSED` for a short close;
- all on the order timeline.

**Screens:**

- **Order detail:** the lazy `OutputPanel` shows output figures, reports, receipts, the completion
  section (blockers, outcome, material-review checkbox, confirm box with focus return) and
  traceability.
- **Overview tiles:** output to review, in completion review.
