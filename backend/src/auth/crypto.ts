import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/*
 * Token and code primitives (EP23). Standard library only — no custom crypto.
 *
 * - Bearer-style secrets (session, device, email-link, invitation tokens) are
 *   256-bit random values. Only their SHA-256 hash is stored: with that much
 *   entropy a plain hash cannot be reversed or brute-forced.
 * - One-time codes have only 10^6 values, so a plain hash would fall to an
 *   offline search. They are stored as an HMAC keyed by AUTH_SECRET and bound
 *   to their challenge id.
 */

/** 32 random bytes, URL-safe (43 characters). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('base64url');
}

export function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('base64url');
}

/** Constant-time comparison of two encoded digests. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** A uniformly random 6-digit code (leading zeros kept). */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function otpHash(secret: string, challengeId: string, code: string): string {
  return hmac(secret, `otp:${challengeId}:${code}`);
}

/**
 * The identity key for an email address: trimmed, Unicode NFC, lower-cased.
 * Deliberately no provider-specific rewriting (dots, plus-tags): those are
 * different mailboxes on most providers.
 */
export function normalizeEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}

/** Keyed hash of a normalized email, for throttling attempts without storing the address. */
export function subjectHash(secret: string, emailNormalized: string): string {
  return hmac(secret, `subject:${emailNormalized}`);
}

/** "w•••@example.com" — enough for a person to recognise their own address. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '•••';
  return `${email[0]}•••${email.slice(at)}`;
}
