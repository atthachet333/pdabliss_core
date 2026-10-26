import { z } from 'zod';
import type { Db } from '../db/client.js';
import type { CompanyRole } from '../generated/prisma/enums.js';
import { recordAuthEvent, type RequestMeta } from './audit.js';
import { normalizeEmail } from './crypto.js';
import { checkPassword, hashPassword } from './password.js';

/*
 * Privileged bootstrap and demo seed (EP23).
 *
 * Bootstrap (every environment, idempotent):
 *   PLATFORM_OWNER_EMAIL / PLATFORM_OWNER_INITIAL_PASSWORD  → the one owner
 *   PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_INITIAL_PASSWORD  → an admin (optional)
 * It never invents a password, never accepts a weak or placeholder one, never
 * moves ownership to another address, and never overwrites an existing
 * password unless BOOTSTRAP_RESET_PASSWORDS=true is set explicitly.
 *
 * Demo seed (development / test only): a clearly labelled demo company and
 * four customer identities whose passwords come from the local environment.
 */

export class SeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedError';
  }
}

const PLACEHOLDER_EMAILS = new Set(['owner@example.com']);
const PLACEHOLDER_PASSWORDS = new Set(['change-me', 'changeme', 'password']);

const optional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const SeedEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PLATFORM_OWNER_EMAIL: optional,
  PLATFORM_OWNER_INITIAL_PASSWORD: optional,
  PLATFORM_ADMIN_EMAIL: optional,
  PLATFORM_ADMIN_INITIAL_PASSWORD: optional,
  BOOTSTRAP_RESET_PASSWORDS: z.stringbool().default(false),
  DEMO_COMPANY_OWNER_EMAIL: z.string().default('owner.demo@pdabliss.com'),
  DEMO_COMPANY_OWNER_PASSWORD: optional,
  DEMO_SYSTEM_ADMIN_EMAIL: z.string().default('admin.demo@pdabliss.com'),
  DEMO_SYSTEM_ADMIN_PASSWORD: optional,
  DEMO_EXECUTIVE_EMAIL: z.string().default('executive.demo@pdabliss.com'),
  DEMO_EXECUTIVE_PASSWORD: optional,
  DEMO_STAFF_EMAIL: z.string().default('staff.demo@pdabliss.com'),
  DEMO_STAFF_PASSWORD: optional,
});

export type SeedEnv = z.output<typeof SeedEnvSchema>;

export function parseSeedEnv(source: Record<string, string | undefined>): SeedEnv {
  const result = SeedEnvSchema.safeParse(source);
  if (!result.success) {
    throw new SeedError(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'),
    );
  }
  return result.data;
}

/** Validates a privileged/seed password without ever echoing it. */
function assertPassword(name: string, password: string | undefined, email: string): string {
  if (!password) throw new SeedError(`${name} is not set.`);
  if (PLACEHOLDER_PASSWORDS.has(password.toLowerCase())) {
    throw new SeedError(`${name} is still the placeholder — set a strong password in .env.`);
  }
  const problem = checkPassword(password, normalizeEmail(email));
  if (problem) throw new SeedError(`${name} is rejected by the password policy (${problem}).`);
  return password;
}

function assertEmail(name: string, email: string | undefined): string {
  if (!email) throw new SeedError(`${name} is not set.`);
  if (!z.email().safeParse(email).success) throw new SeedError(`${name} is not a valid email.`);
  return email;
}

const SEED_META: RequestMeta = { ip: null, userAgent: 'core-seed', requestId: 'seed' };

export interface SeedReport {
  owner: 'created' | 'updated' | 'unchanged';
  admin: 'created' | 'updated' | 'unchanged' | 'skipped';
}

/** Creates/refreshes a verified, active account. Password is set on create, or on explicit reset. */
async function upsertVerifiedUser(
  db: Db,
  email: string,
  password: string,
  resetPassword: boolean,
  displayName: string,
): Promise<{ id: string; outcome: 'created' | 'updated' | 'unchanged' }> {
  const emailNormalized = normalizeEmail(email);
  const existing = await db.user.findUnique({
    where: { emailNormalized },
    include: { credential: true },
  });
  const now = new Date();
  if (!existing) {
    const user = await db.user.create({
      data: {
        email,
        emailNormalized,
        displayName,
        status: 'ACTIVE',
        emailVerifiedAt: now,
        credential: { create: { passwordHash: await hashPassword(password) } },
      },
    });
    return { id: user.id, outcome: 'created' };
  }
  if (existing.status === 'DISABLED' || existing.status === 'SUSPENDED') {
    throw new SeedError(
      `The account for ${maskForLog(email)} is ${existing.status}; the seed will not reactivate it.`,
    );
  }
  let outcome: 'updated' | 'unchanged' = 'unchanged';
  if (!existing.emailVerifiedAt || existing.status !== 'ACTIVE') {
    await db.user.update({
      where: { id: existing.id },
      data: { emailVerifiedAt: existing.emailVerifiedAt ?? now, status: 'ACTIVE' },
    });
    outcome = 'updated';
  }
  if (!existing.credential || resetPassword) {
    const passwordHash = await hashPassword(password);
    await db.userCredential.upsert({
      where: { userId: existing.id },
      create: { userId: existing.id, passwordHash },
      update: { passwordHash, passwordChangedAt: now },
    });
    // A changed password ends that account's sessions.
    await db.session.updateMany({
      where: { userId: existing.id, revokedAt: null },
      data: { revokedAt: now, revokeReason: 'PASSWORD_RESET' },
    });
    outcome = 'updated';
  }
  return { id: existing.id, outcome };
}

function maskForLog(email: string) {
  const at = email.indexOf('@');
  return at > 0 ? `${email[0]}…${email.slice(at)}` : '…';
}

export async function bootstrapPlatform(db: Db, env: SeedEnv): Promise<SeedReport> {
  const ownerEmail = assertEmail('PLATFORM_OWNER_EMAIL', env.PLATFORM_OWNER_EMAIL);
  if (PLACEHOLDER_EMAILS.has(normalizeEmail(ownerEmail))) {
    throw new SeedError(
      'PLATFORM_OWNER_EMAIL is still the placeholder — put the owner’s real email in .env.',
    );
  }
  const ownerPassword = assertPassword(
    'PLATFORM_OWNER_INITIAL_PASSWORD',
    env.PLATFORM_OWNER_INITIAL_PASSWORD,
    ownerEmail,
  );

  const adminEmail = env.PLATFORM_ADMIN_EMAIL
    ? assertEmail('PLATFORM_ADMIN_EMAIL', env.PLATFORM_ADMIN_EMAIL)
    : undefined;
  const adminPassword = adminEmail
    ? assertPassword(
        'PLATFORM_ADMIN_INITIAL_PASSWORD',
        env.PLATFORM_ADMIN_INITIAL_PASSWORD,
        adminEmail,
      )
    : undefined;
  if (adminEmail && normalizeEmail(adminEmail) === normalizeEmail(ownerEmail)) {
    throw new SeedError('PLATFORM_ADMIN_EMAIL must differ from PLATFORM_OWNER_EMAIL.');
  }

  // Ownership never moves silently: a different existing owner stops the seed.
  const currentOwner = await db.platformRoleAssignment.findFirst({
    where: { role: 'PLATFORM_OWNER' },
    include: { user: true },
  });
  if (currentOwner && currentOwner.user.emailNormalized !== normalizeEmail(ownerEmail)) {
    throw new SeedError(
      'A different Platform Owner already exists. Ownership is not transferred by the seed — this needs an owner-approved, audited procedure.',
    );
  }

  const owner = await upsertVerifiedUser(
    db,
    ownerEmail,
    ownerPassword,
    env.BOOTSTRAP_RESET_PASSWORDS,
    'Platform Owner',
  );
  const ownerRole = await db.platformRoleAssignment.findUnique({ where: { userId: owner.id } });
  if (ownerRole && ownerRole.role !== 'PLATFORM_OWNER') {
    throw new SeedError(
      'The owner account already holds another platform role; resolve it manually.',
    );
  }
  if (await db.companyMember.findUnique({ where: { userId: owner.id } })) {
    throw new SeedError(
      'The owner email belongs to a customer company account; use a separate address.',
    );
  }
  if (!ownerRole) {
    await db.platformRoleAssignment.create({
      data: { userId: owner.id, role: 'PLATFORM_OWNER', ownerSlot: true },
    });
    await recordAuthEvent(db, SEED_META, {
      type: 'PLATFORM_BOOTSTRAP',
      userId: owner.id,
      metadata: { role: 'PLATFORM_OWNER' },
    });
  }
  const report: SeedReport = {
    owner: !ownerRole && owner.outcome === 'unchanged' ? 'updated' : owner.outcome,
    admin: 'skipped',
  };

  if (adminEmail && adminPassword) {
    const admin = await upsertVerifiedUser(
      db,
      adminEmail,
      adminPassword,
      env.BOOTSTRAP_RESET_PASSWORDS,
      'Platform Admin',
    );
    const adminRole = await db.platformRoleAssignment.findUnique({ where: { userId: admin.id } });
    if (adminRole && adminRole.role !== 'PLATFORM_ADMIN') {
      throw new SeedError(
        'PLATFORM_ADMIN_EMAIL belongs to the Platform Owner; use a separate address.',
      );
    }
    if (await db.companyMember.findUnique({ where: { userId: admin.id } })) {
      throw new SeedError(
        'The admin email belongs to a customer company account; use a separate address.',
      );
    }
    if (!adminRole) {
      await db.platformRoleAssignment.create({
        data: { userId: admin.id, role: 'PLATFORM_ADMIN', grantedById: owner.id },
      });
      await recordAuthEvent(db, SEED_META, {
        type: 'PLATFORM_BOOTSTRAP',
        userId: admin.id,
        metadata: { role: 'PLATFORM_ADMIN' },
      });
    }
    report.admin = !adminRole && admin.outcome === 'unchanged' ? 'updated' : admin.outcome;
  }
  return report;
}

export const DEMO_COMPANY_NAME = 'PDA BLISS CORE DEMO COMPANY';

const DEMO_DEPARTMENTS = [
  ['sales', 'Sales'],
  ['operations', 'Operations'],
  ['warehouse', 'Warehouse'],
  ['purchasing', 'Purchasing'],
  ['accounting', 'Accounting'],
  ['executive', 'Executive'],
] as const;

/**
 * Demo company + customer identities. Refuses production. Every password must
 * be provided by the local environment — nothing is hard-coded.
 */
export async function seedDemo(db: Db, env: SeedEnv) {
  if (env.NODE_ENV === 'production') {
    throw new SeedError('The demo seed never runs in production.');
  }
  const identities: { email: string; password: string; role: CompanyRole; name: string }[] = [
    [
      'DEMO_COMPANY_OWNER',
      env.DEMO_COMPANY_OWNER_EMAIL,
      env.DEMO_COMPANY_OWNER_PASSWORD,
      'COMPANY_OWNER',
      'Demo Company Owner',
    ],
    [
      'DEMO_SYSTEM_ADMIN',
      env.DEMO_SYSTEM_ADMIN_EMAIL,
      env.DEMO_SYSTEM_ADMIN_PASSWORD,
      'SYSTEM_ADMIN',
      'Demo System Admin',
    ],
    [
      'DEMO_EXECUTIVE',
      env.DEMO_EXECUTIVE_EMAIL,
      env.DEMO_EXECUTIVE_PASSWORD,
      'EXECUTIVE',
      'Demo Executive',
    ],
    ['DEMO_STAFF', env.DEMO_STAFF_EMAIL, env.DEMO_STAFF_PASSWORD, 'DEPARTMENT_STAFF', 'Demo Staff'],
  ].map(([key, email, password, role, name]) => {
    const address = assertEmail(`${key}_EMAIL`, email);
    return {
      email: address,
      password: assertPassword(`${key}_PASSWORD`, password, address),
      role: role as CompanyRole,
      name: name!,
    };
  });

  const company =
    (await db.company.findFirst({ where: { name: DEMO_COMPANY_NAME, isDemo: true } })) ??
    (await db.company.create({ data: { name: DEMO_COMPANY_NAME, isDemo: true } }));
  for (const [code, name] of DEMO_DEPARTMENTS) {
    await db.department.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      create: { companyId: company.id, code, name },
      update: {},
    });
  }

  const results: Record<string, string> = {};
  for (const identity of identities) {
    const user = await upsertVerifiedUser(
      db,
      identity.email,
      identity.password,
      false,
      identity.name,
    );
    if (await db.platformRoleAssignment.findUnique({ where: { userId: user.id } })) {
      throw new SeedError(
        `${maskForLog(identity.email)} is a platform operator; demo identities must be separate.`,
      );
    }
    const member = await db.companyMember.findUnique({ where: { userId: user.id } });
    if (member && member.companyId !== company.id) {
      throw new SeedError(`${maskForLog(identity.email)} already belongs to another company.`);
    }
    if (!member) {
      await db.companyMember.create({
        data: { companyId: company.id, userId: user.id, role: identity.role },
      });
    } else if (member.role !== identity.role) {
      await db.companyMember.update({ where: { id: member.id }, data: { role: identity.role } });
    }
    results[identity.role] = user.outcome;
  }
  return { companyId: company.id, identities: results };
}
