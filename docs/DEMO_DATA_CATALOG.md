# Demo Data Catalog (EP39)

Everything `npm --prefix backend run db:seed:demo` creates in the demo company
(`PDA BLISS CORE DEMO COMPANY`, branches `00000` Head Office and `00001` Demo Branch). Clearly
labelled fictional data — "(ตัวอย่าง)" / "(ข้อมูลสาธิต)" in names; no real business, person or
price list.

Document numbers below are those of a **fresh** database seeded once in November 2026 (numbers
are monthly: `SO-YYYYMM-NNNNNN`). On an older database the same fixtures keep the numbers they
got when first seeded, and EP39 fixtures continue each sequence (for example the EP39 purchase
request is `PR-202611-000008` on a dev database that already had one hand-made request).

## Data classification

| Class | What it is | How to recognise it | Seed behaviour |
| --- | --- | --- | --- |
| `STATIC_DEMO_FIXTURE` | created by the demo seed | its CREATED audit entry carries `changes.demo = <KEY>` and actor scope `seed` (master records: stable codes and a seed `*_CREATED` entry) | created **once**; never updated, reset or recreated afterwards, whatever happened to it since |
| `USER_CREATED_DEMO_RECORD` | made by a person in the demo company (screens or API) | no `demo` key on its CREATED entry; actor scope `customer` | never read, changed or deleted by the seed; the seed's numbers simply follow it |
| `INTEGRATION_QA_RECORD` | made by automated QA (E2E suites, browser QA) | only in disposable scratch databases (`pdabliss_core_qa39`, `pdabliss_core_e2e39`, `*_test`) | never written to the development database |

Seed safety rules: [`docs/DEMO_PERSONAS.md`](DEMO_PERSONAS.md) → *Seed safety* and *EP39*.

## Master data

| Kind | Code | Name (EN gloss) | Unit | Lot / expiry | Since |
| --- | --- | --- | --- | --- | --- |
| Finished good | FG-000001 | Skin cream 50 ml | PCS | required / required | EP28 |
| Finished good | FG-000002 | Serum 30 ml | PCS | required / required | EP39 |
| Finished good | FG-000003 | Sunscreen lotion 100 ml | PCS | required / required | EP39 |
| Raw material | RM-000001 | Cold-pressed coconut oil | KG | optional / optional | EP28 |
| Raw material | RM-000002 | Glycerin | KG | required / required | EP39 |
| Raw material | RM-000003 | UV filter concentrate | L | required / optional | EP39 |
| Packaging | PK-000001 | Packaging box | BOX | none | EP28 |
| Packaging | PK-000002 | Plastic pump bottle | PCS | none | EP39 |

- Units: `PCS`, `KG`, `BOX`, `L` (EP39). Categories: `FG`, `RM`, `PK` (EP39).
- Customers: `CUS-000001` Demo shop (business), `CUS-000002` Demo pharmacy (business, EP39),
  `CUS-000003` Demo individual customer (EP39).
- Suppliers: `SUP-000001` raw materials, `SUP-000002` packaging (EP39), `SUP-000003` chemicals (EP39).
- Locations: `00000/MAIN`; `00001/MAIN` (default) and `00001/RECEIVING`.
- BOMs: `BOM-FG-000001` R2 ACTIVE (0.25 kg RM-000001 + 1 PK-000001) and R1 RETIRED (0.3 kg);
  `BOM-FG-000002` R1 ACTIVE (0.05 kg RM-000002 + 1 PK-000002, EP39); `BOM-FG-000003` R1 ACTIVE
  (0.1 L RM-000003 + 1 PK-000002, EP39).

## Purchasing

| Key | Number | Branch | State | Who | Notes |
| --- | --- | --- | --- | --- | --- |
| PR_DRAFT_WAREHOUSE | PR-202611-000001 | 00001 | DRAFT | warehouse.demo | packaging refill |
| PR_SUBMITTED_SALES | PR-202611-000002 | 00000 | SUBMITTED | sales.demo → Purchasing queue | item + non-item line |
| PR_APPROVED_OPERATIONS | PR-202611-000003 | 00001 | APPROVED (partly ordered) | operations.demo, approved by purchasing.demo | 12.5 kg RM-000001 |
| PR_APPROVED_PURCHASING | PR-202611-000004 | 00000 | APPROVED | purchasing.demo, approved by the owner | source of PO_DRAFT / PO_WAITING_DEPOSIT |
| PR_APPROVED_WAREHOUSE | PR-202611-000005 | 00001 | APPROVED (fully ordered) | warehouse.demo | source of PO_RECEIVED |
| PR_REJECTED_PURCHASING | PR-202611-000006 | 00000 | REJECTED (reason) | purchasing.demo, rejected by the owner | |
| PR_EP39_MATERIALS | PR-202611-000007 | 00001 | APPROVED | operations.demo, approved by purchasing.demo | RM-000002 20 kg, PK-000002 300, RM-000003 6 L |
| PO_DRAFT | PO-202611-000001 | 00000 | DRAFT | purchasing.demo | prices filled, not issued |
| PO_WAITING_DEPOSIT | PO-202611-000002 | 00000 | WAITING_DEPOSIT (30 %) | purchasing.demo → accounting.demo | the Accounting deposit |
| PO_PENDING_RECEIVE | PO-202611-000003 | 00001 | PENDING_RECEIVE, **partly received** (5 of 8 kg) | → warehouse.demo | |
| PO_CANCELLED | PO-202611-000004 | 00001 | CANCELLED (reason) | purchasing.demo | released 4.5 kg of the request |
| PO_RECEIVED | PO-202611-000005 | 00001 | RECEIVED (two receipts) | → warehouse.demo | FG-000001 + PK-000001 |
| PO_EP39_RECEIVED | PO-202611-000006 | 00001 | RECEIVED (one receipt, two lots) | purchasing.demo → warehouse.demo | SUP-000002 |
| PO_EP39_AWAITING | PO-202611-000007 | 00001 | PENDING_RECEIVE, **nothing received** | purchasing.demo → warehouse.demo | SUP-000003, RM-000003 6 L — the receipt the material shortage waits for |

## Warehouse

| Key / record | Number | State | Notes |
| --- | --- | --- | --- |
| GR_PARTIAL | GR-202611-000001 | POSTED | 5 kg RM-000001 lot RM-DEMO-01 |
| GR_RECEIVED_1 / 2 | GR-202611-000002 / 3 | POSTED | FG-000001 lots A, B (expires in 12 days), C; packaging 96 + 4 rejected |
| GR_EP39_FULL | GR-202611-000004 | POSTED | RM-000002 lots GLY-DEMO-A (12 kg, MAIN) and GLY-DEMO-B (8 kg, RECEIVING, expires first); PK-000002 300 |
| TR_POSTED / TR_DRAFT | TR-… | POSTED / DRAFT | transfer history and a draft |
| ADJ_DECREASE / ADJ_INCREASE | ADJ-… | POSTED | damage −3 / found +2 packaging; plus three labelled owner adjustments (production materials, EP37 / EP38) |
| CC_POSTED | CC-… | POSTED | RECEIVING counted, one correction |
| Pending pick | SO-202611-000003 | READY | allocated in full, no pick yet — the order warehouse.demo can fulfil |
| Packed shipment | SO-202611-000008 | picked + packed, no shipment | |
| Dispatched / delivered | SO-202611-000009, SO-202611-000011 | DELIVERED shipments | |
| Delivery exception | SO-202611-000010 | DELIVERY_EXCEPTION | recipient unavailable |
| Pending finished goods | MO-202611-000006 output #1 | 2 accepted pieces waiting for Warehouse | output #2 waits for the quality decision |

Stock after a fresh seed (`00001`): FG-000001 lots A 12, B 4 + 2, C 12, OUT-A 2, OUT-B 2;
FG-000002 lot SER-DEMO-01 10; PK-000001 76 + 1; PK-000002 280; RM-000001 lots RM-DEMO-01 5,
RM-DEMO-02 3.5; RM-000002 lots GLY-DEMO-A 12, GLY-DEMO-B 7. Reserved: most FG-000001 and
RM-000001 (sales and production demo reservations), PK-000002 12 (MO_EP39_FOR_SALES).
Every quantity is `StockBalance = SUM(StockMovement)`.

## Sales

| Key | Number | Branch | State | Fulfilment shown in the list |
| --- | --- | --- | --- | --- |
| SO_DRAFT | SO-202611-000001 | 00000 | DRAFT (sales.demo) | — |
| SO_SUBMITTED | SO-202611-000002 | 00000 | SUBMITTED — short (Head Office has no stock) | — |
| SO_CONFIRMED | SO-202611-000003 | 00001 | CONFIRMED, fully allocated | Fully allocated (not picked yet) |
| SO_CANCELLED | SO-202611-000004 | 00000 | CANCELLED (reason) | — |
| SO_ALLOC_PARTIAL | SO-202611-000005 | 00001 | CONFIRMED, partly allocated (raw material short) | not started |
| SO_OPEN | SO-202611-000006 | 00001 | CONFIRMED, awaiting allocation | not started |
| SO_FUL_PICKING | SO-202611-000007 | 00001 | partly picked | Partly picked |
| SO_FUL_PACKED | SO-202611-000008 | 00001 | picked and packed | Picked |
| SO_FUL_SHIPPED | SO-202611-000009 | 00001 | 4 delivered, 6 packed | Partly delivered |
| SO_FUL_EXCEPTION | SO-202611-000010 | 00001 | dispatched, delivery failed | Delivery exception |
| SO_EP39_DELIVERED | SO-202611-000011 | 00001 | CONFIRMED, **delivered** (the manufactured serum) | Delivered |
| SO_EP39_SUBMITTED | SO-202611-000012 | 00001 | SUBMITTED, in stock (sales.demo) | — |
| SO_EP39_DRAFT | SO-202611-000013 | 00001 | DRAFT, editable by sales.demo | — |
| SO_EP39_DEMAND | SO-202611-000014 | 00001 | CONFIRMED, nothing in stock → production | not started |

## Production

| Key | Number | State | Notes |
| --- | --- | --- | --- |
| MO_DRAFT | MO-202611-000001 | DRAFT | |
| MO_SUBMITTED | MO-202611-000002 | SUBMITTED | |
| MO_APPROVED | MO-202611-000003 | APPROVED, fully reserved | |
| MO_SHORTAGE | MO-202611-000004 | APPROVED, materials short | 40 pieces |
| MO_SALES | MO-202611-000005 | SUBMITTED, from a sales line | |
| MO_EXEC | MO-202611-000006 | IN_PRODUCTION | issue posted + a draft issue, usage below issue (variance), output accepted and partly received, second output awaiting approval |
| MO_PARTIAL | MO-202611-000007 | APPROVED, partly reserved | |
| MO_DONE | MO-202611-000008 | COMPLETED | received in full |
| MO_EP39_SHORT_CLOSED | MO-202611-000009 | COMPLETED · SHORT_CLOSED (reason) | 16 good + 2 defective of 20; usage 0.95 of 1 kg and 18 of 20 bottles (variance); lot SER-DEMO-01 |
| MO_EP39_FOR_SALES | MO-202611-000010 | APPROVED, partly reserved | from SO_EP39_DEMAND; PK-000002 reserved, RM-000003 short until PO_EP39_AWAITING is received |

## Accounting and Executive

- Accounting: the supplier deposit of PO-202611-000002 (Head Office, 30 % pending). CORE has no
  invoices, receivables, ledger or payments beyond supplier deposits; none are invented.
- Executive: reads the real records above. No synthetic metrics or dashboard figures exist.
