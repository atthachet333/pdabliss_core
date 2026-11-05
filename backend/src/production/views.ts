import { z } from 'zod';
import { BOM_STATUSES, MO_STATUSES, PRIORITIES, SOURCES } from './input.js';
import { MO_ACTIONS } from './policy.js';

/*
 * Production responses (EP36) — explicit ALLOW-LISTS, parsed before sending:
 * a key not named here never reaches the client. Production is operational:
 * items, units, quantities, dates, branches, people. There is NO selling
 * price, discount, tax, total, margin, payment, purchase cost or supplier
 * price anywhere, and no customer (a sales-linked order shows the sales order
 * number, its status and requested date only). Tested key by key and value by value.
 */

const ref = z.object({ id: z.string(), code: z.string(), name: z.string() });
const person = z.object({ name: z.string() }).nullable();
const unit = z.object({ code: z.string(), precision: z.number() });
const bomStatus = z.enum(BOM_STATUSES);
const moStatus = z.enum(MO_STATUSES);
const availability = z.enum(['AVAILABLE', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE']);
export const materialStateEnum = z.enum(['MATERIALS_AVAILABLE', 'MATERIALS_SHORT', 'NOT_ASSESSED']);
/** EP37: the order's material commitment (null before approval). */
const reservationState = z
  .enum(['NOT_RESERVED', 'PARTIALLY_RESERVED', 'FULLY_RESERVED', 'PARTIALLY_ISSUED', 'ISSUED'])
  .nullable();
const lotRef = z.object({
  id: z.string(),
  lotNumber: z.string(),
  expiryDate: z.string().nullable(),
});
const timelineEntry = z.object({ type: z.string(), at: z.string(), actor: person });

// ---------------------------------------------------------------- BOM

export const BomRow = z.object({
  id: z.string(),
  code: z.string(),
  revision: z.number(),
  status: bomStatus,
  item: ref,
  outputQuantity: z.string(),
  unit,
  lineCount: z.number(),
  activatedAt: z.string().nullable(),
  updatedAt: z.string(),
});

const bomLine = z.object({
  lineNo: z.number(),
  item: ref.extend({ type: z.string() }),
  unit,
  quantity: z.string(),
  note: z.string().nullable(),
});

export const BomView = BomRow.extend({
  note: z.string().nullable(),
  lines: z.array(bomLine),
  createdBy: person,
  createdAt: z.string(),
  activatedBy: person,
  retiredAt: z.string().nullable(),
  retiredBy: person,
  retirementReason: z.string().nullable(),
  /** Every revision of the same finished item, newest first. */
  revisions: z.array(
    z.object({ id: z.string(), revision: z.number(), status: bomStatus, updatedAt: z.string() }),
  ),
  /** Production orders (any status) that use this revision. */
  orderCount: z.number(),
  actions: z.array(z.enum(['edit', 'activate', 'retire', 'revise'])),
});

// ---------------------------------------------------------------- orders

const salesLink = z
  .object({
    id: z.string(),
    number: z.string(),
    status: z.string(),
    requestedDate: z.string().nullable(),
    lineNo: z.number(),
  })
  .nullable();

export const MoRow = z.object({
  id: z.string(),
  number: z.string(),
  status: moStatus,
  source: z.enum(SOURCES),
  branch: ref,
  item: ref,
  unit,
  quantity: z.string(),
  bom: z.object({ id: z.string(), code: z.string(), revision: z.number() }).nullable(),
  plannedStartDate: z.string().nullable(),
  requiredDate: z.string().nullable(),
  priority: z.enum(PRIORITIES),
  /** Now, from the ledger — a snapshot, never a reservation (NOT_ASSESSED when terminal or no BOM). */
  materialState: materialStateEnum,
  reservationState,
  salesOrder: salesLink,
  /** SOURCE_CANCELLED: an open order whose sales order was cancelled — needs review. */
  attention: z.enum(['SOURCE_CANCELLED']).nullable(),
  createdBy: person,
  updatedAt: z.string(),
});

export const MaterialLine = z.object({
  /** The requirement id (EP37: usage and excess name it). Empty in a preview. */
  id: z.string(),
  lineNo: z.number(),
  item: ref,
  unit,
  bomQuantity: z.string(),
  required: z.string(),
  /** False when the requirement was rounded UP to the unit's decimal places. */
  exact: z.boolean(),
  available: z.string().nullable(),
  shortage: z.string().nullable(),
  state: availability.nullable(),
  /** EP37 — planned vs committed vs physical vs reported (never interchangeable). */
  reserved: z.string(),
  issued: z.string(),
  used: z.string(),
  /** required − reserved − issued (≥ 0): what still has to be reserved. */
  stillNeeded: z.string(),
  /** Reserved / issued beyond the requirement (manager-authorized, with a reason). */
  excess: z.string(),
  /** used − required (signed). */
  usageVariance: z.string(),
  /** issued − used: issued to production, not (yet) reported as used. */
  unrecorded: z.string(),
});

const demand = z
  .object({
    ordered: z.string(),
    dispatched: z.string(),
    reserved: z.string(),
    /** ordered − dispatched − reserved (never below 0). */
    open: z.string(),
    /** Other open production orders already planned for the same sales line. */
    plannedElsewhere: z.string(),
    overPlanned: z.boolean(),
  })
  .nullable();

/** EP38: an order's output progress. */
export const OutputProgress = z.object({
  target: z.string(),
  goodReported: z.string(),
  pendingReview: z.string(),
  accepted: z.string(),
  rejected: z.string(),
  received: z.string(),
  awaitingReceipt: z.string(),
  remaining: z.string(),
});

export const MoView = MoRow.extend({
  note: z.string().nullable(),
  bomOutputQuantity: z.string().nullable(),
  createdAt: z.string(),
  submittedAt: z.string().nullable(),
  submittedBy: person,
  approvedAt: z.string().nullable(),
  approvedBy: person,
  releasedAt: z.string().nullable(),
  releasedBy: person,
  rejectedAt: z.string().nullable(),
  rejectedBy: person,
  rejectionReason: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  /** True from approval on: requirements and BOM revision are frozen. */
  frozen: z.boolean(),
  materials: z.array(MaterialLine),
  demand,
  warnings: z.array(z.enum(['DEMAND_ALREADY_PLANNED', 'SOURCE_CANCELLED', 'BOM_RETIRED'])),
  actions: z.array(z.enum(MO_ACTIONS)),
  /** EP37 execution facts. */
  startedAt: z.string().nullable(),
  startedBy: person,
  pausedAt: z.string().nullable(),
  executionNote: z.string().nullable(),
  /** ACTIVE reservations, exact location and lot; `claimed` = held by draft issues. */
  reservations: z.array(
    z.object({
      id: z.string(),
      materialLineNo: z.number(),
      item: ref,
      unit,
      location: ref,
      lot: lotRef.nullable(),
      quantity: z.string(),
      claimed: z.string(),
      excess: z.boolean(),
    }),
  ),
  issues: z.array(
    z.object({
      id: z.string(),
      number: z.string(),
      status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']),
      postedAt: z.string().nullable(),
      lineCount: z.number(),
    }),
  ),
  /** EP38: output, finished goods receipts, completion and traceability (order unit throughout). */
  output: OutputProgress.nullable(),
  outputReports: z.array(
    z.object({
      id: z.string(),
      number: z.string(),
      status: z.enum(['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED']),
      productionDate: z.string(),
      good: z.string(),
      defective: z.string(),
      pending: z.string(),
      accepted: z.string().nullable(),
      rejected: z.string().nullable(),
      received: z.string(),
    }),
  ),
  receipts: z.array(
    z.object({
      id: z.string(),
      number: z.string(),
      status: z.enum(['DRAFT', 'POSTED', 'CANCELLED', 'REVERSED']),
      outputNumber: z.string(),
      quantity: z.string(),
      postedAt: z.string().nullable(),
    }),
  ),
  completion: z.object({
    reviewRequestedAt: z.string().nullable(),
    reviewRequestedBy: person,
    completedAt: z.string().nullable(),
    completedBy: person,
    outcome: z.enum(['COMPLETED', 'SHORT_CLOSED']).nullable(),
    reason: z.string().nullable(),
    /** What blocks completion now (empty = nothing). */
    blockers: z.array(z.string()),
  }),
  traceability: z.object({
    outputLots: z.array(
      z.object({
        lotNumber: z.string(),
        expiryDate: z.string().nullable(),
        receipt: z.string(),
        quantity: z.string(),
      }),
    ),
    materialLots: z.array(
      z.object({
        item: z.string(),
        lotNumber: z.string().nullable(),
        issue: z.string(),
        quantity: z.string(),
        unit: z.string(),
      }),
    ),
  }),
});

/** EP37: what an allocation / reallocation did, per material. */
export const AllocationResult = z.object({
  reservedNow: z.string(),
  materials: z.array(
    z.object({
      lineNo: z.number(),
      item: z.string(),
      required: z.string(),
      reservedNow: z.string(),
      covered: z.string(),
      shortage: z.string(),
    }),
  ),
});

// ---------------------------------------------------------------- EP37 material issues

const issueStatus = z.enum(['DRAFT', 'POSTED', 'CANCELLED']);
export const IssueRow = z.object({
  id: z.string(),
  number: z.string(),
  status: issueStatus,
  branch: ref,
  order: z.object({ id: z.string(), number: z.string(), status: moStatus }),
  lineCount: z.number(),
  createdBy: person,
  createdAt: z.string(),
  postedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export const IssueView = IssueRow.extend({
  note: z.string().nullable(),
  postedBy: person,
  cancelledAt: z.string().nullable(),
  cancelledBy: person,
  cancellationReason: z.string().nullable(),
  lines: z.array(
    z.object({
      id: z.string(),
      lineNo: z.number(),
      materialLineNo: z.number(),
      item: ref,
      unit,
      location: ref,
      lot: lotRef.nullable(),
      quantity: z.string(),
      allocationId: z.string(),
      /** For a DRAFT: what its reservation still holds now (null after posting / cancelling). */
      reserved: z.string().nullable(),
    }),
  ),
  actions: z.array(z.enum(['edit', 'post', 'cancel'])),
});

/** The Warehouse handoff (warehouse.material_issues.view): what leaves, from where — nothing else. */
export const WarehouseIssueRow = z.object({
  id: z.string(),
  number: z.string(),
  status: issueStatus,
  branch: ref,
  order: z.object({ number: z.string() }),
  postedAt: z.string().nullable(),
  createdAt: z.string(),
  lines: z.array(
    z.object({ item: ref, unit, location: ref, lot: lotRef.nullable(), quantity: z.string() }),
  ),
});

export const Preview = z.object({
  bom: z.object({ id: z.string(), code: z.string(), revision: z.number() }),
  quantity: z.string(),
  materialState: materialStateEnum,
  materials: z.array(MaterialLine),
});

// ---------------------------------------------------------------- planning reads

export const RequirementRow = z.object({
  item: ref,
  unit,
  required: z.string(),
  /** EP37: own ACTIVE reservations and posted issues of these orders; what still needs reserving. */
  reserved: z.string(),
  issued: z.string(),
  stillNeeded: z.string(),
  available: z.string(),
  shortage: z.string(),
  state: availability,
  orderCount: z.number(),
  earliestRequiredDate: z.string().nullable(),
});

export const DemandRow = z.object({
  salesOrder: z.object({
    id: z.string(),
    number: z.string(),
    status: z.string(),
    requestedDate: z.string().nullable(),
  }),
  lineId: z.string(),
  lineNo: z.number(),
  branch: ref,
  item: ref,
  unit,
  ordered: z.string(),
  dispatched: z.string(),
  reserved: z.string(),
  open: z.string(),
  /** Branch stock available to new demand, shared FEFO-style across lines (requested date first). */
  availableShare: z.string(),
  uncovered: z.string(),
  planned: z.string(),
  /** uncovered − planned (≥ 0): an informational suggestion, never automatic. */
  suggested: z.string(),
  activeBom: z.object({ id: z.string(), code: z.string(), revision: z.number() }).nullable(),
  orders: z.array(
    z.object({ id: z.string(), number: z.string(), status: moStatus, quantity: z.string() }),
  ),
});

/** The Purchasing handoff: what approved plans lack — no value, no supplier, no customer. */
export const ShortageRow = z.object({
  order: z.object({
    id: z.string(),
    number: z.string(),
    status: moStatus,
    requiredDate: z.string().nullable(),
    plannedStartDate: z.string().nullable(),
  }),
  branch: ref,
  material: ref,
  unit,
  required: z.string(),
  available: z.string(),
  shortage: z.string(),
});

export const ProductionItem = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  unit: z.object({ id: z.string(), code: z.string(), precision: z.number() }),
  activeBom: z.object({ id: z.string(), code: z.string(), revision: z.number() }).nullable(),
});

export const Timeline = z.array(timelineEntry);
