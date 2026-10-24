# Why CORE — `/why-core` (EP12)

`/why-core` answers **why this specific product exists**. `/about` says who PDA BLISS is; this
page says why PDA BLISS built CORE. It uses product-origin framing only — no invented
anecdotes, customers, numbers or quotes.

> **เราไม่ได้สร้าง CORE เพราะองค์กรต้องการ Software อีกหนึ่งตัว**
> **เราสร้าง CORE เพราะงานจริงมักติดอยู่ระหว่างแผนก**

## Story (section ids)

| # | Id | Chapter | Form | Intensity |
| --- | --- | --- | --- | --- |
| — | (hero) | Why CORE exists | Two-tone H1; **department islands → gaps → CORE connection layer**: six departments as separate islands with "waiting" markers between them and threads down to one CORE layer (*one work state for the whole organization*). Islands stack 2×3 / 3×2 on smaller screens; gaps and threads appear from `lg` | 8 |
| 01 | `origin` | Origin / organizational growth | Six small multiples of the same organization: roles separate → departments form → handoffs increase → approvals increase → systems multiply → visibility decreases. *CORE was designed around this reality — not to reduce structure, but so work does not disappear into its gaps* | 7 |
| 02 | `one-system` | **ONE LARGE SYSTEM → CORE** | Interactive: *view as* any of six departments. Left: one interface with eight modules — the viewer's own module is marked *your work is in here*, and one module they do not need is flagged *shown without need* (for the Warehouse: **prices & costs**). Right: CORE opens straight onto that department's workspace (three focused items), the other five as quiet chips, all joined to one shared work state (`SO-1042 · awaiting delivery`). Four points per side; note: this is a design philosophy, not a claim that traditional systems are bad | 9 |
| 03 | `departments` | Department-centric philosophy | Four editorial lines: Sales does not need Warehouse screens · Warehouse does not need financial information · Accounting does not need the warehouse scanning UI · Executives do not need every transaction. *Different responsibilities require different interfaces.* Warehouse privacy note: pricing is never sent to the Warehouse workspace — not a hidden column | 7 |
| 04 | `connected` | Connected, not isolated | Six workspace views of the same sales order, each in its own terms (the Warehouse sees quantity and lot only), all reading one shared work state | 7 |
| 05 | `human-error` | Human Error | *Human Error is not solved by telling people to be more careful.* Record vs prevent; *CORE should not merely store what happened — it should help prevent bad states*; a state guard (choose lot → a later-expiring lot is a state that should not happen → CORE suggests FEFO); guide / validate / reveal / control / preserve context ↔ PREVENT / DETECT / ALERT / CONTROL / TRACE with an example each; links → `/solutions#human-error`, `/how-core-works#human-error` | 7 |
| 06 | `executive` | Executive philosophy | A field of a day's work (dots) filtered to five signals: bottlenecks, exceptions, waiting, risk, department health; link → `/departments/executive` | 5 |
| 07 | `next-action` | Good software should disappear | Quiet, centred: *good software makes the next action obvious; users should not need to understand the entire system to do their job correctly*, with one "next action" fragment | 4 |
| — | `see-it-work` | CTA | *ดูว่า CORE ทำงานอย่างไร* → `/how-core-works` (primary), *สำรวจแต่ละแผนก* → `/departments`, quiet *ขอ Demo* → `/contact` and *รู้จัก PDA BLISS* → `/about` | 5 |

## Principles carried from earlier episodes

- **EP04 Why CORE** — the ONE LARGE SYSTEM → CORE idea, here made interactive and specific to
  each department rather than a scroll morph.
- **EP04 error framework** — PREVENT / DETECT / ALERT / CONTROL / TRACE (`GUARDS` in
  `features/about/model.ts`, shared by `/about` and `/why-core`).
- **Warehouse privacy** — every Warehouse view on the page (workspace items, the shared-order
  view, the next-action fragment) carries quantities, lots and states only; tests check this in
  every locale. Pricing appears on the page only as the module ONE LARGE SYSTEM would show the
  Warehouse — the point of the comparison.
- **Claim discipline** — safeguards are "what CORE is designed to support", with a note that
  they are not a guarantee that mistakes never happen.

## Files

```
frontend/src/features/why-core/
├── model.ts       chapter ids, growth stages, viewers, modules, EXCESS, signals, links
├── copy.ts        th / en / zh-CN words
├── Hero.tsx       hero (islands) · 01 origin
├── Principles.tsx 02 shift (interactive) · 03 departments · 04 connected · 05 human error ·
│                  06 executive · 07 next action · CTA
└── why-core.test.tsx
frontend/src/pages/public/WhyCorePage.tsx
```
