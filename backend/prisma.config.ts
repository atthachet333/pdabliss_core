import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// The CLI reads the same local .env as the server (never committed).
if (existsSync('.env')) process.loadEnvFile('.env');

// `prisma validate` / `format` / `generate` work without a database; migrate
// commands need DATABASE_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/pdabliss_core',
  },
});
