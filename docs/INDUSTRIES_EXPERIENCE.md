# Industries Experience — PDA BLISS CORE (EP11)

`/industries` and six industry pages (`/industries/<id>`), each also under `/en` and `/zh`
(21 pages in total). They answer **"CORE ไม่ได้บังคับทุกธุรกิจให้ทำงานเหมือนกัน"**.

> **Presentation only.** There are no industry templates, manufacturing engine, property
> module, POS, project backend, integrations or workflow persistence behind these pages. The
> examples are illustrative, and the pages make no certification, compliance, customer or
> outcome claims. Tests check the copy and the rendered pages for this.

## Philosophy

*หลักการเดียวกัน แต่แต่ละธุรกิจทำงานไม่เหมือนกัน.* The page never says CORE has a solution
for every industry. Instead it says: *แต่ละธุรกิจมีจุดที่งานติดต่างกัน — CORE
จึงเปลี่ยนวิธีเล่าและการจัด Workflow ตามบริบทขององค์กร*.

| What stays | What changes |
| ---------- | ------------ |
| Ownership, connected workflow, checkable handoffs, shared status, approval, visible exceptions, traceability | Departments involved, the order of work, required information, decision points, terminology, manager signals |

The seven shared principles (department workspace, connected workflow, information boundary,
approval, exceptions, trace, executive visibility) appear in every industry. Each industry
phrases them in its own words. The overview shows all 42 phrases as one matrix.

## The six industries

| Industry | Motif | Operating story (example) | Stalls at | Manager signals | Boundaries |
| -------- | ----- | ------------------------- | --------- | --------------- | ---------- |
| กระจายสินค้า / ค้าส่ง (`distribution`) | network | demand → availability → sales order → pick → replenish → dispatch → close | availability | orders waiting, shortage, supplier late, partial receipt | accounting |
| ธุรกิจบริการ (`services`) | schedule | request → plan → assign → on-site → evidence → billing documents → close | assign | overdue, unassigned, missing evidence, customer waiting | accounting |
| ธุรกิจโครงการ (`projects`) | milestones | requirement → planning → procurement → execution → milestone → acceptance → instalment → close | procurement | milestone risk, dependency delay, acceptance pending, waiting approval | accounting |
| ธุรกิจค้าปลีก (`retail`) | branches | branch demand → stock by location → replenish → transfer → receipt → exception → executive view | transfer | branch exception, stock issue, transfer pending, near expiry | **not a POS**, accounting |
| อสังหาริมทรัพย์ / งานปฏิบัติการ (`property`) | sites | request → assign → service → material/vendor → complete → documents → executive view | material / vendor | open issues, vendor delay, overdue maintenance, done-not-closed | **not Property & Rental Management**, accounting |
| การผลิต (`manufacturing`) | lanes | demand → availability → planning → Work Order → issue → purchasing → receiving → production → output → delivery | material | WO delay, material shortage, partial completion, output waiting for the warehouse | **not a full MRP / MES**, accounting |

Every example workflow is labelled **ตัวอย่างกระบวนการ** — *ไม่ใช่ลำดับบังคับ*.

### What each industry page answers

1. What makes it operationally different (reality)
2. Where work gets stuck (frictions)
3. Which departments interact most
4. An end-to-end example workflow
5. The information that matters
6. What managers watch
7. How CORE fits (the seven principles)
8. What CORE does not replace
9. What may need custom implementation

### Different compositions, not different copy

| Page | Hero | Signature section | Workflow form | Rhythm |
| ---- | ---- | ----------------- | ------------- | ------ |
| Distribution | Text left, goods network right (suppliers → hub → customers, late receipt and waiting order) | **Order fulfilment**: one order, three line states; simulate the open PO arriving | Route with stations | reality band → fulfilment → route → frictions + handoffs → info + signals |
| Services | Centred text above a team schedule board, one unassigned job | **Evidence before close**: the job closes only when photos, checklist and sign-off are present | People timeline (field vs office) | frictions as voices → intake (channels → one queue) → timeline → evidence → field/office split |
| Projects | Title and lead split, milestone architecture across the width (late procurement) | **Dependency map**: switch on "materials late" and see the downstream milestones | Rising staircase with milestone gates | staggered phases → dependency map → staircase → wait chain → department × phase matrix |
| Retail | Branch map left, text right | **Branch health**: six branches × five checks; select a branch for actions | Replenishment loop | **POS boundary first** → reality → branch health → loop |
| Property | Text above a full-width skyline of sites with request pins and an outside vendor | **Request journey**: three requests stuck at vendor, materials or closing | Journey with a vendor/material fork | **Property-product boundary first** → reality + intake → journey |
| Manufacturing | Text above a full-bleed band of material lanes | **Work Order board**: materials allow 320 of 500; receiving the open set allows 500 | Department swimlanes | reality → WO board → swimlanes → frictions + lot info → signals; MRP/MES boundary with the fit |

The overview has its own sections:

- **Hero**: CORE with six environment windows around it, each carrying its pattern.
- **Why industries differ**: what stays, and what changes per industry.
- **Selector**: a cinematic tab rail on wide screens; on phones, one environment at a time with
  previous/next.
- **Workflow silhouettes**: six different shapes — detour, field dip, staircase, loop, fork and
  zig-zag.
- **Principles matrix.**
- **Fit navigator**: deterministic, nothing collected.
- **Consultation CTA.**

## Model

`frontend/src/features/industries/model.ts` is the typed source:

- Each industry: `INDUSTRIES` (id, motif, departments plus optional ones, workflow steps with
  department, `stuckAt`, signals with tone, Solutions anchors, How CORE works chapters,
  boundaries, enterprise link).
- Shared lists: `PRINCIPLES`, `STAYS`, `CHANGES`, `FIT` and `fitResult()`.
- Signature data: `ORDER_LINES` / `INBOUND` / `lineState()`, `MILESTONES` / `downstream()`,
  `BRANCHES` / `worstHealth()`, `REQUESTS`, `EVIDENCE`, `WORK_ORDER` / `MATERIALS` / `buildable()`.

Words live in `copy/` (Thai is the source; English and Simplified Chinese are complete).
`summary.ts` is shared by the overview and every page: labels, steps, signals, principles,
changes, boundaries and meta for the overview. Each industry has its own file, so each page
loads only its own long-form copy. `copy/types.ts` defines the nine questions.

```
frontend/src/features/industries/
├── model.ts · parts.tsx · useIndustryMeta.ts · industries.test.tsx
├── copy/        summary.ts · types.ts · distribution.ts · services.ts · projects.ts · retail.ts · property.ts · manufacturing.ts
├── overview/    HeroDiffer.tsx · Explore.tsx
└── pages/       DistributionPage.tsx · ServicesPage.tsx · ProjectsPage.tsx · RetailPage.tsx · PropertyPage.tsx · ManufacturingPage.tsx
frontend/src/pages/public/IndustriesPage.tsx
```

## Boundaries and privacy

- **Retail** — *CORE ไม่ใช่ระบบขายหน้าร้าน เครื่องรับชำระเงิน หรือหน้าร้านออนไลน์*. CORE runs the
  operations around the store. Sales data from an existing POS may be connected only as a
  custom implementation item.
- **Property** — leases, tenants, billing and property accounting belong to the separate PDA
  BLISS Property & Rental Management product. CORE covers internal operations: maintenance
  requests, assignment, vendors, procurement, approval and status.
- **Manufacturing** — CORE connects the operational workflow around production. It does not
  claim advanced planning, MRP calculation, machine integration, OEE or MES.
- **Accounting** — *ไม่ใช่ระบบบัญชีเต็มรูปแบบ* on every industry page.
- **Warehouse privacy** — the Warehouse role text, the fulfilment board and the Work Order
  board use quantities, lots and states only. Tests check them in every locale.

## Cross-linking and discovery

Each page links (locale preserved) to:

- its departments (EP06 pages)
- its Solutions stories (`#stock`, `#supplier`, `#visibility`, `#falling-through`, `#approval`,
  `#cross-department`, `#management`, `#payment`, `#human-error`)
- its How CORE works chapters (`#handoff`, `#approval`, `#exceptions`, `#roles`, `#trace`,
  `#human-error`)
- the other five industries and `/industries`
- a quiet `/enterprise` link where organizations are complex (every industry except services)
- a quiet `/pricing` link — *ทุกประเภทธุรกิจใช้แพ็คเกจ CORE ชุดเดียวกัน*

The top-level navigation is unchanged. `/industries` is reached from:

- the โซลูชัน highlight CTA (*ดูตามประเภทธุรกิจ*)
- the footer (องค์กร group)
- the industries strip on `/enterprise`

The homepage is untouched.

**Sitemap.** `frontend/public/sitemap.xml` now lists all 24 public routes in th / en / zh, 72
URLs in total, each with hreflang alternates and `x-default`. `src/test/publicRoutes.ts` is the
permanent public regression route set used by the header, language, route and sitemap tests.

## Localization

Thai is the source of truth. English uses operations language (SO / PO / goods receipt, Work
Order, instalment); Simplified Chinese uses natural trade terms (销售单, 调拨单, 工单, 分期款). No
Thai appears in English or Chinese, and the Chinese copy uses no Traditional characters. All 21
routes have a unique title and description, and OG tags are set from them.

## Accessibility

- One H1 per page; every section has a heading.
- The selector rail is a tablist (arrow / Home / End). Fit, roles, branches and requests are
  radio groups. Evidence and the delay toggle are switches. Receiving is a toggle button.
  Changes announce via `aria-live`.
- Tones are always icon plus words. Matrix cells show icons, with the words available to screen
  readers.
- SVG environments are decorative, with figure labels. Every width has a text or list
  equivalent, and phones get simplified hero visuals.
- Targets are at least 44 px; no horizontal scroll from 320 px.

## Motion and performance

- Heroes draw or appear once. Nothing loops or autoplays. Under reduced motion every hero is
  shown in its final state.
- Each industry page is its own lazy chunk (about 10 KB gz). They share one industries chunk
  (about 17 KB gz) holding the parts and the summary copy.
- No new dependencies, images or WebGL.
