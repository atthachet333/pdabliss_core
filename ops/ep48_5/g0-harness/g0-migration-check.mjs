// EP48.5 G0 harness — migration scratch check on the TEMPORARY PostgreSQL (127.0.0.1:55443) only.
// Run ONLY through the guard (it supplies TEST_DATABASE_URL, CORE_G0_PG_SYSID and the loopback preload):
//   node g0-guard.mjs exec --gates <G0 folder> --src <checkout> --target test --name migration-scratch -- <this file> --src <checkout> --gates <G0 folder>
//
// 1. I2 (URL) and I1 / I3 (address, port, role "gate", database, system identifier, data directory) before anything else.
// 2. Refuses if pdabliss_core_g0_migrate already exists (collision) — it never drops or reuses anything.
// 3. Every Prisma command gets an EXPLICIT target (DATABASE_URL = core_owner @ 127.0.0.1:55443 / the scratch database),
//    validated by checkTarget; the session as core_owner is re-verified to be the same instance before migrate deploy.
// 4. migrate deploy → all migrations applied; ownershipAudit 0; forbiddenAttempts 17 / 17 refused. One JSON line.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const src = arg("src");
const gates = arg("gates");
const DB = "pdabliss_core_g0_migrate";
const result = { step: "migration-scratch", database: DB, ok: false };
const done = (code) => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(code);
};

try {
  const imp = (rel) => import(pathToFileURL(path.join(src, rel)).href);
  const { G0, checkServer, checkTarget, checkTestUrl, expectedSystemId, assertDatabaseAbsent } = await imp("ops/ep48_5/g0-guard.mjs");
  const testUrl = checkTestUrl(process.env.TEST_DATABASE_URL); // I2 before any connection
  const systemId = expectedSystemId();
  const pg = createRequire(path.join(src, "backend", "package.json"))("pg");
  const superUrl = new URL(testUrl.href);
  superUrl.pathname = "/postgres";
  await checkServer({ url: superUrl.href, gatesDir: gates, pg, systemId, expect: { database: "postgres", role: G0.superuser } }); // I1 + I3
  result.isolation = "I1-I3 ok (127.0.0.1:55443, role gate, system identifier matches initdb)";
  await assertDatabaseAbsent({ url: superUrl.href, pg, database: DB });

  const { createRoles, createDatabase, grantRuntime, ownershipAudit, forbiddenAttempts } = await imp("ops/roles.mjs");
  const pw = () => randomBytes(24).toString("base64url");
  const passwords = { core_owner: pw(), core_app: pw(), core_backup: pw(), core_monitor: pw() };
  await createRoles(superUrl, passwords);
  await createDatabase(superUrl, DB);
  const as = (user) => checkTarget(`postgresql://${user}:${encodeURIComponent(passwords[user])}@127.0.0.1:55443/${DB}`, { label: `${user} URL`, databases: [DB], roles: [user] }).href;

  // The core_owner session must be the same instance: same address, port, role, database and postmaster start.
  const ident = async (url) => {
    const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    await c.connect();
    try {
      return (await c.query("SELECT host(inet_server_addr()) AS a, inet_server_port() AS p, current_user AS u, current_database() AS d, pg_postmaster_start_time()::text AS t")).rows[0];
    } finally {
      await c.end().catch(() => {});
    }
  };
  const viaGate = await ident(superUrl.href);
  const viaOwner = await ident(as("core_owner"));
  if (viaOwner.a !== "127.0.0.1" || viaOwner.p !== G0.port || viaOwner.u !== "core_owner" || viaOwner.d !== DB || viaOwner.t !== viaGate.t)
    throw new Error("the core_owner session is not on the verified temporary instance");
  result.ownerSession = "same instance (address, port, role, database, postmaster start time)";

  // Prisma: explicit target only; nothing inherited can redirect it (the guard already stripped PG* / DATABASE_URL).
  const prismaEnv = { ...process.env, DATABASE_URL: as("core_owner") };
  delete prismaEnv.TEST_DATABASE_URL;
  for (const k of Object.keys(prismaEnv)) if (/^PG[A-Z0-9_]+$/i.test(k) || /^(DIRECT_URL|SHADOW_DATABASE_URL)$/i.test(k)) delete prismaEnv[k];
  const prismaPkg = path.join(src, "backend", "node_modules", "prisma");
  const bin = JSON.parse(fs.readFileSync(path.join(prismaPkg, "package.json"), "utf8")).bin;
  const prismaCli = path.join(prismaPkg, typeof bin === "string" ? bin : bin.prisma);
  const r = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], { cwd: path.join(src, "backend"), env: prismaEnv, encoding: "utf8" });
  result.migrateExit = r.status;
  if (r.status !== 0) throw new Error(`prisma migrate deploy failed (exit ${r.status})`);

  const expected = fs.readdirSync(path.join(src, "backend", "prisma", "migrations"), { withFileTypes: true }).filter((e) => e.isDirectory()).length;
  const o = new pg.Client({ connectionString: as("core_owner") });
  await o.connect();
  const m = (await o.query("SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS done, count(*) FILTER (WHERE finished_at IS NULL)::int AS pending FROM _prisma_migrations")).rows[0];
  await o.end();
  result.migrations = { applied: m.done, pending: m.pending, expected };
  if (m.done !== expected || m.pending !== 0) throw new Error("migration count mismatch");

  await grantRuntime(superUrl, DB);
  const audit = await ownershipAudit(superUrl, DB);
  result.ownership = { objects: audit.total, notOwnedByCoreOwner: audit.notOwner.length };
  if (audit.notOwner.length !== 0) throw new Error("objects not owned by core_owner");

  const attempts = await forbiddenAttempts(as("core_app"));
  result.forbidden = { attempts: attempts.length, refused: attempts.filter((a) => a.refused).length };
  if (attempts.length !== 17 || attempts.some((a) => !a.refused)) throw new Error("a forbidden operation was not refused");

  result.ok = true;
  done(0);
} catch (err) {
  result.error = String(err?.message ?? err).replace(/:\/\/([^:/@\s]+):[^@\s]+@/g, "://$1:<redacted>@");
  done(1);
}
