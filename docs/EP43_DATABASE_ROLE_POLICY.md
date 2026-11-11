# EP43 — PostgreSQL Role Policy (least privilege)

Implementation: `ops/roles.mjs`. Status: **designed and verified on a disposable PostgreSQL 18 cluster.** It is
**not** applied to the shared cluster (port 5432) or to any production server. Role creation is cluster-wide, so the
script refuses port 5432 unless `CORE_ROLES_ALLOW_SHARED_CLUSTER=yes`. Activation on production is blocker B2.

## 1. Roles

| Role           | Purpose                                                                               | Privileges                                                                                                                                                                                                                                    | Must NOT                                                                          |
| -------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `core_owner`   | owns the database, the `public` schema and every object; runs `prisma migrate deploy` | LOGIN, owner; NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; connection limit 5                                                                                                                                               | be used by the running application                                                |
| `core_app`     | the runtime (backend `DATABASE_URL`)                                                  | CONNECT; USAGE on `public`; SELECT/INSERT/UPDATE/DELETE on tables; USAGE/SELECT on sequences; default privileges for future tables. **No UPDATE/DELETE/TRUNCATE on `AuditLog` or `StockMovement`** (append-only history); connection limit 40 | own anything; DDL; disable triggers; create roles or databases; read server files |
| `core_backup`  | `pg_dump` for backups                                                                 | `pg_read_all_data`, CONNECT; connection limit 5                                                                                                                                                                                               | write anything                                                                    |
| `core_monitor` | health / size statistics                                                              | `pg_monitor`, CONNECT                                                                                                                                                                                                                         | read business tables (it has no USAGE on the schema)                              |

`PUBLIC` loses CONNECT on the database and all rights on the `public` schema.

**Passwords:**

- They come from environment variables at apply time (`CORE_OWNER_PASSWORD` …) and must be at least 16 characters.
- Each is passed to the server as a quoted literal and never printed.
- Store them in the server's env files with administrator-only ACLs — never in the repository.

## 2. Order of operations (new database)

1. `createRoles(superUrl, passwords)` — run by a cluster administrator.
2. `createDatabase(superUrl, db)`: owner `core_owner`; PUBLIC revoked; CONNECT for the three login roles.
3. As **core_owner**: `prisma migrate deploy`. EP43 confirmed that all 26 migrations apply **without superuser**
   (no extensions, no superuser-only statements).
4. `grantRuntime(superUrl, db)`, then `ownershipAudit` must report **0** objects not owned by `core_owner`.
5. The backend runs with `core_app`; backups with `core_backup`; the monitor with `core_monitor`.
6. Re-run `grantRuntime` after a restore (backups are `--no-owner --no-privileges`). Future migrations by `core_owner`
   are covered by the default privileges.

**Existing database owned by `postgres`** (today's dev and UAT): either restore a backup into a new `core_owner`
database (as in EP43), or `REASSIGN OWNED` / `ALTER … OWNER TO core_owner` per object during a maintenance window. Both
need approval.

## 3. Verification (EP43, disposable cluster on port 55443, real UAT data)

| Test                                                                                                                                                                                                                                                                                                                                          | Result                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Fresh database: `prisma migrate deploy` as `core_owner`                                                                                                                                                                                                                                                                                       | 26 / 26 migrations applied in 3 s       |
| Ownership audit (fresh, and UAT data restored as `core_owner`)                                                                                                                                                                                                                                                                                | 159 / 159 objects owned by `core_owner` |
| Real backend running as `core_app` on the restored UAT data: cross-department regression (login, company and branch access, Sales, Purchasing, Warehouse, Production, EP41 independent-approval paths incl. the owner override and the not-overridable self-acceptance refusal, posted-document workflows, Executive / System Admin refusals) | **51 / 51**                             |
| Ledger reconciliation (Sales, Production, final), read through `core_backup`                                                                                                                                                                                                                                                                  | 0 / 0 / 0                               |
| 10-check inventory integrity after the regression and an outage                                                                                                                                                                                                                                                                               | 0 violations                            |
| `/health/ready` as `core_app`                                                                                                                                                                                                                                                                                                                 | 200 `ready`                             |
| 17 forbidden operations as `core_app`, all refused (see the table below)                                                                                                                                                                                                                                                                      | **17 / 17 refused**                     |
| `core_app` can read business data and append history                                                                                                                                                                                                                                                                                          | yes                                     |
| `core_backup`: SELECT business data / UPDATE / DELETE                                                                                                                                                                                                                                                                                         | allowed / refused / refused             |
| `core_monitor`: `pg_stat_activity`, database size / business tables                                                                                                                                                                                                                                                                           | allowed / refused (schema not visible)  |

The 17 operations refused for `core_app`:

| Category         | Operation                                        | Refused because                    |
| ---------------- | ------------------------------------------------ | ---------------------------------- |
| History tables   | UPDATE, DELETE or TRUNCATE `AuditLog`            | 42501 permission denied            |
| History tables   | UPDATE or DELETE `StockMovement`                 | 42501 permission denied            |
| History triggers | DISABLE or DROP the `AuditLog_immutable` trigger | must be owner                      |
| History triggers | `SET session_replication_role = replica`         | permission denied to set parameter |
| History triggers | replacing a function                             | no CREATE on the schema            |
| Business tables  | DROP or ALTER a business table                   | must be owner                      |
| Creating objects | CREATE TABLE, CREATE SCHEMA                      | permission denied                  |
| Cluster objects  | CREATE ROLE, CREATE DATABASE                     | permission denied                  |
| Server files     | `pg_read_file`, `COPY … TO` a file               | permission denied                  |

**Two independent layers.** Even `core_owner`, who holds table privileges, is stopped by the EP41 triggers:

- `UPDATE` / `DELETE AuditLog` → "AuditLog rows are immutable";
- updating a POSTED goods receipt → "is POSTED and cannot be changed";
- `UPDATE StockMovement` → "rows are immutable: write a reversal movement instead".

Only a **superuser** can bypass both layers, which is why the runtime must never be one.

## 4. Gaps

- No row-level security: company isolation stays in the application, tested by the EP40 sweeps. RLS is a later
  decision.
- `core_owner` passwords and the migration step need an operational owner (who runs deploys).
- The shared development cluster still uses `postgres` for dev / UAT. Moving them would be a separate, approved change.
