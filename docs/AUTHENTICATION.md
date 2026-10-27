# Authentication & Accounts — PDA BLISS CORE (EP23)

The account and real-authentication foundation of the CORE SaaS. This document is the canonical
reference; every number below comes from `backend/src/auth/policy.ts`, so the two must change
together. The episode report is [EP23_REPORT.md](EP23_REPORT.md).

**SaaS direction (owner-approved):** Public website → Register / Login → Verify email → Account
Portal → Package selection → Payment → Company creation → Company Control Center → Branch
selection → CORE operations. **EP23 builds only the account/authentication foundation.** Payment,
subscriptions, company creation and the Company Control Center are later episodes; the Account
Portal says so honestly instead of pretending.

## 1. Stack

- Node.js + TypeScript, Fastify (existing backend conventions, Zod validation).
- PostgreSQL + Prisma (`backend/prisma/schema.prisma`, migration
  `20261026083839_ep23_account_auth_foundation`). No other ORM; Docker is not required.
- Passwords: **Argon2id** (`@node-rs/argon2`, OWASP baseline: 19 MiB, t=2, p=1), re-hashed on
  sign-in when the parameters change.
- Mail: `nodemailer` SMTP transport in production, a local file sink in development, an
  in-memory mailer in tests. Sender identity: `PDA BLISS CORE <notify@pdabliss.com>`.

## 2. Identities and roles

| Level | Roles | Where they live |
| --- | --- | --- |
| Platform | `PLATFORM_OWNER` (exactly one), `PLATFORM_ADMIN` | `PlatformRoleAssignment` |
| Customer company | `COMPANY_OWNER`, `SYSTEM_ADMIN`, `EXECUTIVE`, `DEPARTMENT_MANAGER`, `DEPARTMENT_STAFF`, `VIEWER` | `CompanyMember` (one company per account) |

- Platform roles are platform identities, **not** customer-company roles.
- **Exactly one `PLATFORM_OWNER`**, enforced by the database: a unique `ownerSlot` that is `TRUE`
  only for the owner, plus a CHECK constraint. The owner is created **only** by the bootstrap from
  `PLATFORM_OWNER_EMAIL`; no API path creates, demotes, suspends, revokes or targets the owner.
- `PLATFORM_ADMIN` is granted and revoked **only by the owner** (step-up required). An admin cannot
  touch the owner, another admin, or promote itself; a customer account cannot be made an operator
  (`409 CUSTOMER_ACCOUNT`).
- Public registration can never assign a role: the request schema is strict, so injected fields
  (`role`, `platformRole`, `companyRole`, `status`, `emailVerifiedAt`, …) are refused with `400`.
- Roles are read from the server-side session on every request. Client-supplied role state is
  never trusted; the frontend only mirrors `/auth/me` for display and routing.

## 3. Flows

**Registration** — `POST /api/v1/auth/register` (email, password, `acceptTerms`, optional
`displayName`, `locale`, `plan` intent). Email is normalized (trim, NFC, lower-case; no
provider-specific rewriting). A duplicate address gets the **same 202 answer**; the existing owner
is mailed instead (no enumeration). The account starts `PENDING_VERIFICATION`.

**Email verification** — a 256-bit link token (stored as SHA-256), 24 h, single use, delivered in
the URL **fragment** (`/verify-email#token=…`, never sent to servers or logs; the page removes it
from the address bar). Resend: 1-minute cooldown, 10 per day, generic answer for unknown or
verified addresses.

**Sign-in** — `POST /auth/login` → generic `INVALID_CREDENTIALS` for a wrong password **and** an
unknown account (a dummy Argon2 verification equalises timing). Unverified / suspended states are
revealed only after the correct password. Then:

- **Platform accounts:** an emailed one-time code on **every** sign-in. No trusted browser.
- **Customers:** an emailed code on a new browser; they may trust the browser for 90 days.
- The code challenge is bound to the browser that passed the password (pending-login cookie).
- A session exists only after every required check.

**One-time codes (OTP / step-up)** — 6 random digits (`crypto.randomInt`), 10 minutes, single use
(conditional update, race-safe), 5 wrong tries then locked, resend after 1 minute, 5 sends per
challenge, 10 new challenges per account per hour. Stored as an HMAC keyed by `AUTH_SECRET` and
bound to the challenge id. **There is no fixed, universal or test code anywhere**; tests read the
code from the test mailer. Sensitive platform actions need a code verified in the last 10 minutes
(a privileged sign-in code counts).

**Forgot / reset password** — `POST /auth/password/forgot` always answers `202` the same way; at
most 3 reset mails per account per hour (silently capped). The link token (fragment, SHA-256 at
rest) lasts 30 minutes, is single use, and a newer request replaces the older link. A successful
reset revokes **every** session, trusted browser and pending code, and mails a "password changed"
notice.

**Sessions** — a random 256-bit token in an HttpOnly cookie; the database stores only its SHA-256
hash and every request looks it up, so revocation is immediate.

| | Customer | Platform |
| --- | --- | --- |
| Idle timeout (sliding) | 7 days | 30 minutes |
| Absolute lifetime | 30 days | 12 hours |

- Token rotation after 12 h (on `/auth/me`) with a 1-minute grace for in-flight requests.
- `POST /auth/logout` (this session), `POST /auth/logout-all` (every session + trusted browsers),
  `GET /auth/sessions`, `DELETE /auth/sessions/:id` (own sessions only).
- A session is refused when the account is no longer `ACTIVE`/verified, or when its privilege level
  no longer matches the account's platform role (role removed mid-session).
- Cookies: `core_sid`, `core_device`, `core_pending` — HttpOnly, SameSite=Lax, Path=/; in
  production `__Host-` prefixed and Secure. Nothing secret is ever stored in `localStorage`.

**CSRF / origin** — state-changing requests carrying an Origin must come from `CORS_ORIGINS`; a
request carrying one of our cookies must carry an allow-listed Origin; JSON bodies only (no simple
form/text posts that skip preflight).

**Invitations (foundation)** — `POST /api/v1/company/invitations` by a `COMPANY_OWNER` or
`SYSTEM_ADMIN`; bound to the invitee's email and the company, inviter recorded, 7-day expiry,
single use, revocable (`/invitations/:id/revoke`), accepted at `/account/invitation#token=…` by the
signed-in account with that email. `COMPANY_OWNER` and platform roles are not invitable; an account
already in a company cannot join another. The employee-management UI is a later episode.

## 4. Rate-limit design (layered)

| Layer | Limit |
| --- | --- |
| Global (all routes) | `RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW` per IP |
| Per IP — sign-in / code check | 60 per 5 min (offices share one NAT address) |
| Per IP — code resend 10 / 15 min · register 10 / 15 min · verify 20 / 15 min · resend verification 5 / 15 min · forgot 5 / 15 min · reset 10 / 15 min · invitation accept 10 / 15 min | |
| **Per account (email, known or unknown)** | 10 failed sign-ins per 15 min → `LOGIN_THROTTLED`, reset by a real success |
| Per code challenge | 5 tries, then locked |
| Per account | 10 new code challenges per hour; 5 sends per challenge; 1-minute resend cooldown |

The generous per-IP sign-in limit does **not** widen guessing: one IP is stopped per account after
10 failures while colleagues on the same address still sign in (tested). Trade-off: someone who
knows an address can temporarily throttle its sign-in for up to 15 minutes. Rate-limited answers
use `429` with code `RATE_LIMITED` (per IP) or the specific auth code.

## 5. Audit

`AuthAuditEvent` (append-only): `REGISTER`, `REGISTER_EXISTING_EMAIL`, `EMAIL_VERIFICATION_SENT`,
`EMAIL_VERIFIED`, `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `OTP_SENT`, `OTP_SUCCESS`, `OTP_FAILURE`,
`STEP_UP_SUCCESS`, `PASSWORD_RESET_REQUEST`, `PASSWORD_RESET_SUCCESS`, `LOGOUT`, `LOGOUT_ALL`,
`SESSION_REVOKED`, `INVITATION_CREATED/ACCEPTED/REVOKED`, `PLATFORM_ROLE_GRANTED/REVOKED`,
`ACCOUNT_SUSPENDED/REACTIVATED`, `PLATFORM_BOOTSTRAP`, and (development only) `DEMO_AUTH_BYPASS`. Failed sign-ins are attributed by a keyed
hash of the address, never the typed text. No password, code, token or cookie value is stored or
logged (tested against the store and the server log).

## 6. Frontend

| Route | Purpose |
| --- | --- |
| `/login` (`/en/login`, `/zh/login`) | Sign-in gateway (password → code step) |
| `/register` | Self-registration |
| `/verify-email` | Link landing + resend |
| `/forgot-password`, `/reset-password` | Recovery |
| `/account` | Account Portal (customers): identity, honest onboarding state, devices |
| `/account/invitation` | Invitation acceptance |
| `/platform` | Platform Control Center (platform operators only); owner sees the owner-only operator area |
| `/app/*` | Prototype workspaces — real session required; enabled only in dev / `VITE_ENABLE_PROTOTYPE=true` |

- All of these are lazy route chunks, `noindex`, absent from the sitemap, and served from the
  `login.html` / `app.html` shells. The public initial bundle contains none of their code.
- Customers never enter `/platform`; operators are sent from `/account` to `/platform`. `?next=`
  accepts only known internal paths.
- The old browser-only prototype credential (EP01) is gone: `/app` now requires a real session.

## 7. Environment

See `backend/.env.example` (placeholders only — never commit `.env`).

| Key | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (`pdabliss_core_dev` locally). Required in production. |
| `PUBLIC_APP_URL` | Origin for links in email. Required in production. |
| `AUTH_SECRET` | ≥ 32 random chars (HMAC for codes and throttling keys). Production refuses the dev value. |
| `MAIL_FROM` | `PDA BLISS CORE <notify@pdabliss.com>` |
| `MAIL_TRANSPORT` | `smtp` or `dev` (local sink `.mail/`, read with `npm run mail:latest`). Production requires SMTP. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | Real credentials only in `.env`. |
| `PLATFORM_OWNER_EMAIL`, `PLATFORM_OWNER_INITIAL_PASSWORD` | The owner's **real** address, local only. Placeholders are refused. |
| `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_INITIAL_PASSWORD` | `platform.admin@pdabliss.com` in development. |
| `BOOTSTRAP_RESET_PASSWORDS` | `false` by default — re-runs never change existing passwords silently. |
| `DEMO_*_EMAIL`, `DEMO_*_PASSWORD` | Demo identities (dev/test only); each password set locally. |

## 8. Bootstrap and demo seed

```bash
npm --prefix backend run db:migrate     # prisma migrate deploy
npm --prefix backend run db:seed        # privileged bootstrap: owner + admin
npm --prefix backend run db:seed:demo   # + labelled demo company and four customer identities
npm --prefix backend run auth:cleanup   # remove expired tokens / old sessions
```

- **Idempotent:** re-runs create nothing twice and change no password unless
  `BOOTSTRAP_RESET_PASSWORDS=true`.
- Never transfers ownership to another email; refuses placeholder or weak values; error messages
  never contain a password.
- The production bootstrap (`db:seed`) is separate from the demo seed; the demo seed refuses
  production.
- Demo identities: `owner.demo@`, `admin.demo@`, `executive.demo@`, `staff.demo@pdabliss.com` in
  `PDA BLISS CORE DEMO COMPANY` (six departments, marked demo).

### Development-only demo sign-in bypass

`backend/src/auth/demo-bypass.ts` (added after EP24 at the owner's request). The four seeded demo
customers may skip the emailed **login** code so local demos do not need the mail sink. The bypass
applies only when **all** of these hold:

1. `NODE_ENV !== 'production'` (checked in code, whatever else is configured);
2. `ENABLE_DEMO_ROUTES` resolved to `true` (it defaults to off in production);
3. the normalized email is exactly `owner.demo@pdabliss.com`, `admin.demo@pdabliss.com`,
   `executive.demo@pdabliss.com` or `staff.demo@pdabliss.com` — no domain or pattern match;
4. the account has no platform role (PLATFORM_OWNER / PLATFORM_ADMIN are always challenged);
5. the account is a member of a seeded demo company (`Company.isDemo`).

It runs only after the normal checks: throttling, the Argon2id password check, suspended /
unverified refusal. The result is an ordinary customer session (not privileged, no step-up, same
lifetimes); authorization and company isolation are unchanged. Each use is audited as
`DEMO_AUTH_BYPASS` (`{ skipped: 'login_otp' }`, next to the usual `LOGIN_SUCCESS`), and the
server logs a warning at start-up while the bypass is on. Migration
`20261027100000_dev_demo_auth_bypass_event` adds the event type. Tests:
`backend/test/auth-demo-bypass.test.ts` — development success for all four, wrong password,
unverified / suspended, platform roles with demo addresses, other `@pdabliss.com` and look-alike
addresses, normal customers, a demo address outside the demo company, no platform access, demo
routes off, and production with demo routes forced on.

## 9. Testing

- Backend auth/database suites need an isolated PostgreSQL database named `*_test` in
  `TEST_DATABASE_URL` (shell or `backend/.env.test`, git-ignored). The schema is dropped and rebuilt
  from the migrations on every run; any other database name is refused. Without it the database
  suites are **skipped** and say so.
- Tests use an in-memory mailer and read codes/links from it — no real mail is ever sent by the
  suite.
- `npm --prefix backend test` — 11 files, 128 tests (EP23 baseline).

## 10. Known limitations

- SMTP delivery to real mailboxes is not exercised in EP23 (development sink and test mailer only).
- No Safari / real-device verification of the account screens (none available).
- Per-account throttling allows a targeted temporary sign-in block (see §4).
- Payment, subscriptions, company creation, branches, Company Control Center, employee management
  and RBAC enforcement inside CORE operations are later episodes.
