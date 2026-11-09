# Demo Workflow Guide (EP39, EP41 approval policy)

How to test every demo account later, on your own machine. Nothing here needs doing now: EP39
already ran these paths automatically (real HTTP E2E and real browser sessions); this guide is
for your own walkthrough when you choose.

Accounts and what they may do: [`DEMO_ACCOUNT_MATRIX.md`](DEMO_ACCOUNT_MATRIX.md). Every record
mentioned below: [`DEMO_DATA_CATALOG.md`](DEMO_DATA_CATALOG.md) (numbers are those of a fresh
seed; on an older database look for the same item / customer / state).

## 0. Before you start

1. Start the stack (README → *Local development*): PostgreSQL on 5432, backend on **1112**,
   frontend on **1111**. Development mode: `NODE_ENV=development` and `ENABLE_DEMO_ROUTES=true` in
   `backend/.env` (both are in `.env.example`). Since EP40 the demo accounts, persona list and
   bypass stay off when `NODE_ENV` is not set explicitly, and `db:seed:demo` refuses.
2. Make sure the demo data is current: `npm --prefix backend run db:seed:demo`. It only ever
   adds what is missing; a second run reports `unchanged` everywhere.
3. Open `http://localhost:1111/login`. The development persona list fills the e-mail of the
   persona you pick; type that persona's password from your local `backend/.env`
   (`DEMO_*_PASSWORD`). No e-mailed code is needed for the nine demo accounts in development.
4. Language: the TH / EN / 中文 switch is in the header; CORE keeps it on every page. Every
   screen below exists in all three.
5. One account per browser profile (or sign out between accounts): a session is one person.

**Working branch.** Accounts with two branches see *Choose the branch you work in* first. Pick
the branch named in the step and press **Enter CORE**. You can change it later from the CORE
menu (*Working branch* → **Change branch**). The branch is always shown in the header.

**CORE menu.** At 1280 px and wider it is the left sidebar; on smaller screens press **Menu**
(top right). The current page is highlighted. Quick actions are on the CORE home.

**Approval policy (EP41).** Since EP41 a company can require *independent approval*: the
person who raised or submitted a document cannot approve, post or confirm it. See
[`EP41_APPROVAL_POLICY.md`](EP41_APPROVAL_POLICY.md).

| Database | Policy | What it means for this guide |
| --- | --- | --- |
| Freshly seeded | Independent approval | The owner approves what Operations and Purchasing raise (production orders, material issues, output, purchase orders). Owner-raised adjustments need the override dialog. |
| Your existing `pdabliss_core_dev` | Self-approval allowed (unchanged) | Everything works as in EP39. To try the control, sign in as `owner.demo` → **Company Control Center** → **Settings** → **Document approval** → *Independent approval required* → **Save**. Switch back the same way; both changes appear in Activity. |

**Owner override.** Under independent approval, when the owner decides a document they raised,
CORE opens **Owner override**.
- Give a reason of at least 10 characters → **Approve with owner override**. The decision and
  the reason are recorded (Activity → *Owner override of independent approval*).
- **Cancel** or Escape leaves the document as it was.
- Other people get a message instead: another person with approval rights must decide.

## 1. Account by account

### Sales — `sales.demo` (branch `00001`)

1. Sign in → choose **Demo Branch · 00001** → **Enter CORE**.
2. CORE home → quick action **New sales order** (one click).
3. Customer: type `CUS-000002`, choose it with ↓ and Enter. Add line FG-000002 (serum), quantity
   2, a unit price. **Create draft**, then **Submit** → confirm. The order is now *Awaiting
   confirmation*; there is no **Confirm order** button for Sales staff (a manager's step).
4. Menu → **Sales orders**. Find SO-202611-000011: the list says **Delivered** (EP39). Open it:
   the *Fulfilment* section shows the delivered shipment. SO-202611-000014 shows **Not
   allocated** — nothing in stock (it is waiting on production).
5. SO-202611-000013 is a draft you may still edit. SO-202611-000012 is submitted and in stock.
6. Switch branch to `00000`: SO-202611-000002 is short of stock (Head Office holds none).

Expected refusals: Warehouse, Production, purchase orders and supplier data are not in the menu
(Sales may only raise purchase requests — **New purchase request**); their URLs show the
no-access page.

### Purchasing — `purchasing.demo` (branch `00001`)

1. Sign in → **00001** → **Enter CORE**.
2. Menu → **Purchase requests**. PR-202611-000007 (Operations, approved by you) and
   PR-202611-000002 (Sales, Head Office — switch to `00000` to decide it: **Approve**).
3. Menu → **Purchase orders**: PO-202611-000006 *Received*, PO-202611-000007 *Pending receive*
   (nothing received yet), PO-202611-000003 partly received.
4. Menu → **Production shortages**: MO-202611-000010 needs RM-000003 — read only. Purchasing
   decides what to buy; nothing is generated automatically.
5. To order more: **Purchase orders** → **New purchase order** → pick an approved request,
   the supplier and prices → save → issue it to the supplier. *Under independent approval:*
   the person who created the order cannot issue it — `owner.demo` issues it.

### Warehouse — `warehouse.demo` (branch `00001`, the only one)

1. Sign in → CORE home (no branch question).
2. Menu → **Warehouse** → tab **Pending receive**: open PO-202611-000007 → receive 6 L of RM-000003
   into MAIN with a lot number and expiry → **Post receipt**. Stock goes in once
   (PURCHASE_RECEIPT) and the production shortage for MO-202611-000010 clears.
3. Menu → **Pending pick**: SO-202611-000003 is ready. Create the pick, start it, confirm the
   picked quantities; create the pack and confirm it; prepare the shipment. **Dispatch** is not
   offered (a manager's step — the owner does it).
4. Menu → **Inventory** (tabs **Lots & expiry**, **Movements**): lots with expiry (FG-DEMO-B
   expires within 30 days), reserved and available quantities; every movement with its
   document, including *Issued to production* and *Finished goods from production* (EP39).
5. Menu → **Finished goods**: MO-202611-000006 has 2 accepted pieces waiting; draft the receipt.
   **Post receipt** is the owner's.

Privacy: no screen shows a price, cost, total, customer or supplier detail to this account.

### Operations — `operations.demo` (branch `00001`)

1. Sign in → **00001** → **Enter CORE**.
2. Menu → **Production**. MO-202611-000009 is *Completed · Short-closed* (16 good of 20, two
   defective, usage below issue = variance, reason recorded). MO-202611-000010 comes from the
   sales order SO-202611-000014: bottles reserved, RM-000003 short.
3. After Warehouse receives PO-202611-000007, open MO-202611-000010 → **Reserve materials
   (FEFO)** → fully reserved → **Release as ready** → **Start production** → **New material
   issue** → **Post issue** → record usage → new output → **Submit for review** → **Accept
   output** → (Warehouse receives it) → **Request completion review** → **Complete**.
   *Under independent approval (fresh seed):* **Approve**, **Post issue** and **Accept output**
   on documents Operations raised are refused for `operations.demo`; sign in as `owner.demo` for
   those three steps.
4. Quick action **New production order** for a manual order; **New purchase request** for
   materials.

### Accounting — `accounting.demo` (branch `00000`, the only one)

1. Sign in → CORE home → menu → **Supplier deposits**.
2. PO-202611-000002 waits for a 30 % deposit: confirm (reference) or waive (reason). Its order
   then moves to *Pending receive*. Nothing else in CORE is a payment workflow yet.

### Executive — `executive.demo` (any branch)

1. Sign in → choose a branch → **Enter CORE**.
2. Every department is in the menu, read only: sales orders with their fulfilment, purchase
   orders, production orders, inventory. No create, approve or post button appears, and the
   server refuses such requests (403).

### Owner — `owner.demo` (branch `00001`)

1. Sign in → Company Control Center → **Enter CORE** → **00001**.
2. Manager steps for the staff personas: confirm SO-202611-000012 (**Confirm order**), reserve
   stock for it, dispatch the shipment Warehouse prepared and record its delivery, post the
   finished-goods receipt Warehouse drafted, approve Warehouse transfers / adjustments / counts.

### System Admin — `admin.demo`

1. Sign in → Company Control Center: users, branch access, permissions, master data.
2. CORE says there is no department to work in — administration is not operations.

### Legacy staff — `staff.demo` (branch `00001`)

Same Warehouse screens as `warehouse.demo`, but receiving is refused (the one seeded DENY
exception, visible on Company → Users → Demo Staff → permissions).

## 2. End-to-end chains (what EP39 verified, in order)

| Chain | Steps (persona) | Where to look |
| --- | --- | --- |
| Purchasing → Warehouse | request (operations) → approve (purchasing) → PO, issue (purchasing) → partial + final receipt (warehouse) | PO receiving state; Inventory lots; Movements |
| Sales → Warehouse | draft, submit (sales) → confirm, reserve (owner) → pick, pack, ship (warehouse) → dispatch, deliver (owner) | Sales list **Delivered**; Movements SALES_ISSUE once |
| Sales → Production | confirmed order short of stock (owner) → production order from the sales line (operations) → material shortage | Production order materials; Production shortages |
| Production → Warehouse | reserve, start, issue, usage, output, accept (operations) → finished-goods receipt draft (warehouse) → post (owner) → review, complete / short-close (operations) | Finished goods; Movements PRODUCTION_CONSUMPTION / PRODUCTION_OUTPUT |
| Production → Sales | the made lot is reserved by hand for a new sales order (owner) — never automatically → fulfilment as above | Sales order allocation (lot SER-DEMO-01) |
| Shortage → receipt | shortage (purchasing reads) → receive the awaited PO (warehouse) → reserve again (operations) | the shortage disappears; order fully reserved |
