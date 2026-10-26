import type { AuthEventType } from '../generated/prisma/enums.js';
import type { Db, Prisma } from '../db/client.js';

/** Who/where a request came from — recorded on audit events and sessions. */
export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

export type DbClient = Db | Prisma.TransactionClient;

/** Coarse, non-secret context only (failure reason, role, counts). */
export type AuditMetadata = Record<string, string | number | boolean | null>;

export interface AuditInput {
  type: AuthEventType;
  userId?: string | null;
  actorId?: string | null;
  sessionId?: string | null;
  subjectHash?: string | null;
  metadata?: AuditMetadata;
}

/**
 * Appends a security event (EP23). Never pass secrets: no password, code,
 * token, hash or full request body belongs here.
 */
export async function recordAuthEvent(db: DbClient, meta: RequestMeta, input: AuditInput) {
  await db.authAuditEvent.create({
    data: {
      type: input.type,
      userId: input.userId ?? null,
      actorId: input.actorId ?? null,
      sessionId: input.sessionId ?? null,
      subjectHash: input.subjectHash ?? null,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
      metadata: input.metadata ?? undefined,
    },
  });
}
