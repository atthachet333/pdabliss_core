import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env.js';
import type { Db } from '../db/client.js';
import type { User } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import type { Mailer } from '../mail/mailer.js';
import {
  appLink,
  existingAccountMail,
  passwordChangedMail,
  passwordResetMail,
  verifyEmailMail,
} from '../mail/templates.js';
import { recordAuthEvent, type RequestMeta } from './audit.js';
import { normalizeEmail, randomToken, sha256, subjectHash } from './crypto.js';
import { demoBypassEnabled, isDemoBypassAccount } from './demo-bypass.js';
import type { JobFunctionCode, SignupContextInput } from './profile.js';
import {
  accountUnavailable,
  emailNotVerified,
  invalidCredentials,
  loginThrottled,
  mailUnavailable,
  passwordPolicy,
  tokenExpired,
  tokenInvalid,
  tokenUsed,
} from './errors.js';
import { canEnterCore } from '../company/entitlements.js';
import { mailLocale, toApiLocale, toDbLocale, type ApiLocale } from './locale.js';
import {
  createChallenge,
  resendChallenge,
  verifyChallenge,
  type ChallengeView,
  type OtpDeps,
} from './otp.js';
import {
  burnPasswordCheck,
  checkPassword,
  hashPassword,
  needsRehash,
  verifyPassword,
} from './password.js';
import { AUTH_POLICY, type PlanIntent } from './policy.js';
import {
  createSession,
  createTrustedDevice,
  isTrustedDevice,
  needsRotation,
  revokeAllSessions,
  revokeSession,
  revokeTrustedDevices,
  rotateSession,
  sessionExpiresAt,
  type AuthContext,
} from './sessions.js';

/*
 * Account and authentication service (EP23). Routes stay thin: they validate
 * input, call one method and set cookies. Every rule lives here, server-side.
 */

export interface AuthDeps {
  db: Db;
  env: Env;
  mailer: Mailer;
  log: FastifyBaseLogger;
}

export type LoginResult =
  | { kind: 'session'; token: string; context: Omit<AuthContext, 'rotatedToken'> }
  | {
      kind: 'otp';
      challenge: ChallengeView;
      bindingToken: string;
      /** False for platform accounts: they never get a trusted browser. */
      trustDeviceAllowed: boolean;
    };

export interface IdentityView {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    /** E.164; the account's own contact number (shown only to its owner and platform operators). */
    phone: string | null;
    /** Self-described; never an authorization input. */
    jobFunction: JobFunctionCode | null;
    /** What the person said about their business at sign-up (lead info; never authorization). */
    signup: {
      companyName: string;
      industry: string;
      teamSize: string;
      preferredContact: string;
      interests: string[];
    } | null;
    locale: ApiLocale;
    status: string;
    emailVerified: boolean;
    createdAt: string;
  };
  platformRole: 'PLATFORM_OWNER' | 'PLATFORM_ADMIN' | null;
  company: {
    id: string;
    name: string;
    isDemo: boolean;
    role: string;
    /** EP25: ACTIVE, or DEACTIVATED by the company (then no company access). */
    memberStatus: 'ACTIVE' | 'DEACTIVATED';
    /** EP25: the company and its subscription are active — the Company Control Center is open. */
    canEnterCore: boolean;
  } | null;
  onboarding: {
    state: 'platform_operator' | 'company_ready' | 'onboarding_required';
    planIntent: string | null;
  };
  session: {
    id: string;
    privileged: boolean;
    createdAt: string;
    expiresAt: string;
    stepUpValidUntil: string | null;
  };
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

export class AuthService {
  /** Development / test only: see src/auth/demo-bypass.ts. Always false in production. */
  readonly demoBypass: boolean;

  constructor(private readonly deps: AuthDeps) {
    this.demoBypass = demoBypassEnabled(deps.env);
  }

  private get db() {
    return this.deps.db;
  }

  private get otp(): OtpDeps {
    return { db: this.deps.db, mailer: this.deps.mailer, secret: this.deps.env.AUTH_SECRET };
  }

  private link(path: string, user: Pick<User, 'locale'>, token?: string) {
    return appLink(this.deps.env.PUBLIC_APP_URL, path, mailLocale(user.locale), token);
  }

  private async sendOrFail(send: () => Promise<void>) {
    try {
      await send();
    } catch {
      throw mailUnavailable();
    }
  }

  // ---------------------------------------------------------------- register

  /**
   * Self-registration. The response is the same whether or not the address
   * already has an account: an existing owner gets an email ("you already
   * have an account") instead of a second account, so the endpoint cannot be
   * used to discover who is registered.
   */
  async register(
    input: {
      email: string;
      password: string;
      fullName: string;
      phone: string;
      jobFunction?: JobFunctionCode;
      business: SignupContextInput;
      locale?: ApiLocale;
      plan?: PlanIntent;
    },
    meta: RequestMeta,
  ): Promise<void> {
    const emailNormalized = normalizeEmail(input.email);
    const problem = checkPassword(input.password, emailNormalized);
    if (problem) throw passwordPolicy(problem);
    // Hash before looking the address up, so both paths cost the same time.
    const passwordHash = await hashPassword(input.password);

    const existing = await this.db.user.findUnique({ where: { emailNormalized } });
    if (existing) return this.registerExisting(existing, meta);

    let user: User;
    try {
      user = await this.db.user.create({
        data: {
          email: input.email.trim(),
          emailNormalized,
          fullName: input.fullName,
          phone: input.phone,
          jobFunction: input.jobFunction ?? null,
          signupContext: { create: input.business },
          locale: toDbLocale(input.locale),
          planIntent: input.plan ?? null,
          status: 'PENDING_VERIFICATION',
          credential: { create: { passwordHash } },
        },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // Concurrent registration of the same address: the other request won.
      const winner = await this.db.user.findUniqueOrThrow({ where: { emailNormalized } });
      return this.registerExisting(winner, meta);
    }
    await recordAuthEvent(this.db, meta, {
      type: 'REGISTER',
      userId: user.id,
      metadata: { plan: input.plan ?? null },
    });
    await this.issueVerification(user, meta, { force: true });
  }

  private async registerExisting(user: User, meta: RequestMeta) {
    if (user.status === 'PENDING_VERIFICATION') {
      await this.issueVerification(user, meta);
      return;
    }
    const recent = await this.db.authAuditEvent.count({
      where: {
        userId: user.id,
        type: 'REGISTER_EXISTING_EMAIL',
        occurredAt: { gte: new Date(Date.now() - 15 * 60_000) },
      },
    });
    await recordAuthEvent(this.db, meta, { type: 'REGISTER_EXISTING_EMAIL', userId: user.id });
    if (recent > 0 || user.status !== 'ACTIVE') return;
    const mail = existingAccountMail(mailLocale(user.locale), this.link('/login', user));
    await this.sendOrFail(() =>
      this.deps.mailer.send({ to: user.email, ...mail, purpose: 'existing_account' }),
    );
  }

  /** Creates and emails a verification link (respecting the cooldown and daily cap). */
  private async issueVerification(user: User, meta: RequestMeta, opts: { force?: boolean } = {}) {
    const V = AUTH_POLICY.emailVerification;
    const now = Date.now();
    if (!opts.force) {
      const last = await this.db.emailVerificationToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      if (last && now - last.createdAt.getTime() < V.cooldownMs) return;
      const today = await this.db.emailVerificationToken.count({
        where: { userId: user.id, createdAt: { gte: new Date(now - 86_400_000) } },
      });
      if (today >= V.maxPerDay) return;
    }
    const token = randomToken();
    await this.db.$transaction([
      this.db.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null, replacedAt: null },
        data: { replacedAt: new Date() },
      }),
      this.db.emailVerificationToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(now + V.ttlMs) },
      }),
    ]);
    const mail = verifyEmailMail(mailLocale(user.locale), this.link('/verify-email', user, token));
    await this.sendOrFail(() =>
      this.deps.mailer.send({ to: user.email, ...mail, purpose: 'verify_email' }),
    );
    await recordAuthEvent(this.db, meta, { type: 'EMAIL_VERIFICATION_SENT', userId: user.id });
  }

  /** Always "accepted": never reveals whether the address is registered or verified. */
  async resendVerification(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { emailNormalized: normalizeEmail(email) },
    });
    if (user?.status === 'PENDING_VERIFICATION') await this.issueVerification(user, meta);
  }

  async verifyEmail(token: string, meta: RequestMeta): Promise<'verified' | 'already_verified'> {
    const record = await this.db.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!record) throw tokenInvalid();
    const verifiedAlready = !!record.user.emailVerifiedAt;
    if (record.usedAt || record.replacedAt || record.expiresAt <= new Date()) {
      if (verifiedAlready) return 'already_verified';
      if (record.usedAt) throw tokenUsed();
      throw tokenExpired();
    }

    const now = new Date();
    const outcome = await this.db.$transaction(async (tx) => {
      const { count } = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, usedAt: null, replacedAt: null },
        data: { usedAt: now },
      });
      if (count === 0) return 'race' as const;
      if (verifiedAlready) return 'already_verified' as const;
      await tx.user.update({
        where: { id: record.userId },
        data: {
          emailVerifiedAt: now,
          ...(record.user.status === 'PENDING_VERIFICATION' ? { status: 'ACTIVE' } : {}),
        },
      });
      await tx.emailVerificationToken.updateMany({
        where: { userId: record.userId, usedAt: null, replacedAt: null },
        data: { replacedAt: now },
      });
      await recordAuthEvent(tx, meta, { type: 'EMAIL_VERIFIED', userId: record.userId });
      return 'verified' as const;
    });
    if (outcome === 'race') {
      const user = await this.db.user.findUniqueOrThrow({ where: { id: record.userId } });
      if (user.emailVerifiedAt) return 'already_verified';
      throw tokenUsed();
    }
    return outcome;
  }

  // ------------------------------------------------------------------- login

  private async throttleKey(emailNormalized: string) {
    const subject = subjectHash(this.deps.env.AUTH_SECRET, emailNormalized);
    const L = AUTH_POLICY.login;
    const lastSuccess = await this.db.authAuditEvent.findFirst({
      where: { subjectHash: subject, type: 'LOGIN_SUCCESS' },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    });
    const windowStart = new Date(Date.now() - L.failureWindowMs);
    const since =
      lastSuccess && lastSuccess.occurredAt > windowStart ? lastSuccess.occurredAt : windowStart;
    const failures = await this.db.authAuditEvent.count({
      where: { subjectHash: subject, type: 'LOGIN_FAILURE', occurredAt: { gt: since } },
    });
    return { subject, throttled: failures >= L.maxFailures };
  }

  /**
   * Email + password. Status details (unverified, suspended) are only revealed
   * after the correct password; otherwise one generic answer. A session is
   * created only after every required check, including the email code.
   */
  async login(
    input: { email: string; password: string },
    deviceToken: string | undefined,
    meta: RequestMeta,
  ): Promise<LoginResult> {
    const emailNormalized = normalizeEmail(input.email);
    const { subject, throttled } = await this.throttleKey(emailNormalized);
    if (throttled) {
      await recordAuthEvent(this.db, meta, {
        type: 'LOGIN_FAILURE',
        subjectHash: subject,
        metadata: { reason: 'throttled' },
      });
      throw loginThrottled();
    }

    const user = await this.db.user.findUnique({
      where: { emailNormalized },
      include: { credential: true, platformRole: { select: { role: true } } },
    });
    const fail = async (reason: string, userId?: string) =>
      recordAuthEvent(this.db, meta, {
        type: 'LOGIN_FAILURE',
        userId: userId ?? null,
        subjectHash: subject,
        metadata: { reason },
      });

    if (!user?.credential) {
      await burnPasswordCheck(input.password);
      await fail('unknown_account');
      throw invalidCredentials();
    }
    if (!(await verifyPassword(user.credential.passwordHash, input.password))) {
      await fail('bad_password', user.id);
      throw invalidCredentials();
    }
    if (user.status === 'SUSPENDED' || user.status === 'DISABLED') {
      await fail('account_unavailable', user.id);
      throw accountUnavailable();
    }
    if (user.status !== 'ACTIVE' || !user.emailVerifiedAt) {
      await fail('email_not_verified', user.id);
      throw emailNotVerified();
    }
    if (needsRehash(user.credential.passwordHash)) {
      await this.db.userCredential.update({
        where: { userId: user.id },
        data: { passwordHash: await hashPassword(input.password) },
      });
    }

    // Platform accounts: a code on every sign-in. Customers: on a new browser.
    const privileged = !!user.platformRole;
    // DEVELOPMENT ONLY: the seeded demo customers skip the code (after the
    // password and status checks above). Never a platform account.
    if (!privileged && this.demoBypass && (await isDemoBypassAccount(this.db, user))) {
      await recordAuthEvent(this.db, meta, {
        type: 'DEMO_AUTH_BYPASS',
        userId: user.id,
        subjectHash: subject,
        metadata: { skipped: 'login_otp' },
      });
      return this.openSession(user, { privileged: false, stepUp: false, subject, meta });
    }
    const trusted = !privileged && (await isTrustedDevice(this.db, user.id, deviceToken));
    if (!trusted) {
      const bindingToken = randomToken();
      const challenge = await createChallenge(
        this.otp,
        user,
        'LOGIN',
        { bindingHash: sha256(bindingToken) },
        meta,
      );
      return { kind: 'otp', challenge, bindingToken, trustDeviceAllowed: !privileged };
    }
    return this.openSession(user, { privileged: false, stepUp: false, subject, meta });
  }

  private async openSession(
    user: User & { platformRole: { role: 'PLATFORM_OWNER' | 'PLATFORM_ADMIN' } | null },
    opts: {
      privileged: boolean;
      stepUp: boolean;
      subject: string;
      meta: RequestMeta;
      otp?: boolean;
    },
  ): Promise<Extract<LoginResult, { kind: 'session' }>> {
    const { token, session } = await createSession(this.db, user.id, opts);
    const updated = await this.db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { platformRole: { select: { role: true } } },
    });
    await recordAuthEvent(this.db, opts.meta, {
      type: 'LOGIN_SUCCESS',
      userId: user.id,
      sessionId: session.id,
      subjectHash: opts.subject,
      metadata: { otp: !!opts.otp, platformRole: user.platformRole?.role ?? null },
    });
    return { kind: 'session', token, context: { session, user: updated } };
  }

  async completeLoginOtp(
    input: { challengeId: string; code: string; trustDevice: boolean },
    bindingToken: string | undefined,
    meta: RequestMeta,
  ): Promise<{ result: Extract<LoginResult, { kind: 'session' }>; deviceToken?: string }> {
    const challenge = await verifyChallenge(
      this.otp,
      input.challengeId,
      input.code,
      { purpose: 'LOGIN', bindingToken },
      meta,
    );
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: challenge.userId },
      include: { platformRole: { select: { role: true } } },
    });
    // The account may have changed while the code was in transit.
    if (user.status !== 'ACTIVE' || !user.emailVerifiedAt) throw accountUnavailable();
    const privileged = !!user.platformRole;
    const result = await this.openSession(user, {
      privileged,
      stepUp: true,
      subject: subjectHash(this.deps.env.AUTH_SECRET, user.emailNormalized),
      meta,
      otp: true,
    });
    const deviceToken =
      input.trustDevice && !privileged
        ? await createTrustedDevice(this.db, user.id, meta)
        : undefined;
    return { result, deviceToken };
  }

  resendLoginOtp(challengeId: string, bindingToken: string | undefined, meta: RequestMeta) {
    return resendChallenge(this.otp, challengeId, { purpose: 'LOGIN', bindingToken }, meta);
  }

  // ----------------------------------------------------------------- step-up

  startStepUp(ctx: AuthContext, meta: RequestMeta) {
    return createChallenge(this.otp, ctx.user, 'STEP_UP', { sessionId: ctx.session.id }, meta);
  }

  resendStepUp(ctx: AuthContext, challengeId: string, meta: RequestMeta) {
    return resendChallenge(
      this.otp,
      challengeId,
      { purpose: 'STEP_UP', sessionId: ctx.session.id },
      meta,
    );
  }

  /** A verified step-up code refreshes stepUpAt and rotates the session token. */
  async completeStepUp(ctx: AuthContext, challengeId: string, code: string, meta: RequestMeta) {
    await verifyChallenge(
      this.otp,
      challengeId,
      code,
      { purpose: 'STEP_UP', sessionId: ctx.session.id },
      meta,
    );
    const rotated = await rotateSession(this.db, ctx.session, { stepUpAt: new Date() });
    await recordAuthEvent(this.db, meta, {
      type: 'STEP_UP_SUCCESS',
      userId: ctx.user.id,
      sessionId: ctx.session.id,
    });
    return { ...ctx, session: rotated.session, rotatedToken: rotated.token };
  }

  // ---------------------------------------------------------- password reset

  /** Always "accepted": the response never says whether an account exists. */
  async forgotPassword(email: string, meta: RequestMeta): Promise<void> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.db.user.findUnique({ where: { emailNormalized } });
    if (!user || user.status === 'SUSPENDED' || user.status === 'DISABLED') {
      await recordAuthEvent(this.db, meta, {
        type: 'PASSWORD_RESET_REQUEST',
        userId: user?.id ?? null,
        subjectHash: subjectHash(this.deps.env.AUTH_SECRET, emailNormalized),
        metadata: { sent: false },
      });
      return;
    }
    const R = AUTH_POLICY.passwordReset;
    const now = Date.now();
    const recent = await this.db.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: new Date(now - 3_600_000) } },
    });
    if (recent >= R.maxPerHour) {
      await recordAuthEvent(this.db, meta, {
        type: 'PASSWORD_RESET_REQUEST',
        userId: user.id,
        metadata: { sent: false, reason: 'limit' },
      });
      return;
    }
    const token = randomToken();
    await this.db.$transaction([
      this.db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, replacedAt: null },
        data: { replacedAt: new Date() },
      }),
      this.db.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(now + R.ttlMs) },
      }),
    ]);
    const mail = passwordResetMail(
      mailLocale(user.locale),
      this.link('/reset-password', user, token),
    );
    await this.sendOrFail(() =>
      this.deps.mailer.send({ to: user.email, ...mail, purpose: 'password_reset' }),
    );
    await recordAuthEvent(this.db, meta, {
      type: 'PASSWORD_RESET_REQUEST',
      userId: user.id,
      metadata: { sent: true },
    });
  }

  private async loadResetToken(token: string) {
    const record = await this.db.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!record) throw tokenInvalid();
    if (record.usedAt) throw tokenUsed();
    if (record.replacedAt || record.expiresAt <= new Date()) throw tokenExpired();
    if (record.user.status === 'SUSPENDED' || record.user.status === 'DISABLED') {
      throw accountUnavailable();
    }
    return record;
  }

  /** Lets the page show "expired" before the person types a new password. */
  async checkResetToken(token: string): Promise<void> {
    await this.loadResetToken(token);
  }

  /**
   * Sets the new password and signs the account out everywhere: every
   * session, trusted device and pending code is invalidated in the same
   * transaction. Completing a reset also proves ownership of the address.
   */
  async resetPassword(token: string, password: string, meta: RequestMeta): Promise<void> {
    const record = await this.loadResetToken(token);
    const problem = checkPassword(password, record.user.emailNormalized);
    if (problem) throw passwordPolicy(problem);
    const passwordHash = await hashPassword(password);
    const now = new Date();

    const revoked = await this.db.$transaction(async (tx) => {
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, replacedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (count === 0) throw tokenUsed();
      await tx.userCredential.upsert({
        where: { userId: record.userId },
        create: { userId: record.userId, passwordHash, passwordChangedAt: now },
        update: { passwordHash, passwordChangedAt: now },
      });
      await tx.user.update({
        where: { id: record.userId },
        data: {
          emailVerifiedAt: record.user.emailVerifiedAt ?? now,
          ...(record.user.status === 'PENDING_VERIFICATION' ? { status: 'ACTIVE' } : {}),
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null, replacedAt: null },
        data: { replacedAt: now },
      });
      await tx.otpChallenge.updateMany({
        where: { userId: record.userId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      await revokeTrustedDevices(tx, record.userId);
      const sessions = await revokeAllSessions(tx, record.userId, 'PASSWORD_RESET');
      await recordAuthEvent(tx, meta, {
        type: 'PASSWORD_RESET_SUCCESS',
        userId: record.userId,
        metadata: { sessionsRevoked: sessions },
      });
      return sessions;
    });
    this.deps.log.info(
      { event: 'password_reset', sessionsRevoked: revoked },
      'password reset completed',
    );

    // Security notice. Best effort: the reset itself has already succeeded.
    const mail = passwordChangedMail(
      mailLocale(record.user.locale),
      this.link('/login', record.user),
    );
    await this.deps.mailer
      .send({ to: record.user.email, ...mail, purpose: 'password_changed' })
      .catch(() => this.deps.log.warn({ event: 'mail_failed', purpose: 'password_changed' }));
  }

  // ---------------------------------------------------------------- sessions

  /** Rotates an old token on read (the route then sets the new cookie). */
  async refreshIfDue(ctx: AuthContext): Promise<AuthContext> {
    if (!needsRotation(ctx.session)) return ctx;
    const rotated = await rotateSession(this.db, ctx.session);
    return { ...ctx, session: rotated.session, rotatedToken: rotated.token };
  }

  async logout(ctx: AuthContext, meta: RequestMeta) {
    await revokeSession(this.db, ctx.session.id, 'LOGOUT');
    await recordAuthEvent(this.db, meta, {
      type: 'LOGOUT',
      userId: ctx.user.id,
      sessionId: ctx.session.id,
    });
  }

  /** Signs out every device, and forgets trusted browsers (next sign-in asks for a code). */
  async logoutAll(ctx: AuthContext, meta: RequestMeta) {
    const count = await this.db.$transaction(async (tx) => {
      await revokeTrustedDevices(tx, ctx.user.id);
      return revokeAllSessions(tx, ctx.user.id, 'LOGOUT_ALL');
    });
    await recordAuthEvent(this.db, meta, {
      type: 'LOGOUT_ALL',
      userId: ctx.user.id,
      sessionId: ctx.session.id,
      metadata: { sessionsRevoked: count },
    });
  }

  async listSessions(ctx: AuthContext) {
    const sessions = await this.db.session.findMany({
      where: {
        userId: ctx.user.id,
        revokedAt: null,
        idleExpiresAt: { gt: new Date() },
        absoluteExpiresAt: { gt: new Date() },
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      current: s.id === ctx.session.id,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      expiresAt: sessionExpiresAt(s).toISOString(),
      userAgent: s.userAgent,
    }));
  }

  /** Revokes one of the caller's own sessions. Someone else's id is "not found". */
  async revokeOwnSession(ctx: AuthContext, sessionId: string, meta: RequestMeta) {
    const { count } = await this.db.session.updateMany({
      where: { id: sessionId, userId: ctx.user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'REVOKED_BY_USER' },
    });
    if (count === 0) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found.');
    await recordAuthEvent(this.db, meta, {
      type: 'SESSION_REVOKED',
      userId: ctx.user.id,
      sessionId,
      metadata: { current: sessionId === ctx.session.id },
    });
  }

  // ---------------------------------------------------------------- identity

  async identity(ctx: AuthContext): Promise<IdentityView> {
    const [member, signup] = await Promise.all([
      this.db.companyMember.findUnique({
        where: { userId: ctx.user.id },
        include: {
          company: { include: { subscriptions: { where: { currentSlot: true }, take: 1 } } },
        },
      }),
      this.db.accountSignupContext.findUnique({ where: { userId: ctx.user.id } }),
    ]);
    const platformRole = ctx.user.platformRole?.role ?? null;
    const stepUpUntil = ctx.session.stepUpAt
      ? new Date(ctx.session.stepUpAt.getTime() + AUTH_POLICY.stepUpFreshMs)
      : null;
    return {
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        fullName: ctx.user.fullName,
        phone: ctx.user.phone,
        jobFunction: ctx.user.jobFunction,
        signup: signup
          ? {
              companyName: signup.companyName,
              industry: signup.industry,
              teamSize: signup.teamSize,
              preferredContact: signup.preferredContact,
              interests: signup.interests,
            }
          : null,
        locale: toApiLocale(ctx.user.locale),
        status: ctx.user.status,
        emailVerified: !!ctx.user.emailVerifiedAt,
        createdAt: ctx.user.createdAt.toISOString(),
      },
      platformRole,
      company: member
        ? {
            id: member.company.id,
            name: member.company.name,
            isDemo: member.company.isDemo,
            role: member.role,
            memberStatus: member.status,
            canEnterCore:
              member.status === 'ACTIVE' &&
              canEnterCore(member.company, member.company.subscriptions[0] ?? null),
          }
        : null,
      onboarding: {
        state: platformRole
          ? 'platform_operator'
          : member
            ? 'company_ready'
            : 'onboarding_required',
        planIntent: ctx.user.planIntent,
      },
      session: {
        id: ctx.session.id,
        privileged: ctx.session.privileged,
        createdAt: ctx.session.createdAt.toISOString(),
        expiresAt: sessionExpiresAt(ctx.session).toISOString(),
        stepUpValidUntil:
          stepUpUntil && stepUpUntil > new Date() ? stepUpUntil.toISOString() : null,
      },
    };
  }
}
