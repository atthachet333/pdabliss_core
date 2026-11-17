# EP48.5 O0 — Online Deployment Readiness & Public Access Alignment

**Date:** 2026-11-17 (21:00–21:40). **Planning commit:** `02229c3`.

**Mode:** read-only. Nothing was created, changed, started or stopped: no DNS, Cloudflare, service, database, PM2 or product-code change.

## 1. `core.pdabliss.com` — what serves it today

| Check (public DNS-over-HTTPS, `dns.google`)  | Result                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `core.pdabliss.com` A                        | **NXDOMAIN** (status 3). Authority: SOA `sofia.ns.cloudflare.com. dns.cloudflare.com. 2419871023 …`                       |
| `core.pdabliss.com` AAAA                     | **NXDOMAIN**                                                                                                             |
| `pdabliss.com` NS                            | `sofia.ns.cloudflare.com`, `sterling.ns.cloudflare.com`, so the zone is on Cloudflare                                    |
| `pdabliss.com` A (control query)             | `172.67.129.147`, `104.21.2.191` (Cloudflare-proxied), so the resolver works                                              |

**NXDOMAIN means the name has no record of any type**, including CNAME, and no wildcard covers it. Nothing on the internet resolves or serves `core.pdabliss.com` today. HTTP / HTTPS responses, headers and content identity therefore do not exist: a request cannot reach any server.

**Correction.** The revised plan of 20:45 (`EP48_5_ONLINE_DEPLOYMENT_PLAN.md` §1.1 OO-1 and §7) said "something already answers at `core.pdabliss.com`". That was **wrong**. The fetch tool's failure on a name that does not resolve was misread as a `robots.txt` refusal. Both places are corrected in the plan, with this note.

**Not determinable from outside (dashboard-only, read-only checks for the owner, §6):**
- whether a dormant configuration already names the hostname: a tunnel public hostname whose DNS record was deleted, an Access application, a Workers route, a Pages custom domain, or a redirect / WAF rule;
- certificate-transparency history (crt.sh was not reachable from this workspace).

A dormant **Workers route** or **Access application** would take effect the moment a DNS record exists, so these must be checked before cutover.

**Verdict:**
- The hostname is **unassigned and available**. It is not owned by another live project.
- **Cutover status: CONDITIONAL.** It may be used once the owner's dashboard check (§6) finds no dormant configuration naming it. If any is found and its owner is unclear, the hostname is **BLOCKED** for cutover.

## 2. Host facts (latest elevated collector, `ops-logs/ep48_5-host-audit/20261117-162554`, 16:25–16:29)

| Item                                   | Result                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Ports 1311 / 1312 / 5433 (and 1411 / 1412 / 5434 / 55443) | **not listening**, no UDP, outside excluded ranges, no firewall rule, no local tunnel config. Re-checked at O2.        |
| Existing tunnels                       | `Cloudflared` and `CloudflaredS2A`, both LocalSystem, Automatic, `tunnel run --token-file …` (remotely managed; their ingress is in the dashboard and cannot be read on the host) |
| `cloudflared` metrics ports in use     | 127.0.0.1:20241, 127.0.0.1:20242. **20243 is free**, for the CORE connector.                                                               |
| `--token-file` support                 | yes: the installed binary already runs both services with it                                                                               |
| Adding a dedicated tunnel              | **Additive.** A new tunnel object plus its own connector service and its own token file. No edit to either existing tunnel, its ingress or its service. |

## 3. Product behaviour in production mode (code read at `cb21be1`, unchanged; no assumption without a code reference)

| Area                             | Verified behaviour                                                                                                                                                                                                                                                                                                                                         | Code                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Production env                   | Requires `DATABASE_URL`, `PUBLIC_APP_URL`, `AUTH_SECRET`, `SMTP_HOST`. Refuses `MAIL_TRANSPORT=dev` and the development secret. Demo routes default **off**.                                                                                                                                                                                              | `config/env.ts`                                                         |
| SMTP                             | `nodemailer`. With `SMTP_SECURE=false` it sets **`requireTLS`** (STARTTLS mandatory, never clear text). `SMTP_SECURE=true` means implicit TLS (465). Auth is optional. The sender defaults to `PDA BLISS CORE <notify@pdabliss.com>`.                                                                                                                    | `mail/mailer.ts`                                                        |
| Mail the app sends               | e-mail verification (sign-up), sign-in codes (**platform accounts on every sign-in; customers on a new browser**, trusted device 90 days), step-up codes, password reset (30 min, 3 / h), password changed, existing-account notice, invitations (7 days)                                                                                                 | `auth/service.ts`, `auth/policy.ts`                                     |
| Cookies                          | Production: names `__Host-core_sid` / `__Host-core_device` / `__Host-core_pending`; `HttpOnly`, **`Secure`**, `SameSite=Lax`, `Path=/`, no `Domain`. `Secure` is set regardless of the tunnel's plain-HTTP hop to 127.0.0.1, and the browser sees HTTPS.                                                                                                  | `auth/http.ts`                                                          |
| Cross-site protection            | Every state-changing `/api` request: an `Origin` outside `CORS_ORIGINS` is refused; a request carrying a CORE cookie **must** carry an allowed `Origin`; JSON bodies only (forces a CORS preflight)                                                                                                                                                       | `auth/http.ts` `originCheck`, `app.ts`                                  |
| Login / logout                   | Password, then a code (as above). Unverified, suspended or disabled accounts are refused. Logout / logout-all / per-session revoke require a session. Sessions: customers 7 days idle / 30 days absolute; platform 30 min idle / 12 h absolute; rotation every 12 h.                                                                                        | `routes/v1/auth.ts`, `auth/policy.ts`                                   |
| Brute force / rate limits        | Global 300 / min per IP. Per-IP auth limits (login 60 / 5 min, register 10 / 15 min, forgot 5 / 15 min, …). **Per-account** login failure throttle: 10 failures / 15 min, then 429. A code allows 5 tries, then it locks. 10 challenges per account per hour.                                                                                              | `auth/policy.ts`, `auth/service.ts`, `auth/otp.ts`                      |
| Client IP behind the tunnel      | `TRUST_PROXY=loopback` makes the client address come from `X-Forwarded-For` set by the Cloudflare edge (the connector is on 127.0.0.1). Without it, every request looks like 127.0.0.1: one shared rate limit and a wrong audit trail. Production logs a warning if it is unset. "Trust all" is refused by the schema.                                       | `config/env.ts`, `app.ts`                                               |
| Route protection                 | Every data route file installs `requireSession` as a plugin **pre-handler before its first route**: account, company, dashboards, executive, master-data, operations, production, purchase-orders, purchase-requests, sales, warehouse. Platform routes use `requirePlatform`; owner / step-up for sensitive ones. Company data also needs `requireCompanyAccess` (active membership **and** an active company + subscription) and permission checks. EP48 tests include `auth-security`, `ep40-security` and `permissions`. | `routes/v1/*.ts`, `company/context.ts`, `permissions/guard.ts`          |
| Unauthenticated API              | `GET /api/v1/` (service info), `GET /api/v1/packages` (public catalog), and the auth endpoints (register, verify-email, verification/resend, login, login/otp, password forgot / reset, invitation accept), all rate-limited. `/health` and `/health/ready` sit outside `/api`.                                                                              | `routes/v1/index.ts`, `routes/v1/auth.ts`, `routes/health.ts`           |
| Demo surface                     | Production: no `/api/v1/demo/*`, no `/demo/personas`, **no sign-in bypass** (`demoBypassEnabled` requires non-production). The demo seed **refuses** `NODE_ENV=production`. The platform bootstrap (`dist/cli/seed.js`, no `--demo`) is allowed in production.                                                                                           | `routes/v1/index.ts`, `auth/demo-bypass.ts`, `auth/bootstrap.ts`, `cli/seed.ts` |
| Self-registration                | **Public and not configurable.** `POST /api/v1/auth/register` creates an account and e-mails a verification link to **any** address (cooldown 1 min, 10 / day per account, 10 / 15 min per IP). A verified user can choose a package and create a company. That company is `PENDING_SUBSCRIPTION` and **cannot enter CORE**.                              | `routes/v1/auth.ts`, `company/service.ts`, `company/context.ts`         |
| Activation                       | The payment-free activation route exists **only outside production** and is not registered in production. There is no payment provider, so in production **no company can be activated**: strangers cannot reach company data. The demo company is active only because the seed creates it so.                                                          | `routes/v1/platform.ts`, `company/service.ts`                           |
| API security headers             | `@fastify/helmet` with `default-src 'none'; frame-ancestors 'none'` on API responses. Log redaction of `authorization`, `cookie`, `set-cookie`.                                                                                                                                                                                                         | `app.ts`                                                                |
| Frontend                         | A public marketing site (`/`, `/en/…`, `/zh/…`; its `robots.txt` allows indexing), `/login`, `/register`, account pages, `/platform*` (operator UI), `/company/*`, `/core/*`. Page code is public JavaScript; **all data comes from the authenticated API**. Served today by the web launcher through Vite `preview()`.                                       | `frontend/src/app/router.tsx`, `ops/ep48_5/web-launcher.mjs`            |

## 4. Mail for `pdabliss.com` (public DNS)

| Record                                 | Value                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------- |
| MX                                     | `mx1.hostinger.com` (5), `mx2.hostinger.com` (10)                           |
| SPF                                    | `v=spf1 include:_spf.mail.hostinger.com ~all`                               |
| DMARC                                  | `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s;` (**strict, reject**)       |
| DKIM `hostingermail1._domainkey`       | published (`v=DKIM1`)                                                       |

**Consequence:**
- Mail `From: …@pdabliss.com` that does **not** leave through Hostinger with `d=pdabliss.com` DKIM is **rejected** by receivers (`p=reject`, strict alignment).
- CORE must send through **Hostinger SMTP** with a real `pdabliss.com` mailbox.

## 5. Findings that block public login (mandatory before public exposure)

| #   | Blocker                                                                                                                                                                         | Resolution (no product-code change)                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | Public self-registration cannot be switched off by configuration. It creates accounts and sends verification mail from `notify@pdabliss.com` to arbitrary addresses (mail-abuse and sender-reputation risk). It also presents a commercial onboarding flow. | **Block at the edge** for this hostname: `/api/v1/auth/register`, `/api/v1/auth/verification/resend` and the `/register` page get a `404` from the CORE tunnel's ingress (`http_status:404`), or a hostname-scoped WAF rule if the dashboard cannot set it. The code-level switch is EP48.6. |
| B2  | The admin surface (`/platform*`, `/api/v1/platform/*`) would be reachable for sign-in attempts from the whole internet.                                                          | A **path-scoped Cloudflare Access application** for these paths (named operators only), **in addition** to CORE's platform login (code on every sign-in, 30 min idle). This keeps administration non-public.                                                                |
| B3  | The web is served by Vite `preview()`, which Vite documents as **not a production server**.                                                                                      | O1: a small hardened static server in `ops/ep48_5` for the online profile:<br>• fixed `dist` root;<br>• no listing or traversal;<br>• SPA fallback;<br>• security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS for this host only);<br>• `X-Robots-Tag` per OD.<br>Same constant 127.0.0.1 bind, post-bind proof and self-probe. |
| B4  | SMTP is not configured; production mode cannot start without it.                                                                                                                 | Hostinger mailbox `notify@pdabliss.com` and its credential (§4); an outbound TCP check to `smtp.hostinger.com:587` from the host at O0b                                                                                                                                  |
| B5  | Tooling not implemented or verified on Windows:<br>• online launcher profile;<br>• the production-identity fix (CORE's own cluster / connector must not be read as production, M9);<br>• harness P1–P12 not yet run on `5e1488c`+. | O1 amendment + Windows harness                                                                                                                                                                                                                                            |
| B6  | Dormant hostname configuration not yet ruled out (§1)                                                                                                                            | O0b dashboard check by the owner                                                                                                                                                                                                                                          |

## 6. O0b — owner's read-only checks still needed (no change)

**Cloudflare dashboard (view only):**
1. DNS → filter `core`: confirm there is no record (consistent with NXDOMAIN).
2. Zero Trust → Access → Applications: search `core.pdabliss.com` and `*.pdabliss.com`. List any that match.
3. Zero Trust → Networks → Tunnels: for `Cloudflared` and `CloudflaredS2A`, open Public hostnames and confirm none names `core.pdabliss.com`.
4. Workers & Pages: routes on `pdabliss.com` matching `core.pdabliss.com/*` or `*.pdabliss.com/*`; Pages custom domains.
5. Rules (redirect / configuration / transform / WAF custom): any expression mentioning `core.pdabliss.com` or all subdomains.
6. SSL/TLS: "Always Use HTTPS", HSTS and minimum TLS version for the zone (read only).
7. Public-hostname service types: confirm `HTTP_STATUS` is offered (for B1); otherwise B1 uses a hostname-scoped WAF rule.

**Browser:** `https://crt.sh/?q=core.pdabliss.com` (certificate history).

**Host, elevated PowerShell (read-only):**
```powershell
Resolve-DnsName core.pdabliss.com -ErrorAction SilentlyContinue
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -in 1311,1312,5433,20243
Test-NetConnection smtp.hostinger.com -Port 587 | Select-Object ComputerName, RemotePort, TcpTestSucceeded
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' --version
```
