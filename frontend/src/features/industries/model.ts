import type { DeptKey } from '@/features/departments/catalog';

/*
 * Industries (EP11) — the typed model behind /industries and the six
 * industry pages. Structure lives here; words live in copy/.
 *
 * The same CORE principles hold everywhere; what changes per industry is
 * which departments meet, the order of work, the information that matters,
 * the decisions and what managers watch. Examples are illustrative only.
 */

export const INDUSTRY_IDS = [
  'distribution',
  'services',
  'projects',
  'retail',
  'property',
  'manufacturing',
] as const;
export type IndustryId = (typeof INDUSTRY_IDS)[number];

export const isIndustryId = (v: string): v is IndustryId =>
  (INDUSTRY_IDS as readonly string[]).includes(v);

export const industryPath = (id: IndustryId) => `/industries/${id}`;

/** The visual motif of each environment — geometry, not colour, tells them apart. */
export type Motif = 'network' | 'schedule' | 'milestones' | 'branches' | 'sites' | 'lanes';

/** Signal tone — always shown as icon + words. */
export type SignalTone = 'attention' | 'blocked' | 'waiting';

/** Shared CORE principles — present in every industry, expressed differently. */
export const PRINCIPLES = [
  'workspace',
  'workflow',
  'boundary',
  'approval',
  'exceptions',
  'trace',
  'executive',
] as const;
export type Principle = (typeof PRINCIPLES)[number];

/** What stays the same in every industry. */
export const STAYS = [
  'ownership',
  'workflow',
  'handoff',
  'status',
  'approval',
  'exceptions',
  'traceability',
] as const;
/** What changes from one industry to the next. */
export const CHANGES = [
  'departments',
  'sequence',
  'information',
  'decisions',
  'terminology',
  'signals',
] as const;
export type Change = (typeof CHANGES)[number];

/** Solution anchors (EP09) and How CORE works chapters (EP08) industries link to. */
export type SolutionAnchor =
  | 'falling-through'
  | 'visibility'
  | 'human-error'
  | 'approval'
  | 'stock'
  | 'supplier'
  | 'payment'
  | 'management'
  | 'cross-department';
export type WorkflowAnchor =
  'handoff' | 'approval' | 'exceptions' | 'roles' | 'trace' | 'human-error';

/** Boundaries some industries must state explicitly. */
export type Boundary = 'accounting' | 'pos' | 'propertyProduct' | 'mrp';

export interface Step {
  id: string;
  dept: DeptKey;
}

export interface Industry {
  id: IndustryId;
  motif: Motif;
  /** Primary first. */
  departments: readonly DeptKey[];
  /** Departments that join only in some organizations. */
  optional?: readonly DeptKey[];
  /** One illustrative workflow — never a mandatory sequence. */
  workflow: readonly Step[];
  /** The step where work most often stalls (the biggest friction). */
  stuckAt: string;
  signals: readonly { id: string; tone: SignalTone }[];
  solutions: readonly SolutionAnchor[];
  chapters: readonly WorkflowAnchor[];
  boundaries: readonly Boundary[];
  /** Shows the quiet "many teams, branches or bespoke workflow" link to /enterprise. */
  enterprise: boolean;
}

export const INDUSTRIES: Record<IndustryId, Industry> = {
  distribution: {
    id: 'distribution',
    motif: 'network',
    departments: ['sales', 'warehouse', 'purchasing', 'accounting', 'executive'],
    workflow: [
      { id: 'demand', dept: 'sales' },
      { id: 'availability', dept: 'warehouse' },
      { id: 'order', dept: 'sales' },
      { id: 'pick', dept: 'warehouse' },
      { id: 'replenish', dept: 'purchasing' },
      { id: 'dispatch', dept: 'warehouse' },
      { id: 'complete', dept: 'accounting' },
    ],
    stuckAt: 'availability',
    signals: [
      { id: 'stuckOrders', tone: 'blocked' },
      { id: 'shortage', tone: 'attention' },
      { id: 'supplierLate', tone: 'waiting' },
      { id: 'partialReceipt', tone: 'attention' },
    ],
    solutions: ['stock', 'supplier', 'visibility'],
    chapters: ['handoff', 'exceptions'],
    boundaries: ['accounting'],
    enterprise: true,
  },
  services: {
    id: 'services',
    motif: 'schedule',
    departments: ['operations', 'sales', 'accounting', 'executive'],
    optional: ['warehouse', 'purchasing'],
    workflow: [
      { id: 'request', dept: 'sales' },
      { id: 'plan', dept: 'operations' },
      { id: 'assign', dept: 'operations' },
      { id: 'execute', dept: 'operations' },
      { id: 'evidence', dept: 'operations' },
      { id: 'bill', dept: 'accounting' },
      { id: 'close', dept: 'sales' },
    ],
    stuckAt: 'assign',
    signals: [
      { id: 'overdue', tone: 'blocked' },
      { id: 'unassigned', tone: 'attention' },
      { id: 'missingEvidence', tone: 'attention' },
      { id: 'customerWaiting', tone: 'waiting' },
    ],
    solutions: ['falling-through', 'visibility', 'approval'],
    chapters: ['handoff', 'approval'],
    boundaries: ['accounting'],
    enterprise: false,
  },
  projects: {
    id: 'projects',
    motif: 'milestones',
    departments: ['operations', 'sales', 'purchasing', 'accounting', 'executive'],
    workflow: [
      { id: 'requirement', dept: 'sales' },
      { id: 'planning', dept: 'operations' },
      { id: 'procurement', dept: 'purchasing' },
      { id: 'execution', dept: 'operations' },
      { id: 'milestone', dept: 'operations' },
      { id: 'acceptance', dept: 'sales' },
      { id: 'payment', dept: 'accounting' },
      { id: 'complete', dept: 'executive' },
    ],
    stuckAt: 'procurement',
    signals: [
      { id: 'milestoneRisk', tone: 'attention' },
      { id: 'dependencyDelay', tone: 'blocked' },
      { id: 'pendingAcceptance', tone: 'waiting' },
      { id: 'waitingApproval', tone: 'waiting' },
    ],
    solutions: ['cross-department', 'approval', 'management'],
    chapters: ['approval', 'roles'],
    boundaries: ['accounting'],
    enterprise: true,
  },
  retail: {
    id: 'retail',
    motif: 'branches',
    departments: ['operations', 'warehouse', 'purchasing', 'executive'],
    workflow: [
      { id: 'branchDemand', dept: 'operations' },
      { id: 'inventory', dept: 'warehouse' },
      { id: 'replenish', dept: 'purchasing' },
      { id: 'transfer', dept: 'warehouse' },
      { id: 'receipt', dept: 'operations' },
      { id: 'exception', dept: 'operations' },
      { id: 'visibility', dept: 'executive' },
    ],
    stuckAt: 'transfer',
    signals: [
      { id: 'branchException', tone: 'attention' },
      { id: 'stockIssue', tone: 'blocked' },
      { id: 'transferPending', tone: 'waiting' },
      { id: 'expiryRisk', tone: 'attention' },
    ],
    solutions: ['stock', 'management'],
    chapters: ['exceptions', 'roles'],
    boundaries: ['pos', 'accounting'],
    enterprise: true,
  },
  property: {
    id: 'property',
    motif: 'sites',
    departments: ['operations', 'purchasing', 'accounting', 'executive'],
    workflow: [
      { id: 'request', dept: 'operations' },
      { id: 'assign', dept: 'operations' },
      { id: 'service', dept: 'operations' },
      { id: 'material', dept: 'purchasing' },
      { id: 'complete', dept: 'operations' },
      { id: 'document', dept: 'accounting' },
      { id: 'visibility', dept: 'executive' },
    ],
    stuckAt: 'material',
    signals: [
      { id: 'openIssues', tone: 'attention' },
      { id: 'vendorDelay', tone: 'waiting' },
      { id: 'overdueMaintenance', tone: 'blocked' },
      { id: 'notClosed', tone: 'attention' },
    ],
    solutions: ['falling-through', 'supplier', 'payment'],
    chapters: ['handoff', 'trace'],
    boundaries: ['propertyProduct', 'accounting'],
    enterprise: true,
  },
  manufacturing: {
    id: 'manufacturing',
    motif: 'lanes',
    departments: ['operations', 'warehouse', 'purchasing', 'sales', 'executive'],
    optional: ['accounting'],
    workflow: [
      { id: 'demand', dept: 'sales' },
      { id: 'availability', dept: 'warehouse' },
      { id: 'planning', dept: 'operations' },
      { id: 'workOrder', dept: 'operations' },
      { id: 'material', dept: 'warehouse' },
      { id: 'purchasing', dept: 'purchasing' },
      { id: 'receiving', dept: 'warehouse' },
      { id: 'production', dept: 'operations' },
      { id: 'output', dept: 'warehouse' },
      { id: 'delivery', dept: 'sales' },
    ],
    stuckAt: 'material',
    signals: [
      { id: 'woDelay', tone: 'blocked' },
      { id: 'materialShortage', tone: 'attention' },
      { id: 'partialCompletion', tone: 'waiting' },
      { id: 'handoffPending', tone: 'attention' },
    ],
    solutions: ['stock', 'cross-department', 'human-error'],
    chapters: ['human-error', 'exceptions', 'trace'],
    boundaries: ['mrp', 'accounting'],
    enterprise: true,
  },
};

/** "What describes your organization?" — one deterministic answer per option. */
export const FIT = [
  { id: 'goods', industry: 'distribution' },
  { id: 'service', industry: 'services' },
  { id: 'projects', industry: 'projects' },
  { id: 'stores', industry: 'retail' },
  { id: 'sites', industry: 'property' },
  { id: 'produce', industry: 'manufacturing' },
] as const satisfies readonly { id: string; industry: IndustryId }[];
export type FitId = (typeof FIT)[number]['id'];

export const fitResult = (id: FitId): IndustryId => FIT.find((f) => f.id === id)!.industry;

/* ------------------------------------------------------------------ */
/* Signature-section sample data (illustrative quantities only)         */
/* ------------------------------------------------------------------ */

/** Distribution: one order against stock and an outstanding receipt. */
export const ORDER_LINES = [
  { id: 'a', ordered: 40, onHand: 40 },
  { id: 'b', ordered: 30, onHand: 12 },
  { id: 'c', ordered: 20, onHand: 0 },
] as const;
/** Units arriving from the open purchase order when it is received. */
export const INBOUND: Record<(typeof ORDER_LINES)[number]['id'], number> = { a: 0, b: 18, c: 20 };

export type LineState = 'ready' | 'partial' | 'short';
export function lineState(ordered: number, available: number): LineState {
  if (available >= ordered) return 'ready';
  return available > 0 ? 'partial' : 'short';
}

/** Projects: phases, milestones and the dependency a late delivery breaks. */
export const PHASES = ['plan', 'procure', 'build', 'handover'] as const;
export const MILESTONES = [
  { id: 'design', phase: 'plan', after: [] },
  { id: 'materials', phase: 'procure', after: ['design'] },
  { id: 'install', phase: 'build', after: ['materials'] },
  { id: 'systems', phase: 'build', after: ['design'] },
  { id: 'inspection', phase: 'handover', after: ['install', 'systems'] },
  { id: 'acceptance', phase: 'handover', after: ['inspection'] },
] as const;
export type MilestoneId = (typeof MILESTONES)[number]['id'];

/** Every milestone downstream of `from` (inclusive) — the delay's reach. */
export function downstream(from: MilestoneId): MilestoneId[] {
  const hit = new Set<MilestoneId>([from]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of MILESTONES) {
      if (!hit.has(m.id) && m.after.some((a) => hit.has(a as MilestoneId))) {
        hit.add(m.id);
        grew = true;
      }
    }
  }
  return MILESTONES.filter((m) => hit.has(m.id)).map((m) => m.id);
}

/** Retail: branch health by signal — states, never sales figures. */
export const BRANCH_CHECKS = ['stock', 'replenish', 'transfer', 'count', 'expiry'] as const;
export type BranchCheck = (typeof BRANCH_CHECKS)[number];
export type Health = 'ok' | 'attention' | 'blocked';
export const BRANCHES = [
  { id: 'b1', health: { stock: 'ok', replenish: 'ok', transfer: 'ok', count: 'ok', expiry: 'ok' } },
  {
    id: 'b2',
    health: {
      stock: 'attention',
      replenish: 'ok',
      transfer: 'attention',
      count: 'ok',
      expiry: 'ok',
    },
  },
  {
    id: 'b3',
    health: { stock: 'ok', replenish: 'ok', transfer: 'ok', count: 'ok', expiry: 'attention' },
  },
  {
    id: 'b4',
    health: { stock: 'blocked', replenish: 'attention', transfer: 'ok', count: 'ok', expiry: 'ok' },
  },
  {
    id: 'b5',
    health: { stock: 'ok', replenish: 'ok', transfer: 'ok', count: 'attention', expiry: 'ok' },
  },
  { id: 'b6', health: { stock: 'ok', replenish: 'ok', transfer: 'ok', count: 'ok', expiry: 'ok' } },
] as const satisfies readonly { id: string; health: Record<BranchCheck, Health> }[];
export type BranchId = (typeof BRANCHES)[number]['id'];

export const worstHealth = (h: Record<BranchCheck, Health>): Health =>
  Object.values(h).includes('blocked')
    ? 'blocked'
    : Object.values(h).includes('attention')
      ? 'attention'
      : 'ok';

/** Property: three requests, each on its own path and stuck somewhere different. */
export const REQUEST_STAGES = [
  'received',
  'assigned',
  'vendor',
  'material',
  'done',
  'closed',
] as const;
export type RequestStage = (typeof REQUEST_STAGES)[number];
export const REQUESTS = [
  {
    id: 'r1',
    site: 'a',
    path: ['received', 'assigned', 'vendor', 'done', 'closed'],
    stuck: 'vendor',
  },
  {
    id: 'r2',
    site: 'b',
    path: ['received', 'assigned', 'material', 'done', 'closed'],
    stuck: 'material',
  },
  { id: 'r3', site: 'c', path: ['received', 'assigned', 'done', 'closed'], stuck: 'closed' },
] as const satisfies readonly {
  id: string;
  site: string;
  path: readonly RequestStage[];
  stuck: RequestStage;
}[];
export type RequestId = (typeof REQUESTS)[number]['id'];

/** Services: the evidence a job needs before it can close. */
export const EVIDENCE = ['photos', 'checklist', 'signoff'] as const;
export type Evidence = (typeof EVIDENCE)[number];

/** Manufacturing: one Work Order, its materials and a partial output. */
export const WORK_ORDER = { planned: 500, done: 300 } as const;
export const MATERIALS = [
  { id: 'm1', required: 500, available: 500 },
  { id: 'm2', required: 1000, available: 640 },
  { id: 'm3', required: 500, available: 500 },
] as const;
/** Open material still to arrive from purchasing. */
export const MATERIAL_INBOUND: Partial<Record<(typeof MATERIALS)[number]['id'], number>> = {
  m2: 360,
};

/** How many units of the Work Order the materials allow (each line scales by required/planned). */
export function buildable(received = false): number {
  return Math.min(
    ...MATERIALS.map((m) => {
      const have = m.available + (received ? (MATERIAL_INBOUND[m.id] ?? 0) : 0);
      return Math.floor((Math.min(have, m.required) / m.required) * WORK_ORDER.planned);
    }),
  );
}
