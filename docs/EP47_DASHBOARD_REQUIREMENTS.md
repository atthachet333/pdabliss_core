# EP47 — Department Dashboard Requirements and Phase 0 Audit

**Baseline:** `04bf246` (EP46) = `HEAD` = `origin/main`, clean tree (verified before any change; EP45 `1e551d1` and EP46
`04bf246` are both on `origin/main`). Target: development only. Deployment milestone: EP48.5 (CORE Staging).

## 1. Purpose

Each operational department gets a dashboard that answers, from canonical documents only:

1. What requires my attention? → the **Needs attention** group (attention + blocked metrics) and the work queue.
2. Which documents are waiting for action? → work-queue rows (number, context, status, next step).
3. Which workflows are blocked or delayed? → blocked tones (exceptions, shortages, paused, overdue) and overdue rows.
4. What has been completed? → "done" metrics (delivered / completed / confirmed within a stated window).
5. Which department is responsible for the next step? → every row's `responsible` department ("Next: Warehouse").

Decorative KPI cards, invented metrics and competing sources of truth are out of scope. The Executive Command Center
is EP48.

## 2. Phase 0 audit — what existed

| Area                        | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorization               | One resolver (`permissions/resolver.ts`, EP27/EP45): a regular member holds codes of ONE department; Executive READ in every enabled department; Owner all; System Admin nothing operational. `requireOperationsContext` validates company, membership, selected branch and branch access on every request. EP41: independent approval + audited owner override on the document routes. EP46: `operations.recipes.view` confidential; order projections hide BOM-derived quantities before release. |
| CORE home (`/core`)         | A launcher: branch, role, assignment pills, quick actions, department cards with a workspace link. No metric.                                                                                                                                                                                                                                                                                                                                                                                       |
| Module "context" endpoints  | Sales (`myDrafts`, `awaitingConfirmation`, `confirmed`, `withShortage`), Warehouse (pending receive, draft receipts, stock rows, expiring / expired lots, open transfers / adjustments / counts / picks / packs / shipments), Production (drafts, submitted, approved, ready, materials short, in production, paused, issues to post, output to review, completion review, completed). Each counts over the member's branches (or the selected one) for its own workspace home.                     |
| Statuses available          | SO DRAFT/SUBMITTED/CONFIRMED/CANCELLED (+ derived fulfilment milestones EP35); PR DRAFT/SUBMITTED/APPROVED/REJECTED/CANCELLED (+ ordered quantities EP30); PO DRAFT/ISSUED/WAITING_DEPOSIT/PENDING_RECEIVE/RECEIVED/CANCELLED (+ receive progress EP31, deposit status); GR DRAFT/POSTED/CANCELLED; transfers, adjustments, counts (EP32); picks / packs / shipments (EP35); MO DRAFT…COMPLETED, material issues, output reports, finished-goods receipts (EP36–EP38).                              |
| Dates available             | SO `orderDate`, `requestedDate`; PR `needByDate`; PO `expectedDate`, `depositDueDate`; MO `requiredDate`, `plannedStartDate`, `completedAt`; counts `countDate`; lots `expiryDate`; shipments `deliveredAt`. **Delayed work** is therefore measurable for sales, purchasing receipts, deposits, production and counts.                                                                                                                                                                              |
| Visualization libraries     | None for charts in the bundle (three.js is the homepage scene only). No chart added — no real trend data exists yet.                                                                                                                                                                                                                                                                                                                                                                                |
| Data-loading infrastructure | CORE screens use the in-house `useLoad` / `lib/api` client (react-query exists only in the prototype `/app`, which production builds exclude). The dashboards use the same client.                                                                                                                                                                                                                                                                                                                  |
| WebSockets                  | None — refresh is request-based.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## 3. Departmental workflows and who owns each step (EP45 §2, unchanged)

| Workflow    | Steps → owner                                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sales order | create / submit (Sales) → confirm, allocate (Sales manager / owner) → pick, pack, ship (Warehouse) → dispatch, deliver (Warehouse manager / owner)                                                              |
| Purchase    | request (any department) → decide (Purchasing or the department's manager) → order, issue (Purchasing) → deposit (Accounting, if required) → receive, post (Warehouse)                                          |
| Production  | plan, submit (Operations) → approve, reserve, release, start (Operations manager) → issue (Operations) → output, accept → finished-goods receipt (Warehouse) → completion review, complete (Operations manager) |

## 4. Requirements per department (delivered)

| Department | Required visibility (brief)                                                                                                                                                | Delivered as                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Sales      | new orders, pending confirmation, awaiting allocation, awaiting fulfilment, partially delivered, outstanding quantities, delayed, recently completed                       | 11 metrics, work + completed queues; fulfilment status of its own orders without Warehouse permissions |
| Purchasing | pending PRs, PRs requiring approval, POs awaiting action, open POs, partial receipts / outstanding, supplier waiting states, shortages, delayed receipts                   | 9 metrics (shortage count only), requests + orders queues; no Accounting action, no deposit amount     |
| Warehouse  | pending GRs, incoming, transfers, adjustments, counts, picking, packing, dispatch, lot / expiry                                                                            | 19 metrics, one work queue; quantities only                                                            |
| Production | drafts, awaiting authorization, material readiness, pending reservations, pending issue, in production, outstanding output, FG output, blocked, completed — both BOM modes | 12 metrics, work queue with outstanding output; mode shown; no recipe data                             |
| Accounting | supplier deposit work and statuses, PO references, outstanding tasks                                                                                                       | 4 metrics, deposits queue with amounts; scope note (no GL / AR / tax / bank)                           |

Outstanding **quantities** are shown where one unit applies (a production order's output); across items they are
shown as **lines** outstanding, never summed across units.

## 5. Non-functional requirements (delivered)

- Bundle: recover JS before adding UI; no new library; dashboard code lazy (one generic chunk) — see
  [EP47_PERFORMANCE_REPORT.md](EP47_PERFORMANCE_REPORT.md).
- TH / EN / ZH copy of the same shape (tested); keyboard and screen-reader structure (regions, heading levels, labelled
  links, `aria-live` update time, status as text not colour alone).
- Responsive at 390 / 768 / 1024 / 1280 / 1440 / 1920 px without horizontal page scroll.
- Read-only; no change to stock, documents or audit; persistent Dev/UAT databases untouched.
