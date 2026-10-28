# EP27 — Permission & Action Matrix Foundation

**Status:** completed locally, awaiting owner review. Not pushed. EP28 not started.
Design and contracts: [PERMISSION_ACTION_MATRIX.md](PERMISSION_ACTION_MATRIX.md).

## Baseline

Built on `6b1ae83` (EP26), which is committed locally and was **not yet pushed** when EP27 started
(`origin/main` = `50103d5`); the working tree was clean.

## What EP27 adds

- **Catalog** (`backend/src/permissions/catalog.ts`): 42 typed codes — 12 company-administration
  (COMPANY scope) and 30 operational across the six departments (BRANCH scope), each with
  namespace, resource, action and tier. One action vocabulary (view · create · edit · approve ·
  cancel · delete · export · manage + `process`, `update_status`). The suggested
  `operations.orders.manage_status` became `operations.orders.update_status` so the catalog has a
  single status action (no synonyms). No `platform.*` code; Warehouse has no financial notion.
- **Role defaults in code**: administration by role (EP25 grants, renamed); operations by tier and
  assignment — Owner all, System Admin READ+OPERATE where assigned, Executive READ everywhere
  enabled, Manager READ+OPERATE+MANAGE / Staff READ+OPERATE / Viewer READ where assigned.
- **Exceptions**: `MemberPermissionOverride` (ALLOW / DENY, operational codes only, unique per
  member × code, company-bound FK, catalog `CHECK`). DENY beats everything; ALLOW only inside a
  department the member is in; disabled / out-of-package departments make exceptions inactive
  (kept, reversible). Company administration and the owner are never overridable.
- **One resolver** (`resolver.ts`, pure, per request, no cache) and **one guard**
  (`requirePermission()`, 403 `PERMISSION_DENIED` naming the code). EP25's `departmentAccess()`
  and `capabilities` are replaced; Company Control Center gates use catalog codes.
- **API**: role profiles, member effective permissions (source, inactive reason, protection),
  transactional exception updates (member row locked, final state returned), `permissions` in
  the branch and operations contexts, `/operations/workspaces/:department` and
  `/operations/authorize`.
- **Audit**: `MEMBER_PERMISSION_OVERRIDE_ADDED` / `_CHANGED` / `_REMOVED` (member, code, from, to),
  shown in words in Activity and member history.
- **UI**: `/company/permissions` (Role profiles matrix ≥ 1280 px / role cards below; Member
  exceptions: picker → grouped areas → resources → actions with state, source and inactive reason
  in words, an exception selector, batch save, confirmation when a held permission would be lost,
  focus managed), Permissions in the Control Center menu (after Security), a Permissions link on
  the member page, CORE departments by effective workspace permission with the access level in
  words. TH / EN / ZH copy with identical shape.

## Policy change to note

The Executive now **reads every enabled department** (READ tier only) instead of "Executive +
assigned" — per the EP27 Executive policy (cross-functional view, never create / edit / approve).
Two EP25 backend assertions were updated to this contract (and to the renamed codes); none was
loosened.

## Gates

| Gate | Result |
| --- | --- |
| Backend Prisma validate · typecheck · lint · format · build | pass |
| Backend tests | **279 / 279** (19 files; 23 new in `permissions.test.ts`) |
| Frontend typecheck · lint · format | pass |
| Frontend tests | **1007 / 1007** (43 files; 9 new in `permissions.test.tsx`; EP25 Company Control Center 14 / 14; EP26 24 / 24) |
| Build + prerender + verify | 108 pages + 3 shells |
| Perf budget | within budget: initial JS 184.6 / 205 KiB gzip (EP26 184.7), all JS 4,210.9 / 4,300 KiB raw (EP26 4,178.6), static HTML 545.6 / 560 KiB; permission UI only in lazy chunks |

**Test timeout investigation.** EP25 Control Center tests intermittently hit the 5 s default
(bimodal: ~150 ms or 5 s). Reproduced on the EP26 baseline (3 of 5 runs of that file), so not an
EP27 regression; cause: CPU-bound jsdom role queries under heavy load from another application on
this machine. The frontend `testTimeout` is now 15 s (assertions unchanged; a hang still fails —
verified with a probe). One auth test failed once while the backend suite ran in parallel; it
passed alone and in two clean full runs.

## Database / migration (scratch databases only; dropped afterwards)

- **Fresh:** all 8 migrations apply; demo seed twice → identical table counts.
- **EP26 → EP27 upgrade:** an EP26 checkout (`6b1ae83`) migrated and seeded, plus an intent
  invitation (Warehouse, selected branch 00001) and the demo Staff branch grant. After the EP27
  migration, **every row of 11 tables (Company, CompanyMember, MemberBranchAccess, Invitation,
  Branch, Membership, Department, Subscription, User, AuditLog, Session) is byte-identical**; no
  override rows; re-seed is a no-op.
- The owner's `pdabliss_core_dev` was not touched.

## Real-stack QA (temporary API :1212 + Vite :1211 → scratch PostgreSQL; owner's 1111/1112 left alone)

All 35 checks passed:

- **Staff** (Warehouse, Branch A): workspace view; inventory view, receiving process, adjustment
  create allowed; approval 403; Branch B refused; Purchasing refused; context carries no
  Purchasing / approve code.
- **Manager** (Warehouse, A + B): approve allowed in B; System Admin denies it → the **same
  session** gets 403 on the next request and the context drops the code; removing the deny
  restores it.
- **Viewer**: workspace view only; every action 403; cannot touch permissions.
- **System Admin**: administration works; owner protected; no self-change; `platform.*` →
  422 unknown; administration codes → 422 not overridable; unknown code refused and nothing
  stored; ALLOW for an unassigned or disabled department refused; disabling Warehouse closes the
  workspace; no subscription write endpoint; audit emitted with member / code / effects only.
- **IDOR / platform / EP26:** another company's member 404; platform operator 403 on the customer
  permission API while the Platform explorer works; branch access change still clears the stale
  branch; deactivation removes every permission; no password or invitation token in the log.

## Visual / responsive / accessibility

- Screenshot review: role profiles at 1440 and 768 (cards), member exceptions at 1440 and 390.
  Automated check of 6 surfaces × 390 / 768 / 1440 / 1920: no horizontal overflow, one h1; the
  matrix shows only from 1280 px.
- Keyboard: exception select → arrows → Tab to Save → Enter → focus moves to "Confirm and save"
  (fixed during QA: it was lost to the page) → Enter saves; visible focus rings.
- Structural a11y on 5 surfaces × TH / EN / ZH: one h1, all controls named (selects labelled
  "Exception: <resource> — <action>"), scoped table headers, no broken ARIA references, no
  duplicate ids. Allow / deny states are text + icon, never colour only. EN / ZH: no Thai in the
  interface (the demo company's own Thai branch names appear as data).
- **axe not run:** axe-core is not a project dependency and loading it from a CDN into the QA page
  is blocked by this session's permission policy. **Edge / Firefox not run** — only the in-app
  Chromium browser.

## Not changed

Public pages, auth flows, Platform Control Center code. No operational records, workflows,
field / row ACLs or custom role builder.

## Known limitations

- Company-administration permissions are role-bound (not overridable) by design.
- Role defaults cannot be edited by customers (by design); Role profiles is read only.
- `/operations/authorize` and `/operations/workspaces/:department` are gates only — the
  workspaces themselves arrive with their modules.
- After a save the confirmation bar disappears and focus returns to the page; the result is
  announced in the live region.
- axe and non-Chromium engines not run (see above).
