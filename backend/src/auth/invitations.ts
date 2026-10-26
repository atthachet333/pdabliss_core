import type { Env } from '../config/env.js';
import type { Db } from '../db/client.js';
import type { CompanyRole } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import type { Mailer } from '../mail/mailer.js';
import { appLink, invitationMail } from '../mail/templates.js';
import { recordAuthEvent, type RequestMeta } from './audit.js';
import { normalizeEmail, randomToken, sha256 } from './crypto.js';
import { forbidden, mailUnavailable, tokenExpired, tokenInvalid, tokenUsed } from './errors.js';
import { mailLocale } from './locale.js';
import { AUTH_POLICY } from './policy.js';
import type { AuthContext } from './sessions.js';

/*
 * Company invitations (EP23 foundation for the Company Control Center).
 * Single use, 7-day expiry, revocable, bound to the invitee's email and to one
 * company, with the inviter recorded. Accepting creates the CompanyMember in
 * the same transaction. Department access and the UI arrive in EP26.
 */

/** Roles an inviter may hand out. COMPANY_OWNER is never invited (ownership transfer is its own flow). */
const INVITABLE: Record<'COMPANY_OWNER' | 'SYSTEM_ADMIN', CompanyRole[]> = {
  COMPANY_OWNER: ['SYSTEM_ADMIN', 'EXECUTIVE', 'DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER'],
  SYSTEM_ADMIN: ['EXECUTIVE', 'DEPARTMENT_MANAGER', 'DEPARTMENT_STAFF', 'VIEWER'],
};

export class InvitationService {
  constructor(
    private readonly db: Db,
    private readonly env: Env,
    private readonly mailer: Mailer,
  ) {}

  /** The caller's company, if they may invite into it. */
  private async inviter(ctx: AuthContext) {
    const member = await this.db.companyMember.findUnique({
      where: { userId: ctx.user.id },
      include: { company: true },
    });
    if (!member || (member.role !== 'COMPANY_OWNER' && member.role !== 'SYSTEM_ADMIN')) {
      throw forbidden();
    }
    return { ...member, role: member.role };
  }

  async create(ctx: AuthContext, input: { email: string; role: CompanyRole }, meta: RequestMeta) {
    const member = await this.inviter(ctx);
    if (!INVITABLE[member.role].includes(input.role)) throw forbidden();
    const emailNormalized = normalizeEmail(input.email);
    const token = randomToken();
    const invitation = await this.db.$transaction(async (tx) => {
      // One open invitation per address and company: a new one replaces the old.
      await tx.invitation.updateMany({
        where: { companyId: member.companyId, emailNormalized, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      const created = await tx.invitation.create({
        data: {
          companyId: member.companyId,
          email: input.email.trim(),
          emailNormalized,
          role: input.role,
          tokenHash: sha256(token),
          invitedById: ctx.user.id,
          expiresAt: new Date(Date.now() + AUTH_POLICY.invitation.ttlMs),
        },
      });
      await recordAuthEvent(tx, meta, {
        type: 'INVITATION_CREATED',
        actorId: ctx.user.id,
        sessionId: ctx.session.id,
        metadata: { invitationId: created.id, role: input.role },
      });
      return created;
    });

    const locale = mailLocale(ctx.user.locale);
    const mail = invitationMail(
      locale,
      member.company.name,
      appLink(this.env.PUBLIC_APP_URL, '/account/invitation', locale, token),
    );
    try {
      await this.mailer.send({ to: invitation.email, ...mail, purpose: 'invitation' });
    } catch {
      throw mailUnavailable();
    }
    return this.view(invitation);
  }

  async revoke(ctx: AuthContext, invitationId: string, meta: RequestMeta) {
    const member = await this.inviter(ctx);
    const { count } = await this.db.invitation.updateMany({
      where: { id: invitationId, companyId: member.companyId, status: 'PENDING' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    if (count === 0)
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'No open invitation with this id.');
    await recordAuthEvent(this.db, meta, {
      type: 'INVITATION_REVOKED',
      actorId: ctx.user.id,
      sessionId: ctx.session.id,
      metadata: { invitationId },
    });
  }

  /** The signed-in account accepts; its email must be the invited one. */
  async accept(ctx: AuthContext, token: string, meta: RequestMeta) {
    const invitation = await this.db.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { company: true },
    });
    if (!invitation) throw tokenInvalid();
    if (invitation.status === 'ACCEPTED') throw tokenUsed();
    if (invitation.status === 'REVOKED' || invitation.expiresAt <= new Date()) throw tokenExpired();
    if (invitation.emailNormalized !== ctx.user.emailNormalized) {
      throw new AppError(
        403,
        'INVITATION_EMAIL_MISMATCH',
        'This invitation was sent to a different email address.',
      );
    }
    if (ctx.user.platformRole) {
      throw new AppError(
        409,
        'PLATFORM_ACCOUNT',
        'A platform operator account cannot join a customer company.',
      );
    }

    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const existing = await tx.companyMember.findUnique({ where: { userId: ctx.user.id } });
      if (existing) {
        throw new AppError(409, 'ALREADY_IN_COMPANY', 'This account already belongs to a company.');
      }
      const { count } = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING', expiresAt: { gt: now } },
        data: { status: 'ACCEPTED', acceptedAt: now, acceptedById: ctx.user.id },
      });
      if (count === 0) throw tokenUsed();
      await tx.companyMember.create({
        data: { companyId: invitation.companyId, userId: ctx.user.id, role: invitation.role },
      });
      await recordAuthEvent(tx, meta, {
        type: 'INVITATION_ACCEPTED',
        userId: ctx.user.id,
        actorId: invitation.invitedById,
        sessionId: ctx.session.id,
        metadata: { invitationId: invitation.id, role: invitation.role },
      });
    });
    return {
      company: { id: invitation.company.id, name: invitation.company.name },
      role: invitation.role,
    };
  }

  private view(i: {
    id: string;
    email: string;
    role: CompanyRole;
    status: string;
    expiresAt: Date;
  }) {
    return {
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      expiresAt: i.expiresAt.toISOString(),
    };
  }
}
