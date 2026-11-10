#!/usr/bin/env node
// PDA BLISS CORE — UAT sandbox CLI (EP42.2). Usage: node uat/uat.mjs <command> [options]
// (or uat\uat.cmd <command> on Windows). See docs/EP42_2_UAT_START_GUIDE.md.
//
//   doctor                          environment, ports (1211/1212 and dev 1111/1112), database, baseline
//   status                          is the UAT stack up, and which database is its backend connected to
//   start [--open]                  start UAT backend (127.0.0.1:1212) and frontend (127.0.0.1:1211)
//   stop                            stop only the processes this tool started
//   init --confirm <db>             create the UAT database (migrations + demo seed) and its baseline
//   verify [--db <db>] [--api]      fixtures, personas, ledger (and live sign-in checks with --api)
//   backup [--db <db>] [--label x]  verified pg_dump into %UAT_HOME%\backups
//   reset --confirm <db>            back up, then restore the UAT baseline (explicit, never automatic)
//   restore --from <file> --confirm <db>   back up, then restore a chosen backup
//
// Nothing here runs on application start-up. Only pdabliss_core_uat (or pdabliss_core_uat_<suffix>)
// on a local server is ever touched; the development database is refused.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import {
  BACKEND,
  BACKEND_URL,
  BASELINE_DUMP,
  BASELINE_MANIFEST,
  DIRS,
  FRONTEND_URL,
  Refusal,
  RUNNER_MARK,
  UAT,
  UAT_HOME,
  adminUrl,
  assertSafeTarget,
  connectionsTo,
  createEmpty,
  dbExists,
  devConnection,
  dump,
  ensureDirs,
  findRunners,
  getJson,
  gitHead,
  isOurRunner,
  ledgerViolations,
  listeners,
  pidAlive,
  pidFile,
  portFree,
  prismaCli,
  readPid,
  recreateFrom,
  refuse,
  rowCounts,
  seedDemo,
  serverIdentity,
  sha256,
  timestamp,
  urlFor,
  withClient,
} from './lib.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > 0 ? argv[i + 1] : undefined;
};
const flag = (name) => argv.includes(`--${name}`);
const say = (...a) => console.log(...a);
// Output piped into a pager that closes early (e.g. `| more`) is not an error.
process.stdout.on('error', (e) => {
  if (e.code === 'EPIPE') process.exit(process.exitCode ?? 0);
});
const ok = (m) => say(`  OK    ${m}`);
const warn = (m) => say(`  WARN  ${m}`);
const bad = (m) => say(`  FAIL  ${m}`);

const PERSONAS = {
  owner: [
    'owner.demo@pdabliss.com',
    'DEMO_COMPANY_OWNER_PASSWORD',
    { role: 'COMPANY_OWNER', branches: '00000,00001' },
  ],
  admin: [
    'admin.demo@pdabliss.com',
    'DEMO_SYSTEM_ADMIN_PASSWORD',
    { role: 'SYSTEM_ADMIN', departments: '', branches: '00000,00001' },
  ],
  executive: [
    'executive.demo@pdabliss.com',
    'DEMO_EXECUTIVE_PASSWORD',
    { role: 'EXECUTIVE', branches: '00000,00001', viewOnly: true },
  ],
  sales: [
    'sales.demo@pdabliss.com',
    'DEMO_SALES_PASSWORD',
    { role: 'DEPARTMENT_STAFF', departments: 'SALES', branches: '00000,00001' },
  ],
  purchasing: [
    'purchasing.demo@pdabliss.com',
    'DEMO_PURCHASING_PASSWORD',
    { role: 'DEPARTMENT_MANAGER', departments: 'PURCHASING', branches: '00000,00001' },
  ],
  operations: [
    'operations.demo@pdabliss.com',
    'DEMO_OPERATIONS_PASSWORD',
    { role: 'DEPARTMENT_MANAGER', departments: 'OPERATIONS', branches: '00000,00001' },
  ],
  warehouse: [
    'warehouse.demo@pdabliss.com',
    'DEMO_WAREHOUSE_PASSWORD',
    { role: 'DEPARTMENT_STAFF', departments: 'WAREHOUSE', branches: '00001' },
  ],
  accounting: [
    'accounting.demo@pdabliss.com',
    'DEMO_ACCOUNTING_PASSWORD',
    { role: 'DEPARTMENT_MANAGER', departments: 'ACCOUNTING', branches: '00000' },
  ],
  staff: [
    'staff.demo@pdabliss.com',
    'DEMO_STAFF_PASSWORD',
    {
      role: 'DEPARTMENT_STAFF',
      departments: 'WAREHOUSE',
      branches: '00001',
      deny: 'warehouse.receiving.process',
    },
  ],
};

// Representative fixtures the owner's test plan relies on: [label, SQL count, minimum].
const COVERAGE = [
  ['company (demo)', `SELECT count(*) FROM "Company" WHERE "isDemo"`, 1],
  ['branches', `SELECT count(*) FROM "Branch"`, 2],
  ['members', `SELECT count(*) FROM "CompanyMember"`, 9],
  ['customers', `SELECT count(*) FROM "Customer"`, 3],
  ['suppliers', `SELECT count(*) FROM "Supplier"`, 3],
  [
    'items: finished goods / raw materials / packaging',
    `SELECT count(DISTINCT type) FROM "Item"`,
    3,
  ],
  ['warehouse locations', `SELECT count(*) FROM "WarehouseLocation"`, 3],
  [
    'purchase requests (draft, submitted, approved, rejected)',
    `SELECT count(DISTINCT status) FROM "PurchaseRequest"`,
    4,
  ],
  [
    'purchase orders (draft, waiting deposit, pending receive, received, cancelled)',
    `SELECT count(DISTINCT status) FROM "PurchaseOrder"`,
    5,
  ],
  [
    'supplier deposit waiting for Accounting',
    `SELECT count(*) FROM "PurchaseOrder" WHERE status = 'WAITING_DEPOSIT'`,
    1,
  ],
  ['goods receipts posted', `SELECT count(*) FROM "GoodsReceipt" WHERE status = 'POSTED'`, 3],
  [
    'lots with expiry (FEFO)',
    `SELECT count(*) FROM "InventoryLot" WHERE "expiryDate" IS NOT NULL`,
    5,
  ],
  ['transfers (posted + draft)', `SELECT count(DISTINCT status) FROM "InventoryTransfer"`, 2],
  ['stock adjustments posted', `SELECT count(*) FROM "StockAdjustment" WHERE status = 'POSTED'`, 2],
  ['cycle counts posted', `SELECT count(*) FROM "CycleCount" WHERE status = 'POSTED'`, 1],
  [
    'sales orders (draft, submitted, confirmed, cancelled)',
    `SELECT count(DISTINCT status) FROM "SalesOrder"`,
    4,
  ],
  [
    'sales reservations active',
    `SELECT count(*) FROM "SalesAllocation" WHERE status = 'ACTIVE'`,
    1,
  ],
  ['picks', `SELECT count(*) FROM "SalesPick"`, 1],
  ['packs', `SELECT count(*) FROM "SalesPack"`, 1],
  ['shipments delivered', `SELECT count(*) FROM "SalesShipment" WHERE status = 'DELIVERED'`, 1],
  [
    'shipment with a delivery exception',
    `SELECT count(*) FROM "SalesShipment" WHERE status = 'DELIVERY_EXCEPTION'`,
    1,
  ],
  ['BOM revisions active', `SELECT count(*) FROM "ProductionBom" WHERE status = 'ACTIVE'`, 3],
  ['production orders (5+ states)', `SELECT count(DISTINCT status) FROM "ProductionOrder"`, 5],
  [
    'material issues posted',
    `SELECT count(*) FROM "ProductionMaterialIssue" WHERE status = 'POSTED'`,
    1,
  ],
  [
    'output reports accepted',
    `SELECT count(*) FROM "ProductionOutputReport" WHERE status = 'ACCEPTED'`,
    1,
  ],
  [
    'finished-goods receipts posted',
    `SELECT count(*) FROM "ProductionGoodsReceipt" WHERE status = 'POSTED'`,
    1,
  ],
  ['stock movements', `SELECT count(*) FROM "StockMovement"`, 20],
];

async function confirm(db) {
  const given = opt('confirm');
  if (given !== db)
    refuse(`This changes ${db}. Re-run with --confirm ${db} (the exact database name).`);
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const typed = (await rl.question(`Type the database name (${db}) to continue: `)).trim();
    rl.close();
    if (typed !== db) refuse('Confirmation did not match — nothing was changed.');
  }
}

async function identity() {
  const id = await serverIdentity();
  say(`PostgreSQL ${id.version} at ${id.host}:${id.port} as ${id.user}`);
  return id;
}

async function tableHashes(db) {
  return withClient(urlFor(db), async (c) => {
    const tables = (
      await c.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY 1`,
      )
    ).rows.map((r) => r.tablename);
    const out = {};
    for (const t of tables)
      out[t] = (
        await c.query(
          `SELECT coalesce(md5(string_agg(h, '' ORDER BY h)), '-') AS h FROM (SELECT md5(x::text) AS h FROM "${t}" x) s`,
        )
      ).rows[0].h;
    return out;
  });
}
const diffHashes = (a, b) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((t) => a[t] !== b[t]);

// ------------------------------------------------------------------------------ doctor / status
async function doctor() {
  ensureDirs();
  say(`UAT home: ${UAT_HOME}`);
  say(`Node ${process.version}`);
  const { devDb } = devConnection();
  await identity();
  say(`Development database (backend/.env): ${devDb} — never touched by this tool`);
  assertSafeTarget(UAT.db);
  ok(`target ${UAT.db} passes the safety guards`);
  (await dbExists(UAT.db))
    ? ok(`${UAT.db} exists`)
    : warn(`${UAT.db} does not exist yet — run: node uat/uat.mjs init --confirm ${UAT.db}`);
  if (fs.existsSync(BASELINE_DUMP) && fs.existsSync(BASELINE_MANIFEST)) {
    const m = JSON.parse(fs.readFileSync(BASELINE_MANIFEST, 'utf8'));
    sha256(BASELINE_DUMP) === m.sha256
      ? ok(`baseline ${path.basename(BASELINE_DUMP)} (created ${m.createdAt}, checksum matches)`)
      : bad('baseline checksum does NOT match its manifest — reset will refuse');
  } else warn('no UAT baseline yet');
  for (const [port, what] of [
    [UAT.frontendPort, 'UAT frontend'],
    [UAT.backendPort, 'UAT backend'],
    [1111, 'dev frontend'],
    [1112, 'dev backend'],
  ]) {
    const free =
      (await portFree(port, '127.0.0.1')) && (await portFree(port, 'localhost').catch(() => true));
    if (free) {
      say(`  port ${port} (${what}): free`);
      continue;
    }
    const ls = listeners(port);
    const ours =
      ls.some((l) => l.command?.includes(RUNNER_MARK)) ||
      [readPid('backend'), readPid('frontend')].some(
        (p) => p && ls.some((l) => l.pid === p.childPid),
      );
    say(`  port ${port} (${what}): IN USE${ours ? ' by this UAT tool' : ''}`);
    for (const l of ls) say(`      pid ${l.pid}: ${(l.command ?? '?').slice(0, 160)}`);
  }
  for (const role of ['backend', 'frontend']) {
    const p = readPid(role);
    if (p)
      say(
        `  ${role} pid file: runner ${p.runnerPid} (${pidAlive(p.runnerPid) ? 'alive' : 'not running — stale'}) since ${p.startedAt}`,
      );
  }
  const tools = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['pg_dump'], {
    encoding: 'utf8',
  });
  say(
    `  pg_dump: ${process.env.PG_BIN || (fs.existsSync('C:/Program Files/PostgreSQL/18/bin/pg_dump.exe') ? 'C:/Program Files/PostgreSQL/18/bin' : (tools.stdout || 'not found').trim())}`,
  );
}

async function status() {
  let up = true;
  const health = await getJson(`${BACKEND_URL}/health`);
  if (health.status === 200)
    ok(
      `backend ${BACKEND_URL} — ${health.body?.status}, environment ${health.body?.environment}, up ${health.body?.uptimeSeconds}s`,
    );
  else {
    bad(`backend ${BACKEND_URL} not answering (${health.error ?? health.status})`);
    up = false;
  }
  const fe = await getJson(`${FRONTEND_URL}/login`);
  if (fe.status === 200) ok(`frontend ${FRONTEND_URL}/login`);
  else {
    bad(`frontend ${FRONTEND_URL} not answering (${fe.error ?? fe.status})`);
    up = false;
  }
  if (health.status === 200) {
    if (health.body?.environment !== 'development')
      bad('backend is not in development mode — demo sign-in would be refused');
    const personas = await getJson(`${BACKEND_URL}/api/v1/demo/personas`);
    const n =
      personas.body?.personas?.length ?? (Array.isArray(personas.body) ? personas.body.length : 0);
    n === 9
      ? ok('demo persona list: 9 accounts')
      : warn(`demo persona list: ${n} (HTTP ${personas.status})`);
  }
  const conns = await withClient(
    adminUrl(),
    async (c) =>
      (
        await c.query(
          `SELECT datname, count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1 GROUP BY 1`,
          [UAT.appName],
        )
      ).rows,
  );
  if (!conns.length)
    say(
      '  INFO  no database session from the UAT backend yet (it connects on the first request that reads data)',
    );
  for (const c of conns)
    (c.datname === UAT.db ? ok : bad)(
      `UAT backend is connected to database "${c.datname}" (${c.n} session(s))`,
    );
  if (await dbExists(UAT.db)) {
    const co = await withClient(
      urlFor(UAT.db),
      async (c) =>
        (await c.query(`SELECT name, "approvalPolicy" FROM "Company" WHERE "isDemo" LIMIT 1`))
          .rows[0],
    );
    if (co) ok(`${UAT.db}: ${co.name}, approval policy ${co.approvalPolicy}`);
  }
  for (const role of ['backend', 'frontend']) {
    const p = readPid(role);
    say(
      `  ${role}: ${p ? `runner pid ${p.runnerPid}${pidAlive(p.runnerPid) ? '' : ' (not running)'}, log ${path.join(DIRS.logs, `${role}.log`)}` : 'not started by this tool'}`,
    );
  }
  for (const r of findRunners())
    if (readPid(r.role)?.runnerPid !== r.pid)
      warn(
        `UAT ${r.role} runner pid ${r.pid} is running without a matching pid file — "stop" will end it`,
      );
  return up;
}

// ------------------------------------------------------------------------------ start / stop
async function start() {
  ensureDirs();
  await identity();
  assertSafeTarget(UAT.db);
  if (!(await dbExists(UAT.db)))
    refuse(`${UAT.db} does not exist. Create it first: node uat/uat.mjs init --confirm ${UAT.db}`);
  const st = prismaCli(UAT.db, 'migrate', 'status');
  if (!/up to date/i.test(st))
    refuse(`${UAT.db} is not on the committed migrations:\n${st.slice(-600)}`);
  ok(`${UAT.db} is on the committed migrations`);
  for (const [role, port] of [
    ['backend', UAT.backendPort],
    ['frontend', UAT.frontendPort],
  ]) {
    const p = readPid(role);
    if (p && isOurRunner(p.runnerPid, role))
      refuse(
        `the UAT ${role} is already running (runner pid ${p.runnerPid}). Use: node uat/uat.mjs status`,
      );
    const orphan = findRunners().find((r) => r.role === role);
    if (orphan)
      refuse(
        `a UAT ${role} runner (pid ${orphan.pid}) is already running without a pid file. Run: node uat/uat.mjs stop`,
      );
    if (!(await portFree(port))) {
      for (const l of listeners(port))
        say(`      pid ${l.pid}: ${(l.command ?? '?').slice(0, 160)}`);
      refuse(
        `port ${port} is in use by another program — nothing was started. See: node uat/uat.mjs doctor`,
      );
    }
  }
  for (const role of ['backend', 'frontend']) {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('./runner.mjs', import.meta.url)), role, RUNNER_MARK],
      { detached: true, stdio: 'ignore', windowsHide: true },
    );
    child.unref();
    say(`  started UAT ${role} runner (pid ${child.pid})`);
  }
  const wait = async (url, ms) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if ((await getJson(url, 2000)).status === 200) return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  };
  const be = await wait(`${BACKEND_URL}/health`, 90_000);
  const fe = await wait(`${FRONTEND_URL}/login`, 90_000);
  await getJson(`${BACKEND_URL}/api/v1/demo/personas`); // opens the first database session
  say('');
  const up = (await status()) && be && fe;
  if (!up) refuse(`the UAT stack did not come up — see the logs in ${DIRS.logs}`);
  say(`\nUAT is ready: ${FRONTEND_URL}/login   (use 127.0.0.1, not localhost)`);
  if (flag('open') && process.platform === 'win32')
    spawn('cmd', ['/c', 'start', '', `${FRONTEND_URL}/login`], {
      detached: true,
      stdio: 'ignore',
    }).unref();
}

async function stop() {
  let stopped = 0;
  for (const role of ['frontend', 'backend']) {
    const p = readPid(role);
    if (!p) {
      say(`  ${role}: not started by this tool (no pid file)`);
      continue;
    }
    if (!isOurRunner(p.runnerPid, role)) {
      if (!pidAlive(p.runnerPid)) {
        fs.rmSync(pidFile(role), { force: true });
        say(`  ${role}: was not running (stale pid file removed)`);
      } else warn(`${role}: pid ${p.runnerPid} is not the UAT runner any more — left alone`);
      continue;
    }
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/PID', String(p.runnerPid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-p.runnerPid, 'SIGTERM');
    fs.rmSync(pidFile(role), { force: true });
    stopped++;
    ok(`stopped UAT ${role} (runner pid ${p.runnerPid} and its child)`);
  }
  // Runners whose pid file was lost: found only by the UAT runner marker in their command line.
  for (const r of findRunners()) {
    spawnSync('taskkill', ['/PID', String(r.pid), '/T', '/F'], { stdio: 'ignore' });
    fs.rmSync(pidFile(r.role), { force: true });
    stopped++;
    ok(
      `stopped UAT ${r.role} runner pid ${r.pid} (found by its UAT marker; its pid file was missing or replaced)`,
    );
  }
  await new Promise((r) => setTimeout(r, 1500));
  for (const port of [UAT.backendPort, UAT.frontendPort]) {
    if (await portFree(port)) say(`  port ${port}: free`);
    else {
      warn(`port ${port} is still in use by another program — not touched:`);
      for (const l of listeners(port))
        say(`      pid ${l.pid}: ${(l.command ?? '?').slice(0, 160)}`);
    }
  }
  if (!stopped) say('  nothing to stop');
}

// ------------------------------------------------------------------------------ init / verify
async function init() {
  const db = opt('db') ?? UAT.db;
  assertSafeTarget(db);
  await identity();
  await confirm(db);
  if (await dbExists(db))
    refuse(
      `${db} already exists — init never overwrites a database. To return to the baseline use: node uat/uat.mjs reset --confirm ${db}`,
    );
  ensureDirs();
  await createEmpty(db);
  ok(`created empty database ${db}`);
  const mig = prismaCli(db, 'migrate', 'deploy');
  ok(
    mig
      .split('\n')
      .find((l) => /migrations found/i.test(l))
      ?.trim() ?? 'migrations applied',
  );
  const s1 =
    seedDemo(db)
      .split('\n')
      .find((l) => l.startsWith('Demo')) ?? '';
  say(`  seed 1: ${s1}`);
  const before = await tableHashes(db);
  const s2 =
    seedDemo(db)
      .split('\n')
      .find((l) => l.startsWith('Demo')) ?? '';
  const changed = diffHashes(before, await tableHashes(db));
  if (/created|updated/.test(s2.replace(/unchanged/g, '')) || changed.length)
    refuse(`second seed was not a no-op (${changed.join(', ') || s2}) — baseline not written`);
  ok('second seed changed nothing (row content hashes identical)');
  const v = await verifyDb(db);
  if (!v) refuse('verification failed — baseline not written');
  if (db === UAT.db) {
    const tmp = `${BASELINE_DUMP}.tmp`;
    const d = dump(db, tmp);
    fs.renameSync(tmp, BASELINE_DUMP);
    const policy = await withClient(
      urlFor(db),
      async (c) =>
        (await c.query(`SELECT "approvalPolicy" FROM "Company" WHERE "isDemo" LIMIT 1`)).rows[0]
          ?.approvalPolicy,
    );
    const manifest = {
      db,
      createdAt: new Date().toISOString(),
      gitHead: gitHead(),
      sha256: d.sha256,
      bytes: d.bytes,
      tableData: d.tableData,
      approvalPolicy: policy,
      rowCounts: await rowCounts(db),
      tableHashes: await tableHashes(db),
    };
    fs.writeFileSync(BASELINE_MANIFEST, JSON.stringify(manifest, null, 1));
    ok(
      `baseline written: ${BASELINE_DUMP} (${d.bytes} bytes, ${d.tableData} tables, sha256 ${d.sha256.slice(0, 12)}…)`,
    );
  }
}

async function verifyDb(db) {
  let fine = true;
  say(`Fixtures in ${db}:`);
  await withClient(urlFor(db), async (c) => {
    for (const [label, sql, min] of COVERAGE) {
      const n = Number((await c.query(sql)).rows[0].count);
      if (n >= min) ok(`${label}: ${n}`);
      else {
        bad(`${label}: ${n} (need ≥ ${min})`);
        fine = false;
      }
    }
    say('Personas (database):');
    const rows = (
      await c.query(`
      SELECT u."emailNormalized" AS email, m.role, m.status, m."branchScope" AS scope,
        coalesce((SELECT string_agg(b.code, ',' ORDER BY b.code) FROM "MemberBranchAccess" a JOIN "Branch" b ON b.id = a."branchId" WHERE a."memberId" = m.id), '') AS branches,
        coalesce((SELECT string_agg(d.code::text, ',' ORDER BY d.code) FROM "Membership" ms JOIN "Department" d ON d.id = ms."departmentId" WHERE ms."userId" = m."userId" AND d."companyId" = m."companyId"), '') AS departments,
        coalesce((SELECT string_agg(o.effect::text || ':' || o.permission, ',') FROM "MemberPermissionOverride" o WHERE o."memberId" = m.id), '') AS overrides
      FROM "CompanyMember" m JOIN "User" u ON u.id = m."userId" JOIN "Company" co ON co.id = m."companyId" AND co."isDemo"`)
    ).rows;
    for (const [key, [email, , want]] of Object.entries(PERSONAS)) {
      const r = rows.find((x) => x.email === email);
      if (!r) {
        bad(`${key}: no membership`);
        fine = false;
        continue;
      }
      const issues = [];
      if (r.role !== want.role) issues.push(`role ${r.role}`);
      if (r.status !== 'ACTIVE') issues.push(`status ${r.status}`);
      if (want.departments !== undefined && r.departments !== want.departments)
        issues.push(`departments "${r.departments}"`);
      if (r.scope !== 'ALL_BRANCHES' && want.branches && r.branches !== want.branches)
        issues.push(`branches "${r.branches}"`);
      if (want.deny && !r.overrides.includes(want.deny))
        issues.push(`missing exception ${want.deny}`);
      if (issues.length) {
        bad(`${key}: ${issues.join('; ')}`);
        fine = false;
      } else
        ok(
          `${key}: ${r.role}${r.departments ? ` · ${r.departments}` : ''} · ${r.scope === 'ALL_BRANCHES' ? 'all branches' : r.branches}${r.overrides ? ` · ${r.overrides}` : ''}`,
        );
    }
  });
  const led = await ledgerViolations(db);
  if (led.bad.length) {
    bad(`ledger: ${JSON.stringify(led.bad)}`);
    fine = false;
  } else
    ok(
      `ledger reconciled: 10 / 10 checks zero (${led.movements} movements, ${led.balances} balances)`,
    );
  return fine;
}

function envValue(key) {
  const text = fs.readFileSync(path.join(BACKEND, '.env'), 'utf8');
  return (text.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? '').replace(/^"|"$/g, '').trim();
}

/** Live checks through the running UAT backend: every persona signs in and resolves its access. */
async function verifyApi() {
  let fine = true;
  say(`Personas (live, ${BACKEND_URL}):`);
  const headers = { 'content-type': 'application/json', origin: FRONTEND_URL };
  for (const [key, [email, pwKey, want]] of Object.entries(PERSONAS)) {
    const r = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password: envValue(pwKey) }),
    });
    const body = await r.json().catch(() => ({}));
    if (body.status !== 'authenticated') {
      bad(`${key}: sign-in ${r.status} ${body.status ?? body.error?.code ?? ''}`);
      fine = false;
      continue;
    }
    const cookie = r.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const ctx = await (
      await fetch(`${BACKEND_URL}/api/v1/company/context`, {
        headers: { cookie, origin: FRONTEND_URL },
      })
    ).json();
    const branches = ctx.branches
      .map((b) => b.code)
      .sort()
      .join(',');
    const issues = [];
    if (ctx.role !== want.role) issues.push(`role ${ctx.role}`);
    if (branches !== want.branches) issues.push(`branches ${branches}`);
    if (want.departments !== undefined && ctx.departments.join(',') !== want.departments)
      issues.push(`departments ${ctx.departments.join(',')}`);
    if (want.viewOnly && !ctx.permissions.every((p) => p.endsWith('.view')))
      issues.push('has non-view permissions');
    if (want.deny && ctx.permissions.includes(want.deny)) issues.push(`still has ${want.deny}`);
    if (
      key === 'admin' &&
      ctx.permissions.some((p) => /^(sales|purchasing|operations|warehouse|accounting)\./.test(p))
    )
      issues.push('has operational permissions');
    await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie, origin: FRONTEND_URL },
    });
    if (issues.length) {
      bad(`${key}: ${issues.join('; ')}`);
      fine = false;
    } else
      ok(
        `${key}: signed in (no e-mailed code), ${ctx.role}, ${ctx.permissions.length} permissions, branches ${branches}${ctx.needsSelection ? ', asked to choose a branch' : ''}`,
      );
  }
  return fine;
}

async function verify() {
  const db = opt('db') ?? UAT.db;
  assertSafeTarget(db);
  if (!(await dbExists(db))) refuse(`${db} does not exist.`);
  let fine = await verifyDb(db);
  if (flag('api')) {
    if (db !== UAT.db)
      refuse('--api checks the running UAT backend, which always uses pdabliss_core_uat.');
    if ((await getJson(`${BACKEND_URL}/health`)).status !== 200)
      refuse('the UAT backend is not running — start it first: node uat/uat.mjs start');
    fine = (await verifyApi()) && fine;
  }
  say(fine ? '\nVERIFY: PASS' : '\nVERIFY: FAIL');
  if (!fine) process.exitCode = 1;
}

// ------------------------------------------------------------------------------ backup / reset / restore
async function backup() {
  const db = opt('db') ?? UAT.db;
  assertSafeTarget(db);
  if (!(await dbExists(db))) refuse(`${db} does not exist.`);
  const label = (opt('label') ?? 'manual').replace(/[^a-z0-9-]/gi, '').slice(0, 30) || 'manual';
  const d = dump(db, path.join(DIRS.backups, `${db}-${label}-${timestamp()}.dump`));
  ok(`backup ${d.file} (${d.bytes} bytes, ${d.tableData} tables, verified with pg_restore --list)`);
  return d;
}

async function replace(db, source, kind) {
  assertSafeTarget(db);
  await identity();
  say(`Target: ${db} — it will be REPLACED by ${kind}: ${source}`);
  await confirm(db);
  ensureDirs();
  if (db === UAT.db) {
    // An idle connection pool leaves no session behind, so also ask the UAT stack itself.
    const runner = readPid('backend');
    if (
      (runner && pidAlive(runner.runnerPid)) ||
      (await getJson(`${BACKEND_URL}/health`, 2000)).status === 200
    ) {
      refuse('the UAT backend is running. Stop it first: node uat/uat.mjs stop');
    }
  }
  if (await dbExists(db)) {
    const others = await connectionsTo(db);
    if (others.length)
      refuse(
        `${others.length} session(s) are connected to ${db}. Stop the UAT stack first: node uat/uat.mjs stop`,
      );
    // Evidence first: the current state is kept, verified, before anything is dropped.
    const d = dump(db, path.join(DIRS.backups, `${db}-before-${kind}-${timestamp()}.dump`));
    ok(`current state kept: ${d.file} (${d.tableData} tables, verified)`);
  } else say(`  ${db} does not exist yet — nothing to back up`);
  await recreateFrom(db, source);
  ok(`${db} restored from ${path.basename(source)}`);
}

async function reset() {
  const db = opt('db') ?? UAT.db;
  assertSafeTarget(db);
  if (!fs.existsSync(BASELINE_DUMP) || !fs.existsSync(BASELINE_MANIFEST))
    refuse(`no UAT baseline at ${DIRS.baseline} — create the sandbox first with init.`);
  const m = JSON.parse(fs.readFileSync(BASELINE_MANIFEST, 'utf8'));
  if (sha256(BASELINE_DUMP) !== m.sha256)
    refuse('the baseline file does not match its manifest checksum — refusing to restore it.');
  await replace(db, BASELINE_DUMP, 'reset');
  const changed = diffHashes(m.tableHashes, await tableHashes(db));
  if (changed.length)
    refuse(`restored data differs from the baseline manifest in: ${changed.join(', ')}`);
  ok(
    `content identical to the baseline of ${m.createdAt} (${Object.keys(m.tableHashes).length} tables, row hashes)`,
  );
  const led = await ledgerViolations(db);
  led.bad.length
    ? bad(`ledger: ${JSON.stringify(led.bad)}`)
    : ok('ledger reconciled: 10 / 10 checks zero');
}

async function restore() {
  const db = opt('db') ?? UAT.db;
  assertSafeTarget(db);
  const from = opt('from');
  if (!from || !fs.existsSync(from))
    refuse('--from <backup file> is required and must exist (see the backups folder).');
  await replace(db, path.resolve(from), 'restore');
  const led = await ledgerViolations(db);
  led.bad.length
    ? bad(`ledger: ${JSON.stringify(led.bad)}`)
    : ok('ledger reconciled: 10 / 10 checks zero');
}

// ------------------------------------------------------------------------------ main
const COMMANDS = { doctor, status, start, stop, init, verify, backup, reset, restore };
if (!COMMANDS[cmd]) {
  const head = fs
    .readFileSync(new URL(import.meta.url), 'utf8')
    .split('\n')
    .slice(1);
  say(
    head
      .slice(
        0,
        head.findIndex((l) => !l.startsWith('//')),
      )
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(cmd ? 2 : 0);
}
try {
  const r = await COMMANDS[cmd]();
  if (cmd === 'status' && r === false) process.exitCode = 1;
} catch (e) {
  if (e instanceof Refusal) {
    console.error(`\nREFUSED: ${e.message}`);
    process.exit(3);
  }
  console.error(
    `\nERROR: ${String(e?.message ?? e).replace(/postgres(ql)?:\/\/[^\s"']+/g, '<url>')}`,
  );
  process.exit(1);
}
