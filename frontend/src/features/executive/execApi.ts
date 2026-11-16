import type { DepartmentCode } from '@/features/company/api';
import { apiGet } from '@/lib/api';

/*
 * EP48 Executive Command Center — the read-only API (backend/src/executive). The server
 * decides scope (session company, the person's branches) and content; no money, no
 * quantity and no recipe data is ever part of these answers.
 */

export type WorkClass = 'BLOCKED' | 'OVERDUE' | 'MISSING_DATE' | 'WAITING';
export interface BranchRef {
  id: string;
  code: string;
  name: string;
}

export interface WorkItem {
  kind: string;
  id: string;
  number: string;
  context: string | null;
  branch: BranchRef;
  department: DepartmentCode;
  next: DepartmentCode;
  stage: string;
  class: WorkClass;
  reason: string | null;
  evidence: { code: string; open?: number; total?: number; count?: number };
  date: string | null;
  dateKind: string | null;
  overdueDays: number | null;
  since: string | null;
  ageDays: number | null;
  link: string | null;
}

export interface Metric {
  key: string;
  value: number;
  unit: 'DOCUMENTS' | 'LINES' | 'LOTS';
  tone: 'attention' | 'blocked' | 'progress' | 'done' | 'info';
  link: string | null;
}

export interface Count {
  key: string;
  value: number;
}
export interface DeptCount {
  department: DepartmentCode;
  value: number;
}

export interface Overview {
  scope: { company: string; branches: BranchRef[]; selected: string };
  role: 'COMPANY_OWNER' | 'EXECUTIVE';
  readOnly: true;
  today: string;
  generatedAt: string;
  visible: DepartmentCode[];
  pulse: { department: DepartmentCode; metrics: Metric[] }[];
  departments: {
    department: DepartmentCode;
    open: number;
    waiting: number;
    blocked: number;
    overdue: number;
    stages: Count[];
    completed: Count[];
    waitsOn: DeptCount[];
    awaitedBy: DeptCount[];
    link: string | null;
  }[];
  bottlenecks: {
    key: string;
    from: DepartmentCode;
    to: DepartmentCode;
    total: number;
    classes: Count[];
    stages: Count[];
    items: WorkItem[];
  }[];
  queue: { total: number; items: WorkItem[] };
  branchComparison: {
    keys: string[];
    rows: { branch: BranchRef; values: Record<string, number> }[];
  };
  activity: {
    kind: string;
    id: string;
    number: string;
    event: string;
    at: string;
    branch: BranchRef;
    department: DepartmentCode;
    link: string | null;
  }[];
  notes: string[];
}

export interface Trace {
  document: {
    kind: string;
    id: string;
    number: string;
    status: string;
    context: string | null;
    branch: BranchRef;
    link: string | null;
  };
  item: WorkItem | null;
  related: {
    kind: string;
    id: string;
    number: string;
    status: string;
    at: string | null;
    link: string | null;
  }[];
}

const X = '/api/v1/executive';

/** Document kinds the root-cause trace covers (URL segment). */
export const TRACE_KIND: Record<string, string> = {
  SALES_ORDER: 'sales-order',
  PURCHASE_ORDER: 'purchase-order',
  PRODUCTION_ORDER: 'production-order',
};

export const execApi = {
  overview: (branch: string, signal?: AbortSignal) =>
    apiGet<Overview>(`${X}/overview?branch=${encodeURIComponent(branch)}`, signal),
  trace: (kind: string, id: string, signal?: AbortSignal) =>
    apiGet<Trace>(`${X}/documents/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, signal),
};

/** May this person open the Command Center? (presentation only — the server decides) */
export const canOpenCommandCenter = (role: string, permissions: readonly string[] = []) =>
  (role === 'COMPANY_OWNER' || role === 'EXECUTIVE') &&
  permissions.includes('executive.overview.view');
