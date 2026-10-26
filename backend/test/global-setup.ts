import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import pg from 'pg';

/*
 * Auth integration tests run against an isolated PostgreSQL database named in
 * TEST_DATABASE_URL (shell or backend/.env.test, never committed). The schema
 * is dropped and rebuilt from the migrations on every run, so the database
 * name must look like a test database — a development or production database
 * is refused, never touched.
 *
 * Without TEST_DATABASE_URL the database suites are skipped (and say so).
 */

export default async function setup() {
  if (existsSync('.env.test')) process.loadEnvFile('.env.test');
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    process.stdout.write(
      '\n⚠ TEST_DATABASE_URL is not set — the account/auth database suites are SKIPPED.\n' +
        '  See docs/AUTHENTICATION.md › Testing.\n\n',
    );
    return;
  }
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!/(^|_)test($|_)/.test(name)) {
    throw new Error(`Refusing to reset "${name}": TEST_DATABASE_URL must name a *_test database.`);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
}
