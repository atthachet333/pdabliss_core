import { apiGet } from '@/lib/api';
import type { DepartmentCode } from '@/features/company/api';

/*
 * EP47 department dashboards — the read-only API (backend/src/dashboards).
 * The server decides scope (session company + selected branch) and which
 * metrics and rows this person may see; the screen only presents them.
 */

export const DASHBOARD_DEPARTMENTS = [
  'SALES',
  'OPERATIONS',
  'WAREHOUSE',
  'PURCHASING',
  'ACCOUNTING',
] as const satisfies readonly DepartmentCode[];
export type DashboardDepartment = (typeof DASHBOARD_DEPARTMENTS)[number];

export const isDashboardDepartment = (v: string): v is DashboardDepartment =>
  (DASHBOARD_DEPARTMENTS as readonly string[]).includes(v);

export type Tone = 'attention' | 'blocked' | 'progress' | 'done' | 'info';

export interface Metric {
  key: string;
  value: number;
  tone: Tone;
  link: string | null;
}

export interface QueueItem {
  id: string;
  kind: string;
  number: string;
  status: string;
  context: string | null;
  action: string;
  responsible: DepartmentCode;
  canAct: boolean;
  date: string | null;
  dateKind: string | null;
  overdue: boolean;
  progress: { open: number; total: number } | null;
  quantity: { value: string; unit: string } | null;
  amount: { value: string; currency: string } | null;
  link: string | null;
}

export interface Queue {
  key: string;
  total: number;
  items: QueueItem[];
}

export interface Dashboard {
  department: DashboardDepartment;
  branch: { id: string; code: string; name: string };
  today: string;
  generatedAt: string;
  access: 'READ' | 'OPERATE' | 'MANAGE';
  manufacturingMode: 'BOM_REQUIRED' | 'BOM_OPTIONAL' | null;
  metrics: Metric[];
  queues: Queue[];
  notes: string[];
}

const D = '/api/v1/dashboards';

export const dashApi = {
  get: (department: DashboardDepartment, signal?: AbortSignal) =>
    apiGet<Dashboard>(`${D}/${department.toLowerCase()}`, signal),
};

/** Refresh rules: ./liveResource.ts (shared with the EP48 Command Center). */
export { REFRESH_EVERY_MS, REFRESH_ON_RETURN_AFTER_MS } from './liveResource';
