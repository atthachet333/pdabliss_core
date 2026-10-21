import type { WorkspaceCode } from './workspaces.js';

/**
 * Every field the API can return belongs to a data class. Response contracts
 * for a workspace may only include fields whose class that workspace is
 * cleared for. This is enforced server-side by building per-audience response
 * schemas (allow-lists) — never by asking the frontend to hide columns.
 *
 * - operational: quantities, lots, dates, statuses — needed to do the work
 * - commercial:  purchase cost, sales price, margins, supplier terms
 * - financial:   payments, payables, accounting amounts
 */
export type DataClass = 'operational' | 'commercial' | 'financial';

export const WORKSPACE_DATA_CLEARANCE: Record<WorkspaceCode, readonly DataClass[]> = {
  executive: ['operational', 'commercial', 'financial'],
  sales: ['operational', 'commercial'],
  warehouse: ['operational'],
  purchasing: ['operational', 'commercial'],
  operations: ['operational'],
  accounting: ['operational', 'commercial', 'financial'],
  admin: ['operational'],
};

export type FieldClassification<T> = { readonly [K in keyof T]-?: DataClass };

export function isClearedFor(workspace: WorkspaceCode, dataClass: DataClass): boolean {
  return WORKSPACE_DATA_CLEARANCE[workspace].includes(dataClass);
}

/** Returns the field names of a classified record that a workspace may receive. */
export function allowedFields<T>(
  classification: FieldClassification<T>,
  workspace: WorkspaceCode,
): (keyof T)[] {
  return (Object.keys(classification) as (keyof T)[]).filter((field) =>
    isClearedFor(workspace, classification[field]),
  );
}
