# Branch & User Administration (EP26)

EP26 deepens the Company Control Center ([COMPANY_CONTROL_CENTER.md](COMPANY_CONTROL_CENTER.md))
with branch administration, people administration, invitation management and the branch-level
access foundation. The server decides everything below; the screens only follow its answers.
EP27 adds the action / permission matrix on top of this foundation — EP26 does not implement it.

## 1. The authorization foundation now available

Every customer request resolves, on the server, per request:

```
Company Membership   CompanyMember (ACTIVE) — one company per account
+ Company Role       COMPANY_OWNER · SYSTEM_ADMIN · EXECUTIVE · DEPARTMENT_MANAGER · DEPARTMENT_STAFF · VIEWER
+ Enabled Depts      Department.isActive within the subscription snapshot
+ Dept Assignments   Membership (user × department, optional primary)
+ Branch Access      CompanyMember.branchScope + MemberBranchAccess
+ Selected Branch    Session.branchId (re-validated on every request)
```

- **Administration** (managing branches, people, departments, settings) comes from the **role**
  only (`backend/src/company/policy.ts`). Branch access never widens or narrows it.
- **Operations** (CORE) require all of: active membership · eligible company · a selected branch
  that is active, of the same company and permitted by branch access · a department that is
  enabled **and** assigned (Owner: every enabled department; since EP27 the Executive reads every
  enabled department) **and** the action permission (EP27, PERMISSION_ACTION_MATRIX.md).
  `requireOperationsContext()` + `assertDepartmentAccess()` are the gate for every EP29+ API.

## 2. Branch access model

| Piece | Meaning |
| --- | --- |
| `CompanyMember.branchScope = ALL_BRANCHES` | every active branch, including branches added later (default; every pre-EP26 membership has it) |
| `CompanyMember.branchScope = SELECTED_BRANCHES` | only the branches listed in `MemberBranchAccess` |
| `MemberBranchAccess(companyId, memberId, branchId)` | one grant; unique per member × branch |

Integrity (database, migration `20261029090000_ep26_branch_user_administration`):

- Composite foreign keys `(memberId, companyId) → CompanyMember(id, companyId)` and
  `(branchId, companyId) → Branch(id, companyId)`: a grant can never mix companies.
- `CompanyMember_owner_all_branches_check`: the Company Owner is always `ALL_BRANCHES`.
- `Invitation_branch_intent_check`: branch ids only with `SELECTED_BRANCHES`.
- `Invitation_not_owner_check`: ownership is never invitable.

Rules (server, `backend/src/company/branch-access.ts`):

- `effectiveScope()` — the owner is `ALL_BRANCHES` whatever is stored.
- `allowedActiveBranches()` / `canWorkInBranch()` — same company, branch `ACTIVE`, and either
  `ALL_BRANCHES` or a grant. An inactive granted branch is kept (and shown struck through to
  administrators) but never selectable; reactivating the branch brings it back.
- `SELECTED_BRANCHES` with no branch is refused (`400 VALIDATION_FAILED` on `branchIds`; the UI
  says "Choose at least one branch" before sending). Branch ids with `ALL_BRANCHES` are refused too. Only active branches of the own company can be granted (`BRANCH_NOT_AVAILABLE`).
- A **System Admin** may be restricted operationally; their company administration stays
  company-wide (the member page says so).

### Selected-branch invalidation

The selected branch lives on the server-side session and is re-checked on every request:

- `GET /company/context` drops a stored branch that is no longer allowed (another company,
  inactive, access removed); with exactly one allowed branch it selects it.
- `requireOperationsContext()` clears an invalid stored branch and answers `409 BRANCH_REQUIRED`.
- Every access change, member deactivation and branch deactivation clears, **in the same
  transaction**, every session of the affected people that points at a branch they may no longer
  use (`clearStaleBranchSessions()`), so no stale context survives. The demo seed does the same
  when it applies its one-time restriction.
- Reactivating a member restores the **saved** access only — never a branch that was removed.

## 3. CORE branch selector

`/core/branch` (frontend `CoreArea.tsx`):

- Lists only branches the server returns (never a forbidden branch or its name), Head Office in
  its own group, then the other branches; each option shows code, name and district / province.
- One allowed branch → selected automatically; several → the person chooses; none → a blocked
  state ("No branch is open to you yet … contact the Company Owner or a System Admin"), with no
  redirect loop.
- The header always names the working branch: `Head Office · 00000` / `Branch B · 00011`
  (visible label "Working in" from 640 px, its own row below 768 px). Internal ids are never shown.
- A refused choice (`BRANCH_NOT_ALLOWED`, `BRANCH_INACTIVE`, `BRANCH_NOT_FOUND`) re-reads the
  context so the stale option disappears. When the tab becomes visible again the context is
  re-read; a refusal (deactivated, no company) replaces the screen, so a removed branch is never
  left on display.
- Presentation only: authorization stays on the server.

## 4. Branch administration

- `/company/branches` — a dense, code-first list: code (Head Office highlighted), name, Head
  Office pill, district / province, active / inactive status rail and label, people who can work
  there, department presence (or "No departments yet" in words), last updated, link to detail.
  Search appears once the list is long; it filters the loaded list.
- Create: Branch details · Address · Contact groups; the server proposes the next free code.
- `/company/branches/:id` — identity, address, contact, edit (only changed fields are sent; the
  code is fixed), status (deactivate after confirmation / reactivate; the Head Office explains it
  can never be deactivated), branch access summary (people with all branches / with this branch),
  people who can work here (to those allowed to see users), and departments present here.

## 5. People administration

- `/company/users` — server-side search (name, email, job title; debounced 300 ms), filters (role,
  status, department, branch), 25 per page with "Show more", dense rows linking to the member.
- `/company/users/:id` — identity (read only: belongs to the account holder), role + job title,
  departments (enabled only), branch access (All branches / Selected branches), company access
  (remove / restore after confirmation), history in words.
- Protected people show **why** controls are unavailable: Company Owner (always all branches and
  enabled departments), yourself (ask the Owner or another System Admin), another System Admin
  for a System Admin (only the Owner).
- Roles: Owner → may give SYSTEM_ADMIN and below; System Admin → EXECUTIVE and below; nobody gives
  COMPANY_OWNER; Executive reads people; department roles do not open the people page.

## 6. Invitations

- Intent: role, departments, branch access (`ALL_BRANCHES` or selected branch ids) — validated
  when created and resent, and **re-validated at acceptance**: departments no longer enabled and
  branches no longer active are dropped (recorded in the acceptance event), never forced.
- `/company/users/invitations` — server states `PENDING · EXPIRED · ACCEPTED · REVOKED · ALL` with
  server counts; each row shows role, departments, branch access, dates and inviter.
- **Resend** (pending or expired): a new invitation with the same intent, a new token and a new
  expiry replaces the old one (`resentFromId`); the old link stops working at once. A 60-second
  per-invitation cooldown (`RESEND_TOO_SOON`) and 20 / 15 min per IP apply.
- **Revoke** (pending, after confirmation): the link stops working at once.
- Tokens: 256-bit random, SHA-256 stored, single use, bound to the invitee email; never logged,
  never in API responses or audit details. One company per account (`ALREADY_IN_COMPANY`);
  existing members cannot be re-invited (`ALREADY_MEMBER`).

## 7. Audit (human-readable in Activity and member history)

`BRANCH_CREATED`, `BRANCH_UPDATED`, `BRANCH_STATUS_CHANGED`, `MEMBER_BRANCH_ACCESS_CHANGED`
(from / to scope and branch codes), `INVITATION_SENT`, `INVITATION_RESENT`, `INVITATION_REVOKED`,
`INVITATION_ACCEPTED` (intent applied / dropped), `MEMBER_ROLE_CHANGED`,
`MEMBER_DEPARTMENTS_CHANGED`, `MEMBER_STATUS_CHANGED` (shown as "Company access removed" /
"Company access restored"). No tokens, hashes or passwords.

## 8. API (EP26 additions; session required, no company id anywhere)

| Method | Path |
| --- | --- |
| GET | `/company/current/branches/:id/detail` |
| GET | `/company/current/members?q=&role=&status=&department=&branch=&page=&pageSize=` |
| GET | `/company/current/members/:id` (detail, protection, history) |
| PUT | `/company/current/members/:id/branches` `{ branchScope, branchIds? }` |
| POST | `/company/invitations` `{ email, role, locale?, departments?, branchScope, branchIds? }` |
| GET | `/company/current/invitations?state=PENDING\|EXPIRED\|ACCEPTED\|REVOKED\|ALL&page=&pageSize=` |
| POST | `/company/invitations/:id/resend` · `/company/invitations/:id/revoke` |
| GET | `/company/context` (adds `scope`, `blocked`) |

## 9. Demo seed

Demo company: Head Office `00000`, demo branch `00001`. Demo Staff (Warehouse) is restricted to
`00001` **once** — the seed applies it only if no `MEMBER_BRANCH_ACCESS_CHANGED` entry exists for
that member, so a later administrator decision is never overwritten. The seed stays idempotent.

## 10. EP27: the action layer on top

EP27 added the permission & action matrix ([PERMISSION_ACTION_MATRIX.md](PERMISSION_ACTION_MATRIX.md)):
the last link of the chain is now **Required action permission** (role default ± per-member
exception, DENY first), resolved per request by `backend/src/permissions/resolver.ts` and enforced
by `requirePermission()`. It composes with — never replaces — branch access: a permission is valid
only inside a selected branch the member may work in, and never grants a branch. Department reach
in CORE is now the effective `<dept>.workspace.view` (it replaces EP25's `departmentAccess()`).
The legacy EP00 `Role` / `Permission` / `RolePermission` tables stay unused; role defaults live in
code.
