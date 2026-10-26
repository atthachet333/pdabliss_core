# CORE Public Frontend v1 — Freeze Manifest

**Freeze identifier:** CORE Public Frontend v1 — EP22 Freeze
**Freeze date:** 2026-10-26
**Status:** frozen after owner approval of EP22. Changes follow the policy in §19–§20.

This is the canonical record of what the public PDA BLISS CORE website is at v1. When this
document and another doc disagree about the frozen public baseline, this document wins; when this
document and the source disagree, the source is checked first and the difference is reported, not
silently "fixed" in either direction.

> Frozen means **the public frontend v1 is complete and protected**. It does **not** mean the PDA
> BLISS CORE product is production-ready: real authentication, the database, RBAC, server-side
> enforcement and the CORE engines are built from EP23 on, and production deployment and the
> production SEO launch come after full-system QA (§21, §23).

## 1. Purpose

- Record the approved public baseline so later episodes (backend, product, engines) start from a
  known, reviewed state.
- Say which changes stay allowed, which need owner approval, and which must never happen
  silently (§19–§20).
- Hand the backend work a precise statement of what the frontend promises and what it does not
  (§22, [FRONTEND_BACKEND_HANDOFF.md](FRONTEND_BACKEND_HANDOFF.md)).

## 2. Freeze baseline

| Item | Value |
| --- | --- |
| Baseline commit (approved, pushed) | `c0656de` — `test: complete CORE public release candidate audit (EP21)` |
| Freeze commit | `chore: freeze CORE public frontend v1 (EP22)` — documentation and freeze guards only; no public output change |
| Branch | `main` |
| Frontend | Vite 8, React 19, React Router (data router), Tailwind 4, three.js + react-three-fiber |
| Backend | Fastify + TypeScript skeleton, Prisma schema only (no database, no migrations) |
| Build output | 105 indexable HTML pages + 3 `noindex` shells = 108 HTML files |
| Tests at freeze | frontend 817 (EP21's 813 + 4 EP22 freeze guards, 34 files); backend 21 (4 files) |
| Proposed tag | `public-v1-freeze` on the EP22 commit — **proposal only**; the repository has no tags and none is created or pushed without the owner's decision |

## 3. EP21 approval

EP21 ([EP21_RELEASE_AUDIT.md](EP21_RELEASE_AUDIT.md)) audited the release candidate: **PASS WITH
ACCEPTED LIMITATIONS** — P0 0 · P1 0 · P2 3 (fixed) · P3 11 (6 fixed, 5 accepted). The owner
approved it and it was pushed as `c0656de`, with the statement: *Public Frontend v1 ready to
freeze. This does NOT mean the complete PDA BLISS CORE product is production-ready.*

## 4. Product definition

- PDA BLISS CORE is a **Department Operations Platform**, not a generic ERP.
- **One CORE workspace = one company.** Branches are allowed under that company; there is no
  company selector or company switching.
- Six departments (§7). **Executive is not System Admin**: Executive is cross-department
  oversight; administration (users, roles, configuration) is a separate function.
- Human Error framework: CORE helps **PREVENT / DETECT / ALERT / CONTROL / TRACE** human error. It
  never promises zero mistakes.
- Made by PDA BLISS COMPANY LIMITED (บริษัท พีดีเอ บลิส จำกัด); the product name is PDA BLISS CORE.

## 5. Route baseline

Source of truth: `frontend/src/config/publicRoutes.ts` (35 route families) and
`frontend/src/seo/prerender.ts` (3 shells). Locale prefixes: TH none (primary), EN `/en`,
ZH (Simplified) `/zh`. Every family exists in all three locales and is indexable: 35 × 3 = **105
indexable URLs**, each with canonical, hreflang (th / en / zh-CN / x-default), OG and sitemap
entries.

| # | Canonical (TH) | EN | ZH | Index | Family |
| --- | --- | --- | --- | --- | --- |
| 1 | `/` | `/en` | `/zh` | index | Overview |
| 2 | `/features` | `/en/features` | `/zh/features` | index | Product |
| 3 | `/departments` | `/en/departments` | `/zh/departments` | index | Product |
| 4 | `/departments/executive` | `/en/departments/executive` | `/zh/departments/executive` | index | Product |
| 5 | `/departments/sales` | `/en/departments/sales` | `/zh/departments/sales` | index | Product |
| 6 | `/departments/operations` | `/en/departments/operations` | `/zh/departments/operations` | index | Product |
| 7 | `/departments/warehouse` | `/en/departments/warehouse` | `/zh/departments/warehouse` | index | Product |
| 8 | `/departments/purchasing` | `/en/departments/purchasing` | `/zh/departments/purchasing` | index | Product |
| 9 | `/departments/accounting` | `/en/departments/accounting` | `/zh/departments/accounting` | index | Product |
| 10 | `/how-core-works` | `/en/how-core-works` | `/zh/how-core-works` | index | Product |
| 11 | `/demo` | `/en/demo` | `/zh/demo` | index | Product |
| 12 | `/pricing` | `/en/pricing` | `/zh/pricing` | index | Product |
| 13 | `/solutions` | `/en/solutions` | `/zh/solutions` | index | Solutions |
| 14 | `/industries` | `/en/industries` | `/zh/industries` | index | Solutions |
| 15 | `/industries/distribution` | `/en/industries/distribution` | `/zh/industries/distribution` | index | Solutions |
| 16 | `/industries/services` | `/en/industries/services` | `/zh/industries/services` | index | Solutions |
| 17 | `/industries/projects` | `/en/industries/projects` | `/zh/industries/projects` | index | Solutions |
| 18 | `/industries/retail` | `/en/industries/retail` | `/zh/industries/retail` | index | Solutions |
| 19 | `/industries/property` | `/en/industries/property` | `/zh/industries/property` | index | Solutions |
| 20 | `/industries/manufacturing` | `/en/industries/manufacturing` | `/zh/industries/manufacturing` | index | Solutions |
| 21 | `/enterprise` | `/en/enterprise` | `/zh/enterprise` | index | Solutions |
| 22 | `/resources` | `/en/resources` | `/zh/resources` | index | Resources |
| 23 | `/resources/getting-started` | `/en/resources/getting-started` | `/zh/resources/getting-started` | index | Resources |
| 24 | `/resources/how-core-works` | `/en/resources/how-core-works` | `/zh/resources/how-core-works` | index | Resources |
| 25 | `/resources/human-error` | `/en/resources/human-error` | `/zh/resources/human-error` | index | Resources |
| 26 | `/resources/warehouse-privacy` | `/en/resources/warehouse-privacy` | `/zh/resources/warehouse-privacy` | index | Resources |
| 27 | `/resources/implementation-guide` | `/en/resources/implementation-guide` | `/zh/resources/implementation-guide` | index | Resources |
| 28 | `/resources/security-and-data` | `/en/resources/security-and-data` | `/zh/resources/security-and-data` | index | Resources |
| 29 | `/resources/core-glossary` | `/en/resources/core-glossary` | `/zh/resources/core-glossary` | index | Resources |
| 30 | `/about` | `/en/about` | `/zh/about` | index | About |
| 31 | `/why-core` | `/en/why-core` | `/zh/why-core` | index | About |
| 32 | `/security` | `/en/security` | `/zh/security` | index | About |
| 33 | `/contact` | `/en/contact` | `/zh/contact` | index | Contact |
| 34 | `/privacy` | `/en/privacy` | `/zh/privacy` | index | Legal |
| 35 | `/terms` | `/en/terms` | `/zh/terms` | index | Legal |

`/features` is in the Product family for header state but is reached from the homepage close, not
a menu item (see [PUBLIC_ROUTE_DISCOVERABILITY.md](PUBLIC_ROUTE_DISCOVERABILITY.md)).

**Shells (not in the sitemap, `noindex`):**

| Shell | Serves | Notes |
| --- | --- | --- |
| `login.html` | `/login`; `/en/login`, `/zh/login` (200 rewrite) | Prototype gateway (§10, §21) |
| `404.html` | unknown, doubled-locale and malformed-locale paths | Localized 404; the 404 status on the real host is verified in the production phase |
| `app.html` | `/app/*` (200 rewrite) | Internal workspaces; never public, never in the sitemap |

**Aliases (`dist/_redirects`, written by `scripts/prerender.mjs`, 301):** `/th/*` → unprefixed,
`/zh-CN/*` and `/zh-hans/*` → `/zh/*`.

## 6. Navigation baseline

Source: `frontend/src/config/navigation.ts`, see [GLOBAL_NAVIGATION.md](GLOBAL_NAVIGATION.md).

- **Header:** Overview (`/`) + four mega menus (Product, Solutions, Resources, About), then
  language, Contact (`/contact`) and Login. Thai labels: ภาพรวม · ผลิตภัณฑ์ · โซลูชัน · ความรู้ ·
  เกี่ยวกับเรา. Desktop menus from 80 rem (1280 px); below that, the mobile menu.
- **Product:** How CORE works, Departments, Demo, Pricing; by department: Executive, Sales,
  Operations, Warehouse, Purchasing, Accounting.
- **Solutions:** Problems (`/solutions`), Industries, Enterprise; by industry: Distribution,
  Services, Projects, Retail, Property, Manufacturing.
- **Resources:** Getting started; How CORE works, Human error, Warehouse privacy; Implementation
  guide, Security and data, CORE glossary.
- **About:** About, Why CORE, Security; Approach (`/about#approach`); CTA consulting
  (`/about#consulting`).
- **Footer:** a closing summary, not a sitemap — Product (Departments, How CORE works, Demo,
  Pricing) and Explore (Solutions, Industries, Enterprise, Resources, About), plus separate brand,
  contact and legal zones.

## 7. Department baseline

Six departments, in this order: **Executive, Sales, Operations, Warehouse, Purchasing,
Accounting** (`DEPT_PAGES`, `src/features/departments/catalog.ts`). Each has a public page and a
prototype workspace. System Admin is not a department and has no public department page.

## 8. Pricing baseline

Source: `frontend/src/features/pricing/plans.ts`, see [PRICING_AND_PACKAGES.md](PRICING_AND_PACKAGES.md).

| Plan | Monthly | Departments | Executive | Storage | API |
| --- | --- | --- | --- | --- | --- |
| Starter | ฿399 | max 2 | no | 3 GB | no |
| Business (**recommended**) | ฿699 | max 4 | yes | 10 GB | add-on |
| Professional | ฿999 | all 6 | yes | 30 GB | included |
| Enterprise | by quote | custom | yes | custom | included / custom |

- No free plan; a demo is available.
- Annual: Year 1 pay 12 months; Year 2 pay 10, use 12; Year 3+ 15 % off.
- Priced **per company**, all branches included.
- Lot / Expiry / FEFO is core whenever Warehouse is enabled.

## 9. Contact baseline

Source: `frontend/src/config/contact.ts`, see [CONTACT_EXPERIENCE.md](CONTACT_EXPERIENCE.md).

- Contact person คุณวิน · phone 063-869-3614 · email pdablissoffice@gmail.com · LINE @593oiwec
  (`https://line.me/R/ti/p/@593oiwec`).
- Office address: 186/42 หมู่ 6 ต.ทวีวัฒนา อ.ไทรน้อย จ.นนทบุรี 11110 — an office address, never
  described as a home or residence.
- Seven consultation paths: demo, general, consulting, implementation, integration, plans,
  enterprise; query prefill `interest`, `plan`, `industry`, `department`.
- The final state is **prepared, not submitted**: hand-off by LINE, email, copy or phone. Nothing
  is sent to a server (`src/features/contact/delivery.ts` is the future seam).

## 10. Demo baseline

Source: `frontend/src/features/demo/`, see [INTERACTIVE_DEMO.md](INTERACTIVE_DEMO.md).

- Deterministic scenario **SO-1042**: ordered 120, on hand 20, short 100; partial receipt
  80 / 100, 20 outstanding.
- Roles, handoffs, PREVENT / DETECT, FEFO, Accounting gate, Executive exception and trace are all
  reachable; nothing is persisted.
- The public Demo is **never connected to production data**, now or after the backend exists.

## 11. Warehouse privacy

Warehouse must never see **price, unit cost, total cost, margin, payment amount, supplier
financial terms** or any other protected financial value — on the public Warehouse page, in every
Demo Warehouse state, in guides, menus and metadata.

In the product this is a **data / API boundary**, not hidden UI: the server must not serialize
those fields for a Warehouse audience (EP25). The public site describes it as design, not as live
enforcement.

## 12. Accounting boundary

Accounting in CORE is operational finance: payment status, document workflow and the
operational hand-off between departments. It is **not** a general ledger, journals, tax filing,
full accounting software, or a replacement for PDA ONE.

## 13. Security and claims

- Architecture-honest framing: what is designed, what exists today, what is planned
  (`/security`, [SECURITY_TRUST_CENTER.md](SECURITY_TRUST_CENTER.md)).
- No certification, compliance, guarantee, uptime, immutability, RPO/RTO or "100 %" claims; no
  fake customers, metrics, testimonials, awards or authors. Enforced by the shared claim scanner
  (`src/test/claims.ts`) and `src/test/release.test.ts`.
- Server-side enforcement is described as design until the backend enforces it.

## 14. Localization

Thai (primary, unprefixed), English (`/en`), Simplified Chinese (`/zh`, `zh-CN`). Route parity
across all three locales. Approved Thai in EN/ZH: the inert, captioned Thai product-UI previews
and the office address. No Traditional Chinese. See [SEO_LOCALIZATION.md](SEO_LOCALIZATION.md).

## 15. SEO

The EP17 SEO model is ready: prerendered HTML for 105 indexable pages + 3 shells, route-specific
title / description / canonical / hreflang / OG / `lang` / JSON-LD, `sitemap.xml` (no `/app`,
no `/login`), `robots.txt` (`/app/` disallowed). **Production SEO is not complete**: the site is not
deployed, Search Console is not set up and no indexing has been requested (§21).

## 16. Accessibility

EP19 baseline, re-audited in EP21 ([ACCESSIBILITY_RESPONSIVE.md](ACCESSIBILITY_RESPONSIVE.md)):
axe clean except the accepted decorative About numbers (EP21-A1), keyboard journeys, focus
management, reduced motion, forced colors, 320–1920 px. This is an engineering baseline, **not a
WCAG certification**, and no real screen-reader QA has been done.

## 17. Performance

See [PERFORMANCE.md](PERFORMANCE.md). At freeze (local synthetic measurements, not field data):

- Initial JS **179.6 KiB gzip** against a 205 KiB budget; CSS, route, CORE World, font, hero,
  HTML and file-count budgets enforced by `npm run perf` (and inside `npm run build`).
- CLS ≲ 0.003 on measured routes.
- CORE World pauses offscreen and when the tab is hidden, respects reduced motion, and leaves
  nothing behind after navigation (EP21-03 leak fixed).

**Regression risks to watch:** new textures or materials that are cached at module level;
shared geometry (three.js `Sprite` shares one geometry across instances); renderer / WebGL
context lifecycle on unmount; any module-level three.js resource whose `dispose` listeners can
keep an old renderer alive. Re-run the heap / DOM-counter check from the release checklist after
touching `src/features/landing/core-world/`.

## 18. Accepted limitations

From EP21, carried forward unchanged:

- **Findings:** EP21-A1 (decorative About numbers contrast), A2 (approved Thai in EN/ZH), A3 (two
  unused 8 KiB hero images ship), A4 (suite timeouts only under artificial double load), A5
  (react-three-fiber holds the last scene until next render; bounded).
- **Environment:** Safari not tested; no real-device QA; no real screen-reader QA; performance
  numbers are synthetic; production delivery / Cloudflare not verified; prototype login is
  intentional; backend enforcement is not implemented.

## 19. Allowed post-freeze changes (Category A — no unfreeze needed)

Allowed without owner approval, as long as public output and the frozen rules stay the same or
only factual errors are corrected:

- Typo, grammar or translation-quality fixes that do not change meaning, claims or numbers.
- Bug, accessibility, browser-compatibility or performance fixes that keep the same content,
  routes, navigation and design.
- Dependency security patches that keep every gate green.
- Tests, tooling, CI and documentation (including this manifest's status lines).
- Backend and internal `/app` work that does not change the public bundle, public routes or
  prerendered output.

## 20. Owner-approval changes (Category B) and not-allowed-silently (Category C)

**Category B — requires owner approval before the change:**

- Adding, removing, renaming or re-indexing a public route, or changing a locale prefix.
- Header, mega-menu or footer structure, labels or destinations.
- Any pricing, package, limit, annual-rule, storage, API or department-count change.
- Contact data or the contact flow's final state.
- Public copy that changes meaning, product scope, security statements or claims.
- Visual redesign of a public page, the CORE World, or the Login gateway.
- Raising a performance budget.
- Replacing the prototype gateway (planned for EP23, still announced and approved per episode).

**Category C — never done silently (always reported, normally refused):**

- Exposing Warehouse to any protected financial value, or relying on hidden UI to hide it.
- Certification, compliance, guarantee, uptime or zero-error claims.
- Calling the office address a home or residence; inventing customers, metrics or testimonials.
- Putting the prototype credentials into production docs, public UI or a production bundle.
- Adding `/app` to the sitemap or shipping internal workspaces in the public bundle.
- Connecting the public Demo to production data.
- Positioning Accounting as GL / tax / full accounting software, or CORE as a generic ERP or
  multi-company product.
- Deploying, changing DNS / Cloudflare or requesting indexing outside the production phase.

### Post-freeze policy and guidance for coding agents

The public frontend v1 is frozen. Before changing anything under `frontend/` that the public site
renders:

1. Read this manifest and classify the change as Category A, B or C.
2. Category B: stop and get the owner's approval first; Category C: do not do it — report it.
3. Derive facts from source (`publicRoutes.ts`, `navigation.ts`, `plans.ts`, `contact.ts`), never
   from memory, and keep the source and this manifest in step.
4. Keep the guards green: `src/test/freeze.test.ts`, pricing, contact, claims, Warehouse privacy,
   release, discoverability and prerender tests, and the performance budget. Do not weaken a
   guard to make a change pass.
5. Report every public-output change in the episode report, and record it in the
   [release checklist](PUBLIC_FRONTEND_RELEASE_CHECKLIST.md) review.

## 21. Production deferrals

Not done in v1 and not part of the freeze; each belongs to a later phase:

- Real authentication, sessions and user accounts (EP23); database (EP24); server-side RBAC and
  information boundaries, including Warehouse financial redaction (EP25).
- Inquiry delivery (`POST /api/inquiries`) — the contact flow stays "prepared, not submitted"
  until then.
- Production deployment, Cloudflare compression and cache headers, HTTP/2–3, real `_redirects`
  and 404 behaviour, PM2 / server setup, production credentials.
- Production SEO launch: Search Console, sitemap submission, indexing.
- Safari, real devices, real screen readers and field Core Web Vitals (full-system QA).

The historical EP18 and EP20 reports name this production check "EP22.1"; that label is superseded
by the roadmap below — production delivery is verified in the production-deployment phase.

## 22. Backend handoff reference

See [FRONTEND_BACKEND_HANDOFF.md](FRONTEND_BACKEND_HANDOFF.md): current prototype and static parts,
the auth / database / RBAC handoffs, Warehouse and Executive / Admin boundaries, contact and demo
boundaries, routing, SEO, performance and claim constraints, and the EP23 starting point.

## 23. Current roadmap state

| Phase | Status |
| --- | --- |
| EP20 Performance | done, pushed |
| EP21 Release-candidate audit | done, pushed |
| **EP22 Public Frontend Freeze** | this episode (local commit; push after owner approval) |
| EP23 Real Authentication | next — not started |
| EP24 Database / Prisma | planned |
| EP25 RBAC / Information boundaries | planned |
| EP26 Organization / Users / Departments | planned |
| EP27 Audit / Notifications / Activity | planned |
| EP28 Master Data | planned |
| EP29 Sales · EP30 Warehouse · EP31 Purchasing · EP32 Operations · EP33 Accounting Operations · EP34 Executive | planned |
| EP35 Workflow · EP36 Approval · EP37 Exception · EP38 Human Error Engine · EP39 Notification Engine | planned |
| EP40 Reports / Custom Reports · EP41 API / Integration | planned |
| Full-system final QA / security / stress / release readiness | planned |
| Production deployment | planned |
| Production SEO launch / Search Console / indexing | planned |
