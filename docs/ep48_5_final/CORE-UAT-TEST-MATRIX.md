# EP48.5 FINAL — Department Workflow UAT Matrix

**FUNCTIONAL UAT: PENDING — no workflow has been executed live** (no UAT company can exist yet, see F1 / F2).
"Implemented" below means the code and an existing backend test exist; those tests were **not run** in this session
(no package registry / runtime here). Each workflow gets: happy path, validation failure, unauthorized role, invalid
transition, audit / transaction check — to be executed against the UAT company once enabled.

| Area | Workflow | Implemented (code + test file) | Live UAT |
|---|---|---|---|
| Purchasing | Purchase request raise / submit / approve / reject / cancel | yes — `purchase-requests` (16) | PENDING |
| Purchasing | PO from approved PR, edit DRAFT, issue (approve tier), cancel with reason | yes — `purchase-orders` (18) | PENDING |
| Purchasing | Several POs / suppliers per PR, partial ordering, outstanding | yes — `purchase-orders` "partial orders…" | PENDING |
| Purchasing / Accounting | Supplier deposit (percent), Accounting confirm **or** waive, one decision wins | yes — `purchase-orders` "deposit…" | PENDING |
| Warehouse | Pending receive (quantities only), goods receipt post / cancel (reversal), partial receiving | yes — `warehouse` (17) | PENDING |
| Warehouse | Inventory balances, lots / batches, expiry, movement ledger | yes — `warehouse`, `inventory-control` (20) | PENDING |
| Warehouse | Transfers, adjustments, cycle counts (draft → post) | yes — `inventory-control` | PENDING |
| Warehouse | **No price / cost / total / deposit / terms by any route or screen** | yes — `purchase-orders` "never a price…", `warehouse-privacy` (4) | PENDING — test API + UI with account #4 |
| Sales | Sales order create / status, allocation | yes — `sales-orders` (16), `sales-allocation` (15) | PENDING |
| Sales | Partial fulfilment, delivered vs outstanding, fulfilment % | yes — `sales-fulfilment` (15) | PENDING |
| Production | Production orders, execution / progress, output, pending quantities | yes — `production` (19), `production-execution` (19), `production-output` (11) | PENDING |
| Production | Recipes / BOM confidential (Owner + Department Manager only) | yes — `ep46-recipes` (16) | PENDING |
| Accounting | Deposits view / confirm; payment-status permission codes exist | partial — deposits only (`purchase-orders`) | PENDING |
| Accounting | Payables ledger, paid / unpaid / partially paid balances | **NOT IMPLEMENTED** (no payables module or route; `accounting.payments.*` codes only) | n/a |
| Executive | Command center, cross-department summary, exceptions, pending work | yes — `ep48-executive` (18), `ep47-dashboards` (18) | PENDING |
| Platform | Overview, company explorer (read-only inspection, audited), users suspend / reactivate, audit timeline | yes — `auth-platform` (14), `platform-explorer` (11) | Overview + login: OWNER-reported; rest PENDING |
| Platform | Platform vs company separation; company isolation; department and branch boundaries | yes — `permissions` (23), `ep45-department` (23), `branch-user-admin` (24), `ep40-security` (13) | PENDING |

Backend suite size: 573 tests in 42 files (counted, not run). Frontend tests exist under `frontend/src` (not run).

## Execution order once the UAT company is enabled
1. Owner (#2): branches, departments, master data (fake items, units, suppliers, customers, locations).
2. Invite #3–#8 (F1 flow); assign departments / branches; review each member's effective permissions.
3. Purchasing → Accounting (deposit) → Warehouse (partial receipt, lot + expiry) → Sales (order, partial fulfilment) →
   Operations (production order, output) → Executive (summaries) — each with its denied-action and invalid-transition
   probes; record request ids, screenshots for UI-only checks, and audit rows.
4. Classify findings P0–P3; P0/P1 block EP48.5 FINAL.
