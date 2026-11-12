import { apiRequest } from '@/lib/api';
import type {
  Completion,
  OrderOutputRow,
  OrderReceiptRow,
  OutputProgress,
  Traceability,
} from './outputApi';

/*
 * Typed client for EP36 production planning (/api/v1/production) and the
 * Purchasing shortage handoff. Contract: docs/PRODUCTION_ORDER.md and
 * docs/PRODUCTION_BOM.md. Quantities are exact decimal STRINGS. Requirements,
 * availability, shortages, statuses and snapshots are the server's — the
 * client never sends them. Availability is a snapshot, never a reservation.
 */

export type MoStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'READY'
  | 'IN_PRODUCTION'
  | 'PAUSED'
  | 'COMPLETION_REVIEW'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';
export type MoAction =
  | 'edit'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'release'
  | 'cancel'
  | 'allocate'
  | 'unreserve'
  | 'reallocate'
  | 'excess'
  | 'start'
  | 'pause'
  | 'resume'
  | 'issue'
  | 'usage'
  | 'output'
  | 'review'
  | 'reopen'
  | 'complete';
/** EP37: the order's material commitment, derived by the server. */
export type ReservationState =
  'NOT_RESERVED' | 'PARTIALLY_RESERVED' | 'FULLY_RESERVED' | 'PARTIALLY_ISSUED' | 'ISSUED';
export type IssueStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type BomStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';
export type BomAction = 'edit' | 'activate' | 'retire' | 'revise';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type Source = 'MANUAL' | 'SALES_DEMAND';
export type MaterialState = 'MATERIALS_AVAILABLE' | 'MATERIALS_SHORT' | 'NOT_ASSESSED';
export type Availability = 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE';
export type Warning = 'DEMAND_ALREADY_PLANNED' | 'SOURCE_CANCELLED' | 'BOM_RETIRED';

export type Ref = { id: string; code: string; name: string };
type Person = { name: string } | null;
export type Unit = { code: string; precision: number };
type BomRef = { id: string; code: string; revision: number };
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
export type Timeline = { type: string; at: string; actor: Person }[];

export type ManufacturingMode = 'BOM_REQUIRED' | 'BOM_OPTIONAL';
export type MaterialPlan = 'BOM' | 'MANUAL';

export interface ProductionContext {
  orders: { view: boolean; create: boolean; approve: boolean; cancel: boolean };
  bom: { view: boolean; manage: boolean };
  /** EP46: confidential recipe access, and how the company manufactures. */
  recipes?: { view: boolean };
  manufacturingMode?: ManufacturingMode;
  branches: { id: string; code: string; name: string; type: string }[];
  selectedBranch: { id: string; code: string; name: string; type: string } | null;
  counts: {
    myDrafts: number;
    awaitingApproval: number;
    approved: number;
    ready: number;
    materialsShort: number;
    demandToReview: number;
    sourceCancelled: number;
    inProduction: number;
    paused: number;
    draftIssues: number;
    outputToReview?: number;
    inReview?: number;
  };
  output?: { create: boolean; approve: boolean };
  completion?: { manage: boolean };
  execution: {
    materials: boolean;
    issueCreate: boolean;
    issuePost: boolean;
    usage: boolean;
    manage: boolean;
  };
  today: string;
}

export interface ProductionItem {
  id: string;
  code: string;
  name: string;
  type: string;
  unit: { id: string; code: string; precision: number };
  activeBom: BomRef | null;
}

export interface BomRow {
  id: string;
  code: string;
  revision: number;
  status: BomStatus;
  item: Ref;
  /** EP46: null without recipe access. */
  outputQuantity: string | null;
  unit: Unit;
  lineCount: number | null;
  activatedAt: string | null;
  updatedAt: string;
}
export interface Bom extends BomRow {
  note: string | null;
  lines: {
    lineNo: number;
    item: Ref & { type: string };
    unit: Unit;
    quantity: string;
    note: string | null;
  }[];
  createdBy: Person;
  createdAt: string;
  activatedBy: Person;
  retiredAt: string | null;
  retiredBy: Person;
  retirementReason: string | null;
  revisions: { id: string; revision: number; status: BomStatus; updatedAt: string }[];
  orderCount: number;
  actions: BomAction[];
}
export type BomDetail = { bom: Bom; timeline: Timeline };

/** EP46: recipe fields and (before release, without recipe access) quantities may be null. */
export interface Material {
  id: string;
  lineNo: number;
  item: Ref;
  unit: Unit;
  bomQuantity: string | null;
  required: string | null;
  exact: boolean | null;
  available: string | null;
  shortage: string | null;
  state: Availability | null;
  reserved: string | null;
  issued: string | null;
  used: string | null;
  stillNeeded: string | null;
  excess: string | null;
  usageVariance: string | null;
  unrecorded: string | null;
}

export interface MoRow {
  id: string;
  number: string;
  status: MoStatus;
  source: Source;
  branch: Ref;
  item: Ref;
  unit: Unit;
  quantity: string;
  materialPlan?: MaterialPlan;
  bom: BomRef | null;
  plannedStartDate: string | null;
  requiredDate: string | null;
  priority: Priority;
  materialState: MaterialState;
  reservationState: ReservationState | null;
  salesOrder: {
    id: string;
    number: string;
    status: string;
    requestedDate: string | null;
    lineNo: number;
  } | null;
  attention: 'SOURCE_CANCELLED' | null;
  createdBy: Person;
  updatedAt: string;
}
export interface Mo extends MoRow {
  note: string | null;
  bomOutputQuantity: string | null;
  /** EP46: material quantities withheld (BOM plan, not released, no recipe access). */
  quantitiesHidden?: boolean;
  createdAt: string;
  submittedAt: string | null;
  submittedBy: Person;
  approvedAt: string | null;
  approvedBy: Person;
  releasedAt: string | null;
  releasedBy: Person;
  rejectedAt: string | null;
  rejectedBy: Person;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelledBy: Person;
  cancellationReason: string | null;
  frozen: boolean;
  materials: Material[];
  demand: {
    ordered: string;
    dispatched: string;
    reserved: string;
    open: string;
    plannedElsewhere: string;
    overPlanned: boolean;
  } | null;
  warnings: Warning[];
  actions: MoAction[];
  startedAt: string | null;
  startedBy: Person;
  pausedAt: string | null;
  executionNote: string | null;
  reservations: Reservation[];
  issues: {
    id: string;
    number: string;
    status: IssueStatus;
    postedAt: string | null;
    lineCount: number;
  }[];
  /** EP38 (types only — the calls live in outputApi.ts). */
  output?: OutputProgress | null;
  outputReports?: OrderOutputRow[];
  receipts?: OrderReceiptRow[];
  completion?: Completion;
  traceability?: Traceability;
}
export interface Reservation {
  id: string;
  materialLineNo: number;
  item: Ref;
  unit: Unit;
  location: Ref;
  lot: LotRef | null;
  quantity: string | null;
  claimed: string | null;
  excess: boolean;
}
export type LotRef = { id: string; lotNumber: string; expiryDate: string | null };
export interface AllocationResult {
  reservedNow: string;
  materials: {
    lineNo: number;
    item: string;
    required: string;
    reservedNow: string;
    covered: string;
    shortage: string;
  }[];
}
export interface IssueRow {
  id: string;
  number: string;
  status: IssueStatus;
  branch: Ref;
  order: { id: string; number: string; status: MoStatus };
  lineCount: number;
  createdBy: Person;
  createdAt: string;
  postedAt: string | null;
  updatedAt: string;
}
export interface Issue extends IssueRow {
  note: string | null;
  postedBy: Person;
  cancelledAt: string | null;
  cancelledBy: Person;
  cancellationReason: string | null;
  lines: {
    id: string;
    lineNo: number;
    materialLineNo: number;
    item: Ref;
    unit: Unit;
    location: Ref;
    lot: LotRef | null;
    quantity: string;
    allocationId: string;
    reserved: string | null;
  }[];
  actions: ('edit' | 'post' | 'cancel')[];
}
export type IssueDetail = { issue: Issue; timeline: Timeline };
export interface HandoffRow {
  id: string;
  number: string;
  status: IssueStatus;
  branch: Ref;
  order: { number: string };
  postedAt: string | null;
  createdAt: string;
  lines: { item: Ref; unit: Unit; location: Ref; lot: LotRef | null; quantity: string }[];
}
export type MoDetail = { order: Mo; timeline: Timeline };

export interface Preview {
  bom: BomRef;
  quantity: string;
  materialState: MaterialState;
  materials: Material[];
}
export interface RequirementRow {
  item: Ref;
  unit: Unit;
  required: string;
  reserved: string;
  issued: string;
  stillNeeded: string;
  available: string;
  shortage: string;
  state: Availability;
  orderCount: number;
  earliestRequiredDate: string | null;
}
export interface DemandRow {
  salesOrder: { id: string; number: string; status: string; requestedDate: string | null };
  lineId: string;
  lineNo: number;
  branch: Ref;
  item: Ref;
  unit: Unit;
  ordered: string;
  dispatched: string;
  reserved: string;
  open: string;
  availableShare: string;
  uncovered: string;
  planned: string;
  suggested: string;
  activeBom: BomRef | null;
  orders: { id: string; number: string; status: MoStatus; quantity: string }[];
}
export interface ShortageRow {
  order: {
    id: string;
    number: string;
    status: MoStatus;
    requiredDate: string | null;
    plannedStartDate: string | null;
  };
  branch: Ref;
  material: Ref;
  unit: Unit;
  required: string;
  available: string;
  shortage: string;
}

const P = '/api/v1/production';
const qs = (q: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q))
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
const id = (v: string) => encodeURIComponent(v);

export interface MoInput {
  itemId?: string;
  branchId?: string;
  salesOrderLineId?: string;
  bomId?: string;
  materialPlan?: MaterialPlan;
  quantity?: string;
  plannedStartDate?: string | null;
  requiredDate?: string | null;
  priority?: Priority;
  note?: string | null;
}
export interface BomInput {
  itemId?: string;
  outputQuantity?: string;
  note?: string | null;
  lines?: { itemId: string; quantity: string }[];
}

export const productionApi = {
  context: () => apiRequest<ProductionContext>('GET', `${P}/context`),
  items: (role: 'OUTPUT' | 'MATERIAL', q: string) =>
    apiRequest<{ items: ProductionItem[] }>('GET', `${P}/items${qs({ role, q })}`),
  boms: (q: { status?: string; itemId?: string; q?: string; page: number; pageSize: number }) =>
    apiRequest<Page<BomRow>>('GET', `${P}/boms${qs(q)}`),
  bom: (b: string) => apiRequest<BomDetail>('GET', `${P}/boms/${id(b)}`),
  createBom: (body: BomInput) => apiRequest<BomDetail>('POST', `${P}/boms`, body),
  updateBom: (b: string, body: BomInput) =>
    apiRequest<BomDetail>('PATCH', `${P}/boms/${id(b)}`, body),
  bomAct: (b: string, action: Exclude<BomAction, 'edit'>, reason?: string) =>
    apiRequest<BomDetail>(
      'POST',
      `${P}/boms/${id(b)}/${action}`,
      action === 'retire' ? { reason: reason || null } : {},
    ),
  list: (q: Record<string, string | number | undefined>) =>
    apiRequest<Page<MoRow>>('GET', `${P}/orders${qs(q)}`),
  get: (o: string) => apiRequest<MoDetail>('GET', `${P}/orders/${id(o)}`),
  create: (body: MoInput) => apiRequest<MoDetail>('POST', `${P}/orders`, body),
  update: (o: string, body: MoInput) => apiRequest<MoDetail>('PATCH', `${P}/orders/${id(o)}`, body),
  /** EP46: a DRAFT MANUAL order's explicit material plan (replaced whole). */
  setMaterials: (o: string, lines: { itemId: string; quantity: string }[]) =>
    apiRequest<MoDetail>('PUT', `${P}/orders/${id(o)}/materials`, { lines }),
  act: (o: string, action: Exclude<MoAction, 'edit'>, reason?: string) =>
    apiRequest<MoDetail>(
      'POST',
      `${P}/orders/${id(o)}/${action}`,
      action === 'reject' || action === 'cancel' ? { reason: reason || null } : {},
    ),
  preview: (q: { bomId: string; quantity: string; branchId?: string }) =>
    apiRequest<Preview>('GET', `${P}/requirements/preview${qs(q)}`),
  requirements: (branchId?: string) =>
    apiRequest<{ branchId: string; items: RequirementRow[] }>(
      'GET',
      `${P}/requirements${qs({ branchId })}`,
    ),
  demand: (q: { q?: string; page: number; pageSize: number }) =>
    apiRequest<Page<DemandRow>>('GET', `${P}/demand${qs(q)}`),
  shortages: () =>
    apiRequest<{ items: ShortageRow[] }>('GET', '/api/v1/purchasing/production-shortages'),
  // EP37 materials, execution, issues
  materials: (o: string, action: 'allocate' | 'release' | 'reallocate') =>
    apiRequest<MoDetail & { allocation?: AllocationResult }>(
      'POST',
      `${P}/orders/${id(o)}/materials/${action}`,
      {},
    ),
  excess: (o: string, materialId: string, body: { quantity: string; reason: string }) =>
    apiRequest<MoDetail & { allocation?: AllocationResult }>(
      'POST',
      `${P}/orders/${id(o)}/materials/${id(materialId)}/excess`,
      body,
    ),
  execute: (o: string, action: 'start' | 'pause' | 'resume', note?: string) =>
    apiRequest<MoDetail>('POST', `${P}/orders/${id(o)}/${action}`, note ? { note } : {}),
  usage: (o: string, body: { materialId: string; quantity: string; note?: string | null }) =>
    apiRequest<MoDetail>('POST', `${P}/orders/${id(o)}/usage`, body),
  issues: (q: Record<string, string | number | undefined>) =>
    apiRequest<Page<IssueRow>>('GET', `${P}/issues${qs(q)}`),
  issue: (i: string) => apiRequest<IssueDetail>('GET', `${P}/issues/${id(i)}`),
  createIssue: (body: {
    productionOrderId: string;
    lines?: { allocationId: string; quantity: string }[];
    note?: string | null;
  }) => apiRequest<IssueDetail>('POST', `${P}/issues`, body),
  issueLines: (i: string, lines: { allocationId: string; quantity: string }[]) =>
    apiRequest<IssueDetail>('PUT', `${P}/issues/${id(i)}/lines`, { lines }),
  issueAct: (i: string, action: 'post' | 'cancel', reason?: string) =>
    apiRequest<IssueDetail>(
      'POST',
      `${P}/issues/${id(i)}/${action}`,
      action === 'cancel' ? { reason: reason || null } : {},
    ),
  handoff: (q: { status?: string; page: number; pageSize: number }) =>
    apiRequest<Page<HandoffRow>>('GET', `/api/v1/warehouse/material-issues${qs(q)}`),
};

/** Decimal places of a quantity string (shape check only — the server decides). */
export const places = (v: string) => (v.split('.')[1] ?? '').length;
export const QTY = /^\d{1,12}(\.\d{1,6})?$/;
