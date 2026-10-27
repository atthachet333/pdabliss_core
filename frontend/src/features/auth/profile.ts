/*
 * Account profile rules on the client (EP24.1) — the same rules the server
 * enforces in backend/src/auth/profile.ts (parity-tested). The client only
 * helps people type a valid value; the server decides.
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
export type JobFunction = (typeof JOB_FUNCTIONS)[number];

/** E.164 or null: Thai national numbers (0 + 8–9 digits) become +66…; "+" / "00" international. */
export function normalizePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s\-().]/g, '');
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  if (/^0\d{8,9}$/.test(international)) return `+66${international.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(international)) return null;
  if (international.startsWith('+66') && !/^\+66[1-9]\d{7,8}$/.test(international)) return null;
  return international;
}

/** A full name: 2–120 characters with at least one letter, no markup. */
export function fullNameProblem(raw: string): 'required' | 'invalid' | null {
  const v = raw.trim();
  if (!v) return 'required';
  if (v.length < 2 || v.length > 120 || !/\p{L}/u.test(v) || /[<>]/.test(v)) return 'invalid';
  return null;
}

/** "+66812345678" → "081 234 5678" for display; other numbers stay in E.164. */
export function formatPhone(e164: string | null): string | null {
  if (!e164) return null;
  const th = /^\+66(\d{8,9})$/.exec(e164);
  if (!th) return e164;
  const national = `0${th[1]}`;
  return national.length === 10
    ? `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
    : `${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
}

/** Sign-up business context (EP24.1) — lead information, never the company record. */
export const SIGNUP_INDUSTRIES = [
  'DISTRIBUTION',
  'SERVICES',
  'PROJECTS',
  'RETAIL',
  'PROPERTY',
  'MANUFACTURING',
  'OTHER',
] as const;
export type SignupIndustry = (typeof SIGNUP_INDUSTRIES)[number];
export const SIGNUP_TEAM_SIZES = [
  'SIZE_1_10',
  'SIZE_11_50',
  'SIZE_51_200',
  'SIZE_201_500',
  'SIZE_500_PLUS',
] as const;
export type SignupTeamSize = (typeof SIGNUP_TEAM_SIZES)[number];
export const CONTACT_PREFERENCES = ['EMAIL', 'PHONE', 'LINE'] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];
export const SIGNUP_INTERESTS = [
  'SALES',
  'WAREHOUSE',
  'PURCHASING',
  'OPERATIONS',
  'ACCOUNTING_WORKFLOW',
  'EXECUTIVE_VISIBILITY',
  'FULL_ORGANIZATION',
] as const;
export type SignupInterest = (typeof SIGNUP_INTERESTS)[number];

export interface SignupBusiness {
  companyName: string;
  industry: SignupIndustry;
  teamSize: SignupTeamSize;
  preferredContact: ContactPreference;
  lineId?: string;
  interests: SignupInterest[];
  note?: string;
}

export const LINE_ID_PATTERN = /^@?[A-Za-z0-9._-]+$/;
