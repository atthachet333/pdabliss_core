# Production Output Reports (EP38)

An **output report** (`OUT-YYYYMM-NNNNNN`) records what production made for one production order:
good, defective and pending-quality quantities of the order's finished item, in the order's unit.
**Reporting output never moves stock.** Finished goods become physical inventory only when Warehouse
posts a finished goods receipt ([PRODUCTION_FINISHED_GOODS_RECEIPT.md](PRODUCTION_FINISHED_GOODS_RECEIPT.md)).
Completion: [PRODUCTION_COMPLETION.md](PRODUCTION_COMPLETION.md). Report: [EP38_REPORT.md](EP38_REPORT.md).

```
order IN_PRODUCTION / PAUSED → report (DRAFT) → SUBMITTED → ACCEPTED (quality decision) → receipt(s)
                                                       └→ REJECTED (reason)
DRAFT / SUBMITTED → CANCELLED · ACCEPTED → CANCELLED only while nothing of it is in stock
```

## 1. Model — `ProductionOutputReport`

| Field | Meaning |
| --- | --- |
| company / branch / `productionOrderId` | composite FK to `(order, branch, company)` |
| `number` | `OUT-YYYYMM-NNNNNN`, atomic `DocumentSequence` (`OUT:YYYYMM`), unique per company, immutable |
| `productionDate` | between the order's start day and today (company time zone) |
| `goodQuantity`, `defectiveQuantity`, `pendingQuantity` | ≥ 0, at least one > 0, unit precision; pending = awaiting the quality decision |
| `acceptedQuantity`, `rejectedQuantity` | set at acceptance: accepted = good + the pending part judged good; rejected = defective + the rest |
| creator, submitted, reviewed (accept / reject), cancelled — by and at, reasons | facts |

Database rules (CHECK + trigger):

- **Accepted split.** An accepted report always splits exactly what was reported:
  accepted + rejected = good + defective + pending, and accepted ≥ good.
- **Reported figures.** Quantities, date and note change only in a DRAFT.
- **The quality decision.** It never changes once made.
- **Transitions.** Only the ones above are allowed, and nothing is deleted.

## 2. Quantities per order (derived, never stored)

| Figure | Formula |
| --- | --- |
| target | the order quantity (unchanged, also after a short close) |
| good reported | Σ good of SUBMITTED + ACCEPTED reports |
| pending review | Σ pending of SUBMITTED reports |
| accepted | Σ accepted of ACCEPTED reports |
| rejected | Σ rejected of ACCEPTED + Σ defective of SUBMITTED |
| received | Σ quantity of POSTED finished goods receipts (a REVERSED one no longer counts) |
| awaiting receipt | accepted − received |
| remaining | max(0, target − accepted) |

All figures are in the order's unit. Nothing is double counted: a report is counted once by its
status, and a receipt once by its status.

**Target cap.** Σ accepted per order never exceeds the target: checked at submit (accepted + submitted
good + this report) and again at acceptance, under the order lock (`OUTPUT_EXCEEDS_TARGET`).

## 3. Who

| Action | From | Code | Notes |
| --- | --- | --- | --- |
| create / edit / submit | order IN_PRODUCTION · PAUSED | `operations.output.create` (OPERATE) | the reporter's own report; a DRAFT is visible to its reporter and approvers only |
| accept `{ pendingGood? }` | SUBMITTED; order IN_PRODUCTION · PAUSED · COMPLETION_REVIEW | `operations.output.approve` (MANAGE) | `pendingGood` between 0 and pending (`PENDING_DECISION_INVALID`) |
| reject `{ reason }` | SUBMITTED | same | reason required |
| cancel `{ reason? }` | DRAFT / SUBMITTED | reporter or approver | its DRAFT receipts are cancelled too |
| cancel `{ reason }` | ACCEPTED | approver | refused once a receipt is POSTED (`OUTPUT_ALREADY_RECEIVED`): reverse the receipt first |

Every write locks the production order row, then the report row. A double submit, an accept race
or accept vs cancel each result in one transition, with 409 for the others and never 500.

## 4. Rejected and defective output

Defective and rejected quantities are **evidence only**:

- They never enter saleable stock, and no movement is written for them.
- Nothing was received, so there is nothing to scrap or adjust.
- There is no quarantine balance. If rejected goods are physically kept, that stays outside
  saleable stock; a controlled quarantine / rework / scrap workflow is future work.

## 5. Audit

`PRODUCTION_OUTPUT_CREATED / UPDATED / SUBMITTED / ACCEPTED / REJECTED / CANCELLED` on entity
`ProductionOutputReport`. Details are the number, order, from → to, and `withRejects` / counts —
never quantities. It is a business audit entity, redacted on the Platform explorer.

## 6. API (`/api/v1/production/outputs`)

`GET /` (status, productionOrderId, branchId, q, page, pageSize ≤ 100) · `POST /` · `GET /:id` ·
`PATCH /:id` · `POST /:id/submit` (no body) · `POST /:id/accept { pendingGood? }` ·
`POST /:id/reject { reason }` · `POST /:id/cancel { reason? }`.

## 7. Known limitations (deliberate)

- One finished item per order (the order's). No co-products or by-products.
- No rework, scrap or quarantine documents. No yield analytics.
- No output per shift, machine or operator.
