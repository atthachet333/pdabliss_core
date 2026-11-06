# EP38.4 — CORE workspace navigation and quick actions

Frontend-only episode. No API, permission, schema, auth or mail change. Every
menu entry and quick action is derived from the permissions in
`GET /api/v1/company/context`; that is presentation only — each workspace page
and every API call still checks permissions, company and branch on the server
(frontend visibility is not authorization).

## What changed

| Area | Change |
| --- | --- |
| Landing | Department roles (Sales, Purchasing, Operations, Warehouse, Executive) land in CORE (`/core`, or the branch choice first). Company Owner and System Admin still land in the Company Control Center. |
| App shell | `CoreNav.tsx`: one permission-driven menu — a persistent sidebar at ≥ 1280 px (`xl`), a "Menu" button opening a modal drawer below that. The current page is marked (`aria-current="page"`), the working branch is always named, with "Change branch" when there is more than one. |
| Header | "CORE · company" leads to the CORE home (never only to the Control Center). |
| Quick actions | The CORE home starts with the role's most common actions (only those it holds a `create`/`process` permission for). |
| Deep links | A CORE route opened before a branch is chosen goes to the branch choice and then back to the page that was asked for (only `/core…` paths; never the selector itself, never outside CORE). |
| Customer field | New sales order: one accessible ARIA 1.2 combobox (server search, arrow keys, Enter chooses without submitting, Escape closes, live result status). |
| Drawer a11y | `role="dialog"` + `aria-modal`, focus moves in, Tab/Shift+Tab wrap inside, Escape or overlay closes, focus returns to "Menu". |

Menu entries by permission (shown only when held):

| Group | Entry | Permission |
| --- | --- | --- |
| Sales | Sales orders · New sales order ⚡ | `sales.orders.view` · `sales.orders.create` |
| Purchasing | Purchase requests · New purchase request ⚡ · Purchase orders · Production shortages | request view · `*.purchase_requests.create` / `purchasing.requests.create` · `purchasing.orders.view` · `purchasing.production_shortages.view` |
| Operations | Production · New production order ⚡ | `operations.orders.view` · `operations.orders.create` |
| Warehouse | Warehouse · Inventory · Pending pick ⚡ · Finished goods · New transfer ⚡ | `warehouse.receiving.view` · `warehouse.inventory.view` · `warehouse.picking.process` · `warehouse.finished_goods.view` · `warehouse.transfers.create` |
| Accounting | Supplier deposits | `accounting.deposits.view` |

⚡ = also a quick action on the CORE home.

## Navigation paths — before / after (real stack, demo personas)

"Actions" counts clicks/submits after sign-in.

| Persona | Task | Before | After |
| --- | --- | --- | --- |
| sales.demo (2 branches) | Create a sales order | `/company` → Enter CORE → branch radio + Enter CORE → `/core` → Open sales orders → Create sales order — **5** | lands on branch choice → radio + Enter CORE → quick action "New sales order" — **3** (**1** once a branch is set; **2** from any CORE page via the menu) |
| sales.demo | Back to the sales order list from New | Back link or Control Center → CORE home → Sales | Menu "Sales orders" — **1**, branch unchanged (00001) |
| sales.demo | Open `/core/sales/orders/new` before choosing a branch | branch choice → CORE home (link lost) | branch choice → back to New sales order |
| purchasing.demo | New purchase request | `/company` → Enter CORE → branch → CORE home → Purchasing → New — **5** | branch → quick action — **3** |
| operations.demo | New production order | same pattern — **5** | branch → quick action — **3** |
| warehouse.demo (1 branch) | Pending pick | `/company` → Enter CORE → `/core` → Warehouse → Pending pick — **3** | lands on `/core` → quick action "Pending pick" — **1** |
| owner | Enter CORE | `/company` → Enter CORE | unchanged (`/company` first), then the CORE menu |

## QA

- Real browser (Postgres mirror DB, demo personas): landing per persona, the
  quick actions, current-page highlight, Sales Orders ↔ New without the
  Control Center, branch kept, history Back, deep link through the branch
  choice.
- 8 CORE pages × TH / EN / ZH × 390 / 768 / 1024 / 1280 / 1440 / 1920:
  144/144 — no horizontal overflow, one `h1`, no unlabelled control, no
  duplicate id, exactly one of sidebar / Menu visible, no new target under 24 px.
  - Fixed during QA: the sidebar at `lg` (1024 px) squeezed wide tables into a
    page-level horizontal scroll → the sidebar starts at `xl`; the menu button
    squeezed the company name to 15 px in Thai → the home link keeps a minimum
    width and the header wraps its actions instead.
  - Pre-existing, not changed here: PR/SO number links inside table rows and the
    16 px "shortage" checkbox (its whole label is the target) on the sales list.
- Keyboard: drawer open / focus in / Tab wrap / Escape + focus return;
  combobox type → ArrowDown → Enter chooses, form not submitted.

## Gates

- Frontend typecheck, lint, Prettier: clean.
- Frontend tests: 59 files, 1,121 tests passed (`--maxWorkers=2`).
- Build + prerender: 108 indexable pages + 3 shells, each with its own head.
- Performance: all JS 4,247.4 / 4,300 KiB · initial JS 182.7 / 205 KiB gzip ·
  static HTML 526.9 / 560 KiB — within budget, no cap changed.
- No backend change, so the backend suites were not re-run for this episode.
