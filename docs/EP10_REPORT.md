# EP10 — For Organizations / Enterprise Experience

**Date:** 2026-10-23 · **Owner:** PDA BLISS COMPANY LIMITED
**Baseline:** `3625fbeb693d46cb6e3466288013dd06e506c643` (EP09 revision round 2), already on
`origin/main` (`git push` reported "Everything up-to-date"); local `main` == `origin/main`,
clean tree.
**Commit:** `feat: create enterprise organization experience (EP10)` (local only, **not pushed**)

## Scope

Public frontend only: a new `/enterprise` page (th / en / zh) plus the links that lead to it.
Not touched: backend, security, SSO, SCIM, RBAC, audit service, integrations, database, Prisma,
SLA infrastructure, deployment, monitoring, workflow engine, contracts, billing, `/login`,
`/app/*`, `workspaces/`, `prototype/`, `components/core`, `components/shell`.

Design reference: [ENTERPRISE_EXPERIENCE.md](ENTERPRISE_EXPERIENCE.md).

## What was built

- **Enterprise model** (`features/enterprise/model.ts`): four claim statuses; thirteen
  chapter ids; growth stages and multipliers; responsibility levels; six access roles over one
  shared work object (`ROLE_VISIBILITY`, `MONEY_FIELDS`); approval rails; controls and readiness
  layers with statuses; audit events; drill levels and signals; `buildProcess()`; system
  types; implementation phases and ten-step journey; quote flow; cross-links. Package facts
  (API, reports, support) come from `features/pricing/plans.ts`.
- **Page**: hero with the layered organization and a status key, then thirteen chapters, each
  with its own composition (staircase, orbit, masked object + Executive ≠ Admin split, rail
  board, timeline + record, terraces, adaptive process, perimeter, company tree, roadmap,
  ladder, readiness stack, consultation path).
- **Shared layout**: `Chapter`, `Frame`, `Stage`, `Kicker`, `ChapterTitle`, `Plane` moved from
  `features/solutions/parts.tsx` to `components/editorial/Layout.tsx` (re-exported from
  `parts.tsx`; `/solutions` renders unchanged) so `/enterprise` doesn't load the Solutions
  copy.
- **Links**: the สำหรับองค์กร mega menu → `/enterprise` and its anchors (no informational
  "planned" items left); footer สำหรับองค์กร → `/enterprise`; homepage Enterprise chapter →
  `/enterprise`.
- **Tests**: `enterprise.test.tsx` (39 tests); `header.test.tsx` updated.

## Verification

### Gates (clean copy, `npm ci`)

| Package | npm ci | typecheck | lint | format:check | test | build |
| ------- | ------ | --------- | ---- | ------------ | ---- | ----- |
| frontend | ✓ | ✓ | ✓ | ✓ | ✓ 404 / 404 (18 files) | ✓ |
| backend | ✓ | ✓ | ✓ | ✓ | ✓ 21 / 21 (4 files) | ✓ |

`enterprise.test.tsx` covers:
- **Model**: thirteen chapters and mega anchors; the Warehouse never gets money fields;
  configuration belongs to the Admin only (Executive ≠ Admin); approval rails without money
  thresholds; every control and readiness layer has a known status (escalation planned);
  deterministic `buildProcess()`; a ten-step journey in phase order; cross-links point at
  existing Solutions anchors, How CORE works chapters and departments.
- **Copy**: the forbidden-term scan (ISO, SOC 2, PCI, HIPAA, GDPR, certified, guarantee,
  uptime, 99.x, ได้รับการรับรอง, 已认证, 保证 …) across all three locales; readiness ≠
  certification in every locale; audit claim wording; integration scope wording; no response
  times, SLA "where agreed"; a money-free Warehouse focus; branch and one-company wording.
- **Page**: one H1 and the thirteen chapters in order; hero layers and status key; the growth
  staircase (multipliers, keyboard); one company; Warehouse masking (money values absent,
  quantity, lot, location and expiry present; Accounting sees price); Executive vs Admin (End
  key → Admin sees only configuration; split comparison); approval rails and control statuses;
  audit record fields; executive drill to source and reporting tiers from `PLANS`; workflow
  adjustments (`aria-pressed`, order swap, not-unlimited note); API tiers equal to `PLANS`;
  branches; the journey; the support ladder equal to `PLANS` with no response times;
  readiness layers with status words and the banner; quotation CTAs and cross-links; no
  forbidden claims in the rendered text; reduced motion.
- **Localization**: English and Chinese render no Thai and no Traditional characters; unique
  metadata per locale; locale-preserving links; the English mega menu; homepage and footer
  links.

`header.test.tsx`: `/enterprise` was added to the public routes, and the "planned items are
information" test was replaced by "every enterprise capability links to its chapter". The
cross-page hash test now uses Enterprise → Audit & Control → `/enterprise#audit`.

### Live QA (headless Chrome, emulated viewports)

- `/enterprise` in th, en and zh at 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768,
  1280×720, 1440×900 and 1920×1080, after interacting with the growth stages, roles, rails,
  audit, drill-down and every workflow adjustment. 27 runs: one H1, no horizontal overflow,
  no element outside the viewport, no target under 44 px, no console errors.
- **Regression**: 17 public routes × th, en and zh at 390 and 1440 (102 checks), including
  `/solutions`, `/how-core-works`, `/pricing`, the six department pages and `/enterprise`:
  one H1, no overflow, no console errors.
- **Mega menu (live)**: Enterprise → Audit & Control from `/about` opens `/enterprise#audit`
  with the chapter in view. Switching to Chinese keeps it (`/zh/enterprise#audit`).
- **Reduced motion (live)**: every hero floor is at full opacity on the first frame (with
  motion, they rise from 0).
- **Visual review** at 1440, 390 and 320 (th), 390 (zh) and 1440 (en): hero and all thirteen
  chapters.

### Bundle (vs. `3625fbe`, both built from source)

| | Baseline | EP10 |
| - | - | - |
| Entry `index.js` | 739.1 KB (217.1 KB gz) | 739.9 KB (217.3 KB gz) |
| `EnterprisePage` chunk | — | 109.7 KB (28.6 KB gz) |
| `SolutionsPage` chunk | 127.8 KB (33.2 KB gz) | 125.2 KB (32.5 KB gz) |
| Shared `Layout` + `Segmented` chunks | — | 2.9 + 1.6 KB (1.3 + 0.9 KB gz) |
| CSS | 215.4 KB (36.3 KB gz) | 229.2 KB (37.9 KB gz) |

No new dependencies, images, fonts or WebGL.

### Text and scans

All changed and new files are valid UTF-8, with no BOM, no U+FFFD, no mojibake, and LF line
endings. The Chinese copy contains no Traditional characters.

## Fixed during QA

- **Thai H1 broke inside a word on phones.** Lines now wrap only at marked phrase boundaries.
  The desktop column and size were rebalanced.
- **Access fields formed one long column on phones.** They now use two columns.
- **Workflow chain on phones.** Arrows now sit under each step. The legend sits at the bottom
  of the stage.
- **Relationship list wrapped with a leading arrow.** It is now a numbered grid. The support
  ladder widens as it climbs on phones.
- **The Chinese "审批" read-next link was 31 px wide.** All links now have a 44 px minimum
  width.
- **Copy that named certifications, even in negation** (for example "certified partnerships",
  "guaranteed response times"). Reworded, so the forbidden-term scan stays strict.
- **React Compiler lint.** Keyboard handlers wrap `tabKeys` instead of passing refs during
  render.

## Known limitations

- Illustration only: roles, approvals, audit events, drill-down and integrations are sample
  data; nothing is computed or enforced.
- Statuses reflect the brief; they need owner confirmation as the product evolves.
- `public/sitemap.xml` still lists only the original pages (no `/how-core-works` or
  `/enterprise`). It was left unchanged, as in earlier episodes.
- QA used headless Chrome with emulated viewports. There was no testing on real devices,
  Safari, Firefox or screen readers.
