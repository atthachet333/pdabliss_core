# Interactive CORE demo — `/demo` (EP14)

> **ลองดูว่า CORE ทำงานอย่างไร — ผ่านงานหนึ่งชิ้น**

A public, in-browser demo that lets someone who has never used CORE feel it in 3–5 minutes:
choose a role, enter a simulated workspace, follow one work item, make simple decisions, see
handoffs, information boundaries, an exception and the executive view — without logging in.
It is **not** the real app, not authentication, not a video and not a screenshot carousel: the
UI is real React driven by a typed state machine, and every byte of state lives in memory.

Routes: `/demo`, `/en/demo`, `/zh/demo`. Query: `?role=sales|warehouse|purchasing|accounting|executive`
preselects the view; `?scenario=customer-order` is the only scenario (unknown values are ignored).

## Scenario — customer order SO-1042 (sample data)

| Fact | Value |
| --- | --- |
| Customer / order | *บริษัท ตัวอย่าง จำกัด* (fictional), SO-1042, customer PO CPO-0418 |
| Item | Cleaning solution 5 L · SKU-7731 · location A-03-2 |
| Ordered / on hand | 120 / 20 (LOT-A2409, expires 2026-12-15) → **shortage 100** |
| Replenishment | PO-2215 for 100 to a fictional supplier |
| First receipt | **80 of 100** → **20 outstanding** |
| Balance | 20, confirmed by the supplier |
| Lot of received goods | chosen from samples (LOT-B2410 / LOT-B2411) |
| Documents | PO-2215 · GR-3307 · INV-5521 · approval |
| Delivery | DO-0588 |
| Sample commercial values | order ฿48,000 (Sales) · PO ฿36,000 (Purchasing) · invoice ฿36,000 (Accounting) |

Codes follow the EP08 illustration on `/how-core-works`.

## State machine (`features/demo/machine.ts`)

All rules live in one file; components only read state and dispatch.

| State | Owner | Action → next | Handoff |
| --- | --- | --- | --- |
| `ORDER_RECEIVED` | Sales | *เช็ก Stock* → `STOCK_SHORTAGE` | — |
| `STOCK_SHORTAGE` | Sales | *ส่งต่อให้จัดซื้อ* → `PURCHASE_REQUIRED` | Sales → Purchasing |
| `PURCHASE_REQUIRED` | Purchasing | *เปิด PO จำลอง* → `PO_OPEN` | Purchasing → Warehouse |
| `PO_OPEN` | Warehouse | *รับของ* (80) → `PARTIAL_RECEIPT` · **DETECT**, exception opens | Warehouse → Purchasing |
| `PARTIAL_RECEIPT` | Purchasing | *ยืนยันกับ Supplier ให้ส่งส่วนที่ค้าง* → `BALANCE_INBOUND` | Purchasing → Warehouse |
| `BALANCE_INBOUND` | Warehouse | *รับส่วนที่ค้าง* (20) → `RECEIVING_OPEN` · exception clears | — |
| `RECEIVING_OPEN` | Warehouse | *บันทึก Lot / วันหมดอายุ* (stays) · *ปิดรับสินค้า* → `RECEIVED` — **PREVENT** without lot | Warehouse → Accounting |
| `RECEIVED` | Accounting | *ตรวจเอกสาร* → `DOCUMENT_CHECK` | — |
| `DOCUMENT_CHECK` | Accounting | *บันทึกการอนุมัติ* → `PICKING` | Accounting → Warehouse |
| `PICKING` | Warehouse | *จัดตามที่แนะนำ (FEFO)* → `READY_TO_DELIVER` | Warehouse → Sales |
| `READY_TO_DELIVER` | Sales | *ยืนยันพร้อมส่ง* → `DELIVERED` | — |
| `DELIVERED` | — | terminal | — |

`transition(state, action, role)` is the only way the work item changes. It refuses an action
the state does not offer (`notAvailable`), from the wrong workspace (`wrongRole`), an unknown
lot (`unknownLot`), and closing a receipt without lot and expiry (`lotRequired`, recorded in the
trace as *prevented*). Seven progress stages group the states: Order · Stock check ·
Replenishment · Receiving · Verification · Ready · Complete.

Tests prove: every state is reachable, every non-terminal state has an action that moves the
work item, the terminal state has none, invalid transitions are rejected, owners match acting
roles, and the trace is complete.

## Roles and information boundaries (`views.ts`)

Each role receives a different view-model derived from the same state; workspaces render only
their own object.

| Role | Sees | Does not see |
| --- | --- | --- |
| Sales | order, customer, quantities, order value (sample), delivery status, next action | locations, lots, PO value, payment documents |
| Warehouse | SKU, location, PO quantities, received / outstanding, lots, expiry, FEFO order, pick plan | **any price, cost, margin, amount, currency or supplier terms** |
| Purchasing | requirement, PO, supplier, PO value (sample), expected date, received / outstanding | picking work, the customer's order value |
| Accounting | document completeness (PO, receipt, invoice, approval), payment readiness, invoice amount (sample) | scanning screens, warehouse locations |
| Executive | open / resolved exceptions, affected order, responsible department, bottleneck, impact, flow stage and owner | every transaction, departments' working screens |

Each workspace shows a *มุมมองนี้ไม่แสดง…* card, and *งานเดียวกัน แต่มุมมองต่างกัน*.

### Warehouse privacy

`WarehouseView` has no commercial field at all. Not hidden with CSS — never built. A test walks
every state and scans the Warehouse view object (keys and values) for `price | cost | margin |
amount | value | currency | THB | ฿ | payment | invoice` and the sample amounts; another test
confirms the other roles *do* carry those values, so the boundary is real.

## Interactions

1. **Role switching without resetting work** — a keyboard tablist (arrows, Home, End) above a
   persistent work-item bar (SO-1042 · state · current owner · exception). The reducer's `role`
   action never touches the work item.
2. **Cross-department handoff** — after an action that changes owner, the work-item bar pulses
   once, the receiving role's tab shows *งานเข้า*, and a handoff card shows from → to, what
   changed (before → after state), what information travels and the next owner. Guided mode
   follows the work to the next owner's workspace; Explore mode stays put. Focus moves to the
   handoff heading; a polite live region announces it.
3. **PREVENT** — closing the receipt without lot / expiry is refused: *ยังปิดรับไม่ได้ — ต้องระบุ
   Lot และวันหมดอายุก่อน* (role=alert, next to the action). The visitor selects a sample lot
   and closes the receipt.
4. **Executive exception appears, then clears** — the partial receipt opens one exception (SO-1042,
   Purchasing responsible, 20 outstanding, delivery may be late); when the balance arrives it
   quietly becomes *แก้ไขแล้ว*. *งานปกติควรไหล — สิ่งผิดปกติควรถูกเห็น*.
5. **FEFO suggestion** — the pick plan lists LOT-A2409 (expires sooner) first, labelled as a
   suggestion, *not* automatic allocation.
6. **Accounting document gate** — PO, receipt and invoice complete; approval *waiting* until
   recorded. Labelled operational finance — *not a ledger, journal entries or tax*.

## Trace, completion, reset

- **ประวัติงาน** — every event: order, department, action, before, after, handoff, and the
  prevented attempt. A table on wide screens, a labelled list on phones.
- **Completion** — calm, no confetti: handoffs, departments involved, exceptions detected,
  invalid completions prevented and history events, all counted from the trace (a full run:
  7 · 4 · 1 · 1 · 13). Then *ขอ Demo กับทีม PDA BLISS* → `/contact?interest=demo`, *ดูแพ็กเกจ* →
  `/pricing`, *ลองใหม่*.
- **Reset** (top bar) restarts the scenario, keeping the role and mode; **Exit** returns to role
  selection. No auto-replay. Memory only — refresh also resets; nothing is stored.

## Guided vs Explore

One state model, one implementation. Guided (default) shows the one-line instruction for the
current state and follows handoffs to the next owner. Explore hides the instruction when the
visitor is not the owner and never switches role for them; the next-action card still says where
the work is and offers to go there. Every state always has a next action or a reset.

## Layout

- **Desktop** — top bar (CORE Demo · DEMO · *ข้อมูลจำลอง — ไม่มีการบันทึก* · mode · history ·
  reset · exit), role tabs, sticky work-item bar, then stage rail · workspace · context
  (next action, handoff, boundaries).
- **Tablet** — the same with a narrower context column.
- **Phones** — not the desktop three-pane UI: role tabs scroll horizontally, the work-item bar
  stacks, the next action and handoff sit above the workspace, stages collapse, history is a
  list. The full scenario is completable at 320 px; every action is ≥ 44 px.

## Discoverability

- *วิธีการทำงาน* mega menu: **ทดลองใช้งาน CORE** → `/demo`
- `/how-core-works` closing CTA: **ลอง Workflow นี้ด้วยตัวเอง** → `/demo` (primary)
- Department pages (Sales, Warehouse, Purchasing, Accounting, Executive): *ลองมุมมองแผนกนี้ใน
  Demo* → `/demo?role=<dept>` (Operations has no role in this scenario, so no link)
- `/solutions` falling-through story: *ลองดูว่า CORE ป้องกันงานตกหล่นอย่างไร* → `/demo`
- `/why-core` closing: *ลองดูแนวคิดนี้ใน Demo* → `/demo`
- `/about` and the homepage are unchanged.

## Accessibility and motion

One H1 (the orientation title, compact once the workspace opens); landmarks and headings for
the shell, context and workspace; tablist / tabpanel semantics; native buttons and a native
select; status always as icon + words; focus moves to the handoff and the completion heading;
live announcements only for meaningful events (*รับของแล้ว 80 จาก 100 ชิ้น · พบของค้างรับ 20 ชิ้น*,
handoffs, PREVENT, resolution). Reduced motion: no pulse, no fades, instant state changes; all
information remains.

## Public demo vs the real app

The demo lives entirely in `frontend/src/features/demo/` and `pages/public/DemoPage.tsx`. It does
not import the internal AppShell, prototype session, auth, workspace registry or any business
data, and it calls no API. `/app/*`, the demo login and the backend are unchanged.

**Deferred:** real inquiry delivery (`POST /api/inquiries`, EP13 seam) is still not implemented;
the demo's contact CTA goes to the existing `/contact` flow, which prepares the message for email,
LINE or phone.

## Localization

Scenario logic is shared; labels live in `copy.ts` (th / en / zh-CN). Thai is the source;
English uses product / operations terms; Chinese is Simplified. Fictional IDs (SO-1042, PO-2215 …)
are the same in every locale; dates and amounts use `Intl` per locale.

## Files

```
frontend/src/features/demo/
├── scenario.ts    SO-1042 sample facts, shortage / outstanding, links
├── machine.ts     states, actions, owners, stages, handoffs, transition(), session reducer, summary
├── views.ts       role view-models (WarehouseView has no commercial fields)
├── copy.ts        th / en / zh-CN
├── format.ts      Intl formatting, role icons
├── Landing.tsx    orientation + role selector
├── Shell.tsx      DemoShell: top bar, role tabs, work-item bar, stages, context, handoff, history, completion
├── Workspaces.tsx the five role workspaces
└── demo.test.tsx
frontend/src/pages/public/DemoPage.tsx
```
