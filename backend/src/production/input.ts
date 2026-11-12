import { z } from 'zod';
import { OwnerOverrideBody } from '../company/approval.js';
import { quantityValue } from '../purchasing/input.js';
import { AllocationBody, dayValue } from '../warehouse/input.js';

/*
 * Request schemas for Production planning (EP36). Strict objects: what the
 * server owns — company, number, status, revision, item / unit / BOM
 * snapshots, material requirements, available and shortage quantities, the
 * people and times of each step, a sales order's branch or quantity — is
 * refused with 400, never ignored. Quantities travel as decimal STRINGS.
 */

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !CONTROL.test(v), 'invalid characters')
    .transform((v) => v.replace(/\r\n?/g, '\n').normalize('NFC'));
/** Optional; `null` or '' clears it. */
const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    schema.nullable().optional(),
  );
const id = z.string().min(1).max(64);
const param = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), s.optional());
const page = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const MO_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'READY',
  'IN_PRODUCTION',
  'PAUSED',
  'COMPLETION_REVIEW',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const;
export const BOM_STATUSES = ['DRAFT', 'ACTIVE', 'RETIRED'] as const;
export const SOURCES = ['MANUAL', 'SALES_DEMAND'] as const;

// ---------------------------------------------------------------- BOM

/**
 * A material line. `unitId` is optional: when given it must be the material's
 * base unit — there is no unit conversion (UNIT_CONVERSION_UNSUPPORTED).
 */
export const BomLineBody = z
  .object({
    itemId: id,
    quantity: quantityValue,
    unitId: id.optional(),
    note: opt(text(300)),
  })
  .strict();
export type BomLineInput = z.output<typeof BomLineBody>;

export const CreateBomBody = z
  .object({
    itemId: id,
    outputQuantity: quantityValue,
    unitId: id.optional(),
    note: opt(text(1000)),
    lines: z.array(BomLineBody).max(100).default([]),
  })
  .strict();
export type CreateBomInput = z.output<typeof CreateBomBody>;

export const UpdateBomBody = z
  .object({
    outputQuantity: quantityValue.optional(),
    unitId: id.optional(),
    note: opt(text(1000)),
    lines: z.array(BomLineBody).max(100).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateBomInput = z.output<typeof UpdateBomBody>;

export const BomListQuery = z
  .object({
    status: param(z.enum(BOM_STATUSES)),
    itemId: param(id),
    q: param(z.string().trim().min(1).max(100)),
    ...page,
  })
  .strict();
export type BomListInput = z.output<typeof BomListQuery>;

// ---------------------------------------------------------------- orders

const orderFields = {
  /** Omitted: the item's one ACTIVE revision (never an arbitrary one). */
  bomId: id.optional(),
  /** EP46: BOM (default) or MANUAL — an explicit material plan, BOM_OPTIONAL companies only. */
  materialPlan: z.enum(['BOM', 'MANUAL']).optional(),
  quantity: quantityValue,
  plannedStartDate: opt(dayValue),
  requiredDate: opt(dayValue),
  priority: z.enum(PRIORITIES).optional(),
  note: opt(text(1000)),
};

/**
 * MANUAL: `itemId` (+ optional `branchId`, default the working branch).
 * SALES_DEMAND: `salesOrderLineId` only — item and branch come from the sales
 * order line on the server; sending them as well is refused (400).
 */
export const CreateMoBody = z
  .object({
    ...orderFields,
    itemId: id.optional(),
    branchId: id.optional(),
    salesOrderLineId: id.optional(),
  })
  .strict()
  .refine((v) => (v.salesOrderLineId ? !v.itemId && !v.branchId : !!v.itemId), {
    message: 'give itemId (manual) or salesOrderLineId (sales demand), not both',
  });
export type CreateMoInput = z.output<typeof CreateMoBody>;

export const UpdateMoBody = z
  .object({ ...orderFields, quantity: quantityValue.optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateMoInput = z.output<typeof UpdateMoBody>;

/** EP46: a DRAFT MANUAL order's explicit material plan, replaced whole (empty clears it). */
export const MoMaterialsBody = z.object({ lines: z.array(BomLineBody).max(100) }).strict();

export const MoReasonBody = z.object({ reason: opt(text(500)) }).strict();
export const MoNoBody = z.object({}).strict();

export const MoListQuery = z
  .object({
    status: param(z.enum(MO_STATUSES)),
    branchId: param(id),
    itemId: param(id),
    source: param(z.enum(SOURCES)),
    /** SHORT: open orders whose materials are short now; AVAILABLE: covered now. */
    materials: param(z.enum(['SHORT', 'AVAILABLE'])),
    /** EP37: RESERVATION = approved … paused (materials being reserved / issued); EXECUTION = in production or paused. */
    stage: param(z.enum(['RESERVATION', 'EXECUTION', 'COMPLETED'])),
    /** Planned start between from and to (inclusive). */
    from: param(dayValue),
    to: param(dayValue),
    q: param(z.string().trim().min(1).max(100)),
    ...page,
  })
  .strict();
export type MoListInput = z.output<typeof MoListQuery>;

export const PreviewQuery = z
  .object({
    bomId: id,
    quantity: quantityValue,
    branchId: param(id),
  })
  .strict();

export const ItemQuery = z
  .object({
    q: param(z.string().trim().min(1).max(100)),
    /** OUTPUT: finished goods a BOM / order can make; MATERIAL: stock items a BOM can use. */
    role: z.enum(['OUTPUT', 'MATERIAL']),
  })
  .strict();

export const BranchQuery = z.object({ branchId: param(id) }).strict();
export const DemandQuery = z
  .object({ branchId: param(id), q: param(z.string().trim().min(1).max(100)), ...page })
  .strict();

// ---------------------------------------------------------------- EP37

/** Start / pause / resume: an optional work note only. */
export const ExecutionBody = z.object({ note: opt(text(500)) }).strict();

/** Excess (beyond the frozen requirement): manager, quantity and a reason. */
export const ExcessBody = z.object({ quantity: quantityValue, reason: text(500) }).strict();

/** Actual usage reported by production — evidence only, never a movement. */
export const UsageBody = z
  .object({ materialId: id, quantity: quantityValue, note: opt(text(500)) })
  .strict();

const issueLine = z.object({ allocationId: id, quantity: quantityValue }).strict();
/** A draft issue: the order, and optionally which reservations and how much (default: all unclaimed). */
export const CreateIssueBody = z
  .object({
    productionOrderId: id,
    lines: z.array(issueLine).min(1).max(100).optional(),
    note: opt(text(1000)),
  })
  .strict();
export type CreateIssueInput = z.output<typeof CreateIssueBody>;
export const IssueLinesBody = z
  .object({ lines: z.array(issueLine).min(1).max(100), note: opt(text(1000)) })
  .strict();
export type IssueLineInput = z.output<typeof issueLine>;

export const ISSUE_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export const IssueListQuery = z
  .object({
    status: param(z.enum(ISSUE_STATUSES)),
    productionOrderId: param(id),
    branchId: param(id),
    q: param(z.string().trim().min(1).max(100)),
    ...page,
  })
  .strict();
export type IssueListInput = z.output<typeof IssueListQuery>;

// ---------------------------------------------------------------- EP38

/** A quantity that may be zero (a report may have no defective or no pending part). */
const amount = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,6})?$/, 'invalid quantity');

const outputFields = {
  productionDate: dayValue,
  goodQuantity: amount,
  defectiveQuantity: amount.optional(),
  pendingQuantity: amount.optional(),
  note: opt(text(1000)),
};
/** A production result of one order: good, defective, pending quality — reported, never stock. */
export const CreateOutputBody = z.object({ productionOrderId: id, ...outputFields }).strict();
export type CreateOutputInput = z.output<typeof CreateOutputBody>;
export const UpdateOutputBody = z.object(outputFields).partial().strict();
export type UpdateOutputInput = z.output<typeof UpdateOutputBody>;
/** The quality decision: how much of the pending quantity is good (the rest is rejected). */
/** EP41: and, when independent approval needs it, an owner override. */
export const AcceptOutputBody = z
  .object({ pendingGood: amount.optional(), ownerOverride: OwnerOverrideBody.optional() })
  .strict();
export const OUTPUT_STATUSES = ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED'] as const;
export const OutputListQuery = z
  .object({
    status: param(z.enum(OUTPUT_STATUSES)),
    productionOrderId: param(id),
    branchId: param(id),
    q: param(z.string().trim().min(1).max(100)),
    ...page,
  })
  .strict();
export type OutputListInput = z.output<typeof OutputListQuery>;

/** Review / reopen: an optional note. Complete: the outcome, its reason, the material review. */
export const ReviewBody = z.object({ note: opt(text(500)) }).strict();
export const CompleteBody = z
  .object({
    outcome: z.enum(['COMPLETED', 'SHORT_CLOSED']),
    reason: opt(text(500)),
    materialsReviewed: z.literal(true),
  })
  .strict();
export type CompleteInput = z.output<typeof CompleteBody>;

/** Finished goods receipt lines: the warehouse allocation shape (location, lot, expiry, quantity). */
export const FgLinesBody = z
  .object({ lines: z.array(AllocationBody).min(1).max(50), note: opt(text(1000)) })
  .strict();
export const CreateFgReceiptBody = z
  .object({
    outputReportId: id,
    lines: z.array(AllocationBody).min(1).max(50),
    note: opt(text(1000)),
  })
  .strict();
export type CreateFgReceiptInput = z.output<typeof CreateFgReceiptBody>;
export const FG_RECEIPT_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED', 'REVERSED'] as const;
export const FgReceiptListQuery = z
  .object({
    status: param(z.enum(FG_RECEIPT_STATUSES)),
    outputReportId: param(id),
    productionOrderId: param(id),
    q: param(z.string().trim().min(1).max(100)),
    ...page,
  })
  .strict();
export type FgReceiptListInput = z.output<typeof FgReceiptListQuery>;
export const ReasonBody = z.object({ reason: text(500) }).strict();
export const OptionalReasonBody = z.object({ reason: opt(text(500)) }).strict();
export const FgPendingQuery = z.object({ ...page }).strict();
