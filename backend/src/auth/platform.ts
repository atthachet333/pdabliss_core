import type { Db } from '../db/client.js';
import type { PlatformRole } from '../generated/prisma/enums.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { recordAuthEvent, type RequestMeta } from './audit.js';
import { normalizeEmail } from './crypto.js';
import { forbidden, ownerProtected } from './errors.js';
import { revokeAllSessions, revokeTrustedDevices, type AuthContext } from './sessions.js';

/*
 * Platform Control Center authority (EP23).
 *
 * PLATFORM_OWNER > PLATFORM_ADMIN > everyone else. The owner is created only
 * by the bootstrap (PLATFORM_OWNER_EMAIL) — no endpoint can create, demote,
 * suspend or otherwise change the owner, and the database allows one owner.
 * Admins act on customer accounts only; managing admins is owner-only.
 * Inspecting a customer company as that customer ("impersonation") does not
 * exist yet — see docs/AUTHENTICATION.md for the future requirements.
 */

type Actor = PlatformRole;
type Target = PlatformRole | null;

/** May `actor` suspend or reactivate an account holding `target`? */
export function canManageAccount(actor: Actor, target: Target): boolean {
  if (target === 'PLATFORM_OWNER') return false;
  if (target === 'PLATFORM_ADMIN') return actor === 'PLATFORM_OWNER';
  return true;
}

export class PlatformService {
  constructor(private readonly db: Db) {}

  /**
   * Platform-wide state from real rows only (EP24.1, operator-first in
   * EP24.1.2). Three populations are kept apart, all decided on the server:
   *
   * - customer companies: Company.isDemo = false;
   * - demo data: companies with isDemo = true and the accounts that belong
   *   to them (never counted as customers);
   * - platform operators: accounts holding a platform role.
   *
   * Customer accounts = no platform role and not a member of a demo company
   * (including verified people who have not created their company yet).
   * No revenue or growth figures — billing does not exist yet.
   */
  async overview() {
    const now = new Date();
    const customerCompany = { isDemo: false };
    const demoMember = { companyMember: { is: { company: { isDemo: true } } } };
    const customerUser = { platformRole: null, NOT: demoMember };
    const [
      users,
      companies,
      companyStatus,
      onboarding,
      subscriptions,
      customerAccounts,
      demoAccounts,
      operators,
      awaitingCompany,
      readyToActivate,
      suspendedAccounts,
      activeSessions,
    ] = await Promise.all([
      this.db.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.company.groupBy({ by: ['isDemo'], _count: { _all: true } }),
      this.db.company.groupBy({ by: ['status'], where: customerCompany, _count: { _all: true } }),
      this.db.company.groupBy({
        by: ['onboardingStatus'],
        where: customerCompany,
        _count: { _all: true },
      }),
      this.db.subscription.groupBy({
        by: ['status'],
        where: { currentSlot: true, company: customerCompany },
        _count: { _all: true },
      }),
      this.db.user.groupBy({ by: ['status'], where: customerUser, _count: { _all: true } }),
      this.db.user.count({ where: demoMember }),
      this.db.platformRoleAssignment.groupBy({ by: ['role'], _count: { _all: true } }),
      // Verified customers who have not created their company yet.
      this.db.user.count({
        where: { status: 'ACTIVE', platformRole: null, companyMember: null },
      }),
      // Onboarding finished, subscription still pending: waiting for activation.
      this.db.company.count({
        where: {
          ...customerCompany,
          status: 'PENDING_SUBSCRIPTION',
          onboardingStatus: 'COMPLETED',
        },
      }),
      this.db.user.count({ where: { ...customerUser, status: 'SUSPENDED' } }),
      this.db.session.count({
        where: { revokedAt: null, absoluteExpiresAt: { gt: now }, idleExpiresAt: { gt: now } },
      }),
    ]);
    const tally = <K extends string>(
      rows: ({ _count: { _all: number } } & Record<string, unknown>)[],
      key: K,
    ) => Object.fromEntries(rows.map((r) => [r[key] as string, r._count._all]));
    const companyCounts = tally(companyStatus, 'status');
    const onboardingCounts = tally(onboarding, 'onboardingStatus');
    const operatorCounts = tally(operators, 'role');
    return {
      users: tally(users, 'status'),
      companies: {
        customer: companies.find((c) => !c.isDemo)?._count._all ?? 0,
        demo: companies.find((c) => c.isDemo)?._count._all ?? 0,
        byStatus: {
          PENDING_SUBSCRIPTION: companyCounts.PENDING_SUBSCRIPTION ?? 0,
          ACTIVE: companyCounts.ACTIVE ?? 0,
          SUSPENDED: companyCounts.SUSPENDED ?? 0,
          CLOSED: companyCounts.CLOSED ?? 0,
        },
        onboarding: {
          IN_PROGRESS: onboardingCounts.IN_PROGRESS ?? 0,
          COMPLETED: onboardingCounts.COMPLETED ?? 0,
        },
      },
      subscriptions: tally(subscriptions, 'status'),
      customerAccounts: {
        total: customerAccounts.reduce((n, r) => n + r._count._all, 0),
        byStatus: tally(customerAccounts, 'status'),
      },
      /** Accounts that belong to demo companies — never customers. */
      demoAccounts,
      operators: {
        PLATFORM_OWNER: operatorCounts.PLATFORM_OWNER ?? 0,
        PLATFORM_ADMIN: operatorCounts.PLATFORM_ADMIN ?? 0,
      },
      attention: {
        readyToActivate,
        onboardingIncomplete: onboardingCounts.IN_PROGRESS ?? 0,
        awaitingCompany,
        unverifiedAccounts:
          customerAccounts.find((r) => r.status === 'PENDING_VERIFICATION')?._count._all ?? 0,
        suspendedCompanies: companyCounts.SUSPENDED ?? 0,
        suspendedAccounts,
      },
      activeSessions,
    };
  }

  /**
   * Recent platform activity (EP24.1.2): sign-in / security events and
   * company events (creation, activation, platform inspection) in one
   * timeline. Safe fields only — no IPs, hashes or raw metadata. `scope`
   * narrows it to one of the two kinds.
   */
  async recentActivity(limit: number, scope: 'all' | 'security' | 'company' = 'all') {
    const [auth, company] = await Promise.all([
      scope === 'company'
        ? Promise.resolve([])
        : this.db.authAuditEvent.findMany({
            take: limit,
            orderBy: { occurredAt: 'desc' },
            include: { user: { select: { email: true } } },
          }),
      scope === 'security'
        ? Promise.resolve([])
        : this.db.auditLog.findMany({
            take: limit,
            where: { companyId: { not: null } },
            orderBy: { occurredAt: 'desc' },
            include: {
              actor: { select: { email: true } },
              company: { select: { id: true, name: true, isDemo: true } },
            },
          }),
    ]);
    const scopeOf = (changes: unknown) => {
      const v = (changes as Record<string, unknown> | null)?.actorScope;
      return typeof v === 'string' ? v : null;
    };
    const items = [
      ...auth.map((e) => ({
        id: `a_${e.id}`,
        kind: 'security' as const,
        type: e.type,
        email: e.user?.email ?? null,
        company: null as { id: string; name: string; isDemo: boolean } | null,
        actorScope: null as string | null,
        occurredAt: e.occurredAt,
      })),
      ...company.map((e) => ({
        id: `c_${e.id}`,
        kind: 'company' as const,
        type: e.action,
        email: e.actor?.email ?? null,
        company: e.company,
        actorScope: scopeOf(e.changes),
        occurredAt: e.occurredAt,
      })),
    ];
    return items
      .sort((x, y) => y.occurredAt.getTime() - x.occurredAt.getTime())
      .slice(0, limit)
      .map((x) => ({ ...x, occurredAt: x.occurredAt.toISOString() }));
  }

  async listOperators() {
    const rows = await this.db.platformRoleAssignment.findMany({
      include: { user: { select: { id: true, email: true, fullName: true, status: true } } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => ({
      userId: r.user.id,
      email: r.user.email,
      fullName: r.user.fullName,
      status: r.user.status,
      role: r.role,
      since: r.createdAt.toISOString(),
    }));
  }

  async listUsers(limit = 50) {
    const rows = await this.db.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        platformRole: { select: { role: true } },
        companyMember: { include: { company: { select: { name: true, isDemo: true } } } },
        signupContext: { select: { companyName: true, industry: true, teamSize: true } },
      },
    });
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      // Stated at sign-up (lead info) — distinct from the CORE company below.
      signup: u.signupContext,
      status: u.status,
      emailVerified: !!u.emailVerifiedAt,
      platformRole: u.platformRole?.role ?? null,
      company: u.companyMember
        ? {
            name: u.companyMember.company.name,
            isDemo: u.companyMember.company.isDemo,
            role: u.companyMember.role,
          }
        : null,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    }));
  }

  async recentAuthEvents(limit = 50) {
    const rows = await this.db.authAuditEvent.findMany({
      take: limit,
      orderBy: { occurredAt: 'desc' },
      include: { user: { select: { email: true } } },
    });
    // Safe fields only: no subject hashes, no raw metadata beyond coarse context.
    return rows.map((e) => ({
      id: e.id,
      type: e.type,
      email: e.user?.email ?? null,
      actorId: e.actorId,
      ipAddress: e.ipAddress,
      metadata: e.metadata,
      occurredAt: e.occurredAt.toISOString(),
    }));
  }

  /** Owner only (route guard): grant PLATFORM_ADMIN to an existing, verified, non-customer account. */
  async grantAdmin(ctx: AuthContext, email: string, meta: RequestMeta) {
    const target = await this.db.user.findUnique({
      where: { emailNormalized: normalizeEmail(email) },
      include: { platformRole: true, companyMember: true },
    });
    if (!target) throw new NotFoundError('No account with this email.');
    if (target.platformRole) {
      throw new AppError(
        409,
        'ALREADY_PLATFORM_OPERATOR',
        'This account already has a platform role.',
      );
    }
    if (target.companyMember) {
      throw new AppError(
        409,
        'CUSTOMER_ACCOUNT',
        'A customer company account cannot become a platform operator.',
      );
    }
    if (target.status !== 'ACTIVE' || !target.emailVerifiedAt) {
      throw new AppError(
        409,
        'ACCOUNT_NOT_ACTIVE',
        'Only an active, verified account can be granted a role.',
      );
    }
    await this.db.$transaction(async (tx) => {
      await tx.platformRoleAssignment.create({
        data: { userId: target.id, role: 'PLATFORM_ADMIN', grantedById: ctx.user.id },
      });
      // Existing sessions were customer-grade; the next sign-in is privileged (code every time).
      await revokeAllSessions(tx, target.id, 'ROLE_CHANGED');
      await revokeTrustedDevices(tx, target.id);
      await recordAuthEvent(tx, meta, {
        type: 'PLATFORM_ROLE_GRANTED',
        userId: target.id,
        actorId: ctx.user.id,
        sessionId: ctx.session.id,
        metadata: { role: 'PLATFORM_ADMIN' },
      });
    });
    return { userId: target.id, role: 'PLATFORM_ADMIN' as const };
  }

  /** Owner only (route guard). The owner role itself can never be revoked here. */
  async revokeAdmin(ctx: AuthContext, userId: string, meta: RequestMeta) {
    const assignment = await this.db.platformRoleAssignment.findUnique({ where: { userId } });
    if (!assignment) throw new NotFoundError('This account has no platform role.');
    if (assignment.role === 'PLATFORM_OWNER') throw ownerProtected();
    await this.db.$transaction(async (tx) => {
      await tx.platformRoleAssignment.delete({ where: { userId } });
      await revokeAllSessions(tx, userId, 'ROLE_CHANGED');
      await recordAuthEvent(tx, meta, {
        type: 'PLATFORM_ROLE_REVOKED',
        userId,
        actorId: ctx.user.id,
        sessionId: ctx.session.id,
        metadata: { role: 'PLATFORM_ADMIN' },
      });
    });
  }

  private async loadTarget(ctx: AuthContext, userId: string) {
    const actor = ctx.user.platformRole?.role;
    if (!actor) throw forbidden();
    const target = await this.db.user.findUnique({
      where: { id: userId },
      include: { platformRole: true },
    });
    if (!target) throw new NotFoundError('Account not found.');
    const targetRole = target.platformRole?.role ?? null;
    // The owner is protected first — from everyone, including the owner's own session.
    if (targetRole === 'PLATFORM_OWNER') throw ownerProtected();
    if (userId === ctx.user.id) {
      throw new AppError(409, 'SELF_ACTION', 'You cannot change your own account here.');
    }
    if (!canManageAccount(actor, targetRole)) throw forbidden();
    return target;
  }

  async suspend(ctx: AuthContext, userId: string, meta: RequestMeta) {
    const target = await this.loadTarget(ctx, userId);
    if (target.status === 'SUSPENDED') return;
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
      await revokeAllSessions(tx, userId, 'ACCOUNT_SUSPENDED');
      await revokeTrustedDevices(tx, userId);
      await recordAuthEvent(tx, meta, {
        type: 'ACCOUNT_SUSPENDED',
        userId,
        actorId: ctx.user.id,
        sessionId: ctx.session.id,
      });
    });
  }

  async reactivate(ctx: AuthContext, userId: string, meta: RequestMeta) {
    const target = await this.loadTarget(ctx, userId);
    if (target.status !== 'SUSPENDED') return;
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: target.emailVerifiedAt ? 'ACTIVE' : 'PENDING_VERIFICATION' },
      });
      await recordAuthEvent(tx, meta, {
        type: 'ACCOUNT_REACTIVATED',
        userId,
        actorId: ctx.user.id,
        sessionId: ctx.session.id,
      });
    });
  }
}
