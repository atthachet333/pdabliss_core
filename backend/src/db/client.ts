import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export type Db = PrismaClient;

/** Prisma 7 talks to PostgreSQL through the `pg` driver adapter. */
export function createDb(databaseUrl: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

export type { Prisma } from '../generated/prisma/client.js';
