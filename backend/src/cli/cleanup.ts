import { existsSync } from 'node:fs';
import { cleanupAuthRecords } from '../auth/cleanup.js';
import { createDb } from '../db/client.js';

/* `npm run auth:cleanup` — removes expired codes, tokens, sessions and devices (audit kept). */

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  const db = createDb(process.env.DATABASE_URL);
  try {
    const removed = await cleanupAuthRecords(db);
    process.stdout.write(`Removed: ${JSON.stringify(removed)}\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Cleanup failed: ${String(err)}\n`);
  process.exit(1);
});
