import type { DepartmentId } from '@/config/departments';

/*
 * Department Experience (EP06) — the six public department pages.
 *
 * Reports is a shared capability (no page of its own) and System Admin is
 * not a public business department, so neither appears here.
 */

export const DEPT_PAGES = [
  'executive',
  'sales',
  'operations',
  'warehouse',
  'purchasing',
  'accounting',
] as const satisfies readonly DepartmentId[];

export type DeptKey = (typeof DEPT_PAGES)[number];

export function isDeptKey(v: string): v is DeptKey {
  return (DEPT_PAGES as readonly string[]).includes(v);
}

/** Public route of a department page (unlocalized; pass through `href()`). */
export const deptPath = (id: DeptKey) => `/departments/${id}`;

/**
 * Where a department link should go: a department page when one exists,
 * otherwise the department overview (Reports has no page of its own).
 */
export const departmentLink = (id: DepartmentId) => (isDeptKey(id) ? deptPath(id) : '/departments');

/** The workspace accent used for small identifiers only (EP02 tokens). */
export const DEPT_ACCENT: Record<DeptKey, string> = {
  executive: 'var(--color-ws-executive)',
  sales: 'var(--color-ws-sales)',
  operations: 'var(--color-ws-operations)',
  warehouse: 'var(--color-ws-warehouse)',
  purchasing: 'var(--color-ws-purchasing)',
  accounting: 'var(--color-ws-accounting)',
};

/** Departments a page links to at its foot (“งานนี้เชื่อมต่อกับ…”). */
export const ADJACENT: Record<DeptKey, readonly DeptKey[]> = {
  executive: ['sales', 'purchasing', 'accounting'],
  sales: ['operations', 'warehouse', 'accounting'],
  operations: ['sales', 'warehouse', 'purchasing'],
  warehouse: ['purchasing', 'accounting', 'sales'],
  purchasing: ['warehouse', 'accounting', 'operations'],
  accounting: ['purchasing', 'warehouse', 'executive'],
};
