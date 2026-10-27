import type { DbClient, RequestMeta } from '../auth/audit.js';

/*
 * Company / subscription audit (EP24), on the business AuditLog: actor, company,
 * action, target, time and small non-secret details. `actorScope` tells a
 * customer's own action apart from a platform operator's or the seed's.
 */

export type CompanyAuditAction =
  | 'PACKAGE_SELECTED'
  | 'COMPANY_CREATED'
  | 'HEAD_OFFICE_CREATED'
  | 'COMPANY_OWNER_ASSIGNED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_STATUS_CHANGED'
  | 'DEPARTMENTS_SELECTED'
  | 'COMPANY_ONBOARDING_COMPLETED'
  | 'COMPANY_STATUS_CHANGED'
  /** EP24.1: a platform operator opened the read-only Platform Inspection. */
  | 'PLATFORM_COMPANY_INSPECTED';

export type ActorScope = 'customer' | 'platform_owner' | 'platform_admin' | 'seed';

type Detail = string | number | boolean | null | readonly string[];

export async function recordCompanyEvent(
  db: DbClient,
  meta: RequestMeta,
  input: {
    action: CompanyAuditAction;
    actorId: string | null;
    actorScope: ActorScope;
    companyId: string | null;
    entityType: 'User' | 'Company' | 'Branch' | 'CompanyMember' | 'Subscription' | 'Department';
    entityId: string;
    details?: Record<string, Detail>;
  },
) {
  await db.auditLog.create({
    data: {
      action: input.action,
      actorId: input.actorId,
      companyId: input.companyId,
      entityType: input.entityType,
      entityId: input.entityId,
      requestId: meta.requestId,
      changes: { actorScope: input.actorScope, ...(input.details ?? {}) },
    },
  });
}
