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
| 08 | `long-term` | Built for long-term use | *We adapt workflows — CORE remains a product*: standard foundation + configuration / workflow adaptation + project-specific integrations where needed (stacked layers); products by PDA BLISS |
| 09 | `company-information` | Company information | Registered name(s), office address, phone, email, LINE inside `<address>`; *how we communicate* trust list |
| 10 | `talk` | CTA | *พูดคุยกับ PDA BLISS* → `/contact` (primary), LINE OA (secondary, new tab, announced), quiet links to `/industries` and `/why-core` |

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

## Files

```
frontend/src/config/company.ts          COMPANY, companyName(), PRODUCTS
frontend/src/features/story/parts.tsx   Lines (authored wrap points), StoryHead, QuietLink, DeptDot
frontend/src/features/about/
├── model.ts       chapter ids, principles, symptoms, guards, stages/steps, exchange, activities, layers
├── copy.ts        th / en / zh-CN words
├── Hero.tsx       hero + real-work → system visual
├── Belief.tsx     01 company · 02 belief · 03 problem · 04 systems
├── Method.tsx     05 approach (signature methodology)
├── Work.tsx       06 consulting · 07 implementation · 08 long-term · 09 company info · 10 talk
└── about.test.tsx
frontend/src/pages/public/AboutPage.tsx
```
