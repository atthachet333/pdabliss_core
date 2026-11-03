import { apiRequest } from '@/lib/api';

/*
 * Typed client for EP31 Warehouse receiving and inventory (/api/v1/warehouse/…).
 * Contracts: docs/WAREHOUSE_RECEIVING.md, docs/INVENTORY_LEDGER.md. Every
 * response is operational only — there is no price, cost or value to type.
 * Quantities and dates are STRINGS both ways (exact decimals, calendar days);
 * numbers, statuses, items, lots' ids, movements and balances are the server's.
 */

export type GrStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type GrAction = 'edit' | 'post' | 'cancel';
export type Tracking = 'NONE' | 'OPTIONAL' | 'REQUIRED';
export type RejectReason =
  'DAMAGED' | 'WRONG_ITEM' | 'EXPIRED' | 'QUALITY' | 'QUANTITY_DISCREPANCY' | 'OTHER';
export const REJECT_REASONS: RejectReason[] = [
  'DAMAGED',
  'WRONG_ITEM',
  'EXPIRED',
  'QUALITY',
  'QUANTITY_DISCREPANCY',
  'OTHER',
];
export type ExpiryState = 'EXPIRED' | 'EXPIRING_SOON' | 'OK' | 'NO_EXPIRY';
export const MOVEMENT_TYPES = [
  'PURCHASE_RECEIPT',
  'PURCHASE_RECEIPT_REVERSAL',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT_REVERSAL',
  'TRANSFER_IN_REVERSAL',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'ADJUSTMENT_IN_REVERSAL',
  'ADJUSTMENT_OUT_REVERSAL',
  'COUNT_CORRECTION',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

type Person = { name: string } | null;
type DocRef = { id: string; number: string };
export interface Ref {
  id: string;
  code: string;
  name: string;
}

export interface WarehouseContext {
  receiving: { view: boolean; process: boolean; cancel: boolean };
  inventory: { view: boolean };
  /** EP32 inventory control (presentation only; the server decides). */
  transfers: { create: boolean; approve: boolean; cancel: boolean };
  adjustments: { create: boolean; approve: boolean };
  cycleCounts: { create: boolean; approve: boolean };
  branches: (Ref & { type: string })[];
  selectedBranch: (Ref & { type: string }) | null;
  locations: (Ref & { branchId: string; isDefault: boolean })[];
  counts: {
    pendingReceive: number | null;
    draftReceipts: number | null;
    stockRows: number | null;
    expiring: number | null;
    expired: number | null;
    draftTransfers: number | null;
    submittedAdjustments: number | null;
    activeCounts: number | null;
    /** EP34: confirmed sales orders with stock reserved in the branch. */
    pendingPick: number | null;
  };
  expiringSoonDays: number;
  today: string;
}

export interface Allocation {
  id: string;
  location: Ref;
  lotNumber: string | null;
  lotId: string | null;
  expiryDate: string | null;
  manufacturedDate: string | null;
  quantity: string;
}

export interface ReceiptLine {
  id: string;
  lineNo: number;
  orderLine: { id: string; lineNo: number };
  item: Ref & { lotTracking: Tracking; expiryTracking: Tracking };
  unit: { code: string; name: string | null; precision: number };
  ordered: string;
  receivedElsewhere: string;
  remaining: string;
  acceptedQuantity: string;
  rejectedQuantity: string;
  rejectReason: RejectReason | null;
  rejectNote: string | null;
  replacementRequired: boolean;
  note: string | null;
  allocations: Allocation[];
}

export interface ReceiptRow {
  id: string;
  number: string;
  status: GrStatus;
  branch: Ref;
  order: { id: string; number: string };
  supplier: { code: string | null; name: string | null };
  receivedAt: string;
  createdBy: Person;
  postedAt: string | null;
  lineCount: number;
  updatedAt: string;
}

export interface Receipt extends ReceiptRow {
  defaultLocation: Ref | null;
  note: string | null;
  createdAt: string;
  postedBy: Person;
  cancelledAt: string | null;
  cancelledBy: Person;
  cancellationReason: string | null;
  lines: ReceiptLine[];
  actions: GrAction[];
}

export interface ReceiptDetail {
  receipt: Receipt;
  timeline: { type: string; at: string; actor: Person }[];
}

export interface StockRow {
  id: string;
  branch: Ref;
  location: Ref;
  item: Ref & { lotTracking: Tracking; expiryTracking: Tracking };
  unit: { code: string };
  lot: {
    id: string;
    lotNumber: string;
    expiryDate: string | null;
    manufacturedDate: string | null;
  } | null;
  quantityOnHand: string;
  /** EP34: claimed by active sales reservations; available = on hand − reserved. */
  quantityReserved: string;
  quantityAvailable: string;
  expiryState: ExpiryState;
  daysToExpiry: number | null;
  firstReceivedAt: string;
  updatedAt: string;
}

/** EP34 Pending Pick — warehouse-safe sales demand (no customer, no money). */
export interface PickOrder {
  id: string;
  number: string;
  branch: Ref;
  orderDate: string;
  requestedDate: string | null;
  confirmedAt: string | null;
  readiness: 'NOT_READY' | 'PARTIALLY_READY' | 'READY';
  lines: {
    lineNo: number;
    item: Ref;
    unit: { code: string };
    ordered: string;
    allocated: string;
    shortage: string;
    picks: {
      location: Ref;
      lot: { lotNumber: string; expiryDate: string | null } | null;
      expiryState: ExpiryState;
      quantity: string;
    }[];
  }[];
}

export interface MovementRow {
  id: string;
  occurredAt: string;
  type: MovementType;
  quantityDelta: string;
  branch: Ref;
  location: Ref;
  item: Ref;
  unit: { code: string };
  lot: { id: string; lotNumber: string; expiryDate: string | null } | null;
  source: {
    type: string;
    receipt: { id: string; number: string } | null;
    order: { number: string } | null;
    transfer: DocRef | null;
    adjustment: DocRef | null;
    count: DocRef | null;
  };
  actor: Person;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface LineInput {
  acceptedQuantity: string;
  rejectedQuantity?: string;
  rejectReason?: RejectReason | null;
  rejectNote?: string | null;
  replacementRequired?: boolean;
  note?: string | null;
  allocations: {
    locationId: string;
    lotNumber?: string | null;
    expiryDate?: string | null;
    quantity: string;
  }[];
}

/** Client-side shape checks only (the server validates again). */
export const QTY = /^\d{1,12}(\.\d{1,6})?$/;
export const decimals = (v: string) => (v.split('.')[1] ?? '').replace(/0+$/, '').length;
/** Exact comparison / sum of decimal strings (6 places) without floating point. */
export const scaled = (v: string) => {
  const [i = '0', f = ''] = v.trim().split('.');
  return BigInt(i + f.padEnd(6, '0').slice(0, 6));
};
/** Back from 6-place scaled to the shortest exact decimal string. */
export const unscaled = (n: bigint) => {
  const s = n.toString().padStart(7, '0');
  const f = s.slice(-6).replace(/0+$/, '');
  return `${s.slice(0, -6)}${f ? `.${f}` : ''}`;
};

const BASE = '/api/v1/warehouse';
const at = (id: string) => `${BASE}/receipts/${encodeURIComponent(id)}`;
type Params = Record<string, string | number | undefined>;
const query = (params: Params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const whApi = {
  context: () => apiRequest<WarehouseContext>('GET', `${BASE}/context`),
  receipts: (params: Params) =>
    apiRequest<Page<ReceiptRow> & { counts: Partial<Record<GrStatus, number>> }>(
      'GET',
      `${BASE}/receipts${query(params)}`,
    ),
  receipt: (id: string) => apiRequest<ReceiptDetail>('GET', at(id)),
  create: (purchaseOrderId: string) =>
    apiRequest<ReceiptDetail>('POST', `${BASE}/receipts`, { purchaseOrderId }),
  update: (
    id: string,
    body: { receivedAt?: string; defaultLocationId?: string | null; note?: string | null },
  ) => apiRequest<ReceiptDetail>('PATCH', at(id), body),
  saveLine: (id: string, lineId: string, body: LineInput) =>
    apiRequest<ReceiptDetail>('PUT', `${at(id)}/lines/${encodeURIComponent(lineId)}`, body),
  post: (id: string) => apiRequest<ReceiptDetail>('POST', `${at(id)}/post`),
  cancel: (id: string, reason?: string) =>
    apiRequest<ReceiptDetail>('POST', `${at(id)}/cancel`, reason ? { reason } : {}),
  stock: (params: Params) =>
    apiRequest<Page<StockRow> & { today: string; expiringSoonDays: number }>(
      'GET',
      `${BASE}/stock${query(params)}`,
    ),
  movements: (params: Params) =>
    apiRequest<Page<MovementRow>>('GET', `${BASE}/movements${query(params)}`),
  pendingPick: (params: Params) =>
    apiRequest<Page<PickOrder> & { today: string }>('GET', `${BASE}/pending-pick${query(params)}`),
};
