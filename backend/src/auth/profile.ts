import { z } from 'zod';

/*
 * Account profile (EP24.1): who the human behind an account is. Registration
 * creates a PERSON, not a company — company details come after verification,
 * in onboarding.
 *
 * - fullName: required, the name audit trails and ownership show.
 * - phone: required contact number, normalized to E.164. Profile data only —
 *   not a sign-in factor, never shown publicly.
 * - jobFunction: optional, self-described. It NEVER grants a role, a
 *   department or any permission; nothing in authorization reads it.
 */

export const JOB_FUNCTIONS = [
  'OWNER',
  'EXECUTIVE',
  'ACCOUNTING',
  'PURCHASING',
  'SALES',
  'OPERATIONS',
  'WAREHOUSE',
  'IT',
  'OTHER',
] as const;
export type JobFunctionCode = (typeof JOB_FUNCTIONS)[number];

/**
 * Normalizes a phone number to E.164, or returns null when it is not one.
 *
 * Accepted: Thai national numbers (0 + 8–9 digits: "081-234-5678",
 * "02 123 4567") → +66…; international numbers with "+" or "00"
 * ("+1 415 555 0100", "0044 20 7946 0958"). Spaces, dashes, dots and
 * brackets are ignored. Thai +66 numbers must have 8–9 national digits;
 * other countries 8–15 digits in total (E.164), no further assumptions.
 */
export function normalizePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s\-().]/g, '');
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  if (/^0\d{8,9}$/.test(international)) return `+66${international.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(international)) return null;
  if (international.startsWith('+66') && !/^\+66[1-9]\d{7,8}$/.test(international)) return null;
  return international;
}

/** A person's full name: 2–120 characters, at least one letter, no markup or control characters. */
export const FullName = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .refine((v) => /\p{L}/u.test(v), 'must contain a letter')
  // eslint-disable-next-line no-control-regex
  .refine((v) => !/[<>\u0000-\u001f\u007f]/.test(v), 'invalid characters')
  .transform((v) => v.replace(/\s+/g, ' ').normalize('NFC'));

export const Phone = z
  .string()
  .max(32)
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'invalid phone number' });
      return z.NEVER;
    }
    return normalized;
  });

export const SIGNUP_INDUSTRIES = [
  'DISTRIBUTION',
  'SERVICES',
  'PROJECTS',
  'RETAIL',
  'PROPERTY',
  'MANUFACTURING',
  'OTHER',
] as const;
export const SIGNUP_TEAM_SIZES = [
  'SIZE_1_10',
  'SIZE_11_50',
  'SIZE_51_200',
  'SIZE_201_500',
  'SIZE_500_PLUS',
] as const;
export const CONTACT_PREFERENCES = ['EMAIL', 'PHONE', 'LINE'] as const;
export const SIGNUP_INTERESTS = [
  'SALES',
  'WAREHOUSE',
  'PURCHASING',
  'OPERATIONS',
  'ACCOUNTING_WORKFLOW',
  'EXECUTIVE_VISIBILITY',
  'FULL_ORGANIZATION',
] as const;

/**
 * Business context at sign-up (EP24.1): lead information only. The company
 * name here is what the person typed — it does not create, name or claim a
 * CORE company; onboarding does that after verification.
 */
export const SignupContext = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .refine((v) => !/[<>]/.test(v), 'invalid characters'),
    industry: z.enum(SIGNUP_INDUSTRIES),
    teamSize: z.enum(SIGNUP_TEAM_SIZES),
    preferredContact: z.enum(CONTACT_PREFERENCES).default('EMAIL'),
    lineId: z
      .string()
      .trim()
      .max(50)
      .regex(/^@?[A-Za-z0-9._-]+$/, 'invalid LINE ID')
      .optional(),
    interests: z
      .array(z.enum(SIGNUP_INTERESTS))
      .max(SIGNUP_INTERESTS.length)
      .default([])
      .transform((v) => [...new Set(v)]),
    note: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.preferredContact === 'LINE' && !v.lineId) {
      ctx.addIssue({ code: 'custom', path: ['lineId'], message: 'LINE ID required' });
    }
  });

export type SignupContextInput = z.output<typeof SignupContext>;
