# Public Frontend Release Checklist

The reusable checklist for every public-frontend release review (first used for the EP21 release
candidate — see [EP21_RELEASE_AUDIT.md](EP21_RELEASE_AUDIT.md)). Run it against a production
build (`npm run build`), served the way a static host serves it, not only the Vite dev server.
Record each item as **pass / fail (finding ID) / not applicable**.

Severity for findings: **P0** release blocker · **P1** serious · **P2** fix before freeze ·
**P3** low priority / acceptable polish. A release may not ship with an open P0; an open P1 needs a
written justification.

> Passing this checklist means the **public frontend** is releasable. It says nothing about the
> backend, real authentication, data security or production hosting, which have their own reviews.

## 1. Routes

- [ ] The route set is derived from `src/config/publicRoutes.ts` (not from memory); count recorded.
- [ ] Every route resolves in TH (unprefixed), EN (`/en`) and ZH (`/zh`): HTTP 200, one H1, one `main`.
- [ ] `/login` resolves; `/app/*` without a prototype session redirects to `/login?next=…`.
- [ ] Unknown, doubled-locale (`/en/en/…`) and malformed-locale (`/fr/…`) paths return a real 404
      with the localized 404 page (`noindex`, useful links, no technical detail).
- [ ] Aliases `/th/*`, `/zh-CN/*`, `/zh-hans/*` redirect (301) to the canonical prefix; no loops.
- [ ] Link crawl of every page (including every open mega-menu panel): no broken internal link, no
      empty `href`, no doubled locale, no `localhost`, locale preserved, every `#anchor` exists.
- [ ] Orphan check: every intended route has an inbound link from a real UI path
      (`src/test/discoverability.test.tsx` + crawl).

## 2. Navigation

- [ ] Header: five items, current-section state per route family, language, Contact, Login.
- [ ] Mega menus: mouse, keyboard (←/→, ↓, Enter, Escape; Tab enters an open panel), outside click.
- [ ] Mobile menu (320–430 px, and 390×667): open/close, groups, body-scroll lock, Escape, focus
      trap and return, Contact / Login / language reachable.
- [ ] Footer: links, locale preservation, approved contact data, legal row, no overlap with the
      floating dock.
- [ ] Language switch keeps path, query and hash (TH → EN → ZH → TH), and browser Back works.

## 3. Content

- [ ] No placeholder, lorem, TODO, internal episode names or roadmap text in public copy.
- [ ] Contact data only from `src/config/contact.ts`: คุณวิน · 063-869-3614 ·
      pdablissoffice@gmail.com · LINE @593oiwec (`https://line.me/R/ti/p/@593oiwec`) · office
      address 186/42 หมู่ 6 ต.ทวีวัฒนา อ.ไทรน้อย จ.นนทบุรี 11110 — never called a home/house/residence.
- [ ] Company/product names: PDA BLISS CORE (product), PDA BLISS COMPANY LIMITED / บริษัท พีดีเอ บลิส
      จำกัด (company).
- [ ] CTA wording: one label per action and locale (generic contact, demo request, open demo).

## 4. Localization

- [ ] No Thai in EN/ZH except the approved exceptions (inert, captioned Thai product previews; the
      office address).
- [ ] Simplified Chinese only (`TRADITIONAL` pattern in `src/test/claims.ts`).
- [ ] `<html lang>` follows the locale; Thai / Latin / CJK glyphs render (no missing-glyph boxes).

## 5. SEO (initial HTML, before JavaScript)

- [ ] `npm run test:prerender`: 105 indexable files + 3 shells, route-specific title, description,
      canonical, hreflang (th/en/zh-CN/x-default), OG, `lang`, JSON-LD where expected.
- [ ] `sitemap.xml`: valid XML, every route × locale once, alternates, no `/app` or `/login`.
- [ ] `robots.txt`: site allowed, `/app/` disallowed, sitemap referenced.

## 6. Accessibility (engineering baseline, not certification)

- [ ] axe (WCAG 2.0/2.1/2.2 A–AA tags) on representative routes × 3 locales × 390/1440, including
      open mega menu and mobile menu: no new violations (known false positive: decorative,
      `aria-hidden` About ghost numbers).
- [ ] Keyboard-only journey: skip link first → header → mega menu → Pricing tabs → Contact →
      Resource search → Login → cookie banner and Cookie Settings (focus returns to the opener).
- [ ] Landmarks, one H1, heading order, names/labels, tables, disclosures, touch targets.
- [ ] Reduced motion: no infinite animation or SMIL left running; CORE World on its `reduced` tier.
- [ ] Forced colors: pages render, controls visible.

## 7. Responsive

- [ ] Representative routes at 320, 360, 375, 390, 412, 430, 480, 640, 768, 820, 1024, 1180, 1280,
      1366, 1440, 1536, 1600, 1920: no horizontal overflow, no clipped controls, one H1.
- [ ] Short heights 390×667, 1366×768, 1440×800 and landscape 844×390: menus, cookie banner,
      Contact, Demo and Login controls reachable.
- [ ] Screenshots of the key pages at 390 and 1440 reviewed (kept outside Git).

## 8. Performance (see [PERFORMANCE.md](PERFORMANCE.md))

- [ ] `npm run perf` within budget; no heavy code in the entry; guides isolated.
- [ ] CLS ≈ 0 on lazy routes; no blank state on in-app navigation.
- [ ] CORE World: 0 frames offscreen / hidden / reduced motion; one canvas per visit.
- [ ] Repeated Homepage ↔ heavy-page navigation retains no DOM nodes or listeners (CDP DOM counters
      after forced GC; click inside the page — a held Playwright `ElementHandle` retains old DOM).
- [ ] Numbers are reported as local synthetic measurements, never as user field data.

## 9. Claims

- [ ] Shared claim scanner (`CLAIMS`) passes on copy, metadata and structured data: no
      certification, compliance, guarantee, uptime, immutability, RPO/RTO or 100 % claims.
- [ ] Human Error: CORE helps PREVENT / DETECT / ALERT / CONTROL / TRACE — never "zero errors".
- [ ] Server-side enforcement is described as **design** (or "today / planned" on Security), never
      as live behaviour, until the backend enforces it (`src/test/release.test.ts`).
- [ ] No fake customers, metrics, testimonials, awards, authors, dates or certifications.

## 10. Privacy

- [ ] Warehouse never shows price, unit cost, total cost, margin, payment amount or supplier
      financial terms — public page, Demo Warehouse view (every state), guides, menus, metadata.
- [ ] Cookie UI: first display, Accept / Reject / Settings, stored only in this browser, no network.

## 11. Pricing

- [ ] Starter ฿399/mo · Business ฿699/mo (recommended) · Professional ฿999/mo · Enterprise quote;
      no free plan; demo available.
- [ ] Year 1 = 12 × monthly; Year 2 = pay 10 / use 12; Year 3+ = 15 % off; price per company, all
      branches included.
- [ ] Storage 3 / 10 / 30 GB / custom; departments 2 (no Executive) / 4 / all 6 / custom; API
      no / add-on / included / custom; Lot / Expiry / FEFO core with Warehouse.

## 12. Demo

- [ ] SO-1042; ordered 120, on hand 20, short 100; partial receipt 80 / 100, 20 outstanding.
- [ ] Every role, handoff, PREVENT / DETECT, FEFO, Accounting gate, Executive exception, trace and
      completion reachable; nothing persisted; `npm test` demo suite green.

## 13. Contact

- [ ] All seven paths (demo, general, consulting, implementation, integration, plans, enterprise)
      reach the prepared state; query prefill (`interest`, `plan`, `industry`, `department`).
- [ ] Final state says the message is ready **but not sent**; hand-offs email / LINE / copy / phone;
      no network request.

## 14. Login

- [ ] Production build: honest "sign-in opens when ready" state; no demo password in the bundle.
- [ ] Prototype build (`VITE_ENABLE_PROTOTYPE=true`): `user1 / pass1` signs in; wrong password is
      announced and recoverable; labels, autocomplete, show/hide, Caps Lock, Enter.

## 15. Legal

- [ ] `/privacy`, `/terms` resolve in all locales, read as real pages, invent no obligations.

## 16. Console and network

- [ ] Fresh load of every route family: no errors, React warnings, failed assets, chunk or WebGL
      errors (production build and dev server).
- [ ] No asset 404s; no wrong-locale chunk; no unused preload warnings.

## 17. Tests and build

- [ ] `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm test`, `npm run build`,
      `npm run perf` (frontend); `npm ci`, typecheck, lint, format, test, build (backend).
- [ ] If a running dev server blocks in-place `npm ci`, verify in a clean copy and say so; never
      stop an unknown process without permission.
- [ ] Source scan: no debug output, secrets or temporary code; public env values intentional.
- [ ] Changed files UTF-8 without BOM; no replacement characters; Thai and Chinese intact.

## 18. Git

- [ ] `git status`, `git diff --stat`, `git diff --check` reviewed; no screenshots, traces or QA
      scripts committed; no backend or pricing change unless intended.
- [ ] Local commit with the agreed message; push only after owner approval.
