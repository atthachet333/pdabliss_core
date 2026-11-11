// CORE PostgreSQL role model (EP43) — see docs/EP43_DATABASE_ROLE_POLICY.md.
//
//   core_owner    owns the database, schema and every object; runs migrations. Not a superuser,
//                 cannot create databases or roles. Used only by deploy / migration steps.
//   core_app      the runtime: CONNECT; USAGE on schema public; SELECT/INSERT/UPDATE/DELETE on
//                 tables; USAGE/SELECT on sequences. No ownership, so it cannot ALTER, DROP,
//                 TRUNCATE, disable triggers, change functions or create objects — the EP41
//                 history triggers bind it.
//   core_backup   pg_read_all_data + CONNECT: pg_dump only; cannot write.
//   core_monitor  pg_monitor + CONNECT: activity / size statistics; cannot read business tables.
//
// Applied by a superuser of the TARGET cluster. Passwords come from environment variables
// (CORE_OWNER_PASSWORD …) and are never printed. Role creation is cluster-wide in PostgreSQL;
// EP43 runs it only on a disposable cluster — this script refuses port 5432 unless
// CORE_ROLES_ALLOW_SHARED_CLUSTER=yes (a production activation is an approved, manual step).
import { refuse, urlForDb, withClient } from "./lib.mjs";

export const ROLES = ["core_owner", "core_app", "core_backup", "core_monitor"];
const ident = (s) => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(s)) refuse(`bad identifier ${s}`);
  return `"${s}"`;
};

function guardCluster(superUrl) {
  const u = new URL(superUrl.href ?? superUrl);
  if (
    (u.port || "5432") === "5432" &&
    process.env.CORE_ROLES_ALLOW_SHARED_CLUSTER !== "yes"
  )
    refuse(
      "roles are cluster-wide: refusing the shared cluster on port 5432 (EP43 uses a disposable cluster)",
      "SHARED_CLUSTER",
    );
}

/** Creates (or updates the password of) the four login roles. */
export async function createRoles(superUrl, passwords) {
  guardCluster(superUrl);
  await withClient(urlForDb(superUrl, "postgres"), async (c) => {
    for (const r of ROLES) {
      const pw = passwords[r];
      if (!pw || pw.length < 16)
        refuse(`password for ${r} missing or shorter than 16 characters`);
      const exists = (
        await c.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [r])
      ).rowCount;
      const lit = (await c.query("SELECT quote_literal($1) AS q", [pw])).rows[0]
        .q;
      await c.query(
        `${exists ? "ALTER" : "CREATE"} ROLE ${ident(r)} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT CONNECTION LIMIT ${r === "core_app" ? 40 : 5} PASSWORD ${lit}`,
      );
    }
    await c.query("GRANT pg_read_all_data TO core_backup");
    await c.query("GRANT pg_monitor TO core_monitor");
  });
}

/** A new, empty database owned by core_owner (PUBLIC loses CONNECT and CREATE). */
export async function createDatabase(superUrl, db) {
  guardCluster(superUrl);
  await withClient(urlForDb(superUrl, "postgres"), async (c) => {
    await c.query(`CREATE DATABASE ${ident(db)} OWNER core_owner`);
    await c.query(`REVOKE ALL ON DATABASE ${ident(db)} FROM PUBLIC`);
    await c.query(
      `GRANT CONNECT ON DATABASE ${ident(db)} TO core_app, core_backup, core_monitor`,
    );
  });
  await withClient(urlForDb(superUrl, db), async (c) => {
    await c.query("ALTER SCHEMA public OWNER TO core_owner");
    await c.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
  });
}

/** Runtime grants on objects that exist + default privileges for objects core_owner creates later. */
export async function grantRuntime(superUrl, db) {
  guardCluster(superUrl);
  await withClient(urlForDb(superUrl, db), async (c) => {
    await c.query("GRANT USAGE ON SCHEMA public TO core_app, core_backup");
    await c.query(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO core_app",
    );
    await c.query(
      "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO core_app",
    );
    // Append-only history: the runtime may add rows, never change or remove them. The EP41
    // triggers say the same; the privilege refuses first (defence in depth).
    await c.query(
      'REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog", "StockMovement" FROM core_app',
    );
    await c.query(
      "ALTER DEFAULT PRIVILEGES FOR ROLE core_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO core_app",
    );
    await c.query(
      "ALTER DEFAULT PRIVILEGES FOR ROLE core_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO core_app",
    );
  });
}

/** Ownership audit: every relation, sequence, function and the schema owned by core_owner. */
export async function ownershipAudit(superUrl, db) {
  return withClient(urlForDb(superUrl, db), async (c) => {
    const rows = (
      await c.query(`
        SELECT 'relation' AS kind, c.relname AS name, pg_get_userbyid(c.relowner) AS owner FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','S','v','m','p')
        UNION ALL SELECT 'function', p.proname, pg_get_userbyid(p.proowner) FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
        UNION ALL SELECT 'type', t.typname, pg_get_userbyid(t.typowner) FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e'
        UNION ALL SELECT 'schema', nspname, pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public'
        UNION ALL SELECT 'database', datname, pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()`)
    ).rows;
    return {
      total: rows.length,
      notOwner: rows.filter((r) => r.owner !== "core_owner"),
    };
  });
}

/**
 * Attempts, as `role`, every operation the runtime must NOT be able to do. Each must fail;
 * returns [{ attempt, refused, error }]. Runs each attempt in its own rolled-back transaction.
 */
export async function forbiddenAttempts(url) {
  const attempts = [
    [
      "UPDATE AuditLog",
      `UPDATE "AuditLog" SET "action" = "action" WHERE id = (SELECT id FROM "AuditLog" LIMIT 1)`,
    ],
    [
      "DELETE AuditLog",
      `DELETE FROM "AuditLog" WHERE id = (SELECT id FROM "AuditLog" LIMIT 1)`,
    ],
    ["TRUNCATE AuditLog", `TRUNCATE "AuditLog"`],
    [
      "UPDATE StockMovement",
      `UPDATE "StockMovement" SET "quantityDelta" = 0 WHERE id = (SELECT id FROM "StockMovement" LIMIT 1)`,
    ],
    [
      "DELETE StockMovement",
      `DELETE FROM "StockMovement" WHERE id = (SELECT id FROM "StockMovement" LIMIT 1)`,
    ],
    [
      "disable a history trigger",
      `ALTER TABLE "AuditLog" DISABLE TRIGGER "AuditLog_immutable"`,
    ],
    [
      "drop a history trigger",
      `DROP TRIGGER "AuditLog_immutable" ON "AuditLog"`,
    ],
    [
      "bypass triggers (session_replication_role)",
      `SET session_replication_role = replica`,
    ],
    [
      "replace a trigger function",
      `CREATE OR REPLACE FUNCTION public.ep43_probe() RETURNS int LANGUAGE sql AS 'SELECT 1'`,
    ],
    ["DROP business table", `DROP TABLE "SalesOrder"`],
    [
      "ALTER business table",
      `ALTER TABLE "SalesOrder" ADD COLUMN ep43_probe int`,
    ],
    ["CREATE TABLE", `CREATE TABLE ep43_probe (id int)`],
    ["CREATE SCHEMA", `CREATE SCHEMA ep43_probe`],
    ["CREATE ROLE", `CREATE ROLE ep43_probe`],
    ["CREATE DATABASE", `CREATE DATABASE ep43_probe`],
    ["read server files", `SELECT pg_read_file('postgresql.conf')`],
    ["COPY to server file", `COPY "AuditLog" TO 'ep43_probe.csv'`],
  ];
  return withClient(
    url,
    async (c) => {
      const out = [];
      for (const [attempt, sql] of attempts) {
        const tx = !/DATABASE/.test(sql);
        try {
          if (tx) await c.query("BEGIN");
          await c.query(sql);
          out.push({ attempt, refused: false });
        } catch (e) {
          out.push({
            attempt,
            refused: true,
            error: `${e.code} ${e.message.split("\n")[0].slice(0, 90)}`,
          });
        } finally {
          if (tx) await c.query("ROLLBACK").catch(() => undefined);
        }
      }
      return out;
    },
    "pdabliss-core-roles-audit",
  );
}
