import { existsSync } from 'node:fs';
import { Writable } from 'node:stream';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describe, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { normalizeEmail } from '../src/auth/crypto.js';
import { hashPassword } from '../src/auth/password.js';
import { createDb, type Db } from '../src/db/client.js';
import type { CompanyRole, PlatformRole, UserStatus } from '../src/generated/prisma/enums.js';
import type { IdentityView } from '../src/auth/service.js';
import { MemoryMailer, type MailPurpose } from '../src/mail/mailer.js';
import { testEnv } from './helpers.js';

/* Shared helpers for the EP23 account/auth suites (isolated test database). */

if (existsSync('.env.test')) process.loadEnvFile('.env.test');
export const TEST_DB_URL = process.env.TEST_DATABASE_URL;
export const describeDb = TEST_DB_URL ? describe : describe.skip;

export const ORIGIN = 'http://localhost:1111';
export const PASSWORD = 'correct horse battery staple';

export interface Harness {
  app: FastifyInstance;
  db: Db;
  mailer: MemoryMailer;
  logs: string[];
  close(): Promise<void>;
}

/** App + database + in-memory mailer. `logs` captures everything the server logs. */
export async function createHarness(env: Record<string, string> = {}): Promise<Harness> {
  const db = createDb(TEST_DB_URL!);
  const parsed = testEnv(env);
  const mailer = new MemoryMailer(parsed.MAIL_FROM);
  const logs: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, done) {
      logs.push(chunk.toString());
      done();
    },
  });
  const app = await buildApp(parsed, { db, mailer, logger: { level: 'trace', stream } });
  await app.ready();
  return {
    app,
    db,
    mailer,
    logs,
    close: async () => {
      await app.close();
      await db.$disconnect();
    },
  };
}

export async function resetDb(db: Db) {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`,
  );
}

/** The response bodies the suites read (every field optional in practice; typed for the assertions). */
export interface ApiJson {
  status: string;
  error: { code: string; message: string; details?: Record<string, unknown> };
  challenge: { id: string; maskedEmail: string; expiresAt: string; resendAvailableAt: string };
  identity: IdentityView;
  sessions: { id: string; current: boolean }[];
  operators: { role: string }[];
  id: string;
  company: { id: string; name: string };
  role: string;
}

export type ApiResponse = Omit<LightMyRequestResponse, 'json'> & { json<T = ApiJson>(): T };

let ipCounter = 1;

/** A browser: its own IP, a cookie jar, and the allow-listed Origin on every request. */
export class Browser {
  readonly cookies = new Map<string, string>();
  readonly ip = `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
  constructor(private readonly app: FastifyInstance) {}

  async request(
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<ApiResponse> {
    const res = await this.app.inject({
      method,
      url,
      remoteAddress: this.ip,
      headers: {
        origin: ORIGIN,
        ...(this.cookies.size
          ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
          : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { payload: body as object }),
    });
    for (const c of res.cookies as { name: string; value: string; maxAge?: number }[]) {
      if (c.value === '' || c.maxAge === 0) this.cookies.delete(c.name);
      else this.cookies.set(c.name, c.value);
    }
    return res;
  }

  post(url: string, body: unknown = {}) {
    return this.request('POST', url, body);
  }
  get(url: string) {
    return this.request('GET', url);
  }
  delete(url: string) {
    return this.request('DELETE', url);
  }
}

export function codeFrom(mailer: MemoryMailer, to: string, purpose: MailPurpose = 'login_otp') {
  const mail = mailer.last(to, purpose);
  const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`no ${purpose} code mailed to ${to}`);
  return code;
}

export function tokenFrom(mailer: MemoryMailer, to: string, purpose: MailPurpose) {
  const token = mailer.last(to, purpose)?.text.match(/#token=([A-Za-z0-9_-]+)/)?.[1];
  if (!token) throw new Error(`no ${purpose} link mailed to ${to}`);
  return token;
}

/** Inserts an account directly (bypassing registration). */
export async function createUser(
  db: Db,
  email: string,
  opts: {
    password?: string;
    status?: UserStatus;
    verified?: boolean;
    platformRole?: PlatformRole;
    companyRole?: CompanyRole;
    companyId?: string;
  } = {},
) {
  const verified = opts.verified ?? true;
  const user = await db.user.create({
    data: {
      email,
      emailNormalized: normalizeEmail(email),
      status: opts.status ?? (verified ? 'ACTIVE' : 'PENDING_VERIFICATION'),
      emailVerifiedAt: verified ? new Date() : null,
      credential: { create: { passwordHash: await hashPassword(opts.password ?? PASSWORD) } },
    },
  });
  if (opts.platformRole) {
    await db.platformRoleAssignment.create({
      data: {
        userId: user.id,
        role: opts.platformRole,
        ownerSlot: opts.platformRole === 'PLATFORM_OWNER' ? true : null,
      },
    });
  }
  if (opts.companyRole) {
    const companyId =
      opts.companyId ?? (await db.company.create({ data: { name: 'Test Co', isDemo: true } })).id;
    await db.companyMember.create({
      data: {
        companyId,
        userId: user.id,
        role: opts.companyRole,
        // EP24: the owner slot pairs with COMPANY_OWNER (database CHECK).
        ownerSlot: opts.companyRole === 'COMPANY_OWNER' ? true : null,
      },
    });
  }
  return user;
}

/** Full sign-in through password + emailed code. Returns the browser, now signed in. */
export async function signIn(
  h: Harness,
  email: string,
  opts: { password?: string; trustDevice?: boolean; browser?: Browser } = {},
) {
  const browser = opts.browser ?? new Browser(h.app);
  const login = await browser.post('/api/v1/auth/login', {
    email,
    password: opts.password ?? PASSWORD,
  });
  expect(login.statusCode, login.body).toBe(200);
  const body = login.json<{ status: string; challenge?: { id: string } }>();
  if (body.status === 'otp_required') {
    const res = await browser.post('/api/v1/auth/login/otp', {
      challengeId: body.challenge!.id,
      code: codeFrom(h.mailer, email),
      trustDevice: opts.trustDevice ?? false,
    });
    expect(res.statusCode, res.body).toBe(200);
  }
  return browser;
}
