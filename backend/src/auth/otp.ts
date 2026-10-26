import { randomUUID } from 'node:crypto';
import type { OtpChallenge, User } from '../generated/prisma/client.js';
import type { OtpPurpose } from '../generated/prisma/enums.js';
import type { Db } from '../db/client.js';
import type { Mailer } from '../mail/mailer.js';
import { otpMail } from '../mail/templates.js';
import { recordAuthEvent, type RequestMeta } from './audit.js';
import { generateOtpCode, maskEmail, otpHash, safeEqual, sha256 } from './crypto.js';
import {
  mailUnavailable,
  otpChallengeLimit,
  otpExpired,
  otpIncorrect,
  otpLocked,
  otpResendLimit,
  otpResendTooSoon,
} from './errors.js';
import { mailLocale } from './locale.js';
import { AUTH_POLICY } from './policy.js';

/*
 * Email one-time codes (EP23): 6 random digits, 10 minutes, single use, five
 * wrong tries, a resend cooldown and a cap on sends and on new challenges.
 * A new challenge supersedes the previous one of the same purpose. There is
 * no fixed or test code anywhere — tests read the code from the test mailer.
 */

const O = AUTH_POLICY.otp;

export interface ChallengeView {
  id: string;
  purpose: OtpPurpose;
  expiresAt: string;
  resendAvailableAt: string;
  maskedEmail: string;
}

export interface OtpDeps {
  db: Db;
  mailer: Mailer;
  secret: string;
}

function view(challenge: OtpChallenge, email: string): ChallengeView {
  return {
    id: challenge.id,
    purpose: challenge.purpose,
    expiresAt: challenge.expiresAt.toISOString(),
    resendAvailableAt: new Date(challenge.lastSentAt.getTime() + O.resendCooldownMs).toISOString(),
    maskedEmail: maskEmail(email),
  };
}

async function deliver(deps: OtpDeps, user: User, purpose: OtpPurpose, code: string) {
  const mail = otpMail(mailLocale(user.locale), code, purpose === 'LOGIN' ? 'login' : 'step_up');
  await deps.mailer.send({
    to: user.email,
    ...mail,
    purpose: purpose === 'LOGIN' ? 'login_otp' : 'step_up_otp',
  });
}

export async function createChallenge(
  deps: OtpDeps,
  user: User,
  purpose: OtpPurpose,
  binding: { bindingHash?: string; sessionId?: string },
  meta: RequestMeta,
): Promise<ChallengeView> {
  const { db } = deps;
  const now = new Date();
  const recent = await db.otpChallenge.count({
    where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - 3_600_000) } },
  });
  if (recent >= O.maxChallengesPerHour) throw otpChallengeLimit();

  const id = randomUUID();
  const code = generateOtpCode();
  const challenge = await db.$transaction(async (tx) => {
    await tx.otpChallenge.updateMany({
      where: {
        userId: user.id,
        purpose,
        status: 'PENDING',
        ...(binding.sessionId ? { sessionId: binding.sessionId } : {}),
      },
      data: { status: 'SUPERSEDED' },
    });
    return tx.otpChallenge.create({
      data: {
        id,
        userId: user.id,
        purpose,
        codeHash: otpHash(deps.secret, id, code),
        bindingHash: binding.bindingHash ?? null,
        sessionId: binding.sessionId ?? null,
        maxAttempts: O.maxAttempts,
        lastSentAt: now,
        expiresAt: new Date(now.getTime() + O.ttlMs),
      },
    });
  });

  try {
    await deliver(deps, user, purpose, code);
  } catch {
    await db.otpChallenge.update({ where: { id }, data: { status: 'CANCELLED' } });
    throw mailUnavailable();
  }
  await recordAuthEvent(db, meta, {
    type: 'OTP_SENT',
    userId: user.id,
    sessionId: binding.sessionId,
    metadata: { purpose },
  });
  return view(challenge, user.email);
}

interface Binding {
  purpose: OtpPurpose;
  /** LOGIN: the raw pending-login cookie value. */
  bindingToken?: string;
  /** STEP_UP: the current session id. */
  sessionId?: string;
}

/** Loads a challenge that belongs to this browser/session, or fails with a generic error. */
async function loadBound(db: Db, challengeId: string, binding: Binding) {
  const challenge = await db.otpChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.purpose !== binding.purpose) throw otpExpired();
  if (binding.purpose === 'LOGIN') {
    if (
      !binding.bindingToken ||
      !challenge.bindingHash ||
      !safeEqual(sha256(binding.bindingToken), challenge.bindingHash)
    ) {
      throw otpExpired();
    }
  } else if (!binding.sessionId || challenge.sessionId !== binding.sessionId) {
    throw otpExpired();
  }
  return challenge;
}

function assertUsable(challenge: OtpChallenge) {
  if (challenge.status === 'LOCKED') throw otpLocked();
  if (challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) throw otpExpired();
}

/**
 * Checks a code. Single use is enforced by a conditional update, so two
 * concurrent requests with the right code cannot both succeed.
 */
export async function verifyChallenge(
  deps: OtpDeps,
  challengeId: string,
  code: string,
  binding: Binding,
  meta: RequestMeta,
): Promise<OtpChallenge> {
  const { db } = deps;
  const challenge = await loadBound(db, challengeId, binding);
  assertUsable(challenge);

  if (!safeEqual(otpHash(deps.secret, challenge.id, code), challenge.codeHash)) {
    const attempts = challenge.attempts + 1;
    const locked = attempts >= challenge.maxAttempts;
    const { count } = await db.otpChallenge.updateMany({
      where: { id: challenge.id, status: 'PENDING', attempts: challenge.attempts },
      data: { attempts, ...(locked ? { status: 'LOCKED' } : {}) },
    });
    await recordAuthEvent(db, meta, {
      type: 'OTP_FAILURE',
      userId: challenge.userId,
      metadata: { purpose: challenge.purpose, reason: locked ? 'locked' : 'incorrect' },
    });
    // A lost race means another attempt was counted concurrently: re-check the state.
    if (count === 0) {
      const fresh = await db.otpChallenge.findUnique({ where: { id: challenge.id } });
      if (!fresh) throw otpExpired();
      assertUsable(fresh);
      throw otpIncorrect(Math.max(0, fresh.maxAttempts - fresh.attempts));
    }
    if (locked) throw otpLocked();
    throw otpIncorrect(challenge.maxAttempts - attempts);
  }

  const now = new Date();
  const { count } = await db.otpChallenge.updateMany({
    where: { id: challenge.id, status: 'PENDING', expiresAt: { gt: now } },
    data: { status: 'VERIFIED', consumedAt: now },
  });
  if (count === 0) throw otpExpired();
  await recordAuthEvent(db, meta, {
    type: 'OTP_SUCCESS',
    userId: challenge.userId,
    sessionId: binding.sessionId,
    metadata: { purpose: challenge.purpose },
  });
  return { ...challenge, status: 'VERIFIED', consumedAt: now };
}

/** Sends a fresh code for the same challenge (new code, new expiry; tries are not reset). */
export async function resendChallenge(
  deps: OtpDeps,
  challengeId: string,
  binding: Binding,
  meta: RequestMeta,
): Promise<ChallengeView> {
  const { db } = deps;
  const challenge = await loadBound(db, challengeId, binding);
  assertUsable(challenge);
  const now = new Date();
  const availableAt = new Date(challenge.lastSentAt.getTime() + O.resendCooldownMs);
  if (availableAt > now) throw otpResendTooSoon(availableAt);
  if (challenge.sendCount >= O.maxSends) throw otpResendLimit();

  const code = generateOtpCode();
  const { count } = await db.otpChallenge.updateMany({
    where: { id: challenge.id, status: 'PENDING', sendCount: challenge.sendCount },
    data: {
      codeHash: otpHash(deps.secret, challenge.id, code),
      sendCount: challenge.sendCount + 1,
      lastSentAt: now,
      expiresAt: new Date(now.getTime() + O.ttlMs),
    },
  });
  if (count === 0) throw otpResendTooSoon(availableAt);

  const user = await db.user.findUniqueOrThrow({ where: { id: challenge.userId } });
  try {
    await deliver(deps, user, challenge.purpose, code);
  } catch {
    throw mailUnavailable();
  }
  await recordAuthEvent(db, meta, {
    type: 'OTP_SENT',
    userId: user.id,
    sessionId: binding.sessionId,
    metadata: { purpose: challenge.purpose, resend: true },
  });
  const updated = await db.otpChallenge.findUniqueOrThrow({ where: { id: challenge.id } });
  return view(updated, user.email);
}
