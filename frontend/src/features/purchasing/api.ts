import type { DepartmentCode } from '@/features/company/api';
import { apiRequest } from '@/lib/api';

/*
 * Typed client for EP29 purchase requests (/api/v1/purchase-requests/…).
 * Contracts: docs/PURCHASING_REQUEST.md. The client never sends a company,
 * branch, requester, approver, number, status or snapshot: the server owns
 * them. `actions` in a response only decides which buttons are shown.
 */

export type PrStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export const PR_STATUSES: PrStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'];
export type PrAction = 'edit' | 'submit' | 'approve' | 'reject' | 'cancel';
export type PrView = 'all' | 'mine' | 'department' | 'queue';

export interface PrBranch {
  id: string;
  code: string;
  name: string;
  type?: string;
}

export interface PrContext {
  createDepartments: DepartmentCode[];
  decideDepartments: DepartmentCode[];
  purchasingView: boolean;
  cancelApproved: boolean;
  branches: PrBranch[];
  selectedBranch: PrBranch | null;
}

export interface PrLine {
  id: string;
  lineNo: number;
  type: 'ITEM' | 'NON_ITEM';
  item: { id: string; code: string; name: string; active: boolean } | null;
  description: string | null;
  unit: { id: string | null; code: string | null; name: string | null } | null;
  quantity: string;
  note: string | null;
}

type Person = { name: string } | null;

export interface PurchaseRequest {
  id: string;
  number: string;
  status: PrStatus;
  department: DepartmentCode;
  branch: PrBranch;
  requester: { memberId: string; name: string; isMe: boolean };
  requestDate: string;
  needByDate: string | null;
  purpose: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: Person;
  rejectedAt: string | null;
  rejectedBy: Person;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelledBy: Person;
  cancellationReason: string | null;
  lines: PrLine[];
  updatedAt: string;
}

export interface PrDetail {
  request: PurchaseRequest;
  actions: PrAction[];
  timeline: { type: string; at: string; actor: Person }[];
}

export interface PrRow {
  id: string;
  number: string;
  status: PrStatus;
  department: DepartmentCode;
  branch: PrBranch;
  requester: { name: string; isMe: boolean };
  requestDate: string;
  needByDate: string | null;
  purpose: string | null;
  lineCount: number;
  updatedAt: string;
}

export interface PrList {
  items: PrRow[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface ItemOption {
  id: string;
  code: string;
  name: string;
  unit: { id: string; code: string; name: string; precision: number };
}
export interface UnitOption {
  id: string;
  code: string;
  name: string;
  precision: number;
}

/** A line as sent: quantities are decimal strings, never numbers. */
export type LineInput =
  | { type: 'ITEM'; itemId: string; quantity: string; note?: string | null }
  | {
      type: 'NON_ITEM';
      description: string;
      quantity: string;
      unitId?: string | null;
      unitText?: string | null;
      note?: string | null;
    };

const BASE = '/api/v1/purchase-requests';
const at = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const prApi = {
  context: () => apiRequest<PrContext>('GET', `${BASE}/context`),
  list: (params: Record<string, string | number | undefined>) =>
    apiRequest<PrList>('GET', `${BASE}${query(params)}`),
  get: (id: string) => apiRequest<PrDetail>('GET', at(id)),
  create: (body: { department: DepartmentCode; purpose?: string; needByDate?: string }) =>
    apiRequest<PrDetail>('POST', BASE, body),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<PrDetail>('PATCH', at(id), body),
  addLine: (id: string, line: LineInput) => apiRequest<PrDetail>('POST', `${at(id)}/lines`, line),
  updateLine: (id: string, lineId: string, line: LineInput) =>
    apiRequest<PrDetail>('PATCH', `${at(id)}/lines/${encodeURIComponent(lineId)}`, line),
  removeLine: (id: string, lineId: string) =>
    apiRequest<PrDetail>('DELETE', `${at(id)}/lines/${encodeURIComponent(lineId)}`),
  act: (id: string, action: Exclude<PrAction, 'edit'>, reason?: string) =>
    apiRequest<PrDetail>(
      'POST',
      `${at(id)}/${action}`,
      action === 'reject' || action === 'cancel' ? { reason: reason ?? '' } : undefined,
    ),
  items: (q: string) =>
    apiRequest<{ items: ItemOption[] }>('GET', `${BASE}/item-options${query({ q })}`),
  units: () => apiRequest<{ units: UnitOption[] }>('GET', `${BASE}/unit-options`),
};
