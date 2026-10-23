import type { DeptKey } from '@/features/departments/catalog';

/*
 * How CORE works (EP08) — the shared, typed model of ONE illustrative piece
 * of work travelling through the company. Every chapter of /how-core-works
 * renders from this file: the route, the decisions that change it, what each
 * department may see, the exceptions, the human-error safeguards and the trace.
 *
 * It is an illustration ("ตัวอย่างกระบวนการ"), not a workflow engine: nothing
 * here runs, persists or enforces anything. Localized words live in copy.ts.
 */

/** Departments in the route. The supplier is outside the company. */
export type Actor = Exclude<DeptKey, 'executive'> | 'supplier';
export type Lane = Actor | 'executive';

/** Lane order, top to bottom. Executive observes from above. */
export const LANES: readonly Lane[] = [
  'executive',
  'sales',
  'operations',
  'warehouse',
  'purchasing',
  'accounting',
  'supplier',
];

/** CORE status language — always shown with an icon and words, never colour alone. */
export type Status = 'normal' | 'attention' | 'blocked' | 'waiting' | 'complete';
export const STATUSES: readonly Status[] = [
  'normal',
  'attention',
  'blocked',
  'waiting',
  'complete',
];

/** Sample record codes — generic, no customer or company names. */
export const RECORDS = {
  customerPo: 'CPO-0418',
  salesOrder: 'SO-1042',
  workOrder: 'WO-0307',
  purchaseReq: 'PR-0761',
  purchaseOrder: 'PO-2215',
  paymentRequest: 'PAY-0093',
  lot: 'LOT-2410-A',
  delivery: 'DO-0588',
} as const;

export type StepId =
  | 'customerPo'
  | 'salesOrder'
  | 'stockCheck'
  | 'shortage'
  | 'workRequirement'
  | 'purchaseRequirement'
  | 'purchaseOrder'
  | 'depositRequest'
  | 'depositApproved'
  | 'supplierShips'
  | 'goodsReceived'
  | 'lotRecorded'
  | 'stockAvailable'
  | 'fulfilment'
  | 'salesReady'
  | 'complete';

/** Which optional branch a step belongs to (main = every order). */
export type Branch = 'main' | 'shortage' | 'work' | 'purchase' | 'deposit';

export interface WorkflowStep {
  id: StepId;
  actor: Actor;
  branch: Branch;
  /** The record the step creates or works on. */
  record?: keyof typeof RECORDS;
}

/** The full illustrative route, in order (16 steps). */
export const STEPS: readonly WorkflowStep[] = [
  { id: 'customerPo', actor: 'sales', branch: 'main', record: 'customerPo' },
  { id: 'salesOrder', actor: 'sales', branch: 'main', record: 'salesOrder' },
  { id: 'stockCheck', actor: 'warehouse', branch: 'main', record: 'salesOrder' },
  { id: 'shortage', actor: 'warehouse', branch: 'shortage', record: 'salesOrder' },
  { id: 'workRequirement', actor: 'operations', branch: 'work', record: 'workOrder' },
  { id: 'purchaseRequirement', actor: 'purchasing', branch: 'purchase', record: 'purchaseReq' },
  { id: 'purchaseOrder', actor: 'purchasing', branch: 'purchase', record: 'purchaseOrder' },
  { id: 'depositRequest', actor: 'accounting', branch: 'deposit', record: 'paymentRequest' },
  { id: 'depositApproved', actor: 'accounting', branch: 'deposit', record: 'paymentRequest' },
  { id: 'supplierShips', actor: 'supplier', branch: 'purchase', record: 'purchaseOrder' },
  { id: 'goodsReceived', actor: 'warehouse', branch: 'purchase', record: 'purchaseOrder' },
  { id: 'lotRecorded', actor: 'warehouse', branch: 'purchase', record: 'lot' },
  { id: 'stockAvailable', actor: 'warehouse', branch: 'shortage', record: 'lot' },
  { id: 'fulfilment', actor: 'warehouse', branch: 'main', record: 'delivery' },
  { id: 'salesReady', actor: 'sales', branch: 'main', record: 'salesOrder' },
  { id: 'complete', actor: 'sales', branch: 'main', record: 'salesOrder' },
];

export const getStep = (id: StepId) => STEPS.find((s) => s.id === id)!;

/* ------------------------------------------------------------------ */
/* Decisions → route                                                    */
/* ------------------------------------------------------------------ */

export interface Decisions {
  /** Is there enough stock for the order? */
  stockEnough: boolean;
  /** Does the shortage need work by Operations (produce, assemble, prepare)? */
  needWork: boolean;
  /** Does the shortage need a supplier purchase? */
  needPurchase: boolean;
  /** Does the supplier require a deposit before shipping? */
  depositRequired: boolean;
  /** Did the received goods pass receiving / QC? */
  qcPassed: boolean;
}

export type DecisionId = keyof Decisions;
export const DECISION_IDS: readonly DecisionId[] = [
  'stockEnough',
  'needWork',
  'needPurchase',
  'depositRequired',
  'qcPassed',
];

/** The illustrative default: a shortage that needs work, a purchase and a deposit. */
export const DEFAULT_DECISIONS: Decisions = {
  stockEnough: false,
  needWork: true,
  needPurchase: true,
  depositRequired: true,
  qcPassed: true,
};

/** A decision only matters when the route reaches it. */
export function isDecisionRelevant(id: DecisionId, d: Decisions): boolean {
  if (id === 'stockEnough') return true;
  if (d.stockEnough) return false;
  if (id === 'depositRequired' || id === 'qcPassed') return d.needPurchase;
  return true;
}

export interface RouteStep extends WorkflowStep {
  status: Status;
}

export interface Route {
  steps: RouteStep[];
  /** Steps of the full route this case skips. */
  skipped: StepId[];
  /** Where the work stops, when it cannot continue on its own. */
  pausedAt: StepId | null;
}

/**
 * The route one order takes for a set of decisions. Steps after a pause are
 * kept (status "waiting") so the visitor sees what is still ahead.
 */
export function buildRoute(d: Decisions): Route {
  const include = (s: WorkflowStep): boolean => {
    switch (s.branch) {
      case 'main':
        return true;
      case 'shortage':
        return !d.stockEnough;
      case 'work':
        return !d.stockEnough && d.needWork;
      case 'purchase':
        return !d.stockEnough && d.needPurchase;
      case 'deposit':
        return !d.stockEnough && d.needPurchase && d.depositRequired;
    }
  };
  const chosen = STEPS.filter(include);
  const skipped = STEPS.filter((s) => !include(s)).map((s) => s.id);

  // A shortage with no way to replenish needs a decision: the work stops there.
  let pausedAt: StepId | null = null;
  if (!d.stockEnough && !d.needWork && !d.needPurchase) pausedAt = 'shortage';
  // Goods on QC hold stop at receiving until they are checked and released.
  else if (!d.stockEnough && d.needPurchase && !d.qcPassed) pausedAt = 'lotRecorded';

  let paused = false;
  const steps = chosen.map((s): RouteStep => {
    if (paused) return { ...s, status: 'waiting' };
    if (s.id === pausedAt) {
      paused = true;
      return { ...s, status: s.id === 'shortage' ? 'attention' : 'blocked' };
    }
    if (s.id === 'shortage') return { ...s, status: 'attention' };
    return { ...s, status: s.id === 'complete' ? 'complete' : 'normal' };
  });
  return { steps, skipped, pausedAt };
}

/** Actors that take part in a route, in lane order. */
export function actorsIn(route: Route): Actor[] {
  const set = new Set(route.steps.map((s) => s.actor));
  return LANES.filter((l): l is Actor => l !== 'executive' && set.has(l as Actor));
}

/* ------------------------------------------------------------------ */
/* Information boundaries                                               */
/* ------------------------------------------------------------------ */

export type Field =
  | 'customer'
  | 'orderLines'
  | 'orderValue'
  | 'deliveryDate'
  | 'readiness'
  | 'workRequirement'
  | 'team'
  | 'dueDate'
  | 'progress'
  | 'item'
  | 'quantity'
  | 'lot'
  | 'location'
  | 'expiry'
  | 'need'
  | 'supplier'
  | 'purchaseOrder'
  | 'expectedReceipt'
  | 'paymentRequest'
  | 'paymentAmount'
  | 'documentStatus'
  | 'paymentDependency'
  | 'state'
  | 'exception'
  | 'risk'
  | 'bottleneck';

/** Money fields. They must never reach the Warehouse (or Operations). */
export const FINANCIAL_FIELDS: readonly Field[] = ['orderValue', 'paymentAmount'];

/** What each lane sees of the SAME work item. */
export const VISIBLE: Record<Lane, readonly Field[]> = {
  sales: ['customer', 'orderLines', 'orderValue', 'deliveryDate', 'readiness'],
  operations: ['workRequirement', 'team', 'dueDate', 'progress'],
  warehouse: ['item', 'quantity', 'lot', 'location', 'expiry'],
  purchasing: ['need', 'supplier', 'purchaseOrder', 'expectedReceipt'],
  accounting: ['paymentRequest', 'paymentAmount', 'documentStatus', 'paymentDependency'],
  executive: ['state', 'exception', 'risk', 'bottleneck'],
  supplier: ['purchaseOrder', 'expectedReceipt'],
};

/** Examples of what a lane deliberately does NOT receive. */
export const HIDDEN: Record<Lane, readonly Field[]> = {
  sales: ['paymentAmount'],
  operations: ['orderValue', 'paymentAmount'],
  warehouse: ['orderValue', 'paymentAmount', 'customer'],
  purchasing: ['orderValue'],
  accounting: ['location'],
  executive: ['orderLines', 'location'],
  supplier: ['customer', 'orderValue'],
};

/* ------------------------------------------------------------------ */
/* Handoff                                                              */
/* ------------------------------------------------------------------ */

/** What a CORE handoff carries — more than a message. */
export const HANDOFF_PARTS = [
  'fromOwner',
  'toOwner',
  'state',
  'required',
  'changedAt',
  'next',
] as const;
export type HandoffPart = (typeof HANDOFF_PARTS)[number];

/* ------------------------------------------------------------------ */
/* Approval                                                             */
/* ------------------------------------------------------------------ */

export const APPROVAL_CHAIN = [
  'poCreated',
  'depositRule',
  'accountingReview',
  'approved',
  'supplierConfirms',
  'expectedDelivery',
] as const;
export type ApprovalStage = (typeof APPROVAL_CHAIN)[number];
/** The chain waits here until the approver decides. */
export const APPROVAL_PAUSE: ApprovalStage = 'accountingReview';

export const APPROVAL_TYPES = ['single', 'multiStep', 'conditional'] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

/* ------------------------------------------------------------------ */
/* Exceptions                                                           */
/* ------------------------------------------------------------------ */

export type ExceptionId =
  | 'shortage'
  | 'supplierLate'
  | 'documentIncomplete'
  | 'countVariance'
  | 'nearExpiry'
  | 'approvalWaiting'
  | 'workDelayed';

export interface WorkflowException {
  id: ExceptionId;
  step: StepId;
  status: Exclude<Status, 'normal' | 'complete'>;
  /** Who is asked to act. */
  owner: Lane;
}

export const EXCEPTIONS: readonly WorkflowException[] = [
  { id: 'shortage', step: 'stockCheck', status: 'attention', owner: 'warehouse' },
  { id: 'workDelayed', step: 'workRequirement', status: 'attention', owner: 'operations' },
  { id: 'approvalWaiting', step: 'depositRequest', status: 'waiting', owner: 'accounting' },
  { id: 'documentIncomplete', step: 'depositApproved', status: 'blocked', owner: 'accounting' },
  { id: 'supplierLate', step: 'supplierShips', status: 'attention', owner: 'purchasing' },
  { id: 'countVariance', step: 'goodsReceived', status: 'blocked', owner: 'warehouse' },
  { id: 'nearExpiry', step: 'lotRecorded', status: 'attention', owner: 'warehouse' },
];

/* ------------------------------------------------------------------ */
/* Human-error safeguards                                               */
/* ------------------------------------------------------------------ */

export type Principle = 'prevent' | 'detect' | 'alert' | 'control' | 'trace';
export const PRINCIPLES: readonly Principle[] = ['prevent', 'detect', 'alert', 'control', 'trace'];

/** Where each safeguard acts in the route, with its illustrative numbers. */
export const SAFEGUARDS: Record<Principle, { step: StepId; lane: Lane }> = {
  prevent: { step: 'lotRecorded', lane: 'warehouse' },
  detect: { step: 'goodsReceived', lane: 'warehouse' },
  alert: { step: 'supplierShips', lane: 'purchasing' },
  control: { step: 'depositApproved', lane: 'accounting' },
  trace: { step: 'salesOrder', lane: 'executive' },
};

/** DETECT example: quantities only — no prices. */
export const RECEIVING_SAMPLE = { ordered: 100, received: 80 } as const;

/* ------------------------------------------------------------------ */
/* Roles                                                                */
/* ------------------------------------------------------------------ */

export type Role = 'employee' | 'manager' | 'executive';
export const ROLES: readonly Role[] = ['employee', 'manager', 'executive'];

/** Each role looks at the same route; only the emphasis differs. */
export const ROLE_FOCUS: Record<Role, { lane: Lane; steps: StepId[] }> = {
  // A warehouse team member: the steps assigned to them.
  employee: { lane: 'warehouse', steps: ['goodsReceived', 'lotRecorded', 'fulfilment'] },
  // A purchasing lead: where the team's work is stuck.
  manager: { lane: 'purchasing', steps: ['purchaseOrder', 'depositRequest', 'supplierShips'] },
  // Executives: bottlenecks and exceptions only.
  executive: { lane: 'executive', steps: ['stockCheck', 'depositRequest', 'supplierShips'] },
};

/* ------------------------------------------------------------------ */
/* Trace                                                                */
/* ------------------------------------------------------------------ */

export type TraceEvent =
  | 'created'
  | 'assigned'
  | 'checked'
  | 'requested'
  | 'reviewed'
  | 'approved'
  | 'shipped'
  | 'received'
  | 'moved'
  | 'ready'
  | 'completed';

export interface TraceEntry {
  event: TraceEvent;
  step: StepId;
  /** The role responsible for the change. */
  role: Lane;
  status: Status;
}

/** The history of the default route, in order. Times are illustrative. */
export const TRACE: readonly TraceEntry[] = [
  { event: 'created', step: 'salesOrder', role: 'sales', status: 'normal' },
  { event: 'checked', step: 'stockCheck', role: 'warehouse', status: 'attention' },
  { event: 'assigned', step: 'workRequirement', role: 'operations', status: 'normal' },
  { event: 'requested', step: 'purchaseOrder', role: 'purchasing', status: 'normal' },
  { event: 'reviewed', step: 'depositRequest', role: 'accounting', status: 'waiting' },
  { event: 'approved', step: 'depositApproved', role: 'accounting', status: 'normal' },
  { event: 'shipped', step: 'supplierShips', role: 'supplier', status: 'normal' },
  { event: 'received', step: 'goodsReceived', role: 'warehouse', status: 'normal' },
  { event: 'moved', step: 'stockAvailable', role: 'warehouse', status: 'normal' },
  { event: 'ready', step: 'salesReady', role: 'sales', status: 'normal' },
  { event: 'completed', step: 'complete', role: 'sales', status: 'complete' },
];

/** Department handoffs in the trace (consecutive entries with different roles). */
export function provenance(trace: readonly TraceEntry[]): Lane[] {
  return trace.reduce<Lane[]>((acc, e) => (acc.at(-1) === e.role ? acc : [...acc, e.role]), []);
}

/* ------------------------------------------------------------------ */
/* Adaptation                                                           */
/* ------------------------------------------------------------------ */

export const ADAPTATIONS = [
  'approval',
  'departments',
  'sequence',
  'notifications',
  'controls',
] as const;
export type Adaptation = (typeof ADAPTATIONS)[number];

/** Section ids — the mega menu and in-page links point here. */
export const CHAPTER = {
  problem: 'one-work',
  enters: 'work-enters-core',
  routing: 'responsibility',
  handoff: 'handoff',
  decisions: 'decisions',
  approval: 'approval',
  exceptions: 'exceptions',
  humanError: 'human-error',
  roles: 'roles',
  trace: 'trace',
  replay: 'replay',
  adapt: 'adapt',
} as const;
