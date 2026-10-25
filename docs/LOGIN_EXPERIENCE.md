# Sign-in — the CORE Gateway (EP15)

> **เข้าสู่พื้นที่ทำงานของคุณ**: แต่ละคนไม่จำเป็นต้องเห็นทั้งระบบ — CORE เริ่มจากสิ่งที่คุณรับผิดชอบ

EP15 redesigns `/login` visually. **The authentication mechanics are unchanged.** It is still the
EP01-PROTOTYPE sign-in:
- `prototypeSignIn()` checks the demo-only account.
- The session is a `sessionStorage` username flag (`pbc.prototype.session`).
- The `?next=` same-app guard is unchanged.
- `PrototypeGate` still guards `/app/*`, and production builds still disable the prototype unless
  `VITE_ENABLE_PROTOTYPE=true`.

No real auth, user database, SSO, OAuth, SCIM, MFA, session service or RBAC backend was added.

## Composition

The page is not a left-image / right-card split, and not a glass card on a dark background. It
works as a gateway:

```
OUTSIDE (organization)          SEAM            INSIDE (one focused workspace)
six department signals ──lanes──▶ CORE gate ──▶ ● workspace panel (the form)
```

- **Outside:** the six departments, in their existing localized names plus English, as signals in
  their workspace colours. Their work lanes bend toward one gate, past faint operational fragments
  (SO-1042, PO-2215 · 80/100, LOT-B2410, INV-5521, GR-3307, DO-0588).
- **The gate:** CORE geometry — an outer dashed ring, a ring of six nodes, an inner ring and a
  luminous core. A faint vertical seam marks the boundary between outside and inside.
- **Inside:** the form panel is styled as the workspace. Its top bar reads "CORE · WORKSPACE" plus
  a system-state pill. The gate's exit lane arrives at a socket on the panel's edge: the left
  middle on desktop, the top centre on smaller screens.

The scene is symbolic. It never implies that it knows the visitor's role before sign-in, and
role or workspace selection after sign-in is the existing product behaviour. It is decorative
(`aria-hidden`); every state is also written in the panel.

## States

| Phase | Trigger | Scene | Panel status | Intensity |
| --- | --- | --- | --- | --- |
| `idle` | default | signals 55 %, lanes faint, a slow pulse on three lanes | รอเข้าสู่ระบบ | 3/10 |
| `user` | username focused | signals and labels clearer | กำลังระบุตัวตน | 4/10 |
| `pass` | password focused | signals draw 30 px toward the gate, outer ring tightens, fragments recede ("secured workspace") | กำลังระบุตัวตน | 4/10 |
| `submit` | submit | every lane lights in its department colour toward the one gate; the gate ring contracts | กำลังตรวจสอบ | 6/10 |
| `success` | valid sign-in | the rings close and the gate resolves into one workspace frame; the exit lane brightens | กำลังเปิดพื้นที่ทำงาน | 7/10, briefly |
| `fail` | invalid sign-in | one amber dashed line stops before the gate with a tick; the gate ring turns amber | ยังเข้าไม่ได้ | 4/10 |

The memorable moment is on submit: the six department signals align into one gate, and on
success the gate becomes one focused workspace. It summarizes the product in about one second.

**Timing.** Submit → check takes 380 ms; success → navigation takes 520 ms, about 0.9 s in total
(EP01 had a 350 ms pause). Under reduced motion both waits are 0.

**No spinner.** The system-state pill (icon + words, `aria-live="polite"`) is the loading state,
and the submit button reads "กำลังเข้าสู่ระบบ…" while disabled.

## Form

- **Structure:** a real `<form>` with labels, `autocomplete="username"` and
  `autocomplete="current-password"`, `autoCapitalize="none"` and no spellcheck on the username.
- **Validation:** required-field messages in the visitor's language. The zod schema carries keys,
  not words.
- **Show / hide password:** a 48 × 48 button with `aria-label`, `aria-pressed` and
  `aria-controls`.
- **Caps Lock warning:** read from `getModifierState('CapsLock')` and linked through
  `aria-describedby`.
- **Wrong credentials:** handled calmly.
  - **What appears:** an amber panel edge, an amber `role="alert"` message ("ชื่อผู้ใช้หรือ
    รหัสผ่านไม่ถูกต้อง · ตรวจสอบแล้วลองอีกครั้ง") and the failed-access line in the scene.
  - **Field reset:** the password is cleared and focused again (`setFocus`), with
    `aria-invalid`.
  - **No alarm:** no shake and no "incident" language.
  - **Recovery:** typing again clears the failed state.
- **No fake options:** no Google, Microsoft or SSO buttons, and no forgot-password link (no such
  route exists).

## Links

- "กลับหน้าเว็บไซต์" and the logo go to the homepage of the visitor's locale.
- "ยังไม่พร้อมเข้าสู่ระบบ? ทดลอง CORE" → `/demo` is the secondary link, styled quieter than
  the form.
- "แนวทางด้าน Security และการควบคุมสิทธิ์" → `/security` is the quietest link.
- A discreet prototype note sits at the foot of the panel: "ต้นแบบ · สภาพแวดล้อมต้นแบบสำหรับ
  ตรวจหน้าจอ — ยังไม่ใช่ระบบยืนยันตัวตนจริง". It appears only when the prototype is enabled.

## Credential boundary

- **Not shown to visitors:** the prototype credentials appear nowhere in copy or on the page.
  A test checks both, plus a source scan proving the demo password exists only in
  `src/prototype/config.ts`.
- **Where they are documented:** developer docs (README, EP01 report) and tests still name the
  credentials, as before.
- **No logging:** a test spies on `console.log` during sign-in.
- **No persistence:** the password is never stored. A test checks `sessionStorage` and
  `localStorage` after sign-in; only the username flag exists, as in EP01.

## Routing and locale

- **One URL.** Sign-in is still one unprefixed route, `/login`. The `?next=` contract, the
  `PrototypeGate` redirects and the sign-out redirect are untouched.
- **Own chrome.** The route now sits outside the public header and footer. It has its own
  focused chrome: logo plus "back to the website". It is not a second portal.
- **Locale travels in router state.**
  - The header and mobile-menu "Sign in" links pass `state={{ locale }}`.
  - `/en/login` and `/zh/login` still redirect to `/login`, now with that state.
  - The gateway then speaks TH / EN / ZH, sets `<html lang>`, and links home, demo and security
    in that locale.
  - A direct visit, or a redirect from `/app/*`, is Thai, like the internal app.
- **Why not `/en/login`.** Prefixed sign-in URLs would duplicate the route and the auth contract.
  The existing architecture (`locales.ts`: "/login and /app/* are never prefixed") is kept.

## SEO

- `/login` is not a landing page.
- It has its own title and description per locale ("เข้าสู่ระบบ" / "Sign in" / "登录").
- While it is open, the page adds `<meta name="robots" content="noindex">`, and removes it on
  leave.
- It stays out of `sitemap.xml`, and the sitemap test already forbids it.
- `robots.txt` is unchanged: disallowing it would hide the `noindex`.

## Responsive behaviour

- **lg and up:**
  - The scene sits left and the panel right, with the exit lane meeting the panel's middle.
  - The scene is up to 36 rem tall, or 46 rem at 2xl.
- **Below lg:**
  - A compact gateway sits above the form: an arc of six signals, two of them labelled (Sales,
    Warehouse), and a small gate whose lane drops into the panel.
  - The panel is at most 28 rem wide.
  - At 320 × 568 the username field starts at 413 px and the password at 508 px. There is no
    giant hero before the fields.
- **Below 400 px:** the header shows the CORE mark only, so "back to the website" fits.

## Reduced motion

- no idle pulse (the `<animateMotion>` elements are not rendered)
- no transforms or fades: phase changes are instant
- submit and success waits are 0, so navigation happens immediately
- the final composition and all text remain

## Performance

The page uses SVG, DOM and the existing Framer Motion. There is no WebGL, image or new dependency.
The `LoginPage` chunk grows from 36.6 kB to 52.5 kB (13.1 → 19.2 kB gz). The entry chunk grows
by 0.15 kB gz.

## Files

```
frontend/src/features/login/
├── copy.ts            th / en / zh-CN (no credentials)
├── GatewayScene.tsx   wide + compact SVG scene, phases
├── LoginGateway.tsx   chrome, panel, form, phases, timing, noindex
└── login.test.tsx
frontend/src/pages/public/LoginPage.tsx   locale from router state → LocaleProvider
```
