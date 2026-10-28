import type { DbClient, RequestMeta } from '../auth/audit.js';

/*
 * Company / subscription audit (EP24), on the business AuditLog: actor, company,
 * action, target, time and small non-secret details. `actorScope` tells a
 * customer's own action apart from a platform operator's or the seed's.
 *
 * EP25 adds the Company Control Center actions, EP26 branch access and
 * invitation resends. Details name what changed
 * (field names, codes, roles) — never a token, a password, a file's bytes or
 * anything secret.
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
  | 'PLATFORM_COMPANY_INSPECTED'
  // ---- EP25: Company Control Center
  | 'COMPANY_PROFILE_UPDATED'
  | 'COMPANY_LOGO_UPDATED'
  | 'COMPANY_LOGO_REMOVED'
  | 'COMPANY_SETTINGS_UPDATED'
  | 'BRANCH_CREATED'
  | 'BRANCH_UPDATED'
  | 'BRANCH_STATUS_CHANGED'
  | 'INVITATION_SENT'
  | 'INVITATION_REVOKED'
  | 'INVITATION_ACCEPTED'
  | 'MEMBER_ROLE_CHANGED'
  | 'MEMBER_STATUS_CHANGED'
  | 'MEMBER_JOB_TITLE_CHANGED'
  | 'MEMBER_DEPARTMENTS_CHANGED'
  | 'DEPARTMENT_ENABLED'
  | 'DEPARTMENT_DISABLED'
  // ---- EP26: branch & user administration
  /** Branch access changed: from / to scope and branch codes. */
  | 'MEMBER_BRANCH_ACCESS_CHANGED'
  /** A pending invitation was replaced by a fresh one (new token, new expiry). */
  | 'INVITATION_RESENT'
  // ---- EP27: permission exceptions (details: member email, permission code, from / to effect)
  | 'MEMBER_PERMISSION_OVERRIDE_ADDED'
  | 'MEMBER_PERMISSION_OVERRIDE_CHANGED'
  | 'MEMBER_PERMISSION_OVERRIDE_REMOVED';

export type ActorScope = 'customer' | 'platform_owner' | 'platform_admin' | 'seed';

type Detail = string | number | boolean | null | readonly string[];

export type AuditEntityType =
  'User' | 'Company' | 'Branch' | 'CompanyMember' | 'Subscription' | 'Department' | 'Invitation';

export async function recordCompanyEvent(
  db: DbClient,
  meta: RequestMeta,
  input: {
    action: CompanyAuditAction;
    actorId: string | null;
    actorScope: ActorScope;
    companyId: string | null;
    entityType: AuditEntityType;
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
