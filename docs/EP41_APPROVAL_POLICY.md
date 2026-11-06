# EP41 Approval Policy (Separation of Duties)

Resolves EP40-04. The rule is enforced on the server; the screens only explain it.

## 1. What exists before EP41 (audited in code)

Every consequential decision was gated only by its permission. No module compared the decider
with the person who raised the document: one manager could raise and approve their own
purchasing, inventory and production documents. On a freshly seeded database, the audit trail
showed:
- 7 of 7 production approvals, 6 of 6 PO issues, 14 of 16 sales confirmations, 3 of 3 output
  acceptances, 3 of 3 finished-goods postings and 3 of 3 material-issue postings were made by
  their originator;
- 2 of 4 stock adjustments approved by their originator.

## 2. The policy

Each company has one **approval policy** (`Company.approvalPolicy`):

| Value | Meaning |
| --- | --- |
| `SELF_APPROVAL_ALLOWED` | The pre-EP41 behaviour: the permission alone decides. |
| `INDEPENDENT_APPROVAL` | A consequential decision must be made by **someone other than the document's originators**. The decider still needs the same permission as before: being another person never grants an approval right. |

Only the **Company Owner** can change the policy (Company Control Center → Profile → Approval
policy). Each change is audited as `APPROVAL_POLICY_CHANGED` (from → to). A System Admin can
administer people but cannot weaken a business control.

### Who counts as an originator (per workflow)

| Workflow | Decision checked | Permission (unchanged) | Originators — the decider must be none of them |
| --- | --- | --- | --- |
| Purchase request | approve | `purchasing.requests.approve` or `<dept>.purchase_requests.approve` | the requester (creator and submitter) |
| Purchase order | issue (the order's approval) | `purchasing.orders.approve` | the creator |
| Sales order | confirm | `sales.orders.approve` | the creator, the submitter |
| Stock adjustment | approve (= post) | `warehouse.stock_adjustment.approve` | the creator, the submitter |
| Cycle count | post | `warehouse.counts.approve` | the creator, the person who started counting, everyone who entered a count |
| Production order | approve | `operations.orders.approve` | the creator, the submitter |
| Material issue | post | `operations.material_issues.approve` | the creator |
| Output report | accept | `operations.output.approve` | the creator, the submitter |
| Finished goods receipt | post | `warehouse.finished_goods.confirm` | the creator |

**Not checked (decided, documented):**
- *Rejections and cancellations* — refusing or withdrawing one's own document is never a control
  risk.
- *Inventory transfers* — a move between locations of one branch, with no change of quantity or
  value.
- *Production completion* — it closes an order whose output was already accepted and received
  independently.
- *Sales allocation, dispatch and delivery* — fulfilment of an already confirmed order.
- *Deposit confirmation* — Accounting confirms a payment recorded against an order raised by
  Purchasing.

These are listed so a later policy can add them deliberately, never by accident.

## 3. Owner override

When the policy is `INDEPENDENT_APPROVAL` and the **Company Owner** is themselves an originator,
the owner may still decide, but only through an explicit, separate action:

- The request carries `ownerOverride: { reason }` (10–500 characters). The screens show it as a
  separate **"Approve with owner override"** step with a required reason. It is never a silent
  fallback.
- It is available to the `COMPANY_OWNER` role only. Any other originator gets
  `409 SELF_APPROVAL_NOT_ALLOWED` and has no override.
- The override is recorded in the same transaction as the decision, as
  `SELF_APPROVAL_OVERRIDE`, with the actor, the reason, the time, the branch, the document type,
  id and number, the decision, and which originator role the owner held. The document's normal
  decision event is recorded too.
- An override sent when it is not needed is refused (`400 OVERRIDE_NOT_NEEDED`), so the audit
  trail only ever shows real overrides.

### No approval loops

The owner holds every permission and always exists (EP25 owner invariant), so a document can
always be decided:

| Situation | How it is decided |
| --- | --- |
| A non-owner originator who is the only other approver | the owner approves it — a normal approval, not an override |
| The owner is an originator | an owner override |

## 4. Compatibility

- **Existing companies keep `SELF_APPROVAL_ALLOWED`.** The column is added with that database
  default, so nothing anyone could do yesterday is refused today until the owner chooses
  otherwise.
- **New companies** created through onboarding start with `INDEPENDENT_APPROVAL`, the
  recommended production posture. The owner can switch to `SELF_APPROVAL_ALLOWED` (for example a
  one-person business).
- **The demo company:**

  | Database | Policy | Why |
  | --- | --- | --- |
  | Freshly seeded | `INDEPENDENT_APPROVAL`, set after its historical fixtures are created | the fixtures keep their recorded actors |
  | Existing (`pdabliss_core_dev`) | unchanged | the seed never overwrites a company's settings; the owner switches it in the Control Center for UAT (`DEMO_WORKFLOW_GUIDE.md`) |

- **Historical documents are never touched:**
  - the rule applies only at the moment of a new decision;
  - decisions already recorded (including the seeded self-approvals) stay as they are, with their
    original actors and audit entries.

## 5. Decisions taken in EP41 (the owner may revisit them)

| # | Decision | Alternative the owner may prefer |
| --- | --- | --- |
| A | Policy per company, two values | per workflow (more granular, more to configure) |
| B | Existing companies unchanged; new companies independent | force independent for all (breaks current single-manager use) |
| C | Owner-only override, reason required, audited | no override at all (single-owner companies could not operate) |
| D | Rejections, cancellations, transfers, completion, fulfilment not checked | include transfers and completion |
| E | Cycle count posters must not have counted | creator-only check |

None of these is an authorization bypass. Every decision still requires its permission, branch
and company access.
