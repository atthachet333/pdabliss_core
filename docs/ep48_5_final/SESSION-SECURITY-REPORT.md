# EP48.5 FINAL — Session Security Report

Release `7e62673` (backend/frontend = `cb21be1`), `https://core.pdabliss.com`, 2026-11-18.

**Verdict: PARTIAL.** The implementation was read in full for every item, and every unauthenticated behaviour was checked live. Two items are still open, so this is not a PASS:

- Server-side revocation with a captured token, and the live cookie attributes, need a dedicated test account. Creating one is a production mutation (Level C).
- The backend suite has not run in this session. 573 tests in 42 files cover these items, but there is no `node_modules`/package registry here (proxy refused), so nothing was executed.

Legend:
- **LIVE**: checked against production in this session.
- **CODE**: read in the implementation.
- **TESTS**: covered by an existing backend test that was not run here.
- **OWNER**: reported by the owner.
- **PENDING**: not verified.

| # | Contract | Result | Evidence |
|---|---|---|---|
| 1 | Password authentication | LIVE + CODE | An unknown email with any password gives `401 INVALID_CREDENTIALS`, "Email or password is incorrect." (same text for known and unknown email). argon2 hashing (`auth/password.ts`). Password policy: 10–128 characters, not common, does not contain the email. TESTS: `auth-login` (20). |
| 2 | OTP issue / verify | OWNER + CODE | The owner received a code and signed in. The code is stored only as an HMAC (`otpHash(secret, challengeId, code)`) and compared in constant time (`safeEqual`). Up to 10 challenges per account per hour. |
| 3 | OTP expiry | CODE | `ttlMs` 10 min. `status !== 'PENDING' \|\| expiresAt <= now` is rejected as expired (`auth/otp.ts`). |
| 4 | OTP single use | CODE | Consumption is an `updateMany … where status 'PENDING' and expiresAt > now` setting `VERIFIED` + `consumedAt`. If 0 rows change, the result is `otpExpired`, so a second use fails. |
| 5 | OTP replay | CODE | As #4. The LOGIN challenge is also bound to the browser that passed the password (`__Host-core_pending` cookie, 10 min). |
| 6 | Login rate limiting | LIVE + CODE | Live response headers: `x-ratelimit-limit: 60`, `remaining: 59`, `reset: 300` (60 per 5 min per client). Per email (known or not): 10 failures per 15 min, then 429. Client address taken from the tunnel's forwarded header (`TRUST_PROXY=loopback`, EP44). TESTS: `auth-login`, `ep44-trust-proxy`. |
| 7 | Invalid password | LIVE | As #1. No session or cookie was created; `/auth/me` stays 401 afterwards. |
| 8 | Failed OTP attempts | CODE | 5 attempts, then the challenge is `LOCKED` (`otpLocked`). The attempt counter is updated with an optimistic `attempts` match. Resend: 60 s cooldown, at most 5 sends. |
| 9 | Session creation | CODE | 32-byte random token. Only its SHA-256 is stored (`sessions.tokenHash`). Lifetimes: platform accounts 30 min idle / 12 h absolute; customers 7 d idle / 30 d absolute. Rotated after 12 h with a 1-minute grace period. |
| 10 | Refresh restores session | OWNER + CODE | Every `/api/*` request resolves the cookie (`resolveSession`). The idle timeout slides at most once a minute. |
| 11 | Server-side revocation on logout | CODE, **PENDING live** | `POST /auth/logout` calls `revokeSession(id, 'LOGOUT')` (sets `revokedAt`), records an audit event and clears the cookie. `resolveSession` returns null for any revoked session, so the token is dead on the server, not just in the browser. `logout-all` revokes every session and trusted device. TESTS: `auth-session` (16). |
| 12 | Reuse of a revoked session | CODE, **PENDING live** | As #11. The live proof needs a captured test-account token replayed after logout. |
| 13 | Protected routes without a session | LIVE | `/api/v1/auth/me`, `/company/current` and `/platform/overview` return `401 UNAUTHENTICATED`. `/platform` redirects to `/login?next=/platform`. Demo routes return 404. |
| 14 | Cookie attributes | CODE, **PENDING live** | Session cookie `__Host-core_sid` (also `__Host-core_device`, `__Host-core_pending`). Attributes: `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/`, no `Domain`, which meets every `__Host-` prefix rule. Max-Age = absolute lifetime (12 h for platform accounts); idle expiry is enforced on the server. LIVE: page JavaScript sees no cookies (consistent with HttpOnly). |
| 15 | CSRF / cross-origin | LIVE + CODE | Stage 3 `P7`: a foreign `Origin` on an unsafe `/api` method gives `403 CSRF_REJECTED`. Rules (`originCheck`): an unsafe method with a foreign Origin is refused; a request with no Origin but an auth cookie is refused. JSON-only bodies, CORS limited to the single origin. TESTS: `auth-security`, `ep40-security`. |
| 16 | Account / company permissions | CODE + TESTS, **PENDING live** | `requireSession` / `requirePlatform` hooks run before every data and platform route (Stage 0 release check `A1`/`A2`). Platform accounts cannot create or join a company (`company/service.ts` refuses `platformRole`). Live role-level 403 checks need test accounts (see UAT-ROLE-MATRIX). |
| — | Tokens in browser storage | CODE | `localStorage` holds only the navigation preference and the cookie-consent record. Session state lives only in HttpOnly cookies (`features/auth/session.ts`). |

## Owner checklist for the live session (2 minutes, no secrets in chat)

1. Sign in at `https://core.pdabliss.com/login`. Open DevTools → Application → Cookies → `https://core.pdabliss.com`.
2. Check `__Host-core_sid`: **HttpOnly ✓, Secure ✓, SameSite Lax, Path /, Domain = core.pdabliss.com (host-only)**, expires in about 12 h.
3. Log out, then reload `/platform`. It should redirect to `/login`, and `__Host-core_sid` should be gone.

## Still needed for PASS

The checklist above, plus one automated revocation proof with a dedicated test account:

1. Sign in.
2. Copy the cookie inside the script only.
3. Log out.
4. Replay the cookie against `/api/v1/auth/me`: it must return 401.

The test account comes with the UAT approval package. Alternatively, run the backend suite (`auth-session`, `auth-login`, `auth-security`, `auth-platform`, `ep40-security`) in an approved test runtime.
