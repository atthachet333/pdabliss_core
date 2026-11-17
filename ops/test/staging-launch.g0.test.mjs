// EP48.5 A-0 — T10: launcher database-identity check against a REAL PostgreSQL. Runs only inside G0
// (`g0-guard.mjs ops-tests`, which sets CORE_G0=1 and has already enforced I1–I4). Outside G0 it is reported as
// skipped, and the G0 runner treats any skipped test as a failure — so it can never be silently left out there.
//
// Before connecting, the test re-checks I2 (URL) and I1 / I3 (server identity) itself: it must never touch the shared
// PostgreSQL instance or pda_one_test.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkDatabaseIdentity } from "../ep48_5/api-launcher.mjs";
import { checkServer, checkTestUrl } from "../ep48_5/g0-guard.mjs";

const IN_G0 = process.env.CORE_G0 === "1";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DB = "pdabliss_core_launcher_g0";

test("T10 launcher L9 against the temporary G0 PostgreSQL (127.0.0.1:55443)", { skip: IN_G0 ? false : "runs only inside G0 (CORE_G0=1)" }, async () => {
  const gates = process.env.CORE_G0_GATES;
  assert.ok(gates, "CORE_G0_GATES must name the G0 gates folder");
  const testUrl = checkTestUrl(process.env.TEST_DATABASE_URL); // I2 — before any connection
  const pg = createRequire(path.join(ROOT, "backend", "package.json"))("pg");
  await checkServer({ url: testUrl.href, gatesDir: gates, pg }); // I1 + I3
  const { createRoles, createDatabase } = await import("../roles.mjs");

  const superUrl = new URL(testUrl.href);
  superUrl.pathname = "/postgres";
  const pw = () => randomBytes(24).toString("base64url");
  const passwords = { core_owner: pw(), core_app: pw(), core_backup: pw(), core_monitor: pw() };
  const admin = new pg.Client({ connectionString: superUrl.href });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  } finally {
    await admin.end();
  }
  await createRoles(superUrl, passwords);
  await createDatabase(superUrl, DB);

  const urlAs = (user, password, { port = 55443, db = DB } = {}) =>
    `postgresql://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/${db}`;
  const expect = { user: "core_app", database: DB, port: 55443 };
  const refused = (p) => assert.rejects(p, (e) => e.rule === "L9_DATABASE_IDENTITY");

  await checkDatabaseIdentity({ url: urlAs("core_app", passwords.core_app), pg, expect });
  await refused(checkDatabaseIdentity({ url: urlAs("core_owner", passwords.core_owner), pg, expect }));
  await refused(checkDatabaseIdentity({ url: testUrl.href.replace(/\/[^/]*$/, `/${DB}`), pg, expect })); // the superuser "gate"
  await refused(checkDatabaseIdentity({ url: urlAs("core_app", "wrong-password"), pg, expect }));
  await refused(checkDatabaseIdentity({ url: urlAs("core_app", passwords.core_app, { port: 55444 }), pg, expect })); // nothing listens

  // A server that accepts TCP but never answers: the check must time out, not hang.
  const silent = net.createServer(() => {});
  await new Promise((r) => silent.listen(0, "127.0.0.1", r));
  const started = Date.now();
  await refused(checkDatabaseIdentity({ url: urlAs("core_app", passwords.core_app, { port: silent.address().port }), pg, expect }));
  assert.ok(Date.now() - started < 6000);
  silent.close();

  const cleanup = new pg.Client({ connectionString: superUrl.href });
  await cleanup.connect();
  try {
    await cleanup.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  } finally {
    await cleanup.end();
  }
});
