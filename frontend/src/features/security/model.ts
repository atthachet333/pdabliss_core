import type { ClaimStatus } from '@/features/enterprise/model';

/*
 * Security & Trust (EP15) — the typed model behind /security.
 * Structure, visibility and statuses live here; words live in copy.ts.
 *
 * Claim discipline: statuses reuse the EP10 taxonomy (prototype ·
 * configurable · ready · planned). Nothing here is a certification, and the
 * visibility below is illustrative — the production RBAC model is enforced
 * server-side in later backend phases.
 */

export type { ClaimStatus };

/** Section ids — in-page links and the mega menu point here. */
export const CHAPTER = {
  windows: 'visibility',
  warehouse: 'warehouse',
  roles: 'executive-admin',
  enforcement: 'enforcement',
  trace: 'trace',
  control: 'control',
  data: 'data',
  readiness: 'readiness',
  faq: 'faq',
  consult: 'consult',
} as const;

/* ------------------------------------------------------------------ */
/* One work item, six visibility windows                                */
/* ------------------------------------------------------------------ */

export const SECURITY_ROLES = [
  'sales',
  'warehouse',
  'purchasing',
  'accounting',
  'executive',
  'admin',
] as const;
export type SecurityRole = (typeof SECURITY_ROLES)[number];

/** Fields of one shared work item (customer order SO-1042 and its supply). */
export const FIELDS = [
  'order',
  'customer',
  'item',
  'quantity',
  'location',
  'lot',
  'expiry',
  'receiving',
  'picking',
  'price',
  'cost',
  'margin',
  'payment',
  'terms',
  'exception',
  'permissions',
] as const;
export type Field = (typeof FIELDS)[number];

/** Commercial and financial fields — never part of the Warehouse view. */
export const MONEY_FIELDS: readonly Field[] = ['price', 'cost', 'margin', 'payment', 'terms'];

/**
 * Illustrative visibility per role. Exact roles and fields are configured by
 * implementation scope — this is not a final production RBAC model.
 */
export const VISIBILITY: Record<SecurityRole, readonly Field[]> = {
  sales: ['order', 'customer', 'item', 'quantity', 'price', 'exception'],
  warehouse: ['item', 'quantity', 'location', 'lot', 'expiry', 'receiving', 'picking'],
  purchasing: ['item', 'quantity', 'receiving', 'cost', 'terms', 'exception'],
  accounting: ['order', 'customer', 'price', 'cost', 'margin', 'payment', 'terms'],
  executive: ['order', 'customer', 'price', 'margin', 'exception'],
  // Administration is configuration — not business visibility.
  admin: ['permissions'],
};

export const sees = (role: SecurityRole, field: Field) => VISIBILITY[role].includes(field);

/** Windows sit around the work item: three on each side. */
export const WINDOW_SIDE: Record<SecurityRole, 'left' | 'right'> = {
  sales: 'left',
  warehouse: 'left',
  purchasing: 'left',
  accounting: 'right',
  executive: 'right',
  admin: 'right',
};

/* ------------------------------------------------------------------ */
/* Trace — the intended provenance of one change                        */
/* ------------------------------------------------------------------ */

export const TRACE_PARTS = [
  'who',
  'role',
  'department',
  'action',
  'before',
  'after',
  'order',
  'source',
] as const;
export type TracePart = (typeof TRACE_PARTS)[number];

export const TRACE_EVENTS = ['receive', 'lot', 'approve'] as const;
export type TraceEvent = (typeof TRACE_EVENTS)[number];

/* ------------------------------------------------------------------ */
/* Control — sensitive actions (statuses from EP10 CONTROLS)            */
/* ------------------------------------------------------------------ */

export const CONTROLS = [
  { id: 'requiredInfo', status: 'configurable' },
  { id: 'approval', status: 'configurable' },
  { id: 'conditions', status: 'configurable' },
  { id: 'responsibility', status: 'prototype' },
] as const satisfies readonly { id: string; status: ClaimStatus }[];
export type ControlId = (typeof CONTROLS)[number]['id'];

/* ------------------------------------------------------------------ */
/* Data principles and go-live readiness                                */
/* ------------------------------------------------------------------ */

export const PRINCIPLES = [
  'collect',
  'visibility',
  'trace',
  'configuration',
  'backup',
  'availability',
  'hardening',
] as const;

/** What a production deployment must have before live use. */
export const GO_LIVE = ['backup', 'recovery', 'monitoring', 'incident'] as const;

/* ------------------------------------------------------------------ */
/* Readiness matrix — statuses consistent with EP10 READINESS           */
/* ------------------------------------------------------------------ */

export const MATRIX = [
  { id: 'identity', status: 'planned' },
  { id: 'access', status: 'prototype' },
  { id: 'workflow', status: 'configurable' },
  { id: 'trace', status: 'ready' },
  { id: 'data', status: 'ready' },
  { id: 'backup', status: 'planned' },
  { id: 'observability', status: 'planned' },
  { id: 'integration', status: 'ready' },
] as const satisfies readonly { id: string; status: ClaimStatus }[];
export type MatrixRow = (typeof MATRIX)[number]['id'];

/* ------------------------------------------------------------------ */
/* FAQ                                                                  */
/* ------------------------------------------------------------------ */

export const FAQ = [
  'warehousePrice',
  'sameData',
  'execAdmin',
  'audit',
  'sso',
  'mfa',
  'backup',
  'certification',
  'separation',
  'integration',
] as const;
export type FaqId = (typeof FAQ)[number];

/** Links into the rest of the site (locale preserved at render). */
export const SECURITY_LINKS = {
  consult: '/contact?interest=implementation',
  enterprise: '/enterprise',
  demo: '/demo',
  warehouseDemo: '/demo?role=warehouse',
  approval: '/how-core-works#approval',
  control: '/enterprise#control',
} as const;
