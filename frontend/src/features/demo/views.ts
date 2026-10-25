import {
  OWNER,
  STAGE_OF,
  STATES,
  type DemoState,
  type DemoStatus,
  type Operator,
  type Role,
  type Stage,
} from './machine';
import { OUTSTANDING, SCENARIO, SHORTAGE } from './scenario';

/*
 * Role view-models (EP14). Each role gets a different object derived from
 * the same DemoState — the code-level version of "same work, different
 * responsibility". Components render these objects and nothing else, so
 * what a role cannot see is simply not in its data.
 *
 * WAREHOUSE PRIVACY: WarehouseView has no commercial field at all — no
 * price, cost, margin, amount or currency. Tests scan the object itself.
 */

const at = (s: DemoStatus) => STATES.indexOf(s);
const reached = (s: DemoState, target: DemoStatus) => at(s.status) >= at(target);

/* ------------------------------------------------------------------ */

export type Fulfilment =
  | 'notChecked'
  | 'waitingStock'
  | 'waitingPartial'
  | 'waitingRelease'
  | 'preparing'
  | 'ready'
  | 'delivered';

export interface SalesView {
  kind: 'sales';
  order: {
    id: string;
    customerPo: string;
    qty: number;
    value: number;
    currency: string;
    requestedBy: string;
  };
  /** Units the order can draw on right now (null before the stock check). */
  available: number | null;
  shortage: number;
  fulfilment: Fulfilment;
  delivery: string | null;
}

export function salesView(s: DemoState): SalesView {
  const o = SCENARIO.order;
  const stockIn = reached(s, 'RECEIVED');
  const fulfilment: Fulfilment =
    s.status === 'ORDER_RECEIVED'
      ? 'notChecked'
      : s.status === 'DELIVERED'
        ? 'delivered'
        : s.status === 'READY_TO_DELIVER'
          ? 'ready'
          : s.status === 'PICKING'
            ? 'preparing'
            : stockIn
              ? 'waitingRelease'
              : s.exception === 'open'
                ? 'waitingPartial'
                : 'waitingStock';
  return {
    kind: 'sales',
    order: {
      id: o.id,
      customerPo: o.customerPo,
      qty: o.qty,
      value: o.value,
      currency: o.currency,
      requestedBy: o.requestedBy,
    },
    available: s.status === 'ORDER_RECEIVED' ? null : stockIn ? o.qty : SCENARIO.onHand.qty,
    shortage: s.status === 'ORDER_RECEIVED' || stockIn ? 0 : SHORTAGE,
    fulfilment,
    delivery: reached(s, 'READY_TO_DELIVER') ? SCENARIO.delivery.id : null,
  };
}

/* ------------------------------------------------------------------ */

export type WarehouseTask =
  | 'none'
  | 'receive'
  | 'awaitBalance'
  | 'receiveBalance'
  | 'closeReceipt'
  | 'awaitRelease'
  | 'pick'
  | 'done';

export interface WarehouseLot {
  code: string;
  expiry: string;
  qty: number;
  /** 1 = pick first (FEFO: first expiry, first out). */
  fefo: number | null;
}

/** Operational data only — quantities, places, lots, dates, states. */
export interface WarehouseView {
  kind: 'warehouse';
  orderId: string;
  sku: string;
  location: string;
  unit: string;
  task: WarehouseTask;
  receipt: {
    po: string;
    expected: string;
    ordered: number;
    received: number;
    outstanding: number;
    lotRecorded: boolean;
    receiptId: string | null;
  } | null;
  lots: WarehouseLot[];
  pick: { needed: number; plan: { code: string; qty: number }[]; delivery: string } | null;
}

export function warehouseView(s: DemoState): WarehouseView {
  const task: WarehouseTask = (
    {
      ORDER_RECEIVED: 'none',
      STOCK_SHORTAGE: 'none',
      PURCHASE_REQUIRED: 'none',
      PO_OPEN: 'receive',
      PARTIAL_RECEIPT: 'awaitBalance',
      BALANCE_INBOUND: 'receiveBalance',
      RECEIVING_OPEN: 'closeReceipt',
      RECEIVED: 'awaitRelease',
      DOCUMENT_CHECK: 'awaitRelease',
      PICKING: 'pick',
      READY_TO_DELIVER: 'done',
      DELIVERED: 'done',
    } as const
  )[s.status];
  const closed = reached(s, 'RECEIVED');
  const lots: WarehouseLot[] = [
    {
      code: SCENARIO.onHand.lot,
      expiry: SCENARIO.onHand.expiry,
      qty: SCENARIO.onHand.qty,
      fefo: null,
    },
  ];
  if (closed && s.lot)
    lots.push({ code: s.lot.code, expiry: s.lot.expiry, qty: SCENARIO.po.qty, fefo: null });
  if (lots.length > 1) {
    [...lots].sort((a, b) => a.expiry.localeCompare(b.expiry)).forEach((l, i) => (l.fefo = i + 1));
  }
  return {
    kind: 'warehouse',
    orderId: SCENARIO.order.id,
    sku: SCENARIO.item.sku,
    location: SCENARIO.item.location,
    unit: SCENARIO.item.unit,
    task,
    receipt: reached(s, 'PO_OPEN')
      ? {
          po: SCENARIO.po.id,
          expected: reached(s, 'PARTIAL_RECEIPT')
            ? SCENARIO.po.balanceExpected
            : SCENARIO.po.expected,
          ordered: SCENARIO.po.qty,
          received: s.received,
          outstanding: SCENARIO.po.qty - s.received,
          lotRecorded: !!s.lot,
          receiptId: closed ? SCENARIO.receipt.id : null,
        }
      : null,
    lots,
    pick: reached(s, 'PICKING')
      ? {
          needed: SCENARIO.order.qty,
          plan: [...lots]
            .sort((a, b) => (a.fefo ?? 9) - (b.fefo ?? 9))
            .map((l) => ({ code: l.code, qty: l.qty })),
          delivery: SCENARIO.delivery.id,
        }
      : null,
  };
}

/* ------------------------------------------------------------------ */

export type PoStatus = 'none' | 'open' | 'partial' | 'balanceConfirmed' | 'complete';

export interface PurchasingView {
  kind: 'purchasing';
  orderId: string;
  /** Units to replenish (0 until Sales asks). */
  requirement: number;
  po: {
    id: string;
    qty: number;
    value: number;
    currency: string;
    expected: string;
    received: number;
    outstanding: number;
    status: PoStatus;
  } | null;
}

export function purchasingView(s: DemoState): PurchasingView {
  const status: PoStatus = !reached(s, 'PO_OPEN')
    ? 'none'
    : s.status === 'PO_OPEN'
      ? 'open'
      : s.status === 'PARTIAL_RECEIPT'
        ? 'partial'
        : s.status === 'BALANCE_INBOUND'
          ? 'balanceConfirmed'
          : 'complete';
  return {
    kind: 'purchasing',
    orderId: SCENARIO.order.id,
    requirement: reached(s, 'PURCHASE_REQUIRED') ? SHORTAGE : 0,
    po:
      status === 'none'
        ? null
        : {
            id: SCENARIO.po.id,
            qty: SCENARIO.po.qty,
            value: SCENARIO.po.value,
            currency: SCENARIO.po.currency,
            expected: status === 'open' ? SCENARIO.po.expected : SCENARIO.po.balanceExpected,
            received: s.received,
            outstanding: SCENARIO.po.qty - s.received,
            status,
          },
  };
}

/* ------------------------------------------------------------------ */

export type DocId = 'po' | 'receipt' | 'invoice' | 'approval';
export type DocState = 'missing' | 'waiting' | 'ready';

/** Operational finance only: document completeness and payment readiness. */
export interface AccountingView {
  kind: 'accounting';
  orderId: string;
  documents: { id: DocId; ref: string | null; state: DocState }[];
  readiness: 'notStarted' | 'waiting' | 'ready';
  invoice: { id: string; amount: number; currency: string } | null;
}

export function accountingView(s: DemoState): AccountingView {
  const invoiceIn = reached(s, 'BALANCE_INBOUND');
  return {
    kind: 'accounting',
    orderId: SCENARIO.order.id,
    documents: [
      {
        id: 'po',
        ref: reached(s, 'PO_OPEN') ? SCENARIO.po.id : null,
        state: reached(s, 'PO_OPEN') ? 'ready' : 'missing',
      },
      {
        id: 'receipt',
        ref: reached(s, 'RECEIVED') ? SCENARIO.receipt.id : null,
        state: reached(s, 'RECEIVED') ? 'ready' : 'missing',
      },
      {
        id: 'invoice',
        ref: invoiceIn ? SCENARIO.invoice.id : null,
        state: invoiceIn ? 'ready' : 'missing',
      },
      {
        id: 'approval',
        ref: null,
        state: reached(s, 'PICKING')
          ? 'ready'
          : s.status === 'DOCUMENT_CHECK'
            ? 'waiting'
            : 'missing',
      },
    ],
    readiness: reached(s, 'PICKING') ? 'ready' : reached(s, 'RECEIVED') ? 'waiting' : 'notStarted',
    invoice: invoiceIn
      ? {
          id: SCENARIO.invoice.id,
          amount: SCENARIO.invoice.amount,
          currency: SCENARIO.invoice.currency,
        }
      : null,
  };
}

/* ------------------------------------------------------------------ */

/** Exceptions and flow — never transactions. */
export interface ExecutiveView {
  kind: 'executive';
  open: number;
  resolved: number;
  exception: {
    orderId: string;
    responsible: Operator;
    currentOwner: Operator;
    outstanding: number;
    impact: 'deliveryAtRisk';
    status: 'open' | 'resolved';
  } | null;
  flow: { stage: Stage; owner: Operator };
}

export function executiveView(s: DemoState): ExecutiveView {
  return {
    kind: 'executive',
    open: s.exception === 'open' ? 1 : 0,
    resolved: s.exception === 'resolved' ? 1 : 0,
    exception:
      s.exception === 'none'
        ? null
        : {
            orderId: SCENARIO.order.id,
            responsible: 'purchasing',
            currentOwner: OWNER[s.status],
            outstanding: s.exception === 'open' ? OUTSTANDING : 0,
            impact: 'deliveryAtRisk',
            status: s.exception,
          },
    flow: { stage: STAGE_OF[s.status], owner: OWNER[s.status] },
  };
}

export type RoleView = SalesView | WarehouseView | PurchasingView | AccountingView | ExecutiveView;

export function viewFor(role: Role, s: DemoState): RoleView {
  switch (role) {
    case 'sales':
      return salesView(s);
    case 'warehouse':
      return warehouseView(s);
    case 'purchasing':
      return purchasingView(s);
    case 'accounting':
      return accountingView(s);
    case 'executive':
      return executiveView(s);
  }
}
