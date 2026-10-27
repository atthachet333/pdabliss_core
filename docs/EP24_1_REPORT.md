# EP24.1 — Platform Control Center, Company Explorer & Account Profile

**Date:** 2026-10-27 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline (local, not pushed):** `90fc8e6` EP24 completion · `3c43feb` development-only demo
sign-in · `5e9c498` Firefox QA note — on top of `origin/main` `d4b8105`.

**Completion commit:** `feat: create CORE platform company explorer and account profile experience
(EP24.1)` — local only, **not pushed**. EP25 not started.

Two owner briefs shaped this episode: the platform / account-profile brief, then a second brief
adding the two-step business context at registration, auth polish, the /about S2 chapter and email
polish. Where they differed (company data at sign-up), the later brief was followed **without**
collapsing account and company: the business context is lead information on the account, never the
`Company` record.

## 1. What changed

| Area | Result |
| --- | --- |
| `/platform` | Redesigned as the Platform Control Center: authority line + headline counts (level 1); company lifecycle rail, needs-attention list, newest companies (level 2); customer accounts, owner-only operators, security activity (level 3); session strip and folded devices (level 4). Real counts only — no revenue, MRR, growth or scores |
| Company Explorer | `/platform/companies`: server search (company / legal name, owner email / name), filters (package, subscription, company status, onboarding, department), cursor paging 25 at a time, URL-held state, rows = one keyboard-operable link with identity, package, lifecycle, department track, footprint, dates |
| Platform Inspection | `/platform/companies/:companyId`: persistent "Platform Inspection — not signed in as the company" band, identity + facts strip, onboarding path from the audit trail, subscription & entitlements (snapshot price, "no payment recorded"), six departments (enabled / not enabled / not in package, Warehouse privacy line), branches, members (role, self-described job function, last sign-in), owner sign-up context (labelled self-described), company activity and member security with human labels (codes secondary). Read-only; audited `PLATFORM_COMPANY_INSPECTED` (once per operator · company · 15 min). Only real action: the development activation where the server offers it |
| Registration | Two steps, one request: (1) full name, phone (Thai / international, stored E.164), optional job function, email, password + live rules; (2) company / organization name, business type, team size, preferred contact (email / phone / LINE + ID), interests, optional note, terms. Required markers, field-level errors, focus to the first problem / the step heading, Back keeps values |
| Account profile | `User.displayName` renamed in place to `fullName` (data kept); `phone`, `jobFunction` added; `AccountSignupContext` table. Account Portal shows the profile; the company form starts from the stated company name |
| Auth surfaces | Large screens get a companion panel (four true safeguards + a quiet CORE network mark) beside every account screen; phones keep the single card. Register terms block, trust cues |
| Emails | Kind tag in the CORE band (Security / Email verification / Account / Invitation), titled "Good to know" facts panel, larger heading, sender line `PDA BLISS CORE · PDA BLISS COMPANY LIMITED`. Links, codes, expiry and single-use facts unchanged |
| /about (Category B, owner-approved) | New chapter 07 "Technology × business reality": PDA BLISS (platform design) and S2 ACCOUNTING CONSULTANT (accounting, advisory, business process) meeting at CORE, a bridge statement, "separate companies" boundary line, link to s2aconsultant.com. Later chapters renumbered 08–10 |

## 2. Schema / data

Migrations (additive; applied on a fresh DB and on the EP24 QA DB without drift):

- `20261027120000_ep24_1_account_profile` — `JobFunction` enum, `User.displayName` → `fullName`
  (rename keeps every value), `phone`, `jobFunction`, `Company(createdAt DESC, id DESC)` index.
- `20261027130000_ep24_1_signup_context` — `AccountSignupContext` (+ enums), deleted with the account.

Company profile fields beyond EP24 (English / Thai trading names, website, industry, size band,
logo on the company) were **not** added to `Company`: the sign-up context covers the lead side
today; moving verified values onto the company belongs with the Company Control Center (EP25/26).

## 3. Security boundaries

- Platform data only behind `requirePlatform`; COMPANY_OWNER, SYSTEM_ADMIN, EXECUTIVE and
  DEPARTMENT_STAFF get `403` on overview, companies, company detail, users, audit and operators
  (tested). The UI also redirects them, but the API is the boundary.
- Platform Admin: inspects companies; operator list / grant / revoke and suspending the owner `403`
  (tested). Platform Owner keeps the code flow on every sign-in.
- Inspection never creates a membership or a customer session; the operator's
  `/company/current` stays `404` and onboarding stage `PLATFORM_OPERATOR` (tested).
- EP24 isolation unchanged: customer routes derive the company from membership; cross-company
  Branch / Subscription `404`.
- Job function and business context grant nothing (no role, no company, platform `403` — tested);
  registration bodies stay strict (`role`, `platformRole`, `companyId`, `status`, `displayName`,
  `plan` inside `business` … → `400`).
- Demo bypass (`3c43feb`) unchanged: exact four addresses, non-production, demo routes on, password
  first, verified, not suspended, no platform role, demo-company member, audited. Not expanded.

## 4. Verification

### Gates

| Gate | Result |
| --- | --- |
| Backend `npm ci`, typecheck, lint, format, build · Prisma validate / deploy / status | pass |
| Backend tests (test DB rebuilt from migrations) | **16 files / 208 tests** (EP24 + bypass: 186) |
| Frontend `npm ci`, typecheck, lint (0 warnings), format | pass |
| Frontend tests | **39 files / 907 tests** |
| Frontend build + prerender + verify + `npm run perf` | 105 indexable pages + 3 shells; within budget |
| Seed | fresh DB (4 migrations): created, second run all `unchanged` |

New tests: `backend/test/platform-explorer.test.ts` (paging, search, filters, demo visibility,
overview counts, inspection facts / audit / not-impersonation, four customer roles denied, admin
limits); registration profile + business context suites in `auth-register.test.ts`; email
structure; `frontend/src/features/platform/platform.test.tsx` (overview, explorer URL state and
cursor, inspection band, back navigation, dev activation, error kinds, TH / EN / ZH); two-step
register tests; phone-rule parity (client ↔ server); About S2 chapter tests.

### Real-stack browser QA (web :1211 → API :1212 → fresh QA DB, dev mail sink)

276 checks per browser, both browsers all passing:

| Chrome | Edge | Firefox |
| --- | --- | --- |
| 276/276 | 276/276 | not run — no working Firefox on this Windows preview build (see EP24 report); no system change made |

Covered: **customer journey** — `/register` (both steps, errors, live rules) → check email →
emailed link → verified → sign-in with the emailed code (no bypass event) → package carried →
company form prefilled from sign-up → Head Office 00000 → three departments → pending; database
shows the full name, `+66812345678`, `OWNER`, and the business context exactly, and no membership
from the job function. **Platform Owner** — code flow, gold authority, headline = database count,
explorer search / filter / demo tag, keyboard Enter on a row, inspection facts (3 / 4, 00000,
owner name, sign-up context, pending + "no payment", inspection in activity), Back returns to the
same query, demo company six departments, unknown id → not-found state. **Platform Admin** — lower
authority, no owner-only area, operator API 403, inspection allowed. **Demo bypass** — all four
demo identities sign in without a code, correct company and role, platform 403, `DEMO_AUTH_BYPASS`
+1 each, `/platform` redirects to `/account`. **About** S2 chapter in TH / EN / ZH.

Widths **320, 375, 390, 430, 768, 1024, 1280, 1440, 1920** on every reviewed surface: no
horizontal overflow; targets ≥ 24 px at 320 and 1440; one `h1`; axe (WCAG 2.0–2.2 A/AA + best
practice) clean at 390 / 1440 / 1920; reduced motion emulated; no console errors.

Defects found and fixed during QA: company rows overflowed phones (grid items needed `min-w-0`);
subscription facts overflowed 320 (labels now stack on phones); EN / ZH About showed the Thai S2
name (now Thai pages only); register terms label 20 px (EP24 fix kept).

### Public bundle and freeze

- Platform, explorer, inspection, account and register code are lazy route chunks; no platform /
  company API path or string in the homepage's initial chunks. Initial JS 180.7 kB gzip / 205 (EP24: 182.5).
- Public change: /about chapter 07 only (owner-approved). Pricing, header, footer, navigation,
  SEO / prerender (105 + 3), Warehouse privacy and claim suites unchanged and passing; EN / ZH keep
  no Thai beyond approved exceptions.

### Secrets

`backend/.env.example` restored to placeholders before work (its values already lived in the
ignored `.env`). Committed content scanned for credentials, database URLs, SMTP / Resend keys,
`AUTH_SECRET`, owner / demo passwords, codes and tokens — none; `.env` / `.env.test` ignored.

## 5. Known limitations / deferred

- **S2 logo:** not available in this session; the chapter shows a typographic "S2" mark and reads
  `INSIGHT_PARTNER.logo` from `config/partners.ts` — add the owner-supplied file there.
- Firefox, Safari, real devices and screen readers not exercised.
- Search uses case-insensitive `contains` (fine at today's scale; a trigram index later).
- No operator actions beyond the development activation (no suspend / close / plan change),
  no billing data, no branch or member management, no impersonation — none is shown.
- `/login` keeps its EP15 / EP23 gateway design (reviewed, not redesigned).
- Company profile fields on `Company` deferred (§2).

## 6. Status

- **Push status:** NOT PUSHED.
- **EP25:** NOT STARTED.
