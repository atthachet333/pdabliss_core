# Company Control Center (EP25, deepened in EP26 and EP27; Master Data in EP28)

The customer side of company administration in PDA BLISS CORE. It sits between the Account Portal
and CORE Operations:

```
PUBLIC → ACCOUNT (/account) → COMPANY CONTROL CENTER (/company) → BRANCH CONTEXT (/core/branch) → CORE OPERATIONS (/core)
```

It is separate from the Account Portal (the person: profile, devices, onboarding), the Platform
Control Center (PDA BLISS's operators, `/platform`) and the department workspaces (later episodes).
Visually it is a sibling of the Platform Control Center — teal operational line and the company's
own identity instead of the platform's gold authority line.

## 1. Who lands where

| Signed-in identity | Home | May also open |
| --- | --- | --- |
| Platform Owner / Admin | `/platform` | — (customer routes redirect to `/platform`; customer APIs answer 403) |
| Active member of an ACTIVE company with an ACTIVE subscription | `/company` | `/core`, `/account` |
| No company yet, company pending activation, suspended / closed, or membership deactivated | `/account` | — |

`homeFor()` / `areasFor()` (`frontend/src/features/auth/session.ts`) decide what to *render* from
`GET /auth/me` (`company.canEnterCore`, `company.memberStatus`). The API re-checks the same facts on
every request (`requireCompanyAccess()`, `backend/src/company/context.ts`). A department is never
the landing page.

## 2. Areas

| Route | Shows | Who |
| --- | --- | --- |
| `/company` | company, package (no price), enabled departments, active branches / people / open invitations, setup checklist, what needs attention, Enter CORE | every active member (attention + setup: Owner / System Admin) |
| `/company/profile` | display / legal / English name, tax ID, registration no., phone, website, contact email, business type, Head Office address, logo | read: everyone · edit: Owner, System Admin |
| `/company/branches` | all branches; create, edit, deactivate / reactivate | read: everyone · manage: Owner, System Admin |
| `/company/users` | members, open invitations, invite, role / job title / department assignment, deactivate / reactivate | read: Owner, System Admin, Executive · manage: Owner, System Admin |
| `/company/departments` | six departments, package state, assignments, enable / disable | read: everyone · manage: Owner, System Admin |
| `/company/subscription` | package facts, status, cycle, price, period, entitlements, branches; "Contact PDA BLISS" | Owner, System Admin, Executive |
| `/company/security` | administration events + members' sign-in / security events (no IPs) | Owner, System Admin |
| `/company/permissions` (EP27) | role profiles (read only) and per-member permission exceptions | Owner, System Admin |
| `/company/master-data/*` (EP28) | customers, suppliers, items, units, categories, warehouse locations — lists, records, create / edit / deactivate | anyone holding a master-data view code; manage per [OPERATIONAL_MASTER_DATA.md](OPERATIONAL_MASTER_DATA.md) §7 (Owner / System Admin everything) |
| `/company/settings` | company time zone, default language; closure note | Owner, System Admin |
| `/core/branch` | branch selector | active members |
| `/core` | CORE Operations entry: selected branch, permitted departments | active members |

Navigation lists only areas the person may open (EP27: their effective permission codes from the
server, `overview.me.permissions`). A page outside the
role shows "Your role cannot open this page"; the API refuses it regardless.

## 3. Roles (permissions: `backend/src/permissions/catalog.ts`; invariants: `backend/src/company/policy.ts`)

EP27 renamed the EP25 capabilities to catalog permission codes (same grants, role-bound — see
[PERMISSION_ACTION_MATRIX.md](PERMISSION_ACTION_MATRIX.md)):

| Permission | Owner | System Admin | Executive | Dept. Manager / Staff / Viewer |
| --- | --- | --- | --- | --- |
| company.profile.view, company.branches.view | ✓ | ✓ | ✓ | ✓ |
| company.profile.edit, company.branches.manage, company.departments.manage, company.settings.manage | ✓ | ✓ | — | — |
| company.members.view | ✓ | ✓ | ✓ | — |
| company.members.manage (invite, role, job title, departments, deactivate) | ✓ | ✓ (limits below) | — | — |
| company.subscription.view (incl. price) | ✓ | ✓ | ✓ | — |
| company.activity.view | ✓ | ✓ | — | — |
| company.permissions.view / .manage (EP27) | ✓ | ✓ (limits below) | — | — |

**Assignable roles:** Owner → System Admin, Executive, Department Manager, Department Staff,
Viewer. System Admin → Executive, Department Manager, Department Staff, Viewer. `COMPANY_OWNER`
is never a value the API accepts (400).

**Owner protection (API + database):**

- Nobody demotes, deactivates, edits the departments of, or replaces the Company Owner
  (`OWNER_PROTECTED`). Ownership transfer is a future, separate, audited flow — not in EP25.
- Nobody changes their own access (`SELF_CHANGE`); a System Admin cannot change another System
  Admin (`PEER_ADMIN`) or create one (`ROLE_NOT_ASSIGNABLE`).
- Database: one owner per company (unique owner slot + CHECK, EP24); the owner is always ACTIVE
  (`CompanyMember_owner_active_check`, EP25). Role updates also filter `ownerSlot IS NULL`.

**Executive** is a business role: broad reading (people, package), no configuration. It is not a
System Admin and not a platform role. **Department roles** get the overview and the way into CORE —
no profile, branch, user or subscription administration.

## 4. Company profile and logo

`PATCH /api/v1/company/current/profile` (strict schema): only changed fields are written and the
changed field names are audited (`COMPANY_PROFILE_UPDATED`). Optional fields clear with `null`.
Phone → E.164; website → http(s) only (no `javascript:` / `data:`); Thai tax ID checksum when the
Head Office is in Thailand. `status`, `plan`, `isDemo`, ids → 400. Older companies keep `NULL`
("Not set") — nothing is invented.

**Logo storage boundary.** `CompanyLogo` holds the bytes in PostgreSQL (one row per company), not
on disk: no paths, no public bucket, no traversal, nothing executable. Upload is JSON base64
(the API accepts no multipart), PNG / JPEG / WebP only — the leading bytes must match the declared
type (SVG refused: it can carry script) — at most 256 KB, 20 uploads / 15 min per IP.
`GET /api/v1/company/current/logo` serves it to the company's members with its stored type,
`nosniff`, `default-src 'none'`, `Cross-Origin-Resource-Policy: same-site`, a SHA-256 ETag and
`private` caching. No logo → initials. When an object store arrives, only `CompanyLogo.data`
moves; the API contract stays.

## 5. Branches and the Head Office

- Exactly one Head Office per company, code `00000` (unique slot + CHECK, EP24). Its name,
  address and phone can change (also from the profile page); it can never be deactivated or
  removed (`HEAD_OFFICE_PROTECTED`; CHECK `Branch_headOffice_active_check`).
- Other branches: 5-digit codes ≠ `00000`, unique per company (server check under a company row
  lock + unique index → `BRANCH_CODE_TAKEN`). Leave the code empty to take the next free one.
  The code is fixed once created (documents will reference it).
- Status: `ACTIVE` ⇄ `INACTIVE` (deactivate / reactivate). `CLOSED` stays platform-controlled.
  There is no delete endpoint. Deactivating clears every session's branch context in that branch.
- **EP26:** a dense code-first branch list, a branch detail page (`/company/branches/:id`: identity,
  address, contact, edit, status, branch access, departments present) — see
  [BRANCH_USER_ADMINISTRATION.md](BRANCH_USER_ADMINISTRATION.md).

## 6. People, invitations, department assignment

- One human = one `User`. Membership (`CompanyMember`) has `role`, `status` (ACTIVE /
  DEACTIVATED — soft; the account and history stay), `jobTitle`. v1 rule: one company per account.
- **Invitations** reuse the EP23 foundation: 256-bit random token, SHA-256 stored, link with
  `#token=` (never sent to a server in a Referer), 7-day expiry, single use (conditional update in
  the accepting transaction), bound to the invitee email and company, inviter recorded, revocable.
  Acceptance creates the membership in the same transaction; an existing account joins without a
  second `User`; an account already in another company is refused clearly (`ALREADY_IN_COMPANY`)
  — but creating the invitation never reveals that. Someone already in *this* company → 409
  `ALREADY_MEMBER`. Limits: 30 invites / 15 min per IP, 50 per company per day.
- **Email**: CORE transactional layout, in the chosen language (default: company language):
  company, inviter, role, real expiry in the company time zone, one Accept button, "if you do not
  know this company, do nothing".
- **Department assignment** = `Membership` (user × department, optional `isPrimary`; `roleId`
  optional until EP27). Only enabled departments can be assigned; assignments to a soft-disabled
  department are kept untouched.
- **EP26:** server-side search / filters / paging, a member page (`/company/users/:id`), branch
  access per member (All branches / Selected branches), invitation intent (role, departments,
  branches — re-validated at acceptance), the invitation lifecycle page with resend (new token, old
  link dead) and revoke. Details: [BRANCH_USER_ADMINISTRATION.md](BRANCH_USER_ADMINISTRATION.md).

## 7. Departments

`PUT /api/v1/company/current/departments` sets the enabled set within the subscription snapshot
(Starter ≤ 2, no Executive · Business ≤ 4 · Professional 6 · Enterprise as agreed, ≤ 6), at least
one, under a company row lock. Disabling is soft (`Department.isActive = false`), audited
(`DEPARTMENT_ENABLED` / `DEPARTMENT_DISABLED`) and keeps assignments. The hook for future
dependency checks ("this department still has open documents") is marked in
`CompanyControlService.setDepartments`; EP25 has no operational data. The Warehouse rule (never
price, cost, margin, payment information, supplier financial terms) is restated on the page and is
not weakened: department staff do not even receive the subscription price (`priceVisible: false`).

## 8. Subscription, activity, settings

- **Subscription**: facts only. No invoices, receipts, cards or payment history exist, so none are
  shown; no checkout; changes → "Contact PDA BLISS" (`/contact`).
- **Activity**: the company's AuditLog plus members' sign-in / security events since they joined.
  No IP addresses, user agents, hashes or tokens; operators appear as "PDA BLISS".
- **Settings**: time zone (IANA, validated) and default language (th / en / zh-CN). Closing the
  company or deleting data is not self-service.

## 9. Branch context and CORE Operations

- `GET /api/v1/company/context` → the active branches **this person may work in** (EP26 branch
  access), the selected one, `needsSelection`, `scope`, `blocked` (`NO_BRANCH_ACCESS` when none),
  and the departments this person may open. One allowed branch → selected automatically. A stored
  branch that is no longer valid (another company, deactivated, access removed) is dropped.
- `POST /api/v1/company/context/branch {branchId}` → only an ACTIVE branch of the caller's own
  company that the caller may work in (`403 BRANCH_NOT_ALLOWED` otherwise); stored on the server-side **session** (`Session.branchId`), never trusted from the
  client afterwards.
- `requireOperationsContext()` is the gate for every future operational API: active member,
  eligible company, a selected still-active branch of that company, and `departments` =
  enabled ∩ permitted (`departmentAccess()`: Owner → all enabled; Executive → Executive + assigned;
  everyone else, System Admin included → assigned). `GET /api/v1/operations/context` exposes it.
- `/core` shows the selected branch and permitted departments; workspaces are named as coming in a
  later phase. No business figures.
- **EP27:** CORE departments are those whose `<dept>.workspace.view` the person effectively holds;
  the context and the operations context carry the effective `permissions`, and every operational
  route goes through `requirePermission()`.

## 10. Audit actions (AuditLog, `actorScope: customer`)

`COMPANY_PROFILE_UPDATED`, `COMPANY_LOGO_UPDATED`, `COMPANY_LOGO_REMOVED`,
`COMPANY_SETTINGS_UPDATED`, `BRANCH_CREATED`, `BRANCH_UPDATED`, `BRANCH_STATUS_CHANGED`,
`INVITATION_SENT`, `INVITATION_REVOKED`, `INVITATION_ACCEPTED`, `MEMBER_ROLE_CHANGED`,
`MEMBER_STATUS_CHANGED`, `MEMBER_JOB_TITLE_CHANGED`, `MEMBER_DEPARTMENTS_CHANGED`,
`DEPARTMENT_ENABLED`, `DEPARTMENT_DISABLED`; EP26 adds `MEMBER_BRANCH_ACCESS_CHANGED` and
`INVITATION_RESENT`; EP27 adds `MEMBER_PERMISSION_OVERRIDE_ADDED` / `_CHANGED` / `_REMOVED`;
EP28 adds the master-data events (`CUSTOMER_*`, `SUPPLIER_*`, `ITEM_*`, `UNIT_*`,
`ITEM_CATEGORY_*`, `LOCATION_*` created / updated / deactivated / reactivated, and
`ITEM_STRUCTURE_CHANGED`) with code, name and field names only — Platform Inspection shows that
they happened, never their details. Details: field names, codes, roles, from → to, the
invitee email — never tokens, passwords or file bytes. EP23 auth events for invitations remain.

## 11. API summary (`/api/v1`, session required, no company id anywhere)

| Method | Path |
| --- | --- |
| GET | `/company/control` |
| PATCH | `/company/current/profile` |
| GET · PUT · DELETE | `/company/current/logo` |
| GET · POST | `/company/current/branches` |
| GET · PATCH | `/company/current/branches/:id` |
| POST | `/company/current/branches/:id/deactivate` · `/reactivate` |
| GET | `/company/current/branches/:id/detail` (EP26) |
| GET | `/company/current/members?q=&role=&status=&department=&branch=&page=&pageSize=` |
| GET · PATCH | `/company/current/members/:id` (GET: EP26) |
| PUT | `/company/current/members/:id/branches` (EP26) |
| POST | `/company/current/members/:id/deactivate` · `/reactivate` |
| PUT | `/company/current/members/:id/departments` |
| POST | `/company/invitations` · `/company/invitations/:id/resend` (EP26) · `/company/invitations/:id/revoke` |
| GET | `/company/current/invitations?state=` (EP26) |
| GET | `/company/current/permissions` (EP27) |
| GET · PUT | `/company/current/members/:id/permissions` (EP27) |
| GET · PUT | `/company/current/departments` |
| GET | `/company/current/subscription` |
| GET · PATCH | `/company/current/settings` |
| GET | `/company/current/activity?scope=all\|admin\|security&limit=` |
| GET · POST | `/company/context` · `/company/context/branch` |
| GET | `/operations/context` |
| GET | `/operations/workspaces/:department` · `/operations/authorize?permission=` (EP27) |
| GET · POST · PATCH · PUT | `/master-data/…` (EP28) — see [OPERATIONAL_MASTER_DATA.md](OPERATIONAL_MASTER_DATA.md) §11 |

## 12. Known limitations

- Ownership transfer, member removal (hard), company closure and plan changes are not
  self-service.
- One company per account (v1). Branch access (who may work in which branch) exists since EP26;
  what each role may *do* inside a department and branch is the EP27 action matrix
  ([PERMISSION_ACTION_MATRIX.md](PERMISSION_ACTION_MATRIX.md)).
- Field-level / row-level rules and record approval workflows are not part of EP27 (they come with
  the modules and the workflow / approval episodes).
- Logo bytes live in PostgreSQL until an object store exists.
- In-app navigation keeps the language in router state; a full page load uses the account's saved
  language (as in the Account Portal and Platform Control Center).
