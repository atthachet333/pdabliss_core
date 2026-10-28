import { DEPT_PAGES, isDeptKey, type DeptKey } from '@/features/departments/catalog';
import { INDUSTRY_IDS, type IndustryId } from '@/features/industries/model';
import { isPlanId, type PlanId } from '@/features/pricing/plans';
import type { Solution } from '@/features/solutions/model';

/*
 * Consultation inquiry model (EP13; /consultation since EP24.1.4.3). Structure only — every visible word lives
 * in copy.ts. The model is what a future delivery backend receives; it holds
 * no sensitive data (no ID numbers, financial data, passwords or files).
 */

/** Why the visitor wants to talk — the first question of the flow. */
export const INQUIRY_TYPES = [
  'demo',
  'consulting',
  'enterprise',
  'plans',
  'integration',
  'implementation',
  'general',
] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

/** The guided selector groups the seven paths by intent, not as equal cards. */
export const INQUIRY_GROUPS = [
  { id: 'explore', types: ['demo', 'general'] },
  { id: 'plan', types: ['consulting', 'implementation', 'integration'] },
  { id: 'commercial', types: ['plans', 'enterprise'] },
] as const satisfies readonly { id: string; types: readonly InquiryType[] }[];
export type InquiryGroup = (typeof INQUIRY_GROUPS)[number]['id'];

/**
 * The stable topic contract: `/consultation?topic=` (EP24.1.4.3; `?interest=`
 * before, still accepted). Each enquiry CTA links with one of the canonical
 * values; a few aliases are accepted so older links still land. Unknown
 * values are ignored — the first step simply starts unselected.
 */
export const INTEREST_PARAM: Record<string, InquiryType> = {
  demo: 'demo',
  consulting: 'consulting',
  consult: 'consulting',
  enterprise: 'enterprise',
  quote: 'enterprise',
  plans: 'plans',
  packages: 'plans',
  pricing: 'plans',
  integration: 'integration',
  api: 'integration',
  implementation: 'implementation',
  training: 'implementation',
  general: 'general',
  other: 'general',
};

/** Industries reuse the EP11 model; "other" covers everything else. */
export const INDUSTRY_OPTIONS = [...INDUSTRY_IDS, 'other'] as const;
export type IndustryOption = IndustryId | 'other';

/** Broad ranges only — never an exact headcount, never revenue. */
export const SIZES = ['1-20', '21-50', '51-100', '101-300', '301-1000', '1000+'] as const;
export type Size = (typeof SIZES)[number];

export const DEPARTMENT_OPTIONS = DEPT_PAGES;

/** Common problems, aligned with the EP09 solution taxonomy where one exists. */
export const PROBLEMS = [
  'dropped',
  'chasing',
  'stock',
  'approval',
  'supplier',
  'documents',
  'disconnected',
  'lateVisibility',
  'customWorkflow',
  'integration',
  'other',
] as const;
export type Problem = (typeof PROBLEMS)[number];
export const PROBLEM_SOLUTION: Partial<Record<Problem, Solution['id']>> = {
  dropped: 'fallingThrough',
  chasing: 'statusChasing',
  stock: 'stock',
  approval: 'approval',
  supplier: 'supplier',
  disconnected: 'crossDepartment',
  lateVisibility: 'management',
};

/** How the visitor would like PDA BLISS to reply. */
export const CONTACT_METHODS = ['line', 'phone', 'email'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const STEPS = ['topic', 'organization', 'situation', 'method', 'details', 'review'] as const;
export type Step = (typeof STEPS)[number];

export interface ContactFields {
  name: string;
  company: string;
  phone: string;
  email: string;
  lineId: string;
}

/** Where the visitor came from (query parameters only — never the referrer). */
export interface Prefill {
  type?: InquiryType;
  plan?: PlanId;
  industry?: IndustryId;
  department?: DeptKey;
}

/** One inquiry, ready for a delivery backend. */
export interface Inquiry {
  type: InquiryType | null;
  plan?: PlanId;
  industry?: IndustryOption;
  size?: Size;
  departments: DeptKey[];
  problems: Problem[];
  message: string;
  method: ContactMethod;
  contact: ContactFields;
  source: Prefill;
}

export const MESSAGE_MAX = 1500;

export function emptyInquiry(prefill: Prefill = {}): Inquiry {
  return {
    type: prefill.type ?? null,
    plan: prefill.plan,
    industry: prefill.industry,
    size: undefined,
    departments: prefill.department ? [prefill.department] : [],
    problems: [],
    message: '',
    method: 'line',
    contact: { name: '', company: '', phone: '', email: '', lineId: '' },
    source: prefill,
  };
}

/**
 * Reads the stable query contract: `?topic=` (or the older `?interest=`),
 * `?plan=`, `?industry=`, `?department=`. Unknown values are ignored. A plan without an interest
 * implies a package question (Enterprise → a quotation).
 */
export function parsePrefill(params: URLSearchParams): Prefill {
  const out: Prefill = {};
  const interest = (params.get('topic') ?? params.get('interest'))?.toLowerCase();
  if (interest && interest in INTEREST_PARAM) out.type = INTEREST_PARAM[interest];
  const plan = params.get('plan')?.toLowerCase();
  if (isPlanId(plan)) {
    out.plan = plan;
    out.type ??= plan === 'enterprise' ? 'enterprise' : 'plans';
  }
  const industry = params.get('industry')?.toLowerCase();
  if (industry && (INDUSTRY_IDS as readonly string[]).includes(industry)) {
    out.industry = industry as IndustryId;
  }
  const department = params.get('department')?.toLowerCase();
  if (department && isDeptKey(department)) out.department = department;
  return out;
}

/** Builds a `/consultation` link that follows the query contract. */
export function consultationPath(p: Prefill & { type?: InquiryType }) {
  const q = new URLSearchParams();
  if (p.type) q.set('topic', p.type);
  if (p.plan) q.set('plan', p.plan);
  if (p.industry) q.set('industry', p.industry);
  if (p.department) q.set('department', p.department);
  const s = q.toString();
  return s ? `/consultation?${s}` : '/consultation';
}
