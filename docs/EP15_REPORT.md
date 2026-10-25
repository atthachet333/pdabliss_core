# EP15 — Security / Trust Center + Signature Login Experience

**Date:** 2026-10-25 · **Owner:** PDA BLISS COMPANY LIMITED

**Baseline:** `582a059` (EP14, approved and on `origin/main`). Before work: branch `main`, local
`main` == `origin/main`, working tree clean.

**Commit:** `feat: create trust center and signature CORE login (EP15)` — local only,
**not pushed**. Awaiting owner visual review.

## Scope

One theme across both parts: identity, access, trust and boundaries.

- **A. Public Trust Center** at `/security` (`/en/security`, `/zh/security`). Details are in
  [SECURITY_TRUST_CENTER.md](SECURITY_TRUST_CENTER.md).
- **B. `/login` redesigned as the CORE Gateway.** Details are in
  [LOGIN_EXPERIENCE.md](LOGIN_EXPERIENCE.md).

The episode is frontend-focused. None of the following was implemented:
- production authentication, a user database, SSO, OAuth, SCIM or MFA
- a session service, an RBAC backend or an audit backend
- any certification
- the inquiry backend
- Prisma or migrations

The prototype sign-in mechanics are unchanged. No new dependencies, WebGL, images or video were
added.

## A. Trust Center

**Opening.** The hero reads "ทุกคนไม่ควรเห็นทุกอย่าง" (not everyone should see everything),
followed by the concept line "ความปลอดภัยไม่ได้เริ่มจาก Firewall แต่เริ่มจากการที่คนเห็นเฉพาะ
สิ่งที่จำเป็นต่อหน้าที่" (security starts with people seeing only what their work needs, not with
a firewall).

**Major visual: one work item with six role windows.**
- **Setup:** SO-1042 sits at the centre with 16 fields. Six role windows surround it: Sales,
  Warehouse, Purchasing, Accounting, Executive and Admin.
- **Interaction:** permitted fields flow into the chosen window; the others stop at its boundary
  with an amber tick.
- **Default:** Warehouse is selected first.
- **Admin:** sees configuration only.

**Chapters:**
- the Warehouse flagship: a boundary lane visual, plus "sees" / "does not see" lists and a
  checked fact line
- Executive ≠ Admin
- "UI visibility ≠ security boundary", with three stages: today (prototype) → foundation
  (architecture-ready) → next backend phases (planned)
- a trace provenance line: WHO → … → SOURCE, for three sample events
- control: required info, approval, conditions, role responsibility
- seven data principles, and what a live deployment needs first (defined during implementation,
  not running today)
- the readiness matrix: identity, access, workflow, trace, data, backup / recovery,
  observability, integration
- "what we do not claim yet"
- an FAQ of ten questions
- a closing consultation CTA

**Statuses.** The page reuses the EP10 taxonomy, components and labels. Tests check that its
statuses agree with EP10 `READINESS` and `CONTROLS`.

**Claim safety.** Every string in every language is scanned for certification, compliance,
uptime, guarantee, immutability, recovery-time and grade claims, in Thai and Chinese too. No
infrastructure details (IPs, ports, machines, tunnels, secrets) appear.

**Navigation.**
- The Enterprise mega menu item "Security & Access" (→ `/enterprise#access`) is now "Security &
  Trust" → `/security`.
- The footer's องค์กร group gains "ความปลอดภัย" / Security / 安全.
- `/login` links to the page quietly.
- There is no new top-level item.

## B. Sign-in: the CORE Gateway

**Composition.**
- **Outside:** six department signals, in their workspace colours and with localized names, send
  work lanes past faint operational fragments.
- **On the seam:** one CORE gate.
- **Inside:** the form panel, styled as the focused workspace: "CORE · WORKSPACE" plus a
  system-state pill. The gate's exit lane docks into it.
- **Chrome:** its own logo and "กลับหน้าเว็บไซต์"; no public header or footer.

**States** (idle → username → password → submit → success / fail):
- **Focus:** signals clarify on username focus; on password focus the scene tightens.
- **Submit:** all six lanes light toward the one gate.
- **Success:** the gate resolves into one workspace frame, then the page navigates after about
  0.9 s.
- **Failure:** controlled amber. A failed-access line stops before the gate, and the password is
  cleared and focused again. Nothing shakes.

**Form.**
- **Structure:** a real form with labels and autocomplete, required-field validation in the
  visitor's language, a 48 px show/hide control and a Caps Lock warning.
- **Links:** quiet links to `/demo` (secondary) and `/security` (quietest).
- **Prototype note:** a discreet note, shown only when the prototype is enabled.
- **Credentials:** never printed.

**Preserved mechanics.**
- `prototypeSignIn()`, the sessionStorage username flag, `?next=` validation, `PrototypeGate`,
  sign-out, and the production disable are all unchanged.
- The demo account is unchanged (developer docs and tests only).

**Locale.**
- `/login` stays one unprefixed URL.
- The header and mobile-menu links, and the `/en/login` and `/zh/login` redirects, pass the
  visitor's locale in router state. The gateway then speaks TH / EN / ZH and returns home in that
  locale.

**SEO.** The page has its own title and description per locale and `noindex` while open. It is
not in the sitemap.

## Files

New:

- `frontend/src/features/security/`: `model.ts`, `copy.ts`, `Visibility.tsx`, `Chapters.tsx`,
  `security.test.tsx`
- `frontend/src/features/login/`: `copy.ts`, `GatewayScene.tsx`, `LoginGateway.tsx`,
  `login.test.tsx`
- `frontend/src/pages/public/SecurityPage.tsx`
- `docs/SECURITY_TRUST_CENTER.md`, `docs/LOGIN_EXPERIENCE.md`, `docs/EP15_REPORT.md`

Changed:

- **Routes:**
  - `app/router.tsx`: `/security`; `/login` moved outside `PublicLayout`; locale redirects carry
    state.
  - `test/publicRoutes.ts` and `public/sitemap.xml` (+3 URLs, 81 total).
- **Sign-in page:** `pages/public/LoginPage.tsx`, now locale from state → `LoginGateway`.
- **Shell:**
  - `config/navigation.ts`
  - `components/layout/PublicHeader.tsx`, `MobileMenu.tsx` (login link state) and
    `PublicFooter.tsx`
  - `i18n/types.ts` and `i18n/messages/{th,en,zh-CN}.ts`
- **Tests following the new heading, footer and menu:**
  - `test/routes.test.tsx`
  - `components/shell/shell.test.tsx`
  - `components/layout/shell.test.tsx` and `header.test.tsx`
  - `features/enterprise/enterprise.test.tsx`
- **Docs:** `README.md`, `PUBLIC_SHELL.md`, `BRAND.md`, `MOTION.md`, `EP01_PROTOTYPE_REPORT.md`

Untouched:
- the backend
- `/app/*` and the prototype AppShell
- the workspace switcher
- `src/prototype/` (auth logic)
- the EP13 contact flow and EP14 demo

## Quality gates

| Gate | Frontend | Backend |
| --- | --- | --- |
| `npm ci` | ✓ | ✓ |
| `npm run typecheck` | ✓ | ✓ |
| `npm run lint` | ✓ (0 problems) | ✓ |
| `npm run format` / `format:check` | ✓ | ✓ |
| `npm test` | ✓ 650 / 26 files (39 new) | ✓ 21 / 4 files |
| `npm run build` | ✓ | ✓ |

### Bundle (vs. `582a059`, both built from source)

| | Baseline | EP15 |
| - | - | - |
| `SecurityPage` chunk | — | 82.9 kB (22.7 kB gz), lazy |
| `LoginPage` chunk | 36.6 kB (13.1 kB gz) | 52.6 kB (19.2 kB gz) |
| Entry `index.js` | 760.5 kB (225.0 kB gz) | 760.6 kB (225.2 kB gz) |
| CSS | 283.8 kB (44.2 kB gz) | 291.6 kB (45.2 kB gz) |
| Images / video / dependencies | — | none added |

### Browser QA

**Sweep.** At 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1280×720, 1440×900 and
1920×1080, both `/security` and `/login` had one H1, no horizontal overflow and no console
errors. `/en/security` and `/zh/security` were checked at 320 and 1440. The visibility lines
draw from 1024 up.

**Visual review:**
- `/security` at 1024, 1440 and 320: all chapters.
- `/login` at 320, 390, 768, 1280, 1440 and 1920.
- `/login` interactions, end to end: focus states; wrong password (amber state, failed line,
  focus back); valid sign-in (submit at ~10 ms, success at ~400 ms, then `/app/executive`, with
  no password in storage).

**Fixed during QA:**
- field lines cramped between card and windows (wider gaps per breakpoint)
- a faint Warehouse boundary (now a window with an amber edge)
- the gate lane misaligned with the panel socket (both columns centred)
- idle pulses parked at the SVG origin before starting (negative begin offsets)
- the login fields too low at 320×568 (tighter chrome; username at 413 px)
- "back to the website" clipped below 400 px (mark-only logo there)
- role-window names squeezed at 320 and 1024 (count on its own line until xl)
- long field values overlapping labels on phones

**Regression smoke** (H1, overflow, console):
- public routes: `/`, `/about`, `/why-core`, `/contact?interest=implementation`, `/industries`,
  `/industries/property`, `/enterprise`, `/solutions`, `/how-core-works`, `/pricing`,
  `/departments`, `/departments/warehouse`, `/privacy`
- the demo: `/demo` and `/demo?role=warehouse`
- the gate: `/app/warehouse` redirects to `/login`
- locales: `/en`, `/en/security`, `/zh/contact`, and `/en/login`, which renders `/login` in
  English

## Known limitations

- **Production mode:** with the prototype disabled, the gateway shows an honest "opens when
  ready" panel. That path is not unit-tested, because the flag is a build-time constant.
- **Direct `/login` visits are Thai:** a visit without router state (direct, a bookmark, or a
  redirect from `/app/*`) has no locale to inherit.
- **Reduced motion:** verified by tests (no pulses, instant navigation). The QA browser cannot
  emulate the OS preference.
- **QA environment:** the browser pane ran in the background, so animation timing was measured
  through DOM phase changes rather than watched frame by frame. Chromium only.
- **Illustrative content:** the visibility model and trace values are illustrative and are
  labelled so on the page.

## Recommended EP16

Real inquiry delivery, as recommended since EP13:
- a `POST /api/inquiries` route in the existing backend, with validation mirroring
  `contact/validation.ts`
- rate limiting and a stored record
- an email or LINE notification to PDA BLISS
- a privacy notice
- a success state shown only when delivery returns `ok`

Both new CTAs end in the EP13 contact flow: "พูดคุยเรื่อง Security / Implementation" and the
demo's "ขอ Demo". With delivery in place, they would reach PDA BLISS.
