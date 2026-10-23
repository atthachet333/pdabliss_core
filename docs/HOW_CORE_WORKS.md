# How CORE Works — PDA BLISS CORE (EP08)

`/how-core-works` (`/en/how-core-works`, `/zh/how-core-works`) answers one question:
**“PDA BLISS CORE ทำงานยังไง?”** — by letting the visitor watch one piece of work travel
through the company.

> **Presentation only.** There is no workflow engine, workflow state, persistence or document
> creation behind this page. Every route, decision, approval and trace is an illustration
> labelled **ตัวอย่างกระบวนการ** — each organization defines its own steps.

## Core idea

งานหนึ่งชิ้นไม่ได้อยู่ในแผนกเดียวตั้งแต่ต้นจนจบ. CORE connects status, responsibility and
the information each team needs, so every department sees:

- what it must do · what it is waiting for · what it must hand on
- the state of the process · what is abnormal · who is responsible

— without receiving information that is irrelevant to its role.

## End-to-end example (16 steps)

| # | Step | Actor | Branch |
| - | ---- | ----- | ------ |
| 1 | Customer PO received (CPO-0418) | Sales | main |
| 2 | Sales order created (SO-1042) | Sales | main |
| 3 | Stock checked | Warehouse | main |
| 4 | Shortage | Warehouse | shortage |
| 5 | Work for Operations (WO-0307) | Operations | work |
| 6 | Purchase need raised (PR-0761) | Purchasing | purchase |
| 7 | PO sent to supplier (PO-2215) | Purchasing | purchase |
| 8 | Deposit requested (PAY-0093) | Accounting | deposit |
| 9 | Accounting approves | Accounting | deposit |
| 10 | Supplier ships | Supplier | purchase |
| 11 | Warehouse receives | Warehouse | purchase |
| 12 | Lot / expiry recorded, QC (LOT-2410-A) | Warehouse | purchase |
| 13 | Stock available | Warehouse | shortage |
| 14 | Fulfilment prepared (DO-0588, FEFO) | Warehouse | main |
| 15 | Sales sees “ready” | Sales | main |
| 16 | Delivered / complete | Sales | main |

Record codes are generic; no customer or company names, no amounts.

## Workflow model

`frontend/src/features/workflow/model.ts` is the single typed source for the page:

- `STEPS` — the 16 steps with `actor`, `branch` and `record`.
- `LANES` — Executive (observer, on top), Sales, Operations, Warehouse, Purchasing,
  Accounting, Supplier (external).
- `Status` — CORE status language: **normal · attention · blocked · waiting · complete**,
  always shown with an icon and words.
- `Decisions` + `buildRoute(decisions)` — the route for a set of answers: which steps are
  included, which are skipped and where the work pauses.
- `VISIBLE` / `HIDDEN` / `FINANCIAL_FIELDS` — information boundaries per lane.
- `HANDOFF_PARTS`, `APPROVAL_CHAIN`, `EXCEPTIONS`, `SAFEGUARDS`, `ROLE_FOCUS`, `TRACE`,
  `provenance()`, `ADAPTATIONS`, `CHAPTER` (section ids).

Words live in `copy.ts` (th / en / zh-CN); components only render the model.

```
frontend/src/features/workflow/
├── model.ts · copy.ts · state.ts   model, words, shared decisions + lane names/colours
├── visuals.tsx                     StatusBadge, LaneChip, RouteMap (lanes), RouteStack (phones), RouteView
├── HowHero.tsx                     hero + work-object visual
├── ChaptersStart.tsx               01 problem · 02 work enters · 03 routing · 04 handoff
├── ChaptersFlow.tsx                05 decisions · 06 approval · 07 exceptions · 08 human error
├── ChaptersView.tsx                09 roles · 10 trace · 11 replay · 12 adapt · CTA
└── workflow.test.tsx
frontend/src/pages/public/HowCoreWorksPage.tsx   composes the page, owns the shared decisions
```

## Branches (decision points)

| Decision | Effect |
| -------- | ------ |
| Stock enough? **yes** | Route is 1 → 2 → 3 → 14 → 15 → 16. Operations, Purchasing, Accounting and the supplier never enter. Other decisions become “not relevant”. |
| Operations work needed? **no** | Step 5 is skipped. |
| Supplier purchase needed? **no** | Steps 6–12 are skipped (no Purchasing, Accounting or supplier). |
| Deposit required? **no** | Steps 8–9 are skipped — Accounting is not involved. |
| Goods passed receiving / QC? **hold** | The work stops at step 12 (blocked); later steps show “waiting”. |
| Shortage with neither work nor purchase | The work stops at the shortage (attention) until a replenishment decision is made. |

The decisions are shared with the replay, so the visitor replays the route they chose.

## Handoff

“A handoff is not just sending a message.” A CORE handoff carries: previous owner · new owner ·
work state · required information · state change time · next action. The interactive example
(Sales → Warehouse) asks *มีของพร้อมส่งหรือไม่?* — **available** routes to fulfilment;
**shortage** opens work for Operations and Purchasing and tells Sales it is waiting.

## Approval

Request → rule → approver → decision → continue: PO created → rule: deposit required →
Accounting review (**the chain pauses here**) → approved → supplier confirms → expected
delivery. Patterns shown: one-level, multi-step, conditional — with the note that available
approval levels depend on the package and scope (no claim that a workflow engine exists).

## Exceptions

Stock shortage · work delayed · approval waiting · document incomplete · supplier late · count
variance · near expiry. The route stays calm; only the selected exception rises, with its
status, the step, who it is raised to and the action. No alarm styling.

## Information boundaries

| Lane | Sees | Does not receive (examples) |
| ---- | ---- | --------------------------- |
| Sales | customer, order lines, order value, delivery date, readiness | amount to pay |
| Operations | work required, team, due date, progress | order value, amount to pay |
| **Warehouse** | **item, quantity, lot, location, expiry** | **order value, amount to pay, customer** |
| Purchasing | need, supplier, PO, expected receipt | order value |
| Accounting | payment request, amount to pay, document status, conditions | location |
| Executive | state, exceptions, risk, bottleneck | order lines, locations |

**Warehouse never sees price, cost, supplier payment or accounting amounts** — not on screen,
not in the workflow graphics, not in sample data. Tests enforce this on the model, on every
Warehouse step's words in all three locales and on the rendered page.

## Role visibility

The same route, three emphases (role switcher, keyboard tablist):

- **Employee** — *ฉันต้องทำอะไร* (a warehouse team member: receive PO-2215, record LOT-2410-A,
  prepare delivery by FEFO).
- **Manager** — *ทีมฉันติดตรงไหน* (purchasing lead: PO waiting for deposit approval, a late
  supplier).
- **Executive** — *องค์กรมีอะไรต้องจับตา* (bottleneck, exception, risk — not transactions).

## Human-error framework

The EP04 principles applied to the real route: **PREVENT** (receiving cannot complete without
lot and expiry) · **DETECT** (PO 100 vs received 80 → difference 20) · **ALERT** (supplier
past expected receipt) · **CONTROL** (payment request without documents does not reach
approval) · **TRACE** (who changed what, when, from which department). No statistical claims.

## Trace model

Each event records: event · step · responsible role · status, in order (`TRACE`, 11 events).
The view switches from **status history** to **cross-department route** — Sales → Warehouse →
Operations → Purchasing → Accounting → Supplier → Warehouse → Sales. The page states it is not
a legal certification or financial audit.

## Replay

Play / pause / previous / next / restart over the chosen route. Nothing autoplays on load;
under reduced motion the Play button is removed and only manual steps remain.

## Adaptation

Approval levels · departments involved · step sequence · notifications · custom controls —
“how much can be adapted depends on the package”, with quiet links: basic workflow → Starter,
cross-department → Business, custom → Professional, complex → Enterprise
(`/pricing?plan=<id>#packages`), plus `/pricing`.

## Navigation

- วิธีการทำงาน mega menu: CORE ทำงานอย่างไร → `/how-core-works` · การทำงานข้ามแผนก →
  `#handoff` · Workflow และ Approval → `#approval` · การติดตามสถานะ → `#trace` · Human Error
  Prevention → `#human-error`; highlight CTA → `/how-core-works`. Localized.
- Footer “วิธีการทำงาน” → `/how-core-works`.
- Solutions → Workflow & Approval → `#approval`; Enterprise → Custom Workflow → `#adapt`.
- Homepage Connected Flow chapter ends with a quiet link to the page; department-page CTAs
  (“ดูวิธีการทำงานของ CORE”) point here.
- Every department in the workflow links to its EP06 page in the current locale.

## Localization

Thai is the source of truth; English and Simplified Chinese are complete. Technical terms
already established (Workflow, Approval, Lot, FEFO, PO) are kept. The only Thai in EN/ZH is the
inert product preview in chapter 03, captioned as Thai product UI.

## Motion

Motion explains movement, branching, waiting and completion — see
[MOTION.md](MOTION.md) (How CORE works). Native scroll only; no scroll hijacking or snapping;
no sticky transformation. Under reduced motion: no moving tokens, no looping pulses, no
autoplay; final/current states only.

## Accessibility

- One H1; twelve chapters each labelled by an H2.
- Tablists (routing, roles) and radio groups (handoff, decisions, exceptions, trace view) with
  arrow / Home / End keys; replay controls are labelled buttons; phone lists collapse with an
  `aria-expanded` toggle.
- Status is always icon + words; SVG maps are `aria-hidden` and paired with the same steps as
  a visible numbered legend (desktop) or a step list (phones).
- Targets are at least 44 px; the page works at 320 px.
