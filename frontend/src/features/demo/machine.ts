import { OUTSTANDING, SCENARIO, type LotChoice } from './scenario';

/*
 * The EP14 demo state machine — deterministic, typed and in memory only.
 *
 * Every rule of the scenario lives here: which state the work item is in,
 * which role may act, what each action changes, where work is handed off,
 * when the exception opens and clears, and what CORE refuses (closing a
 * receipt without lot / expiry). Components only read state and dispatch.
 * Nothing persists, calls an API or touches the real app.
 */

export const ROLES = ['sales', 'warehouse', 'purchasing', 'accounting', 'executive'] as const;
export type Role = (typeof ROLES)[number];
/** Roles that operate the work item (Executive only observes). */
export type Operator = Exclude<Role, 'executive'>;

export const STATES = [
  'ORDER_RECEIVED',
  'STOCK_SHORTAGE',
  'PURCHASE_REQUIRED',
  'PO_OPEN',
  'PARTIAL_RECEIPT',
  'BALANCE_INBOUND',
  'RECEIVING_OPEN',
  'RECEIVED',
  'DOCUMENT_CHECK',
  'PICKING',
  'READY_TO_DELIVER',
  'DELIVERED',
] as const;
export type DemoStatus = (typeof STATES)[number];

export const TERMINAL: readonly DemoStatus[] = ['DELIVERED'];

export type ActionId =
  | 'checkStock'
  | 'requestPurchase'
  | 'openPo'
  | 'receiveGoods'
  | 'confirmBalance'
  | 'receiveBalance'
  | 'recordLot'
  | 'closeReceiving'
  | 'checkDocuments'
  | 'recordApproval'
  | 'pickFefo'
  | 'confirmDelivery';

export type Action = { id: Exclude<ActionId, 'recordLot'> } | { id: 'recordLot'; lot: LotChoice };

/** Who performs each action. */
export const ACTION_ROLE: Record<ActionId, Operator> = {
  checkStock: 'sales',
  requestPurchase: 'sales',
  openPo: 'purchasing',
  receiveGoods: 'warehouse',
  confirmBalance: 'purchasing',
  receiveBalance: 'warehouse',
  recordLot: 'warehouse',
  closeReceiving: 'warehouse',
  checkDocuments: 'accounting',
  recordApproval: 'accounting',
  pickFefo: 'warehouse',
  confirmDelivery: 'sales',
};

/** The actions each state offers — the whole transition table, in one place. */
export const AVAILABLE: Record<DemoStatus, readonly ActionId[]> = {
  ORDER_RECEIVED: ['checkStock'],
  STOCK_SHORTAGE: ['requestPurchase'],
  PURCHASE_REQUIRED: ['openPo'],
  PO_OPEN: ['receiveGoods'],
  PARTIAL_RECEIPT: ['confirmBalance'],
  BALANCE_INBOUND: ['receiveBalance'],
  RECEIVING_OPEN: ['recordLot', 'closeReceiving'],
  RECEIVED: ['checkDocuments'],
  DOCUMENT_CHECK: ['recordApproval'],
  PICKING: ['pickFefo'],
  READY_TO_DELIVER: ['confirmDelivery'],
  DELIVERED: [],
};

/** Where a successful action leads (recordLot stays in place). */
const NEXT: Record<Exclude<ActionId, 'recordLot'>, DemoStatus> = {
  checkStock: 'STOCK_SHORTAGE',
  requestPurchase: 'PURCHASE_REQUIRED',
  openPo: 'PO_OPEN',
  receiveGoods: 'PARTIAL_RECEIPT',
  confirmBalance: 'BALANCE_INBOUND',
  receiveBalance: 'RECEIVING_OPEN',
  closeReceiving: 'RECEIVED',
  checkDocuments: 'DOCUMENT_CHECK',
  recordApproval: 'PICKING',
  pickFefo: 'READY_TO_DELIVER',
  confirmDelivery: 'DELIVERED',
};

/** Who owns the work item in each state. */
export const OWNER: Record<DemoStatus, Operator> = {
  ORDER_RECEIVED: 'sales',
  STOCK_SHORTAGE: 'sales',
  PURCHASE_REQUIRED: 'purchasing',
  PO_OPEN: 'warehouse',
  PARTIAL_RECEIPT: 'purchasing',
  BALANCE_INBOUND: 'warehouse',
  RECEIVING_OPEN: 'warehouse',
  RECEIVED: 'accounting',
  DOCUMENT_CHECK: 'accounting',
  PICKING: 'warehouse',
  READY_TO_DELIVER: 'sales',
  DELIVERED: 'sales',
};

/** Progress stages shown to the visitor (several states per stage). */
export const STAGES = [
  'order',
  'stock',
  'replenish',
  'receiving',
  'verification',
  'ready',
  'complete',
] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_OF: Record<DemoStatus, Stage> = {
  ORDER_RECEIVED: 'order',
  STOCK_SHORTAGE: 'stock',
  PURCHASE_REQUIRED: 'replenish',
  PO_OPEN: 'replenish',
  PARTIAL_RECEIPT: 'receiving',
  BALANCE_INBOUND: 'receiving',
  RECEIVING_OPEN: 'receiving',
  RECEIVED: 'verification',
  DOCUMENT_CHECK: 'verification',
  PICKING: 'ready',
  READY_TO_DELIVER: 'ready',
  DELIVERED: 'complete',
};

export type HandoffId =
  | 'salesToPurchasing'
  | 'purchasingToWarehouse'
  | 'warehouseToPurchasing'
  | 'balanceToWarehouse'
  | 'warehouseToAccounting'
  | 'accountingToWarehouse'
  | 'warehouseToSales';

export interface Handoff {
  id: HandoffId;
  from: Operator;
  to: Operator;
}

/** The actions that pass the work item to another department. */
export const HANDOFF: Partial<Record<ActionId, Handoff>> = {
  requestPurchase: { id: 'salesToPurchasing', from: 'sales', to: 'purchasing' },
  openPo: { id: 'purchasingToWarehouse', from: 'purchasing', to: 'warehouse' },
  receiveGoods: { id: 'warehouseToPurchasing', from: 'warehouse', to: 'purchasing' },
  confirmBalance: { id: 'balanceToWarehouse', from: 'purchasing', to: 'warehouse' },
  closeReceiving: { id: 'warehouseToAccounting', from: 'warehouse', to: 'accounting' },
  recordApproval: { id: 'accountingToWarehouse', from: 'accounting', to: 'warehouse' },
  pickFefo: { id: 'warehouseToSales', from: 'warehouse', to: 'sales' },
};

export type ExceptionState = 'none' | 'open' | 'resolved';

export interface TraceEvent {
  seq: number;
  role: Operator;
  action: ActionId;
  before: DemoStatus;
  after: DemoStatus;
  /** Set when CORE refused the action (the work item did not move). */
  prevented?: 'lotRequired';
  handoff?: Handoff;
  /** The outstanding exception opened or cleared at this event. */
  exception?: 'opened' | 'resolved';
}

export interface DemoState {
  status: DemoStatus;
  /** Units received against the PO so far. */
  received: number;
  lot: LotChoice | null;
  exception: ExceptionState;
  trace: TraceEvent[];
}

export const INITIAL: DemoState = {
  status: 'ORDER_RECEIVED',
  received: 0,
  lot: null,
  exception: 'none',
  trace: [],
};

export type TransitionResult =
  | { ok: true; state: DemoState; event: TraceEvent }
  | {
      ok: false;
      state: DemoState;
      reason: 'notAvailable' | 'wrongRole' | 'lotRequired' | 'unknownLot';
      event?: TraceEvent;
    };

/**
 * The only way the work item changes. `role` is the workspace the visitor
 * is acting from; an action outside its owner's workspace is refused.
 */
export function transition(s: DemoState, action: Action, role: Role): TransitionResult {
  if (!AVAILABLE[s.status].includes(action.id))
    return { ok: false, state: s, reason: 'notAvailable' };
  const actor = ACTION_ROLE[action.id];
  if (role !== actor) return { ok: false, state: s, reason: 'wrongRole' };
  const seq = s.trace.length + 1;

  if (action.id === 'recordLot') {
    if (
      !SCENARIO.lotOptions.some((l) => l.code === action.lot.code && l.expiry === action.lot.expiry)
    ) {
      return { ok: false, state: s, reason: 'unknownLot' };
    }
    const event: TraceEvent = {
      seq,
      role: actor,
      action: 'recordLot',
      before: s.status,
      after: s.status,
    };
    return { ok: true, state: { ...s, lot: action.lot, trace: [...s.trace, event] }, event };
  }

  // PREVENT: a receipt cannot be closed without lot and expiry.
  if (action.id === 'closeReceiving' && !s.lot) {
    const event: TraceEvent = {
      seq,
      role: actor,
      action: 'closeReceiving',
      before: s.status,
      after: s.status,
      prevented: 'lotRequired',
    };
    return { ok: false, state: { ...s, trace: [...s.trace, event] }, reason: 'lotRequired', event };
  }

  const after = NEXT[action.id];
  const next: DemoState = { ...s, status: after };
  const event: TraceEvent = { seq, role: actor, action: action.id, before: s.status, after };
  const handoff = HANDOFF[action.id];
  if (handoff) event.handoff = handoff;

  if (action.id === 'receiveGoods') {
    // DETECT: 80 of 100 arrive — 20 outstanding opens one exception.
    next.received = SCENARIO.firstReceipt;
    next.exception = 'open';
    event.exception = 'opened';
  }
  if (action.id === 'receiveBalance') {
    // The outstanding 20 arrive: the exception clears, quietly.
    next.received = SCENARIO.firstReceipt + OUTSTANDING;
    next.exception = 'resolved';
    event.exception = 'resolved';
  }
  next.trace = [...s.trace, event];
  return { ok: true, state: next, event };
}

export const isTerminal = (s: DemoStatus) => TERMINAL.includes(s);
export const outstanding = (s: DemoState) =>
  s.received === 0 ? SCENARIO.po.qty : SCENARIO.po.qty - s.received;

/** Summary numbers for the completion view — counted from the trace, never claimed. */
export function summarize(s: DemoState) {
  const moves = s.trace.filter((e) => !e.prevented);
  return {
    handoffs: moves.filter((e) => e.handoff).length,
    departments: new Set(moves.map((e) => e.role)).size,
    exceptions: moves.filter((e) => e.exception === 'opened').length,
    prevented: s.trace.filter((e) => e.prevented).length,
    events: s.trace.length,
  };
}

/** The demo's reducer: a role selection plus the machine. */
export interface DemoSession {
  started: boolean;
  role: Role;
  guided: boolean;
  state: DemoState;
  /** The last result, for the handoff card, the PREVENT message and live announcements. */
  last: TransitionResult | null;
  /** The visitor has a handoff card to see (cleared when they act again or dismiss it). */
  showHandoff: boolean;
}

export type SessionAction =
  | { kind: 'start'; role: Role }
  | { kind: 'role'; role: Role }
  | { kind: 'guided'; value: boolean }
  | { kind: 'act'; action: Action }
  | { kind: 'dismissHandoff' }
  | { kind: 'reset' }
  | { kind: 'exit' };

export const initialSession = (role: Role = 'sales'): DemoSession => ({
  started: false,
  role,
  guided: true,
  state: INITIAL,
  last: null,
  showHandoff: false,
});

export function sessionReducer(s: DemoSession, a: SessionAction): DemoSession {
  switch (a.kind) {
    case 'start':
      return { ...s, started: true, role: a.role };
    case 'role':
      // Switching role never touches the work item.
      return { ...s, role: a.role };
    case 'guided':
      return { ...s, guided: a.value };
    case 'act': {
      const r = transition(s.state, a.action, s.role);
      const handoff = r.ok ? r.event.handoff : undefined;
      return {
        ...s,
        state: r.state,
        last: r,
        showHandoff: !!handoff,
        // Guided mode follows the work to its next owner.
        role: handoff && s.guided ? handoff.to : s.role,
      };
    }
    case 'dismissHandoff':
      return { ...s, showHandoff: false };
    case 'reset':
      return { ...initialSession(s.role), started: true, guided: s.guided };
    case 'exit':
      // Back to the role selection; the sample work item starts over.
      return { ...initialSession(s.role), guided: s.guided };
  }
}
