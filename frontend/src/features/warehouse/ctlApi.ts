import { apiRequest } from '@/lib/api';
import type { Page, Ref, Tracking } from './whApi';

/*
 * Typed client for EP32 inventory control (/api/v1/warehouse/transfers,
 * /adjustments, /counts). Contracts: docs/INVENTORY_TRANSFER.md,
 * docs/STOCK_ADJUSTMENT.md, docs/CYCLE_COUNT.md. Quantities are exact decimal
 * STRINGS; numbers, statuses, balances, snapshots and variances are the
 * server's. Operational only — there is no price, cost or value to type.
 */

export type DocKind = 'transfers' | 'adjustments' | 'counts' | 'picks' | 'packs' | 'shipments';
export type TrStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type AdjStatus = 'DRAFT' | 'SUBMITTED' | 'POSTED' | 'REJECTED' | 'CANCELLED';
export type CountStatus = 'DRAFT' | 'COUNTING' | 'REVIEW' | 'POSTED' | 'CANCELLED';
/** EP35 sales fulfilment (docs/SALES_FULFILLMENT.md). */
export type PickStatus = 'DRAFT' | 'IN_PROGRESS' | 'PICKED' | 'CANCELLED';
export type PackStatus = 'DRAFT' | 'PACKED' | 'DISPATCHED' | 'CANCELLED';
export type ShipmentStatus =
  'READY' | 'DISPATCHED' | 'DELIVERED' | 'DELIVERY_EXCEPTION' | 'CANCELLED';
export type DocStatus =
  TrStatus | AdjStatus | CountStatus | PickStatus | PackStatus | ShipmentStatus;
export type DocAction =
  | 'edit'
  | 'post'
  | 'cancel'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'start'
  | 'count'
  | 'review'
  | 'reopen'
  | 'confirm'
  | 'pack'
  | 'ship'
  | 'dispatch'
  | 'deliver'
  | 'exception';
export const DISCREPANCIES = ['SHORT_PICKED', 'DAMAGED', 'MISSING', 'WRONG_ITEM', 'OTHER'] as const;
export type Discrepancy = (typeof DISCREPANCIES)[number];
export const DELIVERY_EXCEPTIONS = [
  'FAILED_ATTEMPT',
  'RECIPIENT_UNAVAILABLE',
  'ADDRESS_ISSUE',
  'DAMAGED_IN_TRANSIT',
  'LOST_IN_TRANSIT',
  'OTHER',
] as const;
export type DeliveryException = (typeof DELIVERY_EXCEPTIONS)[number] | 'PARTIAL_DELIVERY';
export const ADJ_REASONS = [
  'DAMAGE',
  'LOSS',
  'SHRINKAGE',
  'FOUND',
  'EXPIRED',
  'COUNT_CORRECTION',
  'DATA_CORRECTION',
  'OTHER',
] as const;
export type AdjReason = (typeof ADJ_REASONS)[number];
/** Reasons that only take stock away / only add it (the server enforces the same). */
export const DECREASE_ONLY: AdjReason[] = ['DAMAGE', 'LOSS', 'SHRINKAGE', 'EXPIRED'];
export const INCREASE_ONLY: AdjReason[] = ['FOUND'];

type Person = { name: string } | null;
type Lot = { id: string; lotNumber: string; expiryDate: string | null } | null;
type NewLot = { lotNumber: string; expiryDate: string | null } | null;
export type DocItem = Ref & { lotTracking: Tracking; expiryTracking: Tracking };
type Unit = { code: string; precision: number };

interface Common {
  id: string;
  number: string;
  branch: Ref;
  lineCount: number;
  createdBy: Person;
  updatedAt: string;
  note: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: Person;
  cancellationReason: string | null;
  actions: DocAction[];
}

export interface Transfer extends Common {
  status: TrStatus;
  source: Ref;
  destination: Ref;
  transferDate: string;
  postedAt: string | null;
  postedBy: Person;
  lines: {
    id: string;
    lineNo: number;
    item: DocItem;
    unit: Unit;
    lot: Lot;
    quantity: string;
    available: string;
    note: string | null;
  }[];
}

export interface Adjustment extends Common {
  status: AdjStatus;
  reason: AdjReason;
  adjustmentDate: string;
  locations: string[];
  approvedBy: Person;
  submittedAt: string | null;
  submittedBy: Person;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectedBy: Person;
  rejectionReason: string | null;
  lines: {
    id: string;
    lineNo: number;
    direction: 'INCREASE' | 'DECREASE';
    location: Ref;
    item: DocItem;
    unit: Unit;
    lot: Lot;
    newLot: NewLot;
    quantity: string;
    onHand: string;
    note: string | null;
  }[];
}

export interface Count extends Common {
  status: CountStatus;
  locations: Ref[];
  item: Ref | null;
  countDate: string;
  countedLines: number;
  varianceLines: number;
  startedAt: string | null;
  startedBy: Person;
  reviewAt: string | null;
  postedAt: string | null;
  postedBy: Person;
  lines: {
    id: string;
    lineNo: number;
    location: Ref;
    item: DocItem;
    unit: Unit;
    lot: Lot;
    newLot: NewLot;
    expected: boolean;
    systemQuantity: string;
    countedQuantity: string | null;
    variance: string | null;
    countedBy: Person;
    countedAt: string | null;
    note: string | null;
  }[];
}

/** The common shape of an EP35 fulfilment document (no money anywhere). */
interface Fulfilment {
  id: string;
  number: string;
  branch: Ref;
  order: { id: string; number: string; status: string; requestedDate: string | null };
  lineCount: number;
  createdBy: Person;
  createdAt: string;
  updatedAt: string;
  note: string | null;
  cancelledAt: string | null;
  cancelledBy: Person;
  cancellationReason: string | null;
  actions: DocAction[];
}
type Stocked = { item: Ref; unit: Unit; location: Ref; lot: Lot };

export interface Pick extends Fulfilment {
  status: PickStatus;
  startedAt: string | null;
  startedBy: Person;
  pickedAt: string | null;
  pickedBy: Person;
  lines: (Stocked & {
    id: string;
    lineNo: number;
    orderLineNo: number;
    expiryState: 'EXPIRED' | 'EXPIRING_SOON' | 'OK' | 'NO_EXPIRY';
    planned: string;
    picked: string | null;
    toPack: string;
    packed: string;
    dispatched: string;
    discrepancy: Discrepancy | null;
    discrepancyNote: string | null;
  })[];
}

export interface Pack extends Fulfilment {
  status: PackStatus;
  packageCount: number;
  packageReference: string | null;
  shipment: DocRef | null;
  packedAt: string | null;
  packedBy: Person;
  dispatchedAt: string | null;
  lines: (Stocked & { id: string; lineNo: number; pick: DocRef; quantity: string })[];
}

export interface Shipment extends Fulfilment {
  status: ShipmentStatus;
  shipToName: string;
  shipToAddress: string | null;
  carrier: string | null;
  trackingReference: string | null;
  handedOverTo: string | null;
  dispatchedAt: string | null;
  dispatchedBy: Person;
  deliveredAt: string | null;
  reservationOk: boolean | null;
  packs: (DocRef & { packageCount: number })[];
  lines: (Stocked & {
    id: string;
    lineNo: number;
    pack: DocRef;
    quantity: string;
    delivered: string;
    outstanding: string;
  })[];
  events: {
    type: 'DELIVERED' | 'PARTIALLY_DELIVERED' | 'EXCEPTION';
    reason: DeliveryException | null;
    recipientName: string | null;
    reference: string | null;
    note: string | null;
    occurredAt: string;
    recordedBy: Person;
  }[];
}
type DocRef = { id: string; number: string };

export type DocOf<K extends DocKind> = K extends 'transfers'
  ? Transfer
  : K extends 'adjustments'
    ? Adjustment
    : K extends 'counts'
      ? Count
      : K extends 'picks'
        ? Pick
        : K extends 'packs'
          ? Pack
          : Shipment;
/** The list row is a subset of the document (no lines, actions or history). */
export type RowOf<K extends DocKind> = Omit<DocOf<K>, 'lines' | 'actions'>;
export interface Timeline {
  timeline: { type: string; at: string; actor: Person }[];
}
const KEY = {
  transfers: 'transfer',
  adjustments: 'adjustment',
  counts: 'count',
  picks: 'pick',
  packs: 'pack',
  shipments: 'shipment',
} as const;
export type Detail<K extends DocKind> = Timeline & Record<(typeof KEY)[K], DocOf<K>>;
export const docOf = <K extends DocKind>(kind: K, d: Detail<K>) =>
  (d as unknown as Record<string, DocOf<K>>)[KEY[kind]]!;

/** An item a document can name (EP28 master data, safe identity only). */
export interface PickItem extends DocItem {
  baseUnit: { code: string; precision?: number };
}

export interface TransferLineInput {
  itemId: string;
  lotId?: string | null;
  quantity: string;
  note?: string | null;
}
export interface AdjustmentLineInput extends TransferLineInput {
  direction: 'INCREASE' | 'DECREASE';
  locationId: string;
  newLotNumber?: string | null;
  newLotExpiry?: string | null;
}
export interface CountLineInput {
  locationId: string;
  itemId: string;
  lotId?: string | null;
  newLotNumber?: string | null;
  newLotExpiry?: string | null;
  countedQuantity: string;
  note?: string | null;
}

const BASE = '/api/v1/warehouse';
type Params = Record<string, string | number | undefined>;
const query = (params: Params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};
const at = (kind: DocKind, id: string) => `${BASE}/${kind}/${encodeURIComponent(id)}`;

export const ctlApi = {
  list: <K extends DocKind>(kind: K, params: Params) =>
    apiRequest<Page<RowOf<K>>>('GET', `${BASE}/${kind}${query(params)}`),
  get: <K extends DocKind>(kind: K, id: string) => apiRequest<Detail<K>>('GET', at(kind, id)),
  create: <K extends DocKind>(kind: K, body: object) =>
    apiRequest<Detail<K>>('POST', `${BASE}/${kind}`, body),
  update: <K extends DocKind>(kind: K, id: string, body: object) =>
    apiRequest<Detail<K>>('PATCH', at(kind, id), body),
  lines: <K extends 'transfers' | 'adjustments'>(kind: K, id: string, lines: object[]) =>
    apiRequest<Detail<K>>('PUT', `${at(kind, id)}/lines`, { lines }),
  /** A workflow step: post, cancel, submit, approve, reject, start, review, reopen, confirm, dispatch… */
  act: <K extends DocKind>(kind: K, id: string, action: string, reason?: string, body?: object) =>
    apiRequest<Detail<K>>(
      'POST',
      `${at(kind, id)}/${action}`,
      body ?? (action === 'cancel' || action === 'reject' ? (reason ? { reason } : {}) : undefined),
    ),
  entries: (id: string, entries: { lineId: string; countedQuantity: string | null }[]) =>
    apiRequest<Detail<'counts'>>('PUT', `${at('counts', id)}/entries`, { entries }),
  addCountLine: (id: string, body: CountLineInput) =>
    apiRequest<Detail<'counts'>>('POST', `${at('counts', id)}/lines`, body),
  items: (q: string) =>
    apiRequest<{ items: PickItem[] }>(
      'GET',
      `/api/v1/master-data/items${query({ q, inventoryTracked: 'true', status: 'ACTIVE', pageSize: 20 })}`,
    ),
};
