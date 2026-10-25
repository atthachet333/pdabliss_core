# Resources — the CORE Knowledge Library (EP16)

`/resources` (`/en/resources`, `/zh/resources`) and seven guides under `/resources/<slug>`.

## Philosophy

A Resource Center, not a blog. Guides are version-controlled product knowledge:

- **No dates, no authors, no feed.** Nothing is "latest", and nothing is "coming soon". A guide
  that is not finished is simply not in the registry.
- **No fake Article structured data.**
- **Useful without buying CORE.** Every guide was reviewed with one question: would this teach
  something useful to a reader who never buys CORE? Each one ends in something portable: the
  five control principles, the four boundary questions, the ten-step journey and checklist, the
  vendor questions and the glossary.
- **Honest about status.** Anything that is a prototype or planned is called that, in the same
  words as `/security` and `/enterprise`.

## The seven guides

| Slug | Title (TH) | What it teaches |
| --- | --- | --- |
| `getting-started` | เริ่มต้นกับ CORE | What CORE is and is not, how each department sees it, where each role should start. |
| `how-core-works` | งานหนึ่งชิ้น จากต้นจนจบใน CORE | The written companion to EP08. It covers eight stages (item, owner, state, handoff, approval, exception, trace, completion), why each exists, with SO-1042 examples in native disclosures. |
| `human-error` | Human Error: ป้องกัน ตรวจพบ แจ้งเตือน ควบคุม ย้อนรอย | PREVENT / DETECT / ALERT / CONTROL / TRACE. Each has a real case, its limits, a reflective question, and a map from mistake to principle. It never promises zero errors. |
| `warehouse-privacy` | ทำไมคลังสินค้าไม่เห็นราคา | The reference explanation of visibility by responsibility. Covers what the warehouse sees and does not see and why, data classes and clearance, hiding vs never sending, and how value-related work is handled. |
| `implementation-guide` | คู่มือการนำ CORE ไปใช้ | Ten steps mapped to the six EP10 phases (purpose, output, people), an in-memory readiness checklist, and common pitfalls. |
| `security-and-data` | ความปลอดภัยและข้อมูล ฉบับเข้าใจง่าย | Plain-language boundaries, screen vs server, trace, readiness before live use, what is not claimed, and questions to ask any vendor. It summarizes `/security` and does not duplicate it. |
| `core-glossary` | อภิธานศัพท์ CORE | 22 terms with an A–Z index, category filters and in-memory search. Each has a definition, an example (19 of 22) and a "where explained" link. |

## Typed registry

`frontend/src/features/resources/registry.ts` is the single source of structure:

- **Per resource:** id, slug, category, audience, related departments (EP06 keys), related
  solutions (EP09 ids), related How CORE Works chapters (EP08 `CHAPTER`), 2–3 "read next" ids,
  reading minutes, featured, and `status: 'published'`.
- **Guided entries:** `START_PATHS`, `PROBLEM_GUIDE` (EP09 problems → guide), `DEPARTMENT_READING`
  (EP06 departments → 2–3 guides) and `STAGES` (organization stages).

Words are kept apart from structure:

- `meta.ts` holds the light, localized title, short line, summary and tags. These are all that
  `/resources`, search and the mega menu need.
- Each guide's full copy lives in its own `guides/*.copy.ts`, inside that guide's route chunk.

`journey.ts` (ten implementation steps → EP10 phases) is shared by the home page and the
implementation guide. Category accents live in `accent.ts`.

## Home (`/resources`)

1. **Hero** — "เข้าใจระบบ ก่อนตัดสินใจใช้ระบบ". Search sits in the hero. On desktop a knowledge map
   connects the seven guides: edges come from each guide's "read next" list and animate on hover
   or focus (static under reduced motion). The map is a `nav` of real links.
2. **Start here** — three questions (what CORE is / what it solves / evaluating), each an
   ordered path of 2–3 guides.
3. **Learn by problem** — the eight EP09 problems, as a segmented radio group. Each shows a common
   cause, the guide that explains the mechanism, the problem on `/solutions#…`, and the mechanism
   on `/how-core-works#…`.
4. **Learn by department** — six EP06 departments; each shows 2–3 guides with a reason.
5. **Learn by organization stage** — four stages, from first structure to stronger standards.
6. **Library** — all seven guides as an editorial index (not a thumbnail wall), with category
   filters.
7. **Glossary teaser** — six highlighted definitions and a link to the full glossary.
8. **Security & Implementation** — short entries into both guides, `/security` and the ten-step
   journey.
9. **CTA** — talk to PDA BLISS (`/contact?interest=consulting`) or try the demo.

## Search

`search.ts`, in memory, client-side only, with no library:

- **Normalization:** NFKC (full-width → ASCII), lower case, collapsed whitespace, zero-width
  characters removed.
- **Matching:** every query token must appear somewhere in the item. Thai and Chinese have no word
  spaces, so a token matches as a substring.
- **What it reads:** title, short line, summary, category name, tags, and the names of glossary
  terms explained by that guide — all in the visitor's language. Glossary terms are returned too,
  by name (strong) or by definition (weak).
- **Ranking and reason:** title > tag / term > category > summary, and every result says why it
  matched ("ตรงกับหัวข้อ “Lot”").
- **No result:** suggestion chips fill the query.
- **Keyboard:** native `type="search"`, Escape clears, results are ordinary links in tab order,
  and the status line is `aria-live`.

## Filters

There are three radio groups:

- library categories
- glossary categories
- the department picker

All three use one shared `ChipGroup` (`parts.tsx`): a single tab stop, arrow keys / Home / End
move and select, and the selected chip carries a check mark as well as its fill (never colour
alone). The problem picker reuses the existing `Segmented` control.

The library's "เริ่มต้น" filter includes the glossary (category `terminology`).

## Glossary

- **Order and index:** terms are sorted by their English name. The A–Z index links only letters
  that have a visible term, and follows the current search and filter.
- **Search:** in memory, over the English name, the localized name and the definition.
- **Each entry:** name, English name (when different), category, definition, example, and a link
  to the guide that explains it. Each term has a stable anchor, `#term-<id>`, which search results
  link to.
- **Accounting:** "Operational finance" states plainly that it is not a ledger, journal entries
  or tax.

## Implementation checklist

- Nine items, `useState` only, with a progress line (`aria-live`).
- **Reset:** a "ล้างรายการ" button appears once anything is ticked.
- **No persistence:** there is no storage, no network and no form or submit, and the copy says so
  ("ไม่มีการบันทึกหรือส่งข้อมูลใด ๆ").
- **Controls:** native checkboxes (visually replaced, focus ring kept), 48 px rows.

## Warehouse privacy

The guide explains the principle and contains no financial value in any locale:

- **The sample warehouse view:** item, location, lot, expiry, receiving and picking only.
- **Does not see:** selling price, cost, margin, payment amounts, supplier financial terms.
- **Clearance table:** mirrors `backend/src/domain/access/data-classification.ts`
  (`WORKSPACE_DATA_CLEARANCE`). A test keeps the two in step.
- **Today:** the guide states what holds today (the demo view model carries no prices; the
  backend foundation builds warehouse data from an operational allow-list on sample data) and
  that server-side enforcement for real users comes in the next backend phases.

## Security claim boundaries

The EP15 claim scanner now lives in `frontend/src/test/claims.ts`. `/security` and every
Resource Center copy module read the same patterns:

- ISO, SOC 2, PCI, HIPAA, GDPR, certified / compliant / compliance
- guarantee, uptime, 99.x
- penetration / pen-test
- RPO / RTO, 100 %
- "military / bank / enterprise-grade"
- the Thai and Chinese equivalents

The Human Error guide also has its own absolute-claim scan (zero errors, error-free, eliminate,
prevents all, 零差错 …). Any mention of ledger, journal or tax must be a negation.

## Localization

- **Coverage:** every string exists in Thai, English and Simplified Chinese.
- **Tests:**
  - English and Chinese copy contain no Thai, and the rendered `/en` and `/zh` pages show none.
  - Chinese contains no Traditional characters, and no Chinese sentence is a copy of the English
    one.
- **Deliberately English in every locale:** section eyebrows ("03 · Learn by problem") and the
  EP10 phase codes (DISCOVER …), as on the rest of the site.

## SEO

- **Metadata:** each of the 8 routes × 3 locales has a unique `<title>`, description and
  `og:title` / `og:description` (via `usePageMeta`), and exactly one H1. Since EP17 each also has a
  self-referencing canonical, reciprocal hreflang alternates and `og:url` / `og:locale`. See
  [SEO_LOCALIZATION.md](SEO_LOCALIZATION.md).
- **Contextual entries (EP17):** `GuideLink` adds a quiet "อ่านคู่มือ: …" link into a guide from
  the product page that raises the question:
  - `/how-core-works` closing CTA → How CORE Works guide
  - `/security` Warehouse chapter → Warehouse Privacy
  - `/enterprise#implementation` → Implementation Guide
- **Sitemap:** all 24 URLs are in `public/sitemap.xml` with hreflang alternates (105 URLs in
  total). `/resources` has priority 0.7; guides have 0.6.
- **Route set:** the routes are in the shared `test/publicRoutes.ts`.

## Navigation

- **Header:** the top-level item **ความรู้** (Resources / 资源) opens a mega menu with the seven
  guides. Its highlight is the Resource Center (`/resources`).
- **ติดต่อเรา:** left the text navigation and became a primary pill action beside the language
  selector and sign-in.
- **Footer:** ความรู้ was added to ลิงก์ด่วน. There is no other footer change.
- **Guide endings:** every guide ends with "อ่านต่อ" (2–3 contextual guides). It then lists
  related site pages — guide-specific links, departments, Solutions anchors and How CORE Works
  anchors, each destination once — and one fitting CTA.

## Accessibility

- **Structure:**
  - one H1 per page
  - guides are `<article>` with an ordered heading outline (tested)
  - the breadcrumb is a `nav` with `aria-current`
- **Examples:** native `<details>`.
- **Diagrams:** each is a real ordered list or table, with a text caption.
- **Status:** the clearance table uses check / minus icons with screen-reader words, so status is
  never shown by colour alone.
- **Targets:** at least 44 px.
- **Focus:** visible focus comes from the global focus ring.
- **Reading progress:** an `aria-hidden` hairline.

## Performance

- **Chunks:** `/resources` and each guide are separate lazy route chunks. A shared `search` chunk
  (registry, meta, glossary, search) serves the home page and the glossary.
- **Home vs guides:** full guide copy is never in the home chunk.
- **Dependencies:** no new ones. Search is client-side.

## Known limitations

- **Search** is substring-based: no typo tolerance, stemming or Thai word segmentation.
- **Glossary order:** sorted by English name in every locale, so the A–Z index is Latin.
- **Glossary examples:** 3 of 22 terms (CORE, Workspace, Audit trail) have no example, because
  their definition is the example.
- **Reading time** is a static estimate, kept honest by a test against the English word count.
- **Clearance mirror:** the frontend test holds a copy of the backend clearance map; it cannot
  import backend source.
- **Metadata** is set client-side like the rest of the site (no SSR / prerender), so crawlers
  that do not run JavaScript see the default title.
