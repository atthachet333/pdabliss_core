import { z } from 'zod';
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
