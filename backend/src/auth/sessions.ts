import type { Session, User } from '../generated/prisma/client.js';
import type { PlatformRole, SessionRevokeReason } from '../generated/prisma/enums.js';
import type { Db } from '../db/client.js';
import type { DbClient, RequestMeta } from './audit.js';
import { randomToken, sha256 } from './crypto.js';
import { AUTH_POLICY } from './policy.js';

/*
 * Server-side sessions (EP23). The browser holds a random 256-bit token in an
 * HttpOnly cookie; the database holds only its SHA-256 hash. Every request
 * looks the session up, so revocation (logout, logout-all, password reset,
 * suspension, role change) takes effect immediately — the reason this design
 * was chosen over self-contained access tokens. See docs/AUTHENTICATION.md.
 */

const P = AUTH_POLICY.session;

export interface SessionUser extends User {
  platformRole: { role: PlatformRole } | null;
}

export interface AuthContext {
  session: Session;
  user: SessionUser;
  /** Set when this request rotated the token: the route sends the new cookie. */
  rotatedToken?: string;
}

const lifetimes = (privileged: boolean) =>
  privileged
    ? { idle: P.privilegedIdleMs, absolute: P.privilegedAbsoluteMs }
    : { idle: P.customerIdleMs, absolute: P.customerAbsoluteMs };

export function truncateUserAgent(ua: string | null | undefined): string | null {
  return ua ? ua.slice(0, 256) : null;
}

export async function createSession(
  db: DbClient,
  userId: string,
  opts: { privileged: boolean; stepUp: boolean; meta: RequestMeta },
): Promise<{ token: string; session: Session }> {
  const now = new Date();
  const { idle, absolute } = lifetimes(opts.privileged);
  const token = randomToken();
  const session = await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      privileged: opts.privileged,
      createdAt: now,
      lastSeenAt: now,
      rotatedAt: now,
      idleExpiresAt: new Date(now.getTime() + idle),
      absoluteExpiresAt: new Date(now.getTime() + absolute),
      stepUpAt: opts.stepUp ? now : null,
      ipAddress: opts.meta.ip,
      userAgent: truncateUserAgent(opts.meta.userAgent),
    },
  });
  return { token, session };
}

/** The moment the session ends unless it is used again. */
export function sessionExpiresAt(session: Session): Date {
  return session.idleExpiresAt < session.absoluteExpiresAt
    ? session.idleExpiresAt
    : session.absoluteExpiresAt;
}

/**
 * Resolves a cookie token to a live session and an ACTIVE, verified user, or
 * null. Extends the idle timeout (at most once a minute).
 */
export async function resolveSession(db: Db, token: string): Promise<AuthContext | null> {
  if (!token || token.length > 128) return null;
  const hash = sha256(token);
  const now = new Date();
  const session =
    (await db.session.findUnique({ where: { tokenHash: hash } })) ??
    (await db.session
      .findUnique({ where: { previousTokenHash: hash } })
      .then((s) => (s?.previousValidUntil && s.previousValidUntil > now ? s : null)));
  if (!session || session.revokedAt) return null;
  if (session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { platformRole: { select: { role: true } } },
  });
  if (!user || user.status !== 'ACTIVE' || !user.emailVerifiedAt) return null;
  // A session minted before a role change must not carry the old privilege level.
  if (session.privileged !== !!user.platformRole) return null;

  if (now.getTime() - session.lastSeenAt.getTime() > P.touchIntervalMs) {
    const { idle } = lifetimes(session.privileged);
    const idleExpiresAt = new Date(
      Math.min(now.getTime() + idle, session.absoluteExpiresAt.getTime()),
    );
    const touched = await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now, idleExpiresAt },
    });
    return { session: touched, user };
  }
  return { session, user };
}

/**
 * Issues a new token for the same session (after a privilege change, or when
 * the token is old). The previous token stays valid for a short grace period.
 */
export async function rotateSession(
  db: DbClient,
  session: Session,
  extra: { stepUpAt?: Date } = {},
): Promise<{ token: string; session: Session }> {
  const now = new Date();
  const token = randomToken();
  const updated = await db.session.update({
    where: { id: session.id },
    data: {
      tokenHash: sha256(token),
      previousTokenHash: session.tokenHash,
      previousValidUntil: new Date(now.getTime() + P.rotationGraceMs),
      rotatedAt: now,
      ...extra,
    },
  });
  return { token, session: updated };
}

export function needsRotation(session: Session): boolean {
  return Date.now() - session.rotatedAt.getTime() > P.rotateAfterMs;
}

export async function revokeSession(db: DbClient, id: string, reason: SessionRevokeReason) {
  await db.session.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason },
  });
}

/** Revokes every live session of a user (optionally keeping one). Returns the count. */
export async function revokeAllSessions(
  db: DbClient,
  userId: string,
  reason: SessionRevokeReason,
  exceptId?: string,
): Promise<number> {
  const { count } = await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { revokedAt: new Date(), revokeReason: reason },
  });
  return count;
}

export async function revokeTrustedDevices(db: DbClient, userId: string) {
  await db.trustedDevice.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function createTrustedDevice(db: DbClient, userId: string, meta: RequestMeta) {
  const token = randomToken();
  await db.trustedDevice.create({
    data: {
      userId,
      tokenHash: sha256(token),
      userAgent: truncateUserAgent(meta.userAgent),
      expiresAt: new Date(Date.now() + AUTH_POLICY.trustedDeviceMs),
    },
  });
  return token;
}

export async function isTrustedDevice(db: Db, userId: string, token: string | undefined) {
  if (!token || token.length > 128) return false;
  const device = await db.trustedDevice.findUnique({ where: { tokenHash: sha256(token) } });
  if (!device || device.userId !== userId || device.revokedAt || device.expiresAt <= new Date()) {
    return false;
  }
  await db.trustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } });
  return true;
}
