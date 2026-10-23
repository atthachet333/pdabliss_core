import type { DeptKey } from '@/features/departments/catalog';
import type { PlanId } from '@/features/pricing/plans';

/*
 * For Organizations / Enterprise (EP10) — the typed model behind /enterprise.
 * Structure, statuses and rules live here; words live in copy.ts.
 *
 * Claim discipline: every capability carries an honest status. "Ready"
 * means the structure is designed for it — never that it is certified.
 */

/** How real a capability is today. Always shown in words, never colour alone. */
export type ClaimStatus = 'prototype' | 'configurable' | 'planned' | 'ready';
export const CLAIM_STATUSES: readonly ClaimStatus[] = [
  'prototype',
  'configurable',
  'ready',
  'planned',
];

/** Section ids — the mega menu and in-page links point here. */
export const CHAPTER = {
  complexity: 'complexity',
  organization: 'organization',
  access: 'access',
  control: 'control',
  audit: 'audit',
  executive: 'executive',
  workflow: 'workflow',
  integration: 'integration',
  branches: 'branches',
  implementation: 'implementation',
  support: 'support',
  readiness: 'readiness',
  consult: 'consult',
} as const;

/* ------------------------------------------------------------------ */
/* 01 Growing complexity                                                */
/* ------------------------------------------------------------------ */

export const GROWTH_STAGES = [
  'team',
  'departments',
  'connected',
  'control',
  'organization',
] as const;
export type GrowthStage = (typeof GROWTH_STAGES)[number];

/** What multiplies as an organization grows, and the stage where it appears. */
export const MULTIPLIERS = [
  { id: 'departments', from: 1 },
  { id: 'users', from: 1 },
  { id: 'handoffs', from: 2 },
  { id: 'approvals', from: 3 },
  { id: 'exceptions', from: 3 },
  { id: 'boundaries', from: 3 },
  { id: 'branches', from: 4 },
  { id: 'systems', from: 4 },
  { id: 'reporting', from: 4 },
] as const;
export type Multiplier = (typeof MULTIPLIERS)[number]['id'];

/** Industries the page speaks to — process-focused, not manufacturing-only. */
export const INDUSTRIES = [
  'distribution',
  'service',
  'projects',
  'retail',
  'property',
  'production',
] as const;

/* ------------------------------------------------------------------ */
/* 02 Organization model                                                */
/* ------------------------------------------------------------------ */

/** Responsibility levels in one system (manager scale). */
export const LEVELS = ['employee', 'lead', 'manager', 'executive'] as const;
export type Level = (typeof LEVELS)[number];

/* ------------------------------------------------------------------ */
/* 03 Access & role control                                             */
/* ------------------------------------------------------------------ */

export const ACCESS_ROLES = [
  'executive',
  'manager',
  'staff',
  'warehouse',
  'accounting',
  'admin',
] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];

/** Fields of one shared work object (an order and its supply). */
export const WORK_FIELDS = [
  'order',
  'customer',
  'item',
  'quantity',
  'lot',
  'location',
  'expiry',
  'price',
  'cost',
  'payment',
  'state',
  'risk',
  'config',
] as const;
export type WorkField = (typeof WORK_FIELDS)[number];

/** Money fields — never shown to the Warehouse. */
export const MONEY_FIELDS: readonly WorkField[] = ['price', 'cost', 'payment'];

/**
 * Illustrative visibility per role. Exact roles and fields are configured by
 * implementation scope and package — this is not a final production RBAC model.
 */
export const ROLE_VISIBILITY: Record<AccessRole, readonly WorkField[]> = {
  executive: ['order', 'customer', 'state', 'risk', 'price'],
  manager: ['order', 'customer', 'item', 'quantity', 'state', 'risk'],
  staff: ['order', 'item', 'quantity', 'state'],
  warehouse: ['item', 'quantity', 'lot', 'location', 'expiry'],
  accounting: ['order', 'price', 'cost', 'payment', 'state'],
  // Administration is configuration — not business visibility.
  admin: ['config'],
};

/* ------------------------------------------------------------------ */
/* 04 Workflow & approval control                                       */
/* ------------------------------------------------------------------ */

export const APPROVAL_RAILS = [
  { id: 'simple', steps: ['request', 'manager', 'continue'] },
  { id: 'advanced', steps: ['request', 'manager', 'finance', 'executive', 'continue'] },
  { id: 'conditional', steps: ['request', 'manager', 'condition', 'executive', 'continue'] },
] as const;
export type RailId = (typeof APPROVAL_RAILS)[number]['id'];

export const CONTROLS = [
  { id: 'multiStep', status: 'configurable' },
  { id: 'conditional', status: 'configurable' },
  { id: 'crossDepartment', status: 'prototype' },
  { id: 'exceptionRouting', status: 'configurable' },
  { id: 'escalation', status: 'planned' },
  { id: 'requiredInfo', status: 'configurable' },
] as const satisfies readonly { id: string; status: ClaimStatus }[];

/* ------------------------------------------------------------------ */
/* 05 Audit / trace                                                     */
/* ------------------------------------------------------------------ */

export const AUDIT_EVENTS = [
  'created',
  'submitted',
  'approved',
  'received',
  'adjusted',
  'closed',
] as const;
export type AuditEvent = (typeof AUDIT_EVENTS)[number];
export const AUDIT_FIELDS = [
  'user',
  'role',
  'department',
  'before',
  'after',
  'order',
  'source',
] as const;
export type AuditField = (typeof AUDIT_FIELDS)[number];

/** Department of each illustrative event (for the provenance line). */
export const AUDIT_DEPT: Record<AuditEvent, DeptKey> = {
  created: 'sales',
  submitted: 'purchasing',
  approved: 'accounting',
  received: 'warehouse',
  adjusted: 'warehouse',
  closed: 'sales',
};

/* ------------------------------------------------------------------ */
/* 06 Executive visibility                                              */
/* ------------------------------------------------------------------ */

export const DRILL = ['organization', 'department', 'workflow', 'item', 'source'] as const;
export type DrillLevel = (typeof DRILL)[number];

export const EXEC_SIGNALS = [
  'blocked',
  'exceptions',
  'approvals',
  'departments',
  'bottlenecks',
  'risk',
] as const;

/* ------------------------------------------------------------------ */
/* 07 Custom workflow                                                   */
/* ------------------------------------------------------------------ */

/** Adjustments the visitor can switch on to see the process adapt. */
export const ADJUSTMENTS = ['approval', 'document', 'notify', 'sequence', 'exception'] as const;
export type Adjustment = (typeof ADJUSTMENTS)[number];

export type ProcessStep =
  | 'request'
  | 'review'
  | 'approval'
  | 'document'
  | 'warehouse'
  | 'purchasing'
  | 'notify'
  | 'exception'
  | 'done';

/** The process for a set of adjustments — deterministic, illustrative. */
export function buildProcess(on: ReadonlySet<Adjustment>): ProcessStep[] {
  const steps: ProcessStep[] = ['request', 'review'];
  if (on.has('approval')) steps.push('approval');
  if (on.has('document')) steps.push('document');
  steps.push(
    ...((on.has('sequence')
      ? ['purchasing', 'warehouse']
      : ['warehouse', 'purchasing']) as ProcessStep[]),
  );
  if (on.has('exception')) steps.push('exception');
  if (on.has('notify')) steps.push('notify');
  steps.push('done');
  return steps;
}

/* ------------------------------------------------------------------ */
/* 08 Integration                                                       */
/* ------------------------------------------------------------------ */

export const SYSTEMS = [
  'accounting',
  'erp',
  'ecommerce',
  'crm',
  'supplier',
  'logistics',
  'bi',
  'internal',
] as const;
export type ExternalSystem = (typeof SYSTEMS)[number];

/* ------------------------------------------------------------------ */
/* 09 Multi-branch                                                      */
/* ------------------------------------------------------------------ */

export const BRANCH_EXAMPLES = [
  'responsibility',
  'stock',
  'ownership',
  'routing',
  'reporting',
] as const;

/* ------------------------------------------------------------------ */
/* 10 Implementation journey                                            */
/* ------------------------------------------------------------------ */

export const PHASES = ['discover', 'design', 'configure', 'prepare', 'launch', 'improve'] as const;
export type Phase = (typeof PHASES)[number];

export const JOURNEY = [
  { id: 'understand', phase: 'discover' },
  { id: 'mapping', phase: 'discover' },
  { id: 'responsibilities', phase: 'design' },
  { id: 'workflows', phase: 'configure' },
  { id: 'data', phase: 'prepare' },
  { id: 'access', phase: 'prepare' },
  { id: 'training', phase: 'prepare' },
  { id: 'pilot', phase: 'launch' },
  { id: 'golive', phase: 'launch' },
  { id: 'improve', phase: 'improve' },
] as const satisfies readonly { id: string; phase: Phase }[];
export type JourneyStep = (typeof JOURNEY)[number]['id'];

/* ------------------------------------------------------------------ */
/* 11 Support & partnership                                             */
/* ------------------------------------------------------------------ */

export const RELATIONSHIP = [
  'consultation',
  'process',
  'implementation',
  'training',
  'integration',
  'support',
] as const;

/* ------------------------------------------------------------------ */
/* 12 Readiness                                                         */
/* ------------------------------------------------------------------ */

export const READINESS = [
  { id: 'identity', status: 'planned' },
  { id: 'access', status: 'prototype' },
  { id: 'workflow', status: 'configurable' },
  { id: 'audit', status: 'ready' },
  { id: 'integration', status: 'ready' },
  { id: 'data', status: 'ready' },
  { id: 'observability', status: 'planned' },
  { id: 'support', status: 'configurable' },
] as const satisfies readonly { id: string; status: ClaimStatus }[];
export type ReadinessLayer = (typeof READINESS)[number]['id'];

export const PRINCIPLES = [
  'accessControl',
  'leastVisibility',
  'boundaries',
  'traceability',
  'architecture',
  'backup',
  'monitoring',
] as const;

/* ------------------------------------------------------------------ */
/* 13 Consultation                                                      */
/* ------------------------------------------------------------------ */

export const QUOTE_FLOW = [
  'consultation',
  'requirements',
  'review',
  'scope',
  'quotation',
  'planning',
] as const;

/** Enterprise links into the rest of the site (locale preserved at render). */
export const CROSS_LINKS = {
  solutions: ['/solutions#management', '/solutions#cross-department', '/solutions#approval'],
  workflow: ['/how-core-works#approval', '/how-core-works#trace', '/how-core-works#roles'],
  departments: ['executive', 'warehouse', 'accounting'] as const satisfies readonly DeptKey[],
} as const;

export const ENTERPRISE_PLAN: PlanId = 'enterprise';
