import type { Env } from '../config/env.js';
import type { Db } from '../db/client.js';
import { recordCompanyEvent } from '../company/audit.js';
import { requireCompanyAccess } from '../company/context.js';
import type { InvitationInput } from '../company/input.js';
import { ASSIGNABLE_ROLES } from '../company/policy.js';
import type { CompanyRole } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import type { Mailer } from '../mail/mailer.js';
import { appLink, invitationMail } from '../mail/templates.js';
import { recordAuthEvent, type RequestMeta } from './audit.js';
import { normalizeEmail, randomToken, sha256 } from './crypto.js';
import { mailUnavailable, tokenExpired, tokenInvalid, tokenUsed } from './errors.js';
import { mailLocale, toApiLocale, toDbLocale } from './locale.js';
import { AUTH_POLICY } from './policy.js';
import type { AuthContext } from './sessions.js';

/*
 * Company invitations (EP23 foundation, completed in EP25 for the Company
 * Control Center). Single use, 7-day expiry, revocable, bound to the invitee's
 * email and to one company, with the inviter recorded. The token is 256 random
 * bits; only its SHA-256 is stored, and it travels in the link's #fragment.
 * Accepting creates the CompanyMember in the same transaction that consumes
 * the invitation, so a token can never be used twice.
 *
 * EP25: only an active Owner / System Admin of an active company invites
 * (role policy in src/company/policy.ts); COMPANY_OWNER is never invitable and
 * a System Admin cannot invite its peers. Invitations are also recorded on the
 * company's activity, and the email follows the chosen (or company) language.
 */

/** Invitations one company may send per rolling day (abuse brake; normal use is far below). */
export const INVITATIONS_PER_COMPANY_PER_DAY = 50;

export class InvitationService {
  constructor(
    private readonly db: Db,
    private readonly env: Env,
    private readonly mailer: Mailer,
  ) {}

  async create(ctx: AuthContext, input: InvitationInput, meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'members.manage' });
    const company = access.company;
    if (!ASSIGNABLE_ROLES[access.actor.role].includes(input.role)) {
      throw new AppError(403, 'ROLE_NOT_ASSIGNABLE', 'You cannot give this role.', {
        role: input.role,
      });
    }
    const emailNormalized = normalizeEmail(input.email);
    // Someone already in THIS company is managed on the Users page, not invited again.
    // (Whether an address belongs to another company is never revealed here.)
    const existing = await this.db.companyMember.findFirst({
      where: { companyId: company.id, user: { emailNormalized } },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, 'ALREADY_MEMBER', 'This person is already a member of the company.');
    }
    const sentToday = await this.db.invitation.count({
      where: { companyId: company.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    if (sentToday >= INVITATIONS_PER_COMPANY_PER_DAY) {
      throw new AppError(
        429,
        'INVITATION_LIMIT',
        'Too many invitations today. Try again tomorrow.',
      );
    }

    const locale = input.locale ? toDbLocale(input.locale) : company.defaultLocale;
    const token = randomToken();
    const invitation = await this.db.$transaction(async (tx) => {
      // One open invitation per address and company: a new one replaces the old.
      await tx.invitation.updateMany({
        where: { companyId: company.id, emailNormalized, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      const created = await tx.invitation.create({
        data: {
          companyId: company.id,
          email: input.email.trim(),
          emailNormalized,
          role: input.role,
          locale,
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
      await recordCompanyEvent(tx, meta, {
        action: 'INVITATION_SENT',
        actorId: ctx.user.id,
        actorScope: 'customer',
        companyId: company.id,
        entityType: 'Invitation',
        entityId: created.id,
        details: { email: created.email, role: input.role, locale: toApiLocale(locale) },
      });
      return created;
    });

    const mailTo = mailLocale(locale);
    const mail = invitationMail(mailTo, {
      companyName: company.name,
      inviterName: ctx.user.fullName ?? ctx.user.email,
      role: input.role,
      expiresAt: invitation.expiresAt,
      timeZone: company.timezone,
      url: appLink(this.env.PUBLIC_APP_URL, '/account/invitation', mailTo, token),
    });
    try {
      await this.mailer.send({ to: invitation.email, ...mail, purpose: 'invitation' });
    } catch {
      throw mailUnavailable();
    }
    return this.view(invitation);
  }

  async revoke(ctx: AuthContext, invitationId: string, meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'members.manage' });
    await this.db.$transaction(async (tx) => {
      const { count } = await tx.invitation.updateMany({
        where: { id: invitationId, companyId: access.company.id, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      if (count === 0)
        throw new AppError(404, 'INVITATION_NOT_FOUND', 'No open invitation with this id.');
      await recordAuthEvent(tx, meta, {
        type: 'INVITATION_REVOKED',
        actorId: ctx.user.id,
        sessionId: ctx.session.id,
        metadata: { invitationId },
      });
      await recordCompanyEvent(tx, meta, {
        action: 'INVITATION_REVOKED',
        actorId: ctx.user.id,
        actorScope: 'customer',
        companyId: access.company.id,
        entityType: 'Invitation',
        entityId: invitationId,
      });
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
    if (invitation.company.status === 'SUSPENDED' || invitation.company.status === 'CLOSED') {
      throw new AppError(409, 'COMPANY_UNAVAILABLE', 'This company is not accepting members now.');
    }

    const now = new Date();
    await this.db.$transaction(async (tx) => {
      // v1 rule: one company per account (also a unique index on CompanyMember.userId).
      const existing = await tx.companyMember.findUnique({ where: { userId: ctx.user.id } });
      if (existing) {
        throw new AppError(409, 'ALREADY_IN_COMPANY', 'This account already belongs to a company.');
      }
      const { count } = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING', expiresAt: { gt: now } },
        data: { status: 'ACCEPTED', acceptedAt: now, acceptedById: ctx.user.id },
      });
      if (count === 0) throw tokenUsed();
      const member = await tx.companyMember.create({
        data: { companyId: invitation.companyId, userId: ctx.user.id, role: invitation.role },
      });
      await recordAuthEvent(tx, meta, {
        type: 'INVITATION_ACCEPTED',
        userId: ctx.user.id,
        actorId: invitation.invitedById,
        sessionId: ctx.session.id,
        metadata: { invitationId: invitation.id, role: invitation.role },
      });
      await recordCompanyEvent(tx, meta, {
        action: 'INVITATION_ACCEPTED',
        actorId: ctx.user.id,
        actorScope: 'customer',
        companyId: invitation.companyId,
        entityType: 'CompanyMember',
        entityId: member.id,
        details: { invitationId: invitation.id, role: invitation.role },
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
