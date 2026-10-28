# EP25 — Company Control Center Foundation

Status: **completed locally, awaiting owner review. NOT PUSHED.** Reference:
[COMPANY_CONTROL_CENTER.md](COMPANY_CONTROL_CENTER.md).

## 1. Baseline

`main` clean at `b9a637a` (EP24.1.3), identical to `origin/main` — EP24.1.3 was already pushed.
Baseline gates: backend 16 files / 211 tests, frontend 40 files / 940 tests.

## 2. What EP25 adds

```
PUBLIC → ACCOUNT → COMPANY CONTROL CENTER (/company) → BRANCH CONTEXT (/core/branch) → CORE OPERATIONS (/core)
```

- **Company Control Center** (`/company/*`, one lazy chunk): Overview, Company (profile + logo),
  Branches, Users (members, invitations, assignment), Departments, Subscription, Security, Settings,
  Enter CORE. Teal operational identity; the company's logo / initials and the person's role in the
  bar — related to `/platform` (gold authority) but not a copy.
- **Routing:** an active member of an ACTIVE company + subscription lands on `/company`; no
  company / pending / suspended / deactivated → Account Portal; platform operators → `/platform`.
  Never straight into a department.
- **Role policy** (`backend/src/company/policy.ts`), **company context / branch context /
  operations gate** (`backend/src/company/context.ts`), **Control Center service**
  (`backend/src/company/control.ts`), invitations completed on the EP23 service.
- **CORE Operations entry**: server-side branch selection (session), permitted departments only,
  workspaces honestly "in a later phase", no business figures.

## 3. Highlights by area

| Area | Result |
| --- | --- |
| Overview | company, package (no price), enabled departments n / max, active branches, active people, open invitations, setup checklist (profile / logo optional / team / departments staffed), what needs attention (profile gaps, only-owner, unassigned departments, pending / expired invitations, period ending), Enter CORE — all from real rows |
| Profile | display / legal / English name, tax ID (Thai checksum), registration no., phone (E.164), website (http(s) only), contact email, business type, Head Office address; changed fields only; legacy `NULL` shown as "Not set" |
| Logo | DB-stored (`CompanyLogo`), PNG / JPEG / WebP by leading bytes, ≤ 256 KB, SVG refused, nosniff + CORP same-site + ETag; initials fallback; storage boundary documented |
| Head Office | `00000`, exactly one, editable details, never deactivated / deleted (API + new CHECK) |
| Branches | list, create (code auto or explicit, 5 digits, unique per company under a row lock + unique index), edit (code fixed), deactivate / reactivate (clears session branch context), no delete endpoint |
| Users | full name, email, phone, job title, role, status, joined, last sign-in, departments; server-computed `canManage`; deactivate / reactivate (soft) |
| Invitations | EP23 foundation completed: 256-bit token hashed, `#token=` link, 7 days, single use, email-bound, inviter, locale; company audit; `ALREADY_MEMBER`; acceptance transactional, no duplicate `User`, `ALREADY_IN_COMPANY` at acceptance only (no cross-company enumeration); 30 / 15 min per IP + 50 / company / day |
| Roles | Owner / System Admin administer; Executive reads (people, package); department roles: overview + CORE only |
| Owner protection | no demotion, deactivation, department edit, replacement or invitation as owner (`OWNER_PROTECTED`, `COMPANY_OWNER` → 400); no self-change; System Admin cannot touch or create System Admins; DB CHECK: owner always ACTIVE |
| Departments | six shown with package state; enable / disable within the snapshot (Starter ≤ 2 no Executive, Business ≤ 4, Professional 6, Enterprise ≤ 6) under a row lock, ≥ 1, soft-disable, audited; dependency-check hook marked for later |
| Assignment foundation | `Membership` = user × department (+ primary), `roleId` optional until EP27; only enabled departments assignable; disabled-department assignments kept |
| Subscription | package, status, cycle, price (allowed roles), period, entitlements, all branches, Lot/Expiry/FEFO; no invoices / checkout — "Contact PDA BLISS"; department roles never receive the price (`priceVisible: false`, also on `GET /company/current`) |
| Security / activity | company AuditLog + members' sign-in / security events since joining; no IPs / UAs; operators shown as "PDA BLISS" |
| Settings | company time zone (IANA-validated) and default language (drives invitation emails); closure is not self-service |
| Branch selector | Head Office + active branches with name, code, address; one branch → automatic |
| Branch context | `Session.branchId`, set only to an ACTIVE branch of the caller's company, re-validated on every request, dropped when invalid |
| CORE entry | `requireOperationsContext()` + `GET /api/v1/operations/context`: enabled ∩ permitted departments (Owner all; Executive + Executive dept.; others — System Admin included — assigned) |
| Isolation / IDOR | no company id in any request; branch / member / invitation ids looked up inside the caller's company (404 otherwise); strict schemas refuse server-owned fields; platform operators 403 on customer routes |
| Audit | 16 new AuditLog actions (see reference §10); no secrets in details |

## 4. Database

Migration `20261028090000_ep25_company_control_center` (additive): Company profile columns +
`defaultLocale`; `CompanyLogo`; `BranchStatus.INACTIVE` + `Branch.deactivatedAt`;
`CompanyMemberStatus` + `CompanyMember.status / jobTitle / deactivatedAt`; `Membership.roleId`
nullable + index; `Invitation.locale`; `Session.branchId / branchSelectedAt`; hand-written CHECKs
(owner always active, deactivation timestamp pairs with status, Head Office always active).

- **Fresh DB:** `migrate deploy` (6 migrations) → seed: owner, admin, demo company, Head Office,
  branch 00001, subscription, four identities, staff → Warehouse. Second run: all `unchanged`.
- **EP24.1 → EP25 upgrade** on a copy of the development database (dump restored into a scratch
  cluster; the original untouched): 17 counts identical before / after (6 users, 6 credentials,
  4 sessions, 19 auth events, 1 company, 4 members, 1 branch, 6 departments, 1 subscription,
  5 audit rows, 2 platform roles, 1 owner, 1 Head Office); members default ACTIVE, profile fields
  stay NULL. Seed then adds branch 00001 + one assignment; second run `unchanged`.
- `prisma migrate diff` after the migration: empty.

**Demo seed (dev / test only):** one extra branch `00001` (illustrative address) and the demo staff
assigned to Warehouse (primary) — only if they have no assignment. No operational data.

## 5. Verification

### Backend — 17 files / 232 tests (+21)

New `test/company-control.test.ts` (18): overview per role; closed to pending companies,
deactivated members and operators; profile authorization + mass assignment + invalid tax ID /
`javascript:` website; logo bytes / type / size / isolation; branch create / codes / uniqueness /
Head Office protection / no delete / DB CHECK / IDOR on every verb; member list privacy; owner
protection (API + DB); role / job title / deactivate / reactivate + audit + IDOR; invitations
(existing user, no duplicate user, token never stored or logged, single use, expiry, roles,
smuggled company id, cross-company revoke); daily cap; departments (Professional / Starter /
Business limits, soft disable, Executive not in package); multi-department assignment →
CORE access; subscription visibility; activity safety; settings + invitation language; branch
context (auto, choose, foreign branch, deactivated branch); platform inspection. Updated: invitation
suite (active company, `ALREADY_MEMBER`), mail templates (inviter / role / expiry / ignore),
seed. Gates on a clean `npm ci` export: typecheck, lint, format, Prisma validate, build, tests.

### Frontend — 41 files / 954 tests (+14)

New `company-center.test.tsx`: routing (`homeFor`, `destinationFor`, `safeNext`); pending owner and
operator redirects; owner overview (package, attention, setup, initials, nav, no price); staff
view; not-available state; TH / EN / ZH without Thai leakage; people (owner protected, assignable
roles, invite body = email / role / locale only, server refusal shown); departments guidance + save
body; subscription honesty; profile read-only vs changed-fields-only; branch selector → server →
permitted departments; single branch / no departments. Gates on a clean `npm ci` export:
typecheck, lint, format, tests, build + prerender (105 pages + 3 shells, verified), perf.
One existing Explorer test (untouched by EP25) timed out once under full-suite load, passed 3/3 alone
and in the full rerun — noted as timing-sensitive.

**Performance:** both areas are lazy chunks (Control Center ≈ 57 KiB raw, CORE entry ≈ 10 KiB,
copy ≈ 23 KiB). Initial JS 184.0 → 184.5 KiB gzip (route entries + sign-in destination rules);
public page budgets unchanged. **The all-JS raw cap was raised 4,100 → 4,300 KiB** (total 4,103)
with the reason recorded in [PERFORMANCE.md](PERFORMANCE.md) — *approved by the owner (2026-10-28)*.

### Real-stack QA (browser → Vite → API → scratch PostgreSQL, dev mail sink)

Separate ports (app 1211, API 1212) so the running development servers and database were never
touched; throwaway credentials; no real email.

| Run | Chrome | Edge |
| --- | --- | --- |
| A. Customer path: Register → verify → sign in → package → company → pending (`/company` → `/account`) → Platform Owner development activation → Account Portal → Control Center → profile + logo (+ SVG refused) → branch 00001 → invite (email content checked) → departments 3 / 4 → invitee registers, verifies, accepts (reuse → 410) → assignment → owner chooses Head Office → CORE (Sales, Warehouse, Purchasing) → staff chooses 00001 → CORE (Warehouse) → server context = 00001, foreign branch 404, staff admin API 403 → activity shows every action, no IPs → EN / ZH on 6 pages without Thai | 65 / 65 | 65 / 65 |
| B. Roles + layout: demo Owner (8 areas; 8 pages × 320 / 375 / 390 / 430 / 768 / 1024 / 1440 / 1920: no overflow, one h1; targets ≥ 24 px at 320 / 1440; axe WCAG 2.0–2.2 A/AA + best practice at 390 / 1440 / 1920 on 6 pages), keyboard (skip link first, visible focus), reduced motion; System Admin (owner un-manageable; demote / deactivate / replace owner / create admin refused); Executive (no Security / Settings, read-only profile, no invite, department change 403, CORE → Executive); Staff (users closed, never the price, selector + CORE → Warehouse, layout + axe); Platform Admin (overview, inspection, customer API 403); public / auth smoke | 231 / 231 | 231 / 231 |

Defects found in QA and fixed: two small text links under 24 px as flex items; the CORE "working
branch" pill overflowing at 320 px with a long Thai branch name; the branch shown twice in the CORE
bar on phones; the language lost on the `/core` → `/core/branch` redirect.
**Firefox:** not run — Playwright Firefox still cannot start on this Windows build (`spawn UNKNOWN`,
as in EP24). Safari / real devices not available.

### Regression

Public site unchanged (no public content edits; freeze tests, prerender and public budgets pass).
Auth: login, verification, code, reset, demo dev-only bypass and Platform auth unchanged (all EP23 /
EP24 suites pass; real-stack sign-ins exercised). Platform: overview, explorer, inspection,
development activation re-verified; inspection now also shows membership status and job title.

### Secret scan

Changeset scanned for `.env`, SMTP / Resend keys, `AUTH_SECRET`, DB URLs with passwords, private
keys, invitation tokens and passwords: none. Only `.env.example` files are tracked. QA credentials,
the dev-DB dump and mail sink live in the session scratch directory only.

## 6. Known limitations

See [COMPANY_CONTROL_CENTER.md §12](COMPANY_CONTROL_CENTER.md#12-known-limitations): no ownership
transfer, hard removal, closure or plan change self-service; one company per account; no
branch-scoped permissions yet; department permissions are EP27; logo bytes in PostgreSQL; signed-in
pages fall back to the account language on a full reload.

## 7. Status

- **Commit:** `feat: establish CORE company control center foundation (EP25)` — local only.
- **Push status:** NOT PUSHED.
- **EP26:** NOT STARTED.
