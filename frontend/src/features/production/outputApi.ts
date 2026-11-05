import { apiRequest } from '@/lib/api';
import type { MoDetail, MoStatus } from './productionApi';

/*
 * EP38 API — production output reports, finished goods receipts, completion.
 * Loaded only by the output / finished goods chunks. Every figure is the
 * server's; reporting output never moves stock, only a posted receipt does.
 */

const P = '/api/v1/production';
const FG = '/api/v1/warehouse/finished-goods';
const id = (v: string) => encodeURIComponent(v);
const qs = (q: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
type Person = { name: string } | null;
type Ref = { id: string; code: string; name: string };
type Unit = { code: string; precision: number };
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
export interface TimelineItem {
  type: string;
  at: string;
  actor: Person;
}

export type OutputStatus = 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type ReceiptStatus = 'DRAFT' | 'POSTED' | 'CANCELLED' | 'REVERSED';
export type Tracking = 'NONE' | 'OPTIONAL' | 'REQUIRED';

export interface OutputProgress {
  target: string;
  goodReported: string;
  pendingReview: string;
  accepted: string;
  rejected: string;
  received: string;
  awaitingReceipt: string;
  remaining: string;
}
export interface OrderOutputRow {
  id: string;
  number: string;
  status: OutputStatus;
  productionDate: string;
  good: string;
  defective: string;
  pending: string;
  accepted: string | null;
  rejected: string | null;
  received: string;
}
export interface OrderReceiptRow {
  id: string;
  number: string;
  status: ReceiptStatus;
  outputNumber: string;
  quantity: string;
  postedAt: string | null;
}
export interface Completion {
  reviewRequestedAt: string | null;
  reviewRequestedBy: Person;
  completedAt: string | null;
  completedBy: Person;
  outcome: 'COMPLETED' | 'SHORT_CLOSED' | null;
  reason: string | null;
  blockers: string[];
}
export interface Traceability {
  outputLots: { lotNumber: string; expiryDate: string | null; receipt: string; quantity: string }[];
  materialLots: {
    item: string;
    lotNumber: string | null;
    issue: string;
    quantity: string;
    unit: string;
  }[];
}

export interface OutputRow {
  id: string;
  number: string;
  status: OutputStatus;
  branch: Ref;
  order: { id: string; number: string; status: MoStatus };
  item: Ref;
  unit: Unit;
  productionDate: string;
  good: string;
  defective: string;
  pending: string;
  accepted: string | null;
  rejected: string | null;
  received: string;
  awaitingReceipt: string;
  createdBy: Person;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}
export type OutputAction = 'edit' | 'submit' | 'accept' | 'reject' | 'cancel';
export interface Output extends OutputRow {
  note: string | null;
  submittedBy: Person;
  reviewedBy: Person;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelledBy: Person;
  cancellationReason: string | null;
  receipts: {
    id: string;
    number: string;
    status: ReceiptStatus;
    postedAt: string | null;
    quantity: string;
  }[];
  actions: OutputAction[];
}
export interface OutputDetail {
  report: Output;
  timeline: TimelineItem[];
}
export interface OutputInput {
  productionDate?: string;
  goodQuantity?: string;
  defectiveQuantity?: string;
  pendingQuantity?: string;
  note?: string | null;
}

export interface PendingFg {
  output: { id: string; number: string; productionDate: string | null };
  branch: Ref;
  order: { id: string; number: string };
  item: Ref;
  unit: Unit;
  tracking: { lot: Tracking; expiry: Tracking };
  accepted: string;
  received: string;
  pending: string;
  draftReceipts: number;
}
export interface ReceiptRow {
  id: string;
  number: string;
  status: ReceiptStatus;
  branch: Ref;
  order: { id: string; number: string };
  output: { id: string; number: string };
  item: Ref;
  unit: Unit;
  quantity: string;
  lineCount: number;
  createdBy: Person;
  createdAt: string;
  postedAt: string | null;
  updatedAt: string;
}
export interface ReceiptLineInput {
  locationId: string;
  lotNumber?: string | null;
  expiryDate?: string | null;
  manufacturedDate?: string | null;
  quantity: string;
}
export type ReceiptAction = 'edit' | 'post' | 'cancel' | 'reverse';
export interface Receipt extends Omit<ReceiptRow, 'output'> {
  note: string | null;
  tracking: { lot: Tracking; expiry: Tracking };
  output: {
    id: string;
    number: string;
    status: OutputStatus;
    productionDate: string | null;
    accepted: string;
    received: string;
    pending: string;
  };
  postedBy: Person;
  cancelledAt: string | null;
  cancelledBy: Person;
  cancellationReason: string | null;
  reversedAt: string | null;
  reversedBy: Person;
  reversalReason: string | null;
  lines: {
    id: string;
    lineNo: number;
    location: Ref;
    lotNumber: string | null;
    expiryDate: string | null;
    manufacturedDate: string | null;
    lot: { id: string; lotNumber: string } | null;
    quantity: string;
  }[];
  actions: ReceiptAction[];
}
export interface ReceiptDetail {
  receipt: Receipt;
  timeline: TimelineItem[];
}

export const outputApi = {
  outputs: (q: Record<string, string | number | undefined>) =>
    apiRequest<Page<OutputRow>>('GET', `${P}/outputs${qs(q)}`),
  output: (r: string) => apiRequest<OutputDetail>('GET', `${P}/outputs/${id(r)}`),
  createOutput: (body: OutputInput & { productionOrderId: string }) =>
    apiRequest<OutputDetail>('POST', `${P}/outputs`, body),
  updateOutput: (r: string, body: OutputInput) =>
    apiRequest<OutputDetail>('PATCH', `${P}/outputs/${id(r)}`, body),
  outputAct: (
    r: string,
    action: Exclude<OutputAction, 'edit'>,
    extra: Record<string, string> = {},
  ) => apiRequest<OutputDetail>('POST', `${P}/outputs/${id(r)}/${action}`, extra),
  orderAct: (
    o: string,
    action: 'review' | 'reopen' | 'complete',
    body: Record<string, unknown> = {},
  ) => apiRequest<MoDetail>('POST', `${P}/orders/${id(o)}/${action}`, body),
  pending: (q: { page: number; pageSize: number }) =>
    apiRequest<Page<PendingFg>>('GET', `${FG}${qs(q)}`),
  receipts: (q: Record<string, string | number | undefined>) =>
    apiRequest<Page<ReceiptRow>>('GET', `${FG}/receipts${qs(q)}`),
  receipt: (r: string) => apiRequest<ReceiptDetail>('GET', `${FG}/receipts/${id(r)}`),
  createReceipt: (body: {
    outputReportId: string;
    lines: ReceiptLineInput[];
    note?: string | null;
  }) => apiRequest<ReceiptDetail>('POST', `${FG}/receipts`, body),
  receiptLines: (r: string, lines: ReceiptLineInput[]) =>
    apiRequest<ReceiptDetail>('PUT', `${FG}/receipts/${id(r)}/lines`, { lines }),
  receiptAct: (r: string, action: 'post' | 'cancel' | 'reverse', reason?: string) =>
    apiRequest<ReceiptDetail>(
      'POST',
      `${FG}/receipts/${id(r)}/${action}`,
      action === 'post' ? {} : { reason: reason || (action === 'cancel' ? null : '') },
    ),
};
