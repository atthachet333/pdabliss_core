/*
 * EP23 authentication policy — every lifetime and limit in one place, so the
 * numbers in docs/AUTHENTICATION.md and the code cannot drift apart.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const AUTH_POLICY = {
  session: {
    /** Customer accounts: sliding idle timeout and hard maximum. */
    customerIdleMs: 7 * DAY,
    customerAbsoluteMs: 30 * DAY,
    /** Platform accounts: much shorter. */
    privilegedIdleMs: 30 * MINUTE,
    privilegedAbsoluteMs: 12 * HOUR,
    /** The token is replaced when it is older than this (checked on GET /auth/me). */
    rotateAfterMs: 12 * HOUR,
    /** The previous token keeps working this long after a rotation (in-flight requests). */
    rotationGraceMs: MINUTE,
    /** lastSeenAt / idle extension is written at most this often. */
    touchIntervalMs: MINUTE,
  },
  /** A sensitive platform action needs a one-time code checked this recently. */
  stepUpFreshMs: 10 * MINUTE,
  otp: {
    ttlMs: 10 * MINUTE,
    maxAttempts: 5,
    resendCooldownMs: MINUTE,
    maxSends: 5,
    /** New challenges per account per hour. */
    maxChallengesPerHour: 10,
  },
  /** Pending-login cookie: binds a LOGIN challenge to the browser that passed the password. */
  pendingLoginMs: 10 * MINUTE,
  trustedDeviceMs: 90 * DAY,
  emailVerification: {
    ttlMs: 24 * HOUR,
    cooldownMs: MINUTE,
    maxPerDay: 10,
  },
  passwordReset: {
    ttlMs: 30 * MINUTE,
    maxPerHour: 3,
  },
  invitation: {
    ttlMs: 7 * DAY,
  },
  login: {
    /** Failed attempts for one email (known or not) within the window before 429. */
    maxFailures: 10,
    failureWindowMs: 15 * MINUTE,
  },
  /** Old records removed by `npm run auth:cleanup`. */
  retention: {
    tokensMs: 7 * DAY,
    sessionsMs: 30 * DAY,
  },
} as const;

/**
 * Per-IP request limits for the auth endpoints (@fastify/rate-limit, in
 * addition to the global limit). Sign-in limits stay generous because a whole
 * office often shares one address (NAT); guessing is stopped per account
 * instead (login failure throttle, five tries per code, challenge caps).
 */
export const AUTH_RATE_LIMITS = {
  register: { max: 10, timeWindow: '15 minutes' },
  login: { max: 60, timeWindow: '5 minutes' },
  otpVerify: { max: 60, timeWindow: '5 minutes' },
  otpResend: { max: 10, timeWindow: '15 minutes' },
  verifyEmail: { max: 20, timeWindow: '15 minutes' },
  resendVerification: { max: 5, timeWindow: '15 minutes' },
  forgotPassword: { max: 5, timeWindow: '15 minutes' },
  resetPassword: { max: 10, timeWindow: '15 minutes' },
  invitationAccept: { max: 10, timeWindow: '15 minutes' },
  // EP24 onboarding (signed-in only; the one-company rule stops repeats anyway).
  packageSelection: { max: 30, timeWindow: '15 minutes' },
  companyCreate: { max: 10, timeWindow: '15 minutes' },
  // EP25 Company Control Center: invitations send email; logos are the largest bodies.
  invitationCreate: { max: 30, timeWindow: '15 minutes' },
  logoUpload: { max: 20, timeWindow: '15 minutes' },
} as const;

export const PLAN_INTENTS = ['starter', 'business', 'professional', 'enterprise'] as const;
export type PlanIntent = (typeof PLAN_INTENTS)[number];
