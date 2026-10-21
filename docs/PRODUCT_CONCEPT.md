# PDA BLISS CORE — Product Concept

## Positioning

**Department Operations Platform.**

A normal employee should not feel that they logged into one huge ERP and then clicked their
department. They should feel that they logged directly into the operating system for **their
job** — and that their job is connected to everyone else's through one CORE.

## PDA ONE vs PDA BLISS CORE

These are two different products for two different purposes. Neither replaces the other.

|                     | PDA ONE                                     | PDA BLISS CORE                                     |
| ------------------- | ------------------------------------------- | -------------------------------------------------- |
| Perspective         | The company                                 | The department and the person doing the work       |
| Organising idea     | Business functions managed centrally        | Workspaces per responsibility, joined by workflow  |
| Entry experience    | Company system → find your area             | Sign in → land directly in your workspace          |
| Typical strength    | Broad internal business / accounting management | Cross-department operations and hand-offs     |
| Primary question    | "How is the company doing?"                 | "What do I need to do next?"                       |

CORE must never be built as "PDA ONE with different colours", and must never copy PDA ONE UI.

## The four centres of CORE

- **Department-centric** — each department has its own navigation, dashboard and vocabulary.
- **Role-centric** — what you see is shaped by your responsibility, and data you are not
  cleared for is never sent to you.
- **Task-centric** — every workspace opens on the work waiting for you (receipts to check,
  approvals pending, lots expiring), not on generic charts.
- **Workflow-centric** — work moves between departments through controlled document states;
  nothing is re-keyed and nothing silently falls between teams.

## Product principles

1. One company per CORE workspace. No company picker, no company switching.
2. Departments are separated by responsibility; all share one business process.
3. Each department gets its own navigation and dashboard (not relabelled copies).
4. Every department sees only what its job requires.
5. Backend business rules are authoritative; the frontend is never trusted for permissions.
6. Every important action is auditable (who, what, when, before/after).
7. The system actively prevents human error (guards, approvals, validation).
8. Executives can see all departments, read-oriented by default.
9. Warehouse users never receive confidential pricing from any API.
10. Architecture stays extensible for subscription plans and modules.

## Workspaces

| Workspace     | Opens on                                                          | Never receives                         |
| ------------- | ----------------------------------------------------------------- | -------------------------------------- |
| Executive     | Company KPIs, department pulse, Exception Center, approvals       | — (read-oriented across departments)   |
| Sales         | New orders, waiting stock/production/delivery, overdue            | Purchase cost, supplier payments       |
| Warehouse     | Waiting receipts, pending QC, low stock, expiring/expired lots    | Cost, sales price, payments, amounts   |
| Purchasing    | PR waiting, PO approvals, open/partial POs, late suppliers        | Internal payment details               |
| Operations    | New / in-progress / delayed work, hand-offs to warehouse          | Pricing                                |
| Accounting    | Deposits, balances, payment requests, payables, missing documents | —                                      |
| System Admin  | Users, roles, permissions, workflows, company settings            | Business data it does not need         |

Executive is **not** System Admin: Executive oversees the business; Admin configures the system.

## Conceptual business flows (baseline, not final specification)

**Purchasing:** need identified (Warehouse/Operations) → Purchase Request → Purchasing review
→ approval → Purchase Order → deposit (if required) → supplier delivers → Goods Receipt
(quantity, condition, QC, lot/expiry) → stock updated → balance paid → PO closes.

**Sales:** Customer PO → Sales Order → availability check → reserve and prepare delivery, or
trigger operations/replenishment → track → partial/complete delivery → close.

**Operations:** demand → Work Order → plan → readiness check → start → progress → partial or
complete → hand-off to warehouse/delivery → close.

These flows are illustrative. Real businesses branch (e.g. in-stock orders skip Operations).
Each document type owns its own state machine — there is no universal status list.
