import type { Env } from '../config/env.js';
import type { Db } from '../db/client.js';
import { recordCompanyEvent } from '../company/audit.js';
import { requireCompanyAccess, type CompanyAccess } from '../company/context.js';
import type { InvitationInput } from '../company/input.js';
import { ASSIGNABLE_ROLES } from '../company/policy.js';
import type { DepartmentCode } from '../billing/catalog.js';
import type { AppLocale, BranchAccessScope, CompanyRole } from '../generated/prisma/enums.js';
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
 *
 * EP26: an invitation carries the intended departments and branch access,
 * validated when sent and applied at acceptance only as far as it is still
 * valid. Resending revokes the pending invitation and issues a fresh one (new
 * token, new expiry); a System Admin leaves System Admin invitations to the
 * owner. Lifecycle: PENDING → ACCEPTED | REVOKED, and EXPIRED (computed).
 */

/** Invitations one company may send per rolling day (abuse brake; normal use is far below). */
export const INVITATIONS_PER_COMPANY_PER_DAY = 50;

/** A pending invitation can be resent once this long after it was sent (EP26). */
export const INVITATION_RESEND_COOLDOWN_MS = 60_000;

const invitationNotFound = () =>
  new AppError(404, 'INVITATION_NOT_FOUND', 'No open invitation with this id.');

const peerAdmin = () =>
  new AppError(403, 'PEER_ADMIN', 'Only the Company Owner can manage a System Admin invitation.');

interface Intent {
  role: CompanyRole;
  departments: DepartmentCode[];
  branchScope: BranchAccessScope;
  branchIds: string[];
}

export class InvitationService {
  constructor(
    private readonly db: Db,
    private readonly env: Env,
    private readonly mailer: Mailer,
  ) {}

  /**
   * The intended access must be valid now: a role the inviter may give,
   * departments the company has enabled (which already respects the package),
   * branches that are active branches of the company. It is checked again at
   * acceptance — what was valid when sending may not be valid when joining.
   */
  private async assertIntent(access: CompanyAccess, intent: Intent) {
    if (!ASSIGNABLE_ROLES[access.actor.role].includes(intent.role)) {
      throw new AppError(403, 'ROLE_NOT_ASSIGNABLE', 'You cannot give this role.', {
        role: intent.role,
      });
    }
    const companyId = access.company.id;
    if (intent.departments.length) {
      const enabled = await this.db.department.findMany({
        where: { companyId, isActive: true, code: { in: intent.departments } },
        select: { code: true },
      });
      const missing = intent.departments.filter((d) => !enabled.some((e) => e.code === d));
      if (missing.length) {
        throw new AppError(422, 'DEPARTMENT_NOT_ENABLED', 'Assign only enabled departments.', {
          departments: missing,
        });
      }
    }
    if (intent.branchScope === 'SELECTED_BRANCHES') {
      const count = await this.db.branch.count({
        where: { id: { in: intent.branchIds }, companyId, status: 'ACTIVE' },
      });
      if (count !== intent.branchIds.length) {
        throw new AppError(
          422,
          'BRANCH_NOT_AVAILABLE',
          'Grant access only to active branches of this company.',
        );
      }
    }
  }

  async create(ctx: AuthContext, input: InvitationInput, meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'members.manage' });
    const company = access.company;
    const intent: Intent = {
      role: input.role,
      departments: input.departments ?? [],
      branchScope: input.branchScope,
      branchIds: input.branchIds ?? [],
    };
    await this.assertIntent(access, intent);
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
    const locale = input.locale ? toDbLocale(input.locale) : company.defaultLocale;
    const { invitation } = await this.issue(ctx, access, meta, {
      email: input.email.trim(),
      emailNormalized,
      locale,
      intent,
    });
    return this.view(invitation);
  }

  /**
   * Resend (EP26): the pending invitation is revoked and a fresh one with the
   * same intent, a new token and a new expiry replaces it — the old link never
   * works again. Expired-but-pending invitations can be resent too. The intent
   * is re-checked, and the daily company limit and a short cooldown apply.
   */
  async resend(ctx: AuthContext, invitationId: string, meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'members.manage' });
    const old = await this.db.invitation.findFirst({
      where: { id: invitationId, companyId: access.company.id, status: 'PENDING' },
    });
    if (!old) throw invitationNotFound();
    if (!ASSIGNABLE_ROLES[access.actor.role].includes(old.role)) throw peerAdmin();
    if (Date.now() - old.createdAt.getTime() < INVITATION_RESEND_COOLDOWN_MS) {
      throw new AppError(
        429,
        'RESEND_TOO_SOON',
        'This invitation was just sent. Try again shortly.',
      );
    }
    const intent: Intent = {
      role: old.role,
      departments: old.departments,
      branchScope: old.branchScope,
      branchIds: old.branchIds,
    };
    await this.assertIntent(access, intent);
    const { invitation } = await this.issue(ctx, access, meta, {
      email: old.email,
      emailNormalized: old.emailNormalized,
      locale: old.locale ?? access.company.defaultLocale,
      intent,
      resentFrom: old.id,
    });
    return this.view(invitation);
  }

  /**
   * Creates the invitation (replacing any open one for the address), audits it
   * and mails the link. The raw token exists only in the email.
   */
  private async issue(
    ctx: AuthContext,
    access: CompanyAccess,
    meta: RequestMeta,
    v: {
      email: string;
      emailNormalized: string;
      locale: AppLocale;
      intent: Intent;
      resentFrom?: string;
    },
  ) {
    const company = access.company;
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
    const token = randomToken();
    const invitation = await this.db.$transaction(async (tx) => {
      // One open invitation per address and company: a new one replaces the old.
      const replaced = await tx.invitation.updateMany({
        where: { companyId: company.id, emailNormalized: v.emailNormalized, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      if (v.resentFrom && replaced.count === 0) throw invitationNotFound();
      const created = await tx.invitation.create({
        data: {
          companyId: company.id,
          email: v.email,
          emailNormalized: v.emailNormalized,
          role: v.intent.role,
          locale: v.locale,
          tokenHash: sha256(token),
          invitedById: ctx.user.id,
          expiresAt: new Date(Date.now() + AUTH_POLICY.invitation.ttlMs),
          departments: v.intent.departments,
          branchScope: v.intent.branchScope,
          branchIds: v.intent.branchScope === 'SELECTED_BRANCHES' ? v.intent.branchIds : [],
          resentFromId: v.resentFrom ?? null,
        },
      });
      await recordAuthEvent(tx, meta, {
        type: 'INVITATION_CREATED',
        actorId: ctx.user.id,
        sessionId: ctx.session.id,
        metadata: { invitationId: created.id, role: v.intent.role },
      });
      await recordCompanyEvent(tx, meta, {
        action: v.resentFrom ? 'INVITATION_RESENT' : 'INVITATION_SENT',
        actorId: ctx.user.id,
        actorScope: 'customer',
        companyId: company.id,
        entityType: 'Invitation',
        entityId: created.id,
        details: {
          email: created.email,
          role: v.intent.role,
          locale: toApiLocale(v.locale),
          departments: v.intent.departments,
          branchScope: v.intent.branchScope,
          ...(v.resentFrom ? { previousInvitationId: v.resentFrom } : {}),
        },
      });
      return created;
    });

    const mailTo = mailLocale(v.locale);
    const mail = invitationMail(mailTo, {
      companyName: company.name,
      inviterName: ctx.user.fullName ?? ctx.user.email,
      role: v.intent.role,
      expiresAt: invitation.expiresAt,
      timeZone: company.timezone,
      url: appLink(this.env.PUBLIC_APP_URL, '/account/invitation', mailTo, token),
      access: {
        departments: v.intent.departments,
        branches: v.intent.branchScope === 'ALL_BRANCHES' ? 'ALL' : v.intent.branchIds.length,
      },
    });
    try {
      await this.mailer.send({ to: invitation.email, ...mail, purpose: 'invitation' });
    } catch {
      throw mailUnavailable();
    }
    return { invitation };
  }

  async revoke(ctx: AuthContext, invitationId: string, meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'members.manage' });
    const open = await this.db.invitation.findFirst({
      where: { id: invitationId, companyId: access.company.id, status: 'PENDING' },
      select: { role: true },
    });
    if (!open) throw invitationNotFound();
    // EP26: a System Admin leaves System Admin invitations to the owner.
    if (!ASSIGNABLE_ROLES[access.actor.role].includes(open.role)) throw peerAdmin();
    await this.db.$transaction(async (tx) => {
      const { count } = await tx.invitation.updateMany({
        where: { id: invitationId, companyId: access.company.id, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      if (count === 0) throw invitationNotFound();
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

  /**
   * The signed-in account accepts; its email must be the invited one. The
   * intent is applied as it is valid NOW: only departments the company still
   * has enabled, only branches that are still its active branches. What was
   * dropped is recorded. A restricted invitation whose branches are all gone
   * leaves the member with no branch (fail closed) — the Control Center then
   * flags them for the administrators.
   */
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
      // Never the owner role, whatever the row says (also a database CHECK).
      if (invitation.role === 'COMPANY_OWNER') throw tokenInvalid();
      // EP26: the intent, as valid now.
      const [departments, branches] = await Promise.all([
        tx.department.findMany({
          where: {
            companyId: invitation.companyId,
            isActive: true,
            code: { in: invitation.departments },
          },
        }),
        invitation.branchScope === 'SELECTED_BRANCHES'
          ? tx.branch.findMany({
              where: {
                id: { in: invitation.branchIds },
                companyId: invitation.companyId,
                status: 'ACTIVE',
              },
            })
          : Promise.resolve([]),
      ]);
      const member = await tx.companyMember.create({
        data: {
          companyId: invitation.companyId,
          userId: ctx.user.id,
          role: invitation.role,
          branchScope: invitation.branchScope,
        },
      });
      // Primary only when there is exactly one department (as on the Users page).
      if (departments.length) {
        await tx.membership.createMany({
          data: departments.map((d) => ({
            userId: ctx.user.id,
            departmentId: d.id,
            isPrimary: departments.length === 1,
          })),
        });
      }
      if (branches.length) {
        await tx.memberBranchAccess.createMany({
          data: branches.map((b) => ({
            companyId: invitation.companyId,
            memberId: member.id,
            branchId: b.id,
            grantedById: invitation.invitedById,
          })),
        });
      }
      const applied = departments.map((d) => d.code);
      const intentApplied = {
        departments: applied,
        droppedDepartments: invitation.departments.filter((d) => !applied.includes(d)),
        branchScope: invitation.branchScope,
        branches: branches.map((b) => b.code).sort(),
        droppedBranches: invitation.branchIds.length - branches.length,
      };
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
        details: {
          invitationId: invitation.id,
          role: invitation.role,
          departments: intentApplied.departments,
          droppedDepartments: intentApplied.droppedDepartments,
          branchScope: intentApplied.branchScope,
          branches: intentApplied.branches,
          droppedBranches: intentApplied.droppedBranches,
        },
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
