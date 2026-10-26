import type { Db } from '../db/client.js';
import { AUTH_POLICY } from './policy.js';

/*
 * Removes auth records that can no longer be used (EP23). Expired rows are
 * already ignored by every check, so this is housekeeping, not security: run
 * it on a schedule (`npm run auth:cleanup`, e.g. daily) or by hand. Audit
 * events are kept.
 */
export async function cleanupAuthRecords(db: Db, now = new Date()) {
  const tokensBefore = new Date(now.getTime() - AUTH_POLICY.retention.tokensMs);
  const sessionsBefore = new Date(now.getTime() - AUTH_POLICY.retention.sessionsMs);
  const [otp, verification, reset, sessions, devices] = await db.$transaction([
    db.otpChallenge.deleteMany({ where: { expiresAt: { lt: tokensBefore } } }),
    db.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: tokensBefore } } }),
    db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: tokensBefore } } }),
    db.session.deleteMany({
      where: {
        OR: [
          { revokedAt: { lt: sessionsBefore } },
          { absoluteExpiresAt: { lt: sessionsBefore } },
          { idleExpiresAt: { lt: sessionsBefore } },
        ],
      },
    }),
    db.trustedDevice.deleteMany({
      where: { OR: [{ expiresAt: { lt: tokensBefore } }, { revokedAt: { lt: tokensBefore } }] },
    }),
  ]);
  return {
    otpChallenges: otp.count,
    verificationTokens: verification.count,
    resetTokens: reset.count,
    sessions: sessions.count,
    trustedDevices: devices.count,
  };
}
