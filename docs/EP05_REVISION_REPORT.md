# EP05 Revision — Full-Site Localization, Header Visuals, Contact Simplification & CORE World Imagery

**Date:** 2026-10-23 · **Owner:** PDA BLISS COMPANY LIMITED
**Type:** revision pass on EP05 after owner visual review. This is **not** a new episode.
**Baseline:** local EP05 commit `52c077cce072edb6a576a52efc4c3fd95c264fab` (not pushed)
**Commit:** `feat: refine public shell and enrich CORE world experience (EP05 revision)` —
local only, **not pushed**

## Scope

Four areas requested by the owner, all public frontend:

1. Language switching changes the **whole** public site, not only the shell.
2. Public contact shows **one** phone number.
3. Header / mega menus gain visual richness.
4. The CORE World represents departments with **imagery**, not only nodes and labels.

Not touched: `/login`, `/app/*`, internal workspaces, prototype auth, `components/core`,
`components/shell`, `workspaces/`, `prototype/`, the backend, Prisma, RBAC, persistence (empty
diff against the baseline for all of them).

## 1. Full-site language switching

Every public page now changes language with the selector — page bodies included.

- **Pattern.** Copy lives next to its component as `Localized<T>` (`{ th, en, 'zh-CN' }`), typed
  from the Thai object, read with `useCopy()` (`src/i18n/useCopy.ts`). English or Chinese that
  is missing or mis-shaped fails `tsc`.
- **Shared content** moved to locale-aware hooks with stable references per locale:
  `useDepartments()` / `useDepartment()`, `useWorlds()`, `useFlows()`, `usePlans()`,
  `useSafeguards()`.
- **Localized:** homepage hero and all eleven chapters (headings, statements, diagrams' SVG
  labels, scenarios, flows, CTAs, aria labels, chapter indicator), CORE World cards and detail,
  `/departments`, `/features`, `/solutions`, `/pricing` (plans, comparison table, disclaimers),
  `/about`, `/contact` (labels, options and **form validation messages**), `/privacy`, `/terms`,
  404, page titles and meta descriptions. In-page links go through `href()` so visitors stay in
  their language (`/en/contact`, `/zh/departments#warehouse`, …).
- **Deliberate exceptions.** The company address is printed in Thai in every locale
  (`lang="th"`). The homepage product previews render the real EP02 product UI (Thai); their
  English/Chinese captions say *the product interface is in Thai*. `/login` and `/app/*` remain
  Thai and outside the public site.
- `<main lang="th">` (first EP05 pass) was removed — page bodies now match `<html lang>`. The
  language menu note now says the whole site is available in three languages.
- **Translations** were written by hand for this product: concise, professional English;
  Simplified Chinese only (a test forbids common Traditional forms).

## 2. Single public phone

`CONTACT.phone` replaces the three-number list. Footer, contact page, floating contact panel and
the shared `ContactDetails` all show the same single entry: **063-869-3614 (คุณวิน)**,
`tel:+66638693614`. Address, email and **LINE OA · @593oiwec** (`https://line.me/R/ti/p/@593oiwec`,
central) are unchanged. Tests assert exactly one phone link, the exact `tel:` value, that the
floating panel matches the footer, and that 064-924-5544, 090-662-5464, Office, คุณผึ้ง and
คุณอิน appear nowhere in the footer or source.

> **Confirmed by the owner (2026-10-23):** 063-869-3614 is คุณวิน's number. It is one value in
> `src/config/contact.ts` (`CONTACT.phone`); the label is `contact.phoneLabel` in the three
> dictionaries.

## 3. Header and mega-menu visuals

Menus keep the editorial structure and gain restrained visual support (`MegaVisuals.tsx`):

| Menu | Visual |
| --- | --- |
| แผนก | Scene thumbnails on every department item + a 3 × 2 mosaic of the six worlds |
| แพ็คเกจ | Tier indicators (1–4) on the items + four rising layers; no pricing emphasis |
| วิธีการทำงาน | Five stations routed through CORE with a slow pulse (stops under reduced motion) |
| โซลูชัน | Scattered problem fragments → ordered, checked steps |
| สำหรับองค์กร | Isometric architecture stack with external integration points |
| เกี่ยวกับเรา | Editorial skyline scene behind the company statement |

The mobile menu uses the same item marks. Header overlays now use fully opaque surfaces
(a `/0.99` background let page text ghost through in Chromium). Panel heights at 1280×720:
442–517 px.

## 4. CORE World redesign

Hybrid of the brief's options A + C:

- **At a glance:** each orbiting department is an image “world card” anchored on its node —
  its scene, icon, localized name and (Thai/Chinese) English small caps — centred on the node and
  depth-scaled so the orbit keeps its 3D feel. The CORE sphere stays central and dominant;
  connection lines now run to the cards.
- **On hover / focus / selection:** the card lifts (scale, emerald edge, brighter image), the
  others desaturate, and the detail card shows the **large scene** beside the purpose, key work
  and a localized link (horizontal from 1024 px, stacked on phones).
- **Desktop composition:** the stage reserves its own row for the department selector, so no
  card overlaps the controls (lowest card ends 27 px above the selector at 1280×720).
- **Phones (< 640 px):** cards would crowd the scene, so the six selector buttons directly under
  the CORE carry the scene thumbnails instead; the detail shows the large scene.
- **Accessibility:** cards are decorative (`aria-hidden`); the selector buttons remain the real
  controls (`aria-pressed`, `aria-controls`); all labels are text, never image-only.

## Department imagery

No photographic image generator is available in this environment, so the imagery was
**generated in code**: `frontend/scripts/build-department-scenes.mjs` draws seven cinematic
one-point-perspective scenes (shared camera, room, lighting and palette) and renders them with
sharp to `public/departments/<id>.webp` (960×540) and `<id>-sm.webp` (400×225). Seven scenes ×
two sizes = 14 files, 84 KB in total. `npm run assets` regenerates them.

| Department | Scene |
| --- | --- |
| ฝ่ายขาย / Sales | Order-pipeline wall (NEW → DELIVERED cards), delivery route panel, sales desk with order screens, a team at the wall |
| ปฏิบัติการ / Operations | Planning wall (work-order Gantt with a TODAY line, one late task), progress rings, team at a standing table |
| คลังสินค้า / Warehouse | Racked aisle to a lit receiving dock, lot labels on boxes, floor guidance lanes, a worker scanning, a LOT / EXP / QTY / FEFO tag — **no price or cost** |
| จัดซื้อ / Purchasing | Supplier network around a PO hub (one late supplier), approval chain PR → APPROVE → PO → RECEIVE, procurement desk with PO and ETA |
| บัญชีและการเงิน / Accounting | Calm review desk with documents and an approval mark, payment-request list, verification ledger with a shield |
| รายงาน / Reports | Panoramic insight wall (trends, department bars, overview donut + KPIs), an observer |
| ผู้บริหาร / Executive | Glass office over a night skyline, command view of six department tiles (one flagged), executive desk |

Style rules: dark obsidian / navy rooms, emerald / teal / cyan light (amber only as a tiny
status accent), luminous screens carrying each department's work, backlit anonymous
silhouettes (no faces), glowing floor lanes toward the main display, vignette and soft
volumetric light. They are stylized, cinematic illustrations, **not photographs**. Any 16:9
artwork with the same file names can replace them without code changes.

## Verification

### Gates (clean copy, `npm ci`)

| | npm ci | typecheck | lint | format | test | build |
| - | - | - | - | - | - | - |
| Frontend | ✅ | ✅ | ✅ | ✅ | ✅ 197 / 197 (13 files), 5 consecutive green runs | ✅ |
| Backend | ✅ | ✅ | ✅ | ✅ | ✅ 21 / 21 (4 files) | ✅ |

New tests: `src/i18n/site-language.test.tsx` (every public page under `/en` and `/zh` has no
visible Thai; localized homepage hero/chapters/CTAs; Thai default; header switch changes the
page body; localized form validation) and `src/features/landing/core-world/core-world.test.tsx`
(six image cards with decorative images, localized labels, selection reveals the scene and
localized detail, no price wording in the warehouse world). Updated: single-phone footer and
panel assertions, central contact config, homepage dock rule, `<main>` language, worlds tabs.
All earlier tests (routes, login, prototype gating, warehouse privacy, header, cookie, i18n)
remain and pass.

### Live QA — headless Chrome (GPU, WebGL), emulated viewports

The in-app browser pane was hidden during this pass (it pauses animation frames), so live QA ran
in headless Chrome over the DevTools protocol against the running dev server.

| Viewport | th / en / zh overflow | Header fits | Notes |
| --- | --- | --- | --- |
| 320×568 | 0 / 0 / 0 | ✅ | selector scene tiles, detail with scene, no overflow |
| 375×667 · 390×844 · 430×932 | 0 | ✅ | cookie banner ↔ dock: no collision |
| 768×1024 · 1024×768 | 0 | ✅ | |
| 1280×720 | 0 | ✅ nav 743 / 795 / 666 px | six world cards clear of the selector; mega panels ≤ 517 px |
| 1366×768 · 1440×900 | 0 | ✅ | detail card fits beside the hero |
| 1920×1080 | 0 | ✅ | |

Also checked: WebGL world at 61 fps headless; selection highlight and dimming; reduced motion
(`reduced` quality, all six cards rendered); English and Chinese homepage, departments page and
footer screenshots; single phone + LINE OA in the Chinese footer; zero console warnings or errors
on `/en` and `/zh` pages.

### Bundle

| | EP05 | EP05 revision | Δ |
| --- | --- | --- | --- |
| Critical path (entry + preloads, gzip) | 271.4 KB | 293.5 KB | **+22.1 KB** |
| `CoreWorld` (lazy, gzip) | 236.1 KB | 236.1 KB | 0 |
| Shell dictionaries `en` / `zh-CN` (lazy) | 3.4 / 3.9 KB | 3.4 / 3.9 KB | 0 |
| Department scenes (14 WebP) | — | 84 KB total | homepage loads six 2–4.5 KB thumbnails; a 7–13 KB scene on selection |

The increase is mostly the English and Chinese homepage copy, which now ships with the
homepage, plus the visual components. No dependencies were added.

### Text and scans

74 changed/new text files: valid UTF-8, no BOM, no CR, no U+FFFD, no mojibake, no orphan Thai
marks; no Traditional Chinese in `zh-CN` copy. Old numbers (064-924-5544, 090-662-5464) and
labels (Office, คุณผึ้ง, คุณอิน) appear nowhere in `frontend/src`; contact literals exist only in
`src/config/contact.ts`; no outdated address anywhere.

## Fixed during QA

- Purchasing world card overlapped the selector at 1280×720 → the stage reserves a selector row.
- Detail card with the scene ran below the fold on desktop → compact horizontal layout.
- Dimmed cards were dimmed twice and nearly vanished → single, scene-level dimming.
- Floating dock covered the phone selector tiles → hidden while the CORE World section fills the screen.
- Page text ghosted through mega panels → fully opaque overlay surfaces.
- `<main lang="th">` contradicted localized bodies → removed; flaky `lang` assertions now wait.
- Office scenes read as dark boxes at card size → downlights, LED slits, accent wash, brighter screens.

## Known limitations

- Department imagery is **illustrated in code**, not photographic; swap in photographs by
  replacing the files if preferred.
- Homepage product previews show the Thai product UI in every locale (captioned).
- Critical path +22.1 KB gzip; moving the homepage EN/ZH copy into the lazy locale chunks would
  recover most of it.
- No `hreflang` alternates or localized Open Graph images yet.
- Not tested on physical iOS / Android devices.
