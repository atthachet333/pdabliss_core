import { hash, verify, type Options } from '@node-rs/argon2';

/*
 * Password storage (EP23): Argon2id (RFC 9106), the OWASP-recommended
 * password hash, via @node-rs/argon2 (prebuilt native binding, no build step).
 *
 * Parameters follow the OWASP Password Storage Cheat Sheet baseline for
 * Argon2id: 19 MiB memory, 2 iterations, 1 lane. They are encoded in every
 * PHC hash string, so they can be raised later without a migration: a
 * successful sign-in with an older hash re-hashes the password with the
 * current parameters (`needsRehash`).
 */

export const ARGON2_PARAMS = {
  // Algorithm.Argon2id — the binding declares it as an ambient const enum,
  // which isolatedModules cannot reference by name.
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const satisfies Options;

export const PASSWORD_MIN = 10;
/** Long passphrases welcome; the cap only bounds hashing work per request. */
export const PASSWORD_MAX = 128;

/**
 * A short list of very common passwords that satisfy the length rule. The
 * length minimum does most of the work; this catches the obvious remainder.
 */
const COMMON = new Set([
  '1234567890',
  '0123456789',
  '12345678910',
  '1q2w3e4r5t',
  'qwertyuiop',
  'asdfghjkl;',
  'password12',
  'password123',
  'password1234',
  'passw0rd123',
  'iloveyou123',
  'qwerty12345',
  'abc1234567',
  'abcdefghij',
  '1111111111',
  'aaaaaaaaaa',
  'changeme123',
  'change-me',
  'letmein1234',
  'welcome123',
  'admin12345',
  'administrator',
  'pdabliss123',
  'pdablisscore',
]);

export type PasswordProblem = 'too_short' | 'too_long' | 'too_common' | 'contains_email';

/** Length-first policy (NIST SP 800-63B): no arbitrary composition rules. */
export function checkPassword(password: string, email?: string): PasswordProblem | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN) return 'too_short';
  if (length > PASSWORD_MAX) return 'too_long';
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return 'too_common';
  if (email) {
    const local = email.split('@')[0]?.toLowerCase() ?? '';
    if (lower === email.toLowerCase() || (local.length >= 4 && lower.includes(local))) {
      return 'contains_email';
    }
  }
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_PARAMS);
}

export async function verifyPassword(phc: string, password: string): Promise<boolean> {
  try {
    return await verify(phc, password);
  } catch {
    return false;
  }
}

/** True when the stored hash was made with other parameters than the current ones. */
export function needsRehash(phc: string): boolean {
  const { memoryCost, timeCost, parallelism } = ARGON2_PARAMS;
  return !phc.startsWith(`$argon2id$v=19$m=${memoryCost},t=${timeCost},p=${parallelism}$`);
}

let dummyHash: Promise<string> | undefined;

/**
 * Verifies against a throwaway hash so a sign-in for an unknown email takes
 * as long as one for a real account (no timing-based account discovery).
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('core-timing-equaliser-not-a-password');
  await verifyPassword(await dummyHash, password);
}
