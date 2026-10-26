import { ApiError, NETWORK_ERROR } from '@/lib/api';
import type { AuthCopy } from './copy';

/** Error code from anything thrown by the API client. */
export function errorCode(e: unknown): string {
  return e instanceof ApiError ? e.code : 'UNKNOWN';
}

/**
 * The shared, localized message for errors any account screen can meet.
 * Screen-specific codes (wrong password, expired link…) are handled where
 * they occur; this covers transport, availability and rate limits.
 */
export function commonError(e: unknown, c: AuthCopy): string {
  if (!(e instanceof ApiError)) return c.common.errors.generic;
  if (e.code === NETWORK_ERROR) return c.common.errors.network;
  if (e.code === 'AUTH_UNAVAILABLE' || (e.status === 503 && e.code !== 'MAIL_UNAVAILABLE')) {
    return c.common.errors.unavailable;
  }
  if (e.code === 'MAIL_UNAVAILABLE') return c.common.errors.mail;
  if (e.status === 429) return c.common.errors.rateLimited;
  if (e.code === 'PASSWORD_POLICY') {
    const problem = e.details?.problem as keyof AuthCopy['common']['policy'] | undefined;
    return (problem && c.common.policy[problem]) || c.common.policy.too_short;
  }
  return c.common.errors.generic;
}

/** Client-side mirror of the server password rules (the server stays authoritative). */
export function passwordProblem(
  password: string,
  email: string,
): keyof AuthCopy['common']['policy'] | null {
  const length = [...password].length;
  if (length < 10) return 'too_short';
  if (length > 128) return 'too_long';
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 4 && password.toLowerCase().includes(local)) return 'contains_email';
  return null;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
