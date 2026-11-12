import { existsSync } from 'node:fs';
import pg from 'pg';

/*
 * `npm run db:department-check` — EP45 single-department preflight and remediation report.
 *
 * READ ONLY: the whole check runs inside `BEGIN READ ONLY` and is rolled back. It works on a
 * database before and after the EP45 migration (it reads Department.companyId, not the new
 * Membership.companyId), so run it against a database BEFORE upgrading it:
 *
 *   DATABASE_URL=postgresql://…/pdabliss_core_uat npm run db:department-check
 *   npm run db:department-check -- --json          machine-readable
 *
 * Exit code 0 = no blocking conflict (the EP45 migration will apply), 2 = blocking conflicts
 * (the migration refuses to run until an administrator resolves them — it never chooses a
 * department for anyone). See docs/EP45_MIGRATION_AND_ROLLBACK.md.
 *
 * Blocking:
 *   SEVERAL_DEPARTMENTS        a person holds more than one department assignment in a company
 *   ROLE_HOLDS_DEPARTMENT      an Owner, System Admin or Executive holds a department assignment
 *   FOREIGN_DEPARTMENT         an assignment to a department of a company the person is not a member of
 *   PENDING_INVITATION         a pending invitation that would assign several departments, or a
 *                              department to a System Admin / Executive
 * Informational (never blocking):
 *   NO_DEPARTMENT              an active regular member with no department: no operational access
 *                              until an administrator assigns exactly one
 *   HISTORICAL_INVITATION      a closed invitation that named several departments (kept as history)
 *   LEGACY_ROLE_LINK           an assignment still pointing at a legacy Role row (unused since EP27)
 */

export interface DepartmentConflict {
  kind: string;
  blocking: boolean;
  companyId: string | null;
  subject: string;
  detail: string;
}

const REGULAR = `('DEPARTMENT_MANAGER','DEPARTMENT_STAFF','VIEWER')`;

export async function departmentCheck(client: pg.Client): Promise<DepartmentConflict[]> {
  const out: DepartmentConflict[] = [];
  const q = async (sql: string) => (await client.query(sql)).rows as Record<string, unknown>[];

  for (const r of await q(`
      SELECT d."companyId", u."emailNormalized" AS email, cm."role",
             string_agg(d."code"::text, ',' ORDER BY d."code") AS departments
        FROM "Membership" m
        JOIN "Department" d ON d."id" = m."departmentId"
        JOIN "User" u ON u."id" = m."userId"
        LEFT JOIN "CompanyMember" cm ON cm."userId" = m."userId" AND cm."companyId" = d."companyId"
       GROUP BY d."companyId", u."emailNormalized", cm."role"
      HAVING count(*) > 1`))
    out.push({
      kind: 'SEVERAL_DEPARTMENTS',
      blocking: true,
      companyId: r.companyId as string,
      subject: r.email as string,
      detail: `${typeof r.role === 'string' ? r.role : 'no membership'}: ${String(r.departments)}`,
    });

  for (const r of await q(`
      SELECT d."companyId", u."emailNormalized" AS email, cm."role", d."code"
        FROM "Membership" m
        JOIN "Department" d ON d."id" = m."departmentId"
        JOIN "User" u ON u."id" = m."userId"
        JOIN "CompanyMember" cm ON cm."userId" = m."userId" AND cm."companyId" = d."companyId"
       WHERE cm."role" NOT IN ${REGULAR}`))
    out.push({
      kind: 'ROLE_HOLDS_DEPARTMENT',
      blocking: true,
      companyId: r.companyId as string,
      subject: r.email as string,
      detail: `${String(r.role)} assigned to ${String(r.code)}`,
    });

  for (const r of await q(`
      SELECT d."companyId", u."emailNormalized" AS email, d."code"
        FROM "Membership" m
        JOIN "Department" d ON d."id" = m."departmentId"
        JOIN "User" u ON u."id" = m."userId"
       WHERE NOT EXISTS (SELECT 1 FROM "CompanyMember" cm
                          WHERE cm."userId" = m."userId" AND cm."companyId" = d."companyId")`))
    out.push({
      kind: 'FOREIGN_DEPARTMENT',
      blocking: true,
      companyId: r.companyId as string,
      subject: r.email as string,
      detail: `assigned to ${String(r.code)} of a company they are not a member of`,
    });

  // Older databases (before EP25 / EP26) lack member status and invitation intent.
  const has = async (table: string, column: string) =>
    (
      await client.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
        [table, column],
      )
    ).rowCount === 1;
  for (const r of !(await has('Invitation', 'departments'))
    ? []
    : await q(`
      SELECT "companyId", "emailNormalized" AS email, "role", "status",
             array_to_string("departments", ',') AS departments
        FROM "Invitation"
       WHERE cardinality("departments") > 1
          OR ("role" NOT IN ${REGULAR} AND cardinality("departments") > 0)`)) {
    const pending = r.status === 'PENDING';
    out.push({
      kind: pending ? 'PENDING_INVITATION' : 'HISTORICAL_INVITATION',
      blocking: pending,
      companyId: r.companyId as string,
      subject: r.email as string,
      detail: `${String(r.status)} ${String(r.role)}: ${String(r.departments)}`,
    });
  }

  const status = (await has('CompanyMember', 'status')) ? `AND cm."status" = 'ACTIVE'` : '';
  for (const r of await q(`
      SELECT cm."companyId", u."emailNormalized" AS email, cm."role"
        FROM "CompanyMember" cm
        JOIN "User" u ON u."id" = cm."userId"
       WHERE cm."role" IN ${REGULAR} ${status}
         AND NOT EXISTS (SELECT 1 FROM "Membership" m JOIN "Department" d ON d."id" = m."departmentId"
                          WHERE m."userId" = cm."userId" AND d."companyId" = cm."companyId")`))
    out.push({
      kind: 'NO_DEPARTMENT',
      blocking: false,
      companyId: r.companyId as string,
      subject: r.email as string,
      detail: `${String(r.role)} without a department: no operational access until one is assigned`,
    });

  for (const r of await q(`
      SELECT d."companyId", u."emailNormalized" AS email
        FROM "Membership" m
        JOIN "Department" d ON d."id" = m."departmentId"
        JOIN "User" u ON u."id" = m."userId"
       WHERE m."roleId" IS NOT NULL`))
    out.push({
      kind: 'LEGACY_ROLE_LINK',
      blocking: false,
      companyId: r.companyId as string,
      subject: r.email as string,
      detail: 'assignment links a legacy Role row (ignored by authorization since EP27)',
    });

  return out;
}

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  const json = process.argv.includes('--json');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  let found: DepartmentConflict[];
  try {
    await client.query('BEGIN READ ONLY');
    found = await departmentCheck(client);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
  const blocking = found.filter((c) => c.blocking);
  if (json) {
    process.stdout.write(`${JSON.stringify({ blocking: blocking.length, conflicts: found })}\n`);
  } else {
    const db = new URL(url).pathname.replace(/^\//, '');
    process.stdout.write(`EP45 department check — ${db} (read only)\n`);
    if (!found.length) process.stdout.write('  no conflicts\n');
    for (const c of found)
      process.stdout.write(
        `  ${c.blocking ? 'BLOCK' : 'info '} ${c.kind.padEnd(22)} ${c.subject} — ${c.detail}\n`,
      );
    process.stdout.write(
      blocking.length
        ? `${blocking.length} blocking conflict(s): resolve them in the Company Control Center before migrating.\n`
        : 'No blocking conflict: the EP45 migration can be applied.\n',
    );
  }
  process.exitCode = blocking.length ? 2 : 0;
}

if (process.argv[1] && /department-check\.[tj]s$/.test(process.argv[1])) {
  main().catch((err: unknown) => {
    process.stderr.write(`Department check failed: ${String(err)}\n`);
    process.exit(1);
  });
}
