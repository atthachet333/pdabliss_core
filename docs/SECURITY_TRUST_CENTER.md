# Security & Trust Center — `/security` (EP15)

> **ทุกคนไม่ควรเห็นทุกอย่าง**
>
> ความปลอดภัยไม่ได้เริ่มจาก Firewall แต่เริ่มจากการที่คนเห็นเฉพาะสิ่งที่จำเป็นต่อหน้าที่

The public Trust Center explains how CORE thinks about access, as product philosophy. It
describes principles and readiness honestly. It is not a vendor security sheet, and it makes no
promises about certification, uptime or infrastructure.

Routes: `/security`, `/en/security`, `/zh/security`. There is one page, not a set of fragmented
security routes.

## What a visitor should leave with

1. Not everyone sees everything.
2. Access depends on responsibility.
3. Warehouse privacy is intentional.
4. Executive ≠ Admin.
5. Hiding something in the UI is not, by itself, backend security.
6. Production enforcement belongs to later backend phases.
7. CORE does not claim certifications it does not have.

## Chapters

| # | Chapter | Answers |
| --- | --- | --- |
| 1 | Hero: "ทุกคนไม่ควรเห็นทุกอย่าง" | The access philosophy. Security is not only encryption, servers and certificates; it is also responsibility, access, visibility, boundaries, traceability and control. |
| 2 | Visibility windows (`#visibility`) | How information is separated by responsibility; what each department sees |
| 3 | Warehouse boundary (`#warehouse`) | The flagship example |
| 4 | Executive ≠ System admin (`#executive-admin`) | Business visibility vs configuration |
| 5 | UI visibility ≠ security boundary (`#enforcement`) | Frontend vs server enforcement; what exists now vs later |
| 6 | Traceability (`#trace`) | How activity is intended to be traced |
| 7 | Control (`#control`) | Required information, approval, conditions, role responsibility |
| 8 | Data principles + go-live needs (`#data`) | Principles, and what a production deployment requires first |
| 9 | Readiness matrix (`#readiness`) | What exists, what is configurable, architecture-ready or planned; what is not claimed |
| 10 | FAQ (`#faq`) | Ten direct questions with status-respecting answers |
| 11 | Consultation (`#consult`) | Next step |

## The visibility visual

One shared work item (SO-1042, 16 fields) sits in the centre, with six role windows around it:
Sales, Warehouse and Purchasing on the left; Accounting, Executive and Admin on the right. The
visitor picks a window.
- **Permitted fields:** a line runs from the field's row into the window.
- **Fields the role doesn't need:** a dashed amber line stops 30 px short of the window, with a
  tick.

The work item never changes; only the visibility around it does.

Implementation details:
- Lines are measured from the DOM (`useLines`) and redrawn on role change and resize. They are
  decorative (`aria-hidden`) and drawn from 1024 px up.
- Every row also states its result in words for screen readers: "ส่งถึงมุมมองนี้" (reaches this
  view) or "หยุดก่อนถึงมุมมองนี้" (stops before this view). Icons differ in shape (check vs.
  minus), so state never relies on colour alone.
- On phones the windows become a 2- or 3-column selector above the work item, with no lines.

The visibility is illustrative, and this is stated on the page (`model.ts` → `VISIBILITY`):

| Role | Sees |
| --- | --- |
| Sales | order, customer, item, quantity, selling price, exception |
| Warehouse | item, quantity, location, lot, expiry, receiving, picking |
| Purchasing | item, quantity, receiving, cost, supplier terms, exception |
| Accounting | order, customer, price, cost, margin, payment, terms |
| Executive | order, customer, price, margin, exception |
| Admin | permissions & settings only |

## Warehouse privacy — the flagship

**What the Warehouse sees and doesn't see:**
- **Sees:** item, quantity, location, lot, expiry, receiving and picking.
- **Never sees:** selling price, cost / purchase price, margin, payment amounts or financial
  terms.

**The visual.** Twelve lanes run from the shared item to the Warehouse view. The view is a window
whose left edge is the amber boundary. Operational fields cross it; the five money fields stop at
it.

**The factual line** (checked against the code):
- In the demo, prices are not part of the warehouse view's data at all. See EP14
  `WarehouseView`.
- The backend foundation builds warehouse data from an allow-list of operational fields only:
  `backend/src/domain/access/data-classification.ts`, demonstrated by
  `GET /api/v1/demo/warehouse/stock` on fixtures.

**The tests:**
- `model.ts` gives `VISIBILITY.warehouse` no money field.
- A test proves the other roles do carry money fields, so the boundary is real and not
  accidental.

## UI vs backend enforcement

The page says it plainly: **UI visibility ≠ security boundary**.

- **What the screen shows:** screens arranged around a responsibility reduce confusion. But once
  data has reached a device, hiding it is not protection.
- **What the server allows to be sent:** a permission check before every response, and only
  permitted data is sent.

Three stages, each with an EP10 status:
1. **Today** (*In the current prototype*): the site, demo and prototype illustrate the intended
   model.
2. **Foundation** (*Architecture-ready*): data classification plus allow-list response building,
   on sample data.
3. **Next backend phases** (*Planned*): real identity, real user permissions and a server-side
   check on every request.

## Status taxonomy

The page reuses the EP10 statuses exactly: `ClaimStatus`, `StatusTag` and `StatusKey` from
`features/enterprise`, with the EP10 labels in all three languages.

| Status | TH | EN | ZH |
| --- | --- | --- | --- |
| `prototype` | มีในต้นแบบปัจจุบัน | In the current prototype | 当前原型已具备 |
| `configurable` | กำหนดตามขอบเขต | Configured by scope | 按范围配置 |
| `ready` | เตรียมโครงสร้างไว้ | Architecture-ready | 架构已就绪 |
| `planned` | อยู่ในแผนพัฒนา | Planned | 规划中 |

### Readiness matrix

Statuses come from `model.ts` → `MATRIX`. Tests check them against EP10 `READINESS` wherever the
two models share a layer.

| Layer | Status | Meaning today |
| --- | --- | --- |
| Identity | Planned | Sign-in is a screen-review prototype; real identity, SSO and MFA are planned |
| Access | In the current prototype | Role-based visibility is shown; server enforcement for real users comes later |
| Workflow control | Configured by scope | Required info, approval and conditions are set per implementation |
| Trace | Architecture-ready | The history structure is designed; the demo shows a simulated history |
| Data | Architecture-ready | Classification plus allow-lists, tested on sample data |
| Backup / recovery | Planned | Policy and testing are defined while preparing for live use |
| Observability | Planned | Planned with each production installation |
| Integration | Architecture-ready | Structure designed; actual scope is set in implementation |

Control statuses follow EP10 `CONTROLS`:

| Control | Status | EP10 equivalent |
| --- | --- | --- |
| Required info | configurable | `requiredInfo` |
| Approval | configurable | `multiStep` |
| Conditions | configurable | `conditional` |
| Role responsibility | prototype | `crossDepartment` |

## Traceability

The intended provenance runs WHO → ROLE → DEPARTMENT → ACTION → BEFORE → AFTER → TIME / ORDER →
SOURCE. It is shown for three sample events, chosen with a radio group: receive 80 of 100, record
the lot, and approve documents.

The page shows it as *Architecture-ready*, with the demo's simulated history as *In the current
prototype*. It is never called immutable or tamper-proof.

## Backup, recovery and operations

The page lists what a live deployment needs first:
- a backup policy
- recovery testing
- monitoring
- incident procedures

Each is marked as defined during implementation, not as a service running today.

The page publishes no RPO / RTO, uptime or availability figure. It also exposes no internal IPs,
ports, machine configuration, tunnel names or secrets.

## Claim safety

`security.test.tsx` scans every string in every language. It fails on any of:
- certification and compliance claims (certified, compliant, ISO, SOC 2, PCI, HIPAA, GDPR)
- guarantee, 99.x, uptime, immutable / tamper-proof, penetration testing
- grade marketing (enterprise-grade, bank-grade, military-grade), unhackable, RPO / RTO, 100 %
- the Thai equivalents: ได้รับการรับรอง, รับประกัน, ปลอดภัย 100, ไม่สามารถแก้ไขได้
- the Chinese equivalents: 已通过, 已获得, 保证, 合规, 不可篡改, 万无一失

"What PDA BLISS does not claim yet" is stated on the page:
- no third-party certification
- no availability or recovery-time figures
- no live real identity, SSO or MFA
- prototype screens are not production enforcement

## Links and navigation

- **Primary CTA:** "พูดคุยเรื่อง Security / Implementation" → `/contact?interest=implementation`.
  It uses the EP13 prefill contract; delivery is unchanged and still not sent by the website.
- **Secondary CTA:** "ดู Enterprise" → `/enterprise`.
- **Quiet link:** "ดู CORE Demo" → `/demo`. The Warehouse chapter also links to
  `/demo?role=warehouse`.
- **Control chapter:** links to `/how-core-works#approval` and `/enterprise#control`.
- **Entry points:**
  - the Enterprise mega menu item "Security & Trust", previously "Security & Access" →
    `/enterprise#access`
  - the footer's "ความปลอดภัย" link
  - the quiet link on `/login`
- **Unchanged:** `/enterprise#access` itself, and there is no new top-level header item.

## Files

```
frontend/src/features/security/
├── model.ts          roles, fields, visibility, trace, controls, principles, matrix, FAQ, links
├── copy.ts           th / en / zh-CN
├── Visibility.tsx    hero, visibility windows (measured lines), Warehouse boundary
├── Chapters.tsx      Executive ≠ Admin, enforcement, trace, control, data, readiness, FAQ, consult
└── security.test.tsx
frontend/src/pages/public/SecurityPage.tsx
```
