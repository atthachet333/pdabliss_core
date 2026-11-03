# Inventory Transfer (EP32)

Moving stock from one warehouse location to another **inside one branch**. A transfer never creates
or changes a lot: the exact lot (or "no lot") that leaves the source arrives at the destination.
Every stock effect goes through the ledger ([INVENTORY_LEDGER.md](INVENTORY_LEDGER.md)); a transfer
never touches `StockBalance` itself.

## 1. Document

| Model | Notes |
| --- | --- |
| `InventoryTransfer` | company, branch, `number` `TR-YYYYMM-NNNNNN` (DocumentSequence, one atomic upsert — never MAX + 1), `status`, `sourceLocationId` / `destinationLocationId` (bound to the branch by composite FKs), `transferDate` (calendar day), note, created / posted / cancelled by + at, cancellation reason |
| `InventoryTransferLine` | item, `lotId?`, `lotKey` (lotId or `''`), `quantity` (exact `numeric(18,6)`, > 0, within the unit's decimals), note; unique `(transfer, item, lotKey)` |

CHECKs: number format, source ≠ destination, status metadata (POSTED has posted by / at, CANCELLED
has cancelled by / at), quantity > 0.

## 2. Lifecycle

```
DRAFT ──post (manager)──▶ POSTED ──cancel + reason (manager)──▶ CANCELLED (reversal)
  └──cancel (staff)──▶ CANCELLED (no stock effect)
```

| Action | Code | From |
| --- | --- | --- |
| create / edit header / replace lines | `warehouse.transfers.create` (OPERATE) | DRAFT |
| post | `warehouse.transfers.approve` (MANAGE) | DRAFT |
| cancel a draft | `warehouse.transfers.create` | DRAFT |
| cancel a posted transfer (reversal, reason required) | `warehouse.transfers.cancel` (MANAGE) | POSTED |
| read | `warehouse.inventory.view` | any |

One rule table (`TRANSFER_RULES`, `backend/src/warehouse/policy.ts`) decides every transition and
the `actions` list the screens show. Refusals: 403 `PERMISSION_DENIED` / `BRANCH_NOT_ALLOWED`, 409
`DOCUMENT_ALREADY_POSTED`, `DOCUMENT_NOT_EDITABLE`, `INVALID_TRANSITION`.

## 3. Validation (create, edit, and again at post)

- Both locations exist in the company (`REFERENCE_NOT_FOUND`), are ACTIVE (`LOCATION_INACTIVE`),
  are different (`SAME_LOCATION`) and are in **one branch** the member has (`CROSS_BRANCH`,
  `BRANCH_NOT_ALLOWED`). Cross-branch transfers are out of scope (they need in-transit stock).
- Lines: stock items only (`ITEM_NOT_STOCKED`), the item's lot rule (`LOT_REQUIRED`,
  `LOT_NOT_TRACKED`, the lot must be the item's), unit precision (`QUANTITY_PRECISION`), one line per
  (item, lot) (`DUPLICATE_LINE`), quantity ≤ on hand at the source (`INSUFFICIENT_STOCK` — a hint in
  DRAFT, enforced atomically at post).
- An empty transfer cannot be posted (`DOCUMENT_EMPTY`).

## 4. Posting — one transaction

1. Lock the transfer row (`SELECT … FOR UPDATE`); re-check status and both endpoints.
2. Take both locations' advisory locks (shared, sorted ids) — a cycle count starting on either waits.
3. Per line, through `applyMovement`: `TRANSFER_OUT` (−q) at the source with the conditional
   decrement (refused with `INSUFFICIENT_STOCK` rather than going negative), then `TRANSFER_IN` (+q)
   at the destination (upsert). Both movements carry `sourceType = TRANSFER`, the transfer and line
   ids; `(transferLineId, type)` is unique, so a line cannot move twice.
4. Status POSTED, posted by / at, audit `TRANSFER_POSTED`.

Two posts of the same transfer: the second waits on the row lock and then gets
`DOCUMENT_ALREADY_POSTED`. Two transfers taking 7 + 7 from a balance of 10: exactly one succeeds.

## 5. Reversal

Cancelling a POSTED transfer (reason required, `REASON_REQUIRED`) writes `TRANSFER_IN_REVERSAL` (−q)
at the destination and `TRANSFER_OUT_REVERSAL` (+q) at the source, in one transaction. If the
destination no longer holds the quantity (it was moved on, adjusted or counted away), the whole
reversal is refused with `REVERSAL_NOT_POSSIBLE` and nothing changes. The original movements stay.

## 6. API (`/api/v1/warehouse`)

```
GET    /transfers               ?status, locationId, branchId, q (number), from, to, page, pageSize
POST   /transfers               {sourceLocationId, destinationLocationId, transferDate?, note?, lines?}  201
GET    /transfers/:id           the transfer (lines with `available` at the source), timeline, actions
PATCH  /transfers/:id           DRAFT header
PUT    /transfers/:id/lines     {lines: [{itemId, lotId?, quantity, note?}]} — replaces all lines
POST   /transfers/:id/post
POST   /transfers/:id/cancel    {reason?} (required when POSTED)
```

Strict bodies: company, branch, number, status, actors, movement types and balances are server-owned
(sending one is 400). Responses are operational allow-lists (`TransferView`) — no money exists.

## 7. Screens

`/core/warehouse/transfers` (list with status filter, search), `/new` (from / to, note; a stock row
on Inventory opens it with the source preset), `/:id` (facts, lines picked from the source's stock
with the lot shown, Post / Cancel / Cancel and reverse behind a confirmation). Own lazy chunk.
