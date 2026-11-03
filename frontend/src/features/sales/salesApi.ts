import { apiRequest } from '@/lib/api';

/*
 * Typed client for EP33 sales orders (/api/v1/sales). Contract:
 * docs/SALES_ORDER.md. Money and quantities are exact decimal STRINGS;
 * numbers, statuses, snapshots, line amounts, totals and availability are the
 * server's — the client never sends a total and never computes one that is
 * kept. Availability is informational: it is not a reservation.
 */

export type SoStatus = 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'CANCELLED';
export type SoAction =
  'edit' | 'submit' | 'confirm' | 'cancel' | 'allocate' | 'release' | 'reallocate';
/** EP34 — derived from active reservations (null: nothing to allocate). */
export type AllocationState = 'NOT_ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'FULLY_ALLOCATED';
export type PickReadiness = 'NOT_READY' | 'PARTIALLY_READY' | 'READY';
export type Availability =
  'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'NOT_STOCK_TRACKED';

type Ref = { id: string; code: string; name: string };
type Person = { name: string } | null;
type Unit = { code: string; name: string; precision: number };

export interface SoRow {
  id: string;
  number: string;
  status: SoStatus;
  branch: Ref;
  customer: Ref;
  orderDate: string;
  requestedDate: string | null;
  lineCount: number;
  currency: string;
  grandTotal: string;
  availability: Availability | null;
  allocationState: AllocationState | null;
  pickReadiness: PickReadiness | null;
  createdBy: Person;
  updatedAt: string;
}

export interface SoLine {
  id: string;
  lineNo: number;
  item: Ref & { type: string; inventoryTracked: boolean };
  unit: Unit;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
  lineSubtotal: string;
  lineTax: string;
  lineTotal: string;
  note: string | null;
  availability: {
    state: Availability;
    onHand: string | null;
    reserved: string | null;
    available: string | null;
    shortage: string | null;
  } | null;
  /** EP34, confirmed tracked lines: reserved for this line and what is still short. */
  allocation: { allocated: string; shortage: string } | null;
  /** EP34 fills allocated (tracked lines); EP35 adds picked, delivered and outstanding. */
  progress: {
    ordered: string;
    allocated: string | null;
    picked: null;
    delivered: null;
    outstanding: null;
  };
}

export interface SalesOrder extends SoRow {
  customer: Ref & { taxId: string | null; taxBranch: string | null };
  customerReference: string | null;
  note: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  taxTotalLabel: 'exclusive';
  shortageLines: number;
  createdAt: string;
  submittedAt: string | null;
  submittedBy: Person;
  confirmedAt: string | null;
  confirmedBy: Person;
  cancelledAt: string | null;
  cancelledBy: Person;
  cancellationReason: string | null;
  lines: SoLine[];
  actions: SoAction[];
}

export interface SoDetail {
  order: SalesOrder;
  timeline: { type: string; at: string; actor: Person }[];
}

/** What one allocate / reallocate did (quantities only). */
export interface AllocationResult {
  state: AllocationState | null;
  pickReadiness: PickReadiness | null;
  allocatedNow: string;
  lines: {
    lineNo: number;
    ordered: string;
    allocatedNow: string;
    totalAllocated: string;
    shortage: string;
  }[];
}

export interface SalesContext {
  orders: { view: boolean; create: boolean; confirm: boolean; cancel: boolean };
  branches: (Ref & { type: string })[];
  selectedBranch: (Ref & { type: string }) | null;
  counts: {
    myDrafts: number;
    awaitingConfirmation: number;
    confirmed: number;
    withShortage: number;
  };
  today: string;
}

export interface SoItem {
  id: string;
  code: string;
  name: string;
  type: string;
  inventoryTracked: boolean;
  unit: Unit;
  available: string | null;
}

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SoLineInput {
  itemId: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
  note: string | null;
}

export interface SoHeaderInput {
  customerId?: string;
  orderDate?: string;
  requestedDate?: string | null;
  customerReference?: string | null;
  note?: string | null;
}

export const QTY = /^\d{1,12}(\.\d{1,6})?$/;
export const PRICE = /^\d{1,12}(\.\d{1,4})?$/;
export const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
export const RATE = /^\d{1,3}(\.\d{1,2})?$/;
export const decimals = (v: string) => (v.split('.')[1] ?? '').replace(/0+$/, '').length;

const BASE = '/api/v1/sales';
const at = (id: string) => `${BASE}/orders/${encodeURIComponent(id)}`;
const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const salesApi = {
  context: () => apiRequest<SalesContext>('GET', `${BASE}/context`),
  list: (p: Record<string, string | number | undefined>) =>
    apiRequest<Page<SoRow>>('GET', `${BASE}/orders${query(p)}`),
  get: (id: string) => apiRequest<SoDetail>('GET', at(id)),
  create: (body: SoHeaderInput & { customerId: string; lines?: SoLineInput[] }) =>
    apiRequest<SoDetail>('POST', `${BASE}/orders`, body),
  update: (id: string, body: SoHeaderInput) => apiRequest<SoDetail>('PATCH', at(id), body),
  lines: (id: string, lines: SoLineInput[]) =>
    apiRequest<SoDetail>('PUT', `${at(id)}/lines`, { lines }),
  act: (id: string, action: Exclude<SoAction, 'edit'>, reason?: string) =>
    apiRequest<SoDetail & { allocation?: AllocationResult }>(
      'POST',
      `${at(id)}/${action}`,
      action === 'cancel' ? { reason: reason ?? null } : {},
    ),
  items: (q: string) => apiRequest<{ items: SoItem[] }>('GET', `${BASE}/items${query({ q })}`),
  customers: (q: string) =>
    apiRequest<Page<CustomerOption>>(
      'GET',
      `/api/v1/master-data/customers${query({ q, status: 'ACTIVE', pageSize: 20 })}`,
    ),
};
