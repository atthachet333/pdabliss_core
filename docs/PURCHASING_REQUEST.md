# Purchase Requests (EP29)

The first operational document in CORE: a department asks for goods, materials or services
**before** any purchase order exists. A purchase request (PR) records the need — what, how much,
for which department and branch, by when, and why — and one decision (approve or reject). It
holds **no price, cost, discount, tax, supplier or quote**: commercial terms belong to the
future purchase order.

Source of truth: `backend/src/purchasing/` (`policy.ts` actor + transition policy, `input.ts`
schemas, `service.ts`, `demo.ts`), `backend/src/routes/v1/purchase-requests.ts`, migration
`20261101090000_ep29_purchase_request`. Screens: `frontend/src/features/purchasing/`
(`/core/purchasing/*`, one lazy chunk).

## 1. Model

`PurchaseRequest` — company, **branch** (FK carries the company id), **number**, **department**
(canonical `DepartmentCode`), **requester** (`CompanyMember`, company-bound FK), status, request
date (company time zone), need-by date (optional), purpose, line counter, branch / requester
snapshots (taken on submit), and decision fields: `submittedAt`, `approvedAt` +
`approvedByMemberId`, `rejectedAt` + `rejectedByMemberId` + `rejectionReason`, `cancelledAt` +
`cancelledByMemberId` + `cancellationReason`.

`PurchaseRequestLine` — `lineNo` (1, 2, 3 …, unique per request, never reused after a removal),
type, quantity (`numeric(18,6)`, exact decimal, > 0), note, and either

- **ITEM**: canonical `itemId` + `unitId` (the item's base unit; no conversion in EP29) with
  **server-derived snapshots** `itemCode`, `itemName`, `unitCode`, `unitName`; or
- **NON_ITEM**: a `description` of a one-off need (a service, a repair) with an optional canonical
  unit or a short unit text — no fake Item required.

Database invariants (CHECKs): number format `PR-NNNNNN-NNNNNN`; quantity > 0; ITEM lines name an
item, unit and snapshots, NON_ITEM lines name no item and have a description; a decision always
has its actor and time, a rejection its reason, a cancellation its actor and time; every request
past DRAFT has `submittedAt`. Every relation is company-bound (`(id, companyId)` foreign keys), so
a line cannot point at another company's item or unit, and a request cannot sit in another
company's branch.

## 2. Numbering

`PR-YYYYMM-NNNNNN` (e.g. `PR-202610-000001`): **company-wide** (not per branch — Purchasing and
Accounting reference one series; the branch is its own field), restarting each month, taken when
the draft is created and **immutable**. The counter is `DocumentSequence (companyId, key
'PR:YYYYMM', lastValue)`, incremented by one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`
in the transaction that creates the request, its lines and the audit entry — never `MAX + 1`. The
month is the company's local month (`Company.timezone`). Tested: 12 (API test) and 10 (real
stack) simultaneous creates give consecutive unique numbers.

## 3. Lifecycle and transition matrix

`DRAFT → SUBMITTED → APPROVED | REJECTED`, and `→ CANCELLED` where allowed. APPROVED is the
request decision — not "completed"; the purchase order starts later.

| Action | From | Who | To | Notes |
| --- | --- | --- | --- | --- |
| edit header / lines | DRAFT | the requester, still allowed to raise requests from the request's department | DRAFT | lines: add / change / remove |
| submit | DRAFT | same | SUBMITTED | needs purpose, ≥ 1 line, need-by ≥ request date, item lines' item + unit still active; snapshots refreshed then frozen |
| approve | SUBMITTED | a **decider** for the request's department | APPROVED | stores approver + time |
| reject | SUBMITTED | same | REJECTED | **reason required** (≤ 500) |
| cancel | DRAFT | the requester | CANCELLED | reason optional |
| cancel | SUBMITTED | the requester | CANCELLED | **reason required** |
| cancel | APPROVED | `purchasing.requests.cancel` (Purchasing managers, owner) | CANCELLED | **reason required**; until a PO exists |
| — | REJECTED, CANCELLED | — | — | terminal |

Deciders: `purchasing.requests.approve` (any department) or `<dept>.purchase_requests.approve`
(that department's requests). Every action also needs **branch access** to the request's branch
(EP26). The policy lives in one table (`policy.ts`, `refusal()`); routes never compare statuses
or roles. Someone without authority gets 403 without learning the state; with authority, a wrong
status is 409 (`PR_NOT_EDITABLE` / `PR_INVALID_TRANSITION`).

**Concurrency.** Decisions are conditional updates on the status they were decided from: of two
simultaneous approve / reject calls exactly one succeeds; the other gets `PR_STATE_CHANGED` (409)
or `PR_INVALID_TRANSITION`, and exactly one decision event is audited (tested 6 × three-way race
in the API suite, 4 × on the real stack). Line edits and submit lock the request row and re-check
DRAFT inside the transaction.

**Separation of duties.** v1 allows a decider to decide their own request (e.g. a Purchasing
manager's own PR). A "requester ≠ approver" rule can be added in the policy table later.

## 4. Permissions (EP27 catalog)

No `submit` / `reject` actions were added: submitting is part of `create` (OPERATE), rejecting is
the negative side of the `approve` decision (MANAGE).

| Code | Tier | Meaning |
| --- | --- | --- |
| `purchasing.requests.view` | READ | the Purchasing queue: every non-draft request in the member's branches |
| `purchasing.requests.create` | OPERATE | raise / edit / submit / cancel own requests from Purchasing |
| `purchasing.requests.approve` | MANAGE | decide (approve or reject) any department's request |
| `purchasing.requests.cancel` | MANAGE | cancel an approved request |
| `sales` · `operations` · `warehouse` · `accounting` `.purchase_requests.create` | OPERATE | raise own requests from that department |
| `sales` · `operations` · `warehouse` · `accounting` `.purchase_requests.approve` | MANAGE | decide (and see) that department's requests |

Role defaults (EP27 tiers): **Purchasing Manager** — view, create, approve, cancel;
**Purchasing Staff** — view + create; **Department Manager** (Sales / Operations / Warehouse /
Accounting) — create + decide own department; **Department Staff** — create own; **Viewer** —
Purchasing viewers read the queue, others nothing; **Executive** — reads every non-draft request
(READ everywhere), never mutates; **Owner** — everything; **System Admin** — no implicit
operational authority (only in departments it is assigned to). Exceptions (ALLOW / DENY) work as
in EP27.

## 5. Visibility (server-side)

A member sees a request when it is **their own** (any status, any branch, while their membership
is active), or when it is **not a draft**, in a branch they may work in, and they hold
`purchasing.requests.view` (all departments) or decide its department. Drafts are private to the
requester. A request the member may not see is "not found" (404). List views:

| `view` | Contents |
| --- | --- |
| `all` (default) | everything visible |
| `mine` | own requests |
| `department` | non-drafts of departments the member decides |
| `queue` | SUBMITTED requests in the Purchasing / department scope — the Purchasing queue |

Filters: status, department, branch (the screens default to the selected branch; "all my
branches" available), request-date range, search (number, purpose, requester name); sort `updated`
(default) or `number`; 25 per page (≤ 100).

## 6. Branch and department scope

- A new request is created in the session's **selected branch** (EP26 context: active
  membership, active branch, branch access) — the client never names it. No selected branch →
  `BRANCH_REQUIRED`.
- The request department must be one the member may raise requests from (resolver:
  enabled + in the package + assigned + not denied) — otherwise `DEPARTMENT_NOT_ALLOWED`. A
  one-department member gets it fixed; several → a choice among those only.
- Losing branch access closes the request's actions for that member (they can still read their
  own request).

## 7. Snapshot policy

- **Item lines** keep canonical ids **and** the item code / name and unit code / name, derived on
  the server when the line is written and refreshed once at submit; from then on frozen. A later
  rename or deactivation of the item does not change the request (the detail marks an inactive
  item as such).
- **Branch** code / name and **requester** name are snapshotted at submit (renames later do not
  rewrite history); the branch FK and requester membership id remain the canonical links.
- **Department** is stored as its canonical code; names localize at display time.
- Decision actors are canonical membership ids; their display names come from the account.

## 8. Audit and timeline

`PURCHASE_REQUEST_CREATED`, `_UPDATED` (field names), `_LINE_ADDED` / `_LINE_UPDATED` /
`_LINE_REMOVED` (line no, kind, item code), `_SUBMITTED`, `_APPROVED`, `_REJECTED`, `_CANCELLED`
(from → to, whether a reason was given). Never the purpose, notes, descriptions or reasons
themselves (those live on the request). The detail page shows a short timeline — created,
submitted, approved / rejected / cancelled — with actor and time. Platform Inspection shows that
request events happened, never their details or numbers. No email or notification in EP29.

## 9. API (`/api/v1/purchase-requests`, session required)

| Method | Path |
| --- | --- |
| GET | `/context` — create / decide departments, queue flag, branches, selected branch |
| GET · POST | `/` (list · new DRAFT `{ department, purpose?, needByDate?, lines? }`) |
| GET · PATCH | `/:id` (detail with `actions` and `timeline` · DRAFT header) |
| POST · PATCH · DELETE | `/:id/lines` · `/:id/lines/:lineId` |
| POST | `/:id/submit` · `/:id/approve` · `/:id/reject {reason}` · `/:id/cancel {reason?}` |
| GET | `/item-options?q=` (active items, identity + base unit only) · `/unit-options` |

Strict bodies: `companyId`, `branchId`, `number`, `status`, `requesterMemberId`, `approvedBy…`,
`approvedAt`, snapshots, `unitPrice` and any other unknown field are refused (400); quantities
must be decimal strings. There is no status PATCH.

## 10. Screens

CORE home: the Purchasing card opens `/core/purchasing`; anyone with a request permission gets
a "Purchase requests" entry. **Workspace**: My requests / To decide / Approved (counts from the
API) and "New purchase request". **List**: view tabs, search + status / department / branch
filters, real table ≥ 768 px (need-by hidden 768–1023 px) and labelled rows below. **Create**:
department (fixed when only one), purpose, need-by → draft in the selected branch. **Detail**:
facts, header form and line editor for a DRAFT (item picker with unit precision, described
needs), action buttons from `actions`, each confirmed in place (reject and cancel-after-submit ask
for a reason; Escape backs out; focus returns to the heading), timeline. Status is text plus a
subtle tone, never colour alone. TH / EN / ZH; purposes and notes stay as written.

## 11. Demo data

`db:seed:demo` adds four requests once each (stable `demo` key in the creating audit entry; never
touched again): Warehouse DRAFT (demo branch, by `warehouse.demo`), Sales SUBMITTED (Head Office,
`sales.demo`), Operations APPROVED by `purchasing.demo`, Purchasing REJECTED by `owner.demo`.
`purchasing.demo@pdabliss.com` is the primary EP29 persona.

## 12. Purchase-order handoff (EP30)

An APPROVED request exposes everything a purchase order needs: branch, department, purpose,
requester, and its lines (canonical `itemId` / `unitId` or description, quantity, snapshots).
A future `PurchaseOrder` / `PurchaseOrderLine` references `purchaseRequestId` and
`purchaseRequestLineId` through the company-bound keys already in place (`@@unique([id,
companyId])` on both tables), adds `supplierId`, prices and terms with their own permissions and
Warehouse-excluded views, and tracks ordered quantity per request line. EP29 deliberately stores
no ordered / remaining quantity; `purchasing.requests.cancel` on APPROVED is meant to be refused
once a PO references the request (a policy-table check in EP30). Then: deposit / payment status →
pending receive → Warehouse receiving (lots, expiry, FEFO from the EP28 item tracking).
