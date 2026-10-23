# Solutions Experience — PDA BLISS CORE (EP09)

`/solutions` (`/en/solutions`, `/zh/solutions`) answers **“CORE ช่วยแก้ปัญหาอะไรในองค์กร?”** —
starting from pain, not from features.

> **Presentation only, qualitative only.** No workflow engine, notifications, integrations or
> report engine sits behind this page, and it makes no numeric improvement claims
> (no %, hours saved, ROI, uptime or guarantees — enforced by tests on all copy).

## Philosophy

องค์กรไม่ได้พังเพราะไม่มีข้อมูล. The information usually exists; the problems are that it
lives in different places, each department sees a different part, there is no shared status,
ownership is unclear, handoffs can't be checked, and problems are seen too late. CORE makes
operational work **visible, connected and controlled** — and most problems live **between**
departments, at the joins.

EP08 showed movement (a route); EP09 shows **friction → resolution**: a stable system,
breakdowns at the joins in a restrained warm tone, and clarity restored in emerald/teal.

## Page structure

| # | Section | Anchor | Visual logic |
| - | ------- | ------ | ------------ |
| 01 | Hero — problems live between departments | — | Five stable departments; friction marks appear on the joins; CORE reconnects underneath (plays once). The core story: six causes. |
| 02 | Problem map | `#problem-map` | Operational network of six departments; frictions sit on the joins; toggle *จุดสะดุด / เมื่อมี CORE*; each friction links to its story. Phones: department pairs + friction chips. |
| 03 | Work falling through | `#falling-through` | Work items on handoff tracks stuck in an ownerless gap → owned, with owner / state / next action / waiting on / handoff history. |
| 04 | Status chasing | `#visibility` | Split: the questions people ask vs one shared state seen through five department lenses. |
| 05 | Human error | `#human-error` | Error lifecycle for six mistakes: possible mistake → CORE check → PREVENT / DETECT / ALERT / CONTROL → trace. |
| 06 | Approval bottleneck | `#approval` | Request → rule → approver → **waiting (pause, elapsed)** → decision → continue, for four request types. |
| 07 | Stock / Lot / Expiry | `#stock` | Quantity by location → lot identity → expiry timeline → FEFO pick → movement / count / hold–release, plus the real warehouse preview. |
| 08 | Supplier visibility | `#supplier` | PR → PO → expected receipt → partial receipt → outstanding → affected work; ordered 100 / received 60 / outstanding 40. |
| 09 | Document / payment dependency | `#payment` | Four document gates (switches) before *พร้อมจ่าย*; the accounting boundary. |
| 10 | Management visibility | `#management` | Quiet activity per department below; exceptions rise into the executive panel, plus the real executive preview. |
| 11 | Cross-department operations | `#cross-department` | Six department workspaces (EP06 imagery) on one shared state line — *แยกวิธีทำงาน แต่ไม่แยกกระบวนการ*. |
| 12 | Navigator | `#navigator` | *องค์กรคุณกำลังเจออะไร?* — eight symptoms → cause, capability, department, mechanism, next story. |
| 13 | CTA | — | ดูว่า CORE ทำงานอย่างไร (`/how-core-works`) · สำรวจแต่ละแผนก (`/departments`) · ขอ Demo (`/contact`). |

Every story answers: problem · where it happens · impact · what CORE does · who benefits ·
departments involved · the How CORE works chapter · boundary where needed — plus a
qualitative before / with-CORE pair.

## Solution model

`frontend/src/features/solutions/model.ts` is the single typed source:

- `SOLUTIONS` — id, anchor, departments (first = primary page), `workflow` (a
  `/how-core-works` chapter id from the EP08 model), tone, `between` (map join), `mapT`.
- Map geometry: `MAP_NODES`, `MAP_CORE`, `MAP_EDGES`, `frictionPoint()`.
- Story data: `RECEIPT`, `LOTS`, `PICK`, `fefoPicks()`, `COUNT`, approval kinds/stages,
  `LIFECYCLE`, `MISTAKES`, payment `GATES`, status `LENSES`, `NAVIGATOR`.

Words live in `copy.ts` (th / en / zh-CN). Components only render the model.

```
frontend/src/features/solutions/
├── model.ts · copy.ts
├── parts.tsx          Story frame, ToneBadge, StoryLinks, BeforeAfter, Panel
├── HeroAndMap.tsx     hero visual + problem map
├── StoriesA.tsx       falling through · status chasing · human error · approval
├── StoriesB.tsx       stock · supplier · payment · management · cross-department
├── Navigator.tsx      navigator + CTA
└── solutions.test.tsx
frontend/src/pages/public/SolutionsPage.tsx
```

## Cross-links

| Story | Departments | How CORE works |
| ----- | ----------- | -------------- |
| Work falling through | Sales, Warehouse, Purchasing, Accounting | `#handoff` |
| Status chasing | Sales, Operations, Warehouse, Purchasing, Accounting | `#responsibility` |
| Human error | Warehouse, Purchasing, Accounting | `#human-error` |
| Approval bottleneck | Purchasing, Accounting, Executive | `#approval` |
| Stock / Lot / Expiry | Warehouse, Operations, Sales | `#exceptions` |
| Supplier visibility | Purchasing, Warehouse, Operations | `#decisions` |
| Document / payment | Accounting, Purchasing, Warehouse | `#approval` |
| Management visibility | Executive + all | `#roles` |
| Cross-department | all six | `#replay` |

All links keep the current locale. Pricing is not used as an ending.

**Navigation:** the โซลูชัน mega menu now links to stories — ลด Human Error →
`#human-error`, เชื่อมการทำงานหลายแผนก → `#cross-department`, Workflow & Approval →
`#approval`, Stock & Expiry Control → `#stock`, Operational Visibility → `#visibility`,
Management Control → `#management`; highlight CTA → `/solutions`. The homepage Complexity
chapter ends with a quiet link to `/solutions`.

## Privacy and boundaries

- **Warehouse privacy.** The Stock / Lot / Expiry story uses quantities, lots, dates and
  locations only — zero financial wording, in copy, sample data, visuals and the embedded
  warehouse preview. Tests check the story copy in all locales and the rendered section.
  ("จ่าย" here means issuing goods.) The status-chasing Warehouse lens shows no money either.
- **Accounting boundary.** The payment story is operational finance: *CORE ช่วยเชื่อมขั้นตอน
  การจ่ายเงินที่ผูกกับงานจริง ไม่ได้แทนระบบบัญชีเต็มรูปแบบ บัญชีแยกประเภท หรือการยื่นภาษี*.
- **Approval timing.** The elapsed wait is shown to locate the bottleneck; the page states it
  is not automatic time-based escalation.

## Localization

Thai is the source of truth; English (enterprise operations tone) and Simplified Chinese are
complete. Users' own words are used: ค้างรับ, รออนุมัติ, เอกสารไม่ครบ, ของไม่พอ, Supplier
เลท, ใกล้หมดอายุ. The only Thai in EN/ZH is the inert product previews, captioned as Thai
product UI.

## Motion

The hero plays once: friction marks fade in on the joins, then the CORE line draws and its
label appears — no loops, no pulses. The problem map, falling-through track and approval
pipeline change state with short transitions. Under reduced motion everything is shown in its
final state and transitions are instant (global rule).

## Accessibility

- One H1; every section has an H2.
- Problem-map frictions are links with text; view toggles, lenses, mistakes, request types and
  the navigator are radio groups (arrow / Home / End); payment documents are switches with a
  live status; replay-style changes announce via `aria-live`.
- Problem / resolved states are always icon + words; SVGs are decorative with figure labels
  and text equivalents (phone layouts render the same content as lists).
- Targets are at least 44 px; the page works at 320 px.
