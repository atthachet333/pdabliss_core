# For Organizations / Enterprise Experience — PDA BLISS CORE (EP10)

`/enterprise` (`/en/enterprise`, `/zh/enterprise`) answers **"CORE ทำงานอย่างไรเมื่อองค์กรใหญ่ขึ้น?"**

> **The same CORE philosophy, with stronger organizational controls, adaptation and
> implementation support** — not "the same product with more features".

> **Presentation only.** No SSO, SCIM, RBAC engine, audit service, integrations, SLA
> infrastructure, workflow engine, billing or contracts sit behind this page. Every capability
> carries an honest status, and the page makes no certification, compliance, uptime,
> response-time, customer-size, partnership or security-guarantee claims (enforced by tests on
> all copy and on the rendered page).

## Positioning

For organizations with many departments, approval chains, many users, several branches and
other systems to connect — roughly the 100M–1,000M THB range — without promising any size.
Industry-agnostic: distribution, services, projects, retail operations, property & facilities,
production.

Headline: *เมื่อองค์กรใหญ่ขึ้น / ระบบต้องช่วยควบคุมความซับซ้อน / ไม่ใช่เพิ่มความซับซ้อน*.

## Claim statuses

Every capability is labelled with one of four statuses — always an icon **and** words, and
explained in a key under the hero:

| Status | Thai | Meaning |
| ------ | ---- | ------- |
| `prototype` | มีในต้นแบบปัจจุบัน | Demonstrable in the CORE prototype today |
| `configurable` | กำหนดตามขอบเขต | Set up per package and implementation scope |
| `ready` | เตรียมโครงสร้างไว้ | Structure designed to support it — **not a certification** |
| `planned` | อยู่ในแผนพัฒนา | On the roadmap — ask the team for the latest status |

*พร้อมรองรับ ≠ การรับรองมาตรฐาน* is stated on the page in all three languages.

## Page structure and composition

Thirteen chapters, each with its own composition — no card grids.

| # | Chapter | Anchor | Composition |
| - | ------- | ------ | ----------- |
| — | Hero | — | Statement left; **layered organization** on a stage right: teams & departments → connected processes → control layer → executive visibility (floors narrow as they rise, tied by a lit spine). Status key beneath. |
| 01 | Growing complexity | `#complexity` | A **growth staircase** (team → departments → cross-department → approval & control → organizational layer) as tabs; nine multipliers light up as the stage grows; anchor *ความซับซ้อนไม่ควรถูกโยนให้ผู้ใช้จำเอง*; industries strip. |
| 02 | One organization | `#organization` | **One CORE workspace = one company** (all branches, no multi-company switching — unlike PDA ONE); six workspaces orbiting one shared state; responsibility scale Employee → Team lead → Manager → Executive as rising terraces. |
| 03 | Access & role control | `#access` | **One work object, role masks**: choose Executive / Manager / Staff / Warehouse / Accounting / System admin; hidden fields show a lock and "ซ่อน". Then **Executive ≠ System admin** as a split comparison. |
| 04 | Workflow & approval control | `#control` | One stage board: simple / multi-step / conditional rails; below, six controls with statuses. |
| 05 | Audit & traceability | `#audit` | Event timeline (tabs) and one expanded record: user, role, department, before → after, order, source. |
| 06 | Executive visibility | `#executive` | Signals band (blocked, exceptions, approvals, department state, bottlenecks, risk); **terraces** descending Organization → Department → Workflow → Work item → Source state; reporting by package. |
| 07 | Custom workflow | `#workflow` | Switch adjustments (approval, document, notification, swap department order, exception path) and watch the process rebuild; adjusted steps marked with + and words. |
| 08 | API & integration | `#integration` | CORE at the centre, eight system types on a dashed perimeter; API by package from the pricing model. |
| 09 | Multi-branch | `#branches` | A company tree: one company → head office + branches → one CORE. |
| 10 | Implementation journey | `#implementation` | One continuous roadmap: DISCOVER / DESIGN / CONFIGURE / PREPARE / LAUNCH / IMPROVE with ten numbered steps; migration and training policy. |
| 11 | Support & partnership | `#support` | An ascending ladder Standard → Priority → Higher Priority → Dedicated / SLA; what an Enterprise engagement may include. |
| 12 | Readiness | `#readiness` | Readiness ≠ certification banner; an eight-layer stack (Identity, Access, Workflow, Audit, Integration, Data, Observability, Support) each with a status; security principles. |
| 13 | Consultation | `#consult` | Consultation → requirements → process review → scope → quotation → implementation planning; **ขอใบเสนอราคา** (`/contact?interest=plans`), **พูดคุยกับทีม PDA BLISS** (`/contact`), ดูแพ็คเกจ Enterprise (`/pricing?plan=enterprise`); read-next links. |

Phones get their own layouts: the staircase becomes widening steps, the orbit and perimeter
become lists, rails and journeys run vertically, the ladder widens as it climbs. The page
works at 320 px.

## Model

`frontend/src/features/enterprise/model.ts` is the single typed source: statuses, chapter ids,
growth stages and multipliers, levels, access roles, the shared work object and
`ROLE_VISIBILITY`, approval rails, controls (with statuses), audit events and fields, drill
levels and signals, workflow adjustments and `buildProcess()`, system types, branch examples,
implementation phases and journey, relationship, readiness layers (with statuses), security
principles, quote flow and cross-links. Package facts (API, reports, support) are read from
`features/pricing/plans.ts` — never duplicated.

Words live in `copy.ts` (th source / en / zh-CN). Layout primitives (`Chapter`, `Frame`,
`Stage`, `Kicker`, `ChapterTitle`, `Plane`) were moved from `/solutions` to
`components/editorial/Layout.tsx` and are shared by both pages.

```
frontend/src/components/editorial/Layout.tsx   shared long-form layout primitives
frontend/src/features/enterprise/
├── model.ts · copy.ts
├── parts.tsx          StatusTag, StatusKey, Note, Head
├── Hero.tsx           hero + layered organization
├── Structure.tsx      complexity · organization · access (+ Executive ≠ Admin)
├── Control.tsx        approval control · audit · executive visibility
├── Adapt.tsx          custom workflow · integration · multi-branch
├── Partnership.tsx    implementation · support · readiness · consultation
└── enterprise.test.tsx
frontend/src/pages/public/EnterprisePage.tsx
```

## Rules the page keeps

- **Warehouse privacy.** The Warehouse view of the shared object shows item, quantity, lot,
  location and expiry — price, cost and payment are masked (label + lock, never the value).
- **Executive ≠ System admin.** Executive = business visibility and decision support, does not
  configure the system. Admin = users, permissions and workflows, is not the business
  decision-maker and does not see business data (only `config` in the model).
- **Roles are illustrative.** *บทบาทและสิทธิ์จริงกำหนดตามขอบเขตการวางระบบและแพ็คเกจ — ไม่ใช่โมเดลสิทธิ์สุดท้ายของ production.*
- **Approval conditions** use request type, exceptions or risk — never money thresholds.
  Escalation is *planned*.
- **Audit** — *รองรับแนวคิดการตรวจสอบย้อนหลัง*; not a legal certification, audit standard or
  immutable ledger.
- **Integration** — *ออกแบบให้พร้อมต่อยอดการเชื่อมต่อ … การเชื่อมต่อจริงขึ้นอยู่กับขอบเขตโครงการ*;
  the perimeter shows types, not ready-made connectors or partners. API: Starter not included,
  Business add-on, Professional included, Enterprise included + custom integration in scope.
- **Multi-branch** — *รองรับการออกแบบโครงสร้างสำหรับ…*; reporting by branch only where configured.
- **Custom workflow** — included in Professional, defined in project scope for Enterprise; not
  unlimited customization.
- **Migration & training** — initial migration at no cost, scope depends on the data; usage
  guide in every package, extra training charged per engagement unless in an Enterprise quote.
- **Support** — no response times are published; *SLA ตามที่ตกลง*.
- **Readiness** — *ออกแบบโดยคำนึงถึงการควบคุมสิทธิ์และการแยกข้อมูลตามหน้าที่* and
  *ความสามารถด้านความปลอดภัยบางส่วนจะถูกพัฒนาและกำหนดตามสถาปัตยกรรม production*.

## Navigation and links

สำหรับองค์กร mega menu: สำหรับองค์กรขนาดใหญ่ → `/enterprise`, Security & Access → `#access`,
Audit & Control → `#audit`, Custom Workflow → `#workflow`, API & Integration → `#integration`,
Implementation & Support → `#implementation`; highlight CTA → `/contact`. Footer สำหรับองค์กร →
`/enterprise`; the homepage Enterprise chapter ends with a quiet link to `/enterprise`.

Read-next: Solutions `#management`, `#cross-department`, `#approval`; How CORE works
`#approval`, `#trace`, `#roles`; departments Executive, Warehouse, Accounting. All links keep
the current locale (and its hash when switching language).

## Motion

The hero floors rise once (base first). Interactive changes recolour or fade in 0.2–0.3 s.
Nothing loops, pulses or autoplays. Under reduced motion every floor is visible from the first
frame and all transitions are instant.

## Accessibility

- One H1; every chapter has an H2.
- Growth stages and audit events are tablists with panels; roles, rails and drill levels are
  radio groups (arrow / Home / End); workflow adjustments are toggle buttons (`aria-pressed`);
  changes announce via `aria-live`.
- Status, masking and adjustments are always icon + words; SVG diagrams are decorative with
  figure labels and text equivalents.
- Targets ≥ 44 px; no horizontal scroll from 320 px.
