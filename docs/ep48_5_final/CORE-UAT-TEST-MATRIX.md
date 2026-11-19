# EP48.5 FINAL — Department Workflow UAT Matrix

**FUNCTIONAL UAT: PASS (live, 2026-11-19) — one feature gap: Accounting payables ledger NOT IMPLEMENTED (not counted as a pass).**
The UAT company `cmwn2xumn0001nol4sziqtioo` (PDA BLISS CORE — UAT, PROFESSIONAL, six departments) is ACTIVE on release
`5ba9d04` (2026-11-19). Every "Implemented" test file below **ran and passed** in G1 on that exact commit
(`ops-logs\ep48_5-final-gate-20261119-102138`: backend 620 / 620 in 43 files, frontend 66 / 66 files). Live UAT adds:
happy path, validation failure, unauthorized role, invalid transition and audit check on production, UAT company only.

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

## Live UAT results (2026-11-19, release `5ba9d04`, UAT company only; evidence `ops-logs/ep48_5-final-uat/EVIDENCE.md`)

| Area | Result | Key evidence |
|---|---|---|
| Invitations / accounts | PASS | 5 tampered invites refused (owner role, platform role, extra field, 2 departments, executive + department); 7 created (expiry +7 d); spare revoked; 6 ACCEPTED, members 7 with planned roles; live link-reuse / revoked-link checks not run (tokens in mailbox) — G1 covers |
| Purchasing | PASS | PR-202611-000001 submit → own approve 409 → owner approve; PO-202611-000001 1000.00 + 70.00 VAT, deposit 10 % = 107.00 server-side; own issue 409 → owner issue → WAITING_DEPOSIT |
| Accounting | PASS (deposits) / **GAP (payables)** | deposit list with amounts; staff confirm 403 (MANAGE by design); owner confirm → PENDING_RECEIVE, second decision 409; payables ledger not implemented |
| Warehouse | PASS | GR 40 (L1, +90 d) + GR 60 (L2, +30 d) POSTED, over-receive 409, re-post 409; FG receipts: over 409, staff post 403 (MANAGE) |
| **Warehouse confidentiality** | **PASS** | 25 responses key-scanned + 14 raw-text scanned: no price / cost / total / deposit / terms / currency, none of the PO's money values; PO / deposit / sales / BOM / executive routes 403 / 404; company price hidden |
| Inventory / FEFO | PASS | FEFO rank 1 = L2 (earlier expiry); MO reservation 60 from L2, L1 untouched; MI 60 posted |
| Operations / production | PASS | BOM 2:1 active; MO 30: own approve / issue post / output accept 409 (SoD), issue before start 409, output over target 409, outputs 10 + 20 accepted, review → COMPLETED, actions after completion 409 |
| Sales | PASS | SO-202611-000001 25 × 50.00 (1337.50); staff confirm / allocate 403; owner confirm, allocate; pick (over-pick 422), 2 packs, SHP 10 + SHP 15, staff dispatch 403, deliver before dispatch 409; delivered 25 / 25; no purchase data visible to Sales |
| Executive | PASS | read-only overview, no money values; 7 writes 403; BOM list header only, BOM detail 403 |
| Isolation / platform | PASS | platform routes 403 for every member; dev / manual activation 404; unknown ids 404; cross-company sweeps by G1 (no second company created) |
| Audit | PASS | owner activity: every step with actor and from → to; activation audit (operator_manual) from CV |
| Session security | PASS | see SESSION-SECURITY-REPORT update |

## Live UAT plan (2026-11-19)

### Accounts (invited by the UAT owner from the Company Control Center; F1 links only)

| # | Address | Role | Department | Purpose |
|---|---|---|---|---|
| 3 | `atthachetthongchat333+uat-purch@gmail.com` | DEPARTMENT_MANAGER | PURCHASING | PR raise, PO create / edit; cannot issue own PO |
| 4 | `atthachetthongchat333+uat-wh@gmail.com` | DEPARTMENT_STAFF | WAREHOUSE | receiving, lots / expiry; **no money anywhere** |
| 5 | `atthachetthongchat333+uat-sales@gmail.com` | DEPARTMENT_STAFF | SALES | sales orders, fulfilment view |
| 6 | `atthachetthongchat333+uat-ops@gmail.com` | DEPARTMENT_MANAGER | OPERATIONS | BOM (confidential), production orders, output |
| 7 | `atthachetthongchat333+uat-acct@gmail.com` | DEPARTMENT_STAFF | ACCOUNTING | deposits confirm / waive |
| 8 | `atthachetthongchat333+uat-exec@gmail.com` | EXECUTIVE (role; takes no department) | — | command center, read-only |

Branch scope ALL_BRANCHES (one Head Office). Each person: open the e-mailed link → create the account (no e-mail field;
password typed by the owner) → sign in with password + e-mail code. Negative probes: a used link (`TOKEN_USED`), a
spare invitation revoked before use (`TOKEN_EXPIRED`), COMPANY_OWNER not offered in the invite form, `/register` WAF 403.
Role / e-mail tampering in the request body is covered by G1 (`ep48-5-onboarding`); not repeated live.

### Fake data (UAT company only; created through the normal screens)

Supplier `ซัพพลายเออร์ทดสอบ UAT จำกัด`; customer `ลูกค้าทดสอบ UAT`; location `UAT-A1`; raw material `UAT-RM-001`
(lot + expiry tracked); finished good `UAT-FG-001`; BOM 2 × RM per FG. No real names, tax ids or addresses.
**Note:** stock movements and business audit rows are append-only by design, so this UAT data stays in the production
database permanently (scoped to its company; closing the UAT company needs the EP48.6 suspend action).

### Script (each step: success + one denied action; evidence = request id / response fields / screen)

1. **Purchasing (#3):** PR 100 × RM → submit; #3 cannot approve own PR; owner approves. PO from PR, price 10.00,
   deposit 10 %; #3 cannot issue own PO; owner issues → deposit required.
2. **Accounting (#7):** deposit list shows the PO amount; confirm with reference → PENDING_RECEIVE; a second confirm or
   waive is refused; #7 cannot edit the PO.
3. **Warehouse (#4):** receive 40 (lot L1, expiry +90 d) then 60 (lot L2, expiry +30 d) → PO RECEIVED; Purchasing sees
   the progress. **Confidentiality:** on every warehouse screen the page's own API responses are scanned in the browser
   for keys matching price / cost / amount / total / deposit / terms / currency → none; direct GETs of PO / deposit /
   accounting routes as #4 → 403.
4. **FEFO / inventory:** balance 100 RM; production reservation takes L2 (earlier expiry) before L1.
5. **Operations (#6):** BOM visible to #6 and the owner only (#4 / #5 / #8 → 403); production order 30 FG → reserve /
   issue 60 RM → output 10 then 20 → remaining quantities; output after completion refused.
6. **Sales (#5):** SO 25 FG → owner confirms (independent approval) → pick / pack / dispatch 10 then 15 → delivered vs
   outstanding and fulfilment %; #5 sees no purchase price; dispatch beyond the reservation refused.
7. **Executive (#8):** command center shows open / blocked work of all departments; any write → 403.
8. **Platform / isolation:** Platform Owner gets no `/api/v1/company/*`; unknown well-formed ids → 404; members see only
   the UAT company. No second company is created: cross-company isolation rests on G1 `ep40` / `ep45` sweeps.
9. **Audit:** owner activity view and Platform inspection show PR / PO / receipt / SO events.

### Session security (live, UAT accounts only — never the Platform Owner)

Cookie `__Host-core_sid` attributes read from response metadata (never the value): HttpOnly, Secure, SameSite=Lax,
Path=/, no Domain. Refresh keeps the session. Device B revokes device A ("ความปลอดภัยและอุปกรณ์") → A's next API call
401. Logout → signed out and revoked server-side (G1: "a copied cookie stops working"). Logout-all. A used login code
re-submitted → refused. Protected APIs without a session → 401.

### How it is executed

Claude drives the Claude desktop browser pane; **the owner types every password and e-mail code directly into the
pane** (Claude never sees or logs them). Evidence comes from the pages' own API responses (field names, statuses,
request ids — never cookies or tokens).

## Execution order (original outline)
1. Owner (#2): branches, departments, master data (fake items, units, suppliers, customers, locations).
2. Invite #3–#8 (F1 flow); assign departments / branches; review each member's effective permissions.
3. Purchasing → Accounting (deposit) → Warehouse (partial receipt, lot + expiry) → Sales (order, partial fulfilment) →
   Operations (production order, output) → Executive (summaries) — each with its denied-action and invalid-transition
   probes; record request ids, screenshots for UI-only checks, and audit rows.
4. Classify findings P0–P3; P0/P1 block EP48.5 FINAL.
