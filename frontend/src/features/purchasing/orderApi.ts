import type { DepartmentCode } from '@/features/company/api';
import { apiRequest } from '@/lib/api';
import type { PrBranch } from './api';

/*
 * Typed client for EP30 purchase orders (/api/v1/purchase-orders/…), the
 * Accounting deposit queue (/api/v1/accounting/deposits) and Warehouse
 * pending receive (/api/v1/warehouse/pending-receive). Contracts:
 * docs/PURCHASE_ORDER.md. Money and quantities are decimal STRINGS both ways;
 * totals, numbers, snapshots and statuses are the server's — the client never
 * sends them. Each audience gets its own response shape (`view`).
 */

export type PoStatus = 'DRAFT' | 'ISSUED' | 'WAITING_DEPOSIT' | 'PENDING_RECEIVE' | 'CANCELLED';
export const PO_STATUSES: PoStatus[] = ['DRAFT', 'WAITING_DEPOSIT', 'PENDING_RECEIVE', 'CANCELLED'];
export type DepositStatus = 'NOT_REQUIRED' | 'PENDING' | 'CONFIRMED' | 'WAIVED';
export type DepositType = 'NONE' | 'AMOUNT' | 'PERCENT';
export type PoAction = 'edit' | 'issue' | 'cancel' | 'confirm_deposit' | 'waive_deposit';

type Person = { name: string } | null;

export interface PoContext {
  orders: { view: boolean; create: boolean; edit: boolean; issue: boolean; cancel: boolean };
  deposits: { view: boolean; confirm: boolean };
  receiving: { view: boolean };
  executive: boolean;
  branches: PrBranch[];
  selectedBranch: PrBranch | null;
}

export interface Totals {
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
}

export interface Deposit {
  type: DepositType;
  value: string | null;
  amount: string | null;
  dueDate: string | null;
  note: string | null;
  status: DepositStatus;
  confirmedAt: string | null;
  confirmedBy: Person;
  reference: string | null;
  waivedAt: string | null;
  waivedBy: Person;
  waiveReason: string | null;
}

export interface OperationalLine {
  id: string;
  lineNo: number;
  type: 'ITEM' | 'NON_ITEM';
  item: { id: string; code: string; name: string } | null;
  description: string | null;
  unit: { code: string | null; name: string | null } | null;
  quantity: string;
  request: { id: string; number: string; lineNo: number };
}

export interface CommercialLine extends OperationalLine {
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
  lineSubtotal: string;
  lineTax: string;
  lineTotal: string;
}

export interface PurchasingLine extends CommercialLine {
  note: string | null;
  request: OperationalLine['request'] & {
    requested: string;
    orderedElsewhere: string;
    remaining: string;
  };
  itemActive: boolean | null;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  status: PoStatus;
  branch: PrBranch;
  supplier: {
    id: string;
    code: string | null;
    name: string | null;
    taxId: string | null;
    taxBranch: string | null;
    address: string | null;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    active: boolean;
  } | null;
  currency: string;
  orderDate: string;
  expectedDate: string | null;
  paymentTerms: string | null;
  note: string | null;
  totals: Totals;
  deposit: Deposit;
  createdBy: Person;
  issuedAt: string | null;
  issuedBy: Person;
  pendingReceiveAt: string | null;
  cancelledAt: string | null;
  cancelledBy: Person;
  cancellationReason: string | null;
  lineCount: number;
  lines: PurchasingLine[];
  requests: { id: string; number: string }[];
  actions: PoAction[];
}

export interface ExecutiveOrder {
  id: string;
  number: string;
  status: PoStatus;
  branch: PrBranch;
  supplier: { code: string | null; name: string | null };
  currency: string;
  orderDate: string;
  expectedDate: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  grandTotal: string;
  deposit: { status: DepositStatus; amount: string | null };
  lineCount: number;
  requests: { id: string; number: string }[];
}

export type Timeline = { type: string; at: string; actor: Person }[];

export type OrderDetail =
  | { view: 'purchasing'; order: PurchaseOrder; timeline: Timeline }
  | { view: 'executive'; order: ExecutiveOrder };

export interface OrderRow {
  id: string;
  number: string;
  status: PoStatus;
  branch: PrBranch;
  supplier: { code: string | null; name: string | null } | null;
  currency: string;
  grandTotal: string;
  deposit: { status: DepositStatus; amount: string | null };
  orderDate: string;
  expectedDate: string | null;
  lineCount: number;
  requests: { id: string; number: string }[];
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface DepositOrder {
  id: string;
  number: string;
  status: PoStatus;
  branch: PrBranch;
  supplier: {
    code: string | null;
    name: string | null;
    taxId: string | null;
    taxBranch: string | null;
  };
  currency: string;
  orderDate: string;
  issuedAt: string | null;
  issuedBy: Person;
  paymentTerms: string | null;
  totals: Totals;
  deposit: Deposit;
  lineCount: number;
}

export interface DepositDetail {
  view: 'accounting';
  order: DepositOrder & {
    lines: CommercialLine[];
    actions: ('confirm_deposit' | 'waive_deposit')[];
  };
}

/** What Warehouse receives: quantities and identities — no money at all. */
export interface ReceiveOrder {
  id: string;
  number: string;
  status: PoStatus;
  branch: PrBranch;
  supplier: { code: string | null; name: string | null };
  orderDate: string;
  expectedDate: string | null;
  issuedAt: string | null;
  pendingReceiveAt: string | null;
  lineCount: number;
}

export interface ReceiveDetail {
  view: 'warehouse';
  order: ReceiveOrder & { lines: OperationalLine[] };
}

export interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

export interface SourceRequestRow {
  id: string;
  number: string;
  department: DepartmentCode;
  branch: PrBranch;
  purpose: string | null;
  needByDate: string | null;
  approvedAt: string | null;
  lineCount: number;
  openLines: number;
}

export interface SourceLine {
  id: string;
  lineNo: number;
  type: 'ITEM' | 'NON_ITEM';
  item: { id: string; code: string; name: string } | null;
  description: string | null;
  unit: { code: string | null; name: string | null } | null;
  precision: number;
  requested: string;
  ordered: string;
  inDraft: string;
  remaining: string;
}

export interface SourceRequest {
  id: string;
  number: string;
  department: DepartmentCode;
  branch: PrBranch;
  purpose: string | null;
  needByDate: string | null;
  lines: SourceLine[];
}

export interface LineFields {
  quantity?: string;
  unitPrice?: string;
  discountAmount?: string;
  taxRate?: string;
  note?: string | null;
}

export type DepositInput =
  | { type: 'NONE' }
  | { type: 'AMOUNT' | 'PERCENT'; value: string; dueDate?: string | null; note?: string | null };

/** Client-side shape checks only (the server validates again). */
export const QTY = /^\d{1,12}(\.\d{1,6})?$/;
export const PRICE = /^\d{1,12}(\.\d{1,4})?$/;
export const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
export const RATE = /^\d{1,3}(\.\d{1,2})?$/;

/** Exact comparison of two decimal strings (6 places), without floating point. */
export const scaled = (v: string) => {
  const [i = '0', f = ''] = v.split('.');
  return BigInt(i + f.padEnd(6, '0').slice(0, 6));
};
export const decimals = (v: string) => (v.split('.')[1] ?? '').replace(/0+$/, '').length;

const BASE = '/api/v1/purchase-orders';
const at = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

type Params = Record<string, string | number | undefined>;

export const poApi = {
  context: () => apiRequest<PoContext>('GET', `${BASE}/context`),
  list: (params: Params) =>
    apiRequest<Page<OrderRow> & { counts: Partial<Record<PoStatus, number>> }>(
      'GET',
      `${BASE}${query(params)}`,
    ),
  get: (id: string) => apiRequest<OrderDetail>('GET', at(id)),
  create: (body: {
    purchaseRequestId: string;
    supplierId?: string | null;
    lines?: ({ purchaseRequestLineId: string; quantity: string } & LineFields)[];
  }) => apiRequest<OrderDetail>('POST', BASE, body),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<OrderDetail>('PATCH', at(id), body),
  addLine: (id: string, body: { purchaseRequestLineId: string; quantity: string } & LineFields) =>
    apiRequest<OrderDetail>('POST', `${at(id)}/lines`, body),
  updateLine: (id: string, lineId: string, body: LineFields) =>
    apiRequest<OrderDetail>('PATCH', `${at(id)}/lines/${encodeURIComponent(lineId)}`, body),
  removeLine: (id: string, lineId: string) =>
    apiRequest<OrderDetail>('DELETE', `${at(id)}/lines/${encodeURIComponent(lineId)}`),
  issue: (id: string) => apiRequest<OrderDetail>('POST', `${at(id)}/issue`),
  cancel: (id: string, reason?: string) =>
    apiRequest<OrderDetail>('POST', `${at(id)}/cancel`, reason ? { reason } : {}),
  suppliers: (q: string) =>
    apiRequest<{ suppliers: SupplierOption[] }>('GET', `${BASE}/supplier-options${query({ q })}`),
  sourceRequests: (q: string) =>
    apiRequest<{ requests: SourceRequestRow[] }>('GET', `${BASE}/source-requests${query({ q })}`),
  sourceRequest: (id: string) =>
    apiRequest<{ request: SourceRequest }>(
      'GET',
      `${BASE}/source-requests/${encodeURIComponent(id)}`,
    ),
};

export const depositApi = {
  list: (params: Params) =>
    apiRequest<Page<DepositOrder>>('GET', `/api/v1/accounting/deposits${query(params)}`),
  get: (id: string) =>
    apiRequest<DepositDetail>('GET', `/api/v1/accounting/deposits/${encodeURIComponent(id)}`),
  confirm: (id: string, reference?: string) =>
    apiRequest<DepositDetail>('POST', `${at(id)}/deposit/confirm`, reference ? { reference } : {}),
  waive: (id: string, reason: string) =>
    apiRequest<DepositDetail>('POST', `${at(id)}/deposit/waive`, { reason }),
};

export const receiveApi = {
  list: (params: Params) =>
    apiRequest<Page<ReceiveOrder>>('GET', `/api/v1/warehouse/pending-receive${query(params)}`),
  get: (id: string) =>
    apiRequest<ReceiveDetail>('GET', `/api/v1/warehouse/pending-receive/${encodeURIComponent(id)}`),
};
