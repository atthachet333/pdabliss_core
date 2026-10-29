import { z } from 'zod';
import type { Db } from '../db/client.js';
import { recordAuthEvent, type RequestMeta } from './audit.js';
import { recordCompanyEvent, type CompanyAuditAction } from '../company/audit.js';
import { clearStaleBranchSessions } from '../company/branch-access.js';
import { snapshotFor } from '../company/entitlements.js';
import { HEAD_OFFICE_CODE } from '../company/service.js';
import {
  DEMO_PERSONA_MARKER,
  DEMO_PERSONAS,
  type DemoPersona,
  type DemoPersonaKey,
} from '../demo/personas.js';
import { seedDemoMasterData } from '../master-data/demo.js';
import { seedDemoPurchaseRequests } from '../purchasing/demo.js';
import { seedDemoPurchaseOrders } from '../purchasing/order-demo.js';
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
 * its customer identities (EP28.1: the personas of src/demo/personas.ts),
 * whose passwords come from the local environment.
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
  // EP28.1 department personas (src/demo/personas.ts): seeded when set.
  DEMO_SALES_PASSWORD: optional,
  DEMO_OPERATIONS_PASSWORD: optional,
  DEMO_WAREHOUSE_PASSWORD: optional,
  DEMO_PURCHASING_PASSWORD: optional,
  DEMO_ACCOUNTING_PASSWORD: optional,
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
  fullName: string,
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
        fullName,
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
  // EP24.1: older accounts without a name get the seed's name once (never overwritten).
  if (!existing.fullName) {
    await db.user.update({ where: { id: existing.id }, data: { fullName } });
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
  ['SALES', 'Sales'],
  ['OPERATIONS', 'Operations'],
  ['WAREHOUSE', 'Warehouse'],
  ['PURCHASING', 'Purchasing'],
  ['ACCOUNTING', 'Accounting & Finance'],
  ['EXECUTIVE', 'Executive'],
] as const;

/** The demo package (EP24): Professional, so all six departments can be exercised. */
export const DEMO_PLAN = 'PROFESSIONAL' as const;

/** Deterministic demo Head Office — an illustrative address, not a real business. */
const DEMO_HEAD_OFFICE = {
  code: HEAD_OFFICE_CODE,
  name: 'สำนักงานใหญ่ (ข้อมูลตัวอย่าง)',
  type: 'HEAD_OFFICE' as const,
  headOfficeSlot: true,
  addressLine1: '99 ถนนตัวอย่าง (ข้อมูลสาธิต)',
  subdistrict: 'บางกระสอ',
  district: 'เมืองนนทบุรี',
  province: 'นนทบุรี',
  postalCode: '11000',
  countryCode: 'TH',
};

/**
 * Demo company + customer identities. Refuses production. Every password must
 * be provided by the local environment — nothing is hard-coded.
 */
export async function seedDemo(db: Db, env: SeedEnv) {
  if (env.NODE_ENV === 'production') {
    throw new SeedError('The demo seed never runs in production.');
  }
  // EP28.1: the personas come from src/demo/personas.ts. The four EP23 accounts
  // need a password; the department personas are seeded when theirs is set.
  const personas = DEMO_PERSONAS.map((persona) => {
    const legacy = LEGACY_EMAIL_ENV[persona.key];
    const email = assertEmail(`${persona.key} email`, legacy ? env[legacy] : persona.email);
    const raw = env[persona.passwordEnv as keyof SeedEnv] as string | undefined;
    const password =
      !raw && !persona.required ? null : assertPassword(persona.passwordEnv, raw, email);
    return { persona, email, password };
  });

  // EP24: the demo company is a complete, ACTIVE Professional workspace — a
  // controlled development/demo state (isDemo), not a paid subscription.
  const seedEvent = (
    companyId: string,
    action: CompanyAuditAction,
    entityType: 'Company' | 'Branch' | 'Subscription',
    entityId: string,
    details?: Record<string, string | boolean | readonly string[]>,
  ) =>
    recordCompanyEvent(db, SEED_META, {
      action,
      actorId: null,
      actorScope: 'seed',
      companyId,
      entityType,
      entityId,
      details,
    });

  let company = await db.company.findFirst({ where: { name: DEMO_COMPANY_NAME, isDemo: true } });
  const companyOutcome = company ? 'unchanged' : 'created';
  if (!company) {
    company = await db.company.create({
      data: {
        name: DEMO_COMPANY_NAME,
        legalName: 'PDA BLISS CORE DEMO COMPANY (ข้อมูลสาธิต — ไม่ใช่บริษัทจริง)',
        isDemo: true,
      },
    });
    await seedEvent(company.id, 'COMPANY_CREATED', 'Company', company.id, { plan: DEMO_PLAN });
  }
  for (const [code, name] of DEMO_DEPARTMENTS) {
    await db.department.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      create: { companyId: company.id, code, name },
      update: {},
    });
  }
  const headOffice = await db.branch.findUnique({
    where: { companyId_code: { companyId: company.id, code: HEAD_OFFICE_CODE } },
  });
  if (!headOffice) {
    const created = await db.branch.create({
      data: { companyId: company.id, ...DEMO_HEAD_OFFICE },
    });
    await seedEvent(company.id, 'HEAD_OFFICE_CREATED', 'Branch', created.id, {
      code: HEAD_OFFICE_CODE,
    });
  }
  const subscription = await db.subscription.findFirst({
    where: { companyId: company.id, currentSlot: true },
  });
  if (!subscription) {
    const now = new Date();
    const snapshot = snapshotFor(DEMO_PLAN);
    const created = await db.subscription.create({
      data: {
        companyId: company.id,
        plan: DEMO_PLAN,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        catalogVersion: snapshot.catalogVersion,
        monthlyPriceThb: snapshot.monthlyPriceThb,
        entitlements: { ...snapshot },
        currentSlot: true,
        startsAt: now,
        activatedAt: now,
      },
    });
    await seedEvent(company.id, 'SUBSCRIPTION_CREATED', 'Subscription', created.id, {
      plan: DEMO_PLAN,
      status: 'ACTIVE',
      mode: 'demo_seed',
      paid: false,
    });
  }
  if (company.status !== 'ACTIVE' || company.onboardingStatus !== 'COMPLETED') {
    company = await db.company.update({
      where: { id: company.id },
      data: {
        status: 'ACTIVE',
        onboardingStatus: 'COMPLETED',
        activatedAt: company.activatedAt ?? new Date(),
      },
    });
  }

  // EP25: a second branch, so the branch selector has something to choose.
  const extraBranch = await db.branch.findUnique({
    where: { companyId_code: { companyId: company.id, code: DEMO_BRANCH.code } },
  });
  if (!extraBranch) {
    const created = await db.branch.create({ data: { companyId: company.id, ...DEMO_BRANCH } });
    await seedEvent(company.id, 'BRANCH_CREATED', 'Branch', created.id, { code: DEMO_BRANCH.code });
  }

  const results: Record<string, string> = {};
  for (const { persona, email, password } of personas) {
    if (!password) {
      results[persona.key] = `skipped (${persona.passwordEnv} not set)`;
      continue;
    }
    const user = await upsertVerifiedUser(db, email, password, false, persona.fullName);
    if (await db.platformRoleAssignment.findUnique({ where: { userId: user.id } })) {
      throw new SeedError(
        `${maskForLog(email)} is a platform operator; demo identities must be separate.`,
      );
    }
    const applied = await applyPersona(db, company.id, user.id, persona);
    results[persona.key] =
      user.outcome === 'unchanged' ? applied : `account ${user.outcome}, persona ${applied}`;
  }

  // EP28: a very small, coherent master-data set (units, categories, items, one
  // customer, one supplier, locations). Stable codes; never overwrites.
  const masterData = await seedDemoMasterData(db, company.id, SEED_META);
  // EP29: demo purchase requests (one per status; EP30 adds a second approved one), created once each.
  const purchaseRequests = await seedDemoPurchaseRequests(db, company.id, SEED_META);
  // EP30: four demo purchase orders (draft, waiting deposit, pending receive, cancelled).
  const purchaseOrders = await seedDemoPurchaseOrders(db, company.id, SEED_META);

  return {
    companyId: company.id,
    company: companyOutcome,
    headOffice: headOffice ? 'unchanged' : 'created',
    branch: extraBranch ? 'unchanged' : 'created',
    subscription: subscription ? 'unchanged' : 'created',
    personas: results,
    masterData,
    purchaseRequests,
    purchaseOrders,
  };
}

/** The EP23 accounts keep their DEMO_*_EMAIL override (another address is not in the bypass allowlist). */
const LEGACY_EMAIL_ENV: Partial<
  Record<
    DemoPersonaKey,
    | 'DEMO_COMPANY_OWNER_EMAIL'
    | 'DEMO_SYSTEM_ADMIN_EMAIL'
    | 'DEMO_EXECUTIVE_EMAIL'
    | 'DEMO_STAFF_EMAIL'
  >
> = {
  OWNER: 'DEMO_COMPANY_OWNER_EMAIL',
  SYSTEM_ADMIN: 'DEMO_SYSTEM_ADMIN_EMAIL',
  EXECUTIVE: 'DEMO_EXECUTIVE_EMAIL',
  STAFF: 'DEMO_STAFF_EMAIL',
};

/**
 * Applies a persona to its membership ONCE (EP28.1). The marker is a
 * DEMO_PERSONA_APPLIED audit entry on the membership: one controlled entry
 * per persona, never repeated.
 *
 *   no membership           create it with role, job title, branch scope,
 *                           departments, branch grants and the exception
 *   membership, no marker   (an account from an earlier seed) fill only what
 *                           was never decided: a missing job title, no
 *                           departments at all, branch access never changed
 *                           (EP26 audit), no exceptions; then mark it
 *   marker present          nothing: later administrator changes stand
 *
 * The role is never changed after creation; the owner keeps its invariants.
 */
async function applyPersona(
  db: Db,
  companyId: string,
  userId: string,
  persona: DemoPersona,
): Promise<'created' | 'completed' | 'unchanged'> {
  const member = await db.companyMember.findUnique({ where: { userId } });
  if (member && member.companyId !== companyId) {
    throw new SeedError(`The ${persona.key} demo account already belongs to another company.`);
  }
  if (
    member &&
    (await db.auditLog.count({
      where: { companyId, action: DEMO_PERSONA_MARKER, entityId: member.id },
    }))
  ) {
    return 'unchanged';
  }
  const departments = await db.department.findMany({
    where: { companyId, code: { in: [...persona.departments] } },
  });
  const restricted = persona.branches !== 'ALL' && persona.role !== 'COMPANY_OWNER';
  const branchIds = restricted
    ? (
        await db.branch.findMany({
          where: { companyId, code: { in: [...persona.branches] }, status: 'ACTIVE' },
          orderBy: { code: 'asc' },
        })
      ).map((b) => b.id)
    : [];
  const primary = persona.departments[0];

  return db.$transaction(async (tx) => {
    const filled: string[] = [];
    let target = member;
    if (!target) {
      target = await tx.companyMember.create({
        data: {
          companyId,
          userId,
          role: persona.role,
          // The owner slot pairs with COMPANY_OWNER (database CHECK).
          ownerSlot: persona.role === 'COMPANY_OWNER' ? true : null,
          jobTitle: persona.jobTitle,
          branchScope: restricted ? 'SELECTED_BRANCHES' : 'ALL_BRANCHES',
        },
      });
      filled.push('membership');
    } else if (!target.jobTitle) {
      target = await tx.companyMember.update({
        where: { id: target.id },
        data: { jobTitle: persona.jobTitle },
      });
      filled.push('jobTitle');
    }
    const fresh = filled.includes('membership');
    const memberId = target.id;

    if (departments.length && (fresh || !(await tx.membership.count({ where: { userId } })))) {
      await tx.membership.createMany({
        data: departments.map((d) => ({
          userId,
          departmentId: d.id,
          isPrimary: d.code === primary,
        })),
        skipDuplicates: true,
      });
      filled.push('departments');
    }

    const accessDecided =
      !fresh &&
      (await tx.auditLog.count({
        where: { companyId, action: 'MEMBER_BRANCH_ACCESS_CHANGED', entityId: memberId },
      })) > 0;
    if (restricted && !accessDecided && (fresh || target.branchScope === 'ALL_BRANCHES')) {
      target = await tx.companyMember.update({
        where: { id: memberId },
        data: { branchScope: 'SELECTED_BRANCHES' },
      });
      await tx.memberBranchAccess.createMany({
        data: branchIds.map((branchId) => ({ companyId, memberId, branchId })),
        skipDuplicates: true,
      });
      // Like any access change: a session left on another branch is cleared.
      await clearStaleBranchSessions(tx, target);
      filled.push('branches');
    }

    if (
      persona.exception &&
      persona.role !== 'COMPANY_OWNER' &&
      (fresh || !(await tx.memberPermissionOverride.count({ where: { memberId } })))
    ) {
      await tx.memberPermissionOverride.create({
        data: { companyId, memberId, ...persona.exception },
      });
      filled.push('exception');
    }

    await recordCompanyEvent(tx, SEED_META, {
      action: DEMO_PERSONA_MARKER,
      actorId: null,
      actorScope: 'seed',
      companyId,
      entityType: 'CompanyMember',
      entityId: memberId,
      details: {
        persona: persona.key,
        role: target.role,
        departments: [...persona.departments],
        branchScope: target.branchScope,
        branches: restricted ? [...persona.branches] : [],
        applied: filled,
      },
    });
    return fresh ? 'created' : 'completed';
  });
}

/** EP25 demo branch — an illustrative address, not a real business. */
const DEMO_BRANCH = {
  code: '00001',
  name: 'สาขาตัวอย่าง (ข้อมูลสาธิต)',
  type: 'BRANCH' as const,
  addressLine1: '1 ถนนสาธิต (ข้อมูลสาธิต)',
  subdistrict: 'ลาดยาว',
  district: 'จตุจักร',
  province: 'กรุงเทพมหานคร',
  postalCode: '10900',
  countryCode: 'TH',
};
