# EP40 Security Audit

Baseline `4d20f68` (EP39). Scope: the implemented platform — no production system was touched.
Every claim below rests on an executable check; findings are tracked in
[EP40_FINDINGS_REGISTER.md](EP40_FINDINGS_REGISTER.md).

## 1. Attack surface (from the real route table)

The audit enumerates routes from Fastify's own registry (`printRoutes`), not from documentation —
the same parser runs inside `backend/test/ep40-security.test.ts`, so a route added later is
swept automatically.

| Area | Routes | Notes |
| --- | --- | --- |
| Health / API index / packages | 4 | public |
| Demo (mock stock, persona list) | 3 | public only when the demo surface is on (development, explicit) |
| Authentication | 18 | 11 public entry points (register, verify, login, codes, password reset, invitation accept, logout); sessions, step-up, me need a session |
| Platform administration | 12 | platform roles only |
| Company Control Center, members, permissions, logo | 37 | company administration permissions |
| Operations context / authorize | 3 | |
| Master data | 38 | |
| Purchasing (requests, orders, deposits, shortages) | 38 | |
| Warehouse (receipts, stock, movements, transfers, adjustments, counts, pick / pack / ship, handoffs) | 71 | |
| Sales | 13 | |
| Production | 46 | |
| Account | 2 | |
| **Total** | **285** (172 state-changing) + the catch-all 404 | 18 public |

There is no export endpoint, no background job and no file storage other than the company logo
(PNG / JPEG / WebP only, ≤ 256 KB, magic bytes must match the declared type — no SVG).

## 2. Authentication and sessions

Verified in code and by tests (existing EP23–EP28 suites plus EP40):

- Sessions:
  - random tokens stored as SHA-256 hashes;
  - `HttpOnly`, `SameSite=Lax` cookies (`Secure` and the `__Host-` prefix in production);
  - idle and absolute expiry;
  - rotation with a short grace period for the previous token;
  - revocation on logout and logout-all.
- Every request re-reads the user:
  - not ACTIVE, or unverified → no session;
  - a platform role change invalidates privileged sessions.
- Sign-in:
  - one generic answer for a wrong password and for an unknown account;
  - per-email throttling (known or unknown) and per-IP limits;
  - Argon2id with rehash on old parameters.
- One-time codes:
  - keyed hashes, 5-try lockout, expiry, single use, browser-bound;
  - resend cooldown and caps;
  - two simultaneous correct submissions open at most one session.
- CSRF:
  - an allow-listed `Origin` is required on every state-changing call that carries an auth
    cookie, and on any call without an `Origin`;
  - JSON only (`text/plain` removed);
  - EP40 swept **all 172 state-changing routes** with a valid session and a foreign `Origin`:
    every one answered 403.
- Replay: a cookie copied before logout gets 401 afterwards (EP40 test).
- Company switching does not exist (a user belongs to one company), so there is no
  cross-company session state to confuse.

## 3. Demo bypass

The development bypass skips only the emailed code. It applies only when all hold:
1. `NODE_ENV` is not `production`;
2. the demo surface is on;
3. the address is exactly one of the nine personas;
4. the password is correct;
5. the account is ACTIVE and verified, with no platform role;
6. its membership of an `isDemo` company is ACTIVE.

EP40 proved and tightened:

- Production configuration: the persona needs the code, and `/api/v1/demo/personas` is 404.
- Another address, a wrong password, or headers such as `x-demo-bypass`, `x-enable-demo-routes`
  or `x-forwarded-for`: no bypass (`trustProxy` is off).
- **Fail closed (EP40-01, fixed):** with no explicit `NODE_ENV` the demo surface is off even if
  `ENABLE_DEMO_ROUTES=true`, and the demo seed refuses to run.
- The production `.env.example` path: `ENABLE_DEMO_ROUTES` defaults to false in production, and
  the guides never enable it there.

## 4. Revocation and session switching

On the very next request of an open session (EP40 test):
- a DENY exception removes the action;
- removing the working branch means nothing more can be created there. EP40-02 fixed a silent
  move to another branch; the request now asks for a new choice.
- a deactivated membership reaches nothing in the company;
- a suspended account loses the session.

Permission resolution is never cached (EP27).

## 5. Authorization and tenant isolation (sweeps over all 285 routes)

| Sweep | Result |
| --- | --- |
| Anonymous → every non-public route | 401; no 5xx anywhere |
| Second company's owner → every route, with the first company’s real ids for documents, lines, items, customers, suppliers, lots, locations, members and branches | no 2xx on any id route; no first-company id in any response; lists empty |
| Executive → every state-changing route | never 2xx (403 / 400 / 404 / 409) |
| System Admin → every operational route | no operational success; the only 2xx are empty own-record lists and capability contexts (EP40-05) |
| Mass assignment | strict schemas everywhere a body is accepted (`.strict()` on every body schema; non-strict objects are route params and env only); module suites refuse `companyId`, `branchId`, `status`, `number`, `createdBy` / `approvedBy` ids, totals and similar fields; EP40 E2E refused `status`, `lineTotal`, `branchId` on sales orders |
| Branch | cross-branch reads and writes refused; a branch the member lacks cannot be selected; `branchId` in bodies refused; revocation mid-session enforced |

Persona matrix: the effective permissions of the nine personas, read from the running
resolver, are in [DEMO_ACCOUNT_MATRIX.md](DEMO_ACCOUNT_MATRIX.md). Allowed and denied
actions are exercised by the module suites, the EP39 / EP40 real-stack suites and the sweeps.

## 6. Department financial privacy

Sentinel prices were written into the first company's purchase lines (`987654.3219`) and sales
lines (`876543.2109`), and every GET route was scanned per persona:

| Persona | Must not see | Result |
| --- | --- | --- |
| Warehouse, legacy staff | any price, cost, total, discount, deposit, payment (keys or sentinel digits) | clean on every route |
| Sales | purchase prices, deposits | clean |
| Operations | purchase and sales prices | clean |
| Purchasing, Accounting | sales prices | clean |

No response anywhere contains a password hash, token hash, code hash or one-time code.

## 7. Audit and Platform Inspection

The existing suites verify:
- the logs never contain passwords, codes, tokens or session cookies (request bodies are not
  logged; cookie and authorization headers are redacted);
- audit entries carry the actor, company, entity and timestamp;
- Platform Inspection redacts operational details.

In EP40, every fixture and E2E action wrote the actor, the entity and the source document;
movements reference their exact source line. Denied attempts return codes without echoing the
payload.

## 8. Application security

| Check | Result |
| --- | --- |
| SQL injection | Prisma parameters everywhere; the one `$queryRawUnsafe` interpolates only a compile-time table name from a typed union, the id is bound; search strings such as `' OR 1=1 --` and `DROP TABLE` match nothing and break nothing |
| NUL / invalid text | **EP40-03 fixed**: NUL in a path or query was a 500, now `400 INVALID_CHARACTERS`; bodies refuse control characters per field |
| XSS / HTML injection | stored as text, returned as `application/json` with `Content-Security-Policy: default-src 'none'` and `nosniff`; React escapes on render; the only `dangerouslySetInnerHTML` is the static brand SVG |
| Open redirect | `safeNext` allow-lists in-app paths only |
| Prototype pollution | `__proto__` / `constructor` bodies refused (400) |
| Oversized payloads | 1 MiB body limit → 413 |
| Dates / decimals | impossible dates, overflowing and negative decimals, excess precision → 400 |
| Pagination / filters | `pageSize` ≤ 100; unknown filters and sorts refused (strict query schemas) |
| Headers | helmet: CSP `default-src 'none'; frame-ancestors 'none'`, `nosniff`, HSTS (helmet default), no framing |
| CORS | credentials only for the allow-listed origin (tested) |
| Client tokens | none: the session is an HttpOnly cookie; `localStorage` holds only UI preferences and consent |
| Source maps | off in production builds (`sourcemap: false`; none in `dist`) |

## 9. Dependencies

- `npm audit --omit=dev`: **0 vulnerabilities** in the backend and in the frontend (runtime).
- Full tree: 10 moderate, dev-only (ESLint toolchain → `minimatch`). Not reachable at runtime;
  EP40-08 accepts them.

## 10. Secrets and configuration

- No secret is tracked (scan of the diff and of tracked files).
- `.env.example` leaves every password empty.
- The demo passwords live only in the local `.env`.
- The QA launch entries and scratch databases are temporary and removed or restored.
- Backups sit outside the repository (`C:/Users/User/pdabliss_backups`, not tracked).
- No internal URL is exposed in the build.

## 11. Separation of duties

There is no originator ≠ approver rule in any module (EP40-04). This is the documented v1
policy, permission-gated and audited. It is a production release blocker, and a migration-safe
EP41 proposal is in the register.
