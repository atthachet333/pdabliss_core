# EP48 — Bottleneck Rules

Code: `backend/src/executive/service.ts` (`collect`, `FLOWS`, `byPriority`, `byQueue`). Tests:
`backend/test/ep48-executive.test.ts` (scenarios R1–R12), real-stack script (76 checks).

## 1. Stages (one per document, the first rule that applies)

| Document         | Stage                      | Condition (canonical)                                                     | Department → next                                         | Evidence                          | Date / since                    |
| ---------------- | -------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------- | ------------------------------- |
| Sales order      | `SO_AWAITING_CONFIRMATION` | status SUBMITTED                                                          | SALES → SALES                                             | —                                 | requested / submittedAt         |
|                  | `SO_DELIVERY_EXCEPTION`    | CONFIRMED, a shipment in DELIVERY_EXCEPTION, not fully delivered          | SALES → WAREHOUSE                                         | open exception                    | requested / last dispatch       |
|                  | `SO_AWAITING_ALLOCATION`   | CONFIRMED, a tracked line reserved < ordered                              | SALES → SALES (a Sales manager allocates)                 | lines not reserved (open / total) | requested / confirmedAt         |
|                  | `SO_AWAITING_PICK`         | fully reserved, a line picked < ordered                                   | SALES → WAREHOUSE                                         | lines not picked                  | requested / confirmedAt         |
|                  | `SO_AWAITING_DISPATCH`     | fully picked, a line dispatched < ordered                                 | SALES → WAREHOUSE                                         | lines not dispatched              | requested / confirmedAt         |
|                  | `SO_IN_DELIVERY`           | fully dispatched, a line delivered < ordered                              | SALES → WAREHOUSE                                         | lines not delivered               | requested / last dispatch       |
| Purchase request | `PR_AWAITING_DECISION`     | SUBMITTED                                                                 | originating dept → PURCHASING (or that dept's manager)    | —                                 | needed-by / submittedAt         |
|                  | `PR_AWAITING_ORDER`        | APPROVED, a line ordered < requested                                      | originating dept → PURCHASING                             | lines not ordered                 | needed-by / approvedAt          |
| Purchase order   | `PO_AWAITING_DEPOSIT`      | WAITING_DEPOSIT, deposit PENDING                                          | PURCHASING → ACCOUNTING                                   | deposit pending                   | deposit due / issuedAt          |
|                  | `PO_AWAITING_RECEIPT`      | PENDING_RECEIVE, nothing received                                         | PURCHASING → WAREHOUSE                                    | lines not received                | expected / pendingReceiveAt     |
|                  | `PO_PARTIALLY_RECEIVED`    | PENDING_RECEIVE, some received, a line open                               | PURCHASING → WAREHOUSE                                    | lines not received                | expected / pendingReceiveAt     |
| Goods receipt    | `GR_TO_POST`               | DRAFT                                                                     | WAREHOUSE → WAREHOUSE                                     | recorded, not posted              | — / createdAt                   |
| Stock adjustment | `ADJ_TO_APPROVE`           | SUBMITTED                                                                 | WAREHOUSE → WAREHOUSE                                     | stock discrepancy                 | — / submittedAt                 |
| Cycle count      | `COUNT_IN_REVIEW`          | REVIEW                                                                    | WAREHOUSE → WAREHOUSE                                     | stock discrepancy                 | — / reviewAt                    |
|                  | `COUNT_OPEN`               | DRAFT / COUNTING                                                          | WAREHOUSE → WAREHOUSE                                     | not finished                      | count date / started or created |
| Transfer         | `TRANSFER_TO_POST`         | DRAFT                                                                     | WAREHOUSE → WAREHOUSE                                     | draft                             | — / createdAt                   |
| Production order | `MO_AWAITING_APPROVAL`     | SUBMITTED                                                                 | OPERATIONS → OPERATIONS                                   | —                                 | required / submittedAt          |
|                  | `MO_MATERIALS_SHORT`       | APPROVED and the EP36 shortage handoff lists ≥ 1 material for it          | OPERATIONS → PURCHASING                                   | n materials short (count only)    | required / approvedAt           |
|                  | `MO_AWAITING_RESERVATION`  | APPROVED, no shortage                                                     | OPERATIONS → OPERATIONS                                   | —                                 | required / approvedAt           |
|                  | `MO_READY_TO_START`        | READY                                                                     | OPERATIONS → OPERATIONS                                   | —                                 | required / releasedAt           |
|                  | `MO_PAUSED`                | PAUSED                                                                    | OPERATIONS → OPERATIONS                                   | paused                            | required / pausedAt             |
|                  | `MO_FG_TO_RECEIVE`         | IN_PRODUCTION / COMPLETION_REVIEW with accepted output not fully received | OPERATIONS → WAREHOUSE                                    | n output reports not received     | required / review or start      |
|                  | `MO_COMPLETION_REVIEW`     | COMPLETION_REVIEW, nothing to receive                                     | OPERATIONS → OPERATIONS                                   | —                                 | required / reviewRequestedAt    |
|                  | `MO_OUTPUT_TO_REVIEW`      | IN_PRODUCTION with SUBMITTED output                                       | OPERATIONS → OPERATIONS                                   | n reports                         | required / startedAt            |
|                  | `MO_AWAITING_ISSUE`        | IN_PRODUCTION with ACTIVE reservations                                    | OPERATIONS → OPERATIONS (Operations posts issues in CORE) | n reservations                    | required / startedAt            |
|                  | `MO_IN_PRODUCTION`         | IN_PRODUCTION otherwise                                                   | OPERATIONS → OPERATIONS                                   | —                                 | required / startedAt            |

Drafts, cancelled, rejected and completed documents produce no item. Pick, pack and shipment documents are not separate
items — their work is the Sales order's stage (no double counting).

## 2. Flows (cross-department handoffs)

| Flow                    | Stages                                                          | Notes                                                                                                                   |
| ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Sales → Warehouse       | allocation, pick, dispatch, delivery, exception                 | allocation is listed in the flow (it reserves Warehouse stock) but its next department is Sales — the dashboard says so |
| Purchasing → Warehouse  | awaiting receipt, partially received, goods receipts to post    | a receipt draft and its order are two documents (both appear)                                                           |
| Production → Warehouse  | awaiting reservation, awaiting issue, finished goods to receive | reservation and issue are Operations steps in CORE; finished goods are Warehouse's                                      |
| Purchasing → Production | materials short                                                 | the verified link: the production order's own material requirement (EP36 handoff)                                       |
| Accounting → Purchasing | awaiting deposit                                                | supported by the CORE Accounting module (supplier deposits only)                                                        |

## 3. Classification (no invented thresholds)

| Class          | Rule                                                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLOCKED`      | a canonical workflow condition stops progress: open delivery exception, production shortage (release is refused until materials exist), production paused               |
| `OVERDUE`      | the document's own date is before today (`overdueDays` = whole days)                                                                                                    |
| `MISSING_DATE` | purchase orders awaiting receipt without an expected date and approved production orders without a required date — lateness cannot be judged (information, not a fault) |
| `WAITING`      | normal waiting                                                                                                                                                          |

Attention reasons: `DELIVERY_EXCEPTION`, `PRODUCTION_SHORTAGE`, `PRODUCTION_PAUSED`, `OVERDUE_DELIVERY`,
`OVERDUE_RECEIPT`, `OVERDUE_PRODUCTION`, `OVERDUE_DEPOSIT`, `OVERDUE_REQUEST`, `OVERDUE_COUNT`, `STOCK_DISCREPANCY`.
The Command Center names the department that acts next; it never states that a department **caused** a delay (a late
receipt may be the supplier's; a shortage may be planning's) — only the evidence and the next step.

## 4. Ordering

`byPriority`: class (BLOCKED, OVERDUE, MISSING_DATE, WAITING) → for BLOCKED the reason order above → days overdue
(desc) → days in stage (desc) → document number → id. `byQueue`: BLOCKED, then OVERDUE, then stock discrepancies, each
by `byPriority`. Deterministic for equal data (unit-tested).
