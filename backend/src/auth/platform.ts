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

  async overview() {
    const [users, companies, activeSessions] = await Promise.all([
      this.db.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.company.groupBy({ by: ['isDemo'], _count: { _all: true } }),
      this.db.session.count({
        where: {
          revokedAt: null,
          absoluteExpiresAt: { gt: new Date() },
          idleExpiresAt: { gt: new Date() },
        },
      }),
    ]);
    return {
      users: Object.fromEntries(users.map((u) => [u.status, u._count._all])),
      companies: {
        customer: companies.find((c) => !c.isDemo)?._count._all ?? 0,
        demo: companies.find((c) => c.isDemo)?._count._all ?? 0,
      },
      activeSessions,
    };
  }

  async listOperators() {
    const rows = await this.db.platformRoleAssignment.findMany({
      include: { user: { select: { id: true, email: true, displayName: true, status: true } } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => ({
      userId: r.user.id,
      email: r.user.email,
      displayName: r.user.displayName,
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
      },
    });
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
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
