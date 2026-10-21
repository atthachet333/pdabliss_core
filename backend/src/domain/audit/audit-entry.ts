/**
 * Audit trail foundation. Every important mutation records who did what,
 * when, under which request, and the before/after value of each changed field.
 * Persistence (AuditLog table) arrives with the database layer.
 */

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  occurredAt: string;
  changes: FieldChange[];
  reason?: string;
}

export interface AuditInput {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason?: string;
  now?: Date;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): FieldChange[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: FieldChange[] = [];
  for (const field of [...keys].sort()) {
    const b = before?.[field];
    const a = after?.[field];
    if (!sameValue(b, a)) changes.push({ field, before: b ?? null, after: a ?? null });
  }
  return changes;
}

export function buildAuditEntry(input: AuditInput): AuditEntry {
  return {
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    requestId: input.requestId,
    occurredAt: (input.now ?? new Date()).toISOString(),
    changes: diffFields(input.before, input.after),
    ...(input.reason ? { reason: input.reason } : {}),
  };
}
