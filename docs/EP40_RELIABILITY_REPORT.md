# EP40 Reliability Report — Database, Ledger, Rollback, Backup

## 1. Migrations

| Check | Result |
| --- | --- |
| `prisma validate` | valid |
| Fresh chain | 24 migrations applied to an empty database; `prisma migrate diff` (database → schema): **no difference** |
| Development database (read-only diff) | **no difference**; `_prisma_migrations`: 24 rows, 24 distinct checksums, none failed or rolled back; `migrate status`: up to date |
| Upgrade path | EP38.1 / EP39 upgraded the dev database in place; EP40 adds no migration |

No historical migration was edited.

## 2. Database constraints (what the database itself guarantees)

PostgreSQL holds **88 CHECK constraints** and **250 foreign keys**, most of them composite
(id, branchId, companyId), so a child row cannot point into another branch or company. For
inventory:

- **Balances:** `StockBalance.quantityOnHand >= 0` and `lotKey = coalesce(lotId, '')` (CHECK);
  one balance per (location, item, lot) (UNIQUE).
- **Movements:**
  - non-zero, with the sign enforced per type (CHECK);
  - **one movement per (source line, type)** (UNIQUE for every source: receipt allocation,
    transfer line, adjustment line, count line, shipment line, issue line, finished-goods line),
    so double posting is impossible even if application code failed;
  - **immutable**: triggers refuse UPDATE and DELETE.
- **Reservations:** positive quantity; `status = ACTIVE` ⇔ the active slot (CHECK); at most one
  active reservation per (line, location, lot) (UNIQUE); a consumed reservation links to exactly
  one shipment line / issue line (UNIQUE).
- **Lots:** unique per (company, item, lot number); manufactured ≤ expiry; non-blank number.
- **Documents:** number format and uniqueness per company; totals (`grandTotal = subtotal −
  discount + tax`, discount ≤ subtotal); deposit consistency; status ⇔ timestamps / actors;
  members (`deactivatedAt` ⇔ DEACTIVATED, the owner always ACTIVE with all branches).
- **Posted-document guards** (`_guard` / `_keep` / `_immutable` triggers): BOMs and their lines,
  production orders and materials, issues, usage, output reports, finished-goods receipts,
  picks, packs, shipments and delivery events.

EP40 observed two CHECKs refusing invalid test fixtures (`PurchaseOrder_deposit_check`,
`CompanyMember_deactivated_check`) — the constraints protect the invariants independently of the
application. Gap: `AuditLog` and posted goods receipts / transfers / adjustments / counts have no
immutability trigger (EP40-06, recommendation).

## 3. Ledger integrity

- **One writer.** `applyMovement` (`backend/src/warehouse/ledger.ts`) is the only code that writes
  `StockMovement` and `StockBalance` (with its helpers `addToBalance`,
  `takeRespectingReservations`). Lots are created only through the same module.
- **Callers:**
  - goods receipt post / reversal;
  - transfer post / reversal;
  - adjustment approve / reversal;
  - count post;
  - sales dispatch;
  - material issue post;
  - finished-goods receipt post / reversal.

  The demo seed's inventory-control fixtures use the same function. There is no second ledger,
  and the only direct writes are test fixtures and the EP40 sentinel / fault-injection tests.
- **Decreases.** Every decrease checks on hand AND that what remains covers the active Sales plus
  Production reservations of that exact identity (`STOCK_RESERVED`). A dispatch or issue first
  consumes its own reservation, so it can never take the other side's.
- **Reconciliation queries** (`StockBalance = Σ StockMovement` for every location × item × lot;
  no negatives; reserved ≤ on hand; no duplicate posting per source; no consumed reservation
  without its line; no output without a posted receipt): **0 mismatches** on:
  - a fresh seed;
  - the dev copy;
  - the development database;
  - after every one of the 90 race rounds;
  - after every load write stage;
  - on the restored backup (353 → 370 movements).

## 4. Transaction rollback (fault injection)

`backend/test/ep40-rollback.test.ts` runs the real services against the test database through a
Prisma client extension that throws at a chosen write, **inside** the service transaction, after
the step's balance / reservation / status writes:

| Step | Injected at | Verified unchanged |
| --- | --- | --- |
| Goods-receipt posting | the stock movement | balances, movements, lots (the new lot is not created), status DRAFT; the same post succeeds afterwards |
| Sales dispatch | the stock movement (after the reservation is consumed and the balance reduced) | reservation ACTIVE, balance, shipment READY |
| Sales allocation | the audit entry | no reservation |
| Purchase-request approval | the audit entry | status SUBMITTED |
| Material-issue posting | the stock movement | reservations ACTIVE, issue DRAFT |
| Finished-goods receipt posting | the stock movement | output unreceived, receipt DRAFT |

**6 of 6 pass:** each injection point was reached, and the whole business effect rolled back
(balances, movements, lots, Sales and Production reservations, audit count, statuses). Failure
injection exists only in the test; production code is unchanged.

## 5. Backup and restore

On the isolated, load-tested database (`pdabliss_core_e2e40`):

1. `pg_dump -Fc` (939 KB, 71 table-data entries), verified with `pg_restore --list`.
2. Restored into a separate scratch database (`pdabliss_core_e2e40_restore`).
3. Schema: `pg_dump --schema-only` of both — **identical** (5,244 lines).
4. Data: row-level snapshot of all 70 tables — **9,279 rows, 0 changed, 0 missing, 0 added**.
5. Ledger: all reconciliation checks zero on the restored copy.
6. Workflows: the backend pointed at the restored database and the full EP39 real-stack suite
   ran — **115 / 115** (purchasing, sales, production, finished goods, production → sales,
   shortage → receipt, Executive, System Admin, Accounting, Warehouse privacy, security, races,
   integrity).

The development database was never restored into. Its EP39 backup
(`pdabliss_core_dev-before-EP39-20261106-105909.dump`) is kept.

## 6. Development database

EP40 made **no write** to `pdabliss_core_dev`; only read-only queries and a read-only `migrate
diff` touched it. A row-level comparison with its post-EP39 snapshot appears in the final report.
