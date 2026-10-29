import { existsSync } from 'node:fs';
import { bootstrapPlatform, parseSeedEnv, SeedError, seedDemo } from '../auth/bootstrap.js';
import { createDb } from '../db/client.js';

/*
 * `npm run db:seed`       — privileged bootstrap (Platform Owner + Platform Admin)
 * `npm run db:seed:demo`  — the same, plus the demo company and identities
 *                           (refused when NODE_ENV=production)
 * Production (built): `node dist/cli/seed.js`
 *
 * Reads the local .env. Prints outcomes only — never an email password, hash
 * or token.
 */

const out = (line: string) => process.stdout.write(`${line}\n`);

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new SeedError('DATABASE_URL is not set.');
  const env = parseSeedEnv(process.env);
  const db = createDb(databaseUrl);
  try {
    const report = await bootstrapPlatform(db, env);
    out(`Platform Owner: ${report.owner}`);
    out(`Platform Admin: ${report.admin}`);
    if (env.BOOTSTRAP_RESET_PASSWORDS)
      out('Passwords were reset from .env (BOOTSTRAP_RESET_PASSWORDS=true).');
    if (process.argv.includes('--demo')) {
      const demo = await seedDemo(db, env);
      out(
        `Demo company: ${demo.company}, Head Office ${demo.headOffice}, branch 00001 ${demo.branch}, subscription ${demo.subscription}, master data ${demo.masterData}, purchase requests ${demo.purchaseRequests}, purchase orders ${demo.purchaseOrders}`,
      );
      // EP28.1: one line per persona (src/demo/personas.ts) — outcomes only, never a password.
      for (const [persona, outcome] of Object.entries(demo.personas)) {
        out(`  persona ${persona}: ${outcome}`);
      }
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    err instanceof SeedError ? `Seed stopped: ${err.message}\n` : `Seed failed: ${String(err)}\n`,
  );
  process.exit(1);
});
