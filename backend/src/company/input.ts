import { z } from 'zod';
import { API_LOCALES } from '../auth/locale.js';
import { normalizePhone } from '../auth/profile.js';
import { DEPARTMENT_CODES, PLAN_CODES } from '../billing/catalog.js';

/*
 * Request schemas for onboarding (EP24). Every object is strict: fields the
 * server decides (plan on the company form, price, status, paid, owner,
 * platform role, …) are refused rather than ignored.
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Digits only: "0-1055-12345-67-8" and "0105512345678" are the same tax ID. */
const compactDigits = (v: string) => v.replace(/[\s-]/g, '');

/**
 * Thai 13-digit identification / tax number checksum (the same rule covers
 * personal IDs and juristic-person tax IDs). Format check only — it does not
 * mean the Revenue Department has verified the number.
 */
export function isThaiTaxId(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(value[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(value[12]);
}

export const PackageBody = z.object({ plan: z.enum(PLAN_CODES) }).strict();

const HeadOfficeBody = z
  .object({
    name: optionalText(120),
    addressLine1: text(200),
    addressLine2: optionalText(200),
    subdistrict: optionalText(100),
    district: optionalText(100),
    province: text(100),
    postalCode: z.string().trim().max(12),
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .transform((v) => v.toUpperCase())
      .default('TH'),
    phone: optionalText(30),
  })
  .strict()
  .superRefine((v, ctx) => {
    const ok =
      v.countryCode === 'TH'
        ? /^\d{5}$/.test(v.postalCode)
        : /^[A-Za-z0-9][A-Za-z0-9 -]{1,10}$/.test(v.postalCode);
    if (!ok) ctx.addIssue({ code: 'custom', path: ['postalCode'], message: 'invalid postal code' });
  });

export const CreateCompanyBody = z
  .object({
    legalName: text(200),
    displayName: text(120),
    taxId: optionalText(30).transform((v) => (v ? compactDigits(v) : undefined)),
    registrationNumber: optionalText(40),
    headOffice: HeadOfficeBody,
    departments: z.array(z.enum(DEPARTMENT_CODES)).max(DEPARTMENT_CODES.length),
    billingCycle: z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.taxId) return;
    const valid =
      v.headOffice.countryCode === 'TH'
        ? isThaiTaxId(v.taxId)
        : /^[A-Za-z0-9]{3,30}$/.test(v.taxId);
    if (!valid) ctx.addIssue({ code: 'custom', path: ['taxId'], message: 'invalid tax ID' });
  });

export type CreateCompanyInput = z.output<typeof CreateCompanyBody>;

export const IdParams = z.object({ id: z.string().min(1).max(64) });

/** `?x=` with an empty value means "not set" (a cleared filter in the UI). */
const optionalParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

/**
 * Platform Company Explorer query (EP24.1). Newest first; `cursor` is the id
 * of the last row of the previous page. Filters apply to the company and its
 * current subscription.
 */
export const PlatformCompanyQuery = z
  .object({
    q: optionalParam(z.string().trim().min(1).max(100)),
    plan: optionalParam(z.enum(PLAN_CODES)),
    subscriptionStatus: optionalParam(z.enum(['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'])),
    status: optionalParam(z.enum(['PENDING_SUBSCRIPTION', 'ACTIVE', 'SUSPENDED', 'CLOSED'])),
    onboardingStatus: optionalParam(z.enum(['IN_PROGRESS', 'COMPLETED'])),
    department: optionalParam(z.enum(DEPARTMENT_CODES)),
    /** EP24.1.2: customer data only, demo data only, or both (default). */
    demo: optionalParam(z.enum(['exclude', 'only'])),
    cursor: optionalParam(z.string().min(1).max(64)),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type PlatformCompanyFilter = z.output<typeof PlatformCompanyQuery>;

// ---------------------------------------------------------------------------
// EP25 — Company Control Center
//
// Same rule as onboarding: strict objects, so fields the server owns (status,
// plan, isDemo, owner, company id, branch type / code after creation, …) are
// refused with 400 instead of being silently ignored. A company id never comes
// from the request — the caller's own membership decides the company.
// ---------------------------------------------------------------------------

/** `null` (or an empty string) clears an optional field. */
const clearable = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema.nullable());

const PhoneValue = z
  .string()
  .max(32)
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'invalid phone number' });
      return z.NEVER;
    }
    return phone;
  });

/** http(s) only — no javascript:, data: or other schemes; normalized by URL. */
const WebsiteValue = z
  .string()
  .trim()
  .max(200)
  .transform((v, ctx) => {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
    try {
      const url = new URL(candidate);
      if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.')) {
        return url.toString();
      }
    } catch {
      // not a URL — reported below
    }
    ctx.addIssue({ code: 'custom', message: 'invalid website' });
    return z.NEVER;
  });

const EmailValue = z.string().trim().max(254).pipe(z.email());

const CountryCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/)
  .transform((v) => v.toUpperCase());

export const postalCodeValid = (v: { countryCode: string; postalCode: string }) =>
  v.countryCode === 'TH'
    ? /^\d{5}$/.test(v.postalCode)
    : /^[A-Za-z0-9][A-Za-z0-9 -]{1,10}$/.test(v.postalCode);

/** A full address (the Head Office address on the profile). */
const AddressBody = z
  .object({
    addressLine1: text(200),
    addressLine2: optionalText(200),
    subdistrict: optionalText(100),
    district: optionalText(100),
    province: text(100),
    postalCode: z.string().trim().max(12),
    countryCode: CountryCode.default('TH'),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!postalCodeValid(v))
      ctx.addIssue({ code: 'custom', path: ['postalCode'], message: 'invalid postal code' });
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

export const ProfileBody = z
  .object({
    displayName: text(120).optional(),
    legalName: text(200).optional(),
    englishName: clearable(text(200)).optional(),
    taxId: clearable(text(30).transform(compactDigits)).optional(),
    registrationNumber: clearable(text(40)).optional(),
    phone: clearable(PhoneValue).optional(),
    website: clearable(WebsiteValue).optional(),
    contactEmail: clearable(EmailValue).optional(),
    industry: z.enum(SIGNUP_INDUSTRIES).nullable().optional(),
    /** The Head Office (00000) address — the company's main address. */
    headOffice: AddressBody.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type ProfileInput = z.output<typeof ProfileBody>;

/** 5 digits; 00000 is the Head Office and is never created here. */
const BranchCode = z
  .string()
  .trim()
  .regex(/^\d{5}$/, 'five digits')
  .refine((v) => v !== '00000', 'reserved for the Head Office');

export const BranchCreateBody = z
  .object({
    /** Optional: the server takes the next free code when it is left out. */
    code: BranchCode.optional(),
    name: text(120),
    addressLine1: text(200),
    addressLine2: optionalText(200),
    subdistrict: optionalText(100),
    district: optionalText(100),
    province: text(100),
    postalCode: z.string().trim().max(12),
    countryCode: CountryCode.default('TH'),
    phone: PhoneValue.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!postalCodeValid(v))
      ctx.addIssue({ code: 'custom', path: ['postalCode'], message: 'invalid postal code' });
  });
export type BranchCreateInput = z.output<typeof BranchCreateBody>;

/** Name, address and phone. Code, type and status are not editable here. */
export const BranchUpdateBody = z
  .object({
    name: text(120).optional(),
    addressLine1: text(200).optional(),
    addressLine2: clearable(text(200)).optional(),
    subdistrict: clearable(text(100)).optional(),
    district: clearable(text(100)).optional(),
    province: text(100).optional(),
    postalCode: z.string().trim().max(12).optional(),
    countryCode: CountryCode.optional(),
    phone: clearable(PhoneValue).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type BranchUpdateInput = z.output<typeof BranchUpdateBody>;

const AssignableRole = z.enum([
  'SYSTEM_ADMIN',
  'EXECUTIVE',
  'DEPARTMENT_MANAGER',
  'DEPARTMENT_STAFF',
  'VIEWER',
]);

export const InvitationBody = z
  .object({
    email: z.string().trim().max(254).pipe(z.email()),
    role: AssignableRole,
    /** Language of the email; the company default when left out. */
    locale: z.enum(API_LOCALES).optional(),
  })
  .strict();
export type InvitationInput = z.output<typeof InvitationBody>;

export const MemberUpdateBody = z
  .object({
    role: AssignableRole.optional(),
    jobTitle: clearable(text(120)).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type MemberUpdateInput = z.output<typeof MemberUpdateBody>;

export const MemberDepartmentsBody = z
  .object({
    departments: z.array(z.enum(DEPARTMENT_CODES)).max(DEPARTMENT_CODES.length),
    primary: z.enum(DEPARTMENT_CODES).nullable().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.departments).size !== v.departments.length)
      ctx.addIssue({ code: 'custom', path: ['departments'], message: 'duplicate department' });
    if (v.primary && !v.departments.includes(v.primary))
      ctx.addIssue({ code: 'custom', path: ['primary'], message: 'primary must be assigned' });
  });
export type MemberDepartmentsInput = z.output<typeof MemberDepartmentsBody>;

export const DepartmentsBody = z
  .object({ departments: z.array(z.enum(DEPARTMENT_CODES)).max(DEPARTMENT_CODES.length) })
  .strict();

const TIME_ZONES = new Set(Intl.supportedValuesOf('timeZone'));

export const SettingsBody = z
  .object({
    timezone: z
      .string()
      .max(64)
      .refine((v) => TIME_ZONES.has(v), 'unknown time zone')
      .optional(),
    defaultLocale: z.enum(API_LOCALES).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type SettingsInput = z.output<typeof SettingsBody>;

/** Raster logos only. SVG is refused on purpose: it can carry script. */
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type LogoType = (typeof LOGO_TYPES)[number];
export const LOGO_MAX_BYTES = 256 * 1024;

export const LogoBody = z
  .object({
    contentType: z.enum(LOGO_TYPES),
    /** Base64 of the image bytes (JSON only — the API accepts no multipart). */
    data: z
      .string()
      .max(Math.ceil(LOGO_MAX_BYTES / 3) * 4 + 4)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'base64'),
  })
  .strict();

export const BranchContextBody = z.object({ branchId: z.string().min(1).max(64) }).strict();

export const ActivityQuery = z
  .object({
    scope: z.enum(['all', 'admin', 'security']).default('all'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
