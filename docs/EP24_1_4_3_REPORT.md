# EP24.1.4.3 — Contact & Consultation Split

Status: **completed locally, awaiting owner review. NOT PUSHED.** Owner-approved public patch on
top of EP24.1.4.2 (`cb3be76`). EP26 has not been started.

## 1. Why split

After EP24.1.4.2, `/contact` did two jobs at once: the six-step guided consultation and the
company's contact details, address and map. A visitor who only wanted the phone number or
directions met a form first; a visitor who wanted to talk through their organization shared the
page with a map. Each route now answers one question.

## 2. Route responsibilities

| Route | Question it answers | Contains | Does not contain |
| --- | --- | --- | --- |
| `/contact` | How do I reach PDA BLISS, and where are you? | Intro (*คุยกับ PDA BLISS*), phone / LINE / email **once**, company name + canonical address, a large live Google map (auto-loading, keyless embed), one **เปิดเส้นทางใน Google Maps** action, the *ยังไม่แน่ใจว่าควรเริ่มจากตรงไหน?* invitation → **เริ่มปรึกษาเรา** → `/consultation` | Wizard, form fields |
| `/consultation` | Help me work out what my organization needs. | Back to Contact, hero *เล่าให้เราฟังว่าองค์กรของคุณทำงานอย่างไร*, context banner, the six steps (เรื่องที่อยากคุย · องค์กรของคุณ · สิ่งที่กำลังเจอ · ช่องทางติดต่อกลับ · ข้อมูลติดต่อ · ตรวจทาน), live summary, compact phone / LINE / email fallback | Map, address, any Google request |

- **Topic preselection:** `/consultation?topic=<id>` selects a known topic and stays on step 1;
  an unknown value fails safe (nothing selected, step 1). Nothing is ever submitted
  automatically, and nothing the visitor types enters the URL.
- **Step bar:** the wizard is a size container. When it is at least `@2xl` wide all six labels
  are shown, wrapping instead of clipping; narrower, the bar shows segments plus the current step's
  name. Verified at every width in Chrome and Edge.
- **Legacy links:** `/contact?interest=…&plan=…&industry=…&department=…` redirects (replace) to
  `/consultation?topic=…` with the same context, so bookmarks and external links still land on
  the right step.
- **Delivery** is unchanged and honest: the review step prepares the message and hands it to
  email / LINE / phone; the site sends nothing itself (`features/contact/delivery.ts`).

## 3. CTA routing

Enquiry-specific CTAs now go to `/consultation` (with `?topic=` where the topic is known);
general "contact us" links stay on `/contact`.

| To `/consultation` | To `/contact` (unchanged) |
| --- | --- |
| Pricing hero, package explorer, configurator, closing sections | Header *ติดต่อเรา* (primary nav) |
| `/enterprise` hero + partnership · industries · departments | Mobile menu *ติดต่อเรา* |
| `/about` and `/why-core` consult / demo · `/security` | Footer |
| Resources registry CTAs · `/demo` scenario | Homepage trust links *ติดต่อเรา* · About contact link |
| `/how-core-works` hero and chapters *ขอ Demo* | Sign-in help *ติดต่อทีม* · 404 page |
| `/solutions` closing *ขอ Demo* | |
| Homepage closing *ขอคำปรึกษา* | |
| Floating contact panel *ขอรับคำปรึกษา* | |
| Company onboarding (EP25) *talk to us* link | |

There is **no** Consultation item in the navigation. Navigation structure is unchanged.

## 4. SEO decision

`/consultation` is a **public, indexable route** in all three locales (`/consultation`,
`/en/consultation`, `/zh/consultation`). Reasoning: it is the destination of most enquiry CTAs and
the natural landing page for "consultation / demo" intent; a `noindex` destination would make the
site's main conversion page invisible. It has its own title and description (the consultation
copy), canonical, hreflang (th / en / zh-CN / x-default) and OG tags, and is prerendered.
`/contact` keeps its own meta (contact copy) and the Organization JSON-LD; `/consultation` does
not repeat the schema.

- `config/publicRoutes.ts`: 36 families (was 35) → 108 indexable URLs (was 105).
- `public/sitemap.xml`: three new `<url>` blocks with full hreflang alternates (108 URLs).
- `docs/PUBLIC_FRONTEND_V1_FREEZE.md`: amendment note under the route baseline.

## 5. Bundle impact

| | After | Budget |
| --- | --- | --- |
| `/contact` route chunk, gzip | **4.4 kB** (was 14.5 kB with the wizard) | — |
| `/consultation` route chunk, gzip | 14.0 kB (lazy, own chunk) | — |
| Initial JS, gzip | 184.8 kB | 205 kB |
| All JS, raw | 4,114.8 kB | **4,300 kB (cap not raised)** |
| Static HTML, raw | 543 kB | 560 kB (raised, see §6) |
| Static HTML files | 111 (was 108) | exactly 111 |

The map and wizard never load together: `/contact` does not import the flow, and
`/consultation` does not import the location or make any Google request.

## 6. HTML budget raise — owner review requested

The static-HTML cap was raised **540 → 560 KiB raw** and the file count **108 → 111**: three
prerendered `/consultation` pages (≈ 4.4 KiB of head each) take the total to 543 KiB. Per-page
weight is unchanged. Recorded in `scripts/perf-budget.mjs` and `docs/PERFORMANCE.md`. The
4,300 KiB all-JS cap is untouched.

## 7. Cookie banner and keyboard focus

Browser QA found that, with the cookie banner open on a phone or tablet, tabbing to the
*เริ่มปรึกษาเรา* button scrolled it to just above the bottom edge — underneath the fixed banner
(WCAG 2.4.11 Focus Not Obscured). Fix (`features/consent/CookieConsent.tsx`): while the banner is
open it reserves its own height as the page's `scroll-padding-bottom`, measured from layout (not
the entrance transform), and releases it when dismissed. This applies site-wide; the banner's
look, copy and choices are unchanged. Covered by a unit test and the browser QA.

## 8. Verification

- **Gates:** typecheck ✓ · ESLint ✓ · Prettier ✓ · build + prerender (108 + 3) ✓ ·
  verify-prerender ✓ · perf budget ✓.
- **Tests:** 971 total; every file passes on its own. Under full-suite parallel load one or two
  tests time out at 5 s in different files per run (EP25 company-center, auth) — the same
  pre-existing load flake seen before this episode; those files pass 14/14 and 33/33 alone.
- **Browser QA — Chrome and Edge, 230/230 checks each:** `/contact` and `/consultation` in TH / EN
  / ZH at 320, 375, 390, 430, 768, 1024, 1440 and 1920 px — no horizontal overflow, one h1,
  targets ≥ 24 px; contact: no wizard / form fields, phone / LINE / email once, one map (340–380 /
  400–440 / 470–610 px by breakpoint) inside its block, one directions link, invite → locale
  `/consultation`, map loads with the page, focus rings; consultation: step labels unclipped or
  segments + step name, known topic preselected, unknown topic fails safe, no Google request, no
  map / address, back to Contact, validation marks fields and moves focus, walk to review and
  the honest hand-off, typed details never in the URL; EN / ZH free of Thai beyond the address;
  axe (WCAG 2.2 AA + best practice) clean at 390 / 768 / 1440; cookie banner shown on a first
  visit with key actions reachable by keyboard focus, and after dismissal (scroll reserve
  released); legacy redirect; retargeted CTAs (homepage, solutions, how-core-works, floating
  panel) and header *ติดต่อเรา* unchanged; no map or Google Maps request on `/`, `/about`,
  `/pricing`, `/en/features`, `/solutions`, `/resources`, `/consultation`; no page errors.
- **Firefox:** not run. The two cached Playwright Firefox builds do not launch with the installed
  Playwright version, and installing one was out of scope.

## 9. Known limitations

- The consultation still has no backend endpoint; the review step hands off to email / LINE /
  phone (unchanged since EP13).
- The map is Google's keyless embed: it loads with `/contact` regardless of cookie choice and is
  disclosed in the cookie banner and Privacy Policy (unchanged since EP24.1.4.1).
- Thai address text is shown in Thai in all locales (approved exception).

## 10. Not touched

Homepage, Pricing, About, Partner, Features, Solutions and Resources content and layout (only the
enquiry CTA destinations listed above); header / navigation structure; EP25 Company Control
Center, Branch, Users, Departments, Subscription and Platform. Nothing pushed; EP26 not started.
