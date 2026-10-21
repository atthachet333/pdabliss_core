import { defineConfig } from 'prisma/config';

// DATABASE_URL is optional in EP00: the schema can be validated and formatted
// without a database. Migrations will require it from EP01 onward.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/pdabliss_core',
  },
});
