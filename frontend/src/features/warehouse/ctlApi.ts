import { apiRequest } from '@/lib/api';
import type { Page, Ref, Tracking } from './whApi';

/*
 * Typed client for EP32 inventory control (/api/v1/warehouse/transfers,
 * /adjustments, /counts). Contracts: docs/INVENTORY_TRANSFER.md,
 * docs/STOCK_ADJUSTMENT.md, docs/CYCLE_COUNT.md. Quantities are exact decimal
 * STRINGS; numbers, statuses, balances, snapshots and variances are the
 * server's. Operational only — there is no price, cost or value to type.
 */

export type DocKind = 'transfers' | 'adjustments' | 'counts';
export type TrStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type AdjStatus = 'DRAFT' | 'SUBMITTED' | 'POSTED' | 'REJECTED' | 'CANCELLED';
export type CountStatus = 'DRAFT' | 'COUNTING' | 'REVIEW' | 'POSTED' | 'CANCELLED';
export type DocStatus = TrStatus | AdjStatus | CountStatus;
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
  | 'reopen';
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

export type DocOf<K extends DocKind> = K extends 'transfers'
  ? Transfer
  : K extends 'adjustments'
    ? Adjustment
    : Count;
/** The list row is a subset of the document (no lines, actions or history). */
export type RowOf<K extends DocKind> = Omit<DocOf<K>, 'lines' | 'actions'>;
export interface Timeline {
  timeline: { type: string; at: string; actor: Person }[];
}
const KEY = { transfers: 'transfer', adjustments: 'adjustment', counts: 'count' } as const;
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
  /** A workflow step: post, cancel, submit, approve, reject, start, review, reopen. */
  act: <K extends DocKind>(kind: K, id: string, action: string, reason?: string) =>
    apiRequest<Detail<K>>(
      'POST',
      `${at(kind, id)}/${action}`,
      action === 'cancel' || action === 'reject' ? (reason ? { reason } : {}) : undefined,
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
