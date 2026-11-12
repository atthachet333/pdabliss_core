# EP45 — Department Policy (single-department operational access)

**Status:** implemented in EP45 (development). Applies to every customer company in CORE.

> Department membership decides **where** a person may work. The role and permissions decide **what**
> they may do there. Membership alone never grants an action.

## 1. The rule

| Who                                                                | Department assignment                                       | Operational access                                                                                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Department Manager / Department Staff / Viewer** (regular staff) | **exactly one** operational department per company, or none | Only inside that one department, at the role's tier (Manager: READ + OPERATE + MANAGE · Staff: READ + OPERATE · Viewer: READ). **None** while unassigned. |
| **Company Owner**                                                  | none (refused)                                              | Explicit cross-department authority by role — every tier in every enabled department, under every domain control (§3).                                    |
| **Executive**                                                      | none (refused)                                              | READ (`.view`) in every enabled department. No create, edit, approve, post, cancel, confirm or export. An exception never adds more.                      |
| **System Admin**                                                   | none (refused)                                              | **Nothing operational.** Company administration only (people, branches, departments, permissions, settings, master data).                                 |

Department identifiers are the existing catalog (`backend/src/billing/catalog.ts`): `SALES`, `OPERATIONS`
(production), `WAREHOUSE`, `PURCHASING`, `ACCOUNTING`, `EXECUTIVE`. No second catalog was created. A regular
employee assigned to `EXECUTIVE` gets that department's read-only codes — it is still their one department.

**Roles cannot bypass the department.** Every operational permission code belongs to exactly one department
(`<department>.<resource>.<action>`). The resolver grants a regular employee codes of their assigned
department only — role defaults and ALLOW exceptions included. A person has one company role, so "several
roles" cannot combine departments either (the legacy `Role` / `RolePermission` tables and `Membership.roleId`
are not read by authorization since EP27).

## 2. Cross-department collaboration (unchanged — explicit handoff codes)

Departments still work together through the business workflows, each step by the department that owns it:

| Workflow                                                              | Who does each step                                                                                                                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sales order → reservation → pick → pack → dispatch → delivery         | Sales staff create/submit; a Sales manager (or the owner) confirms and allocates; Warehouse staff pick, pack, prepare; a Warehouse manager (or the owner) dispatches/delivers |
| Purchase request → purchase order → receiving → inventory             | Any department raises a request **from its own department**; Purchasing (or the department's manager) decides; Purchasing orders; Warehouse receives and posts                |
| Production order → reservation → issue → consumption → finished goods | Operations plans, reserves, issues, records usage and output; Warehouse drafts and (manager) posts finished goods                                                             |
| Supplier deposit                                                      | Accounting confirms or waives; Purchasing sees order status only                                                                                                              |

Cross-department information comes from **department-owned, minimal read codes**, never from access to the
other module: `warehouse.receiving.view` (pending receive, quantities only), `warehouse.inventory.view`
(Pending Pick — no customer, no money), `warehouse.material_issues.view` (production handoff),
`purchasing.production_shortages.view` (shortages, no value), and each department's own `.purchase_requests.*`.
Sales follows fulfilment progress on its own order. No workflow step lost its actor under EP45 (§5).

## 3. Owner exceptions (explicit, auditable)

The owner's cross-department authority is a role invariant, not a bypass. It does **not** skip:

- tenant isolation (company derived from the session; other companies' ids → 404);
- branch validity (a selected, active branch is still required for branch-scoped work);
- workflow state machines, inventory integrity triggers and the posted-document freeze (EP41);
- independent approval: deciding one's own document still needs `ownerOverride { reason }` — refused without a
  valid reason (400), refused for non-owners (403 `OVERRIDE_NOT_ALLOWED`), and audited with the reason (EP41);
- the audit log (every action recorded; the log is append-only).

The owner holds no department assignment (the database refuses one) and no per-member exceptions.

## 4. Executive and System Admin

- **Executive** — oversight. Reads operational documents and summaries across enabled departments (where the
  package includes the Executive department). Never posts, approves, mutates inventory, executes production or
  writes financial records. An ALLOW exception cannot raise it above READ (it is ineffective without a
  department); since EP45 an ALLOW also never _removes_ what the role already gives.
- **System Admin** — administration only. EP45 change: before, a System Admin _assigned_ to a department got READ
  - OPERATE there. Now a System Admin cannot be assigned (API 422 `ROLE_TAKES_NO_DEPARTMENT`, database trigger) and
    the resolver gives it no operational code even if a row appeared. No demo persona depended on the old rule
    (`admin.demo` never had a department). Company administration (`company.*`) is unchanged.

## 5. Legacy and unassigned members

- No department is granted automatically, ever. A regular member without one sees "No department yet" in CORE
  and can still sign in, sign out, view their profile and the Company Control Center pages their role allows.
- A member whose data shows **several** assignments (impossible after the migration; see
  `EP45_MIGRATION_AND_ROLLBACK.md`) is treated as **AMBIGUOUS**: no operational access at all (fail closed) until an
  administrator assigns exactly one. The system never picks one.
- `staff.demo` (legacy persona) keeps exactly one department (Warehouse) and its single DENY exception.

## 6. Administration rules (Company Control Center → People)

| Action                                                 | Result                                                                                                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assign / change department                             | `PUT /company/current/members/:id/departments {departments: [] \| [code]}` — replaces the assignment in one transaction (member row locked); audited `MEMBER_DEPARTMENTS_CHANGED {from, to}` |
| Two or more departments                                | 422 `ONE_DEPARTMENT_ONLY`, nothing written                                                                                                                                                   |
| Department for Owner                                   | 403 `OWNER_PROTECTED`                                                                                                                                                                        |
| Department for System Admin / Executive                | 422 `ROLE_TAKES_NO_DEPARTMENT`                                                                                                                                                               |
| Role change to System Admin / Executive while assigned | 409 `ROLE_DEPARTMENT_CONFLICT` — remove the department first (never removed silently)                                                                                                        |
| Disabled or foreign department                         | 422 `DEPARTMENT_NOT_ENABLED` (a department is named by code inside the caller's company; no id is accepted)                                                                                  |
| Invitation intent                                      | same rules (`ONE_DEPARTMENT_ONLY`, `ROLE_TAKES_NO_DEPARTMENT`); re-validated on acceptance                                                                                                   |
| Concurrent changes                                     | serialized by a row lock; the unique index is the backstop (409 `MEMBER_CHANGED`)                                                                                                            |

Changing a department never broadens access beyond the new department: the old department's access ends on the
person's very next request. Messages are in Thai, English and Chinese.

## 7. Enforcement layers

1. **Database** — `Membership` unique per (person, company); composite foreign keys bind the department and the member
   to the assignment's company; guard triggers refuse an assignment for Owner / System Admin / Executive and a role
   change that would keep one; the pending-invitation CHECK.
2. **Resolver** (`backend/src/permissions/resolver.ts`) — the single decision point every module uses; fails closed.
3. **Administration API** — clear 4xx answers before anything is written.
4. **Frontend** — shows the department, offers one choice, re-reads permissions on a stale-authorization 403. It is
   never the security boundary.

## 8. Not in EP45

Optional BOM and recipe confidentiality (EP46), PDA ONE integration, a general ledger, an HR module,
multi-company membership (CORE v1 keeps one company per account; the composite keys already carry `companyId`).
