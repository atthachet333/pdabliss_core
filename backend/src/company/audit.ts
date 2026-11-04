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
  // ---- EP31: goods receipts and lots (details: number, order number, from / to, line no,
  // item code, counts — never quantities of value, notes or reasons)
  | GoodsReceiptAuditAction
  // ---- EP32: transfers, adjustments, cycle counts (details: number, from / to, counts — never quantities of value)
  | InventoryControlAuditAction
  // ---- EP33: sales orders (details: number, from → to, line count — never prices or totals)
  | SalesOrderAuditAction
  | SalesFulfilmentAuditAction
  // ---- EP36: production planning (details: number / code + revision, from → to, counts — never quantities of value)
  | ProductionAuditAction
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
  | 'PURCHASE_ORDER_WAITING_DEPOSIT'
  | 'PURCHASE_ORDER_PENDING_RECEIVE'
  | 'PURCHASE_ORDER_CANCELLED'
  | 'PURCHASE_ORDER_DEPOSIT_CONFIRMED'
  | 'PURCHASE_ORDER_DEPOSIT_WAIVED'
  // EP31: receipts against the order (partial / complete; reopened when a receipt is reversed)
  | 'PURCHASE_ORDER_PARTIALLY_RECEIVED'
  | 'PURCHASE_ORDER_RECEIVED'
  | 'PURCHASE_ORDER_RECEIVE_REOPENED';

export type GoodsReceiptAuditAction =
  | 'GOODS_RECEIPT_CREATED'
  | 'GOODS_RECEIPT_UPDATED'
  | 'GOODS_RECEIPT_LINE_UPDATED'
  | 'GOODS_RECEIPT_POSTED'
  | 'GOODS_RECEIPT_CANCELLED'
  | 'INVENTORY_LOT_CREATED';

export type SalesOrderAuditAction =
  | 'SALES_ORDER_CREATED'
  | 'SALES_ORDER_UPDATED'
  | 'SALES_ORDER_SUBMITTED'
  | 'SALES_ORDER_CONFIRMED'
  | 'SALES_ORDER_CANCELLED'
  // ---- EP34 allocation (details: number, line / reservation counts — never quantities of value)
  | 'SALES_ALLOCATION_CREATED'
  | 'SALES_ALLOCATION_RELEASED'
  | 'SALES_ALLOCATION_REALLOCATED'
  | 'SALES_ORDER_FULLY_ALLOCATED'
  | 'SALES_ORDER_PARTIALLY_ALLOCATED';

/** EP35 sales fulfilment (details: document numbers, line counts and statuses — never money). */
export type SalesFulfilmentAuditAction =
  | 'SALES_PICK_CREATED'
  | 'SALES_PICK_UPDATED'
  | 'SALES_PICK_CONFIRMED'
  | 'SALES_PICK_CANCELLED'
  | 'SALES_PACK_CREATED'
  | 'SALES_PACK_CONFIRMED'
  | 'SALES_PACK_CANCELLED'
  | 'SALES_SHIPMENT_CREATED'
  | 'SALES_SHIPMENT_CANCELLED'
  | 'SALES_SHIPMENT_DISPATCHED'
  | 'SALES_SHIPMENT_DELIVERED'
  | 'SALES_SHIPMENT_EXCEPTION';

/** EP36 production planning (BOM revisions and production orders; no stock effect). */
export type ProductionAuditAction =
  | 'PRODUCTION_BOM_CREATED'
  | 'PRODUCTION_BOM_UPDATED'
  | 'PRODUCTION_BOM_ACTIVATED'
  | 'PRODUCTION_BOM_RETIRED'
  | 'PRODUCTION_ORDER_CREATED'
  | 'PRODUCTION_ORDER_UPDATED'
  | 'PRODUCTION_ORDER_SUBMITTED'
  | 'PRODUCTION_ORDER_APPROVED'
  | 'PRODUCTION_ORDER_REJECTED'
  | 'PRODUCTION_ORDER_RELEASED'
  | 'PRODUCTION_ORDER_CANCELLED'
  // ---- EP37 (reservation, execution, usage — counts and transitions, never quantities of value)
  | 'PRODUCTION_MATERIALS_ALLOCATED'
  | 'PRODUCTION_MATERIALS_RELEASED'
  | 'PRODUCTION_MATERIALS_REALLOCATED'
  | 'PRODUCTION_EXCESS_ALLOCATED'
  | 'PRODUCTION_ORDER_STARTED'
  | 'PRODUCTION_ORDER_PAUSED'
  | 'PRODUCTION_ORDER_RESUMED'
  | 'PRODUCTION_MATERIAL_USAGE_RECORDED'
  | 'MATERIAL_ISSUE_CREATED'
  | 'MATERIAL_ISSUE_UPDATED'
  | 'MATERIAL_ISSUE_POSTED'
  | 'MATERIAL_ISSUE_CANCELLED';

export type InventoryControlAuditAction =
  | 'TRANSFER_CREATED'
  | 'TRANSFER_UPDATED'
  | 'TRANSFER_POSTED'
  | 'TRANSFER_CANCELLED'
  | 'ADJUSTMENT_CREATED'
  | 'ADJUSTMENT_UPDATED'
  | 'ADJUSTMENT_SUBMITTED'
  | 'ADJUSTMENT_APPROVED'
  | 'ADJUSTMENT_REJECTED'
  | 'ADJUSTMENT_POSTED'
  | 'ADJUSTMENT_CANCELLED'
  | 'CYCLE_COUNT_CREATED'
  | 'CYCLE_COUNT_UPDATED'
  | 'CYCLE_COUNT_STARTED'
  | 'CYCLE_COUNT_COUNTED'
  | 'CYCLE_COUNT_REVIEWED'
  | 'CYCLE_COUNT_REOPENED'
  | 'CYCLE_COUNT_POSTED'
  | 'CYCLE_COUNT_CANCELLED';

/**
 * Entities whose audit details are the customer's business data: Platform
 * Inspection shows that such an event happened, never its details (EP28, EP29,
 * EP30–EP32 — no document number, amount, supplier, lot or quantity).
 */
export const BUSINESS_AUDIT_ENTITIES: readonly string[] = [
  ...MASTER_AUDIT_ENTITIES,
  'PurchaseRequest',
  'PurchaseOrder',
  'GoodsReceipt',
  'InventoryLot',
  'InventoryTransfer',
  'StockAdjustment',
  'CycleCount',
  'SalesOrder',
  'SalesPick',
  'SalesPack',
  'SalesShipment',
  'ProductionBom',
  'ProductionOrder',
  'ProductionMaterialIssue',
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
  | 'PurchaseOrder'
  | 'GoodsReceipt'
  | 'InventoryLot'
  | 'InventoryTransfer'
  | 'StockAdjustment'
  | 'CycleCount'
  | 'SalesOrder'
  | 'SalesPick'
  | 'SalesPack'
  | 'SalesShipment'
  | 'ProductionBom'
  | 'ProductionOrder'
  | 'ProductionMaterialIssue';

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
