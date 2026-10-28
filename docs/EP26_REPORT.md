# EP26 — Branch & User Administration Deepening

**Status:** completed locally, awaiting owner review. Not pushed. EP27 not started.
Design and contracts: [BRANCH_USER_ADMINISTRATION.md](BRANCH_USER_ADMINISTRATION.md).

## Resume

EP26 was resumed from the WIP commit `50103d5` (already on `origin/main`, working tree clean).
The backend (schema, migration, services, routes, 24 EP26 tests) and most of the frontend (copy,
API client, Branches / Branch detail / People / Member / Invitations pages) were in that commit.
This session finished the CORE branch selector, fixed what QA found, added the frontend tests,
proved the migration and ran the gates and real-stack QA.

## What changed in this session

- **CORE branch selector / context:** Head Office grouped apart; code + district / province per
  option; blocked state for zero access; visible "Working in: Name · Code" in the header (own row
  on phones). The context is re-read when the tab becomes visible and after a branch refusal, so a
  removed branch never stays on screen; a refusal (deactivated) replaces the screen.
- **Fast Refresh warnings:** the three were resolved by moving `emptyBranch`, `branchFields` and
  `locationSummary` into `model.ts` (verified: lint clean). One unused import fixed.
- **Fixes found in screenshot review:** branch detail section was titled "Head Office address
  (00000)" on every branch → "Branch details"; branch checkboxes broke letter-by-letter in the
  narrow member column → auto-fill grid; long role pills collided with the next column → wrap;
  invitation rows misaligned between rows with / without actions → fixed action column; status
  history read "Member access changed" both ways → "Company access removed / restored" (TH/EN/ZH);
  System Admin "branch limits never limit administration" note now also on the read-only view;
  Resend / Revoke buttons are described by their row's email.
- **Seed:** the one-time demo Staff restriction now clears stale session branches in the same
  transaction, like every other access change.

## Verdict inputs

| Gate | Result |
| --- | --- |
| Backend Prisma validate · typecheck · lint · format · build | pass |
| Backend tests | **256 / 256** (18 files; 24 EP26) |
| Frontend typecheck · lint · format | pass (no warnings) |
| Frontend tests | **998 / 998** (42 files; EP25 Company Control Center 14 / 14; new EP26 `admin.test.tsx` 24 / 24) |
| Build + prerender + verify | 108 pages + 3 shells |
| Perf budget | within budget: initial JS 184.7 / 205 KiB gzip (EP25 184.5), all JS 4,178.6 / 4,300 KiB raw (EP25 4,103), static HTML 545.9 / 560 KiB |

The new frontend tests were mutation-checked: removing the context revalidation / stale refresh
makes the three stale-context tests fail.

## Database / migration (scratch databases only; dropped afterwards)

- **Fresh:** all 7 migrations apply; `migrate status` up to date.
- **EP25 → EP26 upgrade:** an EP25 checkout (`1655c45`) migrated and seeded a scratch DB, plus an
  EP25 invitation and a session with a selected branch; then the EP26 migration applied. Row counts
  identical (only `MemberBranchAccess` added, empty); hashes of every EP25 column of every row
  identical; every membership `ALL_BRANCHES`; the EP25 invitation `ALL_BRANCHES` / no intent.
- **Seed idempotence:** second demo seed changes nothing (all table counts equal). Restriction
  applied once; an "administrator" change back to all branches survives a re-seed.
- **Constraints verified by rejected inserts:** owner → `SELECTED_BRANCHES`; owner-role
  invitation; branch ids with `ALL_BRANCHES`; grant with a foreign company id; grant of another
  company's branch.
- The owner's `pdabliss_core_dev` was not touched (no migrate, no seed).

## Real-stack QA (temporary API on :1212 + Vite on :1211 → scratch PostgreSQL, dev mail sink)

The owner's own dev servers were running on 1111 / 1112 and were left alone; the temporary stack
used other ports and a scratch database. All checks passed:

- Roles: Owner full admin + all branches; System Admin administers but cannot demote / restrict /
  deactivate the Owner, grant ownership, create peers or self-escalate; Executive reads people
  only; Manager / Staff / Viewer: every admin write 403; Platform operator gets 403 on customer
  APIs while the Company Explorer works.
- Restricted user (Head Office + Branch B, not Branch A): A absent from the selector (no name in
  the payload), direct selection 403 `BRANCH_NOT_ALLOWED`, Head Office and B work, operations
  departments = enabled ∩ assigned, another company's branch 404; removing B clears the context
  (409 `BRANCH_REQUIRED`); deactivation closes company + CORE (403 `MEMBERSHIP_INACTIVE`) and clears
  session branches; reactivation restores only the saved access; a deactivated branch leaves
  every context.
- Invitations: role / departments / branches applied on acceptance; immediate resend refused (429
  `RESEND_TOO_SOON`); resend rotates the token and the old token fails (410); revoked and expired
  fail (410); the server reports `EXPIRED`; accepted token is one-time; existing member 409
  `ALREADY_MEMBER`; member of another company 409 `ALREADY_IN_COMPANY`; list and audit carry no
  token / hash; the server log contains no invitation token and no password.
- IDOR / mass assignment: cross-company member / branch / invitation reads and writes refused;
  foreign branch ids 422 `BRANCH_NOT_AVAILABLE`; unknown fields (`companyId`) 400.
- Search / filter / paging, role change, department change; audit entries present for branch
  create / status, branch access, invitation sent / resent / revoked / accepted, member status,
  role and departments.

## Visual / responsive / accessibility

- Screenshot review at 1440 (all EP26 surfaces), 768 (invitations, CORE blocked) and 390 (people,
  CORE home, selector); automated overflow check of 7 surfaces at 390 / 768 / 1440 / 1920: no
  horizontal overflow, the working branch visible in the CORE header at every width.
- Keyboard: Tab into the selector, arrows across Head Office and branches (one radio group),
  Enter submits; visible focus ring.
- Structural a11y check on 7 surfaces × TH / EN / ZH: exactly one h1, every control named, no
  broken ARIA references, no duplicate ids, no Thai in EN / ZH interface text (company data such
  as Thai branch names is shown as entered).
- **axe was not run this episode:** injecting axe-core from the CDN into the QA page was blocked by
  the session's permission policy, and axe is not a project dependency. The checks above stand in;
  an axe pass remains for the owner's review if wanted.
- Chrome engine only (the in-app browser); Edge / Firefox not run this episode.

## Not changed

Public pages (Home, About, Pricing, Partners, Contact, Consultation …), auth flows, Platform
Control Center code. No EP27 action matrix.

## Known limitations

- EP27 action / permission matrix not implemented (by design).
- The branch list search filters the loaded list (all branches are loaded; paging is client-side).
- A replaced (resent) invitation is listed as Revoked next to its replacement.
- axe and non-Chromium engines not run this episode (see above).
- Roadmap wording in the README now follows the owner's instruction that EP27 is the
  permission / action matrix (previously listed as Audit / Notifications / Activity).
