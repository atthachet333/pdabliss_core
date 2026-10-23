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

## Page structure and composition (EP09 revision)

The page is paced as one editorial narrative — large → quiet → asymmetric → immersive →
compact → wide → editorial → interactive — with varied section heights, background planes
and widths.

| # | Section | Anchor | Composition |
| - | ------- | ------ | ----------- |
| 01 | Hero | — | Cinematic first screen (≈ viewport height at desktop): large statement left, the friction → reconnect system visual dominating the right and bleeding toward the edge; the six causes as an open strip under a hairline. Animation unchanged (plays once). |
| 02 | Problem map | `#problem-map` | Near full width on a faint grid plane: narrow copy column with the view toggle and a compact tone legend integrated beside the network; the network dominates. No surrounding card. Phones: a divided list of department pairs. |
| 03 | Work falling through | `#falling-through` | Asymmetric editorial: statement + anchor *ทุกงานต้องมีเจ้าของ* + facts as prose on the left; the handoff track on a soft plane on the right. Situations set as one leading quote and two smaller ones. |
| 04 | Status chasing | `#visibility` | True split-screen across the full width: a dim warm half with scattered questions (*ต้องถาม*) against an emerald half with one shared state and role views (*เมื่อมี CORE*). |
| 05 | Human error | `#human-error` | Immersive dark inspection layer: the selected scenario lit in the centre; PREVENT / DETECT / ALERT / CONTROL as structural anchors left and right, the active one lit; TRACE as the base layer underneath. |
| 06 | Approval bottleneck | `#approval` | Horizontal process stage on one open line; *Waiting* opens a wider dashed gap with pause and elapsed state. Vertical sequence on phones. |
| 07 | Stock / Lot / Expiry | `#stock` | Operational control surface: locations · lot identity · expiry timeline & FEFO in three divided columns, movement & count beneath; warehouse preview beside the heading. |
| 08 | Supplier visibility | `#supplier` | Wide timeline PR → PO → expected → partial → outstanding; under the delay point, the receipt bar and the affected downstream work hang below a dashed line (cause → effect). |
| 09 | Document / payment | `#payment` | Compact, calm gate on a narrower frame: documents (switches) on the left, a gate that opens in the middle, readiness on the right. |
| 10 | Management visibility | `#management` | Flagship vertical hierarchy: executive attention band on top; signal lines converge upward from the floor; quiet department fields below with only exceptions lit; anchor *งานปกติควรไหล / สิ่งผิดปกติควรถูกเห็น* sits between the layers. |
| 11 | Cross-department | `#cross-department` | Wide synthesis: centred statement; six workspaces across the width connected down to one CORE line. |
| 12 | Navigator | `#navigator` | Calm: a symptom list on the left, one focused response on the right. |
| 13 | CTA | — | Quiet, narrow and spacious — no box. |

Widths vary on purpose: editorial copy narrow, interactive visuals wide (1440), map / split /
management / stock surface near full width (1640), CTA narrow again. Stories close with one
of three meta arrangements (strip, split, quiet) so they don't all end the same way.

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
เลท, ใกล้หมดอายุ. The only Thai in EN/ZH is the inert warehouse product preview, captioned as Thai
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
