import type { Env } from '../config/env.js';
import { DEMO_PERSONA_EMAILS } from '../demo/personas.js';
import type { DbClient } from './audit.js';

/*
 * DEVELOPMENT / TEST ONLY — demo sign-in without the emailed code.
 *
 * The seeded demo customer accounts (EP28.1: the personas of
 * src/demo/personas.ts) may skip the login one-time code so
 * local demos and QA do not need the mail sink. Everything else stays:
 * the password is checked first (Argon2id, the same throttling and rate
 * limits), the account must be ACTIVE and verified, and the session is an
 * ordinary customer session (not privileged, no step-up). Each use is audited
 * as DEMO_AUTH_BYPASS.
 *
 * The bypass applies only when ALL of these hold:
 *   1. NODE_ENV is not "production" (checked here, whatever else is set);
 *   2. ENABLE_DEMO_ROUTES resolved to true (default off in production);
 *   3. the normalized email is exactly one of DEMO_BYPASS_EMAILS — no domain
 *      or pattern match;
 *   4. the account holds no platform role (PLATFORM_OWNER / PLATFORM_ADMIN);
 *   5. the account is an ACTIVE member (EP28.1) of a seeded demo company
 *      (Company.isDemo).
 */

export const DEMO_BYPASS_EMAILS: readonly string[] = DEMO_PERSONA_EMAILS;

/** Conditions 1 + 2: evaluated once at start-up; false means no bypass path exists. */
export function demoBypassEnabled(env: Pick<Env, 'NODE_ENV' | 'ENABLE_DEMO_ROUTES'>): boolean {
  return env.NODE_ENV !== 'production' && env.ENABLE_DEMO_ROUTES === true;
}

/** Conditions 3–5, for an account whose password was already verified. */
export async function isDemoBypassAccount(
  db: DbClient,
  user: { id: string; emailNormalized: string; platformRole: { role: string } | null },
): Promise<boolean> {
  if (user.platformRole) return false;
  if (!DEMO_BYPASS_EMAILS.includes(user.emailNormalized)) return false;
  const member = await db.companyMember.findUnique({
    where: { userId: user.id },
    select: { status: true, company: { select: { isDemo: true } } },
  });
  return member?.status === 'ACTIVE' && member.company.isDemo === true;
}
