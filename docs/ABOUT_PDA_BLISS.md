# About PDA BLISS — `/about` (EP12)

`/about` answers **who PDA BLISS is and how it works**. It is not a generic company profile:
no stacked mission / vision / values / timeline / team cards. The page is editorial — large
statements, whitespace, process sketches and system fragments — and every claim on it is one
the company can stand behind today. Why the specific product exists lives on
[`/why-core`](WHY_CORE.md); the two pages do not repeat each other.

## Company identity (approved fields only)

| Field | Value | Source |
| --- | --- | --- |
| Thai registered name | บริษัท พีดีเอ บลิส จำกัด | `COMPANY.legalNameTh` (`frontend/src/config/company.ts`) |
| English registered name | PDA BLISS COMPANY LIMITED | `CONTACT.company` |
| Office address | 186/42 หมู่ 6 ต.ทวีวัฒนา อ.ไทรน้อย จ.นนทบุรี 11110 (printed in Thai, `lang="th"`, in every locale) | `CONTACT.address` |
| Phone | 063-869-3614 (คุณวิน / Khun Win) | `CONTACT.phone` + `contact.phoneLabel` |
| Email | pdablissoffice@gmail.com | `CONTACT.email` |
| LINE OA | @593oiwec · `https://line.me/R/ti/p/@593oiwec` | `CONTACT.lineId`, `CONTACT.lineUrl` |

`COMPANY` (`config/company.ts`) holds the names and **reads every contact value from
`CONTACT`** — nothing is duplicated, and the existing shell test still fails if any other file
hardcodes a phone, email, LINE or address value. Its shape mirrors schema.org `Organization`
(`name`, `legalName`, `address`, `telephone`, `email`, `sameAs`), so structured data can be
generated later without collecting anything again. `companyName(locale)` returns the Thai name
on Thai pages and the English name elsewhere.

**Not modelled, because no approved source exists:** founding year, employee count, revenue,
office count, client count, projects completed, awards, certifications, partnerships,
registration number, testimonials, founder or advisor names, portraits or biographies. A test
fails if the copy invents any of them, or describes the office as a house / home / residence.
No Google Maps link is configured in the project, so none is shown and no coordinates are
invented.

## Positioning

- **PDA BLISS** = the company · product maker · implementation partner.
- **CORE** = Department Operations Platform.
- The page keeps them distinct (chapter 01 shows them as two rows of a definition list).
- A restrained *Products by PDA BLISS* list (chapter 08) names PDA BLISS CORE (Department
  Operations Platform — *you are here*), PDA ONE (business / accounting platform, from the
  company's perspective) and Property & Rental Management (leases, tenants, billing for rental
  operations) — described only as far as `PRODUCT_CONCEPT.md` and `INDUSTRIES_EXPERIENCE.md`
  already do. It is not a comparison page and never diminishes PDA ONE.

## Story (section ids)

| # | Id | Chapter | Form |
| --- | --- | --- | --- |
| — | (hero) | *เราไม่ได้เริ่มจากคำถามว่า Software ควรมีฟีเจอร์อะไร / เราเริ่มจากคำถามว่าองค์กรทำงานจริงอย่างไร* | Two-tone H1 (muted question → bright answer), lead, CTAs, then the **real work → structured system** visual: scattered notes / chat bubbles / document slips converge into five connected work states owned by departments, ending at CORE |
| 01 | `pda-bliss` | Who PDA BLISS is | Editorial paragraph + company/product definition list |
| 02 | `belief` | What we believe | One lead principle in display type (*Software should fit responsibility*), then a seven-line manifesto in two staggered columns — not eight equal cards |
| 03 | `problem` | The operational problem | *Organizations do not lack software; work is spread across too many places* — seven scattered "slips" (disconnected tools, fragmented information, chat handoffs, unclear ownership, duplicated entry, delayed visibility, module-shaped systems) with broken threads; quiet link to `/solutions` |
| 04 | `systems` | How we think about systems | A common approach (one large system → same structure → search for your work) vs the CORE philosophy (responsibility → department workspace → connected workflow → organization visibility), with a note that this is a design philosophy, not a judgement; Human Error by design: guide / validate / reveal / control / preserve context ↔ PREVENT / DETECT / ALERT / CONTROL / TRACE; link *ดูว่าแนวคิดนี้ทำงานจริงอย่างไร* → `/how-core-works` |
| 05 | `approach` | From process to product — **the signature methodology** | Ten steps (00 Real work → Observe → Understand responsibility → Map process → Find failure points → Design workflow → Design interface → Build → Test with real scenarios → Improve) grouped into the four forms the work takes: **notes from the floor → responsibility map → workflow → CORE screen**, each drawn more structured than the last; "then back to real work" closes the loop |
| 06 | `consulting` | Consulting / working with organizations | A working-session table — *Your organization ↔ PDA BLISS ↔ CORE configuration* — across processes, responsibilities, problems, controls and desired outcome; eight activities as a flowing list; an honest boundary |
| 07 | `implementation-approach` | Implementation | Listen → Understand → Map → Design → Build/configure → Validate → Train → Launch → Improve (rail; vertical on phones); link → `/enterprise#implementation` (details are not duplicated) |
| 08 | `long-term` | Built for long-term use | *We adapt workflows — CORE remains a product*: standard foundation + configuration + workflow adaptation + project-specific integrations where needed (EP13: four stacked layers, contrasted with *NOT: a new codebase for every organization*); the PDA BLISS product family |
| 09 | `company-information` | Company information | Registered name(s), office address, phone, email, LINE inside `<address>`; *how we communicate* trust list |
| 10 | `talk` | CTA | EP13: *อยากให้เราช่วยดู Process ขององค์กรคุณ?* — *พูดคุยกับ PDA BLISS* → `/contact?interest=consulting` (primary), LINE OA (secondary, new tab, announced), quiet links to `/industries` and `/why-core` |

`#approach` and `#consulting` are mega-menu destinations.

## Consulting positioning

*ที่ปรึกษา* means working together on processes and CORE implementation, by the PDA BLISS
team — process mapping, workflow review, department responsibility review, implementation
planning, data preparation, training, custom workflow discussion and integration scope. The
page says plainly that it is **not accounting, tax or legal advisory**. No advisor profiles,
names, credentials or portraits exist in an approved source, so the slot is a company-level
description; when real advisor information is approved, it belongs in chapter 06.

## Product vs customization

Every organization starts from the same CORE foundation (department workspaces, documents,
states, permissions, audit trail). Configuration adapts approval chains, conditions, roles and
steps. Project-specific integrations are added only where needed, within an agreed scope. The
page states that this is **not a new codebase per organization** — which keeps every customer
on the same product and keeps CORE maintainable as SaaS.

## Trust

Trust comes from clarity: real company identity and contact channels, honest capability status
(as on `/enterprise`), explicit boundaries (including what CORE does not do), and no numbers,
awards or certifications without a source. There is no logo wall and no social proof.

## Visual direction

EP08 movement · EP09 friction · EP10 architecture · EP11 environments · **EP12 belief, identity
and craft**. Large typography and editorial whitespace; process fragments (notes, chat, slips)
becoming structured states; hand-drawn → structured sketches in the methodology; no stock
photography, no office imagery, no faces. Warm amber marks unstructured reality; CORE teal
marks structure. Thai labels never carry wide letter-spacing.

## EP13 — the cinematic layer

EP13 keeps every approved EP12 message and makes the page memorable. The motion language is
**state transformation**: each scene has one progress value (0 → 1) and every element derives
its state from it — never decoration, never random particles, never scroll hijacking. Each
movement says one of: disorder → structure, observation → understanding, process → workflow,
disconnected → connected, responsibility becoming visible, complexity becoming simpler.

### Signature scenes

1. **Real work → CORE (hero, 8/10).** A full-width scene behind the headline. Ten fragments —
   chat, spreadsheet, PO, checklist, status note, approval request, receiving slip — float
   loosely at three depths, **align into department lanes**, **connect with emerald lines**,
   **compress into five department chips** (Sales, Warehouse, Purchasing, Accounting,
   Operations) and **resolve into one quiet CORE state** (`SO-1042 · ready to deliver`).
   Desktop: driven by native scroll through a pinned viewport (`240vh`, sticky); fragments
   lean a few px away from a nearby fine pointer and the CORE state gains a controlled glow
   near it. Phones: the scene plays once when seen. A readable five-stage list with a thin
   progress line is the text equivalent.
2. **Process → Product design table (9/10).** Three zones on one drafting table —
   *notes from the floor → responsibility / process → CORE screen*. Choosing any of the ten
   steps (all listed with their text) marks zones done / active / ahead, emphasises the part of
   the artifact that step works on, and shows **what PDA BLISS asks** and **what the step
   produces** (e.g. *ใครควรเป็นเจ้าของ? · ตรงไหนผิดได้ง่าย? · ผู้ใช้ต้องเห็นอะไรตอนนี้?*).
   Previous / next buttons step through.
3. **Human Error defense rings (8/10).** Five concentric layers — PREVENT, DETECT, ALERT,
   CONTROL, TRACE — around a correct handoff. Choosing a layer sends one work item
   (`LOT-B12 · 24`) in from the edge; outer layers show as passed, the chosen one raises a
   barrier, and the panel shows the scenario (wrong lot · quantity mismatch · near expiry ·
   unapproved adjustment · unknown change) and what CORE is designed to do — *not a guarantee*.
4. **Consulting work table (7/10).** Five artifacts (process, responsibility, issue, control,
   desired state) lie on a table between *your organization* (left), *PDA BLISS* (near side)
   and *CORE configuration* (right). Picking one brings it to the middle; each side shows its
   contribution. The full topic table stays below as an overview.

Also upgraded: **chapter system** (oversized ghost numbers at ≈3.5 % opacity, a rule that draws
on entry, a `fig. 0X` system notation per chapter, and a thin chapter rail on ≥ 1536 px);
**manifesto** (the seven lines lock into place as they are read — locked lines gain clarity and
a check; the line in the reading band is lit; nothing auto-advances); **operational problem**
(slips drift slightly out of alignment with scroll; evidence of disagreeing statuses, an offset
duplicate record and one thread that never arrives); **common system design vs the CORE
approach** (scroll-driven: modules expand out of one system with every user wired to every
module, while scattered work collapses into five department workspaces on one shared state);
**implementation** (one continuous blueprint path, drawn by scroll, nine points);
**product / customization** (four layers assemble from the foundation up, beside a struck-out
*new codebase for every organization*); **identity lockup** (PDA BLISS → *makes and looks
after* → CORE); **product family** (PDA BLISS above three products, CORE marked *you are
here*). Company information stays calm and static.

Section continuity: hero fragments → broken threads in the problem → lanes and workspaces in
the systems shift → artifacts on the design table → the CORE screen.

### Reduced motion

Every scene renders its final state: the hero shows the departments and the CORE state (no
drifting fragments, no pin), all manifesto lines are locked, the systems shift is complete, the
implementation path is fully drawn and every point reached, the product stack is assembled,
selections switch instantly. Nothing depends on movement; every scene has a text equivalent.

## Files

```
frontend/src/config/company.ts          COMPANY, companyName(), PRODUCTS, organizationSchema()
frontend/src/components/seo/OrganizationSchema.tsx
frontend/src/features/story/parts.tsx   Lines, StoryHead (ghost / notation), QuietLink, DeptDot
frontend/src/features/about/
├── model.ts       chapter ids, principles, symptoms, guards, steps, zones, fragments, lanes, layers
├── copy.ts        approved th / en / zh-CN story words
├── motion.ts      motion primitives: segment / easing, element size, scene scroll, play-once, fine pointer
├── Rail.tsx       chapter rail (≥ 1536 px)
├── Hero.tsx       hero layout (pinned / compact / reduced)
├── Belief.tsx     01 lockup · 02 manifesto · 03 problem · 04 systems
├── Method.tsx     05 design table
├── Work.tsx       06 consulting · 07 implementation · 08 long-term · 09 company · 10 talk
├── scenes/
│   ├── copy.ts                scene vocabulary (th / en / zh-CN)
│   ├── HeroScene.tsx          real work → CORE
│   ├── sketches.tsx           the four methodology artifacts
│   ├── SystemShift.tsx        common design vs CORE
│   ├── DefenseRings.tsx       Human Error layers
│   ├── WorkTable.tsx          consulting table
│   └── ImplementationPath.tsx blueprint path
└── about.test.tsx
frontend/src/pages/public/AboutPage.tsx
```
