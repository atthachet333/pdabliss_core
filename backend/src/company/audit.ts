import type { DbClient, RequestMeta } from '../auth/audit.js';

/*
 * Company / subscription audit (EP24), on the business AuditLog: actor, company,
 * action, target, time and small non-secret details. `actorScope` tells a
 * customer's own action apart from a platform operator's or the seed's.
 *
 * EP25 adds the Company Control Center actions, EP26 branch access and
 * invitation resends, EP28 the operational master data. Details name what changed
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
  | 'MEMBER_PERMISSION_OVERRIDE_REMOVED'
  // ---- EP28.1: the demo seed applied a demo persona to a membership (once; seed only)
  | 'DEMO_PERSONA_APPLIED'
  // ---- EP29: purchase requests (details: number, from / to, field names, line no, item code)
  | PurchaseRequestAuditAction
  // ---- EP30: purchase orders (details: number, from / to, field names, line no,
  // request number, item code — never amounts, prices, supplier or deposit values)
  | PurchaseOrderAuditAction
  // ---- EP28: operational master data (details: code, name, changed field names,
  // name / tracking from → to — never notes, addresses or contact values)
  | MasterDataAuditAction;

export const MASTER_AUDIT_ENTITIES = [
  'Customer',
  'Supplier',
  'Item',
  'Unit',
  'ItemCategory',
  'WarehouseLocation',
] as const;
export type MasterAuditEntity = (typeof MASTER_AUDIT_ENTITIES)[number];

const MASTER_EVENT_PREFIX = {
  Customer: 'CUSTOMER',
  Supplier: 'SUPPLIER',
  Item: 'ITEM',
  Unit: 'UNIT',
  ItemCategory: 'ITEM_CATEGORY',
  WarehouseLocation: 'LOCATION',
} as const satisfies Record<MasterAuditEntity, string>;

type MasterVerb = 'CREATED' | 'UPDATED' | 'DEACTIVATED' | 'REACTIVATED';
export type MasterDataAuditAction =
  | `${(typeof MASTER_EVENT_PREFIX)[MasterAuditEntity]}_${MasterVerb}`
  /** Base unit or inventory / lot / expiry tracking changed (the structure policy point). */
  | 'ITEM_STRUCTURE_CHANGED';

export type PurchaseRequestAuditAction =
  | 'PURCHASE_REQUEST_CREATED'
  | 'PURCHASE_REQUEST_UPDATED'
  | 'PURCHASE_REQUEST_LINE_ADDED'
  | 'PURCHASE_REQUEST_LINE_UPDATED'
  | 'PURCHASE_REQUEST_LINE_REMOVED'
  | 'PURCHASE_REQUEST_SUBMITTED'
  | 'PURCHASE_REQUEST_APPROVED'
  | 'PURCHASE_REQUEST_REJECTED'
  | 'PURCHASE_REQUEST_CANCELLED';

export type PurchaseOrderAuditAction =
  | 'PURCHASE_ORDER_CREATED'
  | 'PURCHASE_ORDER_UPDATED'
  | 'PURCHASE_ORDER_LINE_ADDED'
  | 'PURCHASE_ORDER_LINE_UPDATED'
  | 'PURCHASE_ORDER_LINE_REMOVED'
  | 'PURCHASE_ORDER_ISSUED'
  | 'PURCHASE_ORDER_CANCELLED'
  | 'PURCHASE_ORDER_DEPOSIT_CONFIRMED'
  | 'PURCHASE_ORDER_DEPOSIT_WAIVED';

/**
 * Entities whose audit details are the customer's business data: Platform
 * Inspection shows that such an event happened, never its details (EP28, EP29,
 * EP30 — no order number, amount or supplier).
 */
export const BUSINESS_AUDIT_ENTITIES: readonly string[] = [
  ...MASTER_AUDIT_ENTITIES,
  'PurchaseRequest',
  'PurchaseOrder',
];

export const masterEvent = (entity: MasterAuditEntity, verb: MasterVerb): MasterDataAuditAction =>
  `${MASTER_EVENT_PREFIX[entity]}_${verb}`;

export type ActorScope = 'customer' | 'platform_owner' | 'platform_admin' | 'seed';

type Detail = string | number | boolean | null | readonly string[];

export type AuditEntityType =
  | 'User'
  | 'Company'
  | 'Branch'
  | 'CompanyMember'
  | 'Subscription'
  | 'Department'
  | 'Invitation'
  | MasterAuditEntity
  | 'PurchaseRequest'
  | 'PurchaseOrder';

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
